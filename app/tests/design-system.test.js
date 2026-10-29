// Projeto Atlas — a trava do design system (design/README.md, seção
// "Como conferir").
//
// Um design system sem trava vira documento: alguém pinta um botão de azul da
// cabeça e ninguém reprova. Este arquivo é o que faz o documento valer. Ele não
// julga gosto — julga o que dá para medir sem navegador:
//
//   1. FONTE: nenhum arquivo repete sha256 (o Google entrega a Overpass como
//      fonte VARIÁVEL: três pesos são UM arquivo. Copiar o mesmo binário três
//      vezes com nomes diferentes custa ~100 KB de cache e não muda um pixel),
//      o sha256 do disco confere com o registrado no CREDITS.md, e cada
//      @font-face declara um INTERVALO de peso — não um número único, que é
//      justamente o que faz alguém baixar a mesma fonte três vezes.
//   2. COR E TEMPO: nenhuma cor nem duração escrita à mão fora do tokens.css, e
//      @media só com os quatro números declarados.
//   3. CONTRASTE: as cores das 7 linhas e a de obras passam de 4,5:1 sobre
//      fundo E superfície, nos dois temas (WCAG 2.1 AA). Calculado aqui, não
//      medido a olho.
//   4. TEXTOS: core/textos.js não tem texto vazio, as funções usam o parâmetro
//      que recebem, e os oito estados obrigatórios existem.
//   5. HEURÍSTICAS: a tabela do design/README.md §8 tem as 10, numeradas de 1 a
//      10, e a coluna "Onde se confere" preenchida — com teste que EXISTE no
//      disco, ou com a captura de tela que falta. O documento diz que coluna
//      vazia reprova a suíte; este item é o que torna essa frase verdade.
//
// LIMITE HONESTO: node não tem navegador. O que se prova é o que falharia em
// silêncio no código; como a tela aparece de verdade se confere com
// testar_pagina e no Android.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTOS, placa, comValores, estados, legenda, proibido } from '../core/textos.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)); // app/
const REPO = fileURLToPath(new URL('../..', import.meta.url)); // raiz do repositório
const ler = (caminho) => readFile(join(RAIZ, caminho), 'utf8');
const norm = (caminho) => relative(RAIZ, caminho).split(sep).join('/');

/** Tudo que o navegador baixa, exceto testes e dependências. */
async function daApp(pasta = RAIZ, saida = []) {
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    const c = join(pasta, e.name);
    if (e.isDirectory()) {
      if (e.name === 'tests' || e.name === 'node_modules') continue;
      await daApp(c, saida);
    } else saida.push(c);
  }
  return saida;
}

// ---------------------------------------------------------------------------
// 1. FONTE
// ---------------------------------------------------------------------------

async function fontes() {
  const todas = (await daApp()).filter((c) => /\.woff2?$/.test(c));
  const comHash = await Promise.all(
    todas.map(async (c) => ({
      caminho: norm(c),
      bytes: (await readFile(c)).length,
      sha256: createHash('sha256').update(await readFile(c)).digest('hex'),
    })),
  );
  return comHash;
}

test('fonte: existe pelo menos uma família, e o app não desenha com fonte do sistema', async () => {
  const f = await fontes();
  assert.ok(f.length >= 1, 'sem fonte própria o Atlas tem cara de protótipo (design/README.md §3)');
  const tokens = await ler('web/tokens.css');
  assert.match(tokens, /--fonte-placa:\s*"Overpass"/, 'a fonte de placa não é a Overpass');
  assert.match(tokens, /--fonte-mono:\s*"Overpass Mono"/, 'a fonte de número não é a Overpass Mono');
});

test('fonte: NENHUM arquivo repete sha256 — o mesmo binário com dois nomes é desperdício', async () => {
  const f = await fontes();
  const porHash = new Map();
  for (const x of f) {
    if (!porHash.has(x.sha256)) porHash.set(x.sha256, []);
    porHash.get(x.sha256).push(x.caminho);
  }
  const duplicadas = [...porHash.entries()].filter(([, v]) => v.length > 1);
  assert.deepEqual(
    duplicadas.map(([h, v]) => `${h.slice(0, 8)}…: ${v.join(' = ')}`),
    [],
    'arquivos de fonte idênticos: fonte variável é UM arquivo por família, com '
      + 'font-weight em intervalo. Três pesos da Overpass são o MESMO woff2.',
  );
  // Reforço: um arquivo por família, não um por peso.
  const familias = new Set((await ler('web/fontes.css')).match(/font-family:\s*"([^"]+)"/g) ?? []);
  assert.equal(
    f.length,
    familias.size,
    `${f.length} arquivos para ${familias.size} famílias: sobrou arquivo`,
  );
});

test('fonte: o sha256 do disco é o que o CREDITS.md registra (proveniência auditável)', async () => {
  const credits = await readFile(join(REPO, 'CREDITS.md'), 'utf8');
  const f = await fontes();
  for (const x of f) {
    assert.ok(
      credits.includes(x.sha256),
      `${x.caminho} (sha256 ${x.sha256.slice(0, 12)}…) não está registrado no CREDITS.md`,
    );
    const nome = x.caminho.split('/').pop();
    assert.ok(credits.includes(nome), `${nome} não é nomeado no CREDITS.md`);
  }
  // A licença da fonte tem de estar transcrita, não só citada (OFL §2 exige o texto).
  assert.match(credits, /SIL OPEN FONT LICENSE Version 1\.1/, 'o texto da OFL não está no CREDITS.md');
  assert.match(credits, /Overpass Project Authors/, 'falta o copyright da Overpass');
});

test('fonte: cada @font-face declara INTERVALO de peso e um arquivo que existe', async () => {
  const css = await ler('web/fontes.css');
  const faces = css.match(/@font-face\s*\{[\s\S]*?\}/g) ?? [];
  assert.ok(faces.length >= 2, 'esperava o @font-face da Overpass e o da Mono');
  for (const face of faces) {
    const familia = /font-family:\s*"([^"]+)"/.exec(face)?.[1];
    // Número único de peso com fonte variável é o erro que gera arquivo duplicado.
    const peso = /font-weight:\s*([^;]+);/.exec(face)?.[1].trim();
    assert.match(
      peso ?? '',
      /^\d+\s+\d+$/,
      `@font-face de "${familia}" declara font-weight: ${peso} — fonte variável declara INTERVALO (ex.: 100 900)`,
    );
    const [min, max] = peso.split(/\s+/).map(Number);
    assert.ok(min < max, `intervalo de "${familia}" não é intervalo: ${peso}`);
    // Os pesos que o design system usa cabem no intervalo declarado.
    for (const p of [400, 700]) {
      assert.ok(p >= min && p <= max, `"${familia}" não cobre o peso ${p} que o app usa`);
    }
    const src = /url\("([^"]+)"\)/.exec(face)?.[1];
    assert.ok(src, `@font-face de "${familia}" sem src`);
    const alvo = join(RAIZ, 'web', src);
    await assert.doesNotReject(readFile(alvo), `@font-face de "${familia}" aponta para ${src}, que não existe`);
    // font-display: block — a fonte É a cara; trocar por outra no lugar dela é pior.
    assert.match(face, /font-display:\s*block/, `"${familia}" sem font-display: block`);
  }
});

test('fonte: os woff2 estão no precache — offline sem a fonte é outra cara', async () => {
  const sw = await ler('sw.js');
  const bloco = /PRECACHE\s*=\s*\[([\s\S]*?)\]/.exec(sw);
  assert.ok(bloco, 'sw.js sem array PRECACHE explícito');
  const precached = [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const f = await fontes();
  for (const x of f) {
    assert.ok(precached.includes(x.caminho), `${x.caminho} fora do precache`);
  }
  assert.match(await ler('web/fontes.css'), /unicode-range:/, 'sem unicode-range o navegador baixa subconjuntos que não usa');
});

// ---------------------------------------------------------------------------
// 2. COR, DURAÇÃO E LARGURA
// ---------------------------------------------------------------------------

/** Arquivos que vão para a tela, exceto o lugar onde a cor/duração PODE morar. */
async function daTela() {
  const permitidos = /\.(css|html|js)$/;
  const fora = new Set(['web/tokens.css', 'sw.js', 'tests']);
  return (await daApp())
    .map(norm)
    .filter((c) => permitidos.test(c) && !fora.has(c) && !c.startsWith('tests/'));
}

test('cor: nenhuma cor escrita à mão fora do tokens.css', async () => {
  // Propriedade de cor seguida de valor cru: pega #hex, rgb(), rgba(), hsl().
  const crua = /(?:^|[\s;{])(?:color|background|background-color|border|border-color|border-top|border-bottom|border-left|border-right|outline|fill|stroke|box-shadow|text-shadow|caret-color|column-rule)\s*:[^;{}]*?(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/g;
  const achados = [];
  for (const c of await daTela()) {
    const texto = await ler(c);
    for (const m of texto.matchAll(crua)) {
      const linha = texto.slice(0, m.index).split('\n').length;
      achados.push(`${c}:${linha} → ${m[1]}`);
    }
  }
  assert.deepEqual(achados, [], 'cor fora dos tokens: use var(--p-*) do tokens.css (design/README.md §2)');
});

test('tempo: nenhuma duração escrita à mão fora do tokens.css', async () => {
  const crua = /(?:transition|animation|transition-duration|animation-duration|animation-delay|transition-delay)\s*:[^;{}]*?(\d+(?:\.\d+)?m?s)/g;
  const achados = [];
  for (const c of await daTela()) {
    const texto = await ler(c);
    for (const m of texto.matchAll(crua)) {
      const linha = texto.slice(0, m.index).split('\n').length;
      achados.push(`${c}:${linha} → ${m[1]}`);
    }
  }
  assert.deepEqual(achados, [], 'duração à mão: use var(--dur-*) (design/README.md §5)');
});

test('largura: @media só com os números que os tokens --bp-* declaram', async () => {
  // A lista de breakpoints NÃO é chutada aqui: ela é lida dos tokens. Se o
  // design system mudar de largura, muda-se o token e este teste acompanha.
  const css = await ler('web/tokens.css');
  const tokens = [...css.matchAll(/(--bp-[a-z-]+):\s*(\d+)px/g)];
  assert.ok(tokens.length >= 3, 'tokens.css sem breakpoints declarados (--bp-*)');
  const declarados = new Set(tokens.map((m) => Number(m[2])));
  const achados = [];
  for (const c of await daTela()) {
    const texto = await ler(c);
    for (const m of texto.matchAll(/@media[^{]*/g)) {
      // prefers-color-scheme e prefers-reduced-motion não têm px; só largura conta.
      if (/min-width|max-width/.test(m[0])) {
        for (const px of m[0].matchAll(/(\d+)px/g)) {
          if (!declarados.has(Number(px[1]))) {
            const linha = texto.slice(0, m.index).split('\n').length;
            achados.push(`${c}:${linha} → @media com ${px[1]}px (tokens: ${[...declarados].join(', ')})`);
          }
        }
      }
    }
  }
  assert.deepEqual(achados, [], 'breakpoint fora dos tokens (design/README.md §7)');
});

// ---------------------------------------------------------------------------
// 3. CONTRASTE (WCAG 2.1 AA, texto normal: 4,5:1)
// ---------------------------------------------------------------------------

const hexParaRgb = (hex) => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};

function luminancia(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const razao = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/**
 * Os dois temas como o tokens.css os escreve: o claro é o que vem antes do
 * @media escuro, o escuro é o bloco prefers-color-scheme: dark. Nomes reais dos
 * tokens: --fundo, --superficie, --tinta, --fosca, --linha-1..7. (Os --p-* que
 * aparecem no fim do arquivo são a paleta ANTIGA, marcada PROVISÓRIO.)
 */
function coresPorTema(css) {
  const iniEscuro = css.search(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{/);
  assert.ok(iniEscuro >= 0, 'tokens.css sem o tema escuro (@media prefers-color-scheme: dark)');
  const fimEscuro = css.indexOf('}', css.indexOf('{', iniEscuro));
  const pega = (texto, nome) => new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(texto)?.[1];
  const tema = (texto) => ({
    fundo: pega(texto, 'fundo'),
    superficie: pega(texto, 'superficie'),
    linhas: [...texto.matchAll(/--(linha-\d):\s*(#[0-9a-fA-F]{6})/g)].map((m) => ({ token: `--${m[1]}`, hex: m[2] })),
    texto: pega(texto, 'tinta'),
    textoSuave: pega(texto, 'fosca'),
  });
  return {
    claro: tema(css.slice(0, iniEscuro)),
    escuro: tema(css.slice(iniEscuro, fimEscuro)),
  };
}

for (const tema of ['claro', 'escuro']) {
  test(`contraste no tema ${tema}: as 7 cores de linha passam de 4,5:1 (AA)`, async () => {
    const { fundo, superficie, linhas } = coresPorTema(await ler('web/tokens.css'))[tema];
    assert.ok(fundo && superficie, `tokens.css: --fundo/--superficie faltando no tema ${tema}`);
    assert.equal(linhas.length, 7, `esperava as 7 linhas no tema ${tema}, vieram ${linhas.length}`);
    const reprovadas = [];
    for (const c of linhas) {
      for (const [nomeBase, base] of [['--fundo', fundo], ['--superficie', superficie]]) {
        const r = razao(hexParaRgb(c.hex), hexParaRgb(base));
        if (r < 4.5) reprovadas.push(`${c.token} sobre ${nomeBase}: ${r.toFixed(2)}:1`);
      }
    }
    assert.deepEqual(reprovadas, [], 'contraste abaixo de AA: a cor da linha é texto na placa (design/README.md §4)');
  });

  test(`contraste no tema ${tema}: o texto sobre o fundo passa de 4,5:1 (AA)`, async () => {
    const { fundo, texto, textoSuave } = coresPorTema(await ler('web/tokens.css'))[tema];
    for (const [nome, cor] of [['--tinta', texto], ['--fosca', textoSuave]]) {
      assert.ok(cor, `${nome} faltando no tema ${tema}`);
      const r = razao(hexParaRgb(cor), hexParaRgb(fundo));
      assert.ok(r >= 4.5, `${nome} sobre --fundo no tema ${tema}: ${r.toFixed(2)}:1`);
    }
  });
}

// DÍVIDA CONHECIDA (29/10/2026): o index.html ainda pinta com os tokens --p-*,
// a paleta de protótipo que o design system substituiu. A trava está escrita e
// certa — 31 usos no index.html é o que falta migrar. Fica como `todo` para não
// esconder a dívida atrás de um verde falso: quando a migração acontecer, tira-se
// o todo e ela passa a reprovar quem voltar para a paleta antiga.
test('a paleta antiga (--p-*) não pinta mais nenhuma tela', { todo: 'migrar os 31 usos de --p-* no index.html para os tokens do DS' }, async () => {
  // Os tokens --p-* existem no tokens.css marcados como PROVISÓRIO: são a paleta
  // de protótipo que o design system substituiu. Enquanto alguma regra da tela
  // os usar, o DS não está aplicado de verdade.
  const achados = [];
  for (const c of await daTela()) {
    const texto = await ler(c);
    for (const m of texto.matchAll(/var\(\s*(--p-[a-z-]+)/g)) {
      const linha = texto.slice(0, m.index).split('\n').length;
      achados.push(`${c}:${linha} → ${m[1]}`);
    }
  }
  assert.deepEqual(achados, [], 'tela ainda pinta com a paleta provisória: migre para o token do DS');
});

// ---------------------------------------------------------------------------
// 4. TEXTOS
// ---------------------------------------------------------------------------

test('textos: nada vazio, nada "undefined", nada com slug de código', async () => {
  const ruins = [];
  const ver = (onde, valor) => {
    if (typeof valor !== 'string') return;
    if (!valor.trim()) ruins.push(`${onde}: texto vazio`);
    if (/undefined|null|NaN|\[object/.test(valor)) ruins.push(`${onde}: "${valor}"`);
    // Nome de campo, caminho ou jargão não é texto de tela (§1).
    if (/[a-z]+_[a-z]+|\.(js|json|css)\b|\/[a-z-]+\//.test(valor)) ruins.push(`${onde}: "${valor}" parece código`);
  };
  for (const [k, v] of Object.entries(placa)) ver(`placa.${k}`, v);
  for (const [k, v] of Object.entries(estados)) {
    for (const [campo, texto] of Object.entries(v)) ver(`estados.${k}.${campo}`, texto);
  }
  for (const item of legenda.itens) {
    ver('legenda.forma', item.forma);
    ver('legenda.significado', item.significado);
  }
  for (const item of legenda.atalhos) {
    ver('legenda.tecla', item.tecla);
    ver('legenda.acao', item.acao);
  }
  assert.deepEqual(ruins, [], 'texto de tela inválido (design/README.md §1 e §6)');
});

test('textos: as funções com valor usam o valor que recebem', async () => {
  const exemplos = {
    linha: [3],
    trancadaFalta: ['Cálculo I'],
    trancadaFaltam: ['Cálculo I e Cálculo II'],
    baldeacao: ['Algoritmos II', 4],
    buscaVazia: ['quântica'],
    viagem: [12, 35],
    progressoLinha: [2, 3, 5],
    erroOQue: ['o mapa'],
    erroPorQue: ['a rede caiu'],
    erroOQueFazer: [],
    ramalEmObras: ['Inteligência Artificial'],
    linkBibliografia: ['Estruturas de Dados'],
  };
  for (const [nome, fn] of Object.entries(comValores)) {
    assert.equal(typeof fn, 'function', `comValores.${nome} não é função`);
    const args = exemplos[nome];
    assert.ok(args, `comValores.${nome} sem valor de exemplo neste teste`);
    const saida = fn(...args);
    assert.ok(typeof saida === 'string' && saida.trim(), `comValores.${nome} devolveu vazio`);
    // A prova de que o parâmetro entrou: o texto cita o valor.
    for (const a of args) {
      assert.ok(
        saida.includes(String(a)),
        `comValores.${nome}(${args.join(', ')}) devolveu "${saida}" — o valor não aparece no texto`,
      );
    }
  }
});

test('textos: os oito estados obrigatórios existem, e o erro tem as três partes', async () => {
  const obrigatorios = [
    'carregando',
    'primeiraVisita',
    'buscaSemResultado',
    'offline',
    'fimDaLinha',
    'terminal',
    'erro',
    'ramalEmObras',
  ];
  for (const e of obrigatorios) {
    assert.ok(estados[e], `estado "${e}" não existe em core/textos.js (design/README.md §6)`);
    assert.ok(estados[e].titulo?.trim(), `estado "${e}" sem título`);
    assert.ok(
      estados[e].descricao?.trim() || estados[e].parteUm?.trim(),
      `estado "${e}" sem descrição`,
    );
  }
  // Erro em três partes: sem a terceira não há ação, só culpa.
  for (const parte of ['parteUm', 'parteDois', 'parteTres']) {
    assert.ok(estados.erro[parte]?.trim(), `estados.erro sem ${parte}`);
  }
  assert.ok(
    /motivo/i.test(estados.erro.parteDois),
    'a parte dois do erro não diz o porquê',
  );
});

test('textos: o proibido está escrito em código, para o próximo desenvolvedor achar', async () => {
  assert.ok(Array.isArray(proibido) && proibido.length >= 10, 'a lista do proibido sumiu');
  for (const item of proibido) assert.ok(item.trim(), 'item vazio na lista do proibido');
  assert.equal(TEXTOS.proibido, proibido, 'TEXTOS não exporta a lista do proibido');
});

// ---------------------------------------------------------------------------
// 5. HEURÍSTICAS (design/README.md §8)
// ---------------------------------------------------------------------------
// O documento afirma: "Se a coluna 'Onde se confere' estiver vazia, a
// heurística não está implementada — e o teste design-system.test.js reprova".
// Nada lia a tabela, então a afirmação era falsa: uma heurística podia perder a
// forma de conferir sem que nenhum teste caísse. Agora cai.

/** O texto de uma seção `##` do documento, até a próxima seção. */
function secaoDe(texto, titulo) {
  const inicio = texto.indexOf(titulo);
  assert.ok(inicio >= 0, `a seção "${titulo}" sumiu do design/README.md`);
  const fim = texto.indexOf('\n## ', inicio + titulo.length);
  return texto.slice(inicio, fim < 0 ? texto.length : fim);
}

/** As linhas de dados de uma tabela markdown: [célula1, célula2, …]. */
function linhasDaTabela(secao) {
  return secao
    .split('\n')
    .filter((l) => /^\|\s*\d+\s*\|/.test(l)) // só linha que COMEÇA com número
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

test('heurísticas: as 10 na tabela, numeradas, cada uma com onde se confere', async () => {
  const doc = await readFile(join(REPO, 'design/README.md'), 'utf8');
  const linhas = linhasDaTabela(secaoDe(doc, '## 8. As 10 heurísticas'));

  assert.deepEqual(
    linhas.map((c) => c[0]),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    'a tabela das heurísticas não tem as 10 linhas numeradas de 1 a 10',
  );

  for (const c of linhas) {
    const [n, nome, regra, onde] = c;
    assert.ok(/\S/.test(nome ?? ''), `heurística ${n}: sem nome`);
    assert.ok(
      (regra ?? '').length >= 40,
      `heurística ${n} (${nome}): a regra concreta está vazia — o DS tem de ser `
        + 'preciso o bastante para ser seguido sem olhar a tela',
    );
    assert.ok(
      /\.test\.js|captura/.test(onde ?? ''),
      `heurística ${n} (${nome}): "Onde se confere" vazia. Coluna vazia é `
        + 'heurística não implementada — aponte o teste que a cobre ou escreva '
        + 'que falta a captura de tela',
    );
    // Citar teste que não existe é o mesmo buraco com outra roupa: a coluna
    // fica preenchida e a prova, ausente.
    for (const m of (onde ?? '').matchAll(/tests\/([\w.-]+\.test\.js)/g)) {
      await readFile(join(RAIZ, 'tests', m[1]), 'utf8').catch(() =>
        assert.fail(`heurística ${n} cita tests/${m[1]}, que não existe no disco`),
      );
    }
  }
});
