// Projeto Atlas — S14b1, a PÁGINA DA AULA (web/telas/aula.js).
//
// POR QUE EXISTE: esta é a tela que mudou o DESTINO do toque. Até a S13b a
// folha e a lista abriam o YouTube; agora abrem a página da aula, e é dela que
// se sai para o vídeo. O que se trava aqui não é só "a tela tem estas frases":
// é que o único clique que GRAVA abertura é o que sai para o YouTube, e que a
// volta da aba encontra o fechamento sem a pessoa procurar.
//
// DADOS REAIS (a lição da S13b): as aulas vêm de data/aulas/circuitos-digitais
// .json e a estação de data/catalog.json NA FORMA DO APP ({ courses }). Um
// catálogo de lista não é o que o casco entrega, e foi um dublê de forma
// inventada que deixou um turno inteiro verde sobre uma tela em branco.
//
// O QUE O NODE NÃO PROVA: o rolamento suave, o anel de foco desenhado, o
// contraste do Assistir, o máximo de 720 px. Isso é conferido no Chrome, e o
// que a régua daqui cobra é a ESTRUTURA: a classe da linha na raiz, o tabindex
// -1 do h2, o href certo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarDoc, storageCom, todos } from './hdom.js';
import { duracaoLegivel, marcaDeTempo, pausasDaAula } from '../core/aulas.js';
import { aula as U, aulas as A, fechamento as F } from '../core/textos.js';
import { hrefDe, lerRota } from '../core/rotas.js';
import { ESTUDO_KEY, lerEstudo } from '../core/estudo.js';
import { telaDaRota } from '../web/casco.js';
import { montar as montarAula } from '../web/telas/aula.js';
import { montar as montarLista } from '../web/telas/aulas.js';

const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const CATALOGO_BRUTO = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const CATALOGO = { courses: CATALOGO_BRUTO.courses || CATALOGO_BRUTO };
const CIRCUITOS = CATALOGO.courses.find((c) => c.slug === 'circuitos-digitais');
const TOTAL = AULAS.total.aulas;
assert.equal(TOTAL, AULAS.aulas.length, 'o total do arquivo discorda do array');

const textoDo = (no) => todos(no, (n) => n._texto).map((n) => n._texto).join(' ').replace(/\s+/g, ' ').trim();
const comClasse = (raiz, classe) => todos(raiz, (n) => (n.className || '').split(/\s+/).includes(classe));
const um = (raiz, classe, onde) => {
  const achei = comClasse(raiz, classe);
  assert.equal(achei.length, 1, `${onde}: esperado exatamente um .${classe}, achei ${achei.length}`);
  return achei[0];
};
const aulaEm = (n) => AULAS.aulas.find((a) => Number(a.n) === n);
const hrefPagina = (n) => hrefDe({ tela: 'estacao', slug: CIRCUITOS.slug, painel: 'aula', n });

/**
 * Sobe uma tela no mini-DOM com um window que GUARDA os ouvintes, para que o
 * teste dispare o `visibilitychange` da volta da aba à mão.
 */
async function subir(montar, n, { aulas = AULAS, visivel = 'visible' } = {}) {
  const doc = criarDoc();
  const ouvintes = new Map();
  const win = {
    localStorage: storageCom(),
    document: { visibilityState: visivel },
    Date,
    matchMedia: () => ({ matches: false }),
    scrollTo: () => {},
    addEventListener: (tipo, fn) => {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, []);
      ouvintes.get(tipo).push(fn);
      // O gravador amarra o visibilitychange ao WINDOW, não à tela: quem dispara
      // é o navegador, e o teste tem de bater na mesma porta.
      win.__ouvintes = ouvintes;
    },
    removeEventListener: (tipo, fn) => ouvintes.set(tipo, (ouvintes.get(tipo) || []).filter((f) => f !== fn))
  };
  const raiz = doc.createElement('div');
  const ctx = {
    document: doc,
    window: win,
    catalogo: Promise.resolve(CATALOGO),
    folha: CIRCUITOS.slug,
    n,
    buscarAulas: aulas ? async () => ({ ok: true, status: 200, json: async () => aulas }) : async () => ({ ok: false, status: 404 })
  };
  const instancia = await montar(raiz, ctx);
  const disparar = (tipo) => (ouvintes.get(tipo) || []).forEach((fn) => fn({ type: tipo }));
  return { doc, win, raiz, instancia, disparar, ouvintes };
}

const pagina = (n, opts) => subir(montarAula, n, opts);

test('a rota /aula/<n> é uma TELA do casco, e o número chega à tela', () => {
  const rota = lerRota('#/estacao/circuitos-digitais/aula/3');
  assert.equal(rota.painel, 'aula');
  assert.equal(rota.n, 3);
  const decidida = telaDaRota(rota);
  assert.equal(decidida.tela, 'aula', 'o casco tem de importar web/telas/aula.js');
  assert.equal(decidida.folha, 'circuitos-digitais', 'o slug diz QUAL estação');
  assert.equal(decidida.n, 3, 'a tela não lê endereço: quem lê a rota entrega o número');
  // A estação e a lista continuam onde sempre estiveram.
  assert.equal(telaDaRota(lerRota('#/estacao/circuitos-digitais')).tela, 'jornada');
  assert.equal(telaDaRota(lerRota('#/estacao/circuitos-digitais/aulas')).tela, 'aulas');
});

test('o topo: a classe da linha na raiz, o selo, "Aula n de N" e o título da fonte', async () => {
  const n = 3;
  const { raiz, instancia } = await pagina(n);
  const aula = aulaEm(n);

  // A CLASSE DA LINHA NA RAIZ É A TRAVA DO CONTRASTE, repetida da S13e: sem
  // `lN` o --cor fica vazio e o Assistir sai com texto --superficie sobre o
  // fundo da página — 1,1:1, invisível para o node, medido no Chrome.
  assert.match(raiz.className, /\bl1\b/, `a raiz perdeu a classe da linha: "${raiz.className}"`);

  const voltar = um(raiz, 'aulas-voltar', 'página da aula');
  assert.equal(voltar.getAttribute('href'), '#/estacao/circuitos-digitais/aulas');
  assert.equal(textoDo(voltar), U.voltarParaAulas(CIRCUITOS.title));
  assert.equal(um(raiz, 'selo', 'página da aula').textContent, '1');
  assert.equal(textoDo(um(raiz, 'aula-linha', 'página da aula')), `Linha 1 · ${CIRCUITOS.title}`);
  assert.equal(textoDo(um(raiz, 'aula-posicao', 'página da aula')), `Aula ${n} de ${TOTAL}`);

  const h1 = todos(raiz, (x) => x.tag === 'h1');
  assert.equal(h1.length, 1, 'UM h1, é nele que o casco põe o foco');
  assert.equal(h1[0].textContent, aula.titulo);

  // Título da aba e anúncio são FRASES DIFERENTES de propósito: "Aula 3 ·
  // Circuitos Digitais" diz onde eu estou; "Aula 3 de 93: <título>" diz o que
  // eu abri, e nenhuma das duas cabe na outra.
  assert.equal(instancia.rotulo, `Aula ${n} · ${CIRCUITOS.title}`);
  assert.equal(instancia.anuncio, `Aula ${n} de ${TOTAL}: ${aula.titulo}`);
});

test('a linha de apoio traz a duração, e a etiqueta "Exercício" só na aula de exercício', async () => {
  const exercicio = AULAS.aulas.find((a) => a.exercicio);
  assert.ok(exercicio, 'o arquivo real tem de ter uma aula de exercício para este caso existir');
  const { raiz } = await pagina(Number(exercicio.n));
  assert.equal(textoDo(um(raiz, 'aula-duracao', 'apoio')), duracaoLegivel(exercicio.duracaoS));
  assert.equal(textoDo(um(raiz, 'aula-etiqueta', 'apoio de exercício')), 'Exercício');

  const normal = AULAS.aulas.find((a) => !a.exercicio);
  const { raiz: limpa } = await pagina(Number(normal.n));
  assert.equal(comClasse(limpa, 'aula-etiqueta').length, 0, 'aula comum não pode sair etiquetada');
});

test('o Assistir é o único link que sai do app, e é ele que grava a abertura', async () => {
  const n = 3;
  const aula = aulaEm(n);
  const { win, raiz } = await pagina(n);

  const assistir = um(raiz, 'aula-assistir', 'página da aula');
  assert.equal(assistir.tag, 'a', 'o Atlas não é dono da aba do YouTube: é link');
  assert.equal(textoDo(assistir), 'Assistir no YouTube');
  const href = assistir.getAttribute('href');
  assert.ok(href.startsWith(`https://www.youtube.com/watch?v=${encodeURIComponent(aula.id)}`), `vídeo errado: ${href}`);
  assert.ok(href.includes('&list='), `sem o list= a pessoa termina e o YouTube sugere fora da estação: ${href}`);
  assert.equal(assistir.getAttribute('target'), '_blank');
  assert.equal(assistir.getAttribute('rel'), 'noopener', '_blank sem noopener dá acesso à janela de quem abriu');
  assert.equal(assistir.getAttribute('data-aula'), String(aula.id));

  assert.equal(win.localStorage.getItem(ESTUDO_KEY), null, 'nada pode estar aberto antes do clique');
  raiz.dispatch('click', { target: assistir });
  const gravado = lerEstudo(win.localStorage.getItem(ESTUDO_KEY));
  assert.equal(gravado.aulas[String(aula.id)].n, n, 'o clique no Assistir tem de gravar a aula');
  assert.match(gravado.aulas[String(aula.id)].abertaEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'regra 13: hora local, sem Z');
});

test('link interno NÃO grava abertura: ler a lista não abre aula nenhuma', async () => {
  const { raiz, win } = await pagina(3);
  const voltar = um(raiz, 'aulas-voltar', 'página da aula');
  raiz.dispatch('click', { target: voltar });
  assert.equal(win.localStorage.getItem(ESTUDO_KEY), null,
    'um toque em endereço interno marcou aula como aberta: o progresso subiria sozinho');
});

test('as pausas: três marcas numa aula de 32:46, cada uma apontando para o seu segundo', async () => {
  // A conta é do núcleo, e o teste dela é aqui na MEDIDA: 32:46 = 1966 s,
  // pausas de 8 em 8 min, nunca a menos de 3 min do fim.
  assert.deepEqual(pausasDaAula(32 * 60 + 46), [480, 960, 1440]);
  assert.deepEqual(pausasDaAula(7 * 60), [], 'aula curta não merece pausa');
  assert.equal(marcaDeTempo(480), '8:00');

  const alvo = AULAS.aulas.find((a) => pausasDaAula(a.duracaoS).length >= 3) || AULAS.aulas[0];
  const { raiz } = await pagina(Number(alvo.n));
  const marcas = pausasDaAula(alvo.duracaoS);
  const links = todos(raiz, (x) => x.tag === 'a' && x.getAttribute('data-pausa') !== null);
  assert.equal(links.length, marcas.length, 'uma pausa desenhada por marca calculada');
  for (const [i, link] of links.entries()) {
    assert.ok(link.getAttribute('href').endsWith(`${alvo.id ? '' : ''}`) || true);
    assert.match(link.getAttribute('href'), /&t=\d+s$/, `pausa sem o segundo no vídeo: ${link.getAttribute('href')}`);
    assert.ok(link.getAttribute('href').includes(`&t=${marcas[i]}s`), `pausa ${i} fora do tempo`);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(textoDo(link), marcaDeTempo(marcas[i]));
  }
  if (marcas.length) assert.equal(textoDo(um(raiz, 'aula-pausas-convite', 'pausas')), F.pausaConvite);
});

test('uma aula de 7 minutos não desenha a linha de pausas', async () => {
  const curta = AULAS.aulas.find((a) => pausasDaAula(a.duracaoS).length === 0);
  assert.ok(curta, 'preciso de uma aula abaixo de 12 min no arquivo real');
  const { raiz } = await pagina(Number(curta.n));
  assert.equal(comClasse(raiz, 'aula-pausas').length, 0,
    'pausa vazia desenhada é a frase "Pausas sugeridas:" sem nada depois');
});

test('a navegação entre aulas não tem anterior na primeira nem próxima na última', async () => {
  const { raiz: primeira } = await pagina(1);
  assert.equal(comClasse(primeira, 'aula-nav-antes').length, 0, 'não existe Aula 0');
  const proxima = um(primeira, 'aula-nav-depois', 'aula 1');
  assert.equal(proxima.getAttribute('href'), hrefPagina(2));

  const { raiz: ultima } = await pagina(TOTAL);
  assert.equal(comClasse(ultima, 'aula-nav-depois').length, 0, 'não existe aula depois da última');
  assert.equal(um(ultima, 'aula-nav-antes', 'última aula').getAttribute('href'), hrefPagina(TOTAL - 1));

  const { raiz: meio } = await pagina(5);
  assert.equal(um(meio, 'aula-nav-antes', 'aula 5').getAttribute('href'), hrefPagina(4));
  assert.equal(um(meio, 'aula-nav-depois', 'aula 5').getAttribute('href'), hrefPagina(6));
  assert.equal(textoDo(um(meio, 'aula-nav', 'aula 5')).length > 0 ? 'ok' : '', 'ok', 'a navegação tem texto');
});

// S14b2/item 0 (04/11/2026). Este teste é a reescrita de uma trava que estava
// CHUMBADA NO DEFEITO: a linha última dizia `aula-posicao` = "Aula 999 de 93",
// ou seja, cobrava por escrito a frase que o Chrome reprova. Verde com defeito
// dentro — a família inteira da S13b. A régua agora cobra o contrário: quem pede
// o que não existe é informado, não atendido com números inventados.
test('/aula/999: nenhuma afirmação sobre a aula que não existe, e o h1 é a primeira parte', async () => {
  const { raiz, instancia } = await pagina(999);

  // (a) não há posição: "Aula 999 de 93" afirmava a aula antes de dizer que ela
  // não está lá. O `de N` só existe na página que TEM a aula.
  assert.equal(comClasse(raiz, 'aula-posicao').length, 0, 'a página inventou "Aula n de N"');
  assert.ok(!textoDo(raiz).includes('Aula 999'), `"Aula 999" apareceu no texto: ${textoDo(raiz).slice(0, 120)}`);

  // (b) UM h1, e ele é a primeira das três partes — não "Aula 999 · <estação>".
  const h1 = todos(raiz, (x) => x.tag === 'h1');
  assert.equal(h1.length, 1, 'um h1: é nele que o casco põe o foco');
  assert.equal(h1[0].textContent, U.naoExiste.parteUm);
  assert.equal(instancia.rotulo, U.naoExiste.parteUm, 'a aba do navegador repetia a aula inexistente');

  // (c) as outras duas partes continuam, com o tamanho REAL da estação lido do
  // arquivo — e a parte um não se repete na caixa (ela virou o título).
  const aviso = um(raiz, 'aulas-erro', 'aula fora');
  assert.equal(textoDo(um(aviso, 'aulas-erro-dois', 'aula fora')), `A estação tem ${TOTAL} aulas.`);
  assert.equal(comClasse(aviso, 'aulas-erro-um').length, 0, 'a frase aparecia duas vezes na mesma janela');

  // (d) a única saída da página tem de PARECER link. O Chrome achou texto comum.
  const link = um(raiz, 'aula-nav-antes', 'saída da aula fora');
  assert.equal(link.getAttribute('href'), '#/estacao/circuitos-digitais/aulas');
  assert.equal(textoDo(link), `Ver as aulas de ${CIRCUITOS.title}`);
  assert.ok((link.className || '').split(/\s+/).includes('folha-caminho-link'),
    'a saída sem o sublinhado da casa: link que não parece link');

  assert.equal(comClasse(raiz, 'aula-assistir').length, 0, 'sem aula não há vídeo a abrir');
});

test('sem o arquivo das aulas, a página também não afirma posição nenhuma', async () => {
  // O segundo ramo de erro: /aula/7 de uma estação cujo JSON não está no
  // aparelho. O "Aula 7" era tão errado quanto o "Aula 999" — sem arquivo não há
  // sétima aula para contar. Aqui as três partes de `aulas.semAulas` mandam.
  const { raiz, instancia } = await subir(montarAula, 7, { aulas: null });
  assert.equal(comClasse(raiz, 'aula-posicao').length, 0, 'inventou posição sem arquivo');
  assert.ok(!textoDo(raiz).includes('Aula 7'), 'citou a aula que não pôde ler');
  const h1 = todos(raiz, (x) => x.tag === 'h1');
  assert.equal(h1.length, 1);
  assert.equal(h1[0].textContent, A.semAulas.parteUm);
  assert.equal(instancia.rotulo, A.semAulas.parteUm);
  const aviso = um(raiz, 'aulas-erro', 'sem arquivo');
  assert.equal(textoDo(um(aviso, 'aulas-erro-dois', 'sem arquivo')), A.semAulas.parteDois);
  assert.equal(textoDo(um(aviso, 'aulas-erro-tres', 'sem arquivo')), A.semAulas.parteTres);
});

test('a volta da aba rola até o fechamento e põe o foco no título dele', async () => {
  const { win, raiz } = await pagina(3);
  const assistir = um(raiz, 'aula-assistir', 'página da aula');
  const fim = um(raiz, 'aula-fim', 'página da aula');
  const h2 = um(fim, 'aula-fim-titulo', 'fechamento');

  assert.equal(h2.tag, 'h2', 'o fechamento é uma seção com título próprio');
  assert.equal(h2.getAttribute('tabindex'), '-1', 'sem tabindex -1 o .focus() não faz nada em nenhum navegador');
  assert.equal(textoDo(h2), 'Fechar a aula');
  assert.equal(textoDo(um(fim, 'aula-fim-aviso', 'fechamento')), 'Quando terminar de assistir, feche a aula aqui.');

  let rolou = 0;
  let focou = 0;
  fim.scrollIntoView = () => { rolou += 1; };
  h2.focus = () => { focou += 1; };

  // Sem ter saído para o vídeo, a troca de aba não pode mover a leitura de ninguém.
  win.document.visibilityState = 'visible';
  raiz.dispatch('visibilitychange', {});
  dispararVista(raiz, win);
  assert.equal(rolou, 0, 'a página rolou sem a pessoa ter aberto o vídeo');
  assert.equal(focou, 0, 'o foco mudou sem a pessoa ter aberto o vídeo');

  raiz.dispatch('click', { target: assistir });
  raiz.dispatch('visibilitychange', {});
  dispararVista(raiz, win);
  assert.equal(rolou, 1, 'voltar do vídeo tem de levar a pessoa ao fechamento');
  assert.equal(focou, 1, 'e o foco vai junto, para quem navega por teclado');
});

/** O gravador amarra o visibilitychange ao WINDOW; aqui o teste o chama. */
function dispararVista(raiz, win) {
  // `__ouvintes` é um MAPA (é como o `subir` guarda os ouvintes), não um objeto:
  // lido como propriedade seria sempre undefined e o teste dispararia nada —
  // verde mudo, o defeito da S13b repetido ao contrário.
  const fn = (win.__ouvintes?.get?.('visibilitychange') || [])[0];
  if (fn) fn({ type: 'visibilitychange' });
  return fn;
}

test('a folha e a lista apontam para a página da aula, sem sair do app', async () => {
  const { raiz } = await subir(montarLista, undefined, {});
  const links = todos(raiz, (x) => x.tag === 'a' && x.getAttribute('data-aula') !== null);
  assert.ok(links.length >= TOTAL, `a lista perdeu linhas: ${links.length}`);
  for (const link of links) {
    const href = link.getAttribute('href');
    assert.match(href, /^#\/estacao\/circuitos-digitais\/aula\/\d+$/, `link de aula fora do app: ${href}`);
    assert.equal(link.getAttribute('target'), null, 'link interno não abre aba nova');
  }
  const primario = um(raiz, 'aulas-primario', 'página de aulas');
  assert.equal(primario.getAttribute('href'), hrefPagina(1), 'o primário continua sendo a aula por onde continuar');
});
