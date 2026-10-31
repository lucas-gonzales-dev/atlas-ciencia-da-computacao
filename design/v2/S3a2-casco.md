# S3a-2 — o casco: topo, abas, anúncio, foco e as duas telas montadas

**Objetivo.** O `index.html` vira o **casco** do app: o topo com a marca, as abas, o "Pular
para o conteúdo", o anúncio para o leitor de tela e as rotas por hash. Duas telas entram:
**Jornada** (a tela do metrô de hoje) e **Explorar** (a grade antiga, ainda com o visual
antigo, que morre na S3b). Revisar e Perfil entram nas S8 e S9.

**O que a S3a-1 já deixou pronto** (não refaça): `core/rotas.js` (`ABAS`, `lerRota`,
`hrefDe`) com `tests/rotas.test.js`; a seção `casco` do `textos.js`; o `web/grade.css`
escopado em `.grade`; e o `boot.js` exportando `montarGrade({ raiz, slotBusca, catalogo })`
e `registrarSW`, ainda subindo sozinho pelo `export const inicio`.

## Arquivos
Novos: `app/web/casco.js`, `app/web/casco.css`, `app/web/telas/jornada.js`,
`app/web/telas/explorar.js`.
Mudam: `app/index.html` (reescrito), `app/web/boot.js` (deixa de subir sozinho),
`app/sw.js`, e os testes que procuravam `#app` ou `boot.js` no `index.html` (`pages`,
`boot`, `pwa`, `fonte-nome`; ache-os com `buscar_arquivos`).
Não mudam: `metro.html` (segue de pé até a S3b), `web/metro.js` (o `subirMetro` já aceita
`deps.root`), `core/rotas.js`, `web/grade.css`.

## Testes primeiro
**Testes de página** (onde hoje se testa o `index.html`, em `tests/pages.test.js`):
1. O primeiro elemento focável do `<body>` é `<a class="pular" href="#conteudo">`.
2. Há um `<main id="conteudo" tabindex="-1">`, **um** `<nav aria-label="Principal">` com um
   link por aba de `ABAS` (o `href` e o rótulo batendo com `core/rotas.js`), e um
   `<p id="anuncio" class="so-leitor" aria-live="polite">`.
3. O `index.html` não tem `<style>` nem código inline: só `<link>` e o
   `<script type="module" src="./web/casco.js">`.
4. `boot.js` não sobe sozinho: importá-lo num documento sem `#app` não lança e não chama
   `loadCatalog` (o `inicio` sai).
5. `web/telas/jornada.js` e `web/telas/explorar.js` exportam `montar`.

## Implementação
**`index.html`** (o `<head>` mantém o que a S1 deixou; carregue `tokens.css`, `fontes.css`,
`base.css`, `casco.css`, `metro.css` e `grade.css`, nessa ordem):
```html
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <a class="topo-marca" href="#/" aria-label="Atlas, início"> (o mesmo miolo da S1) </a>
  <nav class="abas" aria-label="Principal">
    <a href="#/" data-tela="jornada"><svg …></svg><span>Jornada</span></a>
    <a href="#/explorar" data-tela="explorar"><svg …></svg><span>Explorar</span></a>
  </nav>
</header>
<main id="conteudo" tabindex="-1"></main>
<p id="anuncio" class="so-leitor" aria-live="polite"></p>
<script type="module" src="./web/casco.js"></script>
</body>
```
Os ícones das abas são desenho próprio, em SVG de linha, `aria-hidden="true"`,
`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`,
`stroke-linecap="round"`:
- Jornada (um trecho de linha com 3 estações): `<path d="M4 12h16"/>` e três
  `<circle cy="12" r="2.5" fill="currentColor"/>` em `cx` 5, 12 e 19;
- Explorar (lupa): `<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>`;
- Revisar (S8; seta que volta): `<path d="M5 12a7 7 0 1 0 2-5"/><path d="M5 4v4h4"/>`;
- Perfil (S9; bilhete): `<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M14 7v10" stroke-dasharray="2 2"/>`.

**`web/casco.js`**:
- carrega o catálogo **uma vez** (`loadCatalog` do `main.js`, guardado numa promessa) e
  passa adiante;
- registra o service worker (o `registrarSW` que hoje mora no `boot.js`, exportado de lá);
- a cada rota: esvazia o `main`, monta a tela (`montar(raiz, ctx)` de `web/telas/<tela>.js`;
  se a tela anterior devolveu `desmontar`, chame antes), põe `aria-current="page"` só na aba
  da tela, muda o `document.title` para `"<Rótulo> · Atlas"`, escreve o anúncio
  (`textos.casco.anuncio(rotulo)` → `"Você está em <Rótulo>."`), rola para o topo e põe o
  foco no primeiro `h1` da tela (com `tabindex="-1"`) ou, sem `h1`, no `main`. **Na primeira
  pintura não move o foco nem anuncia**: quem abriu o app não pediu para ser levado;
- rota `null` (âncora comum) é ignorada; rota desconhecida troca o hash por `#/` com
  `history.replaceState` e monta a Jornada;
- a tela que entra ganha a classe `tela-entra` (animação abaixo).

**`web/telas/jornada.js`**: `montar(raiz, ctx)` chama `subirMetro({ root: raiz, modulos })`,
com `modulos` sendo os do `main.js` e o `loadCatalog` trocado pela promessa do casco.
**`web/telas/explorar.js`**: `montar(raiz, ctx)` cria, dentro da raiz,
`<div class="grade"><div id="busca-slot" class="busca-slot" hidden></div><div id="app" class="app"></div></div>`
e chama `montarGrade({ raiz: <o #app>, slotBusca: <o #busca-slot>, catalogo: await ctx.catalogo })`,
exportado do `boot.js`. O `boot.js` **deixa de subir sozinho ao ser importado**: tire o
`subir()` e o `export const inicio`. O `#app` não tem `aria-live` (o anúncio agora é do
casco: uma região viva do tamanho da página anunciaria tudo).

**`web/casco.css`**:
```css
.pular { position: absolute; left: var(--espaco-4); top: calc(-1 * var(--alvo-toque) * 2); }
.pular:focus { top: var(--espaco-2); background: var(--superficie); color: var(--tinta);
               padding: var(--espaco-3) var(--espaco-4); border-radius: var(--raio-placa); z-index: 3; }
.topo { position: sticky; top: 0; z-index: 2; background: var(--fundo);
        border-bottom: 1px solid var(--borda); justify-content: space-between; }
.abas a { display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--espaco-1); min-height: var(--alvo-toque); padding: 0 var(--espaco-3);
          color: var(--fosca); text-decoration: none; font-size: var(--tipo-nota);
          font-weight: var(--peso-forte);
          transition: color var(--movimento-selecao) var(--curva-atlas); }
.abas a svg { width: 22px; height: 22px; }
.abas a[aria-current="page"] { color: var(--tinta); font-weight: var(--peso-placa);
                               box-shadow: inset 0 3px 0 var(--tinta); }
/* celular e tablet: a barra embaixo, com o respiro do aparelho */
@media (max-width: <--bp-computador menos 1>) {
  .abas { position: fixed; left: 0; right: 0; bottom: 0; display: grid;
          grid-auto-flow: column; grid-auto-columns: 1fr; background: var(--fundo);
          border-top: 1px solid var(--borda); padding-bottom: var(--margem-segura-baixo); }
  main { padding-bottom: calc(var(--alvo-toque) + var(--espaco-6) + var(--margem-segura-baixo)); }
}
/* computador: as abas no topo, em linha */
@media (min-width: <--bp-computador>) { .abas { display: flex; gap: var(--espaco-2); }
  .abas a { flex-direction: row; font-size: var(--tipo-corpo); } }
.tela-entra { animation: entrar var(--movimento-abrir) var(--curva-atlas) both; }
@keyframes entrar { from { opacity: 0; transform: translateY(var(--deslocamento-entrada)); }
                    to { opacity: 1; transform: none; } }
```
Os números das `@media` são os que a trava aceita (os `--bp-*` do `tokens.css`; confira a
regra em `tests/design-system.test.js`, teste "largura"). O `box-shadow` da aba ativa é
uma barra de 3 px, não sombra: se a trava de sombra acusar, troque por
`border-top: 3px solid` com `padding` compensado.

**Textos**: os do casco já estão em `core/textos.js` (seção `casco`, da S3a-1). O HTML pode
repetir os rótulos estáticos, porque o teste 2 confere que batem com `ABAS`.

**`sw.js`**: os 4 arquivos novos no precache (`casco.js`, `casco.css`, `telas/jornada.js`,
`telas/explorar.js`); `VERSAO` sobe 1 e `PRECACHE_HASH` acompanha.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Explorar"; esperar 500; clicar "Jornada";
esperar 500. Confira nos 4 tamanhos: zero erro; depois de "Explorar", o texto da grade
antiga (por exemplo "Cálculo I") aparece; depois de "Jornada", "Sua próxima estação"
aparece; no celular, as abas estão embaixo e não cobrem o último item da tela.
