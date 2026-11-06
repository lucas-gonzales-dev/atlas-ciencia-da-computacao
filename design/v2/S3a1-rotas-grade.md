# S3a-1 — as rotas e a grade fora do index.html

**Objetivo.** Preparar o casco sem trocar a tela ainda. Três peças que não mudam o que a
pessoa vê: as **rotas por hash** (puras), os **textos do casco**, e o `<style>` inline do
`index.html` saindo para `web/grade.css`, **escopado** em `.grade`. O `boot.js` passa a
**exportar** a montagem da grade, mas continua subindo sozinho (quem desliga isso é a S3a-2).
Ao fim desta fatia o `index.html` abre igual a hoje.

(A S3a original foi dividida em duas pelo juiz em 31/10: S1 e S2 já encostaram no teto de um
turno, e a S3a inteira é maior que as duas.)

## Arquivos
Novos: `app/core/rotas.js`, `app/tests/rotas.test.js`, `app/web/grade.css`.
Mudam: `app/index.html` (o `<style>` sai; o corpo ganha o invólucro `.grade`),
`app/web/boot.js` (exporta `montarGrade` e `registrarSW`), `app/core/textos.js` (seção
`casco`), `app/tests/design-system.test.js` (só o texto do `todo` da paleta, abaixo),
`app/sw.js`, `app/package.json` (o teste novo na lista do `"test"`).
Não mudam: `metro.html`, `web/metro.js`, `web/main.js`.

## Testes primeiro
**`tests/rotas.test.js`** (novo; **ponha na lista do `"test"`** do `package.json`), para
`core/rotas.js`:
1. `''`, `'#'` e `'#/'` dão `{ tela: 'jornada' }`; `'#/explorar'` dá `{ tela: 'explorar' }`.
2. `'#/estacao/calculo-i'` dá `{ tela: 'estacao', slug: 'calculo-i' }` (a S5 usa).
3. Âncora que não começa por `#/` (`'#conteudo'`, o "Pular para o conteúdo") dá `null`: **não
   é rota**. Sem isso, o link de pular trocaria de tela e perderia o foco.
4. Rota desconhecida (`'#/xyz'`) dá `{ tela: 'jornada', desconhecida: true }`.
5. `hrefDe({ tela: 'explorar' })` é `'#/explorar'`, e `lerRota(hrefDe(r))` devolve `r` para
   as telas de `ABAS`.
6. `ABAS` tem exatamente Jornada e Explorar, nessa ordem, cada uma com `tela`, `rotulo` e
   `href`, e o `rotulo` de cada uma é o de `casco.abas` do `textos.js`.

**Em `tests/boot.test.js`** (acrescente; não reescreva os que existem):
7. `boot.js` exporta `montarGrade` e `registrarSW` como funções.
8. O `index.html` não tem `<style>` nenhum, e carrega `./web/grade.css` com `<link>`.
9. Todo seletor de `web/grade.css` começa por `.grade` (leia o arquivo como texto e confira
   cada seletor antes de `{`, fora de `@media`/`@keyframes`). Sem o escopo, o azul-marinho da
   grade vazaria para o casco da S3a-2.

## Implementação
**`core/rotas.js`** (puro, sem DOM):
```js
import { casco } from './textos.js';
export const ABAS = [
  { tela: 'jornada',  rotulo: casco.abas.jornada,  href: '#/' },
  { tela: 'explorar', rotulo: casco.abas.explorar, href: '#/explorar' },
];
export function lerRota(hash) { … }   // as regras dos testes 1 a 4
export function hrefDe(rota) { … }    // jornada → '#/', explorar → '#/explorar', estacao → '#/estacao/<slug>'
```
**`core/textos.js`**: `export const casco = { … }` (as outras seções são exports com nome,
como `placa` e `estados`), e `casco` entra também no objeto `TEXTOS` do fim do arquivo: `pular: 'Pular para o conteúdo'`,
`navegacao: 'Principal'`, `anuncio: (rotulo) => \`Você está em ${rotulo}.\``,
`abas: { jornada: 'Jornada', explorar: 'Explorar' }`.

**`web/grade.css`**: o conteúdo inteiro do `<style>` do `index.html` (linhas 20 a 185 hoje),
com **todo seletor prefixado por `.grade `**; as regras que eram de `html` e de `body` passam
a valer para `.grade` (ex.: `body { … }` vira `.grade { … }`; `html, body { … }` vira
`.grade { … }`). Os `var(--p-*)` ficam como estão: quem os troca é a S3b.

**`index.html`**: tire o `<style>…</style>`; no `<head>`, depois de `fontes.css`, ponha
`<link rel="stylesheet" href="./web/grade.css">`. No `<body>`, envolva o `#busca-slot` e o
`<main id="app">` num `<div class="grade">`. O resto fica como está (o
`<script type="module" src="./web/boot.js">` continua).

**`web/boot.js`**: o corpo do `subir()` vira
`export async function montarGrade({ raiz, slotBusca, catalogo })`, que usa a `raiz` no lugar
de `document.getElementById('app')` e o `slotBusca` no lugar de
`document.getElementById('busca-slot')`, e recebe o catálogo pronto (`catalogo`, o resultado
de `loadCatalog()`) em vez de chamá-lo. O `subir()` passa a ser só:
```js
async function subir() {
  const raiz = document.getElementById('app');
  const r = await montarGrade({ raiz, slotBusca: document.getElementById('busca-slot'), catalogo: await loadCatalog() });
  const sw = await registrarSW(globalThis.window ?? globalThis, aviso);
  return { ...r, sw };
}
```
e o `export const inicio = subir().catch(…)` **continua** (a S3a-2 o tira). O `registrarSW`
já é exportado; confirme. O `state`, o `paint`, o `aviso` e o `toggle` passam a ler a `raiz`
guardada pelo `montarGrade` (uma variável do módulo atribuída nele), não o `getElementById`
do topo.

**`tests/design-system.test.js`**: só o texto do `todo` da paleta, de "no index.html" para
"no web/grade.css" (a contagem de usos continua 31; o teste lista onde estão). A função `daTela()`
dele já lê todo `.css` de `app/`, então a grade continua vigiada pela trava de cor.

**`sw.js`**: `core/rotas.js` e `web/grade.css` no precache; `VERSAO` sobe 1 e o
`PRECACHE_HASH` acompanha (a falha de `node --test tests/sw-precache-hash.test.js` mostra o
valor novo).

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; digitar "calculo" em "Buscar disciplina"; esperar 300. Confira
nos 4 tamanhos: zero erro; a página igual à de antes desta fatia (o azul-marinho da grade, a
lista com "Cálculo I"); depois de digitar, "Cálculo I" visível.
