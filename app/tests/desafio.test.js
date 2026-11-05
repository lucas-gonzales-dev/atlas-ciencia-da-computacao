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
  IDADE_MINIMA_DIAS, MINIMO_CARTOES, MAXIMO_CARTOES, CORTE_APROVACAO,
  cartoesElegiveis, podeDesafiar, montarDesafio,
  corrigirDesafio, aplicarResultado, fraseDaDominada,
} from '../core/desafio.js';
import { criarCartao, revisarCartao } from '../core/cartoes.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { lerProgresso } from '../core/viagem.js';
import { salvarViagem, carregarViagem } from '../web/metro.js';
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

// ═══════════ S18b-2 (05/11/2026): corrigir, a dominada e a frase ═══════════
//
// O que se prova aqui, na ordem do pedido:
//   1. a correção no corte — 8 de 10 aprueba, 7 de 10 não;
//   2. o reprovado devolve os ERRADOS para hoje e não toca nos demais;
//   3. o tempo nunca rebaixa, e só um reprovado DEPOIS de dominada devolve para
//      percorrida (e a dominada pode refazer o desafio);
//   4. o round-trip do campo novo — gravar, reler, os números continuarem lá;
//   5. a frase do carimbo com os números, no singular e no plural.
//
// Os cartões seguem nascendo de `criarCartao` e `revisarCartao`, e agora isso
// importa de um jeito novo: o reprovado mexe em `devidoEm`, e um cartão armado à
// mão no teste não teria o `devidoEm` de futuro que uma revisão real deu a ele. A
// prova de que só os errados voltam é exatamente a diferença entre as datas dos
// dois grupos.
//
// Uma mutação por bloco: o corte em 0,7 (aprovar com 7/10) derruba as travas
// abaixo, e foi assim que elas foram conferidas.

/** Um sorteio de `MINIMO_CARTOES` cartões reais, com a estação toda estudada. */
function cenario(quantos = MINIMO_CARTOES, semente = 's18b2') {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([
    { aula: 'a2' },
    { aula: 'a5' },
    ...espalhados(quantos - 2, { excluidas: [2, 5] }),
  ]);
  const sorteio = montarDesafio(cartoes, ESTACAO, aulas, HOJE, semente);
  assert.equal(sorteio.cartoes.length, quantos, 'o sorteio não veio com o tamanho pedido');
  return { aulas, cartoes, sorteio };
}

/** As respostas: os `acertos` primeiros do sorteio lembraram, o resto errou. */
function respostas(sorteio, acertos) {
  const dadas = {};
  sorteio.cartoes.forEach((id, i) => { dadas[id] = i < acertos; });
  return dadas;
}

/** Todos os cartões revisados de verdade nesta manhã — o `devidoEm` vai para o futuro. */
function reviseTodos(cartoes, nota = 'lembrei') {
  let arq = cartoes;
  for (const id of Object.keys(cartoes)) {
    const r = revisarCartao(arq, id, { nota, confianca: 'acho' }, HOJE_MANHA);
    assert.equal(r.ok, true, `a revisão de ${id} não aconteceu: ${r.erro}`);
    arq = r.cartoes;
  }
  return arq;
}

const progressoVazio = () => ({ completed: [], emCurso: [], conclusoes: {}, dominadas: {} });

// ───────────────── 1. a correção, no corte de 80% ─────────────────

test('S18b-2 · correção: 8 de 10 aprueba, 7 de 10 não (o corte é 0,8, não 0,7)', () => {
  const { sorteio } = cenario();
  const aprovado = corrigirDesafio(sorteio, respostas(sorteio, 8));
  assert.equal(aprovado.acertos, 8);
  assert.equal(aprovado.total, 10);
  assert.equal(aprovado.aprovado, true, '7/10 → 70% e 8/10 → 80% têm de cair em lados opostos do corte');
  assert.deepEqual(aprovado.lembrados, sorteio.cartoes.slice(0, 8));
  assert.deepEqual(aprovado.errados, sorteio.cartoes.slice(8));

  const reprovado = corrigirDesafio(sorteio, respostas(sorteio, 7));
  assert.equal(reprovado.aprovado, false, 'aprovou com 7 de 10: o corte escorregou para 0,7');
  assert.equal(reprovado.errados.length, 3);
});

test('S18b-2 · correção: o denominador é o SORTEIO, e responder fora dele não conta', () => {
  const { sorteio, cartoes } = cenario();
  const fora = Object.keys(cartoes).find((id) => !sorteio.cartoes.includes(id));
  const r = corrigirDesafio(sorteio, { ...respostas(sorteio, 9), [fora]: true });
  assert.equal(r.total, MINIMO_CARTOES, 'um cartão não sorteado entrou no denominador');
  assert.equal(r.acertos, 9, 'um cartão não sorteado entrou como acerto: a pessoa aprovaria por algo que não respondeu');
  assert.equal(r.lembrados.includes(fora), false);
});

test('S18b-2 · correção: sem sorteio não há 100% — 0 de 0 é «não houve medida»', () => {
  const r = corrigirDesafio({ semente: 'nada', cartoes: [] }, {});
  assert.deepEqual({ acertos: r.acertos, total: r.total, aprovado: r.aprovado }, { acertos: 0, total: 0, aprovado: false });
  assert.equal(corrigirDesafio(undefined, undefined).aprovado, false);
});

test('S18b-2 · correção: respondido de forma diferente vale, não respondido não conta como acerto', () => {
  const { sorteio } = cenario();
  const r = corrigirDesafio(sorteio, [{ id: sorteio.cartoes[0], acertou: true }, { id: sorteio.cartoes[1], nota: 'errei' }]);
  assert.equal(r.acertos, 1);
  // Os 9 não respondidos caem em `errados` (a lista dos que não foram lembrados),
  // e o corte é sobre o sorteio inteiro: fechar a tela no meio não aprova nada.
  assert.equal(r.errados.length, MINIMO_CARTOES - 1);
  assert.equal(r.aprovado, false);
});

// ───────────────── 2. o reprovado devolve os errados para hoje ─────────────────

test('S18b-2 · reprovado: os 3 errados voltam para HOJE, os 7 lembrados ficam onde a revisão os pôs', () => {
  const { sorteio, cartoes } = cenario();
  const revisados = reviseTodos(cartoes);
  const antes = corrigirDesafio(sorteio, respostas(sorteio, 7));
  assert.equal(antes.aprovado, false);

  const r = aplicarResultado(
    progressoVazio(), revisados, ESTACAO, antes,
    { aulas: 8, cartoes: Object.keys(revisados).length }, HOJE,
  );

  const depois = r.cartoes;
  for (const id of antes.errados) {
    assert.equal(depois[id].devidoEm, HOJE, `${id} errou no desafio e não voltou para a fila de hoje`);
  }
  for (const id of antes.lembrados) {
    assert.notEqual(depois[id].devidoEm, HOJE, 'um cartão lembrado foi puxado para hoje: a fila diria «reveja» o que ela acabou de confirmar');
    assert.deepEqual(depois[id], revisados[id], 'o reprovado mexeu num cartão que a pessoa acertou');
  }
  // Nada se perde: o arquivo continua com os mesmos 10 cartões, e o `fsrs` de um
  // errado é o da revisão da manhã — o desafio é autoconferência, não revisão.
  assert.deepEqual(Object.keys(depois).sort(), Object.keys(revisados).sort());
  assert.deepEqual(depois[antes.errados[0]].fsrs, revisados[antes.errados[0]].fsrs, 'o desafio reescreveu o FSRS: dois donos para o mesmo agendamento');
  assert.deepEqual(depois[antes.errados[0]].historico, revisados[antes.errados[0]].historico);
  // Sem carimbo nenhum: reprovado não escreve `dominadas`, e não cria chave vazia.
  assert.deepEqual(r.progresso.dominadas, {});
  assert.equal(r.dominada, null);
  assert.equal(r.recado, 'Faltaram 3. Eles voltam para a fila de hoje. Tente de novo quando quiser.');
});

test('S18b-2 · reprovado: sem uma data legível nada é movido, e a frase não é dita', () => {
  const { sorteio, cartoes } = cenario();
  const revisados = reviseTodos(cartoes);
  const antes = corrigirDesafio(sorteio, respostas(sorteio, 6));
  const r = aplicarResultado(progressoVazio(), revisados, ESTACAO, antes, {}, 'ontem');
  assert.deepEqual(r.cartoes, revisados, 'mexeu na fila com uma data que não é data');
  assert.equal(r.recado, '', 'disse «voltam para a fila de hoje» sem mover um cartão: a tela mentiu sobre o arquivo');
});

test('S18b-2 · aprovado: o envelope do arquivo é devolvido como veio', () => {
  const { sorteio, cartoes } = cenario();
  const antes = corrigirDesafio(sorteio, respostas(sorteio, 10));
  const r = aplicarResultado(progressoVazio(), { versao: 1, cartoes }, ESTACAO, antes, { aulas: 8, cartoes: 10 }, HOJE);
  assert.equal(r.cartoes.versao, 1, 'trocou a forma do envelope na volta');
  assert.equal(Object.keys(r.cartoes.cartoes).length, MINIMO_CARTOES);
});

// ───────────────── 3. a dominada: carimbo, tempo e rebaixamento ─────────────────

test('S18b-2 · aprovado: o carimbo em progresso.dominadas, com os números que a S17 lê', () => {
  const { sorteio, cartoes, aulas } = cenario();
  const antes = corrigirDesafio(sorteio, respostas(sorteio, 8));
  const r = aplicarResultado(
    progressoVazio(), cartoes, ESTACAO, antes,
    { aulas, cartoes: Object.keys(cartoes) }, `${HOJE}T21:05`,
  );
  const dominada = r.progresso.dominadas[ESTACAO];
  assert.ok(dominada, 'aprovou e o carimbo não nasceu');
  assert.equal(dominada.em, HOJE, 'a hora não entra no carimbo: dia é dia');
  assert.equal(dominada.acertos, 8);
  assert.equal(dominada.total, 10);
  assert.deepEqual(dominada.lembrados, antes.lembrados);
  assert.equal(dominada.aulas, 8, 'aulas é a CONTAGEM do resumo, não a lista');
  assert.equal(dominada.cartoes, MINIMO_CARTOES);
  assert.equal(r.recado, fraseDaDominada(dominada));
  // Aprovado não toca nos cartões: quem escreveu 10 cartões e passou continua com
  // os 10, com as datas que a revisão deu a eles.
  assert.deepEqual(r.cartoes, cartoes, 'o aprovado mexeu na fila');
});

test('S18b-2 · aprovado sem data não carimba: um dia inventado não é medida', () => {
  const { sorteio, cartoes } = cenario();
  const antes = corrigirDesafio(sorteio, respostas(sorteio, 10));
  const r = aplicarResultado(progressoVazio(), cartoes, ESTACAO, antes, { aulas: 8, cartoes: 10 }, '');
  assert.equal(r.dominada, null);
  assert.deepEqual(r.progresso.dominadas, {});
  assert.equal(r.recado, '');
});

test('S18b-2 · o tempo não rebaixa: dominada hoje é dominada 76 dias depois', () => {
  const { sorteio, cartoes, aulas } = cenario();
  const antes = corrigirDesafio(sorteio, respostas(sorteio, 9));
  const aplicado = aplicarResultado(
    progressoVazio(), cartoes, ESTACAO, antes, { aulas, cartoes: Object.keys(cartoes) }, HOJE,
  );
  const progresso = aplicado.progresso;
  const indice = { estacoes: { [ESTACAO]: { aulas: aulas.length, segundos: 6000 } } };
  // Os cartões passam por `revisarCartao` antes de medir o «pede revisão»: com
  // `fsrs: null` não há estabilidade nem `ultimaEm`, e a recuperabilidade média é
  // null — «não sei», não «pede». A travar aqui é o estágio, e ela só vale sobre
  // cartões que têm modelo por trás.
  const opcoes = { estudo: estudoDe(8), cartoes: reviseTodos(cartoes), indice, progresso };

  assert.equal(eixosDaEstacao(ESTACAO, { ...opcoes, hoje: HOJE }).estagio, 'dominada');
  // Setenta e seis dias sem abrir o app. A recuperabilidade média cai, o anel de
  // «pede revisão» aparece, e o estágio é o mesmo: tempo acrescenta um aviso, não
  // apaga uma medida.
  const depois = eixosDaEstacao(ESTACAO, { ...opcoes, hoje: '2027-01-20' });
  assert.equal(depois.estagio, 'dominada', 'o tempo rebaixou a dominada');
  assert.equal(depois.pedeRevisao, true, 'a dominada deixou de pedir revisão: dominar congelou a memória');
  assert.deepEqual(progresso.dominadas[ESTACAO], aplicado.dominada, 'o progresso mudou sem ninguém aplicar nada');
});

test('S18b-2 · só o reprovado DEPOIS de dominada devolve para percorrida', () => {
  const { sorteio, cartoes, aulas } = cenario();
  const aprovado = corrigirDesafio(sorteio, respostas(sorteio, 9));
  const dominada = aplicarResultado(
    progressoVazio(), cartoes, ESTACAO, aprovado, { aulas, cartoes: Object.keys(cartoes) }, HOJE,
  ).progresso;
  const indice = { estacoes: { [ESTACAO]: { aulas: aulas.length, segundos: 6000 } } };
  const base = { estudo: estudoDe(8), cartoes, indice, hoje: HOJE };
  assert.equal(eixosDaEstacao(ESTACAO, { ...base, progresso: dominada }).estagio, 'dominada');

  const reprovado = corrigirDesafio(sorteio, respostas(sorteio, 5));
  const r = aplicarResultado(dominada, cartoes, ESTACAO, reprovado, { aulas, cartoes: Object.keys(cartoes) }, '2026-11-20');
  assert.equal(r.progresso.dominadas[ESTACAO], undefined, 'o reprovado não devolveu a estação para percorrida');
  assert.equal(eixosDaEstacao(ESTACAO, { ...base, progresso: r.progresso }).estagio, 'percorrida');
  assert.equal(r.recado, 'Faltaram 5. Eles voltam para a fila de hoje. Tente de novo quando quiser.');

  // E o re-aprovado substitui o carimbo pelo mais recente, sem acumular versões.
  const reAprovado = aplicarResultado(r.progresso, cartoes, ESTACAO, aprovado, { aulas, cartoes: Object.keys(cartoes) }, '2026-11-21');
  assert.equal(reAprovado.progresso.dominadas[ESTACAO].em, '2026-11-21');
  assert.equal(Object.keys(reAprovado.progresso.dominadas).length, 1);
});

test('S18b-2 · dominada pode refazer o desafio (podeDesafiar aceita o estágio novo)', () => {
  const aulas = aulasDaEstacao(8, [2, 5]);
  const cartoes = comCartoes([{ aula: 'a2' }, { aula: 'a5' }, ...espalhados(8, { excluidas: [2, 5] })]);
  const r = podeDesafiar({ id: ESTACAO, estagio: 'dominada' }, estudoDe(8), cartoes, aulas, HOJE);
  assert.equal(r.pode, true, `a dominada não pode refazer: ${r.porque}`);
});

// ───────────────── 4. a armadilha do round-trip ─────────────────

test('S18b-2 · round-trip: gravar, reler, e a dominada continua com os números', () => {
  // Um carimbo que existe: 12 dos 14 sorteados, e a lista com os 12 ids.
  const dominada = {
    em: HOJE, acertos: 12, total: 14, lembrados: Array.from({ length: 12 }, (_, i) => `k${i + 1}`), aulas: 93, cartoes: 23,
  };
  const progresso = {
    completed: [ESTACAO], emCurso: [], conclusoes: { [ESTACAO]: HOJE }, dominadas: { [ESTACAO]: dominada },
  };

  // O leitor de campo: `lerProgresso` remonta o progresso campo a campo, e o que
  // não está na lista se perde em silêncio — sem erro, sem aviso, sem carimbo.
  assert.deepEqual(lerProgresso(progresso).dominadas[ESTACAO], dominada, 'lerProgresso perdeu o campo dominadas');

  // A tela, pelo caminho de verdade: salvarViagem → localStorage → carregarViagem.
  const chave = {};
  const storage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(chave, k) ? chave[k] : null),
    setItem: (k, v) => { chave[k] = String(v); },
  };
  assert.equal(salvarViagem(storage, progresso), true, 'salvarViagem recusou o progresso com dominadas');
  const lido = carregarViagem(storage, [ESTACAO]);
  assert.deepEqual(lido.dominadas[ESTACAO], dominada, 'a dominada sobreviveu à gravação e morreu na leitura');
  assert.equal(fraseDaDominada(lido.dominadas[ESTACAO]), fraseDaDominada(dominada), 'a frase mudou no round-trip');

  // O outro lado do round-trip: um lixo no storage não inventa carimbo.
  assert.deepEqual(lerProgresso({ dominadas: { [ESTACAO]: { em: '2026-13-45', acertos: 9, total: 9 } } }).dominadas, {}, 'carimbo sem data válida passou');
  assert.deepEqual(lerProgresso({ dominadas: 'sim' }).dominadas, {});
  assert.deepEqual(lerProgresso({ dominadas: [] }).dominadas, {});
  assert.deepEqual(lerProgresso(['alfa']).dominadas, {}, 'array cru tem de sair com o campo presente e vazio');
  // Transições que remontam o progresso têm de levar o campo adiante.
  const p = lerProgresso(progresso);
  assert.equal(estagioCom(p), 'dominada', 'o campo perdeu-se ao remontar o progresso');
});

/** O estágio que o mapa pintaria para este progresso, com a estação toda estudada. */
function estagioCom(progresso) {
  return eixosDaEstacao(ESTACAO, {
    estudo: estudoDe(8), cartoes: {}, indice: { estacoes: { [ESTACAO]: { aulas: 8, segundos: 6000 } } }, progresso, hoje: HOJE,
  }).estagio;
}

// ───────────────── 5. a frase do que foi medido ─────────────────

test('S18b-2 · a frase diz o que foi medido, no plural', () => {
  assert.equal(
    // Doze ids lembrados: no carimbo real `lembrados` é a LISTA dos que voltaram
    // no sorteio, e a frase lê o tamanho dela. Uma lista de 1 com `acertos: 12`
    // seria o teste descrevendo um carimbo que não pode existir.
    fraseDaDominada({ em: HOJE, acertos: 12, total: 14, lembrados: Array.from({ length: 12 }, (_, i) => `k${i + 1}`), aulas: 93, cartoes: 23 }),
    'Percorreu as 93 aulas desta estação, escreveu 23 cartões e, dois dias ou mais depois, lembrou 12 de 14 deles, pela sua própria conferência. Não mede exercícios novos.',
  );
});

test('S18b-2 · a frase no singular: «a 1 aula», «1 cartão», sem artigo solta', () => {
  const um = { em: HOJE, acertos: 1, total: 1, lembrados: ['c1'], aulas: 1, cartoes: 1 };
  assert.equal(
    fraseDaDominada(um),
    'Percorreu a 1 aula desta estação, escreveu 1 cartão e, dois dias ou mais depois, lembrou 1 de 1 deles, pela sua própria conferência. Não mede exercícios novos.',
  );
  // 10 cartões, 1 aula: as duas concordâncias na mesma frase.
  assert.match(fraseDaDominada({ ...um, aulas: 1, cartoes: 10 }), /^Percorreu a 1 aula desta estação, escreveu 10 cartões/);
});

test('S18b-2 · a frase nunca afirma competência, e nunca cita dias', () => {
  const f = fraseDaDominada({ acertos: 12, total: 14, lembrados: 12, aulas: 93, cartoes: 23 });
  assert.equal(f.includes('você converte'), false, 'a frase velha de competência voltou');
  assert.equal(/há (\d+) dias/.test(f), false, 'a frase conta dias de espera: o desenho só mede «dois dias ou mais»');
  assert.equal(f.endsWith('Não mede exercícios novos.'), true, 'a cláusula de honestidade caiu da frase');
  // `lembrados` chega como lista no carimbo e como contagem na frase: as duas
  // formas têm de dar o mesmo número, ou o round-trip muda o que a pessoa lê.
  assert.equal(fraseDaDominada({ acertos: 2, total: 4, lembrados: ['c1', 'c2'], aulas: 3, cartoes: 5 }), fraseDaDominada({ acertos: 2, total: 4, lembrados: 2, aulas: 3, cartoes: 5 }));
  // Chamada sem nada não explode e não inventa: sai com zeros, e é «nada medido».
  assert.equal(typeof fraseDaDominada(undefined), 'string');
});

test('S18b-2 · o corte é um número do núcleo, e a frase vive em textos.js (regra 9)', () => {
  assert.equal(CORTE_APROVACAO, 0.8);
  assert.equal(TEXTOS.desafio.dominada, D.dominada);
  assert.equal(TEXTOS.desafio.reprovado, D.reprovado);
  assert.equal(D.reprovado(1), 'Faltaram 1. Eles voltam para a fila de hoje. Tente de novo quando quiser.');
});
