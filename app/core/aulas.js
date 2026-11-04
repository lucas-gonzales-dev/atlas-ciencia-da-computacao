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

/** Minúsculas e sem acento, caractere por caractere: o índice no texto normalizado é o mesmo do original. */
function normal(texto) {
  return [...String(texto ?? '')].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 1) || c).join('');
}

/**
 * Os começos que repetem o nome da estação, como as playlists da fonte escrevem: o nome inteiro, no plural
 * ("Bancos de Dados" para "Banco de Dados"), com algarismo no lugar do romano ("Álgebra Linear 1"), e a primeira
 * palavra quando ela é longa ("Probabilidade Aula 02" em "Probabilidade e Estatística").
 */
function comecosDoNome(nome, extras) {
  const n = normal(nome).trim();
  if (!n) return extras.map(normal);
  const arabico = n.replace(/\biii$/, '3').replace(/\bii$/, '2').replace(/\bi$/, '1');
  const plural = n.replace(/^(\p{L}+)(?=\s)/u, '$1s');
  return [...new Set([...extras.map(normal), n, arabico, plural])].sort((a, b) => b.length - a.length);
}

/** A primeira palavra do nome, longa, só quando vem seguida de "Aula" ("Probabilidade Aula 02"): sozinha ela é assunto. */
function primeiraAntesDeAula(nome, ns) {
  const primeira = normal(nome).trim().split(/\s+/)[0] ?? '';
  return primeira.length >= 8 && new RegExp(`^${primeira}\\s+aula\\b`).test(ns) ? primeira : null;
}

/**
 * O título como a pessoa lê na lista (S12, refeito em 04/11/2026 sobre os 1.375 títulos reais). Sai o que repete o
 * que a tela já diz: o nome da estação no começo ("Matemática Discreta - UFC - …", "ACH2044 - Sistemas
 * Operacionais: …", "Geometria Analítica ⭐ Videoaula 1.1 ⭐ …"), a etiqueta entre colchetes, o código da
 * disciplina, "Aula 01 -", "L03", a turma e o módulo no fim, e o "| nome do curso" final. Fica o que distingue
 * aulas do mesmo assunto: "(1/3)" e "(aula 02)". Se não sobra nada ("Sistemas Distribuídos - Aula 3"), o título
 * é "Aula N". O original fica guardado ao lado, para conferir com a fonte.
 *
 * @param {string} original o título da playlist
 * @param {string} [nome] o nome da estação
 * @param {{n?: number, prefixos?: string[]}} [opcoes] a posição (para o "Aula N") e começos editoriais a mais
 */
export function tituloDaAula(original, nome = '', opcoes = {}) {
  const comecos = comecosDoNome(nome, opcoes.prefixos ?? []);
  let s = String(original ?? '').replace(/\s+/g, ' ').trim();
  let parte = '';
  // o "| nome do curso" e o "- nome do curso" do fim (Linguagens de Programação, Redes de Computadores); os outros
  // "|" separam assuntos e ficam (Compiladores)
  const fim = /\s*[|\-–—]\s*([^|\-–—]+)$/.exec(s);
  if (fim && fim.index > 0 && comecos.includes(normal(fim[1]).trim())) s = s.slice(0, fim.index).trim();
  for (let volta = 0; volta < 8; volta += 1) {
    const antes = s;
    s = s.replace(/^\[[^\]]{1,80}\]\s*[-–—:|]?\s*/, '')
      .replace(/^⭐\s*videoaula\s*[\d.]+\s*⭐\s*/i, '')
      .replace(/^[A-Z]{2,4}\d{2,4}\s*[-–—:]\s*/, '')
      .replace(/^UFC\b\s*[-–—:]?\s*/, '')
      .replace(/^\d{1,3}\.\d{1,2}\s*[-–—:]?\s+/, '')
      .replace(/^\d{1,3}\s*[-–—.:)]\s+/, '')
      .replace(/^0\d\s+/, '')
      .replace(/^(?:aula|v[ií]deo)\s*#?\s*\d+\s*(\(\d+\/\d+\))?\s*[-–—.:|]?\s*/i, (_, p) => { if (p) parte = p; return ''; })
      .replace(/^l\d{2}\s+/i, '');
    const ns = normal(s);
    // o nome sem o número final ("Álgebra Linear - Aula 10" em "Álgebra Linear I") só vale com separador logo
    // depois: sem ele, "Cálculo de Limites", aula de Cálculo I, perderia o "Cálculo"
    const semNumero = normal(nome).trim().replace(/\s+(?:i{1,3}|\d)$/, '');
    const comeco = comecos.find((c) => c && ns.startsWith(c) && /^($|[\s\-–—:|⭐(])/.test(ns.slice(c.length)))
      ?? (semNumero && ns.startsWith(semNumero) && /^\s*[-–—:|]/.test(ns.slice(semNumero.length)) ? semNumero : null)
      ?? primeiraAntesDeAula(nome, ns);
    if (comeco) {
      const resto = s.slice(comeco.length).replace(/^\s*[-–—:|]+\s*/, '').trim();
      // o título que É o nome da estação ("Introdução à Engenharia de Software", aula 1) fica como está;
      // depois do nome, o número da aula também sai ("Estruturas de Dados: 11 Árvore Binária de Busca")
      if (resto) s = resto.replace(/^\d{1,3}\s+(?=\p{L})/u, '');
    }
    if (s === antes) break;
  }
  s = s.replace(/\s*\((?:turma\s*\d+|m[óo]dulo\s*\d+\/\d+)\)\s*$/i, '').replace(/\s+turma\s*\d+\s*$/i, '').trim();
  if (parte && !s.includes(parte)) s = `${s} ${parte}`.trim();
  if (!s || /^\(?\d+\/\d+\)?$/.test(s)) {
    const n = /aula\s*#?\s*(\d+)/i.exec(String(original))?.[1] ?? opcoes.n;
    return n ? `Aula ${Number(n)}` : String(original ?? '').trim();
  }
  return s;
}

/**
 * A aula é de exercício pelo próprio título da fonte. Nada é inventado: só se lê o que a UBL publicou. Conta
 * "exercício", "lista 1", "questão 3", "resolução" e a correção de uma avaliação (04/11/2026: Matemática Discreta
 * tem dezenas de "Lista 1 Questão N", e o detector antigo via uma).
 */
export function ehAulaDeExercicio(titulo) {
  return /exerc[ií]cio|lista\s+de\s+exerc|\blista\s*\d|\bquest(?:ão|ões|ao|oes)\s*\d|resolu[cç][aã]o|problemas?\s+resolvid|corre[cç][aã]o\s+d[ao]s?\s+\S*\s*avalia/i
    .test(String(titulo ?? ''));
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
 * @param {{de?: number, ate?: number, trechos?: Array<[number, number]>}} [recorte] posições
 *   1-based, inclusive, entre os vídeos visíveis, quando duas estações dividem a mesma playlist
 *   na fonte (Python I e II). `trechos` aceita mais de um pedaço, na ordem dada: a playlist da
 *   USP tem uma aula da Parte 1 (as dicas do COH-PIAH) no fim. Ausente = a playlist inteira.
 * @param {{nome?: string, prefixos?: string[]}} [estacao] o nome da estação e os começos editoriais a mais
 *   (data/aulas-recortes.json), para a limpeza do título
 * @returns {Array<{id:string, n:number, titulo:string, original?:string, duracaoS:number, exercicio:boolean}>}
 */
export function aulasDaPlaylist(itens, duracoes = {}, recorte = {}, estacao = {}) {
  const visiveis = (Array.isArray(itens) ? itens : [])
    .filter((it) => it?.contentDetails?.videoId && !indisponivel(it));
  const trechos = Array.isArray(recorte.trechos) && recorte.trechos.length
    ? recorte.trechos
    : [[recorte.de ?? 1, recorte.ate ?? visiveis.length]];
  const escolhidos = trechos.flatMap(([de, ate]) => {
    const inicio = Math.max(1, Number(de));
    const fim = Math.min(visiveis.length, Number(ate));
    return visiveis.slice(inicio - 1, Math.max(inicio - 1, fim));
  });
  return escolhidos.map((it, i) => {
    const original = String(it.snippet?.title ?? '');
    const titulo = tituloDaAula(original, estacao.nome ?? '', { n: i + 1, prefixos: estacao.prefixos ?? [] });
    return {
      id: it.contentDetails.videoId,
      n: i + 1,
      titulo,
      // o título da fonte só quando a limpeza mudou alguma coisa: 1.375 aulas pagam cada byte no cache
      ...(original !== titulo ? { original } : {}),
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

/** Cada quantos segundos de vídeo o Atlas sugere uma pausa (ARBITRADO da S14a: 8 min, no meio dos 6 e 10 da literatura — Guo et al. 2014 mostra aprendizagem maior com vídeos segmentados, e a pesquisa de attention-spans de celular oscila entre 6 e 10 min; a busca ficou em 8 porque é o número que cabe inteiro numa tela e numa frase). */
export const INTERVALO_PAUSA = 8 * 60;

/** A partir de quantos segundos a aula merece pausa. Abaixo disso, interromper custa mais do que vale: a pessoa já está terminando. */
const PAUSA_DESDE = 12 * 60;

/** Quão perto do fim a última pausa ainda vale. Uma pausa a 1 min do fim pede que a pessoa pare para lembrar de uma aula que acabou — é o mesmo gesto duas vezes. */
const PAUSA_LONGE_DO_FIM = 3 * 60;

/**
 * As MARCAS DE PAUSA de uma aula, em segundos (J2, item 1 do desenho: "as marcas
 * de pausa calculadas pela duração"). Nada aqui conhece a YouTube API: entra a
 * duração, saem os minutos em que parar.
 *
 * Devolve vazio para aula curta — e vazio É a resposta, não um erro: a tela não
 * desenha a linha de pausas quando ela vem vazia, em vez de desenhar "Pausas
 * sugeridas: " com nada depois.
 *
 * @param {number} duracaoS a duração do vídeo em segundos
 * @returns {number[]} os segundos de cada pausa, em ordem
 */
/**
 * A MARCA DE TEMPO como ela aparece escrita: 480 -> "8:00", 5.152 -> "85:52".
 *
 * S14b1: `duracaoLegivel` arredonda ao minuto porque ela responde "quanto dura"
 * — e "8 min" não serve para apontar um instante de vídeo, nem cabe no link do
 * `&t=`. A marca de pausa é um PONTO na linha do tempo, e ponto se escreve com
 * o minuto e o segundo que a própria barra do YouTube mostra. Mora aqui e não na
 * tela pela regra 9: um `Math.floor(s/60)` dentro de um `.js` de tela é a mesma
 * conta escrita de dois jeitos quando a segunda tela chegar.
 */
export function marcaDeTempo(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function pausasDaAula(duracaoS) {
  const total = Number(duracaoS) || 0;
  if (total < PAUSA_DESDE) return [];
  const marcas = [];
  for (let t = INTERVALO_PAUSA; t <= total - PAUSA_LONGE_DO_FIM; t += INTERVALO_PAUSA) marcas.push(t);
  return marcas;
}

/** Os dados ainda estão no prazo dos termos? `hoje` em aaaa-mm-dd local. */
export function aulasNoPrazo(arquivo, hoje) {
  const ate = String(arquivo?.validoAte ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(ate) && String(hoje) <= ate;
}
