// Projeto Atlas — testes de nextUp(), a regra "qual e a proxima materia".
//
// Por que no core e nao na tela: main.js tem a regra escrita no topo — NENHUMA
// regra de negocio na apresentacao. "O que vem depois" depende de pre-requisito,
// entao vive ao lado de unlockedCourses(), que ja tem teste. A tela so desenha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUp } from '../core/progress.js';

const TRILHA = [
  { id: 'logica', title: 'Logica de Programacao', stage: 1, prerequisites: [] },
  { id: 'python-1', title: 'Python I', stage: 2, prerequisites: ['logica'] },
  { id: 'python-2', title: 'Python II', stage: 2, prerequisites: ['python-1'] },
  // Sem pre-requisito: esta sempre aberta, mas so e a "proxima" quando a ordem
  // do catalogo chegar nela. Ordem importa — o proximo passo tem de ser UM.
  { id: 'seminarios', title: 'Seminarios', stage: 8, prerequisites: [] }
];

const CICLO = [
  { id: 'a', title: 'Disciplina A', stage: 1, prerequisites: ['b'] },
  { id: 'b', title: 'Disciplina B', stage: 1, prerequisites: ['a'] }
];

test('comeco do zero: a proxima e a primeira materia sem pre-requisito', () => {
  const r = nextUp(TRILHA, []);
  assert.equal(r.state, 'open');
  assert.equal(r.course.id, 'logica');
});

test('concluiu a primeira: a proxima avanca de verdade', () => {
  assert.equal(nextUp(TRILHA, ['logica']).course.id, 'python-1');
  assert.equal(nextUp(TRILHA, ['logica', 'python-1']).course.id, 'python-2');
});

test('a proxima NUNCA e uma materia ja concluida', () => {
  const r = nextUp(TRILHA, ['logica']);
  assert.notEqual(r.course.id, 'logica');
  assert.equal(r.state, 'open');
});

test('trilha inteira concluida: state done e course nulo (nao inventa proxima)', () => {
  const r = nextUp(TRILHA, TRILHA.map((c) => c.id));
  assert.equal(r.state, 'done');
  assert.equal(r.course, null);
  assert.deepEqual(r.abertas, []);
});

test('so materias em ciclo: state blocked, nao fica mudo nem chuta', () => {
  const r = nextUp(CICLO, []);
  assert.equal(r.state, 'blocked');
  assert.equal(r.course, null);
});

test('catalogo vazio: blocked, e nao done (done seria mentira)', () => {
  const r = nextUp([], []);
  assert.equal(r.state, 'blocked');
  assert.equal(r.course, null);
});

test('conclusao de id que nao existe no catalogo nao conta como progresso', () => {
  // Defende de progresso corrompido no localStorage: 35 ids certos + 1 lixo.
  const r = nextUp(TRILHA, ['materia-que-nao-existe', 'logica']);
  assert.equal(r.course.id, 'python-1');
});

test('abertas vem na ordem do catalogo, nao na ordem em que foram concluidas', () => {
  const r = nextUp(TRILHA, ['logica', 'python-1', 'python-2']);
  assert.deepEqual(r.abertas, ['seminarios']);
  assert.equal(r.course.id, 'seminarios');
});

test('nao muta as entradas (derivacao pura, como toCatalog)', () => {
  const courses = JSON.parse(JSON.stringify(TRILHA));
  const completed = ['logica'];
  nextUp(courses, completed);
  assert.deepEqual(courses, TRILHA);
  assert.deepEqual(completed, ['logica']);
});

test('tolera entrada lixo sem explodir (completed nao-array, course sem id)', () => {
  assert.equal(nextUp(TRILHA, null).state, 'open');
  assert.equal(nextUp(TRILHA, 'logica').state, 'open');
  const semId = [{ title: 'Sem id', stage: 1, prerequisites: [] }];
  assert.equal(nextUp(semId, []).state, 'blocked');
});
