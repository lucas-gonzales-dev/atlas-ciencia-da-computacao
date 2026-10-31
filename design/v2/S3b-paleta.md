# S3b — a paleta azul-marinho morre, e o metro.html vira um redirecionamento

**Objetivo.** O Atlas passa a ter **uma identidade só**. Os 29 tokens provisórios `--p-*`
(o azul-marinho que o Lucas rejeitou) saem do `tokens.css`, a grade antiga passa a usar os
tokens do DS, e o teste que hoje é `todo` vira teste de verdade.

## Arquivos
`app/web/grade.css`, `app/web/tokens.css` (apagar o bloco `--p-*` e o comentário
"PROVISÓRIOS" do topo), `app/tests/design-system.test.js` (o teste
`a paleta antiga (--p-*) não pinta mais nenhuma tela`), `app/metro.html` (reescrito),
`app/index.html` (só as metas `theme-color`), `app/sw.js`, e `design/README.md` (a seção
"Migração", uma linha dizendo que a S3b fechou a migração).

## Testes primeiro
1. Tire o `{ todo: … }` do teste `a paleta antiga (--p-*) não pinta mais nenhuma tela`. Ele
   fica vermelho (hoje acha 31 usos). Acrescente nele: `tokens.css` não declara nenhum
   `--p-`.
2. `metro.html é só um redirecionamento`: tem `<meta http-equiv="refresh" content="0; url=./#/">`,
   um link visível para `./#/`, nenhum `<script>` e nenhuma folha de estilo.
3. `index.html pinta papel e carvão`: duas metas `theme-color`, `#fbf7f0` com
   `media="(prefers-color-scheme: light)"` e `#17181a` com
   `media="(prefers-color-scheme: dark)"`.

## A troca (o mapa está nos comentários de cada `--p-*`)
| provisório | vira |
|---|---|
| `--p-fundo` | `--fundo` |
| `--p-cartao`, `--p-recurso-fundo`, `--p-botao-fundo`, `--p-aviso-fundo` | `--superficie` |
| `--p-borda` | `--borda` |
| `--p-texto`, `--p-link-biblio-forte` | `--tinta` |
| `--p-fosco`, `--p-nota`, `--p-esp-nota` | `--fosca` |
| `--p-trancado`, `--p-riscado` | `--trancada` |
| `--p-alerta`, `--p-obras-borda`, `--p-obras-texto`, `--p-obras-caixa-borda`, `--p-alerta-borda` | `--alerta` |
| `--p-alerta-fundo`, `--p-obras-fundo`, `--p-obras-caixa` | `--alerta-fundo` |
| `--p-link-biblio`, `--p-link-biblio-borda` | `--linha-6` |
| `--p-aberto`, `--p-feito`, `--p-aberto-borda`, `--p-feito-borda` | a cor da linha da disciplina: `var(--cor-linha)` |
| `--p-aberto-fundo`, `--p-feito-fundo` | `color-mix(in srgb, var(--cor-linha) 25%, var(--fundo))` |

Para `--cor-linha` existir em cada cartão: o cartão da grade ganha a classe `l<stage>`, e
o `grade.css` declara `.grade .l1 { --cor-linha: var(--linha-1); }` até `.l7`. Se o
`metro.css` já tiver essas classes com outra variável, use a dele em vez de criar outra
(procure por `.l1` com `buscar_arquivos`).

O estado da grade antiga ainda é mostrado pela cor; a forma certa chega na S7. Não
redesenhe nada aqui: é troca de token.

## `metro.html` novo
```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=./#/">
<link rel="canonical" href="./">
<title>Atlas</title>
</head>
<body>
<p><a href="./#/">O mapa do Atlas agora abre na Jornada.</a></p>
</body>
</html>
```
Quem tem o endereço antigo salvo (o post, o histórico) chega na Jornada. O `sw.js` mantém
`metro.html` no precache, porque o redirecionamento também precisa funcionar offline.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Explorar"; esperar 500. Confira nos 4
tamanhos: zero erro, nenhum fundo azul-marinho (o juiz confere a cor; a ferramenta lê o
texto). Abra `metro.html`: em até 1 s está no `index.html` com a Jornada.
