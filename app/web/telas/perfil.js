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
import { carregarViagem, salvarViagem } from '../metro.js';
// S20b-1b: as chaves dos baldes que o arquivo da versão 3 leva. A tela é quem
// conhece o storage (o núcleo continua puro); ela só precisa saber ONDE mora.
import { ESTUDO_KEY, RASCUNHO_PREFIXO } from '../../core/estudo.js';
import { CARTOES_KEY } from '../../core/cartoes.js';

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
 * Os baldes que a versão 3 do arquivo leva: estudo, cartões, rascunhos e o
 * carimbo das dominadas.
 *
 * POR QUE A TELA LÊ O STORAGE E O NÚCLEO NÃO: o núcleo é puro e nunca toca em
 * `window` (regra da casa, e é o que o deixa testar em node sem navegador). Quem
 * sabe onde mora cada chave é esta folha. Ela entrega o texto CRU por `extras` e
 * é `core/progress-io.js` quem canoniciza e decide se o campo entra no arquivo.
 *
 * A enumeração dos rascunhos usa `key(i)`, o método do `Storage` de verdade: os
 * storage falsos dos testes ganham `key`/`length` junto (tests/hdom.js), e o
 * `try/catch` é para o aparelho que não deixa nem enumerar — modo privado. Nesse
 * caso o arquivo sai sem rascunho nenhum e a pessoa perde só o que não digitou.
 *
 * `dominadas` não passa por aqui: já vem de `carregarViagem` dentro de
 * `lerEstado`, e é o mesmo objeto que a caderneta pinta.
 */
function baldesDaPessoa(storage) {
  const pega = (chave) => {
    try { return storage ? storage.getItem(chave) : null; } catch { return null; }
  };
  const rascunhos = {};
  try {
    const total = typeof storage?.length === 'number' ? storage.length : 0;
    for (let i = 0; i < total; i += 1) {
      const chave = typeof storage?.key === 'function' ? storage.key(i) : null;
      // A chave do storage vai INTEIRA no arquivo, não o id do vídeo: é o que faz
      // a tela importar ser um `setItem(chave, texto)` sem remontar nada, e é o
      // que mantém «exportar → importar → exportar» byte a byte. O prefixo é lido
      // do núcleo (core/estudo.js:779), não copiado aqui.
      if (typeof chave !== 'string' || !chave.startsWith(RASCUNHO_PREFIXO)) continue;
      const texto = pega(chave);
      if (texto) rascunhos[chave] = texto;
    }
  } catch { /* sem enumeração possível: o arquivo sai sem rascunho */ }
  return {
    estudo: pega(ESTUDO_KEY),
    cartoes: pega(CARTOES_KEY),
    rascunhos
  };
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
      // S18b-2: o carimbo do desafio (J4) mora em `dominadas`, e é daqui que a
      // caderneta o lê. `carregarViagem` já traz o campo; se ele não passar por
      // este estado, a tela perde a dominada entre ler e desenhar.
      dominadas: detalhe.dominadas,
      anotacoes: notas || {},
      revisoes,
      // S20b-1b: os baldes entram no estado exatamente para serem exportados —
      // `exportarViagem` (core/dados-pessoa.js) lê `estado.estudo`,
      // `estado.cartoes`, `estado.rascunhos` e `estado.dominadas` e os entrega a
      // `core/progress-io.js`, que é quem decide a forma. Ler aqui e não passar
      // adiante seria o mesmo buraco do v2 com uma folha nova por cima.
      ...baldesDaPessoa(storage),
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

    // S18b-2: `dominadas` entra aqui porque esta tela é quem desenha o carimbo da
    // estação (a caderneta, desenho §gamificação) e é quem lê a frase do que foi
    // medido. O objeto de progresso é remontado campo a campo, e sem esta linha o
    // carimbo chegaria até `carregarViagem` e pararia neste ponto — a tela do
    // perfil diria «percorrida» sobre uma estação que a pessoa dominou.
    const progresso = {
      completed: estado.completed,
      emCurso: estado.emCurso,
      conclusoes: estado.conclusoes,
      dominadas: estado.dominadas,
    };
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
        // S20b-1b: os baldes voltam ao storage. A regra é uma só e é a da viagem:
        // o arquivo que NÃO FALOU de um balde não apaga o balde do aparelho —
        // `traz*` é o sinal, e um `setItem` unconditional com o `null` do v2
        // apagaria os cartões de quem importa um backup de ontem.
        // `setItem` com texto vazio não existe: o núcleo devolve `null`, não `{}`,
        // justamente para este `if` ser possível.
        const devolveBalde = (chave, texto, falou) => {
          if (!storage || !falou || typeof texto !== 'string') return true;
          try {
            storage.setItem(chave, texto);
            return true;
          } catch {
            return false;
          }
        };
        let guardouBaldes = true;
        guardouBaldes = devolveBalde(ESTUDO_KEY, deVolta.estudo, deVolta.trazEstudo) && guardouBaldes;
        guardouBaldes = devolveBalde(CARTOES_KEY, deVolta.cartoes, deVolta.trazCartoes) && guardouBaldes;
        if (storage && deVolta.trazRascunhos && deVolta.rascunhos) {
          for (const [chave, texto] of Object.entries(deVolta.rascunhos)) {
            if (!devolveBalde(chave, texto, true)) { guardouBaldes = false; break; }
          }
        }
        // As dominadas voltam pela chave da viagem, que é onde moram
        // (web/metro.js: `atlas.viagem.detalhe.v1`). O arquivo que não falou delas
        // deixa `salvarViagem` com as do aparelho: importar backup velho não
        // rebaixa ninguém, que é a regra do desenho J4.
        if (storage && deVolta.trazDominadas) {
          try {
            salvarViagem(storage, {
              completed: deVolta.completed,
              emCurso: estado.emCurso,
              conclusoes: estado.conclusoes,
              dominadas: deVolta.dominadas
            });
          } catch { /* sem storage: o estado da tela ainda pinta o arquivo */ }
        }
        estado = {
          ...estado,
          estudo: deVolta.trazEstudo ? deVolta.estudo : estado.estudo,
          cartoes: deVolta.trazCartoes ? deVolta.cartoes : estado.cartoes,
          rascunhos: deVolta.trazRascunhos ? deVolta.rascunhos : estado.rascunhos,
          dominadas: deVolta.trazDominadas ? deVolta.dominadas : estado.dominadas
        };
        avisar(alvo, `${deVolta.mensagem}${gravou && guardouFila && guardouBaldes ? '' : ` ${T.dados.semStorage}`}`);
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
        // S10a (regua 1): as tres partes e uma saida, como no metrô. Sem isto o
        // Perfil sem rede era um beco: uma frase e nenhum caminho de volta.
        raizEl.append(linha(doc, 'falha', T.erro), linha(doc, 'falha', T.erroOQueFazer));
        const irFalha = el(doc, 'primario', T.irParaProxima, 'a');
        irFalha.setAttribute('href', hrefDe({ tela: 'jornada' }));
        raizEl.append(irFalha);
        return null;
      });

  return {
    get pronto() { return emVoo; },
    estado: () => estado,
    desmontar: () => { montado = false; },
  };
}
