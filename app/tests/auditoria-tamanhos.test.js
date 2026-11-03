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

test('réguas 6 · trocar de aba leva ao topo de QUEM ESTÁ ROLANDO', async () => {
  const js = await ler('web/casco.js');
  assert.match(js, /win\.scrollTo\?\.\(0, 0\)/, 'o casco perdeu o rolamento ao topo da janela');
  assert.match(
    js,
    /main\.scrollTo\?\.|main\.scrollTop\s*=\s*0/,
    'quem rola passou a ser o main e o casco só zera a janela: trocar de aba deixaria a tela nova aberta no meio da rolagem da anterior'
  );
});
