# Design system do Atlas — mapa de metrô

O Atlas é a trilha de Ciência da Computação da Universidade Brasileira Livre
desenhada como uma **rede de metrô**. Este documento é a fonte de verdade do
desenho: o que a tela diz, que cor cada coisa tem, que tamanho, quanto tempo se
move e o que aparece em cada estado. Ele existe para ser seguido **sem olhar
para a tela** — quem implementa uma tela nova lê isto e acerta.

Os valores moram em `app/web/tokens.css`. Os textos moram em `app/core/textos.js`.
As regras que impedem o DS de apodrecer moram em `app/tests/design-system.test.js`.
Nenhum dos três é sugestão: cor, duração e ponto de quebra escritos à mão fora
do `tokens.css` **quebram a suíte**.

A jornada e a progressão (o que destranca o quê, o que conta como concluído)
estão em `design/JORNADA.md` e `app/core/`. Este documento não as repete e não
as contradiz: o DS é a pele delas.

---

## 1. Conceito e vocabulário

A grade é uma rede. Os **7 estágios** da fonte são **7 linhas** (Linha 1 a
Linha 7). As **5 disciplinas** de cada estágio são as **estações** daquela
linha. Pré-requisito é **conexão**; quando a conexão cruza de uma linha para
outra, é **baldeação**. As especializações são **ramais**, e as que a fonte
marca como não publicadas são **ramais em obras**. O progresso é a **viagem**.

**Nada inventado continua valendo.** A fonte não dá nome aos estágios, então as
linhas se chamam Linha 1 a Linha 7 — nunca "Fundamentos", "Bases", "Núcleo" ou
qualquer nome que não esteja no catálogo. Se um dia a fonte nomear, o nome vem
dela.

O tom é de **placa de metrô**: curto, direto, segunda pessoa. Placa não explica,
placa informa. "Algoritmos I" e não "A disciplina de Algoritmos I". "Falta
Algoritmos I" e não "Você precisa concluir Algoritmos I antes de prosseguir".

| A tela diz | Quando | Nunca diz |
|---|---|---|
| **Sua próxima estação** | cabeçalho do destaque, uma vez por tela | "Próxima matéria", "Recomendado para você" |
| **Linha 3** | nome da linha, sempre com o número e a cor ao lado | "Módulo 3", "Fase 3", "Etapa 3" |
| **estação concluída** | a disciplina está feita | "matéria finalizada", "concluído com sucesso" |
| **trancada: falta Algoritmos I** | a estação ainda não pode ser marcada; o nome do pré-requisito vem sempre | "indisponível", "bloqueada", "sem permissão" |
| **em curso** | a estação foi aberta e ainda não terminou | "em andamento", "iniciada" |
| **fim da linha** | as 5 estações de uma linha estão concluídas | "módulo completo", "parabéns!" |
| **Terminal** | as 35 estações da rede estão concluídas | "curso concluído", "100%" |
| **ramal** | uma especialização | "trilha alternativa", "extra" |
| **ramal em obras** | a especialização que a fonte ainda não publicou | "em breve", " indisponível" |
| **baldeação** | pré-requisito que vem de outra linha | "dependência externa", "pré-requisito cruzado" |
| **Como ler o mapa** | a legenda, a um toque de qualquer tela | "Ajuda", "Documentação", "?" |
| **salvo** | a anotação acabou de ser gravada | "sucesso", "alterações salvas com sucesso" |
| **desfazer** | alguns segundos depois de concluir | "reverter", "cancelar ação" |

Regra de ouro do vocabulário: **o substantivo é do metrô, o verbo é do estudo.**
"Concluir estação", "embarcar", "viajar" — nunca "concluir módulo", "iniciar
trilha". E nenhum texto de tela contém caminho de arquivo, URL crua, slug,
nome de campo JSON ou jargão de código.

---

## 2. Cor

**Fundo claro é cor de placa**: um branco quente, como a placa esmaltada da
estação. **Fundo escuro é carvão neutro** — nunca azul-marinho. O azul-marinho
genérico é exatamente o que fazia o Atlas parecer protótipo; ele está proibido.

Cada linha tem uma cor própria, como num metrô de verdade: **7 cores saturadas
e distintas**, uma por linha, e **cor de linha só marca linha**. Cor de linha
não significa "sucesso", "erro" nem "atenção" — para isso existem as cores de
estado, que são neutras ou de aviso e nunca uma das 7.

**O estado nunca é dito só pela cor: a forma diz também.** Quem não distingue
vermelho de verde precisa conseguir usar o Atlas inteiro.

| Estado da estação | Forma | Cor |
|---|---|---|
| **concluída** | círculo cheio | a cor da linha |
| **disponível** | anel grosso (3 px) com miolo claro | a cor da linha |
| **em curso** | meio círculo (metade cheia, metade anel) | a cor da linha |
| **trancada** | anel fino (1,5 px) | cinza, nunca cor de linha |

O **trecho já percorrido** da linha é a cor cheia; o **trecho que falta** é a
mesma cor a 25%. O trecho a 25% é preenchimento decorativo de um estado que a
forma e o texto já dizem — por isso ele mede abaixo de 3:1 contra o fundo
(1,6:1 no claro, 1,9:1 no escuro) e **nunca carrega significado sozinho**. O
anel da estação trancada, que é informação gráfica de estado, mede 3,44:1 no
claro e 4,32:1 no escuro — acima dos 3:1 que a WCAG 1.4.11 exige.

### As 7 cores de linha, com a conta

Conta: contraste WCAG 2.1, `(L1 + 0,05) / (L2 + 0,05)` sobre a luminância
relativa, com `c ≤ 0,03928 ? c/12,92 : ((c+0,055)/1,055)^2,4`. A mesma conta
está em `app/tests/design-system.test.js` e roda a cada teste — o número deste
documento não é decoração, é o que a suíte cobra.

Fundo claro `#FBF7F0` (papel), fundo escuro `#17181A` (carvão).

| Linha | Claro (hex) | Contraste | Escuro (hex) | Contraste |
|---|---|---|---|---|
| **L1** vermelho | `#C1121F` | **5,83:1** AA | `#FF6B6B` | **6,40:1** AA |
| **L2** laranja | `#B24A00` | **5,08:1** AA | `#FF9A4D` | **8,44:1** AA |
| **L3** ouro | `#7A5B00` | **5,92:1** AA | `#E8C547` | **10,58:1** AA |
| **L4** verde | `#1E7A3C` | **5,04:1** AA | `#4CD07D` | **8,99:1** AA |
| **L5** água | `#0A6E75` | **5,62:1** AA | `#4FD1D9` | **9,69:1** AA |
| **L6** azul | `#1D4ED8` | **6,28:1** AA | `#7AA7FF` | **7,44:1** AA |
| **L7** ameixa | `#7B2D8B` | **7,59:1** AA | `#D98CE8` | **7,50:1** AA |

As 14 passam em **AA para texto normal (≥ 4,5:1)**, não só para texto grande.
Isso é de propósito: o nome da linha aparece em corpo pequeno no selo, e a cor
da linha é usada como cor de texto no cabeçalho ("Linha 3" na cor da linha 3).

As 7 são distinguíveis entre si em matiz — vermelho, laranja, ouro, verde, água,
azul, ameixa — e não só em luminosidade, para sobreviver à impressão em tons de
cinza e à daltonismo de eixo vermelho-verde (onde o que separa L1 de L4 é o
número no selo e a posição na rede, nunca a cor sozinha).

### Tintas e neutros

| Papel | Claro | Contraste | Escuro | Contraste |
|---|---|---|---|---|
| Fundo (papel / carvão) | `#FBF7F0` | — | `#17181A` | — |
| Cartão / superfície | `#FFFDF8` | — | `#202124` | — |
| **Tinta** (texto principal) | `#16130F` | **17,34:1** AA | `#F4F1EC` | **15,77:1** AA |
| **Fosca** (texto secundário) | `#635B50` | **6,26:1** AA | `#AEA9A0` | **7,60:1** AA |
| Borda de placa | `#DED6C8` | 1,35:1 (decorativa) | `#33343A` | 1,43:1 (decorativa) |
| Anel de trancada | `#8B8578` | **3,44:1** (1.4.11) | `#7C7D81` | **4,32:1** (1.4.11) |
| Alerta / obras | `#8A5A00` | **5,55:1** AA | `#E0A94A` | **8,41:1** AA |

Borda é decorativa: separa superfície, não carrega informação — por isso pode
ficar abaixo de 3:1. Todo o resto passa.

**Cor fora dos tokens é proibida.** Não existe "um cinza um pouco mais escuro
aqui": se precisa de uma cor nova, ela entra no `tokens.css` com nome e motivo,
e o teste de contraste passa a cobri-la.

---

## 3. Tipo

**Uma família só**, de placa de sinalização: **Overpass**, desenhada a partir da
sinalização rodoviária americana — é literalmente uma fonte de placa. Pesos
**400, 700 e 900**. Mais a **Overpass Mono** para números e códigos (contador da
viagem, número da linha, contagem de estações).

- Licença: **SIL Open Font License 1.1**, transcrita e creditada em `CREDITS.md`.
- Arquivos: `app/fonts/overpass-latin-var.woff2` (39.380 bytes) e
  `app/fonts/overpass-mono-latin-var.woff2` (22.012 bytes), **woff2**, só o
  subconjunto `latin`. Os dois estão no precache do `sw.js`: **offline sem a
  fonte seria outra cara.**
- São **fontes variáveis**. O eixo `wght` vai de 100 a 900 na Overpass e de 300
  a 700 na Mono, então os três pesos que o DS usa saem do mesmo arquivo — foi
  por isso que o download trouxe 2 arquivos e não 6. Proveniência (URL, peso
  declarado, bytes, sha256) está no `CREDITS.md`.
- `font-display: block`: a fonte **é** a cara do Atlas. Melhor um instante sem
  texto do que a tela aparecendo com outra tipografia e trocando na frente da
  pessoa.

### Escala — 5 tamanhos, e só 5

| Token | Tamanho | Entrelinha | Peso | Uso |
|---|---|---|---|---|
| `--tipo-estacao` | **32 px** | 1,1 | 900 | o nome da estação em "Sua próxima estação" |
| `--tipo-titulo` | 22 px | 1,2 | 700 | título de tela, nome da linha no cabeçalho |
| `--tipo-corpo` | 16 px | 1,5 | 400 | texto corrido, descrição da estação |
| `--tipo-placa` | 13 px | 1,3 | 700 | selos, etiquetas, status — caixa alta, espaçamento de placa |
| `--tipo-nota` | 12 px | 1,4 | 400 | origem, bibliografia, aviso secundário |

**O nome da estação na "próxima estação" é o maior texto da tela** (32 px). Nada
pode ser maior: se um título de seção competir com ele, a hierarquia mente — a
próxima estação é a coisa mais importante que a tela tem a dizer.

`--tipo-placa` é caixa alta com `letter-spacing: 0,08em`, como a serigrafia da
placa. É o único lugar onde caixa alta é permitida.

Números que contam (35 estações, 12 concluídas, Linha 3) usam **Overpass Mono**
com `font-variant-numeric: tabular-nums`: contador que muda de largura a cada
dígito faz a placa tremer.

---

## 4. Espaço e forma

**Escala de 4 em 4 px.** Não existe 5, 7, 13 ou 18 px de margem. Se o valor não
está na escala, o valor está errado.

| Token | Valor | Uso |
|---|---|---|
| `--espaco-1` | 4 px | respiro interno mínimo, entre selo e número |
| `--espaco-2` | 8 px | entre elementos de um mesmo grupo |
| `--espaco-3` | 12 px | padding de cartão |
| `--espaco-4` | 16 px | entre grupos, margem de tela no celular |
| `--espaco-6` | 24 px | entre seções |
| `--espaco-8` | 32 px | entre blocos grandes |

### Forma

| Token | Valor | Onde |
|---|---|---|
| `--trilho` | **6 px** | espessura da linha desenhada |
| `--estacao` | **14 px** | diâmetro da estação no mapa |
| `--estacao-proxima` | **22 px** | diâmetro da próxima estação (a única maior) |
| `--raio-estacao` | 50% | estação é **círculo**, sempre |
| `--raio-placa` | 4 px | cartões, painéis, botões |
| `--raio-selo` | 2 px | selos e etiquetas — quase reto, como placa |

**A estação é círculo; o resto é quase reto (2 a 4 px).** Cartão arredondado de
12 px é cara de app genérico; placa de metrô tem canto vivo. O único círculo do
sistema é a estação e o selo de linha.

Alvo de toque: **44 px mínimo** em qualquer coisa tocável, em qualquer tema e
qualquer largura. O círculo de 14 px da estação é o desenho; a área clicável em
volta dele é de 44 px. Desenho e alvo são coisas diferentes e os dois valem.

---

## 5. Movimento

Três vozes, cada uma com duração e curva próprias nos tokens. Movimento tem
significado: se dura pouco é **máquina respondendo ao toque**; se dura meio
segundo é **o trem chegando**; se pulsa devagar é **onde você está**.

| Voz | Token | Duração | Curva | Uso |
|---|---|---|---|---|
| **mecânica** | `--movimento-toque` | **100 ms** | `--curva-mecanica` (`cubic-bezier(0,0,0.2,1)`) | toque, foco, hover, pressionar botão |
| **chegada** | `--movimento-chegada` | **520 ms** | `--curva-chegada` (`cubic-bezier(0.16,1,0.3,1)`) — saída suave | concluir uma estação |
| **você está aqui** | `--movimento-pulso` | **2000 ms** | `--curva-pulso` (`ease-in-out`), ida e volta | anel da próxima estação |

### Chegada (a celebração do Atlas)

Ao concluir uma estação, nesta ordem, tudo dentro dos 520 ms:

1. o **trecho da linha se preenche** da estação anterior até esta — o trilho a
   25% vira cor cheia da esquerda para a direita (ou de cima para baixo, na
   linha vertical do celular);
2. o **círculo enche**: o anel grosso da disponível vira círculo cheio;
3. as estações que **destrancaram** dão um **pulso curto de anel** (um anel que
   cresce e some, 400 ms, uma vez);
4. o **contador avança** — o número sobe, sem animação de roleta.

**Sem confete. Sem som. Sem modal de parabéns.** A chegada é o trem encostando:
você vê o trecho encher e sabe que andou. Qualquer coisa além disso é o app se
elogiando.

### Você está aqui

Um anel que **pulsa devagar** (2 s, ida e volta, opacidade e escala de 1 para
1,15) em volta da **próxima estação** — **uma por tela**. Duas estações pulsando
ao mesmo tempo são duas "próximas estações", e isso é mentira: o mapa tem de ter
um só lugar onde você está.

### Movimento reduzido

Com `prefers-reduced-motion: reduce`, **todo movimento vira troca de estado
instantânea e o pulso some**. Não é "mais devagar": é sem animação. O trecho
aparece preenchido, o círculo aparece cheio, o contador aparece com o número
novo. Nenhuma informação se perde — quem reduziu movimento vê exatamente o
mesmo estado final, só sem a viagem até ele.

### View Transitions API

Entra **só onde o navegador tem**, como enfeite que não faz falta:
`if ('startViewTransition' in document)`. Sem fallback de animação própria — o
estado muda de qualquer jeito, a transição é o que pode faltar. Nunca uma
informação depende de a View Transition ter rodado.

---

## 6. Os estados

Todos obrigatórios. O texto exato de cada um está em **`app/core/textos.js`**,
num lugar só: nem a tela nem o teste inventam frase. Se o texto mudar, muda lá.

| Estado | O que aparece | Regra |
|---|---|---|
| **carregando** | o **esqueleto de uma linha**: um traço cinza e 5 círculos cinza, **parados** | só aparece **se demorar mais de 150 ms**. Antes disso, nada — piscar esqueleto em 40 ms é pior que não ter esqueleto. **Sem brilho correndo**: shimmer é spinner disfarçado |
| **primeira visita** (0 concluídas) | o **embarque**: diz por onde começar e que dá para marcar o que você já estudou | não é tutorial de 4 telas. É uma placa: "Comece pela Linha 1" + "Já estudou alguma? Marque" |
| **busca sem resultado** | diz **o que você buscou** e oferece **limpar** | "Nada encontrado para «algoritmo»." + botão Limpar. Repetir o termo prova que a busca ouviu |
| **offline** | um **selo discreto** de que tudo continua funcionando | discreto: não é banner vermelho. O Atlas offline é o Atlas inteiro — o catálogo está no precache |
| **fim da linha** | um **carimbo de bilhete** na linha completa | carimbo é forma, não cor: círculo com o número da linha e a data. **Sem confete** |
| **Terminal** | as **35 concluídas**, com o convite a **exportar o progresso** | o fim da viagem tem nome próprio e uma saída útil: levar o progresso embora |
| **erro** | o catálogo não carregou, em **três partes** | **o que falhou · por quê · o que fazer agora**. Erro de duas partes deixa a pessoa sem ação |
| **ramal em obras** | o que a fonte **ainda não publicou** | honesto: o Atlas não inventa conteúdo para parecer completo |

Os três estados que **não** são tela cheia — carregando, offline, salvo — têm
`aria-live="polite"`; erro tem `aria-live="assertive"`. O pulso de "você está
aqui" tem `aria-hidden="true"`: é enfeite, e leitor de tela não precisa dele
porque a próxima estação já está escrita em texto.

---

## 7. Layouts

**O Atlas nasce para o celular**, mas cada tamanho de tela tem a **sua
composição própria** — não a do celular esticada. Os pontos de quebra estão nos
tokens (`--bp-celular`, `--bp-tablet`, `--bp-computador`, `--bp-tela-larga`).

| Largura | Composição |
|---|---|
| **celular** (até 599 px) | No topo, **a próxima estação** — o maior texto da tela. Abaixo, **uma linha por vez**, desenhada **na vertical**, como o diagrama colado na porta do trem. Os **selos das 7 linhas** formam um seletor que **rola de lado** (`overflow-x`, com snap). A estação abre numa **folha que sobe de baixo** |
| **tablet** (600–1023 px) | **Duas colunas**: a linha na vertical à esquerda, a estação escolhida num **painel fixo** à direita. Funciona **em pé e deitado** — as duas proporções, sem quebrar nenhuma |
| **computador** (1024–1439 px) | O **mapa da rede inteira**: as 7 linhas **na horizontal, uma sobre a outra**, como num mapa de metrô de verdade, **com as baldeações desenhadas**. A estação abre num **painel lateral** |
| **tela larga** (≥ 1440 px) | O mapa + o painel da estação + uma **coluna fixa com a viagem** (o progresso por linha). Três composições vivas ao mesmo tempo, cada uma com o seu papel |
| **app instalado** | respeita `env(safe-area-inset-*)` nos quatro lados | sem a barra do navegador a tela vai até a borda: conteúdo colado no recorte da câmera é conteúdo ilegível |
| **impressão** | o mapa da rede vira **um pôster numa página**, com o progresso marcado | preto e branco: o que separa as 7 linhas na impressão é o **número no selo** e o **nome da estação**, nunca a cor |

### Toque, mouse e teclado têm o mesmo poder

- **toque**: alvo de **44 px** mínimo em tudo que é tocável;
- **mouse**: hover **só** dentro de `@media (hover: hover)` — hover em tela de
  toque fica grudado depois do toque e mente sobre o que está selecionado;
- **teclado**: no computador, **as setas andam pelas estações da linha** (cima/
  baixo na vertical do celular e do tablet, esquerda/direita no mapa
  horizontal), **Enter** abre a estação, **Esc** fecha a folha ou o painel, e
  **"/" abre a busca**. Foco visível sempre (`:focus-visible` com anel de 2 px
  em cor de tinta, nunca em cor de linha — foco não é estado de progresso).

Nenhuma ação é exclusiva de um dos três. Se o teclado não alcança, a ação não
existe.

---

## 8. As 10 heurísticas de Nielsen, aplicadas

Não são aspiração: cada uma tem **onde se confere**. Se a coluna "Onde se
confere" estiver vazia, a heurística não está implementada — e o teste
`design-system.test.js` reprova.

| # | Heurística | A regra concreta no Atlas | Onde se confere |
|---|---|---|---|
| 1 | **Visibilidade do estado do sistema** | o contador da viagem sempre à vista, o anel de "você está aqui" numa estação só, o selo de offline, o "salvo" da anotação e o esqueleto parado depois de 150 ms | `tests/render.test.js` (contador e destaque desenhados), `tests/notes.test.js` (o "salvo" aparece), `tests/design-system.test.js` (os textos existem), captura de tela do celular no pedido de tela |
| 2 | **Correspondência com o mundo real** | vocabulário de metrô em português: estação, linha, baldeação, ramal, viagem. Sem caminho de arquivo, sem URL crua, sem jargão | `tests/portugues-tela.test.js`, `tests/design-system.test.js` (vocabulário nos textos), `tests/links-repo.test.js` (nenhum caminho cru vira texto) |
| 3 | **Controle e liberdade** | "desfazer" por alguns segundos depois de concluir; limpar a busca; fechar a folha com Esc **ou** com o gesto de voltar; exportar e importar o progresso | `tests/viagem.test.js` (desfazerConclusão), `tests/progress-io.test.js` (exportar/importar), `tests/boot.test.js` (Esc e voltar fecham) |
| 4 | **Consistência e padrões** | o mesmo estado tem a mesma forma em todo lugar — concluída é círculo cheio no mapa, no selo e no cartão. Folha no celular, painel no computador, como cada plataforma espera | `tests/design-system.test.js` (uma forma por estado nos tokens), `tests/grid-celulas.test.js`, captura nas 4 larguras |
| 5 | **Prevenção de erro** | a estação trancada **diz o que falta** em vez de deixar concluir; importar mostra **o que vai mudar** antes de trocar o progresso | `tests/viagem.test.js` (trancada não conclui), `tests/progress-io.test.js` (pré-visualização do import), `tests/render.test.js` (o nome do pré-requisito aparece) |
| 6 | **Reconhecer em vez de lembrar** | a próxima estação sempre à vista; pré-requisitos **pelo nome**, nunca por código; selos de linha com **número e cor**; "Como ler o mapa" sempre ao alcance | `tests/render.test.js`, `tests/nextup.test.js`, `tests/electives.test.js`, captura de tela |
| 7 | **Flexibilidade e eficiência** | atalhos de teclado (setas, Enter, Esc, "/"); busca; link direto para uma estação (`#/estacao/<slug>`); marcar várias de uma vez no embarque | `tests/boot.test.js` (rota e atalhos), `tests/search.test.js`, `tests/design-system.test.js` (textos do embarque) |
| 8 | **Estética e minimalismo** | **uma ação principal por tela**; os detalhes (bibliografia, origem) vivem **dentro da estação**, nunca no mapa | `tests/bibliography.test.js`, `tests/design-system.test.js` (lista do proibido), captura de tela |
| 9 | **Reconhecer, diagnosticar e recuperar de erros** | todo erro em **três partes**: o que falhou, por quê, o que fazer agora | `tests/design-system.test.js` (as três partes existem e não estão vazias em `textos.js`), `tests/boot.test.js` (o erro é desenhado com as três) |
| 10 | **Ajuda e documentação** | "Como ler o mapa" a um toque; o embarque na primeira visita; página "Sobre" com créditos e a origem dos dados | `tests/design-system.test.js` (os textos), `tests/credits.test.js` (CREDITS.md e a origem), `tests/pages.test.js` |

---

## 9. Proibido

A lista do que faz o Atlas voltar a parecer protótipo gerado por IA. Cada item
tem o motivo — não é gosto, é o defeito que apareceu na tela real.

| Proibido | Por quê |
|---|---|
| **degradê roxo** | a assinatura visual de "feito por IA". O Atlas é placa, e placa tem uma cor só |
| **vidro fosco** (`backdrop-filter`) | placa de metrô é opaca. Vidro esconde o que está embaixo e custa caro no celular |
| **sombra decorativa** | sombra aqui só pode ser a de elevação real (folha que sobe). Sombra em cartão plano é ruído |
| **emoji** | não é vocabulário de sinalização, e renderiza diferente em cada sistema |
| **confete** | a chegada já é o trecho enchendo. Confete é o app se elogiando |
| **spinner** | o esqueleto da linha diz mais: mostra a forma do que vem. Spinner não diz nada |
| **brilho de esqueleto correndo** (shimmer) | é um spinner deitado. O esqueleto do Atlas fica **parado** |
| **fonte do sistema como principal** | foi o que deu a cara de protótipo. A principal é Overpass; a do sistema só serve de fallback |
| **URL crua ou caminho de arquivo como texto na tela** | vira **link com nome**. `C:/Users/...` na tela é o app mostrando as entranhas |
| **cor fora dos tokens** | cor escrita à mão não passa pela conta de contraste e não troca com o tema |
| **duração escrita à mão** | movimento fora dos tokens não pertence a nenhuma das três vozes |
| **número de largura à mão em `@media`** | ponto de quebra que não é um dos 4 é um quinto layout que ninguém testou |
| **nome de estágio inventado** | a fonte não nomeia os estágios. É Linha 1 a Linha 7 |

---

## Migração: o que este pedido mudou na tela

**Nada, de propósito.** Este pedido entrega o DS e as travas; a tela redesenhada
vem nos próximos, um pedaço por vez.

Para a trava de cor valer já, o CSS que existia passou a usar tokens: as cores
anteriores viraram tokens **provisórios** em `app/web/tokens.css`, todos com o
comentário `PROVISÓRIO` e o nome prefixado `--p-*`. Eles guardam a aparência de
hoje — que é exatamente a que o Lucas rejeitou: fundo azul-marinho `#0b1020`,
cartão `#151b30`, texto `#e8ecf7`. Estão vivos só para a tela não mudar antes da
hora, e **morrem no pedido que redesenha a primeira tela**: o que for migrado
passa a usar `--fundo`, `--tinta`, `--linha-N`, e o provisório correspondente é
apagado. Um token provisório que sobrevive ao redesenho daquela tela é dívida, e
o comentário diz de quem.

Duas exceções honestas, as únicas mudanças visíveis deste pedido:

1. o `@media (min-width: 620px)` do CSS atual virou `min-width: 600px`, porque
   620 era número escrito à mão e o DS fixa o tablet em 600. Efeito: entre 600 e
   619 px a tela passa a usar o respiro largo (padding e `h1` maiores) 20 px
   antes. Nenhuma estrutura muda;
2. a Overpass passa a estar **declarada e no precache**, mas ainda **não é
   aplicada** — o corpo segue com a pilha do sistema até o pedido que redesenha
   a primeira tela. Declarar sem aplicar custa ~1 KB de CSS e nenhum byte de
   fonte: o navegador só baixa o woff2 quando algum elemento usa a família.

---

## Como conferir se isto está valendo

```
node --test app/tests/
```

`app/tests/design-system.test.js` é a trava: cor escrita à mão fora do
`tokens.css`, duração em ms ou s fora dos tokens, contraste abaixo de AA, fonte
fora do precache ou sem licença creditada, ponto de quebra à mão, heurística sem
forma de conferir e texto de estado vazio — cada um desses derruba a suíte.
