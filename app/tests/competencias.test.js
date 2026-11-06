// Projeto Atlas — as frases de competência (S17): o que o carimbo de "estação
// dominada" diz que a pessoa passou a saber fazer. Feedback que informa
// competência sustenta a motivação; feedback que só premia presença a mina
// (relatório "Experiência de aprendizado do Atlas", seção 3). A frase tem de ser
// verdadeira para aquela estação, curta e no tom da casa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ler = (caminho) => JSON.parse(readFileSync(join(raiz, caminho), 'utf8'));
const CURSOS = ler('data/catalog.json').courses;
const { competencias } = ler('data/competencias.json');

test('competências: uma frase por estação, nenhuma a mais', () => {
  assert.deepEqual(CURSOS.map((c) => c.id).filter((id) => !competencias[id]), [], 'estação sem frase de competência');
  assert.deepEqual(Object.keys(competencias).filter((id) => !CURSOS.some((c) => c.id === id)), [], 'frase de estação que não existe');
});

test('competências: a frase fala com a pessoa, diz o que ela faz, e cabe no carimbo', () => {
  for (const [id, { frase }] of Object.entries(competencias)) {
    assert.match(frase, /^Você [a-zà-ú]/, `${id}: a frase começa por "Você " e um verbo`);
    assert.match(frase, /\.$/, `${id}: a frase termina em ponto`);
    assert.ok(frase.length <= 140, `${id}: ${frase.length} caracteres; o carimbo comporta 140`);
    assert.doesNotMatch(frase, /\b(XP|pontos?|ranking|sequência|parabéns|incrível)\b/i, `${id}: a frase informa competência, não comemora`);
    assert.doesNotMatch(frase, /\p{Extended_Pictographic}/u, `${id}: sem emoji`);
  }
});

test('competências: toda frase diz de onde veio', () => {
  for (const [id, { fonte }] of Object.entries(competencias)) {
    assert.ok(fonte === 'títulos das aulas' || /^https:\/\//.test(fonte), `${id}: fonte "${fonte}" não é os títulos nem um endereço`);
  }
  // onde os títulos das aulas são só "Aula N", a fonte TEM de ser a ementa, não os títulos
  for (const slug of ['algebra-linear-i', 'sistemas-distribuidos']) {
    const curso = CURSOS.find((c) => c.slug === slug);
    const aulas = ler(`data/aulas/${slug}.json`).aulas;
    assert.ok(aulas.every((a) => /^Aula \d+$/.test(a.titulo)), `${slug}: os títulos deixaram de ser só "Aula N"; reveja a fonte`);
    assert.match(competencias[curso.id].fonte, /^https:\/\//, `${slug}: sem assunto nos títulos, a frase vem da ementa`);
  }
});
