// Projeto Atlas — service worker.
//
// Objetivo unico: o aluno abre o app SEM internet (onibus, zona rural, franquia
// acabada) e ve a trilha inteira com o progresso dele. Sem rede, sem tela branca.
//
// CAMINHOS RELATIVOS, RESOLVIDOS CONTRA self.location (24/10/2026): o GitHub
// Pages serve o Atlas em https://<usuario>.github.io/atlas-kit-tools/, nao na
// raiz do dominio. Um precache com caminho absoluto pediria a raiz do dominio,
// receberia 404, e cache.addAll() falha INTEIRO quando um unico arquivo falha —
// o app "instalaria" sem offline nenhum, em silencio, e so quem abriu no onibus
// descobriria. Relativo + BASE funciona na raiz local e no subcaminho publicado,
// sem build, sem variavel de ambiente e sem saber o nome do repositorio.
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
// BUMP OBRIGATORIO quando o PRECACHE ou o catalog.json mudam:
// a estrategia e cache-first, entao quem ja instalou o app com uma versao antiga
// jamais re-buscaria o catalogo novo — veria a trilha antiga para sempre e
// acharia que o Atlas nao tem eletivas. Versao nova = cache novo = install roda
// de novo. atlas-v4: o precache virou relativo (motivo acima); quem tem v3
// cacheado precisa de cache novo, senao continua apontando para a raiz.
// atlas-v5: entrou core/progress-io.js no precache (exportar/importar progresso).
// atlas-v6: entrou core/search.js no precache (busca de disciplina). Mesmo
// motivo das duas: cache-first + modulo novo = quem ja instalou pediria,
// offline, um arquivo que o cache antigo nao tem e a tela morreria no import.
// atlas-v7: entrou web/boot.js — o script que era inline no index.html virou
// modulo (para ter teste). E o modulo que A pagina importa: sem ele no cache,
// quem abriu offline receberia um index.html novo pedindo um arquivo que o
// cache v6 nao tem, e a tela ficaria em "Carregando a trilha…" para sempre.
const VERSAO = 'atlas-v7';

// Diretorio onde ESTE sw.js mora. Na raiz local da em .../; publicado da em
// .../atlas-kit-tools/. Todo caminho do precache sai daqui.
const BASE = new URL('.', self.location);

const PRECACHE = [
  // Nao listar a raiz aqui de proposito: o teste de sincronia compara caminho
  // a caminho com o disco e a raiz nao e arquivo. A navegacao offline cai em
  // index.html via fallback. Cuidado com aspas em comentario dentro deste
  // array: o teste le o que esta entre aspas e nao sabe o que e comentario.
  'index.html',
  'manifest.webmanifest',
  'icons/icone.svg',
  'web/boot.js',
  'web/main.js',
  'core/progress.js',
  'core/progress-io.js',
  'core/search.js',
  'core/catalog.js',
  'data/catalog.json',
  'data/ubl-core-seed.json',
  'data/commented-electives-seed.json',
  'data/specializations-seed.json',
  'data/specialization-resources-seed.json',
  'data/specializations-unindexed-overlay.json',
  // Os dois abaixo NAO sao assets de navegador (package.json e metadado,
  // serve.js e o servidor node). Estao aqui so porque o teste de sincronia
  // deriva a lista de TODOS os .js/.json fora de tests/. Mantidos no cache:
  // custam ~10 KB e evitam uma excecao especial que ninguem lembraria.
  'package.json',
  'serve.js'
];

// Resolvidos UMA vez: install e fallback usam a mesma lista, sem divergir.
const PRECACHE_URLS = PRECACHE.map((caminho) => new URL(caminho, BASE).href);

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      // all() em vez de loop: se UM arquivo faltar, a instalacao falha inteira
      // e o sw nao ativa. Preferivel a ativar pela metade e fingir offline.
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
  // pagina de erro do navegador em vez da trilha. Resolvido contra BASE pelo
  // mesmo motivo do precache — absoluto buscaria a raiz do dominio.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req).catch(() =>
        caches.match(new URL('index.html', BASE)).then((hit) => hit || Response.error())
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
