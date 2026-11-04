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
  salvarViagem, subirMetro, ESTADO_LEGIVEL, CHAVE_VIAGEM,
  origemDoRecurso, hostDoRecurso, dominioLegivel, ORIGEM_DE_SITE, textoDaChegada
} from '../web/metro.js';
import {
  ESTADOS, resumoDaViagem, estadoDaEstacao, concluirEstacao, abreComBaldeacao
} from '../core/viagem.js';
import {
  placa as PLACAS, comValores, estados as TEXTOS_ESTADOS, ORIGEM, TIPO_DE_ORIGEM,
  jornada as J
} from '../core/textos.js';
import { setNota } from '../core/notes.js';
import * as mainReal from '../web/main.js';

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

// S5 parte 2: a folha deixou de ser o `detalhe` escondido atrás de cada
// cartão. O painel é um só (.folha, de web/folha.js) e existe quando a rota
// #/estacao/<slug> existe. Este ajudante substitui o `find(d => !hidden)` que
// os 18 casos de dentro usavam.
function abrirFolha(raiz) {
  const f = comClasse(raiz, 'folha')[0];
  assert.ok(f, 'a rota da estação desenha o painel .folha');
  return f;
}

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

function desenhar({ completed = [], emCurso = [], linha = 1, folha = null, despertas, embarqueAberto = false, conclusoes = {}, notas = {}, catalogo: dado = CATALOGO }) {
  const doc = criarDoc();
  const root = raiz(doc);
  // `dado` é o catálogo inteiro quando o teste precisa de um catálogo que não
  // seja o padrão (a 2d-1: um recurso com tipo e domínio QUE O CATÁLOGO REAL USA,
  // porque exemplo.org/video não existe em lugar nenhum e não ensinaria nada).
  const catalogo = dado.map((c) => (notas[c.id] ? { ...c, nota: notas[c.id] } : c));
  // 2d-2: o carimbo da folha concluída lê a data que O NÚCLEO guarda, então o
  // desenho de teste precisa poder dar uma data a uma estação concluída.
  const progresso = { completed, emCurso, conclusoes };
  const nos = desenharMetro(doc, root, {
    catalogo, progresso, linha, folha, despertas, embarqueAberto
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
  // O texto do aviso É uma chamada, não um texto escrito à mão dentro do desenho
  // (regra 2 do metro.js): se a função sumir da linha, o aviso volta a ser
  // \"Concluída.\" mudo — que é exatamente o que a 2d-1 veio consertar.
  assert.ok(mutado.includes('textoDaChegada('), 'quem escreve o aviso é uma função, não o render');
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

// ─── FATIA 2b-2 DO PEDIDO 21 (itens 4 a 7 da crítica do Claude, 29/10/2026) ───
// A marca no topo, UM verbo só, a bibliografia como link com nome para o arquivo
// NA FONTE no SHA auditado, e o botão de concluir fora desta tela (a chegada com
// desfazer é da fatia 2c). Os testes abaixo substituem os que mediam o desenho
// antigo — nenhum foi afrouxado: o href relativo que existia virou URL absoluta.

// S2 (31/10/2026), item 7 da crítica do Lovable: o nome "Atlas" aparecia
// DUAS VEZES — no logo do topo (HTML) e no cabeçalho desenhado aqui embaixo.
// Duas faixas de cabeçalho seguidas é a tela se apresentando duas vezes. O
// cabeçalho desenhado perde o nome e fica só a linha do curso, que passa a
// ser o rótulo da tela. O teste mudou de alvo, não de força: continua
// exigindo que a marca seja o PRIMEIRO nó, antes da placa.
test('marca: o nome "Atlas" não se repete embaixo do logo', () => {
  const { root } = desenhar({ completed: ['l1a'] });
  const marca = root.children[0];
  assert.ok(marca, 'existe um primeiro nó antes da placa');
  assert.equal(marca.className.split(/\s+/).includes('marca'), true, 'a marca é o primeiro nó');
  assert.equal(marca.tag, 'div',
    'é DIV, não HEADER: o cabeçalho do app é o <header class="topo"> do HTML, e um segundo header na tela é duas faixas');
  assert.equal(comClasse(marca, 'marca-nome').length, 0,
    'o nome não volta: ele já está no logo do topo');
  assert.equal(comClasse(marca, 'marca-linha')[0].textContent, PLACAS.marcaLinha,
    'a linha do curso continua, vinda de textos.js');
});

test('marca: o desenho sai dos tokens, e a regra do nome que morreu não volta', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(css, /\.marca-linha \{[^}]*font-size: var\(--tipo-/, 'a linha do curso usa a escala tipográfica');
  assert.equal(/^\.marca-nome\s*\{/m.test(css), false,
    'a regra .marca-nome sobrou no CSS: o elemento não é mais desenhado');
});

// ═══════════ A FOLHA (S5 parte 2): o painel da rota, não do cartão ═══════════
// Até aqui a folha morava DENTRO da linha (o `detalhe` com aria-expanded) e
// estes casos a provavam de dentro. A S5 parte 2 deu a ela uma rota própria
// (#/estacao/<slug>) e o desenho veio de web/folha.js. O que cada caso cobra
// é o MESMO comportamento, medido no painel da vez.

test('folha: o recurso abre com o VERBO ÚNICO da tela, nunca "Começar a viagem"', () => {
  const { root } = desenhar({ linha: 1, folha: 'l1a' });
  const folha = abrirFolha(root);
  const recurso = comAttr(folha, 'data-recurso')[0];
  assert.equal(recurso.textContent, PLACAS.comecarEstudar,
    'o mesmo texto da placa: UM verbo só na tela (item 5 da crítica)');
  assert.equal(recurso.getAttribute('href'), 'https://exemplo.org/l1a');
  assert.equal(todos(root, (n) => n.textContent === 'Começar a viagem').length, 0,
    'nenhum "Começar a viagem" em lugar nenhum da tela');
});

test('textos: a chave embarcar morreu — o verbo único não fica de reserva', () => {
  assert.equal(PLACAS.embarcar, undefined, 'placa.embarcar não existe mais em textos.js');
  assert.equal(Object.values(PLACAS).includes('Começar a viagem'), false,
    'e a frase não está guardada em nenhuma outra chave');
});

test('folha: a bibliografia é "Bibliografia na fonte" e aponta para o arquivo no SHA auditado', () => {
  const { root } = desenhar({ linha: 1, folha: 'l1a' });
  const link = comAttr(abrirFolha(root), 'data-bibliografia')[0];
  assert.equal(link.textContent, PLACAS.bibliografiaNaFonte, 'o NOME, nunca o caminho');
  assert.equal(link.getAttribute('href'),
    'https://github.com/Universidade-Livre/ciencia-da-computacao/blob/b995c11/extras/bibliography/01_digital_circuits.md',
    'a fonte, no commit em que a grade foi auditada — nem main (muda), nem relativo (não existe no app)');
  assert.ok(!link.textContent.includes('extras/'), 'nenhum caminho aparece como texto');
  assert.equal(link.getAttribute('rel'), 'noopener');
});

test('folha: a bibliografia de toda estação trancada que tem fonte sai no mesmo SHA', () => {
  const { root } = desenhar({ completed: [], linha: 2, folha: 'l2a' });
  const link = comAttr(abrirFolha(root), 'data-bibliografia')[0];
  assert.equal(link.getAttribute('href'),
    'https://github.com/Universidade-Livre/ciencia-da-computacao/blob/b995c11/extras/bibliography/02_data_structures.md');
});

// MUTOU na fatia 2c-1 (30/10/2026), e a mutação é o ponto todo: em 2b-2 este
// teste garantia a AUSÊNCIA do botão porque mexer nele não desenhava chegada
// nenhuma — botão morto é promessa falsa. Com a chegada no ar, o botão volta e
// agora é MEdIDO: aparece na estação aberta quando há o que concluir, e não
// aparece na trancada nem na concluída. S5 parte 2: "folha aberta" passou a ser
// a ROTA, e o painel é um só — o botão existe onde o estado tem o que concluir.
test('folha: "Concluir estação" existe e só onde há o que concluir', () => {
  const disponivel = desenhar({ linha: 1, folha: 'l1a' });
  assert.equal(comAttr(disponivel.root, 'data-concluir').length, 1, 'a estação disponível aberta tem o botão');
  assert.equal(comAttr(disponivel.root, 'data-concluir')[0].getAttribute('data-concluir'), 'l1a');
  assert.equal(textoDe(comAttr(disponivel.root, 'data-concluir')[0]), PLACAS.concluir, 'e o verbo do núcleo');
  const emCurso = desenhar({ completed: ['l1a'], emCurso: ['l1b'], linha: 1, folha: 'l1b' });
  assert.equal(comAttr(emCurso.root, 'data-concluir').length, 1, 'a em curso também');
  const trancada = desenhar({ linha: 2, folha: 'l2a' });
  assert.equal(comAttr(trancada.root, 'data-concluir').length, 0, 'trancada não tem o que concluir');
  const concluida = desenhar({ completed: ['l1a'], linha: 1, folha: 'l1a' });
  assert.equal(comAttr(concluida.root, 'data-concluir').length, 0, 'concluída também não');
  const semRota = desenhar({ linha: 1 });
  assert.equal(comAttr(semRota.root, 'data-concluir').length, 0, 'e sem rota de estação não há painel nenhum');
});

test('folha: tocar em "Concluir estação" conclui pelo núcleo e traz a chegada', async () => {
  const { api, root, voltarFolha } = await subirTela({ completed: [] });
  voltarFolha('l1a');
  const botao = comAttr(root, 'data-concluir')[0];
  assert.ok(botao, 'o botão está desenhado na folha da rota');
  // UM disparo só: o bind já está ligado pelo subirTela, e repetir o bind
  // empilharia listeners no root — o teste mediria a pilha, não o toque.
  disparar(root, 'click', botao);
  assert.deepEqual(api.progresso().completed, ['l1a'], 'o toque no botão chegou ao núcleo');
  assert.equal(comClasse(root, 'aviso-chegada').length, 1, 'e a tela respondeu com a chegada');
});

// S5 parte 2: o Esc. `disparar` monta {target, preventDefault} e não traz
// `key`, e o handler do teclado existe PELO key — aqui o evento é montado como
// o navegador o monta. E o `window` entra por deps só por causa do endereço:
// o fechar NAVEGA, não apaga um estado interno.
async function telaComEndereco(aparelho, folha) {
  const doc = criarDoc();
  const root = raiz(doc);
  const modulos = modulosFake({ completed: [] });
  globalThis.localStorage = modulos.guardado.aparelho;
  let api;
  try {
    api = await subirMetro({
      document: doc, root, storage: criarStorage(), modulos,
      setTimeout: () => ({}), hoje: '2026-10-29',
      window: { location: aparelho }, folha
    });
  } finally {
    delete globalThis.localStorage;
  }
  const esc = () => { for (const fn of root.listeners.keydown || []) fn({ key: 'Escape', target: root }); };
  return { api, root, esc };
}

test('folha: Esc fecha a folha navegando para #/', async () => {
  const aparelho = { hash: '#/estacao/l1a' };
  const { root, esc } = await telaComEndereco(aparelho, 'l1a');
  assert.equal(comClasse(root, 'folha').length, 1, 'a rota abriu a folha');
  esc();
  // Fechar é IR para #/, não apagar um estado: quem relê o endereço e remonta
  // é o casco (web/casco.js). Cobrar o DOM vazio aqui seria testar o casco
  // dentro do metrô, e o `hashchange` tem um dono só por regra.
  assert.equal(aparelho.hash, '#/', 'o Esc devolve a pessoa ao mapa pelo endereço');
});

test('folha: na tela do mapa, o Esc não toca no endereço', async () => {
  const aparelho = { hash: '#/' };
  const { root, esc } = await telaComEndereco(aparelho, null);
  assert.equal(comClasse(root, 'folha').length, 0, 'sem rota não há painel');
  esc();
  assert.equal(aparelho.hash, '#/', 'Esc sem folha não cria entrada no histórico');
});

// FEITO na fatia 2c-2 (30/10/2026) e MUTOU na S5 parte 2: a folha fechada deixou
// de existir no DOM (era `hidden`; agora não há painel sem rota — nada a
// esconder), e a trancada aberta cita TODOS os pré-requisitos pelo nome.
test('folha: sem rota não há painel, e a trancada diz o que falta pelo NOME', () => {
  const semRota = desenhar({ linha: 1 });
  assert.equal(comClasse(semRota.root, 'folha').length, 0,
    'sem #/estacao/<slug> não há diálogo na fila do leitor de tela');
  const { root } = desenhar({ completed: [], linha: 2, folha: 'l2b' });
  const falta = comClasse(abrirFolha(root), 'folha-falta')[0];
  assert.ok(falta, 'a trancada lista as conexões que faltam');
  assert.ok(textoDe(falta).includes('Matemática Discreta') && textoDe(falta).includes('Algoritmos I'),
    'TODOS os pré-requisitos, pelo nome');
  assert.ok(!textoDe(falta).includes('l1a'), 'o que falta é dito pelo nome, nunca pelo id');
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
  // S2: aria-current saiu do seletor. Ele é um grupo de botões de estado, não
  // um link de navegação — aria-pressed é o atributo de "este está ligado".
  assert.equal(selos.filter((s) => s.getAttribute('aria-pressed') === 'true').length, 1,
    'uma linha atual, não duas');
  assert.equal(selos[1].getAttribute('aria-pressed'), 'true');
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


test('MUTAÇÃO: selo sem aria-pressed deixa de marcar a linha atual', () => {
  const fonte = desenharMetro.toString();
  assert.ok(fonte.includes("'aria-pressed': atual ? 'true' : 'false'"),
    'a linha atual é marcada com aria-pressed, não só com cor');
});

// ═══════════════════════════ 4. a chegada e o desfazer ═══════════════════════════
// O DUBLÊ NÃO PODE MENTIR (30/10/2026): ele tinha `applyNote(notas, id, texto)` e
// `saveNotas(storage, notas)` — nome e assinatura que o main.js real nunca teve.
// O teste mediu o dublê, não a tela, e a anotação quebrou no navegador. Agora as
// assinaturas são as de lá (o teste de contrato confere as duas pontas) e o que
// se guarda no aparelho é o que o main.js guarda: JSON numa chave, escrito com a
// regra do núcleo (setNota corta em 280 e apaga no texto vazio), não um dicionário
// à mão em memória.
const CHAVE_NOTAS = 'atlas.anotacoes.v1';
const CHAVE_PROGRESSO = 'atlas.progresso.v1';

function modulosFake({ completed = [], catalogo = CATALOGO } = {}) {
  const aparelho = criarStorage();
  const guardado = { completed: [...completed], notas: {}, aparelho };
  const lerNotas = () => {
    try { return JSON.parse(aparelho.getItem(CHAVE_NOTAS)) || {}; } catch { return {}; }
  };
  return {
    guardado,
    loadCatalog: async () => ({ courses: catalogo, origem: 'teste' }),
    loadCompleted: () => [...guardado.completed],
    saveCompleted: (lista) => {
      guardado.completed = [...lista];
      aparelho.setItem(CHAVE_PROGRESSO, JSON.stringify(lista));
    },
    loadNotas: () => ({ ...lerNotas() }),
    saveNotas: (notas) => {
      guardado.notas = { ...notas };
      aparelho.setItem(CHAVE_NOTAS, JSON.stringify(notas));
      return true;
    },
    aplicarNota: (state = {}, id, texto) => ({ ...state, anotacoes: setNota(state.anotacoes, id, texto) })
  };
}

async function subirTela({ completed = [], timers = [], catalogo = CATALOGO } = {}) {
  const doc = criarDoc();
  const root = raiz(doc);
  const storage = criarStorage();
  const modulos = modulosFake({ completed, catalogo });
  // O main.js real escreve no localStorage GLOBAL, nunca recebe storage. O dublê
  // faz o mesmo: fazer diferente seria continuar testando uma tela que não existe.
  globalThis.localStorage = modulos.guardado.aparelho;
  let api;
  try {
    api = await subirMetro({
      document: doc, root, storage, modulos,
      setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
      hoje: '2026-10-29'
    });
  } finally {
    delete globalThis.localStorage;
  }
  return {
    api, doc, root, storage, modulos, timers,
    // S5 parte 2: quem liga hash → tela é o casco (web/casco.js), que não
    // existe no node. O ajudante faz o que o casco faria: entrega o slug à
    // tela e redesenha. O `pintar` é o mesmo do subirMetro.
    voltarFolha: (slug) => { api.ui.folha = slug; api.pintar(); }
  };
}

// FEITO na fatia 2c-1 (30/10/2026): perdeu o `todo` neste commit. O círculo
// enche (classe concluída, cor do estado do núcleo), o trecho que leva até a
// estação sobe à cor cheia com a classe `chegada`, e o aviso com desfazer sai
// do desenho — sem nós a mais na linha e sem redesenho para sumir.
test('chegada: concluir enche o círculo, marca o trecho e avisa com desfazer', async () => {
  const { api, root, modulos, timers } = await subirTela({ completed: [] });
  api.acoes.concluir('l1a');
  assert.deepEqual(modulos.guardado.completed, ['l1a'], 'o progresso foi gravado');
  assert.deepEqual(api.progresso().conclusoes, { l1a: '2026-10-29' }, 'e a data da viagem também');
  // Mira: a forma NÃO é filha direta da .parada, é da .trilho-col (lição da
  // 2b-1, a mesma correção do teste dos estados). Percorrer é o jeito certo.
  const paradaL1a = comAttr(root, 'data-id').find((b) => b.getAttribute('data-id') === 'l1a').parent;
  const forma = comClasse(paradaL1a, 'forma')[0];
  assert.ok(forma.className.includes('concluida'), 'o círculo encheu');
  assert.ok(forma.className.includes('chegada'), 'e a forma da estação que chegou é a da chegada');
  // O trecho que LEVA até ela: o trilho superior da parada, à cor cheia.
  const superior = comClasse(forma.parent, 'trilho')[0];
  assert.ok(superior.className.includes('chegada'), 'o trecho até a estação marca a chegada');
  const cssChegada = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  assert.match(cssChegada, /\.trilho\.chegada \{[^}]*background:\s*var\(--cor\)/,
    'e a cor cheia do trecho vem do CSS, com o token de movimento da chegada');
  assert.match(cssChegada, /\.trilho\.chegada \{[^}]*var\(--movimento-chegada\)/);
  assert.ok(comClasse(root, 'desperta').length === 1, 'a estação que chegou recebe o pulso curto');
  const aviso = comClasse(root, 'aviso-chegada')[0];
  assert.ok(aviso, 'o aviso apareceu');
  assert.equal(aviso.getAttribute('role'), 'status', 'role=status: o leitor de tela anuncia a chegada');
  assert.equal(comAttr(aviso, 'data-desfazer')[0].getAttribute('data-desfazer'), 'l1a');
  // MUTOU na 2d-1 (30/10/2026): antes o aviso era PLACAS.concluida SOZINHO
  // (\"Concluída.\") e o teste garantia essa frase. Ela ainda está no texto — mas
  // agora o nome da estação que chegou e o contador também, porque \"Concluída.\"
  // sem dizer o quê é o gesto sem o resultado (JORNADA §2.5).
  const textoAviso = textoDe(aviso);
  assert.ok(textoAviso.includes('Matemática Discreta'), 'o aviso diz QUAL estação chegou, pelo nome');
  assert.ok(textoAviso.includes(comValores.viagem(1, 6)), 'e o quanto isso já é: 1 de 6 estações');
  assert.ok(!textoAviso.includes('destrancou'),
    'aqui l1a não abre nada (l2b precisa dela E de l1b): sem baldeação o aviso não fala de destravamento');
  assert.ok(textoAviso.includes(PLACAS.concluida), 'a palavra do núcleo continua no aviso');
  assert.equal(textoDe(aviso).includes(PLACAS.desfazer), true);
  assert.equal(timers.length, 1, 'o desfazer tem janela');
  assert.equal(timers[0].ms, 6000, '--janela-desfazer é 6000 ms no token, e o relógio usa o mesmo número');
});

// FEITO na fatia 2c-1 (30/10/2026): perdeu o `todo` neste commit. A causa dos
// "4 nós em vez de 2" era `root.textContent = ''`: no mini-DOM do teste é um
// setter que deixa os filhos pendurados, então o aviso velho sobrevivia ao
// redesenho. `limpar` agora desmonta os filhos de verdade, nos dois mundos.
test('chegada: depois da janela, o aviso some sozinho', async () => {
  const { api, root, timers } = await subirTela({ completed: [] });
  api.acoes.concluir('l1a');
  timers[0].fn();
  assert.equal(comClasse(root, 'aviso-chegada').length, 0, 'o aviso não fica para sempre');
  assert.equal(comClasse(root, 'desperta').length, 0, 'e o pulso também não');
  assert.equal(comAttr(root, 'data-id').length, 2, 'a linha continua desenhada');
  assert.equal(comClasse(root, 'trilho').filter((t) => t.className.includes('chegada')).length, 0,
    'e o trecho volta à cor fraca: chegada não fica pendurada no desenho');
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

// ═══════════════ 4b. FATIA 2d-1: o que o gesto abriu, e de onde veio ═══════
// A crítica do celular (30/10/2026), itens 1 e 2 da JORNADA:
//   §2.5 Avançar — quem conclui quer saber o que o gesto dela destrancou, e o
//     aviso dizia só \"Concluída.\";
//   §2.3 — \"desiste se o recurso abrir sem dizer de onde veio\": o botão abria o
//     YouTube no escuro. Nada inventado: a origem sai do resourceType e do
//     domínio do resourceUrl, e o que o catálogo não diz a tela não diz.
// Os dois catálogos abaixo usam os TIPOS e DOMÍNIOS QUE EXISTEM no catalog.json
// de verdade (external_course_or_playlist, www.youtube.com, pt.khanacademy.org),
// porque exemplo.org + 'video' não ensinam nada a ninguém.
const CAT_RECURSO = [
  { id: 'l1a', title: 'Matemática Discreta', stage: 1, prerequisites: [], resourceUrl: 'https://www.youtube.com/playlist?list=PLx', resourceType: 'external_course_or_playlist', bibliography: null },
  { id: 'l1b', title: 'Algoritmos I', stage: 1, prerequisites: [], resourceUrl: 'https://pt.khanacademy.org/computing', resourceType: 'external_course_or_playlist', bibliography: null },
  { id: 'l2a', title: 'Estrutura de Dados', stage: 2, prerequisites: ['l1b'], resourceUrl: 'https://www.cursoemvideo.com/matematica-discreta/', resourceType: 'external_course_or_playlist', bibliography: null },
  { id: 'l2b', title: 'Arquitetura de Computadores', stage: 2, prerequisites: ['l1a'], resourceUrl: null, resourceType: null, bibliography: null }
];

// O catálogo da baldeação de verdade: uma estação da Linha 1 que é pré-requisito
// de uma da Linha 2 JÁ CONCLUÍDA. Concluir a da Linha 1 é o que fecha o par — e
// o par é a definição de baldeação em core/viagem.js.
const CAT_BALDEACAO = [
  { id: 'a1', title: 'Matemática Discreta', stage: 1, prerequisites: [], resourceUrl: null, resourceType: null },
  { id: 'c1', title: 'Algoritmos I', stage: 1, prerequisites: ['a1'], resourceUrl: null, resourceType: null },
  { id: 'b2', title: 'Estrutura de Dados', stage: 2, prerequisites: ['a1'], resourceUrl: null, resourceType: null }
];

test('origem: o que o catálogo diz vira palavra, e o que ele não diz vira nada', () => {
  assert.equal(origemDoRecurso({ resourceType: 'external_course_or_playlist', resourceUrl: 'https://www.youtube.com/playlist?list=PLx' }),
    ORIGEM.cursoOuPlaylist('YouTube'), 'tipo + domínio conhecido: \"Curso ou playlist no YouTube\"');
  assert.equal(origemDoRecurso({ resourceType: 'external_course_or_playlist', resourceUrl: 'https://youtube.com/@abl' }),
    ORIGEM.cursoOuPlaylist('YouTube'), 'youtube.com e www.youtube.com são o mesmo lugar');
  assert.equal(origemDoRecurso({ resourceType: 'external_course_or_playlist', resourceUrl: 'https://pt.khanacademy.org/x' }),
    ORIGEM.cursoOuPlaylist('Khan Academy'));
  assert.equal(origemDoRecurso({ resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=1' }),
    ORIGEM.video('YouTube'), 'tipo que a fonte usa em outros registros');
  // O que NÃO está na fonte não pode virar afirmação da tela:
  assert.equal(origemDoRecurso({ resourceType: 'external_course_or_playlist', resourceUrl: 'https://exemplo.org/x' }),
    'Curso ou playlist', 'domínio que a fonte não usa: fica só o tipo, sem site');
  assert.equal(origemDoRecurso({ resourceType: null, resourceUrl: 'https://www.youtube.com/x' }),
    'YouTube', 'sem tipo: fica só o site');
  assert.equal(origemDoRecurso({ resourceType: null, resourceUrl: 'https://exemplo.org/x' }), null,
    'nada dito na fonte = nada na tela');
  assert.equal(origemDoRecurso(null), null);
  // O domínio nu sai da regra, e o texto final nunca é URL crua (lista do proibido):
  assert.equal(hostDoRecurso('https://www.youtube.com/playlist?list=PLx'), 'youtube.com');
  assert.equal(dominioLegivel('www.youtube.com'), 'YouTube');
  assert.equal(ORIGEM_DE_SITE.get('youtube.com'), 'YouTube');
  // A tabela tipo→palavra mora em textos.js com as outras palavras. Uma chave
  // que não caça em função nenhuma é origem que some da tela em silêncio.
  for (const [tipo, chave] of Object.entries(TIPO_DE_ORIGEM)) {
    assert.equal(typeof ORIGEM[chave], 'function', `TIPO_DE_ORIGEM.${tipo} → ${chave} não existe em ORIGEM`);
  }
  assert.equal(TIPO_DE_ORIGEM.external_course_or_playlist, 'cursoOuPlaylist',
    'o tipo que a fonte publica (35 registros) tem palavra');
});


test('placa: a ação da próxima estação também diz de onde veio, com a MESMA palavra', () => {
  const { root } = desenhar({ completed: [], catalogo: CAT_RECURSO });
  const acao = comClasse(root, 'placa-acao')[0];
  assert.equal(acao.getAttribute('href'), 'https://www.youtube.com/playlist?list=PLx');
  const origem = comClasse(root, 'placa-origem')[0];
  assert.equal(origem.textContent, ORIGEM.cursoOuPlaylist('YouTube'));
  assert.equal(comAttr(root, 'data-acao-placa').length, 1, 'UMA ação só na placa, continua');
  // A Khan Academy da l1b tem de sair com outro site — se a tela fixasse
  // \"YouTube\" num lugar só, o teste acima passaria mentindo.
  const outra = desenhar({ completed: ['l1a'], catalogo: CAT_RECURSO });
  assert.equal(comClasse(outra.root, 'placa-origem')[0].textContent, ORIGEM.cursoOuPlaylist('Khan Academy'));
});

test('origem: a folha da estação do catálogo REAL tem origem (não é só o dublê)', () => {
  // catalog.json só publica external_course_or_playlist; se o metro.js depender
  // de um tipo que a fonte nunca escreve, a tela fica muda no site publicado.
  const real = JSON.parse(readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8'));
  const courses = real.courses || real;
  const comRecurso = courses.filter((c) => c.resourceUrl).slice(0, 5);
  assert.ok(comRecurso.length > 0, 'o catálogo tem recurso');
  for (const c of comRecurso) {
    assert.equal(origemDoRecurso(c), ORIGEM.cursoOuPlaylist('YouTube'),
      `${c.id}: ${c.resourceType} + ${c.resourceUrl} tem de virar palavra`);
  }
});

// MUTOU na fatia 2d-2 (30/10/2026), e a mutação tem motivo: em 2d-1 este teste
// garantia que a linha NÃO era nomeada ("sem baldeação não se nomeia linha").
// A JORNADA §2.5 pede o contrário no momento da abertura — quando a estação que
// abriu está em OUTRA linha, isso É uma baldeação e a tela tem de dizer a linha
// de destino. l2a (Estrutura de Dados) está na Linha 2: agora o aviso nomeia a
// baldeação com a linha. O resto do teste continua firme, nada afrouxado.
test('chegada: o aviso diz o que a estação abriu, pelo nome (e a linha, se for outra)', async () => {
  const { api, root } = await subirTela({ completed: [] });
  api.acoes.concluir('l1b'); // abre l2a (Estrutura de Dados), na Linha 2
  const aviso = textoDe(comClasse(root, 'aviso-chegada')[0]);
  assert.ok(aviso.includes(PLACAS.concluida), 'a palavra do núcleo continua');
  assert.ok(aviso.includes('Algoritmos I'), 'a estação que chegou, pelo nome');
  assert.ok(aviso.includes(comValores.baldeacao('Estrutura de Dados', 2)),
    `o que abriu em outra linha é baldeação nomeada, com a linha de destino: «${aviso}»`);
  assert.ok(aviso.includes(comValores.viagem(1, 6)), 'e o contador');
  assert.ok(!aviso.includes('l2a'), 'nunca pelo id');
});

test('chegada: quando a estação abre o caminho por BALDEAÇÃO, o aviso nomeia a baldeação e a linha de destino', async () => {
  const { api, root } = await subirTela({ completed: ['b2'], catalogo: CAT_BALDEACAO });
  api.acoes.concluir('a1');
  const aviso = textoDe(comClasse(root, 'aviso-chegada')[0]);
  assert.ok(aviso.includes('Matemática Discreta'), 'a estação que chegou');
  assert.ok(aviso.includes(comValores.destrancou('Algoritmos I')), 'o que ela abriu na própria linha');
  assert.ok(aviso.includes(comValores.baldeacao('Estrutura de Dados', 2)),
    `a baldeação com a estação de outra linha, com a linha de destino: «${aviso}»`);
  assert.ok(aviso.includes(comValores.viagem(2, 3)), 'e o contador');
});

test('chegada: quem decide o que abriu é o núcleo — a tela não reimplementa pré-requisito', () => {
  const progresso = { completed: ['b2'], emCurso: [], conclusoes: {} };
  const p = concluirEstacao(progresso, 'a1', '2026-10-30', CAT_BALDEACAO);
  const abre = abreComBaldeacao(progresso, p, CAT_BALDEACAO);
  assert.deepEqual(abre.destravadas.map((c) => c.id), ['c1'], 'quem destrava agora');
  assert.equal(abre.baldeacao.para.id, 'b2', 'e o par de baldeação que se formou');
  assert.equal(abre.destravadas.length, 1, 'uma estação abriu, não duas');
  // Nada de novo antes do gesto: o núcleo compara antes e depois.
  const igual = abreComBaldeacao(progresso, progresso, CAT_BALDEACAO);
  assert.deepEqual(igual.destravadas, [], 'concluir o que já estava concluído não abre nada');
  assert.equal(igual.baldeacao, null);
  const fonte = readFileSync(fileURLToPath(new URL('../web/metro.js', import.meta.url)), 'utf8');
  assert.match(fonte, /import \{[\s\S]*abreComBaldeacao[\s\S]*\} from '\.\.\/core\/viagem\.js'/,
    'a tela chama a porta do núcleo');
  assert.ok(!fonte.includes('unlockedCourses('),
    'a tela não calcula destravamento sozinha: duas regras de pré-requisito é a receita para placa e aviso discordarem');
});

test('aviso: o texto é montado por uma função, com as palavras do núcleo', () => {
  const t = (extra) => textoDaChegada({
    titulo: 'Matemática Discreta', concluidas: 2, total: 6, ...extra
  });
  assert.equal(t({}), 'Concluída. Matemática Discreta · 2 de 6 estações');
  assert.equal(t({ abre: [{ id: 'c1', titulo: 'Algoritmos I', linha: 1 }] }),
    'Concluída. Matemática Discreta · destrancou Algoritmos I · 2 de 6 estações');
  assert.equal(t({
    abre: [{ id: 'c1', titulo: 'Algoritmos I', linha: 1 }],
    baldeacao: { para: { titulo: 'Estrutura de Dados', linha: 2 } }
  }), 'Concluída. Matemática Discreta · destrancou Algoritmos I · baldeação com Estrutura de Dados (Linha 2) · 2 de 6 estações');
  const todas = t({ abre: [{ titulo: 'A' }, { titulo: 'B' }] });
  assert.ok(todas.includes('A, B'), 'abriu mais de uma: nomeia todas, como a folha faz com o que falta');
});

test('contrato: com o main.js REAL o aviso nomeia a estação e a folha diz a origem', async () => {
  const gravado = new Map();
  const aparelho = {
    getItem: (k) => (gravado.has(String(k)) ? gravado.get(String(k)) : null),
    setItem: (k, v) => { gravado.set(String(k), String(v)); },
    removeItem: (k) => { gravado.delete(String(k)); }
  };
  globalThis.localStorage = aparelho;
  try {
    const modulos = { ...mainReal, loadCatalog: async () => ({ courses: CAT_RECURSO, origem: 'teste' }) };
    const doc = criarDoc();
    const root = raiz(doc);
    const api = await subirMetro({
      document: doc, root, storage: criarStorage(), modulos,
      setTimeout: () => ({}), hoje: '2026-10-30'
    });
    assert.equal(comClasse(root, 'placa-origem')[0].textContent, ORIGEM.cursoOuPlaylist('YouTube'),
      'a placa sobe com a origem, com o main.js de verdade');
    api.acoes.concluir('l1a');
    const aviso = textoDe(comClasse(root, 'aviso-chegada')[0]);
    assert.ok(aviso.includes('Matemática Discreta'), `o aviso chegou inteiro: «${aviso}»`);
    assert.ok(aviso.includes(comValores.viagem(1, 4)), 'e o contador bate com o catálogo');
  } finally {
    delete globalThis.localStorage;
  }
});

// ═══════════════════════════ 4b. FATIA 2d-2 ═══════════════════════════
// A crítica visual no celular (30/10) achou duas mentiras de estado na folha:
// a trancada oferecia "Começar a estudar" como se estivesse aberta, e a
// concluída oferecia o mesmo verbo como se nada tivesse acontecido. E um
// primário por folha: dois botões vermelhos cheios um sobre o outro são duas
// decisões para a mesma pessoa.

test('chegada: abrir estação de OUTRA linha nomeia a baldeação e a linha de destino (catálogo REAL)', async () => {
  // O caso que o Claude viu na tela: Geometria Analítica (Linha 1) não abre
  // nada na própria linha — abre Cálculo I e Álgebra Linear I (Linha 2) e
  // Fundamentos de Computação Gráfica (Linha 5). No dublê de 6 estações isso
  // não existe, e o defeito passou por ele.
  const real = JSON.parse(readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8'));
  const courses = real.courses || real;
  const ga = courses.find((c) => c.title === 'Geometria Analítica');
  assert.ok(ga, 'o catálogo tem Geometria Analítica');
  const { api, root } = await subirTela({ completed: [], catalogo: courses });
  api.acoes.concluir(ga.id);
  const aviso = textoDe(comClasse(root, 'aviso-chegada')[0]);
  assert.ok(aviso.includes(comValores.baldeacao('Cálculo I, Álgebra Linear I', 2)),
    `as duas estações da Linha 2 saem juntas, com a linha de destino: «${aviso}»`);
  assert.ok(aviso.includes(comValores.baldeacao('Fundamentos de Computação Gráfica', 5)),
    `e a da Linha 5 sai na sua: «${aviso}»`);
  assert.ok(!aviso.includes('destrancou'),
    'nada abriu na própria linha: o aviso não inventa um destrancou vazio');
  assert.ok(!/ubl-core-/.test(aviso), 'nem uma estação pelo id');
});

test('aviso: o que abriu na MESMA linha segue pelo nome, sem linha', () => {
  const mesmo = textoDaChegada({
    titulo: 'Matemática Discreta', concluidas: 2, total: 6, linha: 1,
    abre: [{ id: 'c1', titulo: 'Algoritmos I', linha: 1 }]
  });
  assert.ok(mesmo.includes(comValores.destrancou('Algoritmos I')), `mesma linha: nome só: «${mesmo}»`);
  assert.ok(!mesmo.includes('Linha'), 'e nenhuma linha nomeada');
  // Estação sem linha no catálogo não vira "Linha null".
  const semLinha = textoDaChegada({
    titulo: 'Matemática Discreta', concluidas: 2, total: 6, linha: 1,
    abre: [{ id: 'x', titulo: 'Ramal', linha: null }]
  });
  assert.ok(semLinha.includes(comValores.destrancou('Ramal')), 'sem linha conhecida: pelo nome');
  // A baldeação que SE FORMOU (par concluído, §3.2) não é escrita duas vezes.
  const par = textoDaChegada({
    titulo: 'Matemática Discreta', concluidas: 2, total: 6, linha: 1,
    abre: [{ id: 'b2', titulo: 'Estrutura de Dados', linha: 2 }],
    baldeacao: { para: { id: 'b2', titulo: 'Estrutura de Dados', linha: 2 } }
  });
  assert.equal(par.split('Estrutura de Dados').length - 1, 1, `nomeada uma vez só: «${par}»`);
});



// ═══════════════════════════ 5. os dois estados ═══════════════════════════
// FEITO na fatia 2c-3 (30/10/2026): perdeu o `todo` neste commit. O atraso é
// `var(--atraso-esqueleto)` no CSS (o JS não tem relógio nenhum para a espera) e
// a palavra "shimmer" saiu até do comentário — o teste lê o arquivo inteiro.
test('esqueleto: parado, sem brilho correndo, e o atraso mora no CSS', () => {
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

// FEITO na fatia 2c-3 (30/10/2026): perdeu o `todo` neste commit. `subirMetro`
// pinta o esqueleto SYNCHRONOUS antes do primeiro `await` do loadCatalog: quem
// chega primeiro é a espera, nunca uma placa pela metade.
test('esqueleto: a tela carregando não mostra placa nenhuma', async () => {
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

// S20a (04/11/2026): o quadro «Bem-vindo ao embarque» saiu de cena — o topo novo
// (J1) faz o papel dele. A trava continua no mesmo lugar de espírito (a primeira
// visita convida, sem empilhar um botão por estação), mas cobra a tela de agora.
test('embarque: a primeira visita convida a marcar, e a lista só existe aberta', async () => {
  const { root } = desenhar({ completed: [] });
  const convite = comAttr(root, 'data-embarque')[0];
  assert.ok(convite, 'sumiu o convite de quem já estudou alguma disciplina');
  assert.equal(convite.textContent, J.topo.marcar,
    'o convite do topo não usa a frase da casa');
  assert.equal(convite.getAttribute('aria-expanded'), 'false', 'a lista começa fechada');
  assert.equal(comAttr(root, 'data-marcar').length, 0,
    'a primeira visita empilha um botão por estação na cara de quem acabou de chegar');
  assert.equal(comClasse(root, 'embarque-titulo').length, 0,
    'o quadro «Bem-vindo ao embarque» voltou: o topo (S20a) já faz o papel dele');

  const { root: aberta } = desenhar({ completed: [], embarqueAberto: true });
  assert.ok(comAttr(aberta, 'data-marcar').length > 0, 'aberto, o fluxo não lista nada para marcar');
});

// FEITO na fatia 2c-2 (30/10/2026): perdeu o `todo` neste commit. Marcável é a
// PRIMEIRA estação ainda não concluída de cada linha, e pré-requisito não trava
// a lista: o embarque é a palavra da pessoa sobre o que ela já estudou, e é o
// núcleo quem reajusta a rede depois. Trancar a lista seria obrigar um clique
// por disciplina — o terceiro clique em que o perfil B vai embora (JORNADA §2.2).
test('embarque: aberto, lista as estações que dá para marcar de uma vez', () => {
  const { root } = desenhar({ completed: ['l1a'], linha: 1, embarqueAberto: true });
  const emb = comClasse(root, 'embarque')[0];
  const marcar = comAttr(emb, 'data-marcar');
  // destrancadas e não concluídas: l1b, l2a, l3a (l2b e l3b ainda trancadas)
  assert.deepEqual(marcar.map((b) => b.getAttribute('data-marcar')).sort(), ['l1b', 'l2a', 'l3a']);
  for (const b of marcar) assert.equal(b.textContent, PLACAS.marcar);
});

// FEITO na fatia 2c-2 (30/10/2026): perdeu o `todo` neste commit. `marcar` é
// acoes.concluir pela porta do embarque — nunca uma segunda regra de conclusão
// na tela — e a lista sai de cena com a primeira conclusão.
test('embarque: marcar uma estação conclui pelo verbo do núcleo', async () => {
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

// FEITO na fatia 2c-3 (30/10/2026): perdeu o `todo` neste commit. `Number(null)`
// é 0 e 0 é finito — sem linha o rótulo dizia "Linha 0", um nome que não existe
// em lugar nenhum do catálogo. Agora a parte da linha sai da frase.
test('rótulo: os 4 estados têm palavra legível, e a linha entra quando existe', () => {
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

// FEITO na fatia 2c-3 (30/10/2026): perdeu o `todo` neste commit. O campo mora
// SÓ na folha aberta: com ele desenhado nas 35 folhas fechadas, o leitor de tela
// lia "Anotação" em fila — e hidden não tira ninguém da fila.

// FEITO na fatia 2c-3 (30/10/2026): perdeu o `todo` neste commit. `anotar` agora
// Devolve o texto para o catálogo (comNotas), e é de lá que a folha desenhada lê
// o campo — antes, salvar no storage sem atualizar ui.catalogo gravava e apagava
// ao mesmo tempo.
//
// O corpo foi corrigido junto, e a correção é a regra da casa (afrouxar não): o
// original chamava `abrirEstacao` duas vezes contando que a segunda reabria, mas
// abrir é um TOGGLE — a segunda chamada FECHAVA a folha, e com o campo morando
// só na folha aberta ele não existia mais (TypeError em vez de assert). Agora o
// teste fecha e reabre de verdade, e a metade "o input salva" é medida pelo
// evento `input` que o dedo produz, não pela ação chamada à mão.

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

// ═══════════════════ 7. O CONTRATO com o main.js de verdade ═══════════════════
// Por que isto existe: o metro.js pedia `applyNote` ao main.js e chamava
// `saveNotas(storage, notas)`. Nenhum dos dois nomes/assinaturas existe lá — no
// navegador dava "applyNote is not a function" a cada tecla e a anotação sumia no
// redesenho, enquanto o metrô ficava verde porque o dublê tinha os nomes que o
// metro.js inventou. Teste que mede o dublê não mede a tela. Estes três testes
// medem as duas pontas: a lista que o metro.js pede, as funções que o main.js
// exporta, e uma subida da tela com o main.js REAL.
const fonteMetro = readFileSync(fileURLToPath(new URL('../web/metro.js', import.meta.url)), 'utf8');

/** Nomes que o metro.js tira de `deps.modulos || await import('./main.js')`. */
function nomesPedidosPeloMetro() {
  const m = semComentarios(fonteMetro).match(/const \{([^}]*)\}[\s\S]{0,80}?deps\.modulos \|\| await import\('\.\/main\.js'\)/);
  assert.ok(m, 'a desestruturação do main.js mudou de forma — atualize este teste e o contrato junto');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/** Argumentos de uma chamada `nome(...)` na fonte do metro.js, no nível de fora. */
/** Tira comentários da fonte: o contrato é sobre código, não sobre prosa. */
function semComentarios(texto) {
  let saida = '', i = 0, cite = null;
  while (i < texto.length) {
    const c = texto[i], d = texto[i + 1];
    if (cite) {
      if (c === '\\') { saida += c + (d ?? ''); i += 2; continue; }
      if (c === cite) { cite = null; }
      saida += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { cite = c; saida += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < texto.length && texto[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i++; i += 2; continue; }
    saida += c; i++;
  }
  return saida;
}

function argumentosNaFonte(nome) {
  const re = new RegExp('\\b' + nome + '\\(((?:[^()]|\\([^()]*\\))*)\\)', 'g');
  const achados = [];
  let m;
  while ((m = re.exec(semComentarios(fonteMetro)))) {
    const dentro = m[1].trim();
    if (!dentro) { achados.push(0); continue; }
    let nivel = 0, atual = '', partes = 0;
    for (const c of dentro) {
      if (c === '(' || c === '[' || c === '{') nivel++;
      else if (c === ')' || c === ']' || c === '}') nivel--;
      if (c === ',' && nivel === 0) { partes++; atual = ''; continue; }
      atual += c;
    }
    achados.push(partes + 1);
  }
  return achados;
}

/** Quantos parâmetros a função real declara — incluindo os que têm valor padrão. */
function parametrosReais(fn) {
  const src = Function.prototype.toString.call(fn);
  const abre = src.indexOf('(');
  if (abre < 0) return 0;
  let nivel = 0, partes = 1, viuAlgum = false;
  for (let i = abre + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { nivel++; }
    else if (c === ')' || c === ']' || c === '}') { if (nivel === 0) break; nivel--; }
    if (nivel === 0 && c === ',') { partes++; continue; }
    if (nivel === 0 && !/\s/.test(c)) viuAlgum = true;
  }
  return viuAlgum ? partes : 0;
}

test('contrato: todo nome que o metro.js tira do main.js existe como export real', () => {
  const pedidos = nomesPedidosPeloMetro();
  assert.ok(pedidos.length >= 5, 'o contrato é a desestruturação inteira, não uma amostra');
  for (const nome of pedidos) {
    assert.equal(typeof mainReal[nome], 'function',
      `main.js não exporta "${nome}" — é exatamente o "applyNote is not a function" da fatia 2c-3`);
  }
});

test('contrato: o metro.js chama cada função com os parâmetros que o main.js declara', () => {
  for (const nome of nomesPedidosPeloMetro()) {
    const reais = parametrosReais(mainReal[nome]);
    const chamadas = argumentosNaFonte(nome);
    assert.ok(chamadas.length > 0, `o metro.js nunca chama ${nome}? retire da desestruturação`);
    for (const dados of chamadas) {
      assert.equal(dados, reais,
        `${nome}: o metro.js chama com ${dados} e o main.js declara ${reais} — saveNotas(storage, notas) foi assim que quebrou`);
    }
  }
});

test('contrato: o dublê do teste tem as MESMAS assinaturas do main.js real', () => {
  const fake = modulosFake();
  for (const nome of nomesPedidosPeloMetro()) {
    assert.equal(typeof fake[nome], 'function', `o dublê não tem ${nome}`);
    assert.equal(parametrosReais(fake[nome]), parametrosReais(mainReal[nome]),
      `${nome}: dublê com assinatura diferente é o teste medindo outra tela`);
  }
});

test('contrato: a tela sobe com o main.js REAL, anota, e o texto volta depois do redesenho', async () => {
  const gravado = new Map();
  const aparelho = {
    getItem: (k) => (gravado.has(String(k)) ? gravado.get(String(k)) : null),
    setItem: (k, v) => { gravado.set(String(k), String(v)); },
    removeItem: (k) => { gravado.delete(String(k)); }
  };
  globalThis.localStorage = aparelho;
  try {
    // main.js REAL em tudo que toca o aparelho: aplicarNota, loadNotas, saveNotas,
    // loadCompleted, saveCompleted. Só loadCatalog é o dublê — no node não há
    // fetch de data/catalog.json, e o que se prova aqui é a anotação, não o dado.
    const modulos = { ...mainReal, loadCatalog: async () => ({ courses: CATALOGO, origem: 'teste' }) };
    const doc = criarDoc();
    const root = raiz(doc);
    const aparelho = { hash: '' }; // o `location` do casco, em node
    const api = await subirMetro({
      document: doc, root, storage: criarStorage(), modulos,
      setTimeout: () => ({}), hoje: '2026-10-29', window: { location: aparelho }
    });
    // S5 parte 2: abrir passou a ser IR A uma rota, e quem faz o gesto é o
    // navegador — o cartão já é <a href="#/estacao/...">. Em node não há
    // navegador, então este ajudante É o casco: escreve o hash que o clique
    // escreveria e entrega à tela o slug que ele lê. `abrirEstacao` sumiu, e
    // duas rotas para a mesma tela seria a regra do aria-pressed.
    const irAEstacao = (tela) => {
      aparelho.hash = '#/estacao/l1a';
      tela.ui.folha = 'l1a';
      tela.pintar();
    };
    irAEstacao(api);
    const area = comClasse(root, 'anotacao')[0];
    assert.ok(area, 'a folha aberta desenha o campo');
    area.value = 'faz até o 9';
    disparar(root, 'input', area);

    assert.ok([...gravado.keys()].some((k) => k.includes('anotacoes')),
      'escrever grava no aparelho PELA MÃO DO main.js, com a chave dele');
    api.acoes.fechar();
    assert.equal(aparelho.hash, '#/', 'fechar NAVEGA para #/: apagar um estado interno deixaria o voltar do navegador sem nada a fazer');
    api.ui.folha = null;
    api.pintar();
    assert.equal(comClasse(root, 'anotacao').length, 0, 'sem rota, nenhum campo na fila do leitor de tela');
    irAEstacao(api); // reabre
    assert.equal(comClasse(root, 'anotacao')[0].value, 'faz até o 9',
      'o texto volta no campo — era aqui que ele sumia');

    // Sobreviver ao redesenho não basta: a prova é uma tela NOVA lendo o aparelho.
    const doc2 = criarDoc();
    const root2 = raiz(doc2);
    const segunda = await subirMetro({
      document: doc2, root: root2, storage: criarStorage(), modulos,
      setTimeout: () => ({}), hoje: '2026-10-30', window: { location: aparelho }
    });
    irAEstacao(segunda);
    assert.equal(comClasse(root2, 'anotacao')[0].value, 'faz até o 9',
      'fechar o navegador e voltar não apaga a anotação');

    // E a regra do núcleo vale na tela: texto vazio APAGA, não deixa chave órfã.
    const campo = comClasse(root2, 'anotacao')[0];
    campo.value = '';
    disparar(root2, 'input', campo);
    assert.equal(JSON.stringify(gravado.get('atlas.anotacoes.v1')).includes('l1a'), false,
      'apagar o texto apaga a chave — é o setNota do core/notes.js, não um dicionário à mão');
  } finally {
    delete globalThis.localStorage;
  }
});

// ══════════════════════ ATLAS v2, FATIA S2 (31/10/2026) ══════════════════════
// Dois defeitos que o juiz viu na tela PUBLICADA: o seletor das 7 linhas era
// `<span type="button">` — uma coisa que parece botão, tem atributo de botão e
// NÃO É botão: o Tab passa por cima, o Enter não faz nada, e o leitor de tela
// não anuncia. E o nome "Atlas" aparecia duas vezes na mesma tela.

test('seletor: as 7 linhas são <button type="button">, com aria-pressed na atual', () => {
  // Sete linhas de verdade, uma por linha: o catálogo de teste tem só 3, e o
  // defeito descrito é da faixa inteira.
  const sete = [];
  for (let n = 1; n <= 7; n++) {
    sete.push({ id: `l${n}a`, title: `Estação da linha ${n}`, stage: n, prerequisites: [],
      resourceUrl: null, resourceType: null, bibliography: null });
  }
  const { root } = desenhar({ catalogo: sete, linha: 4 });
  // O mini-DOM guarda a tag como foi escrita ('button'); o navegador devolve
  // 'BUTTON'. Comparar em caixa alta vale nos dois.
  const tag = (no) => String(no.tag).toUpperCase();
  const nav = todos(root, (no) => tag(no) === 'NAV' && no.className.split(/\s+/).includes('linhas'))[0];
  assert.ok(nav, 'o seletor é um <nav> (ainda é)');
  const botoes = nav.children.filter((c) => tag(c) === 'BUTTON');
  assert.equal(botoes.length, 7, `7 linhas desenhadas como BUTTON; vieram ${botoes.length} de tag ${nav.children.map(tag).join(',')}`);
  assert.equal(nav.children.every((c) => tag(c) === 'BUTTON'), true, 'nada no seletor é span: span com type=button é o defeito que a S2 matou');
  for (const b of nav.children) {
    assert.equal(b.getAttribute('type'), 'button', 'type="button" dentro de um form não seria um botão de linha');
    assert.equal(b.getAttribute('data-linha'), b.className.match(/l(\d)/)[1], 'o selo sabe a linha que é');
  }
  const pressionados = nav.children.filter((b) => b.getAttribute('aria-pressed') === 'true');
  assert.equal(pressionados.length, 1, 'uma linha pressionada, não duas');
  assert.equal(pressionados[0].getAttribute('data-linha'), '4');
  assert.equal(nav.children.filter((b) => b.getAttribute('aria-pressed') === 'false').length, 6,
    'as outras 6 dizem aria-pressed=false: sem isso o leitor de tela não sabe que são alternáveis');
  assert.equal(nav.children.some((b) => b.getAttribute('aria-current') !== null), false,
    'aria-current saiu: é estado de botão, não posição num caminho de navegação');
});

test('seletor: o botão de linha obedece ao teclado (Enter e Espaço vêm de graça)', () => {
  // Não se testa o navegador: se testa que QUEM CLICA é o botão, e que a
  // delegação continua alcançando o alvo. Com <button>, Enter e Espaço geram
  // o mesmo evento click que o toque gera — é o que o span não fazia.
  const doc = criarDoc();
  const root = raiz(doc);
  desenharMetro(doc, root, { catalogo: CATALOGO, progresso: { completed: [], emCurso: [], conclusoes: {} }, linha: 1 });
  let linhaPedida = null;
  bindMetro(doc, root, { abrirLinha: (n) => { linhaPedida = n; } });
  const selos = comClasse(root, 'selo').filter((s) => s.getAttribute('data-linha'));
  assert.equal(String(selos[0].tag).toUpperCase(), 'BUTTON',
    'o selo da linha é BUTTON (tagName de verdade, em maiúsculo): span com type=button é o defeito que a S2 matou');
  disparar(root, 'click', selos[0]);
  assert.equal(linhaPedida, 1, 'o clique no botão troca a linha');
});

test('marca: a tela não desenha o nome "Atlas" (o logo do topo já diz)', () => {
  const { root } = desenhar({ completed: [] });
  assert.equal(todos(root, (no) => no.className.split(/\s+/).includes('marca-nome')).length, 0,
    'marca-nome voltou: duas faixas de cabeçalho seguidas');
  const marca = root.children[0];
  // O alvo é a FAIXA da marca, não a tela inteira: a palavra "Atlas" continua
  // legítima na nota da bibliografia (textos.js), e varrer o <main> inteiro
  // proibiria uma frase que o item 7 não proíbe. O que morreu é o nome como
  // apresentação, desenhado debaixo do logo do topo.
  assert.equal(textoDe(marca).includes(PLACAS.titulo), false,
    `o nome "${PLACAS.titulo}" voltou à faixa da marca: ele já está no logo do topo`);
  assert.equal(marca.tag, 'div', 'div, não header: o cabeçalho do app é o do HTML');
  assert.equal(comClasse(marca, 'marca-linha')[0].textContent, PLACAS.marcaLinha,
    'a linha do curso fica: é ela que rotula a tela');
});

// ════════════════════ S4a: as três peças da Jornada ════════════════════
//
// JORNADA 1.1: em 10 segundos a pessoa lê o que é isto, onde ela está e qual é
// o próximo passo. São três peças novas, e o que pesa é o que elas NÃO podem
// ter: régua de jogo (XP, sequência, pontos), número inventado, e o parágrafo
// da abertura na primeira visita — quando a viagem ainda não começou, falar de
// "35 estações em 7 linhas" para quem vai marcar o que já estudou é a tela
// falando de si mesma.
test('jornada: o número do catálogo é lido, nunca escrito', () => {
  // Quem já tem um carimbo lê a descrição da grade — e os dois números dela vêm
  // do catálogo passado ao desenhar, não de um literal escrito no metro.js. Por
  // isso o catálogo de teste é 6×3: se a tela tivesse 35 e 7 no código, a frase
  // não apareceria aqui e o teste pegaria.
  const { root } = desenhar({ completed: ['l1a'], catalogo: CATALOGO });
  const texto = textoDe(root);
  const estacoes = CATALOGO.length;
  const linhas = new Set(CATALOGO.map((c) => c.stage)).size;
  assert.ok(estacoes !== 35 && linhas !== 7,
    'o catálogo de teste virou 35×7: a frase leria um literal e passaria por prova');
  // S20a: a medida da rede saiu do parágrafo da grade e virou a linha do TOPO.
  // O número continua vindo do catálogo passado ao desenhar — e sem o
  // indice.json (o caso do dublê, que não serve a rede de aulas) a frase é a
  // que só diz as disciplinas: um total de aulas inventado ali seria a tela
  // mentindo sobre o tamanho do compromisso.
  assert.ok(texto.includes(`${estacoes} disciplinas`),
    `o topo não leu o catálogo (esperava «${estacoes} disciplinas», e o texto diz: ${texto.slice(0, 200)})`);

  // O denominador é o total do catálogo, nunca o 35 da grade publicado.
  assert.equal(texto.includes(`/${35}`), false,
    'a viagem divide por 35 escrito à mão, não pelo catálogo');

  // Primeira visita: a vitrine cede o lugar à porta — quem ainda não tem nada
  // concluído vê o embarque, não uma contagem de estações.
  // Primeira visita: o parágrafo que descrevia a grade para quem ainda não tem
  // nada deu lugar ao primeiro passo. A medida de uma linha não é a grade lida em
  // voz alta, e a `abertura-texto` de S4a não volta a aparecer por cima do topo.
  const vazio = desenhar({ completed: [], catalogo: CATALOGO });
  assert.equal(comClasse(vazio.root, 'abertura-texto').length, 0,
    'a abertura de S4a voltou a falar da grade por cima do topo novo');
  assert.ok(comClasse(vazio.root, 'topo-acao').length > 0,
    'na primeira visita o topo não oferece o primeiro passo');
});

test('jornada: nenhum XP nem sequência na tela', () => {
  const re = /\bXP\b|sequ[êe]ncia|streak|ranking|pontos/i;
  const achados = [];
  const ver = (onde, v) => { if (typeof v === 'string' && re.test(v)) achados.push(`${onde}: "${v}"`); };
  const percorrer = (obj, prefixo) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const nome = `${prefixo}.${k}`;
      if (typeof v === 'string') ver(nome, v);
      else if (Array.isArray(v)) v.forEach((item, i) => {
        if (typeof item === 'string') ver(`${nome}[${i}]`, item);
        else percorrer(item, `${nome}[${i}]`);
      });
      else if (v && typeof v === 'object') {
        for (const [kk, vv] of Object.entries(v)) {
          if (typeof vv === 'function') ver(`${nome}.${kk}`, vv('1'));
          else percorrer({ [kk]: vv }, nome);
        }
      }
    }
  };
  percorrer(TEXTOS_ESTADOS, 'estados');
  // Os textos da Jornada, lidos com valores reais (função também é frase).
  ver('jornada.abertura.rotulo', J.abertura.rotulo);
  ver('jornada.abertura.titulo', J.abertura.titulo);
  ver('jornada.abertura.tituloFim', J.abertura.tituloFim);
  ver('jornada.abertura.paragrafo', J.abertura.paragrafo(35, 7));
  ver('jornada.abertura.primeiraVisita', J.abertura.primeiraVisita);
  for (const [k, v] of Object.entries(J.numeros)) ver(`jornada.numeros.${k}`, typeof v === 'function' ? v(1, 35) : v);
  ver('jornada.conexao.rotulo', J.conexao.rotulo);
  ver('jornada.conexao.abre', J.conexao.abre('Alfa', 'Beta'));
  ver('jornada.conexao.fecha', J.conexao.fecha(1));
  assert.deepEqual(achados, [], 'régua de jogo na tela (JORNADA §1: os três números saem do que a pessoa fez)');

  // A prova de que o percorrer enxerga de verdade: duas armadilhas plantadas,
  // uma em string direta e uma dentro de array. Sem isso, "achados vazio" podia
  // ser só uma varredura que não varre nada — o pior tipo de verde.
  percorrer({ armadilha: { grito: 'você ganhou 240 XP', lista: ['streak de 3 dias'] } }, 'planta');
  assert.equal(achados.length, 2,
    `o percorrer não achou as duas armadilhas plantadas (achou ${achados.length}): ${JSON.stringify(achados)}`);
});

test('jornada: o h1 é o primeiro título e usa o tamanho da estação', () => {
  const { root } = desenhar({ completed: [] });
  // Documento, não filho direto da raiz: o h1 mora dentro da <section> da
  // abertura, e um indexOf em root.children daria -1 dos dois lados — verde que
  // não prova nada. O que a fatia pede é ordem de leitura: o PRIMEIRO título.
  const titulos = todos(root, (no) => no.tag === 'h1' || no.tag === 'h2');
  assert.equal(titulos.length > 0, true, 'a Jornada desenhada não tem título nenhum');
  assert.equal(titulos[0].tag, 'h1', `o primeiro título é um <${titulos[0].tag}>`);
  assert.equal(titulos[0].className.split(/\s+/).includes('topo-titulo'), true,
    `o primeiro título tem a classe "${titulos[0].className}": o topo não abre a tela`);
  assert.equal(porTag(root, 'h1').length, 1, 'a tela tem mais de um <h1>');

  // O CSS é a fonte da forma: --tipo-estacao é o MAIOR tamanho da escala.
  const css = readFileSync(fileURLToPath(new URL('../web/telas/jornada.css', import.meta.url)), 'utf8');
  const bloco = css.split('}').find((b) => b.includes('.topo-titulo'));
  assert.ok(bloco, 'jornada.css não declara .topo-titulo');
  assert.ok(bloco.includes('font-size: var(--tipo-estacao)'),
    'o título do topo não usa o tamanho da estação — é a placa competindo com ele');
});

test('jornada: na primeira visita, o topo dá o primeiro passo e o convite de marcar', () => {
  const vazio = desenhar({ completed: [], catalogo: CAT_RECURSO });
  const textoVazio = textoDe(vazio.root);
  // S20a: a frase da abertura cedeu o lugar ao TOPO — o primeiro passo (J1) e o
  // convite discreto de marcar, que abre a mesma lista de antes.
  assert.ok(textoVazio.includes(J.topo.comecar),
    'na viagem vazia o topo não dá o primeiro passo');
  assert.ok(textoVazio.includes(J.topo.marcar),
    'na viagem vazia o topo não convida quem já estudou');
  assert.ok(comAttr(vazio.root, 'data-embarque').length > 0,
    'sumiu o gancho que abre a lista de marcar');

  // Uma concluída: a frase volta a ser a da grade, e o embarque continua só
  // enquanto a lista estiver aberta — não para sempre.
  const depois = desenhar({ completed: ['l1a'], catalogo: CATALOGO });
  assert.equal(textoDe(depois.root).includes(J.abertura.primeiraVisita), false,
    'a frase de primeira visita ficou pendurada em quem já tem uma estação');
  assert.ok(textoDe(depois.root).includes(`${CATALOGO.length} estações`),
    'com uma concluída a tela não voltou a descrever a grade');

  // Terminal: tudo carimbado no catálogo REAL. Os números e a conexão saem; vale
  // o texto do terminal, que a placa já desenha. `readFileSync` já é importado
  // no topo — um `await` dentro de test() não-async é SyntaxError e derruba o
  // arquivo inteiro, que é exatamente o que aconteceu aqui.
  const real = JSON.parse(readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8')).courses;
  const ids = real.map((c) => c.id);
  assert.equal(ids.length, 35, `o catálogo real mudou de tamanho (${ids.length}): o caso Terminal precisa de revisão`);
  const terminal = desenhar({
    completed: ids,
    conclusoes: Object.fromEntries(ids.map((id) => [id, '2026-10-30'])),
    catalogo: real
  });
  assert.equal(comClasse(terminal.root, 'numeros').length, 0,
    'no Terminal a tela ainda empilha os três números');
  assert.equal(comClasse(terminal.root, 'conexao').length, 0,
    'no Terminal a tela ainda promete uma próxima conexão');
});

test('jornada: a próxima conexão diz o que o passo abre, inclusive baldeação', () => {
  // linha 1: Alfa (sem pré). linha 2: Beta (← Alfa). Concluir Alfa abre Beta,
  // que é de OUTRA linha: é travessia, e a tela nomeia a linha de destino.
  const cat = [
    { id: 'c1a', title: 'Alfa', stage: 1, prerequisites: [] },
    { id: 'c2a', title: 'Beta', stage: 2, prerequisites: ['c1a'] }
  ];
  const raiz = desenhar({ completed: [], catalogo: cat });
  const conn = comClasse(raiz.root, 'conexao-texto')[0];
  assert.ok(conn, 'a peça "próxima conexão" não foi desenhada');
  assert.equal(conn.textContent, 'Ao concluir Alfa, você abre Beta, na Linha 2.',
    `a conexão não nomeou a baldeação com a linha de destino: "${conn.textContent}"`);

  // Uma estação só, na linha 1: concluí-la fecha a linha, e não abre nada.
  const sozinha = [
    { id: 'f1a', title: 'Alfa', stage: 1, prerequisites: [] },
    { id: 'f1b', title: 'Beta', stage: 1, prerequisites: ['f1a'] }
  ];
  const fecha = desenhar({ completed: ['f1a'], catalogo: sozinha });
  const conn2 = comClasse(fecha.root, 'conexao-texto')[0];
  assert.ok(conn2, 'a linha que fecha não foi dita');
  assert.equal(conn2.textContent, 'Esta estação fecha a Linha 1.',
    `discrimina: com lista vazia a tela diria "você abre ." — "${conn2.textContent}"`);

  // E sem nada que abrir E sem linha que fechar, a peça se cala: nada inventado.
  // A peça tem que se calar. Beta está travada por Gama, que é uma estação REAL
  // e ainda não concluída — um pré inexistente não serve, porque o núcleo ignora
  // pré que não está no catálogo e a Beta abriria. Gama já está livre antes e
  // depois do gesto, então nada destrava; e a linha 1 tem 3 estações com zero
  // carimbos, então tampoco fecha. Nada a dizer: silêncio.
  const muda = [
    { id: 'm1a', title: 'Alfa', stage: 1, prerequisites: [] },
    { id: 'm1b', title: 'Beta', stage: 1, prerequisites: ['m1c'] },
    { id: 'm1c', title: 'Gama', stage: 1, prerequisites: [] }
  ];
  const calada = desenhar({ completed: [], catalogo: muda });
  const conn3 = comClasse(calada.root, 'conexao');
  assert.ok(conn3.length === 0 || conn3[0].children.length === 1,
    'a conexão inventou um gancho onde o catálogo não garante nenhum');
});

// ═══════════ 9. FATIA S4b: o layout do Lovable (cartões, duas colunas) ═══════════
// A crítica visual (31/10/2026) do Claude no celular: a linha ficou bonita, mas
// faltavam quatro coisas da JORNADA. A S4a respondeu o QUE se lê; aqui entra a
// FORMA: a placa com a única sombra do app, cada estação como cartão ao lado do
// trilho, duas colunas no computador e a entrada em cascata.
//
// Uma nota sobre o teste 4 ("só a placa tem sombra"), escrita aqui para não
// virar dúvida depois: o `@keyframes` do anel "você está aqui" (metro.css, da
// 2c/2d) também usa `box-shadow`, e é de propósito — é um anel concêntrico sem
// deslocamento, na cor da LINHA, não uma sombra de elevação. A regra da fatia é
// sobre a sombra que destaca um bloco no layout. Então o teste varre as REGRAS
// (seletores) e deixa os `@keyframes` de fora, dizendo por quê.

const cssMetroS4b = () => readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
const cssJornadaS4b = () => readFileSync(fileURLToPath(new URL('../web/telas/jornada.css', import.meta.url)), 'utf8');
// S5 parte 2: a folha é web/folha.css. Quem dá forma ao primário mudou de arquivo.
const cssFolhaS5 = () => readFileSync(fileURLToPath(new URL('../web/folha.css', import.meta.url)), 'utf8');

/**
 * Todo `box-shadow` escrito numa REGRA, com o seletor dela.
 * `@keyframes` fica de fora por decisão, não por descuido: o anel "você está
 * aqui" da 2c (`.forma.proxima`) cresce por box-shadow concêntrico, na cor da
 * linha, sem deslocamento — é anel, não sombra de elevação, e a frase da fatia
 * ("é a única sombra do app") fala da que destaca um bloco no layout.
 */
const sombrasDeRegra = (css) => {
  const saida = [];
  let seletor = '';
  let emKeyframes = false;
  for (const crua of css.split('\n')) {
    const t = crua.trim();
    if (t.endsWith('{')) {
      if (/@keyframes/.test(t)) { emKeyframes = true; seletor = t; }
      else if (!emKeyframes) seletor = t;
    } else if (emKeyframes && t === '}') {
      emKeyframes = false;
    } else if (/box-shadow:/.test(t) && !emKeyframes && !/box-shadow:\s*0 0 0\b/.test(t)) {
      // `0 0 0` é anel (contorno sem deslocamento): foco e "você está aqui".
      saida.push({ seletor, linha: t });
    }
  }
  return saida;
};

test('jornada: um primário só na tela', () => {
  // Dois recheios na cor da linha, um em cima do outro, é a tela pedindo duas
  // decisões para a mesma pessoa. A 2d-2 já dava UM primário por FOLHA (o
  // recurso, com o "Concluir" em contorno); a S4b sobe a regra para a TELA:
  // quando uma folha está aberta, é ela que manda, e a ação da placa cede.
  // O CSS da tela está dividido desde a S4b: a geometria do trilho no
  // metro.css, o que dá forma à tela no jornada.css. O teste lê os dois.
  const css = `${cssMetroS4b()}\n${cssJornadaS4b()}\n${cssFolhaS5()}`;
  const bloco = (seletor) => {
    const ini = css.indexOf(`\n${seletor} {`);
    assert.ok(ini >= 0, `${seletor} não existe no CSS do app`);
    return css.slice(ini, css.indexOf('}', ini));
  };
  // S5 parte 2: os nomes mudaram com o arquivo. `.recurso`/`.botao-concluir`
  // eram da folha-desenhada-dentro-da-linha; a folha de rota usa
  // `.botao-primario`/`.botao-secundario`, e é neles que a regra vive.
  // ACABAMENTO (04/11/2026, Chrome em 375/1280): o primário e o secundário da
  // folha saíam caixa clara. O metro.css é carregado DEPOIS do folha.css e o
  // `.botao { background: var(--fundo) }` dele empata em especificidade com um
  // `.botao-primario` de uma classe e vence pela ordem. As duas classes sobem a
  // especificidade acima do `.botao` da casa. Esta trava lia o seletor de uma
  // classe e caiu com a mudança — é ela que acompanha o desenho.
  assert.match(bloco('.botao.botao-primario'), /background:\s*var\(--cor\)/,
    'o recurso continua sendo o primário da folha, recheado na cor da linha');
  assert.match(bloco('.botao.botao-secundario'), /background:\s*(none|var\(--superficie\)|var\(--fundo\))/,
    'e o concluir continua contorno');
  // O estado que cede o primário: a raiz da tela ganha a classe quando há folha aberta.
  assert.match(css, /\.metro\.com-folha \.placa-acao \{[^}]*background:\s*(none|var\(--superficie\)|var\(--fundo\))/,
    'com uma folha aberta, a ação da placa não pode continuar recheada: um primário por tela');

  // S5 parte 2: "há folha aberta" não é mais estado interno da tela — vem da
  // rota, e por isso a chave do desenho é `folha` (o slug que o casco entrega).
  const comFolha = desenhar({ completed: [], linha: 1, folha: 'l1a', catalogo: CAT_RECURSO });
  assert.ok(comFolha.root.className.split(/\s+/).includes('com-folha'),
    `a tela com folha aberta tem className "${comFolha.root.className}": o CSS não tem como saber`);
  assert.equal(comClasse(comFolha.root, 'placa-acao').length, 1, 'a placa segue com a sua ação');
  assert.equal(comClasse(comFolha.root, 'folha-recurso').length, 1, 'e a folha aberta tem o recurso dela');

  const semFolha = desenhar({ completed: [], linha: 1, catalogo: CAT_RECURSO });
  assert.ok(!semFolha.root.className.split(/\s+/).includes('com-folha'),
    'sem folha aberta não há por que a placa ceder o primário');
});

test('jornada: a placa diz CONTINUE DE ONDE PAROU com estação em curso, e a posição na linha', () => {
  // JORNADA / fatia S4b: abaixo do nome, "Linha 2 · estação 3 de 5" — a pessoa
  // precisa saber ONDE naquela linha ela está, não só em qual linha.
  const { root } = desenhar({ completed: ['l1a'], emCurso: ['l1b'], linha: 1 });
  const cartao = comClasse(root, 'placa')[0];
  assert.ok(cartao, 'a placa sumiu');
  assert.equal(comClasse(cartao, 'placa-rotulo')[0].textContent, PLACAS.continueOndeParou,
    'com a estação já em curso, o rótulo ainda promete "Sua próxima estação"');
  const posicao = comClasse(cartao, 'placa-posicao');
  assert.equal(posicao.length, 1, 'a placa não diz a posição da estação na linha dela');
  // l1b é a 2ª de 2 estações da Linha 1 no catálogo de teste.
  assert.equal(posicao[0].textContent, comValores.posicaoNaLinha(1, 2, 2),
    `a posição saiu como "${posicao[0].textContent}" — queria "Linha 1 · estação 2 de 2"`);
  assert.ok(!/estação 0 de/.test(posicao[0].textContent), 'posição é 1-based, como a pessoa conta');

  // E quem ainda não começou continua lendo "Sua próxima estação".
  const outra = desenhar({ completed: ['l1a'], linha: 1 });
  assert.equal(comClasse(outra.root, 'placa-rotulo')[0].textContent, PLACAS.proximaEstacao,
    'o rótulo mudou para quem não está em curso');
});

test('jornada: a estação trancada diz o que falta e a concluída diz a data, no cartão', () => {
  // O apoio do cartão, a linha pequena abaixo do estado. A folha já diz tudo
  // isso quando abre; o cartão diz sem precisar abrir — é o que se vê rolando.
  const { root } = desenhar({
    completed: ['l1a'], linha: 2, conclusoes: { l1a: '2026-10-29' }
  });
  const apoio = (id) => {
    const botao = comAttr(root, 'data-id').find((n) => n.getAttribute('data-id') === id);
    assert.ok(botao, `a estação ${id} não foi desenhada`);
    return comClasse(botao, 'estacao-apoio');
  };
  const trancada = apoio('l2b'); // precisa de l1a (concluída) E de l1b
  assert.equal(trancada.length, 1, 'o cartão da trancada não diz nada além do estado');
  assert.match(trancada[0].textContent, /^Falta /, `saiu "${trancada[0].textContent}"`);
  assert.ok(trancada[0].textContent.includes('Algoritmos I'), 'pelo NOME do pré que falta');
  assert.ok(!/l1[ab]/.test(trancada[0].textContent), 'nunca pelo id');

  // l1a não está nesta linha: desenho a Linha 1, que tem a concluída.
  const r1 = desenhar({ completed: ['l1a'], linha: 1, conclusoes: { l1a: '2026-10-29' } });
  const feita = comClasse(r1.root, 'estacao-apoio').find((n) => /Concluída/.test(n.textContent));
  assert.ok(feita, 'o cartão da concluída não carimba a data');
  assert.equal(feita.textContent, comValores.concluidaEm('2026-10-29'));
  assert.equal(feita.textContent, 'Concluída em 29/10/2026', 'dd/mm/aaaa, nunca ISO na tela');

  // S5 parte 2: o cartão deixou de ser botão e passou a ser LINK para a rota da
  // estação. Quem abre a folha é o navegador, não um handler — o toque mudou de
  // dono de propósito, e `<a>` é o que dá histórico, voltar e abrir em outra aba.
  const linkDaFeita = comAttr(r1.root, 'data-id').find((n) => n.getAttribute('data-id') === 'l1a');
  assert.equal(linkDaFeita.tag, 'a', 'o cartão precisa ser âncora, não botão');
  assert.match(String(linkDaFeita.getAttribute('href')), /^#\/estacao\//, 'e aponta a rota da estação');
});

test('jornada: só a placa tem sombra', () => {
  // Duas famílias de box-shadow existem no app, e elas não são a mesma coisa:
  //   anel  — `0 0 0 Npx`, sem deslocamento, é contorno de foco ou o "você está
  //           aqui" da estação próxima. Não projeta nada, não levanta nada.
  //   sombra — tem offset (--sombra-placa = 4px 4px 0), levanta um bloco do
  //           papel. A JORNADA dá UMA no app inteiro, na placa.
  // Por isso o varredor ignora `0 0 0` e os @keyframes: a regra que ele cobra é
  // a sombra de elevação, que é o que a pessoa vê como "isto está por cima".
  // JORNADA: `box-shadow: var(--sombra-placa)` é a ÚNICA sombra do app. Fora
  // dos @keyframes (o anel "você está aqui" da 2c, que é anel e não sombra),
  // nenhum outro bloco pode projetar, e a sombra tem de morar no seletor dela.
  const todas = [['metro.css', cssMetroS4b()], ['jornada.css', cssJornadaS4b()]]
    .flatMap(([nome, css]) => sombrasDeRegra(css).map((s) => ({ ...s, arquivo: nome })));
  assert.equal(todas.length, 1,
    `${todas.length} sombras de elevação no app (${todas.map((s) => `${s.arquivo}:${s.seletor}`).join(' | ')}); a JORNADA dá uma só`);
  assert.match(todas[0].linha, /var\(--sombra-placa\)/, 'a sombra não vem do token');
  assert.ok(todas[0].seletor.includes('.placa'),
    `a sombra mora em "${todas[0].seletor}", não no seletor da placa`);
});

test('carregando: a placa cinza parada no lugar da placa, sem pulso', () => {
  // S4b "Carregando": o esqueleto ganha uma placa parada. Nada de brilho
  // correndo (a 2c-3 já proibia shimmer) e nada de sombra: sombra é a placa de
  // verdade, e um esqueleto que projeta ensina a pessoa a olhar para o lugar
  // errado quando o conteúdo chega.
  const doc = criarDoc();
  const root = raiz(doc);
  desenharEsqueleto(doc, root);
  assert.equal(comClasse(root, 'esqueleto-placa').length, 1, 'o esqueleto não tem placa');
  const css = cssJornadaS4b();
  const ini = css.indexOf('.esqueleto-placa {');
  assert.ok(ini >= 0, '.esqueleto-placa não existe no CSS da tela');
  const bloco = css.slice(ini, css.indexOf('}', ini));
  assert.ok(!/animation|box-shadow/.test(bloco), `a placa do esqueleto se mexe ou projeta: ${bloco}`);
  assert.match(bloco, /background:\s*var\(--borda\)/, 'cinza parado, da mesma família do resto');
});

test('jornada: as peças entram em cascata, com o atraso nos tokens', () => {
  // S4b "Movimento": abertura, placa e números entram escalonados, i de 0 a 5.
  // Quem espaça é o CSS (--atraso-cascata), e com movimento reduzido o token
  // zera sozinho — por isso o JS só entrega o ÍNDICE, nunca uma duração.
  const css = cssJornadaS4b();
  assert.match(css, /animation:\s*entrar var\(--movimento-abrir\) var\(--curva-atlas\)/,
    'a cascata não usa o `entrar` do casco com a curva do atlas');
  assert.match(css, /animation-delay:\s*calc\(var\(--atraso-cascata\) \* var\(--cascata-i/,
    'o escalonamento não vem de calc com --atraso-cascata e --cascata-i');

  const { root } = desenhar({ completed: ['l1a'], linha: 1 });
  const emCascata = todos(root, (n) => n.className.split(/\s+/).includes('cascata'));
  assert.ok(emCascata.length >= 3,
    `só ${emCascata.length} peças da Jornada entram em cascata; são abertura, placa e números`);
  const indices = emCascata.map((n) => n.getAttribute('style') || '');
  for (const s of indices) assert.match(s, /--cascata-i:\s*[0-5]\b/, `estilo "${s}" não traz um índice 0..5`);
  assert.deepEqual(indices.map((s) => Number(s.match(/--cascata-i:\s*(\d)/)[1])),
    indices.map((s) => Number(s.match(/--cascata-i:\s*(\d)/)[1])).sort((a, b) => a - b),
    'a cascata saiu fora de ordem: a pessoa veria os itens chegando embaralhados');
});

test('jornada: duas colunas no computador, e o token novo existe', () => {
  // S4b "Computador": grid de duas colunas com áreas nomeadas; a lateral com
  // --largura-lateral (360px) e sticky abaixo do topo. No celular, uma coluna
  // na ordem da S4a, que é a ordem do fonte.
  const css = cssJornadaS4b();
  assert.match(css, /--largura-lateral/, 'o layout não usa o token de largura da fatia');
  assert.match(css, /grid-template-columns:\s*1fr var\(--largura-lateral\)/,
    'a coluna lateral não é 1fr var(--largura-lateral)');
  assert.match(css, /grid-template-areas:/, 'as colunas não usam áreas nomeadas');
  assert.match(css, /position:\s*sticky/, 'a lateral não é sticky');
  assert.match(css, /top:\s*var\(--altura-topo\)/, 'o sticky não respeita a altura do topo');
  const tokens = readFileSync(fileURLToPath(new URL('../web/tokens.css', import.meta.url)), 'utf8');
  assert.match(tokens, /--largura-lateral:\s*360px/, '--largura-lateral não foi declarado em tokens.css');
  assert.match(tokens, /--altura-topo:\s*calc\(/,
    '--altura-topo não existe: o sticky do painel colaria embaixo do topo sticky');
});

// ── O defeito que só a tela mostra (01/11/2026, pedido do Lucas, desktop e
// celular): o número 1 nasce com o anel MUTILADO. A causa não é o selo, é a
// faixa que o envolve: `.linhas` é container de rolagem (`overflow-x: auto`),
// e um container de rolagem corta no próprio padding-edge. O padding era só
// embaixo. Só que o anel da linha atual é `box-shadow` --anel-foco de espessura
// — e box-shadow não aumenta caixa nenhuma, ele mora FORA dela — e o
// :focus-visible da base (regra S2) é contorno com afastamento: 3 + 3 também
// fora da caixa. Os dois vivem no espaço que a faixa não tinha. O selo 1 é o
// primeiro da fileira, encostado na borda esquerda da janela de recorte, e por
// isso era o que perdia o pedaço.
test('seletor: a faixa que rola não corta o anel do primeiro selo, e o selo 1 continua alinhado com a placa', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/metro.css', import.meta.url)), 'utf8');
  const m = /^\.linhas\s*\{([^}]*)\}/m.exec(css);
  assert.ok(m, '.linhas tem bloco próprio no começo da linha');
  const bloco = m[1];
  assert.match(bloco, /overflow-x:\s*auto/, 'a faixa continua rolando de lado quando não cabe');
  assert.match(bloco, /padding:\s*var\(--espaco-2\)/,
    'o ar de recorte tem de ser padding nos QUATRO lados: com padding só embaixo, o anel que vive fora da caixa (box-shadow e outline-offset) é cortado no selo 1');
  assert.match(bloco, /margin-inline:\s*calc\(-1 \* var\(--espaco-2\)\)/,
    'e a sobra é devolvida em margem negativa: sem isso o selo 1 entraria na margem da tela e perderia o alinhamento com a placa');
  assert.match(bloco, /margin-top:\s*var\(--espaco-2\)/,
    'o ar acima fica na conta de antes: --espaco-2 de margem + --espaco-2 de padding = o --espaco-4 que a placa já tinha');
});
