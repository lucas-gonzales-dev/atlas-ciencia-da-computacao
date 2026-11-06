// Projeto Atlas — a trava da ENGRENARIA DO CAOS (S19c, 06/11/2026).
//
// POR QUE ESTE ARQUIVO EXISTE: 348 cenários de falha foram rodados contra o app
// (disco cheio, dados podres em cada chave, rede caindo, JSON falso). O app
// aguentou quase tudo, e os dois que sobraram são exatamente do tipo que a
// suíte não via porque nenhum dublê jamais NEGOU um armazenamento nem PERGUNTOU
// se a estação existe antes de desenhar:
//
//   1. TELA BRANCA COM O ARMAZENAMENTO BLOQUEADO. Com «bloquear dados de sites»
//      ligado, o GETTER de `window.localStorage` lança `SecurityError` ao ser
//      LIDO. O casco lê o storage no `iniciar`, o throw subia, o catch escrevia
//      no console e o aluno ficava com marca + abas + `<main>` vazio em toda
//      rota. Nunca houve teste: o `win` de todo teste tinha `localStorage`.
//   2. ESTAÇÃO INEXISTENTE VIRA PÁGINA. `#/estacao/x/aulas` desenhava "Aulas
//      de x" sobre uma lista vazia, afirmando uma estação que o catálogo nega.
//
// O CAMINHO DO APP, SEMPRE (a lição da S13b, escrita na casa duas vezes): nada
// aqui chama `montar` com um ctx inventado. Os casos 3 e 4 sobem o CASCO de
// verdade no mini-DOM, com o catálogo REAL de data/catalog.json e o
// `globalThis.fetch` roteado pelo URL — é o que distingue "a função existe" de
// "a pessoa vê o aviso".
//
// A MENTIRA QUE O DUBLÊ CONTAVA: `win` era um objeto de literal com
// `localStorage: storageCom()`. Ler uma propriedade de literal não estoura
// nunca, por construção. Aqui o getter ESTOURA, e o `globalThis.localStorage`
// é emprestado DELE — no navegador o global é a propriedade da janela, e
// delegar é o que faz `web/main.js`, que fala o global sem janela, ver o mesmo
// armazém que o casco trocou. Sem delegar, o teste provaria o casco e mentiria
// sobre a tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, storageCom, todos, textoDe } from './hdom.js';
import { garantirArmazem } from '../web/armazem-seguro.js';
import { iniciar } from '../web/casco.js';
import { montar as montarAulas } from '../web/telas/aulas.js';
import { montar as montarAula } from '../web/telas/aula.js';
import { lerRota } from '../core/rotas.js';
import { casco } from '../core/textos.js';
import { aulas as AU, folha as F } from '../core/textos.js';

const LER = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const CATALOGO = JSON.parse(LER('data/catalog.json'));
const CURSOS = CATALOGO.courses || [];
assert.ok(CURSOS.length > 0, 'fixture: catálogo vazio não prova estação inexistente');

const SLUG_FANTASMA = 'essa-nao-existe';
assert.ok(
  !CURSOS.some((c) => c.slug === SLUG_FANTASMA || String(c.id) === SLUG_FANTASMA),
  `fixture: ${SLUG_FANTASMA} está no catálogo de verdade e o caso perde o sentido`
);

/** Um `win` cujo acesso ao armazenamento estoura, como no navegador bloqueado. */
function winSemArmazem(hash = '#/') {
  const win = {
    location: { hash },
    history: { replaceState: () => {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    scrollTo: () => {},
    addEventListener: () => {}
  };
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    get() {
      const erro = new Error('Access is denied for this document.');
      erro.name = 'SecurityError';
      throw erro;
    }
  });
  return win;
}

/**
 * O `win` do casco, montado como o index.html: pular, topo>nav, selo de rede,
 * main#conteudo e anúncio. Mesma estrutura de desafio-tela.test.js:155 — se o
 * invólucro divergir do HTML, o aviso cai num lugar que nenhum aluno vê.
 */
function involucre() {
  const doc = criarDoc();
  const m = (tag, opts = {}) => {
    const no = doc.createElement(tag);
    no.className = opts.classe || '';
    for (const [k, v] of Object.entries(opts.attrs || {})) no.setAttribute(k, v);
    if (opts.id) doc._registrar(opts.id, no);
    return no;
  };
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
    m('p', { id: 'anuncio', classe: 'so-leitor', attrs: { 'aria-live': 'polite' } })
  );
  return { doc, main };
}

/**
 * Sobe o CASCO com o `win` dado. O `fetch` é emprestado pelo tempo do `iniciar`
 * e volta ao original depois; o `localStorage` global é emprestado do `win`
 * (delegando ao getter dele, bloqueado ou não) e devolvido ao final.
 */
async function subirApp(win, { catalogo = CATALOGO } = {}) {
  const { doc, main } = involucre();
  const storageOriginal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const fetchOriginal = globalThis.fetch;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => win.localStorage
  });
  globalThis.fetch = async (url) => {
    const caminho = String(url);
    if (caminho === 'data/catalog.json') return { ok: true, status: 200, json: async () => catalogo };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  let inst;
  let lancou = null;
  try {
    inst = await iniciar({ document: doc, window: win });
  } catch (erro) {
    lancou = erro;
  } finally {
    globalThis.fetch = fetchOriginal;
    if (storageOriginal) Object.defineProperty(globalThis, 'localStorage', storageOriginal);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
  return { doc, main, inst, lancou, ir: (rota) => inst.pintar(lerRota(rota)) };
}

const porClasse = (raiz, classe) =>
  todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));

// ════════════════════ 1 e 2: o armazém, na mão ════════════════════

test('garantirArmazem: navegador negando o storage instala o armazém de memória, e ele guarda', () => {
  const win = winSemArmazem();
  assert.equal(garantirArmazem(win), true, 'o casco não percebeu que ficou sem armazenamento');

  const armazem = win.localStorage;
  assert.equal(typeof armazem.getItem, 'function', 'sem getItem o main.js morre na primeira leitura');
  assert.equal(armazem.getItem('qualquer'), null, 'armazém novo não pode nascer com dado');

  armazem.setItem('atlas.progresso.v1', '{"completed":[]}');
  assert.equal(armazem.getItem('atlas.progresso.v1'), '{"completed":[]}', 'guardou e não devolveu');
  assert.equal(armazem.length, 1, 'length não conta o que foi escrito');
  assert.equal(armazem.key(0), 'atlas.progresso.v1', 'key(0) é como o storage real nomeia as chaves');
  assert.equal(armazem.getItem('de outra chave'), null, 'inventou valor para chave que ninguém escreveu');

  armazem.removeItem('atlas.progresso.v1');
  assert.equal(armazem.getItem('atlas.progresso.v1'), null, 'removeItem não removeu');
  armazem.setItem('a', '1');
  armazem.setItem('b', '2');
  armazem.clear();
  assert.equal(armazem.length, 0, 'clear não esvaziou');
});

test('garantirArmazem: com o storage liberado, não troca nada — o armazém é o do navegador', () => {
  const real = storageCom();
  const win = { localStorage: real };
  assert.equal(garantirArmazem(win), false, 'avisou sem-armazenamento onde havia armazenamento');
  assert.equal(win.localStorage, real, 'trocou o storage vivo do aluno por memória: a perda seria dele');

  // Um getter que estoura por OUTRO motivo (modo privado que nega sem
  // SecurityError, ou o próprio disco cheio no acesso) pede a mesma resposta:
  // a peça decide pela FALHA, não pelo nome do erro — nomear um só seria
  // adivinhar o navegador.
  const outroLanca = {};
  Object.defineProperty(outroLanca, 'localStorage', {
    configurable: true,
    get() { throw new Error('QuotaExceeded'); }
  });
  assert.equal(garantirArmazem(outroLanca), true, 'falha que não é SecurityError ficou de fora');
  // `configurable: true` não é detalhe: em navegador real o getter negado é
  // own-property, e um defineProperty não-configurável travaria a troca no
  // primeiro `iniciar` e o casco nunca mais conseguiria ler storage nenhum.
  const descritor = Object.getOwnPropertyDescriptor(outroLanca, 'localStorage');
  assert.equal(descritor.configurable, true, 'armazém de memória não-configurável é um cadeado');

  // A leitura que NÃO estoura não mexe em nada — inclusive quando o storage é
  // um objeto incompleto (sem getItem): trocar sem falha seria a peça mentir
  // sobre o aparelho. O pedido é literal: "Sem falha, não mexe em nada e
  // devolve false".
  const antes = storageCom();
  const meio = { localStorage: antes };
  assert.equal(garantirArmazem(meio), false, 'trocou sem haver falha');
  assert.equal(meio.localStorage, antes, 'a referência do aluno foi trocada sem necessidade');
  assert.equal(garantirArmazem({}), false, 'ler um undefined não estoura, e sem estouro não há troca');
});

// ════════════════ 3: pelo caminho do app, a tela sobe e avisa ════════════════

test('app com o armazenamento bloqueado: o casco sobe, a Jornada aparece e o aviso está na tela', async () => {
  const win = winSemArmazem('#/');
  const { doc, main, inst, lancou } = await subirApp(win);

  assert.equal(lancou, null, `o casco morreu com o storage negado: ${lancou?.message}`);
  assert.equal(inst?.ok, true, `o casco não subiu: ${inst?.motivo}`);
  assert.ok(textoDe(main).trim() !== '', 'tela branca: o defeito que esta trava veio enterrar');

  const avisos = todos(doc.documentElement, (n) => n.classList?.contains('aviso-sem-armazenamento'));
  assert.equal(avisos.length, 1, `o aviso saiu ${avisos.length} vezes`);
  const aviso = avisos[0];
  assert.equal(aviso.tag, 'p', 'aviso em bloco grande: quem usa leitor de tela ouve a tela inteira');
  assert.equal(aviso.getAttribute('role'), 'status', 'aviso sem papel de status não é anunciado');
  assert.equal(aviso.textContent, casco.semArmazenamento, 'a frase do aviso saiu de core/textos.js');

  // ANTES do main, e irmão dele: dentro do main o `textContent = ''` de cada
  // pintura apagaria o aviso na primeira troca de aba, e o aluno seguiria
  // estudando sem saber que está escrevendo em areia.
  const irmaos = doc.documentElement.children.map((n) => n);
  assert.ok(
    irmaos.indexOf(aviso) > -1 && irmaos.indexOf(aviso) < irmaos.indexOf(main),
    'o aviso não é irmão do main "antes" dele'
  );

  // E o que o aviso promete é o que acontece: estudar sem storage. Trocar de
  // aba continua funcionando — é a metade da frase que ninguém leria se a tela
  // tivesse morrido.
  assert.equal(typeof inst.pintar, 'function', 'sem poder pintar, o aviso mentiria');
});

test('app com o storage vivo: nenhum aviso na tela — a troca não pode assustar quem não precisa dela', async () => {
  const { doc, main, inst, lancou } = await subirApp({
    location: { hash: '#/' },
    history: { replaceState: () => {} },
    localStorage: storageCom(),
    setTimeout: () => 0,
    clearTimeout: () => {},
    scrollTo: () => {},
    addEventListener: () => {}
  });
  assert.equal(lancou, null, `o casco morreu com storage normal: ${lancou?.message}`);
  assert.equal(inst?.ok, true, 'o casco não subiu com armazenamento liberado');
  assert.equal(
    todos(doc.documentElement, (n) => n.classList?.contains('aviso-sem-armazenamento')).length,
    0,
    'avisou sem-armazenamento para quem pode guardar: alarme falso custa a confiança'
  );
  assert.ok(textoDe(main).trim() !== '');
});

// ════════════════ 4: estação que não está no mapa ════════════════

test('#/estacao/essa-nao-existe/aulas diz que a estação não está no mapa', async () => {
  const { main, inst, lancou } = await subirApp(
    { ...armazemVivo(), location: { hash: `#/estacao/${SLUG_FANTASMA}/aulas` } }
  );
  assert.equal(lancou, null, `a rota de estação fantasma estourou: ${lancou?.message}`);
  assert.equal(inst?.ok, true, 'o casco não subiu');
  const saida = textoDe(main);
  assert.ok(saida.trim() !== '', 'página em branco para um endereço errado');
  assert.ok(!saida.includes(SLUG_FANTASMA), `a página ecoou o nome que o catálogo nega: ${saida}`);
  assert.ok(!saida.includes('Aulas de'), `ainda desenha o cabeçalho de uma estação inexistente: ${saida}`);

  const h1 = todos(main, (n) => n.tag === 'h1');
  assert.equal(h1.length, 1, 'é no único h1 que o casco põe o foco');
  assert.equal(h1[0].textContent, F.naoEstaNoMapa, 'a página inventou outra saída');

  const links = todos(main, (n) => n.tag === 'a');
  assert.equal(links.length, 1, 'a estação inexistente oferece mais de um caminho');
  assert.equal(links[0].getAttribute('href'), '#/', 'a saída da estação sem mapa não leva ao mapa');
  assert.equal(textoDe(links[0]), F.voltarAoMapa);

  assert.equal(todos(main, (n) => n.tag === 'button').length, 0, 'botão de ação sobre nada');
  assert.equal(todos(main, (n) => n.tag === 'li').length, 0, 'lista de aulas de uma estação que não existe');
});

test('#/estacao/essa-nao-existe/aula/3 diz que a estação não está no mapa', async () => {
  const { main, inst, lancou } = await subirApp(
    { ...armazemVivo(), location: { hash: `#/estacao/${SLUG_FANTASMA}/aula/3` } }
  );
  assert.equal(lancou, null, `a rota de aula em estação fantasma estourou: ${lancou?.message}`);
  assert.equal(inst?.ok, true, 'o casco não subiu');
  const saida = textoDe(main);
  assert.ok(saida.trim() !== '', 'página em branco');
  assert.ok(!saida.includes(SLUG_FANTASMA), `ecoou a estação que o catálogo nega: ${saida}`);
  assert.ok(!/Aula 3/.test(saida), 'afirmou a aula 3 de uma estação que não existe');

  const h1 = todos(main, (n) => n.tag === 'h1');
  assert.equal(h1.length, 1);
  assert.equal(h1[0].textContent, F.naoEstaNoMapa);
  const links = todos(main, (n) => n.tag === 'a');
  assert.equal(links.length, 1, 'a tela deu mais de uma saída');
  assert.equal(links[0].getAttribute('href'), '#/');
  assert.equal(todos(main, (n) => n.tag === 'button').length, 0, 'um primário sobre nada');
});

test('catálogo VAZIO (a rede falhou) continua no aviso honesto de hoje, não no mapa', async () => {
  // A condição inteira do ramo novo é `catalogo.length`: sem catálogo não há
  // como negar a estação, e dizer «não está no mapa» a quem está sem rede seria
  // acusar o endereço pelo problema da rede. O caminho de hoje (aulas.semAulas,
  // já travado em aulas-tela.test.js B10/B11 e aula-pagina.test.js) tem de
  // continuar de pé nas DUAS telas.
  //
  // Pelo caminho do app um `courses: []` não chega nunca: `loadCatalog`
  // (web/main.js:77) substitui catálogo vazio pelo mínimo embutido. Aqui o ctx
  // é entregue direto à tela, na forma do app (promessa, objeto `{courses}`) —
  // o que se mede é o RAMO, não o transporte.
  // AULA: o ramo de hoje é `!curso || !lista` juntos — sem catálogo não há
  // arquivo a buscar e as três partes de `aulas.semAulas` mandam.
  const docA = criarDoc();
  const raizAula = docA.createElement('div');
  const instAula = await montarAula(raizAula, {
    document: docA, window: { localStorage: storageCom(), addEventListener: () => {} },
    folha: SLUG_FANTASMA, n: 3,
    catalogo: Promise.resolve({ courses: [] }),
    buscarAulas: async () => { throw new Error('sem rede'); }
  });
  const saidaAula = textoDe(raizAula);
  assert.ok(saidaAula.includes(AU.semAulas.parteUm), `aula: sem rede perdeu o aviso de sempre: ${saidaAula}`);
  assert.ok(!saidaAula.includes(F.naoEstaNoMapa), 'aula: chamou de endereço errado o que foi falha de rede');
  assert.equal(instAula.rotulo, AU.semAulas.parteUm, 'aula: o rótulo da aba trocou');

  // AULAS: o caminho de hoje ecoa o que a pessoa pediu por endereço (a régua
  // B11 desta tela, já verde). O que a S19c-2 tem de NÃO fazer é reclamar do
  // endereço quando o que falhou foi a rede — daí o `catalogo.length`.
  const docL = criarDoc();
  const raizLista = docL.createElement('div');
  const instLista = await montarAulas(raizLista, {
    document: docL, window: { localStorage: storageCom(), addEventListener: () => {} },
    folha: SLUG_FANTASMA,
    catalogo: Promise.resolve({ courses: [] }),
    buscarAulas: async () => { throw new Error('sem rede'); }
  });
  const saidaLista = textoDe(raizLista);
  assert.ok(saidaLista.trim() !== '', 'aulas: a página ficou em branco');
  assert.ok(saidaLista.includes(SLUG_FANTASMA), 'aulas: deixou de ecoar o que a pessoa pediu');
  assert.ok(!saidaLista.includes(F.naoEstaNoMapa), 'aulas: chamou de endereço errado o que foi falha de rede');
  assert.equal(instLista.rotulo, AU.tituloPagina(SLUG_FANTASMA), 'aulas: o rótulo mudou com catálogo vazio');
});

/** O `win` de sempre, com o storage liberado — o ramo normal da casa. */
function armazemVivo() {
  return {
    history: { replaceState: () => {} },
    localStorage: storageCom(),
    setTimeout: () => 0,
    clearTimeout: () => {},
    scrollTo: () => {},
    addEventListener: () => {}
  };
}
