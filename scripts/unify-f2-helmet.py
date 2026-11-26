"""Pull every direction's cream helmet onto the front (south) helmet's colours.
usage: python scripts/unify-f2-helmet.py <repo> preview|apply [outdir] (preview writes prev-<direction>.png to outdir, default the temp folder)"""
import sys, glob, os
from collections import Counter
from PIL import Image
import tempfile
REPO, MODE = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else tempfile.gettempdir()
V2 = os.path.join(REPO, 'art/animations/player/v2')
D = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def cream(c):
    r, g, b = c
    return r >= 140 and r >= g >= b and 25 <= r - b <= 112 and 12 <= g - b <= 62 and r - g <= 45
# The south helmet ramp, light to dark (from the front base, colours used 5+ times).
south = Image.open(f'{V2}/bases/south.png').convert('RGBA')
cnt = Counter(p[:3] for p in south.get_flattened_data() if p[3] > 200 and cream(p[:3]))
ramp = sorted([c for c, n in cnt.items() if n >= 5 and lum(c) < 246], key=lum, reverse=True)
def ramp_at(L):
    pts = [(lum(c), c) for c in ramp]
    if L >= pts[0][0]: hi = pts[0]; return tuple(min(255, round(v + (L - hi[0]))) for v in hi[1])
    for (l1, c1), (l2, c2) in zip(pts, pts[1:]):
        if l2 <= L <= l1:
            t = (L - l2) / (l1 - l2) if l1 != l2 else 0
            return tuple(round(a * t + b * (1 - t)) for a, b in zip(c1, c2))
    lo = pts[-1]; return tuple(max(0, round(v + (L - lo[0]))) for v in lo[1])
SOUTH_MAIN = lum(cnt.most_common(1)[0][0])
def main_of(d):
    im = Image.open(f'{V2}/bases/{d}.png').convert('RGBA')
    bb = im.getchannel('A').getbbox(); top = bb[1] + int((bb[3] - bb[1]) * 0.45)
    c = Counter(im.getpixel((x, y))[:3] for y in range(bb[1], top) for x in range(bb[0], bb[2]) if im.getpixel((x, y))[3] > 200 and cream(im.getpixel((x, y))[:3]))
    return c.most_common(1)[0][0]
def remap(im, shift):
    px = im.load(); n = 0
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and cream(p[:3]) and lum(p[:3]) < 246:
                q = ramp_at(lum(p[:3]) + shift)
                if q != p[:3]: px[x, y] = q + (p[3],); n += 1
    return n
print('ramp', ramp)
for d in D:
    m = main_of(d); shift = SOUTH_MAIN - lum(m)
    print(f'{d:11s} main {m} shift {shift:+.1f}')
    if d == 'south': continue
    if MODE == 'preview':
        im = Image.open(f'{V2}/clips/idle-{d}/sheet.webp').convert('RGBA').crop((0, 0, 132, 132)); remap(im, shift)
        im.save(os.path.join(OUT, f'prev-{d}.png'))
    else:
        files = [f for f in glob.glob(f'{V2}/clips/*/frames/*.png') if os.path.basename(os.path.dirname(os.path.dirname(f))).endswith('-' + d) and not os.path.basename(os.path.dirname(os.path.dirname(f)))[:-len(d) - 1].endswith(('-south', '-north'))] + [f'{V2}/bases/{d}.png']
        tot = 0
        for f in files:
            im = Image.open(f).convert('RGBA'); n = remap(im, shift)
            if n: im.save(f); tot += n
        print('   changed px', tot, 'files', len(files))
