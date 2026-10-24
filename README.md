# Projeto Atlas

App de estudo pessoal do Lucas, construído sobre o currículo aberto da
**Universidade Brasileira Livre (UBL)**. Roda no navegador como PWA, sem build e
sem dependências: o servidor é `node app/serve.js`, os testes são `node --test`.

## O que ele faz

- mostra as 35 disciplinas do currículo com pré-requisitos e o que fazer em
  seguida;
- separa as **eletivas** arquivadas na fonte, numa seção própria e fora da grade
  — elas não somam progresso, porque a fonte não as soma sem decisão editorial;
- lista as **especializações** com os recursos delas, e marca como *aguardando
  conteúdo* as que a fonte ainda tem "em construção";
- mostra a **bibliografia** de cada disciplina quando a fonte a traz, e quando
  não traz mostra o caminho na fonte com o aviso de que não foi conferido.

Regra da casa: **nada é inventado**. O que a fonte não tem aparece como faltando,
nunca preenchido com plausível.

## De onde vêm os dados

Fonte: [`Universidade-Livre/ciencia-da-computacao`](https://github.com/Universidade-Livre/ciencia-da-computacao),
auditada no SHA `b995c11` e transformada em `app/data/catalog.json` por
`tools/build-catalog.mjs`.

Os recursos externos — cursos, vídeos, livros — pertencem aos autores deles. O
Atlas só aponta para onde estão; não redistribui nada.

## Como rodar

```bash
node app/serve.js                 # abre o app (PORT opcional)
node --test app/tests/*.test.js   # 100 testes
```

No Windows, `node --test app/tests/` com a pasta quebra; passe os arquivos.

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
