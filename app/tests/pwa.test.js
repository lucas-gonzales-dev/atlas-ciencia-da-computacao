// Projeto Atlas — PWA: instalavel e offline.
//
// Por que estes testes existem: o app guarda progresso no localStorage, mas se
// o aluno abrir no onibus sem sinal e a tela vier em branco, o produto falhou
// no unico momento em que ele mais precisa. serve.js ja menciona que service
// worker so funciona em http(s) — por isso o servidor estatico e requisito.
//
// CAMINHOS RELATIVOS AQUI (24/10/2026): este arquivo ja cobrou caminhos
// ABSOLUTOS ('/data/catalog.json', start_url '/', icone com src '/'). Isso era
// certo para servir da raiz e errado para quem serve o Atlas em subcaminho (foi
// assim que o GitHub Pages serviria). Os absolutos viraram relativos de proposito, e o teste que
// cobra isso e app/tests/pages.test.js — os dois leem o MESMO fato de angulos
// diferentes (sincronia com o disco aqui, resolvibilidade em subcaminho la).
//
// LIMITE HONESTO: node nao executa service worker nem instala PWA. O que se
// prova aqui e o que PODE falhar em silencio no codigo: os arquivos existem,
// sao servidos com o content-type certo, e a lista de precache esta SINCRONIZADA
// com o disco. A instalabilidade de verdade so se confirma no Android.
import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, stop } from '../serve.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PORT = 20000 + Math.floor(Math.random() * 40000); // nunca porta fixa

function get(pathCru) {
  return new Promise((ok, falhou) => {
    const r = request({ host: '127.0.0.1', port: PORT, path: pathCru, method: 'GET' }, (res) => {
      const pedacos = [];
      res.on('data', (p) => pedacos.push(p));
      res.on('end', () => ok({ status: res.statusCode, tipo: res.headers['content-type'] || '', corpo: Buffer.concat(pedacos).toString('utf8') }));
    });
    r.on('error', falhou);
    r.end();
  });
}

/** O que existe para virar imagem de compartilhamento, nao para ser usado. */
const VITRINE_FORA_DO_CACHE = ['cartao.html', 'web/cartao.js', 'web/cartao.css', 'marca/cartao.png'];

/** Como o navegador resolve: relativo contra a URL do documento que referencia. */
const resolver = (valorRelativo, base) => new URL(valorRelativo, base).pathname;

/** Recursivo: tudo que o navegador precisaria baixar para a tela funcionar. */
async function arquivosDaApp(pasta = RAIZ, base = RAIZ, saida = []) {
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      // tests/ NAO vai para o cache: e ferramenta de desenvolvimento, nao produto.
      if (entrada.name === 'tests' || entrada.name === 'node_modules') continue;
      await arquivosDaApp(caminho, base, saida);
    // woff2 (29/10/2026): a Overpass entrou no precache do sw.js pelo design
    // system, e asset de cara é asset que o navegador baixa. Sem a extensão aqui,
    // o teste dizia que os dois woff2 do sw.js "não existem" — a lista de extensões
    // é o que define o que conta como arquivo do app, então a fonte pertence a ela.
    // S1 (30/10/2026): a marca definitiva entra no precache como PNG, e o
    // favicon.ico também. Sem as duas extensões aqui, a trava de sincronia
    // chamaria os 9 arquivos de "sobrando" no cache.
    } else if (/\.(js|json|html|svg|css|webmanifest|woff2|png|ico)$/.test(entrada.name)) {
      // sw.js nao se precacheia: o navegador busca a versao nova sozinho.
      if (entrada.name === 'sw.js') continue;
      // S11a (03/11/2026): a VITRINE tambem fica fora. cartao.html, cartao.js,
      // cartao.css e cartao.png existem para ser fotografados por um script, uma
      // vez, por quem desenvolve — nenhum aluno navega ate eles, e um PNG de
      // ~60 KB que nunca aparece no app custaria banda no cache de quem roda em
      // 3G. A excecao e NOMEADA, nao e padrao de pasta: arquivo novo de vitrine
      // precisa ser declarado aqui a mao, e o vitrine.test.js cobra que o
      // cartao.html continue FORA do precache. Assim as duas travas se fecham:
      // esta nao deixa entrar por descuido, aquela nao deixa sair por capricho.
      if (VITRINE_FORA_DO_CACHE.includes(relative(base, caminho).split(sep).join('/'))) continue;
      // Sem '/' na frente: caminho absoluto e a raiz do dominio, e o Pages
      // serve o Atlas em subcaminho.
      saida.push(relative(base, caminho).split(sep).join('/'));
    }
  }
  return saida;
}

let swTexto = '';
let manifest = null;

test('PWA: sobe o servidor uma vez para todos os casos', async () => {
  await start(PORT);
  swTexto = await readFile(join(RAIZ, 'sw.js'), 'utf8');
  manifest = JSON.parse(await readFile(join(RAIZ, 'manifest.webmanifest'), 'utf8'));
  assert.ok(true);
});

test('PWA: o manifest tem o minimo para o Android oferecer "instalar"', () => {
  assert.equal(manifest.start_url, './', 'start_url precisa apontar para o proprio diretorio, nao para a raiz do dominio');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone', 'sem standalone abre como aba, nao como app');
  assert.ok(manifest.name && manifest.name.length > 0);
  assert.ok(manifest.short_name && manifest.short_name.length <= 12, 'short_name aparece embaixo do icone');
  assert.ok(manifest.lang === 'pt-BR');
  // Icone >= 144px e o piso do Chrome para installability.
  const icones = Array.isArray(manifest.icons) ? manifest.icons : [];
  assert.ok(icones.length > 0, 'manifest sem icone nao instala');
  for (const i of icones) {
    assert.ok(i.src && !i.src.startsWith('/'), `icone com src absoluto quebra em subcaminho: ${JSON.stringify(i)}`);
    assert.ok(i.sizes === 'any' || parseInt(i.sizes, 10) >= 144, `icone pequeno demais: ${i.sizes}`);
    assert.ok(i.type, 'icone sem type e ignorado por alguns navegadores');
  }
});

test('PWA: index.html liga o manifest E o modulo que registra o service worker', async () => {
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');
  assert.match(html, /rel="manifest"/, 'sem <link rel=manifest> o Android nem ve o app');
  assert.match(html, /manifest\.webmanifest/);
  // 27/10/2026: o registro saiu do script inline e virou modulo testavel.
  // 31/10/2026 (S3a-2a): o modulo que a pagina carrega e o casco, que chama o
  // registrarSW do boot.js. Cobrar boot.js no HTML virou cobrar o vazio outra
  // vez — a regra e a mesma de 27/10: cobrar ONDE o codigo esta agora.
  assert.match(html, /<script[^>]+src=["']\.\/web\/casco\.js["']/, 'index.html precisa carregar web/casco.js');
  const casco = await readFile(join(RAIZ, 'web', 'casco.js'), 'utf8');
  assert.match(casco, /registrarSW/, 'o casco nao registra o service worker: nao ha offline');
  const boot = await readFile(join(RAIZ, 'web', 'boot.js'), 'utf8');
  assert.match(boot, /serviceWorker/, 'sem registro de sw.js nao ha offline');
  assert.match(boot, /sw\.js/);
});

test('PWA: /sw.js e /manifest.webmanifest sao servidos com o content-type certo', async () => {
  const sw = await get('/sw.js');
  assert.equal(sw.status, 200);
  assert.match(sw.tipo, /javascript/, 'sw.js com tipo errado e RECUSADO pelo navegador, em silencio');

  const mf = await get('/manifest.webmanifest');
  assert.equal(mf.status, 200);
  assert.match(mf.tipo, /manifest\+json/);

  // O src do icone e relativo: resolve contra a URL do manifest, como o
  // navegador faria. Pedir o valor cru aqui seria pedir caminho errado.
  const icone = await get(resolver(JSON.parse(mf.corpo).icons[0].src, `http://127.0.0.1:${PORT}/manifest.webmanifest`));
  assert.equal(icone.status, 200, 'icone referenciado mas ausente = app instala sem icone');
});

test('PWA: a lista de precache esta sincronizada com o disco', async () => {
  const esperados = await arquivosDaApp();
  // Le o array PRECACHE do sw.js sem eval: pega os caminhos entre aspas.
  const bloco = swTexto.match(/PRECACHE\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(bloco, 'sw.js precisa de um array PRECACHE explicito');
  const precached = [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);

  const faltando = esperados.filter((a) => !precached.includes(a));
  assert.deepEqual(faltando, [], `arquivos fora do cache (quebram offline): ${faltando.join(', ')}`);

  const sobrando = precached.filter((a) => !esperados.includes(a));
  assert.deepEqual(sobrando, [], `precache aponta para arquivo que nao existe: ${sobrando.join(', ')}`);
});

test('PWA: o catalogo REAL esta no cache — offline sem dados e offline inutil', async () => {
  assert.ok(/['"]data\/catalog\.json['"]/.test(swTexto), 'sem catalog.json no cache a tela cai no catalogo minimo embutido');
  const cat = await get('/data/catalog.json');
  assert.equal(cat.status, 200);
  const json = JSON.parse(cat.corpo);
  assert.equal(json.courses.length, 35, 'sanidade: a trilha real da UBL tem 35 disciplinas');
});

test('PWA: navegacao offline cai no index.html e nao em pagina de erro', () => {
  // Aceita qualquer nome de variavel: o que importa e o modo E o fallback,
  // nao como o autor chamou o request. Regex rigida demais aqui ja deu falso
  // vermelho em 23/10/2026 (o codigo usava `req`, a regex exigia `request`).
  assert.match(swTexto, /\.mode\s*===\s*['"]navigate['"]|navigateFallback/,
    'sem detectar navegacao, abrir o app sem rede da tela branca');
  // O fallback resolve o index contra o diretorio do sw (BASE), nunca '/index.html'.
  assert.match(swTexto, /fetch\([\s\S]*?\)\.catch\([\s\S]*?caches\.match\(\s*new URL\(\s*['"]index\.html['"]/,
    'sem fallback para index.html a navegacao offline morre em pagina de erro');
});

// ─── PEDIDO 21, FATIA S1 (30/10/2026): A MARCA DEFINITIVA ───────────────────
// O logo definitivo (design/marca/gerar-marca.py, a partir de atlas-logo.png)
// entrou no disco como PNG; o ícone azul-marinho em SVG morre. Estes casos não
// conferem gosto nem pixels: conferem que o app APONTA para os arquivos certos e
// que eles existem. Um manifesto que cita um ícone ausente instala sem ícone, e
// nenhum teste de código percebe — só quem abre no aparelho.
const MARCA = {
  icones: ['icons/icone-192.png', 'icons/icone-512.png', 'icons/icone-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/favicon-16.png'],
  favicon: 'favicon.ico',
  topo: ['marca/simbolo.png', 'marca/palavra.png'],
};
const PAPEL = '#fbf7f0';
const CARVAO = '#17181a';

/** <link>/<meta> como o navegador lê: atributo por atributo, sem regex de uma linha. */
function tagsDe(html, nome) {
  return [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
}
function atributo(tag, nome) {
  const m = new RegExp(`\\b${nome}\\s*=\\s*"([^"]*)"`).exec(tag);
  return m ? m[1] : '';
}
/** O PRECACHE do sw.js sem eval: os caminhos entre aspas, todos relativos à BASE. */
function listaDoSw(texto) {
  const bloco = texto.match(/PRECACHE\s*=\s*\[([\s\S]*?)\n\]/);
  assert.ok(bloco, 'sw.js precisa de um array PRECACHE explícito');
  return [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1].replace(/^\.\//, ''));
}

test('marca: o manifesto tem 192, 512 e um maskable, PNG que existem no disco', async () => {
  const icones = manifest.icons || [];
  const tem = (sizes, purpose) => icones.some((i) => i.sizes === sizes && (i.purpose || 'any') === purpose);
  assert.ok(tem('192x192', 'any'), 'falta o PNG 192x192 purpose any');
  assert.ok(tem('512x512', 'any'), 'falta o PNG 512x512 purpose any');
  assert.ok(tem('512x512', 'maskable'), 'sem maskable o launcher recorta o ícone como quer');

  const base = new URL(`http://127.0.0.1:${PORT}/manifest.webmanifest`);
  for (const i of icones) {
    const caminho = join(RAIZ, resolver(i.src, base.href).replace(/^\/+/, ''));
    assert.ok(existsSync(caminho), `o manifesto aponta para ${i.src}, que não existe em app/`);
    const bytes = await readFile(caminho);
    // 89 50 4E 47: os 4 primeiros bytes de todo PNG. Se for SVG renomeado, pega aqui.
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${i.src} não é PNG`);
  }
});

test('marca: o ícone azul-marinho não volta', async () => {
  assert.equal(existsSync(join(RAIZ, 'icons', 'icone.svg')), false, 'icons/icone.svg ainda no disco');
  const citando = [];
  for (const c of await arquivosDaApp()) {
    if (!/\.(html|webmanifest|js)$/.test(c)) continue;
    const texto = await readFile(join(RAIZ, c), 'utf8');
    if (texto.includes('icone.svg')) citando.push(c);
  }
  assert.deepEqual(citando, [], 'algum arquivo ainda chama o ícone velho');
});

test('marca: o manifesto pinta papel', () => {
  assert.equal(manifest.background_color, PAPEL, 'splash de instalação ainda na cor antiga');
  assert.equal(manifest.theme_color, PAPEL, 'a barra do navegador ainda herda a cor antiga');
});

test('marca: as páginas apontam os ícones novos', async () => {
  // S3b: só sobrou uma página. O metro.html virou redirecionamento (teste
  // abaixo), então o laço de dois virou o index.html — o casco.
  for (const nome of ['index.html']) {
    const html = await readFile(join(RAIZ, nome), 'utf8');
    const links = tagsDe(html, 'link');
    for (const [arq, sizes] of [['icons/favicon-32.png', '32x32'], ['icons/favicon-16.png', '16x16']]) {
      const tag = links.find((l) => atributo(l, 'rel') === 'icon' && atributo(l, 'href') === arq);
      assert.ok(tag, `${nome}: falta <link rel="icon" href="${arq}">`);
      assert.equal(atributo(tag, 'sizes'), sizes, `${nome}: ${arq} com sizes errado`);
      assert.equal(atributo(tag, 'type'), 'image/png', `${nome}: ${arq} sem type image/png`);
    }
    const apple = links.find((l) => atributo(l, 'rel') === 'apple-touch-icon');
    assert.ok(apple, `${nome}: sem <link rel="apple-touch-icon"> o iOS usa screenshot`);
    assert.equal(atributo(apple, 'href'), 'icons/apple-touch-icon.png', `${nome}: apple-touch-icon fora da marca nova`);

    // S3b (item 3): a tela é papel e carvão, então a barra do navegador
    // acompanha o tema. Antes havia um theme-color único — o azul-marinho que a
    // pessoa rejeitou — e quem carregava os dois por media era o metro.html, que
    // agora é só o redirecionamento. A cor da barra mora na página do app.
    const metas = tagsDe(html, 'meta').filter((m) => atributo(m, 'name') === 'theme-color');
    assert.equal(metas.length, 2, `${nome}: esperava DOIS theme-color (claro e escuro por media)`);
    const claro = metas.find((m) => /light/.test(atributo(m, 'media')));
    const escuro = metas.find((m) => /dark/.test(atributo(m, 'media')));
    assert.ok(claro, `${nome} sem theme-color de claro por media`);
    assert.ok(escuro, `${nome} sem theme-color de escuro por media`);
    assert.equal(atributo(claro, 'content'), PAPEL, `${nome}: theme-color de claro não é papel`);
    assert.equal(atributo(escuro, 'content'), CARVAO, `${nome}: theme-color de escuro não é carvão`);
  }
});

test('metro.html é só um redirecionamento', async () => {
  // S3b: quem guardou o endereço antigo (o post, o histórico, o QR) chega na
  // Jornada. Não é mais página: sem <script>, sem folha de estilo, sem marca —
  // só o refresh de 0 segundos e o link visível, que é o que sobra para quem o
  // navegador não obedece http-equiv. Continua no precache: offline também
  // precisa redirecionar, senão o endereço salvo vira tela em branco no ônibus.
  const html = await readFile(join(RAIZ, 'metro.html'), 'utf8');
  const metas = tagsDe(html, 'meta');
  const refresh = metas.find((m) => /http-equiv/i.test(m) && /refresh/i.test(atributo(m, 'http-equiv')));
  assert.ok(refresh, 'metro.html sem <meta http-equiv="refresh">');
  assert.equal(atributo(refresh, 'content'), '0; url=./#/', 'o refresh deve ir para ./#/ na hora (Jornada)');
  const link = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].find((m) => atributo(m[0], 'href') === './#/');
  assert.ok(link, 'metro.html sem link visível para ./#/');
  assert.ok(link[1].trim().length > 0, 'o link do redirecionamento está sem texto');
  assert.equal(/<script\b/.test(html), false, 'redirecionamento carregando lógica: ele não é mais tela');
  assert.equal(tagsDe(html, 'link').some((l) => /stylesheet/i.test(l)), false, 'redirecionamento carregando folha de estilo');
  assert.ok(listaDoSw(swTexto).includes('metro.html'), 'o redirecionamento saiu do offline');
});

test('marca: o precache leva os ícones e a marca', async () => {
  const lista = listaDoSw(swTexto);
  const esperados = [...MARCA.icones, MARCA.favicon, ...MARCA.topo];
  const faltando = esperados.filter((a) => !lista.includes(a));
  assert.deepEqual(faltando, [], `fora do offline: ${faltando.join(', ')} — no ônibus, a marca não carrega`);
  assert.equal(lista.includes('icons/icone.svg'), false, 'o ícone morto ainda puxa cache');
});

test('marca: o link do topo tem classe própria', async () => {
  // S2, item 6 da crítica: o link usava a classe `marca` — a MESMA classe do
  // cabeçalho que o metro.js desenha dentro do <main>. Ele herdava de lá a
  // borda de baixo e a margem, e era essa a linha curta sob o logo. A classe
  // do topo agora é `topo-marca`, e nenhuma página do app usa `class="marca"`.
  // S3b: o metro.html virou redirecionamento e não tem topo; o topo é do casco,
  // o index.html.
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');
  assert.ok(/<a class="topo-marca"/.test(html), 'o link do topo voltou a ser class="marca"');
  assert.equal(/\sclass="marca"/.test(html), false, 'ainda existe class="marca" no index.html');
  const css = await readFile(join(RAIZ, 'web/metro.css'), 'utf8');
  assert.ok(/\.topo-marca\s*\{/.test(css), 'o CSS não tem o bloco .topo-marca');
  assert.equal(/^\.topo \.marca\s*\{/m.test(css), false, 'a regra .topo .marca voltou');
});

test('PWA: fecha o servidor para a suite terminar', async () => {
  await stop();
  assert.ok(true);
});
