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
import { aulas as AU, folha as F } from '../core/textos.js';
import { hrefDe } from '../core/rotas.js';
import { ESTUDO_KEY, abrirAula, continuarDe, lerEstudo, serializarEstudo } from '../core/estudo.js';
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

const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/\s+/g, ' ').trim();
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
  assert.equal(frase, '0 de 93 aulas abertas · faltam ~30 h 33 min',
    `a frase medida nos dados reais saiu diferente: "${frase}"`);

  const barra = um(linha, 'aulas-barra', 'linha de progresso');
  assert.equal(barra.getAttribute('role'), 'progressbar', 'sem role a barra é um div para o leitor de tela');
  assert.equal(barra.getAttribute('aria-valuemin'), '0');
  assert.equal(barra.getAttribute('aria-valuemax'), String(TOTAL_AULAS), 'o máximo é o total da estação, não um número redondo');
  assert.equal(barra.getAttribute('aria-valuenow'), '0');
  assert.equal(barra.getAttribute('aria-label'), frase,
    'a barra anuncia a MESMA frase que a pessoa lê: paráfrase para a máquina é a regra 9 de novo');
});

test('A1b: abrir a aula 3 move o número e a barra juntos, porque saem do mesmo resumo', () => {
  const estudo = abrirAula(lerEstudo(null), { estacao: CIRCUITOS.id, aula: AULAS.aulas[2].id, n: 3 }, '2026-11-04T09:00');
  const { root } = folhaCom({ estudo });
  const barra = um(root, 'aulas-barra', 'folha com uma aberta');

  assert.equal(barra.getAttribute('aria-valuenow'), '1');
  assert.equal(textoDo(um(root, 'aulas-progresso-texto', 'folha com uma aberta')),
    AU.progresso(1, TOTAL_AULAS, duracaoLegivel(SEGUNDOS_TODAS - AULAS.aulas[2].duracaoS)));
});

test('A2: o primário é a aula, com o endereço do vídeo dentro da playlist da estação', () => {
  const { root } = folhaCom({});
  const primario = um(root, 'aulas-primario', 'folha com aulas');

  assert.equal(primario.tag, 'a', 'o primário é um link: o Atlas não é dono da aba do YouTube');
  assert.ok(primario.className.split(/\s+/).includes('botao-primario'), 'e continua sendo o primário da folha');
  assert.equal(primario.getAttribute('href'),
    `https://www.youtube.com/watch?v=${encodeURIComponent(AULAS.aulas[0].id)}&list=${encodeURIComponent(AULAS.playlist)}`,
    'sem o list= a pessoa termina o vídeo e o YouTube sugere fora da estação');
  assert.equal(primario.getAttribute('target'), '_blank');
  assert.equal(primario.getAttribute('rel'), 'noopener', 'target _blank sem noopener dá acesso à janela de quem abriu');
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
  assert.equal(textoDo(nota), 'Abre no YouTube. A aula fica marcada como aberta.');
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
  assert.equal(AU.notaAbrir, 'Abre no YouTube. A aula fica marcada como aberta.');
  assert.deepEqual(AU.estados, { 'nao-iniciada': 'Não iniciada', aberta: 'Aberta' });
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
    assert.equal(link.getAttribute('href'),
      `https://www.youtube.com/watch?v=${encodeURIComponent(AULAS.aulas[i].id)}&list=${encodeURIComponent(AULAS.playlist)}`,
      `linha ${i + 1}: sem o list= a pessoa termina o vídeo e o YouTube sugere fora da estação`);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener');
    assert.equal(link.getAttribute('data-aula'), AULAS.aulas[i].id);
    assert.equal(link.getAttribute('data-n'), String(i + 1));
  }
});

test('B6: a aula por onde continuar é a única marcada com aria-current na lista', async () => {
  const { raiz } = await pagina({ bruto: estudoCom(2, 9) });
  const marcadas = linksDeAula(raiz).filter((n) => n.getAttribute('aria-current') === 'true');
  assert.equal(marcadas.length, 1, 'a marca de "por onde continuar" é um ponto, não a lista toda');
  assert.equal(marcadas[0].getAttribute('data-aula'), AULAS.aulas[8].id, 'regra 2: a aberta mais recente');
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
  assert.equal(frase, '3 de 93 aulas abertas · faltam ~29 h 33 min', `a frase medida saiu: "${frase}"`);

  const { root: folha } = folhaCom({ estudo: lerEstudo(bruto) });
  const fraseDaFolha = textoDo(um(folha, 'aulas-progresso-texto', 'folha'));
  assert.equal(frase, fraseDaFolha, 'as duas telas montam a linha com o mesmo pedaço de código');

  const barra = um(linha, 'aulas-barra', 'página de aulas');
  assert.equal(barra.getAttribute('role'), 'progressbar');
  assert.equal(barra.getAttribute('aria-valuenow'), '3');
  assert.equal(barra.getAttribute('aria-valuemax'), String(TOTAL_AULAS));
  assert.equal(barra.getAttribute('aria-label'), frase, 'a barra anuncia a frase que a pessoa lê');

  const primario = um(raiz, 'aulas-primario', 'página de aulas');
  assert.equal(textoDo(primario), AU.continuar(6, AULAS.aulas[5].titulo));
  assert.equal(textoDo(um(raiz, 'aulas-nota', 'página de aulas')), AU.notaAbrir);
  assert.doesNotMatch(textoDo(raiz), /estudada/i, 'a S14 ainda não existe; a tela não promete estudo');

  const playlist = um(raiz, 'aulas-playlist', 'página de aulas');
  assert.equal(playlist.getAttribute('href'), CIRCUITOS.resourceUrl, 'a playlist é a que o catálogo publica');
  assert.equal(textoDo(playlist), AU.abrirPlaylist);
});

test('B7b: a playlist vem do CATÁLOGO, não do arquivo de aulas — nenhum href cai no vídeo solto', async () => {
  // O JSON de `data/aulas/<slug>.json` (S12) traz id, título e duração; a
  // playlist é do catálogo. Se a tela esquecer a costura, o `list=` some de
  // TODOS os links e a pessoa sai da fila da estação — e nenhum outro teste
  // veria isso, porque o primário e a lista vêm do mesmo painel.
  const semPlaylistNoArquivo = { ...AULAS };
  delete semPlaylistNoArquivo.playlist;
  const { raiz } = await pagina({ buscar: respostaDe(semPlaylistNoArquivo) });
  for (const link of linksDeAula(raiz)) {
    assert.ok(link.getAttribute('href').includes('list=PLXyWBo_coJnMYO9Na3t-oYsc2X4kPJBWf'),
      `href sem a playlist da estação: ${link.getAttribute('href')}`);
  }
});

test('B8: tocar numa linha grava a abertura e a página se repinta ao redor dela', async () => {
  const { raiz, win } = await pagina();
  assert.equal(win.localStorage.getItem(ESTUDO_KEY), null);

  const raizComEstacao = raiz.getAttribute('data-estacao');
  assert.equal(raizComEstacao, CIRCUITOS.id, 'sem o data-estacao a gravação não sabe em qual estação está');

  const link = linhasDa(raiz)[4]; // a Aula 5
  const painel = um(raiz, 'aulas-painel', 'página de aulas');
  // O hdom não faz bolha: o ouvinte está no painel, com o link como target — é o
  // que o navegador entrega à escuta delegada.
  painel.dispatch('click', { target: link });

  const gravado = lerEstudo(win.localStorage.getItem(ESTUDO_KEY));
  assert.equal(gravado.aulas[AULAS.aulas[4].id].n, 5);
  assert.equal(gravado.aulas[AULAS.aulas[4].id].estacao, CIRCUITOS.id);
  assert.match(gravado.aulas[AULAS.aulas[4].id].abertaEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'regra 13: hora local, sem Z');

  // A repintura é o que fecha o ciclo: sem ela a pessoa veria a lista nova por
  // baixo de um primário velho e de uma barra que não se moveu.
  assert.equal(textoDo(um(raiz, 'aulas-primario', 'após o toque')), AU.continuar(5, AULAS.aulas[4].titulo));
  assert.equal(textoDo(um(raiz, 'aulas-progresso-texto', 'após o toque')), AU.progresso(1, TOTAL_AULAS, duracaoLegivel(SEGUNDOS_TODAS - AULAS.aulas[4].duracaoS)));
  const marcadas = linhasDa(raiz).filter((n) => n.getAttribute('aria-current') === 'true');
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
