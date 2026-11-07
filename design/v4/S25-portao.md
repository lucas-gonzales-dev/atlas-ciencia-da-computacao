# S25: fechar a aula sem escrever, e o portão

A especificação inteira da fatia. Conteúdo e textos são do Claude; o conteúdo já está em `app/data/pratica/circuitos-digitais.json`.

## Por quê

O formulário de três caixas é onde a pessoa para. Fechar a aula passa a ser um gesto de toque. Escrever continua existindo, como escolha.

## Núcleo: `app/core/pratica.js` (puro, sem DOM)

- `lerPratica(bruto)`: recebe o objeto do JSON e devolve `{ paradas }`, descartando pergunta sem `id`, sem `pergunta`, sem `certa` ou sem nenhuma `erradas`. Entrada inválida devolve `{ paradas: [] }`, sem lançar.
- `paradaDaAula(pratica, n)`: a parada cujo `aulas` contém `n`, ou `null`.
- `QUANTAS_POR_AULA = 3`.
- `perguntasDaAula(pratica, n)`: as perguntas da parada, em rodízio: começa no índice `(posição de n em parada.aulas) * 3`, módulo o total, e pega 3. Aulas diferentes da mesma parada não começam na mesma pergunta. Sem parada, `[]`.
- `opcoesDaPergunta(pergunta)`: `certa` e as erradas numa ordem fixa para cada pergunta, sem sorteio: ordene pelo texto, com `localeCompare`. Devolve `[{ texto, certa: boolean, vao: string|null }]`.

Testes em `tests/pratica.test.js`, e um que varre o JSON real: toda pergunta passa no `lerPratica`, nenhum texto de errada é igual ao da certa, e nenhum `id` se repete.

## Dados

`app/web/aulas-dados.js` ganha `carregarPratica(slug)`: `fetch` de `data/pratica/<slug>.json`, e `null` em qualquer falha, sem lançar. Só existe o arquivo de `circuitos-digitais` por enquanto: 404 é o caso normal das outras estações, e não pode gerar erro de console por `console.error`.

## Textos: `core/textos.js`, objeto novo `portao`

```
titulo: 'O portão'
contagem: (i, total) => `Pergunta ${i} de ${total}`
vaoTitulo: 'Cuidado com o vão'
seguir: 'Próxima'
passar: 'Passar pelo portão'
passou: 'Portão aberto. Aula fechada.'
passouComVao: (n) => `Portão aberto. Você caiu em ${n} ${n === 1 ? 'vão' : 'vãos'} e saiu sabendo por quê.`
fechoSimples: 'Fechar a aula'
fechoSimplesTexto: 'Assistiu? Feche com um toque. Lembrar depois é o que dá cor à estação.'
fecharAgora: 'Fechar a aula'
escrever: 'Prefiro escrever o que lembrei'
```

## Tela: `app/web/telas/portao.js` e `portao.css`

`blocoFechoLeve(doc, { perguntas, aoFechar, aoEscrever })` devolve `{ section, h2 }`. A `section` tem as classes `aula-fim aula-fim-leve`, e o `h2` é `aula-fim-titulo`, com `tabindex="-1"`.

**Sem perguntas:** `h2` com `portao.fechoSimples`, o parágrafo `fechoSimplesTexto`, o botão primário `fecharAgora` e o link `escrever`.

**Com perguntas**, uma por vez:

```
h2 O portão
<p class="portao-contagem">Pergunta 1 de 3</p>
<div class="portao-via" aria-hidden="true"><i style="width: N%"></i></div>
<p class="portao-pergunta">…</p>
<div class="portao-opcoes"> <button class="portao-opcao" data-opcao="i">…</button> … </div>
<div class="portao-retorno"></div>
<a class="portao-escrever">Prefiro escrever o que lembrei</a>
```

- Toque na errada: o botão ganha `portao-opcao-errada` e `disabled`, soma 1 no contador de vãos, e `portao-retorno` recebe a faixa com o `vao` daquela resposta. A pessoa tenta de novo.
- Toque na certa: todos os botões ficam `disabled`, ele ganha `portao-opcao-certa`, `portao-retorno` recebe `explica` e o botão primário `seguir` (na última, `passar`), que recebe o foco.
- N é `(i / total) * 100`. Depois de `passar`, chama `aoFechar(vaos)`.
- A frase de retorno passa pelo `#anuncio` do casco, como o resto da página.

Faixa do vão:

```
<div class="vao"><div class="vao-faixa"></div><div class="vao-corpo"><b>Cuidado com o vão</b><span>…</span></div></div>
```

## CSS (só tokens)

Em `web/tokens.css`, nos dois temas: `--vao: #f2c200` e `--vao-escuro: #16130f`, com o comentário dizendo que a faixa da plataforma é a marca do erro, e a única coisa que usa esses tokens.

```css
.aula-fim-leve { display: grid; gap: var(--espaco-4); }
.portao-contagem { font-family: var(--fonte-mono); font-size: var(--tipo-nota); color: var(--fosca); margin: 0; }
.portao-via { height: var(--trilho); background: var(--cor-fraca); border-radius: var(--raio-selo); overflow: hidden; }
.portao-via i { display: block; height: 100%; background: var(--cor); transition: width var(--movimento-abrir) var(--curva-atlas); }
.portao-pergunta { font-size: var(--tipo-titulo); font-weight: var(--peso-placa); line-height: var(--entrelinha-titulo); margin: 0; }
.portao-opcoes { display: grid; gap: var(--espaco-2); }
.portao-opcao { min-height: var(--alvo-toque); padding: var(--espaco-3) var(--espaco-4); text-align: left; font: inherit; font-weight: var(--peso-forte); color: var(--tinta); background: var(--fundo); border: 2px solid var(--tinta); border-radius: var(--raio-placa); cursor: pointer; }
.portao-opcao:hover:not([disabled]) { background: var(--superficie); }
.portao-opcao-certa { background: var(--cor); border-color: var(--cor); color: var(--fundo); }
.portao-opcao-errada { opacity: .55; text-decoration: line-through; }
.portao-retorno { display: grid; gap: var(--espaco-3); }
.vao { border: 2px solid var(--tinta); border-radius: var(--raio-placa); overflow: hidden; }
.vao-faixa { height: var(--espaco-3); background: repeating-linear-gradient(135deg, var(--vao) 0 var(--espaco-4), var(--vao-escuro) var(--espaco-4) var(--espaco-8)); }
.vao-corpo { display: grid; gap: var(--espaco-1); padding: var(--espaco-3) var(--espaco-4); }
.portao-escrever { justify-self: start; }
```

O `opacity: .55` só vale se a trava de design-system aceitar; se recusar, troque por `color: var(--fosca)`.

## Na página da aula (`web/telas/aula.js`, por volta da linha 1152)

Se a aula não está estudada:

1. `const pratica = lerPratica((await carregarPratica(slug)) ?? {})`, e `perguntasDaAula(pratica, aula.n)`.
2. Monta o `blocoFechoLeve` no lugar do `blocoFechamento`.
3. `aoFechar(vaos)`: chama `estudarAula(estudoDoStorage(storage), { estacao, aula: aula.id, n: aula.n }, agoraLocal(win))`, sem textos, grava com `serializarEstudo`, e segue o mesmo caminho do `aoFechar` de hoje (`pintarMarca`, `pintarPulo`, `pintarConclusao`), com a frase `passouComVao(vaos)` se `vaos > 0`, `passou` se houve perguntas, e `F.estudadaEm(hoje())` se não houve.
4. `aoEscrever`: troca a seção pelo `blocoFechamento` de hoje, sem mudar nada nele.

`bloco` continua apontando para o que está na tela, para o resto da página funcionar.

**O formulário segue valendo:** os testes atuais dele não mudam. Em `montar`, aceite `ctx.comecarEscrevendo === true`, que pula direto para o `blocoFechamento`, e passe isso nos testes que já existem. Em produção, ninguém passa.

**O relógio de pausas:** o bloco do "8:00" e da frase de pausas sai da página da aula até o player embutido chegar. Remova a chamada de `blocoDePausas` em `montar`; a função e os textos ficam.

## Travas

- `tests/portao.test.js`, com o mini-DOM: errada mostra o `vao` certo e não avança; certa libera `seguir`; a última chama `aoFechar` com o número de vãos; sem perguntas, um toque fecha; `escrever` chama `aoEscrever`.
- A aula fechada pelo portão fica `estudada`, sem `recordacao` no estudo.
- Uma aula de estação sem arquivo de prática mostra o fecho simples, sem erro.
- `sw.js`: os 3 arquivos novos no PRECACHE, e o CSS linkado no `index.html`.
