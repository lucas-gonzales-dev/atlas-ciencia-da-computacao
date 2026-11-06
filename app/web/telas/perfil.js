// Projeto Atlas — a tela PERFIL: o bilhete, a caderneta e os dados da pessoa (S9, S17b).
//
// POR QUE EXISTE: o Perfil é portfólio, não placar. Cada marca aqui é um fato
// que a pessoa produziu: a data de uma conclusão, uma linha inteira fechada, o
// arquivo que ela mesma exportou. O protótipo desenhava XP, ritmo de dias e
// troféu; o Atlas desenha o bilhete e a conta do que falta.
//
// REGRA DA CASA: nenhuma regra nesta folha, com uma exceção desenhada e uma
// conseqüência. A exceção é «este carimbo é novo desde a última visita»: é a
// única conta que a tela faz, porque depende de quando a pessoa abriu o Perfil,
// e nada no núcleo sabe disso. Ela guarda só a LISTA DE IDS GANHOS e não uma
// segunda caderneta — se guardasse os carimbos, divergiria do núcleo no primeiro
// cartão novo. A conseqüência é o que ela lê para fazer essa conta: o estudo e
// os cartões em bruto, passados por `lerEstudo`/`lerCartoes` crus, que é o que
// web/metro.js (linha 488) e web/telas/aula.js (linha 116) fazem. Repete a
// leitura, não a regra: o juízo de cada carimbo continua todo em core/caderneta.js.
// As 35 casas, quantas linhas fecharam e em que dia cada estação terminou vêm de
// core/viagem.js; o envelope de exportar/importar, de core/dados-pessoa.js.
// Fora a exceção acima, aqui só há DOM: montar, pintar, ouvir.
//
// QUEM SAIU DA TELA (S17b): os marcos da S9 (`marcosDoPerfil`) deixaram de ser
// desenhados. O bilhete carimbava a conclusão DECLARADA; a caderneta carimba o
// que foi MEDIDO, e os dois na mesma tela diriam duas coisas diferentes sobre a
// mesma estação. A função fica no núcleo: `core/dados-pessoa.js` a exporta e
// `tests/perfil.test.js` (o caso «cada marco tem nome, critério e estado») a
// confere como conta — aposentado é o desenho, não a conta.
//
// NADA DE RELÓGIO PRÓPRIO: toda data sai por dataDeCalendario, formatando a
// string — nunca `new Date(iso)`, que em fuso negativo devolve o dia anterior e
// o bilhete mentiria (lição da 2d-2). `hoje` vem do ctx quando o aparelho não
// tem o dia registrado; sem ctx, é o dia local do núcleo, uma vez só.
import { exportarViagem, importarViagem, revisoesRealizadas } from '../../core/dados-pessoa.js';
// S17b: a caderneta inteira (as duas séries, os recordes e a próxima) é conta de
// núcleo. Esta folha só pinta o que core/caderneta.js decidiu.
import { caderneta as cadernetaNucleo } from '../../core/caderneta.js';
import { dataDeCalendario, perfil as T, caderneta as C } from '../../core/textos.js';
import { hrefDe } from '../../core/rotas.js';
import { dataLocal, resumoDaViagem } from '../../core/viagem.js';
import { STORAGE_KEY, parseRevisoes, serializeRevisoes } from '../../core/revisao.js';
import { carregarViagem, salvarViagem } from '../metro.js';
// S20b-1b: as chaves dos baldes que o arquivo da versão 3 leva. A tela é quem
// conhece o storage (o núcleo continua puro); ela só precisa saber ONDE mora.
import { ESTUDO_KEY, RASCUNHO_PREFIXO, lerEstudo } from '../../core/estudo.js';
import { CARTOES_KEY, lerCartoes } from '../../core/cartoes.js';
// A tabela de aulas por estação (data/aulas/indice.json): a régua da «primeira
// estação percorrida» não existe sem ela. A LEITURA do arquivo mora em
// jornada-topo.js — importar daqui é a casa não ter uma segunda forma de ler o
// mesmo JSON (lição da 2c: dois duplicados do mesmo leitor divergem).
import { carregarIndice } from './jornada-topo.js';

const CLASSE = 'perfil';

function el(doc, classe, texto, tag) {
  const no = doc.createElement(tag || 'div');
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

const placa = (doc, texto) => el(doc, `${CLASSE}-placa`, texto, 'p');
const titulo = (doc, texto, tag) => el(doc, `${CLASSE}-titulo`, texto, tag || 'h2');
const linha = (doc, classe, texto) => el(doc, `${CLASSE}-${classe}`, texto, 'p');

/** O dia que a pessoa lê: o que o núcleo guardou, ou o hoje injetado. */
const dia = (iso, hoje) => dataDeCalendario(iso || hoje);

/** Um dos três cartões. O valor vem sempre de fora, nunca escrito aqui. */
function numero(doc, nome, valor) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-numero`);
  box.append(el(doc, `${CLASSE}-numero-valor`, String(valor), 'p'));
  box.append(placa(doc, nome));
  return box;
}

/**
 * Uma casa do bilhete: o link para a folha daquela estação. O bilhete não é
 * enfeite — clicar num carimbo leva ao que ele foi.
 */
function casa(doc, course, feito, dataConclusao, hoje) {
  const nome = course.title ?? course.id;
  const a = el(doc, `${CLASSE}-casa${feito ? ` ${CLASSE}-casa-carimbada` : ''}`, undefined, 'a');
  // setAttribute, não a propriedade: `a.href = '#/estacao/x'` no navegador vira
  // a URL ABSOLUTA na propriedade, e o atributo é o que a casa lê e o que a
  // rota compara. Quem escreve pela propriedade perde o valor lido do HTML.
  a.setAttribute('href', hrefDe({ tela: 'estacao', slug: course.slug ?? course.id }));
  a.setAttribute('aria-label', feito ? T.casaCarimbada(nome, dia(dataConclusao, hoje)) : T.casaVazia(nome));
  if (Number.isFinite(Number(course.stage))) a.dataset.linha = String(Number(course.stage));
  a.append(el(doc, `${CLASSE}-selo`));
  a.append(el(doc, `${CLASSE}-nome`, nome, 'span'));
  if (feito) a.append(el(doc, `${CLASSE}-data`, dia(dataConclusao, hoje), 'span'));
  return a;
}

/** O bilhete: uma fileira por linha, as casas na ordem do catálogo. */
function bilhete(doc, catalogo, progresso, feitos, conclusoes, hoje) {
  const r = resumoDaViagem(progresso, catalogo.courses || []);
  const box = el(doc, `${CLASSE}-card ${CLASSE}-bilhete`);
  box.append(titulo(doc, T.bilhete));
  const grade = el(doc, `${CLASSE}-grade`);
  for (const linhaR of r.linhas) {
    const fileira = el(doc, `${CLASSE}-bilhete-fileira`);
    fileira.setAttribute('role', 'list');
    for (const c of (catalogo.courses || []).filter((x) => Number(x.stage) === linhaR.linha)) {
      fileira.append(casa(doc, c, feitos.has(c.id), conclusoes[c.id], hoje));
    }
    grade.append(fileira);
  }
  box.append(grade);
  return { box, r };
}

/* ───────────────────────────── a caderneta (S17b) ─────────────────────────────
 *
 * O que pinta, e nada mais. Cada carimbo já vem do núcleo com nome, critério,
 * data, frase e — no caso da estação declarada — a marca separada da data
 * medida (core/caderneta.js). Se esta folha decidir o que é «ganho», a
 * caderneta passa a ter duas definições de carimbo e a tela vence a régua.
 *
 * OS ESPAÇOS VAZIOS SÃO DESENHO, não lacuna a esconder (princípio 4): quem
 * ainda não tem o carimbo lê o critério que o abre. Por isso o vazio vem com
 * contorno, nome e «Abre quando: …», e é a mesma fileira de nós do ganho — só
 * sem tinta.
 */

/** O selo do carimbo: o círculo da linha (domínio) ou o quadrado da casa (percurso). */
function seloCarimbo(doc, c, ganho) {
  const forma = c.serie === 'dominio' ? `${CLASSE}-carimbo-circulo` : `${CLASSE}-carimbo-casa`;
  const s = el(doc, `${forma}${ganho ? '' : ` ${CLASSE}-vazio`}`);
  if (Number.isFinite(Number(c.linha))) s.dataset.linha = String(Number(c.linha));
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/**
 * Um carimbo da caderneta. `novo` desce uma vez (a folha faz o movimento, o CSS
 * manda na duração); `concluída antes` traz a MARCA e a data antiga em lugar da
 * frase medida — é o caso que o princípio 4 separa de propósito.
 *
 * S17b-fix (item 2, a Série do domínio com 7.800 px): `compacto` desenha o espaço
 * vazio com SÓ o contorno e o nome, e `comCriterio` é o falso que decide se a
 * régua «Abre quando: …» sai aqui ou uma vez só no alto da seção. No percurso os
 * dois ficam no padrão (cada critério é diferente, e a régua é a informação); no
 * domínio os 43 compartilham três critérios, então a régua sobe para o cabeçalho e
 * o vazio encolhe para a fileira. O espaço CONTINUA presente e visível — o que
 * deixou de se repetir foi a frase, não o carimbo.
 *
 * O vazio compacto não é mudo: ganha `aria-label` dizendo «sem carimbo». O
 * contorno fino é a única coisa que separa um do outro na tela, e forma sem nome
 * no leitor de tela é informação que só quem enxerga recebe (régua 1).
 */
function carimbo(doc, c, hoje, novo, { compacto = false, comCriterio = true } = {}) {
  const ganho = Boolean(c.data);
  const vazio = !ganho && !c.marca;
  const magro = compacto && vazio;
  const item = el(doc, `${CLASSE}-carimbo${ganho ? '' : ` ${CLASSE}-vazio`}${magro ? ` ${CLASSE}-carimbo-compacto` : ''}`);
  item.dataset.estado = ganho ? 'carimbado' : 'vazio';
  if (novo) item.dataset.novo = 'descer';
  const selo = seloCarimbo(doc, c, ganho);
  const nome = el(doc, `${CLASSE}-carimbo-nome`, c.nome, 'h3');
  if (magro) {
    // A célula compacta é o selo e o nome, SEM o invólucro `.perfil-carimbo-cab`
    // no meio: ela é o item da grade, e uma caixa a mais dentro de uma célula de
    // 160 px é o que faz o nome quebrar em três linhas. O `aria-label` é
    // obrigatório — sem ele a célula seria, no leitor de tela, um nome solto sem
    // estado nenhum (régua 1: forma que só quem enxerga lê é ausência).
    item.append(selo, nome);
    item.setAttribute('role', 'img');
    item.setAttribute('aria-label', `${C.tela.semCarimbo(c.nome)} — ${C.tela.abreQuando(c.criterio)}`);
    return item;
  }
  const cab = el(doc, `${CLASSE}-carimbo-cab`);
  cab.append(selo, nome);
  item.append(cab);
  // O critério fica visível nos dois estados: no ganho ele diz o que foi medido,
  // no vazio ele diz o que falta. Escondê-lo do vazio seria o bilhete de volta.
  if (comCriterio) item.append(linha(doc, 'carimbo-criterio', C.tela.abreQuando(c.criterio)));
  if (ganho) {
    const quando = linha(doc, 'carimbo-data', c.frase);
    quando.setAttribute('aria-label', C.tela.ganho(dia(c.data, hoje)));
    item.append(quando);
    item.append(linha(doc, 'carimbo-dia', dia(c.data, hoje)));
  } else if (c.marca) {
    const marca = el(doc, `${CLASSE}-carimbo-marca`, c.marca, 'p');
    item.append(marca);
    if (c.marcaEm) item.append(linha(doc, 'carimbo-dia', dia(c.marcaEm, hoje)));
    item.setAttribute('aria-label', C.tela.comMarca(c.nome, `${c.marca}, ${dia(c.marcaEm, hoje)}`));
  } else {
    item.append(linha(doc, 'carimbo-vazio', c.frase || C.vazio));
  }
  return item;
}

/**
 * Uma fileira do domínio: os carimbos daquela linha, com os vazios compactos
 * dentro de `.perfil-dominio-grade` (a grade de células) e quem tem frase em
 * linha própria, acima dela. Agrupar por estado, e não despejar tudo na mesma
 * grade, é o que mantém o ganho legível: a célula compacta é `display: contents`
 * na folha, e um carimbo com frase dentro dela seria texto espremido entre duas
 * células de 160 px.
 *
 * A grade é `role="presentation"`: quem conta para o leitor de tela são os
 * carimbos (cada compacto é `role="img"` com o rótulo), e uma caixa de layout a
 * mais na árvore só faria o anúncio gaguejar.
 */
function fileiraDominio(doc, classe, itens, hoje, vistos, { linha = null, rotulo = null } = {}) {
  const fileira = el(doc, classe);
  if (linha !== null) fileira.dataset.linha = linha;
  fileira.setAttribute('role', 'list');
  if (rotulo) fileira.setAttribute('aria-label', rotulo);
  let grade = null;
  const abraGrade = () => {
    if (grade) return grade;
    grade = el(doc, `${CLASSE}-dominio-grade`);
    grade.setAttribute('role', 'presentation');
    fileira.append(grade);
    return grade;
  };
  for (const c of itens) {
    const opt = opcoesDominio(c);
    const ganho = Boolean(c.data);
    const item = carimbo(doc, c, hoje, vistos.novos.has(c.id), opt);
    if (opt.compacto && !ganho) {
      abraGrade().append(item);
    } else {
      fileira.append(item);
    }
  }
  return fileira;
}

/** Uma seção da caderneta: título, e os espaços na ordem do núcleo. */
function secao(doc, nome, itens, hoje, vistos) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-caderneta`);
  box.append(titulo(doc, nome, 'h2'));
  const lista = el(doc, `${CLASSE}-carimbos`);
  lista.setAttribute('role', 'list');
  // O nome da série no `aria-label` da lista: 8 e 43 nós sem nome seriam, para o
  // leitor de tela, duas pilhas idênticas de «Abre quando…».
  lista.setAttribute('aria-label', nome);
  for (const c of itens) lista.append(carimbo(doc, c, hoje, vistos.novos.has(c.id)));
  box.append(lista);
  return box;
}

/**
 * Como cada espaço do domínio é desenhado. A régua das ESTAÇÕES (35 nós, todos
 * iguais no núcleo — `criterio: C.dominio.criterioEstacao`) sobe para o alto da
 * seção e não se repete embaixo; os fins de linha e o terminal têm critérios
 * próprios, um por fileira, e continuam com «Abre quando: …» no lugar.
 *
 * Decidir pela FRASE DO CRITÉRIO e não pelo `id` é de propósito: o id é uma
 * string do núcleo (`dominio:linha-3`), e parsear id de núcleo na tela é a tela
 * reimpondo a forma que o núcleo escolheu. Se um carimbo novo do domínio chegar
 * com outro critério, ele sai com a régua escrita — o desenhista não conhece a
 * lista de ids por dentro.
 */
function opcoesDominio(c) {
  const daEstacao = c.criterio === C.dominio.criterioEstacao;
  return { compacto: daEstacao, comCriterio: !daEstacao };
}

/**
 * O domínio em fileiras por linha, como o bilhete já faz: uma fileira por linha
 * com as estações dela e o fim da linha no fim, e o terminal depois de todas.
 * A ordem é a do núcleo; aqui só se agrupa.
 *
 * S17b-fix (item 2): a régua do domínio são TRÊS frases para 43 espaços — uma por
 * estação, uma por fim de linha, uma para o terminal. Ela aparece no alto da seção
 * uma vez, e o vazio de baixo é contorno e nome. Não é sumário nem legenda
 * escondida: é a mesma frase, dita uma vez em vez de 35. Os carimbos GANHOS
 * continuam com a frase medida e o dia, porque ali o texto é o fato, não a régua.
 */
function secaoDominio(doc, dominio, hoje, vistos) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-caderneta ${CLASSE}-dominio`);
  box.append(titulo(doc, C.tela.serieDominio, 'h2'));
  const regra = el(doc, `${CLASSE}-dominio-regra`);
  regra.append(linha(doc, 'carimbo-criterio', C.tela.abreQuando(C.dominio.criterioEstacao)));
  box.append(regra);
  const porLinha = new Map();
  const semLinha = [];
  for (const c of dominio) {
    // `linha === null` é o terminal, e `Number(null)` é 0 — finito. Sem checar
    // a nulidade ANTES da conversão, o terminal ganham uma oitava fileira
    // «linha 0» no meio das sete, e o pedido era o terminal DEPOIS de todas.
    const n = c.linha === null || c.linha === undefined ? null : Number(c.linha);
    if (n === null || !Number.isFinite(n)) { semLinha.push(c); continue; }
    if (!porLinha.has(n)) porLinha.set(n, []);
    porLinha.get(n).push(c);
  }
  const fileiras = [...porLinha.keys()].sort((a, b) => a - b);
  for (const n of fileiras) {
    box.append(fileiraDominio(doc, `${CLASSE}-fileira`, porLinha.get(n), hoje, vistos, { linha: String(n), rotulo: C.tela.fileira(n) }));
  }
  if (semLinha.length) {
    box.append(fileiraDominio(doc, `${CLASSE}-fileira ${CLASSE}-fileira-terminal`, semLinha, hoje, vistos));
  }
  return box;
}

/** Os recordes: sem dado, o recorde não aparece — um «0» seria um feito que ninguém bateu. */
function secaoRecordes(doc, recordes) {
  const comValor = (recordes || []).filter((r) => r.valor !== null && r.valor !== undefined);
  if (!comValor.length) return null;
  const box = el(doc, `${CLASSE}-card ${CLASSE}-caderneta ${CLASSE}-recordes`);
  box.append(titulo(doc, C.tela.recordes, 'h2'));
  for (const r of comValor) {
    const item = el(doc, `${CLASSE}-recorde`);
    item.append(el(doc, `${CLASSE}-recorde-nome`, r.nome, 'h3'));
    item.append(linha(doc, 'recorde-valor', r.frase));
    item.append(linha(doc, 'recorde-criterio', C.tela.abreQuando(r.criterio)));
    box.append(item);
  }
  return box;
}

/** A próxima coisa, no texto do núcleo, com o link para a estação quando ele existe. */
function secaoProxima(doc, proxima, catalogo) {
  if (!proxima || !proxima.texto) return null;
  const box = el(doc, `${CLASSE}-card ${CLASSE}-caderneta ${CLASSE}-proxima`);
  box.append(titulo(doc, C.tela.proxima, 'h2'));
  const curso = (catalogo || []).find((c) => c.id === proxima.estacao);
  if (curso) {
    const a = el(doc, `${CLASSE}-proxima-link`, proxima.texto, 'a');
    a.setAttribute('href', hrefDe({ tela: 'estacao', slug: curso.slug ?? curso.id }));
    box.append(a);
  } else {
    box.append(linha(doc, 'proxima-texto', proxima.texto));
  }
  return box;
}

/**
 * Os carimbos que a pessoa já viu no Perfil. Guarda só a lista de ids ganhos,
 * porque «novo desde a última visita» é a única coisa que este storage sabe:
 * ele não é uma segunda caderneta, e se virasse uma, divergiria do núcleo.
 */
const VISTOS_KEY = 'atlas.caderneta.vistos.v1';

function lerVistos(storage) {
  let bruto = null;
  try { bruto = storage ? storage.getItem(VISTOS_KEY) : null; } catch { bruto = null; }
  let lista = [];
  try { lista = JSON.parse(bruto || '[]'); } catch { lista = []; }
  return new Set(Array.isArray(lista) ? lista : []);
}

function gravarVistos(storage, ids) {
  if (!storage) return;
  try { storage.setItem(VISTOS_KEY, JSON.stringify([...ids])); } catch { /* sem storage: nada desce, nada se perde */ }
}

/** `novos` = ganhos que ainda não foram vistos; o conjunto gravado passa a ser todos os ganhos. */
function preparoCaderneta(storage, todas) {
  const vistos = lerVistos(storage);
  const ganhos = new Set(todas.filter((c) => c.data).map((c) => c.id));
  const novos = new Set([...ganhos].filter((id) => !vistos.has(id)));
  return { vistos, novos, gravar: () => gravarVistos(storage, ganhos) };
}

/**
 * Os dados da pessoa: o arquivo sai daqui e volta por aqui. A recusa aparece na
 * tela com as três partes (o quê, por quê, o que fazer) — a regra é do núcleo,
 * esta folha só põe o texto onde o olho está.
 */
function dados(doc) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-dados`);
  box.append(titulo(doc, T.dados.titulo));
  box.append(linha(doc, 'dados-fica', T.dados.ficaAqui));

  const acoes = el(doc, `${CLASSE}-dados-acoes`);
  // S20b-6 (itens 3 e 4): as duas pontas desta fileira usam o desenho da casa.
  // `botao botao-secundario` é o contorno de folha.css:293 — o mesmo que a folha dá
  // a «Ver as 93 aulas» (folha.js:92), e as três travas que CONTAM secundários no
  // DOM montado (folha.test.js:179, aulas-tela.test.js:180, aulas-fio.test.js:168)
  // procuram exatamente essa classe: a crua `secundario` não era nada para elas.
  const saida = el(doc, 'botao botao-secundario', T.dados.exportar, 'button');
  saida.type = 'button';
  acoes.append(saida);

  const grupo = el(doc, `${CLASSE}-dados-importar`);
  // S20b-6 (item 4): o rótulo É o botão que a pessoa vê. As classes da casa
  // (`botao botao-secundario`, o contorno de folha.css:293 que a folha dá a «Ver
  // as 93 aulas») vêm com caixa, min-height, borda e cor — e é o par exato do
  // «Exportar viagem» ao lado: dois botões iguais, um arquivo que sai e um que
  // entra. O input por cima (perfil.css, item 4) continua sendo o controle.
  const rotulo = el(doc, `${CLASSE}-dados-rotulo botao botao-secundario`, undefined, 'label');
  rotulo.htmlFor = 'perfil-arquivo';
  rotulo.append(el(doc, `${CLASSE}-dados-importar-texto`, T.dados.importar, 'span'));
  const entrada = el(doc, `${CLASSE}-dados-input`, undefined, 'input');
  entrada.id = 'perfil-arquivo';
  entrada.setAttribute('type', 'file');
  entrada.setAttribute('accept', '.json,application/json');
  // O input some da pintura (perfil.css, S20b-6 item 4) e quem aperta passa a ser o
  // rótulo com o desenho de botão. O `aria-label` é o que mantém o controle nomeado
  // para quem não vê a tela: sem ele, o Tab cai num controle invisível sem nome e a
  // régua 1 chama isso de ausência. O nome por extenso vem de T.dados (textos.js).
  entrada.setAttribute('aria-label', T.dados.importLabel);
  grupo.append(rotulo, entrada);
  acoes.append(grupo);
  box.append(acoes);
  return { box, saida, entrada, grupo };
}

function sobre(doc) {
  const box = el(doc, `${CLASSE}-card ${CLASSE}-sobre`);
  box.append(titulo(doc, T.sobre.titulo));
  box.append(linha(doc, 'sobre-linha', T.sobre.curriculo));
  box.append(linha(doc, 'sobre-linha', T.sobre.fonte));
  const link = el(doc, `${CLASSE}-sobre-codigo`, T.sobre.codigo, 'a');
  link.href = T.sobre.codigoUrl;
  link.setAttribute('rel', 'noopener');
  box.append(link);
  return box;
}

/**
 * Os baldes que a versão 3 do arquivo leva: estudo, cartões, rascunhos e o
 * carimbo das dominadas.
 *
 * POR QUE A TELA LÊ O STORAGE E O NÚCLEO NÃO: o núcleo é puro e nunca toca em
 * `window` (regra da casa, e é o que o deixa testar em node sem navegador). Quem
 * sabe onde mora cada chave é esta folha. Ela entrega o texto CRU por `extras` e
 * é `core/progress-io.js` quem canoniciza e decide se o campo entra no arquivo.
 *
 * A enumeração dos rascunhos usa `key(i)`, o método do `Storage` de verdade: os
 * storage falsos dos testes ganham `key`/`length` junto (tests/hdom.js), e o
 * `try/catch` é para o aparelho que não deixa nem enumerar — modo privado. Nesse
 * caso o arquivo sai sem rascunho nenhum e a pessoa perde só o que não digitou.
 *
 * `dominadas` não passa por aqui: já vem de `carregarViagem` dentro de
 * `lerEstado`, e é o mesmo objeto que a caderneta pinta.
 */
function baldesDaPessoa(storage) {
  const pega = (chave) => {
    try { return storage ? storage.getItem(chave) : null; } catch { return null; }
  };
  const rascunhos = {};
  try {
    const total = typeof storage?.length === 'number' ? storage.length : 0;
    for (let i = 0; i < total; i += 1) {
      const chave = typeof storage?.key === 'function' ? storage.key(i) : null;
      // A chave do storage vai INTEIRA no arquivo, não o id do vídeo: é o que faz
      // a tela importar ser um `setItem(chave, texto)` sem remontar nada, e é o
      // que mantém «exportar → importar → exportar» byte a byte. O prefixo é lido
      // do núcleo (core/estudo.js:779), não copiado aqui.
      if (typeof chave !== 'string' || !chave.startsWith(RASCUNHO_PREFIXO)) continue;
      const texto = pega(chave);
      if (texto) rascunhos[chave] = texto;
    }
  } catch { /* sem enumeração possível: o arquivo sai sem rascunho */ }
  return {
    estudo: pega(ESTUDO_KEY),
    cartoes: pega(CARTOES_KEY),
    rascunhos
  };
}

/**
 * Monta o Perfil na raiz que o casco escolheu.
 *
 * @param {Element} raiz contêiner da tela
 * @param {object} ctx {catalogo, modulos, storage?, document?, window?, hoje?}
 * @returns {Promise<{pronto: Promise, estado: () => object, desmontar: () => void}>}
 */
export async function montar(raiz, ctx) {
  const doc = ctx.document || document;
  const win = ctx.window || window;
  const storage = ctx.storage || win.localStorage || null;
  const modulos = ctx.modulos || {};
  const hoje = typeof ctx.hoje === 'string' ? ctx.hoje : dataLocal();

  let montado = true;
  let catalogo = null;
  // S17b: a tabela de aulas por estação. `primeira estação percorrida` não existe
  // sem ela, e sem ela a tela mostra o espaço VAZIO — não um carimbo chutado.
  // `ctx.indice` é a injeção do teste e do casco que já tem a tabela na mão
  // (web/metro.js guarda `ui.indice`); buscar só quando não há.
  let indice = ctx.indice || null;
  let estado = { completed: [], emCurso: [], conclusoes: {}, anotacoes: {}, revisoes: {} };
  // O trabalho em voo: ler o arquivo da pessoa é assíncrono, e quem chama
  // `montar` precisa poder esperar POR ELE, não só pela primeira pintura.
  let emVoo = Promise.resolve();

  const raizEl = el(doc, CLASSE);
  raiz.append(raizEl);

  function lerEstado(cat) {
    const completed = typeof modulos.loadCompleted === 'function' ? modulos.loadCompleted() : [];
    const detalhe = carregarViagem(storage, completed);
    let revisoes = {};
    try {
      revisoes = parseRevisoes(storage ? storage.getItem(STORAGE_KEY) : null);
    } catch {
      revisoes = {};
    }
    const notas = typeof modulos.loadNotas === 'function' ? modulos.loadNotas() : {};
    return {
      courses: cat.courses || [],
      electives: cat.electives,
      specializations: cat.specializations,
      completed: detalhe.completed,
      emCurso: detalhe.emCurso,
      conclusoes: detalhe.conclusoes,
      // S18b-2: o carimbo do desafio (J4) mora em `dominadas`, e é daqui que a
      // caderneta o lê. `carregarViagem` já traz o campo; se ele não passar por
      // este estado, a tela perde a dominada entre ler e desenhar.
      dominadas: detalhe.dominadas,
      anotacoes: notas || {},
      revisoes,
      // S20b-1b: os baldes entram no estado exatamente para serem exportados —
      // `exportarViagem` (core/dados-pessoa.js) lê `estado.estudo`,
      // `estado.cartoes`, `estado.rascunhos` e `estado.dominadas` e os entrega a
      // `core/progress-io.js`, que é quem decide a forma. Ler aqui e não passar
      // adiante seria o mesmo buraco do v2 com uma folha nova por cima.
      ...baldesDaPessoa(storage),
    };
  }

  /**
   * Os baldes lidos como O QUE O NÚCLEO ESPERA: o texto cru do storage vira o
   * mesmo objeto que a aula e a Revisar usam. `lerEstudo`/`lerCartoes` devolvem o
   * balde vazio para `null`, então isto nunca lança — e a caderneta vê ausência
   * como ausência, não como erro.
   */
  function cadernetaDe(estadoTela) {
    const progresso = {
      completed: estadoTela.completed,
      emCurso: estadoTela.emCurso,
      conclusoes: estadoTela.conclusoes,
      dominadas: estadoTela.dominadas,
    };
    return cadernetaNucleo({
      estudo: lerEstudo(estadoTela.estudo),
      cartoes: lerCartoes(estadoTela.cartoes),
      progresso,
      catalogo: (estadoTela.courses || []).length ? estadoTela.courses : [],
      indice,
      hoje,
    });
  }

  /** O recado do gesto, colado no gesto que o produziu. */
  function avisar(on, texto) {
    if (!montado || !on || !on.parentNode) return;
    const p = el(doc, `${CLASSE}-dados-recado`, texto);
    p.setAttribute('role', 'status');
    on.parentNode.append(p);
  }

  function desenhar(cat) {
    catalogo = cat;
    estado = lerEstado(cat);
    const feitos = new Set(estado.completed);
    raizEl.textContent = '';

    const cab = el(doc, `${CLASSE}-card ${CLASSE}-cabeca`);
    cab.append(placa(doc, T.rotulo));
    cab.append(el(doc, `${CLASSE}-h1`, T.titulo, 'h1'));
    raizEl.append(cab);

    // S18b-2: `dominadas` entra aqui porque esta tela é quem desenha o carimbo da
    // estação (a caderneta, desenho §gamificação) e é quem lê a frase do que foi
    // medido. O objeto de progresso é remontado campo a campo, e sem esta linha o
    // carimbo chegaria até `carregarViagem` e pararia neste ponto — a tela do
    // perfil diria «percorrida» sobre uma estação que a pessoa dominou.
    const progresso = {
      completed: estado.completed,
      emCurso: estado.emCurso,
      conclusoes: estado.conclusoes,
      dominadas: estado.dominadas,
    };
    // S17b: a caderneta do Perfil. O núcleo devolve SEMPRE as duas séries inteiras
    // (8 + uma por estação/linha + terminal), ganhas ou vazias — é por isso que
    // esta folha não tem um «se não houver carimbo» na frente dela.
    const serie = cadernetaDe(estado);
    const vistos = preparoCaderneta(storage, [...serie.percurso, ...serie.dominio]);

    let r;
    if (feitos.size === 0) {
      // Trinta e cinco anéis vazios não dizem nada a quem ainda não começou: o
      // lugar do bilhete recebe a frase e a saída. Marcos e dados continuam.
      const vazio = el(doc, `${CLASSE}-card ${CLASSE}-em-branco`);
      vazio.append(linha(doc, 'em-branco-texto', T.emBranco));
      // S20b-6 (item 3): `botao botao-primario` é a classe que a FOLHA usa
      // (folha.js:354,359; aulas-pedacos.js:136; revisar-fila.js:61) e que a régua
      // de hierarquia da casa conta no DOM montado. A crua `primario` não era nada
      // para nenhuma dessas travas — o botão saía cinza do sistema, com o
      // sublinhado e o fundo do navegador. Um primário por tela continua um.
      const ir = el(doc, 'botao botao-primario', T.irParaProxima, 'a');
      ir.setAttribute('href', hrefDe({ tela: 'jornada' }));
      vazio.append(ir);
      raizEl.append(vazio);
      r = resumoDaViagem(progresso, cat.courses || []);
    } else {
      const b = bilhete(doc, cat, progresso, feitos, estado.conclusoes, hoje);
      raizEl.append(b.box);
      r = b.r;
    }

    const numeros = el(doc, `${CLASSE}-numeros`);
    numeros.append(numero(doc, T.numeros.carimbos, `${r.concluidas}/${r.estacoes}`));
    numeros.append(numero(doc, T.numeros.linhas, `${r.linhasFechadas} de ${r.linhas.length}`));
    // S17b-fix (item 3): `estado.revisoes` é o calendário do sistema antigo, e a
    // revisão hoje mora no `historico` de cada cartão. Contar só o primeiro dizia
    // «0 revisões» para quem tinha respondido sete cartões.
    numeros.append(numero(doc, T.numeros.revisoes,
      revisoesRealizadas(estado.revisoes, lerCartoes(estado.cartoes))));
    raizEl.append(numeros);

    // S17b: as duas séries, depois os recordes e a próxima. Os marcos da S9 saíram
    // daqui de propósito: ver o comentário no topo da folha.
    // S17b-fix (item 1): as duas séries vão dentro de um wrapper, e é ele que
    // divide a tela em duas colunas de 1024 para cima. Abaixo disso o wrapper é a
    // coluna de sempre, com o mesmo ar do .perfil — as duas séries continuam uma
    // embaixo da outra, e nenhum espaço da caderneta some com o wrapper.
    const series = el(doc, `${CLASSE}-series`);
    series.append(secao(doc, C.tela.seriePercurso, serie.percurso, hoje, vistos));
    series.append(secaoDominio(doc, serie.dominio, hoje, vistos));
    raizEl.append(series);
    const rec = secaoRecordes(doc, serie.recordes);
    if (rec) raizEl.append(rec);
    const prox = secaoProxima(doc, serie.proxima, estado.courses || []);
    if (prox) raizEl.append(prox);

    // O carimbo que a pessoa acabou de ganhar desce UMA vez: a partir desta
    // visita ele está visto, e o conjunto gravado passa a ser todos os ganhos.
    vistos.gravar();

    const d = dados(doc);
    raizEl.append(d.box);
    raizEl.append(sobre(doc));

    d.saida.addEventListener('click', () => {
      const feito = exportarViagem(estado, { document: doc, window: win });
      avisar(d.saida, feito.ok ? feito.mensagem : T.dados.semDownload);
    });

    d.entrada.addEventListener('change', (ev) => {
      const alvo = ev && ev.target ? ev.target : d.entrada;
      const arquivo = alvo.files && alvo.files[0];
      if (!arquivo) return;
      emVoo = (async () => {
        let texto = '';
        try {
          texto = typeof arquivo.text === 'function' ? await arquivo.text() : String(arquivo);
        } catch {
          texto = '';
        }
        const deVolta = importarViagem(texto, estado);
        if (!deVolta.ok) {
          avisar(alvo, deVolta.mensagem);
          return;
        }
        estado = {
          ...estado,
          completed: deVolta.completed,
          anotacoes: deVolta.anotacoes,
          revisoes: deVolta.revisoes,
        };
        const gravou = typeof modulos.saveCompleted === 'function'
          ? modulos.saveCompleted(deVolta.completed)
          : true;
        if (typeof modulos.saveNotas === 'function') modulos.saveNotas(deVolta.anotacoes);
        let guardouFila = true;
        if (storage) {
          try {
            storage.setItem(STORAGE_KEY, serializeRevisoes(deVolta.revisoes));
          } catch {
            guardouFila = false;
          }
        }
        // S20b-1b: os baldes voltam ao storage. A regra é uma só e é a da viagem:
        // o arquivo que NÃO FALOU de um balde não apaga o balde do aparelho —
        // `traz*` é o sinal, e um `setItem` unconditional com o `null` do v2
        // apagaria os cartões de quem importa um backup de ontem.
        // `setItem` com texto vazio não existe: o núcleo devolve `null`, não `{}`,
        // justamente para este `if` ser possível.
        const devolveBalde = (chave, texto, falou) => {
          if (!storage || !falou || typeof texto !== 'string') return true;
          try {
            storage.setItem(chave, texto);
            return true;
          } catch {
            return false;
          }
        };
        let guardouBaldes = true;
        guardouBaldes = devolveBalde(ESTUDO_KEY, deVolta.estudo, deVolta.trazEstudo) && guardouBaldes;
        guardouBaldes = devolveBalde(CARTOES_KEY, deVolta.cartoes, deVolta.trazCartoes) && guardouBaldes;
        if (storage && deVolta.trazRascunhos && deVolta.rascunhos) {
          for (const [chave, texto] of Object.entries(deVolta.rascunhos)) {
            if (!devolveBalde(chave, texto, true)) { guardouBaldes = false; break; }
          }
        }
        // As dominadas voltam pela chave da viagem, que é onde moram
        // (web/metro.js: `atlas.viagem.detalhe.v1`). O arquivo que não falou delas
        // deixa `salvarViagem` com as do aparelho: importar backup velho não
        // rebaixa ninguém, que é a regra do desenho J4.
        if (storage && deVolta.trazDominadas) {
          try {
            salvarViagem(storage, {
              completed: deVolta.completed,
              emCurso: estado.emCurso,
              conclusoes: estado.conclusoes,
              dominadas: deVolta.dominadas
            });
          } catch { /* sem storage: o estado da tela ainda pinta o arquivo */ }
        }
        estado = {
          ...estado,
          estudo: deVolta.trazEstudo ? deVolta.estudo : estado.estudo,
          cartoes: deVolta.trazCartoes ? deVolta.cartoes : estado.cartoes,
          rascunhos: deVolta.trazRascunhos ? deVolta.rascunhos : estado.rascunhos,
          dominadas: deVolta.trazDominadas ? deVolta.dominadas : estado.dominadas
        };
        avisar(alvo, `${deVolta.mensagem}${gravou && guardouFila && guardouBaldes ? '' : ` ${T.dados.semStorage}`}`);
        if (catalogo && montado) desenhar(catalogo);
      })();
    });
  }

  // Só a promessa do catálogo, nunca `ctx.estadoCatalogo`: esse campo é efeito
  // colateral de outra tela (a Revisar escreve nele no casco compartilhado).
  // Pintar por ele faria o Perfil depender de a pessoa já ter visitado a
  // Revisar — e sem isso ele ignoraria o `catch` abaixo, servindo o estado
  // vazio em vez de dizer "sem rede" quando a trilha caiu.
  /**
   * A tabela de aulas por estação — injetada por quem já a tem (`ctx.indice`, que o
   * `web/metro.js` guarda), buscada uma vez no navegador, ou `null`.
   *
   * `win.fetch`, e não o `fetch` global: em node os dublês de janela dos testes não
   * têm `fetch`, então a tela não dispara rede de dentro de um teste unitário e o
   * carimbo «primeira estação percorrida» fica vazio — que é a resposta honesta para
   * «não sei quantas aulas a estação tem». No aparelho, o service worker responde os
   * bytes do precache, então sem rede a tabela chega do mesmo jeito.
   */
  async function garantirIndice() {
    if (indice) return indice;
    if (typeof win?.fetch !== 'function') return null;
    const r = await carregarIndice((url) => win.fetch(url));
    indice = r.ok ? r.dados : null;
    return indice;
  }

  emVoo = ctx.catalogo
      .then((cat) => {
        if (!montado) return cat;
        // A ordem IMPORTA: indice na mão (teste, ou o casco que já carregou) ou
        // aparelho sem fetch pinta no MESMO tick microtarefa de sempre — é o que
        // os testes antigos que esperam só `montar` exigem. No navegador de
        // verdade, adiar a primeira pintura até a tabela de aulas chega é mais
        // correto do que repintar: o carimbo da estação percorrida ou nasce na
        // primeira pintura ou não nasce.
        if (indice || typeof win?.fetch !== 'function') {
          desenhar(cat);
          return cat;
        }
        return garantirIndice().then(() => {
          if (montado) desenhar(cat);
          return cat;
        });
      })
      .catch(() => {
        if (!montado) return null;
        // Erro com as três partes e sem resto de código na tela.
        raizEl.textContent = '';
        const cab = el(doc, `${CLASSE}-card ${CLASSE}-cabeca`);
        cab.append(placa(doc, T.rotulo));
        cab.append(el(doc, `${CLASSE}-h1`, T.titulo, 'h1'));
        raizEl.append(cab);
        // S10a (regua 1): as tres partes e uma saida, como no metrô. Sem isto o
        // Perfil sem rede era um beco: uma frase e nenhum caminho de volta.
        raizEl.append(linha(doc, 'falha', T.erro), linha(doc, 'falha', T.erroOQueFazer));
        // S20b-6 (item 3): idem ao `ir` do bilhete em branco — a mesma classe da
        // folha, no mesmo lugar de hierarquia (a única saída do beco).
        const irFalha = el(doc, 'botao botao-primario', T.irParaProxima, 'a');
        irFalha.setAttribute('href', hrefDe({ tela: 'jornada' }));
        raizEl.append(irFalha);
        return null;
      });

  return {
    get pronto() { return emVoo; },
    estado: () => estado,
    desmontar: () => { montado = false; },
  };
}
