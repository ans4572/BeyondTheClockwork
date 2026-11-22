"""Two 48px unwind props in the style of boss-windup-key-v1 (dark outline, flat shades): Tick-Tock's metronome with its
weight, and Orden's tuning needle that sat in Belgard's helmet."""
import sys
from PIL import Image, ImageDraw
import numpy as np
OUT = sys.argv[1]
OL = (31, 33, 51, 255)

def outline(img):
    a = np.array(img); al = a[..., 3] > 0
    grow = al.copy()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        grow |= np.roll(np.roll(al, dy, 0), dx, 1)
    ring = grow & ~al
    a[ring] = OL
    return Image.fromarray(a)

# metronome
m = Image.new('RGBA', (48, 48)); d = ImageDraw.Draw(m)
d.polygon([(19, 9), (28, 9), (37, 41), (10, 41)], fill=(154, 91, 46, 255))          # body
d.polygon([(25, 9), (28, 9), (37, 41), (31, 41)], fill=(110, 61, 31, 255))           # right shade
d.polygon([(19, 9), (21, 9), (14, 41), (10, 41)], fill=(199, 131, 74, 255))          # left light
d.polygon([(21, 14), (26, 14), (31, 35), (16, 35)], fill=(236, 214, 160, 255))       # face
for y in range(17, 34, 4): d.line([(23, y), (24, y)], fill=(150, 120, 80, 255))      # scale ticks
d.rectangle([8, 41, 39, 44], fill=(90, 52, 24, 255)); d.line([(8, 41), (39, 41)], fill=(170, 110, 60, 255))
d.rectangle([22, 5, 25, 8], fill=(240, 180, 58, 255))                                # finial
d.line([(23, 37), (31, 9)], fill=(240, 180, 58, 255), width=2)                       # rod
d.rectangle([27, 17, 32, 21], fill=(255, 210, 87, 255)); d.line([(27, 21), (32, 21)], fill=(190, 130, 40, 255))  # the weight
d.point([(28, 18)], fill=(255, 244, 214, 255))
d.ellipse([21, 35, 25, 39], fill=(240, 180, 58, 255))                                # pivot
m = outline(m)

# tuning needle (diagonal, cyan glass shaft, brass head)
n = Image.new('RGBA', (48, 48)); d = ImageDraw.Draw(n)
d.line([(9, 39), (33, 15)], fill=(95, 227, 255, 255), width=4)
d.line([(10, 37), (32, 15)], fill=(200, 250, 255, 255), width=1)
d.polygon([(5, 43), (10, 36), (12, 38)], fill=(159, 244, 255, 255))                  # tip
d.ellipse([31, 7, 42, 18], fill=(240, 180, 58, 255))                                 # head
d.ellipse([33, 9, 37, 13], fill=(255, 232, 150, 255))
d.ellipse([35, 11, 39, 15], fill=(95, 227, 255, 255))                                # cyan gem
d.rectangle([29, 17, 32, 20], fill=(190, 130, 40, 255))                              # collar
n = outline(n)

m.save(OUT + 'boss-metronome-weight-v1.png'); n.save(OUT + 'boss-tuning-needle-v1.png')
key = Image.open(sys.argv[2]).convert('RGBA')
sheet = Image.new('RGBA', (48 * 3 * 4, 48 * 4), (240, 230, 210, 255))
for i, im in enumerate([key, m, n]): sheet.alpha_composite(im.resize((192, 192), Image.NEAREST), (i * 192, 0))
sheet.save(OUT + 'preview.png')
