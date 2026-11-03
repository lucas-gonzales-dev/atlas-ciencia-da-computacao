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
import { ABAS, lerRota } from '../core/rotas.js';
import { casco } from '../core/textos.js';

const TITULO_APP = 'Atlas';

// As telas existem como IMPORT DINÂMICO: a pessoa na Jornada nunca baixa o
// código da grade, e vice-versa. Cada módulo exporta montar(raiz, ctx).
const TELAS = Object.freeze({
  jornada: () => import('./telas/jornada.js'),
  explorar: () => import('./telas/explorar.js'),
  revisar: () => import('./telas/revisar.js'),
  perfil: () => import('./telas/perfil.js')
});

// A classe que a CSS ancora para a tela inteira: metro.css abre com `.metro`,
// grade.css com `.grade`. Sem ela a tela montada dentro do main chegaria sem
// layout nenhum — o casco não desenha nada, só escolhe onde desenhar.
const CLASSE_DA_TELA = Object.freeze({ jornada: 'metro', explorar: '', revisar: '', perfil: 'perfil' });

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
  if (rota?.tela === 'estacao') return { tela: 'jornada', folha: String(rota.slug || '') };
  return { tela: TELAS[rota.tela] ? rota.tela : 'jornada', folha: null };
}

export async function iniciar(deps = {}) {
  const doc = deps.document || document;
  const win = deps.window || window;
  const main = doc.getElementById('conteudo');
  const anuncio = doc.getElementById('anuncio');
  const nav = doc.querySelector('nav[aria-label="Principal"]');
  if (!main || !anuncio || !nav) return { ok: false, motivo: 'casco sem #conteudo/#anuncio/nav' };

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
    get folha() { return folhaPedida; }
  };
  let folhaPedida = null;
  let atual = null; // { tela, instancia } — para o desmontar da saída
  let primeira = true;

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
    let { tela: nome, folha } = telaDaRota(rota);
    folhaPedida = folha;
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

    const aba = ABAS.find((a) => a.tela === nome) || ABAS[0];
    abaAtiva(nome);
    doc.title = `${aba.rotulo} · ${TITULO_APP}`;
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
    anuncio.textContent = casco.anuncio(aba.rotulo);
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
