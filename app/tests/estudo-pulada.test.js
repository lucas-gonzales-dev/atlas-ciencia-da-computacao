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

import { comClasse, criarDoc, janelaCom, storageCom, textoDe, todos, esperar } from './hdom.js';
import { duracaoLegivel } from '../core/aulas.js';
import { linhaProgresso } from '../web/aulas-pedacos.js';
import {
  ESTUDO_KEY, abrirAula, aulaNaEstacao, continuarDe, desfazerPulo, estadoDaAula, estudarAula,
  estacaoPercorrida, lerEstudo, primeiraPendente, pularAula, resumoDaEstacao, serializarEstudo
} from '../core/estudo.js';
import { CARTOES_KEY } from '../core/cartoes.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { aulas as AU, jornada as J, inseparavel } from '../core/textos.js';
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
  assert.equal(btns[0].textContent, J.topo.comecarEstacao(alvo.curso.title, alvo.n), 'o primário não saiu da frase da volta sem aula');
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
  // S18a-fix: antes este caso tinha de oferecer uma estação (a única fora da
  // régua, vítima do vídeo dividido) e por isso dizia «nunca a PRIMEIRA». Com o
  // registro de duas estações, não sobra nenhuma: o topo é terminal e não aponta
  // para estação nenhuma — `alvo.curso` é null, e a frase é a do fim da viagem.
  assert.equal(alvo.curso, null, `o topo ainda ofereceu ${alvo.curso?.title} a quem dispensou a rede inteira`);

  // S18a-fix (item 6): o fato medido do catálogo era a ÚNICA estação fora da
  // régua — um vídeo (tMCWr3a-unk) pertence a duas estações ao mesmo tempo,
  // Análise de Algoritmos e Linguagens Formais. Como o registro de estudo é por
  // ID de aula e guardava UMA estação, pular pela segunda tirava a primeira do
  // conjunto das percorridas, e este teste MEDIA O DEFEITO (1 estação sobrando).
  // Agora o registro é de duas estações (`estacao` dona + `tambem`), então
  // percorrer a rede inteira percorre a rede inteira. A trava virou a do conserto:
  // sobra ZERO, e o topo diz terminal.
  const naoPercorridas = CATALOGO.filter((c) => !estacaoPercorrida(e, c.id, Number(INDICE.estacoes[c.id].aulas)));
  assert.equal(naoPercorridas.length, 0, `${naoPercorridas.length} estações fora da régua: o vídeo compartilhado trocou de dono de novo`);
  assert.equal(alvo.modo, 'terminal', `o topo ofereceu ${alvo.curso?.id} de quem percorreu a rede toda`);
});

// ───────────── 3b. o vídeo que mora em duas estações (S18a-fix, item 6) ─────────────

// O par compartilhado, LIDO do catálogo e dos dois JSON de aulas — se a UBL
// publicar outra playlist com outro vídeo em comum, isto acompanha; se o vídeo
// deixar de ser dividido, a primeira asserção abaixo denuncia e o arquivo para.
const COMPARTILHADO = 'tMCWr3a-unk';
const DONAS = CATALOGO.filter((c) =>
  JSON.parse(LER(`data/aulas/${c.slug}.json`)).aulas.some((a) => a.id === COMPARTILHADO));

test('S18a-fix · um vídeo do catálogo pertence a duas estações (a premissa, lida)', () => {
  assert.deepEqual(DONAS.map((c) => c.slug).sort(), ['analise-algoritmos', 'linguagens-formais-automatos'],
    `«${COMPARTILHADO}» não está mais exatamente nessas duas estações: ${DONAS.map((c) => c.slug)}`);
});

test('S18a-fix · tocar pela segunda estação NÃO tira a aula da primeira', () => {
  const [a, b] = DONAS;
  let e = lerEstudo(null);
  e = abrirAula(e, { estacao: a.id, aula: COMPARTILHADO, n: 5 }, Q('08:00'));
  e = abrirAula(e, { estacao: b.id, aula: COMPARTILHADO, n: 7 }, Q('09:00'));

  assert.equal(e.aulas[COMPARTILHADO].estacao, a.id, 'a segunda estação desdonou a primeira');
  assert.deepEqual(e.aulas[COMPARTILHADO].tambem, [b.id], 'a estação nova não entrou na lista');

  // A pergunta é uma função só, e responde para as duas.
  assert.equal(estadoDaAula(e, COMPARTILHADO), 'aberta');
  for (const c of [a, b]) {
    assert.equal(aulaNaEstacao(e, COMPARTILHADO, c.id), true,
      `${c.slug} deixou de ter a aula que a pessoa tocou nela`);
  }
});

test('S18a-fix · as duas estações ficam percorridas ao mesmo tempo', () => {
  // É o caminho de quem cursa a grade inteira: as duas estações têm o vídeo, a
  // pessoa dispensa-o uma vez, e as duas contas têm de fechar.
  const [a, b] = DONAS;
  let e = lerEstudo(null);
  for (const curso of [a, b]) {
    const daEstacao = JSON.parse(LER(`data/aulas/${curso.slug}.json`)).aulas.map((x) => ({ ...x, n: Number(x.n) }));
    for (const aula of daEstacao) {
      e = pularAula(e, { estacao: curso.id, aula: aula.id, n: aula.n }, Q('10:00'));
    }
  }
  const total = (c) => Number(INDICE.estacoes[c.id].aulas);
  assert.equal(estacaoPercorrida(e, a.id, total(a)), true, `${a.slug} ficou aberta por causa do vídeo dividido`);
  assert.equal(estacaoPercorrida(e, b.id, total(b)), true, `${b.slug} ficou aberta por causa do vídeo dividido`);

  // `estudarAula` faz o mesmo que `abrirAula`/`pularAula`: os três acrescentam.
  const so = pularAula(lerEstudo(null), { estacao: a.id, aula: COMPARTILHADO, n: 3 }, Q('11:00'));
  const comEstudo = estudarAula(so, { estacao: b.id, aula: COMPARTILHADO, n: 4 }, Q('12:00'));
  assert.equal(comEstudo.aulas[COMPARTILHADO].estacao, a.id, 'fechar pela segunda estação roubou a dona');
  assert.deepEqual(comEstudo.aulas[COMPARTILHADO].tambem, [b.id]);
});

test('S18a-fix · o round-trip preserva `tambem`, byte a byte', () => {
  // O formato com dois donos é o formato que deriva: ler → escrever → ler tem de
  // dar o mesmo texto, e é isto que impede um storage com `tambem: "logica"` de
  // entrar no app dizendo ser uma lista.
  const [a, b] = DONAS;
  let e = abrirAula(lerEstudo(null), { estacao: a.id, aula: COMPARTILHADO, n: 5 }, Q('08:00'));
  e = abrirAula(e, { estacao: b.id, aula: COMPARTILHADO, n: 7 }, Q('09:00'));

  const bruto = serializarEstudo(e);
  const deNovo = lerEstudo(bruto);
  assert.equal(serializarEstudo(deNovo), bruto, 'o round-trip não devolveu os mesmos bytes');
  assert.deepEqual(deNovo.aulas[COMPARTILHADO].tambem, [b.id], '`tambem` sumiu na leitura');
  assert.equal(deNovo.aulas[COMPARTILHADO].estacao, a.id, 'a dona sumiu na leitura');

  // O que um storage mexido à mão não pode virar: string, duplicata, a própria
  // dona repetida, id vazio. `lerEstudo` saneia, e um registro antigo (sem o
  // campo) sai igual a si mesmo — é a definição de «sem migração» do pedido.
  const sujo = JSON.parse(bruto);
  const antiga = JSON.parse(bruto);
  sujo.aulas[COMPARTILHADO] = { ...sujo.aulas[COMPARTILHADO], tambem: ['x', 'x', a.id, '', null, 7] };
  delete antiga.aulas[COMPARTILHADO].tambem;
  assert.deepEqual(lerEstudo(JSON.stringify(sujo)).aulas[COMPARTILHADO].tambem, ['x'], 'o saneamento deixou passar a forma errada');
  assert.equal('tambem' in lerEstudo(JSON.stringify(antiga)).aulas[COMPARTILHADO], false, 'registro sem tambem ganhou um vazio');
  assert.equal(lerEstudo(JSON.stringify(antiga)).aulas[COMPARTILHADO].estacao, a.id, 'um registro antigo deixou de valer');
});

// ───────────────────── 4. o clique, pela tela de verdade ─────────────────────

/** Sobe a LISTA da primeira estação no mini-DOM, com o estudo que o teste escolher. */
async function lista(bruto = null) {
  const doc = criarDoc();
  // S18a-fix (item 3): `janelaCom` agora tem `scrollY`/`scrollTo`, e o documento
  // tem `defaultView` — é por esse caminho que o gravador do pulo alcança a
  // rolagem, exatamente como na janela do navegador. Sem o vínculo, o teste do
  // foco mediria o dublê e não a tela.
  const win = janelaCom();
  if (bruto) win.localStorage.setItem(ESTUDO_KEY, bruto);
  doc._view = win;
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

// ───────────── 5. o que só o olho via (S18a-fix, itens 1, 2, 3, 4, 5) ─────────────

/* O CSS é lido como TEXTO e dissecado por seletor, como em acabamento.test.js:
   o node não pinta, e o que o Chrome mostrou em 375 px foi uma REGRA ausente.
   A trava do conserto tem de ser a regra, com o valor; a prova de que ela morde
   é apagar a regra e ver o caso cair. */
const CSS_AULAS = () => LER('web/telas/aulas.css').replace(/\/\*[\s\S]*?\*\//g, '');
const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
/** Todo bloco `{...}` do arquivo, com o seletor limpo. Dentro do @media o seletor
 *  é o MESMO de fora, e o que separa os dois é o `sel` exato — por isso o teste
 *  pede a correspondência inteira e não o fim da string. */
function blocos(css, seletor) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const saida = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@')) continue;
    const partes = sel.split(',').map((s) => s.trim());
    if (seletor === undefined || partes.includes(seletor)) saida.push({ sel, corpo: m[2] });
  }
  return saida;
}
/** O bloco DECLARADO com exatamente este seletor — o primeiro dele no arquivo. */
const regra = (css, seletor) => blocos(css, seletor)[0]?.corpo || '';

/** O texto que a pessoa lê num nó (mesma leitura do `textoDo` de fechamento-nucleo). */
const textoDo = (no) => textoDe(no);
const fraseDaLinha = (resumo, lembradas = null) =>
  textoDo(comClasse(linhaProgresso(criarDoc(), resumo, lembradas), /^aulas-progresso-texto$/)[0]);

test('S18a-fix · o título da LISTA não é cortado, e a tela estreita põe o botão embaixo', () => {
  const css = CSS_AULAS();

  // Item 1. A folha continua com o clamp de duas linhas (é a régua do painel de
  // 69 estações, travada em acabamento.test.js); a LISTA tem de DESFAZER ele.
  assert.match(css, /\.aula-titulo-texto\s*\{[^}]*-webkit-line-clamp:\s*2/,
    'o clamp saiu do compartilhado: a folha voltou a cortar título');
  const daLista = regra(css, '.aula-link .aula-titulo-texto');
  assert.ok(daLista, 'não há regra desfazendo o clamp dentro de .aula-link: o título da lista continua cortado em 375 px');
  assert.match(daLista, /display:\s*block/, 'sem sair do -webkit-box o clamp de duas linhas não é desfeito');
  assert.match(daLista, /-webkit-line-clamp:\s*unset/, 'a lista continua espremendo o título em 2 linhas');
  assert.match(daLista, /(?:^|[;\s])line-clamp:\s*unset/, 'o `line-clamp` padrão ficou com o número herdado');
  assert.doesNotMatch(daLista, /overflow:\s*hidden/, 'overflow: hidden recorta o que as linhas ganham');

  // Item 1, a tela estreita: uma coluna só, e o botão desce para a linha de baixo.
  const media = /@media[^{]*\(max-width:\s*59\d[^{]*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(media, 'não há bloco @media abaixo de 600 px para a página de aulas');
  const dentro = media[1];
  assert.match(dentro, /\.aula-item\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    'em 375 px a linha ainda é de duas colunas: o título continua afogado');
  assert.match(dentro, /\.aulas-pular\s*\{[^}]*justify-self:\s*end/,
    'o botão não desceu para baixo da linha em tela estreita');
  // De 600 px para cima nada muda: a grade de quatro colunas é a de sempre.
  assert.match(css, /\.aula-link\s*\{[^}]*grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto/,
    'a grade larga mudou: o pedido era mexer só abaixo de 600 px');
});

test('S18a-fix · o "Já sei isso" é texto discreto, não caixa, e sublinha no hover e no foco', () => {
  const css = CSS_AULAS();
  const pular = regra(css, '.aulas-pular');
  assert.match(pular, /(?:^|[;\s])border:\s*0/, 'voltou a borda: 93 caixas numa coluna de 93 linhas');
  assert.match(pular, /background:\s*none/);
  assert.doesNotMatch(pular, /solid var\(--borda\)/, 'o botão discreto voltou a ser caixa com muro');
  assert.match(pular, /min-height:\s*var\(--alvo-toque\)/, 'sem borda ninguém pode esquecer o alvo de 44 px');
  assert.match(pular, /min-width:\s*var\(--alvo-toque\)/);
  assert.match(pular, /color:\s*var\(--tinta\)/, 'a cor do pulo é a do texto, AA nos dois temas');

  const hover = blocos(css, '.aulas-pular:hover').concat(blocos(css, '.aulas-pular:focus-visible'));
  assert.equal(hover.length >= 1, true, 'sem borda e sem fundo, nada diz que o texto é tocável');
  for (const b of hover) assert.match(b.corpo, /text-decoration:\s*underline/);
  assert.ok(blocos(css, '.aulas-pular:hover').length && blocos(css, '.aulas-pular:focus-visible').length,
    'mouse e teclado precisam do mesmo sinal (o sublinhado)');

  // Na página da aula, a largura do texto — não a linha inteira (343 px no olho).
  const naPagina = regra(css, '.aula .aulas-pular');
  assert.match(naPagina, /align-self:\s*flex-start/, 'o pulo da página da aula continua ocupando a linha toda');
});

test('S18a-fix · depois do clique na lista, o foco fica no botão da MESMA aula e a rolagem não pula', async () => {
  let e = lerEstudo(null);
  e = abrir(e, TRES[1], '08:00');
  const { doc, win, raiz } = await lista(serializarEstudo(e));
  const painel = comClasse(raiz, /^aulas-painel$/)[0];

  win.scrollY = 4200; // a pessoa rolou até a Aula 2 de 93
  const botao = comClasse(
    linhas(raiz).find((l) => l.getAttribute('data-aula') === TRES[1].id).parent,
    /^aulas-pular$/
  )[0];
  painel.dispatch('click', { target: botao });

  // O que o olho mediu: `document.activeElement` era o BODY, e quem usa teclado
  // voltava ao topo de uma página de 93 linhas sem nenhum aviso.
  const ativo = doc.activeElement;
  assert.ok(ativo, 'sem activeElement o foco caiu no body de novo');
  assert.equal(ativo.tag, 'button', `o foco parou em <${ativo.tag}>`);
  assert.equal(ativo.getAttribute('data-aula'), TRES[1].id, 'o foco foi para o botão de outra aula');
  assert.equal(ativo.getAttribute('data-pulo'), 'desfazer', 'o botão focado não é o da nova ação (Desfazer)');
  assert.equal(ativo.textContent, AU.desfazerPulo, 'foco no botão velho, com o texto velho');

  // E a rolagem: o navegador move a viewport ao focar, menos com preventScroll.
  assert.equal(win.scrollY, 4200, `a página pulou para ${win.scrollY}`);
  assert.equal(win._rolagens.some(([x, y]) => y === 4200), true, 'a rolagem não foi devolvida ao lugar de antes');
});

test('S18a-fix · com a Aula 1 pulada, o topo oferece a Aula 2 — nos três modos', () => {
  const progresso = progVazio();
  const resumo = resumoDaViagem(progresso, CATALOGO);
  const tela = (alvo, aulas, indice = INDICE) => {
    const raiz = desenharTopo({
      alvo, catalogo: CATALOGO, progresso: alvo.progressoFix || progresso, resumo,
      estudo: alvo.estudoFix || lerEstudo(null), indice, aulas, embarqueAberto: false
    }, criarDoc());
    const btn = comClasse(raiz, /^botao-primario$/)[0] || comClasse(raiz, /^topo-primario$/)[0];
    return { texto: btn.textContent, href: btn.getAttribute('href') };
  };

  // ── modo 'primeira': nada no aparelho além do pulo. É o caso exato do olho:
  // pularam a Aula 1 de Circuitos, e a Jornada dizia «Começar pela primeira
  // aula». A palavra «primeira» é uma afirmação sobre o número, e era falsa.
  let soPulo = lerEstudo(null);
  soPulo = pularAula(soPulo, { estacao: PRIMEIRA.id, aula: TRES[0].id, n: 1 }, Q('09:00'));
  const aPrimeira = { ...alvoDoTopo(CATALOGO, soPulo, resumo, progresso, INDICE), estudoFix: soPulo };
  assert.equal(aPrimeira.modo, 'primeira', 'premissa perdida: o pulo sozinho não deixou de ser primeira visita');
  assert.equal(aPrimeira.n, 2, `o topo respondeu ${aPrimeira.n} para quem dispensou a Aula 1`);
  const tPrimeira = tela(aPrimeira, AULAS);
  assert.equal(tPrimeira.texto, J.topo.comecar(2));
  assert.equal(tPrimeira.texto.includes('primeira'), false, 'a frase continua afirmando «primeira» sobre a 2ª aula');
  assert.match(tPrimeira.href, /\/aula\/2$/);

  // ── modo 'volta': abriu a Aula 1, pulou, e o ponto de retorno é ela.
  let comToque = lerEstudo(null);
  comToque = abrir(comToque, TRES[0], '08:00');
  comToque = pular(comToque, TRES[0], '09:00');
  const aVolta = { ...alvoDoTopo(CATALOGO, comToque, resumo, progresso, INDICE), estudoFix: comToque };
  assert.equal(aVolta.modo, 'volta');
  assert.equal(aVolta.n, 2, 'a volta ainda oferece a aula que a pessoa acabou de dispensar');
  assert.equal(aVolta.idAula, null, 'a volta guardou o id da aula pulada');
  assert.equal(tela(aVolta, AULAS).texto, AU.continuar(2, AULAS[1].titulo));

  // ── modo 'proxima': viagem marcada sem toque, e a Aula 1 da próxima pulada.
  const marcado = progVazio();
  marcado.completed = [PRIMEIRA.id];
  const resumoMarcado = resumoDaViagem(marcado, CATALOGO);
  const proxima = CATALOGO.find((c) => c.id === resumoMarcado.proximaEstacao.id);
  const aulasProximas = JSON.parse(LER(`data/aulas/${proxima.slug}.json`)).aulas.map((a) => ({ ...a, n: Number(a.n) }));
  let pulaProxima = pularAula(lerEstudo(null), { estacao: proxima.id, aula: aulasProximas[0].id, n: 1 }, Q('09:00'));
  const alvoProx = { ...alvoDoTopo(CATALOGO, pulaProxima, resumoMarcado, marcado, INDICE), estudoFix: pulaProxima };
  assert.equal(alvoProx.modo, 'proxima');
  assert.equal(alvoProx.curso.id, proxima.id);
  assert.equal(alvoProx.n, 2, 'a placa «Começar: <estação> · Aula 1» promete a aula pulada');
  assert.equal(
    tela({ ...alvoProx, progressoFix: marcado }, aulasProximas).texto,
    J.topo.comecarEstacao(proxima.title, 2)
  );

  // A pergunta tem UM dono: a função do núcleo diz o mesmo em os três.
  assert.equal(primeiraPendente(soPulo, PRIMEIRA.id, 93), 2);
  assert.equal(primeiraPendente(comToque, PRIMEIRA.id, 93), 2);
  assert.equal(primeiraPendente(pulaProxima, proxima.id, Number(INDICE.estacoes[proxima.id].aulas)), 2);
});

/* S18a-fix-4 (05/11/2026): a pulada tem MARCA PRÓPRIA. Modelo: o teste de
   fechamento.test.js:540, que lê o CSS como texto e cobra a REGRA, não o dublê.
   O node não pinta, e a classe sem regra é o estado invisível: a linha diria
   «pulada» no leitor de tela e desenharia um círculo igual ao de não-iniciada. */
test('S18a-fix-4 · a marca da aula pulada tem classe própria e o CSS a desenha tracejada', async () => {
  let e = lerEstudo(null);
  e = pular(e, TRES[0], '09:00');
  const { raiz } = await lista(serializarEstudo(e));

  const pulada = linhas(raiz).find((l) => l.getAttribute('data-aula') === TRES[0].id);
  const marcaPulada = todos(pulada, (n) => n.className.split(/\s+/).includes('aula-marca'))[0];
  assert.ok(marcaPulada, 'a linha da pulada perdeu a marca');
  assert.ok(marcaPulada.className.split(/\s+/).includes('aula-marca-pulada'),
    `a marca da pulada saiu com «${marcaPulada.className}»: sem classe própria, o desenho não tem do que pendurar o estado`);

  const vizinha = linhas(raiz).find((l) => l.getAttribute('data-aula') === TRES[1].id);
  const marcaVizinha = todos(vizinha, (n) => n.className.split(/\s+/).includes('aula-marca'))[0];
  assert.equal(marcaVizinha.className.includes('aula-marca-pulada'), false,
    'a marca tracejada saiu em quem não foi pulada: o estado próprio parou de ser próprio');

  // O desenho: tracejado, na cor que já chega do --cor, sem tinta nova (regra 9).
  const css = CSS_AULAS();
  const marca = /\.aula-marca-pulada\s*\{[^}]*border-style:\s*dashed/g;
  assert.ok(marca.test(css),
    'web/telas/aulas.css não desenha a marca da pulada: a folha, a lista e a página divergiriam, porque as três montam `aula-marca-<estado>`');
  const daPulada = regra(css, '.aula-marca-pulada');
  assert.equal(/(?:^|[;\s])(?:border|color|background)\s*:/.test(daPulada), false,
    'a marca da pulada escreveu cor ou borda à mão: o pedido era o tracejado, e o --cor da linha já é a tinta');
  assert.doesNotMatch(css, /#/, 'hex no CSS de aulas: foge do tokens.css e do tema escuro');

  // A tela estreita, no mesmo arquivo: a duração cai na COLUNA DO TÍTULO, não na
  // linha inteira (que a deixava embaixo do anel, longe do que ela descreve).
  const media = /@media[^{]*\(max-width:\s*59\d[^{]*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(media, 'não há bloco @media abaixo de 600 px para a página de aulas');
  assert.match(media[1], /\.aula-duracao\s*\{[^}]*grid-column:\s*3(?![0-9])/,
    'em 375 px a duração voltou para `1 / -1` e cai embaixo da marca, não do título');
});

test('S18a-fix · "faltam" não conta a pulada, e a linha diz quantas foram dispensadas', () => {
  // A estação inteira pulada: percorrida, e o «faltam» desaparece — não é um
  // zero formatado, é a régua calando, como o `lembradas` a zero.
  const bruto = JSON.parse(LER(`data/aulas/${PRIMEIRA.slug}.json`)).aulas.map((a) => ({ ...a, n: Number(a.n) }));
  const soma = (lista) => lista.reduce((t, a) => t + (Number(a.duracaoS) || 0), 0);

  let e = lerEstudo(null);
  for (const a of bruto.slice(0, 2)) e = pularAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q('09:00'));
  const r = resumoDaEstacao(e, PRIMEIRA.id, bruto);
  assert.equal(r.puladas, 2, 'o resumo não separa as puladas');
  assert.equal(r.segundosRestantes, soma(bruto) - soma(bruto.slice(0, 2)),
    'a pulada continua dentro do que falta fazer');

  const doc = criarDoc();
  const frase = textoDo(comClasse(linhaProgresso(doc, r), /^aulas-progresso-texto$/)[0]);
  // S20b-1a (item 2): a duração na frase sai com espaço NÃO SEPARÁVEL, e
  // `duracaoLegivel` devolve com espaço comum — as duas funções têm donos
  // diferentes, então o esperado passa pela mesma regra do núcleo.
  assert.equal(frase, `0 de ${bruto.length} aulas estudadas · 2 puladas · faltam ~${inseparavel(duracaoLegivel(r.segundosRestantes))}`,
    `a linha da lista saiu assim: ${frase}`);

  // Singular e plural, e o pedaço que some no zero.
  let uma = pularAula(lerEstudo(null), { estacao: PRIMEIRA.id, aula: bruto[0].id, n: 1 }, Q('09:00'));
  const rUma = resumoDaEstacao(uma, PRIMEIRA.id, bruto);
  assert.equal(textoDo(comClasse(linhaProgresso(criarDoc(), rUma), /^aulas-progresso-texto$/)[0]),
    `0 de ${bruto.length} aulas estudadas · 1 pulada · faltam ~${inseparavel(duracaoLegivel(rUma.segundosRestantes))}`,
    '«1 puladas» é erro de concordância numa placa');

  let todas = lerEstudo(null);
  for (const a of bruto) todas = pularAula(todas, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q('09:00'));
  const rToda = resumoDaEstacao(todas, PRIMEIRA.id, bruto);
  assert.equal(rToda.segundosRestantes, 0, 'com tudo pulado ainda sobra tempo a fazer?');
  const fraseToda = textoDo(comClasse(linhaProgresso(criarDoc(), rToda), /^aulas-progresso-texto$/)[0]);
  assert.equal(fraseToda, `0 de ${bruto.length} aulas estudadas · ${bruto.length} puladas`,
    `estação toda dispensada não é percorrida na linha: ${fraseToda}`);
  assert.equal(fraseToda.includes('faltam'), false, 'a linha diz o que falta quando não falta nada');

  // E a folha e a lista dizem a MESMA frase, da mesma base (regra 9): as duas
  // chamam a mesma `linhaProgresso`, e o pulo aparece nas duas.
  assert.equal(
    textoDo(comClasse(linhaProgresso(criarDoc(), rUma, 1), /^aulas-progresso-texto$/)[0]),
    `0 de ${bruto.length} aulas estudadas · 1 pulada · 1 lembrada depois · faltam ~${inseparavel(duracaoLegivel(rUma.segundosRestantes))}`
  );
});
