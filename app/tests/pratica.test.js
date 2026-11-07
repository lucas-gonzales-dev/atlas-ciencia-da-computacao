// Projeto Atlas — a PRÁTICA da aula (S25, 06/11/2026). Núcleo puro.
//
// POR QUE EXISTE: o portão é a peça do Atlas que fala com dados escritos à mão
// por outra pessoa, num arquivo que o app só vê em tempo de navegador. Duas
// coisas este arquivo veio impedir:
//
// 1. **A tela branca por um vírgula.** `lerPratica` receber o JSON e lançar é
//    a aula inteira em branco no celular de quem está no ônibus — o mesmo
//    formato de defeito que a S19c matou no armazenamento. Por isso os casos
//    de entrada podre são todos do lado de dentro do contrato: devolve `[]`,
//    nunca estoura.
// 2. **A rotação errada, em silêncio.** Se `perguntasDaAula` devolvesse sempre
//    as três primeiras, a estação inteira repetiria a mesma pergunta e nada na
//    tela denunciaria: a pessoa faria duas aulas seguidas com o mesmo `1011`.
//    A régua abaixo confere os índices, não a cara da frase.
//
// O varredor do JSON real (última seção) é o que impede o conteúdo de entrar
// no app quebrado: o arquivo é lido pelo navegador e por nada mais, e um `id`
// repetido ou uma errada igual à certa só apareceriam na tela da pessoa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUANTAS_POR_AULA,
  lerPratica,
  opcoesDaPergunta,
  paradaDaAula,
  perguntasDaAula
} from '../core/pratica.js';

/** Uma pergunta inteira, do jeito que o arquivo de verdade escreve. */
const PERGUNTA = {
  id: 'p1',
  pergunta: 'Quanto vale 1011 em binário?',
  certa: '11',
  explica: '8 + 0 + 2 + 1.',
  erradas: [
    { texto: '13', vao: 'Pesos de trás para frente.' },
    { texto: '7', vao: 'O 1 da esquerda pesa 8.' }
  ]
};

const irma = { ...PERGUNTA, id: 'p2', pergunta: 'E 1100?', certa: '12', erradas: [{ texto: '10', vao: 'v' }] };
const terceira = { ...PERGUNTA, id: 'p3', pergunta: 'E 1001?', certa: '9', erradas: [{ texto: '8', vao: 'v' }] };
const quarta = { ...PERGUNTA, id: 'p4', pergunta: 'E 1111?', certa: '15', erradas: [{ texto: '9', vao: 'v' }] };

const paradaDe = (aulas, perguntas) => ({ id: 'x', titulo: 'X', aulas, perguntas });
const arquivoDe = (paradas) => ({ versao: 1, estacao: 'x', paradas });
/** UMA parada no arquivo: evita o quádruplo aninhamento de parêntese que já
 *  derrubou este arquivo na parse (a suíte não vê meia linha). */
const praticaDe = (aulas, perguntas) => lerPratica(arquivoDe([paradaDe(aulas, perguntas)]));

// ── lerPratica: o que entra e o que sobra ───────────────────────────────────
test('um arquivo inteiro válido passa sem perder pergunta nenhuma', () => {
  const bruto = arquivoDe([paradaDe([2, 3], [PERGUNTA, irma, terceira, quarta])]);
  const lida = lerPratica(bruto);
  assert.equal(lida.paradas.length, 1);
  assert.equal(lida.paradas[0].perguntas.length, 4);
  assert.deepEqual(lida.paradas[0].aulas, [2, 3]);
  assert.equal(lida.paradas[0].perguntas[0].id, 'p1');
  assert.equal(lida.paradas[0].perguntas[0].explica, '8 + 0 + 2 + 1.');
});

test('entrada podre devolve `{ paradas: [] }` e não lança', () => {
  for (const bruto of [
    undefined, null, 0, 'json', [], true,
    {},
    { paradas: null },
    { paradas: 'x' },
    { paradas: [] },
    { paradas: [null, 'x', 7, []] },
    { paradas: [{ aulas: '2', perguntas: 'tudo' }] }
  ]) {
    let saida;
    assert.doesNotThrow(() => { saida = lerPratica(bruto); }, `lançou em ${JSON.stringify(bruto)}`);
    assert.deepEqual(saida, { paradas: [] }, `aceitou ${JSON.stringify(bruto)}`);
  }
});

test('pergunta sem id, sem texto, sem certa ou sem errada é descartada; as irmãs ficam', () => {
  const quebradas = [
    { ...PERGUNTA, id: '' },
    { ...PERGUNTA, id: null },
    { ...PERGUNTA, pergunta: '   ' },
    { ...PERGUNTA, pergunta: undefined },
    { ...PERGUNTA, certa: '' },
    { ...PERGUNTA, erradas: [] },
    { ...PERGUNTA, erradas: null },
    { ...PERGUNTA, erradas: [{ texto: '' }, { texto: '   ' }, { texto: null }, null] },
    null,
    'string',
    7
  ];
  const lida = lerPratica(arquivoDe([paradaDe([2], [...quebradas, PERGUNTA])]));
  assert.equal(lida.paradas[0].perguntas.length, 1, 'sobrou alguma pergunta que não dava para desenhar');
  assert.equal(lida.paradas[0].perguntas[0].id, 'p1', 'a que sobrou não é a íntegra');
});

test('uma errada sem `vao` continua válida: a faixa sai só com o título', () => {
  const lida = praticaDe([2], [{ ...PERGUNTA, erradas: [{ texto: '13' }, '10'] }]);
  const pergunta = lida.paradas[0].perguntas[0];
  assert.equal(pergunta.erradas.length, 2);
  assert.equal(pergunta.erradas[0].vao, null);
  assert.equal(pergunta.erradas[0].texto, '13');
  assert.equal(pergunta.erradas[1].texto, '10', 'a forma curta (string solta) foi perdida');
});

test('sem `explica` a pergunta não morre: vem string vazia', () => {
  const lida = praticaDe([2], [{ id: 'p', pergunta: 'q', certa: 'c', erradas: ['e'] }]);
  assert.equal(lida.paradas[0].perguntas[0].explica, '');
});

test('parada sem `aulas` não entra: não há como achegar nela', () => {
  const lida = lerPratica(arquivoDe([
    { id: 'a', titulo: 'A', perguntas: [PERGUNTA] },
    { id: 'b', titulo: 'B', aulas: ['2', 3, null, 'x', 4.5], perguntas: [PERGUNTA] }
  ]));
  assert.equal(lida.paradas.length, 1, 'a parada sem aulas entrou');
  assert.deepEqual(lida.paradas[0].aulas, [2, 3], 'as aulas não numéricas ficaram');
});

// ── paradaDaAula ────────────────────────────────────────────────────────────
test('paradaDaAula acha pelo número, e pela string do endereço', () => {
  const pratica = lerPratica(arquivoDe([paradaDe([5, 6, 7, 8], [PERGUNTA]), paradaDe([10, 11], [PERGUNTA])]));
  assert.equal(pratica.paradas[0], paradaDaAula(pratica, 5));
  assert.equal(pratica.paradas[0], paradaDaAula(pratica, '7'), 'o endereço entrega "7" e o núcleo compara com 7');
  assert.equal(pratica.paradas[1], paradaDaAula(pratica, 11));
  assert.equal(paradaDaAula(pratica, 9), null, 'aula fora de toda parada achou uma parada');
  assert.equal(paradaDaAula(pratica, 99), null);
  assert.equal(paradaDaAula(pratica, ''), null);
  assert.equal(paradaDaAula(pratica, undefined), null);
  assert.equal(paradaDaAula(null, 3), null, 'prática inexistente lançou');
  assert.equal(paradaDaAula({ paradas: null }, 3), null);
});

// ── a rotação ───────────────────────────────────────────────────────────────
test('cada aula da parada começa num índice diferente do anterior', () => {
  const perguntas = [PERGUNTA, irma, terceira, quarta,
    { ...PERGUNTA, id: 'p5' }, { ...PERGUNTA, id: 'p6' }, { ...PERGUNTA, id: 'p7' }];
  const pratica = lerPratica(arquivoDe([paradaDe([5, 6, 7, 8], perguntas)]));
  const idsDe = (n) => perguntasDaAula(pratica, n).map((p) => p.id);
  // posição × 3, módulo 7: 0→p1..p3 · 3→p4..p6 · 6→p7 e volta ao p1 · 9%7=2→p3..p5
  assert.deepEqual(idsDe(5), ['p1', 'p2', 'p3']);
  assert.deepEqual(idsDe(6), ['p4', 'p5', 'p6']);
  assert.deepEqual(idsDe(7), ['p7', 'p1', 'p2'], 'o índice passou do fim e não voltou ao começo');
  assert.deepEqual(idsDe(8), ['p3', 'p4', 'p5']);
});

test('a rotação nunca repete pergunta dentro da mesma aula', () => {
  const perguntas = [PERGUNTA, irma, terceira];
  const pratica = lerPratica(arquivoDe([paradaDe([2, 3, 4], perguntas)]));
  for (const n of [2, 3, 4]) {
    const ids = perguntasDaAula(pratica, n).map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `aula ${n} repetiu pergunta: ${ids}`);
    assert.ok(ids.length <= QUANTAS_POR_AULA, `aula ${n} passou do teto`);
  }
});

// Repetir a MESMA pergunta algumas aulas depois é prática de recuperação, e é
// o que a fórmula da especificação faz de propósito: com 3 aulas e 6 perguntas,
// a terceira aula volta às perguntas da primeira (posição 2 × 3 = 6, módulo 6 = 0).
test('a rotação repete a pergunta em outra aula, e isso é deliberado', () => {
  const perguntas = [PERGUNTA, irma, terceira, quarta,
    { ...PERGUNTA, id: 'p5' }, { ...PERGUNTA, id: 'p6' }];
  const pratica = lerPratica(arquivoDe([paradaDe([2, 3, 4], perguntas)]));
  const idsDe = (n) => perguntasDaAula(pratica, n).map((p) => p.id);
  assert.deepEqual(idsDe(2), ['p1', 'p2', 'p3']);
  assert.deepEqual(idsDe(3), ['p4', 'p5', 'p6'], 'a aula do meio não andou na parada');
  assert.deepEqual(idsDe(4), ['p1', 'p2', 'p3'], 'a terceira aula NÃO voltou à primeira pergunta');
});

test('parada com menos perguntas que o teto devolve o que existe', () => {
  const pratica = lerPratica(arquivoDe([paradaDe([2, 3], [PERGUNTA, irma])]));
  assert.deepEqual(perguntasDaAula(pratica, 2).map((p) => p.id), ['p1', 'p2']);
  // aula 3: posição 1 → início 3 % 2 = 1 → [p2] e volta ao p1. A rotação continua
  // andando quando o arquivo tem menos perguntas que o teto.
  assert.deepEqual(perguntasDaAula(pratica, 3).map((p) => p.id), ['p2', 'p1'],
    'com 2 perguntas e QUANTAS 3, a aula 3 não rodou');
});

test('sem parada, sem perguntas ou sem prática: `[]` e nenhum lança', () => {
  assert.deepEqual(perguntasDaAula(lerPratica(arquivoDe([])), 3), []);
  assert.deepEqual(perguntasDaAula(lerPratica(arquivoDe([paradaDe([2], [])])), 2), []);
  assert.deepEqual(perguntasDaAula(null, 3), []);
  assert.deepEqual(perguntasDaAula({}, 3), []);
  assert.deepEqual(perguntasDaAula(lerPratica(arquivoDe([paradaDe([2], [PERGUNTA])])), 'x'), []);
});

test('QUANTAS_POR_AULA é 3: o portão tem três perguntas, não um número de module', () => {
  assert.equal(QUANTAS_POR_AULA, 3);
});

// ── opcoesDaPergunta ────────────────────────────────────────────────────────
test('as alternativas vêm em ordem de texto, e não dependem da ordem do arquivo', () => {
  const a = opcoesDaPergunta(PERGUNTA);
  const b = opcoesDaPergunta({ ...PERGUNTA, erradas: [...PERGUNTA.erradas].reverse() });
  assert.deepEqual(a.map((o) => o.texto), ['11', '13', '7'].sort((x, y) => x.localeCompare(y, 'pt-BR')));
  assert.deepEqual(a, b, 'trocar a ordem no arquivo trocou a tela: a ordem tem de ser fixa');
  assert.equal(a.length, 3, 'a certa sumiu da lista');
});

test('exatamente uma alternativa é `certa`, e só ela carrega a explicação', () => {
  const opcoes = opcoesDaPergunta(PERGUNTA);
  const certas = opcoes.filter((o) => o.certa);
  assert.equal(certas.length, 1);
  assert.equal(certas[0].texto, '11');
  assert.equal(certas[0].vao, null, 'a certa não tem vão');
  const erradas = opcoes.filter((o) => !o.certa);
  assert.equal(erradas.length, 2);
  assert.ok(erradas.every((o) => typeof o.vao === 'string' && o.vao.length > 0), 'errada perdeu o vão');
});

test('opcoesDaPergunta com pergunta quebrada devolve [], sem lançar', () => {
  for (const p of [null, undefined, {}, 'x', 7, { certa: '' }, { certa: 'c', erradas: 'x' }]) {
    assert.doesNotThrow(() => opcoesDaPergunta(p));
    if (opcoesDaPergunta(p).length) assert.deepEqual(opcoesDaPergunta(p), [], `inventou opção para ${JSON.stringify(p)}`);
  }
});

test('a certa repetida numa errada não vira duas alternativas', () => {
  const opcoes = opcoesDaPergunta({ ...PERGUNTA, erradas: [{ texto: '11', vao: 'x' }] });
  const textos = opcoes.map((o) => o.texto);
  assert.equal(new Set(textos).size, textos.length, `a mesma frase aparece duas vezes na tela: ${textos}`);
});

// ── o arquivo real do app ───────────────────────────────────────────────────
const BRUTO = JSON.parse(readFileSync(new URL('../data/pratica/circuitos-digitais.json', import.meta.url), 'utf8'));

test('o JSON real de circuitos-digitais passa inteiro no lerPratica', () => {
  const lida = lerPratica(BRUTO);
  assert.equal(lida.paradas.length, BRUTO.paradas.length,
    'pergunta ou parada do arquivo real caiu no descartante: o app nunca mostra isso');
  const totalReal = BRUTO.paradas.reduce((s, p) => s + p.perguntas.length, 0);
  const totalLido = lida.paradas.reduce((s, p) => s + p.perguntas.length, 0);
  assert.equal(totalLido, totalReal, `${totalReal - totalLido} perguntas do arquivo não chegam à tela`);
});

test('no arquivo real, nenhum id se repete e nenhuma errada é igual à certa', () => {
  const ids = new Set();
  const achados = [];
  for (const parada of lerPratica(BRUTO).paradas) {
    for (const pergunta of parada.perguntas) {
      if (ids.has(pergunta.id)) achados.push(`id repetido: ${pergunta.id}`);
      ids.add(pergunta.id);
      if (!pergunta.explica) achados.push(`${pergunta.id}: certa sem explicação`);
      for (const errada of pergunta.erradas) {
        if (errada.texto.trim() === pergunta.certa.trim()) achados.push(`${pergunta.id}: errada igual à certa («${errada.texto}»)`)
      }
      const opcoes = opcoesDaPergunta(pergunta);
      if (opcoes.filter((o) => o.certa).length !== 1) achados.push(`${pergunta.id}: nem uma certa`);
    }
  }
  assert.deepEqual(achados, [], `o conteúdo está podre no disco:\n${achados.join('\n')}`);
});

test('no arquivo real, cada aula coberta tem três perguntas e nenhuma estação inventa cobertura', () => {
  const pratica = lerPratica(BRUTO);
  for (const parada of pratica.paradas) {
    assert.ok(parada.perguntas.length >= 1, `parada ${parada.id} sem pergunta`);
    for (const n of parada.aulas) {
      const perguntas = perguntasDaAula(pratica, n);
      assert.equal(perguntas.length, Math.min(QUANTAS_POR_AULA, parada.perguntas.length),
        `aula ${n} saiu com ${perguntas.length} perguntas`);
      assert.equal(new Set(perguntas.map((p) => p.id)).size, perguntas.length);
    }
  }
  // A estação tem 93 aulas e o arquivo cobre 2, 3, 4, 5, 6, 7, 8, 10, 11, 12.
  assert.deepEqual(pratica.paradas.flatMap((p) => p.aulas).sort((a, b) => a - b),
    [2, 3, 4, 5, 6, 7, 8, 10, 11, 12]);
  assert.equal(perguntasDaAula(pratica, 1).length, 0, 'a aula 1 não tem parada e mesmo assim achou pergunta');
  assert.equal(perguntasDaAula(pratica, 9).length, 0, 'a aula 9 (baldeação) não tem parada');
});
