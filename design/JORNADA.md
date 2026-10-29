# Jornada — o Atlas como mapa de metrô

Documento de desenho. Fixa **quem usa, o que acontece em cada momento e quais são as
regras da progressão** antes de qualquer tela. A tela vem depois do design system;
este arquivo é o que ela tem de obedecer.

A metáfora foi escolhida pelo Lucas (28/10/2026) e os nomes dela são vocabulário
obrigatório no código, nos testes e na tela:

| metrô | Atlas | fonte |
|---|---|---|
| rede | a grade inteira | 35 disciplinas |
| **Linha 1 a 7** | os 7 estágios | `stage` do catálogo, sem nome inventado |
| **estação** | uma disciplina da grade | `courses[i]` |
| **baldeação** | pré-requisito entre linhas | `prerequisites` com `stage` diferente |
| **ramal** | especialização | `specializations` |
| **viagem** | o progresso da pessoa | formato v3 do progresso |
| **Terminal** | as 35 concluídas | estado final da grade |

Nenhuma linha tem nome próprio ("Linha de Fundamentos", "Linha de Sistemas"): a fonte
não nomeia os estágios, e o Atlas não inventa o que a fonte não tem.

---

## 1. Quem usa

**Não houve pesquisa com usuários.** Os três perfis abaixo são **hipóteses de desenho**:
servem para decidir o que a tela mostra primeiro, e devem ser tratados como coisa a
confirmar com gente real, não como fato. Quando houver evidência, este texto muda e a
mudança é registrada aqui.

### Perfil A — quem começa do zero
Nunca estudou Ciência da Computação de forma estruturada. Chegou por um post ou pelo
GitHub, não sabe o que é pré-requisito de Circuitos Digitais e não sabe quanto tempo
isso leva. **O que ele precisa:** uma próxima estação, não 35. **O que o faz desistir:**
ver a grade inteira de uma vez e sentir que é grande demais.

### Perfil B — quem já estudou parte
Fez faculdade, curso técnico ou bootcamp. Reconhece 8, 12, às vezes 20 das 35. Não quer
"começar do zero": quer marcar o que já é dele e ver o que **sobra**. **O que ele
precisa:** marcar muita coisa rápido, sem um clique por estação, e ver o mapa se
iluminar de uma vez. **O que o faz desistir:** ter de abrir cada disciplina para marcar;
e o Atlas tratar o que ele já sabe como se fosse novidade.

### Perfil C — quem volta depois de semanas
Começou bem, parou. Não lembra onde parou, e traz culpa junto. **O que ele precisa:** a
frase "sua próxima estação continua sendo X" e a última anotação à vista, sem ter de
procurar. **O que o faz desistir:** qualquer coisa que pareça punição — sequência
quebrada, contagem zerada, tom de cobrança. Se o Atlas o fizer sentir que perdeu algo,
ele não volta.

---

## 2. A jornada, momento a momento

Para cada momento: **o que a pessoa quer**, **o que a tela mostra**, **onde ela desiste**.

### 2.1 Chegar (vindo do GitHub ou do LinkedIn)
- **Quer:** saber em 10 segundos o que é isto e se serve para ela.
- **Mostra:** uma frase do que o Atlas é, o mapa com as 7 linhas visíveis, e o número
  honesto de estações. Nada de modal, nada de cadastro, nada de tour obrigatório.
- **Desiste se:** a primeira coisa que ela lê for um texto sobre o projeto em vez de
  sobre o que ela pode fazer; ou se a grade aparecer como uma tabela de 35 linhas.

### 2.2 Embarcar
- **Quer:** ou "por onde eu começo?" (perfil A) ou "marca logo o que eu já fiz"
  (perfil B).
- **Mostra:** duas saídas lado a lado, sem decidir por ela — **começar a viagem** (a
  primeira estação disponível) e **marcar o que já estudei** (modo de marcação em
  lote). Aqui, e uma vez só, a tela diz a frase de honestidade:
  *"O Atlas não tem como saber se você estudou: concluir é palavra sua."*
- **Desiste se:** o modo em lote não existir (perfil B abandona no terceiro clique);
  ou se a frase de honestidade aparecer como aviso de erro, em vez de aparecer como
  combinado.

### 2.3 Estudar
- **Quer:** ir para o recurso da estação e guardar o que pensar no caminho.
- **Mostra:** na estação, o recurso com a proveniência visível (de onde vem, o que a
  fonte diz dele) e o campo de anotação. Uma estação em curso é visível como em curso:
  o Atlas sabe o que ela abriu e não terminou.
- **Desiste se:** o recurso abrir sem dizer de onde veio (o Atlas perde a única coisa
  que o diferencia); ou se a anotação sumir ao recarregar.

### 2.4 Concluir
- **Quer:** a sensação de chegada, sem cerimônia longa.
- **Mostra:** a estação vira concluída, o carimbo entra no bilhete, e aparece
  **desfazer por alguns segundos**. A celebração tem o tamanho do feito (seção 4).
- **Desiste se:** concluir exigir confirmação em duas etapas; ou se desfazer não existir
  — um toque errado no celular custa caro, e o medo de errar trava a mão.

### 2.5 Avançar
- **Quer:** saber o que o gesto dela destrancou.
- **Mostra:** o que abriu, na ordem do mapa, **inclusive baldeação**: quando a estação
  concluída era pré-requisito de uma estação de outra linha, a tela nomeia a baldeação e
  mostra a linha de destino. Uma estação por vez como próximo passo; a lista completa
  fica a um toque, não na cara.
- **Desiste se:** o mapa não mudar visivelmente depois do gesto (o esforço parece não
  ter efeito); ou se a baldeação passar em silêncio — atravessar de linha é um feito e é
  tratado como rotina.

### 2.6 Marcos
- **Quer:** que o Atlas note o que é grande.
- **Mostra:** três marcos, e só três: **fim da linha** (5 de 5 → o selo da linha e o
  carimbo no bilhete), **primeira baldeação**, **Terminal**. Marco é calculado
  comparando o antes e o depois da ação (`marcosNovos`), não por uma tabela de
  conquistas escondida.
- **Desiste se:** marco aparecer por coisa pequena (concluir uma estação não é marco, é
  chegada) — quem celebra tudo não celebra nada.

### 2.7 Voltar depois de dias
- **Quer:** ser recebido sem cobrança e achar o fio de novo.
- **Mostra:** "sua próxima estação continua sendo X", a última anotação à vista, e o
  estado da viagem (estações, linhas, dias). **Os dias de viagem só somam**: nada de
  "você perdeu a sequência", nada de contagem zerada, nada de tom de ausência.
- **Desiste se:** qualquer frase fizer a pausa parecer fracasso. Este é o momento mais
  frágil dos três perfis: o perfil C decide aqui se o Atlas é aliado ou cobrador.

### 2.8 Chegar ao Terminal
- **Quer:** que as 35 signifiquem alguma coisa.
- **Mostra:** a tela do Terminal, própria: o mapa inteiro percorrido, os números da
  viagem (estações, linhas, baldeações, dias) e o caminho para os ramais. Sem confete
  infinito, sem "parabéns" repetido.
- **Desiste se:** o Terminal for igual a qualquer outra celebração — o fim da grade é o
  maior feito que o Atlas pode testemunhar e precisa ter a maior tela.

### 2.9 Levar adiante
- **Quer:** não perder o que fez, e mostrar a alguém.
- **Mostra:** exportar o progresso (arquivo v3, que o Atlas de hoje e o de amanhã leem),
  **compartilhar a viagem** (imagem gerada no aparelho, seção 5) e seguir para os
  ramais, que são o que sobra depois do Terminal.
- **Desiste se:** exportar produzir um arquivo que ela não consegue reimportar; ou se
  compartilhar exigir conta, servidor ou cadastro.

---

## 3. Progressão

### 3.1 Os quatro estados de uma estação

| estado | quando | o que a tela deve |
|---|---|---|
| `trancada` | há pré-requisito não concluído, ou a estação está num ciclo da fonte | dizer **o que falta, pelo nome**; se for ciclo, dizer que a fonte tem um ciclo (nunca "conclua X" quando X é impossível) |
| `disponivel` | todos os pré-requisitos conhecidos concluídos | oferecer começar |
| `em_curso` | a pessoa tocou "começar a estudar" e não concluiu | mostrar como aberta e não terminada |
| `concluida` | a pessoa disse que concluiu | carimbar |

**Precedência:** `concluida` > `em_curso` > `disponivel` > `trancada`. A palavra da
pessoa pesa mais que o cálculo do Atlas: se ela declarou, o Atlas não desdiz.

### 3.2 A linha e a viagem

- **Por linha:** concluídas de 5, percentual (inteiro), e **fim da linha** quando 5 de 5.
- **A viagem inteira conta:** estações concluídas, linhas completas, **baldeações feitas**
  e **dias de viagem**.
- **Baldeação feita:** uma estação concluída cujo pré-requisito concluído está em outra
  linha. Conta o par, sem contar duas vezes o mesmo par.
- **Dia de viagem:** um dia, no fuso do aparelho, em que **pelo menos uma estação foi
  concluída**. Começar a estudar não conta: a regra 1 da gamificação é premiar avanço
  real, e intenção não é avanço. A consequência boa é que os dias são derivados das
  datas de conclusão — não existe contador para dessincronizar, e desfazer devolve o dia
  junto com a estação.

---

## 4. Gamificação decente

Regras fixas. Elas valem mais que qualquer ideia de recurso novo: um recurso que as
contradiga não entra.

1. **Só se premia avanço real.** Nada de recompensa por abrir o app, por entrar todo
   dia, por tocar em qualquer coisa.
2. **A conclusão é palavra da pessoa.** O Atlas não tem como saber se ela estudou. Por
   isso ele não finge medir: diz isso uma vez, no embarque, e nunca mais cobra prova.
3. **Nada de ponto, XP, ranking, nível ou moeda inventada.** Não existe "1250 XP" nem
   "você é o 34º da semana". Número inventado é dado falso, e o Atlas não inventa dado.
4. **Nada de punição.** Os dias de viagem **só somam**. Nunca aparece "você perdeu a
   sequência", "sua ofensiva acabou", "faz X dias que você não vem". Pausa não é evento.
5. **As recompensas são as do metrô**, e são três:
   - **o bilhete**: 35 espaços, e cada estação concluída vira um carimbo. O bilhete é
     sempre o mesmo, do primeiro dia ao Terminal — é o objeto que a pessoa reconhece;
   - **o selo da linha**: quando as 5 de uma linha fecham;
   - **a tela do Terminal**: as 35.
6. **A celebração tem o tamanho do feito.** A estação ganha a **chegada** (breve, no
   lugar, com desfazer). A linha ganha o **carimbo e o selo**. O Terminal ganha **a tela
   própria**. Nada mais ganha celebração — nem anotação, nem baldeação intermediária,
   nem dia de viagem.

---

## 5. Compartilhar a viagem

Uma **imagem PNG gerada no próprio aparelho**, num `canvas`: o mapa com o progresso e os
números da viagem.

- Leva **só os números**: estações, linhas, baldeações, dias. **Nenhuma anotação** entra
  na imagem — anotação é texto privado, e uma imagem compartilhada sai do controle de
  quem a postou.
- **Não sobe para servidor nenhum.** O arquivo nasce no aparelho e vai para onde a pessoa
  mandar (galeria, rede social, mensagem). O Atlas não faz upload, não gera link, não
  tem para onde enviar.
- É o que a pessoa posta. Se a imagem for feia ou ilegível no celular, o recurso falhou:
  ela existe para ser mostrada a alguém.

---

## 6. Privacidade

**Tudo fica no aparelho. Sem conta, sem rastreio, sem servidor.**

Concretamente: o progresso e as anotações moram no armazenamento do navegador; não há
login, não há analytics, não há chamada que envie dado da pessoa para fora. A única
exceção é o que ela mesma escolhe enviar ao exportar um arquivo ou compartilhar a imagem
— e as duas coisas saem do aparelho por decisão dela.

---

## 7. O que este documento não decide

Fica para o design system e para a tela, de propósito: cores, tipografia, o desenho do
mapa (as linhas são retas? curvas? o que é uma estação no espaço?), o texto exato de
cada frase, a duração de cada celebração, e o layout do bilhete. Este documento decide
**o que existe, quando aparece e o que nunca aparece**.

Duas decisões daqui são as mais fracas e devem ser as primeiras a cair se a realidade
discordar:

- **"começar a estudar" como estado próprio.** Ele custa um campo no formato, um estado
  na tela e um gesto a mais por estação. Se na prática ninguém tocar, o estado
  `em_curso` sai e a estação passa de `disponivel` direto para `concluida`.
- **dia de viagem = dia com estação concluída.** É exato e não dessincroniza, mas
  subestima a viagem de quem estuda dias sem concluir nada — que é exatamente o perfil
  C voltando. Se o resumo começar a parecer injusto, a saída é contar também o dia em
  que houve anotação ou início, guardando as datas desses eventos.
