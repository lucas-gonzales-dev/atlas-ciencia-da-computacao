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

test('aulas: o título perde o que a tela já diz (o curso, o código, o número), e o resto fica como a fonte escreveu', () => {
  // os títulos abaixo são de playlists reais da UBL, lidos em 04/11/2026
  const casos = [
    ['[CIRCUITOS DIGITAIS] Aula 01 - Introdução aos Circuitos Digitais', 'Circuitos Digitais', 'Introdução aos Circuitos Digitais'],
    ['Matemática Discreta - UFC - Lógica Matemática (aula 01)', 'Matemática Discreta', 'Lógica Matemática (aula 01)'],
    ['Matemática Discreta UFC Lista 1 Questões 13(e,f) e  14', 'Matemática Discreta', 'Lista 1 Questões 13(e,f) e 14'],
    ['Aula #01 - Discussão sobre os Critérios para Avaliação de LPs |  Linguagens de Programação', 'Linguagens de Programação', 'Discussão sobre os Critérios para Avaliação de LPs'],
    ['Geometria Analítica ⭐ Videoaula 1.1 ⭐ Noções iniciais de matrizes', 'Geometria Analítica', 'Noções iniciais de matrizes'],
    ['Cálculo I - Aula 1 (2/3) - Panorama do Cálculo Diferencial e Integral', 'Cálculo I', 'Panorama do Cálculo Diferencial e Integral (2/3)'],
    ['MAT3457 - Álgebra Linear 1 - Aula 12', 'Álgebra Linear I', 'Aula 12'],
    ['Estruturas de Dados: 11 Árvore Binária de Busca', 'Estruturas de Dados', 'Árvore Binária de Busca'],
    ['Busca em profundidade (Turma 01)', 'Algoritmos em Grafos', 'Busca em profundidade'],
    ['Probabilidade Aula 02 - Introdução à Probabilidade', 'Probabilidade e Estatística', 'Introdução à Probabilidade'],
    ['10.2 -  Programação Funcional em Haskell: Estudo de caso: Applicative SafeNum', 'Programação Funcional em Haskell', 'Estudo de caso: Applicative SafeNum'],
    ['Bancos de Dados - Aula 15 - Linguagem de consulta – SQL Parte III', 'Banco de Dados', 'Linguagem de consulta – SQL Parte III'],
    ['Aula 2 - Camada de Aplicação - Redes de Computadores', 'Redes de Computadores', 'Camada de Aplicação'],
    ['ACH2044 - Sistemas Operacionais: Aula 02 - Tipos e Estrutura de um SO', 'Sistemas Operacionais', 'Tipos e Estrutura de um SO'],
    ['Deep Learning - L03 O Perceptron, introdução às redes neurais de camada única part1', 'Deep Learning', 'O Perceptron, introdução às redes neurais de camada única part1'],
    ['O Método Científico (Módulo 1/20)', 'Metodologia da Pesquisa', 'O Método Científico'],
    ['Aula 00 - Introdução | Aplicações | Fases de Compilação | Estrutura de um Compilador', 'Compiladores', 'Introdução | Aplicações | Fases de Compilação | Estrutura de um Compilador']
  ];
  for (const [original, nome, esperado] of casos) assert.equal(tituloDaAula(original, nome), esperado, `${nome}: ${original}`);
});

test('aulas: a limpeza não corta o que é assunto', () => {
  // a primeira palavra do nome só sai antes de "Aula": "Linguagens livres de contexto" é assunto de Linguagens Formais
  assert.equal(tituloDaAula('Linguagens livres de contexto', 'Linguagens Formais e Autômatos'), 'Linguagens livres de contexto');
  assert.equal(tituloDaAula('Aula 02: Fundamentos Matemáticos', 'Fundamentos de Computação Gráfica'), 'Fundamentos Matemáticos');
  // o título que É o nome da estação fica inteiro
  assert.equal(tituloDaAula('Introdução à Engenharia de Software', 'Introdução à Engenharia de Software', { n: 1 }), 'Introdução à Engenharia de Software');
  // o nome sem o número só sai antes de separador: "Álgebra Linear - Aula 10" sim, "Cálculo de Limites" não
  assert.equal(tituloDaAula('MAT3457 - Álgebra Linear - Aula 10', 'Álgebra Linear I', { n: 10 }), 'Aula 10');
  assert.equal(tituloDaAula('Cálculo de Limites e Propriedades', 'Cálculo I'), 'Cálculo de Limites e Propriedades');
  // o número que é parte do assunto fica
  assert.equal(tituloDaAula('29 - 4 Pequenos conceitos úteis', 'Introdução à Ciência da Computação com Python II'), '4 Pequenos conceitos úteis');
  // sem nada além do nome e do número, a aula é "Aula N"
  assert.equal(tituloDaAula('Sistemas Distribuídos - Aula 3', 'Sistemas Distribuídos', { n: 4 }), 'Aula 3');
  // o começo editorial (o erro de digitação da fonte) também sai
  assert.equal(tituloDaAula('Teoria das Grafos  02 Isomorfismo, Decomposição e Petersen', 'Teoria dos Grafos', { prefixos: ['Teoria das Grafos'] }), 'Isomorfismo, Decomposição e Petersen');
});

test('aulas: a aula de exercício é a que a fonte chama assim', () => {
  assert.equal(ehAulaDeExercicio('Aula 04 - Sistemas de Numeração - Exercícios'), true);
  assert.equal(ehAulaDeExercicio('Lista de exercícios 2'), true);
  assert.equal(ehAulaDeExercicio('Resolução da prova'), true);
  assert.equal(ehAulaDeExercicio('Lista 1 Questões 13(e,f) e 14'), true, 'Matemática Discreta: dezenas de "Lista 1 Questão N"');
  assert.equal(ehAulaDeExercicio('Correção da 1ª Avaliação'), true);
  assert.equal(ehAulaDeExercicio('Aula 05 - Códigos Binários'), false);
  assert.equal(ehAulaDeExercicio('Revisão para 2ª Avaliação'), false);
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
    [1, 'a1', 'Introdução', 1012, false],
    [2, 'a2', 'Exercícios', 1966, true],
    [3, 'a3', 'Portas', 1176, false]
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

test('aulas: o recorte em trechos junta pedaços da playlist, na ordem dada (a aula da Parte 1 que ficou no fim)', () => {
  const itens = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((v, i) => item(v, `Aula ${i + 1}`));
  const parte1 = aulasDaPlaylist(itens, {}, { trechos: [[1, 2], [5, 5]] });
  const parte2 = aulasDaPlaylist(itens, {}, { trechos: [[3, 4], [6, 6]] });
  assert.deepEqual(parte1.map((a) => [a.n, a.id]), [[1, 'v1'], [2, 'v2'], [3, 'v5']]);
  assert.deepEqual(parte2.map((a) => [a.n, a.id]), [[1, 'v3'], [2, 'v4'], [3, 'v6']]);
  assert.equal(parte1.length + parte2.length, itens.length, 'nenhuma aula some nem se repete entre as duas');
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
