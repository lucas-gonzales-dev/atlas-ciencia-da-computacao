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
  // Revisar é a terceira aba (S8): depois de concluir, o caminho continua — e
  // ela fica vazia até a primeira conclusão, que é o estado honesto dela.
  Object.freeze({ tela: 'revisar', rotulo: casco.abas.revisar, href: '#/revisar' }),
  // Perfil é a quarta aba (S9): o bilhete, os marcos e os dados da pessoa. Vem
  // por último porque é a tela de olhar para trás — as três primeiras são o
  // caminho à frente.
  Object.freeze({ tela: 'perfil', rotulo: casco.abas.perfil, href: '#/perfil' }),
]);

/**
 * `{ tela, slug? }` com que a rota de estação começa. Um slug é o id da
 * disciplina no catálogo (`calculo-i`); nada aceito aqui é dado inventado.
 */
const PREFIXO_ESTACAO = '#/estacao/';

/**
 * 'busca=calculo&linha=2' -> Map. Sem URLSearchParams de propósito: ele não
 * existe no mini-DOM dos testes, e a regra é pequena demais para arrastar um
 * global que pode faltar. Um % quebrado no endereço da outra pessoa
 * ('#/explorar?busca=%') tem que devolver a rede inteira, não estourar no
 * hashchange — por isso o decode vai em try/catch e devolve '' na falha.
 * @param {string|undefined} queryString o que vem depois do '?'
 * @returns {Map<string,string>}
 */
function parseQuery(queryString) {
  const out = new Map();
  for (const pedaco of String(queryString ?? '').split('&')) {
    if (!pedaco) continue;
    const i = pedaco.indexOf('=');
    const chave = i < 0 ? pedaco : pedaco.slice(0, i);
    const valor = i < 0 ? '' : pedaco.slice(i + 1);
    const dec = (texto) => {
      try { return decodeURIComponent(texto); } catch { return ''; }
    };
    out.set(dec(chave), dec(valor));
  }
  return out;
}

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

  const [caminho, queryString] = cru.slice(2).split('?');
  if (caminho === '' || caminho === '/') return { tela: 'jornada' };
  if (caminho === 'explorar') {
    // A busca e a linha só existem aqui: nenhuma outra tela lê estes valores,
    // e rota que carrega dado que ninguém consome é endereço que mente.
    const par = parseQuery(queryString);
    const busca = par.get('busca');
    const linha = par.get('linha');
    const rota = { tela: 'explorar' };
    if (busca) rota.busca = busca;
    const n = linha === undefined ? NaN : Number(linha);
    if (Number.isInteger(n) && n >= 1 && n <= 7) rota.linha = n;
    return rota;
  }
  if (caminho === 'revisar') return { tela: 'revisar' };
  if (caminho === 'perfil') return { tela: 'perfil' };
  if (caminho.startsWith('estacao/')) {
    const bruto = caminho.slice('estacao/'.length);
    // '#/estacao/' sem nada depois não nomeia estação nenhuma.
    if (!bruto) return { tela: 'jornada', desconhecida: true };
    // O PAINEL da estação (S13a, 04/11/2026): '#/estacao/<slug>/aulas' é a
    // página com a lista de aulas, que a S13b vai montar. Só 'aulas' é painel
    // conhecido — o sufixo é conferido byte a byte, e não "qualquer coisa depois
    // do primeiro /", porque hoje 'calculo-i/foo' é lido como um slug e tem de
    // continuar sendo: um endereço desconhecido caindo em uma estação existente
    // seria a folha errada no fundo do link de alguém.
    if (bruto.endsWith('/aulas')) {
      const slug = bruto.slice(0, -'/aulas'.length);
      // '#/estacao//aulas' não nomeia estação nenhuma: mesma regra do slug
      // vazio. Deixar cair adiante daria o slug '/aulas', um nome que não
      // existe no catálogo e desenharia uma folha vazia.
      if (!slug) return { tela: 'jornada', desconhecida: true };
      return { tela: 'estacao', slug, painel: 'aulas' };
    }
    return { tela: 'estacao', slug: bruto };
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
  if (tela === 'explorar') {
    // A ordem é busca, linha — a mesma que lerRota aceita em qualquer ordem, e
    // que o teste cobra byte a byte: um endereço compartilhado tem de ser o
    // mesmo endereço que a tela escreveu.
    const pedacos = [];
    if (rota.busca) pedacos.push(`busca=${encodeURIComponent(rota.busca)}`);
    if (rota.linha) pedacos.push(`linha=${rota.linha}`);
    return pedacos.length ? `#/explorar?${pedacos.join('&')}` : '#/explorar';
  }
  if (tela === 'revisar') return '#/revisar';
  if (tela === 'perfil') return '#/perfil';
  if (tela === 'estacao') {
    // O painel só existe com slug. '#/estacao//aulas' não nomeia estação
    // nenhuma, e o lerRota já o devolve como rota desconhecida — um hrefDe que
    // escrevesse esse endereço criaria um link que o próprio app não reconhece.
    const slug = rota.slug ? String(rota.slug) : '';
    if (rota.painel === 'aulas' && slug) return `${PREFIXO_ESTACAO}${slug}/aulas`;
    return `${PREFIXO_ESTACAO}${slug}`;
  }
  return '#/';
}
