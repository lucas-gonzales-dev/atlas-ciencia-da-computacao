// Projeto Atlas — a página AULAS da estação (S13b parte B, 04/11/2026).
//
// POR QUE EXISTE: a folha da estação cabem duas ou três aulas por tela; quem
// quer ver as 93 precisa de uma página só para elas. `#/estacao/<slug>/aulas`
// já era lido pelo núcleo desde a S13a (core/rotas.js) e apontava para nada:
// esta arquivo é o que aquele endereço passa a montar.
//
// REGRAS deste arquivo (as mesmas que a casa já cobra das outras telas):
//   · monta DOM, não calcula. As contas vêm de `painelDeAulas` (que chama
//     core/estudo.js) e a leitura do arquivo vem de web/aulas-dados.js. Nada de
//     regra de desbloqueio, nada de calendário, nada de cor aqui.
//   · nenhuma frase digitada. Título, volta, playlist, nota e os três estados
//     saem de core/textos.js, seção `aulas`; a duração sai de core/aulas.js.
//   · o que a folha e esta página mostram juntas (linha de progresso, primário,
//     nota,href do vídeo) vem de web/aulas-pedacos.js — regra 9, a mesma linha
//     não pode se escrever de dois jeitos em duas telas.
//   · document e window entram pelo contexto (S10c). Importar este módulo não
//     monta nada: quem monta é o casco, e o teste monta à mão.
//
// A LISTA É O QUE A FONTE DIZ: cada item traz o número, o título limpo, a
// duração e o estado que o registro guarda. O estado é `Aberta` ou
// `Não iniciada` — nunca `Estudada`, que a S14 ainda não existe. A aula por
// onde continuar leva `aria-current="true"`: é o ponto de retorno, e um leitor
// de tela que percorre a lista tem de saber onde a pessoa está sem ler o
// primário lá em cima.
//
// A REPINTURA É O QUE FECHA O CICLO (parte C): o clique na aula grava a abertura
// ANTES de sair do Atlas (`ligarAberturaDeAula`, no compartido) e a volta da
// outra aba pinta de novo. Sem repintar, a pessoa voltaria e veria "Começar:
// Aula 1" por baixo de uma lista que acabou de abrir a 13.
import { duracaoLegivel } from '../../core/aulas.js';
import { hrefDe } from '../../core/rotas.js';
import { estadoDaAula } from '../../core/estudo.js';
import { comValores, aulas as A } from '../../core/textos.js';
import { fatosDaEstacao } from '../../core/viagem.js';
import { seloLinha } from '../folha.js';
import {
  estudoDoStorage,
  hrefVideo,
  ligarAberturaDeAula,
  linhaProgresso,
  notaAbrirAula,
  painelDeAulas,
  primarioAula,
} from '../aulas-pedacos.js';
import { carregarAulas } from '../aulas-dados.js';

const CLASSE = 'aulas';

function no(doc, tag, classe, attrs) {
  const n = doc.createElement(tag);
  if (classe) n.className = classe;
  for (const chave of Object.keys(attrs || {})) {
    if (chave === 'text') n.textContent = String(attrs[chave]);
    else n.setAttribute(chave, String(attrs[chave]));
  }
  return n;
}

/** Os três pedaços de sempre quando o arquivo das aulas não está no aparelho. */
function avisoSemAulas(doc) {
  const caixa = no(doc, 'div', 'aulas-erro');
  caixa.append(
    no(doc, 'p', 'aulas-erro-um', { text: A.semAulas.parteUm }),
    no(doc, 'p', 'aulas-erro-dois', { text: A.semAulas.parteDois }),
    no(doc, 'p', 'aulas-erro-tres', { text: A.semAulas.parteTres })
  );
  return caixa;
}

/** Um item da lista. Nenhum texto é daqui: número e título são dados, o resto vem de textos.js. */
function itemDaAula(doc, { aula, estudo, playlist, continuar }) {
  const li = no(doc, 'li', 'aula-item');
  const link = no(doc, 'a', 'aula-link', {
    href: hrefVideo(aula, playlist),
    rel: 'noopener',
    target: '_blank',
    'data-aula': String(aula.id),
    'data-n': String(aula.n)
  });
  // O registro é por ID do vídeo (estadoDaAula lê `estudo.aulas[texto(aula)]`):
  // passar o objeto faria `texto()` devolver '' e TODA linha sairia "Não
  // iniciada" — o verde mudo de uma lista que nunca mostra o que já foi aberto.
  const estado = estadoDaAula(estudo, aula.id);
  const nomeEstado = A.estados[estado] || A.estados['nao-iniciada'];

  // A célula do título: o texto que quebra em duas linhas e, quando a aula é de
  // exercício, a etiqueta ao lado. `no()` desta casa só põe atributo e texto,
  // então os filhos entram por append — não por um argumento que ele não tem.
  const celulaTitulo = no(doc, 'span', 'aula-titulo');
  celulaTitulo.append(no(doc, 'span', 'aula-titulo-texto', { text: aula.titulo }));
  if (aula.exercicio) celulaTitulo.append(no(doc, 'span', 'aula-etiqueta', { text: A.etiquetaExercicio }));

  link.append(
    // A marca: círculo vazio ou círculo com ponto, na cor da linha. O estado
    // NÃO é texto visível na linha — no Chrome de 1280 px "Não iniciada" era
    // desenhado por cima do título, porque a coluna dele encolhia a zero num
    // grid de duas colunas (defeito 3 do acabamento). É texto escondido com a
    // classe .so-leitor da base.css, que é como a casa dá um nome a uma marca.
    no(doc, 'span', `aula-marca aula-marca-${estado}`, { 'aria-hidden': 'true' }),
    no(doc, 'span', 'aula-n', { text: String(aula.n) }),
    celulaTitulo,
    no(doc, 'span', 'aula-estado so-leitor', { text: nomeEstado }),
    no(doc, 'span', 'aula-duracao', { text: duracaoLegivel(aula.duracaoS) })
  );
  // O ponto de retorno da estação, marcado na própria linha. `step` e não
  // `true`: é o passo de uma sequência (Aula 3 de 93), que é o que
  // aria-current aceita e o que a pessoa está lendo.
  if (continuar && aula.id === continuar.id) link.setAttribute('aria-current', 'step');
  li.append(link);
  return li;
}

/**
 * Monta a página de aulas da estação pedida pela rota.
 *
 * @param {Element} raiz o contêiner que o casco esvazia e entrega
 * @param {{document: object, window: object, catalogo: Promise, folha: string, buscarAulas?: Function}} ctx
 * @returns {Promise<{desmontar: () => void, rotulo: string|null, root: Element}>}
 *   `rotulo` é o que o casco põe no `document.title` e no anúncio: uma tela que
 *   não é aba precisa se nomear sozinha, senão o casco a chamaria de "Jornada".
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document;
  const win = ctx.window;
  const slug = String(ctx.folha || '');

  raiz.className = CLASSE;
  raiz.setAttribute('data-slug', slug);

  // O CATÁLOGO NA FORMA QUE O APP ENTREGA (defeito 1, julgado no Chrome em
  // 04/11/2026): `ctx.catalogo` é a promessa do `loadCatalog()` (web/main.js:60),
  // que resolve num OBJETO de dados — `{ courses: [...], origem: ... }` — e não
  // numa lista. `catalogo.find` estourava TypeError, o casco capturava, e quem
  // abria #/estacao/…/aulas via o casco no ar e o `<main>` vazio. A Explorar lê
  // `catalogo.courses` (web/telas/explorar.js:315); esta tela lê a mesma forma.
  // O teste passou por aqui durante todo o turno com `Promise.resolve([CIRCUITOS])`
  // — uma forma que o app nunca tem. A régua é a linha do app, não o dublê.
  const bruto = await ctx.catalogo;
  const catalogo = bruto?.courses ?? [];
  const curso = catalogo.find((c) => c && (c.slug === slug || c.id === slug)) || null;
  // O nome lido do catálogo, nunca digitado. Sem estação no catálogo, o que se
  // ecoa é o que a pessoa pediu por endereço — não um nome inventado.
  const estacao = typeof curso?.title === 'string' ? curso.title : slug;
  if (curso) raiz.setAttribute('data-estacao', String(curso.id));

  // S13e — A COR DA LINHA CHEGA PELA CLASSE DA LINHA, E ELA MORA NA RAIZ.
  //
  // O defeito, achado no Chrome em 04/11/2026 e invisível para a suíte e para o
  // testar_pagina: `--cor` e `--cor-fraca` são declaradas por linha (`.l1` …
  // `.l7`, web/metro.css:17) e chegam por HERANÇA. A folha mora dentro do
  // metrô e herda de um ancestral com a classe; a página de aulas não está
  // dentro de linha nenhuma. O `.botao.botao-primario` recebia
  // `background: var(--cor)` VAZIO — texto `--superficie` sobre o fundo da
  // página: 1,1:1 de contraste nos dois temas, branco sobre claro e escuro
  // sobre escuro. Pela mesma via a barra de progresso enchia de preto e as
  // marcas de estado saíam na cor do texto.
  //
  // A régua que existe desde a S10 (folha.css, "S10 régua 5") mede par por
  // regra, não por escopo resolvido: o token está certo no CSS e some no
  // navegador. Por isso a trava daqui é no DOM montado (a classe lN na raiz),
  // não no CSS.
  //
  // A linha é lida do MESMO lugar de onde a folha a lê — `fatosDaEstacao`
  // (core/viagem.js), que tira `linha` do `stage` do catálogo. Progresso não
  // entra: linha, posição e total dentro da linha não dependem do que a pessoa
  // concluiu, e um `carregarViagem` aqui seria ler o estado alheio para desenhar
  // um número fixo. Sem estação, nenhuma classe: a página cai no cinza da base.
  const fatos = curso ? fatosDaEstacao(catalogo, curso.id, {}) : null;
  if (fatos && Number.isFinite(fatos.linha) && fatos.linha > 0) raiz.classList.add(`l${fatos.linha}`);

  // O alto da página, na ordem do desenho (S13b B.1, que ficou de fora e voltou
  // na S13e): a volta, o selo da linha com a posição, o nome. `seloLinha` e as
  // classes `selo`/`folha-rotulo` são os da folha — dois círculos da linha em
  // dois tamanhos, ou duas palavras para "Linha 1 · estação 1 de 5", é a regra 9.
  const cabecalho = no(doc, 'header', 'aulas-cabecalho');
  cabecalho.append(
    no(doc, 'a', 'aulas-voltar', { href: hrefDe({ tela: 'estacao', slug }), text: A.voltarPara(estacao) })
  );
  if (fatos && Number.isFinite(fatos.linha) && fatos.linha > 0) {
    const faixa = no(doc, 'div', 'aulas-selo folha-cabecalho');
    faixa.append(seloLinha(doc, fatos.linha));
    const rotulo = no(doc, 'p', 'aulas-posicao folha-rotulo');
    rotulo.textContent = fatos.posicao
      ? comValores.posicaoNaLinha(fatos.linha, fatos.posicao, fatos.total)
      : comValores.viagem(0, fatos.total);
    faixa.append(rotulo);
    cabecalho.append(faixa);
  }
  cabecalho.append(no(doc, 'h1', 'aulas-titulo', { text: A.tituloPagina(estacao) }));
  raiz.append(cabecalho);

  const painelBox = no(doc, 'div', 'aulas-painel');
  raiz.append(painelBox);

  // A leitura do arquivo: só com estação conhecida. `ctx.buscarAulas` é a rede
  // injetada (o teste passa um dublê); sem ela, `carregarAulas` usa o fetch do
  // navegador, e um node sem fetch recebe `{ok:false}` em vez de estouro.
  let lista = null;
  if (curso) {
    const lido = await carregarAulas(slug, ctx.buscarAulas);
    if (lido.ok) {
      // O `resourceUrl` é do CATÁLOGO, não do arquivo de aulas (que traz vídeo,
      // título e duração, e nunca a playlist de onde ele saiu). Sem esta costura,
      // `painelDeAulas` não acharia a playlist e cada href de aula cairia no
      // vídeo solto: a pessoa terminaria e o YouTube sugeriria outra coisa.
      lista = { ...lido.dados, resourceUrl: lido.dados.resourceUrl || curso.resourceUrl };
    } else {
      raiz.append(avisoSemAulas(doc));
    }
  }

  const pintar = () => {
    if (!lista || !curso) return;
    const estudo = estudoDoStorage(win?.localStorage);
    const painel = painelDeAulas(estudo, curso.id, lista);
    painelBox.textContent = '';
    if (!painel) return;
    painelBox.append(linhaProgresso(doc, painel.resumo));
    painelBox.append(primarioAula(doc, {
      aula: painel.continuar.aula,
      motivo: painel.continuar.motivo,
      temAberta: painel.resumo.abertas > 0,
      playlist: painel.playlist
    }));
    painelBox.append(notaAbrirAula(doc));
    // A playlist da estação inteira, no link que o catálogo já traz. Nenhum
    // endereço é montado aqui: `resourceUrl` é o que a UBL publicou.
    if (curso.resourceUrl) {
      painelBox.append(no(doc, 'a', 'aulas-playlist', {
        href: curso.resourceUrl, rel: 'noopener', target: '_blank', text: A.abrirPlaylist
      }));
    }
    const itens = no(doc, 'ol', 'aulas-lista');
    for (const aula of lista.aulas) {
      itens.append(itemDaAula(doc, {
        aula,
        estudo,
        playlist: painel.playlist,
        continuar: painel.continuar.aula
      }));
    }
    painelBox.append(itens);
  };

  pintar();
  const desligar = lista
    ? ligarAberturaDeAula({ win, storage: win?.localStorage, painel: painelBox, aoMudar: pintar })
    : () => {};

  return {
    root: raiz,
    rotulo: A.tituloPagina(estacao),
    desmontar: () => desligar(),
    // Exposto para o teste ler sem andar pela árvore.
    _estado: () => ({ lista: Boolean(lista), curso: curso?.id || null })
  };
}
