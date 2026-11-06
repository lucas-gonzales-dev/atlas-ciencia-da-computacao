// Projeto Atlas — as aulas de cada estação, pela YouTube Data API v3 (S12, 04/11/2026).
//
// O que faz, na ordem:
//   1. lê as 35 estações de app/data/catalog.json e o id da playlist de cada uma;
//   2. pede à API as aulas de cada playlist (playlistItems) e a duração de cada
//      vídeo (videos), 50 por chamada;
//   3. aplica app/data/aulas-recortes.json, quando duas estações dividem a mesma
//      playlist na fonte (Python I e II apontam para a mesma);
//   4. grava app/data/aulas/<slug>.json e app/data/aulas/indice.json, com
//      `geradoEm` e `validoAte` (os termos da API limitam guardar os dados dela a
//      30 dias: regere uma vez por mês).
//
// Uso:  node tools/aulas-do-youtube.mjs            (precisa da chave, chama a rede)
//       node tools/aulas-do-youtube.mjs --check    (sem rede: completo e no prazo? exit 1 se não)
//
// A CHAVE nunca entra no repositório, em comando ou em saída. Ela vem de
// YOUTUBE_API_KEY ou, sem a variável, do arquivo apontado por
// ATLAS_CHAVE_YOUTUBE (padrão: ~/.atlas/youtube-api-key.txt), fora de qualquer
// repositório. Erro de rede mostra o status e o motivo da API, nunca o endereço.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playlistDoRecurso, aulasDaPlaylist, totalDasAulas, aulasNoPrazo, VALIDADE_DIAS } from '../app/core/aulas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = join(RAIZ, 'app', 'data');
const PASTA = join(DADOS, 'aulas');
const API = 'https://www.googleapis.com/youtube/v3';

/** aaaa-mm-dd local (regra 13 da casa: nada de toISOString puro). */
function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return dataLocal(new Date(a, m - 1, d + dias));
}

function estacoes() {
  const cat = JSON.parse(readFileSync(join(DADOS, 'catalog.json'), 'utf8'));
  const editorial = existsSync(join(DADOS, 'aulas-recortes.json'))
    ? JSON.parse(readFileSync(join(DADOS, 'aulas-recortes.json'), 'utf8'))
    : {};
  const recortes = editorial.recortes ?? {};
  const prefixos = editorial.prefixos ?? {};
  return cat.courses.map((c) => ({
    id: c.id, slug: c.slug, titulo: c.title, playlist: playlistDoRecurso(c.resourceUrl),
    recorte: recortes[c.id] ?? {}, prefixos: prefixos[c.id] ?? []
  }));
}

function chave() {
  const daVariavel = String(process.env.YOUTUBE_API_KEY ?? '').trim();
  if (daVariavel) return daVariavel;
  const arquivo = process.env.ATLAS_CHAVE_YOUTUBE || join(homedir(), '.atlas', 'youtube-api-key.txt');
  if (!existsSync(arquivo)) {
    throw new Error(`sem chave da YouTube Data API: defina YOUTUBE_API_KEY ou crie ${arquivo} (fora de qualquer repositório)`);
  }
  // o Bloco de Notas pode salvar com BOM, e a chave com BOM é recusada pela API
  return readFileSync(arquivo, 'utf8').replace(/^﻿/, '').trim();
}

async function pedir(caminho, parametros, k) {
  const url = `${API}/${caminho}?${new URLSearchParams({ ...parametros, key: k })}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    // o endereço leva a chave: o erro diz só o caminho, o status e o motivo da API
    const motivo = corpo?.error?.errors?.[0]?.reason ?? corpo?.error?.message ?? 'sem motivo';
    throw new Error(`${caminho} respondeu ${r.status}: ${motivo}`);
  }
  return corpo;
}

async function itensDaPlaylist(playlistId, k) {
  const itens = [];
  let pageToken;
  do {
    const p = await pedir('playlistItems', {
      part: 'snippet,contentDetails,status', maxResults: '50', playlistId, ...(pageToken ? { pageToken } : {})
    }, k);
    itens.push(...(p.items ?? []));
    pageToken = p.nextPageToken;
  } while (pageToken);
  return itens;
}

async function duracoesDos(ids, k) {
  const duracoes = {};
  for (let i = 0; i < ids.length; i += 50) {
    const p = await pedir('videos', { part: 'contentDetails', id: ids.slice(i, i + 50).join(','), maxResults: '50' }, k);
    for (const v of p.items ?? []) duracoes[v.id] = v.contentDetails?.duration ?? '';
  }
  return duracoes;
}

async function gerar() {
  const k = chave();
  const hoje = dataLocal();
  const validoAte = somarDias(hoje, VALIDADE_DIAS);
  const lista = estacoes();
  const semPlaylist = lista.filter((e) => !e.playlist);
  if (semPlaylist.length) throw new Error(`estação sem playlist no link: ${semPlaylist.map((e) => e.slug).join(', ')}`);

  const porPlaylist = new Map();
  for (const e of lista) {
    if (porPlaylist.has(e.playlist)) continue;
    const itens = await itensDaPlaylist(e.playlist, k);
    const duracoes = await duracoesDos(itens.map((it) => it.contentDetails?.videoId).filter(Boolean), k);
    porPlaylist.set(e.playlist, { itens, duracoes });
  }

  mkdirSync(PASTA, { recursive: true });
  const indice = { fonte: 'YouTube Data API v3', geradoEm: hoje, validoAte, estacoes: {}, total: { aulas: 0, exercicios: 0, segundos: 0 } };
  for (const e of lista) {
    const { itens, duracoes } = porPlaylist.get(e.playlist);
    const aulas = aulasDaPlaylist(itens, duracoes, e.recorte, { nome: e.titulo, prefixos: e.prefixos });
    const total = totalDasAulas(aulas);
    // JSON compacto: os 36 arquivos entram no precache e cada byte pesa na instalação do app
    writeFileSync(join(PASTA, `${e.slug}.json`), `${JSON.stringify({
      estacao: e.id, slug: e.slug, playlist: e.playlist, fonte: indice.fonte, geradoEm: hoje, validoAte,
      ...(e.recorte.de || e.recorte.ate || e.recorte.trechos ? { recorte: e.recorte } : {}), total, aulas
    })}\n`);
    indice.estacoes[e.id] = { slug: e.slug, ...total };
    for (const k2 of Object.keys(indice.total)) indice.total[k2] += total[k2];
    console.log(`${e.slug.padEnd(48)} ${String(total.aulas).padStart(4)} aulas  ${String(total.exercicios).padStart(3)} de exercício`);
  }
  writeFileSync(join(PASTA, 'indice.json'), `${JSON.stringify(indice)}\n`);
  console.log(`\n${lista.length} estações, ${indice.total.aulas} aulas, ${Math.round(indice.total.segundos / 3600)} h; válido até ${validoAte}`);
}

function conferir() {
  const hoje = dataLocal();
  const falhas = [];
  const indice = existsSync(join(PASTA, 'indice.json')) ? JSON.parse(readFileSync(join(PASTA, 'indice.json'), 'utf8')) : null;
  if (!indice) falhas.push('sem app/data/aulas/indice.json');
  else if (!aulasNoPrazo(indice, hoje)) falhas.push(`dados vencidos: válidos até ${indice.validoAte}, hoje é ${hoje} (regere: os termos da API pedem no máximo ${VALIDADE_DIAS} dias)`);
  const arquivos = existsSync(PASTA) ? new Set(readdirSync(PASTA)) : new Set();
  for (const e of estacoes()) if (!arquivos.has(`${e.slug}.json`)) falhas.push(`sem aulas para ${e.slug}`);
  if (falhas.length) { for (const f of falhas) console.log(`✗ ${f}`); process.exitCode = 1; return; }
  console.log(`✓ ${Object.keys(indice.estacoes).length} estações, ${indice.total.aulas} aulas, válido até ${indice.validoAte}`);
}

if (process.argv.includes('--check')) conferir();
else await gerar().catch((erro) => { console.error(`✗ ${erro.message}`); process.exitCode = 1; });
