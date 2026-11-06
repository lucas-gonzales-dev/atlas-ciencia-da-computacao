// Projeto Atlas — S10-auditoria, régua 6 (tamanhos).
//
// O que a régua pede: os 4 tamanhos do testar_pagina, sem texto cortado, sem
// rolagem lateral, e as abas de baixo SEM COBRIR CONTEÚDO. O defeito foi visto
// na tela (02/11/2026, com a suíte toda verde): no celular e no tablet as abas
// passavam por cima de "Viagem", "Em curso", "Linhas abertas" e do texto "Já
// estudou alguma? Marque as que você já fez".
//
// A CAUSA não era um número pequeno demais, e é por isso que esta trava não
// cobra número nenhum como se ele fosse o remédio: `main { padding-bottom: … }`
// reserva espaço no FIM DO DOCUMENTO, e o documento é que rola. O último item
// sobe com a rolagem até a borda inferior da página, que é a BARRA — a reserva
// não segura nada em lugar nenhum. Um `padding-bottom` maior só empurra a
// mentira para mais fundo.
//
// O que fecha a régua de verdade, e o que cada teste abaixo pergunta:
//   · no celular e no tablet a JANELA não rola; quem rola é o `main`, que tem
//     sua própria caixa e o seu próprio forro — a reserva passa a viver com o
//     conteúdo, e o último item para no topo da faixa, não atrás dela;
//   · a altura da barra e a reserva leem o MESMO token, para não poderem
//     discordar em dias diferentes;
//   · no computador a janela volta a rolar e a barra entra no fluxo (é lá que
//     o painel sticky da Jornada tem de colar embaixo do topo);
//   · nada força rolagem lateral: nenhuma largura fixa maior que o celular
//     nasce no CSS, e `overflow-x` só existe onde o trilho das 7 linhas pede.
//
// LIMITE HONESTO: node não tem navegador. Aqui se prova a ESTRUTURA (quem rola,
// quem reserva, com que token). Os pixels — texto cortado, barra cobrindo item
// — só se provam no testar_pagina, nos 4 tamanhos, e é lá que esta fatia fecha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)); // app/
const ler = (c) => readFile(join(RAIZ, c), 'utf8');
const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

async function cssDaTela() {
  const saida = [];
  const ande = async (p) => {
    for (const e of await readdir(p, { withFileTypes: true })) {
      const c = join(p, e.name);
      if (e.isDirectory()) await ande(c);
      else if (e.name.endsWith('.css')) saida.push(c.slice(join(RAIZ, 'web').length - 3).split('\\').join('/'));
    }
  };
  await ande(join(RAIZ, 'web'));
  assert.ok(saida.length >= 8, `esperava ao menos 8 .css em web/, vieram ${saida.length}`);
  return saida;
}

/**
 * Regras com a media query em que moram — e isto é o coração do arquivo.
 *
 * O varredor ingênuo de `regras()` devolve as regras de dentro de um `@media`
 * misturadas com as da base, e a régua 6 É sobre a diferença entre elas: a barra
 * é fixa no pé na base e volta ao fluxo no computador. Ler as duas como uma
 * folha só diria que `position: static` convive com `position: fixed` na mesma
 * regra, o que é falso dos dois jeitos. Varremos as chaves contando a pilha: o
 * que estiver dentro de um `@media` traz a condição junto; o resto é base.
 */
function escanear(textoCss) {
  const limpo = semComentario(textoCss);
  const out = [];
  const pilha = [];
  let buf = '';
  for (const ch of limpo) {
    if (ch === '{') {
      // `html,` + quebra de linha + `body { … }` é UMA regra com DOIS alvos, e o
      // espaço depois da vírgula não significa nada para o navegador. Uma trava
      // que pergunta "esta regra é do body?" com `/(^|,)body(,|$)/` sobre o texto
      // cru diria que não — e era assim que a régua 6 reprovava um CSS que estava
      // certo (03/11/2026): o `height: auto` que devolve a altura ao body no
      // computador mora exatamente numa lista `html, body`. A lista é remontada
      // sem os espaços que separam os alvos; o que as travas lêem depois é a
      // mesma lista que o navegador vê.
      pilha.push(buf.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ','));
      buf = '';
    } else if (ch === '}') {
      const corpo = buf.trim();
      const sel = pilha.pop();
      if (corpo) {
        out.push({
          seletor: sel,
          corpo,
          media: pilha.filter((s) => s.startsWith('@')).join(' && '),
          decls: Object.fromEntries(
            corpo.split(';').map((d) => d.split(':')).filter((p) => p.length === 2).map((p) => [p[0].trim(), p[1].trim()])
          ),
        });
      }
      buf = '';
    } else buf += ch;
  }
  return out;
}

const ehMediaDesktop = (m) => /min-width:\s*1024px/.test(m || '');
const naBase = (r) => r.media === '';

test('réguas 6 · a janela não rola no celular e no tablet: quem rola é o main', async () => {
  const casco = escanear(await ler('web/casco.css'));
  const janela = casco.filter((r) => naBase(r) && /(^|,)(html|body)(,|$)/.test(r.seletor));
  assert.ok(
    janela.length >= 1,
    'web/casco.css não trava a janela: sem isto o documento inteiro rola atrás da barra fixa e a reserva do main é decorativa'
  );
  const trava = janela.some((r) => /(100dvh|100vh)/.test(r.corpo) && /overflow:\s*hidden/.test(r.corpo));
  assert.ok(
    trava,
    `a janela não está trancada (height dvh + overflow hidden). Regras lidas: ${janela.map((r) => `${r.seletor}{${r.corpo}}`).join(' | ')}`
  );

  const alvo = casco.filter((r) => naBase(r) && /(^|,)main(,|$)/.test(r.seletor));
  assert.ok(alvo.length >= 1, 'web/casco.css sem regra para main');
  const rola = alvo.some((r) => /overflow(-y)?:\s*auto/.test(r.corpo));
  assert.ok(rola, `o main não é container de rolagem, então o forro dele continua sendo o fim do documento: ${alvo.map((r) => r.corpo).join(' | ')}`);
  const naoCorta = alvo.every((r) => !/overflow-x:\s*hidden/.test(r.corpo));
  assert.ok(naoCorta, 'o main corta o eixo x: conteúdo largo ficaria INALCANÇÁVEL em vez de rolar para o lado');
});

/**
 * A caixa do main TERMINA no topo da barra — e isto não é a mesma coisa que
 * "reservar espaço embaixo", que foi a primeira tentativa desta fatia e o
 * testar_pagina devolveu errada: com `overflow-y: auto` e o forro em
 * `padding-bottom`, mas sem altura limitada, o main tem altura de conteúdo, nada
 * rola, e a barra segue desenhada sobre o meio da tela. Limite é diferente de
 * reserva, e só a caixa limitada faz o conteúdo existir de fato acima da faixa.
 * Daí as duas cobranças abaixo: o body em coluna (é ela que dá altura ao main) e
 * o `min-height: 0` (sem ele o item flex mantém a altura do conteúdo).
 */
test('réguas 6 · a caixa do main termina no topo da barra: limite, não reserva', async () => {
  const casco = escanear(await ler('web/casco.css'));
  const body = casco.filter((r) => naBase(r) && /(^|,)body(,|$)/.test(r.seletor));
  assert.ok(
    body.some((r) => /display:\s*flex/.test(r.corpo) && /flex-direction:\s*column/.test(r.corpo)),
    `o body não é coluna de altura fechada: sem isto o main não tem caixa limitada e o overflow dele é decorativo — ${body.map((r) => r.corpo).join(' | ')}`
  );

  // A FAIXA É DESCONTADA DO BODY, e é esse o ponto que a primeira tentativa desta
  // fatia errou: o desconto morava num `margin-bottom` do main, e `.metro { margin:
  // 0 auto }` (metro.css, duas classes+zero vs. um elemento, e carregado depois do
  // casco) passou por cima e zerou a margem. A barra sendo `fixed` está fora do
  // fluxo: não havia espaço sobrando para aquele auto centrar, e ela seguia
  // cobrindo. Cobrar `margin-bottom` no main seria cobrar um número que o CSS das
  // telas pode comer a qualquer hora — por isto a trava pergunta ao BODY.
  const corpo = body.find((r) => /height:\s*calc\(/.test(r.corpo));
  assert.ok(
    corpo,
    `o body não desconta a faixa da barra da própria altura — a caixa do main passaria por baixo dela: ${body.map((r) => r.corpo).join(' | ')}`
  );
  assert.ok(
    /--altura-barra/.test(corpo.corpo) && /100dvh/.test(corpo.corpo),
    `o desconto do body não é 100dvh menos --altura-barra (${corpo.corpo}): altura à mão ou token errado voltam a cobrir o fim da tela`
  );

  const main = casco.filter((r) => naBase(r) && /(^|,)main(,|$)/.test(r.seletor));
  const caixa = main.find((r) => /flex:/.test(r.corpo));
  assert.ok(caixa, 'o main não é item flex: quem recebe o espaço que sobra do topo e da barra tem de ser ele');
  assert.ok(
    /min-height:\s*0/.test(caixa.corpo),
    `o main não tem min-height: 0 — em coluna flex o item guarda a altura do conteúdo e a caixa estoura a tela: ${caixa.corpo}`
  );
  assert.ok(
    /overflow-y:\s*auto/.test(caixa.corpo),
    `o main não é o rolador (${caixa.corpo}): o clip que protege o último item acontece na caixa dele`
  );
  assert.ok(
    main.every((r) => !/margin-bottom/.test(r.corpo)),
    'voltou o margin-bottom no main: as telas anulam com .metro{margin:0 auto} e o conserto vira decorativo outra vez'
  );

  const desktop = casco.filter((r) => ehMediaDesktop(r.media) && /(^|,)(main|body)(,|$)/.test(r.seletor));
  assert.ok(
    desktop.some((r) => /height:\s*auto/.test(r.corpo) && /(^|,)body(,|$)/.test(r.seletor)),
    'o @media de 1024px não devolve a altura ao body: no computador a tela terminaria 56 px antes do fim da janela'
  );
  assert.ok(
    desktop.some((r) => /(^|,)main(,|$)/.test(r.seletor) && /flex:\s*none/.test(r.corpo)),
    'o @media de 1024px não solta o main da coluna: ele continuaria disputando altura com um documento que rola sozinho'
  );
});

/**
 * A trava que esta fatia precisou DEPOIS de se consertar.
 *
 * O primeiro defeito da régua 6 foi o `padding-bottom` no fim do documento. O
 * segundo foi meu conserto ter sido anulado por outro arquivo, e o testar_pagina
 * é que viu: `base.css` dava `min-height: 100dvh` ao body, e min-height é um
 * PISO — estica a caixa de volta à tela inteira por cima do `height: calc(100dvh
 * - …)` do casco. A barra seguiu cobrindo "Viagem" com a caixa do main certa no
 * papel. Especificidade e ordem de carga não salvam aqui: `min-height` não briga
 * com `height`, ele o manda calar.
 *
 * Por isso a trava não olha só o casco: ela varre TODAS as folhas e reprova
 * qualquer `min-height` de viewport na janela (html/body). A caixa da janela tem
 * de ter UM dono, e é o casco; a base garante a cor além do conteúdo pelo html.
 */
test('réguas 6 · nenhum outro arquivo anula o desconto da barra (min-height na janela)', async () => {
  const arquivos = await cssDaTela();
  const acusados = [];
  for (const c of arquivos) {
    for (const r of escanear(await ler(c))) {
      // Só o BODY. O `html` é o outro par do mesmo problema e não tem culpa:
      // min-height no html estica a RAIZ do documento, que é onde o fundo do tema
      // mora, e não alonga a caixa do body — esta é a que o casco limitou. O que
      // anulava o conserto era o piso no body, filho direto daquela caixa.
      if (!/(^|,)body(,|$)/.test(r.seletor)) continue;
      for (const m of r.corpo.matchAll(/min-height:\s*([^;]+)/g)) {
        if (/100\s*(d)?vh/.test(m[1])) acusados.push(`${c} ${r.seletor} → min-height: ${m[1].trim()}`);
      }
    }
  }
  assert.deepEqual(
    acusados,
    [],
    'um min-height de volta inteira na janela estica o body por cima do desconto do casco e as abas voltam a cobrir o fim da tela — a caixa da janela é do casco.css'
  );

  // O html é quem garante que a cor do tema pinta a janela toda, e isso não briga
  // com nada: o html não é a caixa que o casco limita.
  const base = escanear(await ler('web/base.css'));
  const janela = base.filter((r) => naBase(r) && /(^|,)html(,|$)/.test(r.seletor));
  assert.ok(
    janela.some((r) => /min-height:\s*100dvh/.test(r.corpo)),
    'o base.css perdeu a garantia de que o html cobre a janela: conteúdo curto voltaria a deixar calha sem cor além da placa'
  );
});

test('réguas 6 · o token da barra é uma altura, não uma reserva solta', async () => {
  const tokens = await ler('web/tokens.css');
  const declarada = tokens.match(/--altura-barra:\s*(\d+)px/);
  assert.ok(declarada, 'falta o token --altura-barra: a altura da barra e o forro do main precisam ler o mesmo número, ou discordam em dias diferentes');
  const altura = Number(declarada[1]);

  // O piso de toque manda na barra: dois rótulos empilhados com o ícone passam
  // dos 44 px, e o que for menos que isso reserva menos do que a barra ocupa.
  const tipo = Number((tokens.match(/--tipo-nota:\s*(\d+)px/) || [])[1]);
  const entre = Number((tokens.match(/--entrelinha-nota:\s*([\d.]+)/) || [])[1]);
  const espaco = Number((tokens.match(/--espaco-1:\s*(\d+)px/) || [])[1]);
  const piso = 22 + espaco + tipo * entre + 3; // ícone + ar + rótulo + a borda-estado de 3 px
  assert.ok(
    altura >= Math.ceil(piso),
    `--altura-barra: ${altura}px não cobre a própria barra (${piso.toFixed(1)}px de ícone + rótulo + borda): o rótulo sairia cortado`
  );
  assert.ok(altura <= 72, `--altura-barra: ${altura}px é um terço da tela do celular: reserva demais também é defeito`);

  // A barra é o ÚNICO lugar onde o número vira caixa: quem desconta a faixa do
  // layout é o main, e a trava acima confere que ele lê o mesmo token. Se a
  // altura da barra fosse só um número solto no .abas, o desconto e a barra
  // viveriam vidas separadas — e a reserva voltaria a mentir em dias diferentes.
  const casco = escanear(await ler('web/casco.css'));
  const abas = casco.find((r) => naBase(r) && r.seletor === '.abas');
  assert.ok(
    abas && /--altura-barra/.test(abas.corpo),
    `.abas não usa --altura-barra: o token virou decoração e nada garante que a faixa desenhada seja a faixa descontada`
  );
});

test('réguas 6 · a barra tem altura declarada e não depende do conteúdo para existir', async () => {
  const casco = escanear(await ler('web/casco.css'));
  const abas = casco.filter((r) => naBase(r) && /\.abas\b/.test(r.seletor) && !/\.abas\s+a/.test(r.seletor));
  assert.ok(abas.length >= 1, 'sem regra .abas na base');
  // A forma aceita é `var(--altura-barra)` OU o mesmo token dentro de calc():
  // num celular com recorte a barra é mais alta que o token, e tem de ser — mas
  // o token continua sendo o dono do número, é o que o forro do main lê também.
  const comAltura = abas.find((r) => /height:\s*(var\(--altura-barra\)|calc\([^)]*--altura-barra[^)]*\))/.test(r.corpo));
  assert.ok(
    comAltura,
    `.abas não fixa a altura no --altura-barra na base — se a altura é o conteúdo, o forro reserva uma coisa e a barra ocupa outra: ${abas.map((r) => r.corpo).join(' | ')}`
  );
  assert.ok(
    /--margem-segura-baixo/.test(comAltura.corpo),
    `a barra perdeu a margem segura do app instalado: ${comAltura.corpo}`
  );
});

test('réguas 6 · no computador a janela volta a rolar e a barra entra no fluxo', async () => {
  const casco = escanear(await ler('web/casco.css'));
  const desktop = casco.filter((r) => ehMediaDesktop(r.media));
  assert.ok(desktop.length >= 1, 'sem @media (min-width: 1024px) no casco: as abas ficam presas no pé também no computador');

  const abas = desktop.filter((r) => /\.abas\b/.test(r.seletor) && !/\.abas\s+a/.test(r.seletor));
  const solta = abas.find((r) => /position:\s*static/.test(r.corpo));
  assert.ok(solta, 'o @media de 1024px não tira .abas do fixed');
  assert.ok(
    solta && /height:\s*auto|height:\s*var\(--alvo-toque\)/.test(solta.corpo),
    `o @media libertou a posição mas deixou a altura da barra: no computador ela continuaria com 56 px de forro vazio: ${abas.map((r) => r.corpo).join(' | ')}`
  );

  const janela = desktop.filter((r) => /(^|,)(html|body)(,|$)/.test(r.seletor));
  assert.ok(
    janela.some((r) => /overflow:\s*visible|height:\s*auto/.test(r.corpo)),
    `o @media de 1024px não devolve o scroll à janela: o painel sticky da lateral cola embaixo de um body que não rola e não anda um pixel — ${janela.map((r) => r.seletor).join(', ') || 'nenhuma regra html/body no desktop'}`
  );

  const main = desktop.filter((r) => /(^|,)main(,|$)/.test(r.seletor));
  assert.ok(
    main.some((r) => /padding-bottom/.test(r.corpo) && !/--altura-barra/.test(r.corpo)),
    'no computador o forro do main continua lendo --altura-barra: as abas estão no topo, não no pé'
  );
});

test('réguas 6 · nenhuma largura fixa maior que o celular nasce no CSS', async () => {
  const arquivos = await cssDaTela();
  const acusados = [];
  for (const c of arquivos) {
    if (c === 'web/tokens.css') continue; // os tokens são a declaração, e o painel é do desktop
    for (const r of escanear(await ler(c))) {
      for (const m of r.corpo.matchAll(/(?:^|[;\s])(?:min-)?width:\s*(\d{3,})px/g)) {
        if (Number(m[1]) > 250 && !ehMediaDesktop(r.media)) {
          acusados.push(`${c}:${r.seletor} → ${m[0].trim()} (${r.media || 'base'})`);
        }
      }
    }
  }
  assert.deepEqual(acusados, [], 'largura fixa em base/tablet: no celular de 375 px isso empurra a página para o lado');
});

test('réguas 6 · rolagem lateral só onde o trilho das 7 linhas pede', async () => {
  const arquivos = await cssDaTela();
  const DONO = 'web/metro.css .linhas'; // a faixa das 7: 7 alvos de 44 px não cabem em 375 px
  const achados = [];
  for (const c of arquivos) {
    for (const r of escanear(await ler(c))) {
      if (/overflow-x:\s*(auto|scroll)/.test(r.corpo)) achados.push(`${c} ${r.seletor}`);
      // `overflow: auto` nos DOIS eixos é uma rolagem lateral que ninguém declarou
      // como intenção. O main fica de fora por construção: ele pede overflow-y, que
      // é o rolador vertical desta fatia e está na trava acima.
      if (/overflow:\s*(auto|scroll)/.test(r.corpo) && !/(^|,)main(,|$)/.test(r.seletor)) {
        achados.push(`${c} ${r.seletor} (overflow nos dois eixos)`);
      }
    }
  }
  assert.deepEqual(
    achados,
    [DONO],
    'apareceu um segundo container de rolagem lateral: cada um deles é uma régua 6 nova para conferir nos 4 tamanhos'
  );
});

/**
 * S20a-2 (04/11/2026, os três defeitos que o olho pegou no Chrome com a suíte
 * verde): o mapa do topo era o quadrado 4:3 do cartão do link (640x480), e o
 * `svg { width: 100%; height: auto }` dele faz a altura acompanhar a COLUNA,
 * que no computador é `1fr` (jornada.css: `1fr var(--largura-lateral)` com
 * `column-gap: var(--espaco-8)`). Quanto mais larga a janela, mais alto o mapa —
 * e o primário, que vem depois dele na ordem da J1, sumia sob a dobra.
 *
 * A conta abaixo é a da casa: lê os tokens e o viewBox, e pergunta se o topo do
 * botão fica acima da dobra. Com o 4:3 ela dava 816 px em 1280 e 1.296 em 1920
 * (o vão que ele mediu); com a faixa 8:3 dá 495 e 735. LIMITE HONESTO: node não
 * tem navegador — aqui se prova a PROPORÇÃO e a aritmética do layout; os pixels
 * reais fecham no testar_pagina.
 */
test('S20a-2 · o mapa do topo é faixa, e o único primário cabe acima da dobra', async () => {
  const fonte = await ler('web/telas/jornada-topo.js');
  const faixa = /const MAPA_TOPO = \{\s*largura:\s*(\d+),\s*altura:\s*(\d+)\s*\}/.exec(fonte);
  assert.ok(faixa, 'a faixa do mapa do topo sumiu do arquivo que desenha o topo');
  const vbL = Number(faixa[1]);
  const vbA = Number(faixa[2]);
  const propor = vbA / vbL;
  assert.ok(propor <= 0.45,
    `o mapa do topo voltou à proporção ${propor.toFixed(2)}: o 4:3 do cartão do link é um bloco que empurra o primário para baixo da dobra`);

  const tokens = await ler('web/tokens.css');
  const px = (nome) => {
    const m = new RegExp(`--${nome}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(tokens);
    assert.ok(m, `falta o token --${nome}: a conta da dobra lê os números da casa, nenhum à mão`);
    return Number(m[1]);
  };
  const entre = (nome) => Number(new RegExp(`--${nome}:\\s*([\\d.]+)`).exec(tokens)[1]);
  const pad = px('espaco-4');            // .metro { padding: ... }
  const gap = px('espaco-8');            // column-gap da grade do computador
  const lateral = px('largura-lateral'); // a coluna da direita
  const acima = 2 * px('espaco-3') + px('marca-altura') // --altura-topo, margem segura 0
    + pad                                              // respirinho do .metro
    + px('tipo-estacao') * entre('entrelinha-titulo')  // o h1
    + px('tipo-corpo') * entre('entrelinha-corpo')     // a linha de medida
    + 3 * pad;                                         // .topo { gap } — mapa, título, medida, ação
  const dobra = 800;                     // 1280x800: a janela em que o olho pegou o defeito
  const alvo = px('alvo-toque');

  for (const larguraJanela of [1280, 1920]) {
    const coluna = larguraJanela - 2 * pad - lateral - gap;
    const mapa = coluna * propor;
    const topoBotao = acima + mapa;
    assert.ok(coluna > 0, `${larguraJanela}: a grade não deixa coluna para o mapa`);
    assert.ok(topoBotao + alvo / 2 <= dobra,
      `${larguraJanela}px: o único primário da Jornada começa em ${Math.round(topoBotao)} px e não cabe na dobra de ${dobra} (mapa de ${Math.round(mapa)} px)`);
  }

  // S20b-3, item 2 — o vão de 870 px à direita do mapa em 1920. A escolha foi o
  // mapa CRESCER até a coluna (não virar duas colunas no topo): a faixa 8:3 é a
  // geometria já assinada por MAPA_TOPO, a conta acima já é `coluna × propor`, e
  // dobrar o topo em duas colunas mexeria na ordem de leitura da J1, que é o DOM.
  // O piso automático do item de grid segurava o quadro na largura do desenho.
  const css = await ler('web/telas/jornada.css');
  const quadro = /\.topo-mapa\s*\{([^}]*)\}/.exec(css);
  assert.ok(quadro, 'sumiu a regra que dá forma ao quadro do mapa do topo');
  assert.ok(/min-width:\s*0/.test(quadro[1]),
    '.topo-mapa voltou a não ter min-width: 0: o piso do item de grid devolve o vão de 870 px à direita do mapa em telas largas');
  assert.ok(/width:\s*100%/.test(quadro[1]),
    '.topo-mapa não declara a largura da coluna: o mapa para de crescer com a janela');
  const svg = /\.topo-mapa svg\s*\{([^}]*)\}/.exec(css);
  assert.ok(svg && /height:\s*auto/.test(svg[1]),
    'o svg do topo perdeu height: auto: a altura deixaria de seguir a faixa 8:3 e o primário voltaria a descer da dobra');

  // S20b-4, item 1 — a COLISÃO DE CLASSE que devolveu o vão. A Jornada chama a
  // peça de `.topo`, o cabeçalho fixo do casco (web/casco.css:70) chama o dele de
  // `.topo` também, e o `justify-content: space-between` de lá sobrevive ao
  // cascade: num grid de uma coluna ele distribui a sobra como vão em volta da
  // trilha, e a trilha para de esticar (medido: `section.topo` com 1.481 px e
  // coluna de 645). A conta de cima é `coluna × propor` — se a coluna não
  // estica, a conta mente e o mapa encolhe. As duas linhas abaixo são o
  // desfazer da herança; o teto do `.topo-mapa` é o respiro, não o vão.
  const topo = /\.topo\s*\{([^}]*)\}/.exec(css);
  assert.ok(topo, 'sumiu a regra que dá forma ao topo da Jornada');
  assert.ok(/grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(topo[1]),
    '.topo voltou a não declarar a coluna: o `justify-content` herdado do cabeçalho distribui a largura como vão e o mapa para em 645 px');
  assert.ok(/justify-content:\s*normal/.test(topo[1]),
    '.topo herdou o space-between do cabeçalho (web/casco.css:70): é a colisão de classe que segura o mapa à esquerda em 1920');
  assert.ok(/max-width:\s*var\(--bp-computador\)/.test(quadro[1]),
    '.topo-mapa sem teto: o mapa engole a tela inteira em monitores largos, em vez de deixar a diferença como respiro');
});

/**
 * S20b-1a (item 3) — OS ALVOS DE TOQUE QUE NINGUÉM MEDIA.
 *
 * O Claude mediu no Chrome em 375 px: o link «Ir para a próxima estação» e o
 * botão «Exportar» do Perfil, e o link de cada estação na Explorar, tinham a
 * altura de UMA LINHA DE LETRA — menos da metade do piso da casa. A causa é
 * sempre a mesma e sempre invisível para as outras travas: a tela cria o
 * elemento com uma classe de COR (`primario`, `secundario`, `.explorar-link`) e
 * nenhuma folha dá caixa a ela. O `--alvo-toque` existe desde a S2 em tokens.css
 * e era lido só por quem já tinha regra escrita.
 *
 * Por que uma varredura e não três asserts soltos: o defeito não é destes três
 * elementos, é do MODELO — classe sem dono. A trava abaixo pega o próximo alvo
 * nu antes de ele chegar na tela, e por isso cobre TODAS as classes que o
 * perfil.js e o explorar.js emitem, não as que eu lembrei de listar.
 *
 * LIMITE HONESTO: node não tem navegador. Aqui se prova que a caixa está
 * DECLARADA com o token; os 44 px reais fecham no testar_pagina.
 */
const CLASSES_TOCAVEIS = {
  // arquivo que EMITE a classe  →  folha que precisa dar a caixa a ela
  'web/telas/perfil.js': 'web/telas/perfil.css',
  'web/telas/explorar.js': 'web/telas/explorar.css',
};

test('S20b-1a · toda classe de alvo emitida por uma tela tem caixa na folha dela', async () => {
  const tokens = escanear(await ler('web/tokens.css'));
  const piso = tokens.flatMap((r) => [...r.corpo.matchAll(/--alvo-toque:\s*(\d+)px/g)]).map((m) => Number(m[1]))[0];
  assert.ok(piso >= 44, `--alvo-toque sumiu do tokens.css ou encolheu abaixo de 44 px: ${piso}`);

  const acusados = [];
  for (const [emissor, css] of Object.entries(CLASSES_TOCAVEIS)) {
    const fonte = await ler(emissor);
    const regrasCss = escanear(await ler(css));
    // `<a>` e `<button>` são o que se toca. `el(doc, classe, texto, 'a')`,
    // `el(doc, classe, ..., 'button')` e o `className = `...-link`` do explorar.
    const tocaveis = new Set();
    for (const m of fonte.matchAll(/el\(doc,\s*`([^`]*)`[^)]*,\s*'(a|button)'\s*\)/g)) {
      for (const parte of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
        if (/^[a-z][\w-]*$/.test(parte)) tocaveis.add(parte);
      }
    }
    for (const m of fonte.matchAll(/\.className\s*=\s*`([^`]*)`/g)) {
      for (const parte of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
        if (/^[a-z][\w-]*$/.test(parte)) tocaveis.add(parte);
      }
    }
    for (const classe of tocaveis) {
      const comCaixa = regrasCss.some((r) =>
        new RegExp(`(^|[,.\\s>])${classe}(?![\\w-])`).test(r.seletor) &&
        /min-height:\s*var\(--alvo-toque\)/.test(r.corpo));
      if (!comCaixa) acusados.push(`${emissor} emite .${classe} (a|button) e ${css} não dá o --alvo-toque a ela`);
    }
  }
  assert.deepEqual(acusados, [], 'um alvo tocável nasceu nu: a altura dele é a linha de letra, e o piso de 44 px da casa é opcional no toque');
});

test('S20b-1a · os três alvos medidos em 375 px têm o piso declarado', async () => {
  const perfil = escanear(await ler('web/telas/perfil.css'));
  const explorar = escanear(await ler('web/telas/explorar.css'));

  // Perfil: os dois nus (:237 e :329 criam o link com `primario`, :118 o botão
  // com `secundario`). Escopados em `.perfil` — são classes sem prefixo e uma
  // regra solta vazaria para as outras três telas.
  // `tem`: uma classe pode ter MAIS DE UMA regra na folha (a de sempre, de letra
  // e cor, e a do alvo). Cobrar a primeira que o escanear achar seria travar a
  // ordem do arquivo, e a ordem não é o defeito — o que importa é que ALGUMA
  // delas declare o piso.
  const comPiso = (regras, classe) =>
    regras.some((r) => new RegExp(`(^|[,.\\s>])${classe}(?![\\w-])`).test(r.seletor) &&
      /min-height:\s*var\(--alvo-toque\)/.test(r.corpo));

  for (const classe of ['primario', 'secundario']) {
    assert.ok(perfil.some((r) => r.seletor.includes(`.${classe}`)),
      `.perfil .${classe} não tem regra nenhuma: o elemento chega nu (perfil.js:118/237/329)`);
    assert.ok(comPiso(perfil, classe), `.perfil .${classe} existe mas nenhuma regra dele lê o piso da casa`);
  }

  // O rótulo do importar é o par do botão de exportar na mesma fileira: se um
  // tem 44 px e o outro tem a linha de letra, a fileira fica com dois andares.
  assert.ok(comPiso(perfil, 'perfil-dados-rotulo'),
    'o rótulo de importar ficou sem alvo de toque');

  // Explorar: o link de CADA estação (explorar.js:54) — 35 alvos por tela.
  const link = explorar.find((r) => /(^|[,.\s>])explorar-link(?![\w-])/.test(r.seletor) && /min-height/.test(r.corpo));
  assert.ok(link, 'o .explorar-link não declara min-height: é o alvo mais tocado do app');
  assert.match(link.corpo, /min-height:\s*var\(--alvo-toque\)/);

  // O conserto é CAIXA, não pintura: nenhum dos três virou botão primário, e a
  // letra continua a da folha. `font-size` com número à mão aqui seria o caminho
  // de volta para a hierarquia de cartaz que a S11-0 matou, e um `background`
  // cheio na regra do alvo é a hierarquia da tela trocada por um pedido de caixa.
  const nus = [['perfil .primario', perfil.find((r) => r.seletor.includes('.primario'))],
               ['perfil .secundario', perfil.find((r) => r.seletor.includes('.secundario'))],
               ['explorar-link', link]];
  for (const [nome, r] of nus) {
    assert.doesNotMatch(r.corpo, /font-size:\s*\d/, `${nome}: tamanho de letra à mão na regra do alvo`);
    assert.equal(/background:/.test(r.corpo), false,
      `${nome}: o alvo ganhou fundo — a hierarquia da tela mudou com um pedido de caixa`);
  }
});

/**
 * S20b-1b (item 1) — o que a régua mediu embaixo de "Importar uma viagem".
 *
 * O Claude mediu no Chrome em 375 e 768 px: menos de 24 px. A primeira leitura
 * da casa apontava o label, e a folha já dava o piso a ele (perfil.css:231, na
 * lista com `.primario`/`.secundario`): o que mede a linha de letra é o
 * `<input type=file>` — o widget nativo, que não é `<a>` nem `<button>` e por
 * isso NÃO passou pela varredura de cima, que só enxerga o que `el(doc, ..., 'a'
 * |'button')` emite. Alvo que nasce de createElement direto é o buraco do modelo.
 *
 * Cobro o input por nome de classe, e a letra dele intacta: o pedido foi caixa,
 * não tipografia. LIMITE HONESTO: node não tem navegador — aqui se prova a
 * declaração; os 24 px reais fecham no testar_pagina.
 */
test('S20b-1b · o input de importar tem o piso de toque declarado', async () => {
  const perfil = escanear(await ler('web/telas/perfil.css'));
  const input = perfil.find((r) => /(^|[,\s>])\.perfil-dados-input(?![\w-])/.test(r.seletor));
  assert.ok(input, '.perfil-dados-input não tem regra na folha: é o input type=file do Perfil (perfil.css:235)');
  assert.match(input.corpo, /min-height:\s*var\(--alvo-toque\)/,
    'o input de importar voltou a ter a altura da própria letra — é ele que se aperta, não o rótulo da linha 231');
  assert.doesNotMatch(input.corpo, /font-size:\s*\d/, 'tamanho de letra à mão na regra do alvo');
  assert.match(input.corpo, /font-size:\s*var\(--tipo-nota\)/, 'a letra do input mudou com um pedido de caixa');
  assert.equal(/background:/.test(input.corpo), false, 'o input ganhou fundo: hierarquia trocada por um pedido de alvo');
});

/**
 * S17b-fix (item 1) — O PERFIL INTEIRO NUMA FAIXA DE 360 PX.
 *
 * Escrito ANTES do conserto, porque é a trava da prova: rebotar
 * `max-width: var(--largura-lateral)` tem de derrubar alguma coisa sozinha. O
 * Claude mediu no Chrome com a atlas-v91: `section` do Perfil com 360 px numa
 * janela de 1.920, e o resto da tela vazio. A causa é um token EMPRESTADO de
 * outra tela — --largura-lateral é a coluna direita da Jornada (o painel ao lado
 * do mapa), não uma largura de leitura.
 *
 * O piso da conta é a coluna, e a trava é DECLARADA de propósito: node não tem
 * navegador, então aqui se prova que a folha manda o Perfil usar a largura do
 * computador, e que o bilhete de 5 casas tem `minmax(0, …)` — o `1fr` puro tem
 * piso automático igual ao maior nome de estação, e em 1280 a fileira saía para
 * fora do próprio cartão. Os px reais fecham no testar_pagina.
 */
test('S17b-fix · o Perfil usa a tela, e não a coluna da Jornada', async () => {
  const tokens = escanear(await ler('web/tokens.css'));
  const px = (nome) => {
    const m = new RegExp(`--${nome}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(tokens.map((r) => r.corpo).join(';'));
    assert.ok(m, `falta o token --${nome}: esta conta lê os números da casa, nenhum à mão`);
    return Number(m[1]);
  };
  const lateral = px('largura-lateral');
  const computador = px('bp-computador');

  const perfil = escanear(await ler('web/telas/perfil.css'));
  const larga = perfil.filter((r) => ehMediaDesktop(r.media) && /(^|[,\s>])\.perfil(?![\w-])/.test(r.seletor));
  assert.ok(larga.length >= 1, 'nenhuma regra de .perfil dentro do @media de 1024: a largura do Perfil voltou a ser a da base');
  const teto = larga.find((r) => /max-width:/.test(r.corpo));
  assert.ok(teto, `.perfil no computador sem max-width: o cartão cresce sem teto e a linha de leitura passa de 1.920`);
  assert.doesNotMatch(teto.corpo, /max-width:\s*var\(--largura-lateral\)/,
    `o Perfil voltou a --largura-lateral (${lateral} px): a coluna direita da Jornada como largura de página, e o resto da janela fica vazio`);
  assert.match(teto.corpo, /max-width:\s*var\(--bp-computador\)/,
    `--bp-computador (${computador} px) é o número da casa em que a janela deixa de ser estreita; o teto do Perfil não é mais um palpite: "${teto.corpo}"`);

  // O bilhete: 5 casas por fileira. `1fr` tem piso automático (o maior nome de
  // estação), e com o Perfil largo a conta não fecha — a fileira sai do cartão.
  const fileira = perfil.find((r) => naBase(r) && /(^|[,\s>])\.perfil-bilhete-fileira(?![\w-])/.test(r.seletor));
  assert.ok(fileira, 'sumiu a regra do bilhete: 7 fileiras de 5 casas');
  assert.match(fileira.corpo, /grid-template-columns:\s*repeat\(\s*5,\s*minmax\(0,\s*1fr\)\s*\)/,
    `o bilhete voltou a repeat(5, 1fr): o piso automático de 1fr é o maior nome de estação, e em 1280 a fileira transborda o próprio cartão — "${fileira.corpo}"`);

  // As duas séries lado a lado, de 1024 para cima. Abaixo disso é UMA coluna: a
  // mesma folha, sem fork de DOM — o wrapper existe nos dois, só muda a grade.
  const series = perfil.filter((r) => /(^|[,\s>])\.perfil-series(?![\w-])/.test(r.seletor));
  assert.ok(series.length >= 1, '.perfil-series sem regra: o wrapper que põe as duas séries lado a lado não existe');
  const dupla = series.find((r) => ehMediaDesktop(r.media) && /grid-template-columns:/.test(r.corpo));
  assert.ok(dupla, 'as duas séries não viram duas colunas de 1024 para cima (item 1 do pedido)');
  assert.match(dupla.corpo, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/,
    `duas colunas sem minmax(0,…) é o piso automático de 1fr de novo, agora dentro do Perfil largo: "${dupla.corpo}"`);
  const base = series.find((r) => naBase(r));
  assert.ok(!base || !/grid-template-columns:.*(1fr\s+1fr)/.test(base.corpo),
    'as duas séries viraram duas colunas ABAIXO de 1024: o pedido era uma coluna só');
});

/**
 * S17b-fix (item 4) — o quarto alvo nu do Perfil. Medido pelo Claude em 375 e
 * 768: o link da próxima estação mede menos de 24 px. A varredura da S20b-1a não
 * o pegou porque o template é `el(doc, \`${CLASSE}-proxima-link\`, …, 'a')` e o
 * \${} é descartado na extração — o modelo só enxerga classe escrita por extenso.
 * É o mesmo buraco do `<input type=file>` da S20b-1b, e a resposta é a mesma:
 * trava nominal, caixa, e a letra intacta.
 */
test('S17b-fix · o link da próxima estação tem o piso de toque declarado', async () => {
  const perfil = escanear(await ler('web/telas/perfil.css'));
  const link = perfil.find((r) => /(^|[,.\s>])\.perfil-proxima-link(?![\w-])/.test(r.seletor));
  assert.ok(link, '.perfil-proxima-link não tem regra na folha: é o <a> criado em perfil.js:285, e sem caixa a altura dele é a linha de letra');
  assert.match(link.corpo, /min-height:\s*var\(--alvo-toque\)/,
    'o link da próxima voltou a medir a própria letra — menos dos 44 px da casa');
  assert.match(link.corpo, /display:\s*inline-flex/, 'min-height não existe num <a> em linha: sem inline-flex o piso é decorativo');
  assert.doesNotMatch(link.corpo, /font-size:\s*\d/, 'tamanho de letra à mão na regra do alvo');
  assert.doesNotMatch(link.corpo, /background:/, 'o alvo ganhou fundo: hierarquia trocada por um pedido de caixa');
});

test('réguas 6 · trocar de aba leva ao topo de QUEM ESTÁ ROLANDO', async () => {
  const js = await ler('web/casco.js');
  assert.match(js, /win\.scrollTo\?\.\(0, 0\)/, 'o casco perdeu o rolamento ao topo da janela');
  assert.match(
    js,
    /main\.scrollTo\?\.|main\.scrollTop\s*=\s*0/,
    'quem rola passou a ser o main e o casco só zera a janela: trocar de aba deixaria a tela nova aberta no meio da rolagem da anterior'
  );
});
