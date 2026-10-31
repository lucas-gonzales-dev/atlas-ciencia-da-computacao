# S4 — a Jornada no layout do Lovable, com dado real

> Revisto pelo juiz antes de ir: confira os nomes contra o código depois da S3b.

**Objetivo.** A primeira aba responde, em 10 segundos, três perguntas: o que é isto, onde
estou e qual é o próximo passo. A estrutura vem do Lovable; os dados vêm do catálogo e da
viagem.

## Arquivos
`app/web/telas/jornada.js`, `app/web/metro.js` (`desenharMetro` e as funções que ele
chama), `app/web/metro.css` (ou um `app/web/telas/jornada.css` novo, se o `metro.css`
passar de 400 linhas), `app/core/viagem.js` (uma função nova), `app/core/textos.js`,
`app/tests/viagem.test.js` e `app/tests/metro.test.js` (só testes novos), `app/sw.js`.

## A tela, de cima para baixo (celular, uma coluna)
1. **Abertura.** Rótulo de placa `SUA VIAGEM EM CIÊNCIA DA COMPUTAÇÃO`; `h1` "Seu caminho
   fica mais claro a cada conexão." com a palavra "conexão." na cor da linha da próxima
   estação (classe `l<n>`); o `h1` usa `--tipo-estacao` (32 px, o teto da escala). Abaixo:
   "35 estações em 7 linhas, da grade aberta da Universidade Brasileira Livre. O Atlas
   aponta os cursos e livros que ela indica e guarda sua viagem só neste aparelho."
2. **Placa "Sua próxima estação"** (já existe). Rótulo `CONTINUE DE ONDE PAROU` quando a
   estação está em curso; senão `SUA PRÓXIMA ESTAÇÃO`. Nome em 32 px; abaixo, "Linha 2 ·
   estação 3 de 5". Um botão primário (o `acaoDaPlaca` de hoje) e a nota "Abrir não muda sua
   viagem: você decide quando concluir." A placa tem `box-shadow: var(--sombra-placa)`:
   **é a única sombra do app**.
3. **Três números**, em `--fonte-mono`, cada um com rótulo de placa e uma nota:
   `VIAGEM` "3/35", nota "estações concluídas"; `EM CURSO` "01", nota "você decide quando
   concluir"; `LINHAS ABERTAS` "2/7", nota "com estação disponível". **Sem XP, sem
   sequência.**
4. **Seu mapa agora.** Rótulo `SEU MAPA AGORA`, o seletor das 7 linhas (S2) e o diagrama da
   linha. Cada estação é uma **linha do diagrama**: o trilho de 6 px, o círculo (forma por
   estado, como hoje) e, ao lado, um cartão com o nome, o rótulo de estado (`CONCLUÍDA`,
   `EM CURSO`, `DISPONÍVEL`, `TRANCADA`) e a linha de apoio: "Falta Algoritmos I" na
   trancada; "Concluída em 30/10/2026" na concluída. Cartão com `--raio-placa`, borda
   `--borda`, altura mínima de `--alvo-toque`. O toque no cartão abre a folha como hoje (a
   S5 troca para rota).
5. **Próxima conexão.** Rótulo `PRÓXIMA CONEXÃO`: "Ao concluir <próxima>, você abre <A> e
   <B>." Com baldeação: "… e <C>, na Linha 3." (`abreComBaldeacao`). Se não abre nada: "Esta
   estação fecha a Linha <n>."

**Primeira visita** (nada concluído nem iniciado): o parágrafo da abertura dá lugar ao
`textos.primeiraVisita` com as duas saídas que já existem (começar e marcar o que já
estudou). **Terminal** (35 concluídas): os itens 2, 4 e 5 dão lugar ao `textos.terminal`.

**Computador (a partir de `--bp-computador`)**: duas colunas. À esquerda, abertura e mapa;
à direita, numa coluna de 360 px que acompanha a rolagem (`position: sticky`), a placa, a
próxima conexão e os números. O token de largura entra no `tokens.css` como
`--largura-lateral: 360px`.

## Movimento
- Abertura, placa e números entram em **cascata**: cada um com
  `animation-delay: calc(var(--atraso-cascata) * <i>)`, até o 6º.
- O trilho não se redesenha a cada troca de aba: a animação de chegada continua só para a
  conclusão (S6).
- Com movimento reduzido, tudo aparece no lugar.

## Carregando
O esqueleto de hoje (traço e 5 círculos parados, depois de 150 ms) ganha uma placa cinza
parada no lugar da placa da próxima estação. Nada de pulso.

## Testes primeiro
1. `viagem: numerosDaJornada conta carimbos, em curso e linhas abertas`: uma função pura
   nova em `core/viagem.js`, `numerosDaJornada(progresso, catalogo)` →
   `{ carimbos, emCurso, linhasAbertas }`, com 3 casos: viagem vazia (0, 0, 1), uma
   concluída e uma iniciada, e o Terminal (35, 0, 7). Confira o valor de `linhasAbertas`
   na viagem vazia contra `linhasAbertas()` antes de fixar o número.
2. `jornada: um primário só`: na Jornada desenhada com o mini-DOM, exatamente um elemento
   com a classe do botão primário.
3. `jornada: nenhum XP nem sequência na tela`: nenhum texto de `textos.js` casa com
   `/\bXP\b|sequência|streak|ranking|pontos/i`.
4. `jornada: o h1 é o primeiro título e usa o tamanho da estação`.
5. `jornada: primeira visita troca a abertura pelo embarque, Terminal troca a placa`.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Linha 2"; esperar 300. Confira nos 4
tamanhos: zero erro; "Seu caminho fica mais claro" e "SUA PRÓXIMA ESTAÇÃO" (ou "CONTINUE DE
ONDE PAROU") visíveis; nenhum texto cortado; no computador, a coluna lateral à direita.
