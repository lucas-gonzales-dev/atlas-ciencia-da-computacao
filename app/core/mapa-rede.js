// Projeto Atlas — o MAPA DA REDE (S11): as 35 estações num diagrama só.
//
// Regra da casa: roda NO NODE (testes) e NO NAVEGADOR, sem build e sem DOM.
// Recebe o catálogo e a viagem e devolve uma string SVG; quem põe na tela, no
// cartão do link ou no bilhete é quem chama.
//
// Por que existe: a Jornada mostra uma linha por vez e o Explorar é uma lista.
// Nenhuma tela mostrava a REDE, que é a ideia do Atlas inteiro — e sem ela o
// cartão do link virava foto de página (S11a, 03/11/2026).
//
// O desenho: cada linha da fonte é uma coluna vertical, da 1 à 7, da esquerda
// para a direita, porque é nessa ordem que a grade se abre. Cada pré-requisito
// é um trilho fino de uma estação à outra (a baldeação). Dentro da coluna, as
// estações seguem o baricentro dos pré-requisitos, para os trilhos se cruzarem
// menos; a coluna 1 segue o catálogo. Sem nome de linha inventado: o selo diz o
// número da fonte, e mais nada.
//
// As cores entram como valor. No app são os tokens (`var(--linha-1)`), que o
// CSS resolve e trocam sozinhos no tema escuro; numa imagem exportada (o bilhete,
// o cartão) quem chama passa os valores já lidos do tema, porque um SVG fora da
// página não enxerga as variáveis dela.

import { ESTADOS, estadoDaEstacao } from './viagem.js';
import { nextUp } from './progress.js';
import { mapa as MAPA_TEXTO } from './textos.js';

/** As cores padrão: os tokens da casa, resolvidos pelo CSS da página. */
export const CORES_DO_TEMA = Object.freeze({
  linha: (n) => `var(--linha-${n})`,
  fundo: 'var(--fundo)',
  tinta: 'var(--tinta)',
  trilho: 'var(--borda)',
  fonte: 'var(--fonte-placa)',
  // S16b: o tom da linha MISTURADO ao fundo, no peso que a casa já usa. Não é
  // uma cor nova: é `--linha-N` com `--fundo`, a mesma conta dos tokens
  // `--trilho-falta-N` (tokens.css:52). Quem exporta passa um `tom` com os
  // valores já lidos, porque um SVG fora da página não resolve `color-mix`.
  tom: (n, peso) => `color-mix(in srgb, var(--linha-${n}) ${peso}%, var(--fundo))`
});

/**
 * O mínimo visível do preenchimento, como fração do diâmetro do MIOLO (S16b,
 * decisão medida contra `core/eixos.js` com dados reais; recalibrada na S16c-fix).
 *
 * Por que existe: uma estação de 93 aulas com 3 estudadas dá preenchimento
 * 0,032. Num círculo de 28 px de diâmetro, isso são 0,9 px — a pessoa estuda e
 * o mapa não muda, que é o oposto do princípio 1 do desenho ("Progresso é
 * verificado, não declarado"). O mínimo desenhado é 30% do miolo, e só quando
 * há ao menos uma aula estudada; com zero estudadas continua zero, porque aí não
 * há nada a mostrar.
 *
 * POR QUE 30 E NÃO 15 (S16c-fix, 04/11/2026, medido no SVG do v77): o traço do
 * círculo é `raio / 2.6` e fica CENTRADO na borda, então metade dele cobre o
 * desenho por dentro. No mapa da rede, com raio 11,4 e traço 4,4, o que a pessoa
 * vê é o miolo: raio 9,2, diâmetro 18,4 px. O mínimo antigo — 15% do diâmetro
 * EXTERNO — dava 3,4 px de calota, e 2,2 desses px ficavam debaixo do traço:
 * restava ~1,2 px, e uma estação de 3 de 93 aulas pareceu VAZIA nos dois temas,
 * com o retângulo existindo no SVG. Agora o recorte, o retângulo e a fração são
 * todos do miolo, e o caso medido (0,032) desenha 5,5 px dos 18,4.
 *
 * O número EXATO não mora aqui: `eixos.preenchimento` é a medida, e é ela que a
 * folha e o leitor de tela dizem. Este valor é uma escolha de legibilidade, e o
 * teste trava os dois lados — 0,032 desenha o mínimo do miolo, 0 não desenha nada.
 */
export const MINIMO_VISIVEL = 0.30;

/** A partir de quanto o preenchimento toma a cor cheia da linha (S16b). */
export const COR_CHEIA = 0.8;

/** O tom claro da linha, o mesmo peso dos tokens `--trilho-falta-N`. */
const TOM_CLARO = 25;

/** O contorno da estação EMBARCADA, em múltiplos do traço comum (S16b). */
const TRACO_EMBARCADA = 1.6;

const escapar = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const numero = (v) => Math.round(v * 10) / 10;

/**
 * As posições das estações: coluna pela linha da fonte, altura pelo baricentro.
 * @returns {Map<string, {x:number, y:number, linha:number}>}
 */
function posicoes(cursos, { largura, altura, margem, topo }) {
  const linhas = [...new Set(cursos.map((c) => Number(c.stage)).filter(Number.isFinite))].sort((a, b) => a - b);
  const passoX = linhas.length > 1 ? (largura - 2 * margem) / (linhas.length - 1) : 0;
  const pos = new Map();
  for (const [i, n] of linhas.entries()) {
    const daLinha = cursos.filter((c) => Number(c.stage) === n);
    const ordenada = i === 0 ? daLinha : daLinha
      .map((c, ordem) => {
        const ys = (c.prerequisites ?? []).map((p) => pos.get(p)?.y).filter(Number.isFinite);
        return { c, ordem, peso: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Infinity };
      })
      .sort((a, b) => a.peso - b.peso || a.ordem - b.ordem)
      .map((x) => x.c);
    const passoY = ordenada.length > 1 ? (altura - topo - margem) / (ordenada.length - 1) : 0;
    for (const [j, c] of ordenada.entries()) {
      pos.set(c.id, { x: margem + i * passoX, y: topo + j * passoY, linha: n });
    }
  }
  return pos;
}

/**
 * O mapa da rede como SVG.
 *
 * @param {Array<{id:string,title?:string,stage?:number,prerequisites?:string[]}>} cursos as estações da grade
 * @param {unknown} progresso o progresso da pessoa (array de ids ou objeto v3)
 * @param {{largura?:number, altura?:number, cores?:object, rotulo?:boolean}} [opcoes]
 *   `largura` e `altura` são o viewBox; `rotulo` desenha o selo de cada linha no topo.
 * @returns {string}
 */
/**
 * Quantos px de altura o preenchimento desenha, dentro do MIOLO visível.
 * `diametro` é o diâmetro interno (raio menos metade do traço), não o do círculo:
 * desde a S16c-fix é o miolo que a pessoa vê, e o retângulo clipado a ele.
 * Exportado para a trava do mínimo visível.
 */
export function alturaDoPreenchimento(preenchimento, diametro) {
  const cheio = Number(preenchimento) > 0;
  if (!cheio) return 0;
  const proporcional = Number(preenchimento) * diametro;
  return Math.min(diametro, Math.max(proporcional, MINIMO_VISIVEL * diametro));
}

/**
 * O peso da linha na mistura: do tom claro (cor 0) à cor cheia (cor ≥ 0,8),
 * linear entre os dois. Nunca sai dos tokens da própria linha.
 */
export function pesoDoTom(cor) {
  const c = Math.min(1, Math.max(0, Number(cor) || 0));
  return Math.round(TOM_CLARO + (100 - TOM_CLARO) * Math.min(1, c / COR_CHEIA));
}

/** O mapa aceita um `Map` ou um objeto plain de id para eixo. */
function eixoDe(eixos, id) {
  if (!eixos) return null;
  const e = typeof eixos.get === 'function' ? eixos.get(id) : eixos[id];
  return e && typeof e === 'object' ? e : null;
}

/** Quantas estações há em cada estágio medido, e quantas pedem revisão. */
function contarEstagios(lista, eixos) {
  const estagios = {};
  let pedindoRevisao = 0;
  for (const c of lista) {
    const e = eixoDe(eixos, c.id);
    if (!e) continue;
    estagios[e.estagio] = (estagios[e.estagio] || 0) + 1;
    if (e.pedeRevisao) pedindoRevisao += 1;
  }
  return { estagios, pedindoRevisao };
}

/** Há algum eixo para desenhar? Sem nenhum, o desenho é o de hoje, byte a byte. */
function temEixos(eixos) {
  if (!eixos) return false;
  if (eixos instanceof Map) return eixos.size > 0;
  if (typeof eixos === 'object') return Object.keys(eixos).length > 0;
  return false;
}

export function mapaDaRede(cursos, progresso, opcoes = {}) {
  const lista = (Array.isArray(cursos) ? cursos : []).filter((c) => c && typeof c.id === 'string');
  const largura = opcoes.largura ?? 640;
  const altura = opcoes.altura ?? 480;
  const cores = { ...CORES_DO_TEMA, ...(opcoes.cores ?? {}) };
  // S16b: quem exporta passa os valores já lidos (#c1121f, #fbf7f0), porque um
  // SVG fora da página não resolve `color-mix` com var(). Se ele passou cores
  // próprias e não disse como misturá-las, a mistura sai das cores dele — e nunca
  // de um token que ele não tem. Com o tema da casa, a string é a mesma de antes.
  if (typeof opcoes.cores?.tom !== 'function') {
    cores.tom = (n, peso) => `color-mix(in srgb, ${cores.linha(n)} ${peso}%, ${cores.fundo})`;
  }
  const rotulo = opcoes.rotulo !== false;
  const raio = Math.max(6, Math.min(14, largura / 56));
  const margem = raio * 2.4;
  const topo = rotulo ? margem + raio * 3.2 : margem;
  const pos = posicoes(lista, { largura, altura, margem, topo });

  const estados = new Map(lista.map((c) => [c.id, estadoDaEstacao(c.id, progresso, lista)?.estado ?? ESTADOS.TRANCADA]));
  const concluidas = lista.filter((c) => estados.get(c.id) === ESTADOS.CONCLUIDA).map((c) => c.id);
  const proxima = nextUp(lista, concluidas).course?.id ?? null;

  // 1. as baldeações: trilho fino de cada pré-requisito até a estação que ele abre
  const trilhos = [];
  for (const c of lista) {
    const b = pos.get(c.id);
    for (const p of c.prerequisites ?? []) {
      const a = pos.get(p);
      if (!a || !b) continue;
      const feito = estados.get(p) === ESTADOS.CONCLUIDA && estados.get(c.id) === ESTADOS.CONCLUIDA;
      const meio = (b.x - a.x) / 2 || raio * 3;
      const d = `M${numero(a.x)} ${numero(a.y)} C${numero(a.x + meio)} ${numero(a.y)} ${numero(b.x - meio)} ${numero(b.y)} ${numero(b.x)} ${numero(b.y)}`;
      trilhos.push(`<path class="mapa-baldeacao${feito ? ' feita' : ''}" d="${d}" fill="none" stroke="${feito ? cores.tinta : cores.trilho}" stroke-width="${numero(raio / 4)}"${feito ? ' stroke-opacity="0.55"' : ''}/>`);
    }
  }

  // 2. as linhas: um traço grosso por coluna, trecho a trecho. O trecho só é cheio
  // quando as duas pontas já abriram; com uma ponta trancada ele apaga, e a
  // progressão se lê no próprio traço.
  const linhas = [...new Set([...pos.values()].map((p) => p.linha))];
  const tracos = [];
  const selos = [];
  for (const n of linhas) {
    const daLinha = lista.filter((c) => pos.get(c.id)?.linha === n).sort((a, b) => pos.get(a.id).y - pos.get(b.id).y);
    const x = pos.get(daLinha[0].id).x;
    for (let i = 1; i < daLinha.length; i += 1) {
      const a = daLinha[i - 1];
      const b = daLinha[i];
      const aberto = estados.get(a.id) !== ESTADOS.TRANCADA && estados.get(b.id) !== ESTADOS.TRANCADA;
      tracos.push(`<line class="mapa-linha${aberto ? '' : ' trancada'}" data-linha="${n}" x1="${numero(x)}" y1="${numero(pos.get(a.id).y)}" x2="${numero(x)}" y2="${numero(pos.get(b.id).y)}" stroke="${cores.linha(n)}" stroke-width="${numero(raio * 0.9)}" stroke-linecap="round"${aberto ? '' : ' stroke-opacity="0.3"'}/>`);
    }
    if (rotulo) {
      const y = margem;
      selos.push(`<g class="mapa-selo" data-linha="${n}"><circle cx="${numero(x)}" cy="${numero(y)}" r="${numero(raio * 1.25)}" fill="${cores.linha(n)}"/>` +
        `<text x="${numero(x)}" y="${numero(y)}" text-anchor="middle" dominant-baseline="central" fill="${cores.fundo}" font-family="${escapar(cores.fonte)}" font-weight="800" font-size="${numero(raio * 1.3)}">${n}</text></g>`);
    }
  }

  // 3. as estações: o estado pela forma, não só pela cor (a mesma regra do mapa da Jornada)
  //
  // Com EIXOS (S16b) a estação vira dois canais: o PREENCHIMENTO, medido pelo
  // fechamento das aulas (sobe de baixo para cima dentro do círculo, cortado por
  // um clipPath do próprio círculo), e a COR desse preenchimento, medida pela
  // primeira Lembrei dada um dia ou mais depois de o cartão nascer. Sem eixos,
  // nada deste bloco roda e o desenho é o de sempre — o que o cartão do link e o
  // og:image esperam.
  const eixos = opcoes.eixos;
  const comEixos = temEixos(eixos);
  const recortes = [];
  const estacoes = [];
  for (const [i, c] of lista.entries()) {
    const p = pos.get(c.id);
    if (!p) continue;
    const estado = estados.get(c.id);
    const cor = cores.linha(p.linha);
    const trancada = estado === ESTADOS.TRANCADA;
    const aqui = c.id === proxima;
    const titulo = `<title>${escapar(c.title ?? c.id)}</title>`;
    const anelAqui = aqui ? `<circle class="mapa-aqui" cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio * 1.7)}" fill="none" stroke="${cores.tinta}" stroke-width="${numero(raio / 3.5)}"/>` : '';
    const traco = numero(raio / 2.6);

    if (!comEixos) {
      const cheia = estado === ESTADOS.CONCLUIDA;
      estacoes.push(`<g class="mapa-estacao" data-id="${escapar(c.id)}" data-estado="${estado}"${trancada ? ' opacity="0.45"' : ''}>${titulo}${anelAqui}` +
        `<circle cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio)}" fill="${cheia ? cor : cores.fundo}" stroke="${cor}" stroke-width="${traco}"/></g>`);
      continue;
    }

    const eixo = eixoDe(eixos, c.id);
    const estagio = eixo?.estagio ?? estado;
    // S16c-fix (04/11/2026), item 1 — o MIOLO, não o círculo. O traço de
    // `raio / 2.6` é CENTRADO na borda, então o que aparece de círculo vai só até
    // `raio − traço/2`: num raio de 11,4, o miolo visível é 9,2. Preencher até o
    // raio externo desenhava uma faixa que sumia debaixo do traço — uma estação
    // de 3 de 93 aulas parecia vazia nos dois temas, com o retângulo no SVG.
    const raioInterno = numero(raio - traco / 2);
    const diametroInterno = numero(raioInterno * 2);
    const altura = alturaDoPreenchimento(eixo?.preenchimento, diametroInterno);
    // Um clipPath por estação desenhada com recheio. O id carrega o índice e o
    // `id` do catálogo escapado porque duas estações com o mesmo título não
    // podem dividir o mesmo recorte — e o mapa vai embutido numa página que já
    // tem outros SVGs.
    const recorteId = `mapa-recorte-${i}-${escapar(c.id)}`;

    // O miolo: o fundo claro. Quem enche é o retângulo por cima, clipado ao círculo.
    // O recorte é o MIOLO: clipar pelo raio externo deixaria o recheio vivo só
    // na faixa que o traço tapa, que é justamente o que o olho viu como "mapa
    // vazio com o retângulo desenhado".
    const recheio = altura > 0
      ? `<clipPath id="${recorteId}"><circle cx="${numero(p.x)}" cy="${numero(p.y)}" r="${raioInterno}"/></clipPath>`
      : '';
    // A base do retângulo é o fundo do miolo (`p.y + raioInterno`) e ele sobe de
    // lá: preenchimento 1 enche o miolo inteiro, sem tocar no traço.
    const rect = altura > 0
      ? `<rect class="mapa-preenchimento" x="${numero(p.x - raioInterno)}" y="${numero(p.y + raioInterno - altura)}" width="${diametroInterno}" height="${numero(altura)}" fill="${cores.tom(p.linha, pesoDoTom(eixo?.cor))}" clip-path="url(#${recorteId})"/>`
      : '';
    if (altura > 0) recortes.push(recheio);

    // 'embarcada' (abriu, não estudou) não preenche: abrir não é estudar. Mas o
    // mapa diz que a pessoa entrou ali, e diz com contorno mais forte, no traço
    // da linha — forma, não só cor, como a legenda da casa exige.
    const embarcada = eixo?.estagio === 'embarcada';
    const contorno = embarcada
      ? `<circle class="mapa-embarcada" cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio)}" fill="none" stroke="${cor}" stroke-width="${numero(raio / 2.6 * TRACO_EMBARCADA)}"/>`
      : '';

    // 'percorrida' com cor cheia é a estação lida como dominada: o círculo inteiro
    // na cor da linha, como era a concluída antes dos dois eixos.
    const cheio = Number(eixo?.preenchimento) >= 1 && Number(eixo?.cor) >= COR_CHEIA;
    // O anel discreto do "esfria": só com pedeRevisao, no traço do tema.
    const anelRevisao = eixo?.pedeRevisao
      ? `<circle class="mapa-pede-revisao" cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio * 1.45)}" fill="none" stroke="${cores.tinta}" stroke-width="${numero(raio / 6)}"/>`
      : '';

    // S16c-fix, item 2 — o `opacity="0.45"` no grupo apagava TUDO, inclusive o
    // fundo do círculo: o trilho da linha que passa atrás ficava visível POR DENTRO
    // da estação, e a trava parecia riscada. Apagado agora é só o TRAÇO; o miolo
    // continua opaco (o `fill` sem opacidade), e o que está atrás fica atrás.
    // O ramo SEM eixos — o do cartão do link, do og:image e do bilhete — não sente
    // nada: a trava byte a byte daquela linha continua a de sempre.
    estacoes.push(`<g class="mapa-estacao" data-id="${escapar(c.id)}" data-estado="${estagio}">${titulo}${anelRevisao}${anelAqui}` +
      `<circle cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio)}" fill="${cheio ? cor : cores.fundo}" stroke="${cor}" stroke-width="${traco}"${trancada ? ' stroke-opacity="0.45"' : ''}/>${contorno}${rect}</g>`);
  }

  const total = lista.length;
  // S20a: quem desenha o topo da Jornada traz o rótulo do próprio lugar — na
  // primeira visita não há «0 de 35 concluídas» a anunciar, há «nenhuma
  // estudada ainda». Sem o override, o rótulo do cartão do link é o que vale.
  // S16b: com eixos e sem rótulo próprio, o mapa CONTA os estágios medidos —
  // «35 estações: 2 em percurso, 1 percorrida, 29 fora da rota. 1 pede revisão.»
  // A frase é do textos.js, nunca daqui.
  const contagem = comEixos ? contarEstagios(lista, eixos) : null;
  const rotuloAcessivel = opcoes.acessivel
    || (contagem ? MAPA_TEXTO.rotuloEixos(total, contagem.estagios, contagem.pedindoRevisao)
      : MAPA_TEXTO.rotuloViagem(concluidas.length, total));
  const defs = recortes.length ? `<defs>${recortes.join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="mapa-rede" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="${rotuloAcessivel}">` +
    defs +
    `<g class="mapa-baldeacoes">${trilhos.join('')}</g>` +
    `<g class="mapa-linhas">${tracos.join('')}</g>` +
    `<g class="mapa-selos">${selos.join('')}</g>` +
    `<g class="mapa-estacoes">${estacoes.join('')}</g>` +
    `</svg>`;
}
