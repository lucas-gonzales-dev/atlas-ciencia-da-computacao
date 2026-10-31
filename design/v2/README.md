# Atlas v2 — a experiência inteira

O Atlas sai de "tela do metrô + página antiga azul-marinho" para **um app de quatro abas**
(Jornada, Explorar, Revisar, Perfil). A v2 junta três coisas:

- a **marca definitiva** (livro aberto, sol, cúpula com estrela, a palavra "atlas");
- a **direção visual e de experiência** desenhada no Lovable em 30/10/2026;
- o que o Lovable **não fez**: tema escuro, estados de carregamento, vazio, erro e offline,
  revisão espaçada de verdade, persistência, PWA e teclado.

O protótipo do Lovable (React, projeto "Atlas Brand Identity") foi lido **uma vez, pelo juiz**,
e traduzido aqui. **Quem implementa não lê o código do Lovable.** Ele é protótipo: tem
aulas, perguntas, XP e números inventados, e o Atlas não inventa nada.

## Como uma fatia vira pedido

Cada fatia é um arquivo `Sn-*.md`, do tamanho de um turno. O pedido inteiro é este:

> Fatia Sn do Atlas v2: leia `design/v2/00-regras.md` e `design/v2/Sn-<nome>.md` e implemente.

Nada mais deve ser preciso. Se faltar informação, o arquivo da fatia está incompleto:
pare e diga o que falta, em vez de adivinhar. Quem completa o arquivo é o juiz.

| fatia | arquivo | o que entrega | publica no marco |
|---|---|---|---|
| S1 | `S1-marca.md` | ícones, favicon, manifesto e a marca no topo | A |
| S2 | `S2-base.md` | tokens novos, fundo do escuro, foco, Overpass, pulso finito, seletor de linhas em `<button>` | A |
| S3a | `S3a-casco.md` | uma casa só: rotas por hash, topo, abas, anúncio e foco, Jornada e Explorar montadas | B |
| S3b | `S3b-paleta.md` | a paleta azul-marinho (`--p-*`) morre; o `metro.html` vira redirecionamento | B |
| S4 | `S4-jornada.md` | a Jornada no layout do Lovable, com dado real | C |
| S5 | `S5-estacao.md` | a folha da estação, com rota própria | C |
| S6 | `S6-chegada.md` | concluir vira momento: "Conexão criada" e "Desfazer" | C |
| S7 | `S7-explorar.md` | a rede inteira com busca, filtro de linha, ramais e eletivas | D |
| S8 | `S8-revisar.md` | revisão espaçada com a anotação da própria pessoa | E |
| S9 | `S9-perfil.md` | bilhete com carimbos, marcos com critério e seus dados | E |
| S10 | `S10-auditoria.md` | auditoria de ponta a ponta: estados, movimento, teclado, temas, offline | F |

O push é do Lucas, por marco. O juiz confere cada fatia antes da próxima. S4 em diante é
**revisto pelo juiz contra o código do momento** antes de ir, porque as fatias anteriores
mudam os nomes.

## O que veio do Lovable, e como entra no Atlas

| no Lovable | no Atlas | por quê |
|---|---|---|
| 4 abas: Jornada, Explorar, Revisar, Perfil | **adotado**, rotas por hash (`#/`, `#/explorar`, `#/revisar`, `#/perfil`, `#/estacao/<slug>`) | PWA estático sem servidor de rotas; o hash funciona offline e no Cloudflare Pages |
| barra inferior com rótulo no celular, abas no topo no computador | **adotado** | rótulo sempre visível (Nielsen 6: reconhecer em vez de lembrar) |
| "Pular para o conteúdo", anúncio "<Página> aberta." | **adotado** | teclado e leitor de tela |
| página inteira da estação | **folha** no celular, **painel** no computador, com rota própria | é o que a ficha de componentes do próprio Lovable pede, e o mapa fica à vista |
| lição com pergunta e correção | **não**: vira "Sua anotação", nas palavras da pessoa, sem correção | o Atlas não hospeda aula; pergunta corrigida seria conteúdo inventado |
| "+40 XP", "Ritmo: 1 dia", troféu | **não**: progresso é **carimbo no bilhete**; conquista é **marco** com critério escrito | o perfil C (quem volta depois de semanas) desiste com sequência e pontos (JORNADA.md) |
| "Etapa 1–3", nomes como "Fundamentos" | **Linha 1–7, sem nome** | a fonte não nomeia os estágios |
| cores em oklch | **os hex do `tokens.css`** | o contraste AA está medido e testado nos hex |
| sombra dura `4px 4px 0` | **`--sombra-placa`, só na placa da próxima estação** | é a elevação real da tela, a única coisa "levantada" |
| foco de 3 px com afastamento de 3 px | **adotado** | mais visível que os 2 px de hoje |
| movimento 120/200/320 ms, curva `0.22, 1, 0.36, 1`, cascata de 50 ms | **adotado como tokens**, com a mecânica de 100 ms mantida | o DS já fixa a mecânica em até 120 ms |
| pulso infinito na estação em curso | **2 ciclos e para** | WCAG 2.2.2: movimento automático que passa de 5 s precisa poder parar |
| esqueleto com `animate-pulse` | **esqueleto parado** (regra que o Atlas já tem) | brilho ou pulso de esqueleto é spinner disfarçado |
| sem tema escuro | **toda tela nasce nos dois temas** | o Atlas já tem o escuro em carvão |
| logo definitivo em PNG | **marca no topo, ícones e favicon** | as cores do logo são da imagem e **não viram tokens de interface** |

## Estados por tela (nada fica sem saída)

| tela | carregando | vazio / primeira vez | sem resultado | erro | offline |
|---|---|---|---|---|---|
| Jornada | esqueleto parado: placa cinza, traço e 5 círculos, depois de 150 ms | embarque: "Bem-vindo ao embarque" + marcar o que já estudou | — | erro em 3 partes (o quê, por quê, o que fazer) | selo discreto "offline" |
| Estação | — (o catálogo já chegou) | estação que não existe: "Essa estação não está no mapa." + Voltar ao mapa | — | — | o recurso externo pode não abrir: dizer que é fora do Atlas |
| Explorar | esqueleto parado: 5 linhas cinza | — | "Nada encontrado" + Limpar busca | erro em 3 partes | selo |
| Revisar | — | nenhuma concluída: "Revisar começa na primeira estação concluída." + Ir para a próxima estação | em dia: "Em dia. Próxima revisão em dd/mm/aaaa." | — | selo |
| Perfil | — | bilhete em branco: "O primeiro carimbo vem da primeira estação concluída." | — | importação recusada: o quê, por quê, o que fazer | selo |
| Terminal | — | as 35 concluídas: o texto do Terminal | — | — | — |

## Decisões arbitradas (sem fonte; mudam com evidência)

- Intervalos de revisão: 3, 7, 21, 60 e 180 dias.
- No máximo 3 revisões sugeridas por dia; o resto espera sem aviso de atraso.
- "Retida" = a pessoa disse "lembrei" numa revisão de intervalo de 21 dias ou mais.
- Painel da estação no computador: 480 px de largura.
- Altura da marca no topo: 24 px.
