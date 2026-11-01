// Projeto Atlas — a tela Explorar (fatia S7 da v2).
//
// POR QUE EXISTE: `filtro.test.js` prova o núcleo (quem bate, quem sobre, a
// ordem) e `boot.test.js` prova o encadeamento. Nenhum dos dois DESONHA a
// tela — e foi exatamente aí que dois defeitos passaram: a linha de origem do
// currículo, criada uma vez no montar() e anexada dentro do pintar(), somava
// uma cópia a cada tecla digitada (visto na tela, 01/11, com "calculo"
// buscado), e o contador `role=status` não era lido por ninguém. Um teste que
// só chama `montar()` uma vez não vê acúmulo: acúmulo é, por definição, o que
// acontece na SEGUNDA vez. Por isso este arquivo pinta, digita, pinta de novo.
//
// Mini-DOM igual ao do folha.test.js (mesma casa, mesma medida): sem ele,
// viraria teste de navegador — a lição que o metro.test.js aprendeu na 2c.
import test from 'node:test';
import assert from 'node:assert/strict';
import { montar } from '../web/telas/explorar.js';

function criarNo(tag, doc) {
  const no = {
    tag, doc, children: [], attrs: {}, className: '', value: '', dataset: {},
    listeners: {}, parent: null, type: '', htmlFor: '', id: '', placeholder: '', hidden: false,
    // No navegador, escrever textContent='' destrói os filhos. Sem este
    // setter o mini-DOM acumularia itens de pinturas antigas e o teste de
    // acúmulo perderia o sentido (mediria o dublê, não a tela).
    get textContent() { return this._texto || ''; },
    set textContent(v) { this._texto = String(v); if (this._texto === '') this.children = []; },
    classList: {
      contains: (c) => no.className.split(/\s+/).includes(c),
      add: (...cs) => { no.className = [...no.className.split(/\s+/).filter(Boolean), ...cs].join(' '); },
      remove: (...cs) => { no.className = no.className.split(/\s+/).filter((c) => c && !cs.includes(c)).join(' '); }
    },
    setAttribute(k, v) { no.attrs[k] = String(v); if (k === 'id') no.id = String(v); },
    getAttribute(k) { return k in no.attrs ? no.attrs[k] : null; },
    append(...ns) { for (const n of ns) { n.parent = no; no.children.push(n); } },
    addEventListener(tipo, fn) { (no.listeners[tipo] ||= []).push(fn); },
    focus() { no.doc.foco = no; },
    closest(sel) {
      const casa = (n) => (sel.startsWith('.') ? n.className.split(/\s+/).includes(sel.slice(1)) : n.tag === sel);
      for (let n = no; n; n = n.parent) if (casa(n)) return n;
      return null;
    }
  };
  return no;
}

function criarDoc() {
  const doc = { createElement: (tag) => criarNo(tag, doc), foco: null };
  return doc;
}

function todos(raiz, pred, saida = []) {
  if (!raiz) return saida;
  if (pred(raiz)) saida.push(raiz);
  for (const f of raiz.children || []) todos(f, pred, saida);
  return saida;
}
const comClasse = (raiz, re) => todos(raiz, (n) => n.className.split(/\s+/).some((c) => re.test(c)));
// Uma estação é o -item que tem link para a folha. Ramais e eletivas também
// usam a classe (são itens da tela), então contar -item cego contaria 9 onde
// a rede tem 6 — mediria o desenho do CSS, não a lista da grade.
const estacoesDe = (raiz) => comClasse(raiz, /^explorar-item$/).filter((li) => comClasse(li, /^explorar-link$/).length === 1);
const porTag = (raiz, tag) => todos(raiz, (n) => n.tag === tag);
function textoDe(raiz) {
  return [raiz.textContent, ...(raiz.children || []).map(textoDe)].filter(Boolean).join(' ');
}
function achar(raiz, re) {
  return todos(raiz, (n) => re.test(textoDe(n)) && n.children.length === 0);
}

// O catálogo: três linhas, duas eletivas, um ramal. Os nomes são os do curso
// real onde importa (Cálculo I/II/III existem na grade e a busca "calculo"
// bate nos três); o resto é tamanho suficiente para a tela não ter motivo
// nenhum para imprimir uma linha a mais.
const COURSES = [
  { id: 'l1a', title: 'Circuitos Digitais', stage: 1, prerequisites: [] },
  { id: 'l1b', title: 'Matemática Discreta', stage: 1, prerequisites: [] },
  { id: 'l2a', title: 'Cálculo I', stage: 2, prerequisites: ['l1b'] },
  { id: 'l2b', title: 'Cálculo II', stage: 2, prerequisites: ['l2a'] },
  { id: 'l3a', title: 'Cálculo III', stage: 3, prerequisites: ['l2b'] },
  { id: 'l3b', title: 'Álgebra Linear I', stage: 3, prerequisites: ['l1a'] },
];
const CATALOGO = {
  courses: COURSES,
  electives: [{ id: 'e1', title: 'Ética em IA' }, { id: 'e2', title: 'Sistemas Embarcados' }],
  specializations: [{ id: 's1', title: 'Computação Gráfica', status: 'under_construction', courses: [] }],
  origem: 'Universidade Brasileira Livre (https://github.com/Universidade-Livre/ciencia-da-computacao) @ b995c11',
};

// A tela resolve o catálogo numa promessa; três ticks chegam para o .then dela.
const esperar = () => Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());

async function abrir(busca = '') {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  raiz.ownerDocument = doc;
  const ctx = { catalogo: Promise.resolve(CATALOGO) };
  const inst = montar(raiz, ctx);
  await esperar();
  const input = porTag(raiz, 'input')[0];
  if (busca) {
    input.value = busca;
    for (const fn of input.listeners.input || []) fn();
    await esperar();
  }
  return { doc, raiz, inst, input, select: porTag(raiz, 'select')[0] };
}

test('explorar: pinta a rede inteira e o contador diz quantas estações', async () => {
  const { raiz } = await abrir();
  const status = comClasse(raiz, /^explorar-status$/)[0];
  assert.ok(status, 'não há elemento de status: quem usa tecla e não sabe o que mudou');
  assert.equal(status.getAttribute('role'), 'status');
  assert.match(textoDe(status), /6 esta/, `o contador não diz 6: "${textoDe(status)}"`);
  assert.equal(estacoesDe(raiz).length, 6, 'a lista não tem as 6 estações');
});

test('explorar: a busca filtra as estações E o contador acompanha', async () => {
  const { raiz } = await abrir('calculo');
  const status = comClasse(raiz, /^explorar-status$/)[0];
  assert.match(textoDe(status), /3 esta/, `buscou "calculo" e o contador diz "${textoDe(status)}"`);
  const nomes = estacoesDe(raiz).map((li) => textoDe(li));
  assert.equal(nomes.length, 3, 'busca "calculo" não deixou 3 itens');
  assert.ok(nomes.every((n) => /Cálculo/.test(n)), `sobrou o que não é Cálculo: ${nomes.join(' | ')}`);
});

test('explorar: a linha vem do catálogo, e filtrar por ela recorta a rede', async () => {
  const { raiz, select } = await abrir();
  const opcoes = (select.children || []).map((o) => textoDe(o));
  assert.equal(opcoes.length, 4, `esperava Todas + 3 linhas, veio ${opcoes.length}: ${opcoes.join(', ')}`);
  assert.match(opcoes[0], /Todas/);
  select.value = '2';
  for (const fn of select.listeners.change || []) fn();
  await esperar();
  // Só o NOME no link: o item ainda carrega o selo e o "Falta …", que os
  // outros casos já cobrem. Comparar o texto do <li> inteiro exigiria que o
  // recorte escondesse o estado — e a fatia pede que ele continue visível.
  const nomes = estacoesDe(raiz).map((li) => comClasse(li, /^explorar-link$/)[0].textContent);
  assert.deepEqual(nomes, ['Cálculo I', 'Cálculo II'], `Linha 2 pintou: ${nomes.join(', ')}`);
});

test('explorar: a origem do currículo aparece UMA vez, por mais buscas que se façam', async () => {
  // O defeito que só a tela mostra: a linha de origem é criada no montar() e
  // era ANEXADA dentro do pintar() — cada tecla somava uma ao DOM. Um teste
  // que pinta uma vez não pode ver isso. Aqui se digita três vezes.
  const { raiz, input } = await abrir();
  for (const termo of ['cal', 'calcu', 'calculo']) {
    input.value = termo;
    for (const fn of input.listeners.input || []) fn();
    await esperar();
  }
  const origens = comClasse(raiz, /^explorar-origem$/);
  assert.equal(origens.length, 1, `a origem foi anexada ${origens.length} vezes — acumula a cada pintura`);
  assert.match(textoDe(origens[0]), /Universidade Brasileira Livre/);
  const licenca = comClasse(raiz, /^explorar-licenca$/);
  assert.equal(licenca.length, 1, 'a licença fixa do rodapé também não pode se repetir');
});

test('explorar: nada encontrado oferece limpar, e limpar devolve a rede toda', async () => {
  const { raiz, input } = await abrir('xyzqualquer');
  const limpar = comClasse(raiz, /^explorar-limpar$/)[0];
  assert.ok(limpar, 'sem resultado e a tela não oferece saída');
  for (const fn of limpar.listeners.click || []) fn();
  await esperar();
  assert.equal(input.value, '', 'limpar não esvaziou o campo');
  assert.equal(estacoesDe(raiz).length, 6, 'limpar não devolveu as 6 estações');
});

test('explorar: trancada diz o que falta pelo nome, e o ramal em obras avisa', async () => {
  const { raiz } = await abrir();
  const faltas = comClasse(raiz, /^explorar-falta$/).map((n) => textoDe(n));
  assert.ok(faltas.some((f) => /Cálculo I/.test(f)), `Cálculo I não aparece como falta em ninguém: ${faltas.join(' | ')}`);
  const obras = comClasse(raiz, /^explorar-selo-obras$/);
  assert.equal(obras.length, 1, 'o ramal under_construction deveria vir com selo de obras');
});

test('explorar: eletivas e ramais dizem por palavra que não somam à grade obrigatória', async () => {
  // HERANÇA DE HONESTIDADE (24/10/2026, na grade v1) que a S7-1b perdeu no
  // caminho: as eletivas vivem num bloco COMENTADO do README da UBL e os ramais
  // são aprofundamento — nenhuma das duas conta no progresso. Sem o aviso
  // escrito, uma tela que lista "6 + 2 + 1" sugere que as oito coisas pesam
  // igual. A rede nova tem de dizer isso com palavra, como dizia a grade.
  const { raiz } = await abrir();
  const avisos = comClasse(raiz, /^explorar-aviso-grupo$/).map((n) => textoDe(n));
  assert.equal(avisos.length, 2,
    `esperava um aviso em cada seção fora da grade; vieram ${avisos.length}: ${avisos.join(' | ')}`);
  assert.ok(avisos.some((a) => /arquivad|eletiva/i.test(a) && /n[ãa]o somam/i.test(a)),
    `a seção de eletivas não diz que não soma à grade: ${avisos.join(' | ')}`);
  assert.ok(avisos.some((a) => /aprofundamento/i.test(a)),
    `a seção de ramais não diz que é aprofundamento: ${avisos.join(' | ')}`);
});
