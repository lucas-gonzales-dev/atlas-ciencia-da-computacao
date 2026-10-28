// Projeto Atlas — boot da pagina como MODULO testavel (27/10/2026).
//
// POR QUE ESTE ARQUIVO EXISTE: a ligacao da pagina morava num <script> inline
// no index.html, e codigo inline nao entra em teste nenhum — o node importa
// modulos, nao HTML. Foi exatamente por isso que o bug do hook `avisar` chegou
// ao navegador: escrever `avisar` onde a variavel da pagina se chama `aviso` e
// um ReferenceError que NENHUM teste que importa web/main.js consegue ver, e o
// importador de progresso morria em silencio ao avisar. testar_pagina pegou em
// 27/10; agora o node pega tambem.
//
// O QUE SE PROVA AQUI (e o limite honesto):
//   1. web/boot.js sobe num navegador de mentira (document/window/localStorage
//      falsos) sem ReferenceError/TypeError — ou seja, todo identificador que
//      ele usa existe;
//   2. o fio `avisar` do importador existe de verdade: disparar o clique de
//      exportar escreve um recado na tela (e o bug acima nao volta);
//   3. o service worker e registrado com escopo RELATIVO a baseURI (o bug de
//      escopo '/' que quebraria o offline no GitHub Pages);
//   4. guarda: o index.html NAO pode voltar a ter <script> inline com codigo.
// node nao executa navegador: layout, foco e PWA instalada continuam sendo
// assunto do testar_pagina / do Android.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// DOM de mentira — o minimo para render()/bind()/bindProgressIO() subirem.
// Nao e um jsdom: e o bastante para o boot rodar, e de proposito pequeno, para
// o teste mostrar onde doeu quando doer.
// ---------------------------------------------------------------------------
const classes = (no) => String(no?.className ?? no?.attrs?.class ?? '').split(/\s+/).filter(Boolean);

/** Casamenteiro de seletor simples: tag, .classe, #id, [attr], [attr="v"], descendentes. */
function casaComposto(no, composto) {
  const m = String(composto).match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+|\[[^\]]+\])*)$/);
  if (!m) return false;
  if (m[1] && no.tagName !== m[1].toUpperCase()) return false;
  for (const parte of String(m[2] ?? '').matchAll(/[.#][\w-]+|\[[^\]]+\]/g)) {
    const p = parte[0];
    if (p[0] === '.') {
      if (!classes(no).includes(p.slice(1))) return false;
    } else if (p[0] === '#') {
      if (String(no.attrs.id ?? '') !== p.slice(1)) return false;
    } else {
      const [nome, valor] = p.slice(1, -1).split('=');
      if (!(nome in no.attrs)) return false;
      if (valor !== undefined && no.attrs[nome] !== valor.replace(/^["']|["']$/g, '')) return false;
    }
  }
  return true;
}

function casa(no, seletor) {
  const compostos = String(seletor).trim().split(/\s+/).filter(Boolean);
  if (compostos.length === 0) return false;
  if (!casaComposto(no, compostos[compostos.length - 1])) return false;
  let alvo = no.parentNode;
  for (let i = compostos.length - 2; i >= 0; i--) {
    let achou = false;
    while (alvo) {
      if (casaComposto(alvo, compostos[i])) { achou = true; alvo = alvo.parentNode; break; }
      alvo = alvo.parentNode;
    }
    if (!achou) return false;
  }
  return true;
}

function criarNo(tag) {
  let texto = '';
  const no = {
    tagName: String(tag).toUpperCase(),
    children: [], attrs: {}, handlers: {}, dataset: {}, style: {},
    className: '', value: '', files: [], hidden: false, disabled: false, parentNode: null,
    append(...ns) { for (const n of ns.filter(Boolean)) { no.children.push(n); n.parentNode = no; } },
    appendChild(n) { no.append(n); return n; },
    prepend(...ns) { no.children.unshift(...ns.filter(Boolean)); for (const n of ns.filter(Boolean)) n.parentNode = no; },
    insertBefore(n) { no.children.unshift(n); n.parentNode = no; return n; },
    replaceChildren(...ns) { no.children = ns.filter(Boolean); for (const n of no.children) n.parentNode = no; },
    remove() { const p = no.parentNode; if (p) p.children = p.children.filter((c) => c !== no); no.removido = true; },
    removeChild(n) { no.children = no.children.filter((c) => c !== n); return n; },
    setAttribute(k, v) {
      no.attrs[k] = String(v);
      if (k === 'class') no.className = String(v);
      if (k === 'id') no.id = String(v);
      if (k.startsWith('data-')) no.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = String(v);
    },
    getAttribute(k) { return k in no.attrs ? no.attrs[k] : null; },
    removeAttribute(k) { delete no.attrs[k]; },
    hasAttribute(k) { return k in no.attrs; },
    addEventListener(t, f) { (no.handlers[t] ??= []).push(f); },
    removeEventListener(t, f) { no.handlers[t] = (no.handlers[t] ?? []).filter((x) => x !== f); },
    click() { no.cliques = (no.cliques ?? 0) + 1; },
    focus() {}, blur() {},
    contains(n) { return n === no || no.children.some((c) => c.contains?.(n)); },
    closest(sel) { return casa(no, sel) ? no : no.parentNode?.closest?.(sel) ?? null; },
    querySelector(sel) { return acharTodos(no, sel)[0] ?? null; },
    querySelectorAll(sel) { return acharTodos(no, sel); },
    get firstChild() { return no.children[0] ?? null; },
    get lastChild() { return no.children[no.children.length - 1] ?? null; },
    get childNodes() { return no.children; },
    // Como no navegador: escrever texto limpa os filhos.
    get textContent() { return texto !== '' ? texto : no.children.map((c) => c.textContent).join(''); },
    set textContent(v) { texto = v === undefined || v === null ? '' : String(v); no.children = []; },
    get innerHTML() { return ''; },
    set innerHTML(v) { no.children = []; texto = ''; }
  };
  no.classList = {
    contains: (c) => classes(no).includes(c),
    add: (...cs) => { no.className = [...new Set([...classes(no), ...cs])].join(' '); },
    remove: (...cs) => { no.className = classes(no).filter((c) => !cs.includes(c)).join(' '); },
    toggle: (c) => (no.classList.contains(c) ? no.classList.remove(c) : no.classList.add(c))
  };
  return no;
}

function acharTodos(raiz, sel) {
  const saida = [];
  const andar = (no) => { for (const f of no.children) { if (casa(f, sel)) saida.push(f); andar(f); } };
  andar(raiz);
  return saida;
}

function criarDocument(ids = {}) {
  return {
    baseURI: 'http://127.0.0.1/index.html',
    body: criarNo('body'),
    createElement: (t) => criarNo(t),
    createTextNode: (t) => { const n = criarNo('#text'); n.textContent = t; return n; },
    createDocumentFragment: () => criarNo('#fragment'),
    getElementById: (id) => ids[id] ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
}

function criarStorage() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear(),
    get length() { return mapa.size; }
  };
}

/** Dispara um evento nos listeners registrados — sem Event de verdade, so o alvo. */
function disparar(no, tipo, alvo) {
  const ev = { type: tipo, target: alvo ?? no, preventDefault() {}, stopPropagation() {} };
  for (const f of no.handlers[tipo] ?? []) f(ev);
  return ev;
}

// Ambiente instalado ANTES de importar o modulo: web/main.js le `document` e
// `localStorage` como globais, e e exatamente isso que o navegador fornece.
const root = criarNo('main');
root.setAttribute('id', 'app');
const buscaSlot = criarNo('div');
buscaSlot.setAttribute('id', 'busca-slot');
const documento = criarDocument({ app: root, 'busca-slot': buscaSlot });
const storage = criarStorage();
storage.setItem('atlas.progresso.v1', JSON.stringify(['logica']));
const janela = {
  document: documento,
  location: { protocol: 'http:', href: 'http://127.0.0.1/index.html', origin: 'http://127.0.0.1' },
  navigator: {}, // SEM serviceWorker: no node o registro nao deve nem ser tentado
  console
};

globalThis.document = documento;
globalThis.window = janela;
globalThis.localStorage = storage;
// fetch relativo falharia no node de qualquer jeito; fixar o erro deixa o teste
// deterministico (e garante que ele nao tenta rede).
globalThis.fetch = async () => { throw new Error('sem rede no teste: cai no catalogo minimo embutido'); };

const boot = await import('../web/boot.js');

test('boot: o modulo sobe no navegador de mentira, sem ReferenceError', async () => {
  const inicio = await boot.inicio;
  assert.ok(inicio, 'boot.js nao se auto-executou num ambiente com document+window');
  assert.equal(inicio.ok, true, `boot falhou: ${inicio.motivo}`);
  // Estado montado e catalogo carregado (aqui, o minimo embutido — o que importa
  // e que loadCatalog() foi chamado e o resultado chegou ao estado).
  assert.ok(Array.isArray(inicio.state.courses) && inicio.state.courses.length > 0);
  assert.equal(typeof inicio.state.origem, 'string');
  // Progresso veio do localStorage falso: prova que loadCompleted() leu a chave.
  assert.deepEqual(inicio.state.completed, ['logica']);
  // A tela foi desenhada de verdade: root com filhos, e o "Carregando…" substituido.
  assert.ok(root.children.length > 0, 'render() nao desenhou nada em #app');
  assert.ok(acharTodos(root, 'li.item').length > 0, 'a trilha nao foi desenhada');
  // Busca montada no slot externo e visivel.
  assert.equal(buscaSlot.hidden, false, 'o slot de busca ficou escondido depois de carregar');
  assert.ok(acharTodos(buscaSlot, 'input.busca').length === 1, 'montarBusca nao criou o campo no slot');
});

test('boot: o fio `avisar` existe — a acao de exportar escreve recado na tela', async () => {
  // O bug que este teste mata: bindProgressIO recebe o hook `avisar`, e a pagina
  // tinha uma funcao chamada `aviso`. Passar `avisar` (variavel inexistente) e um
  // ReferenceError que so aparece no navegador, no primeiro clique.
  const btn = criarNo('button');
  btn.setAttribute('data-acao', 'exportar');
  disparar(root, 'click', btn);

  const recados = acharTodos(root, 'p.aviso-save');
  assert.equal(recados.length, 1, 'nenhum recado chegou a tela: o hook avisar nao esta ligado');
  assert.ok(recados[0].textContent.length > 0, 'recado vazio nao diz nada ao aluno');
  assert.match(recados[0].textContent, /exportad/i, `recado inesperado: ${recados[0].textContent}`);
});

/**
 * Navigator de mentira com service worker. `controller` e a PROVA de que ja
 * havia um SW controlando a pagina antes do registro — no navegador ele e null
 * na primeira visita e preenchido nas seguintes (clients.claim() do sw.js).
 * `reg.controller` existe so para mostrar que o teste leria o lugar errado se
 * registrarSW consultasse o registro em vez do navigator.
 */
function navComSW({ controller }) {
  // O registro e criado aqui e EXPOSTO em estado.reg porque o listener de
  // updatefound fecha sobre ele: o teste precisa por o SW novo em reg.installing
  // ANTES de disparar o evento, exatamente como o navegador faz.
  const estado = {
    registradas: [],
    aoAtualizar: null,
    regController: {}, // diferente do navigator.controller, de proposito
    reg: { installing: null, addEventListener: () => {} }
  };
  estado.reg.addEventListener = (tipo, fn) => { if (tipo === 'updatefound') estado.aoAtualizar = fn; };
  return {
    estado,
    serviceWorker: {
      controller,
      register: async (arquivo, opts) => {
        estado.registradas.push({ arquivo, opts });
        estado.reg.controller = estado.regController;
        return estado.reg;
      }
    }
  };
}

function winCom(nav) {
  return {
    document: { baseURI: 'https://lucas-gonzales-dev.github.io/atlas-kit-tools/index.html' },
    location: { protocol: 'https:', href: 'https://lucas-gonzales-dev.github.io/atlas-kit-tools/' },
    navigator: nav,
    console
  };
}

test('boot: registrarSW usa escopo relativo a baseURI e nao avisa nada na primeira visita', async () => {
  // PRIMEIRA VISITA: sem navigator.controller. O navegador instala e ativa o SW
  // (e isso e normal, nao e atualizacao), entao "Nova versao instalada" seria
  // mentira — foi exatamente o que testar_pagina pegou em 28/10/2026.
  const nav = navComSW({ controller: null });
  const win = winCom(nav);
  const avisos = [];
  const r = await boot.registrarSW(win, (t) => avisos.push(t));

  assert.equal(r.registrado, true, `registro nao aconteceu: ${JSON.stringify(r)}`);
  assert.equal(r.jaControlava, false, 'primeira visita tem de ser reconhecida como primeira');
  assert.equal(nav.estado.registradas.length, 1);
  assert.equal(nav.estado.registradas[0].arquivo, 'sw.js');
  assert.equal(nav.estado.registradas[0].opts.scope, '/atlas-kit-tools/', 'escopo absoluto derruba o registro em subcaminho');
  assert.equal(nav.estado.aoAtualizar, null,
    'listener de updatefound instalado sem SW anterior: e ele que dispara o aviso falso na primeira visita');
  assert.equal(avisos.length, 0, 'avisar nao pode disparar antes da atualizacao');

  // Sem navigator.serviceWorker (file://, node) nao registra e nao explode.
  const semSW = await boot.registrarSW({ location: { protocol: 'http:' }, navigator: {} }, () => {});
  assert.equal(semSW.registrado, false);
});

test('boot: com SW ja no controle, a versao nova que ativa avisa o aluno', async () => {
  // VISITA SEGUINTE: ja havia um SW controlando, entao instalar outro e
  // atualizacao de verdade e o recado e honesto. Se alguem "simplificar"
  // registrarSW tirando a checagem de controller, este teste falha junto com o
  // da primeira visita — os dois lados da regra ficam cobertos.
  const nav = navComSW({ controller: { scriptURL: 'sw.js' } });
  const win = winCom(nav);
  const avisos = [];
  const r = await boot.registrarSW(win, (t) => avisos.push(t));

  assert.equal(r.registrado, true);
  assert.equal(r.jaControlava, true, 'nao reconheceu o SW que ja controlava a pagina');
  assert.equal(typeof nav.estado.aoAtualizar, 'function',
    'sem listener de updatefound o aluno nunca sabe que a versao nova instalou');

  // Updatefound -> installing -> activated: o recado so pode aparecer no fim.
  const swNovo = { state: 'installing', handlers: {}, addEventListener(t, f) { (this.handlers[t] ??= []).push(f); } };
  nav.estado.reg.installing = swNovo; // o navegador instala o novo antes de anunciar
  nav.estado.aoAtualizar({});
  assert.equal(avisos.length, 0, 'avisou enquanto o SW novo ainda estava instalando');
  swNovo.state = 'activated';
  for (const f of swNovo.handlers.statechange ?? []) f({});
  assert.equal(avisos.length, 1, 'o aluno nao ficou sabendo da atualizacao');
  assert.match(avisos[0], /Nova versão instalada/);
});

test('index.html: sem <script> inline com codigo, e o boot entra como modulo', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']\.\/web\/boot\.js["']/,
    'a pagina precisa carregar web/boot.js como modulo — e o modulo e o que o teste cobre');

  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, corpo] of inline) {
    if (/\bsrc\s*=/.test(attrs)) continue; // script externo: o codigo mora no arquivo
    // Tira comentario de HTML: <script> vazio com explicacao continua permitido.
    const codigo = corpo.replace(/<!--[\s\S]*?-->/g, '').trim();
    assert.equal(codigo, '',
      'codigo voltou para dentro do index.html: ali ele nao tem teste nenhum (foi assim que o `avisar` escapou)');
  }
});
