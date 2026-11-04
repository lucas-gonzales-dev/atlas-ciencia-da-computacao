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
import { criarDoc, janelaCom, storageCom, todos } from './hdom.js';
import { duracaoLegivel } from '../core/aulas.js';
import { aulas as AU, folha as F } from '../core/textos.js';
import { hrefDe } from '../core/rotas.js';
import { ESTUDO_KEY, abrirAula, continuarDe, lerEstudo, serializarEstudo } from '../core/estudo.js';
import { desenharFolha } from '../web/folha.js';
import { agoraLocal, hrefVideo, ligarAberturaDeAula, painelDeAulas } from '../web/aulas-pedacos.js';

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
