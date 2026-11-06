// Projeto Atlas — a trava da TELA do desafio (S18c-1, 06/11/2026, desenho J4).
//
// POR QUE ESTE ARQUIVO EXISTE: desde a S17a a caderneta promete «o desafio da
// estação aprovado» em 35 carimbos, e não havia lugar para fazê-lo. O núcleo
// (core/desafio.js) está commitado e medido; o que se prova aqui é a FALA: a
// rota existe, a pessoa faz os cartões, e o carimbo aparece no arquivo dela.
//
// O CAMINHO DO APP, SEMPRE. Nada aqui chama `montar` com um ctx inventado: as
// cinco travas sobem o CASCO (web/casco.js `iniciar`) com o mini-DOM real, o
// catálogo REAL de data/catalog.json, as aulas REAIS de
// data/aulas/circuitos-digitais.json e o indice.json REAL, entregues por um
// `globalThis.fetch` que roteia pelo URL. É a lição da S13b, escrita duas vezes
// na casa (aulas-fio.test.js:7 e o defeito 1 da S11-0): a peça certa com o ctx
// errado dá verde e branco na tela. Aqui o ctx é o do navegador.
//
// OS DADOS NASCEM DOS GESTOS, nunca de objeto escrito à mão: `abrirAula`,
// `pularAula`, `estudarAula`, `criarCartao`. Uma viagem digitada no teste faria a
// tela provar a si mesma com um arquivo que o app nunca escreve.
//
// A TRAVA QUE NENHUMA OUTRA FAZ (o pedido nomeou): mostrar o acerto a cada
// cartão. Este arquivo não tem um caso «não mostra» decorativo — o caso do meio
// percorre os 12 cartões conferindo a cada passo que existe UM h1, que ele é a
// FRENTE do cartão seguinte e que nenhuma palavra de veredito entrou na tela. É
// isso que derruba a prova.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, storageCom, todos, textoDe } from './hdom.js';
import { iniciar } from '../web/casco.js';
import { lerRota } from '../core/rotas.js';
import { dataLocal } from '../core/viagem.js';
import {
  ESTUDO_KEY, serializarEstudo, lerEstudo, abrirAula, estudarAula, pularAula,
} from '../core/estudo.js';
import {
  CARTOES_KEY, criarCartao, lerCartoes, serializarCartoes, diaSeguinte,
} from '../core/cartoes.js';
import { CHAVE_VIAGEM } from '../web/metro.js';
import { aplicarResultado, corrigirDesafio, podeDesafiar, fraseDaDominada } from '../core/desafio.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { desafio as D, folha as F, revisar as R } from '../core/textos.js';

const LER = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const CATALOGO = JSON.parse(LER('data/catalog.json'));
const CURSOS = CATALOGO.courses || [];
const AULAS = JSON.parse(LER('data/aulas/circuitos-digitais.json'));
const INDICE = JSON.parse(LER('data/aulas/indice.json'));
const CIRCUITOS = CURSOS.find((c) => c.slug === 'circuitos-digitais');
assert.ok(CIRCUITOS, 'fixture: sem circuitos-digitais no catálogo não há o que provar');
const ID = String(CIRCUITOS.id);
const ROTA = `#/estacao/${CIRCUITOS.slug}/desafio`;

// A estação tem UMA aula de exercício no arquivo real. O teste não escolhe uma:
// lê a que existe, porque `podeDesafiar` exige cartão maduro em CADA exercício.
const EXERCICIO = AULAS.aulas.find((a) => a.exercicio);
assert.ok(EXERCICIO, 'fixture: Circuitos Digitais sem aula de exercício');

// O CASCO não passa `hoje` no contexto, então a tela usa `dataLocal()` — o dia
// real. Fixtures amarradas a '2026-11-04' venceriam amanhã e mentiriam hoje: as
// datas nascem do dia em que o teste roda, três dias atrás para os cartões
// (idade mínima 2, core/desafio.js:36).
const HOJE = dataLocal();
const ANTES = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const CRIADO = `${ANTES(3)}T10:00`;

// ═══════════════════════ o storage, nascido dos gestos ═══════════════════════

/**
 * A viagem de quem PERCORREU a estação: abre as 93 aulas, pula 92 e fecha a de
 * exercício. Ficar «percorrida» é condição do desafio (core/eixos.js), e fechar
 * tudo seria estudar o que o teste não mede.
 */
function estudoPercorrido() {
  let estudo = { versao: 1, ultima: null, aulas: {} };
  for (const a of AULAS.aulas) {
    estudo = abrirAula(estudo, { estacao: ID, aula: a.id, n: a.n }, CRIADO);
    estudo = a.id === EXERCICIO.id
      ? estudarAula(estudo, { estacao: ID, aula: a.id, n: a.n }, CRIADO, { recordacao: 'r', conferencia: 'c' })
      : pularAula(estudo, { estacao: ID, aula: a.id, n: a.n }, CRIADO);
  }
  return estudo;
}

/**
 * Os cartões: DOZE, um deles da aula de exercício (o piso é 10, MINIMO_CARTOES).
 * Todos da estação, todos maduros, todos escritos pela função da tela.
 */
function dozeCartoes() {
  let mapa = {};
  for (let i = 0; i < 12; i++) {
    const aula = i === 0 ? EXERCICIO : AULAS.aulas[i + 1];
    const r = criarCartao(mapa, {
      estacao: ID, aula: aula.id, n: aula.n,
      frente: `Frente do cartão ${i + 1}`, verso: `Verso do cartão ${i + 1}`,
    }, CRIADO, `cartao-${i + 1}`);
    assert.equal(r.ok, true, `fixture: criarCartao recusou ${i + 1}: ${JSON.stringify(r)}`);
    mapa = r.cartoes;
  }
  return mapa;
}

// ═══════════════════════ subir o app na rota do desafio ═══════════════════════

const porClasse = (raiz, classe) =>
  todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));

const botaoPorTexto = (raiz, texto) => {
  const achei = todos(raiz, (n) => n.tag === 'button' && n._texto === texto);
  assert.equal(achei.length, 1, `esperava exatamente um botão «${texto}», achei ${achei.length}`);
  return achei[0];
};

/**
 * Sobe o CASCO em `#/estacao/circuitos-digitais/desafio` com o storage dado.
 *
 * O `fetch` é emprestado pelo tempo do `iniciar` e roteia pelo URL, devolvendo os
 * bytes do disco: é assim que a tela chega ao indice.json e ao JSON da estação
 * sem que o teste finja um ctx. Depois do iniciar ele volta ao original —
 * clique nenhum busca rede nesta tela.
 */
async function abrirApp({ entradas = {}, hash = ROTA } = {}) {
  const doc = criarDoc();
  const m = (tag, opts = {}) => {
    const no = doc.createElement(tag);
    no.className = opts.classe || '';
    for (const [k, v] of Object.entries(opts.attrs || {})) no.setAttribute(k, v);
    if (opts.id) doc._registrar(opts.id, no);
    return no;
  };
  // Os mesmos ids e atributos do app/index.html (o dublê da auditoria de teclado).
  const main = m('main', { id: 'conteudo', attrs: { tabindex: '-1' } });
  main.textContent = 'O Atlas está carregando.';
  const nav = m('nav', { classe: 'abas', attrs: { 'aria-label': 'Principal' } });
  for (const aba of ['jornada', 'explorar', 'revisar', 'perfil']) {
    nav.append(m('a', { attrs: { href: `#/${aba === 'jornada' ? '' : aba}`, 'data-tela': aba } }));
  }
  const topo = m('header', { classe: 'topo' });
  topo.append(nav);
  doc.documentElement.append(
    m('a', { classe: 'pular', attrs: { href: '#conteudo' } }),
    topo,
    m('p', { id: 'estado-rede', classe: 'selo-rede', attrs: { 'aria-live': 'polite', hidden: '' } }),
    main,
    m('p', { id: 'anuncio', classe: 'so-leitor', attrs: { 'aria-live': 'polite' } }),
  );

  const storage = storageCom(entradas);
  const win = {
    location: { hash },
    history: { replaceState: () => {} },
    localStorage: storage,
    setTimeout: () => 0,
    clearTimeout: () => {},
    scrollTo: () => {},
    addEventListener: () => {},
  };
  // `main.js` fala o `localStorage` GLOBAL sem janela (loadCompleted). Sem este
  // empréstimo o casco montaria a aba e morreria no meio, e a régua acusaria a
  // tela por um problema do dublê. Cada arquivo de teste é um processo próprio.
  const storageGlobalOriginal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const caminho = String(url);
    if (caminho === 'data/catalog.json') return { ok: true, status: 200, json: async () => CATALOGO };
    if (caminho === 'data/aulas/indice.json') return { ok: true, status: 200, json: async () => INDICE };
    if (caminho === `data/aulas/${CIRCUITOS.slug}.json`) return { ok: true, status: 200, json: async () => AULAS };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  let inst;
  try {
    inst = await iniciar({ document: doc, window: win });
  } finally {
    if (fetchOriginal === undefined) delete globalThis.fetch; else globalThis.fetch = fetchOriginal;
    if (storageGlobalOriginal === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { value: storageGlobalOriginal, configurable: true, writable: true });
  }
  assert.equal(inst?.ok, true, `o casco não subiu: ${inst?.motivo}`);
  return { doc, win, main, storage, inst, ir: (r) => inst.pintar(lerRota(r)) };
}

/** O storage de quem percorreu a estação e tem doze cartões maduros. */
function entradasProntas({ cartoes = true, estudo = true } = {}) {
  const entradas = {};
  if (estudo) entradas[ESTUDO_KEY] = serializarEstudo(estudoPercorrido());
  if (cartoes) entradas[CARTOES_KEY] = serializarCartoes({ versao: 1, cartoes: dozeCartoes() });
  return entradas;
}

const tela = (main) => porClasse(main, 'revisar')[0];

// ═══════════════════════ o fluxo, cartão a cartão ═══════════════════════

/** O sorteio gravado: a ordem é a do núcleo, e o teste a LÊ, nunca a repete. */
function sorteioDe(storage) {
  const bruto = storage.getItem('atlas.desafio.v1');
  assert.ok(bruto, 'a sessão do desafio não está na chave atlas.desafio.v1');
  return JSON.parse(bruto);
}

function comecar(main, storage) {
  botaoPorTexto(main, D.comecar).dispatch('click');
  const s = sorteioDe(storage);
  assert.equal(s.estacao, ID, 'a sessão gravou outra estação');
  assert.equal(s.cartoes.length, 12, 'o sorteio não trouxe os doze cartões maduros');
  return s;
}

/**
 * Responde um cartão. A ordem dos cliques é a da tela: ver a frente, mostrar o
 * verso, dizer se lembrou. Devolve a frente que estava na tela ANTES da resposta,
 * para a trava conferir que ela era a do cartão certo.
 */
function responderUm(main, storage, nota) {
  const antes = porClasse(main, 'revisar-frente')[0];
  const frente = antes ? antes._texto : null;
  botaoPorTexto(main, R.mostrarResposta).dispatch('click');
  botaoPorTexto(main, nota === 'lembrei' ? R.lembrei : R.errei).dispatch('click');
  return frente;
}

/** Os ids que faltam responder, na ordem do sorteio. */
function proximoId(storage) {
  const s = sorteioDe(storage);
  return s.cartoes[Object.keys(s.respostas || {}).length];
}

describe('S18c-1 — a tela do desafio, pelo caminho do app', () => {
  test('aprovando, a tela grava a dominada no arquivo da viagem', async () => {
    const { main, storage } = await abrirApp({ entradas: entradasProntas() });
    assert.ok(textoDe(main).trim() !== '', 'a rota do desafio abriu em branco');

    const s = comecar(main, storage);
    // Os DOZE, lembrados. Um deles é o da aula de exercício, e ele vem primeiro
    // na ordem do sorteio (regra 1 do `montarDesafio`) — conferido, não assumido.
    assert.equal(s.cartoes[0], 'cartao-1', 'o cartão da aula de exercício não abriu o sorteio');
    for (let i = 0; i < 12; i++) responderUm(main, storage, 'lembrei');

    // O carimbo no disco.
    const viagem = JSON.parse(storage.getItem(CHAVE_VIAGEM));
    const dominada = viagem?.dominadas?.[ID];
    assert.ok(dominada, `dominar não escreveu progresso.dominadas[${ID}]`);
    assert.equal(dominada.em, HOJE, 'o carimbo não levou o dia do desafio');
    assert.deepEqual([...dominada.lembrados].sort(), [...s.cartoes].sort(), 'o carimbo não lista os lembrados do sorteio');
    assert.equal(dominada.acertos, 12);
    assert.equal(dominada.total, 12);
    assert.equal(dominada.aulas, AULAS.aulas.length, 'a dominada não levou o total de aulas lido');
    assert.equal(dominada.cartoes, 12, 'a dominada não contou os cartões da estação');

    // O que a pessoa lê: o veredito e a frase do que foi medido.
    const h1 = porClasse(main, 'revisar-titulo');
    assert.equal(h1.length, 1, 'o fim não tem exatamente um h1');
    assert.equal(h1[0]._texto, D.aprovadoTitulo);
    assert.ok(textoDe(main).includes(fraseDaDominada(dominada)),
      'o aprovado não diz a frase dos números guardados');
    assert.ok(todos(main, (n) => n.tag === 'a').some((a) => a._texto === D.voltar(CIRCUITOS.title)),
      'o aprovado não devolve à estação');
    assert.equal(storage.getItem('atlas.desafio.v1'), null, 'a sessão não foi apagada no fim');
  });

  test('reprovando, os errados voltam para hoje e nada é carimbado', async () => {
    const { main, storage } = await abrirApp({ entradas: entradasProntas() });
    const s = comecar(main, storage);
    const errados = [];
    for (let i = 0; i < 12; i++) {
      const id = s.cartoes[i];
      // Três erros: 9 de 12 = 0,75, abaixo do corte de 0,8.
      const nota = i < 3 ? 'errei' : 'lembrei';
      responderUm(main, storage, nota);
      if (nota === 'errei') errados.push(id);
    }
    assert.equal(errados.length, 3);

    const arquivo = lerCartoes(storage.getItem(CARTOES_KEY));
    for (const id of errados) {
      assert.equal(arquivo.cartoes[id].devidoEm, HOJE,
        `o cartão errado ${id} não voltou para a fila de hoje`);
    }
    for (const id of s.cartoes.filter((c) => !errados.includes(c))) {
      assert.notEqual(arquivo.cartoes[id].devidoEm, HOJE,
        `o cartão lembrado ${id} foi movido para hoje à toa`);
    }

    const viagem = JSON.parse(storage.getItem(CHAVE_VIAGEM));
    assert.ok(!viagem?.dominadas?.[ID], 'um reprovado carimbou a estação');
    const h1 = porClasse(main, 'revisar-titulo');
    assert.equal(h1[0]._texto, D.reprovadoTitulo);
    assert.ok(textoDe(main).includes(D.reprovado(3)), 'o reprovado não diz quantos voltaram');
  });

  test('recarregar no meio mantém o sorteio e a posição', async () => {
    const { main, storage, ir } = await abrirApp({ entradas: entradasProntas() });
    const s = comecar(main, storage);
    // Quatro respostas, e a aba fecha.
    const frentes = [];
    for (let i = 0; i < 4; i++) frentes.push(responderUm(main, storage, 'lembrei'));

    const antes = sorteioDe(storage);
    assert.deepEqual(antes.cartoes, s.cartoes, 'o sorteio mudou dentro da sessão');
    assert.equal(Object.keys(antes.respostas).length, 4);

    await ir(ROTA);
    const depois = sorteioDe(storage);
    assert.deepEqual(depois.cartoes, s.cartoes, 'recarregar baralhou outra vez');
    assert.deepEqual(depois.respostas, antes.respostas, 'recarregar perdeu as respostas');
    assert.equal(porClasse(main, 'revisar-frente')[0]._texto,
      lerCartoes(storage.getItem(CARTOES_KEY)).cartoes[proximoId(storage)].frente,
      'a volta não caiu no cartão seguinte do mesmo sorteio');
    assert.ok(textoDe(main).includes(R.posicao(5, 12)), 'a posição não voltou em 5 de 12');
    // O cartão respondido não reaparece: a frente é a do quinto, e as quatro
    // primeiras ficaram para trás.
    assert.ok(!frentes.includes(porClasse(main, 'revisar-frente')[0]._texto));
  });

  test('estação inexistente mostra a saída da folha, nunca branco', async () => {
    const { main } = await abrirApp({ hash: '#/estacao/essa-nao-existe/desafio', entradas: entradasProntas() });
    assert.ok(textoDe(main).trim() !== '', 'deep-link de estação inexistente abriu em branco');
    const h1 = porClasse(main, 'revisar-titulo');
    assert.equal(h1.length, 1);
    assert.equal(h1[0]._texto, F.naoEstaNoMapa, 'a tela inventou uma saída para estação que não existe');
    const links = todos(main, (n) => n.tag === 'a');
    assert.equal(links.length, 1, 'a estação inexistente oferece mais de um caminho');
    assert.equal(links[0]._texto, F.voltarAoMapa);
    assert.equal(todos(main, (n) => n.tag === 'button').length, 0,
      'a estação inexistente tem um botão de ação sobre nada');
  });

  test('podeDesafiar diz não: a tela mostra O PORQUÊ dele, sem começar', async () => {
    // Percorrida e SEM cartões: a condição 4 do núcleo responde o porquê.
    const { main, storage } = await abrirApp({ entradas: entradasProntas({ cartoes: false }) });
    // O MESMO porquê que o núcleo daria à tela, recomputado aqui com os dados
    // do storage: a frase não é escrita no teste, é lida da fonte.
    const eixo = eixosDaEstacao(ID, {
      estudo: lerEstudo(storage.getItem(ESTUDO_KEY)),
      cartoes: lerCartoes(null),
      indice: INDICE,
      progresso: { completed: [ID], emCurso: [], conclusoes: {}, dominadas: {} },
      hoje: HOJE,
    });
    const p = podeDesafiar(eixo, lerEstudo(storage.getItem(ESTUDO_KEY)), lerCartoes(null), AULAS.aulas, HOJE);
    assert.equal(p.pode, false, 'fixture: sem cartões o desafio deveria estar bloqueado');
    assert.ok(p.porque, 'o núcleo devolveu «não» sem porquê');

    assert.equal(porClasse(main, 'revisar-titulo')[0]._texto, D.titulo(CIRCUITOS.title));
    assert.ok(textoDe(main).includes(p.porque),
      `a tela não mostrou o porquê do núcleo («${p.porque}»)`);
    assert.equal(todos(main, (n) => n.tag === 'button').length, 0,
      'a tela ofereceu «Começar» para um desafio que o núcleo nega');
    assert.ok(todos(main, (n) => n.tag === 'a').some((a) => a._texto === D.voltar(CIRCUITOS.title)),
      'o ainda-não não devolve à estação');
  });

  test('nenhum acerto aparece antes do fim, e o foco vai para a frente', async () => {
    const { main, storage, doc } = await abrirApp({ entradas: entradasProntas() });
    const s = comecar(main, storage);
    const arquivo = lerCartoes(storage.getItem(CARTOES_KEY));
    const palavras = ['acert', 'Acert', 'errad', 'Errad', 'certo', 'Certo', 'dominada', 'reprovad'];

    // O foco saiu do botão: `iniciar` foca o h1 da pintura, e cada resposta
    // repinta — o documento tem de dizer o nó da FRENTE, nunca um botão.
    assert.equal(doc.foco?.className?.includes('revisar-frente'), true,
      'depois de começar o foco não pousou na frente do primeiro cartão');

    for (let i = 0; i < 11; i++) {
      responderUm(main, storage, 'lembrei');
      const texto = textoDe(main);
      const h1s = porClasse(main, 'revisar-frente');
      assert.equal(h1s.length, 1, `no cartão ${i + 2} há mais de uma frente na tela`);
      // A frente que resta na tela é a do PRÓXIMO id do sorteio — a ordem é do
      // `montarDesafio`, e conferi-la aqui é o que impede a tela de reapresentar
      // o cartão que acabou de ser respondido.
      assert.equal(h1s[0]._texto, arquivo.cartoes[s.cartoes[i + 1]].frente,
        `respondido o ${i + 1}º, a tela não mostrou a frente do próximo cartão`);
      for (const p of palavras) {
        assert.ok(!texto.includes(p),
          `a tela falou do acerto no meio do desafio («${p}» em «${texto.slice(0, 160)}»)`);
      }
      // A confiança não existe aqui: o grupo é da Revisar, e o FSRS não agenda
      // um sorteio. Um grupo de botões que nada lê é controle sem função.
      assert.equal(porClasse(main, 'revisar-confianca').length, 0,
        'o desafio mostrou o grupo de confiança');
      assert.ok(texto.includes(R.posicao(i + 2, 12)), 'a posição do cartão sumiu');
    }
    assert.equal(sorteioDe(storage).cartoes.length, 12);
  });

  test('a sessão de outra estação não vaza para cá', async () => {
    const entradas = entradasProntas();
    // Uma sessão gravada para LOGICA, na chave real.
    entradas['atlas.desafio.v1'] = JSON.stringify({
      estacao: 'logica', cartoes: ['cartao-1'], respostas: {}, visto: false,
    });
    const { main, storage } = await abrirApp({ entradas });
    assert.ok(todos(main, (n) => n.tag === 'button').some((b) => b._texto === D.comecar),
      'a tela ofereceu «continuar» com o sorteio de outra estação');
    comecar(main, storage);
    assert.equal(sorteioDe(storage).estacao, ID, 'a sessão antiga sobreviveu ao recomeço');
  });

  test('o que o núcleo calcula é o que a tela pinta, conferido no disco', async () => {
    // Uma trava de CONCORDÂNCIA: refaz no node a conta do aprovado e compara com
    // o arquivo que a tela escreveu. Se a tela começar a remixar o carimbo
    // (como o round-trip do backup fazia com as datas), é aqui que aparece.
    const { main, storage } = await abrirApp({ entradas: entradasProntas() });
    const s = comecar(main, storage);
    for (let i = 0; i < 12; i++) responderUm(main, storage, i < 9 ? 'lembrei' : 'errei');

    const resultado = corrigirDesafio({ cartoes: s.cartoes },
      Object.fromEntries(s.cartoes.map((id, i) => [id, i < 9 ? 'lembrei' : 'errei'])));
    const esperado = aplicarResultado(
      { completed: [ID], emCurso: [], conclusoes: {}, dominadas: {} },
      { versao: 1, cartoes: dozeCartoes() }, ID, resultado,
      { aulas: AULAS.aulas.length, cartoes: 12 }, HOJE);
    assert.equal(resultado.aprovado, false, 'fixture: 9 de 12 não deveria aprovar');

    const gravado = JSON.parse(storage.getItem(CHAVE_VIAGEM));
    assert.deepEqual(gravado.dominadas || {}, esperado.progresso.dominadas,
      'o que a tela gravou diverge do que o núcleo calculou');
    const arquivoTela = lerCartoes(storage.getItem(CARTOES_KEY));
    for (const id of resultado.errados) {
      assert.equal(arquivoTela.cartoes[id].devidoEm, HOJE);
      assert.equal(esperado.cartoes.cartoes[id].devidoEm, HOJE, 'o núcleo também move — conferir os dois');
    }
    assert.ok(textoDe(main).includes(esperado.recado), 'a tela não mostrou o recado do núcleo');
  });
});
