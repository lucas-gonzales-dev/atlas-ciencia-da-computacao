// Projeto Atlas — as regras dos dados da pessoa (S9, 01/11/2026).
//
// POR QUE EXISTE: exportar, importar, contar carimbo e julgar marco é regra, e
// regra mora no core (regra da casa). Até hoje o exportar/importar desenhava em
// main.js e a regra validava em progress-io.js — dois lugares, e a tela nova
// precisaria de uma cópia. Este módulo é a casa única: recebe estado, devolve
// arquivo; recebe arquivo, devolve estado. Zero DOM, zero storage: quem guarda é
// a tela.
//
// A REGRA QUE O TEMPO ENSINOU (31/10): `null` em parseImport significa "este
// arquivo não falou de revisões" — apagar a fila de quem reimporta um backup
// velho foi o bug de perda de dados que a S8 deixou no caminho. exportarViagem e
// importarViagem preservam o sinal até a tela.
import { nomeDoArquivo, parseImport, serializeExport } from './progress-io.js';
import { ESTACOES_POR_LINHA, TOTAL_ESTACOES, resumoDaViagem } from './viagem.js';
import { perfil as T } from './textos.js';

/** Os dois estados de um marco — forma E texto, nunca só cor (JORNADA 3.1). */
export const STATUS = Object.freeze({
  CONQUISTADO: 'conquistado',
  EM_ANDAMENTO: 'em_andamento'
});

/**
 * Quantas revisões a pessoa FEZ (não quantas estão agendadas). O número da tela
 * é esforço realizado; contar a agenda seria cobrar o futuro como passado.
 */
export function revisoesFeitas(calendario) {
  if (!calendario || typeof calendario !== 'object') return 0;
  let feitas = 0;
  for (const entrada of Object.values(calendario)) {
    if (Array.isArray(entrada?.historico)) feitas += entrada.historico.length;
  }
  return feitas;
}

/**
 * As respostas que os CARTÕES do aparelho guardam (S17b-fix, item 3).
 *
 * POR QUE EXISTE: `estado.revisoes` é o calendário do sistema antigo. Desde que a
 * revisão passou a viver em `core/cartoes.js`, com o `historico` de cada cartão,
 * o número da tela dizia «0» para quem tinha respondido sete cartões — a régua
 * apontava para um balde que ninguém mais enche. Este módulo soma as entradas de
 * `historico`, que é o que de fato aconteceu.
 *
 * A CONTA É SOMA, e não «um no lugar do outro»: um aparelho que ainda tem o
 * calendário velho (uma viagem importada de um backup antigo) tem respostas nos
 * dois baldes, e nenhuma delas deixa de ter acontecido por causa de um formato.
 * São baldes separados por construção — `progress-io.js` escreve um e
 * `serializarCartoes` o outro — e não há como o mesmo gesto cair nos dois.
 *
 * Aceita as duas formas do balde (o arquivo `{ cartoes: {...} }` e o mapa puro),
 * a mesma conta de `core/caderneta.js`: a tela não precisa saber qual das duas
 * carregou. Zero DOM, zero storage.
 */
export function revisoesDosCartoes(cartoes) {
  const mapa = cartoes && cartoes.cartoes && typeof cartoes.cartoes === 'object'
    ? cartoes.cartoes
    : (cartoes && typeof cartoes === 'object' ? cartoes : {});
  let feitas = 0;
  for (const c of Object.values(mapa)) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    if (Array.isArray(c.historico)) feitas += c.historico.length;
  }
  return feitas;
}

/**
 * O número da placa «Revisões feitas»: calendário antigo + histórico dos cartões.
 * Uma função só para a tela chamar uma vez, em vez de somar na folha.
 */
export function revisoesRealizadas(calendario, cartoes) {
  return revisoesFeitas(calendario) + revisoesDosCartoes(cartoes);
}

/**
 * Os quatro marcos, com nome, critério e estado. Sem progresso, devolvem a
 * promessa ("em andamento", conta em zero): o marco em branco é honesto.
 */
export function marcosDoPerfil(courses = [], progresso = []) {
  const r = resumoDaViagem(progresso, courses);
  const totalLinhas = r.linhas.length || 7;
  const feitos = r.concluidas;

  const estacao = {
    tipo: 'estacao',
    nome: T.marcos.nomes.estacao,
    criterio: T.marcos.criterios.estacao,
    estado: feitos > 0 ? STATUS.CONQUISTADO : STATUS.EM_ANDAMENTO,
    data: feitos > 0 ? r.datasDeViagem[0] || null : null,
    conta: `${feitos}/${r.estacoes}`
  };
  const baldeacao = {
    tipo: 'primeira_baldeacao',
    nome: T.marcos.nomes.primeira_baldeacao,
    criterio: T.marcos.criterios.primeira_baldeacao,
    estado: r.baldeacoesFeitas > 0 ? STATUS.CONQUISTADO : STATUS.EM_ANDAMENTO,
    data: r.baldeacoesFeitas > 0 ? r.datasDeViagem[0] || null : null,
    conta: `${r.baldeacoesFeitas}`
  };
  const fechouLinha = r.linhasFechadas > 0 && r.linhasFechadas === totalLinhas;
  const fim = {
    tipo: 'fim_da_linha',
    nome: T.marcos.nomes.fim_da_linha,
    criterio: T.marcos.criterios.fim_da_linha(ESTACOES_POR_LINHA),
    estado: fechouLinha ? STATUS.CONQUISTADO : STATUS.EM_ANDAMENTO,
    // Fechou: o dia do último carimbo É o dia da linha fechada. Sem isso, um
    // marco conquistado chegaria na tela sem data nenhuma para carimbar.
    data: fechouLinha ? r.datasDeViagem[r.datasDeViagem.length - 1] || null : null,
    conta: `${r.linhasFechadas} de ${totalLinhas}`
  };
  const terminal = {
    tipo: 'terminal',
    nome: T.marcos.nomes.terminal,
    criterio: T.marcos.criterios.terminal(TOTAL_ESTACOES),
    estado: r.terminal ? STATUS.CONQUISTADO : STATUS.EM_ANDAMENTO,
    data: r.terminal ? r.datasDeViagem[r.datasDeViagem.length - 1] || null : null,
    conta: `${feitos}/${TOTAL_ESTACOES}`
  };
  return [estacao, baldeacao, fim, terminal];
}

/** O marco de um tipo num estado de viagem dado. */
export function estadoDoMarco(progresso, courses, tipo) {
  return marcosDoPerfil(courses, progresso).find((m) => m.tipo === tipo) || null;
}

/**
 * Gera o arquivo da viagem e, quando o ambiente permite, pede o download.
 * `agora`, `document` e `window` entram por parâmetro para o teste medir a ida
 * e volta sem relógio real nem navegador falso.
 * @returns {{ok:boolean, nome:string, texto:string, mensagem:string}}
 */
export function exportarViagem(estado = {}, opts = {}) {
  const doc = opts.document || (typeof document !== 'undefined' ? document : null);
  const win = opts.window || (typeof window !== 'undefined' ? window : null);
  const agora = opts.agora instanceof Date ? opts.agora : new Date();

  const courses = Array.isArray(estado.courses) ? estado.courses : [];
  const completed = Array.isArray(estado.completed) ? estado.completed : [];
  const anotacoes = estado.anotacoes && typeof estado.anotacoes === 'object' ? estado.anotacoes : {};
  const revisoes = estado.revisoes && typeof estado.revisoes === 'object' ? estado.revisoes : {};

  const texto = serializeExport(courses, completed, agora, anotacoes, {
    electives: estado.electives,
    specializations: estado.specializations,
    revisoes,
    // S20b-1b: o centro do produto no arquivo. Quem lê o storage é a tela — o
    // núcleo continua sem tocar em `window` — e ela coloca os textos crus em
    // `estado`. `progress-io` decide a forma canônica e se o campo entra.
    estudo: estado.estudo,
    cartoes: estado.cartoes,
    rascunhos: estado.rascunhos,
    dominadas: estado.dominadas,
    // S20b-8: o dia de cada conclusão e o que está em curso. Vão pelos mesmos
    // `extras` das dominadas; quem decide se a chave entra no arquivo é o
    // progress-io, e a tela só entrega o objeto que `carregarViagem` remontou.
    conclusoes: estado.conclusoes,
    emCurso: estado.emCurso
  });
  const nome = nomeDoArquivo(agora);

  const feito = baixarArquivo({
    doc,
    win,
    nome,
    texto,
    tipo: 'application/json'
  });
  return {
    ok: feito,
    nome,
    texto,
    mensagem: feito ? T.dados.exportado(nome) : T.dados.semDownload
  };
}

/**
 * O caminho de DOWNLOAD de um texto gerado aqui (S19b: extraído de
 * `exportarViagem`, que era o único dono dele).
 *
 * POR QUE EXISTE SEPARADO: o `.ics` da próxima sessão é a segunda coisa que o
 * Atlas baixa, e copiar o Blob/createObjectURL/click/revoke faria dois lugares
 * decidindo como um arquivo sai do navegador. A primeira cópia divergiria da
 * segunda no único detalhe que ninguém testa sozinho — o `revokeObjectURL`, que
 * vaza memória se ficar de fora, ou o `append` no body, sem o qual o Safari não
 * clicka nada.
 *
 * Devolve `true`/`false` e nenhuma mensagem: a frase de "não deu" é do bloco de
 * textos de quem chama (`perfil.dados.semDownload` aqui, `agenda.semDownload`
 * lá), porque o que falhou é o mesmo e o que se diz depende da tela.
 *
 * @returns {boolean} false quando o ambiente não tem Blob nem URL — a mesma
 *   recusa silenciosa de antes, nunca um estouro.
 */
export function baixarArquivo({ doc, win, nome, texto, tipo = 'application/octet-stream' } = {}) {
  const Blob = win?.Blob;
  const url = win?.URL;
  if (typeof Blob !== 'function' || !doc || typeof url?.createObjectURL !== 'function') {
    return false;
  }

  const alvo = url.createObjectURL(new Blob([texto], { type: tipo }));
  const a = doc.createElement('a');
  a.href = alvo;
  a.download = nome;
  doc.body?.append?.(a);
  a.click?.();
  a.remove?.();
  url.revokeObjectURL(alvo);
  return true;
}

/**
 * Lê o texto de um arquivo e devolve o NOVO estado por cima do antigo — sem
 * muta-lo. Arquivo que não fala de anotações ou revisões não apaga as que já
 * existem: `null`/`traz… false` é "não falou", nunca "não há".
 */
export function importarViagem(texto, estado = {}) {
  const courses = Array.isArray(estado.courses) ? estado.courses : [];
  const r = parseImport(texto, courses, {
    electives: estado.electives,
    specializations: estado.specializations
  });

  const anotacoesAnteriores = estado.anotacoes && typeof estado.anotacoes === 'object' ? estado.anotacoes : {};
  const revisoesAnteriores = estado.revisoes && typeof estado.revisoes === 'object' ? estado.revisoes : {};
  // S20b-8: o que ESTE aparelho sabe sobre datas e intenção. Ler do estado, nunca
  // do storage: o núcleo não toca em `window` (regra da casa), e a tela já montou
  // o progresso por `carregarViagem`.
  const conclusoesAnteriores = estado.conclusoes && typeof estado.conclusoes === 'object' && !Array.isArray(estado.conclusoes)
    ? estado.conclusoes
    : {};
  const emCursoAnteriores = Array.isArray(estado.emCurso) ? estado.emCurso : [];

  if (!r.ok) {
    return {
      ok: false,
      erro: r.erro,
      completed: [...(Array.isArray(estado.completed) ? estado.completed : [])],
      anotacoes: { ...anotacoesAnteriores },
      revisoes: { ...revisoesAnteriores },
      mensagem: `${r.erro} ${T.dados.recusaPorque} ${T.dados.recusaOQueFazer}`
    };
  }

  return {
    ok: true,
    completed: r.completed,
    ignorados: r.ignorados,
    anotacoes: r.trazAnotacoes ? { ...r.anotacoes } : { ...anotacoesAnteriores },
    trazAnotacoes: Boolean(r.trazAnotacoes),
    revisoes: r.revisoes !== null && r.revisoes !== undefined ? { ...r.revisoes } : { ...revisoesAnteriores },
    trazRevisoes: Boolean(r.trazRevisoes),
    // S20b-1b: os baldes passam atravessados, com o MESMO contrato das revisões —
    // `null` e `traz… false` significam «o arquivo não falou», e é a tela quem
    // decide não gravar nada em cima. Copiar o texto já canonicizado é o que faz
    // o round-trip ser byte a byte: este módulo não remixata study nem cartões.
    estudo: typeof r.estudo === 'string' ? r.estudo : null,
    trazEstudo: Boolean(r.trazEstudo),
    cartoes: typeof r.cartoes === 'string' ? r.cartoes : null,
    trazCartoes: Boolean(r.trazCartoes),
    rascunhos: r.rascunhos && typeof r.rascunhos === 'object' ? { ...r.rascunhos } : null,
    trazRascunhos: Boolean(r.trazRascunhos),
    dominadas: r.dominadas && typeof r.dominadas === 'object' ? { ...r.dominadas } : null,
    trazDominadas: Boolean(r.trazDominadas),
    // S20b-8: o dia de cada conclusão e o que estava em curso. Aqui a regra é a do
    // cabeçalho desta função — «arquivo que não fala de um campo não apaga o que já
    // existe» — e não a das `dominadas`, que devolvem `null` e deixam a tela decidir:
    // `conclusoes` e `emCurso` são da VIAGEM, e quem os escreve é o `salvarViagem`
    // abaixo, que só roda quando algum dos três falou. Devolver o do aparelho quando
    // o arquivo ficou calado é o que faz a trava «importar backup velho não rebaixa
    // ninguém» valer sem depender de a tela lembrar do ternário. Cópia rasa: o
    // progress-io já saneou campo a campo, e remixar aqui seria segunda regra.
    conclusoes: r.trazConclusoes ? { ...r.conclusoes } : { ...(conclusoesAnteriores) },
    trazConclusoes: Boolean(r.trazConclusoes),
    emCurso: r.trazEmCurso ? [...r.emCurso] : [...emCursoAnteriores],
    trazEmCurso: Boolean(r.trazEmCurso),
    versao: r.versao,
    mensagem: `${r.mensagem} ${T.dados.importadoGuarda}`
  };
}
