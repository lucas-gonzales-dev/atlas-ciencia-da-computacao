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
