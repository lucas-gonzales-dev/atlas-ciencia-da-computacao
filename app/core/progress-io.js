// Projeto Atlas — levar o progresso junto (exportar / importar).
//
// Regra da casa: roda NO NODE (testes) e NO NAVEGADOR (web/PWA), sem build.
// Zero import de 'node:*', zero filesystem, zero DOM. Recebe dados e texto,
// devolve dados e texto — quem salva no storage e quem baixa o arquivo e a
// camada de apresentacao.
//
// Por que existe: o progresso mora no localStorage de UM navegador. Sem isto,
// trocar de aparelho (celular <-> PC) e comecar do zero, e limpar o cache do
// navegador apaga meses de estudo sem aviso.
//
// DUAS DECISOES DE HONESTIDADE, as duas cobradas por testes:
//   1. Arquivo quebrado NUNCA devolve `completed`. Quem chama nao tem o que
//      salvar, entao o progresso que ja existe sobrevive por construcao — nao
//      por um try/catch bem colocado na tela.
//   2. Id que nao pertence a ESTE catalogo e ignorado e CONTADO. Aceitar seria
//      mostrar "12/35 concluidas" sem 12 materias; descartar em silencio seria
//      o aluno perder progresso de um catalogo antigo sem nunca saber.
//
// Versao do formato: 2 (28/10/2026). Ela existe para o dia em que o envelope
// mudar — um arquivo sem versao e um arquivo que este Atlas teria de ADIVINHAR,
// e adivinhar formato de arquivo de usuario e como se perde progresso. Esse dia
// chegou: a versao 2 acrescenta `notas` (anotacoes por disciplina).
//
// Versao 3 (05/11/2026, S20b-1b): o ARQUIVO DEIXOU DE SER SÓ A VIAGEM. O Atlas
// mudou de unidade — a aula e o cartão, não a estação — e o backup não tinha
// mudado junto: quem trocasse de aparelho levava os 35 carimbos e PERDIA cada
// aula aberta, cada aula estudada, cada cartão escrito e cada rascunho pela
// metade. Um backup que não leva o centro do produto não é backup do produto.
// Entram `estudo` (atlas.estudo.v1), `cartoes` (atlas.cartoes.v1), `rascunhos`
// (as chaves atlas.rascunho.*) e `dominadas` (o carimbo do desafio, que a
// versao 2 tambem nao levava).
//
// A REGRA DA VERSAO, e por que ela e a parte mais importante deste arquivo:
// subir a versao e facil; o que nao pode acontecer e o aluno que ainda esta no
// Atlas de ontem abrir o arquivo de hoje e perder tudo. Por isso:
//   - quem EXPORTA escreve a versao atual (3), sempre;
//   - quem IMPORTA aceita 1, 2 E 3, e um arquivo sem `notas` (versao 1) ou sem
//     `estudo`/`cartoes`/`rascunhos` (versoes 1 e 2) importa limpo, com recado de
//     que aquilo que o aparelho tem e o arquivo nao menciona fica INTACTO;
//   - "o arquivo nao falou" e sempre `null` na saida, nunca `{}` vazio: `{}` leria
//     como "nao ha nenhum" e apagaria a fila de quem reimporta um backup velho
//     (o bug que a S8 deixou no caminho, com as revisoes);
//   - versao ACIMA da que este Atlas entende e recusada dizendo ate onde ele
//     vai — nunca lida como se fosse igual, porque "igual" ali e chute.

/** Nome do formato. Vai dentro do arquivo exportado. */
export const FORMATO = 'atlas.progresso';

/** Versao do formato. Bump obrigatoria se o envelope mudar de forma. */
export const VERSAO_FORMATO = 3;

/** Versao mais antiga que este Atlas ainda sabe ler. Abaixo disso, recusa. */
export const VERSAO_MINIMA = 1;

// As regras da anotacao moram em core/notes.js, com teste proprio. Este arquivo
// NAO reimplementa corte de tamanho nem "vazio apaga": duas copias da mesma
// regra e a receita para o arquivo exportado e o guardado no aparelho
// discordarem em silencio. Sem ciclo: notes.js nao importa daqui.
// As regras do calendário de revisão moram em core/revisao.js, com teste
// próprio. Este arquivo não reimplementa degrau nem soma de dias; só limpa e
// filtra o que chegou do arquivo.
import { parseNotas, filtrarNotas } from './notes.js';
import { sanitizar } from './revisao.js';
// Os três baldes novos da versão 3 têm DONO no próprio módulo, e este arquivo não
// reimplementa a malha deles: `lerEstudo`/`lerCartoes`/`lerRascunho` são o mesmo
// leitor que a tela usa para abrir o storage, então um arquivo que eles aceitam é
// exatamente um arquivo que o app sabe ler de volta. É também o que faz a trava de
// "byte a byte" significar alguma coisa: serializar pelo módulo dono, não por um
// JSON.stringify local que um dia diverge do formato real.
import {
  ESTUDO_KEY, RASCUNHO_PREFIXO, chaveRascunho,
  lerEstudo, serializarEstudo, lerRascunho, serializarRascunho
} from './estudo.js';
import { CARTOES_KEY, lerCartoes, serializarCartoes } from './cartoes.js';
// `dominadas` é remontado por viagem.js (mesma malha do storage); reimplementá-la
// aqui seria a segunda regra do carimbo do desafio.
import { lerProgresso } from './viagem.js';

/**
 * Ids validos do catalogo, na ORDEM do catalogo.
 * Saida ordenada pelo catalogo (e nao pela ordem de conclusao) para o arquivo
 * exportado ser legivel por gente e para dois exports do mesmo estado serem
 * byte a byte identicos — diff de arquivo de progresso passa a fazer sentido.
 * @param {Array<{id: string}>} courses
 * @returns {string[]}
 */
function idsDoCatalogo(courses) {
  const lista = Array.isArray(courses) ? courses : [];
  return lista.filter((c) => c && typeof c.id === 'string').map((c) => c.id);
}

/**
 * Filtra ids desconhecidos/duplicados e reordena pela ordem do catalogo.
 * @returns {{completed: string[], ignorados: number, descartados: string[]}}
 */
function filtrar(idsCandidatos, catalogo) {
  const conhecidos = new Set(catalogo);
  const vistos = new Set();
  const descartados = [];

  for (const id of idsCandidatos) {
    if (typeof id !== 'string' || !conhecidos.has(id)) {
      if (typeof id === 'string') descartados.push(id);
      continue;
    }
    vistos.add(id);
  }

  return {
    completed: catalogo.filter((id) => vistos.has(id)),
    ignorados: idsCandidatos.filter((id) => typeof id !== 'string' || !conhecidos.has(id)).length,
    descartados
  };
}

/**
 * Tudo o que a tela lista: grade, eletivas e especializacoes, nesta ordem.
 * Existe porque a anotacao NAO e so da grade — o aluno anota na eletiva
 * arquivada e na especializacao tambem, e um id valido para anotacao e um id
 * que existe em qualquer uma das tres listas. Sem isto o export jogaria fora
 * exatamente as anotacoes que o pedido 10 pediu para levar, e a ordem e a mesma
 * da tela: dois exports do mesmo estado ficam byte a byte identicos.
 * @returns {Array<{id: string}>}
 */
function listaCatalogo({ courses, electives, specializations } = {}) {
  const soComId = (lista) =>
    (Array.isArray(lista) ? lista : []).filter((x) => x && typeof x.id === 'string');
  return [...soComId(courses), ...soComId(electives), ...soComId(specializations)];
}

/**
 * Anotacoes aceitas para importar: validadas pelo catalogo COMPLETO e na ordem
 * dele. `parseNotas` cobre o caso de o campo ter chegado como texto (arquivo
 * editado a mao); objeto normal passa direto.
 * @returns {{anotacoes: Record<string,string>, ignorados: number, descartados: string[]}}
 */
function anotacoesDoArquivo(brutas, catalogo) {
  const mapa = typeof brutas === 'string' ? parseNotas(brutas) : (brutas ?? {});
  const { notas, ignorados, descartados } = filtrarNotas(mapa, catalogo);
  return { anotacoes: notas, ignorados, descartados };
}

/**
 * Revisões aceitas para exportar/importar: mesmas mãos da anotação — catálogo
 * COMPLETO (grade + eletivas + especializações), id desconhecido fora e CONTADO.
 * Aqui `sanitizar` só ordena e filtra; degrau e data ilegíveis ficam intactos,
 * porque a tela os trata na leitura e um arquivo não ensina o núcleo a mentir.
 * @returns {{revisoes: object, ignorados: number, descartados: string[], ilegivel: boolean}}
 */
function revisoesDoArquivo(brutas, catalogo) {
  return sanitizar(brutas, catalogo);
}

/**
 * O texto CANONICO de um balde do storage para dentro do arquivo.
 *
 * POR QUE LER E RESERIALIZAR AQUI, E NAO COPIAR O TEXTO CRU: o arquivo passa a
 * ser a fonte de verdade de quem troca de aparelho, e um arquivo com o bytes do
 * storage de um Atlas antigo seria lido AMANHÃ por um núcleo que mudou. Lendo
 * pelo módulo DONO (`lerEstudo`, `lerCartoes`, `lerRascunho`) e escrevendo pelo
 * módulo DONO (`serializarEstudo`, `serializarCartoes`, `serializarRascunho`), o
 * arquivo carrega sempre o formato que este app sabe produzir — e é isso que faz
 * "exportar e importar de volta devolve os mesmos bytes" ser uma prova e não uma
 * sorte. Nada aqui reimplementa malha de campo: um registro ruim cai na mesma
 * peneira que cairia se a pessoa abrisse a tela.
 *
 * Ausência e vazio: `null`/`undefined`/texto em branco significam "este aparelho
 * não falou desse balde", e o campo NÃO ENTRA no arquivo. Entrar com `{}` seria
 * dizer "não há nenhum", e importar apagaria o que o outro aparelho tem — o bug
 * que a S8 deixou no caminho com as revisões, agora com os cartões no lugar.
 *
 * @param {unknown} bruto o texto cru do storage (ou o objeto já lido)
 * @param {(bruto: unknown) => object} ler o leitor dono
 * @param {(dado: object) => string} serializar o serializador dono
 * @returns {string|null} o texto canônico, ou null quando o balde não falou
 */
function baldeCanonico(bruto, ler, serializar) {
  if (bruto === undefined || bruto === null) return null;
  if (typeof bruto === 'string' && !bruto.trim()) return null;
  const texto = typeof bruto === 'string' ? bruto : JSON.stringify(bruto);
  return serializar(ler(texto));
}

/**
 * Os rascunhos para dentro do arquivo: um mapa `atlas.rascunho.<aula>` → texto
 * canônico. Só entra chave com o prefixo do formato (a tela varre o storage e
 * pode trazer qualquer coisa do lado), e só entra rascunho que tem texto — um
 * rascunho vazio é a pessoa que abriu o formulário e não escreveu nada, e levar
 * isso seria o arquivo crescer com casca vazia por aula aberta.
 * @returns {Record<string,string>|null}
 */
function rascunhosParaArquivo(brutos) {
  if (!brutos || typeof brutos !== 'object' || Array.isArray(brutos)) return null;
  const saida = {};
  for (const [chave, bruto] of Object.entries(brutos)) {
    if (typeof chave !== 'string' || !chave.startsWith(RASCUNHO_PREFIXO)) continue;
    const texto = baldeCanonico(bruto, lerRascunho, serializarRascunho);
    if (!texto) continue;
    const dado = lerRascunho(texto);
    if (!dado.lembrar && !dado.conferir && dado.cartoes.length === 0) continue;
    saida[chave] = texto;
  }
  return Object.keys(saida).length ? saida : null;
}

/**
 * O balde que VEIO DO ARQUIVO: mesmo dono, mesmo leitor, outra direção.
 *
 * OS TRÊS CASOS, e a diferença entre eles é o que protege o aparelho de destino:
 *   · `falou: false`  — o campo não existe (arquivo v1/v2) ou é texto em branco.
 *     A tela mantém o que tem e o recado diz isso em voz alta;
 *   · `falou: true, ilegivel: true` — existe mas este Atlas não o entende: JSON
 *     quebrado, forma que não é objeto, ou um `versao` que o módulo dono não lê.
 *     Aqui a tela também mantém o que tem — apagar o estudo ou os cartões de um
 *     aparelho por causa de um campo que ele não sabe ler é a perda de dados com
 *     passos a mais;
 *   · `falou: true, ilegivel: false` — o arquivo falou, e a palavra dele vale
 *     (mesma regra da viagem: importar é TROCAR, não somar). O `texto` sai pelo
 *     serializador dono, então a tela pode gravá-lo no storage sem remixar nada e
 *     «exportar → importar → exportar» dá os mesmos bytes.
 *
 * @returns {{falou: boolean, ilegivel?: boolean, texto?: string, quantidade?: number}}
 */
function baldeDoArquivo(bruto, ler, serializar) {
  if (bruto === undefined) return { falou: false };
  if (typeof bruto === 'string' && !bruto.trim()) return { falou: false };

  let dado = bruto;
  if (typeof bruto === 'string') {
    try {
      dado = JSON.parse(bruto);
    } catch {
      return { falou: true, ilegivel: true };
    }
  }
  if (!dado || typeof dado !== 'object' || Array.isArray(dado)) {
    return { falou: true, ilegivel: true };
  }

  const lido = ler(typeof bruto === 'string' ? bruto : JSON.stringify(dado));
  // O leitor dono devolve SEMPRE a versão que ele sabe ler. Se o arquivo dizia
  // outra, o que ele descreve é um dado que este Atlas não conhece — e conhecê-lo
  // como «vazio» apagaria o aparelho. Não é versão antiga: é versão desconhecida,
  // e o caso existe de propósito (atlas.estudo.v2 no arquivo de amanhã).
  if (dado.versao !== undefined && dado.versao !== lido.versao) {
    return { falou: true, ilegivel: true };
  }
  const texto = serializar(lido);
  return { falou: true, ilegivel: false, texto, quantidade: Object.keys(lido.aulas || lido.cartoes || {}).length };
}

/** Os rascunhos que vieram do arquivo: um por um, mesmo triage. */
function rascunhosDoArquivo(brutos) {
  if (brutos === undefined) return { falou: false };
  if (!brutos || typeof brutos !== 'object' || Array.isArray(brutos)) {
    return { falou: true, ilegivel: true };
  }
  const saida = {};
  let ilegivel = false;
  for (const [chave, bruto] of Object.entries(brutos)) {
    // Chave que não é do formato não entra: o arquivo não é um despejo de
    // storage, e gravar uma chave estranha no aparelho seria inventar formato.
    if (typeof chave !== 'string' || !chave.startsWith(RASCUNHO_PREFIXO)) {
      ilegivel = true;
      continue;
    }
    const b = baldeDoArquivo(bruto, lerRascunho, serializarRascunho);
    if (b.ilegivel) {
      ilegivel = true;
      continue;
    }
    if (b.texto) saida[chave] = b.texto;
  }
  return { falou: true, ilegivel: Object.keys(saida).length === 0 && ilegivel, rascunhos: saida };
}

/**
 * Monta o pacote a exportar. Puro: devolve objeto, nao texto nem arquivo.
 * @param {Array<{id: string}>} courses catalogo atual (fonte dos ids validos)
 * @param {string[]} completed progresso do aluno
 * @param {Date} [agora] injetavel para o nome do arquivo ser testavel
 * @param {Record<string,string>} [notas] anotacoes por id (core/notes.js)
 * @param {{electives?: Array, specializations?: Array, revisoes?: object,
 *          estudo?: string, cartoes?: string, rascunhos?: Record<string,string>,
 *          dominadas?: object}} [extras] o resto do estado da pessoa
 */
export function buildExport(courses, completed = [], agora = new Date(), notas = {}, extras = {}) {
  // As revisões vêm DENTRO de `extras` ("o resto do estado"), não como 6º
  // argumento posicional: chamar buildExport(c, c2, d, notas, extras, revisoes)
  // com um argumento a menos já foi possível, e o calendário da pessoa sumiria do
  // arquivo em silêncio. `extras` já é o balde de electives/specializations.
  const revisoes = extras && extras.revisoes ? extras.revisoes : {};
  const catalogo = idsDoCatalogo(courses);
  const brutos = Array.isArray(completed) ? completed : [];
  const { completed: validos, descartados } = filtrar(brutos, catalogo);

  // Anotacao de id que NAO existe em catalogo nenhum fica de fora do arquivo e e
  // CONTADA: mesmo criterio do progresso. Levar lixo seria o arquivo crescer com
  // id de catalogo antigo sem que ninguem soubesse de onde veio.
  const catalogoCompleto = listaCatalogo({ courses, ...extras });
  const { anotacoes, ignorados: anotacoesIgnoradas, descartados: anotacoesDescartadas } =
    anotacoesDoArquivo(notas, catalogoCompleto);
  // Uma chamada só por export: três leituras do mesmo mapa e a receita para as
  // três contagens discordarem se um dia sanitizar ganhar estado.
  // `sanitizar` quer IDS (string[]), não os objetos do catálogo: passar a lista
  // de objetos faria `catalogoIds` cair no ramo "não é array de strings" e o
  // export levaria id de catálogo morto sem contar nenhum.
  const revisaoLimpa = revisoesDoArquivo(revisoes, idsDoCatalogo(catalogoCompleto));

  // S20b-1b: os três baldes que a viagem não era. Vêm como TEXTO CRU do storage,
  // por `extras`, porque o lado da tela é quem conhece o localStorage — o núcleo
  // continua puro e não toca em `window`.
  const estudoTexto = baldeCanonico(extras?.estudo, lerEstudo, serializarEstudo);
  const cartoesTexto = baldeCanonico(extras?.cartoes, lerCartoes, serializarCartoes);
  const rascunhosArquivo = rascunhosParaArquivo(extras?.rascunhos);
  // O carimbo do desafio: a malha é `lerProgresso`, e ele só sai daqui quando há
  // dominada de verdade — um `{}` no arquivo significaria «apaga o carimbo do
  // outro aparelho», que é justamente o que a versão 2 fazia ao não levá-lo.
  const dominadasArquivo = Object.keys(lerProgresso({ dominadas: extras?.dominadas }).dominadas).length
    ? lerProgresso({ dominadas: extras?.dominadas }).dominadas
    : null;

  const pacote = {
    formato: FORMATO,
    versao: VERSAO_FORMATO,
    exportadoEm: agora instanceof Date ? agora.toISOString() : new Date().toISOString(),
    app: 'Projeto Atlas — Ciência da Computação (UBL)',
    catalogo: { total: catalogo.length },
    completed: validos,
    // O que ficou de fora vai DENTRO do arquivo: quem importar daqui a um ano
    // com outro catalogo consegue ver o que este export descartou e por que.
    ignorados: descartados.length,
    descartados,
    anotacoes,
    anotacoesIgnoradas,
    descartadas: anotacoesDescartadas,
    // S8 (01/11/2026): o calendário de revisão é dado da pessoa, e sem ele ela
    // troca de aparelho e recomeça a esperação do zero. `sanitizar` corta id de
    // fora do catálogo — mesmo critério da anotação, pelo catálogo COMPLETO.
    revisoes: revisaoLimpa.revisoes,
    revisoesIgnoradas: revisaoLimpa.ignorados,
    revisoesDescartadas: revisaoLimpa.descartados,
    // S20b-1b: o centro do produto. A versão 2 parava na viagem, e quem trocasse
    // de aparelho levava os 35 carimbos perdendo cada aula aberta, cada aula
    // estudada, cada cartão escrito e cada rascunho pela metade. Os campos abaixo
    // só ENTRAM no arquivo quando o balde falou (ver `baldeCanonico`): um `{}`
    // lido como «não há nenhum» apagaria o que o aparelho de destino tem, que é
    // o bug que a S8 deixou no caminho com as revisões.
    // `dominadas` é o carimbo do desafio (S18b-2), e a versão 2 também não o
    // levava: a viagem voltava e a caderneta ficava muda.
    ...(estudoTexto !== null ? { estudo: estudoTexto } : {}),
    ...(cartoesTexto !== null ? { cartoes: cartoesTexto } : {}),
    ...(rascunhosArquivo !== null ? { rascunhos: rascunhosArquivo } : {}),
    ...(dominadasArquivo !== null ? { dominadas: dominadasArquivo } : {})
  };
  return pacote;
}

/** Texto do arquivo de exportacao (JSON indentado, com quebra final). */
export function serializeExport(courses, completed = [], agora = new Date(), notas = {}, extras = {}) {
  return JSON.stringify(buildExport(courses, completed, agora, notas, extras), null, 2) + '\n';
}

/**
 * Nome do arquivo: `atlas-progresso-AAAA-MM-DD.json`.
 * A data vem do argumento (nao de Date.now() escondido) para ser testavel.
 * @param {Date} [agora]
 */
export function nomeDoArquivo(agora = new Date()) {
  const d = agora instanceof Date && !Number.isNaN(agora.getTime()) ? agora : new Date();
  // toISOString() e UTC; para o nome do arquivo isso basta (e e deterministico).
  return `atlas-progresso-${d.toISOString().slice(0, 10)}.json`;
}

/**
 * Le o texto de um arquivo importado e devolve o progresso E as anotacoes dele.
 *
 * Aceita TRES formas, de proposito:
 *   - envelope versao 2 ({formato, versao, completed, notas});
 *   - envelope versao 1 (sem `notas`): importa limpo. E o arquivo de quem
 *     exportou antes de a anotacao existir — recusar seria punir o aluno por
 *     ter usado uma versao anterior do proprio Atlas;
 *   - o array cru de ids, que e o que o localStorage guarda. Quem abriu o
 *     DevTools e salvou o conteudo a mao nao pode ser punido por isso.
 *
 * @param {unknown} texto
 * @param {Array<{id: string}>} courses
 * @param {{electives?: Array, specializations?: Array}} [extras] resto do catalogo
 * @returns {{ok: true, completed: string[], ignorados: number, notas: Record<string,string>,
 *            notasIgnoradas: number, versao: number, mensagem: string}
 *          | {ok: false, erro: string}}
 */
export function parseImport(texto, courses = [], extras = {}) {
  if (typeof texto !== 'string') {
    return { ok: false, erro: 'O arquivo precisa ser texto. Não consegui ler o que chegou.' };
  }
  if (texto.trim() === '') {
    return { ok: false, erro: 'Arquivo vazio: sem conteúdo para importar.' };
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    return { ok: false, erro: `Não consegui ler o arquivo como JSON (${e.message}).` };
  }

  let idsCandidatos;
  // Versao do arquivo que chegou. Fica na versao atual quando o que chegou e o
  // array cru do storage: aquilo nao e "versao antiga", e conteudo guardado a
  // mao — e falar de versao ali seria inventar proveniencia que o dado nao tem.
  let versaoDoArquivo = VERSAO_FORMATO;
  let notasCandidatas = {};
  let trouxeAnotacoes = false;
  let anotacoesIlegiveis = false;
  // S8: as revisões têm o MESMO tratamento das anotações — `undefined` quando o
  // arquivo não fala delas (a tela mantém o que o aparelho tem), `ilegivel`
  // quando fala e não dá para ler (descarta e DIZ). Um `{}` aqui apagaria o
  // calendário da pessoa com um arquivo velho.
  let revisoesBrutas;
  let trouxeRevisoes = false;
  let revisoesIlegiveis = false;
  // S20b-1b: os baldes da versão 3. `falou: false` é o estado inicial de todos —
  // um arquivo de array cru ou de versão 2 não fala deles, e a tela mantém o que
  // o aparelho tem. Nunca `{}` como sinal de «não sei».
  let baldeEstudo = { falou: false };
  let baldeCartoes = { falou: false };
  let baldeRascunhos = { falou: false };
  // As dominadas do arquivo, já pela malha de `lerProgresso`, ou `null` quando o
  // arquivo não falou delas / falou ilegível. `trouxeDominadas` separa «o arquivo
  // diz que não há dominada nenhuma» (objeto vazio legível) de «não falou».
  let dominadasDoArquivo = null;
  let trouxeDominadas = false;
  if (Array.isArray(dados)) {
    idsCandidatos = dados;
  } else if (dados && typeof dados === 'object') {
    if (dados.formato !== FORMATO) {
      return {
        ok: false,
        erro: `Formato "${dados.formato ?? '(sem formato)'}" não é do Projeto Atlas. Esperado "${FORMATO}".`
      };
    }
    const versao = dados.versao;
    if (typeof versao !== 'number') {
      return {
        ok: false,
        erro: 'O arquivo não diz a versão do formato. Sem isso eu teria de adivinhar o que ele contem — e adivinhar formato e como se perde progresso.'
      };
    }
    if (versao > VERSAO_FORMATO) {
      return {
        ok: false,
        erro: `Este arquivo é da versão ${versao}; este Atlas entende até a versão ${VERSAO_FORMATO}. Atualize o app para importa-lo.`
      };
    }
    if (versao < VERSAO_MINIMA) {
      return {
        ok: false,
        erro: `Este arquivo é da versão ${versao}; este Atlas lê da versão ${VERSAO_MINIMA} em diante.`
      };
    }
    if (!Array.isArray(dados.completed)) {
      return { ok: false, erro: 'O campo completed precisa ser uma lista de ids de disciplina.' };
    }
    versaoDoArquivo = versao;
    idsCandidatos = dados.completed;
    // Campo de anotacoes QUEBRADO NAO recusa o arquivo. O progresso e o que o
    // aluno tem de mais caro ali; puni-lo por uma anotacao ilegivel seria
    // trocar dado valioso por dado descartavel. Descarta-se a anotacao e DIZ na
    // mensagem — nunca em silencio.
    if (dados.anotacoes !== undefined) {
      if (dados.anotacoes && typeof dados.anotacoes === 'object' && !Array.isArray(dados.anotacoes)) {
        notasCandidatas = dados.anotacoes;
        trouxeAnotacoes = true;
      } else if (typeof dados.anotacoes === 'string') {
        notasCandidatas = parseNotas(dados.anotacoes);
        trouxeAnotacoes = Object.keys(notasCandidatas).length > 0;
        if (!trouxeAnotacoes) anotacoesIlegiveis = true;
      } else {
        anotacoesIlegiveis = true;
      }
    }
    // Campo `revisoes`: opcional, e um arquivo sem ele é lido normalmente (é o
    // arquivo de ontem, e o Atlas de ontem não sabia de revisão). String vira
    // texto a parsear, como a anotação: sanitizar cuida dos dois formatos.
    if (dados.revisoes !== undefined) {
      trouxeRevisoes = true;
      revisoesBrutas = dados.revisoes;
      if (typeof dados.revisoes === 'string' && !/^\s*$/.test(dados.revisoes)) {
        try {
          revisoesBrutas = JSON.parse(dados.revisoes);
        } catch {
          revisoesIlegiveis = true;
          revisoesBrutas = undefined;
        }
      }
    }
    // S20b-1b: os três baldes. A triage é a das revisões, com uma diferença
    // deliberada: aqui a ilegibilidade NÃO vira `{}` — vira `falou: false` com
    // aviso, porque um `{}` de cartões gravado no storage apaga a fila inteira da
    // pessoa por causa de um campo que ele não sabe ler.
    baldeEstudo = baldeDoArquivo(dados.estudo, lerEstudo, serializarEstudo);
    baldeCartoes = baldeDoArquivo(dados.cartoes, lerCartoes, serializarCartoes);
    baldeRascunhos = rascunhosDoArquivo(dados.rascunhos);
    // `dominadas` não é texto de storage, é objeto do progresso, e a malha dele é
    // a de `lerProgresso` — a mesma que o storage usa. Um objeto ilegível (lista,
    // texto) mantém as dominadas do aparelho, como os baldes acima.
    if (dados.dominadas !== undefined) {
      const d = dados.dominadas;
      dominadasDoArquivo = d && typeof d === 'object' && !Array.isArray(d)
        ? lerProgresso({ dominadas: d }).dominadas
        : null;
      trouxeDominadas = d && typeof d === 'object' && !Array.isArray(d);
    }
  } else {
    return { ok: false, erro: 'O arquivo não contém nem o envelope do Atlas nem uma lista de ids.' };
  }

  const catalogo = idsDoCatalogo(courses);
  const { completed, ignorados, descartados } = filtrar(idsCandidatos, catalogo);

  // Anotacao: validada pela MESMA malha do export (corte, vazio apaga, ordem do
  // catalogo) e pelo catalogo COMPLETO — nao so pela grade. Filtrar so pela
  // grade descartaria a anotacao da eletiva e da especializacao, e aquilo e
  // dado do aluno, nao lixo.
  const catalogoCompleto = listaCatalogo({ courses, ...extras });
  const { anotacoes, ignorados: anotacoesIgnoradas, descartados: anotacoesDescartadas } =
    anotacoesDoArquivo(notasCandidatas, catalogoCompleto);

  // Revisões: id que não está no catálogo fica de fora e é CONTADO (mesma regra
  // da anotação). `revisoes` do resultado é `null` quando o arquivo não falou
  // delas ou quando falou ilegível — nunca `{}`, que a tela leria como "apaga o
  // calendário deste aparelho".
  const revisaoArquivo = trouxeRevisoes && !revisoesIlegiveis
    ? revisoesDoArquivo(revisoesBrutas, idsDoCatalogo(catalogoCompleto))
    : null;

  // PORTUGUES QUE O ALUNO LE (licao de 28/10/2026): "(s)" e atalho de quem nao
  // quis escolher a forma, e esta frase aparece na tela dele. O numero e
  // conhecido aqui, entao a forma e escolhida.
  let mensagem = completed.length === 0
    ? 'Nenhuma disciplina deste catálogo estava no arquivo: o progresso ficou vazio.'
    : `Importadas ${completed.length} ${completed.length === 1 ? 'disciplina' : 'disciplinas'} deste catálogo.`;
  if (ignorados > 0) {
    const nomes = descartados.slice(0, 5).join(', ');
    mensagem += ` ${ignorados} ${ignorados === 1 ? 'id ignorado' : 'ids ignorados'} por não pertencer a este catálogo${nomes ? `: ${nomes}` : ''}.`;
  }
  const comAnotacoes = Object.keys(anotacoes).length;
  if (comAnotacoes > 0) {
    mensagem += ` ${comAnotacoes} ${comAnotacoes === 1 ? 'anotação veio' : 'anotações vieram'} junto.`;
  }
  if (anotacoesIlegiveis) {
    mensagem += ' O campo de anotações do arquivo estava ilegível: descartei as anotações dele e mantive o progresso.';
  } else if (!trouxeAnotacoes) {
    // Arquivo que NAO FALA de anotacoes (versao 1 ou array cru): dizer em voz
    // alta que as anotacoes do aparelho ficam intactas. Calar aqui e o aluno
    // ver as notas na tela e nao saber se foi sorte ou regra.
    mensagem += ' O arquivo não traz anotações: as anotações deste aparelho continuam como estavam.';
  }
  if (anotacoesIgnoradas > 0) {
    const nomes = anotacoesDescartadas.slice(0, 5).join(', ');
    mensagem += ` ${anotacoesIgnoradas} ${anotacoesIgnoradas === 1 ? 'anotação ignorada' : 'anotações ignoradas'} por id que não está neste catálogo${nomes ? `: ${nomes}` : ''}.`;
  }
  // As revisões falam por si na mesma voz: quantas entraram, o que foi descartado,
  // e o que acontece com as deste aparelho quando o arquivo não fala delas.
  const revisoesEntraram = revisaoArquivo ? Object.keys(revisaoArquivo.revisoes).length : 0;
  if (revisoesEntraram > 0) {
    mensagem += ` ${revisoesEntraram} ${revisoesEntraram === 1 ? 'revisão veio' : 'revisões vieram'} junto.`;
  }
  if (revisoesIlegiveis) {
    mensagem += ' O campo de revisões do arquivo estava ilegível: descartei as revisões dele e mantive o progresso.';
  } else if (!trouxeRevisoes) {
    mensagem += ' O arquivo não traz revisões: as revisões deste aparelho continuam como estavam.';
  } else if (revisoesEntraram === 0 && !revisoesIlegiveis) {
    mensagem += ' O arquivo traz o campo de revisões, mas nenhuma delas está neste catálogo.';
  }
  if (revisaoArquivo && revisaoArquivo.ignorados > 0) {
    const nomes = revisaoArquivo.descartados.slice(0, 5).join(', ');
    mensagem += ` ${revisaoArquivo.ignorados} ${revisaoArquivo.ignorados === 1 ? 'revisão ignorada' : 'revisões ignoradas'} por id que não está neste catálogo${nomes ? `: ${nomes}` : ''}.`;
  }
  // S20b-1b: os baldes falam na mesma voz das revisões, porque a situação é a
  // mesma e a pessoa não tem como saber qual campo obedece a qual regra. As
  // frases que importam são as de «o arquivo não falou»: quem importa um backup
  // de ontem no aparelho de hoje precisa LER que os cartões daqui continuam aqui,
  // e não descobrir isso pela ausência deles amanhã. Escrever cada balde em vez
  // de uma função genérica é deliberado — «3 estudos» não existe, e o plural
  // automático produziria frase errada na tela da pessoa.
  if (baldeEstudo.ilegivel) {
    mensagem += ' O estudo do arquivo estava ilegível: o estudo deste aparelho continua como estava.';
  } else if (!baldeEstudo.falou) {
    mensagem += ' O arquivo não traz estudo: o estudo deste aparelho continua como estava.';
  } else {
    const n = baldeEstudo.quantidade || 0;
    mensagem += n === 0
      ? ' O arquivo traz o estudo, mas vazio.'
      : ` O arquivo traz o estudo de ${n} ${n === 1 ? 'aula' : 'aulas'}.`;
  }
  if (baldeCartoes.ilegivel) {
    mensagem += ' Os cartões do arquivo estavam ilegíveis: os cartões deste aparelho continuam como estavam.';
  } else if (!baldeCartoes.falou) {
    mensagem += ' O arquivo não traz cartões: os cartões deste aparelho continuam como estavam.';
  } else {
    const n = baldeCartoes.quantidade || 0;
    mensagem += n === 0
      ? ' O arquivo traz os cartões, mas nenhum.'
      : ` ${n} ${n === 1 ? 'cartão veio' : 'cartões vieram'} junto.`;
  }
  if (baldeRascunhos.ilegivel) {
    mensagem += ' Os rascunhos do arquivo estavam ilegíveis: os rascunhos deste aparelho continuam como estavam.';
  } else if (!baldeRascunhos.falou) {
    mensagem += ' O arquivo não traz rascunhos: os rascunhos deste aparelho continuam como estavam.';
  } else {
    const n = baldeRascunhos.rascunhos ? Object.keys(baldeRascunhos.rascunhos).length : 0;
    mensagem += n === 0
      ? ' O arquivo traz os rascunhos, mas nenhum.'
      : ` ${n} ${n === 1 ? 'rascunho veio' : 'rascunhos vieram'} junto.`;
  }
  if (trouxeDominadas && dominadasDoArquivo) {
    const n = Object.keys(dominadasDoArquivo).length;
    if (n > 0) mensagem += ` ${n} ${n === 1 ? 'estação dominada veio' : 'estações dominadas vieram'} junto.`;
  } else {
    mensagem += ' O arquivo não traz estações dominadas: as deste aparelho continuam como estavam.';
  }

  return {
    ok: true,
    completed,
    ignorados,
    anotacoes,
    anotacoesIgnoradas,
    trazAnotacoes: trouxeAnotacoes,
    // `revisoes: null` é o sinal de "este arquivo não falou delas" — quem aplica
    // ao estado mantém o calendário do aparelho. Sem null, o `{}` do sanitizar
    // viraria "não há revisão nenhuma" e apagaria a fila de quem reimporta um
    // backup velho.
    revisoes: revisaoArquivo ? revisaoArquivo.revisoes : null,
    revisoesIgnoradas: revisaoArquivo ? revisaoArquivo.ignorados : 0,
    trazRevisoes: trouxeRevisoes && !revisoesIlegiveis,
    // S20b-1b. Cada balde devolve TEXTO PRONTO PARA O STORAGE, já pelo
    // serializador dono, ou `null` quando o arquivo não falou dele (ou falou sem
    // que este Atlas entendesse). `null` é o sinal de «mantém o que o aparelho
    // tem»: é a única razão pela qual importar um backup de ontem não apaga os
    // cartões de hoje. Quem quiser saber se foi regra ou sorte lê `traz*`.
    estudo: baldeEstudo.falou && !baldeEstudo.ilegivel ? baldeEstudo.texto : null,
    trazEstudo: baldeEstudo.falou && !baldeEstudo.ilegivel,
    estudoIlegivel: baldeEstudo.ilegivel === true,
    cartoes: baldeCartoes.falou && !baldeCartoes.ilegivel ? baldeCartoes.texto : null,
    trazCartoes: baldeCartoes.falou && !baldeCartoes.ilegivel,
    cartoesIlegiveis: baldeCartoes.ilegivel === true,
    rascunhos: baldeRascunhos.falou && !baldeRascunhos.ilegivel ? baldeRascunhos.rascunhos : null,
    trazRascunhos: baldeRascunhos.falou && !baldeRascunhos.ilegivel,
    rascunhosIlegiveis: baldeRascunhos.ilegivel === true,
    dominadas: dominadasDoArquivo,
    trazDominadas: trouxeDominadas,
    versao: versaoDoArquivo,
    mensagem
  };
}
