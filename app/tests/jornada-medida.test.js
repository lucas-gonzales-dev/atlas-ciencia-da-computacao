// Projeto Atlas — S20b-4 (05/11/2026): as TRAVAS da medida na Jornada.
//
// Os três itens que nascem aqui têm a mesma raiz, e ela não é de layout: a tela
// já MED IA o estágio (o mapa, a folha) e continuava FALANDO a liberação da
// malha. Em 3 de 93 aulas estudadas a lista dizia «disponível», os três números
// diziam «Em curso 0» e o topo dizia «Começar» — três frases, cada uma com um
// dono diferente, nenhuma delas a resposta que o mesmo aparelho já dava ao
// leitor dois centímetros adiante. A regra cobrada abaixo é uma só: quem fala da
// Jornada fala pela medição que o núcleo fez, e só fala da malha quando não há
// medição nenhuma.
//
// POR QUE UM ARQUIVO NOVO: as travas atravessam três módulos (web/metro.js,
// web/telas/jornada-topo.js, core/textos.js) e as folhas de teste existentes já
// têm o seu objeto — metro.test.js é a placa e o diagrama sem índice,
// jornada-topo.test.js é o cartão de retomada. Nada aqui reescreve o que those
// arquivos já provam; o que se prova é a LINHA que a S20b-4 abriu.
//
// A PROVA PELO CONTRÁRIO, pedida no item 2: volte `web/metro.js` a ler
// `ESTADO_LEGIVEL[e.estado]` na etiqueta da lista e o caso «3 estudadas dizem
// Em percurso também na lista» cai. Ele cai de propósito — é a única forma de
// esta trava significar «a lista pergunta ao estágio» em vez de «a lista imprime
// uma palavra que por acaso está certa hoje».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { comClasse, criarDoc, storageCom, textoDe, todos, esperar } from './hdom.js';
import { estadoDaLista, subirMetro } from '../web/metro.js';
import { desenharTopo } from '../web/telas/jornada-topo.js';
import { ESTUDO_KEY, abrirAula, estudarAula, lerEstudo, serializarEstudo } from '../core/estudo.js';
// S19a: a frase de recomeço é do núcleo (a pergunta é do calendário) e as
// palavras são de core/textos.js. O teste importa os dois, e não a tela.
import { fraseDeRecomeco } from '../core/viagem.js';
import { jornada as J, recomeco as RC } from '../core/textos.js';

const RAIZ = new URL('../', import.meta.url);
const LER = (rel) => readFileSync(fileURLToPath(new URL(rel, RAIZ)), 'utf8');
const ESTADO = JSON.parse(LER('data/catalog.json'));
const CATALOGO = ESTADO.courses;
const INDICE = JSON.parse(LER('data/aulas/indice.json'));
const HOJE = '2026-11-05';

const LINHA_1 = [...new Set(CATALOGO.map((c) => Number(c.stage)).filter(Number.isFinite))].sort((a, b) => a - b)[0];
const PRIMEIRA = CATALOGO.find((c) => Number(c.stage) === LINHA_1);
const AULAS_PRIMEIRA = JSON.parse(LER(`data/aulas/${PRIMEIRA.slug}.json`));

// `aaaa-mm-ddThh:mm` cru: o HE_QUANDO do núcleo (core/estudo.js) rejeita ISO com
// segundos e fuso EM SILÊNCIO, e um formato chutado aqui produziria «nenhuma aula
// estudada» vestida de medição — o verde mais perigoso desta fatia.
const Q = (h) => `2026-11-04T${h}`;

/** O estudo nascido dos GESTOS do núcleo: abre e estuda as `n` primeiras aulas. */
function estudoCom(n) {
  let e = lerEstudo(null);
  for (const a of AULAS_PRIMEIRA.aulas.filter((x) => Number(x.n) <= n)) {
    e = abrirAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q('09:00'));
    e = estudarAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, Q('09:30'),
      { recordacao: 'lembrei', conferencia: 'confirmei' });
  }
  return e;
}

/** S19a: o mesmo gesto, com o estudo carimbado no DIA em que a tela abre. */
function estudoComEm(n, dia) {
  let e = lerEstudo(null);
  for (const a of AULAS_PRIMEIRA.aulas.filter((x) => Number(x.n) <= n)) {
    e = abrirAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, `${dia}T09:00`);
    e = estudarAula(e, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, `${dia}T09:30`,
      { recordacao: 'lembrei', conferencia: 'confirmei' });
  }
  return e;
}

const storageComEstudo = (n) => storageCom({ [ESTUDO_KEY]: serializarEstudo(estudoCom(n)) });

function modulosFake(completed = []) {
  return {
    loadCatalog: () => Promise.resolve(ESTADO),
    loadCompleted: () => completed.slice(),
    saveCompleted: () => true,
    loadNotas: () => ({}),
    saveNotas: () => true,
    aplicarNota: (s) => s
  };
}

async function subir(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const win = { location: { hash: '#/' }, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} };
  const inst = await subirMetro({
    root: raiz,
    document: doc,
    storage: opts.storage || storageCom({}),
    window: win,
    modulos: modulosFake(opts.completed || []),
    setTimeout: () => 0,
    hoje: HOJE,
    buscarAulas: async (url) => {
      try {
        const bruto = LER(`data/${String(url).replace(/^data\//, '')}`);
        return { ok: true, status: 200, json: async () => JSON.parse(bruto) };
      } catch {
        return { ok: false, status: 404, json: async () => ({}) };
      }
    },
    folha: opts.folha ?? null
  });
  await esperar();
  return { doc, raiz, inst };
}

/**
 * O cartão da estação no diagrama: o link `.estacao` com o id do catálogo.
 *
 * A mira é a CLASSE, não só o `data-id`: `data-id` aparece em mais de um lugar
 * da tela (a placa, o selo da chegada) e procurar por ele sozinho devolvia um nó
 * que nunca teve etiqueta de estado — o teste acusava a lista de perder a
 * palavra, quando quem faltava era a mira.
 */
const cartaoDa = (raiz, id) => todos(raiz, (n) => String(n.className || '').split(/\s+/).includes('estacao')
  && n.getAttribute && n.getAttribute('data-id') === id)[0];
const etiquetaDa = (raiz, id) => {
  const cartao = cartaoDa(raiz, id);
  assert.ok(cartao, `a estação ${id} não apareceu no diagrama: a linha desenhada mudou de dono`);
  const nó = comClasse(cartao, /^estacao-estado$/)[0];
  assert.ok(nó, `${id} perdeu a etiqueta de estado: o cartão voltaria a falar só pela cor`);
  return nó.textContent;
};

// ══════════════ item 2 · a lista diz o estágio, não a liberação ══════════════
// O defeito, medido na tela: 3 de 93 estudadas, e a lista dizia «disponível»
// enquanto a folha, dois centímetros abaixo, dizia «Em percurso» desde a
// S20b-1a. A etiqueta da lista nunca perguntou ao estágio — ela era a palavra
// fixa de `ESTADO_LEGIVEL`, lida da liberação da malha.

test('S20b-4 · 3 aulas estudadas dizem «Em percurso» também na lista', async () => {
  const { raiz } = await subir({ storage: storageComEstudo(3) });
  assert.equal(etiquetaDa(raiz, PRIMEIRA.id), 'Em percurso',
    'a etiqueta da lista leu a liberação da malha em vez do estágio medido — é exatamente o defeito do item 2');
});

test('S20b-4 · a forma do nó continua a da malha: só a palavra mudou', async () => {
  const { raiz } = await subir({ storage: storageComEstudo(3) });
  const cartao = cartaoDa(raiz, PRIMEIRA.id);
  const forma = comClasse(cartao.parent, /^forma$/)[0];
  assert.ok(forma, 'o nó do diagrama sumiu: a etiqueta nova não tem mais com que se alinhar');
  // Concluída não é o caso, e a cor continua sendo a da liberação — o anel é o
  // desenho, a palavra é a medida. É a mesma separação da folha (folha.test.js).
  assert.equal(/concluida/.test(forma.className), false, 'a forma passou a seguir o estágio');
});

test('S20b-4 · sem toque gravado a lista diz a MESMA palavra da folha', async () => {
  // O índice CHEGA junto com a tela (o `buscarAulas` do app serve o
  // indice.json), então «sem índice» não é um caso desta pintura — o que é caso
  // é «com índice, sem toque»: o estágio 'fora', que a folha já traduzia como
  // «Disponível». A lista passa a dizer a mesma palavra, maiúscula igual.
  const { raiz } = await subir();
  assert.equal(etiquetaDa(raiz, PRIMEIRA.id), 'Disponível',
    'a lista e a folha divergem na palavra de quem ainda não tocou em nada');
});

test('S20b-4 · sem MEDIDA nenhuma na mão a palavra volta a ser a da malha', () => {
  // O Map vazio de `eixosDaRede` (sem índice, o cartão do link, a pintura antes
  // da tabela por estação) é o «não medimos» da casa: aí a etiqueta fala a
  // liberação, como falava antes da S20b-4, byte a byte.
  assert.equal(estadoDaLista(new Map(), { id: 'x', estado: 'disponivel' }), 'disponível');
  assert.equal(estadoDaLista(null, { id: 'x', estado: 'em_curso' }), 'em curso');
  assert.equal(estadoDaLista(undefined, { id: 'x', estado: 'trancada' }), 'trancada');
});

test('S20b-4 · a trancada continua trancada mesmo com estágio medido', () => {
  // A régua mede aulas abertas e estudadas; a LIBERAÇÃO é outra pergunta, e é a
  // malha que responde. Uma fechada com registro atrás continua trancada — é a
  // linha que a folha já tinha (folha.test.js, «a trancada continua Trancada»).
  // Não é caso de DOM: a estação fechada do catálogo real está em outra linha,
  // e o diagrama desenha uma linha por vez.
  const comEstagio = new Map([['x', { estagio: 'em-percurso', estudadas: 3, total: 93 }]]);
  assert.equal(estadoDaLista(comEstagio, { id: 'x', estado: 'trancada' }), 'trancada',
    'a lista chamou de estágio medido o que o pré-requisito nega');
  assert.equal(estadoDaLista(comEstagio, { id: 'x', estado: 'disponivel' }), 'Em percurso');
});

// ══════════════ item 3 · «Continuar: <estação> · Aula N» ══════════════
// O topo no modo `proxima` oferecia sempre o verbo da primeira aula. Com 3 de 93
// estudadas em Circuitos Digitais, a frase era «Começar: Circuitos Digitais ·
// Aula 4» — o endereço certo, o verbo errado, ao lado de um mapa já aceso.

const topoCom = (doc, alvo, estudo) => desenharTopo({
  alvo, catalogo: CATALOGO, progresso: { completed: [] }, resumo: { concluidas: 0 },
  estudo, indice: INDICE, aulas: AULAS_PRIMEIRA.aulas, embarqueAberto: false
}, doc);

const alvoProxima = (n) => ({ modo: 'proxima', curso: PRIMEIRA, n, idAula: null });

test('S20b-4 · a estação já tocada recebe o verbo Continuar', () => {
  const doc = criarDoc();
  const texto = textoDe(topoCom(doc, alvoProxima(4), estudoCom(3)));
  const esperado = J.topo.continuarEstacao(PRIMEIRA.title, 4);
  assert.equal(texto.includes(esperado), true, `o topo não disse «${esperado}»: ${texto.slice(0, 160)}`);
  assert.equal(texto.includes(J.topo.comecarEstacao(PRIMEIRA.title, 4)), false,
    '«Começar» continua na tela de quem já estudou nesta estação');
});

test('S20b-4 · sem toque gravado o verbo continua Começar', () => {
  const doc = criarDoc();
  const texto = textoDe(topoCom(doc, alvoProxima(1), lerEstudo(null)));
  const esperado = J.topo.comecarEstacao(PRIMEIRA.title, 1);
  assert.equal(texto.includes(esperado), true, `a primeira visita perdeu o verbo Começar: ${esperado}`);
  assert.equal(texto.includes(J.topo.continuarEstacao(PRIMEIRA.title, 1)), false,
    '«Continuar» sem nenhuma aula estudada é a mentira do item 3 de cabeça para baixo');
});

test('S20b-4 · sem índice o verbo volta a ser Começar — não se afirma o que não se mediu', () => {
  const doc = criarDoc();
  const topo = desenharTopo({
    alvo: alvoProxima(4), catalogo: CATALOGO, progresso: { completed: [] }, resumo: {},
    estudo: estudoCom(3), indice: null, aulas: AULAS_PRIMEIRA.aulas, embarqueAberto: false
  }, doc);
  const texto = textoDe(topo);
  assert.equal(texto.includes(J.topo.comecarEstacao(PRIMEIRA.title, 4)), true,
    `sem índice a tela inventou um estágio: ${texto.slice(0, 160)}`);
});

test('S20b-4 · Continuar e Começar são frases diferentes, e as duas moram em textos.js', () => {
  // A trava da regra 9: nenhuma frase escrita na tela. Se `continuarEstacao`
  // nascesse com o mesmo texto de `comecarEstacao`, o item 3 estaria consertado
  // no código e vivo na tela — e o assert de cima passaria igual.
  assert.notEqual(J.topo.continuarEstacao('X', 1), J.topo.comecarEstacao('X', 1),
    'os dois verbos da estação dizem a mesma palavra');
  const fonte = LER('web/telas/jornada-topo.js')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.equal(/'Começar|'Continuar|`Começar|`Continuar/.test(fonte), false,
    'uma frase escrita à mão no topo: ela vem de core/textos.js');
});

// ══════════════ item 4 · «Em curso» conta os estágios, não o campo antigo ══════════════
// `n.emCurso` lia `progresso.emCurso`, o campo do progresso v3. Desde que a aula
// passou a ser o gesto, ninguém escreve nele — e a tela dizia «Em curso 0» para
// quem estava estudando 3 aulas agora.

const numeros = (raiz) => todos(raiz, (n) => /^numero-item$/.test(String(n.className || '')))
  .map((bloco) => ({
    rotulo: bloco.children[0]?.textContent,
    valor: bloco.children[1]?.textContent
  }));

test('S20b-4 · estudo nascido de abrirAula e estudarAula conta 1 em «Em curso»', async () => {
  const { raiz } = await subir({ storage: storageComEstudo(3) });
  const emCurso = numeros(raiz).find((n) => n.rotulo === J.numeros.emCurso);
  assert.ok(emCurso, 'sumiu o item «Em curso» dos três números');
  assert.equal(emCurso.valor, String(1),
    `«Em curso» não conta os estágios medidos: ${emCurso.valor}`);
});

test('S20b-4 · primeira visita continua Em curso 0', async () => {
  const { raiz } = await subir();
  const emCurso = numeros(raiz).find((n) => n.rotulo === J.numeros.emCurso);
  assert.equal(emCurso.valor, '0', 'a primeira visita ganhou uma viagem que ela não tem');
});

test('S20b-4 · sem índice fica o número antigo, e não um zero inventado', async () => {
  // O aparelho tem `emCurso` na malha (o embarque antigo, o progresso importado)
  // e o índice ainda não chegou. A régua nova não tem o que somar sem total: aí
  // vale a conta velha, que ao menos lê a declaração que existe.
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const { desenharMetro } = await import('../web/metro.js');
  desenharMetro(doc, raiz, {
    catalogo: CATALOGO,
    progresso: { completed: [], emCurso: [PRIMEIRA.id], conclusoes: {} },
    estudo: lerEstudo(null),
    linha: LINHA_1
  });
  const emCurso = numeros(raiz).find((n) => n.rotulo === J.numeros.emCurso);
  assert.ok(emCurso, 'os três números sumiram da pintura sem índice');
  assert.equal(emCurso.valor, String(1),
    `sem índice a tela perdeu a declaração da malha: ${emCurso.valor}`);
});

// ══════════════ S19a · a frase de recomeço (desenho J5, item 2) ══════════════
// O desenho pede a frase em começo de semana ou de mês, e pede que ela não
// conte ausência. As duas metades têm causas diferentes e são travadas à parte:
// a palavra é do calendário (o dia da semana, sem fuso — regra 13 de
// core/cartoes.js), e o direito de dizê-la é da medição (sem estudo no aparelho
// não há recomeço, há primeira visita).
//
// A PROVA PELO CONTRÁRIO: tire a checagem de `houveEstudo` em
// core/viagem.js::fraseDeRecomeco e o caso «segunda SEM estudo não mostra» cai.
// É a única forma de esta trava significar «a frase pergunta se houve estudo»
// em vez de «a frase imprime uma palavra quando o calendário manda».

const SEGUNDA = '2026-11-02';       // segunda-feira, dia 2
const TERCA = '2026-11-03';         // terça-feira, dia 3
const TERCA_DIA_1 = '2026-12-01';   // terça-feira E dia 1 → o mês vence
const SEGUNDA_DIA_1 = '2027-02-01'; // segunda-feira E dia 1 → o mês vence

const topoEm = (doc, hoje, estudo) => desenharTopo({
  alvo: alvoProxima(2), catalogo: CATALOGO, progresso: { completed: [] },
  resumo: { concluidas: 0 }, estudo, indice: INDICE, aulas: AULAS_PRIMEIRA.aulas,
  embarqueAberto: false, hoje
}, doc);

const recomecoNaTela = (doc, hoje, n) => {
  const topo = topoEm(doc, hoje, estudoComEm(n, hoje));
  const nó = comClasse(topo, /^topo-recomeco$/)[0];
  return { topo, texto: textoDe(topo), frase: nó ? nó.textContent : null };
};

test('S19a · segunda-feira com estudo traz a frase da semana', () => {
  const { frase } = recomecoNaTela(criarDoc(), SEGUNDA, 2);
  assert.equal(frase, RC.semana, `a segunda não disse a frase da semana: ${String(frase)}`);
});

test('S19a · dia 1 traz a frase do mês, e o dia 1 VENCE a segunda', () => {
  // Os dois dias abaixo são dia 1; um deles é também segunda. Se a ordem dos
  // dois ramos se invertesse, 2027-02-01 diria «semana» — e a frase mais rara
  // do calendário perderia para a mais comum.
  assert.equal(fraseDeRecomeco(TERCA_DIA_1, true), RC.mes);
  assert.equal(fraseDeRecomeco(SEGUNDA_DIA_1, true), RC.mes,
    'segunda que é dia 1 disse a frase da semana: o dia 1 não venceu');
  const { frase } = recomecoNaTela(criarDoc(), SEGUNDA_DIA_1, 2);
  assert.equal(frase, RC.mes, 'a tela pintou outra borda do que o núcleo respondeu');
});

test('S19a · terça não mostra nada', () => {
  assert.equal(fraseDeRecomeco(TERCA, true), null, 'terça virou borda de calendário');
  const { frase, texto } = recomecoNaTela(criarDoc(), TERCA, 2);
  assert.equal(frase, null, `a tela pintou uma frase de recomeço num dia comum: ${texto}`);
});

test('S19a · segunda SEM estudo não mostra — não se fala de pausa de quem não começou', () => {
  assert.equal(fraseDeRecomeco(SEGUNDA, false), null,
    'a frase saiu sem estudo no aparelho: é o recomeço inventando uma ausência');
  assert.equal(fraseDeRecomeco(SEGUNDA_DIA_1, false), null, 'o dia 1 furou a falta de estudo');
  const { frase } = recomecoNaTela(criarDoc(), SEGUNDA, 0);
  assert.equal(frase, null, 'a tela deu boas-vindas de volta à primeira visita');
});

test('S19a · nenhuma frase fala em dias, em ausência ou em ter voltado', () => {
  // O desenho é explícito: «nenhuma contagem de ausência». Um número de dias,
  // um «faz» ou um «voltou» aqui é a tela cobrando a pessoa pela vida dela.
  const duas = [RC.semana, RC.mes];
  for (const frase of duas) {
    assert.match(frase, /^(Semana nova|Mês novo)\./, `a frase perdeu o nome da borda: ${frase}`);
    assert.equal(/\d/.test(frase), false, `a frase de recomeço tem um número: ${frase}`);
    assert.equal(/\b(dias?|semanas?|meses?)\b.*\d|\d.*\b(dias?|semanas?|meses?)\b/i.test(frase), false,
      `a frase conta tempo: ${frase}`);
    for (const proibida of ['voltou', 'sumiu', 'faltou', 'ausência', 'ausencia', 'parou', 'ficou sem', 'retomou']) {
      assert.equal(frase.toLowerCase().includes(proibida), false,
        `a frase fala de ausência («${proibida}»): ${frase}`);
    }
  }
});

test('S19a · a frase é um parágrafo, não um segundo caminho, e o primário continua um só', () => {
  const { topo } = recomecoNaTela(criarDoc(), SEGUNDA, 2);
  const nó = comClasse(topo, /^topo-recomeco$/)[0];
  assert.ok(nó, 'sumiu o .topo-recomeco: a frase não chega mais à tela');
  // `getAttribute` do mini-DOM devolve `null` para atributo ausente (é o que o
  // DOM real faz também), e a mira é a TAG: um `<a>` com a classe estaria certo
  // no assert de baixo e errado na tela.
  // O dublê da casa guarda a tag em `.tag` (tests/hdom.js:12), não em
  // `tagName` — ler o campo errado daria `undefined` e o assert passaria a
  // medir o dublê em vez da tela, que é o defeito que o próprio hdom registra.
  assert.equal(String(nó.tag).toLowerCase(), 'p',
    `a frase saiu de um <${String(nó.tag).toLowerCase()}>: recomeço não é caminho`);
  assert.equal(nó.getAttribute('href'), null,
    'a frase de recomeço virou link: a tela teria dois caminhos na mesma caixa');
  const primarios = todos(topo, (n) => String(n.className || '').split(/\s+/).includes('botao-primario'));
  assert.equal(primarios.length, 1, `${primarios.length} primários na Jornada: um deles é a frase`);
});

test('S19a · a frase mora em core/textos.js, e quem decide o dia mora em core/viagem.js', () => {
  // Regra 9 da casa: nenhuma frase escrita na tela, e nenhum `getDay()` solto
  // num arquivo de desenho — a conta do calendário é do núcleo, e a palavra é
  // do texto. As duas quedas são diferentes e as duas são baratas de evitar.
  assert.equal(RC.semana, 'Semana nova. Uma aula e as revisões de hoje já movem o mapa.');
  assert.equal(RC.mes, 'Mês novo. Uma aula e as revisões de hoje já movem o mapa.');
  for (const rel of ['web/telas/jornada-topo.js', 'web/telas/jornada.css', 'web/metro.js']) {
    const fonte = LER(rel).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.equal(/Semana novo|Mês novo/.test(fonte), false,
      `${rel} escreve a frase de recomeço: ela vem de core/textos.js`);
    assert.equal(/getDay\(/.test(fonte), false,
      `${rel} calcula o dia da semana: a borda do calendário é de core/viagem.js`);
  }
});

test('S19a · o dia da semana é lido SEM fuso — a segunda de quem estuda às 23h', () => {
  // `new Date('2026-11-02')` é meia-noite EM UTC: para São Paulo (UTC-3) são
  // 21h de 1º de novembro, e a segunda-feira viraria domingo. A trava não pode
  // depender do fuso da máquina que roda o teste, então ela compara com a
  // tabela do calendário, escrita aqui como ORÁCULO (e não como frase).
  const espelho = { '2026-11-02': 'semana', '2026-11-03': null, '2026-11-09': 'semana', '2026-12-01': 'mes' };
  for (const [dia, esperado] of Object.entries(espelho)) {
    const saida = fraseDeRecomeco(dia, true);
    const frase = esperado === 'semana' ? RC.semana : esperado === 'mes' ? RC.mes : null;
    assert.equal(saida, frase, `${dia} deveria dar «${esperado}» e devolveu «${String(saida)}»`);
  }
  // Data ilegível ou ausente não é borda de nada: a frase cala.
  for (const ruim of ['', 'lixo', '2026-13-45', null, undefined]) {
    assert.equal(fraseDeRecomeco(ruim, true), null, `${String(ruim)} abriu uma borda do calendário`);
  }
});
