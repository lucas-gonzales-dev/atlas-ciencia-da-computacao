// Projeto Atlas — levar o progresso junto (exportar / importar).
//
// Regra da casa: roda NO NODE (testes) e NO NAVEGADOR (web/PWA), sem build.
// Zero import de 'node:*', zero filesystem, zero DOM. Recebe dados e texto,
// devolve dados e texto — quem salva no storage e quem baixa o arquivo e a
// camada de apresentacao.
//
// Por que existe: o progresso mora no localStorage de UM navegador. Sem isto,
// trocar de aparelho (celular <-> PC) e comecar do zero, e limpar o cache do
// navegador apaga meses de estudo sem aviso.
//
// DUAS DECISOES DE HONESTIDADE, as duas cobradas por testes:
//   1. Arquivo quebrado NUNCA devolve `completed`. Quem chama nao tem o que
//      salvar, entao o progresso que ja existe sobrevive por construcao — nao
//      por um try/catch bem colocado na tela.
//   2. Id que nao pertence a ESTE catalogo e ignorado e CONTADO. Aceitar seria
//      mostrar "12/35 concluidas" sem 12 materias; descartar em silencio seria
//      o aluno perder progresso de um catalogo antigo sem nunca saber.
//
// Versao do formato: 1. Ela existe para o dia em que o envelope mudar — um
// arquivo sem versao e um arquivo que este Atlas teria de ADIVINHAR, e adivinhar
// formato de arquivo de usuario e como se perde progresso.

/** Nome do formato. Vai dentro do arquivo exportado. */
export const FORMATO = 'atlas.progresso';

/** Versao do formato. Bump obrigatoria se o envelope mudar de forma. */
export const VERSAO_FORMATO = 1;

/**
 * Ids validos do catalogo, na ORDEM do catalogo.
 * Saida ordenada pelo catalogo (e nao pela ordem de conclusao) para o arquivo
 * exportado ser legivel por gente e para dois exports do mesmo estado serem
 * byte a byte identicos — diff de arquivo de progresso passa a fazer sentido.
 * @param {Array<{id: string}>} courses
 * @returns {string[]}
 */
function idsDoCatalogo(courses) {
  const lista = Array.isArray(courses) ? courses : [];
  return lista.filter((c) => c && typeof c.id === 'string').map((c) => c.id);
}

/**
 * Filtra ids desconhecidos/duplicados e reordena pela ordem do catalogo.
 * @returns {{completed: string[], ignorados: number, descartados: string[]}}
 */
function filtrar(idsCandidatos, catalogo) {
  const conhecidos = new Set(catalogo);
  const vistos = new Set();
  const descartados = [];

  for (const id of idsCandidatos) {
    if (typeof id !== 'string' || !conhecidos.has(id)) {
      if (typeof id === 'string') descartados.push(id);
      continue;
    }
    vistos.add(id);
  }

  return {
    completed: catalogo.filter((id) => vistos.has(id)),
    ignorados: idsCandidatos.filter((id) => typeof id !== 'string' || !conhecidos.has(id)).length,
    descartados
  };
}

/**
 * Monta o pacote a exportar. Puro: devolve objeto, nao texto nem arquivo.
 * @param {Array<{id: string}>} courses catalogo atual (fonte dos ids validos)
 * @param {string[]} completed progresso do aluno
 * @param {Date} [agora] injetavel para o nome do arquivo ser testavel
 */
export function buildExport(courses, completed = [], agora = new Date()) {
  const catalogo = idsDoCatalogo(courses);
  const brutos = Array.isArray(completed) ? completed : [];
  const { completed: validos, descartados } = filtrar(brutos, catalogo);

  return {
    formato: FORMATO,
    versao: VERSAO_FORMATO,
    exportadoEm: agora instanceof Date ? agora.toISOString() : new Date().toISOString(),
    app: 'Projeto Atlas — Ciencia da Computacao (UBL)',
    catalogo: { total: catalogo.length },
    completed: validos,
    // O que ficou de fora vai DENTRO do arquivo: quem importar daqui a um ano
    // com outro catalogo consegue ver o que este export descartou e por que.
    ignorados: descartados.length,
    descartados
  };
}

/** Texto do arquivo de exportacao (JSON indentado, com quebra final). */
export function serializeExport(courses, completed = [], agora = new Date()) {
  return JSON.stringify(buildExport(courses, completed, agora), null, 2) + '\n';
}

/**
 * Nome do arquivo: `atlas-progresso-AAAA-MM-DD.json`.
 * A data vem do argumento (nao de Date.now() escondido) para ser testavel.
 * @param {Date} [agora]
 */
export function nomeDoArquivo(agora = new Date()) {
  const d = agora instanceof Date && !Number.isNaN(agora.getTime()) ? agora : new Date();
  // toISOString() e UTC; para o nome do arquivo isso basta (e e deterministico).
  return `atlas-progresso-${d.toISOString().slice(0, 10)}.json`;
}

/**
 * Le o texto de um arquivo importado e devolve o progresso dele.
 *
 * Aceita DOIS formatos, de proposito:
 *   - o envelope deste Atlas ({formato, versao, completed});
 *   - o array cru de ids, que e o que o localStorage guarda. Quem abriu o
 *     DevTools e salvou o conteudo a mao nao pode ser punido por isso.
 *
 * @param {unknown} texto
 * @param {Array<{id: string}>} courses
 * @returns {{ok: true, completed: string[], ignorados: number, mensagem: string}
 *          | {ok: false, erro: string}}
 */
export function parseImport(texto, courses = []) {
  if (typeof texto !== 'string') {
    return { ok: false, erro: 'O arquivo precisa ser texto. Nao consegui ler o que chegou.' };
  }
  if (texto.trim() === '') {
    return { ok: false, erro: 'Arquivo vazio: sem conteudo para importar.' };
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    return { ok: false, erro: `Nao consegui ler o arquivo como JSON (${e.message}).` };
  }

  let idsCandidatos;
  if (Array.isArray(dados)) {
    idsCandidatos = dados;
  } else if (dados && typeof dados === 'object') {
    if (dados.formato !== FORMATO) {
      return {
        ok: false,
        erro: `Formato "${dados.formato ?? '(sem formato)'}" nao e do Projeto Atlas. Esperado "${FORMATO}".`
      };
    }
    const versao = dados.versao;
    if (typeof versao !== 'number') {
      return {
        ok: false,
        erro: 'O arquivo nao diz a versao do formato. Sem isso eu teria de adivinhar o que ele contem — e adivinhar formato e como se perde progresso.'
      };
    }
    if (versao > VERSAO_FORMATO) {
      return {
        ok: false,
        erro: `Este arquivo e da versao ${versao}; este Atlas entende ate a versao ${VERSAO_FORMATO}. Atualize o app para importa-lo.`
      };
    }
    if (!Array.isArray(dados.completed)) {
      return { ok: false, erro: 'O campo completed precisa ser uma lista de ids de disciplina.' };
    }
    idsCandidatos = dados.completed;
  } else {
    return { ok: false, erro: 'O arquivo nao contem nem o envelope do Atlas nem uma lista de ids.' };
  }

  const catalogo = idsDoCatalogo(courses);
  const { completed, ignorados, descartados } = filtrar(idsCandidatos, catalogo);

  let mensagem = `Importadas ${completed.length} disciplina(s) deste catalogo.`;
  if (completed.length === 0) {
    mensagem = 'Nenhuma disciplina deste catalogo estava no arquivo: o progresso ficou vazio.';
  }
  if (ignorados > 0) {
    const nomes = descartados.slice(0, 5).join(', ');
    mensagem += ` ${ignorados} id(s) ignorado(s) por nao pertencer a este catalogo${nomes ? `: ${nomes}` : ''}.`;
  }

  return { ok: true, completed, ignorados, mensagem };
}
