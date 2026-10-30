// Projeto Atlas — testes da TELA DE METRÔ (pedido 16, 29/10/2026).
//
// O que se prova aqui, em cinco blocos:
//   1. a PLACA da próxima estação: selo da linha, nome no maior tamanho da
//      escala, UMA ação só — e o texto dela vem de textos.js, nunca escrito à mão;
//   2. a LINHA NA VERTICAL: a forma e o rótulo de CADA estado, lidos do CSS e do
//      DOM (círculo cheio, anel grosso, meio círculo, anel fino cinza);
//   3. o SELETOR das 7 linhas e a troca do diagrama;
//   4. a CHEGADA: concluir preenche o trecho, enche o círculo, e o desfazer
//      devolve EXATAMENTE (é o desfazerConclusao do núcleo, não uma cópia);
//   5. os DOIS ESTADOS: esqueleto parado (sem shimmer) e embarque da 1ª visita;
//   6. ACESSIBILIDADE: o botão diz o nome inteiro e o campo de anotação leva o
//      nome da disciplina no rótulo — o "Anotação, Anotação, Anotação" morre.
//
// Cada bloco tem uma MUTAÇÃO que quebra a função de propósito: teste que passa
// com a regra errada não é teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  desenharMetro, desenharEsqueleto, bindMetro, rotuloEstacao, acaoDaPlaca,
  textoDoQueFalta, estacoesDaLinha, linhasDoCatalogo, carregarViagem,
  salvarViagem, subirMetro, ESTADO_LEGIVEL, CHAVE_VIAGEM
} from '../web/metro.js';
import { ESTADOS, resumoDaViagem, estadoDaEstacao } from '../core/viagem.js';
import { placa as PLACAS, comValores, estados as TEXTOS_ESTADOS } from '../core/textos.js';

// ─────────────────────────────── mini-DOM ───────────────────────────────
// Só o que a tela usa: createElement, append, className, setAttribute, textContent,
// value, addEventListener, closest. Sem isso o teste viraria teste de navegador.
function criarNo(tag, doc) {
  const no = {
    tag, doc, children: [], attrs: {}, className: '', textContent: '', value: '',
    listeners: {}, parent: null, disabled: false, hidden: false,
    classList: {
      contains: (c) => no.className.split(/\s+/).includes(c),
      add: (...cs) => { no.className = [...no.className.split(/\s+/).filter(Boolean), ...cs].join(' '); },
      remove: (...cs) => { no.className = no.className.split(/\s+/).filter((c) => c && !cs.includes(c)).join(' '); }
    },
    setAttribute(k, v) { no.attrs[k] = String(v); },
    getAttribute(k) { return k in no.attrs ? no.attrs[k] : null; },
    append(...ns) { for (const n of ns) { n.parent = no; no.children.push(n); } },
    addEventListener(tipo, fn) { (no.listeners[tipo] ||= []).push(fn); },
    closest(sel) {
      const casa = (n) => {
        if (sel.startsWith('[')) {
          const nome = sel.slice(1, -1);
          return n.getAttribute && n.getAttribute(nome) !== null;
        }
        if (sel.startsWith('.')) return n.className.split(/\s+/).includes(sel.slice(1));
        return n.tag === sel;
      };
      for (let n = no; n; n = n.parent) if (casa(n)) return n;
      return null;
    }
  };
  return no;
}

function criarDoc() {
  const porId = new Map();
  const doc = {
    createElement: (tag) => criarNo(tag, doc),
    getElementById: (id) => porId.get(id) || null,
    body: criarNo('body')
  };
  doc.registrar = (id, no) => { no.setAttribute('id', id); porId.set(id, no); return no; };
  return doc;
}

function criarStorage(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados
  };
}

function disparar(no, tipo, alvo) {
  for (const fn of no.listeners[tipo] || []) fn({ target: alvo || no, preventDefault() {} });
}

function todos(raiz, pred, saida = []) {
  if (!raiz) return saida;
  if (pred(raiz)) saida.push(raiz);
  for (const f of raiz.children || []) todos(f, pred, saida);
  return saida;
}
const comClasse = (raiz, classe) => todos(raiz, (n) => n.className.split(/\s+/).includes(classe));
const comAttr = (raiz, nome) => todos(raiz, (n) => n.getAttribute && n.getAttribute(nome) !== null);
const porTag = (raiz, tag) => todos(raiz, (n) => n.tag === tag);
const textoDe = (raiz) => [raiz.textContent, ...raiz.children.map(textoDe)].filter(Boolean).join(' ');

// ─────────────────────────── o catálogo de teste ───────────────────────────
// 3 linhas × 2 estações, com pré-requisito entre linhas (baldeação) e com
// bibliografia + recurso, para a folha ser exercida de verdade.
const CATALOGO = [
  { id: 'l1a', title: 'Matemática Discreta', stage: 1, prerequisites: [], resourceUrl: 'https://exemplo.org/l1a', resourceType: 'video', bibliography: 'extras/bibliography/01_digital_circuits.md' },
  { id: 'l1b', title: 'Algoritmos I', stage: 1, prerequisites: [], resourceUrl: null, resourceType: null, bibliography: null },
  { id: 'l2a', title: 'Estrutura de Dados', stage: 2, prerequisites: ['l1b'], resourceUrl: 'https://exemplo.org/l2a', resourceType: 'texto', bibliography: 'extras/bibliography/02_data_structures.md' },
  { id: 'l2b', title: 'Arquitetura de Computadores', stage: 2, prerequisites: ['l1a', 'l1b'], resourceUrl: null, resourceType: null, bibliography: null },
  { id: 'l3a', title: 'Sistemas Operacionais', stage: 3, prerequisites: ['l2a'], resourceUrl: null, resourceType: null, bibliography: null },
  { id: 'l3b', title: 'Compiladores', stage: 3, prerequisites: ['l3a'], resourceUrl: null, resourceType: null, bibliography: null }
];

function raiz(doc) { return doc.registrar('metro', doc.createElement('div')); }

function desenhar({ completed = [], emCurso = [], linha = 1, aberta = null, despertas, embarqueAberto = false, notas = {} }) {
  const doc = criarDoc();
  const root = raiz(doc);
  const catalogo = CATALOGO.map((c) => (notas[c.id] ? { ...c, nota: notas[c.id] } : c));
  const progresso = { completed, emCurso, conclusoes: {} };
  const nos = desenharMetro(doc, root, {
    catalogo, progresso, linha, aberta, despertas, embarqueAberto
  });
  return { doc, root, nos, catalogo, progresso };
}

// ═══════════════════════════ 1. a placa ═══════════════════════════
test('placa: rótulo, selo da linha, o nome da próxima estação e UMA ação só', () => {
  const { root } = desenhar({ completed: ['l1a'] });
  const cartao = comClasse(root, 'placa')[0];
  assert.ok(cartao, 'a placa existe');
  assert.equal(comClasse(cartao, 'placa-rotulo')[0].textContent, PLACAS.proximaEstacao);
  assert.equal(comClasse(cartao, 'placa-linha')[0].textContent, comValores.linha(1),
    'o selo de texto é "Linha 1" — o nome da linha vem do núcleo, não é escrito à mão');
  assert.equal(comClasse(cartao, 'selo')[0].textContent, '1', 'o selo traz o número da linha');
  assert.ok(comClasse(cartao, 'selo')[0].className.includes('l1'), 'a cor vem da CLASSE da linha, nunca de hex no JS');

  // A próxima é l1b (a 1ª não concluída da ordem da fonte).
  assert.equal(comClasse(cartao, 'placa-nome')[0].textContent, 'Algoritmos I');
  const acoes = comClasse(cartao, 'placa-acao');
  assert.equal(acoes.length, 1, 'UMA ação só na placa — duas ações é duas decisões');
  assert.equal(acoes[0].textContent, PLACAS.comecarEstudar);
});

test('placa: a ação vira "Continuar" quando a estação já está em curso', () => {
  const { root } = desenhar({ completed: ['l1a'], emCurso: ['l1b'] });
  const acao = comClasse(root, 'placa-acao')[0];
  assert.equal(acao.textContent, PLACAS.continuar);
  assert.equal(acao.tag, 'button', 'em curso não abre recurso de novo: é botão, não link');
  assert.equal(acao.getAttribute('data-acao-placa'), 'l1b');
});

test('placa: a ação de quem ainda não começou é link para o recurso', () => {
  const { root } = desenhar({ completed: ['l1b'] });
  const acao = comClasse(root, 'placa-acao')[0];
  assert.equal(acao.tag, 'a');
  assert.equal(acao.getAttribute('href'), 'https://exemplo.org/l1a');
  assert.equal(acao.getAttribute('rel'), 'noopener', 'link externo sem noopener é janela aberta para o alvo');
});

test('placa: o contador é o texto do núcleo (N de M estações), não um número montado à mão', () => {
  const { root } = desenhar({ completed: ['l1a', 'l1b', 'l2a'] });
  assert.equal(comClasse(root, 'placa-contador')[0].textContent, comValores.viagem(3, CATALOGO.length));
});

test('MUTAÇÃO: placa sem selo da linha quebra o teste', () => {
  const mutado = desenharMetro.toString();
  assert.ok(mutado.includes("selo(doc, proxima.linha"), 'a placa desenha o selo da linha');
  assert.ok(mutado.includes('placa-nome'), 'e o nome da estação');
  // mutação real: sem o resumo do núcleo, a placa inventaria a próxima
  const resumo = resumoDaViagem({ completed: ['l1a'], emCurso: [], conclusoes: {} }, CATALOGO);
  assert.equal(resumo.proximaEstacao.id, 'l1b', 'quem escolhe a próxima é o núcleo');
});

// ═══════════════════════════ 2. a linha na vertical ═══════════════════════════
test('diagrama: 2 estações da linha, na ordem da fonte, com um trilho antes e depois', () => {
  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  const paradas = comClasse(root, 'parada');
  assert.equal(paradas.length, 2);
  assert.deepEqual(paradas.map((p) => comAttr(p, 'data-id')[0].getAttribute('data-id')), ['l1a', 'l1b']);
  for (const p of paradas) {
    assert.equal(comClasse(p, 'trilho').length, 2, 'cada estação tem o trecho de cima e o de baixo');
    assert.ok(comClasse(p, 'forma').length === 1, 'e uma forma');
  }
});

// FATIA 2 DO PEDIDO 21 — TDD honesto, no mesmo estilo de design-system.test.js:
// as travas abaixo já estão escritas e NENHUMA foi afrouxada. Cada uma leva
// { todo: 'fatia 2 do pedido 21: <o que falta>' } enquanto o desenho não existe,
// e perde o todo no commit em que a tela a faz passar. São 12, medidas na suíte
// de 29/10/2026 (284 testes: 271 pass, 12 fail, 1 todo).
test('diagrama: a FORMA de cada estado é a que o design system manda', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  // A mira deste teste estava errada (fati 2b-1, 29/10/2026): `css.indexOf('.forma {')`
  // achava primeiro `.trilho-col .forma { grid-row: 1 }`, um seletor que existia,
  // e devolvia o bloco errado. Agora o seletor é ancorado no INÍCIO da linha —
  // `.forma {` não casa com `.forma.concluida {`, e o miolo claro sempre esteve lá.
  const bloco = (seletor) => {
    const re = new RegExp(`^${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm');
    const m = re.exec(css);
    assert.ok(m, `o seletor ${seletor} existe no CSS (no começo da linha)`);
    const fim = css.indexOf('}', m.index);
    return css.slice(m.index, fim);
  };
  // concluída = círculo cheio
  assert.match(bloco('.forma.concluida'), /background:\s*var\(--cor\)/);
  // disponível = anel grosso com miolo claro
  assert.match(bloco('.forma.disponivel'), /border:\s*var\(--anel-disponivel\)\s*solid\s*var\(--cor\)/);
  assert.match(bloco('.forma'), /background:\s*var\(--superficie\)/, 'o miolo é claro');
  // em curso = meio círculo (metade cheia)
  const meio = css.slice(css.indexOf('.forma.em-curso::after'), css.indexOf('}', css.indexOf('.forma.em-curso::after')));
  assert.match(meio, /width:\s*50%/);
  assert.match(meio, /background:\s*var\(--cor\)/);
  // trancada = anel fino cinza
  assert.match(bloco('.forma'), /border:\s*var\(--anel-trancada\)\s*solid\s*var\(--trancada\)/);
});

test('diagrama: cada estado recebe a classe certa na forma (e a palavra ao lado)', () => {
  const { root } = desenhar({ completed: ['l1a', 'l2a'], emCurso: ['l1b'], linha: 2 });
  const formas = comClasse(root, 'forma');
  // linha 2: l2a concluída (pré l1b em curso? não: l1b não está em completed →
  // l2a tem faltante, mas completed manda: concluída), l2b trancada (falta l1a? não: l1a concluída; falta l1b)
  const porId = new Map(comAttr(root, 'data-id').map((b) => [b.getAttribute('data-id'), b]));
  // Mira corrigida na fatia 2b-1: a forma não é filha direta da .parada, é da
  // .trilho-col — procurar só nos filhos diretos dava undefined e o teste morria
  // com TypeError em vez de dizer o que faltava.
  const formaDe = (id) => comClasse(porId.get(id).parent, 'forma')[0];
  assert.ok(formaDe('l2a').className.includes('concluida'), 'concluída → círculo cheio');
  assert.ok(formaDe('l2b').className.includes('trancada'), 'trancada → anel fino');
  assert.equal(porId.get('l2b').children.find((c) => c.className.includes('estacao-estado')).textContent, 'trancada');
  assert.ok(formas.length >= 2);
});

test('diagrama: o trecho percorrido vai na cor cheia e o resto na cor a 25%', () => {
  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  const paradas = comClasse(root, 'parada');
  const trilhosDe = (p) => comClasse(p, 'trilho');
  assert.ok(trilhosDe(paradas[0])[1].className.includes('percorrido'),
    'depois de uma estação concluída, o trecho até a próxima está percorrido');
  assert.ok(!trilhosDe(paradas[1])[1].className.includes('percorrido'),
    'o trecho depois da não concluída fica na cor a 25%');
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(css, /\.trilho \{[^}]*background:\s*var\(--cor-fraca\)/, 'o padrão é a cor fraca');
  assert.match(css, /\.trilho\.percorrido \{[^}]*background:\s*var\(--cor\)/, 'e percorrido é a cor cheia');
});

test('diagrama: a próxima estação é a única marcada como "você está aqui"', () => {
  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  const proximas = comClasse(root, 'proxima');
  assert.equal(proximas.length, 1, 'uma só estação pulsa: dois "você está aqui" é nenhum');
  assert.ok(proximas[0].className.includes('forma'));
});

// ── FATIA 2b-1 (pedido 21, 29/10/2026): os três itens da crítica visual que
// abrem a tela no celular. Cada trava abaixo estava escrita como descrição do
// defeito; aqui ela vira MEDIDA. O centro x não é medido no node (não há
// layout), é garantido pela CONSTRUÇÃO: uma coluna só, da largura do maior
// círculo, com tudo centralizado — e a trava da construção é o que quebra se
// alguém voltar a dar altura ou largura fixa a um pedaço do traço.
test('linha contínua: nenhum pedaço do traço tem altura fixa, e cada um se estica até o círculo vizinho', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(css, /\.trilho-col \{[^}]*grid-template-rows:\s*1fr auto 1fr/,
    'a coluna dá ao traço o espaço ENTRE dois círculos, não uma altura inventada');
  assert.match(css, /\.trilho \{[^}]*align-self:\s*stretch/, 'cada pedaço enche a linha em que está');
  assert.equal(/\.trilho-(?:superior|inferior)\s*\{[^}]*height:/.exec(css), null,
    'altura fixa num pedaço é o buraco entre uma estação e a seguinte');
});

test('linha contínua: traço e círculo têm o mesmo centro x, e o círculo fica por cima', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(css, /\.trilho-col \{[^}]*justify-items:\s*center/,
    'traço de 6 px e círculo de 22 px partilham o centro da coluna');
  assert.match(css, /\.parada \{[^}]*grid-template-columns:\s*var\(--estacao-proxima\) 1fr/,
    'a coluna do traço tem a largura do MAIOR círculo: com `auto`, ela media 14 px e o centro mudava quando a próxima aparecia');
  assert.match(css, /\.forma \{[^}]*z-index:\s*1/, 'o círculo vem por cima do traço');
  assert.match(css, /\.forma \{[^}]*background:\s*var\(--superficie\)/, 'com miolo opaco, o traço não atravessa o círculo');
  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  for (const p of comClasse(root, 'parada')) {
    const col = comClasse(p, 'trilho-col')[0];
    assert.ok(col, 'cada parada tem a coluna do traço');
    assert.deepEqual(col.children.map((c) => c.className.split(' ')[0]), ['trilho', 'forma', 'trilho'],
      'a ordem na coluna é traço — círculo — traço, sem nó solto que abra vão');
  }
});

test('a próxima é a única maior (22 px) com o anel "você está aqui" pulsando devagar', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(css, /\.forma\.proxima \{[^}]*width:\s*var\(--estacao-proxima\)/, '22 px pelo token');
  assert.match(css, /\.forma\.proxima \{[^}]*height:\s*var\(--estacao-proxima\)/);
  assert.match(css, /\.forma\.proxima \{[^}]*animation:\s*anelAqui var\(--movimento-pulso\)/,
    'a voz devagar (2 s) é a do "você está aqui"');
  const ini = css.indexOf('@keyframes anelAqui');
  assert.ok(ini >= 0, 'a animação do anel existe');
  const corpo = css.slice(ini, css.indexOf('}', css.indexOf('50%', ini)));
  assert.match(corpo, /box-shadow:/, 'o anel cresce por box-shadow');
  assert.doesNotMatch(corpo, /transform:\s*scale/,
    'escalar o círculo de 22 px tiraria o traço do centro outra vez');
  assert.doesNotMatch(css, /\.forma\.disponivel \{[^}]*--estacao-proxima/,
    'as outras disponíveis ficam no tamanho normal: só a próxima é maior');
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /\.metro \*[^{]*\{[^}]*animation:\s*none\s*!important/,
    'com movimento reduzido, o anel da próxima fica parado');
  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  assert.equal(comClasse(root, 'proxima').length, 1, 'um só círculo de 22 px por linha');
});

test('a etiqueta de estado fica DEBAIXO do nome, à esquerda e um degrau menor', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(css, /\.estacao \{[^}]*flex-direction:\s*column/, 'o botão empilha: nome em cima, etiqueta embaixo');
  assert.match(css, /\.estacao \{[^}]*align-items:\s*flex-start/, 'e a etiqueta alinha à esquerda');
  assert.match(css, /\.estacao-estado \{[^}]*align-self:\s*flex-start[^}]*text-align:\s*left/);
  assert.match(css, /\.estacao-estado \{[^}]*font-size:\s*var\(--tipo-nota\)/, '12 px: --tipo-nota');
  assert.match(css, /\.estacao-nome \{[^}]*font-size:\s*var\(--tipo-corpo\)/, 'o nome é 16 px — a etiqueta é menor que ele');
  const { root } = desenhar({ linha: 1 });
  const botao = comAttr(root, 'data-id').find((b) => b.getAttribute('data-id') === 'l1a');
  assert.deepEqual(botao.children.map((c) => c.className), ['estacao-nome', 'estacao-estado'],
    'no DOM a etiqueta vem depois do nome');
});

test('folha: aberta mostra o recurso, a bibliografia como LINK COM NOME e a anotação', () => {
  const { root } = desenhar({ linha: 1, aberta: 'l1a' });
  const folha = comClasse(root, 'detalhe').find((d) => !d.attrs.hidden && d.getAttribute('hidden') === null);
  assert.ok(folha, 'a folha aberta existe');
  const link = comAttr(folha, 'data-bibliografia')[0];
  assert.equal(link.getAttribute('href'), 'extras/bibliography/01_digital_circuits.md',
    'o endereço é o caminho real da fonte');
  assert.equal(link.textContent, comValores.linkBibliografia('Matemática Discreta'),
    'o TEXTO é o nome — caminho cru na tela está na lista do proibido');
  assert.ok(!link.textContent.includes('extras/'), 'nenhum caminho aparece como texto');
  assert.equal(comAttr(folha, 'data-recurso')[0].getAttribute('href'), 'https://exemplo.org/l1a');
});

test('folha: fechada não mostra nada (hidden), e a trancada diz o que falta pelo NOME', { todo: 'fatia 2 do pedido 21: a folha trancada cita só um pré-requisito; tem de listar TODOS ("faltam Matemática Discreta, Algoritmos I")' }, () => {
  const fechada = desenhar({ linha: 1 });
  for (const d of comClasse(fechada.root, 'detalhe')) {
    assert.equal(d.getAttribute('hidden'), '', 'folha fechada é hidden');
  }
  const { root } = desenhar({ completed: [], linha: 2, aberta: 'l2b' });
  const falta = comClasse(root, 'detalhe-falta')[0];
  assert.equal(falta.textContent, comValores.trancadaFaltam('Matemática Discreta, Algoritmos I'));
  assert.ok(!falta.textContent.includes('l1a'), 'o que falta é dito pelo nome, nunca pelo id');
});

test('MUTAÇÃO: forma de estado que some do CSS é forma que a tela não desenha', () => {
  const { root } = desenhar({ completed: ['l1a'], emCurso: ['l1b'], linha: 1 });
  const formas = comClasse(root, 'forma').map((f) => f.className);
  assert.ok(formas.some((c) => c.includes('concluida')), 'concluída');
  assert.ok(formas.some((c) => c.includes('em-curso')), 'em curso (com hífen, como no CSS)');
  assert.equal(estadoDaEstacao('l1b', { completed: ['l1a'], emCurso: ['l1b'], conclusoes: {} }, CATALOGO).estado,
    ESTADOS.EM_CURSO, 'e o estado veio do núcleo');
});

// ═══════════════════════════ 3. o seletor das 7 linhas ═══════════════════════════
test('seletor: um selo por linha do catálogo, com a atual marcada', () => {
  const { root, nos } = desenhar({ linha: 2 });
  const selos = comClasse(root, 'selo').filter((s) => s.getAttribute('data-linha'));
  assert.deepEqual(selos.map((s) => s.getAttribute('data-linha')), ['1', '2', '3']);
  assert.equal(selos.filter((s) => s.getAttribute('aria-current') === 'true').length, 1,
    'uma linha atual, não duas');
  assert.equal(selos[1].getAttribute('aria-current'), 'true');
  assert.equal(selos[1].getAttribute('aria-label'), comValores.linha(2));
  assert.equal(nos.linha, 2);
});

test('seletor: linha pedida que não existe cai na linha da próxima estação', () => {
  const { nos } = desenhar({ completed: ['l1a', 'l1b'], linha: 99 });
  assert.equal(nos.linha, 2, 'a linha 99 não existe; a próxima estação está na 2');
});

test('seletor: tocar num selo troca o diagrama (bindMetro → abrirLinha)', () => {
  const doc = criarDoc();
  const root = raiz(doc);
  desenharMetro(doc, root, { catalogo: CATALOGO, progresso: { completed: [], emCurso: [], conclusoes: {} }, linha: 1 });
  let linhaPedida = null;
  bindMetro(doc, root, { abrirLinha: (n) => { linhaPedida = n; } });
  const selos = comClasse(root, 'selo').filter((s) => s.getAttribute('data-linha'));
  disparar(root, 'click', selos[2]);
  assert.equal(linhaPedida, 3, 'o toque vira número de linha, e quem troca o estado é quem chama');
  const { root: r2 } = desenhar({ linha: 3 });
  assert.deepEqual(comAttr(r2, 'data-id').map((b) => b.getAttribute('data-id')), ['l3a', 'l3b'],
    'e o diagrama passa a ser o da linha pedida');
});

test('seletor: tocar numa estação abre e fecha a folha dela', () => {
  const doc = criarDoc();
  const root = raiz(doc);
  desenharMetro(doc, root, { catalogo: CATALOGO, progresso: { completed: [], emCurso: [], conclusoes: {} }, linha: 1 });
  const abertos = [];
  bindMetro(doc, root, { abrirEstacao: (id) => abertos.push(id) });
  disparar(root, 'click', comAttr(root, 'data-id')[0]);
  assert.deepEqual(abertos, ['l1a']);
});

test('MUTAÇÃO: selo sem aria-current deixa de marcar a linha atual', () => {
  const fonte = desenharMetro.toString();
  assert.ok(fonte.includes("'aria-current': atual ? 'true' : null"),
    'a linha atual é marcada com aria-current, não só com cor');
});

// ═══════════════════════════ 4. a chegada e o desfazer ═══════════════════════════
function modulosFake({ completed = [] } = {}) {
  const guardado = { completed: [...completed], notas: {} };
  return {
    guardado,
    loadCatalog: async () => ({ courses: CATALOGO, origem: 'teste' }),
    loadCompleted: () => [...guardado.completed],
    saveCompleted: (_s, lista) => { guardado.completed = [...lista]; },
    loadNotas: () => ({ ...guardado.notas }),
    saveNotas: (_s, notas) => { guardado.notas = { ...notas }; },
    applyNote: (notas, id, texto) => ({ ...notas, [id]: texto })
  };
}

async function subirTela({ completed = [], timers = [] } = {}) {
  const doc = criarDoc();
  const root = raiz(doc);
  const storage = criarStorage();
  const modulos = modulosFake({ completed });
  const api = await subirMetro({
    document: doc, root, storage, modulos,
    setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    hoje: '2026-10-29'
  });
  return { api, doc, root, storage, modulos, timers };
}

test('chegada: concluir enche o círculo, marca o trecho e avisa com desfazer', { todo: 'fatia 2 do pedido 21: chegada — o círculo não enche, o trecho não marca e o aviso com desfazer não aparece' }, async () => {
  const { api, root, modulos, timers } = await subirTela({ completed: [] });
  api.acoes.concluir('l1a');
  assert.deepEqual(modulos.guardado.completed, ['l1a'], 'o progresso foi gravado');
  assert.deepEqual(api.progresso().conclusoes, { l1a: '2026-10-29' }, 'e a data da viagem também');
  const forma = comAttr(root, 'data-id').find((b) => b.getAttribute('data-id') === 'l1a')
    .parent.children.find((c) => c.className.includes('forma'));
  assert.ok(forma.className.includes('concluida'), 'o círculo encheu');
  assert.ok(comClasse(root, 'desperta').length === 1, 'a estação que chegou recebe o pulso curto');
  const aviso = comClasse(root, 'aviso-chegada')[0];
  assert.ok(aviso, 'o aviso apareceu');
  assert.equal(aviso.getAttribute('role'), 'status', 'role=status: o leitor de tela anuncia a chegada');
  assert.equal(comAttr(aviso, 'data-desfazer')[0].getAttribute('data-desfazer'), 'l1a');
  assert.equal(textoDe(aviso).includes(PLACAS.concluida), true);
  assert.equal(textoDe(aviso).includes(PLACAS.desfazer), true);
  assert.equal(timers.length, 1, 'o desfazer tem janela');
  assert.equal(timers[0].ms, 6000, '--janela-desfazer é 6000 ms no token, e o relógio usa o mesmo número');
});

test('chegada: depois da janela, o aviso some sozinho', { todo: 'fatia 2 do pedido 21: chegada — a linha redesenha com 4 nós em vez de 2 e o aviso não some sozinho' }, async () => {
  const { api, root, timers } = await subirTela({ completed: [] });
  api.acoes.concluir('l1a');
  timers[0].fn();
  assert.equal(comClasse(root, 'aviso-chegada').length, 0, 'o aviso não fica para sempre');
  assert.equal(comClasse(root, 'desperta').length, 0, 'e o pulso também não');
  assert.equal(comAttr(root, 'data-id').length, 2, 'a linha continua desenhada');
});

test('desfazer: devolve EXATAMENTE o estado anterior, inclusive a data', async () => {
  const { api, root, modulos, storage } = await subirTela({ completed: ['l1b'] });
  api.acoes.concluir('l1a');
  assert.deepEqual(modulos.guardado.completed.sort(), ['l1a', 'l1b']);
  api.acoes.desfazer('l1a');
  assert.deepEqual(modulos.guardado.completed, ['l1b'], 'a conclusão voltou');
  assert.equal(api.progresso().conclusoes.l1a, undefined, 'e a data da viagem foi apagada junto');
  assert.equal(comClasse(root, 'aviso-chegada').length, 0, 'o aviso sai junto');
  const viagem = JSON.parse(storage.getItem(CHAVE_VIAGEM));
  assert.deepEqual(viagem.conclusoes, {}, 'nada de data órfã no armazenamento');
});

test('desfazer: é o desfazerConclusao do núcleo, não uma regra reimplementada na tela', async () => {
  const fonte = readFileSync(fileURLToPath(new URL('../web/metro.js', import.meta.url)), 'utf8');
  assert.match(fonte, /import \{[\s\S]*desfazerConclusao[\s\S]*\} from '\.\.\/core\/viagem\.js'/);
  assert.ok(!fonte.includes('completed.filter((x) => x !== id)'),
    'a tela não filtra completed à mão: quem desfaz é o núcleo');
  assert.ok(fonte.includes('concluirEstacao(antes, id'), 'e quem conclui também');
});

test('MUTAÇÃO: concluir sem o núcleo deixaria a data de viagem de fora', async () => {
  const { api, modulos } = await subirTela({ completed: [] });
  api.acoes.concluir('l1a');
  const antes = modulos.guardado.completed.length;
  api.acoes.concluir('l1a'); // segundo toque: dois toques no celular existem
  assert.equal(modulos.guardado.completed.length, antes, 'concluir duas vezes não duplica');
  assert.equal(Object.keys(api.progresso().conclusoes).length, 1, 'nem cria duas datas de viagem');
});

test('chegada: os marcos vêm do núcleo — a tela não calcula o que destrancou', async () => {
  const fonte = readFileSync(fileURLToPath(new URL('../web/metro.js', import.meta.url)), 'utf8');
  assert.match(fonte, /marcosNovos\(antes, depois, ui\.catalogo\)/);
});

// ═══════════════════════════ 5. os dois estados ═══════════════════════════
test('esqueleto: parado, sem brilho correndo, e o atraso mora no CSS', { todo: 'fatia 2 do pedido 21: esqueleto parado, sem shimmer, com o atraso declarado no CSS' }, () => {
  const doc = criarDoc();
  const root = raiz(doc);
  const box = desenharEsqueleto(doc, root);
  assert.equal(root.getAttribute('aria-busy'), 'true', 'aria-busy enquanto carrega');
  assert.equal(comClasse(box, 'esqueleto-circulo').length, 5, '5 círculos cinza');
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  const bloco = css.slice(css.indexOf('.esqueleto {'), css.indexOf('}', css.indexOf('.esqueleto {')));
  assert.match(bloco, /var\(--atraso-esqueleto\)/, 'o esqueleto só aparece depois de 150 ms');
  assert.ok(!/shimmer|linear-gradient/.test(css), 'sem brilho correndo: shimmer é spinner disfarçado');
  assert.ok(!/animation:[^;]*infinite[^;]*esqueleto/.test(css), 'e nada gira para sempre');
});

test('esqueleto: a tela carregando não mostra placa nenhuma', { todo: 'fatia 2 do pedido 21: a tela carregando não mostra o esqueleto (0 em vez de 1)' }, async () => {
  const doc = criarDoc();
  const root = raiz(doc);
  let soltar;
  const modulos = modulosFake();
  modulos.loadCatalog = () => new Promise((r) => { soltar = r; });
  const api = subirMetro({
    document: doc, root, storage: criarStorage(), modulos,
    setTimeout: () => 0, hoje: '2026-10-29'
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(comClasse(root, 'esqueleto').length, 1, 'mostra o esqueleto');
  assert.equal(comClasse(root, 'placa').length, 0, 'e nenhuma placa pela metade');
  soltar({ courses: CATALOGO });
  const pronto = await api;
  assert.equal(pronto.ok, true);
  assert.equal(comClasse(root, 'esqueleto').length, 0, 'carregou: o esqueleto sai');
  assert.ok(comClasse(root, 'placa').length === 1);
});

test('embarque: com 0 concluídas, diz por onde começar e oferece marcar o que já sabe', async () => {
  const { root } = desenhar({ completed: [] });
  const emb = comClasse(root, 'embarque')[0];
  assert.ok(emb, 'o embarque aparece na primeira visita');
  assert.equal(comClasse(emb, 'embarque-titulo')[0].textContent, TEXTOS_ESTADOS.primeiraVisita.titulo);
  assert.equal(comClasse(emb, 'embarque-texto')[0].textContent, TEXTOS_ESTADOS.primeiraVisita.descricao);
  assert.equal(comClasse(emb, 'embarque-acao')[0].textContent, TEXTOS_ESTADOS.primeiraVisita.acao);
  const abrir = comAttr(emb, 'data-embarque')[0];
  assert.equal(abrir.textContent, TEXTOS_ESTADOS.primeiraVisita.botao);
  assert.equal(abrir.getAttribute('aria-expanded'), 'false', 'a lista começa fechada');
  assert.equal(comAttr(emb, 'data-marcar').length, 0);
});

test('embarque: aberto, lista as estações que dá para marcar de uma vez', { todo: 'fatia 2 do pedido 21: o embarque aberto não lista as estações marcáveis (devolve [])' }, async () => {
  const { root } = desenhar({ completed: ['l1a'], linha: 1, embarqueAberto: true });
  const emb = comClasse(root, 'embarque')[0];
  const marcar = comAttr(emb, 'data-marcar');
  // destrancadas e não concluídas: l1b, l2a, l3a (l2b e l3b ainda trancadas)
  assert.deepEqual(marcar.map((b) => b.getAttribute('data-marcar')).sort(), ['l1b', 'l2a', 'l3a']);
  for (const b of marcar) assert.equal(b.textContent, PLACAS.marcar);
});

test('embarque: marcar uma estação conclui pelo verbo do núcleo', { todo: 'fatia 2 do pedido 21: marcar no embarque não conclui pelo núcleo e o embarque não sai de cena' }, async () => {
  const { api, root, modulos } = await subirTela({ completed: [] });
  api.acoes.embarque();
  assert.equal(comAttr(root, 'data-marcar').length > 0, true);
  api.acoes.marcar('l1a');
  assert.deepEqual(modulos.guardado.completed, ['l1a']);
  assert.equal(comClasse(root, 'embarque').length, 0, 'com 1 concluída, o embarque sai');
});

test('MUTAÇÃO: embarque aparecendo para quem já concluiu algo é mentira', async () => {
  const { root } = desenhar({ completed: ['l1a'] });
  assert.equal(comClasse(root, 'embarque').length, 0);
  const resumo = resumoDaViagem({ completed: ['l1a'], emCurso: [], conclusoes: {} }, CATALOGO);
  assert.equal(resumo.concluidas, 1, 'e é o resumo do núcleo que decide isso');
});

// ═══════════════════════════ 6. acessibilidade ═══════════════════════════
test('cada estação é um botão cujo rótulo o leitor de tela lê inteiro', () => {
  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  const botoes = comAttr(root, 'data-id');
  assert.equal(botoes.length, 2);
  assert.equal(botoes[1].getAttribute('aria-label'), 'Algoritmos I, Linha 1, disponível');
  assert.equal(botoes[0].getAttribute('aria-label'), 'Matemática Discreta, Linha 1, concluída');
  for (const b of botoes) {
    assert.equal(b.tag, 'button', 'estação é botão, não div clicável');
    assert.ok(b.getAttribute('aria-controls'), 'e aponta para a folha que abre');
    assert.ok(['true', 'false'].includes(b.getAttribute('aria-expanded')), 'com aria-expanded');
  }
});

test('rótulo: os 4 estados têm palavra legível, e a linha entra quando existe', { todo: 'fatia 2 do pedido 21: sem linha o rótulo inventa "Linha 0" em vez de omitir a linha' }, () => {
  assert.equal(
    rotuloEstacao({ titulo: 'Matemática Discreta', estado: ESTADOS.DISPONIVEL }, 2),
    'Matemática Discreta, Linha 2, disponível'
  );
  assert.equal(
    rotuloEstacao({ titulo: 'X', estado: ESTADOS.TRANCADA }, null),
    'X, trancada', 'sem linha não se inventa "Linha null"'
  );
  assert.deepEqual(Object.keys(ESTADO_LEGIVEL).sort(), Object.values(ESTADOS).sort(),
    'os 4 estados do núcleo têm palavra');
});

test('anotação: o rótulo leva o nome da disciplina (o "Anotação, Anotação" morre)', { todo: 'fatia 2 do pedido 21: o rótulo da anotação repete a palavra "Anotação" (2 em vez de 1)' }, () => {
  const { root } = desenhar({ linha: 1, aberta: 'l1a' });
  const areas = comClasse(root, 'anotacao');
  assert.equal(areas.length, 1);
  assert.equal(areas[0].getAttribute('aria-label'), 'Anotação de Matemática Discreta');
  const rotulo = areas[0].parent;
  assert.equal(rotulo.tag, 'label', 'é um label de verdade');
  assert.equal(rotulo.getAttribute('for'), areas[0].getAttribute('id'), 'label aponta para o campo');
  assert.equal(rotulo.children[0].textContent, 'Anotação — Matemática Discreta');

  const duas = desenhar({ linha: 2, aberta: 'l2a' });
  const a2 = comClasse(duas.root, 'anotacao')[0];
  assert.notEqual(a2.getAttribute('aria-label'), areas[0].getAttribute('aria-label'),
    'duas disciplinas, dois rótulos diferentes — nunca "Anotação" três vezes');
});

test('anotação: o que a pessoa escreveu volta no campo, e o input salva', { todo: 'fatia 2 do pedido 21: a anotação não sobrevive ao redesenho — o campo volta vazio' }, async () => {
  const { api, root, modulos } = await subirTela({ completed: ['l1a'] });
  api.acoes.abrirEstacao('l1a');
  api.acoes.anotar('l1a', 'exercícios 1 a 9');
  assert.deepEqual(modulos.guardado.notas, { l1a: 'exercícios 1 a 9' });
  api.acoes.abrirEstacao('l1a');
  const area = comClasse(root, 'anotacao')[0];
  assert.equal(area.value, 'exercícios 1 a 9', 'a anotação sobrevive ao redesenho');
});

test('ação da placa: a palavra certa para cada estado, vinda de textos.js', () => {
  assert.equal(acaoDaPlaca(ESTADOS.EM_CURSO), PLACAS.continuar);
  assert.equal(acaoDaPlaca(ESTADOS.DISPONIVEL), PLACAS.comecarEstudar);
  assert.equal(acaoDaPlaca(ESTADOS.TRANCADA), PLACAS.comecarEstudar);
  assert.equal(PLACAS.comecarEstudar, 'Começar a estudar', 'o texto é o do pedido');
  assert.equal(PLACAS.continuar, 'Continuar');
});

test('o que falta é dito pelo nome, e ciclo não vira "conclua o impossível"', () => {
  assert.equal(textoDoQueFalta({ faltam: [{ titulo: 'A' }, { titulo: 'B' }] }), 'trancada: faltam A, B');
  assert.equal(textoDoQueFalta({ faltam: [{ titulo: 'A' }] }), 'trancada: falta A');
  assert.equal(textoDoQueFalta({ ciclo: true, faltam: [{ titulo: 'A' }] }), TEXTOS_ESTADOS.ramalEmObras.descricao);
  assert.equal(textoDoQueFalta({ faltam: [] }), '');
});

test('movimento reduzido: as animações são desligadas, o estado continua', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  const bloco = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(bloco, /animation:\s*none/);
  assert.match(bloco, /transition:\s*none/);
  assert.match(bloco, /\.esqueleto \{\s*opacity:\s*1/, 'sem animação, o esqueleto aparece de uma vez');
});

test('CSS: nenhum valor à mão — cor, duração e raio vêm dos tokens', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.equal(css.match(/#[0-9a-fA-F]{3,8}\b/g), null, 'nenhum hex');
  assert.equal(css.match(/\b\d+(ms|s)\b/g), null, 'nenhuma duração escrita à mão');
  assert.equal(css.match(/rgba?\(/g), null, 'nenhum rgb à mão');
  assert.match(css, /width:\s*var\(--trilho\)/, 'a espessura da linha é o token --trilho (6 px)');
  assert.match(css, /min-height:\s*var\(--alvo-toque\)/, 'e o alvo de toque é o token');
  assert.equal(css.match(/@media \([^)]*width/g), null,
    'nenhum @media de largura: mobile-first, e os próximos pedidos trazem os seus com os números dos tokens');
});

test('viagem em curso: em curso e datas ficam numa chave própria; completed é a fonte compartilhada', () => {
  const storage = criarStorage({ [CHAVE_VIAGEM]: JSON.stringify({ emCurso: ['l1b'], conclusoes: { l1a: '2026-10-01' } }) });
  const p = carregarViagem(storage, ['l1a']);
  assert.deepEqual(p.completed, ['l1a']);
  assert.deepEqual(p.emCurso, ['l1b']);
  assert.deepEqual(p.conclusoes, { l1a: '2026-10-01' });
  // storage corrompido não derruba a tela
  const ruim = carregarViagem(criarStorage({ [CHAVE_VIAGEM]: '{{{' }), ['l1a']);
  assert.deepEqual(ruim, { completed: ['l1a'], emCurso: [], conclusoes: {} });
  // gravar devolve true, e gravar sem storage devolve false sem exceção
  assert.equal(salvarViagem(storage, { completed: [], emCurso: ['x'], conclusoes: {} }), true);
  assert.equal(salvarViagem(null, { completed: [], emCurso: [], conclusoes: {} }), false);
});

test('estrelas: linhas e estações saem do catálogo, sem número fixo', () => {
  assert.deepEqual(linhasDoCatalogo(CATALOGO), [1, 2, 3]);
  assert.deepEqual(estacoesDaLinha(CATALOGO, 2).map((c) => c.id), ['l2a', 'l2b']);
  assert.deepEqual(estacoesDaLinha(CATALOGO, 9), []);
});
