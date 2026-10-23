// Projeto Atlas — teste E2E: o navegador pede por HTTP e recebe a trilha REAL.
//
// Por que isto existe separado: os outros testes provam que a REGRA funciona.
// Este prova que a ENTREGA funciona — servidor no ar, arquivo servido, e a tela
// recebendo as 35 disciplinas auditadas em vez do catalogo minimo de brinquedo.
// Sem isto, "funciona na minha maquina" e so uma frase.
//
// Porta sorteada (nunca fixa): porta fixa colide com o que ja estiver rodando.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';

const PORT = 20000 + Math.floor(Math.random() * 40000);
process.env.PORT = String(PORT);

// serve.js NAO escuta mais ao ser importado (isso travava a suite para sempre).
// O teste sobe na porta que escolheu e derruba no fim, conexoes keep-alive incluidas.
const { start, stop } = await import('../serve.js');
await start(PORT);
after(stop);

const BASE = `http://127.0.0.1:${PORT}`;

test('o servidor sobe e responde na porta sorteada', async () => {
  const r = await fetch(`${BASE}/`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Projeto Atlas/);
});

test('GET /data/catalog.json devolve a trilha REAL da UBL, nao o catalogo minimo', async () => {
  const r = await fetch(`${BASE}/data/catalog.json`, { cache: 'no-store' });
  assert.equal(r.status, 200, 'data/catalog.json precisa existir e ser servido');
  assert.match(r.headers.get('content-type') || '', /json/);

  const json = await r.json();
  assert.ok(Array.isArray(json.courses), 'catalogo sem lista de courses');
  assert.equal(json.courses.length, 35, 'a grade obrigatoria da UBL tem 35 disciplinas');

  const ids = json.courses.map((c) => c.id);
  assert.ok(ids.includes('ubl-core-inteligencia-artificial'), 'faltando disciplina real do seed');
  assert.ok(!ids.includes('logica'), 'o catalogo minimo de brinquedo ainda esta sendo servido');
});

test('o catalogo servido diz de onde veio (proveniencia visivel na tela)', async () => {
  const json = await (await fetch(`${BASE}/data/catalog.json`, { cache: 'no-store' })).json();
  assert.ok(typeof json.origem === 'string' && json.origem.length > 0);
  assert.match(json.origem, /Universidade-Livre|ubl-core-seed/);
});

test('o catalogo servido tem a forma que a tela e o nucleo esperam', async () => {
  const { courses } = await (await fetch(`${BASE}/data/catalog.json`, { cache: 'no-store' })).json();
  for (const c of courses) {
    assert.equal(typeof c.id, 'string');
    assert.equal(typeof c.title, 'string');
    assert.ok(Number.isInteger(c.stage));
    assert.ok(Array.isArray(c.prerequisites));
  }
});

test('a regra de desbloqueio funciona sobre o dado REAL servido, nao so sobre fixture', async () => {
  // Este e o teste que amarra as duas pontas: HTTP -> dados reais -> nucleo.
  const { unlockedCourses } = await import('../core/progress.js');
  const { courses } = await (await fetch(`${BASE}/data/catalog.json`, { cache: 'no-store' })).json();

  const inicio = unlockedCourses(courses, []);
  assert.ok(inicio.length > 0, 'com nada concluido, alguma disciplina tem de estar aberta');
  assert.ok(inicio.includes('ubl-core-circuitos-digitais'), 'Circuitos Digitais nao tem pre-requisito: nasce aberta');
  assert.ok(!inicio.includes('ubl-core-calculo-ii'), 'Calculo II depende de Calculo I: tem de nascer trancada');

  // Conclui Geometria Analitica -> Calculo I abre.
  const depois = unlockedCourses(courses, ['ubl-core-geometria-analitica']);
  assert.ok(depois.includes('ubl-core-calculo-i'), 'concluir Geometria tem de abrir Calculo I');
  assert.ok(depois.includes('ubl-core-algebra-linear-i'), 'e Algebra Linear I, que tem o mesmo pre-requisito');
});

// fetch NAO serve para testar traversal: o cliente colapsa "/../" antes de
// enviar e o servidor nunca ve o ataque. Vai por http.request com path cru.
function get(pathCru) {
  return new Promise((ok, falhou) => {
    const r = request({ host: '127.0.0.1', port: PORT, path: pathCru, method: 'GET' }, (res) => {
      const pedacos = [];
      res.on('data', (p) => pedacos.push(p));
      res.on('end', () => ok({ status: res.statusCode, corpo: Buffer.concat(pedacos).toString('utf8') }));
    });
    r.on('error', falhou);
    r.end();
  });
}

test('o servidor recusa traversal mandado com path cru', async () => {
  for (const p of ['/../package.json', '/..%2fpackage.json', '/a/../../etc/passwd', '/..']) {
    const r = await get(p);
    assert.equal(r.status, 403, `${p} devia vir 403, veio ${r.status}`);
  }
});

test('um caminho normal continua servindo (a trava nao quebrou o uso legitimo)', async () => {
  const r = await get('/data/catalog.json');
  assert.equal(r.status, 200);
  assert.match(r.corpo, /ubl-core-inteligencia-artificial/);
});
