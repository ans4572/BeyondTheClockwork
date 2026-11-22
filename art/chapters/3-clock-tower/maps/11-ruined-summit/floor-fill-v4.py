"""Summit bottom: fill the clouds (v2x) where Codex put the clockwork pit (v3x) with the marble floor running on to the
front parapet. Writes background-v4x.png (2x), background-v4-1x.png and background-v4-2x-q85.webp."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

D = 'art/chapters/3-clock-tower/maps/11-ruined-summit/'
OUT = sys.argv[1] if len(sys.argv) > 1 else D
L, DX = int(sys.argv[2]) if len(sys.argv) > 2 else 133, int(sys.argv[3]) if len(sys.argv) > 3 else 10

v2 = np.array(Image.open(D + 'background-v2x.png').convert('RGB')).astype(np.float32)
v3 = np.array(Image.open(D + 'background-v3x.png').convert('RGB')).astype(np.float32)
H, W, _ = v2.shape

# the hole: what Codex changed below the floor edge, closed and filled, with the cloud fringe taken in
hole = np.abs(v2 - v3).sum(2) > 60
hole[:1870] = False
hole = nd.binary_opening(hole, iterations=2)
hole = nd.binary_closing(hole, iterations=6)
hole = nd.binary_fill_holes(hole)
lab, n = nd.label(hole)
sizes = nd.sum(hole, lab, range(1, n + 1))
hole = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 4000])
hole = nd.binary_dilation(hole, iterations=3)
# cloud left over beside the hole (Codex kept a few wisps the diff missed): bluish-light or near-white pixels of v2
r, g, b = v2[..., 0], v2[..., 1], v2[..., 2]
cloud = ((b > r + 4) & (r + g + b > 450)) | ((r > 244) & (g > 226) & (b > 198))
cloud[:1870] = False
cloud = nd.binary_closing(cloud, iterations=3)
near = nd.binary_dilation(hole, iterations=40)
lab, n = nd.label(cloud & near)
touch = set(np.unique(lab[nd.binary_dilation(hole, iterations=2) & (lab > 0)]))
hole |= np.isin(lab, list(touch - {0}))
# the sky between the right parapet's pieces: flood from inside it over smooth (outline-free) pixels
gray = v2.mean(2)
edge = np.hypot(nd.sobel(gray, 0), nd.sobel(gray, 1)) > 90
box = np.zeros_like(edge); box[1840:2030, 2640:2900] = True
sky, _ = nd.label(~edge & box)
sky = sky == sky[1950, 2830]
inner = np.zeros_like(edge); inner[1868:2030, 2672:2900] = True   # leave the floor the flood leaked into near the box's sides
patch = nd.binary_dilation(nd.binary_closing(sky, iterations=2), iterations=2) & inner & ~hole
hole |= patch
# and the sky seen between the parapet's broken pieces on the right, inside the floor's width
lab2, n2 = nd.label(cloud)
for i in range(1, n2 + 1):
    yy, xx = np.where(lab2 == i)
    if len(yy) > 300 and xx.min() > 540 and xx.max() < 2930: hole[yy, xx] = True
hole = nd.binary_fill_holes(nd.binary_closing(hole, iterations=3))
hole = nd.binary_dilation(hole, iterations=1)
hole[:1870] = False

# the marble running on: each hole pixel copies the floor one tile-step up (and DX across), row by row so the copy can
# chain through rows already filled
img = v2.copy()
ys = np.where(hole.any(1))[0]
for y in range(ys.min(), ys.max() + 1):
    xs = np.where(hole[y])[0]
    sx = np.clip(xs + DX, 0, W - 1)
    img[y, xs] = img[y - L, sx]

# where the hole was cut flat at row 1870 over plain floor, fade the copy in so no straight seam shows
ramp = np.clip((np.arange(H, dtype=np.float32) - 1870) / 36, 0, 1)[:, None]
a_ = np.where(hole & ~cloud, ramp, 1)[..., None]
img = v2 * (1 - a_) + img * a_

top = np.full(W, H)
for x in range(W):
    c = np.where(hole[:, x])[0]
    if len(c): top[x] = c[0]

# contact shadow at the foot of the parapet and its rubble: everything not hole below the hole's top edge
rubble = np.zeros_like(hole)
for x in range(W):
    if top[x] < H: rubble[top[x]:, x] = ~hole[top[x]:, x]
rubble[2240:] |= ~hole[2240:]
lab, n = nd.label(rubble)
sizes = nd.sum(rubble, lab, range(1, n + 1))
rubble = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2500])
dist = nd.distance_transform_edt(~rubble)
shade = np.clip(1 - dist / 46, 0, 1) ** 1.6 * 0.42
shade = np.where(hole, shade, 0)[..., None]
tint = np.array([70, 48, 92], np.float32)   # the parapet's purple shadow
img = img * (1 - shade) + tint * shade

out = np.clip(img, 0, 255).astype(np.uint8)
im = Image.fromarray(out)
im.save(OUT + 'background-v4x.png')
im.resize((W // 2, H // 2), Image.LANCZOS).save(OUT + 'background-v4-1x.png')
im.save(OUT + 'background-v4-2x-q85.webp', quality=85, method=6)
print('hole px', int(hole.sum()), 'rows', ys.min(), ys.max())

# the depth mask: the new floor is ground (black), not scenery that would hide F2 standing on it
mask = np.array(Image.open(D + 'mask-v1-1x.png').convert('L'))
small = np.array(Image.fromarray((hole * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR)) > 127
mask[small] = 0
# close the slivers left between the old floor's edge and the new floor
ground = mask == 0
closed = nd.binary_closing(ground, iterations=8)
closed[:900] = ground[:900]
mask[closed] = 0
Image.fromarray(mask).convert('1').save(OUT + 'mask-v2-1x.png')
