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

// ── A CONTA DA ESTAÇÃO, NUMA BASE SÓ (S16c-fix, 04/11/2026) ────────────────
// Duas telas dizem «3 de 93 aulas estudadas»: a linha da barra da estação
// (`aulas.progresso`, S14b2) e a linha dos dois eixos da folha (`folha.eixos`,
// S16c). Enquanto cada uma montava a sua, a folha mostrou a MESMA contagem duas
// vezes, uma em cima da outra — foi o que o olho do Claude viu no v77. Regra 9
// da casa: a mesma medida não se escreve de dois jeitos em dois lugares; aqui é
// nem de um jeito em duas linhas do mesmo lugar. A base é função de módulo, não
// chave de objeto: não é texto que a tela escolha, é o miolo que duas frases
// compartilham. Os testes que varrem as CHAVES (design-system.test.js) não leem
// função — por isso ela mora fora dos objetos congelados, e `TextosSemValoresVazios`
// continua olhando só o que é frase.
const baseDaEstacao = (estudadas, total) =>
  `${estudadas} de ${total} ${total === 1 ? 'aula estudada' : 'aulas estudadas'}`;

// `lembradas` a 0 NÃO entra: «0 lembradas depois» descreve o desenho, não a
// pessoa, e é a mesma regra do zero que saiu do aria-label na S16b. O singular
// é o da S15b-fix — «1 lembradas» é erro de concordância numa placa.
const lembradasDepois = (lembradas) =>
  Number.isFinite(lembradas) && lembradas > 0
    ? ` · ${lembradas} lembrada${lembradas === 1 ? '' : 's'} depois`
    : '';

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
  // S20a-3, item 0 (04/11/2026): com o TOPO da Jornada na tela, a placa diz o
  // que ela mostra, não o que a pessoa ainda vai fazer. O primário de aprender
  // é um por tela e ele é o do topo — "Começar pela primeira aula" ou
  // "Continuar: Aula N". A placa oferecendo "Começar a estudar" ao lado de um
  // topo que acabou de dizer "Começar" é a mesma mentira do defeito 4, por
  // outra porta: dois caminhos, duas frases, uma decisão. Secundária como era.
  // O verbo de abrir o recurso continua vivo na FOLHA (folha.js:143), que é a
  // tela de quem já escolheu a estação.
  verAEstacao: 'Ver a estação',
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
   * S14b1: o selo da PÁGINA DA AULA — "Linha 1 · Circuitos Digitais".
   *
   * Não é o `posicaoNaLinha` da folha: a página da aula não precisa dizer em que
   * posição da linha a estação fica (quem está na Aula 3 de 93 de uma estação já
   * sabe qual estação é — está no título logo abaixo), e dizer estaria trocando
   * a informação que a pessoa procura — a aula — por uma que ela não pediu.
   */
  linhaComEstacao: (n, estacao) => `Linha ${n} · ${estacao}`,

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
  // S13b: "Concluir estação" saiu dos botões e virou link discreto — fechar a
  // estação não é o gesto principal de quem está estudando aula por aula.
  marcarConcluida: 'Marcar a estação como concluída',
  // ── OS DOIS EIXOS DA ESTAÇÃO (S16c, princípio 1 do desenho) ──────────────
  // As duas linhas que a folha lê de core/eixos.js. Nenhum número mora aqui: o
  // preenchimento vem do fechamento das aulas, a lembrança vem do histórico do
  // cartão, e a frase só traduz o que o núcleo mediu.
  //
  // A CONTA DA ESTAÇÃO E AS LEMBRADAS MORAM FORA DO OBJETO desde a S16c-fix
  // (04/11/2026), e o motivo é um defeito que o olho viu: «3 de 93 aulas
  // estudadas» aparecia DUAS vezes na folha, uma em cima da outra — a linha de
  // medida daqui e a linha da barra (`aulas.progresso`, S14b2), cada uma montando
  // a sua frase para a MESMA conta. Regra 9 da casa: a mesma medida não pode sair
  // escrita de dois jeitos em duas telas — nem de um jeito em duas linhas da
  // mesma tela. As duas frases chamam a mesma base; trocar a palavra é um lugar.
  eixos: (estudadas, total, lembradas) => `${baseDaEstacao(estudadas, total)}${lembradasDepois(lembradas)}`,
  // O anel discreto do desenho, dito em palavras. `minutos` vem de `minutosDaFila`
  // sobre os cartões devidos daquela estação — a casa não escreve duração à mão
  // (lista do proibido), e a linha da Jornada e esta têm de dar o mesmo número
  // para a mesma fila.
  eixosRevisao: (minutos) => `Os cartões desta estação pedem revisão: ~${minutos} min`,
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
 * O MAPA DE DOIS EIXOS (S16b, 04/11/2026): as frases que dizem o que o desenho
 * mede, para quem lê com leitor de tela.
 *
 * Por que mora aqui e não dentro de `core/mapa-rede.js`: o desenho é DOM-free e
 * devolve string, e um rótulo escrito no meio dele seria frase que ninguém
 * revisa — regra 7 da casa. Os NOMES dos estágios são os de `ESTAGIOS_DO_EIXO`
 * (core/eixos.js) traduzidos, literais: um estágio do núcleo sem par aqui é
 * "nome de estágio inventado", item da lista do proibido abaixo, e a trava
 * `mapa: todo estágio do núcleo tem nome` cai.
 *
 * O plural segue a regra da S15b-fix: «1 percorrida», «2 percorridas», e o que é
 * zero NÃO aparece na frase — 0 «concluídas antes» não é informação, é ruído.
 */
export const mapa = Object.freeze({
  // O rótulo de sempre: quem não traz eixos (o cartão do link, S11) descreve a
  // viagem, não a medida. Continua byte a byte o mesmo de antes da S16b.
  rotuloViagem: (feitas, total) => `Mapa da rede: ${feitas} de ${total} estações concluídas`,
  /** [singular, plural] de cada estágio medido, na ordem em que a frase os lista. */
  estagios: Object.freeze({
    embarcada: ['embarcada', 'embarcadas'],
    'em-percurso': ['em percurso', 'em percurso'],
    percorrida: ['percorrida', 'percorridas'],
    'concluida-antes': ['concluída antes', 'concluídas antes'],
    fora: ['fora da rota', 'fora da rota'],
  }),
  /**
   * «35 estações: 2 em percurso, 1 percorrida, 3 concluídas antes, 29 fora da
   * rota. 1 pede revisão.»
   *
   * `contagens` vem do desenho (uma contagem por estágio), `pedindoRevisao` é
   * quantas estações estão abaixo do limiar de recuperabilidade. A frase dos
   * estágios só existe se houver o que contar; sem eixos nenhum, o que se lê é
   * `semMedida`, porque «0 em tudo» descreve a tela, não a pessoa.
   */
  rotuloEixos: (total, contagens, pedindoRevisao = 0) => {
    const umOUVarios = (n, caso) => (Number(n) === 1 ? caso[0] : caso[1]);
    const partes = Object.entries(mapa.estagios)
      .map(([estagio, caso]) => {
        const n = Number(contagens?.[estagio]) || 0;
        return n ? `${n} ${umOUVarios(n, caso)}` : null;
      })
      .filter(Boolean);
    const cabeca = `${total} ${umOUVarios(total, ['estação', 'estações'])}`;
    const corpo = partes.length ? `${cabeca}: ${partes.join(', ')}.` : `${cabeca} ainda sem medida.`;
    if (!pedindoRevisao) return corpo;
    return `${corpo} ${pedindoRevisao} ${pedindoRevisao === 1 ? 'pede revisão.' : 'pedem revisão.'}`;
  },
  /**
   * A LEGENDA do mapa de dois eixos (S16c, item 4 do desenho: J3 e princípio 1).
   *
   * Ela só existe quando há o que decifrar: com a rede toda vazia, "Cheio:
   * estudado" é uma frase sobre um desenho que não mudou. Por isso a tela a liga
   * por `estudadas > 0`, e não por «sempre».
   *
   * Duas cláusulas, dois canais, sem conselho: o desenho diz O QUE a forma
   * significa, nunca o que a pessoa deveria fazer com isso.
   */
  legenda: 'Cheio: estudado. Cor forte: lembrado depois.',
});

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
  abas: { jornada: 'Jornada', explorar: 'Explorar', revisar: 'Revisar', perfil: 'Perfil' },
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
  // S20a (J1/J5): o topo da Jornada. Os números chegam prontos de quem lê o
  // catálogo e o data/aulas/indice.json — nenhuma destas frases conhece um
  // total. `medidaSemAulas` é a linha honesta de quando o índice não veio: sem
  // ele não há 1.375 para escrever, e escrever um seria o defeito que o teste
  // «os números do topo são lidos, nunca escritos» existe para pegar.
  topo: Object.freeze({
    titulo: 'Ciência da Computação, aula por aula',
    medida: (disciplinas, fonte, aulas) =>
      `${disciplinas} disciplinas da ${fonte}, ${aulas.toLocaleString('pt-BR')} aulas. Estude uma, lembre amanhã, e o mapa acende.`,
    medidaSemAulas: (disciplinas, fonte) =>
      `${disciplinas} disciplinas da ${fonte}. Estude uma, lembre amanhã, e o mapa acende.`,
    comecar: 'Começar pela primeira aula',
    // S20a-3, o TERCEIRO caso da chave: quem tem viagem marcada mas nunca
    // abriu aula nenhuma no aparelho. Não é a primeira visita (a rede já tem
    // chão percorrido) nem a volta J5 (não há aula para retomar). O verbo é
    // "Começar", o objeto é a ESTAÇÃO — a mesma que a lateral chama de "Sua
    // próxima estação". "Pela primeira aula" não cabe aqui: a primeira aula
    // desta estação pode ser a 40ª disciplina da viagem.
    comecarEstacao: (estacao) => `Começar: ${estacao} · Aula 1`,
    marcar: 'Já estudei algumas disciplinas',
    apoioComecar: (estacao, n, duracao) =>
      [estacao, `Aula ${n}`, duracao].filter(Boolean).join(' · '),
    apoioVolta: (estacao, linha, duracao) =>
      [estacao, linha ? `Linha ${linha}` : null, duracao].filter(Boolean).join(' · '),
    mapaAcessivel: (total, feitas) =>
      `As ${total} estações da rede; ${feitas ? `${feitas} estudadas` : 'nenhuma estudada ainda'}`,
    // A fila do dia dita pelo topo (S15b item 4, adiada para a S16c). É um LINK,
    // nunca um segundo primário: quem voltou para estudar tem um caminho, e a
    // revisão é o convite discreto embaixo dele. Os números vêm de
    // `cartoesDevidos` e `minutosDaFila`, e a frase é a MESMA da aba Revisar —
    // dois textos para a mesma fila é a fila dizer duas coisas na mesma hora.
    // A frase é a DA ABABA, chamada e não copiada: dois textos para a mesma fila
    // é a fila dizendo duas coisas diferentes na mesma tela.
    revisoes: (cartoes, minutos) => revisar.hoje(cartoes, minutos),
  }),

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
  // Honestidade herdada da grade v1 (24/10/2026) e cobrada por teste desde
  // entao: eletivas vivem num bloco COMENTADO do README da UBL, e ramais sao
  // aprofundamento — nenhuma das duas conta no progresso. Uma lista que nao
  // diz isso sugere que tudo pesa igual.
  avisos: {
    ramais: 'Ramais dão aprofundamento em uma área — não somam à grade obrigatória nem contam no seu progresso.',
    eletivas: 'Eletivas arquivadas na fonte: não somam à grade obrigatória sem decisão editorial.',
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

/**
 * A REVISAR (S8, 01/11/2026): a fila do que já foi conectado, no tempo certo.
 *
 * Nenhuma frase daqui pergunta nada que o Atlas não tem aula para perguntar:
 * quem dá o conteúdo da revisão é a anotação da própria pessoa. E nenhuma frase
 * pesa o atraso — adiar não custa, esquecer só reagenda (JORNADA, "sem punição").
 */
export const revisar = Object.freeze({
  rotulo: 'Fortaleça o que você conectou',
  titulo: 'Revisar é reencontrar uma ideia no momento certo.',
  // ── ESTADO 1: a abertura da fila (S15b, J3.1) ─────────────────────────
  // Os dois números chegam de fora: o total é `cartoesDevidos` sem corte, o
  // minuto é `minutosDaFila`. Nenhuma destas frases conhece um total.
  // S15b-fix: a frase é lida em voz alta, e "1 cartões" não é uma frase. Um só
  // cartão é um caso que acontece toda sessão de fechamento, não uma borda.
  hoje: (cartoes, minutos) => `Revisões de hoje: ${cartoes} ${cartoes === 1 ? 'cartão' : 'cartões'}, ~${minutos} min`,
  // A linha do teto, que só existe quando a fila passa dele: o número é o
  // LIMITE_FILA do núcleo, lido pela tela, e nunca um "20" grafado aqui.
  corte: (limite) => `Você vai ver os ${limite} mais antigos; o resto espera sem pressa.`,
  comecar: 'Começar',
  // ── ESTADO 2: o cartão (J3.2) ─────────────────────────────────────────
  tentarLembrar: 'Tente lembrar antes de ver.',
  // A ORIGEM do cartão: "Aula 3 de Circuitos Digitais", ou só a estação quando
  // `n` é nulo (o cartão migrado da revisão antiga não é de aula nenhuma).
  origemAula: (n, estacao) => `Aula ${n} de ${estacao}`,
  origemEstacao: (estacao) => estacao,
  mostrarResposta: 'Mostrar a resposta',
  // Os dois do mesmo peso: nenhum é primário e nenhum tem cor de "certo".
  errei: 'Errei',
  lembrei: 'Lembrei',
  // A pergunta opcional. "Opcional" é da tela, não do texto: ninguém é obrigado
  // a avaliar a própria certeza, e a resposta sem confiança vale igual.
  seguro: 'Quão seguro você está?',
  confiancas: Object.freeze({
    certeza: 'Certeza',
    acho: 'Acho que sei',
    chute: 'Chute',
  }),
  // A posição na fila, lida como "onde estou", não como placar.
  posicao: (atual, total) => `${atual} de ${total}`,
  // ── ESTADO 3: o fim da sessão (J3.3) ──────────────────────────────────
  // Os DOIS números se flexionam, e zero é plural: "0 lembrados", não "0 lembrado".
  fim: (revisados, lembrados) => `${revisados} ${revisados === 1 ? 'revisado' : 'revisados'}, ${lembrados} ${lembrados === 1 ? 'lembrado' : 'lembrados'}.`,
  // "amanhã" é palavra, e não "em 1 dias": a frase é lida em voz alta.
  prazoAmanha: 'amanhã',
  prazoEmDias: (dias) => `em ${dias} dias`,
  proximaRevisao: (prazo) => `Próxima revisão ${prazo}.`,
  // A aula que passou a "lembrada" nesta sessão. Recebe o MESMO rótulo de origem
  // que o cartão mostra («Aula 3 de Circuitos Digitais»), e a lista de quais
  // aulas são decidida no núcleo (aulasLembradasNaSessao) — a tela só nomeia.
  aulaLembrada: (rotulo) => `${rotulo} agora está lembrada.`,
  voltarJornada: 'Voltar à Jornada',
  // ── ESTADO 4: em dia / sem cartão nenhum ──────────────────────────────
  // Estado "em dia": há cartões agendados, nenhum para hoje.
  emDia: 'Em dia.',
  proximaEm: (data) => `Próxima revisão em ${data}.`,
  semPressao: 'Sem pressão: se não puder revisar no dia, a revisão espera.',
  // Sem cartão nenhum: a fila é consequência do fechamento de aula, e é por lá
  // que ela começa. Não é "nenhuma revisão" — é "ainda não há o que revisar".
  comecaNoCartao: 'A revisão começa no primeiro cartão que você escrever ao fechar uma aula.',
  proximaAula: 'Ver a próxima aula',
  // S15b, item 3: os três passos numerados saíram da aba. O método cabe em uma
  // linha discreta, e ela só aparece no estado Em dia — quem está revisando não
  // precisa ler explicação no meio da sessão, e quem terminou tem calma para ler.
  metodo: 'Lembre antes de ver, responda com sinceridade, e o Atlas escolhe quando voltar.',
  /**
   * S15a — a migração da revisão antiga. Cada estação concluída COM anotação vira
   * um cartão, e a frente é a pergunta que a aba Revisar já fazia, agora escrita
   * no próprio cartão: «O que você leva de Circuitos Digitais?».
   *
   * O nome da estação é o do catálogo (regra 7: o número e o nome são do dado,
   * nunca escritos aqui); o verso é a anotação da pessoa, que já é dela. Não é
   * "o que você lembra" no infinitivo impessoal porque a resposta que a pessoa
   * deu um dia é uma posse, não uma prova.
   */
  frenteMigrada: (nome) => `O que você leva de ${nome}?`,
});

/**
 * O PERFIL (S9, 02/11/2026): o bilhete de carimbo, os marcos com critério
 * escrito e os dados da pessoa. É portfólio, não placar — por isso nenhuma
 * frase daqui conta dias sem fazer, promete recompensa ou nomeia o aluno por
 * pontuação. Os estados do marco vêm por palavra, nunca por só cor, e as
 * frases com valor recebem o valor (regra da casa: o número da tela é do
 * catálogo ou da viagem, jamais escrito aqui).
 */
export const perfil = Object.freeze({
  rotulo: 'Sua viagem',
  titulo: 'Cada carimbo é seu.',
  // Duas frases, e a segunda tem de começar por artigo: a tela cola as duas
  // com um espaço, e "Sem rede: … Revisite a página…" leria duas ordens para a
  // pessoa ("revisite" o quê?) onde a casa sempre escreveu "Revisite a página".
  erro: 'Sem rede: o catálogo não abriu.',
  erroOQueFazer: 'Revisite a página quando a trilha voltar.',
  emBranco: 'O primeiro carimbo vem da primeira estação concluída.',
  irParaProxima: 'Ir para a próxima estação',
  bilhete: 'O bilhete',
  casaCarimbada: (nome, data) => `${nome}, concluída em ${data}`,
  casaVazia: (nome) => `${nome}, ainda não`,
  numeros: Object.freeze({
    carimbos: 'Carimbos',
    linhas: 'Linhas fechadas',
    revisoes: 'Revisões feitas',
  }),
  marcos: Object.freeze({
    titulo: 'Marcos',
    // Os tipos vêm do núcleo (MARCOS), que escreve 'primeira_baldeacao' e
    // 'fim_da_linha'; este mapa é a tradução para a pessoa ler.
    nomes: Object.freeze({
      estacao: 'Primeira estação',
      primeira_baldeacao: 'Primeira baldeação',
      fim_da_linha: 'Fim da linha',
      terminal: 'Terminal',
    }),
    criterios: Object.freeze({
      estacao: 'Concluir uma estação.',
      primeira_baldeacao: 'Concluir uma estação que pede outra linha.',
      fim_da_linha: (porLinha) => `Concluir as ${porLinha} estações de uma linha.`,
      terminal: (total) => `Concluir as ${total} estações.`,
    }),
    estados: Object.freeze({
      conquistado: 'Concluído',
      em_andamento: 'Em andamento',
    }),
    conquistadoEm: (data) => `Concluído em ${data}.`,
    emAndamento: (conta) => `Agora: ${conta}.`,
  }),
  dados: Object.freeze({
    titulo: 'Seus dados',
    ficaAqui: 'Sua viagem fica só neste aparelho.',
    exportar: 'Exportar viagem',
    importar: 'Importar uma viagem',
    importLabel: 'Escolha o arquivo do Atlas',
    semDownload: 'Este navegador não deixou baixar o arquivo. Tente em outra janela.',
    semStorage: 'O aparelho não guardou: o que você importou vale só nesta tela.',
    // Função, não string: `exportarViagem` devolve o nome do arquivo gerado, e
    // o recado tem de nomear O QUE FOI FEITO. Como string, a tela imprimiria o
    // texto cru dentro do template e a pessoa leria "function" na tela.
    exportado: (nome) => `Baixado: ${nome}. Guarde onde você encontrar de novo.`,
    recusaPorque: 'O que chegou não tem o formato de uma viagem do Atlas.',
    recusaOQueFazer: 'Escolha um arquivo exportado pelo Atlas, ou exporte de novo.',
    importadoGuarda: 'O que já estava aqui foi preservado.',
  }),
  sobre: Object.freeze({
    titulo: 'Sobre',
    curriculo: 'Currículo: Universidade Brasileira Livre (licença MIT).',
    fonte: 'Fonte Overpass, licença SIL OFL 1.1.',
    codigo: 'Ver o código do Atlas',
    codigoUrl: 'https://github.com/lucas-gonzales-dev/atlas-ciencia-da-computacao',
  }),
});

/**
 * A LISTA DE AULAS da estação (S13a, 04/11/2026). A estação deixou de ser um
 * botão e passou a ter páginas: a folha mostra por onde continuar, a tela de
 * `aulas` mostra a playlist inteira com o estado de cada aula.
 *
 * `comecar` e `continuar` são as duas pontas do mesmo cartão: a primeira aula
 * ainda não aberta (J1, "Começar pela primeira aula") e a retomada depois de
 * dias (J5, "Continuar: Aula 13"). As duas frases existem separadas porque o
 * desenho as trata separadas — "começar" é um convite a quem ainda não entrou,
 * "continuar" é um ponto de retorno a quem já está dentro, e uma palavra só
 * mentiria em uma das duas telas. O `n` é a posição da aula na playlist e o
 * `titulo` vem da fonte; nada aqui é digitado à mão.
 *
 * `progresso` é a linha honesta da estação. S14b2 (04/11/2026) trocou o verbo:
 * conta AULAS ESTUDADAS, não abertas nem tempo assistido. O motivo é o gesto que
 * o Atlas cobra — abrir um vídeo não é memória, fechar com recordação e cartão é
 * — e a frase que dizia "abertas" contava como progresso o clique de quem só foi
 * ler um título. Quem chama passa o `restante` já lido de `duracaoLegivel`
 * (core/aulas.js) — a formatação da duração mora num lugar só (regra 9: a mesma
 * duração não pode aparecer escrita de dois jeitos em duas telas), e este
 * arquivo continua sem importar nada, como sempre esteve.
 */
export const aulas = Object.freeze({
  comecar: (n, titulo) => `Começar: Aula ${n} — ${titulo}`,
  continuar: (n, titulo) => `Continuar: Aula ${n} — ${titulo}`,
  verTodas: (total) => `Ver as ${total} aulas`,
  // S16c-fix (04/11/2026), item 3: `lembradas` entrou aqui porque a folha tinha
  // a MESMA contagem em duas linhas, uma sobre a outra. Saiu uma; e a que ficou
  // passou a dizer as duas medidas do desenho — o que foi estudado e o que foi
  // lembrado depois — na ordem do eixo que a pessoa percorre. Sem o quarto
  // argumento (a página de aulas, que não mede cartão) a frase é a de sempre,
  // byte a byte: é o que as travas de `aulas-tela` e `fechamento-nucleo` exigem.
  progresso: (estudadas, total, restante, lembradas = null) =>
    `${baseDaEstacao(estudadas, total)}${lembradasDepois(lembradas)} · faltam ~${restante}`,
  estados: Object.freeze({
    'nao-iniciada': 'Não iniciada',
    aberta: 'Aberta',
    // S14a: 'estudada' é o estado que conta para o mapa. A tela lê daqui, e
    // estadoDaAula devolve a mesma palavra — se uma existir e a outra não, a
    // lista de aulas desenha um estado sem nome para o leitor de tela.
    estudada: 'Estudada',
  }),
  assistir: 'Assistir no YouTube',
  // A etiqueta da linha de exercício na página de aulas (acabamento, item 3).
  // Sai do campo `exercicio` que core/aulas.js já calcula; nenhum texto é
  // inventado aqui a partir do título.
  etiquetaExercicio: 'Exercício',
  // A nota do primário da folha. S14b1 trocou o destino do toque: o primário
  // não abre mais o YouTube, abre a PÁGINA DA AULA dentro do Atlas, e é de lá
  // que se vai ao vídeo. A frase acompanha o que acontece, e não o que a S13b
  // fazia: "o Atlas te leva à aula", não "o YouTube te leva ao vídeo".
  notaAbrir: 'Abre a aula no Atlas, e de lá o vídeo.',
  // O endereço da página de aulas, e o que o leitor de tela fala ao chegar nela.
  // Com o nome da estação lido do catálogo, nunca digitado.
  tituloPagina: (estacao) => `Aulas de ${estacao}`,
  voltarPara: (estacao) => `← ${estacao}`,
  abrirPlaylist: 'Abrir a playlist no YouTube',
  // As três partes de sempre (o que falhou, por quê, o que fazer agora), como
  // em `estados.erro`. O motivo é verdade literal: as aulas moram no aparelho
  // só depois de uma visita com rede, e o service worker ainda não as tinha
  // quando o cache foi instalado.
  semAulas: Object.freeze({
    parteUm: 'As aulas desta estação não carregaram.',
    parteDois: 'O arquivo das aulas não está neste aparelho.',
    parteTres: 'Abra o Atlas com internet uma vez para guardar as aulas.',
  }),
});

/**
 * A PÁGINA DA AULA (S14b1, 04/11/2026) — design/v3/00-desenho.md, J2, passo 1.
 *
 * É a casa de uma aula dentro do Atlas. Antes dela o toque ia direto ao
 * YouTube e o Atlas só sabia que a aula fora aberta; agora o Atlas tem um lugar
 * para a pessoa VOLTAR — e é esse lugar que a S14b2 usa para fechar a aula.
 *
 * `anterior` e `proxima` andam em pares com a regra da tela: não há anterior na
 * primeira nem próxima na última, e por isso nenhuma das duas frases carrega o
 * "de mais nada" — a ausência é não desenhar o link, não um link que diz "não
 * tem".
 *
 * `naoExiste` são as três partes de sempre (o que falhou, por quê, o que fazer
 * agora), como em `aulas.semAulas`: um endereço com a aula 999 de uma estação de
 * 93 não é erro de sistema, é um pedido que o arquivo não atende, e a resposta
 * diz o tamanho real da estação em vez de "não encontrado".
 */
export const aula = Object.freeze({
  /** "Aula 3 de 93" — a posição, lida da playlist, nunca um índice de array. */
  de: (n, total) => `Aula ${n} de ${total}`,
  /** O nome que o casco põe na aba ("<rótulo> · Atlas") e no anúncio. */
  rotulo: (n, estacao) => `Aula ${n} · ${estacao}`,
  /** O anúncio de quem chega: diz qual aula, e o título dela vem da fonte. */
  anuncio: (n, total, titulo) => `Aula ${n} de ${total}: ${titulo}`,
  voltarParaAulas: (estacao) => `← Aulas de ${estacao}`,
  /**
   * O texto do primário. É o único botão da página que SAI do Atlas, e o verbo
   * diz a verdade: a pessoa vai ASSISTIR, não "abrir" (o abrir era a frase da
   * folha, e a folha não abre mais nada — leva à aula).
   */
  assistir: 'Assistir no YouTube',
  /**
   * S14c (04/11/2026): o separador das linhas de apoio da casa — "Aberta · 20
   * min". Mora aqui porque a tela não digita frase (regra 7), e o `·` entre dois
   * nós `<span>` precisa de uma origem: sem ela, o pixel vem de um literal na
   * tela e a frase completa vem de outro lugar, e os dois divergem.
   */
  separador: '·',

  /** O nome da região de navegação entre aulas, para quem percorre landmarks. */
  navRotulo: 'Aulas vizinhas',
  anterior: '← Aula anterior',
  proxima: 'Próxima aula →',
  naoExiste: Object.freeze({
    parteUm: 'Essa aula não está nesta estação.',
    /** "A estação tem 93 aulas." — o número é o do arquivo, lido na hora. */
    parteDois: (total) => `A estação tem ${total} ${total === 1 ? 'aula' : 'aulas'}.`,
    voltarParaAulas: (estacao) => `Ver as aulas de ${estacao}`,
  }),
});

/**
 * Os QUATRO modelos de frente do cartão (J2, passo 3), escolhidos por puxarem
 * PARÁFRASE e não decalque: "explique", "dê um exemplo", "qual a diferença",
 * "por que" são as quatro perguntas que uma resposta copiada não sobrevive. O
 * cartão nasce com a pergunta que a pessoa escolheu, e a frente é editável — o
 * modelo é um começo, não um formulário rígido.
 *
 * Moram aqui e são reexportados por core/cartoes.js (que é de onde a tela importa
 * o contrato do cartão): a lista é uma regra do cartão, e a frase é texto de tela
 * (regra 7). Um só lugar, dois caminhos.
 */
export const modelosDeFrente = Object.freeze([
  'Explique com suas palavras: ',
  'Dê um exemplo de ',
  'Qual a diferença entre … e …?',
  'Por que ',
]);

/**
 * O FECHAMENTO DA AULA (S14a, 04/11/2026) — design/v3/00-desenho.md, J2.
 *
 * É o coração do Atlas novo: a aula só conta quando a pessoa lembra sem olhar e
 * escreve ao menos um cartão. As três frases dos passos existem separadas porque
 * os passos são três gestos diferentes, e "escreva algo" no três vezes diria a
 * mesma coisa três vezes.
 *
 * `modoMinimo` não é uma versão pior do ciclo: é a porta para quem tem quatro
 * minutos e não vinte. Uma frase do que levou e uma pergunta já contam como
 * estudada, e a frase diz isso com as palavras do desenho, sem pedir desculpas.
 *
 * `feito` e `porHoje` olham o mesmo número (quantos cartões voltam amanhã) por
 * ângulos opostos: uma confirma o que foi feito, a outra mostra que o custo de
 * amanhã cabe em minutos. `pausas` recebe as MARCAS JÁ ESCRITAS
 * (`duracaoLegivel`/minutos, não segundos): a regra 9 da casa não permite duas
 * telas formatando o mesmo tempo de dois jeitos, e um texto de tela não sabe
 * dividir por 60.
 */
export const fechamento = Object.freeze({
  titulo: 'Fechar a aula',
  // S14b1: a frase que mora no lugar do formulário, antes dele existir. Não é
  // um aviso de "em breve" nem um placeholder: diz exatamente o que a pessoa
  // faz naquele ponto do caminho — assiste, volta, fecha aqui. A S14b2 põe o
  // formulário dentro do mesmo `<section>` e esta frase continua válida.
  quandoTerminar: 'Quando terminar de assistir, feche a aula aqui.',
  passoLembrar: Object.freeze({
    titulo: 'Sem olhar',
    pergunta: 'Sem rever nada: o que você lembra desta aula?',
  }),
  passoConferir: Object.freeze({
    titulo: 'Conferir',
    pergunta: 'Agora confira com o vídeo ou com as suas notas. O que faltou?',
  }),
  passoCartoes: Object.freeze({
    titulo: 'Cartões',
    pergunta: 'Escreva a pergunta que você quer saber responder daqui a uma semana.',
    frente: 'Pergunta',
    verso: 'Resposta',
    mais: 'Outro cartão',
    limite: 'Até 3 cartões por aula.',
  }),
  modoMinimo: Object.freeze({
    convite: 'Só uma frase e uma pergunta',
    frase: 'Em uma frase, o que você leva desta aula?',
  }),
  // S14b2: a saída do modo mínimo. É um link e não um botão porque não envia
  // nada: troca a forma do formulário. As duas frases andam juntas — um convite
  // sem volta é uma porta que só abre para dentro.
  modoCompleto: 'Fazer o fechamento completo',
  // S14b2: o relógio do passo 1 no zero. Não é "tempo esgotado" nem aviso de
  // erro: o relógio nunca trava nada, e a frase diz o que fazer agora.
  tempo: 'Tempo. Pode seguir.',
  // S14b2: o link do passo 2. "Reabrir" porque a pessoa já abriu — o vídeo está
  // na playlist dela, e conferir é voltar a ele com uma pergunta na cabeça.
  reabrir: 'Reabrir a aula no YouTube',
  /** "Origem: Aula 3 · Circuitos Digitais" — de onde o cartão veio, para quem
   *  relê o cartão daqui a um mês e não lembra em que estação o escreveu. */
  origem: (n, estacao) => `Origem: Aula ${n} · ${estacao}`,
  /** "Estudada em 04/11/2026" — a data do núcleo (AAAA-MM-DDTHH:MM), convertida
   *  pela casa (`dataDeCalendario`), que é a única forma de datas nesta arquivo. */
  estudadaEm: (quando) => `Estudada em ${dataDeCalendario(String(quando ?? '').slice(0, 10))}`,
  feito: (cartoes) => `Aula estudada. ${cartoes === 1 ? 'O seu cartão volta' : `Os seus ${cartoes} cartões voltam`} amanhã.`,
  proxima: (n, titulo, duracao) => `Próxima: Aula ${n} — ${titulo} (${duracao})`,
  porHoje: (cartoes, minutos) => `Por hoje está bom. Amanhã: ${cartoes} ${cartoes === 1 ? 'cartão' : 'cartões'}, ~${minutos} min.`,
  faltaLembrar: 'Escreva o que você lembra antes de fechar a aula.',
  faltaCartao: 'Escreva ao menos um cartão, com pergunta e resposta.',
  pausas: (marcas) => `Pausas sugeridas: ${marcas.join(' · ')}`,
  pausaConvite: 'Pare em cada pausa e tente explicar, sem voltar o vídeo, o que viu até ali.',
});

/** Tudo junto, para quem precisa percorrer (o teste percorre). */
export const TEXTOS = { placa, comValores, folha, estados, legenda, mapa, proibido, ORIGEM, TIPO_DE_ORIGEM, casco, jornada, explorar, chegada, revisar, perfil, aulas, aula, modelosDeFrente, fechamento };

export default TEXTOS;
