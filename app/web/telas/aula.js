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
  hrefVideo,
  ligarAberturaDeAula,
  paginaDaAula,
  seloLinha,
} from '../aulas-pedacos.js';

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
  raiz.append(assistir);

  const marcas = pausasDaAula(aula.duracaoS);
  if (marcas.length) raiz.append(blocoDePausas(doc, { marcas, aula, playlist }));

  // O lugar do fechamento (S14b2 põe o formulário dentro deste mesmo section).
  const fim = no(doc, 'section', 'aula-fim');
  const h2 = no(doc, 'h2', 'aula-fim-titulo', { text: F.titulo });
  // tabindex -1: é alvo de foco programático na volta da aba, não um passo do
  // Tab. Sem ele, .focus() num h2 não faz nada em nenhum navegador.
  h2.setAttribute('tabindex', '-1');
  fim.append(h2);
  fim.append(no(doc, 'p', 'aula-fim-aviso', { text: F.quandoTerminar }));
  raiz.append(fim);

  raiz.append(navegacaoVizinha(doc, { slug, n: aula.n, total }));

  const aoRetornar = (link) => {
    // Só depois de um clique que SAIU para o vídeo. `null` é a primeira troca de
    // aba da sessão; um link interno nunca chega aqui (o gravador o ignora).
    if (!link || link.getAttribute('data-assistir') !== 'sim') return;
    const parado = win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    // O mesmo par de metro.js:1083 — movimento é tempo, e o token vira 0 ms com
    // prefers-reduced-motion; aqui o que muda é o COMPORTAMENTO da rolagem, que
    // o CSS não toca.
    fim.scrollIntoView?.({ behavior: parado ? 'auto' : 'smooth', block: 'start' });
    h2.focus?.({ preventScroll: true });
  };

  const desligar = ligarAberturaDeAula({
    win,
    storage: win?.localStorage,
    painel: raiz,
    aoRetornar
  });

  return {
    root: raiz,
    rotulo: U.rotulo(aula.n, estacao),
    anuncio: U.anuncio(aula.n, total, aula.titulo),
    desmontar: () => desligar(),
    _estado: () => ({ lista: true, curso: curso.id, n: aula.n, total, pausas: marcas.length })
  };
}
