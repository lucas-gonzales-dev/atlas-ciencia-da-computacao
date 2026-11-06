// Projeto Atlas — boot da página (27/10/2026), versão mínima (S7-1c, 01/11/2026).
//
// O QUE E ESTE ARQUIVO HOJE: só registrarSW. A grade antiga morreu com a S7 —
// `montarGrade`, o estado de tela, o toggle e os binds que viviam aqui saíram,
// porque nada no app os chama: a Explorar se desenha em web/telas/explorar.js,
// o progresso mora na folha/metrô, e a exportação portátil tem casa prometida
// na S9 (perfil). main.js continua vivo pelo contrato do metro.js
// (aplicarNota, saveNotas, loadNotas...). O git guarda o arquivo inteiro;
// apagar código morto sem teste novo é o contrário do que esta casa faz — e
// os três testes que cobriam a montagem morreram juntos, com o motivo escrito
// no boot.test.js.
//
// ANTES DISSO, o arquivo já tinha pago duas lições, e elas continuam valendo:
// (1) código inline no index.html não entra em teste nenhum — foi assim que o
// bug do hook `avisar` chegou ao navegador (bindProgressIO pede `avisar`, a
// página tinha `aviso`; ReferenceError invisível para quem não abre o browser);
// (2) o boot NÃO sobe sozinho ao ser importado (S3a-2a): quem decide quando a
// tela nasce é o casco. pages.test.js cobra as duas coisas.
//
// TESTABILIDADE: node não é navegador. Aqui o win entra por argumento, e o
// boot.test.js instala um navigator de mentira que prova o escopo relativo e o
// aviso de versão só na segunda visita.

/**
 * Registra o service worker DEPOIS da primeira pintura: registrar antes
 * atrasaria o que o aluno veio ver.
 *
 * Falha aqui NAO pode derrubar a tela — em file:// e em navegadores sem
 * suporte, `navigator.serviceWorker` simplesmente nao existe, e por isso a
 * checagem e por valor, nao por try/catch de import.
 *
 * ESCOPO RELATIVO, e este e o detalhe que quebra em silencio: publicado em
 * subcaminho (foi assim que o GitHub Pages serviria), um escopo '/' apontaria para a
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
      // FORÇA a checagem do sw.js nesta abertura (01/11/2026). O navegador só
      // compara os bytes do service worker quando a URL dele é buscada de novo,
      // e isso não tem hora: quem abre o Atlas todo dia pode passar dias com o
      // cache-first do sw.js servindo o snapshot de uma versão que já morreu no
      // disco. update() pergunta agora. O catch é obrigatório: update() é
      // recusado sem service worker em http, e derrubar o boot por isso é o
      // oposto do motivo pelo qual ele existe.
      reg.update?.().catch(() => {});
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
