// Projeto Atlas — S20a (04/11/2026): o TOPO da Jornada, J1 e J5.
//
// Duas telas na mesma peça: quem nunca abriu nada vê o mapa, lê o tamanho da
// rede e tem UM caminho; quem já abriu uma aula continua de onde parou. As
// travas abaixo passam pelo CASCO (subirMetro), com o catálogo REAL, o
// indice.json REAL e um storage dublê — a lição da casa é que dublê com
// interface inventada prova o dublê, e um `desenharTopo` chamado no vácuo
// provaria que o topo sabe desenhar um desenho que o app nunca mostra.
//
// OS DOIS NÚMEROS QUE NÃO PODEM ESTAR ESCRITOS: 35 e 1.375. As provas deles
// estão no fim do arquivo, em forma de armadilha: trocar o valor que entra por
// `indice` tem de mudar a tela, e um `1375` no código-fonte do topo é defeito.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { comClasse, criarDoc, porTag, storageCom, textoDe, todos, esperar } from './hdom.js';
import { duracaoLegivel } from '../core/aulas.js';

// hdom.js exporta comClasse/porTag/todos; `comAttr` é helper local do
// metro.test.js e não sai de lá. Um nó com um data-*, neste arquivo.
const comAttr = (raiz, attr) => todos(raiz, (n) => n.getAttribute(attr) !== null);
import { subirMetro } from '../web/metro.js';
import { alvoDoTopo, carregarIndice, desenharTopo } from '../web/telas/jornada-topo.js';
import { ESTUDO_KEY, abrirAula, lerEstudo, serializarEstudo } from '../core/estudo.js';
// S20a-3: a «próxima» do topo é a MESMA conta da placa e do perfil. Importar
// resumoDaViagem aqui é o que impede a trava de concordar com um palpite meu
// sobre qual estação vem depois de Circuitos Digitais.
import { resumoDaViagem } from '../core/viagem.js';

// core/estudo.js não exporta `vazio` (o sumário do disco mente — a lista dele
// vem do arquivo, e o arquivo chama a função de outro jeito). O estudo de quem
// nunca abriu nada é o que o núcleo devolve para um storage vazio: lerEstudo.
const vazio = () => lerEstudo(null);
import { aulas as AU, jornada as J } from '../core/textos.js';

const RAIZ = new URL('../', import.meta.url);
const LER = (rel) => readFileSync(fileURLToPath(new URL(rel, RAIZ)), 'utf8');
const ESTADO = JSON.parse(LER('data/catalog.json'));
const CATALOGO = ESTADO.courses;
const INDICE = JSON.parse(LER('data/aulas/indice.json'));
const HOJE = '2026-11-04';

// A primeira estação da Linha 1 é o caminho de quem chega: hoje, Circuitos
// Digitais. Lida do catálogo, nunca escrita aqui — se a grade mudar de ordem, o
// teste acompanha; se alguém fixar um slug, ele denuncia.
const LINHA_1 = [...new Set(CATALOGO.map((c) => Number(c.stage)).filter(Number.isFinite))].sort((a, b) => a - b)[0];
const PRIMEIRA = CATALOGO.find((c) => Number(c.stage) === LINHA_1);
const AULAS_PRIMEIRA = JSON.parse(LER(`data/aulas/${PRIMEIRA.slug}.json`));
const AULA_1 = AULAS_PRIMEIRA.aulas.find((a) => Number(a.n) === 1);
const AULA_3 = AULAS_PRIMEIRA.aulas.find((a) => Number(a.n) === 3);

/** O `buscar` do app, servindo os JSON do disco — sem rede, sem inventar. */
function buscarDe(file) {
  return async (url) => {
    let bruto;
    try {
      bruto = LER(`data/${String(url).replace(/^data\//, '')}`);
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => JSON.parse(bruto) };
  };
}

/** Storage com o registro de estudo do aparelho: `n` aulas abertas, na 1ª estação. */
function storageComEstudo(ateN) {
  let estudo = vazio();
  for (const a of AULAS_PRIMEIRA.aulas.filter((x) => Number(x.n) <= ateN)) {
    // `aaaa-mm-ddThh:mm` cru: o HE_QUANDO do núcleo (estudo.js:55) rejeita ISO
    // com segundos e fuso, e o faz EM SILÊNCIO — `abrirAula` devolve o estudo
    // igual, sem `ultima`. Um formato chutado aqui produz uma primeira visita
    // fingindo de volta, que é o verde mais perigoso desta fatia.
    estudo = abrirAula(estudo, { estacao: PRIMEIRA.id, aula: a.id, n: a.n }, '2026-11-03T10:00');
  }
  return storageCom({ [ESTUDO_KEY]: serializarEstudo(estudo) });
}

async function subir(opts = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const win = { location: { hash: '#/' }, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} };
  const inst = await subirMetro({
    root: raiz,
    document: doc,
    storage: opts.storage || storageCom({}),
    window: win,
    modulos: {
      loadCatalog: () => Promise.resolve(ESTADO),
      loadCompleted: () => (opts.completed || []).slice(),
      saveCompleted: () => true,
      loadNotas: () => ({}),
      saveNotas: () => true,
      aplicarNota: (s) => s
    },
    setTimeout: () => 0,
    hoje: HOJE,
    buscarAulas: buscarDe(),
    folha: opts.folha ?? null
  });
  await esperar();
  return { doc, raiz, inst, win };
}

/** Os primários VISÍVEIS da tela: a classe que o folha.css pinta de cheio. */
const primarios = (raiz) => comClasse(raiz, /^botao-primario$/);

// ───────────────────────── 1. J1: a primeira visita ─────────────────────────

test('topo J1: a primeira coisa é o mapa das 35 estações, dito pelo catálogo', async () => {
  const { raiz } = await subir();
  const topo = comClasse(raiz, /^topo$/)[0];
  assert.ok(topo, 'o topo da Jornada não nasceu');

  const quadro = comClasse(topo, /^topo-mapa$/)[0];
  assert.ok(quadro, 'o mapa sumiu do topo');
  const svg = porTag(quadro, 'svg')[0];
  assert.ok(svg, 'o mapa não montou o SVG — insertAdjacentHTML não rodou');
  assert.equal(svg.getAttribute('role'), 'img', 'o mapa é um desenho, não um texto');
  assert.equal(svg.getAttribute('aria-label'), J.topo.mapaAcessivel(CATALOGO.length, 0),
    'o rótulo do mapa não diz a verdade de quem ainda não estudou nada');
  assert.equal(svg.getAttribute('aria-label'), `As ${CATALOGO.length} estações da rede; nenhuma estudada ainda`,
    'a frase do aria-label mudou sem passar pelo texto da casa');

  // É o MESMO desenho do cartão do link, não um segundo diagrama: a classe é a
  // do mapaDaRede, e um nó por estação do catálogo (o grupo `.mapa-estacoes`
  // também casa em `circle`, por isso se contam as estações, não os círculos).
  assert.match(porTag(quadro, 'svg')[0].className || '', /mapa-rede/,
    'sem a classe do mapaDaRede o topo é outro desenho');
  assert.equal(todos(quadro, (n) => /^mapa-estacao$/.test(n.className)).length, CATALOGO.length,
    'o mapa não tem um nó por estação do catálogo');

  // O mapa vem ANTES do título: na primeira visita a rede é a frase de abertura.
  const ler = [...topo.children].map((n) => n.className.split(/\s+/)[0]);
  assert.ok(ler.indexOf('topo-mapa') < ler.indexOf('topo-titulo'),
    `a ordem de leitura mudou: ${ler.join(' → ')}`);
});

test('topo J1: h1, medida e UM primário, com a linha de apoio vinda dos dados', async () => {
  const { raiz } = await subir();
  const topo = comClasse(raiz, /^topo$/)[0];

  assert.equal(porTag(topo, 'h1').length, 1, 'o topo tem mais de um h1');
  assert.equal(porTag(topo, 'h1')[0].textContent, J.topo.titulo);
  assert.equal(porTag(topo, 'h1')[0].textContent, 'Ciência da Computação, aula por aula');

  const medida = porTag(topo, 'p').find((p) => p.className.includes('topo-medida'));
  assert.ok(medida, 'a linha de medida sumiu');
  assert.equal(medida.textContent,
    J.topo.medida(CATALOGO.length, 'UBL', INDICE.total.aulas));

  const btns = primarios(raiz);
  assert.equal(btns.length, 1, `${btns.length} primários na tela: a Jornada tem UM caminho`);
  const alvo = btns[0];
  assert.equal(alvo.textContent, 'Começar pela primeira aula');
  assert.match(alvo.getAttribute('href'), /#\/estacao\/[a-z0-9-]+\/aula\/1$/,
    'o primário não leva à Aula 1 de uma estação');
  assert.ok(alvo.getAttribute('href').includes(PRIMEIRA.slug),
    'o primário não leva à primeira estação da Linha 1');

  const apoio = porTag(topo, 'p').find((p) => p.className.includes('topo-apoio'));
  assert.ok(apoio, 'a linha de apoio sumiu do lado do primário');
  // A frase inteira, remontada do catálogo + do JSON da estação: nome, aula e
  // duração lidos dos dados, separados pelo ponto-midda da casa.
  assert.equal(apoio.textContent,
    J.topo.apoioComecar(PRIMEIRA.title, 1, duracaoLegivel(AULA_1.duracaoS)));
});

test('topo J1: embaixo, discreto, o convite abre o MESMO fluxo de marcar', async () => {
  const { raiz } = await subir();
  const topo = comClasse(raiz, /^topo$/)[0];
  const marcar = comAttr(topo, 'data-embarque')[0];
  assert.ok(marcar, 'o convite de quem já estudou sumiu');
  assert.equal(marcar.textContent, 'Já estudei algumas disciplinas');
  assert.equal(marcar.getAttribute('aria-expanded'), 'false', 'a lista começa fechada');
  assert.equal(comAttr(raiz, 'data-marcar').length, 0, 'a lista de marcar apareceu sem ninguém pedir');

  // O hdom não faz bubbling: `dispatch` chama os ouvintes do próprio nó. O
  // bindMetro escuta no ROOT por delegação, então o gesto é disparado no root
  // com o `target` sendo o botão — é o que o navegador faz, e é o que o
  // `closest('[data-embarque]')` de metro.js:905 lê.
  raiz.dispatch('click', { target: marcar });
  await esperar();
  const agora = comAttr(raiz, 'data-marcar');
  assert.ok(agora.length > 0, 'clicar no convite não abriu o fluxo de marcar');
  // Uma estação marcada pelo fluxo continua sendo a palavra da pessoa sobre o
  // que ela estudou: o verbo do núcleo, não um segundo caminho.
  raiz.dispatch('click', { target: agora[0] });
  await esperar();
  assert.equal(comAttr(raiz, 'data-marcar').length, 0, 'marcou e a lista não saiu de cena');
});

test('topo J1: sem tour, sem cadastro, sem pedir notificação', async () => {
  const { raiz } = await subir();
  const texto = textoDe(raiz).toLowerCase();
  assert.equal(/tour|onboarding|cadastro|criar conta|login|notifica/.test(texto), false,
    'a primeira visita pediu algo que ela não pede');
});

// ───────────────────────── 2. J5: a volta ─────────────────────────

test('topo J5: o único primário é a aula que a pessoa deixou no aparelho', async () => {
  const { raiz } = await subir({ storage: storageComEstudo(3) });
  const btns = primarios(raiz);
  assert.equal(btns.length, 1, `${btns.length} primários na volta: um só caminho`);
  assert.equal(btns[0].textContent, AU.continuar(3, AULA_3.titulo),
    'o cartão de retomada não nomeia a aula que foi aberta por último');
  assert.match(btns[0].getAttribute('href'), new RegExp(`#\\/estacao\\/${PRIMEIRA.slug}\\/aula\\/3$`),
    'o Continuar não leva à aula 3 da estação registrada');

  const topo = comClasse(raiz, /^topo$/)[0];
  const apoio = porTag(topo, 'p').find((p) => p.className.includes('topo-apoio'));
  assert.equal(apoio.textContent,
    J.topo.apoioVolta(PRIMEIRA.title, LINHA_1, duracaoLegivel(AULA_3.duracaoS)),
    'a linha de apoio da volta não saiu dos dados (estação · linha · duração)');
});

// ─────────── 4. S20a-2: o primário que o OLHO vê, não só a classe ───────────
// A régua de cima contava `.botao-primario` e lia UM; o Chrome lia DOIS, porque a
// `.placa-acao` sai recheada do metro.css (`background: var(--cor, var(--tinta))`)
// sem trazer a classe do vocabulário da casa. Uma trava que só conhece a classe
// aprova o defeito. `cheios` conta os dois caminhos, e a armadilha planta um
// segundo cheio SEM a classe: se a régua for cega de novo, o teste cai.
const cheios = (raiz) => {
  const cede = /\bcom-folha\b|\bcom-topo-primario\b/.test(raiz.className);
  return todos(raiz, (n) => {
    const cls = String(n.className || '').split(/\s+/);
    return cls.includes('botao-primario') || (cls.includes('placa-acao') && !cede);
  });
};

test('S20a-2: um só alvo recheado na primeira visita, e é o do topo', async () => {
  const { raiz } = await subir();
  const lista = cheios(raiz);
  assert.equal(lista.length, 1,
    `${lista.length} alvos recheados: ${lista.map((n) => `${n.tag}.${n.className}`).join(' | ')}`);
  assert.ok(String(lista[0].className).includes('topo-primario'),
    'o cheio da primeira visita não é o caminho do topo');
  assert.match(raiz.className, /\bcom-topo-primario\b/,
    'a raiz não declarou quem tem o recheio: o CSS da placa não tem como ceder');
});

test('S20a-2: dois recheados na tela derrubam a prova', () => {
  const doc = criarDoc();
  const topo = desenharTopo({
    catalogo: CATALOGO, progresso: { completed: [] }, resumo: { concluidas: 0 },
    estudo: vazio(), indice: INDICE, aulas: null, embarqueAberto: false
  }, doc);
  const raiz = doc.createElement('div');
  raiz.className = 'metro l1';
  raiz.append(topo);
  assert.equal(cheios(raiz).length, 1);
  const outra = doc.createElement('a');
  outra.className = 'placa-acao plantada';
  raiz.append(outra);
  assert.equal(cheios(raiz).length, 2,
    'a régua não enxerga um recheado que não traz a classe botao-primario');
});

test('S20a-2: a placa só fica cheia quando ninguém mais tem o caminho', async () => {
  // Sem catálogo, o topo não tem estação para apontar: a placa fica recheada e o
  // topo se cala. Com a folha no ar, é ela que manda. Nos três estados, UM cheio.
  const { raiz } = await subir({ folha: PRIMEIRA.slug, completed: [PRIMEIRA.id] });
  assert.match(raiz.className, /\bcom-folha\b/);
  assert.ok(!/\bcom-topo-primario\b/.test(raiz.className),
    'as duas classes de estado na mesma raiz: o CSS cede para um lado e enche para o outro');
  const doc = criarDoc();
  const semCatalogo = desenharTopo({
    catalogo: [], progresso: { completed: [] }, resumo: { concluidas: 0 },
    estudo: vazio(), indice: null, aulas: null, embarqueAberto: false
  }, doc);
  assert.equal(primarios(semCatalogo).length, 0,
    'o topo sem estação apontou para lugar nenhum com um botão cheio');
});

test('topo J5: nenhuma palavra de ausência na tela', async () => {
  const { raiz } = await subir({ storage: storageComEstudo(3) });
  const texto = textoDe(raiz);
  const re = /sumiu|faz \d+ dias|desde/i;
  const achado = texto.match(re);
  assert.equal(achado, null, `a volta conta ausência para a pessoa: «${achado?.[0]}» em «${texto.slice(0, 200)}…»`);
});

test('topo J5: o mapa fica ABAIXO do cartão, com o que já foi estudado aceso', async () => {
  const { raiz } = await subir({ storage: storageComEstudo(3) });
  const topo = comClasse(raiz, /^topo$/)[0];
  const ler = [...topo.children].map((n) => n.className.split(/\s+/)[0]);
  assert.ok(ler.indexOf('topo-acao') < ler.indexOf('topo-mapa'),
    `quem voltou vê o mapa antes de ver onde estava: ${ler.join(' → ')}`);
  const svg = porTag(comClasse(topo, /^topo-mapa$/)[0], 'svg')[0];
  assert.ok(svg.getAttribute('aria-label').includes('estudada'),
    `o rótulo do mapa ignora o estudo do aparelho: «${svg.getAttribute('aria-label')}»`);
});

test('topo: a herança da cor da linha é a classe lN, como a página da aula', async () => {
  const vazioTopo = await subir();
  assert.ok(comClasse(vazioTopo.raiz, /^topo$/)[0].className.includes(`l${LINHA_1}`),
    'o topo da primeira visita não herdou a linha da estação para onde ele aponta');
  const outro = await subir({ storage: storageComEstudo(3) });
  assert.ok(comClasse(outro.raiz, /^topo$/)[0].className.includes(`l${LINHA_1}`),
    'o topo da volta não herdou a cor da linha');
});

test('topo: o alvo cai na primeira visita quando o aparelho aponta para estação que não existe', () => {
  const alvo = alvoDoTopo(CATALOGO, { ultima: { estacao: 'disciplina-que-morreu', aula: 'x', n: 4 } });
  assert.equal(alvo.modo, 'primeira', 'um storage órfão linkaria para lugar nenhum');
  assert.equal(alvo.curso.id, PRIMEIRA.id);
});

// ───────────────────────── 3. os dois números, lidos ─────────────────────────

test('jornada-topo: os números são lidos, nunca escritos', () => {
  // Só o CÓDIGO, não a prosa: este arquivo explica a regra citando o número, e
  // um varredor que lê comentários denunciaria a explicação em vez do defeito.
  const fonte = LER('web/telas/jornada-topo.js')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.equal(/1\.?375|1375/.test(fonte), false,
    'o total de aulas está escrito à mão no código do topo — ele vem do indice.json');
  assert.equal(/\b35\b/.test(fonte), false,
    'o número de estações está escrito à mão no código do topo — ele vem do catálogo');

  // A armadilha que prova a leitura: trocar o valor que entra tem de trocar a
  // tela. Se a frase tivesse o número pregado, este assert passaria igual.
  const doc = criarDoc();
  const com = desenharTopo({
    catalogo: CATALOGO, progresso: { completed: [] }, resumo: { concluidas: 0 },
    estudo: vazio(), indice: { total: { aulas: 907 } }, aulas: null, embarqueAberto: false
  }, doc);
  assert.match(textoDe(com), /907/, 'a linha de medida ignorou o indice.json que recebeu');
  assert.equal(textoDe(com).includes(String(INDICE.total.aulas)), false,
    'a medida mostrou o número do disco mesmo com outro indice na mão');

  // E o indice.json real: é dele que o app lê o 1.375, com separador de milhar.
  assert.equal(INDICE.total.aulas > 1000, true, 'o índice de aulas mudou de ordem de grandeza: rever a frase');
  const comReal = desenharTopo({
    catalogo: CATALOGO, progresso: { completed: [] }, resumo: { concluidas: 0 },
    estudo: vazio(), indice: INDICE, aulas: null, embarqueAberto: false
  }, criarDoc());
  assert.match(textoDe(comReal), new RegExp(INDICE.total.aulas.toLocaleString('pt-BR')));
});

test('jornada-topo: dois primários na tela derrubam a prova', () => {
  // A régua dos primários é a mesma dos testes acima; plantar um segundo botão
  // tem de fazê-la acusar. Sem isto, "um primário" pode ser só uma varredura
  // que não varre nada — o pior tipo de verde.
  const doc = criarDoc();
  const topo = desenharTopo({
    catalogo: CATALOGO, progresso: { completed: [] }, resumo: { concluidas: 0 },
    estudo: vazio(), indice: INDICE, aulas: null, embarqueAberto: false
  }, doc);
  assert.equal(primarios(topo).length, 1);
  const extra = doc.createElement('a');
  extra.className = 'botao botao-primario plantada';
  topo.append(extra);
  assert.equal(primarios(topo).length, 2, 'a régua de primários não enxerga um segundo primário');
});

test('jornada-topo: com a folha aberta, o topo não disputa o primário', async () => {
  const { raiz } = await subir({ completed: [PRIMEIRA.id], folha: PRIMEIRA.slug });
  const btns = primarios(raiz);
  assert.ok(btns.length <= 1, `${btns.length} primários com a folha aberta`);
  const topo = comClasse(raiz, /^topo$/)[0];
  assert.equal(primarios(topo).length, 0, 'o botão do topo seguiu primário com a folha no ar');
});

test('jornada-topo: carregarIndice devolve null quando o índice não vem', async () => {
  const falha = await carregarIndice(async () => { throw new Error('sem rede'); });
  assert.equal(falha.ok, false);
  assert.equal(falha.erro, 'sem-rede');
  const doc = criarDoc();
  const topo = desenharTopo({
    catalogo: CATALOGO, progresso: { completed: [] }, resumo: { concluidas: 0 },
    estudo: vazio(), indice: null, aulas: null, embarqueAberto: false
  }, doc);
  const medida = porTag(topo, 'p').find((p) => p.className.includes('topo-medida'));
  assert.equal(medida.textContent, J.topo.medidaSemAulas(CATALOGO.length, 'UBL'));
  assert.equal(/\d{3,}/.test(medida.textContent.replace(String(CATALOGO.length), '')), false,
    'sem índice a tela inventou uma contagem de aulas');
});

// ═══════════════ S20a-3: os TRÊS casos da chave ═══════════════
// O achado, em uma linha: quem entra pelo embarque, marca uma estação e
// recarrega não tem `ultima` no aparelho — e a chave de dois casos desenhava a
// J1 para ele, oferecendo «Começar pela primeira aula» DA ESTAÇÃO QUE A PRÓPRIA
// TELA ACABAVA DE MARCAR COMO CONCLUÍDA, com a lateral dizendo «Sua próxima
// estação: <outra>». A trava antiga não via nada disso porque os dois storage
// dublês do arquivo só sabiam de `ultima` ou de nada.
//
// O que é cobrado abaixo, uma linha por caso, e o texto do primário SEMPRE saindo
// de core/textos.js (regra 9): se a frase mudar no catálogo, o teste acompanha;
// se a frase for pregada no teste, ele passa a mentir junto com a tela.

const progressoCom = (ids) => ({
  versao: 1, completed: ids.slice(), emCurso: [], conclusoes: {},
  iniciadas: {}, baldeacoes: [], revisoes: []
});

test('S20a-3 · a chave tem três casos, e cada um tem frase própria vinda de textos.js', () => {
  const comToque = alvoDoTopo(CATALOGO, { ultima: { estacao: PRIMEIRA.id, aula: AULA_3.id, n: 3 } },
    resumoDaViagem(progressoCom([]), CATALOGO), progressoCom([]));
  const semToque = alvoDoTopo(CATALOGO, vazio(),
    resumoDaViagem(progressoCom([PRIMEIRA.id]), CATALOGO), progressoCom([PRIMEIRA.id]));
  const nada = alvoDoTopo(CATALOGO, vazio(), resumoDaViagem(progressoCom([]), CATALOGO), progressoCom([]));

  assert.equal(comToque.modo, 'volta', 'quem abriu aula no aparelho perdeu a volta');
  assert.equal(semToque.modo, 'proxima', 'quem marcou sem abrir aula caiu na primeira visita');
  assert.equal(nada.modo, 'primeira', 'a primeira visita deixou de ser a primeira visita');
  assert.deepEqual([comToque.curso.id, semToque.curso.id, nada.curso.id],
    [PRIMEIRA.id, resumoDaViagem(progressoCom([PRIMEIRA.id]), CATALOGO).proximaEstacao.id, PRIMEIRA.id],
    'alguém apontou para a estação errada');

  // As três frases, uma por caso, todas do catálogo de textos.
  const tela = (alvo) => textoDe(desenharTopo({
    alvo, catalogo: CATALOGO, progresso: { completed: [] }, resumo: {},
    estudo: vazio(), indice: INDICE, aulas: AULAS_PRIMEIRA.aulas, embarqueAberto: false
  }, criarDoc()));
  const tCom = tela(comToque), tSem = tela(semToque), tNada = tela(nada);
  assert.equal(tCom.includes(AU.continuar(3, AULA_3.titulo)), true,
    `a volta com aula não disse «${AU.continuar(3, AULA_3.titulo)}»: ${tCom}`);
  assert.equal(tSem.includes(J.topo.comecarEstacao(semToque.curso.title)), true,
    `a volta sem aula não disse «${J.topo.comecarEstacao(semToque.curso.title)}»: ${tSem}`);
  assert.equal(tNada.includes(J.topo.comecar), true,
    `a primeira visita não disse «${J.topo.comecar}»: ${tNada}`);
  // As três frases têm de ser TRÊS frases. Se uma for a outra, a tela está
  // mentindo para alguém — e é exatamente assim que o defeito 4 entrou.
  assert.equal(new Set([AU.continuar(3, AULA_3.titulo), J.topo.comecarEstacao('X'), J.topo.comecar]).size, 3,
    'duas das três situações da chave compartilham frase');
});

test('S20a-3 · fonte única: o alvo da volta sem aula É o proximaEstacao do resumo', () => {
  const progresso = progressoCom([PRIMEIRA.id]);
  const resumo = resumoDaViagem(progresso, CATALOGO);
  const alvo = alvoDoTopo(CATALOGO, vazio(), resumo, progresso);
  assert.equal(alvo.curso.id, resumo.proximaEstacao.id,
    'o topo refez a conta de «próxima» em vez de ler a da placa — duas próximas na tela');
  assert.equal(alvo.n, 1, 'a volta sem aula não começa pela primeira aula da estação');
  assert.equal(alvo.idAula, null, 'inventou uma aula gravada que o aparelho nunca teve');
});

test('S20a-3 · O CAMINHO DO ACHADO: embarque → marcar Circuitos → recarregar, e o primário não é a Aula 1 dela', async () => {
  // O storage do aparelho fica VAZIO de estudo — é o que o fluxo do app faz:
  // ninguém abre aula ao marcar. `completed` vem pelo `loadCompleted` dublê, que
  // é como a fatia inteira deste arquivo já serve o progresso.
  const { raiz } = await subir({ completed: [PRIMEIRA.id] });
  const resumo = resumoDaViagem(progressoCom([PRIMEIRA.id]), CATALOGO);
  const proxima = CATALOGO.find((c) => c.id === resumo.proximaEstacao.id);
  const btns = primarios(raiz);
  assert.equal(btns.length, 1, `${btns.length} primários na volta sem aula`);
  assert.equal(btns[0].textContent, J.topo.comecarEstacao(proxima.title),
    `a tela oferece «${btns[0].textContent}» para quem acabou de marcar ${PRIMEIRA.title}`);
  assert.equal(btns[0].getAttribute('href'), `#/estacao/${proxima.slug}/aula/1`,
    `o primário não leva à primeira aula da próxima estação: ${btns[0].getAttribute('href')}`);

  // A proibição, dita pelo nome: NUNCA a Aula 1 da estação concluída.
  assert.equal(new RegExp(`#\\/estacao\\/${PRIMEIRA.slug}\\/aula\\/1$`).test(btns[0].getAttribute('href')), false,
    'o topo oferece a Aula 1 da estação que a tela acabou de marcar como concluída');

  // A lateral e o topo têm de dizer a MESMA estação, com o MESMO nome.
  const placa = comClasse(raiz, /^placa-nome$/)[0];
  assert.equal(placa.textContent, resumo.proximaEstacao.titulo,
    'a placa e o topo nomearam estações diferentes na mesma tela');

  // Um só alvo recheado, e o discurso da primeira visita sumiu da tela.
  const cheios = todos(raiz, (n) => {
    const cls = String(n.className || '').split(/\s+/);
    return cls.includes('botao-primario') || (cls.includes('placa-acao') && !/\bcom-topo-primario\b/.test(raiz.className));
  });
  assert.equal(cheios.length, 1, `${cheios.length} alvos recheados na volta sem aula`);
  assert.equal(textoDe(raiz).includes(J.topo.comecar), false,
    '«Começar pela primeira aula» continua na tela de quem já percorreu uma estação');

  // O «Já estudei algumas disciplinas» fica, e o h1/medida ficam (item 1 do pedido).
  assert.ok(comClasse(raiz, /^topo-marcar$/).length === 1, 'a porta do embarque sumiu da volta');
  assert.match(textoDe(comClasse(raiz, /^topo$/)[0]), /disciplinas da/);
});

test('S20a-3 · a placa diz «Ver a estação» e continua secundária, com o topo na tela', async () => {
  const { raiz } = await subir({ completed: [PRIMEIRA.id] });
  const acoes = comClasse(raiz, /^placa-acao$/);
  assert.equal(acoes.length, 1, 'a placa voltou a ter duas ações');
  assert.equal(acoes[0].textContent, 'Ver a estação');
  assert.equal(String(acoes[0].className).includes('botao-primario'), false,
    'a placa recebeu o recheio do primário: dois caminhos na mesma tela');
  assert.match(raiz.className, /\bcom-topo-primario\b/,
    'com o topo apontando, a raiz não declarou quem tem o recheio');
});

test('S20a-3 · terminal: viagem inteira concluída sem toque não recebe a Aula 1 da primeira estação', () => {
  const todas = CATALOGO.map((c) => c.id);
  const resumo = resumoDaViagem(progressoCom(todas), CATALOGO);
  const alvo = alvoDoTopo(CATALOGO, vazio(), resumo, progressoCom(todas));
  assert.equal(resumo.terminal, true, 'o catálogo não fecha a viagem toda: rever este caso');
  assert.equal(alvo.modo, 'terminal');
  assert.equal(alvo.curso, null, 'a rede inteira concluída apontou para uma estação');
  const doc = criarDoc();
  const topo = desenharTopo({
    alvo, catalogo: CATALOGO, progresso: progressoCom(todas), resumo,
    estudo: vazio(), indice: INDICE, aulas: null, embarqueAberto: false
  }, doc);
  assert.equal(primarios(topo).length, 0, 'o topo ofereceu um caminho que não existe mais');
});
