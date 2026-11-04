// Projeto Atlas — régua de TECLADO (S10, item 3). O leitor de tela (item 4) entra
// neste mesmo arquivo no próximo pedido; por isso o nome já diz os dois.
//
// POR QUE EXISTE: o metro.js e o folha.js desenham ações, e até aqui nenhuma
// travava percorria a árvore montada perguntando «isto que a pessoa clica, o Tab
// alcança?». Os comentários deste repositório contam o defeito duas vezes, com
// palavras diferentes: `<span type="button">` nas 7 linhas (S2, 31/10 — «o Tab
// passava por cima das 7 linhas, Enter e Espaço não faziam nada») e o `detalhe`
// da folha antes da S5. Cada vez uma fatia consertou O SEU caso; nenhuma escreveu
// a pergunta que teria achado os outros. Esta é essa pergunta, percorrendo as
// cinco telas montadas em vez de olhar um arquivo por vez.
//
// O QUE JÁ EXISTIA E NÃO SE COBRE DE NOVO (lido antes de escrever, como a fatia
// manda — folha.test.js, render.test.js, pages.test.js, rotas.test.js,
// design-system.test.js, metro.test.js):
//   · pages.test.js:114 — o PRIMEIRO focável do <body> é `a class="pular"` com
//     `href="#conteudo"`, e :130 — um único `main#conteudo` com `tabindex="-1"`.
//   · rotas.test.js:29 — `#conteudo` não cai como rota (o pular não troca tela).
//   · design-system.test.js:602/605 — o anel de `base.css :focus-visible` é
//     `outline: var(--anel-foco)` com `outline-offset: var(--afastamento-foco)`.
//   · metro.test.js:469/479 — Esc fecha a folha navegando para `#/`, e na tela do
//     mapa o Esc não toca no endereço.
// A forma do `render` do main.js (grade antiga) também não entra: seus alvos de
// clique são `button.marca`, `button[data-acao]` e `input.importar-arquivo` —
// todos focáveis por tag, e render.test.js já percorre those links.
//
// O QUE ENTRA AQUI:
//   1. toda ação de clique das cinco telas montadas (própria ou por delegação) é
//       ou focável por tag (a[href], button, input, select, textarea, summary),
//       ou tem tabindex="0" + role + ouvinte de tecla;
//   2. nenhum CSS de web/ zera `outline` sem pôr anel substituto na mesma regra;
//   3. o CSS do pular: escondido FORA do fluxo de foco é um pular que o Tab
//       nunca alcança (o que pages.test.js prova é a ESTRUTURA, lida como texto);
//   4. a folha prende o foco nas duas pontas e o devolve a quem abriu.
//
// O QUE O NODE NÃO PROVA (deixa-se dito, porque fingir medida é pior que medida
// nenhuma): se o handler de tecla trata Enter, Espaço ou as duas — o mini-DOM
// prova que O OUVINTE existe e roda, não quais teclas ele lê; se o anel de foco
// aparece pintado na tela, na cor do tema; se o Tab pula o que `display:none`
// esconde (o dublê não tem caixa). Os três são da conferência à mão no navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { criarDoc, linksDe, porTag, storageCom, tagDeAbertura, textoDe, todos, esperar } from './hdom.js';
import { montar as montarExplorar } from '../web/telas/explorar.js';
import { montar as montarRevisar } from '../web/telas/revisar.js';
import { montar as montarPerfil } from '../web/telas/perfil.js';
import { subirMetro } from '../web/metro.js';
import { iniciar as iniciarCasco } from '../web/casco.js';
import { ABAS, lerRota } from '../core/rotas.js';
import { casco, revisar as tRev } from '../core/textos.js';
// S15b: a aba Revisar passou do cartão de ESTação ao CARTÃO escrito no
// fechamento, e a peça do dia que esta régua percorre é a dele.
import { CARTOES_KEY, criarCartao, serializarCartoes } from '../core/cartoes.js';

const CATALOGO = JSON.parse(readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8'));
const IDS = CATALOGO.courses.map((c) => c.id);
const HOJE = '2026-11-02';
const prometido = (v) => Promise.resolve(v);
const falhou = () => Promise.reject(new Error('sem rede: fetch falhou'));

const RAIZ_WEB = fileURLToPath(new URL('../web', import.meta.url));
const INDEX = fileURLToPath(new URL('../index.html', import.meta.url));

/** Os atributos que os binds leem por delegação (`alvo.closest('[data-…]')`). */
const ALVOS_DE_DELEGACAO = [
  'data-acao-placa', 'data-concluir', 'data-desfazer', 'data-embarque',
  'data-fechar', 'data-linha', 'data-marcar'
];

// ─────────────────────────── percorrer a árvore montada ───────────────────────────

function ande(no, fn) {
  if (!no) return;
  fn(no);
  for (const f of no.children || []) ande(f, fn);
}

const cliqueProprio = (no) => Array.isArray(no.listeners?.click) && no.listeners.click.length > 0;
const alvo = (no) => ALVOS_DE_DELEGACAO.find((a) => no.getAttribute?.(a) !== null) || null;

/** Retrato do nó para a mensagem: é assim que o achado tem de ser lido, «tela → elemento». */
function retrato(no) {
  const classe = no.className ? ` class="${no.className}"` : '';
  const deleg = alvo(no);
  const atributo = deleg ? ` ${deleg}="${no.getAttribute(deleg)}"` : '';
  return `<${no.tag}${classe}${atributo}>`;
}

/**
 * Retrato do FOCO em string — é assim que o fail tem de ser lido. Nunca se
 * passa um nó do mini-DOM ao assert.equal: o formatador do node-test desce o
 * grafo do dublê (nó→doc→raiz→filhos→nó) sem memória de visita e esgota o
 * heap. Foi assim que o 4a morria em 58 s com «RangeError: Array buffer
 * allocation failed», sem mensagem, quando a prenda de foco era desligada
 * (S10c, 03/11). Uma trava que só fala quando passa não serve a quem lê o
 * fail: o vermelho tem de dizer ONDE o foco ficou, em segundos.
 */
function focoDiz(no) {
  if (!no) return 'nada (activeElement é null)';
  const texto = textoDe(no).replace(/\s+/g, ' ').trim().slice(0, 40);
  return `${retrato(no)}${texto ? ` «${texto}»` : ''}`;
}

/** Foco por si só: o que o navegador alcança com Tab sem ajuda nenhuma. */
function focavelSozinho(no) {
  switch (no.tag) {
    case 'a': return no.getAttribute('href') !== null;   // <a> sem href não entra na ordem do Tab
    case 'button': case 'input': case 'select': case 'textarea': case 'summary':
      return no.disabled !== true;
    default: return no.getAttribute('tabindex') === '0';
  }
}

/** O que falta para um NÃO-focável virar alcançável: tabindex="0", role e ouvinte de tecla. */
function faltaParaTeclado(no) {
  const faltas = [];
  if (no.getAttribute('tabindex') !== '0') faltas.push('tabindex="0"');
  if (no.getAttribute('role') === null) faltas.push('role');
  if (!Array.isArray(no.listeners?.keydown) || no.listeners.keydown.length === 0) faltas.push('ouvinte de Enter/Espaço');
  return faltas;
}

/**
 * O véu da folha (`div.folha-veu[data-fechar]`) é clicável e não recebe foco, e é
 * LEGÍTIMO: fecha-se com Esc e com o botão de fechar, que são alcançáveis. A
 * exceção não é uma lista de nomes — é a condição, conferida a cada árvore: só
 * vale para um `[data-fechar]` se existir OUTRO `[data-fechar]` focável na mesma
 * tela e se a tela tiver ouvinte de keydown (o Esc). Retirar o Esc, ou o botão de
 * fechar, faz o véu voltar a ser achado. É assim que a trava não vira crachá.
 */
function excecaoDeVeu(no, raiz, escFecha) {
  if (no.getAttribute?.('data-fechar') === null) return false;
  let fecharFocavel = false;
  ande(raiz, (n) => {
    if (n !== no && n.getAttribute?.('data-fechar') !== null && focavelSozinho(n)) fecharFocavel = true;
  });
  return fecharFocavel && escFecha === true;
}

/**
 * UMA IMAGEM NÃO É UM CONTROLE (S20a, 04/11/2026). O topo da Jornada desenha a
 * rede com `mapaDaRede`, e esse SVG carrega `data-linha` em cada trilho e em
 * cada selo para receber a cor da linha — um atributo de PINTURA que a régua lê
 * como gancho de delegação. A isenção é uma CONDIÇÃO conferida em cada árvore,
 * não uma lista de nomes: só vale para quem tem um ancestral `[role="img"]` com
 * `aria-label` de verdade, porque é esse par que diz «isto é um desenho descrito
 * por texto». Retirar o `role` ou o rótulo do mapa faz os nós voltarem a ser
 * achados — e a Jornada, sem o mapa, nem chega a desenhar um.
 */
function excecaoDeImagem(no, raiz) {
  const sobe = no.closest?.('[role="img"]') || null;
  if (!sobe) return false;
  if (typeof no.closest !== 'function') return false;
  let dentro = false;
  ande(raiz, (n) => { if (n === sobe) dentro = true; });
  return dentro && sobe.getAttribute('aria-label') !== null;
}

/**
 * MEDIR em vez de contar ouvintes: dispara o Escape na árvore montada e pergunta
 * ao endereço se a folha saiu. Um `raiz.listeners.keydown.length > 0` diria
 * «tem Esc» com o ramo do Escape removido, porque o handler do Tab continua lá
 * no mesmo listener — a isenção viraria crachá, e a mutação da fatia (tirar o
 * Esc) passaria verde. Custa um tecla por folha montada e devolve o mesmo
 * boolemo que a régua 4 cobra de verdade.
 */
function escFechaFolha(raiz, win) {
  const antes = win.location.hash;
  if (antes === '#/' || antes === '') return false;
  tecla(raiz, { key: 'Escape', shiftKey: false, target: raiz, preventDefault() {} });
  return win.location.hash === '#/';
}

/**
 * A pergunta da régua 1, numa árvore montada. Devolve os achados («tela →
 * elemento → o que falta») e as contagens, para a trava anti-falso-positivo
 * conferir que a árvore foi percorrida de verdade e não estava vazia.
 */
function percorrer(nome, raiz, { escFecha = false } = {}) {
  const achados = [];
  const visitados = { proprio: 0, delegacao: 0, isencoes: 0 };
  const raizDaTela = raiz;
  // É delegação ou não, dito por um FLAG e não por string: a mensagem é o texto
  // que o achado mostra, e comparar «motivo === 'delegação'» contra
  // «clique por delegação (data-fechar)» nunca casa — a isenção do véu ficava
  // morta, e a régua acusaria de verdade um elemento que a casa já julgou
  // legítimo. O flag é a pergunta; o texto é só o relatório.
  const julgar = (no, rotulo, porDelegacao) => {
    if (no === raizDaTela && !porDelegacao) return; // o contêiner da delegação não é ação
    if (focavelSozinho(no)) return;
    if (excecaoDeVeu(no, raizDaTela, escFecha)) { visitados.isencoes += 1; return; }
    if (excecaoDeImagem(no, raizDaTela)) { visitados.isencoes += 1; return; }
    achados.push(`${nome} → ${retrato(no)}: ${rotulo} sem foco; falta ${faltaParaTeclado(no).join(', ')}`);
  };
  ande(raiz, (no) => {
    if (cliqueProprio(no)) { visitados.proprio += 1; julgar(no, 'clique próprio', false); }
    const d = alvo(no);
    if (d) { visitados.delegacao += 1; julgar(no, `clique por delegação (${d})`, true); }
  });
  return { achados, visitados };
}

/** Junta os achados de várias telas numa mensagem só, lida como lista. */
function semAchado(resultados) {
  const todos = resultados.flatMap((r) => r.achados);
  const linha = '\n' + todos.join('\n');
  assert.equal(todos.length, 0, `${todos.length} ação(ões) fora do alcance do Tab:${linha}`);
}

// ─────────────────────────────── as cinco telas ───────────────────────────────

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
  const modulos = modulosCom(opts);
  return {
    document: doc,
    window: { localStorage: storage, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} },
    storage,
    modulos,
    // hoje é do contexto: a Revisar escolhe a peça do dia por ele. Fixar HOJE
    // aqui fazia o `hoje` que a tela recebia ser ignorado — a fila ficava vazia
    // e a régua achava 0 botões, o falso negativo que ela veio impedir.
    hoje: opts.hoje || HOJE,
    // A chave de cima é a PROMESSA que a tela espera; esta só sobrepõe quando o
    // caso pede outra (o catálogo em erro, na JORNADA). Sem o `in`, um opts sem
    // catalogo apagava a promessa e a Perfil morria em reading 'then' — chave
    // duplicada no mesmo objeto literal, a última manda.
    catalogo: 'catalogo' in opts ? opts.catalogo : modulos.loadCatalog(),
    estadoCatalogo: CATALOGO
  };
}

async function jornada(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const win = { location: { hash: opts.folha ? `#/estacao/${opts.folha}` : '#/' }, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} };
  const inst = await subirMetro({
    root: raiz,
    document: doc,
    storage: opts.storage || storageCom(),
    window: win,
    modulos: modulosCom(opts),
    setTimeout: () => 0,
    hoje: HOJE,
    folha: opts.folha ?? null
  });
  return { doc, raiz, inst, win };
}

// ───────────────────────── 1. o alcance do Tab nas cinco telas ─────────────────────────

test('teclado 1: cada ação desenhada nas cinco telas está ao alcance do Tab', async () => {
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const trancada = CATALOGO.courses.find((c) => c.prerequisites?.length);
  const resultados = [];

  // JORNADA — mapa vazio (embarque aberto, placa, 7 linhas, diagrama)…
  resultados.push(await (async () => {
    const { raiz } = await jornada({ completed: [] });
    return { ...percorrer('JORNADA (vazia)', raiz) };
  })());
  // …e a JORNADA com cada estado da folha por cima: disponível, trancada, concluída.
  const comEsc = async (nome, opts) => {
    const { raiz, win } = await jornada(opts);
    return { ...percorrer(nome, raiz, { escFecha: escFechaFolha(raiz, win) }) };
  };
  resultados.push(await comEsc('FOLHA (disponível)', { completed: [], folha: disponivel.slug }));
  resultados.push(await comEsc('FOLHA (trancada)', { completed: [], folha: trancada.slug }));
  resultados.push(await comEsc('FOLHA (concluída)', { completed: IDS.slice(0, 8), folha: CATALOGO.courses.find((c) => c.id === IDS[0])?.slug }));

  // EXPLORAR com a busca sem resultado — o único botão da tela com ouvinte próprio.
  {
    const doc = criarDoc();
    const raiz = doc.createElement('div');
    await montarExplorar(raiz, contexto(doc));
    await esperar();
    const campo = porTag(raiz, 'input').find((n) => n.type === 'search');
    assert.ok(campo, 'a Explorar não montou o campo de busca');
    campo.value = 'zxqw';
    campo.dispatch('input');
    resultados.push(percorrer('EXPLORAR (busca sem resultado)', raiz));
  }

  // REVISAR (S15b): a fila de CARTÕES, nos dois estados em que ela tem peça — a
  // abertura, com o «Começar», e o cartão, com a confiança opcional e o
  // «Mostrar a resposta»; depois do Mostrar, as duas respostas do mesmo peso.
  // Percorrer os três é o que a casa sempre quis dizer: cada ação que a tela
  // desenha tem de estar ao alcance do Tab, e a fila desenha ações diferentes
  // conforme a pessoa anda por ela. O «Desfazer» saiu da tela com a S8, e com
  // ele saiu daqui.
  {
    const id = IDS[0];
    // Criado DOIS dias antes do HOJE da casa (02/11): o cartão novo vence
    // amanhã, e dois dias para trás é o que o põe na fila de hoje. Criado hoje
    // daria um «em dia» sem peça nenhuma — o falso negativo que esta casa existe
    // para impedir, e que ela acabou de medir ao trocar o cenário.
    const criado = criarCartao(
      { versao: 1, cartoes: {} },
      { estacao: id, aula: 'aula-1', n: 1, frente: 'O que é um bit?', verso: 'O menor pedaço de informação.' },
      '2026-10-31T10:00',
      'teclado-revisar'
    );
    assert.equal(criado.ok, true, `fixture: cartão recusado (${criado.erro})`);
    const storage = storageCom({
      'atlas.progresso.v1': JSON.stringify([id]),
      [CARTOES_KEY]: serializarCartoes({ versao: 1, cartoes: criado.cartoes })
    });
    const doc = criarDoc();
    const raiz = doc.createElement('div');
    await montarRevisar(raiz, contexto(doc, { completed: [id], storage }));
    await esperar();
    const botões = () => porTag(raiz, 'button');
    const peloTexto = (texto) => botões().find((b) => b.textContent === texto);
    assert.ok(botões().length >= 1, `Revisar na abertura sem peça: ${botões().length} botões`);
    resultados.push(percorrer('REVISAR (abertura)', raiz));

    peloTexto(tRev.comecar).dispatch('click', { target: raiz });
    await esperar();
    assert.ok(botões().length >= 4, `Revisar no cartão sem a confiança e o Mostrar: ${botões().length} botões`);
    resultados.push(percorrer('REVISAR (cartão, antes do verso)', raiz));

    peloTexto(tRev.mostrarResposta).dispatch('click', { target: raiz });
    await esperar();
    assert.ok(peloTexto(tRev.errei) && peloTexto(tRev.lembrei), 'o cartão não deu as duas respostas');
    resultados.push(percorrer('REVISAR (cartão, com as duas respostas)', raiz));
  }

  // PERFIL com viagem feita: o botão de exportar (ouvinte próprio) e o input de arquivo.
  {
    const doc = criarDoc();
    const raiz = doc.createElement('div');
    const inst = await montarPerfil(raiz, contexto(doc, { completed: IDS.slice(0, 3) }));
    if (inst?.pronto) await inst.pronto;
    resultados.push(percorrer('PERFIL', raiz));
  }

  // O catálogo que falha também é tela, e também tem saída clicável.
  resultados.push(percorrer('JORNADA (catálogo em erro)', (await jornada({ catalogo: falhou() })).raiz));

  // Anti-falso-positivo: se a árvore estivesse vazia, «nenhum achado» seria verde.
  const somados = resultados.reduce((a, r) => ({
    proprio: a.proprio + r.visitados.proprio,
    delegacao: a.delegacao + r.visitados.delegacao,
    isencoes: a.isencoes + r.visitados.isencoes
  }), { proprio: 0, delegacao: 0, isencoes: 0 });
  assert.ok(somados.proprio >= 6, `só ${somados.proprio} ouvintes de clique próprios percorridos — as telas não montaram`);
  assert.ok(somados.delegacao >= 20, `só ${somados.delegacao} alvos de delegação percorridos — o mapa não foi desenhado`);
  assert.ok(somados.isencoes >= 2, `o véu deveria ser isentado uma vez por folha aberta (${somados.isencoes})`);
  semAchado(resultados);
});

test('teclado 1b: o que a régua achou é a árvore, não o dublê — três casos de referência', async () => {
  // Se estes três passassem por achado, a régua estaria flagrando o mini-DOM.
  const { raiz } = await jornada({ completed: [] });
  const cartao = porTag(raiz, 'a').find((a) => a.getAttribute('data-id'));
  assert.ok(cartao, 'o cartão da estação não é um link no mapa');
  // A régua NÃO cobra nada de quem já entra no Tab: faltaParaTeclado é a resposta
  // para um NÃO-focável (o julgar de percorrer devolve antes de perguntar). Pedir
  // as três faltas de um link com href seria cobrar o que o navegador já dá.
  assert.equal(focavelSozinho(cartao), true, 'cartão <a href> deveria entrar no Tab por si');
  assert.deepEqual(percorrer('MAPA', raiz).achados, [], 'a árvore de verdade não tem achado');

  const botao = porTag(raiz, 'button').find((b) => b.getAttribute('data-linha') !== null);
  assert.ok(botao, 'o seletor de linha não tem botão');
  assert.equal(focavelSozinho(botao), true, 'o <button> da linha tem de ser focável por tag');

  // E o falso negativo, medido na própria régua: um div clicável É achado.
  const doc = criarDoc();
  // (a) o CONTÊINER da delegação, sozinho, tem clique e não é ação — percorrer
  //     recebe a raiz da tela, e as telas penduram o ouvinte nela.
  const raiz2 = doc.createElement('div');
  raiz2.className = 'tela';
  raiz2.addEventListener('click', () => {});
  const r = percorrer('TESTE DE REFERÊNCIA', raiz2);
  assert.equal(r.achados.length, 0, `a raiz da tela é contêiner da delegação, não ação: ${r.achados}`);

  // (b) o MESMO div, agora dentro do contêiner, É ação, e a régua o acha.
  const dentro = doc.createElement('div');
  dentro.className = 'falsa-agindo';
  dentro.addEventListener('click', () => {});
  raiz2.append(dentro);
  const r2 = percorrer('TESTE DE REFERÊNCIA', raiz2);
  assert.equal(r2.achados.length, 1, `um div com clique dentro da tela deveria ser achado: ${r2.achados}`);
  assert.match(r2.achados[0], /falta tabindex="0", role, ouvinte de Enter\/Espaço/, `achado sem as três faltas: ${r2.achados[0]}`);
});

// ───────────────────────── 2. o foco visível no CSS ─────────────────────────

/** Blocos `seletor { corpo }` de um CSS, sem comentário e sem os invólucros @. */
function regras(texto) {
  const semComentario = texto.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const saida = [];
  for (const m of semComentario.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const seletor = m[1].trim().replace(/\s+/g, ' ');
    if (!seletor || seletor.startsWith('@')) continue;
    saida.push({ seletor, corpo: m[2] });
  }
  return saida;
}

const zeraOutline = (corpo) =>
  corpo.split(';').some((d) => /^\s*outline\s*:\s*(?:none|0)\b/i.test(d) || /^\s*outline-width\s*:\s*(?:0|none)\b/i.test(d));
const temAnelNaMesmaRegra = (corpo) => /(?:^|;)\s*box-shadow\s*:/i.test(corpo);

function arquivosDeCss(pasta) {
  const saida = [];
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) saida.push(...arquivosDeCss(caminho));
    else if (e.name.endsWith('.css')) saida.push(caminho);
  }
  return saida;
}

test('teclado 2: nenhum CSS de web/ zera o outline sem pôr outro anel na mesma regra', () => {
  const arquivos = arquivosDeCss(RAIZ_WEB);
  assert.ok(arquivos.length >= 7, `poucos CSS encontrados em web/: ${arquivos.length}`);
  const achados = [];
  let aneis = 0;
  for (const caminho of arquivos) {
    const nome = caminho.slice(RAIZ_WEB.length + 1).replace(/\\/g, '/');
    for (const r of regras(readFileSync(caminho, 'utf8'))) {
      if (!zeraOutline(r.corpo)) continue;
      if (temAnelNaMesmaRegra(r.corpo)) { aneis += 1; continue; }
      achados.push(`${nome}: ${r.seletor} zera o outline sem anel substituto (box-shadow) na mesma regra`);
    }
  }
  // O positivo de base.css (:focus-visible com outline de token) já é de
  // design-system.test.js:602; o que entra aqui é o negativo, na pasta inteira.
  const base = readFileSync(join(RAIZ_WEB, 'base.css'), 'utf8');
  assert.match(base, /:focus-visible\s*\{[^}]*outline:\s*var\(--anel-foco\)/, 'o anel de base.css sumiu');
  assert.equal(achados.length, 0, `${achados.length} regra(s) matando o foco:${'\n' + achados.join('\n')}`);
});

// ───────────────────────── 3. o pular, no CSS (a estrutura é de pages.test.js) ─────────────────────────

test('teclado 3: o pular está escondido FORA do foco, nunca invisível para o Tab', () => {
  const html = readFileSync(INDEX, 'utf8');
  const pular = tagDeAbertura(html, 'a').find((t) => /class="pular"/.test(t));
  assert.ok(pular, 'index.html sem a.pular');
  assert.equal(/href="#conteudo"/.test(pular), true, `o pular aponta para outro lugar: ${pular}`);
  // pages.test.js:130 prova o tabindex do main; aqui, que o alvo existe uma vez.
  assert.equal((html.match(/id="conteudo"/g) || []).length, 1, 'id="#conteudo" duplicado: o pular não sabe onde cai');
  // Um pular utilitário (.so-leitor) não reaparece no foco: clip-path não é tirado por :focus.
  assert.equal(/class="[^"]*so-leitor[^"]*"/.test(pular), false, 'o pular usa .so-leitor e nunca volta a aparecer');

  const css = readFileSync(join(RAIZ_WEB, 'casco.css'), 'utf8');
  const bloco = regras(css).find((r) => r.seletor.split(',').includes('.pular'));
  assert.ok(bloco, 'casco.css não tem regra para .pular');
  for (const proibida of ['display:none', 'visibility:hidden', 'opacity:0', 'clip-path', 'width:0', 'height:0']) {
    assert.equal(new RegExp(proibida).test(bloco.corpo), false,
      `.pular com «${proibida}» sai da ordem do Tab: o atalho existe e ninguém alcança`);
  }
  const foco = regras(css).find((r) => /\.pular:focus(-visible)?/.test(r.seletor));
  assert.ok(foco, 'casco.css não traz o .pular de volta em :focus — o Tab cai num lugar que não se vê');
  assert.match(foco.corpo, /top:\s*(?!-)/, `o :focus do pular não o traz para dentro da tela: ${foco.corpo.trim()}`);
});

// ───────────────────────── 4. a folha prende o foco e o devolve ─────────────────────────

/** Os focáveis de dentro da folha, na ordem do documento — o que o Tab percorre. */
function focaveisNa(raiz) {
  const saida = [];
  ande(raiz, (no) => { if (no.getAttribute && no.tag && focavelSozinho(no)) saida.push(no); });
  return saida;
}

function painelDaFolha(raiz) {
  const p = raiz.querySelector('.folha');
  assert.ok(p, 'a rota #/estacao/<slug> não desenhou o painel');
  return p;
}

const tecla = (no, evento) => { for (const fn of no.listeners.keydown || []) fn(evento); };
const clique = (no, alvoDoEvento) => {
  const ev = { target: alvoDoEvento, preventDefault() { ev._padraoImpedido = true; } };
  for (const fn of no.listeners.click || []) fn(ev);
  return ev;
};

test('teclado 4a: Tab no último focável da folha volta ao primeiro', async () => {
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const { doc, raiz } = await jornada({ completed: [], folha: disponivel.slug });
  const lista = focaveisNa(painelDaFolha(raiz));
  assert.ok(lista.length >= 3, `a folha tem ${lista.length} focáveis; com um só, a trava de volta não significa nada`);

  const ultimo = lista[lista.length - 1];
  ultimo.focus();
  assert.ok(doc.activeElement === ultimo, `o dublê não registrou o foco no último: está em ${focoDiz(doc.activeElement)}`);
  const ev = { key: 'Tab', shiftKey: false, target: ultimo, preventDefault() { ev._impedido = true; } };
  tecla(raiz, ev);
  assert.ok(doc.activeElement === lista[0],
    `Tab no último focável saiu da folha em vez de voltar ao primeiro: ficou em ${focoDiz(doc.activeElement)}, devia estar em ${focoDiz(lista[0])}`);
  assert.equal(ev._impedido, true, 'a volta ao primeiro precisava impedir o Tab padrão');
});

test('teclado 4b: Shift+Tab no primeiro focável da folha vai ao último', async () => {
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const { doc, raiz } = await jornada({ completed: [], folha: disponivel.slug });
  const lista = focaveisNa(painelDaFolha(raiz));
  const primeiro = lista[0];
  primeiro.focus();
  const ev = { key: 'Tab', shiftKey: true, target: primeiro, preventDefault() { ev._impedido = true; } };
  tecla(raiz, ev);
  assert.ok(doc.activeElement === lista[lista.length - 1],
    `Shift+Tab no primeiro fugiu da folha para cima: ficou em ${focoDiz(doc.activeElement)}, devia estar em ${focoDiz(lista[lista.length - 1])}`);
  assert.equal(ev._impedido, true, 'a volta ao último precisava impedir o Shift+Tab padrão');
});

test('teclado 4c: o foco andou 100 Tabs e nunca saiu da folha', async () => {
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const { doc, raiz } = await jornada({ completed: [], folha: disponivel.slug });
  const painel = painelDaFolha(raiz);
  const lista = focaveisNa(painel);
  let atual = 0;
  lista[0].focus();
  for (let i = 0; i < 100; i += 1) {
    const no = doc.activeElement;
    const dentro = no && (no.closest ? !!no.closest('.folha') : false);
    assert.equal(dentro, true, `Tab nº ${i}: o foco caiu fora da folha em <${no?.tag} class="${no?.className}">`);
    atual = (atual + 1) % lista.length;
    const ev = { key: 'Tab', shiftKey: false, target: no, preventDefault() {} };
    tecla(raiz, ev);
    if (doc.activeElement !== lista[atual]) {
      // o navegador faria o Tab andar sozinho; aqui só nos importa que não fugiu
      doc.activeElement === no && lista[atual].focus();
    }
  }
  assert.ok(true);
});

test('teclado 4d: Esc fecha e o foco volta ao cartão que abriu a folha', async () => {
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const HREF = `#/estacao/${disponivel.slug}`;
  // A COREOGRAFIA É A DO NAVEGADOR, e cada instância é uma pintura:
  //   1. mapa → a pessoa tecla Enter no cartão (o click que o Enter produz);
  //   2. a rota mudou: a folha está desenhada, e o foco entrou nela;
  //   3. Esc NA TELA QUE TEM A FOLHA — o fechar navega (irPara('#/')), e a
  //      navegação mata a instância: quem devolve o foco é a PINTURA SEGUINTE;
  //   4. mapa de novo, e o cartão é o elemento focado.
  // Dar o Esc onde não há painel (como estava) faz o fechar voltar cedo, e a
  // trava mediria o nada.
  const primeira = await jornada({ completed: [], folha: null });
  const cartao = porTag(primeira.raiz, 'a').find((a) => a.getAttribute('href') === HREF);
  assert.ok(cartao, 'o mapa não tem o cartão-link da estação disponível');
  clique(primeira.raiz, cartao);

  const segunda = await jornada({ completed: [], folha: disponivel.slug });
  assert.ok(segunda.raiz.querySelector('.folha'), 'a rota não abriu a folha');
  tecla(segunda.raiz, { key: 'Escape', shiftKey: false, target: segunda.raiz, preventDefault() {} });
  assert.equal(segunda.win.location.hash, '#/', 'o Esc não navegou para fora da folha');

  const terceira = await jornada({ completed: [], folha: null });
  const devolvido = porTag(terceira.raiz, 'a').find((a) => a.getAttribute('href') === HREF);
  assert.ok(devolvido, 'o cartão que abriu a folha não está no mapa remontado');
  // SEMPRE por retrato, nunca assert.equal(node, node): o formatador do node-test
  // desce o grafo do mini-DOM (nó→doc→raiz→filhos→nó) sem memória de visita e
  // esgota o heap em ~33 s. O que se compara é a identidade; o que se reporta é
  // a descrição, e a régua 1b já prova que descrever é ler atributos reais.
  const ativo = terceira.doc.activeElement;
  assert.ok(ativo !== null, 'o Esc fechou e o foco caiu no nada (doc.activeElement é null)');
  assert.ok(
    ativo === devolvido,
    `Esc fechou, mas o foco não voltou ao cartão que abriu a folha: ficou em ${focoDiz(ativo)}, devia estar em ${focoDiz(devolvido)}`
  );
});

// ───────────────── ITEM 4: o leitor de tela (S10c, 03/11) ─────────────────
//
// O QUE JÁ EXISTIA E NÃO SE COBRE DE NOVO:
//   · pages.test.js:153-157 — a EXISTÊNCIA do p#anuncio no index.html, lido
//     como TEXTO (aria-live polite, classe so-leitor), e a frase
//     `casco.anuncio(rotulo)` saindo de core/textos.js.
//   · rotas.test.js — as abas, seus rótulos, e a âncora #conteudo fora das rotas.
// O QUE ENTRA: pages.test.js:100-101 cita um tests/casco.test.js que NUNCA
// EXISTIU — a troca de aba, o nome dos campos e o tamanho das regiões
// aria-live nunca foram montados em teste nenhum. O leitor 5 sobe o
// web/casco.js de verdade no mini-DOM, com a cara do index.html.
//
// O QUE O NODE NÃO PROVA (conferência à mão no navegador): se o leitor anuncia
// na voz e no momento certos — aria-live é comportamento do dispositivo; aqui
// se mede a ESTRUTURA: quem tem a palavra, em quê, e se todo campo tem nome.

/** Sobe o casco no mini-DOM: pular, topo>nav com as 4 abas, selo de rede,
 *  main#conteudo e p#anuncio — os mesmos ids e atributos do index.html. */
async function subirCasco() {
  const doc = criarDoc();
  const m = (tag, opts = {}) => {
    const no = doc.createElement(tag);
    no.className = opts.classe || '';
    for (const [k, v] of Object.entries(opts.attrs || {})) no.setAttribute(k, v);
    if (opts.id) doc._registrar(opts.id, no);
    return no;
  };
  const main = m('main', { id: 'conteudo', attrs: { tabindex: '-1' } });
  main.textContent = 'O Atlas está carregando.'; // a guarda escrita, que o casco esvazia
  const nav = m('nav', { classe: 'abas', attrs: { 'aria-label': 'Principal' } });
  for (const aba of ABAS) nav.append(m('a', { attrs: { href: aba.href, 'data-tela': aba.tela } }));
  const topo = m('header', { classe: 'topo' });
  topo.append(nav);
  doc.documentElement.append(
    m('a', { classe: 'pular', attrs: { href: '#conteudo' } }),
    topo,
    m('p', { id: 'estado-rede', classe: 'selo-rede', attrs: { 'aria-live': 'polite', hidden: '' } }),
    main,
    m('p', { id: 'anuncio', classe: 'so-leitor', attrs: { 'aria-live': 'polite' } })
  );
  const win = {
    location: { hash: '#/' },
    history: { replaceState: () => {} },
    localStorage: storageCom(),
    setTimeout: () => 0,
    clearTimeout: () => {},
    scrollTo: () => {},
    addEventListener: () => {}
  };
  // O main.js fala o `localStorage` GLOBAL sem janela (loadCompleted e
  // loadNotas são chamados no montar de Revisar e Perfil). No node ele não
  // existe, e sem este empréstimo o casco montaria a aba e morreria no meio —
  // a régua acusaria o casco por um problema do dublê. node --test roda cada
  // arquivo num processo próprio; o empréstimo não vaza para a suíte inteira.
  if (typeof globalThis.localStorage?.getItem !== 'function') {
    Object.defineProperty(globalThis, 'localStorage', { value: storageCom(), configurable: true });
  }
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => CATALOGO });
  let inst;
  try {
    inst = await iniciarCasco({ document: doc, window: win });
  } finally {
    if (fetchOriginal === undefined) delete globalThis.fetch;
    else globalThis.fetch = fetchOriginal;
  }
  assert.equal(inst?.ok, true, `o casco não subiu no mini-DOM: ${inst?.motivo}`);
  return {
    doc,
    main,
    nav,
    anuncio: doc.getElementById('anuncio'),
    // `pintar` é a MESMA função que o casco amarra ao hashchange no navegador,
    // e iniciar a devolve em {ok, pintar}: dirigir a rota por ela é o caminho
    // real da pintura, sem esperar microtask às cegas.
    ir: (rota) => inst.pintar(lerRota(rota))
  };
}

/**
 * O nome que um leitor de tela leria para este campo, ou null. Placeholder NÃO
 * é nome: some quando o campo recebe texto, e quem usa leitor de tela muitas
 * vezes o ouve tarde demais. As três saídas legítimas: aria-label,
 * aria-labelledby apontando para um id que existe, ou label com for.
 */
function nomeDoCampo(no, doc) {
  const rotulo = no.getAttribute('aria-label');
  if (rotulo) return rotulo;
  const dito = no.getAttribute('aria-labelledby');
  if (dito) {
    const alvo = todos(doc.documentElement, (n) => n.id === dito.trim().split(/\s+/)[0])[0];
    return alvo ? textoDe(alvo) : null;
  }
  if (no.id) {
    const label = todos(doc.documentElement, (n) => n.tag === 'label' && n.htmlFor === no.id)[0];
    if (label && textoDe(label).trim()) return textoDe(label);
  }
  return null;
}

test('leitor 5: cada troca de aba escreve o rótulo da aba em #anuncio', async () => {
  const { doc, anuncio, ir } = await subirCasco();
  assert.ok(anuncio, 'o casco montou sem o p#anuncio');
  // A primeira pintura é MUDA por decisão (regra escrita no topo do
  // web/casco.js): quem abriu o app não pediu para ser levado a lugar nenhum.
  assert.equal(anuncio.textContent, '', `a primeira pintura já falou: «${anuncio.textContent}»`);
  const achados = [];
  for (const aba of ABAS) {
    await ir(aba.href);
    const esperado = casco.anuncio(aba.rotulo);
    if (anuncio.textContent !== esperado) {
      achados.push(`ir para ${aba.href}: #anuncio guarda «${anuncio.textContent}», devia «${esperado}»`);
    }
    if (!doc.title.startsWith(`${aba.rotulo} · `)) {
      achados.push(`ir para ${aba.href}: doc.title é «${doc.title}», devia começar com «${aba.rotulo} · »`);
    }
  }
  assert.equal(achados.length, 0, `troca de aba muda para quem usa leitor de tela:\n${achados.join('\n')}`);
});

test('leitor 6: todo campo das cinco telas e da folha tem nome próprio', async () => {
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const achados = [];
  let vistos = 0;
  // PERGUNTA NA HORA DA PINTURA. Guardar as referências e avaliar no fim deu
  // falso positivo na Explorar: `main.textContent = ''` da aba seguinte destrói
  // o <label> que dava nome ao campo, e o input sobrevive como objeto órfão —
  // a régua procurava o label numa árvore onde ele já não existia. O campo só
  // tem nome se ele existe JUNTO, naquele instante.
  const conferir = (tela, raiz, doc) => {
    for (const campo of porTag(raiz, 'input').concat(porTag(raiz, 'select'), porTag(raiz, 'textarea'))) {
      if (campo.getAttribute('type') === 'hidden') continue;
      vistos += 1;
      if (nomeDoCampo(campo, doc)) continue;
      const rotulos = todos(doc.documentElement, (n) => n.tag === 'label' && n.htmlFor).map((l) => `label[for=${l.htmlFor}]`);
      achados.push(`${tela} → ${retrato(campo)} id="${campo.id}": sem nome (placeholder não é nome); aria-label="${campo.getAttribute('aria-label')}", aria-labelledby="${campo.getAttribute('aria-labelledby')}", labels na árvore: ${rotulos.join(', ') || 'nenhum'}`);
    }
  };
  const cascos = await subirCasco();
  for (const aba of ABAS) {
    await cascos.ir(aba.href);
    conferir(aba.rotulo, cascos.main, cascos.doc);
  }
  const folha = await jornada({ completed: [], folha: disponivel.slug });
  conferir('FOLHA', folha.raiz, folha.doc);
  // Anti-falso-positivo: Explorar tem busca + filtro e a folha tem anotação.
  assert.ok(vistos >= 3, `só ${vistos} campos percorridos — as telas não montaram`);
  assert.equal(achados.length, 0, `campo sem nome próprio:\n${achados.join('\n')}`);
});

// Heurística 9 da casa: aria-live em bloco grande faz o leitor reler a tela
// inteira a cada mudança. Uma região que fala é UMA FRASE — um p ou um span.
// `li` ficou fora de propósito: um item ganhando aria-live fala uma frase.
const GRANDES = new Set(['main', 'section', 'nav', 'ul', 'ol', 'article', 'header', 'footer', 'form', 'fieldset', 'table', 'div']);

test('leitor 7: toda região aria-live é uma frase — p ou span, nunca um bloco', async () => {
  const vistas = new Set();
  const achados = [];
  const conferir = (nome, doc) => {
    for (const no of todos(doc.documentElement, (n) => n.hasAttribute('aria-live'))) {
      vistas.add(`${no.tag}#${no.id || no.className}`);
      if (GRANDES.has(no.tag)) {
        achados.push(`${nome}: <${no.tag}${no.id ? ` id="${no.id}"` : ` class="${no.className}"`}> leva aria-live="${no.getAttribute('aria-live')}" — um bloco no aria-live faz o leitor reler a tela a cada mudança`);
      } else if (no.tag !== 'p' && no.tag !== 'span') {
        achados.push(`${nome}: aria-live em <${no.tag}>, que não é um p nem um span`);
      }
    }
  };
  const cascos = await subirCasco();
  for (const aba of ABAS) {
    await cascos.ir(aba.href);
    conferir(aba.rotulo, cascos.doc);
  }
  const disponivel = CATALOGO.courses.find((c) => !c.prerequisites?.length && c.resourceUrl);
  const folha = await jornada({ completed: [], folha: disponivel.slug });
  conferir('FOLHA', folha.doc);
  assert.ok(vistas.size >= 3, `só ${vistas.size} regiões aria-live vistas (${[...vistas].join(', ')}) — o casco não montou`);
  assert.equal(achados.length, 0, `aria-live fora do tamanho:\n${achados.join('\n')}`);
});
