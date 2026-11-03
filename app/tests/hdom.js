// Projeto Atlas — o mini-DOM compartilhado da auditoria (S10a, 03/11/2026).
//
// POR QUE EXISTE: metro.test.js, explorar.test.js, folha.test.js e
// perfil.test.js cada um tem o SEU mini-DOM, e todos os quatro já esqueceram
// um atributo real uma vez (o setter de textContent, o parentNode, o dataset).
// Cada esquecimento virou um teste que media o dublê em vez da tela — o defeito
// do applyNote (94cb36c) e o da origem duplicada (S7). Aqui o dublê é um só,
// conferido contra o que as telas usam de verdade.
//
// Isto NÃO é um arquivo de teste: não tem `test(`, e por isso não entra na lista
// do package.json (tests/*.test.js é o padrão cobrado por npm-script.test.js).
export function criarNo(tag, doc) {
  const no = {
    tag,
    doc,
    // No navegador todo nó sabe de qual documento veio, e as telas perguntam
    // isso: `const doc = raiz.ownerDocument || document`. Sem o campo, a raiz
    // criada por doc.createElement() caía no `document` global do node e a tela
    // morria em ReferenceError ANTES de desenhar qualquer estado — que é
    // exatamente o que esta régua veio percorrer. O dublê tinha de mentir menos.
    ownerDocument: doc,
    children: [],
    attrs: {},
    className: '',
    value: '',
    dataset: {},
    listeners: {},
    parent: null,
    type: '',
    htmlFor: '',
    id: '',
    placeholder: '',
    hidden: false,
    files: null,
    // No navegador, escrever textContent='' destrói os filhos. Sem o setter,
    // qualquer teste de "alguma coisa some quando muda" mediria o dublê.
    get textContent() { return no._texto || ''; },
    set textContent(v) {
      no._texto = String(v);
      if (no._texto === '') no.children = [];
    },
    get parentNode() { return no.parent; },
    classList: {
      contains: (c) => no.className.split(/\s+/).includes(c),
      add: (...cs) => { no.className = [...no.className.split(/\s+/).filter(Boolean), ...cs].join(' '); },
      remove: (...cs) => { no.className = no.className.split(/\s+/).filter((c) => c && !cs.includes(c)).join(' '); }
    },
    setAttribute(k, v) { no.attrs[k] = String(v); if (k === 'id') no.id = String(v); },
    getAttribute(k) { return k in no.attrs ? no.attrs[k] : null; },
    removeAttribute(k) { delete no.attrs[k]; },
    append(...ns) { for (const n of ns) { n.parent = no; no.children.push(n); } },
    addEventListener(tipo, fn) { (no.listeners[tipo] ||= []).push(fn); },
    dispatch(tipo, ev) { for (const fn of no.listeners[tipo] || []) fn(ev); },
    focus() { no.doc.foco = no; },
    blur() {},
    remove() {
      if (!no.parent) return;
      no.parent.children = no.parent.children.filter((n) => n !== no);
      no.parent = null;
    },
    closest(sel) {
      for (let n = no; n; n = n.parent) if (casa(n, sel)) return n;
      return null;
    },
    querySelector(sel) { return todos(no, (n) => casa(n, sel))[0] || null; },
    querySelectorAll(sel) { return todos(no, (n) => casa(n, sel)); }
  };
  return no;
}

function casa(n, sel) {
  if (sel.startsWith('.')) return n.className.split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('#')) return n.id === sel.slice(1);
  return n.tag === sel;
}

export function criarDoc() {
  const porId = new Map();
  const doc = {
    foco: null,
    createElement: (tag) => criarNo(tag, doc),
    // As telas do casco procuram por id (getElementById) e por seletor.
    getElementById: (id) => porId.get(id) || null,
    _registrar: (id, no) => { porId.set(id, no); no.id = id; }
  };
  return doc;
}

export function todos(raiz, pred, saida = []) {
  if (!raiz) return saida;
  if (pred(raiz)) saida.push(raiz);
  for (const f of raiz.children || []) todos(f, pred, saida);
  return saida;
}

export const comClasse = (raiz, re) => todos(raiz, (n) => n.className.split(/\s+/).some((c) => re.test(c)));
export const porTag = (raiz, tag) => todos(raiz, (n) => n.tag === tag);
export const linksDe = (raiz) => porTag(raiz, 'a');
export const botoesDe = (raiz) => porTag(raiz, 'button');

/** Todo texto escrito num nó folha, junto. É o que a pessoa lê. */
export function textoDe(raiz) {
  return todos(raiz, (n) => n._texto).map((n) => n._texto).join(' ');
}

/** Toda classe e todo atributo, junto. É o que o CSS e o leitor de tela veem. */
export function marcasDe(raiz) {
  const partes = [];
  for (const n of todos(raiz, () => true)) {
    partes.push(n.className, n.tag);
    for (const [k, v] of Object.entries(n.attrs)) partes.push(`${k}=${v}`);
  }
  return partes.filter(Boolean).join(' ');
}

/** Storage de mentira com as chaves reais do app. */
export function storageCom(entries = {}) {
  const dados = new Map(Object.entries(entries));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    _dados: dados
  };
}

/** Promessa já resolvida, mais três ticks: chega para o .then de qualquer tela. */
export const esperar = () => Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
