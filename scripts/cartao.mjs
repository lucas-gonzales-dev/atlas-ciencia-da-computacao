// Projeto Atlas — fotografa o cartão de divulgação (S11a, 03/11/2026).
//
// O que este script faz, na ordem: sobe app/serve.js numa porta sorteada, abre
// app/cartao.html no Chrome sem janela com uma janela de exatamente 1200×630,
// grava app/marca/cartao.png e derruba o servidor. Nada mais: não publica, não
// comita, não toca no sw.js.
//
// POR QUE O CHROME JÁ INSTALADO E NENHUMA DEPENDÊNCIA NOVA: o Atlas não tem
// node_modules e não vai ganhar um agora por causa de uma imagem. O
// `--headless=new --screenshot` do Chrome é a ferramenta que já existe nesta
// máquina e no GitHub Actions. Puppeteer baixaria um Chromium de ~150 MB.
//
// POR QUE PORTA SORTEADA: porta fixa colide com o que já estiver rodando
// (inclusive o serve.js que o Lucas deixou de pé) e o erro vem como cartão
// branco no PNG, não como falha do script.
//
// POR QUE --virtual-time-budget: o mapa é desenhado DEPOIS de um `fetch` do
// catálogo, e o --screenshot do headless fotografa no `load`, não quando o
// async termina. O orçamento de tempo virtual congela o relógio do navegador e
// roda as tarefas pendentes até o mapa aparecer — sem isto o PNG nasce com a
// moldura e o mapa vazio, e a única prova disso é olhar a imagem.
//
// USO:  node scripts/cartao.mjs
//       CHROME=/caminho/para/chrome node scripts/cartao.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { start, stop } from '../app/serve.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(AQUI, '..');
const SAIDA = join(REPO, 'app', 'marca', 'cartao.png');
const LARGURA = 1200;
const ALTURA = 630;
const CHROME =
  process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** Cabeçalho IHDR: assinatura (8) + IHDR (4+4) + largura e altura em 4 bytes BE. */
export function dimensoesDoPng(caminho) {
  const b = readFileSync(caminho);
  const assinatura = b.subarray(0, 8).toString('hex');
  if (assinatura !== '89504e470d0a1a0a') throw new Error('não é PNG');
  if (b.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('PNG sem IHDR');
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), bytes: b.length };
}

const rodar = (bin, args) =>
  new Promise((ok, falhou) => {
    const p = spawn(bin, args, { windowsHide: true });
    let erro = '';
    p.stderr.on('data', (d) => { erro += d.toString(); });
    p.on('error', falhou);
    p.on('close', (codigo) => (codigo === 0 ? ok(erro) : falhou(new Error(`chrome saiu com ${codigo}\n${erro}`))));
  });

const port = 20000 + Math.floor(Math.random() * 40000); // nunca porta fixa
const perfil = join(tmpdir(), `atlas-cartao-${randomUUID()}`);

let servidor = null;
try {
  servidor = await start(port);
  mkdirSync(dirname(SAIDA), { recursive: true });
  await rodar(CHROME, [
    '--headless=new',
    `--user-data-dir=${perfil}`,
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${LARGURA},${ALTURA}`,
    '--force-device-scale-factor=1',
    '--virtual-time-budget=8000',
    `--screenshot=${SAIDA}`,
    `http://127.0.0.1:${port}/cartao.html`
  ]);
  // ^ a URL é servida pelo serve.js, não por file://: módulo ES em file:// é
  // recusado por CORS (origem "null") e o mapa nunca seria desenhado. O
  // querystring é só para o cache HTTP do navegador não responder de casa.
  const medida = dimensoesDoPng(SAIDA);
  console.log(`cartão: ${medida.largura}×${medida.altura} px, ${Math.round(medida.bytes / 1024)} KB → ${SAIDA}`);
  if (medida.largura !== LARGURA || medida.altura !== ALTURA) {
    throw new Error(`a captura saiu ${medida.largura}×${medida.altura}, não ${LARGURA}×${ALTURA}`);
  }
} finally {
  if (servidor) await stop();
  rmSync(perfil, { recursive: true, force: true });
}
