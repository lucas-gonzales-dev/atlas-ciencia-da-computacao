// Projeto Atlas — OS TEXTOS DA TELA, num lugar só.
//
// Por que um módulo e não frases espalhadas no render: o design system
// (design/README.md §6) exige que cada estado tenha o seu texto DEFINIDO, e que
// a definição exista num único lugar. Frase escrita dentro do desenho é frase
// que ninguém revisa, que aparece com grafia diferente em duas telas e que o
// teste não alcança. Aqui o teste alcança: design-system.test.js percorre este
// módulo e reprova qualquer texto vazio.
//
// REGRAS DE VOZ (design/README.md §1):
//   · tom de placa de metrô — curto, direto, segunda pessoa;
//   · o substantivo é do metrô (estação, linha, baldeação, ramal, viagem),
//     o verbo é do estudo (concluir, marcar, embarcar);
//   · NUNCA caminho de arquivo, URL crua, slug, nome de campo ou jargão;
//   · as linhas se chamam Linha 1 a Linha 7 — a fonte não dá nome aos estágios,
//     então o Atlas não inventa nome nenhum.
//
// {curly} são lugares de substituição. Quem desenha troca pelo valor real;
// quem escreve aqui não sabe o valor ainda.

/** Textos fixos de placa: cabeçalhos, selos, botões. */
export const placa = {
  titulo: 'Atlas',
  subtitulo: 'Ciência da Computação — Universidade Brasileira Livre',
  proximaEstacao: 'Sua próxima estação',
  // S4b (JORNADA, layout): a placa muda de rótulo com o estado. Quem já está
  // dentro de uma estação não está olhando para a "próxima" — está continuando.
  continueOndeParou: 'Continue de onde parou',
  // S4b: a placa é o lugar de decidir, e decidir custa um clique que ninguém
  // devolve. A nota diz que abrir é grátis: nada aqui escreve na viagem.
  notaAbrir: 'Abrir não muda sua viagem: você decide quando concluir.',
  viagem: 'Sua viagem',
  comoLerMapa: 'Como ler o mapa',
  sobre: 'Sobre',
  // Item 5 da crítica (2b-2, 29/10/2026): a tela de metrô tem UM verbo só —
  // "Começar a estudar". "Começar a viagem" morreu junto com a chave embarcar.
  // Não volta como reserva: verbo duplicado na tela é duas decisões para a
  // mesma pessoa. A chegada (concluir/desfazer) é da fatia 2c.
  marcaLinha: 'Ciência da Computação · UBL',
  concluir: 'Concluir estação',
  desfazer: 'Desfazer',
  salvar: 'Salvar',
  cancelar: 'Cancelar',
  limpar: 'Limpar',
  // Pedido 16 (a tela de metrô): a placa tem UMA ação só, e o texto dela muda
  // com o estado — "Começar a estudar" quando ainda não começou, "Continuar"
  // quando está em curso. "Marcar" é o verbo do embarque da primeira visita.
  comecarEstudar: 'Começar a estudar',
  continuar: 'Continuar',
  marcar: 'Marcar',
  concluida: 'Concluída.',
  // Item 6 da crítica: o link tem NOME, nunca o caminho, e aponta para o
  // arquivo na fonte no SHA auditado (b995c11) — não para main, que muda.
  // FATIA 2d-2 (JORNADA §3.1): o verbo de quem já passou por ali não pode ser
  // "Começar a estudar" como se nada tivesse acontecido. Um verbo só por folha,
  // e ele muda com o estado — como o "Continuar" da placa.
  reverConteudo: 'Rever o conteúdo',
  bibliografiaNaFonte: 'Bibliografia na fonte',
  bibliografiaNota: 'A fonte publica esta bibliografia; o Atlas não conferiu se a página está no ar.',
  buscar: 'Buscar estação',
  exportar: 'Exportar progresso',
  importar: 'Importar progresso',
  fechar: 'Fechar',
  voltar: 'Voltar',
  salvo: 'salvo',
};

/**
 * Data de CALENDÁRIO (AAAA-MM-DD) no formato que a pessoa lê: dd/mm/aaaa.
 *
 * FATIA 2d-2, ajuste do Claude (30/10/2026): "CONCLUÍDA EM 2026-10-30" era ISO
 * na tela. E não se resolve com `new Date(iso).toLocaleDateString()`: uma data
 * sem hora é lida como UTC meia-noite, e num fuso negativo (Brasil, UTC−3)
 * isso devolve o dia ANTERIOR — a pessoa veria a estação concluída ontem. Por
 * isso os três pedaços são lidos da própria string: nenhum fuso entra no
 * caminho, porque calendário não tem fuso.
 *
 * O que não é AAAA-MM-DD sai como entrou: texto que a tela não sabe ler não é
 * motivo para ela inventar uma data.
 */
export function dataDeCalendario(iso) {
  const bruto = String(iso ?? '');
  const peca = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto);
  if (!peca) return bruto;
  return `${peca[3]}/${peca[2]}/${peca[1]}`;
}

/**
 * Textos com substituição. São FUNÇÕES de propósito: o teste confere que cada
 * uma devolve texto não vazio com um valor de exemplo, o que pega a função que
 * esqueceu de usar o parâmetro (devolve "Linha " ou "trancada: falta ").
 */
export const comValores = {
  /** Selo da linha. A fonte não nomeia os estágios: é Linha N, sempre. */
  linha: (n) => `Linha ${n}`,

  /**
   * S4b: ONDE na linha a pessoa está — "Linha 2 · estação 3 de 5". É 1-based
   * porque é assim que se conta uma fila de estação, e a posição vem do
   * catálogo (a ordem da fonte), nunca de um índice de array na tela.
   */
  posicaoNaLinha: (n, posicao, total) => `Linha ${n} · estação ${posicao} de ${total}`,

  /**
   * S4b: a linha de apoio do CARTÃO do diagrama. É a mesma informação da
   * `trancadaFalta`, mas curta: no cartão cabe uma linha, e "trancada:" já está
   * escrito no rótulo de estado logo acima — repetir seria a tela dizendo duas
   * vezes a mesma coisa em dois lugares.
   */
  apoioFalta: (nomes) => (nomes.length === 1 ? `Falta ${nomes[0]}` : `Faltam ${nomes.join(', ')}`),

  /** Estação trancada: diz o que falta, pelo nome — prevenir erro é dizer. */
  trancadaFalta: (nome) => `trancada: falta ${nome}`,

  /** Mais de um pré-requisito em falta. */
  trancadaFaltam: (nomes) => `trancada: faltam ${nomes}`,

  /** Baldeação: a conexão vem de outra linha. */
  baldeacao: (estacao, linha) => `baldeação com ${estacao} (Linha ${linha})`,

  /** FATIA 2d-1 (§2.5): o que o gesto de agora abriu, pelo nome. */
  destrancou: (nomes) => `destrancou ${nomes}`,

  /**
   * FATIA 2d-2 (§3.1): o carimbo da folha concluída. A data é a que O NÚCLEO
   * guarda em `conclusoes` (AAAA-MM-DD), mas ISO não é para ser lido por
   * ninguém — sai no formato do Brasil. Quem converte é `dataDeCalendario`,
   * aqui embaixo: a tela continua sem reimplementar calendário, só lê.
   */
  concluidaEm: (data) => `Concluída em ${dataDeCalendario(data)}`,

  /** Busca sem resultado: repete o termo, para provar que a busca ouviu. */
  buscaVazia: (termo) => `Nada encontrado para «${termo}».`,

  /** Contador da viagem, sempre à vista. */
  viagem: (concluidas, total) => `${concluidas} de ${total} estações`,

  /** Progresso de uma linha, na coluna da viagem. */
  progressoLinha: (n, feitas, total) => `Linha ${n}: ${feitas} de ${total}`,

  /** Erro em três partes — nunca em duas: sem a terceira não há ação. */
  erroOQue: (onde) => `Não deu para carregar ${onde}.`,
  erroPorQue: (motivo) => `Motivo: ${motivo}.`,
  erroOQueFazer: () => 'Recarregue a página. Se continuar assim, o catálogo pode estar fora do ar — o seu progresso está salvo neste aparelho e não se perde.',

  /** Ramal em obras: o que a fonte ainda não publicou. Sem inventar conteúdo. */
  ramalEmObras: (ramal) => `${ramal}: ramal em obras — a fonte ainda não publicou as estações.`,

  /** Link com nome, no lugar da URL crua. */
  linkBibliografia: (titulo) => `Bibliografia: ${titulo}`,

  /**
   * S5: um item da lista "AO CONCLUIR, VOCÊ ABRE". Baldeação é travessia — o
   * número da linha de destino vem junto com o nome, como na 2d-2 (§3.2).
   */
  abreItem: (titulo, linha) => `${titulo}, na Linha ${linha}`,

  /**
   * S5: o fato "CONEXÕES" da folha, em número. "Pede 1 · Abre 2" é lido da
   * malha; zero continua escrito zero, porque esconder o número seria a tela
   * dizendo menos do que sabe.
   */
  fatosConexoes: (pede, abre) => `Pede ${pede} · Abre ${abre}`,
};

/**
 * A ORIGEM do recurso — JORNADA §2.3: \"a pessoa desiste se o recurso abrir sem
 * dizer de onde veio\". A frase é montada a partir do que O CATÁLOGO DIZ (o campo
 * `resourceType` e o domínio de `resourceUrl`); o que a fonte não diz, a tela não
 * diz. Por isso cada função aceita `site` e devolve a frase SEM o site quando ele
 * não é conhecido — \"Curso ou playlist\" é honesto, \"Playlist no YouTube\"
 * inventado é o que a tela não pode fazer.
 *
 * Não é uma das 4 chaves que o design-system percorre (placa/estados/legenda):
 * aqui os valores são funções de propósito, como comValores, e a origem delas é
 * medida em tests/metro.test.js contra o catalog.json real.
 */
export const ORIGEM = {
  /** O tipo que a fonte publica: `external_course_or_playlist` (35 registros). */
  cursoOuPlaylist: (site) => `Curso ou playlist${comSite(site)}`,
  curso: (site) => `Curso${comSite(site)}`,
  playlist: (site) => `Playlist${comSite(site)}`,
  video: (site) => `Vídeo${comSite(site)}`,
  texto: (site) => `Texto${comSite(site)}`,
  artigo: (site) => `Artigo${comSite(site)}`,
  livro: (site) => `Livro${comSite(site)}`,
  /** Sem tipo na fonte: sobra o lugar, e o lugar já é uma palavra. */
  somenteSite: (site) => site,
};

/**
 * A preposição, como se fala: sites cujo nome termina em \"a\" pedem \"na\"
 * (na Khan Academy, na Escola Virtual); os outros, \"no\" (no YouTube, no
 * Coursera). É a única licença de forma desta lista — o nome vem do catálogo.
 */
function comSite(site) {
  if (!site) return '';
  return /a$/i.test(site) ? ` na ${site}` : ` no ${site}`;
}

/**
 * `resourceType` da fonte → a palavra desta lista. Escrita aqui e não no
 * metro.js porque vocabulário fora do lugar do texto é o que faz a mesma
 * origem aparecer de dois jeitos em duas telas (regra 2 do metro.js).
 */
export const TIPO_DE_ORIGEM = Object.freeze({
  external_course_or_playlist: 'cursoOuPlaylist',
  course: 'curso',
  playlist: 'playlist',
  video: 'video',
  artigo: 'artigo',
  article: 'artigo',
  texto: 'texto',
  text: 'texto',
  livro: 'livro',
  book: 'livro',
});

/**
 * Os oito estados obrigatórios (design/README.md §6). Cada um traz o texto que
 * aparece — e o teste confere que nenhum campo está vazio.
 */
export const estados = {
  carregando: {
    titulo: 'Carregando a rede…',
    descricao: 'As 7 linhas e as 35 estações estão chegando.',
    // O esqueleto é um traço cinza e 5 círculos cinza, PARADOS. Sem brilho
    // correndo: shimmer é spinner disfarçado. Só aparece depois de 150 ms
    // (--atraso-esqueleto) — piscar esqueleto em 40 ms é pior que não ter.
    nota: 'Se demorar mais que um instante, aparece o desenho da linha em cinza.',
  },

  primeiraVisita: {
    titulo: 'Bem-vindo ao embarque',
    descricao: 'Comece pela Linha 1: as 5 estações dela abrem o resto da rede.',
    acao: 'Já estudou alguma? Marque as que você já fez — a rede se ajusta ao que você sabe.',
    botao: 'Marcar o que já estudei',
  },

  buscaSemResultado: {
    titulo: 'Nada encontrado',
    descricao: 'Confira a grafia ou busque por parte do nome: «algoritmo» acha Algoritmos I e II.',
    acao: 'Limpar busca',
  },

  offline: {
    // Selo DISCRETO: o Atlas offline é o Atlas inteiro, o catálogo está no
    // precache. Banner vermelho anunciaria um problema que não existe.
    titulo: 'offline',
    descricao: 'Tudo aqui continua funcionando sem conexão.',
  },

  fimDaLinha: {
    // Carimbo de bilhete: círculo com o número da linha e a data. SEM confete.
    titulo: 'Fim da linha',
    descricao: 'Você concluiu as 5 estações desta linha. O carimbo é seu.',
    acao: 'Ver as linhas que esta abriu',
  },

  terminal: {
    titulo: 'Terminal',
    descricao: 'As 35 estações concluídas. A viagem inteira da Universidade Brasileira Livre, feita.',
    acao: 'Leve o seu progresso: exporte para guardar ou mostrar.',
    botao: 'Exportar progresso',
  },

  erro: {
    titulo: 'O mapa não carregou',
    // As três partes, sempre as três: o que falhou, por quê, o que fazer agora.
    parteUm: 'Não deu para carregar o catálogo da rede.',
    parteDois: 'Motivo: {motivo}.',
    parteTres: 'Recarregue a página. Se continuar assim, o catálogo pode estar fora do ar — o seu progresso está salvo neste aparelho e não se perde.',
    botao: 'Recarregar',
  },

  ramalEmObras: {
    titulo: 'Ramal em obras',
    descricao: 'A fonte ainda não publicou as estações deste ramal. O Atlas não inventa conteúdo para parecer completo.',
    acao: 'Voltar para a rede',
  },
};

/**
 * S5 — a FOLHA da estação. Todo texto que ela desenha mora aqui (regra 9:
 * frase à mão no `web/` é o que faz a mesma origem aparecer de dois jeitos em
 * duas telas). Os nomes vêm do slice S5 do `design/v2/FATIAS-POR-ESCRITA.md`,
 * e o que é número ou data é função em `comValores`.
 */
export const folha = Object.freeze({
  fechar: 'Fechar a folha',
  naoEstaNoMapa: 'Essa estação não está no mapa.',
  voltarAoMapa: 'Voltar ao mapa',
  rotuloRecurso: 'Recurso',
  rotuloBibliografia: 'Bibliografia',
  rotuloConexoes: 'Conexões',
  abreTitulo: 'Ao concluir, você abre',
  trancadaTitulo: 'A conexão começa antes.',
  revisitar: 'Rever o conteúdo',
  abrirCurso: 'Abrir o curso',
  desfazerConclusao: 'Desfazer conclusão',
  anotacaoPergunta: 'Em uma frase, o que você leva desta estação?',
  anotacaoCampo: (nome) => `Anotação de ${nome}`,
  salvo: 'Salvo',
  notaAbrir: 'O curso abre fora do Atlas, no site de quem o publicou.',
  // O estado por texto (JORNADA §3.1): forma E palavra, nunca só a cor.
  estadoNome: Object.freeze({
    concluida: 'Concluída',
    em_curso: 'Em curso',
    disponivel: 'Disponível',
    trancada: 'Trancada',
  }),
});

/**
 * Legenda do mapa — heurística 6 (reconhecer em vez de lembrar) e 10 (ajuda).
 * A forma diz o estado, e a legenda diz a forma: cor nunca é o único sinal.
 */
export const legenda = {
  titulo: 'Como ler o mapa',
  itens: [
    { forma: 'Círculo cheio na cor da linha', significado: 'estação concluída' },
    { forma: 'Anel grosso na cor da linha, miolo claro', significado: 'estação disponível — pode concluir' },
    { forma: 'Meio círculo na cor da linha', significado: 'estação em curso' },
    { forma: 'Anel fino cinza', significado: 'estação trancada: o nome do que falta aparece ao lado' },
    { forma: 'Trecho em cor cheia', significado: 'você já passou por aqui' },
    { forma: 'Trecho em cor suave', significado: 'falta passar' },
    { forma: 'Anel que pulsa devagar', significado: 'você está aqui — a sua próxima estação' },
    { forma: 'Carimbo com o número da linha', significado: 'fim da linha: as 5 estações concluídas' },
    { forma: 'Traço que sai da linha', significado: 'ramal (especialização)' },
    { forma: 'Traço tracejado', significado: 'ramal em obras: a fonte ainda não publicou' },
    { forma: 'Duas linhas que se cruzam', significado: 'baldeação: a estação serve de pré-requisito em outra linha' },
  ],
  atalhos: [
    { tecla: '↑ ↓ ← →', acao: 'andar pelas estações da linha' },
    { tecla: 'Enter', acao: 'abrir a estação' },
    { tecla: 'Esc', acao: 'fechar a folha ou o painel' },
    { tecla: '/', acao: 'abrir a busca' },
  ],
};

/**
 * A lista do proibido, em código. Está aqui para o teste poder conferir que o
 * app não a desrespeita, e para quem implementa uma tela nova achar a regra sem
 * abrir o documento. Motivos em design/README.md §9.
 */
export const proibido = [
  'degradê roxo',
  'vidro fosco (backdrop-filter)',
  'sombra decorativa',
  'emoji',
  'confete',
  'spinner',
  'brilho de esqueleto correndo (shimmer)',
  'fonte do sistema como principal',
  'URL crua ou caminho de arquivo como texto na tela',
  'cor fora dos tokens',
  'duração escrita à mão',
  'número de largura à mão em @media',
  'nome de estágio inventado',
];

/**
 * O CASCO (S3a-1, 31/10/2026): as frases do invólucro que a tela monta em
 * volta do conteúdo — o link de pular, o rótulo da região de navegação, o
 * anúncio de qual aba está ativa e os nomes das abas.
 *
 * Vive aqui e não em core/rotas.js porque é texto de tela, e a regra 7 diz que
 * toda frase da tela mora neste arquivo. ABAS, em rotas.js, lê o rotulo daqui:
 * a rota sabe PARA ONDE se vai, o texto sabe COMO se chama.
 *
 * `anuncio` é a frase que o leitor de tela fala quando a pessoa troca de aba.
 * Sem ela, a troca é visual e ninguém mais fica sabendo em que tela está.
 */
export const casco = {
  pular: 'Pular para o conteúdo',
  navegacao: 'Principal',
  anuncio: (rotulo) => `Você está em ${rotulo}.`,
  abas: { jornada: 'Jornada', explorar: 'Explorar' },
};

/**
 * A JORNADA (S4a, 31/10/2026): as três peças que respondem em 10 segundos —
 * o que é isto (abertura), onde estou (os três números) e o que o próximo passo
 * abre (a conexão). Os rótulos saem em caixa alta no CSS (`text-transform`),
 * como toda placa do app, e nenhum dos três números é placar: sem XP, sem
 * sequência, sem pontos.
 *
 * Frase com valor é função, e o valor vem do catálogo ou da viagem da pessoa —
 * nunca um número escrito aqui. Por isso `paragrafo` e `valorLinhas` recebem.
 */
export const jornada = {
  abertura: {
    rotulo: 'Sua viagem em Ciência da Computação',
    titulo: 'Seu caminho fica mais claro a cada',
    // A palavra que fecha o título leva a cor da linha da próxima estação.
    tituloFim: 'conexão.',
    paragrafo: (estacoes, linhas) =>
      `${estacoes} estações em ${linhas} linhas, da grade aberta da Universidade Brasileira Livre. ` +
      'O Atlas aponta os cursos e livros que ela indica e guarda sua viagem só neste aparelho.',
    // Primeira visita: o embarque é a saída, e a linha 1 é a porta da rede.
    primeiraVisita:
      'Comece pela Linha 1: as estações dela abrem o resto da rede. Ou marque o que você já estudou — a rede se ajusta ao que você sabe.',
  },
  numeros: {
    rotulo: 'Sua viagem em números',
    viagem: 'Viagem',
    valorViagem: (c, t) => `${c}/${t}`,
    notaViagem: 'estações concluídas',
    emCurso: 'Em curso',
    valorEmCurso: (n) => String(n).padStart(2, '0'),
    notaEmCurso: 'você decide quando concluir',
    linhasAbertas: 'Linhas abertas',
    valorLinhas: (a, t) => `${a}/${t}`,
    notaLinhas: 'com estação disponível',
  },
  conexao: {
    rotulo: 'Próxima conexão',
    abre: (proxima, nomes) => `Ao concluir ${proxima}, você abre ${nomes}.`,
    // Baldeação é travessia: a tela nomeia a linha de destino.
    naLinha: (nomes, linha) => `${nomes}, na Linha ${linha}`,
    fecha: (linha) => `Esta estação fecha a Linha ${linha}.`,
  },
};

/**
 * A EXPLORAR (S7, 01/11/2026): a rede inteira em lista, para quem quer ver o
 * caminho sem embarcar em nada. Nenhuma frase daqui diz "estude", "assista" ou
 * "comece agora": a Explorar mostra a rede, quem decide é a pessoa na estação.
 * Nada de emoji, nada de contagem de dias, nenhum número que ela não gerou.
 */
export const explorar = Object.freeze({
  rotulo: 'A REDE INTEIRA',
  titulo: 'Explore sem perder a direção.',
  descricao: 'Cada estação mostra o que ela pede e o que ela abre. Trancada também se lê.',
  busca: {
    rotulo: 'Buscar estação',
    placeholder: 'Nome da disciplina',
  },
  filtro: {
    rotulo: 'Linha',
    todas: 'Todas',
    // O seletor é derivado do catálogo, nunca 7 escrito à mão.
    linha: (n) => `Linha ${n}`,
  },
  // `role=status aria-live=polite`: a contagem que quem usa leitor de tela ouve
  // a cada tecla. Frase curta, nunca a página inteira.
  status: {
    nenhuma: 'Nenhuma estação',
    uma: '1 estação',
    muitas: (n) => `${n} estações`,
  },
  grupos: {
    linha: (n) => `Linha ${n}`,
    ramais: 'Ramais',
    eletivas: 'Eletivas',
    semLinha: 'linha a definir',
  },
  selo: {
    emObras: 'EM OBRAS',
    trancada: 'trancada',
  },
  // O que falta, dito pelo NOME — mesma regra da folha (JORNADA 2.3).
  falta: (nomes) => `Falta ${nomes}`,
  rodape: 'Currículo: Universidade Brasileira Livre (licença MIT)',
});

/**
 * A CHEGADA (S6, 01/11/2026): o momento em que concluir vira coisa visível.
 *
 * O Lovable fez disso uma tela inteira; aqui o miolo da folha troca de corpo
 * por `--janela-desfazer` e o mapa muda por trás. Nenhuma destas frases fala em
 * ponto, XP, sequência ou conquista — a lista do proibido (§9) não é decoro, é
 * teste, e `marcos` existe para nomear o feito em vez de pontuá-lo.
 *
 * `criterioDoMarco` diz O QUE a pessoa fez de concreto: o marco explica-se, não
 * se comemora com número.
 */
export const chegada = Object.freeze({
  rotulo: 'Conexão criada',
  entrouNoBilhete: (nome) => `${nome} entrou no seu bilhete.`,
  carimbo: (data) => `Carimbo de ${data}.`,
  novoCaminho: 'Novo caminho',
  estaDisponivel: (nome) => `${nome} está disponível`,
  // Baldeação é travessia: além do nome, a linha de destino (§3.2).
  disponivelNaLinha: (nome, linha) => `${nome} está disponível, na Linha ${linha}`,
  naLinha: (nome, linha) => `${nome}, na Linha ${linha}`,
  // O "fecha a Linha n" é o MESMO texto da placa (jornada.conexao.fecha): duas
  // palavras para o mesmo fato é o defeito que a crítica da v1 contou.
  nadaAbriu: 'Nada se abre com esta estação.',
  marco: 'Marco',
  verProxima: 'Ver próxima estação',
  voltarAoMapa: 'Voltar ao mapa',
  // O leitor de tela fala o momento inteiro numa frase só (heurística 9).
  anuncia: (nome, abertas) => `Conexão criada: ${nome}. ${abertas} ${abertas === 1 ? 'estação aberta' : 'estações abertas'}.`,
  nomeDoMarco: Object.freeze({
    estacao: 'Estação concluída',
    fim_da_linha: 'Fim da linha',
    primeira_baldeacao: 'Primeira baldeação',
    terminal: 'Terminal',
  }),
  criterioDoMarco: Object.freeze({
    estacao: 'Concluir uma estação da rede.',
    fim_da_linha: 'Concluir todas as estações de uma linha.',
    primeira_baldeacao: 'Concluir uma estação que pede outra linha.',
    terminal: 'Concluir todas as estações da grade.',
  }),
});

/** Tudo junto, para quem precisa percorrer (o teste percorre). */
export const TEXTOS = { placa, comValores, folha, estados, legenda, proibido, ORIGEM, TIPO_DE_ORIGEM, casco, jornada, explorar, chegada };

export default TEXTOS;
