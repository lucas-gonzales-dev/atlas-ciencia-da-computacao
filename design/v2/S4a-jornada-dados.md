# S4a — a Jornada responde: a abertura, os três números e a próxima conexão

**Objetivo.** A primeira aba responde, em 10 segundos, três perguntas: o que é isto, onde
estou e qual é o próximo passo. Esta metade põe **o que se lê** (as frases e os números,
com dado real); a S4b põe **o layout** (os cartões do diagrama, as duas colunas no
computador, a cascata). A S4 foi dividida pelo juiz em 31/10: S3a-1 e S3a-2 já bateram no
teto de um turno, e a S4 inteira é maior.

## Arquivos
Novos: `app/web/telas/jornada-blocos.js` (as três peças novas, abaixo),
`app/web/telas/jornada.css`.
Mudam: `app/core/viagem.js` (`numerosDaJornada`, nova), `app/core/textos.js` (seção
`jornada`), `app/web/metro.js` (só o `desenharMetro`, que passa a chamar as peças),
`app/index.html` (o `<link>` do `jornada.css`, depois do `metro.css`), `app/tests/viagem.test.js`
e `app/tests/metro.test.js` (só testes novos, no fim), `app/sw.js`.
**Não ponha as peças novas dentro do `metro.js`**: ele já tem 920 linhas, e o `metro.css`
399 (regra 15). As peças moram em `telas/jornada-blocos.js`, e o `desenharMetro` as chama.
Ache `desenharMetro` (~linha 375) e `acaoDaPlaca` (~linha 105) com `buscar_arquivos`; leia
com faixa.

## As três peças (celular, uma coluna, nesta ordem dentro da raiz da Jornada)
1. **Abertura**, antes da placa. Rótulo de placa `SUA VIAGEM EM CIÊNCIA DA COMPUTAÇÃO`; `h1`
   "Seu caminho fica mais claro a cada conexão." com a palavra "conexão." num `<span>` com a
   classe `l<n>` da linha da próxima estação e `color: var(--cor)` (o `metro.css` já declara
   `--cor` em `.l1` a `.l7`); o `h1` usa `font-size: var(--tipo-estacao)`. Abaixo, um
   parágrafo: "35 estações em 7 linhas, da grade aberta da Universidade Brasileira Livre. O
   Atlas aponta os cursos e livros que ela indica e guarda sua viagem só neste aparelho."
2. **Três números**, depois da placa, em `font-family: var(--fonte-mono)`, cada um com
   rótulo de placa e uma nota:
   `VIAGEM` "3/35", nota "estações concluídas"; `EM CURSO` "01" (dois dígitos), nota "você
   decide quando concluir"; `LINHAS ABERTAS` "2/7", nota "com estação disponível".
   **Sem XP, sem sequência, sem pontos.**
3. **Próxima conexão**, depois dos números. Rótulo `PRÓXIMA CONEXÃO` e uma frase: "Ao
   concluir <próxima>, você abre <A> e <B>." Com baldeação: "… e <C>, na Linha 3." (use
   `abreComBaldeacao` do `core/viagem.js`, que já existe). Se não abre nada: "Esta estação
   fecha a Linha <n>."

**Primeira visita** (nada concluído nem iniciado): a abertura troca o parágrafo pelo
`primeiraVisita` que já existe no `textos.js`, com as duas saídas de hoje. **Terminal** (35
concluídas): os números e a próxima conexão não aparecem; vale o `terminal` que já existe.

Toda frase acima vai para `core/textos.js`, numa seção `export const jornada = { … }`
(e `jornada` entra no `TEXTOS` do fim do arquivo). Frase com valor é função:
`numeros.viagem: (c, t) => \`${c}/${t}\``, `conexao.abre: (proxima, nomes) => …`.

## Testes primeiro
1. `viagem: numerosDaJornada conta carimbos, em curso e linhas abertas` (em
   `tests/viagem.test.js`): `numerosDaJornada(progresso, catalogo)` →
   `{ carimbos, emCurso, linhasAbertas }`, com 3 casos: viagem vazia, uma concluída e uma
   iniciada, e o Terminal (35, 0, 7). `linhasAbertas` é o tamanho do que
   `linhasAbertas(progresso, catalogo)` já devolve: **rode-a na viagem vazia e fixe o
   número que ela dá**, não o que você imagina.
2. `jornada: nenhum XP nem sequência na tela`: nenhum texto de `textos.js` casa com
   `/\bXP\b|sequência|streak|ranking|pontos/i`.
3. `jornada: o h1 é o primeiro título e usa o tamanho da estação`: na Jornada desenhada com
   o mini-DOM do `metro.test.js`, o primeiro `h1`/`h2` é o `h1` da abertura, com a classe
   que o `jornada.css` liga a `--tipo-estacao`.
4. `jornada: primeira visita troca o parágrafo pelo embarque; Terminal tira números e
   conexão`.
5. `jornada: a próxima conexão diz o que abre, com baldeação`: um caso com baldeação e um
   que fecha a linha.

## `jornada.css`
Só o que as três peças precisam: o tamanho do `h1`, a fonte mono dos números, o rótulo de
placa (reuse a classe de rótulo de placa que o `metro.css` já tem; ache com
`buscar_arquivos` por `rotulo`), e espaçamento com `--espaco-*`. Nada de layout de colunas:
é da S4b.

**`sw.js`**: `telas/jornada-blocos.js` e `telas/jornada.css` no precache; `VERSAO` sobe 1 e
`PRECACHE_HASH` acompanha.

## `testar_pagina`
Abra `index.html`. Passos: esperar 800. Confira nos 4 tamanhos: zero erro; "Seu caminho
fica mais claro" visível; "SUA VIAGEM EM CIÊNCIA DA COMPUTAÇÃO", "VIAGEM", "LINHAS ABERTAS"
e "PRÓXIMA CONEXÃO" na tela; nenhuma data em aaaa-mm-dd.
