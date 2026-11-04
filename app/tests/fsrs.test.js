// Projeto Atlas — o FSRS-6 (S15a, 04/11/2026): a tabela de referência.
//
// Por que este arquivo é uma tabela e não um punhado de casos soltos: o FSRS é
// uma cadeia de expoentes, e um parâmetro lido errado NÃO gera um número
// absurdamente diferente — gera o número ligeiramente errado, que agenda o
// cartão dois dias mais tarde, para sempre, em todos os aparelhos. Ninguém vê
// isso na tela. A única forma de cobrar é uma seqüência longa, em que o erro do
// passo 1 se propaga e se amplifica nos quatro passos seguintes: se um W estiver
// trocado, a linha 2 já diverge.
//
// A REFERÊNCIA NÃO É MINHA. As mesmas fórmulas foram implementadas à parte, em
// Python, e os valores abaixo vêm de lá. Tolerância: 1e-6 em S e D, intervalo
// EXATO (é um dia de calendário; "arredondado por 1e-6" não existe em data).
// Se a minha implementação em JS divergir, a resposta NÃO é ajustar o JS para
// bater — é dizer onde diverge: uma das duas leu a fórmula errado, e o teste
// existe para descobrir qual.
//
// L = Lembrei (G=3), E = Errei (G=1). `t` é o número de dias desde a revisão
// ANTERIOR — o que o core/cartoes.js conta no calendário local e entrega aqui.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, RETENCAO, DECAY, FATOR, GRAU, NOTA_PARA_GRAU,
  retencao, dificuldadeInicial, estabilidadeInicial, proximaDificuldade,
  estabilidadeLembrou, estabilidadeEsqueceu, intervaloEmDias, revisarFsrs
} from '../core/fsrs.js';

/** A comparadora da casa para os reais: 1e-6 é o que a referência admite. */
const bate = (obtido, esperado, rotulo) => {
  assert.ok(
    Number.isFinite(obtido) && Math.abs(obtido - esperado) <= 1e-6,
    `${rotulo}: obtido ${obtido}, referência ${esperado} (tolerância 1e-6)`
  );
};

/**
 * Caminha uma seqüência de respostas pela implementação, do mesmo jeito que a
 * referência Python caminha: o estado de depois é o estado de antes do próximo.
 * Cada linha da tabela passa por aqui, inclusive a primeira (estado null).
 */
function caminho(passos) {
  let estado = null;
  const linhas = [];
  for (const [letra, t] of passos) {
    const G = letra === 'L' ? GRAU.LEMBREI : GRAU.ERREI;
    const r = revisarFsrs(estado, G, t);
    estado = { estabilidade: r.estabilidade, dificuldade: r.dificuldade };
    linhas.push({ letra, t, ...r });
  }
  return linhas;
}

const confere = (linhas, tabela) => {
  assert.equal(linhas.length, tabela.length, 'a seqüência tem outro tamanho');
  tabela.forEach((esperada, i) => {
    const obtida = linhas[i];
    assert.equal(obtida.letra, esperada[0], `passo ${i + 1}: outra nota`);
    assert.equal(obtida.t, esperada[1], `passo ${i + 1}: outros dias`);
    bate(obtida.estabilidade, esperada[2], `passo ${i + 1} (${esperada[0]} t=${esperada[1]}) estabilidade`);
    bate(obtida.dificuldade, esperada[3], `passo ${i + 1} (${esperada[0]} t=${esperada[1]}) dificuldade`);
    assert.equal(obtida.intervalo, esperada[4], `passo ${i + 1} (${esperada[0]} t=${esperada[1]}) intervalo`);
  });
};

// ── 1. os parâmetros e as constantes ───────────────────────────────────────
test('fsrs: os 21 parâmetros padrão do FSRS-6, na ordem', () => {
  assert.deepEqual([...W], [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
    0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
    0.0912, 0.0658, 0.1542,
  ]);
});

test('fsrs: W é congelado — um parâmetro mexido em silêncio muda todos os intervalos', () => {
  assert.ok(Object.isFrozen(W));
});

test('fsrs: a retenção-alvo, o decay e o factor', () => {
  assert.equal(RETENCAO, 0.9);
  bate(DECAY, -0.1542, 'DECAY é -W[20]');
  bate(FATOR, 0.9803464944134797, 'FATOR = 0,9^(1/DECAY) - 1');
});

test('fsrs: os dois graus do Atlas, e a palavra da tela para cada um', () => {
  assert.deepEqual({ ...GRAU }, { ERREI: 1, LEMBREI: 3 });
  assert.deepEqual({ ...NOTA_PARA_GRAU }, { errei: 1, lembrei: 3 });
});

// ── 2. os pontos soltos da referência ──────────────────────────────────────
test('fsrs: a curva passa pela retenção-alvo no intervalo, e por 1 no dia zero', () => {
  bate(retencao(1, 1), 0.9, 'retencao(1,1)');
  bate(retencao(10, 10), 0.9, 'retencao(10,10)');
  bate(retencao(5, 10), 0.9403442888929227, 'retencao(5,10)');
  bate(retencao(30, 10), 0.8093881035731708, 'retencao(30,10)');
  bate(retencao(0, 5), 1, 'retencao(0,S) é o instante em que acabei de ver');
});

test('fsrs: a dificuldade inicial dos dois botões', () => {
  bate(dificuldadeInicial(1), 6.4133, 'dificuldadeInicial(1) é W[4]');
  bate(dificuldadeInicial(3), 2.118103970459015, 'dificuldadeInicial(3)');
});

test('fsrs: a estabilidade inicial é o parâmetro do próprio grau', () => {
  bate(estabilidadeInicial(1), 0.212, 'W[0]');
  bate(estabilidadeInicial(3), 2.3065, 'W[2]');
});

test('fsrs: o intervalo da PRIMEIRA resposta de um cartão novo', () => {
  assert.equal(revisarFsrs(null, GRAU.LEMBREI, 0).intervalo, 2, 'primeira Lembrei volta em 2 dias');
  assert.equal(revisarFsrs(null, GRAU.ERREI, 0).intervalo, 1, 'primeira Errei volta amanhã');
});

// ── 3. as quatro seqüências da referência ──────────────────────────────────
test('fsrs: lembrou cinco vezes seguidas', () => {
  confere(caminho([['L', 0], ['L', 2], ['L', 11], ['L', 46], ['L', 163]]), [
    ['L', 0, 2.3065, 2.118104, 2],
    ['L', 2, 10.964332, 2.116986, 11],
    ['L', 11, 46.257286, 2.115869, 46],
    ['L', 46, 162.681274, 2.114753, 163],
    ['L', 163, 496.572034, 2.113638, 497],
  ]);
});

test('fsrs: errou na primeira, depois lembrou quatro vezes', () => {
  confere(caminho([['E', 0], ['L', 1], ['L', 2], ['L', 6], ['L', 17]]), [
    ['E', 0, 0.212, 6.4133, 1],
    ['L', 1, 1.886788, 6.407887, 2],
    ['L', 2, 6.26366, 6.402479, 6],
    ['L', 6, 17.344792, 6.397076, 17],
    ['L', 17, 43.70259, 6.391679, 44],
  ]);
});

test('fsrs: lembrou duas, errou no meio, lembrou mais duas', () => {
  confere(caminho([['L', 0], ['L', 2], ['E', 11], ['L', 2], ['L', 5]]), [
    ['L', 0, 2.3065, 2.118104, 2],
    ['L', 2, 10.964332, 2.116986, 11],
    ['E', 11, 1.538079, 7.399907, 2],
    ['L', 2, 4.868816, 7.393507, 5],
    ['L', 5, 12.275259, 7.387113, 12],
  ]);
});

test('fsrs: errou três vezes seguidas', () => {
  confere(caminho([['E', 0], ['E', 1], ['E', 1]]), [
    ['E', 0, 0.212, 6.4133, 1],
    ['E', 1, 0.100886, 8.812076, 1],
    ['E', 1, 0.055032, 9.600537, 1],
  ]);
});

// ── 4. as regras que a tabela não mostra sozinha ────────────────────────────
test('fsrs: um erro nunca AUMENTA o intervalo (o min(..., S) da estabilidade esquecida)', () => {
  // Um cartão forte (S=100) quase esquecido: sem o teto, a fórmula daria mais que 100.
  const semTeto = estabilidadeEsqueceu(5, 100, 0.2);
  assert.ok(semTeto <= 100, `estabilidadeEsqueceu passou da estabilidade anterior: ${semTeto}`);
  const r = revisarFsrs({ estabilidade: 100, dificuldade: 5 }, GRAU.ERREI, 400);
  assert.ok(r.intervalo <= 100, `o erro empurrou o cartão para mais longe: ${r.intervalo} dias`);
});

test('fsrs: a dificuldade fica presa em [1,10] por qualquer caminho', () => {
  for (const d of [
    proximaDificuldade(10, GRAU.ERREI),
    proximaDificuldade(1, GRAU.LEMBREI),
    proximaDificuldade(9.99, GRAU.ERREI),
    dificuldadeInicial(5),
  ]) {
    assert.ok(d >= 1 && d <= 10, `dificuldade fora de [1,10]: ${d}`);
  }
});

test('fsrs: o intervalo nunca é zero, nem para um cartão que virou poeira', () => {
  assert.equal(intervaloEmDias(0.0001), 1);
  assert.equal(intervaloEmDias(0), 1);
  assert.equal(intervaloEmDias(NaN), 1);
  let estado = { estabilidade: 0.0001, dificuldade: 10 };
  for (let i = 0; i < 5; i++) {
    const r = revisarFsrs(estado, GRAU.ERREI, 1);
    assert.equal(r.intervalo, 1, 'um cartão em poeira tem de voltar amanhã, nunca hoje');
    estado = { estabilidade: r.estabilidade, dificuldade: r.dificuldade };
  }
});

test('fsrs: grau que a tela não tem botão é recusado, não agendado', () => {
  for (const g of [2, 4, 5, 0, -1, NaN, 'lembrei']) {
    const r = revisarFsrs(null, g, 0);
    assert.ok(r.erro, `grau ${g} deveria ser recusado e devolveu ${JSON.stringify(r)}`);
  }
});

test('fsrs: dias no futuro ou que não são número são recusados', () => {
  for (const t of [-1, NaN, 'dois', null, undefined]) {
    const r = revisarFsrs({ estabilidade: 2, dificuldade: 2 }, GRAU.LEMBREI, t);
    assert.ok(r.erro, `t=${t} deveria ser recusado`);
  }
});

test('fsrs: estado quebrado no meio do arquivo vira cartão novo, não exceção', () => {
  // Um storage corrompido ou importado pode trazer fsrs sem estabilidade. O
  // cartão ainda é do usuário: recomeçar o agendamento é melhor que sumir da fila.
  for (const estado of [undefined, {}, { estabilidade: 0, dificuldade: 2 }, { estabilidade: 'x', dificuldade: 2 }]) {
    const r = revisarFsrs(estado, GRAU.LEMBREI, 0);
    assert.ok(!r.erro, `não deveria recusar: ${JSON.stringify(estado)}`);
    bate(r.estabilidade, 2.3065, 'inicializa pela fórmula do grau');
  }
});

test('fsrs: o mesmo dia (t=0) não infla o cartão — a curva do FSRS-6', () => {
  // Com t=0 a retenção é 1, então (e^(W[10]·(1-R)) - 1) é 0 e lembrar não cresce S.
  // O que a referência mostra na linha 1 de toda seqüência: o primeiro Lembrei é
  // inicialização, não crescimento, e o segundo (t=2) é o primeiro crescimento real.
  const r = revisarFsrs({ estabilidade: 10, dificuldade: 5 }, GRAU.LEMBREI, 0);
  bate(r.estabilidade, 10, 'revisar no mesmo dia não muda a estabilidade');
});
