// Projeto Atlas — camada de apresentacao web.
//
// Regra: NENHUMA regra de negocio aqui. O que esta disponivel, o que tranca,
// o que e ciclo — tudo isso vem de core/progress.js, que tem teste. Este arquivo
// so desenha e captura clique. Se aparecer um `if` de pre-requisito aqui, esta errado.
//
// Funciona em file:// E em http:// por causa do loadCatalog() abaixo.
import { unlockedCourses, detectCycles, nextUp } from '../core/progress.js';
import { prereqLabel } from '../core/catalog.js';

// Raiz publica do repositorio da fonte (Universidade-Livre/ciencia-da-computacao).
// Usada SÓ para montar o link da bibliografia a partir do caminho que a propria
// fonte declara (bibliographySourcePath). Nao e um endereco de recurso do Atlas:
// e o lugar onde o aluno confere o original. O commit da fonte NAO esta fixado
// (main-unpinned), entao o link aponta para main e a tela avisa que nao foi
// verificado — mesma regra de honestidade do resto do catalogo.
const ORIGEM_REPO = 'https://github.com/Universidade-Livre/ciencia-da-computacao';

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
    // Eletivas sao OPCIONAIS de proposito: um catalog.json gerado antes de
    // 24/10/2026 nao tem o campo, e a tela precisa continuar abrindo (com a
    // grade, sem a secao) em vez de morrer por um acrescimo.
    return {
      courses,
      origem: json.origem || 'data/catalog.json',
      electives: Array.isArray(json.electives) ? json.electives : [],
      origemEletivas: typeof json.origemEletivas === 'string' ? json.origemEletivas : '',
      specializations: Array.isArray(json.specializations) ? json.specializations : [],
      origemEspecializacoes: typeof json.origemEspecializacoes === 'string' ? json.origemEspecializacoes : ''
    };
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
 * Bloco "sua proxima materia" — incremento de 23/10/2026.
 * Abrir o app e ter de ler 35 linhas para descobrir o que fazer agora e o
 * caminho mais rapido para desistir de estudar: o proximo passo vem primeiro.
 *
 * NAO decide nada aqui: quem escolhe a proxima e nextUp() (core/progress.js,
 * com teste). Esta funcao so traduz a decisao em DOM, nos tres estados.
 */
function proximaMateria(courses, completed, cyclic) {
  const s = el('section', { class: 'proxima' });
  const { state, course, abertas } = nextUp(courses, completed);

  if (state === 'open' && course) {
    s.append(el('h2', {}, 'Sua proxima materia'));
    s.append(el('p', { class: 'proxima-nome' }, course.title));
    const rec = typeof course.resourceUrl === 'string' ? course.resourceUrl.trim() : '';
    // Mesmo criterio da lista: sem URL de verdade, link nenhum. href "#" seria
    // pior do que nao ter botao.
    if (rec !== '') {
      s.append(el('a', { class: 'recurso proxima-ir', href: rec, target: '_blank', rel: 'noopener noreferrer' }, 'Comecar a estudar'));
    }
    if (abertas.length > 1) {
      s.append(el('p', { class: 'proxima-mais' }, `Ha mais ${abertas.length - 1} disponivel(is) agora, na lista abaixo.`));
    }
  } else if (state === 'done') {
    s.append(el('h2', {}, 'Trilha concluida'));
    s.append(el('p', {}, `Voce concluiu todas as ${courses.length} disciplinas deste catalogo.`));
  } else {
    // blocked: nao ha o que abrir. Dizer isso em voz alta e melhor que um
    // destaque vazio — e, se a causa for ciclo na fonte, o aluno merece saber
    // que o problema e o dado, nao ele.
    s.append(el('h2', {}, 'Nada destrancado agora'));
    s.append(el('p', {}, cyclic.size > 0
      ? `Nenhuma materia destrancada: ${cyclic.size} disciplina(s) estao em ciclo de pre-requisitos na fonte.`
      : 'Nenhuma materia destrancada: conclua um pre-requisito para abrir a proxima.'));
  }
  return s;
}

/**
 * Bloco de ELETIVAS ARQUIVADAS — incremento de 24/10/2026.
 *
 * Decisao de produto (do Lucas, 24/10): tudo o que o repositorio tem vem para a
 * tela, e o que a fonte nao tem aparece como aguardando conteudo, sem inventar
 * nada. As eletivas sao o caso mais delicado disso: elas existem na fonte como
 * linhas COMENTADAS, entao aparecerem como materia corrente seria mentira — e
 * desaparecerem seria jogar fora trabalho que a universidade documentou.
 *
 * Por isso: secao propria, DEPOIS da grade, com o aviso de arquivamento, com o
 * link da fonte, e SEM botao de concluir (nao somam ao progresso).
 */
function secaoEletivas(electives, origemEletivas) {
  if (!Array.isArray(electives) || electives.length === 0) return null; // sem dado, sem secao vazia

  const s = el('section', { class: 'eletivas' });
  s.append(el('h2', {}, 'Eletivas'));
  s.append(el('p', { class: 'aviso-eletivas' },
    'Arquivadas na fonte: estas disciplinas aparecem num bloco comentado do README da UBL e NAO somam a grade obrigatoria sem decisao editorial. Estao aqui para consulta — nao contam no seu progresso.'));
  if (typeof origemEletivas === 'string' && origemEletivas.length) {
    s.append(el('p', { class: 'fonte' }, `Dados: ${origemEletivas}`));
  }

  const lista = el('ul', { class: 'eletivas-lista' });
  for (const e of electives) {
    const li = el('li', { class: 'item eletiva', 'data-id': e.id });
    const pedacos = [el('span', { class: 'titulo' }, e.title)];

    // Pre-requisitos da fonte sao TITULOS, e a tela os mostra como texto:
    // nao ha trava aqui, porque nao ha progresso a travar.
    if (Array.isArray(e.prerequisiteTitles) && e.prerequisiteTitles.length > 0) {
      pedacos.push(el('span', { class: 'prereq-texto' }, ` — pre-requisitos citados na fonte: ${e.prerequisiteTitles.join(', ')}`));
    }
    if (typeof e.topics === 'string' && e.topics.length) {
      pedacos.push(el('span', { class: 'topicos' }, e.topics));
    }

    const recurso = typeof e.resourceUrl === 'string' ? e.resourceUrl.trim() : '';
    if (recurso !== '') {
      pedacos.push(el('a', {
        class: 'recurso',
        href: recurso,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, 'Abrir recurso'));
    }

    li.append(...pedacos);
    lista.append(li);
  }

  s.append(lista);
  return s;
}

/**
 * Bloco de ESPECIALIZACOES — incremento de 24/10/2026.
 *
 * Aqui mora a decisao de honestidade do Atlas: a fonte anuncia 7 no indice,
 * 6 delas com pagina de recursos (75 linhas transcritas), 1 sem pagina
 * (Design de Algoritmos) e 2 existem na arvore mas nao estao linkadas no indice
 * (DBA e Mobile). Quem nao tem recurso aparece como "aguardando conteudo" com o
 * link da fonte — nunca como uma trilha bonita e vazia.
 */
function secaoEspecializacoes(specializations, origem) {
  if (!Array.isArray(specializations) || specializations.length === 0) return null;

  const s = el('section', { class: 'especializacoes' });
  s.append(el('h2', {}, 'Especializacoes'));
  if (typeof origem === 'string' && origem.length) {
    s.append(el('p', { class: 'fonte' }, `Dados: ${origem}`));
  }

  const lista = el('ul', { class: 'esp-lista' });
  for (const sp of specializations) {
    const li = el('li', { class: `item esp${sp.aguardandoConteudo ? ' aguardando' : ''}`, 'data-id': sp.id });
    li.append(
      el('span', { class: 'titulo' }, sp.title),
      el('span', { class: 'status' }, sp.aguardandoConteudo ? 'Aguardando conteudo' : `${sp.resources.length} recurso(s)`)
    );

    if (sp.aguardandoConteudo && typeof sp.motivoAguardando === 'string') {
      li.append(el('p', { class: 'aviso-esp' }, sp.motivoAguardando));
    }

    // Link da FONTE, quando o seed a conhece: e para la que o aluno olha se
    // quiser conferir a transcricao. Sem URL real, link nenhum.
    if (typeof sp.sourceUrl === 'string' && sp.sourceUrl.length) {
      li.append(el('a', {
        class: 'recurso esp-fonte',
        href: sp.sourceUrl,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, 'Ver pagina na fonte'));
    }

    const recursos = Array.isArray(sp.resources) ? sp.resources : [];
    if (recursos.length > 0) {
      const ul = el('ul', { class: 'esp-recursos' });
      for (const r of recursos) {
        const liR = el('li', {});
        if (typeof r.url === 'string' && r.url.length) {
          liR.append(el('a', {
            href: r.url,
            target: '_blank',
            rel: 'noopener noreferrer'
          }, r.title || r.url));
        } else {
          // Recurso sem URL na transcricao: mostro o titulo e digo que falta o
          // link. Inventar um seria pior que nao ter.
          liR.append(el('span', {}, `${r.title || '(sem titulo na fonte)'} — sem URL na fonte`));
        }
        const meta = [r.duration, r.dedication].filter((x) => typeof x === 'string' && x.length).join(' · ');
        if (meta) liR.append(el('span', { class: 'esp-meta' }, ` (${meta})`));
        if (Array.isArray(r.notes) && r.notes.length > 0) {
          liR.append(el('span', { class: 'esp-nota' }, ` — ${r.notes.join(' ')}`));
        }
        ul.append(liR);
      }
      li.append(ul);
    }

    lista.append(li);
  }

  s.append(lista);
  return s;
}

/**
 * Desenha a lista. Puro: recebe estado, devolve DOM. Sem regra de negocio.
 */
export function render(root, { courses, completed, origem, electives, origemEletivas, specializations, origemEspecializacoes }) {
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

  // O proximo passo ANTES da lista (23/10/2026): quem abre o app quer saber o
  // que fazer agora, nao percorrer 35 linhas para descobrir.
  const destaque = proximaMateria(courses, completed, cyclic);
  root.append(destaque);

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

    // BIBLIOGRAFIA (item 3, 24/10/2026). O que existe de verdade: cada uma das
    // 35 disciplinas traz `bibliographySourcePath` transcrito do README da UBL
    // (ex.: extras/bibliography/01_digital_circuits.md). O CONTEUDO dessas
    // paginas NAO foi transcrito — a reconciliacao do kit conferiu que os 35
    // caminhos resolvem, nada alem disso. Entao a tela mostra o caminho e o
    // link para a pagina na fonte, e diz com todas as letras que o caminho vem
    // da fonte e que a lista de livros nao esta dentro do Atlas.
    // Inventar titulo de livro aqui seria o pior erro possivel deste item.
    const biblioPath = typeof c.bibliography === 'string' ? c.bibliography.trim() : '';
    if (biblioPath !== '') {
      // el() recebe TEXTO no terceiro argumento, nao filhos. Montar o span e dar
      // append() nele: passar o array de filhos jogaria "[object Object]" na tela
      // e sumiria com o link e com o aviso sem erro nenhum no console — foi o que
      // os testes de bibliografia pegaram em 24/10/2026 (0 links em 35).
      const biblio = el('span', { class: 'biblio' });
      biblio.append(
        el('a', {
          class: 'biblio-link',
          href: `${ORIGEM_REPO}/blob/main/${biblioPath}`,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, `Bibliografia: ${biblioPath}`),
        el('span', { class: 'biblio-nota' }, 'Caminho transcrito da fonte, disponibilidade nao verificada. O Atlas nao guarda o conteudo dos livros.')
      );
      pedacos.push(biblio);
    }

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

  // Eletivas DEPOIS da grade, e fora dela: sao conteudo arquivado, nao caminho.
  // `total` e `feitos` continuam sendo os da grade obrigatoria — se um dia
  // alguem somar eletiva aqui, o progresso do aluno passa a mentir.
  const especializacoes = secaoEspecializacoes(specializations, origemEspecializacoes);
  if (especializacoes) root.append(especializacoes);

  const eletivas = secaoEletivas(electives, origemEletivas);
  if (eletivas) root.append(eletivas);

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
