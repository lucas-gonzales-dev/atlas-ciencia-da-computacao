// Projeto Atlas — camada de apresentacao web.
//
// Regra: NENHUMA regra de negocio aqui. O que esta disponivel, o que tranca,
// o que e ciclo — tudo isso vem de core/progress.js, que tem teste. Este arquivo
// so desenha e captura clique. Se aparecer um `if` de pre-requisito aqui, esta errado.
//
// Funciona em file:// E em http:// por causa do loadCatalog() abaixo.
import { unlockedCourses, detectCycles } from '../core/progress.js';
import { prereqLabel } from '../core/catalog.js';

const STORAGE_KEY = 'atlas.progresso.v1';

export function loadCompleted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return []; // armazenamento indisponivel (modo privado, file:// restrito): comeca do zero
  }
}

export function saveCompleted(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

/**
 * Carrega o catalogo. Tenta data/catalog.json (dados REAIS, gerados a partir
 * dos seeds auditados); se nao houver arquivo nem fetch possivel, usa o catalogo
 * minimo embutido so para a tela abrir e provar que o nucleo funciona.
 * A origem dos dados fica visivel na tela — nunca escondo de onde veio.
 * @returns {Promise<{courses: Array, origem: string}>}
 */
export async function loadCatalog() {
  const minimo = {
    courses: [
      { id: 'logica', title: 'Logica de Programacao', stage: 1, prerequisites: [] },
      { id: 'python-1', title: 'Python I', stage: 2, prerequisites: ['logica'] },
      { id: 'python-2', title: 'Python II', stage: 2, prerequisites: ['python-1'] },
      { id: 'eda', title: 'Estruturas de Dados e Algoritmos', stage: 3, prerequisites: ['python-2'] }
    ],
    origem: 'catalogo minimo embutido (data/catalog.json ainda nao gerado)'
  };

  if (typeof fetch !== 'function') return minimo;
  try {
    const r = await fetch('data/catalog.json', { cache: 'no-store' });
    if (!r.ok) return minimo;
    const json = await r.json();
    const courses = Array.isArray(json?.courses) ? json.courses : null;
    if (!courses || courses.length === 0) return minimo;
    return { courses, origem: json.origem || 'data/catalog.json' };
  } catch {
    return minimo; // file:// bloqueia fetch: cai no minimo em vez de quebrar a tela
  }
}

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('data-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  if (text !== undefined) n.textContent = text;
  return n;
}

/**
 * Desenha a lista. Puro: recebe estado, devolve DOM. Sem regra de negocio.
 */
export function render(root, { courses, completed, origem }) {
  root.textContent = '';

  const done = new Set(completed);
  const open = new Set(unlockedCourses(courses, completed));
  const cyclic = new Set(detectCycles(courses));
  const total = courses.length;
  const feitos = courses.filter((c) => done.has(c.id)).length;

  root.append(
    el('h1', {}, 'Projeto Atlas'),
    el('p', { class: 'sub' }, `Ciencia da Computacao — Universidade Livre Brasileira. ${feitos}/${total} concluidas.`),
    el('p', { class: 'fonte' }, `Dados: ${origem}`)
  );

  if (cyclic.size > 0) {
    root.append(
      el('p', { class: 'alerta' }, `Aviso: ${cyclic.size} disciplina(s) em ciclo de pre-requisitos — ${[...cyclic].join(', ')}`)
    );
  }

  const lista = el('ul', { class: 'trilha' });
  for (const c of courses) {
    const estado = done.has(c.id) ? 'concluida' : open.has(c.id) ? 'disponivel' : cyclic.has(c.id) ? 'ciclo' : 'trancada';
    const rotulo = { concluida: 'Concluida', disponivel: 'Disponivel agora', trancada: 'Trancada', ciclo: 'Trancada (ciclo)' }[estado];

    const btn = el('button', {
      type: 'button',
      className: 'marca',
      disabled: estado === 'trancada' || estado === 'ciclo',
      title: estado === 'disponivel' ? 'Marcar como concluida' : estado === 'concluida' ? 'Desmarcar' : 'Conclua o pre-requisito antes'
    }, estado === 'concluida' ? 'Desfazer' : 'Concluir');

    // Titulo do pre-requisito, nao o id cru (core/catalog.js decide isso, com teste).
    const prereq = prereqLabel(courses, c);

    // Bug corrigido em 23/10/2026: o codigo anterior fazia
    // `lista.append(...).lastChild` — append() devolve undefined, entao a
    // primeira disciplina jogava TypeError e a tela morria inteira. Ninguem
    // tinha visto porque index.html ainda nao existia. Agora o li e montado
    // antes de entrar na lista, sem remendo posterior.
    const li = el('li', { class: `item ${estado}`, 'data-id': c.id });
    const pedacos = [
      el('span', { class: 'titulo' }, `${c.title}${prereq}`),
      el('span', { class: 'status' }, rotulo)
    ];

    // O recurso e o motivo de a trilha existir: sem ele o aluno ve "Python I"
    // e nao tem onde estudar. Aparece tambem na disciplina TRANCADA — a trava
    // e sobre marcar conclusao, nao sobre curiosidade (decisao 23/10/2026).
    // href vazio ou "#" seria pior que link nenhum, por isso o teste explicito.
    const recurso = typeof c.resourceUrl === 'string' ? c.resourceUrl.trim() : '';
    if (recurso !== '') {
      pedacos.push(
        el('a', {
          class: 'recurso',
          href: recurso,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, 'Abrir recurso')
      );
    }

    pedacos.push(btn);
    li.append(...pedacos);
    lista.append(li);
  }

  root.append(lista);
  return { feitos, total, open: open.size };
}

/**
 * Liga clique -> estado -> redraw. Unico lugar que muta `completed`.
 */
export function bind(root, state, onToggle) {
  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('button.marca');
    if (!btn || btn.disabled) return;
    const li = btn.closest('li.item');
    const id = li?.dataset?.id;
    if (!id) return;
    onToggle(id);
  });
}
