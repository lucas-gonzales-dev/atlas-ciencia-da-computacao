# Atlas: de mapa a curso — o desenho da experiência de aprendizado

*Discovery de 03/11/2026, a partir do relatório "Experiência de aprendizado do Atlas" (no repositório Aurora-Project, em `reports/`). **Aprovado pelo Lucas em 03/11/2026, com as quatro recomendações** (D1 a API oficial do YouTube, D2 o player embutido depois do núcleo, D3 o pré-requisito avisa, D4 sem ritmo semanal). Cada fatia sai daqui especificada antes de ir para a Aurora.*

## A tese em uma frase

O mapa acende quando você **lembra**, não quando você **assiste**.

Hoje o Atlas é um índice bonito: 35 disciplinas da UBL, cada uma um link para uma playlist, e um botão "concluí" que a pessoa aperta por conta própria. O concorrente real não é o Duolingo, é o autoplay do YouTube: assistir é o caminho de menor esforço, e assistir dá a sensação de aprender sem o aprendizado (fluência). O Atlas vira curso de verdade quando o gesto mais fácil dentro dele passa a ser **recordar**, e quando o progresso mostrado é o que foi **verificado**, não o que foi consumido.

## Os princípios (cada um vem da pesquisa)

1. **Progresso é verificado, não declarado.** Nada medido só por assistir se chama "aprendido". O mapa tem dois eixos: o **preenchimento** mostra o que foi estudado; a **cor** mostra o que foi lembrado depois (recuperação com feedback, um dia ou mais depois: g ≈ 0,69).
2. **Cada aula fecha com recordação, não com resumo.** Dois minutos sem olhar, conferir, e de 1 a 3 cartões escritos pela própria pessoa (cartão do aluno vence baralho pronto, d ≈ 0,45, se ele parafrasear). Resumir tem baixa utilidade; recordar, alta.
3. **A revisão é espaçada e honesta.** FSRS-6 no aparelho, retenção desejada de 0,90, primeira volta no dia seguinte, feedback sempre visível, dois botões ("Errei" e "Lembrei").
4. **Gamificação que informa competência.** Caderneta de carimbos com os espaços vazios à vista, cada carimbo com a frase do que se passou a saber fazer (feedback informativo: d = +0,33). Nada de XP, pontos, sequência de dias, ranking, caixa de recompensa ou carimbo por presença.
5. **Abandono e volta são o caso normal.** 3% de conclusão é a linha de base dos MOOCs. Nada conta dias de ausência, nada zera, nada culpa. A volta retoma no segundo exato.
6. **Minijogo é exercício com regra de jogo, dentro da aula.** Nunca um fliperama à parte.
7. **O conteúdo é da UBL e da pessoa.** Nenhum cartão, pergunta ou desafio é inventado por IA. As aulas vêm das playlists; os cartões, da pessoa; a prática, das aulas de exercício da própria UBL e da bibliografia.

## O modelo de progresso

### A aula (unidade nova)

Cada estação passa a ter as aulas da playlist dela (título, duração, posição). Uma aula tem estes estados:

| Estado | Como se entra | O que a pessoa vê |
|---|---|---|
| Não iniciada | padrão | contorno vazio |
| Aberta | tocou em "Assistir" | ponto discreto; não conta para nada |
| Estudada | fez o fechamento: recordação sem olhar + ao menos 1 cartão | círculo cheio na lista; conta para o preenchimento da estação |
| Lembrada | acertou a primeira revisão de um cartão dela, no dia seguinte ou depois | marca de "lembrada"; conta para a cor da estação |
| Consolidada | todos os cartões da aula com estabilidade FSRS ≥ 21 dias e acerto nas duas últimas revisões | marca de "consolidada" |
| Pulada | "Já sei isso" | estado próprio; não conta como estudada |

"Assistida ~X%" só existe no modo com player embutido (decisão D2) e aparece só no detalhe da aula, nunca na estação.

### A estação

| Estado | Critério | No mapa |
|---|---|---|
| Fora da rota | nenhuma aula aberta | contorno, como hoje |
| Embarcada | abriu a primeira aula | contorno na cor da linha |
| Em percurso | k de N aulas estudadas | preenchimento parcial (k/N) e "faltam ~X h" |
| Percorrida | todas as aulas estudadas ou puladas | preenchimento cheio, cor clara |
| Dominada | o desafio da estação aprovado: ≥ 80% dos cartões sorteados lembrados (sorteio de 10 a 15, cartões com 2 dias ou mais, um de cada aula de exercício) | cor cheia da linha e o carimbo com a frase do que foi medido |
| Pede revisão | dominada, mas a recuperabilidade prevista dos cartões caiu abaixo de 80% | anel discreto e "revisar 10 min"; a cor não muda |

Regras: o tempo nunca rebaixa a estação; só um desafio reprovado devolve "dominada" para "percorrida". Quem já tem estações "concluídas" no Atlas atual entra como **"Concluída antes"**: carimbo preservado, preenchimento cheio, e um convite (nunca obrigação) a fazer o desafio para dominar.

### Pré-requisito avisa, não tranca (decisão D3)

Hoje a estação trancada não deixa abrir. A recomendação é avisar: "Esta estação pede Matemática Discreta, que você ainda não estudou. Quer começar por ela?" com os dois caminhos. Adulto autodidata decide a própria rota.

## As jornadas

### J1 — A primeira visita (do link do LinkedIn ao primeiro cartão)

1. **Abre o Atlas.** No topo, o mapa da rede (as 35 estações), o título "Ciência da Computação, aula por aula" e uma linha: "35 disciplinas da UBL, 1.375 aulas. Estude uma, lembre amanhã, e o mapa acende." (o número é lido do `data/aulas/indice.json` na tela, não escrito à mão: em 04/11/2026 eram 1.375 aulas e 719 h).
2. **Um botão só:** "Começar pela primeira aula" (Circuitos Digitais, Aula 01, 16 min). Embaixo, discreto: "Já estudei algumas disciplinas".
3. **Sem tour, sem cadastro, sem pedir notificação.**
4. Toca em começar → abre a **aula** (J2).

"Já estudei algumas": a lista das estações com "Já sei isso" por estação → elas ficam "Puladas" (ou, se quiser, "fazer o desafio" para dominar direto).

### J2 — Estudar uma aula (o ciclo)

1. **A tela da aula:** título ("Aula 02 — Sistemas de Numeração, parte 1"), duração, posição ("2 de 93"), e "Assistir no YouTube" (nova aba; no modo embutido, o player). Abaixo, as **marcas de pausa** calculadas pela duração ("Pare em 8:00 e tente explicar o que viu até ali").
2. **Volta ao Atlas → "Fechar a aula"** (o Atlas detecta a volta à aba e oferece; também há o botão fixo):
   - **Passo 1, sem olhar (2 min):** "Sem rever nada: o que você lembra desta aula?" Campo livre e um relógio discreto de 2 minutos que não trava nada.
   - **Passo 2, conferir:** "Agora confira com o vídeo ou com as suas notas. O que faltou?" (link para reabrir a aula no ponto).
   - **Passo 3, cartões (1 a 3):** "Escreva a pergunta que você quer saber responder daqui a uma semana." Frente e verso, com modelos que puxam paráfrase: "Explique com suas palavras: …", "Dê um exemplo de …", "Qual a diferença entre … e …?", "Por que …?". A origem entra sozinha: "Aula 02 · Circuitos Digitais".
   - **Fecho:** a aula vira **estudada**, o círculo enche na lista, e a frase: "Aula estudada. Os seus 2 cartões voltam amanhã." Se for a primeira: carimbo "Primeira aula estudada".
3. **Próximo passo sugerido:** "Próxima: Aula 03 — Sistemas de Numeração, parte 2 (19 min)" ou "Por hoje está bom. Amanhã: 2 cartões, ~1 min."

Modo mínimo (para quem não quer o ciclo inteiro): uma frase do que levou + uma pergunta = 1 cartão. Também conta como estudada.

### J3 — Revisar (a fila do dia)

1. Na Jornada: "Revisões de hoje: 6 cartões, ~3 min". Tocar abre a fila.
2. Cada cartão: a frente → "Tente lembrar antes de ver." → (opcional) "Quão seguro você está?" (Certeza / Acho que sei / Chute) → "Mostrar a resposta" → a resposta e a origem → **Errei** ou **Lembrei**.
3. Fim: "6 revisados, 5 lembrados. Próxima revisão em 2 dias." Se a aula de um cartão passou a "lembrada", a estação no mapa mostra a mudança de cor.
4. Uma vez por mês, com dados suficientes: a **calibração** — "Quando você disse 'certeza', acertou 92%. Quando disse 'acho que sei', 61%." (nenhum produto pesquisado tem; é o feedback de competência mais honesto).

A revisão antiga (por estação, intervalos fixos) migra: cada estação concluída com anotação vira um cartão com a anotação como resposta e "O que você leva de <estação>?" como frente, agendado pelo FSRS.

### J4 — Dominar uma estação (o desafio)

1. Com a estação percorrida, aparece "Desafio da estação": 10 a 15 cartões sorteados das aulas da estação (os da própria pessoa, com **2 dias ou mais** de escritos) + as perguntas das aulas de exercício, **um de cada aula de exercício**, de uma vez, sem olhar, com feedback ao fim.
2. Aprovado (≥ 80% dos sorteados): estação **dominada**, carimbo com **a frase do que foi medido** — "Percorreu as 93 aulas desta estação, escreveu 23 cartões e, dois dias ou mais depois, lembrou 12 de 14 deles, pela sua própria conferência. Não mede exercícios novos." — e a próxima estação que ela abre. Não a frase de competência: ela afirmava um saber-fazer que ninguém mediu.
3. Reprovado: "Faltaram 4. Eles voltam para a fila de hoje. Tente de novo quando quiser." Nada se perde, nada rebaixa. Uma estação **dominada** pode refazer o desafio; só um reprovado depois de dominada a devolve para percorrida — o tempo nunca rebaixa.

### J5 — Voltar depois de dias

1. Abre o Atlas: **"Continuar: Aula 13 — Circuitos Digitais, de 14:32"** (o cartão de retomada), e "Revisões de hoje: 18 cartões, ~8 min. Comece pelos 6 mais antigos." (com limite de novos e de revisões por sessão: a fila não vira dívida).
2. Nenhuma contagem de ausência, nenhum "você sumiu". Em começo de semana ou de mês, a frase de recomeço: "Semana nova. Uma aula e as revisões de hoje já movem o mapa."
3. Lembrete sem servidor: no fim de cada sessão, "Marcar a próxima sessão no seu calendário" gera um .ics com dia e hora que a pessoa escolhe.

### J6 — Mostrar o progresso

A caderneta (Perfil) e o bilhete (imagem compartilhável com o mapa da rede e o número de estações dominadas).

## A gamificação

**A caderneta de carimbos** (Perfil), com os espaços vazios visíveis, em duas séries:

- **Série do percurso** (premia o comportamento que leva a aprender, nunca minutos ou cliques):
  Embarque · Primeira aula estudada · Primeira revisão no dia seguinte · Primeiro cartão consolidado · Primeira estação percorrida · Primeira baldeação · De volta à linha (retomou depois de uma pausa; nunca diz quantos dias) · Calibrado (confiança bate com acerto em 20 revisões).
- **Série do domínio:**
  Uma por estação (35), com a frase de competência daquela disciplina · Fim de linha dominado (7) · Terminal.

Cada carimbo: o círculo da linha, a data e **a frase do que você passou a saber fazer**. Logo depois de cada carimbo, a próxima coisa ("Próxima estação: Estruturas de Dados. Ela pede Matemática Discreta, que você já dominou.").

**Recordes pessoais sem sequência:** "Mais cartões lembrados numa semana", "Maior estabilidade de um cartão". Nunca "dias seguidos".

**A narrativa:** a viagem de metrô. Estação, linha, baldeação, terminal — o vocabulário que o Atlas já tem.

**Celebração sem partículas:** o círculo da estação enche no mapa com a cor da linha (o movimento carrega a informação), e o carimbo desce na caderneta. Sem confete (decisão de tom, mantida).

## Os minijogos (fase 2, um por disciplina, sempre dentro da aula)

| Motor | Serve a | Exemplo |
|---|---|---|
| Múltipla escolha com distratores de concepção errada | todas | "Qual destas é a tabela-verdade do XOR?" com explicação do erro |
| Parsons (ordenar código), com teclado | Python I e II, Haskell, Estruturas | montar a função de busca binária |
| Qual a saída? | linguagens | prever o print de um laço |
| Conversor de bases | Circuitos Digitais | binário ↔ hexadecimal contra o relógio, sem pontos |
| Portas lógicas em escada | Circuitos, Arquitetura | do NAND ao somador, no espírito do Nand2Tetris |
| Grafos passo a passo com previsão | Grafos, Algoritmos | "qual nó a BFS visita agora?" |
| AFD com bateria de testes | Linguagens Formais | montar o autômato que aceita binários múltiplos de 3 |
| SQL de verdade (sql.js) | Banco de Dados | um caso em pt-BR, no espírito do SQL Murder Mystery |

Regra de todos: pergunta antes de animação, retorno imediato, níveis em vez de pontos, nada decorativo.

## Os dados (tudo no aparelho)

- **Catálogo enriquecido** (gerado por script, no repositório): cada estação ganha `aulas: [{ id, n, titulo, duracaoS, exercicio }]`. A fonte é a decisão D1.
- **Estudo** (`atlas.estudo.v1`, IndexedDB): por aula `{ abertaEm, estudadaEm, puladaEm }`; por estação `{ desafios: [{ em, acertos, total }] }`.
- **Cartões** (`atlas.cartoes.v1`, IndexedDB): `{ id, estacao, aula, frente, verso, criadoEm, fsrs: { estabilidade, dificuldade, devidoEm, repeticoes, lapsos, ultimaEm }, historico: [{ em, nota, confianca }] }`.
- **FSRS-6 implementado no próprio Atlas** (sem dependência, como o resto), com testes contra valores de referência do ts-fsrs gerados uma vez.
- **Durabilidade:** `navigator.storage.persist()` depois do primeiro cartão; exportar e importar (formato v4, que lê o v3 de hoje) sempre à vista no Perfil.
- **Migração:** o progresso atual vira "Concluída antes"; as anotações viram cartões.

## As fatias (ordem de construção)

| # | Fatia | Pronto quando |
|---|---|---|
| S12 | **As aulas no catálogo**: script de enriquecimento, `aulas` em cada estação, aulas de exercício marcadas | as 35 estações com aulas, total e duração somada batendo com a fonte |
| S13 | **A estação vira página**: a lista de aulas com os estados Não iniciada / Aberta / Estudada, "continuar de onde parei" | abrir uma estação mostra as N aulas; abrir uma aula grava o estado; volta ao ponto |
| S14 | **O fechamento da aula**: recordação, conferência, cartões com modelos e origem | uma aula fechada vira estudada e cria cartões; o modo mínimo também |
| S15 | **FSRS-6 e a fila nova**: o algoritmo testado contra referência, a fila do dia com dois botões, a migração da revisão antiga | os cartões voltam no dia certo; nenhum dado antigo se perde |
| S16 | **O mapa de dois eixos**: preenchimento e cor, a escada da estação, "pede revisão" | o mapa da Jornada e da rede mostram estudado × lembrado |
| S17 | **A caderneta**: as duas séries, os espaços vazios, a frase de competência das 35 estações, o bilhete | cada carimbo nasce do critério e mostra a frase |
| S18 | **O desafio da estação e o "já sei isso"** | dominar e pular funcionam e aparecem no mapa |
| S19 | **Durabilidade e volta**: persistência, exportar/importar v4, o .ics da próxima sessão, a frase de recomeço | o progresso sobrevive e volta por arquivo |
| S20 | **A primeira visita**: o topo novo da Jornada, o botão único, "já estudei algumas", a revisão de todos os textos | do link ao primeiro cartão sem fricção, conferido no celular |
| S21 | **O player embutido** (se D2 aprovado): retomar no segundo, "assistida ~X%", página de privacidade | |
| S22+ | **Minijogos**, um por disciplina, começando por Circuitos Digitais e Python I | |

Cada fatia sai especificada (composição, textos exatos, medidas, travas e provas) antes de ir para a Aurora, e passa pela conferência no Chrome de verdade (celular e computador) antes do push.

## Decisões que são do Lucas

- **D1 — De onde vêm as aulas.** (a) **YouTube Data API v3**, oficial, com uma chave sua do Google Cloud (gratuita para este volume: estimo pouco mais de 100 chamadas para as 35 playlists, contra a cota padrão de 10 mil unidades por dia), rodada por script e refeita uma vez por mês (os termos limitam guardar dados da API por mais de 30 dias). (b) Ler a página pública da playlist, sem chave: funciona (testado: Circuitos Digitais, 93 aulas com título e duração), mas os termos do YouTube proíbem acesso automatizado. **Recomendo (a).**
- **D2 — Player embutido.** Estudar dentro do Atlas (retomada no segundo exato, "assistida ~X%", só online), com a nova aba como alternativa. Exige página de privacidade e link para os termos do YouTube. **Recomendo sim, na S21, depois do núcleo.**
- **D3 — Pré-requisito avisa em vez de trancar.** **Recomendo avisar.**
- **D4 — Ritmo semanal opcional** ("4 sessões nesta semana", acumulado, nunca zerado). **Recomendo não, por ora**: é aversão à perda em outra roupa.
- **Lançamento:** o post sai quando S12 a S20 estiverem prontas e conferidas. Os minijogos podem ser o segundo post.
