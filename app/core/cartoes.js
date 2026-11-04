// Projeto Atlas — os CARTÕES do fechamento de aula (S14a, 04/11/2026).
//
// Por que existe: o desenho novo (design/v3/00-desenho.md, "J2 — Estudar uma
// aula", item 2, passo 3) diz que a aula só conta quando a pessoa escreve ao
// menos UM cartão, e é o cartão que volta amanhã. É a diferença entre o Atlas
// antigo e este: "assisti" não é memória, "eu sei responder" é. Este módulo guarda
// a pergunta e a resposta no aparelho e diz o que está devido hoje — nada mais.
//
// TRÊS COISAS QUE MORA EM OUTRO LUGAR, de propósito:
//   · o agendamento de verdade (estabilidade, dificuldade, intervalo) é o FSRS em
//     core/fsrs.js (S15a), e `revisarCartao` abaixo é a única ponte entre ele e o
//     cartão. Um cartão NOVO ainda nasce com `fsrs: null` e `devidoEm` amanhã:
//     antes da primeira resposta não há modelo nenhum, e um intervalo honesto é
//     "amanhã" e não um palpite bonito. A segunda data é do FSRS;
//   · quem marca a aula como estudada é core/estudo.js (estudarAula). Um cartão
//     sem a aula fechada não existe: a tela fecha a aula e cria os cartões, e as
//     duas gravações são chamadas separadas porque moram em chaves separadas;
//   · as frases que o formulário mostra são de core/textos.js (regra 7). O que
//     mora aqui são os ERROS de quem programou o gesto — mesma escola de
//     core/progress-io.js, que devolve a frase do problema no próprio módulo
//     porque o problema é do arquivo, não da tela.
//
// Regra da casa: roda no node E no navegador, sem build. Zero DOM, zero
// localStorage, zero 'node:*', zero rede. Nada muta a entrada: cada função devolve
// um objeto novo (decisão 1 de core/estudo.js, e o motivo é o mesmo — a tela pinta
// o que a função devolve, nunca o que ela mudou por baixo).
//
// Datas LOCAIS (regra 13): `criadoEm` é `aaaa-mm-ddThh:mm`; `devidoEm` é
// `aaaa-mm-dd`. Quem estuda às 23h30 de 30 de novembro tem de ver o cartão em
// 1º de dezembro do CALENDÁRIO DELA. Um `toISOString()` no meio jogaria para 30/11
// (UTC) ou adiantaria um dia, e o "amanhã" dependeria do fuso de quem exporta — o
// mesmo motivo pelo qual core/revisao.js soma dias na mão, em vez de new Date(iso).

import { NOTA_PARA_GRAU, revisarFsrs } from './fsrs.js';

/** A chave no localStorage. Separada do estudo: um cartão sobrevive à aula que o gerou. */
export const CARTOES_KEY = 'atlas.cartoes.v1';

/**
 * O que a pessoa diz da própria acerto, no botão do cartão: 'certeza', 'acho' ou
 * 'chute'. ARBITRADO (S15a): a confiança é REGISTRADA e não usada no agendamento.
 *
 * Por que existe se não muda nada: é o dado que o FSRS vai querer um dia (a
 * calibração por pessoa, S15c, compara a confiança dita com a retenção medida), e
 * confiança não coletada no dia não se reconstrói depois. Usá-la agora seria um
 * segundo algoritmo escondido num botão que a pessoa acha que só diz "lembrei".
 */
export const CONFIANCAS = Object.freeze(['certeza', 'acho', 'chute']);

/** O formato que este módulo sabe ler. Outro número é dado desconhecido, não versão antiga. */
const VERSAO_FORMATO = 1;

/** O que o cartão guarda por face. 500 caracteres é um parágrafo: acima disso a pessoa está copiando a apostila, não fazendo uma pergunta. */
export const LIMITE_FACE = 500;

/** ARBITRADO (S14a): quantos cartões a pessoa deve ver por vez. Uma sessão de revisão cabe em poucos minutos; o FSRS da S15 herda e afina este teto. Sem teto, quem volta de duas semanas encontra 214 cartões e não abre nada. */
export const LIMITE_FILA = 20;

/** `aaaa-mm-ddThh:mm` local, sem segundos e sem fuso — o mesmo contrato de core/estudo.js. */
const HE_QUANDO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** `aaaa-mm-dd` local. `devidoEm` é dia, não instante: "devido hoje" não pode depender da hora. */
const HE_DIA = /^\d{4}-\d{2}-\d{2}$/;

const zero = (v) => String(v).padStart(2, '0');

/**
 * O dia seguinte, no calendário local de quem escreveu o cartão.
 *
 * `new Date(y, m-1, d+1)` em vez de somar 86.400.000 ms: a virada de mês e a de
 * ano saem do próprio calendário (31/01 -> 01/02, 30/11 -> 01/12, 31/12 -> 01/01),
 * e somar milissegundos daria o dia errado em qualquer fuso com horário de verão,
 * porque o "dia" nem sempre tem 24 horas. Os campos são lidos pelos getters LOCAIS
 * (getFullYear/getMonth/getDate), nunca pelo `toISOString()`, que é UTC.
 */
export function diaSeguinte(quando) {
  return diaDepois(quando, 1);
}

/**
 * `aaaa-mm-dd` + N dias, no calendário local. `diaSeguinte` é isto com N = 1, e a
 * S15 precisa do N solto porque o intervalo do FSRS vai de 1 a 497 dias.
 *
 * Os campos são lidos e escritos pelos GETTERS LOCAIS, nunca por
 * `toISOString()` (regra 13): quem estuda às 23h30 de 30 de novembro tem de ver o
 * cartão em 1º de dezembro do calendário DELA, e um salto de 86.400.000 ms daria o
 * dia errado em qualquer fuso com horário de verão, porque o "dia" nem sempre tem
 * 24 horas. Aqui nem há milissegundo no meio: é `new Date(ano, mes-1, dia+N)`, que
 * deixa o próprio calendário resolver a virada de mês, de ano e de fevereiro.
 */
export function diaDepois(quando, dias) {
  const partes = String(quando ?? '').slice(0, 10).split('-').map(Number);
  const [ano, mes, dia] = partes;
  if (!partes.every(Number.isFinite)) return '';
  const n = Number(dias);
  if (!Number.isInteger(n)) return '';
  const alvo = new Date(ano, mes - 1, dia + n);
  if (Number.isNaN(alvo.getTime())) return '';
  return `${alvo.getFullYear()}-${zero(alvo.getMonth() + 1)}-${zero(alvo.getDate())}`;
}

/**
 * Quantos DIAS de calendário separam duas datas locais (`aaaa-mm-dd` ou o
 * instante cheio `aaaa-mm-ddThh:mm`). A primeira entra como `de`, a segunda como
 * `ate`; devolve 0 no mesmo dia e um número negativo se `ate` é antes de `de`.
 *
 * A diferença é feita em dia-meia-noite e ARREDONDADA, não cortada: com horário de
 * verão, 30/11 → 01/12 são 23 horas, e `floor` daria 0 — o cartão ganharia um dia
 * fantasma a cada virada de fuso. `round` sobre a média de 24 h é o que faz "um dia
 * depois" ser um dia depois em qualquer calendário.
 */
function diasEntre(de, ate) {
  const parsear = (v) => {
    const partes = String(v ?? '').slice(0, 10).split('-').map(Number);
    if (!partes.every(Number.isFinite)) return NaN;
    return new Date(partes[0], partes[1] - 1, partes[2]).getTime();
  };
  const a = parsear(de);
  const b = parsear(ate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

function vazio() {
  return { versao: VERSAO_FORMATO, cartoes: {} };
}

/** O texto de uma face, sem as pontas. Cortar não é função daqui: quem passa do limite é recusado com a frase, não aparado em silêncio. */
const face = (v) => String(v ?? '').trim();

/**
 * O cartão cru vira um cartão do Atlas, ou nada. Um campo fora da forma derruba o
 * cartão, não o arquivo inteiro: é o mesmo critério de `sanitizar` em
 * core/revisao.js — a pessoa não tem como consertar um JSON, e perder um cartão
 * ruim é melhor que perder os bons.
 */
function conferirCartao(bruto, id) {
  if (!id || !bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
  const frente = face(bruto.frente);
  const verso = face(bruto.verso);
  if (!frente || !verso) return null;
  const criadoEm = typeof bruto.criadoEm === 'string' ? bruto.criadoEm : '';
  const devidoEm = typeof bruto.devidoEm === 'string' ? bruto.devidoEm : '';
  if (!HE_QUANDO.test(criadoEm) || !HE_DIA.test(devidoEm)) return null;
  const n = Number(bruto.n);
  return {
    // O `...bruto` preserva o que a S15 gravar ao lado (fsrs com estabilidade,
    // historico com notas): perder `fsrs` no round-trip ler->escrever seria
    // apagar o agendamento de um cartão que a pessoa ainda tem.
    ...bruto,
    id,
    estacao: typeof bruto.estacao === 'string' ? bruto.estacao : '',
    aula: typeof bruto.aula === 'string' ? bruto.aula : '',
    n: Number.isFinite(n) && n >= 0 ? n : null,
    frente,
    verso,
    criadoEm,
    devidoEm,
    fsrs: bruto.fsrs ?? null,
    historico: Array.isArray(bruto.historico) ? [...bruto.historico] : [],
  };
}

/**
 * O texto do localStorage vira os cartões. Corrompido, vazio ou de outra versão:
 * vazio, sem erro — a mesma regra de `lerEstudo`, pelo mesmo motivo: quem abre o
 * app no ônibus não tem o que fazer com "dados corrompidos", e a fila vazia é
 * honesta.
 */
export function lerCartoes(bruto) {
  if (typeof bruto !== 'string' || !bruto.trim()) return vazio();
  let dado;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return vazio();
  }
  if (!dado || typeof dado !== 'object' || dado.versao !== VERSAO_FORMATO) return vazio();
  const brutos = dado.cartoes && typeof dado.cartoes === 'object' ? dado.cartoes : {};
  const cartoes = {};
  for (const [id, r] of Object.entries(brutos)) {
    const c = conferirCartao(r, id);
    if (c) cartoes[id] = c;
  }
  return { versao: VERSAO_FORMATO, cartoes };
}

/** O texto para `localStorage.setItem(CARTOES_KEY, ...)`. A `versao` vai junto. */
export function serializarCartoes(cartoes) {
  return JSON.stringify({
    versao: VERSAO_FORMATO,
    cartoes: cartoes?.cartoes ?? cartoes ?? {},
  });
}

/**
 * O cartão novo. Não muta a entrada; devolve `{ ok, cartoes }` com o arquivo novo.
 *
 * A recusa é o ponto da função. Um cartão sem verso é uma dívida que a pessoa não
 * pode pagar: ele volta amanhã, a tela mostra a frente, e não há o que conferir —
 * a revisão vira ansiedade. Por isso frente e verso são obrigatórios, sem espaços
 * nas pontas, e cada um com no máximo LIMITE_FACE caracteres. O erro diz QUAL
 * campo faltou, porque "cartão inválido" na cara de quem acabou de escrever
 * 300 caracteres na resposta não ajuda ninguém a descobrir onde.
 *
 * `id` vem de fora: a tela usa `crypto.randomUUID()`, o teste passa um fixo. Um
 * cartão sem id não pode ser revisado (a fila marca "revisado" por id, como
 * core/revisao.js), e um id repetido não sobrescreve o que já existe — perder um
 * cartão por colisão de id é o tipo de perda que ninguém vê acontecer.
 *
 * @param {{cartoes: object}} cartoes o arquivo atual
 * @param {{estacao?: string, aula?: string, n?: number, frente?: string, verso?: string}} dados o que a pessoa escreveu
 * @param {string} quando `aaaa-mm-ddThh:mm` local
 * @param {string} id o id do cartão
 * @returns {{ok: true, cartoes: object, cartao: object} | {ok: false, erro: string, campo: string}}
 */
export function criarCartao(cartoes, { estacao, aula, n, frente, verso } = {}, quando, id) {
  const recusar = (campo, erro) => ({ ok: false, erro, campo });
  const atuais = cartoes?.cartoes ?? cartoes ?? {};

  if (!face(id)) return recusar('id', 'O cartão precisa de um id, senão a revisão não tem como marcá-lo como feito.');
  if (atuais[id]) return recusar('id', 'Já existe um cartão com esse id. O Atlas não sobrescreve um cartão que você já escreveu.');
  if (!HE_QUANDO.test(String(quando ?? ''))) return recusar('quando', 'O momento precisa ser uma data-hora local, no formato de um minuto do dia.');
  if (!face(estacao)) return recusar('estacao', 'O cartão precisa dizer de qual estação ele vem.');
  if (!face(aula)) return recusar('aula', 'O cartão precisa dizer de qual aula ele veio.');

  const f = face(frente);
  const v = face(verso);
  if (!f) return recusar('frente', 'Escreva a pergunta do cartão: é ela que você vai tentar responder amanhã.');
  if (f.length > LIMITE_FACE) return recusar('frente', `A pergunta do cartão tem de caber em ${LIMITE_FACE} caracteres.`);
  if (!v) return recusar('verso', 'Escreva a resposta do cartão: sem ela, não há o que conferir quando ele voltar.');
  if (v.length > LIMITE_FACE) return recusar('verso', `A resposta do cartão tem de caber em ${LIMITE_FACE} caracteres.`);

  // O número da aula na lista. `Number(null)` é 0, e 0 é a posição de uma aula
  // que não existe; por isso só entra o que se lê como número inteiro a partir
  // de 1 — o resto é null, que a fila ignora sem fingir que sabe.
  const lido = typeof n === 'number' || typeof n === 'string' ? Number(n) : NaN;
  const numero = Number.isInteger(lido) && lido >= 1 ? lido : null;
  const cartao = {
    id,
    estacao: face(estacao),
    aula: face(aula),
    n: numero,
    frente: f,
    verso: v,
    criadoEm: quando,
    devidoEm: diaSeguinte(quando),
    // S15 enche isto: { estabilidade, dificuldade, devidoEm, repeticoes, lapsos, ultimaEm }.
    // null hoje significa "ainda não há modelo", e não "o modelo não sabia o que fazer".
    fsrs: null,
    // S15 enche isto: [{ em, nota, confianca }] — cada resposta dada, com o que a
    // pessoa disse que sabia. Vazio é o cartão novo, nunca respondido.
    historico: [],
  };
  return { ok: true, cartoes: { ...atuais, [id]: cartao }, cartao };
}

/**
 * A resposta dada a um cartão, e o novo agendamento que ela produz.
 *
 * É a função que faz a frase do fechamento ser verdade: "o seu cartão volta
 * amanhã" só vale se responder hoje mover o `devidoEm` para o dia que o FSRS
 * calculou. `devidoEm` é a ÚNICA fonte da data da fila — `cartoesDevidos` já lê
 * exatamente esse campo, e é por isso que a revisão escreve nele e não num
 * paraleo: duas datas por cartão é um lugar onde elas discordam em silêncio.
 *
 * Não muta a entrada, por decisão de casa: `{ ok, cartoes }` com o arquivo
 * inteiro novo, o cartão substituído por um objeto novo. Um único cartão revisado
 * não pode tocar no mapa que a tela ainda está pintando.
 *
 * O que muda no cartão:
 *   · `fsrs` — `{ estabilidade, dificuldade, repeticoes, lapsos, ultimaEm }`.
 *     `lapsos` sobe só na Errei: é quantas vezes a memória quebrou, e é o número
 *     que a pessoa vai querer ver um dia ("este cartão já caiu três vezes").
 *   · `historico` — `{ em, nota, confianca }` acrescentado no fim. Cresce com o
 *     cartão, e não é podado de propósito: um histórico truncado é um histórico
 *     que mente sobre o que aconteceu.
 *   · `devidoEm` — hoje + o intervalo, no calendário local.
 *
 * A contagem de dias é feita AQUI, e não dentro do FSRS: o núcleo de agendamento
 * recebe um número e a casa dele é data, não instante. `ultimaEm` manda se houver
 * (a segunda revisão em diante); sem ela, a régua é o `criadoEm` — um cartão nunca
 * respondido nasceu ontem e foi visto hoje, e dizer que ele esperou 30 dias seria
 * punir a pessoa por um dia em que ela não revisou nada.
 *
 * @param {{cartoes: object}} cartoes o arquivo atual
 * @param {string} id o cartão respondido
 * @param {{nota: 'errei'|'lembrei', confianca?: 'certeza'|'acho'|'chute'}} resposta
 * @param {string} quando `aaaa-mm-ddThh:mm` local
 * @returns {{ok: true, cartoes: object, cartao: object} | {ok: false, erro: string, campo: string}}
 */
export function revisarCartao(cartoes, id, resposta = {}, quando) {
  const recusar = (campo, erro) => ({ ok: false, erro, campo });
  const atuais = cartoes?.cartoes ?? cartoes ?? {};
  const chave = typeof id === 'string' ? id.trim() : '';
  const cartao = chave ? atuais[chave] : null;

  if (!cartao) return recusar('id', 'Este cartão não está mais na sua coleção. Pode ter sido excluído ou importado depois de aberto.');
  if (!HE_QUANDO.test(String(quando ?? ''))) return recusar('quando', 'O momento precisa ser uma data-hora local, no formato de um minuto do dia.');

  const nota = String(resposta.nota ?? '').trim();
  const grau = NOTA_PARA_GRAU[nota];
  if (!grau) return recusar('nota', 'Diga se você lembrou ou errou: o Atlas tem só esses dois botões.');

  const confianca = typeof resposta.confianca === 'string' ? resposta.confianca.trim() : '';
  if (confianca && !CONFIANCAS.includes(confianca)) {
    return recusar('confianca', 'A confiança é uma entre certeza, acho e chute.');
  }

  const base = cartao.fsrs?.ultimaEm || cartao.criadoEm;
  const dias = diasEntre(base, quando);
  if (!Number.isInteger(dias)) return recusar('quando', 'A data da revisão não bate com a data em que este cartão foi criado.');

  const novo = revisarFsrs(cartao.fsrs ?? null, grau, Math.max(dias, 0));
  if (novo.erro) return recusar('nota', novo.erro);

  const intervalo = diaDepois(quando, novo.intervalo);
  if (!intervalo) return recusar('quando', 'Não deu para calcular em que dia este cartão volta.');

  const revisado = {
    ...cartao,
    devidoEm: intervalo,
    fsrs: {
      estabilidade: novo.estabilidade,
      dificuldade: novo.dificuldade,
      repeticoes: (Number(cartao.fsrs?.repeticoes) || 0) + 1,
      lapsos: (Number(cartao.fsrs?.lapsos) || 0) + (nota === 'errei' ? 1 : 0),
      ultimaEm: quando,
    },
    historico: [
      ...(Array.isArray(cartao.historico) ? cartao.historico : []),
      { em: quando, nota, confianca: confianca || null },
    ],
  };
  return { ok: true, cartoes: { ...atuais, [chave]: revisado }, cartao: revisado };
}

/**
 * O placar de uma sessão de revisão — a tela da fila (S15b) mostra ao terminar.
 *
 * `proximaEm` é o menor `devidoEm` MAIOR que hoje, entre TODOS os cartões, e não
 * só os revisados: o cartão que vence na semana que vem é informação tão útil
 * quanto o que vence amanhã, e a frase "o próximo chega em 6 dias" é o que faz a
 * pessoa voltar no dia certo em vez de abrir a fila vazia. Null quando não há
 * nada à frente — o que acontece na última revisão antes de uma semana sem aula,
 * e a tela diz "nada para revisitar" em vez de inventar uma data.
 *
 * Os três números vêm do estado ANTES e do DEPOIS, e não de uma conta própria:
 * `revisados` são quantos dos ids pedidos mudaram de verdade. Um id que já não
 * existe, ou que a tela pediu duas vezes, entra uma vez só — porque prometer
 * "12 revisados" quando foram 11 é a mentira que faz a pessoa desconfiar do app
 * inteiro, e é o motivo de a função receber o antes em vez de assumir que tudo
 * que passou pelo formulário conta.
 *
 * @param {object} antes o arquivo como estava
 * @param {object} depois o arquivo como ficou
 * @param {string[]} idsRevisados os ids que a sessão respondeu
 * @param {string} hoje `aaaa-mm-dd` local
 * @returns {{revisados: number, lembrados: number, proximaEm: string|null}}
 */
export function resumoDaSessao(antes, depois, idsRevisados, hoje) {
  const mapa = (v) => v?.cartoes ?? v ?? {};
  const deAntes = mapa(antes);
  const deDepois = mapa(depois);
  const ids = Array.isArray(idsRevisados) ? [...new Set(idsRevisados.map((i) => (typeof i === 'string' ? i.trim() : '')))] : [];

  let revisados = 0;
  let lembrados = 0;
  for (const id of ids) {
    const a = deAntes[id];
    const b = deDepois[id];
    if (!a || !b) continue;
    const resposta = (Array.isArray(b.historico) ? b.historico : []).at(-1);
    if (!resposta) continue;
    if (a.historico?.length === b.historico?.length && a.devidoEm === b.devidoEm) continue;
    revisados += 1;
    if (resposta.nota === 'lembrei') lembrados += 1;
  }

  const dia = HE_DIA.test(String(hoje ?? '')) ? hoje : null;
  let proximaEm = null;
  for (const c of Object.values(deDepois)) {
    const devido = c?.devidoEm;
    if (!HE_DIA.test(String(devido ?? ''))) continue;
    if (dia && devido <= dia) continue;
    if (proximaEm === null || devido < proximaEm) proximaEm = devido;
  }
  return { revisados, lembrados, proximaEm };
}

/** ARBITRADO (S14b2, 04/11/2026): quanto tempo um cartão leva respondido. Vinte segundos é o meio-termo honesto entre "lero-Lero" e o custo real de uma frente + um verso dito em voz alta; o FSRS da S15 afina este número com a medida de cada pessoa. */
export const SEGUNDOS_POR_CARTAO = 20;

/**
 * Quantos MINUTOS a pessoa vai gastar amanhã com a fila — é o número da frase
 * `fechamento.porHoje` ("Amanhã: 2 cartões, ~1 min").
 *
 * Arredonda PARA CIMA e nunca devolve zero: "0 min" para quem acabou de escrever
 * um cartão é uma promessa que a pessoa sabe ser falsa, e uma promessa falsa
 * sobre o custo de amanhã é o jeito mais rápido de ela não voltar. Três cartões
 * em 20 s = 60 s = 1 min.
 *
 * @param {number} quantidade quantos cartões voltam amanhã
 * @returns {number} minutos, no mínimo 1
 */
export function minutosDaFila(quantidade) {
  const n = Number(quantidade);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.ceil((n * SEGUNDOS_POR_CARTAO) / 60));
}

/**
 * Os cartões de UMA aula, na ordem em que foram escritos. É a lista do passo 3 do
 * fechamento ("até 3 cartões por aula" — o teto é da tela; aqui não há teto,
 * porque quem importou uma viagem pode ter mais, e apagar o importado seria
 * destruir estudo).
 */
export function cartoesDaAula(cartoes, aula) {
  const atuais = cartoes?.cartoes ?? cartoes ?? {};
  const chave = face(aula);
  return Object.values(atuais)
    .filter((c) => c && c.aula === chave)
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)) || String(a.id).localeCompare(String(b.id)));
}

/**
 * A fila de HOJE: os cartões devidos até `hoje`, os mais antigos primeiro, no
 * máximo LIMITE_FILA.
 *
 * Ordenar pelo `devidoEm` e não pelo `criadoEm` é o que faz a fila ser justa: um
 * cartão importado ou adiado pela S15 vence antes de um criado ontem que só vence
 * semana que vem, e quem volta depois de duas semanas começa pelo que está mais
 * atrasado — a frase do desenho (J5) é "Comece pelos 6 mais antigos".
 *
 * O corte em LIMITE_FILA não esconde nada: o resto continua devido amanhã, e o
 * total da fila é lido à parte por quem desenha "214 cartões, você vai ver 20".
 * Uma fila sem teto é a forma mais rápida de fazer alguém não abrir o app.
 *
 * @param {{cartoes: object}} cartoes
 * @param {string} hoje `aaaa-mm-dd` local
 * @returns {Array<object>}
 */
export function cartoesDevidos(cartoes, hoje) {
  if (!HE_DIA.test(String(hoje ?? ''))) return [];
  const atuais = cartoes?.cartoes ?? cartoes ?? {};
  return Object.values(atuais)
    .filter((c) => c && HE_DIA.test(String(c.devidoEm ?? '')) && c.devidoEm <= hoje)
    .sort((a, b) =>
      String(a.devidoEm).localeCompare(String(b.devidoEm)) ||
      String(a.criadoEm).localeCompare(String(b.criadoEm)) ||
      String(a.id).localeCompare(String(b.id))
    )
    .slice(0, LIMITE_FILA);
}

/**
 * As quatro frentes que puxam PARÁFRASE, e não decalque. "Explique com suas
 * palavras", "Dê um exemplo", "Qual a diferença entre X e Y", "Por que X" — as
 * quatro formas que não aceitam resposta decorada. Os textos moram em
 * core/textos.js (regra 7); o re-export existe porque quem monta o formulário do
 * fechamento importa este módulo, e a lista de modelos é um contrato do cartão,
 * não um enfeite da tela. Um só lugar, dois caminhos.
 */
export { modelosDeFrente } from './textos.js';
