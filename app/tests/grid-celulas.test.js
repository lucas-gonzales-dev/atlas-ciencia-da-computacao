// Projeto Atlas — célula própria para cada filho do cartão (achado de 28/10/2026).
//
// O defeito: no celular (375 px) os botões "Concluir" e "Desfazer" caíam por
// cima da nota da bibliografia ("Caminho transcrito da fonte, disponibilidade
// não verificada…"). A causa NÃO é largura nem media query ausente: no CSS
// base, `.item .marca` e `.item .biblio` declaravam a MESMA célula —
// grid-column: 1 / -1 e grid-row: 3. Dois filhos na mesma célula se sobrepõem
// por definição, em qualquer largura. No desktop ninguém via, porque o media
// query de 620px move `.marca` para grid-row 1; a sobreposição só aparecia
// onde o media query não entrava — ou seja, o layout base era o errado e o
// ajuste largo o disfarçava.
//
// Este teste existe porque nenhum dos outros lia o CSS de posição: render.test
// confere o que o main.js desenha, pwa.test confere manifest e service worker,
// e a colisão de célula não é visível para nenhum deles. Aqui a regra é lida
// do próprio CSS: dois filhos de coluna cheia não podem reivindicar a mesma
// linha, nem no base nem no media query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raizDoApp = fileURLToPath(new URL('..', import.meta.url));

function cssDaPagina() {
  const html = readFileSync(`${raizDoApp}index.html`, 'utf8');
  const blocos = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  assert.ok(blocos.length, 'index.html perdeu o <style>: não há o que conferir');
  // Comentários fora: o comentário desta causa cita "grid-row: 3" e não é regra.
  return blocos.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** O CSS base (antes de qualquer @media) e cada bloco @media, separados. */
function secoes(css) {
  const medias = [...css.matchAll(/@media([^{]*)\{/g)];
  if (!medias.length) return { base: css, medias: [] };
  const base = css.slice(0, medias[0].index);
  const saida = [];
  for (let i = 0; i < medias.length; i += 1) {
    const inicio = medias[i].index + medias[i][0].length;
    const fim = i + 1 < medias.length ? medias[i + 1].index : css.length;
    saida.push({ consulta: medias[i][1].trim(), corpo: css.slice(inicio, fim) });
  }
  return { base, medias: saida };
}

/**
 * Filhos do cartão que reivindicam posição na grade: classe, linha e se cobrem
 * a coluna inteira.
 */
function filhosDaGrade(css) {
  const saida = [];
  const re = /\.item(?:\.[\w-]+)*\s+\.([\w-]+)\s*\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const corpo = m[2];
    const linha = /grid-row\s*:\s*([^;]+)/.exec(corpo);
    if (!linha) continue;
    const coluna = /grid-column\s*:\s*([^;]+)/.exec(corpo);
    const valorColuna = coluna ? coluna[1].replace(/\s+/g, '') : '';
    const inteira = valorColuna === '1/-1' || !coluna; // sem grid-column: ocupa a célula inteira
    saida.push({
      classe: m[1],
      linha: linha[1].trim().split(/\s*\/\s*/)[0].trim(),
      coluna: valorColuna,
      inteira
    });
  }
  return saida;
}

function colisoes(filhos) {
  const porLinha = new Map();
  for (const f of filhos.filter((x) => x.inteira)) {
    if (!porLinha.has(f.linha)) porLinha.set(f.linha, []);
    porLinha.get(f.linha).push(f.classe);
  }
  return [...porLinha.entries()]
    .filter(([, classes]) => classes.length > 1)
    .map(([linha, classes]) => `linha ${linha}: ${classes.join(' + ')}`);
}

test('no CSS base, dois filhos de coluna cheia não dividem a mesma linha', () => {
  const { base } = secoes(cssDaPagina());
  assert.deepEqual(
    colisoes(filhosDaGrade(base)),
    [],
    'célula compartilhada no cartão: um filho fica por cima do outro no celular'
  );
});

test('nos media queries, nenhum filho volta a dividir célula', () => {
  const { medias } = secoes(cssDaPagina());
  assert.ok(medias.length, 'a página não tem mais @media: o teste parou de olhar o layout largo');
  const problemas = [];
  for (const { consulta, corpo } of medias) {
    for (const c of colisoes(filhosDaGrade(corpo))) problemas.push(`${consulta} → ${c}`);
  }
  assert.deepEqual(problemas, [], `colisão introduzida pelo ajuste largo — ${problemas.join(' | ')}`);
});

test('o botão de progresso e a nota da bibliografia têm linhas próprias', () => {
  // A regressão do achado, nomeada: é o par que se sobrepunha.
  const { base } = secoes(cssDaPagina());
  const filhos = filhosDaGrade(base);
  const marca = filhos.find((f) => f.classe === 'marca');
  const biblio = filhos.find((f) => f.classe === 'biblio');
  assert.ok(marca, '.item .marca perdeu a posição na grade');
  assert.ok(biblio, '.item .biblio perdeu a posição na grade');
  assert.notEqual(
    marca.linha,
    biblio.linha,
    `marca (linha ${marca.linha}) e biblio (linha ${biblio.linha}) voltaram para a mesma célula`
  );
});

test('cada filho do cartão que ocupa a coluna inteira aparece uma vez só no CSS base', () => {
  // Regra duplicada é regra que sobrescreve em silêncio: o próximo conserto
  // edita uma e a outra continua valendo. Duas declarações de grid-row para a
  // mesma classe, no mesmo escopo, é o que fez o defeito ser difícil de ver.
  const { base } = secoes(cssDaPagina());
  const vistos = new Map();
  for (const f of filhosDaGrade(base).filter((x) => x.inteira)) {
    vistos.set(f.classe, (vistos.get(f.classe) || 0) + 1);
  }
  const duplicados = [...vistos.entries()].filter(([, n]) => n > 1).map(([c]) => c);
  assert.deepEqual(duplicados, [], `classe com posição declarada duas vezes: ${duplicados.join(', ')}`);
});
