// Projeto Atlas — a tela REVISAR: a fila de CARTÕES do dia (S15b, 04/11/2026).
//
// POR QUE MUDOU: a S8 desenhava uma revisão por ESTAÇÃO, com a anotação e três
// botões. O desenho novo (design/v3/00-desenho.md, J3) trocou a unidade pelo
// CARTÃO que a própria pessoa escreveu ao fechar a aula (S14b2). Enquanto esta
// aba mostrasse a revisão por estação, o cartão escrito no fechamento não voltava
// para lugar nenhum — ele existia no storage e não tinha tela.
//
// O QUE ESTE ARQUIVO É, E O QUE NÃO É: a máquina de ESTADO da sessão — o que está
// devido, qual cartão, se o verso foi visto, o arquivo do antes/depois e os
// gestos. Os DESENHOS dos quatro estados mudaram para `web/telas/revisar-fila.js`:
// este arquivo chegou a 504 linhas e a regra 15 do design/v2/00-regras.md manda
// dividir além de 400 pela responsabilidade. O mesmo corte já foi feito em
// `jornada-blocos.js` (S4a) e `aulas-pedacos.js` (S13b).
//
// REGRA DA CASA, E ELA NÃO É ENFEITE: nenhuma regra de calendário, de fila ou de
// memória mora aqui. O que está devido é `cartoesDevidos`, o que uma resposta faz
// ao cartão é `revisarCartao`, o placar da sessão é `resumoDaSessao`, e QUAL AULA
// virou lembrada é `aulasLembradasNaSessao` — todos em core/cartoes.js, com
// testes próprios. Se aparecer aqui um `if` que soma dias ou que vasculha o
// `historico`, está no lugar errado: é assim que a S8 teve duas definições de
// "revisado", a da tela e a do núcleo. Nenhuma frase de tela é escrita aqui — a
// fonte é `core/textos.js` (bloco `revisar`), e o nome de uma estação o catálogo.
//
// O QUE SAIU DA TELA (item 3): os três botões por estação, o "Desfazer" com
// temporizador e a caixa "Como funciona". Sem o temporizador, este arquivo não
// injeta `setTimeout` nem conhece `JANELA_DESFAZER_MS`.
//
// A MIGRAÇÃO RODA AQUI, uma vez por montagem, DEPOIS de o catálogo chegar: ela
// precisa do NOME das estações para escrever a frente (regra 7), e o id
// determinístico `migr-<estacao>` é o que a torna idempotente numa segunda
// montagem. A chave `atlas.revisoes.v1` NÃO é apagada (decisão da S15a).
import {
  CARTOES_KEY,
  LIMITE_FILA,
  aulasLembradasNaSessao,
  cartoesDevidos,
  diasEntre,
  lerCartoes,
  proximoDevido,
  resumoDaSessao,
  revisarCartao,
  serializarCartoes,
} from '../../core/cartoes.js';
import { STORAGE_KEY, migrarRevisoesAntigas, parseRevisoes } from '../../core/revisao.js';
import { dataDeCalendario, estados, revisar as T } from '../../core/textos.js';
import { dataLocal, resumoDaViagem } from '../../core/viagem.js';
import { carregarViagem } from '../metro.js';
import {
  CLASSE,
  el,
  desenhaAbertura,
  desenhaCartao,
  desenhaEmDia,
  desenhaFim,
  desenhaSemCartao,
} from './revisar-fila.js';

/**
 * Monta a aba Revisar na raiz que o casco escolheu.
 *
 * @param {Element} raiz contêiner da tela
 * @param {object} ctx {catalogo, modulos, storage?, document?, window?, hoje?}
 * @returns {{desmontar: () => void, pintar: () => void}}
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document || document;
  const win = ctx.window || (typeof window !== 'undefined' ? window : null);
  const storage = ctx.storage || (win && win.localStorage) || null;
  const modulos = ctx.modulos || {};

  let montado = true;
  let migrou = false;
  let catalogo = null;

  // O estado da tela vive aqui, e em nenhum outro lugar. `sessao` guarda o
  // arquivo do INÍCIO da sessão porque `resumoDaSessao` e
  // `aulasLembradasNaSessao` comparam antes e depois: contar os acertos na tela
  // seria ter duas definições de "revisado".
  let tela = 'abertura';
  let fila = [];
  let indice = 0;
  let visto = false;
  let confianca = null;
  let sessao = null;

  const corpo = el(doc, `${CLASSE}-corpo`);
  const raizEl = el(doc, CLASSE);
  raizEl.append(corpo);
  raiz.append(raizEl);

  // ── dados ────────────────────────────────────────────────────────────────
  function hoje() {
    if (typeof ctx.hoje === 'string') return ctx.hoje;
    if (ctx.hoje instanceof Date) return dataLocal(ctx.hoje);
    return dataLocal();
  }

  function lerArquivo() {
    if (!storage || typeof storage.getItem !== 'function') return lerCartoes(null);
    let bruto = null;
    try {
      bruto = storage.getItem(CARTOES_KEY);
    } catch {
      bruto = null;
    }
    return lerCartoes(bruto);
  }

  function gravar(arquivo) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(CARTOES_KEY, serializarCartoes(arquivo));
      return true;
    } catch {
      // Modo privado ou cota cheia: a fila continua na tela. Falar de erro aqui
      // seria cobrança sobre algo que a pessoa não controla (mesma decisão S8).
      return false;
    }
  }

  /**
   * A migração da S15a, uma vez por montagem.
   *
   * Só roda com o catálogo na mão: sem ele não há nome para a frente do cartão,
   * e um cartão "O que você leva de undefined?" na fila é pior que nenhum.
   * Devolve o arquivo já com os cartões migrados, para a primeira pintura não
   * reler o storage atrás do que acabou de gravar.
   */
  function migrar(arquivo) {
    if (migrou || !storage) return arquivo;
    migrou = true;
    if (!catalogo) return arquivo;
    let antigas = {};
    try {
      antigas = parseRevisoes(storage.getItem(STORAGE_KEY));
    } catch {
      return arquivo;
    }
    const notas = typeof modulos.loadNotas === 'function' ? modulos.loadNotas() || {} : {};
    // `nomesDoCatalogo` exige o ARRAY de estações: passar `{courses}` daria
    // `nomes` vazio, `ignorados` 0 e uma migração que finge ter rodado.
    const estacoes = Array.isArray(catalogo) ? catalogo : catalogo.courses || [];
    // `T00:00` do dia, e não o relógio de agora: a migração não pode afirmar a
    // hora em que a pessoa escreveu a anotação antiga, e `devidoEm` é dia.
    const r = migrarRevisoesAntigas(antigas, notas, estacoes, arquivo, `${hoje()}T00:00`);
    if (!r.criados) return arquivo;
    const novo = { versao: arquivo.versao, cartoes: r.cartoes };
    gravar(novo);
    return novo;
  }

  const nomeDe = (idEstacao) => {
    const curso = catalogo && (catalogo.courses || []).find((c) => c && c.id === idEstacao);
    return curso ? curso.title || curso.id : String(idEstacao || '');
  };

  /** O rótulo de origem do cartão: "Aula 3 de Circuitos Digitais", ou a estação. */
  function rotuloDeOrigem(cartao) {
    const estacao = nomeDe(cartao.estacao);
    return cartao.n === null || cartao.n === undefined
      ? T.origemEstacao(estacao)
      : T.origemAula(cartao.n, estacao);
  }

  /** A mesma frase, na lista do fim: de onde veio a aula que virou «lembrada». */
  const rotuloDaAula = (aula) => (aula.n === null || aula.n === undefined
    ? T.origemEstacao(nomeDe(aula.estacao))
    : T.origemAula(aula.n, nomeDe(aula.estacao)));

  // ── os gestos ────────────────────────────────────────────────────────────
  function comecar() {
    const arquivo = lerArquivo();
    fila = cartoesDevidos(arquivo, hoje(), LIMITE_FILA);
    sessao = { antes: arquivo, depois: arquivo, ids: [], resumo: null, lembradas: [] };
    indice = 0;
    visto = false;
    confianca = null;
    tela = 'cartao';
    if (!fila.length) {
      // A fila evaporou entre o "Começar" e o clique (importou outra viagem,
      // desfez a aula): volta à abertura, que é o estado honesto de agora.
      sessao = null;
      tela = 'abertura';
    }
    pintar();
  }

  function escolherConfianca(chave) {
    // Escolher e desescolher: três botões do mesmo peso, nenhum obrigatório, e
    // ninguém é obrigado a dizer que não sabe porque tocou uma vez.
    confianca = confianca === chave ? null : chave;
    pintar();
  }

  function mostrarVerso() {
    visto = true;
    pintar();
  }

  function responder(nota) {
    const cartao = fila[indice];
    if (!cartao || !sessao) return;
    const resultado = revisarCartao(
      sessao.depois,
      cartao.id,
      { nota, confianca },
      `${hoje()}T${horaAtual()}`
    );
    if (!resultado.ok) {
      // O cartão não está mais ali: a fila é recalculada do storage em vez de
      // fingir que respondeu, e o erro do núcleo não vira mensagem na tela.
      sessao.depois = lerArquivo();
      proximo();
      return;
    }
    sessao.depois = { versao: sessao.depois.versao, cartoes: resultado.cartoes };
    sessao.ids.push(cartao.id);
    gravar(sessao.depois);
    proximo();
  }

  function proximo() {
    visto = false;
    confianca = null;
    if (indice + 1 < fila.length) {
      indice += 1;
      pintar();
      return;
    }
    fecharSessao();
    pintar();
  }

  /** O fecho da sessão: os dois números e as aulas lembradas, todos do núcleo. */
  function fecharSessao() {
    if (!sessao) return;
    sessao.resumo = resumoDaSessao(sessao.antes, sessao.depois, sessao.ids, hoje());
    sessao.lembradas = aulasLembradasNaSessao(sessao.antes, sessao.depois);
    tela = 'fim';
  }

  /** A hora local do gesto, no formato que o núcleo aceita (`aaaa-mm-ddThh:mm`). */
  function horaAtual() {
    const d = ctx.hoje instanceof Date ? ctx.hoje : new Date();
    const p = (v) => String(v).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** "em 2 dias", "amanhã", ou a data legível quando o intervalo é longo. */
  function prazoLegivel(proximaEm) {
    if (!proximaEm) return null;
    const dias = diasEntre(hoje(), proximaEm);
    if (dias === 1) return T.prazoAmanha;
    if (dias > 1 && dias <= 30) return T.prazoEmDias(dias);
    return dataDeCalendario(proximaEm);
  }

  // ── a pintura ────────────────────────────────────────────────────────────
  /** O FIM, montado a partir do resumo que o núcleo devolveu ao fechar a sessão. */
  function desenharFim() {
    const r = sessao.resumo;
    return desenhaFim(doc, {
      revisados: r.revisados,
      lembrados: r.lembrados,
      prazo: prazoLegivel(r.proximaEm),
      lembradas: sessao.lembradas.map(rotuloDaAula)
    });
  }

  /**
   * A classe do estado na raiz é posta DEPOIS do conteúdo: `desenhar()` troca o
   * `tela` no meio (a abertura que descobre que não há nada devido vira
   * "em-dia"), e uma classe fixada antes diria `revisar-abertura` sobre uma tela
   * de Em dia. É a classe que a régua dos primários e o CSS leem.
   */
  function pintar() {
    if (!montado) return;
    corpo.textContent = '';
    desenhar();
    raizEl.className = `${CLASSE} ${CLASSE}-${tela}`;
  }

  function desenhar() {
    if (tela === 'fim') {
      corpo.append(desenharFim());
      return;
    }

    const arquivo = lerArquivo();
    if (tela === 'cartao') {
      fila = fila.filter((c) => c && (arquivo.cartoes || {})[c.id]);
      if (!fila.length || indice >= fila.length) {
        if (sessao && sessao.ids.length) {
          fecharSessao();
          corpo.append(desenharFim());
          return;
        }
        tela = 'abertura';
      } else {
        const cartao = fila[indice];
        corpo.append(desenhaCartao(doc, {
          cartao,
          origem: rotuloDeOrigem(cartao),
          posicao: T.posicao(indice + 1, fila.length),
          visto,
          confianca,
          escolher: escolherConfianca,
          mostrar: mostrarVerso,
          responder
        }));
        return;
      }
    }

    if (tela === 'abertura') {
      const devidos = cartoesDevidos(arquivo, hoje(), Infinity);
      const mostra = cartoesDevidos(arquivo, hoje(), LIMITE_FILA);
      const temAlgum = Object.keys(arquivo.cartoes || {}).length > 0;
      if (!temAlgum) {
        // O `tela` acompanha o que foi PINTADO, e não o que se pediu: quem abre a
        // aba pede a abertura, e a abertura descobre que não há fila nenhuma. A
        // classe da raiz é lida pela régua dos primários e pelo CSS — se ela
        // dissesse `revisar-abertura` sobre uma tela de sem-cartão, as duas
        // olhariam um estado que não é o da pessoa.
        tela = 'sem-cartao';
        corpo.append(desenhaSemCartao(doc, { proxima: proximaEstacaoDaViagem() }));
        return;
      }
      if (!mostra.length) {
        corpo.append(desenharEmDia(arquivo));
        return;
      }
      corpo.append(desenhaAbertura(doc, {
        total: devidos.length,
        naSessao: mostra.length,
        comecar
      }));
      return;
    }

    corpo.append(desenharEmDia(arquivo));
  }

  /** O estado Em dia: a próxima data já legível, resolvida a partir do arquivo. */
  function desenharEmDia(arquivo) {
    tela = 'em-dia';
    const proxima = proximoDevido(arquivo, hoje());
    return desenhaEmDia(doc, { proximaData: proxima ? dataDeCalendario(proxima) : null });
  }

  /**
   * A estação para onde a pessoa vai escrever o primeiro cartão. É o MESMO
   * cálculo do resto do app (`resumoDaViagem.proximaEstacao`), pela regra da
   * fonte única que a S13a registrou: duas contas de "próxima" na tela é ter duas
   * próximas.
   *
   * O ARRAY, como o metro.js:1353 monta `ui.catalogo`. `resumoDaViagem` espera a
   * lista de cursos: medido no catálogo real, o objeto devolve
   * `proximaEstacao: null`, e um null aqui mandaria a pessoa de volta ao '#/'
   * com uma fila que ela nunca viu.
   */
  function proximaEstacaoDaViagem() {
    if (!catalogo) return null;
    const cursos = Array.isArray(catalogo) ? catalogo : catalogo.courses || [];
    const proxima = resumoDaViagem(lerViagem(), cursos).proximaEstacao;
    return proxima ? cursos.find((c) => c && c.id === proxima.id) || null : null;
  }

  function lerViagem() {
    const completed = typeof modulos.loadCompleted === 'function' ? modulos.loadCompleted() : [];
    return carregarViagem(storage, completed);
  }

  // O catálogo é a promessa do casco — nunca uma segunda busca ao mesmo JSON.
  Promise.resolve(ctx.catalogo)
    .then((c) => {
      if (!montado) return;
      catalogo = c;
      migrar(lerArquivo());
      pintar();
    })
    .catch(() => {
      if (!montado) return;
      corpo.textContent = '';
      raizEl.className = `${CLASSE} ${CLASSE}-erro`;
      corpo.append(el(doc, `${CLASSE}-sub`, estados.offline.descricao, 'p'));
    });

  return {
    desmontar() {
      montado = false;
    },
    pintar,
  };
}
