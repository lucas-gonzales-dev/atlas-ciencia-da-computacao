// Projeto Atlas — a S13b na tela: a folha estuda aula, e a página das aulas existe.
//
// POR QUE UM ARQUIVO SÓ PARA AS DUAS TELAS: a folha (web/folha.js) e a página
// (web/telas/aulas.js) mostram a MESMA linha de progresso e o MESMO primário,
// montados pelo mesmo web/aulas-pedacos.js. Testá-las em arquivos separados é
// como nasceu a régua da regra 9: duas telas, duas frases para a mesma duração,
// e nenhum teste percebendo. Aqui as duas são conferidas contra a mesma régua de
// texto, e as duas contam as aulas do MESMO arquivo real.
//
// DADOS REAIS, não inventados: as aulas vêm de app/data/aulas/circuitos-digitais
// .json (93 vídeos, 109.956 s — S12, commits 3af0983/59a798e) e a entrada da
// estação vem de app/data/catalog.json. Um catálogo de mentira com playlist de
// mentira deixaria verde um `list=` errado, e a pessoa cairia no YouTube sem a
// fila da estação — o defeito que a prova do `href` existe para pegar.
//
// Mini-DOM: hdom.js, o compartilhado da auditoria (S10a), com storage de
// mentira. Nada aqui abre navegador: é a casa dos testes de tela desde a 2c.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, janelaCom, storageCom, todos, textoDe } from './hdom.js';
import { duracaoLegivel } from '../core/aulas.js';
// `inseparavel`: a regra do separador da duração vem do núcleo (S20b-1a, item 2).
import { aulas as AU, folha as F, inseparavel } from '../core/textos.js';
import { hrefDe } from '../core/rotas.js';
import { ESTUDO_KEY, abrirAula, continuarDe, estadoDaAula, estudarAula, lerEstudo, serializarEstudo } from '../core/estudo.js';
import { desenharFolha } from '../web/folha.js';
import { agoraLocal, hrefVideo, ligarAberturaDeAula, painelDeAulas } from '../web/aulas-pedacos.js';
// A página das aulas (S13b parte B) e a rota que a monta.
import { montar } from '../web/telas/aulas.js';
import { telaDaRota } from '../web/casco.js';
import { lerRota } from '../core/rotas.js';

const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const CATALOGO_BRUTO = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CURSOS = Array.isArray(CATALOGO_BRUTO) ? CATALOGO_BRUTO : (CATALOGO_BRUTO.courses || []);
const CIRCUITOS = CURSOS.find((c) => c.slug === 'circuitos-digitais');

// `total` no arquivo NÃO é um número: é `{ aulas: 93, exercicios: 1, segundos:
// 109956 }` (o que a YouTube Data API respondeu, S12). Uma tela que escrever
// `lista.total` numa frase imprime "[object Object]" para a pessoa — e foi
// exatamente o que este arquivo de teste fez na primeira tentativa. O número que
// a tela usa sai do núcleo (`resumoDaEstacao` conta o array), nunca deste campo.
const TOTAL_AULAS = AULAS.total.aulas;
const SEGUNDOS_TODAS = AULAS.total.segundos;
assert.equal(TOTAL_AULAS, AULAS.aulas.length, 'se o total do arquivo discordar do array, o dado mudou e o teste tem de gritar');
assert.equal(SEGUNDOS_TODAS, AULAS.aulas.reduce((s, a) => s + a.duracaoS, 0));

// ═══════════════════ a folha com as aulas carregadas (parte A) ═══════════════════

/**
 * Desenha a folha da estação com as aulas reais.
 *
 * @param {{estudo?: object|null, aulas?: object}} opts `aulas` por omissão são
 *   as 93 de verdade; passando null, a folha é desenhada sem lista — o caso 6 da
 *   fatia, em que nada muda no desenho de hoje.
 */
function folhaCom({ estudo = null, aulas = AULAS } = {}) {
  const doc = criarDoc();
  const nos = desenharFolha(doc, {
    catalogo: [CIRCUITOS],
    progresso: { completed: [], emCurso: [], conclusoes: {} },
    slug: CIRCUITOS.slug,
    notas: {},
    momento: null,
    aulas,
    estudo: estudo || lerEstudo(null)
  });
  return { doc, ...nos };
}

// S20b-1a (item 2): o colapso era `\s+`, e `\s` come o U+00A0 — o mini-DOM lia a
// frase com o espaço trocado e o teste deixava de ver o byte que a tela põe.
const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/[ \t\r\n]+/g, ' ').trim();
// O `comClasse` do hdom leva REGEX (é assim que os outros testes o usam); aqui a
// pergunta é sempre "tem esta classe exata", e regex de classe é onde moreia o
// falso positivo (procurar 'aulas-barra' achando 'aulas-barra-cheio').
const comClasse = (raiz, classe) => todos(raiz, (n) => n.className.split(/\s+/).includes(classe));
const um = (raiz, classe, onde) => {
  const achei = comClasse(raiz, classe);
  assert.equal(achei.length, 1, `${onde}: esperado exatamente um .${classe}, achei ${achei.length}`);
  return achei[0];
};

test('A1: a linha de progresso diz o que os dados dizem, e a barra diz o mesmo ao leitor de tela', () => {
  const { root } = folhaCom({});
  const linha = um(root, 'aulas-progresso', 'folha com aulas');
  const frase = textoDo(um(linha, 'aulas-progresso-texto', 'linha de progresso'));

  assert.equal(frase, AU.progresso(0, TOTAL_AULAS, duracaoLegivel(SEGUNDOS_TODAS)));
  // MUTOU na S14b2 (04/11/2026), item 8: o verbo da régua é "estudadas". O
  // número do zero é o mesmo nas duas frases, e é por isso que a palavra escrita
  // aqui é a trava — sem ela, a folha voltaria a dar crédito de estudo a quem só
  // clicou num título.
  assert.equal(frase, `0 de 93 aulas estudadas · faltam ~${inseparavel('30 h 33 min')}`,
    `a frase medida nos dados reais saiu diferente: "${frase}"`);

  const barra = um(linha, 'aulas-barra', 'linha de progresso');
  assert.equal(barra.getAttribute('role'), 'progressbar', 'sem role a barra é um div para o leitor de tela');
  assert.equal(barra.getAttribute('aria-valuemin'), '0');
  assert.equal(barra.getAttribute('aria-valuemax'), String(TOTAL_AULAS), 'o máximo é o total da estação, não um número redondo');
  assert.equal(barra.getAttribute('aria-valuenow'), '0');
  assert.equal(barra.getAttribute('aria-label'), frase,
    'a barra anuncia a MESMA frase que a pessoa lê: paráfrase para a máquina é a regra 9 de novo');
});

// MUTOU na S14a (04/11/2026): o teste cobrava que abrir a aula 3 tirasse os 17
// min dela do "faltam ~". resumoDaEstacao passou a somar o restante pelas aulas
// NÃO ESTUDADAS — assistir sem fechar não é memória, e a folha vinha descontando
// tempo que ninguém aprendeu. O número de abertas continua se movendo; o tempo só
// se move com o fecho, que desenha na S14b. Este caso é onde a transição fica
// visível, dos dois lados.
test('A1b: abrir NÃO move a régua nem a barra — o que as move é fechar', () => {
  // MUTOU o TÍTULO na S14b2 (04/11/2026), item 8: até aqui "abrir move o número".
  // A régua passou a contar estudo, e abrir não é estudo: o clique passa a não
  // mover nada. É a mesma mudança vista pelos dois lados — o número fica em zero
  // e o tempo também, e o fecho mexe nos dois de uma vez.
  const estudo = abrirAula(lerEstudo(null), { estacao: CIRCUITOS.id, aula: AULAS.aulas[2].id, n: 3 }, '2026-11-04T09:00');
  const { root } = folhaCom({ estudo });
  const barra = um(root, 'aulas-barra', 'folha com uma aberta');

  assert.equal(barra.getAttribute('aria-valuenow'), '0', 'a barra deu crédito de estudo a um clique');
  assert.equal(textoDo(um(root, 'aulas-progresso-texto', 'folha com uma aberta')),
    AU.progresso(0, TOTAL_AULAS, duracaoLegivel(SEGUNDOS_TODAS)),
    'uma aberta, nenhuma estudada: nem o número nem o tempo se movem');

  // E o fecho, que é o que movimenta o tempo: a MESMA aula 3, agora estudada.
  const { root: fechada } = folhaCom({
    estudo: estudarAula(estudo, { estacao: CIRCUITOS.id, aula: AULAS.aulas[2].id, n: 3 }, '2026-11-04T09:40', { recordacao: 'XOR', conferencia: 'NAND' }),
  });
  assert.equal(textoDo(um(fechada, 'aulas-progresso-texto', 'folha com a 3 estudada')),
    AU.progresso(1, TOTAL_AULAS, duracaoLegivel(SEGUNDOS_TODAS - AULAS.aulas[2].duracaoS)),
    'fechar a 3 tirou os 17 min dela do restante');
});

test('A2: o primário é a aula, com o endereço do vídeo dentro da playlist da estação', () => {
  const { root } = folhaCom({});
  const primario = um(root, 'aulas-primario', 'folha com aulas');

  assert.equal(primario.tag, 'a', 'o primário é um link: o Atlas não é dono da aba do YouTube');
  assert.ok(primario.className.split(/\s+/).includes('botao-primario'), 'e continua sendo o primário da folha');
  // S14b1 (item 5): o destino do toque mudou. A folha não abre o YouTube —
  // abre a PÁGINA da aula, e é de lá que se sai para o vídeo. O `list=` continua
  // existindo, mas no href do Assistir (tests/aula-pagina.test.js); cobrá-lo
  // aqui seria travar o caminho antigo que esta fatia apagou de propósito.
  assert.equal(primario.getAttribute('href'),
    hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug, painel: 'aula', n: 1 }),
    'o primário da folha tem de apontar para a página da aula, no mesmo app');
  assert.equal(primario.getAttribute('href'), '#/estacao/circuitos-digitais/aula/1');
  assert.equal(primario.getAttribute('target'), null, 'link interno não abre aba nova');
  assert.equal(primario.getAttribute('rel'), 'noopener');
  assert.equal(primario.getAttribute('data-aula'), AULAS.aulas[0].id, 'o clique grava pelo id do vídeo');
  assert.equal(primario.getAttribute('data-n'), '1');
  assert.equal(textoDo(primario), AU.comecar(1, AULAS.aulas[0].titulo),
    `com nada aberto o verbo é começar: "${textoDo(primario)}"`);
});

test('A2b: aberta a aula 3, o primário vira o ponto de retorno — Continuar: Aula 3', () => {
  const estudo = abrirAula(lerEstudo(null), { estacao: CIRCUITOS.id, aula: AULAS.aulas[2].id, n: 3 }, '2026-11-04T09:00');
  const { root } = folhaCom({ estudo });
  const primario = um(root, 'aulas-primario', 'folha com a 3 aberta');

  assert.equal(primario.getAttribute('data-aula'), AULAS.aulas[2].id);
  assert.equal(primario.getAttribute('data-n'), '3');
  assert.equal(textoDo(primario), AU.continuar(3, AULAS.aulas[2].titulo));
  assert.ok(textoDo(primario).startsWith('Continuar: Aula 3 — '), `lê-se: "${textoDo(primario)}"`);
});

test('A3: abaixo do primário, a nota diz o que o toque faz — aberta, não estudada', () => {
  const { root } = folhaCom({});
  const nota = um(root, 'aulas-nota', 'folha com aulas');
  // A frase acompanha o destino novo (S14b1). "Marcada como aberta" saiu: o
  // toque interno não marca nada — quem grava a abertura é o Assistir.
  assert.equal(textoDo(nota), 'Abre a aula no Atlas, e de lá o vídeo.');
  assert.equal(nota.tag, 'p', 'é uma nota, não um botão: ninguém toca nela');
});

test('A4: o secundário leva à página das aulas, pelo endereço que a rota produz', () => {
  const { root } = folhaCom({});
  const secundarios = comClasse(root, 'botao-secundario');
  assert.equal(secundarios.length, 1, 'a folha tem UM secundário');
  const ver = secundarios[0];

  assert.equal(ver.getAttribute('href'), hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug, painel: 'aulas' }));
  assert.equal(ver.getAttribute('href'), '#/estacao/circuitos-digitais/aulas');
  assert.equal(textoDo(ver), AU.verTodas(TOTAL_AULAS));
  assert.equal(textoDo(ver), 'Ver as 93 aulas');
});

test('A5: concluir estação saiu dos botões e virou link discreto com o mesmo data-concluir', () => {
  const { root } = folhaCom({});
  const discreto = um(root, 'folha-concluir-discreto', 'folha com aulas');

  assert.equal(discreto.tag, 'a');
  assert.equal(discreto.getAttribute('data-concluir'), CIRCUITOS.id,
    'o handler do metro.js prende pelo atributo: trocar o atributo é desligar o botão sem aviso');
  assert.equal(textoDo(discreto), 'Marcar a estação como concluída');
  assert.ok(discreto.className.split(/\s+/).includes('folha-desfazer'),
    'o mesmo estilo do desfazer — discreto por classe, não por cor nova');

  const acoes = um(root, 'folha-acoes', 'folha com aulas');
  const concluintes = todos(acoes, (n) => n.getAttribute && n.getAttribute('data-concluir') !== null);
  assert.equal(concluintes.length, 1, 'um único gesto de concluir; se sobrou o botão antigo, são dois');
  assert.equal(comClasse(acoes, 'botao-primario').length, 1, 'UM primário por folha, e agora ele é a aula');
});

test('A6: sem as aulas no aparelho, a folha é exatamente a de hoje — sem linha de progresso', () => {
  const { root } = folhaCom({ aulas: null });

  assert.equal(comClasse(root, 'aulas-progresso').length, 0, 'a régua do progresso some junto com os dados');
  assert.equal(comClasse(root, 'aulas-primario').length, 0, 'sem lista não há aula a continuar');
  assert.equal(comClasse(root, 'aulas-nota').length, 0);
  assert.equal(comClasse(root, 'aulas-barra').length, 0);
  assert.equal(comClasse(root, 'folha-concluir-discreto').length, 0, 'o concluir discreto é da folha com aulas');

  const recurso = um(root, 'folha-recurso', 'folha sem aulas');
  assert.equal(recurso.getAttribute('href'), CIRCUITOS.resourceUrl,
    'o "Começar a estudar" de sempre, com o link da playlist da estação');
  assert.ok(textoDo(root).includes(F.notaAbrir), 'a nota de sempre, a do curso, não a da aula');
  assert.equal(comClasse(root, 'botao-primario').length, 1);
});

test('A6b: estação concluída não ganha a linha de progresso (a régua a 100% sem gesto possível)', () => {
  const doc = criarDoc();
  const { root } = desenharFolha(doc, {
    catalogo: [CIRCUITOS],
    progresso: { completed: [CIRCUITOS.id], emCurso: [], conclusoes: { [CIRCUITOS.id]: '2026-11-01' } },
    slug: CIRCUITOS.slug,
    notas: {},
    momento: null,
    aulas: AULAS,
    estudo: lerEstudo(null)
  });
  assert.equal(comClasse(root, 'aulas-progresso').length, 0);
  assert.equal(comClasse(root, 'aulas-primario').length, 0);
});

// ═══════════════════ os textos da seção aulas (parte 4 da S13a, cobrando aqui) ═══════════════════

test('os textos que a S13b lê existem e saem de core/textos.js, não das telas', () => {
  assert.equal(AU.comecar(1, 'X'), 'Começar: Aula 1 — X');
  assert.equal(AU.continuar(3, 'X'), 'Continuar: Aula 3 — X');
  assert.equal(AU.verTodas(93), 'Ver as 93 aulas');
  assert.equal(AU.notaAbrir, 'Abre a aula no Atlas, e de lá o vídeo.');
  // S14a: 'estudada' entrou na escada do núcleo, e o nome tinha de entrar junto —
  // a lista de aulas lê o nome do estado daqui, e um estado sem nome é o leitor de
  // tela dizendo "aberta" sobre uma aula que a pessoa já fechou.
  // S18a: a quarta palavra do estado, pela mesma razão da terceira (linha lê daqui).
  assert.deepEqual(AU.estados, { 'nao-iniciada': 'Não iniciada', aberta: 'Aberta', estudada: 'Estudada', pulada: 'Pulada' });
  assert.equal(AU.assistir, 'Assistir no YouTube');
  assert.equal(AU.abrirPlaylist, 'Abrir a playlist no YouTube');
  assert.equal(AU.tituloPagina('Circuitos Digitais'), 'Aulas de Circuitos Digitais');
  assert.equal(AU.voltarPara('Circuitos Digitais'), '← Circuitos Digitais');
  assert.equal(Object.values(AU.semAulas).length, 3, 'as três partes da casa: o que falhou, por quê, o que fazer');
});

// ═══════════════════ o compartilhado: href e o que grava no clique ═══════════════════

test('hrefVideo: o list= vem da playlist da estação; sem playlist, só o vídeo', () => {
  const aula = { id: 'abc123', n: 1, titulo: 'X' };
  assert.equal(hrefVideo(aula, 'PL1'), 'https://www.youtube.com/watch?v=abc123&list=PL1');
  assert.equal(hrefVideo(aula, null), 'https://www.youtube.com/watch?v=abc123');
  assert.equal(hrefVideo(null, 'PL1'), '#/', 'sem aula não há para onde ir, e o href não pode virar "undefined"');
});

test('painelDeAulas: sem lista a folha é a de hoje; com lista, resumo e continuar saem do núcleo', () => {
  assert.equal(painelDeAulas(lerEstudo(null), CIRCUITOS.id, null), null, 'aulas não carregaram: quem chama desenha a folha antiga');
  assert.equal(painelDeAulas(lerEstudo(null), CIRCUITOS.id, { aulas: [] }), null, 'estação sem vídeo nenhum também não tem painel');

  const painel = painelDeAulas(lerEstudo(null), CIRCUITOS.id, { aulas: AULAS.aulas, resourceUrl: CIRCUITOS.resourceUrl });
  assert.equal(painel.playlist, 'PLXyWBo_coJnMYO9Na3t-oYsc2X4kPJBWf',
    'a playlist é a do resourceUrl do catálogo, derivada por core/aulas.js — não um número chutado no link');
  assert.equal(painel.resumo.total, 93);
  assert.equal(painel.resumo.abertas, 0);
  assert.equal(painel.continuar.motivo, 'comecar');
});

// ─────────── a parte C: o clique que grava, a volta que repinta ───────────
// O hdom não faz bolha de evento, então o clique é disparado no PAINEL com o
// link como `target` — que é o que o navegador entrega ao ouvinte delegado.
// Disparar no link seria testar o dublê, não a tela.
function cenaDeAbertura() {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  raiz.setAttribute('data-estacao', CIRCUITOS.id);
  const painel = doc.createElement('div');
  const link = doc.createElement('a');
  link.setAttribute('data-aula', AULAS.aulas[2].id);
  link.setAttribute('data-n', '3');
  painel.append(link);
  raiz.append(painel);
  doc.visibilityState = 'visible';
  return { doc, painel, link, win: janelaCom(), storage: storageCom() };
}

test('C: o clique grava a abertura no storage antes de a aba nova abrir, e repinta', () => {
  const { painel, link, win, storage } = cenaDeAbertura();
  let repintes = 0;
  ligarAberturaDeAula({ win, storage, painel, aoMudar: () => { repintes += 1; } });

  painel.dispatch('click', { target: link });

  const bruto = storage.getItem(ESTUDO_KEY);
  assert.ok(bruto, 'o clique tinha de escrever ESTUDO_KEY: gravar só ao voltar perde quem fecha o YouTube antes');
  const estudo = lerEstudo(bruto);
  assert.equal(estudo.aulas[AULAS.aulas[2].id].n, 3);
  assert.equal(estudo.aulas[AULAS.aulas[2].id].estacao, CIRCUITOS.id);
  assert.match(estudo.aulas[AULAS.aulas[2].id].abertaEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'o abertaEm está no formato local combinado');
  assert.equal(estudo.ultima.aula, AULAS.aulas[2].id);
  assert.equal(serializarEstudo(lerEstudo(bruto)), bruto, 'o que foi escrito é o que o núcleo lê, sem deriva');
  assert.equal(repintes, 1);
});

test('C: voltar da aba do YouTube repinta e não grava abertura nova', () => {
  const { doc, painel, link, win, storage } = cenaDeAbertura();
  let repintes = 0;
  ligarAberturaDeAula({ win, storage, painel, aoMudar: () => { repintes += 1; } });

  painel.dispatch('click', { target: link });
  const depoisDoClique = storage.getItem(ESTUDO_KEY);
  assert.equal(repintes, 1);

  win.dispatch('visibilitychange');
  assert.equal(repintes, 2, 'a volta tem de repintar: sem isso a marca fica "Não iniciada" até recarregar a página');
  assert.equal(storage.getItem(ESTUDO_KEY), depoisDoClique, 'repintar não inventa uma segunda abertura');

  doc.visibilityState = 'hidden';
  win.dispatch('visibilitychange');
  assert.equal(repintes, 2, 'escondida não repinta: nada novo para quem não está olhando');
});

test('C: o desligar solta os ouvintes — a tela desmontada não grava mais', () => {
  const { painel, link, win, storage } = cenaDeAbertura();
  let repintes = 0;
  const desligar = ligarAberturaDeAula({ win, storage, painel, aoMudar: () => { repintes += 1; } });
  desligar();

  painel.dispatch('click', { target: link });
  win.dispatch('visibilitychange');
  assert.equal(storage.getItem(ESTUDO_KEY), null, 'o casco trocou de tela e a tela antiga continuou escrevendo no estudo');
  assert.equal(repintes, 0);
});

test('C: um clique fora de aula não escreve nada', () => {
  const { painel, win, storage } = cenaDeAbertura();
  const outro = painel.ownerDocument.createElement('button');
  painel.append(outro);
  ligarAberturaDeAula({ win, storage, painel, aoMudar: () => {} });

  painel.dispatch('click', { target: outro });
  assert.equal(storage.getItem(ESTUDO_KEY), null, 'tocar em qualquer lugar da folha não marca aula aberta');
});

test('agoraLocal: aaaa-mm-ddThh:mm no fuso do aparelho (regra 13 — UTC adiantaria a hora)', () => {
  const D = class {
    getFullYear() { return 2026; }
    getMonth() { return 10; }
    getDate() { return 6; }
    getHours() { return 9; }
    getMinutes() { return 5; }
  };
  assert.equal(agoraLocal({ Date: D }), '2026-11-06T09:05');
});

// ═══════════════════ a PÁGINA das aulas (S13b parte B) ═══════════════════
//
// Os mesmos dados reais, a outra tela: é assim que a régua da regra 9 fecha — a
// folha (parte A, acima) e a página leem a MESMA linha de progresso do MESMO
// web/aulas-pedacos.js, e o teste compara as duas frases byte a byte. Duas telas
// que se escrevem sozinhas é como a v2 chegou a "faltam ~30 h" numa e "30h33" na
// outra.
//
// O `buscarAulas` é o do `web/aulas-dados.js` injetado: o node não tem o cache do
// service worker, e um teste que dependesse da rede seria um teste que ninguém roda.

const respostaDe = (dados, { ok = true, status = 200 } = {}) =>
  async () => ({ ok, status, json: async () => dados });

/** O estudo com as aulas `ns` abertas, na ordem dada (uma por minuto). */
function estudoCom(...ns) {
  let e = lerEstudo(null);
  ns.forEach((n, i) => {
    e = abrirAula(e, { estacao: CIRCUITOS.id, aula: AULAS.aulas[n - 1].id, n }, `2026-11-04T09:${String(i).padStart(2, '0')}`);
  });
  return serializarEstudo(e);
}

/** Monta a página de aulas com o catálogo e o storage que o teste escolher. */
// O CATÁLOGO NA FORMA DO APP (defeito 1, Chrome real 04/11/2026): antes esta
// função entregava `[CIRCUITOS]`, uma lista que o app NUNCA tem — `ctx.catalogo`
// é a promessa do `loadCatalog()` (web/main.js:60), que resolve num objeto
// `{ courses, origem, electives, ... }`. A tela chamava `catalogo.find`, estourava
// TypeError, e a página abria em branco com 584 testes verdes. A fixture agora é
// o `data/catalog.json` lido do disco, cru: a página recebe byte a byte o que o
// navegador entrega, e reverter a correção quebra este arquivo sozinho.
async function pagina({ folha = CIRCUITOS.slug, catalogo = CATALOGO_BRUTO, bruto = null, buscar = respostaDe(AULAS) } = {}) {
  const doc = criarDoc();
  const win = janelaCom();
  win.localStorage = storageCom(bruto ? { [ESTUDO_KEY]: bruto } : {});
  const raiz = doc.createElement('div');
  const instancia = await montar(raiz, {
    document: doc, window: win, catalogo: Promise.resolve(catalogo), folha, buscarAulas: buscar
  });
  return { doc, win, raiz, instancia };
}

/** As linhas da LISTA, uma por aula. Não uma varredura por `data-aula`: o
 *  primário também o leva (é a mesma aula, no mesmo painel), e contá-lo como
 *  linha daria 94 numa estação de 93 — o número do teste tem de dizer o que a
 *  tela mostra, não o que o atributo permite. */
const linhasDa = (raiz) => todos(raiz, (n) => n.tag === 'a' && n.getAttribute('data-aula') !== null && n.parent?.tag === 'li');
/** Todo link de aula da tela: o da linha e o do primário. */
const linksDeAula = (raiz) => todos(raiz, (n) => n.tag === 'a' && n.getAttribute('data-aula') !== null);

test('B1: o endereço da estação com /aulas é uma TELA, e a estação sem sufixo continua a folha', () => {
  const aulas = telaDaRota(lerRota('#/estacao/circuitos-digitais/aulas'));
  assert.equal(aulas.tela, 'aulas', 'o casco tem de importar web/telas/aulas.js, não a folha');
  assert.equal(aulas.folha, 'circuitos-digitais', 'o slug vem no mesmo campo, é ele que diz QUAL estação');

  const folha = telaDaRota(lerRota('#/estacao/circuitos-digitais'));
  assert.equal(folha.tela, 'jornada', 'o ramo novo não pode ter comido a folha de sempre');
  assert.equal(folha.folha, 'circuitos-digitais');
});

test('B2: a página nomeia a estação lida do catálogo e devolve ao casco o rótulo dela', async () => {
  const { raiz, instancia } = await pagina();
  const h1 = todos(raiz, (n) => n.tag === 'h1')[0];
  assert.ok(h1, 'a página de aulas tem de ter UM h1 — é nele que o casco põe o foco');
  assert.equal(h1.textContent, AU.tituloPagina(CIRCUITOS.title));
  assert.equal(h1.textContent, 'Aulas de Circuitos Digitais');
  // Uma tela que não é aba da barra se nomeia sozinha: sem isto o casco a
  // anunciaria como "Jornada" para quem navega com leitor de tela.
  assert.equal(instancia.rotulo, h1.textContent);

  const voltar = um(raiz, 'aulas-voltar', 'página de aulas');
  assert.equal(voltar.tag, 'a', 'voltar é link, não botão: desfazer um passo é correção');
  assert.equal(voltar.getAttribute('href'), hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug }));
  assert.equal(voltar.getAttribute('href'), '#/estacao/circuitos-digitais');
  assert.equal(textoDo(voltar), AU.voltarPara(CIRCUITOS.title));
});

test('B3: um item por aula real, com número, título, estado e duração', async () => {
  const { raiz } = await pagina();
  const lista = um(raiz, 'aulas-lista', 'página de aulas');
  assert.equal(lista.tag, 'ol', 'a ordem é a informação: a playlist é uma lista ordenada');
  assert.equal(todos(lista, (n) => n.tag === 'li').length, TOTAL_AULAS);

  const primeira = textoDo(lista.children[0]);
  const aula1 = AULAS.aulas[0];
  assert.match(primeira, /(^|\s)1(\s|$)/, 'o número da aula aparece');
  assert.ok(primeira.includes(aula1.titulo), `o título da fonte aparece: "${primeira}"`);
  assert.ok(primeira.includes(AU.estados['nao-iniciada']), 'sem registro, o estado é não iniciada');
  assert.ok(primeira.includes(duracaoLegivel(aula1.duracaoS)), `a duração aparece: "${primeira}"`);
});

test('B4: o estado de cada linha é o do registro — aberta só onde a pessoa abriu', async () => {
  const { raiz } = await pagina({ bruto: estudoCom(3, 7) });
  const estados = todos(raiz, (n) => n.className.split(/\s+/).includes('aula-estado')).map((n) => n.textContent);
  assert.equal(estados.length, TOTAL_AULAS);
  assert.equal(estados.filter((e) => e === AU.estados.aberta).length, 2, 'duas abertas no storage, duas linhas "Aberta"');
  assert.equal(estados.filter((e) => e === AU.estados['nao-iniciada']).length, TOTAL_AULAS - 2);
});

test('B5: cada linha aponta para o vídeo DAQUELA aula, dentro da playlist da estação', async () => {
  const { raiz } = await pagina();
  const linhas = linhasDa(raiz);
  assert.equal(linhas.length, TOTAL_AULAS);
  assert.equal(linksDeAula(raiz).length, TOTAL_AULAS + 1, 'um link por linha mais o primário, e nada de duplicata');
  for (const [i, link] of linhas.entries()) {
    // S14b1 (item 5): cada linha aponta para a PÁGINA daquela aula. O `n` do
    // endereço é o da linha — linha 5 é /aula/5, e um off-by-one aqui levaria a
    // pessoa à aula errada sem que nada na tela parecesse errado.
    assert.equal(link.getAttribute('href'),
      hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug, painel: 'aula', n: i + 1 }),
      `linha ${i + 1}: o link tem de apontar para a página DAQUELA aula`);
    assert.equal(link.getAttribute('target'), null, 'link interno não abre aba nova');
    assert.equal(link.getAttribute('rel'), 'noopener');
    assert.equal(link.getAttribute('data-aula'), AULAS.aulas[i].id);
    assert.equal(link.getAttribute('data-n'), String(i + 1));
  }
});

test('B6: a aula por onde continuar é a única marcada com aria-current na lista', async () => {
  const { raiz } = await pagina({ bruto: estudoCom(2, 9) });
  // `step`, não `true`: a aula é um passo de uma sequência (Aula 9 de 93). O
  // pedido do acabamento escreveu step; a tela e esta trava estavam em true, e
  // era isso que as duas liam uma da outra sem nunca confrontar o pedido.
  const marcadas = linksDeAula(raiz).filter((n) => n.getAttribute('aria-current') === 'step');
  assert.equal(marcadas.length, 1, 'a marca de "por onde continuar" é um ponto, não a lista toda');
  assert.equal(marcadas[0].getAttribute('data-aula'), AULAS.aulas[8].id, 'regra 2: a aberta mais recente');
});

test('B6b: a linha carrega a marca do estado, e o nome do estado é texto escondido, não coluna', async () => {
  // ACABAMENTO, item 4 (04/11/2026). No Chrome de 1280 px "Não iniciada" era
  // desenhado por cima do título: as duas colunas deixavam a do título com zero.
  // A trava é dupla — a marca existe com a classe do estado, e o nome do estado
  // mora num nó com .so-leitor (escondido visualmente, dito ao leitor de tela).
  const { raiz } = await pagina({ bruto: estudoCom(3) });
  const linhas = linhasDa(raiz);
  assert.equal(linhas.length, TOTAL_AULAS);

  for (const [i, link] of linhas.entries()) {
    const esperada = estadoDaAula(lerEstudo(estudoCom(3)), AULAS.aulas[i].id);
    const marca = todos(link, (n) => n.className.split(/\s+/).includes('aula-marca'))[0];
    assert.ok(marca, `linha ${i + 1}: sem a marca, o estado só existe como texto e a linha vira coluna disputada`);
    assert.ok(marca.className.split(/\s+/).includes(`aula-marca-${esperada}`),
      `linha ${i + 1}: a marca diz "${marca.className}", o registro diz "${esperada}"`);

    const soLeitor = todos(link, (n) => n.className.split(/\s+/).includes('so-leitor'));
    assert.equal(soLeitor.length, 1, `linha ${i + 1}: o nome do estado é um nó .so-leitor, nem zero nem dois`);
    assert.ok(soLeitor[0].className.split(/\s+/).includes('aula-estado'),
      `linha ${i + 1}: é o estado que se esconde, não outro texto: "${soLeitor[0].className}"`);
    assert.ok(AU.estados[esperada] && soLeitor[0].textContent === AU.estados[esperada],
      `linha ${i + 1}: o nome escondido é o do registro: "${soLeitor[0].textContent}"`);
    // A marca é desenho; quem fala é o .so-leitor. As duas juntas dariam ao
    // leitor de tela "Non iniciada Não iniciada" em cada uma das 93 linhas.
    assert.equal(marca.getAttribute('aria-hidden'), 'true', `linha ${i + 1}`);
  }

  // A aula de continuar traz o anel, e o anel é da MARCA — não a barra de 6 px
  // que empurrava o título para debaixo do estado.
  const continuar = linksDeAula(raiz).find((n) => n.getAttribute('aria-current') === 'step');
  assert.ok(continuar, 'alguma linha tem de ser o passo por onde continuar');
  assert.ok(todos(continuar, (n) => n.className.split(/\s+/).includes('aula-marca')).length === 1,
    'a linha de continuar tem a marca que recebe o anel');
});

test('B6c: só a aula de exercício leva a etiqueta, e ela é filha da célula do título', async () => {
  const { raiz } = await pagina();
  const etiquetas = todos(raiz, (n) => n.className.split(/\s+/).includes('aula-etiqueta'));
  const exercicios = AULAS.aulas.filter((a) => a.exercicio);
  assert.equal(etiquetas.length, exercicios.length,
    `a etiqueta é do que a fonte marca: ${exercicios.length} exercícios, ${etiquetas.length} etiquetas`);
  for (const e of etiquetas) assert.equal(e.textContent, AU.etiquetaExercicio);

  // Quinto nó solto na linha cairia numa quinta coluna, que é como a segunda
  // coluna nasceu. Dentro do título, a etiqueta quebra junto com ele.
  const dentro = todos(raiz, (n) => n.className.split(/\s+/).includes('aula-titulo'))
    .flatMap((c) => todos(c, (n) => n.className.split(/\s+/).includes('aula-etiqueta')));
  assert.equal(dentro.length, etiquetas.length, 'toda etiqueta mora na célula do título');
  assert.ok(exercicios.length > 0, 'a fonte de Circuitos Digitais tem aulas de exercício; sem elas esta trava não prova nada');
});

test('B7: a frase do progresso é BYTE A BYTE a mesma da folha com o mesmo estudo (regra 9)', async () => {
  const bruto = estudoCom(4, 5, 6);
  const { raiz } = await pagina({ bruto });
  const linha = um(raiz, 'aulas-progresso', 'página de aulas');
  const frase = textoDo(um(linha, 'aulas-progresso-texto', 'página de aulas'));
  // O número foi MEDIDO nos dados (abrir as aulas 4, 5 e 6 deixa 106.556 s e,
  // com a regra de arredondamento de `duracaoLegivel`, 29 h 33 min). Chutado,
  // este assert seria a régua escrita contra a minha conta de cabeça — e a
  // primeira versão dele esteve errada aqui.
  // MUTOU na S14a (04/11/2026): eram ~29 h 33 min, porque abrir as aulas 4, 5 e 6
  // tirava 1 h do "faltam". O restante agora soma as aulas NÃO ESTUDADAS, e três
  // abertas sem fecho são 93 aulas por aprender: ~30 h 33 min, MEDIDO nos dados e
  // não arredondado de cabeça — a primeira versão deste número já esteve errada
  // aqui, e é por isso que ele fica escrito em letra, não calculado no teste.
  // MUTOU de novo na S14b2 (04/11/2026), item 8: o NÚMERO também parou de andar,
  // porque a régua passou a contar estudo. "3 de 93" dava crédito por três
  // cliques; o honesto, com três abertas e zero fechadas, é "0 de 93".
  assert.equal(frase, `0 de 93 aulas estudadas · faltam ~${inseparavel('30 h 33 min')}`, `a frase medida saiu: "${frase}"`);

  const { root: folha } = folhaCom({ estudo: lerEstudo(bruto) });
  const fraseDaFolha = textoDo(um(folha, 'aulas-progresso-texto', 'folha'));
  assert.equal(frase, fraseDaFolha, 'as duas telas montam a linha com o mesmo pedaço de código');

  const barra = um(linha, 'aulas-barra', 'página de aulas');
  assert.equal(barra.getAttribute('role'), 'progressbar');
  assert.equal(barra.getAttribute('aria-valuenow'), '0', 'a barra deu crédito de estudo a três cliques');
  assert.equal(barra.getAttribute('aria-valuemax'), String(TOTAL_AULAS));
  assert.equal(barra.getAttribute('aria-label'), frase, 'a barra anuncia a frase que a pessoa lê');

  const primario = um(raiz, 'aulas-primario', 'página de aulas');
  assert.equal(textoDo(primario), AU.continuar(6, AULAS.aulas[5].titulo));
  assert.equal(textoDo(um(raiz, 'aulas-nota', 'página de aulas')), AU.notaAbrir);
  // MUTOU na S14b2 (04/11/2026): cobrava a ABSENCIA da palavra "estudada" ("a S14
  // ainda não existe"). A S14 existe, a régua conta estudo, e a palavra agora tem
  // de estar — invertida, esta linha é o dente da mudança de verbo nesta tela.
  assert.match(textoDo(raiz), /aulas estudadas/, 'a régua desta página não conta estudo');

  const playlist = um(raiz, 'aulas-playlist', 'página de aulas');
  assert.equal(playlist.getAttribute('href'), CIRCUITOS.resourceUrl, 'a playlist é a que o catálogo publica');
  assert.equal(textoDo(playlist), AU.abrirPlaylist);
});

test('B7b: S14b1 — nenhum link desta página sai do Atlas; o `list=` passou a ser do Assistir', async () => {
  // A trava da playlist NÃO morreu, mudou de casa. Até a S13b esta página era o
  // último clique antes do vídeo, e o `list=` tinha de estar em cada href; desde
  // a S14b1 ela é uma página de LINKS INTERNOS e o vídeo só se abre na página da
  // aula, onde a costura catálogo→playlist é travada em tests/aula-pagina.test.js.
  // Cobrar `list=` aqui seria travar o caminho que esta fatia apagou de propósito.
  // O que se trava neste lugar é a OUTRA metade do defeito antigo: um link que
  // vazasse para o YouTube sem playlist. Se qualquer href desta página apontar
  // para fora, o teste novo deixa de ser a única guarda do `list=` e isto cai.
  const { raiz } = await pagina();
  for (const link of linksDeAula(raiz)) {
    const href = link.getAttribute('href');
    assert.ok(href.startsWith('#/estacao/circuitos-digitais'),
      `link desta página não é interno: ${href}`);
    assert.equal(link.getAttribute('target'), null, 'link interno com target _blank sai do app');
  }
});

// MUTOU na S14b1 (04/11/2026), item 5 do pedido: esta página virou uma tela de
// LINKS INTERNOS. Tocar numa linha vai para a página da aula; quem grava a
// abertura é o botão Assistir, que é o único clique daqui que sai do app. Se a
// lista continuasse gravando no toque, passear pelas 93 aulas e ler títulos
// encheria o estudo de "aberta" sem ninguém ter assistido nada — e o "0 de 93"
// da folha e da estação subiria sozinho. A segunda metade do caso (a repintura
// ao redor da aula aberta) fica intacta: ela só muda de gatilho, do clique para
// a volta da aba, que é o que acontece na cena real.
test('B8: S14b1 — tocar numa linha NÃO grava; a volta da aba repinta ao redor da aberta', async () => {
  const { raiz, win } = await pagina();
  assert.equal(win.localStorage.getItem(ESTUDO_KEY), null);

  const raizComEstacao = raiz.getAttribute('data-estacao');
  assert.equal(raizComEstacao, CIRCUITOS.id, 'sem o data-estacao a gravação não sabe em qual estação está');

  const link = linhasDa(raiz)[4]; // a Aula 5
  const painel = um(raiz, 'aulas-painel', 'página de aulas');
  // O hdom não faz bolha: o ouvinte está no painel, com o link como target — é o
  // que o navegador entrega à escuta delegada.
  painel.dispatch('click', { target: link });

  assert.equal(win.localStorage.getItem(ESTUDO_KEY), null,
    'o toque num link interno marcou a aula como aberta sem sair do Atlas');

  // A cena real de hoje: a pessoa toca na linha, cai na página da aula, aperta
  // Assistir (que grava — travado em tests/aula-pagina.test.js), e VOLTA. A
  // gravação entra aqui pelo storage, como o Assistir a deixaria, e o que se
  // mede é a repintura.
  const painelDaLista = um(raiz, 'aulas-painel', 'página de aulas');
  assert.equal(painelDaLista.getAttribute('data-estacao') || raiz.getAttribute('data-estacao'), CIRCUITOS.id);
  win.localStorage.setItem(ESTUDO_KEY, estudoCom(5));
  win.dispatch('visibilitychange');

  const gravado = lerEstudo(win.localStorage.getItem(ESTUDO_KEY));
  assert.equal(gravado.aulas[AULAS.aulas[4].id].n, 5);
  assert.equal(gravado.aulas[AULAS.aulas[4].id].estacao, CIRCUITOS.id);
  assert.match(gravado.aulas[AULAS.aulas[4].id].abertaEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'regra 13: hora local, sem Z');

  // A repintura é o que fecha o ciclo: sem ela a pessoa veria a lista nova por
  // baixo de um primário velho e de uma barra que não se moveu.
  assert.equal(textoDo(um(raiz, 'aulas-primario', 'após a volta')), AU.continuar(5, AULAS.aulas[4].titulo));
  // S14a: o toque ABRE, e abrir não desconta tempo. S14b2, item 8: nem o número
  // anda — a régua conta ESTUDO, e a volta da aba trouxe uma aula aberta, não
  // fechada. Se a régua contar abertas de novo, isto vira "1 de 93" e cai.
  assert.equal(textoDo(um(raiz, 'aulas-progresso-texto', 'após o toque')), AU.progresso(0, TOTAL_AULAS, duracaoLegivel(SEGUNDOS_TODAS)),
    'abrir a 5 moveu a régua de estudo, que é só de quem fechou');
  const marcadas = linhasDa(raiz).filter((n) => n.getAttribute('aria-current') === 'step');
  assert.equal(marcadas.length, 1);
  assert.equal(marcadas[0].getAttribute('data-aula'), AULAS.aulas[4].id);
  assert.equal(todos(raiz, (n) => n.tag === 'li').length, TOTAL_AULAS, 'a repintura não duplicou a lista');
});

test('B9: desmontar solta os ouvintes — a página velha não grava nem repinta', async () => {
  const { raiz, win, instancia } = await pagina();
  const painel = um(raiz, 'aulas-painel', 'página de aulas');
  const link = linhasDa(raiz)[0];
  instancia.desmontar();

  painel.dispatch('click', { target: link });
  win.dispatch('visibilitychange');
  assert.equal(win.localStorage.getItem(ESTUDO_KEY), null, 'o casco trocou de tela e a tela antiga continuou escrevendo no estudo');
  assert.equal(textoDo(um(raiz, 'aulas-primario', 'após desmontar')), AU.comecar(1, AULAS.aulas[0].titulo));
});

test('B10: o arquivo das aulas fora do aparelho — as três partes, e nada de lista vazia', async () => {
  const { raiz } = await pagina({ buscar: respostaDe(null, { ok: false, status: 404 }) });
  const texto = textoDo(raiz);
  for (const parte of Object.values(AU.semAulas)) {
    assert.ok(texto.includes(parte), `faltou a parte "${parte}": ${texto}`);
  }
  assert.equal(todos(raiz, (n) => n.tag === 'li').length, 0);
  assert.equal(comClasse(raiz, 'aulas-primario').length, 0, 'sem lista não há aula a continuar');
  assert.equal(comClasse(raiz, 'aulas-progresso').length, 0, 'sem dados não há progresso a anunciar');
  assert.equal(comClasse(raiz, 'aulas-voltar').length, 1, 'o voltar funciona mesmo sem as aulas');
});

test('B10b: sem rede não estoura, e um 200 sem a lista de aulas não é estação vazia', async () => {
  const estourada = await pagina({ buscar: async () => { throw new Error('sem-rede'); } });
  assert.ok(textoDo(estourada.raiz).includes(AU.semAulas.parteUm));
  const formatoRuim = await pagina({ buscar: respostaDe({ slug: CIRCUITOS.slug }) });
  assert.ok(textoDo(formatoRuim.raiz).includes(AU.semAulas.parteUm), 'um 200 que não é lista de aulas cai no mesmo aviso honesto');
});

// ═══════════ S13e: a cor da linha chega por HERANÇA, e a página precisa dela ═══════════
//
// O defeito, achado no Chrome em 04/11/2026: o `.botao.botao-primario` recebe
// `background: var(--cor)` (folha.css:262) e `--cor` é declarada por linha em
// `.l1 … .l7` (metro.css:17), chegando por herança. A folha mora dentro do metrô
// e herda; a página de aulas não está dentro de linha nenhuma — o botão saía com
// o fundo vazio, texto `--superficie` sobre a página, 1,1:1 nos dois temas. A
// barra enchia de preto e as marcas de estado ficavam na cor do texto.
//
// Por que esta trava é no DOM montado e não no CSS: a régua da S10 (folha.css,
// "S10 régua 5") mede par por regra e passou por cima disto duas vezes, porque o
// CSS está certo — o que falta é o escopo onde `--cor` existe. Um teste que lê
// `aulas.css` nunca veria um `var()` que resolve em vazio. O que prova é a classe
// que o JS pôs na raiz, porque é ela que faz o `var()` ter valor.

const GRAFOS = CURSOS.find((c) => c.slug === 'algoritmos-em-grafos');

test('B11a: a raiz da página leva a CLASSE DA LINHA da estação (Circuitos, Linha 1)', async () => {
  assert.equal(CIRCUITOS.stage, 1, 'o catálogo mudou de linha e a trava abaixo precisa ser relida, não reescrita');
  const { raiz } = await pagina();
  const classes = raiz.className.split(/\s+/);
  assert.ok(classes.includes('l1'), `a raiz tem [${classes}] — sem a classe da linha, --cor é vazio: botão 1,1:1, barra preta, marca na cor do texto`);
});

test('B11b: e a classe é a da LINHA DAQUELA estação, não sempre a mesma (Grafos, Linha 3)', async () => {
  assert.equal(GRAFOS.stage, 3, 'idem: a estação de outro número saiu da Linha 3 no catálogo');
  const { raiz } = await pagina({ folha: GRAFOS.slug });
  const classes = raiz.className.split(/\s+/);
  assert.ok(classes.includes('l3'), `esperava l3 em [${classes}]: uma classe fixa pintaria toda a casa de vermelho e o teste de cima continuaria verde`);
  assert.ok(!classes.includes('l1'), 'a página da Linha 3 não pode carregar a cor da Linha 1');
});

test('B11c: o topo tem o SELO DA LINHA, com o MESMO texto da folha (regra 9)', async () => {
  const { raiz } = await pagina();
  const selo = um(raiz, 'selo', 'página de aulas');
  assert.equal(selo.textContent, '1', 'o número dentro do círculo é o da linha, lido do catálogo');

  const rotulo = um(raiz, 'aulas-posicao', 'página de aulas');
  // A folha comparada com o CATÁLOGO INTEIRO, não com `[CIRCUITOS]` do `folhaCom`:
  // o "de 5" do rótulo é a contagem das estações DA LINHA, e uma folha desenhada
  // com uma estação só diria "de 1" — a régua acusaria a página de mentir quando
  // quem mentia era o meu catálogo de teste.
  const docFolha = criarDoc();
  const { root: folha } = desenharFolha(docFolha, {
    catalogo: CURSOS,
    progresso: { completed: [], emCurso: [], conclusoes: {} },
    slug: CIRCUITOS.slug,
    notas: {},
    momento: null,
    aulas: AULAS,
    estudo: lerEstudo(null)
  });
  const rotuloDaFolha = um(folha, 'folha-rotulo', 'folha');
  assert.equal(rotulo.textContent, rotuloDaFolha.textContent,
    `"${rotulo.textContent}" vs "${rotuloDaFolha.textContent}": duas palavras para a mesma posição é a regra 9`);
  assert.match(rotulo.textContent, /^Linha 1 · estação 1 de 5$/, `lê-se: "${rotulo.textContent}"`);

  // A ordem do desenho (S13b B.1): volta, selo, nome. O h1 continua um só, e é
  // nele que o casco põe o foco.
  const ordem = raiz.children[0].children.map((n) => n.className.split(/\s+/)[0]);
  assert.deepEqual(ordem, ['aulas-voltar', 'aulas-selo', 'aulas-titulo'],
    `o topo saiu em outra ordem: [${ordem}]`);
  assert.equal(todos(raiz, (n) => n.tag === 'h1').length, 1);
});

test('B11d: o selo é o MESMO nó da folha, e não um círculo parecido (folha.js:seloLinha)', async () => {
  const { raiz } = await pagina({ folha: GRAFOS.slug });
  const selo = um(raiz, 'selo', 'página de aulas (Linha 3)');
  // A folha monta `selo l3`; se a página reimplementasse o selo, a classe de cor
  // desapareceria primeiro — e é ela que dá o fundo.
  assert.deepEqual(selo.className.split(/\s+/), ['selo', 'l3'], `o selo saiu com [${selo.className}]`);
  assert.equal(selo.getAttribute('aria-hidden'), 'true', 'o número é desenho; quem fala é o rótulo ao lado');
});

test('B11e: sem estação no catálogo, nenhuma classe de linha (a página cai no cinza da base)', async () => {
  const { raiz } = await pagina({ folha: 'nao-existe', catalogo: { courses: [] } });
  assert.ok(!/\bl\d/.test(raiz.className), `raiz com classe de linha para uma estação que não existe: [${raiz.className}]`);
  assert.equal(comClasse(raiz, 'selo').length, 0, 'sem linha conhecida não há número a pôr no círculo');
});

test('B11: estação que não está no catálogo não pede arquivo nenhum', async () => {
  let chamou = 0;
  const { raiz } = await pagina({
    folha: 'nao-existe',
    catalogo: { courses: [] },
    buscar: async () => { chamou += 1; return respostaDe(AULAS)(); }
  });
  assert.equal(chamou, 0, 'um endereço que não nomeia estação conhecida não tem arquivo a buscar');
  assert.ok(textoDo(raiz).includes('nao-existe'), 'o que a pessoa pediu por endereço é ecoado, não inventado');
  assert.equal(todos(raiz, (n) => n.tag === 'li').length, 0);
});
