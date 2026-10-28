// Projeto Atlas — anotacoes por disciplina (27/10/2026).
//
// Regra da casa: roda NO NODE (testes) e NO NAVEGADOR (web/PWA), sem build.
// Zero import de 'node:*', zero filesystem, zero DOM. Recebe dados e devolve
// dados — quem le/escreve no storage e quem desenha o campo e a apresentacao.
//
// Por que existe: o Atlas sabia o que o aluno CONCLUIU, mas nao o que ele
// PENSOU de cada disciplina. "Travei em inducao", "voltar ao cap. 3", "o video
// do recurso e ruim, usar o livro" — isso morria num caderno separado, e caderno
// separado e onde anotacao vai para nunca mais ser lida. A anotacao mora AGORA
// dentro da disciplina, no mesmo aparelho e no mesmo arquivo de exportacao que o
// progresso.
//
// TRES DECISOES, as tres herdadas do importador de progresso e cobradas por
// teste (app/tests/notes.test.js):
//   1. LIMITE EXPLICITO (280). Sem limite, uma anotacao vira um capitulo dentro
//      do localStorage — que tem ~5 MB e estoura em silencio no celular. O
//      numero esta escrito aqui e no teste, nao escondido num slice.
//   2. Texto vazio APAGA. Guardar {"logica": ""} faria o contador de anotacoes
//      mentir e o arquivo exportado carregar chaves sem conteudo.
//   3. Id fora do catalogo e ignorado E CONTADO — mesma regra do `completed`.
//      Aceitar em silencio faz o arquivo crescer com lixo; descartar sem dizer
//      faz o aluno perder anotacao de um catalogo antigo sem nunca saber.
//
// HONESTIDADE SOBRE ALCANCE: o catalogo de anotacoes NAO e so a grade. Eletivas
// e especializacoes tambem tem campo na tela, entao quem filtra (exportar) e
// quem valida (importar) recebe a lista COMPLETA de ids — ver `catalogoNotas` em
// progress-io.js. Filtrar so pela grade descartaria, contadas mas perdidas, as
// anotacoes das eletivas de quem troca de aparelho.

/**
 * Tamanho maximo de uma anotacao, em caracteres.
 * 280: cabe um paragrafo de caderno ("travei em inducao matematica, voltar ao
 * cap. 3 do recurso e refazer os exercicios 1-10"), nao cabe um capitulo.
 * Se um dia mudar, mude tambem o teste que fixa este numero.
 */
export const LIMITE_NOTA = 280;

/** Chave no localStorage. Separada da chave de progresso de proposito: dois
 *  dados com ciclos de vida diferentes nao dividem gaveta. */
export const STORAGE_KEY = 'atlas.anotacoes.v1';

/**
 * Ids de uma lista, na ordem dela. Aceita objetos ({id}) e strings cruas,
 * porque o catalogo de anotacoes chega montado de tres fontes diferentes
 * (grade, eletivas, especializacoes) e o exportador ja trabalha com ids.
 * @param {Array<{id?: string}|string>} lista
 * @returns {string[]}
 */
function idsDe(lista) {
  if (!Array.isArray(lista)) return [];
  const saida = [];
  for (const item of lista) {
    if (typeof item === 'string' && item.trim() !== '') saida.push(item);
    else if (item && typeof item.id === 'string' && item.id.trim() !== '') saida.push(item.id);
  }
  return saida;
}

/**
 * Normaliza um texto de anotacao: quebra de linha do Windows vira \n, pontas
 * aparadas, corte no limite. O que nao e string vira '' (ou seja: apaga).
 * @param {unknown} texto
 * @returns {string}
 */
export function cortarNota(texto) {
  if (typeof texto !== 'string') return '';
  const limpo = texto.replace(/\r\n?/g, '\n').trim();
  return limpo.length > LIMITE_NOTA ? limpo.slice(0, LIMITE_NOTA) : limpo;
}

/**
 * Mapa de anotacoes limpo: so ids de verdade, so textos de verdade, cortados.
 * Sempre devolve objeto NOVO — nunca muta o que recebeu (o estado da tela e
 * substituido a cada paint; mutar por baixo e bug invisivel).
 * @param {unknown} notas
 * @returns {Record<string, string>}
 */
export function normalizarNotas(notas) {
  const saida = {};
  if (!notas || typeof notas !== 'object' || Array.isArray(notas)) return saida;
  for (const [id, valor] of Object.entries(notas)) {
    if (typeof id !== 'string') continue;
    const chave = id.trim();
    const texto = cortarNota(valor);
    if (chave === '' || texto === '') continue;
    saida[chave] = texto;
  }
  return saida;
}

/**
 * Escreve (ou apaga) a anotacao de UM id.
 * Texto vazio/so espaco/nao-texto APAGA a chave: anotacao vazia nao existe.
 * @param {Record<string, string>} notas estado atual
 * @param {string} id
 * @param {unknown} texto
 * @returns {Record<string, string>} novo estado (o anterior fica intacto)
 */
export function setNota(notas, id, texto) {
  const atual = normalizarNotas(notas);
  const chave = typeof id === 'string' ? id.trim() : '';
  if (chave === '') return atual;
  const valor = cortarNota(texto);
  if (valor === '') delete atual[chave];
  else atual[chave] = valor;
  return atual;
}

/**
 * Filtra anotacoes por um catalogo e reordena pela ordem dele.
 * Saida ordenada pelo catalogo (e nao pela ordem em que foram escritas) pelo
 * mesmo motivo do `completed` no exportador: dois exports do mesmo estado ficam
 * byte a byte identicos, e diff de arquivo de progresso passa a fazer sentido.
 * @param {Record<string, string>} notas
 * @param {Array<{id?: string}|string>} catalogo grade + eletivas + especializacoes
 * @returns {{notas: Record<string, string>, ignorados: number, descartados: string[]}}
 */
export function filtrarNotas(notas, catalogo) {
  const limpas = normalizarNotas(notas);
  const ids = idsDe(catalogo);
  const conhecidos = new Set(ids);
  const descartados = [];
  const validas = {};

  for (const [id, texto] of Object.entries(limpas)) {
    if (conhecidos.has(id)) validas[id] = texto;
    else descartados.push(id);
  }

  const ordenadas = {};
  for (const id of ids) {
    if (id in validas) ordenadas[id] = validas[id];
  }
  // Ordem do catalogo e estavel; o que sobrou (nao deveria sobrar) entra ao fim.
  for (const id of descartados.sort()) void id; // descartados ja sao a lista do que ficou de fora
  return { notas: ordenadas, ignorados: descartados.length, descartados };
}

/**
 * Le o texto guardado no aparelho. Storage corrompido, modo privado, versao
 * antiga, JSON que nao e mapa: tudo devolve {} em vez de derrubar a tela.
 * @param {unknown} texto
 * @returns {Record<string, string>}
 */
export function parseNotas(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') return {};
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    return {}; // anotacao ilegivel nao vale um app que nao abre
  }
  return normalizarNotas(dados);
}

/** Texto a gravar no storage (JSON compacto: aqui nao se le com os olhos). */
export function serializeNotas(notas) {
  return JSON.stringify(normalizarNotas(notas));
}
