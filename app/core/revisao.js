// Projeto Atlas — a revisão espaçada (S8, 01/11/2026).
//
// Regra da casa: roda NO NODE e NO NAVEGADOR, sem build. Zero DOM, zero
// localStorage, zero 'node:*'. Recebe o mapa de revisões e devolve um mapa
// NOVO — quem guarda no aparelho e quem desenha a tela é web/telas/revisar.js.
//
// Por que existe: o Atlas sabe o que a pessoa concluiu, mas memória não é
// caminho. A Lovable pedia perguntas de aula; o Atlas não tem aula para
// perguntar, então o método é o da Lovable sem o conteúdo inventado: tentar
// lembrar antes de ler, conferir com a anotação da própria pessoa, voltar
// depois. O conteúdo é dela; o intervalo é nosso.
//
// TRÊS DECISÕES, as três cobradas por teste (app/tests/revisao.test.js):
//   1. SEM PUNIÇÃO. Atrasar não pesa: `filaDoDia` não devolve mais que o
//      limite, e não existe "3 revisões atrasadas" na tela. Esquecer reagenda
//      (volta ao degrau 0), não acumula dívida.
//   2. NADA MUTA A ENTRADA. O estado da tela é substituído a cada pintura;
//      mutar por baixo é o bug invisível que `notes.js` já documenta.
//   3. RETIDA É REPLAY, NÃO CAMPO. "A pessoa disse `lembrei` numa revisão cujo
//      intervalo era de 21 dias ou mais" se deduz do `historico` a partir do
//      degrau 0. Guardar um booleano a mais seria dois lugares para a mesma
//      verdade, e eles discordam em silêncio.
//
// Datas sempre `aaaa-mm-dd` LOCAIS (regra 13 da casa). `toISOString()` puro
// corta em UTC e empurraria a revisão para o dia seguinte para quem estuda à
// noite em São Paulo — por isso a soma é feita em Date.UTC sobre as PARTES,
// que é o mesmo truque do `dataLocal` do núcleo, só que sem fuso no meio.
// `lerProgresso` é o que dá a `conciliar` a mesma leitura de progresso que o
// metrô usa: array cru ou objeto v3, os dois viram {completed, conclusoes}.
import { dataLocal, lerProgresso } from './viagem.js';
import { CARTOES_KEY, LIMITE_FACE, diaSeguinte } from './cartoes.js';
import { revisar } from './textos.js';

// `ehData` do core/viagem.js não é exportada (é regra interna do formato de
// progresso), e abrir uma exportação só para cá seria mudar o núcleo por
// conveniência de um módulo novo. A validação é a mesma — três campos
// numéricos, com mês e dia possíveis — escrita aqui, onde é usada.
function ehData(texto) {
  return typeof texto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texto);
}

/** Degraus do intervalo, em dias. `[3, 7, 21, 60, 180]` é a regra arbitrada. */
export const INTERVALOS = Object.freeze([3, 7, 21, 60, 180]);

/** O degrau mais alto possível: o topo da escada, não o fim da revisão. */
export const DEGRAU_MAXIMO = INTERVALOS.length - 1;

/** Resultados aceitos. Qualquer outra palavra não muda nada (vira bug de digitação, não estado). */
export const RESULTADOS = Object.freeze(['lembrei', 'em-parte', 'nao-lembrei']);

/** Chave no localStorage. Separada da de progresso e da de anotações: três ciclos de vida diferentes. */
export const STORAGE_KEY = 'atlas.revisoes.v1';

/**
 * `aaaa-mm-dd` + n dias, sem fuso.
 * @param {string} iso
 * @param {number} dias
 * @returns {string|null} null quando `iso` não é data
 */
export function somarDias(iso, dias) {
  if (!ehData(iso)) return null;
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + Math.trunc(dias));
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${dd}`;
}

/** Cópia nova, rasa por entrada: cada valor guardado também é recriado abaixo. */
function copiar(revisoes) {
  const saida = {};
  if (!revisoes || typeof revisoes !== 'object' || Array.isArray(revisoes)) return saida;
  for (const [id, e] of Object.entries(revisoes)) {
    if (!e || typeof e !== 'object') continue;
    saida[id] = {
      degrau: Number.isInteger(e.degrau) ? Math.min(Math.max(e.degrau, 0), DEGRAU_MAXIMO) : 0,
      proxima: ehData(e.proxima) ? e.proxima : null,
      historico: Array.isArray(e.historico)
        ? e.historico.filter((h) => h && ehData(h.data) && RESULTADOS.includes(h.resultado))
          .map((h) => Object.freeze({ data: h.data, resultado: h.resultado }))
        : [],
    };
  }
  return saida;
}

function idValido(id) {
  return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
}

/**
 * Concluir uma estação a coloca na fila em D + 3 (degrau 0).
 * Reagendar uma estação que já tem revisão é o que acontece quando a pessoa
 * desfaz e refaz: recomeça do degrau 0, porque a memória dela é outra agora.
 * @param {object} revisoes
 * @param {string} id
 * @param {string|Date} [data] `aaaa-mm-dd` ou Date; sem nada, hoje local
 * @returns {object} mapa novo
 */
export function agendarConclusao(revisoes, id, data) {
  const chave = idValido(id);
  const saida = copiar(revisoes);
  if (!chave) return saida;
  const base = typeof data === 'string' && ehData(data) ? data : dataLocal(data instanceof Date ? data : undefined);
  saida[chave] = Object.freeze({
    degrau: 0,
    proxima: somarDias(base, INTERVALOS[0]),
    historico: Object.freeze([]),
  });
  return saida;
}

/**
 * Registra o resultado de uma revisão e calcula a próxima data.
 * `lembrei` sobe um degrau (até o topo); `em-parte` mantém; `nao-lembrei`
 * volta ao 0. A próxima data é SEMPRE o dia da revisão + o intervalo do degrau
 * em que ela ficou — usar o dia de hoje quando a revisão é de ontem faria o
 * intervalo mentir sobre o que a pessoa realmente esperou.
 * @param {object} revisoes
 * @param {string} id
 * @param {'lembrei'|'em-parte'|'nao-lembrei'} resultado
 * @param {string|Date} [data]
 * @returns {object} mapa novo; sem entrada para o id, nada é inventado
 */
export function registrarRevisao(revisoes, id, resultado, data) {
  const chave = idValido(id);
  const saida = copiar(revisoes);
  if (!chave || !saida[chave] || !RESULTADOS.includes(resultado)) return saida;
  const base = typeof data === 'string' && ehData(data) ? data : dataLocal(data instanceof Date ? data : undefined);
  const atual = saida[chave];
  const degrau = resultado === 'lembrei'
    ? Math.min(atual.degrau + 1, DEGRAU_MAXIMO)
    : resultado === 'em-parte' ? atual.degrau : 0;
  saida[chave] = Object.freeze({
    degrau,
    proxima: somarDias(base, INTERVALOS[degrau]),
    historico: Object.freeze([...atual.historico, Object.freeze({ data: base, resultado })]),
  });
  return saida;
}

/**
 * A fila de hoje: o que vence até hoje, da mais atrasada para a mais recente,
 * no máximo `limite` (3). O resto espera sem aviso de atraso — é a decisão 1.
 * @param {object} revisoes
 * @param {string|Date} hoje
 * @param {number} [limite]
 * @returns {string[]} ids, na ordem da fila
 */
export function filaDoDia(revisoes, hoje, limite = 3) {
  const dia = typeof hoje === 'string' && ehData(hoje) ? hoje : dataLocal(hoje instanceof Date ? hoje : undefined);
  const teto = Number.isInteger(limite) && limite > 0 ? limite : 3;
  const prontas = [];
  for (const [id, e] of Object.entries(copiar(revisoes))) {
    if (!e.proxima || e.proxima > dia) continue;
    prontas.push([id, e.proxima]);
  }
  prontas.sort((a, b) => (a[1] === b[1] ? String(a[0]).localeCompare(String(b[0])) : a[1] < b[1] ? -1 : 1));
  return prontas.slice(0, teto).map(([id]) => id);
}

/**
 * A próxima data no calendário (menor `proxima` entre todas), ou null.
 * É o que a tela diz no estado "Em dia."
 */
export function proximaData(revisoes) {
  let menor = null;
  for (const e of Object.values(copiar(revisoes))) {
    if (!e.proxima) continue;
    if (menor === null || e.proxima < menor) menor = e.proxima;
  }
  return menor;
}

/**
 * Retida: um `lembrei` obtido com intervalo de 21 dias ou mais.
 * Replay do histórico a partir do degrau 0 — a decisão 3.
 */
export function estaRetida(revisoes, id) {
  const chave = idValido(id);
  const entradas = Object.values(copiar(revisoes));
  const alvo = chave && entradas.length ? copiar(revisoes)[chave] : null;
  if (!alvo) return false;
  let degrau = 0;
  for (const h of alvo.historico) {
    const intervalo = INTERVALOS[degrau];
    if (h.resultado === 'lembrei' && intervalo >= 21) return true;
    degrau = h.resultado === 'lembrei' ? Math.min(degrau + 1, DEGRAU_MAXIMO)
      : h.resultado === 'em-parte' ? degrau : 0;
  }
  return false;
}

/**
 * Desfazer a conclusão tira as revisões da estação; as outras ficam.
 * @returns {object} mapa novo
 */
export function removerEstacao(revisoes, id) {
  const chave = idValido(id);
  const saida = copiar(revisoes);
  if (chave) delete saida[chave];
  return saida;
}

/** Quantas revisões guardadas existem (o estado "nada para revisar" é 0). */
export function contarRevisoes(revisoes) {
  return Object.keys(copiar(revisoes)).length;
}

/**
 * O arquivo de revisão lido do aparelho ou do import: mapa novo, sem inventar
 * degrau nem atravessar data ilegível. `catalogoIds` filtra o que não existe
 * mais (mesma regra da anotação: descartado e CONTADO, nunca em silêncio).
 * @returns {{revisoes: object, ignorados: number, descartados: string[], ilegivel: boolean}}
 */
export function sanitizar(bruto, catalogoIds) {
  let mapa = bruto;
  if (typeof bruto === 'string') {
    if (bruto.trim() === '') mapa = {};
    else {
      try { mapa = JSON.parse(bruto); } catch { return { revisoes: {}, ignorados: 0, descartados: [], ilegivel: true }; }
    }
  }
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) {
    return { revisoes: {}, ignorados: 0, descartados: [], ilegivel: mapa !== undefined && mapa !== null };
  }
  const limpas = copiar(mapa);
  const ids = Array.isArray(catalogoIds) ? catalogoIds.filter((x) => typeof x === 'string' && x !== '') : null;
  if (!ids) return { revisoes: limpas, ignorados: 0, descartados: [], ilegivel: false };
  const conhecidos = new Set(ids);
  const validas = {};
  const descartados = [];
  for (const [id, e] of Object.entries(limpas)) {
    if (conhecidos.has(id)) validas[id] = e;
    else descartados.push(id);
  }
  const revisoes = {};
  for (const id of ids) if (id in validas) revisoes[id] = validas[id];
  return { revisoes, ignorados: descartados.length, descartados: descartados.sort(), ilegivel: false };
}

/** O texto do localStorage → mapa limpo. Corrompido, modo privado, file://: {} e a tela abre. */
export function parseRevisoes(texto) {
  return sanitizar(texto, null).revisoes;
}

/** O mapa → o texto a gravar (JSON compacto; ninguém lê isso com os olhos). */
export function serializeRevisoes(revisoes) {
  return JSON.stringify(copiar(revisoes));
}

/**
 * S15a — a MIGRAÇÃO da revisão antiga para o cartão (design/v3/00-desenho.md,
 * princípio 3 e J3): cada estação concluída COM ANOTAÇÃO vira um cartão.
 *
 * POR QUE EXISTE: a aba Revisar da S8 pergunta "o que você leva desta estação?"
 * e some quando a pessoa desfaz a conclusão; o cartão da S14 é a mesma pergunta
 * com uma RESPOSTA escrita pela pessoa dentro, e é ele que o FSRS agenda. Quem
 * tinha três estações revisáveis não pode perder o que já respondeu — o
 * conteúdo é dela, só o agendamento é nosso. Esta função é a única ponte entre
 * os dois formatos.
 *
 * A PERGUNTA NÃO É INVENTADA AQUI: `revisar.frenteMigrada` (core/textos.js)
 * escreve a frase e recebe o nome do CATÁLOGO (regra 7 — o nome e o número são
 * do dado). O verso é a anotação da própria pessoa, cortada em LIMITE_FACE:
 * um cartão cuja resposta não cabe na face é um cartão que ninguém confere.
 *
 * O ID É DETERMINÍSTICO — `migr-<idDaEstacao>`, e não um UUID. É isto que
 * torna a migração RODÁVEL DUAS VEZES: o app pode chamá-la a cada boot enquanto
 * a chave antiga existir, e a segunda rodada precisa encontrar o cartão que já
 * foi criado e não criar outro. Um id aleatório aqui duplicaria a anotação em
 * dois cartões que voltam em dias diferentes, e a pessoa veria a mesma pergunta
 * duas vezes sem como saber qual é a verdadeira. Também não sobrescreve: se o
 * cartão `migr-x` já existe, ele já foi respondido, e apagar a resposta de
 * alguém para "re-migrar" é a pior coisa que um app de memória pode fazer.
 *
 * A CHAVE `atlas.revisoes.v1` NÃO É APAGADA, e é decisão, não esquecimento: a
 * exportação (S19 / core/progress-io.js) ainda lê as revisões antigas, e apagar
 * a chave aqui destruidaria dado de quem importa a viagem noutro aparelho. A
 * migração é aditiva; a substituição dos formatos é outra fatia, com a
 * exportação já cobrindo o cartão.
 *
 * O QUE ENTRA E O QUE FICA DE FORA: uma estação só vira cartão se tiver
 * anotação (sem resposta não há o que conferir — a mesma razão de `criarCartao`
 * exigir o verso) e se existir no catálogo. Estação fora do catálogo é
 * IGNORADA E CONTADA (`ignorados`), exatamente como `sanitizar` faz com as
 * revisões huérfãs: quem importou uma viagem de um catálogo antigo tem as
 * anotações de disciplinas que saíram da grade, e criar um cartão que aponta
 * para o nada seria encher a fila diária de algo que não dá para abrir.
 *
 * @param {object|string} revisoesAntigas o mapa de `atlas.revisoes.v1` (cru ou objeto)
 * @param {Record<string,string>|object|string} notas as anotações por disciplina
 * @param {Array<{id:string,title?:string}>} catalogo a grade (só as estações)
 * @param {object} cartoes o arquivo de cartões de agora (`{cartoes}` ou o mapa)
 * @param {string} quando `aaaa-mm-ddThh:mm` local de agora; sem isso, hoje à meia-noite local
 * @returns {{cartoes: object, criados: number, ignorados: number}} nada muta, nada apaga
 */
export function migrarRevisoesAntigas(revisoesAntigas, notas, catalogo, cartoes, quando) {
  const atuais = cartoes?.cartoes ?? cartoes ?? {};
  const saida = { ...atuais };
  const { revisoes } = sanitizar(revisoesAntigas, null);
  const anotacoes = normalizarNotasParaMigracao(notas);
  const nomes = nomesDoCatalogo(catalogo);

  const instante = HE_QUANDO_TESTE.test(String(quando ?? ''))
    ? String(quando)
    : `${dataLocal()}T00:00`;
  const amanha = diaSeguinte(instante);

  let criados = 0;
  let ignorados = 0;

  for (const [id, revisao] of Object.entries(revisoes)) {
    const texto = anotacoes[id] ?? '';
    if (!texto) continue;
    const nome = nomes[id];
    if (nome === undefined) {
      ignorados += 1;
      continue;
    }
    const chave = `migr-${id}`;
    if (saida[chave]) continue;

    const frente = String(revisar.frenteMigrada(nome)).slice(0, LIMITE_FACE);
    const verso = texto.length > LIMITE_FACE ? texto.slice(0, LIMITE_FACE) : texto;
    const devido = ehData(revisao.proxima) ? revisao.proxima : amanha;

    saida[chave] = {
      id: chave,
      estacao: id,
      // `aula` e `n` nulos: a estação não é uma aula, e um cartão que mente
      // sobre a origem não pode ser aberto na folha dela. A tela da fila (S15b)
      // lê `estacao` para dizer de onde o cartão veio.
      aula: null,
      n: null,
      frente,
      verso,
      criadoEm: instante,
      devidoEm: devido,
      fsrs: null,
      historico: [],
      origem: 'revisao-antiga',
    };
    criados += 1;
  }

  return { cartoes: saida, criados, ignorados };
}

const HE_QUANDO_TESTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** O catálogo vira { id: nome }. Sem catálogo, nada migra: não há nome para a frente. */
function nomesDoCatalogo(catalogo) {
  const saida = {};
  if (!Array.isArray(catalogo)) return saida;
  for (const c of catalogo) {
    if (!c || typeof c.id !== 'string' || !c.id.trim()) continue;
    saida[c.id.trim()] = typeof c.title === 'string' && c.title.trim() ? c.title.trim() : c.id.trim();
  }
  return saida;
}

/**
 * As anotações no formato desta função: texto limpo por id. Importada de
 * core/notes.js? Não — `normalizarNotas` já faria isto, mas notes.js é outro
 * ciclo de vida (chave própria, limite próprio de 280) e puxá-lo para cá
 * arrastaria o limite de anotação para dentro da revisão. A cortesia aqui é só
 * "existe texto?" — o corte de face é LIMITE_FACE, o do cartão, não o do caderno.
 */
function normalizarNotasParaMigracao(notas) {
  let mapa = notas;
  if (typeof notas === 'string') {
    if (!notas.trim()) return {};
    try { mapa = JSON.parse(notas); } catch { return {}; }
  }
  const saida = {};
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return saida;
  for (const [id, valor] of Object.entries(mapa)) {
    if (typeof valor !== 'string') continue;
    const texto = valor.replace(/\r\n?/g, '\n').trim();
    if (texto) saida[id] = texto;
  }
  return saida;
}

/** A chave para onde a migração escreve, reexportada para quem salva: um só
 *  nome do arquivo em todo o app (a mesma escola de `modelosDeFrente` em
 *  core/cartoes.js). `STORAGE_KEY`, logo acima, é a chave que ela LÊ e não apaga. */
export { CARTOES_KEY };

/**
 * A fila derivada do que a pessoa concluiu — a função que a tela chama antes
 * de pintar, e o motivo de existir: sem ela, concluir uma estação no metrô não
 * gera revisão nenhuma, e a aba Revisar ficaria muda para sempre.
 *
 * Entra: estação concluída sem revisão (agendada pela data que o núcleo guarda
 * em `conclusoes`, ou por hoje quando não há data — a conclusão anterior à S8).
 * Sai: revisão de estação que não está mais concluída (desfazer o gesto).
 * O resto fica intacto, degrau e histórico inclusive: revisar não se apaga por
 * capricho de quem trocou de ideia sobre OUTRA estação.
 * @param {object} revisoes
 * @param {string|object} progresso formato v3 do núcleo (`{completed, conclusoes}` ou array cru)
 * @param {string|Date} [hoje]
 * @returns {object} mapa novo
 */
export function conciliar(revisoes, progresso, hoje) {
  const p = lerProgresso(progresso);
  const dia = typeof hoje === 'string' && ehData(hoje) ? hoje : dataLocal(hoje instanceof Date ? hoje : undefined);
  let saida = copiar(revisoes);
  for (const id of p.completed) {
    if (saida[id]) continue;
    const data = ehData(p.conclusoes[id]) ? p.conclusoes[id] : dia;
    saida = agendarConclusao(saida, id, data);
  }
  for (const id of Object.keys(saida)) {
    if (!p.completed.includes(id)) saida = removerEstacao(saida, id);
  }
  return saida;
}
