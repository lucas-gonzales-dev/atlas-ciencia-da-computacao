// Projeto Atlas — a CADERNETA do percurso (S17a-1, 06/11/2026).
//
// POR QUE EXISTE: o Perfil tem hoje um bilhete carimbado pela conclusão DECLARADA
// (a pessoa marcou "já concluí" e o app aceitou). O desenho (design/v3/00-desenho.md,
// princípio 4 — "gamificação que informa competência") troca isso por uma série de
// carimbos que nascem de critério MEDIDO, com os espaços vazios à vista. Este módulo
// é a série: ele não desenha nada, só responde "este fato aconteceu, e em que dia".
//
// A SÉRIE DEVOLVE SEMPRE OS 8 CARIMBOS, na mesma ordem, com `data: null` onde ainda
// não há fato. Isso é o "espaço vazio à vista" do desenho: uma lista filtrada é a
// caderneta escondendo o que a pessoa ainda não fez, e esconder é o que o bilhete
// antigo fazia.
//
// `data` é o dia do PRIMEIRO fato que cumpre o critério — não o dia em que o critério
// passou a ser conferível. Quem embarcou em 02/11 e estudou três aulas continua com
// o carimbo do embarque em 02/11 para sempre. Marcar no dia da leitura faria a
// caderneta reescrever a própria história cada vez que alguém abre o app.
//
// AS TRÊS FONTES DESTE ARQUIVO, e o motivo de cada uma ser uma importação e não uma
// reimplementação:
//   · core/estudo.js — quem grava `abertaEm`, `estudadaEm`, `puladaEm`. O carimbo lê
//     o que those functions escreveram; um `estudadaEm` montado à mão aqui seria o
//     caderneta afirmando um gesto que ninguém fez (é exatamente o que o
//     tests/caderneta.test.js proíbe nas fábricas de dados);
//   · core/cartoes.js — `diasEntre` é o dono da contagem de dias de calendário
//     (regra 13: getters locais, `round` sobre a média de 24 h, nunca `Date.parse`
//     que trata a data como UTC). Nenhum `-` de datas acontece aqui;
//   · core/eixos.js e core/viagem.js — 'percorrida' e baldeações já têm dono no
//     sistema. Uma segunda definição de "estação percorrida" é o lugar onde as duas
//     divergem em silêncio, e o mapa e a caderneta passariam a discordar na cara da
//     pessoa.
//
// ARBITRADOS (o desenho não decide, e ficam marcados no código com o motivo):
//   · `CORTE_CONSOLIDADO = 21` dias de estabilidade;
//   · a janela e o corte da calibração (`JANELA_CALIBRACAO = 20` revisões com
//     confiança, e a ordem certeza ≥ acho ≥ chute);
//   · `DIAS_SEM_NADA = 7` para o "de volta à linha";
//   · 'dominada' também vale como estação percorrida; 'concluida-antes' NÃO.
//
// Regra da casa: roda no node E no navegador, sem build. Zero DOM, zero localStorage,
// zero 'node:*', zero rede, zero Date no caminho do fuso (regra 13) — nada aqui
// muta a entrada: quem recebe o carimbo recebe texto, e a tela pinta sem gravar.

import { diasEntre } from './cartoes.js';
import { baldeacoes, resumoDaViagem } from './viagem.js';
import { eixosDaEstacao } from './eixos.js';
import { fraseDaDominada } from './desafio.js';
import { caderneta as C } from './textos.js';

/** O dia do carimbo é `aaaa-mm-dd`; um instante vira o dia dele, e o resto não é dia. */
const diaDe = (v) => {
  const bruto = String(v ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(bruto) ? bruto.slice(0, 10) : '';
};

/** O texto de uma estação do catálogo; nada de texto é "nenhuma estação". */
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/** 'aaaa-mm-dd' ordena como tempo: o mais antigo é o primeiro no léxico. */
const maisAntigo = (dias) => dias.filter(Boolean).sort()[0] || null;
const maisRecente = (dias) => dias.filter(Boolean).sort().at(-1) || null;

const uniq = (dias) => [...new Set(dias)];

/**
 * ARBITRADO: quantos dias de estabilidade fazem um cartão "consolidado".
 *
 * Por que 21: é a primeira virada em que o intervalo espaçado deixa de caber numa
 * semana. Abaixo disso a pessoa ainda vê o cartão toda semana e "consolidado" não
 * quer dizer nada que ela já não veja; aos 21 ela volta depois de um mês e lembra.
 * O desenho (princípio 4) diz "carimbo com critério medido" e não dá o número, então
 * o número é nosso e está aqui para a próxima fatia mudar sem caçar em `if`.
 */
export const CORTE_CONSOLIDADO = 21;

/** ARBITRADO: quantas revisões com confiança a calibração olha. O desenho diz "em 20 revisões". */
export const JANELA_CALIBRACAO = 20;

/** ARBITRADO: sete dias sem nenhuma atividade é o primeiro intervalo que parece ausência, e não um fim de semana. */
export const DIAS_SEM_NADA = 7;

/** As notas de confiança, da mais alta para a mais baixa — a ordem que a calibração exige. */
const CONFIANCAS = ['certeza', 'acho', 'chute'];

/**
 * Os dias em que houve atividade, lidos do estudo E dos cartões.
 *
 * Uma atividade é um dos três gestos de estudo (abrir, fechar, pular) ou uma
 * resposta de cartão. `pularAula` conta: quem pulou esteve ali, e dizer que a pessoa
 * "voltou à linha" sobre um pulo é honesto — ela tocou no Atlas. O que não conta é
 * `ultima`: é derivado dos registros, e contá-lo duas vezes mudaria nada (o conjunto
 * é deduplicado por dia), mas um dia a mais só por um re-abrir a mesma aula faria a
 * pausa terminar mais tarde do que terminou.
 *
 * @returns {string[]} dias `aaaa-mm-dd`, sem repetição, em ordem cronológica
 */
export function diasDeAtividade({ estudo, cartoes } = {}) {
  const dias = [];
  for (const r of Object.values(estudo?.aulas ?? {})) {
    if (!r || typeof r !== 'object') continue;
    for (const campo of ['abertaEm', 'estudadaEm', 'puladaEm']) {
      const d = diaDe(r[campo]);
      if (d) dias.push(d);
    }
  }
  for (const c of cartoesDe(cartoes)) {
    for (const h of historicoDe(c)) {
      const d = diaDe(h?.em);
      if (d) dias.push(d);
    }
  }
  return uniq(dias).sort();
}

/** O arquivo de cartões aceita as duas formas que o resto do app já aceita. */
function cartoesDe(cartoes) {
  const mapa = cartoes && cartoes.cartoes && typeof cartoes.cartoes === 'object'
    ? cartoes.cartoes
    : (cartoes && typeof cartoes === 'object' ? cartoes : {});
  return Object.values(mapa).filter((c) => c && typeof c === 'object' && !Array.isArray(c));
}

const historicoDe = (cartao) => (Array.isArray(cartao?.historico) ? cartao.historico : []);

/** As estações de um registro: a dona e as que o vídeo também serve (S18a-fix, item 6). */
const estacoesDo = (r) => uniq([texto(r?.estacao), ...(Array.isArray(r?.tambem) ? r.tambem.map(texto) : [])].filter(Boolean));

/** O dia em que um registro foi tocado por última vez, entre os gestos que FECHAM algo. */
const diaDoFecho = (r) => diaDe(r?.estudadaEm) || diaDe(r?.puladaEm);

/**
 * 1 · EMBARQUE — a primeira aula aberta.
 * 2 · PRIMEIRA AULA ESTUDADA — o primeiro fechamento.
 *
 * As duas lêem o mesmo arquivo e não podem ler a mesma data: quem fecha sem abrir
 * (importou a viagem, ou abriu o vídeo por fora) tem `abertaEm` gravado pelo próprio
 * `estudarAula`, e nesse caso a aula foi aberta e estudada no MESMO dia. Os dois
 * carimbos enchem nesse dia, e isso é verdade — não é duplicação de mérito: um
 * registro aberto e um estudado são duas contas do que a pessoa fez.
 */
function carimbosDeEstudo(estudo) {
  const abertas = [];
  const estudadas = [];
  for (const r of Object.values(estudo?.aulas ?? {})) {
    if (!r || typeof r !== 'object') continue;
    const a = diaDe(r.abertaEm);
    const e = diaDe(r.estudadaEm);
    if (a) abertas.push(a);
    if (e) estudadas.push(e);
  }
  return { embarque: maisAntigo(abertas), primeiraAula: maisAntigo(estudadas) };
}

/**
 * 3 · PRIMEIRA REVISÃO NO DIA SEGUINTE.
 *
 * A primeira entrada de `historico` de um cartão com data pelo menos um dia depois
 * do dia em que o cartão foi escrito, COM QUALQUER NOTA — premiar acertaria seria
 * premiar a sorte de quem adivinhou, e o desenho quer a volta, não o acerto.
 *
 * A régua é `diasEntre(criadoEm, dia) >= 1`, e não `dia !== criadoEm`: um histórico
 * fora de ordem (um arquivo importado com uma revisão anterior à criação) tem de
 * ficar de fora, e `>= 1` cuida dos dois casos. Contar o mesmo dia como "dia
 * seguinte" é justamente o defeito que a trava do tests/caderneta.test.js caça — um
 * cartão respondido na mesma hora em que foi escrito é memória de curto prazo, e o
 * eixo da cor (core/eixos.js) já diz que não é lembrança.
 */
function primeiraRevisaoNoDiaSeguinte(cartoes) {
  const dias = [];
  for (const c of cartoesDe(cartoes)) {
    const origem = diaDe(c.criadoEm);
    if (!origem) continue;
    for (const h of historicoDe(c)) {
      const dia = diaDe(h?.em);
      if (!dia) continue;
      const espera = diasEntre(origem, dia);
      if (Number.isInteger(espera) && espera >= 1) dias.push(dia);
    }
  }
  return maisAntigo(dias);
}

/**
 * 4 · PRIMEIRO CARTÃO CONSOLIDADO — `fsrs.estabilidade` ≥ `CORTE_CONSOLIDADO` com as
 * duas últimas notas `lembrei`.
 *
 * LÊ O ESTADO GRAVADO, e não uma curva recomposta aqui: `revisarCartao` é o único
 * lugar da casa que conta os dias de um cartão, e uma segunda implementação do
 * agendamento nesta caderneta divergiria da primeira na primeira mudança de pesos —
 * carimbando como consolidado um cartão que o agendamento trata como fraco. O custo,
 * dito sem rodeio: um cartão que consolidou e depois caiu volta a ficar vazio. O
 * carimbo pergunta "há um cartão seu que hoje aguenta o intervalo", não "um dia já
 * houve".
 *
 * As duas notas importam, e não é capricho: estabilidade alta com um `errei` por
 * último é o FSRS recuperando um cartão que caiu, e a memória que a pessoa tem dele é
 * a da queda. O dia carimbado é o da última das duas respostas — é nela que o cartão
 * passou a ter, ao mesmo tempo, o intervalo e as duas lembranças.
 */
function primeiroConsolidado(cartoes) {
  const dias = [];
  for (const c of cartoesDe(cartoes)) {
    const S = Number(c.fsrs?.estabilidade);
    if (!Number.isFinite(S) || S < CORTE_CONSOLIDADO) continue;
    const notas = historicoDe(c);
    if (notas.length < 2) continue;
    const duas = notas.slice(-2);
    if (!duas.every((h) => h?.nota === 'lembrei')) continue;
    const dia = diaDe(duas[1].em);
    if (dia) dias.push(dia);
  }
  return maisAntigo(dias);
}

/**
 * 5 · PRIMEIRA ESTAÇÃO PERCORRIDA — o estágio 'percorrida' de `eixosDaEstacao`.
 *
 * ARBITRADO: 'dominada' também vale, e 'concluida-antes' NÃO.
 *   · 'dominada' vem DEPOIS de 'percorrida' na escada de core/eixos.js e só se chega
 *     a ela por um desafio que exige a estação percorrida (core/desafio.js,
 *     `podeDesafiar`): quem dominou percorreu, e um carimbo vazio ali seria a
 *     caderneta desdizendo uma medição que existe;
 *   · 'concluida-antes' é o carimbo da DECLARAÇÃO sem aula estudada atrás — é
 *     exatamente o bilhete que o princípio 4 manda trocar. Ele não ganha carimbo
 *     medido.
 *
 * Sem `indice` o estágio nunca é 'percorrida': sem total de aulas não há "todas".
 * É a resposta honesta, e a mesma que core/eixos.js já dá para o mapa.
 *
 * O dia é o do último toque necessário da estação — o gesto que a fechou.
 */
function primeiraEstacaoPercorrida({ estudo, cartoes, progresso, catalogo, indice }) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const registros = Object.values(estudo?.aulas ?? {});
  const dias = [];
  for (const c of lista) {
    const id = texto(c?.id);
    if (!id) continue;
    const eixo = eixosDaEstacao(id, { estudo, cartoes, indice, progresso });
    if (eixo.estagio !== 'percorrida' && eixo.estagio !== 'dominada') continue;
    const toques = registros
      .filter((r) => r && typeof r === 'object' && estacoesDo(r).includes(id))
      .map(diaDoFecho)
      .filter(Boolean);
    if (!toques.length) continue;
    dias.push(maisRecente(toques));
  }
  return maisAntigo(dias);
}

/**
 * 6 · PRIMEIRA BALDEAÇÃO — o par de estações concluídas em linhas diferentes.
 *
 * A regra vive em core/viagem.js (`baldeacoes`), e a caderneta só pergunta quando.
 * O par só existe com os dois lados concluídos, então o dia é o do SEGUNDO carimbo
 * do par: a baldeação acontece no dia em que ela se torna possível, e é a data de
 * conclusão de `conclusoes` — a casa guarda o dia da primeira vez que a pessoa disse
 * que concluiu, e um re-toque não a reescreve.
 */
function primeiraBaldeacao({ progresso, catalogo }) {
  const feitas = baldeacoes(progresso, catalogo);
  const dias = [];
  for (const b of feitas) {
    const de = diaDe(progresso?.conclusoes?.[b.de]);
    const para = diaDe(progresso?.conclusoes?.[b.para]);
    if (!de || !para) continue; // carimbo sem data: não se inventa o dia
    dias.push(maisRecente([de, para]));
  }
  return maisAntigo(dias);
}

/**
 * 7 · DE VOLTA À LINHA — a primeira atividade depois de `DIAS_SEM_NADA` dias ou mais
 * sem nenhuma.
 *
 * A pausa é medida entre DIAS DE CALENDÁRIO, e `diasEntre` é o dono dessa conta
 * (regra 13: sem fuso no meio). Sete dias de separação entre duas atividades é o
 * intervalo; seis não é. É a única travessia do ano em que o número aparece na
 * trava e nunca na frase: «Você voltou à linha.» não pergunta quantos dias, porque
 * a régua 9 (design/README §9) proíbe a tela de falar de ausência — quem voltou já
 * voltou, e o que a caderneta registra é o retorno, não a falta.
 *
 * O primeiro dia de todos nunca é volta: sem atividade anterior não há intervalo,
 * e "você voltou à linha" para quem acabou de embarcar é a caderneta mentindo.
 */
function deVoltaALinha({ estudo, cartoes }) {
  const dias = diasDeAtividade({ estudo, cartoes });
  for (let i = 1; i < dias.length; i += 1) {
    const espera = diasEntre(dias[i - 1], dias[i]);
    if (Number.isInteger(espera) && espera >= DIAS_SEM_NADA) return dias[i];
  }
  return null;
}

/**
 * 8 · CALIBRADO — a confiança dita bate com o acerto medido.
 *
 * ARBITRADO (o desenho só diz "confiança bate com acerto em 20 revisões", sem
 * definir "bater"): nas últimas `JANELA_CALIBRACAO` revisões DE CARTÃO que trouxeram
 * confiança, a taxa de 'certeza' com nota 'lembrei' é pelo menos 0,8 e não é menor
 * que a de 'acho', e a de 'acho' não é menor que a de 'chute'.
 *
 * As três partes, e o motivo de cada:
 *   · a taxa por nível é `lembrados / respostas` daquele nível — é o que a pessoa
 *     disse (confiança) confrontado com o que ela fez (nota);
 *   · o corte de 0,8 sobre a certeza é o limiar que a casa já usa para memória que
 *     presta (LIMITE_RECUPERABILIDADE em core/eixos.js). Uma confiança que acerta
 *     menos que isso não "bate": a pessoa disse que sabia e não sabia;
 *   · a ordem certeza ≥ acho ≥ chute é a monotonia que faz a confiança SER medida:
 *     se 'chute' acerta tanto quanto 'certeza', o botão não informa nada.
 *
 * Uma confiança sem resposta nenhuma não entra: média sobre zero é divisão por zero,
 * e tratar isso como 0 faria a caderneta reprovar quem respondeu só 'certeza'. Os
 * vinte são da JANELA, não de cada nível — o desenho disse "20 revisões", e uma
 * régua por nível seria exigir 60.
 *
 * O dia é o da vigésima revisão (a última da janela): é nela que a conta fecha, e
 * uma janela móvel sobre o histórico não tem "primeiro dia" além desse.
 */
function calibrado(cartoes) {
  const entradas = [];
  for (const c of cartoesDe(cartoes)) {
    for (const h of historicoDe(c)) {
      const dia = diaDe(h?.em);
      const nota = h?.nota;
      const confianca = texto(h?.confianca);
      if (!dia || !nota || !CONFIANCAS.includes(confianca)) continue;
      entradas.push({ dia, nota, confianca });
    }
  }
  if (entradas.length < JANELA_CALIBRACAO) return null;
  const janela = entradas
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0))
    .slice(-JANELA_CALIBRACAO);

  const taxa = (nivel) => {
    const doNivel = janela.filter((e) => e.confianca === nivel);
    if (!doNivel.length) return null;
    return doNivel.filter((e) => e.nota === 'lembrei').length / doNivel.length;
  };
  const [certeza, acho, chute] = CONFIANCAS.map(taxa);
  if (certeza === null || acho === null || chute === null) return null;
  const bate = certeza >= 0.8 && certeza >= acho && acho >= chute;
  return bate ? janela.at(-1).dia : null;
}

/**
 * A série do percurso: os 8 carimbos, sempre os 8, na ordem do desenho.
 *
 * @param {{estudo?: object, cartoes?: object, progresso?: object, catalogo?: object[],
 *          indice?: object, hoje?: string}} dados
 *   `estudo` é o arquivo de core/estudo.js; `cartoes` o de core/cartoes.js (as duas
 *   formas aceitas, `{cartoes:{}}` ou o mapa cru); `progresso` o de core/viagem.js;
 *   `catalogo` o `courses` do catálogo; `indice` o data/aulas/indice.json cru — sem
 *   ele não há total de aulas, e o carimbo 5 fica vazio;
 *   `hoje` NÃO é usado por nada daqui: cada carimbo é um fato que aconteceu, e o
 *   tempo nunca rebaixa (o mesmo princípio de core/eixos.js). Aceitar `hoje` sem usá-
 *   lo seria deixar a tela achar que a série depende do relógio.
 * @returns {Array<{id: string, serie: 'percurso', nome: string, criterio: string,
 *                  data: string|null, frase: string}>}
 */
export function seriePercurso(dados) {
  const { estudo, cartoes, progresso, catalogo, indice } = dados ?? {};
  const { embarque, primeiraAula } = carimbosDeEstudo(estudo);
  const datas = {
    embarque,
    primeiraAula,
    primeiraRevisao: primeiraRevisaoNoDiaSeguinte(cartoes),
    consolidado: primeiroConsolidado(cartoes),
    estacaoPercorrida: primeiraEstacaoPercorrida({ estudo, cartoes, progresso, catalogo, indice }),
    baldeacao: primeiraBaldeacao({ progresso, catalogo }),
    deVolta: deVoltaALinha({ estudo, cartoes }),
    calibrado: calibrado(cartoes),
  };

  const ordem = [
    'embarque',
    'primeiraAula',
    'primeiraRevisao',
    'consolidado',
    'estacaoPercorrida',
    'baldeacao',
    'deVolta',
    'calibrado',
  ];

  return ordem.map((id) => ({
    id,
    serie: 'percurso',
    nome: C[id].nome,
    criterio: C[id].criterio,
    data: datas[id],
    frase: datas[id] ? C[id].frase : C.vazio,
  }));
}

// ───────────────────────────── S17a-2: domínio, recordes, próxima ─────────────────────────────

/** O título de uma estação do catálogo; sem catálogo, o id. */
const tituloDe = (curso) => texto(curso?.title) || texto(curso?.id);

/** O número da linha no catálogo (`stage`); linha sem número é `null`, não zero. */
const linhaDe = (curso) => (Number.isFinite(Number(curso?.stage)) ? Number(curso.stage) : null);

/** O registro de dominada de uma estação, ou `null`. `eixos.js` usa a mesma existência como estágio. */
const dominadaDe = (progresso, id) => {
  const d = progresso?.dominadas?.[id];
  return d && typeof d === 'object' ? d : null;
};

/**
 * A SERIE DO DOMÍNIO: uma por estação do catálogo, um fim de linha por linha, um terminal.
 *
 * O TOTAL NÃO É UM NÚMERO ESCRITO AQUI. Com o catálogo da UBL são 35 + 7 + 1 = 43, e a
 * trava confere 43 lendo o catálogo REAL (`data/catalog.json`) — um `43` fixo no código
 * mentiria no dia em que a grade ganhasse uma disciplina, e é exatamente o que a casa
 * proíbe (`número de largura à mão`, `duração escrita à mão`: a régua vive nos dados).
 *
 * A FRASE DE CADA ESTAÇÃO É `fraseDaDominada` (core/desafio.js), a que repete os números
 * medidos no desafio — «Percorreu as 93 aulas, escreveu 23 cartões e, dois dias ou mais
 * depois, lembrou 12 de 14 deles». Ela é a substituta da «frase de competência» do
 * desenho: `data/competencias.json` descreve a ementa da disciplina («Você converte entre
 * bases...»), um saber-fazer que NINGUÉM mediu nesta pessoa. O carimbo não pode afirmar o
 * que só o catálogo afirma.
 *
 * A «CONCLUÍDA ANTES» FICA VAZIA, COM A MARCA E A DATA ANTIGA. Ela chegou pelo selo da
 * declaração («Já sei isso», ou a migração do Atlas antigo) sem aula estudada atrás —
 * `eixosDaEstacao` a põe nesse estágio antes de qualquer medida. Dar-lhe o carimbo de
 * domínio seria o bilhete velho reentrando pela porta dos fundos: a frase diria «lembrou
 * X de Y» de um sorteio que nunca aconteceu. Então: `data: null`, `frase: null`, e
 * `marca: 'Concluída antes'` com `marcaEm` = o dia antigo de `conclusoes`. A data antiga
 * viaja num campo SEPARADO porque `data` tem um sentido nesta série — o dia em que o
 * critério foi cumprido — e uma declaração não cumpre critério nenhum. Misturar as duas
 * no mesmo campo faria a tela tratar como medido o que é declarado.
 */
export function serieDominio({ estudo, cartoes, progresso, catalogo, indice } = {}) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const carimbos = [];

  for (const curso of lista) {
    const id = texto(curso?.id);
    if (!id) continue;
    const dominada = dominadaDe(progresso, id);
    const estagio = eixosDaEstacao(id, { estudo, cartoes, indice, progresso }).estagio;
    const linha = linhaDe(curso);

    if (dominada) {
      carimbos.push({
        id: `dominio:${id}`,
        serie: 'dominio',
        nome: tituloDe(curso),
        criterio: C.dominio.criterioEstacao,
        data: diaDe(dominada.em) || null,
        frase: fraseDaDominada(dominada),
        linha,
      });
    } else if (estagio === 'concluida-antes') {
      carimbos.push({
        id: `dominio:${id}`,
        serie: 'dominio',
        nome: tituloDe(curso),
        criterio: C.dominio.criterioEstacao,
        data: null,
        frase: null,
        linha,
        marca: C.dominio.concluidaAntes,
        marcaEm: diaDe(progresso?.conclusoes?.[id]) || null,
      });
    } else {
      carimbos.push({
        id: `dominio:${id}`,
        serie: 'dominio',
        nome: tituloDe(curso),
        criterio: C.dominio.criterioEstacao,
        data: null,
        frase: C.dominio.vazio,
        linha,
      });
    }
  }

  // As linhas, na ordem do número. Uma linha sem estação não vira carimbo: não há o que
  // dominar, e um «Fim de linha 9» vazio sobre uma linha inexistente é ruído.
  const porLinha = new Map();
  for (const curso of lista) {
    const id = texto(curso?.id);
    const n = linhaDe(curso);
    if (!id || n === null) continue;
    if (!porLinha.has(n)) porLinha.set(n, []);
    porLinha.get(n).push(id);
  }

  for (const n of [...porLinha.keys()].sort((a, b) => a - b)) {
    const estacoes = porLinha.get(n);
    const dias = estacoes.map((id) => diaDe(dominadaDe(progresso, id)?.em)).filter(Boolean);
    const fechada = dias.length === estacoes.length;
    // O dia do carimbo é o do ÚLTIMO dominated da linha: a linha se fecha nesse dia, e é
    // o primeiro fato que cumpre o critério «todas dominadas».
    carimbos.push({
      id: `dominio:linha-${n}`,
      serie: 'dominio',
      nome: C.dominio.nomeLinha(n),
      criterio: C.dominio.criterioLinha,
      data: fechada ? maisRecente(dias) : null,
      frase: fechada ? C.dominio.fraseLinha : C.dominio.vazioLinha,
      linha: n,
    });
  }

  const dominadasTudo = lista
    .map((c) => diaDe(dominadaDe(progresso, texto(c?.id))?.em))
    .filter(Boolean);
  const terminal = lista.length > 0 && dominadasTudo.length === lista.length;
  carimbos.push({
    id: 'dominio:terminal',
    serie: 'dominio',
    nome: C.dominio.terminal.nome,
    criterio: C.dominio.terminal.criterio,
    data: terminal ? maisRecente(dominadasTudo) : null,
    frase: terminal ? C.dominio.fraseTerminal : C.dominio.terminal.vazio,
    linha: null,
  });

  return carimbos;
}

/**
 * `aaaa-mm-dd` → a SEGUNDA-FEIRA da semana de calendário daquela data.
 *
 * A semana é de calendário (segunda a domingo), não «os últimos 7 dias»: «mais cartões
 * lembrados numa semana» precisa de uma borda que a pessoa reconheça na parede, e uma
 * janela móvel muda de resposta cada vez que ela abre o app. O cálculo é o truque da casa
 * (regra 13): `Date.UTC` sobre as PARTES da data e `getUTCDay`, sem fuso no meio e sem
 * `Date.parse`. O precedente é core/revisao.js, `somarDias`.
 */
function segundaDaSemana(dia) {
  const [ano, mes, diaMes] = dia.split('-').map(Number);
  const dow = new Date(Date.UTC(ano, mes - 1, diaMes)).getUTCDay(); // 0 = domingo
  const deslocamento = (dow + 6) % 7; // segunda = 0, domingo = 6
  const [a, m, d] = [ano, mes - 1, diaMes - deslocamento];
  const dt = new Date(Date.UTC(a, m, d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * RECORDES PESSOAIS, SEM SEQUÊNCIA.
 *
 * Dois recordes, e nenhum deles conta dias seguidos: o desenho (princípio 4 e 5) não quer
 * aversão à perda, e um recorde de sequência zera para quem fica doente uma semana — o
 * oposto de «nada zera, nada culpa». Os dois abaixo medem feito e não caem a nada: são
 * «melhor até hoje» para sempre.
 *
 * · `semana` — a semana de calendário com mais cartões lembrados na PRIMEIRA tentativa do
 *   dia. Só a primeira: responder o mesmo cartão três vezes num dia não são três
 *   lembranças, e contar as três premiaría reler em vez de lembrar (é a mesma régua de
 *   `aulasLembradas` em core/eixos.js — o eixo da cor).
 * · `estabilidade` — o maior intervalo que um cartão seu aguenta, em dias, arredondado.
 *
 * ARBITRADO, e dito sem rodeio: `estabilidade` lê o ESTADO GRAVADO (`fsrs.estabilidade`),
 * como o carimbo «consolidado» — não um máximo histórico. Um cartão que consolidou e caiu
 * baixa o recorde, porque não há no arquivo um rastro da estabilidade de cada dia e
 * inventar um seria criar uma segunda verdade sobre o mesmo cartão.
 *
 * Sem dado, o recorde vem `valor: null` e `frase: null`: não há frase sobre um feito que
 * não aconteceu, e um «0» no lugar do vazio seria o número de um recorde que ninguém bateu.
 */
export function recordes({ cartoes } = {}) {
  const porSemana = new Map();
  let maiorEstabilidade = null;

  for (const c of cartoesDe(cartoes)) {
    const S = Number(c.fsrs?.estabilidade);
    if (Number.isFinite(S) && S > 0) {
      const arred = Math.round(S);
      if (maiorEstabilidade === null || arred > maiorEstabilidade) maiorEstabilidade = arred;
    }
    const doDia = new Map(); // dia → a primeira tentativa daquele dia
    for (const h of historicoDe(c)) {
      const dia = diaDe(h?.em);
      if (!dia || doDia.has(dia)) continue;
      doDia.set(dia, h?.nota);
    }
    for (const [dia, nota] of doDia) {
      if (nota !== 'lembrei') continue;
      const semana = segundaDaSemana(dia);
      porSemana.set(semana, (porSemana.get(semana) || 0) + 1);
    }
  }

  const melhorSemana = [...porSemana.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] || null;

  const monta = (recorde, valor, data) => ({
    id: recorde.id,
    serie: 'recorde',
    nome: recorde.nome,
    criterio: recorde.criterio,
    valor: valor === null || valor === undefined ? null : valor,
    data,
    frase: valor === null || valor === undefined ? null : recorde.frase.replace('{valor}', String(valor)),
  });

  return [
    monta(C.recordes[0], melhorSemana ? melhorSemana[1] : null, melhorSemana ? melhorSemana[0] : null),
    monta(C.recordes[1], maiorEstabilidade, null),
  ];
}

/**
 * A PRÓXIMA COISA, logo depois dos carimbos (desenho, seção «A gamificação»).
 *
 * A estação vem de `resumoDaViagem().proximaEstacao` (core/viagem.js) — a MESMA conta da
 * placa e do Perfil. Uma segunda definição de «próxima» divergiría da primeira na cara da
 * pessoa, e o carimbo mandando para um lugar diferente do botão da tela é o tipo de
 * contradição que o desenho lista como defeito, não como detalhe.
 *
 * A CLÁUSULA DO PRÉ-REQUISITO SÓ SAI QUANDO É VERDADE: «que você já dominou» aparece por
 * pré-requisito que existe no catálogo E tem registro em `progresso.dominadas`. Um
 * pré-requisito que a pessoa declarou concluído («concluída antes») não é dominado — não
 * houve medida — e dizê-lo seria o carimbo fabricando a medição. Sem pré-requisito
 * dominado, a frase fica só «Próxima estação: X.», que é o formato do desenho sem a
 * segunda cláusula.
 */
export function proximaCoisa({ progresso, catalogo } = {}) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const resumo = resumoDaViagem(progresso, lista);
  const proxima = resumo?.proximaEstacao;
  if (!proxima?.id) {
    return {
      id: 'proxima',
      serie: 'proxima',
      nome: 'Próxima estação',
      estacao: null,
      linha: null,
      pede: [],
      texto: null,
    };
  }
  const curso = lista.find((c) => texto(c?.id) === proxima.id) || {};
  const byId = new Map(lista.filter((c) => texto(c?.id)).map((c) => [texto(c.id), c]));
  const bruto = Array.isArray(curso.prerequisites) ? curso.prerequisites : [];
  const pede = [...new Set(bruto.map(texto).filter(Boolean))]
    .filter((p) => byId.has(p))
    .filter((p) => !!dominadaDe(progresso, p))
    .map((p) => tituloDe(byId.get(p)));

  return {
    id: 'proxima',
    serie: 'proxima',
    nome: 'Próxima estação',
    estacao: proxima.id,
    linha: Number.isFinite(Number(proxima.linha)) ? Number(proxima.linha) : null,
    pede,
    texto: C.proxima({ nome: proxima.titulo || tituloDe(curso), pede }),
  };
}

/**
 * A CADERNETA INTEIRA — as duas séries, os recordes e a próxima (S17a-2).
 *
 * Um ponto de entrada só para a tela do Perfil: `percurso` (8), `dominio` (uma por
 * estação + uma por linha + terminal), `recordes` (2) e `proxima` (1). Nada aqui conhece
 * DOM: a série devolve texto e dia, e quem pinta decide como mostrar o vazio.
 *
 * `hoje` continua sem uso, pelo mesmo motivo da série do percurso: cada carimbo é um fato
 * que aconteceu, e o tempo não rebaixa (princípio 5).
 *
 * @returns {{percurso: object[], dominio: object[], recordes: object[], proxima: object}}
 */
export function caderneta({ estudo, cartoes, progresso, catalogo, indice, hoje } = {}) {
  const dados = { estudo, cartoes, progresso, catalogo, indice, hoje };
  return {
    percurso: seriePercurso(dados),
    dominio: serieDominio(dados),
    recordes: recordes(dados),
    proxima: proximaCoisa(dados),
  };
}
