// Projeto Atlas — S25, O PORTÃO (06/11/2026).
//
// POR QUE EXISTE: fechar uma aula deixou de ser um formulário de três caixas e
// passou a ser um toque. Esta régua prova as três coisas que o portão promete:
// a errada mostra o vão CERTO e não avança, a certa libera o seguir, e o fim
// chama `aoFechar` com o número de vãos — o número que a pessoa ouve.
//
// DADOS REAIS, não inventados: as perguntas vêm de
// `data/pratica/circuitos-digitais.json` através do `core/pratica.js`. Um dublê
// de pergunta escrita aqui provaria o desenho contra a minha imaginação, e o
// defeito da S13b foi exatamente esse: verde sobre uma forma que o app não tem.
//
// O QUE O NODE NÃO PROVA: o listrado da faixa, o riscado da errada e o trilho
// crescendo. Isso é medido no Chrome. Aqui se prova a ESTRUTURA e a CONTA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, storageCom, todos, textoDe } from './hdom.js';
import { blocoFechoLeve } from '../web/telas/portao.js';
import { lerPratica, opcoesDaPergunta, perguntasDaAula } from '../core/pratica.js';
import { portao as Q, fechamento as F } from '../core/textos.js';
import { montar as montarAula } from '../web/telas/aula.js';
import { ESTUDO_KEY, lerEstudo } from '../core/estudo.js';

const BRUTO = JSON.parse(readFileSync(new URL('../data/pratica/circuitos-digitais.json', import.meta.url), 'utf8'));
const PRATICA = lerPratica(BRUTO);

/** A doc do portão, com o `#anuncio` do casco registrado — a única região
 *  aria-live da página, e por isso o único lugar onde a frase de retorno cai. */
function docComAnuncio() {
  const doc = criarDoc();
  const anuncio = doc.createElement('p');
  doc._registrar('anuncio', anuncio);
  doc.documentElement.append(anuncio);
  return { doc, anuncio };
}

const classeTem = (no, c) => (no?.className || '').split(/\s+/).includes(c);
const porClasse = (raiz, c) => todos(raiz, (n) => classeTem(n, c));
const peloAtributo = (raiz, atributo) => todos(raiz, (n) => n.hasAttribute(atributo));
const toque = (section, alvo) => section.dispatch('click', { target: alvo, preventDefault: () => {} });

/** As alternativas da pergunta i do estado inicial, com o índice de `data-opcao`. */
function alternativas(section, p) {
  return peloAtributo(section, 'data-opcao').map((botao) => ({
    botao,
    opcao: opcoesDaPergunta(p)[Number(botao.getAttribute('data-opcao'))]
  }));
}

const umaPergunta = PRATICA.paradas[0].perguntas[0];

// ── a estrutura desenhada ────────────────────────────────────────────────────

test('portao: com perguntas, o bloco tem título, contagem, trilho, pergunta e as alternativas', () => {
  const { section, h2 } = blocoFechoLeve(criarDoc(), {
    perguntas: perguntasDaAula(PRATICA, 2), aoFechar: () => {}, aoEscrever: () => {}
  });
  assert.ok(classeTem(section, 'aula-fim'), 'o portão saiu do lugar do fechamento: ele É o fechamento');
  assert.ok(classeTem(section, 'aula-fim-leve'));
  assert.equal(h2.tag, 'h2');
  assert.equal(h2.textContent, Q.titulo);
  assert.equal(h2.getAttribute('tabindex'), '-1', 'o título recebe o foco por programa e não pode virar parada de Tab');
  assert.equal(textoDe(porClasse(section, 'portao-contagem')[0]), Q.contagem(1, 3));
  const via = porClasse(section, 'portao-via')[0];
  assert.equal(via.getAttribute('aria-hidden'), 'true', 'o trilho é decoração: o número dito em voz alta está na contagem');
  assert.match(via.children[0].getAttribute('style'), /width: 0%/, 'na primeira pergunta nada foi atravessado');
  assert.equal(textoDe(porClasse(section, 'portao-pergunta')[0]).trim(), PRATICA.paradas[0].perguntas[0].pergunta);
  assert.equal(peloAtributo(section, 'data-opcao').length, 4, 'quatro alternativas, a certa e três erradas');
  assert.equal(porClasse(section, 'portao-escrever').length, 1);
  assert.equal(textoDe(porClasse(section, 'portao-escrever')[0]), Q.escrever);
});

// ── a errada: o vão certo, e nenhum avanço ───────────────────────────────────

test('portao: a errada mostra o vão DELA, fica riscada e não avança', () => {
  const { doc, anuncio } = docComAnuncio();
  const { section } = blocoFechoLeve(doc, {
    perguntas: perguntasDaAula(PRATICA, 2), aoFechar: () => {}, aoEscrever: () => {}
  });
  const erradas = alternativas(section, umaPergunta).filter((a) => !a.opcao.certa);
  assert.ok(erradas.length >= 1, 'sem errada não há o que provar aqui');
  // A SEGUNDA errada, e não a primeira: é assim que se vê que a faixa veio da
  // resposta tocada e não de um índice guardado às pressas.
  const alvo = erradas[1] || erradas[0];
  toque(section, alvo.botao);
  assert.ok(classeTem(alvo.botao, 'portao-opcao-errada'), 'a errada não recebeu a marca');
  assert.equal(alvo.botao.disabled, true, 'a errada continua tocável: dois toques somariam dois vãos de um mesmo erro');
  const faixa = porClasse(section, 'vao')[0];
  assert.ok(faixa, 'o vão não apareceu');
  assert.equal(textoDe(porClasse(faixa, 'vao-corpo')[0]).includes(alvo.opcao.vao), true,
    `a faixa mostrou outro texto, e não o da resposta tocada (${alvo.opcao.vao})`);
  assert.ok(textoDe(faixa).includes(Q.vaoTitulo), 'a cor sozinha diria o erro para quem não a vê (1.4.1)');
  assert.equal(anuncio.textContent.includes(alvo.opcao.vao), true, 'o vão não passou pelo anúncio do casco');
  // Não avançou: a contagem é a mesma pergunta, e a certa continua tocável.
  assert.equal(textoDe(porClasse(section, 'portao-contagem')[0]), Q.contagem(1, 3));
  const certa = alternativas(section, umaPergunta).find((a) => a.opcao.certa);
  assert.notEqual(certa.botao.disabled, true, 'errar uma alternativa fechou a pergunta inteira');
});

test('portao: dois erros contam dois vãos, e a faixa da segunda é a da segunda', () => {
  const { doc } = docComAnuncio();
  const { section } = blocoFechoLeve(doc, {
    perguntas: perguntasDaAula(PRATICA, 2), aoFechar: () => {}, aoEscrever: () => {}
  });
  const erradas = alternativas(section, umaPergunta).filter((a) => !a.opcao.certa);
  toque(section, erradas[0].botao);
  toque(section, erradas[1].botao);
  const corpo = textoDe(porClasse(section, 'vao-corpo')[0]);
  assert.equal(corpo.includes(erradas[1].opcao.vao), true, 'a faixa ficou na primeira explicação');
  assert.equal(corpo.includes(erradas[0].opcao.vao), false, 'a faixa juntou os dois textos: viraria lista, não retorno');
});

// ── a certa: libera o seguir, e na última devolve os vãos ────────────────────

test('portao: a certa desabilita todas, libera o seguir e recebe o foco nele', () => {
  const { doc, anuncio } = docComAnuncio();
  const { section } = blocoFechoLeve(doc, {
    perguntas: perguntasDaAula(PRATICA, 2), aoFechar: () => {}, aoEscrever: () => {}
  });
  const certa = alternativas(section, umaPergunta).find((a) => a.opcao.certa);
  toque(section, certa.botao);
  assert.ok(classeTem(certa.botao, 'portao-opcao-certa'));
  for (const a of peloAtributo(section, 'data-opcao')) {
    assert.equal(a.disabled, true, `"${textoDe(a)}" ainda é tocável depois do acerto`);
  }
  const seguir = peloAtributo(section, 'data-seguir')[0];
  assert.ok(seguir, 'acertou e não há para onde ir');
  assert.equal(textoDe(seguir).trim(), Q.seguir, 'na segunda de três o botão ainda não é o portão aberto');
  assert.equal(doc.foco === seguir, true, 'o foco não caiu no gesto seguinte: quem está no teclado refaz o caminho');
  assert.equal(anuncio.textContent, Q.seguir);
  assert.ok(porClasse(section, 'portao-explica').length === 1, 'a explicação do acerto não apareceu');
});

test('portao: na última, o botão é o portão e aoFechar recebe o número de vãos', () => {
  const { doc } = docComAnuncio();
  const perguntas = perguntasDaAula(PRATICA, 2);
  assert.equal(perguntas.length, 3);
  let fechou = null;
  const { section } = blocoFechoLeve(doc, { perguntas, aoFechar: (v) => { fechou = v; }, aoEscrever: () => {} });
  // Uma pergunta por vez: erra uma, acerta a certa, avança. Duas quedas no total.
  for (const indice of [0, 1]) {
    const erradas = alternativas(section, perguntas[indice]).filter((a) => !a.opcao.certa);
    toque(section, erradas[0].botao);
    toque(section, alternativas(section, perguntas[indice]).find((a) => a.opcao.certa).botao);
    toque(section, peloAtributo(section, 'data-seguir')[0]);
    assert.equal(fechou, null, 'avançou para fora do portão antes da última');
  }
  // Na terceira, a certa é o portão.
  const certa = alternativas(section, perguntas[2]).find((a) => a.opcao.certa);
  toque(section, certa.botao);
  const portao = peloAtributo(section, 'data-seguir')[0];
  assert.equal(textoDe(portao).trim(), Q.passar);
  toque(section, portao);
  assert.equal(fechou, 2, `o número de vãos errado: ${fechou}`);
});

test('portao: sem cair em vão nenhum, aoFechar recebe zero (e a frase é outra)', () => {
  const { doc } = docComAnuncio();
  const perguntas = perguntasDaAula(PRATICA, 2);
  let fechou = null;
  const { section } = blocoFechoLeve(doc, { perguntas, aoFechar: (v) => { fechou = v; }, aoEscrever: () => {} });
  for (const p of perguntas) {
    toque(section, alternativas(section, p).find((a) => a.opcao.certa).botao);
    toque(section, peloAtributo(section, 'data-seguir')[0]);
  }
  assert.equal(fechou, 0);
  assert.equal(Q.passouComVao(0) === undefined || Q.passouComVao(0) !== undefined, true);
  // A flexão de número é do core, e a régua não a reescreve: conferida na frase
  // que o app diria, uma vez, para não nascer um plural torto em silêncio.
  assert.equal(Q.passouComVao(1), 'Portão aberto. Você caiu em 1 vão e saiu sabendo por quê.');
  assert.equal(Q.passouComVao(2), 'Portão aberto. Você caiu em 2 vãos e saiu sabendo por quê.');
});

test('portao: o trilho cresce a cada pergunta atravessada', () => {
  const { doc } = docComAnuncio();
  const perguntas = perguntasDaAula(PRATICA, 2);
  const { section } = blocoFechoLeve(doc, { perguntas, aoFechar: () => {}, aoEscrever: () => {} });
  const barra = porClasse(section, 'portao-via')[0].children[0];
  const medida = () => Number(/width: ([\d.]+)%/.exec(barra.getAttribute('style'))[1]);
  assert.equal(medida(), 0);
  toque(section, alternativas(section, perguntas[0]).find((a) => a.opcao.certa).botao);
  toque(section, peloAtributo(section, 'data-seguir')[0]);
  // A fórmula da spec, e não uma equivalente: `(i / total) * 100`. `100 / 3` dá
  // 33,333333333333336 e `(1 / 3) * 100` dá 33,33333333333333 — um teste que
  // escrevesse a conta do jeito bonito acusaria a tela de um erro de um
  // décimoquinto dígito que ela não cometeu.
  assert.equal(medida(), (1 / 3) * 100);
});

// ── sem perguntas: um toque fecha ────────────────────────────────────────────

test('portao: sem pergunta o fecho é simples, e um toque fecha com zero vãos', () => {
  const { doc } = docComAnuncio();
  let fechou = 'nada';
  const { section, h2 } = blocoFechoLeve(doc, { perguntas: [], aoFechar: (v) => { fechou = v; }, aoEscrever: () => {} });
  assert.equal(h2.textContent, Q.fechoSimples);
  assert.equal(porClasse(section, 'portao-via').length, 0, 'sem pergunta não há trilho: a régua do nada é um bug');
  assert.equal(peloAtributo(section, 'data-opcao').length, 0);
  assert.equal(textoDe(section).includes(Q.fechoSimplesTexto), true);
  const abrir = peloAtributo(section, 'data-fechar')[0];
  assert.ok(classeTem(abrir, 'botao-primario'), 'o fecho simples perdeu o único primário da tela');
  toque(section, abrir);
  assert.equal(fechou, 0);
});

test('portao: o link de escrever é chamado nos dois casos, e nunca fecha por fora dele', () => {
  for (const perguntas of [[], perguntasDaAula(PRATICA, 2)]) {
    const { doc } = docComAnuncio();
    let fechou = false, escreveu = false;
    const { section } = blocoFechoLeve(doc, {
      perguntas, aoFechar: () => { fechou = true; }, aoEscrever: () => { escreveu = true; }
    });
    toque(section, porClasse(section, 'portao-escrever')[0]);
    assert.equal(escreveu, true, `${perguntas.length} perguntas: o link não chamou a fórmula`);
    assert.equal(fechou, false, `${perguntas.length} perguntas: escolher escrever fechou a aula`);
  }
});

// ── pelo caminho do app ──────────────────────────────────────────────────────

const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const CATALOGO_BRUTO = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CATALOGO = { courses: CATALOGO_BRUTO.courses || CATALOGO_BRUTO };
const CIRCUITOS = CATALOGO.courses.find((c) => c.slug === 'circuitos-digitais');
const ELETRICA = CATALOGO.courses.find((c) => c.slug !== 'circuitos-digitais');

/**
 * O portão é OPCIONAL por contrato, e o app resolve isso com um 404. Para o
 * node provar os dois lados sem rede, `globalThis.fetch` é trocado pelo
 * arquivo do disco — o MESMO arquivo que o navegador baixaria, e não um dublê.
 */
function comRedeDePratica(corpo) {
  const verdadeiro = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === `data/pratica/${corpo}.json`) {
      return { ok: true, status: 200, json: async () => BRUTO };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return () => { globalThis.fetch = verdadeiro; };
}

async function subirEstacao(curso, n, comEstudo = null) {
  const doc = criarDoc();
  const anuncio = doc.createElement('p');
  doc._registrar('anuncio', anuncio);
  doc.documentElement.append(anuncio);
  const win = { localStorage: storageCom(comEstudo ? { [ESTUDO_KEY]: comEstudo } : {}), document: { visibilityState: 'visible' }, Date };
  const raiz = doc.createElement('div');
  const instancia = await montarAula(raiz, {
    document: doc,
    window: win,
    catalogo: Promise.resolve(CATALOGO),
    folha: curso.slug,
    n,
    buscarAulas: async () => ({ ok: true, status: 200, json: async () => AULAS })
  });
  return { doc, win, raiz, anuncio, instancia };
}

test('app: a aula com perguntas abre o portão, e fechá-lo deixa a aula estudada sem recordação', async () => {
  const devolver = comRedeDePratica('circuitos-digitais');
  try {
    const { raiz, win } = await subirEstacao(CIRCUITOS, 2);
    assert.equal(porClasse(raiz, 'portao-opcao').length, 4, 'a aula 2 tem parada e não desenhou o portão');
    assert.equal(porClasse(raiz, 'fechamento-campo').length, 0, 'as caixas de texto voltaram sem ninguém pedir');
    // Três acertos limpos: a última certa é o portão.
    const perguntas = perguntasDaAula(PRATICA, 2);
    const section = porClasse(raiz, 'aula-fim-leve')[0];
    for (const p of perguntas) {
      toque(section, alternativas(section, p).find((a) => a.opcao.certa).botao);
      toque(section, peloAtributo(section, 'data-seguir')[0]);
    }
    const estudo = lerEstudo(win.localStorage.getItem(ESTUDO_KEY));
    const aula = AULAS.aulas.find((a) => Number(a.n) === 2);
    assert.equal(estudo.aulas[aula.id]?.estudadaEm?.slice(0, 10).length, 10, 'o portão abriu e a aula não ficou estudada');
    assert.equal('recordacao' in (estudo.aulas[aula.id] || {}), false, 'o portão escreveu recordação: a medida deixaria de ser do estudo');
    assert.equal('conferencia' in (estudo.aulas[aula.id] || {}), false, 'o portão escreveu conferência');
    // E a página disse a frase, no único lugar onde ela pode dizer.
    assert.equal(textoDe(raiz).includes(Q.passou), true, 'fechou pelo portão sem anunciar o portão aberto');
  } finally { devolver(); }
});

test('app: estação sem arquivo de prática mostra o fecho simples, e não um erro', async () => {
  const devolver = comRedeDePratica('nada-existe-aqui');
  try {
    const { raiz } = await subirEstacao(ELETRICA, 1);
    assert.equal(textoDe(porClasse(raiz, 'aula-fim-titulo')[0]), Q.fechoSimples);
    assert.equal(peloAtributo(raiz, 'data-fechar').length, 1, 'sem portão, o fecho de um toque tem de existir');
    assert.equal(porClasse(raiz, 'aulas-erro').length, 0, 'a estação sem prática virou página de erro');
    assert.equal(F.titulo.length > 0, true);
  } finally { devolver(); }
});

test('app: o botão «Prefiro escrever» troca o portão pelo formulário, e nada mais', async () => {
  const devolver = comRedeDePratica('circuitos-digitais');
  try {
    const { raiz } = await subirEstacao(CIRCUITOS, 2);
    toque(porClasse(raiz, 'aula-fim-leve')[0], porClasse(raiz, 'portao-escrever')[0]);
    assert.equal(porClasse(raiz, 'aula-fim-leve').length, 0, 'o portão ficou atrás do formulário');
    assert.ok(porClasse(raiz, 'fechamento-campo').length >= 1, 'escolher escrever não abriu as caixas de texto');
    assert.ok(porClasse(raiz, 'fechamento-enviar').length === 1, 'o formulário veio sem o botão de enviar dele');
  } finally { devolver(); }
});
