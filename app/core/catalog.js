// Projeto Atlas — derivacao do catalogo que a tela consome, a partir do seed
// auditado da UBL.
//
// Por que isto existe em vez de editar o JSON na mao: o seed
// (content/ubl-core-seed.json) e a TRANSCRICAO da fonte, com campos dela
// (prerequisiteIds, resourceUrl, reviewStatus, lineHint). A tela e o nucleo de
// progresso falam outra lingua (prerequisites, stage, title). Alguem tem de
// traduzir — e se essa traducao morar num script com teste, ela e reproduzivel.
// Se morar na minha cabeca, ela se perde no proximo reinicio.
//
// Regra da casa (igual a core/progress.js): zero filesystem, zero node:*.
// Roda no node E no navegador. Quem le arquivo e o teste ou tools/build-catalog.mjs.

/**
 * Converte o seed auditado no catalogo da tela.
 *
 * Ordem de saida: por estagio (1..N) e, DENTRO do estagio, na ordem da fonte.
 * Nao ordeno por titulo nem por id: a ordem do README da UBL e a ordem que o
 * aluno espera reconhecer, e reordenar seria uma decisao editorial escondida
 * dentro de um gerador.
 *
 * @param {object} seed conteudo de ubl-core-seed.json
 * @returns {{courses: Array, origem: string, total: number, descartados: number}}
 */
export function toCatalog(seed) {
  if (!seed || typeof seed !== 'object') {
    throw new TypeError('seed invalido: esperado um objeto, veio ' + typeof seed);
  }
  if (!Array.isArray(seed.subjects)) {
    throw new TypeError('seed sem a lista "subjects": nao ha nada para derivar');
  }

  const courses = [];
  let descartados = 0;

  for (const s of seed.subjects) {
    if (!s || typeof s.id !== 'string' || s.id.length === 0) {
      // Registro sem id nao pode virar disciplina: sem id nao ha como marcar
      // progresso nem ligar pre-requisito. Conto e sigo — esconderia uma perda.
      descartados += 1;
      continue;
    }

    courses.push({
      id: s.id,
      slug: typeof s.slug === 'string' ? s.slug : s.id,
      title: typeof s.title === 'string' ? s.title : s.id,
      stage: Number.isInteger(s.stage) ? s.stage : null,
      trackId: typeof s.trackId === 'string' ? s.trackId : null,
      status: typeof s.curriculumStatus === 'string' ? s.curriculumStatus : null,
      // A fonte tem DOIS campos de URL: resourceUrl e url. Nem todo registro
      // traz os dois, entao aceito qualquer um — mas registro qual usei.
      resourceUrl: typeof s.resourceUrl === 'string' ? s.resourceUrl
        : typeof s.url === 'string' ? s.url
        : null,
      resourceType: typeof s.resourceType === 'string' ? s.resourceType : null,
      // progress.js le `prerequisites`. Este rename E a traducao inteira.
      prerequisites: Array.isArray(s.prerequisiteIds)
        ? s.prerequisiteIds.filter((p) => typeof p === 'string')
        : [],
      bibliography: typeof s.bibliographySourcePath === 'string' ? s.bibliographySourcePath : null
    });
  }

  // sort() do V8 e estavel, entao empatados no estagio mantem a ordem da fonte.
  // null vai para o fim: estagio desconhecido nao pode furar a fila.
  courses.sort((a, b) => {
    const ea = a.stage === null ? Number.POSITIVE_INFINITY : a.stage;
    const eb = b.stage === null ? Number.POSITIVE_INFINITY : b.stage;
    return ea - eb;
  });

  return { courses, origem: descreverOrigem(seed), total: seed.subjects.length, descartados };
}

/**
 * Frase de proveniencia que vai VISIVEL na tela. O aluno precisa saber se esta
 * vendo a grade real auditada ou um catalogo de emergencia — e se o commit da
 * fonte esta fixado, porque "main-unpinned" significa que a fonte pode ter
 * mudado desde a auditoria.
 *
 * @param {object} seed
 * @returns {string}
 */
function descreverOrigem(seed) {
  const src = seed.source && typeof seed.source === 'object' ? seed.source : {};
  const repo = typeof src.repository === 'string' && src.repository.length
    ? src.repository
    : 'fonte desconhecida';
  const n = Array.isArray(seed.subjects) ? seed.subjects.length : 0;

  if (typeof src.commitSha === 'string' && src.commitSha.length) {
    return `${n} disciplinas da grade obrigatoria — Universidade Livre Brasileira (${repo}) @ ${src.commitSha}`;
  }
  return `${n} disciplinas da grade obrigatoria — Universidade Livre Brasileira (${repo}) @ commit NAO FIXADO: a fonte pode ter mudado desde a auditoria`;
}

/**
 * Converte o seed de ELETIVAS COMENTADAS no que a tela mostra.
 *
 * Por que elas NAO entram em toCatalog(): o proprio seed traz a decisao editorial
 * da fonte — "preservar como conteudo legado/inativo e NAO somar a grade
 * obrigatoria sem decisao editorial". Sao linhas dentro de um bloco HTML
 * COMENTADO do README. Mistura-las na grade faria o progresso do aluno contar
 * materia que a universidade nao oferece, e e exatamente isso que este modulo
 * separado existe para impedir.
 *
 * Regra da casa: zero filesystem. Quem le o arquivo e o teste ou o build.
 *
 * @param {object} seed conteudo de commented-electives-seed.json
 * @returns {{electives: Array, origem: string, total: number, descartados: number}}
 */
export function toElectives(seed) {
  if (!seed || typeof seed !== 'object') {
    throw new TypeError('seed de eletivas invalido: esperado um objeto, veio ' + typeof seed);
  }
  if (!Array.isArray(seed.items)) {
    throw new TypeError('seed de eletivas sem a lista "items": nao ha nada para derivar');
  }

  const electives = [];
  let descartados = 0;

  for (const i of seed.items) {
    if (!i || typeof i.id !== 'string' || i.id.length === 0) {
      // Sem id nao ha como identificar o registro na tela nem no link da fonte.
      // Conto e sigo, como em toCatalog — esconder seria uma perda invisivel.
      descartados += 1;
      continue;
    }

    electives.push({
      id: i.id,
      title: typeof i.title === 'string' ? i.title : i.id,
      // A fonte usa `url` aqui (nao resourceUrl). Aceito os dois e registro
      // qual veio, pelo mesmo motivo de toCatalog.
      resourceUrl: typeof i.url === 'string' && i.url.length ? i.url
        : typeof i.resourceUrl === 'string' && i.resourceUrl.length ? i.resourceUrl
        : null,
      // `state` e o que permite a tela dizer "arquivada na fonte" em vez de
      // fingir que e materia corrente. Preservado cru, sem traducao.
      state: typeof i.state === 'string' ? i.state : null,
      // TITULOS, nunca ids. A fonte so da prerequisiteTitles; mapear para id
      // seria inventar um pre-requisito que ela nao declarou — e pre-requisito
      // inventado tranca ou destranca progresso na base de achismo.
      prerequisiteTitles: Array.isArray(i.prerequisiteTitles)
        ? i.prerequisiteTitles.filter((t) => typeof t === 'string')
        : [],
      topics: typeof i.topicsRaw === 'string' && i.topicsRaw.length ? i.topicsRaw : null,
      sourceLineHint: Number.isInteger(i.sourceLineHint) ? i.sourceLineHint : null,
      note: typeof i.note === 'string' ? i.note : null
    });
  }

  // Sem sort(): o seed ja vem na ordem do README, e reordenar eletiva por titulo
  // seria outra decisao editorial escondida dentro do gerador.
  return { electives, origem: descreverOrigemEletivas(seed), total: seed.items.length, descartados };
}

/**
 * Frase de proveniencia das eletivas, VISIVEL na tela.
 * O commitSha do seed de eletivas e null: a fonte pode ter mudado desde a
 * auditoria, e o aluno tem direito de saber disso antes de clicar num link.
 */
function descreverOrigemEletivas(seed) {
  const src = seed.source && typeof seed.source === 'object' ? seed.source : {};
  const repo = typeof src.repository === 'string' && src.repository.length
    ? src.repository
    : 'fonte desconhecida';
  const n = Array.isArray(seed.items) ? seed.items.length : 0;
  const arquivadas = `${n} eletivas arquivadas na fonte (bloco comentado do README) — Universidade Livre Brasileira (${repo})`;

  if (typeof src.commitSha === 'string' && src.commitSha.length) {
    return `${arquivadas} @ ${src.commitSha}`;
  }
  return `${arquivadas} @ commit NAO FIXADO: a fonte pode ter mudado desde a auditoria`;
}

/**
 * Rotulo legivel dos pre-requisitos de uma disciplina.
 *
 * Por que nao mostrar o id cru: "precisa de: ubl-core-introducao-cc-python-i"
 * e ilegivel para um aluno. Mostro o TITULO. Mas se o pre-requisito nao existe
 * no catalogo (dado ruim da fonte, que a auditoria documenta), mostro o id em
 * vez de esconder — esconder faria a disciplina parecer liberada quando nao esta.
 *
 * @param {Array<{id: string, title?: string}>} courses
 * @param {{prerequisites?: string[]}} course
 * @returns {string} '' quando nao ha pre-requisito
 */
export function prereqLabel(courses, course) {
  const ids = Array.isArray(course?.prerequisites) ? course.prerequisites : [];
  if (ids.length === 0) return '';

  const porId = new Map();
  for (const c of Array.isArray(courses) ? courses : []) {
    if (c && typeof c.id === 'string') porId.set(c.id, c);
  }

  const nomes = ids.map((id) => {
    const achado = porId.get(id);
    return achado && typeof achado.title === 'string' && achado.title.length ? achado.title : id;
  });

  return ` — precisa de: ${nomes.join(', ')}`;
}
