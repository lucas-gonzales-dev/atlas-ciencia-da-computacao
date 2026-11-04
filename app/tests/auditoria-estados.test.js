// Projeto Atlas — régua 1 (S10a): todo estado da tabela «Estados por tela»,
// provocado na tela de verdade, conferindo o TEXTO e a SAÍDA.
//
// POR QUE EXISTE: as oito frases dos estados existem em core/textos.js desde a
// fase 1, e cada fatia conferiu o seu pedaço. Nada até aqui percorria a tabela
// do design/README.md §6 contra as cinco telas montadas. Este arquivo provoca
// cada estado — viagem vazia, viagem no meio, Terminal, busca sem resultado,
// estação que não existe, catálogo que falha, offline — e exige duas coisas:
// a frase da casa (nunca uma palavra inventada pela tela) e uma saída (link ou
// botão). Estado com texto e sem saída é a pessoa presa num beco; estado com
// saída e sem texto é a tela mudando cor e não dizendo nada.
//
// O catálogo é o REAL (data/catalog.json): «35 estações», «Terminal» e o número
// de pré-requisitos faltantes têm de sair da fonte, não de uma fixture de três
// linhas — a mesma lição do applyNote (94cb36c): dublê com interface inventada
// prova o dublê. Mini-DOM compartilhado em tests/hdom.js.
//
// NADA DE RELÓGIO DE VERDADE: toda tela recebe setTimeout/clearTimeout por ctx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { botoesDe, criarDoc, criarNo, janelaCom, linksDe, porTag, storageCom, tagDeAbertura, textoDe, esperar } from './hdom.js';
import { montar as montarExplorar } from '../web/telas/explorar.js';
import { montar as montarRevisar } from '../web/telas/revisar.js';
import { montar as montarPerfil } from '../web/telas/perfil.js';
import { subirMetro } from '../web/metro.js';
import { TEXTOS, comValores, estados, folha as tFolha, jornada as J, revisar as tRev, perfil as tPerf } from '../core/textos.js';
import { agendarConclusao, serializeRevisoes, STORAGE_KEY } from '../core/revisao.js';

const CATALOGO = JSON.parse(readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8'));
const IDS = CATALOGO.courses.map((c) => c.id);
const HOJE = '2026-11-02';

function modulosCom(opts = {}) {
  return {
    loadCatalog: () => ('catalogo' in opts ? opts.catalogo : prometido(CATALOGO)),
    loadCompleted: () => (opts.completed || []).slice(),
    saveCompleted: () => true,
    loadNotas: () => (opts.notas || {}),
    saveNotas: () => true,
    aplicarNota: (state) => state,
    ...opts.modulos
  };
}

function contexto(doc, opts = {}) {
  const storage = opts.storage || storageCom(
    opts.completed?.length ? { 'atlas.progresso.v1': JSON.stringify(opts.completed) } : {}
  );
  return {
    document: doc,
    window: { localStorage: storage, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} },
    storage,
    modulos: modulosCom(opts),
    hoje: HOJE,
    catalogo: opts.catalogo,
    estadoCatalogo: CATALOGO
  };
}

/**
 * O campo de busca QUE A TELA DESENHOU, procurado na árvore. A Explorar devolve
 * apenas { desmontar } — e é assim que deve ficar: expor um campo só porque o
 * teste pede seria a tela moldando a cara dela ao dublê, a mesma inversão do
 * modulosFake que escondeu o applyNote (94cb36c).
 */
function campoDeBusca(raiz) {
  const achado = porTag(raiz, 'input').find((n) => n.type === 'search' || n.id === 'busca-explorar');
  assert.ok(achado, 'a Explorar montou sem campo de busca');
  return achado;
}

/** A tela oferece uma saída? Link ou botão, nunca só a frase. */
function saidasDa(raiz) {
  return [...linksDe(raiz), ...botoesDe(raiz)];
}

function exigeTextoESaida(raiz, frases, onde) {
  const t = textoDe(raiz);
  for (const f of frases) {
    assert.match(t, new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${onde}: falta a frase «${f}»`);
  }
  assert.ok(saidasDa(raiz).length > 0, `${onde}: estado sem saída (link ou botão)`);
}

const falhou = () => Promise.reject(new Error('sem rede: fetch falhou'));
const prometido = (v) => Promise.resolve(v);

// ───────────────────────── JORNADA (o metrô) ─────────────────────────
async function metro(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const catalogo = 'catalogo' in opts ? opts.catalogo : prometido(CATALOGO);
  const inst = await subirMetro({
    root: raiz,
    document: doc,
    storage: opts.storage || storageCom(),
    window: { setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} },
    modulos: modulosCom(opts),
    setTimeout: () => 0,
    hoje: HOJE,
    // subirMetro nao le deps.catalogo: quem entrega o catalogo e modulos.loadCatalog
    folha: opts.folha
  });
  return { doc, raiz, inst };
}

// S20a (04/11/2026): o estado «viagem vazia» mudou de cara. O quadro «Bem-vindo
// ao embarque» saiu e o TOPO da Jornada faz o papel dele — mapa, título, medida
// e UM primário que leva à primeira aula. A régua continua a mesma: a frase da
// casa e uma saída. O que muda é QUAL frase, e ela vem de core/textos.js.
test('estados: JORNADA viagem vazia — o topo com o mapa, o primeiro passo e o marcar', async () => {
  const { raiz } = await metro({ completed: [] });
  exigeTextoESaida(raiz, [
    J.topo.titulo,
    J.topo.comecar,
    J.topo.marcar
  ], 'Jornada vazia');
  // A medida do compromisso, lida do catálogo (35 estações).
  assert.match(textoDe(raiz), new RegExp(`${CATALOGO.courses.length} disciplinas`),
    'a primeira visita não diz o tamanho da rede');
});

test('estados: JORNADA viagem no meio — o contador diz «6 de 35»', async () => {
  const { raiz } = await metro({ completed: IDS.slice(0, 6) });
  assert.match(textoDe(raiz), /6 de 35 estações/, 'a viagem no meio não diz onde a pessoa está');
  assert.match(textoDe(raiz), /SUA PRÓXIMA ESTAÇÃO|Sua próxima estação/i, 'sem a placa da próxima');
});

test('estados: JORNADA Terminal — a rede toda feita tem nome e saída', async () => {
  const { raiz } = await metro({ completed: IDS });
  assert.match(textoDe(raiz), new RegExp(estados.terminal.titulo), 'fechou a rede e a tela não diz Terminal');
  assert.ok(saidasDa(raiz).length > 0, 'Terminal sem saída');
});

test('estados: JORNADA catálogo que falha — as três partes do erro', async () => {
  const { raiz } = await metro({ catalogo: falhou() });
  const t = textoDe(raiz);
  assert.match(t, new RegExp(estados.erro.parteUm), 'erro sem o que falhou');
  assert.match(t, /Motivo: /, 'erro sem o porquê');
  assert.match(t, /Recarregue a página/, 'erro de duas partes: sem o que fazer agora');
});

// ───────────────────────── EXPLORAR ─────────────────────────
async function explorar(catalogo = prometido(CATALOGO)) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const inst = await montarExplorar(raiz, contexto(doc, { catalogo }));
  await esperar();
  return { doc, raiz, inst };
}

test('estados: EXPLORAR carregando — esqueleto, nenhuma linha montada', async () => {
  const nunca = new Promise(() => {});
  const { raiz } = await explorar(nunca);
  const t = textoDe(raiz);
  assert.ok(!/Linha \d/.test(t), 'a Explorar carregada não pode aparecer antes do catálogo');
});

test('estados: EXPLORAR busca sem resultado — repete o termo e oferece limpar', async () => {
  const { raiz } = await explorar();
  const campo = campoDeBusca(raiz);
  campo.value = 'zxqw';
  campo.dispatch('input');
  exigeTextoESaida(raiz, [comValores.buscaVazia('zxqw')], 'Explorar sem resultado');
});

test('estados: EXPLORAR busca vazia de novo — a rede inteira volta', async () => {
  const { raiz } = await explorar();
  const campo = campoDeBusca(raiz);
  campo.value = 'zxqw';
  campo.dispatch('input');
  campo.value = '';
  campo.dispatch('input');
  assert.match(textoDe(raiz), /35 estações/, 'limpar a busca não devolveu a rede');
});

test('estados: EXPLORAR catálogo que falha — as três partes, não um selo', async () => {
  const { raiz } = await explorar(falhou());
  const t = textoDe(raiz);
  assert.match(t, new RegExp(estados.erro.parteUm), `Explorar em erro sem o que falhou (está dizendo: ${t.slice(0, 80)})`);
  assert.match(t, /Motivo: /, 'Explorar em erro sem o porquê');
  assert.match(t, /Recarregue a página/, 'Explorar em erro sem o que fazer agora');
});

// ───────────────────────── ESTAÇÃO (a folha) ─────────────────────────
test('estados: ESTAÇÃO que não existe — diz e devolve ao mapa', async () => {
  const { raiz } = await metro({ folha: 'estacao-que-a-fonte-nao-publicou' });
  exigeTextoESaida(raiz, [tFolha.naoEstaNoMapa, tFolha.voltarAoMapa], 'Estação inexistente');
  const link = linksDe(raiz).find((a) => a.textContent === tFolha.voltarAoMapa);
  assert.equal(link.getAttribute('href'), '#/', 'a saída da estação inexistente não leva ao mapa');
});

test('estados: ESTAÇÃO disponível — a folha avisa que o curso abre fora', async () => {
  // A folha é ROTA (S5 parte 2): o aviso mora nela, então o estado precisa
  // abrir a folha de uma estação disponível de verdade, não o mapa.
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length);
  const { raiz } = await metro({ completed: [], folha: disponivel.slug });
  assert.match(textoDe(raiz), new RegExp(tFolha.notaAbrir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'a folha manda abrir o recurso sem dizer que ele sai do Atlas');
});

// ───────────────────────── REVISAR ─────────────────────────
async function revisar(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const inst = await montarRevisar(raiz, contexto(doc, opts));
  await esperar();
  return { doc, raiz, inst };
}

test('estados: REVISAR nenhuma concluída — diz por onde começar', async () => {
  const { raiz } = await revisar({ completed: [], catalogo: prometido(CATALOGO) });
  exigeTextoESaida(raiz, [tRev.nadaParaRevisar, tRev.irParaProxima], 'Revisar sem nada concluído');
});

test('estados: REVISAR em dia — a próxima revisão em data legível', async () => {
  const id = IDS[0];
  const fila = agendarConclusao({}, id, '2026-11-02');
  const storage = storageCom({
    'atlas.progresso.v1': JSON.stringify([id]),
    [STORAGE_KEY]: serializeRevisoes(fila)
  });
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  await montarRevisar(raiz, contexto(doc, {
    completed: [id], catalogo: prometido(CATALOGO), storage, hoje: '2027-06-01'
  }));
  await esperar();
  exigeTextoESaida(raiz, [tRev.emDia], 'Revisar em dia');
  assert.match(textoDe(raiz), /\d{2}\/\d{2}\/\d{4}/, 'a próxima revisão saiu em ISO ou sem data legível');
});

test('estados: REVISAR catálogo que falha — discreto, e diz por quê', async () => {
  const { raiz } = await revisar({ completed: IDS.slice(0, 3), catalogo: falhou() });
  const t = textoDe(raiz);
  assert.match(t, new RegExp(estados.offline.descricao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'Revisar sem catálogo não diz que o resto continua funcionando');
});

// ───────────────────────── PERFIL ─────────────────────────
async function perfil(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const ctx = contexto(doc, opts);
  const inst = await montarPerfil(raiz, ctx);
  if (inst?.pronto) await inst.pronto;
  return { doc, raiz, inst, ctx };
}

test('estados: PERFIL bilhete em branco — a frase e o caminho', async () => {
  const { raiz } = await perfil({ completed: [], catalogo: prometido(CATALOGO) });
  exigeTextoESaida(raiz, [tPerf.emBranco, tPerf.irParaProxima], 'Perfil em branco');
});

test('estados: PERFIL catálogo que falha — as três partes, com saída', async () => {
  const { raiz } = await perfil({ completed: [], catalogo: falhou() });
  const t = textoDe(raiz);
  assert.match(t, new RegExp(tPerf.erro), 'Perfil sem rede não diz o que falhou');
  assert.match(t, new RegExp(tPerf.erroOQueFazer), 'Perfil sem rede não diz o que fazer');
  assert.ok(saidasDa(raiz).length > 0, 'Perfil sem rede é beco: nenhuma saída para a pessoa');
});

test('estados: PERFIL importação recusada — o porquê e o que fazer', async () => {
  const { raiz, ctx } = await perfil({ completed: IDS.slice(0, 3), catalogo: prometido(CATALOGO) });
  const entrada = linksDe(raiz).length ? null : null;
  const campo = encontrarCampoDeArquivo(raiz);
  assert.ok(campo, 'o Perfil não montou o campo de importar');
  campo.files = [{ text: async () => '{"nao":"sou viagem do Atlas"}' }];
  campo.dispatch('change', { target: campo });
  if (ctx && campo) await esperar();
  const t = textoDe(raiz);
  assert.match(t, new RegExp(tPerf.dados.recusaPorque.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'a recusa de importação não diz o que chegou');
  assert.match(t, new RegExp(tPerf.dados.recusaOQueFazer), 'a recusa de importação não diz o que fazer');
});

function encontrarCampoDeArquivo(raiz) {
  const anda = (n) => {
    if (n.tag === 'input' && (n.type === 'file' || n.attrs?.accept)) return n;
    for (const f of n.children || []) { const r = anda(f); if (r) return r; }
    return null;
  };
  return anda(raiz);
}

// ───────────────────────── o selo do casco ─────────────────────────
//
// S10b (03/11/2026): o `todo` que a S10a deixou virou teste de verdade. Não
// basta o `id` existir no HTML — o que a régua 1 cobra é o ESTADO provocado:
// cortar a rede e ler o que o selo diz, devolver a rede e ler o que ele cala.
// É o único estado da tabela que não pertence a uma tela: o catálogo está no
// precache, então estar offline é o Atlas inteiro funcionando, e quem avisa é o
// invólucro, uma vez, e não cada tela com um banner.
test('estados: offline — o selo do casco existe, e é aria-live polite', () => {
  const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const selo = tagDeAbertura(html, 'p').find((t) => /id="estado-rede"/.test(t));
  assert.ok(selo, 'o index.html não tem o selo de rede do casco (<p id="estado-rede">)');
  assert.match(selo, /aria-live="polite"/,
    'o selo de rede precisa de aria-live polite: é estado que não é tela cheia');
  // Começa CALADO: quem abre o app com rede não pode ler «offline» um instante.
  assert.match(selo, /\bhidden\b/, `o selo nasce visível no HTML: ${selo}`);
  const casco = readFileSync(fileURLToPath(new URL('../web/casco.js', import.meta.url)), 'utf8');
  assert.match(casco, /ligarSeloRede/, 'o casco não liga o selo de rede ao subir');
});

test('estados: offline — cortar a rede mostra o selo com a frase da casa; devolver cala', async () => {
  const { ligarSeloRede } = await import('../web/rede.js');
  const doc = criarDoc();
  const selo = criarNo('p', doc);
  selo.setAttribute('hidden', '');
  doc._registrar('estado-rede', selo);
  const win = janelaCom({ onLine: true });

  ligarSeloRede({ document: doc, window: win });
  assert.equal(selo.hasAttribute('hidden'), true, 'com rede, o selo tem de estar calado');
  assert.equal(textoDe(selo), '', 'com rede, o selo escreve alguma coisa');

  win.dispatch('offline');
  assert.equal(selo.hasAttribute('hidden'), false, 'sem rede o selo continua escondido');
  assert.match(selo.textContent, new RegExp(estados.offline.titulo),
    'o selo não usa a frase da casa (core/textos.js, estados.offline)');

  win.dispatch('online');
  assert.equal(selo.hasAttribute('hidden'), true, 'a rede voltou e o selo não saiu');
  assert.equal(selo.textContent, '', 'a rede voltou e o selo ainda diz alguma coisa');
});

test('estados: offline — quem abre o app SEM rede vê o selo desde a primeira pintura', async () => {
  const { ligarSeloRede } = await import('../web/rede.js');
  const doc = criarDoc();
  const selo = criarNo('p', doc);
  selo.setAttribute('hidden', '');
  doc._registrar('estado-rede', selo);
  ligarSeloRede({ document: doc, window: janelaCom({ onLine: false }) });
  assert.equal(selo.hasAttribute('hidden'), false, 'abriu offline e o selo não avisou ninguém');
});

test('estados: offline — sem o selo na página, ligar não quebra o casco', async () => {
  // metro.html é a página do metrô afora: não tem o selo. O casco chama a mesma
  // função nelas duas, e um id ausente não pode virar TypeError na primeira
  // pintura — é assim que a tela fica branca com a suíte verde (01/11).
  const { ligarSeloRede } = await import('../web/rede.js');
  const doc = criarDoc();
  const saida = ligarSeloRede({ document: doc, window: janelaCom({ onLine: false }) });
  assert.equal(saida.ok, false, 'sem #estado-rede, ligar tem de dizer que não ligou');
  assert.match(saida.motivo, /estado-rede/, `motivo obscuro: ${saida.motivo}`);
});

test('estados: a tabela tem frase para os oito estados, nenhuma vazia', () => {
  for (const [nome, bloco] of Object.entries(estados)) {
    const valores = Object.values(bloco).filter((v) => typeof v === 'string');
    assert.ok(valores.length >= 1, `estado ${nome} sem texto`);
    for (const v of valores) assert.ok(v.trim().length > 0, `estado ${nome} com campo vazio`);
  }
  assert.equal(Object.keys(TEXTOS).length >= 12, true, 'TEXTOS encolheu');
});
