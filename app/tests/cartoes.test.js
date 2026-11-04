// Projeto Atlas — os CARTÕES do fechamento de aula (S14a, 04/11/2026): o núcleo
// sem tela, irmão do estudo.test.js.
//
// Por que este arquivo existe antes de a tela do fechamento existir: o cartão é a
// única coisa que o Atlas novo guarda além de "abri". Se `devidoEm` errar um dia na
// virada do mês, ou se `criarCartao` deixar passar um cartão sem verso, o defeito
// aparece daqui a uma semana, na fila de revisão, na mão de quem já estudou — e
// nowhere no app há como conferir olhando. Aqui o cálculo é cobrado com datas
// reais de calendário, inclusive as três viradas que ninguém testar à mão.
//
// As decisões de core/cartoes.js, uma a uma:
//   · nada muta a entrada (mesma regra do estudo: a tela pinta o que se devolve);
//   · frente e verso são obrigatórios, sem espaços nas pontas, e o erro diz QUAL
//     campo faltou — "cartão inválido" não ajuda quem escreveu 300 caracteres;
//   · `devidoEm` é AMANHÃ no calendário local, e 'aaaa-mm-dd' (dia, não instante);
//   · `fsrs: null` e `historico: []` nascem prontos para a S15, sem a S15 existir;
//   · a fila tem teto (LIMITE_FILA) porque fila sem teto é a forma mais rápida de
//     fazer alguém não abrir o app.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARTOES_KEY, CONFIANCAS, LIMITE_FACE, LIMITE_FILA, lerCartoes, serializarCartoes,
  criarCartao, revisarCartao, resumoDaSessao, cartoesDaAula, cartoesDevidos,
  modelosDeFrente, diaSeguinte, diaDepois
} from '../core/cartoes.js';
import { TEXTOS, fechamento as F, aulas as AU } from '../core/textos.js';

const ESTACAO = 'ubl-core-circuitos-digitais';
const AULA = 'KGoSTh1sgyM';
const ARQUIVO = () => ({ versao: 1, cartoes: {} });

/** `{ ok, cartoes }` -> o mapa de cartões, para as asserções ficarem legíveis. */
const criar = (arq, dados, quando = '2026-11-04T10:30', id = 'c1') => criarCartao(arq.cartoes ?? arq, dados, quando, id);
const aula = (mais = {}) => ({ estacao: ESTACAO, aula: AULA, n: 2, frente: 'O que é XOR?', verso: 'Ou exclusivo', ...mais });

// ── 1. a chave e o formato ─────────────────────────────────────────────────
test('cartoes: a chave do localStorage é a combinada, com versão no nome', () => {
  assert.equal(CARTOES_KEY, 'atlas.cartoes.v1');
});

test('cartoes: texto corrompido, vazio e de outra versão devolvem o arquivo vazio', () => {
  for (const bruto of [
    undefined, null, '', '   ', 42, {}, [],
    '{ não é json', '{"versao":1,"cartoes":{',
    '{"versao":2,"cartoes":{"a":1}}',
    '{"versao":1}',
    '{"cartoes":{}}',
  ]) {
    assert.deepEqual(lerCartoes(bruto), ARQUIVO(), `«${String(bruto)}» devia ler como vazio`);
  }
  assert.deepEqual(Object.keys(lerCartoes('x')).sort(), ['cartoes', 'versao']);
});

test('cartoes: um cartão fora da forma cai fora, e os bons passam', () => {
  const bruto = JSON.stringify({
    versao: 1,
    cartoes: {
      bom: { id: 'bom', estacao: ESTACAO, aula: AULA, n: 1, frente: 'f', verso: 'v', criadoEm: '2026-11-04T10:00', devidoEm: '2026-11-05', fsrs: null, historico: [] },
      semResposta: { id: 'semResposta', frente: 'f', criadoEm: '2026-11-04T10:00', devidoEm: '2026-11-05' },
      devidoInstante: { id: 'devidoInstante', frente: 'f', verso: 'v', criadoEm: '2026-11-04T10:00', devidoEm: '2026-11-05T08:00' },
      semCriacao: { id: 'semCriacao', frente: 'f', verso: 'v', devidoEm: '2026-11-05' },
      nulo: null,
      corda: 'um cartão',
    },
  });
  const lido = lerCartoes(bruto);
  assert.deepEqual(Object.keys(lido.cartoes), ['bom'], 'só o cartão completo é um cartão');
});

test('cartoes: o round-trip preserva o que a S15 gravar ao lado', () => {
  // Se o lerCartoes de hoje não conhece `fsrs`, serializar depois de ler tem de
  // devolvê-lo do mesmo jeito: perder o agendamento no round-trip seria apagar a
  // fila de revisão de quem estudou, sem ninguém ter pedido.
  const bruto = JSON.stringify({
    versao: 1,
    cartoes: {
      c1: {
        id: 'c1', estacao: ESTACAO, aula: AULA, n: 1, frente: 'f', verso: 'v',
        criadoEm: '2026-11-04T10:00', devidoEm: '2026-11-05',
        fsrs: { estabilidade: 4.2, dificuldade: 5.1, repeticoes: 3, lapsos: 1, ultimaEm: '2026-11-10T09:00' },
        historico: [{ em: '2026-11-10T09:00', nota: 'lembrei', confianca: 'certeza' }],
      },
    },
  });
  const lido = lerCartoes(bruto);
  assert.deepEqual(JSON.parse(serializarCartoes(lido)), JSON.parse(bruto));
  assert.equal(lido.cartoes.c1.fsrs.estabilidade, 4.2);
  assert.equal(lido.cartoes.c1.historico.length, 1);
});

test('cartoes: serializar aceita o arquivo ou o mapa, e devolve texto', () => {
  const r = criar(ARQUIVO(), aula());
  assert.equal(typeof serializarCartoes(r), 'string');
  assert.deepEqual(lerCartoes(serializarCartoes({ cartoes: r.cartoes })).cartoes.c1.id, 'c1');
  assert.deepEqual(lerCartoes(serializarCartoes(ARQUIVO())), ARQUIVO());
});

// ── 2. criarCartao: as recusas, uma por campo ───────────────────────────────
test('criarCartao: com frente e verso, o cartão nasce com o formato do desenho', () => {
  const r = criar(ARQUIVO(), aula());
  assert.equal(r.ok, true);
  assert.deepEqual(r.cartao, {
    id: 'c1', estacao: ESTACAO, aula: AULA, n: 2,
    frente: 'O que é XOR?', verso: 'Ou exclusivo',
    criadoEm: '2026-11-04T10:30', devidoEm: '2026-11-05',
    fsrs: null, historico: [],
  });
  assert.deepEqual(Object.keys(r.cartoes), ['c1']);
});

test('criarCartao: não muta a entrada', () => {
  const arq = criar(ARQUIVO(), aula(), '2026-11-04T10:30', 'c1');
  const congelado = JSON.stringify(arq.cartoes);
  const r = criarCartao(arq.cartoes, aula(), '2026-11-05T09:00', 'c2');
  assert.equal(JSON.stringify(arq.cartoes), congelado, 'a entrada foi mutada');
  assert.equal(Object.keys(r.cartoes).length, 2);
  // NÃO assino que o cartão antigo é outra referência: o mapa é copiado raso, e
  // um cartão já gravado não precisa ser clonado — precisa não ser tocado. O que
  // importa é o JSON de cima: se alguém mutasse um cartão por baixo, ele mudou.
});

test('criarCartao: frente ou verso ausentes não criam cartão, e o erro diz qual faltou', () => {
  // O cartão sem verso é uma dívida impagável: ele volta amanhã, a tela mostra a
  // frente, e não há o que conferir. A revisão vira ansiedade.
  const casos = [
    [{ frente: '' }, 'frente'],
    [{ frente: '   ' }, 'frente'],
    [{ frente: undefined }, 'frente'],
    [{ verso: '' }, 'verso'],
    [{ verso: '   ' }, 'verso'],
    [{ verso: null }, 'verso'],
    [{ frente: '', verso: '' }, 'frente'],
  ];
  for (const [mais, campo] of casos) {
    const r = criar(ARQUIVO(), aula(mais));
    assert.equal(r.ok, false, `«${JSON.stringify(mais)}» criou um cartão`);
    assert.equal(r.campo, campo, `o erro não nomeou o campo (${campo}): ${r.erro}`);
    assert.ok(r.erro.trim(), 'a recusa veio sem frase');
    assert.deepEqual(r.cartoes, undefined, 'a recusa devolveu um arquivo de cartões');
  }
  assert.deepEqual(lerCartoes(serializarCartoes(ARQUIVO())), ARQUIVO(), 'a recusa escreveu alguma coisa');
});

test('criarCartao: 501 caracteres numa face é recusado; 500 passam', () => {
  for (const campo of ['frente', 'verso']) {
    const cheio = aula({ [campo]: 'a'.repeat(LIMITE_FACE) });
    assert.equal(criar(ARQUIVO(), cheio).ok, true, `${LIMITE_FACE} caracteres foi recusado`);
    const estourado = criar(ARQUIVO(), aula({ [campo]: 'a'.repeat(LIMITE_FACE + 1) }));
    assert.equal(estourado.ok, false, `${LIMITE_FACE + 1} caracteres passou`);
    assert.equal(estourado.campo, campo);
    assert.match(estourado.erro, /500 caracteres/);
  }
  // As pontas não contam para o limite: quem digita 500 e dá enter não é recusado
  // por um espaço que a própria tela apagou.
  assert.equal(criar(ARQUIVO(), aula({ verso: `  ${'a'.repeat(LIMITE_FACE)}  ` })).ok, true);
});

test('criarCartao: id repetido não sobrescreve, e id ausente é recusado', () => {
  const um = criar(ARQUIVO(), aula({ frente: 'primeira' }));
  const dois = criarCartao(um.cartoes, aula({ frente: 'segunda' }), '2026-11-05T09:00', 'c1');
  assert.equal(dois.ok, false, 'o mesmo id sobrescreveu um cartão escrito');
  assert.equal(dois.campo, 'id');
  assert.equal(lerCartoes(serializarCartoes(um.cartoes)).cartoes.c1.frente, 'primeira');

  // Chamo criarCartao direto, e não o ajudante: com `id = 'c1'` como parâmetro de
  // valor padrão, passar `undefined` viraria 'c1' e o teste passaria sem medir
  // nada — a armadilha que os testes de data em estudo.test.js já evitam.
  for (const id of ['', '   ', null, undefined]) {
    const r = criarCartao(ARQUIVO().cartoes, aula(), '2026-11-04T10:30', id);
    assert.equal(r.ok, false, `id «${id}» criou um cartão que a revisão não consegue marcar`);
    assert.equal(r.campo, 'id');
  }
});

test('criarCartao: estação, aula e quando são obrigatórios', () => {
  const casos = [
    [{ estacao: '' }, 'estacao'],
    [{ aula: '' }, 'aula'],
    [{ estacao: '  ' }, 'estacao'],
  ];
  for (const [mais, campo] of casos) {
    const r = criar(ARQUIVO(), aula(mais));
    assert.equal(r.ok, false, `«${JSON.stringify(mais)}» criou um cartão sem procedência`);
    assert.equal(r.campo, campo);
  }
  // 'quando' fora da forma: o mesmo contrato de core/estudo.js — data-hora local
  // sem segundos e sem fuso, porque o devidoEm sai dela.
  for (const quando of ['', null, undefined, '2026-11-04', '2026-11-04T10:30:00', '2026-11-04T10:30Z', 'ontem']) {
    // idem: o ajudante tem `quando` com valor padrão, e undefined viraria a data
    // boa. A chamada nua é a que mede a ausência.
    const r = criarCartao(ARQUIVO().cartoes, aula(), quando, 'c1');
    assert.equal(r.ok, false, `«${quando}» virou um cartão datado`);
    assert.equal(r.campo, 'quando');
  }
});

test('criarCartao: n fora da forma não estraga o cartão, mas não vira número', () => {
  // A posição é informação da lista; um cartão com n quebrado ainda é revisável.
  // (A primeira versão disto passou e mentiu: `Number(null)` é 0, e 0 é a posição
  // de uma aula que não existe. O cartão guardava n: 0 achando que não sabia o
  // número — o conserto é no core, não aqui.)
  for (const n of [undefined, null, 'duas', -1, 0, NaN, Infinity, {}, []]) {
    const r = criar(ARQUIVO(), aula({ n }));
    assert.equal(r.ok, true, `n=«${n}» foi recusado`);
    assert.equal(r.cartao.n, null, `n=«${n}» virou ${r.cartao.n}`);
  }
  assert.equal(criar(ARQUIVO(), aula({ n: '3' })).cartao.n, 3, 'n texto de dígito não virou número');
});

// ── 3. devidoEm: amanhã no calendário local, nas três viradas ───────────────
test('criarCartao: devidoEm é o dia seguinte local, inclusive nas viradas', () => {
  // O conjunto que `new Date(iso).getTime() + 86400000` erraria: somar um dia em
  // milissegundos dá o dia errado em fuso com horário de verão, e `toISOString()`
  // joga para UTC quem estuda de madrugada ou às 23h30.
  const casos = [
    ['2026-11-04T10:30', '2026-11-05'],
    ['2026-11-04T23:59', '2026-11-05', 'a virada do DIA, com o fuso no meio'],
    ['2026-11-04T00:00', '2026-11-05', 'a virada do DIA, de madrugada'],
    ['2026-11-30T21:15', '2026-12-01', 'virada de mês'],
    ['2026-01-31T22:00', '2026-02-01', '31 de janeiro'],
    ['2026-12-31T23:30', '2027-01-01', 'virada de ano'],
    ['2026-02-28T20:00', '2026-03-01', '2026 não é bissexto: fevereiro tem 28 dias'],
    ['2028-02-28T20:00', '2028-02-29', '2028 é bissexto: o dia 29 existe'],
  ];
  for (const [quando, esperado, motivo = ''] of casos) {
    const r = criar(ARQUIVO(), aula(), quando);
    assert.equal(r.cartao.devidoEm, esperado, `${quando} -> ${esperado} ${motivo}`);
    assert.match(r.cartao.devidoEm, /^\d{4}-\d{2}-\d{2}$/, 'devidoEm é DIA, não instante');
  }
});

// ── 4. as duas filas ────────────────────────────────────────────────────────
test('cartoesDaAula: os cartões de uma aula, na ordem em que foram escritos', () => {
  let arq = ARQUIVO();
  for (const [id, quando, frente] of [
    ['c3', '2026-11-04T11:00', 'terceiro'],
    ['c1', '2026-11-04T09:00', 'primeiro'],
    ['c2', '2026-11-04T10:00', 'segundo'],
  ]) arq = { cartoes: criarCartao(arq.cartoes, aula({ frente }), quando, id).cartoes };
  // Uma aula de outro vídeo e outra estação, no meio do caminho.
  arq = { cartoes: criarCartao(arq.cartoes, { estacao: 'ubl-core-calculo-i', aula: 'outra-aula', n: 1, frente: 'de fora', verso: 'v' }, '2026-11-04T08:00', 'c9').cartoes };

  const lista = cartoesDaAula(arq, AULA);
  assert.deepEqual(lista.map((c) => c.id), ['c1', 'c2', 'c3'], 'a ordem é a da criação, não a do id');
  assert.equal(lista.length, 3);
  assert.deepEqual(cartoesDaAula(arq, 'aula-que-não-existe'), []);
  assert.deepEqual(cartoesDaAula(arq, ''), [], 'aula vazia não devolve o arquivo inteiro');
  assert.deepEqual(cartoesDaAula(ARQUIVO(), AULA), []);
});

test('cartoesDevidos: até hoje, os mais antigos primeiro, no máximo 20', () => {
  let arq = ARQUIVO();
  // 25 cartões devidos em datas variadas + 5 devidos no futuro.
  for (let i = 1; i <= 25; i += 1) {
    const dia = String(i).padStart(2, '0');
    arq = { cartoes: criarCartao(arq.cartoes, aula({ frente: `frente ${i}` }), `2026-11-${dia}T09:00`, `c${i}`).cartoes };
    arq.cartoes[`c${i}`].devidoEm = `2026-11-${dia}`; // o criadoEm já manda para o dia seguinte; aqui quero o devido cru
  }
  for (let i = 26; i <= 30; i += 1) {
    arq = { cartoes: criarCartao(arq.cartoes, aula({ frente: `futura ${i}` }), '2026-11-01T09:00', `c${i}`).cartoes };
    arq.cartoes[`c${i}`].devidoEm = '2026-12-25';
  }

  const fila = cartoesDevidos(arq, '2026-11-20');
  assert.equal(fila.length, LIMITE_FILA, 'a fila passou do teto');
  assert.deepEqual(fila.map((c) => c.devidoEm), fila.map((c) => `2026-11-${String(fila.indexOf(c) + 1).padStart(2, '0')}`), 'a fila não está ordenada do mais antigo');
  assert.equal(fila[0].devidoEm, '2026-11-01');
  assert.equal(fila[fila.length - 1].devidoEm, '2026-11-20', 'o cartão devido HOJE ficou de fora');
  assert.ok(!fila.some((c) => Number(c.id.slice(1)) > 20), 'um cartão do futuro entrou na fila');

  // O teto corta a FILA, não os dados. (Escrevi aqui "30 quando tudo vence" e o
  // código me respondeu 20: o teto é o contrato, e eu tinha acabado de afirmar o
  // contrário na linha de cima. A forma honesta de provar que nada se perde é
  // contar os cartões no arquivo, e não esperar que a fila ignore o próprio teto.)
  assert.equal(cartoesDevidos(arq, '2026-12-31').length, LIMITE_FILA, 'o teto deixou de valer quando tudo vence');
  assert.equal(Object.keys(arq.cartoes).length, 30, 'os 10 que não entraram na fila de hoje existem no arquivo');
  assert.equal(cartoesDaAula(arq, AULA).length, 30, 'o que a fila corta some do arquivo');
  assert.equal(cartoesDevidos(arq, '2026-11-25').length, LIMITE_FILA);
  assert.equal(cartoesDevidos(arq, '2026-10-31').length, 0, 'ontem não devia nada');
});

test('cartoesDevidos: hoje fora da forma não devolve a fila inteira', () => {
  const arq = { cartoes: criarCartao({}, aula(), '2026-11-04T10:30', 'c1').cartoes };
  for (const hoje of ['', null, undefined, '31/12/2026', '2026-11', 'hoje', '2026-11-05T00:00']) {
    assert.deepEqual(cartoesDevidos(arq, hoje), [], `«${hoje}» virou uma fila`);
  }
});

test('cartoesDevidos: um cartão sem devidoEm não entra, e não derruba os outros', () => {
  const comUmQuebrado = {
    cartoes: {
      bom: { id: 'bom', estacao: ESTACAO, aula: AULA, n: 1, frente: 'f', verso: 'v', criadoEm: '2026-11-01T09:00', devidoEm: '2026-11-02', fsrs: null, historico: [] },
      semData: { id: 'semData', estacao: ESTACAO, aula: AULA, n: 2, frente: 'f', verso: 'v', criadoEm: '2026-11-01T09:00', fsrs: null, historico: [] },
    },
  };
  const fila = cartoesDevidos(comUmQuebrado, '2026-11-30');
  assert.deepEqual(fila.map((c) => c.id), ['bom']);
});

// ── 5. os modelos de frente, que são texto de tela ──────────────────────────
test('cartoes: os quatro modelos de frente puxam paráfrase, e moram em core/textos.js', () => {
  assert.deepEqual([...modelosDeFrente], [
    'Explique com suas palavras: ',
    'Dê um exemplo de ',
    'Qual a diferença entre … e …?',
    'Por que ',
  ]);
  assert.equal(modelosDeFrente, TEXTOS.modelosDeFrente, 'a tela e o cartão estariam lendo listas diferentes');
  assert.equal(Object.isFrozen(modelosDeFrente), true, 'uma tela pode reordenar os modelos no array compartilhado');
});

// ── 6. os textos do fechamento, que a S14b desenha ──────────────────────────
test('textos: a seção fechamento existe e diz as frases do desenho', () => {
  assert.equal(F.titulo, 'Fechar a aula');
  assert.equal(F.passoLembrar.titulo, 'Sem olhar');
  assert.equal(F.passoLembrar.pergunta, 'Sem rever nada: o que você lembra desta aula?');
  assert.equal(F.passoConferir.titulo, 'Conferir');
  assert.equal(F.passoConferir.pergunta, 'Agora confira com o vídeo ou com as suas notas. O que faltou?');
  assert.equal(F.passoCartoes.titulo, 'Cartões');
  assert.equal(F.passoCartoes.pergunta, 'Escreva a pergunta que você quer saber responder daqui a uma semana.');
  assert.equal(F.passoCartoes.frente, 'Pergunta');
  assert.equal(F.passoCartoes.verso, 'Resposta');
  assert.equal(F.passoCartoes.mais, 'Outro cartão');
  assert.equal(F.passoCartoes.limite, 'Até 3 cartões por aula.');
  assert.equal(F.modoMinimo.convite, 'Só uma frase e uma pergunta');
  assert.equal(F.modoMinimo.frase, 'Em uma frase, o que você leva desta aula?');
  assert.equal(F.faltaLembrar, 'Escreva o que você lembra antes de fechar a aula.');
  assert.equal(F.faltaCartao, 'Escreva ao menos um cartão, com pergunta e resposta.');
  assert.equal(F.pausaConvite, 'Pare em cada pausa e tente explicar, sem voltar o vídeo, o que viu até ali.');
});

test('textos: feito, proxima e porHoje conjugam o plural com o número que recebem', () => {
  assert.equal(F.feito(1), 'Aula estudada. O seu cartão volta amanhã.');
  assert.equal(F.feito(2), 'Aula estudada. Os seus 2 cartões voltam amanhã.');
  assert.equal(F.feito(3), 'Aula estudada. Os seus 3 cartões voltam amanhã.');
  assert.equal(F.proxima(3, 'Sistemas de Numeração (Parte 2)', '19 min'), 'Próxima: Aula 3 — Sistemas de Numeração (Parte 2) (19 min)');
  assert.equal(F.porHoje(1, 1), 'Por hoje está bom. Amanhã: 1 cartão, ~1 min.');
  assert.equal(F.porHoje(6, 3), 'Por hoje está bom. Amanhã: 6 cartões, ~3 min.');
  assert.equal(F.pausas(['8:00', '16:00', '24:00']), 'Pausas sugeridas: 8:00 · 16:00 · 24:00');
  assert.equal(F.pausas([]), 'Pausas sugeridas: ', 'vazio devia ser outra frase, e a tela é quem decide se desenha a linha');

  // A prova de que o valor entra na frase (mesma régua de design-system.test.js).
  for (const [nome, args] of [['feito', [7]], ['proxima', [13, 'Análise de Circuitos', '30 h 12 min']], ['porHoje', [9, 4]], ['pausas', [['8:00']]]]) {
    const saida = F[nome](...args);
    for (const a of args.flat()) {
      assert.ok(saida.includes(String(a)), `${nome} devolveu «${saida}» sem citar o valor ${a}`);
    }
  }
});

test('textos: o estado estudada está na lista de aulas e os motivos novos não têm frase solta', () => {
  // continuarDe passou a devolver 'estacao-percorrida'. A folha escolhe o verbo
  // pelo MOTIVO; se um motivo novo chegar sem que a tela o conheça, ela desenha o
  // convite de quem nunca entrou para quem percorreu a estação inteira.
  assert.equal(AU.estados.estudada, 'Estudada');
  assert.equal(F.titulo.trim(), 'Fechar a aula');
  assert.ok(TEXTOS.fechamento === F, 'TEXTOS não exporta a seção do fechamento');
});

// ── S15a: a revisão do cartão, que é o que faz "volta amanhã" ser verdade ──
//
// As decisões cobradas abaixo, uma a uma:
//   · a PRIMEIRA revisão inicializa pelo FSRS (não herda o "amanhã" fixo do
//     cartão novo: quem acerta volta em 2 dias, quem erra volta amanhã);
//   · `devidoEm` é uma fonte só — a fila (`cartoesDevidos`) já lê esse campo, e
//     se a revisão escrevesse noutra data a fila e o cartão discordariam;
//   · o virada-de-mês e o virada-de-ANO são cobrados com data real, porque a casa
//     é `aaaa-mm-dd` LOCAL e um `toISOString()` no meio adiantaria um dia em
//     quem estuda à noite;
//   · Errei soma LAPSOS (e não repetições-a-menos: um cartão pode ser revisado
//     dez vezes e ter caído três);
//   · nada muta a entrada;
//   · o resumo da sessão conta o que MUDOU, não o que a tela pediu duas vezes.
const revisado = (arq, id, nota, quando, confianca) => revisarCartao(arq, id, { nota, confianca }, quando);
const umCartao = (quando = '2026-11-04T10:30') => {
  const r = criarCartao({}, aula(), quando, 'c1');
  return r.cartoes;
};

test('s15a: a primeira revisão usa as iniciais do FSRS, e o cartão volta em 2 dias', () => {
  const antes = umCartao();
  const snapshot = JSON.stringify(antes);
  const r = revisado(antes, 'c1', 'lembrei', '2026-11-04T18:00', 'certeza');

  assert.equal(r.ok, true, r.erro);
  assert.equal(JSON.stringify(antes), snapshot, 'revisarCartao mutou a entrada');
  assert.equal(r.cartao.fsrs.estabilidade, 2.3065, 'W[2]: a estabilidade inicial do Lembrei');
  assert.equal(r.cartao.fsrs.dificuldade, 2.118103970459015, 'a dificuldade inicial do Lembrei');
  assert.equal(r.cartao.fsrs.repeticoes, 1);
  assert.equal(r.cartao.fsrs.lapsos, 0);
  assert.equal(r.cartao.fsrs.ultimaEm, '2026-11-04T18:00');
  assert.equal(r.cartao.devidoEm, '2026-11-06', 'S=2,3065 dá intervalo 2');
  assert.equal(r.cartao.historico.length, 1);
  assert.deepEqual(r.cartao.historico[0], { em: '2026-11-04T18:00', nota: 'lembrei', confianca: 'certeza' });
});

test('s15a: a primeira Errei volta AMANHÃ e soma o primeiro lapso', () => {
  const r = revisado(umCartao(), 'c1', 'errei', '2026-11-04T18:00');
  assert.equal(r.cartao.fsrs.estabilidade, 0.212, 'W[0]');
  assert.equal(r.cartao.fsrs.dificuldade, 6.4133, 'W[4]');
  assert.equal(r.cartao.fsrs.lapsos, 1);
  assert.equal(r.cartao.devidoEm, '2026-11-05', 'a frase do fechamento continua valendo para quem errou');
  assert.equal(r.cartao.historico[0].confianca, null, 'confiança é opcional, e ausente é null, não string vazia');
});

test('s15a: a segunda revisão conta os dias desde a primeira, não desde que o cartão nasceu', () => {
  // Nasceu 04/11, revisado 04/11 (volta 06/11), revisado de novo em 06/11:
  // t=2, e a tabela de referência diz exatamente S=10,964332 para L t=2.
  const depoisDaPrimeira = revisado(umCartao(), 'c1', 'lembrei', '2026-11-04T18:00').cartoes;
  const r = revisado(depoisDaPrimeira, 'c1', 'lembrei', '2026-11-06T09:00');
  assert.ok(Math.abs(r.cartao.fsrs.estabilidade - 10.964332) <= 1e-6, `S=${r.cartao.fsrs.estabilidade}`);
  assert.equal(r.cartao.devidoEm, '2026-11-17', 'intervalo 11 a partir de 06/11');
  assert.equal(r.cartao.fsrs.repeticoes, 2);

  // Se a régua fosse o criadoEm em vez do ultimaEm, t seria 2 também por acaso
  // aqui — então o caso que discrimina é um cartão criado MUITO antes:
  const velho = { c1: { ...umCartao().c1, criadoEm: '2026-09-01T10:00' } };
  const primeiro = revisado(velho, 'c1', 'lembrei', '2026-11-06T09:00');
  assert.equal(primeiro.cartao.fsrs.estabilidade, 2.3065, 'estado null: inicializa, não espera 66 dias');
});

test('s15a: o devidoEm atravessa o fim de mês e o fim de ANO em data local', () => {
  // 2,3065 → 2 dias. A virada de ano é a que um `+172800000` de milissegundos e
  // qualquer UTC escondido derrubam.
  const revirada = revisado(umCartao('2026-12-31T23:30'), 'c1', 'lembrei', '2026-12-31T23:30');
  assert.equal(revirada.cartao.devidoEm, '2027-01-02', 'travou no ano: a data local não pode depender do fuso');

  const fimDeMes = revisado(umCartao('2026-11-29T23:50'), 'c1', 'lembrei', '2026-11-29T23:50');
  assert.equal(fimDeMes.cartao.devidoEm, '2026-12-01');

  // E fevereiro, o mês que não tem 30 dias: intervalo grande caindo em 30/01.
  const longo = { c1: { ...umCartao().c1, fsrs: { estabilidade: 100, dificuldade: 5, repeticoes: 4, lapsos: 0, ultimaEm: '2026-01-30T10:00' } } };
  const r = revisado(longo, 'c1', 'lembrei', '2026-01-30T10:00');
  assert.equal(r.cartao.fsrs.repeticoes, 5);
  const [ano, mes, dia] = r.cartao.devidoEm.split('-').map(Number);
  assert.ok(ano === 2026 && mes >= 2 && mes <= 5, `a data saltou para ${r.cartao.devidoEm}`);
});

test('s15a: lapsos sobe SÓ na Errei, e o histórico cresce sem perder o passado', () => {
  let arq = revisado(umCartao(), 'c1', 'lembrei', '2026-11-04T10:00').cartoes;
  arq = revisado(arq, 'c1', 'errei', '2026-11-06T10:00').cartoes;
  arq = revisado(arq, 'c1', 'errei', '2026-11-07T10:00').cartoes;
  arq = revisado(arq, 'c1', 'lembrei', '2026-11-08T10:00').cartoes;
  assert.equal(arq.c1.fsrs.lapsos, 2);
  assert.equal(arq.c1.fsrs.repeticoes, 4);
  assert.deepEqual(arq.c1.historico.map((h) => h.nota), ['lembrei', 'errei', 'errei', 'lembrei']);
});

test('s15a: id desconhecido e nota inválida recusam com a frase do CAMPO', () => {
  const semId = revisado(umCartao(), 'nao-existe', 'lembrei', '2026-11-05T10:00');
  assert.equal(semId.ok, false);
  assert.equal(semId.campo, 'id');
  assert.ok(semId.erro.length > 10);

  for (const nota of ['mais-ou-menos', '', null, 'lembrei-mais-ou-menos']) {
    const r = revisarCartao(umCartao(), 'c1', { nota }, '2026-11-05T10:00');
    assert.equal(r.ok, false, `nota ${nota} passou`);
    assert.equal(r.campo, 'nota');
  }

  const confusa = revisarCartao(umCartao(), 'c1', { nota: 'lembrei', confianca: 'chutou' }, '2026-11-05T10:00');
  assert.equal(confusa.ok, false);
  assert.equal(confusa.campo, 'confianca');

  const quandoRuim = revisado(umCartao(), 'c1', 'lembrei', 'ontem à noite');
  assert.equal(quandoRuim.ok, false);
  assert.equal(quandoRuim.campo, 'quando');
});

test('s15a: um cartão recusado não toca no arquivo', () => {
  const arq = umCartao();
  const snapshot = JSON.stringify(arq);
  revisarCartao(arq, 'inexistente', 'lembrei', '2026-11-05T10:00');
  revisarCartao(arq, 'c1', 'difícil', '2026-11-05T10:00');
  assert.equal(JSON.stringify(arq), snapshot);
});

test('s15a: o cartão revisado sobrevive ao round-trip do storage', () => {
  const r = revisado(umCartao(), 'c1', 'lembrei', '2026-11-04T18:00', 'acho');
  const lido = lerCartoes(serializarCartoes({ versao: 1, cartoes: r.cartoes }));
  assert.equal(lido.cartoes.c1.fsrs.estabilidade, r.cartao.fsrs.estabilidade);
  assert.equal(lido.cartoes.c1.devidoEm, '2026-11-06');
  assert.deepEqual(lido.cartoes.c1.historico, r.cartao.historico);
});

test('s15a: a fila passa a obedecer o devidoEm calculado, e não o amanhã fixo', () => {
  const r = revisado(umCartao(), 'c1', 'lembrei', '2026-11-04T18:00');
  assert.deepEqual(cartoesDevidos(r.cartoes, '2026-11-05'), [], 'voltou em 2 dias, não amanhã');
  assert.deepEqual(cartoesDevidos(r.cartoes, '2026-11-06').map((c) => c.id), ['c1']);
});

test('s15a: resumoDaSessao conta os que mudaram, e a próxima data é de todos', () => {
  let arq = criarCartao({}, aula(), '2026-11-04T10:00', 'c1').cartoes;
  arq = criarCartao(arq, aula({ frente: 'O que é carry?', verso: 'vai para o próximo bit' }), '2026-11-04T10:05', 'c2').cartoes;
  arq = criarCartao(arq, aula({ frente: 'O que é XOR?', verso: 'saída alta quando diferem' }), '2026-11-04T10:09', 'c3').cartoes;
  const antes = JSON.parse(JSON.stringify(arq));

  const um = revisado(arq, 'c1', 'lembrei', '2026-11-04T11:00');
  arq = um.cartoes;
  const dois = revisado(arq, 'c2', 'errei', '2026-11-04T11:02');
  arq = dois.cartoes;

  const s = resumoDaSessao(antes, arq, ['c1', 'c2', 'c2', 'c3'], '2026-11-04');
  assert.equal(s.revisados, 2, 'id repetido conta uma vez, e o que não foi respondido não entra');
  assert.equal(s.lembrados, 1);
  assert.equal(s.proximaEm, '2026-11-05', 'o cartão sem resposta vence antes dos revisados');

  const nada = resumoDaSessao(arq, arq, [], '2026-11-04');
  assert.deepEqual(nada, { revisados: 0, lembrados: 0, proximaEm: '2026-11-05' });
});

test('s15a: proximaEm é null quando não há mais nada à frente', () => {
  const arq = umCartao();
  const hoje = '2026-12-31';
  const atrasado = { ...arq, c1: { ...arq.c1, devidoEm: '2026-11-05' } };
  assert.equal(resumoDaSessao(atrasado, atrasado, [], hoje).proximaEm, null, 'tudo venceu: a tela diz que não há nada para revisitar');

  const vazio = resumoDaSessao({}, {}, [], '2026-11-04');
  assert.deepEqual(vazio, { revisados: 0, lembrados: 0, proximaEm: null });
});

test('s15a: confiança é registrada e não muda o agendamento', () => {
  const sem = revisado(umCartao(), 'c1', 'lembrei', '2026-11-04T18:00');
  const com = revisado(umCartao(), 'c1', 'lembrei', '2026-11-04T18:00', 'chute');
  assert.equal(com.cartao.fsrs.estabilidade, sem.cartao.fsrs.estabilidade);
  assert.equal(com.cartao.devidoEm, sem.cartao.devidoEm);
  assert.equal(com.cartao.historico[0].confianca, 'chute');
  assert.deepEqual([...CONFIANCAS], ['certeza', 'acho', 'chute']);
});

test('s15a: diaDepois é o calendário local, e diaSeguinte continua sendo ele com 1', () => {
  assert.equal(diaSeguinte('2026-11-30T23:59'), '2026-12-01');
  assert.equal(diaDepois('2026-11-30T23:59', 2), '2026-12-02');
  assert.equal(diaDepois('2026-12-31', 1), '2027-01-01');
  assert.equal(diaDepois('2026-02-27', 2), '2026-03-01', '2026 não é bissexto');
  assert.equal(diaDepois('2026-01-01', 0), '2026-01-01');
  assert.equal(diaDepois('2026-01-01', 1.5), '', 'dia fracionado não existe no calendário');
  assert.equal(diaDepois('ontem', 1), '');
});
