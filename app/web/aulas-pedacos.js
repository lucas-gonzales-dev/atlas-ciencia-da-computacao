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
import { hrefDe } from '../core/rotas.js';
import { aulas as A } from '../core/textos.js';
import { ESTUDO_KEY, abrirAula, continuarDe, estadoDaAula, lerEstudo, resumoDaEstacao, serializarEstudo, pularAula, desfazerPulo } from '../core/estudo.js';

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

/**
 * O número da linha dentro do selo, na classe de cor da linha.
 *
 * S14b1: VEIO DA folha.js PARA CÁ. A página de aulas precisava do MESMO círculo
 * da folha, e importar `web/folha.js` por causa de uma função de nove linhas
 * trazia `web/metro.js` junto (folha.js:30 importa metro.js, que importa
 * folha.js de volta): a tela de aulas pagava o metrô inteiro, um ciclo real no
 * grafo de imports e nenhuma forma de o teste ver. Uma função, uma classe, um
 * CSS — e nenhum ciclo.
 *
 * A folha define o recheio em `.folha .selo` (folha.css) e a página em
 * `.aulas .selo` (aulas.css); as duas apontam para a MESMA classe `selo` e para
 * a MESMA função, que é o que a regra 9 cobra.
 */
export function seloLinha(doc, linha) {
  const n = Number(linha);
  const temNumero = Number.isFinite(n) && n > 0;
  const selo = no(doc, 'span', temNumero ? `selo l${n}` : 'selo', { 'aria-hidden': 'true' });
  selo.textContent = temNumero ? String(n) : '—';
  return selo;
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
export function linhaProgresso(doc, resumo, lembradas = null) {
  // S14b2 (item 8): a barra e a frase contam ESTUDADAS, não abertas. É a mesma
  // linha de código das duas telas de propósito — folha e página de aulas puxam
  // daqui (regra 9) — e por isso a troca do número acontece uma vez só. O
  // `aria-valuenow` acompanha o texto porque os dois são a MESMA frase dita duas
  // vezes (a visível e a do leitor de tela), e um atrasado em relação ao outro
  // seria a régua mentindo para quem não vê.
  const caixa = no(doc, 'div', 'aulas-progresso');
  const feito = Number(resumo.estudadas) || 0;
  // S16c-fix (04/11/2026), item 3: `lembradas` é o que a FOLHA passa, porque a
  // linha da barra passou a ser a ÚNICA contagem da estação na tela. Quem não
  // mede cartão (a página de aulas) não passa nada, e a frase sai byte a byte a
  // de antes — é o que as travas de `aulas-tela` e `design-system` exigem.
  const frase = A.progresso(feito, resumo.total, duracaoLegivel(resumo.segundosRestantes), lembradas);
  caixa.append(no(doc, 'p', 'aulas-progresso-texto', { text: frase }));

  const cheio = resumo.total > 0 ? Math.round((feito / resumo.total) * 100) : 0;
  const trilho = no(doc, 'div', 'aulas-barra', {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(resumo.total),
    'aria-valuenow': String(feito),
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
export function primarioAula(doc, { aula, motivo, temAberta, estacao }) {
  const frase = motivo === 'comecar' || !temAberta
    ? A.comecar(aula.n, aula.titulo)
    : A.continuar(aula.n, aula.titulo);
  const link = no(doc, 'a', 'botao botao-primario aulas-primario', {
    href: paginaDaAula(estacao, aula.n),
    rel: 'noopener',
    'data-aula': aula.id,
    'data-n': String(aula.n),
    text: frase
  });
  // O `data-pagina` é a marca de que este link não sai do Atlas. Sem ele, a
  // mesma classe serviria para dois destinos diferentes e o teste de fluxo
  // (aulas-tela) teria de adivinhar pelo href.
  link.setAttribute('data-pagina', 'aula');
  return link;
}

/**
 * O endereço da PÁGINA DA AULA dentro do Atlas (S14b1, item 5 do pedido).
 *
 * Antes a folha e a lista mandavam a pessoa direto para o YouTube; agora mandam
 * para a casa da aula, e é de lá que se sai para o vídeo. O `n` vai no endereço
 * porque é o que a pessoa lê ("aula 3"), e o id do vídeo não diz nada a ninguém.
 */
export function paginaDaAula(slug, n) {
  return hrefDe({ tela: 'estacao', slug, painel: 'aula', n });
}

/** A nota embaixo do primário: o que acontece quando se toca. */
export function notaAbrirAula(doc) {
  return no(doc, 'p', 'aulas-nota', { text: A.notaAbrir });
}

/**
 * A ação "Já sei isso" (S18a) — a MESMA na página da aula e na lista de aulas,
 * porque a folha e a lista já dividem o primário e a nota pela regra 9 da casa.
 *
 * É um `<button>`, nunca um `<a>`: não leva a lugar nenhum, muda um registro, e
 * a lista de proibições da casa trata "link que executa ação" como defeito. E
 * nunca é `botao-primario`: o primário destas telas é a aula. Fazer o pulo
 * primário seria o app preferindo a recusa do estudo ao estudo.
 *
 * `aula` é a aula que a tela está ofertando (o alvo do primário, aqui; a aula da
 * página, lá) — a ação é UMA por tela e aponta para o mesmo endereço que o
 * primário ao lado, senão a pessoa pularia uma aula vendo outra.
 *
 * AULAS ESTUDADAS NÃO TÊM BOTÃO NENHUM: quem fechou a aula tem o estado dela
 * medido, e um botão ao lado oferecendo "já sei isso" daria a ela um jeito de
 * apagar o próprio estudo com um toque. O desfazer do pulo, esse existe, porque
 * desfazer uma declaração é devolver o que ela era antes — não apagar medida.
 *
 * @param {Document} doc
 * @param {{aula: {id: string, n: number}|null, estacao: string, estado: string}} dados
 * @returns {Element|null} null quando não há o que ofertar (sem aula, ou estudada)
 */
export function acaoPularAula(doc, { aula, estacao, estado }) {
  if (!aula || !aula.id || !estacao) return null;
  if (estado === 'estudada') return null;
  const pulada = estado === 'pulada';
  return no(doc, 'button', `aulas-pular${pulada ? ' aulas-pular-desfazer' : ''}`, {
    type: 'button',
    'data-pulo': pulada ? 'desfazer' : 'pular',
    'data-aula': String(aula.id),
    'data-n': String(aula.n || 0),
    'data-estacao': String(estacao),
    text: pulada ? A.desfazerPulo : A.pular
  });
}

/**
 * Grava o pulo (e o desfazer) no clique, no MESMO storage e pela mesma chave de
 * `ligarAberturaDeAula`. São dois gravadores e não um porque os dois gestos são
 * opostos: aquele exige um link que SAI do Atlas (o href é a pergunta honesta),
 * este é um botão que fica. Misturar os dois faria o pulo gravar uma abertura
 * que ninguém fez, ou o Assistir precisar de um atributo que não é dele.
 *
 * @returns {() => void} desligar, para o desmontar da tela
 */
export function ligarPuloDeAula({ storage, painel, aoMudar }) {
  const aoClique = (evento) => {
    const botao = evento?.target?.closest?.('button[data-pulo]');
    if (!botao) return;
    const estudo = estudoDoStorage(storage);
    const id = botao.getAttribute('data-aula');
    const novo = botao.getAttribute('data-pulo') === 'desfazer'
      ? desfazerPulo(estudo, id)
      : pularAula(estudo, {
          estacao: botao.getAttribute('data-estacao') || '',
          aula: id,
          n: Number(botao.getAttribute('data-n')) || 0
        }, agoraLocal(null));
    try {
      storage?.setItem?.(ESTUDO_KEY, serializarEstudo(novo));
    } catch { /* aparelho sem espaço: a tela continua, só não lembra amanhã */ }
    if (typeof aoMudar === 'function') aoMudar();
  };
  painel?.addEventListener?.('click', aoClique);
  return () => painel?.removeEventListener?.('click', aoClique);
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
export function ligarAberturaDeAula({ win, storage, painel, aoMudar, aoRetornar }) {
  const doc = painel?.ownerDocument;
  // Qual link levou a pessoa para fora do Atlas, desde o último clique. `null`
  // na montagem: trocar de aba sem ter tocado em nada não é voltar de vídeo.
  let quemSaiu = null;

  const aoClique = (evento) => {
    const alvo = evento?.target?.closest?.('a[data-aula]');
    if (!alvo) return;
    // S14b1: SÓ um link que SAI do Atlas abre uma aula. Desde esta fatia a
    // folha e a lista apontam para a PÁGINA da aula (link interno), e a pessoa
    // abre o vídeo dentro dela. Marcar a aula como aberta no toque interno
    // diria "você abriu a Aula 7" para quem só foi ler o título dela — e o
    // progresso da estação subiria sozinho, sem ninguém assistir nada.
    // O href é a pergunta honesta: um endereço do próprio app começa com '#'.
    const href = alvo.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    // A estação DO LINK, não do contêiner (S13c): o metrô escuta no root, que é
    // PAI do painel .folha — e `closest` sobe, nunca desce. Partir do alvo é o
    // único caminho que atravessa a árvore nas duas telas: na folha o
    // `data-estacao` está no painel (folha.js:347), na página está na raiz.
    const estacao = alvo.getAttribute('data-estacao')
      || alvo.closest?.('[data-estacao]')?.getAttribute('data-estacao')
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
    // S14b1: GUARDA-SE qual link levou a pessoa embora. A página da aula usa
    // isto para decidir se a volta é um gesto ou não: voltar de um vídeo que ela
    // não abriu não pode rolar a tela até o fechamento — seria o app movendo a
    // leitura de quem só trocou de aba.
    quemSaiu = alvo;
    if (typeof aoMudar === 'function') aoMudar();
  };

  const aoVoltar = () => {
    const visivel = (doc?.visibilityState ?? win?.document?.visibilityState) === 'visible';
    if (!visivel) return;
    // S14b1: no retorno pode haver um gesto diferente da repintura. A página da
    // aula não pinta progresso nenhum — ela rola até o "Fechar a aula" e põe o
    // foco ali (item 2 do pedido). `aoVoltar` existe para isso; onde ele não é
    // dado (folha, lista de aulas), o comportamento é exatamente o de antes.
    if (typeof aoRetornar === 'function') { aoRetornar(quemSaiu); return; }
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
