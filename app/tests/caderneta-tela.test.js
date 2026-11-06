// S17b — a TELA da caderneta (web/telas/perfil.js pintando core/caderneta.js).
//
// POR QUE EXISTE: o núcleo já foi travado em caderneta.test.js (os 8, os 43, os
// recordes, a próxima). O que este arquivo mede é a COSTURA: se a tela pinta
// TODOS os espaços que o núcleo devolve — inclusive os vazios, que são desenho
// e não lacuna — e se pinta AS PALAVRAS DO NÚCLEO em vez de inventar as suas.
// É a régua do princípio 4 do desenho (design/v3/00-desenho.md): carimbo nasce
// de critério medido, e o espaço vazio mostra a régua antes de mostrar a lacuna.
//
// NENHUM DADO É UM OBJETO ESCRITO À MÃO. O estudo nasce de `abrirAula`/
// `estudarAula`, os cartões de `criarCartao`/`revisarCartao`, a dominada de
// `aplicarResultado`, a declarada de `concluirEstacao`. O storage é escrito pelos
// SERIALIZADORES DO APP (`serializarEstudo`, `serializarCartoes`, `salvarViagem`)
// — a tela lê o texto cru, e a leitura do app é meia régua do que ela pinta.
//
// A GRADE É A REAL (data/catalog.json): os 43 do domínio são contados dela, e o
// total de 51 espaços é 8 + essa conta. Um `43` escrito aqui provava o pedido,
// não a tela.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { montar } from '../web/telas/perfil.js';
import { abrirAula, estudarAula, serializarEstudo, lerEstudo, ESTUDO_KEY } from '../core/estudo.js';
import { criarCartao, revisarCartao, serializarCartoes, lerCartoes, CARTOES_KEY } from '../core/cartoes.js';
import { aplicarResultado } from '../core/desafio.js';
import { concluirEstacao, progressoVazio } from '../core/viagem.js';
import { caderneta } from '../core/caderneta.js';
import { caderneta as C } from '../core/textos.js';
import { salvarViagem } from '../web/metro.js';
import { criarDoc, textoDe, comClasse } from './hdom.js';

const LER = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
const GRADE = JSON.parse(LER('data/catalog.json')).courses;

const L1 = 'ubl-core-circuitos-digitais';           // linha 1 — dominada pelo desafio
const L2 = 'ubl-core-calculo-i';                    // linha 2 — só declarada («concluída antes»)
const A1 = 'KGoSTh1sgyM';
const A2 = 'Zm9vYmFyMTIzNA';
const HOJE = '2026-11-12';

/** Os totais de aula na forma de `data/aulas/indice.json`. */
function indiceDe(totais) {
  return {
    estacoes: Object.fromEntries(
      Object.entries(totais).map(([id, aulas]) => [id, { slug: id, aulas, segundos: aulas * 600 }]),
    ),
  };
}

/** O storage do aparelho, escrito por quem escreve no aparelho. */
function aparelhoCom({ estudo, cartoes, progresso } = {}) {
  const dados = new Map();
  const storage = {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    key: (i) => [...dados.keys()][i] ?? null,
    get length() { return dados.size; },
    _dados: dados,
  };
  if (estudo) storage.setItem(ESTUDO_KEY, serializarEstudo(estudo));
  if (cartoes) storage.setItem(CARTOES_KEY, serializarCartoes(cartoes));
  if (progresso) {
    const ok = salvarViagem(storage, progresso);
    assert.equal(ok, true, 'o storage de mentira recusou a viagem; o dublê mudou de forma');
  }
  return storage;
}

/** A série inteira do mesmo balde, pela conta do núcleo — o par da tela. */
function noNucleo({ estudo, cartoes, progresso, indice }) {
  return caderneta({
    estudo: lerEstudo(serializarEstudo(estudo)),
    cartoes: lerCartoes(serializarCartoes(cartoes)),
    progresso,
    catalogo: GRADE,
    indice,
    hoje: HOJE,
  });
}

/** Uma viagem com aulas abertas/estudadas, 1 cartão revisitado no dia seguinte, 1 dominada, 1 declarada. */
function viagemReal() {
  let estudo = lerEstudo(null);
  estudo = abrirAula(estudo, { estacao: L1, aula: A1, n: 1 }, '2026-11-01T10:00');
  estudo = estudarAula(estudo, { estacao: L1, aula: A1, n: 1 }, '2026-11-01T11:00', { recordacao: 'r', conferencia: 'c' });
  estudo = abrirAula(estudo, { estacao: L1, aula: A2, n: 2 }, '2026-11-02T10:00');

  let cartoes = lerCartoes(null);
  const criado = criarCartao(cartoes, { estacao: L1, aula: A1, n: 1, frente: 'frente', verso: 'verso' }, '2026-11-01T11:00', 'c1');
  assert.equal(criado.ok, true, `criarCartao recusou: ${JSON.stringify(criado)}`);
  cartoes = criado.cartoes;
  const respondido = revisarCartao(cartoes, 'c1', { nota: 'lembrei', confianca: 'certeza' }, '2026-11-02T09:00');
  assert.equal(respondido.ok, true, `revisarCartao recusou: ${JSON.stringify(respondido)}`);
  cartoes = respondido.cartoes;

  const progresso0 = progressoVazio();
  const r = aplicarResultado(
    progresso0, cartoes, L1,
    { aprovado: true, acertos: 12, total: 14, lembrados: Array.from({ length: 12 }, (_, i) => `c${i + 1}`), errados: [] },
    { aulas: 93, cartoes: 23 },
    '2026-11-05T10:00',
  );
  assert.ok(r.progresso.dominadas[L1], `aplicarResultado não carimbou a dominada: ${JSON.stringify(r)}`);
  const progresso = concluirEstacao(r.progresso, L2, '2026-10-05', GRADE);
  assert.ok(progresso.conclusoes[L2], 'concluirEstacao não gravou a declarada');
  progresso.completed = [...new Set([...progresso.completed, L1, L2])];

  return {
    estudo,
    cartoes,
    progresso,
    indice: indiceDe({ [L1]: 93, [L2]: 30 }),
    storage: aparelhoCom({ estudo, cartoes, progresso }),
  };
}

function ctxCom(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const win = { localStorage: opts.storage || null, setTimeout: () => 0, clearTimeout: () => {} };
  doc._view = win;
  if (opts.reduced) doc._reducedMotion = true;
  return {
    document: doc,
    window: win,
    storage: opts.storage || null,
    modulos: { loadCompleted: () => (opts.completed || []).slice(), loadNotas: () => ({}) },
    hoje: HOJE,
    catalogo: Promise.resolve({ courses: GRADE, electives: [], specializations: [] }),
    indice: opts.indice || null,
    _doc: doc,
    _raiz: raiz,
  };
}

/** Monta e espera a pintura inteira: `pronto` é a promessa do que a tela fez. */
async function abrir(ctx) {
  const inst = await montar(ctx._raiz, ctx);
  await (inst.pronto || Promise.resolve());
  return inst;
}

const carimbosDaTela = (raiz) => comClasse(raiz, /^perfil-carimbo$/);
const vaziosDaTela = (raiz) => carimbosDaTela(raiz).filter((n) => n.dataset.estado === 'vazio');
const ganhosDaTela = (raiz) => carimbosDaTela(raiz).filter((n) => n.dataset.estado === 'carimbado');

// ───────────────────── 1. os 51 espaços, ganhos e vazios ─────────────────────

test('S17b · a tela pinta os 51 espaços: os 8 do percurso e os 43 do domínio', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);

  const itens = carimbosDaTela(ctx._raiz);
  const esperado = 8 + GRADE.length + 7 + 1;
  assert.equal(itens.length, esperado, `a caderneta mostra ${itens.length} espaços; o núcleo devolve ${esperado} (8 + ${GRADE.length} estações + 7 linhas + terminal)`);

  const vazios = vaziosDaTela(ctx._raiz);
  assert.ok(vazios.length > 30, `só ${vazios.length} espaços vazios para uma viagem de 2 aulas e 1 dominada: a tela está escondendo o que ainda não aconteceu`);

  // O domínio em fileiras por linha, como o bilhete já faz: uma fileira por linha
  // da grade, cada uma com as estações dela E o fim da linha no fim. O terminal
  // não pertence a linha nenhuma e vem depois de todas.
  const fileiras = comClasse(ctx._raiz, /^perfil-fileira$/);
  const comNumero = fileiras.filter((n) => n.dataset.linha);
  assert.equal(comNumero.length, 7, `${comNumero.length} fileiras numeradas; a grade tem 7 linhas`);
  assert.deepEqual(comNumero.map((n) => n.dataset.linha), ['1', '2', '3', '4', '5', '6', '7'], 'as fileiras não estão na ordem das linhas');
  for (const f of comNumero) {
    const t = textoDe(f);
    const nome = C.dominio.nomeLinha(Number(f.dataset.linha));
    assert.ok(t.includes(nome), `a fileira ${f.dataset.linha} não traz o fim da linha «${nome}»: "${t.slice(0, 60)}"`);
  }
  const terminal = comClasse(ctx._raiz, /^perfil-fileira-terminal$/);
  assert.equal(terminal.length, 1, 'o terminal não veio em fileira própria, depois das 7');
  assert.ok(textoDe(terminal[0]).includes(C.dominio.terminal.nome), 'a fileira do terminal perdeu o terminal');
});

test('S17b · o espaço vazio diz o critério, e não só que está vazio', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);

  const vazios = vaziosDaTela(ctx._raiz);
  const reAbreQuando = new RegExp(C.tela.abreQuando('').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  for (const n of vazios) {
    const t = textoDe(n);
    assert.ok(reAbreQuando.test(t), `espaço vazio sem a régua «Abre quando: …»: "${t.slice(0, 90)}"`);
    assert.ok(t.length > 24, `espaço vazio sem frase nenhuma: "${t}"`);
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(t), `espaço vazio com data crua em ISO: "${t}"`);
  }
});

test('A PROVA S17b · esconder os espaços vazios é pego pela trava', async () => {
  // O dente do item 1: a MESMA semeadura contada de dois jeitos — o núcleo e a
  // tela — nos dois números, vazio e total. Trocar o ramo do vazio em `carimbo()`
  // por `return null`, ou filtrar os vazios na seção, derruba estas duas linhas
  // pelo tamanho, não pelo desenho.
  const v = viagemReal();
  const nucle = noNucleo(v);
  const total = nucle.percurso.length + nucle.dominio.length;
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);
  const itens = carimbosDaTela(ctx._raiz);
  assert.equal(itens.length, total, `a tela pinta ${itens.length} dos ${total} espaços do núcleo — um vazio escondido é o bilhete de volta`);
  const vaziosNucleo = [...nucle.percurso, ...nucle.dominio].filter((c) => !c.data).length;
  assert.equal(vaziosDaTela(ctx._raiz).length, vaziosNucleo, `o núcleo devolve ${vaziosNucleo} espaços vazios e a tela pinta ${vaziosDaTela(ctx._raiz).length}`);
});

// ───────────────────── 2. o texto é o do núcleo, não da tela ─────────────────────

test('S17b · as seções usam core/textos.js, e o título da folha continua', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);
  const todo = textoDe(ctx._raiz);

  assert.ok(todo.includes('Cada carimbo é seu.'), 'o título da folha mudou sem o pedido mudar');
  assert.ok(todo.includes(C.tela.seriePercurso), 'a seção do percurso não usa a frase de core/textos.js');
  assert.ok(todo.includes(C.tela.serieDominio), 'a seção do domínio não usa a frase de core/textos.js');
  assert.ok(!/Marcos\b/.test(todo), 'a seção «Marcos» da S9 voltou para a tela');
});

test('S17b · cada carimbo ganho pinta A FRASE E O CRITÉRIO DO NÚCLEO, palavra por palavra', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);
  const todo = textoDe(ctx._raiz);

  const nucle = noNucleo(v);
  const ganhos = [...nucle.percurso, ...nucle.dominio].filter((c) => c.data);
  assert.ok(ganhos.length >= 2, `a semeadura não produziu carimbo ganho (${JSON.stringify(ganhos.map((g) => g.id))})`);
  for (const g of ganhos) {
    assert.ok(todo.includes(g.nome), `a tela perdeu o nome de «${g.id}»`);
    assert.ok(todo.includes(g.frase), `a tela não pinta a frase medida de «${g.nome}»: "${g.frase}"`);
    assert.ok(todo.includes(C.tela.abreQuando(g.criterio)), `a tela não repete o critério de «${g.nome}»`);
  }

  // O que a tela pinta como ganho é exatamente o que o núcleo mediu como ganho.
  assert.equal(ganhosDaTela(ctx._raiz).length, ganhos.length, `${ganhosDaTela(ctx._raiz).length} carimbos «carimbados» na tela contra ${ganhos.length} ganhos no núcleo`);
  for (const n of ganhosDaTela(ctx._raiz)) {
    assert.ok(/\d{2}\/\d{2}\/\d{4}/.test(textoDe(n)), `carimbo ganho sem data legível: "${textoDe(n)}"`);
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(textoDe(n)), `carimbo ganho com ISO crua: "${textoDe(n)}"`);
  }
});

test('S17b · a dominada leva a frase do que foi medido, com os números', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);
  const todo = textoDe(ctx._raiz);
  const dominada = noNucleo(v).dominio.find((c) => c.id === `dominio:${L1}`);
  assert.ok(dominada?.data, 'a semeadura não produziu a dominada');
  assert.ok(todo.includes(dominada.frase), `a tela escondeu a frase medida: "${dominada.frase}"`);
  assert.match(dominada.frase, /\d/, `a frase do domínio não traz o que foi medido: "${dominada.frase}"`);
});

test('S17b · a concluída antes mostra a MARCA com a data, e nenhuma frase de medida', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);

  const nomes = GRADE.filter((c) => c.id === L2).map((c) => c.title);
  const daDeclarada = carimbosDaTela(ctx._raiz).filter((n) => nomes.some((nome) => textoDe(n).includes(nome)));
  assert.ok(daDeclarada.length >= 1, 'a estação declarada não apareceu na caderneta');
  const comMarca = daDeclarada.find((n) => textoDe(n).includes(C.dominio.concluidaAntes));
  assert.ok(comMarca, `a declarada não mostra a marca «${C.dominio.concluidaAntes}»: "${textoDe(daDeclarada[0])}"`);
  assert.equal(comMarca.dataset.estado, 'vazio', 'a concluída antes apareceu como carimbo GANHO: a declaração virou medição');
  assert.ok(/\d{2}\/\d{2}\/\d{4}/.test(textoDe(comMarca)), 'a marca da declarada perdeu a data antiga');
});

// ───────────────────── 3. recordes e a próxima ─────────────────────

test('S17b · recorde sem dado não aparece, e com dado aparece sem palavra de sequência', async () => {
  // (a) aparelho limpo: nem fileira de recorde, nem a seção.
  const limpo = ctxCom({ storage: aparelhoCom({}), completed: [], indice: indiceDe({}) });
  await abrir(limpo);
  assert.deepEqual(comClasse(limpo._raiz, /^perfil-recorde$/), [], 'a tela mostrou um recorde sobre um aparelho sem cartão');
  assert.deepEqual(comClasse(limpo._raiz, /^perfil-recordes$/), [], 'a seção de recordes apareceu sem nenhum recorde com valor');

  // (b) com a viagem semeada: o que existe vem do núcleo, com as palavras dele.
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);
  const comValor = noNucleo(v).recordes.filter((x) => x.valor !== null);
  const itens = comClasse(ctx._raiz, /^perfil-recorde$/);
  assert.equal(itens.length, comValor.length, `a tela pinta ${itens.length} recordes; o núcleo tem ${comValor.length} com valor`);
  const todo = textoDe(ctx._raiz);
  for (const x of comValor) assert.ok(todo.includes(x.frase), `a tela perdeu o recorde «${x.nome}»: "${x.frase}"`);
  for (const proibida of ['seguida', 'streak', 'sequência']) {
    assert.ok(!new RegExp(proibida, 'i').test(todo), `a caderneta falou em «${proibida}»: o desenho (princípio 5) não quer aversão à perda`);
  }
});

test('S17b · a próxima coisa vem do núcleo, com a palavra dele', async () => {
  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(ctx);
  const nucle = noNucleo(v);
  const todo = textoDe(ctx._raiz);
  if (nucle.proxima.texto) {
    assert.ok(todo.includes(nucle.proxima.texto), `a tela não pinta a próxima como o núcleo a escreveu: "${nucle.proxima.texto}"`);
    assert.ok(todo.includes(C.tela.proxima), 'a seção da próxima sem o rótulo do texto');
  } else {
    assert.ok(!todo.includes(C.tela.proxima), 'a tela inventou uma seção de próxima onde o núcleo não achou estação');
  }
});

// ───────────────────── 4. o carimbo novo desce uma vez ─────────────────────

test('S17b · o carimbo novo desce UMA vez: na segunda visita ao Perfil, nenhum desce', async () => {
  const v = viagemReal();

  const primeira = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(primeira);
  const novos = carimbosDaTela(primeira._raiz).filter((n) => n.dataset.novo === 'descer');
  assert.ok(novos.length >= 1, 'na primeira visita ao Perfil nenhum carimbo ganho desceu — a régua está ao contrário');

  const segunda = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice });
  await abrir(segunda);
  const ainda = carimbosDaTela(segunda._raiz).filter((n) => n.dataset.novo === 'descer');
  assert.deepEqual(ainda, [], `${ainda.length} carimbos desceram de novo na segunda visita: o conjunto «visto» não foi gravado`);

  // A segunda visita não perdeu nada: mesmos espaços, mesma viagem.
  assert.equal(carimbosDaTela(segunda._raiz).length, carimbosDaTela(primeira._raiz).length, 'tirar o movimento apagou carimbo da tela');
});

test('S17b · com prefers-reduced-motion o carimbo aparece, sem movimento', async () => {
  // Três dentes, e nenhum é «a animação existe»:
  // (a) a duração vem de token — sem token não há como o reduce desligar;
  // (b) há bloco reduce com `animation: none` alcançando o carimbo novo;
  // (c) na tela montada com a flag ligada, o carimbo ganho está VISÍVEL, com o
  //     texto dele — ninguém perde informação por ter o movimento reduzido.
  const css = LER('web/telas/perfil.css');
  const regra = /\.perfil-carimbo\[data-novo="descer"\]\s*\{([^}]*)\}/.exec(css);
  assert.ok(regra, 'o carimbo novo não tem regra de movimento no CSS');
  const anim = /animation:([^;]+)/.exec(regra[1]);
  assert.ok(anim, 'o carimbo novo não anima');
  assert.match(anim[1], /var\(--movimento-/, `a duração do carimbo não vem de token de movimento (design §5): "${anim[1]}"`);

  const iCarimbo = css.indexOf('.perfil-carimbo[data-novo="descer"]');
  const iReduce = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(iReduce > iCarimbo, 'sem bloco reduce depois da regra, o movimento não para para quem pediu');
  assert.match(css.slice(iReduce), /\.perfil-carimbo\[data-novo="descer"\]\s*\{\s*animation:\s*none/, 'o reduce não alcança o carimbo novo');

  const v = viagemReal();
  const ctx = ctxCom({ storage: v.storage, completed: v.progresso.completed, indice: v.indice, reduced: true });
  await abrir(ctx);
  const ganhos = ganhosDaTela(ctx._raiz);
  assert.ok(ganhos.length >= 1, 'com reduce não há carimbo ganho na tela');
  for (const n of ganhos) assert.ok(textoDe(n).length > 20, `carimbo com reduce perdeu o texto: "${textoDe(n)}"`);
});
