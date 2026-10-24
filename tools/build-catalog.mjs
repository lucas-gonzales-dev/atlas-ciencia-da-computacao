// Projeto Atlas — build do catalogo que a tela consome.
//
// O que faz, na ordem:
//   1. acha os seeds auditados (copias vendadas em app/data/, ou o clone do
//      planning-kit nesta maquina) e VENDA em app/data/ se ainda nao estiverem
//      la — assim o app builda sozinho em qualquer maquina, inclusive no clone
//      fresco da passagem de bastao;
//   2. deriva app/data/catalog.json por core/catalog.js (que tem teste):
//      grade obrigatoria + eletivas arquivadas (em campos SEPARADOS, porque
//      eletiva nao soma a grade nem ao progresso — decisao editorial da fonte);
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
import { toCatalog, toElectives, toSpecializations } from '../app/core/catalog.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const APP = join(RAIZ, 'app');
const DATA = join(APP, 'data');
const SEED_VENDADO = join(DATA, 'ubl-core-seed.json');
const SEED_ELETIVAS_VENDADO = join(DATA, 'commented-electives-seed.json');
// Especializacoes moram em TRES arquivos na fonte, e os tres sao necessarios:
// o indice (7 anunciadas), os recursos transcritos (75 linhas) e o overlay das
// que existem na arvore mas NAO estao no indice (2). Derivar de menos faria o
// Atlas prometer trilha onde a fonte ainda nao tem nada.
const SEED_ESP_VENDADO = join(DATA, 'specializations-seed.json');
const SEED_ESP_REC_VENDADO = join(DATA, 'specialization-resources-seed.json');
const SEED_ESP_OVERLAY_VENDADO = join(DATA, 'specializations-unindexed-overlay.json');
const CATALOGO = join(DATA, 'catalog.json');
const CHECK = process.argv.includes('--check');

// Caminho do clone do planning-kit NESTA maquina (a de casa). O da outra maquina
// fica na lista tambem: o build roda nos dois lugares e a ordem resolve.
const KIT_CASA = 'C:/Users/luck-/Documents/Aurora/atlas-planning-kit/content';
const KIT_OUTRA = 'C:/Users/Pichau/Desktop/atlas-planning-kit/content';

// Onde cada seed pode estar. A copia vendada vem primeiro de proposito: ela e a
// que foi auditada e commitada. O clone do planning-kit e so o caminho de
// atualizacao.
const CANDIDATOS = [
  SEED_VENDADO,
  join(KIT_CASA, 'ubl-core-seed.json'),
  join(KIT_OUTRA, 'ubl-core-seed.json'),
  join(RAIZ, 'source', 'atlas-planning-kit', 'content', 'ubl-core-seed.json')
];

const CANDIDATOS_ELETIVAS = [
  SEED_ELETIVAS_VENDADO,
  join(KIT_CASA, 'commented-electives-seed.json'),
  join(KIT_OUTRA, 'commented-electives-seed.json'),
  join(RAIZ, 'source', 'atlas-planning-kit', 'content', 'commented-electives-seed.json')
];

// Candidatos para qualquer seed do kit: copia vendada primeiro (e a auditada),
// depois o clone desta maquina, depois o da outra, depois source/ no repo.
function candidatosPara(nome, vendado) {
  return [
    vendado,
    join(KIT_CASA, nome),
    join(KIT_OUTRA, nome),
    join(RAIZ, 'source', 'atlas-planning-kit', 'content', nome)
  ];
}

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
async function acharSeed(candidatos, nome) {
  for (const c of candidatos) {
    if (await existe(c)) return c;
  }
  falha(`${nome} nao encontrado em nenhum de:\n  ${candidatos.join('\n  ')}`);
}

function lerJson(caminho, nome) {
  return readFile(caminho, 'utf8').then((bruto) => {
    try {
      return JSON.parse(bruto);
    } catch (e) {
      falha(`${nome} nao e JSON valido (${caminho}): ${e.message}`);
    }
  });
}

const seedPath = await acharSeed(CANDIDATOS, 'seed ubl-core-seed.json');
const eletivasPath = await acharSeed(CANDIDATOS_ELETIVAS, 'seed commented-electives-seed.json');

const espPath = await acharSeed(candidatosPara('specializations-seed.json', SEED_ESP_VENDADO), 'seed specializations-seed.json');
const espRecPath = await acharSeed(candidatosPara('specialization-resources-seed.json', SEED_ESP_REC_VENDADO), 'seed specialization-resources-seed.json');
const espOverlayPath = await acharSeed(candidatosPara('specializations-unindexed-overlay.json', SEED_ESP_OVERLAY_VENDADO), 'overlay specializations-unindexed-overlay.json');

const seed = await lerJson(seedPath, 'seed da grade');
const seedEletivas = await lerJson(eletivasPath, 'seed das eletivas');
const seedEsp = await lerJson(espPath, 'seed das especializacoes');
const seedEspRec = await lerJson(espRecPath, 'seed dos recursos de especializacao');
const seedEspOverlay = await lerJson(espOverlayPath, 'overlay de especializacoes nao indexadas');

const { courses, origem, total, descartados } = toCatalog(seed);
if (courses.length === 0) falha('derivacao devolveu zero disciplinas');

// Eletivas: derivadas, mas NUNCA somadas a `courses`. Quem ler so esta linha e
// pensar "por que nao concatenar?" — a resposta esta em core/catalog.js:
// a fonte as mantem em bloco HTML comentado e proibe soma-las sem decisao editorial.
const { electives, origem: origemEletivas, total: totalEletivas, descartados: descartadosEletivas } = toElectives(seedEletivas);

const { specializations, origem: origemEspecializacoes, aguardando } = toSpecializations(seedEsp, seedEspRec, seedEspOverlay);
if (specializations.length === 0) falha('derivacao devolveu zero especializacoes');

// 1. vendar os seeds, se vieram de fora do app
await mkdir(DATA, { recursive: true });
for (const [achado, vendado, rotulo] of [
  [seedPath, SEED_VENDADO, 'ubl-core-seed.json'],
  [eletivasPath, SEED_ELETIVAS_VENDADO, 'commented-electives-seed.json'],
  [espPath, SEED_ESP_VENDADO, 'specializations-seed.json'],
  [espRecPath, SEED_ESP_REC_VENDADO, 'specialization-resources-seed.json'],
  [espOverlayPath, SEED_ESP_OVERLAY_VENDADO, 'specializations-unindexed-overlay.json']
]) {
  if (resolve(achado) === resolve(vendado)) continue;
  if (CHECK) {
    falha(`--check: app/data/${rotulo} nao existe (o seed achado foi ${achado})`);
  }
  await copyFile(achado, vendado);
  console.log(`vendado: app/data/${rotulo}  <- ${achado}`);
}

// 2. escrever o catalogo derivado
const corpo = `${JSON.stringify({
  geradoPor: 'tools/build-catalog.mjs',
  geradoDe: 'app/data/ubl-core-seed.json',
  origem,
  courses,
  geradoDeEletivas: 'app/data/commented-electives-seed.json',
  origemEletivas,
  electives,
  geradoDeEspecializacoes: [
    'app/data/specializations-seed.json',
    'app/data/specialization-resources-seed.json',
    'app/data/specializations-unindexed-overlay.json'
  ],
  origemEspecializacoes,
  specializations
}, null, 2)}\n`;

if (CHECK) {
  const atual = await readFile(CATALOGO, 'utf8').catch(() => null);
  if (atual === null) falha('--check: app/data/catalog.json nao existe; rode node tools/build-catalog.mjs');
  if (atual !== corpo) {
    falha('--check: app/data/catalog.json esta DESATUALIZADO em relacao ao seed; rode node tools/build-catalog.mjs');
  }
  console.log(`OK: catalog.json em dia — ${courses.length} disciplinas (${descartados} descartadas de ${total}) + ${electives.length} eletivas arquivadas`);
  process.exit(0);
}

await writeFile(CATALOGO, corpo, 'utf8');

// 3. conferir relendo o que escreveu (escrever nao e o mesmo que ter escrito)
const deVolta = JSON.parse(await readFile(CATALOGO, 'utf8'));
if (!Array.isArray(deVolta.courses) || deVolta.courses.length !== courses.length) {
  falha('o arquivo escrito nao confere com o que foi derivado');
}
if (!Array.isArray(deVolta.electives) || deVolta.electives.length !== electives.length) {
  falha('o arquivo escrito nao confere nas eletivas');
}
if (!Array.isArray(deVolta.specializations) || deVolta.specializations.length !== specializations.length) {
  falha('o arquivo escrito nao confere nas especializacoes');
}
// Especializacao marcada como aguardando NAO pode ter recursos: se tiver, a
// marcacao esta errada e a tela vai dizer ao aluno que falta o que ja existe.
for (const sp of deVolta.specializations) {
  if (sp.aguardandoConteudo && Array.isArray(sp.resources) && sp.resources.length > 0) {
    falha(`especializacao "${sp.id}" esta marcada como aguardando conteudo mas tem ${sp.resources.length} recurso(s)`);
  }
  // Regra do overlay: reachableFromIndex=false nunca pode vir com recursos.
  if (sp.reachableFromIndex === false && Array.isArray(sp.resources) && sp.resources.length > 0) {
    falha(`especializacao "${sp.id}" nao e alcancavel pelo indice e mesmo assim ganhou recursos`);
  }
}
const ids = new Set(deVolta.courses.map((c) => c.id));
if (ids.size !== deVolta.courses.length) falha('catalogo escrito tem ids duplicados');
// Eletiva com id de disciplina da grade seria o jeito silencioso de ela entrar
// no progresso. Este e o unico lugar onde os dois mundos se encontram, entao e
// aqui que se confere que nao se misturaram.
const idsEletivas = new Set(deVolta.electives.map((e) => e.id));
if (idsEletivas.size !== deVolta.electives.length) falha('eletivas tem ids duplicados');
for (const id of idsEletivas) {
  if (ids.has(id)) falha(`id "${id}" aparece na grade E nas eletivas: elas nao podem se misturar`);
}

const estagios = [...new Set(deVolta.courses.map((c) => c.stage))].sort((a, b) => a - b);
console.log(`ESCRITO: app/data/catalog.json`);
console.log(`  disciplinas: ${deVolta.courses.length} (de ${total} no seed, ${descartados} descartadas)`);
console.log(`  estagios: ${estagios.join(', ')}`);
console.log(`  sem pre-requisito (abertas de cara): ${deVolta.courses.filter((c) => c.prerequisites.length === 0).length}`);
console.log(`  sem URL de recurso: ${deVolta.courses.filter((c) => !c.resourceUrl).length}`);
console.log(`  com bibliografia: ${deVolta.courses.filter((c) => c.bibliography).length}`);
console.log(`  eletivas arquivadas: ${deVolta.electives.length} (de ${totalEletivas} no seed, ${descartadosEletivas} descartadas)`);
console.log(`  eletivas sem URL de recurso: ${deVolta.electives.filter((e) => !e.resourceUrl).length}`);
console.log(`  especializacoes: ${deVolta.specializations.length} (aguardando conteudo: ${aguardando})`);
console.log(`  recursos de especializacao: ${deVolta.specializations.reduce((n, sp) => n + sp.resources.length, 0)}`);
console.log(`  recursos sem URL: ${deVolta.specializations.reduce((n, sp) => n + sp.resources.filter((r) => !r.url).length, 0)}`);
console.log(`  origem: ${origem}`);
console.log(`  origem das eletivas: ${origemEletivas}`);
