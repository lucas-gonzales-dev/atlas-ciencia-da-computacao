// Projeto Atlas — levar o progresso junto (exportar/importar).
// TDD: escrito ANTES do codigo. Precisa falhar primeiro.
//
// Por que isto existe: o progresso mora no localStorage de UM navegador. O Lucas
// estuda no celular e no PC; sem exportar/importar, trocar de aparelho e comecar
// do zero — e o README dizia isso como limitacao aceita. Nao e mais.
//
// Regra de honestidade que estes testes cobram: um arquivo QUEBRADO nunca pode
// apagar o progresso que ja existe, e um id que nao pertence a este catalogo e
// ignorado E CONTADO na mensagem — nunca engolido em silencio, nunca aceito
// como se fosse real (isso faria o aluno ver "12/35 concluidas" sem 12 materias).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORMATO,
  VERSAO_FORMATO,
  buildExport,
  serializeExport,
  nomeDoArquivo,
  parseImport
} from '../core/progress-io.js';
import { aplicarImportacao } from '../web/main.js';

// ─── S20b-1b: os baldes que a viagem não era ───
// Os dados abaixo não são JSON escrito à mão: `lerCartoes`/`lerEstudo` exigem
// `versao` e conferem campo a campo, e um literal chutado aqui faria a trava
// morrer na forma em vez de no comportamento. Tudo nasce dos criadores do core.
import { criarCartao, lerCartoes, serializarCartoes, CARTOES_KEY } from '../core/cartoes.js';
import {
  ESTUDO_KEY,
  abrirAula,
  chaveRascunho,
  estudarAula,
  lerEstudo,
  lerRascunho,
  rascunhoVazio,
  serializarEstudo,
  serializarRascunho
} from '../core/estudo.js';
import { criarDoc, storageCom, todos } from './hdom.js';
import { montar } from '../web/telas/aula.js';
import { readFileSync } from 'node:fs';
import { agendarConclusao } from '../core/revisao.js';
// S20b-8: as transições da viagem que produzem as datas e o em curso. O arquivo de
// backup é escrito a partir delas, e não de objeto literal: só assim a trava mede o
// que o core decide gravar, em vez de medir a forma que eu escolhi escrever aqui.
import { lerProgresso, iniciarEstacao, concluirEstacao } from '../core/viagem.js';
import { importarViagem } from '../core/dados-pessoa.js';

const CURSOS = [
  { id: 'logica', title: 'Logica de Programacao' },
  { id: 'python-1', title: 'Python I' },
  { id: 'eda', title: 'Estruturas de Dados' }
];
const IDS = new Set(CURSOS.map((c) => c.id));
const AGORA = new Date('2026-10-27T03:15:00.000Z');

// ---------- exportar ----------

test('exportar declara formato e versao: sem isso, importar e adivinhacao', () => {
  const pacote = buildExport(CURSOS, ['logica'], AGORA);
  assert.equal(pacote.formato, FORMATO);
  assert.equal(pacote.versao, VERSAO_FORMATO);
  assert.equal(typeof pacote.exportadoEm, 'string');
  assert.deepEqual(pacote.completed, ['logica']);
});

test('exportar so leva ids que existem neste catalogo (nao exporta lixo)', () => {
  const pacote = buildExport(CURSOS, ['logica', 'fantasma', 'eda'], AGORA);
  assert.deepEqual(pacote.completed, ['logica', 'eda']);
  assert.equal(pacote.ignorados, 1, 'o que ficou de fora precisa estar dito no proprio arquivo');
});

test('o arquivo exportado volta pelo importador (ida e volta sem perda)', () => {
  const texto = serializeExport(CURSOS, ['logica', 'eda'], AGORA);
  assert.doesNotThrow(() => JSON.parse(texto), 'tem de ser JSON de verdade');
  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.equal(r.ignorados, 0);
});

test('o nome do arquivo diz o que e e de quando e', () => {
  assert.equal(nomeDoArquivo(AGORA), 'atlas-progresso-2026-10-27.json');
});

// ---------- importar: o que e aceito ----------

test('importar aceita o array cru do localStorage (formato antigo, sem envelope)', () => {
  const r = parseImport('["logica","eda"]', CURSOS);
  assert.equal(r.ok, true, 'quem guardou o conteudo do storage a mao nao pode ser punido');
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
});

test('id desconhecido e ignorado E CONTADO na mensagem', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: ['logica', 'curso-que-nao-existe'] }), CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed, ['logica']);
  assert.equal(r.ignorados, 1);
  assert.match(r.mensagem, /1/, 'a mensagem precisa dizer QUANTOS foram ignorados');
  assert.match(r.mensagem, /ignor/i);
});

test('nenhum id conhecido: importa vazio e avisa, em vez de fingir sucesso', () => {
  const r = parseImport('["outro-catalogo"]', CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed, []);
  assert.match(r.mensagem, /0 disciplinas|nenhuma/i);
});

test('duplicatas nao viram duas disciplinas concluidas', () => {
  const r = parseImport('["logica","logica","eda"]', CURSOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
});

// ---------- importar: o que e recusado, com recado claro ----------

test('JSON quebrado: erro claro e NENHUM completed devolvido', () => {
  const r = parseImport('{"formato": "atlas.progresso", ', CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /json/i, 'o aluno precisa saber que o arquivo nao e legivel');
  assert.equal('completed' in r, false, 'sem completed: quem chama nao tem o que salvar por engano');
});

test('arquivo vazio ou so espaco: erro claro, nao JSON.parse de ""', () => {
  for (const vazio of ['', '   ', '\n']) {
    const r = parseImport(vazio, CURSOS);
    assert.equal(r.ok, false);
    assert.match(r.erro, /vazio|sem conteudo/i);
  }
});

test('objeto sem versao do formato e recusado (nao adivinho o que e)', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /vers[aã]o/i);
});

test('versao do futuro: recusa dizendo qual versao este Atlas entende', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO + 1, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, new RegExp(String(VERSAO_FORMATO)), 'a mensagem diz ate onde este Atlas vai');
});

test('formato que nao e do Atlas: recusa dizendo o formato que veio', () => {
  const r = parseImport(JSON.stringify({ formato: 'outra-coisa', versao: 1, completed: ['logica'] }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /outra-coisa/, 'dizer o que veio ajuda a descobrir o arquivo errado');
});

test('completed que nao e lista: recusa em vez de quebrar depois', () => {
  const r = parseImport(JSON.stringify({ formato: FORMATO, versao: VERSAO_FORMATO, completed: 'logica' }), CURSOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /lista|completed/i);
});

test('texto que nao e string (numero, null, objeto) nao derruba o importador', () => {
  for (const ruim of [null, undefined, 42, {}, []]) {
    const r = parseImport(ruim, CURSOS);
    assert.equal(r.ok, false, `devia recusar: ${JSON.stringify(ruim)}`);
  }
});

// ---------- a regra que importa de verdade: nao destruir o que ja existe ----------

test('arquivo quebrado NAO apaga o progresso que ja existe', () => {
  const antes = ['logica', 'python-1'];
  const r = aplicarImportacao({ completed: antes, courses: CURSOS }, '{ quebrado');
  assert.equal(r.ok, false);
  assert.deepEqual(r.completed, antes, 'o estado devolve o progresso intacto');
  assert.equal(typeof r.mensagem, 'string');
  assert.ok(r.mensagem.length > 10, 'recado vazio e o mesmo que falhar em silencio');
});

test('importacao boa troca o progresso e diz quantas disciplinas entraram', () => {
  const r = aplicarImportacao({ completed: ['logica'], courses: CURSOS }, '["logica","eda"]');
  assert.equal(r.ok, true);
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.match(r.mensagem, /2/);
});

test('aplicarImportacao nao muta o array de progresso que recebeu', () => {
  const antes = ['logica'];
  aplicarImportacao({ completed: antes, courses: CURSOS }, '["eda"]');
  assert.deepEqual(antes, ['logica'], 'mutar o estado do chamador e bug invisivel');
});

test('sanidade da fixture: os ids usados existem mesmo no catalogo de teste', () => {
  for (const id of ['logica', 'python-1', 'eda']) assert.ok(IDS.has(id));
});

// ═════════════════════════ S20b-1b · o backup leva a viagem inteira ═════════════════════════
//
// POR QUE EXISTE: a versão 2 parava na viagem. Quem exportava no celular e
// importava no PC levava os 35 carimbos e perdia cada aula aberta, cada aula
// estudada, cada cartão escrito e cada rascunho pela metade — ou seja, levava o
// mapa e deixava o percurso. Pior: importar um arquivo de ontem APAGARIA os
// cartões de hoje se o importador lesse «ausente» como «vazio». As travas abaixo
// cobram as duas coisas: o que o arquivo diz, e o que ele NÃO diz.
//
// DADOS QUE NASCEM DO CORE, não JSON escrito à mão: `lerEstudo`/`lerCartoes`
// exigem `versao` e conferem campo a campo, e um literal chutado aqui provaria a
// forma em vez do comportamento. Estudo vem de `abrirAula` + `estudarAula`,
// cartão vem de `criarCartao`, rascunho vem de `rascunhoVazio`.
//
// O "byte a byte" é a frase whole: comparo o TEXTO DO STORAGE que saiu com o que
// volta, sem remixar nada no meio. É a única comparação que pega o campo que
// alguém esqueceu de serializar — um deepEqual de objetos ignoraria chave
// desaparecida nos dois lados.

const QUANDO = '2026-10-27T03:15';

/** Uma vida pequena e real: duas aulas abertas, uma estudada, um cartão, um rascunho. */
function vida() {
  let estudo = abrirAula(lerEstudo(null), { estacao: 'logica', aula: 'vid-1', n: 1 }, QUANDO);
  estudo = abrirAula(estudo, { estacao: 'eda', aula: 'vid-2', n: 2 }, QUANDO);
  estudo = estudarAula(estudo, { estacao: 'logica', aula: 'vid-1', n: 1 }, QUANDO, {
    recordacao: 'XOR é soma binária sem vai-um.',
    conferencia: 'Faltou o caso do carry.'
  });

  let arquivo = lerCartoes(null);
  const criado = criarCartao(arquivo, {
    estacao: 'logica', aula: 'vid-1', n: 1,
    frente: 'O que é XOR?', verso: 'Soma binária sem vai-um.'
  }, QUANDO, 'cartao-1');
  assert.equal(criado.ok, true, `o núcleo recusou o cartão de cena: ${criado.erro}`);
  arquivo = { versao: arquivo.versao, cartoes: criado.cartoes };

  const rascunho = { ...rascunhoVazio(), lembrar: 'Ainda não fechei a aula 2.' };

  return {
    estudo: serializarEstudo(estudo),
    cartoes: serializarCartoes(arquivo),
    rascunhos: { [chaveRascunho('vid-2')]: serializarRascunho(rascunho) }
  };
}

const EXTRAS = (v) => ({ estudo: v.estudo, cartoes: v.cartoes, rascunhos: v.rascunhos });

test('S20b-1b · exportar e importar devolve o mesmo estudo, os mesmos cartões e os mesmos rascunhos, byte a byte', () => {
  const v = vida();
  const texto = serializeExport(CURSOS, ['logica'], AGORA, { logica: 'travei em indução' }, EXTRAS(v));
  const r = parseImport(texto, CURSOS);

  assert.equal(r.ok, true, r.erro);
  assert.equal(r.estudo, v.estudo, 'o estudo voltou remixado: o export não está gravando o texto do serializador dono');
  assert.equal(r.cartoes, v.cartoes, 'os cartões voltaram remixado: id, devidoEm ou fsrs se perderam na volta');
  assert.deepEqual(r.rascunhos, v.rascunhos, 'o rascunho ficou de fora — quem exporta no celular reabre a aula do PC com o campo vazio');

  // Os três baldes têm de dizer que FALARAM: `null` é «o arquivo não falou», e um
  // v3 que leva estudo mudo cairia aqui antes de apagar seja o que for.
  assert.equal(r.trazEstudo, true);
  assert.equal(r.trazCartoes, true);
  assert.equal(r.trazRascunhos, true);

  // Byte a byte de verdade: exportar de novo o que acabou de voltar dá o mesmo texto.
  const v2 = { estudo: r.estudo, cartoes: r.cartoes, rascunhos: r.rascunhos };
  const segundaVolta = serializeExport(CURSOS, r.completed, AGORA, r.anotacoes, EXTRAS(v2));
  assert.equal(segundaVolta, texto, 'ida e volta não é idempotente: um campo está entrando por uma porta e saindo por outra');

  // A mensagem diz o que entrou, na voz da casa (licão de 28/10: plural escolhido,
  // nunca «(s)» na tela do aluno).
  assert.match(r.mensagem, /estudo de 2 aulas/);
  assert.match(r.mensagem, /1 cartão veio junto/);
  assert.match(r.mensagem, /1 rascunho veio junto/);
});

test('S20b-1b · um arquivo da versão 2 importa sem perder a viagem e sem apagar os cartões do aparelho', () => {
  // O arquivo de OUTUBRO: envelope v2, revisões e anotações, e nenhuma palavra
  // sobre estudo, cartões, rascunhos ou dominadas. É o backup real de quem
  // exportou antes desta fatia.
  // O calendário de revisão na FORMA DO CORE (agendarConclusao), não um literal
  // chutado: `degrau`/`proxima`/`historico` são o que sanitizar devolve adiante.
  const revisoesV2 = agendarConclusao(agendarConclusao({}, 'logica', '2026-10-20'), 'eda', '2026-10-20');
  const v2 = JSON.stringify({
    formato: FORMATO,
    versao: 2,
    exportadoEm: '2026-10-20T10:00:00.000Z',
    completed: ['logica', 'eda'],
    ignorados: 0,
    anotacoes: { logica: 'nota de outubro' },
    revisoes: revisoesV2
  }, null, 2) + '\n';

  const r = parseImport(v2, CURSOS);
  assert.equal(r.ok, true, `recusar o arquivo de ontem é punir o aluno pelo app que ele tinha: ${r.erro}`);

  // A viagem voltou.
  assert.deepEqual(r.completed.sort(), ['eda', 'logica']);
  assert.deepEqual(r.anotacoes, { logica: 'nota de outubro' });
  assert.equal(r.trazAnotacoes, true);
  assert.equal(r.revisoes.logica.proxima, '2026-10-23', 'o calendário de revisão não pode se perder na migração (concluída em 20/10, degrau 0 = 3 dias)');
  assert.equal(Object.keys(r.revisoes).length, 2, 'as duas estações revisáveis do arquivo têm de voltar');

  // E os baldes que o arquivo não conhece ficam CALADOS: `null` é o sinal de
  // «mantém o que este aparelho tem». Um `{}` aqui apagaria a fila da pessoa por
  // causa de um formato que ela não escolheu.
  assert.equal(r.estudo, null, 'o v2 não fala de estudo: devolver vazio seria gravar vazio no destino');
  assert.equal(r.cartoes, null, 'o v2 não fala de cartões: devolver vazio seria apagar a fila do aparelho');
  assert.equal(r.rascunhos, null);
  assert.equal(r.dominadas, null);
  assert.equal(r.trazEstudo, false);
  assert.equal(r.trazCartoes, false);
  assert.equal(r.trazRascunhos, false);
  assert.equal(r.trazDominadas, false);

  // Dito em voz alta: a pessoa lê por que seus cartões continuaram aqui.
  assert.match(r.mensagem, /O arquivo não traz cartões: os cartões deste aparelho continuam como estavam\./);
  assert.match(r.mensagem, /não traz estudo/);
  assert.match(r.mensagem, /não traz rascunhos/);
  assert.match(r.mensagem, /não traz estações dominadas/);

  // O outro lado do mesmo contrato: quem aplica mantém. `aplicarImportacao` é a
  // porta da tela, e ela continua devolvendo a viagem lida do arquivo.
  const aplicado = aplicarImportacao({ completed: ['python-1'], courses: CURSOS }, v2);
  assert.equal(aplicado.ok, true);
  assert.deepEqual(aplicado.completed.sort(), ['eda', 'logica']);
});

test('S20b-1b · uma dominada com os números volta inteira', () => {
  // O carimbo do desafio (S18b-2, desenho J4): a estação dominada é a única coisa
  // que prova que o desafio aconteceu, e a frase da tela sai destes números. Perder
  // `acertos` é ganhar um carimbo escrito com número inventado.
  const dominadas = {
    logica: { em: '2026-10-25', acertos: 7, total: 9, lembrados: ['vid-1', 'vid-2'], aulas: 12, cartoes: 30 }
  };
  const texto = serializeExport(CURSOS, ['logica'], AGORA, {}, { dominadas });
  const pacote = JSON.parse(texto);
  assert.deepEqual(pacote.dominadas, dominadas, 'o export remixou o carimbo (ou esqueceu de levá-lo)');

  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.dominadas, dominadas);
  assert.equal(r.trazDominadas, true);
  assert.match(r.mensagem, /1 estação dominada veio junto/);

  // E o contrário exato: sem dominada de verdade, o campo NÃO ENTRA no arquivo.
  // Um `{}` dentro do v3 significaria «apaga o carimbo do outro aparelho».
  const sem = JSON.parse(serializeExport(CURSOS, ['logica'], AGORA, {}, EXTRAS(vida())));
  assert.equal('dominadas' in sem, false, 'um `{}` no arquivo é uma ordem de apagar, não um vazio decorativo');
  const rSem = parseImport(JSON.stringify(sem), CURSOS);
  assert.equal(rSem.dominadas, null);
  assert.equal(rSem.trazDominadas, false);
  assert.match(rSem.mensagem, /não traz estações dominadas/);
});

// ─────────────── S20b-8: a data de conclusão e o que está em curso vão no arquivo ───────────────
//
// O defeito foi MEDIDO no Chrome (06/11/2026): exportar e importar num aparelho novo
// dava `conclusoes: {"ubl-core-introducao-cc-python-i": "2026-09-20"}` antes e
// `conclusoes: {}` depois. A estação seguia concluída — o que se perdia era O DIA, e
// é dele que a caderneta faz o carimbo (core/caderneta.js). Os dados abaixo nascem de
// `iniciarEstacao` e `concluirEstacao` (core/viagem.js), nunca de objeto escrito à mão:
// a data do carimbo é o que essas funções decidem gravar, e um literal aqui provaria
// a forma, não o comportamento.

test('S20b-8 · exportar e importar devolve os mesmos conclusões e o mesmo em curso', () => {
  // Uma viagem real: lógica iniciada e concluída, eda iniciada, python-1 no aparelho
  // sem nada. `concluirEstacao` remove do em curso e grava a data; `iniciarEstacao`
  // põe no em curso sem tocar em datas. É o par de transições que a tela faz.
  let p = lerProgresso(null);
  p = iniciarEstacao(p, 'logica', CURSOS);
  p = iniciarEstacao(p, 'eda', CURSOS);
  p = concluirEstacao(p, 'logica', '2026-10-20', CURSOS);
  assert.deepEqual(p.conclusoes, { logica: '2026-10-20' }, 'a cena não nasceu como o core a faz nascer');
  assert.deepEqual(p.emCurso, ['eda'], 'a cena não nasceu como o core a faz nascer');

  const v = vida();
  const texto = serializeExport(CURSOS, p.completed, AGORA, {}, {
    ...EXTRAS(v), conclusoes: p.conclusoes, emCurso: p.emCurso
  });
  const pacote = JSON.parse(texto);
  assert.deepEqual(pacote.conclusoes, p.conclusoes, 'o export remixou ou esqueceu o dia de cada conclusão');
  assert.deepEqual(pacote.emCurso, p.emCurso, 'o export esqueceu o que está em curso');

  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.conclusoes, p.conclusoes, 'a data de conclusão se perdeu na volta — a caderneta chega muda no aparelho novo');
  assert.equal(r.trazConclusoes, true);
  assert.deepEqual(r.emCurso, p.emCurso, 'em curso se perdeu na volta');
  assert.equal(r.trazEmCurso, true);

  // A data NÃO é recalculada na volta: «concluída em 20/10» vira «concluída hoje» se
  // alguém saneia o campo com uma data nova, e o carimbo contaria outra viagem.
  assert.equal(r.conclusoes.logica, '2026-10-20', 'a data foi reescrita no import');

  // Byte a byte, como a trava dos baldes: exportar de novo o que acabou de voltar.
  const segunda = serializeExport(CURSOS, r.completed, AGORA, r.anotacoes, {
    ...EXTRAS({ estudo: r.estudo, cartoes: r.cartoes, rascunhos: r.rascunhos }),
    conclusoes: r.conclusoes, emCurso: r.emCurso
  });
  assert.equal(segunda, texto, 'conclusões ou em curso entram por uma porta e saem por outra');
});

test('S20b-8 · um arquivo que não fala deles mantém os do aparelho', () => {
  // O `dominadas` já abriu este caminho (S20b-1b); estes dois ficaram para trás, e
  // é por isso que o backup de outubro perde a data. Devolver `{}` de um v2 seria
  // ordem de apagar as datas de quem importar — pior que não levar nada.
  const revisoesV2 = agendarConclusao(agendarConclusao({}, 'logica', '2026-10-20'), 'eda', '2026-10-20');
  const v2 = JSON.stringify({
    formato: FORMATO,
    versao: 2,
    exportadoEm: '2026-10-20T10:00:00.000Z',
    completed: ['logica', 'eda'],
    ignorados: 0,
    anotacoes: {},
    revisoes: revisoesV2
  }, null, 2) + '\n';

  const r = parseImport(v2, CURSOS);
  assert.equal(r.ok, true, r.erro);
  assert.equal(r.conclusoes, null, 'o v2 não fala de datas: devolver vazio apagaria a viagem do aparelho');
  assert.equal(r.trazConclusoes, false);
  assert.equal(r.emCurso, null, 'o v2 não fala de em curso: devolver [] seria esvaziar a intenção');
  assert.equal(r.trazEmCurso, false);

  // O outro lado, que é a tela: quem aplica mantém. `importarViagem` recebe o estado
  // do aparelho e é ele quem devolve o par `traz…`/valor.
  const noAparelho = lerProgresso({ completed: ['logica'], conclusoes: { logica: '2026-09-20' }, emCurso: ['eda'] });
  const aplicado = importarViagem(v2, {
    courses: CURSOS, completed: noAparelho.completed,
    conclusoes: noAparelho.conclusoes, emCurso: noAparelho.emCurso
  });
  assert.equal(aplicado.ok, true, aplicado.erro);
  assert.deepEqual(aplicado.conclusoes, { logica: '2026-09-20' }, 'importar backup velho rebaixou a data de conclusão');
  assert.deepEqual(aplicado.emCurso, ['eda'], 'importar backup velho esvaziou o que estava em curso');
});

test('S20b-8 · vazio no aparelho não cria a chave no arquivo', () => {
  // `{}` ou `[]` dentro do v3 significariam «apaga o que o outro aparelho tem». O
  // arquivo que não tem a coisa fica CALADO sobre ela, como já faz com as dominadas.
  const v = vida();
  const pacote = JSON.parse(serializeExport(CURSOS, ['logica'], AGORA, {}, {
    ...EXTRAS(v), conclusoes: {}, emCurso: []
  }));
  assert.equal('conclusoes' in pacote, false, 'um `{}` no arquivo é uma ordem de apagar, não um vazio decorativo');
  assert.equal('emCurso' in pacote, false, 'um `[]` no arquivo é uma ordem de apagar, não um vazio decorativo');

  const r = parseImport(JSON.stringify(pacote), CURSOS);
  assert.equal(r.conclusoes, null);
  assert.equal(r.trazConclusoes, false);
  assert.equal(r.emCurso, null);
  assert.equal(r.trazEmCurso, false);
});

test('S20b-8 · o importador rejeita lixo sem derrubar o resto da viagem', () => {
  // A malha é a de `lerProgresso`: data fora de AAAA-MM-DD derruba o registro, não o
  // objeto; `emCurso` que não é lista é «não falou» (o arquivo está ilegível nesse
  // campo), e `conclusoes` texto idem. Um arquivo editado à mão não pode apagar nem
  // inventar dia, e não pode travar a importação inteira.
  const v = vida();
  const texto = JSON.stringify({
    ...JSON.parse(serializeExport(CURSOS, ['logica', 'eda'], AGORA, {}, EXTRAS(v))),
    conclusoes: { logica: '2026-10-20', eda: 'ontem', python: 42 },
    emCurso: ['python-1', 7, 'python-1']
  }, null, 2);

  const r = parseImport(texto, CURSOS);
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.conclusoes, { logica: '2026-10-20' }, 'a data ilegível entrou no arquivo do destino');
  assert.deepEqual(r.emCurso, ['python-1'], 'o id que não é string ou a lista duplicada passou pela malha');
  assert.equal(r.trazConclusoes, true);
  assert.equal(r.trazEmCurso, true);

  // E a forma errada do campo inteiro: `null`, texto, lista. Não-falou, não-vazio.
  for (const lixo of [null, 'conclusoes', ['logica']]) {
    const bruto = JSON.stringify({
      ...JSON.parse(serializeExport(CURSOS, ['logica'], AGORA, {}, EXTRAS(v))),
      conclusoes: lixo, emCurso: lixo === null ? 'eda' : lixo
    });
    const rr = parseImport(bruto, CURSOS);
    assert.equal(rr.ok, true, rr.erro);
    assert.equal(rr.conclusoes, null, `conclusoes=${JSON.stringify(lixo)} deveria ser ilegível, não vazio`);
    assert.equal(rr.trazConclusoes, false, 'campo ilegível não pode virar ordem de apagar');
  }
});

// ─────────────── S20b-1b item 2: o persist, uma vez só, depois do primeiro cartão ───────────────
//
// web/telas/aula.js:523 já chama navigator.storage.persist() na primeira vez que
// a pessoa cria um cartão. Não se escreve um segundo: o que falta é uma trava que
// prove (a) que ele não é chamado antes de existir o primeiro cartão, e (b) que
// ele não vira um toque por cartão. O rastro abaixo anota, em cada chamada,
// QUANTOS cartões havia no storage naquele instante — é a única forma de provar a
// ordem sem fingir um navegador.
const AULAS = JSON.parse(readFileSync(new URL('../data/aulas/circuitos-digitais.json', import.meta.url), 'utf8'));
const CATALOGO = { courses: [{ id: 'circuitos-digitais', slug: 'circuitos-digitais', title: 'Circuitos Digitais' }] };

async function paginaDeAula({ storage = storageCom(), n = 3 }, rastro) {
  const doc = criarDoc();
  doc._registrar('anuncio', doc.createElement('p'));
  const win = {
    localStorage: storage,
    document: { visibilityState: 'visible' },
    matchMedia: () => ({ matches: false }),
    scrollTo: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    navigator: {
      storage: {
        persist: () => {
          rastro.chamadas.push(Object.keys(lerCartoes(storage.getItem(CARTOES_KEY)).cartoes).length);
          return Promise.resolve(true);
        }
      }
    }
  };
  const raiz = doc.createElement('div');
  await montar(raiz, {
    document: doc,
    window: win,
    catalogo: Promise.resolve(CATALOGO),
    folha: 'circuitos-digitais',
    n,
    buscarAulas: async () => ({ ok: true, status: 200, json: async () => AULAS })
  });
  const comClasse = (c) => todos(raiz, (x) => (x.className || '').split(/\s+/).includes(c));
  const porData = (chave, valor) => todos(raiz, (x) => x.getAttribute?.(chave) === valor)[0] || null;
  const section = () => comClasse('aula-fim-form')[0];
  const escrever = (nome, valor) => {
    const alvo = porData('data-campo', nome);
    alvo.value = valor;
    section().dispatch('input', { target: alvo });
  };
  return {
    escrever,
    enviar: () => comClasse('fechamento-form')[0].dispatch('submit', { preventDefault() {} }),
    temFormulario: () => comClasse('fechamento-form').length
  };
}

test('S20b-1b · o persist é chamado uma vez só, e nunca antes do primeiro cartão', async () => {
  const rastro = { chamadas: [] };
  const storage = storageCom();

  const aula = await paginaDeAula({ storage }, rastro);
  assert.deepEqual(rastro.chamadas, [], 'a tela pediu persistência ao abrir a aula: antes de existir cartão não há o que proteger, e o pedido em silêncio aparece como pergunta');

  aula.escrever('lembrar', 'XOR é soma binária sem vai-um.');
  aula.escrever('conferir', 'Faltou o caso do carry.');
  aula.escrever('frente-0', 'O que é XOR?');
  aula.enviar();
  assert.deepEqual(rastro.chamadas, [], 'um cartão incompleto pedido persistência: o persist só pode vir depois de haver o primeiro cartão GRAVADO');

  aula.escrever('verso-0', 'Soma binária sem vai-um.');
  aula.enviar();
  assert.equal(rastro.chamadas.length, 1, 'o primeiro cartão da vida não chamou navigator.storage.persist()');
  assert.ok(rastro.chamadas.every((n) => n >= 1), `o persist foi chamado com o storage ainda sem cartão (rastro: ${rastro.chamadas})`);

  // Segunda aula, MESMO aparelho, cartões já existindo: nada de novo pedido.
  const outra = await paginaDeAula({ storage, n: 4 }, rastro);
  outra.escrever('lembrar', 'Portas NAND são funcionais completas.');
  outra.escrever('frente-0', 'O que uma NAND faz?');
  outra.escrever('verso-0', 'Inverte o AND; com várias dela, qualquer circuito.');
  outra.enviar();
  assert.equal(rastro.chamadas.length, 1, 'o persist virou um toque por cartão: quem fecha dez aulas recebe dez pedidos silenciosos');
});

