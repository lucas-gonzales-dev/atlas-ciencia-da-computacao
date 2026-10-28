// Projeto Atlas — caminhos RELATIVOS, que e o que faz o app funcionar em QUALQUER endereco.
//
// Por que existe: todo caminho ABSOLUTO do app (start_url "/", escopo "/" do
// service worker, "/data/catalog.json" no precache) aponta para a raiz do
// DOMINIO, nao para o app. Servindo da raiz local isso passa despercebido;
// publicado em subcaminho, quebra em silencio de dois jeitos: cache.addAll() falha
// INTEIRO quando um unico arquivo da 404 (o app "instala" sem offline nenhum, e
// so quem abriu no onibus descobre), e o registro do sw com escopo '/' e RECUSADO
// pelo navegador porque o sw.js estaria fora do escopo pedido.
//
// Historico do endereco (28/10/2026): este arquivo nasceu para o GitHub Pages,
// que serviria o Atlas em https://<usuario>.github.io/atlas-kit-tools/ — um
// subcaminho. O Atlas foi publicado no Cloudflare Pages
// (https://atlas-ciencia-da-computacao.pages.dev/), que serve da RAIZ do
// dominio, e o workflow do Pages saiu do repositorio. A cobranca continua a
// mesma, por um motivo mais forte que o endereco de hoje: caminho relativo e o
// que sobrevive a mudanca de hospedagem — vale na raiz, vale em subcaminho, vale
// no `node app/serve.js` de quem clona. O que saiu daqui foi so o teste do
// workflow, porque o arquivo que ele lia deixou de existir.
//
// A sincronia precache-vs-disco e do pwa.test.js — aqui so se cobra o que o
// endereco muda: caminhos RELATIVOS no manifesto, no registro do sw e no precache.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ_APP = fileURLToPath(new URL('..', import.meta.url));
const ler = async (caminho) => readFile(new URL(caminho, `file:///${RAIZ_APP.replace(/\\/g, '/')}`), 'utf8');

const relativo = (valor, onde) =>
  assert.ok(
    typeof valor === 'string' && valor.length > 0 && !valor.startsWith('/'),
    `${onde} com caminho absoluto so funciona servido da raiz do dominio: ${JSON.stringify(valor)}`
  );

test('Endereco: manifest usa start_url, scope e icones RELATIVOS', async () => {
  const m = JSON.parse(await ler('manifest.webmanifest'));
  relativo(m.start_url, 'manifest.start_url');
  relativo(m.scope, 'manifest.scope');
  // Relativo resolve contra a URL do proprio manifest: vale na raiz e no subcaminho.
  assert.equal(m.start_url, './', 'start_url "./" e a forma que funciona nos dois lugares');
  for (const i of m.icons) relativo(i.src, 'manifest.icons[].src');
});

test('Endereco: o registro do sw usa escopo relativo a URL do documento', async () => {
  // 27/10/2026: o registro saiu do index.html (script inline) e foi para
  // web/boot.js, que e modulo com teste. Quem cobra o escopo le onde o codigo
  // esta agora — cobrar no HTML passaria a cobrar o vazio.
  const boot = await ler('web/boot.js');
  assert.match(boot, /serviceWorker\.register\(/, 'sem registro nao ha offline');
  assert.ok(
    !/scope:\s*['"]\/['"]/.test(boot),
    "scope: '/' trava o sw na raiz do dominio; sob subcaminho o registro e RECUSADO"
  );
  assert.match(
    boot,
    /baseURI|location\.href|new URL\(/,
    'o escopo precisa vir da URL do documento, nao de um literal'
  );
  // A pagina carrega o modulo: sem a tag, boot.js nao roda e nao ha nem sw nem tela.
  const html = await ler('index.html');
  assert.match(html, /<script[^>]+src=["']\.\/web\/boot\.js["']/, 'index.html deixou de carregar web/boot.js');

  // Assets do documento continuam cobertos aqui (nao no boot): e o HTML que os cita.
  // Assets do documento: nada de href="/..." ou src="/...".
  const absolutos = [...html.matchAll(/(?:href|src)\s*=\s*"(\/[^"]*)"/g)].map((x) => x[1]);
  assert.deepEqual(absolutos, [], `asset absoluto em index.html: ${absolutos.join(', ')}`);
});

test('Endereco: o precache do sw resolve contra a URL dele, nao contra "/"', async () => {
  const sw = await ler('sw.js');
  const bloco = sw.match(/PRECACHE\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(bloco, 'sw.js precisa de um array PRECACHE explicito');
  const caminhos = [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  assert.ok(caminhos.length >= 10, `precache suspeito, so ${caminhos.length} entradas`);
  for (const c of caminhos) relativo(c, 'PRECACHE');

  // Precisa existir resolucao contra self.location (ou registration.scope).
  assert.match(sw, /self\.location|registration\.scope/, 'sem resolver contra a URL do sw, o caminho relativo nao vira nada');
  assert.ok(
    !/caches\.match\(['"]\/index\.html['"]\)/.test(sw),
    "fallback offline com '/index.html' busca a raiz do dominio e devolve 404"
  );
});
