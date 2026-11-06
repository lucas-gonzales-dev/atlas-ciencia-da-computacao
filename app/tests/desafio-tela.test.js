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
import { hrefDe, lerRota } from '../core/rotas.js';
import { dataLocal } from '../core/viagem.js';
import {
  ESTUDO_KEY, serializarEstudo, lerEstudo, abrirAula, estudarAula, pularAula,
} from '../core/estudo.js';
import {
  CARTOES_KEY, criarCartao, lerCartoes, serializarCartoes, diaSeguinte,
} from '../core/cartoes.js';
import { CHAVE_VIAGEM } from '../web/metro.js';
import {
  aplicarResultado, corrigirDesafio, podeDesafiar, fraseDaDominada,
} from '../core/desafio.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { desafio as D, folha as F, revisar as R, aulas as AU, fechamento as FC } from '../core/textos.js';
// `esperar` é o tique do fio: a folha pinta as aulas por promessa, e sem ele a
// régua mediria o dublê em vez da folha (mesmo padrão de jornada-eixos.test.js).
import { esperar } from './hdom.js';

// S18c-2: a chave crua do `completed`, a mesma que web/main.js lê e escreve
// (loadCompleted/saveCompleted). A folha decide `concluida-antes` por ela, e sem
// semear aqui o caso da concluída antes seria um progresso escrito à mão.
const CHAVE_COMPLETED = 'atlas.progresso.v1';

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
async function abrirApp({ entradas = {}, hash = ROTA, segurarFio = false, aulasNoAparelho = true } = {}) {
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
  const buscar = async (url) => {
    const caminho = String(url);
    if (caminho === 'data/catalog.json') return { ok: true, status: 200, json: async () => CATALOGO };
    if (caminho === 'data/aulas/indice.json') return { ok: true, status: 200, json: async () => INDICE };
    // `aulasNoAparelho: false` é o caso real da S13b que a folha ainda não
    // conhecia no desafio: o índice chegou, o JSON da estação não.
    if (caminho === `data/aulas/${CIRCUITOS.slug}.json`) {
      return aulasNoAparelho
        ? { ok: true, status: 200, json: async () => AULAS }
        : { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  globalThis.fetch = buscar;
  let inst;
  try {
    inst = await iniciar({ document: doc, window: win });
  } finally {
    // S18c-2: `segurarFio` deixa o `fetch` do teste ligado depois do `iniciar`,
    // porque a FOLHA pinta as aulas por promessa, um tick depois do casco
    // devolver. Solto cedo, o `fetch` global do node tentaria a URL relativa, a
    // promessa recusaria e a folha chegaria sem `aulas` — o verde acusaria a
    // folha por um problema do dublê. `soltar()` devolve o original no fim.
    if (!segurarFio) {
      if (fetchOriginal === undefined) delete globalThis.fetch; else globalThis.fetch = fetchOriginal;
    }
    if (storageGlobalOriginal === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { value: storageGlobalOriginal, configurable: true, writable: true });
  }
  assert.equal(inst?.ok, true, `o casco não subiu: ${inst?.motivo}`);
  return {
    doc, win, main, storage, inst,
    ir: (r) => inst.pintar(lerRota(r)),
    soltar: () => { if (fetchOriginal === undefined) delete globalThis.fetch; else globalThis.fetch = fetchOriginal; },
  };
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
    // S18c-2 (item 3): o fim saiu de `revisar-titulo` para `revisar-frente` — é o
    // momento da entrega, e o veredito tinha de chegar maior que a frente do
    // cartão que a pessoa acabou de responder. A trava segue a classe.
    const h1 = porClasse(main, 'revisar-frente');
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
    const h1 = porClasse(main, 'revisar-frente');
    assert.equal(h1[0]._texto, D.reprovadoTitulo);
    assert.ok(textoDe(main).includes(D.reprovado(3)), 'o reprovado não diz quantos voltaram');
    // S18c-2 (item 3): sem carimbo não há o que ir ver no Perfil — o link da
    // caderneta é só do aprovado, e o reprovado tem de continuar sem ele.
    assert.ok(!todos(main, (n) => n.tag === 'a').some((a) => a._texto === D.verCaderneta),
      'o reprovado ofereceu a caderneta, onde não há dominada nenhuma');
    // A frase do reprovado é o recado do núcleo, e sai no corpo, não na nota.
    const nota = porClasse(main, 'revisar-nota');
    assert.equal(nota.length, 0, 'a frase do fim voltou para a classe miúda');
    assert.equal(porClasse(main, 'revisar-sub').length, 1, 'o fim não tem a frase no corpo');
    assert.ok(!porClasse(main, 'revisar-frente').some((n) => n.tag !== 'h1'),
      'a classe da frente saiu do h1');
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

// ══════════════ S18c-2 — o desafio na folha, a dominada no mapa, a frase ══════════════
//
// A folha é onde a pessoa está, e até aqui ela não dizia nada sobre o desafio: a
// promessa morava no Perfil. O que se prova abaixo é o ponteiro (o link, só com a
// régua do núcleo dizendo «pode»), o porquê quando ela diz «não», as duas frases
// de estado (o convite na concluída-antes, o carimbo na dominada) e o silêncio na
// `fora` — mais a travessia: o clique que sai da folha e cai na rota do desafio.

/**
 * A folha desenhada pelo caminho do app: sobe o casco em `#/estacao/<slug>`,
 * espera o fio das aulas fechar (três ticks, os mesmos de `aulas-fio.test.js` e
 * `jornada-eixos.test.js`) e devolve a FOLHA inteira, não o `#conteudo` — quem
 * conta os primários tem de contar o painel, e a barra de navegação do casco tem
 * outra regra de toque.
 */
async function abrirFolha({ entradas = {}, painel = null, aulasNoAparelho = true } = {}) {
  const app = await abrirApp({
    entradas,
    hash: `#/estacao/${CIRCUITOS.slug}${painel ? `/${painel}` : ''}`,
    segurarFio: true,
    aulasNoAparelho,
  });
  await esperar(); await esperar(); await esperar();
  const folha = porClasse(app.main, 'folha')[0];
  assert.ok(folha, 'a folha não foi desenhada — sem painel não há o que conferir');
  return { ...app, folha };
}

/** A viagem de quem não tem carimbo nenhum, no formato que web/main.js lê. */
const SEM_CARIMBO = {
  [CHAVE_COMPLETED]: '[]',
  [CHAVE_VIAGEM]: JSON.stringify({ emCurso: [], conclusoes: {}, dominadas: {} }),
};

/**
 * DOMINAR a estação pelo caminho do app, e devolver o app AINDA VIVO com o
 * carimbo lido do storage.
 *
 * Nada aqui escreve `progresso.dominadas` à mão: a pessoa entra, responde e a
 * TELA carimba. É o que faz os dois testes de abaixo (a frase na folha, a cor no
 * mapa) provarem o circuito inteiro em vez de provarem uma fixture minha.
 *
 * O PRIMEIRO cartão é respondido `errei`, de propósito. Ele é o da aula de
 * exercício — a única `estudada` desta viagem — e é o único que dá trabalho à
 * régua fraca de `core/eixos.js` (`cor = lembradas / estudadas`): sem o carimbo a
 * conta fraca sai ZERO, com ele a cor é 1. Se os doze saíssem `lembrei`, a cor 1
 * poderia vir da régua e o teste não distinguishiria as duas contas — que é o
 * engano que o item 2 do pedido veio desfazer.
 */
async function dominarAEstacao() {
  const app = await abrirApp({
    entradas: { ...entradasProntas(), ...SEM_CARIMBO },
    hash: ROTA,
    segurarFio: true,
  });
  const { main, storage } = app;
  const s = comecar(main, storage);
  assert.equal(s.cartoes[0], 'cartao-1',
    'fixture: o cartão da aula de exercício não abriu o sorteio — o erro planeado cairia em outra aula');
  responderUm(main, storage, 'errei');
  for (let i = 1; i < s.cartoes.length; i++) responderUm(main, storage, 'lembrei');
  await esperar();
  assert.ok(textoDe(main).includes(D.aprovadoTitulo), 'o desafio não terminou aprovado');

  const viagem = JSON.parse(storage.getItem(CHAVE_VIAGEM));
  const dominada = viagem?.dominadas?.[ID];
  assert.ok(dominada, 'a tela aprovou e não escreveu progresso.dominadas');
  assert.equal(dominada.acertos, s.cartoes.length - 1, 'o carimbo não contou o erro planeado');
  return { ...app, dominada, sorteado: s, viagem };
}

/** O bloco do desafio na folha, com o elemento e o texto que a pessoa lê. */
function blocoDaFolha(folha) {
  const caixa = porClasse(folha, 'folha-desafio')[0];
  return {
    caixa,
    caixas: porClasse(folha, 'folha-desafio'),
    link: porClasse(folha, 'folha-desafio-link')[0] || null,
    texto: porClasse(folha, 'folha-desafio-texto')[0] || null,
    primarios: porClasse(folha, 'botao-primario'),
  };
}

describe('S18c-2 — a folha da estação: o link quando pode, o porquê quando não', () => {
  test('percorrida com doze cartões maduros: a folha mostra o link, leve, para a rota do desafio', async () => {
    const { folha, soltar, win, inst, main } = await abrirFolha({
      entradas: { ...entradasProntas(), ...SEM_CARIMBO },
    });
    try {
      const b = blocoDaFolha(folha);
      assert.ok(b.caixa, 'a estação está percorrida e pode: a folha não ofereceu o desafio');
      assert.equal(b.caixas.length, 1, 'nasceram dois blocos de desafio na mesma folha');
      assert.ok(b.link, `o bloco tem de ser o LINK, e veio texto: ${b.texto?._texto ?? '(vazio)'}`);
      assert.equal(b.link._texto, D.acaoNaFolha,
        `o link diz «${b.link._texto}», e a frase da casa é «${D.acaoNaFolha}»`);
      // A rota, conferida na função da casa, e não no href que eu acho que sai.
      assert.equal(b.link.getAttribute('href'),
        hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug, painel: 'desafio' }),
        `o link aponta para «${b.link.getAttribute('href')}»`);
      assert.equal(b.texto?._texto ?? null, null, 'oferecendo o desafio, a folha ainda escreveu uma frase');
      // SECUNDÁRIO (desenho J4): a folha continua tendo UM primário só — o de
      // retomar a aula. Dois botões cheios no mesmo painel é o defeito da 2d-2.
      assert.equal(b.primarios.length, 1,
        `a folha tem ${b.primarios.length} primários: o link do desafio virou botão cheio`);
      assert.ok(b.primarios.some((n) => n.tag === 'a' || n.tag === 'button'));

      // A TRAVESSIA. O mini-DOM não navega num clique — quem abre `href` é o
      // navegador, e fingir isso aqui seria testar o dublê. O que se prova é a
      // pergunta real: o href escrito na folha É a rota do desafio, lida pelo
      // parser da casa, e o app montado naquele endereço entrega a tela.
      const rota = lerRota(b.link.getAttribute('href'));
      assert.equal(rota?.tela, 'estacao', `o href «${b.link.getAttribute('href')}» não é uma estação`);
      assert.equal(rota.slug, CIRCUITOS.slug, `o href leva a «${rota.slug}», outra estação`);
      assert.equal(rota.painel, 'desafio', `o href não traz o painel do desafio: ${JSON.stringify(rota)}`);
      await inst.pintar(rota);
      await esperar();
      // A frase do primário é a do núcleo (`desafio.comecar`), lida de textos.js —
      // não uma string que eu inventei aqui: na primeira versão desta trava eu
      // procurei `D.entrar`, chave que nunca existiu, e o `undefined` não casa com
      // botão nenhum, então a travessia reprovaria um app CORRETO para sempre.
      const portal = todos(main, (n) => n.tag === 'button' && n._texto === D.comecar);
      assert.equal(portal.length, 1,
        'o href da folha chega numa rota que não entrega a tela do desafio');
    } finally {
      soltar();
    }
  });

  test('a régua diz não: a folha mostra O PORQUÊ do núcleo, e nenhum link', async () => {
    // Nove cartões maduros (um deles da aula de exercício) e três amadurecendo.
    const mapa = {};
    let i = 0;
    const escrever = (aula, criadoEm) => {
      i += 1;
      const r = criarCartao(mapa, { estacao: ID, aula: aula.id, n: aula.n,
        frente: `Frente ${i}`, verso: `Verso ${i}` }, criadoEm, `maduro-${i}`);
      assert.equal(r.ok, true, `fixture: cartão recusado (${r.erro})`);
      for (const [k, v] of Object.entries(r.cartoes)) mapa[k] = v;
    };
    escrever(EXERCICIO, CRIADO);
    for (const a of AULAS.aulas.slice(1, 9)) escrever(a, CRIADO);
    for (const a of AULAS.aulas.slice(9, 12)) escrever(a, `${ANTES(1)}T10:00`);
    const faltando = {
      ...entradasProntas({ cartoes: false }),
      ...SEM_CARIMBO,
      [CARTOES_KEY]: serializarCartoes({ versao: 1, cartoes: mapa }),
    };
    const { folha, soltar } = await abrirFolha({ entradas: faltando });
    try {
      const b = blocoDaFolha(folha);
      const p = podeDesafiar({ estagio: 'percorrida', id: ID }, lerEstudo(faltando[ESTUDO_KEY]),
        { cartoes: mapa }, AULAS.aulas, HOJE);
      assert.equal(p.pode, false, 'fixture: a régua deixou passar o que eu queria negar');
      assert.ok(b.caixa, `a folha não mostrou o porquê (${JSON.stringify(p)}): ele é o caminho de volta`);
      // O `?? null` não é enfeite: `assert.equal(<nó do mini-DOM>, null)` faz o
      // impressor de diferença do node varrer a árvore inteira, com os pais
      // circulares, e o processo morre em "heap out of memory" em vez de mostrar a
      // frase da trava. Compara-se o TEXTO do link, que é o que a folha escreveu.
      assert.equal(b.link?._texto ?? null, null,
        'a régua disse não e a folha ofereceu o desafio mesmo assim');
      assert.equal(b.texto?._texto, p.porque,
        `a folha escreveu «${b.texto?._texto}» e o núcleo respondeu «${p.porque}»`);
      // O caso é o do piso: faltam 1 dos 10, e três estão amadurecendo hoje.
      assert.equal(b.texto._texto, D.maturando(1), 'não é a frase de amadurecimento que se esperava');
    } finally {
      soltar();
    }
  });

  test('os cartões são todos novos: a folha pede o cartão do exercício, sem link', async () => {
    const mapa = {};
    let i = 0;
    for (const a of [EXERCICIO, ...AULAS.aulas.slice(1, 5)]) {
      i += 1;
      const r = criarCartao(mapa, { estacao: ID, aula: a.id, n: a.n,
        frente: `Frente ${i}`, verso: `Verso ${i}` }, `${ANTES(1)}T10:00`, `novo-${i}`);
      assert.equal(r.ok, true, `fixture: cartão recusado (${r.erro})`);
      for (const [k, v] of Object.entries(r.cartoes)) mapa[k] = v;
    }
    const { folha, soltar } = await abrirFolha({
      entradas: {
        ...entradasProntas({ cartoes: false }),
        ...SEM_CARIMBO,
        [CARTOES_KEY]: serializarCartoes({ versao: 1, cartoes: mapa }),
      },
    });
    try {
      const b = blocoDaFolha(folha);
      assert.ok(b.caixa, 'a estação está percorrida e a folha não disse nada');
      assert.equal(b.link?._texto ?? null, null, 'com cartão de um dia a folha abriu o desafio');
      assert.equal(b.texto?._texto, D.faltamCartoesDeExercicio([EXERCICIO.n]),
        'a frase esperada é a do cartão de exercício ainda sem medir');
    } finally {
      soltar();
    }
  });

  test('sem as aulas no aparelho: o bloco não nasce (a casa não descreve o que não chegou)', async () => {
    const { folha, soltar } = await abrirFolha({
      entradas: { ...entradasProntas(), ...SEM_CARIMBO },
      aulasNoAparelho: false,
    });
    try {
      const b = blocoDaFolha(folha);
      assert.ok(!b.caixa,
        'a folha montou o bloco do desafio sobre uma lista de aulas que não chegou');
    } finally {
      soltar();
    }
  });
});

describe('S18c-2 — as frases por estágio na folha', () => {
  test('fora: NADA. A folha não fala de desafio em quem não passou pela estação', async () => {
    const { folha, soltar } = await abrirFolha({
      entradas: {
        ...SEM_CARIMBO,
        [ESTUDO_KEY]: serializarEstudo({ versao: 1, ultima: null, aulas: {} }),
        [CARTOES_KEY]: serializarCartoes({ versao: 1, cartoes: {} }),
      },
    });
    try {
      const b = blocoDaFolha(folha);
      assert.ok(!b.caixa, 'a estação «fora» ganhou bloco de desafio');
      // A folha inteira é lida, não só o bloco: a régua é «nenhuma palavra sobre
      // desafio», e um texto solto fora da caixa contaria igual.
      assert.ok(!textoDe(folha).toLowerCase().includes('desafio'),
        `a folha falou em desafio para quem não começou: ${textoDe(folha)}`);
    } finally {
      soltar();
    }
  });

  test("concluída no carimbo antigo ('concluida-antes'): o convite, sem régua e sem link", async () => {
    const { folha, soltar } = await abrirFolha({
      entradas: {
        ...SEM_CARIMBO,
        [CHAVE_COMPLETED]: JSON.stringify([ID]),
        [CHAVE_VIAGEM]: JSON.stringify({
          emCurso: [], conclusoes: { [ID]: `${ANTES(30)}T10:00` }, dominadas: {},
        }),
        [ESTUDO_KEY]: serializarEstudo({ versao: 1, ultima: null, aulas: {} }),
      },
    });
    try {
      const b = blocoDaFolha(folha);
      assert.ok(b.caixa, "a 'concluida-antes' ficou muda: a caderneta promete o desafio e a folha não");
      assert.equal(b.texto?._texto, D.conviteConcluidaAntes,
        `a folha escreveu «${b.texto?._texto}» em vez do convite`);
      assert.ok(!/fora/.test(b.texto._texto), 'o convite vazou o nome interno do estágio');
      assert.ok(!/«/.test(b.texto._texto), 'o convite devolveu um estágio entre aspas');
      assert.equal(b.link?._texto ?? null, null, 'a folha abriu o desafio sobre um carimbo sem medição nenhuma');
      // O ramo é OBRIGATÓRIO, não cosmético: passada pela régua, a concluída
      // antes responderia com o `porque` do núcleo, que fala de aula de exercício
      // para quem tem um carimbo sem medição nenhuma. A frase da folha não vem de
      // lá, e é isto que a linha abaixo trava.
      const p = podeDesafiar({ estagio: 'concluida-antes', id: ID }, lerEstudo(null),
        lerCartoes(null), AULAS.aulas, HOJE);
      assert.equal(p.pode, false, 'fixture: o núcleo deixou passar a concluída antes');
      assert.ok(p.porque && p.porque !== D.conviteConcluidaAntes,
        `o convite viria do núcleo, e o núcleo responde «${p.porque}»`);
      assert.notEqual(b.texto._texto, p.porque,
        'a folha despejou o porquê do núcleo em vez do convite');
    } finally {
      soltar();
    }
  });

  test('dominada: a folha mostra a frase do carimbo, e nenhum link para perdê-lo', async () => {
    const app = await dominarAEstacao();
    // O storage que a TELA escreveu, lido byte a byte e reseedado num app novo:
    // é a viagem da pessoa depois do carimbo, não uma fixture minha.
    const entradas = {};
    for (const chave of [ESTUDO_KEY, CARTOES_KEY, CHAVE_COMPLETED, CHAVE_VIAGEM]) {
      entradas[chave] = app.storage.getItem(chave);
    }
    app.soltar();
    const { folha, soltar } = await abrirFolha({ entradas });
    try {
      const b = blocoDaFolha(folha);
      assert.ok(b.caixa, 'a dominada ficou muda na folha');
      assert.equal(b.caixas.length, 1, 'nasceram dois blocos na folha da dominada');
      assert.equal(b.texto?._texto, fraseDaDominada(app.dominada),
        `a folha escreveu «${b.texto?._texto}» em vez da frase do que foi medido`);
      assert.ok(!/fora/.test(b.texto._texto), 'a frase da dominada vazou o nome interno do estágio');
      assert.equal(b.link?._texto ?? null, null,
        'a folha ofereceu refazer o desafio sobre um carimbo aprovado — refazer é a única forma de perdê-lo');
    } finally {
      app.soltar();
    }
  });
});

describe('S18c-2 — a dominada no mapa e a palavra proibida', () => {
  test('depois de aprovar, pelo app: o eixo da estação tem cor 1 e estágio dominada', async () => {
    const app = await dominarAEstacao();
    const { storage, main, soltar } = app;
    try {
      // O eixo, com o que o app tem no storage AGORA — a conta é do núcleo, o
      // resto é do app. O carimbo está no disco porque a TELA o escreveu.
      const eixo = eixosDaEstacao(ID, {
        estudo: lerEstudo(storage.getItem(ESTUDO_KEY)),
        cartoes: lerCartoes(storage.getItem(CARTOES_KEY)),
        progresso: {
          completed: JSON.parse(storage.getItem(CHAVE_COMPLETED) || '[]'),
          emCurso: [], conclusoes: {}, dominadas: app.viagem.dominadas,
        },
        indice: INDICE,
        hoje: HOJE,
      });
      assert.equal(eixo.estagio, 'dominada', `o estágio veio «${eixo.estagio}»`);
      assert.equal(eixo.cor, 1,
        `a dominada saiu do mapa com cor ${eixo.cor} (lembradas ${eixo.lembradas} de ${eixo.estudadas})`);
      // A régua fraca, lida sem o carimbo no mesmo storage: é ela que o `cor: 1`
      // substitui. Se esta linha der cor 1, o teste deixou de provar o carimbo.
      const eixoSemCarimbo = eixosDaEstacao(ID, {
        estudo: lerEstudo(storage.getItem(ESTUDO_KEY)),
        cartoes: lerCartoes(storage.getItem(CARTOES_KEY)),
        progresso: { completed: [ID], emCurso: [], conclusoes: {}, dominadas: {} },
        indice: INDICE, hoje: HOJE,
      });
      assert.ok(eixoSemCarimbo.cor < 1,
        `fixture: a conta fraca já dava cor ${eixoSemCarimbo.cor} — o teste não distinguiria o carimbo`);
      assert.equal(eixoSemCarimbo.estagio, 'percorrida',
        `sem o carimbo a estação deveria voltar a 'percorrida', e veio «${eixoSemCarimbo.estagio}»`);
      // Dominar não congela a memória: as lembradas continuam contadas.
      assert.ok(Number.isFinite(eixo.lembradas), 'as lembradas deixaram de ser medidas');
      assert.equal(eixo.lembradas, eixoSemCarimbo.lembradas,
        'a dominada mudou a CONTA das lembradas, quando deveria mudar só a cor');

      // O HTML do mapa fica para `mapa-eixos.test.js`, que já espera o fio do
      // topo; o que esta régua mede é o eixo, e é nele que `cor: 1` nasce.
      assert.ok(app.dominada.em, 'o carimbo não levou a data do dia');
    } finally {
      soltar();
    }
  });

  test('nenhuma frase do desafio diz «fora», nem na estação em que ninguém tocou', () => {
    assert.match(D.naoPercorrida('fora'), /ainda não começou/, 'a frase da `fora` não é a nova');
    for (const estagio of ['fora', 'embarcada', 'em-percurso', '', undefined, null]) {
      const p = podeDesafiar({ estagio, id: ID }, lerEstudo(null), lerCartoes(null), AULAS.aulas, HOJE);
      assert.equal(p.pode, false, `o desafio abriu para o estágio «${estagio}»`);
      assert.ok(p.porque, `sem estágio «${estagio}» o núcleo devolveu pode:false e porque:null`);
      assert.ok(!/\bfora\b/.test(p.porque), `«${p.porque}» vazou o nome interno do estágio`);
      assert.ok(!/«fora»/.test(p.porque), `«${p.porque}» devolveu «fora» entre aspas`);
      for (const frase of [D.conviteConcluidaAntes, fraseDaDominada({ acertos: 10, total: 12 })]) {
        assert.ok(!/\bfora\b/.test(frase), `«${frase}» contém a palavra «fora»`);
      }
    }
    // A folha, lida pelo texto que ela escreve no caso da `fora`, está no teste
    // de acima; aqui fica a régua do texto, que é a que pega quem só escreve.
    assert.ok(!/\bfora\b/.test(F.eixos(3, AULAS.aulas.length, 1)),
      'a linha de medida da folha usou a palavra proibida');
  });
});

// ═══════ S18c-3 — escrever cartão em aula já estudada, e o verbo da estação ═══════
//
// O BECO SEM SAÍDA, medido no Chrome numa estação de 13 aulas com 3 cartões: a
// folha dizia «escreva mais 7 ao fechar as aulas» e a aula fechada não tem
// formulário nenhum — mostra «Estudada em 20/10/2026» e a Próxima. A régua do
// desafio (piso de 10 cartões) era inatingível para quem já percorreu a estação.
// O que se prova abaixo é a porta reaberta, pelo caminho do app, e o verbo honesto
// da folha quando não há mais o que continuar.

/** A viagem de quem estudou UMA aula (a 1) e não tocou nas outras 92. */
function estudoDeUmaAula() {
  let e = { versao: 1, ultima: null, aulas: {} };
  const a = AULAS.aulas[0];
  e = abrirAula(e, { estacao: ID, aula: a.id, n: a.n }, CRIADO);
  return estudarAula(e, { estacao: ID, aula: a.id, n: a.n }, CRIADO,
    { recordacao: 'lembrei a origem', conferencia: 'conferi no vídeo' });
}

/** A página de uma aula, pelo casco. `n` é o número na playlist. */
async function abrirPaginaDaAula({ entradas = {}, n = 1 } = {}) {
  const app = await abrirApp({
    entradas,
    hash: `#/estacao/${CIRCUITOS.slug}/aula/${n}`,
    segurarFio: true,
  });
  await esperar(); await esperar(); await esperar();
  return app;
}

const botaoPorData = (raiz, attr, valor = null) => {
  const achei = todos(raiz, (n) => n.tag === 'button'
    && n.hasAttribute(attr) && (valor === null || n.getAttribute(attr) === valor));
  assert.equal(achei.length, 1, `esperava exatamente um botão com ${attr}, achei ${achei.length}`);
  return achei[0];
};

/** O campo do bloco de "escrever mais", achado pelo `data-campo` do fechamento. */
const campoEm = (raiz, nome) => {
  const c = todos(raiz, (n) => n.tag === 'textarea' && n.getAttribute('data-campo') === nome)[0];
  assert.ok(c, `o campo ${nome} não está na tela`);
  return c;
};

// S18c-4: a caixa do «escrever mais» deixou de dividir o nome com o botão «Outro
// cartão» (`.fechamento-mais`), porque a folha a desenhava com a moldura do botão.
// Os botões dentro dela guardam o nome antigo (`fechamento-mais-abrir/-guardar`);
// o que mudou foi só a caixa que os agrupa.
const caixaMais = (main) => porClasse(main, 'fechamento-escrever')[0];

/** Tocar «Escrever mais um cartão» e devolver a caixa do editor aberto. */
function abrirEditor(app) {
  botaoPorData(app.main, 'data-escrever-mais').dispatch('click');
  const caixa = caixaMais(app.main);
  assert.ok(caixa, 'tocar «escrever mais» não abriu o editor');
  return caixa;
}

/** Escrever nas duas faces e guardar, pelo toque. Devolve o total no disco. */
function guardar(app, caixa, frente, verso) {
  campoEm(caixa, 'frente-0').value = frente;
  campoEm(caixa, 'verso-0').value = verso;
  botaoPorData(caixa, 'data-guardar-mais').dispatch('click');
  return Object.keys(lerCartoes(app.storage.getItem(CARTOES_KEY)).cartoes).length;
}

/** Os dois gestos de uma vez, para quem não abriu o editor ainda. */
function escreverEGuardar(app, frente, verso) {
  return guardar(app, abrirEditor(app), frente, verso);
}

describe('S18c-3 — a aula estudada recebe cartão novo', () => {
  test('a aula já estudada oferece «Escrever mais um cartão»', async () => {
    const app = await abrirPaginaDaAula({ entradas: { [ESTUDO_KEY]: serializarEstudo(estudoDeUmaAula()) } });
    try {
      assert.ok(app.main, 'a página abriu vazia');
      const texto = textoDe(app.main);
      assert.ok(texto.includes(FC.estudadaEm(CRIADO)),
        `a tela não diz a data do estudo: ${texto.slice(0, 160)}`);
      const b = botaoPorData(app.main, 'data-escrever-mais');
      assert.equal(b._texto, FC.escreverMais, 'o botão não diz a frase de textos.js');
      // SECUNDÁRIO, sempre: o primário da conclusão é a Próxima (S14c/item 1).
      assert.ok(b.classList.contains('botao-secundario'), 'escrever mais saiu com desenho de primário');
      assert.ok(!b.classList.contains('botao-primario'), 'escrever mais virou o segundo primário da tela');
      // Antes do editor, não há campo nenhum na tela.
      assert.equal(porClasse(app.main, 'fechamento-cartao').length, 0,
        'a aula estudada já abriu com formulário na tela');
    } finally { app.soltar(); }
  });

  test('o toque troca o botão pelo editor, e guardar grava, repinta e leva o foco à frase', async () => {
    const app = await abrirPaginaDaAula({ entradas: { [ESTUDO_KEY]: serializarEstudo(estudoDeUmaAula()) } });
    try {
      const antes = Object.keys(lerCartoes(app.storage.getItem(CARTOES_KEY) || null).cartoes).length;
      assert.equal(antes, 0, 'fixture: a viagem nasceu com cartão');
      const caixa = abrirEditor(app);
      assert.equal(todos(app.main, (n) => n.hasAttribute('data-escrever-mais')).length, 0,
        'o botão ficou na tela depois de abrir o editor');
      // Os MODELOS do editor, vivos: cinco botões que escrevem na pergunta. Sem
      // ouvinte eles teriam cara de botão e nenhum efeito — o que a auditoria de
      // teclado da casa nomeia.
      const modelo = todos(caixa, (n) => n.tag === 'button' && n.hasAttribute('data-modelo'))[0];
      assert.ok(modelo, 'o editor do cartão extra perdeu os modelos de frente');
      modelo.dispatch('click', { target: modelo });
      assert.ok(campoEm(caixa, 'frente-0').value.length > 0,
        'tocar um modelo não escreveu nada na pergunta');
      guardar(app, caixa, 'O que um capacitor faz?', 'Segura carga por um instante.');
      const depois = Object.keys(lerCartoes(app.storage.getItem(CARTOES_KEY)).cartoes).length;
      assert.equal(depois, 1, 'guardar não chegou ao storage');
      const lido = lerCartoes(app.storage.getItem(CARTOES_KEY)).cartoes;
      const novo = Object.values(lido)[0];
      assert.equal(novo.estacao, ID, 'o cartão novo não diz a estação');
      assert.equal(novo.aula, AULAS.aulas[0].id, 'o cartão novo não diz a aula');
      assert.equal(novo.n, AULAS.aulas[0].n, 'o cartão novo não diz o número da aula');
      // Repinta com o cartão na lista, e o convite volta para o próximo.
      const leituras = porClasse(app.main, 'fechamento-leitura');
      assert.equal(leituras.length, 1, 'depois de guardar a lista não mostra o cartão novo');
      assert.ok(textoDe(leituras[0]).includes('O que um capacitor faz?'),
        'a leitura não mostra a frente escrita');
      assert.ok(botaoPorData(app.main, 'data-escrever-mais'),
        'depois de guardar sumiu o convite para o próximo cartão');
      // O foco: a frase de status, que é o fato acabado de escrever.
      assert.ok(app.doc.foco?.classList?.contains('fechamento-feito-frase'),
        `o foco não pousou na frase de status (veio ${(app.doc.foco?.className || '(ninguém)')})`);
    } finally { app.soltar(); }
  });

  test('campo vazio mostra a frase do núcleo e não grava nada', async () => {
    const app = await abrirPaginaDaAula({ entradas: { [ESTUDO_KEY]: serializarEstudo(estudoDeUmaAula()) } });
    try {
      const caixa = abrirEditor(app);
      botaoPorData(caixa, 'data-guardar-mais').dispatch('click');
      assert.equal(app.storage.getItem(CARTOES_KEY), null,
        'guardar sem escrever criou o arquivo de cartões no aparelho');
      const erros = porClasse(app.main, 'fechamento-erro');
      assert.equal(erros.length, 1, `a recusa deveria escrever uma linha, veio ${erros.length}`);
      // A frase é a do core/cartoes.js, não uma escrita aqui: uma segunda régua
      // na tela divergiria da do núcleo em seis meses.
      const esperado = criarCartao({ cartoes: {} }, { estacao: ID, aula: AULAS.aulas[0].id,
        n: 1, frente: '', verso: '' }, `${HOJE}T10:00`, 'x').erro;
      assert.equal(erros[0]._texto, esperado, `a tela recusou com «${erros[0]._texto}»`);
      const frente = campoEm(caixa, 'frente-0');
      assert.equal(frente.getAttribute('aria-invalid'), 'true', 'o campo recusado não se diz inválido');
      assert.equal(frente.getAttribute('aria-describedby'), `${frente.getAttribute('id')}-erro`,
        'a frase de erro não está apontada pelo aria-describedby');
      // A recusa não fecha o editor nem joga a pessoa de volta: o campo continua
      // ali, com o que ela escreveu. Fechar no erro era obrigá-la a reabrir e
      // redigitar, e é o gesto que o fechamento já evita desde a S14b2.
      assert.ok(caixaMais(app.main), 'a recusa sumiu com o editor');
      assert.equal(todos(app.main, (n) => n.hasAttribute('data-escrever-mais')).length, 0,
        'a recusa trocou o editor pelo botão de abrir');
      assert.ok(porClasse(app.main, 'fechamento-mais-guardar')[0],
        'a recusa tirou da tela o botão de guardar');
    } finally { app.soltar(); }
  });

  test('o cartão escrito hoje conta para o desafio dois dias depois', async () => {
    // Nove cartões maduros (um da aula de exercício): a estação está percorrida,
    // o piso de dez não é atingido, e o que falta é exatamente um cartão.
    const mapa = {};
    let i = 0;
    const escrever = (aula) => {
      i += 1;
      const r = criarCartao(mapa, { estacao: ID, aula: aula.id, n: aula.n,
        frente: `Frente ${i}`, verso: `Verso ${i}` }, CRIADO, `maduro-${i}`);
      assert.equal(r.ok, true, `fixture: cartão recusado (${r.erro})`);
      for (const [k, v] of Object.entries(r.cartoes)) mapa[k] = v;
    };
    escrever(EXERCICIO);
    for (const a of AULAS.aulas.slice(1, 9)) escrever(a);
    assert.equal(Object.keys(mapa).length, 9, 'fixture: não são nove cartões maduros');

    const entradas = {
      [ESTUDO_KEY]: serializarEstudo(estudoPercorrido()),
      [CARTOES_KEY]: serializarCartoes({ versao: 1, cartoes: mapa }),
    };
    const eixo = { estagio: 'percorrida', id: ID };
    const estudo = lerEstudo(entradas[ESTUDO_KEY]);
    const hoje = podeDesafiar(eixo, estudo, { cartoes: mapa }, AULAS.aulas, HOJE);
    assert.equal(hoje.pode, false, 'fixture: nove cartões deveriam negar o desafio');
    assert.equal(hoje.porque, D.escrevaMais(1), 'a régua não respondeu com a frase dos dez');

    // A pessoa escreve o décimo NA AULA DE EXERCÍCIO, já estudada.
    const app = await abrirPaginaDaAula({ entradas, n: EXERCICIO.n });
    let total = 0;
    try {
      total = escreverEGuardar(app, 'Décimo cartão', 'O que a régua cobra.');
    } finally { app.soltar(); }
    assert.equal(total, 10, 'o cartão escrito na tela não chegou ao arquivo');

    // Relido do STORAGE, não do `entradas`: `storageCom` copia as entradas para
    // dentro do dublê, e o cartão escrito no clique vive só na cópia. Ler a
    // entrada seria conferir o snapshot de antes do toque — régua que passaria
    // verde com a tela gravando em lugar nenhum.
    const arquivo = lerCartoes(app.storage.getItem(CARTOES_KEY));
    // hoje ainda não chega, porque cartão novo é resposta que
    // ainda está na cabeça (core/desafio.js, IDADE_MINIMA_DIAS).
    const noHoje = podeDesafiar(eixo, estudo, arquivo, AULAS.aulas, HOJE);
    assert.equal(noHoje.pode, false, 'o desafio abriu com um cartão escrito hoje');
    // Dois dias depois, o mesmo arquivo, sem tocar em nada, abre.
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const daquiADois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const depois = podeDesafiar(eixo, estudo, arquivo, AULAS.aulas, daquiADois);
    assert.equal(depois.pode, true, `dois dias depois ainda não pode: ${JSON.stringify(depois)}`);
  });
});

describe('S18c-3 — o verbo da estação inteira', () => {
  /** O primário do painel de aulas, lido pelo texto que a folha escreve. */
  const primarioDaFolha = (folha) => {
    const p = porClasse(folha, 'aulas-primario')[0];
    assert.ok(p, 'a folha não desenhou o primário das aulas');
    return p;
  };

  test('estação toda estudada: a folha diz «Rever», e o href leva à aula', async () => {
    let estudo = { versao: 1, ultima: null, aulas: {} };
    for (const a of AULAS.aulas) {
      estudo = abrirAula(estudo, { estacao: ID, aula: a.id, n: a.n }, CRIADO);
      estudo = estudarAula(estudo, { estacao: ID, aula: a.id, n: a.n }, CRIADO,
        { recordacao: 'r', conferencia: 'c' });
    }
    const { folha, soltar } = await abrirFolha({
      entradas: { ...SEM_CARIMBO, [ESTUDO_KEY]: serializarEstudo(estudo) },
    });
    try {
      const ultima = AULAS.aulas[AULAS.aulas.length - 1];
      const p = primarioDaFolha(folha);
      assert.equal(p._texto, AU.rever(ultima.n, ultima.titulo),
        `a estação inteira estudada disse «${p._texto}»`);
      assert.ok(/^Rever: Aula /.test(p._texto), 'o verbo da estação percorrida não é Rever');
      assert.ok(!/^Continuar/.test(p._texto), 'a folha continua oferecendo continuar o que já foi');
      assert.equal(p.getAttribute('href'),
        hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug, painel: 'aula', n: ultima.n }),
        'o Rever não aponta para a aula que ele nomeia');
    } finally { soltar(); }
  });

  test('estação pela metade: a folha continua dizendo «Continuar»', async () => {
    const { folha, soltar } = await abrirFolha({
      entradas: { ...SEM_CARIMBO, [ESTUDO_KEY]: serializarEstudo(estudoDeUmaAula()) },
    });
    try {
      const p = primarioDaFolha(folha);
      const segunda = AULAS.aulas[1];
      assert.equal(p._texto, AU.continuar(segunda.n, segunda.titulo),
        `com 1 de 93 estudada a folha disse «${p._texto}»`);
      assert.ok(!/Rever/.test(p._texto), 'a estação pela metade chamou de rever o que falta estudar');
    } finally { soltar(); }
  });
});
