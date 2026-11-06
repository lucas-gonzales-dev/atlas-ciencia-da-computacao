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

import { criarDoc, comClasse } from './hdom.js';
import { desenharCartao, viagemDoCartao } from '../web/cartao.js';

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
  assert.match(pagina, /<div class="cartao-rede" id="rede">/, 'sem o contêiner do mapa o cartão sai só com a moldura');
  assert.match(pagina, /web\/cartao\.js\?v=\d+/, 'o script do cartão entra sem versão: o navegador de quem fotografa pode responder de casa');
});

test('vitrine: o cartão monta a REDE inteira — 35 estações no mapa, 9 concluídas, e nenhuma delas é texto de tela', () => {
  const catalogo = JSON.parse(ler('data/catalog.json')).courses;
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const svg = desenharCartao(doc, raiz, catalogo);
  assert.ok(typeof svg === 'string' && svg !== '', 'desenharCartao não devolveu SVG: o cartão sai só com a moldura');

  // Os números do cartão são os do mapaDaRede, contados na árvore montada — não
  // numa string que alguém escreveu. Uma letra a mais no seletor e a contagem
  // muda: é o que a prova desta fatia aperta.
  const estações = comClasse(raiz, /^mapa-estacao$/);
  assert.equal(estações.length, 35, `o mapa do cartão tem ${estações.length} estações, não 35: saiu do catálogo ou saiu pela metade`);
  const concluídas = estações.filter((n) => n.getAttribute('data-estado') === 'concluida');
  assert.equal(concluídas.length, 9, `${concluídas.length} concluídas: a Linha 1 inteira (5) mais as quatro fora dela que o cartão declara abertas`);

  const linhas = new Set(concluídas.map((n) => catalogo.find((c) => c.id === n.getAttribute('data-id'))?.stage));
  assert.ok(linhas.size >= 2, `as estações concluídas do cartão ficam todas numa linha só (${[...linhas]}): o cartão voltaria a ser a foto de uma tela do app, e a ideia é a rede`);

  assert.match(svg, /class="mapa-rede"/, 'sem a classe do mapaDaRede o cartão é outro desenho');
  assert.match(svg, /aria-label="Mapa da rede: 9 de 35 estações concluídas"/, 'o aria-label é o que o leitor de tela lê do cartão inteiro');
});

test('vitrine: o título do cartão são três linhas, o apoio duas e o endereço uma, no HTML e não no mapa', () => {
  const pagina = ler('cartao.html');
  const titulo = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(pagina)?.[1] ?? '';
  assert.deepEqual(
    titulo.split(/<br\/?>/).map((s) => s.trim()),
    ['Ciência da', 'Computação', 'em linhas de metrô'],
    `o título do cartão não quebra nas três linhas do cartaz: ${titulo}`
  );
  const apoio = /<p class="cartao-apoio">([\s\S]*?)<\/p>/.exec(pagina)?.[1] ?? '';
  assert.equal(apoio.split(/<br\/?>/).length, 2, 'o apoio do cartão não são duas linhas');
  assert.match(apoio, /As 35 disciplinas da grade aberta da UBL\./, 'a primeira linha do apoio diz o que o Atlas é');
  assert.match(pagina, /<p class="cartao-endereco">atlas-ciencia-da-computacao\.pages\.dev<\/p>/, 'o endereço do cartão não é uma linha só, sem http');
});

test('vitrine: o cartão é cartaz, não tela: nenhum botão, nenhuma placa e nenhum número de contador', () => {
  const pagina = ler('cartao.html');
  assert.ok(!/<button\b/i.test(pagina), 'um <button> no cartão: é um alvo de toque dentro de um PNG, e na foto de 1200×630 ele sai cortado');
  assert.ok(!/class="[^"]*\bplaca\b/i.test(pagina), 'a placa da Jornada no cartão: o cartão tem o próprio título');
  // O teste é CODE, não prosa: cartao.html e cartao.js CONTAM o nome antigo no
  // comentário, para explicar por que ele saiu. O que não pode voltar é o
  // caminho de código — o import do metro.js e o contêiner que ele desenhava.
  const js = ler('web/cartao.js');
  assert.ok(!/from '\.\.?\/web\/metro\.js'/.test(js), 'cartao.js voltou a importar o metro.js: o cartão desenharia UMA linha e nenhuma rede (S11a, medido no PNG)');
  assert.ok(!/id="metro"/.test(pagina), 'o contêiner da Jornada voltou ao cartão');
  assert.ok(!/class="[^"]*\bnumeros\b/.test(pagina), 'os números da tela dentro do cartão: um contador é frase de interface, não cartaz');
  // Nada de frase de interface: o cartão não pede nada a ninguém.
  assert.ok(!/aria-label="Abrir|aria-haspopup/.test(pagina), 'o cartão anunciou uma ação que não existe dentro dele');

  const css = ler('web/cartao.css');
  assert.ok(!/#\s?[0-9a-f]{3,8}\b/i.test(css), 'cor escrita à mão no web/cartao.css: a lista do proibido (§9) não faz exceção para página de fotografia');
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
  // Nove, não "pelo menos cinco": a Linha 1 inteira (5) + as quatro nomeadas na
  // composição. O número da foto e o número da trava são o mesmo número.
  assert.equal(v.completed.length, 9, `o cartão conclui ${v.completed.length} estações, não 9`);
});

test('vitrine: o cartão desenha a REDE — os sete selos, as baldeações e as estações pelo nome', () => {
  const catalogo = JSON.parse(ler('data/catalog.json')).courses;
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const svg = desenharCartao(doc, raiz, catalogo);

  // Sete selos: as sete linhas da fonte. Uma linha só desenhada era o defeito
  // da S11a, e ele não aparece em nenhuma contagem de estações.
  assert.equal(comClasse(raiz, /^mapa-selo$/).length, 7, 'o cartão não mostra as sete linhas: virou foto de uma linha só');
  assert.ok(comClasse(raiz, /^mapa-baldeacao$/).length >= 20, 'sem baldeações desenhadas o cartão é uma lista de pontos, não uma rede');

  // Os nomes que a composição declara abertos têm de estar na foto. Se um deles
  // sumir do catálogo, a viagem sai menor e o cartão mente sobre si mesmo.
  const nomes = [...svg.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  for (const nome of ['Estruturas de Dados', 'Álgebra Linear I', 'Cálculo I', 'Programação Funcional em Haskell']) {
    assert.ok(nomes.includes(nome), `«${nome}» não está no mapa do cartão: o catálogo trocou o nome e a foto continua dizendo que ele abre`);
  }
  const uma = catalogo.filter((c) => Number(c.stage) === 1).map((c) => c.title);
  assert.ok(uma.every((t) => nomes.includes(t)), 'sumiu uma estação da Linha 1: a linha percorrida não está inteira no cartão');
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
