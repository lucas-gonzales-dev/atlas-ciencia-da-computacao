// Projeto Atlas — testes da BIBLIOGRAFIA (item 3 da entrega de 24/10/2026).
//
// O que existe de verdade, medido antes de escrever uma linha de tela: as 35
// disciplinas do seed trazem `bibliographySourcePath` transcrito do README da
// UBL (ex.: extras/bibliography/01_digital_circuits.md). O CONTEUDO dessas
// paginas NAO foi transcrito — a reconciliacao do kit (b995c11) conferiu que os
// 35 caminhos resolvem, nada alem disso.
//
// Entao a regra deste item e a mais facil de quebrar por preguica: a tela mostra
// o CAMINHO na fonte e diz que nao conferiu se esta no ar. Ela NAO inventa
// titulo de livro, autor ou link de download. Um href montado por template com
// slug em vez do caminho real da fonte tambem e mentira, e e exatamente o que o
// teste de "caminho real" abaixo pega.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

function comClasse(no, classe, saida = []) {
  if (!no) return saida;
  const c = typeof no.className === 'string' ? no.className : (no.attrs.class || '');
  if (c.split(/\s+/).includes(classe)) saida.push(no);
  for (const filho of no.children || []) comClasse(filho, classe, saida);
  return saida;
}

function textoDe(no) {
  if (!no) return '';
  return (no.textContent || '') + (no.children || []).map(textoDe).join(' ');
}

const ler = (n) => JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${n}`, import.meta.url)), 'utf8'));
const CATALOGO = ler('catalog.json');

function desenhar(courses) {
  const root = criarNo('div');
  render(root, {
    courses,
    completed: [],
    origem: CATALOGO.origem,
    electives: CATALOGO.electives,
    origemEletivas: CATALOGO.origemEletivas,
    specializations: CATALOGO.specializations,
    origemEspecializacoes: CATALOGO.origemEspecializacoes
  });
  return root;
}

test('as 35 disciplinas da fonte tem caminho de bibliografia, e ele chega ao catalogo', () => {
  assert.equal(CATALOGO.courses.length, 35);
  for (const c of CATALOGO.courses) {
    assert.ok(
      typeof c.bibliography === 'string' && c.bibliography.length > 0,
      `${c.id} sem caminho de bibliografia`
    );
    assert.match(c.bibliography, /^extras\/bibliography\/.+\.md$/, `${c.id} com caminho fora do padrao da fonte`);
  }
});

test('tela: um link de bibliografia por disciplina, e o caminho e o REAL da fonte', () => {
  const root = desenhar(CATALOGO.courses);
  const links = comClasse(root, 'biblio-link');
  assert.equal(links.length, CATALOGO.courses.length);
  for (let i = 0; i < links.length; i++) {
    const c = CATALOGO.courses[i];
    const a = links[i];
    // O caminho da fonte TEM de aparecer no href: link montado por template
    // (slug, indice, "bibliography/" generico) passaria no teste de formato e
    // mandaria o aluno para a pagina errada. Por isso a comparacao literal.
    assert.ok(
      a.href.endsWith(`/blob/main/${c.bibliography}`),
      `href nao termina no caminho real de ${c.id}: ${a.href}`
    );
    assert.match(a.href, /^https:\/\/github\.com\/Universidade-Livre\/ciencia-da-computacao\/blob\/main\/extras\/bibliography\//);
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
    assert.match(textoDe(a), /Bibliografia:/);
    assert.match(textoDe(a), new RegExp(c.bibliography.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('honestidade: o aviso de nao-verificado e dito UMA vez, antes da lista, e nao em cada disciplina', () => {
  // Regra de 28/10/2026: a mesma frase aparecia debaixo das 35 disciplinas.
  // Repetir aviso nao o fortalece, o apaga — e o caminho de cada bibliografia
  // continua no cartao dela, que e o dado, enquanto o aviso e a leitura do conjunto.
  const root = desenhar(CATALOGO.courses);
  const notas = comClasse(root, 'biblio-nota');
  assert.equal(notas.length, 1,
    `a nota apareceu ${notas.length} vezes: repetida por disciplina, o aviso vira textura que o olho pula`);

  const t = textoDe(notas[0]);
  assert.match(t, /não verificada/, 'falta dizer que a disponibilidade nao foi conferida');
  assert.match(t, /não guarda o conteúdo/, 'falta dizer que o Atlas nao tem os livros');

  // "No comeco da lista" e posicao, nao intencao: a nota tem de vir ANTES da
  // <ul> da trilha. Quem rola direto para o fim nao pode ser o unico a le-la.
  const ul = achar(root, 'ul')[0];
  assert.ok(ul, 'a lista de disciplinas sumiu');
  assert.ok(root.children.indexOf(notas[0]) < root.children.indexOf(ul),
    'a nota veio depois da lista: o aluno le 35 caminhos sem saber que nenhum foi conferido');

  // Nenhum cartao carrega o aviso de volta, e todos continuam com o caminho.
  assert.equal(comClasse(root, 'biblio-link').length, CATALOGO.courses.length,
    'o caminho da bibliografia sumiu junto com o aviso');
  for (const li of achar(root, 'li').filter((n) => String(n.className).includes('item'))) {
    assert.equal(comClasse(li, 'biblio-nota').length, 0, 'o aviso voltou para dentro do cartao');
  }
});

test('disciplina sem bibliografia nao ganha link inventado', () => {
  const minimo = [{
    id: 'teste-sem-biblio',
    slug: 'teste-sem-biblio',
    title: 'Disciplina sem bibliografia',
    stage: 1,
    prerequisites: [],
    resourceUrl: 'https://exemplo.org/aula',
    resourceType: null,
    bibliography: null
  }];
  const root = desenhar(minimo);
  assert.equal(comClasse(root, 'biblio-link').length, 0, 'link de bibliografia inventado');
  assert.equal(comClasse(root, 'biblio-nota').length, 0, 'aviso sem bibliografia');
  // O recurso de estudo continua la: bibliografia ausente nao derruba o resto.
  // Conferir DENTRO do li da disciplina — na arvore inteira tambem estao os
  // links de recurso das eletivas e especializacoes do catalogo real, e contar
  // tudo daria 12 em vez de 1 por um motivo que nao e o desta regra.
  const li = achar(root, 'li').find((n) => n.attrs['data-id'] === 'teste-sem-biblio');
  assert.ok(li, 'a disciplina sumiu da grade');
  assert.equal(comClasse(li, 'recurso').length, 1, 'o link de aula sumiu junto com a bibliografia');
});

test('bibliografia nao vira botao de concluir nem entra no progresso', () => {
  const root = desenhar(CATALOGO.courses);
  const contador = textoDe(root).match(/(\d+)\s*\/\s*(\d+)\s*conclu[íi]das/);
  assert.ok(contador, 'contador sumiu');
  assert.equal(contador[1], '0');
  assert.equal(contador[2], String(CATALOGO.courses.length), 'o contador passou a contar bibliografia');
  const idsDaGrade = new Set(CATALOGO.courses.map((c) => c.id));
  const concluiveis = achar(root, 'li').filter((li) =>
    achar(li, 'button').some((b) => textoDe(b).includes('Concluir')));
  assert.equal(concluiveis.length, CATALOGO.courses.length);
  for (const li of concluiveis) {
    assert.ok(idsDaGrade.has(li.attrs['data-id']), `item concluivel estranho: ${li.attrs['data-id']}`);
  }
});
