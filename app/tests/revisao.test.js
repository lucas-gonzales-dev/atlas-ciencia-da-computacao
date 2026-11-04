// Projeto Atlas — S8: a regra da revisão espaçada, pura e sem navegador.
//
// Por que um arquivo só para isto: a fila, o degrau e a "retida" são decisão
// de método de estudo, e decisão tem de ser testável sem tocar em DOM. A tela
// (web/telas/revisar.js) só desenha o que este módulo diz.
//
// Datas no teste são SEMPRE string `'aaaa-mm-dd'` injetada: chamar `new Date()`
// dentro de um caso deixaria a suíte depender do relógio da máquina (a lição do
// temporizador real na 2c-1, que estourou os 30 s).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVALOS, DEGRAU_MAXIMO, RESULTADOS, STORAGE_KEY,
  somarDias, agendarConclusao, registrarRevisao, filaDoDia,
  proximaData, estaRetida, removerEstacao, contarRevisoes,
  migrarRevisoesAntigas,
} from '../core/revisao.js';
import { LIMITE_FACE, cartoesDevidos } from '../core/cartoes.js';
import { revisar as RV } from '../core/textos.js';
import { FORMATO, VERSAO_FORMATO, VERSAO_MINIMA, buildExport, parseImport } from '../core/progress-io.js';

// ───────────────────────── 1. concluir agenda em D + 3 ─────────────────────────

test('revisao: concluir em 01/11 agenda para 04/11, degrau 0', () => {
  const r = agendarConclusao({}, 'logica', '2026-11-01');
  assert.deepEqual(r.logica, { degrau: 0, proxima: '2026-11-04', historico: [] });
  assert.equal(INTERVALOS[0], 3, 'o primeiro intervalo é 3 dias — é isso que a fatia arbitra');
});

test('revisao: as datas somam dias de calendário, nunca UTC no meio da noite', () => {
  // 2026-02-27 + 3 = 02/03. Um toISOString() puro com hora fixa em SP é o
  // mesmo dia; um Date local criado à noite em outubro (horário de verão
  // inexistente, mas o deslocamento de -03:00 conta) empurraria para 03.
  assert.equal(somarDias('2026-02-27', 3), '2026-03-02');
  assert.equal(somarDias('2026-12-30', 3), '2027-01-02', 'virou o ano: a soma atravessa 31 de dezembro');
  assert.equal(somarDias('ontem', 3), null, 'data que não é data não gera fila');
});

// ───────────────── 2. resultado -> degrau -> próxima data ─────────────────

test('revisao: lembrei sobe um degrau e agenda pelo intervalo novo', () => {
  const r = registrarRevisao(agendarConclusao({}, 'logica', '2026-11-01'), 'logica', 'lembrei', '2026-11-04');
  assert.equal(r.logica.degrau, 1);
  assert.equal(r.logica.proxima, '2026-11-11', '04 + 7 dias (degrau 1)');
  assert.deepEqual(r.logica.historico, [{ data: '2026-11-04', resultado: 'lembrei' }]);
});

test('revisao: em-parte mantém o degrau e agenda pelo intervalo dele', () => {
  const base = registrarRevisao(agendarConclusao({}, 'logica', '2026-11-01'), 'logica', 'lembrei', '2026-11-04');
  const r = registrarRevisao(base, 'logica', 'em-parte', '2026-11-11');
  assert.equal(r.logica.degrau, 1, 'em-parte não desce e não sobe');
  assert.equal(r.logica.proxima, '2026-11-18', 'ainda intervalo de 7 dias');
});

test('revisao: nao-lembrei volta ao degrau 0, sem punição acumulada', () => {
  let r = agendarConclusao({}, 'logica', '2026-11-01');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-11-04');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-11-11');
  assert.equal(r.logica.degrau, 2);
  r = registrarRevisao(r, 'logica', 'nao-lembrei', '2026-12-02');
  assert.equal(r.logica.degrau, 0);
  assert.equal(r.logica.proxima, '2026-12-05', 'a próxima conta do DIA da revisão, não de hoje');
  assert.equal(r.logica.historico.length, 3, 'o histórico conta a jornada inteira');
});

test('revisao: resultado que não existe não muda nada', () => {
  const r = agendarConclusao({}, 'logica', '2026-11-01');
  assert.deepEqual(registrarRevisao(r, 'logica', 'mais-ou-menos', '2026-11-04'), r);
  assert.deepEqual(RESULTADOS, ['lembrei', 'em-parte', 'nao-lembrei']);
});

// ───────────────────────── 3. o degrau tem topo ─────────────────────────

test('revisao: o degrau não passa de 4', () => {
  let r = agendarConclusao({}, 'logica', '2026-11-01');
  for (const dia of ['2026-11-04', '2026-11-11', '2026-12-02', '2027-02-01', '2027-08-15', '2028-01-01']) {
    r = registrarRevisao(r, 'logica', 'lembrei', dia);
  }
  assert.equal(r.logica.degrau, DEGRAU_MAXIMO);
  assert.equal(DEGRAU_MAXIMO, 4);
  assert.equal(r.logica.proxima, somarDias('2028-01-01', 180), 'no topo, o intervalo é o de 180 dias');
});

// ───────────────── 4. a fila: três, da mais atrasada, nada do futuro ─────────────────

function comFila() {
  let r = {};
  r = agendarConclusao(r, 'a', '2026-10-01'); // venceu 04/10
  r = agendarConclusao(r, 'b', '2026-10-20'); // venceu 23/10
  r = agendarConclusao(r, 'c', '2026-10-29'); // venceu 01/11
  r = agendarConclusao(r, 'd', '2026-11-20'); // venceu 23/11: futuro
  return r;
}

test('revisao: filaDoDia devolve no máximo 3, da mais atrasada para a mais recente', () => {
  const r = { ...comFila(), e: { degrau: 0, proxima: '2026-09-15', historico: [] } };
  const fila = filaDoDia(r, '2026-11-01');
  assert.deepEqual(fila, ['e', 'a', 'b'], `ordem de atraso; veio ${fila}`);
  assert.ok(fila.length <= 3, 'o limite de 3 é a regra: o resto espera');
  assert.equal(fila.includes('d'), false, 'nada do futuro entra na fila');
  // EXPECTATIVA CORRIGIDA (01/11/2026): a primeira versão deste caso cobrava
  // 'c' na fila. 'c' vence hoje e está PRONTA — é a 4ª, e o limite de 3 corta.
  // O código estava certo; quem chutava era eu. O caso de 'c' sozinha está
  // logo abaixo, para "vence hoje entra" continuar sendo medido de verdade.
  assert.equal(fila.includes('c'), false, 'é a 4ª pronta: o limite de 3 corta, e o resto espera em silêncio');
  assert.deepEqual(filaDoDia(comFila(), '2026-11-01'), ['a', 'b', 'c'],
    'sem a quarta, as três prontas entram, a mais atrasada primeiro');
});

test('revisao: atraso grande não vira cobrança', () => {
  // O caso da decisão 1: quem some duas semanas não vê "14 atrasadas".
  let r = {};
  for (let i = 0; i < 9; i += 1) r = agendarConclusao(r, `id${i}`, '2026-09-01');
  const fila = filaDoDia(r, '2026-11-01', 3);
  assert.equal(fila.length, 3, 'nove vencidas, três na fila');
  assert.equal(contarRevisoes(r), 9, 'as outras seis continuam guardadas, esperando');
});

// ───────────────────────── 5. retida ─────────────────────────

test('revisao: retida é falso até um lembrei com intervalo de 21 dias ou mais', () => {
  let r = agendarConclusao({}, 'logica', '2026-11-01');
  assert.equal(estaRetida(r, 'logica'), false, 'recém-concluída não é retida');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-11-04'); // intervalo era 3
  assert.equal(estaRetida(r, 'logica'), false, 'lembrei no degrau de 3 dias não retém');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-11-11'); // intervalo era 7
  assert.equal(estaRetida(r, 'logica'), false, 'nem no de 7');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-12-02'); // intervalo era 21
  assert.equal(estaRetida(r, 'logica'), true, '21 dias é o corte que a fatia arbitra');
});

test('revisao: esqueceu e voltou a lembrar — a retida continua no histórico', () => {
  let r = agendarConclusao({}, 'logica', '2026-11-01');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-11-04');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-11-11');
  r = registrarRevisao(r, 'logica', 'lembrei', '2026-12-02'); // retida aqui
  assert.equal(estaRetida(r, 'logica'), true);
  r = registrarRevisao(r, 'logica', 'nao-lembrei', '2026-12-23');
  assert.equal(r.logica.degrau, 0);
  assert.equal(estaRetida(r, 'logica'), true, 'já provou; esquecer depois não apaga a prova');
});

// ───────────────── 6/7. remover e não mutar ─────────────────

test('revisao: removerEstacao tira a estação e deixa as outras', () => {
  const r = comFila();
  const s = removerEstacao(r, 'b');
  assert.equal('b' in s, false);
  assert.deepEqual(Object.keys(s), ['a', 'c', 'd']);
  assert.equal('b' in r, true, 'o mapa recebido continua intacto');
});

test('revisao: nenhuma função muta o objeto recebido', () => {
  const antes = Object.freeze({
    logica: Object.freeze({ degrau: 2, proxima: '2026-11-20', historico: Object.freeze([Object.freeze({ data: '2026-11-11', resultado: 'lembrei' })]) }),
  });
  const congelado = JSON.stringify(antes);
  const depois = registrarRevisao(antes, 'logica', 'lembrei', '2026-11-20');
  agendarConclusao(antes, 'outra', '2026-11-20');
  filaDoDia(antes, '2026-12-01');
  removerEstacao(antes, 'logica');
  assert.equal(JSON.stringify(antes), congelado, 'mutar por baixo do estado da tela é bug invisivel');
  assert.equal(depois.logica.degrau, 3, 'e a saída é nova, com o degrau certo');
});

test('revisao: entrada corrompida vira degrau 0, não derruba a tela', () => {
  const r = filaDoDia({ x: { degrau: 99, proxima: 'não-é-data' }, y: { degrau: -3, proxima: '2026-11-01' } }, '2026-11-01');
  assert.deepEqual(r, ['y'], 'a data ilegível não entra; a legível entra');
  assert.equal(proximaData({ x: { proxima: '2026-11-09' }, y: { proxima: '2026-11-05' } }), '2026-11-05');
  assert.equal(proximaData({}), null, 'sem revisão, sem data — a tela não mostra "Próxima em null"');
  assert.equal(STORAGE_KEY, 'atlas.revisoes.v1', 'a chave é o nome do formato: mudou, migra');
});

// ───────────────── 8. progress-io leva as revisões ─────────────────

const CURSOS = [{ id: 'logica' }, { id: 'calculo' }];

test('progress-io: exportar leva o campo opcional revisoes', () => {
  const revisoes = agendarConclusao({}, 'logica', '2026-11-01');
  const pacote = buildExport(CURSOS, ['logica'], new Date('2026-11-01T12:00:00Z'), {}, { revisoes });
  assert.deepEqual(pacote.revisoes, { logica: { degrau: 0, proxima: '2026-11-04', historico: [] } });
  assert.ok(pacote.revisoes.logica.proxima, 'exportar sem as datas de revisão jogaria fora o calendário da pessoa');
});

test('progress-io: importar arquivo antigo, sem revisoes, funciona e não apaga as que existem', () => {
  const texto = JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: ['logica'] });
  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed, ['logica']);
  assert.equal(r.revisoes, null, 'sem campo no arquivo: null, e a tela mantém o que já tinha — não {}');
  assert.match(r.mensagem, /revisões/i, 'diz em voz alta o que aconteceu com as revisões deste aparelho');
});

test('progress-io: importar leva as revisoes e recusa as de id fora do catalogo', () => {
  const revisoes = agendarConclusao(agendarConclusao({}, 'logica', '2026-11-01'), 'fantasma', '2026-11-01');
  const texto = JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: ['logica'], revisoes });
  const r = parseImport(texto, CURSOS);
  assert.deepEqual(Object.keys(r.revisoes), ['logica'], 'id fora do catálogo não entra, e é contado');
  assert.equal(r.revisoesIgnoradas, 1);
  assert.match(r.mensagem, /1 revisão/i);
});

test('progress-io: revisoes ilegiveis descartam as revisoes e mantem o progresso', () => {
  // Mesma regra da anotação ilegível: o progresso é o dado mais caro da pessoa.
  const texto = JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: ['logica'], revisoes: 'quebrado' });
  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed, ['logica']);
  assert.equal(r.revisoes, null);
  assert.match(r.mensagem, /ilegível/i);
});

test('progress-io: o envelope que traz revisoes declara a versao que o le', () => {
  // Nada de versão nova: `revisoes` é campo OPCIONAL, e o Atlas de ontem lê o
  // arquivo de hoje sem ele. Subir a versão diria que v2 é ilegível, e é o
  // contrário — v2 importa limpo (caso acima).
  assert.equal(VERSAO_FORMATO, 2);
  assert.equal(VERSAO_MINIMA, 1);
});

// ─────────── S15a: a migração da revisão antiga para o cartão ───────────
//
// O que é cobrado aqui, e por quê:
//   · só estação COM ANOTAÇÃO vira cartão — um cartão sem verso é uma dívida que
//     a pessoa não pode pagar (a mesma razão de criarCartao exigir o verso);
//   · o id é `migr-<estacao>` e NÃO é aleatório: a migração roda a cada boot
//     enquanto a chave antiga existir, e a segunda rodada tem de achar o cartão
//     que já foi criado. Este é o caso que um uuid aqui deixaria passar no
//     primeiro boot e explodir no segundo, com a mesma pergunta voltando em dois
//     dias diferentes;
//   · o devidoEm é a data que a revisão antiga já marcava, se houver — a pessoa
//     não perde o dia em que o Atlas de ontem prometeu voltar;
//   · a frente vem de core/textos.js (regra 7), com o nome do catálogo dentro;
//   · a chave antiga não é apagada (a exportação da S19 ainda a lê).
const GRADE = [
  { id: 'logica', title: 'Lógica' },
  { id: 'calculo', title: 'Cálculo I' },
  { id: 'circuitos', title: 'Circuitos Digitais' },
];

const duasRevisoes = () => ({
  logica: { degrau: 1, proxima: '2026-11-11', historico: [] },
  calculo: { degrau: 0, proxima: '2026-11-20', historico: [] },
  circuitos: { degrau: 0, proxima: null, historico: [] },
});
const tresNotas = () => ({
  logica: 'A indução precisa do caso base.',
  calculo: 'Limites antes de derivadas.',
  circuitos: '   ',
});

test('s15a migração: só estação com anotação vira cartão', () => {
  const r = migrarRevisoesAntigas(duasRevisoes(), tresNotas(), GRADE, {}, '2026-11-04T10:00');
  assert.equal(r.criados, 2, 'circuitos tem anotação em branco: não há o que conferir');
  assert.deepEqual(Object.keys(r.cartoes).sort(), ['migr-calculo', 'migr-logica']);
});

test('s15a migração: o cartão sai com a pergunta do texto e a resposta da pessoa', () => {
  const r = migrarRevisoesAntigas(duasRevisoes(), tresNotas(), GRADE, {}, '2026-11-04T10:00');
  const c = r.cartoes['migr-logica'];
  assert.equal(c.frente, RV.frenteMigrada('Lógica'), 'a frente vem de core/textos.js');
  assert.equal(c.frente, 'O que você leva de Lógica?');
  assert.equal(c.verso, 'A indução precisa do caso base.');
  assert.equal(c.estacao, 'logica');
  assert.equal(c.aula, null, 'a estação não é uma aula');
  assert.equal(c.n, null);
  assert.equal(c.origem, 'revisao-antiga');
  assert.equal(c.fsrs, null, 'sem resposta dada ainda, não há modelo');
  assert.deepEqual(c.historico, []);
});

test('s15a migração: o devidoEm é o da revisão antiga, e amanhã quando não há', () => {
  const r = migrarRevisoesAntigas(duasRevisoes(), tresNotas(), GRADE, {}, '2026-11-04T10:00');
  assert.equal(r.cartoes['migr-logica'].devidoEm, '2026-11-11', 'a pessoa não perde a data que o Atlas já tinha marcado');
  assert.equal(r.cartoes['migr-calculo'].devidoEm, '2026-11-20');

  const semData = { logica: { degrau: 0, proxima: null, historico: [] } };
  const m = migrarRevisoesAntigas(semData, { logica: 'nota' }, GRADE, {}, '2026-11-04T10:00');
  assert.equal(m.cartoes['migr-logica'].devidoEm, '2026-11-05', 'sem data antiga é amanhã, a régua honesta');

  const virada = migrarRevisoesAntigas(semData, { logica: 'nota' }, GRADE, {}, '2026-12-31T23:40');
  assert.equal(virada.cartoes['migr-logica'].devidoEm, '2027-01-01', 'o amanhã é do calendário local, não do UTC');
});

test('s15a migração: duas rodadas não duplicam, e não sobrescrevem o que já foi respondido', () => {
  const notas = tresNotas();
  const uma = migrarRevisoesAntigas(duasRevisoes(), notas, GRADE, {}, '2026-11-04T10:00');
  assert.equal(uma.criados, 2);
  const duas = migrarRevisoesAntigas(duasRevisoes(), notas, GRADE, uma.cartoes, '2026-11-05T10:00');
  assert.equal(duas.criados, 0, 'a segunda rodada tem de achar os ids determinísticos e não criar nada');
  assert.deepEqual(Object.keys(duas.cartoes).sort(), ['migr-calculo', 'migr-logica']);
  assert.equal(duas.cartoes['migr-logica'].criadoEm, '2026-11-04T10:00', 're-migrar não reescreve o cartão que já existe');

  // E se o cartão migrado já foi RESPONDIDO, a segunda rodada não pode apagar a
  // resposta: é o dado mais caro da pessoa neste app.
  const respondido = { ...duas.cartoes };
  respondido['migr-logica'] = { ...respondido['migr-logica'], devidoEm: '2026-12-01', historico: [{ em: '2026-11-06T09:00', nota: 'lembrei', confianca: null }] };
  const tres = migrarRevisoesAntigas(duasRevisoes(), notas, GRADE, respondido, '2026-11-07T10:00');
  assert.equal(tres.criados, 0);
  assert.equal(tres.cartoes['migr-logica'].devidoEm, '2026-12-01');
  assert.equal(tres.cartoes['migr-logica'].historico.length, 1);
});

test('s15a migração: a frente vem de textos.js, e não de uma string escrita no teste', () => {
  // A prova de que o nome do catálogo entra na frase (regra 7): duas estações,
  // duas frentes diferentes, e nenhuma das duas é literal deste arquivo.
  const r = migrarRevisoesAntigas(duasRevisoes(), tresNotas(), GRADE, {}, '2026-11-04T10:00');
  assert.notEqual(r.cartoes['migr-logica'].frente, r.cartoes['migr-calculo'].frente);
  assert.ok(r.cartoes['migr-calculo'].frente.includes('Cálculo I'));
  assert.equal(RV.frenteMigrada('X'), 'O que você leva de X?');
});

test('s15a migração: sem catálogo nada migra, e estação fora do catálogo é contada', () => {
  assert.equal(migrarRevisoesAntigas(duasRevisoes(), tresNotas(), [], {}, '2026-11-04T10:00').criados, 0);

  const fora = { logica: { degrau: 0, proxima: null }, fantasma: { degrau: 0, proxima: null } };
  const r = migrarRevisoesAntigas(fora, { logica: 'a', fantasma: 'b' }, GRADE, {}, '2026-11-04T10:00');
  assert.equal(r.criados, 1);
  assert.equal(r.ignorados, 1, 'anotação de disciplina que não existe mais é ignorada E CONTADA');
  assert.ok(!('migr-fantasma' in r.cartoes));
});

test('s15a migração: a nota longa é cortada em LIMITE_FACE, e o cartão continua na fila', () => {
  const longa = 'x'.repeat(LIMITE_FACE + 120);
  const r = migrarRevisoesAntigas({ logica: { degrau: 0, proxima: null } }, { logica: longa }, GRADE, {}, '2026-11-04T10:00');
  assert.equal(r.cartoes['migr-logica'].verso.length, LIMITE_FACE);

  // O cartão migrado entra na fila de hoje sem mais nada: o devidoEm da revisão
  // antiga é lido por cartoesDevidos, que é a única fonte da data.
  const fila = cartoesDevidos(r.cartoes, '2026-11-30');
  assert.deepEqual(fila.map((c) => c.id), ['migr-logica']);
});

test('s15a migração: aceita a chave crua do storage, e não explode com lixo', () => {
  const bruto = JSON.stringify(duasRevisoes());
  const r = migrarRevisoesAntigas(bruto, tresNotas(), GRADE, {}, '2026-11-04T10:00');
  assert.equal(r.criados, 2);

  assert.deepEqual(migrarRevisoesAntigas('quebrado', tresNotas(), GRADE, {}, '2026-11-04T10:00'), { cartoes: {}, criados: 0, ignorados: 0 });
  assert.deepEqual(migrarRevisoesAntigas(null, null, null, null, '2026-11-04T10:00'), { cartoes: {}, criados: 0, ignorados: 0 });
  assert.equal(migrarRevisoesAntigas(duasRevisoes(), tresNotas(), GRADE, {}, 'data errada').criados, 2, 'sem quando válido, é hoje à meia-noite, não uma recusa');
});

test('s15a migração: não muta nem apaga a revisão antiga', () => {
  const revisoes = duasRevisoes();
  const snapshot = JSON.stringify(revisoes);
  const cartoes = { existente: { id: 'existente' } };
  const antes = JSON.stringify(cartoes);
  const r = migrarRevisoesAntigas(revisoes, tresNotas(), GRADE, cartoes, '2026-11-04T10:00');
  assert.equal(JSON.stringify(revisoes), snapshot, 'a migração apagou a chave antiga, que a exportação da S19 ainda lê');
  assert.equal(JSON.stringify(cartoes), antes);
  assert.ok(r.cartoes.existente, 'o que já estava no arquivo de cartões continua lá');
});
