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
 * Textos com substituição. São FUNÇÕES de propósito: o teste confere que cada
 * uma devolve texto não vazio com um valor de exemplo, o que pega a função que
 * esqueceu de usar o parâmetro (devolve "Linha " ou "trancada: falta ").
 */
export const comValores = {
  /** Selo da linha. A fonte não nomeia os estágios: é Linha N, sempre. */
  linha: (n) => `Linha ${n}`,

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
   * guarda em `conclusoes` (AAAA-MM-DD) — a tela não inventa dia nem formata
   * por conta própria; reimplementar calendário aqui é a receita para duas
   * datas discordarem na mesma estação.
   */
  concluidaEm: (data) => `Concluída em ${data}`,

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

/** Tudo junto, para quem precisa percorrer (o teste percorre). */
export const TEXTOS = { placa, comValores, estados, legenda, proibido, ORIGEM, TIPO_DE_ORIGEM };

export default TEXTOS;
