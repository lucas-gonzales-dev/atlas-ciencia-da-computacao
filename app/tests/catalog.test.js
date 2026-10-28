// Projeto Atlas — testes do gerador de catalogo (core/catalog.js).
//
// Por que existe: o catalogo que a tela consome NAO e escrito a mao. Ele e
// DERIVADO do seed auditado da UBL (content/ubl-core-seed.json, 35 disciplinas
// da grade obrigatoria). Estes testes travam essa derivacao — se alguem mudar o
// mapeamento de campos, a ordem, ou perder um pre-requisito no caminho, algo
// aqui quebra antes de chegar na tela do aluno.
//
// Regra da casa: core/ nao toca em filesystem. Quem le o seed e o teste (aqui)
// ou a ferramenta de build (tools/build-catalog.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { toCatalog, prereqLabel } from '../core/catalog.js';

// ---------- fixture minimo: 3 disciplinas em 2 estagios, fora de ordem ----------
const SEED_MIN = {
  source: {
    repository: 'https://github.com/Universidade-Livre/ciencia-da-computacao',
    commitSha: 'b995c11'
  },
  subjects: [
    { id: 'a', slug: 'a', title: 'A', stage: 2, prerequisiteIds: ['b'], resourceUrl: 'http://x/a', curriculumStatus: 'active_core' },
    { id: 'b', slug: 'b', title: 'B', stage: 1, prerequisiteIds: [], resourceUrl: 'http://x/b', curriculumStatus: 'active_core' },
    { id: 'c', slug: 'c', title: 'C', stage: 1, prerequisiteIds: ['b'], url: 'http://x/c', curriculumStatus: 'active_core' }
  ]
};

test('ordena por estagio e preserva a ordem da fonte dentro do estagio', () => {
  const { courses } = toCatalog(SEED_MIN);
  assert.deepEqual(courses.map((c) => c.id), ['b', 'c', 'a']);
});

test('mapeia prerequisiteIds -> prerequisites, que e o campo que progress.js le', () => {
  const { courses } = toCatalog(SEED_MIN);
  const a = courses.find((c) => c.id === 'a');
  assert.deepEqual(a.prerequisites, ['b']);
  const b = courses.find((c) => c.id === 'b');
  assert.deepEqual(b.prerequisites, []);
});

test('preserva id, titulo, estagio e a URL do recurso', () => {
  const { courses } = toCatalog(SEED_MIN);
  const a = courses.find((c) => c.id === 'a');
  assert.equal(a.title, 'A');
  assert.equal(a.stage, 2);
  assert.equal(a.resourceUrl, 'http://x/a');
});

test('cai para o campo "url" quando "resourceUrl" nao vem (a fonte tem os dois)', () => {
  const { courses } = toCatalog(SEED_MIN);
  const c = courses.find((c) => c.id === 'c');
  assert.equal(c.resourceUrl, 'http://x/c');
});

test('nao muta o seed de entrada — derivacao e pura', () => {
  const antes = JSON.stringify(SEED_MIN);
  toCatalog(SEED_MIN);
  assert.equal(JSON.stringify(SEED_MIN), antes);
});

test('recusa seed sem subjects em vez de devolver catalogo vazio em silencio', () => {
  assert.throws(() => toCatalog({ source: {} }), /subjects/);
  assert.throws(() => toCatalog(null), TypeError);
});

test('descarta registro sem id e conta quantos descartou', () => {
  const sujo = { source: {}, subjects: [{ title: 'sem id' }, { id: 'ok', title: 'OK', stage: 1, prerequisiteIds: [] }] };
  const { courses, descartados, total } = toCatalog(sujo);
  assert.equal(courses.length, 1);
  assert.equal(descartados, 1);
  assert.equal(total, 2);
});

test('origem diz de onde veio E avisa quando o commit nao esta fixado', () => {
  const fixado = toCatalog(SEED_MIN);
  // SHA curto e a palavra "auditada": a frase e para leitor, nao para diff.
  assert.match(fixado.origem, /b995c11/);
  assert.match(fixado.origem, /auditada neste commit/);
  // Grade auditada NAO pode dizer que esta solta — era a mentira que o topo
  // contava em 27/10: o CREDITS dizia b995c11 e a tela dizia "NAO FIXADO".
  assert.doesNotMatch(fixado.origem, /n[aã]o fixado/i);

  const solto = toCatalog({ source: { repository: 'r', commitSha: null }, subjects: SEED_MIN.subjects });
  assert.match(solto.origem, /não fixado/);
  assert.doesNotMatch(solto.origem, /auditada/);
});

test('origem usa o nome que a fonte da a si mesma', () => {
  const { origem } = toCatalog(SEED_MIN);
  assert.match(origem, /Universidade Brasileira Livre/);
  assert.doesNotMatch(origem, /Universidade Livre Brasileira/);
});

test('prereqLabel mostra o TITULO do pre-requisito, nao o id cru', () => {
  const { courses } = toCatalog(SEED_MIN);
  const a = courses.find((c) => c.id === 'a');
  assert.equal(prereqLabel(courses, a), ' — precisa de: B');
});

test('prereqLabel devolve vazio para quem nao tem pre-requisito', () => {
  const { courses } = toCatalog(SEED_MIN);
  const b = courses.find((c) => c.id === 'b');
  assert.equal(prereqLabel(courses, b), '');
});

test('prereqLabel mantem o id visivel quando o pre-requisito nao existe no catalogo', () => {
  const courses = [{ id: 'x', title: 'X', prerequisites: ['fantasma'] }];
  assert.equal(prereqLabel(courses, courses[0]), ' — precisa de: fantasma');
});

// ---------- contra o seed REAL auditado ----------
// Procura primeiro a copia vendada dentro do app (o app tem de buildar sozinho em
// qualquer maquina); se nao houver, usa o clone do planning-kit nesta maquina.
const RAIZ_APP = fileURLToPath(new URL('..', import.meta.url));
const CANDIDATOS = [
  join(RAIZ_APP, 'data', 'ubl-core-seed.json'),
  'C:/Users/Pichau/Desktop/atlas-planning-kit/content/ubl-core-seed.json'
];
const SEED_REAL = CANDIDATOS.find((p) => existsSync(p));

test('seed real: deriva as 35 disciplinas da grade obrigatoria da UBL', (t) => {
  if (!SEED_REAL) return t.skip('seed real nao encontrado nesta maquina');
  const seed = JSON.parse(readFileSync(SEED_REAL, 'utf8'));
  const { courses, descartados } = toCatalog(seed);

  assert.equal(courses.length, 35, 'a grade obrigatoria tem 35 disciplinas');
  assert.equal(descartados, 0, 'nenhum registro pode ser descartado no caminho');
  assert.deepEqual(courses.map((c) => c.id), [...new Set(courses.map((c) => c.id))], 'ids duplicados');

  for (const c of courses) {
    assert.ok(typeof c.title === 'string' && c.title.length > 0, `sem titulo: ${c.id}`);
    assert.ok(Number.isInteger(c.stage) && c.stage >= 1, `estagio invalido: ${c.id}`);
    assert.ok(Array.isArray(c.prerequisites), `prerequisites nao e lista: ${c.id}`);
  }
});

test('seed real: todo pre-requisito aponta para uma disciplina que existe', (t) => {
  if (!SEED_REAL) return t.skip('seed real nao encontrado nesta maquina');
  const { courses } = toCatalog(JSON.parse(readFileSync(SEED_REAL, 'utf8')));
  const ids = new Set(courses.map((c) => c.id));
  const soltos = courses.flatMap((c) => c.prerequisites.filter((p) => !ids.has(p)).map((p) => `${c.id} -> ${p}`));
  assert.deepEqual(soltos, [], 'pre-requisito apontando para o nada trava o aluno para sempre');
});

test('seed real: a cadeia conhecida da fonte se preserva (Geometria -> Calculo I -> Calculo II -> Calculo III)', (t) => {
  if (!SEED_REAL) return t.skip('seed real nao encontrado nesta maquina');
  const { courses } = toCatalog(JSON.parse(readFileSync(SEED_REAL, 'utf8')));
  const por = (id) => courses.find((c) => c.id === `ubl-core-${id}`);

  assert.deepEqual(por('calculo-i').prerequisites, ['ubl-core-geometria-analitica']);
  assert.deepEqual(por('calculo-ii').prerequisites, ['ubl-core-calculo-i']);
  assert.deepEqual(por('calculo-iii').prerequisites, ['ubl-core-calculo-ii']);
  assert.deepEqual(por('deep-learning').prerequisites, ['ubl-core-inteligencia-artificial']);
});

test('seed real: a anomalia SRC-001 da fonte sobrevive (Python I e II com a MESMA playlist)', (t) => {
  // Decisao 2 do closeout: preservar a fonte literal, nunca "consertar" em silencio.
  // Se um dia alguem normalizar essa URL, este teste tem de gritar.
  if (!SEED_REAL) return t.skip('seed real nao encontrado nesta maquina');
  const { courses } = toCatalog(JSON.parse(readFileSync(SEED_REAL, 'utf8')));
  const p1 = courses.find((c) => c.id === 'ubl-core-introducao-cc-python-i');
  const p2 = courses.find((c) => c.id === 'ubl-core-introducao-cc-python-ii');
  assert.equal(p1.resourceUrl, p2.resourceUrl, 'a fonte repete a playlist; o derivado tem de repetir tambem');
});
