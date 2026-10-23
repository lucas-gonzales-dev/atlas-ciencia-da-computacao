// Projeto Atlas — build do catalogo que a tela consome.
//
// O que faz, na ordem:
//   1. acha o seed auditado da UBL (copia vendada em app/data/, ou o clone do
//      planning-kit nesta maquina) e VENDA em app/data/ubl-core-seed.json se
//      ainda nao estiver la — assim o app builda sozinho em qualquer maquina,
//      inclusive no clone fresco da passagem de bastao;
//   2. deriva app/data/catalog.json por core/catalog.js (que tem teste);
//   3. confere o que escreveu e conta.
//
// Uso:  node tools/build-catalog.mjs [--check]
//       --check  nao escreve nada; so diz se catalog.json ja esta em dia (exit 1 se nao)
//
// Por que um arquivo GERADO e commitado: a tela abre com fetch de data/catalog.json
// e cai num catalogo minimo se nao houver. Commitar o gerado faz o produto
// funcionar sem passo de build — e o --check no CI garante que ninguem esquece
// de regenerar depois de mexer no seed.

import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { toCatalog } from '../app/core/catalog.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const APP = join(RAIZ, 'app');
const DATA = join(APP, 'data');
const SEED_VENDADO = join(DATA, 'ubl-core-seed.json');
const CATALOGO = join(DATA, 'catalog.json');
const CHECK = process.argv.includes('--check');

// Onde o seed pode estar. A copia vendada vem primeiro de proposito: ela e a que
// foi auditada e commitada. O clone do planning-kit e so o caminho de atualizacao.
const CANDIDATOS = [
  SEED_VENDADO,
  'C:/Users/Pichau/Desktop/atlas-planning-kit/content/ubl-core-seed.json',
  join(RAIZ, 'source', 'atlas-planning-kit', 'content', 'ubl-core-seed.json')
];

async function existe(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function falha(msg) {
  console.error(`FALHOU: ${msg}`);
  process.exit(1);
}

// Laço explícito, e NÃO `CANDIDATOS.find(await existe)`: find recebe uma funcao
// e a chama com (item, indice) — await existe devolve a propria funcao, que e
// truthy, entao o primeiro candidato era escolhido SEM conferir se existia.
// Aconteceu de verdade em 23/10/2026: ENOENT no seed que ainda nao estava vendado.
let seedPath = null;
for (const c of CANDIDATOS) {
  if (await existe(c)) {
    seedPath = c;
    break;
  }
}
if (!seedPath) {
  falha(`seed ubl-core-seed.json nao encontrado em nenhum de:\n  ${CANDIDATOS.join('\n  ')}`);
}

const seedBruto = await readFile(seedPath, 'utf8');
let seed;
try {
  seed = JSON.parse(seedBruto);
} catch (e) {
  falha(`seed nao e JSON valido (${seedPath}): ${e.message}`);
}

const { courses, origem, total, descartados } = toCatalog(seed);
if (courses.length === 0) falha('derivacao devolveu zero disciplinas');

// 1. vendar o seed, se ele veio de fora do app
await mkdir(DATA, { recursive: true });
if (resolve(seedPath) !== resolve(SEED_VENDADO)) {
  if (CHECK) {
    falha(`--check: app/data/ubl-core-seed.json nao existe (o seed achado foi ${seedPath})`);
  }
  await copyFile(seedPath, SEED_VENDADO);
  console.log(`vendado: app/data/ubl-core-seed.json  <- ${seedPath}`);
}

// 2. escrever o catalogo derivado
const corpo = `${JSON.stringify({ geradoPor: 'tools/build-catalog.mjs', geradoDe: 'app/data/ubl-core-seed.json', origem, courses }, null, 2)}\n`;

if (CHECK) {
  const atual = await readFile(CATALOGO, 'utf8').catch(() => null);
  if (atual === null) falha('--check: app/data/catalog.json nao existe; rode node tools/build-catalog.mjs');
  if (atual !== corpo) {
    falha('--check: app/data/catalog.json esta DESATUALIZADO em relacao ao seed; rode node tools/build-catalog.mjs');
  }
  console.log(`OK: catalog.json em dia — ${courses.length} disciplinas (${descartados} descartadas de ${total})`);
  process.exit(0);
}

await writeFile(CATALOGO, corpo, 'utf8');

// 3. conferir relendo o que escreveu (escrever nao e o mesmo que ter escrito)
const deVolta = JSON.parse(await readFile(CATALOGO, 'utf8'));
if (!Array.isArray(deVolta.courses) || deVolta.courses.length !== courses.length) {
  falha('o arquivo escrito nao confere com o que foi derivado');
}
const ids = new Set(deVolta.courses.map((c) => c.id));
if (ids.size !== deVolta.courses.length) falha('catalogo escrito tem ids duplicados');

const estagios = [...new Set(deVolta.courses.map((c) => c.stage))].sort((a, b) => a - b);
console.log(`ESCRITO: app/data/catalog.json`);
console.log(`  disciplinas: ${deVolta.courses.length} (de ${total} no seed, ${descartados} descartadas)`);
console.log(`  estagios: ${estagios.join(', ')}`);
console.log(`  sem pre-requisito (abertas de cara): ${deVolta.courses.filter((c) => c.prerequisites.length === 0).length}`);
console.log(`  sem URL de recurso: ${deVolta.courses.filter((c) => !c.resourceUrl).length}`);
console.log(`  origem: ${origem}`);
