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
  ESTUDO_KEY, ESTADOS_DA_AULA, lerEstudo, abrirAula, estudarAula, estadoDaAula,
  continuarDe, resumoDaEstacao, serializarEstudo
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
// MUTOU na S14a (04/11/2026), e o motivo é o pedido, não o gosto: "segundosRestantes
// passa a somar as aulas NÃO ESTUDADAS". Antes, abrir um vídeo descontava a hora
// inteira do que falta — e a folha ia dizendo "faltam ~30 h" enquanto a pessoa
// abria aulas sem fechar nenhuma, contando como aprendido o que ela só clicou.
// `abertas` continua existindo (é o que a frase da folha diz hoje); o que mudou é
// o que sai do restante. Os dois contadores lado a lado é o estado honesto da
// transição, e a S14b troca a frase por `estudadas`.
test('resumoDaEstacao: abrir não desconta nada; fechar desconta', () => {
  assert.deepEqual(resumoDaEstacao(estudoVazio(), ESTACAO, AULAS), {
    total: 93, abertas: 0, estudadas: 0, puladas: 0, segundosRestantes: arquivo.total.segundos,
  });
  let e = estudoVazio();
  for (const n of [1, 2, 3]) e = abrirAula(e, { estacao: ESTACAO, aula: AULAS[n - 1].id, n }, '2026-11-04T10:00');
  const abertas = resumoDaEstacao(e, ESTACAO, AULAS);
  assert.deepEqual([abertas.total, abertas.abertas, abertas.estudadas], [93, 3, 0]);
  assert.equal(abertas.segundosRestantes, arquivo.total.segundos, 'três abertas, nada fechado: não falta nada?');

  // E o fechamento, que é o que conta: as mesmas três aulas, agora estudadas.
  let s = estudoVazio();
  for (const n of [1, 2, 3]) s = estudarAula(s, { estacao: ESTACAO, aula: AULAS[n - 1].id, n }, '2026-11-04T10:30', { recordacao: 'lembrei', conferencia: 'faltou X' });
  const r = resumoDaEstacao(s, ESTACAO, AULAS);
  const tres = AULAS.slice(0, 3).reduce((t, a) => t + a.duracaoS, 0);
  assert.deepEqual([r.total, r.abertas, r.estudadas], [93, 3, 3]);
  assert.equal(r.segundosRestantes, arquivo.total.segundos - tres, 'as três FECHADAS saem do restante');
  // A frase medida, com o número que a folha escreve hoje: 90 aulas de Circuitos
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
    total: 93, abertas: 0, estudadas: 0, puladas: 0, segundosRestantes: arquivo.total.segundos,
  });
  assert.deepEqual(resumoDaEstacao(estudoVazio(), ESTACAO, []), { total: 0, abertas: 0, estudadas: 0, puladas: 0, segundosRestantes: 0 });
});

test('resumoDaEstacao e continuarDe contam pelo ESTADO, não pelo campo', () => {
  // A S14a PÔS 'estudada' na escada, e este caso é o que ela previu: nada aqui
  // foi mexido para conhecer o campo novo. Uma aula estudada (i) continua contada
  // como aberta, (ii) sai do restante e (iii) deixa de ser a retomada — a estação
  // de uma aula só, toda estudada, devolve o motivo 'estacao-percorrida'.
  const comFuturo = lerEstudo(JSON.stringify({
    versao: 1,
    aulas: { a1: { estacao: ESTACAO, n: 1, abertaEm: '2026-11-04T10:00', estudadaEm: '2026-11-04T11:00' } },
  }));
  const r = resumoDaEstacao(comFuturo, ESTACAO, [{ id: 'a1', n: 1, duracaoS: 60 }]);
  assert.deepEqual([r.abertas, r.estudadas, r.segundosRestantes], [1, 1, 0]);
  assert.equal(continuarDe(comFuturo, ESTACAO, [{ id: 'a1', n: 1, duracaoS: 60 }]).motivo, 'estacao-percorrida');
});

test('lerEstudo: um registro só com estudadaEm não é jogado fora', () => {
  // A regra de entrada era "sem abertaEm não há registro". Com 'estudada' na
  // escada isso passou a apagar ESTUDO: uma migração (ou o importar da S18) pode
  // trazer o fecho sem a abertura, e perder o que a pessoa aprendeu em silêncio é
  // o pior defeito que este módulo tem.
  const bruto = JSON.stringify({ versao: 1, aulas: { a1: { estacao: ESTACAO, n: 1, estudadaEm: '2026-11-04T11:00' } } });
  const lido = lerEstudo(bruto);
  assert.deepEqual(Object.keys(lido.aulas), ['a1']);
  assert.equal(estadoDaAula(lido, 'a1'), 'estudada');
  // O bruto não traz `ultima` (quem estuda sem tocar o app não tem última aula);
  // lerEstudo normaliza para null, e é assim que volta a sair. Comparo com o
  // objeto que o formato significa, não com o texto que eu escrevi.
  assert.deepEqual(JSON.parse(serializarEstudo(lido)), { ...JSON.parse(bruto), ultima: null }, 'o round-trip perdeu o fecho');
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
  // S14b2/item 8 (04/11/2026): a frase trocou o verbo. "abertas" contava como
  // progresso o clique de quem só foi ler um título; o gesto que o Atlas cobra é
  // fechar com recordação e cartão, e a linha diz isso agora. A frase chumbada
  // está aqui de propósito: as telas puxam `A.progresso` (regra 9), então nenhuma
  // delas cairia sozinha se a palavra mudasse de novo em silêncio.
  assert.equal(t.progresso(3, 93, '30 h'), '3 de 93 aulas estudadas · faltam ~30 h');
  assert.ok(!t.progresso(3, 93, '30 h').includes('abertas'), 'a linha voltou a contar abertura');
  // S14a: 'estudada' entrou, e a lista da tela lê o nome daqui. Se o estado sair
  // do núcleo sem sair daqui, a linha desenha um estado sem nome para o leitor.
  // S18a: 'pulada' entrou na escada e o nome entrou junto, pela mesma razão de
  // 'estudada': a linha lê o nome daqui, e um estado sem nome é o leitor de tela
  // dizendo "aberta" sobre uma aula que a pessoa declarou que já sabe.
  assert.deepEqual({ ...t.estados }, { 'nao-iniciada': 'Não iniciada', aberta: 'Aberta', estudada: 'Estudada', pulada: 'Pulada' });
  assert.deepEqual(ESTADOS_DA_AULA, ['nao-iniciada', 'aberta', 'estudada', 'pulada'], 'a escada do núcleo e os nomes da tela têm de ter as mesmas quatro palavras');
  assert.equal(t.assistir, 'Assistir no YouTube');
  assert.equal(
    t.semAulas.parteUm, 'As aulas desta estação não carregaram.');
  assert.equal(t.semAulas.parteDois, 'O arquivo das aulas não está neste aparelho.');
  assert.equal(t.semAulas.parteTres, 'Abra o Atlas com internet uma vez para guardar as aulas.');
});

// ── 9. estudarAula: o fecho da J2 (S14a) ───────────────────────────────────
const estudarNa = (e, n, quando = '2026-11-04T10:30', textos = { recordacao: 'lembrei', conferencia: 'faltou' }) =>
  estudarAula(e, { estacao: ESTACAO, aula: AULAS[n - 1].id, n }, quando, textos);

test('estudarAula: não muta a entrada', () => {
  const origem = abrirNa(estudoVazio(), 3);
  const congelado = JSON.stringify(origem);
  const depois = estudarNa(origem, 3);
  assert.equal(JSON.stringify(origem), congelado, 'a entrada foi mutada');
  assert.notEqual(depois, origem);
  assert.notEqual(depois.aulas[origem.ultima.aula], origem.aulas[origem.ultima.aula]);
});

test('estudarAula: o estudadaEm da primeira vez não muda quando se fecha de novo', () => {
  // A PROVA do pedido: sobrescrever o estudadaEm derruba este caso. Reabrir o
  // fecho de uma aula já estudada (a pessoa voltou ao vídeo e fechou outra vez)
  // não pode apagar QUANDO ela aprendeu — é a data que a S15 usa para calcular a
  // primeira revisão, e reescrevê-la empurraria o cartão para o futuro.
  let e = estudarNa(estudoVazio(), 5, '2026-11-04T10:30');
  assert.equal(e.aulas[AULAS[4].id].estudadaEm, '2026-11-04T10:30');
  e = estudarNa(e, 5, '2026-11-09T19:00');
  assert.equal(e.aulas[AULAS[4].id].estudadaEm, '2026-11-04T10:30', 'o segundo fecho apagou quando a aula foi aprendida');
  // A `ultima` acompanha o gesto mais recente (é o cartão de retomada, não o registro).
  assert.equal(e.ultima.em, '2026-11-09T19:00');
});

test('estudarAula: fechar sem abrir grava a abertura que falta', () => {
  // Um fecho sem abertura é possível (a pessoa abriu o vídeo por fora, num
  // aparelho onde o toque não foi registrado). Sem o abertaEm, a retomada da
  // estação não teria data nenhuma para ordenar esta aula, e ela seria sempre a
  // última da fila. As duas datas nascem juntas, e a de abertura fica atrás.
  const e = estudarNa(estudoVazio(), 2, '2026-11-04T14:05');
  const r = e.aulas[AULAS[1].id];
  assert.equal(r.abertaEm, '2026-11-04T14:05');
  assert.equal(r.estudadaEm, '2026-11-04T14:05');
  assert.equal(estadoDaAula(e, AULAS[1].id), 'estudada');
});

test('estudarAula: a recordação e a conferência entram cortadas em 2.000 caracteres', () => {
  const longo = 'a'.repeat(2400);
  const e = estudarNa(estudoVazio(), 1, '2026-11-04T10:30', { recordacao: `  ${longo}  `, conferencia: '  o que faltou  ' });
  const r = e.aulas[AULAS[0].id];
  assert.equal(r.recordacao.length, 2000, 'o texto passou do teto e foi guardado inteiro');
  assert.equal(r.recordacao, 'a'.repeat(2000));
  assert.equal(r.conferencia, 'o que faltou', 'as pontas entraram no registro');
});

test('estudarAula: sem textos não cria chave vazia, e data fora da forma não muda nada', () => {
  const sem = estudarNa(estudoVazio(), 1, '2026-11-04T10:30', {});
  assert.deepEqual(Object.keys(sem.aulas[AULAS[0].id]).sort(), ['abertaEm', 'estacao', 'estudadaEm', 'n']);
  const vazioTexto = estudarNa(estudoVazio(), 1, '2026-11-04T10:30', { recordacao: '   ', conferencia: undefined });
  assert.ok(!('recordacao' in vazioTexto.aulas[AULAS[0].id]), 'um form vazio reescreve a recordação de antes');

  for (const quando of ['', null, undefined, '2026-11-04', '2026-11-04T10:30:00', '2026-11-04T10:30Z']) {
    const base = abrirAula(estudoVazio(), { estacao: ESTACAO, aula: 'a1', n: 1 }, '2026-11-04T10:00');
    const antes = JSON.stringify(base);
    assert.equal(JSON.stringify(estudarAula(base, { estacao: ESTACAO, aula: 'a2', n: 2 }, quando, {})), antes, `«${quando}» mudou o estudo`);
  }
  for (const a of [{ estacao: ESTACAO, aula: '', n: 1 }, { estacao: '', aula: 'a1', n: 1 }]) {
    assert.deepEqual(estudarAula(estudoVazio(), a, '2026-11-04T10:30', {}), estudoVazio());
  }
});

test('estudarAula: o round-trip guarda o que a pessoa escreveu', () => {
  const e = estudarNa(estudoVazio(), 7, '2026-11-04T22:15', { recordacao: 'tabela-verdade do XOR', conferencia: 'esqueci o NAND' });
  const txt = serializarEstudo(e);
  assert.deepEqual(lerEstudo(txt), e, 'ler o que foi serializado perdeu o fecho');
  assert.match(txt, /XOR/);
});

// ── 10. continuarDe com a S14a: uma aula estudada nunca é a retomada ───────
test('continuarDe S14a: fechar a aula tira o cartão de cima dela e o manda para a frente', () => {
  // O que a S14a veio consertar: fechar a Aula 14 e voltar à estação devolvia
  // "Continuar: Aula 14" — a pessoa tocaria numa aula que já fechou, e o cartão
  // de retomada perdia o valor no momento em que mais serve.
  let e = estudoVazio();
  for (const n of [1, 2, 3, 4, 5]) e = estudarNa(e, n, `2026-11-0${n}T10:00`);
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 6, 'a frente de quem fechou até a 5 é a 6');
  assert.equal(r.motivo, 'ultima-aberta');
});

test('continuarDe S14a: a aberta ainda não estudada ganha da estudada mais recente', () => {
  // Regra 2a. A 7 foi aberta e estudada anteontem; a 3 foi aberta e nunca fechada.
  // A retomada é a 3 — é a que ficou pelo caminho, e não a que já virou cartão.
  const e = {
    versao: 1,
    aulas: {
      [AULAS[2].id]: { estacao: ESTACAO, n: 3, abertaEm: '2026-11-02T09:00' },
      [AULAS[6].id]: { estacao: ESTACAO, n: 7, abertaEm: '2026-11-06T09:00', estudadaEm: '2026-11-06T10:00' },
    },
    ultima: { estacao: ESTACAO, aula: AULAS[6].id, n: 7, em: '2026-11-06T10:00' },
  };
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.deepEqual([r.aula.n, r.motivo], [3, 'ultima-aberta'], 'a `ultima` estudada tinha de cair na regra 2');
});

test('continuarDe S14a: a aberta não estudada mais recente, não a de maior n', () => {
  const e = {
    versao: 1,
    aulas: {
      [AULAS[3].id]: { estacao: ESTACAO, n: 4, abertaEm: '2026-11-05T09:00' },
      [AULAS[7].id]: { estacao: ESTACAO, n: 8, abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' },
    },
    ultima: { estacao: 'ubl-core-calculo-i', aula: 'zz', n: 1, em: '2026-11-07T09:00' },
  };
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.deepEqual([r.aula.n, r.motivo], [4, 'ultima-aberta']);
});

test('continuarDe S14a: tudo fechado menos a frente, e a estação inteira estudada', () => {
  let e = estudoVazio();
  for (let n = 1; n <= 93; n += 1) e = estudarNa(e, n, `2026-11-01T${String(9 + (n % 12)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`);
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.equal(r.aula.n, 93, 'não há frente: a retomada é a última');
  assert.equal(r.motivo, 'estacao-percorrida');
  const resumo = resumoDaEstacao(e, ESTACAO, AULAS);
  assert.deepEqual([resumo.abertas, resumo.estudadas, resumo.segundosRestantes], [93, 93, 0]);
});

test('continuarDe S14a: o motivo novo não declara a estação completa — só a fronteira', () => {
  // 'estacao-percorrida' descreve o que o CARTÃO diz (não sobra nada À FRENTE de
  // quem fechou), não o estado do mapa: quem pulou a aula 1 e fechou 2 e 3 chega
  // ao fim da lista com a estação incompleta, e o motivo é 'ultima-aberta' — a
  // buraco ficou ATRÁS, e nenhum motivo avisa disso. Quem desenha o desafio da
  // J4 lê `resumoDaEstacao().estudadas === total`, nunca este motivo.
  //
  // (A primeira versão deste caso esperava 'estacao-percorrida' com a aula 1
  // ABERTA e não estudada. O código respondeu a própria aula 1 com
  // 'ultima-aberta', e ele tem razão: regra 2a — a aberta que ainda não foi
  // fechada é a retomada. A cova atrás só aparece no cenário abaixo, onde a 1
  // nunca foi aberta.)
  const tres = AULAS.slice(0, 3).map((a, i) => ({ ...a, n: i + 1 }));
  let e = estudarAula(estudoVazio(), { estacao: ESTACAO, aula: tres[1].id, n: 2 }, '2026-11-02T09:00', {});
  e = estudarAula(e, { estacao: ESTACAO, aula: tres[2].id, n: 3 }, '2026-11-03T09:00', {});
  const r = continuarDe(e, ESTACAO, tres);
  assert.deepEqual([r.aula.n, r.motivo], [3, 'ultima-aberta'], 'a frente acabou na última, mas a 1 está por fechar');
  const resumo = resumoDaEstacao(e, ESTACAO, tres);
  assert.deepEqual([resumo.estudadas, resumo.total], [2, 3], 'é aqui, e só aqui, que se vê a estação incompleta');

  // E o motivo novo só aparece quando não sobra ninguém, nem atrás:
  let todas = estudoVazio();
  for (let n = 1; n <= 3; n += 1) todas = estudarAula(todas, { estacao: ESTACAO, aula: tres[n - 1].id, n }, `2026-11-0${n + 1}T09:00`, {});
  assert.deepEqual([continuarDe(todas, ESTACAO, tres).aula.n, continuarDe(todas, ESTACAO, tres).motivo], [3, 'estacao-percorrida']);
  const cheio = resumoDaEstacao(todas, ESTACAO, tres);
  assert.deepEqual([cheio.abertas, cheio.estudadas, cheio.total, cheio.segundosRestantes], [3, 3, 3, 0]);
});

test('continuarDe S14a: abriu a 13, fechou a 14, e a retomada volta na 13 aberta', () => {
  // A letra da regra 2a levada a sério: "a aberta mais recente que ainda não foi
  // estudada". A 13 foi aberta e não fechada; a 14, aberta e fechada. A retomada
  // é a 13 — a que ficou pelo caminho — e não a frente vazia. Registro o caso
  // porque ele é contra-intuitivo e é o que a spec manda.
  let e = abrirNa(estudoVazio(), 13, '2026-11-02T20:41');
  e = estudarNa(e, 14, '2026-11-03T21:05');
  const r = continuarDe(e, ESTACAO, AULAS);
  assert.deepEqual([r.aula.n, r.motivo], [13, 'ultima-aberta']);
});

// ── 11. a rota da aula, ida e volta (S14a) ─────────────────────────────────
test('rotas: #/estacao/<slug>/aula/<n> é a aula com painel, e o inverso bate', () => {
  const rota = { tela: 'estacao', slug: 'circuitos-digitais', painel: 'aula', n: 3 };
  assert.deepEqual(lerRota('#/estacao/circuitos-digitais/aula/3'), rota);
  assert.equal(hrefDe(rota), '#/estacao/circuitos-digitais/aula/3');
  assert.deepEqual(lerRota(hrefDe(rota)), rota, 'ida e volta perdeu a aula');
  assert.deepEqual(lerRota('#/estacao/circuitos-digitais/aula/93'), { ...rota, n: 93 }, 'n de dois dígitos é lido inteiro');
});

test('rotas: n inválido cai no painel das aulas, não na folha', () => {
  // 'aula/0', 'aula/-1', 'aula/2.5' não são a aula de ninguém. O destino é a
  // lista, que existe e é um lugar honesto para um endereço meia-palavra — a
  // folha é OUTRA tela, e um link quebrado que muda de tela engana mais que um
  // link quebrado que mostra a lista.
  const lista = { tela: 'estacao', slug: 'circuitos-digitais', painel: 'aulas' };
  for (const sufixo of ['0', '-1', '2.5', 'oito', '', ' 3', '3 ', '03x', '1e3', 'null']) {
    assert.deepEqual(lerRota(`#/estacao/circuitos-digitais/aula/${sufixo}`), lista, `«aula/${sufixo}» não caiu na lista`);
  }
});

test('rotas: hrefDe não escreve endereço que ele mesmo não lê', () => {
  for (const n of [undefined, null, 0, -2, 2.5, 'três', NaN]) {
    assert.equal(hrefDe({ tela: 'estacao', slug: 'circuitos-digitais', painel: 'aula', n }), '#/estacao/circuitos-digitais',
      `n=«${n}» virou endereço quebrado`);
  }
  assert.deepEqual(lerRota('#/estacao//aula/3'), { tela: 'jornada', desconhecida: true }, 'sem slug não há aula');
});

// ── 14. continuarDe com a estação CONCLUÍDA (S20a-3, item 2 do pedido) ──────
// A regra do núcleo, cobrada no núcleo. O defeito que ela fecha foi achado no
// Chrome pelo fluxo do app: a pessoa entra por «Já estudei algumas disciplinas»
// → «Marcar», conclui Circuitos Digitais sem nunca abrir aula, recarrega, e a
// tela oferecia «Começar pela primeira aula · Circuitos Digitais · Aula 1» — a
// estação que a própria tela acabava de marcar como CONCLUÍDA. A causa estava
// aqui: `if (!abertas.length) return { aula: lista[0], motivo: 'comecar' }`
// devolvia a Aula 1 de uma estação que não tem mais o que fazer, porque a regra
// 2b, feita para exatamente isso, só alcança estação com alguma aula aberta.
//
// Por que a regra mora no núcleo e não na tela: `continuarDe` tem 25 chamadas no
// app. A regra na tela valeria para uma delas.
const PROXIMA = { id: 'aula-da-proxima', n: 1, duracaoS: 900 };

test('continuarDe concluída: a estação terminada não devolve a Aula 1 dela', () => {
  // O aparelho não tem toque nenhum nesta estação — era exatamente o caso que
  // caía no `lista[0]`. Com `concluida: true` e um `proxima` trazido, a resposta
  // é a primeira aula da PRÓXIMA, nunca uma aula de `AULAS`.
  const r = continuarDe(estudoVazio(), ESTACAO, AULAS,
    { concluida: true, proxima: { aula: PROXIMA, estacao: 'ubl-core-calculo-i' } });
  assert.equal(r.aula.id, PROXIMA.id, 'devolveu uma aula da estação concluída');
  assert.equal(r.aula.n, 1);
  assert.equal(r.estacao, 'ubl-core-calculo-i', 'perdeu a estação para onde aponta');
  assert.equal(r.motivo, 'estacao-concluida');
  assert.equal(AULAS.some((a) => a.id === r.aula.id), false,
    'a aula apontada pertence à estação que terminou');
});

test('continuarDe concluída: sem para onde apontar, a resposta é null, não um endereço inventado', () => {
  // O `null` é a metade honesta da regra: quem chama sabe mais que o núcleo
  // sobre a viagem, e se ele não trouxe a próxima é porque não há. Um fallback
  // para `lista[0]` aqui seria o defeito de volta com outro nome.
  assert.equal(continuarDe(estudoVazio(), ESTACAO, AULAS, { concluida: true }), null,
    'sem `proxima` a estação concluída devolveu uma aula');
  assert.equal(continuarDe(estudoVazio(), ESTACAO, AULAS, { concluida: true, proxima: {} }), null,
    '`proxima` sem aula virou aula');
  assert.equal(continuarDe(estudoVazio(), ESTACAO, AULAS, { concluida: true, proxima: null }), null);
});

test('continuarDe concluída: quem abriu a 3 e depois marcou a estação inteira também não recebe a 3', () => {
  // O `ultima` vivo não salva a estação concluída: a pessoa tem sim uma última
  // aula, mas a estação terminou — «Continuar: Aula 3» ali é a mesma
  // contradição com outro texto. A regra do `concluida` vem antes de qualquer
  // leitura de `ultima`, e é isso que este caso trava.
  const e = abrirNa(estudoVazio(), 3);
  const r = continuarDe(e, ESTACAO, AULAS, { concluida: true, proxima: { aula: PROXIMA, estacao: 'x' } });
  assert.equal(r.aula.id, PROXIMA.id, '`ultima` passou na frente da estação concluída');
  assert.equal(r.motivo, 'estacao-concluida');
});

test('continuarDe concluída: sem `opcoes`, o comportamento é o de sempre (as 25 chamadas antigas)', () => {
  // Não é afrouxamento: é a assinatura antiga preservada, que é o que permite a
  // regra existir sem quebrar a folha, o cartão e os testes da S13a/S14a. Se
  // alguém passar a exigir `opcoes` em todo lado, este caso cai e a quebra é
  // vista como o que é: uma mudança de contrato disfarçada de conserto.
  const r = continuarDe(estudoVazio(), ESTACAO, AULAS);
  assert.equal(r.aula.n, 1);
  assert.equal(r.motivo, 'comecar');
  assert.equal(continuarDe(abrirNa(estudoVazio(), 13), ESTACAO, AULAS).aula.n, 13);
});
