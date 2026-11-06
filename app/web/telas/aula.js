// Projeto Atlas — a PÁGINA DA AULA (S14b1, 04/11/2026).
//
// POR QUE EXISTE: até aqui o toque na folha ia direto ao YouTube e o Atlas só
// sabia que a aula fora aberta. Esta página é a CASA da aula dentro do Atlas: o
// lugar para onde a pessoa VOLTA depois do vídeo, e é nela que a S14b2 fecha a
// aula. Sem este lugar, "fechar a aula" não teria onde morar.
//
// O FLUXO MUDOU DE DESTINO, NÃO DE GESTO: a folha e a lista apontam para cá
// (link interno), e daqui se sai para o YouTube (`target="_blank"`, o Atlas não
// é dono da aba de ninguém). O clique que GRAVA a abertura é só o de assistir:
// um link interno não pode marcar aula como aberta, senão o progresso subiria
// só de ler título (`ligarAberturaDeAula` ignora endereço que começa com '#').
//
// REGRAS deste arquivo (as mesmas que a casa cobra das outras telas):
//   · monta DOM, não calcula. As marcas de pausa vêm de `pausasDaAula`, o tempo
//     escrito de `marcaDeTempo`, a duração de `duracaoLegivel` (todos em
//     core/aulas.js) e a linha da estação de `fatosDaEstacao` (core/viagem.js).
//   · nenhuma frase digitada: `aula`, `fechamento`, `aulas` e `comValores` vêm
//     de core/textos.js (regra 7).
//   · o que a folha e a lista também mostram (o selo da linha, o endereço do
//     vídeo, o gravador da abertura) vem de web/aulas-pedacos.js — regra 9.
//   · document e window entram pelo contexto (S10c); importar não monta nada.
//
// A CLASSE DA LINHA NA RAIZ É OBRIGATÓRIA, NÃO É ENFEITE (S13e, repetido aqui
// pela segunda tela fora do metrô): `--cor` é declarada por `.l1`…`.l7`
// (web/metro.css) e chega por HERANÇA. Sem `lN` na raiz, o `.botao.botao-primario`
// do Assistir recebe `background: var(--cor)` vazio — texto `--superficie` sobre
// o fundo da página, 1,1:1, e a suíte de node não pinta nada. A trava é no DOM.
//
// A VOLTA DA ABA É O GESTO DESTA TELA (item 2): quem volta do vídeo tem de
// achar o fechamento sem procurar. A página rola até a seção e põe o foco no
// h2 dela. Só quando o clique que levou embora FOI o Assistir: trocar de aba por
// conta própria não pode mover a leitura de ninguém.
import { duracaoLegivel, marcaDeTempo, pausasDaAula, playlistDoRecurso } from '../../core/aulas.js';
import { hrefDe } from '../../core/rotas.js';
import { fatosDaEstacao } from '../../core/viagem.js';
import { comValores, aulas as A, aula as U, fechamento as F } from '../../core/textos.js';
import { carregarAulas } from '../aulas-dados.js';
import {
  acaoPularAula,
  agoraLocal,
  estudoDoStorage,
  hrefVideo,
  ligarAberturaDeAula,
  ligarPuloDeAula,
  paginaDaAula,
  seloLinha,
} from '../aulas-pedacos.js';
// S14b2 commit 2: O FECHAMENTO. As contas, os tetos e as regras moram no core;
// esta tela monta, obedece e repara a si mesma quando a aula muda de estado.
import {
  CARTOES_KEY,
  LIMITE_FACE,
  cartoesDaAula,
  cartoesDevidos,
  criarCartao,
  diaSeguinte,
  lerCartoes,
  minutosDaFila,
  modelosDeFrente,
  serializarCartoes,
} from '../../core/cartoes.js';
import {
  ESTUDO_KEY,
  chaveRascunho,
  estadoDaAula,
  estudarAula,
  lerEstudo,
  lerRascunho,
  serializarEstudo,
  serializarRascunho,
} from '../../core/estudo.js';

/** ARBITRADO da tela: até 3 cartões por aula — o teto a que o "Outro cartão" obedece. */
const LIMITE_CARTOES = 3;

/**
 * Os 2 minutos do passo 1 (design/v3 J2: tentar lembrar ANTES de conferir).
 * É tempo de TETO, não de portão: o relógio nunca bloqueia envio nenhum, e o que
 * ele compra é o efeito medido da recordação com retorno. O valor mora aqui e não
 * no CSS porque quem anuncia o fim é o JS (texto `fechamento.tempo`).
 */
const SEGUNDOS_RELOGIO = 120;

/** Id de um cartão novo: `crypto.randomUUID` quando existir; senão o relógio com
 *  um sufixo que o mesmo milissegundo não repete — o que torna segura a recusa de
 *  id repetido em core/cartoes.js. */
function novoId(win) {
  const c = win?.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Percorre a árvore abaixo de um nó. O app não importa `tests/hdom.js` (o
 *  andador é do dublê) e o navegador tem `querySelectorAll`, que não responde às
 *  duas perguntas da repintura ("todo nó com esta classe", "todo campo dentro
 *  disto") sem um seletor que a casa proíbe aqui. */
function descender(raiz, pred, saida = []) {
  if (!raiz) return saida;
  if (pred(raiz)) saida.push(raiz);
  for (const filho of raiz.children || []) descender(filho, pred, saida);
  return saida;
}

function campoDe(raiz, nome) {
  return descender(raiz, (x) => x.getAttribute?.('data-campo') === nome)[0] || null;
}

function rotuloDe(raiz, texto) {
  return descender(raiz, (x) => x.tag === 'label' && x.textContent === texto)[0] || null;
}

function editoresDe(raiz) {
  return descender(raiz, (x) => x.classList?.contains('fechamento-cartao'));
}

const CLASSE = 'aula';

function no(doc, tag, classe, attrs) {
  const n = doc.createElement(tag);
  if (classe) n.className = classe;
  for (const chave of Object.keys(attrs || {})) {
    if (chave === 'text') n.textContent = String(attrs[chave]);
    else n.setAttribute(chave, String(attrs[chave]));
  }
  return n;
}

/**
 * As três partes de sempre quando o endereço pede uma aula que não está lá.
 *
 * É o formato que a casa já usa (`aulas.semAulas`, `aulas.erro`): o que falhou,
 * por quê, e o que fazer agora. O número da estação é lido do arquivo, nunca
 * chutado — "/aula/999" numa estação de 93 responde "A estação tem 93 aulas."
 */
function avisoAulaFora(doc, { total, estacao, slug }) {
  const caixa = no(doc, 'div', 'aulas-erro');
  // S14b2/item 0: a parte um não mora mais aqui — ela É o h1 da página (quem
  // chama põe o título). Restam o porquê e a saída, e a frase não se repete.
  caixa.append(no(doc, 'p', 'aulas-erro-dois', { text: U.naoExiste.parteDois(total) }));
  // S14b1: a saída de uma aula que não existe é a LISTA, não a aula 1. Mandar a
  // pessoa para "Aula 1" seria abrir um vídeo que ela não pediu, quando o que ela
  // pediu (a aula 999) não existe — e o link diz "Ver as aulas de X".
  // `folha-caminho-link` (web/folha.css:449) é o SUBLINHADO DA CASA para link de
  // navegação. O Chrome do Claude (04/11/2026) mostrou a única saída do /aula/999
  // desenhada como texto comum: numa página de erro, não ter cara de link é não
  // ter saída. Reusar a classe em vez de escrever `text-decoration` aqui é a
  // regra 9 — e é por isso que a trava deste item confere a CLASSE, não o CSS.
  caixa.append(no(doc, 'a', 'aula-nav-antes folha-caminho-link', {
    href: hrefDe({ tela: 'estacao', slug, painel: 'aulas' }),
    rel: 'noopener',
    text: U.naoExiste.voltarParaAulas(estacao)
  }));
  return caixa;
}

/** O selo da linha com o nome da estação ao lado — o mesmo círculo da folha. */
function faixaDaLinha(doc, linha, estacao) {
  const faixa = no(doc, 'div', 'aula-selo folha-cabecalho');
  faixa.append(seloLinha(doc, linha));
  faixa.append(no(doc, 'p', 'aula-linha folha-rotulo', { text: comValores.linhaComEstacao(linha, estacao) }));
  return faixa;
}

/**
 * O bloco das pausas sugeridas.
 *
 * Cada marca é um link para o MESMO vídeo, parado naquele segundo
 * (`&t=480s`), aberto em aba nova: a pessoa para o vídeo, respira, e volta.
 *
 * A frase `fechamento.pausas(marcas)` não é escrita como texto visível: ela é o
 * `aria-label` da lista, que é exatamente o que ela descreve ("Pausas sugeridas:
 * 8:00 · 16:00 · 24:00"). Duplicá-la na tela seria a mesma frase em dois lugares
 * de uma janela de 375 px, e o convite logo abaixo já diz o que fazer com elas.
 */
function blocoDePausas(doc, { marcas, aula, playlist }) {
  const caixa = no(doc, 'div', 'aula-pausas-caixa');
  const lista = no(doc, 'ul', 'aula-pausas', {
    'aria-label': F.pausas(marcas.map(marcaDeTempo))
  });
  for (const segundos of marcas) {
    const item = no(doc, 'li', 'aula-pausa-item');
    item.append(no(doc, 'a', 'aula-pausa', {
      href: `${hrefVideo(aula, playlist)}&t=${segundos}s`,
      rel: 'noopener',
      target: '_blank',
      'data-pausa': String(segundos),
      text: marcaDeTempo(segundos)
    }));
    lista.append(item);
  }
  caixa.append(lista);
  caixa.append(no(doc, 'p', 'aula-pausas-convite', { text: F.pausaConvite }));
  return caixa;
}

/** "Origem: Aula 3 · Circuitos Digitais" — de onde o cartão veio. */
function linhaOrigem(doc, n, estacao) {
  return no(doc, 'p', 'fechamento-origem apoio', { text: F.origem(n, estacao) });
}

/**
 * O primário da conclusão (itens 6 e 7): a próxima aula, e na última da estação,
 * a lista dela. O item 6 nomeia os dois destinos, e o segundo não é decorativo —
 * fechar a aula 93 sem porta de saída deixava a página com o texto do feito e
 * nada em que tocar, com a navegação vizinha já sem "próxima".
 *
 * `aula` é lido do arquivo: "Próxima" inventada é o mesmo defeito do item 0
 * desenhado um passo adiante. A frase do fim mora hoje em `aula.naoExiste
 * .voltarParaAulas` (textos.js:747) — reusar em vez de reescrever "Ver as aulas
 * de X" é a regra 9, e a pergunta de quem julga: essa frase pertence a um erro?
 */
function botaoProxima(doc, { aulas, n, total, slug, estacao }) {
  const proxima = n < total ? aulas.find((a) => Number(a.n) === n + 1) : null;
  if (proxima) {
    return no(doc, 'a', 'botao botao-primario fechamento-proxima', {
      href: paginaDaAula(slug, n + 1),
      rel: 'noopener',
      'data-proxima': String(n + 1),
      text: F.proxima(proxima.n, proxima.titulo, duracaoLegivel(proxima.duracaoS))
    });
  }
  return no(doc, 'a', 'botao botao-primario fechamento-fim', {
    href: hrefDe({ tela: 'estacao', slug, painel: 'aulas' }),
    rel: 'noopener',
    'data-fim-estacao': 'sim',
    text: U.naoExiste.voltarParaAulas(estacao)
  });
}

/**
 * A frase do dia de amanhã: "Por hoje está bom. Amanhã: 4 cartões, ~2 min."
 * O total lido do arquivo de cartões (não só os gravados agora), porque a fila
 * de amanhã é o que a pessoa vai ter de fazer, e incluiria as estações anteriores.
 * `diaSeguinte` e `minutosDaFila` são do core — a tela não sabe nem calcula nada.
 */
function avisoDeAmanha(pega, hoje) {
  const arquivo = lerCartoes(pega(CARTOES_KEY));
  const devidos = cartoesDevidos(arquivo, diaSeguinte(hoje));
  if (!devidos.length) return '';
  return F.porHoje(devidos.length, minutosDaFila(devidos.length));
}

/**
 * Limpa a linha de erro abaixo de qualquer nó. VEIO DO FECHAMENTO (S18c-3): a
 * mesma varredura, o mesmo par de atributos, sobre o nó que quem chama der.
 * Morar dentro de `blocoFechamento` obrigaria o bloco de "escrever mais" a ter
 * uma segunda implementação — e erro desenhado de dois jeitos numa mesma página
 * é a regra 9 da casa pedindo para ser quebrada.
 */
function limparErrosEm(pai) {
  for (const n of descender(pai, (x) => x.classList.contains('fechamento-erro'))) n.remove();
  for (const n of descender(pai, (x) => x.tag === 'textarea')) {
    n.removeAttribute('aria-invalid');
    n.removeAttribute('aria-describedby');
  }
}

/**
 * A frase de erro vai JUNTO do campo, apontada por `aria-describedby`. Mesma
 * forma do fechamento: o id é derivado do campo, e o `<p>` cai no `<div>` que o
 * segura. `pai` é a caixa onde os campos moram.
 */
function marcarErroEm(doc, pai, campo, texto) {
  if (!campo) return null;
  // NÃO limpa os erros alheios: quem valida vários campos limpa uma vez no
  // começo e marca cada ofensor depois. Limpar aqui deixaria na tela só o último
  // erro de três cartões errados — a pessoa corrigiria um e veria aparecer o
  // próximo, em três voltas.
  const id = `${campo.getAttribute('id') || 'campo'}-erro`;
  const p = erroDoCampo(doc, texto, id);
  const dono = descender(pai, (x) => x.tag === 'div' && x.children.includes(campo))[0];
  (dono || campo.parentNode)?.append?.(p);
  campo.setAttribute('aria-invalid', 'true');
  campo.setAttribute('aria-describedby', id);
  return p;
}

/**
 * A VISTA DEPOIS DO ESTUDO (itens 6 e 7): o que aparece no lugar do formulário
 * quando a aula já foi fechada — a frase, os cartões em leitura, a origem, a
 * próxima e a conta de amanhã.
 *
 * É UMA função para os dois casos ("acabei de fechar" e "voltei numa aula já
 * fechada") porque a diferença entre eles é uma frase, não uma tela. Dois blocos
 * parecidos divergiriam em seis meses, e o app teria dois destinos de fim de aula.
 */
function vistaConcluida(doc, { n, estacao, aulas, total, slug, cartoes, fraseStatus, aviso, escrever }) {
  const caixa = no(doc, 'div', 'fechamento-feito');
  const frase = no(doc, 'p', 'fechamento-feito-frase', { text: fraseStatus });
  // S18c-3 (item 1): o destino do foco depois de guardar um cartão novo. É o mesmo
  // truque do `aula-fim-titulo` logo acima — `tabindex="-1"` fora da ordem de tab,
  // para a frase poder receber o foco sem virar uma parada a mais no teclado.
  frase.setAttribute('tabindex', '-1');
  caixa.append(frase);
  for (const c of cartoes) {
    const leitura = no(doc, 'div', 'fechamento-leitura');
    leitura.append(no(doc, 'p', 'fechamento-leitura-frente', { text: c.frente }));
    leitura.append(no(doc, 'p', 'fechamento-leitura-verso', { text: c.verso }));
    caixa.append(leitura);
  }
  if (cartoes.length) caixa.append(linhaOrigem(doc, n, estacao));
  // O convite para escrever mais um cartão, depois dos cartões em leitura e antes
  // do primário: a conclusão continua terminando na Próxima.
  if (escrever) caixa.append(blocoEscreverMais(doc, escrever));
  const proximo = botaoProxima(doc, { aulas, n, total, slug, estacao });
  if (proximo) caixa.append(proximo);
  if (aviso) caixa.append(no(doc, 'p', 'fechamento-por-hoje apoio', { text: aviso }));
  return caixa;
}

/** O campo de texto do fechamento: um <label for> + um <textarea>. */
function campoTexto(doc, { id, rotulo, linhas, valor, nome, extra }) {
  const caixa = no(doc, 'div', 'fechamento-campo');
  const etiqueta = no(doc, 'label', 'fechamento-pergunta', { text: rotulo });
  etiqueta.setAttribute('for', id);
  // `htmlFor` como PROPRIEDADE além do atributo: é assim que a régua `leitor 6`
  // da casa acha o nome do campo no node (ela lê `label.htmlFor`, não o atributo),
  // e no navegador os dois caminhos apontam para o mesmo campo.
  etiqueta.htmlFor = id;
  const campo = no(doc, 'textarea', `fechamento-entrada fechamento-entrada-${nome}`, {
    id,
    rows: String(linhas),
    'data-campo': nome,
    maxlength: String(LIMITE_FACE)
  });
  campo.value = valor || '';
  if (extra) {
    const cabeca = no(doc, 'div', 'fechamento-pergunta-caixa');
    cabeca.append(etiqueta, extra);
    caixa.append(cabeca);
  } else {
    caixa.append(etiqueta);
  }
  caixa.append(campo);
  return { caixa, etiqueta, campo };
}

/**
 * O EDITOR de um cartão: pergunta + resposta, com o erro do próprio editor.
 * Os dois campos andam juntos de propósito: a recusa do núcleo é o PAR (sem verso
 * não há o que conferir) e um erro desenhado longe do campo que falta é um erro
 * que a pessoa procura.
 */
function editorCartao(doc, { base, indice, frente, verso }) {
  const wrap = no(doc, 'div', 'fechamento-cartao');
  wrap.setAttribute('data-cartao', String(indice));
  // OS MODELOS VIVEM AQUI, dentro de cada editor. O pedido diz "acima da
  // Pergunta", e cada cartão tem a sua: um conjunto só no alto da seção
  // obrigaria a tela a ESCOLHER a que cartão o toque se aplica (ao focado? ao
  // primeiro vazio?), regra que não está no desenho. Com modelos por editor o
  // toque só pode significar uma coisa.
  const modelos = no(doc, 'div', 'fechamento-modelos', {
    'aria-label': `Modelos para a ${F.passoCartoes.frente.toLowerCase()} do cartão ${indice + 1}`
  });
  for (const modelo of modelosDeFrente) {
    modelos.append(no(doc, 'button', 'fechamento-modelo', {
      type: 'button', 'data-modelo': modelo, text: modelo
    }));
  }
  const f = campoTexto(doc, { id: `${base}-frente-${indice}`, rotulo: F.passoCartoes.frente, linhas: 2, valor: frente, nome: `frente-${indice}` });
  const v = campoTexto(doc, { id: `${base}-verso-${indice}`, rotulo: F.passoCartoes.verso, linhas: 3, valor: verso, nome: `verso-${indice}` });
  wrap.append(modelos, f.caixa, v.caixa);
  return { wrap, frente: f.campo, verso: v.campo };
}

/** A linha de erro de um campo. É um `p`, não `role="alert"`: um alert por campo
 *  faria a tela falar três vezes num envio errado, e a casa só dá voz a uma
 *  região (o `#anuncio` do casco). */
function erroDoCampo(doc, texto, id) {
  const p = no(doc, 'p', 'fechamento-erro', { text: texto });
  p.setAttribute('id', id);
  return p;
}

/**
 * ESCREVER MAIS UM CARTÃO numa aula já estudada (S18c-3, item 1).
 *
 * POR QUE EXISTE: o desafio exige ao menos dez cartões da estação e a frase do
 * `podeDesafiar` mandava a pessoa «escrever mais 7 ao fechar as aulas» — mas a
 * aula fechada não tem formulário nenhum, só «Estudada em 20/10/2026». Quem
 * terminou a estação com três cartões estava sendo mandado a uma porta que já
 * passou. Este bloco abre a porta de novo sem tocar no estudo: um cartão a mais,
 * quando der vontade, em qualquer aula estudada.
 *
 * AS TRÊS REGRAS QUE DEFINEM O BLOCO:
 * 1. **Secundário, sempre.** O primário da conclusão continua sendo a Próxima
 *    (S14c/item 1): escrever um cartão extra é um convite, não o passo seguinte
 *    obrigatório da viagem.
 * 2. **A validação é o núcleo, não uma cópia.** Mesmo `criarCartao` do fechamento
 *    (linha 501), mesmo `{ok, erro, campo}`, mesma frase de erro colada no campo
 *    que falta. Uma segunda régua aqui divergiria da primeira em seis meses.
 * 3. **Grava pelo caminho de sempre.** `serializarCartoes` + `setItem`, a forma
 *    `{versao, cartoes}` conferida na fonte — pular o serializar deixaria o
 *    `lerCartoes` de amanhã lendo vazio, e a pessoa perdia o cartão sem ver erro.
 *
 * @param {Document} doc
 * @param {object} dados { win, storage, pega, estacao (id), aula, aoGravar }
 * @returns {Element} o contêiner, que se troca a si mesmo ao tocar
 */
function blocoEscreverMais(doc, { win, storage, pega, estacao, aula, aoGravar }) {
  // S18c-4: o nome era `fechamento-mais`, a mesma classe do botão "Outro
  // cartão" (linha 682) — e a folha desenha `.aula .fechamento-mais` com
  // border e align-self, então a CAIXA saía com a moldura do botão dentro da
  // tela, e o "Guardar o cartão" ficava pendurado fora dela. Uma caixa de
  // agrupamento não tem desenho próprio: o nome é outro.
  const caixa = no(doc, 'div', 'fechamento-escrever');

  const abrir = () => {
    caixa.textContent = '';
    const ed = editorCartao(doc, { base: 'mais', indice: 0, frente: '', verso: '' });
    // Os MODELOS do editor (dentro de `editorCartao`, linha 302) precisam de um
    // ouvinte: no fechamento quem os escuta é o `aoClicar` da `section` do
    // formulário, e este bloco vive noutra section. Sem esta linha, cinco botões
    // com cara de botão e nenhum efeito na tela — o defeito que a auditoria de
    // teclado da casa nomeia. Um toque escreve a frase no campo da pergunta.
    // `closest` e não `target`: o `dispatch` do mini-DOM da casa (hdom.js:65)
    // entrega o objeto que o teste passar, e um clique no `<strong>` de dentro do
    // botão de modelo daria um alvo sem o atributo — a tela deixaria de responder
    // por causa do formato do botão, não do ouvinte. No navegador `closest` é a
    // mesma pergunta.
    // OUVINTE EM CADA BOTÃO, não no contêiner. No fechamento quem escuta os
    // modelos é o `aoClicar` da section inteira; aqui o bloco vive noutra section
    // e o evento teria de subir até `caixa`. Delegation exige bubbling, e o
    // `dispatch` do mini-DOM da casa (hdom.js:65) chama só os ouvintes do próprio
    // nó — um ouvinte no pai daria verde para quem escreveu o clique no filho, ou
    // vermelho para a tela certa. Cinco botões, cinco ouvintes: funciona no
    // navegador e mede a mesma coisa no teste.
    for (const botao of ed.wrap.querySelectorAll('[data-modelo]')) {
      botao.addEventListener('click', (evento) => {
        if (typeof evento?.preventDefault === 'function') evento.preventDefault();
        ed.frente.value = `${botao.getAttribute('data-modelo')} `;
        ed.frente.focus?.();
      });
    }
    const guardar = no(doc, 'button', 'botao botao-secundario fechamento-mais-guardar', {
      type: 'button', 'data-guardar-mais': 'sim', text: F.guardarCartao
    });
    caixa.append(ed.wrap, guardar);
    if (typeof ed.frente?.focus === 'function') ed.frente.focus();

    const salvar = () => {
      const frente = ed.frente.value || '';
      const verso = ed.verso.value || '';
      // O teste antes da gravação, contra um arquivo de mentira: é assim que o
      // fechamento valida, e é assim que a recusa do core (sem pergunta, sem
      // resposta, acima do limite) chega na tela com a frase dele.
      const teste = criarCartao({ cartoes: {} }, {
        estacao, aula: aula.id, n: aula.n, frente, verso
      }, agoraLocal(win), 'valida-mais');
      if (!teste.ok) {
        marcarErroEm(doc, ed.wrap, teste.campo === 'verso' ? ed.verso : ed.frente, teste.erro);
        (teste.campo === 'verso' ? ed.verso : ed.frente)?.focus?.();
        return;
      }
      const arquivo = lerCartoes(pega(CARTOES_KEY));
      const criado = criarCartao(arquivo, {
        estacao, aula: aula.id, n: aula.n, frente: frente.trim(), verso: verso.trim()
      }, agoraLocal(win), novoId(win));
      if (!criado.ok) {
        marcarErroEm(doc, ed.wrap, ed.frente, criado.erro);
        return;
      }
      try {
        storage?.setItem?.(CARTOES_KEY, serializarCartoes({ versao: arquivo.versao, cartoes: criado.cartoes }));
      } catch { /* sem espaço: a pessoa perde a gravação, não o app */ }
      aoGravar();
    };

    guardar.addEventListener('click', (evento) => {
      if (typeof evento?.preventDefault === 'function') evento.preventDefault();
      salvar();
    });
  };

  const botao = no(doc, 'button', 'botao botao-secundario fechamento-mais-abrir', {
    type: 'button', 'data-escrever-mais': 'sim', text: F.escreverMais
  });
  botao.addEventListener('click', abrir);
  caixa.append(botao);
  return caixa;
}

/**
 * O FECHAMENTO da aula (S14b2 commit 2) — design/v3, J2, passos 1 a 3.
 *
 * As três decisões que importam para quem julgar este código:
 * 1. **A validação É o núcleo, não uma cópia.** Cada cartão é testado chamando
 *    `criarCartao` contra um arquivo de mentira. Se a regra "tem de ter pergunta
 *    e resposta" mudar no core e a tela continuar checando do seu jeito, as duas
 *    divergem em silêncio — a família inteira de defeitos que a S13b e a S13e
 *    deixaram no Chrome e não na suíte.
 * 2. **Nada trava nada.** O relógio de 2:00 é convite, não portão: enviar no
 *    primeiro segundo é legítimo. Travar por tempo puniria quem lembra em dez
 *    segundos e não protegia ninguém.
 * 3. **O rascunho é do core** (`core/estudo.js`, com versão e teto), porque o
 *    formato do que a pessoa digitou precisa de um dono com contrato. A tela só
 *    chama; se o storage estourar a falha é engolida de propósito — perder
 *    rascunho não pode quebrar o formulário.
 */
function blocoFechamento(doc, win, deps) {
  const { storage, estacao, slug, aula, total, playlist, pega } = deps;
  const chave = chaveRascunho(aula.id);
  const section = no(doc, 'section', 'aula-fim aula-fim-form');
  const h2 = no(doc, 'h2', 'aula-fim-titulo', { text: F.titulo });
  h2.setAttribute('tabindex', '-1');
  section.append(h2);

  const rascunho = lerRascunho(pega(chave));
  const estado = {
    minimo: false,
    lembrar: rascunho.lembrar,
    conferir: rascunho.conferir,
    cartoes: rascunho.cartoes.length ? rascunho.cartoes.map((c) => ({ ...c })) : [{ frente: '', verso: '' }]
  };

  const relogio = no(doc, 'span', 'fechamento-relogio', { 'aria-hidden': 'true' });
  relogio.textContent = marcaDeTempo(SEGUNDOS_RELOGIO);
  let restante = SEGUNDOS_RELOGIO;
  let ticTac = 0;
  let anunciado = false;

  const dizer = (texto) => {
    // O #anuncio é a ÚNICA região viva do casco (web/casco.js). Anunciar por ele
    // é o caminho que a casa já percorre; uma segunda aria-live faria a frase ser
    // dita duas vezes para quem usa leitor de tela.
    const alvo = typeof doc.getElementById === 'function' ? doc.getElementById('anuncio') : null;
    if (alvo) alvo.textContent = texto;
  };
  const pararRelogio = () => {
    if (ticTac && typeof win?.clearInterval === 'function') win.clearInterval(ticTac);
    ticTac = 0;
  };
  const andar = () => {
    if (ticTac || typeof win?.setInterval !== 'function') return;
    ticTac = win.setInterval(() => {
      restante = Math.max(0, restante - 1);
      relogio.textContent = restante > 0 ? marcaDeTempo(restante) : F.tempo;
      if (restante === 0 && !anunciado) {
        // UMA vez: o relógio chegou ao fim e não vai embora; repetir a frase a
        // cada segundo seria o app puxando o tapete de quem está escrevendo.
        anunciado = true;
        dizer(F.tempo);
        pararRelogio();
      }
    }, 1000);
  };

  let lembrar = null;
  let conferir = null;
  let frase = null;
  const editores = [];

  const escreverRascunho = () => {
    try {
      storage?.setItem?.(chave, serializarRascunho(estado));
    } catch { /* aparelho sem espaço: o formulário continua de pé, só não lembra */ }
  };

  const coletar = () => {
    const origem = estado.minimo ? frase : lembrar;
    if (origem) estado.lembrar = origem.value || '';
    if (!estado.minimo && conferir) estado.conferir = conferir.value || '';
    editores.forEach((ed, i) => {
      if (!estado.cartoes[i]) estado.cartoes[i] = { frente: '', verso: '' };
      estado.cartoes[i].frente = ed.frente.value || '';
      estado.cartoes[i].verso = ed.verso.value || '';
    });
  };

  // S18c-3: as duas formas viraram módulo (`limparErrosEm`/`marcarErroEm`), porque
  // o bloco de "escrever mais um cartão" precisa exatamente delas. Ter a segunda
  // cópia dentro desta closure é a lei do erro desenhado de dois jeitos na mesma
  // página — agora só existe uma, e aqui ela é apontada.
  const limparErros = () => limparErrosEm(section);
  const marcarErro = (campo, texto) => marcarErroEm(doc, section, campo, texto);

  /** O que falta para enviar, decidido pelo core. Devolve erros e cartões válidos. */
  const validar = () => {
    limparErros();
    const erros = [];
    if (!String(estado.lembrar || '').trim()) erros.push({ campo: lembrar || frase, texto: F.faltaLembrar });
    const completos = [];
    estado.cartoes.forEach((c, i) => {
      const f = String(c?.frente || '').trim();
      const v = String(c?.verso || '').trim();
      if (!f && !v) return; // cartão todo vazio é ignorado, não é erro
      const teste = criarCartao({ cartoes: {} }, {
        estacao, aula: aula.id, n: aula.n, frente: f, verso: v
      }, agoraLocal(win), `valida-${i}`);
      if (teste.ok) completos.push({ frente: f, verso: v });
      // O core DIZ QUAL CAMPO falta (`teste.campo`: 'frente' | 'verso'). Jogar
      // essa informação fora e marcar sempre a frente é a tela Choosing por conta
      // própria onde o núcleo respondeu: sem verso, o erro cairia no campo que
      // ESTÁ preenchido, e a pessoa olharia para a pergunta errada.
      else erros.push({ editor: editores[i], campoNome: teste.campo, texto: teste.erro });
    });
    if (!completos.length) erros.push({ alvo: editores[0]?.wrap || null, texto: F.faltaCartao });
    return { erros, completos };
  };

  const enviar = (evento) => {
    if (typeof evento?.preventDefault === 'function') evento.preventDefault();
    coletar();
    const { erros, completos } = validar();
    if (erros.length) {
      let primeiro = null;
      for (const erro of erros) {
        // O campo do cartão é escolhido pelo NOME que o core devolve; a frente é
        // o fallback só quando o nome não é um dos dois campos do editor (id,
        // quando, estação — erros de programação, não de escrita).
        const campo = erro.campo
          || (erro.editor && (erro.editor[erro.campoNome] || erro.editor.frente));
        if (campo) {
          marcarErro(campo, erro.texto);
          if (!primeiro) primeiro = campo;
        } else if (erro.alvo) {
          erro.alvo.append(erroDoCampo(doc, erro.texto, 'fechamento-erro-cartoes'));
        }
      }
      // O foco cai no PRIMEIRO ofensor em ordem de leitura — a `erros` é montada
      // nessa ordem (a frase, depois cada cartão) — não na mensagem: quem usa
      // teclado ou leitor de tela precisa ir para dentro do campo que falta.
      if (typeof primeiro?.focus === 'function') primeiro.focus();
      return;
    }

    const quando = agoraLocal(win);
    const antes = lerCartoes(pega(CARTOES_KEY));
    const estudo = estudarAula(
      estudoDoStorage(storage),
      { estacao, aula: aula.id, n: aula.n },
      quando,
      { recordacao: estado.lembrar, conferencia: estado.conferir }
    );
    let arquivo = antes;
    let gravados = 0;
    for (const c of completos) {
      const r = criarCartao(arquivo, { estacao, aula: aula.id, n: aula.n, frente: c.frente, verso: c.verso }, quando, novoId(win));
      if (!r.ok) continue;
      // A forma que o core devolve, conferida na fonte (cartoes.js:200):
      // `{ ok, cartoes, cartao }`, onde `cartoes` é o MAPA id->cartão, não o
      // arquivo. Por isso o `{ cartoes: ... }`: serializar o mapa cru daria um
      // arquivo sem chave `cartoes`, e `lerCartoes` de amanhã devolveria vazio —
      // a pessoa perdia os cartões sem ver erro nenhum.
      arquivo = { versao: arquivo.versao, cartoes: r.cartoes };
      gravados += 1;
    }
    try {
      storage?.setItem?.(ESTUDO_KEY, serializarEstudo(estudo));
      storage?.setItem?.(CARTOES_KEY, serializarCartoes(arquivo));
      storage?.removeItem?.(chave);
    } catch { /* sem espaço: a pessoa perde a gravação, não o app */ }
    pararRelogio();
    // "na primeira vez que a pessoa cria um cartão": antes não havia nenhum, agora
    // há. O persist() é o que segura o estudo quando o navegador decide limpar o
    // storage — e é em silêncio: não se pede autorização a quem acabou de fazer o
    // gesto mais caro do app.
    const primeiroDaVida = Object.keys(antes.cartoes || {}).length === 0 && gravados > 0;
    if (primeiroDaVida && typeof win?.navigator?.storage?.persist === 'function') {
      try { win.navigator.storage.persist(); } catch { /* sem persistência possível: segue */ }
    }
    deps.aoFechar(gravados);
  };

  function preencherEditores(pai, maxDoModo = LIMITE_CARTOES) {
    editores.length = 0;
    const quantos = Math.min(maxDoModo, estado.cartoes.length);
    const caixa = no(doc, 'div', 'fechamento-cartoes');
    for (let i = 0; i < quantos; i += 1) {
      const ed = editorCartao(doc, {
        base: 'atlas-fechar', indice: i, frente: estado.cartoes[i].frente, verso: estado.cartoes[i].verso
      });
      editores.push(ed);
      caixa.append(ed.wrap);
    }
    pai.append(caixa);
    // O teto tem duas saídas, e o pedido nomeia as duas: no terceiro cartão o
    // botão "Outro cartão" SOME e aparece o limite escrito. Mostrar um botão que
    // não faz nada é a pior forma de dizer "chega".
    if (editores.length >= LIMITE_CARTOES) {
      caixa.append(no(doc, 'p', 'fechamento-limite apoio', { text: F.passoCartoes.limite }));
    } else if (editores.length < maxDoModo) {
      // No modo mínimo (maxDoModo 1) não há botão nem frase de teto: o teto de
      // 3 é do modo completo, e "Até 3 cartões" escrito num modo de um só seria
      // a frase mentindo sobre a forma que a pessoa tem na tela.
      caixa.append(no(doc, 'button', 'fechamento-mais', {
        type: 'button', 'data-mais': 'sim', text: F.passoCartoes.mais
      }));
    }
    caixa.append(linhaOrigem(doc, aula.n, estacao));
  }

  function formularCompleto(caixa) {
    const p1 = no(doc, 'fieldset', 'fechamento-passo', { 'data-passo': '1' });
    p1.append(no(doc, 'legend', 'fechamento-passo-titulo', { text: F.passoLembrar.titulo }));
    const campoLembrar = campoTexto(doc, {
      id: 'atlas-fechar-lembrar', rotulo: F.passoLembrar.pergunta, linhas: 4, valor: estado.lembrar, nome: 'lembrar', extra: relogio
    });
    // `lembrar` É o textarea, não o invólucro {caixa, etiqueta, campo}: coletar()
    // lê `lembrar.value` e marcarErro() chama `lembrar.getAttribute`. Guardar o
    // invólucro dava TypeError na primeira recusa — e a recusa é justamente o
    // caminho que a pessoa pega quando escreve pouco.
    lembrar = campoLembrar.campo;
    p1.append(campoLembrar.caixa);
    // O relógio anda com o FOCO, não com o primeiro dígito: quem tabula até o
    // campo já decidiu tentar lembrar, mesmo que ainda esteja pensando.
    lembrar.addEventListener('focus', andar);
    caixa.append(p1);

    const p2 = no(doc, 'fieldset', 'fechamento-passo', { 'data-passo': '2' });
    p2.append(no(doc, 'legend', 'fechamento-passo-titulo', { text: F.passoConferir.titulo }));
    const campoConferir = campoTexto(doc, { id: 'atlas-fechar-conferir', rotulo: F.passoConferir.pergunta, linhas: 3, valor: estado.conferir, nome: 'conferir' });
    conferir = campoConferir.campo;
    p2.append(campoConferir.caixa);
    p2.append(no(doc, 'a', 'fechamento-reabrir', {
      href: hrefVideo(aula, playlist), target: '_blank', rel: 'noopener', 'data-reabrir': 'sim', text: F.reabrir
    }));
    caixa.append(p2);

    const p3 = no(doc, 'fieldset', 'fechamento-passo', { 'data-passo': '3' });
    p3.append(no(doc, 'legend', 'fechamento-passo-titulo', { text: F.passoCartoes.titulo }));
    p3.append(no(doc, 'p', 'fechamento-pergunta-maior', { text: F.passoCartoes.pergunta }));
    caixa.append(p3);
    preencherEditores(p3);
  }

  /** O modo mínimo: uma frase e um cartão. Sem fieldset na frase porque ali o
   *  LABEL já é a pergunta — um legend com o mesmo texto faria o leitor de tela
   *  dizer a frase duas vezes seguidas. */
  function formularMinimo(caixa) {
    caixa.classList.add('fechamento-form-minimo');
    const campoFrase = campoTexto(doc, { id: 'atlas-fechar-frase', rotulo: F.modoMinimo.frase, linhas: 3, valor: estado.lembrar, nome: 'frase' });
    frase = campoFrase.campo;
    caixa.append(campoFrase.caixa);
    const p2 = no(doc, 'fieldset', 'fechamento-passo', { 'data-passo': '2' });
    p2.append(no(doc, 'legend', 'fechamento-passo-titulo', { text: F.passoCartoes.titulo }));
    p2.append(no(doc, 'p', 'fechamento-pergunta-maior', { text: F.passoCartoes.pergunta }));
    preencherEditores(p2, 1);
    caixa.append(p2);
  }

  const repintarFormulario = () => {
    pararRelogio();
    section.textContent = '';
    section.append(h2);
    const topo = no(doc, 'div', 'fechamento-topo');
    topo.append(no(doc, 'a', 'fechamento-alternar', {
      href: '#', 'data-alternar': estado.minimo ? 'completo' : 'minimo',
      text: estado.minimo ? F.modoCompleto : F.modoMinimo.convite
    }));
    section.append(topo);
    const form = no(doc, 'form', 'fechamento-form');
    if (estado.minimo) formularMinimo(form); else formularCompleto(form);
    form.append(no(doc, 'button', 'botao botao-primario fechamento-enviar', {
      type: 'submit', 'data-enviar': 'sim', text: F.titulo
    }));
    section.append(form);
    // O submit é do form, que nasce novo a cada repintura; clique e digitação são
    // da SECTION, amarrados UMA vez aqui embaixo — amarrar dentro daria três
    // ouvintes depois de três "Outro cartão", e cada tecla gravaria três vezes.
    form.addEventListener('submit', enviar);
  };

  const aoEscrever = () => { coletar(); escreverRascunho(); };

  const aoClicar = (evento) => {
    // DOIS `closest` de seletor simples, não `closest('button, a')`: o parser do
    // mini-DOM (tests/hdom.js, casa()) LANÇA em seletor com vírgula — regra que a
    // casa escreveu depois de um `closest('a[href]')` devolver null em silêncio e
    // um teste passar verde medindo o dublê.
    const alvo = evento?.target?.closest?.('button') || evento?.target?.closest?.('a');
    if (!alvo) return;
    const modelo = alvo.getAttribute('data-modelo');
    if (modelo !== null) {
      // O modelo entra no COMEÇO da Pergunta e o foco vai para o FIM do campo:
      // quem toca num modelo quer completar a frase que acabou de começar.
      coletar();
      const dono = alvo.closest('.fechamento-cartao');
      const destino = (dono && editores.find((ed) => ed.wrap === dono)) || editores[0];
      const campo = destino?.frente;
      if (campo) {
        campo.value = `${modelo}${campo.value || ''}`.slice(0, LIMITE_FACE);
        if (typeof campo.focus === 'function') campo.focus();
        const fim = (campo.value || '').length;
        if (typeof campo.setSelectionRange === 'function') campo.setSelectionRange(fim, fim);
        coletar();
        escreverRascunho();
      }
      return;
    }
    if (alvo.getAttribute('data-mais') !== null) {
      coletar();
      if (estado.cartoes.length < LIMITE_CARTOES) {
        estado.cartoes.push({ frente: '', verso: '' });
        repintarFormulario();
        const ultimo = editores[editores.length - 1];
        if (typeof ultimo?.frente?.focus === 'function') ultimo.frente.focus();
      }
      return;
    }
    const alternar = alvo.getAttribute('data-alternar');
    if (alternar !== null) {
      if (typeof evento.preventDefault === 'function') evento.preventDefault();
      coletar();
      estado.minimo = alternar === 'minimo';
      repintarFormulario();
      return;
    }
    if (alvo.getAttribute('data-reabrir') !== null) andar();
  };

  section.addEventListener('click', aoClicar);
  section.addEventListener('input', aoEscrever);
  repintarFormulario();

  return { section, h2, repintarFormulario, pararRelogio };
}

/** "← Aula anterior" e "Próxima aula →", e só o que existe. */
function navegacaoVizinha(doc, { slug, n, total }) {
  const nav = no(doc, 'nav', 'aula-nav', { 'aria-label': U.navRotulo });
  if (n > 1) {
    nav.append(no(doc, 'a', 'aula-nav-antes', {
      href: paginaDaAula(slug, n - 1), rel: 'noopener', 'data-vizinha': String(n - 1), text: U.anterior
    }));
  }
  if (n < total) {
    nav.append(no(doc, 'a', 'aula-nav-depois', {
      href: paginaDaAula(slug, n + 1), rel: 'noopener', 'data-vizinha': String(n + 1), text: U.proxima
    }));
  }
  return nav;
}

/**
 * Monta a página da aula pedida pela rota.
 *
 * @param {Element} raiz o contêiner que o casco esvazia e entrega
 * @param {{document: object, window: object, catalogo: Promise, folha: string, n: number, buscarAulas?: Function}} ctx
 * @returns {Promise<{root, rotulo, anuncio, desmontar}>} `rotulo` é o nome que o
 *   casco põe no `document.title` ("Aula 3 · Circuitos Digitais · Atlas");
 *   `anuncio` é a frase do leitor de tela, que é OUTRA ("Aula 3 de 93: <título>")
 *   porque dizer em que ponto da playlist a pessoa está é mais útil do que
 *   repetir o título, e as duas coisas não cabem numa frase só.
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document;
  const win = ctx.window;
  const slug = String(ctx.folha || '');
  const n = Number(ctx.n) || 0;

  raiz.className = CLASSE;
  raiz.setAttribute('data-slug', slug);
  raiz.setAttribute('data-n', String(n));

  // O CATÁLOGO NA FORMA DO APP ({ courses }, não uma lista) — o defeito 1 da
  // S13b, que a suíte atravessou verde por causa de um dublê de forma inventada.
  const bruto = await ctx.catalogo;
  const catalogo = bruto?.courses ?? [];
  const curso = catalogo.find((c) => c && (c.slug === slug || c.id === slug)) || null;
  const estacao = typeof curso?.title === 'string' ? curso.title : slug;
  if (curso) raiz.setAttribute('data-estacao', String(curso.id));
  // S18a: o pulo grava o ID da estação, não o nome. É o que `abrirAula` já grava
  // (o gravador lê o `data-estacao` de cima) e o que `core/eixos.js`, a folha e o
  // `continuarDe` compararam. `estacao` logo acima é o NOME, para as frases da
  // tela; as duas coisas têm nomes diferentes aqui de propósito.
  const estacaoId = curso ? String(curso.id) : slug;

  // A cor da linha, pela classe da raiz (ver o cabeçalho deste arquivo).
  const fatos = curso ? fatosDaEstacao(catalogo, curso.id, {}) : null;
  const linha = Number.isFinite(fatos?.linha) && fatos.linha > 0 ? fatos.linha : 0;
  if (linha) raiz.classList.add(`l${linha}`);

  const cabecalho = no(doc, 'header', 'aula-cabecalho');
  cabecalho.append(no(doc, 'a', 'aulas-voltar', {
    href: hrefDe({ tela: 'estacao', slug, painel: 'aulas' }),
    text: U.voltarParaAulas(estacao)
  }));
  if (linha) cabecalho.append(faixaDaLinha(doc, linha, estacao));
  raiz.append(cabecalho);

  // O arquivo das aulas: a mesma leitura da página da lista, o mesmo aviso.
  let lista = null;
  if (curso) {
    const lido = await carregarAulas(slug, ctx.buscarAulas);
    if (lido.ok) {
      lista = { ...lido.dados, resourceUrl: lido.dados.resourceUrl || curso.resourceUrl };
    }
  }
  const total = lista?.aulas?.length || 0;
  const aula = lista ? lista.aulas.find((a) => Number(a.n) === n) || null : null;
  const playlist = lista ? playlistDoRecurso(lista.resourceUrl || '') : null;

  // S14b2/item 0 (04/11/2026): a posição "Aula n de N" SAÍ do alto incondicional
  // e só é desenhada na página que tem a aula (mais abaixo, junto do título).
  // Ela estava acima dos dois guardas, e o Chrome mediu o que isso desenhava em
  // /aula/999: "Aula 999 de 93" e um h1 "Aula 999 · Circuitos Digitais" — a
  // página afirmando uma aula que não existe, na linha de cima, antes de dizer
  // que ela não existe. Quem pede o que não tem é informado, não atendido com
  // números inventados. A suíte não via: o teste da época chumbou o texto errado.
  if (!curso || !lista) {
    // Sem estação ou sem arquivo: a página de aulas já diz o que fazer, e um
    // link para ela é a saída honesta. Não se desenha um "Assistir" sem vídeo.
    // O h1 é o rótulo da página, não uma frase nova: quem pediu "/aula/7" de
    // uma estação sem arquivo lê "Aula 7 · <estação>" e depois o aviso. É o
    // endereço devolvido com honestidade, e o casco tem onde pôr o foco.
    // O h1 é a PRIMEIRA das três partes, não o endereço devolvido: sem o
    // arquivo, não existe "Aula 7" para titular a página. As outras duas partes
    // ficam na caixa, e nenhuma frase aparece duas vezes na mesma janela.
    raiz.append(no(doc, 'h1', 'aula-nome', { text: A.semAulas.parteUm }));
    const caixa = no(doc, 'div', 'aulas-erro');
    caixa.append(
      no(doc, 'p', 'aulas-erro-dois', { text: A.semAulas.parteDois }),
      no(doc, 'p', 'aulas-erro-tres', { text: A.semAulas.parteTres })
    );
    raiz.append(caixa);
    return {
      root: raiz,
      rotulo: A.semAulas.parteUm,
      desmontar: () => {},
      _estado: () => ({ lista: false, curso: curso?.id || null })
    };
  }

  if (!aula) {
    raiz.append(no(doc, 'h1', 'aula-nome', { text: U.naoExiste.parteUm }));
    raiz.append(avisoAulaFora(doc, { total, estacao, slug }));
    return {
      root: raiz,
      rotulo: U.naoExiste.parteUm,
      desmontar: () => {},
      _estado: () => ({ lista: true, curso: curso.id, n, achou: false })
    };
  }

  // A posição só existe onde a aula existe (S14b2/item 0): "Aula n de N" é uma
  // conta verdadeira sobre o arquivo lido, e nada mais.
  cabecalho.append(no(doc, 'p', 'aula-posicao', { text: U.de(aula.n, total) }));

  raiz.append(no(doc, 'h1', 'aula-nome', { text: aula.titulo }));

  // A linha de apoio: quanto dura, e se é de exercício. A etiqueta é a MESMA
  // classe `aula-etiqueta` da lista (aulas.css) — dois desenhos de uma mesma
  // informação seria a regra 9 pedindo para ser quebrada.
  const apoio = no(doc, 'p', 'aula-apoio');
  // A MARCA DO ESTADO no alto (item 6). Ela é um nó com nome porque a página
  // inteira se refaz depois do envio: deixar "Não iniciada" escrito em cima de
  // "Aula estudada" é a classe de defeito que a S13 inteira ensinou a não
  // cometer — o Chrome achou, a suíte não via. `aria-hidden`: quem lê a linha de
  // apoio escuta o NOME, e a classe é o desenho (círculo cheio = estudada).
  const marca = no(doc, 'span', 'aula-marca', { 'aria-hidden': 'true' });
  const nomeEstado = no(doc, 'span', 'aula-estado', { text: A.estados['nao-iniciada'] });
  // S14c/item 2: o separador da casa entre o estado e o tempo. É um nó à parte
  // porque os dois vivem em `<span>` próprios (o teste da S14b1 lê o texto de
  // cada um), e `aria-hidden`: um leitor de tela que percorrer a linha não deve
  // ouvir "ponto" entre duas palavras. O caractere vem de `aula.separador`, não
  // daqui — a tela não digita frase.
  apoio.append(marca, nomeEstado);
  apoio.append(no(doc, 'span', 'aula-separador', { 'aria-hidden': 'true', text: U.separador }));
  apoio.append(no(doc, 'span', 'aula-duracao', { text: duracaoLegivel(aula.duracaoS) }));
  if (aula.exercicio) apoio.append(no(doc, 'span', 'aula-etiqueta', { text: A.etiquetaExercicio }));
  raiz.append(apoio);

  // O primário. `target="_blank"` é o que o distingue dos links da folha e da
  // lista agora: daqui a pessoa SAI do Atlas, e é este clique que grava a abertura.
  const assistir = no(doc, 'a', 'botao botao-primario aula-assistir', {
    href: hrefVideo(aula, playlist),
    rel: 'noopener',
    target: '_blank',
    'data-aula': String(aula.id),
    'data-n': String(aula.n),
    'data-assistir': 'sim',
    text: U.assistir
  });
  // S18a: uma linha de ações, para o "Já sei isso" ficar AO LADO do Assistir e
  // não embaixo dele. Sem a linha, a coluna da página empilharia os dois e o
  // gesto discreto pareceria uma segunda chamada, que é o que a hierarquia de um
  // primário existe para evitar.
  const acoes = no(doc, 'div', 'aula-acoes');
  acoes.append(assistir);
  raiz.append(acoes);

  const storage = win?.localStorage;
  const pega = (k) => (typeof storage?.getItem === 'function' ? storage.getItem(k) : null);
  const estudoLido = () => lerEstudo(pega(ESTUDO_KEY));
  const hoje = () => agoraLocal(win).slice(0, 10);

  // S18a — "JÁ SEI ISSO", ao lado do Assistir e NUNCA no lugar dele. A peça é a
  // mesma da lista de aulas (`acaoPularAula`, no compartilhado, regra 9): um
  // `<button>` discreto, nunca `botao-primario`, que declara sem fingir medida.
  const pulo = acaoPularAula(doc, { aula, estacao: estacaoId, estado: estadoDaAula(estudoLido(), aula.id) });
  if (pulo) raiz.append(pulo);

  /**
   * Repinta o pulo e a marca do alto depois de um pulo (ou de um desfazer), sem
   * recarregar a página. É a mesma troca de texto/estado que `aoFechar` faz para o
   * estudo, e mora aqui porque só esta tela sabe qual botão é qual.
   *
   * Os atributos são copiados um a um, e não por `outerHTML`: o `pulo` é o nó que
   * o `painel` já escuta, e substituí-lo por um nó novo dentro de um `innerHTML`
   * jogaria fora a âncora dos testes (e o `data-aula` que o gravador lê).
   */
  const pintarPulo = (estadoForcada) => {
    const estado = estadoForcada || estadoDaAula(estudoLido(), aula.id);
    const novo = acaoPularAula(doc, { aula, estacao: estacaoId, estado });
    if (pulo) {
      if (!novo) pulo.remove();
      else {
        pulo.className = novo.className;
        pulo.textContent = novo.textContent;
        for (const chave of ['data-pulo', 'data-aula', 'data-n', 'data-estacao']) {
          pulo.setAttribute(chave, novo.getAttribute(chave));
        }
      }
    }
    // S14c/item 1: UM primário por tela, e é o `pintarMarca` quem o decide. O
    // pulo não mexe nessa hierarquia — 'pulada' deixa o Assistir primário, porque
    // a aula continua sem estudo verificado.
    pintarMarca(estado);
  };

  const marcas = pausasDaAula(aula.duracaoS);
  if (marcas.length) raiz.append(blocoDePausas(doc, { marcas, aula, playlist }));

  /** Pinta a marca, o nome do estado no alto e a hierarquia do Assistir. */
  const pintarMarca = (estado) => {
    marca.className = `aula-marca aula-marca-${estado}`;
    nomeEstado.textContent = A.estados[estado] || A.estados['nao-iniciada'];
    // S14c/item 1: UM primário por tela. Quem já estudou não está sendo
    // convidado a assistir de novo — o convite agora é a próxima aula, que nasce
    // `botao-primario` em `botaoProxima`. Deixar o Assistir primário ao lado dele
    // daria duas coisas "mais importantes da página" e uma terceira que é o
    // formulário, exatamente o que a casa proíbe (tests/pages.test.js). Antes de
    // estudada o Assistir continua primário: é o gesto que falta.
    assistir.classList.remove('botao-primario', 'botao-secundario');
    assistir.classList.add(estado === 'estudada' ? 'botao-secundario' : 'botao-primario');
  };

  /** O bloco de conclusão, lido do storage — a mesma função dos dois casos. */
  const blocoDeConclusao = (fraseStatus) => {
    const feito = no(doc, 'section', 'aula-fim aula-fim-feito');
    const titulo = no(doc, 'h2', 'aula-fim-titulo', { text: F.titulo });
    titulo.setAttribute('tabindex', '-1');
    feito.append(titulo);
    feito.append(vistaConcluida(doc, {
      n: aula.n,
      estacao,
      slug,
      aulas: lista.aulas,
      total,
      cartoes: cartoesDaAula(lerCartoes(pega(CARTOES_KEY)), aula.id),
      fraseStatus,
      aviso: avisoDeAmanha(pega, hoje()),
      // S18c-3 (item 1): a aula estudada ganhou formulário próprio para o cartão
      // extra. Gravar repinta a conclusão, e o cartão novo aparece na lista.
      escrever: {
        win,
        storage,
        pega,
        estacao: estacaoId,
        aula,
        aoGravar: () => {
          const novo = pintarConclusao(fraseStatus);
          const frase = descender(novo.section, (x) => x.classList.contains('fechamento-feito-frase'))[0];
          // O foco vai para a FRASE de status, não para o h2: o que a pessoa
          // acabou de fazer está nela («Estudada em …»), e o título «Fechar a
          // aula» diria que algo mudou quando nada mudou.
          if (typeof frase?.focus === 'function') frase.focus({ preventScroll: true });
        }
      }
    }));
    return { section: feito, h2: titulo, conclusao: true };
  };

  // Um único `bloco` guarda o que está em tela — formulário OU conclusão. É dele
  // que o desmontar para o relógio e o aoRetornar tiram o alvo de rolagem e foco.
  let bloco = null;

  /**
   * TROCA o fechamento em tela pelo bloco de conclusão. A navegação vizinha é
   * tirada do lugar e recolocada DEPOIS, porque o section novo cai no fim da
   * raiz e a ordem lida é "fechamento, depois anterior/próxima".
   */
  const pintarConclusao = (fraseStatus) => {
    bloco?.pararRelogio?.();
    bloco?.section?.remove();
    const novo = blocoDeConclusao(fraseStatus);
    if (nav.parentNode === raiz) nav.remove();
    raiz.append(novo.section, nav);
    bloco = novo;
    return novo;
  };

  // A navegação vizinha nasce ANTES do fechamento: a ordem de apêndice é
  // "fechamento, depois nav", e pintarConclusao move os dois — declarar depois
  // deixaria a conclusão chamar uma variável que ainda não existe (TDZ).
  const nav = navegacaoVizinha(doc, { slug, n: aula.n, total });

  const concluida = estadoDaAula(estudoLido(), aula.id) === 'estudada';
  if (concluida) {
    // Item 6 pela porta de fora: quem abre uma aula já fechada não vê formulário
    // nenhum — vê a conclusão, com os cartões em leitura.
    pintarMarca('estudada');
    pintarConclusao(F.estudadaEm(estudoLido().aulas[aula.id]?.estudadaEm));
  } else {
    pintarMarca(estadoDaAula(estudoLido(), aula.id));
    bloco = blocoFechamento(doc, win, {
      storage,
      estacao,
      slug,
      aula,
      total,
      playlist,
      pega,
      aoFechar: (quantos) => {
        // A página INTEIRA se refaz no sentido de que marca, nome, section e
        // anúncio dizem a mesma coisa a partir daqui — nada de repintar só o
        // formulário e deixar o alto dizendo "Não iniciada".
        pintarMarca('estudada');
        // S18a: o fecho apaga o "Já sei isso". A aula agora tem medida atrás, e
        // um botão oferecendo declará-la como sabida seria a tela pedindo que a
        // pessoa desmentisse o que ela acabou de preencher.
        pintarPulo('estudada');
        pintarConclusao(quantos > 0 ? F.feito(quantos) : F.estudadaEm(hoje()));
      }
    });
    raiz.append(bloco.section, nav);
  }

  const aoRetornar = (link) => {
    // Só depois de um clique que SAIU para o vídeo. `null` é a primeira troca de
    // aba da sessão; um link interno nunca chega aqui (o gravador o ignora).
    if (!link || link.getAttribute('data-assistir') !== 'sim') return;
    const estado = estadoDaAula(estudoLido(), aula.id);
    if (estado === 'estudada') {
      // A volta pode trazer estudo feito LÁ (outra aba, mesmo aparelho): a
      // página acompanha, ou mostraria um formulário em cima de aula fechada.
      pintarMarca('estudada');
      if (!bloco?.conclusao) pintarConclusao(F.estudadaEm(estudoLido().aulas[aula.id]?.estudadaEm));
    } else {
      pintarMarca(estado);
    }
    // S18a: a volta também repinta o pulo. Outra aba pode ter pulado ou estudado
    // esta aula, e o botão é a palavra dela na tela.
    pintarPulo(estado);
    const parado = win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    // O mesmo par de metro.js:1083 — movimento é tempo, e o token vira 0 ms com
    // prefers-reduced-motion; aqui o que muda é o COMPORTAMENTO da rolagem, que
    // o CSS não toca.
    bloco.section.scrollIntoView?.({ behavior: parado ? 'auto' : 'smooth', block: 'start' });
    // O h2 é o nó GUARDADO do bloco em tela, não um querySelector: a tela criou
    // o h2 e sabe onde ele mora — procurar um nó que você tem na mão é como o
    // dublê já mentiu duas vezes nesta série.
    bloco.h2?.focus?.({ preventScroll: true });
  };

  const desligar = ligarAberturaDeAula({ win, storage, painel: raiz, aoRetornar });
  // S18a: o gravador do pulo, no MESMO painel e pela MESMA chave do estudo.
  // `aoMudar` é a repintura: depois do clique a tela tem de dizer "Pulada" e
  // oferecer o Desfazer, sem recarregar nada.
  const desligarPulo = ligarPuloDeAula({ win, storage, painel: raiz, aoMudar: () => pintarPulo() });

  return {
    root: raiz,
    rotulo: U.rotulo(aula.n, estacao),
    anuncio: U.anuncio(aula.n, total, aula.titulo),
    desmontar: () => { bloco?.pararRelogio?.(); desligar(); desligarPulo(); },
    _estado: () => ({ lista: true, curso: curso.id, n: aula.n, total, pausas: marcas.length })
  };
}
