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

  // NOME DA FONTE (27/10/2026): a fonte se autodenomina "Universidade Brasileira
  // Livre" — e o que vale e o que ela diz de si, no aviso de copyright do LICENSE
  // e do README dela ("Copyright (c) 2021 Universidade Brasileira Livre"), nao o
  // que este repo repetiu por habito. Tests/credits.test.js compara as duas
  // pontas para o erro nao voltar.
  //
  // COMMIT: quando o seed traz commitSha, a grade foi RECONCILIADA contra esse
  // snapshot (b995c11, 35 disciplinas, 0 divergencias — ver CREDITS.md). Dizer
  // "NAO FIXADO" nesse caso era mentira sobre o proprio trabalho: o CREDITS ja
  // dizia a verdade e a tela dizia outra. SHA curto porque a frase e para leitor.
  if (typeof src.commitSha === 'string' && src.commitSha.length) {
    return `${n} disciplinas da grade obrigatória — Universidade Brasileira Livre (${repo}) @ ${src.commitSha.slice(0, 7)} (grade auditada neste commit)`;
  }
  return `${n} disciplinas da grade obrigatória — Universidade Brasileira Livre (${repo}) @ commit não fixado: a fonte pode ter mudado desde a auditoria`;
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
  const arquivadas = `${n} eletivas arquivadas na fonte (bloco comentado do README) — Universidade Brasileira Livre (${repo})`;

  if (typeof src.commitSha === 'string' && src.commitSha.length) {
    return `${arquivadas} @ ${src.commitSha.slice(0, 7)}`;
  }
  // As ELETIVAS continuam sem commit fixado, e a tela diz isso: a reconciliacao
  // de b995c11 cobriu a grade obrigatoria (35) e as linhas de especializacao,
  // nao o bloco comentado. Verdade por secao, nao um aviso generico para tudo.
  return `${arquivadas} @ commit não fixado: a fonte pode ter mudado desde a auditoria`;
}

/**
 * Converte os seeds de ESPECIALIZACOES no que a tela mostra.
 *
 * Tres fontes, um unico criterio (o overlay documenta a decisao editorial):
 *   - specializations-seed.json       -> as anunciadas no indice do README;
 *   - specialization-resources-seed   -> os recursos transcritos de cada pagina;
 *   - specializations-unindexed-overlay -> as que existem na arvore da fonte mas
 *     NAO estao linkadas no indice: "include_as_under_construction_not_reachable".
 *
 * A regra que nao pode ser violada, e esta no overlay: reachableFromIndex=false
 * deve impedir o produto de PROMETER uma trilha de estudo vazia. Por isso quem
 * nao tem recurso vira `aguardandoConteudo`, e a tela avisa em vez de desenhar
 * uma secao bonita com zero coisas dentro.
 *
 * @param {object} seedEspecializacoes specializations-seed.json
 * @param {object} seedRecursos specialization-resources-seed.json
 * @param {object} overlay specializations-unindexed-overlay.json
 * @returns {{specializations: Array, origem: string, aguardando: number}}
 */
export function toSpecializations(seedEspecializacoes, seedRecursos, overlay) {
  if (!seedEspecializacoes || !Array.isArray(seedEspecializacoes.specializations)) {
    throw new TypeError('seed de especializacoes sem a lista "specializations"');
  }

  // Recursos por slug. Tolero faltar o arquivo inteiro: especializacao sem
  // recurso e caso REAL nesta fonte (algorithm-design), nao erro de leitura.
  // O nome do array raiz do seed de recursos e `resources`; aceito os
  // alternativos por seguranca, mas o teste com o seed REAL e o que garante que
  // escolhi o certo (se errar, ele devolve 0 recursos e falha).
  const linhas = seedRecursos && typeof seedRecursos === 'object'
    ? (Array.isArray(seedRecursos.resources) ? seedRecursos.resources
      : Array.isArray(seedRecursos.resourceRows) ? seedRecursos.resourceRows
      : Array.isArray(seedRecursos.items) ? seedRecursos.items
      : [])
    : [];
  const porSlug = new Map();
  for (const r of linhas) {
    if (!r || typeof r.specializationSlug !== 'string') continue;
    if (!porSlug.has(r.specializationSlug)) porSlug.set(r.specializationSlug, []);
    porSlug.get(r.specializationSlug).push({
      id: typeof r.id === 'string' ? r.id : null,
      title: typeof r.titleRaw === 'string' ? r.titleRaw : null,
      // urlRaw e o campo da fonte; sem ele nao ha link (nunca href "#").
      url: typeof r.urlRaw === 'string' && r.urlRaw.length ? r.urlRaw : null,
      type: typeof r.resourceTypeInferred === 'string' ? r.resourceTypeInferred : null,
      duration: typeof r.durationRaw === 'string' && r.durationRaw.length ? r.durationRaw : null,
      dedication: typeof r.dedicationRaw === 'string' && r.dedicationRaw.length ? r.dedicationRaw : null,
      topics: typeof r.topicsRaw === 'string' && r.topicsRaw.length ? r.topicsRaw : null,
      // Notas da fonte (ex.: "audio em ingles", "disponivel apoiando o canal a
      // partir de R$ 2,99/mes") sao dado do aluno: ele decide com elas na mao.
      notes: Array.isArray(r.sourceNotes) ? r.sourceNotes.filter((n) => typeof n === 'string') : [],
      // O overlay declara que disponibilidade de link externo NAO foi verificada.
      // Esconder isso faria um link morto parecer culpa do aluno.
      availability: typeof r.availabilityStatus === 'string' ? r.availabilityStatus : null
    });
  }

  const saida = [];

  for (const s of seedEspecializacoes.specializations) {
    if (!s || typeof s.id !== 'string' || s.id.length === 0) continue;
    const slug = typeof s.slug === 'string' ? s.slug : s.id;
    const recursos = porSlug.get(slug) || [];
    saida.push({
      id: s.id,
      slug,
      title: typeof s.title === 'string' ? s.title : s.id,
      status: typeof s.status === 'string' ? s.status : null,
      sourcePath: typeof s.sourcePath === 'string' && s.sourcePath.length ? s.sourcePath : null,
      sourceUrl: null, // preenchido abaixo, quando os recursos conhecem a pagina
      reachableFromIndex: true, // vieram do indice do README
      // Sem recurso = nada para estudar. A tela avisa; nunca finge trilha.
      aguardandoConteudo: recursos.length === 0,
      motivoAguardando: recursos.length === 0
        ? 'A fonte anuncia esta especialização, mas ainda não tem página de recursos indexada.'
        : null,
      resources: recursos
    });
  }

  // URL da pagina na fonte: vem do proprio seed de recursos, nao de template meu.
  const paginas = seedRecursos && typeof seedRecursos.specializationPages === 'object' && seedRecursos.specializationPages
    ? seedRecursos.specializationPages
    : {};
  for (const sp of saida) {
    const pg = paginas[sp.slug];
    if (pg && typeof pg.sourceUrl === 'string' && pg.sourceUrl.length) sp.sourceUrl = pg.sourceUrl;
    if (pg && Array.isArray(pg.pageNotes) && pg.pageNotes.length) {
      sp.pageNotes = pg.pageNotes.filter((n) => typeof n === 'string');
    } else {
      sp.pageNotes = [];
    }
  }

  // Overlay: as que existem na arvore e nao estao no indice. Entram como
  // aguardando conteudo, com o link da FONTE (a pagina existe, so nao tem trilha).
  const naoIndexadas = overlay && Array.isArray(overlay.unindexedSpecializations)
    ? overlay.unindexedSpecializations
    : [];
  for (const u of naoIndexadas) {
    if (!u || typeof u.id !== 'string' || u.id.length === 0) continue;
    if (saida.some((sp) => sp.id === u.id)) continue; // ja veio do indice: nao duplica
    saida.push({
      id: u.id,
      slug: typeof u.slug === 'string' ? u.slug : u.id,
      title: typeof u.title === 'string' ? u.title : u.id,
      status: typeof u.status === 'string' ? u.status : null,
      sourcePath: typeof u.sourcePath === 'string' && u.sourcePath.length ? u.sourcePath : null,
      sourceUrl: null,
      reachableFromIndex: false,
      aguardandoConteudo: true,
      motivoAguardando: 'A página existe na fonte mas está "em construção" e não é alcançável pelo índice do README: não há recursos para estudar ainda.',
      pageNotes: [],
      resources: []
    });
  }

  const aguardando = saida.filter((sp) => sp.aguardandoConteudo).length;
  return {
    specializations: saida,
    origem: `${saida.length} especializações — ${saida.length - aguardando} com recursos indexados, ${aguardando} aguardando conteúdo na fonte`,
    aguardando
  };
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
