// Projeto Atlas — o PORTUGUES que o aluno le (achado de 28/10/2026).
//
// Dois defeitos da mesma familia, e a familia e o que importa:
//
//   1. "nao ha recursos para estudar ainda" — o motivo das especializações em
//      construção estava sem acento. Ele NÃO vive no main.js: e uma string em
//      core/catalog.js que a derivação grava em app/data/catalog.json, e a tela
//      só ecoa. Quem procurou o texto no lugar errado (main.js) não acha a
//      causa. Corrigir o gerador SEM regenerar o catálogo deixaria a tela igual.
//
//   2. "Há mais 9 disponível(eis) agora" — "(eis)" e atalho de quem não quis
//      escolher a forma. O número e conhecido naquele ponto do código, então a
//      escolha e possível: 1 -> "disciplina disponível", n -> "disciplinas
//      disponíveis". Nenhum teste antigo cobria isso porque os 153 conferiam
//      contagem, ordem e honestidade — nunca a concordância de uma frase.
//
// Este arquivo cobre os dois nas DUAS pontas: o dado derivado (catalog.json,
// onde o texto de fato mora) e a tela desenhada (o stub de DOM de render.test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from '../web/main.js';

const raizDoApp = fileURLToPath(new URL('..', import.meta.url));
const raizDoRepo = fileURLToPath(new URL('../..', import.meta.url));

// ---------------------------------------------------------------- stub de DOM
// Mesmo motivo de render.test.js: npm não está instalado, então não há jsdom.
function criarNo(tag) {
  const no = {
    tag,
    children: [],
    attrs: {},
    className: '',
    textContent: '',
    setAttribute(k, v) { this.attrs[k] = v; },
    append(...ns) { this.children.push(...ns); },
    addEventListener() {}
  };
  for (const p of ['href', 'rel', 'target']) {
    Object.defineProperty(no, p, {
      configurable: true,
      get() { return this.attrs[p]; },
      set(v) { this.attrs[p] = String(v); }
    });
  }
  return no;
}
globalThis.document = { createElement: criarNo };

function textoDe(no) {
  let s = typeof no.textContent === 'string' ? no.textContent : '';
  for (const filho of no.children || []) s += `${textoDe(filho)}\n`;
  return s;
}

// n disciplinas sem pré-requisito => n abertas de cara. É `abertas.length` que
// decide a forma da frase, então a fixture controla exatamente esse número.
function catalogoComAbertas(n) {
  const lista = [];
  for (let i = 0; i < n; i += 1) {
    lista.push({
      id: `d${i}`,
      title: `Disciplina ${i + 1}`,
      stage: 1,
      prerequisites: [],
      resourceUrl: `https://exemplo.invalid/d${i}`
    });
  }
  return lista;
}

function fraseDoDestaque(nAbertas) {
  const root = criarNo('div');
  render(root, { courses: catalogoComAbertas(nAbertas), completed: [], origem: 'teste' });
  const achado = textoDe(root).split('\n').find((l) => l.includes('Há mais'));
  assert.ok(achado, `a frase "Há mais..." sumiu da tela com ${nAbertas} abertas`);
  return achado.trim();
}

// ------------------------------------------------------------------- os casos

test('o atalho "disponível(eis)" não sobrevive no código que desenha a tela', () => {
  const main = readFileSync(`${raizDoApp}web/main.js`, 'utf8');
  const linhas = main.split(/\r?\n/).filter((l) => /dispon[íi]vel\(eis\)|\(eis\)|\(s\)\s+agora/.test(l));
  const vivas = linhas.filter((l) => !/^\s*(\/\/|\*|<!--)/.test(l));
  assert.deepEqual(vivas, [], `atalho de concordância ainda vivo em main.js: ${vivas.join(' | ')}`);
});

test('plural: a frase concorda com o número que ela mesma cita', () => {
  const frase = fraseDoDestaque(10);
  assert.match(frase, /Há mais 9 disciplinas disponíveis agora/, frase);
  assert.ok(!/disponível\b/.test(frase), `singular no plural: ${frase}`);
});

test('singular: uma disciplina só não vira "1 disciplinas disponíveis"', () => {
  const frase = fraseDoDestaque(2);
  assert.match(frase, /Há mais 1 disciplina disponível agora/, frase);
});

test('o motivo das especializações em construção está em português, no DADO derivado', () => {
  const catalogo = JSON.parse(readFileSync(`${raizDoApp}data/catalog.json`, 'utf8'));
  const motivos = catalogo.specializations
    .map((sp) => sp.motivoAguardando)
    .filter((m) => typeof m === 'string' && m.length);
  assert.ok(motivos.length > 0, 'nenhuma especialização aguardando conteúdo — a fixture mudou?');

  // Só palavras que NÃO EXISTEM sem acento em português. Ficam de fora as
  // homógrafas legítimas: "esta" (demonstrativo) e "ha" não são erros, e um
  // detector que as lista condena frase certa — foi o que este teste fez na
  // primeira versão, e é a MESMA classe de erro que o detector de acento do
  // Claude cometeu ao ler a URL da fonte como frase (27/10/2026).
  const crus = motivos.filter((m) => /\b(nao|disponivel|disponiveis|conteudo|construcao|indice|pagina|voce|numero)\b/.test(m));
  assert.deepEqual(crus, [], `texto sem acento chegou ao catalog.json: ${crus.join(' | ')}`);
});

test('o gerador e o gerado concordam: catalog.json está em dia com core/catalog.js', () => {
  // Esta é a guarda do erro que a causa 2 tornava fácil: mexer na string do
  // gerador e esquecer de rodar tools/build-catalog.mjs. A tela lê o JSON,
  // então um gerador corrigido com JSON velho não muda UMA letra na tela.
  const catalogo = JSON.parse(readFileSync(`${raizDoApp}data/catalog.json`, 'utf8'));
  const gerador = readFileSync(`${raizDoApp}core/catalog.js`, 'utf8');
  const noGerador = gerador.match(/motivoAguardando: '([^']+)'/);
  assert.ok(noGerador, 'a string do motivo sumiu de core/catalog.js');
  const achado = catalogo.specializations.some((sp) => sp.motivoAguardando === noGerador[1]);
  assert.ok(
    achado,
    'catalog.json desatualizado: rode node tools/build-catalog.mjs (o gerador mudou, o dado não)'
  );
});

test('nenhum texto de tela derivado traz palavra sem acento que o português exige', () => {
  // Rede de segurança da família inteira, não só dos dois achados: qualquer
  // string nova que o gerador puser no catálogo passa por aqui.
  const catalogo = JSON.parse(readFileSync(`${raizDoApp}data/catalog.json`, 'utf8'));
  const frases = [
    catalogo.origem,
    catalogo.origemEletivas,
    catalogo.origemEspecializacoes,
    ...catalogo.specializations.flatMap((sp) => [sp.motivoAguardando, ...(sp.pageNotes || [])])
  ].filter((s) => typeof s === 'string' && s.length);

  // Mesma regra do caso acima: fora "ha" e "esta", que existem sem acento.
  const CRUS = /\b(nao|disponivel|disponiveis|conteudo|construcao|indice|pagina|voce|proximo|proxima|numero)\b/;
  const culpados = frases.filter((f) => CRUS.test(f));
  assert.deepEqual(culpados, [], `frase sem acento no dado que a tela ecoa: ${culpados.join(' | ')}`);
});

test('README e CREDITS não citam a grafia crua como se fosse texto da fonte', () => {
  for (const relativo of ['README.md', 'CREDITS.md']) {
    const caminho = `${raizDoRepo}${relativo}`;
    let texto;
    try {
      texto = readFileSync(caminho, 'utf8');
    } catch {
      continue; // arquivo ausente não é este teste que cobra
    }
    const vivas = texto.split(/\r?\n/)
      .filter((l) => /nao ha recursos para estudar ainda/.test(l))
      .filter((l) => !/^\s*(\/\/|\*|<!--|#)/.test(l));
    assert.deepEqual(vivas, [], `${relativo} ainda cita o texto sem acento: ${vivas.join(' | ')}`);
  }
});
