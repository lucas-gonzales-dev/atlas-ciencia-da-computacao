// Projeto Atlas — nucleo de progresso e desbloqueio curricular.
//
// Regra da casa: este arquivo roda NO NODE (testes) e NO NAVEGADOR (web/PWA),
// sem build e sem dependencia de plataforma. Por isso: zero import de 'node:*',
// zero filesystem. Ele recebe dados prontos e devolve dados prontos.
// Quem carrega o curriculo e outra camada (loader), que decide a origem.
//
// Tolerancia a dado ruim e deliberada: a fonte real (UBL, SHA b995c11) tem
// ambiguidades documentadas — pre-requisitos apontando para Coursera enquanto a
// linha da disciplina aponta para YouTube, especializacoes orfas sem recurso.
// Um id de pre-requisito que nao existe no catalogo NAO pode prender o aluno
// para sempre. Dado ruim e problema do auditor, nao punicao do estudante.

/**
 * Pre-requisitos de um curso que existem de fato no catalogo.
 * @param {{prerequisites?: string[]}} course
 * @param {Map<string, object>} byId
 * @returns {string[]}
 */
function prereqsKnown(course, byId) {
  const raw = Array.isArray(course?.prerequisites) ? course.prerequisites : [];
  return raw.filter((p) => typeof p === 'string' && byId.has(p));
}

/**
 * Ha um caminho de pre-requisitos que sai de `from` e volta para `target`?
 * Auto-loop conta como ciclo.
 */
function reaches(byId, from, target, seen) {
  const course = byId.get(from);
  if (!course) return false;
  for (const p of prereqsKnown(course, byId)) {
    if (p === target) return true;
    if (seen.has(p)) continue;
    seen.add(p);
    if (reaches(byId, p, target, seen)) return true;
  }
  return false;
}

/**
 * Ids que pertencem a algum ciclo de pre-requisitos.
 * Devolve SO quem esta dentro do ciclo — quem depende de um ciclo nao entra aqui.
 * A ordem segue a ordem do catalogo, para ser deterministico.
 *
 * Por que isto existe: um ciclo torna a disciplina impossivel de concluir, e sem
 * deteccao o aluno veria uma materia trancada para sempre sem explicacao.
 *
 * @param {Array<{id: string, prerequisites?: string[]}>} courses
 * @returns {string[]}
 */
export function detectCycles(courses) {
  if (!Array.isArray(courses)) return [];
  const byId = new Map();
  for (const c of courses) if (c && typeof c.id === 'string') byId.set(c.id, c);

  const inCycle = [];
  for (const c of courses) {
    if (!c || typeof c.id !== 'string') continue;
    if (reaches(byId, c.id, c.id, new Set())) inCycle.push(c.id);
  }
  return inCycle;
}

/**
 * Disciplinas disponiveis AGORA: nao concluidas, fora de ciclo e com todos os
 * pre-requisitos conhecidos ja concluidos.
 *
 * Ordem de saida = ordem do catalogo (nao a ordem de conclusao), para a UI ser
 * estavel entre renders.
 *
 * @param {Array<{id: string, prerequisites?: string[]}>} courses
 * @param {string[]} completed ids ja concluidos
 * @returns {string[]}
 */
export function unlockedCourses(courses, completed = []) {
  if (!Array.isArray(courses)) return [];
  const done = new Set(Array.isArray(completed) ? completed : []);
  const byId = new Map();
  for (const c of courses) if (c && typeof c.id === 'string') byId.set(c.id, c);

  const cyclic = new Set(detectCycles(courses));

  const out = [];
  for (const c of courses) {
    if (!c || typeof c.id !== 'string') continue;
    if (done.has(c.id)) continue;          // ja feito nao e tarefa de agora
    if (cyclic.has(c.id)) continue;        // nada se libera dentro de um ciclo
    const prereqs = prereqsKnown(c, byId);
    if (prereqs.every((p) => done.has(p))) out.push(c.id);
  }
  return out;
}
