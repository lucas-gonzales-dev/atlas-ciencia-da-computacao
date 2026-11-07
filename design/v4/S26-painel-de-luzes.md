# S26: o Painel de Luzes

A especificação inteira da fatia. Conteúdo e textos são do Claude. É o primeiro jogo do Atlas, e o padrão dos seguintes: exercício com regra de jogo, com a ajuda sumindo aos poucos.

## Regras

- O jogo mora na estação, e não num fliperama separado.
- Sem pontos, sem relógio, sem vidas. Errar não custa nada: a pessoa mexe nas chaves até acertar.
- O nível fecha sozinho quando o número certo acende.
- Teclado e leitor de tela jogam igual: cada lâmpada é um `button` com `aria-pressed`.

## Núcleo: `app/core/luzes.js` (puro, sem DOM)

```js
export const LUZES_KEY = 'atlas.jogos.v1';
export const NIVEIS_DE_LUZES = Object.freeze([
  { bits: 4, alvo: 5, pede: '5', ajuda: true, sinal: false, ensina: 'Quatro lâmpadas, pesos 8, 4, 2, 1. Acender é somar.' },
  { bits: 4, alvo: 13, pede: '13', ajuda: true, sinal: false, ensina: '13 = 8 + 4 + 1. Comece sempre pelo maior peso que cabe.' },
  { bits: 6, alvo: 42, pede: '42', ajuda: false, sinal: false, ensina: 'Sem a soma na tela agora: 32 + 8 + 2. Reparou no desenho alternado?' },
  { bits: 8, alvo: 200, pede: '200', ajuda: false, sinal: false, ensina: '128 + 64 + 8. Oito lâmpadas são um byte.' },
  { bits: 8, alvo: 167, pede: '0xA7', ajuda: false, sinal: false, ensina: 'A = 1010 e 7 = 0111. Hexadecimal é binário de 4 em 4, e por isso ninguém faz conta longa.' },
  { bits: 8, alvo: -6, pede: '−6', ajuda: true, sinal: true, ensina: 'Em complemento de dois, a primeira lâmpada pesa −128: −128 + 122 = −6. É assim que a máquina guarda número negativo sem circuito novo.' },
]);
```

- `pesos(nivel)`: do maior para o menor; com `sinal`, o primeiro é negativo.
- `valor(nivel, chaves)`: a soma dos pesos das chaves ligadas.
- `resolveu(nivel, chaves)`: `valor === alvo`.
- `somaEscrita(nivel, chaves)`: `'32 + 8 + 2 = 42'`, com `'−128 + 64 + …'` quando houver negativo, e `'Tudo apagado: 0'` sem nada ligado.
- `lerJogos(bruto)`, `marcarJogo(jogos, 'luzes', quando)` e `serializarJogos(jogos)`, no mesmo jeito tolerante de `lerEstudo`: lixo vira `{ versao: 1, feitos: {} }`, e a primeira data de um jogo não se reescreve.

**O backup leva os jogos:** `core/progress-io.js` exporta e importa `atlas.jogos.v1` como já faz com o resto. Arquivo antigo, sem a chave, mantém o que está no aparelho.

## Rota

`#/estacao/<slug>/luzes` é painel, como `desafio`: `core/rotas.js` lê, `hrefDe` escreve, e `telaDaRota` em `web/casco.js` monta a tela `luzes`, importada em `TELAS` e com `CLASSE_DA_TELA.luzes = 'luzes'`.

Só `circuitos-digitais` tem o jogo. Com outro slug, a tela mostra `luzes.semJogo` e o link de volta para a estação.

## Textos: `core/textos.js`, objeto novo `luzes`

```
titulo: 'Painel de Luzes'
nivel: (n, total) => `Nível ${n} de ${total}`
acenda: 'Acenda'
comSinal: 'com sinal'
instrucao: 'Toque nas lâmpadas. Quando o número certo acender, o painel avisa.'
proximo: 'Próximo painel'
fechar: 'Fechar o painel'
fechou: 'Painel fechado. Você lê binário, hexadecimal e número negativo com as mãos.'
voltar: (estacao) => `Voltar para ${estacao}`
jogar: 'Jogar o Painel de Luzes'
jogarDeNovo: 'Jogar de novo'
semJogo: 'Esta estação ainda não tem painel.'
lampada: (peso, acesa) => `Lâmpada de peso ${peso}, ${acesa ? 'acesa' : 'apagada'}`
```

## Tela: `app/web/telas/luzes.js` e `luzes.css`

```
<section class="controle">
  <header class="controle-cabeca"> <span class="etiqueta-painel">Painel de Luzes · Nível 1 de 6</span> <span>com sinal</span> </header>
  <div class="controle-niveis" aria-hidden="true"> <i class="feito"></i> <i></i> … </div>
  <div> <span class="etiqueta-painel">Acenda</span> <div class="controle-visor">42</div> </div>
  <div class="lampadas"> <button class="lampada" aria-pressed="false" aria-label="…"><span class="vidro"></span><span class="chave"></span><span class="peso">32</span></button> … </div>
  <p class="controle-soma">…</p>
  <p class="controle-instrucao">…</p>   ou, ao resolver:
  <div class="controle-ensina">…</div> <button class="botao botao-primario">Próximo painel</button>
</section>
```

- Ao tocar: inverte a chave e repinta **só** as lâmpadas e a soma. Não remonte a seção: o foco fica na lâmpada.
- `controle-soma`: `somaEscrita` quando `nivel.ajuda`, ou quando já resolveu. Fora disso, vazia, com a altura mantida.
- Ao resolver: lâmpadas `disabled`, o texto `ensina` aparece, o botão recebe o foco, e `ensina` vai para o `#anuncio`.
- Depois do nível 6: `marcarJogo`, a frase `fechou`, e o link `voltar`.
- O painel é escuro nos dois temas: é um objeto, e não uma tela.

## CSS (só tokens)

Em `web/tokens.css`, os mesmos valores nos dois temas: `--painel: #1b1a18`, `--painel-2: #2a2826`, `--painel-tinta: #f4f1ec`, `--painel-fosca: #a9a397`, `--lampada: #ffc53d`, `--vidro-1: #4a4741`, `--vidro-2: #23211f`, `--lampada-miolo: #fff4cc`, `--chave: #cfc9bd`.

Adicione também `--lampada-tamanho: 44px`, `--chave-largura: 26px`, `--chave-altura: 42px`, `--tipo-visor: clamp(32px, 7vw, 52px)` e `--movimento-chave: 90ms`.

```css
.luzes { max-width: var(--largura-leitura); margin-inline: auto; padding: var(--espaco-4); display: grid; gap: var(--espaco-4); }
.controle { background: var(--painel); color: var(--painel-tinta); border-radius: var(--raio-placa); padding: var(--espaco-6); display: grid; gap: var(--espaco-6); box-shadow: var(--sombra-placa); }
.controle-cabeca { display: flex; justify-content: space-between; gap: var(--espaco-3); flex-wrap: wrap; }
.etiqueta-painel { font-size: var(--tipo-placa); font-weight: var(--peso-placa); letter-spacing: var(--espacamento-placa); text-transform: uppercase; color: var(--painel-fosca); }
.controle-niveis { display: flex; gap: var(--espaco-1); }
.controle-niveis i { flex: 1; height: var(--espaco-1); background: var(--painel-2); }
.controle-niveis i.feito { background: var(--lampada); }
.controle-visor { font-family: var(--fonte-mono); font-weight: var(--peso-forte); font-size: var(--tipo-visor); line-height: var(--entrelinha-apertada); color: var(--lampada); }
.lampadas { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--espaco-2); }
.lampada { display: grid; justify-items: center; gap: var(--espaco-2); min-width: var(--alvo-toque); padding: var(--espaco-1); background: none; border: 0; color: inherit; cursor: pointer; }
.lampada:focus-visible { outline-color: var(--lampada); }
.vidro { width: var(--lampada-tamanho); height: var(--lampada-tamanho); border-radius: var(--raio-estacao); background: radial-gradient(circle at 35% 30%, var(--vidro-1), var(--vidro-2)); transition: background var(--movimento-chave); }
.lampada[aria-pressed="true"] .vidro { background: radial-gradient(circle at 40% 35%, var(--lampada-miolo), var(--lampada) 62%); box-shadow: 0 0 24px 4px color-mix(in srgb, var(--lampada) 65%, transparent); }
.chave { position: relative; width: var(--chave-largura); height: var(--chave-altura); background: var(--painel-2); border-radius: var(--raio-placa); }
.chave::after { content: ""; position: absolute; inset-inline: 2px; bottom: 2px; height: var(--espaco-4); background: var(--chave); border-radius: var(--raio-selo); transition: bottom var(--movimento-chave); }
.lampada[aria-pressed="true"] .chave::after { bottom: 24px; background: var(--lampada); }
.peso { font-family: var(--fonte-mono); font-size: var(--tipo-nota); color: var(--painel-fosca); }
.controle-soma { min-height: var(--espaco-6); margin: 0; font-family: var(--fonte-mono); text-align: center; }
.controle-instrucao { margin: 0; font-size: var(--tipo-nota); color: var(--painel-fosca); }
.controle-ensina { padding: var(--espaco-3) var(--espaco-4); background: var(--painel-2); border-radius: var(--raio-placa); }
```

A única sombra do design system é a `--sombra-placa`. O brilho da lâmpada é o próprio objeto aceso, e é a exceção: se a trava de design-system recusar, acrescente ao teste uma exceção com esse motivo escrito, só para `.lampada[aria-pressed="true"] .vidro`.

## Por onde se chega

- Na página das aulas (`web/telas/aulas.js`), logo abaixo do resumo da estação, só em `circuitos-digitais`: o link `luzes.jogar` (ou `jogarDeNovo`, se já feito).
- Na conclusão de uma aula da parada `numeros` (`pintarConclusao`, em `web/telas/aula.js`): o mesmo link.

## Travas

- `tests/luzes.test.js`: para cada nível, existe combinação de chaves que resolve (força bruta), e `valor` é igual ao alvo nela; `resolveu` é falso com tudo apagado; `somaEscrita` nos três formatos; `lerJogos` tolera lixo; a primeira data não se reescreve.
- Com o mini-DOM: tocar muda `aria-pressed`; resolver mostra `ensina` e o botão; o nível 3 não mostra a soma antes de resolver; o último marca o jogo.
- O backup leva e traz `atlas.jogos.v1`, e um arquivo sem a chave mantém o do aparelho.
- A rota: `lerRota` e `hrefDe` vão e voltam; outro slug mostra `semJogo`.
- `sw.js`: os arquivos novos no PRECACHE, e o CSS linkado no `index.html`.
