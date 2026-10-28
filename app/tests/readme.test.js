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
  for (const secao of ['O que já tem', 'O que ainda falta', 'Como abrir']) {
    assert.ok(r.includes(secao), `falta a secao "${secao}" — quem chega pelo post precisa das tres`);
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

// Este teste era VAZIO e passou verde com numero velho por muito tempo: ele
// aceitava "n === arquivos || n >= arquivos * 5", entao qualquer citacao acima de
// 100 passava. No dia em que se olhou, o README dizia "149 testes em 16 arquivos"
// (medicao de 27/10) e a suite era 191 em 20 — o teste criado para pegar numero
// velho nao pegou nada. Agora ele cobra EXATO o numero de ARQUIVOS, que e o que
// se deriva da lista do package.json sem rodar a suite. A contagem de testes
// nao e derivavel aqui, entao a regra e outra: ela tem de dizer QUANDO foi
// medida, porque numero sem data e justamente o que envelhece em silencio.
test('README: o numero de testes citado bate com a suite de agora', async () => {
  const r = await ler('README.md');
  const pkg = JSON.parse(await readFile(new URL('app/package.json', RAIZ_REPO), 'utf8'));
  const arquivos = pkg.scripts.test.split(/\s+/).filter((a) => a.endsWith('.test.js')).length;
  assert.ok(arquivos > 0, 'sanidade: o package.json nao lista arquivo de teste nenhum');

  const citadosArquivos = [...r.matchAll(/em\s+(\d{1,3})\s+arquivos/g)].map((m) => Number(m[1]));
  assert.ok(citadosArquivos.length > 0,
    'o README precisa dizer em quantos arquivos a suite roda: esse numero e derivavel e nao pode envelhecer em silencio');
  for (const n of citadosArquivos) {
    assert.equal(n, arquivos,
      `README cita ${n} arquivos de teste, mas o package.json lista ${arquivos}`);
  }

  const citadosTestes = [...r.matchAll(/(\d{2,3})\s+testes/g)].map((m) => Number(m[1]));
  assert.ok(citadosTestes.length > 0, 'README que nao diz quantos testes existem convida desconfianca');
  assert.match(r, /contados na sa[íi]da do runner em \d{2}\/\d{2}\/\d{4}/,
    'a contagem precisa dizer QUANDO foi medida, senao vira numero sem data');
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
