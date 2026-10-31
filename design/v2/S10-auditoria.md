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
