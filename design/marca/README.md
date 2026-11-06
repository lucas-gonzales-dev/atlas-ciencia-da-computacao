# Marca do Atlas

`atlas-logo.png` é o logo definitivo (escolhido pelo Lucas em 30/10/2026, desenhado no
Lovable): um livro aberto com uma página azul e outra coral, o sol coral nascendo entre
elas, a cúpula preta com uma estrela lima e a palavra "atlas" em minúsculas.

## Regras de uso
- **O logo é imagem.** As cores dele (azul, coral, preto, lima) são da marca e **não viram
  tokens de interface**. A interface segue o `app/web/tokens.css`: papel, carvão, tinta e
  as 7 cores de linha.
- **No topo do app**: o símbolo (`app/marca/simbolo.png`) com 24 px de altura
  (`--marca-altura`) e a palavra (`app/marca/palavra.png`) como máscara pintada com
  `--tinta`. No escuro, o símbolo ganha um fundo de papel (`--marca-fundo`), porque a
  cúpula é preta.
- **Ícones**: só o símbolo, sem a palavra, sobre papel. O maskable mantém o desenho dentro
  do círculo seguro de 80 %.
- **Área de proteção**: em volta do símbolo, pelo menos a altura da estrela. **Tamanho
  mínimo**: 16 px para o símbolo; 120 px de largura para símbolo e palavra juntos.
- **Não fazer**: esticar, girar, recolorir o símbolo, pôr sombra ou degradê, trocar a
  palavra por texto em outra fonte, pôr o símbolo sem fundo de papel sobre o carvão.

## Gerar de novo
Só quando o logo mudar: `python -I design/marca/gerar-marca.py` (Python 3 e Pillow). O
script recorta o símbolo e a palavra, transforma o fundo creme em transparência sem halo e
grava os ícones em `app/icons/`, o `app/favicon.ico` e as peças do topo em `app/marca/`.
