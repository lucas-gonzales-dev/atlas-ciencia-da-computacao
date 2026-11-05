// Projeto Atlas — o mapa de DOIS EIXOS (S16b, 04/11/2026).
//
// O que este arquivo é: a trava de que `core/mapa-rede.js` passou a desenhar
// preenchimento (o que foi ESTUDADO) e cor (o que foi LEMBRADO depois) quando
// recebe `eixos`, e de que SEM eixos ele desenha exatamente o de sempre — o
// cartão do link, o og:image e o bilhete não podem mudar um byte.
//
// A referência abaixo NÃO foi gerada pelo código de hoje: foi gerada ANTES da
// mudança, por tmp/gen-ref-mapa.mjs contra o mapa-rede.js commitado da S16a, e
// colada aqui. Se ela fosse uma chamada à versão nova, a trava do byte a byte
// seria autoelogio — mediria o que o código faz, não o que ele devia fazer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mapaDaRede, alturaDoPreenchimento, pesoDoTom, MINIMO_VISIVEL, COR_CHEIA } from '../core/mapa-rede.js';
import { mapa as MAPA_TEXTO } from '../core/textos.js';
import { ESTAGIOS_DO_EIXO } from '../core/eixos.js';

const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CURSOS = JSON.parse(readFileSync(join(raiz, 'data/catalog.json'), 'utf8')).courses;
const id = (titulo) => CURSOS.find((c) => c.title === titulo).id;
const LINHA_1 = CURSOS.filter((c) => Number(c.stage) === 1).map((c) => c.id);
const NO_MEIO = [...LINHA_1, id('Estruturas de Dados'), id('Álgebra Linear I'), id('Cálculo I'), id('Programação Funcional em Haskell')];

const contar = (svg, padrao) => (svg.match(padrao) ?? []).length;
const sha = (texto) => createHash('sha256').update(texto).digest('hex');

/** O catálogo pequeno do byte a byte: duas linhas, uma baldeação cruzada. */
const MINI = [
  { id: 'a', title: 'Alpha', stage: 1, prerequisites: [] },
  { id: 'b', title: 'Beta', stage: 1, prerequisites: ['a'] },
  { id: 'c', title: 'Gama', stage: 2, prerequisites: ['a'] },
  { id: 'd', title: 'Delta', stage: 2, prerequisites: [] },
];

/** A string do mapa SEM eixos, gravada do código anterior à S16b. */
const REFERENCIA_MINI = '<svg xmlns="http://www.w3.org/2000/svg" class="mapa-rede" viewBox="0 0 120 100" width="120" height="100" role="img" aria-label="Mapa da rede: 2 de 4 estações concluídas"><g class="mapa-baldeacoes"><path class="mapa-baldeacao feita" d="M14.4 33.6 C32.4 33.6 -3.6 85.6 14.4 85.6" fill="none" stroke="var(--tinta)" stroke-width="1.5" stroke-opacity="0.55"/><path class="mapa-baldeacao" d="M14.4 33.6 C60 33.6 60 33.6 105.6 33.6" fill="none" stroke="var(--borda)" stroke-width="1.5"/></g><g class="mapa-linhas"><line class="mapa-linha" data-linha="1" x1="14.4" y1="33.6" x2="14.4" y2="85.6" stroke="var(--linha-1)" stroke-width="5.4" stroke-linecap="round"/><line class="mapa-linha" data-linha="2" x1="105.6" y1="33.6" x2="105.6" y2="85.6" stroke="var(--linha-2)" stroke-width="5.4" stroke-linecap="round"/></g><g class="mapa-selos"><g class="mapa-selo" data-linha="1"><circle cx="14.4" cy="14.4" r="7.5" fill="var(--linha-1)"/><text x="14.4" y="14.4" text-anchor="middle" dominant-baseline="central" fill="var(--fundo)" font-family="var(--fonte-placa)" font-weight="800" font-size="7.8">1</text></g><g class="mapa-selo" data-linha="2"><circle cx="105.6" cy="14.4" r="7.5" fill="var(--linha-2)"/><text x="105.6" y="14.4" text-anchor="middle" dominant-baseline="central" fill="var(--fundo)" font-family="var(--fonte-placa)" font-weight="800" font-size="7.8">2</text></g></g><g class="mapa-estacoes"><g class="mapa-estacao" data-id="a" data-estado="concluida"><title>Alpha</title><circle cx="14.4" cy="33.6" r="6" fill="var(--linha-1)" stroke="var(--linha-1)" stroke-width="2.3"/></g><g class="mapa-estacao" data-id="b" data-estado="concluida"><title>Beta</title><circle cx="14.4" cy="85.6" r="6" fill="var(--linha-1)" stroke="var(--linha-1)" stroke-width="2.3"/></g><g class="mapa-estacao" data-id="c" data-estado="disponivel"><title>Gama</title><circle class="mapa-aqui" cx="105.6" cy="33.6" r="10.2" fill="none" stroke="var(--tinta)" stroke-width="1.7"/><circle cx="105.6" cy="33.6" r="6" fill="var(--fundo)" stroke="var(--linha-2)" stroke-width="2.3"/></g><g class="mapa-estacao" data-id="d" data-estado="disponivel"><title>Delta</title><circle cx="105.6" cy="85.6" r="6" fill="var(--fundo)" stroke="var(--linha-2)" stroke-width="2.3"/></g></g></svg>';

/** Os cinco mapas reais de hoje, pelo hash gravado antes da mudança. */
const REFERENCIA_REAL = {
  'default': '75a598d7c434c0ddca15b65fe126a9620470af6e269c846ce8501a08725bc2ce',
  '528x502': 'b2ed5d76b6f9e6d8b4cf3d2ec19ab5420569dba42c986cf80bd375ac27a62bb8',
  'vazio': '327fdb931689c9f9b493188c94872601fa25c0258f829f63000cd18e4e747cf8',
  'terminal': '959f44ff90aaebdeb1ae506d6de939ee0e60e3e7f6db489f1b0767d599d2b6a6',
  'exportado': 'a58fc1cbf251137e052acc0c6373947b49c88d58c6f170c05678ead75cee9129',
};

const eixo = (over = {}) => ({
  estagio: 'em-percurso', estudadas: 3, total: 3, preenchimento: 1,
  lembradas: 0, cor: 0, pedeRevisao: false, segundosRestantes: 0, ...over,
});

test('S16b · byte a byte: sem eixos, o mini-catalogo desenha a string de antes', () => {
  assert.equal(mapaDaRede(MINI, ['a', 'b'], { largura: 120, altura: 100 }), REFERENCIA_MINI,
    'o cartão do link e o og:image mudaram sem ninguém pedir');
});

test('S16b · byte a byte: sem eixos, os cinco mapas reais têm o hash de antes', () => {
  const medidos = {
    default: mapaDaRede(CURSOS, NO_MEIO),
    '528x502': mapaDaRede(CURSOS, NO_MEIO, { largura: 528, altura: 502 }),
    vazio: mapaDaRede(CURSOS, []),
    terminal: mapaDaRede(CURSOS, CURSOS.map((c) => c.id)),
    exportado: mapaDaRede(CURSOS, NO_MEIO, { cores: { linha: (n) => `#${n}c1121f`, fundo: '#fbf7f0', tinta: '#16130f', trilho: '#ded6c8', fonte: 'Overpass' } }),
  };
  for (const [caso, esperado] of Object.entries(REFERENCIA_REAL)) {
    assert.equal(sha(medidos[caso]), esperado, `o mapa ${caso} deixou de ser o de antes`);
  }
});

test('S16b · eixos vazios (Map novo, ou null) também são o desenho de antes', () => {
  const antes = mapaDaRede(CURSOS, NO_MEIO);
  assert.equal(mapaDaRede(CURSOS, NO_MEIO, { eixos: null }), antes);
  assert.equal(mapaDaRede(CURSOS, NO_MEIO, { eixos: new Map() }), antes);
  assert.equal(mapaDaRede(CURSOS, NO_MEIO, { eixos: {} }), antes);
});

// largura 560 dá raio 10 e diâmetro 20: os números saem exatos, sem 11,428.
const UM = [{ id: 'x', title: 'Única', stage: 1, prerequisites: [] }];
const recheioDe = (e) => mapaDaRede(UM, [], { largura: 560, altura: 400, eixos: new Map([['x', e]]) });
const alturaDoRetangulo = (svg) => {
  const m = /class="mapa-preenchimento"[^>]*height="([\d.]+)"/.exec(svg);
  return m ? Number(m[1]) : 0;
};

test('S16b · a altura do preenchimento é proporcional, com o valor exato', () => {
  // 0 desenha nada; 0,5 e 1 desenham a metade e o diâmetro inteiro.
  assert.equal(alturaDoPreenchimento(0, 20), 0);
  assert.equal(alturaDoPreenchimento(0.5, 20), 10);
  assert.equal(alturaDoPreenchimento(1, 20), 20);
  assert.equal(alturaDoRetangulo(recheioDe(eixo({ preenchimento: 0 }))), 0,
    'estudadas zero desenhou recheio — o mapa está dizendo que alguém estudou');
  assert.equal(alturaDoRetangulo(recheioDe(eixo({ preenchimento: 0.5 }))), 10);
  assert.equal(alturaDoRetangulo(recheioDe(eixo({ preenchimento: 1 }))), 20);
});

test('S16b · o mínimo visível vale: 0,032 desenha 15% do diâmetro, e 0 não desenha nada', () => {
  // A decisão medida na S16a: 93 aulas com 3 estudadas é preenchimento 0,032,
  // menos de 1 px num círculo de 28 px. A pessoa estudaria e o mapa não mudaria.
  assert.equal(alturaDoPreenchimento(0.032, 28), 28 * MINIMO_VISIVEL);
  assert.ok(0.032 * 28 < 1, 'se 0,032 já passasse de 1 px, o mínimo não teria motivo');
  assert.equal(alturaDoPreenchimento(0, 28), 0, 'o mínimo não pode valer para quem não estudou nada');
  // No desenho: diâmetro 20, 15% = 3 px, e 0,032 * 20 = 0,64 px (invisível).
  assert.equal(alturaDoRetangulo(recheioDe(eixo({ preenchimento: 0.032 }))), 3);
  // Acima do mínimo, o proporcional manda — e nunca passa do círculo.
  assert.equal(alturaDoRetangulo(recheioDe(eixo({ preenchimento: 0.3 }))), 6);
  assert.equal(alturaDoPreenchimento(1.4, 20), 20, 'preenchimento não vaza para fora do círculo');
});

test('S16b · o preenchimento sobe de baixo para cima, dentro do círculo', () => {
  const svg = recheioDe(eixo({ preenchimento: 0.5 }));
  assert.match(svg, /<clipPath id="mapa-recorte-0-x"><circle cx="24" cy="56" r="10"\/><\/clipPath>/,
    'sem o recorte do círculo, o recheio vaza para fora da estação');
  const m = /class="mapa-preenchimento" x="14" y="([\d.]+)" width="20" height="([\d.]+)"[^>]*clip-path="url\(#mapa-recorte-0-x\)"/.exec(svg);
  assert.ok(m, `o retângulo não saiu como desenhado: ${/mapa-preenchimento[^/]*/.exec(svg)?.[0]}`);
  // Centro y=56, raio 10: a base do círculo é 66; metade cheia = 10 px de altura.
  assert.equal(Number(m[1]), 56, 'y = centro + raio − altura, a conta da base para o topo');
  assert.equal(Number(m[2]), 10);
});

test('S16b · embarcada não preenche nada e tem contorno próprio, mais forte que o comum', () => {
  const svg = recheioDe(eixo({ estagio: 'embarcada', estudadas: 0, total: 5, preenchimento: 0 }));
  assert.equal(contar(svg, /class="mapa-preenchimento"/g), 0,
    'abrir não é estudar: a embarcada não pode ter recheio');
  assert.match(svg, /data-estado="embarcada"/);
  assert.equal(contar(svg, /class="mapa-embarcada"/g), 1);
  const comum = Number(/class="mapa-estacao"[^>]*>\s*<title>[^<]*<\/title><circle cx[^>]*stroke-width="([\d.]+)"/.exec(mapaDaRede(UM, [], { largura: 560, altura: 400 }))?.[1] ?? 0);
  const dela = Number(/class="mapa-embarcada"[^>]*stroke-width="([\d.]+)"/.exec(svg)[1]);
  assert.ok(dela > comum, `o contorno da embarcada (${dela}) não é mais forte que o comum (${comum})`);
  assert.match(svg, /class="mapa-embarcada"[^>]*stroke="var\(--linha-1\)"/,
    'o contorno da embarcada é o traço da linha, não uma cor nova');
  // As outras estações ficam com o traço de sempre.
  assert.equal(contar(mapaDaRede(UM, [], { largura: 560, altura: 400, eixos: new Map([['x', eixo({ estagio: 'fora', preenchimento: 0 })]]) }), /class="mapa-embarcada"/g), 0);
});

test('S16b · a cor interpola do tom claro da linha à cor cheia, e só com tokens da linha', () => {
  assert.equal(pesoDoTom(0), 25, 'cor 0 é o tom claro, o mesmo peso dos --trilho-falta');
  assert.equal(pesoDoTom(COR_CHEIA), 100, 'cor ≥ 0,8 é a linha cheia');
  assert.equal(pesoDoTom(1), 100);
  assert.ok(pesoDoTom(0.4) > 25 && pesoDoTom(0.4) < 100, 'no meio do caminho há de haver meio do caminho');
  assert.equal(pesoDoTom(-3), 25);
  assert.equal(pesoDoTom(9), 100);

  const claro = recheioDe(eixo({ cor: 0 }));
  const cheio = recheioDe(eixo({ cor: 1 }));
  assert.match(claro, /fill="color-mix\(in srgb, var\(--linha-1\) 25%, var\(--fundo\)\)"/);
  assert.match(cheio, /fill="color-mix\(in srgb, var\(--linha-1\) 100%, var\(--fundo\)\)"/);
  // Linha 2 não pode sair da linha 2.
  const duas = [{ id: 'p', title: 'P', stage: 1, prerequisites: [] }, { id: 'q', title: 'Q', stage: 2, prerequisites: [] }];
  const svgQ = mapaDaRede(duas, [], { largura: 560, altura: 400, eixos: new Map([['q', eixo({ cor: 0 })]]) });
  assert.match(/data-id="q".*?mapa-preenchimento"[^>]*fill="([^"]+)"/.exec(svgQ)[1], /var\(--linha-2\).*var\(--fundo\)/);
  // Cor nova não existe: o recheio é sempre uma mistura de --linha-N com --fundo.
  for (const svg of [claro, cheio, svgQ]) {
    for (const fill of [...svg.matchAll(/class="mapa-preenchimento"[^>]*fill="([^"]+)"/g)].map((m) => m[1])) {
      assert.match(fill, /^color-mix\(in srgb, var\(--linha-\d\) \d+%, var\(--fundo\)\)$/, `cor fora dos tokens: ${fill}`);
    }
  }
});

test('S16b · percorrida com cor cheia é o círculo inteiro na cor da linha', () => {
  const svg = recheioDe(eixo({ estagio: 'percorrida', preenchimento: 1, cor: 1, lembradas: 3 }));
  assert.match(svg, /data-id="x"[^>]*data-estado="percorrida"/);
  const m = /data-estado="percorrida".*?<circle cx="24" cy="56" r="10" fill="([^"]+)"/.exec(svg);
  assert.equal(m[1], 'var(--linha-1)', 'lembrada de verdade ainda aparece como vazia');
});

test('S16b · o anel do "pede revisão" aparece só com pedeRevisao', () => {
  assert.equal(contar(recheioDe(eixo({ pedeRevisao: false })), /class="mapa-pede-revisao"/g), 0);
  assert.equal(contar(recheioDe(eixo({ pedeRevisao: true })), /class="mapa-pede-revisao"/g), 1);
  assert.match(recheioDe(eixo({ pedeRevisao: true })), /class="mapa-pede-revisao"[^>]*stroke="var\(--tinta\)"/,
    'o anel discreto é o traço do tema, não uma cor de alerta');
});

test('S16b · o aria-label conta os estágios, com o plural da casa', () => {
  assert.equal(
    MAPA_TEXTO.rotuloEixos(35, { 'em-percurso': 2, percorrida: 1, 'concluida-antes': 3, fora: 29 }, 1),
    '35 estações: 2 em percurso, 1 percorrida, 3 concluídas antes, 29 fora da rota. 1 pede revisão.',
  );
  // Singular e zero: o que é zero não aparece na frase.
  assert.equal(MAPA_TEXTO.rotuloEixos(35, { percorrida: 1, fora: 34 }, 0), '35 estações: 1 percorrida, 34 fora da rota.');
  assert.equal(MAPA_TEXTO.rotuloEixos(35, { 'concluida-antes': 2, fora: 33 }, 2), '35 estações: 2 concluídas antes, 33 fora da rota. 2 pedem revisão.');
  assert.equal(MAPA_TEXTO.rotuloEixos(1, { embarcada: 1 }, 1), '1 estação: 1 embarcada. 1 pede revisão.');
  assert.equal(MAPA_TEXTO.rotuloEixos(35, {}, 0), '35 estações ainda sem medida.');
  // O rótulo do cartão do link não mudou de texto: a mesma frase de antes.
  assert.equal(MAPA_TEXTO.rotuloViagem(9, 35), 'Mapa da rede: 9 de 35 estações concluídas');

  // E o mapa desenhado fala a frase, na ordem em que o texto a monta.
  const eixos = new Map(CURSOS.map((c) => [c.id, eixo({ estagio: 'fora', preenchimento: 0, total: 5 })]));
  for (const k of ['em-percurso|2', 'percorrida|1', 'concluida-antes|3', 'fora|29']) {
    const [estagio, n] = k.split('|');
    for (let i = 0; i < Number(n); i += 1) {
      const alvo = CURSOS.find((c) => eixos.get(c.id).estagio === 'fora');
      eixos.set(alvo.id, eixo({ estagio, total: 5, estudadas: estagio === 'concluida-antes' ? 0 : 2, preenchimento: estagio === 'concluida-antes' ? 1 : 0.4, cor: estagio === 'percorrida' ? 1 : 0 }));
    }
  }
  eixos.set(CURSOS[0].id, { ...eixos.get(CURSOS[0].id), pedeRevisao: true });
  const svg = mapaDaRede(CURSOS, NO_MEIO, { eixos });
  assert.match(svg, /aria-label="35 estações: 2 em percurso, 1 percorrida, 3 concluídas antes, 29 fora da rota\. 1 pede revisão\."/);
});

test('S16b · todo estágio do núcleo tem nome no mapa, e o rótulo os conhece', () => {
  for (const estagio of ESTAGIOS_DO_EIXO) {
    assert.ok(Array.isArray(MAPA_TEXTO.estagios[estagio]), `o estágio ${estagio} não tem nome — nome de estágio inventado`);
    assert.equal(MAPA_TEXTO.estagios[estagio].length, 2);
    // O rótulo desenhado tem de carregar a palavra, não o código do estágio.
    const svg = recheioDe(eixo({ estagio }));
    const frase = MAPA_TEXTO.rotuloEixos(1, { [estagio]: 1 }, 0);
    assert.match(svg, new RegExp(`aria-label="${frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      `o aria-label não diz o estágio ${estagio}: ${/aria-label="[^"]*"/.exec(svg)[0]}`);
  }
});

test('S16b · quem passa o rótulo próprio manda nele, mesmo com eixos', () => {
  const svg = mapaDaRede(CURSOS, NO_MEIO, { eixos: new Map([['qualquer', eixo()]]), acessivel: 'As 35 estações da rede; nenhuma estudada ainda' });
  assert.match(svg, /aria-label="As 35 estações da rede; nenhuma estudada ainda"/,
    'a Jornada perdeu o override que a S20a trouxe');
});

test('S16b · a estação sem eixo no mapa com eixos mantém o estado da viagem', () => {
  const svg = mapaDaRede(MINI, ['a'], { largura: 560, altura: 400, eixos: new Map([['b', eixo({ estagio: 'fora', preenchimento: 0 })]]) });
  assert.match(/data-id="a"[^>]*data-estado="([^"]+)"/.exec(svg)[1], /^(concluida|disponivel|em_curso|trancada)$/,
    'sem medição, o que se mostra é a viagem, não um estágio inventado');
});
