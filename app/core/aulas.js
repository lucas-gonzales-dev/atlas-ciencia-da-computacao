// Projeto Atlas — as AULAS de cada estação (S12, 04/11/2026).
//
// Por que existe: cada disciplina da UBL é uma playlist do YouTube, e o Atlas
// só conhecia o link. Sem a lista de aulas não há progresso por aula, nem
// "continuar de onde parei", nem fechamento de aula: a estação era um botão de
// "concluí". As aulas vêm da YouTube Data API v3 por tools/aulas-do-youtube.mjs
// e moram em app/data/aulas/, uma estação por arquivo.
//
// Regra da casa (igual a core/catalog.js): zero filesystem, zero node:*, zero
// rede. Roda no node E no navegador. Quem chama a API é o script; quem lê
// arquivo é o script ou o teste. Aqui só se traduz o que a API devolveu.
//
// Os termos da API limitam guardar os dados dela por 30 dias: por isso cada
// arquivo leva `geradoEm` e `validoAte`, e o script tem --check.

/** Dias que os dados da API podem ficar guardados antes de regerar (termos da YouTube API Services). */
export const VALIDADE_DIAS = 30;

/** O id da playlist num link do YouTube (`list=`), ou null. */
export function playlistDoRecurso(url) {
  const m = /[?&]list=([A-Za-z0-9_-]+)/.exec(String(url ?? ''));
  return m ? m[1] : null;
}

/** Duração ISO 8601 da API ("PT1H2M3S") em segundos; 0 quando não dá para ler (ao vivo, P0D). */
export function segundosDaDuracao(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso ?? ''));
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * O título como a pessoa lê na lista: sem a etiqueta que repete o curso no começo
 * ("[CIRCUITOS DIGITAIS] Aula 01 - Introdução" → "Aula 01 - Introdução") e sem
 * espaço sobrando. O original fica guardado ao lado, para conferir com a fonte.
 */
export function tituloDaAula(original) {
  return String(original ?? '')
    .replace(/^\s*\[[^\]]{1,80}\]\s*[-–—:|]?\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A aula é de exercício pelo próprio título da fonte. Nada é inventado: só se lê o que a UBL publicou. */
export function ehAulaDeExercicio(titulo) {
  return /exerc[ií]cio|lista\s+de\s+exerc|resolu[cç][aã]o|problemas?\s+resolvid/i.test(String(titulo ?? ''));
}

/** Vídeo que a playlist ainda lista, mas que ninguém pode ver: fica fora da estação. */
function indisponivel(item) {
  const t = String(item?.snippet?.title ?? '');
  const privado = item?.status?.privacyStatus === 'private' || item?.status?.privacyStatus === 'privacyStatusUnspecified';
  return privado || t === 'Private video' || t === 'Deleted video' || t === 'Vídeo privado' || t === 'Vídeo excluído';
}

/**
 * As aulas de uma estação, a partir das páginas de `playlistItems` e do mapa de
 * durações de `videos`. Numera de 1 na ordem da playlist, depois do recorte.
 *
 * @param {Array<object>} itens os `items` de todas as páginas de playlistItems, na ordem
 * @param {Record<string,string>} duracoes videoId → duração ISO 8601 (de videos.list)
 * @param {{de?: number, ate?: number}} [recorte] posições 1-based, inclusive, quando duas
 *   estações dividem a mesma playlist na fonte (Python I e II); ausente = a playlist inteira
 * @returns {Array<{id:string, n:number, titulo:string, original:string, duracaoS:number, exercicio:boolean}>}
 */
export function aulasDaPlaylist(itens, duracoes = {}, recorte = {}) {
  const visiveis = (Array.isArray(itens) ? itens : [])
    .filter((it) => it?.contentDetails?.videoId && !indisponivel(it));
  const de = Math.max(1, Number(recorte.de ?? 1));
  const ate = Math.min(visiveis.length, Number(recorte.ate ?? visiveis.length));
  return visiveis.slice(de - 1, ate).map((it, i) => {
    const original = String(it.snippet?.title ?? '');
    const titulo = tituloDaAula(original);
    return {
      id: it.contentDetails.videoId,
      n: i + 1,
      titulo,
      original,
      duracaoS: segundosDaDuracao(duracoes[it.contentDetails.videoId]),
      exercicio: ehAulaDeExercicio(titulo)
    };
  });
}

/** Total de uma estação: quantas aulas, quantas de exercício e quantos segundos. */
export function totalDasAulas(aulas) {
  const lista = Array.isArray(aulas) ? aulas : [];
  return {
    aulas: lista.length,
    exercicios: lista.filter((a) => a.exercicio).length,
    segundos: lista.reduce((s, a) => s + (Number(a.duracaoS) || 0), 0)
  };
}

/** "16 min", "1 h 05 min", "12 h": a duração como a placa diz, arredondada ao minuto. */
export function duracaoLegivel(segundos) {
  const min = Math.round((Number(segundos) || 0) / 60);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h} h ${String(resto).padStart(2, '0')} min`;
}

/** Os dados ainda estão no prazo dos termos? `hoje` em aaaa-mm-dd local. */
export function aulasNoPrazo(arquivo, hoje) {
  const ate = String(arquivo?.validoAte ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(ate) && String(hoje) <= ate;
}
