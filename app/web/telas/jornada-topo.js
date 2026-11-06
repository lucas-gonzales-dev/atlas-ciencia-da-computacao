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
import { eixosDaRede, houveEstudo } from '../../core/eixos.js';
import { mapaDaRede } from '../../core/mapa-rede.js';
import { hrefDe } from '../../core/rotas.js';
import { aulas as AU, jornada as J, mapa as MAPA_TEXTO, revisar as REV_TEXTO } from '../../core/textos.js';
import { cartoesDevidos, minutosDaFila } from '../../core/cartoes.js';
// S20a-3: o topo pergunta ao núcleo se a estação da retomada ainda é retomada.
// ESTADOS/estadoDaEstacao são a MESMA fonte que a folha, a placa e o perfil usam
// — a regra de «concluída» não pode ter duas contas no app (regra da fonte única).
import { ESTADOS, estadoDaEstacao, dataLocal, resumoDaViagem, fraseDeRecomeco } from '../../core/viagem.js';
// S18a: o topo pergunta ao núcleo se a estação da volta foi PERCORRIDA. A régua
// mora em core/estudo.js e é a mesma de `continuarDe` e da folha — o topo não
// refaz um `every` sobre as aulas, porque duas «percorridas» no app é o defeito
// que a regra da fonte única existe para impedir.
import { estadoDaAula, estacaoPercorrida, primeiraPendente } from '../../core/estudo.js';

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
  return {
    ok: true,
    dados: {
      total: { aulas: total, segundos: numerico(dados.total.segundos) },
      // S16c: a tabela por estação, que é o que core/eixos.js lê para saber o
      // total e os segundos de cada uma. Ela chega no MESMO arquivo que a
      // contagem da rede — buscar um índice por estação para desenhar o mapa era
      // o que este índice existe para evitar (design/v3, J3).
      estacoes: dados?.estacoes && typeof dados.estacoes === 'object' ? dados.estacoes : null
    }
  };
}

/**
 * A linha da fila do dia no topo (S15b item 4, que a S15b deixou para cá).
 *
 * É um LINK e nunca um segundo primário: a Jornada tem UM caminho, e quem voltou
 * para estudar não pode ver dois recheios na mesma tela. Com zero devidos a
 * linha NÃO EXISTE — "Em dia" é o que a aba diz, e repeti-la no topo seria a
 * rede falando de uma fila vazia.
 *
 * A frase é `revisar.hoje`, a mesma da aba, chamada e não copiada: duas frases
 * para a mesma fila é a fila dizendo duas coisas na mesma hora. O total e os
 * minutos vêm de `cartoesDevidos` e `minutosDaFila`, sem conta nova nesta tela.
 */
function linhaDeRevisoes(doc, dados) {
  const arquivo = dados.cartoes;
  if (!arquivo || !arquivo.cartoes) return null;
  const devidos = cartoesDevidos(arquivo, dataLocal(dados.hoje), Infinity).length;
  if (!devidos) return null;
  return no(doc, 'a', 'topo-revisoes', {
    href: hrefDe({ tela: 'revisar' }),
    text: REV_TEXTO.hoje(devidos, minutosDaFila(devidos))
  });
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
 * S18a (04/11/2026) — o quarto caso da VOLTA: a estação PERCORRIDA. A pessoa
 * fecha a última aula de uma estação, recarrega, e o topo dizia «Continuar: Aula
 * 55 — …», a aula que ela acabou de fechar. É o mesmo defeito do `concluida`
 * acima, por outra porta: não é que a estação esteja marcada no progresso, é que
 * não sobra NADA nela, e um botão de "continuar" sem o que continuar mente sobre
 * onde a pessoa está. A regra é a do `opcoes.concluida` de `continuarDe`: a
 * estação percorrida se comporta como a concluída do topo, e aponta a primeira
 * aula da próxima.
 *
 * O que a percorrida NÃO é: 'concluida' no progresso. Ninguém marca estação por
 * trás de um toque — quem fecha o carimbo é a pessoa, e o desenho é explícito
 * sobre isso (design/v3/00-desenho.md: o tempo nunca rebaixa, só um desafio
 * reprovado devolve 'dominada' para 'percorrida').
 *
 * O total de aulas vem do `indice` (o `data/aulas/indice.json`, que o topo já
 * carrega para a linha de medida), e não do JSON de aulas da estação: buscar o
 * arquivo de uma estação só para responder "sobrou algo nela" seria o topo
 * pedindo 93 títulos que ele não desenha. Sem o índice no aparelho ainda, o
 * total é `null` e a estação NÃO é dada como percorrida — "não sei" continua
 * desenhando a volta de sempre, que é menos errado que um endereço inventado.
 *
 * @param {Array} catalogo
 * @param {{ultima?: object|null, aulas?: object}} estudo
 * @param {{concluidas?: number, emCurso?: number, proximaEstacao?: object|null}|null} resumo
 * @param {unknown} progresso
 * @param {{estacoes?: Record<string, {aulas?: number}>}|null} [indice] S18a: a
 *   tabela por estação, para a régua da percorrida. Sem ela, a volta é a de sempre.
 * @returns {{modo: 'volta'|'proxima'|'primeira'|'terminal', curso: object|null,
 *   n: number, idAula: string|null}}
 */
export function alvoDoTopo(catalogo, estudo, resumo, progresso, indice) {
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
  // S18a: nem concluída, nem sobrando aula. O `total` vem da tabela do índice;
  // sem ele a pergunta não tem resposta, e a resposta «não percorrida» é a que
  // não quebra nada do que já desenhava.
  // As estações PERCORRIDAS desta aparelho — todas as aulas estudadas ou puladas,
  // pelo `total` do índice. Uma passada sobre o catálogo, e cada pergunta vai ao
  // NÚCLEO (`estacaoPercorrida`, estudo.js): a definição não é refeita aqui.
  // Com o estudo vazio nem se pergunta: sem registro não há percurso possível, e
  // a primeira visita não paga o custo de uma varredura que sempre daria não.
  const temRegistro = Object.keys(estudo?.aulas || {}).length > 0;
  const percorridas = temRegistro ? percorridasDoEstudo(estudo, lista, indice) : new Set();
  const percorrida = !concluida && curso && percorridas.has(curso.id);
  if (curso && !concluida && !percorrida) {
    // S18a-fix (item 4): a `ultima` pode ser uma aula que a pessoa ACABOU DE
    // DISPENSAR. «Continuar: Aula 1» para quem pulou a Aula 1 é a Jornada
    // contradizendo a folha ao lado, e o endereço errado num botão que a pessoa
    // vai tocar. A pergunta tem dono no núcleo (`primeiraPendente`); aqui só se
    // faz ela, e o `idAula` é anulado — sem ele a aula do `n` vem da lista.
    const pulou = u.aula ? estadoDaAula(estudo, u.aula) === 'pulada' : false;
    if (!pulou) return { modo: 'volta', curso, n: numerico(u.n) || 1, idAula: u.aula || null };
    return { modo: 'volta', curso, n: pendenteDa(estudo, curso, indice), idAula: null };
  }

  // «com progresso» = concluiu OU está em curso OU tem toque gravado. Quem
  // tocou em «Continuar» na placa tem `emCurso` sem nenhuma aula aberta, e a J1
  // também era mentira para essa pessoa: o mapa dizia nada, o botão dizia
  // primeira aula.
  // S18a: uma estação percorrida É progresso, para esta pergunta. Sem o
  // `percorridas.size`, quem fecha as 93 aulas de Circuitos sem carimbar o
  // `completed` e sem `ultima` ativa (pulou a última, por exemplo) caía na J1 e
  // recebia «Começar pela primeira aula» — o mapa dizendo 100% e o botão dizendo
  // zero, na mesma tela.
  if (feitas > 0 || andadas > 0 || curso || percorridas.size > 0) {
    // A estação percorrida é tratada como concluída PARA ESTA PERGUNTA («onde eu
    // vou agora»), e só para esta. O `proximaEstacao` do resumo lê o `completed`
    // cru, e uma estação com as 93 aulas fechadas sem carimbo ainda é, por essa
    // conta, a próxima dela mesma — «Começar: Circuitos · Aula 1» numa estação
    // que a pessoa acabou de terminar. Perguntar ao MESMO `resumoDaViagem` com a
    // estação no `completed` é a regra do pedido, com a fonte única preservada:
    // não refiz a conta da «próxima» aqui.
    // Ninguém escreve no progresso: o carimbo continua sendo da pessoa.
    const pergunta = percorridas.size > 0
      ? resumoDaViagem(comEssasNoCompleted(progresso, percorridas), lista)
      : resumo;
    const proxima = estacaoDoResumo(lista, pergunta);
    if (!proxima) return { modo: 'terminal', curso: null, n: 1, idAula: null };
    return { modo: 'proxima', curso: proxima, n: pendenteDa(estudo, proxima, indice), idAula: null };
  }

  // A primeira visita. `percorridas` é vazia aqui por construção: com qualquer
  // estação percorrida o ramo acima já respondeu (percorridas.size > 0 é «com
  // progresso»). Não acrescento uma régua de «nada sobra» neste caminho — seria
  // código morto, e o fim da viagem já é travado pelo caso `terminal` acima.
  const primeira = primeiraEstacao(lista);
  return { modo: 'primeira', curso: primeira, n: pendenteDa(estudo, primeira, indice), idAula: null };
}

/**
 * O `n` por onde começar nesta estação (S18a-fix, item 4): a pergunta é do
 * núcleo (`primeiraPendente`, core/estudo.js), e o desate a 1 é só o que acontece
 * quando o `índice` não chegou — sem total não há pendência conhecida, e a
 * primeira visita real responde 1 do mesmo jeito.
 */
function pendenteDa(estudo, curso, indice) {
  const total = numerico(indice?.estacoes?.[curso?.id]?.aulas);
  if (!(total > 0)) return 1;
  return primeiraPendente(estudo, curso.id, total) || 1;
}

/**
 * As estações do catálogo que este aparelho PERCORREU (S18a).
 *
 * A pergunta é do núcleo, e é feita ao núcleo — `estacaoPercorrida`, que a
 * folha, a lista de aulas e `continuarDe` também consultam. O que mora aqui é
 * só a iteração: para cada estação com total conhecido no índice, «sobrou
 * alguma aula nela?». Sem o `total` não há resposta, e a estação fica fora do
 * conjunto — «não sei» desenha a volta de sempre, que é menos errado que um
 * endereço inventado.
 */
function percorridasDoEstudo(estudo, catalogo, indice) {
  const out = new Set();
  if (!Array.isArray(catalogo) || !catalogo.length) return out;
  for (const curso of catalogo) {
    const total = numerico(indice?.estacoes?.[curso?.id]?.aulas);
    if (total > 0 && estacaoPercorrida(estudo, curso.id, total)) out.add(curso.id);
  }
  return out;
}

/**
 * O progresso COM a estação contada como concluída, para uma pergunta só, e sem
 * tocar no aparelho: o `completed` é copiado, nunca escrito. Aceita as duas
 * formas que o app tem em mãos (objeto `{completed}` ou Set), as mesmas que
 * `core/eixos.js` aceita pela razão idêntica.
 */
function comEssasNoCompleted(progresso, ids) {
  const bruto = progresso?.completed ?? progresso;
  const atuais = bruto instanceof Set ? [...bruto] : Array.isArray(bruto) ? bruto : [];
  const extras = ids instanceof Set ? [...ids] : Array.isArray(ids) ? ids : [ids];
  const base = progresso && typeof progresso === 'object' && !(progresso instanceof Set) ? progresso : {};
  return { ...base, completed: [...new Set([...atuais, ...extras])] };
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
function acaoDoTopo(doc, { alvo, aula, curso, folhaAberta, temAulaEstudada, hoje }) {
  const caixa = no(doc, 'div', 'topo-acao');
  const href = hrefDe({ tela: 'estacao', slug: curso.slug, painel: 'aula', n: alvo.n });
  // Os três modos têm FRASE PRÓPRIA, e todas saem de core/textos.js (regra 9):
  // «Continuar: Aula N — título» para quem tem toque no aparelho, «Começar:
  // <estação> · Aula 1» para quem tem viagem marcada mas nenhum toque, «Começar
  // pela primeira aula» para quem não tem nada. Reaproveitar a frase da
  // primeira visita na volta sem aula é o defeito 4 desenhado de novo: a tela
  // diria «primeira» a quem está na 12ª estação.
  // S20b-4 (item 3) — «Começar» era falso para quem já estudou aqui. O modo
  // `proxima` responde «qual é a próxima estação da viagem?», e o verbo era
  // sempre o da primeira aula: com 3 de 93 estudadas em Circuitos Digitais, o
  // topo dizia «Começar: Circuitos Digitais · Aula 4» ao lado de um mapa já
  // aceso e de uma lista que dizia «Em percurso». O endereço é o mesmo (estação
  // + a primeira pendente do núcleo, `alvo.n`); só a palavra muda, e ela vem de
  // core/textos.js (regra 9). `temAulaEstudada` é a medida de `eixosDaEstacao`
  // (estudadas > 0) lida uma vez por pintura: sem índice o Map vem vazio e a
  // resposta é «não medimos», e aí vale o verbo antigo — «Continuar» sem medida
  // seria uma frase que esta tela não teria como sustentar.
  const texto = alvo.modo === 'volta'
    ? AU.continuar(alvo.n, aula?.titulo || curso.title)
    : (alvo.modo === 'proxima'
      ? (temAulaEstudada ? J.topo.continuarEstacao : J.topo.comecarEstacao)(curso.title, alvo.n)
      : J.topo.comecar(alvo.n));
  const classe = folhaAberta
    ? 'botao topo-primario'
    : 'botao botao-primario topo-primario';
  caixa.append(no(doc, 'a', classe, { href, text: texto }));
  // S19a (desenho J5, item 2): a frase de recomeço, uma linha abaixo do gesto.
  // Ela vem depois do primário e não é link — quem voltou tem de ver o próximo
  // passo antes de ver qualquer frase sobre o calendário, e a frase acompanha o
  // botão em vez de disputar com ele. `fraseDeRecomeco` devolve `null` em todo
  // dia que não é borda e para quem não tem estudo no aparelho: a frase nasce
  // do núcleo e a tela só pinta, sem `if` de data escrito aqui.
  // O booleano é a MEDIDA da estação do alvo (`temAulaEstudada`, o mesmo
  // `estudadas > 0` do verbo do botão acima): sem estudo medido a frase cala, e
  // dizer «semana nova» a quem abriu o app pela primeira vez seria o app
  // inventando uma pausa que a pessoa não fez.
  const recomeco = fraseDeRecomeco(hoje, temAulaEstudada);
  if (recomeco) caixa.append(no(doc, 'p', 'topo-recomeco', { text: recomeco }));
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
  const alvo = dados.alvo || alvoDoTopo(catalogo, dados.estudo, resumo, dados.progresso, dados.indice);
  const curso = alvo.curso;
  const aula = aulaDoAlvo(dados.aulas, alvo);
  const feitas = numerico(resumo.concluidas) || 0;

  const caixa = no(doc, 'section', `capa${curso ? ` l${curso.stage}` : ''}`);
  const folhaAberta = Boolean(dados.folhaAberta);

  // S16c: os DOIS EIXOS chegam ao desenho. A conta é UMA por pintura, no núcleo
  // (`eixosDaRede`), e o mapa recebe o Map pronto — a tela não inventa cor nem
  // preenchimento, ela entrega a medida. Sem o índice por estação no aparelho
  // ainda (ele chega numa repintura), o Map vem VAZIO e o mapa desenha o de
  // antes: vazio é «não medimos», não «meio desenhado».
  const eixos = eixosDaRede(catalogo, {
    estudo: dados.estudo, cartoes: dados.cartoes, indice: dados.indice,
    progresso: dados.progresso, hoje: dataLocal(dados.hoje)
  });

  // S20b-4 (item 3) — a estação do alvo TEM aula estudada? A pergunta é respondida
  // pela medida que já foi feita acima, e não por um `every` novo sobre as aulas.
  // Sem índice, `eixos` é o Map vazio de «não medimos» e o verbo fica o antigo.
  const medidaDoAlvo = curso ? eixos.get(curso.id) : null;
  const temAulaEstudada = Boolean(medidaDoAlvo && medidaDoAlvo.estudadas > 0);

  const mapa = () => {
    if (!catalogo.length) return null;
    const quadro = no(doc, 'div', 'topo-mapa');
    const svg = mapaDaRede(catalogo, dados.progresso || { completed: [] }, {
      // Com MEDIÇÃO, o rótulo CONTA os estágios (a frase é do mapaDaRede, que lê
      // textos.js). Sem nenhuma aula estudada — primeira visita, ou só aulas
      // ABERTAS — vale o rótulo da S20a: «nenhuma estudada ainda». Ele é mais
      // honesto que «35 fora da rota» justamente porque abrir não é estudar, e
      // um leitor de tela anunciaria uma medida que ainda não existe.
      acessivel: houveEstudo(eixos) ? null : J.topo.mapaAcessivel(catalogo.length, feitas),
      eixos,
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

  // A LEGENDA do mapa de dois eixos (S16c, item 4). Ela é uma linha discreta
  // DEBAIXO do desenho, e só existe quando há medição: com a rede toda vazia,
  // a legenda do preenchimento falaria de um desenho que nunca mudou. É a regra da casa
  // para cor — a forma diz, a palavra decifra (design/README heurística 6).
  const legenda = () => (houveEstudo(eixos)
    ? no(doc, 'p', 'topo-legenda', { text: MAPA_TEXTO.legenda })
    : null);

  // Só entra o que EXISTE: mapa sem catálogo, legenda sem medição, fila sem
  // cartão devido. Nenhum dos três é um nó com nada dentro — é a regra da casa
  // para linha que a fonte não sustenta.
  const puxa = (n) => { if (n) caixa.append(n); };

  if (alvo.modo === 'volta' && curso) {
    // J5: o cartão vem primeiro — quem voltou não quer ver o mapa antes de ver
    // onde estava. O mapa fica ABAIXO, com as estações estudadas acesas.
    caixa.append(acaoDoTopo(doc, { alvo, aula, curso, folhaAberta, temAulaEstudada, hoje: dados.hoje }));
    puxa(linhaDeRevisoes(doc, dados));
    caixa.append(titulo);
    caixa.append(medida());
    puxa(mapa());
    puxa(legenda());
  } else {
    // J1: a rede é a primeira coisa — o mapa de 35 nós vazios diz o tamanho do
    // compromisso antes de qualquer frase.
    puxa(mapa());
    puxa(legenda());
    caixa.append(titulo);
    caixa.append(medida());
    if (curso) {
      caixa.append(acaoDoTopo(doc, { alvo, aula, curso, folhaAberta, temAulaEstudada, hoje: dados.hoje }));
      puxa(linhaDeRevisoes(doc, dados));
    }
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
