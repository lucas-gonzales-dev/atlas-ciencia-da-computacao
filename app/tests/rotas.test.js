// Projeto Atlas — as ROTAS por hash, puras, sem DOM (design/v2/S3a1-rotas-grade.md).
//
// Por que um arquivo só para isto: a S3a-2 vai montar o CASCO (abas embaixo,
// folha, jornada) e precisa de "que tela este hash pede" sem tocar em document.
// Regra da casa: nada de regra de tela no boot.js — o boot liga estado -> tela,
// e é este módulo que diz qual estado é.
//
// A âncora que NÃO é rota (teste 3) é o detalhe que faria estrago silencioso:
// o "Pular para o conteúdo" do casco é '#conteudo'. Se isso caísse na jornada
// como rota, o link de pular trocaria de tela e jogaria o foco para o lugar
// errado — quem navega por teclado perderia o ponto onde estava.
import test from 'node:test';
import assert from 'node:assert/strict';
import { casco } from '../core/textos.js';
import { ABAS, lerRota, hrefDe } from '../core/rotas.js';

test('rota: vazio, "#" e "#/" são a jornada, e "#/explorar" é o explorar', () => {
  for (const h of ['', '#', '#/']) {
    assert.deepEqual(lerRota(h), { tela: 'jornada' }, `«${h}» devia ser a jornada, sem chaves a mais`);
  }
  assert.deepEqual(lerRota('#/explorar'), { tela: 'explorar' });
});

test('rota: "#/estacao/<slug>" traz o slug (é a rota que a S5 usa)', () => {
  assert.deepEqual(lerRota('#/estacao/calculo-i'), { tela: 'estacao', slug: 'calculo-i' });
});

test('rota: âncora que não começa por "#/" NÃO é rota — null, não jornada', () => {
  assert.equal(lerRota('#conteudo'), null, 'o "Pular para o conteúdo" virou rota: a tela troca no clique');
  assert.equal(lerRota('#topo'), null);
});

test('rota: o que não se conhece cai na jornada, dizendo que é desconhecida', () => {
  assert.deepEqual(lerRota('#/xyz'), { tela: 'jornada', desconhecida: true });
  // "#/estacao" sem slug não desenha folha nenhuma: é rota malformada.
  assert.deepEqual(lerRota('#/estacao'), { tela: 'jornada', desconhecida: true });
});

test('rota: hrefDe e lerRota são o inverso um do outro em toda aba', () => {
  assert.equal(hrefDe({ tela: 'explorar' }), '#/explorar');
  for (const aba of ABAS) {
    const rota = { tela: aba.tela };
    assert.equal(aba.href, hrefDe(rota), `ABA.href diverge de hrefDe para «${aba.tela}»`);
    assert.deepEqual(lerRota(hrefDe(rota)), rota, `ida e volta não devolveu a rota de «${aba.tela}»`);
  }
  assert.equal(hrefDe({ tela: 'estacao', slug: 'calculo-i' }), '#/estacao/calculo-i');
});

test('abas: exatamente Jornada e Explorar, nessa ordem, com o rótulo do textos.js', () => {
  // ABAS é a única fonte da barra de baixo. Se o rótulo morar aqui e não em
  // core/textos.js, a trava de textos não vê a frase e ela escapa sem revisão.
  assert.deepEqual(ABAS.map((a) => a.tela), ['jornada', 'explorar']);
  for (const aba of ABAS) {
    assert.deepEqual(
      [...Object.keys(aba)].sort(),
      ['href', 'rotulo', 'tela'],
      `aba «${aba.tela}» com campos inesperados`,
    );
    assert.equal(aba.rotulo, casco.abas[aba.tela], `rotulo de «${aba.tela}» não vem de casco.abas`);
  }
});
