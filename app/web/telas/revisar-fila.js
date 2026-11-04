// Projeto Atlas — os QUATRO ESTADOS da fila de cartões (S15b, 04/11/2026).
//
// POR QUE EXISTE: o `web/telas/revisar.js` chegou a 504 linhas, e a regra 15 do
// design/v2/00-regras.md manda dividir arquivo de código além de 400 linhas pela
// responsabilidade. A responsabilidade dele é uma só — o ESTADO da sessão (o que
// está devido, qual cartão, se o verso foi visto, o arquivo do antes/depois) — e
// os desenhos dos estados são outra. Aqui mora só o desenho; quem chama passa o
// `doc` e os números já calculados.
//
// O MESMO MOTIVO do aulas-pedacos.js (S13b): a fila e a auditoria do teclado
// precisam das mesmas classes e dos mesmos rótulos, e dois arquivos escrevendo a
// mesma tela de dois jeitos é o defeito que a regra 9 nomeia.
//
// REGRAS DESTE ARQUIVO:
//   · monta DOM, não calcula. A fila é `cartoesDevidos`, o agendamento é
//     `revisarCartao`, o placar é `resumoDaSessao`, o prazo é o `devidoEm` do
//     núcleo. Nada de calendário, de fila ou de memória aqui.
//   · roda no node e no navegador, sem `document` global: quem chama passa o `doc`
//     (a casa injeta documento e janela desde a S10c; o mini-DOM dos testes é um
//     documento que não é o global).
//   · nenhuma palavra de tela escrita aqui: toda frase sai de `core/textos.js`,
//     bloco `revisar`, e todo número vem por argumento.
//   · o recheio do primário são DUAS classes, e é por isso que a régua conta as
//     duas: `botao-primario` é o que o `metro.css` pinta, `revisar-primario` é o
//     que a trava lê. Uma sem a outra é o defeito da S20a-2 (cheio sem classe).
import { LIMITE_FILA, minutosDaFila } from '../../core/cartoes.js';
import { hrefDe } from '../../core/rotas.js';
import { revisar as T } from '../../core/textos.js';

/** Prefixo de classe da aba. Único — o CSS é um, e duas definições divergem. */
export const CLASSE = 'revisar';

export function el(doc, classe, texto, tag) {
  const no = doc.createElement(tag || 'div');
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

export function botao(doc, classe, texto, attrs) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texto;
  for (const k of Object.keys(attrs || {})) b.setAttribute(k, String(attrs[k]));
  return b;
}

export function link(doc, classe, texto, href) {
  const a = doc.createElement('a');
  a.className = classe;
  // setAttribute, não a propriedade — a regra da casa já escrita em
  // web/telas/perfil.js:61. `a.href = '#/x'` devolve a URL ABSOLUTA quando lida
  // pela propriedade, e é o ATRIBUTO que a rota compara e que o teste lê.
  a.setAttribute('href', href);
  a.textContent = texto;
  return a;
}

/** O recheio do primário, nas duas classes. Um só por estado, e a trava conta. */
const PRIMARIO = `${CLASSE}-primario botao botao-primario`;

/** Botão primário que é AÇÃO (ouve o clique em si, como o da folha). */
function acao(doc, texto, aoClicar) {
  const b = botao(doc, PRIMARIO, texto);
  b.addEventListener('click', aoClicar);
  return b;
}

/**
 * Botão do MESMO peso dos pares (confiança, Errei/Lembrei): sem recheio de
 * primário, porque nenhum dos dois é «o passo» e a cor de um primário faria o
 * Errei parecer o caminho. A CLASSE é a do CSS — `revisar.css:184` e `:216` já
 * desenham os dois — e por isso não se acrescenta `botao`: a régua dos focáveis
 * olha a TAG, não a classe, e classe que o CSS não conhece é roupa invisível.
 */
function par(doc, classe, texto, attrs, aoClicar) {
  const b = botao(doc, classe, texto, attrs);
  b.addEventListener('click', aoClicar);
  return b;
}

/**
 * J3.1 — a ABERTURA: quantos cartões estão devidos, quanto tempo eles custam e o
 * único passo que a pessoa pode dar agora.
 *
 * Os dois números da frase têm origens diferentes, e é de propósito: `total` é a
 * fila inteira e `mostra` é o que ela vai ver hoje (o corte do LIMITE_FILA).
 * Prometer o tempo da fila inteira seria espantar. `naSessao` é a QUANTIDADE que
 * passou pelo corte (não o array): quem chama já tem a conta do núcleo.
 */
export function desenhaAbertura(doc, { total, naSessao, comecar }) {
  const caixa = el(doc, `${CLASSE}-estado`, undefined, 'section');
  caixa.append(el(doc, `${CLASSE}-titulo`, T.hoje(total, minutosDaFila(naSessao)), 'h1'));
  if (total > LIMITE_FILA) {
    caixa.append(el(doc, `${CLASSE}-corte`, T.corte(LIMITE_FILA), 'p'));
  }
  caixa.append(acao(doc, T.comecar, comecar));
  return caixa;
}

/**
 * J3.2 — o CARTÃO. Antes do pedido, a frente e a confiança; depois, o verso e as
 * duas respostas.
 *
 * O VERSO NÃO EXISTE NA ÁRVORE antes do «Mostrar a resposta»: lembrar primeiro é
 * o método, e um verso escondido por CSS ainda seria lido por leitor de tela e
 * apanhado por quem inspeciona. Esconder é não desenhar.
 *
 * Errei e Lembrei têm o MESMO peso e nenhuma cor de certo: errar aqui não custa
 * nada, só reagenda.
 */
export function desenhaCartao(doc, { cartao, origem, posicao, visto, confianca, escolher, mostrar, responder }) {
  const caixa = el(doc, `${CLASSE}-estado`, undefined, 'section');

  const cabeca = el(doc, `${CLASSE}-cabeca`);
  cabeca.append(el(doc, `${CLASSE}-origem`, origem, 'p'));
  // "1 de 6" é POSIÇÃO, não placar: diz onde a pessoa está, nunca quantos ela
  // acertou (design/README §9).
  cabeca.append(el(doc, `${CLASSE}-posicao`, posicao, 'p'));
  caixa.append(cabeca);

  caixa.append(el(doc, `${CLASSE}-frente`, cartao.frente, 'h1'));
  caixa.append(el(doc, `${CLASSE}-convite`, T.tentarLembrar, 'p'));

  // A confiança é OPCIONAL: três escolhas do mesmo peso, nenhuma obrigatória.
  // Sem escolha, `confianca` chega nula ao núcleo — dado honesto sobre o que a
  // pessoa não quis dizer, e não «chute» chutado no lugar.
  const grupo = el(doc, `${CLASSE}-confianca`, undefined, 'div');
  grupo.setAttribute('role', 'group');
  grupo.setAttribute('aria-label', T.seguro);
  grupo.append(el(doc, `${CLASSE}-confianca-pergunta`, T.seguro, 'p'));
  for (const chave of Object.keys(T.confiancas)) {
    grupo.append(par(doc, `${CLASSE}-confianca-opcao`, T.confiancas[chave], {
      'data-confianca': chave,
      'aria-pressed': confianca === chave ? 'true' : 'false'
    }, () => escolher(chave)));
  }
  caixa.append(grupo);

  if (!visto) {
    caixa.append(acao(doc, T.mostrarResposta, mostrar));
    return caixa;
  }

  // O verso é citação da própria pessoa (mesma decisão da anotação na S8): ela
  // escreveu a resposta, o Atlas só a devolve no dia certo. Os dois ramos do
  // `visto` vivem NESTA função: um estado da fila é uma tela desenhada, e partir
  // o cartão em dois desenhistas faria a segunda metade existir sem a primeira.
  caixa.append(el(doc, `${CLASSE}-verso`, cartao.verso, 'blockquote'));
  const acoes = el(doc, `${CLASSE}-respostas`);
  for (const nota of ['errei', 'lembrei']) {
    acoes.append(par(doc, `${CLASSE}-resposta`, T[nota], { 'data-resposta': nota }, () => responder(nota)));
  }
  caixa.append(acoes);
  return caixa;
}

/**
 * J3.3 — o FIM: os dois números do núcleo e as aulas que passaram a «lembrada»
 * nesta sessão pela primeira vez.
 *
 * `revisados`, `lembrados` e `prazo` saem de `resumoDaSessao`; `lembradas` chega
 * como os RÓTULOS já prontos de `aulasLembradasNaSessao`. Quem nomeia uma aula é
 * a tela, porque é ela que tem o catálogo; quem DECIDE o que é «lembrada pela
 * primeira vez» é o núcleo, e decidir isso aqui seria ter duas definições do
 * fato. Aqui só se empilha.
 */
export function desenhaFim(doc, { revisados, lembrados, prazo, lembradas }) {
  const caixa = el(doc, `${CLASSE}-estado`, undefined, 'section');
  caixa.append(el(doc, `${CLASSE}-titulo`, T.fim(revisados, lembrados), 'h1'));
  if (prazo) caixa.append(el(doc, `${CLASSE}-sub`, T.proximaRevisao(prazo), 'p'));
  for (const rotulo of lembradas) {
    caixa.append(el(doc, `${CLASSE}-lembrada`, T.aulaLembrada(rotulo), 'p'));
  }
  caixa.append(link(doc, PRIMARIO, T.voltarJornada, hrefDe({ tela: 'jornada' })));
  return caixa;
}

/**
 * O estado EM DIA: há cartões, nenhum para hoje. A próxima data, a linha sem
 * cobrança e o método em UMA frase.
 *
 * É aqui — e só aqui — que o método se explica. A caixa «Como funciona» com os
 * três passos numerados saiu com a S8: dentro de uma sessão ela era cobrança no
 * meio do trabalho, e fora dela cabia numa linha.
 */
export function desenhaEmDia(doc, { proximaData }) {
  const caixa = el(doc, `${CLASSE}-estado`, undefined, 'section');
  caixa.append(el(doc, `${CLASSE}-titulo`, T.emDia, 'h1'));
  if (proximaData) caixa.append(el(doc, `${CLASSE}-sub`, T.proximaEm(proximaData), 'p'));
  caixa.append(el(doc, `${CLASSE}-nota`, T.semPressao, 'p'));
  caixa.append(el(doc, `${CLASSE}-metodo`, T.metodo, 'p'));
  caixa.append(link(doc, PRIMARIO, T.voltarJornada, hrefDe({ tela: 'jornada' })));
  return caixa;
}

/**
 * Ainda não há CARTÃO nenhum no aparelho. Não é «nenhuma revisão de hoje» — é «a
 * fila ainda não começou», e ela começa no fechamento de uma aula (J2, passo 3).
 *
 * A saída é o destino, não uma ação: um link para as aulas da estação que o
 * `resumoDaViagem` já chamou de próxima. Sem estação para onde ir (viagem em
 * Terminal), volta à Jornada — uma frase de «comece» sem caminho é o estado com
 * texto e sem saída que a régua de estados nomeia.
 */
export function desenhaSemCartao(doc, { proxima }) {
  const caixa = el(doc, `${CLASSE}-estado`, undefined, 'section');
  caixa.append(el(doc, `${CLASSE}-titulo`, T.comecaNoCartao, 'h1'));
  const href = proxima
    ? hrefDe({ tela: 'estacao', slug: proxima.slug, painel: 'aulas' })
    : hrefDe({ tela: 'jornada' });
  caixa.append(link(doc, PRIMARIO, proxima ? T.proximaAula : T.voltarJornada, href));
  return caixa;
}
