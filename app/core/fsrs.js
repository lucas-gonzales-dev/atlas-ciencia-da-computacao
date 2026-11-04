// Projeto Atlas — o FSRS-6 do cartão (S15a, 04/11/2026).
//
// POR QUE EXISTE: o desenho (design/v3/00-desenho.md, princípio 3 e J3) promete
// "o seu cartão volta amanhã". A promessa só é verdade se, amanhã, responder ao
// cartão mandar ele de volta no dia certo. Até aqui o cartão nascia com
// `fsrs: null` e `devidoEm` = amanhã fixo (S14a), e nada o reagendava: fechar a
// segunda revisão era abrir a primeira de novo. Este módulo é a conta que falta.
//
// AS FÓRMULAS VÊM DA WIKI OFICIAL DO FSRS (open-spaced-repetition/awesome-fsrs,
// "The Algorithm"), e a divisão do trabalho é a de lá:
//   · os 21 parâmetros W, a curva de esquecimento e o mesmo-dia  —  FSRS-6;
//   · a dificuldade (o media-mean-reversion de W[7])  —  FSRS-5;
//   · a estabilidade inicial, a de lembrar e a de esquecer  —  v4 / 4.5.
// W[15]..W[18] (a curto prazo do FSRS-6) e o "Difícil"/"Fácil" não são
// implementados de propósito: o Atlas tem DOIS botões, Lembrei e Errei, e
// parâmetro que não tem botão é parâmetro que ninguém calibra.
//
// PUREZA: zero DOM, zero storage, zero 'node:*', zero rede, zero Date no meio da
// conta. Roda no node (testes) e no navegador (a tela do cartão, S15b) com o
// mesmo arquivo. Quem conta dias e escreve data é o core/cartoes.js, que é onde
// mora a regra 13 da casa (data LOCAL); aqui entra `diasDesdeAUltima`, um número.
//
// A UNICA COISA QUE ESTE ARQUIVO NÃO DECIDE SOZINHA: os números da tabela de
// referência em tests/fsrs.test.js foram calculados por uma implementação de
// outra linguagem, à parte. Se este módulo divergir, a resposta não é ajustar a
// conta para bater — é dizer onde diverge, porque uma das duas leu a fórmula
// errado, e o teste existe para descobrir qual.

/**
 * Os 21 parâmetros padrão do FSRS-6 (W[0]..W[20]), como na wiki.
 *
 * `Object.freeze` porque um parâmetro mexido em silêncio muda o intervalo de
 * TODO cartão já agendado em TODO aparelho, sem nenhum erro visível: a pessoa
 * não vê o W, vê o cartão voltar cedo ou tarde demais. Quem quiser um W próprio
 * (o treinamento de parâmetros por pessoa é a S15c, não esta fatia) passa por
 * aqui e por um teste novo.
 */
export const W = Object.freeze([
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
  1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
  1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
]);

/** A retenção-alvo: o intervalo é a data em que a chance de lembrar cai a 90%. */
export const RETENCAO = 0.9;

/** O `decay` do FSRS-6 é -W[20]. Não é constante 0,5 desde o v4: é o próprio W[20]. */
export const DECAY = -W[20];

/**
 * O `factor` da curva: 0,9^(1/DECAY) - 1 = 0,9803464944134797.
 *
 * Da fórmula generalizada de poder (R = (1 + factor·t/S)^decay) com R = RETENCAO
 * em t = S. Como RETENCAO é 0,9 e a curva é calibrada em 0,9, o `intervalo` sai
 * ~igual à estabilidade em dias — é a razão pela qual a tabela de referência
 * confere os dois, S e I, e não só um deles.
 */
export const FATOR = Math.pow(RETENCAO, 1 / DECAY) - 1;

/** Os dois graus que o Atlas tem: o botão e o número que o FSRS espera. */
export const GRAU = Object.freeze({ ERREI: 1, LEMBREI: 3 });

/** A nota do cartão (a palavra da tela) para o grau do FSRS (o número da fórmula). */
export const NOTA_PARA_GRAU = Object.freeze({ errei: GRAU.ERREI, lembrei: GRAU.LEMBREI });

/** O intervalo de um cartão novo não pode ser zero: "rever agora" não é espaçamento. */
const DIA_MINIMO = 1;

const presa = (v, minimo, maximo) => Math.min(Math.max(v, minimo), maximo);

/**
 * Número de verdade, ou NaN.
 *
 * `Number(null)` é 0, e 0 é uma resposta: "revisar no MESMO dia". Deixar um
 * campo vazio atravessar até aqui seria agendar um cartão como se ele tivesse
 * sido visto agora, quando a verdade é que ninguém sabe quando — o mesmo truque
 * que já derruba `n` em core/cartoes.js, pelo mesmo motivo. Só `number` e
 * `string` não-vazia viram número; o resto é NaN, que os chamadores recusam.
 */
function numeroDe(bruto) {
  if (typeof bruto === 'number') return bruto;
  if (typeof bruto === 'string' && bruto.trim() !== '') return Number(bruto);
  return NaN;
}

/**
 * A curva de esquecimento: a chance de lembrar de uma memória de força `S` depois
 * de `t` dias. R(0) = 1 e R(S) = RETENCAO, por construção.
 *
 * @param {number} t dias desde a última revisão (0 é permitido: acabou de ver)
 * @param {number} s estabilidade, em dias
 * @returns {number} retenção em [0,1]
 */
export function retencao(t, s) {
  const dias = Number(t);
  const S = Number(s);
  if (!Number.isFinite(dias) || !Number.isFinite(S) || S <= 0) return 0;
  return Math.pow(1 + FATOR * Math.max(dias, 0) / S, DECAY);
}

/**
 * A dificuldade de um cartão NOVO, pelo primeiro grau dado.
 * W[4] - e^(W[5]·(G-1)) + 1, presa em [1,10].
 *
 * O expoente cresce com a nota, então quanto mais fácil a pessoa achou, mais
 * BAIXA a dificuldade: G=1 dá W[4] = 6,4133 e G=3 dá 2,118103970459015. G=4 e G=5
 * dão negativo pela fórmula crua e sobem ao piso 1 — é por isso que a trava de
 * [1,10] mora AQUI e não só no `proximaDificuldade`: o FSRS usa este mesmo valor
 * como âncora do reversionamento à média, e uma âncora fora de [1,10] envenena
 * todas as revisões seguintes.
 */
export function dificuldadeInicial(G) {
  const g = Number(G);
  if (!Number.isFinite(g) || g < 1 || g > 5) return 0;
  return presa(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
}

/** A estabilidade de um cartão novo é o parâmetro do grau: W[G-1]. */
export function estabilidadeInicial(G) {
  const g = Number(G);
  if (!Number.isFinite(g) || g < 1 || g > 5) return 0;
  return W[g - 1];
}

/**
 * A dificuldade depois de uma resposta: a do FSRS-5, com o reversionamento à
 * média de W[7] sobre a dificuldade inicial do grau 4.
 *
 *   ΔD = -W[6]·(G-3)
 *   D' = D + ΔD·(10-D)/9        (o passo é proporcional ao que falta até o topo)
 *   D" = W[7]·D₀(4) + (1-W[7])·D'
 *
 * O `(10-D)/9` é o que faz um cartão já difícil (D=9) quase não subir de
 * dificuldade com um erro, enquanto um fácil (D=2) sobe muito: errar em algo que
 * já era difícil não é notícia. Com W[7] = 0,001 o puxão para a média é mínimo,
 * mas existe — e é ele que segura um D=10 encostado no teto para sempre.
 */
export function proximaDificuldade(D, G) {
  const d = Number(D);
  const g = Number(G);
  if (!Number.isFinite(d) || !Number.isFinite(g)) return 0;
  const delta = -W[6] * (g - 3);
  const dPrima = d + (delta * (10 - d)) / 9;
  const dMedia = W[7] * dificuldadeInicial(4) + (1 - W[7]) * dPrima;
  return presa(dMedia, 1, 10);
}

/**
 * A nova estabilidade quando a pessoa LEMBRA.
 *
 *   S·(e^W[8]·(11-D)·S^(-W[9])·(e^(W[10]·(1-R)) - 1) + 1)
 *
 * Multiplica S, então lembrar sempre cresce a memória, e o `+1` é o que garante
 * isso mesmo com o resto zerado. Os três termos dentro do parêntese são as três
 * coisas que o intervalo de verdade respeita: cartão difícil cresce menos
 * ((11-D)), cartão forte cresce menos (S^(-W[9]) — o mesmo esforço rende menos a
 * cada semana, o ganho é relativo) e deixar a memória quase cair (R baixo)
 * fortalece mais (e^(W[10]·(1-R)) — revisar no fio da balança é o que ensina).
 */
export function estabilidadeLembrou(D, S, R) {
  const d = Number(D);
  const s = Number(S);
  const r = Number(R);
  if (!Number.isFinite(d) || !Number.isFinite(s) || !Number.isFinite(r) || s <= 0) return 0;
  const fator = Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1);
  return s * (fator + 1);
}

/**
 * A nova estabilidade quando a pessoa ESQUECE.
 *
 *   min(W[11]·D^(-W[12])·((S+1)^W[13] - 1)·e^(W[14]·(1-R)), S)
 *
 * O `min(..., S)` é a regra que impede o pior resultado possível deste algoritmo:
 * um erro que AUMENTA o intervalo. Sem ele, um cartão muito forte e quase esquecido
 * (R baixo, S alto) daria um `estabilidadeEsqueceu` maior que o S atual, e o app
 * mandaria rever ainda mais tarde um cartão que a pessoa acabou de errar — que é o
 * exatamente-oposto do que um erro deveria dizer.
 */
export function estabilidadeEsqueceu(D, S, R) {
  const d = Number(D);
  const s = Number(S);
  const r = Number(R);
  if (!Number.isFinite(d) || !Number.isFinite(s) || !Number.isFinite(r) || s <= 0) return 0;
  const nova =
    W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r));
  return Math.min(nova, s);
}

/**
 * O intervalo em DIAS que a estabilidade `S` entrega para a retenção-alvo, no
 * mínimo 1. É o número que vira o `devidoEm` do cartão.
 *
 * O arredondamento é o último passo, depois da trava de mínimo: um cartão com
 * S = 0,212 (o erro inicial) tem intervalo 1, não 0, senão ele voltaria no mesmo
 * dia indefinidamente e a fila nunca esvazia.
 */
export function intervaloEmDias(S) {
  const s = Number(S);
  if (!Number.isFinite(s) || s <= 0) return DIA_MINIMO;
  const bruto = (s / FATOR) * (Math.pow(RETENCAO, 1 / DECAY) - 1);
  return Math.max(DIA_MINIMO, Math.round(bruto));
}

/**
 * A revisão de um cartão: o estado de antes + a resposta + os dias esperados, o
 * estado de depois.
 *
 * `estado | null` é o cartão NUNCA revisado: o FSRS o inicializa pelas fórmulas
 * iniciais, e não por uma média. Este é o ramo que faz a frase "volta amanhã"
 * valer no primeiro dia: um cartão novo respondido "Lembrei" nasce com S = W[2] =
 * 2,3065 e volta em 2 dias, e respondido "Errei" nasce com S = W[0] = 0,212 e
 * volta amanhã.
 *
 * Dois botões, dois graus: G = 3 (Lembrei) usa `estabilidadeLembrou`, G = 1
 * (Errei) usa `estabilidadeEsqueceu`. Qualquer outro grau é recusado com null:
 * a tela do Atlas não tem "Difícil" nem "Fácil", e aceitar 2 ou 4 aqui seria
 * agendar com uma fórmula que ninguém no app pode acionar.
 *
 * @param {{estabilidade: number, dificuldade: number}|null} estado o antes
 * @param {number} G 1 (Errei) ou 3 (Lembrei)
 * @param {number} diasDesdeAUltima dias no calendário local desde a última revisão
 * @returns {{estabilidade: number, dificuldade: number, intervalo: number}|{erro: string}}
 */
export function revisarFsrs(estado, G, diasDesdeAUltima) {
  const g = numeroDe(G);
  if (g !== GRAU.ERREI && g !== GRAU.LEMBREI) {
    return { erro: 'O FSRS do Atlas só conhece dois graus: 1 (Errei) e 3 (Lembrei).' };
  }
  const t = numeroDe(diasDesdeAUltima);
  if (!Number.isFinite(t) || t < 0) {
    return { erro: 'Os dias desde a última revisão precisam ser um número de dias, sem ser no futuro.' };
  }

  const novo = !estado || typeof estado !== 'object' ||
    !Number.isFinite(Number(estado.estabilidade)) || Number(estado.estabilidade) <= 0 ||
    !Number.isFinite(Number(estado.dificuldade));

  let s;
  let d;
  if (novo) {
    s = estabilidadeInicial(g);
    d = dificuldadeInicial(g);
  } else {
    const sAnterior = Number(estado.estabilidade);
    const dAnterior = Number(estado.dificuldade);
    const r = retencao(t, sAnterior);
    s = g === GRAU.LEMBREI ? estabilidadeLembrou(dAnterior, sAnterior, r) : estabilidadeEsqueceu(dAnterior, sAnterior, r);
    d = proximaDificuldade(dAnterior, g);
  }

  return { estabilidade: s, dificuldade: d, intervalo: intervaloEmDias(s) };
}
