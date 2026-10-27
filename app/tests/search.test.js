// Projeto Atlas — testes da busca de disciplina (core/search.js + ligacao na tela).
//
// Por que no core: a regra de filtrar (sem acento, sem caixa, substring) e regra
// de negocio — vive em core/search.js, testavel sem navegador. web/main.js so
// liga o campo a ela. Mesmo contrato dos outros modulos do core: roda no node e
// no navegador, zero DOM, derivacao pura (nao muta as entradas).
//
// O stub de DOM segue o de render.test.js: implementa SO o que main.js usa.
// Diferenca de proposito: addEventListener GRAVA os handlers, para o teste
// dispara-los e provar que digitar no campo chega ao onChange sem precisar de
// navegador. (O stub de boot COM getElementById e do teste de fumaca do
// main.js, se ele vier a existir — la faz falta, aqui nao.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, buscar } from '../core/search.js';
import { render, montarBusca } from '../web/main.js';

function criarNo(tag) {
  const no = {
    tag,
    children: [],
    attrs: {},
    className: '',
    textContent: '',
    value: '',
    listeners: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    append(...ns) { this.children.push(...ns); },
    addEventListener(tipo, fn) { (this.listeners[tipo] ??= []).push(fn); }
  };
  // Props IDL reais do <a>: no navegador, `a.href = x` grava o ATRIBUTO.
  for (const p of ['href', 'rel', 'target']) {
    Object.defineProperty(no, p, {
      configurable: true,
      get() { return this.attrs[p]; },
      set(v) { this.attrs[p] = String(v); }
    });
  }
  return no;
}

function disparar(no, tipo) {
  for (const fn of no.listeners[tipo] || []) fn({ target: no });
}

function achar(no, tag, saida = []) {
  if (!no) return saida;
  if (no.tag === tag) saida.push(no);
  for (const filho of no.children || []) achar(filho, tag, saida);
  return saida;
}

function textoDe(no) {
  return (no.textContent || '') + (no.children || []).map(textoDe).join(' ');
}

globalThis.document = { createElement: criarNo };

// ---------------------------------------------------------------------------
// FIXTURES — titulos COM acento de proposito: a fonte e portuguesa, e "achar
// Cálculo digitando calculo" e exatamente o comportamento em teste.
// ---------------------------------------------------------------------------
const GRADE = [
  { id: 'calculo-1', title: 'Cálculo I', stage: 2, prerequisites: [] },
  { id: 'logica', title: 'Lógica de Programação', stage: 1, prerequisites: [] },
  { id: 'python-1', title: 'Python I', stage: 2, prerequisites: ['logica'] }
];
const ELETIVAS = [
  { id: 'ele-jogos', title: 'Desenvolvimento de Jogos', prerequisiteTitles: [] },
  { id: 'ele-iot', title: 'Introdução à Internet das Coisas' }
];
const ESPECIALIZACOES = [
  { id: 'esp-ml', title: 'Machine Learning', resources: [] },
  { id: 'esp-dba', title: 'Administração de Bancos de Dados', resources: [] }
];
const DADOS = { courses: GRADE, electives: ELETIVAS, specializations: ESPECIALIZACOES };

/** li com data-id = item de lista (grade, eletiva ou especializacao). */
function itensDe(root) {
  return achar(root, 'li').filter((li) => li.attrs['data-id']).map((li) => li.attrs['data-id']);
}

function desenhar(extra = {}) {
  const root = criarNo('div');
  render(root, { courses: GRADE, completed: [], origem: 'teste', electives: ELETIVAS, specializations: ESPECIALIZACOES, ...extra });
  return root;
}

// ---------------------------------------------------------------------------
// CORE — normalizar()
// ---------------------------------------------------------------------------

test('normalizar: tira acento e caixa ("Cálculo" vira "calculo")', () => {
  assert.equal(normalizar('Cálculo'), 'calculo');
  assert.equal(normalizar('  PYTHON  '), 'python');
  assert.equal(normalizar('Introdução à Internet'), 'introducao a internet');
});

test('normalizar: nao-string vira "" (nao explode com estado corrompido)', () => {
  assert.equal(normalizar(null), '');
  assert.equal(normalizar(undefined), '');
  assert.equal(normalizar(42), '');
});

// ---------------------------------------------------------------------------
// CORE — buscar()
// ---------------------------------------------------------------------------

test('"calculo" acha "Cálculo I": nem acento nem caixa importam', () => {
  const r = buscar('calculo', DADOS);
  assert.equal(r.ativa, true);
  assert.deepEqual(r.courses.map((c) => c.id), ['calculo-1']);
  // E nos dois sentidos: digitar COM acento tambem acha.
  assert.deepEqual(buscar('CÁLCULO', DADOS).courses.map((c) => c.id), ['calculo-1']);
  assert.deepEqual(buscar('python', DADOS).courses.map((c) => c.id), ['python-1']);
});

test('busca vazia (ou so espacos) mostra TUDO e nao se diz "sem resultado"', () => {
  for (const vazio of ['', '   ', null, undefined]) {
    const r = buscar(vazio, DADOS);
    assert.equal(r.ativa, false, `query ${JSON.stringify(vazio)} devia ser busca inativa`);
    assert.equal(r.semResultado, false);
    assert.deepEqual(r.courses, GRADE);
    assert.deepEqual(r.electives, ELETIVAS);
    assert.deepEqual(r.specializations, ESPECIALIZACOES);
  }
});

test('a mesma busca alcanca as tres listas: grade, eletivas e especializacoes', () => {
  assert.deepEqual(buscar('logica', DADOS).courses.map((c) => c.id), ['logica']);
  assert.deepEqual(buscar('jogos', DADOS).electives.map((e) => e.id), ['ele-jogos']);
  assert.deepEqual(buscar('machine', DADOS).specializations.map((s) => s.id), ['esp-ml']);
  // "intro" aparece em eletiva ("Introdução à...") — substring, nao palavra inteira.
  assert.deepEqual(buscar('intro', DADOS).electives.map((e) => e.id), ['ele-iot']);
});

test('busca sem resultado diz que nao achou: semResultado true, listas vazias', () => {
  const r = buscar('quimica', DADOS);
  assert.equal(r.ativa, true);
  assert.equal(r.semResultado, true);
  assert.deepEqual(r.courses, []);
  assert.deepEqual(r.electives, []);
  assert.deepEqual(r.specializations, []);
});

test('derivacao pura: devolve copias, nao muta nada que recebeu', () => {
  const copia = JSON.parse(JSON.stringify(DADOS));
  const r = buscar('', DADOS);
  assert.notEqual(r.courses, GRADE, 'lista inativa tambem e copia: quem renderiza nao pode esbarrar no estado');
  buscar('calculo', DADOS);
  assert.deepEqual(DADOS, copia);
});

test('tolera entrada lixo sem explodir (data nulo, lista nao-array, item sem title)', () => {
  const r = buscar('x', null);
  assert.equal(r.semResultado, true);
  const sujo = { courses: [null, { title: 42 }, { id: 'ok', title: 'Xícara' }], electives: 'nao-e-array' };
  const r2 = buscar('xic', sujo);
  assert.deepEqual(r2.courses.map((c) => c.id), ['ok']);
  assert.deepEqual(r2.electives, []);
});

test('a ordem do catalogo e preservada no resultado', () => {
  const r = buscar('o', DADOS); // "o" aparece em varios titulos
  const ids = r.courses.map((c) => c.id);
  assert.deepEqual(ids, GRADE.filter((c) => ids.includes(c.id)).map((c) => c.id));
});

// ---------------------------------------------------------------------------
// LIGACAO — montarBusca() e render()
// ---------------------------------------------------------------------------

test('montarBusca: cria o campo no slot e digitar chama onChange com o texto', () => {
  const slot = criarNo('div');
  let visto = null;
  const input = montarBusca(slot, { onChange: (q) => { visto = q; } });
  assert.ok(input, 'devolve o input criado');
  assert.equal(achar(slot, 'input').length, 1, 'o campo foi montado no slot');
  assert.ok(input.attrs['aria-label'], 'campo sem rotulo acessivel e campo invisivel para leitor de tela');
  input.value = 'calc';
  disparar(input, 'input');
  assert.equal(visto, 'calc');
});

test('montarBusca: sem slot nao explode (busca simplesmente nao existe)', () => {
  assert.equal(montarBusca(null, { onChange: () => {} }), null);
});

test('render sem busca mostra tudo (regressao: a tela antiga continua inteira)', () => {
  const root = desenhar();
  assert.deepEqual(itensDe(root), [
    'calculo-1', 'logica', 'python-1', 'esp-ml', 'esp-dba', 'ele-jogos', 'ele-iot'
  ]);
});

test('render com busca desenha so o que passou no filtro, nas tres secoes', () => {
  const root = desenhar({ busca: 'calculo' });
  assert.deepEqual(itensDe(root), ['calculo-1']);
  // Eletivas e especializacoes sem match: secao inteira some (null), nao fica
  // cabeca vazia com titulo e nenhum item.
  assert.equal(achar(root, 'section').some((s) => s.className.includes('eletivas')), false);
  assert.equal(achar(root, 'section').some((s) => s.className.includes('especializacoes')), false);
});

test('render com busca sem resultado DIZ que nao achou, ecoando o que foi digitado', () => {
  const root = desenhar({ busca: 'quimica' });
  const t = textoDe(root);
  assert.match(t, /nada encontrado/i, 'tela calada diante de busca vazia parece tela quebrada');
  assert.match(t, /quimica/, 'o eco do texto digitado mostra o que foi procurado');
  assert.deepEqual(itensDe(root), []);
});

test('buscar nao muda progresso nem proxima materia: eles sao do catalogo inteiro', () => {
  const root = criarNo('div');
  render(root, {
    courses: GRADE, completed: ['calculo-1'], origem: 'teste', busca: 'python'
  });
  // "1/3 concluidas" — nao "0/1" da unica linha visivel.
  assert.match(textoDe(root), /1\/3 concluidas/);
  // Destaque vem de nextUp() sobre o catalogo INTEIRO: concluida Cálculo I, a
  // proxima aberta e Logica — mesmo a busca so mostrando python-1 na lista.
  const destaque = achar(root, 'section').find((s) => s.className.includes('proxima'));
  assert.match(textoDe(destaque), /Lógica de Programação/);
});
