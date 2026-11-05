// Projeto Atlas — a FOLHA da estação (fatia S5 da v2).
//
// S5 tira a folha do metro.js e dá a ela uma rota própria: #/estacao/<slug>.
// No celular a folha sobe até --altura-folha; no computador vira painel à
// direita, com o mapa ainda clicável ao lado. O desenho vem dos fatos que o
// núcleo devolve em `fatosDaEstacao`; este arquivo só monta DOM — nenhuma regra
// de desbloqueio, nenhum calendário, nenhuma cor mora aqui.
//
// Este arquivo é o COMPONENTE, e a segunda metade da S5 é a QUEM ABRE: o casco
// já entrega o slug da rota (web/casco.js), falta o metro.js trocar o clique do
// cartão por `<a href="#/estacao/<slug>">` e ligar Esc, voltar, foco preso e
// desfazer. Até lá o metro.js desenha a folha dentro da linha (`detalhe`) e os
// 84 testes dele continuam de pé. Por isso esta função não lê estado interno da
// tela: catálogo, progresso, slug e notas entram, `{root, estacaoId}` sai.
//
// PROIBIDO (regra 9): cor, tempo, largura e ponto de quebra à mão — tudo é
// token (web/folha.css não escreve um número); frase à mão — tudo é
// core/textos.js; um segundo botão primário — disponível tem UM (o curso), em
// curso tem UM (concluir), trancada e concluída não têm nenhum.
import { comValores, dataDeCalendario, estados, folha as F, jornada as J, placa, chegada as C, aulas as AU } from '../core/textos.js';
import { hrefDe } from '../core/rotas.js';
// O estudo vazio se obtem do proprio nucleo, com lerEstudo(null) -- nunca de um
// objeto de mao propria aqui. Reescrever a forma do estudo na tela e a receita
// do falso verde: a folha pintaria "0 de 93" para um estudo que o core nao le
// como vazio nenhum (foi assim que o applyNote de 32469d9 passou nos testes).
import { lerEstudo } from '../core/estudo.js';
// S13b: a linha de progresso, o primário da aula e a nota são os MESMOS da
// página de aulas. Importar em vez de reimplementar é a regra 9: duas telas
// formatando a mesma duração de dois jeitos é o defeito que a casa proíbe.
import { linhaProgresso, notaAbrirAula, painelDeAulas, primarioAula, seloLinha } from './aulas-pedacos.js';
import { ESTADOS, fatosDaEstacao, dataLocal } from '../core/viagem.js';
import { eixosDaEstacao } from '../core/eixos.js';
import { cartoesDevidos, minutosDaFila } from '../core/cartoes.js';
// `origemDoRecurso` e `naFonte` já existem no metro.js e já têm testes. A folha
// IMPORTA, em vez de reimplementar: reimplementar é como nasce a segunda palavra
// para a mesma origem, e a crítica da v1 contou duas.
import { naFonte, origemDoRecurso } from './metro.js';

function no(doc, tag, classe, attrs) {
  const n = doc.createElement(tag);
  if (classe) n.className = classe;
  for (const chave of Object.keys(attrs || {})) {
    if (chave === 'text') n.textContent = String(attrs[chave]);
    else n.setAttribute(chave, String(attrs[chave]));
  }
  return n;
}

// O selo da linha MORAVA aqui e foi para web/aulas-pedacos.js na S14b1: as duas
// páginas de aula precisavam do mesmo círculo, e importar folha.js por causa dele
// trazia metro.js (folha.js importa metro.js, que importa folha.js de volta).
// A folha agora importa `seloLinha` de ./aulas-pedacos.js, junto do progresso e
// do primário — o mesmo caminho, nenhum ciclo.

/**
 * A ação, por estado — a regra da 2d-2 continua de pé: UM primário por folha,
 * e nenhum na trancada e na concluída (JORNADA §3.1).
 */
function acaoPorEstado(doc, f, curso, dataConclusao, painel = null, lembradas = null) {
  const box = no(doc, 'div', 'folha-acoes');

  if (f.estado === ESTADOS.TRANCADA) {
    // A trancada não oferece o recurso como ação: oferecer "começar a estudar"
    // de uma estação que ainda não existe para a pessoa é a tela mentindo. O que
    // ela precisa ali é o nome de CADA pré-requisito, como link para a folha
    // dele — e nada mais. Ler a folha continua livre: trancada não esconde.
    const titulo = no(doc, 'h3', 'folha-trancada-titulo');
    titulo.textContent = F.trancadaTitulo;
    box.append(titulo);
    const lista = no(doc, 'ul', 'folha-falta');
    for (const p of f.pede) {
      const link = no(doc, 'a', 'folha-falta-link', { href: `#/estacao/${p.slug || p.id}` });
      link.textContent = p.titulo;
      const item = no(doc, 'li');
      item.append(link);
      lista.append(item);
    }
    box.append(lista);
    return box;
  }

  if (f.estado === ESTADOS.CONCLUIDA) {
    // O carimbo: a data é a que o núcleo guarda em `conclusoes`, e quem converte
    // para dd/mm/aaaa é core/textos.js. Sem data (estação vinda de importação
    // antiga) o carimbo cala, em vez de afirmar um dia em que ninguém estudou.
    if (dataConclusao) {
      const carimbo = no(doc, 'p', 'folha-carimbo');
      carimbo.textContent = comValores.concluidaEm(dataConclusao);
      box.append(carimbo);
    }
    if (curso.resourceUrl) {
      box.append(no(doc, 'a', 'botao botao-secundario', {
        href: curso.resourceUrl, rel: 'noopener', target: '_blank', text: F.revisitar
      }));
    }
    // Desfazer conclusão é link discreto, não botão: voltar atrás é correção,
    // e o segundo botão cheio por folha é o defeito que a 2d-2 matou.
    box.append(no(doc, 'a', 'folha-desfazer', { href: '#/', 'data-desfazer': f.id, text: F.desfazerConclusao }));
    return box;
  }

  // ── S13b: com as aulas carregadas, a folha ESTUDA, não só "abre o curso" ──
  // A linha do progresso, o primário que é a aula, a nota de abrir, o secundário
  // para a página de aulas e o concluir discreto. Faltando as aulas (o arquivo
  // não está no aparelho), nada aqui toca no desenho de hoje: o bloco abaixo do
  // else é exatamente a folha da S5, e a lista de aulas é que diz por quê.
  if (painel) {
    // S16c-fix: as lembradas do eixo da cor entram aqui, vindas de `blocoEixos`.
    // É a linha da barra que passa a dizer as duas medidas; a caixa de cima sai
    // quando ela existe, e «3 de 93 aulas estudadas» deixa de aparecer duas vezes.
    box.append(linhaProgresso(doc, painel.resumo, lembradas));

    const aulasAbertas = painel.resumo.abertas > 0;
    box.append(primarioAula(doc, {
      aula: painel.continuar.aula,
      motivo: painel.continuar.motivo,
      temAberta: aulasAbertas,
      // S14b1 (item 5): o destino do toque mudou. A folha não abre mais o
      // YouTube — abre a PÁGINA DA AULA dentro do Atlas, e é de lá que se vai
      // ao vídeo. O slug é o mesmo que a folha usou para se desenhar.
      estacao: curso.slug || curso.id
    }));
    // A nota (aulas.notaAbrir) diz o que o toque faz AGORA: "Abre a aula no
    // Atlas, e de lá o vídeo." Não diz "marcada como aberta", porque o toque
    // interno não marca nada — quem grava a abertura é o Assistir da página.
    box.append(notaAbrirAula(doc));

    box.append(no(doc, 'a', 'botao botao-secundario', {
      href: hrefDe({ tela: 'estacao', slug: curso.slug || curso.id, painel: 'aulas' }),
      text: AU.verTodas(painel.resumo.total)
    }));

    // "Concluir estação" saiu dos botões e virou link discreto (J2): até a S16
    // trocar o concluir pela escada da estação, o mesmo data-concluir, o mesmo
    // handler do metro.js — só mudou o peso visual, porque o gesto principal
    // agora é a aula.
    box.append(no(doc, 'a', 'folha-desfazer folha-concluir-discreto', {
      href: '#/', 'data-concluir': f.id, text: F.marcarConcluida
    }));
    return box;
  }

  const comRecurso = Boolean(curso.resourceUrl);
  const abrir = no(doc, 'a', 'folha-recurso', {
    href: comRecurso ? curso.resourceUrl : '#/',
    rel: 'noopener', target: '_blank',
    'data-recurso': f.id,
    text: f.estado === ESTADOS.EM_CURSO ? F.abrirCurso : placa.comecarEstudar
  });
  const concluir = no(doc, 'button', 'botao', {
    type: 'button', 'data-concluir': f.id, text: placa.concluir
  });

  // O primário é o verbo que o estado manda: quem ainda não saiu de casa pega o
  // curso (JORNADA §2.3); quem já está dentro conclui.
  const primario = f.estado === ESTADOS.DISPONIVEL && comRecurso ? abrir : concluir;
  const secundario = primario === abrir ? concluir : abrir;
  primario.classList.add('botao-primario');
  secundario.classList.add('botao-secundario');
  box.append(primario, secundario);

  // A nota só faz sentido onde há um curso para abrir fora do Atlas (§2.3).
  if (primario === abrir) {
    const nota = no(doc, 'p', 'folha-nota');
    nota.textContent = F.notaAbrir;
    box.append(nota);
  }
  return box;
}

/** O bloco "ao concluir, você abre" — ou a frase de quem fecha a linha. */
function blocoDeAbertura(doc, f) {
  if (f.abre.length === 0) {
    // Nada abre: é fim de linha, e a frase é a que a placa já usa — nunca uma
    // lista vazia, nunca uma invenção.
    const fecha = no(doc, 'p', 'folha-abre folha-abre-fecha');
    fecha.textContent = J.conexao.fecha(f.linha);
    return fecha;
  }
  const box = no(doc, 'div', 'folha-abre');
  const titulo = no(doc, 'p', 'folha-abre-titulo');
  titulo.textContent = F.abreTitulo;
  box.append(titulo);
  const lista = no(doc, 'ul', 'folha-abre-lista');
  for (const a of f.abre) {
    // Baldeação é travessia: a folha nomeia a linha de destino (§3.2).
    const texto = a.linha && a.linha !== f.linha ? comValores.abreItem(a.titulo, a.linha) : a.titulo;
    const link = no(doc, 'a', 'folha-abre-link', { href: `#/estacao/${a.slug || a.id}`, text: texto });
    const item = no(doc, 'li');
    item.append(link);
    lista.append(item);
  }
  box.append(lista);
  return box;
}

/** UM fato da folha: a etiqueta de placa de um lado, o valor do outro. */
function fato(doc, rotuloTxt, valor) {
  const linha = no(doc, 'div', 'folha-fato');
  const dt = no(doc, 'dt', 'fato-rotulo');
  dt.textContent = rotuloTxt;
  const dd = no(doc, 'dd', 'fato-valor');
  dd.append(valor);
  linha.append(dt, dd);
  return linha;
}

/**
 * As duas linhas dos DOIS EIXOS na folha da estação (S16c, desenho J3).
 *
 * Nada aqui é conta da tela: `eixosDaEstacao` mede, `minutosDaFila` converte,
 * `cartoesDevidos` filtra o que já estava na agenda. A folha só traduz em frase,
 * e a frase vem de `core/textos.js`.
 *
 * Ela se cala quando não há medida: sem o índice por estação (que chega depois,
 * na repintura) não há total, e «0 de 0» descreveria um dado que não chegou. O
 * `pedeRevisao` não é um alarme nem fala de atraso — é a estação dizendo que os
 * cartões dela esfriaram, com o caminho para a fila.
 */
// `comBarra` é a decisão do item 3 da S16c-fix (04/11/2026): quando a barra de
// progresso da estação existe na mesma folha, ela é a LINHA DA MEDIDA — e a
// contagem de cima sai, porque as duas diziam «3 de 93 aulas estudadas» uma em
// cima da outra. Onde a barra não nasce (trancada, concluída, ou sem as aulas no
// aparelho), a medida continua sozinha nesta caixa.
// Devolve `{ no, lembradas }` (ou null): `lembradas` é o que a linha da barra
// precisa para dizer as duas coisas, e a conta é feita uma vez só — a folha não
// chama `eixosDaEstacao` duas vezes para o mesmo número.
function blocoEixos(doc, estado, comBarra) {
  if (!estado.indice?.estacoes?.[estado.id]) return null;
  const e = eixosDaEstacao(estado.id, {
    estudo: estado.estudo,
    cartoes: estado.cartoes,
    indice: estado.indice,
    progresso: estado.progresso,
    hoje: dataLocal(estado.hoje)
  });
  if (!e.total) return null;

  const caixa = no(doc, 'div', 'folha-eixos');
  // A medida só vive aqui quando a barra não existe na folha. Quando ela existe,
  // a frase de cima era a duplicata que o olho viu no v77.
  let temFilho = false;
  if (!comBarra) {
    caixa.append(no(doc, 'p', 'folha-eixos-medida', {
      text: F.eixos(e.estudadas, e.total, e.lembradas)
    }));
    temFilho = true;
  }

  if (e.pedeRevisao) {
    // Os minutos são da fila DESTA estação, e a fração do tempo é a mesma da
    // aba: dois cálculos de «quanto falta» na mesma tela é a tela dando duas
    // respostas para a mesma pergunta.
    const devidos = cartoesDevidos(estado.cartoes, dataLocal(estado.hoje), Infinity)
      .filter((c) => c.estacao === estado.id).length;
    if (devidos) {
      caixa.append(no(doc, 'a', 'folha-eixos-revisar', {
        href: hrefDe({ tela: 'revisar' }),
        text: F.eixosRevisao(minutosDaFila(devidos))
      }));
    }
  }
  // Com a barra desenhada, esta caixa pode ter ficado sem filho nenhum (sem
  // medida própria e sem link de revisão). Uma div vazia na folha é um buraco no
  // fluxo que o CSS da estação paga — sai de cena, e as lembradas seguem para a
  // linha da barra pelo objeto devolvido.
  return {
    no: caixa.children.length ? caixa : null,
    lembradas: Number.isFinite(e.lembradas) ? e.lembradas : null
  };
}

/**
 * O selo do momento: o círculo cheio na cor da linha, com o traço de "feito"
 * desenhado por `stroke-dashoffset` (folha.css, na duração --movimento-chegada).
 * É SVG montado em código — e por isso a cor não pode ser literal aqui: vem do
 * `currentColor`, que a classe da linha resolve no CSS.
 */
function seloMomento(doc, linha) {
  const n = Number(linha);
  const svg = doc.createElementNS ? doc.createElementNS('http://www.w3.org/2000/svg', 'svg') : doc.createElement('svg');
  svg.setAttribute('class', `folha-tra ${Number.isFinite(n) && n > 0 ? `l${n}` : ''}`);
  svg.setAttribute('viewBox', '0 0 44 44');
  svg.setAttribute('aria-hidden', 'true');
  const circulo = doc.createElement('circle');
  circulo.setAttribute('cx', '22');
  circulo.setAttribute('cy', '22');
  circulo.setAttribute('r', '19');
  circulo.setAttribute('class', 'folha-tra-fundo');
  const traco = doc.createElement('path');
  traco.setAttribute('d', 'M13 23 L19 29 L31 16');
  traco.setAttribute('class', 'folha-tra-traco');
  traco.setAttribute('fill', 'none');
  svg.append(circulo, traco);
  return svg;
}

/**
 * O MOMENTO (S6): o miolo da folha nos segundos depois de um concluir.
 *
 * O `momento` vem do núcleo (`momentoDaChegada`, que comparou antes e depois no
 * gesto) — esta função não deduz nada: o que ela lista é o que o núcleo disse
 * que abriu, o que ele disse que fechou e o marco que ele reconheceu. Sem
 * confete, sem XP, sem número de pontos (regra 9).
 */
function blocoMomento(doc, corpo, momento, f) {
  corpo.classList.add('folha-momento');

  // O anúncio: o leitor de tela fala o momento inteiro (heurística 9).
  const anuncio = no(doc, 'p', 'folha-anuncio', { role: 'status', 'aria-live': 'polite' });
  anuncio.textContent = C.anuncia(momento.titulo, momento.abertas.length);

  corpo.append(no(doc, 'p', 'folha-rotulo-momento', { text: C.rotulo }));
  corpo.append(no(doc, 'h2', 'folha-titulo-momento', { id: 'folha-titulo', text: C.entrouNoBilhete(momento.titulo) }));
  if (momento.data) {
    corpo.append(no(doc, 'p', 'folha-carimbo-momento', { text: C.carimbo(dataDeCalendario(momento.data)) }));
  }
  corpo.append(anuncio);

  // NOVO CAMINHO — uma linha por estação que o gesto abriu.
  const caminho = no(doc, 'div', 'folha-caminho');
  caminho.append(no(doc, 'p', 'folha-caminho-rotulo', { text: C.novoCaminho }));
  if (momento.abertas.length > 0) {
    const lista = no(doc, 'ul', 'folha-caminho-lista');
    for (const a of momento.abertas) {
      const texto = a.baldeacao ? C.disponivelNaLinha(a.titulo, a.linha) : `${C.estaDisponivel(a.titulo)}.`;
      const item = no(doc, 'li');
      item.append(no(doc, 'a', 'folha-caminho-link', { href: `#/estacao/${a.slug || a.id}`, text: texto }));
      lista.append(item);
    }
    caminho.append(lista);
  } else {
    // Nada abriu: ou é fim de linha, ou é estação sem sucessor — e as duas
    // frases já existem na placa, nunca uma invenção daqui.
    caminho.append(no(doc, 'p', 'folha-caminho-fecha', { text: J.conexao.fecha(f.linha) }));
  }
  corpo.append(caminho);

  // Fim de linha: o texto é o MESMO estado da placa (estados.fimDaLinha), e não
  // uma segunda palavra para o mesmo feito.
  if (momento.fechouLinha !== null && momento.fechouLinha !== undefined) {
    corpo.append(no(doc, 'p', 'folha-momento-estado', {
      text: `${estados.fimDaLinha.titulo}. ${estados.fimDaLinha.descricao}`
    }));
  }

  // Marcos: nome + critério, do maior (a tela celebra o último da lista).
  for (const m of momento.marcos.slice(-1)) {
    const box = no(doc, 'div', 'folha-marco');
    box.append(no(doc, 'p', 'folha-marco-rotulo', { text: C.marco }));
    box.append(no(doc, 'p', 'folha-marco-nome', { text: C.nomeDoMarco[m.tipo] || '' }));
    box.append(no(doc, 'p', 'folha-marco-criterio', { text: C.criterioDoMarco[m.tipo] || '' }));
    corpo.append(box);
  }

  // Um primário: a próxima. Sem próxima (Terminal), o mapa é o único destino.
  const acoes = no(doc, 'div', 'folha-acoes folha-momento-acoes');
  if (momento.proxima) {
    acoes.append(no(doc, 'a', 'botao botao-primario', {
      href: `#/estacao/${momento.proxima.slug || momento.proxima.id}`, text: C.verProxima
    }));
    acoes.append(no(doc, 'a', 'botao botao-secundario', { href: '#/', text: C.voltarAoMapa }));
  } else {
    acoes.append(no(doc, 'a', 'botao botao-primario', { href: '#/', text: C.voltarAoMapa }));
  }
  corpo.append(acoes);
  corpo.append(seloMomento(doc, f.linha));
}

/**
 * Desenha a folha da estação `slug`.
 *
 * A raiz é o INVÓLUCRO do diálogo (`.folha`, cheia na tela, e só aqui o véu
 * acerta o toque fora sem uma linha de JS no celular); o aparadeiro é
 * `.folha-corpo`, que sobe no celular e vira painel à direita no computador.
 *
 * S13b acrescenta dois campos ao `estado`, e nenhum dos dois é obrigatório:
 *   · `aulas` — o objeto lido de `data/aulas/<slug>.json` por
 *     web/aulas-dados.js, ou null quando o arquivo não está no aparelho;
 *   · `estudo` — o estudo cru de `localStorage` (core/estudo.js), ou null.
 * Sem `aulas` a folha é exatamente a de sempre (S5): a linha de progresso, o
 * primário de aula e o concluir discreto só aparecem com a lista carregada, e o
 * erro de carga pertence à página de aulas, não à folha.
 *
 * @param {Document} doc
 * @param {{catalogo: Array, progresso: object, slug: string, notas: object, aulas?: object|null, estudo?: object|null}} estado
 * @returns {{root: Element, estacaoId: string|null}}
 */
export function desenharFolha(doc, estado) {
  const { catalogo = [], progresso = {}, slug, notas = {}, momento = null, aulas = null, estudo = null } = estado || {};
  const curso = catalogo.find((c) => c && (c.slug === slug || c.id === slug));

  const raiz = no(doc, 'div', 'folha', {
    id: 'folha', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'folha-titulo',
    'data-slug': String(slug ?? '')
  });
  // O véu fica DENTRO do diálogo e atrás do corpo: tocar nele fecha (o metro.js
  // liga closest('[data-fechar]'), o mesmo atributo do botão de fechar).
  raiz.append(no(doc, 'div', 'folha-veu', { 'data-fechar': 'veu', 'aria-hidden': 'true' }));
  const corpo = no(doc, 'div', 'folha-corpo');
  corpo.append(no(doc, 'div', 'folha-alca', { 'aria-hidden': 'true' }));
  corpo.append(no(doc, 'a', 'folha-fechar', { href: '#/', 'data-fechar': 'true', text: placa.fechar }));
  raiz.append(corpo);

  if (!curso) {
    // Deep-link errado ou catálogo que mudou: a folha abre e diz, com a frase da
    // fatia. Um link só, e nenhuma ação — um primário aqui seria promessa falsa.
    raiz.classList.add('folha-inexistente');
    const aviso = no(doc, 'p', 'folha-aviso');
    aviso.textContent = F.naoEstaNoMapa;
    corpo.append(aviso);
    corpo.append(no(doc, 'a', 'botao botao-volver', { href: '#/', text: F.voltarAoMapa }));
    return { root: raiz, estacaoId: null };
  }

  const f = fatosDaEstacao(catalogo, curso.id, progresso);
  if (Number.isFinite(f.linha) && f.linha > 0) corpo.classList.add(`l${f.linha}`);
  raiz.setAttribute('data-estacao', curso.id);

  // 1. o selo da linha + "Linha 2 · estação 3 de 5", lidos do catálogo.
  const cabecalho = no(doc, 'div', 'folha-cabecalho');
  cabecalho.append(seloLinha(doc, f.linha));
  const rotulo = no(doc, 'p', 'folha-rotulo');
  rotulo.textContent = f.linha
    ? comValores.posicaoNaLinha(f.linha, f.posicao, f.total)
    : comValores.viagem(0, f.total);
  cabecalho.append(rotulo);
  corpo.append(cabecalho);

  // S6 — o MOMENTO. Ele troca só o MIOLO: o selo da linha e o rótulo de posição
  // ficam, porque a pessoa acabou de concluir exatamente aquela estação, e o
  // mapa atrás continua desenhado pelo metro.js. O que sai é o corpo normal
  // (fatos, anotação, ações): um primário por folha vale também aqui, e a
  // anotação volta quando o aviso passa.
  if (momento && momento.id === curso.id) {
    blocoMomento(doc, corpo, momento, f);
    return { root: raiz, estacaoId: curso.id };
  }

  // 2. o nome, no maior tamanho da escala (e para ele que o diálogo aponta).
  corpo.append(no(doc, 'h2', 'folha-titulo', { id: 'folha-titulo', text: f.titulo }));

  // 3. o estado, por forma E por texto — nunca só a cor (JORNADA §3.1).
  corpo.append(no(doc, 'p', `folha-estado ${String(f.estado).replace(/_/g, '-')}`, {
    text: F.estadoNome[f.estado] || ''
  }));

  // 3b. OS DOIS EIXOS (S16c): o que foi estudado e o que foi lembrado depois,
  //     lidos do núcleo — a folha não refaz conta nenhuma. Sem índice por estação
  //     no aparelho (o `indice` chega depois da S20a, e o `cartoes` também), a
  //     linha não nasce: «0 de 0» é uma frase sobre um dado que não chegou, e a
  //     casa não descreve o que não mediu.
  // A conta das aulas (S13b) sobe para antes dos eixos: a barra de progresso,
  // desenhada dentro de `acaoPorEstado`, é quem passa a levar as lembradas, e
  // «vai nascer barra?» é a mesma conta de `comBarra` aqui embaixo. Refazer o
  // `painelDeAulas` duas vezes na mesma folha é a folha dando duas respostas
  // para a mesma pergunta.
  const comAulas = (f.estado === ESTADOS.DISPONIVEL || f.estado === ESTADOS.EM_CURSO)
    ? painelDeAulas(estudo || lerEstudo(null), curso.id, { ...aulas, resourceUrl: curso.resourceUrl })
    : null;
  const eixos = blocoEixos(doc, { ...estado, id: curso.id }, Boolean(comAulas));
  if (eixos?.no) corpo.append(eixos.no);
  const lembradas = eixos ? eixos.lembradas : null;

  // 4. os três fatos. A origem é a MESMA função da placa, e o que a fonte não
  //    diz a folha cala — por isso o dd pode sair com texto vazio.
  const fatos = no(doc, 'dl', 'folha-fatos');
  const origem = origemDoRecurso(curso);
  const origemNo = no(doc, 'span', 'folha-origem', { text: origem || '' });
  fatos.append(fato(doc, F.rotuloRecurso, origemNo));

  const biblioNo = no(doc, 'span', 'folha-bibliografia-valor');
  if (curso.bibliography) {
    biblioNo.append(no(doc, 'a', 'folha-bibliografia', {
      href: naFonte(curso.bibliography), rel: 'noopener', target: '_blank',
      'data-bibliografia': curso.id, text: placa.bibliografiaNaFonte
    }));
  }
  fatos.append(fato(doc, F.rotuloBibliografia, biblioNo));

  const conexoes = no(doc, 'span', 'folha-conexoes', { text: comValores.fatosConexoes(f.pede.length, f.abre.length) });
  fatos.append(fato(doc, F.rotuloConexoes, conexoes));
  corpo.append(fatos);

  // 5. o que o gesto abre, pelo nome, com a baldeação nomeada.
  corpo.append(blocoDeAbertura(doc, f));

  // 6. a acao do estado. S13b: as aulas so entram onde ha estudo a fazer --
  // disponivel ou em curso. Concluida e trancada manteria a linha de progresso a
  // 100% ou a 0% sem nenhum gesto possivel, e o painel das duas ja existe (o mapa
  // do que abriu, a data). A lista vem de fora (web/aulas-dados.js): a folha nao
  // carrega nada e nao decide nada, so monta o que o nucleo calculou. Sem lista,
  // acaoPorEstado desenha a folha exatamente como ela era hoje. O `comAulas` ja
  // foi calculado no bloco dos eixos, acima, e e o mesmo objeto aqui: a folha
  // conta as aulas uma vez so.
  corpo.append(acaoPorEstado(doc, f, curso, progresso.conclusoes?.[curso.id], comAulas, lembradas));

  // 7. a anotação. O nome acessível do campo leva a estação — é a lição da
  //    2c-3: desenhado nas 35 estações, o leitor de tela dizia "Anotação"
  //    trinta e cinco vezes.
  const campo = no(doc, 'div', 'folha-anotacao');
  const pergunta = no(doc, 'label', 'folha-anotacao-rotulo', { for: 'nota-folha' });
  const perguntaTxt = no(doc, 'span');
  perguntaTxt.textContent = F.anotacaoPergunta;
  const area = no(doc, 'textarea', 'anotacao', {
    id: 'nota-folha', 'data-nota': curso.id,
    'aria-label': F.anotacaoCampo(f.titulo), rows: '3'
  });
  area.value = typeof notas[curso.id] === 'string' ? notas[curso.id]
    : (typeof curso.nota === 'string' ? curso.nota : '');
  pergunta.append(perguntaTxt, area);
  const salvo = no(doc, 'span', 'folha-salvo', { role: 'status', 'aria-live': 'polite' });
  campo.append(pergunta, salvo);
  corpo.append(campo);

  return { root: raiz, estacaoId: curso.id };
}
