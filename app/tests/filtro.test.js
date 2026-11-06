// Testes puros do filtro da Explorar (S7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDaLista, linhasDoCatalogo, ordenarEstacoes } from '../core/filtro.js';

// Um catálogo pequeno, com acento e romano — a forma exata do problema da casa:
// teclado sem acento achando nome acentuado, e ordem que humano lê.
const courses = [
  { id: 'c3', title: 'Cálculo II', stage: 2 },
  { id: 'c1', title: 'Cálculo I', stage: 2 },
  { id: 'c2', title: 'Algoritmos I', stage: 1 },
  { id: 'c4', title: 'Banco de Dados', stage: 3 },
  { id: 'c5', title: 'Sistemas Distribuídos', stage: null },
];
const electives = [{ id: 'e1', title: 'Introdução à IA' }];
const specializations = [{ id: 's1', title: 'Computação Gráfica' }];

test('explorar: filtrarEstacoes ignora acento e caixa', () => {
  const r = estadoDaLista({ courses, electives, specializations, busca: 'calculo', linha: null });
  assert.deepEqual(r.estacoes.map((c) => c.id), ['c1', 'c3'],
    '"calculo" tem que achar Cálculo I e Cálculo II, nesta ordem');
  const r2 = estadoDaLista({ courses, electives, specializations, busca: 'CÁLCULO', linha: null });
  assert.equal(r2.estacoes.length, 2, 'caixa nunca importa');
});

test('explorar: com linha, só as daquela linha', () => {
  const r = estadoDaLista({ courses, electives, specializations, busca: '', linha: 2 });
  assert.deepEqual(r.estacoes.map((c) => c.id), ['c1', 'c3']);
  const r2 = estadoDaLista({ courses, electives, specializations, busca: 'calculo', linha: 1 });
  assert.equal(r2.estacoes.length, 0, 'busca + linha corta as duas formas');
});

test('explorar: linha fora do catálogo é ignorada, não esvazia a tela', () => {
  for (const ruim of [0, 8, 'duas', null, undefined]) {
    const r = estadoDaLista({ courses, electives, specializations, busca: '', linha: ruim });
    assert.equal(r.estacoes.length, courses.length, `linha ${JSON.stringify(ruim)} sumiu com a rede`);
  }
});

test('explorar: busca vazia mostra tudo e nunca é "sem resultado"', () => {
  const r = estadoDaLista({ courses, electives, specializations, busca: '', linha: null });
  assert.equal(r.buscaAtiva, false);
  assert.equal(r.semResultado, false);
  assert.equal(r.estacoes.length, 5);
});

test('explorar: busca que nada acha declara semResultado, e eletiva conta', () => {
  const r = estadoDaLista({ courses, electives, specializations, busca: 'zzz', linha: null });
  assert.equal(r.buscaAtiva, true);
  assert.equal(r.semResultado, true);
  assert.equal(r.estacoes.length, 0);
  const e = estadoDaLista({ courses, electives, specializations, busca: 'introducao', linha: null });
  assert.equal(e.semResultado, false, 'achou eletiva: não é "nada encontrado"');
});

test('explorar: a ordem é linha, depois estágio, depois romano', () => {
  const r = estadoDaLista({ courses, electives, specializations, busca: '', linha: null });
  assert.deepEqual(r.estacoes.map((c) => c.id), ['c2', 'c1', 'c3', 'c4', 'c5'],
    'Linha 1 primeiro, Cálculo I antes de II, sem-linha no fim');
});

test('explorar: total é a rede inteira, linhas é derivado do catálogo', () => {
  const r = estadoDaLista({ courses, electives, specializations, busca: 'banco', linha: null });
  assert.equal(r.total, 5, 'o "de 35" da tela é o catálogo todo, não o recorte');
  assert.equal(r.estacoes.length, 1);
  assert.deepEqual(linhasDoCatalogo(courses), [1, 2, 3]);
  assert.equal(r.linhas, 3);
});

test('explorar: ordenarEstacoes não muta a lista que recebeu', () => {
  const antes = courses.map((c) => c.id).join(',');
  ordenarEstacoes(courses);
  assert.equal(courses.map((c) => c.id).join(','), antes);
});
