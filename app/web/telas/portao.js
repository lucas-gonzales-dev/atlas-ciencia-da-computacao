// Projeto Atlas — O PORTÃO (S25, 06/11/2026).
//
// POR QUE EXISTE: o formulário de três caixas é onde a pessoa para. Esta peça
// troca o gesto de escrever pelo gesto de tocar: uma pergunta por vez, quatro
// alternativas, e o vão — a explicação do erro — no momento em que ele acontece.
// Escrever continua existindo, como escolha, no link de baixo.
//
// O QUE ESTA TELA NÃO FAZ (regras da casa):
//   · não calcula. Que perguntas saem, em que ordem e com quantas alternativas é
//     conta de `core/pratica.js`; a tela desenha o que recebe.
//   · nenhuma frase digitada aqui (regra 7): tudo vem de `core/textos.js`.
//   · não cria segunda `aria-live`. O retorno passa pelo `#anuncio` do casco
//     (web/casco.js), o mesmo `dizer()` que o `blocoFechamento` já usa.
//   · `disabled` depois do toque: quem toca duas vezes na certa não conta dois
//     acertos, e o portão não conta acertos de nenhum jeito.
import { portao as P } from '../../core/textos.js';
import { opcoesDaPergunta } from '../../core/pratica.js';

function no(doc, tag, classe, attrs) {
  const n = doc.createElement(tag);
  if (classe) n.className = classe;
  for (const chave of Object.keys(attrs || {})) {
    if (chave === 'text') n.textContent = String(attrs[chave]);
    else n.setAttribute(chave, String(attrs[chave]));
  }
  return n;
}

/** A faixa da plataforma, acima do texto que explica o erro. 1.4.1: a faixa é
 *  decoração e o `<b>` é quem informa — por isso o texto, e não a cor. */
function faixaDoVao(doc, texto) {
  const caixa = no(doc, 'div', 'vao');
  caixa.append(no(doc, 'div', 'vao-faixa'));
  const corpo = no(doc, 'div', 'vao-corpo');
  corpo.append(no(doc, 'b', null, { text: P.vaoTitulo }));
  corpo.append(no(doc, 'span', null, { text: texto || '' }));
  caixa.append(corpo);
  return caixa;
}

/** Um anúncio no `#anuncio` do casco, sem inventar uma segunda aria-live. */
function dizer(doc, texto) {
  const alvo = typeof doc?.getElementById === 'function' ? doc.getElementById('anuncio') : null;
  if (alvo) alvo.textContent = texto;
}

export function blocoFechoLeve(doc, { perguntas, aoFechar, aoEscrever }) {
  const lista = Array.isArray(perguntas) ? perguntas : [];
  const section = no(doc, 'section', 'aula-fim aula-fim-leve');
  const h2 = no(doc, 'h2', 'aula-fim-titulo', { text: lista.length ? P.titulo : P.fechoSimples });
  // `tabindex="-1"`: o título recebe o foco por programa, para o leitor de tela
  // saber o que a pessoa abriu, sem virar uma parada a mais no Tab.
  h2.setAttribute('tabindex', '-1');
  section.append(h2);
  const escrever = no(doc, 'a', 'portao-escrever', { href: '#', text: P.escrever });

  // ── sem perguntas: um toque fecha ──────────────────────────────────────────
  // É o caso NORMAL de hoje: só existe arquivo de prática de uma estação, e 404
  // não é erro. Uma aula sem pergunta é uma aula que se fecha com um toque.
  if (!lista.length) {
    section.append(no(doc, 'p', null, { text: P.fechoSimplesTexto }));
    section.append(no(doc, 'button', 'botao botao-primario portao-fechar', {
      type: 'button', 'data-fechar': 'sim', text: P.fecharAgora
    }));
    section.append(escrever);
    section.addEventListener('click', (evento) => {
      const alvo = evento?.target;
      if (alvo?.closest?.('[data-fechar]')) {
        aoFechar(0);
      } else if (alvo?.closest?.('a')) {
        if (typeof evento?.preventDefault === 'function') evento.preventDefault();
        aoEscrever();
      }
    });
    return { section, h2 };
  }

  // ── com perguntas: uma na tela ─────────────────────────────────────────────
  const total = lista.length;
  const contagem = no(doc, 'p', 'portao-contagem');
  const via = no(doc, 'div', 'portao-via', { 'aria-hidden': 'true' });
  const barra = no(doc, 'i');
  via.append(barra);
  const pergunta = no(doc, 'p', 'portao-pergunta');
  const opcoes = no(doc, 'div', 'portao-opcoes');
  const retorno = no(doc, 'div', 'portao-retorno');
  section.append(contagem, via, pergunta, opcoes, retorno, escrever);

  const estado = { i: 0, vaos: 0 };

  const pintar = () => {
    const p = lista[estado.i];
    contagem.textContent = P.contagem(estado.i + 1, total);
    // N é a fração já atravessada, não a pergunta atual: na primeira o trilho
    // está vazio porque nada passou ainda, e cresce a cada acerto.
    barra.setAttribute('style', `width: ${(estado.i / total) * 100}%`);
    pergunta.textContent = p.pergunta;
    retorno.textContent = '';
    opcoes.textContent = '';
    // A ordem vem do núcleo e é FIXA por pergunta: alternativa que troca de lugar
    // a cada visita faria a pessoa decorar posição, e o vão perderia o dono.
    for (const [indice, opcao] of opcoesDaPergunta(p).entries()) {
      opcoes.append(no(doc, 'button', 'portao-opcao', {
        type: 'button', 'data-opcao': String(indice), text: opcao.texto
      }));
    }
  };

  const aoTocar = (evento) => {
    const alvo = evento?.target;
    if (alvo?.closest?.('a')) {
      if (typeof evento?.preventDefault === 'function') evento.preventDefault();
      aoEscrever();
      return;
    }
    if (alvo?.closest?.('[data-seguir]')) {
      if (estado.i === total - 1) {
        // O portão abriu: quem recebe os vãos é a página, que sabe gravar o
        // estudo e repintar a marca no alto.
        aoFechar(estado.vaos);
        return;
      }
      estado.i += 1;
      pintar();
      // O toque desabilitou o botão focado; sem devolver o foco a algum lugar o
      // navegador o joga no <body>, e quem usa leitor de tela perde a página.
      h2.focus?.({ preventScroll: true });
      dizer(doc, contagem.textContent);
      return;
    }
    const botao = alvo?.closest?.('button');
    if (!botao || botao.disabled || botao.getAttribute('data-opcao') === null) return;
    const p = lista[estado.i];
    const todas = opcoesDaPergunta(p);
    const escolhida = todas[Number(botao.getAttribute('data-opcao'))];
    if (!escolhida) return;

    if (!escolhida.certa) {
      // Errou: fica na mesma pergunta, e agora sabendo por quê. Não avançar é o
      // que faz o vão significar alguma coisa. O botão continua na tela com a
      // listra: apagar a alternativa esconderia o que ela dizia.
      estado.vaos += 1;
      botao.classList.add('portao-opcao-errada');
      botao.disabled = true;
      retorno.textContent = '';
      retorno.append(faixaDoVao(doc, escolhida.vao));
      dizer(doc, `${P.vaoTitulo}. ${escolhida.vao || ''}`);
      return;
    }

    for (const filho of opcoes.children) if (filho.tag === 'button') filho.disabled = true;
    botao.classList.add('portao-opcao-certa');
    retorno.textContent = '';
    if (p.explica) retorno.append(no(doc, 'p', 'portao-explica', { text: p.explica }));
    const ultima = estado.i === total - 1;
    const proximo = no(doc, 'button', 'botao botao-primario portao-seguir', {
      type: 'button', 'data-seguir': 'sim', text: ultima ? P.passar : P.seguir
    });
    retorno.append(proximo);
    // O foco cai no botão, não no título: a pessoa acertou e o gesto seguinte é
    // aqui. Um toque a menos em quem está no trem.
    proximo.focus?.();
    dizer(doc, ultima ? P.passar : P.seguir);
  };

  section.addEventListener('click', aoTocar);
  pintar();
  return { section, h2 };
}
