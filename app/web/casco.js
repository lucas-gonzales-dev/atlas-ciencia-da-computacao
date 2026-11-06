// Projeto Atlas — o CASCO: rotas por hash, abas, anúncio e foco (S3a-2a).
//
// POR QUE EXISTE: até aqui cada página HTML era um app inteiro (index.html =
// grade, metro.html = metrô). O casco é a primeira página que é SHELL: o
// `index.html` traz a estrutura fixa (pular, topo, abas, main, anúncio) e este
// módulo decide QUAL TELA vive dentro do `#conteudo`, lendo o hash com
// core/rotas.js — a S3a-1 separou a regra justamente para aqui só haver fio.
//
// O CATÁLOGO É UMA VEZ: `loadCatalog` do main.js é chamado na primeira rota e
// a PROMESSA fica guardada. Trocar de aba e voltar não busca de novo, e a
// Jornada recebe essa promessa (web/telas/jornada.js) em vez de chamar o
// módulo — duas buscas concorrentes ao mesmo JSON é o tipo de desperdício que
// ninguém vê no console.
//
// FOCO E ANÚNCIO: quem troca de aba com teclado/leitor de tela precisa saber
// ONDE caiu. Por isso a cada rota: `aria-current` só na aba certa, título
// "<Rótulo> · Atlas", anúncio `casco.anuncio(rotulo)` no `p#anuncio` (a única
// região aria-live da página), rolar ao topo e foco no primeiro `h1` (ou no
// main, sem h1). NA PRIMEIRA PINTURA nada disso: quem abriu o app não pediu
// para ser levado a lugar nenhum — mover o foco sem pedido rouba a posição de
// quem já estava navegando.
import * as modulos from './main.js';
import { registrarSW } from './boot.js';
import { ligarSeloRede } from './rede.js';
// S19c-1 (06/11/2026): o armazém de memória que entra quando o navegador NEGA o
// localStorage. A troca tem de acontecer antes de qualquer leitura — o getter
// estoura, e o casco lê o storage na primeira tela que pinta.
import { garantirArmazem } from './armazem-seguro.js';
import { ABAS, lerRota } from '../core/rotas.js';
import { casco } from '../core/textos.js';

const TITULO_APP = 'Atlas';

// As telas existem como IMPORT DINÂMICO: a pessoa na Jornada nunca baixa o
// código da grade, e vice-versa. Cada módulo exporta montar(raiz, ctx).
const TELAS = Object.freeze({
  jornada: () => import('./telas/jornada.js'),
  explorar: () => import('./telas/explorar.js'),
  revisar: () => import('./telas/revisar.js'),
  perfil: () => import('./telas/perfil.js'),
  // S13b: a página de aulas é tela, não folha. `#/estacao/<slug>/aulas` já era
  // lido pelo núcleo desde a S13a e apontava para nada.
  aulas: () => import('./telas/aulas.js'),
  // S14b1: a casa de uma aula. É a tela que a folha e a lista passaram a
  // apontar, e é o lugar onde a S14b2 vai fechar a aula.
  aula: () => import('./telas/aula.js'),
  // S18c-1: o DESAFIO da estação (J4). A caderneta promete «o desafio da estação
  // aprovado» desde a S17a, e não havia tela para fazê-lo. Tela, não folha:
  // ele tem endereço, título e foco próprios, e dura mais que um gesto.
  desafio: () => import('./telas/desafio.js')
});

// A classe que a CSS ancora para a tela inteira: metro.css abre com `.metro`,
// grade.css com `.grade`. Sem ela a tela montada dentro do main chegaria sem
// layout nenhum — o casco não desenha nada, só escolhe onde desenhar.
// `desafio: ''` por decisão (S18c-1): a raiz da tela É `.revisar` (ela importa o
// desenho de web/telas/revisar-fila.js e as folhas dele), e o casco pôr `desafio`
// sobre ela seria uma classe que nenhum CSS conhece — o mesmo defeito que tirou
// `explorar` e `revisar` da lista na S8. Quem precisa de gancho de cor é o
// `data-estacao`, que a própria tela escreve.
const CLASSE_DA_TELA = Object.freeze({ jornada: 'metro', explorar: '', revisar: '', perfil: 'perfil', aulas: 'aulas', aula: 'aula', desafio: '' });

/**
 * Decide a tela para uma rota, e QUAL FOLHA abrir por cima dela (S5).
 *
 * A estação não é uma tela nova: `#/estacao/<slug>` monta a Jornada e a
 * Jornada levanta a folha. O casco entrega o slug à promessa de tela, que é
 * quem conhece o catálogo. `export` porque a rota é decisão e decisão tem de
 * ser testável (tests/folha.test.js) — sem importar a folha, que puxaria o
 * DOM, e o casco continua sem tocar em document.
 */
export function telaDaRota(rota) {
  // S13b: o PAINEL de aulas é outra tela, não a folha. O endereço continua a
  // estação no caminho — é ele que diz QUAL estação — mas quem se monta é a
  // página da lista, com `folha` carregando o slug para ela ler o catálogo.
  if (rota?.tela === 'estacao' && rota.painel === 'aulas') {
    return { tela: 'aulas', folha: String(rota.slug || '') };
  }
  // S14b1: a PÁGINA DA AULA é tela, não folha — `#/estacao/<slug>/aula/<n>` é
  // lida pelo núcleo desde a S14a e apontava para nada. O `n` viaja no objeto
  // devolvido porque a tela não sabe ler endereço: quem lê rota é o casco, e o
  // número da aula é decisão de rota (core/rotas.js), não de tela.
  if (rota?.tela === 'estacao' && rota.painel === 'aula') {
    return { tela: 'aula', folha: String(rota.slug || ''), n: Number(rota.n) || 0 };
  }
  // S18c-1: o desafio é painel, como `aulas` e `aula` — o endereço continua a
  // estação no caminho (é ele que diz QUAL estação), e quem se monta é a tela do
  // desafio com o slug em `folha`. Sem este ramo, `#/estacao/x/desafio` cairia no
  // ramo de baixo e levantaria a Jornada com a folha aberta: a pessoa veria a
  // estação, não o desafio que pediu.
  if (rota?.tela === 'estacao' && rota.painel === 'desafio') {
    return { tela: 'desafio', folha: String(rota.slug || '') };
  }
  if (rota?.tela === 'estacao') return { tela: 'jornada', folha: String(rota.slug || '') };
  return { tela: TELAS[rota.tela] ? rota.tela : 'jornada', folha: null };
}

export async function iniciar(deps = {}) {
  const doc = deps.document || document;
  const win = deps.window || window;
  // S19c-1: a primeira coisa que o casco faz é garantir que ler o armazenamento
  // não estoure. `win.localStorage` é um GETTER, e com «bloquear dados de sites»
  // ele LANÇA SecurityError ao ser lido — não ao chamar getItem. Antes desta
  // linha o casco morria no meio do `iniciar`, o catch do auto-boot escrevia no
  // console, e o aluno ficava com marca, abas e `<main>` vazio em toda rota.
  // Ficou acima do `getElementById` de propósito: a ordem é a de quem não pode
  // falhar antes de existir.
  const semArmazenamento = garantirArmazem(win);
  const main = doc.getElementById('conteudo');
  const anuncio = doc.getElementById('anuncio');
  const nav = doc.querySelector('nav[aria-label="Principal"]');
  if (!main || !anuncio || !nav) return { ok: false, motivo: 'casco sem #conteudo/#anuncio/nav' };

  // S19c-1: o AVISO de que o aparelho não deixa guardar. Entra ANTES do main
  // porque é o único estado do casco que sobrevive a todas as telas: esvaziado
  // o main a cada rota, um aviso dentro dele sumiria na primeira troca de aba —
  // e é irmão do selo de rede pela mesma razão (S10b, régua 1). `role="status"`
  // e não aria-live escrito: é a região implícita polite do HTML, e a heurística
  // 9 da casa (uma frase por região que fala) é atendida por ser um `p`.
  if (semArmazenamento && main.parentNode) {
    const aviso = doc.createElement('p');
    aviso.className = 'aviso-sem-armazenamento';
    aviso.setAttribute('role', 'status');
    aviso.textContent = casco.semArmazenamento;
    main.parentNode.insertBefore(aviso, main);
  }

  let catalogo = null; // a promessa, não o resultado
  // S5: `folha` é o slug que a rota pediu. O casco NÃO conhece a folha (ela é
  // tela, e tela não é casco): só entrega o que a rota disse, pela mesma
  // promessa do catálogo. Quem tem o catálogo decide o que fazer com ele.
  // S10c (item 4): `document` e `window` entram no contexto. As telas já
  // pediam os dois — revisar.js:78 e perfil.js:158 lêem `ctx.window || window`
  // e o JSDoc delas lista `window?` como parte do contrato — e no navegador o
  // global escondia o fato de que o CASCO, dono dos dois, nunca os entregava.
  // Sem este fio, montar o casco num documento que não é o global (qualquer
  // teste, qualquer embed futuro) morria em ReferenceError: primeiro no
  // metro.js:934, depois no revisar.js:78. A injeção sempre foi o contrato;
  // faltava o cabo.
  const contexto = {
    document: doc, window: win, modulos,
    get catalogo() { return catalogo; },
    get folha() { return folhaPedida; },
    // S14b1: o número da aula. A tela não lê endereço — quem lê é o casco
    // (core/rotas.js), e o que ela recebe é o número já decidido pela rota.
    get n() { return numeroPedido; }
  };
  let folhaPedida = null;
  let numeroPedido = 0;
  let atual = null; // { tela, instancia } — para o desmontar da saída
  let primeira = true;

  /**
   * Qual aba da barra a rota ativa — nem toda tela é uma aba (S14b1).
   *
   * A página da aula é filha da Jornada: quem está em `#/estacao/x/aula/3` está
   * percorrendo a viagem, e uma barra sem nada marcado diria "você saiu do app".
   * `aulas` ficou de fora de propósito, e é uma decisão a conferir: a página de
   * listas é um desvio para olhar ementas, não um ponto do caminho — marcar
   * Jornada nela seria a barra dizendo que a pessoa está onde não está. Se a
   * pessoa achar que deveria marcar, a linha abaixo ganha `|| nome === 'aulas'`
   * e a trava do teste muda junto.
   */
  function abaDaRota(nome, rota) {
    if (rota?.tela === 'estacao' && rota.painel === 'aula') return 'jornada';
    return nome;
  }

  function abaAtiva(nome) {
    for (const link of nav.querySelectorAll('a')) {
      const ativa = link.getAttribute('data-tela') === nome;
      if (ativa) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  async function pintar(rota) {
    // Âncora comum (#conteudo do "Pular"): não é rota, não se pinta nada.
    // Ignorar aqui é o que impede o link de pular de trocar a tela no clique.
    if (!rota) return;
    let { tela: nome, folha, n } = telaDaRota(rota);
    folhaPedida = folha;
    numeroPedido = Number(n) || 0;
    if (rota.desconhecida) {
      // Rota que ninguém reconhece: volta para #/ SEM criar entrada no
      // histórico — o botão "voltar" do aluno não pode ficar preso num
      // endereço fantasma até ele desistir do app.
      try { win.history.replaceState(null, '', '#/'); } catch { /* file:// */ }
      nome = 'jornada';
    }

    if (atual?.instancia?.desmontar) atual.instancia.desmontar();

    // Esvazia de verdade: textContent='' deixa o main vazio nos dois mundos
    // (navegador e mini-DOM), e a tela entra com sua classe de animação.
    main.textContent = '';
    const box = doc.createElement('div');
    box.className = 'tela';
    box.classList.add('tela-entra');
    if (CLASSE_DA_TELA[nome]) box.classList.add(CLASSE_DA_TELA[nome]);
    main.append(box);

    const mod = await TELAS[nome]();
    const instancia = await mod.montar(box, contexto);
    atual = { tela: nome, instancia };

    const nomeDaAba = abaDaRota(nome, rota);
    const aba = ABAS.find((a) => a.tela === nomeDaAba) || ABAS[0];
    abaAtiva(nomeDaAba);
    // S13b (painel de aulas): uma tela que NÃO é aba se nomeia sozinha, pelo
    // `rotulo` que o `montar` devolve. Sem isto, `#/estacao/x/aulas` receberia o
    // rótulo da ABAS[0] e o app announced "Jornada" sobre uma lista de aulas —
    // título e anúncio mentindo juntos, o que a régua 6 da S10 existe para evitar.
    const rotulo = instancia?.rotulo || aba.rotulo;
    doc.title = `${rotulo} · ${TITULO_APP}`;
    // S10 régua 6: no celular e no tablet quem rola é o MAIN (a janela está
    // trancada, para a barra fixa não cobrir o fim da tela); no computador o
    // @media de 1024px devolve a rolagem à janela. Zerar os dois é um linha só,
    // e é o que faz trocar de aba chegar no topo da aba nova — zerar só a janela
    // deixaria a tela nova aberta no meio da rolagem da anterior.
    win.scrollTo?.(0, 0);
    main.scrollTo?.(0, 0);

    if (primeira) {
      // Quem abriu o app já está onde queria: sem anúncio, sem mover foco.
      primeira = false;
      return;
    }
    // S14b1: a tela pode dizer outra frase para o leitor de tela. Na página da
    // aula o TÍTULO da aba é "Aula 3 · Circuitos Digitais" (onde eu estou) e o
    // ANÚNCIO é "Aula 3 de 93: <título da aula>" (o que eu abri) — a posição na
    // playlist e o nome do vídeo não cabem numa frase só, e nenhum dos dois é
    // menos importante. Sem `anuncio` na tela, o comportamento é o de sempre.
    anuncio.textContent = instancia?.anuncio || casco.anuncio(rotulo);
    const alvo = box.querySelector('h1') || main;
    alvo.setAttribute('tabindex', '-1');
    alvo.focus?.({ preventScroll: true });
  }

  win.addEventListener('hashchange', () => pintar(lerRota(win.location.hash)));

  // O service worker: a função mora no boot.js (com teste), o casco é quem a
  // chama agora. Sem catálogo antes do SW — registro e dados não competem.
  registrarSW(win, (texto) => { anuncio.textContent = texto; });

  // O SELO DE REDE (S10b, régua 1): a lógica toda mora em web/rede.js, com
  // teste; aqui é só o fio, do mesmo jeito do registrarSW acima. Antes da
  // primeira pintura, porque quem abre o app sem rede tem de ler o aviso no
  // primeiro quadro — e `metro.html`, que não tem o selo, recebe `{ok:false}`
  // em vez de um TypeError na tela branca.
  ligarSeloRede({ document: doc, window: win });

  catalogo = modulos.loadCatalog();
  catalogo.catch(() => {}); // a tela trata o erro na pintura; sem isso é rejeição órfã
  await pintar(lerRota(win.location.hash));
  return { ok: true, pintar };
}

// Auto-boot só na página com o casco montado — a mesma régua que o metro.js
// aprendeu na 2c: importar o módulo não pode montar tela onde não há raiz.
export const inicio =
  typeof document !== 'undefined' && typeof document.getElementById === 'function'
    ? document.getElementById('conteudo')
      ? iniciar().catch((erro) => {
          console.error('[atlas] o casco não subiu:', erro); // eslint-disable-line no-console
          return { ok: false, erro };
        })
      : null
    : null;
