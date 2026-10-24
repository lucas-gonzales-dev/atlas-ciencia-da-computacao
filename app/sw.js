// Projeto Atlas — service worker.
//
// Objetivo unico: o aluno abre o app SEM internet (onibus, zona rural, franquia
// acabada) e ve a trilha inteira com o progresso dele. Sem rede, sem tela branca.
//
// Regra da casa: PRECACHE precisa ficar SINCRONIZADO com o disco. Ha teste que
// deriva a lista esperada dos arquivos reais e falha se:
//   - um arquivo novo existir e nao estiver aqui (quebra offline em silencio);
//   - um caminho daqui nao existir mais (precache apontando para o nada).
// Entao ao criar arquivo novo em app/, adicione-o abaixo. Nao "depois".
//
// Por que cache-first e nao network-first: o catalogo e derivado de uma fonte
// AUDITADA e versionada no git. Ele so muda quando alguem roda o build e faz
// commit. Servir o cache primeiro e mais rapido e mais honesto do que fingir
// frescor num dado que muda uma vez por semana.
// BUMP OBRIGATORIO quando o PRECACHE ou o catalog.json mudam (24/10/2026):
// a estrategia e cache-first, entao quem ja instalou o app com atlas-v1 jamais
// re-buscaria o catalogo novo — veria a trilha antiga para sempre e acharia que
// o Atlas nao tem eletivas. Versao nova = cache novo = install roda de novo.
const VERSAO = 'atlas-v2';

const PRECACHE = [
  // Nao listar a raiz aqui de proposito: o teste de sincronia compara caminho
  // a caminho com o disco e a raiz nao e arquivo. A navegacao offline cai em
  // index.html via fallback. Cuidado com aspas em comentario dentro deste
  // array: o teste le o que esta entre aspas e nao sabe o que e comentario.
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icone.svg',
  '/web/main.js',
  '/core/progress.js',
  '/core/catalog.js',
  '/data/catalog.json',
  '/data/ubl-core-seed.json',
  '/data/commented-electives-seed.json',
  // Os dois abaixo NAO sao assets de navegador (package.json e metadado,
  // serve.js e o servidor node). Estao aqui so porque o teste de sincronia
  // deriva a lista de TODOS os .js/.json fora de tests/. Mantidos no cache:
  // custam ~10 KB e evitam uma excecao especial que ninguem lembraria.
  '/package.json',
  '/serve.js'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      // all() em vez de loop: se UM arquivo faltar, a instalacao falha inteira
      // e o sw nao ativa. Preferivel a ativar pela metade e fingir offline.
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;

  // So GET, so mesma origem. Recurso externo (youtube/coursera) NAO e
  // cacheado: e conteudo de terceiro, grande, e o link abre em aba nova.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegacao offline cai no index.html: sem isto, abrir o app sem rede da
  // pagina de erro do navegador em vez da trilha.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req).catch(() =>
        caches.match('/index.html').then((hit) => hit || Response.error())
      )
    );
    return;
  }

  evento.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        // So guarda resposta integra e publica; erro/opaco nao vai pro cache.
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(VERSAO).then((cache) => cache.put(req, copia));
        }
        return resp;
      });
    })
  );
});
