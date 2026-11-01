// Projeto Atlas — boot da página (web/boot.js) depois da grade.
//
// S7-1c (01/11/2026): a grade antiga morreu — o index parou de carregar
// grade.css, o arquivo saiu do disco e `boot.montarGrade` deixou de existir.
// Este arquivo tinha oito testes; três morreram com ela: a fumaça de
// montarGrade (desenhava trilha, slot de busca) e o fio `avisar` do
// exportador — cujo único chamador era a própria montagem. A garantia não se
// perde, se adia: quando a exportação de progresso voltar (S9), volta com
// chamador vivo e teste próprio. Cobrir código que ninguém chama é exatamente
// o defeito que esta casa apontou no main.js da v1.
//
// O que sobrevive e continua protegido: `registrarSW` (escopo relativo a
// baseURI, aviso de versão só na SEGUNDA visita, update() forçado) e o
// index.html como shell sem código inline — a lição do `avisar` de 27/10, que
// só aparecia no navegador porque vivia dentro de um <script> sem teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// fetch relativo falharia no node de qualquer jeito; fixar o erro deixa o teste
// deterministico (e garante que ele nao tenta rede).
globalThis.fetch = async () => { throw new Error('sem rede no teste: cai no catalogo minimo embutido'); };

const boot = await import('../web/boot.js');

/**
 * Navigator de mentira com service worker. `controller` e a PROVA de que ja
 * havia um SW controlando a pagina antes do registro — no navegador ele e null
 * na primeira visita e preenchido nas seguintes (clients.claim() do sw.js).
 * `reg.controller` existe so para mostrar que o teste leria o lugar errado se
 * registrarSW consultasse o registro em vez do navigator.
 */
function navComSW({ controller }) {
  // O registro e criado aqui e EXPOSTO em estado.reg porque o listener de
  // updatefound fecha sobre ele: o teste precisa por o SW novo em reg.installing
  // ANTES de disparar o evento, exatamente como o navegador faz.
  const estado = {
    registradas: [],
    aoAtualizar: null,
    regController: {}, // diferente do navigator.controller, de proposito
    reg: { installing: null, addEventListener: () => {} }
  };
  estado.reg.addEventListener = (tipo, fn) => { if (tipo === 'updatefound') estado.aoAtualizar = fn; };
  return {
    estado,
    serviceWorker: {
      controller,
      register: async (arquivo, opts) => {
        estado.registradas.push({ arquivo, opts });
        estado.reg.controller = estado.regController;
        return estado.reg;
      }
    }
  };
}

function winCom(nav) {
  return {
    // Fixture servida em SUBCAMINHO de proposito. O endereco real do Atlas e
    // https://atlas-ciencia-da-computacao.pages.dev/ (raiz do dominio, Cloudflare
    // Pages, 28/10/2026) — mas um escopo relativo tem de valer nos dois casos, e
    // o subcaminho e o que pega o bug: na raiz, um escopo errado passa despercebido.
    document: { baseURI: 'https://exemplo.test/atlas/index.html' },
    location: { protocol: 'https:', href: 'https://exemplo.test/atlas/' },
    navigator: nav,
    console
  };
}

test('boot: registrarSW usa escopo relativo a baseURI e nao avisa nada na primeira visita', async () => {
  // PRIMEIRA VISITA: sem navigator.controller. O navegador instala e ativa o SW
  // (e isso e normal, nao e atualizacao), entao "Nova versao instalada" seria
  // mentira — foi exatamente o que testar_pagina pegou em 28/10/2026.
  const nav = navComSW({ controller: null });
  const win = winCom(nav);
  const avisos = [];
  const r = await boot.registrarSW(win, (t) => avisos.push(t));

  assert.equal(r.registrado, true, `registro nao aconteceu: ${JSON.stringify(r)}`);
  assert.equal(r.jaControlava, false, 'primeira visita tem de ser reconhecida como primeira');
  assert.equal(nav.estado.registradas.length, 1);
  assert.equal(nav.estado.registradas[0].arquivo, 'sw.js');
  assert.equal(nav.estado.registradas[0].opts.scope, '/atlas/', 'escopo absoluto derruba o registro em subcaminho');
  assert.equal(nav.estado.aoAtualizar, null,
    'listener de updatefound instalado sem SW anterior: e ele que dispara o aviso falso na primeira visita');
  assert.equal(avisos.length, 0, 'avisar nao pode disparar antes da atualizacao');

  // Sem navigator.serviceWorker (file://, node) nao registra e nao explode.
  const semSW = await boot.registrarSW({ location: { protocol: 'http:' }, navigator: {} }, () => {});
  assert.equal(semSW.registrado, false);
});

test('boot: com SW ja no controle, a versao nova que ativa avisa o aluno', async () => {
  // VISITA SEGUINTE: ja havia um SW controlando, entao instalar outro e
  // atualizacao de verdade e o recado e honesto. Se alguem "simplificar"
  // registrarSW tirando a checagem de controller, este teste falha junto com o
  // da primeira visita — os dois lados da regra ficam cobertos.
  const nav = navComSW({ controller: { scriptURL: 'sw.js' } });
  const win = winCom(nav);
  const avisos = [];
  const r = await boot.registrarSW(win, (t) => avisos.push(t));

  assert.equal(r.registrado, true);
  assert.equal(r.jaControlava, true, 'nao reconheceu o SW que ja controlava a pagina');
  assert.equal(typeof nav.estado.aoAtualizar, 'function',
    'sem listener de updatefound o aluno nunca sabe que a versao nova instalou');

  // Updatefound -> installing -> activated: o recado so pode aparecer no fim.
  const swNovo = { state: 'installing', handlers: {}, addEventListener(t, f) { (this.handlers[t] ??= []).push(f); } };
  nav.estado.reg.installing = swNovo; // o navegador instala o novo antes de anunciar
  nav.estado.aoAtualizar({});
  assert.equal(avisos.length, 0, 'avisou enquanto o SW novo ainda estava instalando');
  swNovo.state = 'activated';
  for (const f of swNovo.handlers.statechange ?? []) f({});
  assert.equal(avisos.length, 1, 'o aluno nao ficou sabendo da atualizacao');
  assert.match(avisos[0], /Nova versão instalada/);
});

test('index.html: sem <script> inline com codigo, e o casco entra como modulo', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']\.\/web\/casco\.js["']/,
    'a pagina precisa carregar web/casco.js como modulo — e o modulo e o que o teste cobre');

  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, corpo] of inline) {
    if (/\bsrc\s*=/.test(attrs)) continue; // script externo: o codigo mora no arquivo
    // Tira comentario de HTML: <script> vazio com explicacao continua permitido.
    const codigo = corpo.replace(/<!--[\s\S]*?-->/g, '').trim();
    assert.equal(codigo, '',
      'codigo voltou para dentro do index.html: ali ele nao tem teste nenhum (foi assim que o `avisar` escapou)');
  }
});

// ── S7-1c (01/11/2026): a MORTE DA GRADE. Tres casos, um por lugar onde ela
// ainda vive: a exportacao no boot, o arquivo no disco e o <link> no HTML.
// Escrevi os tres ANTES do corte — vermelho pelo motivo certo, como nas
// fatias 2c/2d: "o codigo morreu" so e prova quando o teste apontava para ele.
test('boot.js: montarGrade morreu com a grade, e registrarSW fica sozinho', () => {
  assert.equal(boot.montarGrade, undefined,
    'montarGrade voltou: a grade vive de novo e o app tem duas Explorar no disco');
  assert.deepEqual(Object.keys(boot), ['registrarSW'],
    `boot.js deveria exportar apenas registrarSW; veio: ${Object.keys(boot).join(', ')}`);
});

test('web/grade.css saiu do disco', () => {
  assert.equal(existsSync(new URL('../web/grade.css', import.meta.url)), false,
    'web/grade.css ainda existe: as 25 linhas de medidas fora da escala seguem no app sem dono');
});

test('index.html: a Explorar e desenhada por telas/explorar.css, e grade.css nao e mais carregada', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(/<style\b/i.test(html), false,
    'voltou <style> para dentro do index.html: ali a CSS nao entra em teste nenhum');
  assert.doesNotMatch(html, /grade\.css/,
    'o index ainda carrega a grade: a tela puxaria CSS de um arquivo que nao esta mais no precache');
  assert.match(html, /<link[^>]+href=["']\.\/web\/telas\/explorar\.css["']/,
    'index.html nao carrega ./web/telas/explorar.css: a Explorar abre sem layout');
});
