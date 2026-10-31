// Projeto Atlas — as ROTAS por hash, puras: nenhum DOM aqui (S3a-1).
//
// POR QUE EXISTE: a S3a-2 monta o casco (a barra de baixo, a folha, a jornada)
// e precisa de «que tela este hash pede» sem tocar em document. Regra da casa:
// regra de tela não mora no boot.js — ele liga estado -> tela; é este módulo
// que diz qual estado é.
//
// A ÂNCORA QUE NÃO É ROTA é o detalhe que faria estrago silencioso: o
// «Pular para o conteúdo» do casco é '#conteudo'. Se isso caísse na jornada, o
// link de pular trocaria de tela e jogaria o foco para outro lugar — quem
// navega por teclado perderia o ponto onde estava. Por isso lerRota devolve
// null, e não a jornada, para tudo que não começa por '#/'.
import { casco } from './textos.js';

/**
 * As telas que o casco alcança pela barra de baixo. Rótulo vem de
 * core/textos.js (regra 7): se a frase morasse aqui, a trava dos textos não a
 * veria. Jornada é a primeira porque é ela que mostra a próxima estação — e é
 * o que se quer ver quando o app abre do nada.
 * @type {ReadonlyArray<{tela: string, rotulo: string, href: string}>}
 */
export const ABAS = Object.freeze([
  Object.freeze({ tela: 'jornada', rotulo: casco.abas.jornada, href: '#/' }),
  Object.freeze({ tela: 'explorar', rotulo: casco.abas.explorar, href: '#/explorar' }),
]);

/**
 * `{ tela, slug? }` com que a rota de estação começa. Um slug é o id da
 * disciplina no catálogo (`calculo-i`); nada aceito aqui é dado inventado.
 */
const PREFIXO_ESTACAO = '#/estacao/';

/**
 * Lê um hash e diz que tela ele pede.
 *
 * @param {string} hash `location.hash` (ou o href de uma âncora)
 * @returns {{tela: string, slug?: string, desconhecida?: boolean} | null}
 *   `null` quando não é rota (âncora de página); `{tela:'jornada',
 *   desconhecida:true}` quando é rota mas não se conhece a tela — a jornada
 *   sempre abre, e a flag existe para o casco poder dizer isso na tela.
 */
export function lerRota(hash) {
  const cru = String(hash ?? '');
  // Âncora comum ('#conteudo', '#topo'): não é rota. Null, não jornada.
  if (!cru.startsWith('#/')) return cru === '' || cru === '#' ? { tela: 'jornada' } : null;

  const caminho = cru.slice(2);
  if (caminho === '' || caminho === '/') return { tela: 'jornada' };
  if (caminho === 'explorar') return { tela: 'explorar' };
  if (caminho.startsWith('estacao/')) {
    const slug = caminho.slice('estacao/'.length);
    // '#/estacao/' sem nada depois não nomeia estação nenhuma.
    if (slug) return { tela: 'estacao', slug };
  }
  return { tela: 'jornada', desconhecida: true };
}

/**
 * O inverso de `lerRota` para as rotas que existem. Aba desenhada com hrefDe
 * e lida com lerRota devolvem a mesma rota — é isso que impede a barra de
 * baixo de apontar para um lugar que a própria tela não reconhece.
 *
 * @param {{tela: string, slug?: string}} rota
 * @returns {string}
 */
export function hrefDe(rota) {
  const tela = rota?.tela;
  if (tela === 'explorar') return '#/explorar';
  if (tela === 'estacao') return `${PREFIXO_ESTACAO}${rota.slug}`;
  return '#/';
}
