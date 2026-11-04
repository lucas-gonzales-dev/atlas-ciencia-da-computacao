// Projeto Atlas — S15b: a TRAVA da fila de cartões na aba Revisar.
//
// POR QUE EXISTE: a aba Revisar deixou de desenhar a revisão por estação (S8) e
// passou a desenhar a fila do que a própria pessoa escreveu no fechamento (S14b2).
// É a tela mais usada do app, e o que ela faz com o cartão — mostrar a frente,
// esconder o verso até o pedido, chamar revisarCartao, gravar, passar ao próximo,
// fechar a sessão com o resumo — não tem nada de óbvio: cada passo tem uma
// alternativa plausível e errada (mostrar o verso de cara, contar "revisados" na
// tela em vez de perguntar ao núcleo, pôr cor de certo no Lembrei).
//
// O QUE ESTE ARQUIVO NÃO REIMPLANTA: nenhum cálculo aqui. A fila é
// `cartoesDevidos`, o agendamento é `revisarCartao`, o placar é `resumoDaSessao`,
// a lista de aulas lembradas é `aulasLembradasNaSessao` — todas com os testes
// delas em tests/cartoes.test.js. O que se mede aqui é o FIO: se a tela chama a
// função certa com o que a pessoa fez e pinta o que ela devolveu. Um `if` de
// calendário na tela passaria verde aqui e mentiria no aparelho.
//
// FRASE É ASSERÇÃO VINDA DO CORE, NUNCA LITERAL: cada comparação monta a frase
// com as funções de core/textos.js (bloco `revisar`). Se alguém reescrever uma
// frase na tela, o teste cai — e é isso que mantém a regra 9 de pé.
//
// MINI-DOM (tests/hdom.js) e storage em memória, como nas auditorias S10a. Os
// cartões das cenas são montados por `criarCartao` de verdade, e o catálogo é o
// REAL (data/catalog.json): fixture com interface inventada prova a fixture
// (lição do applyNote, 94cb36c).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { criarDoc, storageCom, todos, textoDe, esperar } from './hdom.js';
import { montar } from '../web/telas/revisar.js';
import {
  CARTOES_KEY,
  LIMITE_FILA,
  criarCartao,
  diasEntre,
  lerCartoes,
  minutosDaFila,
  serializarCartoes
} from '../core/cartoes.js';
import { STORAGE_KEY, agendarConclusao, serializeRevisoes } from '../core/revisao.js';
import { revisar as T } from '../core/textos.js';

const CATALOGO = JSON.parse(readFileSync(fileURLToPath(new URL('../data/catalog.json', import.meta.url)), 'utf8'));
const ESTACOES = CATALOGO.courses || CATALOGO;
const NOME_DA_PRIMEIRA = ESTACOES[0].title;
const SLUG_DA_PRIMEIRA = ESTACOES[0].slug;
const HOJE = '2026-11-05';

// ───────────────────────── as peças do case ─────────────────────────
const comClasse = (raiz, classe) => todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));
const um = (raiz, classe, onde) => {
  const achei = comClasse(raiz, classe);
  assert.equal(achei.length, 1, `${onde}: esperado exatamente um .${classe}, achei ${achei.length}`);
  return achei[0];
};
const peloTexto = (raiz, texto) =>
  todos(raiz, (n) => (n._texto || '').trim() === texto)[0] || null;
const tocar = (no) => no.dispatch('click', { target: no, preventDefault() {} });

/** UM primário por estado, contado pela CLASSE do primário — não pelos botões. */
const primarios = (raiz) => comClasse(raiz, 'revisar-primario');

/**
 * Sobe a aba com um storage e um catálogo reais.
 *
 * `cartoes`: o arquivo `atlas.cartoes.v1` já serializado, ou null para não haver
 * chave nenhuma (o aparelho de quem nunca fechou uma aula).
 * `revisoes`: a chave antiga `atlas.revisoes.v1`, para a migração da S15a.
 */
async function fila({ cartoes = null, revisoes = null, notas = {}, completed = [], hoje = HOJE } = {}) {
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  const inicial = {};
  if (cartoes) inicial[CARTOES_KEY] = cartoes;
  if (revisoes) inicial[STORAGE_KEY] = revisoes;
  inicial['atlas.progresso.v1'] = JSON.stringify(completed);
  const storage = storageCom(inicial);
  const inst = await montar(raiz, {
    document: doc,
    window: { localStorage: storage, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {} },
    storage,
    modulos: {
      loadCompleted: () => completed.slice(),
      loadNotas: () => ({ ...notas }),
      saveNotas: () => true,
      aplicarNota: (state) => state
    },
    hoje,
    catalogo: Promise.resolve(CATALOGO)
  });
  await esperar();
  return { doc, raiz, storage, inst };
}

/** N cartões devidos, escritos pelo núcleo (um por aula, criados há 4 dias). */
function arquivoDeCartoes(quantidade, { estacao = 0 } = {}) {
  let arquivo = { versao: 1, cartoes: {} };
  for (let i = 1; i <= quantidade; i += 1) {
    const curso = ESTACOES[(estacao + i) % ESTACOES.length];
    const r = criarCartao(
      arquivo,
      {
        estacao: curso.id,
        aula: `aula-${i}`,
        n: i,
        frente: `Pergunta ${i}?`,
        verso: `Resposta ${i}.`
      },
      '2026-11-01T10:00',
      `c${i}`
    );
    assert.equal(r.ok, true, `fixture: cartão ${i} recusado (${r.erro})`);
    arquivo = { versao: 1, cartoes: r.cartoes };
  }
  return serializarCartoes(arquivo);
}

/**
 * O estado em que a tela foi deixada, lido da CLASSE DA RAIZ — e não por busca
 * de texto: se a frase mudar, o teste tem de cair na FRASE que a régua pede, e
 * não silenciosamente no seletor do estado.
 */
const estaEm = (raiz, estado) => {
  const classes = (raiz.children[0]?.className || '').split(/\s+/);
  assert.ok(classes.includes(`revisar-${estado}`), `a tela não está no estado "${estado}": ${classes.join(' ')}`);
};

// ═══════════════════════ 1. os quatro estados ═══════════════════════

test('S15b · abertura: a frase com o TOTAL e os minutos do CORTE, quando há fila', async () => {
  const { raiz, storage } = await fila({ cartoes: arquivoDeCartoes(3) });
  estaEm(raiz, 'abertura');

  // Os dois números vêm de lados diferentes, de propósito: o total é a fila
  // inteira, o minuto é o que a sessão de hoje mostra.
  const titulo = um(raiz, 'revisar-titulo', 'abertura');
  assert.equal(titulo.textContent, T.hoje(3, minutosDaFila(3)), 'a abertura não diz o total e os minutos');
  assert.equal(titulo.tag, 'h1', 'a medida da fila tem de ser o maior texto do estado');

  // Com 3 cartões não há corte: a linha só existe quando a fila passa do teto.
  assert.equal(comClasse(raiz, 'revisar-corte').length, 0, 'a linha do corte apareceu sem a fila passar do teto');

  // O primário único, e o storage ainda intocado: abrir não é responder.
  const primario = um(raiz, 'revisar-primario', 'abertura');
  assert.equal(primario.textContent, T.comecar, 'o único primário da abertura não é Começar');
  assert.equal(primario.tag, 'button', 'Começar é ação, não destino');
  assert.equal(storage.getItem(CARTOES_KEY), arquivoDeCartoes(3), 'a abertura sozinha mudou o arquivo de cartões');
});

test('S15b · cartão: frente, origem com a aula, e o verso escondido até o pedido', async () => {
  const { raiz } = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  estaEm(raiz, 'cartao');

  const frente = um(raiz, 'revisar-frente', 'cartão');
  assert.equal(frente.textContent, 'Pergunta 1?', 'a frente do primeiro cartão não é a pergunta escrita');
  assert.equal(frente.tag, 'h1', 'a pergunta é o maior texto da tela do cartão');
  assert.equal(textoDe(raiz).includes('Resposta 1.'), false, 'o verso apareceu antes do "Mostrar a resposta"');
  assert.equal(peloTexto(raiz, T.tentarLembrar) !== null, true, 'a tela não pede para tentar lembrar antes de ver');

  // A origem: a estação pelo NOME do catálogo, e o número do cartão.
  const origem = um(raiz, 'revisar-origem', 'origem do cartão');
  const curso = ESTACOES[1];
  assert.equal(origem.textContent, T.origemAula(1, curso.title), 'a origem não diz aula e estação');
  assert.equal(textoDe(raiz).includes(curso.id), false, 'a origem mostrou o id da estação em vez do nome');

  // Posição, não placar.
  assert.equal(um(raiz, 'revisar-posicao', 'posição').textContent, T.posicao(1, 2), 'a posição não é "1 de 2"');

  // A confiança opcional: três escolhas, nenhuma marcada, e o rótulo da pergunta.
  const grupo = um(raiz, 'revisar-confianca', 'confiança');
  assert.equal(grupo.getAttribute('aria-label'), T.seguro, 'o grupo da confiança não tem rótulo');
  const opcoes = comClasse(raiz, 'revisar-confianca-opcao');
  assert.deepEqual(opcoes.map((b) => b.textContent), Object.values(T.confiancas), 'as três escolhas de confiança não são as do core');
  assert.equal(opcoes.filter((b) => b.getAttribute('aria-pressed') === 'true').length, 0, 'uma confiança veio marcada antes da pessoa escolher');

  // O primário é UM, e é "Mostrar a resposta".
  assert.equal(primarios(raiz).length, 1, `estadо do cartão tem ${primarios(raiz).length} primários`);
  assert.equal(primarios(raiz)[0].textContent, T.mostrarResposta);

  tocar(um(raiz, 'revisar-primario', 'mostrar'));
  estaEm(raiz, 'cartao');
  assert.equal(um(raiz, 'revisar-verso', 'verso').textContent, 'Resposta 1.', 'o verso não é o que a pessoa escreveu');
  const acoes = comClasse(raiz, 'revisar-resposta');
  assert.deepEqual(acoes.map((b) => b.textContent), [T.errei, T.lembrei], 'as duas respostas não são Errei e Lembrei, nessa ordem');
  assert.equal(primarios(raiz).length, 0, 'depois de ver o verso ainda há um primário: os dois botões precisam do mesmo peso');
  assert.equal(comClasse(raiz, 'revisar-primario').length + comClasse(raiz, 'botao-primario').length, 0,
    'restou um recheio de primário na tela do cartão');
});

test('S15b · cartão de estação (n nulo): só a estação, sem inventar aula', async () => {
  const id = ESTACOES[0].id;
  // `agendarConclusao` marca o primeiro reencontro 3 dias depois da conclusão
  // (INTERVALOS[0]): concluída em 02/11, o cartão migrado vence em 05/11 — que é
  // o HOJE desta cena. Fixar outro dia daria um Em dia verde sem fila nenhuma, e
  // a cena não estaria olhando um cartão de estação nenhum.
  const { raiz } = await fila({
    revisoes: serializeRevisoes(agendarConclusao({}, id, '2026-11-02')),
    notas: { [id]: 'A anotação que a pessoa escreveu na estação.' },
    hoje: '2026-11-05'
  });
  estaEm(raiz, 'abertura');
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  estaEm(raiz, 'cartao');
  assert.equal(um(raiz, 'revisar-origem', 'origem migrada').textContent, NOME_DA_PRIMEIRA,
    'o cartão migrado pediu um número de aula que ele não tem');
  assert.equal(um(raiz, 'revisar-frente', 'frente migrada').textContent, T.frenteMigrada(NOME_DA_PRIMEIRA),
    'a frente migrada não veio do core');
});

test('S15b · fim: o resumo do núcleo, a próxima revisão e as aulas lembradas', async () => {
  const { raiz, storage } = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  tocar(um(raiz, 'revisar-primario', 'mostrar 1'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));
  tocar(um(raiz, 'revisar-primario', 'mostrar 2'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));
  estaEm(raiz, 'fim');

  assert.equal(um(raiz, 'revisar-titulo', 'fim').textContent, T.fim(2, 2), 'o fim não diz quantos revisados e lembrados');

  // O prazo do fim é a DIFERENÇA em data local contra o `devidoEm` que o núcleo
  // gravou — e o número é lido do storage, nunca chumbado aqui: chumbar "2 dias"
  // faria esta régua quebrar quando o FSRS mudar de ideia, sem nada ter errado.
  const sub = um(raiz, 'revisar-sub', 'prazo do fim');
  const gravado = lerCartoes(storage.getItem(CARTOES_KEY));
  const maisProximo = [gravado.cartoes.c1.devidoEm, gravado.cartoes.c2.devidoEm].sort()[0];
  const dias = diasEntre(HOJE, maisProximo);
  assert.ok(dias > 0, `a sessão terminou com cartão vencendo hoje ou antes (${maisProximo})`);
  assert.equal(sub.textContent, T.proximaRevisao(T.prazoEmDias(dias)),
    `o prazo da tela não é a diferença até o devidoEm gravado (${dias} dias)`);

  // Os dois cartões foram o primeiro Lembrei das aulas deles, criados há 4 dias:
  // as duas aulas passaram a lembradas AQUI, e a tela nomeia as duas.
  const lembradas = comClasse(raiz, 'revisar-lembrada');
  assert.equal(lembradas.length, 2, `a tela não disse quais aulas passaram a lembradas (${lembradas.length})`);
  assert.equal(lembradas[0].textContent, T.aulaLembrada(T.origemAula(1, ESTACOES[1].title)), 'a aula lembrada foi nomeada errado');

  assert.equal(primarios(raiz).length, 1, 'o fim não tem um único primário');
  assert.equal(primarios(raiz)[0].textContent, T.voltarJornada);
});

test('S15b · fim com um Errei: o placar conta os lembrados, não os respondidos', async () => {
  const { raiz } = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  tocar(um(raiz, 'revisar-primario', 'mostrar 1'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.errei));
  tocar(um(raiz, 'revisar-primario', 'mostrar 2'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));
  estaEm(raiz, 'fim');
  assert.equal(um(raiz, 'revisar-titulo', 'fim').textContent, T.fim(2, 1), 'Errei entrou como lembrado');
  assert.equal(comClasse(raiz, 'revisar-lembrada').length, 1, 'a aula do Errei foi dita lembrada');
});

test('S15b · em dia: há cartões agendados, nenhum para hoje', async () => {
  const { raiz } = await fila({ cartoes: arquivoDeCartoes(2), hoje: '2026-11-01' });
  estaEm(raiz, 'em-dia');
  assert.equal(um(raiz, 'revisar-titulo', 'em dia').textContent, T.emDia);
  // A data legível, e nada de ISO no bilhete. Criados em 01/11, os cartões vencem
  // em 02/11 — o dia vem do arquivo, e a régua o escreve como a tela o mostra.
  assert.equal(um(raiz, 'revisar-sub', 'prazo').textContent, T.proximaEm('02/11/2026'),
    'a próxima revisão não saiu em data legível');
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(textoDe(raiz)), false, 'a tela mostrou ISO');
  assert.equal(peloTexto(raiz, T.semPressao) !== null, true, 'o em dia perdeu a linha sem cobrança');
  // O que substituiu a caixa "Como funciona": UMA linha discreta, sem passos.
  assert.equal(um(raiz, 'revisar-metodo', 'método').textContent, T.metodo, 'o método não é a linha única do core');
  assert.equal(comClasse(raiz, 'revisar-como').length, 0, 'voltou a caixa "Como funciona"');
  assert.equal(primarios(raiz).length, 1, 'o em dia não tem um único primário');
});

test('S15b · sem cartão nenhum: a fila começa no fechamento, e a tela leva até lá', async () => {
  const { raiz } = await fila({ cartoes: null });
  estaEm(raiz, 'sem-cartao');
  assert.equal(um(raiz, 'revisar-titulo', 'sem cartão').textContent, T.comecaNoCartao);
  const primario = um(raiz, 'revisar-primario', 'sem cartão');
  assert.equal(primario.tag, 'a', 'a saída de quem não tem cartão é um destino, não uma ação');
  assert.equal(primario.textContent, T.proximaAula, 'a saída não leva à próxima aula');
  assert.match(primario.getAttribute('href'), new RegExp(`^#/estacao/${SLUG_DA_PRIMEIRA}/aulas$`),
    'o link não abre a lista de aulas da próxima estação');
  assert.equal(primarios(raiz).length, 1, 'o estado sem cartão tem mais de um primário');
});

// ═══════════════════ 2. o fluxo de dois cartões, no storage ═══════════════════

test('S15b · fluxo: um Errei e um Lembrei terminam com historico 1, lapsos 1 no primeiro e devido depois de hoje', async () => {
  const { raiz, storage } = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  tocar(um(raiz, 'revisar-primario', 'mostrar 1'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.errei));
  tocar(um(raiz, 'revisar-primario', 'mostrar 2'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));

  const gravado = lerCartoes(storage.getItem(CARTOES_KEY));
  const um1 = gravado.cartoes.c1;
  const um2 = gravado.cartoes.c2;

  assert.equal(um1.historico.length, 1, 'o cartão 1 não terminou com exatamente uma resposta');
  assert.equal(um2.historico.length, 1, 'o cartão 2 não terminou com exatamente uma resposta');
  assert.equal(um1.fsrs.lapsos, 1, 'Errei não subiu o contador de lapsos');
  assert.equal(um2.fsrs.lapsos, 0, 'Lembrei contou como lapso');
  assert.equal(um1.fsrs.repeticoes, 1);
  assert.ok(um1.devidoEm > HOJE, `oErrei venceu hoje ainda: ${um1.devidoEm}`);
  assert.ok(um2.devidoEm > HOJE, `oLembrei venceu hoje ainda: ${um2.devidoEm}`);

  // A chave antiga não é tocada nem apagada pela sessão.
  assert.equal(storage.getItem(STORAGE_KEY), null, 'a sessão escreveu na chave da revisão antiga');
});

test('S15b · confiança escolhida chega ao historico, e a não escolhida fica nula', async () => {
  const { raiz, storage } = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  const opcoes = comClasse(raiz, 'revisar-confianca-opcao');
  tocar(opcoes.find((b) => b.getAttribute('data-confianca') === 'certeza'));
  assert.equal(
    comClasse(raiz, 'revisar-confianca-opcao').find((b) => b.getAttribute('data-confianca') === 'certeza').getAttribute('aria-pressed'),
    'true', 'a escolha marcada não voltou pressionada na repintura'
  );
  tocar(um(raiz, 'revisar-primario', 'mostrar 1'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));

  // Cartão 2: ninguém toca em confiança nenhuma.
  tocar(um(raiz, 'revisar-primario', 'mostrar 2'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));

  const gravado = lerCartoes(storage.getItem(CARTOES_KEY));
  assert.equal(gravado.cartoes.c1.historico[0].confianca, 'certeza', 'a confiança não chegou ao histórico');
  assert.equal(gravado.cartoes.c2.historico[0].confianca, null, 'sem escolha o histórico não pode chutar uma confiança');
  assert.equal(gravado.cartoes.c2.historico[0].nota, 'lembrei');
});

test('S15b · desescolher a confiança volta a nulo: nenhum botão é obrigatório', async () => {
  const { raiz, storage } = await fila({ cartoes: arquivoDeCartoes(1) });
  tocar(um(raiz, 'revisar-primario', 'abertura'));
  tocar(comClasse(raiz, 'revisar-confianca-opcao').find((b) => b.getAttribute('data-confianca') === 'chute'));
  tocar(comClasse(raiz, 'revisar-confianca-opcao').find((b) => b.getAttribute('data-confianca') === 'chute'));
  tocar(um(raiz, 'revisar-primario', 'mostrar'));
  tocar(comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));
  assert.equal(lerCartoes(storage.getItem(CARTOES_KEY)).cartoes.c1.historico[0].confianca, null,
    'tocar duas vezes na mesma escolha deixou uma confiança gravada');
});

// ═══════════════════ 3. o teto da fila ═══════════════════

test('S15b · fila acima do teto: a linha do corte aparece e só LIMITE_FILA cartões passam', async () => {
  const total = LIMITE_FILA + 5;
  const { raiz } = await fila({ cartoes: arquivoDeCartoes(total) });
  estaEm(raiz, 'abertura');

  assert.equal(um(raiz, 'revisar-titulo', 'abertura').textContent, T.hoje(total, minutosDaFila(LIMITE_FILA)),
    'a abertura prometeu os minutos da fila toda em vez dos da sessão');
  assert.equal(um(raiz, 'revisar-corte', 'corte').textContent, T.corte(LIMITE_FILA),
    'passou do teto e a linha do corte não veio (ou veio com outro número)');

  tocar(um(raiz, 'revisar-primario', 'abertura'));
  assert.equal(um(raiz, 'revisar-posicao', 'posição').textContent, T.posicao(1, LIMITE_FILA),
    'a posição disse "de" um total diferente do teto');

  // A prova de que só 20 passam é a sessão inteira, não um número lido do array.
  let respostas = 0;
  for (let i = 0; i < LIMITE_FILA + 2; i += 1) {
    if ((raiz.children[0]?.className || '').includes('revisar-fim')) break;
    const mostrar = comClasse(raiz, 'revisar-primario').find((b) => b.textContent === T.mostrarResposta);
    if (mostrar) tocar(mostrar);
    const responder = comClasse(raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei);
    if (!responder) break;
    tocar(responder);
    respostas += 1;
  }
  estaEm(raiz, 'fim');
  assert.equal(respostas, LIMITE_FILA, `a sessão respondeu ${respostas} cartões, não ${LIMITE_FILA}`);
  assert.equal(um(raiz, 'revisar-titulo', 'fim').textContent, T.fim(LIMITE_FILA, LIMITE_FILA));
});

// ═══════════════════ 4. a migração na abertura ═══════════════════

test('S15b · migração: a revisão antiga com anotação entra na fila, e uma segunda montagem não duplica', async () => {
  const id = ESTACOES[0].id;
  // Mesmo caso da cena anterior: concluída em 02/11, o primeiro reencontro da
  // revisão antiga é 3 dias depois, e é aí que o cartão migrado cai na fila.
  const antigas = serializeRevisoes(agendarConclusao({}, id, '2026-11-02'));

  const primeiro = await fila({ revisoes: antigas, notas: { [id]: 'Anotação antiga.' }, hoje: '2026-11-05' });
  const gravado = lerCartoes(primeiro.storage.getItem(CARTOES_KEY));
  assert.equal(Object.keys(gravado.cartoes).length, 1, 'a migração não criou exatamente um cartão');
  assert.ok(gravado.cartoes[`migr-${id}`], `o id determinístico não chegou: ${Object.keys(gravado.cartoes)}`);
  assert.equal(primeiro.storage.getItem(STORAGE_KEY), antigas, 'a chave antiga foi apagada ou reescrita');

  // A SEGUNDA montagem lê o storage onde a primeira já gravou: sem o id
  // determinístico, aqui nasceriam dois cartões para a mesma estação.
  const segundo = await fila({
    cartoes: primeiro.storage.getItem(CARTOES_KEY),
    revisoes: primeiro.storage.getItem(STORAGE_KEY),
    notas: { [id]: 'Anotação antiga.' },
    hoje: '2026-11-05'
  });
  const reles = lerCartoes(segundo.storage.getItem(CARTOES_KEY));
  assert.equal(Object.keys(reles.cartoes).length, 1, 'a segunda montagem duplicou o cartão migrado');

  // Migrado não é aula: a fila não oferece a frente "Aula null".
  tocar(um(segundo.raiz, 'revisar-primario', 'abertura'));
  assert.equal(comClasse(segundo.raiz, 'revisar-lembrada').length, 0);
  assert.equal(um(segundo.raiz, 'revisar-origem', 'origem').textContent, NOME_DA_PRIMEIRA);
});

test('S15b · sem anotação não há cartão: a fila não inventa pergunta para quem nada escreveu', async () => {
  const id = ESTACOES[0].id;
  const { storage } = await fila({
    revisoes: serializeRevisoes(agendarConclusao({}, id, '2026-11-02')),
    notas: {},
    hoje: '2026-11-02'
  });
  assert.equal(storage.getItem(CARTOES_KEY), null, 'a migração criou cartão sem anotação');
});

// ═══════════════════ 5. o primário é único em cada estado ═══════════════════

test('S15b · um único primário nos estados que têm primário, e nenhum onde os dois pesam igual', async () => {
  const casos = [];
  casos.push(['sem cartão', await fila({ cartoes: null }), 1]);
  casos.push(['abertura', await fila({ cartoes: arquivoDeCartoes(2) }), 1]);
  casos.push(['em dia', await fila({ cartoes: arquivoDeCartoes(2), hoje: '2026-11-01' }), 1]);

  const antes = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(antes.raiz, 'revisar-primario', 'abertura'));
  casos.push(['cartão, antes de ver', antes, 1]);

  // Depois de ver o verso, ERRO: o par Errei/Lembrei tem o mesmo peso e nenhum
  // pode ser primário. Um zero aqui é a régua do desenho, não uma exceção.
  const depois = await fila({ cartoes: arquivoDeCartoes(2) });
  tocar(um(depois.raiz, 'revisar-primario', 'abertura'));
  tocar(um(depois.raiz, 'revisar-primario', 'mostrar'));
  casos.push(['cartão, depois de ver', depois, 0]);

  const fim = await fila({ cartoes: arquivoDeCartoes(1) });
  tocar(um(fim.raiz, 'revisar-primario', 'abertura'));
  tocar(um(fim.raiz, 'revisar-primario', 'mostrar'));
  tocar(comClasse(fim.raiz, 'revisar-resposta').find((b) => b.textContent === T.lembrei));
  casos.push(['fim', fim, 1]);

  for (const [nome, { raiz }, esperado] of casos) {
    const comClassePrimario = primarios(raiz);
    assert.equal(comClassePrimario.length, esperado, `${nome}: ${comClassePrimario.length} elementos com a classe do primário (esperado ${esperado})`);
    if (esperado === 0) continue;
    // O RECHEIO (a classe do design system) tem de estar no mesmo elemento: se a
    // tela der `botao-primario` a um botão e `revisar-primario` a outro, há dois.
    const comRecheio = comClasse(raiz, 'botao-primario');
    assert.equal(comRecheio.length, 1, `${nome}: ${comRecheio.length} elementos com o recheio de primário`);
    assert.equal(comRecheio[0], comClassePrimario[0], `${nome}: o primário contado é outro do primário desenhado`);
  }
});

// ═══════════════════ 6. a lista do proibido nas frases novas ═══════════════════

test('S15b · as frases do bloco revisar não dizem nada do proibido (design/README §9)', () => {
  const frases = [];
  const coletar = (v) => {
    if (typeof v === 'string') { frases.push(v); return; }
    if (typeof v === 'function') {
      // Chama com os números que a tela usaria: a frase montada é a que aparece.
      coletar(v(3, 7));
      coletar(v(3, 'Circuitos Digitais'));
      coletar(v('Circuitos Digitais'));
      coletar(v(1, 6));
      coletar(v(2));
      coletar(v('12/11/2026'));
      return;
    }
    if (v && typeof v === 'object') for (const x of Object.values(v)) coletar(x);
  };
  coletar(T);
  assert.ok(frases.length >= 12, `o bloco revisar tem poucas frases (${frases.length}): a régua viria verde sem olhar nada`);

  const veneno = [
    [/\bXP\b/, 'XP'],
    [/sequ[êe]ncia/i, 'sequência de dias'],
    [/ranking/i, 'ranking'],
    [/medalha|trof[ée]u/i, 'conquista sem critério'],
    [/confete/i, 'confete'],
    [/spinner/i, 'spinner'],
    [/\p{Extended_Pictographic}/u, 'emoji'],
    [/parab[ée]ns/i, 'parabéns'],
    [/note card|flashcard|deck/i, 'palavra em inglês'],
    [/\b streak \b/i, 'streak']
  ];
  for (const frase of frases) {
    for (const [re, rotulo] of veneno) {
      assert.ok(!re.test(frase), `a frase diz «${rotulo}» (${frase}) — proibido`);
    }
  }
});

test('S15b · nenhuma frase do revisar vira número chumbado: os números são argumentos', () => {
  // A tela diz "20" lendo LIMITE_FILA, e "6" lendo o tamanho da fila. Se um
  // número aparecer fixo numa frase do bloco, a régua do corte quebra quando o
  // teto mudar.
  const comNumero = Object.entries(T)
    .filter(([, v]) => typeof v === 'string' && /\d/.test(v))
    .map(([k, v]) => `${k}: ${v}`);
  assert.deepEqual(comNumero, [], `frase com número escrito no texto de tela: ${comNumero.join(' | ')}`);
});
