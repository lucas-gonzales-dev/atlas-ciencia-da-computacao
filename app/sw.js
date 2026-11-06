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
// atlas-v15: a ANOTACAO QUEBRAVA NO NAVEGADOR e o metro.js mudou no conteudo para
// usar a API real do main.js. O metro.js pedia applyNote e chamava
// saveNotas(storage, notas) — nomes que o main.js nunca exportou — entao cada
// tecla no campo dava TypeError e o texto sumia no redesenho. Estava no ar desde
// a fatia 1 (32469d9): quem tem v14 no cache continua anotando em um app que nao
// salva nada, e e exatamente o cache-first da regra antiga que a trava da v11
// obriga a declarar. Sem subir a VERSAO, o navegador compara este arquivo por
// bytes, nao instala, e a pessoa anota, fecha e perde a anotacao para sempre.
// atlas-v16: a 2d-1 (critica visual do Claude) mudou o metro.js no conteudo: o
// aviso da chegada passou a dizer o que o gesto destrancou, pelo nome, inclusive
// baldeacao, e "Comecar a estudar" ganhou embaixo a ORIGEM do recurso tirada do
// catalogo. Quem tem v15 no cache continuaria concluindo sem saber o que abriu e
// abrindo video sem saber de onde veio — e e a regra da trava da v11 que obriga a
// declarar. Sem subir a VERSAO, o navegador compara este arquivo por bytes, nao
// instala, e a tela fica na chegada muda de antes.
// atlas-v17: a 2d-2 (folha por estado e um primario por folha) mudou web/metro.js,
// web/metro.css, core/textos.js e app/tests/metro.test.js no conteudo: a trancada
// parou de oferecer "Começar a estudar", a concluida passou a carimbar a data do
// nucleo com o verbo "Rever o conteudo", o botao de concluir virou contorno e o
// aviso da chegada passou a nomear a linha de destino quando o que abre esta em
// outra linha. E a regra da trava da v11 que obriga a declarar.
// atlas-v18: o AJUSTE da 2d-2 mudou core/textos.js no conteudo: o carimbo da
// folha concluida saia com a data crua do nucleo (\"CONCLUÍDA EM 2026-10-30\"),
// que ninguem le, e passou a sair em dd/mm/aaaa formatado pela propria string —
// sem new Date no meio, porque uma data de calendario sem hora e lida como UTC
// meia-noite e num fuso negativo devolveria o dia anterior na tela. Quem tem v17
// no cache continua lendo ISO ate a proxima atualizacao, entao e a regra da trava
// da v11 que obriga a declarar.
// atlas-v19: a S1 mudou o CONTEUDO do cache, nao so a aparencia. A marca
// definitiva entrou como PNG (icones do manifesto, favicon, simbolo e palavra
// do topo), o icons/icone.svg azul-marinho morreu do disco, o manifesto passou
// a pintar papel (#fbf7f0) e o metro.html ganhou o <header class="topo">. Quem
// tem v18 no cache continuaria installando o app com o icone velho e a splash
// escura, e nao ha teste de codigo que veja isso — entao a regra da trava da
// v11 obriga a declarar.
// atlas-v20: a S2 mudou o CONTEUDO do cache de verdade — web/base.css entrou na
// lista (html e body pintando --fundo, corpo em Overpass, foco de 3 px), e
// web/metro.css, web/metro.js e web/tokens.css mudaram por dentro: o seletor das
// 7 linhas virou <button>, o anel \"voce esta aqui\" pulsa 2 vezes e para, e o nome
// \"Atlas\" saiu do cabecalho desenhado. Quem tem v19 no cache continuaria vendo a
// calha branca no escuro e o pulso infinito, entao a regra da trava da v11 obriga
// a declarar.
// atlas-v21: entrou core/rotas.js e web/grade.css no precache (S3a-1, as
// rotas do quadro e a grade compartilhada). Quem tem v20 no cache receberia o
// index.html novo com a grade desmontada e a rota sem arquivo — o caso que a
// regra da trava da v11 existe para pegar.
// atlas-v22: o index.html virou CASCO (S3a-2a) — entrou web/casco.js e as duas
// telas no precache, e o boot.js deixou de subir sozinho. Quem tem v21 no cache
// receberia o HTML novo sem o modulo que o montava: a pagina abre em branco.
// atlas-v23: entrou web/casco.css no precache (S3a-2b, a cara do casco — barra
// de abas no pe no celular e no topo no computador, o pular que so aparece no
// foco, a tela que entra subindo). Sem ele, quem tem v22 no cache recebe o
// index.html com o link novo apontando para um arquivo que nao esta offline:
// no onibus a barra de abas perde o estilo e vira lista solta no fim da pagina.
// atlas-v24: o CONSERTE do web/casco.css mudou o conteudo do arquivo que entrou
// na v23. O motivo nao e cosmetico: o comentario daquele arquivo era escrito com
// //, que CSS nao tem — o navegador juntava as duas barras ao seletor da linha
// seguinte e descartava a regra inteira. .pular, .topo, .abas e main valiam
// zero: no celular (375px) a barra de abas ficava no topo, no fluxo, em vez de
// presa no pe. A suite estava verde porque nenhuma trava lia o css como o
// navegador le. Agora le: tests/design-system.test.js reprova linha que comeca
// com // em arquivo de estilo.
// Sem subir a VERSAO, quem tem v23 no cache continua com a folha quebrada.
// atlas-v25: S3b da v2 — a paleta azul-marinho morre. web/grade.css migrou os
// 31 var(--p-*) para os tokens do design system e web/tokens.css perdeu o bloco
// PROVISORIO inteiro; web/main.js passou a pôr a classe da linha (l1..l7) no
// cartao, porque o estado agora e pintado pela COR DA LINHA, nao por verde/azul
// inventados. app/metro.html deixou de ser pagina e virou redirecionamento para
// ./#/ (quem tem o endereco salvo chega na Jornada, ate offline: ele continua no
// precache), e app/index.html passou a ter dois theme-color, papel e carvao.
// Sem subir a VERSAO, o navegador compara estes arquivos por bytes e o cache
// velho vence: a tela ficaria com o azul-marinho rejeitado por fora.
// atlas-v26: S4a da v2 — a Jornada responde em 10 segundos. Entraram no
// precache web/telas/jornada-blocos.js (as tres pecas: abertura, os tres
// numeros, a proxima conexao) e web/telas/jornada.css, e mudaram por dentro
// web/metro.js (o desenharMetro chama as pecas), core/viagem.js
// (numerosDaJornada), core/textos.js (secao jornada) e index.html (o link do
// css novo). Sem estes dois no cache, quem tem v25 recebe o HTML novo e a
// abertura nao monta — a tela perde a primeira coisa que se le, no onibus.
// atlas-v27: S4b da v2 — o layout da Jornada. Mudaram metro.js (a placa com a
// posição na linha, a nota "Abrir não muda sua viagem", o cartão com a linha de
// apoio, e o recurso/bibliografia só na folha ABERTA — um primário por tela),
// metro.css, jornada.css, jornada-blocos.js, textos.js e tokens.css.
// atlas-v28: S5 da v2 — a FOLHA tem componente proprio. Entram no precache
// web/folha.js (desenharFolha) e web/folha.css (o painel do computador, a folha
// do celular), e o index.html passou a linkar o CSS: sem os dois la, quem tem
// v27 recebe o HTML novo pedindo offline um CSS e um modulo que nao existem.
// atlas-v29: S5 parte 2 da v2 — a FOLHA passou a ser ROTA de verdade. Mudaram
// web/metro.js (o cartao virou <a href="#/estacao/<slug>">, a folha saiu do
// desenho de dentro da linha, entrou Esc), web/folha.css (as classes
// .botao-primario/.botao-secundario que o folha.js emite e nenhum CSS tinha),
// web/telas/jornada.js (entrega o slug da rota ao subirMetro — sem isso a rota
// existia, os testes passavam e a tela nao abria folha nenhuma) e os dois
// testes. Sem subir a VERSAO, quem tem v28 no cache recebe o HTML novo e a
// folha continua invisivel no celular.
// atlas-v30: o index.html ganhou a GUARDA ESCRITA do casco branco (01/11/2026).
// Em file:// o navegador recusa <script type="module"> por CORS e nao existe JS
// para se avisar: sem as frases no <main>, o aluno ve branco e acha que o Atlas
// quebrou. boot.js passou a chamar reg.update() quando ja havia um sw no
// controle — cache-first sem hora de revalidar deixa dias servindo snapshot de
// uma versao morta no disco. Mudou conteudo do precache, entao VERSAO e hash.
// atlas-v31: o selo da Linha 1 nasce sem o numero mutilado (01/11/2026). A faixa
// que rola (`.linhas`) cortava no proprio padding-edge, e o padding era so
// embaixo: o anel da linha atual e um box-shadow, e o anel de teclado e outline
// com afastamento — os dois moram FORA da caixa do selo. Sem ar em volta, o 1,
// que e o primeiro da fileira, perdia o pedaco esquerdo do anel no desktop e no
// celular. Mudou conteudo do precache (metro.css), entao VERSAO e hash.
// atlas-v32: a CHEGADA da S6 mudou core/viagem.js (momentoDaChegada), core/textos.js
// (o bloco do momento e a travessia dita "esta disponivel, na Linha N"), web/folha.js
// e web/folha.css (o miolo vira o momento, com um primario so) e web/metro.js (o
// handler passa o momento pela porta do nucleo). Conteudo do precache mudou, entao
// VERSAO e hash.
// atlas-v33: comeca a S7 (01/11/2026). core/rotas.js passou a ler e escrever a
// busca e a linha no endereco (#/explorar?busca=calculo&linha=2), com
// hrefDe fazendo o caminho de volta. Antes, colar esse link caia no 'rota
// desconhecida' e o casco dava replaceState para '#/' -- a pessoa perdia a
// busca do outro lado sem aviso. Mudou conteudo do precache (rotas.js),
// entao VERSAO e hash.
// atlas-v34: S7 — core/textos.js ganhou a voz da Explorar (rotulo, busca,
// filtro, status, grupos, selos, rodape). A tela em si vem no proximo bloco.
// atlas-v35: S7 (01/11/2026) — a Explorar passou a importar core/filtro.js e
// a ligar web/telas/explorar.css, e o index.html passou a carregar o css dela.
// Dois arquivos novos no precache e dois htmls alterados: VERSAO e hash sobem.
// atlas-v36: S7 (01/11/2026 a noite) — a Explorar nao acumula mais a linha de
// origem do curriculo a cada tecla (ela nascia no montar e era anexada dentro
// do pintar), e ganhou testes de DOM proprios em tests/explorar.test.js.
// Mudou conteudo do precache (web/telas/explorar.js), entao VERSAO e hash.
// atlas-v37: a grade morre (S7-1c, 01/11/2026). web/grade.css saiu do PRECACHE,
// do index.html e do disco, boot.js ficou so com registrarSW, e a Explorar passou
// a se desenhar em web/telas/explorar.css. Sem subir a VERSAO, quem tem v36 no
// cache conserva a folha morta de 25 medidas fora da escala.
// atlas-v38: a Explorar pedia desculpas ao aluno em vez de acento (S7, achado
// do navegador — nao da suíte). Duas frases de UI nasceram cruas em core/textos.js:
// "Ramais dao aprofundamento em uma area" e "sem decisao editorial". A familia ja
// tinha trava no dado derivado e na tela montada, mas NENHUMA lia core/textos.js,
// que e a casa da prosa; agora portugues-tela.test.js varre os literais de la, e
// provou o vermelho com o texto cru de volta. Mudou conteudo do precache
// (core/textos.js), entao VERSAO e hash.
// atlas-v39: a aba Revisar nasce (S8, 01/11/2026) — core/revisao.js,
// web/telas/revisar.js e revisar.css entraram no PRECACHE, e o index.html passou
// a listar a terceira aba. Arquivo novo fora do cache = Revisar em branco no
// aparelho de quem já tem v38, sem erro nenhum na rede.
// atlas-v40: core/textos.js fechava um Object.freeze com ) em vez de }) (S9 em
// curso). O modulo nao carregava e o app inteiro ficava em branco — marca e abas
// vinham do HTML estatico, o <main> morria mudo. A trava de acento nao pegou
// porque o arquivo nem chegava a ser parseado. Mudou conteudo do precache
// (core/textos.js), entao VERSAO e hash sobem com ele.
// atlas-v41: a aba Perfil nasce (S9, 02/11/2026) — core/dados-pessoa.js,
// web/telas/perfil.js e perfil.css entraram no PRECACHE, e o index.html passou a
// listar a quarta aba. A tela também importa web/metro.js só por carregarViagem:
// se o cache antigo não tiver esses quatro, o Perfil abre em branco no aparelho
// de quem já tem v40, sem nenhum erro na rede para avisar.
// atlas-v42: S10a (auditoria de estados, 03/11/2026) mexeu no CONTEUDO de tres
// telas ja precached — explorar.js (erro de catalogo com as tres partes e o termo
// repetido na busca sem resultado), revisar.js (o estado "em dia" ganhou saida) e
// perfil.js (sem rede passou a dizer o que fazer e deu o caminho de volta). Quem
// tem v41 no cache continuaria lendo "offline" onde nao havia rede nenhuma.
// atlas-v43: S10b item 7 — o selo de rede do casco. web/rede.js entrou no
// PRECACHE (modulo novo que o casco importa) e index.html, casco.js e casco.css
// mudaram conteudo. Quem tem v42 no cache receberia o HTML com o selo e um
// casco.js que nao o liga: a faixa de "offline" nunca apareceria, silenciosa.
// atlas-v44: S10-auditoria reguas 2 e 5 (03/11/2026) mudaram o CONTEUDO de tres
// folhas precached: tokens.css (--atraso-esqueleto zerou no reduce), folha.css (o
// selo da linha saiu de --cor-texto, token que nunca existiu, e passou a --superficie)
// e telas/explorar.css (o esqueleto parou de respirar; o selo "trancada" trocou o
// recheio cinza por anel + texto fosco). Quem tem v43 no cache continuaria com o
// selo trancado a 3,44:1 no claro e o esqueleto pulsando, sem um erro na rede.
// atlas-v45: S10-auditoria regua 6 (tamanhos, 03/11/2026). O conserto nao e um
// numero maior de padding: no celular e no tablet a JANELA passou a nao rolar
// (html/body em 100dvh + overflow hidden) e o main virou o container de rolagem,
// com forro lendo o token novo --altura-barra — assim a reserva vive com o
// conteudo e o ultimo item para no topo da barra em vez de atras dela. Mudaram
// conteudo: tokens.css (o token novo), base.css (o min-height: 100dvh saiu do
// body e foi para o html -- no body ele era um PISO que esticava a caixa de volta
// a tela inteira por cima do desconto do casco, ou seja, anulava o conserto),
// casco.css (a trava da janela, a altura da barra, o @media de 1024 devolvendo o
// scroll a janela), casco.js (main.scrollTo) e metro.css (o .aviso-chegada, cujo
// bottom agora conta a faixa da barra). Quem
// tem v44 no cache continuaria com "Viagem", "Em curso" e "Linhas abertas" atras
// das abas, e o aviso de desfazer escondido, sem um erro na rede para avisar.
// atlas-v46: S10, item 3 (teclado, 03/11/2026). web/metro.js ganhou a prenda de
// foco da folha -- Tab na ultima posicao volta ao primeiro, Shift+Tab no primeiro
// vai ao ultimo, Esc devolve o foco ao cartao que abriu a folha (memoria de
// modulo, porque fechar navega e a instancia morre no meio) -- e o cartao agora
// memoriza o gatilho por closest('a') + href + data-id, nao por closest('a[href]'):
// o seletor de atributo sem valor nao e o que o mini-DOM dos testes resolve, e um
// registro que so funciona no navegador e verde mudo no node. Mudou conteudo de
// um arquivo do PRECACHE (web/metro.js), entao VERSAO e hash. Quem tem v45 no
// cache continuaria com a folha engolindo o Tab e o foco sumindo ao fechar, sem
// um erro na rede para avisar.
// atlas-v47: S10 item 3 e 4. Entram o auditoria de teclado e leitor de tela
// (app/tests/auditoria-teclado-leitor.test.js, nao esta no precache), mas o
// conteudo que mudou no precache foi web/casco.js (agora entrega document e
// window as telas) e web/telas/jornada.js (anuncio de troca de aba e nome nos
// campos). Sem subir a VERSAO, quem tem v46 no cache continua com a tela que nao
// recebe o documento e sem o aviso sonoro do leitor de tela.
// atlas-v48: S11a (vitrine, 03/11/2026). O index.html ganhou as dez tags de
// compartilhamento (og:*, twitter:card) e passou a linkar nada novo; o arquivo
// marca/cartao.png entrou no PRECACHE, fotografado por scripts/cartao.mjs a
// partir de app/cartao.html. FICAM FORA do precache os dois, de proposito: a
// pagina e materia-prima de fotografia, e o PNG e lido pelo robô do LinkedIn,
// que nao passa pelo service worker do aluno -- precachear os dois pagaria
// 91 KB de install por um arquivo que o app nunca busca (o PNG medido, 89 KB,
// mais a pagina, 2 KB). O que mudou no
// precache foi o index.html (as tags). O cartao.png ainda e PROVISORIO
// (uma captura da Jornada sem o desenho da rede inteira, que vem na S11b); por
// isso o hash vai subir de novo quando a imagem trocar de bytes, sem que nenhum
// caminho mude. Quem tem v47 no cache nao veria mal nenhum aqui -- o index.html
// servido do cache tambem carrega as tags -- mas o cartao.png novo nao chegaria
// a quem ja baixou o app, e o post sairia com a foto velha em silencio.
// atlas-v49: S11-0 (a critica no navegador real, 03/11/2026). Quatro defeitos
// que a suinte inteira via verde, medida no navegador de verdade (375x812 e
// 1280x800), do zero:
// 1. A folha da estacao nunca abria, em nenhum tamanho. web/folha.css:48-57
//    diz que "o metro.js poe e tira" a classe .aberta; nenhum JS jamais pos
//    (git log -G"add\(.aberta" vazio, a regra nasceu na S5 parte 1, 4bc1496).
//    O estado parado e translateY(100%): tocar numa estacao escurecia o veu e
//    nao aparecia nada. web/metro.js agora poe .aberta no quadro seguinte
//    (requestAnimationFrame), na hora com movimento reduzido ou sem rAF.
// 2. O Revisar media 0 px de conteudo no celular: .revisar usava
//    --largura-lateral (a COLUNA DIREITA do computador, 360px) como padding
//    lateral; sobravam 15px para 720px de margem. Agora --espaco-4, a margem
//    da pagina, a mesma de .metro e .explorar-raiz.
// 3. O Perfil chegava sem estilo nenhum: web/telas/perfil.css existia no disco
//    e no precache, e o index.html nunca o linkou. Node le o CSS que o casco
//    importa, nao o HTML que o navegador segue -- por isso a suinte nao via.
// 4. A lista do Explorar saia em cartaz: .explorar-link e .explorar-nome usavam
//    --tipo-estacao (32px, o MAIOR texto da tela, o nome na placa) numa lista
//    de 35 itens. Agora --tipo-corpo.
// Mudou conteudo de tres arquivos do PRECACHE (web/metro.js,
// web/telas/explorar.css, web/telas/revisar.css) e o index.html ganhou um link.
// Quem tem v48 no cache continuaria com a folha invisivel, o Revisar de 0 px, o
// Perfil pelado e a lista gigante, sem um erro na rede para avisar.
// atlas-v50: S11, o mapa da rede (03/11/2026). Entra core/mapa-rede.js: a rede
// inteira num SVG, uma coluna por linha da fonte, as baldeações como trilhos, o
// trecho apagado onde a rede ainda está trancada. Nenhuma tela o importa ainda;
// está no precache porque o precache cobre o disco, como o viagem.js esteve.
// atlas-v51: S11, o acabamento que só o navegador mostrou (03/11/2026). O "·"
// tinha avanço zero na Overpass ("Linha 1 ·estação"): sai da faixa dela no
// web/fontes.css. As etiquetas da folha vazavam por cima dos valores
// ("BIBLIBibliografia"): os três fatos viram uma grade só no web/folha.css.
// atlas-v52: S11c — o CARTÃO DO LINK passa a ser a TRAVA DA MARCA (03/11/2026).
// O PNG que o robô do LinkedIn, do WhatsApp e do X mostra é desenhado pelo
// core/mapa-rede.js, o MESMO módulo que desenha a rede do app, e não mais pelo
// desenharMetro da Jornada. O motivo é medido, não estético: a Jornada pinta UMA
// linha por vez, então a foto de antes mostrava um pedaço da ideia, e o que faz o
// Atlas ser o Atlas é a rede inteira — as sete linhas e as baldeações que elas
// abrem. Com o mapa verdadeiro entrou o título em três linhas, e o og:image:alt do
// index.html passou a descrever a rede (sete linhas, 35 disciplinas, nove estações
// preenchidas) em vez da Linha 2 sozinha. Do PRECACHE participou só o index.html,
// uma linha de alt: cartao.html, web/cartao.js, web/cartao.css e marca/cartao.png
// continuam FORA da lista de propósito, como declarado na v48 — a página é
// matéria-prima de fotografia e o PNG é lido pelo robô, que não passa pelo service
// worker do aluno; precachear os dois pagaria install por arquivos que o app nunca
// busca. Sem subir VERSÃO e hash, quem tem v51 no cache recebe o index.html velho
// e compartilha um link cujo texto descreve o cartão antigo.
// atlas-v53: S12, as aulas (04/11/2026). Entra core/aulas.js: a tradução do que a
// YouTube Data API devolve (playlistItems e videos) em aulas por estação, com a
// duração, o título sem a etiqueta do curso e a aula de exercício marcada pelo
// título da fonte. Nenhuma tela o importa ainda; os dados (app/data/aulas/) entram
// quando o tools/aulas-do-youtube.mjs rodar com a chave.
// atlas-v54: S12, os dados das aulas (04/11/2026). Entram app/data/aulas/ (35
// estações e o índice: 1.375 aulas, 719 h, gerados pela YouTube Data API em
// 04/11, válidos até 04/12) e o data/aulas-recortes.json, que divide a playlist
// única de Python I e II. Sem estes arquivos no cache, a lista de aulas some
// quando a rede cai.
// atlas-v55: S13a, o ESTUDO por aula sem tela (04/11/2026). Entram
// core/estudo.js e web/aulas-dados.js. O primeiro é o registro de quem ABRIU
// uma aula e a regra de por onde continuar (os quatro motivos do cartão
// "Continuar: Aula 13"); o segundo é o caminho que a tela de aulas vai usar
// para ler data/aulas/<slug>.json sem estourar quando o arquivo não está no
// aparelho. Nenhuma tela importa os dois ainda — a S13b desenha — e a
// rotas.js ganhou o painel #/estacao/<slug>/aulas, que é o endereço que ela
// vai montar. Sem estes arquivos no cache, a folha da estação pede o módulo e
// recebe o index.html do fallback: tela em branco com o service worker
// dizendo que foi um 200.
// atlas-v56: a decisao sobre o continuarDe (04/11/2026; do Claude, pelo canal do
// dogfood, e nao do Lucas, como este comentario dizia ate a v59), no nucleo. Sai o
// motivo 'primeira-nao-aberta', que devolvia a Aula 1 a quem tinha aberto a 13 e
// a 14 e leria, na folha, como se nada tivesse sido estudado; entram a aberta mais
// recente da estacao (maior abertaEm, empate pelo maior n) e 'comecar' so quando
// nao ha abertura nenhuma. Lista de arquivos igual a v55 — so o conteudo de
// core/estudo.js mudou, e e justamente o caso que a trava de hash existe para
// pegar: quem instalou o app antes veria a regra velha para sempre.
// atlas-v57: S13b comeca pelo compartido. Entra web/aulas-pedacos.js — a linha
// de progresso, o primario da aula, a nota, o href do video com list= e o
// gravar-no-clique que a FOLHA e a PAGINA DE AULAS vao usar juntas (regra 9: a
// mesma duracao nao pode ser escrita de dois jeitos em duas telas) — e as frases
// novas de core/textos.js (notaAbrir, tituloPagina, voltarPara, abrirPlaylist).
// A tela aulas.js e o aulas.css entram no proximo commit, com o precache deles.
// atlas-v58: S13b parte B. Entram web/telas/aulas.js (a pagina de aulas da
// estacao, montada pelo casco em #/estacao/<slug>/aulas) e web/telas/aulas.css.
// Os dois estao no precache: sem o css no cache, o onibus sem sinal abriria a
// lista de 93 aulas sem uma linha de estilo aplicada. Mudou conteudo do
// precache, entao VERSAO e hash.
// atlas-v59: o CONTEUDO das aulas (04/11/2026, o Claude, no discovery do desenho
// v3). Os 35 arquivos de data/aulas/ mudaram de bytes: o titulo de cada aula sai
// limpo do nome da estacao, de codigo de disciplina, de "Aula 01 -" e de "| curso"
// (core/aulas.js, tituloDaAula), e as aulas de exercicio passam a contar "lista N"
// e "questao N". Entra data/competencias.json, as 35 frases de competencia do
// livro de selos (S17), cada uma com a fonte de onde saiu. Sem subir a VERSAO,
// quem tem v58 no cache continua vendo "[CIRCUITOS DIGITAIS] Aula 01 - ..." na
// pagina de aulas.
// atlas-v60: S13c, o FIO das aulas na folha (04/11/2026). web/metro.js passou a
// chamar web/aulas-dados.js na rota da estacao (cache por slug, a guarda da
// estacao que mudou durante a busca, o repaint de 100 ms) e a entregar
// aulas/estudo ao desenharFolha; web/aulas-pedacos.js ganhou a volta por
// visibilitychange e o redirect pelo location do window; web/telas/aulas.js
// recebe o buscarAulas por deps. Mudou conteudo do precache (os tres estao na
// lista), entao VERSAO e hash. Sem isto, quem tem v59 no cache recebe o
// index.html novo com o metro.js velho na folha: a estacao abre sem o painel de
// aulas e o clique nao grava nada.
// atlas-v61: o ACABAMENTO da S13c (04/11/2026), julgado no Chrome em 375 e
// 1280 px. web/folha.css: o primario e o secundario de aula passam a
// .botao.botao-primario / .botao.botao-secundario (duas classes), porque o
// metro.css carrega depois e o .botao dele, empatado em especificidade, os
// deixava caixa clara; entra a.botao com text-decoration: none,
// display: inline-flex e align-items: center, porque o link de aula nao pode
// parecer texto. web/telas/aulas.css: box-sizing: border-box no .aulas (sem
// ele, width 100% mais padding da 407 px numa tela de 375 e a pagina passa da
// borda com a duracao cortada), sai o repeat(2, ...) da lista no computador (o
// titulo encolhia a zero e "Nao iniciada" se desenhava por cima dele), a linha
// vira auto auto minmax(0, 1fr) auto com a marca do estado de 16 px na --cor da
// linha, o nome do estado em .so-leitor e o titulo com clamp de duas linhas; o
// anel "voce esta aqui" passa a ser box-shadow na marca, no lugar da barra de
// 6 px. web/telas/aulas.js escreve aria-current="step" (o pedido dizia step; a
// tela e o teste estavam em true). core/textos.js ganha a etiqueta Exercício e
// web/tokens.css o --largura-leitura: 720px. Mudou conteudo de cinco folhas do
// precache, entao VERSAO e hash. Sem isto, quem tem v60 no cache continua com o
// botao caixa clara, a lista de duas colunas e a pagina vazando da borda.
// atlas-v62: S13e (04/11/2026) — a pagina de aulas voltava SEM A COR DA LINHA.
// O defeito so existia no navegador: .botao.botao-primario (web/folha.css:262)
// pinta com var(--cor), e --cor/--cor-fraca sao declaradas por linha (.l1 ... .l7,
// web/metro.css:17) e chegam por HERANCA. A folha mora dentro do metro e herda; a
// pagina de aulas nao esta dentro de linha nenhuma, entao o fundo resolvia vazio e
// o texto --superficie ficava sobre o fundo da pagina: 1,1:1 nos dois temas, medido
// no Chrome. Pela mesma via a barra de progresso enchia de preto e as marcas de
// estado saiam na cor do texto. web/telas/aulas.js le a linha do mesmo lugar que a
// folha (fatosDaEstacao, core/viagem.js) e poe a classe lN na raiz; o topo ganha o
// selo da linha que a S13b ja pedia e ficou de fora (seloLinha agora exportada de
// web/folha.js, importada e nao copiada); web/telas/aulas.css separa as aulas com
// 1px de --borda no lugar do --espessura-borda-painel de 6px, que em 93 linhas
// pesava mais que os titulos. Mudou conteudo de tres folhas do precache
// (web/telas/aulas.js, web/telas/aulas.css, web/folha.js), entao VERSAO e hash.
// Sem isto, quem tem v61 no cache continua com o botao da aula SEM COR NENHUMA na
// pagina de aulas, e o selo nao aparece: tela ilegivel e nenhuma suíte vermelha.
// atlas-v63: S14a (04/11/2026) — a aula ESTUDADA e os CARTOES, o nucleo sem tela.
// E o coracao do desenho v3 (design/v3/00-desenho.md, "J2 - Estudar uma aula"): a
// aula so conta para a estacao quando a pessoa fecha com recordacao sem olhar e
// escreve ao menos um cartao. core/estudo.js ganha 'estudada' na escada,
// estudarAula (o estudadaEm da primeira vez nao se reescreve, como o abertaEm), e
// continuarDe deixa de apontar para uma aula ja fechada: a retomada e a aberta
// ainda nao estudada, depois o primeiro buraco A FRENTE da fronteira, e so no fim
// o motivo novo 'estacao-percorrida'. resumoDaEstacao passa a somar no restante as
// aulas NAO ESTUDADAS — abrir um video nao descontava nada, e a folha dizia
// "faltam ~30 h" enquanto ninguem tinha aprendido nada. Entra core/cartoes.js
// (lerCartoes, criarCartao com frente e verso obrigatorias e o erro nomeando o
// campo, cartoesDevidos com teto de 20, devidoEm no dia seguinte LOCAL do
// calendario, fsrs: null e historico: [] prontos para a S15). core/rotas.js le
// '#/estacao/<slug>/aula/<n>' e n invalido cai na lista; core/aulas.js ganha
// pausasDaAula (marcas de 8 em 8 minutos, so em aula de 12 min ou mais, nunca a
// menos de 3 min do fim); core/textos.js ganha a secao fechamento e o nome
// 'estudada'. Quatro folhas do precache mudaram de bytes (core/estudo.js,
// core/rotas.js, core/aulas.js, core/textos.js) e uma nova entrou
// (core/cartoes.js), entao VERSAO e hash. Sem subir a VERSAO, quem tem v62 no
// cache recebe a tela que chama cartoes.js de um modulo que nao esta no cache:
// JavaScript fail no boot e o app inteiro em branco no onibus.
// atlas-v64: S14b1, a PÁGINA DA AULA. Entram web/telas/aula.js (a casa de uma
// aula, montada pelo casco em #/estacao/<slug>/aula/<n>) e web/telas/aula.css.
// O fluxo mudou de destino: web/folha.js e web/telas/aulas.js passaram a apontar
// para a página em vez de abrir o YouTube direto, e web/aulas-pedacos.js ganhou
// paginaDaAula, o seloLinha (que veio da folha para quebrar o ciclo
// telas/aulas.js -> folha.js -> metro.js -> folha.js) e o filtro que só grava
// abrirAula num link que SAI do app — um toque interno não pode marcar aula como
// aberta. web/casco.js ganhou a tela 'aula', o 'n' no contexto, o anúncio
// próprio da tela e a aba Jornada marcada por baixo dela. core/textos.js ganhou a
// seção aula, fechamento.quandoTerminar, comValores.linhaComEstacao e a nota
// nova do primário; core/aulas.js ganhou marcaDeTempo (o "8:00" que a duração
// arredondada não sabe escrever). Seis folhas do precache mudaram de bytes e duas
// entraram: sem subir a VERSAO, quem tem v63 recebe o HTML que liga o aula.css e
// o módulo que importa core/aulas.js pedindo marcaDeTempo de um arquivo velho —
// TypeError no boot e a página em branco no ônibus.
// atlas-v65: S14b2 (commit 1), o NUCLEO do fechamento e o item 0 da pagina da
// aula. Nada de formulario ainda — ele e o commit 2, e esta fatia sao dois
// commits verdes por decisao do Claude depois de um turno bater no teto de
// rodadas com a tela meia-escrita. core/estudo.js ganha o RASCUNHO do fechamento
// (RASCUNHO_PREFIXO, chaveRascunho por aula, lerRascunho, serializarRascunho com
// teto de 2.000 por campo e 3 cartões), porque o texto que a pessoa digitou e
// ainda nao decidiu guardar precisa de um dono com versao, e nao da tela; corrige
// tambem a ordem do filtro com o teto em lerRascunho, que devolvia zero cartoes
// quando havia lixo antes de um cartao valido (pego por teste, nao por leitura).
// core/cartoes.js ganha SEGUNDOS_POR_CARTAO e minutosDaFila (20 s por cartao,
// arredondado para cima, nunca menos de 1 — "0 min" para quem acabou de escrever
// um cartao e uma promessa falsa sobre o custo de amanha) e exporta diaSeguinte.
// core/textos.js troca o VERBO da linha de progresso ("abertas" -> "estudadas":
// abrir video nao e memoria) e ganha modoCompleto, tempo, reabrir, origem e
// estudadaEm. web/aulas-pedacos.js passa a linha a contar estudadas no texto E no
// aria-valuenow, uma vez so, folha e pagina pelo mesmo pedaco. web/telas/aula.js
// e o item 0 julgado no Chrome: /aula/999 nao afirma mais "Aula 999 de 93" nem
// titulo "Aula 999 · <estacao>" — o h1 e a primeira das tres partes, a posicao só
// existe onde a aula existe, e a unica saida da pagina recebeu o sublinhado da
// casa (folha-caminho-link), que o Chrome achou desenhado como texto comum.
// Cinco folhas do precache mudaram de bytes, entao VERSAO e hash: sem subir a
// VERSAO, quem tem v64 no cache recebe a tela do commit 2 chamando lerRascunho de
// um modulo que nao tem lerRascunho — TypeError no boot e a pagina em branco no
// onibus.
// atlas-v66: S14b2 (commit 2), o FORMULARIO do fechamento — o gesto que define o
// Atlas. web/telas/aula.js ganha o blocoFechamento: os tres passos do design/v3
// J2 (Sem olhar, com relogio de 2:00 no foco do campo e aviso de uma frase so
// pelo #anuncio do casco; Conferir, com o Reabrir no YouTube; Cartoes, com os
// quatro modelos POR EDITOR, porque um conjunto no alto da seção obrigaria a tela
// a adivinhar a que cartão o toque se aplica). O 'Outro cartão' cresce ate 3 e no
// teto vira frase — nunca botao morto. O modo minimo (uma frase, um cartao) troca
// por link e nao oferece 'Outro cartao' nem 'Ate 3 cartoes': a frase mentiria
// sobre a forma em tela.
// A VALIDACAO E A DO NUCLEO, nao copia da tela: cada recusa sai de criarCartao de
// verdade, inclusive o NOME do campo (teste.campo) — jogar aquilo fora e marcar a
// frente faria o erro de "sem resposta" cair no campo que ESTA preenchido. O
// texto digitado mora no rascunho do core (chave por aula, teto 2.000/3 cartoes),
// apagado no envio.
// Fechar refaz a PAGINA INTEIRA: a marca e o nome do estado no alto, o bloco de
// conclusao com os cartoes em leitura, 'Origem: Aula n · estacao', o proximo lido
// do arquivo e a conta de amanha (minutosDaFila). O mesmo bloco serve a quem abre
// uma aula ja fechada e a volta da aba com estudo feito em OUTRA aba (o fio do
// Assistir grava abertura, o visibilitychange repinta); voltar sem ter saido para
// o video nao rola nada nem rouba o foco. navigator.storage.persist() no primeiro
// cartao da vida, em silencio.
// Uma folha do precache mudou de bytes (web/telas/aula.js), entao VERSAO e hash:
// sem subir a VERSAO, quem tem v65 recebe a tela nova importando lerRascunho e
// minutosDaFila de modulos que ainda nao tem esses nomes — TypeError no boot e a
// pagina em branco no onibus.
// atlas-v67: S14c, o ACABAMENTO da pagina da aula — dois itens que o Chrome do
// Claude mediu e a suite de node nao via. (1) UM PRIMARIO POR TELA: depois de
// fechar a aula ficavam dois `.botao-primario` na pagina, o Assistir e o
// 'Proxima: Aula n'. Quem ja estudou nao esta sendo convidado a assistir de
// novo, entao o Assistir desce para `.botao-secundario` (continua na pagina e
// continua levando ao video: a aula estudada e a que mais se revisita) e o
// primario passa a ser a proxima aula; antes de estudada, o Assistir segue
// primario. A troca mora em pintarMarca, o unico lugar que sabe o estado, e por
// isso as tres portas (envio agora, reabrir ja estudada, volta da outra aba)
// herdam a mesma hierarquia sem linha repetida. (2) O SEPARADOR da casa na linha
// de apoio: 'Aberta · 20 min', como o resto da tipografia. O '·' e um no a parte,
// `aria-hidden` (quem percorre a linha nao deve ouvir 'ponto' entre duas
// palavras), e o caractere vem de aula.separador no core — regra 7, nenhum texto
// digitado na tela. O node nao alcanca os dois: nao pinta cascata nem mede peso
// visual, entao as travas cobrem as CLASSES no DOM montado (um unico
// .botao-primario, e ele o .fechamento-proxima; o texto da linha com o
// separador do core) e o CSS dos dois primarios de volta e a ausencia do
// separador cairem, cada uma com a mensagem medida.
// Duas folhas do precache mudaram de bytes (core/textos.js e
// web/telas/aula.js), entao VERSAO e hash: sem subir a VERSAO, quem tem v66 no
// cache recebe a tela pedindo aula.separador de um modulo que nao tem
// aula.separador — undefined no meio da linha de apoio e a frase quebrada no
// onibus.
// atlas-v68: S20a, o topo novo da Jornada (J1 primeira visita e J5 a volta).
// Entra web/telas/jornada-topo.js no precache e mudam de bytes core/textos.js
// (a secao jornada.topo), core/mapa-rede.js (o rotulo acessivel opcional, que
// na primeira visita diz nenhuma estudada ainda em vez de zero de trinta e
// cinco), web/telas/jornada.css (as classes do topo) e web/metro.js. Sem o
// precache, o topo perde o mapa no onibus: a rede desenhada e um arquivo.
// atlas-v69: S20a-fix, o FIO das aulas na folha (04/11/2026). web/metro.js: o
// pedido de aulas da folha acontecia DENTRO do pintar, depois do desenho, e com
// o cache cheio pelo topo devolvia sem repintar — a folha nascia sem o primario
// da aula nem a regua em qualquer aparelho. Muda tambem a leitura do topo (sem
// await no boot, para nao prender a subida atras da rede) e o teste do fio.
// atlas-v70: S20a-2, os tres defeitos do OLHO na Jornada (04/11/2026), com a
// suite verde. web/metro.js declara na raiz QUEM tem o recheio (com-topo-primario)
// porque a .placa-acao sai cheia do metro.css sem trazer a classe botao-primario:
// a regua contava um primario e o Chrome contava dois. web/telas/jornada-topo.js
// passa a desenhar o mapa em FAIXA (640x240) em vez do quadrado 4:3 do cartao do
// link, que na coluna 1fr do computador media ~642 de altura em 1280 (o primario
// abaixo da dobra) e ~1122 em 1920 (o vao de 870). web/telas/jornada.css cede a
// placa nos dois estados. Sem subir a VERSAO, quem tem v69 no cache continua com
// o mapa quadrado e o segundo botao cheio, mesmo com o HTML novo.
// atlas-v71: S20a-3 — três casos no topo da Jornada (a volta com aula, a volta
// sem aula, a primeira visita), a regra da estação CONCLUÍDA no continuarDe, e a
// placa da Jornada passando a dizer «Ver a estação» em vez de disputar o
// «Começar a estudar» com o primário do topo.
// atlas-v72: S15a (04/11/2026) — entra core/fsrs.js no precache (o FSRS-6 do
// cartão) e mudam de bytes core/cartoes.js (revisarCartao, resumoDaSessao,
// diaDepois), core/revisao.js (migrarRevisoesAntigas) e core/textos.js
// (revisar.frenteMigrada). cartoes.js IMPORTA fsrs.js: sem o módulo novo no
// cache, responder a um cartão offline não agenda nada, e a frase «o seu cartão
// volta amanhã» quebra justamente onde ela importa. Sem subir a VERSAO, quem tem
// v71 recebe o cartoes.js novo chamando um módulo que não está no cache dele.
// atlas-v73: S15b (04/11/2026) — a aba Revisar passou da revisão por ESTAÇÃO para
// a fila de CARTÕES escritos no fechamento. Entram no precache o módulo novo
// web/telas/revisar-fila.js (os quatro desenhos, pela regra 15: revisar.js tinha
// 504 linhas) e, de bytes, web/telas/revisar.js, web/telas/revisar.css,
// core/cartoes.js e core/textos.js. Sem subir a VERSAO, quem tem v72 recebe o
// revisar.js novo importando um módulo que não está no cache dele: a aba abre em
// branco, offline ou online.
// atlas-v74: S15b-fix (04/11/2026) — os cinco defeitos de TELA que 780/780 e o
// Chrome não viam no a41b467. No ramo `visto` saem o convite («Tente lembrar
// antes de ver.» com a resposta já na tela) e o grupo de confiança (escolher
// «certeza» depois de ler o verso não é confiança, é chute, e entraria no dado
// que o FSRS usa para agendar); cada gesto devolve o foco ao conteúdo novo, e
// sem isso a cada cartão o foco caía no body e quem usa Tab refazia o topo
// inteiro; a confiança vira grade de três colunas com borda de 1px (três barras
// de 6px pesavam mais que a pergunta), Errei/Lembrei em grade de duas colunas
// iguais (dois botões do mesmo peso saíam de larguras diferentes), o segundo
// anel de foco da tela sai — base.css já pinta o da casa, e ali era outra cor
// sem motivo; `a.revisar-primario` ganha box-sizing border-box (media 70px contra
// 46px do botão: o --alvo-toque era content box num <a>) e as frases do bloco
// revisar flexionam («1 cartão», «1 revisado, 0 lembrados»). Mudam de bytes:
// web/telas/revisar-fila.js, web/telas/revisar.js, web/telas/revisar.css e
// core/textos.js — os quatro no precache. Sem subir a VERSAO, quem tem v73 no
// cache continua com o convite contraditório, o foco no body e as três barras de
// 6px, com o HTML novo por cima.
// atlas-v75: S16a (04/11/2026) — entra core/eixos.js no precache, o núcleo dos
// DOIS EIXOS de uma estação: o PREENCHIMENTO do que foi estudado (estado 'estudada'
// de core/estudo.js) e a COR do que foi lembrado depois (um 'lembrei' do histórico
// do cartão dado num dia DEPOIS de ele nascer — o 'lembrei' do mesmo dia é memória
// de curto prazo e não pinta). Estágio novo 'concluida-antes': enche o mapa, não
// colore, porque ali ninguém foi medido. O tempo nunca rebaixa nada: só o
// pedeRevisao olha o hoje. Nenhum arquivo de tela mudou — a S16b desenha o mapa.
// atlas-v76: S16b (04/11/2026) — o mapa de DOIS EIXOS vira desenho em
// core/mapa-rede.js, que passa a aceitar `eixos` (um Map de id para o resultado
// de core/eixos.js) e desenha dentro do círculo da estação: o PREENCHIMENTO sobe
// de baixo para cima, cortado por um clipPath do próprio círculo, com a COR
// interpolada do tom claro da linha (cor 0) à cor cheia dela (cor >= 0,8) — só
// com os tokens --linha-N e --fundo, nunca uma cor nova. Anel fino por fora só
// com pedeRevisao. O estágio 'embarcada' (abriu, não estudou) não preenche: abre
// com contorno mais forte, no traço da linha, porque abrir não é estudar. O
// MINIMO_VISIVEL de 15% do diâmetro existe por medida: Circuitos Digitais, 93
// aulas com 3 estudadas, dá preenchimento 0,032 — menos de 1 px num círculo de
// 28 px, e a pessoa estudaria sem o mapa mudar. SEM eixos, a saída é byte a byte
// a de antes (trava em tests/mapa-eixos.test.js, com a string e os cinco hashes
// gravados ANTES da mudança): o cartão do link e o og:image não mudam um pixel.
// O aria-label passa a contar os estágios, com as frases em core/textos.js e o
// plural da S15b-fix. Ninguém passa eixos ainda — quem os dá é a S16c. Mudam de
// bytes e estão no precache: core/mapa-rede.js e core/textos.js.
// atlas-v77: S16c (04/11/2026) — os dois eixos chegam à tela. Entram no
// offline core/eixos.js (S16a) e core/mapa-rede.js com `eixos` (S16b); saem
// trocados web/metro.js (o fio que entrega estudo+índice+cartões ao desenho),
// web/telas/jornada-topo.js (mapa medido, legenda, linha da fila do dia),
// web/folha.js e web/telas/revisar.css (as duas linhas da estação; o anel que
// marca o texto focado sem fingir campo). Sem isto, o aparelho antigo continua
// desenhando o mapa declarado — cor de estação sem medição por trás.
// atlas-v78: S16c-fix (04/11/2026) — tres defeitos que o OLHO viu no SVG
// ampliado e nenhuma regua media. (1) O preenchimento caia debaixo do traco do
// circulo: raio 11,4 com traco de 4,4 centrado na borda deixa um miolo de 9,2, e
// a estacao de 3 de 93 aulas parecia VAZIA nos dois temas. Recorte, retangulo e
// MINIMO_VISIVEL passam a ser do miolo, e o minimo sobe de 15% para 30%. (2) A
// trancada usava opacity no grupo, e o trilho de tras aparecia dentro do circulo;
// agora so o traco e translucido, com o miolo opaco. (3) «3 de 93 aulas
// estudadas» saia duas vezes na folha, uma em cima da outra: a contagem vive so na
// linha da barra, que passa a dizer tambem as lembradas. Mudam de bytes e estao no
// precache: core/mapa-rede.js, core/textos.js, web/folha.js, web/aulas-pedacos.js.
// atlas-v79: S18a (05/11/2026) — o "Já sei isso", o estado PULADA, quem já sabe
// uma parte da disciplina poder dizer isso sem fingir que estudou. core/estudo.js
// ganha pularAula/desfazerPulo, 'pulada' entra em ESTADOS_DA_AULA e o continuarDe
// para de oferecer o que a pessoa dispensou. Pulada NÃO é medida: não cria cartão,
// não conta no preenchimento nem na cor (core/eixos.js só a lê para o estágio, e
// uma estação toda pulada é 'percorrida' com preenchimento zero — o mapa não finge).
// A régua da estação PERCORRIDA (todas estudadas OU puladas) chega ao topo:
// quem fecha a última aula de uma estação sem carimbar o completed recebia
// «Continuar: Aula 93» de uma aula já estudada, e a percorrida agora se comporta
// como a concluída da S20a-3 — o topo aponta a primeira aula da próxima estação,
// e o núcleo obedece pela mesma porta do opcoes.proxima. Ninguém escreve no
// progresso: quem marca é a pessoa. web/metro.js passa o ui.indice ao alvoDoTopo,
// sem o qual a régua não tem total de aula nenhuma e a regra existe só no teste.
// O botão nasce em web/aulas-pedacos.js (acaoPularAula + ligarPuloDeAula), peça
// compartilhada da página da aula e da lista, discreto, nunca primário, e a tela
// se redesenha no clique sem recarregar. Muda de bytes e está no precache:
// core/estudo.js, core/eixos.js, core/textos.js, web/metro.js,
// web/telas/jornada-topo.js, web/folha.js, web/aulas-pedacos.js,
// web/telas/aula.js, web/telas/aula.css, web/telas/aulas.js, web/telas/aulas.css.
// atlas-v80: S18a-fix (05/11/2026) — o que só o OLHO em 375 px viu, na página de
// aulas. (1) O título de uma aula saía CORTADO com reticências, três aulas
// diferentes com o mesmo nome na tela e a pessoa sem como saber quais eram: o
// clamp de duas linhas era régua da FOLHA, não da LISTA, e cai na lista. Abaixo
// de --bp-celular a linha vira uma coluna só — título inteiro, duração e botão na
// linha de baixo. (2) O "Já sei isso" era 93 caixas de 1px numa coluna e media
// 343 px debaixo do Assistir: vira TEXTO discreto (sem borda, sem fundo,
// sublinhado no hover e no :focus-visible), com a caixa invisível de --alvo-toque
// ainda mandando no toque. Mudam de bytes e estão no precache (lidos de
// git diff --cached --stat, não da memória): web/telas/aulas.css,
// web/aulas-pedacos.js, web/telas/jornada-topo.js, core/estudo.js,
// core/eixos.js, core/textos.js.
// atlas-v81: S18a-fix-4 (05/11/2026) — dois acertos pequenos na LISTA de aulas,
// vistos nas capturas da v80. (1) A aula PULADA não tinha marca própria: a linha
// desenhava o mesmo círculo vazio da não-iniciada e o estado existia só no texto
// lido pela tecnologia assistiva. Ganha `.aula-marca-pulada { border-style:
// dashed }` — o mesmo anel na --cor da linha, traço em vez de cor nova, valendo
// para a lista e para a página porque as duas montam `aula-marca-<estado>`.
// (2) Em 375 px a duração caia embaixo DO ANEL (grid-column: 1 / -1), longe do
// título que ela descreve; agora vai à coluna 3, a coluna do título. Muda de
// bytes e está no precache: web/telas/aulas.css.
// atlas-v82: S18b-1 (05/11/2026) — o DESAFIO da estação sem tela (desenho J4).
// Entra core/desafio.js no precache, com o núcleo puro das três perguntas: quem
// pode desafiar (estação percorrida + todo exercício estudado + cartão elegível
// por exercício + piso de 10), por que ainda não (as quatro frases em
// core/textos.js, seção desafio — que também muda de bytes) e quais cartões
// entram no sorteio (10 a 15, um de cada aula de exercício primeiro, PRNG próprio
// plantado pela semente: sem Math.random, porque um sorteio que muda a cada
// render troca os cartões debaixo dos olhos de quem responde). Nada é inventado:
// as aulas de exercício são vídeo, então o desafio usa só os cartões da pessoa
// (regra 7). Nenhum módulo do app importa desafio.js ainda — a tela é a próxima
// fatia — mas ele entra agora pelo mesmo motivo do viagem.js: o precache cobre o
// disco, e um módulo fora do cache é a tela em branco no ônibus. Mudam de bytes e
// estão no precache: core/desafio.js (novo) e core/textos.js.
// atlas-v83: S18b-2 (05/11/2026) — corrigir o desafio, a estação DOMINADA e a frase
// do que foi medido, ainda sem tela. Fecha a volta do J4 em core/desafio.js:
// `corrigirDesafio` (o denominador é o sorteio, o corte é 0,8 — 8 de 10 aprueba e
// 7 de 10 não), `aplicarResultado` (aprovado escreve `progresso.dominadas[estacao]`
// = {em, acertos, total, lembrados, aulas, cartoes}, que é o que a S17 lê; reprovado
// põe `devidoEm = hoje` só nos errados, e nada rebaixa: o tempo nunca rebaixa, e só
// um reprovado DEPOIS de dominada devolve para percorrida) e `fraseDaDominada` (em
// core/textos.js: «Percorreu as 93 aulas... lembrou 12 de 14 deles, pela sua própria
// conferência. Não mede exercícios novos.» — substitui a frase de competência, que
// afirmava um saber-fazer que ninguém mediu). 'dominada' entra em ESTAGIOS_DO_EIXO e
// na escada de eixosDaEstacao, e `progresso.dominadas` é campo NOVO do formato:
// lerProgresso, salvarViagem, carregarViagem e o perfil remontam o progresso campo a
// campo, e o que não entra na lista se perde em silêncio — o carimbo sumiria sem
// erro nenhum. A trava do round-trip está em tests/desafio.test.js. Mudam de bytes e
// estão no precache: core/desafio.js, core/textos.js, core/eixos.js, core/viagem.js,
// web/metro.js, web/telas/perfil.js.
// atlas-v84: S20b-1a (05/11/2026) — três consertos pequenos, cada um com a sua
// trava. (1) O SELO QUE MENTIA: `web/folha.js` escrevia `F.estadoNome[f.estado]`
// na etiqueta de texto, que responde «a malha me deixa entrar?» num lugar onde a
// pessoa pergunta «onde eu estou?» — uma estação com 3 de 93 aulas estudadas saía
// «DISPONÍVEL» logo acima da linha que media as três. O texto passa a ser o
// estágio de `eixosDaEstacao` pela escada de `mapa.estagioNaFolha` (core/textos.js),
// com a primeira letra maiúscula; a trancada continua «Trancada» (sem liberação não
// há estágio a medir) e 'fora' diz «Disponível» — com `emCurso` na malha diz «Em
// curso», que é a mesma mentira do lado oposto. A FORMA (a classe `folha-estado
// <estado>`, que pinta o anel) não muda, e o círculo da linha não é tocado. A conta
// do estágio é feita UMA vez em `desenharFolha` e emprestada ao `blocoEixos`, que
// antes a refazia. (2) A DURAÇÃO PARTIDA: «faltam ~29 h 23 min» quebrou entre o 29
// e o h em 375 px; `faltaFazer` troca os espaços da duração por U+00A0 (o espaço
// ANTES do «faltam» continua comum — é ali que a linha pode quebrar), e a regra sai
// como `inseparavel`/`NBSP` para os testes formarem o esperado sem escrever o byte à
// mão. Consequência medida: os literais de seis arquivos de teste, e o `textoDo` de
// três mini-DOMs, que colapsavam com `\s+` e comiam o U+00A0. (3) OS ALVOS NUS: o
// link `primario` (perfil.js:237/:329), o botão `secundario` (:118), o rótulo
// `perfil-dados-importar-texto` e o `.explorar-link` (explorar.js:54) não tinham
// regra nenhuma nas folhas das telas e chegavam com a altura de uma linha de letra.
// Ganham `min-height: var(--alvo-toque)` + o padding que faltava, escopados, sem
// mudar a letra e sem virar botão. Mudam de bytes e estão no precache:
// core/textos.js, web/folha.js, web/telas/perfil.css, web/telas/explorar.css.
// atlas-v85: S20b-1b (05/11/2026) — o BACKUP leva a viagem inteira, e o alvo de
// importar. (1) O FORMATO 3: a versão 2 parava na viagem. Quem exportava no
// celular e importava no PC levava os 35 carimbos e PERDIA cada aula aberta, cada
// aula estudada, cada cartão escrito e cada rascunho pela metade — o mapa, sem o
// percurso. `buildExport` passa a levar quatro baldes (estudo, cartões, rascunhos,
// dominadas) e `parseImport` devolve cada um como TEXTO CANONICO do módulo dono,
// lido por `lerEstudo`/`lerCartoes`/`lerRascunho` e resserializado na volta, o que
// faz «exportar → importar → exportar» dar os mesmos bytes (a trava do round-trip
// byte a byte é esta). (2) O QUE O ARQUIVO NÃO DIZ NÃO APAGA: ausência é `null`, e
// `null` é «mantém o que este aparelho tem». Um arquivo de ontem, que não conhece
// cartões, importava apagando a fila de hoje — o bug que a S8 deixou com as
// anotações, agora com os cartões no lugar; a malha é por campo (um registro ruim
// derruba o registro, nunca o balde) e a frase diz em voz alta o que ficou. (3) O
// ALVO: o que media menos de 24 px em 375 e 768 px, abaixo de «Importar uma
// viagem», era o `<input type=file>` — o widget nativo, que não é `<a>` nem
// `<button>` e por isso não passou pela varredura da v84. `.perfil-dados-input`
// ganha `min-height: var(--alvo-toque)`; a letra é a mesma (--tipo-nota) e o input
// continua sem fundo: caixa, não hierarquia. O persist de `web/telas/aula.js:523`
// não foi tocado — o que entra é a trava que prova que ele é chamado uma vez só e
// nunca antes do primeiro cartão. Mudam de bytes e estão no precache:
// core/progress-io.js, core/dados-pessoa.js, web/telas/perfil.js, web/telas/perfil.css.
// atlas-v86: S20b-2 (05/11/2026) — OS TEXTOS DECIDIDOS, e o texto morto. (1) A nota da
// placa dizia o que o toque NÃO faz («Abrir não muda sua viagem»); agora diz o ciclo
// inteiro: «Estudar uma aula enche a estação. Lembrar dela depois dá a cor.» — e a nota
// de «Em curso» acompanha: «com aula aberta», no lugar de repetir a permissão. (2) O
// número nu: `valorEmCurso` saía com padStart e mostrava «00» ao lado de «0/35» — dois
// zeros, e só um deles é honesto; agora é «0». (3) O selo de rede dizia «offline» e a
// descrição fechava com «sem conexão», e a frase montada por web/rede.js repetia o
// problema duas vezes: agora «Sem conexão · Tudo aqui continua funcionando.» diz uma
// vez só. (4) A medida do topo encolheu o objeto («Estude uma»): «Estude uma aula,
// lembre dela amanhã e o mapa acende». (5) «A REDE INTEIRA» virou «A rede inteira»: a
// caixa alta é do CSS (web/telas/explorar.css:11, text-transform), e o leitor de tela
// soletra a caixa alta ESCRITA. (6) MORREU estados.primeiraVisita: o quadro «Bem-vindo
// ao embarque» saiu da tela na S20a e nenhum arquivo em web/ ou core/ lia a chave; a
// lista de obrigatórios de tests/design-system.test.js era a única leitora e passou a
// sete, com a citação da régua 9 em design/README.md acompanhando o título.
// jornada.abertura FICOU: web/telas/jornada-blocos.js ainda lê as cinco chaves e
// tests/metro.test.js confere primeiraVisita nelas — o que ficou órfão na S20a foi o
// import de `abertura` em metro.js, não o texto, e apagar texto que uma tela ainda
// desenha não é limpar morto. Muda de bytes e está no precache: core/textos.js.
// atlas-v87: S20b-3 (05/11/2026) — AS FRASES DECIDIDAS, O VAO DE 1920 E O README. (1) Nove
// frases de core/textos.js trocadas pela palavra que o Lucas ditou: o teto da confianca
// («Quanta certeza você tem?»), o metodo da revisao, o rotulo da fila («Revisão de hoje»), o
// rotulo do momento («Estação concluída», e nao «Conexão criada»: a palavra é da estação), o
// titulo da lista de pre-requisitos («Para chegar aqui, faça antes:»), a legenda dos dois eixos
// («Preenchimento: o que você estudou...»), a nota do esqueleto, o selo «Em obras» — que agora
// é frase, nao caixa alta digitada, porque o .explorar-selo do css ja faz a caixa alta — e o
// aviso de que o aparelho nao guardou o import. (2) O vao de ~870 px à direita do mapa em 1920:
// escolhi o mapa CRESCER ate a largura da coluna, e nao dobrar o topo em duas colunas. Por que:
// a ordem da J1 — mapa, titulo, medida, acao — é a ordem do DOM e a do leitor de tela, e
// biforca-la so acima de 1440 deixaria o celular com um fluxo que so o desktop inventou; e a
// geometria que a conta da dobra ja usa é coluna × propor, que continua valendo. O que segurava
// o quadro na largura do desenho era o piso automatico de um item de grid com filho de tamanho
// intrinseco: width: 100% e min-width: 0 no quadro, height: auto no svg, e a altura continua
// presa à faixa 8:3. A trava em tests/auditoria-tamanhos.test.js confere as tres declaracoes, e
// a conta da dobra continua passando em 1280x800. (3) O README descreve o que o Atlas faz HOJE:
// as aulas, o «Já sei isso», o fechamento com recordacao, os cartoes, a revisao espacada, o mapa
// de dois eixos e o backup. A caderneta e o desafio nao entraram: sem tela, nao se anuncia.
// (4) Caiu o import orfao de `abertura` em web/metro.js — a S20b-2 registrou que o texto ficou,
// o que nao tinha mais leitor era o import.
// Muda de bytes e está no precache: core/textos.js, web/metro.js,
// web/telas/jornada-topo.js, web/telas/jornada.css. README.md e os testes nao estao no cache.
// atlas-v88: S20b-4 (05/11/2026) — O MAPA CRESCE, A LISTA DIZ O ESTAGIO, CONTINUAR E O «EM
// CURSO» QUE CONTA. Medido no Chrome pelo Lucas em atlas-v87: quatro frases da Jornada
// contradizendo a mesma medição que a folha já fazia.
// (1) O mapa não cresceu em 1920: `section.topo` com 1.481 px e a coluna com 645. Colisão de
// classe — o `.topo` do cabeçalho fixo (web/casco.css:70) tem `justify-content: space-between`
// e o da Jornada herda: num grid de uma coluna a sobra vira vão em volta da trilha, e a trilha
// para de esticar. `grid-template-columns: minmax(0, 1fr)` e `justify-content: normal` no
// `.topo` desfazem a herança sem tocar no cabeçalho; `max-width: var(--bp-computador)` no
// `.topo-mapa` põe a diferença como respiro, não como o vão. A conta da dobra continua
// passando em 1280x800, e a trava de auditoria passou a conferir as três declarações.
// (2) A lista dizia «disponível» para quem estudou 3 de 93: a etiqueta era a palavra da
// liberação (`ESTADO_LEGIVEL[e.estado]`), lida da malha, enquanto a folha, dois centímetros
// abaixo, dizia «Em percurso» pelo estágio medido. Passou por `estadoDaLista`, a mesma regra
// da folha (`estagioNaFolha` sobre o estágio de `eixosDaRede`), com a trancada mandando na
// malha e sem medida devolvendo a palavra de antes. A prova pelo contrário foi colada:
// voltando a ler `ESTADO_LEGIVEL`, caem «3 estudadas dizem Em percurso» e «a lista diz a
// MESMA palavra da folha».
// (3) O topo dizia «Começar: Circuitos Digitais · Aula 4» a quem já tinha 3 aulas ali. No modo
// `proxima`, com aula estudada medida por `eixosDaRede`, o verbo passa a `continuarEstacao`,
// criada em core/textos.js ao lado de `comecarEstacao` e com o mesmo `n` do núcleo. Sem
// índice, o verbo volta a ser «Começar»: não se afirma o que não se mediu.
// (4) «Em curso 0, com aula aberta» era falso: `n.emCurso` lê o campo antigo do progresso v3,
// que ninguém escreve desde que a aula virou o gesto. Passa a somar os estágios `embarcada` +
// `em-percurso` de `contarEstagios` sobre a medição única da pintura; sem índice, fica o
// número antigo — «não sei» mostra a conta velha, não mostra zero.
// Muda de bytes e está no precache: core/textos.js, web/metro.js,
// web/telas/jornada-topo.js, web/telas/jornada.css. tests/jornada-medida.test.js (novo),
// tests/auditoria-tamanhos.test.js e package.json nao estao no cache.
// atlas-v89: S17a-1 (05/11/2026) — A CADERNETA, só o núcleo da série do percurso,
// sem tela. O Perfil tinha um bilhete carimbado pela conclusão DECLARADA; o princípio
// 4 do desenho troca isso por oito carimbos que nascem de critério MEDIDO, com os
// espaços vazios à vista. Entra core/caderneta.js no precache (modulo novo, importado
// por tela nenhuma ainda — o mesmo motivo do viagem.js: o precache cobre o disco) e
// mudam de bytes core/textos.js (o bloco caderneta com todas as frases, mais as duas
// regras da lista do proibido: número de dias e palavra de sequência) e este sw.js.
// A frase da baldeação perdeu a palavra «primeira»: a trava 10 da série a pegou.
// Sem subir a VERSAO, quem tem v88 no cache recebe um core/textos.js novo sem a
// caderneta ao lado: a tela que amanhã importar o módulo abre em branco no onibus.
// atlas-v90: S17a-2 (06/11/2026) — O RESTO DO NÚCLEO da caderneta, ainda sem tela.
// Ao lado da série do percurso entram as outras três peças do desenho (§A gamificação):
// `caderneta()` devolve {percurso, dominio, recordes, proxima}. O domínio tem uma
// carimbo por estação da grade — o total é CONTADO dela, não escrito à mão — mais um fim
// de linha por linha e o terminal, 43 com a grade atual. A frase da estação dominada é
// `fraseDaDominada` (core/desafio.js), a que repete os números medidos no desafio;
// `data/competencias.json` fica FORA do carimbo, porque descreve a ementa e não o que a
// pessoa fez nela. A «concluída antes» fica VAZIA no domínio, com a marca e a data antiga
// em campo separado: dar-lhe o carimbo de domínio é o bilhete declarado reentrando pela
// porta da série nova. Os recordes são dois e nenhum de sequência (princípios 4 e 5):
// mais cartões lembrados numa semana de calendário, contando só a primeira tentativa do
// dia, e a maior estabilidade de um cartão. A próxima vem de `resumoDaViagem` — a MESMA
// conta da placa — e «que você já dominou» só sai de pré-requisito com carimbo em
// `dominadas`, nunca de declaração. Mudam de bytes core/caderneta.js (já no precache
// desde v89), core/textos.js (as frases das três séries) e este sw.js.
// atlas-v91: S17b (06/11/2026) — A TELA da caderneta no Perfil, com os espaços
// vazios a vista. O nucleo das duas series ja estava commitado (v89, v90); este e o
// primeiro carimbo que alguem ve. O Perfil perdes os marcos da S9 (o bilhete
// carimbado pela conclusao DECLARADA) e ganha "Serie do percurso" (8) e "Serie do
// dominio" (43, agrupados em 7 fileiras por linha com o fim de linha no fim, mais o
// terminal depois de todas), os recordes e a proxima coisa. Todo carimbo mostra o
// CRITERIO ("Abre quando: ...") nos dois estados: no ganho ele diz o que foi medido,
// no vazio ele diz o que falta — esconder o vazio seria o bilhete de volta. A
// "concluida antes" aparece com a MARCA e a data antiga, sem frase de medida. O
// carimbo novo desde a ultima visita ao Perfil desce UMA vez (200-340ms pela voz
// organica do design system; prefers-reduced-motion aparece sem movimento; nada de
// particula). Mudam de bytes web/telas/perfil.js, web/telas/perfil.css,
// core/textos.js (as frases da tela, no bloco caderneta) e este sw.js.
// Sem subir a VERSAO, quem tem v90 no cache recebe o perfil.js novo chamando
// cadernetaNucleo com um core/textos.js sem o bloco tela: a tela abre em branco no
// onibus — o mesmo motivo de v89, agora com a tela existente.
// atlas-v92: S17b-fix (06/11/2026) — QUATRO consertos do Perfil, medidos no Chrome
// sobre a v91. (1) O Perfil inteiro cabia numa faixa de 360 px porque
// `.perfil { max-width: var(--largura-lateral) }` — um token emprestado da coluna
// DIREITA da Jornada, não uma largura de leitura. De 1024 para cima o teto passa a
// ser --bp-computador, o bilhete de 5 casas vira repeat(5, minmax(0,1fr)) (o piso
// automatico de 1fr e o maior nome de estacao, e em 1280 a fileira saia do proprio
// cartao) e as duas series ficam lado a lado. (2) A Serie do dominio tinha 7.800 px
// porque os 35 espacos repetiam a MESMA regua: ela sobe para o alto da secao, uma
// vez, e o vazio fica com o contorno e o nome numa grade compacta — o criterio
// continua no aria-label de cada celula, porque forma sem nome e ausencia que so
// quem enxerga percebe. (3) "Revisoes feitas" dizia 0 para quem revisou 7 cartoes:
// contava so o calendario do sistema antigo. Passa a somar o historico dos cartoes
// (revisoesRealizadas, em core/dados-pessoa.js). (4) O link da proxima media menos
// de 24 px em 375 e 768; ganhou min-height no alvo de toque, caixa e nao pintura.
// Mudam de bytes web/telas/perfil.css, web/telas/perfil.js, web/tokens.css
// (--celula-caderneta), core/dados-pessoa.js, core/textos.js (caderneta.tela
// .semCarimbo) e este sw.js.
// atlas-v92 -> atlas-v93: S20b-5, a margem do Explorar, medida pelo Lucas no Chrome
// com a v92 (06/11/2026). (1) Em 375 e em 1280 o texto encostava na borda da tela a
// 0 px -- "A rede inteira", o titulo, a descricao e as linhas. A causa era a raiz da
// propria tela: `padding: var(--espaco-4) 0`, o segundo valor do shorthand sendo os
// lados. Quem hospeda a tela e main (casco.css:84, `flex: 1 1 0; min-height: 0;
// overflow-y: auto`), e main nao tem recheio lateral nenhum: nao havia nada em pe
// entre o texto e a janela. O recheio passa a ser da raiz, nos quatro lados, e de
// 1024 para cima a coluna ganha teto (--bp-computador) e fica centrada, a mesma lei
// do Perfil (v92) e do topo da Jornada -- sem teto, a lista de 35 linhas atravessa a
// janela e a descricao de 62ch fica sozinha no branco. (2) Em 375 a fileira de
// filtros quebrava mal: "Buscar estacao" ao LADO do campo (os dois cabiam na linha)
// e "Linha" no canto oposto do seletor dela. O DOM e chato por construcao
// (explorar.js:116), entao o pareamento vem da ordem e da largura toda: cada rotulo
// e cada campo pedem a linha inteira no @media de 599, sem mover HTML, sem esconder
// rotulo e sem tocar no piso de toque da S20b-1a. Mudam de bytes
// web/telas/explorar.css (o recheio, o box-sizing dos campos, o teto e a pilha do
// celular) e este sw.js.
// atlas-v94: S20b-6 (06/11/2026) — O ACABAMENTO do Perfil, medido no Chrome sobre
// a v91. Quatro elementos saíam com o estilo do NAVEGADOR porque nenhuma folha dava
// regra a eles, e as travas antigas não viram nada: elas contam DOM e declarações de
// alvo, e quem não tem regra nenhuma não tem o que contar. (1) Os cartões encostavam
// na borda em 375 e em 1280: main (casco.css:84) não tem recheio lateral e esta era a
// única tela da casa sem o seu — a raiz ganha `padding: var(--espaco-4)` com
// box-sizing, e o teto da S17b-fix continua (margem e linha de leitura são folhas
// diferentes do mesmo problema, uma não compra a outra). (2) Dois links azuis:
// `.perfil-proxima-link` não tinha cor nenhuma e `.perfil-sobre-codigo` tinha
// `--linha-6`, o azul que a pessoa lia era a cor da LINHA 6 e não o padrão do
// navegador — os dois ficam em `--tinta`, com sublinhado (a única marca de link quando
// a cor não ajuda) e o anel da casa em `:focus-visible`, no token. (3) «Exportar
// viagem» e os dois «Ir para a próxima estação» vestiam as classes cruas `secundario`
// e `primario`, palavras que folha nenhuma da casa usa: agora vestem
// `botao botao-secundario` / `botao botao-primario`, o contorno que a folha dá a «Ver
// as 93 aulas», e o `--cor: var(--tinta)` entra na raiz porque `--cor` é a LINHA e sem
// linha declarada o botão da casa sai com contorno invisível. (4) O seletor de arquivo
// do sistema no meio da fileira: o input some da pintura com clip-path (a casa esconde
// assim, base.css:51) e NÃO com display:none, que o tiraria da árvore de foco e faria o
// Tab passar por cima do importar — o rótulo veste o secundário da casa e vira o botão
// que se vê, o input cobre o grupo e guarda o piso de toque, e `:focus-within` põe o
// anel no rótulo. Um primário por tela continua um. Mudam de bytes web/telas/perfil.css,
// web/telas/perfil.js, core/textos.js (o nome acessível do input, que a tela passa a
// ler de T.dados em vez de escrever ao lado) e este sw.js.
// Sem subir a VERSAO, quem tem v93 no cache recebe um perfil.js pedindo as classes da
// casa a um perfil.css velho que não as tem: os botões voltam cinza do sistema, e o
// input volta a desenhar «Escolher arquivo» na fileira.
// atlas-v95: S20b-7 (06/11/2026) — TRÊS DEFEITOS da captura de PÁGINA INTEIRA do Perfil,
// só CSS. A v94 tinha consertado o estilo dos elementos; esta conserta a GEOMETRIA, e os
// três só aparecem quando a tela é fotografada inteira, não uma janela.
// (1) Em 375 o terceiro número passava da borda. A causa é `repeat(3, 1fr)`: 1fr não é
// largura, é piso AUTOMÁTICO, e o mínimo de uma coluna 1fr é o min-content da célula —
// «6 revisões feitas» em mono --tipo-titulo não cabia nos ~104 px que sobravam. As duas
// grades (base e celular) viram `minmax(0, 1fr)` e o card ganha `padding: --espaco-2` +
// `min-width: 0`, o mesmo par que o bilhete usa desde a S17b-fix; trocar só a coluna sem
// abrir o card deixa o texto maior que a célula empurrar a grade de novo.
// (2) Na Série do domínio o círculo caía EM CIMA do nome. `.perfil-carimbo-compacto`
// veste as duas classes e herdava o `flex-direction: column` de `.perfil-carimbo`, que
// nasceu como o bloco EM PÉ do percurso; o comentário da folha dizia «lado a lado» e a
// linha que realizava não existia. Ganha `flex-direction: row`.
// (3) Em 1280 o Perfil encostava na esquerda com sobra toda à direita, enquanto o
// Explorar fica centrado. A S17b-fix trocou o teto para --bp-computador e a v94 deu
// recheio à raiz, mas teto sem centro é metade do conserto: `margin-inline: auto` no
// bloco de 1024, como .explorar-raiz faz desde a S20b-5. As páginas de aula e a Revisar
// não mudam — a coluna de leitura à esquerda nelas é decisão antiga, não defeito.
// As travas (tests/auditoria-tamanhos.test.js) perguntam por `corpo`, não por `decls`:
// o scanner divide cada declaração por ':' e descarta as que dão mais de duas partes,
// então `minmax(0, 1fr)` não existe no objeto — a mesma lei que reescreveu a régua do
// Explorar na S20b-5. Mudam de bytes web/telas/perfil.css e este sw.js.
// atlas-v96: S20b-8 (06/11/2026) — O BACKUP PERDE A DATA DE CONCLUSÃO, medido no Chrome:
// exportar e importar num aparelho novo dava `conclusoes: {"ubl-core-introducao-cc-python-i":
// "2026-09-20"}` antes e `conclusoes: {}` depois, com a estação SEGUINDO concluída. O que se
// perdia era o DIA, e é dele que a caderneta faz o carimbo (core/caderneta.js: o embarque e a
// estação percorrida lêem `conclusoes[id]`), e o bilhete do Perfil lê `Concluída em`.
// A causa é uma lista, não uma regra: a versão 3 do arquivo (S20b-1b) levou estudo, cartões,
// rascunhos e `dominadas`, e `completed` sempre veio sozinho — `emCurso` e `conclusoes` nunca
// entraram nos extras. Repetido o caminho das `dominadas`, campo a campo: o export monta os
// dois pela malha de `lerProgresso` (data fora de AAAA-MM-DD derruba o registro, nunca o
// objeto; id que não é string cai do em curso) e só os põe no pacote quando falaram — `{}` ou
// `[]` dentro do v3 é ordem de apagar no destino. O import devolve o par valor + `traz*`, com
// uma diferença deliberada das dominadas: `importarViagem` devolve O DO APARELHO quando o
// arquivo ficou calado, porque quem escreve a viagem é o `salvarViagem`, e a tela do Perfil só
// o chama se algum dos três falou — um `null` silencioso ali reescreveria a viagem sem datas.
// Campo ILEGÍVEL é mudo (`traz… false`), nunca `true` com valor vazio: ordem de apagar não pode
// nascer de um arquivo que ninguém editou para isso. `versao` do formato CONTINUA 3: o campo é
// aditivo, um v3 lido por um v3 velho ignora o que não conhece, e subir a versão cortaria quem
// ainda não atualizou — e nada disto foi publicado. Mudam de bytes core/progress-io.js,
// core/dados-pessoa.js, web/telas/perfil.js e tests/progress-io.test.js.

// atlas-v97: S18c-1 (06/11/2026) — A TELA DO DESAFIO DA ESTAÇÃO (desenho J4). O motivo de ela
// estar aqui e não só no casco: desde a S17a a caderneta promete «o desafio da estação
// aprovado» em 35 carimbos e não havia lugar para fazê-lo — a promessa era texto morto.
// Nasce web/telas/desafio.js (rota #/estacao/<slug>/desafio), o casco ganha o painel como
// o de `aulas`, core/textos.js o bloco `desafio`, e desenhaCartao em revisar-fila.js o
// sinal `semConfianca` — no desafio a confiança não é opcional, é retirada: o sorteio não
// agenda pelo FSRS e escolher «certeza» depois de ver o verso seria chute sobre o lido.
// A sessão do sorteio mora em atlas.desafio.v1 para recarregar no meio manter os cartões
// e a posição, e nenhuma palavra de acerto aparece antes do fim: o resultado é um só, no
// fim. `desafio: ''` na classe do casco de propósito — a raiz É `.revisar` e veste
// revisar.css; classe que o CSS não conhece é roupa invisível (o defeito que tirou
// `explorar` e `revisar` da lista na S8). O arquivo entra no PRECACHE com o import do
// casco no mesmo commit, senão é branco no ônibus.
// atlas-v98: S18c-2 (06/11/2026) — O DESAFIO ENTRA NO APP: a tela existia e nada apontava para
// ela, que é a forma mais silenciosa de uma feature não existir. A folha da estação ganha
// `blocoDesafio` (web/folha.js, .folha-desafio no desenho discreto do .folha-eixos-revisar), um
// elemento só por estágio: nada em `fora`, o convite em `concluida-antes`, a frase do carimbo em
// `dominada` (link algum — refazer é a única forma de perder o carimbo), e nos demais a régua
// `podeDesafiar` do NÚCLEO, com o `porque` dele quando diz não. SECUNDÁRIO de propósito: a folha
// continua com um primário só (a lei da 2d-2). No mapa (core/eixos.js), a estação dominada passa a
// ter a COR CHEIA seja qual for a conta das lembradas — o carimbo aprovado é o fato mais forte que
// há sobre aquela estação, e ele aparece como um ponto; as lembradas continuam medidas, só deixam
// de ser o veredito. Na tela, o fim sai em corpo e não em miúdo (`-frente`/`-sub`), porque é o
// momento da entrega, e o aprovado ganha o link discreto para a caderneta. `naoPercorrida`
// (core/textos.js) parou de dizer «fora»: nome interno de estágio na tela é o defeito que a
// auditoria de frases caça. Sem as aulas carregadas o bloco NÃO nasce — a casa não descreve o que
// não chegou. Mudam de bytes web/folha.js, web/folha.css, core/eixos.js, core/textos.js,
// web/telas/desafio.js e tests/desafio-tela.test.js; nenhum arquivo novo, o PRECACHE não cresce.
// atlas-v99: S18c-3 (06/11/2026) — O BECO SEM SAÍDA DO DESAFIO, medido no Chrome numa estação de
// 13 aulas estudadas com 3 cartões: a régua pede no mínimo 10, a folha dizia «escreva mais 7 ao
// fechar as aulas», e a aula JÁ fechada não tem formulário nenhum — mostra «Estudada em
// 20/10/2026» e a Próxima. Quem terminou a estação estava sendo mandado a uma porta que já
// atravessou, e não havia como voltar. web/telas/aula.js ganha em `vistaConcluida` o botão
// SECUNDÁRIO «Escrever mais um cartão», que troca a si mesmo pelo MESMO `editorCartao` do
// fechamento (`base: 'mais'`, `indice: 0`, sem copiar bloco nenhum) e grava pelo MESMO caminho:
// `criarCartao` valida, `serializarCartoes` escreve, e o foco pousa na frase de status — o fato
// acabado de escrever, não no título «Fechar a aula», que diria que algo mudou quando nada
// mudou. O primário continua sendo a Próxima. A validação saiu da closure do fechamento para
// `limparErrosEm`/`marcarErroEm`: erro desenhado de dois jeitos na mesma página é a regra 9.
// `desafio.escrevaMais` passa a dizer ONDE escrever, não quando. E o verbo da folha: uma estação
// com as 13 aulas estudadas oferecia «Continuar: Aula 13» — estudo onde a palavra da pessoa já
// foi dada; `primarioAula` ganha `percorrida` (a mesma régua do eixo, `estacaoPercorrida`, pelo
// `resumo` do painel) e diz «Rever: Aula N — …». Só vale para a aula DA ESTAÇÃO: com
// `opcoes.proxima` o núcleo devolve a primeira aula da estação seguinte, e «Rever» dela seria
// mentira — por isso `painel.resumo.percorrida && continuar.estacao == null`. O topo da Jornada
// não muda. `limparErros`/`marcarErro` do fechamento agora apontam para as formas de módulo.
// Mudam de bytes web/telas/aula.js, web/aulas-pedacos.js, web/folha.js, core/textos.js,
// tests/desafio-tela.test.js e tests/desafio.test.js; nenhum arquivo novo, o PRECACHE não cresce.
// atlas-v100: S18c-4 (06/11/2026) — A CAIXA DUPLA DO «Escrever mais um cartão», achada na captura
// da atlas-v99: o botão saía dentro de UMA SEGUNDA caixa vermelha, e o «Guardar o cartão» pendurado
// para fora dela, à esquerda. Não é defeito de espaçamento: é COLISÃO DE NOME. `web/telas/aula.js`
// vestia a caixa do editor com `fechamento-mais`, a MESMA classe do botão «Outro cartão» do
// fechamento, e a folha desenha `.aula .fechamento-mais` com `border`, `border-radius` e
// `align-self: flex-start` — um `div` de agrupamento vestido com o desenho de um `button`, e o
// `align-self` que não significa nada fora de um flex container. A caixa agora veste
// `fechamento-escrever`, e ganha em `aula.css` só `display: grid` + `gap`: sem borda, sem fundo, sem
// cor, porque o desenho é dos filhos; `justify-self: start` nos dois botões segura cada um na largura
// do próprio rótulo (num grid, o botão esticado ao meio era o «pendurado para fora»). A régua nova em
// tests/auditoria-tamanhos.test.js é a GERAL, não o caso: varre as classes literais de `no(doc, tag,
// 'classes')` em aula.js e nenhuma pode vestir duas tags diferentes se a folha a desenha com borda —
// travar só `fechamento-escrever` deixaria a próxima colisão nascer verde. Mudam de bytes
// web/telas/aula.js, web/telas/aula.css, tests/auditoria-tamanhos.test.js e
// tests/desafio-tela.test.js (a caixa procurada pela trava da S18c-3); nenhum arquivo novo, o
// PRECACHE não cresce.
// atlas-v101: S19a — a FRASE DE RECOMECO (desenho v3, J5 item 2). Em começo de semana ou
// de mês, quem já tem estudo no aparelho vê uma linha abaixo do primário dizendo que uma
// aula e as revisões de hoje já movem o mapa; nenhuma contagem de ausência, nenhum número
// de dias, e nenhum «voltou». A conta do dia é do núcleo (`fraseDeRecomeco` em
// core/viagem.js, sem fuso — regra 13 de core/cartoes.js), as palavras são de
// core/textos.js (o bloco `recomeco`), e a tela só pinta um <p class="topo-recomeco">,
// sem link, com o primário continuando um só. Mudam de bytes core/viagem.js,
// core/textos.js, web/telas/jornada-topo.js e web/telas/jornada.css — os quatro no
// precache. Sem subir a VERSAO, quem tem v100 no cache recebe um jornada-topo.js
// chamando fraseDeRecomeco de um viagem.js que não o exporta: TypeError no boot da
// Jornada e a tela em branco no ônibus.

// atlas-v102: S19b (06/11/2026) — MARCAR A PRÓXIMA SESSÃO NO CALENDÁRIO (desenho v3, J5
// item 3). No fim de cada sessão a pessoa gera um `.ics` com o dia e a hora que ela
// escolhe: o Atlas não notifica, não tem conta e não tem servidor, e quem lembra é o
// calendário dela. O texto do arquivo é de núcleo puro (core/agenda.js), o bloco é um
// link discreto que vira dois campos (web/agenda-marcar.js) e o download é o caminho
// que já existia no backup, agora extraído para baixarArquivo em core/dados-pessoa.js
// e usado nos dois lugares. Entra em web/telas/aula.js (vistaConcluida, depois do
// aviso) e em web/telas/revisar-fila.js (desenhaFim, antes de Voltar à Jornada) — o
// primário de cada tela continua um só. Estilos novos em web/base.css com os tokens da
// casa. O PRECACHE ganhou os dois módulos novos: sem subir a VERSAO, quem tem v101 no
// cache nunca receberia o convite, e um módulo fora do cache é a aula em branco no
// ônibus.
// (core/agenda.js, web/agenda-marcar.js) e quatro arquivos listados mudaram de
// bytes (core/textos.js, core/dados-pessoa.js, web/telas/aula.js,
// web/telas/revisar-fila.js, web/telas/revisar.js, web/base.css). Sem versão
// nova, quem já instalou o app nunca receberia o botão da agenda: o navegador
// compara o service worker por bytes e igual significa não instala.
const VERSAO = 'atlas-v102';

// sha256 do CONTEUDO de cada arquivo do PRECACHE, na ordem do array abaixo. O
// caminho entra no hash antes de cada arquivo: renomear sem mudar conteudo tambem
// deixa o cache antigo sem o nome novo. Recalcular: node tests/precache-hash.js.
// Recalculado ao fechar a PARTE A da S13b (04/11/2026): web/folha.js ganhou o
// bloco das aulas e core/textos.js as frases novas — os dois estao no precache,
// entao quem instalou o app antes receberia a folha SEM a linha de progresso.
// Recalculado na S13c (04/11/2026), com a arvore parada: web/metro.js (o fio),
// web/aulas-pedacos.js (a volta por visibilitychange) e web/telas/aulas.js (o
// buscarAulas por deps) mudaram de bytes. O sw.js mediu o MESMO sha256 antes e
// depois de eu subir a VERSAO acima, e isto e a prova de que sw.js nao esta na
// propria lista: quem guarda o hash nao pode estar dentro do que o hash cobre.
// Recalculado no ACABAMENTO da S13c (04/11/2026): cinco folhas do precache
// mudaram de bytes — web/folha.css (o primário recheado com duas classes e o
// link sem sublinhado), web/telas/aulas.css (uma coluna, box-sizing, a marca de
// 16 px), web/telas/aulas.js (a linha com marca + estado em .so-leitor),
// core/textos.js (a etiqueta "Exercício") e web/tokens.css (--largura-leitura).
// Sem subir a VERSAO aqui, quem tem v60 no cache continua com o botão caixa
// clara e a lista de duas colunas, mesmo com o HTML novo.
// Recalculado na S13e (04/11/2026), com a árvore parada e DEPOIS de subir a
// VERSAO acima: três folhas do precache mudaram de bytes — web/folha.js (o
// seloLinha passa a ser exportado), web/telas/aulas.js (a classe lN na raiz e o
// selo no topo) e web/telas/aulas.css (.aulas .selo e o separador de 1px).
// Recalculado na S14a (04/11/2026), com a árvore parada e DEPOIS de subir a
// VERSAO acima: cem arquivos (core/cartoes.js entrou na lista), e quatro mudaram
// de bytes — core/estudo.js ('estudada', estudarAula, a retomada nova),
// core/rotas.js (a rota da aula), core/aulas.js (pausasDaAula) e core/textos.js
// (a seção fechamento). O sw.js mediu o mesmo sha256 antes e depois de eu subir a
// VERSAO, o que é a prova de que ele não está na própria lista.
// Recalculado ao FECHAR a S15b-fix (04/11/2026), com a árvore parada e DEPOIS de
// subir a VERSAO acima: 105 arquivos, quatro mudaram de bytes —
// web/telas/revisar-fila.js (o ramo visto sem convite nem confiança),
// web/telas/revisar.js (os quatro destinos de foco), web/telas/revisar.css (a
// grade de confiança, a borda de 1px, o anel da casa, o box-sizing do link) e
// core/textos.js (o singular). O app/olhodoprova.html saiu do disco: não é tela
// do produto e a régua do precache acusa arquivo a mais fora do git.
// Recalculado na S16a (04/11/2026), com a árvore parada e DEPOIS de subir a
// VERSAO acima: 106 arquivos, um ENTROU (core/eixos.js, o núcleo dos dois eixos) e
// nenhum mudou de bytes — a fatia é pura, sem tela. O sw.js mediu o mesmo sha256
// antes e depois de eu subir a VERSAO, prova de que ele não está na própria lista.
// Recalculado na S16b (04/11/2026), com a árvore parada e DEPOIS de subir a
// VERSAO acima: 106 arquivos, nenhum ENTROU e dois mudaram de bytes —
// core/mapa-rede.js (os eixos viram desenho) e core/textos.js (o bloco `mapa`,
// com as frases do aria-label). Os testes novos (tests/mapa-eixos.test.js) não
// estão no precache: nada de fora de app/ vai para o cache de quem usa.
// Recalculado na S18a-fix-4 (05/11/2026), com a árvore parada e DEPOIS de subir
// a VERSAO acima: 106 arquivos, nenhum ENTROU e um mudou de bytes —
// web/telas/aulas.css (a marca tracejada da pulada e a duração na coluna do
// título em 375 px). O sw.js mediu o mesmo sha256 antes e depois.
// Recalculado na S20b-1a (05/11/2026), com a árvore parada e DEPOIS de subir a
// VERSAO acima: 107 arquivos, nenhum ENTROU e quatro mudaram de bytes —
// core/textos.js (o U+00A0 da duração, `inseparavel`/`NBSP` e o 'fora' com
// emCurso na escada do selo), web/folha.js (a etiqueta lendo o estágio, a conta
// do estágio feita uma vez e emprestada ao bloco dos eixos), web/telas/perfil.css
// e web/telas/explorar.css (o piso de toque dos alvos nus). Os testes novos não
// estão no precache: nada de fora de app/web e app/core vai para o cache de quem
// usa. O sw.js mediu o mesmo sha256 antes e depois.
// Recalculado ao fechar a S20b-4 (05/11/2026), com a árvore parada e DEPOIS de
// subir a VERSAO acima: 107 arquivos, nenhum ENTROU e quatro mudaram de bytes —
// core/textos.js (`continuarEstacao`), web/metro.js (`estadoDaLista` e a medição
// única por pintura), web/telas/jornada-topo.js (o verbo do modo `proxima`) e
// web/telas/jornada.css (o desfazer da colisão de classe no `.topo`). O arquivo
// novo (tests/jornada-medida.test.js) e as duas travas tocadas não estão no
// precache: nada de fora de app/web e app/core vai para o cache de quem usa.
// Recalculado ao fechar a S20b-5 (06/11/2026), com a árvore parada e DEPOIS de
// subir a VERSAO acima: 108 arquivos, nenhum ENTROU e um mudou de bytes —
// web/telas/explorar.css (o recheio nos quatro lados, o box-sizing dos campos de
// filtro, o teto de 1024 e a pilha do celular). Os testes novos
// (tests/auditoria-tamanhos.test.js, duas travas) não estão no precache: nada de
// fora de app/web e app/core vai para o cache de quem usa. O sw.js mediu o mesmo
// sha256 antes e depois de eu subir a VERSAO, prova de que ele não está na própria
// lista.
// Recalculado ao fechar a S19a (06/11/2026), com a árvore parada e DEPOIS de subir a
// VERSAO para atlas-v101: quatro folhas do precache mudaram de bytes — core/viagem.js
// (fraseDeRecomeco), core/textos.js (o bloco recomeco), web/telas/jornada-topo.js (o
// <p class="topo-recomeco">) e web/telas/jornada.css (a regra dele). tests/
// jornada-medida.test.js não está no cache, como todo teste.
const PRECACHE_HASH = 'sha256-25c753badfa0a194ae1eb601a98fd11e62e0df9fc151653f352be165994f0a5e';

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
  // A marca definitiva (S1, 30/10/2026): o icone svg azul-marinho morreu e
  // entrou PNG em seis tamanhos, mais o favicon.ico e os dois arquivos do topo
  // (simbolo + palavra, esta como mascara de CSS). Estao aqui porque senao a
  // marca nao carrega no onibus, que e justamente onde o app existe.
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/favicon-16.png',
  'favicon.ico',
  'marca/simbolo.png',
  'marca/palavra.png',
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
  // A base da v2 (S2, 31/10/2026): html e body pintando --fundo, a fonte do
  // corpo e o anel de foco de 3 px. Sem ela no cache, o offline volta a ter
  // calha branca no escuro — o defeito que a S2 matou.
  'web/tokens.css',
  'web/base.css',
  // O CASCO (S3a-2a, 31/10/2026): o index.html passou a carregar cascos.js e as
  // duas telas sao importadas por dinamica. Sem estes tres no cache, quem tem
  // v21 recebe o HTML novo e a tela nunca monta — a pagina abre em branco no
  // onibus, e o branco nao da erro nenhum na rede.
  'web/casco.js',
  'web/casco.css',
  // O SELO DE REDE (S10b, 03/11/2026): modulo novo importado pelo casco. Sem
  // ele no cache, quem ja tem v42 recebe o HTML novo e o casco morre no import
  // — branco no onibus, sem erro na rede para avisar.
  'web/rede.js',
  // A leitura de data/aulas/<slug>.json (S13a): o único caminho que a tela de
  // aulas usa para chegar aos dados, e o único lugar onde um 404 vira frase em
  // vez de estouro. Sem este arquivo no cache, a lista de aulas não aparece
  // nem com rede, porque o import do index falharia em silencio.
  'web/aulas-dados.js',
  'web/aulas-pedacos.js',
  'web/telas/aulas.js',
  'web/telas/aulas.css',
  // S14b1: a página de UMA aula e o CSS dela. O index.html liga o CSS e o casco
  // importa o módulo — os dois no mesmo commit, senão é branco no ônibus.
  'web/telas/aula.js',
  'web/telas/aula.css',
  // S18c-1 (06/11/2026): a TELA do desafio da estação (J4). O casco ganhou
  // `desafio` em TELAS no mesmo commit em que este arquivo nasceu — é a mesma
  // lei da v21, e aqui o branco não seria numa aba: seria na rota que a
  // caderneta promete («o desafio da estação aprovado») e que ninguém podia
  // fazer. Sem folha nova: ela veste as classes de web/telas/revisar.css, que
  // já está no precache e já desenha cada uma delas.
  'web/telas/desafio.js',
 // A FOLHA da estacao (S5): o index.html liga o CSS, e ela vira modulo quando o
 // metro.js trocar o clique pela rota. Os dois entram juntos pelo mesmo motivo
 // da v22 — HTML novo pedindo arquivo que o cache antigo nao tem.
 'web/folha.js',
 'web/folha.css',
  'web/telas/jornada.js',
  'web/telas/explorar.js',
  // A EXPLORAR da v2 (S7, 01/11/2026): a tela passou a importar core/filtro.js
  // e a ligar web/telas/explorar.css. Mesma regra da v21 — HTML e JS novos
  // pedindo arquivo que o cache antigo nao tem abre em branco, sem erro na rede.
  'core/filtro.js',
  'web/telas/explorar.css',
  // A REVISÃO (S8, 01/11/2026): core/revisao.js é importado por web/telas/
  // revisar.js e pelos dois arquivos da tela. HTML e JS novos pedindo arquivo
  // que o cache antigo não tem = branco no ônibus, sem erro na rede.
  'core/revisao.js',
  // S15b (04/11/2026): `revisar.js` passou a importar `revisar-fila.js` — os
  // desenhos dos quatro estados mudaram de arquivo pela regra 15 (ele chegou a
  // 504 linhas). Esquecer esta linha é o mesmo branco no ônibus: o JS novo
  // pede um arquivo que o cache antigo não tem.
  'web/telas/revisar.js',
  'web/telas/revisar-fila.js',
  'web/telas/revisar.css',
  // O PERFIL (S9, 02/11/2026): os dados da pessoa têm casa própria
  // (core/dados-pessoa.js) e a tela importa web/metro.js pelo carregador da
  // viagem — os quatro juntos, pela mesma razão da Revisão acima.
  'core/dados-pessoa.js',
  'web/telas/perfil.js',
  'web/telas/perfil.css',
  // As tres pecas da Jornada (S4a, 31/10/2026): o metro.js importa
  // jornada-blocos.js, e o index.html liga o jornada.css. Se um dos dois
  // faltar no cache, a primeira aba abre sem a abertura e sem o tamanho do
  // titulo — branco silencioso, sem erro na rede para avisar.
  // S20a: o topo da Jornada (a primeira visita e a volta). Importado por
  // web/metro.js, entao sem ele a Jornada nao sobe offline, e o indice de aulas
  // que o topo le ja esta listado abaixo em data/aulas/indice.json.
  'web/telas/jornada-blocos.js',
  'web/telas/jornada-topo.js',
  'web/telas/jornada.css',
  'web/fontes.css',
  'fonts/overpass-latin-var.woff2',
  'fonts/overpass-mono-latin-var.woff2',
  'core/progress.js',
  'core/progress-io.js',
  // viagem.js ainda nao e importado por tela nenhuma (o pedido que o criou e o
  // das regras, e a tela vem depois do design system). Esta aqui porque o
  // precache cobre o disco: quando a tela passar a importar, o cache ja tem.
  'core/viagem.js',
  // O mapa da rede (S11): o diagrama das 35 estações que o cartão do link, o topo
  // da Jornada e o bilhete desenham. Importa viagem.js e progress.js.
  'core/mapa-rede.js',
  // NOTA DE CASA: dentro do array PRECACHE, aspas retas são um CAMINHO, não
  // prosa, e um colchete fecha o bloco que a trava pwa.test.js procura — ela lê
  // o texto entre a abertura e o FECHAMENTO do array, trata cada string
  // entre aspas como arquivo a precarregar e cobra que ele exista no disco.
  // Comentário aqui usa aspas angolanas ou nenhuma, e nenhum colchete: aspas
  // retas numa frase quebram a suíte com um arquivo «sobrando» que ninguém
  // criou, e um colchete tira do cache tudo o que vem depois dele.
  //
  // As aulas de cada estação (S12): traduz a resposta da YouTube Data API. Sem rede, sem DOM.
  'core/aulas.js',
  // O ESTUDO por aula (S13a, 04/11/2026): quem abriu o quê e por onde
  // continuar. Nenhuma tela o importa ainda (a S13b importa), mas o precache
  // cobre o disco: a folha desenhada amanhã precisa dele offline no primeiro
  // toque, e um módulo ausente do cache é uma tela em branco no ônibus.
  'core/estudo.js',
  // Os CARTOES do fechamento de aula (S14a, 04/11/2026): o que a pessoa escreveu
  // como pergunta e resposta, e o que esta devido hoje. Modulo puro, sem tela
  // ainda (a S14b desenha o formulario) — mas quem fecha uma aula no onibus e
  // volta sem sinal tem de achar o proprio cartao, e um modulo fora do cache e a
  // fila de revisao em branco.
  'core/cartoes.js',
  // O FSRS-6 do cartao (S15a, 04/11/2026): a conta que decide em que dia o
  // cartao volta. core/cartoes.js importa este arquivo, entao quem nao o tem no
  // cache nao tem REVISAO NENHUMA offline — a pessoa responde, o app nao agenda,
  // e a frase «o seu cartao volta amanha» quebra so no onibus, que e justamente
  // onde ela importa.
  'core/fsrs.js',
  // OS DOIS EIXOS da estacao (S16a, 04/11/2026): o preenchimento do que foi
  // estudado e a cor do que foi lembrado depois. Modulo puro, sem tela ainda (a
  // S16b desenha o mapa) — mas o mapa e a primeira coisa que a pessoa ve na
  // jornada, e um modulo fora do cache e a jornada em branco no onibus.
  'core/eixos.js',
  // A CADERNETA do percurso (S17a-1, 05/11/2026): os oito carimbos medidos, com os
  // espaços vazios à vista. Modulo puro, sem tela ainda (a proxima fatia desenha o
  // Perfil) — mas o bilhete que hoje se lê no Perfil vira esta conta, e um modulo
  // fora do cache é a caderneta em branco no onibus.
  'core/caderneta.js',
  // S19b (06/11/2026): o texto do .ics da proxima sessao. Modulo puro, sem DOM,
  // importado por web/agenda-marcar.js. Sem ele no cache, o botao de baixar
  // morre no import e a aula estudada abre em branco no onibus.
  'core/agenda.js',
  // S19b: o bloco que desenha o convite, importado por telas/aula.js e
  // telas/revisar.js no mesmo commit em que nasceu. Mesma regra acima: modulo
  // fora do cache e tela em branco, sem erro na rede para avisar.
  'web/agenda-marcar.js',
  // O DESAFIO da estacao (S18b-1, 05/11/2026): quem pode, o porque que falta e o
  // sorteio dos 10 a 15 cartoes da propria pessoa. Modulo puro, sem tela ainda (a
  // proxima fatia desenha) -- mas o cartao que amanha vira desafio precisa estar
  // no onibus, e um modulo fora do cache e a tela do desafio em branco.
  'core/desafio.js',
  'core/notes.js',
  'core/search.js',
  // Rotas da grade (S3a-1, 31/10/2026): as abas que o boot.js resolve. Sem
  // ela no cache, abrir a linha no onibus cai na rede e quebra em silencio.
  'core/rotas.js',
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
  // As aulas de cada estação (S12): uma estação por arquivo, mais o índice dos totais,
  // gerados pelo tools/aulas-do-youtube.mjs a partir da YouTube Data API e regerados
  // uma vez por mês (os termos da API limitam guardar os dados por 30 dias). O
  // aulas-recortes.json é o insumo editorial que divide Python I e II.
  'data/aulas-recortes.json',
  // As frases de competencia (desenho v3): o que a pessoa sabe fazer ao fechar a
  // estacao, uma por estacao, com a fonte. O livro de selos (S17) as le daqui.
  'data/competencias.json',
  'data/aulas/indice.json',
  'data/aulas/algebra-linear-i.json',
  'data/aulas/algoritmos-em-grafos.json',
  'data/aulas/analise-algoritmos.json',
  'data/aulas/arquitetura-computadores-i.json',
  'data/aulas/arquitetura-computadores-ii.json',
  'data/aulas/banco-de-dados.json',
  'data/aulas/calculo-i.json',
  'data/aulas/calculo-ii.json',
  'data/aulas/calculo-iii.json',
  'data/aulas/circuitos-digitais.json',
  'data/aulas/compiladores.json',
  'data/aulas/computacao-quantica.json',
  'data/aulas/deep-learning.json',
  'data/aulas/engenharia-software.json',
  'data/aulas/estruturas-de-dados.json',
  'data/aulas/fundamentos-computacao-grafica.json',
  'data/aulas/geometria-analitica.json',
  'data/aulas/inteligencia-artificial.json',
  'data/aulas/introducao-cc-python-i.json',
  'data/aulas/introducao-cc-python-ii.json',
  'data/aulas/laboratorio-poo-i.json',
  'data/aulas/linguagens-de-programacao.json',
  'data/aulas/linguagens-formais-automatos.json',
  'data/aulas/matematica-discreta.json',
  'data/aulas/metodologia-pesquisa.json',
  'data/aulas/metodos-numericos-i.json',
  'data/aulas/probabilidade-estatistica.json',
  'data/aulas/programacao-funcional-haskell.json',
  'data/aulas/programacao-logica.json',
  'data/aulas/programacao-matematica.json',
  'data/aulas/redes-computadores.json',
  'data/aulas/sistemas-distribuidos.json',
  'data/aulas/sistemas-operacionais.json',
  'data/aulas/teoria-computacao.json',
  'data/aulas/teoria-grafos.json',
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
