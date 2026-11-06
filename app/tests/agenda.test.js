// Projeto Atlas — S19b, marcar a próxima sessão no calendário (design J5, item 3).
//
// POR QUE EXISTE: o desenho pede um lembrete sem servidor, sem conta e sem
// notificação — no fim de cada sessão, a pessoa gera um `.ics` com o dia e a hora
// que ELA escolhe. Duas coisas este arquivo veio impedir, e as duas são mudas:
//
// 1. **O arquivo recusado em silêncio.** Um `.ics` com LF no lugar de CRLF, sem
//    `VERSION` ou com `DTSTART` no formato ISO dá ZERO erro na tela: o calendário
//    simplesmente não cria o evento, e quem apertou o botão conclui que o Atlas
//    não funciona. Por isso a trava lê BYTES, não um objeto interpretado.
// 2. **O link órfão.** O convite existe no fim de duas sessões (a aula estudada
//    e o fim da revisão). Uma tela que esqueça o bloco não quebra nada — só para
//    de oferecer, e o J5 item 3 some devagar. Por isso os casos de tela dirigem o
//    `montar()` pelo caminho do app, com rota e storage reais.
//
// O DUBLÊ FOI CONFERIDO ANTES de escrever (a lição de tests/fechamento.test.js,
// que morreu 13 casos inventando um `doc.body` que o hdom não tem). O que este
// arquivo acrescenta ao dublê da casa, em `janelaDaAgenda`: `location.href`,
// `Blob`, `URL.createObjectURL/revokeObjectURL` e `a.click()` — as quatro peças
// do caminho de download, que `core/dados-pessoa.js` já usava no JSON do backup e
// nenhum dublê da casa exercitava. Sem elas, `baixarArquivo` devolveria `false`
// para um navegador perfeitamente capaz, e a tela mentiria «não deu para baixar».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOME_ARQUIVO, icsDaSessao } from '../core/agenda.js';
import { agenda as A } from '../core/textos.js';
import { baixarArquivo } from '../core/dados-pessoa.js';
import { CARTOES_KEY, criarCartao, lerCartoes, serializarCartoes } from '../core/cartoes.js';
import { ESTUDO_KEY, abrirAula, estudarAula, serializarEstudo } from '../core/estudo.js';
import { blocoDaAgenda } from '../web/agenda-marcar.js';
import { criarDoc, esperar, storageCom, todos } from './hdom.js';

const HOJE = '2026-11-06';
const CATALOGO_BRUTO = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CATALOGO = { courses: CATALOGO_BRUTO.courses || CATALOGO_BRUTO };
const CIRCUITOS = CATALOGO.courses.find((c) => c.slug === 'circuitos-digitais');

const comClasse = (raiz, classe) => todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));
const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/\s+/g, ' ').trim();

/**
 * A janela do caminho de download. `Blob` só faz o par (bytes, tipo) — o que a
 * régua mede é o que a tela passou para ele, e o `a.click()` é o que faz o
 * navegador baixar. `_baixados` guarda cada arquivo que saiu, na ordem.
 */
function janelaDaAgenda({ comDownload = true } = {}) {
  const baixados = [];
  // `createObjectURL` devolve um endereço e o Blob fica do outro lado; no
  // navegador é assim que o arquivo existe. Guardar o par (endereço → Blob) é o
  // que deixa a régua ler o TEXTO que baixou em vez do nome do botão.
  const objetos = new Map();
  let seq = 0;
  const doc = criarDoc();
  const win = {
    location: { href: 'https://atlas.example/#/estacao/circuitos-digitais/aula/3' },
    localStorage: storageCom(),
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    document: { visibilityState: 'visible' },
    navigator: { storage: { persist: () => Promise.resolve(true) } },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    Blob: comDownload ? class { constructor(partes, ops) { this.partes = partes; this.type = ops?.type; } } : undefined,
    URL: comDownload
      ? {
        createObjectURL: (blob) => { objetos.set(`blob:fake-${++seq}`, blob); return `blob:fake-${seq}`; },
        revokeObjectURL: () => {}
      }
      : undefined,
    _baixados: baixados
  };
  // O `<a>` do download precisa de `click()` no dublê: `criarNo` não tem o
  // método (o app nunca clicou um link antes), e sem ele `baixarArquivo` jogaria
  // TypeError num caminho que no navegador funciona. É a régua `leitor 6` da
  // casa, outra vez: o dublê mente menos, a tela é conferida intacta.
  const criar = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const no = criar(tag);
    if (tag === 'a') no.click = () => { no._clicado = true; baixados.push(no); };
    return no;
  };
  return { doc, win, objetos };
}

/**
 * O texto do arquivo que saiu do toque. `baixarArquivo` escreve `a.href` e
 * `a.download` como PROPRIEDADES (é assim que o DOM real funciona), então é
 * daqui que se lê — pedir `getAttribute('download')` mediria o dublê e diria
 * que a tela não pôs nome nenhum no arquivo.
 */
function textoBaixado(no, objetos) {
  return objetos.get(no.href)?.partes?.[0] ?? '';
}

// ── o núcleo: o texto do arquivo ────────────────────────────────────────────
test('o texto é um VCALENDAR de CRLF, com os campos obrigatórios e a hora local', () => {
  const texto = icsDaSessao({
    dia: '2026-11-07',
    hora: '19:00',
    titulo: 'Estudar no Atlas',
    url: 'https://atlas.example/#/revisar',
    agora: new Date(Date.UTC(2026, 10, 6, 8, 32, 57))
  });
  assert.ok(texto, 'icsDaSessao devolveu null para uma hora válida');

  // CRLF em TODO fim de linha. LF puro é recusado por parser estrito sem aviso.
  assert.ok(/\r\n/.test(texto), 'o arquivo não tem CRLF nenhum');
  // A ÚLTIMA parte do split é o que vem depois do CRLF final — vazia, e não é
  // linha: contá-la como linha sem CR reprovaria um arquivo perfeito. Um LF
  // SOLTO no meio cria uma parte não-vazia sem CR, e é isso que a régua procura.
  const soltas = texto.split('\n').slice(0, -1).filter((l) => !l.endsWith('\r'));
  assert.equal(soltas.length, 0, `LF sem CR antes: ${JSON.stringify(soltas[0])}`);
  assert.ok(texto.endsWith('\r\n'), 'o arquivo precisa terminar em CRLF (§3.1)');

  for (const chave of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Atlas//PT-BR',
    'BEGIN:VEVENT', 'UID:', 'DTSTAMP:', 'DTSTART:', 'DURATION:', 'SUMMARY:', 'URL:',
    'END:VEVENT', 'END:VCALENDAR']) {
    assert.ok(texto.includes(chave), `faltou ${chave} no arquivo`);
  }

  // A hora LOCAL sem fuso: quem marca 19:00 quer 19:00 no calendário dela
  // (regra 13 de core/cartoes.js). O `Z` deslocaria o evento e ninguém faria nada.
  assert.match(texto, /^DTSTART:20261107T190000$/m, 'o DTSTART não saiu em hora local compacta');
  assert.ok(!/^DTSTART:.*Z$/m.test(texto), 'DTSTART em UTC: o lembrete chegaria em outra hora');
  assert.match(texto, /^DTSTAMP:20261106T083257Z$/m, 'DTSTAMP precisa ser UTC com Z (§3.3.5)');
  assert.match(texto, /^DURATION:PT30M$/m);
  assert.match(texto, /^SUMMARY:Estudar no Atlas$/m);
  assert.match(texto, /^URL:https:\/\/atlas\.example\/#\/revisar$/m);
  assert.match(texto, /^UID:atlas-20261107T190000[^\s]*$/m, 'UID amarrado ao dia, à hora e ao instante');
});

test('a mesma hora no mesmo instante dá o mesmo UID, e outra hora dá outro', () => {
  const agora = new Date(Date.UTC(2026, 10, 6, 8, 0, 0));
  const base = { titulo: 'Estudar no Atlas', agora };
  const um = icsDaSessao({ ...base, dia: '2026-11-07', hora: '19:00' });
  const outro = icsDaSessao({ ...base, dia: '2026-11-07', hora: '19:00' });
  const mudado = icsDaSessao({ ...base, dia: '2026-11-07', hora: '20:00' });
  const uid = (t) => /^UID:(.*)$/m.exec(t)[1];
  assert.equal(uid(um), uid(outro), 'reimportar o mesmo arquivo duplicaria o evento');
  assert.notEqual(uid(um), uid(mudado), 'mudar a hora precisa gerar evento novo');
});

test('dia ou hora inválidos devolvem null, e nada é baixado', () => {
  const base = { titulo: 'Estudar no Atlas', agora: new Date(0) };
  for (const dado of [
    { dia: '', hora: '19:00' },
    { dia: '2026-11-7', hora: '19:00' },        // sem o zero: o input não entrega assim
    { dia: '07/11/2026', hora: '19:00' },
    { dia: '2026-11-07', hora: '' },
    { dia: '2026-11-07', hora: '19' },
    { dia: '2026-11-07', hora: '24:00' },
    { dia: '2026-11-07', hora: '19:60' },
    { dia: '2026-11-07', hora: '7:30' }
  ]) {
    assert.equal(icsDaSessao({ ...base, ...dado }), null,
      `aceitou ${JSON.stringify(dado)}: um .ics meia-lua marca um dia que a pessoa não escolheu`);
  }
});

test('ponto e vírgula, vírgula e barra invertida saem escapados no SUMMARY', () => {
  const texto = icsDaSessao({
    dia: '2026-11-07',
    hora: '19:00',
    titulo: 'Aula 3; Aula 4, linha \\\\6',
    agora: new Date(0)
  });
  const linha = /^SUMMARY:(.*)$/m.exec(texto)[1];
  assert.match(linha, /Aula 3\\; Aula 4\\,/);
  assert.match(linha, /linha \\\\\\\\6/, 'a barra invertida precisa vir dobrada');
  assert.ok(!/^SUMMARY:[^\\];/m.test(texto), 'um ; cru no SUMMARY termina o valor e o resto vira chave');
});

test('uma quebra de linha no título não atravessa o arquivo', () => {
  const texto = icsDaSessao({ dia: '2026-11-07', hora: '19:00', titulo: 'duas\nlinhas', agora: new Date(0) });
  assert.match(texto, /^SUMMARY:duas\\nlinhas$/m, 'a quebra precisou virar o \\n da RFC, não uma linha nova');
  // O envelope tem 13 linhas e é sempre 13: um título que abrisse linha faria o
  // parser ler «linhas» como chave de uma propriedade que ninguém declarou.
  assert.equal(texto.split('\r\n').filter(Boolean).length, 13,
    `o título mudou o número de linhas do VEVENT: ${JSON.stringify(texto)}`);
});

test('título longo dobra em 75 octetos, sem cortar a linha do calendário', () => {
  const texto = icsDaSessao({ dia: '2026-11-07', hora: '19:00', titulo: 'Estudar no Atlas '.repeat(8), agora: new Date(0) });
  for (const linha of texto.split('\r\n')) {
    assert.ok(new TextEncoder().encode(linha).length <= 75, `linha de ${new TextEncoder().encode(linha).length} octetos: parser estrito recusa`);
  }
});

test('sem URL não sai linha URL vazia', () => {
  const texto = icsDaSessao({ dia: '2026-11-07', hora: '19:00', agora: new Date(0) });
  assert.ok(!/^URL:/m.test(texto), 'URL: vazio é recusado por parser estrito');
});

// ── o caminho de download, emprestado do backup ─────────────────────────────
test('o download é um só caminho: o .ics sai com o nome e o tipo do calendário', () => {
  const { doc, win, objetos } = janelaDaAgenda();
  const texto = icsDaSessao({ dia: '2026-11-07', hora: '19:00', titulo: A.titulo, url: win.location.href, agora: new Date(0) });
  const feito = baixarArquivo({ doc, win, nome: NOME_ARQUIVO, texto, tipo: 'text/calendar' });
  assert.equal(feito, true, 'o navegador tinha Blob e URL e ainda assim baixou nada');
  assert.equal(win._baixados.length, 1);
  const no = win._baixados[0];
  assert.equal(no.download, 'atlas-proxima-sessao.ics');
  assert.equal(objetos.get(no.href).type, 'text/calendar', 'saiu como octeto: o calendário não abre');
  assert.match(textoBaixado(no, objetos), /^BEGIN:VCALENDAR/);
});

test('sem Blob o caminho devolve false, e não estoura', () => {
  const { doc, win } = janelaDaAgenda({ comDownload: false });
  assert.equal(baixarArquivo({ doc, win, nome: NOME_ARQUIVO, texto: 'x', tipo: 'text/calendar' }), false);
});

// ── o bloco, sozinho ────────────────────────────────────────────────────────
test('o bloco nasce como um link discreto e vira dois campos ao toque', () => {
  const { doc, win } = janelaDaAgenda();
  const raiz = blocoDaAgenda(doc, win, { hoje: HOJE, url: win.location.href });
  assert.equal(comClasse(raiz, 'agenda-abrir').length, 1, 'o convite não nasceu como link');
  assert.equal(textoDo(raiz), A.abrir);
  assert.equal(comClasse(raiz, 'agenda-baixar').length, 0, 'o bloco já nasceu aberto');

  comClasse(raiz, 'agenda-abrir')[0].dispatch('click', { preventDefault() {} });
  const campos = comClasse(raiz, 'agenda-entrada');
  assert.equal(campos.length, 2, 'aberto, o bloco precisa de dia e hora');
  assert.equal(campos[0].getAttribute('type'), 'date');
  assert.equal(campos[1].getAttribute('type'), 'time');
  assert.equal(campos[0].value, '2026-11-07', 'o padrão é AMANHÃ, não hoje');
  assert.equal(campos[1].value, '19:00');
  // Cada campo com `<label for>` do próprio nó: rótulo órfão é o que a régua
  // `leitor 6` da casa nomeia, e a folha de estilo do rótulo não conserta o leitor.
  for (const [i, rotulo] of [[0, A.dia], [1, A.hora]]) {
    const etiqueta = comClasse(raiz, 'agenda-rotulo')[i];
    assert.equal(textoDo(etiqueta), rotulo);
    assert.equal(etiqueta.htmlFor, campos[i].getAttribute('id'), `o rótulo "${rotulo}" não aponta para o campo`);
  }
  assert.equal(comClasse(raiz, 'agenda-baixar').length, 1);
});

test('baixar pelo bloco escreve o arquivo certo, e a frase de pronto aparece', () => {
  const { doc, win, objetos } = janelaDaAgenda();
  const raiz = blocoDaAgenda(doc, win, { hoje: HOJE, url: win.location.href });
  comClasse(raiz, 'agenda-abrir')[0].dispatch('click', { preventDefault() {} });
  comClasse(raiz, 'agenda-baixar')[0].dispatch('click', { preventDefault() {} });
  assert.equal(win._baixados.length, 1, 'um toque em baixar não baixou nada');
  const texto = textoBaixado(win._baixados[0], objetos);
  assert.match(texto, /^DTSTART:20261107T190000$/m);
  assert.match(texto, /^SUMMARY:Estudar no Atlas$/m);
  assert.match(texto, /^URL:https:\/\/atlas\.example\/#\//m);
  assert.match(textoDo(raiz), new RegExp(A.pronto), 'baixou sem dizer nada: a pessoa não sabe que abriu o arquivo');
});

test('dia limpado nos campos não baixa arquivo nenhum, e devolve o campo em falta', () => {
  const { doc, win } = janelaDaAgenda();
  const raiz = blocoDaAgenda(doc, win, { hoje: HOJE });
  comClasse(raiz, 'agenda-abrir')[0].dispatch('click', { preventDefault() {} });
  comClasse(raiz, 'agenda-entrada')[0].value = '';
  comClasse(raiz, 'agenda-baixar')[0].dispatch('click', { preventDefault() {} });
  assert.equal(win._baixados.length, 0, 'baixou um .ics sem dia');
  // A frase que sai é a de DEFESA (`null` do núcleo), nunca a de navegador: dizer
  // «este navegador não deixou» quando foi a pessoa que não disse o dia é mentir
  // sobre a máquina e mandar instalar outra.
  assert.ok(!textoDo(raiz).includes(A.semDownload), 'a tela culpou o navegador pelo campo vazio');
  assert.equal(doc.foco, comClasse(raiz, 'agenda-entrada')[0],
    'o teclado não voltou ao campo em falta: a pessoa teria de procurá-lo');
});

test('o bloco de outro navegador avisa, e não some mudo', () => {
  const { doc, win } = janelaDaAgenda({ comDownload: false });
  const raiz = blocoDaAgenda(doc, win, { hoje: HOJE });
  comClasse(raiz, 'agenda-abrir')[0].dispatch('click', { preventDefault() {} });
  comClasse(raiz, 'agenda-baixar')[0].dispatch('click', { preventDefault() {} });
  assert.match(textoDo(raiz), new RegExp(A.semDownload));
});

// ── as duas telas, pelo caminho do app ──────────────────────────────────────
// AS CENAS SÃO MONTADAS COMO A CASA JÁ MONTA (tests/fechamento.test.js:89 e
// tests/revisar-fila.test.js:71): o `montar()` chamado com o ctx QUE O CASCO
// PASSA — `folha`/`n`/`buscarAulas` na aula, `storage`/`modulos`/`hoje`/`catalogo`
// como promessa na revisão. A primeira versão destes dois casos inventou um ctx
// (`rota`, catálogo pronto, estação `'1245624862'`) e as telas desenharam o estado
// de vazio: a régua diria «a aula não oferece a agenda» quando era o teste que não
// sabia chegar à aula. Se a cena precisar de um campo novo, é o ctx do casco que
// mudou, e a régua tem de cair junto com ele — por isso ela é copiada de lá.
const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const TERCEIRA = AULAS.aulas.find((a) => Number(a.n) === 3);

/** Relógio congelado em 06/11/2026 09:30 local: `agoraLocal(win)` lê `win.Date`, e
 *  sem congelar a conta de amanhã mudaria com a hora em que a suíte roda. */
class DataFalsa extends Date {
  constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 10, 6, 11, 30)])); }
  static now() { return Date.UTC(2026, 10, 6, 11, 30); }
}

/** A aula estudada: o armazenamento de quem FECHOU a aula 3, escrito pelo core. */
async function aulaEstudada() {
  const { doc, win, objetos } = janelaDaAgenda();
  win.Date = DataFalsa;
  let estudo = abrirAula({}, { estacao: CIRCUITOS.id, aula: TERCEIRA.id, n: 3 }, `${HOJE}T09:00`);
  estudo = estudarAula(estudo, { estacao: CIRCUITOS.id, aula: TERCEIRA.id, n: 3 }, `${HOJE}T09:40`,
    { recordacao: 'A menor unidade.' });
  win.localStorage.setItem(ESTUDO_KEY, serializarEstudo(estudo));
  // Dois cartões devidos AMANHÃ: é isso que enche a conta de amanhã, e ela
  // precisa existir na tela para a régua conferir que o convite vem depois dela.
  let arquivo = { versao: 1, cartoes: {} };
  const pares = [['O que é um bit?', 'A menor unidade.'], ['Para que serve a RAM?', 'Guarda o que está em uso.']];
  for (const [n, [frente, verso]] of pares.map((p, i) => [i + 1, p])) {
    const r = criarCartao(arquivo, { estacao: CIRCUITOS.id, aula: TERCEIRA.id, n: 3, frente, verso }, `${HOJE}T09:45`, `c${n}`);
    assert.equal(r.ok, true, `a cena recusou o cartão: ${r.erro}`);
    arquivo = { versao: 1, cartoes: r.cartoes };
  }
  win.localStorage.setItem(CARTOES_KEY, serializarCartoes(arquivo));

  const { montar } = await import('../web/telas/aula.js');
  const raiz = doc.createElement('div');
  const inst = await montar(raiz, {
    document: doc,
    window: win,
    catalogo: Promise.resolve(CATALOGO),
    folha: CIRCUITOS.slug,
    n: 3,
    buscarAulas: async () => ({ ok: true, status: 200, json: async () => AULAS })
  });
  await esperar();
  return { raiz, doc, win, objetos, inst };
}

test('a aula estudada oferece a agenda depois do aviso, e o primário continua um só', async () => {
  const { raiz, win, objetos } = await aulaEstudada();
  const abrir = comClasse(raiz, 'agenda-abrir');
  assert.equal(abrir.length, 1, 'a conclusão da aula não oferece marcar a próxima sessão');
  assert.equal(textoDo(abrir[0]), A.abrir);
  assert.ok(!comClasse(raiz, 'agenda-baixar').length, 'a agenda abriu sozinha');

  // O LUGAR na tela, medido na ÁRVORE e não por busca de texto: a frase da conta
  // de amanhã é «Amanhã: N cartões, M min.» e a régua antiga casava com qualquer
  // «Amanhã» do documento. São os filhos da conclusão, e o convite é o último
  // deles — depois do primário e depois da conta, empurrando nada.
  const caixa = comClasse(raiz, 'fechamento-feito')[0];
  assert.ok(caixa, 'a cena não chegou na conclusão da aula');
  const nomes = caixa.children.map((n) => (n.className || '').split(/\s+/)[0]);
  const posConvite = nomes.indexOf('agenda');
  const posAviso = nomes.indexOf('fechamento-por-hoje');
  const posPrimario = caixa.children.findIndex((n) => (n.className || '').includes('botao-primario'));
  assert.ok(posAviso >= 0, `a conta de amanhã não está na conclusão: ${nomes.join(' / ')}`);
  assert.ok(posConvite > posAviso, `o convite veio antes da conta de amanhã: ${nomes.join(' / ')}`);
  assert.equal(posConvite, caixa.children.length - 1, 'o convite não é o último nó da conclusão');
  assert.ok(posPrimario >= 0 && posPrimario < posConvite, 'o convite deslocou o primário');

  // UM primário na tela inteira (regra da casa). O bloco é um `<a>`, e o botão
  // dele é secundário — nada aqui acrescenta peso nenhum.
  assert.equal(comClasse(raiz, 'botao-primario').length, 1,
    `a aula estudada tem ${comClasse(raiz, 'botao-primario').length} primários`);

  // E funciona ALI DENTRO: o toque que a tela da aula entrega é o mesmo bloco,
  // com o mesmo núcleo e o mesmo caminho de download.
  abrir[0].dispatch('click', { target: abrir[0], preventDefault() {} });
  comClasse(raiz, 'agenda-entrada')[1].value = '07:30';
  comClasse(raiz, 'agenda-baixar')[0].dispatch('click', { preventDefault() {} });
  assert.equal(win._baixados.length, 1, 'o toque dentro da tela da aula não baixou nada');
  assert.match(textoBaixado(win._baixados[0], objetos), /^DTSTART:20261107T073000$/m,
    'a hora escolhida na tela não chegou ao arquivo');
  assert.match(textoBaixado(win._baixados[0], objetos), /^URL:https:\/\/atlas\.example\/#\//m,
    'o evento do calendário não leva de volta ao Atlas');
});

/** Dois cartões devidos hoje, escritos pelo core (criarCartao exige o id, e o
 *  arquivo é `{ versao, cartoes }`, não o `{ ok, cartoes }` que ele devolve — a
 *  primeira versão desta cena passou as duas coisas erradas e subiu uma aba sem
 *  fila nenhuma). Criados há dois dias, `devidoEm` fica ontem: estão devidos. */
function doisDevidos() {
  let arquivo = { versao: 1, cartoes: {} };
  const pares = [['O que é um bit?', 'A menor unidade.'], ['Para que serve a RAM?', 'Guarda o que está em uso.']];
  for (const [n, [frente, verso]] of pares.map((p, i) => [i + 1, p])) {
    const r = criarCartao(arquivo, {
      estacao: CIRCUITOS.id,
      aula: `aula-${n}`,
      n,
      frente,
      verso
    }, '2026-11-04T09:00', `c${n}`);
    assert.equal(r.ok, true, `a cena recusou o cartão: ${r.erro}`);
    arquivo = { versao: 1, cartoes: r.cartoes };
  }
  return serializarCartoes(arquivo);
}

/** O FIM da revisão, dirigido: abrir → começar → (mostrar → lembrar) ×2. Sem
 *  atalho: o bloco só existe no estado que a sessão alcança de verdade, e
 *  montá-lo à mão provaria o desenho, não a tela. */
async function sessaoRevisada() {
  const { doc, win } = janelaDaAgenda();
  win.localStorage.setItem(CARTOES_KEY, doisDevidos());
  const { montar } = await import('../web/telas/revisar.js');
  const raiz = doc.createElement('div');
  const storage = win.localStorage;
  const inst = await montar(raiz, {
    document: doc,
    window: win,
    storage,
    modulos: { loadCompleted: () => [], loadNotas: () => ({}), saveNotas: () => true, aplicarNota: (s) => s },
    hoje: HOJE,
    catalogo: Promise.resolve(CATALOGO)
  });
  await esperar();
  const tocar = (classe, texto) => {
    const alvos = comClasse(raiz, classe);
    const alvo = texto ? alvos.find((n) => textoDo(n) === texto) : alvos[0];
    assert.ok(alvo, `a tela não tem .${classe}${texto ? ` «${texto}»` : ''} — estados: ${raiz.children.map((n) => n.className).join(' | ')}`);
    alvo.dispatch('click', { target: alvo, preventDefault() {} });
  };
  // O estado lido da CLASSE DA RAIZ (mesma régua de tests/revisar-fila.test.js):
  // se a sessão não chegou ao fim, o resto da cena é ruído.
  assert.match(raiz.children[0]?.className || '', /revisar-abertura/, 'a cena não abriu na fila');
  tocar('revisar-primario');                                       // Começar
  for (let i = 0; i < 2; i++) {
    tocar('revisar-primario', 'Mostrar a resposta');
    tocar('revisar-resposta', 'Lembrei');
  }
  await esperar();
  return { raiz, doc, win, inst };
}

test('o fim da revisão oferece a agenda antes de Voltar à Jornada', async () => {
  const { raiz } = await sessaoRevisada();
  assert.match(raiz.children[0]?.className || '', /revisar-fim/,
    `a sessão não chegou ao fim: ${raiz.children.map((n) => n.className).join(' | ')}`);
  const abrir = comClasse(raiz, 'agenda-abrir');
  assert.equal(abrir.length, 1, 'o fim da revisão não oferece marcar a próxima sessão');
  assert.equal(textoDo(abrir[0]), A.abrir);

  // O convite vem ANTES da saída, medido na árvore da caixa do fim: o link de
  // «Voltar à Jornada» continua o último nó, e o único primário da tela.
  const caixa = comClasse(raiz, 'revisar-estado')[0];
  const nomes = caixa.children.map((n) => (n.className || '').split(/\s+/).includes('agenda') ? 'agenda' : 'n');
  const posConvite = nomes.indexOf('agenda');
  assert.ok(posConvite >= 0 && posConvite === caixa.children.length - 2,
    `o convite não é o penúltimo nó do fim: ${nomes.join(' / ')}`);
  assert.equal(comClasse(raiz, 'revisar-primario').length, 1, 'a agenda virou um segundo primário');
  assert.equal(comClasse(raiz, 'agenda-baixar').length, 0, 'a agenda abriu sozinha');
});

test('o módulo da agenda está no cache e a folha dá o alvo de toque', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const modulo of ['core/agenda.js', 'web/agenda-marcar.js']) {
    assert.ok(sw.includes(`'${modulo}'`), `${modulo} fora do PRECACHE: no ônibus sem rede a aula abre em branco`);
  }
  const css = readFileSync(new URL('../web/base.css', import.meta.url), 'utf8');
  for (const seletor of ['agenda-abrir', 'agenda-entrada', 'agenda-baixar']) {
    const bloco = new RegExp(`\\.${seletor}\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(bloco, `.${seletor} sem regra na folha: sai no estilo do navegador`);
    assert.match(bloco[1], /min-height:\s*var\(--alvo-toque\)/, `.${seletor} sem alvo de toque`);
  }
  assert.match(css, /\.agenda-aviso\s*\{[^}]*font-size:\s*var\(--tipo-corpo\)/,
    'a frase de pronto saiu miúda no momento da entrega');
});
