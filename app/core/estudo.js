// Projeto Atlas — o ESTUDO por aula (S13a, 04/11/2026).
//
// Por que existe: o desenho novo (design/v3/00-desenho.md, "O modelo de
// progresso") diz que a unidade do Atlas deixou de ser a estação e passou a ser
// a AULA, e que o mapa acende quando você LEMBRA, não quando você assiste. Este
// módulo é o degrau mais abaixo disso: ele registra que a pessoa ABRIU uma aula
// e devolve por onde continuar. Nada aqui conta progresso para o mapa — "aberta"
// é o único estado que existe nesta fatia, e o próprio desenho diz que ele "não
// conta para nada". Quem conta é "estudada", e ela nasce na S14.
//
// Regra da casa (igual a core/aulas.js e core/revisao.js): roda NO NODE e NO
// NAVEGADOR, sem build. Zero DOM, zero localStorage, zero 'node:*', zero rede.
// Recebe e devolve objetos NOVOS — quem lê e escreve `localStorage` é a tela,
// que passa o texto para `lerEstudo` e devolve o texto de `serializarEstudo`.
//
// TRÊS DECISÕES, as três cobradas por teste (app/tests/estudo.test.js):
//   1. NADA MUTA A ENTRADA. `abrirAula` é o gesto mais repetido do app (cada
//      toque em "Assistir"): mutar por baixo faria a tela pintar o estado de
//      duas chamadas anteriores. É a mesma regra de core/revisao.js e notes.js.
//   2. ENTRADA FORA DA FORMA NÃO MUDA NADA. Um `quando` sem a forma
//      `aaaa-mm-ddThh:mm` é bug de digitação de quem chama, não estado da
//      pessoa: o estudo volta igual. Precedente: RESULTADOS em core/revisao.js
//      — "qualquer outra palavra não muda nada".
//   3. O PRIMEIRO `abertaEm` NÃO SE REESCREVE. Abrir a mesma aula duas vezes
//      (a pessoa voltou ao vídeo, abriu de outro aparelho e importou, clicou de
//      novo) não pode apagar quando o estudo começou naquela aula: é o único
//      registro de tempo que esta fatia tem, e a S14 vai datar o fechamento ao
//      lado dele.
//
// Datas sempre LOCAIS, no formato `aaaa-mm-ddThh:mm` (regra 13 da casa, a
// mesma de core/revisao.js): `toISOString()` corta em UTC e jogaria a abertura
// de uma aula estudada à noite para o dia seguinte em São Paulo. A data-hora é
// produzida por quem desenha a tela; este módulo só a guarda, não a lê.
//
// A `ultima` é o cartão de retomada da J5 ("Continuar: Aula 13 — Circuitos
// Digitais, de 14:32"). Ela é um registro à parte, DEDUZÍVEL de `aulas` pelo
// maior `abertaEm`? Não: duas aberturas no mesmo minuto empatariam, e o
// desate por `n` daria a aula errada quando a pessoa volta a uma aula antiga
// de propósito. Guardar o último toque é um campo, e é o único campo redundante
// daqui — vale o cartão que ele paga.

/** A chave no localStorage. Separada de progresso e anotações: ciclos de vida diferentes. */
export const ESTUDO_KEY = 'atlas.estudo.v1';

/** O formato que este módulo sabe ler. Outro número não é "uma versão antiga": é um dado que não se conhece. */
const VERSAO_FORMATO = 1;

/** Os estados da aula que EXISTEM hoje. Cresce na S14 com 'estudada' (e depois 'lembrada', 'consolidada', 'pulada'). */
export const ESTADOS_DA_AULA = Object.freeze(['nao-iniciada', 'aberta']);

/** `aaaa-mm-ddThh:mm` local, sem segundos e sem fuso. */
const HE_QUANDO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Os estados que se deduzem de um registro, DO MAIS AVANÇADO PARA O MAIS BÁSICO. */
const ESCADA = Object.freeze([
  // S14 acrescenta aqui: ['estudada', 'estudadaEm'] — antes desta linha, e o
  // resto do módulo (resumoDaEstacao, a tela) passa a enxergar o estado novo
  // sem outra mudança, porque todos perguntam por estadoDaAula, nunca por campo.
  ['aberta', 'abertaEm'],
]);

const texto = (v) => (typeof v === 'string' && v.trim() ? v : '');
const numero = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

function vazio() {
  return { versao: VERSAO_FORMATO, aulas: {}, ultima: null };
}

/**
 * O texto do localStorage vira o estudo. Corrompido, vazio, de outra versão ou
 * de um formato que não se conhece: o estudo VAZIO, sem erro.
 *
 * Silencioso de propósito. A pessoa não tem como consertar um JSON quebrado, e
 * uma tela que joga "dados corrompidos" na cara de quem acabou de abrir o app
 * no ônibus é pior que recomeçar sem marcar as aulas abertas — o que se perde é
 * a posição de retomada, não o estudo. Registra-se o fato de abrir vazio; a
 * gravação da primeira aula já reescreve o arquivo.
 *
 * @param {unknown} bruto o valor cru de `localStorage.getItem(ESTUDO_KEY)`
 * @returns {{versao: number, aulas: Record<string, object>, ultima: object|null}}
 */
export function lerEstudo(bruto) {
  if (typeof bruto !== 'string' || !bruto.trim()) return vazio();
  let dado;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return vazio();
  }
  if (!dado || typeof dado !== 'object' || dado.versao !== VERSAO_FORMATO) return vazio();

  const brutos = dado.aulas && typeof dado.aulas === 'object' ? dado.aulas : {};
  const aulas = {};
  for (const [id, r] of Object.entries(brutos)) {
    if (!r || typeof r !== 'object' || !id) continue;
    // Sem data de abertura não há registro: um `aberta: true` sem `abertaEm`
    // seria o estado da casa antiga (booleano por estação) entrando de contrabando.
    if (typeof r.abertaEm !== 'string' || !r.abertaEm) continue;
    // O `...r` preserva o que a S14 gravar ao lado (estudadaEm, puladaEm) sem
    // que esta função precise conhecer o futuro: perder um campo no round-trip
    // ler->escrever seria apagar estudo sem ninguém ter pedido.
    aulas[id] = { ...r, estacao: texto(r.estacao), n: numero(r.n), abertaEm: r.abertaEm };
  }

  const u = dado.ultima;
  const ultima =
    u && typeof u === 'object' && texto(u.aula) && texto(u.estacao)
      ? { estacao: texto(u.estacao), aula: texto(u.aula), n: numero(u.n), em: texto(u.em) || null }
      : null;

  return { versao: VERSAO_FORMATO, aulas, ultima };
}

/** Cópia profunda até o segundo nível: o único jeito de "não mutar a entrada" sem clone estrutural. */
function copiar(estudo) {
  const aulas = {};
  for (const [id, r] of Object.entries(estudo?.aulas ?? {})) aulas[id] = { ...r };
  return {
    versao: VERSAO_FORMATO,
    aulas,
    ultima: estudo?.ultima ? { ...estudo.ultima } : null,
  };
}

/**
 * Marca a aula como ABERTA. Devolve o estudo novo; a entrada fica intacta.
 *
 * @param {{aulas: object, ultima: object|null}} estudo
 * @param {{estacao: string, aula: string, n: number}} aula `estacao` é o id da
 *   estação, `aula` é o id do vídeo no YouTube, `n` é a posição dela na lista
 * @param {string} quando `aaaa-mm-ddThh:mm` local
 * @returns o estudo novo
 */
export function abrirAula(estudo, { estacao, aula, n } = {}, quando) {
  const novo = copiar(estudo);
  if (!texto(aula) || !texto(estacao) || !HE_QUANDO.test(String(quando ?? ''))) return novo;

  const antes = novo.aulas[aula];
  novo.aulas[aula] = {
    ...(antes ?? {}),
    estacao,
    n: numero(n),
    // o abertaEm da PRIMEIRA vez não muda quando se abre de novo (decisão 3).
    abertaEm: typeof antes?.abertaEm === 'string' && antes.abertaEm ? antes.abertaEm : quando,
  };
  novo.ultima = { estacao, aula, n: numero(n), em: quando };
  return novo;
}

/**
 * O estado da aula, pelo registro dela. `nao-iniciada` quando não há registro.
 * A ESCADA é o que faz este retorno crescer sem que ninguém que o consome
 * precise mudar: a S14 põe uma linha e 'estudada' passa a sair daqui.
 *
 * @returns {'nao-iniciada'|'aberta'|string}
 */
export function estadoDaAula(estudo, aula) {
  const r = estudo?.aulas?.[texto(aula)];
  if (!r) return 'nao-iniciada';
  for (const [estado, campo] of ESCADA) {
    if (typeof r[campo] === 'string' && r[campo]) return estado;
  }
  return 'nao-iniciada';
}

/**
 * A aula por onde a pessoa CONTINUA naquela estação, com o motivo — é o cartão
 * de "Continuar: Aula 13" da folha e o botão "Começar" da primeira visita.
 *
 * As quatro regras, na ordem em que se aplicam:
 *   1. a última abertura foi desta estação e a aula ainda está na lista → ela;
 *   2. nenhuma aula desta estação foi aberta → a primeira ('comecar');
 *   3. sobrou alguma não aberta → a primeira delas ('primeira-nao-aberta');
 *   4. todas abertas e a última é de outra estação → a mais alta `n` aberta
 *      desta estação ('ultima-aberta'), porque quem percorre a playlist anda
 *      para a frente e a última aberta é o ponto onde ela parou.
 *
 * A regra 1 checa a LISTA porque as aulas vêm da YouTube API e são regeradas a
 * cada 30 dias: um vídeo sai da playlist, e continuar por uma aula que não está
 * mais na tela é um endereço que mente.
 *
 * @param {{aulas: object, ultima: object|null}} estudo
 * @param {string} estacao o id da estação
 * @param {Array<{id: string, n: number}>} aulas a lista da estação
 * @returns {{aula: object, motivo: string}|null} null quando a estação não tem aulas
 */
export function continuarDe(estudo, estacao, aulas) {
  const lista = Array.isArray(aulas) ? aulas.filter((a) => a && texto(a.id)) : [];
  if (!lista.length) return null;
  const id = new Set(lista.map((a) => a.id));

  const ultima = estudo?.ultima;
  if (ultima && ultima.estacao === estacao && id.has(ultima.aula)) {
    return { aula: lista.find((a) => a.id === ultima.aula), motivo: 'ultima-aberta' };
  }

  const abertas = lista.filter((a) => estadoDaAula(estudo, a.id) !== 'nao-iniciada');
  if (!abertas.length) return { aula: lista[0], motivo: 'comecar' };

  const seguintes = lista.filter((a) => estadoDaAula(estudo, a.id) === 'nao-iniciada');
  if (seguintes.length) return { aula: seguintes[0], motivo: 'primeira-nao-aberta' };

  const ultimaDaEstacao = abertas.reduce((melhor, a) => ((Number(a.n) || 0) > (Number(melhor.n) || 0) ? a : melhor), abertas[0]);
  return { aula: ultimaDaEstacao, motivo: 'ultima-aberta' };
}

/**
 * O que a folha mostra da estação: quantas aulas ela tem, quantas já foram
 * abertas e quanto falta assistir. `segundosRestantes` é o número cru — quem o
 * escreve na tela passa por `duracaoLegivel` de core/aulas.js, porque a regra 9
 * da casa não deixa duas telas formatarem a mesma duração de dois jeitos.
 *
 * O critério é o ESTADO, não o campo: quando a S14 acrescentar 'estudada', uma
 * aula estudada continua fora do restante, sem mexer aqui.
 *
 * @returns {{total: number, abertas: number, segundosRestantes: number}}
 */
export function resumoDaEstacao(estudo, estacao, aulas) {
  const lista = Array.isArray(aulas) ? aulas.filter((a) => a && texto(a.id)) : [];
  let abertas = 0;
  let segundosRestantes = 0;
  for (const a of lista) {
    if (estadoDaAula(estudo, a.id) === 'nao-iniciada') segundosRestantes += Number(a.duracaoS) || 0;
    else abertas += 1;
  }
  return { total: lista.length, abertas, segundosRestantes };
}

/**
 * O texto para `localStorage.setItem(ESTUDO_KEY, ...)`. A `versao` vai junto: é
 * o que faz um formato futuro poder dizer "isso é v1" em vez de adivinhar.
 *
 * @returns {string}
 */
export function serializarEstudo(estudo) {
  return JSON.stringify({
    versao: VERSAO_FORMATO,
    aulas: estudo?.aulas ?? {},
    ultima: estudo?.ultima ?? null,
  });
}
