// Projeto Atlas — S10-auditoria, réguas 2 (movimento) e 5 (temas).
//
// Por que um arquivo separado: design-system.test.js já confere cada fatia
// sozinha (nenhuma duração à mão, nenhuma cor à mão, as 7 linhas sobre o fundo).
// As duas réguas desta fatia perguntam outra coisa, e é no ENCONTRO delas que o
// defeito mora:
//
//   2. MOVIMENTO — o que se repete é só o anel da próxima estação; e com
//      prefers-reduced-motion: reduce NENHUMA duração de movimento sobrevive,
//      nem como atraso. Um esqueleto que "respira" é o spinner que a lista do
//      proibido (design/README.md §9, core/textos.js) manda não desenhar.
//   5. TEMAS — o contraste não é propriedade do token sozinho: é do PAR
//      tinta × fundo que a regra CSS escreve. --tinta passa 17:1 sobre o papel e
//      1,05:1 sobre o papel FIXO da marca no escuro. Enquanto a trava olhava só
//      a lista de tokens, esse par nunca foi perguntado a ninguém.
//
// LIMITE HONESTO: node não tem navegador. O que se prova aqui é o que o CSS
// declara, resolvido pelos dois temas como o tokens.css os escreve. Como a tela
// aparece de verdade se confere com testar_pagina e no Android.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)); // app/
const ler = (c) => readFile(join(RAIZ, c), 'utf8');
const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

/** web/, com caminho relativo a app/ — css/. O motor de desenho do atlas
    (web/metro.js) monta `animation:` dentro de string de template: o CSS nao e o
    unico lugar onde um tempo de movimento nasce. Quem so ler as folhas le a metade
    de aonde o movimento vai chegar na tela. */
async function arquivosDe(pattern, minimo) {
  const saida = [];
  const ande = async (p) => {
    for (const e of await readdir(p, { withFileTypes: true })) {
      const c = join(p, e.name);
      if (e.isDirectory()) await ande(c);
      else if (e.name.endsWith(pattern)) saida.push(c.slice(join(RAIZ, 'web').length - 3).split('\\').join('/'));
    }
  };
  await ande(join(RAIZ, 'web'));
  assert.ok(saida.length >= minimo, `esperava ao menos ${minimo} ${pattern} em web/, vieram ${saida.length}`);
  return saida;
}

const cssDaTela = () => arquivosDe('.css', 8);
const jsDaTela = () => arquivosDe('.js', 10);

/** Regras `{ seletor { corpo } }` no nível mais interno, sem @media no seletor. */
function regras(textoCss) {
  const limpo = semComentario(textoCss);
  const out = [];
  for (const m of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const seletor = m[1].trim().replace(/\s+/g, ' ');
    if (seletor.startsWith('@') || /@/.test(seletor)) continue;
    out.push({ seletor, corpo: m[2] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// O MOTOR DE COR — o mesmo de design-system.test.js (WCAG 2.1, texto normal),
// aplicado a pares em vez de a uma lista de tokens.
// ---------------------------------------------------------------------------

const hexParaRgb = (hex) => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};

const luminancia = (rgb) => {
  const [r, g, b] = rgb.map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const razao = (a, b) => {
  const [x, y] = [luminancia(hexParaRgb(a)), luminancia(hexParaRgb(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/**
 * Os dois temas como o tokens.css os escreve, já resolvidos até a cor plana.
 * --cor e --selo-linha não moram no tokens.css: são a cor da LINHA, definida por
 * .l1 … .l7 (metro.css) e por [data-linha] (perfil.css). Valemos por as 7, e o
 * veredito de um par que usa --cor é o PIOR dos 7 — é assim que a tela responde,
 * porque a linha da estação não é escolha nossa.
 */
async function temas() {
  // SEM COMENTÁRIOS, e é requisito, não higiene: o primeiro '@media' do arquivo é
  // PROSA (a nota dos breakpoints: "CSS não aceita var() dentro de @media"). Uma
  // regex que procura '@media ... dark ... {' a partir dele atravessa o resto do
  // :root até o '{' do @media real — e o "bloco escuro" passa a ser o rabo do
  // :root, onde não há cor nenhuma. Foi assim que, em 03/11/2026, os dois temas
  // do teste eram o MESMO tema, claro, e o escuro nunca foi medido.
  const css = semComentario(await ler('web/tokens.css'));
  const iniReal = css.search(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{/);
  assert.ok(iniReal >= 0, 'tokens.css sem o tema escuro');
  // Guarda do parser: o '@media' achado tem de ser um bloco que DECLARA CORES, e o
  // corpo dele tem de ser um ':root'. Se o parser escorregar para outra prosa, o
  // ':root' não aparece e a suíte para aqui, em vez de medir o claro duas vezes.
  const iniCorpo = css.indexOf('{', iniReal);
  const raiz = /:root\s*\{/.exec(css.slice(iniCorpo));
  assert.ok(raiz, 'o bloco prefers-color-scheme: dark não tem um :root dentro — o parser de tema escorregou');
  const iniRaiz = iniCorpo + raiz.index + raiz[0].length;
  const iniEscuro = iniRaiz;
  const blocoEscuro = css.slice(iniRaiz, css.indexOf('}', iniRaiz));
  const mapa = (texto) => {
    const m = {};
    for (const t of texto.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
      if (!(t[1] in m)) m[t[1]] = t[2].trim();
    }
    return m;
  };
  const claro = mapa(css.slice(0, iniEscuro));
  const escuroDeclarado = mapa(blocoEscuro);
  const escuro = { ...claro, ...escuroDeclarado }; // :root dentro do @media só troca o que declara
  // GUARDA DE TEMA — a peça que faltava, e faltou caro. Não basta o parser achar
  // um bloco: o escuro tem de ser OUTRO tema. As cores planas que ele declara têm
  // de ser muitas e têm de DIFFERIR do claro. Se o parser escorregar de novo para
  // o :root claro, isto quebra aqui, em vez de medir o mesmo par duas vezes e
  // devolver verde — que é exatamente o que aconteceu com a régua 5 hoje.
  const trocadas = Object.entries(escuroDeclarado).filter(([nome, valor]) =>
    /^#[0-9a-f]{3,8}$/i.test(valor) && claro[nome] !== valor);
  assert.ok(
    trocadas.length >= 12,
    `o tema escuro só troca ${trocadas.length} cores planas [${trocadas.map(([n]) => n).join(', ')}]; `
      + 'esperava as 7 linhas + fundo, superfície, tinta, fosca, borda, trancada, alerta e alerta-fundo. '
      + 'Ou o bloco dark perdeu valores, ou o parser leu o :root claro outra vez.',
  );
  const linhas = [...Array(7).keys()].map((i) => `--linha-${i + 1}`);

  const planos = {};
  for (const tema of ['claro', 'escuro']) {
    const bruto = tema === 'claro' ? claro : escuro;
    planos[tema] = {};
    for (const [nome, valor] of Object.entries(bruto)) {
      const hex = /^#[0-9a-fA-F]{3,8}$/.test(valor) ? valor : null;
      const ref = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valor);
      const resolvido = hex ?? (ref ? (/^#[0-9a-fA-F]{3,8}$/.test(bruto[ref[1]] ?? '') ? bruto[ref[1]] : null) : null);
      if (resolvido) planos[tema][nome] = resolvido;
    }
    // --cor é a cor da linha: para o par, as 7 contam, e o teste usa a pior.
    planos[tema]['--cor'] = linhas.map((l) => planos[tema][l]).filter(Boolean);
    planos[tema]['--selo-linha'] = planos[tema]['--cor'];
  }
  return planos;
}

/** O nome do token que a propriedade usa, ou null se ela não usa var(). */
function tokenDe(propriedade, corpo) {
  const re = new RegExp(`(?:^|[;\\s])${propriedade}\\s*:\\s*var\\(\\s*(--[a-z0-9-]+)\\s*(?:,)?[^)]*\\)`, 'i');
  const m = re.exec(corpo);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// RÉGUA 2 — MOVIMENTO
// ---------------------------------------------------------------------------

test('movimento: o único movimento que se repete é o anel da próxima estação', async () => {
  // design/v2/S10-auditoria.md, régua 2. A exceção existe e é UMA: --pulso-repeticoes
  // alimenta o anel "você está aqui" (.forma.proxima), que pulsa duas vezes e para.
  // Qualquer outra regra que use esse token está pedindo repetição para outra coisa
  // — e repetição em esqueleto de carregando é o spinner da lista do proibido
  // (core/textos.js: "spinner", "brilho de esqueleto correndo (shimmer)"; a regra
  // está escrita também em telas/jornada.css: "sem animation (pulso em esqueleto é
  // spinner)").
  const achados = [];
  for (const c of await cssDaTela()) {
    for (const { seletor, corpo } of regras(await ler(c))) {
      const anim = /(?:^|[;\s])animation\s*:\s*([^;]+)/i.exec(corpo)?.[1];
      if (!anim) continue;
      const repete = /infinite|--pulso-repeticoes/.test(anim);
      if (repete && seletor !== '.forma.proxima') {
        achados.push(`${c} → ${seletor} { animation: ${anim.trim()} }`);
      }
    }
  }
  assert.deepEqual(
    achados,
    [],
    'movimento que se repete fora do pulso da próxima estação: o único anel que '
      + 'pulsa é o da estação onde a pessoa está. Um esqueleto que respira é '
      + 'spinner — deixe o cinza parado, como telas/jornada.css faz. (S10, régua 2)',
  );
});

test('movimento: todo tempo de movimento declarado em CSS vem de token, não de número', async () => {
  // Terceira cláusula da régua 2, e a que a casa mais fácil de perder: um 300ms solto
  // num arquivo de tela funciona, passa no olho, e o bloco reduce não o alcança —
  // ele zera TOKENS, não literals. É o mesmo mecanismo do --atraso-esqueleto que
  // acabou de ser pego: quem escreve o número fora do token escreve movimento que
  // sobrevive ao movimento reduzido.
  const achados = [];
  for (const c of await cssDaTela()) {
    for (const { seletor, corpo } of regras(await ler(c))) {
      for (const prop of ['animation-duration', 'animation-delay', 'transition-duration', 'transition-delay', 'animation', 'transition']) {
        const re = new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, 'i');
        const m = re.exec(corpo);
        if (!m) continue;
        const semVar = m[1].replace(/var\(--[a-z0-9-]+(?:[^)]*)\)/gi, ' ');
        // Zero literal NÃO é infração: é exatamente o que o bloco reduce escreve
        // (animation-duration: 0ms !important), e tempo zero não escapa de nada
        // porque já é ausência de movimento. O que a cláusula pega é número VIVO
        // fora de token — esse sim sobrevive ao reduce, que só zera tokens.
        const bruto = /(?<![\d.])\d*\.?\d+m?s\b/.exec(semVar);
        if (bruto && !/^0(\.0+)?m?s$/.test(bruto[0])) {
          achados.push(`${c} → ${seletor} { ${prop}: ${m[1].trim()} } usa ${bruto[0]} literal`);
        }
      }
    }
  }
  assert.deepEqual(
    achados,
    [],
    'tempo de movimento fora de token (S10, régua 2 — "toda duração vem de token"): '
      + 'número solto escapa do bloco reduce, que zera os tokens. Ponha em web/tokens.css '
      + 'e chame var().\n' + achados.join('\n'),
  );
});

test('movimento: o JS não escreve tempo de movimento nem repetição por fora do token', async () => {
  // Por que esta trava olha JS e não só CSS: quem desenha o atlas é web/metro.js, e
  // ele monta `animation:` dentro de string de template. O CSS é metade do caminho
  // do movimento até a tela. A outra metade é código — e um `animation: 300ms` vivo
  // num string de JS passaria por todas as travas acima sem um pio.
  //
  // MEDIDO em 03/11/2026 com esta trava rodando: nenhum achado hoje (web/metro.js só
  // fala de animation em comentário, e o único relógio do JS é JANELA_DESFAZER_MS =
  // 6000, espelho do token --janela-desfazer). A trava não pega nada agora e existe
  // para o dia em que alguém desenhar um movimento novo direto no JS.
  const achados = [];
  const semCom = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const c of await jsDaTela()) {
    const código = semCom(await ler(c));
    for (const m of código.matchAll(/\b(animation|transition)\s*:\s*([^'"`;]*)/gi)) {
      const decl = m[2];
      const semVar = decl.replace(/var\(--[a-z0-9-]+(?:[^)]*)\)/gi, ' ');
      const bruto = /(?<![\d.])\d*\.?\d+m?s\b/.exec(semVar);
      if (bruto && !/^0(\.0+)?m?s$/.test(bruto[0])) {
        achados.push(`${c} → ${m[0].trim()} usa ${bruto[0]} literal`);
      }
      if (/infinite|--pulso-repeticoes/.test(decl)) {
        achados.push(`${c} → ${m[0].trim()} repete (só o anel da próxima estação repete)`);
      }
    }
  }
  assert.deepEqual(
    achados,
    [],
    'movimento nascendo em JS fora de token (S10, régua 2). Tempo de movimento mora '
      + 'em web/tokens.css e chega aqui por var() — é assim que o bloco reduce alcança.\n'
      + achados.join('\n'),
  );
});

test('movimento: nenhuma animação infinita em lugar nenhum', async () => {
  // Régua 2, a parte que design-system.test.js já trava; repetida aqui porque a
  // auditoria é o lugar onde as réguas se encontram, e o custo é uma linha.
  const achados = [];
  for (const c of await cssDaTela()) {
    for (const m of semComentario(await ler(c)).matchAll(/animation[^;{}]*infinite/g)) {
      achados.push(`${c} → ${m[0].trim()}`);
    }
  }
  assert.deepEqual(achados, [], 'animação infinita (WCAG 2.2.2)');
});

test('movimento: com reduce, toda duração de animation/transition vira zero — atraso incluso', async () => {
  // "com prefers-reduced-motion: reduce, nenhuma animação nem transição roda" não
  // é só sobre duração: o atraso TAMBÉM é tempo de movimento, e mora no mesmo
  // lugar dele (o nome --atraso-* diz isso). Zerar --movimento-* e deixar
  // --atraso-esqueleto em 150ms é a metade da frase cumprida.
  // A lista de nomes NÃO é chutada: ela é o que o CSS usa, e o que precisa zerar é
  // o que hoje vale um tempo.
  const tokens = await ler('web/tokens.css');
  const ini = tokens.indexOf(':root {');
  const raiz = tokens.slice(ini, tokens.indexOf('@media', ini));
  const redu = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)/m.exec(tokens);
  assert.ok(redu, 'tokens.css sem o bloco prefers-reduced-motion');

  const usados = new Set();
  for (const c of await cssDaTela()) {
    const texto = semComentario(await ler(c));
    for (const m of texto.matchAll(/(?:animation|transition|animation-delay|animation-duration|transition-delay|transition-duration)\s*:\s*([^;{}]+)/gi)) {
      for (const v of m[1].matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) usados.add(v[1]);
    }
  }

  const reprovados = [];
  const tempos = [];
  for (const nome of [...usados].sort()) {
    const valor = new RegExp(`${nome}:\\s*([^;]+);`).exec(raiz)?.[1]?.trim();
    if (!valor) continue; // --cascata-i vem do JS com fallback; não é token do DS
    if (!/^\d+(?:\.\d+)?m?s$/.test(valor)) continue; // só os que são TEMPO
    tempos.push(`${nome}=${valor}`);
    const zero = new RegExp(`${nome}:\\s*([^;]+);`).exec(redu[1]);
    if (!zero) reprovados.push(`${nome} (hoje ${valor}): não zera no bloco reduce`);
    else if (zero[1].trim() !== '0ms') reprovados.push(`${nome}: reduce põe ${zero[1].trim()}, esperava 0ms`);
  }
  assert.ok(tempos.length >= 8, `esperava ao menos 8 tokens de tempo usados pelo CSS, vieram ${tempos.length} (${tempos.join(', ')})`);
  assert.deepEqual(
    reprovados,
    [],
    `duração de movimento que sobrevive ao movimento reduzido (S10, régua 2). `
      + `Tempos usados: ${tempos.join(', ')}. Falhas:\n${reprovados.join('\n')}`,
  );
});

test('movimento: o bloco reduce corta animação e transição para toda a página, por fora dos tokens', async () => {
  // Os tokens zeram o que é escrito com var(); este bloco é o que alcança a regra
  // que alguém escrever com número à mão antes de a trava pegar. É a rede, e a
  // auditoria confere que ela continua lá.
  const tokens = await ler('web/tokens.css');
  const redu = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)/m.exec(tokens);
  assert.ok(redu, 'tokens.css sem o bloco prefers-reduced-motion');
  for (const exigida of [/animation-duration:\s*0ms\s*!important/, /transition-duration:\s*0ms\s*!important/, /animation-iteration-count:\s*1\s*!important/, /scroll-behavior:\s*auto\s*!important/]) {
    assert.match(redu[1], exigida, `o bloco reduce perdeu ${exigida}`);
  }
});

// ---------------------------------------------------------------------------
// RÉGUA 5 — TEMAS, NO ESCURO
// ---------------------------------------------------------------------------

test('contraste no escuro: tinta, fosca, as 7 linhas e obras passam 4,5:1 sobre o fundo E sobre a superfície', async () => {
  // design/v2/S10-auditoria.md, régua 5. design-system.test.js já media as 7
  // linhas nos dois temas e o texto sobre o FUNDO. O que faltava é o que a maior
  // parte do texto da tela pisa: a superfície do cartão — --superficie é fundo de
  // cartão, folha e painel, e no escuro é outro valor (#202124, não #17181a). E
  // falta a cor de obras (--alerta), que é texto no recado e no selo de aviso.
  const p = await temas();
  const reprovadas = [];
  for (const tema of ['claro', 'escuro']) {
    const fundo = p[tema]['--fundo'];
    const superficie = p[tema]['--superficie'];
    assert.ok(fundo && superficie, `${tema}: --fundo/--superficie sem cor plana`);
    const nomes = ['--tinta', '--fosca', '--alerta', ...[1, 2, 3, 4, 5, 6, 7].map((i) => `--linha-${i}`)];
    for (const nome of nomes) {
      const cor = p[tema][nome];
      assert.ok(cor, `${tema}: ${nome} não está no tokens.css com cor plana`);
      for (const [baseNome, base] of [['--fundo', fundo], ['--superficie', superficie]]) {
        const r = razao(cor, base);
        if (r < 4.5) reprovadas.push(`${tema}: ${nome} sobre ${baseNome} (${base}) = ${r.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(reprovadas, [], 'texto abaixo de AA sobre o fundo ou a superfície (design/README.md §2, S10 régua 5)');
});

test('contraste: todo par tinta × fundo que uma regra CSS escreve passa 4,5:1 nos dois temas', async () => {
  // A régua 5 não é sobre a lista de tokens: é sobre o que a tela pinta. Uma cor
  // legível sobre o fundo pode ser tinta sobre si mesma: --tinta sobre
  // --marca-fundo dá 17,34:1 no papel do claro e 1,05:1 no escuro, porque
  // --marca-fundo é papel FIXO por design (a cúpula do símbolo é preta). O motor
  // de contraste antigo nunca veria isso — ele não sabia que as duas cores
  // moravam na mesma regra.
  //
  // Regra do teste: se a regra declara `color: var(--x)` e `background(-color):
  // var(--y)`, o par é medido nos dois temas. `background: color-mix(...)` fica
  // fora (o véu e o trilho são compostos, e o motor daqui é de cor plana).
  //
  // TETO HONESTO, medido em 03/11/2026: 22 regras têm as duas pernas na mesma
  // regra; 99 declaram `color` sem declarar fundo nenhum (herdam o fundo de um
  // ancestral — corpo, cartão, folha) e 26 declaram fundo sem cor. O par herdado
  // NÃO é medido aqui, e é por isso que a trava de cima (tinta, fosca, as 7
  // linhas e obras sobre --fundo e --superficie, os dois fundos que a tela usa de
  // fato) existe junto: ela cobre o texto que pisa o fundo de quem o envolve, e
  // esta cobre o texto que pisa o fundo que a própria regra pinta. As duas juntas
  // fecham a régua 5; nenhuma das duas fecha sozinha.
  const p = await temas();
  const reprovados = [];
  const semPar = [];
  // Contado POR TEMA, não somado: um total sozinho não diz se o segundo tema é um
  // tema ou o primeiro de novo. Foi a soma que deixou a régua 5 dar verde sem
  // medir o escuro (03/11/2026).
  const porTema = { claro: 0, escuro: 0 };

  for (const c of await cssDaTela()) {
    for (const { seletor, corpo } of regras(await ler(c))) {
      const tin = tokenDe('color', corpo);
      const base = tokenDe('background', corpo) ?? tokenDe('background-color', corpo);
      if (!tin || !base) continue;
      const nomesTin = p.claro[tin] === undefined && tin !== '--cor' && tin !== '--selo-linha'
        ? null : (tin === '--cor' || tin === '--selo-linha' ? p.claro['--cor'] : [p.claro[tin]]);
      if (!nomesTin) {
        reprovados.push(`${c} → ${seletor}: color usa var(${tin}), token que nenhum tema declara`);
        continue;
      }
      for (const tema of ['claro', 'escuro']) {
        // --cor e --selo-linha não são UMA cor: são as 7, porque a linha da
        // estação é a estação que a pessoa abriu, não escolha nossa. O veredito
        // do par é o PIOR dos cruzamentos — é o que aparece na tela quando a
        // linha for a pior delas.
        const lados = (nome) => (nome === '--cor' || nome === '--selo-linha'
          ? p[tema]['--cor']
          : [p[tema][nome]]);
        const tins = lados(tin).filter((x) => typeof x === 'string');
        const bases = lados(base).filter((x) => typeof x === 'string');
        if (!tins.length || !bases.length) {
          if (tema === 'claro') semPar.push(`${c} → ${seletor}: var(${tins.length ? base : tin}) não é cor plana`);
          continue;
        }
        let pior = Infinity;
        let emQue = null;
        for (const t of tins) {
          for (const b of bases) {
            const r = razao(t, b);
            porTema[tema]++;
            if (r < pior) { pior = r; emQue = [t, b]; }
          }
        }
        if (pior < 4.5) {
          reprovados.push(`${c} → ${seletor} [${tema}]: var(${tin}) ${emQue[0]} sobre var(${base}) ${emQue[1]} = ${pior.toFixed(2)}:1`);
        }
      }
    }
  }

  // Os DOIS temas, cada um com seu piso. Um total de 140 pode ser 70 do claro
  // medidos duas vezes — foi o que aconteceu hoje, e um piso somado não vê isso.
  assert.ok(porTema.claro >= 40 && porTema.escuro >= 40,
    `esperava medir ao menos 40 pares em CADA tema, medi ${porTema.claro} no claro e `
      + `${porTema.escuro} no escuro — parser de regra ou de tema quebrado? ${semPar.join('; ')}`);

  assert.deepEqual(
    reprovados,
    [],
    'par tinta × fundo ilegível (AA 4,5:1): o texto precisa do mesmo número dos '
      + 'dois lados da regra, não só do token (S10, régua 5).\n' + reprovados.join('\n'),
  );
});
