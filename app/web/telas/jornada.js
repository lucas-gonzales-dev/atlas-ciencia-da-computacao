// Projeto Atlas — a tela JORNADA: o metrô de dentro do casco (S3a-2a).
//
// POR QUE EXISTE: a fatia S3a-2a liga as rotas ao casco, e a primeira tela do
// app é a do metrô (2c/2d). O desenho inteiro já mora em web/metro.js, com 69
// testes; este arquivo é fino de propósito — ele só traduz o contexto do casco
// para os `deps` que o `subirMetro` já aceita. Regra da casa: nada de regra de
// tela aqui; quem decide o que destranca, o que tranca e o que é marco é o
// core/viagem.js, chamado pelo metro.js.
//
// O CATÁLOGO É UMA VEZ: `ctx.catalogo` é a PROMESSA que o casco guardou. Trocar
// o `loadCatalog` do módulo por uma função que devolve essa promessa é o que
// impede duas buscas ao mesmo JSON quando a pessoa vai e volta entre abas — e é
// o motivo de `modulos` ser espalhado num objeto novo em vez de passado direto:
// mutar o namespace importado não é possível, e fingir que é criaria um dublê
// com interface inventada (o defeito do `applyNote` de 32469d9, que passou em
// todos os testes e quebrou no navegador).
import { subirMetro } from '../metro.js';

/**
 * Monta a Jornada na raiz escolhida pelo casco.
 *
 * @param {Element} raiz o contêiner da tela (já dentro do `#conteudo`)
 * @param {{catalogo: Promise<object>, modulos: object}} ctx contexto do casco
 * @returns {Promise<object>} o que o `subirMetro` devolver
 */
export async function montar(raiz, ctx) {
  const modulos = {
    ...ctx.modulos,
    // A promessa do casco, não uma chamada nova ao main.js.
    loadCatalog: () => ctx.catalogo
  };
  return subirMetro({ root: raiz, modulos });
}
