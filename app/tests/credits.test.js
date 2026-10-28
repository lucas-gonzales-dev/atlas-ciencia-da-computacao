// Projeto Atlas — testes de CREDITOS e LICENCA (entrega de 24/10/2026).
//
// O Atlas vai ser publico: repositorio aberto e post do Lucas no LinkedIn.
// Antes disso ele precisa dizer de onde vem o curriculo e o que a licenca da
// fonte exige. Tudo o que este teste cobra foi LIDO, nao lembrado: o repositorio
// oficial da UBL (Universidade-Livre/ciencia-da-computacao) foi clonado em
// atlas-planning-kit/source e fixado no SHA auditado b995c11. La dentro:
//   - LICENSE e MIT, "Copyright (c) 2021 Universidade Brasileira Livre";
//   - git shortlog -sn no SHA auditado lista 13 autores;
//   - o README da UBL repete "MIT License" e nao pede atribuicao em texto proprio.
//
// A regra e a mesma dos outros itens: nada inventado. O CREDITS.md cita o SHA
// completo, nomeia a licenca real, lista os nomes reais sem e-mail, e diz que os
// recursos externos (cursos, videos, livros) pertencem aos autores deles — o
// Atlas so aponta, nao redistribui.
//
// A licenca do CODIGO do Atlas foi DECIDIDA pelo Lucas em 28/10/2026: MIT, com
// "Copyright (c) 2026 Lucas Leite Gonzales". Ate essa data havia aqui um teste
// de NAO-ACAO que reprova se existisse LICENSE na raiz — ele foi escrito para
// esperar a decisao, e a decisao veio. O ultimo teste agora cobra o contrario:
// LICENSE existe, e MIT, e traz o aviso de copyright do Lucas. Se um dia a
// licenca mudar sem o README e o CREDITS.md mudarem junto, ele falha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHA_AUDITADO = 'b995c118fdb3929412004ee041a25c77cb0aa997';

// Os 13 nomes do `git shortlog -sn` no SHA auditado, na ordem do proprio git.
const AUTORES = [
  'Camilo Cunha de Azevedo',
  'Mateus Roveda',
  'Emanuel Castelo',
  'Henrique Sebastião',
  'Jonathan',
  'Carlos Bazilio',
  'Carlos Mondo',
  'Daniele Karoline',
  'Felipe',
  'Igor Vinoski',
  'Jefferson Quesado',
  'Leonel M. Morgado',
  'Yúri Kerber',
];

function urlDaRaiz(nome) {
  return new URL('../../' + nome, import.meta.url);
}

function ler(nome) {
  return readFileSync(urlDaRaiz(nome), 'utf8');
}

function secao(texto, titulo) {
  const linhas = texto.split('\n');
  const comeco = linhas.findIndex((l) => l.startsWith('## ') && l.includes(titulo));
  if (comeco === -1) return '';
  const fim = linhas.findIndex((l, i) => i > comeco && l.startsWith('## '));
  return linhas.slice(comeco, fim === -1 ? linhas.length : fim).join('\n');
}

test('CREDITS.md existe e cita o SHA auditado da fonte', () => {
  const t = ler('CREDITS.md');
  assert.ok(t.includes(SHA_AUDITADO), 'precisa citar o SHA completo auditado, nao so o prefixo');
  assert.ok(t.includes('b995c11'), 'precisa citar tambem o SHA curto como o kit o chama');
  assert.ok(t.includes('Universidade-Livre/ciencia-da-computacao'), 'precisa citar o repositorio oficial');
});

// O CREDITS.md e documento para gente ler — post do Lucas, repositorio publico —
// entao e escrito em portugues correto, com acento ("currículo"). O teste confere
// a palavra sem exigir grafia sem acento: quem manda no texto e o documento, nao
// o assert. Normalizar so aqui, e nao no helper `ler`, porque os nomes dos
// autores ("Henrique Sebastião") sao conferidos COM acento, como o git os traz.
function semAcento(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

test('CREDITS.md diz o que o Atlas usa da UBL', () => {
  const n = semAcento(ler('CREDITS.md')).toLowerCase();
  assert.ok(n.includes('curricul'), 'precisa dizer que usa o curriculo');
  assert.ok(n.includes('links'), 'precisa dizer que usa os links');
  assert.ok(n.includes('não usa') || n.includes('nao usa') || n.includes('não redistribui'),
    'precisa dizer o que o Atlas NAO faz com a fonte');
});

test('CREDITS.md nomeia a licenca real da fonte e o que ela exige', () => {
  const n = ler('CREDITS.md').toLowerCase();
  assert.ok(n.includes('mit'), 'a licenca da UBL e MIT');
  assert.ok(n.includes('universidade brasileira livre'), 'precisa citar o titular do copyright');
  assert.ok(n.includes('2021'), 'precisa citar o ano do copyright');
  assert.ok(n.includes('copyright'), 'MIT exige manter o aviso de copyright');
  assert.ok(n.includes('atribui'), 'precisa dizer que a unica exigencia e atribuicao/aviso');
  assert.ok(n.includes('comercial'), 'precisa dizer se o uso comercial e permitido');
  assert.ok(n.includes('mesma licen'), 'precisa dizer se exige ou nao a mesma licenca (MIT nao exige)');
  assert.ok(n.includes('garantia'), 'MIT vem sem garantia; o CREDITS precisa repassar isso');
});

test('CREDITS.md lista os 13 autores do git, sem e-mail', () => {
  const texto = ler('CREDITS.md');
  const secaoAutores = secao(texto, 'Quem fez');
  assert.ok(secaoAutores.length > 0, 'precisa existir uma secao "## Quem fez a UBL"');
  for (const nome of AUTORES) {
    assert.ok(secaoAutores.includes(nome), `falta o autor "${nome}"`);
  }
  const itens = secaoAutores.split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l));
  assert.equal(itens.length, AUTORES.length, 'a lista de autores tem de ter exatamente os 13 do git');
  assert.ok(!secaoAutores.includes('@'), 'nome sem e-mail: o shortlog foi lido com -sn');
});

test('CREDITS.md diz que os recursos externos pertencem aos autores deles', () => {
  const n = ler('CREDITS.md').toLowerCase();
  assert.ok(n.includes('recursos externos'), 'precisa haver uma secao sobre recursos externos');
  assert.ok(n.includes('pertencem'), 'precisa dizer que pertencem aos autores');
  assert.ok(n.includes('redistribu'), 'precisa dizer que o Atlas nao redistribui nada deles');
  assert.ok(n.includes('bibliografia'), 'a bibliografia das disciplinas e recurso externo');
});

test('README tem a secao "Créditos e licença" apontando para o CREDITS.md', () => {
  const t = ler('README.md');
  assert.ok(t.includes('Créditos e licença'), 'precisa existir a secao com esse titulo');
  assert.ok(t.includes('CREDITS.md'), 'a secao precisa apontar para o CREDITS.md');
  assert.ok(t.toLowerCase().includes('mit'), 'precisa citar a licenca da fonte');
});

test('LICENSE existe na raiz, e MIT e traz o copyright do Lucas', () => {
  assert.ok(existsSync(urlDaRaiz('LICENSE')),
    'a licenca foi decidida: o arquivo LICENSE precisa existir na raiz');
  const t = ler('LICENSE');
  assert.ok(t.includes('MIT License'), 'a decisao do Lucas foi MIT');
  assert.ok(t.includes('Copyright (c) 2026 Lucas Leite Gonzales'),
    'o aviso de copyright e do Lucas, com o ano e o nome completos');
  assert.ok(t.includes('Permission is hereby granted'),
    'MIT sem o texto de permissao nao e MIT');
  assert.ok(t.includes('WITHOUT WARRANTY OF ANY KIND'),
    'MIT sem a clausula de ausencia de garantia esta incompleta');
});

test('README e CREDITS.md dizem que a licenca e MIT, e nao que esta pendente', () => {
  const readme = ler('README.md');
  const credits = ler('CREDITS.md');
  assert.ok(readme.includes('Licença: MIT'), 'o README precisa ter a secao "Licença: MIT"');
  assert.ok(!readme.toLowerCase().includes('proposta'),
    'nada de licenca "proposta": ela ja foi escolhida');
  assert.ok(!credits.includes('não foi escolhida') && !credits.includes('nao foi escolhida'),
    'o CREDITS.md ainda dizia que a licenca nao foi escolhida');
  assert.ok(readme.includes('Lucas Leite Gonzales') || credits.includes('Lucas Leite Gonzales'),
    'o titular do copyright do Atlas precisa estar nomeado');
});
