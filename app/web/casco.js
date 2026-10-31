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
import { ABAS, lerRota } from '../core/rotas.js';
import { casco } from '../core/textos.js';

const TITULO_APP = 'Atlas';

// As telas existem como IMPORT DINÂMICO: a pessoa na Jornada nunca baixa o
// código da grade, e vice-versa. Cada módulo exporta montar(raiz, ctx).
const TELAS = Object.freeze({
  jornada: () => import('./telas/jornada.js'),
  explorar: () => import('./telas/explorar.js')
});

// A classe que a CSS ancora para a tela inteira: metro.css abre com `.metro`,
// grade.css com `.grade`. Sem ela a tela montada dentro do main chegaria sem
// layout nenhum — o casco não desenha nada, só escolhe onde desenhar.
const CLASSE_DA_TELA = Object.freeze({ jornada: 'metro', explorar: '' });

/**
 * Decide a tela para uma rota. `estacao` ainda não tem tela própria (deep-link
 * é fatia futura): cai na Jornada, que é o comportamento de sempre.
 */
function telaDaRota(rota) {
  return TELAS[rota.tela] ? rota.tela : 'jornada';
}

export async function iniciar(deps = {}) {
  const doc = deps.document || document;
  const win = deps.window || window;
  const main = doc.getElementById('conteudo');
  const anuncio = doc.getElementById('anuncio');
  const nav = doc.querySelector('nav[aria-label="Principal"]');
  if (!main || !anuncio || !nav) return { ok: false, motivo: 'casco sem #conteudo/#anuncio/nav' };

  let catalogo = null; // a promessa, não o resultado
  const contexto = { modulos, get catalogo() { return catalogo; } };
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
    let nome = telaDaRota(rota);
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
    win.scrollTo?.(0, 0);

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
