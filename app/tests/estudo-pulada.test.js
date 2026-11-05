// Projeto Atlas — S18a (05/11/2026): o estado PULADA, o "Já sei isso".
//
// POR QUE EXISTE: quem já sabe uma parte da disciplina precisa poder dizer isso
// sem fingir que estudou. Este arquivo trava a palavra dela nos dois sentidos:
// o pulo EXISTE e vale como declaração, e o pulo NÃO VALE como medida — não é
// estudada, não cria cartão, não enche o mapa. A metade de baixo é a que um
// verde sem atenção esconde: se qualquer consumidor do estado treats 'pulada'
// como 'estudada', o princípio 1 do desenho ("Progresso é verificado, não
// declarado") morre por um botão.
//
// DADOS NASCIDOS DE FUNÇÃO, NUNCA OBJETO ESCRITO À MÃO (o pedido manda, e a
// casa já apanhou disso): todo estudo aqui sai de `abrirAula`, `estudarAula` e
// `pularAula`, com o formato de data que o HE_QUANDO do núcleo aceita. Um
// registro literal inventaria um formato que a tela nunca produz, e o teste
// provaria o literal.
//
// O CAMINHO DO APP, não a peça no vácuo: o caso do clique sobe a tela real
// (web/telas/aulas.js) no mini-DOM, com painel, botão e repintura — a lição da
// S16c, escrita a vermelho depois da folha que desenhava no teste e nada no
// fio. A página da aula (web/telas/aula.js) usa a MESMA peça compartilhada
// (acaoPularAula/ligarPuloDeAula), então clicar uma vez na peça é clicar nas
// duas telas; o que difere — o botão ao lado do Assistir — é conferido no
// olho, não aqui.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { comClasse, criarDoc, storageCom, textoDe, todos, esperar } from './hdom.js';
import {
  ESTUDO_KEY, abrirAula, continuarDe, desfazerPulo, estadoDaAula, estudarAula,
  estacaoPercorrida, lerEstudo, pularAula, serializarEstudo
} from '../core/estudo.js';
import { CARTOES_KEY } from '../core/cartoes.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { aulas as AU, jornada as J } from '../core/textos.js';
import { resumoDaViagem } from '../core/viagem.js';
import { alvoDoTopo, desenharTopo } from '../web/telas/jornada-topo.js';
import { montar as montarLista } from '../web/telas/aulas.js';

const RAIZ = new URL('../', import.meta.url);
const LER = (rel) => readFileSync(fileURLToPath(new URL(rel, RAIZ)), 'utf8');
const CATALOGO = JSON.parse(LER('data/catalog.json')).courses;
const INDICE = JSON.parse(LER('data/aulas/indice.json'));

// Primeira estação da Linha 1 e a PRÓXIMA dela, ambas lidas — se a grade mudar
// de ordem, este arquivo acompanha; se alguém fixar um slug, ele denuncia.
const PRIMEIRA = CATALOGO.find((c) => Number(c.stage) === 1);
const AULAS = JSON.parse(LER(`data/aulas/${PRIMEIRA.slug}.json`)).aulas.map((a) => ({ ...a, n: Number(a.n) }));
const TRES = AULAS.slice(0, 3);
const progVazio = () => ({ versao: 1, completed: [], emCurso: [], conclusoes: {}, iniciadas: {}, baldeacoes: [], revisoes: [] });

// `aaaa-mm-ddThh:mm` cru: o HE_QUANDO (estudo.js:55) rejeita ISO com segundos e
// fuso EM SILÊNCIO — um formato chutado aqui produziria um estudo vazio verde.
const Q = (h) => `2026-11-04T${h}`;
const abrir = (e, a, h) => abrirAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q(h));
const fechar = (e, a, h) => estudarAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q(h));
const pular = (e, a, h) => pularAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q(h));

/** Eixos da primeira estação com este estudo, contra o índice REAL. */
const eixoDe = (estudo, hoje = '2026-11-04') => eixosDaEstacao(PRIMEIRA.id, {
  estudo, cartoes: null, indice: INDICE, progresso: progVazio(), hoje
});

// ───────────────────── 1. pulada NÃO é estudada ─────────────────────

test('S18a · o pulo grava a declaração e nenhuma medida: sem estudadaEm, sem abrir, sem ultima', () => {
  let e = lerEstudo(null);
  e = pular(e, TRES[0], '09:00');
  const r = e.aulas[TRES[0].id];
  assert.equal(estadoDaAula(e, TRES[0].id), 'pulada', 'o estado não saiu pulada');
  assert.equal(r.estudadaEm, undefined, 'pulada com estudadaEm é a pessoa "tendo estudado" por um botão que estudou nada');
  assert.equal(r.abertaEm, undefined, 'o pulo não abre aula: quem pula não esteve nela');
  assert.equal(e.ultima, null, 'pular não move o ponto de retorno de ninguém');
  // Idempotente: o puladaEm da primeira vez não se reescreve (toque duplo).
  const d = pular(e, TRES[0], '18:00');
  assert.equal(d.aulas[TRES[0].id].puladaEm, r.puladaEm, 'o segundo toque reescreveu a data da primeira declaração');
});

test('S18a · a pulada não conta como estudada no eixo, e o cartão não nasce dela', () => {
  let e = lerEstudo(null);
  e = fechar(e, TRES[0], '08:00');
  e = pular(e, TRES[1], '09:00');
  const medido = eixoDe(e);
  assert.equal(medido.estudadas, 1, 'a pulada entrou na conta de estudadas');
  assert.equal(medido.total, INDICE.estacoes[PRIMEIRA.id].aulas, 'o total não veio do índice real');
  // 1 de 93: preenchimento é a fração EXATA medida, não o desenho.
  assert.equal(medido.preenchimento, 1 / 93, `preenchimento ${medido.preenchimento} ≠ 1/93`);

  // "não cria cartão" na porta onde o cartão nasce: o pulo é um botão, o cartão
  // é do fechamento. A régua é o storage — um arquivo de cartões criado pelo
  // pulo seria a medida inventada pela declaração.
  const storage = storageCom({ [ESTUDO_KEY]: serializarEstudo(e) });
  assert.equal(storage.getItem(CARTOES_KEY), null, 'o estudo da pulada carrega um arquivo de cartões que ninguém escreveu');
  // E o núcleo que cria cartão recusa a pulada por construção: ela não tem o
  // fecho que o formulário do fechamento produz.
  const refeito = lerEstudo(serializarEstudo(e));
  assert.equal(refeito.aulas[TRES[1].id].recordacao, undefined, 'a pulada gravou recordação de fechamento');
});

test('S18a · o continuarDe pula a pulada e oferece o buraco à frente', () => {
  let e = lerEstudo(null);
  e = fechar(e, TRES[0], '08:00');
  e = pular(e, TRES[1], '09:00');
  const r = continuarDe(e, PRIMEIRA.id, AULAS);
  assert.equal(r.aula.n, 3, `a retomada ofereceu a Aula ${r.aula.n}: 'já sei isso' é a declaração mais explícita de que não falta nada`);
  assert.equal(r.motivo, 'ultima-aberta');
  // E a pulada do fim da fila não arrasta a retomada para fora da estação:
  // fechada 1 e 2, pulada 3 → o próximo buraco é a 4.
  let f = lerEstudo(null);
  f = fechar(f, TRES[0], '08:00');
  f = fechar(f, TRES[1], '08:30');
  f = pular(f, TRES[2], '09:00');
  assert.equal(continuarDe(f, PRIMEIRA.id, AULAS).aula.n, 4, 'a pulada virou frente');
});

test('S18a · o desfazer devolve a aula ao que ela era: pulada sozinha some, aberta volta a aberta', () => {
  let e = lerEstudo(null);
  e = pular(e, TRES[0], '09:00');
  let d = desfazerPulo(e, TRES[0].id);
  assert.equal(estadoDaAula(d, TRES[0].id), 'nao-iniciada', 'desfazer deixou rastro');
  assert.equal(d.aulas[TRES[0].id], undefined, 'o registro vazio ficou no estudo e vai reaparecer no storage');

  let a = lerEstudo(null);
  a = abrir(a, TRES[1], '08:00');
  a = pular(a, TRES[1], '09:00');
  assert.equal(estadoDaAula(a, TRES[1].id), 'pulada');
  const voltou = desfazerPulo(a, TRES[1].id);
  assert.equal(estadoDaAula(voltou, TRES[1].id), 'aberta', 'desfazer um pulo apagou a abertura que era anterior a ele');
});

test('S18a · pulo em cima de fecho: continua estudada, e o desfazer não apaga o fecho', () => {
  let e = lerEstudo(null);
  e = fechar(e, TRES[0], '08:00');
  const antes = e.aulas[TRES[0].id].estudadaEm;
  e = pular(e, TRES[0], '09:00');
  assert.equal(estadoDaAula(e, TRES[0].id), 'estudada', 'um toque apagou um estudo medido — a escada é na ordem contrária');
  assert.equal(eixoDe(e).estudadas, 1, 'a pulada em cima do fecho sumiu da conta do eixo');
  const d = desfazerPulo(e, TRES[0].id);
  assert.equal(estadoDaAula(d, TRES[0].id), 'estudada', 'desfazer o pulo levou o fecho junto');
  assert.equal(d.aulas[TRES[0].id].estudadaEm, antes, 'a data do fecho mudou no vaivém');
});

test('S18a · round-trip: serializar e reler preserva a pulada', () => {
  let e = lerEstudo(null);
  e = pular(e, TRES[0], '09:00');
  e = fechar(e, TRES[1], '10:00');
  const bruto = serializarEstudo(e);
  const deVolta = lerEstudo(bruto);
  assert.equal(estadoDaAula(deVolta, TRES[0].id), 'pulada', 'o formato descarta a pulada na leitura');
  assert.equal(deVolta.aulas[TRES[0].id].puladaEm, e.aulas[TRES[0].id].puladaEm);
  assert.equal(serializarEstudo(deVolta), bruto, 'escrever o lido deriva o storage (a casa não aceita deriva)');
});

// ───────────────────── 2. a régua da percorrida ─────────────────────

test('S18a · percorrida com puladas: feita é estudada OU pulada; toda pulada é percorrida com preenchimento 0', () => {
  const total = INDICE.estacoes[PRIMEIRA.id].aulas;
  assert.equal(total, AULAS.length, 'o índice e o arquivo da estação divergem — rever a fixture');

  // 92 fechadas + a 93 pulada: percorrida, 92 estudadas, cor sobre as estudadas.
  let e = lerEstudo(null);
  for (const a of AULAS.slice(0, 92)) e = fechar(e, a, '10:00');
  e = pular(e, AULAS[92], '11:00');
  const r = eixoDe(e);
  assert.equal(r.estagio, 'percorrida', '92 de 93 + 1 pulada não fechou a estação');
  assert.equal(r.estudadas, 92, 'a pulada inflou a conta de estudadas');
  assert.equal(r.preenchimento, 92 / 93, `o preenchimento encheu com o pulo: ${r.preenchimento}`);

  // TODA pulada: 'percorrida' SEM preenchimento — o mapa não finge.
  let p = lerEstudo(null);
  for (const a of AULAS) p = pular(p, a, '09:00');
  const t = eixoDe(p);
  assert.equal(t.estagio, 'percorrida', 'a estação toda pulada caiu para embarcada — a declaração sumiu do mapa');
  assert.equal(t.preenchimento, 0, 'a estação toda pulada encheu o mapa sem medida nenhuma');
  assert.equal(t.cor, 0, 'carimbo sem medição saiu colorido');
  assert.equal(estacaoPercorrida(p, PRIMEIRA.id, total), true);

  // O meio do caminho: 1 pulada e nada estudado é 'embarcada' (tocou, não enche).
  let m = lerEstudo(null);
  m = pular(m, TRES[0], '09:00');
  assert.equal(eixoDe(m).estagio, 'embarcada', 'o pulo não é toque para o mapa');
});

// ───────────────────── 3. o topo e a estação 100% estudada ─────────────────────

test('S18a · o topo com a estação inteira estudada não oferece aula dela, e oferece a primeira da próxima', () => {
  let e = lerEstudo(null);
  for (const a of AULAS) {
    e = abrir(e, a, '08:00');
    e = fechar(e, a, '10:00');
  }
  const progresso = progVazio();
  const resumo = resumoDaViagem(progresso, CATALOGO);
  // A premissa do defeito: sem carimbo, o resumo cru AINDA chama esta estação
  // de próxima — é por isso que o topo tinha de olhar a régua da percorrida.
  assert.equal(resumo.proximaEstacao.id, PRIMEIRA.id, 'a fixture perdeu o defeito: a próxima já não é a estudada');

  const alvo = alvoDoTopo(CATALOGO, e, resumo, progresso, INDICE);
  assert.equal(alvo.modo, 'proxima', `modo ${alvo.modo}: o topo ficou na volta de uma estação sem o que continuar`);
  assert.equal(alvo.curso.id !== PRIMEIRA.id, true, 'o topo apontou para a estação que a pessoa acabou de terminar');
  assert.equal(alvo.n, 1);

  const doc = criarDoc();
  const raiz = desenharTopo({
    alvo, catalogo: CATALOGO, progresso, resumo, estudo: e, indice: INDICE,
    aulas: AULAS, embarqueAberto: false
  }, doc);
  const btns = comClasse(raiz, /^botao-primario$/);
  assert.equal(btns.length, 1, `${btns.length} primários na volta da estação percorrida`);
  assert.equal(btns[0].textContent, J.topo.comecarEstacao(alvo.curso.title), 'o primário não saiu da frase da volta sem aula');
  assert.equal(btns[0].getAttribute('href'), `#/estacao/${alvo.curso.slug}/aula/1`, 'o primário não leva à primeira aula da próxima');
  assert.equal(textoDe(raiz).includes(AU.continuar(93, '')), false, 'o topo ofereceu «Continuar» de uma aula já estudada');

  // A estação percorrida NÃO vira concluída no progresso: quem marca é a pessoa.
  assert.deepEqual(progresso.completed, [], 'o cálculo do topo escreveu no progresso');
});

test('S18a · pulando a rede inteira, o topo nunca oferece a primeira aula dispensada', () => {
  // Toda aula de toda estação pulada, cada uma na SUA estação — é o que a tela
  // passa em `data-estacao` quando a pessoa percorre a fila inteira.
  let e = lerEstudo(null);
  for (const curso of CATALOGO) {
    const daEstacao = JSON.parse(LER(`data/aulas/${curso.slug}.json`)).aulas;
    for (const a of daEstacao) {
      e = pularAula(e, { estacao: curso.id, aula: a.id, n: Number(a.n) }, Q('09:00'));
    }
  }
  const progresso = progVazio();
  const alvo = alvoDoTopo(CATALOGO, e, resumoDaViagem(progresso, CATALOGO), progresso, INDICE);

  // O que o pedido proíbe, na frase: «Começar pela primeira aula» de Circuitos
  // Digitais para quem acabou de dispensar as 93 aulas dela.
  assert.equal(alvo.modo !== 'primeira', true, 'a J1 voltou para quem pulou a rede inteira');
  assert.equal(alvo.curso.id !== PRIMEIRA.id, true, 'o topo ofereceu a estação que a pessoa percorreu por inteiro');

  // E o fato medido do catálogo, que torna este caso a ÚNICA estação fora da
  // régua: um vídeo (tMCWr3a-unk) pertence a duas estações ao mesmo tempo
  // — Análise de Algoritmos e Linguagens Formais. O registro de estudo é por
  // ID de aula e guarda UMA estação, então pular pela segunda tira a primeira
  // do conjunto das percorridas. O topo cai nela, e é o comportamento certo
  // para o que o aparelho sabe. Fica dito, não consertado: dividir o registro
  // por (estação, aula) é decisão de núcleo para outra fatia.
  const naoPercorridas = CATALOGO.filter((c) => !estacaoPercorrida(e, c.id, Number(INDICE.estacoes[c.id].aulas)));
  assert.equal(naoPercorridas.length, 1, `${naoPercorridas.length} estações fora da régua — o vídeo compartilhado mudou de dono?`);
  assert.equal(alvo.curso.id, naoPercorridas[0].id, 'o topo e a régua divergem na estação que sobrou');
});

// ───────────────────── 4. o clique, pela tela de verdade ─────────────────────

/** Sobe a LISTA da primeira estação no mini-DOM, com o estudo que o teste escolher. */
async function lista(bruto = null) {
  const doc = criarDoc();
  const win = {
    localStorage: storageCom(bruto ? { [ESTUDO_KEY]: bruto } : {}),
    addEventListener: () => {}, removeEventListener: () => {}, setTimeout: () => 0
  };
  const raiz = doc.createElement('div');
  const instancia = await montarLista(raiz, {
    document: doc, window: win,
    catalogo: Promise.resolve({ courses: CATALOGO }),
    folha: PRIMEIRA.slug,
    buscarAulas: async () => ({ ok: true, status: 200, json: async () => JSON.parse(LER(`data/aulas/${PRIMEIRA.slug}.json`)) })
  });
  await esperar();
  return { doc, win, raiz, instancia };
}

const linhas = (raiz) => todos(raiz, (n) => n.tag === 'a' && n.getAttribute('data-aula') !== null && n.parent?.tag === 'li');

test('S18a · o clique em "Já sei isso" grava, repinta sem recarregar, e o desfazer volta', async () => {
  let e = lerEstudo(null);
  e = abrir(e, TRES[0], '08:00');
  const { win, raiz } = await lista(serializarEstudo(e));
  const painel = comClasse(raiz, /^aulas-painel$/)[0];
  assert.ok(painel, 'a lista não montou o painel onde o pulo é amarrado');

  // O botão existe NA LINHA da aula aberta, com o nome da aula no acessível.
  const linha1 = linhas(raiz).find((l) => l.getAttribute('data-aula') === TRES[0].id);
  const botao = comClasse(linha1.parent, /^aulas-pular$/)[0];
  assert.ok(botao, 'a linha da aula aberta não ofference o "Já sei isso"');
  assert.equal(botao.textContent, AU.pular);
  assert.equal(botao.getAttribute('aria-label'), AU.pularAula(TRES[0].n, TRES[0].titulo), 'o botão não nomeia a aula dele na lista');
  assert.equal(String(botao.className).includes('botao-primario'), false, 'o pulo virou primário: o app preferindo a recusa ao estudo');

  const antesHTML = textoDe(painel);
  painel.dispatch('click', { target: botao });

  // GRAVOU no mesmo storage, no formato que o núcleo lê.
  const gravado = lerEstudo(win.localStorage.getItem(ESTUDO_KEY));
  assert.equal(estadoDaAula(gravado, TRES[0].id), 'pulada', 'o clique não gravou a declaração');
  assert.equal(win.localStorage.getItem(CARTOES_KEY), null, 'o pulo criou o arquivo de cartões');

  // REPINTOU sem recarregar: a mesma tela, agora com «Pulada» e «Desfazer».
  const painelDepois = comClasse(raiz, /^aulas-painel$/)[0];
  const linhaDepois = linhas(painelDepois).find((l) => l.getAttribute('data-aula') === TRES[0].id);
  assert.ok(linhaDepois, 'a repintura perdeu a linha da aula');
  const leitor = comClasse(linhaDepois, /^aula-estado$/)[0];
  assert.equal(textoDe(leitor), AU.estados.pulada, `a linha diz «${textoDe(leitor)}», não «${AU.estados.pulada}»`);
  assert.notEqual(textoDe(painelDepois), antesHTML, 'a tela não se redesenhou no clique');
  const desfazer = comClasse(linhaDepois.parent, /^aulas-pular-desfazer$/)[0];
  assert.ok(desfazer, 'a pulada não trocou o "Já sei isso" pelo "Desfazer"');
  assert.equal(desfazer.textContent, AU.desfazerPulo);

  // E o desfazer, pelo mesmo fio: volta ao que era, sem mentir na linha.
  painelDepois.dispatch('click', { target: desfazer });
  const deVolta = lerEstudo(win.localStorage.getItem(ESTUDO_KEY));
  assert.equal(estadoDaAula(deVolta, TRES[0].id), 'aberta', 'desfazer o pulo pela tela apagou a abertura');
});

test('S18a · aula estudada NÃO ganha botão nenhum, e a pulada da linha não tem href de aula', async () => {
  let e = lerEstudo(null);
  e = fechar(e, TRES[0], '08:00');
  e = pular(e, TRES[1], '09:00');
  const { raiz } = await lista(serializarEstudo(e));
  const achadas = linhas(raiz);
  const l0 = achadas.find((l) => l.getAttribute('data-aula') === TRES[0].id);
  assert.equal(comClasse(l0.parent, /^aulas-pular$/).length, 0, 'um botão ao lado de quem fechou a aula dá a ela um jeito de apagar o estudo com um toque');
  const l1 = achadas.find((l) => l.getAttribute('data-aula') === TRES[1].id);
  const pulo = comClasse(l1.parent, /^aulas-pular$/)[0];
  assert.equal(pulo.tag, 'button', 'link que executa ação: a lista do proibido');
  assert.equal(pulo.getAttribute('href'), null);
  assert.equal(pulo.getAttribute('type'), 'button');
});
