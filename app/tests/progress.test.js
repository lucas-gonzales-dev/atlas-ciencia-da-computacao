// Projeto Atlas — nucleo de progresso.
// TDD: estes testes sao escritos ANTES do codigo. Eles precisam falhar primeiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { unlockedCourses, detectCycles } from '../core/progress.js';

// Fixture minima e deliberadamente pequena: o nucleo recebe dados,
// nao sabe de onde eles vem (seed, arquivo, API). Isso evita acoplar
// o dominio a um caminho de disco.
const CORE = [
  { id: 'logica', title: 'Logica de Programacao', prerequisites: [] },
  { id: 'python-1', title: 'Python I', prerequisites: ['logica'] },
  { id: 'python-2', title: 'Python II', prerequisites: ['python-1'] },
  { id: 'eda', title: 'Estruturas de Dados', prerequisites: ['python-2'] }
];

test('quem nao tem pre-requisito ja nasce desbloqueado', () => {
  const r = unlockedCourses(CORE, []);
  assert.deepEqual(r, ['logica']);
});

test('pre-requisito nao concluido tranca a disciplina', () => {
  const r = unlockedCourses(CORE, []);
  assert.ok(!r.includes('python-1'), 'python-1 nao pode aparecer sem logica concluida');
  assert.ok(!r.includes('eda'));
});

test('concluiu o pre-requisito, a proxima abre', () => {
  const r = unlockedCourses(CORE, ['logica']);
  assert.deepEqual(r, ['python-1']);
});

test('disciplina concluida nao volta como disponivel', () => {
  const r = unlockedCourses(CORE, ['logica', 'python-1']);
  assert.deepEqual(r, ['python-2']);
  assert.ok(!r.includes('logica'), 'o que ja foi feito nao e tarefa de agora');
});

test('cadeia de quatro niveis libera uma por vez, na ordem', () => {
  assert.deepEqual(unlockedCourses(CORE, []), ['logica']);
  assert.deepEqual(unlockedCourses(CORE, ['logica']), ['python-1']);
  assert.deepEqual(unlockedCourses(CORE, ['logica', 'python-1']), ['python-2']);
  assert.deepEqual(unlockedCourses(CORE, ['logica', 'python-1', 'python-2']), ['eda']);
});

test('varias disciplinas no mesmo nivel aparecem juntas', () => {
  const cursos = [
    { id: 'a', title: 'A', prerequisites: [] },
    { id: 'b', title: 'B', prerequisites: [] },
    { id: 'c', title: 'C', prerequisites: ['a', 'b'] }
  ];
  assert.deepEqual(unlockedCourses(cursos, []), ['a', 'b']);
  // b NAO some quando a e concluida: os dois sao do mesmo nivel, sem
  // pre-requisito. Se concluir um irmao trancasse o outro, o aluno nunca
  // poderia cursar duas materias do mesmo periodo — e a primeira assercao
  // deste teste (['a','b'] juntos) ja diz que eles aparecem juntos.
  // A assercao antiga esperava [] e era o BUG, nao o codigo. Corrigida
  // em 23/10/2026 apos falha real na suíte (9 pass / 1 fail).
  assert.deepEqual(unlockedCourses(cursos, ['a']), ['b']);
  assert.deepEqual(unlockedCourses(cursos, ['a', 'b']), ['c']);
});

test('pre-requisito que nao existe no catalogo nao tranca o aluno para sempre', () => {
  // A fonte real tem essa ambiguidade (Coursera x YouTube, especializacoes
  // orfas). Um id desconhecido e dado ruim, nao motivo para o aluno ficar
  // preso: ignora o pre-requisito inexistente.
  const cursos = [{ id: 'x', title: 'X', prerequisites: ['fantasma'] }];
  assert.deepEqual(unlockedCourses(cursos, []), ['x']);
});

test('ciclo de pre-requisitos e detectado em vez de travar em silencio', () => {
  const cursos = [
    { id: 'a', title: 'A', prerequisites: ['b'] },
    { id: 'b', title: 'B', prerequisites: ['a'] }
  ];
  assert.deepEqual(detectCycles(cursos).sort(), ['a', 'b']);
  assert.deepEqual(unlockedCourses(cursos, []), [], 'nada e liberado dentro de um ciclo');
});

test('catalogo sem ciclo devolve lista vazia de ciclos', () => {
  assert.deepEqual(detectCycles(CORE), []);
});

test('ordem do resultado segue a ordem do catalogo, nao a ordem de conclusao', () => {
  const cursos = [
    { id: 'z', title: 'Z', prerequisites: [] },
    { id: 'a', title: 'A', prerequisites: [] }
  ];
  assert.deepEqual(unlockedCourses(cursos, []), ['z', 'a']);
});
