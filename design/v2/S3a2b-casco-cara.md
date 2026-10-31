# S3a-2b — o casco tem cara: a barra de abas, o topo, o "pular" e a entrada da tela

**Objetivo.** A S3a-2a deixou o casco funcionando (rotas, abas, anúncio, foco, Jornada e
Explorar montadas pelo `web/casco.js`), sem estilo próprio. Aqui entra o `web/casco.css`: a
barra de abas embaixo no celular e no tablet, no topo no computador, o "Pular para o
conteúdo" que só aparece no foco, e a tela que entra subindo 8 px.

## Arquivos
Novo: `app/web/casco.css`. Mudam: `app/index.html` (o `<link>` do `casco.css`, entre
`base.css` e `metro.css`), `app/sw.js`, e `app/tests/pages.test.js` (o teste abaixo).
Não leia `web/casco.js` inteiro: se precisar de um nome de classe dele, ache com
`buscar_arquivos`.

## Testes primeiro
1. O `index.html` carrega `./web/casco.css` depois de `base.css` e antes de `metro.css`.
2. `casco.css`: a regra `.abas a[aria-current="page"]` existe e não usa `box-shadow`; e há um
   `@media (min-width: 1024px)` que tira as abas do `position: fixed`.
(A trava `tests/design-system.test.js` já confere cor, tempo, largura e sombra de todo `.css`:
rode-a; ela é o resto do teste.)

## Implementação
**`web/casco.css`** (mobile-first: a barra embaixo é a base, e o computador sobe as abas
para o topo; a trava de largura só aceita os números dos `--bp-*`, que são 599, 600, 1024 e
1440, por isso não há `max-width: 1023px`):
```css
.pular { position: absolute; left: var(--espaco-4); top: calc(-1 * var(--alvo-toque) * 2); }
.pular:focus { top: var(--espaco-2); background: var(--superficie); color: var(--tinta);
               padding: var(--espaco-3) var(--espaco-4); border-radius: var(--raio-placa); z-index: 3; }
.topo { position: sticky; top: 0; z-index: 2; display: flex; align-items: center;
        justify-content: space-between; background: var(--fundo); border-bottom: 1px solid var(--borda); }
.abas { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2; display: grid;
        grid-auto-flow: column; grid-auto-columns: 1fr; background: var(--fundo);
        border-top: 1px solid var(--borda); padding-bottom: var(--margem-segura-baixo); }
main { padding-bottom: calc(var(--alvo-toque) + var(--espaco-6) + var(--margem-segura-baixo)); }
.abas a { display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--espaco-1); min-height: var(--alvo-toque); padding: 0 var(--espaco-3);
          color: var(--fosca); text-decoration: none; font-size: var(--tipo-nota);
          font-weight: var(--peso-forte); border-top: 3px solid transparent;
          transition: color var(--movimento-selecao) var(--curva-atlas); }
.abas a svg { width: 22px; height: 22px; }
.abas a[aria-current="page"] { color: var(--tinta); font-weight: var(--peso-placa);
                               border-top-color: var(--tinta); }
@media (min-width: 1024px) {
  .abas { position: static; display: flex; gap: var(--espaco-2); border-top: 0; padding-bottom: 0; }
  .abas a { flex-direction: row; font-size: var(--tipo-corpo); }
  main { padding-bottom: var(--espaco-6); }
}
.tela-entra { animation: entrar var(--movimento-abrir) var(--curva-atlas) both; }
@keyframes entrar { from { opacity: 0; transform: translateY(var(--deslocamento-entrada)); }
                    to { opacity: 1; transform: none; } }
```
A aba ativa é marcada por uma borda de 3 px (sombra está proibida fora de `--sombra-placa`).
Com movimento reduzido os tokens zeram a duração e o deslocamento: nada a fazer aqui.

**`sw.js`**: `web/casco.css` no precache; `VERSAO` sobe 1 e `PRECACHE_HASH` acompanha.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Explorar"; esperar 500; clicar
"Jornada"; esperar 500. Confira nos 4 tamanhos: zero erro; no celular e no tablet as abas
estão embaixo e não cobrem o último item da tela; no computador e no monitor estão no topo;
depois de "Jornada", "Sua próxima estação" aparece.
