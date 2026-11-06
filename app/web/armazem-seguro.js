// Projeto Atlas — o armazém que existe quando o navegador nega o dele (S19c-1).
//
// O DEFEITO (engenharia do caos, 06/11/2026): com «bloquear dados de sites», o
// GETTER de `win.localStorage` LANÇA `SecurityError` — ler a propriedade já é a
// explosão, não o `getItem`. O casco morria no `iniciar` e o index.html ficava
// marca + abas + `<main>` vazio em TODAS as rotas: tela branca com a suíte
// verde, porque nenhum dublê de teste jamais negou o storage.
//
// A RESPOSTA: memória com a mesma cara do Storage, e `true` para o casco poder
// avisar. Não é persistência fingida — o que se salva é a SESSÃO, e o aviso diz
// isso na tela: deixar de montar o app por não poder guardar é o defeito; estudar
// sem guardar é o que o aparelho oferece. `configurable: true` porque o getter
// negado é own-property, e um armazém travado impediria de voltar a ler storage
// real. A troca é tentativa; o `false` pinta sem aviso — sem storage e sem
// memória, a tela pelo menos abre.

/** A sonda: só LER a propriedade já estoura quando o navegador a nega. */
const SONDA = 'atlas.almazem.sonda';

/** O mesmo contrato do Storage, em memória, sem persistência nenhuma. */
function emMemoria() {
  const mapa = new Map();
  return {
    getItem: (chave) => (mapa.has(String(chave)) ? mapa.get(String(chave)) : null),
    setItem: (chave, valor) => { mapa.set(String(chave), String(valor)); },
    removeItem: (chave) => { mapa.delete(String(chave)); },
    clear: () => mapa.clear(),
    key: (i) => [...mapa.keys()][Number(i)] ?? null,
    get length() { return mapa.size; }
  };
}

/**
 * Garante que `win.localStorage` seja legível, trocando-o por memória se não for.
 * @returns {boolean} `true` só quando o navegador negou e a troca aconteceu
 */
export function garantirArmazem(win) {
  if (!win) return false;
  try {
    const real = win.localStorage;
    if (typeof real?.getItem !== 'function') return false;
    void real.getItem(SONDA);
  } catch {
    try {
      Object.defineProperty(win, 'localStorage', { configurable: true, value: emMemoria() });
    } catch {
      return false;
    }
    return true;
  }
  return false;
}
