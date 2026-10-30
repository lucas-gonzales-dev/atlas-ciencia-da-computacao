// Projeto Atlas — os links dos documentos do repositorio apontam para algo que existe.
//
// Por que existe: README, CONTRIBUTING e CREDITS sao a vitrine — e o que quem cai
// no repositorio le primeiro, e o que o Lucas apresenta em publico. Um link
// quebrado ali falha CALADO: nenhum teste de codigo reclama porque um .md aponta
// para um arquivo que foi renomeado ou movido. Ate hoje isso so era conferido a
// olho, e olho nao confere 20 caminhos toda vez.
//
// O que conta como link: markdown [texto](alvo), ![alt](alvo) e <a href="alvo">
// dentro dos tres documentos. O que e conferido: so o alvo RELATIVO ao
// repositorio (arquivo ou pasta). Ficam de fora, de proposito:
//   - URL absoluta (http/https/mailto): conferir exigiria rede, e teste que
//     depende de rede e teste instavel — alem de o alvo nao ser deste repo;
//   - ancora pura (#secao): e navegacao interna do proprio GitHub, nao arquivo.
// Ancora no fim de um caminho relativo (CREDITS.md#secao) e cortada antes de
// conferir: o que existe ou nao existe e o arquivo.
//
// A assercao de sanidade (lista nao vazia) esta aqui pela mesma razao que o teste
// de contagem do README foi reescrito: regex que nao casa nada passa verde sem
// conferir nada, e verde vazio e pior que vermelho.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ_REPO = fileURLToPath(new URL('../../', import.meta.url));
const DOCS = ['README.md', 'CONTRIBUTING.md', 'CREDITS.md'];

const ABSOLUTO = /^(?:https?:|mailto:|#|\/\/)/i;

// Markdown e HTML dentro do markdown, nas duas formas que aparecem nos docs.
function alvos(texto) {
  // Casa pelo "])(", nao pelo rotulo: um selo envolto em link —
  // [![Testes](https://.../badge.svg)](LICENSE) — tem "]" dentro do rotulo, e
  // exigir rotulo sem colchete deixaria exatamente esse caso de fora. O alvo
  // relativo mais importante do README (o que aponta para o LICENSE) seria o
  // unico nao conferido. Provado por mutacao: com a regex de rotulo, tirar o
  // arquivo LICENSE do disco nao reprovava nada.
  const md = [...texto.matchAll(/\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)].map((m) => m[1]);
  const html = [...texto.matchAll(/href\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  return [...md, ...html];
}

function semAncora(alvo) {
  return alvo.split('#')[0].split('?')[0];
}

function relativos(texto) {
  return alvos(texto)
    .map(semAncora)
    .filter((a) => a.length > 0 && !ABSOLUTO.test(a));
}

for (const doc of DOCS) {
  test(`${doc}: todo link relativo aponta para um arquivo que existe`, async () => {
    const caminhoDoc = join(RAIZ_REPO, doc);
    assert.ok(existsSync(caminhoDoc), `o documento ${doc} sumiu do repositorio`);
    const texto = await readFile(caminhoDoc, 'utf8');

    const lista = relativos(texto);
    assert.ok(lista.length > 0,
      `sanidade: nenhum link relativo foi encontrado em ${doc} — ou o documento mudou de forma, ou a regex parou de casar; verde assim nao confere nada`);

    const pastaDoDoc = dirname(caminhoDoc);
    const quebrados = lista.filter((a) => !existsSync(resolve(pastaDoDoc, a)));
    assert.deepEqual(
      quebrados,
      [],
      `${doc} aponta para caminho que nao existe no repositorio: ${quebrados.join(', ')}`
    );
  });
}

// ─── PEDIDO 21, FATIA 2b-2 (item 6 da critica do Claude, 29/10/2026) ───
// A mesma regra acima, aplicada ao APP. Por que separado: um href relativo num
// .html e um caminho no array do service worker quebram CALADOS tambem, e do
// pior jeito — o navegador abre, o 404 aparece so na segunda visita (o cache
// antigo some do precache) e o teste de codigo nao olha para la. Aqui o app
// inteiro e varrido: todo href relativo de .html e todo caminho relativo do
// sw.js tem de existir em app/. URL absoluta fica de fora de proposito, pela
// mesma razao de cima — teste que depende de rede e teste instavel.
const PASTA_APP = fileURLToPath(new URL('../', import.meta.url));
const ABSOLUTO_APP = /^(?:https?:|mailto:|data:|#|\/\/|\/)/i;

function hrefsDeHtml(texto) {
  return [...texto.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
}

function caminhosDoSw(texto) {
  // O precache do sw.js e uma lista de caminhos relativos ao raiz do app
  // (BASE). Pegar tudo o que parece string de caminho e mais honesto do que
  // casar pelo nome da constante: se PRECACHE for renomeada, a varredura
  // continua valendo, e o que escapa e o oposto do que este teste quer.
  return [...texto.matchAll(/['"]((?:\.\/)?[\w][\w./-]*\.(?:html|js|css|webmanifest|svg|woff2|png|json))['"]/g)]
    .map((m) => m[1]);
}

test('app: todo href relativo de .html aponta para arquivo que existe em app/', () => {
  const htmls = ['index.html', 'metro.html'];
  let conferidos = 0;
  for (const nome of htmls) {
    const caminho = join(PASTA_APP, nome);
    assert.ok(existsSync(caminho), `${nome} sumiu de app/`);
    const alvos = hrefsDeHtml(readFileSync(caminho, 'utf8'))
      .map((a) => semAncora(a))
      .filter((a) => a.length > 0 && !ABSOLUTO_APP.test(a));
    assert.ok(alvos.length > 0, `sanidade: nenhum href relativo em ${nome} — verde vazio nao confere nada`);
    const quebrados = alvos.filter((a) => !existsSync(resolve(PASTA_APP, a)));
    assert.deepEqual(quebrados, [], `${nome} aponta para arquivo que nao existe em app/: ${quebrados.join(', ')}`);
    conferidos += alvos.length;
  }
  assert.ok(conferidos >= 10, `sanidade: so ${conferidos} hrefs conferidos, a varredura encolheu`);
});

test('app: todo caminho relativo do sw.js existe em app/ (precache sem 404)', () => {
  const texto = readFileSync(join(PASTA_APP, 'sw.js'), 'utf8');
  const alvos = caminhosDoSw(texto).map((a) => a.replace(/^\.\//, ''));
  assert.ok(alvos.length > 0, 'sanidade: nenhum caminho de arquivo no sw.js — a regex parou de casar');
  const quebrados = [...new Set(alvos)].filter((a) => !existsSync(resolve(PASTA_APP, a)));
  assert.deepEqual(quebrados, [], `o service worker pre-cacheia caminho que nao existe: ${quebrados.join(', ')}`);
});

// O README e a porta de entrada: se ele perder os ponteiros para os outros dois
// documentos, quem chega nao acha nem o credito da fonte nem como contribuir.
test('README aponta para CONTRIBUTING.md e CREDITS.md', async () => {
  const texto = await readFile(join(RAIZ_REPO, 'README.md'), 'utf8');
  for (const doc of ['CONTRIBUTING.md', 'CREDITS.md', 'LICENSE']) {
    assert.match(texto, new RegExp(`\\]\\(\\s*<?${doc.replace('.', '\\.')}\\b`),
      `o README precisa ter um link relativo para ${doc}, e nao so citar o nome`);
  }
});
