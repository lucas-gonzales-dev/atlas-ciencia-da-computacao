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
  abreComBaldeacao
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
 *          aberta:string|null, despertas?:string[]}} estado
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
  const folhaAberta = estacoesDaLinha(catalogo, linha).some((c) => c && c.id === estado.aberta);
  root.className = `metro l${linha}${folhaAberta ? ' com-folha' : ''}`;

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

    const idDetalhe = `estacao-${e.id}`;
    const aberta = estado.aberta === e.id;
    const botao = el(doc, 'button', `estacao ${e.estado}`, {
      type: 'button',
      'data-id': e.id,
      'aria-expanded': aberta ? 'true' : 'false',
      'aria-controls': idDetalhe,
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

    parada.append(folha(doc, c, e, idDetalhe, aberta, linha, datas));
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

  return nos;
}

/**
 * A folha da estação: o recurso, a bibliografia como LINK COM NOME (nunca o
 * caminho cru como texto), a anotação com o nome da disciplina no rótulo, e o
 * concluir. Na trancada, o que falta — pelo nome.
 */
function folha(doc, curso, e, id, aberta, linha, datas = {}) {
  const box = el(doc, 'div', `detalhe l${linha}`, { id });
  if (!aberta) box.setAttribute('hidden', '');

  // 2c-2: "faltam X, Y" é a FOLHA, não a etiqueta. Com a folha fechada, nada é
  // mostrado — e as 35 trancadas pintariam 35 folhas de falta antes de qualquer
  // toque. O texto continua sendo o do núcleo, pelo nome, TODOS os pré-requisitos.
  if (aberta && e.estado === ESTADOS.TRANCADA) {
    box.append(el(doc, 'p', 'detalhe-falta', { text: textoDoQueFalta(e) }));
  }

  // FATIA 2d-2 (JORNADA §3.1): o CARIMBO. É a data que o núcleo guardou em
  // `conclusoes` quando a estação foi concluída — a tela nem formata nem inventa
  // dia. Sem data (estação que chegou por importação antiga), o carimbo cala em
  // vez de afirmar um dia em que ninguém estudou.
  if (aberta && e.estado === ESTADOS.CONCLUIDA && datas[e.id]) {
    box.append(el(doc, 'p', 'detalhe-carimbo', { text: comValores.concluidaEm(datas[e.id]) }));
  }

  // FATIA 2d-2 (§3.1): a TRANCADA não oferece o recurso. Oferecer "Começar a
  // estudar" de uma estação que ainda não existe para a pessoa é a tela mentindo
  // — o que ela precisa ali é o nome do que falta, e nada mais.
  // S4b (um primário por TELA): o recurso só sai na folha ABERTA. Folha fechada
  // é hidden, e link escondido continua na fila do leitor de tela — com o
  // catálogo inteiro desenhado, a tela punha 35 "Começar a estudar" antes de
  // qualquer toque. É a mesma regra que a 2c-3 deu à anotação, e é o que deixa
  // exatamente um botão cheio na tela quando uma folha está aberta.
  if (aberta && curso?.resourceUrl && e.estado !== ESTADOS.TRANCADA) {
    box.append(el(doc, 'a', 'recurso', {
      href: curso.resourceUrl, rel: 'noopener', target: '_blank',
      // UM verbo só na tela (item 5 da crítica): o mesmo texto da placa.
      // Concluída o verbo muda: quem já passou por ali não recebe "Começar a
      // estudar" como se nada tivesse acontecido (§3.1).
      'data-recurso': curso.id,
      text: e.estado === ESTADOS.CONCLUIDA ? placa.reverConteudo : placa.comecarEstudar
    }));
    // FATIA 2d-1 (JORNADA §2.3): embaixo do botão, a origem que o CATÁLOGO diz.
    // Nada inventado: sem tipo conhecido e sem site conhecido, a linha não sai —
    // a tela cala em vez de adivinhar. É a palavra da placa, na mesma folha.
    const origem = origemDoRecurso(curso);
    if (origem) box.append(el(doc, 'p', 'recurso-origem', { text: origem }));
  }

  if (aberta && curso?.bibliography) {
    const biblio = el(doc, 'div', 'biblio');
    // O TEXTO é o nome (linkBibliografia); o HREF é o caminho real da fonte.
    // Caminho como texto na tela está na lista do proibido — como endereço, não.
    const link = el(doc, 'a', 'biblio-link', {
      href: naFonte(curso.bibliography), rel: 'noopener', target: '_blank',
      'data-bibliografia': curso.id,
      // Item 6: o NOME é fixo — "Bibliografia na fonte". O caminho vira
      // endereço, nunca texto na tela (a lista do proibido continua de pé).
      text: placa.bibliografiaNaFonte
    });
    biblio.append(link);
    biblio.append(el(doc, 'p', 'biblio-nota', { text: placa.bibliografiaNota }));
    box.append(biblio);
  }

  // FATIA 2c-3 (item 5 da crítica): o campo mora SÓ na folha ABERTA. Com uma
  // anotação desenhada em cada uma das 35 folhas, a tela tinha 35 rótulos
  // "Anotação" na fila do leitor de tela — duas em vez de uma já era o defeito
  // medido. Folha fechada é hidden, e campo escondido ainda é campo no DOM.
  //
  // O rótulo leva o NOME DA DISCIPLINA: é isso que acaba com o
  // "Anotação, Anotação, Anotação" que o pedido 15 achou.
  if (aberta) {
    const rotulo = el(doc, 'label', 'anotacao-rotulo', { for: `nota-${e.id}` });
    rotulo.append(el(doc, 'span', null, { text: `Anotação — ${e.titulo}` }));
    const area = el(doc, 'textarea', 'anotacao', {
      id: `nota-${e.id}`,
      'data-nota': e.id,
      'aria-label': `Anotação de ${e.titulo}`,
      rows: '3'
    });
    // O que a pessoa escreveu VOLTA no campo: `curso.nota` vem de comNotas, que
    // é quem liga ui.notas ao catálogo. Sem isso, todo redesenho apagava a
    // anotação na cara de quem estava digitando.
    area.value = typeof curso?.nota === 'string' ? curso.nota : '';
    rotulo.append(area);
    box.append(rotulo);
  }

  // FATIA 2c-1 (item 7 da crítica): o botão volta PORQUE AGORA ELE FAZ ALGO.
  // Em 2b-2 ele foi tirado por ser promessa falsa — mexer nele não desenhava
  // chegada nenhuma. Com o círculo enchendo, o trecho marcando e o aviso com
  // desfazer no ar, "Concluir estação" é o verbo do núcleo na folha, e só aparece
  // na estação aberta, disponível ou em curso: trancada e concluída não têm o
  // que concluir.
  if (aberta && (e.estado === ESTADOS.DISPONIVEL || e.estado === ESTADOS.EM_CURSO)) {
    box.append(el(doc, 'button', 'botao botao-concluir', {
      type: 'button', 'data-concluir': curso.id, text: placa.concluir
    }));
  }
  return box;
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

    const estacao = alvo.closest('[data-id]');
    if (estacao) { h.abrirEstacao?.(estacao.getAttribute('data-id')); return; }
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

  const ui = {
    // O catálogo é GUARDADO já com as anotações dentro: é a única forma de o
    // redesenho achar o texto que a pessoa escreveu (fatia 2c-3).
    catalogo: comNotas([], loadNotas() || {}),
    notas: loadNotas() || {}, linha: null, aberta: null,
    embarqueAberto: false, chegada: null, despertas: [], carregando: true
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
  const pintar = () => {
    if (ui.carregando) { desenharEsqueleto(doc, root); return; }
    desenharMetro(doc, root, {
      catalogo: ui.catalogo, progresso, linha: ui.linha, aberta: ui.aberta,
      chegada: ui.chegada, despertas: ui.despertas, embarqueAberto: ui.embarqueAberto
    });
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

  const avisarChegada = (id, abriu) => {
    // 2d-1: além do id, a chegada carrega O QUE O GESTO ABRIU — calculado pelo
    // núcleo no momento do concluir, porque a pintura não pode recomparar antes
    // e depois (depois de pintar, o "antes" já se perdeu).
    ui.chegada = { id, abre: abriu?.destravadas || [], baldeacao: abriu?.baldeacao || null };
    if (janela) clearTimeout(janela);
    // A chegada é o momento em que o esforço vira visível (JORNADA §2.4/§4.6):
    // sem pintar aqui, o círculo enchia no estado e a tela não mostrava nada.
    pintar();
    // --janela-desfazer é 6000 ms no CSS; o relógio aqui tem de ser o mesmo
    // número, e por isso ele vem do token lido do documento — não de um 6000
    // escrito à mão que um dia diverge do que a animação mostra.
    janela = relogio(() => { ui.chegada = null; ui.despertas = []; pintar(); }, JANELA_DESFAZER_MS);
  };

  const acoes = {
    abrirLinha(n) { ui.linha = n; ui.aberta = null; ui.chegada = null; pintar(); },
    abrirEstacao(id) { ui.aberta = ui.aberta === id ? null : id; pintar(); },
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
      if (chegou) avisarChegada(id, abreComBaldeacao(antes, depois, ui.catalogo));
      else pintar();
    },
    // MARCAR é concluir pela porta do embarque: a lista fecha junto, porque o
    // embarque é o momento de quem ainda não tem nada concluído (JORNADA §2.2).
    // Fechar ANTES de concluir evita um segundo redesenho — o concluir já pinta.
    marcar(id) { ui.embarqueAberto = false; acoes.concluir(id); },
    desfazer(id) {
      persistir(desfazerConclusao(progresso, id));
      ui.chegada = null; ui.despertas = [];
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
