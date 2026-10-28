# Como contribuir

O Atlas é um app de estudo feito em cima do currículo aberto da
[Universidade Brasileira Livre](https://github.com/Universidade-Livre/ciencia-da-computacao).
Não há dependência nenhuma — nem de teste: a suíte roda no `node:test`, que vem
no Node. Para rodar, basta ter o Node instalado.

## Rodar

```bash
node app/serve.js
```

Depois abra o endereço que o servidor imprimir (a variável `PORT` muda a porta).
Abrir o `app/index.html` direto no arquivo **não** funciona: o service worker
exige http(s), e sem o fetch do catálogo a tela cai num conteúdo mínimo.

## Testar

```bash
npm test --prefix app
```

A suíte roda no Node, sem navegador e sem instalar nada. Ela cobre as regras puras
(pré-requisitos, progresso, export/import, busca, anotações), os dados derivados
da fonte, os textos que aparecem na tela, o service worker e os documentos do
repositório — inclusive este aqui: links relativos quebrados reprovam.

**Criou um arquivo de teste novo?** Ele precisa entrar na lista do
[`app/package.json`](app/package.json). A lista é explícita de propósito (funciona
igual em qualquer shell, sem depender de quem expande glob) e
[`app/tests/npm-script.test.js`](app/tests/npm-script.test.js) reprova a suíte se
um teste existir no disco e estiver fora da lista.

## A diferença que importa: conteúdo vs. app

**Erro no conteúdo do currículo não se corrige aqui.** Nome de disciplina,
pré-requisito, ordem dos estágios, link de curso, livro da bibliografia: tudo isso
vem da fonte da UBL, auditada no SHA `b995c11`, e é derivado em
[`app/data/catalog.json`](app/data/catalog.json) por
[`tools/build-catalog.mjs`](tools/build-catalog.mjs). O Atlas não digita conteúdo
à mão. Editar o JSON gerado seria desmentir a fonte — e a correção sumiria na
próxima reconstrução do catálogo.

- O caminho é abrir a issue na fonte:
  <https://github.com/Universidade-Livre/ciencia-da-computacao/issues>
- Se quiser, registre aqui também com o modelo **"Um dado parece errado"**, para o
  catálogo ser reconstruído quando a fonte aceitar a correção. O crédito é de quem
  mantém o currículo; o Atlas só aponta para ele.

**Erro no app se corrige aqui.** A tela, o cálculo do que está destrancado, o
export/import do progresso, o offline, a busca, a acessibilidade, os testes.

## Regras da casa

1. **Teste antes.** Escreva o teste que falha, depois o código que o faz passar.
   Suíte inteira verde antes de cada commit — o CI roda o mesmo comando.
2. **Um commit por causa.** Não por arquivo, não por dia. A mensagem diz a causa e
   sai do que está de fato no commit (`git diff --cached`), não do que se pretendia.
3. **Nada de dado inventado.** O que a fonte não tem aparece como faltando, com o
   motivo. O que ninguém conferiu é marcado como não conferido. Número sem data de
   medição não entra em documento.
4. **Proveniência visível.** Mudou o catálogo? Diga de qual SHA da fonte veio.
5. **Português correto na tela.** O app é lido por gente estudando; acento e nome
   próprio não são detalhe cosmético.
6. **`tmp/` fica fora do commit.** É rascunho de trabalho, não é conteúdo.

## Antes de abrir o pull request

- [ ] `npm test --prefix app` verde;
- [ ] cada commit tem uma causa só, e a mensagem bate com o diff;
- [ ] nada foi afirmado sem ter sido conferido (link, número, comportamento);
- [ ] se a mudança é de conteúdo curricular, ela foi para a fonte da UBL.

Dúvida ou discordância de uma decisão: abra uma issue. Várias decisões deste
repositório existem porque alguém não aceitou a primeira versão — o histórico do
que se decidiu fica junto do código, nos comentários dos testes.

Créditos e licença: [CREDITS.md](CREDITS.md) e [LICENSE](LICENSE).
