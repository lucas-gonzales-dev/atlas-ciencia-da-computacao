// S16a — os dois eixos de uma estação.
//
// O que este arquivo não é: um espelho do core/eixos.js. Cada asserção abaixo
// confere UMA DECISÃO do desenho (design/v3/00-desenho.md, princípio 1 e as
// tabelas "Uma aula" e "A estação"), e as duas provas do fim do arquivo existem
// para mostrar que a decisão tem dente: se alguém trocar a regra, um teste cai.
//
// Os números do anel (0,7977 e 0,8005) foram calculados À MÃO da curva do FSRS-6,
// R(t,S) = (1 + FATOR·t/S)^DECAY com S=10 e DECAY=-0,1542, e não lidos da
// implementação: R(34,10) = 0,7977 (liga o anel) e R(33,10) = 0,8005 (não liga).
// A curva em si já é conferida contra a referência Python em tests/fsrs.test.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eixosDaEstacao, ESTAGIOS_DO_EIXO, LIMITE_RECUPERABILIDADE } from '../core/eixos.js';
import { diaSeguinte } from '../core/cartoes.js';

const ESTACAO = 'ubl-core-circuitos-digitais';
const AULA_1 = 'KGoSTh1sgyM';
const AULA_2 = 'Zm9vYmFyMTIzNA';
const AULA_3 = 'YmF6cXV4MTIzNDU';

/** Um indice.json de bolso: é o que o mapa tem em mãos, sem buscar o JSON da estação. */
const INDICE = (aulas = 3, segundos = 3000) => ({
  estacoes: { [ESTACAO]: { slug: 'circuitos-digitais', aulas, segundos } },
});

/** O estudo que core/estudo.js guarda: `{ [idDoVideo]: { estacao, abertaEm, estudadaEm } }`. */
const estudoDe = (registros) => ({ versao: 1, ultima: null, aulas: Object.fromEntries(registros) });
const registro = (id, estacao, { abertaEm = null, estudadaEm = null, n = 1 } = {}) => [
  id,
  { estacao, n, ...(abertaEm ? { abertaEm } : {}), ...(estudadaEm ? { estudadaEm } : {}) },
];

/** Um arquivo de cartões a partir de objetos soltos — o formato cru que `lerCartoes` devolve. */
const cartoesDe = (lista) => ({ versao: 1, cartoes: Object.fromEntries(lista.map((c) => [c.id, c])) });
const cartao = (id, { aula = AULA_1, criadoEm = '2026-11-01T10:00', historico = [], fsrs = null } = {}) => ({
  id,
  estacao: ESTACAO,
  aula,
  n: 1,
  frente: 'O que é XOR?',
  verso: 'Ou exclusivo',
  criadoEm,
  devidoEm: diaSeguinte(criadoEm),
  fsrs,
  historico,
});
const lembradoEm = (em, nota = 'lembrei') => ({ em, nota, confianca: null });

const eixos = (opcoes = {}) =>
  eixosDaEstacao(ESTACAO, { indice: INDICE(), hoje: '2026-11-04', ...opcoes });

// ── 1. os cinco estágios ────────────────────────────────────────────────────
test('S16a · estágio: nada aberto e nada concluído é FORA', () => {
  const r = eixos();
  assert.equal(r.estagio, 'fora');
  assert.equal(r.preenchimento, 0);
  assert.equal(r.cor, 0);
});

test('S16a · estágio: ao menos uma aberta e nenhuma estudada é EMBARCADA', () => {
  const r = eixos({
    estudo: estudoDe([registro(AULA_1, ESTACAO, { abertaEm: '2026-11-02T09:00' })]),
  });
  assert.equal(r.estagio, 'embarcada');
  // Embarcar não enche nada: abrir é declarado, fechar é verificado.
  assert.equal(r.estudadas, 0);
  assert.equal(r.preenchimento, 0);
});

test('S16a · estágio: estudada no meio do caminho é EM-PERCURSO', () => {
  const r = eixos({
    indice: INDICE(3),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
      registro(AULA_2, ESTACAO, { abertaEm: '2026-11-02T09:00', n: 2 }),
    ]),
  });
  assert.equal(r.estagio, 'em-percurso');
  assert.equal(r.estudadas, 1);
  assert.equal(r.preenchimento, 1 / 3);
});

test('S16a · estágio: todas as aulas estudadas é PERCORRIDA', () => {
  const fechadas = [AULA_1, AULA_2, AULA_3].map((id, i) =>
    registro(id, ESTACAO, { abertaEm: `2026-11-0${i + 1}T09:00`, estudadaEm: `2026-11-0${i + 1}T10:00`, n: i + 1 }),
  );
  const r = eixos({ indice: INDICE(3), estudo: estudoDe(fechadas) });
  assert.equal(r.estagio, 'percorrida');
  assert.equal(r.preenchimento, 1);
});

test('S16a · estágio: marcada no embarque com zero estudada é CONCLUIDA-ANTES', () => {
  const r = eixos({ progresso: { completed: [ESTACAO] } });
  assert.equal(r.estagio, 'concluida-antes');
  assert.equal(ESTAGIOS_DO_EIXO.includes(r.estagio), true);
});

test('S16a · estágio: concluída ANTES enche o mapa mas não pinta de lembrada', () => {
  const r = eixos({ progresso: { completed: [ESTACAO] } });
  assert.equal(r.preenchimento, 1);
  assert.equal(r.cor, 0);
  assert.equal(r.lembradas, 0);
  assert.equal(r.estudadas, 0);
});

test('S16a · estágio: concluída COM aulas estudadas sai do carimbo e entra na medida', () => {
  // O carimbo é o menor valor; quem de fato fechou aulas é medido, não carimbado.
  const r = eixos({
    indice: INDICE(1),
    progresso: { completed: [ESTACAO] },
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    cartoes: cartoesDe([
      cartao('c1', { criadoEm: '2026-11-01T10:00', historico: [lembradoEm('2026-11-02T09:00')] }),
    ]),
  });
  assert.equal(r.estagio, 'percorrida');
  assert.equal(r.cor, 1);
});

// ── 2. a cor é a do dia seguinte ────────────────────────────────────────────
test('S16a · cor: Lembrei no MESMO dia em que o cartão nasce não colore nada', () => {
  const r = eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    // 23h30 de um dia e 23h59 do mesmo dia: memória de curto prazo, e é isso que
    // o desenho separa de "eu sei".
    cartoes: cartoesDe([
      cartao('c1', { criadoEm: '2026-11-01T23:30', historico: [lembradoEm('2026-11-01T23:59')] }),
    ]),
  });
  assert.equal(r.lembradas, 0);
  assert.equal(r.cor, 0);
});

test('S16a · cor: Lembrei no dia seguinte colore a aula', () => {
  const r = eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    cartoes: cartoesDe([
      cartao('c1', { criadoEm: '2026-11-01T23:30', historico: [lembradoEm('2026-11-02T00:20')] }),
    ]),
  });
  assert.equal(r.lembradas, 1);
  assert.equal(r.cor, 1);
});

test('S16a · cor: a virada de mês e a de ano são contadas no calendário local', () => {
  const caso = (criadoEm, em) =>
    eixos({
      indice: INDICE(1),
      estudo: estudoDe([
        registro(AULA_1, ESTACAO, { abertaEm: criadoEm.slice(0, 10) + 'T09:00', estudadaEm: criadoEm }),
      ]),
      cartoes: cartoesDe([cartao('c1', { criadoEm, historico: [lembradoEm(em)] })]),
    });
  // 31/10 23h30 -> 01/11 00h20: um dia no CALENDÁRIO DELA. Em UTC é tudo 31/10.
  assert.equal(caso('2026-10-31T23:30', '2026-11-01T00:20').lembradas, 1);
  assert.equal(caso('2026-12-31T22:00', '2027-01-01T09:00').lembradas, 1);
  assert.equal(caso('2026-10-31T23:30', '2026-10-31T23:59').lembradas, 0);
});

test('S16a · cor: Errei nunca colore, nem no dia seguinte', () => {
  const r = eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    cartoes: cartoesDe([
      cartao('c1', { criadoEm: '2026-11-01T10:00', historico: [lembradoEm('2026-11-05T10:00', 'errei')] }),
    ]),
  });
  assert.equal(r.lembradas, 0);
});

test('S16a · cor: uma aula entre duas estudadas dá a metade, e o cartão de outra estação não conta', () => {
  const duasFechadas = [AULA_1, AULA_2].map((id, i) =>
    registro(id, ESTACAO, { abertaEm: `2026-11-0${i + 1}T09:00`, estudadaEm: `2026-11-0${i + 1}T10:00`, n: i + 1 }),
  );
  const r = eixos({
    indice: INDICE(3),
    estudo: estudoDe(duasFechadas),
    cartoes: cartoesDe([
      cartao('c1', { aula: AULA_1, criadoEm: '2026-11-01T10:00', historico: [lembradoEm('2026-11-02T10:00')] }),
      // c2: da outra estação. c3: desta, mas o 'lembrei' é no mesmo dia.
      { ...cartao('c2', { historico: [lembradoEm('2026-11-02T10:00')] }), estacao: 'ubl-core-outro' },
      cartao('c3', { aula: AULA_2, criadoEm: '2026-11-02T10:00', historico: [lembradoEm('2026-11-02T11:00')] }),
    ]),
  });
  assert.equal(r.estudadas, 2);
  assert.equal(r.lembradas, 1);
  assert.equal(r.cor, 0.5);
});

test('S16a · cor: aula aberta (não estudada) que tem cartão lembrado não entra na régua', () => {
  const r = eixos({
    indice: INDICE(2),
    estudo: estudoDe([registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00' })]),
    cartoes: cartoesDe([
      cartao('c1', { criadoEm: '2026-11-01T10:00', historico: [lembradoEm('2026-11-03T10:00')] }),
    ]),
  });
  assert.equal(r.lembradas, 0);
  assert.equal(r.cor, 0);
});

// ── 3. o tempo não rebaixa ──────────────────────────────────────────────────
test('S16a · tempo: 200 dias depois o estudo e a cor são os mesmos, e só o anel acende', () => {
  const estudo = estudoDe([
    registro(AULA_1, ESTACAO, { abertaEm: '2026-04-01T09:00', estudadaEm: '2026-04-01T10:00' }),
    registro(AULA_2, ESTACAO, { abertaEm: '2026-04-02T09:00', estudadaEm: '2026-04-02T10:00', n: 2 }),
  ]);
  const cartoes = cartoesDe([
    cartao('c1', {
      aula: AULA_1,
      criadoEm: '2026-04-01T10:00',
      historico: [lembradoEm('2026-04-02T10:00')],
      fsrs: { estabilidade: 10, dificuldade: 5, repeticoes: 1, lapsos: 0, ultimaEm: '2026-04-02T10:00' },
    }),
  ]);
  const ontem = eixos({ indice: INDICE(3), estudo, cartoes, hoje: '2026-04-03' });
  const depois = eixos({ indice: INDICE(3), estudo, cartoes, hoje: '2026-10-20' });

  assert.equal(depois.estagio, ontem.estagio);
  assert.equal(depois.estudadas, ontem.estudadas);
  assert.equal(depois.preenchimento, ontem.preenchimento);
  assert.equal(depois.lembradas, ontem.lembradas);
  assert.equal(depois.cor, ontem.cor);
  assert.equal(depois.segundosRestantes, ontem.segundosRestantes);
  // O que muda é o único campo que olha o relógio.
  assert.equal(depois.pedeRevisao, true);
});

// ── 4. o anel do pedeRevisao ────────────────────────────────────────────────
const comEstabilidade = (S, ultimaEm) =>
  eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    cartoes: cartoesDe([
      cartao('c1', {
        criadoEm: '2026-11-01T10:00',
        historico: [lembradoEm('2026-11-04T10:00')],
        fsrs: { estabilidade: S, dificuldade: 5, repeticoes: 1, lapsos: 0, ultimaEm },
      }),
    ]),
  });

test('S16a · anel: recuperabilidade média 0,7976 liga o pedeRevisao', () => {
  // S=10, última revisão 34 dias antes de 2026-11-04 -> R = 0,7976 (à mão), um fio
  // abaixo do limiar.
  const r = comEstabilidade(10, '2026-10-01T10:00');
  assert.equal(r.pedeRevisao, true);
});

test('S16a · anel: recuperabilidade média 0,8005 não liga o pedeRevisao', () => {
  // S=10, 33 dias -> R = 0,8005, um fio ACIMA do limiar. Os dois casos juntos são
  // a fronteira: um dia de diferença e o anel apaga.
  const r = comEstabilidade(10, '2026-10-02T10:00');
  assert.equal(r.pedeRevisao, false);
  assert.equal(LIMITE_RECUPERABILIDADE, 0.8);
});

test('S16a · anel: estação sem cartão medido não pede revisão, e isso não é "esfriando"', () => {
  // fsrs: null é "ainda não há modelo" (S15a). Devolver false aqui faria o mapa
  // acender para quem nunca abriu a fila.
  const r = eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    cartoes: cartoesDe([cartao('c1', { criadoEm: '2026-11-01T10:00', historico: [] })]),
  });
  assert.equal(r.pedeRevisao, false);
});

test('S16a · anel: um cartão esfriando sozinho liga o pedeRevisao', () => {
  const r = eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
    cartoes: cartoesDe([
      cartao('esfriando', {
        criadoEm: '2026-11-01T10:00',
        historico: [lembradoEm('2026-11-02T10:00')],
        fsrs: { estabilidade: 10, dificuldade: 5, repeticoes: 1, lapsos: 0, ultimaEm: '2026-10-01T10:00' },
      }),
    ]),
  });
  assert.equal(r.pedeRevisao, true);
});

test('S16a · anel: é a MÉDIA dos cartões, não o pior deles', () => {
  // O mesmo cartão esfriando (R = 0,7976) ao lado de um fresco revisado hoje
  // (R(0,100) = 1): média 0,8988, acima do limiar. Se a regra fosse "qualquer
  // cartão abaixo de 0,8", esta estação acenderia e a pessoa veria alarme onde há
  // uma memória de 100 dias intacta.
  const esfriando = {
    criadoEm: '2026-11-01T10:00',
    historico: [lembradoEm('2026-11-02T10:00')],
    fsrs: { estabilidade: 10, dificuldade: 5, repeticoes: 1, lapsos: 0, ultimaEm: '2026-10-01T10:00' },
  };
  const base = {
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
    ]),
  };
  const sozinha = eixos({ ...base, cartoes: cartoesDe([cartao('esfriando', esfriando)]) });
  const comFresco = eixos({
    ...base,
    cartoes: cartoesDe([
      cartao('esfriando', esfriando),
      cartao('fresco', {
        criadoEm: '2026-11-01T10:00',
        historico: [lembradoEm('2026-11-02T10:00')],
        fsrs: { estabilidade: 100, dificuldade: 5, repeticoes: 1, lapsos: 0, ultimaEm: '2026-11-04T09:00' },
      }),
    ]),
  });
  assert.equal(sozinha.pedeRevisao, true);
  assert.equal(comFresco.pedeRevisao, false);
});

// ── 5. o resto da conta ─────────────────────────────────────────────────────
test('S16a · medida: total e segundos vêm do indice.json, não do JSON da estação', () => {
  const r = eixos({ indice: INDICE(4, 4000), estudo: null });
  assert.equal(r.total, 4);
  assert.equal(r.segundosRestantes, 4000);
});

test('S16a · medida: o preenchimento desconta o tempo que falta', () => {
  const r = eixos({
    indice: INDICE(4, 4000),
    estudo: estudoDe([
      registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
      registro(AULA_2, ESTACAO, { abertaEm: '2026-11-01T11:00', estudadaEm: '2026-11-01T12:00', n: 2 }),
    ]),
  });
  assert.equal(r.preenchimento, 0.5);
  assert.equal(r.segundosRestantes, 2000);
});

test('S16a · robustez: estação que não está no índice devolve zeros, sem estourar', () => {
  const r = eixosDaEstacao('nao-existe', { indice: INDICE(), hoje: '2026-11-04' });
  assert.equal(r.total, 0);
  assert.equal(r.preenchimento, 0);
  assert.equal(r.cor, 0);
  assert.equal(r.segundosRestantes, 0);
  assert.equal(r.estagio, 'fora');
});

test('S16a · robustez: chamado sem dados nenhum devolve o estágio fora', () => {
  const r = eixosDaEstacao(ESTACAO);
  assert.equal(r.estagio, 'fora');
  assert.equal(r.pedeRevisao, false);
});

test('S16a · robustez: um registro de outra estação não entra na conta', () => {
  const r = eixos({
    indice: INDICE(1),
    estudo: estudoDe([
      registro(AULA_1, 'ubl-core-matematica-discreta', {
        abertaEm: '2026-11-01T09:00',
        estudadaEm: '2026-11-01T10:00',
      }),
    ]),
  });
  assert.equal(r.estudadas, 0);
  assert.equal(r.estagio, 'fora');
});

test('S16a · pureza: nada muta a entrada', () => {
  const estudo = estudoDe([
    registro(AULA_1, ESTACAO, { abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' }),
  ]);
  const cartoes = cartoesDe([
    cartao('c1', { criadoEm: '2026-11-01T10:00', historico: [lembradoEm('2026-11-02T10:00')] }),
  ]);
  const antes = JSON.stringify({ estudo, cartoes });
  eixos({ indice: INDICE(1), estudo, cartoes, progresso: { completed: [] } });
  assert.equal(JSON.stringify({ estudo, cartoes }), antes);
});

test('S16a · fonte: o indice.json real tem 35 estações e Circuitos Digitais com 93 aulas', () => {
  // A mesma razão de "escreva 1.375 à mão e o teste cai": o mapa se desenha do
  // dado, e um total escrito no código envelhece mentindo.
  const bruto = readFileSync(new URL('../data/aulas/indice.json', import.meta.url), 'utf8');
  const indice = JSON.parse(bruto);
  assert.equal(Object.keys(indice.estacoes).length, 35);
  const r = eixosDaEstacao(ESTACAO, { indice, hoje: '2026-11-04' });
  assert.equal(r.total, 93);
  assert.equal(r.segundosRestantes, 109956);
});
