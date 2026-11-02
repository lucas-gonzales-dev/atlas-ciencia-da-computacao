// Projeto Atlas — a tela REVISAR: reencontrar no momento certo (S8, 01/11/2026).
//
// POR QUE EXISTE: quem conclui uma estação guarda uma ideia que o tempo leva. O
// Lovable inventava perguntas de aula que ninguém tem; aqui o conteúdo da revisão
// é a ANOTAÇÃO DA PRÓPRIA PESSOA, e o método é o de sempre: tentar lembrar antes
// de ler, conferir, voltar depois.
//
// REGRA DA CASA: nada de regra de calendário aqui. O degrau, a data e a fila
// moram em core/revisao.js, com 19 testes; o que a estação abriu mora em
// core/viagem.js. Este arquivo só traduz estado em DOM e devolve o que a pessoa
// escolheu. Se aparecer um `if` que soma dias, está no lugar errado.
//
// SEM PUNIÇÃO, EM CÓDIGO: atrasar não muda nada (a fila só mostra o que está
// vencido, da mais atrasada para a mais recente, no máximo 3) e "Não lembrei"
// reagenda sem culpa. Nenhuma frase daqui conta dias sem fazer, nenhum número é
// placar — a lista do proibido (design/README §9) é teste, não decoro.
//
// O TEMPORIZADOR É INJETADO (lição da 2c-1/2d): o aviso de "Desfazer" usa o
// setTimeout que chega em `ctx`, nunca o relógio de verdade, senão o teste dorme
// até estourar a cota do turno.
import {
  STORAGE_KEY,
  conciliar,
  registrarRevisao,
  filaDoDia,
  proximaData,
  contarRevisoes,
  parseRevisoes,
  serializeRevisoes,
} from '../../core/revisao.js';
import { dataLocal } from '../../core/viagem.js';
import { JANELA_DESFAZER_MS, carregarViagem } from '../metro.js';
import { hrefDe } from '../../core/rotas.js';
import { estados, revisar as T } from '../../core/textos.js';

const CLASSE = 'revisar';

function el(doc, classe, texto, tag) {
  const no = doc.createElement(tag || 'div');
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function botao(doc, classe, texto, tipo) {
  const b = doc.createElement('button');
  b.type = tipo || 'button';
  b.className = classe;
  b.textContent = texto;
  return b;
}

/**
 * A data que o leitor de tela e os olhos recebem: dd/mm/aaaa. ISO no bilhete de
 * ninguém (lição da 2d-2 — formata a string, sem fuso que vire o dia).
 */
function diaLegivel(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** A data local, uma vez só por pintura: `new Date()` espalhado é instável. */
function hojeDe(ctx) {
  if (typeof ctx.hoje === 'string') return ctx.hoje;
  if (ctx.hoje instanceof Date) return dataLocal(ctx.hoje);
  return dataLocal();
}

/**
 * Monta a aba Revisar na raiz que o casco escolheu.
 *
 * @param {Element} raiz contêiner da tela
 * @param {object} ctx {catalogo, modulos, document?, window?, hoje?, setTimeout?}
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document || document;
  const win = ctx.window || window;
  const storage = win.localStorage || null;
  const marcar = ctx.setTimeout || ((fn, ms) => win.setTimeout(fn, ms));
  const desmarcar = ctx.clearTimeout || ((id) => win.clearTimeout(id));
  const modulos = ctx.modulos || {};

  let montado = true;
  let desfazerId = null;

  const corpo = el(doc, `${CLASSE}-corpo`);
  const raizEl = el(doc, CLASSE);
  raizEl.append(corpo);
  raiz.append(raizEl);

  // ── dados ────────────────────────────────────────────────────────────────
  function lerProgressoBruto() {
    const completed = typeof modulos.loadCompleted === 'function' ? modulos.loadCompleted() : [];
    // As DATAS de conclusão vêm do detalhe da viagem (o mesmo lugar onde o metrô
    // as guarda): sem elas, uma conclusão de agosto entraria na fila como se
    // tivesse sido feita hoje.
    const detalhe = carregarViagem(storage, completed);
    return { completed: detalhe.completed, emCurso: detalhe.emCurso, conclusoes: detalhe.conclusoes };
  }

  function lerRevisoes(hoje) {
    let guardadas = {};
    if (storage) {
      try {
        guardadas = parseRevisoes(storage.getItem(STORAGE_KEY));
      } catch {
        guardadas = {};
      }
    }
    return conciliar(guardadas, lerProgressoBruto(), hoje);
  }

  function gravar(revisoes) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, serializeRevisoes(revisoes));
      return true;
    } catch {
      // Modo privado, cota cheia: a fila continua na tela, e a pessoa não perde
      // o que já tinha. Falar de erro aqui seria cobrança sobre algo que ela não
      // controla.
      return false;
    }
  }

  function notaDe(id) {
    if (typeof modulos.loadNotas !== 'function') return null;
    const notas = modulos.loadNotas() || {};
    const texto = notas[id];
    return typeof texto === 'string' && texto.trim() !== '' ? texto.trim() : null;
  }

  // ── as três telas dentro da tela ─────────────────────────────────────────
  function pecaDoDia(doc, curso, hoje) {
    const caixa = el(doc, `${CLASSE}-peca`);
    const placa = el(doc, `${CLASSE}-placa`, T.rotulo);
    caixa.append(placa);

    const nome = curso ? curso.title || curso.id : '';
    const linha = curso && Number.isInteger(curso.line) ? T.naLinha(nome, curso.line) : T.semLinha(nome);
    const titulo = el(doc, `${CLASSE}-estacao`, linha, 'h1');
    caixa.append(titulo);

    caixa.append(el(doc, `${CLASSE}-convite`, T.tentarLembrar, 'p'));

    // A anotação não aparece antes do pedido: lembrar vem primeiro, e mostrar de
    // cara seria responder a pergunta com a resposta na frente.
    const caixaNota = el(doc, `${CLASSE}-anotacao`);
    caixaNota.hidden = true;
    const mostrar = botao(doc, `${CLASSE}-secundario`, T.mostrarAnotacao);
    mostrar.addEventListener('click', () => {
      caixaNota.textContent = '';
      const texto = notaDe(curso.id);
      if (texto) {
        caixaNota.append(el(doc, `${CLASSE}-anotacao-texto`, texto, 'blockquote'));
      } else {
        caixaNota.append(el(doc, `${CLASSE}-anotacao-vazia`, T.semAnotacao, 'p'));
        const url = curso.resourceUrl;
        if (typeof url === 'string' && url !== '') {
          const a = doc.createElement('a');
          a.className = `${CLASSE}-link-curso`;
          a.href = url;
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
          a.textContent = T.verCurso;
          caixaNota.append(a);
        }
      }
      caixaNota.hidden = false;
      mostrar.textContent = T.esconderAnotacao;
    });
    caixa.append(mostrar);
    caixa.append(caixaNota);

    // Os três do mesmo peso: nenhum primário, porque nenhum dos três é "certo".
    const fileira = el(doc, `${CLASSE}-respostas`);
    for (const resultado of Object.keys(T.resultados)) {
      const b = botao(doc, `${CLASSE}-resposta`, T.resultados[resultado]);
      b.dataset.resultado = resultado;
      b.addEventListener('click', () => responder(curso.id, resultado, hoje));
      fileira.append(b);
    }
    caixa.append(fileira);
    return caixa;
  }

  function emDia(doc, revisoes) {
    const caixa = el(doc, `${CLASSE}-vazio`);
    caixa.append(el(doc, `${CLASSE}-titulo`, T.emDia, 'h1'));
    const proxima = diaLegivel(proximaData(revisoes));
    if (proxima) caixa.append(el(doc, `${CLASSE}-sub`, T.proximaEm(proxima), 'p'));
    caixa.append(el(doc, `${CLASSE}-nota`, T.semPressao, 'p'));
    return caixa;
  }

  function nadaParaRevisar(doc) {
    const caixa = el(doc, `${CLASSE}-vazio`);
    caixa.append(el(doc, `${CLASSE}-titulo`, T.nadaParaRevisar, 'h1'));
    const a = doc.createElement('a');
    a.className = `${CLASSE}-primario`;
    a.href = hrefDe({ tela: 'jornada' });
    a.textContent = T.irParaProxima;
    caixa.append(a);
    return caixa;
  }

  /** "Como funciona", sempre no fim: o método se explica, não se cobra. */
  function comoFunciona(doc) {
    const secao = el(doc, `${CLASSE}-como`);
    secao.append(el(doc, `${CLASSE}-como-titulo`, T.comoFunciona, 'h2'));
    const lista = el(doc, `${CLASSE}-cartoes`, null, 'ol');
    for (const c of T.cartoes) {
      const li = doc.createElement('li');
      li.className = `${CLASSE}-cartao`;
      li.append(el(doc, `${CLASSE}-cartao-numero`, c.numero, 'span'));
      li.append(el(doc, `${CLASSE}-cartao-titulo`, c.titulo, 'strong'));
      li.append(el(doc, `${CLASSE}-cartao-texto`, c.texto, 'p'));
      lista.append(li);
    }
    secao.append(lista);
    return secao;
  }

  // ── a ação que grava ─────────────────────────────────────────────────────
  function pintar() {
    if (!montado) return;
    const hoje = hojeDe(ctx);
    const revisoes = lerRevisoes(hoje);
    const fila = filaDoDia(revisoes, hoje, 3);
    corpo.textContent = '';

    if (fila.length > 0) {
      const cat = ctx.estadoCatalogo;
      const curso = cat ? (cat.courses || []).find((c) => c.id === fila[0]) : null;
      corpo.append(pecaDoDia(doc, curso || { id: fila[0], title: fila[0] }, hoje));
    } else if (contarRevisoes(revisoes) > 0) {
      corpo.append(emDia(doc, revisoes));
    } else {
      corpo.append(nadaParaRevisar(doc));
    }
    corpo.append(comoFunciona(doc));
  }

  function responder(id, resultado, hoje) {
    const antes = lerRevisoes(hoje);
    const depois = registrarRevisao(antes, id, resultado, hoje);
    gravar(depois);
    desfazerId = desfazerId === null ? null : desfazerId;
    pintar();

    // O aviso de baixo oferece "Desfazer" pela MESMA janela do metrô: desfazer o
    // que acabou de acontecer é o único conserto que não pede que a pessoa
    // remember o que fez.
    const aviso = el(doc, `${CLASSE}-aviso`);
    const curso = ctx.estadoCatalogo
      ? (ctx.estadoCatalogo.courses || []).find((c) => c.id === id)
      : null;
    aviso.append(el(doc, `${CLASSE}-aviso-texto`, T.anuncia(curso ? curso.title || id : id), 'p'));
    const desfazer = botao(doc, `${CLASSE}-aviso-desfazer`, T.desfazer);
    desfazer.addEventListener('click', () => {
      if (desfazerId) desmarcar(desfazerId);
      gravar(antes);
      limparAviso();
      pintar();
    });
    aviso.append(desfazer);
    corpo.append(aviso);
    desfazerId = marcar(() => {
      desfazerId = null;
      limparAviso();
    }, JANELA_DESFAZER_MS);
  }

  function limparAviso() {
    const aviso = corpo.querySelector ? corpo.querySelector(`.${CLASSE}-aviso`) : null;
    if (aviso && aviso.remove) aviso.remove();
  }

  // O catálogo é a promessa do casco — nunca uma segunda busca ao mesmo JSON.
  Promise.resolve(ctx.catalogo)
    .then((catalogo) => {
      if (!montado) return;
      ctx.estadoCatalogo = catalogo;
      pintar();
    })
    .catch(() => {
      if (!montado) return;
      corpo.textContent = '';
      corpo.append(el(doc, `${CLASSE}-sub`, estados.offline.descricao, 'p'));
    });

  return {
    desmontar() {
      montado = false;
      if (desfazerId) desmarcar(desfazerId);
    },
    pintar,
  };
}
