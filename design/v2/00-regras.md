# Regras de toda fatia da v2

Valem em todas as fatias. Quando uma fatia contradiz isto, vale a fatia, e ela diz por quê.

## Ler pouco
1. Leia só: este arquivo, o `Sn` da fatia e os arquivos que ele lista em "Arquivos".
2. Arquivo grande: ache a função com `buscar_arquivos` e leia com faixa (`ler_arquivo` com
   `de`/`ate`). **Nunca leia inteiro** `tests/metro.test.js` (1300 linhas), `web/metro.js`
   (900) ou `web/main.js` (730).
3. Não abra o Lovable, nem as outras fatias. Se precisar de algo de fora, pare e diga o quê.

## Teste primeiro
4. Escreva os testes da fatia, rode, veja **vermelho pelo motivo certo**, implemente, veja
   verde.
5. **Arquivo de teste novo entra na lista do `"test"` em `app/package.json`.** Fora da lista
   ele não roda, e uma suíte verde que não roda o teste novo mente.
6. Dublê (fake) de módulo só com **teste de contrato contra o módulo real**: confira que os
   nomes e as assinaturas existem nos exports de verdade (o caso do `applyNote`, 94cb36c).

## O que nunca muda
7. Toda frase da tela mora em `app/core/textos.js`. Toda cor, tempo, tamanho, curva e ponto
   de quebra mora em `app/web/tokens.css`. A trava `tests/design-system.test.js` quebra se
   não for assim: não a contorne, use o token.
8. Dado só do catálogo (`id`, `slug`, `title`, `stage`, `prerequisites`, `resourceUrl`,
   `resourceType`, `bibliography`) e da viagem da pessoa. **Nada inventado:** nenhuma
   descrição de disciplina, carga horária, nome de linha ou pergunta de aula.
9. Proibido na tela: XP, pontos, sequência de dias, ranking, conquista sem critério escrito,
   confete, emoji, spinner, esqueleto com brilho ou pulso, animação infinita, sombra fora de
   `--sombra-placa`, azul-marinho.
10. Um botão primário por tela (e um por folha aberta).
11. Toda tela nasce nos dois temas (claro e escuro) e com movimento reduzido: com
    `prefers-reduced-motion`, o estado final aparece sem animação. Os tokens já zeram as
    durações; basta nunca escrever duração à mão.
12. Tudo que se clica é `<a>` ou `<button>`, nunca `span` ou `div` com clique. Alvo de toque
    de pelo menos `--alvo-toque` (44 px).
13. Data na tela: dd/mm/aaaa (`dataLocal` em `core/viagem.js`), nunca ISO.
14. Arquivo servido mudou: `VERSAO` do `sw.js` sobe 1, e `PRECACHE_HASH` acompanha. A falha
    de `node --test tests/sw-precache-hash.test.js` mostra o valor novo.
15. Arquivo de código novo com até 400 linhas. Se a fatia empurrar um arquivo além disso,
    divida pela responsabilidade (a tela X vai para `web/telas/x.js`).
16. Prova de mutação desfeita com `editar_trecho`, **nunca** com `git checkout` ou
    `git restore`.

## Fechamento (o relatório, nesta ordem, curto)
1. `npm test` (de `app/`): a linha com tests, pass, fail e todo, colada da saída.
2. Mutação: qual linha você quebrou, qual teste ficou vermelho, e que foi restaurada.
3. `testar_pagina`: os passos que a fatia pede, nos 4 tamanhos; os achados (zero ou a lista).
4. Commit: o hash e a mensagem `atlas v2 Sn: <o quê> (npm test T/P/F/todo)`.
5. O que ficou de fora, se ficou, e por quê.

**Não faça push.** Publicar é do Lucas.
