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
// A REGRA DA VERSAO, e por que ela e a parte mais importante deste arquivo:
// subir a versao e facil; o que nao pode acontecer e o aluno que ainda esta no
// Atlas de ontem abrir o arquivo de hoje e perder tudo. Por isso:
//   - quem EXPORTA escreve a versao atual (2), sempre;
//   - quem IMPORTA aceita 1 E 2, e um arquivo sem `notas` (versao 1) importa
//     limpo, com recado de que as anotacoes daquele aparelho ficam intactas;
//   - versao ACIMA da que este Atlas entende e recusada dizendo ate onde ele
//     vai — nunca lida como se fosse igual, porque "igual" ali e chute.

/** Nome do formato. Vai dentro do arquivo exportado. */
export const FORMATO = 'atlas.progresso';

/** Versao do formato. Bump obrigatoria se o envelope mudar de forma. */
export const VERSAO_FORMATO = 2;

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
 * Monta o pacote a exportar. Puro: devolve objeto, nao texto nem arquivo.
 * @param {Array<{id: string}>} courses catalogo atual (fonte dos ids validos)
 * @param {string[]} completed progresso do aluno
 * @param {Date} [agora] injetavel para o nome do arquivo ser testavel
 * @param {Record<string,string>} [notas] anotacoes por id (core/notes.js)
 * @param {{electives?: Array, specializations?: Array}} [extras] resto do catalogo
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

  return {
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
    revisoesDescartadas: revisaoLimpa.descartados
  };
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
    versao: versaoDoArquivo,
    mensagem
  };
}
