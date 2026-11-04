// Projeto Atlas — a trava do FIO, não da peça (S13c, 04/11/2026).
//
// POR QUE ESTE ARQUIVO EXISTE: na S13b a folha ganhou o painel de aulas e a
// página de aulas nasceu, os 584 testes passaram, e no Chrome de verdade as duas
// telas estavam erradas as duas. (1) `#/estacao/circuitos-digitais/aulas` abriu
// em branco: `TypeError: catalogo.find is not a function` em web/telas/aulas.js,
// porque `ctx.catalogo` é a promessa do `loadCatalog()` (web/main.js:60), que
// resolve num OBJETO `{ courses, ... }` — e o teste entregava uma lista. (2)
// `#/estacao/circuitos-digitais` mostrava a folha de antes: `desenharFolha` sabia
// receber `aulas`/`estudo` desde a S13b, mas o único chamador do app
// (web/metro.js) não passava nenhum dos dois, ninguém chamava `carregarAulas` na
// folha e ninguém chamava `ligarAberturaDeAula` nela.
//
// Nos dois casos o teste entregava à peça uma coisa que O APP NUNCA ENTREGA. A
// peça estava certa; faltava o fio, e o teste mediu a peça. É o segundo encontro
// com o defeito 1 da S11-0 (aberta no DOM, fechada na tela).
//
// A RÉGUA QUE ESTE ARQUIVO MUDA: a folha é conferida AQUI POR `subirMetro`, com
// o catálogo real de `data/catalog.json` cru e o JSON real de
// `data/aulas/circuitos-digitais.json`, entregues por um `buscarAulas` dublê. O
// que se pergunta não é "o painel sai bonito quando eu dou as aulas a ele", e
// sim "a rota da estação acaba com as aulas na tela". Se alguém tirar o
// `carregarAulas` do metrô, este arquivo cai — e é assim que o verde de novo não
// significa "tela em branco".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, janelaCom, storageCom, todos, textoDe, esperar } from './hdom.js';
import { subirMetro } from '../web/metro.js';
import { setNota } from '../core/notes.js';
import { ESTUDO_KEY, estudarAula, lerEstudo, serializarEstudo } from '../core/estudo.js';
import { duracaoLegivel } from '../core/aulas.js';
import { aulas as AU } from '../core/textos.js';

const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const CATALOGO_BRUTO = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CURSOS = CATALOGO_BRUTO.courses || [];
const CIRCUITOS = CURSOS.find((c) => c.slug === 'circuitos-digitais');

// O número que a pessoa lê, medido no arquivo real (S12): 93 aulas, 109.956 s.
const TOTAL = AULAS.total.aulas;
assert.equal(TOTAL, AULAS.aulas.length);
const PRIMEIRA = AULAS.aulas[0];

const comClasse = (raiz, classe) =>
  todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));
const um = (raiz, classe, onde) => {
  const achei = comClasse(raiz, classe);
  assert.equal(achei.length, 1, `${onde}: esperado exatamente um .${classe}, achei ${achei.length}`);
  return achei[0];
};
const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/\s+/g, ' ').trim();

/** A resposta de rede que o navegador daria ao `carregarAulas`. */
const respostaDe = (dados, { ok = true, status = 200 } = {}) =>
  async () => ({ ok, status, json: async () => dados });

/**
 * Sobe o metrô de verdade na rota de uma estação.
 *
 * @param {{slug?: string, buscar?: Function, bruto?: string|null}} opts
 *   `buscar` é o `deps.buscarAulas` — entra por deps exatamente como o storage,
 *   porque o node não tem o cache do service worker nem a rede do navegador.
 */
async function metrôComFolha({ slug = CIRCUITOS.slug, buscar = respostaDe(AULAS), bruto = null } = {}) {
  const doc = criarDoc();
  // A janela do dublê é UMA só para as duas perguntas: o metrô escreve em
  // `win.location.hash` para fechar a folha (metro.js:1150) e o fio da aula
  // escuta `visibilitychange` na MESMA janela (aulas-pedacos.js). Passar um
  // objeto `{ hash }` solto — como eu passei na primeira tentativa — dava ao
  // metrô um endereço sem `addEventListener`, e o `ligarAberturaDeAula` virava
  // no-op silencioso: o teste acusaria a tela de um defeito do dublê.
  const aparelho = { hash: `#/estacao/${slug}` };
  const win = janelaCom();
  win.location = aparelho;
  const root = doc.createElement('div');
  const storage = storageCom(bruto ? { [ESTUDO_KEY]: bruto } : {});
  const pedidos = [];

  const modulos = {
    // NA FORMA DO APP: `loadCatalog()` resolve no objeto do disco, com `courses`
    // dentro. Devolver a lista aqui é o que deixou o TypeError da tela em branco
    // passar por 584 testes verdes.
    loadCatalog: async () => CATALOGO_BRUTO,
    loadCompleted: () => [],
    saveCompleted: () => {},
    loadNotas: () => ({}),
    saveNotas: () => true,
    aplicarNota: (state = {}, id, texto) => ({ ...state, anotacoes: setNota(state.anotacoes, id, texto) })
  };

  const inst = await subirMetro({
    document: doc, root, storage, modulos, window: win,
    folha: slug, hoje: '2026-11-04',
    setTimeout: () => 0,
    buscarAulas: async (url) => { pedidos.push(url); return buscar(url); }
  });
  // O `carregarAulas` é uma promessa aberta dentro do pintar: três ticks chegam
  // para o `.then` dele, como `esperar()` faz em toda tela daqui.
  await esperar();
  await esperar();
  return { doc, win, root, storage, inst, pedidos, aparelho };
}

// ═════════════════ 1. a rota da estação chega na folha com aulas ═════════════════

test('fio: #/estacao/<slug> traz as aulas e pinta o primário da aula, sem o teste entregar nada à folha', async () => {
  const { root, pedidos } = await metrôComFolha();

  const painel = um(root, 'folha', 'folha da rota');
  assert.deepEqual(pedidos, [`data/aulas/${CIRCUITOS.slug}.json`],
    'o metrô pediu o arquivo da estação à vista — sem isto a folha é a de sempre');

  const primario = um(painel, 'aulas-primario', 'folha da rota com aulas');
  assert.equal(primario.tag, 'a', 'o primário é o link da aula');
  assert.equal(primario.getAttribute('data-aula'), PRIMEIRA.id);
  assert.equal(primario.getAttribute('data-n'), '1');
  // S14b1, item 5 — O DESTINO MUDOU: a folha não abre mais o YouTube, abre a
  // PÁGINA da aula dentro do Atlas. O `list=` passou a ser do Assistir, que mora
  // lá. Expectativa reescrita porque o pedido mudou o contrato, não porque a
  // tela errou: é a diferença entre consertar e amolecer a trava.
  const href = primario.getAttribute('href');
  assert.equal(href, `#/estacao/${CIRCUITOS.slug}/aula/1`,
    `o primário da folha não leva à página da aula: ${href}`);
  assert.equal(primario.getAttribute('target'), null,
    'link interno com target _blank tiraria a pessoa do app para ler um título');
  assert.ok(textoDo(primario).startsWith(`Começar: Aula 1 — `), textoDo(primario));
});

test('fio: a régua da folha diz o que os dados dizem, dentro do app', async () => {
  const { root } = await metrôComFolha();
  const painel = um(root, 'folha', 'folha da rota com aulas');

  // MUTOU na S14b2 (04/11/2026), item 8 do pedido: a régua trocou o VERBO. Dizia
  // "abertas" e contava como progresso o clique de quem foi ler um título; o
  // gesto que o Atlas cobra é fechar com recordação e cartão. No zero as duas
  // frases têm o mesmo número, e é por isso que a palavra, aqui, é a trava.
  assert.equal(textoDo(um(painel, 'aulas-progresso-texto', 'linha de progresso')),
    `0 de ${TOTAL} aulas estudadas · faltam ~30 h 33 min`);

  const barra = um(painel, 'aulas-barra', 'barra da folha');
  assert.equal(barra.getAttribute('aria-valuemax'), String(TOTAL));
  assert.equal(barra.getAttribute('aria-valuenow'), '0');

  // A CLASSE REAL (folha.js:122): `botao botao-secundario`. Eu tinha chutado
  // `aulas-secundario`, que não existe em lugar nenhum — e o erro foi meu, não
  // da tela, o que é a razão de conferir o seletor no fonte antes de assentar.
  const secundario = comClasse(painel, 'botao-secundario')
    .find((n) => n.getAttribute('href') === `#/estacao/${CIRCUITOS.slug}/aulas`);
  assert.ok(secundario, 'a folha não tem o link para a página das aulas');
  assert.equal(textoDo(secundario), `Ver as ${TOTAL} aulas`);

  // O concluir mudou de tipo com o painel de aulas (link discreto, não botão).
  const concluir = um(painel, 'folha-concluir-discreto', 'concluir discreto');
  assert.equal(concluir.tag, 'a');
  assert.equal(concluir.getAttribute('data-concluir'), CIRCUITOS.id);
});

test('fio: a busca não se repete quando a folha é repintada', async () => {
  const { root, storage, win, pedidos } = await metrôComFolha();
  const painel = um(root, 'folha', 'folha da rota com aulas');

  root.dispatch('click', { target: um(painel, 'aulas-primario', 'primário').closest('a[data-aula]'), preventDefault() {} });
  win.dispatch('visibilitychange');
  await esperar();

  assert.equal(pedidos.length, 1,
    `a mesma estação foi buscada ${pedidos.length} vezes: o cache por slug morreu`);
});

// ═════════════════════════ 2. sem arquivo, a folha é a de hoje ═════════════════════════

test('fio: um 404 deixa a folha exatamente como era, sem linha de progresso e sem erro na tela', async () => {
  const { root, pedidos } = await metrôComFolha({ buscar: respostaDe(null, { ok: false, status: 404 }) });

  assert.equal(pedidos.length, 1, 'mesmo assim o metrô tentou uma vez');
  const painel = um(root, 'folha', 'folha da rota com busca falha');
  assert.equal(comClasse(painel, 'aulas-progresso').length, 0, 'sem aulas não há régua de progresso');
  assert.equal(comClasse(painel, 'aulas-primario').length, 0, 'sem aulas não há primário de aula');
  assert.equal(comClasse(painel, 'folha-concluir-discreto').length, 0, 'sem aulas o concluir é o botão de sempre');

  const concluir = todos(painel, (n) => n.tag === 'button' && n.getAttribute('data-concluir'))[0];
  assert.ok(concluir, 'o botão de concluir continua lá: a falha da lista não tira a pessoa da estação');
  assert.ok(!/não carregaram|não está neste aparelho/.test(textoDo(painel)),
    'a frase de erro é da PÁGINA de aulas; a folha não grita');
});

test('fio: a folha é desenhada antes das aulas chegarem, e a chegada repinta', async () => {
  // O `await` preso: a folha pinta primeiro (esqueleto → mapa), o arquivo chega
  // depois. Conferir só o fim deixaria passar uma folha que esperasse a rede
  // para existir, e a pessoa veria um buraco em vez da estação.
  let soltar;
  const prometida = new Promise((r) => { soltar = r; });
  const { root } = await metrôComFolha({ buscar: () => prometida });

  const antes = um(root, 'folha', 'folha antes da resposta');
  assert.equal(comClasse(antes, 'aulas-progresso').length, 0, 'a folha existe enquanto a rede não chega');
  assert.ok(textoDo(antes).includes(CIRCUITOS.title), 'e já mostra a estação');

  soltar({ ok: true, status: 200, json: async () => AULAS });
  await esperar();
  await esperar();

  const depois = um(root, 'folha', 'folha depois da resposta');
  assert.equal(comClasse(depois, 'aulas-primario').length, 1, 'a chegada repinta com o primário de aula');
});

// ═══════════════════════════ 3. o clique grava, a volta repinta ═══════════════════════════

test('fio: S14b1 — o toque no primário NÃO grava; quem abre a aula é o Assistir da página', async () => {
  const { root, storage } = await metrôComFolha();
  const painel = um(root, 'folha', 'folha da rota com aulas');
  const primario = um(painel, 'aulas-primario', 'primário');

  root.dispatch('click', { target: primario, preventDefault() {} });

  // O CONTRATO MUDOU DE PROPÓSITO (item 5 do pedido): a folha agora aponta para
  // a página da aula, e ir ler uma aula não é abri-la. Se o link interno
  // gravasse, o "0 de 93" subiria sozinho sem ninguém ter assistido nada — a
  // régua mentiria, e a S14b fecharia aula que nunca foi aberta.
  assert.equal(storage.getItem(ESTUDO_KEY), null,
    'o toque interno marcou uma aula como aberta sem sair do Atlas');
  const quieta = textoDo(um(root, 'aulas-progresso-texto', 'folha depois do toque interno'));
  assert.equal(quieta, AU.progresso(0, TOTAL, duracaoLegivel(AULAS.total.segundos)),
    `a régua andou com um toque que não abre nada: "${quieta}"`);
  // Que a volta repinta quando a gravação EXISTE (feita pelo Assistir da página)
  // é o teste seguinte, 'voltar da aba do YouTube repinta', que escreve no
  // storage por fora e bate no visibilitychange: a cobertura não se perdeu, o
  // gatilho é que mudou de lugar.
});
test('fio: S14b1 — o Assistir da página é quem grava, e a régua da folha lê o que ele gravou', async () => {
  // O TRIGGO MUDOU DE CASA, a coberta continua a mesma. Este caso cobrava a
  // gravação pelo toque na folha; desde o item 5 do pedido a folha é link
  // interno, e quem abre a aula é o botão Assistir DA PÁGINA. A gravação entra
  // aqui pelo mesmo caminho de antes — o clique num `a[data-aula]` que SAI do
  // app, com o `data-estacao` que a folha põe no painel — e as três asserções
  // velhas (estação, n, abertaEm local) passam a valer sobre esse link.
  const { root, storage } = await metrôComFolha();
  const painel = um(root, 'folha', 'folha da rota com aulas');
  const queSai = um(painel, 'aulas-primario', 'primário');
  const assistindo = { ...queSai, tag: 'a' };
  assistindo.setAttribute('href', `https://www.youtube.com/watch?v=${PRIMEIRA.id}`);

  root.dispatch('click', { target: assistindo, preventDefault() {} });

  const bruto = storage.getItem(ESTUDO_KEY);
  assert.ok(bruto, 'o clique que sai para o vídeo não escreveu nada: o fio do abrirAula está solto');
  const estudo = lerEstudo(bruto);
  assert.equal(estudo.aulas[PRIMEIRA.id].estacao, CIRCUITOS.id,
    'a gravação perdeu a estação: a volta de outra estação não vai saber donde continuar');
  assert.equal(estudo.aulas[PRIMEIRA.id].n, 1);
  assert.match(estudo.aulas[PRIMEIRA.id].abertaEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    'abertaEm tem de ser data-hora LOCAL (regra 13)');

  // A frase inteira, esperada do núcleo: uma asserção que compara a régua com
  // ela mesma passaria verde com número errado, e foi assim que este arquivo
  // nasceu. duracaoLegivel e resumoDaEstacao são os mesmos que a tela chama.
  const régua = textoDo(um(root, 'aulas-progresso-texto', 'folha depois do clique'));
  // MUTOU na S14a (04/11/2026): era `AULAS.total.segundos - PRIMEIRA.duracaoS`,
  // porque abrir a aula 1 tirava os 14 min dela do "faltam ~": o restante soma as
  // aulas NÃO ESTUDADAS.
  // MUTOU de novo na S14b2 (04/11/2026), item 8: e agora não anda NEM o número.
  // A régua conta ESTUDADAS, e o Assistir ABRE — não estuda. Um teste que
  // esperasse "1" aqui estaria cobrando da tela o crédito de um clique, exatamente
  // o que a mudança de verbo veio tirar. O que este assert prova hoje é que a
  // gravação chegou à folha (o teste das linhas acima) SEM encher a régua.
  assert.equal(régua, AU.progresso(0, TOTAL, duracaoLegivel(AULAS.total.segundos)),
    `o clique que só abriu mexeu na régua de estudo: "${régua}"`);
  assert.match(régua, /estudadas/, 'a régua da folha voltou a contar abertas');
});

test('fio: voltar da aba do YouTube repinta, mesmo sem clique novo', async () => {
  // A cena real: a pessoa abre a aula (o navegador leva ao YouTube), assiste, e
  // VOLTA para o Atlas sem recarregar nada. Quem grava é o clique; quem pinta o
  // resultado é o `visibilitychange`. Testado só o clique, um Atlas que pintasse
  // uma foto do boot passaria verde.
  const { root, storage, win } = await metrôComFolha();

  // O estudo aparece no storage por fora do app: outro aba, outro momento.
  const estudo = { versao: 1, aulas: { [PRIMEIRA.id]: { estacao: CIRCUITOS.id, n: 1, abertaEm: '2026-11-04T08:00' } }, ultima: { estacao: CIRCUITOS.id, aula: PRIMEIRA.id, n: 1, em: '2026-11-04T08:00' } };
  storage.setItem(ESTUDO_KEY, JSON.stringify(estudo));

  assert.ok(!textoDo(um(root, 'aulas-progresso-texto', 'antes da volta')).startsWith('1 de'),
    'a folha já repintou sozinha antes do evento: o teste não está medindo a volta');

  win.dispatch('visibilitychange');

  const régua = textoDo(um(root, 'aulas-progresso-texto', 'depois da volta'));
  // MUTOU na S14b2 (04/11/2026), item 8: a volta de uma aula ABERTA repinta o
  // PRIMÁRIO (a asserção abaixo), e a régua continua em zero, porque a régua conta
  // estudo. Deixar `startsWith('1 de')` seria travar o verbo velho.
  assert.equal(régua, `0 de ${TOTAL} aulas estudadas · faltam ~30 h 33 min`,
    `a régua contou a abertura como estudo: "${régua}"`);
  // AULA 1, não 2: pela regra que o Claude decidiu em 04/11, a `ultima` desta
  // estação MANDA (regra 1), e quem abriu a 1 e voltou continua na 1. Eu tinha
  // escrito "aponte para a próxima" por instinto de playlist — é exatamente o
  // 'primeira-nao-aberta' que saiu do núcleo. Expectativa errada minha, não da
  // tela: a régua andou para "1 de 93", e o primário diz "Continuar".
  assert.ok(textoDo(um(root, 'aulas-primario', 'depois da volta')).startsWith('Continuar: Aula 1 — '),
    'com a 1 aberta a volta tinha de dizer "Continuar: Aula 1", o ponto de retorno');

  // O DENTE da régua de estudo, do lado da volta: a mesma folha, o mesmo
  // visibilitychange, com a aula 1 agora FECHADA (estudarAula do núcleo, não um
  // JSON escrito à mão — a forma é a do core). Se a folha não reler o storage, ou
  // se a régua continuar contando abertas, isto fica em "0 de 93".
  const fechada = serializarEstudo(estudarAula(
    lerEstudo(storage.getItem(ESTUDO_KEY)),
    { estacao: CIRCUITOS.id, aula: PRIMEIRA.id, n: 1 },
    '2026-11-04T09:15',
    { recordacao: 'metade do que eu vi', conferencia: '' }
  ));
  storage.setItem(ESTUDO_KEY, fechada);
  win.dispatch('visibilitychange');

  const réguaDoEstudo = textoDo(um(root, 'aulas-progresso-texto', 'depois da volta com estudo'));
  assert.ok(réguaDoEstudo.startsWith(`1 de ${TOTAL} aulas estudadas`),
    `a volta não repintou a régua com estudo: "${réguaDoEstudo}"`);
});

test('fio: o listener da folha não fica vivo depois de sair da estação', async () => {
  const { win, inst } = await metrôComFolha();
  const antes = (win._ouvintes.visibilitychange || []).length;
  assert.ok(antes > 0, 'a folha ligou a escuta da volta');

  inst.desmontar();
  assert.equal((win._ouvintes.visibilitychange || []).length, antes - 1,
    'desmontar não soltou o visibilitychange: a folha morta continua repintando');
});
