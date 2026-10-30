// Ferramenta do Atlas — imprime o sha256 do conteudo do PRECACHE.
//
// NAO e teste (por isso nao termina em .test.js: o glob da suite e
// "app/tests/*.test.js"). Roda da pasta app:  node tests/precache-hash.js
//
// Para que existe: a trava do cache (app/tests/sw-precache-hash.test.js) falha
// quando o conteudo de um arquivo do precache muda sem o hash no sw.js mudar.
// A mensagem diz o que fazer, e o valor a colar em PRECACHE_HASH sai daqui. Mesma
// ordem, mesmos bytes do teste — senao a trava apontaria para o nada.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = await readFile(join(RAIZ, 'sw.js'), 'utf8');
const bloco = sw.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\n\];/);
if (!bloco) {
  console.error('sw.js sem o array PRECACHE explicito');
  process.exit(1);
}
const lista = [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);

const h = createHash('sha256');
for (const caminho of lista) {
  h.update(caminho);
  h.update('\n');
  h.update(await readFile(join(RAIZ, caminho)));
  h.update('\n');
}
console.log('arquivos:', lista.length);
console.log('sha256-' + h.digest('hex'));
