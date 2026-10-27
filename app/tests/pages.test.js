// Projeto Atlas — pronto para publicar em SUBCAMINHO (GitHub Pages).
//
// Por que existe: o Pages serve repositorio de usuario em
//   https://<usuario>.github.io/atlas-kit-tools/
// e nao na raiz do dominio. Todo caminho ABSOLUTO do app (start_url "/",
// escopo "/" do service worker, "/data/catalog.json" no precache) aponta para
// a raiz do dominio — que nao e o Atlas. Resultado: sem offline (addAll falha
// inteira se UM arquivo 404), e o app instalado abre a pagina errada.
// Nao da para ver isso no navegador local servindo da raiz: so aparece publicado.
//
// A sincronia precache-vs-disco e do pwa.test.js — aqui so se cobra o que o
// subcaminho muda: caminhos RELATIVOS e o workflow que publica app/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ_APP = fileURLToPath(new URL('..', import.meta.url));
const RAIZ_REPO = fileURLToPath(new URL('../..', import.meta.url));
const ler = async (caminho) => readFile(new URL(caminho, `file:///${RAIZ_APP.replace(/\\/g, '/')}`), 'utf8');
const lerRepo = async (caminho) => readFile(new URL(caminho, `file:///${RAIZ_REPO.replace(/\\/g, '/')}`), 'utf8');

const relativo = (valor, onde) =>
  assert.ok(
    typeof valor === 'string' && valor.length > 0 && !valor.startsWith('/'),
    `${onde} com caminho absoluto quebra sob /atlas-kit-tools/: ${JSON.stringify(valor)}`
  );

test('Pages: manifest usa start_url, scope e icones RELATIVOS', async () => {
  const m = JSON.parse(await ler('manifest.webmanifest'));
  relativo(m.start_url, 'manifest.start_url');
  relativo(m.scope, 'manifest.scope');
  // Relativo resolve contra a URL do proprio manifest: vale na raiz e no subcaminho.
  assert.equal(m.start_url, './', 'start_url "./" e a forma que funciona nos dois lugares');
  for (const i of m.icons) relativo(i.src, 'manifest.icons[].src');
});

test('Pages: o registro do sw usa escopo relativo a URL do documento', async () => {
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

test('Pages: o precache do sw resolve contra a URL dele, nao contra "/"', async () => {
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

test('Pages: o workflow publica a pasta app/ e nao exige segredo', async () => {
  const yml = await lerRepo('.github/workflows/pages.yml');
  assert.match(yml, /actions\/configure-pages/, 'sem configure-pages o Pages nao sabe a URL base');
  assert.match(yml, /actions\/upload-pages-artifact/, 'sem upload-pages-artifact nada chega ao Pages');
  assert.match(yml, /actions\/deploy-pages/, 'sem deploy-pages o artefato fica parado');
  assert.match(yml, /path:\s*app\s*$/m, 'precisa publicar a pasta app/, que e onde o site esta');
  assert.match(yml, /permissions:[\s\S]*?pages:\s*write/, 'sem permissao pages o deploy falha com 403');
  assert.match(yml, /id-token:\s*write/, 'deploy-pages exige id-token para provar quem publica');
  assert.match(yml, /workflow_dispatch/, 'sem dispatch manual o Lucas nao consegue publicar sob demanda');
  assert.ok(!/secrets\./.test(yml), 'este workflow nao pode depender de segredo: nada aqui e privado');
  assert.ok(!/--force|gh repo|visibility|public/i.test(yml), 'o workflow nao pode mudar visibilidade do repo — isso e decisao do Lucas');
});
