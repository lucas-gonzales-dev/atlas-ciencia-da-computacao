// Projeto Atlas — boot da pagina (27/10/2026).
//
// O QUE E ESTE ARQUIVO: tudo o que a pagina faz ao abrir, FORA do index.html.
// Antes vivia num <script type="module"> inline, e codigo inline nao entra em
// teste nenhum — o node importa modulos, nao HTML. Foi assim que o bug do hook
// `avisar` chegou ao navegador: o bindProgressIO de web/main.js pede `avisar`,
// a pagina tinha `aviso`, e escrever `avisar` ali era shorthand de uma variavel
// inexistente. ReferenceError no primeiro clique do importador — invisivel para
// qualquer teste que importasse main.js, visivel so no celular do aluno.
//
// REGRA: nenhuma regra de negocio aqui. Disponivel/trancada/ciclo vem de
// core/progress.js; validacao de arquivo vem de core/progress-io.js; filtro vem
// de core/search.js. Este arquivo so liga estado -> tela e captura eventos.
// Se aparecer um `if` de pre-requisito aqui, esta errado.
//
// TESTABILIDADE: duas funcoes exportadas, e `inicio` e a promise do boot que
// roda sozinho quando a pagina abre. app/tests/boot.test.js instala um
// document/window/localStorage de mentira e prova que (a) sobe sem
// ReferenceError, (b) o fio `avisar` existe de verdade, (c) o escopo do service
// worker e relativo. node nao e navegador: layout e PWA instalada continuam
// sendo assunto do testar_pagina.
import {
  loadCatalog,
  loadCompleted,
  saveCompleted,
  render,
  bind,
  bindProgressIO,
  montarBusca,
  // Anotacoes por disciplina (28/10/2026): o estado ganha um campo, e a tela
  // ganha um listener. Nenhuma regra nova aqui — limite, corte e validacao estao
  // em core/notes.js.
  loadNotas,
  saveNotas,
  aplicarNota,
  bindNotas
} from './main.js';

const root = document.getElementById('app');

let state = {
  courses: [],
  completed: loadCompleted(),
  // Carregado no boot, e nao na primeira escrita: a anotacao que ja estava no
  // aparelho tem de voltar no campo assim que a tela abre.
  anotacoes: loadNotas(),
  origem: 'carregando…',
  busca: ''
};

function paint() {
  render(root, state);
}

/**
 * Recado na tela. Um lugar so: aviso de salvamento, de importacao e de
 * atualizacao do service worker passam por aqui. Troca o anterior em vez de
 * empilhar — tres alertas liguais sobrepostos nao se leem.
 */
function aviso(texto) {
  root.querySelector('p.aviso-save')?.remove();
  const p = document.createElement('p');
  p.className = 'alerta aviso-save';
  p.textContent = texto;
  root.prepend(p);
}

// Unico lugar que muda `completed`. Regra de negocio fica em core/progress.js.
function toggle(id) {
  const tem = state.completed.includes(id);
  state.completed = tem
    ? state.completed.filter((x) => x !== id)
    : [...state.completed, id];

  if (!saveCompleted(state.completed)) {
    aviso('Não consegui salvar neste navegador: o progresso vale só enquanto esta aba estiver aberta.');
  }
  paint();
}

/**
 * Registra o service worker DEPOIS da primeira pintura: registrar antes
 * atrasaria o que o aluno veio ver.
 *
 * Falha aqui NAO pode derrubar a tela — em file:// e em navegadores sem
 * suporte, `navigator.serviceWorker` simplesmente nao existe, e por isso a
 * checagem e por valor, nao por try/catch de import.
 *
 * ESCOPO RELATIVO, e este e o detalhe que quebra em silencio: publicado em
 * https://<usuario>.github.io/atlas-kit-tools/, um escopo '/' apontaria para a
 * raiz do DOMINIO, o sw.js estaria fora do escopo pedido e o navegador
 * RECUSARIA o registro — app instalado sem offline nenhum, sem erro na tela.
 * O escopo sai da URL do documento (baseURI), que vale na raiz e no subcaminho.
 *
 * AVISO DE VERSAO NOVA SO NA SEGUNDA VEZ (28/10/2026). Na PRIMEIRA visita o
 * navegador tambem passa por installing -> activated, porque instalar e o que
 * ele faz quando nao ha nada instalado. O codigo anterior ouvia `updatefound`
 * sem perguntar se ja existia um SW no controle, entao a primeira visita lia
 * "Nova versao instalada. Ela vale na proxima abertura." sem que nada tivesse
 * sido atualizado — um recado falso na primeira impressao do app. A regra agora
 * e a que o Claude escreveu: so ha "versao nova" quando ja havia um service
 * worker controlando a pagina ANTES do registro, e isso se le em
 * `navigator.serviceWorker.controller` capturado ANTES de chamar register()
 * (depois do registro, clients.claim() do sw.js pode preencher o campo e a
 * prova some — foi lendo o lugar errado, `navigator.controller`, que o primeiro
 * rascunho desta correcao falhou no proprio teste).
 *
 * @param {object} win janela (injetavel para teste; no navegador, globalThis)
 * @param {(texto: string) => void} avisar
 * @returns {Promise<{registrado: boolean, escopo?: string, motivo?: string, jaControlava?: boolean}>}
 */
export async function registrarSW(win, avisar) {
  const nav = win?.navigator;
  if (!nav || typeof nav.serviceWorker?.register !== 'function') {
    return { registrado: false, motivo: 'este ambiente nao tem serviceWorker' };
  }
  if (!String(win?.location?.protocol ?? '').startsWith('http')) {
    return { registrado: false, motivo: 'protocolo nao-http (file://): o navegador nao permite sw' };
  }
  // ANTES do register: e a unica leitura que prova que ja havia um SW no controle.
  const jaControlava = Boolean(nav.serviceWorker?.controller);
  try {
    const escopo = new URL('./', win.document.baseURI).pathname;
    const reg = await nav.serviceWorker.register('sw.js', { scope: escopo });
    if (jaControlava) {
      reg.addEventListener?.('updatefound', () => {
        const novo = reg.installing;
        novo?.addEventListener('statechange', () => {
          if (novo.state === 'activated') {
            avisar?.('Nova versão instalada. Ela vale na próxima abertura.');
          }
        });
      });
    }
    return { registrado: true, escopo, jaControlava };
  } catch (e) {
    // console.warn e nao aviso(): registro recusado e problema do app, nao do
    // aluno — jogar recado vermelho na tela dele por isso seria ruído.
    win.console?.warn?.('service worker nao registrou:', e.message);
    return { registrado: false, motivo: e.message };
  }
}

/**
 * Sobe a pagina. Exportada (e nao so executada) porque o teste precisa do
 * resultado: `{ok, state}` diz se carregou, com que dados e com que progresso.
 */
async function subir() {
  const {
    courses, origem, electives, origemEletivas, specializations, origemEspecializacoes
  } = await loadCatalog();
  state = { ...state, courses, origem, electives, origemEletivas, specializations, origemEspecializacoes };

  // BUSCA (27/10/2026): montarBusca cria o campo no slot externo e liga o
  // evento 'input' ao estado -> redesenho. A regra de filtrar (sem acento, sem
  // caixa, nas tres listas) mora em core/search.js, com teste no node; aqui nao
  // ha regra nenhuma. Sem debounce de proposito: 35 linhas redesenham mais
  // rapido do que se digita, e debounce so atrasaria o eco sem ganhar nada.
  // O slot vive FORA do root (ver index.html): dentro, render() o apagaria e o
  // campo perderia o foco a cada tecla.
  const buscaSlot = document.getElementById('busca-slot');
  montarBusca(buscaSlot, {
    onChange: (q) => { state = { ...state, busca: q }; paint(); }
  });
  if (buscaSlot) buscaSlot.hidden = false;

  paint();
  bind(root, state, toggle);

  // ANOTACOES (28/10/2026). Delegacao na raiz, pelo mesmo motivo de bind():
  // render() reconstrói o DOM a cada pintura. Redesenhar depois de salvar e o
  // que mantem estado, storage e tela dizendo a mesma coisa.
  bindNotas(root, {
    salvar: (id, texto) => {
      state = aplicarNota(state, id, texto);
      if (!saveNotas(state.anotacoes)) {
        aviso('Não consegui salvar a anotação neste navegador: ela vale só enquanto esta aba estiver aberta.');
      }
      paint();
    }
  });

  // EXPORTAR/IMPORTAR PROGRESSO (27/10/2026). A validacao mora em
  // core/progress-io.js (com teste); aqui so ha estado e recado na tela.
  // `estado` e uma FUNCAO de proposito: `state` e substituido a cada paint, e um
  // valor capturado aqui envelheceria na primeira interacao — o importador
  // validaria contra um catalogo vazio e recusaria arquivo bom.
  // `avisar: aviso` e explicito, NAO shorthand: foi o shorthand `avisar` (nome
  // de uma variavel que nunca existiu) que matou o recado do importador em 27/10.
  bindProgressIO(root, {
    estado: () => state,
    aplicar: (ids, anotacoes) => {
      state = { ...state, completed: ids, anotacoes: anotacoes ?? state.anotacoes };
      if (!saveCompleted(ids)) {
        aviso('Importei, mas não consegui salvar neste navegador: o progresso vale só enquanto esta aba estiver aberta.');
      }
      // As anotacoes tambem vao para o storage: o arquivo importado e o novo
      // estado do aluno, e estado que nao e salvo some no primeiro reload.
      if (!saveNotas(state.anotacoes)) {
        aviso('Importei, mas não consegui salvar as anotações neste navegador.');
      }
      paint();
    },
    avisar: aviso
  });

  const sw = await registrarSW(globalThis.window ?? globalThis, aviso);
  return { ok: true, state, root, sw };
}

// O boot roda sozinho: a pagina carrega este modulo e espera que ele faca tudo.
// Erro aqui vira {ok:false, motivo} em vez de rejeitar a promise — uma rejeicao
// nao tratada no navegador e um console vermelho que o aluno nunca le; o teste,
// por outro lado, precisa do motivo escrito para dizer o que falhou.
export const inicio = subir().catch((e) => ({ ok: false, motivo: `${e.name}: ${e.message}` }));
