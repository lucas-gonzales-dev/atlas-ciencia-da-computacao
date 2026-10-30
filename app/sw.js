// Projeto Atlas — service worker.
//
// Objetivo unico: o aluno abre o app SEM internet (onibus, zona rural, franquia
// acabada) e ve a trilha inteira com o progresso dele. Sem rede, sem tela branca.
//
// CAMINHOS RELATIVOS, RESOLVIDOS CONTRA self.location (24/10/2026): o Atlas ja
// foi servido da raiz e pode voltar a ser servido em subcaminho — relativo vale
// nos dois, absoluto so no primeiro. Um precache com caminho absoluto pediria a raiz do dominio,
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
// BUMP OBRIGATORIO quando a lista PRECACHE muda, quando o catalog.json muda e
// quando o CONTEUDO de QUALQUER arquivo ja listado muda. Os dois primeiros aparecem
// no diff deste arquivo; o terceiro nao aparecia, e era esse o buraco (30/10/2026):
// a fatia 2b do metro mexeu em web/metro.js, web/metro.css e core/textos.js sem
// mexer em uma linha daqui. O navegador compara service worker por bytes: igual
// significa NAO instala, e quem ja abriu o app continua vendo a tela velha para
// sempre, em silencio, achando que a correcao nao chegou. Aconteceu de verdade: a
// tela so mostrou a 2b-2 depois de desregistar o service worker na mao.
// A TRAVA: PRECACHE_HASH guarda o sha256 do conteudo de todos os arquivos da lista,
// na ordem da lista. Conteudo mudou e o hash anotado nao mudou, o teste
// app/tests/sw-precache-hash.test.js falha dizendo "suba a VERSAO e atualize o
// hash", e o valor a colar sai de node tests/precache-hash.js (roda da pasta app).
// Como o hash mora AQUI, mexer em qualquer arquivo do precache passa a mexer neste
// arquivo — que e o unico que o navegador re-busca — entao o install roda de novo.
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
// atlas-v8: entrou core/notes.js (anotacoes por disciplina) e o formato de
// exportacao subiu para v2. Mesma razao das anteriores: cache-first + modulo
// novo = quem ja instalou pediria, offline, um arquivo que o cache v7 nao tem,
// e a tela morreria no import (index.html/main.js importam notes.js).
// atlas-v9: entrou o DESIGN SYSTEM — web/tokens.css, web/fontes.css, os dois
// woff2 da Overpass e core/textos.js. A fonte esta no precache de proposito:
// offline sem a fonte seria OUTRA cara, que e exatamente o defeito que o DS
// veio corrigir. Cache-first + asset novo = quem ja instalou pediria, offline,
// um arquivo que o cache v8 nao tem.
// atlas-v10: entrou a TELA DO METRO — metro.html, web/metro.js, web/metro.css.
// A pagina ja esta no disco e ja e navegavel; sem os tres no precache quem
// abriu o Atlas no onibus receberia o index.html novo e uma tela que pede
// arquivo que o cache v9 nao tem. Mesmo motivo das nove anteriores.
// atlas-v11: a TRAVA DO CACHE entrou neste arquivo. Motivo, em uma linha: o
// conteudo do precache mudou na 2b do metro e este sw.js nao mudou com ele, entao
// nenhuma correcao chegava a quem ja tinha o app instalado. v11 e a primeira
// versao cujo hash esta anotado abaixo; a partir daqui, conteudo novo = sw.js novo
// = install de verdade.
// atlas-v12: a CHEGADA da 2c-1 mudou web/metro.js e web/metro.css no conteudo
// (concluir estacao pelo verbo do nucleo, circulo cheio, trecho ate ela com cor
// cheia, aviso curto com desfazer e a janela em que o aviso some sozinho). A lista
// PRECACHE nao mudou uma virgula; mudou o que ela aponta, que e justamente o caso
// que a trava da v11 existe para pegar: sem subir a VERSAO, o navegador compara este
// arquivo por bytes, nao instala, e quem ja abriu o app continua vendo a chegada
// antiga para sempre.
// atlas-v13: o EMBARQUE e a FOLHA TRANCADA da 2c-2 mudaram web/metro.js (lista
// de marcar, uma estação por linha, e o "faltam X, Y" só na folha aberta) e o
// teste do metrô ganhou corpo. A lista PRECACHE é a mesma de sempre; o que muda
// é o conteúdo dela, e é exatamente isso que a trava da v11 obriga a declarar.
// atlas-v14: o FECHAMENTO da 2c (2c-3) mudou web/metro.js e web/metro.css no
// conteudo — o esqueleto vira a primeira pintura sincrona (carregando tem 1
// esqueleto e 0 placas), o rotulo do leitor de tela omite a linha quando ela nao
// existe (antes saia "Linha 0", um nome que nao existe no catalogo), e a anotacao
// passa a morar so na folha aberta e a voltar no campo depois do redesenho.
// A lista PRECACHE nao muda; muda o conteudo dela, que e o que a trava da v11
// obriga a declarar — sem subir a VERSAO o navegador compara este arquivo por
// bytes, nao instala, e quem ja abriu o app continua vendo o rotulo e a espera
// antigos.
const VERSAO = 'atlas-v14';

// sha256 do CONTEUDO de cada arquivo do PRECACHE, na ordem do array abaixo. O
// caminho entra no hash antes de cada arquivo: renomear sem mudar conteudo tambem
// deixa o cache antigo sem o nome novo. Recalcular: node tests/precache-hash.js.
const PRECACHE_HASH = 'sha256-ffdce8606ecb3fb4f9909c8a9e9efaacb86cab8407441f271f22784ab7f68b61';

// Diretorio onde ESTE sw.js mora. Na raiz local da em .../; publicado da em
// .../subcaminho/. Todo caminho do precache sai daqui.
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
  // Tela do metrô (29/10/2026): a página nova e os dois arquivos dela. Entra
  // aqui no commit em que a página entra no disco — precache atrasado é
  // offline quebrado em silêncio, e só quem abre no ônibus descobre.
  'metro.html',
  'web/metro.js',
  'web/metro.css',
  // Design system (29/10/2026): tokens e @font-face. A fonte e asset de cara —
  // sem ela o app volta a ter fonte do sistema, que e o que o DS proibe.
  'web/tokens.css',
  'web/fontes.css',
  'fonts/overpass-latin-var.woff2',
  'fonts/overpass-mono-latin-var.woff2',
  'core/progress.js',
  'core/progress-io.js',
  // viagem.js ainda nao e importado por tela nenhuma (o pedido que o criou e o
  // das regras, e a tela vem depois do design system). Esta aqui porque o
  // precache cobre o disco: quando a tela passar a importar, o cache ja tem.
  'core/viagem.js',
  'core/notes.js',
  'core/search.js',
  // Os textos da tela, num lugar so (design/README.md §6). Ainda nao importado
  // pela tela — entra aqui pelo mesmo motivo do viagem.js: o precache cobre o
  // disco, e quando a tela redesenhada importar, o cache ja tem.
  'core/textos.js',
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
      // cache: 'reload' e obrigatorio aqui (30/10/2026). Sem ele, o service worker
      // NOVO pede os arquivos passando pelo cache HTTP do navegador, recebe a copia
      // velha que o navegador ainda considera fresca e grava a versao antiga dentro
      // do cache novo: a VERSAO sobe, o install roda, e a tela continua velha do
      // mesmo jeito — a trava do hash nao serviria para nada.
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
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
