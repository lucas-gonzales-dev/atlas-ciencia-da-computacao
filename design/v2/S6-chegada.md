# S6 — concluir vira momento: "Conexão criada" e "Desfazer"

> Revisto pelo juiz antes de ir.

**Objetivo.** Concluir uma estação é o ponto alto da viagem. O Lovable fez disso uma tela
inteira; no Atlas acontece **dentro da folha**, com o mapa mudando por trás, e se desfaz em
6 segundos. Sem confete e sem XP.

## Arquivos
`app/web/folha.js`, `app/web/folha.css`, `app/web/metro.js` (o aviso de chegada de hoje),
`app/core/viagem.js` (`momentoDaChegada`), `app/core/textos.js`, `app/tests/folha.test.js`,
`app/tests/viagem.test.js`, `app/sw.js`.

## O momento
Ao tocar "Concluir estação", o miolo da folha troca para:
1. o **selo**: um círculo cheio na cor da linha, com o traço de "feito" desenhado por
   `stroke-dashoffset` em `--movimento-chegada`;
2. rótulo `CONEXÃO CRIADA`; `h2` "<Nome> entrou no seu bilhete."; "Carimbo de 30/10/2026.";
3. `NOVO CAMINHO`: uma linha por estação aberta, "<X> está disponível", com "na Linha 3"
   quando é baldeação. Se nada abriu: "Esta estação fecha a Linha <n>." Se a linha fechou,
   o texto de `textos.fimDaLinha`;
4. **marco novo**, se houver (`marcosNovos`): rótulo `MARCO`, o nome do marco e o critério
   em uma linha ("Primeira baldeação: concluir uma estação que pede outra linha.");
5. botões: primário "Ver próxima estação" (vai para a folha da próxima); secundário
   "Voltar ao mapa".

Ao mesmo tempo, por trás: o trecho do trilho enche, o círculo enche e as estações que
destrancaram pulsam **uma vez** (a animação de chegada que já existe).

O **aviso** de baixo, que já existe, continua: "Estação concluída." com o botão
"Desfazer", por `--janela-desfazer` (6 s). Desfazer volta **tudo**: o estado, o carimbo, a
folha volta a mostrar "em curso", e (depois da S8) a revisão agendada sai.

Leitor de tela: o `role="status"` anuncia "Conexão criada: <Nome>. <N> estações abertas."

Movimento reduzido: o selo aparece cheio, o trilho já percorrido, sem pulso.

## Testes primeiro
1. `viagem: momentoDaChegada`: pura, `momentoDaChegada(antes, depois, catalogo, id)` →
   `{ titulo, data, abertas: [{ titulo, linha, baldeacao }], fechouLinha, marcos: [{ tipo, nome, criterio }], proxima }`.
   Casos: estação que abre uma da mesma linha; que abre por baldeação; a última da linha;
   a 35ª (Terminal).
2. `folha: depois de concluir, um primário só ("Ver próxima estação")`.
3. `folha: desfazer volta a folha para "em curso" e tira o carimbo`.
4. `textos: todo marco tem nome e critério, e nenhum fala em pontos`.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar no cartão da próxima estação; esperar 400;
clicar "Concluir estação"; esperar 800. **Não clique "Começar a estudar"**: ele abre o curso
num site de fora. Confira:
"CONEXÃO CRIADA" e "Desfazer" visíveis; zero erro. Segundo uso: os mesmos passos e mais
clicar "Desfazer"; esperar 400: "EM CURSO" de volta.
