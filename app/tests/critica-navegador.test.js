// Projeto Atlas — a régua CRÍTICA NO NAVEGADOR (S11-0, 03/11/2026).
//
// POR QUE EXISTE: a prévia da v2 foi aberta num navegador de verdade (375×812 e
// 1280×800) e tinha quatro defeitos graves com a suíte inteira verde. Nenhum
// deles era visível no node, e a razão é sempre a mesma:
//
//   1. a folha não abria — o CSS pede a classe .aberta (web/folha.css:48-57)
//      e nenhum JS jamais a pôs. O estado parado do painel é translateY(100%),
//      ou seja, FORA da tela. S10 mediu o Tab, o Esc e o retorno de foco de um
//      painel que estava a 100 px abaixo da janela: tudo verde, nada na tela.
//   2. o Revisar media 0 px de conteúdo no celular — padding lateral em
//      --largura-lateral, que é a COLUNA DIREITA do computador (360px).
//   3. o Perfil chegava sem estilo — web/telas/perfil.css existe, está no
//      precache, e o index.html nunca o linkou. O node lê o CSS que o casco
//      importa; o navegador lê o que está LINKADO no HTML. São duas perguntas.
//   4. a lista do Explorar saía em cartaz — --tipo-estacao, que o próprio
//      tokens.css declara como "o MAIOR texto da tela", nos 35 itens da lista.
//
// A falha de juiz foi minha (declarado ao Lucas): eu disse que conferiria à mão
// e não conferi. Estas travas não substituem abrir a página — elas prendem a
// CLASSE de defeito, para que "escrevi a regra no CSS e ninguém a liga" e
// "o CSS existe e nada o linka" voltem como vermelho no node, e não como uma
// tela branca no celular de alguém.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarDoc, criarNo, storageCom, comClasse } from './hdom.js';
import { subirMetro } from '../web/metro.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url)); // app/
const ler = (rel) => readFileSync(join(RAIZ, rel), 'utf8');

const CATALOGO = [
  { id: 'l1a', title: 'Matemática Discreta', stage: 1, prerequisites: [], resourceUrl: 'https://exemplo.org/l1a', resourceType: 'video', bibliography: null },
  { id: 'l1b', title: 'Algoritmos I', stage: 1, prerequisites: [], resourceUrl: null, resourceType: null, bibliography: null }
];

/** O mínimo de main.js para o subirMetro existir: catálogo, progresso, notas. */
function modulosFake() {
  const aparelho = storageCom();
  return {
    loadCatalog: async () => ({ courses: CATALOGO, origem: 'teste' }),
    loadCompleted: () => [],
    saveCompleted: () => {},
    loadNotas: () => ({}),
    saveNotas: () => true,
    aplicarNota: (state = {}, id, texto) => ({ ...state, anotacoes: { ...state.anotacoes, [id]: texto } }),
    aparelho
  };
}

/**
 * A tela da Jornada com a folha da rota aberta, e uma janela que pode ou não
 * ter requestAnimationFrame. `quadros` reúne os callbacks pendentes: chamar
 * `proximo()` é o navegador desenhando o quadro seguinte — é o que separa a
 * classe posta AGORA (sem transição nenhuma) da classe posta no quadro em que
 * o painel já nasceu em translateY(100%).
 */
async function jornadaComFolha({ movimento = 'normal', quadro = true } = {}) {
  const doc = criarDoc();
  const root = doc.createElement('div');
  doc._registrar('metro', root);
  const pendentes = [];
  const win = { location: {} };
  if (quadro) win.requestAnimationFrame = (fn) => { pendentes.push(fn); return pendentes.length; };
  if (movimento === 'reduzido') {
    win.matchMedia = (consulta) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(consulta) });
  }
  const modulos = modulosFake();
  globalThis.localStorage = modulos.aparelho;
  let api;
  try {
    api = await subirMetro({
      document: doc, root, storage: storageCom(),
      modulos, setTimeout: () => ({}), hoje: '2026-11-03',
      window: win, folha: 'l1a'
    });
  } finally {
    delete globalThis.localStorage;
  }
  const painel = comClasse(root, /^folha$/)[0];
  return { api, root, doc, win, painel, proximo: () => pendentes.splice(0).forEach((fn) => fn()) };
}

test('folha: o metro.js POE a classe .aberta, no quadro seguinte (o CSS só levanta com ela)', async () => {
  const { painel, win, proximo } = await jornadaComFolha();
  assert.ok(painel, 'a rota da estação desenha o painel .folha');
  assert.equal(typeof win.requestAnimationFrame, 'function', 'a janela do teste tem quadros');
  assert.ok(
    !painel.classList.contains('aberta'),
    'a classe entra no QUADRO SEGUINTE, não no tick do append: no mesmo tick o navegador vê um estado só e a folha chega no lugar sem subir nada'
  );
  proximo();
  assert.ok(
    painel.classList.contains('aberta'),
    'web/folha.css:55 levanta o corpo com .folha.aberta .folha-corpo; sem a classe o painel fica em translateY(100%), fora da tela, com o véu escurecendo o mapa — o defeito 1 da crítica no navegador'
  );
});

test('folha: com movimento reduzido a classe entra na hora, sem esperar quadro', async () => {
  const { painel, proximo } = await jornadaComFolha({ movimento: 'reduzido' });
  assert.ok(painel.classList.contains('aberta'), 'sem transição, esperar o quadro é só atraso');
  proximo();
});

test('folha: sem requestAnimationFrame no contexto a classe entra na hora (a folha nunca fica escondida por falta de quadro)', async () => {
  const { painel } = await jornadaComFolha({ quadro: false });
  assert.ok(painel.classList.contains('aberta'), 'o desenho não pode depender de quadro nenhum para existir');
});

test('CSS das telas: nenhuma regra de web/telas usa --largura-lateral como padding', () => {
  const pasta = join(RAIZ, 'web', 'telas');
  const acusadas = [];
  for (const nome of readdirSync(pasta).filter((n) => n.endsWith('.css'))) {
    const linhas = ler(join('web', 'telas', nome)).split('\n');
    linhas.forEach((l, i) => {
      // Só padding: --largura-lateral em max-width é a coluna do computador e
      // está certa lá (perfil.css). O que mente é a MARGEM da página.
      const prop = /^\s*(padding|padding-left|padding-right|padding-inline(?:-start|-end)?)\b([^;]*)/.exec(l);
      if (prop && /--largura-lateral/.test(prop[2])) acusadas.push(`${nome}:${i + 1}: ${l.trim()}`);
    });
  }
  assert.deepEqual(
    acusadas,
    [],
    '--largura-lateral é a COLUNA DIREITA do computador (360px). Como padding lateral de uma tela ela come a tela inteira no celular: o Revisar media 0 px de conteúdo em 375px (defeito 2)'
  );
});

test('index.html e precache: todo CSS de web/telas está linkado no index.html e no precache', () => {
  const pasta = join(RAIZ, 'web', 'telas');
  const discos = readdirSync(pasta).filter((n) => n.endsWith('.css'));
  assert.ok(discos.length >= 4, `espero as telas no disco, achei ${discos.length}`);
  const html = ler('index.html');
  const sw = ler('sw.js');
  const semLink = discos.filter((n) => !html.includes(`href="./web/telas/${n}"`));
  const semPrecache = discos.filter((n) => !sw.includes(`'web/telas/${n}'`) && !sw.includes(`"web/telas/${n}"`));
  assert.deepEqual(semLink, [], 'CSS sem <link> no index.html é arquivo morto: o navegador não o baixa e a tela monta sem estilo nenhum (defeito 3, o Perfil)');
  assert.deepEqual(semPrecache, [], 'CSS linkado e fora do precache é a tela estilizada com rede e quebrada no ônibus');
});

test('Explorar: a lista não usa --tipo-estacao, que o tokens.css declara como o MAIOR texto da tela', () => {
  const css = ler(join('web', 'telas', 'explorar.css'));
  const acusadas = [];
  for (const seletor of ['.explorar-link', '.explorar-nome', '.explorar-item']) {
    const bloco = new RegExp(`\\${seletor}\\s*\\{([^}]*)\\}`, 'g');
    for (const m of css.matchAll(bloco)) {
      if (/--tipo-estacao/.test(m[1])) acusadas.push(`${seletor} usa --tipo-estacao`);
    }
  }
  assert.deepEqual(
    acusadas,
    [],
    'defeito 4: 35 itens a 32px transformam a lista em cartaz e a hierarquia da tela mente --tipo-estacao é o nome da estação NA PLACA; lista é corpo'
  );
});

test('trava de forma: esta régua lê os arquivos do disco, não um espelho', () => {
  // Sem isto, um teste que só confere a própria string sobreviveria a qualquer
  // um dos quatro defeitos — é exatamente como a suíte ficou verde neles.
  assert.ok(ler('web/metro.js').includes("classList.add('aberta')"), 'o metro.js precisa NOMINAR a classe que o folha.css levanta');
  assert.ok(criarNo('div').tag === 'div');
});
