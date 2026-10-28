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
import { existsSync } from 'node:fs';
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

// O README e a porta de entrada: se ele perder os ponteiros para os outros dois
// documentos, quem chega nao acha nem o credito da fonte nem como contribuir.
test('README aponta para CONTRIBUTING.md e CREDITS.md', async () => {
  const texto = await readFile(join(RAIZ_REPO, 'README.md'), 'utf8');
  for (const doc of ['CONTRIBUTING.md', 'CREDITS.md', 'LICENSE']) {
    assert.match(texto, new RegExp(`\\]\\(\\s*<?${doc.replace('.', '\\.')}\\b`),
      `o README precisa ter um link relativo para ${doc}, e nao so citar o nome`);
  }
});
