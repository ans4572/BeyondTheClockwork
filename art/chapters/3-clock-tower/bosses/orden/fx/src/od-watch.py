"""Orden's stopped-time pocket watch, v2 (2026-11-21, the user's word: the cartoon watch did not suit the tower's map;
a little smaller too): a brass hunter with depth to its case, the tower's plum outline, an ivory dial and blued-steel
hands like his needles, its red second hand still ticking in stopped time, a glint across the glass. 20 frames of
36 x 40 (5 x 4), origin at its feet [18, 38]; its shadow is drawn apart (watch-shadow-v2.png). The cracked look adds a
split across the glass. Usage: od-watch.py <outdir> [preview.png] [map.png]."""
import sys
import math
import numpy as np
from PIL import Image

W, H, FR, COLS = 36, 40, 20, 5
OL = (59, 40, 56, 255)
BR_L, BR, BR_S, BR_D = (255, 230, 160, 255), (232, 176, 72, 255), (176, 116, 44, 255), (112, 70, 34, 255)
FACE, FACE_S, TICK = (248, 238, 214, 255), (222, 206, 176, 255), (150, 112, 70, 255)
BLUE, RED, CRACK = (52, 86, 170, 255), (186, 64, 56, 255), (90, 80, 96, 255)
WHITE = (255, 255, 255, 255)
CX, CY, RR = 18, 21, 9.6          # dial centre and the case's outer radius (19 px across)
YY, XX = np.mgrid[0:H, 0:W]


def disc(a, cx, cy, r, col, cond=None):
    m = (XX - cx) ** 2 + (YY - cy) ** 2 <= r * r
    if cond is not None:
        m &= cond(XX, YY)
    a[m] = col


def line(a, x0, y0, x1, y1, col):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
        if 0 <= x < W and 0 <= y < H:
            a[y, x] = col


def outline(a):
    al = a[..., 3] > 0
    grow = al.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grow |= np.roll(np.roll(al, dy, 0), dx, 1)
    a[grow & ~al] = OL


def frame(f, cracked):
    a = np.zeros((H, W, 4), np.uint8)
    cy = CY - (1 if f % 10 >= 5 else 0)                # a slow one-pixel float
    # the bow and crown on top
    d2 = (XX - CX) ** 2 + (YY - (cy - 13)) ** 2
    a[(d2 <= 3.2 ** 2) & (d2 >= 1.5 ** 2)] = BR
    a[(YY == cy - 15) & (abs(XX - CX) <= 1)] = BR_L
    a[(abs(XX - CX) <= 1) & (YY >= cy - 11) & (YY <= cy - 9)] = BR_S
    a[cy - 10, CX - 1] = BR_L
    # the case's depth (a darker disc a pixel right and two down), then the case shaded from the top left
    disc(a, CX + 1, cy + 2, RR, BR_D)
    disc(a, CX, cy, RR, BR)
    disc(a, CX, cy, RR, BR_S, lambda x, y: (x - CX) + (y - cy) > 6)
    disc(a, CX, cy, RR, BR_L, lambda x, y: ((x - CX) + (y - cy) < -9) & ((x - CX) ** 2 + (y - cy) ** 2 >= (RR - 1.6) ** 2))
    # the dial, shaded low right, twelve ticks with the quarters darker
    disc(a, CX, cy, RR - 2, FACE)
    disc(a, CX, cy, RR - 2, FACE_S, lambda x, y: (x - CX) + (y - cy) > 5)
    for k in range(12):
        ang, r = k * math.pi / 6, RR - 3.2
        a[round(cy - math.cos(ang) * r), round(CX + math.sin(ang) * r)] = TICK if k % 3 else BR_D
    # hands: hour at ten, minute at two, the second hand ticking round, a step every second frame
    for ang, r in ((-60, 3.6), (60, 5.6)):
        t = math.radians(ang)
        line(a, CX, cy, CX + math.sin(t) * r, cy - math.cos(t) * r, BLUE)
    t = (f // 2) * math.tau / 10
    line(a, CX, cy, CX + math.sin(t) * 6, cy - math.cos(t) * 6, RED)
    a[cy, CX] = BR_L
    # the glass: a gleam at the top left, and a glint sweeping over it at the start of the loop
    for x, y in ((CX - 4, cy - 5), (CX - 5, cy - 4), (CX - 3, cy - 6)):
        a[y, x] = WHITE
    if f < 6:
        s = -8 + f * 3
        for d in (-1, 0, 1):
            for i in range(-6, 7):
                x, y = CX + i + s + d, cy + i
                if (x - CX) ** 2 + (y - cy) ** 2 <= (RR - 2.5) ** 2:
                    a[y, x] = (255, 252, 236, 255)
    if cracked:
        pts = [(CX - 6, cy - 3), (CX - 2, cy - 1), (CX, cy + 2), (CX + 3, cy + 1), (CX + 6, cy + 4)]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            line(a, x0, y0, x1, y1, CRACK)
        line(a, CX, cy + 2, CX - 1, cy + 6, CRACK)
        line(a, CX - 2, cy - 1, CX - 3, cy - 5, CRACK)
        a[cy - 2, CX - 4] = WHITE
        a[cy + 3, CX + 4] = WHITE
    outline(a)
    return a


out = sys.argv[1]
for cracked, name in ((False, 'watch-v2.png'), (True, 'watch-cracked-v2.png')):
    sheet = np.zeros((H * (FR // COLS), W * COLS, 4), np.uint8)
    for f in range(FR):
        sheet[(f // COLS) * H:(f // COLS + 1) * H, (f % COLS) * W:(f % COLS + 1) * W] = frame(f, cracked)
    Image.fromarray(sheet).save(out + name)
# its shadow: an oval of the tower's ink, drawn see-through by the game under the watch's feet
sy, sx = np.mgrid[0:7, 0:20]
sh = np.zeros((7, 20, 4), np.uint8)
sh[((sx - 9.5) / 9.5) ** 2 + ((sy - 3) / 3.2) ** 2 <= 1] = (11, 16, 32, 255)
Image.fromarray(sh).save(out + 'watch-shadow-v2.png')

if len(sys.argv) > 2:
    pv = Image.new('RGBA', (360, 150), (150, 150, 155, 255))
    if len(sys.argv) > 3:
        m = Image.open(sys.argv[3]).convert('RGBA').crop((1200, 900, 1380, 975))
        pv.paste(m.resize((180, 75)), (0, 0))
        pv.paste(m.convert('L').convert('RGBA').resize((180, 75)), (180, 0))
    w, c, s = (Image.open(out + n) for n in ('watch-v2.png', 'watch-cracked-v2.png', 'watch-shadow-v2.png'))
    sha = s.copy()
    sha.putalpha(Image.eval(s.getchannel('A'), lambda v: int(v * 0.4)))
    for i, (im, f) in enumerate(((w, 0), (w, 3), (c, 8), (w, 8))):
        fr = im.crop(((f % COLS) * W, (f // COLS) * H, (f % COLS + 1) * W, (f // COLS + 1) * H))
        for top in ((18, 90) if i < 2 else (18,)):
            x = 10 + i * 88
            pv.alpha_composite(sha, (x + 18 - 10, top + 38 - 3))
            pv.alpha_composite(fr, (x, top))
    pv.resize((1080, 450), Image.NEAREST).save(sys.argv[2])
