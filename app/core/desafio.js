// Projeto Atlas — o DESAFIO da estação (S18b-1, 05/11/2026): o núcleo, sem tela.
//
// Por que existe: o desenho (design/v3/00-desenho.md, J4) diz que uma estação só
// vira «dominada» com o desafio aprovado, e o desafio é 10 a 15 cartões sorteados
// DAS AULAS DA ESTAÇÃO — os da própria pessoa — mais as perguntas das aulas de
// exercício. Este arquivo responde às duas perguntas que a tela não pode responder
// sozinha: QUEM PODE fazer o desafio (e por que ainda não) e QUAIS cartões entram
// no sorteio. A tela, o feedback e o «dominada» vêm na fatia seguinte.
//
// A regra 7 do desenho vale inteira aqui: NADA é inventado. As aulas de exercício
// são vídeo — não há texto de pergunta nos dados — então o desafio usa só os
// cartões que a pessoa escreveu no fechamento delas. É por isso que `podeDesafiar`
// exige cartão de exercício: sem cartão escrito não há o que sortear, e um desafio
// com pergunta fabricada seria o Atlas mentir sobre a origem do que cobra.
//
// O sorteio NÃO usa Math.random: vem de uma semente, com PRNG próprio. Motivo —
// (1) um sorteio que muda a cada render é a tela trocando os cartões debaixo dos
// olhos de quem responde; (2) sem semente não há como testar «um de cada aula de
// exercício» nem reproduzir um sorteio que a pessoa relatar. A mesma semente dá o
// mesmo sorteio em qualquer máquina, hoje ou mês que vem.
//
// Regra da casa: roda no node E no navegador, sem build. Zero DOM, zero
// localStorage, zero 'node:*', zero rede, zero Math.random. Nada muta a entrada.
//
// Datas LOCAIS (regra de core/cartoes.js): toda idade de cartão passa por
// `diasEntre`, que lê `aaaa-mm-dd` e `aaaa-mm-ddThh:mm` pelos getters locais. Um
// `Date.parse` aqui adiantaria um dia para quem fecha uma aula às 23h30.

import { diasEntre } from './cartoes.js';
import { estadoDaAula } from './estudo.js';
import { ESTAGIOS_DO_EIXO } from './eixos.js';
import { desafio as T } from './textos.js';
import { lerProgresso } from './viagem.js';

/** Cartões com menos disto ainda são recordação a quente: não entram no desafio. */
export const IDADE_MINIMA_DIAS = 2;

/** O piso e o teto do sorteio (desenho J4: «10 a 15 cartões»). */
export const MINIMO_CARTOES = 10;
export const MAXIMO_CARTOES = 15;

/** Do degrau para cima, a estação está percorrida e o desafio pode ser oferecido. */
const DESDE_PERCORRIDA = ESTAGIOS_DO_EIXO.indexOf('percorrida');

const face = (v) => String(v ?? '').trim();
const mapaDe = (cartoes) => cartoes?.cartoes ?? cartoes ?? {};
const listaDe = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/** A idade do cartão em dias locais; NaN quando a data não é uma data. */
const idadeDo = (cartao, hoje) => diasEntre(cartao.criadoEm, hoje);

/**
 * O cartão é «da estação»?
 *
 * Com o id, é a pergunta direta. Sem o id — e `eixosDaEstacao` devolve o eixo sem
 * ele — a estação se deduz pelas AULAS da lista, que é a definição verdadeira do
 * desafio: «os cartões destas aulas». Cai num `?? []` silencioso aqui, a estação
 * pronta responderia «escreva mais 10» na cara de quem tem 40 cartões escritos.
 */
function pertence(cartao, idEstacao, chavesDasAulas) {
  return idEstacao
    ? face(cartao.estacao) === idEstacao
    : chavesDasAulas.has(face(cartao.aula));
}

/**
 * A seleção por idade e pertinência, na ordem CANONICA: do mais novo ao mais
 * velho, empate pelo id. A ordem é fixa de propósito — o sorteio é derivado
 * desta lista, e uma lista que mudasse de ordem entre duas chamadas mudaria o
 * sorteio sem mudar a semente.
 */
function selecionar(cartoes, { idEstacao = '', aulas = [], hoje }, aceita) {
  const dia = face(hoje);
  if (!dia) return [];
  if (!idEstacao && !listaDe(aulas).length) return [];
  const chaves = new Set(listaDe(aulas).map((a) => face(a.id)).filter(Boolean));
  return Object.values(mapaDe(cartoes))
    .filter((c) => c && pertence(c, idEstacao, chaves))
    .filter((c) => {
      const idade = idadeDo(c, dia);
      return Number.isFinite(idade) && aceita(idade);
    })
    .sort((a, b) => (
      String(b.criadoEm).localeCompare(String(a.criadoEm))
      || String(a.id).localeCompare(String(b.id))
    ));
}

/**
 * Os cartões da estação que já têm idade para o desafio.
 *
 * Recordação a quente não conta: um cartão escrito ontem e um escrito há três
 * semanas medem coisas diferentes. O de ontem é a resposta que ainda está na
 * cabeça; o de três semanas é memória. O desafio cobra a segunda, então a régua é
 * `criadoEm` (quando a pessoa escreveu), nunca `devidoEm`.
 *
 * @param {object|{cartoes: object}} cartoes o arquivo da pessoa
 * @param {string} estacao o id da estação
 * @param {string} hoje `aaaa-mm-dd`
 * @returns {object[]} os cartões elegíveis
 */
export function cartoesElegiveis(cartoes, estacao, hoje) {
  const chave = face(estacao);
  if (!chave) return [];
  return selecionar(cartoes, { idEstacao: chave, hoje }, (idade) => idade >= IDADE_MINIMA_DIAS);
}

/** As aulas de exercício da estação, na ordem da lista (o `n` é o que a frase cita). */
function aulasDeExercicio(aulasDaEstacao) {
  return listaDe(aulasDaEstacao).filter((a) => a.exercicio);
}

/**
 * A PRNG do sorteio: xorshift32 plantado pela semente.
 *
 * Não é criptografia nem precisava: é um baralhamento que precisa de duas coisas
 * só — determinismo e nenhuma mãozinha do relógio. O mesmo texto de semente dá a
 * mesma sequência em qualquer máquina. Uma semente vazia é uma semente como
 * qualquer outra: o sorteio dela é fixo, não aleatório.
 */
function prng(semente) {
  let h = 2166136261;
  for (const ch of face(semente)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  let estado = h >>> 0 || 1;
  return () => {
    estado ^= estado << 13;
    estado >>>= 0;
    estado ^= estado >> 17;
    estado ^= estado << 5;
    estado >>>= 0;
    return estado / 4294967296;
  };
}

/**
 * Pode fazer o desafio? Devolve `{ pode, porque }`.
 *
 * As quatro condições, na ordem em que a pessoa as encontra — e a frase é sempre
 * a da PRIMEIRA que falta, porque «faça as duas coisas» não diz por onde começar:
 *
 *   1. a estação está percorrida (o eixo de core/eixos.js);
 *   2. toda aula de exercício foi ESTUDADA — pulada não conta, porque o
 *      princípio 1 do desenho diz que progresso é verificado, e «já sei isso»
 *      numa aula de exercício deixa justamente a única coisa que o desafio cobra
 *      sem cartão atrás;
 *   3. toda aula de exercício tem ao menos um cartão elegível (sem cartão escrito
 *      não há o que sortear — regra 7);
 *   4. há ao menos MINIMO_CARTOES elegíveis na estação.
 *
 * A estação DOMINADA também pode (S18b-2, item 3 do pedido): `dominada` vem depois
 * de `percorrida` na escada de `ESTAGIOS_DO_EIXO`, então o `indexOf` abaixo já a
 * aceita — e isso é de propósito, porque refazer o desafio é a única forma de
 * perder o carimbo (um reprovado DEPOIS de dominada devolve a estação para
 * percorrida; o tempo nunca rebaixa). Não há um `|| estagio === 'dominada'` aqui:
 * duas regras para a mesma pergunta é o lugar onde elas divergem.
 *
 * Estações sem aula de exercício (20 das 36) passam as condições 2 e 3 sozinhas:
 * não há exercício faltando nem cartão por escrever. É o vazio verdadeiro, não um
 * `|| true` — a lista vem da fonte.
 *
 * Na condição 4 o número depende do que existe: se os cartões que faltam já foram
 * escritos e só ainda não entraram, a frase avisa a espera («faltam 3», e eles
 * vêm); se mesmo assim não chegariam, a frase pede que escreva. O número é sempre
 * de CARTÕES, nunca de dias — a espera máxima é de dois dias, e «faltam 4 dias»
 * não teria o que mostrar.
 *
 * @param {{estagio?: string, id?: string}} eixo o eixo da estação (core/eixos.js)
 * @param {object} estudo o arquivo de estudo (core/estudo.js)
 * @param {object|{cartoes: object}} cartoes o arquivo de cartões
 * @param {object[]} aulasDaEstacao as aulas da estação, com `exercicio`
 * @param {string} hoje `aaaa-mm-dd`
 * @returns {{pode: boolean, porque: string|null}}
 */
export function podeDesafiar(eixo, estudo, cartoes, aulasDaEstacao, hoje) {
  const estagio = face(eixo?.estagio);
  if (!estagio || ESTAGIOS_DO_EIXO.indexOf(estagio) < DESDE_PERCORRIDA) {
    return { pode: false, porque: T.naoPercorrida(estagio || 'fora') };
  }

  const onde = { idEstacao: face(eixo?.id), aulas: listaDe(aulasDaEstacao), hoje };
  const aulas = aulasDeExercicio(aulasDaEstacao);
  const elegiveis = selecionar(cartoes, onde, (idade) => idade >= IDADE_MINIMA_DIAS);

  const naoEstudadas = aulas.filter((a) => estadoDaAula(estudo, a.id) !== 'estudada');
  if (naoEstudadas.length) {
    return { pode: false, porque: T.faltamExercicios(naoEstudadas.map((a) => a.n)) };
  }

  const semCartao = aulas.filter((a) => !elegiveis.some((c) => c.aula === a.id));
  if (semCartao.length) {
    return { pode: false, porque: T.faltamCartoesDeExercicio(semCartao.map((a) => a.n)) };
  }

  if (elegiveis.length < MINIMO_CARTOES) {
    const deficit = MINIMO_CARTOES - elegiveis.length;
    const amadurecendo = selecionar(
      cartoes, onde, (idade) => idade >= 0 && idade < IDADE_MINIMA_DIAS,
    ).length;
    if (amadurecendo >= deficit) return { pode: false, porque: T.maturando(deficit) };
    return { pode: false, porque: T.escrevaMais(deficit - amadurecendo) };
  }

  return { pode: true, porque: null };
}

/**
 * O sorteio. Devolve `{ semente, cartoes: [ids] }` com 10 a 15 cartões.
 *
 * A ordem do sorteio é a do desenho: primeiro UM de cada aula de exercício — é o
 * que faz o desafio cobrar o que a pessoa só viu em vídeo —, depois completa com
 * os demais até o teto. Duas estações têm 22 aulas de exercício: nelas o teto de
 * 15 vence e as últimas aulas da lista ficam de fora (a lista é a da fonte, então
 * a ordem é a da playlist, não um capricho daqui).
 *
 * Entram só cartões ELEGÍVEIS da estação, e a resposta é sempre uma lista de ids
 * — nunca títulos, nunca texto de aula. Quem desenha o desafio lê o id, acha o
 * cartão da pessoa e mostra a frente QUE ELA escreveu. Um id que não existe no
 * arquivo dela seria o Atlas perguntando algo que ninguém escreveu.
 *
 * Poucos cartões não é erro, é «ainda não»: devolve lista vazia, e a tela usa
 * `podeDesafiar` para dizer o porquê. Nunca completa sorteando o que não existe.
 *
 * @param {object|{cartoes: object}} cartoes o arquivo da pessoa
 * @param {string} estacao o id da estação
 * @param {object[]} aulasDaEstacao as aulas da estação, com `exercicio`
 * @param {string} hoje `aaaa-mm-dd`
 * @param {string} semente o texto que planta o sorteio
 * @returns {{semente: string, cartoes: string[]}}
 */
export function montarDesafio(cartoes, estacao, aulasDaEstacao, hoje, semente) {
  const sorteio = { semente: face(semente), cartoes: [] };
  const pool = cartoesElegiveis(cartoes, estacao, hoje);
  if (pool.length < MINIMO_CARTOES) return sorteio;

  const aleatorio = prng(sorteio.semente);
  const escolhidos = new Set();
  const ids = [];
  const empurrar = (c) => {
    if (!c || escolhidos.has(c.id)) return false;
    escolhidos.add(c.id);
    ids.push(c.id);
    return true;
  };

  // 1. Um de cada aula de exercício, na ordem da lista, sortudo entre os dela.
  for (const aula of aulasDeExercicio(aulasDaEstacao)) {
    if (ids.length >= MAXIMO_CARTOES) break;
    const daAula = pool.filter((c) => c.aula === aula.id);
    if (!daAula.length) continue;
    empurrar(daAula[Math.floor(aleatorio() * daAula.length)]);
  }

  // 2. Completa com os demais, sorteados (Fisher-Yates sobre uma cópia), até o teto.
  const resto = pool.slice();
  for (let i = resto.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [resto[i], resto[j]] = [resto[j], resto[i]];
  }
  for (const c of resto) {
    if (ids.length >= MAXIMO_CARTOES) break;
    empurrar(c);
  }

  sorteio.cartoes = ids;
  return sorteio;
}

// ═══════════ S18b-2 (05/11/2026): corrigir, a dominada e a frase do que foi medido ═══════════
//
// A fatia anterior (S18b-1) respondia «quem pode» e «o que entra no sorteio».
// Esta fecha a volta: dado o sorteio e o que a pessoa conferiu, quanto foi
// lembrado, o que acontece com a estação e com os cartões, e o que a tela diz.
// A tela (S18c) desenha; quem decide fica aqui, porque a régua do 0,8 e o
// rebaixamento só pelo reprovado são regra de produto, não de layout.

/** O corte de aprovação do desenho J4: 80% dos cartões do sorteio. */
export const CORTE_APROVACAO = 0.8;

/** `aaaa-mm-dd` — a mesma régua de core/cartoes.js, e ela só vale local. */
const HE_DIA = /^\d{4}-\d{2}-\d{2}$/;

const diaDe = (v) => {
  const s = face(v).slice(0, 10);
  return HE_DIA.test(s) ? s : '';
};

/**
 * A contagem de uma resposta da pessoa.
 *
 * Ela é autoconferência — a pessoa lê a frente, tenta, vira o verso e diz se
 * lembrou — então o que chega é tão sóbrio quanto os dois botões da revisão:
 * `true` / `'lembrei'` contam como lembrado, `false` / `'errei'` como errado, e
 * o resto não foi respondido. Tratar uma string vazia como "errei" faria o
 * desafio punir quem fechou a tela no meio sem responder nada.
 */
const respostaDe = (bruto) => {
  if (bruto === true || bruto === 'lembrei' || bruto === 'acertou') return true;
  if (bruto === false || bruto === 'errei' || bruto === 'errou') return false;
  if (bruto && typeof bruto === 'object') return respostaDe(bruto.acertou ?? bruto.nota);
  return null;
};

/**
 * A correção do desafio. Devolve `{ acertos, total, aprovado, lembrados, errados }`.
 *
 * O denominador é o SORTEIO, nunca o arquivo inteiro: "lembrou 12 de 14" são os
 * 14 que saíram no sorteio, e um cartão que a pessoa tem mas não foi sorteado não
 * entra na conta nem no carimbo.
 *
 * Quem responde fora do sorteio é IGNORADO, e isso é a defesa do número: um id
 * que não foi sorteado não pode inflar `acertos`, e um desafio vazio não pode ser
 * aprovado por vacuidade — 0 de 0 não é 100%, é "não houve medida".
 *
 * @param {{cartoes?: string[]}} desafio o resultado de `montarDesafio`
 * @param {object|Array} respostas id → true|false (ou lista de {id, acertou})
 * @returns {{acertos: number, total: number, aprovado: boolean, lembrados: string[], errados: string[]}}
 */
export function corrigirDesafio(desafio, respostas) {
  const ids = [...new Set(listaDe(desafio?.cartoes).map(face).filter(Boolean))];
  const dadas = {};
  if (Array.isArray(respostas)) {
    for (const r of respostas) {
      const id = face(r?.id ?? r?.cartao);
      if (id) dadas[id] = respostaDe(r);
    }
  } else if (respostas && typeof respostas === 'object') {
    for (const [id, v] of Object.entries(respostas)) dadas[face(id)] = respostaDe(v);
  }

  const lembrados = [];
  const errados = [];
  for (const id of ids) (dadas[id] === true ? lembrados : errados).push(id);

  const total = ids.length;
  const acertos = lembrados.length;
  return {
    acertos,
    total,
    // A régua do desenho: `acertos / total >= 0,8`. Com 14 no sorteio, 12 aprueba
    // (0,857), 11 não (0,785) — o corte é comparado antes de arredondar qualquer
    // porcentagem, porque arredondar 11/14 para 79% e depois para 80% é como o
    // carimbo nasceria de uma conta de cabeça.
    aprovado: total > 0 && acertos / total >= CORTE_APROVACAO,
    lembrados,
    errados,
  };
}

/** Uma contagem vinda do `resumo`: número, array, ou o total de um objeto. */
const contagemDe = (v) => {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return contagemDe(v.total ?? v.aulas ?? v.quantidade);
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

/**
 * Aplica o resultado do desafio: o carimbo, a fila e o rebaixamento.
 *
 * Aprovado — a estação vira **dominada**, e o dado é
 * `progresso.dominadas[estacao] = { em, acertos, total, lembrados, aulas, cartoes }`.
 * É este objeto que a S17 lê para desenhar o carimbo, e a frase dele sai só dos
 * números guardados aqui: `aulas` e `cartoes` vêm do `resumo` (quantas aulas tem
 * a estação e quantos cartões a pessoa escreveu nela) e `lembrados`/`total` são o
 * sorteio conferido. Um re-aprovado substitui o carimbo pelo mais recente — a
 * pessoa pode refazer, e a última vez que ela passou é a vez que vale.
 *
 * Reprovado — os cartões errados ganham `devidoEm = hoje`, e nada mais. Eles
 * voltam à fila do dia porque é isso que "tente de novo quando quiser" quer dizer
 * na prática: o cartão que caiu está na frente de amanhã, e a pessoa não perde o
 * que já escreveu. A frase diz quantos eram.
 *
 * O TEMPO NUNCA REBAIXA, e só um reprovado DEPOIS de dominada devolve a estação
 * para percorrida: aqui isso é `delete dominadas[estacao]`, porque 'percorrida' é
 * o que a estação é SEM o carimbo — quem calcula o estágio é core/eixos.js, e não
 * existe um campo 'percorrida' para escrever. Reprovado em estação nunca dominada
 * não toca no progresso: ela já está onde o reprovado a deixaria.
 *
 * Nada aqui recalcula o FSRS dos cartões. O desafio é autoconferência, não uma
 * sessão de revisão: quem move a data e a estabilidade de um cartão é
 * `revisarCartao`, e um desafio aprovado que também reescrevesse `fsrs` daria dois
 * donos para o mesmo agendamento — o pior tipo de contradição num arquivo.
 *
 * @param {object} progresso o progresso v3 (core/viagem.js)
 * @param {object|{cartoes: object}} cartoes o arquivo de cartões
 * @param {string} estacao o id da estação
 * @param {{aprovado: boolean, acertos?: number, total?: number, lembrados?: string[], errados?: string[]}} resultado
 * @param {{aulas?: number|object[], cartoes?: number|object[]}} resumo as duas contagens
 * @param {string} quando `aaaa-mm-dd` ou `aaaa-mm-ddThh:mm` local
 * @returns {{progresso: object, cartoes: object, dominada: object|null, recado: string}}
 */
export function aplicarResultado(progresso, cartoes, estacao, resultado, resumo, quando) {
  const id = face(estacao);
  const p = lerProgresso(progresso);
  const r = resultado && typeof resultado === 'object' ? resultado : {};
  const dia = diaDe(quando);

  if (!id) {
    return { progresso: p, cartoes, dominada: p.dominadas[id] ?? null, recado: '' };
  }

  if (r.aprovado) {
    const dominada = {
      em: dia || null,
      acertos: contagemDe(r.acertos),
      total: contagemDe(r.total),
      lembrados: [...new Set(listaDe(r.lembrados).map(face).filter(Boolean))],
      aulas: contagemDe(resumo?.aulas),
      cartoes: contagemDe(resumo?.cartoes),
    };
    // Sem data não há carimbo — um `em` inventado seria o app declarando um dia
    // em que a pessoa não disse nada. Sem `quando`, o que se devolve é o
    // progresso intacto e o recado vazio, e a tela não carimba nada.
    if (!dominada.em) return { progresso: p, cartoes, dominada: null, recado: '' };
    return {
      progresso: { ...p, dominadas: { ...p.dominadas, [id]: dominada } },
      cartoes,
      dominada,
      recado: fraseDaDominada(dominada),
    };
  }

  // ── reprovado ──
  const errados = [...new Set(listaDe(r.errados).map(face).filter(Boolean))];
  const atuais = mapaDe(cartoes);
  const novo = { ...atuais };
  let movidos = 0;
  // A data é o que faz "voltam para a fila de hoje" ser verdade; sem um `hoje`
  // lido, nenhum `devidoEm` é escrito — mover a fila para uma data chutada é
  // pior que não mover.
  if (dia) {
    for (const cartaoId of errados) {
      const c = novo[cartaoId];
      if (!c || typeof c !== 'object') continue;
      novo[cartaoId] = { ...c, devidoEm: dia };
      movidos += 1;
    }
  }
  // O envelope: quem passou `{versao, cartoes}` recebe `{versao, cartoes}`, quem
  // passou o mapa cru recebe o mapa cru. Trocar a forma na volta é o jeito mais
  // silencioso de destruir um arquivo.
  const devolve = cartoes && Object.prototype.hasOwnProperty.call(cartoes, 'cartoes')
    ? { ...cartoes, cartoes: novo }
    : novo;

  const eraDominada = !!(p.dominadas && p.dominadas[id]);
  const dominadas = { ...p.dominadas };
  if (eraDominada) delete dominadas[id];

  return {
    progresso: { ...p, dominadas },
    cartoes: devolve,
    dominada: null,
    // O número da frase é o que VOLTOU para a fila, e não o que a pessoa errou:
    // sem data válida nada se move, e dizer "4 voltaram para hoje" quando nenhum
    // `devidoEm` mudou seria a tela mentindo sobre o arquivo dela.
    recado: movidos ? T.reprovado(movidos) : '',
  };
}

/**
 * A frase do carimbo — o que a estação dominada AFIRMA, e só isso.
 *
 * Ela substitui a "frase de competência" do desenho (S17): em vez de
 * «Você converte entre bases e projeta circuitos combinacionais simples», que
 * ninguém mediu, ela repete os números medidos no dia. A última cláusula é o
 * piso da honestidade: o desafio sorteou cartões que a pessoa já escreveu, e não
 * apresentou exercício novo — a frase não pode sugerir o contrário.
 *
 * @param {object} dominada o registro de `progresso.dominadas[estacao]`
 * @returns {string}
 */
export function fraseDaDominada(dominada) {
  return T.dominada(dominada && typeof dominada === 'object' ? dominada : {});
}
