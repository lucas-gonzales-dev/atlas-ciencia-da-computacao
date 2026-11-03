// Projeto Atlas — régua 9 (S10a): o proibido varrido nas telas MONTADAS e no CSS.
//
// POR QUE EXISTE: a lista do proibido mora em core/textos.js desde a fase 1, mas
// nunca foi VARREDO. Cada fatia conferia o seu pedaço, e o resto passava. Este
// arquivo sobe as cinco telas com catálogo e viagem reais, junta o texto que a
// pessoa lê com as classes que o CSS enxerga, e procura o que a casa proibiu:
// XP, ponto, sequência, ranking, emoji, confete, spinner, sombra fora da placa,
// azul-marinho e nome de estágio inventado.
//
// Nada aqui reescreve as travas que já existem (cor à mão, duração à mão,
// --p-*, ícone azul-marinho): elas continuam verdes e este arquivo é a rede
// por baixo delas, olhando o ESTADO MONTADO em vez do arquivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { comClasse, criarDoc, linksDe, marcasDe, porTag, storageCom, textoDe, esperar } from './hdom.js';
import { montar as montarExplorar } from '../web/telas/explorar.js';
import { montar as montarRevisar } from '../web/telas/revisar.js';
import { montar as montarPerfil } from '../web/telas/perfil.js';
import { subirMetro } from '../web/metro.js';
import { TOTAL_ESTACOES, resumoDaViagem } from '../core/viagem.js';
import { proibido } from '../core/textos.js';

const ler = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
const CATALOGO = JSON.parse(ler('data/catalog.json'));
const IDS = CATALOGO.courses.map((c) => c.id);

// ───────────────────────── as telas montadas ─────────────────────────
// Uma viagem no meio: as seis primeiras da linha 1 e 2, para a folha da
// concluída, da trancada e da disponível aparecerem todas na mesma varredura.
const FEITAS = IDS.slice(0, 6);

function modulosCom(extra = {}) {
  return {
    loadCatalog: () => Promise.resolve(CATALOGO),
    loadCompleted: () => FEITAS.slice(),
    saveCompleted: () => true,
    loadNotas: () => ({ [IDS[0]]: 'anotação de teste' }),
    saveNotas: () => true,
    aplicarNota: (state) => state,
    ...extra
  };
}

async function telasMontadas() {
  const saida = [];

  const d1 = criarDoc();
  const r1 = d1.createElement('div');
  await subirMetro({
    root: r1, document: d1, storage: storageCom(), window: { setTimeout: () => 0, clearTimeout: () => {} },
    modulos: modulosCom(), setTimeout: () => 0, hoje: '2026-11-02'
  });
  saida.push(['Jornada', textoDe(r1), marcasDe(r1)]);

  for (const [nome, montar] of [['Explorar', montarExplorar], ['Revisar', montarRevisar], ['Perfil', montarPerfil]]) {
    const doc = criarDoc();
    const raiz = doc.createElement('div');
    const storage = storageCom({ 'atlas.progresso.v1': JSON.stringify(FEITAS) });
    const inst = await montar(raiz, {
      document: doc,
      window: { localStorage: storage, setTimeout: () => 0, clearTimeout: () => {} },
      storage,
      modulos: modulosCom(),
      hoje: '2026-11-02',
      catalogo: Promise.resolve(CATALOGO),
      estadoCatalogo: CATALOGO
    });
    await esperar();
    if (inst?.pronto) await inst.pronto;
    saida.push([nome, textoDe(raiz), marcasDe(raiz)]);
  }

  // A folha aberta sobre a Jornada: a estação concluída é a primeira feita.
  const d2 = criarDoc();
  const r2 = d2.createElement('div');
  await subirMetro({
    root: r2, document: d2, storage: storageCom(), window: { setTimeout: () => 0, clearTimeout: () => {} },
    modulos: modulosCom(), setTimeout: () => 0, hoje: '2026-11-02',
    folha: CATALOGO.courses.find((c) => c.id === FEITAS[0]).slug
  });
  saida.push(['Folha', textoDe(r2), marcasDe(r2)]);

  return saida;
}

function cssDoApp() {
  const arquivos = [];
  const anda = (dir) => {
    for (const e of readdirSync(fileURLToPath(new URL(`../${dir}`, import.meta.url)), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'tests') anda(rel); }
      else if (rel.endsWith('.css')) arquivos.push(rel);
    }
  };
  anda('web');
  return arquivos;
}

// ───────────────────────── as varreduras ─────────────────────────
test('proibidos: a lista existe, e nenhuma tela montada a desrespeita', async () => {
  assert.ok(proibido.length >= 10, 'a lista do proibido encolheu');
  const telas = await telasMontadas();
  const veneno = [
    [/\bXP\b/, 'XP'],
    [/\bpontos?\b/i, 'ponto como placar'],
    [/sequ[êe]ncia/i, 'sequência de dias'],
    [/ranking/i, 'ranking'],
    [/medalha|trof[ée]u|conquista sem critério/i, 'conquista sem critério'],
    [/confete/i, 'confete'],
    [/spinner/i, 'spinner'],
    [/shimmer|animate-pulse/i, 'brilho ou pulso de esqueleto']
  ];
  for (const [nome, texto, marcas] of telas) {
    for (const [re, rotulo] of veneno) {
      assert.ok(!re.test(texto), `${nome}: a tela diz «${rotulo}» — proibido (design/README §9)`);
      assert.ok(!re.test(marcas), `${nome}: classe ou atributo evoca «${rotulo}»`);
    }
  }
});

test('proibidos: nenhum emoji em texto de tela', async () => {
  const emoji = /\p{Extended_Pictographic}/u;
  for (const [nome, texto] of await telasMontadas()) {
    const a = emoji.exec(texto);
    assert.ok(!a, `${nome}: emoji na tela («${a && a[0]}»): placa de metrô não tem emoji`);
  }
});

test('proibidos: sombra só onde há elevação real (a folha)', async () => {
  const fora = [];
  for (const rel of cssDoApp()) {
    const semComentario = ler(rel).replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const linha of semComentario.split(/\r?\n/)) {
      if (!/box-shadow/.test(linha)) continue;
      const valor = (/box-shadow:\s*([^;]+)/.exec(linha) || [])[1]?.trim() || '';
      // box-shadow com desenho a partir de "0 0 0" nao e sombra: e traco. O
      // anel de foco do teclado (base.css) e o pulso do anel da proxima
      // estacao (JORNADA 4) sao feitos assim, sem desfoque nenhum. Sombra de
      // elevacao real existe numa folha so: a placa, e ela vem de --sombra-placa.
      const traco = /^0 0 0(\s|$)/.test(valor);
      if (traco || /var\(--sombra-placa\)/.test(valor)) continue;
      fora.push(`${rel}: ${linha.trim()}`);
    }
  }
  assert.deepEqual(fora, [], `sombra fora de --sombra-placa (regra 9):\n${fora.join('\n')}`);
});

test('proibidos: azul-marinho não volta como fundo de nada', async () => {
  // Azul-marinho = hex de fundo escuro em que o azul manda. O #17181A do carvão
  // é neutro (r≈g≈b) e as 7 cores de linha são claras ou saturadas: nenhuma
  // entra aqui. O número é CALCULADO do hex, nunca escrito, para esta varredura
  // não virar ela mesma um literal de cor fora do tokens.css.
  const hexes = (rel) => {
    const texto = ler(rel).replace(/\/\*[\s\S]*?\*\//g, ' ');
    return [...texto.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1]);
  };
  const navy = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    const claro = Math.max(r, g, b) / 255 > 0.45;
    const neutro = Math.max(r, g, b) - Math.min(r, g, b) < 40;
    return b >= r && b >= g && !claro && !neutro;
  };
  const suspeitos = [];
  for (const rel of cssDoApp().concat(['index.html'])) {
    for (const h of hexes(rel)) if (navy(h)) suspeitos.push(`${rel}: #${h}`);
  }
  assert.deepEqual(suspeitos, [], `fundo azul-marinho de volta:\n${suspeitos.join('\n')}`);
});

test('proibidos: linha se chama Linha e o número', async () => {
  const linhasReais = new Set(CATALOGO.courses.map((c) => Number(c.stage)));
  const inventados = [/\bFundamentos\b/, /\bN[úu]cleo\b/, /\bBases\b/, /\bEtapa\s*\d/, /\bFase\s*\d/, /\bM[óo]dulo\s*\d/];
  // O que proibimos e BATIZAR UMA LINHA com palavra que a fonte nao usa. Nao e
  // a palavra em si: "Fundamentos de Computacao Grafica" e o nome de uma
  // disciplina do catalogo, e a Explorar tem de dizer o nome dela. Entao os
  // titulos reais saem do texto antes da varredura — o que sobra e a voz da
  // tela, que e o que a regra mira.
  const titulos = CATALOGO.courses.map((c) => c.title).sort((a, b) => b.length - a.length);
  for (const [nome, textoBruto] of await telasMontadas()) {
    let texto = textoBruto;
    for (const t of titulos) texto = texto.split(t).join(' ');
    for (const re of inventados) {
      const a = re.exec(texto);
      assert.ok(!a, `${nome}: nome de estágio inventado («${a && a[0]}») — a fonte não nomeia (design/README §1)`);
    }
    for (const m of texto.matchAll(/Linha (\d+)/g)) {
      assert.ok(linhasReais.has(Number(m[1])), `${nome}: fala da Linha ${m[1]}, que não existe no catálogo`);
    }
  }
});

test('proibidos: vidro fosco e degradê não entram no CSS', async () => {
  const ruins = [];
  for (const rel of cssDoApp()) {
    const t = ler(rel).replace(/\/\*[\s\S]*?\*\//g, ' ');
    if (/backdrop-filter/.test(t)) ruins.push(`${rel}: backdrop-filter`);
    if (/linear-gradient|radial-gradient/.test(t)) ruins.push(`${rel}: degradê`);
  }
  assert.deepEqual(ruins, [], `proibido no CSS:\n${ruins.join('\n')}`);
});

test('proibidos: o Terminal dito pela tela quando a rede fecha', async () => {
  // Não é gosto: "100%", "curso concluído" e "parabéns" são o proibido nº 1 da
  // chegada. Com as 35 concluídas, a única palavra que pode aparecer é Terminal.
  const resumo = resumoDaViagem({ completed: IDS, emCurso: [], conclusoes: {} }, CATALOGO.courses);
  assert.equal(resumo.terminal, true, 'a fixture não fecha a rede');
  const doc = criarDoc();
  const raiz = doc.createElement('div');
  await subirMetro({
    root: raiz, document: doc, storage: storageCom(), window: { setTimeout: () => 0, clearTimeout: () => {} },
    modulos: modulosCom({ loadCompleted: () => IDS.slice() }), setTimeout: () => 0, hoje: '2026-11-02'
  });
  const t = textoDe(raiz);
  assert.match(t, /Terminal/, 'a rede inteira concluída e a tela não diz Terminal');
  for (const re of [/100\s*%/, /curso conclu[íi]do/i, /parab[ée]ns/i]) {
    assert.ok(!re.test(t), `a tela comemora com «${re}» em vez de dizer Terminal`);
  }
  assert.ok(comClasse(raiz, /embarque/).length === 0, 'o embarque voltou com a viagem toda feita');
  assert.equal(TOTAL_ESTACOES, IDS.length, 'a fixture saiu do catálogo');
});
