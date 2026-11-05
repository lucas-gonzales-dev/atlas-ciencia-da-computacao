// Projeto Atlas — os DOIS EIXOS de uma estação (S16a, 04/11/2026).
//
// Por que existe: o desenho (design/v3/00-desenho.md, princípio 1 — "Progresso é
// verificado, não declarado") diz que a estação no mapa não pode ter uma cor só,
// porque hoje abrir ou marcar já muda a cor, e isso conta "eu cliquei", não "eu
// sei". Este módulo separa as duas medidas:
//
//   · PREENCHIMENTO = o que foi ESTUDADO. Vem do fechamento da aula
//     (core/estudo.js, estado 'estudada'). Estudar enche.
//   · COR = o que foi LEMBRADO depois. Vem do histórico do cartão que a própria
//     pessoa escreveu: um 'lembrei' dado num dia DEPOIS do dia em que o cartão
//     nasceu. Lembrar colore.
//
// A regra do dia seguinte não é preciosismo: o cartão nasce no fechamento da aula
// e uma Lembrei dada no MESMO dia é memória de curto prazo — a pessoa ainda tem a
// resposta na cabeça, não na memória. É exatamente o que o produto distingue.
//
// O TEMPO NUNCA REBAIXA. Nada aqui, além de `pedeRevisao`, olha `hoje`: o
// preenchimento e a cor não descem com os dias, porque apagar o que a pessoa
// mediu seria o mapa mentir de novo, só que ao contrário. A passagem do tempo
// ACRESCE UMA COISA: "esta estação pede 10 min de revisão".
//
// O "dominada" (o desafio da estação, J4) NÃO entra aqui. O eixo da cor fica
// pronto para recebê-lo: é mais uma medida por aula, não um eixo novo.
//
// Regra da casa: roda no node E no navegador, sem build. Zero DOM, zero
// localStorage, zero 'node:*', zero rede. Nada muta a entrada — e nem precisa,
// porque este módulo só lê.
//
// Datas LOCAIS (regra 13 do core/cartoes.js): todo cálculo de dias passa por
// `diasEntre`, que lê `aaaa-mm-dd` e `aaaa-mm-ddThh:mm` pelos getters locais.
// Um `Date.parse(iso)` aqui trataria a data como UTC e adiantaria um dia para
// quem estuda às 23h30 — o mesmo motivo pelo qual o agendamento faz na mão.

import { retencao } from './fsrs.js';
import { diasEntre } from './cartoes.js';

/** Limiar do "pede revisão": abaixo disto a memória está esfriando. Desenho, J3. */
export const LIMITE_RECUPERABILIDADE = 0.8;

/** Os cinco estágios que o mapa pinta. Um a mais que os quatro de hoje, e por um motivo: 'concluida-antes'. */
export const ESTAGIOS_DO_EIXO = Object.freeze([
  'fora',
  'embarcada',
  'em-percurso',
  'percorrida',
  'concluida-antes',
]);

const diaDe = (v) => {
  const bruto = String(v ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(bruto) ? bruto.slice(0, 10) : '';
};

const inteiro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const quociente = (a, b) => (b > 0 ? Math.min(1, Math.max(0, a / b)) : 0);

/** O arquivo de cartões aceita as duas formas que o resto do app já aceita. */
const mapaDe = (cartoes) => (cartoes && cartoes.cartoes && typeof cartoes.cartoes === 'object' ? cartoes.cartoes : cartoes) || {};

/** Os ids concluídos do progresso, seja a forma `{ completed: [...] }` ou um Set. */
function concluida(id, progresso) {
  const lista = progresso?.completed ?? progresso?.concluidas ?? progresso;
  if (!lista) return false;
  if (typeof lista.has === 'function') return lista.has(id);
  if (Array.isArray(lista)) return lista.includes(id);
  if (typeof lista === 'object') return Object.prototype.hasOwnProperty.call(lista, id);
  return false;
}

/**
 * As aulas desta estação em um dado estado, lidas do estudo.
 *
 * Filtra por `r.estacao`, não pela lista de vídeos da estação: o mapa não carrega
 * o JSON de cada estação (é o que o pedido manda), e o registro da aula já traz a
 * estação dela — é a única fonte que sobrevive sem rede.
 */
function aulasNoEstado(id, estudo, estado) {
  const out = [];
  for (const [aulaId, r] of Object.entries(estudo?.aulas ?? {})) {
    if (!r || typeof r !== 'object' || r.estacao !== id) continue;
    // A escada de core/estudo.js: 'estudada' está acima de 'aberta', e quem fecha
    // tem as duas datas. Um registro com estudadaEm NÃO é uma aula aberta.
    const pulada = diaDe(r.puladaEm);
    // S18a: 'pulada' é pulada SEM fecho. A escada de core/estudo.js põe
    // 'estudada' ACIMA de 'pulada' — quem pulou e depois fechou estudou, e o
    // preenchimento tem de contar essa aula. Um pulo em cima de um fecho não é
    // duas aulas: é uma estudada, e contá-la também como pulada daria feita = 2
    // para uma estação de 1 e um percurso inventado.
    if (estado === 'pulada') {
      if (pulada && !diaDe(r.estudadaEm)) out.push(aulaId);
      continue;
    }
    const fechada = diaDe(r.estudadaEm);
    // 'aberta' é aberta SEM fecho e SEM pulo: com `estudadaEm` ou `puladaEm` a
    // aula já passou de aberta, e contar nas duas filas inflaria o `embarcada`.
    if (estado === 'estudada' ? !fechada : fechada || pulada || !diaDe(r.abertaEm)) continue;
    out.push(aulaId);
  }
  return out;
}

/**
 * Os cartões desta estação cujo histórico traz uma Lembrei dada num dia DEPOIS de
 * o cartão nascer — as aulas em que a pessoa foi medida lembrando.
 *
 * O 'lembrei' do mesmo dia não entra. Um cartão sem `historico`, ou sem `criadoEm`
 * (dado corrompido que `lerCartoes` já descarta, mas o núcleo não confia no que
 * recebe), não colore nada: cor sem medição é a mentira antiga por outra porta.
 */
function aulasLembradas(id, estudo, cartoes) {
  const estudadas = new Set(aulasNoEstado(id, estudo, 'estudada'));
  const out = new Set();
  for (const cartao of Object.values(mapaDe(cartoes))) {
    if (!cartao || typeof cartao !== 'object' || cartao.estacao !== id) continue;
    const aulaId = typeof cartao.aula === 'string' ? cartao.aula : '';
    if (!aulaId || !estudadas.has(aulaId)) continue;
    const nasceu = diaDe(cartao.criadoEm);
    if (!nasceu) continue;
    for (const evento of Array.isArray(cartao.historico) ? cartao.historico : []) {
      if (!evento || String(evento.nota ?? '') !== 'lembrei') continue;
      const dado = diaDe(evento.em);
      if (!dado) continue;
      const espera = diasEntre(nasceu, dado);
      if (Number.isInteger(espera) && espera >= 1) {
        out.add(aulaId);
        break;
      }
    }
  }
  return out;
}

/**
 * A média da recuperabilidade PREVISTA hoje nos cartões desta estação que já têm
 * modelo (fsrs preenchido por `revisarCartao`, S15a).
 *
 * `null` quando não há cartão medido: "não sei" não é "está esfriando", e um mapa
 * que acende o anel de quem nunca revisou seria o ruído de volta.
 */
function recuperabilidadeMedia(id, cartoes, hoje) {
  const dia = diaDe(hoje);
  if (!dia) return null;
  let soma = 0;
  let n = 0;
  for (const cartao of Object.values(mapaDe(cartoes))) {
    if (!cartao || typeof cartao !== 'object' || cartao.estacao !== id) continue;
    const ultima = diaDe(cartao.fsrs?.ultimaEm);
    const S = Number(cartao.fsrs?.estabilidade);
    if (!ultima || !Number.isFinite(S) || S <= 0) continue;
    const dias = Math.max(0, diasEntre(ultima, dia) || 0);
    soma += retencao(dias, S);
    n += 1;
  }
  return n ? soma / n : null;
}

/**
 * Os dois eixos de uma estação, medidos.
 *
 * @param {string} id o id da estação no catálogo ('ubl-core-circuitos-digitais')
 * @param {{estudo?: object, cartoes?: object, indice?: object, progresso?: object, hoje?: string}} dados
 *   `indice` é o data/aulas/indice.json cru — `indice.estacoes[id]` traz `aulas` e
 *   `segundos` por estação, e é o que permite desenhar o mapa sem buscar o JSON de
 *   cada uma; `progresso` é o `{ completed: [...] }` de core/viagem.js; `hoje` é
 *   `aaaa-mm-dd` local e só serve ao `pedeRevisao`.
 * @returns {{estagio: string, estudadas: number, total: number, preenchimento: number,
 *   lembradas: number, cor: number, pedeRevisao: boolean, segundosRestantes: number}}
 */
export function eixosDaEstacao(id, { estudo, cartoes, indice, progresso, hoje } = {}) {
  const entrada = indice?.estacoes?.[id];
  const total = inteiro(entrada?.aulas);
  const segundos = inteiro(entrada?.segundos);

  const estudadasLista = aulasNoEstado(id, estudo, 'estudada');
  const estudadas = estudadasLista.length;
  const abertas = aulasNoEstado(id, estudo, 'aberta').length;
  // S18a: o "Já sei isso". Uma pulada é uma aula por onde a pessoa passou SEM
  // estudo verificado — ela tem de contar para o PERCORRIDO (a estação não pode
  // dizer "ainda não terminou" sobre uma aula que a pessoa recusou de propósito)
  // e não pode contar para o PREENCHIMENTO nem para a COR (não há nada medido
  // atrás). É a única linha deste módulo que lê o estado novo, e é de propósito:
  // quem colore e quem enche continuam contando `estudadas`, só.
  const puladas = aulasNoEstado(id, estudo, 'pulada').length;
  const feitas = estudadas + puladas;
  const feita = concluida(id, progresso);

  // A ordem é a do pedido, e o 'concluida-antes' vem primeiro de propósito: é o
  // carimbo de quem marcou no embarque ou importou do Atlas antigo, e não tem
  // medição nenhuma atrás. Uma estação concluída COM aulas estudadas sai do
  // carimbo e entra na medida — o que se fechou de verdade vale mais que o selo.
  let estagio;
  // `feitas >= total`: a estação é percorrida quando TODA aula dela está estudada
  // OU pulada. Uma estação toda pulada é 'percorrida' com preenchimento zero — o
  // pessoa declarou e o mapa mostra a declaração, sem fingir a medida. Quem
  // separa isso do carimbo é a linha de cima: `concluida-antes` vem primeiro e é
  // o carimbo SEM medição nenhuma atrás.
  if (feita && estudadas === 0) estagio = 'concluida-antes';
  else if (total > 0 && feitas >= total) estagio = 'percorrida';
  else if (estudadas > 0) estagio = 'em-percurso';
  // S18a: pulada também é toque. Sem este `||`, uma estação com 3 aulas puladas e
  // nada estudado sairia 'fora' — o mapa apagando uma declaração que a pessoa fez.
  else if (abertas > 0 || puladas > 0) estagio = 'embarcada';
  else estagio = 'fora';

  // O carimbo enche o mapa (a pessoa já fez aquilo, em algum lugar) mas não passa
  // a régua de 0/0: não há aula estudada para colorir.
  const preenchimento = estagio === 'concluida-antes' ? 1 : quociente(estudadas, total);

  const lembradas = aulasLembradas(id, estudo, cartoes).size;
  const cor = quociente(lembradas, estudadas);

  const media = recuperabilidadeMedia(id, cartoes, hoje);
  const pedeRevisao = media !== null && media < LIMITE_RECUPERABILIDADE;

  return {
    estagio,
    estudadas,
    total,
    preenchimento,
    lembradas,
    cor,
    pedeRevisao,
    segundosRestantes: Math.round(segundos * (1 - preenchimento)),
  };
}

/**
 * Os eixos da rede INTEIRA, num Map de id para o resultado acima (S16c).
 *
 * Por que existe: a tela não pode chamar `eixosDaEstacao` trinta e cinco vezes
 * dentro de um `map()` e ainda saber se tinha como desenhar — quem desenha o mapa
 * precisa de UMA resposta por estação e de uma resposta sobre o índice. Esta é a
 * conta por estação; a decisão sobre o índice fica uma vez só, aqui.
 *
 * Devolve um Map VAZIO quando o índice ainda não chegou ou quando ele não traz a
 * tabela por estação (`indice.estacoes`). Isso não é um meio-desenho: vazio é a
 * resposta honesta, porque sem `aulas` por estação não há total, e sem total não
 * há preenchimento. `core/mapa-rede.js` lê Map vazio como «sem eixos» e desenha
 * exatamente o mapa de antes, byte a byte — a trava da S16b continua valendo.
 */
export function eixosDaRede(catalogo, opcoes = {}) {
  const saida = new Map();
  const lista = Array.isArray(catalogo) ? catalogo : [];
  if (!opcoes.indice?.estacoes || typeof opcoes.indice.estacoes !== 'object') return saida;
  for (const c of lista) {
    if (!c || typeof c.id !== 'string') continue;
    if (!opcoes.indice.estacoes[c.id]) continue;
    saida.set(c.id, eixosDaEstacao(c.id, opcoes));
  }
  return saida;
}

/** Quantas estações há em cada estágio, e quantas pedem revisão. Para quem ROTULA o mapa. */
export function contarEstagios(lista, eixos) {
  const estagios = {};
  let pedindoRevisao = 0;
  for (const c of (Array.isArray(lista) ? lista : [])) {
    const e = typeof eixos?.get === 'function' ? eixos.get(c?.id) : eixos?.[c?.id];
    if (!e) continue;
    estagios[e.estagio] = (estagios[e.estagio] || 0) + 1;
    if (e.pedeRevisao) pedindoRevisao += 1;
  }
  return { estagios, pedindoRevisao };
}

/** Houve medição em alguma estação? É o que liga a legenda: sem medida, nada a decifrar. */
export function houveEstudo(eixos) {
  if (!eixos || typeof eixos.forEach !== 'function') return false;
  let viu = false;
  eixos.forEach((e) => { if (e && e.estudadas > 0) viu = true; });
  return viu;
}
