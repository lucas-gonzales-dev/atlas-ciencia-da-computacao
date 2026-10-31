// Projeto Atlas — a tela EXPLORAR: a grade antiga dentro do casco (S3a-2a).
//
// POR QUE EXISTE: a S3a-1 transformou o boot da grade em `montarGrade({raiz,
// slotBusca, catalogo})` exatamente para este momento — a grade deixa de ser
// "a página" e vira UMA TELA, montada na raiz que o casco escolher. O visual
// ainda é o antigo (--p-*, migrating on S3b); o que mudou é o endereço: ela
// mora em #/explorar, não na página inteira.
//
// O #app NÃO TEM aria-live (diferente do index.html antigo): a região viva
// agora é uma frase curta do casco (`p#anuncio`). Uma `div` do tamanho da
// página anunciada inteira a cada tecla de busca é ruído — quem usa leitor de
// tela ouviria a grade toda, de novo, a cada clique.
import { montarGrade } from '../boot.js';

/**
 * Monta a Explorar na raiz escolhida pelo casco.
 *
 * @param {Element} raiz o contêiner da tela (já dentro do `#conteudo`)
 * @param {{catalogo: Promise<object>}} ctx contexto do casco
 * @returns {Promise<object>} o que o `montarGrade` devolver
 */
export async function montar(raiz, ctx) {
  const doc = raiz.ownerDocument || document;
  const grade = doc.createElement('div');
  grade.className = 'grade';
  const slot = doc.createElement('div');
  slot.id = 'busca-slot';
  slot.className = 'busca-slot';
  slot.hidden = true;
  const app = doc.createElement('div');
  app.id = 'app';
  app.className = 'app';
  grade.append(slot, app);
  raiz.append(grade);

  const catalogo = await ctx.catalogo;
  return montarGrade({ raiz: app, slotBusca: slot, catalogo });
}
