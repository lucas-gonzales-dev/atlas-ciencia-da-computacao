// Projeto Atlas — S16c (04/11/2026): os DOIS EIXOS chegam à tela.
//
// O QUE ESTE ARQUIVO PROVA, E POR QUE ELE EXISTE EM VEZ DE UMA CHAMADA A
// `desenharTopo` NA MÃO: a peça já sabia desenhar — `desenharTopo` aceita
// `cartoes`/`indice`/`progresso` e a S16b aceitou `eixos` no mapa. O que faltava
// era o FIO. Foi assim duas vezes nesta casa (S11-0 defeito 1, S13c, e o nono
// arquivo da S20a): o teste entrega o dado à peça, os dois ficam verdes, e no
// app o dado nunca chega — a folha nasceu sem aulas, o mapa nasceria sem cor.
// Então nada aqui chama `desenharTopo` nem `desenharFolha` direto: tudo sobe por
// `subirMetro`, com o catálogo REAL, o `data/aulas/indice.json` REAL e um storage
// em memória escrito pelo NÚCLEO (`abrirAula`, `estudarAula`, `criarCartao`,
// `revisarCartao`). Um fixture inventado provaria o fixture.
//
// OS NÚMEROS NÃO SÃO ESCRITOS AQUI: o total de aulas da estação vem de
// `indice.estacoes`, a duração da fila de `minutosDaFila`, e toda frase de
// `core/textos.js`. Se o índice mudar, o teste acompanha; se alguém fixar um 93,
// ele denuncia.
//
// O ANEL DO ITEM B NÃO SE REPETE AQUI: `tests/revisar-fila.test.js:668-691` já
// varre o `revisar.css` e prova que os únicos alvos de `:focus-visible` do
// arquivo são os três de foco programático, cada um deixando `box-shadow` no
// lugar do `outline`; `auditoria-teclado-leitor.test.js:449` prova que o anel de
// `base.css` — o dos controles — continua lá. Refazer isso seria duas travas
// para a mesma régua.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { comClasse, criarDoc, janelaCom, porTag, storageCom, textoDe, todos, esperar } from './hdom.js';

import { subirMetro } from '../web/metro.js';
import { ESTUDO_KEY, abrirAula, estudarAula, lerEstudo, serializarEstudo } from '../core/estudo.js';
import {
  CARTOES_KEY, criarCartao, lerCartoes, minutosDaFila, revisarCartao, serializarCartoes
} from '../core/cartoes.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { MINIMO_VISIVEL } from '../core/mapa-rede.js';
import { folha as F, jornada as J, mapa as MAPA, revisar as REV } from '../core/textos.js';

const RAIZ = new URL('../', import.meta.url);
const LER = (rel) => readFileSync(fileURLToPath(new URL(rel, RAIZ)), 'utf8');
const CATALOGO = JSON.parse(LER('data/catalog.json')).courses;
const INDICE = JSON.parse(LER('data/aulas/indice.json'));

// A estação da frente é a primeira da primeira linha — hoje Circuitos Digitais,
// 93 aulas. Lida, nunca escrita: é exatamente a estação de 93 aulas que motivou
// o MINIMO_VISIVEL (3 estudadas = 0,032 = menos de 1 px num círculo de 22,8).
const LINHA_1 = [...new Set(CATALOGO.map((c) => Number(c.stage)).filter(Number.isFinite))].sort((a, b) => a - b)[0];
const PRIMEIRA = CATALOGO.find((c) => Number(c.stage) === LINHA_1);
const AULAS = JSON.parse(LER(`data/aulas/${PRIMEIRA.slug}.json`)).aulas;
const TOTAL = Number(INDICE.estacoes?.[PRIMEIRA.id]?.aulas);
assert.ok(TOTAL > 0, 'fixture: o indice.json não traz o total de aulas da estação — sem isto não há preenchimento a conferir');

/** O `buscar` do app, servindo os JSON do disco: o MESMO fio do `deps.buscarAulas`. */
const buscarDe = () => async (url) => {
  let bruto;
  try {
    bruto = LER(`data/${String(url).replace(/^data\//, '')}`);
  } catch {
    return { ok: false, status: 404, json: async () => ({}) };
  }
  return { ok: true, status: 200, json: async () => JSON.parse(bruto) };
};

/**
 * `n` aulas FECHADAS na primeira estação, por `abrirAula` + `estudarAula` de
 * verdade. Abrir e depois estudar é a ordem do app: quem só abre está 'embarcada'
 * e não pinta nada, e é essa a diferença que a trava dos dois eixos guarda.
 */
function estudoComEstudadas(n, dia = '2026-10-28') {
  let estudo = lerEstudo(null);
  for (const a of AULAS.filter((x) => Number(x.n) <= n)) {
    estudo = abrirAula(estudo, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, `${dia}T10:00`);
    estudo = estudarAula(estudo, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, `${dia}T11:30`,
      { recordacao: `rec ${a.n}`, conferencia: 'conferi' });
  }
  return estudo;
}

/**
 * Um cartão por aula, escritos por `criarCartao`; `lembradoEm` passa por
 * `revisarCartao`, que é o QUE PREENCHE `fsrs` — sem `fsrs` não há
 * recuperabilidade prevista e o `pedeRevisao` não existe. A data do lembrete é
 * sempre um dia depois do nascimento do cartão, porque é a regra do desenho:
 * Lembrei no mesmo dia é memória de curto prazo e não colore nada.
 */
function cartoesDoEstudo(n, { criadoEm = '2026-11-01', lembradoEm = null } = {}) {
  let arquivo = { versao: 1, cartoes: {} };
  for (const a of AULAS.filter((x) => Number(x.n) <= n)) {
    const r = criarCartao(arquivo, {
      estacao: PRIMEIRA.id, aula: a.id, n: a.n,
      frente: `Pergunta da aula ${a.n}?`, verso: `Resposta da aula ${a.n}.`
    }, `${criadoEm}T10:00`, `c${a.n}`);
    assert.equal(r.ok, true, `fixture: cartão recusado (${r.erro})`);
    arquivo = { versao: 1, cartoes: r.cartoes };
  }
  if (lembradoEm) {
    for (const id of Object.keys(arquivo.cartoes)) {
      const rr = revisarCartao(arquivo.cartoes, id, { nota: 'lembrei', confianca: 'certeza' }, `${lembradoEm}T09:00`);
      assert.equal(rr.ok, true, `fixture: revisão recusada (${rr.erro})`);
      arquivo = { versao: 1, cartoes: rr.cartoes };
    }
  }
  return serializarCartoes(arquivo);
}

/** Sobe o app inteiro pelo caminho do app, e devolve a raiz já repintada. */
async function subir({ estudo = null, cartoes = null, completed = [], hoje = '2026-11-04', folha = null } = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const win = janelaCom();
  win.location = { hash: folha ? `#/estacao/${folha}` : '#/' };
  const inicial = {};
  if (estudo) inicial[ESTUDO_KEY] = serializarEstudo(estudo);
  if (cartoes) inicial[CARTOES_KEY] = cartoes;
  const storage = storageCom(inicial);
  const inst = await subirMetro({
    root: raiz, document: doc, storage, window: win,
    modulos: {
      loadCatalog: () => Promise.resolve({ courses: CATALOGO }),
      loadCompleted: () => completed.slice(),
      saveCompleted: () => true,
      loadNotas: () => ({}),
      saveNotas: () => true,
      aplicarNota: (s) => s
    },
    setTimeout: () => 0,
    hoje,
    buscarAulas: buscarDe(),
    folha
  });
  // O indice.json e a lista da estação chegam por promessa, dentro do pintar:
  // três ticks é o que `aulas-fio.test.js` espera para o fio inteiro fechar.
  await esperar(); await esperar(); await esperar();
  return { doc, raiz, storage, inst, win };
}

const topoDa = (raiz) => comClasse(raiz, /^topo$/)[0];
const svgDoTopo = (raiz) => porTag(comClasse(topoDa(raiz), /^topo-mapa$/)[0], 'svg')[0];
const preenchimentos = (raiz) => comClasse(svgDoTopo(raiz), /^mapa-preenchimento$/);
const primarios = (raiz) => comClasse(raiz, /^botao-primario$/);
const folhaPainel = (raiz) => comClasse(raiz, /^folha$/)[0];

// ═══════════════════ 1. o fio: eixos chegam ao mapa da Jornada ═══════════════

test('S16c · fio: aulas estudadas no storage viram preenchimento no mapa da Jornada', async () => {
  const { raiz } = await subir({ estudo: estudoComEstudadas(3) });
  const rects = preenchimentos(raiz);
  assert.equal(rects.length, 1,
    `o mapa da Jornada tem ${rects.length} preenchimentos — com 3 aulas fechadas em uma estação o fio não chegou`);
  const dono = rects[0].parent;
  assert.equal(dono.getAttribute('data-id'), PRIMEIRA.id,
    'o preenchimento apareceu em outra estação que não a estudada');
  assert.equal(dono.getAttribute('data-estado'), 'em-percurso',
    `3 de ${TOTAL} é 'em-percurso', não «${dono.getAttribute('data-estado')}»`);

  // O MÍNIMO VISITADO PELO FIO, com os números reais: 3 de 93 é 0,032, e é este
  // caminho que desenha 15% do diâmetro em vez de um sub-pixel. A conta é lida do
  // PRÓPRIO retângulo (a largura dele é o diâmetro), não de um raio copiado aqui.
  const diametro = Number(rects[0].getAttribute('width'));
  const altura = Number(rects[0].getAttribute('height'));
  // O desenho ARREDONDA para uma casa (`numero`, core/mapa-rede.js:70), então o
  // valor que sai do retângulo é o mínimo JÁ arredondado, não o produto exato. A
  // tolerância é meia casa de arredondamento do próprio desenhista — o bastante
  // para perdoar o `numero` e ainda separar as duas alturas que importam: 15% do
  // diâmetro (~3,4) dos 3,2% que a proporção pura daria (~0,7, meio pixel).
  const minimo = Math.round(MINIMO_VISIVEL * diametro * 10) / 10;
  assert.ok(Math.abs(altura - minimo) <= 0.05,
    `com 3 de ${TOTAL} a altura desenhada é o mínimo visível: ${altura} vs ${minimo}`);
  const proporcional = (3 / TOTAL) * diametro;
  assert.ok(altura > proporcional * 3,
    `a altura ${altura} é perto da proporção pura (${proporcional}): o mínimo visível não entrou no desenho`);

  // O rótulo acessível acompanha a medida: com medição no mapa, ele CONTA os
  // estágios; sem ela, a frase da S20a («nenhuma estudada ainda») continua.
  const rotulo = svgDoTopo(raiz).getAttribute('aria-label');
  assert.ok(rotulo.includes(MAPA.estagios['em-percurso'][0]), `o rótulo não diz o estágio medido: «${rotulo}»`);
  assert.ok(rotulo.includes(`${CATALOGO.length - 1} ${MAPA.estagios.fora[1]}`),
    `o rótulo não conta as outras estações: «${rotulo}»`);
});

test('S16c · fio: aparelho vazio não desenha preenchimento, legenda nem rótulo de medida', async () => {
  const { raiz } = await subir();
  assert.equal(preenchimentos(raiz).length, 0, 'o mapa pintou preenchimento sem nenhuma aula fechada');
  assert.equal(comClasse(topoDa(raiz), /^topo-legenda$/).length, 0,
    'a legenda apareceu onde não há nada a decifrar');
  assert.equal(svgDoTopo(raiz).getAttribute('aria-label'), J.topo.mapaAcessivel(CATALOGO.length, 0),
    'sem medição o rótulo continua sendo o da primeira visita, não uma contagem de estágios');
});

test('S16c · legenda: só existe quando há ao menos uma aula estudada', async () => {
  const vazio = await subir();
  const medido = await subir({ estudo: estudoComEstudadas(1) });
  assert.equal(comClasse(topoDa(vazio.raiz), /^topo-legenda$/).length, 0, 'a legenda nasceu sem medição');
  const linha = comClasse(topoDa(medido.raiz), /^topo-legenda$/);
  assert.equal(linha.length, 1, 'com uma aula estudada a legenda sumiu do mapa');
  assert.equal(textoDe(linha[0]), MAPA.legenda, 'a legenda não é a frase de textos.js');
});

test('S16c · embarcada: abrir uma aula não pinta preenchimento, mas põe o contorno da entrada', async () => {
  // `abrirAula` sem `estudarAula`: é o gesto de quem foi ler o título. Encher o
  // círculo aqui seria o princípio 1 ao contrário — abrir viraria estudar.
  let estudo = lerEstudo(null);
  estudo = abrirAula(estudo, { estacao: PRIMEIRA.id, aula: AULAS[0].id, n: 1 }, '2026-10-28T10:00');
  const { raiz } = await subir({ estudo });
  assert.equal(preenchimentos(raiz).length, 0, 'aula ABERTA pintou preenchimento: abrir contou como estudar');
  const contornos = comClasse(svgDoTopo(raiz), /^mapa-embarcada$/);
  assert.equal(contornos.length, 1, 'quem entrou na estação não tem o contorno próprio no mapa');
  assert.equal(comClasse(topoDa(raiz), /^topo-legenda$/).length, 0,
    'a legenda apareceu com a rede só embarcada: ainda não há estudo a decifrar');
});

// ═══════════════════ 2. a folha: as duas linhas lidas dos eixos ══════════════

test('S16c · folha: a medida diz as aulas estudadas e as lembradas, com os números do índice', async () => {
  const { raiz } = await subir({
    folha: PRIMEIRA.slug,
    estudo: estudoComEstudadas(3),
    cartoes: cartoesDoEstudo(2, { lembradoEm: '2026-11-02' }),
    hoje: '2026-11-03'
  });
  const painel = folhaPainel(raiz);
  assert.ok(painel, 'a folha da rota não abriu pelo caminho do app');
  const linha = comClasse(painel, /^folha-eixos-medida$/);
  assert.equal(linha.length, 1, 'a folha não mostra a linha dos dois eixos');

  // 3 estudadas, 2 lembradas (o cartão da 3ª aula nunca foi revisado). O TOTAL é
  // o do indice.json, e a frase é a do textos.js chamada com os números medidos.
  const esperado = F.eixos(3, TOTAL, 2);
  assert.equal(textoDe(linha[0]), esperado,
    `a folha diz outra coisa: «${textoDe(linha[0])}» — a medida não veio do storage`);
  assert.ok(esperado.includes(String(TOTAL)), 'o total de aulas não veio do índice');
  assert.ok(!esperado.includes('0 lembradas'), 'a frase mostrou uma contagem zero');

  // Cross-check com o núcleo: a tela não refaz a conta, ela mostra a conta dele.
  const eixo = eixosDaEstacao(PRIMEIRA.id, {
    estudo: estudoComEstudadas(3),
    cartoes: lerCartoes(cartoesDoEstudo(2, { lembradoEm: '2026-11-02' })),
    indice: INDICE, progresso: { completed: [] }, hoje: '2026-11-03'
  });
  assert.equal(eixo.estudadas, 3);
  assert.equal(eixo.lembradas, 2);
  assert.equal(eixo.total, TOTAL);
});

test('S16c · folha: a linha de revisão só existe com pedeRevisao, e leva à aba', async () => {
  const cartoes = cartoesDoEstudo(2, { lembradoEm: '2026-11-02' });

  // Esfriada: última revisão em 02/11, hoje 20/12 → 48 dias sobre S=2,3065,
  // recuperabilidade ~0,62, abaixo do limiar. A estação pede revisão.
  const esfriada = await subir({ folha: PRIMEIRA.slug, estudo: estudoComEstudadas(3), cartoes, hoje: '2026-12-20' });
  const link = comClasse(folhaPainel(esfriada.raiz), /^folha-eixos-revisar$/);
  assert.equal(link.length, 1, 'com a recuperabilidade sob 0,8 a folha não chamou a revisão');
  const devidos = lerCartoes(cartoes).cartoes;
  const n = Object.values(devidos).filter((c) => c.devidoEm <= '2026-12-20' && c.estacao === PRIMEIRA.id).length;
  assert.ok(n > 0, 'fixture: nenhum cartão devido na estação — a linha não teria o que dizer');
  assert.equal(textoDe(link[0]), F.eixosRevisao(minutosDaFila(n)), 'a linha não é a frase de textos.js com a fila real');
  assert.equal(link[0].getAttribute('href'), '#/revisar', 'a linha da folha não leva à aba Revisar');
  assert.equal(link[0].tag, 'a', 'a linha de revisão é um botão; ela é um caminho, não uma ação primária');

  // Quente: um dia depois do lembrete, a recuperabilidade está em ~0,95. Nada a
  // pedir — e a linha de medida continua lá, provando que o que sumiu foi a
  // segunda linha, não o bloco inteiro.
  const fresca = await subir({ folha: PRIMEIRA.slug, estudo: estudoComEstudadas(3), cartoes, hoje: '2026-11-03' });
  assert.equal(comClasse(folhaPainel(fresca.raiz), /^folha-eixos-revisar$/).length, 0,
    'a folha pediu revisão um dia depois de a pessoa lembrar: o anel acendeu sem esfriar nada');
  assert.equal(comClasse(folhaPainel(fresca.raiz), /^folha-eixos-medida$/).length, 1,
    'sem pedeRevisao a folha perdeu até a linha de medida');
});

// ═══════════════════ 3. a linha da fila do dia no topo (S15b item 4) ═════════

test('S16c · topo: com cartões devidos, a fila do dia aparece como LINK e o primário continua único', async () => {
  const cartoes = cartoesDoEstudo(3);
  const { raiz } = await subir({ estudo: estudoComEstudadas(3), cartoes, hoje: '2026-11-04' });
  const linha = comClasse(topoDa(raiz), /^topo-revisoes$/);
  assert.equal(linha.length, 1, 'com 3 cartões vencidos o topo não disse a fila do dia');
  assert.equal(linha[0].tag, 'a', 'a fila do dia no topo é botão; é um link para a aba');
  assert.equal(linha[0].getAttribute('href'), '#/revisar');
  assert.equal(textoDe(linha[0]), REV.hoje(3, minutosDaFila(3)),
    `o topo não chama a MESMA frase da aba: «${textoDe(linha[0])}»`);
  assert.equal(primarios(raiz).length, 1, 'a linha da fila virou um segundo primário na Jornada');
});

test('S16c · topo: com zero devidos, a linha da fila NÃO EXISTE e o primário continua único', async () => {
  // Mesmo storage, um dia antes: os cartões de 01/11 voltam em 02/11, então em
  // 01/11 ninguém deve nada. "Em dia" é o que a aba diz; o topo cala.
  const { raiz } = await subir({ estudo: estudoComEstudadas(3), cartoes: cartoesDoEstudo(3), hoje: '2026-11-01' });
  assert.equal(comClasse(topoDa(raiz), /^topo-revisoes$/).length, 0,
    'o topo anunciou a fila no dia em que nada está vencido');
  assert.equal(primarios(raiz).length, 1, 'sem fila o topo ganhou um segundo primário');
});

// ═══════════════════ 4. as frases novas contra a lista do proibido ═══════════
// `auditoria-proibidos.test.js` varre as telas MONTADAS — mas com o storage de
// quem ainda não estudou, as frases desta fatia nem aparecem lá. Elas só são
// lidas pela pessoa que tem cartões e aula fechada, e é neste arquivo que essa
// pessoa existe. O veneno abaixo é o MESMO da régua 9 (design/README §9), mais a
// regra da S20a: nenhum texto desta fatia fala de ausência, atraso ou dias sem
// estudar.

const SEM_MEDIDA = [/sumiu/i, /faz\s+\d+\s+dias?/i, /\bdesde\b/i, /atras[oa]/i, /aus[êe]ncia/i, /perd[ia]/i, /sequ[êe]ncia/i, /\bXP\b/, /ranking/i, /\bpontos?\b/i];

test('S16c · proibido: as frases novas não falam de atraso nem de ausência', async () => {
  const { raiz } = await subir({
    estudo: estudoComEstudadas(3),
    cartoes: cartoesDoEstudo(2, { lembradoEm: '2026-11-02' }),
    hoje: '2026-12-20',
    folha: PRIMEIRA.slug
  });
  const lidos = [
    ['topo inteiro', textoDe(topoDa(raiz))],
    ['folha inteira', textoDe(folhaPainel(raiz))],
    ['legenda', MAPA.legenda],
    ['medida da folha', F.eixos(3, TOTAL, 2)],
    ['linha de revisão da folha', F.eixosRevisao(minutosDaFila(2))],
    ['fila do dia no topo', REV.hoje(3, minutosDaFila(3))]
  ];
  for (const [nome, texto] of lidos) {
    assert.ok(texto, `fixture: «${nome}» veio vazio`);
    for (const re of SEM_MEDIDA) {
      const achado = re.exec(texto);
      assert.ok(!achado, `${nome}: diz «${achado && achado[0]}» — ausência não se cobra na tela (design/README §9)`);
    }
    assert.ok(!/\p{Extended_Pictographic}/u.test(texto), `${nome}: emoji na frase — placa de metrô não tem emoji`);
  }
});
