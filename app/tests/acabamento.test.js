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

/* ── S13c ACABAMENTO (04/11/2026, julgado no Chrome em 375 e 1280 px) ────────
 * Os quatro defeitos abaixo foram vistos na tela, e a causa de cada um é uma
 * linha de CSS. O node não pinta nada, mas lê o arquivo: o que trava aqui é a
 * REGRA que cura, não o pixel. Prova de que a trava morde, feita ao escrevê-la:
 * volta-se `.botao.botao-primario` para `.botao-primario` e o teste 1 cai;
 * volta-se `aria-current` para "true" e o B6 da tela cai; apaga-se o
 * `box-sizing` do `.aulas` e o teste 2 cai.
 */

test('acabamento S13c: o primário e o secundário de aula têm duas classes, e o link não é sublinhado', () => {
  const css = ler('web/folha.css');
  // `.botao.botao-primario` e não `.botao-primario`: com uma classe só, o
  // `.botao` do metro.css (carregado depois) empata e vence. A trava é pelo
  // seletor EXATO, porque é a segunda classe que faz o peso.
  for (const seletor of ['.botao.botao-primario', '.botao.botao-secundario']) {
    const corpo = regra(css, seletor);
    assert.ok(corpo, `web/folha.css sem a regra ${seletor}: o metro.css gagne pela ordem e o botão sai caixa clara`);
  }
  assert.match(regra(css, '.botao.botao-primario'), /background:\s*var\(--cor\)/,
    'o primário é recheado na cor da linha, como era o "Começar a estudar"');
  assert.match(regra(css, '.botao.botao-secundario'), /background:\s*var\(--superficie\)/,
    'e o secundário é contorno');

  // O primário de aula é um <a>, e um <a> traz sublinhado e display inline do
  // documento: sem isto ele parece texto no meio de uma fileira de botões.
  const a = regra(css, 'a.botao');
  assert.ok(a, 'web/folha.css sem a regra a.botao: o link de aula sai sublinhado e sem alinhamento');
  assert.match(a, /text-decoration:\s*none/, 'ainda há sublinhado no botão-link');
  assert.match(a, /display:\s*inline-flex/, 'inline não alinha o texto dentro do botão');
  assert.match(a, /align-items:\s*center/);
});

test('acabamento S13c: a página de aulas é uma caixa de borda fechada e uma coluna só', () => {
  const css = ler('web/telas/aulas.css');
  // 375 px: `width: 100%` com padding sem border-box é uma caixa de 407 px, e a
  // página inteira (div, cabeçalho, h1, painel, lista) passa da borda com a
  // duração cortada.
  const aulas = regra(css, '.aulas');
  assert.ok(aulas, 'web/telas/aulas.css sem a regra .aulas');
  assert.match(aulas, /box-sizing:\s*border-box/,
    'o .aulas voltou a somar o padding à largura: em 375 px a página passa da borda');

  // 1280 px: com `repeat(2, …)` na lista cada coluna ficava com ~340 px, o
  // título encolhia a zero e "Não iniciada" era desenhado POR CIMA dele.
  // O desenho pedido é uma coluna de no máximo --largura-leitura.
  const limpo = semComentario(css);
  assert.doesNotMatch(limpo, /repeat\(2/,
    'voltou a lista de duas colunas: o título encolhe a zero e o estado se desenha sobre ele');
  assert.match(limpo, /grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto/,
    'a linha é marca, número, título (a que encolhe) e duração');
  assert.match(limpo, /-webkit-line-clamp:\s*2/, 'o título longo quebra em duas linhas e corta');
});

test('acabamento S13c: o anel de "você está aqui" é da marca, e o token de 720 px existe', () => {
  const css = ler('web/telas/aulas.css');
  // A marca é o estado desenhado; o nome vai em .so-leitor. Se alguém devolver
  // o estado como coluna visível, a trava da linha (acima) e esta pegam.
  const anel = regra(css, '.aula-link[aria-current="step"] .aula-marca');
  assert.ok(anel, 'web/telas/aulas.css sem o anel em .aula-link[aria-current="step"] .aula-marca');
  assert.match(anel, /box-shadow:\s*0 0 0/, 'o anel é box-shadow sem deslocamento, como o selo da linha atual no metro.css');
  assert.doesNotMatch(semComentario(ler('web/telas/aulas.css')), /\.aula-link\[aria-current[^\]]*\]\s*\{[^}]*border-left/,
    'voltou a barra preta de 6 px à esquerda: era ela que empurrava o título sob o estado');

  // A largura de leitura mora no token (regra 11), não na tela.
  const tokens = ler('web/tokens.css');
  assert.match(tokens, /--largura-leitura:\s*720px/, 'falta o token --largura-leitura no tokens.css');
  assert.match(css, /max-width:\s*var\(--largura-leitura\)/, 'a página não lê o token: o número voltaria à mão');
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
