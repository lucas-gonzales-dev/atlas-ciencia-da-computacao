// Projeto Atlas — a tela EXPLORAR: a rede inteira (S7, 01/11/2026).
//
// POR QUE EXISTE: a S3a-2 emprestou a grade antiga para dentro do casco; a S7
// devolve o emprestimo. A Explorar deixa de ser `boot.montarGrade` (o desenho
// que nasceu como pagina inteira em 2026) e vira uma tela que responde, na
// ordem em que quem chega as faz, tres perguntas: onde estou, o que esta
// estacao pede, o que ela abre.
//
// SUBSTITUICAO (avisada no turno): este arquivo existia desde a S3a-2a com 39
// linhas e era so uma casca que chamava montarGrade. O git guarda o anterior.
//
// REGRA DA CASA: a regra de filtrar mora em core/filtro.js, que chama
// core/search.js — "use a regra que ja existe; nao escreva outra". Aqui so ha
// DOM: montar, pintar, ouvir. Se aparecer um `if` de pre-requisito, esta errado.
//
// ENDERECO E ESTADO (S7-1a): a busca e a linha vivem no hash. Cada tecla faz
// history.replaceState — o endereco compartilhavel, nao o historico. Voltar de
// uma estacao devolve a mesma busca porque o estado estava no endereco.
import { estadoDaLista, linhasDoCatalogo } from '../../core/filtro.js';
import { hrefDe, lerRota } from '../../core/rotas.js';
import { comValores, estados, explorar } from '../../core/textos.js';

const CLASSE = 'explorar';
const VAZIO = estados.buscaSemResultado;

function el(doc, classe, texto) {
  const no = doc.createElement('div');
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function h2(doc, classe, texto) {
  const no = doc.createElement('h2');
  no.className = classe;
  no.textContent = texto;
  return no;
}

/** Carregando: 5 linhas cinza paradas; o atraso de 150 ms mora no CSS. */
function esqueleto(doc) {
  const box = el(doc, `${CLASSE}-carregando`);
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i += 1) box.append(el(doc, `${CLASSE}-esqueleto`));
  return box;
}

/** Uma estacao: link para a folha dela + o que ela pede, dito por palavra. */
function itemEstacao(doc, course, catalogo) {
  const li = doc.createElement('li');
  li.className = `${CLASSE}-item`;
  li.dataset.estado = 'aberta';

  const a = doc.createElement('a');
  a.className = `${CLASSE}-link`;
  a.href = hrefDe({ tela: 'estacao', slug: course.slug ?? course.id });
  a.textContent = course.title ?? course.id;
  li.append(a);

  const nomes = (course.prerequisites || [])
    .map((id) => catalogo.courses.find((c) => c.id === id)?.title ?? id);
  if (nomes.length) {
    li.dataset.estado = 'trancada';
    li.append(el(doc, `${CLASSE}-selo ${CLASSE}-selo-trancada`, explorar.selo.trancada));
    li.append(el(doc, `${CLASSE}-falta`, explorar.falta(nomes.join(', '))));
  }
  return li;
}

function listaDe(doc, catalogo, cursos, classeExtra) {
  const ul = doc.createElement('ul');
  ul.className = `${CLASSE}-lista${classeExtra ? ` ${classeExtra}` : ''}`;
  for (const c of cursos) ul.append(itemEstacao(doc, c, catalogo));
  return ul;
}

/**
 * Monta a Explorar na raiz escolhida pelo casco.
 * @param {Element} raiz contêiner da tela (já dentro de `#conteudo`)
 * @param {{catalogo: Promise<object>}} ctx contexto do casco
 */
export function montar(raiz, ctx) {
  const doc = raiz.ownerDocument || document;
  const t = explorar;

  const cabeca = el(doc, `${CLASSE}-cabeca`);
  const titulo = doc.createElement('h1');
  titulo.className = `${CLASSE}-titulo`;
  titulo.textContent = t.titulo;
  cabeca.append(el(doc, `${CLASSE}-rotulo`, t.rotulo), titulo, el(doc, `${CLASSE}-descricao`, t.descricao));

  const controles = el(doc, `${CLASSE}-controles`);
  const rotuloBusca = doc.createElement('label');
  rotuloBusca.className = `${CLASSE}-rotulo-campo`;
  rotuloBusca.textContent = t.busca.rotulo;
  rotuloBusca.htmlFor = 'busca-explorar';
  const input = doc.createElement('input');
  input.type = 'search';
  input.id = 'busca-explorar';
  input.placeholder = t.busca.placeholder;
  input.autocomplete = 'off';

  const rotuloLinha = doc.createElement('label');
  rotuloLinha.className = `${CLASSE}-rotulo-campo`;
  rotuloLinha.textContent = t.filtro.rotulo;
  rotuloLinha.htmlFor = 'linha-explorar';
  const select = doc.createElement('select');
  select.id = 'linha-explorar';

  const status = doc.createElement('p');
  status.className = `${CLASSE}-status`;
  status.id = 'explorar-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  controles.append(rotuloBusca, input, rotuloLinha, select, status);

  const corpo = el(doc, `${CLASSE}-corpo`);
  corpo.append(esqueleto(doc));

  const rodape = el(doc, `${CLASSE}-rodape`);
  const licenca = el(doc, `${CLASSE}-licenca`, t.rodape);
  // A origem é UMA linha criada aqui e preenchida no pintar(). Criá-la dentro
  // do pintar() somava uma ao DOM a cada tecla (visto na tela com a busca
  // "calculo": a mesma frase, duas vezes). Explorar.search 'origem' abaixo.
  const origem = el(doc, `${CLASSE}-origem`, '');
  rodape.append(licenca, origem);

  raiz.className = `${CLASSE}-raiz`;
  raiz.append(cabeca, controles, corpo, rodape);

  const rotaInicial = typeof location === 'object' ? lerRota(location.hash || '') : {};
  const estado = {
    busca: rotaInicial.tela === 'explorar' && typeof rotaInicial.busca === 'string' ? rotaInicial.busca : '',
    linha: rotaInicial.tela === 'explorar' && Number.isInteger(rotaInicial.linha) ? rotaInicial.linha : null,
    catalogo: null,
  };
  let montado = true;
  input.value = estado.busca;

  function escreverEndereco() {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    const href = hrefDe({
      tela: 'explorar',
      busca: estado.busca || undefined,
      linha: Number.isInteger(estado.linha) ? estado.linha : undefined,
    });
    if (href !== location.hash) history.replaceState(null, '', href);
  }

  function contar(n) {
    if (n === 0) return t.status.nenhuma;
    if (n === 1) return t.status.uma;
    return t.status.muitas(n);
  }

  function ramais(cat, r) {
    const secao = el(doc, `${CLASSE}-secao`);
    secao.append(h2(doc, `${CLASSE}-grupo-titulo`, t.grupos.ramais));
    const lista = r.buscaAtiva ? r.ramais : (cat.specializations || []);
    if (!lista.length) {
      secao.append(el(doc, `${CLASSE}-vazio-texto`, t.status.nenhuma));
      return secao;
    }
    const ul = doc.createElement('ul');
    ul.className = `${CLASSE}-lista ${CLASSE}-lista-ramais`;
    for (const ramal of lista) {
      const li = doc.createElement('li');
      li.className = `${CLASSE}-item`;
      li.append(el(doc, `${CLASSE}-nome`, ramal.title ?? ramal.id));
      const naoPublicado = ramal.status === 'under_construction'
        || !Array.isArray(ramal.courses) || ramal.courses.length === 0;
      if (naoPublicado) {
        li.append(el(doc, `${CLASSE}-selo ${CLASSE}-selo-obras`, t.selo.emObras));
        li.append(el(doc, `${CLASSE}-falta`, comValores.ramalEmObras(ramal.title ?? ramal.id)));
      }
      ul.append(li);
    }
    secao.append(ul);
    return secao;
  }

  function eletivas(cat, r) {
    const secao = el(doc, `${CLASSE}-secao`);
    secao.append(h2(doc, `${CLASSE}-grupo-titulo`, t.grupos.eletivas));
    const lista = r.buscaAtiva ? r.eletivas : (cat.electives || []);
    if (!lista.length) {
      secao.append(el(doc, `${CLASSE}-vazio-texto`, t.status.nenhuma));
      return secao;
    }
    const ul = doc.createElement('ul');
    ul.className = `${CLASSE}-lista ${CLASSE}-lista-eletivas`;
    for (const e of lista) {
      const li = doc.createElement('li');
      li.className = `${CLASSE}-item`;
      li.append(el(doc, `${CLASSE}-nome`, e.title ?? e.id));
      ul.append(li);
    }
    secao.append(ul);
    return secao;
  }

  function pintar() {
    if (!montado) return;
    corpo.textContent = '';
    if (!estado.catalogo) {
      corpo.append(esqueleto(doc));
      return;
    }
    const cat = estado.catalogo;
    const r = estadoDaLista({
      courses: cat.courses,
      electives: cat.electives,
      specializations: cat.specializations,
      busca: estado.busca,
      linha: estado.linha,
    });

    status.textContent = contar(r.estacoes.length);
    // Escreve na linha que já existe no rodapé; nunca anexa outra.
    origem.textContent = cat.origem || '';

    if (r.semResultado) {
      const vazio = el(doc, `${CLASSE}-vazio`);
      vazio.append(
        h2(doc, `${CLASSE}-vazio-titulo`, VAZIO.titulo),
        el(doc, `${CLASSE}-vazio-texto`, VAZIO.descricao),
      );
      const botao = doc.createElement('button');
      botao.type = 'button';
      botao.className = `${CLASSE}-limpar`;
      botao.textContent = VAZIO.acao;
      botao.addEventListener('click', limpar);
      vazio.append(botao);
      corpo.append(vazio);
      return;
    }

    const semRecorte = !r.buscaAtiva && !Number.isInteger(estado.linha);
    const resultado = el(doc, `${CLASSE}-resultado`);
    if (r.estacoes.length) {
      if (semRecorte) {
        // As 7 linhas em sequencia, cada uma com seu h2 na cor da linha.
        for (const n of linhasDoCatalogo(cat.courses)) {
          const grupo = el(doc, `${CLASSE}-grupo ${CLASSE}-grupo-linha-${n}`);
          grupo.append(h2(doc, `${CLASSE}-grupo-titulo`, t.grupos.linha(n)));
          grupo.append(listaDe(doc, cat, r.estacoes.filter((c) => c.stage === n)));
          resultado.append(grupo);
        }
        const semLinha = r.estacoes.filter((c) => !Number.isInteger(c.stage) || c.stage <= 0);
        if (semLinha.length) {
          const grupo = el(doc, `${CLASSE}-grupo`);
          grupo.append(h2(doc, `${CLASSE}-grupo-titulo`, t.grupos.semLinha));
          grupo.append(listaDe(doc, cat, semLinha));
          resultado.append(grupo);
        }
      } else {
        // Com busca ou filtro, uma lista so.
        resultado.append(listaDe(doc, cat, r.estacoes));
      }
    } else {
      resultado.append(el(doc, `${CLASSE}-vazio-texto`, t.status.nenhuma));
    }
    resultado.append(ramais(cat, r), eletivas(cat, r));
    corpo.append(resultado);
  }

  function limpar() {
    estado.busca = '';
    estado.linha = null;
    input.value = '';
    select.value = '';
    escreverEndereco();
    pintar();
    if (typeof input.focus === 'function') input.focus();
  }

  function preencherLinhas(cat) {
    select.textContent = '';
    const todas = doc.createElement('option');
    todas.value = '';
    todas.textContent = t.filtro.todas;
    select.append(todas);
    for (const n of linhasDoCatalogo(cat.courses)) {
      const o = doc.createElement('option');
      o.value = String(n);
      o.textContent = t.filtro.linha(n);
      select.append(o);
    }
    select.value = Number.isInteger(estado.linha) ? String(estado.linha) : '';
  }

  input.addEventListener('input', () => {
    estado.busca = input.value;
    escreverEndereco();
    pintar();
  });

  select.addEventListener('change', () => {
    const n = Number.parseInt(select.value, 10);
    estado.linha = Number.isInteger(n) ? n : null;
    escreverEndereco();
    pintar();
  });

  Promise.resolve(ctx.catalogo)
    .then((catalogo) => {
      if (!montado) return;
      estado.catalogo = catalogo;
      if (!linhasDoCatalogo(catalogo.courses).includes(estado.linha)) estado.linha = null;
      preencherLinhas(catalogo);
      escreverEndereco();
      pintar();
    })
    .catch(() => {
      if (!montado) return;
      corpo.textContent = '';
      corpo.append(el(doc, `${CLASSE}-vazio-texto`, estados.offline.descricao));
    });

  return { desmontar() { montado = false; } };
}
