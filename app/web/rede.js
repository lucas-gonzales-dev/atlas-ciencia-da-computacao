// Projeto Atlas — o SELO DE REDE do casco (S10b, 03/11/2026).
//
// POR QUE EXISTE: a régua 1 (design/v2/S10-auditoria.md, item 7) é o único
// estado da tabela que não pertence a nenhuma tela. O catálogo, as folhas de
// estilo e os módulos estão no precache: estar offline é o Atlas INTEIRO
// funcionando, e um banner em cada tela anunciaria um problema que não existe.
// Quem avisa é o invólucro, uma vez — `core/textos.js` já tinha a frase
// (`estados.offline`, título + respiro), faltava só quem a escrevesse.
//
// POR QUE UM ARQUIVO E NÃO UMA LINHA DO CASCO: handler de evento global sem
// teste é o que a casa não aceita (27/10, o `avisar` que escapou; 01/11, a tela
// branca com a suíte verde). Aqui não há DOM verdadeiro nem `window` de
// navegador: entram por argumento, e o teste puxa o cabo
// (`dispatch('offline')`) em vez de conjecturar.
//
// O fio é o `navigator.onLine` do navegador com os eventos `online`/`offline`,
// lidos na JANELA que entra por deps — nunca no global, que não existe no node.
import { estados } from '../core/textos.js';

/**
 * Liga o selo de rede da página. Idempotente por chamada, e MUDO quando a
 * página não tem o selo: `metro.html` é o redirecionamento da v1 e nenhuma tela
 * afora do casco tem `#estado-rede`. Devolver `{ok:false}` em vez de estourar é
 * o que impõe a regra da casa — um `id` ausente não derruba a primeira pintura.
 *
 * @param {{document?: Document, window?: Window}} deps
 * @returns {{ok: boolean, motivo?: string, selo?: Element}}
 */
export function ligarSeloRede(deps = {}) {
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const win = deps.window || (typeof window !== 'undefined' ? window : null);
  const selo = doc && typeof doc.getElementById === 'function'
    ? doc.getElementById('estado-rede')
    : null;
  if (!selo) return { ok: false, motivo: 'a página não tem #estado-rede' };
  if (!win || typeof win.addEventListener !== 'function') {
    return { ok: false, motivo: '#estado-rede sem janela para escutar' };
  }

  // Começa calado e só fala sem rede: quem abre o app conectado não pode ler
  // «offline» por um instante antes do primeiro pintar.
  const pintar = () => {
    if (win.onLine === false) {
      selo.textContent = `${estados.offline.titulo} · ${estados.offline.descricao}`;
      selo.removeAttribute('hidden');
    } else {
      selo.textContent = '';
      selo.setAttribute('hidden', '');
    }
  };

  win.addEventListener('online', pintar);
  win.addEventListener('offline', pintar);
  pintar();
  return { ok: true, selo };
}
