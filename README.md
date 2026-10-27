# Projeto Atlas

Trilha de Ciência da Computação da **Universidade Brasileira Livre (UBL)** em forma
de app: mostra as 35 disciplinas, o que está destrancado pelo que você já fez e o
que estudar em seguida. Roda no navegador, instala no celular e funciona offline.

Sem build, sem dependências, sem framework. O conteúdo vem de uma fonte aberta
auditada, e **nada é inventado**: o que a fonte não tem aparece como faltando.

## Como abrir

- **Online:** ainda não está no ar. O workflow do GitHub Pages está pronto
  (`.github/workflows/pages.yml`), mas o Pages do repositório ainda está
  desligado — ligá-lo é decisão do Lucas, e não se faz pelo CI.
- **Local:**
  ```bash
  node app/serve.js     # sobe o app (porta pela variável PORT, se precisar)
  npm test --prefix app # roda a suite inteira
  ```
  Abrir `index.html` direto no arquivo não basta: service worker exige http(s).

## O que já tem

- **Grade obrigatória:** as 35 disciplinas da fonte com pré-requisitos, organizadas
  em estágios, e destaque do que fazer em seguida.
- **Eletivas:** em seção própria, marcadas como arquivadas na fonte e **fora** do
  progresso — a fonte não as soma na grade, então o Atlas também não.
- **Especializações:** as 9 da fonte com os 75 recursos delas; as 3 que a fonte tem
  "em construção" aparecem como *aguardando conteúdo*, com o motivo escrito.
- **Bibliografia:** o caminho de cada disciplina na fonte, e o aviso explícito de
  que o conteúdo não foi conferido quando ela não traz a bibliografia pronta.
- **PWA:** instalável no celular e com a trilha inteira no cache — offline sem dados
  seria offline inútil.
- **Busca:** campo no topo filtra grade obrigatória, eletivas e especializações pelo
  nome, sem acento nem caixa importarem (`calculo` acha *Cálculo*); busca sem
  resultado diz que não achou, em vez de deixar a tela muda. A regra mora em
  `app/core/search.js`, com teste no node.
- **Progresso portátil:** *Exportar progresso* baixa um `.json` com as disciplinas
  concluídas; *Importar progresso* lê esse arquivo em outro navegador ou aparelho.
  A validação (formato, versão, ids desconhecidos contados) mora em
  `app/core/progress-io.js`, com teste.
- **Proveniência na tela:** de qual commit da fonte o catálogo foi derivado, visível
  para quem está usando.

## O que ainda falta

Honesto, sem enfeite:

- **O app não está publicado.** O Pages está preparado, não ligado. Enquanto isso,
  ninguém abre o Atlas sem clonar o repositório.
- **Offline e instalação não foram confirmados num celular de verdade.** Node não
  executa service worker: o que está testado é que os arquivos existem, são servidos
  com o content-type certo e o precache está sincronizado com o disco. A instalação
  real no Android ainda é uma promessa.
- **Licença do código não foi escolhida.** Está proposta, não aplicada (veja abaixo).
- **Sem anotações, sem lembrete de estudo.** O progresso fica no `localStorage` do
  aparelho, mas não é mais refém dele: exporte o `.json` numa máquina e importe na
  outra (seção *Leve o seu progresso junto*, no fim da tela).
- **A fonte não é fixada por commit em tudo.** O currículo principal está auditado
  no SHA `b995c11`; as eletivas vêm de material que a fonte ainda move, e a tela diz
  isso.

## De onde vêm os dados

Fonte: [`Universidade-Livre/ciencia-da-computacao`](https://github.com/Universidade-Livre/ciencia-da-computacao),
auditada no SHA `b995c11` e transformada em `app/data/catalog.json` por
`tools/build-catalog.mjs`.

Os recursos externos — cursos, vídeos, livros — pertencem aos autores deles. O
Atlas só aponta para onde estão; não redistribui nada.

## Como foi feito

O Atlas foi escrito pela **Aurora**, uma assistente de arquitetura cognitiva que
trabalha com o Lucas no dia a dia: ela lê a fonte, deriva o catálogo, escreve o
código e os testes, e registra o que decidiu e por quê.

O **Claude** entrou como revisor e juiz: leu o que a Aurora fez, apontou o que
estava errado ou apenas plausível demais, e arbitrou as discordâncias. Várias
decisões deste repositório existem porque ele não aceitou a primeira versão — entre
elas, marcar como não verificado o que ninguém conferiu.

As regras do jogo: nada de dado inventado, cada mudança com teste antes, um commit
por item e o histórico do que se decidiu mantido junto do código.

## Créditos e licença

Todo o conteúdo curricular vem da UBL, sob **MIT License**
(copyright 2021, Universidade Brasileira Livre), auditada no SHA `b995c11`.
A MIT exige atribuição e permite inclusive uso comercial; não exige a mesma
licença para obras derivadas.

**Detalhe completo, lista dos 13 autores e o que cada licença cobre:
[CREDITS.md](CREDITS.md).**

### Licença do código do Atlas — PROPOSTA, ainda não aplicada

A escolha é do **Lucas**, e nada foi aplicado até ele decidir: não há arquivo
`LICENSE` na raiz deste repositório.

**Proposta: MIT.**

Motivo: a fonte é MIT, então MIT é compatível por construção — não cria
obrigação nova nem conflito de redistribuição, e mantém a liberdade que a UBL
deu ao publicar o currículo. Para um repositório público que serve de portfólio,
é o que menos atrito cria para quem quiser ler, usar ou estudar o código.

Alternativa, se o Lucas quiser copyleft: **CC BY-SA 4.0 para o conteúdo** mais
**MIT (ou GPL-3.0) para o código**. É defensável, mas exige separar as duas
coisas no README e obriga quem derivar a manter a mesma licença — mais fricção,
e não é o que a fonte pede.

Seja qual for a decisão, o aviso de copyright da UBL e o texto de permissão da
MIT precisam continuar no `CREDITS.md`. Isso não é opcional.

## Testes

145 testes em 15 arquivos (contados na saída do runner em 27/10/2026),
sem framework: `node:test`. O `npm test` lista os arquivos um a um de propósito —
funciona igual em qualquer shell, e `app/tests/npm-script.test.js` falha a suite se
alguém criar um teste novo e esquecer de colocá-lo na lista.
