# S7 — Explorar: a rede inteira, com busca, filtro de linha, ramais e eletivas

> Revisto pelo juiz antes de ir.

**Objetivo.** A grade antiga (montada na S3a, com tokens desde a S3b) vira a tela Explorar
do Lovable: achar uma estação em segundos, ver o que ela pede e o que ela abre, e conhecer
os ramais. Estado por forma, igual à Jornada.

## Arquivos
`app/web/telas/explorar.js` (reescrito), `app/web/telas/explorar.css` (novo),
`app/core/search.js` (a regra de busca que já existe), `app/core/rotas.js` (a busca na URL),
`app/core/textos.js`, `app/web/boot.js` e `app/web/main.js` (o que deixar de ser usado sai,
com os testes dele), `app/web/grade.css` (sai, se nada mais o usar), `app/sw.js`, e os
testes de `search`, `electives`, `specializations` e `render` que forem afetados.

## A tela
1. Rótulo `A REDE INTEIRA`; `h1` "Explore sem perder a direção."; "Cada estação mostra o
   que ela pede e o que ela abre. Trancada também se lê."
2. **Busca**: rótulo visível "Buscar estação", `input type="search"`, placeholder "Nome da
   disciplina". **Filtro**: rótulo "Linha", `<select>` com "Todas" e "Linha 1" a "Linha 7".
   Logo abaixo, `role="status" aria-live="polite"`: "35 estações", "1 estação",
   "Nenhuma estação".
3. **Resultado**: sem busca e sem filtro, as 7 linhas em sequência, cada uma com um `h2`
   "Linha <n>" na cor dela e as 5 estações no mesmo componente de linha do diagrama da
   Jornada (forma por estado, rótulo de estado, "Falta …"). Com busca ou filtro, uma lista
   só. Cada estação é um link para `#/estacao/<slug>`.
4. **Busca vazia**: `textos.buscaSemResultado` e o botão "Limpar busca", que limpa a busca
   e o filtro e devolve o foco ao campo.
5. **Ramais** (as especializações): `h2` "Ramais"; cada ramal com o nome e, se a UBL ainda
   não publicou, o selo `EM OBRAS` (`textos.ramalEmObras`).
6. **Eletivas**: `h2` "Eletivas", a lista que já existe.
7. Rodapé: "Currículo: Universidade Brasileira Livre (licença MIT)" e a proveniência que já
   existe (o commit auditado da fonte).

A busca e o filtro ficam na URL (`#/explorar?busca=calculo&linha=2`), com
`history.replaceState` a cada tecla: dá para compartilhar o endereço, e voltar de uma
estação devolve a mesma busca.

Carregando: 5 linhas cinza paradas, depois de 150 ms.

## Testes primeiro
1. `rotas: #/explorar?busca=calculo&linha=2 dá { tela: 'explorar', busca: 'calculo', linha: 2 }`,
   e `hrefDe` faz o caminho de volta; linha fora de 1 a 7 é ignorada.
2. `explorar: filtrarEstacoes ignora acento e caixa`: "calculo" acha "Cálculo I" e "Cálculo
   II"; com `linha: 2`, só as da Linha 2. Use a regra de `core/search.js`; não escreva outra.
3. `explorar: busca vazia mostra "Nada encontrado" e "Limpar busca"`.
4. `explorar: cada estação é um link para a folha dela`.
5. `explorar: o status conta no singular e no plural`.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Explorar"; esperar 400; digitar "calculo"
em "Buscar estação"; esperar 300; digitar "zzz" em "Buscar estação"; esperar 300; clicar
"Limpar busca"; esperar 300. Confira nos 4 tamanhos: zero erro; com "calculo", "Cálculo I"
visível; com "zzz", "Nada encontrado"; depois de limpar, "35 estações".
