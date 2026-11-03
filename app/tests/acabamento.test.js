// Projeto Atlas — o ACABAMENTO que só o navegador mostrou (S11, 03/11/2026).
// Dois defeitos de leitura que a suíte inteira via verde: o ponto do meio sem
// largura e as etiquetas da folha por cima dos valores. As causas foram medidas
// no navegador; aqui fica a trava do que o node consegue ler, o CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** A regra de um seletor exato, sem os comentários, ou null. */
function regra(css, seletor) {
  const limpo = semComentario(css);
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|})\\s*${escapado}\\s*\\{([^}]*)\\}`, 'm').exec(limpo);
  return m ? m[1] : null;
}

test('acabamento: o ponto do meio não é desenhado pela Overpass, que o tem com largura zero', () => {
  const css = semComentario(ler('web/fontes.css'));
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const overpass = faces.find((f) => /font-family:\s*"Overpass"\s*;/.test(f));
  assert.ok(overpass, 'web/fontes.css sem o @font-face da Overpass');
  const faixa = /unicode-range:\s*([^;]+);/.exec(overpass)?.[1] ?? '';
  const cobre = (cp) => faixa.split(',').map((s) => s.trim().replace(/^U\+/i, '')).some((r) => {
    const [a, b = a] = r.split('-').map((h) => parseInt(h, 16));
    return cp >= a && cp <= b;
  });
  assert.equal(cobre(0xB7), false,
    'a faixa da Overpass cobre o U+00B7: neste woff2 o "·" tem avanço zero e "Linha 1 · estação" sai "Linha 1 ·estação"');
  assert.equal(cobre(0x41) && cobre(0xE7) && cobre(0xE3), true, 'o corte não pode levar junto as letras do português');
});

test('acabamento: os três fatos da folha são uma grade só, com a etiqueta do tamanho da maior', () => {
  const css = ler('web/folha.css');
  const fatos = regra(css, '.folha-fatos');
  const fato = regra(css, '.folha-fato');
  assert.ok(fatos && fato, 'web/folha.css sem .folha-fatos ou .folha-fato');
  assert.match(fatos, /grid-template-columns:\s*max-content\b/,
    'a coluna da etiqueta tem de caber a maior etiqueta ("BIBLIOGRAFIA"): com minmax(0, …) ela vaza por cima do valor');
  assert.match(fato, /display:\s*contents/, 'cada fato com a própria grade desalinha os valores entre as linhas');
  assert.doesNotMatch(semComentario(css), /minmax\(0,\s*var\(--espaco-8\)\)/, 'a coluna de 32 px da etiqueta voltou');
});
