# Créditos

O Atlas não inventou um currículo de ciência da computação. Ele existe porque a
**Universidade Brasileira Livre (UBL)** publicou um, aberto e em português, e o
Atlas é uma forma de estudá-lo com progresso, trilhas e bibliografia na tela.

Este documento diz de onde veio cada coisa, o que a licença da fonte permite e
exige, e quem fez o trabalho original.

## De onde vem o conteúdo

**Fonte:** repositório oficial da UBL —
[`Universidade-Livre/ciencia-da-computacao`](https://github.com/Universidade-Livre/ciencia-da-computacao)

**Versão auditada:** `b995c118fdb3929412004ee041a25c77cb0aa997` (o kit e as notas
deste projeto chamam esse commit de `b995c11`)

Tudo o que o Atlas mostra sobre o currículo foi lido dessa versão, e não de
memória nem de outro lugar. O que o Atlas **usa** da UBL:

- o **currículo** — as disciplinas, a ordem, os pré-requisitos entre elas;
- as **especializações** e os recursos que a fonte lista para cada uma;
- as **eletivas** arquivadas na fonte, mostradas numa seção própria e fora da
  grade, porque a fonte não as soma ao currículo sem decisão editorial;
- os **links** para cursos, vídeos e livros, e os **caminhos de bibliografia**
  (`extras/bibliography/…`) de cada disciplina;
- a **estrutura de nomes e categorias** que organiza isso tudo.

O que o Atlas **não usa** e **não redistribui**: o Atlas não copia o texto dos
recursos externos, não hospeda vídeo, curso, PDF ou livro de ninguém, e não
republica material de terceiros. Ele aponta para onde o material já está.
Quando a fonte só tem o caminho de uma bibliografia e não o conteúdo dela, a
tela diz isso e mostra o caminho — não inventa título, autor nem link.

## Licença da fonte

**MIT License**, conforme o arquivo `LICENSE` no SHA auditado:

> Copyright (c) 2021 Universidade Brasileira Livre

O que a MIT **permite**:

- usar, copiar, modificar e mesclar o conteúdo;
- publicar e distribuir;
- **uso comercial** — é permitido; a MIT não restringe isso;
- sublicenciar e vender cópias.

O que a MIT **exige** — uma condição só:

- **atribuição**: manter o aviso de copyright e o texto de permissão acima em
  todas as cópias ou partes substanciais do material. É exatamente o que esta
  seção faz.

O que a MIT **não exige**:

- **não exige a mesma licença** para obras derivadas. Não é copyleft (diferente
  de CC BY-SA ou GPL). O Atlas pode ser licenciado como o Lucas decidir, sem
  precisar herdar a MIT — embora mantê-la seja a escolha mais simples e mais
  alinhada ao espírito da fonte.

O que a MIT **declara**: o material vem **"as is", sem garantia** de qualquer
tipo — nem de comerciabilidade, nem de adequação a um fim específico. Se uma
disciplina, um link ou uma bibliografia estiver errada ou fora do ar, a
responsabilidade é de quem usa, não dos autores da UBL.

## Texto integral da licença da fonte

A MIT exige **duas** coisas no material derivado, não uma: o aviso de copyright
**e** o texto de permissão. O aviso está citado acima; o texto integral é o que
vem a seguir, copiado do arquivo `LICENSE` da fonte no SHA auditado `b995c11`
(`atlas-planning-kit/source/LICENSE`), sem alteração de uma palavra:

```
MIT License

Copyright (c) 2021 Universidade Brasileira Livre

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Isto é o cumprimento da condição da licença da UBL sobre o conteúdo derivado
deste repositório. A licença do **código do Atlas** é outra e está no arquivo
[`LICENSE`](LICENSE) na raiz.

## Quem fez a UBL

Lista tirada do próprio git da fonte (`git shortlog -sn` no SHA auditado
`b995c11`), em ordem de número de commits. Nomes como estão registrados lá:

- Camilo Cunha de Azevedo
- Mateus Roveda
- Emanuel Castelo
- Henrique Sebastião
- Jonathan
- Carlos Bazilio
- Carlos Mondo
- Daniele Karoline
- Felipe
- Igor Vinoski
- Jefferson Quesado
- Leonel M. Morgado
- Yúri Kerber

## A tipografia: Overpass (SIL OFL 1.1)

O design system do Atlas escolheu **uma família só**, de placa de sinalização:
a **Overpass**, desenhada a partir da sinalização rodoviária americana, mais a
**Overpass Mono** para números e códigos. A escolha e a escala estão em
`design/README.md` §3.

**De onde vieram os arquivos.** Os dois woff2 foram baixados do CDN oficial do
Google Fonts (a Overpass é publicada lá sob SIL OFL 1.1), no subconjunto
`latin` — o Atlas é em português, e `latin-ext`/`cyrillic`/`vietnamese` seriam
bytes que nenhuma tela desenha. São **fontes variáveis**, por isso dois
arquivos cobrem os três pesos que o DS usa (400, 700 e 900): o eixo `wght` vai
de 100 a 900 na Overpass e de 300 a 700 na Mono.

| Arquivo no repositório | Família | Peso declarado | Bytes | URL de onde veio |
|---|---|---|---|---|
| `app/fonts/overpass-latin-var.woff2` | Overpass | `100 900` | 39.380 | `https://fonts.gstatic.com/s/overpass/v19/qFdH35WCmI96Ajtm81GlU9s.woff2` |
| `app/fonts/overpass-mono-latin-var.woff2` | Overpass Mono | `300 700` | 22.012 | `https://fonts.gstatic.com/s/overpassmono/v21/_Xmq-H86tzKDdAPa-KPQZ-AC1i-0tg.woff2` |

**sha256 de cada arquivo**, para conferir que o binário do repositório é o que
foi baixado (e que nenhum arquivo de fonte é duplicata de outro):

- `overpass-latin-var.woff2` —
  `29217ef8adef5f6c059feb461bdb029348205fc233dc9b6ca8604b0d068ac086`
- `overpass-mono-latin-var.woff2` —
  `a7ed2af1f5da37980a753570bad1fd59ebf7f0da7b215c110ea3b3c9d5552f56`

O `@font-face` que declara as duas famílias está em `app/web/fontes.css`, e os
dois arquivos estão no **precache** do service worker (`app/sw.js`): offline sem
a fonte seria outra cara, que é exatamente o defeito que o design system veio
corrigir.

**O que a SIL OFL 1.1 permite:** usar, estudar, copiar, mesclar, embutir,
modificar e redistribuir a fonte, inclusive com software comercial, e embuti-la
em documentos sem que o documento herde a licença.

**O que ela exige:** que cada cópia distribuída leve o aviso de copyright e o
texto da licença; que a fonte nunca seja vendida sozinha; que nenhuma versão
modificada use o nome reservado sem permissão escrita; e que a fonte e suas
modificações continuem sob a OFL. O Atlas redistribui os arquivos **sem
modificação**, com o aviso e o texto a seguir, e não os vende.

### Texto integral da SIL Open Font License 1.1

Copiado sem alteração de `ofl/overpass/OFL.txt` no repositório oficial
[`google/fonts`](https://github.com/google/fonts):

```
Copyright 2021 The Overpass Project Authors (https://github.com/RedHatOfficial/Overpass)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Recursos externos

Cada disciplina e cada especialização do Atlas aponta para cursos, vídeos,
livros e apostilas criados por outras pessoas e instituições.

**Esses recursos pertencem aos seus autores.** As licenças deles são as que cada
autor escolheu, e valem independentemente da MIT da UBL e do que este
repositório decidir. O Atlas:

- **não redistribui** nenhum deles — só guarda e mostra o link;
- **não re-hospeda** vídeo, PDF, curso ou livro de terceiros;
- **não altera** o material para o qual aponta;
- na **bibliografia**, quando a fonte só traz o caminho da página e não o
  conteúdo, a tela mostra o caminho na fonte e avisa que não conferiu se está no
  ar. Nenhum título, autor ou link de download é inventado para preencher o
  espaço.

Se você é autor de algum recurso citado aqui e prefere não aparecer, ou quer
corrigir um link: abra uma issue neste repositório.

## Agradecimento

O Atlas é um app de estudo pessoal e um portfólio. As duas coisas só existem
porque treze pessoas escreveram, revisaram e mantiveram um currículo aberto em
português sem cobrar nada por ele.

Obrigado à Universidade Brasileira Livre e a cada nome listado acima. O erro é
do Atlas; o currículo é de vocês.

---

**Nota sobre a licença do código do Atlas:** este repositório está sob **MIT
License**, `Copyright (c) 2026 Lucas Leite Gonzales` — o arquivo
[`LICENSE`](LICENSE) na raiz. A decisão foi do Lucas, em 28/10/2026, e é
compatível com a MIT da UBL citada acima: as duas licenças convivem sem que o
Atlas precise herdar nada, e o aviso de copyright da fonte continua aqui.
