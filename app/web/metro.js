// Projeto Atlas — A TELA DE METRÔ (pedido 16, 29/10/2026).
//
// Regra da casa: roda NO NODE (tests/metro.test.js, com um document mínimo) e
// NO NAVEGADOR (app/metro.html). Sem build, sem dependência.
//
// TRÊS REGRAS QUE ESTE ARQUIVO OBEDECE E QUE O TESTE COBRA:
//   1. NENHUMA REGRA DE ESTADO REIMPLEMENTADA AQUI. O que está concluído, o que
//      está em curso, o que falta para destrancar e qual é a próxima estação vêm
//      de core/viagem.js. Desenhar é traduzir estado em forma — decidir estado é
//      do núcleo. Duas cópias da regra é a receita para a placa e o diagrama
//      discordarem em silêncio.
//   2. NENHUM TEXTO ESCRITO À MÃO AQUI. Toda frase vem de core/textos.js. Frase
//      dentro do render é frase que o teste não alcança e que aparece grafada de
//      dois jeitos em duas telas.
//   3. NENHUMA COR AQUI. A cor da linha é uma CLASSE (.l1 … .l7) que o CSS
//      resolve com os tokens. JS que escolhe hex é JS que fura o design system.

import { placa, comValores, estados, ORIGEM, TIPO_DE_ORIGEM } from '../core/textos.js';
import { abertura, tresNumeros, conexao, totalDeLinhas } from './telas/jornada-blocos.js';
// S5 parte 2: a FOLHA saiu deste arquivo (ela é web/folha.js) e passou a ter
// rota própria (#/estacao/<slug>). O ciclo de imports é deliberado: o metro.js
// chama `desenharFolha` ao pintar e o folha.js lê `naFonte`/`origemDoRecurso`
// daqui — os dois só usam a referência dentro de função, nunca na avaliação do
// módulo, e por isso o ciclo importa sem estourar. Reimplementar a origem na
// folha era a segunda palavra para a mesma coisa que a crítica da v1 contou.
import { desenharFolha } from './folha.js';
import { hrefDe, lerRota } from '../core/rotas.js';
import {
  ESTADOS,
  numerosDaJornada,
  lerProgresso,
  estadoDaEstacao,
  resumoDaViagem,
  concluirEstacao,
  iniciarEstacao,
  desfazerConclusao,
  marcosNovos,
  abreComBaldeacao,
  momentoDaChegada
} from '../core/viagem.js';

// ─────────────────────────── progresso em curso / datas ───────────────────────────
//
// `completed` continua na MESMA chave que a trilha antiga usa (loadCompleted /
// saveCompleted de main.js): duas fontes de "o que está concluído" seria o pior
// bug possível — a placa diria 12 e o export diria 9.
//
// `emCurso` e `conclusoes` são campos do formato v3 que a chave antiga (um array
// cru) não carrega. Eles ficam aqui, nesta chave, e o progresso v3 é SEMPRE
// remontado juntando os dois. Unificar as duas chaves é o próximo passo da
// migração — até lá, a regra é uma só: completed manda em "concluída".
/** Chave local dos campos de viagem que a chave antiga não carrega. */
export const CHAVE_VIAGEM = 'atlas.viagem.detalhe.v1';

/**
 * Remonta o progresso v3: `completed` da fonte compartilhada, o resto daqui.
 * @param {Storage|null} storage
 * @param {string[]} completed
 */
export function carregarViagem(storage, completed) {
  const ids = Array.isArray(completed) ? completed.filter((x) => typeof x === 'string') : [];
  let detalhe = null;
  try {
    detalhe = storage ? storage.getItem(CHAVE_VIAGEM) : null;
  } catch {
    detalhe = null; // modo privado: sem viagem em curso, e sem quebrar a tela
  }
  const lido = lerProgresso(detalhe ? tenta(detalhe) : null);
  // completed é a autoridade: uma estação marcada como concluída no detalhe mas
  // não na fonte compartilhada não existe (e vice-versa).
  return { completed: ids, emCurso: lido.emCurso, conclusoes: lido.conclusoes };
}

function tenta(texto) {
  try { return JSON.parse(texto); } catch { return null; }
}

/** Guarda em curso + datas. Devolve false quando o aparelho não deixou gravar. */
export function salvarViagem(storage, progresso) {
  const p = lerProgresso(progresso);
  try {
    storage.setItem(CHAVE_VIAGEM, JSON.stringify({ emCurso: p.emCurso, conclusoes: p.conclusoes }));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────── vocabulário da tela ───────────────────────────────

/** A palavra do estado, como a pessoa lê. Forma + palavra: cor nunca sozinha. */
export const ESTADO_LEGIVEL = Object.freeze({
  [ESTADOS.CONCLUIDA]: 'concluída',
  [ESTADOS.EM_CURSO]: 'em curso',
  [ESTADOS.DISPONIVEL]: 'disponível',
  [ESTADOS.TRANCADA]: 'trancada'
});

/**
 * O nome inteiro que o leitor de tela lê: "Matemática Discreta, Linha 2, disponível".
 * Não é enfeite de acessibilidade — é o que conserta o botão que só dizia
 * "abrir" e o campo que só dizia "Anotação".
 */
export function rotuloEstacao(estacao, linha) {
  const nome = estacao && typeof estacao.titulo === 'string' ? estacao.titulo : '';
  // FATIA 2c-3: sem linha não se INVENTA linha. `Number(null)` é 0 e 0 é finito,
  // então o rótulo saía "X, Linha 0, trancada" — e Linha 0 não existe em lugar
  // nenhum do catálogo. Quando o número não vem, a parte da linha sai da frase.
  const n = Number(linha);
  const l = Number.isFinite(n) && n > 0 ? n : null;
  const estado = ESTADO_LEGIVEL[estacao?.estado] || ESTADO_LEGIVEL[ESTADOS.TRANCADA];
  return l === null ? `${nome}, ${estado}` : `${nome}, ${comValores.linha(l)}, ${estado}`;
}

/** A ação ÚNICA da placa: "Continuar" quando já está em curso, senão começar. */
export function acaoDaPlaca(estado) {
  return estado === ESTADOS.EM_CURSO ? placa.continuar : placa.comecarEstudar;
}

/**
 * DE ONDE VEIO O RECURSO (fatia 2d-1, JORNADA §2.3: "a pessoa desiste se o
 * recurso abrir sem dizer de onde veio").
 *
 * Nada é inventado: a frase sai do `resourceType` e do domínio de `resourceUrl`
 * DO CATÁLOGO. O que a fonte não diz, a tela não diz — por isso a função devolve
 * `null` (e o desenho não mostra nada) quando nem tipo nem site são conhecidos.
 *
 * Esta tabela é o dicionário host → nome pelo qual a pessoa chama o lugar. Não é
 * texto de tela: é a tradução de um nome próprio que já está no endereço, e por
 * isso mora ao lado da regra que lê o endereço. As FRASES (com a preposição, o
 * artigo, o "no") estão em core/textos.js, onde todo texto deste arquivo mora.
 */
export const ORIGEM_DE_SITE = new Map(Object.entries(Object.freeze({
  'youtube.com': 'YouTube',
  'khanacademy.org': 'Khan Academy',
  'coursera.org': 'Coursera',
  'edx.org': 'edX',
  'udemy.com': 'Udemy',
  'escolavirtual.gov.br': 'Escola Virtual',
  'cursoemvideo.com': 'Curso em Vídeo',
  'univesp.br': 'UNIVESP',
  'github.com': 'GitHub',
  '4linux.com.br': '4Linux',
  'solyd.com.br': 'Solyd',
  'eucapacito.com.br': 'Eu Capacito',
  'elastic.co': 'Elastic',
  'microfocus.com': 'Micro Focus',
  'nova8.com.br': 'Nova',
  'acaditi.com.br': 'Acaditi',
  'hackaflag.com.br': 'HackaFlag',
  'convisoappsec.com': 'Conviso'
})));

/** O domínio cru do endereço, sem o `www` que nenhuma pessoa fala. */
export function hostDoRecurso(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let host = null;
  try {
    host = new URL(url).hostname;
  } catch {
    return null; // endereço quebrado: a tela não adivinha de onde veio
  }
  const semWww = host.replace(/^www\./i, '');
  return semWww || null;
}

/** O nome pelo qual a pessoa conhece aquele domínio. Desconhecido = null. */
export function dominioLegivel(host) {
  if (typeof host !== 'string' || !host) return null;
  const alvo = host.toLowerCase().replace(/^www\./, '');
  for (const [chave, nome] of ORIGEM_DE_SITE) {
    if (alvo === chave || alvo.endsWith(`.${chave}`)) return nome;
  }
  return null;
}

/**
 * A frase de origem, montada pelo texto do núcleo a partir do que o catálogo diz.
 * `null` é resposta legítima: sem tipo conhecido e sem site conhecido, a tela
 * cala — é o que a regra "nada inventado" exige.
 */
export function origemDoRecurso(curso) {
  if (!curso) return null;
  const nomeDoTipo = TIPO_DE_ORIGEM[curso.resourceType];
  const fazer = nomeDoTipo ? ORIGEM[nomeDoTipo] : null;
  const site = dominioLegivel(hostDoRecurso(curso.resourceUrl));
  if (fazer) return fazer(site);
  return site ? ORIGEM.somenteSite(site) : null;
}

/**
 * O AVISO DA CHEGADA (fatia 2d-1, JORNADA §2.5: quem conclui "quer saber o que o
 * gesto dela destrancou"). É montagem de texto puro: nomes, números e o par de
 * baldeação vêm do núcleo (`abreComBaldeacao`), e as frases vêm de textos.js.
 * A tela não decide nada aqui — o que decide está em core/viagem.js, e o teste
 * de mutação não deixa o desenho chamar outra coisa.
 */
export function textoDaChegada({ titulo, concluidas, total, linha = null, abre = [], baldeacao = null }) {
  const partes = [`${placa.concluida} ${titulo}`];
  const lista = (Array.isArray(abre) ? abre : []).filter((c) => c && c.titulo);
  const n = Number(linha);
  const propria = Number.isFinite(n) && n > 0 ? n : null;
  // FATIA 2d-2, item 0 (JORNADA §2.5): abrir estação da MESMA linha é destrancar;
  // abrir estação de OUTRA linha é BALDEAÇÃO, e a tela nomeia a linha de destino.
  // Sem `linha` (a estação concluída não tem linha conhecida) a tela não afirma
  // nenhuma travessia: tudo sai como destrancamento, como na 2d-1.
  const aqui = [];
  const la = new Map();
  for (const c of lista) {
    const destino = Number(c.linha);
    const temNumero = Number.isFinite(destino) && destino > 0;
    if (propria === null || !temNumero || destino === propria) { aqui.push(c.titulo); continue; }
    if (!la.has(destino)) la.set(destino, []);
    la.get(destino).push(c.titulo);
  }
  if (aqui.length > 0) partes.push(comValores.destrancou(aqui.join(', ')));
  for (const [numero, nomes] of [...la.entries()].sort((a, b) => a[0] - b[0])) {
    partes.push(comValores.baldeacao(nomes.join(', '), numero));
  }
  // O PAR de baldeação que se FORMOU (§3.2, já concluído dos dois lados) é a
  // baldeação feita. Se a estação já saiu nomeada acima, não sai duas vezes.
  const para = baldeacao?.para;
  if (para?.titulo && !lista.some((c) => c.id === para.id)) {
    partes.push(comValores.baldeacao(para.titulo, para.linha));
  }
  partes.push(comValores.viagem(concluidas, total));
  return partes.join(' · ');
}

/**
 * Item 6 da crítica (2b-2): o arquivo da bibliografia mora na FONTE, não aqui.
 * O caminho é transcrito do snapshot (extras/bibliography/…), e o endereço que
 * a pessoa abre é o daquele snapshot: b995c11, o SHA auditado em CREDITS.md.
 * Nunca "main" — main muda embaixo do catálogo que o Atlas copiou, e a pessoa
 * leria uma bibliografia que não é a que originou a grade dele.
 */
const FONTE_SHA = 'b995c11';
const FONTE_REPO = 'https://github.com/Universidade-Livre/ciencia-da-computacao';
export function naFonte(caminho) {
  return `${FONTE_REPO}/blob/${FONTE_SHA}/${String(caminho).replace(/^\/+/, '')}`;
}

/** Texto do que falta, pelo NOME — nunca id, nunca caminho. */
export function textoDoQueFalta(estacao) {
  const nomes = (estacao?.faltam || []).map((f) => f.titulo);
  if (estacao?.ciclo) return estados.ramalEmObras.descricao;
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return comValores.trancadaFalta(nomes[0]);
  return comValores.trancadaFaltam(nomes.join(', '));
}

/**
 * O catálogo com a anotação da pessoa dentro de cada disciplina. É a ÚNICA
 * ponte entre `ui.notas` (onde o texto mora) e `folha` (onde o campo é desenhado):
 * sem ela, o que foi escrito voltava vazio no redesenho seguinte — a pessoa
 * digitava, a tela apagava (fatia 2c-3, item 5 da crítica).
 */
export function comNotas(catalogo, notas) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const porId = new Map(Object.entries(notas || {}));
  return lista.map((c) => (c && porId.has(c.id) ? { ...c, nota: porId.get(c.id) } : c));
}

/** Estações de uma linha, na ordem da fonte. */
export function estacoesDaLinha(catalogo, linha) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  return lista.filter((c) => c && Number(c.stage) === Number(linha));
}

/**
 * O que o embarque oferece marcar de uma vez: a primeira estação AINDA NÃO
 * CONCLUÍDA de cada linha (JORNADA §2.2 — "marcar muita coisa rápido, sem um
 * clique por estação"; "desiste se o modo em lote não existir").
 *
 * Pré-requisito NÃO trava aqui, de propósito: o embarque é a palavra da pessoa
 * sobre o que ela já estudou, e é o núcleo quem reajusta a rede depois. Exigir
 * estação destrancada obrigaria abrir uma disciplina por marcação — exatamente o
 * terceiro clique que faz o perfil B ir embora. Linha toda concluída não oferece
 * nada. Ordem do catálogo, uma estação por linha.
 */
function estacoesMarcaveis(catalogo, progresso) {
  const feitas = new Set(progresso.completed);
  const porLinha = new Map();
  for (const c of catalogo) {
    if (!c || typeof c.id !== 'string' || feitas.has(c.id)) continue;
    const n = Number(c.stage);
    if (!Number.isFinite(n)) continue; // estação sem linha não aparece
    if (!porLinha.has(n)) porLinha.set(n, c);
  }
  return [...porLinha.values()];
}

/** As linhas que existem no catálogo, em ordem. */
export function linhasDoCatalogo(catalogo) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const linhas = new Set();
  for (const c of lista) if (c && Number.isFinite(Number(c.stage))) linhas.add(Number(c.stage));
  return [...linhas].sort((a, b) => a - b);
}

// ───────────────────────────────── DOM mínimo ─────────────────────────────────

/**
 * S4b (Movimento): quem desenha entrega o ÍNDICE da cascata, nunca uma
 * duração. Quem espaça é o CSS, com
 * `animation-delay: calc(var(--atraso-cascata) * var(--cascata-i))`, e com
 * movimento reduzido o token zera sozinho — por isso não há um segundo caminho
 * de "sem animação" escrito à mão aqui. O índice para no 5: depois do sexto
 * item a lista chega junta, senão a pessoa espera a tela acabar de aparecer.
 */
function cascata(no, i) {
  if (!no || typeof no.setAttribute !== 'function') return no;
  no.className = `${no.className} cascata`.trim();
  no.setAttribute('style', `--cascata-i: ${Math.min(5, Math.max(0, i))}`);
  return no;
}

/**
 * S4b: a linha de apoio do cartão, a palavra pequena debaixo do estado.
 * Trancada diz o que FALTA, pelo nome; concluída carimba a data que o núcleo
 * guarda, no formato do Brasil. Os outros dois estados não têm apoio: a forma
 * do círculo e o rótulo já disseram tudo, e linha de baixo sem informação é
 * ruído. Nada aqui consulta pré-requisito — `e.faltam` vem do núcleo.
 */
export function apoioDoCartao(e, datas) {
  if (!e) return '';
  if (e.estado === ESTADOS.TRANCADA) {
    const nomes = (Array.isArray(e.faltam) ? e.faltam : [])
      .map((f) => (typeof f === 'string' ? f : f?.titulo))
      .filter(Boolean);
    if (!nomes.length) return '';
    return comValores.apoioFalta(nomes);
  }
  if (e.estado === ESTADOS.CONCLUIDA) {
    const data = datas?.[e.id];
    return data ? comValores.concluidaEm(data) : '';
  }
  return '';
}

function el(doc, tag, className, attrs) {
  const no = doc.createElement(tag);
  if (className) no.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') no.textContent = String(v);
    else no.setAttribute(k, String(v));
  }
  return no;
}

/**
 * Tira um nó do pai. No navegador é o `remove()` nativo; no mini-DOM do teste
 * é desmontar a lista de filhos — as duas rotas, porque a chegada tem de sair
 * do ar sem redesenhar a linha inteira.
 */
function remover(no) {
  if (typeof no.remove === 'function') { no.remove(); return; }
  const pai = no.parent;
  if (!pai) return;
  const i = pai.children.indexOf(no);
  if (i >= 0) pai.children.splice(i, 1);
  no.parent = null;
}

/** Selo da linha: o número dentro do círculo, na cor da linha.
 *
 * `tag` existe por causa da S2 da v2 (31/10/2026, defeito 2): o seletor das 7
 * linhas era `<span type="button">` — um `span` aceita qualquer atributo,
 * inclusive os de botão, e isso engana quem lê o HTML e não engana o navegador
 * nenhum. O alvo aqui é clicável de verdade, então é `<button>`; o selo da
 * placa, que é só desenho ao lado do nome, continua `span`. */
export function selo(doc, linha, attrs, tag = 'span') {
  const n = Number(linha);
  return el(doc, tag, `selo l${n}`, {
    text: Number.isFinite(n) ? String(n) : '—',
    ...attrs
  });
}

// ─────────────────────────────── 5a. esqueleto ───────────────────────────────

/**
 * Esqueleto de carregamento: PARADO, sem brilho correndo, e o CSS só o mostra
 * depois de --atraso-esqueleto (150 ms). Quem desenha não decide o atraso —
 * decidir aqui seria ter dois relógios para a mesma espera.
 */
export function desenharEsqueleto(doc, root) {
  limpar(doc, root);
  root.setAttribute('aria-busy', 'true');
  const box = el(doc, 'div', 'esqueleto');
  // S4b "Carregando": uma placa cinza PARADA no lugar da placa. Sem sombra —
  // sombra é a placa de verdade, e um esqueleto que projeta ensina a pessoa a
  // olhar para o sítio errado quando o conteúdo chega. Sem animação também: o
  // bloco do fim do arquivo já desliga tudo, e pulso em esqueleto é spinner.
  box.append(el(doc, 'div', 'esqueleto-placa'));
  box.append(el(doc, 'div', 'esqueleto-titulo'));
  for (let i = 0; i < 5; i += 1) {
    const linha = el(doc, 'div', 'esqueleto-linha');
    linha.append(el(doc, 'span', 'esqueleto-circulo'), el(doc, 'span', 'esqueleto-traco'));
    box.append(linha);
  }
  root.append(box);
  return box;
}

function limpar(doc, root) {
  // `textContent = ''` esvazia o root de VERDADE só no navegador. No mini-DOM
  // do teste é um setter simples, que deixa os filhos órfãos pendurados no nó:
  // o aviso velho continuava dentro do root e a linha saía com 4 nós depois do
  // temporizador (o defeito que a fatia 2c tinha de resolver). Desmontar é o
  // jeito honesto em qualquer um dos dois mundos.
  for (const filho of [...root.children]) remover(filho);
  root.setAttribute('aria-busy', 'false');
}

// ─────────────────────────────── a tela ───────────────────────────────

/**
 * Desenha o coração do app: a placa da próxima estação, o seletor das 7 linhas e
 * a linha escolhida na vertical.
 *
 * @param {Document} doc
 * @param {HTMLElement} root
 * @param {{catalogo:Array, completed:string[], progresso:object, linha:number,
 *          folha:string|null, despertas?:string[]}} estado
 * @returns {object} os nós que o teste e o bind procuram
 */
export function desenharMetro(doc, root, estado) {
  const catalogo = Array.isArray(estado.catalogo) ? estado.catalogo : [];
  const progresso = lerProgresso(estado.progresso);
  const resumo = resumoDaViagem(progresso, catalogo);
  const linhas = linhasDoCatalogo(catalogo);
  const linha = linhas.includes(Number(estado.linha))
    ? Number(estado.linha)
    : (resumo.proximaEstacao?.linha ?? linhas[0] ?? 1);
  const despertas = new Set(Array.isArray(estado.despertas) ? estado.despertas : []);

  limpar(doc, root);
  // S4b, UM primário por TELA (a 2d-2 já dava um por folha): quando uma folha
  // está aberta, é ela que tem o botão cheio — o recurso — e a ação da placa
  // cede o recheio pelo estado da raiz. O CSS decide a forma; aqui só se declara
  // "existe folha aberta NESTA linha", que é o que a pessoa está vendo.
  // S5 parte 2: a folha não mora mais NESTE diagrama — ela é rota
  // (#/estacao/<slug>) e o casco entrega o slug pedido. «Existe folha aberta»
  // deixou de ser uma pergunta sobre a linha desenhada e passou a ser sobre a
  // tela inteira, que é o que a pessoa vê: com o painel à direita no
  // computador, a folha pode ser de outra linha sem sumir do mapa.
  const slugDaFolha = typeof estado.folha === 'string' && estado.folha ? estado.folha : null;
  root.className = `metro l${linha}${slugDaFolha ? ' com-folha' : ''}`;

  const nos = { linha, resumo, placas: null, seletor: null, diagrama: null, aviso: null, embarque: null };

  // CHEGADA SEM RESENHO (fatia 2c-1, item 3 da crítica): o círculo que enche e o
  // trecho que marca recebem a classe `chegada` no desenho NORMAL — a cor cheia
  // que o estado deles já dá — e o temporizador só TIRA essa classe, mexendo
  // nestes nós no lugar. Guardo os nós para o boot ter o que esconder.
  const chegadaId = estado.chegada?.id ?? null;
  const formasDeChegada = [];
  const tracosDeChegada = [];
  let aviso = null;
  let desfazer = null;

  // ── 0. a marca ──────────────────────────────────────────────────────────
  // Item 4 da crítica (2b-2): antes de qualquer placa, quem é este lugar.
  // "Atlas" + a linha do curso, nos dois degraus da escala tipográfica.
  // S2, item 7: DIV, não HEADER — o cabeçalho do app é o <header class="topo"> do
  // HTML, e um segundo header é a tela se apresentando duas vezes. E o nome "Atlas"
  // sai: ele já está no logo do topo; fica só a linha do curso, que rotula a tela.
  const marca = el(doc, 'div', 'marca');
  marca.append(el(doc, 'p', 'marca-linha', { text: placa.marcaLinha }));
  root.append(marca);
  nos.marca = marca;

  // ── 0b. a ABERTURA (S4a, JORNADA 1.1) ───────────────────────────────────
  // É a PEÇA 1 das três da Jornada, e vem ANTES da placa porque é ela que
  // responde "o que é isto". As três peças moram em web/telas/jornada-blocos.js:
  // este arquivo tem 932 linhas, e a regra 15 manda dividir pela responsabilidade
  // em vez de engordar. Aqui só se chama.
  const primeiraVisita = resumo.concluidas === 0 && resumo.emCurso === 0;
  root.append(cascata(abertura(doc, {
    resumo,
    primeiraVisita,
    estacoes: resumo.estacoes,
    linhas: totalDeLinhas(catalogo)
  }), 0));

  // ── 1. a placa ──────────────────────────────────────────────────────────
  const proxima = resumo.proximaEstacao
    ? estadoDaEstacao(resumo.proximaEstacao.id, progresso, catalogo)
    : null;
  const cartao = el(doc, 'section', 'placa');
  cartao.append(el(doc, 'p', 'placa-rotulo', {
    // S4b: quem já está dentro de uma estação não está olhando para a próxima
    // — está continuando. É o mesmo par estado/verbo do `acaoDaPlaca` de baixo.
    text: proxima?.estado === ESTADOS.EM_CURSO ? placa.continueOndeParou : placa.proximaEstacao
  }));

  if (proxima) {
    const cabeca = el(doc, 'div', 'placa-cabeca');
    cabeca.append(selo(doc, proxima.linha, { 'aria-hidden': 'true' }));
    cabeca.append(el(doc, 'p', 'placa-linha', { text: comValores.linha(proxima.linha) }));
    cartao.append(cabeca);
    cartao.append(el(doc, 'p', 'placa-nome', { text: proxima.titulo }));
    // S4b: "Linha 2 · estação 3 de 5". A posição sai da ordem da fonte dentro
    // da linha dela (estacoesDaLinha, o mesmo caminho que desenha o diagrama),
    // nunca de um índice de array que a tela inventou.
    const naLinha = estacoesDaLinha(catalogo, proxima.linha);
    const emQue = naLinha.findIndex((c) => c && c.id === proxima.id);
    if (emQue >= 0) {
      cartao.append(el(doc, 'p', 'placa-posicao', {
        text: comValores.posicaoNaLinha(proxima.linha, emQue + 1, naLinha.length)
      }));
    }
    cartao.append(el(doc, 'p', 'placa-contador', {
      text: comValores.viagem(resumo.concluidas, resumo.estacoes)
    }));

    const curso = catalogo.find((c) => c && c.id === proxima.id);
    const acao = el(doc, proxima.estado === ESTADOS.EM_CURSO ? 'button' : 'a', 'placa-acao', {
      'data-acao-placa': proxima.id,
      text: acaoDaPlaca(proxima.estado)
    });
    if (proxima.estado !== ESTADOS.EM_CURSO && curso?.resourceUrl) {
      acao.setAttribute('href', curso.resourceUrl);
      acao.setAttribute('rel', 'noopener');
      acao.setAttribute('target', '_blank');
    }
    cartao.append(acao);
    nos.placaAcao = acao;
    // FATIA 2d-1 (JORNADA §2.3): o botão abre um site lá fora, e abrir no escuro
    // S4b: a nota abaixo da ação. Abrir é grátis — o que escreve na viagem é a
    // conclusão, e ela continua sendo decisão da pessoa.
    cartao.append(el(doc, 'p', 'placa-nota', { text: placa.notaAbrir }));
    // é motivo de desistência. A linha embaixo da ação diz de onde o recurso
    // veio, com a MESMA palavra da folha — uma origem por tela, não duas.
    const origemPlaca = origemDoRecurso(proxima.estado === ESTADOS.EM_CURSO ? null : curso);
    if (origemPlaca) {
      cartao.append(el(doc, 'p', 'placa-origem', { text: origemPlaca }));
    }
  } else {
    // Terminal, ou catálogo sem estação: a placa diz o estado em vez de mentir.
    cartao.append(el(doc, 'p', 'placa-nome', {
      text: resumo.terminal ? estados.terminal.titulo : estados.ramalEmObras.titulo
    }));
    cartao.append(el(doc, 'p', 'placa-vazia', {
      text: resumo.terminal ? estados.terminal.descricao : estados.ramalEmObras.descricao
    }));
    cartao.append(el(doc, 'p', 'placa-contador', {
      text: comValores.viagem(resumo.concluidas, resumo.estacoes)
    }));
  }
  // S4b: a placa, os números e a próxima conexão formam a COLUNA DA DIREITA no
  // computador. Elas já eram três irmãos seguidos no DOM — embrulhá-las não
  // muda a ordem de leitura no celular, que é a da S4a, e é o que permite o
  // `position: sticky` na lateral inteira em vez de três sticky que brigam.
  const lateral = el(doc, 'div', 'lateral');
  lateral.append(cascata(cartao, 1));
  root.append(lateral);
  nos.lateral = lateral;
  nos.placas = cartao;

  // S4b: a COLUNA DO MAPA — embarque, seletor das 7 linhas, diagrama e aviso.
  // No celular ela vem depois da lateral, na ordem da S4a (o DOM é a ordem de
  // leitura); no computador as áreas nomeadas do grid é que a põem embaixo da
  // abertura, à esquerda da lateral, sem mexer no DOM um centímetro.
  const mapa = el(doc, 'div', 'mapa');
  root.append(mapa);
  nos.mapa = mapa;

  // ── 1b. os TRÊS NÚMEROS e a PRÓXIMA CONEXÃO (S4a) ──────────────────────
  // Depois da placa, na ordem da fatia. No Terminal os dois não aparecem: vale o
  // `terminal` de textos.js, que a placa já desenha, e "35/35" ao lado de "próxima
  // conexão" de nada seria a tela insistindo num número que já não quer dizer
  // nada. Os números vêm do núcleo (numerosDaJornada), nunca contados aqui.
  if (!resumo.terminal) {
    const n = numerosDaJornada(progresso, catalogo);
    lateral.append(cascata(tresNumeros(doc, {
      carimbos: n.carimbos,
      total: resumo.estacoes,
      emCurso: n.emCurso,
      abertas: n.linhasAbertas,
      linhas: totalDeLinhas(catalogo)
    }), 2));
    const conn = conexao(doc, { progresso, catalogo, resumo });
    if (conn) lateral.append(cascata(conn, 3));
  }

  // ── 5b. embarque (fatia 2c-2) ────────────────────────────────────────────
  // Aparece sozinho na primeira visita (0 concluídas) e fica enquanto a lista
  // estiver ABERTA: é o modo de marcação em lote, não um banner perpétuo.
  // Fechar a lista — ou marcar, que fecha — devolve a tela a quem já viajou.
  if (catalogo.length > 0 && (estado.embarqueAberto || resumo.concluidas === 0)) {
    const emb = el(doc, 'section', 'embarque');
    emb.append(el(doc, 'h2', 'embarque-titulo', { text: estados.primeiraVisita.titulo }));
    emb.append(el(doc, 'p', 'embarque-texto', { text: estados.primeiraVisita.descricao }));
    emb.append(el(doc, 'p', 'embarque-acao', { text: estados.primeiraVisita.acao }));
    const abrir = el(doc, 'button', 'botao', {
      type: 'button', 'data-embarque': 'abrir', text: estados.primeiraVisita.botao,
      'aria-expanded': estado.embarqueAberto ? 'true' : 'false'
    });
    emb.append(abrir);

    if (estado.embarqueAberto) {
      // "Marcar de uma vez o que já estudei": uma estação por linha, e o verbo
      // de concluir é o do núcleo (datas, marcos, tudo) — aqui só o
      // botão. Nunca um segundo jeito de concluir na tela.
      const lista = el(doc, 'ul', 'lista-marcar');
      for (const c of estacoesMarcaveis(catalogo, progresso)) {
        const nome = typeof c.title === 'string' ? c.title : c.id;
        const item = el(doc, 'li');
        item.append(el(doc, 'span', 'marcar-nome', { text: nome }));
        item.append(el(doc, 'button', 'botao', {
          type: 'button', 'data-marcar': c.id,
          'aria-label': `${placa.marcar} — ${nome}`,
          text: placa.marcar
        }));
        lista.append(item);
      }
      emb.append(lista);
    }
    mapa.append(emb);
    nos.embarque = emb;
  }

  // ── 3. o seletor das 7 linhas ───────────────────────────────────────────
  const nav = el(doc, 'nav', 'linhas', { 'aria-label': placa.comoLerMapa });
  nav.setAttribute('aria-label', 'Linhas');
  for (const n of linhas) {
    const atual = n === linha;
    // S2 da v2 (31/10/2026), defeito 2: isto era um <span type="button">. Um
    // span aceita o atributo e o navegador ignora: o Tab passava por cima das
    // 7 linhas, Enter e Espaço não faziam nada e o leitor de tela não anunciava
    // nada. É <button> de verdade agora — e o click continua chegando pela
    // mesma delegação de antes, porque um botão gera click sozinho.
    //
    // aria-current saiu: ele diz "este link é a página atual" num caminho de
    // navegação. Aqui a pessoa ESCOLHE qual linha ver, e o atributo de um botão
    // que se liga é aria-pressed — com "false" nas outras 6, para o leitor de
    // tela dizer que são alternáveis e qual está ligada.
    const botao = selo(doc, n, {
      type: 'button',
      'data-linha': String(n),
      'aria-label': comValores.linha(n),
      'aria-pressed': atual ? 'true' : 'false',
      title: comValores.linha(n)
    }, 'button');
    nav.append(botao);
  }
  mapa.append(nav);
  nos.seletor = nav;

  // ── 2. a linha na vertical, como o diagrama da porta do trem ────────────
  const diagrama = el(doc, 'ol', 'diagrama');
  const paradas = estacoesDaLinha(catalogo, linha);
  // 2d-2: o carimbo da folha lê a data que O NÚCLEO guarda em `conclusoes`.
  const datas = lerProgresso(progresso).conclusoes;
  let percorrido = false; // o trecho ANTES desta estação já foi percorrido?
  for (const c of paradas) {
    const e = estadoDaEstacao(c.id, progresso, catalogo) || {
      id: c.id, titulo: c.id, linha, estado: ESTADOS.TRANCADA, faltam: [], ciclo: false
    };
    const parada = el(doc, 'li', `parada l${linha}`);

    const chegouAgora = chegadaId === e.id;
    const coluna = el(doc, 'div', 'trilho-col');
    // O trecho que a chegada marca é o que LEVA até ela: o superior. Na primeira
    // estação da linha ele é transparente por regra do CSS (não há nada acima),
    // e a classe chegada não inventa um traço que não existe.
    const superior = el(doc, 'span', `trilho trilho-superior${percorrido ? ' percorrido' : ''}${chegouAgora ? ' chegada' : ''}`);
    if (chegouAgora) tracosDeChegada.push(superior);
    coluna.append(superior);
    const ehProxima = proxima && proxima.id === e.id;
    const forma = el(doc, 'span', [
      'forma', e.estado.replace('_', '-'),
      ehProxima ? 'proxima' : '', despertas.has(e.id) ? 'desperta' : '',
      chegouAgora ? 'chegada' : ''
    ].filter(Boolean).join(' '));
    if (chegouAgora) formasDeChegada.push(forma);
    coluna.append(forma);
    const feito = e.estado === ESTADOS.CONCLUIDA;
    coluna.append(el(doc, 'span', `trilho trilho-inferior${feito ? ' percorrido' : ''}`));
    parada.append(coluna);

    // S5 parte 2: o cartão é LINK, não botão. Abrir uma estação é IR A uma
    // rota (#/estacao/<slug>), e um link já faz isso sozinho — com histórico
    // para o "voltar" do navegador, com "abrir em outra aba" e com a palavra
    // certa no leitor de tela. O `aria-expanded`/`aria-controls` de antes
    // descrevia um painel dentro da lista; a folha agora é `role="dialog"`
    // fora dela, e o botão do trilho não promete expandir nada.
    const botao = el(doc, 'a', `estacao ${e.estado}`, {
      href: hrefDe({ tela: 'estacao', slug: c.slug || c.id }),
      'data-id': e.id,
      'aria-label': rotuloEstacao(e, linha)
    });
    botao.append(el(doc, 'span', 'estacao-nome', { text: e.titulo }));
    botao.append(el(doc, 'span', 'estacao-estado', { text: ESTADO_LEGIVEL[e.estado] }));
    // S4b: a linha de apoio do cartão. Trancada diz o que falta pelo nome;
    // concluída carimba a data do núcleo. Sem apoio nos outros estados, porque
    // ali a frase não acrescentaria nada que a pessoa ainda não veja.
    const apoio = apoioDoCartao(e, datas);
    if (apoio) botao.append(el(doc, 'span', 'estacao-apoio', { text: apoio }));
    parada.append(botao);
    diagrama.append(parada);
    percorrido = feito;
  }
  mapa.append(diagrama);
  nos.diagrama = diagrama;

  // ── 4. o aviso da chegada, com o desfazer ───────────────────────────────
  //
  // CHEGADA (fatia 2c-1). O aviso só existe enquanto a chegada está visível, e
  // quando a janela vence ele sai SEM redesenhar a linha: esconderAviso() mexe
  // neste nó no lugar. As duas travas estão em metro.test.js: dois nós dentro do
  // aviso (texto + desfazer) e a linha com exatamente dois `data-id` depois do
  // desfazer — um aviso que se empilha a cada pintura faria quatro.
  if (chegadaId) {
    // FATIA 2d-1 (JORNADA §2.5): \"Concluída.\" sozinha é o gesto sem o
    // resultado. O aviso diz QUAL estação, O QUE ela abriu pelo nome (inclusive a
    // baldeação, quando o par se formou agora) e o contador. O que abriu vem do
    // núcleo (abreComBaldeacao, no gesto) e as frases de textos.js — aqui só se
    // monta. Sem informação nenhuma no estado, textoDaChegada devolve a frase
    // curta de sempre, e o aviso não inventa destravamento.
    const chegou = estadoDaEstacao(chegadaId, progresso, catalogo);
    aviso = el(doc, 'div', 'aviso-chegada', { role: 'status' });
    desfazer = el(doc, 'button', 'desfazer', {
      type: 'button', 'data-desfazer': chegadaId, text: placa.desfazer
    });
    aviso.append(el(doc, 'span', 'aviso-texto', {
      text: textoDaChegada({
        titulo: chegou?.titulo || '',
        concluidas: resumo.concluidas,
        total: resumo.estacoes,
        linha: chegou?.linha,
        abre: estado.chegada.abre,
        baldeacao: estado.chegada.baldeacao
      })
    }));
    aviso.append(desfazer);
    // S4b: o aviso é da coluna do mapa, porque ele fala do trecho que acabou de
    // encher — a chegada aparece ao lado do lugar que mudou, não em cima da
    // placa que já disse outra coisa.
    mapa.append(aviso);
    nos.aviso = aviso;
  }
  nos.chegada = { aviso, desfazer, formas: formasDeChegada, tracos: tracosDeChegada };

  // ── 4. a FOLHA (S5 parte 2): o painel da rota, irmão do mapa ────────────
  // Ela é desenhada AQUI porque é a tela da Jornada que a mostra, e o desenho
  // inteiro vem de web/folha.js — este arquivo não sabe o que há numa folha,
  // só onde ela entra. Sem rota de estação, nada de painel: a jornada é o mapa.
  if (slugDaFolha) {
    const desenhada = desenharFolha(doc, {
      catalogo, progresso, slug: slugDaFolha, notas: estado.notas || {},
      // S6: o miolo da folha troca pelo momento enquanto ele está de pé.
      momento: estado.momento || null
    });
    root.append(desenhada.root);
    nos.folha = desenhada.root;
    nos.estacaoId = desenhada.estacaoId;
  }

  return nos;
}

// ──────────────────── foco da folha (S10, item 3, régua 4) ────────────────────

// O que a folha ainda não é, e esta fatia escreve: o painel abre e fecha, mas o
// teclado escapa dele e o foco se perde quando ele se fecha. Os dois defeitos
// são do mesmo tamanho dos que este arquivo já conta nos comentários — a 2c
// perdeu o `focus()` que a 2b tinha escrito, e a régua 4 da auditoria (03/11)
// achou a prenda inteira, faltando nas duas pontas. O navegador não faz nenhum
// dos dois sozinho: a folha é um `<div role="dialog">` irmão do mapa, não um
// `<dialog>` nativo, e a rota remonta a tela inteira quando ela fecha.
//
// A memória do gatilho é VARIÁVEL DE MÓDULO, não campo de `ui`, por causa disso:
// fechar é navegar para `#/` (regra da S5 parte 2) e a navegação mata a
// instância que abriu. Um registro dentro de `ui` morreria com ela, e o foco não
// teria para onde voltar. Vive aqui, e só o FECHAR a arma — abrir a folha por
// deep-link não rouba o foco de ninguém.
const FOCAVEL_POR_TAG = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);
let gatilhoDaFolha = null;
let devolverAposFechar = false;

/** Os focáveis do painel, na ordem do documento. O véu fica fora: não recebe foco. */
export function focaveisDaFolha(painel) {
  const saida = [];
  const ande = (no) => {
    for (const f of no.children || []) {
      const alcancaTab = FOCAVEL_POR_TAG.has(f.tag) && (f.tag !== 'a' || f.getAttribute('href') !== null);
      if (alcancaTab && f.disabled !== true) saida.push(f);
      ande(f);
    }
  };
  ande(painel);
  return saida;
}

/**
 * Tab nas bordas do painel: no meio, deixa o navegador andar sozinho (um só
 * dono do Tab, a regra de sempre); na primeira e na última posição, prende.
 * Devolve true quando interceptou. O `blur()` antes do `focus()` existe para o
 * mesmo motivo do `blur` no casco: num dublê sem ele, quem ainda se diz focado
 * é o nó antigo, e a devolução da régua 4 leria o foco errado.
 */
export function prendaDeFoco(evento, { doc, painel, ativo }) {
  const lista = focaveisDaFolha(painel);
  if (lista.length < 2) return false;
  const pos = lista.indexOf(ativo);
  if (pos < 0) return false;
  const naBorda = evento.shiftKey ? pos === 0 : pos === lista.length - 1;
  if (!naBorda) return false;
  const destino = evento.shiftKey
    ? lista[(pos - 1 + lista.length) % lista.length]
    : lista[(pos + 1) % lista.length];
  evento.preventDefault?.();
  if (doc && doc.activeElement === ativo) ativo.blur?.();
  destino.focus?.();
  return true;
}

/** O cartão que abriu a folha, na tela já remontada. `null` se ele não está mais ali. */
export function cartaoDoGatilho(root, memoria) {
  if (!memoria) return null;
  // Array.from porque no navegador querySelectorAll devolve NodeList, que não
  // tem .find; o mini-DOM devolve array. Os dois mundos, a mesma pergunta.
  const cartoes = [...root.querySelectorAll('a')];
  return cartoes.find((a) => a.getAttribute('data-id') === memoria.id) || null;
}

/** Fecha a folha de verdade: arma a devolução e navega. Chamado pelo Esc, pelo véu e pelo Fechar. */
function fecharFolha(ui, irPara) {
  if (!ui.folha) return;
  devolverAposFechar = true;
  irPara('#/');
}

// ─────────────────────────────── comportamento ───────────────────────────────

/**
 * Liga os toques às ações. `handlers` recebe o mesmo contrato de boot.js:
 * concluir, desfazer, marcar, abrirLinha, abrirEstacao, anotar. Quem decide o
 * novo estado é quem chama — aqui só se traduz toque em intenção.
 */
export function bindMetro(doc, root, handlers) {
  const h = handlers || {};
  root.addEventListener('click', (evento) => {
    const alvo = evento.target;
    if (!alvo || typeof alvo.closest !== 'function') return;

    // S10 régua 4: abrir a folha continua sendo o `href` do cartão, e nada aqui
    // muda isso — só se MEMORA quem abriu, para o foco voltar ao mesmo cartão
    // quando a folha fechar. Um segundo caminho para o mesmo gesto é a regra que
    // já tirou o `aria-pressed` do seletor e o `abrirEstacao` do bind.
    // `data-id` sem href NÃO é o cartão: é o círculo do diagrama, que não leva a
    // parte alguma, e memorizá-lo faria o fechar devolver o foco a um nó que
    // sempre esteve atrás da folha.
    // `closest('a')` e não `closest('a[href]')`: o seletor de atributo com valor
    // vazio não é o que o mini-DOM dos testes resolve, e um seletor que o dublê
    // não casa é um registro que morre em silêncio no node e funciona no navegador
    // — o pior tipo de verde. A pergunta (é um LINK com href?) é feita na linha seguinte,
    // dos dois lados, com a mesma resposta.
    const cartao = alvo.closest('a');
    if (cartao && cartao.getAttribute('href') !== null && cartao.getAttribute('data-id') !== null) {
      gatilhoDaFolha = { id: cartao.getAttribute('data-id') };
    }

    const desfazer = alvo.closest('[data-desfazer]');
    if (desfazer) { h.desfazer?.(desfazer.getAttribute('data-desfazer')); return; }

    const concluir = alvo.closest('[data-concluir]');
    if (concluir && !concluir.disabled) { h.concluir?.(concluir.getAttribute('data-concluir')); return; }

    const marcar = alvo.closest('[data-marcar]');
    if (marcar) { h.marcar?.(marcar.getAttribute('data-marcar')); return; }

    const embarque = alvo.closest('[data-embarque]');
    if (embarque) { h.embarque?.(); return; }

    // "Começar a estudar" marca em curso (e o recurso abre pelo href do link).
    const acaoPlaca = alvo.closest('[data-acao-placa]');
    if (acaoPlaca) { h.iniciar?.(acaoPlaca.getAttribute('data-acao-placa')); return; }

    const seloLinha = alvo.closest('[data-linha]');
    if (seloLinha) { h.abrirLinha?.(Number(seloLinha.getAttribute('data-linha'))); return; }

    // S5 parte 2: o `[data-id]` de antes chamava `abrirEstacao`, que mudava um
    // estado interno e redesenhava. Agora abrir é IR A uma rota, e o `<a
    // href="#/estacao/…">` do cartão já faz isso sozinho — um segundo caminho
    // para o mesmo gesto seria duas telas possíveis para o mesmo endereço.
    // Fica o FECHAR do véu, que não é link (div sem href): ele navega para '#/'.
    const fechar = alvo.closest('[data-fechar]');
    if (fechar) { evento.preventDefault?.(); h.fechar?.(); return; }
  });

  // S5 parte 2: ESC fecha a folha. O ouvinte é no root, a mesma delegação do
  // clique — a folha é redesenhada a cada pintura e um listener nela nasceria
  // morto no segundo redesenho. `fechar` é no-op sem rota (abaixo), então Esc
  // na tela do mapa não manda ninguém para lugar nenhum.
  root.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') { h.fechar?.(); return; }
    // S10 régua 4: o Tab circula DENTRO da folha aberta. Só quando ela existe,
    // e só nas duas bordas — no meio o navegador anda sozinho, porque
    // reimplementar a ordem do Tab é pedir para ela divergir do DOM. O listener
    // é no root pela mesma razão do Esc: a folha é remontada a cada pintura.
    if (evento.key !== 'Tab') return;
    const painel = root.querySelector('.folha');
    if (!painel) return;
    prendaDeFoco(evento, { doc, painel, ativo: doc.activeElement });
  });

  root.addEventListener('input', (evento) => {
    const campo = evento.target;
    if (!campo || typeof campo.getAttribute !== 'function') return;
    const id = campo.getAttribute('data-nota');
    if (id) h.anotar?.(id, campo.value);
  });
}

// ─────────────────────────────────── boot ───────────────────────────────────

/**
 * Sobe a tela. `deps` existe para o teste: sem ele, usa o documento e o
 * localStorage de verdade e o catálogo da fonte.
 */
export async function subirMetro(deps = {}) {
  // A lista é o CONTRATO com o main.js de verdade (30/10/2026): o metro.js pedia
  // applyNote e passava o storage na frente do saveNotas — nomes que o main.js
  // nunca exportou. No navegador dava TypeError a cada tecla; no teste passava
  // porque o dublê tinha os nomes inventados. metro.test.js agora confere esta
  // linha contra os exports reais, e o dublê é obrigado a ter as assinaturas de lá.
  const { loadCatalog, loadCompleted, saveCompleted, aplicarNota, loadNotas, saveNotas } =
    deps.modulos || await import('./main.js');
  const doc = deps.document || document;
  const storage = deps.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const root = deps.root || doc.getElementById('metro');
  const relogio = deps.setTimeout || setTimeout;
  // S5 parte 2: a FOLHA É ROTA, não estado interno da tela. Quem lê o endereço
  // é o casco (web/casco.js), que já observa o `hashchange` e remonta a tela
  // com o slug no contexto — por isso o metro.js NÃO liga um segundo listener:
  // dois donos do `hashchange` é a mesma regra que tirou o `aria-pressed` do
  // seletor (dois caminhos para o mesmo gesto). O `window` entra por deps só
  // para o FECHAR do véu navegar: um `<div>` não tem href, e fingir clique com
  // history.pushState criaria entrada fantasma no histórico.
  const win = deps.window || (typeof window !== 'undefined' ? window : null);

  const ui = {
    // O catálogo é GUARDADO já com as anotações dentro: é a única forma de o
    // redesenho achar o texto que a pessoa escreveu (fatia 2c-3).
    catalogo: comNotas([], loadNotas() || {}),
    notas: loadNotas() || {}, linha: null,
    embarqueAberto: false, chegada: null, momento: null, despertas: [], carregando: true,
    // S5 parte 2: `aberta` saiu junto com a folha, que agora é ROTA. O que a
    // pessoa está vendo vem do endereço e entra por `deps.folha` (o casco lê o
    // hash e entrega o slug). Guardar um `aberta` próprio seria ter duas fontes
    // para a mesma rota — e o "voltar" do navegador mostraria outra coisa.
    folha: typeof deps.folha === 'string' && deps.folha ? deps.folha : null
  };
  // O esqueleto é a PRIMEIRA PINTURA — ele é chamado logo abaixo, onde `pintar`
  // passa a existir, e antes de qualquer `await`.
  let progresso = carregarViagem(storage, loadCompleted());
  let janela = null; // o temporizador do "desfazer"

  // PINTAR NÃO LIGA (2c-1): o bind é UMA vez por root, antes da primeira
  // pintura, e `acoes` é um objeto estável. Chamar bindMetro dentro do pintar
  // empilhava um listener de clique por redesenho: no navegador o dispatch
  // ignora quem foi adicionado durante a própria rodada, então era um defeito
  // invisível; no mini-DOM do teste o `for…of` percorria a lista que crescia
  // dentro dele e o clique que redesenha nunca terminava. Delegação por
  // `closest` no root sobrevive ao redesenho dos filhos.
  // S10 régua 4: a folha é um diálogo, e um diálogo que abre sem levar o foco
  // deixa a pessoa teclando no mapa que ficou atrás dele. Por isso o entrar é
  // aqui, e só na TRANSAÇÃO (sem folha → com folha): pintar por pintar — o
  // concluir, o marcar, o anotar — não pode arrastar o foco de quem está
  // escrevendo. O sair é o espelho: `devolverAposFechar` foi armado pelo fechar
  // da instância anterior (variável de módulo, porque esta instância morreu no
  // meio do caminho) e só faz sentido na pintura que não tem mais painel.
  let folhaVisivel = false;
  // S11-0 (defeito 1, navegador real 03/11/2026): o CSS da folha existe desde a
  // S5 parte 1 (web/folha.css:48-57) e diz "o metro.js poe e tira" a classe
  // .aberta. Nenhum JS jamais pos. O estado parado do painel e translateY(100%),
  // ou seja, FORA da tela: tocar numa estacao escurecia o fundo (o veu existe) e
  // nao aparecia nada. S10 mediu o foco, o Tab e o Esc do painel -- todos
  // funcionam num elemento que esta a 100 px abaixo da janela, e o git
  // log -G"add\\(.aberta" esta vazio. A folha estava aberta no DOM e fechada na
  // tela de quem olhava.
  let slugAberto = null;

  const pintar = () => {
    if (ui.carregando) { desenharEsqueleto(doc, root); return; }
    const nos = desenharMetro(doc, root, {
      catalogo: ui.catalogo, progresso, linha: ui.linha, folha: ui.folha,
      notas: ui.notas,
      chegada: ui.chegada, despertas: ui.despertas, embarqueAberto: ui.embarqueAberto,
      // S6: o momento da chegada entra na folha pelo mesmo caminho do que a
      // chegada entra no mapa. Sem isto a folha conclui e não mostra nada.
      momento: ui.momento
    });

    // `folhaVisivel` é por INSTÂNCIA, `devolverAposFechar` é do MÓDULO: entre o
    // Esc e esta pintura houve uma troca de rota, e a instância que ouviu o Esc
    // não existe mais. Por isso o sair não pergunta «havia folha antes?» — o que
    // o autoriza a mover o foco é o fechar ter armado, nada mais.
    const painel = nos.folha || null;
    if (painel) {
      // S11-0 (defeito 1): o QUADRO SEGUINTE existe para a transição correr. O
      // navegador pinta o painel uma vez em translateY(100%) e só depois recebe
      // a classe que o levanta; pôr a classe no mesmo tick do append é deixar o
      // navegador ver um único estado e a folha chegar no lugar sem subir nada.
      // Movimento reduzido (o token --movimento-abrir zera no CSS, e aqui se
      // pula o quadro): na hora, porque sem transição esperar um frame é só
      // atraso. Sem `requestAnimationFrame` no contexto (o node, onde `win` é o
      // dublê do teste, ou um ambiente que não o expõe), a classe entra na hora
      // também: o desenho não depende de quadro nenhum para existir.
      const slugPainel = painel.getAttribute('data-slug') || '';
      const entrouAgora = !folhaVisivel || slugPainel !== slugAberto;
      const parado = win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      if (!entrouAgora || parado || typeof win?.requestAnimationFrame !== 'function') {
        painel.classList.add('aberta');
      } else {
        win.requestAnimationFrame(() => painel.classList.add('aberta'));
      }
      slugAberto = slugPainel;
      if (!folhaVisivel) {
        // ENTROU na folha: o primeiro focável do painel é o Fechar, e o foco vai
        // para ele — o título do diálogo já é lido pelo `aria-labelledby`.
        const primeiro = focaveisDaFolha(painel)[0];
        primeiro?.focus?.();
      }
      // Folha nova por cima de folha velha (pré-requisito, voltar do navegador):
      // o fechar anterior já foi respondido por esta pintura.
      devolverAposFechar = false;
    } else if (devolverAposFechar) {
      // SAIU da folha por fechar: devolve ao cartão que a abriu, se ele ainda
      // está no mapa (o importar, o desfazer e a rota errada removem o gatilho,
      // e aí o foco fica onde o navegador o deixou — melhor que jogá-lo no body).
      devolverAposFechar = false;
      const cartao = cartaoDoGatilho(root, gatilhoDaFolha);
      if (cartao) cartao.focus?.();
      gatilhoDaFolha = null;
    }
    folhaVisivel = Boolean(painel);
  };

  const persistir = (novo) => {
    progresso = lerProgresso(novo);
    // A chave do progresso é do main.js, e ele não recebe storage: quem passa o
    // storage é ele. Enganar o storage aqui é ter duas chaves de "concluído".
    saveCompleted(progresso.completed);
    salvarViagem(storage, progresso);
  };

  // PRIMEIRA PINTURA, SYNCRONOUS, antes do primeiro `await` (fatia 2c-3, item 2
  // dos dois estados): enquanto o catálogo não chega, a tela tem UM esqueleto e
  // ZERO placas. Ficar em `carregando` e não pintar nada é deixar a pessoa diante
  // de um vazio branco — e pintar depois do `await` do loadCatalog faria o
  // esqueleto nascer já junto com a placa, sem nunca ter mostrado a espera.
  pintar();

  const avisarChegada = (id, abriu, momento) => {
    // 2d-1: além do id, a chegada carrega O QUE O GESTO ABRIU — calculado pelo
    // núcleo no momento do concluir, porque a pintura não pode recomparar antes
    // e depois (depois de pintar, o "antes" já se perdeu).
    ui.chegada = { id, abre: abriu?.destravadas || [], baldeacao: abriu?.baldeacao || null };
    ui.momento = momento || null;
    if (janela) clearTimeout(janela);
    // A chegada é o momento em que o esforço vira visível (JORNADA §2.4/§4.6):
    // sem pintar aqui, o círculo enchia no estado e a tela não mostrava nada.
    pintar();
    // --janela-desfazer é 6000 ms no CSS; o relógio aqui tem de ser o mesmo
    // número, e por isso ele vem do token lido do documento — não de um 6000
    // escrito à mão que um dia diverge do que a animação mostra.
    janela = relogio(() => { ui.chegada = null; ui.momento = null; ui.despertas = []; pintar(); }, JANELA_DESFAZER_MS);
  };

  // NAVEGAR, não mutar: o `hashchange` do casco (web/casco.js) é quem remonta
  // a tela. Um `pushState` aqui criaria uma entrada de história que nenhum
  // endereço do app sabe ler. Sem `win.location` (node), nada acontece — é o
  // mesmo silêncio protetor do modo privado do `carregarViagem`.
  const irPara = (hash) => { if (win && win.location) win.location.hash = hash; };

  const acoes = {
    abrirLinha(n) { ui.linha = n; ui.chegada = null; ui.momento = null; pintar(); },
    // S5 parte 2: `abrirEstacao` saiu — o cartão é `<a href="#/estacao/…">` e o
    // navegador faz o gesto sozinho. Duas rotas para a mesma tela é a regra que
    // já tirou o `aria-pressed` do seletor. FECHAR, em vez de apagar um estado,
    // navega para `#/`: o mesmo href do botão da folha, e o "voltar" devolve a
    // pessoa à estação de onde ela veio.
    // Sem rota de estação, Esc não tem o que fechar: navegar para '#/' na tela
    // do mapa jogaria a pessoa para o começo e criaria entrada no histórico.
    // S10 régua 4: o fechar agora ARMA a devolução de foco antes de navegar. É
    // variável de módulo porque a navegação mata esta instância — o `ui` morre
    // com ela, e quem devolve o foco é a PRÓXIMA pintura, a do mapa.
    fechar() { fecharFolha(ui, irPara); },
    embarque() { ui.embarqueAberto = !ui.embarqueAberto; pintar(); },
    anotar(id, texto) {
      // aplicarNota é a função do NÚCLEO de anotação, a mesma da tela principal:
      // o estado dela é { anotacoes }, e é ela (via setNota) que corta em 280 e
      // apaga a chave no texto vazio. Inventar applyNote aqui foi o defeito que
      // fez a anotação sumir no navegador.
      ui.notas = aplicarNota({ anotacoes: ui.notas }, id, texto).anotacoes;
      saveNotas(ui.notas);
      // E o catálogo carrega o texto: é de lá que a folha desenhada lê o campo.
      // Gravar no storage sem atualizar ui.catalogo é ter a anotação salva e
      // apagada da tela ao mesmo tempo (fatia 2c-3).
      ui.catalogo = comNotas(ui.catalogo, ui.notas);
    },
    iniciar(id) {
      persistir(iniciarEstacao(progresso, id, ui.catalogo));
      pintar();
    },
    concluir(id) {
      const antes = progresso;
      const depois = concluirEstacao(antes, id, deps.hoje, ui.catalogo);
      persistir(depois);
      // O pulso curto é só nas que DESTRANCARAM agora: marcosNovos compara antes
      // e depois, e é o núcleo quem sabe — a tela não deduz.
      const marcos = marcosNovos(antes, depois, ui.catalogo);
      const chegou = marcos.find((m) => m.tipo === 'estacao' && m.id === id);
      ui.despertas = [id];
      // O que o gesto abriu, perguntado ao núcleo ANTES de pintar: a tela não
      // reimplementa pré-requisito (regra 1 do arquivo), e a pintura sozinha não
      // tem como saber o "antes".
      if (chegou) avisarChegada(id, abreComBaldeacao(antes, depois, ui.catalogo), momentoDaChegada(antes, depois, ui.catalogo, id));
      else pintar();
    },
    // MARCAR é concluir pela porta do embarque: a lista fecha junto, porque o
    // embarque é o momento de quem ainda não tem nada concluído (JORNADA §2.2).
    // Fechar ANTES de concluir evita um segundo redesenho — o concluir já pinta.
    marcar(id) { ui.embarqueAberto = false; acoes.concluir(id); },
    desfazer(id) {
      persistir(desfazerConclusao(progresso, id));
      ui.chegada = null; ui.momento = null; ui.despertas = [];
      if (janela) { clearTimeout(janela); janela = null; }
      pintar();
    }
  };

  try {
    const carregado = await loadCatalog();
    ui.catalogo = comNotas(carregado?.courses || [], ui.notas);
    const resumo = resumoDaViagem(progresso, ui.catalogo);
    ui.linha = resumo.proximaEstacao?.linha ?? linhasDoCatalogo(ui.catalogo)[0] ?? 1;
  } catch (erro) {
    ui.carregando = false;
    root.textContent = '';
    const box = el(doc, 'div', 'placa');
    box.append(el(doc, 'p', 'placa-rotulo', { text: estados.erro.titulo }));
    box.append(el(doc, 'p', 'placa-vazia', { text: estados.erro.parteUm }));
    box.append(el(doc, 'p', 'placa-vazia', { text: comValores.erroPorQue(erro?.message || 'desconhecido') }));
    box.append(el(doc, 'p', 'placa-vazia', { text: estados.erro.parteTres }));
    root.append(box);
    return { ok: false, erro };
  }

  ui.carregando = false;
  bindMetro(doc, root, acoes);
  pintar();
  return { ok: true, pintar, acoes, ui, progresso: () => progresso };
}

/**
 * A janela do desfazer, em ms. O token é 6000ms (--janela-desfazer) e o número
 * mora aqui para o relógio não depender de CSS computado — que não existe no
 * node. Se o token mudar, os dois mudam junto: o teste de design confere.
 */
export const JANELA_DESFAZER_MS = 6000;

// O boot roda SÓ no navegador. `document.getElementById` é a pergunta: o teste
// instala um document mínimo sem ele, e por isso importar este módulo no node
// não sobe tela nenhuma (a mesma regra que boot.test.js cobra do boot.js).
// O boot roda SÓ na página que tem a raiz dele. Em 31/10 (S3a-2a) a pergunta
// deixou de ser "existe document?": o metro.js passou a ser importado também
// pelo casco do index.html, onde a raiz é outra e #metro não existe — ali o
// auto-boot chamava getElementById('metro'), recebia null e derrubava a
// primeira pintura no console, além de buscar o catálogo uma segunda vez por
// trás do casco. Quem abre o metrô dentro do casco chama subirMetro de
// propósito (web/telas/jornada.js); o auto-boot fica só para o metro.html.
const raizDoMetro =
  typeof document !== 'undefined' && typeof document.getElementById === 'function'
    ? document.getElementById('metro')
    : null;

export const inicio = raizDoMetro
  ? subirMetro({ root: raizDoMetro }).catch((erro) => {
        // eslint-disable-next-line no-console
        console.error('[atlas] a tela de metrô não subiu:', erro);
        return { ok: false, erro };
      })
    : null;
