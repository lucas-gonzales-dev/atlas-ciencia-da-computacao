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

/** As cores padrão: os tokens da casa, resolvidos pelo CSS da página. */
export const CORES_DO_TEMA = Object.freeze({
  linha: (n) => `var(--linha-${n})`,
  fundo: 'var(--fundo)',
  tinta: 'var(--tinta)',
  trilho: 'var(--borda)',
  fonte: 'var(--fonte-placa)'
});

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
export function mapaDaRede(cursos, progresso, opcoes = {}) {
  const lista = (Array.isArray(cursos) ? cursos : []).filter((c) => c && typeof c.id === 'string');
  const largura = opcoes.largura ?? 640;
  const altura = opcoes.altura ?? 480;
  const cores = { ...CORES_DO_TEMA, ...(opcoes.cores ?? {}) };
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
  const estacoes = [];
  for (const c of lista) {
    const p = pos.get(c.id);
    if (!p) continue;
    const estado = estados.get(c.id);
    const cor = cores.linha(p.linha);
    const cheia = estado === ESTADOS.CONCLUIDA;
    const trancada = estado === ESTADOS.TRANCADA;
    const aqui = c.id === proxima;
    const titulo = `<title>${escapar(c.title ?? c.id)}</title>`;
    const anel = aqui ? `<circle class="mapa-aqui" cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio * 1.7)}" fill="none" stroke="${cores.tinta}" stroke-width="${numero(raio / 3.5)}"/>` : '';
    estacoes.push(`<g class="mapa-estacao" data-id="${escapar(c.id)}" data-estado="${estado}"${trancada ? ' opacity="0.45"' : ''}>${titulo}${anel}` +
      `<circle cx="${numero(p.x)}" cy="${numero(p.y)}" r="${numero(raio)}" fill="${cheia ? cor : cores.fundo}" stroke="${cor}" stroke-width="${numero(raio / 2.6)}"/></g>`);
  }

  const total = lista.length;
  // S20a: quem desenha o topo da Jornada traz o rótulo do próprio lugar — na
  // primeira visita não há «0 de 35 concluídas» a anunciar, há «nenhuma
  // estudada ainda». Sem ooverride, o rótulo do cartão do link é o que vale.
  const rotuloAcessivel = opcoes.acessivel
    || `Mapa da rede: ${concluidas.length} de ${total} estações concluídas`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="mapa-rede" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="${rotuloAcessivel}">` +
    `<g class="mapa-baldeacoes">${trilhos.join('')}</g>` +
    `<g class="mapa-linhas">${tracos.join('')}</g>` +
    `<g class="mapa-selos">${selos.join('')}</g>` +
    `<g class="mapa-estacoes">${estacoes.join('')}</g>` +
    `</svg>`;
}
