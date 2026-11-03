// Projeto Atlas — a tela PERFIL: o bilhete, os marcos e os dados da pessoa (S9).
//
// POR QUE EXISTE: o Perfil é portfólio, não placar. Cada marca aqui é um fato
// que a pessoa produziu: a data de uma conclusão, uma linha inteira fechada, o
// arquivo que ela mesma exportou. O protótipo desenhava XP, ritmo de dias e
// troféu; o Atlas desenha o bilhete e a conta do que falta.
//
// REGRA DA CASA: nenhuma regra nesta folha. As 35 casas, quantas linhas
// fecharam e em que dia cada estação terminou vêm de core/viagem.js
// (resumoDaViagem); o juízo de cada marco e o envelope de exportar/importar
// moram em core/dados-pessoa.js. Aqui só há DOM: montar, pintar, ouvir. Se
// aparecer uma soma de dias ou um `if` de calendário, está no lugar errado.
//
// NADA DE RELÓGIO PRÓPRIO: toda data sai por dataDeCalendario, formatando a
// string — nunca `new Date(iso)`, que em fuso negativo devolve o dia anterior e
// o bilhete mentiria (lição da 2d-2). `hoje` vem do ctx quando o aparelho não
// tem o dia registrado; sem ctx, é o dia local do núcleo, uma vez só.
import {
  exportarViagem,
  importarViagem,
  marcosDoPerfil,
  revisoesFeitas,
} from '../../core/dados-pessoa.js';
import { dataDeCalendario, perfil as T } from '../../core/textos.js';
import { hrefDe } from '../../core/rotas.js';
import { dataLocal, resumoDaViagem } from '../../core/viagem.js';
import { STORAGE_KEY, parseRevisoes, serializeRevisoes } from '../../core/revisao.js';
import { carregarViagem } from '../metro.js';

const CLASSE = 'perfil';

function el(doc, classe, texto, tag) {
  const no = doc.createElement(tag || 'div');
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

const placa = (doc, texto) => el(doc, `${CLASSE}-placa`, texto, 'p');
const titulo = (doc, texto, tag) => el(doc, `${CLASSE}-titulo`, texto, tag || 'h2');
const linha = (doc, classe, texto) => el(doc, `${CLASSE}-${classe}`, texto, 'p');

/** O dia que a pessoa lê: o que o núcleo guardou, ou o hoje injetado. */
const dia = (iso, hoje) => dataDeCalendario(iso || hoje);

/** Um dos três cartões. O valor vem sempre de fora, nunca escrito aqui. */
function numero(doc, nome, valor) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-numero`);
  box.append(el(doc, `${CLASSE}-numero-valor`, String(valor), 'p'));
  box.append(placa(doc, nome));
  return box;
}

/**
 * Uma casa do bilhete: o link para a folha daquela estação. O bilhete não é
 * enfeite — clicar num carimbo leva ao que ele foi.
 */
function casa(doc, course, feito, dataConclusao, hoje) {
  const nome = course.title ?? course.id;
  const a = el(doc, `${CLASSE}-casa${feito ? ` ${CLASSE}-casa-carimbada` : ''}`, undefined, 'a');
  // setAttribute, não a propriedade: `a.href = '#/estacao/x'` no navegador vira
  // a URL ABSOLUTA na propriedade, e o atributo é o que a casa lê e o que a
  // rota compara. Quem escreve pela propriedade perde o valor lido do HTML.
  a.setAttribute('href', hrefDe({ tela: 'estacao', slug: course.slug ?? course.id }));
  a.setAttribute('aria-label', feito ? T.casaCarimbada(nome, dia(dataConclusao, hoje)) : T.casaVazia(nome));
  if (Number.isFinite(Number(course.stage))) a.dataset.linha = String(Number(course.stage));
  a.append(el(doc, `${CLASSE}-selo`));
  a.append(el(doc, `${CLASSE}-nome`, nome, 'span'));
  if (feito) a.append(el(doc, `${CLASSE}-data`, dia(dataConclusao, hoje), 'span'));
  return a;
}

/** O bilhete: uma fileira por linha, as casas na ordem do catálogo. */
function bilhete(doc, catalogo, progresso, feitos, conclusoes, hoje) {
  const r = resumoDaViagem(progresso, catalogo.courses || []);
  const box = el(doc, `${CLASSE}-card ${CLASSE}-bilhete`);
  box.append(titulo(doc, T.bilhete));
  const grade = el(doc, `${CLASSE}-grade`);
  for (const linhaR of r.linhas) {
    const fileira = el(doc, `${CLASSE}-bilhete-fileira`);
    fileira.setAttribute('role', 'list');
    for (const c of (catalogo.courses || []).filter((x) => Number(x.stage) === linhaR.linha)) {
      fileira.append(casa(doc, c, feitos.has(c.id), conclusoes[c.id], hoje));
    }
    grade.append(fileira);
  }
  box.append(grade);
  return { box, r };
}

/**
 * Um marco: nome, o critério escrito (não desenhado por só cor) e o estado com
 * a data de quando ou a conta de quanto falta.
 */
function marco(doc, m, hoje) {
  const item = el(doc, `${CLASSE}-marco`);
  item.dataset.estado = m.estado;
  const cab = el(doc, `${CLASSE}-marco-cab`);
  cab.append(el(doc, `${CLASSE}-marco-nome`, m.nome, 'h3'));
  cab.append(el(doc, `${CLASSE}-marco-estado`, T.marcos.estados[m.estado], 'p'));
  item.append(cab);
  item.append(linha(doc, 'marco-criterio', m.criterio));
  item.append(linha(doc, 'marco-conta', m.data ? T.marcos.conquistadoEm(dia(m.data, hoje)) : T.marcos.emAndamento(m.conta)));
  return item;
}

/**
 * Os dados da pessoa: o arquivo sai daqui e volta por aqui. A recusa aparece na
 * tela com as três partes (o quê, por quê, o que fazer) — a regra é do núcleo,
 * esta folha só põe o texto onde o olho está.
 */
function dados(doc) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-dados`);
  box.append(titulo(doc, T.dados.titulo));
  box.append(linha(doc, 'dados-fica', T.dados.ficaAqui));

  const acoes = el(doc, `${CLASSE}-dados-acoes`);
  const saida = el(doc, 'secundario', T.dados.exportar, 'button');
  saida.type = 'button';
  acoes.append(saida);

  const grupo = el(doc, `${CLASSE}-dados-importar`);
  const rotulo = el(doc, `${CLASSE}-dados-rotulo`, undefined, 'label');
  rotulo.htmlFor = 'perfil-arquivo';
  rotulo.append(el(doc, `${CLASSE}-dados-importar-texto`, T.dados.importar, 'span'));
  const entrada = el(doc, `${CLASSE}-dados-input`, undefined, 'input');
  entrada.id = 'perfil-arquivo';
  entrada.setAttribute('type', 'file');
  entrada.setAttribute('accept', '.json,application/json');
  entrada.setAttribute('aria-label', T.dados.importar);
  grupo.append(rotulo, entrada);
  acoes.append(grupo);
  box.append(acoes);
  return { box, saida, entrada, grupo };
}

function sobre(doc) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-sobre`);
  box.append(titulo(doc, T.sobre.titulo));
  box.append(linha(doc, 'sobre-linha', T.sobre.curriculo));
  box.append(linha(doc, 'sobre-linha', T.sobre.fonte));
  const link = el(doc, `${CLASSE}-sobre-codigo`, T.sobre.codigo, 'a');
  link.href = T.sobre.codigoUrl;
  link.setAttribute('rel', 'noopener');
  box.append(link);
  return box;
}

/**
 * Monta o Perfil na raiz que o casco escolheu.
 *
 * @param {Element} raiz contêiner da tela
 * @param {object} ctx {catalogo, modulos, storage?, document?, window?, hoje?}
 * @returns {Promise<{pronto: Promise, estado: () => object, desmontar: () => void}>}
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document || document;
  const win = ctx.window || window;
  const storage = ctx.storage || win.localStorage || null;
  const modulos = ctx.modulos || {};
  const hoje = typeof ctx.hoje === 'string' ? ctx.hoje : dataLocal();

  let montado = true;
  let catalogo = null;
  let estado = { completed: [], emCurso: [], conclusoes: {}, anotacoes: {}, revisoes: {} };
  // O trabalho em voo: ler o arquivo da pessoa é assíncrono, e quem chama
  // `montar` precisa poder esperar POR ELE, não só pela primeira pintura.
  let emVoo = Promise.resolve();

  const raizEl = el(doc, CLASSE);
  raiz.append(raizEl);

  function lerEstado(cat) {
    const completed = typeof modulos.loadCompleted === 'function' ? modulos.loadCompleted() : [];
    const detalhe = carregarViagem(storage, completed);
    let revisoes = {};
    try {
      revisoes = parseRevisoes(storage ? storage.getItem(STORAGE_KEY) : null);
    } catch {
      revisoes = {};
    }
    const notas = typeof modulos.loadNotas === 'function' ? modulos.loadNotas() : {};
    return {
      courses: cat.courses || [],
      electives: cat.electives,
      specializations: cat.specializations,
      completed: detalhe.completed,
      emCurso: detalhe.emCurso,
      conclusoes: detalhe.conclusoes,
      anotacoes: notas || {},
      revisoes,
    };
  }

  /** O recado do gesto, colado no gesto que o produziu. */
  function avisar(on, texto) {
    if (!montado || !on || !on.parentNode) return;
    const p = el(doc, `${CLASSE}-dados-recado`, texto);
    p.setAttribute('role', 'status');
    on.parentNode.append(p);
  }

  function desenhar(cat) {
    catalogo = cat;
    estado = lerEstado(cat);
    const feitos = new Set(estado.completed);
    raizEl.textContent = '';

    const cab = el(doc, `${CLASSE}-card ${CLASSE}-cabeca`);
    cab.append(placa(doc, T.rotulo));
    cab.append(el(doc, `${CLASSE}-h1`, T.titulo, 'h1'));
    raizEl.append(cab);

    const progresso = { completed: estado.completed, emCurso: estado.emCurso, conclusoes: estado.conclusoes };
    const lista = marcosDoPerfil(cat.courses || [], progresso);

    let r;
    if (feitos.size === 0) {
      // Trinta e cinco anéis vazios não dizem nada a quem ainda não começou: o
      // lugar do bilhete recebe a frase e a saída. Marcos e dados continuam.
      const vazio = el(doc, `${CLASSE}-card ${CLASSE}-em-branco`);
      vazio.append(linha(doc, 'em-branco-texto', T.emBranco));
      const ir = el(doc, 'primario', T.irParaProxima, 'a');
      ir.setAttribute('href', hrefDe({ tela: 'jornada' }));
      vazio.append(ir);
      raizEl.append(vazio);
      r = resumoDaViagem(progresso, cat.courses || []);
    } else {
      const b = bilhete(doc, cat, progresso, feitos, estado.conclusoes, hoje);
      raizEl.append(b.box);
      r = b.r;
    }

    const numeros = el(doc, `${CLASSE}-numeros`);
    numeros.append(numero(doc, T.numeros.carimbos, `${r.concluidas}/${r.estacoes}`));
    numeros.append(numero(doc, T.numeros.linhas, `${r.linhasFechadas} de ${r.linhas.length}`));
    numeros.append(numero(doc, T.numeros.revisoes, revisoesFeitas(estado.revisoes)));
    raizEl.append(numeros);

    const marcos = el(doc, `${CLASSE}-card ${CLASSE}-marcos`);
    marcos.append(titulo(doc, T.marcos.titulo));
    for (const m of lista) marcos.append(marco(doc, m, hoje));
    raizEl.append(marcos);

    const d = dados(doc);
    raizEl.append(d.box);
    raizEl.append(sobre(doc));

    d.saida.addEventListener('click', () => {
      const feito = exportarViagem(estado, { document: doc, window: win });
      avisar(d.saida, feito.ok ? feito.mensagem : T.dados.semDownload);
    });

    d.entrada.addEventListener('change', (ev) => {
      const alvo = ev && ev.target ? ev.target : d.entrada;
      const arquivo = alvo.files && alvo.files[0];
      if (!arquivo) return;
      emVoo = (async () => {
        let texto = '';
        try {
          texto = typeof arquivo.text === 'function' ? await arquivo.text() : String(arquivo);
        } catch {
          texto = '';
        }
        const deVolta = importarViagem(texto, estado);
        if (!deVolta.ok) {
          avisar(alvo, deVolta.mensagem);
          return;
        }
        estado = {
          ...estado,
          completed: deVolta.completed,
          anotacoes: deVolta.anotacoes,
          revisoes: deVolta.revisoes,
        };
        const gravou = typeof modulos.saveCompleted === 'function'
          ? modulos.saveCompleted(deVolta.completed)
          : true;
        if (typeof modulos.saveNotas === 'function') modulos.saveNotas(deVolta.anotacoes);
        let guardouFila = true;
        if (storage) {
          try {
            storage.setItem(STORAGE_KEY, serializeRevisoes(deVolta.revisoes));
          } catch {
            guardouFila = false;
          }
        }
        avisar(alvo, `${deVolta.mensagem}${gravou && guardouFila ? '' : ` ${T.dados.semStorage}`}`);
        if (catalogo && montado) desenhar(catalogo);
      })();
    });
  }

  // Só a promessa do catálogo, nunca `ctx.estadoCatalogo`: esse campo é efeito
  // colateral de outra tela (a Revisar escreve nele no casco compartilhado).
  // Pintar por ele faria o Perfil depender de a pessoa já ter visitado a
  // Revisar — e sem isso ele ignoraria o `catch` abaixo, servindo o estado
  // vazio em vez de dizer "sem rede" quando a trilha caiu.
  emVoo = ctx.catalogo
      .then((cat) => {
        if (montado) desenhar(cat);
        return cat;
      })
      .catch(() => {
        if (!montado) return null;
        // Erro com as três partes e sem resto de código na tela.
        raizEl.textContent = '';
        const cab = el(doc, `${CLASSE}-card ${CLASSE}-cabeca`);
        cab.append(placa(doc, T.rotulo));
        cab.append(el(doc, `${CLASSE}-h1`, T.titulo, 'h1'));
        raizEl.append(cab);
        raizEl.append(linha(doc, 'falha', T.erro));
        return null;
      });

  return {
    get pronto() { return emVoo; },
    estado: () => estado,
    desmontar: () => { montado = false; },
  };
}
