# S1 — a marca definitiva no ícone, no favicon, no manifesto e no topo

**Objetivo.** O Atlas passa a usar o logo definitivo (livro aberto azul e coral, sol coral,
cúpula preta com estrela lima, a palavra "atlas"). O ícone azul-marinho (`icons/icone.svg`)
morre.

## Já pronto: não edite nem regenere
Gerados por `design/marca/gerar-marca.py` a partir de `design/marca/atlas-logo.png`:

| arquivo | tamanho | uso |
|---|---|---|
| `app/icons/icone-192.png` | 192 × 192 | manifesto, `purpose: any` |
| `app/icons/icone-512.png` | 512 × 512 | manifesto, `purpose: any` |
| `app/icons/icone-maskable-512.png` | 512 × 512 | manifesto, `purpose: maskable` |
| `app/icons/apple-touch-icon.png` | 180 × 180 | `<link rel="apple-touch-icon">` |
| `app/icons/favicon-32.png`, `favicon-16.png` | 32, 16 | `<link rel="icon">` |
| `app/favicon.ico` | 16 + 32 | quem pede `/favicon.ico` sozinho |
| `app/marca/simbolo.png` | 333 × 192, transparente | o símbolo no topo |
| `app/marca/palavra.png` | 449 × 192, **máscara** | a palavra "atlas": só o alfa conta, a cor vem do CSS |

## Arquivos
`app/manifest.webmanifest`, `app/metro.html`, `app/index.html` (só as linhas de ícone no
`<head>`), `app/web/tokens.css`, `app/web/metro.css`, `app/sw.js`, `app/tests/pwa.test.js`.
Apague `app/icons/icone.svg`.

## Testes primeiro (em `tests/pwa.test.js`)
1. `marca: o manifesto tem 192, 512 e um maskable, PNG que existem no disco`: os ícones do
   manifesto têm `sizes` `192x192` e `512x512` com `purpose` `any`, e um com `purpose`
   `maskable`; cada `src` existe em `app/` e começa com os bytes de PNG `89 50 4E 47`.
2. `marca: o ícone azul-marinho não volta`: `app/icons/icone.svg` não existe, e nenhum
   `.html`, `.webmanifest` ou o `sw.js` cita `icone.svg`.
3. `marca: o manifesto pinta papel`: `background_color` e `theme_color` são `#fbf7f0`.
4. `marca: as páginas apontam os ícones novos`: `metro.html` e `index.html` têm
   `<link rel="icon">` para `icons/favicon-32.png` (32x32) e `icons/favicon-16.png` (16x16),
   e `<link rel="apple-touch-icon">` para `icons/apple-touch-icon.png`. O `metro.html` tem
   `theme-color` `#fbf7f0` com `media="(prefers-color-scheme: light)"` e `#17181a` com
   `media="(prefers-color-scheme: dark)"`. O `index.html` mantém o `theme-color` dele até a
   S3b.
5. `marca: o precache leva os ícones e a marca`: a lista do `sw.js` tem os 6 PNG de
   `icons/`, `favicon.ico`, `marca/simbolo.png` e `marca/palavra.png`.

## Implementação
**Manifesto** (troque o bloco `icons` e as duas cores; o resto fica):
```json
"background_color": "#fbf7f0",
"theme_color": "#fbf7f0",
"icons": [
  { "src": "./icons/icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "./icons/icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "./icons/icone-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

**`<head>` das duas páginas** (no lugar das duas linhas que citam `icone.svg`):
```html
<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="icons/favicon-16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
```
No `metro.html`, a meta `theme-color` de hoje vira duas:
```html
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fbf7f0">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#17181a">
```

**Tokens** (em `:root`, numa seção nova "MARCA"; no bloco escuro, só a linha indicada):
```css
--marca-fundo: #fbf7f0;            /* papel fixo: a cúpula do símbolo é preta e some no carvão */
--marca-simbolo-fundo: transparent;
--marca-altura: 24px;
/* no bloco prefers-color-scheme: dark */
--marca-simbolo-fundo: var(--marca-fundo);
```

**O topo no `metro.html`**, antes do `<main>`:
```html
<header class="topo">
  <a class="marca" href="./metro.html" aria-label="Atlas, início">
    <img class="marca-simbolo" src="marca/simbolo.png" alt="" width="42" height="24">
    <span class="marca-palavra" aria-hidden="true"></span>
  </a>
</header>
```

**CSS** (em `metro.css`):
```css
.topo { display: flex; align-items: center; padding: var(--espaco-3) var(--espaco-4);
        padding-top: calc(var(--espaco-3) + var(--margem-segura-topo)); }
.marca { display: inline-flex; align-items: center; gap: var(--espaco-2);
         min-height: var(--alvo-toque); text-decoration: none; }
.marca-simbolo { height: var(--marca-altura); width: auto; padding: var(--espaco-1);
                 border-radius: var(--raio-placa); background: var(--marca-simbolo-fundo); }
.marca-palavra { display: block; height: var(--marca-altura); aspect-ratio: 449 / 192;
                 background: var(--tinta);
                 -webkit-mask: url("../marca/palavra.png") center / contain no-repeat;
                 mask: url("../marca/palavra.png") center / contain no-repeat; }
```
A palavra é pintada com `--tinta` pela máscara, então troca sozinha no tema escuro. O
símbolo ganha um fundo de papel só no escuro, pelo token.

**`sw.js`**: tire `icons/icone.svg` do precache, ponha os 9 arquivos da tabela, suba
`VERSAO` e atualize `PRECACHE_HASH`.

## `testar_pagina`
Abra `metro.html`. Passos: nenhum. Confira nos 4 tamanhos: zero erro de console, a marca
visível no topo e o texto da placa abaixo dela. O link da marca se chama "Atlas, início"
para o leitor de tela.
