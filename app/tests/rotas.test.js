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

// ── S7 (01/11/2026): a busca e o filtro vivem no endereço ──────────────────
// Por que isto é rota e não estado da tela: a fatia pede «dá para compartilhar
// o endereço, e voltar de uma estação devolve a mesma busca». Estado em memória
// morre no F5 e não cabe num link mandado no chat; o hash é o único lugar onde
// as duas frases são verdade ao mesmo tempo. E hoje é pior que não funcionar:
// «#/explorar?busca=calculo&linha=2» não bate em nenhuma rota conhecida e cai
// no «desconhecida», que faz o casco dar replaceState para '#/' — colar o link
// de alguém te devolvia para a Jornada, sem aviso.
test('rotas: #/explorar?busca=calculo&linha=2 dá { tela, busca, linha }', () => {
  assert.deepEqual(
    lerRota('#/explorar?busca=calculo&linha=2'),
    { tela: 'explorar', busca: 'calculo', linha: 2 },
  );
  // A ordem dos parâmetros não importa (o usuário edita o endereço).
  assert.deepEqual(
    lerRota('#/explorar?linha=2&busca=calculo'),
    { tela: 'explorar', busca: 'calculo', linha: 2 },
  );
  // Só um dos dois: a outra chave NÃO aparece (deepEqual com linha: null
  // quebraria o teste antigo do hrefDe, que compara com { tela: 'explorar' }).
  assert.deepEqual(lerRota('#/explorar?linha=3'), { tela: 'explorar', linha: 3 });
  assert.deepEqual(lerRota('#/explorar?busca=redes'), { tela: 'explorar', busca: 'redes' });
  assert.deepEqual(lerRota('#/explorar'), { tela: 'explorar' });
  // Busca vazia não é busca: «?busca=» tem a chave sem valor, e o campo da
  // tela nasce vazio — marcar busca: '' faria a tela achar que está filtrando.
  assert.deepEqual(lerRota('#/explorar?busca='), { tela: 'explorar' });
  // Parâmetro que ninguém pediu é ignorado, não virou chave fantasma.
  assert.deepEqual(lerRota('#/explorar?busca=redes&foo=bar'), { tela: 'explorar', busca: 'redes' });
});

test('rotas: linha fora de 1 a 7 é ignorada (não é a tela que filtra o número)', () => {
  // Se «linha=9» passasse, a tela receberia uma linha que não existe e o
  // resultado seria «Nenhuma estação» — que é o que a pessoa menos merece ao
  // digitar um número errado. Ignorar devolve a rede inteira.
  for (const ruim of ['0', '8', '9', '12', '-1', '2.5', 'abc', '', 'dois']) {
    assert.deepEqual(
      lerRota(`#/explorar?linha=${ruim}`),
      { tela: 'explorar' },
      `linha=«${ruim}» não devia entrar na rota`,
    );
  }
  for (const boa of [1, 2, 3, 4, 5, 6, 7]) {
    assert.deepEqual(lerRota(`#/explorar?linha=${boa}`).linha, boa);
  }
});

test('rotas: a busca sobrevive percent-encoded no ida e volta (o acento tem de voltar)', () => {
  // encodeURIComponent('cálculo') é «c%C3%A1lculo». Guardar o texto cru no hash
  // é o que faz o endereço ser compartilhável; e um % quebrado no endereço do
  // outro lado não pode derrubar o app — lerRota roda em todo hashchange.
  const ida = hrefDe({ tela: 'explorar', busca: 'cálculo', linha: 4 });
  assert.equal(ida, '#/explorar?busca=c%C3%A1lculo&linha=4');
  assert.deepEqual(lerRota(ida), { tela: 'explorar', busca: 'cálculo', linha: 4 });
  assert.doesNotThrow(() => lerRota('#/explorar?busca=%E0'));
  assert.doesNotThrow(() => lerRota('#/explorar?busca=%'));
});

test('rotas: hrefDe faz o caminho de volta, e só o explorar carrega busca e linha', () => {
  for (const rota of [
    { tela: 'explorar' },
    { tela: 'explorar', busca: 'calculo' },
    { tela: 'explorar', linha: 2 },
    { tela: 'explorar', busca: 'calculo', linha: 2 },
    { tela: 'jornada' },
    { tela: 'estacao', slug: 'calculo-i' },
  ]) {
    assert.deepEqual(lerRota(hrefDe(rota)), rota, `ida e volta perdeu «${JSON.stringify(rota)}»`);
  }
  // A estação não tem parâmetro nenhum: '?linha=' ali seria um dado que
  // nenhuma tela lê, e endereço que mente é pior que endereço sem nada.
  assert.equal(hrefDe({ tela: 'estacao', slug: 'redes-de-computadores-i' }), '#/estacao/redes-de-computadores-i');
  assert.equal(hrefDe({ tela: 'jornada', busca: 'calculo', linha: 2 }), '#/');
});
