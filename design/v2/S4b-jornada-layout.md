# S4b — a Jornada no layout do Lovable: cartões no diagrama, duas colunas e cascata

**Objetivo.** A S4a pôs na Jornada o que se lê (a abertura, os três números e a próxima
conexão, em `web/telas/jornada-blocos.js`, com estilo em `web/telas/jornada.css`). Aqui
entra o **layout** que o Lovable desenhou: a placa com a sombra, cada estação como um cartão
ao lado do trilho, duas colunas no computador, e a entrada em cascata.

## Arquivos
Mudam: `app/web/metro.js` (só a placa e a linha de cada estação dentro do `desenharMetro`;
ache com `buscar_arquivos`, leia com faixa), `app/web/telas/jornada.css` (o layout mora
aqui, não no `metro.css`, que tem 399 linhas), `app/web/tokens.css` (um token novo),
`app/core/textos.js` (seção `jornada`), `app/tests/metro.test.js` (só testes novos, no fim),
`app/sw.js`.

## A placa "Sua próxima estação" (já existe; muda)
- Rótulo `CONTINUE DE ONDE PAROU` quando a estação está em curso; senão `SUA PRÓXIMA
  ESTAÇÃO`.
- Abaixo do nome: "Linha 2 · estação 3 de 5" (a posição da estação na linha dela).
- Um botão primário (o `acaoDaPlaca` de hoje) e a nota "Abrir não muda sua viagem: você
  decide quando concluir."
- `box-shadow: var(--sombra-placa)`: **é a única sombra do app.**

## Cada estação do diagrama
O trilho de 6 px e o círculo (forma por estado) ficam como hoje. Ao lado do círculo, um
**cartão** com o nome, o rótulo de estado (`CONCLUÍDA`, `EM CURSO`, `DISPONÍVEL`,
`TRANCADA`) e a linha de apoio: "Falta <pré-requisito>" na trancada; "Concluída em
dd/mm/aaaa" na concluída (`dataLocal`). Cartão com `border-radius: var(--raio-placa)`, borda
`1px solid var(--borda)`, `min-height: var(--alvo-toque)`. O cartão é o `<button>` (ou está
dentro dele) que hoje abre a folha: o toque continua abrindo a folha (a S5 troca para rota).

## Computador (`@media (min-width: 1024px)`)
Duas colunas. À esquerda, a abertura e o mapa; à direita, numa coluna de
`var(--largura-lateral)` com `position: sticky; top: <a altura do topo>`, a placa, os
números e a próxima conexão. Token novo no `tokens.css`: `--largura-lateral: 360px` (no
bloco de tamanhos; a trava de tamanhos aceita token declarado). Use `display: grid` com
`grid-template-columns: 1fr var(--largura-lateral)` e áreas nomeadas; no celular, uma
coluna na ordem da S4a.

## Movimento
- Abertura, placa e números entram em **cascata**: `animation: entrar var(--movimento-abrir)
  var(--curva-atlas) both` (o `@keyframes entrar` é do `casco.css`) com
  `animation-delay: calc(var(--atraso-cascata) * <i>)`, i de 0 a 5.
- O trilho não se redesenha a cada troca de aba: a animação de chegada continua só para a
  conclusão (S6).
- Com movimento reduzido os tokens zeram tudo: nada a escrever à mão.

## Carregando
O esqueleto de hoje (traço e 5 círculos parados, depois de 150 ms) ganha uma placa cinza
parada no lugar da placa. Nada de pulso nem brilho.

## Testes primeiro
1. `jornada: um primário só`: na Jornada desenhada com o mini-DOM, exatamente um elemento
   com a classe do botão primário.
2. `jornada: a placa diz CONTINUE DE ONDE PAROU com estação em curso, e a posição na linha`.
3. `jornada: a estação trancada diz o que falta; a concluída diz a data em dd/mm/aaaa`.
4. `jornada: só a placa tem sombra`: no `jornada.css` e no `metro.css`, `box-shadow` só
   aparece com `var(--sombra-placa)`, e só no seletor da placa.

**`sw.js`**: `VERSAO` sobe 1 e `PRECACHE_HASH` acompanha.

## `testar_pagina`
Abra `index.html`. Passos: esperar 800; clicar "2"; esperar 300. Confira nos 4
tamanhos: zero erro; "SUA PRÓXIMA ESTAÇÃO" (ou "CONTINUE DE ONDE PAROU") visível; nenhum
texto cortado; no computador e no monitor, a coluna lateral à direita.
