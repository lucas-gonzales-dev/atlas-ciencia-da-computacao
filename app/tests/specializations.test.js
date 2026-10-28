// Projeto Atlas — testes das ESPECIALIZACOES (item 2 da entrega de 24/10/2026).
//
// A regra que este arquivo existe para defender e uma so: a tela NAO PROMETE o
// que a fonte nao tem. A fonte (UBL, auditada em b995c11) anuncia 7
// especializacoes no indice do README; 6 tem pagina de recursos transcrita (75
// linhas), 1 (Design de Algoritmos) e anunciada sem pagina. Alem disso, 2
// existem na arvore mas NAO estao linkadas no indice (DBA e Mobile) e o overlay
// as marca "under_construction" com a decisao
// include_as_under_construction_not_reachable.
//
// Portanto: quem nao tem recurso aparece como "aguardando conteudo", com motivo
// escrito e, quando a fonte conhece a pagina, com o link da FONTE. Link
// inventado, trilha bonita e vazia ou "disponibilidade verificada" onde a fonte
// diz not_checked fazem este teste falhar.
//
// Stub de DOM igual ao de electives.test.js e render.test.js: jsdom nao e o
// caminho nesta maquina (npm existe mas e .cmd), e 30 linhas de stub custam
// menos que um falso verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toSpecializations } from '../core/catalog.js';
import { render } from '../web/main.js';

function criarNo(tag) {
  const no = {
    tag,
    children: [],
    attrs: {},
    className: '',
    textContent: '',
    setAttribute(k, v) { this.attrs[k] = v; },
    append(...ns) { this.children.push(...ns); },
    addEventListener() {}
  };
  for (const p of ['href', 'rel', 'target']) {
    Object.defineProperty(no, p, {
      configurable: true,
      get() { return this.attrs[p]; },
      set(v) { this.attrs[p] = String(v); }
    });
  }
  return no;
}
globalThis.document = { createElement: criarNo };

function achar(no, tag, saida = []) {
  if (!no) return saida;
  if (no.tag === tag) saida.push(no);
  for (const filho of no.children || []) achar(filho, tag, saida);
  return saida;
}

function comClasse(no, classe, saida = []) {
  if (!no) return saida;
  const c = typeof no.className === 'string' ? no.className : (no.attrs.class || '');
  if (c.split(/\s+/).includes(classe)) saida.push(no);
  for (const filho of no.children || []) comClasse(filho, classe, saida);
  return saida;
}

function textoDe(no) {
  if (!no) return '';
  return (no.textContent || '') + (no.children || []).map(textoDe).join(' ');
}

function ler(nome) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${nome}`, import.meta.url)), 'utf8'));
}

const SEED = ler('specializations-seed.json');
const RECURSOS = ler('specialization-resources-seed.json');
const OVERLAY = ler('specializations-unindexed-overlay.json');
const CATALOGO = ler('catalog.json');
const DERIVADO = toSpecializations(SEED, RECURSOS, OVERLAY);

// Numeros contados da fonte, nao do meu codigo — se o gerador mudar de ideia,
// estes falham primeiro.
const POR_SLUG = {};
for (const r of RECURSOS.resources) {
  POR_SLUG[r.specializationSlug] = (POR_SLUG[r.specializationSlug] || 0) + 1;
}
const IDS_INDEXADAS = SEED.specializations.map((s) => s.id);
const IDS_NAO_INDEXADAS = OVERLAY.unindexedSpecializations.map((s) => s.id);

test('derivacao: 7 indexadas + 2 nao indexadas = 9, sem duplicar id', () => {
  assert.equal(DERIVADO.specializations.length, 9);
  assert.equal(new Set(DERIVADO.specializations.map((s) => s.id)).size, 9);
  for (const id of [...IDS_INDEXADAS, ...IDS_NAO_INDEXADAS]) {
    assert.ok(DERIVADO.specializations.some((s) => s.id === id), `faltou ${id}`);
  }
});

test('derivacao: os 75 recursos da fonte chegam inteiros e no lugar certo', () => {
  const total = DERIVADO.specializations.reduce((n, s) => n + s.resources.length, 0);
  assert.equal(total, 75);
  assert.equal(total, RECURSOS.resources.length);
  for (const s of DERIVADO.specializations) {
    assert.equal(
      s.resources.length,
      POR_SLUG[s.slug] || 0,
      `${s.slug}: contagem de recursos diverge da fonte`
    );
  }
  // Campos que o aluno usa para decidir: titulo, url, duracao, dedicacao.
  const pixar = DERIVADO.specializations
    .find((s) => s.slug === 'computer-graphics').resources[0];
  assert.equal(pixar.title, 'Pixar in a Box');
  assert.match(pixar.url, /^https:\/\//);
  assert.equal(pixar.duration, '2 Semanas');
  assert.equal(pixar.dedication, '3 horas/semana');
});

test('honestidade: 3 aguardando conteudo, e sao exatamente as 3 sem recurso', () => {
  const aguardando = DERIVADO.specializations.filter((s) => s.aguardandoConteudo);
  assert.deepEqual(aguardando.map((s) => s.id).sort(), [
    'ubl-specialization-algorithm-design',
    'ubl-specialization-database-administration',
    'ubl-specialization-mobile-development'
  ].sort());
  for (const s of aguardando) {
    assert.deepEqual(s.resources, [], `${s.id} aguardando nao pode ter recurso`);
    assert.ok(
      typeof s.motivoAguardando === 'string' && s.motivoAguardando.length > 20,
      `${s.id} sem motivo escrito`
    );
  }
  assert.equal(DERIVADO.aguardando, 3);
  assert.match(DERIVADO.origem, /9 especializações/);
  assert.match(DERIVADO.origem, /6 com recursos indexados/);
  assert.match(DERIVADO.origem, /3 aguardando conteúdo/);
});

test('honestidade: alcançavel pelo indice e fato da fonte, nao enfeite meu', () => {
  // Design de Algoritmos ESTA no indice (anunciada) — so nao tem pagina.
  // DBA e Mobile NAO estao no indice. A tela precisa manter essa diferenca,
  // porque ela muda o que o aluno pode esperar.
  const porId = new Map(DERIVADO.specializations.map((s) => [s.id, s]));
  assert.equal(porId.get('ubl-specialization-algorithm-design').reachableFromIndex, true);
  assert.equal(porId.get('ubl-specialization-algorithm-design').status, 'announced_no_detailed_page');
  for (const id of IDS_NAO_INDEXADAS) {
    assert.equal(porId.get(id).reachableFromIndex, false, `${id} deveria vir do overlay`);
    assert.equal(porId.get(id).status, 'under_construction');
  }
  for (const id of IDS_INDEXADAS) {
    assert.equal(porId.get(id).reachableFromIndex, true);
  }
});

test('honestidade: nenhum link inventado, e disponibilidade segue not_checked', () => {
  for (const s of DERIVADO.specializations) {
    if (s.sourceUrl !== null) assert.match(s.sourceUrl, /^https?:\/\//, `${s.id} com URL falsa`);
    for (const r of s.resources) {
      assert.ok(r.url === null || /^https?:\/\//.test(r.url), `${r.id}: URL inventada`);
      // A fonte diz que NAO conferiu se o link esta no ar. Se o produto
      // afirmasse o contrario, link morto viraria culpa do aluno.
      assert.equal(r.availability, 'not_checked', `${r.id}: disponibilidade alterada`);
    }
  }
  // As 6 com pagina tem URL real; as 3 sem pagina nao ganham URL de template.
  const comPagina = DERIVADO.specializations.filter((s) => s.sourceUrl !== null);
  assert.equal(comPagina.length, 6);
  const semPagina = DERIVADO.specializations.filter((s) => s.sourceUrl === null);
  assert.deepEqual(semPagina.map((s) => s.id).sort(), [
    'ubl-specialization-algorithm-design',
    'ubl-specialization-database-administration',
    'ubl-specialization-mobile-development'
  ].sort());
});

test('catalog.json esta em sincronia com a derivacao dos seeds', () => {
  assert.deepEqual(CATALOGO.specializations, DERIVADO.specializations);
  assert.equal(CATALOGO.origemEspecializacoes, DERIVADO.origem);
  // O gerador escreve os caminhos como aparecem no repositorio (app/data/...),
  // igual ao que ja faz para a grade e para as eletivas. Conferir o prefixo aqui
  // e o que impede alguem de "simplificar" e quebrar a rastreabilidade.
  assert.deepEqual(CATALOGO.geradoDeEspecializacoes, [
    'app/data/specializations-seed.json',
    'app/data/specialization-resources-seed.json',
    'app/data/specializations-unindexed-overlay.json'
  ]);
});

function desenhar(specializations, origemEspecializacoes) {
  const root = criarNo('div');
  render(root, {
    courses: CATALOGO.courses,
    completed: [],
    origem: CATALOGO.origem,
    electives: CATALOGO.electives,
    origemEletivas: CATALOGO.origemEletivas,
    specializations,
    origemEspecializacoes
  });
  return root;
}

test('tela: secao propria, entre a trilha e as eletivas, com a origem dos dados', () => {
  const root = desenhar(DERIVADO.specializations, DERIVADO.origem);
  const secoes = achar(root, 'section');
  const nomes = secoes.map((s) => s.className);
  const iEsp = nomes.findIndex((c) => c.includes('especializacoes'));
  const iElet = nomes.findIndex((c) => c.includes('eletivas'));
  assert.ok(iEsp >= 0, 'secao de especializacoes nao foi desenhada');
  assert.ok(iElet >= 0 && iEsp < iElet, 'especializacoes devem vir antes das eletivas');
  const h2 = comClasse(secoes[iEsp], 'especializacoes').length ? secoes[iEsp] : null;
  assert.match(textoDe(h2), /Especializações/);
  assert.match(textoDe(h2), /9 especializações/, 'a origem dos dados precisa aparecer');
});

test('tela: 9 itens, 3 marcados como aguardando e com o motivo escrito', () => {
  const root = desenhar(DERIVADO.specializations, DERIVADO.origem);
  const itens = comClasse(root, 'esp');
  assert.equal(itens.length, 9);
  const aguardando = comClasse(root, 'aguardando');
  assert.equal(aguardando.length, 3);
  const avisos = comClasse(root, 'aviso-esp');
  assert.equal(avisos.length, 3, 'cada aguardando precisa de aviso proprio');
  const texto = textoDe(root);
  assert.match(texto, /Aguardando conteúdo/);
  assert.match(texto, /em construção/, 'o motivo das nao indexadas precisa dizer em construcao');
  assert.match(texto, /não tem página de recursos indexada/, 'o motivo de Design de Algoritmos');
  // As 6 com recurso mostram quantos recursos sao — numero da fonte, nao meu.
  assert.match(texto, /18 recurso\(s\)/);
  assert.match(texto, /8 recurso\(s\)/);
});

test('tela: link de recurso abre fora do app e nunca vira href vazio', () => {
  const root = desenhar(DERIVADO.specializations, DERIVADO.origem);
  const links = achar(root, 'a');
  assert.ok(links.length >= 75, `so ${links.length} links para 75 recursos`);
  for (const a of links) {
    assert.ok(typeof a.href === 'string' && /^https?:\/\//.test(a.href), `link ruim: ${a.href}`);
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
  }
  const recursos = comClasse(root, 'esp-recursos');
  assert.equal(recursos.length, 6, 'so as 6 com pagina tem lista de recursos');
});

test('tela: recurso sem URL na fonte nao ganha link inventado', () => {
  const sinteticas = [{
    id: 'teste-sem-url',
    slug: 'teste-sem-url',
    title: 'Trilha de Teste',
    status: 'detailed_page_present',
    sourcePath: null,
    sourceUrl: null,
    reachableFromIndex: true,
    aguardandoConteudo: false,
    motivoAguardando: null,
    pageNotes: [],
    resources: [{ id: 'r1', title: 'Apostila sem link', url: null, type: null, duration: null, dedication: null, topics: null, notes: [], availability: 'not_checked' }]
  }];
  const root = desenhar(sinteticas, 'teste');
  // So a SECAO de especializacoes: a grade tem seus proprios links de recurso e
  // conta-los aqui faria o teste passar por acidente ou falhar por engano.
  const secao = comClasse(root, 'especializacoes')[0];
  assert.ok(secao, 'secao de especializacoes nao foi desenhada');
  const links = achar(secao, 'a');
  assert.equal(links.length, 0, 'recurso sem URL nao pode virar link');
  assert.match(textoDe(secao), /sem URL na fonte/);
  assert.match(textoDe(secao), /Apostila sem link/);
});

test('tela: especializacao NAO entra no progresso da grade obrigatoria', () => {
  const sem = desenhar([], '');
  const com = desenhar(DERIVADO.specializations, DERIVADO.origem);

  // A propriedade que importa nao e "a arvore e identica" (nao e: uma secao nova
  // apareceu, e e para isso que ela existe). E que o PROGRESSO nao muda: o
  // contador continua contando so a grade obrigatoria, e o numero de disciplinas
  // com botao de concluir continua o mesmo.
  const contador = (root) => {
    const m = textoDe(root).match(/(\d+)\s*\/\s*(\d+)\s*conclu[íi]das/);
    assert.ok(m, 'contador de progresso nao encontrado na tela');
    return `${m[1]}/${m[2]}`;
  };
  assert.equal(contador(com), contador(sem), 'o contador de progresso mudou por causa das especializacoes');
  assert.equal(contador(com), `0/${CATALOGO.courses.length}`, 'o contador nao esta contando a grade obrigatoria');

  // Botao de concluir: um por disciplina da grade, e NENHUM por especializacao.
  // O id mora no <li class="item"> (main.js le li.dataset.id no clique), nao no
  // botao — entao a propriedade se confere pelo item que CONTÉM o botao.
  const comConcluir = (root) => achar(root, 'li')
    .filter((li) => achar(li, 'button').some((b) => textoDe(b).includes('Concluir')));
  assert.equal(comConcluir(com).length, comConcluir(sem).length, 'numero de itens concluiveis mudou');
  assert.equal(comConcluir(com).length, CATALOGO.courses.length);

  const idsDaGrade = new Set(CATALOGO.courses.map((c) => c.id));
  for (const li of comConcluir(com)) {
    assert.ok(idsDaGrade.has(li.attrs['data-id']), `item concluivel fora da grade: ${li.attrs['data-id']}`);
  }
  // E do outro lado: nenhum item de especializacao ou eletiva ganha botao.
  for (const classe of ['esp', 'eletiva']) {
    for (const li of comClasse(com, classe)) {
      if (li.tag !== 'li') continue;
      assert.equal(
        achar(li, 'button').length,
        0,
        `item .${classe} tem botao: conteudo fora da grade nao pode entrar no progresso`
      );
    }
  }
});
