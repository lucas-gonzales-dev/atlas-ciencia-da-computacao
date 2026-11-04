// Projeto Atlas — o TOPO da Jornada (S20a, 04/11/2026).
//
// POR QUE EXISTE: J1 e J5 do desenho (design/v3/00-desenho.md) pedem duas telas
// na mesma peça. Quem nunca abriu nada precisa ler o que é isto, com que tamanho
// é a rede, e qual é o PRIMEIRO passo; quem já abriu uma aula precisa continuar
// de onde parou. O quadro `abertura` (S4a) só sabia falar da grade para quem
// ainda não tem grade nenhuma, e o embarque (2c-2) era um banner com botão em
// cima de uma lista. Aqui o topo é um: mapa, título, medida e UM primário.
//
// REGRAS DA CASA QUE ESTE ARQUIVO CARREGA:
//   · nenhuma frase escrita na tela: tudo sai de core/textos.js (regra 9);
//   · nenhum número escrito à mão: as disciplinas vêm do catálogo, as aulas do
//     `data/aulas/indice.json`. Um `1375` no código é exatamente o defeito que
//     o teste «jornada-topo: os números são lidos, nunca escritos» procura;
//   · roda no node e no navegador: quem chama entrega `doc`, `storage` e
//     `buscar` (web/metro.js injeta desde a S10c, e o mini-DOM dos testes é um
//     documento que não é o global);
//   · o mapa é o MESMO desenho do cartão do link: `mapaDaRede` de
//     core/mapa-rede.js, chamado daqui, e não um segundo diagrama;
//   · UM PRIMÁRIO POR TELA (S4b). Com a folha aberta o recurso da estação passa
//     a ser o primário visível, e o estado `com-folha` na raiz — que o metro.js
//     já declara — é o que faz o botão deste topo ceder a forma (jornada.css).
//
// O QUE A FATIA NÃO FAZ: a revisão do dia (S15), o "já sei isso" por estação
// (S18), e qualquer frase sobre ausência. Nada de "você sumiu", "faz N dias",
// "desde ...": o cartão de retomada aponta para o próximo passo e nada mais.

import { duracaoLegivel } from '../../core/aulas.js';
import { mapaDaRede } from '../../core/mapa-rede.js';
import { hrefDe } from '../../core/rotas.js';
import { aulas as AU, jornada as J } from '../../core/textos.js';

function no(doc, tag, classe, attrs) {
  const n = doc.createElement(tag);
  if (classe) n.className = classe;
  for (const chave of Object.keys(attrs || {})) {
    if (chave === 'text') n.textContent = String(attrs[chave]);
    else n.setAttribute(chave, String(attrs[chave]));
  }
  return n;
}

const numerico = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Lê `data/aulas/indice.json` — o índice que a geração das aulas escreve com o
 * total de aulas e de segundos da rede.
 *
 * Nunca lança, pelo mesmo motivo de `carregarAulas` (aulas-dados.js): o topo
 * existe antes do índice chegar, e um arquivo que falta não pode derrubar a
 * tela inteira. Com rede o service worker responde os bytes do precache; sem
 * ele, o número é `null` e a linha de medida diz só as disciplinas — a frase
 * que perde o número é a que não se pode provar, não um número chutado.
 */
export async function carregarIndice(buscar = (url) => fetch(url)) {
  let resposta;
  try {
    resposta = await buscar('data/aulas/indice.json');
  } catch {
    return { ok: false, erro: 'sem-rede' };
  }
  if (!resposta || resposta.ok === false) {
    return { ok: false, erro: resposta?.status === 404 ? 'nao-encontrado' : 'sem-rede' };
  }
  let dados;
  try {
    dados = await resposta.json();
  } catch {
    return { ok: false, erro: 'formato' };
  }
  const total = numerico(dados?.total?.aulas);
  if (!total) return { ok: false, erro: 'formato' };
  return { ok: true, dados: { total: { aulas: total, segundos: numerico(dados.total.segundos) } } };
}

/** A primeira estação da primeira linha do catálogo (hoje, Circuitos Digitais). */
function primeiraEstacao(lista) {
  const linhas = [...new Set(lista.map((c) => numerico(c?.stage)).filter(Number.isFinite))].sort((a, b) => a - b);
  const n = linhas[0];
  return lista.find((c) => numerico(c?.stage) === n) || lista[0] || null;
}

/**
 * Para onde o primário do topo leva, e em que modo a tela está.
 *
 * `ultima` é o último toque guardado por core/estudo.js (`abrirAula`/
 * `estudarAula`). A volta existe só quando a estação dela é reconhecível no
 * catálogo: um `ultima` apontando para uma disciplina que deixou de existir cai
 * na primeira visita em vez de linkar para lugar nenhum.
 *
 * @returns {{modo: 'volta'|'primeira', curso: object|null, n: number, idAula: string|null}}
 */
export function alvoDoTopo(catalogo, estudo) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const u = estudo?.ultima;
  const curso = u?.estacao ? lista.find((c) => c && c.id === u.estacao) : null;
  if (curso) return { modo: 'volta', curso, n: numerico(u.n) || 1, idAula: u.aula || null };
  return { modo: 'primeira', curso: primeiraEstacao(lista), n: 1, idAula: null };
}

/** A sigla da fonte, lida do catálogo (nunca escrita aqui). */
function siglaDaFonte(curso) {
  const bruto = String(curso?.source ?? curso?.origem ?? '').trim();
  return bruto ? bruto.toUpperCase() : '';
}

/** A aula do topo na lista da estação: pelo id do vídeo, e o `n` como desate. */
function aulaDoAlvo(aulas, alvo) {
  const lista = Array.isArray(aulas) ? aulas : [];
  if (!lista.length) return null;
  return lista.find((a) => a && alvo.idAula && a.id === alvo.idAula)
    || lista.find((a) => a && numerico(a.n) === alvo.n)
    || null;
}

/**
 * O cartão de retomada (J5) ou a porta de entrada (J1) — o único primário da
 * tela. `folhaAberta` é o caso que a S4b já resolveu para a placa: com a folha
 * de uma estação aberta, o recurso dela É o primário visível, então o botão do
 * topo nasce sem a classe — não é um primário esvaziado por CSS, é a tela
 * deixando de ter dois.
 */
function acaoDoTopo(doc, { alvo, aula, curso, folhaAberta }) {
  const caixa = no(doc, 'div', 'topo-acao');
  const href = hrefDe({ tela: 'estacao', slug: curso.slug, painel: 'aula', n: alvo.n });
  const texto = alvo.modo === 'volta'
    ? AU.continuar(alvo.n, aula?.titulo || curso.title)
    : J.topo.comecar;
  const classe = folhaAberta
    ? 'botao topo-primario'
    : 'botao botao-primario topo-primario';
  caixa.append(no(doc, 'a', classe, { href, text: texto }));
  const dur = aula?.duracaoS ? duracaoLegivel(aula.duracaoS) : null;
  caixa.append(no(doc, 'p', 'topo-apoio', {
    text: alvo.modo === 'volta'
      ? J.topo.apoioVolta(curso.title, numerico(curso.stage), dur)
      : J.topo.apoioComecar(curso.title, alvo.n, dur)
  }));
  return caixa;
}

/**
 * Desenha o topo da Jornada.
 *
 * @param {{modo?: string, catalogo: Array, progresso: unknown, resumo: object,
 *   estudo: object, indice: object|null, aulas: Array|null,
 *   embarqueAberto: boolean}} dados
 * @param {Document} doc
 * @returns {Element} a <section class="topo lN">
 */
export function desenharTopo(dados, doc) {
  const catalogo = Array.isArray(dados.catalogo) ? dados.catalogo : [];
  const resumo = dados.resumo || {};
  const alvo = dados.alvo || alvoDoTopo(catalogo, dados.estudo);
  const curso = alvo.curso;
  const aula = aulaDoAlvo(dados.aulas, alvo);
  const feitas = numerico(resumo.concluidas) || 0;

  const caixa = no(doc, 'section', `topo${curso ? ` l${curso.stage}` : ''}`);
  const folhaAberta = Boolean(dados.folhaAberta);

  const mapa = () => {
    if (!catalogo.length) return null;
    const quadro = no(doc, 'div', 'topo-mapa');
    const svg = mapaDaRede(catalogo, dados.progresso || { completed: [] }, {
      acessivel: J.topo.mapaAcessivel(catalogo.length, feitas)
    });
    // O SVG é string (core/mapa-rede.js é DOM-free de propósito, e é assim que
    // o cartão do link já desenha): só entra se o documento souber montar
    // marcação. Sem esse caminho (dublês sem insertAdjacentHTML) o quadro fica
    // com o aria-label e nenhuma forma — nunca um innerHTML cego.
    if (typeof quadro.insertAdjacentHTML === 'function') quadro.insertAdjacentHTML('beforeend', svg);
    return quadro;
  };

  const medida = () => {
    const total = numerico(dados.indice?.total?.aulas);
    const fonte = siglaDaFonte(curso) || 'UBL';
    return no(doc, 'p', 'topo-medida', {
      text: total
        ? J.topo.medida(catalogo.length, fonte, total)
        : J.topo.medidaSemAulas(catalogo.length, fonte)
    });
  };

  const titulo = no(doc, 'h1', 'topo-titulo', { text: J.topo.titulo });

  if (alvo.modo === 'volta' && curso) {
    // J5: o cartão vem primeiro — quem voltou não quer ver o mapa antes de ver
    // onde estava. O mapa fica ABAIXO, com as estações estudadas acesas.
    caixa.append(acaoDoTopo(doc, { alvo, aula, curso, folhaAberta }));
    caixa.append(titulo);
    caixa.append(medida());
    const quadro = mapa();
    if (quadro) caixa.append(quadro);
  } else {
    // J1: a rede é a primeira coisa — o mapa de 35 nós vazios diz o tamanho do
    // compromisso antes de qualquer frase.
    const quadro = mapa();
    if (quadro) caixa.append(quadro);
    caixa.append(titulo);
    caixa.append(medida());
    if (curso) caixa.append(acaoDoTopo(doc, { alvo, aula, curso, folhaAberta }));
  }

  // Embaixo, discreto: o mesmo fluxo do "Marcar o que já estudei" de hoje. O
  // `data-embarque` é o gancho que o bindMetro do metro.js já escuta, e o
  // `aria-expanded` é o mesmo que o quadro antigo declarava.
  caixa.append(no(doc, 'button', 'topo-marcar', {
    type: 'button', 'data-embarque': 'abrir',
    'aria-expanded': dados.embarqueAberto ? 'true' : 'false',
    text: J.topo.marcar
  }));

  return caixa;
}
