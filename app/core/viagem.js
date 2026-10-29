// Projeto Atlas — as regras da viagem (o Atlas como mapa de metrô).
//
// Regra da casa: roda NO NODE (testes) e NO NAVEGADOR (web/PWA), sem build.
// Zero import de 'node:*', zero filesystem, zero DOM. Recebe dados e devolve
// dados; quem desenha é a tela.
//
// Vocabulário (design/JORNADA.md): linha = estágio da fonte (1 a 7, sem nome
// inventado), estação = disciplina da grade, baldeação = pré-requisito entre
// linhas, viagem = o progresso da pessoa, Terminal = as 35 concluídas.
//
// POR QUE ESTE ARQUIVO EXISTE SEPARADO DE progress.js: progress.js responde
// "o que está destrancado" (grafo de pré-requisitos). Este responde "onde a
// pessoa está na viagem" (estado por estação, resumo por linha, marcos). As
// duas coisas usam o mesmo grafo — por isso aqui se IMPORTA detectCycles,
// unlockedCourses e nextUp em vez de reimplementar: duas cópias da regra de
// desbloqueio é a receita para a tela e o resumo discordarem em silêncio.
//
// TRÊS DECISÕES DE HONESTIDADE, as três cobradas por teste:
//   1. Id que não existe no catálogo devolve `null` em estadoDaEstacao — uma
//      estação que não existe não tem estado, e inventar "trancada" ali faria a
//      tela pedir para concluir um pré-requisito fantasma.
//   2. Estação dentro de ciclo da fonte é `trancada` COM `ciclo: true`. Sem o
//      sinal, a tela diria "conclua X primeiro" e X é impossível.
//   3. Dia de viagem é DERIVADO das datas de conclusão, não um contador. Não
//      existe contador para dessincronizar, e desfazer devolve o dia junto com
//      a estação (JORNADA.md §3.2).

import { detectCycles, unlockedCourses, nextUp } from './progress.js';

/** Os quatro estados de uma estação (JORNADA.md §3.1). */
export const ESTADOS = Object.freeze({
  TRANCADA: 'trancada',
  DISPONIVEL: 'disponivel',
  EM_CURSO: 'em_curso',
  CONCLUIDA: 'concluida'
});

/** Tipos de marco, do menor para o maior (JORNADA.md §2.6 e §4.6). */
export const MARCOS = Object.freeze({
  ESTACAO: 'estacao',
  FIM_DA_LINHA: 'fim_da_linha',
  PRIMEIRA_BALDEACAO: 'primeira_baldeacao',
  TERMINAL: 'terminal'
});

/** Disciplinas da grade no Terminal. Não é mágica: é o que a fonte tem. */
export const TOTAL_ESTACOES = 35;

/** Estações por linha. A fonte tem 5 em cada um dos 7 estágios. */
export const ESTACOES_POR_LINHA = 5;

// ──────────────────────────── leitura tolerante ────────────────────────────

/**
 * Aceita as três formas que um progresso pode ter na prática e devolve a forma
 * v3: `{completed, emCurso, conclusoes}`.
 *
 *   - array cru de ids: é o que o localStorage guarda hoje, e o que um arquivo
 *     de versão 1 ou 2 contém. Quem abriu o DevTools e salvou à mão não pode
 *     ser punido por isso;
 *   - objeto v3 (ou v2 com `emCurso`/`conclusoes`): passa direto, saneado;
 *   - qualquer outra coisa (null, número, texto): progresso vazio. Devolver
 *     vazio em vez de quebrar é o que mantém a tela de pé com storage corrompido.
 *
 * Este leitor NÃO filtra pelo catálogo — ele não o conhece. Filtrar id
 * desconhecido é trabalho de quem tem o catálogo (core/progress-io.js), e fazer
 * aqui também seria ter duas malhas de validação que um dia divergem.
 *
 * @param {unknown} bruto
 * @returns {{completed: string[], emCurso: string[], conclusoes: Record<string,string>}}
 */
export function lerProgresso(bruto) {
  const vazio = { completed: [], emCurso: [], conclusoes: {} };

  const idsUnicos = (lista) => {
    if (!Array.isArray(lista)) return [];
    const vistos = new Set();
    for (const x of lista) if (typeof x === 'string' && !vistos.has(x)) vistos.add(x);
    return [...vistos];
  };

  if (Array.isArray(bruto)) return { ...vazio, completed: idsUnicos(bruto) };
  if (!bruto || typeof bruto !== 'object') return vazio;

  // `conclusoes` pode chegar como texto (arquivo editado à mão) — nesse caso é
  // ilegível e vira vazio, não exceção: perder a data é perder pouco, perder o
  // progresso é perder tudo.
  let conclusoes = {};
  if (bruto.conclusoes && typeof bruto.conclusoes === 'object' && !Array.isArray(bruto.conclusoes)) {
    for (const [id, data] of Object.entries(bruto.conclusoes)) {
      if (typeof data === 'string' && ehData(data)) conclusoes[id] = data;
    }
  }

  return {
    completed: idsUnicos(bruto.completed),
    emCurso: idsUnicos(bruto.emCurso),
    conclusoes
  };
}

/** Progresso v3 vazio: o estado de quem acabou de chegar. */
export function progressoVazio() {
  return { completed: [], emCurso: [], conclusoes: {} };
}

/** `AAAA-MM-DD` válido? Sem isto, "2026-13-45" viraria dia de viagem. */
function ehData(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Data local (`AAAA-MM-DD`) do dia de viagem.
 *
 * LOCAL, não UTC: o dia de viagem é o dia DA PESSOA. `toISOString()` corta em
 * UTC e, para quem estuda às 21h em São Paulo entre outubro e fevereiro, isso
 * empurraria a conclusão para o dia seguinte — e o resumo mentiria sobre quando
 * ela viajou. O deslocamento do fuso é aplicado antes do corte.
 *
 * Aceita `Date` ou `AAAA-MM-DD` (para o teste ser determinístico sem relógio).
 * @param {Date|string} [hoje]
 * @returns {string}
 */
export function dataLocal(hoje) {
  if (typeof hoje === 'string' && ehData(hoje)) return hoje;
  const d = hoje instanceof Date && !Number.isNaN(hoje.getTime()) ? hoje : new Date();
  const deslocada = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return deslocada.toISOString().slice(0, 10);
}

/**
 * Dias de viagem: as datas distintas em que houve conclusão, ordenadas.
 * Derivado de `conclusoes` — não existe contador separado (decisão 3 acima).
 * @returns {string[]}
 */
export function datasDeViagem(progresso) {
  const { completed, conclusoes } = lerProgresso(progresso);
  const concluidas = new Set(completed);
  const dias = new Set();
  for (const [id, data] of Object.entries(conclusoes)) {
    // Só entra data de estação que CONSTA como concluída: `conclusoes` órfã
    // (sobrou de um desfazer malfeito ou de id descartado) não pode criar dia
    // de viagem fantasma, e o resumo diria "3 dias" com 2 estações.
    if (!concluidas.has(id)) continue;
    if (ehData(data)) dias.add(data);
  }
  return [...dias].sort();
}

// ──────────────────────────────── malha do grafo ────────────────────────────────

/**
 * Índices do catálogo: por id, por linha (estágio) e o conjunto cíclico.
 * Uma função só para os três, porque toda regra daqui precisa dos três e
 * construí-los em cada regra é O(n²) à toa.
 */
function malha(catalogo) {
  const lista = Array.isArray(catalogo) ? catalogo.filter((c) => c && typeof c.id === 'string') : [];
  const byId = new Map();
  const porLinha = new Map();
  for (const c of lista) {
    byId.set(c.id, c);
    const linha = Number(c.stage);
    if (!Number.isFinite(linha)) continue; // estação sem linha não entra em linha nenhuma
    if (!porLinha.has(linha)) porLinha.set(linha, []);
    porLinha.get(linha).push(c);
  }
  const ciclo = new Set(detectCycles(lista));
  return { lista, byId, porLinha, ciclo };
}

/** Pré-requisitos de `course` que existem no catálogo, como objetos. */
function prereqs(course, byId) {
  const raw = Array.isArray(course?.prerequisites) ? course.prerequisites : [];
  return raw.filter((p) => typeof p === 'string' && byId.has(p)).map((p) => byId.get(p));
}

// ──────────────────────────── estado da estação ────────────────────────────

/**
 * O estado de UMA estação: trancada, disponível, em curso ou concluída.
 *
 * Precedência (JORNADA.md §3.1): concluída > em curso > disponível > trancada.
 * A palavra da pessoa pesa mais que o cálculo do Atlas — se ela declarou que
 * concluiu, o Atlas não desdiz, mesmo que o catálogo tenha mudado embaixo dela.
 *
 * @param {string} id
 * @param {unknown} progresso array de ids OU objeto v3
 * @param {Array<{id:string,title?:string,stage?:number,prerequisites?:string[]}>} catalogo
 * @returns {{id:string, titulo:string, linha:number|null, estado:string,
 *            faltam:Array<{id:string,titulo:string,linha:number|null}>, ciclo:boolean}|null}
 *          `null` se o id não existe no catálogo (decisão 1 acima).
 */
export function estadoDaEstacao(id, progresso, catalogo) {
  if (typeof id !== 'string') return null;
  const { byId, ciclo } = malha(catalogo);
  const course = byId.get(id);
  if (!course) return null;

  const p = lerProgresso(progresso);
  const concluidas = new Set(p.completed);
  const emCurso = new Set(p.emCurso);

  const linha = Number.isFinite(Number(course.stage)) ? Number(course.stage) : null;
  const titulo = typeof course.title === 'string' ? course.title : id;

  const faltantes = prereqs(course, byId)
    .filter((pre) => !concluidas.has(pre.id))
    .map((pre) => ({
      id: pre.id,
      titulo: typeof pre.title === 'string' ? pre.title : pre.id,
      linha: Number.isFinite(Number(pre.stage)) ? Number(pre.stage) : null
    }));

  let estado;
  if (concluidas.has(id)) estado = ESTADOS.CONCLUIDA;
  else if (emCurso.has(id)) estado = ESTADOS.EM_CURSO;
  else if (!ciclo.has(id) && faltantes.length === 0) estado = ESTADOS.DISPONIVEL;
  else estado = ESTADOS.TRANCADA;

  return {
    id,
    titulo,
    linha,
    estado,
    // `faltam` só tem sentido na trancada: listar pré-requisito de estação já
    // concluída seria a tela dizer "falta X" do lado de um carimbo.
    faltam: estado === ESTADOS.TRANCADA ? faltantes : [],
    ciclo: estado === ESTADOS.TRANCADA && ciclo.has(id)
  };
}

/**
 * Baldeações feitas: pares (pré-requisito → estação) em que os dois estão
 * concluídos e pertencem a linhas diferentes. O par é a unidade, então
 * concluir a mesma estação duas vezes não conta duas.
 * @returns {Array<{de:string,para:string,deLinha:number|null,paraLinha:number|null}>}
 */
export function baldeacoes(progresso, catalogo) {
  const { lista, byId } = malha(catalogo);
  const p = lerProgresso(progresso);
  const concluidas = new Set(p.completed);
  const linhaDe = (c) => (Number.isFinite(Number(c?.stage)) ? Number(c.stage) : null);

  const feitas = [];
  for (const c of lista) {
    if (!concluidas.has(c.id)) continue;
    for (const pre of prereqs(c, byId)) {
      if (!concluidas.has(pre.id)) continue;
      if (linhaDe(pre) === linhaDe(c)) continue; // mesma linha: não é baldeação
      feitas.push({ de: pre.id, para: c.id, deLinha: linhaDe(pre), paraLinha: linhaDe(c) });
    }
  }
  return feitas;
}

// ────────────────────────────── resumo da viagem ──────────────────────────────

/**
 * Onde a pessoa está na viagem inteira. É o que a tela do resumo, o bilhete e a
 * imagem compartilhada leem — uma fonte só, para os três números não divergirem.
 *
 * @param {unknown} progresso array de ids OU objeto v3
 * @param {Array} catalogo disciplinas da grade
 * @returns {{
 *   estacoes:number, concluidas:number, emCurso:number, disponiveis:number, trancadas:number,
 *   linhas:Array<{linha:number, concluidas:number, total:number, percentual:number, fechada:boolean}>,
 *   linhasFechadas:number,
 *   baldeacoesFeitas:number, baldeacoes:Array,
 *   diasDeViagem:number, datasDeViagem:string[],
 *   proximaEstacao:{id:string,titulo:string,linha:number|null}|null,
 *   situacao:'open'|'done'|'blocked', terminal:boolean
 * }}
 */
export function resumoDaViagem(progresso, catalogo) {
  const { lista, byId, porLinha } = malha(catalogo);
  const p = lerProgresso(progresso);
  const concluidas = new Set(p.completed.filter((id) => byId.has(id)));
  const emCurso = new Set(p.emCurso.filter((id) => byId.has(id) && !concluidas.has(id)));

  // Uma estação por vez, na ordem do catálogo. Contar aqui de novo seria ter
  // duas definições de "próxima" (a da tela e a do resumo).
  const proximo = nextUp(lista, [...concluidas]);

  const linhas = [...porLinha.keys()].sort((a, b) => a - b).map((numero) => {
    const estacoes = porLinha.get(numero);
    const feitas = estacoes.filter((c) => concluidas.has(c.id)).length;
    const total = estacoes.length;
    return {
      linha: numero,
      concluidas: feitas,
      total,
      // Inteiro, arredondado: 4/7 = 57, não 57.142857142857146. Percentual com
      // casa decimal num cartão de linha é número que ninguém lê.
      percentual: total === 0 ? 0 : Math.round((feitas / total) * 100),
      fechada: total > 0 && feitas === total
    };
  });

  const bals = baldeacoes(p, lista);
  const datas = datasDeViagem(p).filter((d) =>
    // dia só conta se a estação daquele dia pertence a este catálogo
    Object.entries(p.conclusoes).some(([id, data]) => data === d && byId.has(id))
  );

  let disponiveis = 0;
  let trancadas = 0;
  for (const c of lista) {
    if (concluidas.has(c.id) || emCurso.has(c.id)) continue;
    const e = estadoDaEstacao(c.id, p, lista);
    if (e?.estado === ESTADOS.DISPONIVEL) disponiveis += 1;
    else if (e?.estado === ESTADOS.TRANCADA) trancadas += 1;
  }

  return {
    estacoes: lista.length,
    concluidas: concluidas.size,
    emCurso: emCurso.size,
    disponiveis,
    trancadas,
    linhas,
    linhasFechadas: linhas.filter((l) => l.fechada).length,
    baldeacoesFeitas: bals.length,
    baldeacoes: bals,
    diasDeViagem: datas.length,
    datasDeViagem: datas,
    proximaEstacao: proximo.course
      ? {
          id: proximo.course.id,
          titulo: typeof proximo.course.title === 'string' ? proximo.course.title : proximo.course.id,
          linha: Number.isFinite(Number(proximo.course.stage)) ? Number(proximo.course.stage) : null
        }
      : null,
    situacao: proximo.state,
    terminal: lista.length > 0 && concluidas.size === lista.length
  };
}

// ────────────────────────── transições (imutáveis) ──────────────────────────

/**
 * Conclui uma estação. Imutável: devolve objeto novo, nunca altera o recebido —
 * a tela guarda o anterior para o desfazer, e mutar embaixo dela quebraria isso.
 *
 * Idempotente de propósito: concluir duas vezes devolve estado idêntico ao de
 * concluir uma. Dois toques no celular não podem criar dois dias de viagem — e
 * também não podem REESCREVER a data do dia em que a pessoa disse que concluiu.
 * Vale a primeira data; para mudar a data, desfaça e conclua de novo.
 *
 * @param {unknown} progresso
 * @param {string} id
 * @param {Date|string} [hoje] injetável, para o teste não depender do relógio
 * @param {Array} [catalogo] quando dado, id fora do catálogo é ignorado
 */
export function concluirEstacao(progresso, id, hoje, catalogo) {
  const p = lerProgresso(progresso);
  if (typeof id !== 'string') return p;
  if (Array.isArray(catalogo) && !catalogo.some((c) => c && c.id === id)) return p;

  const data = dataLocal(hoje);
  const completed = p.completed.includes(id) ? [...p.completed] : [...p.completed, id];
  const emCurso = p.emCurso.filter((x) => x !== id); // concluída deixa de estar em curso
  // Só grava a data se ainda não há uma: um segundo toque (ou um re-toque dias
  // depois) não muda o dia em que a viagem aconteceu.
  const conclusoes = ehData(p.conclusoes[id]) ? { ...p.conclusoes } : { ...p.conclusoes, [id]: data };
  return { completed, emCurso, conclusoes };
}

/**
 * Marca "começar a estudar". Não é avanço: não cria dia de viagem (JORNADA.md
 * §3.2 e §4.1 — só se premia avanço real, e intenção não é avanço).
 */
export function iniciarEstacao(progresso, id, catalogo) {
  const p = lerProgresso(progresso);
  if (typeof id !== 'string') return p;
  if (Array.isArray(catalogo) && !catalogo.some((c) => c && c.id === id)) return p;
  if (p.completed.includes(id)) return p;          // já concluída: nada a iniciar
  if (p.emCurso.includes(id)) return p;            // idempotente
  return { ...p, emCurso: [...p.emCurso, id] };
}

/**
 * Desfaz uma conclusão: devolve exatamente o estado anterior.
 *
 * Exato porque os dias de viagem são derivados das datas de conclusão — não há
 * contador para devolver à mão. O que este desfazer NÃO promete é restaurar
 * "em curso": o Atlas não guarda a intenção desfeita, então a estação volta
 * para o estado calculado (disponível ou trancada). Documentado em
 * JORNADA.md §7 como uma das duas decisões mais fracas daqui.
 *
 * @returns {{completed:string[],emCurso:string[],conclusoes:Record<string,string>}}
 */
export function desfazerConclusao(progresso, id) {
  const p = lerProgresso(progresso);
  if (typeof id !== 'string') return p;
  const conclusoes = { ...p.conclusoes };
  delete conclusoes[id];
  return {
    completed: p.completed.filter((x) => x !== id),
    emCurso: [...p.emCurso],
    conclusoes
  };
}

// ─────────────────────────────────── marcos ───────────────────────────────────

/**
 * O que ACABOU de acontecer com a ação de agora. A tela usa isto para escolher
 * a celebração — e para não celebrar o que já estava celebrado antes.
 *
 * A definição de "novo" é comparativa, e é isso que torna o desfazer seguro:
 * um marco é novo se vale em `depois` e não valia em `antes`. Desfazer produz
 * lista vazia, porque nada passou a valer.
 *
 * Ordem: do menor para o maior feito. A tela celebra o ÚLTIMO da lista (o maior)
 * e pode listar os outros em texto — a celebração tem o tamanho do feito
 * (JORNADA.md §4.6).
 *
 * @param {unknown} antes
 * @param {unknown} depois
 * @param {Array} catalogo
 * @returns {Array<object>}
 */
export function marcosNovos(antes, depois, catalogo) {
  const { lista, byId } = malha(catalogo);
  const a = resumoDaViagem(antes, lista);
  const b = resumoDaViagem(depois, lista);
  const pa = lerProgresso(antes);
  const pb = lerProgresso(depois);
  const feitasAntes = new Set(pa.completed.filter((id) => byId.has(id)));

  const titulo = (id) => {
    const c = byId.get(id);
    return c && typeof c.title === 'string' ? c.title : id;
  };
  const linha = (id) => {
    const c = byId.get(id);
    return c && Number.isFinite(Number(c.stage)) ? Number(c.stage) : null;
  };

  const marcos = [];

  // 1. Chegada: cada estação que passou a constar como concluída.
  for (const id of pb.completed) {
    if (!byId.has(id) || feitasAntes.has(id)) continue;
    marcos.push({ tipo: MARCOS.ESTACAO, id, titulo: titulo(id), linha: linha(id) });
  }

  // 2. Fim da linha: fechou agora e não estava fechada antes.
  for (const [i, depoisLinha] of b.linhas.entries()) {
    const antesLinha = a.linhas[i];
    if (depoisLinha.fechada && !antesLinha?.fechada) {
      marcos.push({
        tipo: MARCOS.FIM_DA_LINHA,
        linha: depoisLinha.linha,
        concluidas: depoisLinha.concluidas,
        total: depoisLinha.total
      });
    }
  }

  // 3. Primeira baldeação: nenhuma antes, pelo menos uma depois.
  if (a.baldeacoesFeitas === 0 && b.baldeacoesFeitas > 0) {
    const primeira = b.baldeacoes[0];
    marcos.push({
      tipo: MARCOS.PRIMEIRA_BALDEACAO,
      de: { id: primeira.de, titulo: titulo(primeira.de), linha: primeira.deLinha },
      para: { id: primeira.para, titulo: titulo(primeira.para), linha: primeira.paraLinha }
    });
  }

  // 4. Terminal: as 35.
  if (b.terminal && !a.terminal) {
    marcos.push({
      tipo: MARCOS.TERMINAL,
      estacoes: b.estacoes,
      diasDeViagem: b.diasDeViagem,
      linhasFechadas: b.linhasFechadas,
      baldeacoesFeitas: b.baldeacoesFeitas
    });
  }

  return marcos;
}

/**
 * As linhas que têm estação disponível agora — para o mapa saber o que acender.
 * Ordem do catálogo.
 * @returns {number[]}
 */
export function linhasAbertas(progresso, catalogo) {
  const { lista, byId } = malha(catalogo);
  const p = lerProgresso(progresso);
  const abertas = unlockedCourses(lista, p.completed);
  const linhas = new Set();
  for (const id of abertas) {
    const c = byId.get(id);
    if (c && Number.isFinite(Number(c.stage))) linhas.add(Number(c.stage));
  }
  return [...linhas].sort((a, b) => a - b);
}
