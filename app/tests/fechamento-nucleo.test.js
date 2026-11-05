// Projeto Atlas — S14b2 (commit 1), o NÚCLEO do fechamento e o item 0.
//
// POR QUE EXISTE: a fatia é duas telas e um commit. Este arquivo trava as quatro
// peças de núcleo que o formulário vai chamar quando o commit 2 o ligar — o
// rascunho, a conta dos minutos de amanhã, os textos novos e a linha de progresso
// que trocou de verbo. Sem elas, o formulário do commit 2 nasceria em cima de
// peças sem dona, que é como a S13b nasceu: a peça certa, o fio errado, a suíte
// verde e a tela em branco.
//
// A LIÇÃO DA S13b/S13e, aplicada daqui: nada de dublê de forma inventada. A linha
// de progresso é montada no mini-DOM com o resumo que o CORE devolve
// (resumoDaEstacao), com os números medidos no arquivo real de Circuitos
// Digitais — não com um objeto escrito à mão que o app nunca produz.
//
// O QUE O NODE NÃO PROVA: o relógio de 2:00 andando, o scroll suave, o
// navigator.storage.persist(). Nada disso é fingido aqui; é conferido no Chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RASCUNHO_PREFIXO, chaveRascunho, lerRascunho, rascunhoVazio, serializarRascunho,
  resumoDaEstacao, abrirAula, estudarAula, lerEstudo
} from '../core/estudo.js';
import { SEGUNDOS_POR_CARTAO, minutosDaFila } from '../core/cartoes.js';
import { duracaoLegivel } from '../core/aulas.js';
import { dataDeCalendario, fechamento as F, aulas as A, inseparavel } from '../core/textos.js';
import { linhaProgresso } from '../web/aulas-pedacos.js';
import { criarDoc, todos } from './hdom.js';
import { readFileSync } from 'node:fs';

const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const ESTACAO = 'ubl-core-circuitos-digitais';
const AULA_ID = AULAS.aulas[2].id;
// S20b-1a (item 2): `\s+` comia o U+00A0 da duração. Colapsa só o ASCII.
const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/[ \t\r\n]+/g, ' ').trim();
const comClasse = (raiz, classe) => todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));
const um = (raiz, classe, onde) => {
  const achei = comClasse(raiz, classe);
  assert.equal(achei.length, 1, `${onde}: esperado exatamente um .${classe}, achei ${achei.length}`);
  return achei[0];
};

// ── 1. o rascunho, que é a peça mais fácil de perder silêncio ─────────────
//
// Rascunho é texto que a pessoa digitou e ainda não decidiu guardar. Um bug aqui
// não aparece como erro na tela: aparece como a pessoa perdendo o que escreveu e
// nunca mais escrevendo nada. Por isso as três partes do contrato têm teste: a
// chave, o teto e a tolerância a lixo.

test('rascunho: a chave é por aula, e sem id de aula não há chave', () => {
  assert.equal(chaveRascunho(AULA_ID), `${RASCUNHO_PREFIXO}${AULA_ID}`);
  assert.equal(chaveRascunho(''), '', 'sem id, chave vazia: quem chama decide o que fazer');
  assert.equal(chaveRascunho(null), '');
  assert.equal(chaveRascunho(undefined), '');
  // Uma chave por aula é o que impede duas abas abertas em aulas diferentes de
  // sobrescrever uma à outra — a razão do prefixo, não um detalhe de nome.
  const outra = AULAS.aulas[3].id;
  assert.notEqual(chaveRascunho(outra), chaveRascunho(AULA_ID), 'duas aulas na mesma chave');
});

test('rascunho: ida e volta, e o que é lixo devolve rascunho vazio sem erro', () => {
  const cheio = { lembrar: '  metade do que eu vi  ', conferir: 'faltou o clock', cartoes: [{ frente: 'O que é XOR?', verso: 'ou exclusivo' }] };
  const lido = lerRascunho(serializarRascunho(cheio));
  assert.equal(lido.lembrar, 'metade do que eu vi', 'rascunho com espaços nas pontas');
  assert.equal(lido.conferir, 'faltou o clock');
  assert.deepEqual(lido.cartoes, [{ frente: 'O que é XOR?', verso: 'ou exclusivo' }]);

  for (const ruim of ['', '   ', null, undefined, '{', '[1,2]', 'não é json', '123', '[]']) {
    assert.deepEqual(lerRascunho(ruim), rascunhoVazio(), `lixo virou erro: ${JSON.stringify(ruim)}`);
  }
  // Outra versão não se mescla: devolve vazio e a pessoa recomeça, em vez de
  // receber campo que a tela de hoje não sabe mostrar.
  assert.deepEqual(lerRascunho(JSON.stringify({ versao: 999, lembrar: 'x', conferir: '', cartoes: [] })), rascunhoVazio());
});

test('rascunho: tetos — 2.000 por campo e 3 cartões, escritos ou lidos', () => {
  const longo = 'a'.repeat(3000);
  const serializado = JSON.parse(serializarRascunho({ lembrar: longo, conferir: longo, cartoes: Array.from({ length: 9 }, (_, i) => ({ frente: longo, verso: 'v' + i })) }));
  assert.equal(serializado.lembrar.length, 2000, 'campo de rascunho sem teto');
  assert.equal(serializado.conferir.length, 2000);
  assert.equal(serializado.cartoes.length, 3, 'mais cartões do que a tela desenha');
  assert.equal(serializado.cartoes[0].frente.length, 2000);
  // Ler um rascunho que já veio grande (colado, ou de uma versão mais frouxa) tem
  // de cortar na entrada também: o teto é do formato, não da bondade de quem escreveu.
  const lido = lerRascunho(JSON.stringify({ versao: 1, lembrar: longo, conferir: '', cartoes: [{ frente: longo, verso: 'v' }] }));
  assert.equal(lido.lembrar.length, 2000);
  assert.equal(lido.cartoes[0].frente.length, 2000);
});

test('rascunho: um cartão pela metade continua sendo um par, e lixo entre os cartões some', () => {
  const lido = lerRascunho(JSON.stringify({
    versao: 1, lembrar: '', conferir: '',
    cartoes: [{ frente: 'so a pergunta', verso: null }, 'xuxu', 42, null, { frente: 'p', verso: 'v' }]
  }));
  assert.deepEqual(lido.cartoes, [{ frente: 'so a pergunta', verso: '' }, { frente: 'p', verso: 'v' }]);

  // O caso que achou o defeito (04/11/2026): lixo ANTES do cartão válido. Com o
  // teto aplicado antes do filtro, isto devolvia [] — a pessoa perdia o cartão
  // escrito por causa de três entradas que nem cartão eram.
  const depois = lerRascunho(JSON.stringify({
    versao: 1, lembrar: '', conferir: '',
    cartoes: [null, 'x', 7, { frente: 'sobrevive', verso: 'a' }]
  }));
  assert.deepEqual(depois.cartoes, [{ frente: 'sobrevive', verso: 'a' }], 'lixo comeu o cartão válido');
});

// ── 2. a conta de amanhã ──────────────────────────────────────────────────

test('minutosDaFila: 20 s por cartão, arredondado para cima, nunca menos de 1', () => {
  assert.equal(SEGUNDOS_POR_CARTAO, 20, 'o arbitrado mudou sem a conta acompanhar');
  assert.equal(minutosDaFila(0), 0, 'nada devido não é um minuto');
  assert.equal(minutosDaFila(1), 1, 'um cartão de 20 s leria "0 min"');
  assert.equal(minutosDaFila(3), 1, 'três cartões = 60 s = 1 min');
  assert.equal(minutosDaFila(4), 2, '80 s arredondam PARA CIMA');
  assert.equal(minutosDaFila(20), 7, 'a fila cheia (LIMITE_FILA) precisa de conta certa');
  assert.equal(minutosDaFila(-2), 0);
  assert.equal(minutosDaFila(NaN), 0);
  assert.equal(minutosDaFila('3'), 1, 'texto do storage entra como número');
});

// ── 3. os textos novos, que a tela do commit 2 vai usar ───────────────────

test('textos fechamento: as frases novas existem e dizem o que o desenho escreveu', () => {
  assert.equal(F.modoCompleto, 'Fazer o fechamento completo');
  assert.equal(F.tempo, 'Tempo. Pode seguir.');
  assert.equal(F.reabrir, 'Reabrir a aula no YouTube');
  assert.equal(F.origem(3, 'Circuitos Digitais'), 'Origem: Aula 3 · Circuitos Digitais');
  assert.equal(F.passoCartoes.frente, 'Pergunta');
  assert.equal(F.passoCartoes.verso, 'Resposta');
  assert.equal(F.passoCartoes.mais, 'Outro cartão');
  assert.equal(F.passoCartoes.limite, 'Até 3 cartões por aula.');
  assert.equal(F.faltaLembrar, 'Escreva o que você lembra antes de fechar a aula.');
  assert.equal(F.faltaCartao, 'Escreva ao menos um cartão, com pergunta e resposta.');
  assert.equal(F.pausas(['8:00', '16:00']), 'Pausas sugeridas: 8:00 · 16:00');
});

test('textos fechamento: as duas saídas do modo mínimo andam juntas', () => {
  // Um convite sem frase de volta é uma porta que só abre para dentro. Se alguém
  // editar um dos dois e esquecer o outro, a tela fica muda.
  assert.equal(F.modoMinimo.convite, 'Só uma frase e uma pergunta');
  assert.equal(typeof F.modoCompleto, 'string');
  assert.ok(F.modoMinimo.frase.length > 0);
});

test('textos fechamento: estudadaEm sai do formatador da casa, e não de um novo', () => {
  const quando = '2026-11-04T10:30';
  // A data do núcleo é 'aaaa-mm-ddThh:mm' local; a única forma de data escrita
  // nesta arquivo é `dataDeCalendario`. Uma frase que formatasse a data por conta
  // própria seria a segunda forma de dizer a mesma data na casa (regra 9).
  assert.equal(F.estudadaEm(quando), `Estudada em ${dataDeCalendario('2026-11-04')}`);
  assert.equal(F.estudadaEm(''), 'Estudada em ' + dataDeCalendario(''));
  assert.doesNotMatch(F.estudadaEm(quando), /T10:30/, 'a data crua do núcleo vazou para a frase');
});

// ── 4. a linha de progresso, que trocou de verbo (item 8) ─────────────────

test('a linha de progresso conta ESTUDADAS, e a barra diz o mesmo que o olho lê', () => {
  const doc = criarDoc();
  // `lerEstudo('')` é a porta pública do estudo vazio: o construtor `vazio()` é
  // interno ao core de propósito (a tela nunca desenha um estado que não passou
  // pela leitura), e um teste que o importasse travaria um caminho que o app não tem.
  const estudo = lerEstudo('');
  // Números do arquivo real: 93 aulas. Abro cinco e estudo três. Se a linha
  // contar as abertas, a frase sai "5 de 93" e este teste cai — que é o único
  // jeito de o node provar o verbo da frase antes de a tela existir.
  let e = estudo;
  for (let i = 0; i < 5; i += 1) e = abrirAula(e, { estacao: ESTACAO, aula: AULAS.aulas[i].id, n: i + 1 }, `2026-11-0${(i % 4) + 1}T09:00`);
  for (let i = 0; i < 3; i += 1) e = estudarAula(e, { estacao: ESTACAO, aula: AULAS.aulas[i].id, n: i + 1 }, `2026-11-0${(i % 4) + 1}T10:00`, { recordacao: 'lembro', conferencia: '' });
  const resumo = resumoDaEstacao(e, ESTACAO, AULAS.aulas);
  assert.equal(resumo.total, 93);
  assert.equal(resumo.abertas, 5, 'abrir cinco aulas não é o que a frase diz');
  assert.equal(resumo.estudadas, 3);

  // O restante é conferido POR BAIXO, somando as durações do arquivo (não
  // chamando o core para comparar com ele mesmo): é a asserção que prova que
  // `resumoDaEstacao` deixou as três estudadas FORA da conta. Chutar a hora aqui
  // foi o meu erro na primeira tentativa — escrevi "~30 h 20 min" de cabeça e o
  // número real era outro.
  const somaDas = (lista) => lista.reduce((t, a) => t + (Number(a.duracaoS) || 0), 0);
  const naoEstudadas = somaDas(AULAS.aulas.slice(3));
  assert.equal(resumo.segundosRestantes, naoEstudadas, 'o restante ainda conta aula estudada');
  assert.equal(somaDas(AULAS.aulas), 109956, 'a estação real mudou de tamanho?');

  const caixa = linhaProgresso(doc, resumo);
  const frase = textoDo(um(caixa, 'aulas-progresso-texto', 'linha de progresso'));
  // S20b-1a (item 2): a duração entra na frase com espaço NÃO SEPARÁVEL.
  assert.equal(frase, `3 de 93 aulas estudadas · faltam ~${inseparavel(duracaoLegivel(naoEstudadas))}`);
  assert.ok(!frase.includes('abertas'), 'a linha voltou a contar abertura');

  const barra = um(caixa, 'aulas-barra', 'linha de progresso');
  assert.equal(barra.getAttribute('role'), 'progressbar');
  assert.equal(barra.getAttribute('aria-valuemax'), '93');
  // aria-valuenow é a MESMA frase dita para quem não vê: um número atrasado em
  // relação ao visível é a régua mentindo numa metade da tela.
  assert.equal(barra.getAttribute('aria-valuenow'), '3');
  assert.equal(barra.getAttribute('aria-label'), frase, 'leitor de tela e olho com números diferentes');
});

test('a linha de progresso no zero e no cheio não inventa nada', () => {
  const doc = criarDoc();
  const vazioDoc = linhaProgresso(doc, { total: 93, abertas: 0, estudadas: 0, segundosRestantes: 109956 });
  assert.equal(textoDo(um(vazioDoc, 'aulas-progresso-texto', 'progresso vazio')), `0 de 93 aulas estudadas · faltam ~${inseparavel('30 h 33 min')}`);
  // No cheio não se chuta o tempo: quem format zero segundo é `duracaoLegivel`,
  // e ele já tem teste próprio (core/aulas.js). O que esta trava cobra é o
  // NÚMERO da frase, que é o que a troca de verbo mexe.
  const cheioDoc = linhaProgresso(doc, { total: 93, abertas: 93, estudadas: 93, segundosRestantes: 0 });
  // S18a-fix (item 5): no cheio o pedaço «faltam» sai INTEIRO. Um "faltam ~1 min"
  // seria a frase de `duracaoLegivel(0)` — o floor dele, não uma medida — e a casa
  // não escreve conta que não fez. O que se cobra aqui é o silêncio.
  assert.equal(textoDo(um(cheioDoc, 'aulas-progresso-texto', 'progresso cheio')), '93 de 93 aulas estudadas');
  assert.equal(um(cheioDoc, 'aulas-barra', 'progresso cheio').getAttribute('aria-valuenow'), '93');
  // Sem total não há fração: 0/0 não pode virar "NaN" na tela nem no aria.
  const sem = linhaProgresso(doc, { total: 0, abertas: 0, estudadas: 0, segundosRestantes: 0 });
  const barraSem = um(sem, 'aulas-barra', 'progresso sem aulas');
  assert.equal(barraSem.getAttribute('aria-valuenow'), '0');
  assert.ok(!textoDo(sem).includes('NaN'));
});
