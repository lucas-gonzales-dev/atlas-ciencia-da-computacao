// Projeto Atlas — testes da camada de apresentacao.
//
// Por que um stub de DOM: npm NAO esta instalado nesta maquina, entao nao ha
// jsdom. O stub implementa SO o que web/main.js usa de document (createElement,
// append, setAttribute, className, textContent, disabled, href). Se main.js
// passar a usar outra coisa do DOM, o teste quebra ALTO — nunca em silencio.
//
// main.js nao toca `document` no momento do import (so define constantes),
// entao importar em ESM antes de criar o stub e seguro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../web/main.js';

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
  // Props IDL reais do <a>: no navegador, `a.href = x` grava o ATRIBUTO.
  // Sem isto o stub aceitaria codigo que funciona aqui e quebra no navegador.
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

/** Desce a arvore coletando todo no de uma tag. Recursivo: a tela monta ul > li > a. */
function achar(no, tag, saida = []) {
  if (no.tag === tag) saida.push(no);
  for (const filho of no.children || []) achar(filho, tag, saida);
  return saida;
}

const CATALOGO = [
  {
    id: 'logica',
    title: 'Logica de Programacao',
    stage: 1,
    prerequisites: [],
    resourceUrl: 'https://www.youtube.com/playlist?list=PLLOGICA'
  },
  {
    id: 'python-1',
    title: 'Python I',
    stage: 2,
    prerequisites: ['logica'],
    resourceUrl: 'https://www.youtube.com/playlist?list=PLPYTHON1'
  },
  {
    // A fonte tem disciplina SEM recurso (ex.: paginas "em construcao").
    // Elas precisam aparecer na trilha, mas sem link quebrado.
    id: 'seminarios',
    title: 'Seminarios',
    stage: 8,
    prerequisites: []
  }
];

function desenhar(completed = []) {
  const root = criarNo('div');
  const resumo = render(root, { courses: CATALOGO, completed, origem: 'teste' });
  return { root, resumo };
}

test('a disciplina disponivel TEM o link do recurso: o aluno precisa ter onde estudar', () => {
  const { root } = desenhar([]);
  const links = achar(root, 'a');
  assert.equal(links.length, 2, 'as 2 disciplinas com resourceUrl deviam gerar 2 links');
  assert.equal(links[0].attrs.href, 'https://www.youtube.com/playlist?list=PLLOGICA');
});

test('o href vem do campo REAL do catalogo, nao de um placeholder', () => {
  const { root } = desenhar([]);
  const hrefs = achar(root, 'a').map((a) => a.attrs.href);
  assert.deepEqual(hrefs, [
    'https://www.youtube.com/playlist?list=PLLOGICA',
    'https://www.youtube.com/playlist?list=PLPYTHON1'
  ]);
});

test('disciplina SEM recurso nao ganha link vazio nem href "#"', () => {
  const { root } = desenhar([]);
  const liSeminarios = achar(root, 'li').find((li) => li.attrs['data-id'] === 'seminarios');
  assert.ok(liSeminarios, 'a disciplina sem recurso continua aparecendo na trilha');
  assert.equal(achar(liSeminarios, 'a').length, 0, 'link vazio e pior que link nenhum');
});

// DECISAO DE PRODUTO (23/10/2026): a trava de pre-requisito vale para MARCAR
// conclusao, nao para curiosidade. Esconder o recurso de quem ainda nao chegou
// la nao ensina nada e so irrita. Entao o link aparece tambem na trancada.
test('disciplina trancada tambem mostra o link (travar e sobre concluir, nao sobre espiar)', () => {
  const { root } = desenhar([]); // python-1 trancada: logica nao foi concluida
  const liPython = achar(root, 'li').find((li) => li.attrs['data-id'] === 'python-1');
  assert.ok(liPython.className.includes('trancada'), 'sanidade: python-1 esta trancada neste cenario');
  const links = achar(liPython, 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].attrs.href, 'https://www.youtube.com/playlist?list=PLPYTHON1');
});

test('o link abre em aba nova e nao vaza referrer (recurso externo, youtube/coursera)', () => {
  const { root } = desenhar([]);
  for (const a of achar(root, 'a')) {
    assert.equal(a.attrs.target, '_blank');
    assert.match(a.attrs.rel || '', /noopener/);
  }
});
