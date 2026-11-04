// Projeto Atlas — a LEITURA das aulas (S13a, 04/11/2026).
//
// Por que existe: core/aulas.js traduz o que a YouTube API devolve, e os dados
// já estão no disco (app/data/aulas/, um arquivo por estação, atlas-v54). Falta
// a peça do navegador: trazer o JSON da estação para a tela. Este módulo é só
// isso — não calcula nada, não desenha nada. A regra fica em core/, a pintura em
// web/telas/, e o meio do caminho (o fetch) não pode vazar regra nenhuma.
//
// POR QUE NUNCA LANÇA: a lista de aulas é a única parte do Atlas que depende de
// um arquivo que o service worker ainda pode não ter (quem instalou na v53 não
// tem as aulas no cache até a v55 instalar). Se isto estourasse, o import do
// módulo quebraria a tela inteira; com `{ ok: false }` quem recebe escolhe o que
// dizer — e a frase está em core/textos.js, seção `aulas.semAulas`, com as três
// partes de sempre (o que falhou, por quê, o que fazer).
//
// SEM `cache: 'no-store'` de propósito: main.js usa no-store para o catálogo
// porque catálogo é dado que muda e precisa ser o mais novo; as aulas são
// regeradas uma vez por mês e ESTÃO no precache, então deixar o request como
// vem é o que faz o ônibus sem sinal funcionar. O service worker é cache-first:
// sem rede, ele responde daqui com os bytes do install.
//
// O `fetch` não vai solto no default: `const f = fetch; f(url)` lança "Illegal
// invocation" no Chrome (o this do window se perde), e este módulo é justamente
// a parte que só roda no navegador. A arrow amarrada resolve os dois mundos.

/** Os slugs são do catálogo derivado (`circuitos-digitais`): minúsculo, dígito e hífen. */
const HE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Lê `data/aulas/<slug>.json`.
 *
 * @param {string} slug o slug da estação, como o catálogo o escreve
 * @param {(url: string) => Promise<Response>} [buscar] a rede; um dublê nos testes
 * @returns {Promise<{ok: true, dados: object} | {ok: false, erro: string}>}
 *   `erro` é código ('slug', 'sem-rede', 'nao-encontrado', 'formato'), nunca
 *   frase de tela: a frase mora em core/textos.js.
 */
export async function carregarAulas(slug, buscar = (url) => fetch(url)) {
  if (!HE_SLUG.test(String(slug ?? ''))) return { ok: false, erro: 'slug' };
  const caminho = `data/aulas/${slug}.json`;

  let resposta;
  try {
    resposta = await buscar(caminho);
  } catch {
    // O que o fetch lança depende do navegador e da rede; o que a tela precisa
    // saber é um só: não veio.
    return { ok: false, erro: 'sem-rede' };
  }

  if (!resposta || resposta.ok === false) {
    return { ok: false, erro: resposta?.status === 404 ? 'nao-encontrado' : 'sem-rede' };
  }

  try {
    const dados = await resposta.json();
    // Um 200 com HTML (o fallback de navegação do service worker serve o
    // index.html) ou com um JSON sem `aulas` não é lista de aula nenhuma: a
    // tela receberia `undefined.map` e morreria em outro lugar, sem pista.
    if (!dados || typeof dados !== 'object' || !Array.isArray(dados.aulas)) {
      return { ok: false, erro: 'formato' };
    }
    return { ok: true, dados };
  } catch {
    return { ok: false, erro: 'formato' };
  }
}
