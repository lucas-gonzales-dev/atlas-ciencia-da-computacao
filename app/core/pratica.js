// Projeto Atlas — a PRÁTICA da aula (S25, 06/11/2026).
//
// POR QUE EXISTE: fechar a aula é hoje três caixas de texto, e é ali que a
// pessoa para. A prática devolve o que faz sentido no fim de uma aula — uma
// pergunta com alternativas e a explicação do erro — sem servidor, sem conta e
// sem nota nenhuma: o conteúdo é arquivo no disco (app/data/pratica/) e quem
// decide se escreve continua sendo a pessoa.
//
// REGRAS DESTE MÓDULO:
// 1. **Nunca lança.** O JSON vem do disco e pode estar podre, ausente ou ser
//    um 404 que devolveu HTML. `lerPratica` devolve `{ paradas: [] }` e a tela
//    mostra o fecho simples. Uma pergunta malformada matar a página inteira é
//    o defeito que a S19c ensinou a não repetir.
// 2. **Descarta pergunta, não a estação.** Pergunta sem `id`, sem `pergunta`,
//    sem `certa` ou sem NENHUMA errada não tem o que desenhar nem o que
//    corrigir: some sozinha, e as irmãs dela continuam na rotação.
// 3. **Nada de sorteio.** As alternativas saem numa ordem FIXA para cada
//    pergunta. Alternativa que muda de lugar a cada visita é a pessoa
//    decorando a posição, não o conteúdo — e o app não tem semente pra isso.
//
// A ROTAÇÃO é o item que mais fácil vira achismo, então fica explícito: a
// parada tem mais perguntas do que aulas, e cada aula começa num ponto
// diferente dela — `(posição da aula) × 3`, módulo o total. Quando o índice
// passa do fim ele volta ao começo (por isso `codigos`, com 7 perguntas, dá à
// aula 7 as perguntas 7, 1 e 2). Nunca sai pergunta repetida na mesma aula: se
// restam menos de 3 perguntas, sai o que existe. E com 6 perguntas e 3 aulas a
// terceira volta às da primeira: repetição entre aulas é deliberada — rever a
// mesma pergunta algumas aulas depois é prática de recuperação (S25, 06/11/2026).

/** Quantas perguntas uma aula puxa da parada. É o teto do portão, não uma média. */
export const QUANTAS_POR_AULA = 3;

/** Uma frase de prática tem de ser frase: nada de `null`, `undefined` ou espaço. */
const temTexto = (bruto) => typeof bruto === 'string' && bruto.trim() !== '';

/** `vao` é opcional: sem ele a faixa sai só com o título, e nada quebra. */
function normalizarErrada(bruta) {
  if (temTexto(bruta)) return { texto: bruta, vao: null };
  if (!bruta || typeof bruta !== 'object' || !temTexto(bruta.texto)) return null;
  return { texto: bruta.texto, vao: temTexto(bruta.vao) ? bruta.vao : null };
}

function normalizarPergunta(bruta) {
  if (!bruta || typeof bruta !== 'object') return null;
  if (!temTexto(bruta.id) || !temTexto(bruta.pergunta) || !temTexto(bruta.certa)) return null;
  const erradas = (Array.isArray(bruta.erradas) ? bruta.erradas : [])
    .map(normalizarErrada)
    .filter(Boolean)
    // Errada com o MESMO texto da certa não é alternativa: é a certa escrita
    // duas vezes, e o portão diria "acertou" para quem tocou na mesma linha.
    .filter((e) => e.texto.trim() !== bruta.certa.trim());
  // Sem errada não há portão: a pessoa acertaria por exaustão de uma lista de
  // uma linha, e o `vao` — que é o ensino da S25 — não existiria.
  if (!erradas.length) return null;
  return {
    id: bruta.id,
    pergunta: bruta.pergunta,
    certa: bruta.certa,
    explica: temTexto(bruta.explica) ? bruta.explica : '',
    erradas
  };
}

function normalizarParada(bruta) {
  if (!bruta || typeof bruta !== 'object') return null;
  // `Number(null)` é 0 e `Number('')` é 0: sem o filtro de tipo, um buraco no
  // arquivo criava a aula 0 — uma aula que não existe em estação nenhuma.
  const aulas = (Array.isArray(bruta.aulas) ? bruta.aulas : [])
    .filter((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''))
    .map(Number)
    .filter(Number.isInteger);
  const perguntas = (Array.isArray(bruta.perguntas) ? bruta.perguntas : [])
    .map(normalizarPergunta)
    .filter(Boolean);
  // `titulo` e `id` podem faltar sem destruir nada: a tela não desenha a
  // parada, desenha a pergunta. Já sem `aulas` a parada é incobrável, e sem
  // `perguntas` ela é um vazio com endereço: ficam no arquivo para sempre sem
  // nunca chegar à tela, que é o mesmo de não existirem — e uma delas no meio
  // da lista faria `paradas.length` mentir na varredura do JSON real.
  if (!aulas.length || !perguntas.length) return null;
  return {
    id: temTexto(bruta.id) ? bruta.id : null,
    titulo: temTexto(bruta.titulo) ? bruta.titulo : '',
    aulas,
    perguntas
  };
}

/**
 * Lê o objeto do JSON de prática e devolve só o que dá para desenhar.
 *
 * @param {unknown} bruto o `await response.json()` da estação, ou `{}`
 * @returns {{paradas: Array<{id: string|null, titulo: string, aulas: number[], perguntas: object[]}>}}
 */
export function lerPratica(bruto) {
  if (!bruto || typeof bruto !== 'object' || !Array.isArray(bruto.paradas)) return { paradas: [] };
  return { paradas: bruto.paradas.map(normalizarParada).filter(Boolean) };
}

/**
 * A parada da aula `n`: a primeira cujo `aulas` contém o número.
 *
 * `n` entra como string do endereço e como número do JSON: os dois viram número
 * aqui, porque comparar `'3'` com `3` dava `null` e a aula sairia sem prática
 * nenhuma, em silêncio — o pior tipo de ausência.
 */
export function paradaDaAula(pratica, n) {
  const alvo = Number(n);
  if (!Number.isFinite(alvo)) return null;
  const paradas = pratica?.paradas;
  if (!Array.isArray(paradas)) return null;
  return paradas.find((p) => Array.isArray(p?.aulas) && p.aulas.includes(alvo)) || null;
}

/**
 * As perguntas da aula `n`, em rotação pela parada.
 *
 * @returns {object[]} até `QUANTAS_POR_AULA`, sem repetir pergunta; `[]` sem parada
 */
export function perguntasDaAula(pratica, n) {
  const parada = paradaDaAula(pratica, n);
  const perguntas = parada?.perguntas || [];
  if (!perguntas.length) return [];
  const posicao = parada.aulas.indexOf(Number(n));
  const inicio = (posicao * QUANTAS_POR_AULA) % perguntas.length;
  const quantas = Math.min(QUANTAS_POR_AULA, perguntas.length);
  const saida = [];
  for (let i = 0; i < quantas; i++) saida.push(perguntas[(inicio + i) % perguntas.length]);
  return saida;
}

/**
 * As alternativas da pergunta, na ordem em que vão aparecer.
 *
 * A ordem é o texto ordenado (`localeCompare` com idioma declarado, para a
 * ordem não mudar conforme o idioma do aparelho de quem abre). Isso é o que
 * torna a lista conferível: a mesma pergunta tem SEMPRE as mesmas posições,
 * em qualquer visita e em qualquer máquina.
 *
 * @returns {Array<{texto: string, certa: boolean, vao: string|null}>}
 */
export function opcoesDaPergunta(pergunta) {
  if (!pergunta || typeof pergunta !== 'object' || !temTexto(pergunta.certa)) return [];
  const brutas = Array.isArray(pergunta.erradas) ? pergunta.erradas : [];
  const erradas = brutas
    .map(normalizarErrada)
    .filter((e) => e && temTexto(e.texto))
    .filter((e) => e.texto.trim() !== pergunta.certa.trim());
  // Sem errada a "pergunta" é uma lista de uma linha, e o portão abriria com um
  // toque: `[]` diz à tela "não há portão aqui", que é a resposta honesta.
  if (!erradas.length) return [];
  const saida = [{ texto: pergunta.certa, certa: true, vao: null }]
    .concat(erradas.map((e) => ({ texto: e.texto, certa: false, vao: e.vao ?? null })));
  // `localeCompare` SEM argumento depende do idioma do aparelho, e a ordem das
  // alternativas teria de ser igual no node do teste e no celular da pessoa.
  return saida.sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR'));
}
