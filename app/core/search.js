// Projeto Atlas — busca de disciplina (core).
//
// Regra da casa: roda NO NODE (testes) e NO NAVEGADOR (web/PWA), sem build.
// Zero import de 'node:*', zero filesystem, zero DOM. Recebe dados e devolve
// dados — quem monta o campo, o debounce e a mensagem "nada encontrado" e a
// camada de apresentacao (web/main.js).
//
// Por que existe: o aluno tem 35 obrigatorias, dezenas de eletivas e dezenas
// de especializacoes numa pagina so; rolar ate achar "Cálculo" e trabalho que a
// maquina faz melhor. O requisito que define o modulo e o de sempre: a fonte e
// PORTUGUESA e o teclado do celular as vezes nao digita acento — "calculo" tem
// que achar "Cálculo", e a caixa nunca importa.
//
// Derivacao pura: NUNCA muta as listas que recebeu. Busca inativa devolve
// COPIAS dos arrays (e nao as mesmas referencias) para render() poder tratar
// "sem busca" e "busca que nao descarta nada" pelo mesmo caminho, sem que
// qualquer camada esbarre no estado do outro.

/**
 * Forma de comparar texto com texto: minusculo e sem acento.
 * NFD separa as vogais dos diacriticos; a faixa \u0300-\u036f e exatamente os
 * acentos de "Cálculo", "Introdução", "Administração" — o portugues inteiro.
 * @param {unknown} texto
 * @returns {string} "" para qualquer coisa que nao seja texto
 */
export function normalizar(texto) {
  if (typeof texto !== 'string') return '';
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Filtra uma lista pelo campo `campo`, comparando substring normalizada.
 * Ordem do catalogo preservada (filter nunca reordena). Item sem o campo, ou
 * campo que nao seja string, simplesmente nao bate — nao explode.
 */
function filtrar(lista, campo, termo) {
  if (!Array.isArray(lista)) return [];
  if (!termo) return lista.slice();
  return lista.filter((item) => item && normalizar(item[campo]).includes(termo));
}

/**
 * Aplica a busca as tres listas do Atlas: grade obrigatoria, eletivas e
 * especializacoes (todas pelo title).
 *
 * @param {unknown} query texto digitado; vazio/branco/nulo = busca INATIVA
 * @param {{courses?: Array, electives?: Array, specializations?: Array}} [dados]
 * @returns {{ativa: boolean, semResultado: boolean, courses: Array,
 *            electives: Array, specializations: Array}}
 *
 * `semResultado` so pode ser true com busca ATIVA: "quimica" nao achou nada e
 * a tela precisa DIZER isso (silencio parece tela quebrada). Busca vazia mostra
 * tudo e nunca e "sem resultado", por definicao.
 */
export function buscar(query, dados) {
  const d = dados || {};
  const termo = normalizar(query);
  const ativa = termo.length > 0;

  const courses = filtrar(d.courses, 'title', termo);
  const electives = filtrar(d.electives, 'title', termo);
  const specializations = filtrar(d.specializations, 'title', termo);

  return {
    ativa,
    semResultado: ativa && courses.length === 0 && electives.length === 0 && specializations.length === 0,
    courses,
    electives,
    specializations
  };
}
