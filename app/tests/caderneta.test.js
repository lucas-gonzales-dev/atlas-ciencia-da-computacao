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
import { seriePercurso, CORTE_CONSOLIDADO, JANELA_CALIBRACAO, DIAS_SEM_NADA, diasDeAtividade } from '../core/caderneta.js';
import { abrirAula, estudarAula, pularAula } from '../core/estudo.js';
import { criarCartao, revisarCartao } from '../core/cartoes.js';
import { proibido } from '../core/textos.js';

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
