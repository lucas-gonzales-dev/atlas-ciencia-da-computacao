// Projeto Atlas — a FOLHA da estação (fatia S5 da v2).
//
// O que se prova aqui, na ordem dos cinco grupos da fatia:
//   1. `fatosDaEstacao` no núcleo: pura, linha/posição/total/recurso/pede/abre;
//   2. a rota `#/estacao/<slug>`: slug que não existe cai na folha do mapa;
//   3. UM primário por estado, e nenhum na trancada (a regra da 2d-2 continua);
//   4. o campo de anotação com o NOME da estação no rótulo acessível;
//   5. a trancada listando o que falta como LINK para a folha daquela estação.
// Depois: o selo e o rótulo de posição, os três fatos, o "ao concluir você abre"
// com baldeação nomeada, o carimbo em dd/mm/aaaa, e o cartão do metrô apontando
// para a rota (o `<a href="#/estacao/…">` que substitui o clique que abria).
//
// Mini-DOM próprio, do mesmo tamanho do que a tela usa — sem isso o teste viraria
// teste de navegador (a regra que metro.test.js aprendeu na 2c).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fatosDaEstacao, ESTADOS } from '../core/viagem.js';
import { folha as FOLHA, comValores, placa as PLACAS, jornada as JORNADA } from '../core/textos.js';
import { desenharFolha } from '../web/folha.js';
import { desenharMetro } from '../web/metro.js';
import { lerRota } from '../core/rotas.js';
import { telaDaRota } from '../web/casco.js';

// ─────────────────────────────── mini-DOM ───────────────────────────────
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
    focus() { no.doc.foco = no; },
    closest(sel) {
      const casa = (n) => {
        if (sel.startsWith('[')) return n.getAttribute && n.getAttribute(sel.slice(1, -1)) !== null;
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
  const doc = { createElement: (tag) => criarNo(tag, doc), getElementById: (id) => porId.get(id) || null, foco: null };
  doc.registrar = (id, no) => { no.setAttribute('id', id); porId.set(id, no); return no; };
  return doc;
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
function textoDe(raiz) {
  return [raiz.textContent, ...(raiz.children || []).map(textoDe)].filter(Boolean).join(' ');
}

// ─────────────────────────── o catálogo de teste ───────────────────────────
// 3 linhas: a Linha 1 abre a 2 (baldeação), a Linha 2 tem 2 estações e a última
// dela não abre nada. Cada uma traz `slug`, porque a ROTA é por slug.
const CATALOGO = [
  { id: 'l1a', slug: 'matematica-discreta', title: 'Matemática Discreta', stage: 1, prerequisites: [], resourceUrl: 'https://youtube.com/playlist?list=1', resourceType: 'playlist', bibliography: 'extras/bibliography/01_a.md' },
  // Algoritmos I TEM recurso: o estado "disponível" da folha só existe com curso
  // para abrir (JORNADA §2.3), e o teste do primário cobra justamente esse caso.
  { id: 'l1b', slug: 'algoritmos-i', title: 'Algoritmos I', stage: 1, prerequisites: [], resourceUrl: 'https://youtube.com/playlist?list=1b', resourceType: 'playlist', bibliography: null },
  { id: 'l2a', slug: 'estruturas-de-dados', title: 'Estruturas de Dados', stage: 2, prerequisites: ['l1b'], resourceUrl: 'https://exemplo.org/l2a', resourceType: 'text', bibliography: 'extras/bibliography/02_b.md' },
  // Arquitetura pede DUAS estações: é o caso que o item 5 da fatia cobra — a
  // trancada lista o que falta TODO, não o primeiro que aparece.
  { id: 'l2b', slug: 'arquitetura', title: 'Arquitetura de Computadores', stage: 2, prerequisites: ['l1a', 'l1b'], resourceUrl: null, resourceType: null, bibliography: null },
  { id: 'l3a', slug: 'so', title: 'Sistemas Operacionais', stage: 3, prerequisites: ['l2b'], resourceUrl: null, resourceType: null, bibliography: null }
];

function abrir(slug, { completed = [], emCurso = [], conclusoes = {}, notas = {} } = {}) {
  const doc = criarDoc();
  const catalogo = CATALOGO.map((c) => (notas[c.id] ? { ...c, nota: notas[c.id] } : c));
  const nos = desenharFolha(doc, { catalogo, progresso: { completed, emCurso, conclusoes }, slug, notas });
  return { doc, ...nos };
}

// ═══════════ 1. o núcleo: fatosDaEstacao, pura ═══════════
test('viagem: fatosDaEstacao devolve linha, posição e total lidos do catálogo', () => {
  const f = fatosDaEstacao(CATALOGO, 'l2a', { completed: ['l1b'] });
  assert.equal(f.linha, 2, 'a linha é o estágio da fonte');
  assert.equal(f.posicao, 1, 'Estruturas é a primeira da Linha 2');
  assert.equal(f.total, 2, 'a Linha 2 tem duas estações no catálogo');
  assert.deepEqual(f.recurso, { tipo: 'texto', dominio: 'exemplo.org' }, 'tipo e domínio do catálogo, nada inventado');
  assert.deepEqual(f.pede.map((p) => p.id), [], 'concluído o pré-requisito, ela não pede mais nada');
});

test('viagem: fatosDaEstacao nomeia a baldeação que abre e o slug de cada uma', () => {
  const f = fatosDaEstacao(CATALOGO, 'l1b', { completed: [] });
  assert.equal(f.linha, 1);
  assert.equal(f.posicao, 2);
  assert.equal(f.abre.length, 2, 'Algoritmos I abre Estruturas de Dados e Arquitetura');
  assert.equal(f.abre[0].id, 'l2a');
  assert.equal(f.abre[0].slug, 'estruturas-de-dados', 'o link da folha é por slug');
  assert.equal(f.abre[0].linha, 2, 'linha de destino vem com o nome, para a folha dizer "na Linha 2"');
  assert.deepEqual(f.pede.map((p) => p.id), [], 'sem pré-requisito, nada falta');
});

test('viagem: fatosDaEstacao na última estação de uma linha, e o que ela abre', () => {
  const f = fatosDaEstacao(CATALOGO, 'l2b', { completed: ['l2a'] });
  assert.equal(f.posicao, 2, 'a última da Linha 2');
  assert.equal(f.total, 2);
  assert.deepEqual(f.abre.map((a) => a.id), ['l3a'], 'Arquitetura abre Sistemas Operacionais, na Linha 3');

  const g = fatosDaEstacao(CATALOGO, 'l3a', { completed: ['l2b'] });
  assert.equal(g.posicao, 1);
  assert.equal(g.total, 1, 'a Linha 3 tem uma estação só: a primeira é a última');
  assert.deepEqual(g.abre, [], 'ninguém pede Sistemas Operacionais — nada abre, e a folha diz isso');
});

test('viagem: fatosDaEstacao com id que não existe devolve null', () => {
  assert.equal(fatosDaEstacao(CATALOGO, 'nao-existe', { completed: [] }), null);
});

// ═══════════ 2. a rota: slug que não existe ═══════════
test('rotas: #/estacao/<slug> que não existe dá a folha de "não está no mapa"', () => {
  assert.deepEqual(lerRota('#/estacao/xyz'), { tela: 'estacao', slug: 'xyz' }, 'a rota já existia: o casco é que não a montava');
  const { root } = abrir('xyz');
  const aviso = comClasse(root, 'folha-inexistente')[0];
  assert.ok(aviso, 'a folha abre mesmo sem estação');
  assert.equal(textoDe(aviso).includes(FOLHA.naoEstaNoMapa), true, `"${textoDe(aviso)}"`);
  const voltar = comClasse(root, 'botao-volver')[0];
  assert.equal(voltar.tag, 'a', 'voltar ao mapa é um link, não um span');
  assert.equal(voltar.getAttribute('href'), '#/');
  assert.equal(textoDe(voltar), FOLHA.voltarAoMapa);
  assert.equal(comClasse(root, 'botao-primario').length, 0, 'estação que não existe não tem ação nenhuma');
});

test('casco: a rota estacao pede a Jornada por baixo e a folha por cima', () => {
  const r = telaDaRota({ tela: 'estacao', slug: 'estruturas-de-dados' });
  assert.equal(r.tela, 'jornada', 'a estação não é uma tela nova: ela monta a Jornada');
  assert.equal(r.folha, 'estruturas-de-dados', 'e diz qual folha abrir por cima');
  assert.deepEqual(telaDaRota({ tela: 'explorar' }), { tela: 'explorar', folha: null });
});

// ═══════════ 3. um primário por estado ═══════════
test('folha: disponível tem UM primário e o concluir é secundário', () => {
  const { root } = abrir('algoritmos-i');
  const primarios = comClasse(root, 'botao-primario');
  assert.equal(primarios.length, 1, `primários: ${primarios.length}`);
  assert.equal(textoDe(primarios[0]), PLACAS.comecarEstudar);
  assert.equal(primarios[0].tag, 'a', 'o recurso abre fora: é link com href');
  assert.equal(primarios[0].getAttribute('target'), '_blank');
  const concluir = comClasse(root, 'botao-secundario').find((b) => textoDe(b) === PLACAS.concluir);
  assert.ok(concluir, 'quem já estudou por fora conclui pelo secundário');
  assert.equal(comClasse(root, 'folha-nota')[0].textContent, FOLHA.notaAbrir);
});

test('folha: em curso inverte — o primário passa a ser concluir', () => {
  const { root } = abrir('algoritmos-i', { emCurso: ['l1b'] });
  const primarios = comClasse(root, 'botao-primario');
  assert.equal(primarios.length, 1);
  assert.equal(primarios[0].getAttribute('data-concluir'), 'l1b', 'o verbo do núcleo, pela porta de sempre');
  assert.equal(comClasse(root, 'botao-secundario').length, 1, 'e o curso fica como secundário');
});

test('folha: trancada não tem botão primário nenhum', () => {
  const { root } = abrir('estruturas-de-dados');
  assert.equal(comClasse(root, 'botao-primario').length, 0, 'a trancada não oferece o recurso');
  assert.equal(comClasse(root, 'botao-concluir').length, 0, 'nem tem o que concluir');
  assert.equal(textoDe(comClasse(root, 'folha-trancada-titulo')[0]), FOLHA.trancadaTitulo);
});

test('folha: concluída carimba, revisita e desfaz — sem primário', () => {
  const { root } = abrir('matematica-discreta', { completed: ['l1a'], conclusoes: { l1a: '2026-10-30' } });
  const carimbo = comClasse(root, 'folha-carimbo')[0];
  assert.equal(textoDe(carimbo), 'Concluída em 30/10/2026', `"${textoDe(carimbo)}"`);
  assert.doesNotMatch(textoDe(carimbo), /\d{4}-\d{2}-\d{2}/, 'ISO não é para ser lido na tela');
  assert.equal(comClasse(root, 'botao-primario').length, 0, 'quem passou por ali não recebe um primário novo');
  assert.equal(textoDe(comClasse(root, 'botao-secundario')[0]), FOLHA.revisitar);
  const desfazer = comClasse(root, 'folha-desfazer')[0];
  assert.equal(desfazer.tag, 'a', 'desfazer conclusão é link discreto, não botão');
  assert.equal(desfazer.getAttribute('data-desfazer'), 'l1a');
});

// ═══════════ 4. a anotação com o nome da estação ═══════════
test('folha: o campo de anotação tem o nome da estação no rótulo acessível', () => {
  const { root } = abrir('estruturas-de-dados', { notas: { l2a: 'Revisar a fila.' } });
  const campo = porTag(root, 'textarea')[0];
  assert.ok(campo, 'a folha tem o campo');
  assert.equal(campo.getAttribute('aria-label'), `Anotação de Estruturas de Dados`);
  assert.equal(campo.value, 'Revisar a fila.', 'o que a pessoa escreveu volta no campo');
  assert.equal(textoDe(comClasse(root, 'folha-anotacao-rotulo')[0]), FOLHA.anotacaoPergunta);
  assert.equal(campo.getAttribute('data-nota'), 'l2a');
  const status = comClasse(root, 'folha-salvo')[0];
  assert.equal(status.getAttribute('role'), 'status');
});

// ═══════════ 5. a trancada lista o que falta, como links ═══════════
test('folha: a trancada lista o que falta como links para as folhas', () => {
  const { root } = abrir('arquitetura');
  const lista = comClasse(root, 'folha-falta')[0];
  const links = porTag(lista, 'a');
  assert.equal(links.length, 2, 'a folha trancada lista TODOS os pré-requisitos');
  assert.deepEqual(links.map((l) => l.getAttribute('href')), ['#/estacao/matematica-discreta', '#/estacao/algoritmos-i']);
  assert.deepEqual(links.map((l) => textoDe(l)), ['Matemática Discreta', 'Algoritmos I']);
  for (const l of links) assert.equal(l.className.includes('botao'), false, 'link de falta não é botão');
});

// ═══════════ o alto da folha ═══════════
test('folha: selo da linha, "Linha 2 · estação 1 de 2" e o estado por texto', () => {
  const { root } = abrir('estruturas-de-dados');
  const selo = comClasse(root, 'selo')[0];
  assert.equal(selo.textContent, '2', 'o número da linha dentro do selo');
  assert.equal(selo.className.includes('l2'), true, 'a cor do selo vem da CLASSE da linha');
  assert.equal(textoDe(comClasse(root, 'folha-rotulo')[0]), 'Linha 2 · estação 1 de 2');
  assert.equal(porTag(root, 'h2')[0].textContent, 'Estruturas de Dados');
  assert.equal(porTag(root, 'h2')[0].getAttribute('id'), 'folha-titulo', 'o diálogo aponta para este título');
  assert.equal(textoDe(comClasse(root, 'folha-estado')[0]), 'Trancada', 'o estado sai por forma E por texto (JORNADA §3.1)');
});

test('folha: os três fatos com rótulo de placa — recurso, bibliografia, conexões', () => {
  const { root } = abrir('matematica-discreta');
  const rotulos = comClasse(root, 'fato-rotulo').map((n) => textoDe(n));
  assert.deepEqual(rotulos, ['Recurso', 'Bibliografia', 'Conexões']);
  const valores = comClasse(root, 'fato-valor');
  assert.equal(textoDe(valores[0]), 'Playlist no YouTube', 'a mesma origem da placa, a mesma função');
  const biblio = porTag(valores[1], 'a')[0];
  assert.equal(textoDe(biblio), PLACAS.bibliografiaNaFonte, 'link COM NOME, nunca o caminho');
  assert.equal(biblio.getAttribute('href').startsWith('https://'), true);
  // Matemática Discreta não é pré-requisito de nada que ela própria abra, e pede
  // zero: mas o fixture a pôs como pré-requisito de Arquitetura, então "Abre 1".
  // A folha diz o NÚMERO lido da malha, nunca uma lista inventada.
  assert.equal(textoDe(valores[2]), 'Pede 0 · Abre 1', `valor: "${textoDe(valores[2])}"`);
});

test('folha: "ao concluir, você abre" nomeia a baldeação com a linha de destino', () => {
  const { root } = abrir('algoritmos-i');
  const bloco = comClasse(root, 'folha-abre')[0];
  assert.equal(textoDe(comClasse(bloco, 'folha-abre-titulo')[0]), 'Ao concluir, você abre');
  assert.equal(textoDe(bloco).includes('na Linha 2'), true, `não nomeou a travessia: "${textoDe(bloco)}"`);
  assert.equal(textoDe(bloco).includes('Estruturas de Dados'), true);
});

test('folha: a última da linha diz que fecha a linha, em vez de uma lista vazia', () => {
  const { root } = abrir('so', { completed: ['l2b'] });
  const bloco = comClasse(root, 'folha-abre')[0];
  assert.equal(textoDe(bloco), JORNADA.conexao.fecha(3), `"${textoDe(bloco)}"`);
});

// ═══════════ o cartão do metrô agora é link ═══════════
// FEITO na S5 parte 2 (01/11): o cartão virou <a href="#/estacao/<slug>">, a
// folha saiu do `detalhe` de dentro da linha (é web/folha.js, Irmã do mapa) e
// os 18 casos que provavam a folha de dentro foram reescritos no metro.test.js
// contra o painel da rota. Era { todo } até este commit: verde falso custa
// mais que uma dívida a vista, e agora a dívida está paga com o caso rodando.
test('metrô: o cartão da estação é <a href="#/estacao/<slug>">', () => {
  const doc = criarDoc();
  const root = doc.registrar('metro', doc.createElement('div'));
  desenharMetro(doc, root, { catalogo: CATALOGO, progresso: { completed: [], emCurso: [], conclusoes: {} }, linha: 1 });
  const cartoes = comClasse(root, 'estacao');
  assert.ok(cartoes.length >= 2, 'os cartões existem');
  for (const c of cartoes) {
    assert.equal(c.tag, 'a', `<${c.tag}> deveria ser <a>: abrir estação é ir a uma rota`);
    assert.match(String(c.getAttribute('href')), /^#\/estacao\//);
  }
  assert.equal(cartoes[0].getAttribute('href'), '#/estacao/matematica-discreta');
  assert.equal(comClasse(root, 'detalhe').length, 0, 'a folha não mora mais dentro da linha');
});

// ═══════════ folha.css: os tokens, não a mão ═══════════
const CSS = readFileSync(new URL('../web/folha.css', import.meta.url), 'utf8');

test('folha.css: painel à direita de 480px no computador, com a borda da linha', () => {
  assert.match(CSS, /--largura-painel/, 'a largura do painel é token, não número à mão');
  assert.match(CSS, /border-left:\s*var\(--espessura-borda-painel\)\s+solid\s+var\(--cor\)/);
  assert.match(CSS, /@media\s*\(min-width:\s*1024px\)/, 'o painel é a partir do breakpoint do computador');
});

test('folha.css: no celular a folha sobe de translateY(100%), com véu sem desfoque', () => {
  assert.match(CSS, /transform:\s*translateY\(100%\)/);
  assert.match(CSS, /var\(--movimento-abrir\)\s+var\(--curva-atlas\)/, 'abrir usa o token de movimento da v2');
  assert.match(CSS, /--altura-folha/, 'os 90% da tela são token');
  assert.match(CSS, /color-mix\(in srgb, var\(--tinta\)\s+40%/);
  assert.doesNotMatch(CSS, /backdrop-filter/, 'vidro fosco está na lista do proibido');
});

test('folha.css: botão de fechar com o piso de toque e sem cor à mão', () => {
  assert.match(CSS, /min-height:\s*var\(--alvo-toque\)/);
  assert.doesNotMatch(CSS, /#[0-9a-f]{3,8}\b/i, 'nenhum hex fora do tokens.css');
  assert.doesNotMatch(CSS, /\d+m?s\b/, 'nenhuma duração à mão');
  assert.doesNotMatch(CSS, /^.*\s\/\/|^\s*\/\//m, 'comentário em CSS é /* */');
});
