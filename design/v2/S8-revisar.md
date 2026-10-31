# S8 — Revisar: revisão espaçada com a anotação da própria pessoa

> Revisto pelo juiz antes de ir.

**Objetivo.** A aba Revisar traz de volta, no tempo certo, as estações concluídas. O
Lovable inventou perguntas; o Atlas não tem aula para perguntar. Quem dá o conteúdo da
revisão é a **anotação da própria pessoa** ("Em uma frase, o que você leva desta
estação?"), e o método é o do Lovable: tentar lembrar antes de ler, conferir, voltar
depois. **Sem punição**: atrasar não pesa, e esquecer só reagenda.

## Arquivos
`app/core/revisao.js` (novo, puro), `app/tests/revisao.test.js` (novo, na lista do
`npm test`), `app/web/telas/revisar.js` e `revisar.css` (novos), `app/core/rotas.js`
(a aba entra em `ABAS`), `app/index.html` (o link da aba), `app/core/progress-io.js`
(exportar e importar levam as revisões), `app/core/textos.js`, `app/sw.js`.

## A regra (arbitrada; muda com evidência)
- Intervalos por degrau: `[3, 7, 21, 60, 180]` dias.
- Uma estação concluída no dia D entra na fila em D + 3 (degrau 0).
- Resultado da revisão: `lembrei` sobe um degrau (até o 4); `em-parte` mantém o degrau;
  `nao-lembrei` volta ao degrau 0. A próxima data é o dia da revisão mais o intervalo do
  degrau.
- **Retida**: a pessoa disse `lembrei` numa revisão cujo intervalo era de 21 dias ou mais.
- A fila do dia: as estações com data até hoje, da mais atrasada para a mais recente, **no
  máximo 3**. O resto espera, sem aviso de atraso.
- Desfazer a conclusão de uma estação tira as revisões dela.
- Guardado em `localStorage`, na chave `atlas.revisoes.v1`:
  `{ [id]: { degrau, proxima: 'aaaa-mm-dd', historico: [{ data, resultado }] } }`.
  `progress-io` exporta e importa esse objeto como o campo opcional `revisoes`; um arquivo
  sem o campo importa normalmente.

## `core/revisao.js`
`INTERVALOS`, `agendarConclusao(revisoes, id, data)`,
`registrarRevisao(revisoes, id, resultado, data)`, `filaDoDia(revisoes, hoje, limite = 3)`,
`proximaData(revisoes)`, `estaRetida(revisoes, id)`, `removerEstacao(revisoes, id)`. Todas
devolvem objeto novo, sem mutar a entrada. Datas sempre `aaaa-mm-dd` locais (`dataLocal`).

## A tela
1. Rótulo `FORTALEÇA O QUE VOCÊ CONECTOU`; `h1` "Revisar é reencontrar uma ideia no momento
   certo."
2. **Com fila**: a placa `SUA PRÓXIMA REVISÃO` com o nome da estação e a linha;
   "Tente lembrar antes de abrir sua anotação."; secundário "Mostrar minha anotação". Ao
   mostrar: o texto da anotação (ou "Você não deixou anotação nesta estação." e o link do
   curso). Depois, três botões do mesmo peso, **nenhum primário**: "Lembrei", "Lembrei em
   parte", "Não lembrei". A resposta grava, mostra "Volta em <n> dias." e passa para a
   próxima da fila. O aviso de baixo oferece "Desfazer" por 6 s.
3. **Em dia** (há revisões, nenhuma para hoje): "Em dia." e "Próxima revisão em
   dd/mm/aaaa." e "Sem pressão: se não puder revisar no dia, a revisão espera."
4. **Nada para revisar** (nenhuma concluída): "Revisar começa na primeira estação
   concluída." e o primário "Ir para a próxima estação".
5. **Como funciona** (sempre, no fim): três cartões numerados, 01 "Tente lembrar" ("Antes
   de ler, puxe da memória."), 02 "Confira" ("Sua anotação mostra o que você levou."),
   03 "Volte depois" ("O Atlas sugere quando vale reencontrar.").

## Testes primeiro (`tests/revisao.test.js`)
1. Concluir em 01/11 agenda para 04/11, degrau 0.
2. `lembrei` em 04/11 vai ao degrau 1 e agenda para 11/11; `em-parte` mantém o degrau e
   agenda pelo intervalo dele; `nao-lembrei` volta ao 0.
3. O degrau não passa de 4.
4. `filaDoDia` devolve no máximo 3, da mais atrasada para a mais recente, e nada do futuro.
5. `estaRetida` é falso até um `lembrei` com intervalo de 21 ou mais, e verdadeiro depois.
6. `removerEstacao` tira a estação; as outras ficam.
7. As funções não mutam o objeto recebido.
8. `progress-io`: exportar leva `revisoes`; importar um arquivo antigo, sem o campo,
   funciona e não apaga as revisões que existem.

## `testar_pagina`
Abra `index.html`. Passos: esperar 500; clicar "Revisar"; esperar 400. Confira nos 4
tamanhos: zero erro; numa primeira visita, "Revisar começa na primeira estação concluída."
O juiz confere a fila com uma viagem preparada.
