// Testes das regras da viagem (core/viagem.js) — o Atlas como mapa de metrô.
//
// CADA REGRA TEM UM CASO QUE FALHARIA SE A REGRA ESTIVESSE ERRADA, e cada um
// está marcado com "discrimina:" dizendo qual implementação errada ele pega.
// Grade de brinquedo de propósito: 35 disciplinas reais não deixam um ciclo ou
// uma baldeação visível num teste de 20 linhas.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS,
  MARCOS,
  TOTAL_ESTACOES,
  lerProgresso,
  progressoVazio,
  dataLocal,
  datasDeViagem,
  estadoDaEstacao,
  baldeacoes,
  resumoDaViagem,
  concluirEstacao,
  iniciarEstacao,
  desfazerConclusao,
  marcosNovos,
  linhasAbertas
} from '../core/viagem.js';

/** Disciplina mínima da grade, com o que as regras de fato leem. */
function estacao(id, titulo, linha, prerequisites = []) {
  return { id, title: titulo, stage: linha, prerequisites, trackId: 'ubl-core', status: 'active_core' };
}

// Grade de brinquedo:
//   linha 1: alfa (sem pré), beta (← alfa), gama (← alfa)
//   linha 2: delta (← beta)  ← BALDEAÇÃO, pois beta é da linha 1
//            epsi (← alfa, delta)
// `zeta` e `eta` formam um ciclo de propósito, na linha 3.
const GRADE = [
  estacao('alfa', 'Alfa', 1),
  estacao('beta', 'Beta', 1, ['alfa']),
  estacao('gama', 'Gama', 1, ['alfa']),
  estacao('delta', 'Delta', 2, ['beta']),
  estacao('epsi', 'Epsilon', 2, ['alfa', 'delta']),
  estacao('zeta', 'Zeta', 3, ['eta']),
  estacao('eta', 'Eta', 3, ['zeta'])
];

const SEM_CICLO = GRADE.filter((c) => c.id !== 'zeta' && c.id !== 'eta');

/** Conclui uma lista de ids numa data só, devolvendo progresso v3. */
function viajou(ids, dia = '2026-10-01') {
  let p = progressoVazio();
  for (const id of ids) p = concluirEstacao(p, id, dia, GRADE);
  return p;
}

// ──────────────────────────── lerProgresso ────────────────────────────

test('lerProgresso aceita as três formas: array cru, objeto v3 e lixo', () => {
  // discrimina: quem só entende objeto quebra no localStorage de hoje (array)
  assert.deepEqual(lerProgresso(['alfa', 'beta']), {
    completed: ['alfa', 'beta'],
    emCurso: [],
    conclusoes: {}
  });
  // discrimina: quem não saneia devolve emCurso duplicado ou conclusão sem data
  assert.deepEqual(
    lerProgresso({ completed: ['alfa', 'alfa'], emCurso: ['beta', 'beta'], conclusoes: { alfa: '2026-10-01', beta: '2026-99-99' } }),
    { completed: ['alfa'], emCurso: ['beta'], conclusoes: { alfa: '2026-10-01' } }
  );
  // discrimina: quem lança exceção derruba a tela com storage corrompido
  for (const lixo of [null, undefined, 42, 'alfa', {}, NaN]) {
    assert.doesNotThrow(() => lerProgresso(lixo));
  }
  assert.deepEqual(lerProgresso(null), progressoVazio());
});

test('dataLocal corta no fuso da pessoa, não em UTC', () => {
  // discrimina: toISOString() puro devolveria '2026-10-02' para 21h de
  // São Paulo em outubro (UTC-3), e o resumo mentiria sobre o dia da viagem.
  const noite = new Date(2026, 9, 1, 21, 0, 0); // 1º de outubro, 21h, fuso local
  assert.equal(dataLocal(noite), '2026-10-01');
  assert.equal(dataLocal('2026-05-05'), '2026-05-05');
  // data inválida não vira dia de viagem
  assert.equal(datasDeViagem({ completed: ['alfa'], emCurso: [], conclusoes: { alfa: '2026-13-45' } }).length, 0);
});

test('dia de viagem não conta estação que não consta como concluída', () => {
  // discrimina: quem soma toda data de `conclusoes` cria dia fantasma a partir
  // de sobra de desfazer, e o resumo diz "3 dias" para 2 estações.
  const p = { completed: ['alfa'], emCurso: [], conclusoes: { alfa: '2026-10-01', beta: '2026-10-02' } };
  assert.deepEqual(datasDeViagem(p), ['2026-10-01']);
});

// ──────────────────────────── estadoDaEstacao ────────────────────────────

test('estação sem pré-requisito está disponível', () => {
  const e = estadoDaEstacao('alfa', [], GRADE);
  assert.equal(e.estado, ESTADOS.DISPONIVEL);
  assert.equal(e.linha, 1);
  assert.equal(e.titulo, 'Alfa');
  assert.deepEqual(e.faltam, []);
});

test('estação trancada diz o que falta PELO NOME e com a linha', () => {
  const e = estadoDaEstacao('delta', [], GRADE);
  assert.equal(e.estado, ESTADOS.TRANCADA);
  // discrimina: devolver ids em vez de títulos faria a tela escrever
  // "conclua ubl-core-beta" — e devolver sem linha perderia a baldeação
  assert.deepEqual(e.faltam, [{ id: 'beta', titulo: 'Beta', linha: 1 }]);
  assert.equal(e.ciclo, false);
});

test('concluir o pré-requisito destranca a estação', () => {
  assert.equal(estadoDaEstacao('beta', viajou(['alfa']), GRADE).estado, ESTADOS.DISPONIVEL);
  assert.equal(estadoDaEstacao('beta', [], GRADE).estado, ESTADOS.TRANCADA);
});

test('em curso é estado próprio, e concluir tira o id do em curso', () => {
  let p = iniciarEstacao([], 'alfa', GRADE);
  assert.equal(estadoDaEstacao('alfa', p, GRADE).estado, ESTADOS.EM_CURSO);
  p = concluirEstacao(p, 'alfa', '2026-10-01', GRADE);
  assert.equal(estadoDaEstacao('alfa', p, GRADE).estado, ESTADOS.CONCLUIDA);
  // discrimina: quem concatena em vez de filtrar deixaria o id nos dois
  // conjuntos — e a estação apareceria "em curso" no resumo mesmo carimbada
  assert.deepEqual(p.emCurso, [], 'concluir esvazia o em curso do id');
  assert.equal(p.completed.includes('alfa'), true);
});

test('precedência concluída > em curso vale no progresso IMPORTADO', () => {
  // O caso que o de cima não alcança: concluirEstacao tira o id de emCurso,
  // então quem inicia e conclui nunca produz os dois conjuntos sobrepostos.
  // A sobreposição chega de fora — arquivo de outra versão, localStorage
  // escrito à mão, exportação antiga — e lerProgresso não a saneia (nem deve:
  // descartar completed seria perder a palavra da pessoa).
  const importado = {
    completed: ['alfa'],
    emCurso: ['alfa', 'beta'],
    conclusoes: { alfa: '2026-10-01' }
  };
  assert.equal(lerProgresso(importado).emCurso.includes('alfa'), true, 'a sobreposição chega intacta à regra');
  // discrimina: inverter a precedência (emCurso antes de completed) devolve
  // "em curso" para uma estação já carimbada — a tela mandaria estudar de novo
  // o que a pessoa disse que concluiu, e o carimbo sumiria do bilhete
  assert.equal(estadoDaEstacao('alfa', importado, GRADE).estado, ESTADOS.CONCLUIDA);
  assert.equal(estadoDaEstacao('beta', importado, GRADE).estado, ESTADOS.EM_CURSO);
  // e o resumo conta cada estação uma vez só, no lugar certo
  const r = resumoDaViagem(importado, GRADE);
  assert.equal(r.concluidas, 1, 'a sobreposição não vira duas conclusões');
  assert.equal(r.emCurso, 1, 'nem vira um em curso fantasma');
});

test('concluirEstacao limpa o em curso sobreposto sem mexer na data antiga', () => {
  const importado = {
    completed: ['alfa'],
    emCurso: ['alfa'],
    conclusoes: { alfa: '2026-10-01' }
  };
  const p = concluirEstacao(importado, 'alfa', '2026-10-09', GRADE);
  assert.deepEqual(p.emCurso, []);
  assert.deepEqual(p.completed, ['alfa']);
  // discrimina: re-toque que reescreve a data mudaria o dia em que a pessoa
  // disse que concluiu — e mudaria junto os dias de viagem
  assert.equal(p.conclusoes.alfa, '2026-10-01', 'vale a primeira data');
});

test('estação dentro de ciclo é trancada COM o sinal de ciclo', () => {
  const e = estadoDaEstacao('zeta', [], GRADE);
  assert.equal(e.estado, ESTADOS.TRANCADA);
  // discrimina: sem `ciclo`, a tela manda concluir "Eta" — e Eta é impossível
  assert.equal(e.ciclo, true);
  assert.equal(estadoDaEstacao('eta', [], GRADE).ciclo, true);
  assert.equal(estadoDaEstacao('beta', [], GRADE).ciclo, false);
});

test('id que não existe no catálogo devolve null, não um estado inventado', () => {
  // discrimina: devolver 'trancada' para id fantasma faria a tela listar um
  // pré-requisito que não existe; devolver 'disponivel' a deixaria concluir
  assert.equal(estadoDaEstacao('nao-existe', [], GRADE), null);
  assert.equal(estadoDaEstacao('nao-existe', viajou(['nao-existe']), GRADE), null);
  assert.equal(estadoDaEstacao(undefined, [], GRADE), null);
});

test('faltam só aparece na trancada', () => {
  // discrimina: listar pré-requisito ao lado de estação carimbada é a tela
  // dizer "falta Beta" com o carimbo de Beta já no bilhete
  const p = viajou(['alfa', 'beta']);
  assert.equal(estadoDaEstacao('beta', p, GRADE).estado, ESTADOS.CONCLUIDA);
  assert.deepEqual(estadoDaEstacao('beta', p, GRADE).faltam, []);
  // delta destrancou (beta concluída) → disponível, sem lista do que falta
  assert.equal(estadoDaEstacao('delta', p, GRADE).estado, ESTADOS.DISPONIVEL);
  assert.deepEqual(estadoDaEstacao('delta', p, GRADE).faltam, []);
  // epsilon segue trancada (falta delta) e é ela que lista o que falta
  assert.equal(estadoDaEstacao('epsi', p, GRADE).estado, ESTADOS.TRANCADA);
  assert.deepEqual(estadoDaEstacao('epsi', p, GRADE).faltam, [{ id: 'delta', titulo: 'Delta', linha: 2 }]);
  // e em curso também não lista: a pessoa já está ali dentro
  assert.deepEqual(estadoDaEstacao('delta', iniciarEstacao(p, 'delta', GRADE), GRADE).faltam, []);
});

// ──────────────────────────── baldeações ────────────────────────────

test('baldeação é pré-requisito entre linhas, e só com os dois concluídos', () => {
  assert.equal(baldeacoes([], GRADE).length, 0);
  // alfa (linha 1) → beta (linha 1): mesma linha, não é baldeação
  assert.equal(baldeacoes(viajou(['alfa', 'beta']), GRADE).length, 0);
  // beta (linha 1) → delta (linha 2): baldeação
  const b = baldeacoes(viajou(['alfa', 'beta', 'delta']), GRADE);
  assert.equal(b.length, 1);
  // discrimina: contar o par por estação concluída contaria 2 aqui
  assert.deepEqual(b[0], { de: 'beta', para: 'delta', deLinha: 1, paraLinha: 2 });
});

// ──────────────────────────── resumoDaViagem ────────────────────────────

test('resumo por linha: percentual inteiro e fim da linha', () => {
  const r = resumoDaViagem(viajou(['alfa', 'beta']), GRADE);
  const linha1 = r.linhas.find((l) => l.linha === 1);
  assert.deepEqual({ ...linha1 }, { linha: 1, concluidas: 2, total: 3, percentual: 67, fechada: false });
  // discrimina: percentual com casa decimal (66.66666) ou truncado (66)
  const cheia = resumoDaViagem(viajou(['alfa', 'beta', 'gama']), GRADE);
  const l1 = cheia.linhas.find((l) => l.linha === 1);
  assert.equal(l1.percentual, 100);
  assert.equal(l1.fechada, true);
  assert.equal(cheia.linhasFechadas, 1);
});

test('resumo conta estações, dias de viagem e a próxima estação', () => {
  let p = concluirEstacao(progressoVazio(), 'alfa', '2026-10-01', GRADE);
  p = concluirEstacao(p, 'beta', '2026-10-01', GRADE); // mesmo dia: 1 dia só
  p = concluirEstacao(p, 'gama', '2026-10-02', GRADE);
  const r = resumoDaViagem(p, GRADE);
  assert.equal(r.concluidas, 3);
  assert.equal(r.diasDeViagem, 2, 'duas conclusões no mesmo dia são um dia de viagem');
  assert.deepEqual(r.datasDeViagem, ['2026-10-01', '2026-10-02']);
  // discrimina: próxima estação é a primeira disponível na ordem do catálogo,
  // não a última concluída nem uma escolha aleatória
  assert.deepEqual(r.proximaEstacao, { id: 'delta', titulo: 'Delta', linha: 2 });
  assert.equal(r.situacao, 'open');
  assert.equal(r.terminal, false);
});

test('resumo com tudo travado diz blocked, e nunca done', () => {
  // só o ciclo: nada destranca e nada foi concluído
  const r = resumoDaViagem([], [GRADE[5], GRADE[6]]);
  assert.equal(r.situacao, 'blocked');
  // discrimina: chamar de 'done' um catálogo em que só há ciclo seria uma
  // mentira agradável — "você terminou!" com zero estações
  assert.equal(r.terminal, false);
  assert.equal(r.concluidas, 0);
});

test('terminal só quando a grade inteira fecha', () => {
  const ids = SEM_CICLO.map((c) => c.id);
  const r = resumoDaViagem(viajou(ids), SEM_CICLO);
  assert.equal(r.terminal, true);
  assert.equal(r.situacao, 'done');
  assert.equal(r.proximaEstacao, null);
  const quase = resumoDaViagem(viajou(ids.slice(0, ids.length - 1)), SEM_CICLO);
  assert.equal(quase.terminal, false);
});

test('em curso não conta como concluída no resumo', () => {
  // discrimina: somar emCurso em `concluidas` carimba o bilhete sem palavra da pessoa
  const p = iniciarEstacao(viajou(['alfa']), 'beta', GRADE);
  const r = resumoDaViagem(p, GRADE);
  assert.equal(r.concluidas, 1);
  assert.equal(r.emCurso, 1);
});

test('id fora do catálogo não infla o resumo', () => {
  // discrimina: progresso corrompido no storage não pode fingir viagem maior
  const p = { completed: ['alfa', 'fantasma'], emCurso: [], conclusoes: { alfa: '2026-10-01', fantasma: '2026-10-02' } };
  const r = resumoDaViagem(p, GRADE);
  assert.equal(r.concluidas, 1);
  assert.equal(r.diasDeViagem, 1);
});

test('linhasAbertas diz o que acende no mapa', () => {
  assert.deepEqual(linhasAbertas([], GRADE), [1]);
  assert.deepEqual(linhasAbertas(viajou(['alfa', 'beta']), GRADE), [1, 2]);
});

// ──────────────────────────── transições ────────────────────────────

test('concluir é idempotente: dois toques não criam dois dias', () => {
  // discrimina: quem faz push sem checar cria duplicata no completed, e o
  // resumo mostraria 2 de 5 com uma estação só
  const p1 = concluirEstacao([], 'alfa', '2026-10-01', GRADE);
  const p2 = concluirEstacao(p1, 'alfa', '2026-10-02', GRADE);
  assert.deepEqual(p2.completed, ['alfa']);
  assert.equal(datasDeViagem(p2).length, 1);
  assert.equal(p2.conclusoes.alfa, '2026-10-01', 'a primeira data vale: re-toque não reescreve a história');
  assert.deepEqual(p1, p2, 'o segundo toque não muda nada');
});

test('concluir não é mutável: o progresso anterior sobrevive para o desfazer', () => {
  // discrimina: mutar embaixo da tela quebra o desfazer (o "antes" já mudou)
  const antes = viajou(['alfa']);
  const copia = JSON.parse(JSON.stringify(antes));
  concluirEstacao(antes, 'beta', '2026-10-02', GRADE);
  assert.deepEqual(antes, copia);
});

test('concluir id fora do catálogo é ignorado quando o catálogo é dado', () => {
  const antes = viajou(['alfa']);
  assert.deepEqual(concluirEstacao(antes, 'fantasma', '2026-10-02', GRADE), antes);
});

test('desfazer volta EXATAMENTE ao estado anterior', () => {
  // discrimina: desfazer que esquece de tirar a data de `conclusoes` deixa o
  // dia de viagem contado com a estação já fora do bilhete
  const antes = viajou(['alfa'], '2026-10-01');
  const depois = concluirEstacao(iniciarEstacao(antes, 'gama', GRADE), 'beta', '2026-10-02', GRADE);
  const desfeito = desfazerConclusao(depois, 'beta');
  assert.deepEqual(desfeito.completed, ['alfa']);
  assert.deepEqual(desfeito.conclusoes, { alfa: '2026-10-01' });
  assert.equal(datasDeViagem(desfeito).length, 1);
  // o "em curso" de outra estação não é tocado pelo desfazer desta
  assert.deepEqual(desfeito.emCurso, ['gama']);
  // e desfazer duas vezes não estraga nada
  assert.deepEqual(desfazerConclusao(desfeito, 'beta'), desfeito);
});

test('iniciar não cria dia de viagem (intenção não é avanço)', () => {
  // discrimina: contar o início como dia premiaria abrir o app sem estudar,
  // contra a regra 1 da gamificação
  const p = iniciarEstacao([], 'alfa', GRADE);
  assert.equal(datasDeViagem(p).length, 0);
  assert.equal(resumoDaViagem(p, GRADE).diasDeViagem, 0);
  // iniciar o que já foi concluído não faz nada
  assert.deepEqual(iniciarEstacao(viajou(['alfa']), 'alfa', GRADE), viajou(['alfa']));
});

// ──────────────────────────── marcosNovos ────────────────────────────

test('concluir uma estação gera só a chegada', () => {
  const m = marcosNovos([], viajou(['alfa']), GRADE);
  assert.deepEqual(m, [{ tipo: MARCOS.ESTACAO, id: 'alfa', titulo: 'Alfa', linha: 1 }]);
});

test('fechar a linha gera o fim da linha, e a segunda vez não', () => {
  const antes = viajou(['alfa', 'beta']);
  const depois = concluirEstacao(antes, 'gama', '2026-10-03', GRADE);
  const m = marcosNovos(antes, depois, GRADE);
  assert.deepEqual(m.map((x) => x.tipo), [MARCOS.ESTACAO, MARCOS.FIM_DA_LINHA]);
  assert.deepEqual(m[1], { tipo: MARCOS.FIM_DA_LINHA, linha: 1, concluidas: 3, total: 3 });
  // discrimina: quem não compara com o "antes" celebra o fim da linha toda vez
  // que a pessoa passa por ali — e quem celebra tudo não celebra nada
  const deNovo = marcosNovos(depois, depois, GRADE);
  assert.deepEqual(deNovo, []);
});

test('a primeira baldeação é marco; a segunda não é', () => {
  const antes = viajou(['alfa', 'beta']);
  const primeira = concluirEstacao(antes, 'delta', '2026-10-03', GRADE);
  const m = marcosNovos(antes, primeira, GRADE);
  assert.ok(m.some((x) => x.tipo === MARCOS.PRIMEIRA_BALDEACAO), 'primeira baldeação é marco');
  const bal = m.find((x) => x.tipo === MARCOS.PRIMEIRA_BALDEACAO);
  assert.deepEqual(bal.de, { id: 'beta', titulo: 'Beta', linha: 1 });
  assert.deepEqual(bal.para, { id: 'delta', titulo: 'Delta', linha: 2 });
  // conclui epsilon (alfa linha 1 → epsilon linha 2): outra baldeação, sem marco
  const depois = concluirEstacao(primeira, 'epsi', '2026-10-04', GRADE);
  const m2 = marcosNovos(primeira, depois, GRADE);
  assert.equal(m2.some((x) => x.tipo === MARCOS.PRIMEIRA_BALDEACAO), false);
  // continuam CONTADAS, e cada par entre linhas vale um: beta→delta (1→2) e
  // alfa→epsi (1→2). alfa→beta é mesma linha e delta→epsi é mesma linha.
  assert.deepEqual(
    baldeacoes(depois, GRADE).map((b) => `${b.de}>${b.para}`).sort(),
    ['alfa>epsi', 'beta>delta']
  );
  assert.equal(resumoDaViagem(depois, GRADE).baldeacoesFeitas, 2);
});

test('o Terminal é o último marco, e só aparece uma vez', () => {
  const ids = SEM_CICLO.map((c) => c.id);
  const antes = viajou(ids.slice(0, ids.length - 1));
  const depois = viajou(ids);
  const m = marcosNovos(antes, depois, SEM_CICLO);
  const tipos = m.map((x) => x.tipo);
  // discrimina: a ordem do menor para o maior é o que deixa a tela celebrar o
  // ÚLTIMO; Terminal fora de ordem viraria celebração de estação no fim da grade
  assert.equal(tipos[tipos.length - 1], MARCOS.TERMINAL);
  assert.ok(tipos.includes(MARCOS.FIM_DA_LINHA), 'a última linha fechou junto');
  const t = m.find((x) => x.tipo === MARCOS.TERMINAL);
  assert.equal(t.estacoes, SEM_CICLO.length);
  assert.equal(marcosNovos(depois, depois, SEM_CICLO).length, 0);
});

test('desfazer não produz marco nenhum', () => {
  // discrimina: desfazer que gerasse "estacao" faria a tela celebrar a volta atrás
  const antes = viajou(['alfa']);
  const depois = concluirEstacao(antes, 'beta', '2026-10-02', GRADE);
  assert.deepEqual(marcosNovos(depois, desfazerConclusao(depois, 'beta'), GRADE), []);
});

// ──────────────────────────── a grade real ────────────────────────────

test('na grade real: 35 estações, 7 linhas de 5', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const caminho = fileURLToPath(new URL('../data/catalog.json', import.meta.url));
  const grade = JSON.parse(readFileSync(caminho, 'utf8')).courses;
  assert.equal(grade.length, TOTAL_ESTACOES);
  const r = resumoDaViagem([], grade);
  assert.equal(r.linhas.length, 7);
  assert.ok(r.linhas.every((l) => l.total === 5), 'cada linha tem 5 estações');
  // a primeira estação da fonte está disponível para quem chega do zero
  assert.equal(r.proximaEstacao.id, grade[0].id);
  assert.equal(r.situacao, 'open');
});
