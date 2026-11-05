// Projeto Atlas — o DESAFIO da estação sem tela (S18b-1, 05/11/2026): o núcleo
// puro de core/desafio.js, irmão do estudo.test.js e do eixos.test.js.
//
// Por que a trava existe antes da tela: o desafio é o que decide «dominada», e a
// decisão é tomada com três números e uma data. Se a idade mínima de um cartão
// escorregar para zero, o desafio passa a cobrar memória de curto prazo — o que
// ainda está na cabeça desde ontem — e a estação é carimbada como dominada por
// algo que não foi medido. Nenhum dos dois lados (a tela, o carimbo) consegue
// conferir isso olhando: só a conta, cobrada aqui.
//
// As decisões de core/desafio.js, uma a uma:
//   · elegibilidade é `criadoEm` + 2 dias, e nada menos;
//   · `podeDesafiar` devolve a frase da PRIMEIRA condição que falta, nunca as
//     quatro juntas — «faça as duas coisas» não diz por onde começar;
//   · pulada NÃO satisfaz aula de exercício (princípio 1: verificado, não declarado);
//   · o sorteio vem da semente, sem Math.random: a mesma semente, o mesmo sorteio;
//   · todo id montado é id de um cartão QUE A PESSOA ESCREVEU. As aulas de
//     exercício são vídeo, não há pergunta nos dados (regra 7): se a montagem
//     devolvesse um título de aula, a tela desenharia uma pergunta inventada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  IDADE_MINIMA_DIAS, MINIMO_CARTOES, MAXIMO_CARTOES,
  cartoesElegiveis, podeDesafiar, montarDesafio,
} from '../core/desafio.js';
import { criarCartao } from '../core/cartoes.js';
import { TEXTOS, desafio as D } from '../core/textos.js';

const ESTACAO = 'ubl-core-circuitos-digitais';
const HOJE = '2026-11-05';
/** Dois dias antes de HOJE: o primeiro dia em que um cartão entra no desafio. */
const DOIS_DIAS = '2026-11-03T09:00';
const ONTEM = '2026-11-04T09:00';
const HOJE_MANHA = '2026-11-05T08:30';

// ───────────────────────────── as fábricas ─────────────────────────────
// Os cartões nascem de criarCartao, como manda o pedido: um cartão armado à mão
// no teste poderia trazer um campo que a pessoa nunca escreve, e a elegibilidade
// passaria verde sobre um dado que não existe no aparelho de ninguém.
let seq = 0;
function comCartoes(especificacoes) {
  let arq = { versao: 1, cartoes: {} };
  for (const e of especificacoes) {
    const id = `c${(seq += 1)}`;
    const r = criarCartao(
      arq,
      {
        estacao: e.estacao ?? ESTACAO,
        aula: e.aula,
        n: e.n ?? 1,
        frente: `Pergunta que eu escrevi no ${id}`,
        verso: `Resposta que eu escrevi no ${id}`,
      },
      e.criadoEm ?? DOIS_DIAS,
      id,
    );
    assert.equal(r.ok, true, `o cartão de exemplo não nasceu: ${r.erro}`);
    arq = r.cartoes;
  }
  return arq;
}

/** A estação com `total` aulas; `exercicios` são as POSIÇÕES (o `n`) de exercício. */
function aulasDaEstacao(total = 8, exercicios = [2, 5]) {
  return Array.from({ length: total }, (_, i) => ({
    id: `a${i + 1}`,
    n: i + 1,
    titulo: `Aula ${String(i + 1).padStart(2, '0')} — conteúdo da UBL`,
    duracaoS: 600 + i * 30,
    exercicio: exercicios.includes(i + 1),
  }));
}

/** N cartões, espalhados pelas aulas que NÃO estão em `excluidas`. */
function espalhados(quantos, { total = 8, excluidas = [] } = {}) {
  const livres = [];
  for (let i = 1; i <= total; i += 1) if (!excluidas.includes(i)) livres.push(i);
  return Array.from({ length: quantos }, (_, k) => ({ aula: `a${livres[k % livres.length]}` }));
}

/** O estudo de uma estação percorrida: `puladas` e `naoEstudadas` são posições. */
function estudoDe(total = 8, { puladas = [], naoEstudadas = [] } = {}) {
  const aulas = {};
  for (let i = 1; i <= total; i += 1) {
    if (naoEstudadas.includes(i)) continue;
    aulas[`a${i}`] = puladas.includes(i)
      ? { estacao: ESTACAO, aula: `a${i}`, n: i, abertaEm: '2026-11-01T09:00', puladaEm: '2026-11-01T10:00' }
      : { estacao: ESTACAO, aula: `a${i}`, n: i, abertaEm: '2026-11-01T09:00', estudadaEm: '2026-11-01T10:00' };
  }
  return { versao: 1, aulas };
}

const eixo = (estagio = 'percorrida') => ({ id: ESTACAO, estagio });

// ─────────────── 1. quem pode: as quatro condições, uma a uma ───────────────

test('S18b-1 · pode: estação percorrida, exercícios estudados e 10 cartões → pode', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(8, { excluidas: [2, 5] })]);
  const r = podeDesafiar(eixo(), estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, true, `disse que não pode, e o motivo dela foi: ${r.porque}`);
  assert.equal(r.porque, null, 'pode com explicação no bolso: a tela mostraria um «não» ao lado de um sim');
});

test('S18b-1 · pode: estação ainda em percurso tem o porque da escada, e nada mais', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(8, { excluidas: [2, 5] })]);
  const r = podeDesafiar(eixo('em-percurso'), estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, false);
  assert.equal(r.porque, D.naoPercorrida('em-percurso'));
  // A ordem é a do pedido: o estágio vem antes de qualquer conta de cartão — e a
  // estação em percurso pode ter todos os cartões do mundo, ainda não é hora.
  assert.match(r.porque, /em-percurso/, 'a frase não diz em que estágio a estação está');
});

test('S18b-1 · pode: faltam 3 aulas de exercício: 12, 40 e 77 (a frase exata do desenho)', () => {
  const aulas = aulasDaEstacao(80, [3, 12, 40, 77]);
  const cartoes = comCartoes([{ aula: 'a3' }, ...espalhados(12, { total: 80, excluidas: [3] })]);
  const r = podeDesafiar(eixo(), estudoDe(80, { naoEstudadas: [12, 40, 77] }), cartoes, aulas, HOJE);
  assert.equal(r.pode, false);
  assert.equal(r.porque, 'Faltam 3 aulas de exercício: 12, 40 e 77.');
});

test('S18b-1 · pode: aula de exercício PULADA não satisfaz — pulada é declarada, não medida', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(8, { excluidas: [2, 5] })]);
  const r = podeDesafiar(eixo(), estudoDe(8, { puladas: [5] }), cartoes, aulas, HOJE);
  assert.equal(r.pode, false);
  assert.equal(r.porque, 'Faltam 1 aula de exercício: 5.');
});

test('S18b-1 · pode: exercício estudado sem cartão → «Escreva um cartão das aulas de exercício 12 e 40.»', () => {
  const aulas = aulasDaEstacao(80, [12, 40]);
  const cartoes = comCartoes(espalhados(12, { total: 80, excluidas: [12, 40] }));
  const r = podeDesafiar(eixo(), estudoDe(80), cartoes, aulas, HOJE);
  assert.equal(r.pode, false);
  assert.equal(r.porque, 'Escreva um cartão das aulas de exercício 12 e 40.');
});

test('S18b-1 · pode: cartões de menos, e nenhum a caminho → «escreva mais 4 ao fechar as aulas.»', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  // 6 elegíveis (as duas de exercício + 4): 10 - 6 = 4, e nenhum está amadurecendo.
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(4, { excluidas: [2, 5] })]);
  const r = podeDesafiar(eixo(), estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, false);
  assert.equal(r.porque, 'O desafio usa os seus cartões: escreva mais 4 ao fechar as aulas.');
});

test('S18b-1 · pode: os que faltam já foram escritos e só amadurecem → «faltam 3»', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([
    { aula: 'a2' }, { aula: 'a5' },
    ...espalhados(5, { excluidas: [2, 5] }),
    // três cartões escritos ontem: não entram no sorteio, mas contam na espera
    { aula: 'a6', criadoEm: ONTEM }, { aula: 'a6', criadoEm: ONTEM }, { aula: 'a7', criadoEm: ONTEM },
  ]);
  const r = podeDesafiar(eixo(), estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, false);
  assert.equal(r.porque, 'Os cartões entram dois dias depois de escritos: faltam 3.');
});

test('S18b-1 · pode: 20 das 36 estações não têm aula de exercício — as duas condições passam sozinhas', () => {
  const aulas = aulasDaEstacao(8, []);
  const cartoes = comCartoes(espalhados(10, { total: 8 }));
  const r = podeDesafiar(eixo(), estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, true, `estação sem exercício foi barrada por causa de exercício: ${r.porque}`);
});

test('S18b-1 · pode: o eixo do core/eixos.js vem SEM id — a estação se deduz pelas aulas', () => {
  // `eixosDaEstacao` devolve { estagio, estudadas, total, ... } e não devolve o
  // próprio id. Se aqui o id ausente virasse «nenhum cartão», a estação pronta
  // levaria um «escreva mais 10» na cara de quem tem todos os cartões escritos.
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([
    { aula: 'a2' }, { aula: 'a5' },
    ...espalhados(8, { excluidas: [2, 5] }),
    // um cartão de OUTRA estação, escrito numa aula que não é desta lista
    { aula: 'a99', estacao: 'ubl-core-matematica-discreta' },
  ]);
  const semId = { estagio: 'percorrida' };
  const r = podeDesafiar(semId, estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, true, `sem o id no eixo, o desafio disse não: ${r.porque}`);
});

test('S18b-1 · pode: chamado sem dado nenhum diz que não pode, sem estourar', () => {
  for (const args of [[undefined, undefined, undefined, undefined, undefined], [eixo(), null, null, null, null]]) {
    const r = podeDesafiar(...args);
    assert.equal(r.pode, false);
    assert.equal(typeof r.porque, 'string');
    assert.ok(r.porque.trim().length > 0, 'um «não pode» sem porque é a tela mudando de cor sem explicação');
  }
});

test('S18b-1 · pode: nada muta a entrada', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(8, { excluidas: [2, 5] })]);
  const estudo = estudoDe(8);
  const antes = JSON.stringify({ cartoes, estudo, aulas });
  podeDesafiar(eixo(), estudo, cartoes, aulas, HOJE);
  montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'semente');
  assert.equal(JSON.stringify({ cartoes, estudo, aulas }), antes, 'o desafio mexeu no arquivo da pessoa');
});

// ─────────────── 2. a elegibilidade: a idade do cartão ───────────────

test('S18b-1 · elegível: o de ontem não entra, o de dois dias entra, o de hoje não entra', () => {
  const cartoes = comCartoes([
    { aula: 'a1', criadoEm: HOJE_MANHA },
    { aula: 'a2', criadoEm: ONTEM },
    { aula: 'a3', criadoEm: DOIS_DIAS },
    { aula: 'a4', criadoEm: '2026-10-30T23:30' },
  ]);
  const lista = cartoesElegiveis(cartoes, ESTACAO, HOJE);
  assert.equal(lista.length, 2, `entraram ${lista.length} cartões; só os de dois dias ou mais podem entrar`);
  assert.ok(lista.some((c) => c.criadoEm === DOIS_DIAS),
    'o cartão de exatamente dois dias ficou de fora: a régua é «2 dias ou mais»');
  assert.ok(lista.some((c) => c.criadoEm === '2026-10-30T23:30'),
    'o cartão de 23h30 ficou de fora: há um fuso no meio da conta de dias');
  assert.ok(!lista.some((c) => c.criadoEm === ONTEM),
    'o cartão de ontem entrou: recordação a quente não é memória');
  assert.ok(!lista.some((c) => c.criadoEm === HOJE_MANHA),
    'o cartão escrito hoje entrou: o desafio cobraria a resposta que ainda está na cabeça');
  assert.ok(lista.every((c) => typeof c.id === 'string' && c.id), 'cartão elegível sem id: o sorteio não teria o que devolver');
});

test('S18b-1 · elegível: só os cartões DA estação, e as réguas são as do módulo', () => {
  const cartoes = comCartoes([
    { aula: 'a1' },
    { aula: 'a2', estacao: 'ubl-core-matematica-discreta' },
  ]);
  const lista = cartoesElegiveis(cartoes, ESTACAO, HOJE);
  assert.equal(lista.length, 1, 'cartão de outra estação entrou no desafio desta');
  assert.equal(lista[0].estacao, ESTACAO);
  assert.equal(IDADE_MINIMA_DIAS, 2, 'a idade mínima mudou sem o desenho mudar junto (J4: «os da própria pessoa»)');
  assert.equal(MINIMO_CARTOES, 10);
  assert.equal(MAXIMO_CARTOES, 15);
});

test('S18b-1 · elegível: a ordem é fixa (do mais novo ao mais velho, empate pelo id)', () => {
  const cartoes = comCartoes([
    { aula: 'a1', criadoEm: DOIS_DIAS },
    { aula: 'a2', criadoEm: '2026-11-01T09:00' },
    { aula: 'a3', criadoEm: '2026-10-20T09:00' },
  ]);
  const lista = cartoesElegiveis(cartoes, ESTACAO, HOJE);
  assert.deepEqual(lista.map((c) => c.criadoEm.slice(0, 10)), ['2026-11-03', '2026-11-01', '2026-10-20'],
    'a ordem do pool mudou: o sorteio mudaria sem mudar a semente');
});

test('S18b-1 · elegível: arquivo vazio, estação vazia e hoje vazio devolvem lista vazia', () => {
  for (const [cartoes, estacao, hoje] of [
    [undefined, ESTACAO, HOJE], [{}, ESTACAO, HOJE], [comCartoes([{ aula: 'a1' }]), '', HOJE],
    [comCartoes([{ aula: 'a1' }]), ESTACAO, null],
  ]) {
    assert.deepEqual(cartoesElegiveis(cartoes, estacao, hoje), []);
  }
});

// ─────────────── 3. o sorteio: a semente manda ───────────────

test('S18b-1 · sorteio: a mesma semente dá o mesmo sorteio, outra semente dá outro', async () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([
    { aula: 'a2' }, { aula: 'a2' }, { aula: 'a2' },
    { aula: 'a5' }, { aula: 'a5' },
    ...espalhados(12, { excluidas: [2, 5] }),
  ]);

  const a = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'atlas-2026-11-05');
  const b = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'atlas-2026-11-05');
  const c = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'outro-texto');

  assert.deepEqual(a.cartoes, b.cartoes, 'a mesma semente sorteou duas listas: a tela trocaria os cartões debaixo dos olhos dela');
  assert.equal(a.semente, 'atlas-2026-11-05', 'a semente não voltou na resposta: ninguém reproduz um sorteio relatado');
  assert.notDeepEqual(a.cartoes, c.cartoes, 'a semente não chegou ao sorteio: é Math.random disfarçado');

  // O módulo não usa o acaso nem o relógio — nem por engano de quem editar depois.
  const fonte = await readFile(new URL('../core/desafio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte.replace(/^\s*\/\/.*$/gm, ''), /Math\.random|Date\.now|new Date\(\)/,
    'core/desafio.js chamou o acaso ou o relógio: o sorteio parou de ser reproduzível');
  assert.match(fonte, /xorshift32/, 'o sorteio perdeu a descrição do PRNG próprio');
});

test('S18b-1 · sorteio: todo id montado é id de um cartão da pessoa', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(12, { excluidas: [2, 5] })]);
  const dela = Object.keys(cartoes);
  const r = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'semente-qualquer');
  assert.ok(r.cartoes.length >= MINIMO_CARTOES && r.cartoes.length <= MAXIMO_CARTOES,
    `sorteou ${r.cartoes.length} cartões: o desenho diz de ${MINIMO_CARTOES} a ${MAXIMO_CARTOES}`);
  for (const id of r.cartoes) {
    assert.ok(dela.includes(id), `o desafio montou «${id}», que não é um cartão dela`);
    assert.equal(typeof id, 'string', 'montou algo que não é id');
    assert.ok(!/^Aula \d|^\d+$/.test(String(id)), `montou «${id}» — parece título de aula, e o Atlas não inventa pergunta`);
  }
  assert.equal(new Set(r.cartoes).size, r.cartoes.length, 'o mesmo cartão duas vezes: o desafio cobraria a mesma coisa');
});

test('S18b-1 · sorteio: um de cada aula de exercício entra primeiro', () => {
  const aulas = aulasDaEstacao(8, [2, 5, 7]);
  const cartoes = comCartoes([
    { aula: 'a2' }, { aula: 'a2' }, { aula: 'a2' },
    { aula: 'a5' }, { aula: 'a5' },
    { aula: 'a7' },
    ...espalhados(6, { excluidas: [2, 5, 7] }),
  ]);
  const r = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'um-por-aula');
  const sorteados = new Set(r.cartoes);
  for (const aula of aulas.filter((a) => a.exercicio)) {
    const daAula = Object.values(cartoes).filter((c) => c.aula === aula.id && sorteados.has(c.id));
    assert.ok(daAula.length >= 1, `a aula de exercício ${aula.n} ficou fora do desafio`);
  }

  // O piso NÃO é teto: o pedido diz «primeiro um de cada; depois completa com os
  // outros», e não proíbe um segundo cartão da mesma aula no complemento. O que é
  // cobrado aqui é a ORDEM — as primeiras posições são a fase 1, uma por aula de
  // exercício. Se o complemento passar a rodar antes, o sorteio pode chegar ao
  // teto sem nenhuma aula de exercício, e o desafio deixa de cobrar o vídeo.
  const deExercicio = r.cartoes.map((id) => cartoes[id].aula).filter((aula) => aulas.find((a) => a.id === aula)?.exercicio);
  const exercicios = aulas.filter((a) => a.exercicio);
  assert.equal(new Set(deExercicio.slice(0, exercicios.length)).size, exercicios.length,
    'as primeiras posições não são um por aula de exercício: a fase 1 não veio primeiro');
  assert.deepEqual(r.cartoes.slice(0, exercicios.length).map((id) => cartoes[id].aula).sort(), exercicios.map((a) => a.id).sort(),
    'a fase 1 sorteou duas aulas e deixou uma de fora');
});

test('S18b-1 · sorteio: 22 aulas de exercício, e o teto de 15 vence', () => {
  const posicoes = Array.from({ length: 22 }, (_, i) => i + 1);
  const aulas = aulasDaEstacao(22, posicoes);
  const cartoes = comCartoes(posicoes.map((n) => ({ aula: `a${n}`, n })));
  const r = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'teto');
  assert.equal(r.cartoes.length, MAXIMO_CARTOES, `sorteou ${r.cartoes.length} com 22 aulas de exercício`);
  const aulasSorteadas = new Set(r.cartoes.map((id) => cartoes[id].aula));
  assert.equal(aulasSorteadas.size, MAXIMO_CARTOES, 'repetiu aula de exercício em vez de respeitar o teto');
});

test('S18b-1 · sorteio: estação sem aula de exercício sorteia mesmo assim', () => {
  const aulas = aulasDaEstacao(8, []);
  const cartoes = comCartoes(espalhados(11, { total: 8 }));
  const r = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'sem-exercicio');
  assert.equal(r.cartoes.length, 11);
  assert.ok(r.cartoes.every((id) => Object.keys(cartoes).includes(id)));
});

test('S18b-1 · sorteio: abaixo do piso não inventa — devolve lista vazia', () => {
  const aulas = aulasDaEstacao(8, [2]);
  const cartoes = comCartoes([{ aula: 'a2' }, ...espalhados(6, { excluidas: [2] })]);
  const r = montarDesafio(cartoes, ESTACAO, aulas, HOJE, 'poucos');
  assert.deepEqual(r.cartoes, [], 'completou o sorteio com o que não existe: a regra 7 proibiu');
  assert.equal(r.semente, 'poucos');
});

test('S18b-1 · sorteio: chamado sem dado nenhum devolve a semente e nada', () => {
  assert.deepEqual(montarDesafio(undefined, ESTACAO, undefined, HOJE, 'vazio'), { semente: 'vazio', cartoes: [] });
});

// ─────────────── 4. as frases moram em core/textos.js ───────────────

test('S18b-1 · textos: o desafio tem as quatro frases, todas em TEXTOS (regra 9)', () => {
  assert.equal(TEXTOS.desafio, D, 'TEXTOS não exporta a seção do desafio');
  for (const [nome, fn] of Object.entries(D)) {
    assert.equal(typeof fn, 'function', `desafio.${nome} não é função`);
  }
  assert.equal(D.faltamExercicios([12, 40, 77]), 'Faltam 3 aulas de exercício: 12, 40 e 77.');
  assert.equal(D.faltamExercicios([5]), 'Faltam 1 aula de exercício: 5.');
  assert.equal(D.faltamCartoesDeExercicio([12, 40]), 'Escreva um cartão das aulas de exercício 12 e 40.');
  assert.equal(D.faltamCartoesDeExercicio([9]), 'Escreva um cartão da aula de exercício 9.');
  assert.equal(D.escrevaMais(4), 'O desafio usa os seus cartões: escreva mais 4 ao fechar as aulas.');
  assert.equal(D.maturando(3), 'Os cartões entram dois dias depois de escritos: faltam 3.');
});
