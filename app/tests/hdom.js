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
    // S10b: `hidden` é um atributo de presença — não tem valor. O casco e o selo
    // de rede perguntam «está escondido?», e um dublê sem hasAttribute obrigaria
    // a tela a ler getAttribute('hidden'), que é outra pergunta.
    hasAttribute(k) { return k in no.attrs; },
    removeAttribute(k) { delete no.attrs[k]; },
    append(...ns) { for (const n of ns) { n.parent = no; no.children.push(n); } },
    addEventListener(tipo, fn) { (no.listeners[tipo] ||= []).push(fn); },
    dispatch(tipo, ev) { for (const fn of no.listeners[tipo] || []) fn(ev); },
    focus() { no.doc.foco = no; },
    // S10b (réguas 3 e 4): sem blur(), `doc.foco` nunca volta a null e um teste
    // de «o foco foi devolvido» veria o nó anterior focado para sempre. O
    // navegador também não deixa dois nós se dizendo focados.
    blur() { if (no.doc.foco === no) no.doc.foco = null; },
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

/**
 * casa() — o seletor que o mini-DOM entende (S10c, item 4 do teclado/leitor).
 *
 * O que estava errado: a versão antiga testava `.classe`, `#id`,
 * `[attr="valor"]` e, no último linha, `n.tag === sel`. Um seletor que ela não
 * conhecia — `a[href]`, `nav[aria-label="Principal"]`, `[data-fechar]` sem
 * valor — CAÍA no comparação de tag e devolvia falso para todo nó. O
 * `closest('a[href]')` do `4d` devolvia null em silêncio, e o teste passava
 * verde porque o DUBLÊ não entendeu a pergunta, não porque a tela estava certa.
 * Verde mudo é pior que vermelho: vermelho engana quem lê, verde engana quem
 * confia.
 *
 * A regra agora: o parser cobre a forma que o código real usa — tag opcional
 * seguida de `.classe`, `#id`, `[attr]` e `[attr="valor"]`, sem combinador —
 * e QUALQUER outra forma LANÇA um erro com o seletor no texto. Quem escrever um
 * seletor que o dublê não monta vê isso na hora, no nome do arquivo e da linha.
 */
const PECAS = /([a-zA-Z][\w-]*)|[#.]([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;

function casa(n, sel) {
  const bruto = String(sel).trim();
  const partes = [];
  let pos = 0;
  let m;
  PECAS.lastIndex = 0;
  while ((m = PECAS.exec(bruto)) !== null) {
    if (m.index !== pos) {
      throw new Error(`hdom casa(): seletor não entendido: "${sel}" (não sei ler a partir de "${bruto.slice(pos)}")`);
    }
    pos = PECAS.lastIndex;
    partes.push(m);
  }
  if (partes.length === 0 || pos !== bruto.length) {
    throw new Error(`hdom casa(): seletor não entendido: "${sel}"`);
  }
  return partes.every((p) => {
    if (p[1] !== undefined) return n.tag === p[1].toLowerCase();
    if (p[2] !== undefined) {
      return p[0][0] === '#' ? n.id === p[2] : n.className.split(/\s+/).includes(p[2]);
    }
    return p[4] !== undefined ? n.getAttribute(p[3]) === p[4] : n.hasAttribute(p[3]);
  });
}

export function criarDoc() {
  const porId = new Map();
  const raiz = criarNo('html', { createElement: (t) => criarNo(t, doc), foco: null });
  const doc = {
    foco: null,
    createElement: (tag) => criarNo(tag, doc),
    // As telas do casco procuram por id (getElementById) e por seletor.
    getElementById: (id) => porId.get(id) || null,
    _registrar: (id, no) => { porId.set(id, no); no.id = id; },
    // S10c: `document.querySelector` existe no navegador e o web/casco.js usa
    // (nav[aria-label="Principal"]). Sem estes dois métodos no dublê, subir o
    // casco em teste morria em TypeError — o casco NUNCA foi montado em mini-DOM
    // até aqui (o tests/casco.test.js citado por pages.test.js:101 não existe).
    querySelector: (sel) => raiz.querySelector(sel),
    querySelectorAll: (sel) => raiz.querySelectorAll(sel),
    // S10b: o `documentElement` é o nó que o CSS pinta com o FUNDÃO da página
    // (`:root`/`html { background: var(--fundo) }`), e é dele que o teste de
    // tema escuro lê a cor. Sem este campo, o teste teria de chutar o fundo.
    documentElement: raiz,
    // S10b (régua 4): o navegador expõe `document.activeElement`, e é por ele
    // que a folha sabe a quem devolver o foco ao fechar. Lido de `foco`, o
    // dublê responde a mesma pergunta que o navegador responde.
    get activeElement() { return doc.foco; },
    // `matchMedia` existe para a régua de movimento (item 2): o teste pergunta
    // com a flag ligada e desligada, e a resposta é o que o `--reduced-motion`
    // abaixo define. Uma tela que chamar matchMedia sem isto aqui quebra no
    // teste em vez de quebrar no celular de quem ligou o reduzido.
    _reducedMotion: false,
    matchMedia: (consulta) => ({
      matches: /prefers-reduced-motion:\s*reduce/.test(consulta) ? doc._reducedMotion : false,
      media: consulta,
      addEventListener: () => {},
      addListener: () => {}
    })
  };
  raiz.doc = doc;
  return doc;
}

/** Janela de mentira para quem escuta a rede: `online`/`offline` são eventos da
 *  janela, não do documento, e o `onLine` é o estado lido na hora de pintar. */
export function janelaCom({ onLine = true } = {}) {
  const ouvintes = {};
  const win = {
    onLine,
    localStorage: storageCom(),
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener: (tipo, fn) => { (ouvintes[tipo] ||= []).push(fn); },
    dispatch: (tipo) => {
      // S10b (item 7): no navegador o evento ANTES de mudar — quando `offline`
      // chega aos ouvintes, `navigator.onLine` já é false, e é isso que o selo
      // lê para pintar. Um dublê que só disparasse o evento e deixasse o
      // `onLine` antigo obrigaria rede.js a chutar o estado pelo nome do
      // evento, e o teste mediria o chute, não a tela.
      if (tipo === 'offline') win.onLine = false;
      if (tipo === 'online') win.onLine = true;
      for (const fn of ouvintes[tipo] || []) fn({ type: tipo });
    },
    _ouvintes: ouvintes
  };
  return win;
}

export function todos(raiz, pred, saida = []) {
  if (!raiz) return saida;
  if (pred(raiz)) saida.push(raiz);
  for (const f of raiz.children || []) todos(f, pred, saida);
  return saida;
}

/** Toda tag de abertura de uma tag no HTML lido como texto (S10b). Está aqui e
 *  não repetida em cada arquivo porque pages.test.js já tinha a sua, e o que a
 *  casa aprendeu é que dois duplicados do mesmo leitor divergem (27/10). */
export const tagDeAbertura = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((m) => m[0]);

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
