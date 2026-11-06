# S9 — Perfil: o bilhete, os marcos e os seus dados

> Revisto pelo juiz antes de ir.

**Objetivo.** O Perfil é um **portfólio de evidência**, privado: o que a pessoa fez, com
data. O Lovable pôs XP, "ritmo de 1 dia" e troféu; o Atlas troca por carimbos e marcos com
critério escrito. Aqui também moram os dados da pessoa (exportar e importar), que hoje
estão na grade antiga.

## Arquivos
`app/web/telas/perfil.js` e `perfil.css` (novos), `app/core/rotas.js` (a aba entra),
`app/index.html` (o link), `app/core/viagem.js` (os marcos com nome e critério), as
funções de exportar e importar que já existem em `main.js` e `progress-io.js` (mudam de
casa, não de regra), `app/core/textos.js`, `app/sw.js`, `app/tests/perfil.test.js` (novo, na
lista do `npm test`).

## A tela
1. Rótulo `SUA VIAGEM`; `h1` "Cada carimbo é seu."
2. **Três números**: `CARIMBOS` "3/35"; `LINHAS ABERTAS` "2/7"; `REVISÕES` "4" (feitas).
3. **O bilhete**: 7 fileiras (uma por linha) de 5 casas. Casa carimbada: círculo cheio na
   cor da linha e a data dd/mm abaixo; casa vazia: anel fino. Cada casa tem o nome acessível
   "<Estação>, concluída em 30/10/2026" ou "<Estação>, ainda não". A casa é um link para a
   folha da estação.
4. **Marcos**: os quatro de `MARCOS` em `core/viagem.js`, cada um com nome, critério e
   estado:
   - Primeira estação: "Concluir uma estação.";
   - Primeira baldeação: "Concluir uma estação que pede outra linha.";
   - Fim da linha: "Concluir as 5 estações de uma linha." (mostra quantas linhas fechou,
     "2 de 7");
   - Terminal: "Concluir as 35 estações.".

   Estado: conquistado, com a data; ou em andamento, com a conta ("12/35"). Forma e texto,
   não só cor.
5. **Seus dados**: "Sua viagem fica só neste aparelho." O botão "Exportar viagem" baixa o
   arquivo (com as revisões da S8), e "Importar viagem" lê um arquivo. A importação
   recusada diz o quê, por quê e o que fazer (o erro em 3 partes que já existe).
6. **Sobre e créditos**: "Currículo: Universidade Brasileira Livre (licença MIT)", a fonte
   Overpass (SIL OFL 1.1) e o link do código do Atlas.

Bilhete em branco (nada concluído): no lugar do bilhete, "O primeiro carimbo vem da
primeira estação concluída." e o primário "Ir para a próxima estação". Os marcos aparecem
em andamento, e os dados continuam disponíveis (a pessoa pode importar).

Sem leaderboard, sem sequência de dias, sem pontos.

## Testes primeiro
1. `perfil: o bilhete tem 35 casas, 5 por linha, e a carimbada diz a data`.
2. `perfil: cada marco tem nome, critério e estado`, e o fim da linha conta as linhas
   fechadas.
3. `perfil: exportar leva viagem, anotações e revisões; importar devolve as três`, por um
   teste de ida e volta.
4. `perfil: o bilhete em branco mostra o texto e um primário só`.
5. `textos: nenhum texto do perfil fala em XP, pontos, ranking ou sequência`.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Perfil"; esperar 400. Confira nos 4
tamanhos: zero erro; "Cada carimbo é seu." e "Exportar viagem" visíveis; no celular, o
bilhete cabe sem rolagem lateral.
