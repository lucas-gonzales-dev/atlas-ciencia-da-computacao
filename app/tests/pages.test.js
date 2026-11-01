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
// O casco é desenhado a partir de ABAS (core/rotas.js) e dos rótulos de
// core/textos.js. Cobrar no HTML os mesmos valores que o módulo já exporta é o
// que impede a barra de baixo de apontar para uma tela que a rota não conhece.
import { ABAS } from '../core/rotas.js';
import { casco } from '../core/textos.js';

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
  // A pagina carrega o modulo: sem a tag, nada roda e nao ha nem sw nem tela.
  // S3a-2a: registrarSW continua no boot.js, mas quem o chama e o casco.
  const html = await ler('index.html');
  assert.match(html, /<script[^>]+src=["']\.\/web\/casco\.js["']/, 'index.html deixou de carregar web/casco.js');

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

// ── O CASCO (S3a-2a) ─────────────────────────────────────────────────────────
//
// Por que aqui, e não num arquivo novo: este já é "onde se testa o index.html".
// Duas famílias de cobrança sobre a mesma página dariam duas verdades sobre o
// que ela tem de ter, e a segunda seria esquecida na primeira refatoração.
//
// O QUE O NODE NÃO ALCANÇA: estas cinco cobranças são de STRUCTURE, lidas como
// texto. Quem garante que o casco TROCA de tela, põe aria-current, move o foco
// e fala o anúncio é tests/casco.test.js, com um document de mentira — o
// aggregate verde deste arquivo não prova nada do comportamento, do mesmo jeito
// que o metro.test.js verde não provou o applyNote de 32469d9. A lição de 30/10
// está aplicada: cobrar o dublê é medir o dublê.
const tagDeAbertura = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((m) => m[0]);

const corpoDoHtml = (html) => {
  const i = html.search(/<body\b[^>]*>/i);
  assert.ok(i >= 0, 'index.html sem <body>');
  return html.slice(i);
};

test('casco: o primeiro elemento focável do body é o "Pular para o conteúdo"', async () => {
  const corpo = corpoDoHtml(await ler('index.html'));
  const focaveis = [...corpo.matchAll(/<(a|button|input|select|textarea)\b([^>]*)>/gi)];
  assert.ok(focaveis.length > 0, 'nenhum elemento focável no <body>: nada para o Tab alcançar');
  const [tag, attrs] = [focaveis[0][1].toLowerCase(), focaveis[0][2]];
  assert.equal(tag, 'a', `quem recebe o Tab primeiro é <${tag}>; tem de ser o link de pular`);
  assert.match(attrs, /class="pular"/, `primeiro focável sem class="pular": ${focaveis[0][0]}`);
  assert.match(attrs, /href="#conteudo"/, `o pular não aponta para #conteudo: ${focaveis[0][0]}`);
});

test('casco: um main#conteudo, uma nav com uma aba por rota e o anúncio do leitor de tela', async () => {
  const html = await ler('index.html');

  const mains = tagDeAbertura(html, 'main');
  assert.equal(mains.length, 1, `saiu mais de um <main> na página: ${mains.join(' ')}`);
  assert.match(mains[0], /id="conteudo"/, 'o main não é #conteudo, e o "Pular" cai no vazio');
  assert.match(mains[0], /tabindex="-1"/, 'sem tabindex="-1" o foco não entra no main por programa');

  const navs = tagDeAbertura(html, 'nav');
  assert.equal(navs.length, 1, `mais de uma <nav>: o leitor de tela passa a dizer "principal" duas vezes`);
  assert.match(navs[0], /aria-label="Principal"/, `nav sem rótulo: ${navs[0]}`);
  assert.equal(casco.navegacao, 'Principal', 'o rótulo cobrado aqui não é mais o de core/textos.js');

  const dentroDaNav = html.slice(html.search(/<nav\b[^>]*>/i), html.indexOf('</nav>'));
  const links = [...dentroDaNav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  assert.equal(links.length, ABAS.length, `a nav tem ${links.length} link(s), ABAS tem ${ABAS.length}`);
  ABAS.forEach((aba, i) => {
    assert.ok(links[i], `falta a aba ${aba.tela}`);
    assert.match(
      links[i][1],
      new RegExp(`href="${aba.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      `a aba ${i} não aponta para ${aba.href}: ${links[i][0]}`
    );
    assert.ok(
      links[i][2].includes(aba.rotulo),
      `a aba ${i} não mostra o rótulo "${aba.rotulo}" de core/textos.js: ${links[i][2].trim()}`
    );
  });

  const anuncios = tagDeAbertura(html, 'p').filter((t) => /id="anuncio"/.test(t));
  assert.equal(anuncios.length, 1, 'sem <p id="anuncio"> a troca de aba é muda para quem usa leitor de tela');
  assert.match(anuncios[0], /aria-live="polite"/, `anúncio sem aria-live: ${anuncios[0]}`);
  assert.match(anuncios[0], /class="so-leitor"/, `anúncio visível na tela: ${anuncios[0]}`);
  assert.equal(casco.anuncio('Jornada'), 'Você está em Jornada.', 'a frase do anúncio mudou de lugar');
});

test('casco: o index.html não tem <style> nem código inline — só <link> e o módulo do casco', async () => {
  const html = await ler('index.html');
  assert.ok(!/<style\b/i.test(html), 'voltou <style> ao index.html: ali o CSS não entra em teste nenhum');

  const scripts = tagDeAbertura(html, 'script');
  assert.equal(scripts.length, 1, `mais de um <script> na página: ${scripts.join(' ')}`);
  assert.match(scripts[0], /type="module"/, `o casco não entra como módulo: ${scripts[0]}`);
  assert.match(scripts[0], /src="\.\/web\/casco\.js"/, `a página não carrega ./web/casco.js: ${scripts[0]}`);
  assert.ok(
    !/\son(click|input|change|keydown|submit)\s*=\s*["']/i.test(html),
    'apareceu um handler inline no HTML: código sem teste outra vez'
  );
});

test('casco: o main traz a GUARDA ESCRITA — sem ela, módulo que não roda é tela branca muda', async () => {
  // 01/11/2026: o Lucas abriu o Atlas e viu marca + duas abas + branco. O disco,
  // o servidor e a suíte estavam verdes; o que faltava era a página dizer o que
  // ela não pode dizer por JS, porque em file:// o navegador RECUSA módulo ES
  // (CORS, origem "null") e não existe código rodando para se avisar. Este caso
  // existe para a guarda não ser apagada por refatoração: quem limpa o main sem
  // olhar o HTML devolve o branco mudo.
  const html = await ler('index.html');
  const dentro = html.slice(html.search(/<main\b[^>]*>/i), html.indexOf('</main>'));
  assert.ok(dentro.length > 0, 'sumiu o </main> do index.html');
  assert.match(
    dentro,
    /<p>[\s\S]{60,}/,
    'o main está vazio de novo: se ./web/casco.js não rodar, o aluno vê branco e nenhuma saída'
  );
  assert.match(dentro, /duplo clique|file:/, 'a guarda não nomeia a causa (file://)');
  assert.match(dentro, /node app\/serve\.js/, 'a guarda não dá o comando que resolve');
  // O aviso mora DENTRO do main, não antes dele: o casco manda esvaziar o main
  // antes de pintar, então em http a guarda dura o tempo do módulo carregar e
  // desaparece sozinha. Fora do main ela ficaria na tela para sempre.
});

test('casco: importar boot.js sem #app não monta nada e não busca o catálogo', async () => {
  // A S3a-2a tira o `subir()` e o `export const inicio`. Quem decide quando a
  // tela sobe passa a ser o casco; enquanto boot.js sobe sozinho, a página
  // nova (sem #app no topo) chama loadCatalog e monta uma grade fora da aba.
  const pedidos = [];
  const documentOriginal = globalThis.document;
  const fetchOriginal = globalThis.fetch;
  const doc = {
    getElementById: () => null, // a página nova não tem #app no topo
    createElement: () => ({ setAttribute() {}, append() {}, add() {} }),
    querySelector: () => null
  };
  globalThis.document = doc;
  globalThis.fetch = async (url) => {
    pedidos.push(String(url));
    return { ok: true, json: async () => ({ courses: [] }) };
  };

  let lanca = null;
  let boot = null;
  try {
    boot = await import('../web/boot.js');
    await new Promise((r) => setImmediate(r));
  } catch (e) {
    lanca = e;
  } finally {
    if (documentOriginal === undefined) delete globalThis.document;
    else globalThis.document = documentOriginal;
    if (fetchOriginal === undefined) delete globalThis.fetch;
    else globalThis.fetch = fetchOriginal;
  }

  assert.equal(lanca, null, `importar boot.js lançou: ${lanca?.message}`);
  assert.ok(!('inicio' in boot), 'boot.js ainda exporta `inicio`: a página ainda sobe ao ser importada');
  assert.deepEqual(pedidos, [], `boot.js buscou o catálogo ao ser importado: ${pedidos.join(', ')}`);
});

test('casco: as duas telas exportam montar', async () => {
  for (const tela of ['jornada', 'explorar']) {
    const mod = await import(`../web/telas/${tela}.js`);
    assert.equal(typeof mod.montar, 'function', `web/telas/${tela}.js não exporta montar(raiz, ctx)`);
  }
});

// ── A CARA DO CASCO (S3a-2b) ─────────────────────────────────────────────────
//
// O CSS vem escrito na fatia; o que a trava design-system NÃO cobre e estas
// duas cobranças sim: a ORDEM dos <link> (casco.css depois de base.css e antes
// de metro.css — o chão vem primeiro, e a tela pode sobrescrever o casco) e o
// @media que leva a barra de abas do pé do celular para o topo do computador.
// Cor, tempo, largura e sombra continuam sendo da trava, que lê todo .css.
test('casco.css: o index.html carrega ./web/casco.css depois de base.css e antes de metro.css', async () => {
  const html = await ler('index.html');
  const ordem = [...html.matchAll(/<link[^>]+href="\.\/web\/([a-z-]+\.css)"/g)].map((m) => m[1]);
  assert.ok(ordem.includes('casco.css'), `index.html não carrega ./web/casco.css; ordem: ${ordem.join(', ')}`);
  assert.ok(
    ordem.indexOf('base.css') < ordem.indexOf('casco.css'),
    `casco.css vem antes de base.css (${ordem.join(', ')}): o casco perderia o chão que herda`
  );
  assert.ok(
    ordem.indexOf('casco.css') < ordem.indexOf('metro.css'),
    `casco.css vem depois de metro.css (${ordem.join(', ')}): as telas deixariam de poder sobrescrever o casco`
  );
});

test('casco.css: a aba ativa tem regra própria sem box-shadow, e o @media de 1024px tira as abas do fixed', async () => {
  const css = await ler('web/casco.css');
  const ativa = css.match(/\.abas a\[aria-current="page"\]\s*\{([^}]*)\}/);
  assert.ok(ativa, 'sem a regra .abas a[aria-current="page"] a aba escolhida não se distingue das outras');
  assert.ok(!/box-shadow/.test(ativa[1]), 'a aba ativa usa box-shadow: sombra é proibida fora de --sombra-placa (regra 9)');
  const media = css.match(/@media\s*\(\s*min-width:\s*1024px\s*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(media, 'sem @media (min-width: 1024px) as abas ficam fixas no pé da tela também no computador');
  const abasNoMedia = media[1].match(/\.abas\s*\{([^}]*)\}/);
  assert.ok(abasNoMedia, 'o @media de 1024px não toca em .abas');
  assert.ok(!/position:\s*fixed/.test(abasNoMedia[1]), `o @media manteve .abas em fixed: ${abasNoMedia[1].trim()}`);
});
