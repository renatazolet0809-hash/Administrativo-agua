#!/usr/bin/env python3
"""Genera los iconos PWA (192 y 512) del sistema de agua: fondo teal redondeado + gota blanca."""
from PIL import Image, ImageDraw

TEAL = (13, 148, 136, 255)      # teal-600
WHITE = (255, 255, 255, 255)

def make_icon(size: int, path: str):
    S = 4  # supersampling para bordes suaves
    big = size * S
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Fondo teal con esquinas redondeadas
    radius = int(big * 0.20)
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius, fill=TEAL)

    # Gota: círculo + triángulo superior (solapados)
    cx = big / 2
    r = big * 0.26
    cy = big * 0.60
    apex = big * 0.16
    half = big * 0.225
    d.polygon([(cx, apex), (cx - half, cy), (cx + half, cy)], fill=WHITE)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)

    # Brillo pequeño dentro de la gota (detalle)
    hl_r = r * 0.22
    d.ellipse([cx - r * 0.45 - hl_r, cy - r * 0.30 - hl_r,
               cx - r * 0.45 + hl_r, cy - r * 0.30 + hl_r],
              fill=(13, 148, 136, 90))

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path, "PNG")
    print(f"ok {path} ({size}x{size})")

make_icon(192, "/home/z/my-project/public/icons/icon-192.png")
make_icon(512, "/home/z/my-project/public/icons/icon-512.png")
