// Projeto Atlas — as aulas de cada estação (S12): a tradução do que a YouTube
// Data API devolve. Nenhum teste aqui toca a rede: as respostas são dublês com a
// forma da API (playlistItems com snippet, contentDetails e status).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  playlistDoRecurso, segundosDaDuracao, tituloDaAula, ehAulaDeExercicio,
  aulasDaPlaylist, totalDasAulas, duracaoLegivel, aulasNoPrazo
} from '../core/aulas.js';

const item = (videoId, title, privacyStatus = 'public') => ({ snippet: { title }, contentDetails: { videoId }, status: { privacyStatus } });

test('aulas: o id da playlist sai do link, com ou sem vídeo e parâmetros', () => {
  assert.equal(playlistDoRecurso('https://www.youtube.com/playlist?list=PLXyWBo_coJnMYO9Na3t-oYsc2X4kPJBWf'), 'PLXyWBo_coJnMYO9Na3t-oYsc2X4kPJBWf');
  assert.equal(playlistDoRecurso('https://www.youtube.com/watch?v=KGoSTh1sgyM&list=PL6mfjjCaO1WrEJ0JKRyXO3QjaPkJaSvAS'), 'PL6mfjjCaO1WrEJ0JKRyXO3QjaPkJaSvAS');
  assert.equal(playlistDoRecurso('https://youtube.com/playlist?list=PLcoJJSvnDgcKpOi_UeneTNTIVOigRQwcn&si=RT7FxhHXAYGUuYJD'), 'PLcoJJSvnDgcKpOi_UeneTNTIVOigRQwcn');
  assert.equal(playlistDoRecurso('https://www.youtube.com/watch?v=abc'), null);
});

test('aulas: a duração ISO 8601 da API vira segundos, e o que não se lê vira 0', () => {
  assert.equal(segundosDaDuracao('PT16M52S'), 1012);
  assert.equal(segundosDaDuracao('PT1H2M3S'), 3723);
  assert.equal(segundosDaDuracao('PT45S'), 45);
  assert.equal(segundosDaDuracao('P1DT2H'), 93600);
  assert.equal(segundosDaDuracao('P0D'), 0);
  assert.equal(segundosDaDuracao(undefined), 0);
  assert.equal(segundosDaDuracao('16:52'), 0, 'o formato da página não é o da API');
});

test('aulas: o título perde a etiqueta que repete o curso, e o resto fica como a fonte escreveu', () => {
  assert.equal(tituloDaAula('[CIRCUITOS DIGITAIS] Aula 01 - Introdução aos Circuitos Digitais'), 'Aula 01 - Introdução aos Circuitos Digitais');
  assert.equal(tituloDaAula('[CD] - Aula 2:  Sistemas de Numeração'), 'Aula 2: Sistemas de Numeração');
  assert.equal(tituloDaAula('Aula 3 - Portas lógicas'), 'Aula 3 - Portas lógicas');
});

test('aulas: a aula de exercício é a que a fonte chama assim', () => {
  assert.equal(ehAulaDeExercicio('Aula 04 - Sistemas de Numeração - Exercícios'), true);
  assert.equal(ehAulaDeExercicio('Lista de exercícios 2'), true);
  assert.equal(ehAulaDeExercicio('Resolução da prova'), true);
  assert.equal(ehAulaDeExercicio('Aula 05 - Códigos Binários'), false);
});

test('aulas: a playlist vira a lista da estação, sem vídeo privado ou excluído, numerada de 1', () => {
  const itens = [
    item('a1', '[CD] Aula 01 - Introdução'),
    item('x1', 'Private video', 'private'),
    item('a2', '[CD] Aula 02 - Exercícios'),
    item('x2', 'Deleted video'),
    item('a3', '[CD] Aula 03 - Portas'),
    { snippet: { title: 'sem vídeo' }, contentDetails: {} }
  ];
  const aulas = aulasDaPlaylist(itens, { a1: 'PT16M52S', a2: 'PT32M46S', a3: 'PT19M36S' });
  assert.deepEqual(aulas.map((a) => [a.n, a.id, a.titulo, a.duracaoS, a.exercicio]), [
    [1, 'a1', 'Aula 01 - Introdução', 1012, false],
    [2, 'a2', 'Aula 02 - Exercícios', 1966, true],
    [3, 'a3', 'Aula 03 - Portas', 1176, false]
  ]);
  assert.equal(aulas[0].original, '[CD] Aula 01 - Introdução', 'o título da fonte fica guardado para conferir');
});

test('aulas: o recorte divide uma playlist entre duas estações e renumera cada uma de 1', () => {
  const itens = ['v1', 'v2', 'v3', 'v4', 'v5'].map((v, i) => item(v, `Aula ${i + 1}`));
  const parte1 = aulasDaPlaylist(itens, {}, { ate: 3 });
  const parte2 = aulasDaPlaylist(itens, {}, { de: 4 });
  assert.deepEqual(parte1.map((a) => [a.n, a.id]), [[1, 'v1'], [2, 'v2'], [3, 'v3']]);
  assert.deepEqual(parte2.map((a) => [a.n, a.id]), [[1, 'v4'], [2, 'v5']]);
});

test('aulas: o total da estação e a duração como a placa diz', () => {
  const aulas = aulasDaPlaylist([item('a', 'Aula 1'), item('b', 'Exercícios')], { a: 'PT50M', b: 'PT25M' });
  assert.deepEqual(totalDasAulas(aulas), { aulas: 2, exercicios: 1, segundos: 4500 });
  assert.equal(duracaoLegivel(1012), '17 min');
  assert.equal(duracaoLegivel(20), '1 min');
  assert.equal(duracaoLegivel(4500), '1 h 15 min');
  assert.equal(duracaoLegivel(7200), '2 h');
});

test('aulas: os dados da API valem 30 dias, e o vencido não passa', () => {
  assert.equal(aulasNoPrazo({ validoAte: '2026-12-04' }, '2026-12-04'), true);
  assert.equal(aulasNoPrazo({ validoAte: '2026-12-04' }, '2026-12-05'), false);
  assert.equal(aulasNoPrazo({}, '2026-11-04'), false);
});
