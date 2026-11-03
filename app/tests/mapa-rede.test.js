// Projeto Atlas — o mapa da rede (S11): o diagrama das 35 estações que o cartão
// do link, o topo da Jornada e o bilhete desenham.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mapaDaRede } from '../core/mapa-rede.js';

const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CURSOS = JSON.parse(readFileSync(join(raiz, 'data/catalog.json'), 'utf8')).courses;
const id = (titulo) => CURSOS.find((c) => c.title === titulo).id;
const LINHA_1 = CURSOS.filter((c) => Number(c.stage) === 1).map((c) => c.id);
const NO_MEIO = [...LINHA_1, id('Estruturas de Dados'), id('Álgebra Linear I'), id('Cálculo I'), id('Programação Funcional em Haskell')];

const contar = (svg, padrao) => (svg.match(padrao) ?? []).length;

test('mapa: um SVG com o tamanho pedido e um nome que diz a viagem', () => {
  const svg = mapaDaRede(CURSOS, NO_MEIO, { largura: 528, altura: 502 });
  assert.match(svg, /^<svg [^>]*viewBox="0 0 528 502"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="Mapa da rede: 9 de 35 estações concluídas"/);
});

test('mapa: as 35 estações, cada uma com o estado que a viagem dá', () => {
  const svg = mapaDaRede(CURSOS, NO_MEIO);
  assert.equal(contar(svg, /class="mapa-estacao"/g), 35);
  assert.equal(contar(svg, /data-estado="concluida"/g), 9, 'as casas cheias são as concluídas, nem uma a mais');
  for (const c of CURSOS) assert.match(svg, new RegExp(`data-id="${c.id}"`), `a estação ${c.title} sumiu do mapa`);
});

test('mapa: um selo por linha da fonte, com o número e sem nome inventado', () => {
  const svg = mapaDaRede(CURSOS, []);
  assert.equal(contar(svg, /class="mapa-selo"/g), 7);
  for (let n = 1; n <= 7; n += 1) assert.match(svg, new RegExp(`data-linha="${n}"><circle[^>]*/><text[^>]*>${n}</text>`));
});

test('mapa: uma baldeação por pré-requisito, e as feitas se destacam', () => {
  const total = CURSOS.reduce((s, c) => s + (c.prerequisites ?? []).filter((p) => CURSOS.some((x) => x.id === p)).length, 0);
  assert.ok(total > 20, `a rede da fonte tem ${total} pré-requisitos; com tão poucos, a trava não mediria nada`);
  const svg = mapaDaRede(CURSOS, NO_MEIO);
  assert.equal(contar(svg, /class="mapa-baldeacao/g), total);
  // Estruturas de Dados pede Matemática Discreta e Python I, e as três estão concluídas
  assert.ok(contar(svg, /class="mapa-baldeacao feita"/g) >= 2);
  assert.equal(contar(mapaDaRede(CURSOS, []), /class="mapa-baldeacao feita"/g), 0);
});

test('mapa: o anel de "você está aqui" marca a próxima estação, e só ela', () => {
  assert.equal(contar(mapaDaRede(CURSOS, NO_MEIO), /class="mapa-aqui"/g), 1);
  const todas = CURSOS.map((c) => c.id);
  assert.equal(contar(mapaDaRede(CURSOS, todas), /class="mapa-aqui"/g), 0, 'no Terminal não há próxima estação');
});

test('mapa: o trecho com ponta trancada apaga, e a viagem vazia já abre a Linha 1', () => {
  const vazia = mapaDaRede(CURSOS, []);
  assert.equal(contar(vazia, /class="mapa-linha" data-linha="1"/g), 4, 'a Linha 1 inteira está aberta no começo');
  assert.ok(contar(vazia, /class="mapa-linha trancada"/g) > 0);
  const terminal = mapaDaRede(CURSOS, CURSOS.map((c) => c.id));
  assert.equal(contar(terminal, /class="mapa-linha trancada"/g), 0);
});

test('mapa: as cores são os tokens da casa; quem exporta passa os valores', () => {
  const svg = mapaDaRede(CURSOS, NO_MEIO);
  assert.equal(contar(svg, /#[0-9a-fA-F]{3,8}\b/g), 0, 'cor à mão no SVG do app');
  assert.match(svg, /var\(--linha-1\)/);
  const exportado = mapaDaRede(CURSOS, NO_MEIO, { cores: { linha: () => '#c1121f', fundo: '#fbf7f0', tinta: '#16130f', trilho: '#ded6c8', fonte: 'Overpass' } });
  assert.equal(contar(exportado, /var\(--/g), 0, 'o SVG exportado não pode depender das variáveis da página');
});

test('mapa: o título da estação é texto, nunca marcação', () => {
  const svg = mapaDaRede([{ id: 'x', title: '<script>alert(1)</script>', stage: 1, prerequisites: [] }], []);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});
