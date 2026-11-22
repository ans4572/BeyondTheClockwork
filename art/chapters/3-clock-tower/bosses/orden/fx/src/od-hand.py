"""Orden's stopped-time needle as a slim watch hand, v2 (2026-11-21, the user's word: v1 was too big, make it read as a
needle): a hair-thin Breguet hand in heat-blued steel, a small open ring near the point, a brass bead at the tail.
32 x 9, pointing right, origin in the middle. Also its shadow on the floor, its own silhouette in the
watches' ink (32 x 9, made when <shadow.png> is given). Usage: od-hand.py <out.png> [preview.png] [map.png] [shadow.png]."""
import sys
from PIL import Image, ImageDraw
import numpy as np
W, H = 32, 9
OL = (20, 26, 51, 255); BLUE = (52, 86, 170, 255); LIGHT = (120, 165, 232, 255); BRASS = (240, 180, 58, 255); BRASS_L = (255, 226, 140, 255)

im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im)
d.rectangle([3, 3, 5, 5], fill=BRASS); d.point([(3, 3)], fill=BRASS_L)          # tail bead
d.line([(6, 4), (22, 4)], fill=BLUE); d.point([(9, 4), (14, 4)], fill=LIGHT)     # hair shaft
d.ellipse([21, 2, 25, 6], fill=BLUE); d.point([(23, 4)], fill=(0, 0, 0, 0)); d.point([(22, 2)], fill=LIGHT)   # ring
d.line([(26, 4), (29, 4)], fill=BLUE); d.point([(26, 4)], fill=LIGHT)            # point
a = np.array(im); al = a[..., 3] > 0; grow = al.copy()
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): grow |= np.roll(np.roll(al, dy, 0), dx, 1)
a[grow & ~al] = OL
im = Image.fromarray(a); im.save(sys.argv[1])
if len(sys.argv) > 2:
    grey = Image.new('RGBA', (360, 200), (150, 150, 155, 255))
    if len(sys.argv) > 3:
        m = Image.open(sys.argv[3]).convert('RGBA').crop((1200, 900, 1560, 1100)).convert('L').convert('RGBA'); grey.paste(m, (0, 0))
    for i, ang in enumerate([0, 35, -60, 150, 90, 200]):
        r = im.resize((W * 2, H * 2), Image.NEAREST).rotate(ang, expand=True, resample=Image.NEAREST)
        grey.alpha_composite(r, (20 + (i % 3) * 115, 30 + (i // 3) * 95))
    grey.resize((720, 400), Image.NEAREST).save(sys.argv[2])

if len(sys.argv) > 4:
    # Its shadow (v2, 2026-11-21, the user's word: the watches' round shadow looked odd under a needle): the hand's own
    # silhouette in the watches' ink (11, 16, 32), laid on the floor at its angle and drawn see-through by the game.
    a = np.array(im); a[a[..., 3] > 0] = (11, 16, 32, 255); Image.fromarray(a).save(sys.argv[4])
