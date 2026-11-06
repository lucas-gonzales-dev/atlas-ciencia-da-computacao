// Projeto Atlas — a tela PERFIL (fatia S9 da v2).
//
// POR QUE EXISTE: o perfil é um portfólio de evidência — carimbo com data, marco
// com critério escrito, e os dados da pessoa em um arquivo. Nada disso pode ser
// escrito pelo desenho da tela: as 35 casas vêm do catálogo real, o estado de cada
// marco vem do núcleo (MARCOS + resumoDaViagem), e o export/import é o envelope de
// `core/progress-io.js`, não um JSON inventado pela tela. Um dublê de catálogo com
// meia dúzia de estações provaria "35 casas" contando o que eu mesmo escrevi — por
// isso este arquivo lê `data/catalog.json` do disco.
//
// MINI-DOM igual ao do explorar.test.js e do folha.test.js (mesma casa, mesma
// medida). E o mesmo erro que já paguei duas vezes está escrito no corpo: o
// `modulosFake` não pode inventar assinatura. O contrato com o main.js é cobrado
// no metro.test.js para a Jornada; aqui a tela fala com main.js e com
// core/dados-pessoa.js, e as duas pontas são conferidas contra o disco.
//
// NADA DE RELÓGIO DE VERDADE: o Perfil não temporiza — se um dia precisar, recebe
// `setTimeout` em ctx (lição da 2c-1/2d).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { montar } from '../web/telas/perfil.js';
import { STATUS, estadoDoMarco, marcosDoPerfil, revisoesFeitas } from '../core/dados-pessoa.js';
import { TEXTOS, proibido } from '../core/textos.js';
import { TOTAL_ESTACOES, ESTACOES_POR_LINHA, resumoDaViagem } from '../core/viagem.js';

const CATALOGO = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8')
);
const COURSES = CATALOGO.courses;
// A fixture que não existe no catálogo tem que gritar o próprio nome. Sem isto,
// um slug chutado dava `undefined` e o caso "2 casas carimbadas" virava "0", que
// é o tipo de vermelho que se lê como bug da tela e era bug do teste.
const idPorSlug = (slug) => {
  const c = COURSES.find((x) => x.slug === slug);
  assert.ok(c, `a fixture inventou um slug que o catálogo não tem: «${slug}»`);
  return c.id;
};

// ───────────────────────────── mini-DOM ─────────────────────────────
function criarNo(tag, doc) {
  const no = {
    tag, doc, children: [], attrs: {}, className: '', value: '', dataset: {},
    listeners: {}, parent: null, type: '', htmlFor: '', id: '', placeholder: '', hidden: false,
    // textContent='' destrói os filhos no navegador. Sem o setter, este mini-DOM
    // acumularia as pinturas antigas e todo teste de "some quando muda" mentiria.
    get textContent() { return this._texto || ''; },
    set textContent(v) { this._texto = String(v); if (this._texto === '') this.children = []; },
    classList: {
      contains: (c) => no.className.split(/\s+/).includes(c),
      add: (...cs) => { no.className = [...no.className.split(/\s+/).filter(Boolean), ...cs].join(' '); },
      remove: (...cs) => { no.className = no.className.split(/\s+/).filter((c) => c && !cs.includes(c)).join(' '); }
    },
    // O navegador tem `parentNode` e `parent`; o mini-DOM só tinha `parent`, e
    // um `avisar` que confere parentNode não anexava nada. A tela estava certa
    // e o teste acusava "a recusa não apareceu". Dublê que falta atributo real
    // é o erro da 2c-1 de novo: o teste mede o dublê.
    get parentNode() { return this.parent; },
    setAttribute(k, v) { no.attrs[k] = String(v); if (k === 'id') no.id = String(v); },
    getAttribute(k) { return k in no.attrs ? no.attrs[k] : null; },
    append(...ns) { for (const n of ns) { n.parent = no; no.children.push(n); } },
    addEventListener(tipo, fn) { (no.listeners[tipo] ||= []).push(fn); },
    dispatch(tipo, ev) { for (const fn of no.listeners[tipo] || []) fn(ev); },
    focus() { no.doc.foco = no; },
    closest(sel) {
      const casa = (n) => (sel.startsWith('.') ? n.className.split(/\s+/).includes(sel.slice(1)) : n.tag === sel);
      for (let n = no; n; n = n.parent) if (casa(n)) return n;
      return null;
    },
    querySelector(sel) { return todos(no, (n) => (sel.startsWith('.') ? n.className.split(/\s+/).includes(sel.slice(1)) : n.tag === sel))[0] || null; },
    querySelectorAll(sel) { return todos(no, (n) => (sel.startsWith('.') ? n.className.split(/\s+/).includes(sel.slice(1)) : n.tag === sel)); }
  };
  return no;
}

function criarDoc() {
  const doc = { createElement: (tag) => criarNo(tag, doc), foco: null };
  return doc;
}

function todos(raiz, pred, saida = []) {
  if (!raiz) return saida;
  if (pred(raiz)) saida.push(raiz);
  for (const f of raiz.children || []) todos(f, pred, saida);
  return saida;
}
const comClasse = (raiz, re) => todos(raiz, (n) => n.className.split(/\s+/).some((c) => re.test(c)));
const textoDe = (raiz) => todos(raiz, (n) => n._texto).map((n) => n._texto).join(' ');

// ───────────────────────────── ctx da tela ─────────────────────────────
// Storage de mentira com as DUAS chaves reais: progresso e anotações (main.js) e
// revisões (core/revisao.js). Sem as duas, a tela "não tem revisão nenhuma" por
// acidente e o número REVISÕES mentiria verde.
function storageCom({ completed = [], notas = {}, revisoes = null } = {}) {
  const dados = new Map();
  if (completed.length) dados.set('atlas.progresso.v1', JSON.stringify(completed));
  if (Object.keys(notas).length) dados.set('atlas.notas.v1', JSON.stringify(notas));
  if (revisoes !== null) dados.set('atlas.revisoes.v1', JSON.stringify(revisoes));
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    _dados: dados
  };
}

const HOJE = '2026-11-01';

function ctxCom(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const chamadas = [];
  const storage = 'storage' in opts ? opts.storage : storageCom();
  const win = { localStorage: storage, setTimeout: () => 0, clearTimeout: () => {} };
  const modulos = {
    // ASSINATURAS REAIS (conferidas contra o disco no teste 6): loadCompleted(),
    // loadNotas(), saveNotas(notas), aplicarNota(state, id, texto),
    // salvarProgresso(completed).
    loadCompleted: () => (opts.completed || []).slice(),
    saveCompleted: (ids) => { chamadas.push(['saveCompleted', ids.length]); return true; },
    loadNotas: () => ({ ...(opts.notas || {}) }),
    saveNotas: (notas) => { chamadas.push(['saveNotas', Object.keys(notas).length]); return true; },
    aplicarNota: (state, id, texto) => { chamadas.push(['aplicarNota', id]); return { ...state, anotacoes: { ...state.anotacoes, [id]: texto } }; },
    ...opts.modulos
  };
  const ctx = {
    document: doc,
    window: win,
    storage,
    modulos,
    hoje: HOJE,
    catalogo: Promise.resolve(opts.catalogo || CATALOGO),
    estadoCatalogo: opts.catalogo || CATALOGO,
    _doc: doc,
    _raiz: raiz,
    _chamadas: chamadas,
    ...opts.ctx
  };
  return ctx;
}

// ───────────────────────────── 1. o bilhete ─────────────────────────────
test('perfil: o bilhete tem 35 casas, 5 por linha, e a carimbada diz a data', async () => {
  const concluidas = ['introducao-cc-python-i', 'laboratorio-poo-i'];
  const ctx = ctxCom({ completed: concluidas.map(idPorSlug), notas: {} });
  await montar(ctx._raiz, ctx);

  const fileiras = comClasse(ctx._raiz, /^perfil-bilhete-fileira$/);
  assert.equal(fileiras.length, 7, `o bilhete tem ${fileiras.length} fileiras, não as 7 linhas do catálogo`);
  for (const [i, f] of fileiras.entries()) {
    const casas = f.children.filter((n) => n.className.split(/\s+/).includes('perfil-casa'));
    assert.equal(casas.length, ESTACOES_POR_LINHA, `fileira ${i + 1} tem ${casas.length} casas, deviam ser ${ESTACOES_POR_LINHA}`);
  }

  const casas = comClasse(ctx._raiz, /^perfil-casa$/);
  assert.equal(casas.length, TOTAL_ESTACOES, `o bilhete mostra ${casas.length} casas, o catálogo tem ${TOTAL_ESTACOES}`);

  const carimbadas = casas.filter((n) => n.className.split(/\s+/).includes('perfil-casa-carimbada'));
  assert.equal(carimbadas.length, 2, `só ${carimbadas.length} casas carimbadas para 2 conclusões`);
  // A data que o núcleo guarda (dd/mm/aaaa, sem fuso que vire o dia).
  const comData = carimbadas.filter((n) => /\d{2}\/\d{2}\/\d{4}/.test(textoDe(n)));
  assert.equal(comData.length, 2, `nenhuma casa carimbada mostra a data: "${textoDe(carimbadas[0])}"`);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(textoDe(carimbadas[0])), `o bilhete mostra a data crua em ISO: "${textoDe(carimbadas[0])}"`);

  // Nome acessível dos dois lados, e a casa é link para a folha.
  const vazia = casas.find((n) => !n.className.split(/\s+/).includes('perfil-casa-carimbada'));
  const nome = (n) => n.getAttribute('aria-label') || '';
  assert.match(nome(carimbadas[0]), /concluída em \d{2}\/\d{2}\/\d{4}/, `casa carimbada sem o nome acessível com data: "${nome(carimbadas[0])}"`);
  assert.match(nome(vazia), /ainda não$/, `casa vazia sem o nome acessível: "${nome(vazia)}"`);
  assert.ok(String(vazia.attrs.href || '').startsWith('#/estacao/'), 'a casa não é link para a folha da estação');
});

// ───────────────────────────── 2. os marcos ─────────────────────────────
test('perfil: cada marco tem nome, critério e estado, e o fim da linha conta as linhas fechadas', () => {
  const lista = marcosDoPerfil(CATALOGO.courses);
  assert.equal(lista.length, 4, `saiu ${lista.length} marco, o núcleo define 4`);
  for (const m of lista) {
    assert.ok(m.nome && m.criterio, `marco sem nome ou sem critério: ${JSON.stringify(m)}`);
    // O critério é lícito na tela: escrito, não desenhado por cor sozinha.
    assert.ok(/Concluir/.test(m.criterio), `critério de marco sem a regra: ${m.criterio}`);
  }

  // Uma linha inteira (5 estações da Linha 1) + uma estação da Linha 2.
  const linha1 = CATALOGO.courses.filter((c) => c.stage === 1).map((c) => c.id);
  const umaDa2 = CATALOGO.courses.filter((c) => c.stage === 2)[0].id;
  const progresso = { completed: [...linha1, umaDa2], emCurso: [], conclusoes: Object.fromEntries([...linha1, umaDa2].map((id) => [id, HOJE])) };
  const comEstado = marcosDoPerfil(CATALOGO.courses, progresso);
  const porTipo = Object.fromEntries(comEstado.map((m) => [m.tipo, m]));

  assert.equal(porTipo.estacao.estado, STATUS.CONQUISTADO, 'uma estação concluída e o marco "primeira estação" não foi conquistado');
  assert.equal(porTipo.estacao.data, HOJE, `marco conquistado sem a data do carimbo: ${JSON.stringify(porTipo.estacao)}`);
  const fim = porTipo.fim_da_linha;
  assert.equal(fim.estado, STATUS.EM_ANDAMENTO, 'uma linha fechada de 7 não é "em andamento"');
  assert.equal(fim.conta, '1 de 7', `o fim da linha não conta as linhas fechadas: "${fim.conta}"`);
  assert.equal(porTipo.terminal.conta, `6/${TOTAL_ESTACOES}`, `terminal sem a conta das estações: "${porTipo.terminal.conta}"`);

  // Forma E texto, não só cor: o estado é palavra legível.
  for (const m of comEstado) assert.ok(Object.values(STATUS).includes(m.estado), `estado que não é palavra: ${m.estado}`);
});

// S17b: os marcos da S9 saíram da tela — a caderneta os substitui (o desenho,
// princípio 4, troca o bilhete carimbado pela declaração por carimbo medido, e os
// dois na mesma folha diriam coisas diferentes sobre a mesma estação). A CONTA do
// marco continua no núcleo e é conferida acima, no caso de `marcosDoPerfil`: o que
// aposentado é o desenho, não a função.
test('perfil: os marcos saíram da tela, e a caderneta ocupa o lugar', async () => {
  const ctx = ctxCom({ completed: CATALOGO.courses.filter((c) => c.stage === 1).map((c) => c.id) });
  await montar(ctx._raiz, ctx);
  assert.deepEqual(comClasse(ctx._raiz, /^perfil-marco$/), [], 'a tela ainda desenha um marco da S9');
  const todo = textoDe(ctx._raiz);
  for (const nome of ['Série do percurso', 'Série do domínio']) {
    assert.ok(todo.includes(nome), `falta a seção «${nome}» na tela`);
  }
  assert.ok(!/Concluir as 35 estações\./.test(todo), 'o critério do marco terminal voltou à tela');
});

// ───────────────────────────── 3. os dados ─────────────────────────────
test('perfil: exportar leva viagem, anotações e revisões; importar devolve as três', async () => {
  const concluidas = CATALOGO.courses.filter((c) => c.stage === 1).map((c) => c.id);
  const notas = { [concluidas[0]]: 'vi a aula 3' };
  // historico escrito na forma normalizada: `copiar` recria cada entrada, então
  // um `historico: []` SEMPRE volta no arquivo — omite-lo aqui faria o deepEqual
  // da volta acusar o núcleo de inventar campo. E com um registro real dentro,
  // o caso prova que o HISTÓRICO da pessoa sobrevive ao arquivo, não só a agenda.
  const revisoes = { [concluidas[0]]: { degrau: 1, proxima: '2026-11-08', historico: [{ data: '2026-11-01', resultado: 'em-parte' }] } };
  const original = storageCom({ completed: concluidas, notas, revisoes });

  const estado = {
    courses: CATALOGO.courses,
    electives: CATALOGO.electives,
    specializations: CATALOGO.specializations,
    completed: concluidas,
    anotacoes: notas,
    revisoes
  };
  const baixado = [];
  const doc = criarDoc();
  const win = {
    localStorage: original,
    Blob: function (partes) { baixado.push(partes[0]); this.texto = partes[0]; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    document: doc
  };
  doc.createElement = (tag) => {
    const n = criarNo(tag, doc);
    if (tag === 'a') n.click = () => baixado.push(['click', n.download]);
    return n;
  };
  doc.body = doc.createElement('body');

  const texto = await exportarViagemCom(estado, win, doc);
  assert.ok(texto.includes('"completed"'), 'o export não levou a viagem');
  assert.ok(texto.includes('"anotacoes"'), 'o export não levou as anotações');
  assert.ok(texto.includes('"revisoes"'), 'o export não levou as revisões da S8');
  assert.match(texto, /vi a aula 3/, 'a anotação da pessoa não está no arquivo');
  assert.match(texto, /2026-11-08/, 'a data da revisão não está no arquivo');

  // IDA E VOLTA: outro aparelho, tudo vazio, importando o arquivo acima.
  const importado = await importarViagemCom(texto, estado, win, doc);
  assert.equal(importado.ok, true, `a volta foi recusada: ${importado.erro}`);
  assert.deepEqual(importado.completed, concluidas, 'a viagem não voltou na volta');
  assert.deepEqual(importado.anotacoes, notas, 'as anotações não voltaram na volta');
  assert.deepEqual(importado.revisoes, revisoes, 'as revisões não voltaram na volta');
});

// Helper do teste 3: a tela chama core/dados-pessoa.js com o document/window dela.
// Aqui o mesmo caminho, para a ida e volta ser medida no código que a tela usa.
async function exportarViagemCom(estado, win, doc) {
  const { exportarViagem } = await import('../core/dados-pessoa.js');
  const r = exportarViagem(estado, { document: doc, window: win, agora: new Date(HOJE) });
  return r.texto;
}
async function importarViagemCom(texto, estado, win, doc) {
  const { importarViagem } = await import('../core/dados-pessoa.js');
  return importarViagem(texto, estado);
}

test('perfil: a recusa diz o quê, por quê e o que fazer', async () => {
  const ctx = ctxCom({});
  const inst = await montar(ctx._raiz, ctx);
  const entrada = ctx._raiz.querySelector('input');
  assert.ok(entrada, 'a tela de dados não tem input de arquivo');
  // Um arquivo que não é do Atlas: JSON válido, envelope errado.
  entrada.files = [{ text: async () => '{"oi":1}' }];
  entrada.dispatch('change', { target: entrada });
  await Promise.resolve();
  // `pronto` e a promessa do que a tela fez com o arquivo (a leitura e
  // assincrona). Sem esperar, o recado ainda nao estaria na tela.
  await (inst.pronto || Promise.resolve());
  const recado = comClasse(ctx._raiz, /^perfil-dados-recado$/);
  assert.ok(recado.length, 'a recusa não apareceu em lugar nenhum da tela');
  const frase = textoDe(recado[0]);
  assert.ok(frase.length > 0, 'o recado está vazio');
  // As três partes: o quê, por quê, o que fazer.
  assert.match(frase, /arquivo|viagem/i, `recado não diz O QUÊ: "${frase}"`);
  assert.match(frase, /porque|não|sem/i, `recado não diz POR QUÊ: "${frase}"`);
  assert.match(frase, /export|exportado|Atlas|escolha/i, `recado não diz O QUE FAZER: "${frase}"`);
});

// ───────────────────────────── 4. bilhete em branco ─────────────────────────────
test('perfil: o bilhete em branco mostra o texto e um primário só', async () => {
  const ctx = ctxCom({ completed: [] });
  await montar(ctx._raiz, ctx);
  const todo = textoDe(ctx._raiz);
  assert.match(todo, /O primeiro carimbo vem da primeira estação concluída\./, `bilhete em branco sem a frase: "${todo.slice(0, 160)}"`);
  assert.equal(comClasse(ctx._raiz, /^perfil-casa$/).length, 0, 'o bilhete em branco mostra as 35 casas vazias; a fatia pede o texto no lugar dele');

  // A classe e a do design system, um token de primario. O regex e de palavra
  // inteira porque "primario-secundario" nao e um segundo primario.
  //
  // S20b-6 (item 3): a classe crua `primario` nao existia em folha.css nem em
  // metro.css — era uma palavra desta tela, e o elemento chegava nu, com o fundo
  // padrao do sistema. O nome real da casa e `botao botao-primario` (folha.js:354,
  // revisar-fila.js:61), e e ele que a folha pinta. A régua continua a mesma: UM.
  const primarios = comClasse(ctx._raiz, /^botao-primario$/);
  assert.equal(primarios.length, 1, `${primarios.length} primários na tela em branco; um gesto por tela`);
  assert.match(textoDe(primarios[0]), /Ir para a próxima estação/, `o primário não é a próxima estação: "${textoDe(primarios[0])}"`);
  assert.match(String(primarios[0].attrs.href || ''), /^#\/$/, 'o primário não leva à Jornada');

  // S17b: a caderneta e os dados continuam na tela em branco. Os 51 espaços vazios
  // são o desenho de quem ainda não tem nada — escondê-los aqui seria o bilhete.
  assert.match(todo, /Série do percurso/, 'a caderneta sumiu da tela em branco');
  assert.match(todo, /Série do domínio/, 'a série do domínio sumiu da tela em branco');
  assert.ok(comClasse(ctx._raiz, /^perfil-dados$/).length === 1, 'os dados sumiram da tela em branco');
});

// ───────────────────────────── 5. a voz ─────────────────────────────
test('perfil: nenhum texto do perfil fala em XP, pontos, ranking ou sequência', async () => {
  const alvo = TEXTOS.perfil;
  assert.ok(alvo, 'os textos do perfil não estão em core/textos.js (regra 7: toda frase da tela mora ali)');
  const frases = [];
  const varrer = (obj, onde) => {
    for (const [chave, valor] of Object.entries(obj)) {
      if (typeof valor === 'string') frases.push([`${onde}.${chave}`, valor]);
      else if (typeof valor === 'function') frases.push([`${onde}.${chave}`, String(valor)]);
      else if (valor && typeof valor === 'object') varrer(valor, `${onde}.${chave}`);
    }
  };
  varrer(alvo, 'perfil');

  // A lista do proibido (§9) em palavras que o Lovable pôs no perfil.
  // \bxp\b, não xp: sem fronteira, "E**xp**ortar viagem" e "arquivo e**xp**ortado"
  // eram achados — o teste reprovaria a frase que a fatura dele mesmo pediu, e
  // eu trocaria a palavra certa por uma mais boba para satisfazer o regex.
  // \bconquista\b, não conquista: o estado interno do marco é `conquistado`
  // (STATUS do núcleo) e aparece no seletor `.perfil-marco[data-estado=...]`.
  // A palavra que a fatura proíbe é a de placar ("conquista!" na tela), e o que
  // a pessoa lê é 'Concluído' — o teste não pode proibir o nome de um estado.
  const veneno = /\bxp\b|pontos?\b|ranking|leaderboard|sequ[eê]ncia|streak|\bconquista\b|trof[eé]u|n[ií]vel\b/i;
  const ruins = frases.filter(([, texto]) => veneno.test(texto)).map(([onde, texto]) => `${onde}: ${texto}`);
  assert.deepEqual(ruins, [], `o perfil virou placar: ${ruins.join(' | ')}`);

  // E a tela inteira também é lida: frase escrita no desenho não passa pela casa.
  const css = readFileSync(fileURLToPath(new URL('../web/telas/perfil.css', import.meta.url)), 'utf8');
  const js = readFileSync(fileURLToPath(new URL('../web/telas/perfil.js', import.meta.url)), 'utf8');
  for (const [arquivo, texto] of [['perfil.css', css], ['perfil.js', js]]) {
    const achado = texto.split(/\r?\n/).filter((l) => veneno.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    assert.deepEqual(achado, [], `${arquivo} escreveu placar na tela: ${achado.join(' | ')}`);
  }
  assert.ok(proibido.includes('emoji'), 'a lista do proibido mudou de forma; este teste precisa ser relido');
});

// ───────────────────────────── 6. o contrato ─────────────────────────────
test('perfil: a tela fala com o main.js e com o núcleo que existem, com a assinatura certa', async () => {
  const js = readFileSync(fileURLToPath(new URL('../web/telas/perfil.js', import.meta.url)), 'utf8');
  const mainSrc = readFileSync(fileURLToPath(new URL('../web/main.js', import.meta.url)), 'utf8');
  const nucleoSrc = readFileSync(fileURLToPath(new URL('../core/dados-pessoa.js', import.meta.url)), 'utf8');

  // O que a tela pede ao main.js (a Jornada tem contrato parecido no metro.test.js).
  const pedidos = js.match(/modulos\.([A-Za-z_$][\w$]*)/g)?.map((s) => s.slice('modulos.'.length)) || [];
  const nomesUnicos = [...new Set(pedidos)].filter((n) => !['import', 'default'].includes(n));
  assert.ok(nomesUnicos.length >= 3, `a tela não nomeia o que pede ao main.js: ${nomesUnicos.join(', ')}`);

  for (const nome of nomesUnicos) {
    const re = new RegExp(`export\\s+function\\s+${nome}\\s*\\(([^)]*)\\)`, 'm');
    const m = mainSrc.match(re);
    assert.ok(m, `o main.js não exporta ${nome}: a tela chamaria undefined (foi assim que a anotação quebrou em 31/10)`);
    const argReal = m[1].split(',').map((s) => s.trim()).filter((s) => s && !s.includes('=')).length;
    const chamada = new RegExp(`${nome}\\(([^)]*)\\)`, 'g');
    const usados = [...js.matchAll(chamada)].map((c) => c[1].split(',').map((s) => s.trim()).filter(Boolean).length);
    if (usados.length) {
      assert.ok(
        Math.max(...usados) <= argReal,
        `${nome} é chamada com ${Math.max(...usados)} argumentos e o main.js recebe ${argReal}`
      );
    }
  }

  // E o que a tela pede ao núcleo tem que estar lá.
  // Um nível OU DOIS: a tela vive em web/telas/, então o caminho real é
  // '../../core/...'. Com \.\./ fixo, o teste acusava a tela de não importar o
  // núcleo — e ela importa. Regex de caminho tem que casar o disco, não o que
  // eu imaginei quando escrevi o caso.
  // (\.\.\/)+ e não \.\.\/+ : o caminho tem DOIS níveis ('../../core/'), e com
  // um só o teste acusava a tela de não importar o núcleo — ela importa.
  const importNucleo = js.match(/from '(\.\.\/)+core\/dados-pessoa\.js'/);
  assert.ok(importNucleo, 'perfil.js não importa o núcleo dos dados da pessoa');
  const pedidosNucleo = js.match(/import\s*\{([^}]*)\}\s*from\s*'(\.\.\/)+core\/dados-pessoa\.js'/)?.[1]
    ?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  for (const nome of pedidosNucleo) {
    assert.match(nucleoSrc, new RegExp(`export (function|const) ${nome}\\b`), `core/dados-pessoa.js não exporta ${nome}`);
  }
});

// ───────────────────────────── 7. a aba, o link e o offline ─────────────────────────────
test('perfil: a aba existe, o index aponta para ela, e sem catálogo a tela diz o que viu', async () => {
  const { ABAS } = await import('../core/rotas.js');
  const perfil = ABAS.find((a) => a.tela === 'perfil');
  assert.ok(perfil, `a aba Perfil não está em ABAS: ${ABAS.map((a) => a.tela).join(', ')}`);
  assert.equal(perfil.rotulo, 'Perfil', `o rótulo da aba não veio de core/textos.js: ${perfil.rotulo}`);
  assert.equal(perfil.href, '#/perfil');

  const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const nav = html.slice(html.search(/<nav\b[^>]*>/i), html.indexOf('</nav>'));
  const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  assert.equal(links.length, ABAS.length, `a nav tem ${links.length} link(s) e ABAS tem ${ABAS.length}`);
  const i = ABAS.findIndex((a) => a.tela === 'perfil');
  assert.ok(/href="#\/perfil"/.test(links[i][1]), `a aba ${i} não aponta para #/perfil: ${links[i][1]}`);
  assert.ok(links[i][2].includes('Perfil'), 'a aba do perfil não mostra o rótulo');

  // CSS nos tokens (regra 14 e 15): folha escopada, sem cor nem duração à mão.
  const css = readFileSync(fileURLToPath(new URL('../web/telas/perfil.css', import.meta.url)), 'utf8');
  assert.match(css, /^\.perfil\s*\{/m, 'perfil.css não abre com a classe .perfil — o casco ancora a tela nela');
  const cores = css.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) || [];
  assert.deepEqual(cores, [], `perfil.css com cor escrita à mão: ${cores.join(', ')}`);
  const duracoes = css.match(/:\s*[\d.]+m?s\b/g) || [];
  assert.deepEqual(duracoes, [], `perfil.css com duração à mão: ${duracoes.join(', ')}`);

  // Offline: o catálogo é a promessa que falhou.
  const ctx = ctxCom({});
  // Sem estadoCatalogo: em http o contexto do casco tem só a PROMESSA do
  // catálogo (loadCatalog é um getter vivo, e nenhuma tela escreve nele). O
  // teste que deixasse o atalho do dublê ali provaria a tela em offline
  // pintando pelo caminho que a página nunca percorre.
  delete ctx.estadoCatalogo;
  ctx.catalogo = Promise.reject(new Error('sem rede'));
  const inst = await montar(ctx._raiz, ctx);
  // A pintura do erro é assíncrona (montar devolve antes de ela acontecer):
  // sem esperar por `pronto`, o texto lido é o "está carregando" e o caso
  // acusaria a tela de não dizer o que viu — como aconteceu em 02/11.
  await inst.pronto;
  const todo = textoDe(ctx._raiz);
  assert.match(todo, /Sem rede|trilha|catálogo|catálogo não/i, `sem catálogo a tela não diz o que viu: "${todo.slice(0, 120)}"`);
  assert.ok(!/NaN|undefined|\[object/.test(todo), `a tela em erro mostra resto de código: "${todo.slice(0, 160)}"`);
});

// ───────────────────────────── 8. revisões feitas, não agendadas ─────────────────────────────
test('perfil: REVISÕES conta o que a pessoa fez, e o carimbo sem data não vira ISO', () => {
  // Um calendário com uma revisão JÁ FEITA (historico) e outra só agendada.
  const calend = {
    [idPorSlug('introducao-cc-python-i')]: {
      // A forma é a que o NÚCLEO escreve (revisao.js:136: `{ data, resultado }`),
      // não `em:`. Com `em:` o copiar descartava a entrada legality e a tela
      // lia REVISÕES 0 — eu ia "consertar" o núcleo para aceitar a chave que a
      // MINHA fixture chutou, e isso bifurcaria o formato dos dados da pessoa.
      degrau: 2, proxima: '2026-11-08', historico: [{ data: '2026-11-01', resultado: 'lembrei' }]
    },
    [idPorSlug('laboratorio-poo-i')]: {
      degrau: 1, proxima: '2026-11-04'
    }
  };
  assert.equal(revisoesFeitas(calend), 1, 'REVISÕES contou o que está agendado, não o que a pessoa fez');
  assert.equal(revisoesFeitas({}), 0);
  assert.equal(revisoesFeitas(null), 0);

  const ctx = ctxCom({ storage: storageCom({ completed: Object.keys(calend), revisoes: calend }) });
  return montar(ctx._raiz, ctx).then(() => {
    const numeros = comClasse(ctx._raiz, /^perfil-numero-valor$/);
    const textos = numeros.map(textoDe);
    assert.ok(textos.some((t) => t.trim() === '1'), `o número REVISÕES não é 1: ${textos.join(' | ')}`);
    const bilhete = comClasse(ctx._raiz, /^perfil-casa-carimbada$/);
    for (const b of bilhete) {
      assert.match(textoDe(b), /\d{2}\/\d{2}\/\d{4}/, `carimbo sem data legível: "${textoDe(b)}"`);
    }
  });
});
