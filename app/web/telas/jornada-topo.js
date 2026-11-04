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
//
// S20a-2 — o mapa do topo é uma FAIXA, não o quadrado do cartão do link. Os
// dois defeitos de layout que o olho pegou no Chrome saem da mesma conta, que é
// do viewBox mais a grade do computador (jornada.css: `1fr var(--largura-lateral)`
// com `column-gap: var(--espaco-8)`): o 4:3 de 640x480 dá altura = 0,75 × a
// coluna, e a coluna cresce com a janela. Em 1280 são ~856 de coluna → ~642 de
// mapa, e o primário — que vem DEPOIS do mapa na ordem da J1 — caía abaixo da
// dobra de 800; em 1920 são ~1496 → ~1122, um bloco mais alto que a janela
// inteira, que é o vão que ele mediu. A faixa corta a proporção (260/640), e a
// conta passa a caber nas duas larguras. tests/auditoria-tamanhos.test.js mede.

import { duracaoLegivel } from '../../core/aulas.js';
import { mapaDaRede } from '../../core/mapa-rede.js';
import { hrefDe } from '../../core/rotas.js';
import { aulas as AU, jornada as J } from '../../core/textos.js';
// S20a-3: o topo pergunta ao núcleo se a estação da retomada ainda é retomada.
// ESTADOS/estadoDaEstacao são a MESMA fonte que a folha, a placa e o perfil usam
// — a regra de «concluída» não pode ter duas contas no app (regra da fonte única).
import { ESTADOS, estadoDaEstacao } from '../../core/viagem.js';

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

// A faixa do topo. É GEOMETRIA do desenho (o viewBox), não dado da tela: as
// estações, as disciplinas e as aulas continuam sendo lidos, e o raio dos nós é
// derivado da largura em core/mapa-rede.js. 240 sobre 640 (8:3) mantém as 5
// estações de cada linha com passo de ~37 unidades — acima do diâmetro do nó
// (22,8), sem sobrepor ninguém — e é o número que faz o único primário caber
// acima da dobra de 800 nas duas larguras do computador: ~321 de mapa em 1280,
// ~561 em 1920. tests/auditoria-tamanhos.test.js refaz a conta com os tokens.
const MAPA_TOPO = { largura: 640, altura: 240 };

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
 * Para onde o primário do topo leva, e em que modo a tela está — TRÊS casos
 * desde a S20a-3, e o terceiro existe porque a chave de dois casos mentia.
 *
 * `ultima` é o último toque guardado por core/estudo.js (`abrirAula`/
 * `estudarAula`). A volta existe só quando a estação dela é reconhecível no
 * catálogo: um `ultima` apontando para uma disciplina que deixou de existir cai
 * abaixo em vez de linkar para lugar nenhum.
 *
 * O DEFEITO que o caso `proxima` fecha (achado no Chrome pelo fluxo do app em
 * 04/11, visto por mim e confirmado pelo Claude): a pessoa entra por «Já estudei
 * algumas disciplinas» → «Marcar», conclui Circuitos Digitais sem nunca abrir
 * aula, recarrega — e o topo, sem `ultima`, desenhava a J1 e oferecia «Começar
 * pela primeira aula · Circuitos Digitais · Aula 1», a estação que a própria
 * tela acabava de marcar como CONCLUÍDA, enquanto a lateral ao lado dizia «Sua
 * próxima estação: Matemática Discreta». A chave olhava só para o toque e nunca
 * para a viagem. É a mentira da S13a por outra porta, e o núcleo trata a outra
 * metade dela (`continuarDe`, regra da estação concluída).
 *
 * A PRÓXIMA é lida de `resumoDaViagem(...).proximaEstacao` — a mesma conta que a
 * placa e o perfil usam. Refazer a escolha aqui seria ter duas «próximas» na
 * tela, o que a regra da fonte única da casa proíbe.
 *
 * `terminal` (viagem inteira concluída, sem `ultima`): nenhum caminho para
 * apontar, então o topo se cala e a placa fica com o recheio — oferecer a Aula 1
 * da primeira estação a quem terminou a rede toda era a mesma classe de defeito.
 * (Nenhum número da rede aparece nesta prosa de propósito: a trava que varre
 * este arquivo em busca de contagem escrita à mão lê comentário de bloco junto,
 * e prosa que prega um dado é indistinguível de código que prega — eu escrevi o
 * total na explicação e a prova me pegou, o que é ela funcionando.)
 *
 * @param {Array} catalogo
 * @param {{ultima?: object|null}} estudo
 * @param {{concluidas?: number, emCurso?: number, proximaEstacao?: object|null}|null} resumo
 * @returns {{modo: 'volta'|'proxima'|'primeira'|'terminal', curso: object|null,
 *   n: number, idAula: string|null}}
 */
export function alvoDoTopo(catalogo, estudo, resumo, progresso) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  const u = estudo?.ultima;
  const curso = u?.estacao ? lista.find((c) => c && c.id === u.estacao) : null;
  // A volta só é volta se a estação dela AINDA TEM O QUE FAZER. Quem abriu a
  // aula 3 de Circuitos e depois marcou a estação inteira no embarque tem
  // `ultima` vivo numa estação CONCLUÍDA, e o cartão «Continuar: Aula 3» ali é
  // a mesma contradição do defeito 4 com outro texto. É a regra do núcleo
  // (`continuarDe` com `concluida`) lida pela tela, na mesma fonte: a lista de
  // concluídas que o `progresso` traz. Cai no caso abaixo, que aponta a
  // próxima estação.
  const feitas = numerico(resumo?.concluidas) || 0;
  const andadas = numerico(resumo?.emCurso) || 0;
  // PERGUNTADO AO NÚCLEO, e não à lista de `completed`: uma estação pode estar
  // CONCLUÍDA por regra de pré-requisito sem ter o carimbo da pessoa
  // (core/viagem.js:202 é quem decide), e o topo lendo a lista crua daria
  // «Continuar» para uma estação que o mapa pinta de concluída ao lado. É a
  // mesma fonte que a folha, a placa e o perfil consultam.
  const concluida = curso
    ? estadoDaEstacao(curso.id, progresso || {}, lista) === ESTADOS.CONCLUIDA
    : false;
  if (curso && !concluida) {
    return { modo: 'volta', curso, n: numerico(u.n) || 1, idAula: u.aula || null };
  }

  // «com progresso» = concluiu OU está em curso OU tem toque gravado. Quem
  // tocou em «Continuar» na placa tem `emCurso` sem nenhuma aula aberta, e a J1
  // também era mentira para essa pessoa: o mapa dizia nada, o botão dizia
  // primeira aula.
  if (feitas > 0 || andadas > 0 || curso) {
    const proxima = estacaoDoResumo(lista, resumo);
    if (!proxima) return { modo: 'terminal', curso: null, n: 1, idAula: null };
    return { modo: 'proxima', curso: proxima, n: 1, idAula: null };
  }

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
 * A estação para a qual a volta SEM AULA aponta, perguntada à mesma conta da
 * placa (fatia 2c-1): `resumoDaViagem(...).proximaEstacao`. O topo não refaz a
 * escolha — dois cálculos de «próxima» na mesma tela é ter duas próximas, que é
 * o defeito que a S13a deixou registrado.
 */
function estacaoDoResumo(catalogo, resumo) {
  const pid = resumo?.proximaEstacao?.id;
  if (!pid) return null;
  return catalogo.find((c) => c && c.id === pid) || null;
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
  // Os três modos têm FRASE PRÓPRIA, e todas saem de core/textos.js (regra 9):
  // «Continuar: Aula N — título» para quem tem toque no aparelho, «Começar:
  // <estação> · Aula 1» para quem tem viagem marcada mas nenhum toque, «Começar
  // pela primeira aula» para quem não tem nada. Reaproveitar a frase da
  // primeira visita na volta sem aula é o defeito 4 desenhado de novo: a tela
  // diria «primeira» a quem está na 12ª estação.
  const texto = alvo.modo === 'volta'
    ? AU.continuar(alvo.n, aula?.titulo || curso.title)
    : (alvo.modo === 'proxima' ? J.topo.comecarEstacao(curso.title) : J.topo.comecar);
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
 * O MODO não entra por parâmetro desde a S20a-3: ele é a resposta de
 * `alvoDoTopo`, que agora precisa do `resumo` para saber se a viagem andou sem
 * toque nenhum no aparelho. Uma `modo` recebida de fora seria a tela aceitando
 * uma resposta que ela mesma sabe dar — e é assim que o terceiro caso voltaria a
 * ser ignorado.
 *
 * @param {{catalogo: Array, progresso: unknown, resumo: object,
 *   estudo: object, indice: object|null, aulas: Array|null,
 *   embarqueAberto: boolean, folhaAberta?: boolean, alvo?: object}} dados
 * @param {Document} doc
 * @returns {Element} a <section class="topo lN">
 */
export function desenharTopo(dados, doc) {
  const catalogo = Array.isArray(dados.catalogo) ? dados.catalogo : [];
  const resumo = dados.resumo || {};
  // O `alvo` chega pronto do metro.js (calculado UMA vez por subida, com o
  // catálogo na mão, e é o MESMO objeto que decide qual JSON de aulas buscar —
  // dois cálculos por pintura dariam uma aula exibida e outra linkada). Quando
  // ele não veio, a pergunta é feita ao `resumo` que a tela já tem em mãos, não
  // a um `modo` inventado: é assim que o terceiro caso não pode ser ignorado.
  const alvo = dados.alvo || alvoDoTopo(catalogo, dados.estudo, resumo, dados.progresso);
  const curso = alvo.curso;
  const aula = aulaDoAlvo(dados.aulas, alvo);
  const feitas = numerico(resumo.concluidas) || 0;

  const caixa = no(doc, 'section', `topo${curso ? ` l${curso.stage}` : ''}`);
  const folhaAberta = Boolean(dados.folhaAberta);

  const mapa = () => {
    if (!catalogo.length) return null;
    const quadro = no(doc, 'div', 'topo-mapa');
    const svg = mapaDaRede(catalogo, dados.progresso || { completed: [] }, {
      acessivel: J.topo.mapaAcessivel(catalogo.length, feitas),
      ...MAPA_TOPO
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
