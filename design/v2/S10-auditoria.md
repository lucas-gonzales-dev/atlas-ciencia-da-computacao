# S10 — auditoria de ponta a ponta

> Revisto pelo juiz antes de ir. Esta fatia **conserta**; não acrescenta tela.

**Objetivo.** Passar o app inteiro pelas réguas que cada fatia conferiu sozinha, agora
juntas, e consertar o que quebrar no encontro.

## A régua
1. **Estados**: para cada tela da tabela "Estados por tela" do `README.md`, provoque cada
   estado (viagem vazia, viagem no meio, Terminal, busca vazia, estação que não existe,
   catálogo que falha, offline) e confira o texto e a saída.
2. **Movimento**: nenhuma animação infinita; toda duração vem de token; com movimento
   reduzido, nenhuma animação roda.
3. **Teclado**: do "Pular para o conteúdo" até o fim de cada tela, só com `Tab`,
   `Shift+Tab`, `Enter`, `Espaço` e `Esc`. Tudo que se clica recebe foco, o foco é sempre
   visível, e a folha prende e devolve o foco.
4. **Leitor de tela**: cada troca de aba anuncia; cada campo tem nome próprio; nenhum
   `aria-live` do tamanho da página.
5. **Temas**: as 5 telas e a folha, no claro e no escuro, sem calha branca e sem texto
   abaixo de 4,5:1.
6. **Tamanhos**: os 4 do `testar_pagina`, sem texto cortado, sem rolagem lateral, e as abas
   de baixo sem cobrir conteúdo.
7. **Offline**: com o service worker ativo e a rede cortada, as 5 telas abrem e a viagem
   salva.
8. **Heurísticas**: a tabela das 10 de Nielsen do `design/README.md` atualizada para as
   telas novas, cada linha com onde se confere.
9. **Proibidos**: nenhum XP, ponto, sequência, ranking, emoji, confete, spinner, sombra
   fora da placa, azul-marinho ou nome de linha inventado.

## Fechamento
O de sempre, e mais uma tabela: régua × tela, com "ok" ou o defeito e o commit que o
consertou.

## Resultado

Uma célula por régua × tela. **ok** = a régua passou por aquela tela e não achou
nada a consertar. Achando, o defeito em poucas palavras e **o commit que o
consertou**, lido do `git log`, cada hash conferido com `git cat-file -t` antes
de ser escrito aqui. Causa que mora na **casa** (casco, `base.css`, os tokens)
aparece repetida nas cinco telas com o mesmo hash: foi consertada uma vez, e a
régua mediu em cada tela.

| # | Régua | Jornada | Explorar | Revisar | Perfil | folha |
|---|---|---|---|---|---|---|
| 1 | **Estados** | ok | dizia «offline» onde o catálogo simplesmente não abriu; virou as três partes — `560c711`<br>busca sem resultado não repetia o termo — `560c711` | «em dia» era beco: texto sem saída — `560c711` | sem rede era beco: texto sem saída — `560c711` | ok |
| 2 | **Movimento** | ok | esqueleto respirava duas vezes (`--pulso-repetições`), o shimmer da lista proibida — `0de7f05`<br>o único token de tempo que sobrava vivo no reduce era o atraso do esqueleto — `0de7f05` | ok | ok | ok |
| 3 | **Teclado** | ok | ok | ok | ok | foco vazava da folha e o Esc não devolvia ao cartão que abriu — `5717a83` |
| 4 | **Leitor de tela** | troca de aba não anunciava nada: `jornada.js` passou a escrever o rótulo em `#anuncio` — `1113346` | ok | ok | ok | ok |
| 5 | **Temas** | ok | selo «trancada»: `--fundo` sobre `--trancada` a 3,44:1 no claro e 4,32:1 no escuro — `0de7f05`<br>selo de origem com `--marca-fundo`, papel fixo: 1,05:1 no escuro — `0de7f05` | ok | ok | número da linha pintado com `--cor-texto`, token que nunca foi declarado em lugar nenhum: 1,5:1 a 2,5:1 no escuro — `0de7f05` |
| 6 | **Tamanhos** | as abas passavam por cima de Viagem, Em curso e Linhas abertas no celular e no tablet — `f9c947a` | ok (a mesma causa, na casa: quem rolava era o documento, e `base.css` dava `min-height:100dvh` ao `body` e anulava o conserto — `f9c947a`) | ok (causa na casa — `f9c947a`) | ok (causa na casa — `f9c947a`) | ok (causa na casa — `f9c947a`) |
| 7 | **Offline** | o selo de rede do casco (`#estado-rede`) não existia: era `todo` declarado na régua 1 — `58ed3a1` | ok (selo da casa — `58ed3a1`) | ok (selo da casa — `58ed3a1`) | ok (selo da casa — `58ed3a1`) | ok (selo da casa — `58ed3a1`) |
| 8 | **Heurísticas** | ok | ok | ajuda com dois quintos de prova: «Como funciona» não tem `test()` — **dívida S11** | ajuda com dois quintos de prova: a caixa «Sobre» e o rótulo «Como ler o mapa» não têm `test()` — **dívida S11** | ok |
| 9 | **Proibidos** | ok | ok | ok | ok | ok |

**O que a tabela não mostra, e tem de ficar dito.** Quatro consertos foram de
**medida**, não de tela — verdes que estavam mentindo:

- **Régua 5 media o claro duas vezes.** O parser procurava o bloco escuro com
  `@media[^{]*prefers-color-scheme: dark[^{]*{`, e o primeiro `@media` do
  `tokens.css` está num **comentário**: do comentário até a chave real não havia
  `{`, então o «escuro» era o rabo do `:root` — os dois temas saíam idênticos. A
  asserção `medidos >= 40` sobre o **total** (70 pares × 2 temas falsos = 140)
  escondia. Consertado em `c21e301`: lê o CSS sem comentários, guarda de
  identidade de tema (o escuro tem de declarar ≥ 12 cores planas diferentes do
  claro) e piso **por tema**. Envenenar `--tinta` do escuro com `#2a2b2e` derrubou
  13 pares nomeados, de 1,10:1 a 1,26:1 — prova de dente, revertida em seguida.
  Nenhum CSS mudou naquele commit: a falha era de medida, não de cor.
- **Régua 2 tinha três cláusulas e eu havia cobrado duas.** Faltava «toda
  duração vem de token», e o teste só lia CSS — quem desenha é `web/metro.js`,
  que monta `animation:` dentro de string de template. `41a686a` varre o JS
  também. Nasceu verde: nenhum achado; só existe para o próximo movimento
  desenhado direto no código.
- **A régua 6 foi consertada duas vezes, e a primeira estava errada.** Sem caixa
  limitada o `main` tem altura de conteúdo, nada rola, e a barra segue pintada
  sobre o meio da tela. Reserva é diferente de limite: o `body` virou coluna de
  altura = tela menos a faixa, o `main` virou o rolador (`min-height:0` +
  `overflow-y:auto`), e o `@media` de 1024px devolve a rolagem à janela porque o
  painel sticky da Jornada só anda se o documento rolar. `f9c947a`.
- **Os cinco fails do relato do teclado eram do teste, não da tela**: `assert.equal`
  entre nós comparava o grafo do mini-DOM (RangeError de alocação, 58 s para cair
  em ms — o probe sem asserção rodava em 1 s), o contexto fixava `hoje: HOJE` e a
  fila da Revisar saía vazia, `closest('a[href]')` caía no buraco do `casa()` do
  hdom que devolvia `null` em silêncio, e a isenção do véu comparava
  `'delegação'` com `'clique por delegação (data-fechar)'` — nunca casava. Tudo
  em `5717a83`, que ainda deu `ownerDocument` ao hdom e o seletor não entendido
  passando a lançar erro em vez de devolver `null`.

**Prova de que a régua 8 tem dentes (item 8, este commit).** Duas mutações, cada
uma rodada e desfeita:

1. Uma letra: «cada aç**ã**o desenhada…» → «cada aç**a**o desenhada…» na linha 7.
   Caiu, apontando a heurística 7, o arquivo `tests/auditoria-teclado-leitor.test.js`
   e os três títulos mais parecidos.
2. Apaguei a coluna «Onde se confere» da linha 10 (436 caracteres de citação).
   Caiu com «coluna vazia é heurística não implementada» —
   `app/tests/design-system.test.js:742`.

**Fora do alcance do node, dito no arquivo de teste.** Quais teclas o handler de
verdade trata; se o anel aparece **pintado** na cor do tema; se o `Tab` pula o
`display:none` do doble. E a sonda `probe-regua6/`, que media no navegador a
folga caixa/barra e a rolagem lateral, ficou fora do commit: o `testar_pagina`
não sabe que o `main` clipa, então medir aquilo é a olho.

**Suíte no fechamento:** npm test 491/491/0/0 — os mesmos 491 de antes do item 8, porque a
trava nova não é um `test()`: é uma cláusula a mais dentro do que já existia.
Nada em `app/web/` nem em `app/core/` mudou neste commit, então a `VERSAO` do
`sw.js` **não sobe** — subir o cache para distribuir um teste consertado seria
fingir que a tela mudou (mesma decisão de `c21e301`).

**Dívida declarada para a S11.** régua 8, heurística 10: «Como funciona»
(Revisar), a caixa «Sobre» (Perfil) e o rótulo «Como ler o mapa» (seletor de
linhas) existem no código e na tela, mas nenhum `test()` prova que aparecem —
está escrito na própria tabela do §8, e não embaixo de uma citação falsa.
