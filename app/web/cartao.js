// Projeto Atlas — o cartão de divulgação (S11c, 03/11/2026).
//
// POR QUE EXISTE EM SEPARADO: o index.html não leva código inline (pages.test.js
// cobra, com motivo: o que mora dentro do HTML não chega a teste nenhum). O
// desenho do cartão mora aqui, e assim o vitrine.test.js roda ESTA mesma função
// no Node e confere a viagem que vai na foto, sem navegador.
//
// O QUE MUDOU DA S11a para cá: sai o `desenharMetro` da Jornada, entra o
// `mapaDaRede` de core/mapa-rede.js. Motivo medido: a Jornada desenha UMA linha
// por vez, então a foto do cartão mostrava um pedaço da ideia — e o que faz o
// Atlas ser o Atlas é a rede inteira, as baldeações abrindo as outras linhas.
// O cartão é feito do DESENHO da rede, não de uma tela fotografada: nada de
// botão, nada de placa, nada de contador.
//
// A VIAGEM É FABRICADA, e é dito em voz alta em vez de escondido: um cartão com
// progresso zero desenharia uma rede toda trancada, que é a cara de quem ainda
// não embarcou. Os ids são DERIVADOS do catálogo real — a primeira versão deste
// arquivo tinha ids escritos à mão, o mapa saiu com "0 de 35" e nenhuma trava
// avisou, porque nada olhava o cartão. É o buraco que o vitrine.test.js fecha.
import { mapaDaRede } from '../core/mapa-rede.js';

/** A linha percorrida: "comece pela Linha 1", inteira. */
const LINHA_PERCORRIDA = 1;

/** As estações fora da Linha 1 que o cartão mostra abertas, pelo NOME. */
const FEITAS_FORA_DA_LINHA_1 = [
  'Estruturas de Dados',
  'Álgebra Linear I',
  'Cálculo I',
  'Programação Funcional em Haskell'
];

/** O viewBox que o cartão reserva ao mapa: web/cartao.css desenha nestas medidas. */
export const MAPA_DO_CARTAO = Object.freeze({ largura: 528, altura: 502 });

const porTitulo = (catalogo, titulo) =>
  catalogo.find((c) => c.title === titulo || c.title === titulo.normalize('NFC'))?.id ?? null;

/**
 * A viagem do cartão, no formato que o núcleo entende, derivada do catálogo.
 *
 * `conclusoes` fica vazio de propósito: `concluirEstacao` escreve a data de
 * HOJE, e num cartão publicado hoje e lido em março uma data viva seria uma
 * afirmação sobre o futuro. A folha não aparece no cartão, e o carimbo é da
 * folha.
 */
export function viagemDoCartao(catalogo) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const umaLinha = lista
    .filter((c) => Number(c.stage) === LINHA_PERCORRIDA)
    .map((c) => c.id);
  const fora = FEITAS_FORA_DA_LINHA_1.map((t) => porTitulo(lista, t)).filter(Boolean);
  return {
    completed: [...umaLinha, ...fora],
    emCurso: [],
    conclusoes: {}
  };
}

/**
 * O SVG do cartão, como string — o mesmo mapa que o app desenha, com os tokens
 * da página resolvendo as cores (cartao.html é um documento; o bilhete
 * exportado, não, e esse sim passa valores resolvidos).
 *
 * @param {Array} catalogo courses do data/catalog.json
 * @returns {string}
 */
export function svgDoCartao(catalogo) {
  return mapaDaRede(catalogo, viagemDoCartao(catalogo), {
    largura: MAPA_DO_CARTAO.largura,
    altura: MAPA_DO_CARTAO.altura
  });
}

/**
 * Monta o cartão na raiz dada. Devolve o SVG montado, ou null quando não havia
 * o que desenhar: sem catálogo não há mapa, e a moldura (marca, título, apoio,
 * endereço) já está no HTML, então o script que fotografa mede o PNG e um mapa
 * ausente aparece na conferência como cartão errado, não como cartão branco
 * silencioso.
 *
 * @param {Document} doc o documento da página (o cartão não tem interação nenhuma)
 * @param {Element} root onde o SVG entra
 * @param {Array} catalogo courses do data/catalog.json
 * @returns {string|null} o SVG montado, ou null quando não havia o que desenhar
 */
export function desenharCartao(doc, root, catalogo) {
  if (!doc || !root || !Array.isArray(catalogo) || catalogo.length === 0) return null;
  const svg = svgDoCartao(catalogo);
  if (!svg.includes('class="mapa-rede"')) return null;
  // O SVG entra como marcação já fechada, sem script: é texto gerado por
  // core/mapa-rede.js, que escapa todo título. `insertAdjacentHTML` não roda
  // <script> nem espera elementos desconhecidos, e o mapa não tem interação.
  if (typeof root.insertAdjacentHTML === 'function') root.insertAdjacentHTML('beforeend', svg);
  else if (typeof root.innerHTML === 'string' || 'innerHTML' in root) root.innerHTML = svg;
  else return null; // raiz que não aceita marcação: devolve null em vez de fingir que desenhou
  return svg;
}

// ── só no navegador: a página abre, busca o catálogo e desenha ──
const rodaNoNavegador = typeof document !== 'undefined' && typeof fetch === 'function';

if (rodaNoNavegador) {
  const raiz = document.getElementById('rede');
  fetch('data/catalog.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json || !Array.isArray(json.courses)) return;
      desenharCartao(document, raiz, json.courses);
    })
    .catch(() => {});
}
