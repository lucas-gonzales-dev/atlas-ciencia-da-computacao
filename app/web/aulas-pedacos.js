// Projeto Atlas — os PEDAÇOS de aula que duas telas montam (S13b, 04/11/2026).
//
// POR QUE EXISTE: a folha da estação (web/folha.js) e a página das aulas
// (web/telas/aulas.js) mostram a MESMA linha de progresso, o MESMO botão
// primário de aula e a MESMA nota. Deixar cada uma formatar a sua é o defeito
// que a regra 9 da casa nomeia: a mesma duração escrita de dois jeitos em duas
// telas, e a pessoa lendo "faltam ~30 h" numa e "faltam 30h33" na outra. Aqui o
// texto sai de core/textos.js uma vez, e quem chama só escolhe onde encaixar.
//
// REGRAS deste arquivo:
//   · monta DOM, não calcula: as contas vêm de core/estudo.js
//     (`resumoDaEstacao`, `continuarDe`) e a duração de core/aulas.js
//     (`duracaoLegivel`). Nada de regra de desbloqueio, nada de cor, nada de
//     número de tempo escrito aqui.
//   · roda no node e no navegador, sem `document` global: quem chama passa o
//     `doc` (a casa injeta documento e janela desde a S10c, e o mini-DOM dos
//     testes é um documento que não é o global).
//   · o endereço do vídeo é derivado do `resourceUrl` da estação: o `list=` é o
//     da playlist da própria estação (`playlistDoRecurso`, em core/aulas.js), e
//     um href sem ele abriria o vídeo fora da fila — a pessoa terminaria o vídeo
//     e o YouTube sugeiria outra coisa. Ele não é inventado nem chutado.
import { duracaoLegivel, playlistDoRecurso } from '../core/aulas.js';
import { aulas as A } from '../core/textos.js';
import { ESTUDO_KEY, abrirAula, continuarDe, estadoDaAula, lerEstudo, resumoDaEstacao, serializarEstudo } from '../core/estudo.js';

const BASE_VIDEO = 'https://www.youtube.com/watch?v=';

function no(doc, tag, classe, attrs) {
  const n = doc.createElement(tag);
  if (classe) n.className = classe;
  for (const chave of Object.keys(attrs || {})) {
    if (chave === 'text') n.textContent = String(attrs[chave]);
    else n.setAttribute(chave, String(attrs[chave]));
  }
  return n;
}

/** O endereço de um vídeo dentro da playlist da estação. Sem playlist, só o vídeo. */
export function hrefVideo(aula, playlist) {
  if (!aula || !aula.id) return '#/';
  const base = `${BASE_VIDEO}${encodeURIComponent(aula.id)}`;
  return playlist ? `${base}&list=${encodeURIComponent(playlist)}` : base;
}

/**
 * A linha do progresso + a barra de 4px.
 *
 * A barra é `role="progressbar"` com os três valores ARIA: sem `aria-valuenow`
 * o leitor de tela anuncia "barra de progresso" e nada mais, e o texto escrito
 * logo acima já diz o número — os dois andam juntos porque saem do mesmo
 * `resumo`, nunca de duas contas.
 *
 * O texto é a frase inteira e é também o `aria-label` da barra: a casa escreve
 * o que a pessoa lê, não uma paráfrase para a máquina.
 */
export function linhaProgresso(doc, resumo) {
  const caixa = no(doc, 'div', 'aulas-progresso');
  const frase = A.progresso(resumo.abertas, resumo.total, duracaoLegivel(resumo.segundosRestantes));
  caixa.append(no(doc, 'p', 'aulas-progresso-texto', { text: frase }));

  const cheio = resumo.total > 0 ? Math.round((resumo.abertas / resumo.total) * 100) : 0;
  const trilho = no(doc, 'div', 'aulas-barra', {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(resumo.total),
    'aria-valuenow': String(resumo.abertas),
    'aria-label': frase
  });
  // A largura do preenchimento é ESTADO, não desenho: sem estilo em linha não há
  // como dizer "37 de 93" num CSS que não conhece número. O --pct entra como
  // número puro e o aulas.css faz dele a largura — a cor e a espessura ficam no
  // CSS, onde a trava de tokens as vê.
  const enchimento = no(doc, 'div', 'aulas-barra-cheio', { style: `--pct: ${cheio}%`, 'aria-hidden': 'true' });
  trilho.append(enchimento);
  caixa.append(trilho);
  return caixa;
}

/**
 * O primário da folha e da página: a aula por onde continuar.
 *
 * O verbo segue o motivo do núcleo, como a decisão do Lucas de 04/11/2026 fixou:
 * 'comecar' é convite de quem ainda não entrou, 'ultima-aberta' é ponto de
 * retorno de quem já está dentro. Não existe um terceiro texto porque não existe
 * um terceiro motivo — foi a saída do 'primeira-nao-aberta'.
 */
export function primarioAula(doc, { aula, motivo, temAberta, playlist }) {
  const frase = motivo === 'comecar' || !temAberta
    ? A.comecar(aula.n, aula.titulo)
    : A.continuar(aula.n, aula.titulo);
  return no(doc, 'a', 'botao botao-primario aulas-primario', {
    href: hrefVideo(aula, playlist),
    rel: 'noopener',
    target: '_blank',
    'data-aula': aula.id,
    'data-n': String(aula.n),
    text: frase
  });
}

/** A nota embaixo do primário: o que acontece quando se toca. */
export function notaAbrirAula(doc) {
  return no(doc, 'p', 'aulas-nota', { text: A.notaAbrir });
}

/**
 * As contas de uma estação para a tela: quanto falta e por onde continuar.
 *
 * @param {object} estudo o estudo lido do storage
 * @param {string} estacaoId o id da estação
 * @param {{aulas: Array, resourceUrl?: string, playlist?: string}} lista
 * @returns {null | {resumo: object, continuar: object, playlist: string|null}}
 *   null quando a estação não tem aulas: quem recebe desenha a folha de hoje.
 */
export function painelDeAulas(estudo, estacaoId, lista) {
  if (!lista || !Array.isArray(lista.aulas) || !lista.aulas.length) return null;
  const playlist = playlistDoRecurso(lista.resourceUrl || lista.playlist || '');
  const escolher = continuarDe(estudo, estacaoId, lista.aulas);
  if (!escolher) return null;
  return {
    resumo: resumoDaEstacao(estudo, estacaoId, lista.aulas),
    continuar: escolher,
    playlist,
  };
}

/** `aaaa-mm-ddThh:mm` LOCAL (regra 13): toISOString cortaria em UTC. */
export function agoraLocal(win) {
  const D = (win && win.Date) || Date;
  const agora = new D();
  const p = (v) => String(v).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}T${p(agora.getHours())}:${p(agora.getMinutes())}`;
}

/** O estudo lido do storage, para a tela pintar sem recompar nada. */
export function estudoDoStorage(storage) {
  return lerEstudo(typeof storage?.getItem === 'function' ? storage.getItem(ESTUDO_KEY) : null);
}

/**
 * Gravar a abertura no clique e repintar quando a pessoa volta da outra aba.
 *
 * Por que no CLIQUE e não no `visibilitychange`: o `abertaEm` é a hora em que
 * ela decidiu ver aquela aula. Gravado só ao voltar, quem fecha o YouTube no
 * celular antes de voltar ao Atlas não tem registro nenhum, e a volta de outra
 * estação diria "começar" para quem acabou de assistir 20 minutos.
 *
 * Por que um `<a target="_blank">` de verdade e nenhum `preventDefault`: o
 * Atlas não é dono da aba do YouTube. Interceptar a navegação para gravar é o
 * app prendendo o gesto da pessoa; gravar antes de sair dá o mesmo resultado
 * sem a prisão. O `data-estacao` sai do nó mais perto que o tem — a folha o pôe
 * na raiz, a página pôe no item — e por isso a mesma função serve às duas.
 *
 * @returns {() => void} desligar, para o desmontar da tela
 */
export function ligarAberturaDeAula({ win, storage, painel, aoMudar }) {
  const doc = painel?.ownerDocument;

  const aoClique = (evento) => {
    const alvo = evento?.target?.closest?.('a[data-aula]');
    if (!alvo) return;
    const estacao = alvo.getAttribute('data-estacao')
      || painel?.closest?.('[data-estacao]')?.getAttribute('data-estacao')
      || '';
    const estudo = estudoDoStorage(storage);
    const novo = abrirAula(estudo, {
      estacao,
      aula: alvo.getAttribute('data-aula'),
      n: Number(alvo.getAttribute('data-n')) || 0
    }, agoraLocal(win));
    try {
      storage?.setItem?.(ESTUDO_KEY, serializarEstudo(novo));
    } catch { /* aparelho sem espaço: a tela continua, só não lembra amanhã */ }
    if (typeof aoMudar === 'function') aoMudar();
  };

  const aoVoltar = () => {
    const visivel = (doc?.visibilityState ?? win?.document?.visibilityState) === 'visible';
    if (!visivel) return;
    if (typeof aoMudar === 'function') aoMudar();
  };

  painel?.addEventListener?.('click', aoClique);
  win?.addEventListener?.('visibilitychange', aoVoltar);
  return () => {
    painel?.removeEventListener?.('click', aoClique);
    win?.removeEventListener?.('visibilitychange', aoVoltar);
  };
}

export { estadoDaAula as estadoDaAulaDe, A as textosAulas, ESTUDO_KEY as chaveEstudo };
