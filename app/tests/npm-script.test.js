// Projeto Atlas — guarda do script de teste.
//
// MEDIDO em 24/10/2026, e corrige uma crenca minha: `node --test "tests/*.test.js"`
// PASSA nesta maquina (node 24 expande o glob por conta propria; exit 0, 101 testes).
// O que quebrou em 23/10 foi passar a PASTA (`node --test app/tests/`), nao o glob.
// Entao a lista explicita abaixo nao e correcao de bug: e escolha de reprodutibilidade.
//   - roda igual em qualquer cwd e qualquer shell, sem depender de quem expande o padrao;
//   - o comando fica visivel no package.json e no log do CI, arquivo por arquivo;
//   - o node pode mudar a semantica do glob (ou um runner diferente rodar o script)
//     e a lista explicita continua significando a mesma coisa.
//
// O preco da lista explicita e esquecer de adicionar um teste novo: ele fica no
// disco, verde na mao de quem o roda sozinho, e INVISIVEL para `npm test`. Este
// teste cobra esse esquecimento comparando a lista com o que existe em tests/.
// As assercoes contra glob e contra aspas sao POLITICA (determinismo), nao
// relato de falha medida — quem ler isto no futuro merece saber a diferenca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('npm test: a lista do package.json cobre todo arquivo de teste do disco', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const script = pkg.scripts.test;
  assert.match(script, /^node --test\s+/, 'o script precisa chamar o runner do proprio node');

  // As duas coisas que o shell do Windows nao faz por nos.
  assert.ok(!/[*?]/.test(script), `glob no script nao expande no Windows: ${script}`);
  assert.ok(!/["']/.test(script), `aspas no script viram parte do nome do arquivo: ${script}`);

  const listados = script.replace(/^node --test\s+/, '').split(/\s+/).filter(Boolean);
  for (const a of listados) {
    // Relativo a app/, que e o cwd do npm ao rodar script de pacote.
    assert.match(a, /^tests\/[^/]+\.test\.js$/, `caminho fora do padrao relativo: ${a}`);
  }

  const noDisco = (await readdir(new URL('../tests/', import.meta.url)))
    .filter((n) => n.endsWith('.test.js'))
    .map((n) => 'tests/' + n)
    .sort();

  assert.deepEqual(
    [...listados].sort(),
    noDisco,
    'lista de testes desatualizada: teste novo so roda se entrar em app/package.json'
  );
});
