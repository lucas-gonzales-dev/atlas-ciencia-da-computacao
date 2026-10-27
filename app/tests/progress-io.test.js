// Projeto Atlas — levar o progresso junto (exportar/importar).
// TDD: escrito ANTES do codigo. Precisa falhar primeiro.
//
// Por que isto existe: o progresso mora no localStorage de UM navegador. O Lucas
// estuda no celular e no PC; sem exportar/importar, trocar de aparelho e comecar
// do zero — e o README dizia isso como limitacao aceita. Nao e mais.
//
// Regra de honestidade que estes testes cobram: um arquivo QUEBRADO nunca pode
// apagar o progresso que ja existe, e um id que nao pertence a este catalogo e
// ignorado E CONTADO na mensagem — nunca engolido em silencio, nunca aceito
// como se fosse real (isso faria o aluno ver "12/35 concluidas" sem 12 materias).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORMATO,
  VERSAO_FORMATO,
  buildExport,
  serializeExport,
  nomeDoArquivo,
  parseImport
} from '../core/progress-io.js';
import { aplicarImportacao } from '../web/main.js';

const CURSOS = [
  { id: 'logica', title: 'Logica de Programacao' },
  { id: 'python-1', title: 'Python I' },
  { id: 'eda', title: 'Estruturas de Dados' }
];
const IDS = new Set(CURSOS.map((c) => c.id));
const AGORA = new Date('2026-10-27T03:15:00.000Z');

// ---------- exportar ----------

test('exportar declara formato e versao: sem isso, importar e adivinhacao', () => {
  const pacote = buildExport(CURSOS, ['logica'], AGORA);
  assert.equal(pacote.formato, FORMATO);
  assert.equal(pacote.versao, VERSAO_FORMATO);
  assert.equal(typeof pacote.exportadoEm, 'string');
  assert.deepEqual(pacote.completed, ['logica']);
});

test('exportar so leva ids que existem neste catalogo (nao exporta lixo)', () => {
  const pacote = buildExport(CURSOS, ['logica', 'fantasma', 'eda'], AGORA);
  assert.deepEqual(pacote.completed, ['logica', 'eda']);
  assert.equal(pacote.ignorados, 1, 'o que ficou de fora precisa estar dito no proprio arquivo');
});

test('o arquivo exportado volta pelo importador (ida e volta sem perda)', () => {
  const texto = serializeExport(CURSOS, ['logica', 'eda'], AGORA);
  assert.doesNotThrow(() => JSON.parse(texto), 'tem de ser JSON de verdade');
  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.equal(r.ignorados, 0);
});

test('o nome do arquivo diz o que e e de quando e', () => {
  assert.equal(nomeDoArquivo(AGORA), 'atlas-progresso-2026-10-27.json');
});

// ---------- importar: o que e aceito ----------

test('importar aceita o array cru do localStorage (formato antigo, sem envelope)', () => {
  const r = parseImport('["logica","eda"]', CURSOS);
  assert.equal(r.ok, true, 'quem guardou o conteudo do storage a mao nao pode ser punido');
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
});

test('id desconhecido e ignorado E CONTADO na mensagem', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: ['logica', 'curso-que-nao-existe'] }), CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed, ['logica']);
  assert.equal(r.ignorados, 1);
  assert.match(r.mensagem, /1/, 'a mensagem precisa dizer QUANTOS foram ignorados');
  assert.match(r.mensagem, /ignor/i);
});

test('nenhum id conhecido: importa vazio e avisa, em vez de fingir sucesso', () => {
  const r = parseImport('["outro-catalogo"]', CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed, []);
  assert.match(r.mensagem, /0 disciplinas|nenhuma/i);
});

test('duplicatas nao viram duas disciplinas concluidas', () => {
  const r = parseImport('["logica","logica","eda"]', CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
});

// ---------- importar: o que e recusado, com recado claro ----------

test('JSON quebrado: erro claro e NENHUM completed devolvido', () => {
  const r = parseImport('{"formato": "atlas.progresso", ', CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /json/i, 'o aluno precisa saber que o arquivo nao e legivel');
  assert.equal('completed' in r, false, 'sem completed: quem chama nao tem o que salvar por engano');
});

test('arquivo vazio ou so espaco: erro claro, nao JSON.parse de ""', () => {
  for (const vazio of ['', '   ', '\n']) {
    const r = parseImport(vazio, CURSOS);
    assert.equal(r.ok, false);
    assert.match(r.erro, /vazio|sem conteudo/i);
  }
});

test('objeto sem versao do formato e recusado (nao adivinho o que e)', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /vers[aã]o/i);
});

test('versao do futuro: recusa dizendo qual versao este Atlas entende', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO + 1, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, new RegExp(String(VERSAO_FORMATO)), 'a mensagem diz ate onde este Atlas vai');
});

test('formato que nao e do Atlas: recusa dizendo o formato que veio', () => {
  const r = parseImport(JSON.stringify({ formato: 'outra-coisa', versao: 1, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /outra-coisa/, 'dizer o que veio ajuda a descobrir o arquivo errado');
});

test('completed que nao e lista: recusa em vez de quebrar depois', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: 'logica' }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /lista|completed/i);
});

test('texto que nao e string (numero, null, objeto) nao derruba o importador', () => {
  for (const ruim of [null, undefined, 42, {}, []]) {
    const r = parseImport(ruim, CURSOS);
    assert.equal(r.ok, false, `devia recusar: ${JSON.stringify(ruim)}`);
  }
});

// ---------- a regra que importa de verdade: nao destruir o que ja existe ----------

test('arquivo quebrado NAO apaga o progresso que ja existe', () => {
  const antes = ['logica', 'python-1'];
  const r = aplicarImportacao({ completed: antes, courses: CURSOS }, '{ quebrado');
  assert.equal(r.ok, false);
  assert.deepEqual(r.completed, antes, 'o estado devolve o progresso intacto');
  assert.equal(typeof r.mensagem, 'string');
  assert.ok(r.mensagem.length > 10, 'recado vazio e o mesmo que falhar em silencio');
});

test('importacao boa troca o progresso e diz quantas disciplinas entraram', () => {
  const r = aplicarImportacao({ completed: ['logica'], courses: CURSOS }, '["logica","eda"]');
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.match(r.mensagem, /2/);
});

test('aplicarImportacao nao muta o array de progresso que recebeu', () => {
  const antes = ['logica'];
  aplicarImportacao({ completed: antes, courses: CURSOS }, '["eda"]');
  assert.deepEqual(antes, ['logica'], 'mutar o estado do chamador e bug invisivel');
});

test('sanidade da fixture: os ids usados existem mesmo no catalogo de teste', () => {
  for (const id of ['logica', 'python-1', 'eda']) assert.ok(IDS.has(id));
});
