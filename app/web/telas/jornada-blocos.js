// Projeto Atlas — as três peças da Jornada (S4a, 31/10/2026).
//
// POR QUE EXISTE: o `web/metro.js` chegou a 932 linhas e o `metro.css` a 400. A
// regra 15 do 00-regras manda dividir arquivo de código além de 400 linhas pela
// responsabilidade, e a fatia S4a é explícita: as peças moram AQUI e o
// `desenharMetro` só as chama. Nada de regra de estado neste arquivo — quem
// conta, quem destranca e o que é baldeação é o `core/viagem.js`.
//
// O QUE A PESSOA LÊ EM 10 SEGUNDOS: o que é isto (1. a abertura), onde estou
// (2. os três números) e qual é o próximo passo (3. a próxima conexão). Sem XP,
// sem sequência, sem pontos: os três números saem do que ela fez.
//
// TODA FRASE vem de `core/textos.js`, seção `jornada` (regra 7). Este arquivo
// não escreve uma palavra de tela — monta nós e põe o texto dentro.
import { jornada as J } from '../../core/textos.js';
import { abreComBaldeacao, lerProgresso } from '../../core/viagem.js';

function el(doc, tag, className, attrs = {}) {
  const no = doc.createElement(tag);
  if (className) no.className = className;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') no.textContent = String(v);
    else no.setAttribute(k, String(v));
  }
  return no;
}

/** Quantas linhas o catálogo tem. É derivado do dado (regra 8): se um dia a
 *  fonte publicar uma linha 8, o "linhas" da tela acompanha sozinho. */
export function totalDeLinhas(catalogo) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  return new Set(lista.map((c) => Number(c?.stage)).filter((n) => Number.isFinite(n))).size;
}

/**
 * 1. A ABERTURA — antes da placa. O título traz a palavra "conexão." na cor da
 * linha da próxima estação: é o mapa dizendo onde você está, não enfeite, e por
 * isso a classe `l<n>` vem junto — o `metro.css` declara `--cor` nelas.
 */
export function abertura(doc, { resumo, primeiraVisita, estacoes, linhas }) {
  const caixa = el(doc, 'section', 'abertura');
  caixa.append(el(doc, 'p', 'placa-rotulo', { text: J.abertura.rotulo }));

  // O texto entra por `textContent` e o span por `append`: é assim que o
  // mini-DOM do teste (que não tem createTextNode) e o navegador chegam ao
  // mesmo desenho — primeiro o texto, depois a palavra colorida.
  const titulo = el(doc, 'h1', 'abertura-titulo');
  titulo.textContent = `${J.abertura.titulo} `;
  const linha = Number(resumo.proximaEstacao?.linha);
  const fim = el(doc, 'span', `pela-linha${Number.isFinite(linha) && linha > 0 ? ` l${linha}` : ''}`);
  fim.textContent = J.abertura.tituloFim;
  titulo.append(fim);
  caixa.append(titulo);

  // Primeira visita: o parágrafo cede o lugar ao embarque, que já existe em
  // textos.js com as duas saídas de hoje. Quem já tem um carimbo lê o que a
  // grade É, com número lido do catálogo.
  caixa.append(el(doc, 'p', 'abertura-texto', {
    text: primeiraVisita ? J.abertura.primeiraVisita : J.abertura.paragrafo(estacoes, linhas)
  }));
  return caixa;
}

/**
 * 2. OS TRÊS NÚMEROS — depois da placa. Mono porque número comparável precisa
 * de largura fixa.
 */
export function tresNumeros(doc, { carimbos, total, emCurso, abertas, linhas }) {
  const caixa = el(doc, 'div', 'numeros', { 'aria-label': J.numeros.rotulo });
  const item = (rotulo, valor, nota) => {
    const bloco = el(doc, 'div', 'numero-item');
    bloco.append(el(doc, 'p', 'placa-rotulo', { text: rotulo }));
    bloco.append(el(doc, 'p', 'numero-valor', { text: valor }));
    bloco.append(el(doc, 'p', 'numero-nota', { text: nota }));
    return bloco;
  };
  caixa.append(
    item(J.numeros.viagem, J.numeros.valorViagem(carimbos, total), J.numeros.notaViagem),
    item(J.numeros.emCurso, J.numeros.valorEmCurso(emCurso), J.numeros.notaEmCurso),
    item(J.numeros.linhasAbertas, J.numeros.valorLinhas(abertas, linhas), J.numeros.notaLinhas)
  );
  return caixa;
}

/**
 * Os nomes que o próximo passo abriria, na forma da frase. As estações da MESMA
 * linha saem pelo nome; as de OUTRA saem com a linha de destino, porque
 * baldeação é travessia e a tela diz para onde se vai (JORNADA 2.5).
 * É o mesmo critério do aviso da chegada: uma regra, dois lugares que a lêem.
 */
export function nomesQueAbrem(abre, linhaPropria) {
  const lista = Array.isArray(abre) ? abre.filter((c) => c && c.titulo) : [];
  const aqui = [];
  const la = new Map();
  for (const c of lista) {
    const destino = Number(c.linha);
    const temNumero = Number.isFinite(destino) && destino > 0;
    if (linhaPropria === null || !temNumero || destino === linhaPropria) {
      aqui.push(c.titulo);
      continue;
    }
    if (!la.has(destino)) la.set(destino, []);
    la.get(destino).push(c.titulo);
  }
  const partes = [...aqui];
  for (const [numero, nomes] of [...la.entries()].sort((a, b) => a[0] - b[0])) {
    partes.push(J.conexao.naLinha(nomes.join(', '), numero));
  }
  return partes.join(' e ');
}

/**
 * 3. A PRÓXIMA CONEXÃO — depois dos números. Simula o gesto sem escrevê-lo: o
 * núcleo compara o progresso de agora com "concluída a próxima" e devolve o que
 * passou a estar livre. A tela não reimplementa pré-requisito.
 *
 * Se nada abre, a frase só pode ser "fecha a Linha n" quando o catálogo garante
 * — a linha inteira concluída MENOS esta estação. Fora disso a peça se cala:
 * nada inventado (regra 8).
 */
export function conexao(doc, { progresso, catalogo, resumo }) {
  const proxima = resumo.proximaEstacao;
  if (!proxima) return null;
  const p = lerProgresso(progresso);
  const depois = {
    completed: [...p.completed, proxima.id],
    emCurso: p.emCurso,
    conclusoes: p.conclusoes
  };
  const abre = abreComBaldeacao(progresso, depois, catalogo).destravadas || [];
  const linha = Number.isFinite(Number(proxima.linha)) ? Number(proxima.linha) : null;

  const caixa = el(doc, 'section', 'conexao');
  caixa.append(el(doc, 'p', 'placa-rotulo', { text: J.conexao.rotulo }));

  if (abre.length > 0) {
    caixa.append(el(doc, 'p', 'conexao-texto', {
      text: J.conexao.abre(proxima.titulo, nomesQueAbrem(abre, linha))
    }));
    return caixa;
  }

  const daLinha = resumo.linhas.find((l) => Number(l.linha) === linha);
  if (daLinha && daLinha.concluidas + 1 === daLinha.total) {
    caixa.append(el(doc, 'p', 'conexao-texto', { text: J.conexao.fecha(linha) }));
    return caixa;
  }
  return null;
}


