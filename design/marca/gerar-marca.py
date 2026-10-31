"""Gera os ícones e as peças da marca do Atlas a partir de design/marca/atlas-logo.png.

Roda só quando o logo mudar (requer Python 3 e Pillow):  python -I design/marca/gerar-marca.py

O logo vem de uma imagem 1024 x 1024 com fundo creme: o símbolo (livro aberto, sol, cúpula com estrela)
em cima e a palavra "atlas" embaixo. O fundo vira transparência com borda suave (o alfa sai da distância de
cada pixel ao creme, e a cor é recuperada desfazendo a mistura), então o recorte não deixa halo.

Saídas:
  app/icons/icone-512.png, icone-192.png      símbolo sobre papel, propósito "any"
  app/icons/icone-maskable-512.png            símbolo dentro do círculo seguro de 80%
  app/icons/apple-touch-icon.png (180)        símbolo sobre papel, opaco
  app/icons/favicon-32.png, favicon-16.png    símbolo justo sobre papel
  app/favicon.ico                             16 + 32, para quem pede /favicon.ico
  app/marca/simbolo.png                       símbolo transparente, 192 px de altura (cabeçalho a 2x e 3x)
  app/marca/palavra.png                       a palavra "atlas" como MÁSCARA (alfa só): a cor vem do token
                                              --tinta pelo CSS, então serve no claro e no escuro
"""
import os
import sys
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
APP = os.path.join(RAIZ, "app")

PAPEL = (251, 247, 240)   # --fundo e --marca-fundo do tokens.css
CORTE_PALAVRA = 590       # acima desta linha é o símbolo; abaixo, a palavra


def sem_fundo(im):
    """RGB com fundo creme -> RGBA com o creme transparente e a borda suave."""
    fundo = im.getpixel((5, 5))
    rgba = Image.new("RGBA", im.size)
    src = im.load()
    dst = rgba.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            # alfa: quanto o pixel se afasta do creme, pelo canal que mais se afasta. Até 10 níveis é ruído
            # do próprio creme (a imagem tem granulação perto das bordas), não desenho.
            d = max(abs(r - fundo[0]), abs(g - fundo[1]), abs(b - fundo[2]))
            a = max(0.0, min(1.0, (d - 10) / 50.0))
            if a <= 0.0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            # desfaz a mistura com o creme: c = a*cor + (1-a)*fundo
            cor = tuple(max(0, min(255, round((c - (1 - a) * f) / a))) for c, f in zip((r, g, b), fundo))
            dst[x, y] = cor + (round(a * 255),)
    return rgba


def caixa(rgba, y0, y1):
    return rgba.crop((0, y0, rgba.width, y1)).getbbox()


def recortar(rgba, y0, y1):
    x0, a, x1, b = caixa(rgba, y0, y1)
    return rgba.crop((x0, y0 + a, x1, y0 + b))


def sobre_papel(simbolo, lado, ocupa):
    """Símbolo centrado num quadrado de papel; `ocupa` é a fração do lado que o maior eixo do símbolo usa."""
    base = Image.new("RGBA", (lado, lado), PAPEL + (255,))
    escala = ocupa * lado / max(simbolo.size)
    s = simbolo.resize((max(1, round(simbolo.width * escala)), max(1, round(simbolo.height * escala))), Image.LANCZOS)
    base.alpha_composite(s, ((lado - s.width) // 2, (lado - s.height) // 2))
    return base.convert("RGB")


def no_circulo_seguro(simbolo, lado):
    """Maskable: a diagonal do símbolo cabe em 72% do lado (o círculo seguro é 80%; sobra margem)."""
    diag = (simbolo.width ** 2 + simbolo.height ** 2) ** 0.5
    return sobre_papel(simbolo, lado, 0.72 * lado / diag * max(simbolo.size) / lado)


def main():
    logo = Image.open(os.path.join(AQUI, "atlas-logo.png")).convert("RGB")
    rgba = sem_fundo(logo)
    simbolo = recortar(rgba, 0, CORTE_PALAVRA)
    palavra = recortar(rgba, CORTE_PALAVRA, logo.height)

    icones = os.path.join(APP, "icons")
    marca = os.path.join(APP, "marca")
    os.makedirs(icones, exist_ok=True)
    os.makedirs(marca, exist_ok=True)

    sobre_papel(simbolo, 512, 0.76).save(os.path.join(icones, "icone-512.png"), optimize=True)
    sobre_papel(simbolo, 192, 0.76).save(os.path.join(icones, "icone-192.png"), optimize=True)
    no_circulo_seguro(simbolo, 512).save(os.path.join(icones, "icone-maskable-512.png"), optimize=True)
    sobre_papel(simbolo, 180, 0.72).save(os.path.join(icones, "apple-touch-icon.png"), optimize=True)
    f32 = sobre_papel(simbolo, 32, 0.94)
    f16 = sobre_papel(simbolo, 16, 0.98)
    f32.save(os.path.join(icones, "favicon-32.png"), optimize=True)
    f16.save(os.path.join(icones, "favicon-16.png"), optimize=True)
    f32.save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32)])

    alto = 192
    s = simbolo.resize((round(simbolo.width * alto / simbolo.height), alto), Image.LANCZOS)
    s.save(os.path.join(marca, "simbolo.png"), optimize=True)

    # a palavra vira máscara: preto com o alfa do recorte. O CSS pinta com var(--tinta) via mask-image.
    p = palavra.resize((round(palavra.width * alto / palavra.height), alto), Image.LANCZOS)
    mascara = Image.new("RGBA", p.size, (0, 0, 0, 0))
    mascara.putalpha(p.getchannel("A"))
    mascara.save(os.path.join(marca, "palavra.png"), optimize=True)

    print("simbolo", simbolo.size, "palavra", palavra.size)
    for pasta in (icones, marca):
        for nome in sorted(os.listdir(pasta)):
            caminho = os.path.join(pasta, nome)
            if nome.endswith(".png"):
                with Image.open(caminho) as im:
                    print(f"{os.path.relpath(caminho, RAIZ)}  {im.size[0]}x{im.size[1]}  {os.path.getsize(caminho)} B")
    print(f"app/favicon.ico  {os.path.getsize(os.path.join(APP, 'favicon.ico'))} B")


if __name__ == "__main__":
    sys.exit(main())
