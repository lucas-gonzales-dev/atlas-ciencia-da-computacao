// Projeto Atlas — a TELA do desafio da estação (S18c-1, 06/11/2026, desenho J4).
//
// O QUE ELA É: o lugar onde se faz aquilo que a caderneta promete desde a S17a,
// «o desafio da estação aprovado». O núcleo (core/desafio.js) já media, sorteava,
// corrigia e carimbava — quem procurasse o desafio não achava tela nenhuma. Esta
// fatia é pintura e fio: o `pode`, o sorteio, o corte de 0,8, a volta dos errados
// para hoje e o carimbo continuam sendo conta do core, que não foi tocado.
//
// REGRAS DESTE ARQUIVO:
//   · monta DOM e mexe em storage, nada de regra. Nenhuma conta de datas, de
//     idade de cartão ou de aprovação acontece aqui;
//   · roda no node e no navegador sem `document` global: `doc`, `win` e `storage`
//     entram pelo ctx, como em web/telas/revisar.js;
//   · nenhuma frase escrita aqui: todo texto sai de core/textos.js (blocos
//     `desafio`, `folha` e `revisar`) ou do que o núcleo devolve;
//   · o cartão é desenhado por `desenhaCartao` (revisar-fila.js) com
//     `semConfianca: true`. Copiar o desenho faria existir dois cartões, um por
//     aba — é o que a regra 9 nomeia;
//   · as classes são as de `revisar.css`, que já desenham cada uma. Zero classe
//     nova: classe que o CSS não conhece é roupa invisível, e a folha própria do
//     desafio é a S18c-2.
import { carregarAulas } from '../aulas-dados.js';
import { estudoDoStorage } from '../aulas-pedacos.js';
import { hrefDe } from '../../core/rotas.js';
import { dataLocal } from '../../core/viagem.js';
import { CARTOES_KEY, lerCartoes, serializarCartoes } from '../../core/cartoes.js';
import {
  aplicarResultado,
  corrigirDesafio,
  montarDesafio,
  podeDesafiar,
  fraseDaDominada,
} from '../../core/desafio.js';
import { eixosDaEstacao } from '../../core/eixos.js';
// A LEITURA do data/aulas/indice.json mora em jornada-topo.js, e web/telas/perfil.js
// já a importa de lá: um segundo leitor do mesmo JSON é o que a casa chama de dois
// duplicados que divergem (lição da 2c).
import { carregarIndice } from './jornada-topo.js';
import { carregarViagem, salvarViagem } from '../metro.js';
import { CLASSE, botao, desenhaCartao, el, link } from './revisar-fila.js';
import { desafio as T, folha as F, revisar as R } from '../../core/textos.js';

/** A chave da sessão em andamento. É o que faz recarregar não baralhar de novo. */
const SESSAO_KEY = 'atlas.desafio.v1';

const PRIMARIO = `${CLASSE}-primario botao botao-primario`;

/** O texto cru do balde de cartões, lido sem estourar o modo privado. */
function brutoDeCartoes(storage) {
  try {
    return storage ? storage.getItem(CARTOES_KEY) : null;
  } catch {
    return null;
  }
}

/**
 * A sessão lida. `{estacao, cartoes, respostas, visto}`.
 *
 * `visto` é o VERSO do cartão atual, e a POSIÇÃO não é guardada: ela é o
 * tamanho de `respostas` (um cartão respondido a menos = o mesmo cartão na
 * frente). Um índice escrito à parte seria um segundo dono para um número que o
 * arquivo já tem, e os dois divergem no primeiro clique duplo.
 *
 * Chave de OUTRA estação, JSON quebrado ou sorteio vazio devolvem `null` — é
 * recomeçar, e não desenhar o desafio de uma estação com os cartões de outra.
 */
function lerSessao(storage, idEstacao) {
  let bruto = null;
  try {
    bruto = storage ? storage.getItem(SESSAO_KEY) : null;
  } catch {
    return null;
  }
  if (!bruto) return null;
  let s = null;
  try {
    s = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (!s || s.estacao !== idEstacao) return null;
  const ids = Array.isArray(s.cartoes) ? s.cartoes.filter((x) => typeof x === 'string') : [];
  if (!ids.length) return null;
  return {
    estacao: idEstacao,
    cartoes: ids,
    respostas: s.respostas && typeof s.respostas === 'object' ? s.respostas : {},
    visto: Boolean(s.visto),
  };
}

function gravarSessao(storage, sessao) {
  try {
    storage.setItem(SESSAO_KEY, JSON.stringify(sessao));
  } catch {
    // Sem storage a sessão vive na memória e morre ao recarregar. A tela não
    // avisa: é o mesmo silêncio protetor do modo privado da Revisar
    // (revisar.js:113) — cobrar do aluno algo que o aparelho dele decide.
  }
}

/**
 * Monta o desafio da estação pedida pela rota.
 *
 * @param {Element} raiz o contêiner que o casco esvazia e entrega
 * @param {{document: object, window: object, catalogo: Promise, folha: string,
 *          modulos?: object, storage?: object, hoje?: string, indice?: object,
 *          buscarIndice?: Function, buscarAulas?: Function}} ctx
 * @returns {Promise<{desmontar: () => void, rotulo: string|null}>}
 *   `rotulo` é o que o casco põe no `document.title` e no anúncio: uma tela que
 *   não é aba precisa se nomear sozinha.
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document || document;
  const win = ctx.window || (typeof window !== 'undefined' ? window : null);
  const storage = ctx.storage || (win && win.localStorage) || null;

  const slug = String(ctx.folha || '');
  const hoje = typeof ctx.hoje === 'string' ? ctx.hoje : dataLocal();

  // O catálogo NA FORMA QUE O APP ENTREGA: `ctx.catalogo` é a promessa do
  // `loadCatalog()`, que resolve em `{courses: [...]}` e não numa lista
  // (defeito 1, julgado no Chrome na S13b — a mesma leitura de web/telas/aulas.js).
  const bruto = await ctx.catalogo;
  const catalogo = bruto?.courses ?? [];
  const curso = catalogo.find((c) => c && (c.slug === slug || c.id === slug)) || null;

  // A raiz é a classe, como em web/telas/aula.js:715 e web/telas/aulas.js:149 —
  // o casco entrega o contêiner vazio e a tela o nomeia. `desafio` fica fora do
  // CSS de propósito (CLASSE_DA_TELA no casco): quem desenha é revisar.css.
  raiz.className = CLASSE;
  raiz.setAttribute('data-rota', 'desafio');
  const corpo = el(doc, `${CLASSE}-corpo`);
  raiz.append(corpo);

  // ── estação que não existe ───────────────────────────────────────────────
  // Deep-link errado ou catálogo que mudou. A saída é a MESMA da folha
  // (web/folha.js:400): a frase da casa e UM link, nenhum primário de ação — um
  // «Começar» aqui seria promessa sobre nada. Nunca tela em branco: este ramo
  // devolve algo pintado e um rótulo para o casco.
  if (!curso) {
    aindaNaoExistente();
    return { desmontar: () => {}, rotulo: F.naoEstaNoMapa };
  }

  const id = String(curso.id);
  const nome = typeof curso.title === 'string' ? curso.title : id;
  raiz.setAttribute('data-estacao', id);

  // ── os dados, cada um lido do lugar de sempre ────────────────────────────
  const arquivo = lerCartoes(brutoDeCartoes(storage));
  const estudo = estudoDoStorage(storage);
  const completed = typeof ctx.modulos?.loadCompleted === 'function' ? ctx.modulos.loadCompleted() : [];
  const detalhe = carregarViagem(storage, completed);
  const progresso = {
    completed: detalhe.completed,
    emCurso: detalhe.emCurso,
    conclusoes: detalhe.conclusoes,
    dominadas: detalhe.dominadas,
  };

  // A tabela de aulas por estação (data/aulas/indice.json): o estágio medido do
  // eixo e o total de aulas não existem sem ela. `ctx.indice` é a injeção do
  // teste e do casco (metro.js já guarda `ui.indice`); sem ela a tela não chuta
  // nada — o eixo sai 'fora' e o `podeDesafiar` diz o porquê com a frase dele.
  let indice = ctx.indice || null;
  if (!indice) {
    const lidoIndice = await carregarIndice(ctx.buscarAulas || ((url) => fetch(url)));
    indice = lidoIndice.ok ? lidoIndice.dados : null;
  }

  // O ARQUIVO DAS AULAS, não o índice: `podeDesafiar` e `montarDesafio` pedem as
  // aulas com `exercicio` e `n`, e só o JSON por estação os tem (aulas.js:222).
  const lido = await carregarAulas(slug, ctx.buscarAulas);
  const aulas = lido.ok ? lido.dados.aulas || [] : [];

  const medida = eixosDaEstacao(id, { estudo, cartoes: arquivo, indice, progresso, hoje });

  /**
   * Quantos cartões a pessoa ESCREVEU nesta estação — o número que entra no
   * carimbo ao lado das aulas.
   *
   * A definição do core (`pertence`, core/desafio.js:60, privada) aceita duas
   * rotas: o id da estação, ou, quando o id falta, a lista das aulas. Aqui o id
   * NUNCA falta — é o do catálogo, acabado de ler —, então a pergunta direta é a
   * mesma do core por este caminho, e `criarCartao` recusa cartão sem estação
   * (core/cartoes.js:230), o que fecha a outra rota. Contar aqui com um filtro
   * próprio é a conta de pintura do `resumo`; decidir o que é «da estação» é do
   * sorteio, e ele continua no core.
   */
  function cartoesDaEstacao() {
    return Object.values(arquivo.cartoes).filter((c) => c && c.estacao === id).length;
  }

  // O SORTEIO, uma vez por montagem. A semente é `id:hoje`, então recarregar no
  // meio do desafio, ou abrir a tela amanhã, não baralha outra vez no mesmo dia
  // (e um dia novo é um desafio novo, que é o que o desenho diz). Ele também é o
  // número do `convite`: a tela promete o tamanho do sorteio LIDO do sorteio,
  // nunca um palpite sobre a regra de 10 a 15 do core.
  let sorteio = null;
  const draw = () => (sorteio ||= montarDesafio(arquivo, id, aulas, hoje, `${id}:${hoje}`));

  let sessao = lerSessao(storage, id);

  // ── os desenhos dos quatro estados ───────────────────────────────────────
  function estado(children) {
    const caixa = el(doc, `${CLASSE}-estado`, undefined, 'section');
    for (const c of children) if (c) caixa.append(c);
    corpo.append(caixa);
  }

  function aindaNaoExistente() {
    estado([
      el(doc, `${CLASSE}-titulo`, F.naoEstaNoMapa, 'h1'),
      link(doc, PRIMARIO, F.voltarAoMapa, hrefDe({ tela: 'jornada' })),
    ]);
  }

  /** O «ainda não»: a frase é toda do núcleo, e o que fazer antes também. */
  function aindaNao(porque) {
    estado([
      el(doc, `${CLASSE}-titulo`, T.titulo(nome), 'h1'),
      el(doc, `${CLASSE}-nota`, porque, 'p'),
      link(doc, PRIMARIO, T.voltar(nome), hrefDe({ tela: 'estacao', slug })),
    ]);
  }

  function abertura() {
    const b = botao(doc, PRIMARIO, T.comecar);
    b.addEventListener('click', comecar);
    estado([
      el(doc, `${CLASSE}-titulo`, T.titulo(nome), 'h1'),
      el(doc, `${CLASSE}-sub`, T.convite(draw().cartoes.length), 'p'),
      b,
    ]);
  }

  function cartao() {
    const idCartao = sessao.cartoes[Object.keys(sessao.respostas).length];
    const c = arquivo.cartoes[idCartao];
    // Um id do sorteio que não está mais no arquivo (a pessoa importou outra
    // viagem entre duas abas, ou apagou o cartão): repinta do zero, e não um
    // cartão com a frente `undefined`.
    if (!c) {
      sessao = null;
      try {
        storage.removeItem(SESSAO_KEY);
      } catch { /* nada a apagar */ }
      desenhar();
      return;
    }
    corpo.append(desenhaCartao(doc, {
      cartao: c,
      origem: c.n === null || c.n === undefined ? R.origemEstacao(nome) : R.origemAula(c.n, nome),
      posicao: R.posicao(Object.keys(sessao.respostas).length + 1, sessao.cartoes.length),
      visto: sessao.visto,
      semConfianca: true,
      mostrar: mostrarResposta,
      responder,
    }));
  }

  /**
   * O FIM: os dois vereditos, cada um com a frase do que o núcleo registrou.
   *
   * No aprovado a frase é `fraseDaDominada` sobre o carimbo GRAVADO — a mesma
   * que a caderneta vai dizer amanhã. Uma frase contada na tela seria o desafio
   * tendo duas definições do mesmo número, e é ela que a pessoa lê no Perfil.
   */
  /**
   * O FIM (S18c-2, item 3). Duas trocas de tipo, nenhuma de palavra:
   *
   * · o h1 sai com `${CLASSE}-frente`, a classe da pergunta do cartão. É o
   *   momento da entrega — a pessoa acabou de fechar dez cartões de uma vez e o
   *   veredito é a maior coisa da tela; `revisar-titulo` (--tipo-titulo) deixava
   *   o h1 do fim menor que a frente do cartão que ela acabou de responder, e a
   *   frase do carimbo, que é o prêmio, saía miúda ao lado. `--tipo-estacao` é o
   *   maior tipo da casa e é o tamanho do que se entrega (mesma decisão da placa
   *   da estação na folha). Ela também já está na lista de :focus-visible do
   *   revisar.css, então o foco do fim chega com o anel da casa sem um pixel de
   *   CSS novo;
   * · a frase sai com `${CLASSE}-sub` (o corpo), não `${CLASSE}-nota` (a nota):
   *   `fraseDaDominada` é o fato medido, e fato medido não se escreve no tipo
   *   que a casa reserva para a linha de rodapé.
   *
   * `focar('frente')` acompanha a classe (abaixo, em `aplicar`) — trocar a classe
   * e deixar o foco pedindo `-titulo` seria o fim sem foco nenhum.
   */
  function fim(resultado, aplicacao) {
    const children = [
      el(doc, `${CLASSE}-frente`,
        resultado.aprovado ? T.aprovadoTitulo : T.reprovadoTitulo, 'h1'),
      el(doc, `${CLASSE}-sub`,
        resultado.aprovado ? fraseDaDominada(aplicacao.dominada) : aplicacao.recado, 'p'),
      link(doc, PRIMARIO, T.voltar(nome), hrefDe({ tela: 'estacao', slug })),
    ];
    // S18c-2: o carimbo nasce no Perfil, não aqui. Depois do aprovado a pergunta
    // é «onde é que isso ficou escrito», e um link discreto responde sem uma tela
    // nova. Ele vem DEPOIS do voltar: o voltar é o caminho de quem fecha o
    // desafio, e dois caminhos do mesmo peso no mesmo veredito dariam à tela duas
    // respostas para a mesma hora. No reprovado ele não existe — não há carimbo
    // para ir ver.
    if (resultado.aprovado) {
      children.push(link(doc, `${CLASSE}-discreto`, T.verCaderneta, hrefDe({ tela: 'perfil' })));
    }
    estado(children);
  }

  /**
   * Devolve o foco ao CONTEÚDO que a ação trouxe — a mesma lei de revisar.js:300
   * e o mesmo motivo: cada pintura troca a árvore inteira, e um nó removido leva
   * o foco embora para o topo do documento. Frente, verso e o h1 do fim: os três
   * alvos que existem aqui, nenhum botão (focar a ação que acabou de rodar
   * convida a rodá-la duas vezes, e aqui a segunda gravaria outra resposta).
   */
  function focar(classe) {
    const alvo = corpo.querySelector(`.${CLASSE}-${classe}`);
    if (!alvo) return;
    alvo.setAttribute('tabindex', '-1');
    alvo.focus?.({ preventScroll: true });
  }

  function desenhar() {
    if (sessao?.cartoes.length && Object.keys(sessao.respostas).length < sessao.cartoes.length) {
      return cartao();
    }
    const p = podeDesafiar({ id, estagio: medida.estagio }, estudo, arquivo, aulas, hoje);
    if (!p.pode) return aindaNao(p.porque);
    if (sessao?.cartoes.length) {
      // Toda resposta dada e nenhuma correção aplicada: a sessão ainda está na
      // chave porque algo estourou no meio. Corrigir e gravar agora — o carimbo
      // não se perde por um fechamento de aba.
      return aplicar(corrigirDesafio({ cartoes: sessao.cartoes }, sessao.respostas));
    }
    return abertura();
  }

  function pintar(destino) {
    corpo.textContent = '';
    desenhar();
    if (destino) focar(destino);
  }

  // ── os gestos ────────────────────────────────────────────────────────────
  function comecar() {
    const ids = draw().cartoes;
    if (!ids.length) {
      // O sorteio vazio não é erro de tela: é o `podeDesafiar` dizendo de novo,
      // com a frase dele. Nunca um desafio de zero cartões.
      sessao = null;
      return pintar('titulo');
    }
    sessao = { estacao: id, cartoes: ids, respostas: {}, visto: false };
    gravarSessao(storage, sessao);
    pintar('frente');
  }

  function mostrarResposta() {
    sessao.visto = true;
    gravarSessao(storage, sessao);
    pintar('verso');
  }

  function responder(nota) {
    const idCartao = sessao.cartoes[Object.keys(sessao.respostas).length];
    // Uma resposta por cartão, na ordem do sorteio. Não há «voltar um cartão»
    // aqui, e por isso a mesma posição não pode ser escrita duas vezes: a
    // segunda sobrescreveria a primeira e o número do fim mentiria.
    sessao.respostas[idCartao] = nota;
    sessao.visto = false;
    if (Object.keys(sessao.respostas).length >= sessao.cartoes.length) {
      return aplicar(corrigirDesafio({ cartoes: sessao.cartoes }, sessao.respostas));
    }
    gravarSessao(storage, sessao);
    return pintar('frente');
  }

  /** Corrige, grava os dois arquivos, apaga a sessão e pinta o veredito. */
  function aplicar(resultado) {
    const aplicacao = aplicarResultado(progresso, arquivo, id, resultado,
      { aulas: aulas.length, cartoes: cartoesDaEstacao() }, hoje);
    salvarViagem(storage, aplicacao.progresso);
    try {
      storage.setItem(CARTOES_KEY, serializarCartoes(aplicacao.cartoes));
    } catch {
      // Sem escrever os cartões, o reprovado não volta para hoje na próxima
      // abertura. O veredito aparece mesmo assim: mesmo silêncio da Revisar.
    }
    try {
      storage.removeItem(SESSAO_KEY);
    } catch { /* nada a apagar */ }
    sessao = null;
    corpo.textContent = '';
    fim(resultado, aplicacao);
    // S18c-2: o h1 do fim mudou de classe (o tipo da entrega), e o foco acompanha
    // a classe — pedir `titulo` aqui deixaria o veredito sem foco nenhum.
    focar('frente');
  }

  pintar();
  return { desmontar: () => {}, rotulo: T.titulo(nome) };
}
