# S2 — tokens da v2 e a base que toda tela herda

**Objetivo.** Entram os tokens de movimento, sombra e foco que o Lovable definiu, e caem
cinco defeitos que o juiz viu na tela publicada:
1. no tema escuro, as calhas da página ficam brancas: o fundo está no contêiner, não no
   `html` nem no `body`;
2. o seletor das 7 linhas é `<span type="button">`, que o teclado não alcança;
3. o anel "você está aqui" pulsa para sempre (`infinite`), o que fere a WCAG 2.2.2;
4. o corpo do texto ainda usa a fonte do sistema, que o DS proíbe como principal;
5. o foco tem 2 px; a v2 usa 3 px com afastamento de 3 px.

## Arquivos
`app/web/tokens.css`, `app/web/base.css` (novo), `app/metro.html` (um `<link>`),
`app/web/metro.css`, `app/web/metro.js` (só `selo` e o bloco "3. o seletor das 7 linhas"),
`app/tests/design-system.test.js`, `app/tests/metro.test.js` (só testes novos, no fim),
`app/sw.js`.

## Testes primeiro
Em `tests/design-system.test.js`:
1. `movimento: nenhuma animação infinita no CSS do app`: nenhum `.css` de `app/web/` contém
   `infinite`.
2. `tema: o html e o body pintam --fundo`: `web/base.css` declara `background: var(--fundo)`
   para `html` e para `body`, e o `metro.html` carrega `web/base.css` logo depois de
   `tokens.css`.
3. `tipo: o corpo usa a Overpass`: em `tokens.css`, `--fonte-corpo` começa por
   `var(--fonte-placa)`.
4. `foco: 3 px de anel e 3 px de afastamento, no base.css`: `--anel-foco: 3px` e
   `--afastamento-foco: 3px` no `tokens.css`, e `base.css` tem a regra `:focus-visible` com
   os dois.
5. `tokens: os de movimento da v2 existem e zeram com movimento reduzido`:
   `--movimento-selecao`, `--movimento-abrir`, `--atraso-cascata` e
   `--deslocamento-entrada` existem em `:root` e valem `0ms` (ou `0px`) dentro do bloco
   `prefers-reduced-motion: reduce`.

No fim de `tests/metro.test.js`:
6. `seletor: as 7 linhas são <button type="button">, com aria-pressed na atual`: desenhe o
   metro com o mini-DOM que o arquivo já usa e confira, no `nav.linhas`, 7 elementos de tag
   `BUTTON`, `type="button"`, e `aria-pressed="true"` só no da linha atual.

## Implementação
**`tokens.css`**, em `:root`:
```css
/* MOVIMENTO v2 (Lovable, 30/10/2026): selecionar, abrir, cascata */
--movimento-selecao: 200ms;    /* aba, linha, filtro */
--movimento-abrir: 320ms;      /* folha, painel, troca de tela */
--atraso-cascata: 50ms;        /* entre itens de uma lista que entra, até o 6º */
--deslocamento-entrada: 8px;   /* a tela entra subindo 8 px */
--curva-atlas: cubic-bezier(0.22, 1, 0.36, 1);
--pulso-repeticoes: 2;         /* o "você está aqui" pulsa 2 vezes e para (WCAG 2.2.2) */
--sombra-placa: 4px 4px 0 var(--tinta); /* a ÚNICA sombra: a placa da próxima estação */
--afastamento-foco: 3px;
```
Mude `--anel-foco` de `2px` para `3px`, e `--fonte-corpo` para
`var(--fonte-placa)` (a pilha do sistema sai). No bloco `prefers-reduced-motion: reduce`,
acrescente `--movimento-selecao: 0ms; --movimento-abrir: 0ms; --atraso-cascata: 0ms;
--deslocamento-entrada: 0px;`.

**`web/base.css`** (novo; a base de toda página da v2):
```css
html { background: var(--fundo); color: var(--tinta); font-family: var(--fonte-corpo);
       color-scheme: light dark; }
body { margin: 0; background: var(--fundo); min-height: 100dvh; }
:focus-visible { outline: var(--anel-foco) solid var(--tinta);
                 outline-offset: var(--afastamento-foco); }
.so-leitor { position: absolute; width: 1px; height: 1px; overflow: hidden;
             clip-path: inset(50%); white-space: nowrap; }
```
No `metro.html`, `<link rel="stylesheet" href="./web/base.css">` logo depois do
`tokens.css`. Em `metro.css`, a regra de `outline` da linha 98 passa a usar
`var(--afastamento-foco)` (ou sai, se só repetia a do `base.css`).

**Pulso finito**: em `metro.css`, a animação `anelAqui` troca `infinite` por
`var(--pulso-repeticoes)`. Depois de pulsar, o anel fica parado e visível: o estado final é
o anel, não a ausência dele.

**Seletor**: `selo(doc, linha, attrs, tag = 'span')`. O bloco do seletor passa `'button'` e
troca `aria-current` por `aria-pressed: atual ? 'true' : 'false'`. No `metro.css`, zere o
estilo de botão do navegador no `.linhas .selo` (`border`, `background`, `font: inherit`,
`color: inherit`, `padding`) e garanta `min-width` e `min-height` de `var(--alvo-toque)`.
Os testes antigos que procuravam `aria-current` no seletor passam a procurar
`aria-pressed`. O clique continua pela delegação de hoje; Enter e Espaço vêm de graça com
`<button>`.

**`sw.js`**: `web/base.css` no precache; `VERSAO` e `PRECACHE_HASH`.

## `testar_pagina`
Abra `metro.html`. Passos: clicar "Linha 2", esperar 300. Confira nos 4 tamanhos: zero erro,
a placa diz Linha 2. O juiz confere à parte o escuro (calhas), o teclado (Tab chega às 7
linhas) e o pulso que para; isso a ferramenta ainda não vê.
