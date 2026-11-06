# S5 — a folha da estação, com rota própria

> Revisto pelo juiz antes de ir.

**Objetivo.** Abrir uma estação é ir a `#/estacao/<slug>`. No celular, a estação abre numa
**folha** que sobe; no computador, num **painel** à direita, com o mapa à vista. O botão
voltar do navegador fecha. O conteúdo segue a página de estação do Lovable, só com dado
real.

## Arquivos
`app/web/folha.js` (novo: a folha sai do `metro.js`, que encolhe), `app/web/metro.js`
(a função `folha` e o clique que abre), `app/web/casco.js` (a rota `estacao`),
`app/web/folha.css` (novo), `app/core/viagem.js` (`fatosDaEstacao`), `app/core/textos.js`,
`app/tests/folha.test.js` (novo, na lista do `npm test`), `app/sw.js`.

## Abrir e fechar
- O cartão da estação vira `<a href="#/estacao/<slug>">`.
- A rota `estacao` monta a **Jornada por baixo** (na linha da estação) e abre a folha por
  cima. Abrir o link direto (de fora do app) faz o mesmo.
- **Fechar**: o botão "Fechar" (44 px, no topo da folha), `Esc` e o voltar do navegador.
  Fechar pelo botão ou pelo `Esc` faz `history.back()` se a folha foi aberta de dentro do
  app; se veio de fora, troca o hash por `#/` com `history.replaceState`.
- **Foco**: ao abrir, vai para o `h2` da folha; o `Tab` fica preso dentro da folha enquanto
  ela está aberta; ao fechar, volta para o cartão que a abriu.
- **Celular**: a folha ocupa até 90 % da altura (`dvh`), sobe com
  `transform: translateY(100%) → 0` em `--movimento-abrir` e `--curva-atlas`, tem uma alça
  visual no topo e um véu com `--tinta` a 40 % atrás (`color-mix`), sem desfoque. Tocar no
  véu fecha.
- **Computador**: painel à direita, `--largura-painel: 480px` (token novo), com a borda
  esquerda de 6 px na cor da linha, sem véu; o mapa continua clicável.

## O conteúdo, de cima para baixo
1. Rótulo: `LINHA 2 · ESTAÇÃO 3 DE 5`, com o número da linha num selo na cor dela.
2. `h2` com o nome, em `--tipo-estacao`.
3. Estado, por forma e texto: `CONCLUÍDA EM 30/10/2026`, `EM CURSO`, `DISPONÍVEL`,
   `TRANCADA`.
4. **Três fatos** (rótulo de placa e valor): `RECURSO` "Playlist · youtube.com" (o tipo e
   o domínio, com as funções que já existem: `origemDoRecurso`, `dominioLegivel`);
   `BIBLIOGRAFIA` "Na fonte da UBL" (link); `CONEXÕES` "Pede 1 · Abre 2".
5. `AO CONCLUIR, VOCÊ ABRE`: a lista do que abre, com "na Linha 3" quando é baldeação; ou
   "Esta estação fecha a Linha 2."
6. **A ação, por estado** (a regra da 2d-2, um primário por folha, continua):
   - disponível: primário "Começar a estudar" (o link do recurso de hoje, numa aba nova);
     secundário "Concluir estação", para quem já estudou por fora (o perfil B da
     JORNADA.md); a nota diz "O curso abre fora do Atlas, no site de quem o publicou.";
   - em curso: primário "Concluir estação"; secundário "Abrir o curso";
   - concluída: secundário "Revisitar o curso"; um link discreto "Desfazer conclusão";
   - trancada: `h3` "A conexão começa antes." e a lista do que falta, **cada item um link
     para a folha daquela estação**. A folha trancada continua legível: ler não é proibido.
7. `SUA ANOTAÇÃO`: o rótulo do campo é "Em uma frase, o que você leva desta estação?"; o
   nome acessível do campo é "Anotação de <nome>"; salva sozinho como hoje e mostra
   "Salvo" num `role="status"`.

Estação que não existe (`#/estacao/xyz`): a folha abre com "Essa estação não está no
mapa." e o botão "Voltar ao mapa".

## Testes primeiro
1. `viagem: fatosDaEstacao`: pura, `fatosDaEstacao(catalogo, id, progresso)` →
   `{ linha, posicao, total, recurso: { tipo, dominio }, pede, abre }`. Casos: uma da
   Linha 1 sem pré-requisito, uma com baldeação, a última de uma linha.
2. `rotas: #/estacao/<slug> com slug que não existe dá a folha de "não está no mapa"`.
3. `folha: um primário por estado, e nenhum na trancada`.
4. `folha: o campo de anotação tem o nome da estação no rótulo acessível`.
5. `folha: a trancada lista o que falta como links para as folhas`.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar no cartão da próxima estação; esperar 400;
clicar "Fechar"; esperar 400. Confira nos 4 tamanhos: zero erro; com a folha aberta,
"AO CONCLUIR, VOCÊ ABRE" visível; no computador, painel à direita e o mapa visível ao
lado; depois de "Fechar", a folha sumiu. O juiz confere `Esc`, o voltar e o foco preso.
