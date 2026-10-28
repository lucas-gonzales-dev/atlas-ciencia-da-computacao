// Projeto Atlas — o NOME da fonte na tela (achado de 27/10/2026).
//
// O defeito: a tela dizia "Universidade Livre Brasileira". A fonte se
// autodenomina "Universidade Brasileira Livre" — e quem decide o nome de uma
// instituiçao é ela, não quem a transcreve. O erro estava em 5 lugares
// (gerador do catálogo, subtítulo da tela, meta description, manifest e o
// catalog.json já gerado) porque NENHUM teste comparava o nome com a fonte:
// os 149 testes conferiam contagem, ordem, pré-requisito e honestidade — nunca
// a grafia de um nome próprio. Um nome trocado passa em todos eles.
//
// Este teste compara com a fonte DE VERDADE quando o clone oficial está
// alcançável, e cai para a citação do copyright transcrita em CREDITS.md quando
// não está (outra máquina, CI sem o clone). A queda é declarada na mensagem,
// nunca silenciosa: um teste que só confere o repo contra si mesmo provaria
// menos, e dizer isso faz parte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NOME_CERTO = 'Universidade Brasileira Livre';
const NOME_ERRADO = 'Universidade Livre Brasileira';

const raizDoApp = fileURLToPath(new URL('..', import.meta.url));
const raizDoRepo = fileURLToPath(new URL('../..', import.meta.url));

/** Clone oficial da UBL, se estiver alcançável a partir daqui. */
function candidatosDaFonte() {
  return [
    fileURLToPath(new URL('../../../atlas-planning-kit/source', import.meta.url)),
    fileURLToPath(new URL('../../source', import.meta.url))
  ].filter((p) => existsSync(p));
}

function copyrightDaFonte() {
  for (const dir of candidatosDaFonte()) {
    for (const arquivo of ['LICENSE', 'README.md']) {
      const caminho = `${dir}${dir.endsWith('/') ? '' : '/'}${arquivo}`;
      if (!existsSync(caminho)) continue;
      const texto = readFileSync(caminho, 'utf8');
      const linha = texto.split(/\r?\n/).find((l) => /Copyright \(c\)/i.test(l));
      if (linha) return { origem: `${caminho}`, linha: linha.trim() };
    }
  }
  // Sem clone: CREDITS.md cita o aviso de copyright do LICENSE no SHA auditado.
  const credits = readFileSync(`${raizDoRepo}CREDITS.md`, 'utf8');
  const citado = credits.split(/\r?\n/).find((l) => /Copyright \(c\)/i.test(l));
  assert.ok(citado, 'CREDITS.md perdeu a citação do copyright da fonte');
  return { origem: 'CREDITS.md (citação do LICENSE no SHA auditado)', linha: citado.trim(), indireto: true };
}

test('a fonte se autodenomina Universidade Brasileira Livre, e o repo conhece esse nome', () => {
  const { linha, origem } = copyrightDaFonte();
  assert.ok(
    linha.includes(NOME_CERTO),
    `o copyright da fonte (${origem}) não traz "${NOME_CERTO}": ${linha}`
  );
  assert.ok(
    !linha.includes(NOME_ERRADO),
    `a fonte (${origem}) usa outra grafia do que este teste assume: ${linha}`
  );
});

test('o catálogo gerado diz o nome da fonte como a fonte o escreve', () => {
  const catalogo = JSON.parse(readFileSync(`${raizDoApp}data/catalog.json`, 'utf8'));
  const frases = [catalogo.origem, catalogo.origemEletivas, catalogo.origemEspecializacoes]
    .filter((s) => typeof s === 'string' && s.length);

  assert.ok(frases.length >= 2, 'as frases de proveniência sumiram do catálogo');
  for (const f of frases) {
    if (!/Universidade/.test(f)) continue; // especializações falam de si, não da fonte
    assert.ok(f.includes(NOME_CERTO), `proveniência com nome errado: ${f}`);
  }
});

test('a grafia errada não sobrevive em nenhum arquivo que vai para a tela', () => {
  // Arquivos que produzem texto visível (tela, metadados, PWA) ou o dado que a
  // alimenta. Fora da lista ficam docs históricos e testes — inclusive este,
  // que precisa nomear o erro para pegá-lo.
  const alvos = [
    'app/core/catalog.js',
    'app/web/main.js',
    'app/web/boot.js',
    'app/index.html',
    'app/manifest.webmanifest',
    'app/data/catalog.json',
    'README.md'
  ];
  const errados = [];
  for (const relativo of alvos) {
    const caminho = `${raizDoRepo}${relativo}`;
    if (!existsSync(caminho)) continue;
    const texto = readFileSync(caminho, 'utf8');
    // O comentário de catalog.js explica o erro citando-o — tolerância só para
    // linha de comentário, porque ali é documentação do conserto, não tela.
    const linhas = texto.split(/\r?\n/).filter((l) => l.includes(NOME_ERRADO));
    const vivas = linhas.filter((l) => !/^\s*(\/\/|\*|<!--|#)/.test(l));
    if (vivas.length) errados.push(`${relativo}: ${vivas.length} ocorrência(s) fora de comentário`);
  }
  assert.deepEqual(errados, [], `nome trocado ainda visível ao aluno — ${errados.join(' | ')}`);
});
