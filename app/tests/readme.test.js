// Projeto Atlas — o README de quem chega pelo post.
//
// Por que um teste de README: ele e a primeira coisa que quem chegou pelo
// LinkedIn le, e e o lugar mais facil de mentir sem querer — um link do Pages
// que ainda nao existe, um "funciona offline" que ninguem conferiu no celular,
// um numero de testes velho. Este arquivo cobra tres coisas concretas:
//   1. o README diz o que FALTA (nao so o que ja tem);
//   2. da o endereco onde o site esta de fato no ar, como link clicavel;
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

// Historico desta cobranca:
//   - v1 (28/10) cobrava o contrario do que vale hoje: sem link vivo para
//     github.io, o README TINHA de dizer "ainda nao esta no ar". Fazia sentido
//     enquanto a publicacao era promessa — o Pages nunca chegou a publicar.
//   - v2 (agora) inverte: o Lucas publicou o Atlas no Cloudflare Pages, entao o
//     endereco vivo tem de estar la como LINK clicavel, e o endereco antigo nao
//     pode sobrar. Por que cobrar isso em teste: endereco de site e o que
//     envelhece em silencio quando a hospedagem muda, e era exatamente o buraco
//     da v1 — um README apontando para um 404 passa verde nela.
const ENDERECO = 'https://atlas-ciencia-da-computacao.pages.dev/';

test('README: da o endereco onde o Atlas esta no ar, como link, e nao cita outro', async () => {
  const r = await ler('README.md');
  assert.ok(r.includes(ENDERECO), `o README precisa dar o endereco vivo do Atlas: ${ENDERECO}`);
  // Link de verdade, nao so prosa: quem chega tem de conseguir clicar.
  assert.match(
    r,
    /\]\(\s*<?https:\/\/atlas-ciencia-da-computacao\.pages\.dev\/?>?\s*\)/,
    'o endereco precisa estar como link clicavel, e nao apenas citado em texto'
  );
  assert.ok(!/github\.io/.test(r),
    'o GitHub Pages nao e mais a casa do site: endereco velho no README manda visita para um 404');
  assert.ok(!/ainda n[aã]o est[aá] no ar/i.test(r),
    'o Atlas esta no ar; o README nao pode continuar dizendo o contrario');
  assert.match(r, /Adicionar à tela inicial/i,
    'quem abre no celular precisa saber como instalar — e e esse gesto que faz o offline valer');
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
//   - v3 trocou o numero pelo SELO do workflow e passou a EXIGI-lo no README.
//     Durou um commit: a conta do Lucas tem pendencia de cobranca no GitHub ate
//     07/11 e o Actions do repositorio foi desligado ate la, entao o badge so
//     pode nascer cinza ("no status") — e num repositorio que vai para
//     portfolio, selo cinza e pior que selo nenhum. O b5ebafe anunciou a saida
//     do selo na mensagem e nao a fez no diff; este teste e o conserto.
//   - v4 (agora) inverte a v3: NENHUM badge de workflow no README, e o test.yml
//     continua existindo e cobrindo a mesma suite — o que esta desligado e a
//     execucao, nao o fluxo. Quando o Actions religar, o selo volta e este teste
//     volta a cobra-lo (nao a proibi-lo): cobrar ausencia para sempre deixaria o
//     README sem selo vivo de novo, que e o defeito que a v3 quis consertar.
test('README: sem selo de CI enquanto o Actions estiver desligado; o workflow continua valendo', async () => {
  const r = await ler('README.md');
  const yml = await ler('.github/workflows/test.yml');

  // 1. Nenhum badge de workflow no README, nem como markdown (![alt](url)) nem
  //    como HTML (<img src="url">) — as duas formas porque quem desenha e o
  //    GitHub, e o topo e centrado com <p align="center">, que so aceita HTML.
  const badges = [
    ...[...r.matchAll(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]),
    ...[...r.matchAll(/<img[^>]+src="(https:\/\/[^"]+)"/g)].map((m) => m[1]),
  ].filter((u) => u.includes('/actions/workflows/'));
  assert.deepEqual(badges, [],
    `selo de CI de volta no README (${badges.join(' | ')}): com o Actions desligado ele so pode nascer cinza`);
  // Nem o link para a pagina do workflow: sem run, ela e uma pagina vazia.
  assert.ok(!/actions\/workflows\//.test(r),
    'sobrou referencia a actions/workflows no README: sem Actions rodando, o link leva a uma pagina sem historico');

  // 2. O workflow continua existindo e rodando a MESMA suite que se roda aqui.
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

  // 3. E nenhuma contagem escrita a mao pode voltar no lugar do selo.
  const manuais = [...r.matchAll(/(\d{2,3})\s+testes/g)].map((m) => m[0]);
  assert.deepEqual(manuais, [],
    `contagem de testes escrita a mao de volta no README (${manuais.join(', ')}): e isso que envelhece em silencio — o estado dos testes vem do workflow`);
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
