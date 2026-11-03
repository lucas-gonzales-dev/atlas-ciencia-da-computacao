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
    revisoes
  });
  const nome = nomeDoArquivo(agora);

  const Blob = win?.Blob;
  const url = win?.URL;
  if (typeof Blob !== 'function' || !doc || typeof url?.createObjectURL !== 'function') {
    return { ok: false, nome, texto, mensagem: T.dados.semDownload };
  }

  const alvo = url.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = doc.createElement('a');
  a.href = alvo;
  a.download = nome;
  doc.body?.append?.(a);
  a.click?.();
  a.remove?.();
  url.revokeObjectURL(alvo);
  return { ok: true, nome, texto, mensagem: T.dados.exportado(nome) };
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
    versao: r.versao,
    mensagem: `${r.mensagem} ${T.dados.importadoGuarda}`
  };
}
