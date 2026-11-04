// Projeto Atlas — o ESTUDO por aula (S13a, 04/11/2026): o núcleo sem tela.
//
// Por que este arquivo existe antes de qualquer tela: a S13b vai desenhar a
// folha com "Continuar: Aula 13" e a página com a lista. Se essas duas frases
// dependerem de um cálculo que ninguém mediu, o bug aparece na tela — e na tela
// ele é invisível, porque a pessoa só vê uma posição que "parece" errada. Aqui
// o cálculo é cobrado com os dados REAIS de uma estação.
//
// Os dados: app/data/aulas/circuitos-digitais.json, lido do disco. O teste não
// fabrica 93 aulas porque a forma do arquivo É o contrato (S12): se o gerador
// mudar o campo de `duracaoS` para `duracao`, o resumo aqui quebra na hora, e
// é isto que deve quebrar — não a tela, offline, na mão do aluno.
//
// As três decisões de core/estudo.js, uma a uma:
//   · nada muta a entrada — o objeto antes de abrir continua igual depois;
//   · entrada fora da forma (`quando` quebrado, `aula` vazio) não muda nada;
//   · o `abertaEm` da primeira vez não se reescreve na segunda abertura.
//
// Os três motivos de `continuarDe`, na ordem em que a pessoa os encontra: chega
// (comecar), volta no meio (ultima-aberta pela `ultima`) e retoma uma estação
// parada depois de mexer em outra (ultima-aberta pela aberta mais recente, com
// desempate pelo maior n).
//
// `primeira-nao-aberta` existiu na S13a e saiu por decisão do Lucas em
// 04/11/2026: ele devolvia a Aula 1 para quem tinha aberto a 13 e a 14, porque
// a spec dizia "a primeira aula ainda não aberta", literal. Os dois casos abaixo
// que falam das aulas 13 e 14 são a costura dessa saída — um deles é exatamente
// a cena que doía na tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ESTUDO_KEY, lerEstudo, abrirAula, estadoDaAula, continuarDe, resumoDaEstacao, serializarEstudo
} from '../core/estudo.js';
import { lerRota, hrefDe } from '../core/rotas.js';
import { carregarAulas } from '../web/aulas-dados.js';
import { aulas as textosAulas } from '../core/textos.js';
import { duracaoLegivel } from '../core/aulas.js';

const ESTACAO = 'ubl-core-circuitos-digitais';

/** As aulas reais da estação, uma vez só para todos os casos. */
const arquivo = JSON.parse(
  await readFile(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8')
);
const AULAS = arquivo.aulas;

const estudoVazio = () => ({ versao: 1, aulas: {}, ultima: null });
/** Abre a aula de posição `n` da estação real. */
const abrirNa = (e, n, quando = '2026-11-04T10:00') =>
  abrirAula(e, { estacao: ESTACAO, aula: AULAS[n - 1].id, n }, quando);
const abrirFora = (e, quando = '2026-11-04T11:00') =>
  abrirAula(e, { estacao: 'ubl-core-calculo-i', aula: 'aula-de-outra-estacao', n: 1 }, quando);

// ── 1. lerEstudo: nada aqui estoura ────────────────────────────────────────
test('estudo: a chave do localStorage é a combinada, com versão no nome', () => {
  assert.equal(ESTUDO_KEY, 'atlas.estudo.v1');
});

test('estudo: texto corrompido, vazio e de outra versão devolvem o estudo vazio', () => {
  for (const bruto of [
    undefined, null, '', '   ', 42, {}, [],
    '{ não é json', '{"versao":1,"aulas":{',
    '{"versao":2,"aulas":{"a":1}}',
    '{"versao":1}',
    '{"aulas":{}}',
  ]) {
    assert.deepEqual(lerEstudo(bruto), estudoVazio(), `«${String(bruto)}» devia ler como vazio`);
  }
  // O vazio tem a forma inteira: quem recebe não precisa checar campo a campo.
  assert.deepEqual(Object.keys(lerEstudo('x')).sort(), ['aulas', 'ultima', 'versao']);
});

test('estudo: registros fora da forma caem fora, e os bons passam', () => {
  const bruto = JSON.stringify({
    versao: 1,
    aulas: {
      boa: { estacao: ESTACAO, n: 1, abertaEm: '2026-11-04T10:00' },
      semData: { estacao: ESTACAO, n: 2, aberta: true },
      nula: null,
      corda: 'aberta',
    },
  });
  const lido = lerEstudo(bruto);
  assert.deepEqual(Object.keys(lido.aulas), ['boa'], 'só o registro com abertaEm é um registro');
  assert.equal(estadoDaAula(lido, 'semData'), 'nao-iniciada');
  assert.equal(lido.ultima, null, 'ultima ausente é null, não undefined nem {}');
});

test('estudo: ler e voltar ao texto preserva o que a S14 gravar ao lado', () => {
  // O round-trip é o que impede a tela de apagar estudo futuro: se um dia o
  // registro tiver `estudadaEm` e o lerEstudo de hoje não conhecer o campo,
  // serializar depois de ler tem de devolvê-lo.
  const bruto = JSON.stringify({
    versao: 1,
    aulas: { a1: { estacao: ESTACAO, n: 1, abertaEm: '2026-11-04T10:00', estudadaEm: '2026-11-04T11:00' } },
    ultima: { estacao: ESTACAO, aula: 'a1', n: 1, em: '2026-11-04T10:00' },
  });
  const lido = lerEstudo(bruto);
  assert.equal(lido.aulas.a1.estudadaEm, '2026-11-04T11:00');
  assert.deepEqual(JSON.parse(serializarEstudo(lido)), JSON.parse(bruto));
});

// ── 2. abrirAula: as três decisões ─────────────────────────────────────────
test('abrirAula: não muta a entrada (a tela pinta o estado, não o side effect)', () => {
  const origem = estudoVazio();
  const congelado = JSON.stringify(origem);
  const depois = abrirAula(origem, { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-04T10:00');
  assert.equal(JSON.stringify(origem), congelado, 'a entrada foi mutada');
  assert.notEqual(depois, origem);
  assert.notEqual(depois.aulas.a1, origem.aulas.a1);
});

test('abrirAula: o abertaEm da primeira vez não muda quando se abre de novo', () => {
  let e = abrirAula(estudoVazio(), { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-04T10:00');
  assert.equal(e.aulas.a1.abertaEm, '2026-11-04T10:00');
  e = abrirAula(e, { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-06T18:30');
  assert.equal(e.aulas.a1.abertaEm, '2026-11-04T10:00', 'a segunda abertura apagou o começo do estudo');
  // A `ultima` SIM acompanha o toque mais recente: é o ponto de retomada.
  assert.deepEqual(e.ultima, { estacao: ESTACAO, aula: 'a1', n: 1, em: '2026-11-06T18:30' });
});

test('abrirAula: data-hora fora da forma não muda nada', () => {
  for (const quando of ['', null, undefined, '2026-11-04', '2026-11-04T10:00:00', '2026-11-04T10:00Z', 'ontem às dez']) {
    const base = abrirAula(estudoVazio(), { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-04T10:00');
    const antesDoTxt = JSON.stringify(base);
    const depois = abrirAula(base, { estacao: ESTACAO, aula: 'a2', n: 2 }, quando);
    assert.equal(JSON.stringify(depois), antesDoTxt, `«${quando}» mudou o estudo`);
  }
  // Id ou estação vazios: mesmo princípio, um toque que não nomeia nada não registra nada.
  for (const a of [{ estacao: ESTACAO, aula: '', n: 1 }, { estacao: '', aula: 'a1', n: 1 }]) {
    assert.deepEqual(abrirAula(estudoVazio(), a, '2026-11-04T10:00'), estudoVazio());
  }
});

test('abrirAula: a aula passa de não iniciada a aberta', () => {
  const e = abrirAula(estudoVazio(), { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-04T10:00');
  assert.equal(estadoDaAula(e, 'a1'), 'aberta');
  assert.equal(estadoDaAula(e, 'a2'), 'nao-iniciada');
  assert.equal(estadoDaAula(estudoVazio(), 'a1'), 'nao-iniciada', 'aula inexistente não pode estar aberta');
  assert.equal(estadoDaAula(null, 'a1'), 'nao-iniciada');
});

// ── 3. continuarDe: os quatro motivos, com as 93 aulas reais ───────────────
test('continuarDe: estação sem nada aberto manda começar pela primeira', () => {
  const r = continuarDe(estudoVazio(), ESTACAO, AULAS);
  assert.equal(r.motivo, 'comecar');
  assert.deepEqual(r.aula, AULAS[0], 'é a Aula 01 da playlist, na posição da playlist');
});

test('continuarDe: a última aberta desta estação é a retomada', () => {
  let e = abrirNa(estudoVazio(), 13, '2026-11-03T20:41');
  e = abrirNa(e, 14, '2026-11-04T21:05');
  const r = continuarDe(e, ESTACAO, AULAS);
  // Regra 1: a `ultima` é daqui e a aula está na lista.
  assert.equal(r.aula.n, 14);
  assert.equal(r.motivo, 'ultima-aberta');
});

test('continuarDe: abriu a 13 e a 14, mexeu em outra estação, volta na 14 — nunca na 1', () => {
  // A CENA da decisão do Lucas (04/11/2026), e o teste que a prova derruba.
  // Abriu a 13 num dia, a 14 no seguinte, depois foi ver uma aula de outra
  // estação e voltou. Com o motivo que saiu, o cartão dizia "Continuar: Aula 1"
  // — uma aula que ela nunca abriu e já pulou, lendo como se nada tivesse
  // sido estudado. Os abertaEm em DIAS diferentes importam: é a data de
  // abertura que manda aqui, não a posição na playlist.
  let e = abrirNa(estudoVazio(), 13, '2026-11-02T20:41');
  e = abrirNa(e, 14, '2026-11-03T21:05');
  e = abrirFora(e, '2026-11-04T08:00');
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 14);
  assert.equal(r.motivo, 'ultima-aberta');
});

test('continuarDe: a última aberta daqui ganha, mesmo com outra estação tocada antes', () => {
  let e = abrirFora(estudoVazio(), '2026-11-04T08:00');
  e = abrirNa(e, 13, '2026-11-04T09:00');
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 13);
  assert.equal(r.motivo, 'ultima-aberta');
});

test('continuarDe: entre abertas daqui, a mais recente ganha — não a de maior n', () => {
  // Voltar de propósito a uma aula antiga É estudar, e a retomada tem de seguir
  // o último toque. Fabrico os registros em vez de chamar `abrirAula` porque o
  // abertaEm da primeira vez não se reescreve (decisão 3): reabrir a aula 1 não
  // mudaria a data dela, e o que quero medir é a data.
  const e = {
    versao: 1,
    aulas: {
      [AULAS[4].id]: { estacao: ESTACAO, n: 5, abertaEm: '2026-11-06T09:00' },
      [AULAS[8].id]: { estacao: ESTACAO, n: 9, abertaEm: '2026-11-02T09:00' },
    },
    ultima: { estacao: 'ubl-core-calculo-i', aula: 'zz', n: 1, em: '2026-11-07T09:00' },
  };
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 5, 'a aberta em 6/11 ganha da aberta em 2/11, mesmo com n menor');
  assert.equal(r.motivo, 'ultima-aberta');
});

test('continuarDe: empate de abertaEm desempata pelo maior n', () => {
  // Duas aulas abertas no mesmo minuto (a pessoa abriu uma e a seguinte em
  // sequência, ou importou uma viagem): sem desempate a escolha seria a ordem
  // em que a YouTube devolve a playlist, e ela muda quando um vídeo sai dela.
  const e = {
    versao: 1,
    aulas: {
      [AULAS[1].id]: { estacao: ESTACAO, n: 2, abertaEm: '2026-11-04T10:00' },
      [AULAS[2].id]: { estacao: ESTACAO, n: 3, abertaEm: '2026-11-04T10:00' },
      [AULAS[0].id]: { estacao: ESTACAO, n: 1, abertaEm: '2026-11-04T10:00' },
    },
    ultima: { estacao: 'ubl-core-calculo-i', aula: 'zz', n: 1, em: '2026-11-04T11:00' },
  };
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.deepEqual([r.aula.n, r.motivo], [3, 'ultima-aberta']);
});

test('continuarDe: todas abertas e a última de outra estação retoma a última daqui', () => {
  let e = estudoVazio();
  // Abre fora de ordem de propósito: quem decide é a data do toque, não o `n`.
  for (const n of [7, 93, 1]) {
    e = abrirAula(e, { estacao: ESTACAO, aula: AULAS[n - 1].id, n }, `2026-11-0${n % 7 + 1}T09:00`);
  }
  // A 40 é a aberta mais recente daqui, e entra ANTES da varredura: o `abertaEm`
  // da primeira vez não se reescreve (decisão 3), então reabri-la depois de
  // aberta em bloco deixaria a data velha no lugar — e o teste mediria a
  // proteção contra reescrita, não a retomada.
  e = abrirAula(e, { estacao: ESTACAO, aula: AULAS[39].id, n: 40 }, '2026-11-08T09:00');
  for (const a of AULAS) {
    if (a.n !== 40) e = abrirAula(e, { estacao: ESTACAO, aula: a.id, n: a.n }, '2026-11-01T09:00');
  }
  e = abrirAula(e, { estacao: 'ubl-core-calculo-i', aula: 'zz', n: 1 }, '2026-11-09T23:00');
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 40, 'a 40 é a aberta mais recente (8/11); a 93, aberta 3/11, não');
  assert.equal(r.motivo, 'ultima-aberta');
});

test('continuarDe: lista vazia ou ausente devolve null (não uma aula inventada)', () => {
  for (const lista of [[], null, undefined, 'aulas', [{}]]) {
    assert.equal(continuarDe(estudoVazio(), ESTACAO, lista), null);
  }
});

test('continuarDe: uma última que saiu da playlist não é retomada', () => {
  // As aulas são regeradas a cada 30 dias e um vídeo pode sumir da playlist.
  // Retomar por uma aula que a tela não mostra seria um endereço que mente.
  let e = abrirAula(estudoVazio(), { estacao: ESTACAO, aula: 'nao-existe-na-lista', n: 50 }, '2026-11-04T10:00');
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 1);
  assert.equal(r.motivo, 'comecar', 'nenhuma aula DA LISTA foi aberta');
});

// ── 4. resumoDaEstacao: a duração que a folha mostra ───────────────────────
test('resumoDaEstacao: soma o que falta assistir, descontando o que foi aberto', () => {
  assert.deepEqual(resumoDaEstacao(estudoVazio(), ESTACAO, AULAS), {
    total: 93,
    abertas: 0,
    segundosRestantes: arquivo.total.segundos,
  });
  let e = estudoVazio();
  for (const n of [1, 2, 3]) e = abrirAula(e, { estacao: ESTACAO, aula: AULAS[n - 1].id, n }, '2026-11-04T10:00');
  const r = resumoDaEstacao(e, ESTACAO, AULAS);
  assert.deepEqual([r.total, r.abertas], [93, 3]);
  const tres = AULAS.slice(0, 3).reduce((s, a) => s + a.duracaoS, 0);
  assert.equal(r.segundosRestantes, arquivo.total.segundos - tres, 'as três abertas saem do restante');
  // E o texto que a folha escreve com esse número: 90 aulas de Circuitos
  // Digitais dão horas, e a pessoa lê "~X h" e não um nanossegundo cru.
  assert.equal(duracaoLegivel(r.segundosRestantes), textosAulas.progresso(3, 93, duracaoLegivel(r.segundosRestantes)).split('faltam ~')[1]);
});

test('resumoDaEstacao: uma aula de OUTRA estação não conta aqui, e lista vazia dá zeros', () => {
  // O estado é keyed pelo ID DO VÍDEO, não por (estação, vídeo): é o que faz a
  // mesma aula aberta por dois caminhos (a lista da estação e o cartão de
  // retomar) contar uma vez só. A consequência é medida aqui: um vídeo que não
  // está nesta lista não muda o resumo dela, e um vídeo que ESTÁ conta como
  // aberto seja qual for a estação declarada no registro. Os recortes do
  // Python (aulas-recortes.json) dividem a playlist em faixas que não se
  // sobrepõem, então nenhum vídeo pertence a duas estações hoje.
  const deFora = abrirAula(estudoVazio(), { estacao: 'ubl-core-calculo-i', aula: 'id-de-aula-de-calculo', n: 1 }, '2026-11-04T10:00');
  assert.deepEqual(resumoDaEstacao(deFora, ESTACAO, AULAS), {
    total: 93, abertas: 0, segundosRestantes: arquivo.total.segundos,
  });
  assert.deepEqual(resumoDaEstacao(estudoVazio(), ESTACAO, []), { total: 0, abertas: 0, segundosRestantes: 0 });
});

test('resumoDaEstacao e continuarDe contam pelo ESTADO, não pelo campo', () => {
  // A S14 vai pôr 'estudada' na escada. Um registro com estudadaEm sem
  // abertaEm é impensável hoje, mas o critério tem de ser o estado: quando o
  // estado novo chegar, uma aula estudada já conta como aberta e sai do
  // restante sem que ninguém mexa nestas duas funções.
  const comFuturo = lerEstudo(JSON.stringify({
    versao: 1,
    aulas: { a1: { estacao: ESTACAO, n: 1, abertaEm: '2026-11-04T10:00', estudadaEm: '2026-11-04T11:00' } },
  }));
  assert.equal(resumoDaEstacao(comFuturo, ESTACAO, [{ id: 'a1', n: 1, duracaoS: 60 }]).abertas, 1);
  assert.equal(continuarDe(comFuturo, ESTACAO, [{ id: 'a1', n: 1, duracaoS: 60 }]).motivo, 'ultima-aberta');
});

// ── 5. serializar ──────────────────────────────────────────────────────────
test('serializarEstudo: devolve texto, e o texto volta pelo lerEstudo', () => {
  let e = abrirAula(estudoVazio(), { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-04T10:00');
  e = abrirAula(e, { estacao: ESTACAO, aula: 'a2', n: 2 }, '2026-11-04T10:30');
  const txt = serializarEstudo(e);
  assert.equal(typeof txt, 'string');
  assert.deepEqual(lerEstudo(txt), e, 'o round-trip mudou alguma coisa');
  assert.deepEqual(lerEstudo(serializarEstudo(estudoVazio())), estudoVazio());
});

// ── 6. a rota do painel, ida e volta ───────────────────────────────────────
test('rotas: #/estacao/<slug>/aulas é a estação com painel, e o inverso bate', () => {
  const rota = { tela: 'estacao', slug: 'circuitos-digitais', painel: 'aulas' };
  assert.deepEqual(lerRota('#/estacao/circuitos-digitais/aulas'), rota);
  assert.equal(hrefDe(rota), '#/estacao/circuitos-digitais/aulas');
  assert.deepEqual(lerRota(hrefDe(rota)), rota, 'ida e volta perdeu o painel');
});

test('rotas: #/estacao/<slug> continua sem painel (a folha de hoje não mudou)', () => {
  assert.deepEqual(lerRota('#/estacao/circuitos-digitais'), { tela: 'estacao', slug: 'circuitos-digitais' });
  assert.equal(hrefDe({ tela: 'estacao', slug: 'circuitos-digitais' }), '#/estacao/circuitos-digitais');
  // A chave painel não existe quando não há painel: a folha lê `rota.painel` e
  // recebe undefined, não uma string vazia que passaria em `if (painel)`.
  assert.ok(!('painel' in lerRota('#/estacao/circuitos-digitais')));
});

test('rotas: sufixo parecido não é painel', () => {
  // 'aulas' é conferido byte a byte. Um painel que ninguém desenha tem de cair
  // na leitura de hoje (slug com o resto), que já existe no app — não virar
  // uma tela em branco com um painel desconhecido.
  for (const [hash, slug] of [
    ['#/estacao/circuitos-digitais/aula', 'circuitos-digitais/aula'],
    ['#/estacao/circuitos-digitais/AULAS', 'circuitos-digitais/AULAS'],
    ['#/estacao/circuitos-digitais/aulas-extra', 'circuitos-digitais/aulas-extra'],
    ['#/estacao/circuitos-digitais/aulas/', 'circuitos-digitais/aulas/'],
    ['#/estacao/calculo-i/aulas/extra', 'calculo-i/aulas/extra'],
  ]) assert.deepEqual(lerRota(hash), { tela: 'estacao', slug }, `«${hash}» não é o painel 'aulas'`);
  // '#/estacao//aulas' não nomeia estação nenhuma, como '#/estacao/'.
  assert.deepEqual(lerRota('#/estacao//aulas'), { tela: 'jornada', desconhecida: true });
  assert.equal(hrefDe({ tela: 'estacao', slug: '', painel: 'aulas' }), '#/estacao/', 'sem slug não há painel');
});

// ── 7. carregarAulas: nunca lança ──────────────────────────────────────────
test('aulas-dados: 404 e estouro devolvem { ok: false }, os dois', async () => {
  const sumiu = async () => ({ ok: false, status: 404 });
  assert.deepEqual(await carregarAulas('circuitos-digitais', sumiu), { ok: false, erro: 'nao-encontrado' });

  const caiu = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await carregarAulas('circuitos-digitais', caiu), { ok: false, erro: 'sem-rede' });

  // Os dois outros silêncios possíveis: resposta inexistente e corpo que não é
  // lista de aula (o fallback do service worker devolve o index.html com 200).
  assert.deepEqual(await carregarAulas('circuitos-digitais', async () => undefined), { ok: false, erro: 'sem-rede' });
  const html = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('<!DOCTYPE html>'); } });
  assert.deepEqual(await carregarAulas('circuitos-digitais', html), { ok: false, erro: 'formato' });
  const semLista = async () => ({ ok: true, status: 200, json: async () => ({ estacao: ESTACAO }) });
  assert.deepEqual(await carregarAulas('circuitos-digitais', semLista), { ok: false, erro: 'formato' });
});

test('aulas-dados: o caminho é relativo e o slug é o do catálogo', async () => {
  const pedidos = [];
  const eco = async (url) => {
    pedidos.push(url);
    return { ok: true, status: 200, json: async () => arquivo };
  };
  const r = await carregarAulas('circuitos-digitais', eco);
  assert.equal(r.ok, true);
  assert.equal(r.dados.aulas.length, 93);
  assert.deepEqual(pedidos, ['data/aulas/circuitos-digitais.json'], 'caminho absoluto quebraria em subcaminho');

  // Slug que não é slug não vira request: '../catalog' leria fora do app.
  for (const ruim of ['', null, undefined, 'Circuitos', 'circuitos digitais', '../catalog', 'a/b']) {
    assert.deepEqual(await carregarAulas(ruim, eco), { ok: false, erro: 'slug' });
  }
  assert.equal(pedidos.length, 1, 'um slug inválido fez um request');
});

// ── 8. os textos, que a S13b vai usar ─────────────────────────────────────
test('textos: a seção aulas existe e diz as frases do desenho', () => {
  const t = textosAulas;
  assert.equal(typeof t.comecar, 'function');
  assert.equal(t.comecar(1, 'Introdução aos Circuitos Digitais'), 'Começar: Aula 1 — Introdução aos Circuitos Digitais');
  assert.equal(t.continuar(13, 'Análise de Circuitos Combinacionais'), 'Continuar: Aula 13 — Análise de Circuitos Combinacionais');
  assert.equal(t.verTodas(93), 'Ver as 93 aulas');
  assert.equal(t.progresso(3, 93, '30 h'), '3 de 93 aulas abertas · faltam ~30 h');
  assert.deepEqual({ ...t.estados }, { 'nao-iniciada': 'Não iniciada', aberta: 'Aberta' });
  assert.equal(t.assistir, 'Assistir no YouTube');
  assert.equal(
    t.semAulas.parteUm, 'As aulas desta estação não carregaram.');
  assert.equal(t.semAulas.parteDois, 'O arquivo das aulas não está neste aparelho.');
  assert.equal(t.semAulas.parteTres, 'Abra o Atlas com internet uma vez para guardar as aulas.');
});
