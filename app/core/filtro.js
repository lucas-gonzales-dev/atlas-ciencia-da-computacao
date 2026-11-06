// Projeto Atlas — o filtro da Explorar (S7, 01/11/2026).
//
// POR QUE EXISTE: a fatia S7 manda a tela Explorar ter busca E filtro de linha,
// e manda a regra de busca ser a de `core/search.js` — "não escreva outra".
// Este módulo não escreve regra de busca nenhuma: ele compõe. `buscar()` decide
// QUEM bate (acento e caixa ignorados, nas três listas); `linhasDoCatalogo()`
// decide QUEM sobra quando um filtro de linha está de pé; `ordenarEstacoes()`
// decide a ORDEM (número natural: Cálculo I antes de Cálculo II, sempre, e sem
// buscar "II" com dois caracteres). A regra fica no core porque roda no node
// (testes) e no navegador (web) sem build — mesma lei da casa.
//
// DERIVAÇÃO PURA: recebe dados, devolve dados. Nunca muta o catálogo. `linha`
// fora do que o catálogo tem (0, 8, 'duas') é IGNORADA — a fatia diz isso para
// a URL, e a URL chega aqui pelo mesmo caminho que o <select>.

import { buscar, normalizar } from './search.js';

/**
 * A linha de uma disciplina: seu estágio. O catálogo da UBL organiza as 35
 * obrigatórias em 7 estágios de 5 — é a malha da Jornada, e o número do
 * estágio É a linha. Nada de campo novo: derivar do que a fonte já tem.
 */
function linhaDe(course) {
  return Number.isInteger(course?.stage) && course.stage > 0 ? course.stage : null;
}

/**
 * As linhas que EXISTEM no catálogo, em ordem. A fatia mostra "Linha 1" a
 * "Linha 7" — e é exatamente isso que sai daqui para o catálogo real, porque
 * ele tem os estágios 1..7. Derivar, nunca escrever 7 fixo: se a fonte mudar,
 * a tela segue a fonte sem ninguém mexer aqui.
 */
export function linhasDoCatalogo(courses) {
  const set = new Set();
  for (const c of courses || []) {
    const l = linhaDe(c);
    if (l !== null) set.add(l);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Ordem de leitura da rede: linha primeiro, estágio dentro dela, e NÚMERO
 * NATURAL no nome — "Cálculo I" antes de "Cálculo II", "Algoritmos I" antes de
 * "Algoritmos II". O `localeCompare` com numeric faz o trabalho dos algarismos
 * romanos? Não — ele não sabe I < II. Por isso o comparador olha o TRAILING
 * em romano (I, II, III...) antes de desistir para o texto.
 */
const ROMANO = /(?:\s|^)(i{1,3}|iv|v|vi{0,3}|ix|x)\s*$/i;
const VALOR_ROMANO = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

function romanoFinal(title) {
  const m = String(title || '').match(ROMANO);
  if (!m) return 0;
  return VALOR_ROMANO[m[1].toUpperCase()] || 0;
}

export function ordenarEstacoes(courses) {
  return [...(courses || [])].sort((a, b) => {
    const la = linhaDe(a) ?? Infinity;
    const lb = linhaDe(b) ?? Infinity;
    if (la !== lb) return la - lb;
    const sa = String(a?.title ?? '');
    const sb = String(b?.title ?? '');
    const ra = romanoFinal(sa);
    const rb = romanoFinal(sb);
    if (ra !== rb) return ra - rb;
    const base = sa.localeCompare(sb, 'pt-BR', { sensitivity: 'base' });
    if (base !== 0) return base;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

/**
 * O estado da lista depois de busca + filtro, PRONTO PARA A TELA.
 *
 * Devolve `{ buscaAtiva, semResultado, estacoes, total, linhas }`:
 *  - `estacoes`: o que aparece, na ordem de leitura;
 *  - `total`: o tamanho da rede inteira (para a frase "n de 35");
 *  - `linhas`: quantas linhas o catálogo tem — para o <select>, não para a
 *    tela chutar 7.
 *
 * O filtro de linha se aplica DEPOIS da busca (busca em "todas", recorte na
 * linha; o resultado é o mesmo dos dois caminhos porque nenhuma das duas
 * funções reordena nem muta).
 */
export function estadoDaLista({ courses, electives, specializations, busca, linha }) {
  const resultado = buscar(busca, { courses, electives, specializations });
  const querLinha = Number.isInteger(linha) && linhasDoCatalogo(courses).includes(linha);
  const estacoes = ordenarEstacoes(
    querLinha ? resultado.courses.filter((c) => linhaDe(c) === linha) : resultado.courses
  );
  return {
    buscaAtiva: resultado.ativa,
    semResultado: resultado.semResultado,
    estacoes,
    eletivas: resultado.electives,
    ramais: resultado.specializations,
    total: (courses || []).length,
    linhas: linhasDoCatalogo(courses).length,
  };
}
