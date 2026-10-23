// Projeto Atlas — servidor estatico de desenvolvimento.
//
// Por que isto existe (e nao e gambiarra): index.html carrega ES modules, e
// navegadores BLOQUEIAM module em file:// por CORS (origem "null"). Alem disso
// o alvo declarado do produto inclui PWA, e service worker so funciona em
// http(s). Entao servir por http e requisito, nao contorno.
//
// Zero dependencia externa: so node:stdlib. npm nao esta instalado nesta
// maquina e nao precisa estar.
//
// Uso:  node serve.js            -> http://localhost:41730/
//       PORT=45999 node serve.js -> porta escolhida por quem chama
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url))) + sep;
const PORT = Number(process.env.PORT || 41730);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

const server = createServer(async (req, res) => {
  const mandar = (codigo, corpo, tipo = 'text/plain; charset=utf-8') => {
    res.writeHead(codigo, { 'content-type': tipo, 'cache-control': 'no-store' });
    res.end(corpo);
  };

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let caminho = decodeURIComponent(url.pathname);

    // Traversal recusado ANTES de normalizar, e testado com path CRU.
    // Detalhe que quase passou batido em 23/10/2026: fetch()/URL colapsam "/../"
    // no cliente, entao um teste de traversal feito com fetch prova NADA — o
    // servidor nunca ve os ".." e responde 200 com um arquivo de dentro da raiz.
    // Recusar explicitamente e mais honesto do que depender de normalize()
    // descartar os ".." que sobem acima da raiz em silencio.
    // req.url e a UNICA forma crua que chega aqui. A URL API colapsa "/../"
    // durante o parsing, entao url.pathname JA vem sem os ".." e testar a
    // regex nele prova nada — foi assim que "/../package.json" passou com 200
    // em 23/10/2026: pathname virou "/package.json", que existe DENTRO da raiz.
    // As tres checagens ficam: crua, parsed e decodificada (pega %2f).
    const traversal = /(^|\/)\.\.(\/|$)/;
    if (traversal.test(req.url) || traversal.test(url.pathname) || traversal.test(caminho)) {
      return mandar(403, '403 — caminho com ".." recusado');
    }

    if (caminho.endsWith('/')) caminho += 'index.html';

    // Normaliza e confirma que continua DENTRO da raiz: sem isso,
    // /../../QualquerCoisa le o disco inteiro.
    const alvo = resolve(join(RAIZ, normalize(caminho)));
    if (alvo !== RAIZ.slice(0, -sep.length) && !alvo.startsWith(RAIZ)) {
      return mandar(403, '403 — fora da raiz do projeto');
    }

    const info = await stat(alvo).catch(() => null);
    if (!info || !info.isFile()) return mandar(404, `404 — ${caminho}`);

    const corpo = await readFile(alvo);
    return mandar(200, corpo, MIME[extname(alvo).toLowerCase()] || 'application/octet-stream');
  } catch (e) {
    return mandar(500, `500 — ${e.message}`);
  }
});

/**
 * Sobe o servidor e resolve quando estiver escutando.
 *
 * Por que e exportado: os testes precisam escolher a porta (nunca fixa — porta
 * fixa colide com o que ja estiver rodando) e fechar tudo no fim. Sem isto, o
 * teste importava serve.js, o servidor ficava escutando para sempre e a suite
 * NUNCA terminava. Isso aconteceu de verdade em 23/10/2026: `node --test`
 * estourou o tempo com os testes ainda rodando.
 *
 * @param {number} port
 * @returns {Promise<import('node:http').Server>}
 */
export function start(port) {
  return new Promise((ok, falhou) => {
    server.once('error', falhou);
    server.listen(port, () => {
      server.removeListener('error', falhou);
      ok(server);
    });
  });
}

/**
 * Fecha de verdade. `server.close()` sozinho NAO retorna enquanto houver conexao
 * keep-alive aberta, e o fetch do proprio teste deixa uma aberta. Por isso
 * closeAllConnections() antes — sem isto o processo fica pendurado apos o teste
 * "passar", que e o pior tipo de falha: silenciosa.
 * @returns {Promise<void>}
 */
export function stop() {
  return new Promise((ok) => {
    server.closeAllConnections?.();
    server.close(() => ok());
  });
}

const ehExecucaoDireta =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (ehExecucaoDireta) {
  start(PORT).then(
    () => {
      console.log(`Atlas no ar: http://localhost:${PORT}/`);
      console.log(`Raiz servida: ${RAIZ}`);
    },
    (e) => {
      console.error(`ERRO: nao subi na porta ${PORT} (${e.code}). Escolha outra: PORT=45999 node serve.js`);
      process.exit(1);
    }
  );
}
