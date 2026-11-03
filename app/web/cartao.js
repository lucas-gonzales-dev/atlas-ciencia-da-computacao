// Projeto Atlas — o desenho do cartão de divulgação (S11a, 03/11/2026).
//
// POR QUE EXISTE EM SEPARADO: o index.html não leva código inline (pages.test.js
// cobra, com motivo: o que mora dentro do HTML não chega a teste nenhum — foi
// assim que o `avisar` escapou, em 27/10). A cartao.html é matéria-prima de
// imagem; o desenho dela mora aqui, e assim é importável pelo vitrine.test.js,
// que roda ESTE mesmo módulo no Node e confere a viagem que vai na foto.
//
// O QUE ESTE ARQUIVO NÃO DECIDE: nada sobre a rede. Malha, estado de estação,
// placa e contadores vêm do MESMO caminho da Jornada — core/viagem.js por dentro
// de web/metro.js, com o data/catalog.json real. Um cartão desenhado à mão seria
// um cartão mentindo.
//
// A VIAGEM É FABRICADA, e é dito em voz alta em vez de escondido: um cartão com
// progresso zero desenharia uma rede toda trancada, que é a cara de quem ainda
// não embarcou. Os ids abaixo são DERIVADOS das linhas, nunca escritos por mim —
// a primeira versão deste arquivo tinha ids inventados por mim, o mapa saiu com
// "0 de 35" e NENHUMA trava avisou, porque nenhum teste olhava o cartão. É o
// buraco que o vitrine.test.js fecha.
import { desenharMetro, estacoesDaLinha } from './metro.js';
import { iniciarEstacao } from '../core/viagem.js';

const LINHA_PERCORRIDA = 1; // a linha toda concluída: "Comece pela Linha 1"
const LINHA_NO_MAPA = 2; // a linha desenhada no diagrama, com progresso pela metade
const FEITAS_NA_SEGUNDA = 2; // estações concluídas no início da Linha 2

/**
 * A viagem do cartão, no formato que o núcleo entende, derivada do catálogo.
 *
 * `conclusoes` fica vazio de propósito: `concluirEstacao` escreve a data de
 * HOJE, e num cartão publicado hoje e lido em março uma data viva seria uma
 * afirmação sobre o futuro. A folha não aparece no cartão, e o carimbo é da
 * folha.
 */
export function viagemDoCartao(catalogo) {
  const uma = estacoesDaLinha(catalogo, LINHA_PERCORRIDA).map((c) => c.id);
  const duas = estacoesDaLinha(catalogo, LINHA_NO_MAPA).map((c) => c.id);
  const base = {
    completed: [...uma, ...duas.slice(0, FEITAS_NA_SEGUNDA)],
    emCurso: [],
    conclusoes: {}
  };
  const emCurso = duas[FEITAS_NA_SEGUNDA];
  if (!emCurso) return base;
  // `iniciarEstacao` não muta se a estação estiver trancada: testa o resultado
  // em vez de assumir que a rede de hoje abre a rede de amanhã.
  const tentada = iniciarEstacao(base, emCurso, catalogo);
  return tentada.emCurso.includes(emCurso) ? tentada : base;
}

/**
 * Desenha o cartão na raiz dada. Mesma chamada da Jornada, mesmo desenho.
 *
 * @param {Document} doc
 * @param {Element} root
 * @param {Array} catalogo courses do data/catalog.json
 * @returns {object} os nós que `desenharMetro` devolver
 */
export function desenharCartao(doc, root, catalogo) {
  return desenharMetro(doc, root, {
    catalogo,
    progresso: viagemDoCartao(catalogo),
    linha: LINHA_NO_MAPA,
    despertas: estacoesDaLinha(catalogo, 3).slice(0, 1).map((c) => c.id)
  });
}

// ── só no navegador: a página abre, busca o catálogo e desenha ──
const rodaNoNavegador = typeof document !== 'undefined' && typeof fetch === 'function';

if (rodaNoNavegador) {
  const raiz = document.getElementById('metro');
  fetch('data/catalog.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json || !Array.isArray(json.courses)) return;
      desenharCartao(document, raiz, json.courses);
    })
    .catch(() => {});
  // Sem catálogo não há desenho: a moldura (título + endereço) já está no HTML,
  // e o script que fotografa mede o PNG, então um mapa ausente aparece na
  // conferência como cartão errado, não como cartão branco silencioso.
}
