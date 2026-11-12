"""Dibuja el logo de PokeSave Link y los gráficos de la 3DS (todo propio, sin imágenes oficiales).

Salida:
  3ds/PokeSaveLink/meta/icon.png      48x48  icono (menú HOME y Homebrew Launcher)
  3ds/PokeSaveLink/meta/banner.png    256x128 banner del menú HOME (pantalla de arriba)
  3ds/PokeSaveLink/meta/banner.wav    jingle del banner (sintetizado)
  3ds/PokeSaveLink/gfx/logo.png       64x64  logo que usa la app en pantalla
  web/public/3ds/logo.png             256x256 para la página de la 3DS
Uso: python tools/make-3ds-art.py
"""
import math
import os
import struct
import wave

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
META = os.path.join(ROOT, '3ds', 'PokeSaveLink', 'meta')
GFX = os.path.join(ROOT, '3ds', 'PokeSaveLink', 'gfx')
WEB = os.path.join(ROOT, 'web', 'public', '3ds')
for d in (META, GFX, WEB):
    os.makedirs(d, exist_ok=True)

RED, RED_HI, RED_LO = (227, 36, 43), (255, 92, 96), (150, 12, 24)
NAVY, NAVY2 = (14, 20, 48), (36, 58, 143)
GOLD = (255, 203, 5)
INK = (20, 22, 36)


def vgrad(size, top, bottom):
    w, h = size
    img = Image.new('RGBA', size)
    px = img.load()
    for y in range(h):
        k = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)) + (255,)
        for x in range(w):
            px[x, y] = c
    return img


def logo(size):
    """Logo: azulejo rojo redondeado con una Poké Ball estilizada y una flecha de "guardar"."""
    S = size * 4  # dibujar a 4x y reducir = bordes suaves
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    r = int(S * 0.22)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), r, fill=255)
    tile = vgrad((S, S), RED_HI, RED_LO)
    # brillo diagonal
    shine = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shine).polygon([(0, 0), (S * 0.62, 0), (0, S * 0.62)], fill=(255, 255, 255, 38))
    tile = Image.alpha_composite(tile, shine)
    img.paste(tile, (0, 0), mask)
    d = ImageDraw.Draw(img)
    # borde interior
    d.rounded_rectangle((S * 0.03, S * 0.03, S * 0.97, S * 0.97), int(r * 0.85), outline=(255, 255, 255, 70), width=max(2, S // 60))

    # Poké Ball
    cx, cy, R = S * 0.46, S * 0.48, S * 0.31
    lw = max(3, int(S * 0.045))
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((cx - R, cy - R + S * 0.03, cx + R, cy + R + S * 0.03), fill=(60, 0, 8, 120))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(S * 0.02)))
    d = ImageDraw.Draw(img)
    d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=(250, 250, 252), outline=INK, width=lw)
    d.pieslice((cx - R, cy - R, cx + R, cy + R), 180, 360, fill=(255, 70, 76), outline=INK, width=lw)
    d.rectangle((cx - R, cy - lw * 0.6, cx + R, cy + lw * 0.6), fill=INK)
    d.ellipse((cx - R * 0.34, cy - R * 0.34, cx + R * 0.34, cy + R * 0.34), fill=INK)
    d.ellipse((cx - R * 0.2, cy - R * 0.2, cx + R * 0.2, cy + R * 0.2), fill=(255, 255, 255))
    # brillito de la bola
    d.ellipse((cx - R * 0.62, cy - R * 0.72, cx - R * 0.3, cy - R * 0.45), fill=(255, 255, 255, 150))

    # insignia amarilla con flecha (guardar / enviar)
    bx, by, br = S * 0.74, S * 0.74, S * 0.19
    d.ellipse((bx - br, by - br, bx + br, by + br), fill=GOLD, outline=INK, width=lw)
    a = br * 0.55
    d.rectangle((bx - a * 0.28, by - a * 0.85, bx + a * 0.28, by + a * 0.1), fill=INK)
    d.polygon([(bx - a * 0.75, by - a * 0.05), (bx + a * 0.75, by - a * 0.05), (bx, by + a * 0.75)], fill=INK)
    return img.resize((size, size), Image.LANCZOS)


def banner():
    W, H = 256, 128
    S = 4
    img = vgrad((W * S, H * S), NAVY2, NAVY)
    stripes = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(stripes)
    for i in range(-10, 30):
        x = i * 60 * S
        d.polygon([(x, 0), (x + 24 * S, 0), (x - 100 * S, H * S), (x - 124 * S, H * S)], fill=(255, 255, 255, 16))
    img = Image.alpha_composite(img, stripes).resize((W, H), Image.LANCZOS)
    lg = logo(84)
    img.alpha_composite(lg, (14, 22))
    d = ImageDraw.Draw(img)
    big = ImageFont.truetype('C:/Windows/Fonts/seguibl.ttf', 27)
    small = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 11)
    d.text((106, 28), 'PokeSave', font=big, fill=(255, 255, 255), stroke_width=2, stroke_fill=INK)
    d.text((108, 62), 'LINK', font=ImageFont.truetype('C:/Windows/Fonts/seguibl.ttf', 20), fill=GOLD, stroke_width=2, stroke_fill=INK)
    d.text((107, 92), 'Edita tu partida por wifi', font=small, fill=(200, 210, 255))
    return img.convert('RGB')


def jingle(path):
    """Tres notas alegres tipo "objeto conseguido" (sintetizadas)."""
    sr, notes = 22050, [(76, 0.12), (81, 0.12), (88, 0.42)]
    out = []
    for n, dur in notes:
        f = 440 * 2 ** ((n - 69) / 12)
        for i in range(int(sr * dur)):
            t = i / sr
            env = min(1, t * 80) * math.exp(-t * 6)
            v = (math.sin(2 * math.pi * f * t) + 0.35 * math.sin(4 * math.pi * f * t)) * env * 0.35
            out.append(int(max(-1, min(1, v)) * 32000))
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b''.join(struct.pack('<h', s) for s in out))


logo(48).save(os.path.join(META, 'icon.png'))
logo(64).save(os.path.join(GFX, 'logo.png'))
logo(256).save(os.path.join(WEB, 'logo.png'))
banner().save(os.path.join(META, 'banner.png'))
jingle(os.path.join(META, 'banner.wav'))
print('ok')
