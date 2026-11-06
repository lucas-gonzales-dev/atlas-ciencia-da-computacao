// S17a-1 — a série do percurso da caderneta (core/caderneta.js).
//
// O que este arquivo não é: um espelho do núcleo. Cada asserção confere UMA
// DECISÃO do desenho (design/v3/00-desenho.md, princípio 4 — carimbo que nasce de
// critério MEDIDO, com os espaços vazios à vista). As duas travas do fim (11 e 12)
// têm dente medido: se a regra do dia-ou-do-número for trocada no núcleo, elas caem.
//
// NENHUM DADO DESTA SUÍTE É UM OBJETO ESCRITO À MÃO. Tudo sai de `abrirAula`,
// `estudarAula`, `pularAula`, `criarCartao` e `revisarCartao` — as mesmas funções que
// a tela chama, com as mesmas datas com que a tela trabalha. Um
// `{estudadaEm: '...'}` digitado aqui provava o formato que o núcleo aceita em vez do
// fato que a caderneta precisa ver, e é assim que um carimbo nasceria de um campo que
// ninguém grava.
//
// AS DATAS SÃO SEMPRE `aaaa-mm-ddThh:mm` (o instante local que o núcleo grava) e as
// asserções comparam DIAS, porque a caderneta devolve dia, não instante.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  seriePercurso, serieDominio, recordes, proximaCoisa, caderneta,
  CORTE_CONSOLIDADO, JANELA_CALIBRACAO, DIAS_SEM_NADA, diasDeAtividade,
} from '../core/caderneta.js';
import { abrirAula, estudarAula, pularAula } from '../core/estudo.js';
import { criarCartao, revisarCartao } from '../core/cartoes.js';
import { proibido } from '../core/textos.js';
// S17a-2: o carimbo de domínio nasce do DESAFIO, e a data de «concluída antes» nasce
// da CONCLUSÃO. Montar `progresso.dominadas` ou `conclusoes` à mão aqui provaria o
// formato que o núcleo aceita em vez do fato que a caderneta vê — a mesma proibição do
// cabeçalho deste arquivo, agora para as duas séries novas.
import { aplicarResultado, fraseDaDominada } from '../core/desafio.js';
import { concluirEstacao, progressoVazio, resumoDaViagem } from '../core/viagem.js';

const LER = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
/** A grade REAL da UBL: o total de carimbos do domínio é contado dela, nunca escrito. */
const GRADE = JSON.parse(LER('data/catalog.json')).courses;

const L1 = 'ubl-core-circuitos-digitais';        // linha 1
const L2 = 'ubl-core-arquitetura-de-computadores'; // linha 2, pré-requisito: L1
const A1 = 'KGoSTh1sgyM';
const A2 = 'Zm9vYmFyMTIzNA';
const A3 = 'YmF6cXV4MTIzNDU';

/** O índice, na forma de `data/aulas/indice.json`: `aulas` é o TOTAL, um número. */
const indiceDe = (totais) => ({
  estacoes: Object.fromEntries(
    Object.entries(totais).map(([id, aulas]) => [id, { slug: id, aulas, segundos: aulas * 600 }]),
  ),
});
const TRES = (id = L1) => indiceDe({ [id]: 3 });

/** As duas estações de verdade do catálogo, com a pré-requisição que faz a baldeação. */
const CATALOGO = [
  { id: L1, title: 'Circuitos Digitais', stage: 1, prerequisites: [] },
  { id: L2, title: 'Arquitetura de Computadores', stage: 2, prerequisites: [L1] },
];

const ESTUDO = () => ({ versao: 1, ultima: null, aulas: {} });
/** `criarCartao`/`revisarCartao` trabalham sobre o MAPA de cartões; a caderneta aceita as duas formas. */
const MAPA = () => ({});

const abrir = (estudo, aula, quando, estacao = L1) => abrirAula(estudo, { estacao, aula, n: 1 }, quando);
const fechar = (estudo, aula, quando, estacao = L1) => estudarAula(estudo, { estacao, aula, n: 1 }, quando, { recordacao: 'r', conferencia: 'c' });
const pular = (estudo, aula, quando, estacao = L1) => pularAula(estudo, { estacao, aula, n: 1 }, quando);

/** O cartão nasce do gesto da tela: frente e verso escritos ali, e o id fixo é o único luxo do teste. */
function escreverCartao(mapa, id, { aula = A1, estacao = L1, quando = '2026-11-01T10:00' } = {}) {
  const r = criarCartao(mapa, { estacao, aula, n: 1, frente: `frente ${id}`, verso: `verso ${id}` }, quando, id);
  assert.equal(r.ok, true, `criarCartao recusou ${id}: ${JSON.stringify(r)}`);
  return r.cartoes;
}

/** A resposta do cartão, com a confiança que a tela manda junto. */
function responder(mapa, id, nota, quando, confianca = null) {
  const r = revisarCartao(mapa, id, { nota, ...(confianca ? { confianca } : {}) }, quando);
  assert.equal(r.ok, true, `revisarCartao recusou ${id}/${nota}: ${JSON.stringify(r)}`);
  return r.cartoes;
}

const carimbo = (lista, id) => lista.find((c) => c.id === id);
const ORDEM = ['embarque', 'primeiraAula', 'primeiraRevisao', 'consolidado', 'estacaoPercorrida', 'baldeacao', 'deVolta', 'calibrado'];

// ───────────────────── 1. os 8 sempre presentes, vazios sem dados ─────────────────────

test('S17a-1 · com nada medido, os 8 carimbos estão lá, na ordem, todos vazios', () => {
  const s = seriePercurso({});
  assert.deepEqual(s.map((c) => c.id), ORDEM, 'a série mudou de ordem ou de tamanho');
  for (const c of s) {
    assert.equal(c.serie, 'percurso', `${c.id}: série errada`);
    assert.equal(c.data, null, `${c.id}: carimbo com data sem nenhum dado no mundo`);
    assert.equal(c.frase, 'Ainda não aconteceu.', `${c.id}: o vazio não mostra o espaço em branco`);
    for (const campo of ['nome', 'criterio']) {
      assert.ok(c[campo] && c[campo].trim().length > 3, `${c.id}: ${campo} vazio — o espaço vazio tem de dizer o que falta`);
    }
  }
});

test('S17a-1 · o vazio continua na lista quando os outros enchem', () => {
  const estudo = abrir(ESTUDO(), A1, '2026-11-01T10:00');
  const s = seriePercurso({ estudo });
  assert.equal(carimbo(s, 'embarque').data, '2026-11-01');
  assert.notEqual(carimbo(s, 'embarque').frase, 'Ainda não aconteceu.');
  for (const id of ORDEM.filter((x) => x !== 'embarque')) {
    assert.equal(carimbo(s, id).data, null, `${id}: encheu sem fato nenhum`);
    assert.equal(carimbo(s, id).frase, 'Ainda não aconteceu.', `${id}: a frase do preenchido vazou no vazio`);
  }
});

// ────────── 2. embarque e primeira aula: o primeiro fato, não o último ──────────

test('S17a-1 · embarque é a PRIMEIRA abertura, e a primeira aula é o PRIMEIRO fecho', () => {
  let estudo = abrir(ESTUDO(), A1, '2026-11-01T09:00');
  estudo = abrir(estudo, A2, '2026-11-03T09:00');
  estudo = fechar(estudo, A2, '2026-11-03T10:00');
  estudo = fechar(estudo, A1, '2026-11-05T10:00');
  const s = seriePercurso({ estudo });
  assert.equal(carimbo(s, 'embarque').data, '2026-11-01', 'o embarque seguiu a última abertura');
  assert.equal(carimbo(s, 'primeiraAula').data, '2026-11-03', 'a primeira aula estudada seguiu o último fecho');
});

test('S17a-1 · abrir de novo não reescreve o embarque, e fechar de novo não reescreve a aula', () => {
  let estudo = abrir(ESTUDO(), A1, '2026-11-01T09:00');
  estudo = fechar(estudo, A1, '2026-11-02T09:00');
  estudo = abrir(estudo, A1, '2026-11-20T09:00');
  estudo = fechar(estudo, A1, '2026-11-21T09:00');
  const s = seriePercurso({ estudo });
  assert.equal(carimbo(s, 'embarque').data, '2026-11-01');
  assert.equal(carimbo(s, 'primeiraAula').data, '2026-11-02');
});

test('S17a-1 · quem fecha sem abrir tem os dois carimbos no mesmo dia — e é verdade', () => {
  const s = seriePercurso({ estudo: fechar(ESTUDO(), A1, '2026-11-04T18:30') });
  assert.equal(carimbo(s, 'embarque').data, '2026-11-04');
  assert.equal(carimbo(s, 'primeiraAula').data, '2026-11-04');
});

test('S17a-1 · embarcar às 23h30 não corre para o dia seguinte', () => {
  const s = seriePercurso({ estudo: abrir(ESTUDO(), A1, '2026-11-01T23:30') });
  assert.equal(carimbo(s, 'embarque').data, '2026-11-01', 'o dia foi lido como UTC, e o Atlas é local');
});

// ──────────── 3. primeira revisão no dia seguinte: voltar, e não acertar ────────────

test('S17a-1 · a revisão no dia seguinte enche o carimbo com QUALQUER nota', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:00' });
  mapa = responder(mapa, 'c1', 'errei', '2026-11-02T09:00');
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'primeiraRevisao').data, '2026-11-02', 'Errei não vale voltar, e devia');
});

test('S17a-1 · seis respostas no MESMO dia do cartão não enchem o carimbo', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:00' });
  const estudo = fechar(ESTUDO(), A1, '2026-11-01T09:30');
  for (const nota of ['lembrei', 'errei', 'lembrei', 'errei', 'lembrei', 'errei']) {
    mapa = responder(mapa, 'c1', nota, '2026-11-01T11:00');
  }
  assert.ok(mapa.c1.historico.length >= 6, 'as respostas nem entraram no cartão: o caso não prova nada');
  assert.equal(carimbo(seriePercurso({ cartoes: mapa, estudo }), 'primeiraRevisao').data, null, 'mesmo dia contou como dia seguinte');
});

test('S17a-1 · o carimbo é da PRIMEIRA volta, não da última', () => {
  let a = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:00' });
  a = responder(a, 'c1', 'lembrei', '2026-11-05T10:00');
  a = responder(a, 'c1', 'lembrei', '2026-11-09T10:00');
  assert.equal(carimbo(seriePercurso({ cartoes: a }), 'primeiraRevisao').data, '2026-11-05');

  let b = escreverCartao(a, 'c2', { quando: '2026-11-02T10:00' });
  b = responder(b, 'c2', 'errei', '2026-11-03T10:00');
  assert.equal(carimbo(seriePercurso({ cartoes: b }), 'primeiraRevisao').data, '2026-11-03', 'a volta mais antiga do outro cartão foi ignorada');
});

test('S17a-1 · a volta um dia depois da meia-noite é volta, e não a mesma sessão', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T23:50' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-02T00:10');
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'primeiraRevisao').data, '2026-11-02');
});

// ─────────────── 4. primeiro cartão consolidado ───────────────

/** A agenda que atravessa o corte pelas mãos do FSRS, medida em tests: 16,1 → 44,4. */
function cartaoAteConsolidar(id = 'c1', criadoEm = '2025-11-01T10:00') {
  let mapa = escreverCartao(MAPA(), id, { quando: criadoEm });
  const agenda = [
    ['2025-11-02T10:00', 'lembrei'], // S = 2,31
    ['2025-11-03T10:00', 'lembrei'], // S = 7,32
    ['2025-11-05T10:00', 'lembrei'], // S = 16,12 — duas Lembremi, ainda abaixo do corte
    ['2025-11-13T10:00', 'lembrei'], // S = 44,45 — e aqui o cartão consolida
  ];
  const passos = agenda.map(([em, nota]) => {
    mapa = responder(mapa, id, nota, em);
    return { em, nota, S: mapa[id].fsrs.estabilidade };
  });
  assert.ok(passos[2].S < CORTE_CONSOLIDADO, `11-05 já passou do corte (${passos[2].S}): o caso perdeu o dente`);
  assert.ok(passos[3].S >= CORTE_CONSOLIDADO, `11-13 não passou do corte (${passos[3].S}): a agenda não chega ao fato`);
  return { mapa, passos };
}

/** O cartão no estado depois dos `ate` PRIMEIROS passos da agenda, refazendo o gesto. */
function cartaoAte(ate) {
  const { passos } = cartaoAteConsolidar();
  const agenda = passos.slice(0, ate);
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2025-11-01T10:00' });
  for (const p of agenda) mapa = responder(mapa, 'c1', p.nota, p.em);
  assert.equal(mapa.c1.fsrs.estabilidade, passos[ate - 1].S, `refazer a agenda divergiu no passo ${ate}`);
  return { mapa, agenda };
}

test('S17a-1 · estabilidade 16 com duas Lembremi não consolida; 44 com duas consolida, no dia', () => {
  const antes = cartaoAte(3); // três Lembremi: S = 16,12, duas últimas notas lembradas
  assert.equal(antes.agenda.slice(-2).every((p) => p.nota === 'lembrei'), true, 'o caso não tem duas Lembremi: não prova nada');
  assert.equal(carimbo(seriePercurso({ cartoes: antes.mapa }), 'consolidado').data, null, 'consolidou com estabilidade abaixo do corte');
  const depois = seriePercurso({ cartoes: cartaoAte(4).mapa });
  assert.equal(carimbo(depois, 'consolidado').data, '2025-11-13', 'o carimbo não é do dia em que o cartão passou');
});

test('S17a-1 · um lapso derruba o consolidado — e ele volta com o intervalo recuperado', () => {
  let mapa = cartaoAteConsolidar().mapa;
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'consolidado').data, '2025-11-13');

  mapa = responder(mapa, 'c1', 'errei', '2025-11-21T10:00'); // S = 2,55
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'consolidado').data, null, 'o carimbo ficou com quem esqueceu');

  mapa = responder(mapa, 'c1', 'lembrei', '2025-11-23T10:00'); // S = 6,09
  mapa = responder(mapa, 'c1', 'lembrei', '2025-12-05T10:00'); // S = 19,77 — duas Lembremi, um fio abaixo
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'consolidado').data, null, 'consolidou em 19,77');

  mapa = responder(mapa, 'c1', 'lembrei', '2025-12-14T10:00'); // S = 32,49
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'consolidado').data, '2025-12-14', 'não carimbou a recuperação');
});

test('S17a-1 · a condição das duas notas é guarda, e é o FSRS que a manda', () => {
  const { passos } = cartaoAteConsolidar();
  const antesDoUltimo = passos[2];
  assert.equal(antesDoUltimo.nota, 'lembrei');
  assert.ok(antesDoUltimo.S < CORTE_CONSOLIDADO, 'sem este fato medido a frase do Errei por último seria decoração');
  let mapa = cartaoAteConsolidar().mapa;
  mapa = responder(mapa, 'c1', 'errei', '2025-11-21T10:00');
  const depois = mapa.c1;
  assert.ok(depois.historico.slice(-2).some((h) => h.nota === 'errei'), 'o histórico não termina em Errei: o caso não prova nada');
  assert.ok(depois.fsrs.estabilidade < CORTE_CONSOLIDADO, 'um Errei não derrubou a estabilidade: a cláusula das duas notas passou a ser a única régua');
});

// ─────────────── 5. primeira estação percorrida ───────────────

test('S17a-1 · percorrida é o fecho que completou a estação, e só ele', () => {
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  estudo = fechar(estudo, A2, '2026-11-04T10:00');
  const dados = { estudo, indice: TRES(), catalogo: CATALOGO };
  assert.equal(carimbo(seriePercurso(dados), 'estacaoPercorrida').data, null, '2 de 3 é percorrida');
  const completa = fechar(estudo, A3, '2026-11-09T18:00');
  assert.equal(carimbo(seriePercurso({ ...dados, estudo: completa }), 'estacaoPercorrida').data, '2026-11-09', 'o carimbo não é do fecho que completou');
});

test('S17a-1 · o pulo percorre, mas abrir não percorre', () => {
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  estudo = pular(estudo, A2, '2026-11-02T10:00');
  estudo = abrir(estudo, A3, '2026-11-03T10:00');
  assert.equal(carimbo(seriePercurso({ estudo, indice: TRES(), catalogo: CATALOGO }), 'estacaoPercorrida').data, null, 'aberta conta como feita');
  const fechada = fechar(estudo, A3, '2026-11-04T10:00');
  assert.equal(carimbo(seriePercurso({ estudo: fechada, indice: TRES(), catalogo: CATALOGO }), 'estacaoPercorrida').data, '2026-11-04');
});

test('S17a-1 · sem índice não há total, e o carimbo fica vazio', () => {
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  estudo = fechar(estudo, A2, '2026-11-02T10:00');
  estudo = fechar(estudo, A3, '2026-11-03T10:00');
  assert.equal(carimbo(seriePercurso({ estudo, catalogo: CATALOGO }), 'estacaoPercorrida').data, null, 'inventou total sem índice');
});

test('S17a-1 · concluída por declaração, sem aula estudada, não é percorrida', () => {
  const progresso = { completed: [L1], emCurso: [], conclusoes: { [L1]: '2026-11-01' }, dominadas: {} };
  const s = seriePercurso({ progresso, catalogo: CATALOGO, indice: TRES() });
  assert.equal(carimbo(s, 'estacaoPercorrida').data, null, 'o carimbo medido aceitou a declaração — é o bilhete que o princípio 4 manda trocar');
});

test('S17a-1 · dominada também vale, e o dia é o do fecho que percorreu', () => {
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  estudo = fechar(estudo, A2, '2026-11-02T10:00');
  estudo = fechar(estudo, A3, '2026-11-03T10:00');
  const progresso = { completed: [], emCurso: [], conclusoes: {}, dominadas: { [L1]: { em: '2026-11-10T10:00', nota: 0.9, cartoes: ['c1'], reprovadoEm: null } } };
  const s = seriePercurso({ estudo, progresso, catalogo: CATALOGO, indice: TRES() });
  assert.equal(carimbo(s, 'estacaoPercorrida').data, '2026-11-03', 'dominada ficou de fora');
});

// ─────────────── 6. primeira baldeação ───────────────

test('S17a-1 · baldeação são duas concluídas em linhas diferentes, no dia do segundo carimbo', () => {
  const uma = { completed: [L1], emCurso: [], conclusoes: { [L1]: '2026-11-01' }, dominadas: {} };
  assert.equal(carimbo(seriePercurso({ progresso: uma, catalogo: CATALOGO }), 'baldeacao').data, null, 'uma estação só já baldeia');
  const duas = {
    completed: [L1, L2],
    emCurso: [],
    conclusoes: { [L1]: '2026-11-01', [L2]: '2026-11-12' },
    dominadas: {},
  };
  assert.equal(carimbo(seriePercurso({ progresso: duas, catalogo: CATALOGO }), 'baldeacao').data, '2026-11-12');
});

test('S17a-1 · duas concluídas da MESMA linha não baldeiam', () => {
  const irma = 'ubl-core-programacao-logica';
  const catalogo = [
    { id: L1, title: 'Circuitos Digitais', stage: 1, prerequisites: [] },
    { id: irma, title: 'Programação Lógica', stage: 1, prerequisites: [L1] },
  ];
  const progresso = { completed: [L1, irma], emCurso: [], conclusoes: { [L1]: '2026-11-01', [irma]: '2026-11-08' }, dominadas: {} };
  assert.equal(carimbo(seriePercurso({ progresso, catalogo }), 'baldeacao').data, null, 'mesma linha contada como baldeação');
});

// ─────────────── 7. de volta à linha ───────────────

/** Dois toques com `dias` de pausa entre eles, pelos gestos do app. */
function comPausa(dias) {
  const estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  const depois = new Date(2026, 10, 1 + dias);
  const stamp = `${depois.getFullYear()}-${String(depois.getMonth() + 1).padStart(2, '0')}-${String(depois.getDate()).padStart(2, '0')}T10:00`;
  return { estudo: abrir(estudo, A2, stamp), depois: stamp.slice(0, 10) };
}

test('S17a-1 · 6 dias sem nada não é volta, 7 é', () => {
  assert.equal(carimbo(seriePercurso(comPausa(6)), 'deVolta').data, null, 'seis dias contou como volta');
  const sete = comPausa(7);
  const s = seriePercurso(sete);
  assert.equal(carimbo(s, 'deVolta').data, sete.depois, 'sete dias não contou como volta');
  assert.equal(carimbo(s, 'deVolta').frase, 'Você voltou à linha.');
});

test('S17a-1 · a frase da volta nunca diz quantos dias', () => {
  for (const pausa of [7, 8, 70]) {
    const frase = carimbo(seriePercurso(comPausa(pausa)), 'deVolta').frase;
    assert.equal(frase, 'Você voltou à linha.', `pausa de ${pausa} dias mudou a frase`);
    assert.doesNotMatch(frase, /\d/, `a frase disse quantos dias: "${frase}"`);
  }
});

test('S17a-1 · a volta lê os cartões também, e o primeiro dia nunca é volta', () => {
  const estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:30' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-09T10:00');
  assert.equal(carimbo(seriePercurso({ estudo, cartoes: mapa }), 'deVolta').data, '2026-11-09', 'a pausa nos cartões não foi vista');
  const primeiro = escreverCartao(MAPA(), 'c9', { quando: '2026-11-01T10:00' });
  assert.equal(carimbo(seriePercurso({ cartoes: primeiro }), 'deVolta').data, null, 'um único dia virou volta');
});

test('S17a-1 · a volta é do primeiro retorno, e o pulo é atividade', () => {
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  estudo = pular(estudo, A2, '2026-11-09T10:00');
  estudo = fechar(estudo, A3, '2026-11-11T10:00');
  assert.equal(carimbo(seriePercurso({ estudo }), 'deVolta').data, '2026-11-09');
  assert.deepEqual(diasDeAtividade({ estudo }), ['2026-11-01', '2026-11-09', '2026-11-11']);
});

// ─────────────── 8. calibrado, no limite ───────────────

/** As revisões com confiança dita, pelos botões da tela, uma por dia no worst case. */
function comConfiancas(plano) {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T09:00' });
  plano.forEach(([confianca, nota], i) => {
    const dia = `2026-11-${String(2 + Math.floor(i / 2)).padStart(2, '0')}`;
    mapa = responder(mapa, 'c1', nota, `${dia}T09:00`, confianca);
  });
  return mapa;
}

const planoDe = (especificacao) => {
  const out = [];
  for (const [confianca, acertos, total] of especificacao) {
    for (let i = 0; i < total; i += 1) out.push([confianca, i < acertos ? 'lembrei' : 'errei']);
  }
  return out;
};

test('S17a-1 · calibrado no limite exato: certeza 12/14 (0,857), acho 4/5 (0,8), chute 0/1', () => {
  const mapa = comConfiancas(planoDe([['certeza', 12, 14], ['acho', 4, 5], ['chute', 0, 1]]));
  assert.equal(mapa.c1.historico.length, JANELA_CALIBRACAO);
  const c = carimbo(seriePercurso({ cartoes: mapa }), 'calibrado');
  assert.ok(c.data, `no limite a série não carimbou (${JSON.stringify(c)})`);
  assert.equal(c.frase, 'Dizer que sabe bate com lembrar.');
});

test('S17a-1 · certeza 11/14 (0,786) não calibra, e é o limite por baixo', () => {
  const mapa = comConfiancas(planoDe([['certeza', 11, 14], ['acho', 4, 5], ['chute', 0, 1]]));
  assert.equal(mapa.c1.historico.length, JANELA_CALIBRACAO);
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'calibrado').data, null, 'calibrou com certeza abaixo de 0,8');
});

test('S17a-1 · chute que acerta mais que acho não é calibração', () => {
  const mapa = comConfiancas(planoDe([['certeza', 14, 14], ['acho', 2, 4], ['chute', 2, 2]]));
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'calibrado').data, null, 'a confiança não discriminou nada');
});

test('S17a-1 · acho 0/4 com certeza 16/16 não calibra: a régua é a ordem toda', () => {
  const mapa = comConfiancas(planoDe([['certeza', 16, 16], ['acho', 0, 3], ['chute', 0, 1]]));
  assert.equal(mapa.c1.historico.length, JANELA_CALIBRACAO);
  assert.ok(carimbo(seriePercurso({ cartoes: mapa }), 'calibrado').data, 'com a ordem respeitada a série recusou');
});

test('S17a-1 · sem confiança dita não há calibração possível', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T09:00' });
  for (let i = 0; i < 24; i += 1) {
    mapa = responder(mapa, 'c1', 'lembrei', `2026-11-${String(2 + (i % 26)).padStart(2, '0')}T09:00`);
  }
  assert.ok(mapa.c1.historico.length > JANELA_CALIBRACAO, 'as revisões nem entraram: o caso não prova nada');
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'calibrado').data, null, 'carimbou sem nenhuma confiança dita');
});

test('S17a-1 · 19 revisões com confiança não bastam; a janela são 20', () => {
  const mapa = comConfiancas(planoDe([['certeza', 12, 13], ['acho', 4, 5], ['chute', 1, 1]]));
  assert.equal(mapa.c1.historico.length, 19);
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'calibrado').data, null, 'calibrou com menos de 20');
});

// ─────────────── 9. a série inteira, com o que a pessoa fez de verdade ───────────────

test('S17a-1 · uma viagem completa enche os carimbos, cada um no dia do seu fato', () => {
  let estudo = abrir(ESTUDO(), A1, '2026-11-01T09:00');
  estudo = fechar(estudo, A1, '2026-11-01T10:00');
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:30' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-02T10:00', 'acho');
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-09T10:00', 'certeza');
  estudo = fechar(estudo, A2, '2026-11-09T10:00');
  estudo = fechar(estudo, A3, '2026-11-12T10:00');
  const progresso = { completed: [L1, L2], emCurso: [], conclusoes: { [L1]: '2026-11-12', [L2]: '2026-11-20' }, dominadas: {} };
  const datas = Object.fromEntries(seriePercurso({ estudo, cartoes: mapa, progresso, catalogo: CATALOGO, indice: TRES() }).map((c) => [c.id, c.data]));
  assert.equal(datas.embarque, '2026-11-01');
  assert.equal(datas.primeiraAula, '2026-11-01');
  assert.equal(datas.primeiraRevisao, '2026-11-02');
  assert.equal(datas.estacaoPercorrida, '2026-11-12');
  assert.equal(datas.baldeacao, '2026-11-20');
  // 01, 02, 09, 12: a pausa de 02 para 09 são sete dias, e é a primeira volta.
  assert.equal(datas.deVolta, '2026-11-09', 'a volta não foi lida nos dias de estudo e cartão');
  for (const c of seriePercurso({ estudo, cartoes: mapa, progresso, catalogo: CATALOGO, indice: TRES() })) {
    if (c.data) assert.notEqual(c.frase, 'Ainda não aconteceu.', `${c.id}: data sem frase`);
  }
});

test('S17a-1 · nada aqui depende de `hoje`: o tempo não rebaixa carimbo', () => {
  const dados = { estudo: fechar(ESTUDO(), A1, '2026-11-01T10:00') };
  assert.deepEqual(seriePercurso(dados), seriePercurso({ ...dados, hoje: '2027-06-01' }));
});

test('S17a-1 · a série devolve texto, e nada do que entra é mutado', () => {
  const estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  const mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:00' });
  const antes = JSON.stringify({ estudo, mapa });
  seriePercurso({ estudo, cartoes: mapa, progresso: null, catalogo: CATALOGO, indice: TRES() });
  assert.equal(JSON.stringify({ estudo, mapa }), antes, 'a caderneta escreveu nos baldes de outra função');
});

// ─────────────── 10. a frase, sob a lista do proibido ───────────────

test('S17a-1 · as frases dos 8 carimbos não têm número, nem palavra de sequência', () => {
  const estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:00' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-02T10:00', 'certeza');
  const s = seriePercurso({ estudo, cartoes: mapa, progresso: { completed: [L1, L2], emCurso: [], conclusoes: { [L1]: '2026-11-01', [L2]: '2026-11-12' }, dominadas: {} }, catalogo: CATALOGO, indice: TRES() });
  const reNumero = /\d/;
  const reSequencia = /\b(Primeira|Primeiro|Última|Último|Segunda|Terceira|Quarta|Quinta|Em primeiro|Depois de)\b/i;
  for (const c of s) {
    assert.equal(reNumero.test(c.frase), false, `a frase tem número: "${c.frase}" (${c.id})`);
    assert.equal(reSequencia.test(c.frase), false, `a frase tem palavra de sequência: "${c.frase}" (${c.id})`);
  }
});

test('S17a-1 · o critério medido fica visível, e a lista do proibido tem as duas regras', () => {
  const sobreDias = proibido.filter((i) => /número de dias/.test(i));
  const sobreSequencia = proibido.filter((i) => /palavra de sequência/.test(i));
  assert.equal(sobreDias.length, 1, `a lista do proibido não tem o item dos dias (${JSON.stringify(proibido.slice(-3))})`);
  assert.equal(sobreSequencia.length, 1, 'a lista do proibido não tem o item da sequência');
  const s = seriePercurso({});
  const criterios = s.map((c) => c.criterio);
  assert.ok(criterios.every((t) => t && t.length > 12), 'há critério vazio: espaço vazio sem régua');
  assert.ok(s.every((c) => c.nome && c.serie === 'percurso'));
});

// ─────────────── 11. A PROVA — o número na frase da volta ───────────────
// Em core/textos.js, troque `frase: 'Você voltou à linha.'` por
// 'Você voltou à linha depois de 9 dias.' → a trava abaixo cai (falha colada no
// commit). É o dente do desenho: a caderneta não fala de ausência para a pessoa, e o
// número da régua vive em DIAS_SEM_NADA, no código.

test('PROVA S17a-1 · a frase da volta com número de dias é pega pela trava', () => {
  const lida = carimbo(seriePercurso(comPausa(DIAS_SEM_NADA)), 'deVolta').frase;
  assert.equal(lida, 'Você voltou à linha.');
  assert.doesNotMatch(lida, /\d/);
  assert.equal(/\d/.test('Você voltou à linha depois de 9 dias.'), true, 'a régua da trava não enxerga número: é decoração');
});

// ─────────────── 12. A PROVA — a revisão do mesmo dia ───────────────
// Em core/caderneta.js, troque `espera >= 1` por `espera >= 0` (ou a condição por
// `dia !== origem`) → a trava de cima cai, no caso 'seis respostas no MESMO dia'.
// É o defeito exato: responder o cartão na hora em que ele nasce é memória de curto
// prazo, e o eixo da cor (core/eixos.js) já diz que isso não é lembrança.

test('PROVA S17a-1 · a régua do dia seguinte é de calendário, e não de instante', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:00' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-01T23:59'); // 13h59 depois: mesma sessão
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'primeiraRevisao').data, null, 'mesmo dia, horário diferente, contou como volta');
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-02T00:01'); // dois minutos depois da meia-noite
  assert.equal(carimbo(seriePercurso({ cartoes: mapa }), 'primeiraRevisao').data, '2026-11-02', 'virou o dia e a caderneta não viu');
});

// ══════════════════════════ S17a-2: domínio, recordes, próxima ══════════════════════════
//
// As mesmas fábricas de cima, e as MESMAS proibições: o carimbo de domínio sai de
// `aplicarResultado` (core/desafio.js) — o desafio aprovado que a tela chama — e a
// «concluída antes» sai de `concluirEstacao` (core/viagem.js), o gesto de marcar. Um
// `{dominadas: {x: {em: ...}}}` digitado aqui não provaria que a caderneta lê o que o
// desafio grava, que é exatamente a conta que pode quebrar quando o formato do carimbo
// mudar.

const carimboDe = (lista, id) => lista.find((c) => c.id === id);

/** O desafio aprovado, pelo caminho da tela: `aplicarResultado` escreve o carimbo. */
function dominar(progresso, mapa, estacao, { quando = '2026-11-10T10:00', aulas = 93, cartoes = 23, acertos = 12, total = 14 } = {}) {
  const r = aplicarResultado(
    progresso,
    mapa,
    estacao,
    { aprovado: true, acertos, total, lembrados: idsLembrados(acertos), errados: [] },
    { aulas, cartoes },
    quando,
  );
  assert.ok(r.progresso.dominadas[estacao], `aplicarResultado não carimbou ${estacao}: ${JSON.stringify(r)}`);
  return r.progresso;
}

/** O carimbo do desafio guarda `lembrados` como LISTA de ids; a frase lê o tamanho dela. */
const idsLembrados = (n) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

/** A declaração pelo gesto da tela, com o dia em que a pessoa marcou. */
const marcar = (progresso, estacao, quando) => {
  const p = concluirEstacao(progresso, estacao, quando, GRADE);
  assert.equal(p.conclusoes[estacao], quando, `concluirEstacao não gravou ${estacao} em ${quando}`);
  return p;
};

const V = () => progressoVazio();
const NOMES = Object.fromEntries(GRADE.map((c) => [c.id, c.title]));

// ─────────────── 13. os 43 sempre presentes ───────────────

test('S17a-2 · a série do domínio tem uma estação por disciplina da grade, mais 7 linhas e o terminal', () => {
  const estacoes = GRADE.length;
  const linhas = new Set(GRADE.map((c) => c.stage)).size;
  assert.equal(estacoes, 35, 'a grade não tem mais 35 disciplinas: o total do pedido precisa ser refeito');
  assert.equal(linhas, 7, 'a grade não tem mais 7 linhas: idem');

  const s = serieDominio({ catalogo: GRADE, progresso: V() });
  assert.equal(s.length, estacoes + linhas + 1, 'o domínio deixou de ser 43 com a grade atual');
  assert.equal(s.filter((c) => c.serie !== 'dominio').length, 0, 'carimbo de domínio com outra série');

  // Os 35 primeiros são as estações, na ordem do catálogo; depois as linhas, na ordem do
  // número; e o terminal fecha. Uma lista montada por filtro perderia o espaço vazio.
  assert.deepEqual(s.slice(0, estacoes).map((c) => c.id), GRADE.map((c) => `dominio:${c.id}`));
  assert.equal(s.at(-1).id, 'dominio:terminal');
  assert.ok(s.every((c) => c.nome && c.nome.trim().length > 1), 'carimbo sem nome: o espaço vazio não diz o que é');
  assert.ok(s.every((c) => c.criterio && c.criterio.length > 12), 'carimbo sem critério visível');
});

test('S17a-2 · com nada feito, os 43 estão lá e todos vazios, cada um com a frase do próprio vazio', () => {
  const s = serieDominio({ catalogo: GRADE, progresso: V() });
  const ESPERADO = { estacao: 'Ainda não dominada.', linha: 'Ainda faltam estações dominadas nesta linha.', terminal: 'Ainda não chegou ao terminal.' };
  for (const c of s) {
    assert.equal(c.data, null, `${c.id}: carimbo de domínio com data sem desafio nenhum`);
    const kind = c.id === 'dominio:terminal' ? 'terminal' : (c.id.startsWith('dominio:linha-') ? 'linha' : 'estacao');
    assert.equal(c.frase, ESPERADO[kind], `${c.id}: o vazio não mostra o espaço em branco`);
  }
});

// ──────── 14. a dominada com os números da frase; a concluída antes sem frase ────────

test('S17a-2 · a estação dominada traz a frase do que foi MEDIDO, com os números do carimbo', () => {
  const p = dominar(V(), MAPA(), L1, { aulas: 93, cartoes: 23, acertos: 12, total: 14, quando: '2026-11-10T10:00' });
  const c = carimboDe(serieDominio({ catalogo: CATALOGO, progresso: p }), `dominio:${L1}`);
  assert.equal(c.data, '2026-11-10');
  assert.equal(c.nome, 'Circuitos Digitais');
  assert.equal(c.frase, fraseDaDominada(p.dominadas[L1]));
  for (const n of ['93', '23', '12', '14']) {
    assert.ok(c.frase.includes(n), `a frase não repete o número medido ${n}: "${c.frase}"`);
  }
  assert.ok(!/compet|ement|converte/i.test(c.frase), `a frase voltou a descrever a ementa: "${c.frase}"`);
});

test('S17a-2 · a frase da dominada não é tirada de data/competencias.json', () => {
  const competencias = JSON.parse(LER('data/competencias.json'));
  const p = dominar(V(), MAPA(), L1, { aulas: 3, cartoes: 4, acertos: 4, total: 4 });
  const frase = carimboDe(serieDominio({ catalogo: CATALOGO, progresso: p }), `dominio:${L1}`).frase;
  const textos = JSON.stringify(competencias);
  for (const trecho of frase.split(/,| e /).map((t) => t.trim()).filter((t) => t.length > 20)) {
    assert.equal(textos.includes(trecho), false, `a frase copiou a competência declarada: "${trecho}"`);
  }
});

test('S17a-2 · concluída antes fica VAZIA no domínio, com a marca e a data antiga separadas', () => {
  const p = marcar(V(), L1, '2026-10-05');
  const c = carimboDe(serieDominio({ catalogo: CATALOGO, progresso: p }), `dominio:${L1}`);
  assert.equal(c.marca, 'Concluída antes');
  assert.equal(c.marcaEm, '2026-10-05', 'a data antiga da declaração não viajou com a marca');
  assert.equal(c.data, null, 'a declaração ganhou carimbo de domínio — é o bilhete velho reentrando');
  assert.equal(c.frase, null, 'a conclusão declarada ganhou frase, e nada foi medido');
});

test('S17a-2 · concluída antes COM aula estudada não é «antes»: vira dominada ou medida', () => {
  // A régua de core/eixos.js: o estágio 'concluida-antes' só existe sem estudo atrás.
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  const p = marcar(V(), L1, '2026-10-05');
  const c = carimboDe(serieDominio({ estudo, catalogo: CATALOGO, progresso: p, indice: TRES() }), `dominio:${L1}`);
  assert.equal(c.marca, undefined, 'com aula estudada atrás a caderneta ainda chama de «concluída antes»');
  assert.equal(c.data, null, 'medida sem desafio ainda não é domínio');
});

test('S17a-2 · o re-aprovado move o carimbo para a última vez, e a frase com ele', () => {
  let p = dominar(V(), MAPA(), L1, { aulas: 93, cartoes: 23, acertos: 12, total: 14, quando: '2026-11-10T10:00' });
  p = dominar(p, MAPA(), L1, { aulas: 93, cartoes: 30, acertos: 14, total: 14, quando: '2026-12-01T10:00' });
  const c = carimboDe(serieDominio({ catalogo: CATALOGO, progresso: p }), `dominio:${L1}`);
  assert.equal(c.data, '2026-12-01');
  assert.ok(c.frase.includes('30'), `a frase ficou no carimbo velho: "${c.frase}"`);
});

// ─────────────── 15. fim de linha e terminal ───────────────

test('S17a-2 · o fim de linha enche quando TODAS as estações daquela linha são dominadas', () => {
  const daLinha1 = GRADE.filter((c) => c.stage === 1).map((c) => c.id);
  assert.ok(daLinha1.length > 1, 'a linha 1 tem uma estação só: o caso não prova «todas»');
  let p = V();
  for (const id of daLinha1.slice(0, -1)) p = dominar(p, MAPA(), id, { quando: '2026-11-10T10:00' });
  let s = serieDominio({ catalogo: GRADE, progresso: p });
  assert.equal(carimboDe(s, 'dominio:linha-1').data, null, 'a linha fechou sem a última estação');

  p = dominar(p, MAPA(), daLinha1.at(-1), { quando: '2026-11-20T10:00' });
  s = serieDominio({ catalogo: GRADE, progresso: p });
  const fim = carimboDe(s, 'dominio:linha-1');
  assert.equal(fim.data, '2026-11-20', 'o dia do fim de linha não é o da última dominada');
  assert.equal(fim.frase, 'Você dominou todas as estações desta linha.');
});

test('S17a-2 · declaradas antes NÃO fecham a linha: só dominada conta', () => {
  const daLinha1 = GRADE.filter((c) => c.stage === 1).map((c) => c.id);
  let p = V();
  for (const id of daLinha1) p = marcar(p, id, '2026-10-05');
  const s = serieDominio({ catalogo: GRADE, progresso: p });
  assert.equal(carimboDe(s, 'dominio:linha-1').data, null, 'a linha fechou por declaração, sem medida');
  assert.equal(carimboDe(s, 'dominio:terminal').data, null, 'o terminal chegou por declaração');
});

test('S17a-2 · o terminal enche com a rede toda dominada, e só então', () => {
  let p = V();
  for (const c of GRADE) p = dominar(p, MAPA(), c.id, { quando: '2026-11-10T10:00' });
  let s = serieDominio({ catalogo: GRADE, progresso: p });
  assert.equal(carimboDe(s, 'dominio:terminal').data, '2026-11-10');
  assert.equal(carimboDe(s, 'dominio:terminal').frase, 'Você dominou todas as estações da rede.');
  for (const c of s.filter((x) => x.id.startsWith('dominio:linha-'))) {
    assert.ok(c.data, `${c.id}: a linha não fechou com a rede toda dominada`);
  }
  assert.equal(s.filter((c) => c.frase === null).length, 0);

  const antes = dominar(V(), MAPA(), L1, { quando: '2026-11-10T10:00' });
  const soUma = serieDominio({ catalogo: GRADE, progresso: antes });
  assert.equal(carimboDe(soUma, 'dominio:terminal').data, null, 'o terminal com uma estação só');
});

// ─────────────── 16. recordes: sem sequência, e null sem dado ───────────────

test('S17a-2 · sem cartão no mundo, os dois recordes vêm null e sem frase', () => {
  const r = recordes({});
  assert.deepEqual(r.map((x) => x.id), ['semana', 'estabilidade']);
  for (const recorde of r) {
    assert.equal(recorde.valor, null, `${recorde.id}: recorde com número onde nada aconteceu`);
    assert.equal(recorde.frase, null, `${recorde.id}: a frase de um recorde inexistente`);
    assert.ok(recorde.nome && recorde.criterio, `${recorde.id}: o espaço vazio do recorde não se anuncia`);
  }
  assert.equal(recordes({ cartoes: MAPA() })[0].valor, null, 'cartões escritos sem revisão viraram recorde');
});

test('S17a-2 · o recorde da semana conta a PRIMEIRA tentativa do dia, e não as três', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-02T09:00' });
  mapa = escreverCartao(mapa, 'c2', { quando: '2026-11-02T09:00' });
  // 02/11/2026 é segunda: a semana de calendário é 02–08.
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-03T09:00');
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-03T18:00'); // a segunda tentativa do mesmo dia
  mapa = responder(mapa, 'c2', 'lembrei', '2026-11-04T09:00');
  const r = recordes({ cartoes: mapa })[0];
  assert.equal(r.valor, 2, `repetir o cartão no mesmo dia inflou o recorde (${r.valor})`);
  assert.equal(r.frase, 'Você lembrou 2 cartões numa semana.');
  assert.equal(r.data, '2026-11-02', 'a semana do recorde não começa na segunda');
});

test('S17a-2 · quem errou na primeira tentativa e acertou na segunda do dia não conta', () => {
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-02T09:00' });
  mapa = responder(mapa, 'c1', 'errei', '2026-11-03T09:00');
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-03T18:00');
  assert.equal(recordes({ cartoes: mapa })[0].valor, null, 'o recorde premiou reler até acertar');
});

test('S17a-2 · a estabilidade do recorde é arredondada, e sem dado é null', () => {
  assert.equal(recordes({})[1].valor, null);
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T09:00' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-02T09:00');
  const antes = recordes({ cartoes: mapa })[1];
  assert.ok(Number.isInteger(antes.valor), `estabilidade não arredondada: ${antes.valor}`);
  mapa.c1.fsrs.estabilidade = 37.4;
  const r = recordes({ cartoes: mapa })[1];
  assert.equal(r.valor, 37);
  assert.equal(r.frase, 'Um cartão seu aguenta 37 dias.');
});

test('S17a-2 · as três séries não têm uma palavra de sequência, nem número de dias fora do recorde', () => {
  const reSequencia = /\b(dias seguidos|sequência|streak|melhor sequência|Primeira|Primeiro|Depois de)\b/i;
  let estudo = abrir(ESTUDO(), A1, '2026-11-02T09:00');
  estudo = fechar(estudo, A1, '2026-11-02T10:00');
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-02T10:30' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-03T09:00');
  const p = dominar(V(), mapa, L1, { aulas: 93, cartoes: 23, acertos: 12, total: 14, quando: '2026-11-10T10:00' });
  const c = caderneta({ estudo, cartoes: mapa, progresso: p, catalogo: GRADE, indice: TRES() });

  const frases = [
    ...c.percurso.filter((x) => x.data).map((x) => x.frase),
    ...c.dominio.filter((x) => x.frase).map((x) => x.frase),
    ...c.recordes.filter((x) => x.frase).map((x) => x.frase),
    c.proxima.texto,
  ].filter(Boolean);
  assert.ok(frases.length > 3, 'o caso não produziu frase nenhuma: não prova nada');
  for (const frase of frases) {
    assert.equal(reSequencia.test(frase), false, `palavra de sequência na frase: "${frase}"`);
  }
  // O número de dias mora no RECORDE («aguenta 37 dias») e nunca na série de carimbos:
  // as duas séries do percurso e do domínio continuam sob a régua 9.
  for (const x of [...c.percurso.filter((y) => y.data), ...c.dominio.filter((y) => y.data)]) {
    if (x.serie === 'percurso') assert.equal(/\d/.test(x.frase), false, `número na frase do percurso: "${x.frase}"`);
  }
  assert.equal(proibido.includes('número de dias ou de tempo na frase de um carimbo'), true);
  assert.equal(proibido.includes('palavra de sequência na frase de um carimbo'), true);
});

// ─────────────── 17. a próxima, com e sem «que você já dominou» ───────────────

test('S17a-2 · a próxima com o pré-requisito dominado diz que ele foi dominado', () => {
  // A grade REAL. `aplicarResultado` escreve só `dominadas`; quem avança a próxima é a
  // conclusão (o desenho J4: dominar «e a próxima estação que ela abre» é a tela). Então o
  // caminho de verdade é dominar E concluir — e a trava lê a próxima de um progresso inteiro.
  const p = marcar(dominar(V(), MAPA(), L1, { quando: '2026-11-10T10:00' }), L1, '2026-11-10');
  const c = proximaCoisa({ progresso: p, catalogo: CATALOGO });
  // A «próxima» não é chutada aqui: é a MESMA conta de resumoDaViagem, e a trava abaixo é
  // de concordância, não de qual estação a grade resolveu abrir primeiro.
  assert.equal(c.estacao, resumoDaViagem(p, CATALOGO).proximaEstacao.id, 'a próxima divergiu da placa');
  assert.equal(c.estacao, L2, 'dominar e concluir a primeira não abriu a segunda');
  assert.deepEqual(c.pede, ['Circuitos Digitais'], `a cláusula do pré-requisito sumiu: "${c.texto}"`);
  assert.equal(c.texto, 'Próxima estação: Arquitetura de Computadores. Ela pede Circuitos Digitais, que você já dominou.');
  // Na grade REAL também: o nome vem do resumo, nunca de um título escrito aqui.
  const r = resumoDaViagem(p, GRADE).proximaEstacao;
  const real = proximaCoisa({ progresso: p, catalogo: GRADE });
  assert.equal(real.estacao, r.id, 'na grade real a próxima divergiu da placa');
  assert.ok(real.texto.startsWith(`Próxima estação: ${r.titulo}.`), real.texto);

  // Toda estação nomeada como dominada É dominada no arquivo — a cláusula não inventa.
  const dominadasDeVerdade = GRADE.filter((x) => p.dominadas[x.id]).map((x) => x.title);
  for (const nome of real.pede) {
    assert.ok(dominadasDeVerdade.includes(nome), `a frase chamou de dominada «${nome}», que não tem carimbo`);
  }
});

test('S17a-2 · sem pré-requisito dominado, a cláusula não aparece — nem de mentira', () => {
  const semNada = proximaCoisa({ progresso: V(), catalogo: CATALOGO });
  assert.equal(semNada.pede.length, 0);
  assert.equal(semNada.texto, 'Próxima estação: Circuitos Digitais.');

  // Declarada antes NÃO é dominada: a cláusula «que você já dominou» não pode sair dela.
  const p = marcar(V(), L1, '2026-10-05');
  const c = proximaCoisa({ progresso: p, catalogo: CATALOGO });
  assert.deepEqual(c.pede, [], 'a próxima chamou de dominada uma conclusão declarada');
});

test('S17a-2 · a próxima vem da MESMA conta da placa e do perfil', () => {
  const p = marcar(V(), L1, '2026-11-01');
  const c = proximaCoisa({ progresso: p, catalogo: GRADE });
  assert.ok(c.estacao, 'a rede com uma estação concluída não tem próxima');
  assert.equal(NOMES[c.estacao], GRADE.find((x) => x.id === c.estacao).title);
  const vazia = proximaCoisa({ progresso: V(), catalogo: [] });
  assert.equal(vazia.estacao, null, 'sem catálogo a próxima inventou estação');
  assert.equal(vazia.texto, null);
});

// ─────────────── 18. a caderneta inteira, e a pureza das séries novas ───────────────

test('S17a-2 · caderneta devolve as duas séries, os recordes e a próxima', () => {
  const c = caderneta({ catalogo: GRADE, progresso: V() });
  assert.deepEqual(Object.keys(c), ['percurso', 'dominio', 'recordes', 'proxima']);
  assert.equal(c.percurso.length, 8);
  assert.equal(c.dominio.length, 43);
  assert.equal(c.recordes.length, 2);
  assert.equal(c.proxima.serie, 'proxima');
});

test('S17a-2 · as séries novas não mutam nada e não dependem de `hoje`', () => {
  let estudo = fechar(ESTUDO(), A1, '2026-11-01T10:00');
  let mapa = escreverCartao(MAPA(), 'c1', { quando: '2026-11-01T10:30' });
  mapa = responder(mapa, 'c1', 'lembrei', '2026-11-02T09:00');
  const p = dominar(V(), mapa, L1, { quando: '2026-11-10T10:00' });
  const dados = { estudo, cartoes: mapa, progresso: p, catalogo: GRADE, indice: TRES() };
  const antes = JSON.stringify({ estudo, mapa, p });
  const uma = caderneta(dados);
  assert.equal(JSON.stringify({ estudo, mapa, p }), antes, 'a caderneta escreveu nos baldes de outra função');
  assert.deepEqual(caderneta({ ...dados, hoje: '2027-06-01' }), uma, 'o tempo rebaixa ou muda um carimbo');
});

// ─────────────── 19. A PROVA — o carimbo de domínio na concluída antes ───────────────
// Em core/caderneta.js, faça o ramo `else if (estagio === 'concluida-antes')` entregar
// `data: marcaEm` e `frase: C.dominio.fraseEstacao` (ou caia no ramo das vazias com
// `frase: 'Ainda não dominada.'` trocado por uma frase de mérito) → a trava de cima cai,
// na asserção `data === null` / `frase === null`. É o defeito exato: a conclusão
// declarada voltar a ganhar carimbo medido pela porta da série nova, e o bilhete que o
// princípio 4 aposentou reentrar no Perfil.

test('PROVA S17a-2 · a concluída antes não recebe carimbo de domínio', () => {
  const p = marcar(V(), L1, '2026-10-05');
  const s = serieDominio({ catalogo: CATALOGO, progresso: p });
  const c = carimboDe(s, `dominio:${L1}`);
  const estagio = p.completed.includes(L1) && !p.dominadas[L1];
  assert.ok(estagio, 'o caso não montou uma declaração sem medida');
  assert.equal(c.data, null, 'a declaração virou domínio na série nova');
  assert.equal(c.frase, null, 'a declaração ganhou frase de mérito');
  assert.equal(c.marca, 'Concluída antes');
  assert.equal(c.marcaEm, '2026-10-05', 'a data antiga se perdeu junto com a marca');
  assert.notEqual(c.marcaEm, c.data, 'marcaEm e data no mesmo campo é a declaração medida');
});
