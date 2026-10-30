// Projeto Atlas — a trava do cache do service worker.
//
// O defeito que este arquivo existe para impedir (30/10/2026): o sw.js e
// cache-first e a regra da casa mandava subir VERSAO quando o PRECACHE ou o
// catalog.json mudassem. Conteudo de um arquivo JA listado nao muda nada disso:
// a 2b do metrô mexeu em web/metro.js, web/metro.css e core/textos.js e o sw.js
// ficou byte a byte igual. O navegador compara o service worker por bytes: igual
// = nao instala = quem ja abriu o app ve a tela velha para sempre. Aconteceu de
// verdade: a 2b-2 so apareceu depois de desregistar o service worker a mau.
//
// A trava: o hash do CONTEUDO de todos os arquivos do precache mora no proprio
// sw.js. Conteudo mudou -> hash anotado nao bate -> o teste falha -> quem mexe
// no app e obrigado a subir VERSAO, e ai o sw novo instala de fato.
//
// O hash tambem e o que impede o oposto: VERSAO subida sem necessidade troca o
// cache inteiro por nada. Nao ha teste para isso de proposito — o custo de um
// cache novo e ~1 MB de download, o custo de cache velho e o app errado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** A lista PRECACHE do sw.js, na ordem em que esta la. Sem eval: le as aspas. */
function listaDoPrecache(texto) {
  const bloco = texto.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(bloco, 'sw.js precisa de um array PRECACHE explicito');
  return [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Conteudo dos arquivos, na ordem da lista, com o caminho na frente. O caminho
 * entra no hash porque renomear arquivo sem mudar conteudo tambem quebra o
 * cache de quem ja instalou (o cache antigo nao tem o nome novo).
 */
async function hashDoPrecache(lista) {
  const h = createHash('sha256');
  for (const caminho of lista) {
    h.update(caminho);
    h.update('\n');
    h.update(await readFile(join(RAIZ, caminho)));
    h.update('\n');
  }
  return h.digest('hex');
}

let sw = '';

test('trava: sobe o sw.js uma vez para todos os casos', async () => {
  sw = await readFile(join(RAIZ, 'sw.js'), 'utf8');
  assert.ok(sw.length > 0);
});

test('trava: o sw.js anota o hash do precache ao lado da VERSAO', () => {
  const anotado = sw.match(/const PRECACHE_HASH\s*=\s*['"]sha256-([0-9a-f]{64})['"]/);
  assert.ok(
    anotado,
    'falta o hash do precache no sw.js: escreva `const PRECACHE_HASH = \'sha256-<64 hex>\'` ao lado da VERSAO'
  );
});

test('trava: o conteudo do precache bate com o hash anotado', async () => {
  const anotado = sw.match(/const PRECACHE_HASH\s*=\s*['"]sha256-([0-9a-f]{64})['"]/);
  assert.ok(anotado, 'o conteudo do precache mudou: suba a VERSAO e atualize o hash');
  const calculado = await hashDoPrecache(listaDoPrecache(sw));
  assert.equal(
    anotado[1],
    calculado,
    `o conteúdo do precache mudou: suba a VERSAO e atualize o hash (anotado sha256-${anotado[1]}, atual sha256-${calculado})`
  );
});

test('trava: a VERSAO nova foi registrada no comentario com o motivo', () => {
  const versao = sw.match(/const VERSAO\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(versao, 'sw.js precisa de const VERSAO');
  const numero = versao[1];
  assert.ok(
    sw.includes(`${numero}:`),
    `subiu a VERSAO para ${numero} sem escrever o motivo no comentario do topo: da proxima pessoa nao saber o que mudou`
  );
});

test('trava: o install busca sem passar pelo cache HTTP do navegador', () => {
  // Service worker novo + resposta 200 no cache HTTP = o navegador devolve a
  // copia velha, o cache novo e preenchido com conteudo velho e a VERSAO nova
  // nao conserta nada. cache: 'reload' e o unico jeito de o install pedir a
  // verdade ao servidor.
  assert.match(
    sw,
    /new Request\([^)]*\{\s*cache:\s*['"]reload['"]/,
    'o precache no install precisa buscar com new Request(url, { cache: "reload" })'
  );
  assert.match(sw, /addAll\(/, 'o install continua precacheando em bloco (falha inteira se faltar arquivo)');
});
