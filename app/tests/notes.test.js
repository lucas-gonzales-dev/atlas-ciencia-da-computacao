// Projeto Atlas — anotacoes por disciplina (incremento de 27/10/2026).
// TDD: escrito ANTES do codigo. Precisa falhar primeiro com MODULE_NOT_FOUND
// (../core/notes.js nao existe ainda) — e nao com erro de sintaxe deste arquivo.
//
// POR QUE ISTO EXISTE: o Atlas sabia o que o aluno concluiu, mas nao o que ele
// PENSOU sobre cada disciplina. "Travei em inducao aqui", "voltar depois",
// "professor X indica este capitulo" — isso morria num caderno separado, e o
// caderno separado e onde anotacao vai para nunca mais ser lida.
//
// TRES REGRAS DE HONESTIDADE que estes testes cobram, as tres herdadas do
// importador de progresso (core/progress-io.js):
//   1. Anotacao de id que NAO existe neste catalogo e ignorada E CONTADA.
//      Aceitar em silencio faria o arquivo crescer com lixo; descartar sem dizer
//      faria o aluno perder anotacao de um catalogo antigo sem nunca saber.
//   2. Arquivo quebrado NUNCA devolve `completed` nem `anotacoes`: quem chama nao
//      tem o que salvar, entao o que ja existe sobrevive por construcao.
//   3. Anotacao e TEXTO PURO. A tela nunca passa por innerHTML: um arquivo
//      importado com `<img onerror=...>` dentro da anotacao tem de aparecer como
//      texto na tela, nao como script. Importar progresso nao pode virar XSS.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITE_NOTA,
  STORAGE_KEY,
  cortarNota,
  setNota,
  filtrarNotas,
  parseNotas,
  serializeNotas
} from '../core/notes.js';
import { VERSAO_FORMATO, FORMATO, buildExport, serializeExport, parseImport } from '../core/progress-io.js';
import { loadNotas, saveNotas, aplicarNota, bindNotas, aplicarImportacao, render } from '../web/main.js';

const CURSOS = [
  { id: 'logica', title: 'Logica de Programacao', stage: 1, prerequisites: [], resourceUrl: 'https://exemplo.invalid/logica' },
  { id: 'python-1', title: 'Python I', stage: 2, prerequisites: ['logica'], resourceUrl: 'https://exemplo.invalid/py1' },
  { id: 'eda', title: 'Estruturas de Dados', stage: 3, prerequisites: ['python-1'], resourceUrl: 'https://exemplo.invalid/eda' }
];
const ELETIVAS = [{ id: 'el-xadrez', title: 'Xadrez', prerequisiteTitles: [], resourceUrl: '' }];
const ESPS = [{ id: 'esp-ia', title: 'Inteligencia Artificial', aguardandoConteudo: false, resources: [], sourceUrl: 'https://exemplo.invalid/ia' }];
const AGORA = new Date('2026-10-27T12:00:00.000Z');

// ---------------------------------------------------------------------------
// DOM DE MENTIRA — o minimo para render() subir no node. Mesmo padrao dos outros
// testes de apresentacao desta casa: no navegador o layout e assunto do
// testar_pagina; aqui o que se cobra e a ESTRUTURA e a ausencia de innerHTML.
// ---------------------------------------------------------------------------
function criarNo(tag) {
  const no = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attrs: {},
    handlers: {},
    _text: '',
    className: '',
    append(...filhos) { for (const f of filhos) this.children.push(f); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener(tipo, fn) { (this.handlers[tipo] ||= []).push(fn); },
    querySelector() { return null; }
  };
  Object.defineProperty(no, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = String(v); this.children.length = 0; } // como o DOM real: texto apaga filhos
  });
  return no;
}

function acharTodos(no, classe, saida = []) {
  if (typeof no.className === 'string' && no.className.split(/\s+/).includes(classe)) saida.push(no);
  for (const f of no.children ?? []) acharTodos(f, classe, saida);
  return saida;
}

function disparar(alvo, tipo, evento = {}) {
  for (const fn of alvo.handlers[tipo] ?? []) fn({ type: tipo, target: alvo, ...evento });
}

function desenhar(estadoExtra = {}) {
  const root = criarNo('div');
  const docAntes = globalThis.document;
  globalThis.document = { createElement: criarNo };
  try {
    render(root, {
      courses: CURSOS,
      completed: [],
      origem: 'fixture',
      electives: ELETIVAS,
      origemEletivas: 'fixture',
      specializations: ESPS,
      origemEspecializacoes: 'fixture',
      busca: '',
      anotacoes: {},
      ...estadoExtra
    });
  } finally {
    if (docAntes === undefined) delete globalThis.document;
    else globalThis.document = docAntes;
  }
  return root;
}

/** LocalStorage de mentira: devolve o anterior quando se grava, para dar round trip. */
function storageFake(inicial = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; }
  };
}

// ---------- core/notes.js: as regras, sem navegador ----------

test('o limite de tamanho e uma decisao escrita, nao um numero escondido', () => {
  // 280: cabe um paragrafo de caderno ("travei em inducao, voltar ao cap. 3"),
  // nao cabe um capitulo. Se um dia mudar, este teste obriga a dizer aqui.
  assert.equal(LIMITE_NOTA, 280);
  assert.equal(typeof STORAGE_KEY, 'string');
  assert.match(STORAGE_KEY, /atlas\./);
});

test('texto vazio (ou so espaco) APAGA a anotacao em vez de guardar ""', () => {
  assert.deepEqual(setNota({ logica: 'algo' }, 'logica', ''), {}, 'vazio apaga');
  assert.deepEqual(setNota({ logica: 'algo' }, 'logica', '   \n\t '), {}, 'so espaco tambem apaga');
  assert.deepEqual(setNota({}, 'logica', ''), {}, 'apagar o que nao existe nao cria chave');
});

test('texto longo e cortado no limite — e o corte vale tambem ao exportar', () => {
  const longo = 'a'.repeat(LIMITE_NOTA + 90);
  const notas = setNota({}, 'logica', longo);
  assert.equal(notas.logica.length, LIMITE_NOTA);
  assert.equal(cortarNota(longo).length, LIMITE_NOTA);
  const pacote = buildExport(CURSOS, [], AGORA, notas);
  assert.equal(pacote.anotacoes.logica.length, LIMITE_NOTA, 'o arquivo nao pode carregar mais do que a tela mostra');
});

test('setNota nao muta o objeto que recebeu (estado do aluno nao muda por baixo)', () => {
  const antes = { logica: 'original' };
  const depois = setNota(antes, 'logica', 'novo');
  assert.deepEqual(antes, { logica: 'original' });
  assert.deepEqual(depois, { logica: 'novo' });
  assert.notEqual(antes, depois);
});

test('o que nao e texto nao vira anotacao: numero, null, objeto, undefined', () => {
  for (const ruim of [42, null, undefined, {}, ['a']]) {
    assert.deepEqual(setNota({ logica: 'x' }, 'logica', ruim), {}, `devia apagar: ${JSON.stringify(ruim)}`);
  }
});

test('id que nao existe no catalogo e ignorado E CONTADO (como no importar)', () => {
  const r = filtrarNotas({ logica: 'ok', fantasma: 'lixo', '': 'sem id' }, CURSOS);
  assert.deepEqual(r.notas, { logica: 'ok' });
  assert.equal(r.ignorados, 1, 'so o id desconhecido conta; chave sem id nao e anotacao de ninguem');
  assert.deepEqual(r.descartados, ['fantasma']);
});

test('storage quebrado nao derruba nada: parseNotas devolve vazio', () => {
  assert.deepEqual(parseNotas('{ quebrado'), {});
  assert.deepEqual(parseNotas('["logica"]'), {}, 'array nao e mapa de anotacoes');
  assert.deepEqual(parseNotas('null'), {});
  assert.deepEqual(parseNotas(42), {});
  assert.deepEqual(parseNotas('{"logica": 7, "eda": "vale"}'), { eda: 'vale' }, 'valor que nao e texto cai fora, o resto fica');
});

test('ida e volta pelo storage sem perda', () => {
  const notas = { logica: 'travei em inducao', eda: 'voltar no cap. 3' };
  assert.deepEqual(parseNotas(serializeNotas(notas)), notas);
});

test('loadNotas/saveNotas usam o storage do aparelho, e sem storage comecam vazias', () => {
  const fake = storageFake();
  globalThis.localStorage = fake;
  try {
    assert.deepEqual(loadNotas(), {});
    assert.equal(saveNotas({ logica: 'oi' }), true);
    assert.deepEqual(loadNotas(), { logica: 'oi' }, 'o que salvou tem de voltar');
    assert.equal(fake.dados[STORAGE_KEY] !== undefined, true, 'grava na chave declarada, nao em uma inventada na hora');
  } finally {
    delete globalThis.localStorage;
  }

  // Storage que explode (modo privado, quota cheia): nao pode matar a tela.
  globalThis.localStorage = { getItem() { throw new Error('negado'); }, setItem() { throw new Error('negado'); } };
  try {
    assert.deepEqual(loadNotas(), {});
    assert.equal(saveNotas({ logica: 'oi' }), false, 'devolve false para a tela avisar que nao salvou');
  } finally {
    delete globalThis.localStorage;
  }
});

// ---------- formato v2: exportar leva, importar aceita v1 ----------

test('a versao do formato subiu para 2 (anotacoes entraram no envelope)', () => {
  assert.equal(VERSAO_FORMATO, 2);
  assert.equal(buildExport(CURSOS, [], AGORA).versao, 2);
});

test('exportar leva as anotacoes na ordem do catalogo e diz o que ficou de fora', () => {
  const pacote = buildExport(CURSOS, ['logica'], AGORA, { eda: 'b', logica: 'a', fantasma: 'c' });
  assert.deepEqual(Object.keys(pacote.anotacoes), ['logica', 'eda'], 'ordem do catalogo: dois exports do mesmo estado sao identicos');
  assert.deepEqual(pacote.anotacoes, { logica: 'a', eda: 'b' });
  assert.equal(pacote.anotacoesIgnoradas, 1);
  assert.deepEqual(pacote.descartadas, ['fantasma'], 'o que ficou de fora vai DENTRO do arquivo');
});

test('arquivo v2 volta pelo importador: ida e volta sem perda de progresso nem de nota', () => {
  const texto = serializeExport(CURSOS, ['logica', 'eda'], AGORA, { logica: 'travei em inducao' });
  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.equal(r.trazAnotacoes, true);
  assert.deepEqual(r.anotacoes, { logica: 'travei em inducao' });
  assert.equal(r.ignorados, 0);
});

test('arquivo da VERSAO 1 importa: progresso intacto, sem anotações e sem erro', () => {
  const v1 = JSON.stringify({ formato: FORMATO, versao: 1, completed: ['logica', 'eda'], ignorados: 0 });
  const r = parseImport(v1, CURSOS);
  assert.equal(r.ok, true, 'quem exportou ontem com o Atlas antigo nao pode ficar sem importar');
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.equal(r.trazAnotacoes, false, 'o arquivo v1 nao fala de anotacoes — e diferente de dizer que nao ha nenhuma');
  assert.deepEqual(r.anotacoes, {});
});

test('array cru do localStorage importa: trazAnotacoes false', () => {
  const r = parseImport('["logica"]', CURSOS);
  assert.equal(r.ok, true);
  assert.equal(r.trazAnotacoes, false);
});

test('versao do futuro continua recusada, dizendo ate onde este Atlas vai', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: 3, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /2/);
});

test('campo anotacoes quebrado no arquivo NAO destrói o progresso, e a tela fica sabendo', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: 2, completed: ['logica'], anotacoes: 'lixo' }), CURSOS);
  assert.equal(r.ok, true, 'recusar o arquivo inteiro por causa de uma anotacao ruim seria punir o progresso');
  assert.deepEqual(r.completed, ['logica']);
  assert.deepEqual(r.anotacoes, {});
  assert.equal(r.trazAnotacoes, false);
  assert.match(r.mensagem, /anota/i, 'dizer em voz alta: as notas do arquivo foram descartadas');
});

test('anotacao de id desconhecido no arquivo e ignorada e contada na mensagem', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: 2, completed: [], anotacoes: { logica: 'a', fantasma: 'b' } }), CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.anotacoes, { logica: 'a' });
  assert.equal(r.anotacoesIgnoradas, 1);
  assert.match(r.mensagem, /1/);
});

// ---------- aplicarImportacao: nao destruir o que ja existe ----------

test('arquivo quebrado preserva progresso E anotacoes do aparelho', () => {
  const state = { completed: ['logica'], courses: CURSOS, anotacoes: { logica: 'minha nota' } };
  const r = aplicarImportacao(state, '{ quebrado');
  assert.equal(r.ok, false);
  assert.deepEqual(r.completed, ['logica']);
  assert.deepEqual(r.anotacoes, { logica: 'minha nota' });
  assert.ok(r.mensagem.length > 10);
});

test('arquivo v1 PRESERVA as anotacoes do aparelho (ele nao fala delas)', () => {
  const state = { completed: [], courses: CURSOS, anotacoes: { logica: 'fica' } };
  const r = aplicarImportacao(state, JSON.stringify({ formato: FORMATO, versao: 1, completed: ['eda'] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.anotacoes, { logica: 'fica' }, 'apagar nota porque o arquivo e antigo e perda de dados do aluno');
  assert.match(r.mensagem, /anota/i, 'e dizer que elas foram mantidas');
});

test('arquivo v2 SUBSTITUI as anotacoes: importar e trocar de estado, nao somar', () => {
  const state = { completed: [], courses: CURSOS, anotacoes: { logica: 'antiga' } };
  const texto = serializeExport(CURSOS, ['logica'], AGORA, { eda: 'nova' });
  const r = aplicarImportacao(state, texto);
  assert.equal(r.ok, true);
  assert.deepEqual(r.anotacoes, { eda: 'nova' });
  assert.deepEqual(state.anotacoes, { logica: 'antiga' }, 'nao muta o estado do chamador');
});

// ---------- a tela: editar na propria disciplina, sempre texto puro ----------

test('cada disciplina, eletiva e especializacao tem o seu campo de anotacao', () => {
  const root = desenhar({ anotacoes: { logica: 'travei em inducao' } });
  const campos = acharTodos(root, 'nota');
  const ids = campos.map((c) => c.getAttribute('data-nota-id')).sort();
  assert.deepEqual(ids, ['eda', 'el-xadrez', 'esp-ia', 'logica', 'python-1']);
  const logica = campos.find((c) => c.getAttribute('data-nota-id') === 'logica');
  assert.equal(logica.value, 'travei em inducao', 'o que ja foi escrito volta no campo');
  assert.equal(logica.getAttribute('maxlength'), String(LIMITE_NOTA), 'o navegador corta junto com o core');
});

test('anotacao com HTML aparece como TEXTO PURO, nunca como elemento', () => {
  const ataque = '<img src=x onerror="alert(1)">';
  const root = desenhar({ anotacoes: { logica: ataque } });
  const campo = acharTodos(root, 'nota').find((c) => c.getAttribute('data-nota-id') === 'logica');
  assert.equal(campo.value, ataque, 'o texto fica inteiro, como o aluno escreveu');
  assert.equal(campo.children.length, 0, 'nada virou elemento: importar arquivo nao pode executar script');
});

test('aplicarNota corta, apaga com vazio e nao muta o estado', () => {
  const state = { anotacoes: { logica: 'antes' }, completed: ['logica'], courses: CURSOS };
  const r = aplicarNota(state, 'logica', 'depois');
  assert.deepEqual(r.anotacoes, { logica: 'depois' });
  assert.deepEqual(state.anotacoes, { logica: 'antes' });
  assert.deepEqual(aplicarNota(state, 'logica', '').anotacoes, {});
  assert.equal(aplicarNota(state, 'logica', 'x'.repeat(LIMITE_NOTA + 5)).anotacoes.logica.length, LIMITE_NOTA);
});

test('mudar o campo na tela chama salvar com o id e o texto daquela disciplina', () => {
  const root = desenhar();
  const salvos = [];
  bindNotas(root, { salvar: (id, texto) => salvos.push([id, texto]) });
  const campo = acharTodos(root, 'nota').find((c) => c.getAttribute('data-nota-id') === 'eda');
  campo.value = 'voltar no cap. 3';
  disparar(root, 'change', { target: campo });
  assert.deepEqual(salvos, [['eda', 'voltar no cap. 3']]);
});
