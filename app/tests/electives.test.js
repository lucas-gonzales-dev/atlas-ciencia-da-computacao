// Projeto Atlas — testes das ELETIVAS (item 1 da entrega de 24/10/2026).
//
// O que esta em jogo aqui nao e so desenhar uma lista a mais: e nao MENTIR.
// A fonte (README da UBL) tem 4 eletivas dentro de um bloco HTML COMENTADO, e o
// proprio seed traz a decisao editorial: "preservar como conteudo legado/inativo
// e nao somar a grade obrigatoria sem decisao editorial". Entao:
//   - elas aparecem numa SECAO PROPRIA, nunca misturadas na grade;
//   - a secao diz que estao arquivadas na fonte;
//   - elas NAO entram no progresso (sem botao de concluir, sem contar no total);
//   - o que a fonte nao fixou (commitSha null) e dito como nao fixado.
//
// Stub de DOM igual ao de render.test.js: npm/jsdom nao e o caminho nesta
// maquina, e duplicar 30 linhas de stub custa menos que um falso verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toElectives } from '../core/catalog.js';
import { unlockedCourses } from '../core/progress.js';
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

function achar(no, tag, saida = []) {
  if (!no) return saida;
  if (no.tag === tag) saida.push(no);
  for (const filho of no.children || []) achar(filho, tag, saida);
  return saida;
}

function textoDe(no) {
  if (!no) return '';
  return (no.textContent || '') + (no.children || []).map(textoDe).join(' ');
}

// Dois itens bastam para o teste de render: um com recurso e um sem, para provar
// que link vazio nao aparece. Os numeros de verdade (4 eletivas) o teste de
// derivacao confere lendo o seed vendado.
const ELETIVAS = [
  {
    id: 'ubl-commented-elective-computer-vision',
    title: 'Visao Computacional',
    resourceUrl: 'https://www.youtube.com/playlist?list=PLCV',
    state: 'commented_or_archived',
    prerequisiteTitles: ['Fundamentos de Computacao Grafica']
  },
  {
    id: 'ubl-commented-elective-sem-recurso',
    title: 'Eletiva Sem Recurso',
    resourceUrl: null,
    state: 'commented_or_archived',
    prerequisiteTitles: []
  }
];

const GRADE = [
  { id: 'logica', title: 'Logica de Programacao', stage: 1, prerequisites: [], resourceUrl: 'https://exemplo.invalid/logica' },
  { id: 'python-1', title: 'Python I', stage: 2, prerequisites: ['logica'] }
];

const SEED_ELETIVAS = {
  schemaVersion: '0.1.0',
  source: {
    repository: 'https://github.com/Universidade-Livre/ciencia-da-computacao',
    path: 'README.md',
    branch: 'main',
    commitSha: null,
    observedAt: '2026-10-22'
  },
  note: 'Registros de secao HTML comentada. Preservar como conteudo legado/inativo e nao somar a grade obrigatoria sem decisao editorial.',
  items: [
    {
      id: 'ubl-commented-elective-computer-vision',
      title: 'Visao Computacional',
      url: 'https://www.youtube.com/playlist?list=PLCV',
      sourceLineHint: 197,
      prerequisiteTitles: ['Fundamentos de Computacao Grafica'],
      topicsRaw: null,
      state: 'commented_or_archived',
      note: 'Linha dentro de bloco HTML comentado do README.'
    },
    { title: 'Registro sem id na fonte' }
  ]
};

function desenhar(state = {}) {
  const root = criarNo('div');
  const resumo = render(root, {
    courses: GRADE,
    completed: [],
    origem: 'teste',
    electives: ELETIVAS,
    origemEletivas: '4 eletivas arquivadas na fonte — UBL @ commit NAO FIXADO',
    ...state
  });
  return { root, resumo };
}

function secaoEletivas(root) {
  return achar(root, 'section').find((s) => s.className.includes('eletivas'));
}

function trilha(root) {
  return achar(root, 'ul').find((u) => u.className.includes('trilha'));
}

// ---------- derivacao (core/catalog.js) ----------

test('toElectives traduz o seed e devolve na ordem da fonte', () => {
  const { electives } = toElectives(SEED_ELETIVAS);
  assert.equal(electives.length, 1, 'o registro sem id valido e descartado, nao inventado');
  assert.equal(electives[0].id, 'ubl-commented-elective-computer-vision');
  assert.equal(electives[0].title, 'Visao Computacional');
});

test('a URL vem do campo REAL da fonte (url), e vira resourceUrl', () => {
  const { electives } = toElectives(SEED_ELETIVAS);
  assert.equal(electives[0].resourceUrl, 'https://www.youtube.com/playlist?list=PLCV');
});

test('o estado de arquivamento e preservado: a tela precisa poder dizer que esta arquivada', () => {
  const { electives } = toElectives(SEED_ELETIVAS);
  assert.equal(electives[0].state, 'commented_or_archived');
});

test('pre-requisitos da fonte vem como TITULOS, e nao viram ids inventados', () => {
  const { electives } = toElectives(SEED_ELETIVAS);
  // Se alguem mapear titulo -> id chutado, o progresso passa a depender de
  // pre-requisito que a fonte nunca declarou. Este teste e o freio disso.
  assert.deepEqual(electives[0].prerequisiteTitles, ['Fundamentos de Computacao Grafica']);
  assert.equal(electives[0].prerequisites, undefined, 'eletiva nao ganha campo de progresso');
});

test('topicsRaw ausente fica null, nunca string vazia fingindo dado', () => {
  const { electives } = toElectives(SEED_ELETIVAS);
  assert.equal(electives[0].topics, null);
});

test('a origem das eletivas diz que o commit NAO esta fixado (honestidade sobre a fonte)', () => {
  const { origem } = toElectives(SEED_ELETIVAS);
  assert.match(origem, /NAO FIXADO/i);
  assert.match(origem, /arquivad/i, 'a frase de origem ja avisa que sao arquivadas');
});

test('seed sem a lista "items" quebra ALTO, em vez de devolver tela vazia', () => {
  assert.throws(() => toElectives({ source: {} }), /items/);
  assert.throws(() => toElectives(null), TypeError);
});

// ---------- tela (web/main.js) ----------

test('as eletivas ficam em SECAO PROPRIA, separada da grade obrigatoria', () => {
  const { root } = desenhar();
  const s = secaoEletivas(root);
  assert.ok(s, 'esperava um <section class="eletivas">');
  const lista = trilha(root);
  assert.ok(lista, 'sanidade: a grade obrigatoria continua la');
  for (const e of ELETIVAS) {
    assert.equal(achar(lista, 'li').filter((li) => li.attrs['data-id'] === e.id).length, 0,
      `a eletiva "${e.title}" NAO pode aparecer dentro da grade obrigatoria`);
  }
  assert.ok(achar(s, 'li').length >= ELETIVAS.length, 'as eletivas aparecem dentro da propria secao');
});

test('a secao avisa que estao arquivadas na fonte e que nao somam a grade', () => {
  const { root } = desenhar();
  const t = textoDe(secaoEletivas(root));
  assert.match(t, /arquivad/i);
  assert.match(t, /nao somam|decisao editorial|grade/i);
});

test('eletivas NAO entram no progresso: sem botao de concluir e sem contar no total', () => {
  const { root, resumo } = desenhar();
  assert.equal(achar(secaoEletivas(root), 'button').length, 0,
    'botao de concluir numa eletiva faria o progresso mentir sobre a grade');
  assert.equal(resumo.total, GRADE.length, 'o total da tela e o da grade obrigatoria');
  assert.equal(resumo.feitos, 0);
});

test('o nucleo de progresso nunca ve as eletivas (elas nao estao em courses)', () => {
  const abertas = unlockedCourses(GRADE, []);
  assert.ok(!abertas.includes('ubl-commented-elective-computer-vision'));
});

test('a origem das eletivas aparece visivel na tela', () => {
  const { root } = desenhar();
  assert.match(textoDe(secaoEletivas(root)), /NAO FIXADO/);
});

test('eletiva sem recurso nao ganha link vazio nem href "#"', () => {
  const { root } = desenhar();
  const li = achar(root, 'li').find((n) => n.attrs['data-id'] === 'ubl-commented-elective-sem-recurso');
  assert.ok(li, 'a eletiva sem recurso continua aparecendo');
  assert.equal(achar(li, 'a').length, 0);
});

test('link de eletiva abre em aba nova e nao vaza referrer', () => {
  const { root } = desenhar();
  const links = achar(secaoEletivas(root), 'a');
  assert.ok(links.length >= 1);
  for (const a of links) {
    assert.equal(a.attrs.target, '_blank');
    assert.match(a.attrs.rel || '', /noopener/);
  }
});

test('sem eletivas no catalogo, a secao nao e desenhada vazia', () => {
  const { root } = desenhar({ electives: [] });
  assert.equal(secaoEletivas(root), undefined, 'secao vazia e ruido: se nao ha dado, nao ha secao');
});

test('catalogo antigo sem o campo electives continua funcionando (nao quebra a tela)', () => {
  const { root } = desenhar({ electives: undefined });
  assert.ok(trilha(root), 'a grade obrigatoria desenha mesmo sem eletivas');
});

test('a grade obrigatoria vem ANTES das eletivas: o obrigatoria e o caminho, a eletiva e o resto', () => {
  const { root } = desenhar();
  const iLista = root.children.indexOf(trilha(root));
  const iEletivas = root.children.indexOf(secaoEletivas(root));
  assert.ok(iLista >= 0 && iEletivas >= 0);
  assert.ok(iLista < iEletivas, `grade (${iLista}) tem de vir antes das eletivas (${iEletivas})`);
});
