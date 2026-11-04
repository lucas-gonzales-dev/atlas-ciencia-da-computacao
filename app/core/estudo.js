// Projeto Atlas — o ESTUDO por aula (S13a, 04/11/2026).
//
// Por que existe: o desenho novo (design/v3/00-desenho.md, "O modelo de
// progresso") diz que a unidade do Atlas deixou de ser a estação e passou a ser
// a AULA, e que o mapa acende quando você LEMBRA, não quando você assiste. Este
// módulo é o degrau mais abaixo disso: ele registra que a pessoa ABRIU uma aula
// e devolve por onde continuar. Nada aqui conta progresso para o mapa — "aberta"
// é o único estado que existe nesta fatia, e o próprio desenho diz que ele "não
// conta para nada". Quem conta é "estudada", e ela nasce na S14.
//
// Regra da casa (igual a core/aulas.js e core/revisao.js): roda NO NODE e NO
// NAVEGADOR, sem build. Zero DOM, zero localStorage, zero 'node:*', zero rede.
// Recebe e devolve objetos NOVOS — quem lê e escreve `localStorage` é a tela,
// que passa o texto para `lerEstudo` e devolve o texto de `serializarEstudo`.
//
// TRÊS DECISÕES, as três cobradas por teste (app/tests/estudo.test.js):
//   1. NADA MUTA A ENTRADA. `abrirAula` é o gesto mais repetido do app (cada
//      toque em "Assistir"): mutar por baixo faria a tela pintar o estado de
//      duas chamadas anteriores. É a mesma regra de core/revisao.js e notes.js.
//   2. ENTRADA FORA DA FORMA NÃO MUDA NADA. Um `quando` sem a forma
//      `aaaa-mm-ddThh:mm` é bug de digitação de quem chama, não estado da
//      pessoa: o estudo volta igual. Precedente: RESULTADOS em core/revisao.js
//      — "qualquer outra palavra não muda nada".
//   3. O PRIMEIRO `abertaEm` NÃO SE REESCREVE. Abrir a mesma aula duas vezes
//      (a pessoa voltou ao vídeo, abriu de outro aparelho e importou, clicou de
//      novo) não pode apagar quando o estudo começou naquela aula: é o único
//      registro de tempo que esta fatia tem, e a S14 vai datar o fechamento ao
//      lado dele.
//
// Datas sempre LOCAIS, no formato `aaaa-mm-ddThh:mm` (regra 13 da casa, a
// mesma de core/revisao.js): `toISOString()` corta em UTC e jogaria a abertura
// de uma aula estudada à noite para o dia seguinte em São Paulo. A data-hora é
// produzida por quem desenha a tela; este módulo só a guarda, não a lê.
//
// A `ultima` é o cartão de retomada da J5 ("Continuar: Aula 13 — Circuitos
// Digitais, de 14:32"). Ela é um registro à parte, DEDUZÍVEL de `aulas` pelo
// maior `abertaEm`? Não: duas aberturas no mesmo minuto empatariam, e o
// desate por `n` daria a aula errada quando a pessoa volta a uma aula antiga
// de propósito. Guardar o último toque é um campo, e é o único campo redundante
// daqui — vale o cartão que ele paga.

/** A chave no localStorage. Separada de progresso e anotações: ciclos de vida diferentes. */
export const ESTUDO_KEY = 'atlas.estudo.v1';

/** O formato que este módulo sabe ler. Outro número não é "uma versão antiga": é um dado que não se conhece. */
const VERSAO_FORMATO = 1;

/**
 * Os estados da aula que EXISTEM hoje (S14a). Crescem para 'lembrada',
 * 'consolidada' e 'pulada', e cada um é um degrau acima deste.
 */
export const ESTADOS_DA_AULA = Object.freeze(['nao-iniciada', 'aberta', 'estudada']);

/** `aaaa-mm-ddThh:mm` local, sem segundos e sem fuso. */
const HE_QUANDO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Os estados que se deduzem de um registro, DO MAIS AVANÇADO PARA O MAIS BÁSICO. */
const ESCADA = Object.freeze([
  // S14a acrescentou 'estudada' aqui, como estava planejado: o resto do módulo
  // (resumoDaEstacao, continuarDe, a tela) já enxergava o estado novo sem outra
  // mudança, porque todos perguntam por estadoDaAula, nunca por campo. 'estudada'
  // fica ACIMA de 'aberta' porque é o degrau que a pessoa fecha, não abre.
  ['estudada', 'estudadaEm'],
  ['aberta', 'abertaEm'],
]);

/** Quanto texto o estudo guarda por campo (recordação e conferência). 2.000 caracteres é ~1 parágrafo longo. */
const LIMITE_TEXTO = 2000;

const texto = (v) => (typeof v === 'string' && v.trim() ? v : '');
const numero = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
/** O texto que a pessoa escreveu, sem as pontas e com teto. Cortar é melhor que recusar: quem digitou 2.400 caracteres escreveu a recordação, e perder o que passou do teto não apaga o que ela lembrou. */
const escrever = (v) => String(v ?? '').trim().slice(0, LIMITE_TEXTO);

function vazio() {
  return { versao: VERSAO_FORMATO, aulas: {}, ultima: null };
}

/**
 * O texto do localStorage vira o estudo. Corrompido, vazio, de outra versão ou
 * de um formato que não se conhece: o estudo VAZIO, sem erro.
 *
 * Silencioso de propósito. A pessoa não tem como consertar um JSON quebrado, e
 * uma tela que joga "dados corrompidos" na cara de quem acabou de abrir o app
 * no ônibus é pior que recomeçar sem marcar as aulas abertas — o que se perde é
 * a posição de retomada, não o estudo. Registra-se o fato de abrir vazio; a
 * gravação da primeira aula já reescreve o arquivo.
 *
 * @param {unknown} bruto o valor cru de `localStorage.getItem(ESTUDO_KEY)`
 * @returns {{versao: number, aulas: Record<string, object>, ultima: object|null}}
 */
export function lerEstudo(bruto) {
  if (typeof bruto !== 'string' || !bruto.trim()) return vazio();
  let dado;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return vazio();
  }
  if (!dado || typeof dado !== 'object' || dado.versao !== VERSAO_FORMATO) return vazio();

  const brutos = dado.aulas && typeof dado.aulas === 'object' ? dado.aulas : {};
  const aulas = {};
  for (const [id, r] of Object.entries(brutos)) {
    if (!r || typeof r !== 'object' || !id) continue;
    // Sem data nenhuma não há registro: um `aberta: true` sem `abertaEm` seria o
    // estado da casa antiga (booleano por estação) entrando de contrabando. Desde
    // a S14a basta também um `estudadaEm`: quem fecha uma aula tem as duas datas
    // (estudarAula grava a abertura que faltou), e um registro vindo de uma
    // migração futura com só a data de estudo não pode ser jogado fora — perder
    // estudo em silêncio é o pior defeito que este módulo tem.
    const temData = (c) => typeof r[c] === 'string' && r[c];
    if (!temData('abertaEm') && !temData('estudadaEm')) continue;
    // O `...r` preserva o que a S14 gravar ao lado (estudadaEm, puladaEm) sem
    // que esta função precise conhecer o futuro: perder um campo no round-trip
    // ler->escrever seria apagar estudo sem ninguém ter pedido.
    aulas[id] = { ...r, estacao: texto(r.estacao), n: numero(r.n), abertaEm: r.abertaEm };
  }

  const u = dado.ultima;
  const ultima =
    u && typeof u === 'object' && texto(u.aula) && texto(u.estacao)
      ? { estacao: texto(u.estacao), aula: texto(u.aula), n: numero(u.n), em: texto(u.em) || null }
      : null;

  return { versao: VERSAO_FORMATO, aulas, ultima };
}

/** Cópia profunda até o segundo nível: o único jeito de "não mutar a entrada" sem clone estrutural. */
function copiar(estudo) {
  const aulas = {};
  for (const [id, r] of Object.entries(estudo?.aulas ?? {})) aulas[id] = { ...r };
  return {
    versao: VERSAO_FORMATO,
    aulas,
    ultima: estudo?.ultima ? { ...estudo.ultima } : null,
  };
}

/**
 * Marca a aula como ABERTA. Devolve o estudo novo; a entrada fica intacta.
 *
 * @param {{aulas: object, ultima: object|null}} estudo
 * @param {{estacao: string, aula: string, n: number}} aula `estacao` é o id da
 *   estação, `aula` é o id do vídeo no YouTube, `n` é a posição dela na lista
 * @param {string} quando `aaaa-mm-ddThh:mm` local
 * @returns o estudo novo
 */
export function abrirAula(estudo, { estacao, aula, n } = {}, quando) {
  const novo = copiar(estudo);
  if (!texto(aula) || !texto(estacao) || !HE_QUANDO.test(String(quando ?? ''))) return novo;

  const antes = novo.aulas[aula];
  novo.aulas[aula] = {
    ...(antes ?? {}),
    estacao,
    n: numero(n),
    // o abertaEm da PRIMEIRA vez não muda quando se abre de novo (decisão 3).
    abertaEm: typeof antes?.abertaEm === 'string' && antes.abertaEm ? antes.abertaEm : quando,
  };
  novo.ultima = { estacao, aula, n: numero(n), em: quando };
  return novo;
}

/**
 * Marca a aula como ESTUDADA — o fecho da J2, e o único estado que conta para o
 * mapa. Devolve o estudo novo; a entrada fica intacta (decisão 1, a mesma de
 * `abrirAula`, porque fechar a aula é o gesto mais caro do app e a tela pinta o
 * que ele devolve).
 *
 * As três coisas que este registro faz de uma vez:
 *   1. grava `estudadaEm` — e o da PRIMEIRA vez não se reescreve, pela mesma razão
 *      do `abertaEm` (decisão 3): reabrir o fecho de uma aula já estudada não pode
 *      apagar quando ela foi aprendida;
 *   2. guarda a recordação sem olhar e a conferência, cortadas em LIMITE_TEXTO — é
 *      o rastro de que a pessoa lembrou, e é o que a S17 olha para decidir
 *      durabilidade;
 *   3. grava `abertaEm` se ainda não houver. Um fecho sem abertura é possível
 *      (a pessoa abriu o vídeo por fora, ou importou uma viagem só com o fecho), e
 *      uma aula 'estudada' sem data de abertura deixaria o `continuarDe` sem data
 *      nenhuma para ordenar as aulas daquela estação.
 *
 * A `ultima` vira esta aula: quem fecha é quem está aqui, e o cartão de retomada
 * da J5 tem de apontar para onde a pessoa acabou de estar.
 *
 * @param {{aulas: object, ultima: object|null}} estudo
 * @param {{estacao: string, aula: string, n: number}} aula
 * @param {string} quando `aaaa-mm-ddThh:mm` local
 * @param {{recordacao?: string, conferencia?: string}} [textos] o que a pessoa escreveu
 * @returns o estudo novo
 */
export function estudarAula(estudo, { estacao, aula, n } = {}, quando, { recordacao, conferencia } = {}) {
  const novo = copiar(estudo);
  if (!texto(aula) || !texto(estacao) || !HE_QUANDO.test(String(quando ?? ''))) return novo;

  const antes = novo.aulas[aula];
  novo.aulas[aula] = {
    ...(antes ?? {}),
    estacao,
    n: numero(n),
    abertaEm:
      typeof antes?.abertaEm === 'string' && antes.abertaEm ? antes.abertaEm : quando,
    estudadaEm:
      typeof antes?.estudadaEm === 'string' && antes.estudadaEm ? antes.estudadaEm : quando,
    // Os textos só entram escritos: um `recordacao: ''` de um formulário vazio não
    // apaga a recordação que já estava lá na segunda passada do fecho.
    ...(escrever(recordacao) ? { recordacao: escrever(recordacao) } : {}),
    ...(escrever(conferencia) ? { conferencia: escrever(conferencia) } : {}),
  };
  novo.ultima = { estacao, aula, n: numero(n), em: quando };
  return novo;
}

/**
 * O estado da aula, pelo registro dela. `nao-iniciada` quando não há registro.
 * A ESCADA é o que faz este retorno crescer sem que ninguém que o consome
 * precise mudar: a S14 põe uma linha e 'estudada' passa a sair daqui.
 *
 * @returns {'nao-iniciada'|'aberta'|string}
 */
export function estadoDaAula(estudo, aula) {
  const r = estudo?.aulas?.[texto(aula)];
  if (!r) return 'nao-iniciada';
  for (const [estado, campo] of ESCADA) {
    if (typeof r[campo] === 'string' && r[campo]) return estado;
  }
  return 'nao-iniciada';
}

/**
 * A aula por onde a pessoa CONTINUA naquela estação, com o motivo — é o cartão
 * de "Continuar: Aula 13" da folha e o botão "Começar" da primeira visita.
 *
 * As regras, na ordem em que se aplicam (decisão do Claude, canal do dogfood,
 * 04/11/2026, S13c; e o acréscimo do estado 'estudada' na S14a, 04/11/2026):
 *   1. a última abertura foi desta estação, a aula ainda está na lista e ela NÃO
 *      foi estudada → ela;
 *   2. entre as desta estação: (a) a aberta mais recente que ainda não foi
 *      estudada, pelo maior `abertaEm`, empate pelo maior `n`; (b) se todas as
 *      abertas já foram estudadas, a primeira não estudada DEPOIS da fronteira
 *      (o maior `n` estudado) — o próximo buraco à frente, não o primeiro atrás;
 *      (c) se não sobra nada à frente, a última aula da estação, com
 *      'estacao-percorrida' quando a estação inteira foi estudada;
 *   3. nenhuma aberta → a primeira ('comecar').
 *
 * O que a S14a mudou e o teste cobra: uma aula ESTUDADA nunca é a retomada. Antes
 * dela, fechar a Aula 14 e voltar à estação devolvia "Continuar: Aula 14" — a
 * pessoa tocava numa aula que já fechou, e o cartão de retomada perdia o valor no
 * exato momento em que ela mais serve. A regra 1 passou a checar o estado, não só
 * a existência: se a `ultima` está estudada, cai na regra 2 e a retomada vai para
 * a frente dela.
 *
 * O motivo 'estacao-percorrida' descreve a FRONTEIRA que a pessoa abriu, não o
 * estado da estação no mapa. Uma estação com as aulas 1 e 2 puladas e a 3 fechada
 * tem a frente no fim e diria 'ultima-aberta' com a última; 'percorrida' de verdade
 * é `resumoDaEstacao().estudadas === total`, que é o que a S16 vai ler para abrir
 * o desafio (J4). Ninguém deve inferir completude por este motivo.
 *
 * O motivo 'primeira-nao-aberta' SAIU, e este comentário é o lugar onde a saída
 * fica registrada. Ele devolvia a Aula 1 para quem tinha aberto a 13 e a 14:
 * a spec da S13a dizia "a primeira aula ainda não aberta", literal, e a tela
 * leria como se a pessoa não tivesse estudado nada — ela tocaria numa aula que
 * já pulou. A retomada de verdade é o último toque, não o primeiro buraco.
 *
 * A regra 1 checa a LISTA porque as aulas vêm da YouTube API e são regeradas a
 * cada 30 dias: um vídeo sai da playlist, e continuar por uma aula que não está
 * mais na tela é um endereço que mente. Quando ela falha, a regra 2 alcança o
 * mesmo lugar pelo `abertaEm` de quem registrou a abertura naquela estação.
 *
 * A regra 2 ordena por DATA DE ABERTURA e não por `n` porque voltar de
 * propósito a uma aula antiga é estudar, e quem anda para trás não quer ser
 * mandado para a frente. `abertaEm` é `aaaa-mm-ddThh:mm` local: comparar como
 * texto é comparar como tempo, sem fuso no meio (regra 13 da casa).
 *
 * @param {{aulas: object, ultima: object|null}} estudo
 * @param {string} estacao o id da estação
 * @param {Array<{id: string, n: number}>} aulas a lista da estação
 * @param {{concluida?: boolean, proxima?: {aula: object|null, estacao?: string|null}}|null} [opcoes]
 *   S20a-3: `concluida` diz que a ESTACÃO pedida já terminou (quem chama sabe,
 *   pelo catálogo: `resumoDaViagem` / `estadoDaEstacao`); `proxima.aula` é a
 *   primeira aula para onde apontar, trazida de fora — o núcleo não busca
 *   arquivo nenhum. Sem `opcoes`, o comportamento é o de sempre, e é assim que
 *   as 25 chamadas antigas continuam valendo.
 * @returns {{aula: object, motivo: string}|null} null quando a estação não tem aulas,
 *   ou quando é concluída e quem chamou não trouxe para onde apontar
 */
export function continuarDe(estudo, estacao, aulas, opcoes) {
  // REGRA DA ESTAÇÃO CONCLUÍDA (S20a-3, item 2 do pedido, 04/11/2026): quem já
  // passou por esta estação não recebe «Continuar: Aula 1» dela. O defeito entrou
  // pelo fluxo do embarque — a pessoa marca a estação, recarrega, e o topo
  // oferecia a Aula 1 DAQUELA estação ao lado de uma lateral que dizia «Sua
  // próxima estação: <outra>». É a mentira da S13a por outra porta.
  //
  // A regra mora aqui, no núcleo, e não na tela: o `return { aula: lista[0] }`
  // da regra de quem ainda não abriu nada é o único lugar do app que devolvia
  // uma aula de uma estação sem registro nenhum — e é exatamente o que uma
  // estação concluída tem. Com `concluida: true`, a resposta é a primeira aula
  // do `proxima` que quem chama trouxe (do MESMO `resumoDaViagem` que a lateral
  // lê — fonte única), ou `null`: nenhum endereço inventado.
  if (opcoes?.concluida) {
    const p = opcoes.proxima;
    if (!p || !p.aula) return null;
    return { aula: p.aula, estacao: p.estacao ?? null, motivo: 'estacao-concluida' };
  }
  const lista = Array.isArray(aulas) ? aulas.filter((a) => a && texto(a.id)) : [];
  if (!lista.length) return null;
  const porId = new Map(lista.map((a) => [a.id, a]));
  const nDe = (a) => Number(a.n) || 0;
  const estado = (a) => estadoDaAula(estudo, a.id);

  // Regra 1: o último toque daqui, se a aula está na lista e AINDA não foi
  // estudada. O `!== 'estudada'` é a mudança da S14a: fechar a aula retira o
  // cartão de retomada de cima dela, e a regra 2 alcança a frente.
  const ultima = estudo?.ultima;
  const ultAula = ultima && ultima.estacao === estacao ? porId.get(ultima.aula) : undefined;
  if (ultAula && estado(ultAula) !== 'estudada') return { aula: ultAula, motivo: 'ultima-aberta' };

  const abertas = lista.filter((a) => estado(a) !== 'nao-iniciada');
  if (!abertas.length) return { aula: lista[0], motivo: 'comecar' };

  // Regra 2a: a aberta mais recente que ainda não foi estudada. Começa na de
  // maior `n` para o empate de `abertaEm` (duas aulas no mesmo minuto) cair na
  // mais avançada sem depender da ordem de `aulas` — que é a da playlist, e a
  // playlist muda quando um vídeo sai dela.
  const momento = (a) => String(estudo?.aulas?.[a.id]?.abertaEm ?? '');
  const paraEstudar = abertas.filter((a) => estado(a) !== 'estudada');
  if (paraEstudar.length) {
    const maisRecente = paraEstudar.reduce((melhor, a) => {
      if (momento(a) > momento(melhor)) return a;
      if (momento(a) === momento(melhor) && nDe(a) > nDe(melhor)) return a;
      return melhor;
    }, [...paraEstudar].sort((x, y) => nDe(x) - nDe(y)).pop());
    return { aula: maisRecente, motivo: 'ultima-aberta' };
  }

  // Regra 2b: todas as abertas daqui já foram estudadas. A retomada é o primeiro
  // buraco À FRENTE da fronteira (o maior `n` entre as estudadas), nunca o
  // primeiro atrás: quem pulou a Aula 1 de propósito não é mandado de volta a
  // ela como se fosse novidade — a cena que derrubou o 'primeira-nao-aberta'.
  const estudadas = abertas;
  const fronteira = estudadas.reduce((maior, a) => (nDe(a) > nDe(maior) ? a : maior), estudadas[0]);
  const aFrente = lista
    .filter((a) => nDe(a) > nDe(fronteira) && estado(a) !== 'estudada')
    .sort((x, y) => nDe(x) - nDe(y))[0];
  if (aFrente) return { aula: aFrente, motivo: 'ultima-aberta' };

  // Regra 2c: nada à frente — a fronteira é o fim da lista.
  return {
    aula: fronteira,
    motivo: lista.every((a) => estado(a) === 'estudada') ? 'estacao-percorrida' : 'ultima-aberta',
  };
}

/**
 * O que a folha mostra da estação: quantas aulas ela tem, quantas já foram
 * abertas e quanto falta assistir. `segundosRestantes` é o número cru — quem o
 * escreve na tela passa por `duracaoLegivel` de core/aulas.js, porque a regra 9
 * da casa não deixa duas telas formatarem a mesma duração de dois jeitos.
 *
 * O critério é o ESTADO, não o campo, e é isso que fez a S14a não precisar mexer
 * em quem consome isto: uma aula estudada continua contada como aberta.
 *
 * Desde a S14a há DOIS contadores e eles não são a mesma coisa:
 *   · `abertas` é o que a pessoa tocou — o número que a folha mostra hoje;
 *   · `estudadas` é o que ela FECHOu, e é o que conta para o mapa.
 * `segundosRestantes` passou a somar as aulas NÃO ESTUDADAS, e não as não
 * abertas: assistir sem fechar não é progresso, e a folha que dizia "faltam ~30 h"
 * enquanto a pessoa fechava aulas uma a uma estava mentindo na direção contrária —
 * ela descontava tempo que ninguém aprendeu. A decisão do pedido da S14a é literal:
 * "segundosRestantes passa a somar as aulas NÃO ESTUDADAS".
 *
 * A frase da tela ainda diz "abertas" até a S14b trocar o texto: é o que é
 * verdade sobre o campo, e a contagem do tempo passa a ser honesta antes do
 * rótulo. Deixei as duas coisas desencontradas de propósito, e é aqui, e não na
 * tela, que o encontro se desfaz.
 *
 * @returns {{total: number, abertas: number, estudadas: number, segundosRestantes: number}}
 */
export function resumoDaEstacao(estudo, estacao, aulas) {
  const lista = Array.isArray(aulas) ? aulas.filter((a) => a && texto(a.id)) : [];
  let abertas = 0;
  let estudadas = 0;
  let segundosRestantes = 0;
  for (const a of lista) {
    const e = estadoDaAula(estudo, a.id);
    if (e !== 'nao-iniciada') abertas += 1;
    if (e === 'estudada') estudadas += 1;
    else segundosRestantes += Number(a.duracaoS) || 0;
  }
  return { total: lista.length, abertas, estudadas, segundosRestantes };
}

/**
 * O texto para `localStorage.setItem(ESTUDO_KEY, ...)`. A `versao` vai junto: é
 * o que faz um formato futuro poder dizer "isso é v1" em vez de adivinhar.
 *
 * @returns {string}
 */
export function serializarEstudo(estudo) {
  return JSON.stringify({
    versao: VERSAO_FORMATO,
    aulas: estudo?.aulas ?? {},
    ultima: estudo?.ultima ?? null,
  });
}

/* ── o RASCUNHO do fechamento (S14b2) ────────────────────────────────────────
 *
 * POR QUE MORA AQUI E NÃO NA TELA: o formulário é a única parte do Atlas em que
 * a pessoa escreve texto longo e ainda NÃO decidiu guardar nada. Perder o que
 * ela digitou porque a aba foi fechada é o defeito que faz ninguém escrever
 * mais de duas linhas, e o formato desse texto tem de ter um dono com versão,
 * igual ao estudo e aos cartões. A tela só chama.
 *
 * Uma chave POR AULA ('atlas.rascunho.<id do vídeo>'), e não um mapa só: duas
 * abas abertas em aulas diferentes não se sobrescrevem, apagar o rascunho depois
 * do envio é uma linha, e um arquivo grande demais para o storage derruba uma
 * aula, não o estudo inteiro.
 *
 * Continua puro: recebe texto, devolve objeto; quem escreve no localStorage é a
 * tela. Os campos têm teto (LIMITE_RASCUNHO) porque rascunho é texto solto de
 * formuLário, e 2.000 caracteres por campo já é o teto do que o estudo guarda.
 */

/** O começo de toda chave de rascunho. */
export const RASCUNHO_PREFIXO = 'atlas.rascunho.';

/** O teto de cada campo do rascunho — o mesmo do estudo, para a pessoa poder rascunhar o que consegue estudar. */
const LIMITE_RASCUNHO = 2000;

/** O rascunho vazio, que é também o que um texto ilegível devolve. */
export function rascunhoVazio() {
  return { versao: VERSAO_FORMATO, lembrar: '', conferir: '', cartoes: [] };
}

/** A chave no localStorage de uma aula. Sem id de aula, sem chave: quem chama decide o que fazer. */
export function chaveRascunho(aula) {
  const id = texto(aula);
  return id ? `${RASCUNHO_PREFIXO}${id}` : '';
}

/** O texto do storage vira rascunho. Corrompido, vazio ou de outra versão: rascunho vazio, sem erro — a mesma regra de `lerEstudo`. */
export function lerRascunho(bruto) {
  if (typeof bruto !== 'string' || !bruto.trim()) return rascunhoVazio();
  let dado;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return rascunhoVazio();
  }
  if (!dado || typeof dado !== 'object' || dado.versao !== VERSAO_FORMATO) return rascunhoVazio();
  const face = (v) => String(v ?? '').trim().slice(0, LIMITE_RASCUNHO);
  return {
    versao: VERSAO_FORMATO,
    lembrar: face(dado.lembrar),
    conferir: face(dado.conferir),
    // Um cartão de rascunho é par frente/verso; qualquer outra forma some. Um
    // rascunho com campos de sobra (colados por outra versão) não é motivo para
    // desenhar sobra: a tela lê três nomes, sempre.
    //
    // A ORDEM IMPORTA, e estava errada (pega por tests/fechamento-nucleo.test.js
    // em 04/11/2026): o teto vinha ANTES do filtro, então `[lixo, lixo, lixo,
    // cartão válido]` cortava nos três primeiros e devolvia ZERO cartões — a
    // pessoa perdia o que escreveu por causa de entradas que nem cartão são. O
    // teto é sobre cartões, e lixo não é cartão: filtra-se primeiro, corta-se
    // depois.
    cartoes: (Array.isArray(dado.cartoes) ? dado.cartoes : [])
      .filter((c) => c && typeof c === 'object')
      .slice(0, 3)
      .map((c) => ({ frente: face(c.frente), verso: face(c.verso) })),
  };
}

/** O texto para `localStorage.setItem(chaveRascunho(id), ...)`. */
export function serializarRascunho(rascunho) {
  return JSON.stringify({
    versao: VERSAO_FORMATO,
    lembrar: String(rascunho?.lembrar ?? '').slice(0, LIMITE_RASCUNHO),
    conferir: String(rascunho?.conferir ?? '').slice(0, LIMITE_RASCUNHO),
    cartoes: (Array.isArray(rascunho?.cartoes) ? rascunho.cartoes : [])
      .slice(0, 3)
      .map((c) => ({ frente: String(c?.frente ?? '').slice(0, LIMITE_RASCUNHO), verso: String(c?.verso ?? '').slice(0, LIMITE_RASCUNHO) })),
  });
}
