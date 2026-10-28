// Projeto Atlas — o README de quem chega pelo post.
//
// Por que um teste de README: ele e a primeira coisa que quem chegou pelo
// LinkedIn le, e e o lugar mais facil de mentir sem querer — um link do Pages
// que ainda nao existe, um "funciona offline" que ninguem conferiu no celular,
// um numero de testes velho. Este arquivo cobra tres coisas concretas:
//   1. o README diz o que FALTA (nao so o que ja tem);
//   2. nao apresenta como vivo um link do Pages que ainda nao esta no ar;
//   3. diz como foi feito (Aurora escrevendo, Claude revisando e julgando).
// Nao cobra redacao: so o que, se sumir, torna o README desonesto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const RAIZ_REPO = new URL('../../', import.meta.url);
const ler = async (caminho) => readFile(new URL(caminho, RAIZ_REPO), 'utf8');

test('README: diz o que ja tem E o que ainda falta', async () => {
  const r = await ler('README.md');
  for (const secao of ['Para quem é', 'Abrir', 'O que faz', 'Próximos passos']) {
    assert.ok(r.includes(secao), `falta a secao "${secao}" — quem chega pelo post precisa dela`);
  }
  // As cinco entregas que a nota do bastao registra, citadas pelo nome.
  for (const item of ['eletivas', 'especializações', 'bibliografia', 'PWA']) {
    assert.match(r, new RegExp(item, 'i'), `README nao menciona ${item}`);
  }
});

test('README: nao apresenta como vivo um Pages que ainda nao esta no ar', async () => {
  const r = await ler('README.md');
  // Link de verdade para github.io so pode existir se o Pages ja estiver ligado.
  const linkVivo = /\]\(\s*https:\/\/[^)]*github\.io[^)]*\)/.test(r);
  if (!linkVivo) {
    assert.match(
      r,
      /ainda n[aã]o est[aá] no ar|Pages.*desligado|desligado.*Pages/i,
      'sem link e sem aviso, quem le nao sabe se o app esta publicado ou nao'
    );
    return;
  }
  // Se um dia o Lucas ligar o Pages, o README precisa para de dizer que esta fora.
  assert.ok(
    !/ainda n[aã]o est[aá] no ar/i.test(r),
    'README diz que o Pages nao esta no ar E traz um link vivo: um dos dois esta errado'
  );
});

test('README: diz como foi feito, com quem escreveu e quem julgou', async () => {
  const r = await ler('README.md');
  assert.match(r, /Aurora/, 'quem escreveu o codigo precisa estar dito');
  assert.match(r, /Claude/, 'quem revisou e julgou precisa estar dito');
});

// Historico desta cobranca, para nao repetir o erro:
//   - v1 era VAZIA: aceitava "n === arquivos || n >= arquivos*5", entao qualquer
//     numero acima de 100 passava. O README dizia "149 testes em 16 arquivos"
//     (medicao de 27/10) com a suite em 191 e 20 — o teste criado para pegar
//     numero velho nao pegou nada.
//   - v2 passou a cobrar EXATO o numero de arquivos e a data da medicao. Melhor,
//     mas continuava sendo um numero escrito a mao: envelhece a cada commit que
//     acrescenta teste, e obriga alguem a lembrar de editar o README.
//   - v3 (agora) troca o numero pelo SELO do workflow: o badge do GitHub mostra
//     o resultado da ultima run no main, entao nao existe versao desatualizada
//     dele. O que este teste cobra e o que faz o selo ser VIVO e nao decoracao:
//     o workflow tem de existir, o nome no badge tem de ser o nome do workflow,
//     o branch tem de ser o branch certo — e o README nao pode voltar a citar
//     contagem a mao do lado dele.
test('README: o estado dos testes vem de um selo vivo, nao de numero escrito a mao', async () => {
  const r = await ler('README.md');
  const yml = await ler('.github/workflows/test.yml');

  // 1. O workflow existe, tem nome e roda a MESMA suite que se roda aqui. Sem
  //    isso o selo seria decoracao apontando para um fluxo que nao testa nada.
  assert.match(yml, /^\s*name:\s*\S/m, 'test.yml sem "name": o badge nao tem o que pedir');
  assert.match(yml, /npm test --prefix app/, 'o workflow precisa rodar o npm test do app, senao o selo mente');
  assert.match(yml, /pull_request/, 'sem pull_request quem contribui nao ve os testes antes do merge');
  // Restrito a `run:` de proposito: a primeira versao caca a substring em
  // qualquer lugar do arquivo e reprovou por causa do PROPRIO comentario do
  // test.yml, que diz "a ausencia de npm install aqui e o fato, nao
  // esquecimento". Prosa nao instala nada — quem instala e um passo, e um passo
  // aparece como `run: npm ci|install`.
  assert.ok(!/run:\s*npm\s+(?:ci|install)/.test(yml),
    'o app nao tem dependencia para instalar: um passo "npm ci" aqui so serviria para falhar (nao ha lockfile)');

  // 2. O selo existe, aponta para este repositorio, para este workflow e para o
  //    branch main — badge de outro repo ou sem branch mostra estado alheio.
  //    Aceita as duas sintaxes porque quem desenha e o GitHub: markdown
  //    (![alt](url)) e HTML (<img src="url">, a forma usada quando o topo e
  //    centrado com <p align="center">). Cobrar so uma delas faria o teste falhar
  //    por forma de escrever, e nao por selo ausente.
  const REPO = 'lucas-gonzales-dev/atlas-ciencia-da-computacao';
  const selos = [
    ...[...r.matchAll(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]),
    ...[...r.matchAll(/<img[^>]+src="(https:\/\/[^"]+)"/g)].map((m) => m[1]),
  ];
  const deTeste = selos.filter((u) => u.includes('/actions/workflows/'));
  assert.equal(deTeste.length, 1,
    `esperava exatamente UM selo de workflow de testes, achei ${deTeste.length}: ${deTeste.join(' | ')}`);
  const b = deTeste[0];
  assert.ok(b.includes(REPO), `selo de workflow apontando para outro repositorio: ${b}`);
  assert.ok(b.includes('actions/workflows/test.yml/badge.svg'),
    `selo aponta para outro workflow, nao para o test.yml: ${b}`);
  assert.ok(/branch=main/.test(b), `selo sem branch=main mostra a ultima run de qualquer branch: ${b}`);

  // 3. E o selo tem de ser clicavel: quem ve vermelho precisa chegar no log.
  //    De novo as duas formas: link markdown e <a href>.
  const envoltos = [
    ...[...r.matchAll(/\]\(\s*(https:\/\/github\.com\/[^)\s]+)\s*\)/g)].map((m) => m[1]),
    ...[...r.matchAll(/<a\s+href="(https:\/\/github\.com\/[^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(envoltos.some((u) => u.includes(`${REPO}/actions/workflows/test.yml`)),
    'o selo sem link para o workflow e enfeite: quem ve vermelho nao tem como conferir o porque');

  // 4. Nenhuma contagem escrita a mao pode voltar ao lado do selo.
  const manuais = [...r.matchAll(/(\d{2,3})\s+testes/g)].map((m) => m[0]);
  assert.deepEqual(manuais, [],
    `contagem de testes escrita a mao de volta no README (${manuais.join(', ')}): e isso que envelhece em silencio — o selo ja diz o estado`);
});

test('README: manda rodar local sem depender de nada que nao existe', async () => {
  const r = await ler('README.md');
  assert.match(r, /node app\/serve\.js|serve\.js/, 'o comando de rodar local precisa estar la');
  assert.match(r, /npm test/, 'o script de teste existe; o README precisa apontar para ele');
  // npm existe nesta maquina como .cmd — o README nao pode mandar usar o que nao ha.
  await access(new URL('app/serve.js', RAIZ_REPO));
  await access(new URL('app/package.json', RAIZ_REPO));
});

test('README: a secao de creditos e a licenca continuam como estavam', async () => {
  const r = await ler('README.md');
  assert.match(r, /##\s*Créditos e licença/, 'a secao de creditos nao pode sumir numa reescrita');
  assert.match(r, /CREDITS\.md/, 'o detalhe completo mora no CREDITS.md');
  assert.match(r, /MIT/, 'a licenca real da fonte precisa estar dita');
  // Decisao do Lucas, tomada em 28/10/2026: MIT. Ate la este teste fazia o
  // contrario — exigia que o LICENSE NAO existisse, para flagrar quem aplicasse
  // uma licenca antes da decisao. A decisao veio, entao a trava virou cobranca:
  // o arquivo precisa existir, e o README precisa dizer que existe.
  await access(new URL('LICENSE', RAIZ_REPO));
  assert.match(r, /LICENSE/, 'o README precisa apontar para o arquivo LICENSE que agora existe');
});
