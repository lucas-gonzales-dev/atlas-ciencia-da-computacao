// Projeto Atlas — a trava da VITRINE (S11a, 03/11/2026).
//
// POR QUE EXISTE: o Atlas vai ser postado no LinkedIn, e a única coisa que a
// maioria das pessoas vê antes de clicar é o CARTÃO. Nada aqui dentro era
// conferido por nada: as tags og: podiam estar vazias, o og:image podia apontar
// para um arquivo que não existe, e o PNG podia sair 1199×630 ou 4 MB. A
// primeira versão do cartao.html desenhava o mapa com a viagem zerada ("0 de
// 35") porque os ids foram escritos à mão em vez de derivados do catálogo, e
// nenhuma trava do repositório dizia isso. Um cartão errado publicado é pior
// que nenhum cartão: é a primeira impressão errada.
//
// O QUE É MEDIDO AQUI, SEM NAVEGADOR:
//   1. as dez tags existem no index.html e nenhuma está vazia;
//   2. og:image é o endereço absoluto da IMAGEM que existe em app/, e o PNG é
//      1200×630 lido do cabeçalho IHDR — não do que alguém escreveu num README;
//   3. og:url é o MESMO endereço do README: se um dos dois mudar de nome no
//      Cloudflare Pages, a outra metade do cartão fica mentindo;
//   4. a página do cartão está FORA do precache e é noindex: ela é matéria-
//      prima de fotografia, não uma tela do app;
//   5. o desenho: a viagem do cartão é derivada do catálogo real, tem estações
//      concluídas EM DUAS LINHAS e uma em curso, e o mapa montado no mini-DOM
//      mostra os números — prova de que o cartão não nasce zerado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarDoc, textoDe } from './hdom.js';
import { desenharCartao, viagemDoCartao } from '../web/cartao.js';
import { estacoesDaLinha } from '../web/metro.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)); // app/
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const ler = (rel) => readFileSync(join(RAIZ, rel), 'utf8');
const HTML = ler('index.html');
const ENDERECO = 'https://atlas-ciencia-da-computacao.pages.dev/';

/** Toda `<meta>` do documento, por `property` ou `name`, com o `content`. */
function metas(texto) {
  const saida = new Map();
  for (const m of texto.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const chave = /(?:property|name)\s*=\s*"([^"]+)"/.exec(tag)?.[1];
    if (!chave) continue;
    const valor = /content\s*=\s*"([^"]*)"/.exec(tag)?.[1];
    saida.set(chave, valor ?? '');
  }
  return saida;
}

const EXIGIDAS = [
  'og:title',
  'og:description',
  'og:type',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'og:locale',
  'twitter:card'
];

test('vitrine: as dez tags do cartão existem no index.html e nenhuma está vazia', () => {
  const m = metas(HTML);
  const ausentes = EXIGIDAS.filter((p) => !m.has(p));
  assert.deepEqual(ausentes, [], 'tag de compartilhamento ausente: um link postado sai mutilado');
  const vazias = EXIGIDAS.filter((p) => m.get(p).trim() === '');
  assert.deepEqual(vazias, [], 'tag presente mas VAZIA: o LinkedIn mostra a moldura sem conteúdo');
  assert.equal(m.get('og:type'), 'website', 'og:type: o Atlas é um site, não um artigo');
  assert.equal(m.get('og:locale'), 'pt_BR', 'og:locale: o cartão é brasileiro');
  assert.equal(m.get('twitter:card'), 'summary_large_image', 'twitter:card pequeno corta o mapa ao meio');
});

test('vitrine: og:image é absoluto, aponta para um arquivo que existe em app/ e bate com as dimensões declaradas', () => {
  const m = metas(HTML);
  const imagem = m.get('og:image');
  assert.ok(typeof imagem === 'string' && imagem !== '', 'og:image: a tag nao existe no index.html, entao o post sai sem imagem');
  assert.ok(imagem.startsWith('https://'), `og:image precisa de endereço absoluto (${imagem}): quem compartilha resolve a URL contra o post, não contra o site`);
  assert.ok(imagem.startsWith(ENDERECO), `og:image fora do endereço do site (${imagem}): o cartão apontaria para outra casa`);
  const rel = imagem.slice(ENDERECO.length);
  assert.ok(rel.length > 0 && !rel.includes('/..'), `caminho esquisito em og:image: ${rel}`);
  assert.ok(existsSync(join(RAIZ, rel)), `og:image aponta para ${rel}, que não existe em app/ — o cartão sai em branco`);

  const medido = dimensoes(join(RAIZ, rel));
  assert.equal(m.get('og:image:width'), String(medido.largura), 'og:image:width não é a largura real do PNG');
  assert.equal(m.get('og:image:height'), String(medido.altura), 'og:image:height não é a altura real do PNG');
  assert.ok(m.get('og:image:alt').length > 20, 'og:image:alt é o que o leitor de tela lê do cartão');
});

test('vitrine: o PNG é 1200×630, lido do cabeçalho IHDR, e pesa menos de 1 MB', () => {
  const d = dimensoes(join(RAIZ, 'marca', 'cartao.png'));
  assert.equal(d.largura, 1200, `largura ${d.largura}: a proporção do og: do LinkedIn é 1.91:1`);
  assert.equal(d.altura, 630, `altura ${d.altura}: 1200×630 é o tamanho que o LinkedIn pede`);
  assert.ok(d.bytes < 1024 * 1024, `${Math.round(d.bytes / 1024)} KB: um cartão gordo demora a carregar no feed`);
});

test('vitrine: og:url é o mesmo endereço do README', () => {
  const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
  assert.ok(
    readme.includes(ENDERECO),
    'o README perdeu o endereço do app: é dele que se tira o og:url'
  );
  assert.equal(metas(HTML).get('og:url'), ENDERECO, 'og:url difere do endereço publicado');
  assert.ok(metas(HTML).get('og:title').includes('metrô'), 'o título do cartão é a ideia do app');
});

test('vitrine: a página do cartão está fora do precache e é noindex', () => {
  const sw = ler('sw.js');
  const bloco = sw.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(bloco, 'sw.js sem array PRECACHE explícito');
  const precached = [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const nome of ['cartao.html', 'web/cartao.js', 'web/cartao.css', 'marca/cartao.png']) {
    assert.ok(!precached.includes(nome), `${nome} entrou no precache: é matéria-prima de fotografia, não tela do app — custaria cache a quem roda em 3G`);
  }

  const pagina = ler('cartao.html');
  assert.match(pagina, /<meta\s+name="robots"\s+content="noindex/, 'o cartão indexável viraria página de resultado de busca');
  assert.ok(!/serviceWorker/.test(pagina), 'a página do cartão registra service worker: ela não é o app');
  assert.match(pagina, /<div id="metro">/, 'sem o contêiner do mapa o cartão sai só com a moldura');
});

test('vitrine: a viagem do cartão é DERIVADA do catálogo e tem progresso em duas linhas', () => {
  const catalogo = JSON.parse(ler('data/catalog.json')).courses;
  const ids = new Set(catalogo.map((c) => c.id));
  const v = viagemDoCartao(catalogo);

  const inventados = [...v.completed, ...v.emCurso].filter((i) => !ids.has(i));
  assert.deepEqual(inventados, [], 'a viagem do cartão tem id que não existe no catálogo: o mapa sai zerado e ninguém vê');

  const linhasComProgresso = new Set(
    [...v.completed, ...v.emCurso]
      .map((i) => catalogo.find((c) => c.id === i))
      .filter(Boolean)
      .map((c) => Number(c.stage))
  );
  assert.ok(linhasComProgresso.size >= 2, `o cartão mostra uma viagem parada em uma linha só: ${[...linhasComProgresso].join(', ')}`);
  assert.ok(v.completed.length >= 5, 'menos de cinco estações concluídas não conta história no cartão');
  assert.equal(v.emCurso.length, 1, 'uma estação em curso é o que faz o mapa parecer vivo');
});

test('vitrine: o mapa montado mostra os números, não o vazio', () => {
  const catalogo = JSON.parse(ler('data/catalog.json')).courses;
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  desenharCartao(doc, raiz, catalogo);
  const texto = textoDe(raiz);

  assert.match(texto, /\d+\/35/, 'o cartão não mostra estações concluídas: voltou o defeito do id inventado');
  assert.doesNotMatch(texto, /(^|[^\d])0\/35/, '"0/35" no cartão: parece que ninguém nunca abriu o app');
  assert.match(texto, /em curso/, 'sem estação em curso o mapa conta uma viagem terminada');
  const uma = estacoesDaLinha(catalogo, 1).map((c) => c.title);
  assert.ok(uma.some((t) => texto.includes(t)), 'nenhuma estação da Linha 1 aparece: a linha percorrida sumiu do desenho');
});

/**
 * Cabeçalho IHDR, sem dependência: assinatura PNG (8 bytes) + length+tipo (8) +
 * largura e altura em 4 bytes big-endian cada. Medir o arquivo em vez de
 * confiar no que o script disse que gravou é o que pega a captura errada.
 */
function dimensoes(caminho) {
  const b = readFileSync(caminho);
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${caminho} não é PNG`);
  assert.equal(b.subarray(12, 16).toString('ascii'), 'IHDR', 'PNG sem cabeçalho IHDR');
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), bytes: b.length };
}
