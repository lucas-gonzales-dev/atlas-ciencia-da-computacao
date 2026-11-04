// Projeto Atlas — S14b2 commit 2, o FECHAMENTO (o formulário de web/telas/aula.js).
//
// POR QUE EXISTE: o fechamento é o gesto que define o Atlas — a aula vira estudo
// quando a pessoa escreve o que lembra e faz um cartão. É também a única parte do
// app em que texto digitado precisa sobreviver (rascunho), ser recusado com frase
// do core (validação) e mudar a PÁGINA INTEIRA quando acontece: a marca do topo
// não pode dizer "Não iniciada" em cima de "Aula estudada".
//
// A VALIDAÇÃO É A DO NÚCLEO, não uma cópia dela: cada recusa cobrada aqui nasce de
// criarCartao/estudarAula/lerRascunho de verdade, e até os cartões das cenas de
// "aula já fechada" são montados por criarCartao. Se a tela checasse do seu jeito
// e o core mudasse, as duas divergiriam em silêncio — a família de defeitos que a
// S13b e a S13e deixaram no Chrome e não na suíte.
//
// DADOS REAIS, ROTA REAL: as 93 aulas de data/aulas/circuitos-digitais.json, o
// catálogo de data/catalog.json NA FORMA DO APP ({courses}), e o montar() chamado
// como o casco o chama. Mini-DOM (hdom.js) como em tests/aula-pagina.test.js — e
// aqui o dublê foi CONFERIDO antes (a primeira versão deste arquivo inventou um
// `doc.body`, que o hdom não tem, e os 13 testes morreram no mesmo TypeError:
// medindo o dublê, não a tela). O que o node não prova (rolamento, anel de foco,
// contraste) é conferido no Chrome: este commit rodou testar_pagina antes de fechar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, storageCom, todos } from './hdom.js';
import { aula as U, aulas as A, fechamento as F } from '../core/textos.js';
import {
  CARTOES_KEY,
  criarCartao,
  lerCartoes,
  minutosDaFila,
  modelosDeFrente,
  serializarCartoes
} from '../core/cartoes.js';
import {
  ESTUDO_KEY,
  chaveRascunho,
  estudarAula,
  lerEstudo,
  lerRascunho,
  serializarEstudo,
  serializarRascunho
} from '../core/estudo.js';
import { montar } from '../web/telas/aula.js';

const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const CATALOGO_BRUTO = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CATALOGO = { courses: CATALOGO_BRUTO.courses || CATALOGO_BRUTO };
const CIRCUITOS = CATALOGO.courses.find((c) => c.slug === 'circuitos-digitais');
const aulaEm = (n) => AULAS.aulas.find((a) => Number(a.n) === n);
const TERCEIRA = aulaEm(3);

const comClasse = (raiz, classe) => todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));
const um = (raiz, classe, onde) => {
  const achei = comClasse(raiz, classe);
  assert.equal(achei.length, 1, `${onde}: esperado exatamente um .${classe}, achei ${achei.length}`);
  return achei[0];
};
const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/\s+/g, ' ').trim();
const porData = (raiz, chave, valor) => todos(raiz, (n) => n.getAttribute?.(chave) === valor)[0] || null;
const campo = (raiz, nome) => porData(raiz, 'data-campo', nome);
const formDe = (raiz) => um(raiz, 'fechamento-form', 'formulário');
const sectionDe = (raiz) => um(raiz, 'aula-fim-form', 'seção do formulário');

/** Clique no OUVINTE DELEGADO da tela (a section do fechamento), com o botão
 *  como target — é o que o navegador entrega a um ouvinte delegado. Mora no
 *  módulo, e não no objeto devolvido por `pagina()`, porque um teste abre uma
 *  SEGUNDA página para conferir o rascunho e precisa clicar nela também.
 *  A section é rebuscada a cada toque: o "Outro cartão" repinta o formulário
 *  inteiro, e um alvo velho de ouvinte seria um clique em nó fora da tela. */
function clicar(caso, alvo) {
  sectionDe(caso.raiz).dispatch('click', { target: alvo, preventDefault() {} });
}

// AGORA FALSO, fixo: 04/11/2026 às 09:30 locais. A tela chama `new win.Date()`
// (agoraLocal) para carimbar `criadoEm`, `devidoEm` e `estudadaEm`, e a conta de
// amanhã compara `devidoEm` com `diaSeguinte(hoje())` lido na mesma subida. Com
// relógio real, a suíte rodando na virada do dia (23:59 → 00:00) calcularia as
// duas datas em dias diferentes e o "Amanhã: N cartões" mudaria de valor sem
// nada ter mudado na tela. Congelar o agora não conserta regra nenhuma — é para
// o teste medir a tela, não o horário em que ele foi chamado.
const AGORA_FAKE = new Date(2026, 10, 4, 9, 30, 15);
class DataFalsa extends Date {
  constructor(...args) {
    // new Date(string) e new Date(y,m,d,...) continuam reais — `dataDeCalendario`
    // e os testes que montam datas à mão precisam disso; só o `new Date()` pelado
    // (o "agora" da tela) é que congela.
    super(...args.length ? args : [AGORA_FAKE.getTime()]);
  }
  static now() { return AGORA_FAKE.getTime(); }
}

/**
 * Sobe a página da aula com um window que tem o que o FORMULÁRIO exige a mais do
 * que tests/aula-pagina.test.js dava: setInterval/clearInterval (o relógio do
 * passo 1, com os tics guardados para o teste andar o relógio à mão),
 * navigator.storage.persist contador (o pedido: persistir no primeiro cartão) e
 * um #anuncio publicado por `doc._registrar` — o hdom NÃO tem `document.body`, e
 * getElementById lê o mapa de ids registrados, que é o caminho que os outros
 * testes da casa já usam (auditoria-estados.test.js:307).
 */
async function pagina(n = 3, { estudo = null, cartoes = null, rascunho = null } = {}) {
  const doc = criarDoc();
  const anuncio = doc.createElement('p');
  doc._registrar('anuncio', anuncio);

  const storage = storageCom();
  if (estudo) storage.setItem(ESTUDO_KEY, estudo);
  if (cartoes) storage.setItem(CARTOES_KEY, cartoes);
  if (rascunho) storage.setItem(chaveRascunho(aulaEm(n).id), rascunho);

  const ouvintes = new Map();
  const ticks = [];
  const parados = [];
  let persistido = 0;
  const win = {
    localStorage: storage,
    document: { visibilityState: 'visible' },
    Date: DataFalsa,
    matchMedia: () => ({ matches: false }),
    scrollTo: () => {},
    setInterval: (fn) => { ticks.push(fn); return ticks.length; },
    clearInterval: (id) => { parados.push(id); },
    navigator: { storage: { persist: () => { persistido += 1; return Promise.resolve(true); } } },
    addEventListener: (tipo, fn) => {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, []);
      ouvintes.get(tipo).push(fn);
    },
    removeEventListener: (tipo, fn) => ouvintes.set(tipo, (ouvintes.get(tipo) || []).filter((f) => f !== fn))
  };

  const raiz = doc.createElement('div');
  const instancia = await montar(raiz, {
    document: doc,
    window: win,
    catalogo: Promise.resolve(CATALOGO),
    folha: CIRCUITOS.slug,
    n,
    buscarAulas: async () => ({ ok: true, status: 200, json: async () => AULAS })
  });
  // Os tics ANTES do clique do Assistir: o relógio do passo 1 anda, e o
  // visibilitychange da volta precisa dos ouvintes já amarrados pelo gravador.
  const disparar = (tipo) => (ouvintes.get(tipo) || []).slice().forEach((fn) => fn({ type: tipo }));
  const escrever = (nome, valor) => {
    const alvo = campo(raiz, nome);
    alvo.value = valor;
    sectionDe(raiz).dispatch('input', { target: alvo });
  };
  const enviar = () => formDe(raiz).dispatch('submit', { preventDefault() {} });
  return { doc, win, raiz, storage, instancia, anuncio, ticks, parados, disparar, escrever, clicar, enviar, persistidos: () => persistido };
}

/** Um arquivo de cartões de VERDADE, montado pelo core (não JSON escrito à mão:
 *  `lerCartoes` exige `versao` e confere campo a campo — um literal chutado aqui
 *  seria o teste morrendo por forma, não por comportamento). */
function cartoesDe({ aula, n, quando, pares }) {
  let arquivo = lerCartoes(null);
  pares.forEach(([frente, verso], i) => {
    const r = criarCartao(arquivo, { estacao: CIRCUITOS.id, aula: aula.id, n, frente, verso }, quando, `${aula.id}-${i}`);
    assert.equal(r.ok, true, `o núcleo recusou o cartão de cena: ${r.erro}`);
    arquivo = { versao: arquivo.versao, cartoes: r.cartoes };
  });
  return serializarCartoes(arquivo);
}

// ─────────────────────────── o formulário desenhado ───────────────────────────

test('o formulário tem os três passos, o relógio em 2:00 e o submit da casa', async () => {
  const c = await pagina();
  const passos = comClasse(c.raiz, 'fechamento-passo');
  assert.deepEqual(passos.map((p) => p.getAttribute('data-passo')), ['1', '2', '3'],
    'os três passos do desenho J2: Sem olhar, Conferir, Cartões');

  const lembrar = campo(c.raiz, 'lembrar');
  assert.equal(lembrar.tag, 'textarea', 'quem escreve dois parágrafos merece um textarea');
  assert.equal(lembrar.getAttribute('maxlength'), '500', 'o teto é o LIMITE_FACE do core, não um número da tela');

  assert.equal(textoDo(um(c.raiz, 'fechamento-relogio', 'passo 1')), '2:00',
    'o relógio nasce inteiro: parado em 0:00 lê "você chegou tarde"');
  assert.equal(c.ticks.length, 0, 'o relógio só anda depois do primeiro foco');

  const enviarBotao = porData(c.raiz, 'data-enviar', 'sim');
  assert.equal(enviarBotao.getAttribute('type'), 'submit', 'o botão fecha o form, não é um clique à parte');
  assert.equal(textoDo(enviarBotao), F.titulo, 'o verbo da casa: "Fechar a aula"');
  assert.equal(textoDo(um(c.raiz, 'fechamento-alternar', 'topo')), F.modoMinimo.convite);
  assert.match(U.anuncio(3, AULAS.total.aulas, TERCEIRA.titulo), /Aula 3 de 93/, 'a régua do anúncio é a do texto');
});

test('os modelos vivem por editor, e o toque escreve no cartão dono do botão', async () => {
  const c = await pagina();
  assert.equal(comClasse(c.raiz, 'fechamento-cartao').length, 1, 'um editor novo');
  clicar(c, porData(c.raiz, 'data-mais', 'sim'));
  const editores = comClasse(c.raiz, 'fechamento-cartao');
  assert.equal(editores.length, 2, 'o "Outro cartão" não criou o segundo editor');

  // Os modelos DO SEGUNDO editor: um conjunto único no alto da seção obrigaria a
  // tela a adivinhar a que cartão o toque se aplica. Aqui não há o que adivinhar.
  const modelos = comClasse(editores[1], 'fechamento-modelo');
  assert.equal(modelos.length, modelosDeFrente.length, 'as quatro frentes que puxam paráfrase, por editor');
  clicar(c, modelos[0]);
  assert.equal(campo(c.raiz, 'frente-1').value.startsWith(modelosDeFrente[0]), true,
    'o modelo entrou no cartão DONO do botão');
  assert.equal(campo(c.raiz, 'frente-0').value, '', 'e vazou no cartão do lado');
});

// ─────────────────────────────── a recusa honesta ───────────────────────────────

test('enviar vazio não grava nada e mostra a frase do core junto do campo', async () => {
  const c = await pagina();
  c.enviar();

  assert.equal(c.storage.getItem(ESTUDO_KEY), null, 'envio inválido gravou estudo');
  assert.equal(c.storage.getItem(CARTOES_KEY), null, 'envio inválido gravou cartões');

  const textos = comClasse(c.raiz, 'fechamento-erro').map(textoDo);
  assert.ok(textos.includes(F.faltaLembrar), `faltou a frase de "escreva o que lembra": ${textos.join(' | ')}`);
  assert.ok(textos.includes(F.faltaCartao), `faltou a frase do cartão: ${textos.join(' | ')}`);
  assert.equal(campo(c.raiz, 'lembrar').getAttribute('aria-invalid'), 'true',
    'o campo errante precisa de voz, não só de cor');
  assert.equal(comClasse(c.raiz, 'fechamento-form').length, 1, 'a tela sumiu ou trocou de forma no erro');
});

test('cartão sem verso é recusado com a frase do NÚCLEO, não uma inventada pela tela', async () => {
  const c = await pagina();
  c.escrever('lembrar', 'XOR é soma sem vai-um.');
  c.escrever('frente-0', 'O que é XOR?');
  c.enviar();

  assert.equal(c.storage.getItem(ESTUDO_KEY), null, 'passou um cartão sem verso');
  const erro = comClasse(c.raiz, 'fechamento-erro').map(textoDo).join(' | ');
  assert.match(erro, /sem ela, n\u00e3o h\u00e1 o que conferir/, `a tela escreveu o erro do core por conta própria: ${erro}`);
  assert.equal(campo(c.raiz, 'verso-0').getAttribute('aria-describedby')?.endsWith('-erro'), true,
    'a frase está presa ao campo que falta, apontada por aria-describedby');
});

// ─────────────────────────────── o envio que fecha ───────────────────────────────

test('fechar grava estudo e cartão, apaga o rascunho e refaz a página inteira', async () => {
  const c = await pagina();
  c.escrever('lembrar', 'XOR é soma binária sem vai-um.');
  c.escrever('conferir', 'Faltou o caso do carry.');
  c.escrever('frente-0', 'O que é XOR?');
  c.escrever('verso-0', 'Soma binária sem vai-um.');
  assert.ok(c.storage.getItem(chaveRascunho(TERCEIRA.id)), 'o rascunho não seguiu a digitação');

  c.enviar();

  const registro = lerEstudo(c.storage.getItem(ESTUDO_KEY)).aulas[TERCEIRA.id];
  assert.equal(registro.n, 3);
  assert.equal(registro.recordacao, 'XOR é soma binária sem vai-um.');
  assert.equal(registro.conferencia, 'Faltou o caso do carry.');
  assert.match(registro.estudadaEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'regra 13: hora local, sem Z');

  const cartões = Object.values(lerCartoes(c.storage.getItem(CARTOES_KEY)).cartoes);
  assert.equal(cartões.length, 1, 'um cartão completo, um cartão gravado');
  assert.equal(cartões[0].aula, TERCEIRA.id);
  assert.equal(cartões[0].n, 3, 'o número da aula sobrevive, para a fila saber de onde veio');
  assert.match(cartões[0].devidoEm, /^\d{4}-\d{2}-\d{2}$/, 'devidoEm é data de calendário');
  assert.equal(cartões[0].fsrs, null, 'a S15 enche isto; hoje significa "ainda não há modelo"');

  assert.equal(c.storage.getItem(chaveRascunho(TERCEIRA.id)), null,
    'enviou e o rascunho ficou: a volta à página reabriria o que já foi gravado');
  assert.equal(c.persistidos(), 1, 'o primeiro cartão da vida chamaria navigator.storage.persist()');

  // A página INTEIRA se refaz: nada de "Não iniciada" em cima de "Aula estudada".
  assert.equal(textoDo(um(c.raiz, 'aula-estado', 'apoio do topo')), A.estados.estudada);
  assert.match(um(c.raiz, 'aula-marca', 'apoio do topo').className, /aula-marca-estudada/);
  assert.equal(comClasse(c.raiz, 'fechamento-form').length, 0, 'o formulário ficou em cima da aula fechada');

  const feito = um(c.raiz, 'aula-fim-feito', 'bloco de conclusão');
  assert.match(textoDo(um(feito, 'fechamento-feito-frase', 'frase do feito')), /^Aula estudada\./);
  const leitura = comClasse(feito, 'fechamento-leitura');
  assert.equal(leitura.length, 1, 'o cartão fechado não apareceu em leitura');
  assert.equal(textoDo(um(leitura[0], 'fechamento-leitura-frente', 'leitura')), 'O que é XOR?');
  assert.equal(textoDo(um(leitura[0], 'fechamento-leitura-verso', 'leitura')), 'Soma binária sem vai-um.');
  assert.equal(textoDo(um(feito, 'fechamento-origem', 'origem do cartão')), F.origem(3, CIRCUITOS.title));

  const proxima = porData(feito, 'data-proxima', '4');
  assert.ok(proxima, 'a conclusão não apontou para a próxima aula');
  assert.match(textoDo(proxima), /^Pr\u00f3xima: Aula 4 — /, 'o próximo é lido do arquivo, com a duração real');

  assert.equal(textoDo(um(feito, 'fechamento-por-hoje', 'por hoje')),
    F.porHoje(1, minutosDaFila(1)), 'a conta de amanhã é a do núcleo com a fila de verdade');

  // A ordem lida: a navegação vizinha vem DEPOIS do fechamento, não embaixo dele
  // por acidente de apêndice.
  const filhos = c.raiz.children;
  assert.ok(filhos.indexOf(feito) < filhos.indexOf(um(c.raiz, 'aula-nav', 'navegação vizinha')),
    'a conclusão caiu depois da navegação vizinha');
});

test('dois cartões gravam dois, e o aviso de amanhã soma a fila inteira', async () => {
  const c = await pagina();
  c.escrever('lembrar', 'O multiplexador escolhe entre N entradas.');
  c.escrever('frente-0', 'O que faz um multiplexador?');
  c.escrever('verso-0', 'Escolhe entre N entradas.');
  clicar(c, porData(c.raiz, 'data-mais', 'sim'));
  c.escrever('frente-1', 'E o demux?');
  c.escrever('verso-1', 'Distribui em N saídas.');
  c.enviar();

  assert.equal(Object.keys(lerCartoes(c.storage.getItem(CARTOES_KEY)).cartoes).length, 2);
  const feito = um(c.raiz, 'aula-fim-feito', 'conclusão');
  assert.equal(comClasse(feito, 'fechamento-leitura').length, 2, 'os DOIS cartões aparecem em leitura');
  assert.equal(textoDo(um(feito, 'fechamento-por-hoje', 'por hoje')),
    F.porHoje(2, minutosDaFila(2)), 'dois cartões de ~20 s: 1 min, arredondado para cima');
});

// ──────────────────────────────── o teto de 3 ────────────────────────────────

test('"Outro cartão" cresce até 3 e depois vira frase, nunca botão morto', async () => {
  const c = await pagina();
  clicar(c, porData(c.raiz, 'data-mais', 'sim'));
  clicar(c, porData(c.raiz, 'data-mais', 'sim'));
  assert.equal(comClasse(sectionDe(c.raiz), 'fechamento-cartao').length, 3, 'o terceiro cartão não nasceu');
  assert.equal(porData(c.raiz, 'data-mais', 'sim'), null,
    'o botão não sumiu no teto: continuaria prometendo o que não acontece');
  assert.equal(textoDo(um(sectionDe(c.raiz), 'fechamento-limite', 'teto')), F.passoCartoes.limite);

  // O texto digitado nos três sobrevive à repintura do "Outro cartão" — se não
  // sobrevivesse, a pessoa perderia o que escreveu a cada toque no botão.
  c.escrever('frente-0', 'pergunta do primeiro');
  clicar(c, porData(sectionDe(c.raiz), 'data-alternar', 'minimo'));
  clicar(c, porData(c.raiz, 'data-alternar', 'completo'));
  assert.equal(campo(c.raiz, 'frente-0').value, 'pergunta do primeiro', 'a troca de modo comeu o cartão escrito');
});

// ─────────────────────────────── o rascunho ───────────────────────────────

test('o que foi digitado volta quando a página reabre, sem nada ter sido enviado', async () => {
  const c = await pagina();
  c.escrever('lembrar', 'meia frase que eu ainda vou completar');
  c.escrever('frente-0', 'Pergunta pela metade');
  const guardado = lerRascunho(c.storage.getItem(chaveRascunho(TERCEIRA.id)));
  assert.equal(guardado.lembrar, 'meia frase que eu ainda vou completar');
  assert.equal(guardado.cartoes.length, 1);

  const d = await pagina(3, { rascunho: c.storage.getItem(chaveRascunho(TERCEIRA.id)) });
  assert.equal(campo(d.raiz, 'lembrar').value, 'meia frase que eu ainda vou completar', 'o rascunho não voltou no campo');
  assert.equal(campo(d.raiz, 'frente-0').value, 'Pergunta pela metade');
});

test('o rascunho é por aula: a 4 não herda o que eu escrevi na 3', async () => {
  const c = await pagina();
  c.escrever('lembrar', 'anotação da aula 3');
  const d = await pagina(4);
  assert.equal(campo(d.raiz, 'lembrar').value, '', 'a chave do rascunho não é por aula');
});

test('o modo mínimo cabe em uma frase e um cartão, e o link o desfaz', async () => {
  const c = await pagina();
  clicar(c, porData(c.raiz, 'data-alternar', 'minimo'));
  assert.equal(comClasse(c.raiz, 'fechamento-passo').length, 1, 'o modo mínimo tem um passo, não dois');
  assert.ok(campo(c.raiz, 'frase'), 'o campo único do modo mínimo');
  assert.equal(campo(c.raiz, 'lembrar'), null, 'sobrou o campo do modo completo');
  assert.equal(porData(c.raiz, 'data-mais', 'sim'), null, 'o modo mínimo ofereceu "Outro cartão" sendo um cartão só');
  assert.equal(comClasse(c.raiz, 'fechamento-limite').length, 0,
    '"Até 3 cartões" escrito num modo de um só seria a frase mentindo sobre a forma em tela');
  assert.equal(textoDo(um(c.raiz, 'fechamento-alternar', 'topo')), F.modoCompleto, 'a saída do modo mínimo sumiu');

  clicar(c, porData(c.raiz, 'data-alternar', 'completo'));
  assert.equal(comClasse(c.raiz, 'fechamento-passo').length, 3, 'voltar ao completo não refez os três passos');
});

// ─────────────────────── a aula que já chegou fechada ───────────────────────

test('reabrir uma aula estudada mostra a conclusão, não o formulário', async () => {
  const quando = '2026-11-04T09:15';
  const estudo = estudarAula(lerEstudo(null),
    { estacao: CIRCUITOS.id, aula: TERCEIRA.id, n: 3 }, quando,
    { recordacao: 'carry-lookahead gera os carries em paralelo', conferencia: 'confere o slide 4' });
  const cartoes = cartoesDe({
    aula: TERCEIRA, n: 3, quando,
    pares: [['O que é carry-lookahead?', 'Gera os carries em paralelo, sem esperar o anterior.']]
  });

  const c = await pagina(3, { estudo: serializarEstudo(estudo), cartoes });

  assert.equal(comClasse(c.raiz, 'fechamento-form').length, 0, 'a tela mostrou o formulário de uma aula já fechada');
  const feito = um(c.raiz, 'aula-fim-feito', 'conclusão da volta');
  assert.match(textoDo(um(feito, 'fechamento-feito-frase', 'frase')), /^Estudada em \d{2}\/\d{2}\/\d{4}/,
    'a data do núcleo passou pelo formatador da casa (dataDeCalendario)');
  assert.equal(textoDo(um(c.raiz, 'aula-estado', 'topo')), A.estados.estudada,
    'o alto da página discorda do bloco de baixo');
  assert.equal(comClasse(feito, 'fechamento-leitura').length, 1);
});

test('a volta da aba com estudo feito em OUTRA aba fecha a página sem recarregar', async () => {
  const c = await pagina();
  const assistir = porData(c.raiz, 'data-assistir', 'sim');
  // O FIO inteiro, pelo gravador da casa: o clique no Assistir grava a abertura
  // (aulas-pedacos.js), a outra aba grava o estudo no MESMO storage, e o
  // visibilitychange devolve a página já fechada. Nada escrito à mão.
  c.raiz.dispatch('click', { target: assistir, preventDefault() {} });
  assert.ok(c.storage.getItem(ESTUDO_KEY), 'o Assistir não gravou a abertura: o fio está solto');

  const estudo = estudarAula(lerEstudo(c.storage.getItem(ESTUDO_KEY)),
    { estacao: CIRCUITOS.id, aula: TERCEIRA.id, n: 3 }, '2026-11-04T10:00',
    { recordacao: 'full adder soma três bits', conferencia: '' });
  c.storage.setItem(ESTUDO_KEY, serializarEstudo(estudo));
  c.disparar('visibilitychange');

  assert.equal(textoDo(um(c.raiz, 'aula-estado', 'topo')), A.estados.estudada, 'a volta não repintou o alto da página');
  assert.equal(comClasse(c.raiz, 'fechamento-form').length, 0, 'o formulário sobreviveu ao estudo da outra aba');
  assert.match(textoDo(um(c.raiz, 'fechamento-feito-frase', 'frase da volta')), /^Estudada em /);
});

test('voltar sem ter saído para o vídeo NÃO rola nem move o foco', async () => {
  const c = await pagina();
  let rolou = 0;
  um(c.raiz, 'aula-fim-form', 'seção').scrollIntoView = () => { rolou += 1; };
  // O window recebe visibilitychange sem ninguém ter tocado no Assistir: trocar
  // de aba por conta própria não pode mover a leitura de ninguém (item 2).
  c.win.document.visibilityState = 'visible';
  c.disparar('visibilitychange');
  assert.equal(rolou, 0, 'a página rolou sozinha num retorno que não foi de vídeo');
  assert.equal(c.doc.foco, null, 'o foco foi roubado por um retorno que não fechou nada');
});

// ─────────────────────────────── o relógio ───────────────────────────────

test('o relógio anda no foco, anuncia o fim UMA vez pelo #anuncio, e nunca trava nada', async () => {
  const c = await pagina();
  campo(c.raiz, 'lembrar').dispatch('focus', {});
  assert.equal(c.ticks.length, 1, 'o foco do passo 1 não ligou o relógio');

  campo(c.raiz, 'conferir').dispatch('focus', {});
  assert.equal(c.ticks.length, 1, 'um segundo tic-tac: dois relógios escreveriam no mesmo nó a cada segundo');

  const tic = c.ticks[0];
  for (let i = 0; i < 120; i++) tic();
  assert.equal(textoDo(um(c.raiz, 'fechamento-relogio', 'relógio')), F.tempo, 'o relógio no zero não disse a frase da casa');
  assert.equal(c.anuncio.textContent, F.tempo, 'a frase do fim não saiu pela região viva do casco');

  for (let i = 0; i < 5; i++) tic();
  assert.equal(todos(c.raiz, (n) => n._texto === F.tempo && n.tag === 'p').length, 0,
    'o fim do relógio criou parágrafo de aviso na tela');

  // E o teto é convite, não portão: enviar DEPOIS do zero continua valendo.
  c.escrever('lembrar', 'somador completo');
  c.escrever('frente-0', 'O que é um full adder?');
  c.escrever('verso-0', 'Soma três bits e gera carry.');
  c.enviar();
  assert.ok(c.storage.getItem(ESTUDO_KEY), 'o relógio terminado bloqueou o envio: travar por tempo puniu quem lembrou rápido');
});

test('desmontar para o relógio — a tela morta não continua anunciando', async () => {
  const c = await pagina();
  campo(c.raiz, 'lembrar').dispatch('focus', {});
  const relogio = um(c.raiz, 'fechamento-relogio', 'relógio antes do desmontar');
  assert.equal(textoDo(relogio), '2:00', 'o relógio não tinha nem começado');
  assert.deepEqual(c.parados, [], 'o clearInterval foi chamado antes da hora');

  c.instancia.desmontar();
  // A régua honesta é o ID DEVOLVIDO por setInterval: um dublê que substituísse o
  // callback por noop ao clearInterval faria este teste medir o dublê, não a tela
  // — e o `tic` capturado antes continuaria funcionando de qualquer jeito, que é
  // exatamente como a primeira versão deste caso passou verde mentindo. No
  // navegador o que mata o relógio é clearInterval(id), e é isso que se cobra.
  assert.deepEqual(c.parados, [1], 'desmontar não parou o intervalo do relógio');
});

test('a aula que não existe continua sem formulário e sem promessa de estado', async () => {
  const c = await pagina(999);
  assert.equal(comClasse(c.raiz, 'fechamento-form').length, 0);
  assert.equal(comClasse(c.raiz, 'aula-fim').length, 0, 'a página de erro desenhou um fim de aula');
  assert.equal(comClasse(c.raiz, 'aula-estado').length, 0, 'a página de erro prometeu um estado de aula');
});

// ─────────────── item 0, o que o node alcança do sublinhado ───────────────
//
// O Claude mediu no Chrome (04/11/2026) que a única saída do /aula/999 continuava
// com cara de texto comum, depois de eu ter posto a classe da casa. A causa não é
// a classe: é a ORDEM DE CARGA do index.html — folha.css (onde mora
// `.folha-caminho-link { text-decoration: underline }`) vem ANTES de aula.css, e
// `.aula-nav-antes { text-decoration: none }` declara a mesma especificidade e é o
// arquivo mais recente. Node não resolve cascata nenhuma, então as duas travas
// abaixo não provam o pixel: provam que existe uma regra NO ARQUIVO MAIS TARDE,
// composta com as duas classes, que é a única forma de ganhar por ordem. Sem ela,
// quem julga o CSS da folha não tem como saber que o link foi enterrado.

test('item 0: a saída do /aula/999 tem a classe do sublinhado da casa', async () => {
  const c = await pagina(999);
  const saida = comClasse(c.raiz, 'folha-caminho-link');
  assert.equal(saida.length, 1, 'a página de erro não deixou saída com a classe da casa');
  assert.match(saida[0].getAttribute('href'), /^#\/estacao\/circuitos-digitais\/aulas$/,
    'a saída do /aula/999 não leva à lista');
});

test('item 0: o CSS que enterra o sublinhado tem de ser desenterrado no arquivo que carga depois', () => {
  const css = readFileSync(new URL('../web/telas/aula.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // A primeira versão desta trava era uma regex que exigia `.aula .aula-nav-antes
  // .folha-caminho-link` seguido de `{` — e caiu, porque a regra no arquivo é o
  // PRIMEIRO de uma lista de três seletores. É a mesma pegadinha que o
  // tests/auditoria-tamanhos.test.js documenta na função `escanear`: «`html,` +
  // quebra de linha + `body { … }` é UMA regra com DOIS alvos». Node lê o texto
  // como texto; a lista tem de ser remontada antes de perguntar.
  const regras = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({
    seletores: sel.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    corpo
  }));

  // Regra ESCOPADA em `.aula` que compõe `.aula-nav-antes` COM a classe da casa.
  // Sem o escopo, o "← Aula anterior" (mesma classe, outro propósito) ganharia um
  // sublinhado que a S14b1 não pediu.
  const comSublinhado = regras.filter((r) =>
    r.seletores.some((s) => /^\.aula \.aula-nav-antes\.folha-caminho-link$/.test(s))
    && /text-decoration:\s*underline/.test(r.corpo));
  assert.equal(comSublinhado.length, 1,
    'web/telas/aula.css perdeu a regra que vence o `text-decoration: none` de `.aula-nav-antes`: o link de saída do /aula/999 volta a ser texto comum no Chrome');

  // A regra tem de MORAR no arquivo que carga por último: o index.html linka
  // folha.css (linha 50) antes de aula.css (linha 64), e é essa ordem que faz
  // `.aula-nav-antes` ganhar do `.folha-caminho-link` no empate de especificidade.
  // Escrever a mesma regra no folha.css seria reescrever o defeito.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ordem = [...html.matchAll(/href="\.\/web\/(folha|telas\/aula)\.css"/g)].map((m) => m[1]);
  assert.ok(ordem.indexOf('folha') >= 0 && ordem.indexOf('telas/aula') > ordem.indexOf('folha'),
    `index.html mudou a ordem de carga (${ordem.join(' → ')}): sem o aula.css por último, a regra de cima não vence mais nada`);
});

// ──────────────────── item 8: a marca cheia das três telas ────────────────────

test('item 8: a marca do topo enche quando a aula é estudada', async () => {
  const c = await pagina();
  c.escrever('lembrar', 'O decoder ativa uma de N saídas.');
  c.escrever('frente-0', 'O que faz um decoder?');
  c.escrever('verso-0', 'Ativa uma de N saídas.');
  c.enviar();
  const marca = um(c.raiz, 'aula-marca', 'apoio do topo');
  assert.match(marca.className, /aula-marca-estudada/,
    'fechar a aula não encheu a marca do topo: `Aula estudada` em cima de um círculo vazio');
});

test('item 8: o círculo cheio é um desenho só para as duas telas (regra 9)', () => {
  const css = readFileSync(new URL('../web/telas/aulas.css', import.meta.url), 'utf8');
  const marca = /\.aula-marca-estudada\s*\{[^}]*background:\s*var\(--cor/g;
  assert.ok(marca.test(css),
    'web/telas/aulas.css não enche a marca de estudada: a folha, a lista e a página divergiriam, porque as três montam `aula-marca-<estado>`');
  assert.doesNotMatch(css, /#/, 'cor à mão na marca: foge do tokens.css e do tema escuro');

  // Item 6 (04/11/2026): encher é background, não a borda. A primeira versão
  // transicionava só border-color, e o disco aparecia de uma vez com a borda
  // suavizando. No node isso passa verde — node não interpila nada, e o comentário
  // do CSS afirmava que a transição tratava do caso sem tratar. A trava abaixo é o
  // que impede a transição de voltar a ser só da borda quando alguém reorganizar o
  // bloco, e é por isso que ela mede o ARQUIVO, não o dublê.
  const comTransicao = [...css.matchAll(/\.aula-marca\s*\{([^}]*)\}/g)]
    .map((m) => m[1])
    .filter((corpo) => /transition:/.test(corpo));
  assert.equal(comTransicao.length, 1, 'mais de uma regra .aula-marca declara transition: qual governa a marca?');
  assert.match(comTransicao[0], /transition:[^;]*background-color/,
    'a marca do topo não transiciona background-color: o círculo CHEIO aparece de uma vez, e o item 6 pede que encha com --movimento-abrir');
  assert.match(comTransicao[0], /background-color\s+var\(--movimento-abrir\)/,
    'o tempo do preenchimento não veio do token da casa');
});

// ─────────────── item 6: a última aula tem para onde ir ───────────────

test('item 6: a última aula da estação não inventa uma próxima — leva às aulas', async () => {
  const c = await pagina(93);
  c.escrever('lembrar', 'Codificação state assignment escolhe os bits do estado.');
  c.escrever('frente-0', 'O que é state assignment?');
  c.escrever('verso-0', 'Escolher a codificação binária de cada estado.');
  c.enviar();

  const feito = um(c.raiz, 'aula-fim-feito', 'conclusão da última');
  assert.equal(comClasse(feito, 'fechamento-proxima').length, 0,
    'a última aula prometeu uma próxima que não existe no arquivo');
  const fim = um(feito, 'fechamento-fim', 'destino da última');
  assert.equal(textoDo(fim), U.naoExiste.voltarParaAulas(CIRCUITOS.title));
  assert.match(fim.getAttribute('href'), /^#\/estacao\/circuitos-digitais\/aulas$/,
    'o destino da última aula não é a lista da estação');
  // A aula 92, essa sim, tem próxima: a regra não virou "nunca há próxima".
  const d = await pagina(92);
  d.escrever('lembrar', 'Hold time e setup time fecham o ciclo.');
  d.escrever('frente-0', 'O que é setup time?');
  d.escrever('verso-0', 'O tempo que o sinal tem de antes da borda.');
  d.enviar();
  assert.ok(porData(d.raiz, 'data-proxima', '93'), 'a aula 92 perdeu a próxima');
});
