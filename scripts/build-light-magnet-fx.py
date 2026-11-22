"""Packs the light/magnet PixelLab effects (2026-11-21) into art/fx/lm-*-pl-v1.png and prints the FX table lines.

Raw frames live in art/icon-concepts/light-magnet-pixellab/fx (Git ignores them): <name>.png is a Pro Flash concept,
<name>/NN.png an animate_image_pixminimax clip (00 = the concept). Job numbers: docs/design/light-magnet-fx-jobs.json.
Run from the repository root: python scripts/build-light-magnet-fx.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'art' / 'icon-concepts' / 'light-magnet-pixellab' / 'fx'
COLS = 4

# FX key: (file, raw name, frames (None = the still concept), fps, kind). kind: 'strip' keeps the 128x32 canvas and is
# stretched along a line from its left end; 'burst' keeps the canvas and stands on its ring's middle; the rest are
# cropped to what they show and stand on their middle ('left' = on the left end's middle, for the rail's breech).
PIECES = {
    'lmBeamLight': ('beam-light', 'beamLight', [0, 1, 2, 5], 12, 'strip'),    # frames 3, 4, 6, 7 turned red
    'lmBeamRefract': ('beam-refract', 'beamRefract', range(8), 14, 'strip'),
    'lmRailBeam': ('rail-beam', 'railBeam', range(8), 16, 'strip'),
    'lmDashBand': ('dash-band', 'dashBand', [0, 1, 2, 6, 7], 10, 'strip'),  # 3-5 dimmed to orange
    # (lmWire, the first bare wire strip, was dropped for the cable and posts on 2026-11-21.)
    'lmFlashBurst': ('flash', 'flash', range(13), 26, 'burst'),
    'lmSlam': ('slam', 'slam', range(7), 18, 'burst'),                        # later frames keep a stray rock
    'lmLiftHeap': ('lift-heap', 'heap', range(8), 8, 'center'),
    'lmCoil': ('coil', 'coil', range(8), 14, 'left'),
    'lmStar': ('star', 'star', range(8), 10, 'center'),
    'lmCan': ('can', 'can', None, 1, 'center'),
    'lmScrap': ('scrap', 'pellet', None, 1, 'center'),
    # 대구경's one slug (user, 2026-11-22: the pellet drawn twice as big read blocky), drawn at its own size.
    'lmSlug': ('slug', 'slugB', None, 1, 'center'),
    'lmIceShard': ('ice-shard', 'iceShard', None, 1, 'center'),
    'lmSaw': ('saw', 'saw', None, 1, 'center'),
    'lmClamp': ('clamp', 'clamp', None, 1, 'center'),
    # 쇳물 공's ball (user, 2026-11-21: redrawn to sit with the map; the map's copper bollard was the style picture).
    'lmBall': ('ball', 'ballMap', range(8), 14, 'center'),
    # 울리는 쇠줄 (user, 2026-11-21: the bare wire did not sit with the map): a copper post like the yard's rope-fence bollards,
    # standing on its foot, and a twisted steel cable strip laid in short pieces along the sagging wire.
    'lmPost': ('post', 'post', None, 1, 'foot'),
    'lmCable': ('cable', 'cable', None, 1, 'strip'),
    # 소나기 무지개 (2026-11-21): the rain cloud (billowing) and the rainbow arch standing on its feet.
    'lmCloud': ('cloud', 'cloud', range(8), 8, 'center'),
    'lmArch': ('arch', 'arch', None, 1, 'foot'),
    # 한낮 표적 (user, 2026-11-21: redrawn with PixelLab in place of the pixelfx sun, pillar and burst).
    'lmSun': ('noon-sun', 'noonSun', range(8), 16, 'center'),
    'lmPillar': ('noon-pillar', 'noonPillar2', None, 1, 'foot'),
    'lmSunBurst': ('noon-burst', 'noonBurst', range(13), 26, 'burst'),
    # The last four (user, 2026-11-21: 서리 프리즘, 자성 유체 덩굴, 북극광 고리 and 쇳물 공's burst, pixelfx and code before).
    'lmPrism': ('ice-prism', 'prism2', None, 1, 'foot'),
    'lmIceBeam': ('ice-beam', 'iceBeam', None, 1, 'strip'),
    'lmSpikes': ('ferro-spikes', 'ferroSpikes', range(8), 32, 'foot'),
    'lmFerroTrail': ('ferro-trail', 'ferroTrail', None, 1, 'strip'),
    'lmFerroPool': ('ferro-pool', 'ferroPool', None, 1, 'center'),
    'lmHalo': ('aurora-halo', 'halo2', range(8), 12, 'center'),
    'lmCurtain': ('aurora-curtain', 'curtain2', range(9), 18, 'foot'),
    'lmMoltenBurst': ('molten-burst', 'moltenBurst2', range(13), 26, 'burst'),
}


def fill_slits(im):
    """Fills see-through gaps up to 3 px wide inside a row of light (the PixelLab pillar came with a hollow line down it)."""
    px = im.load(); w, h = im.size
    for y in range(h):
        x = 0
        while x < w:
            if px[x, y][3] > 40:
                gap = 0
                while x + 1 + gap < w and px[x + 1 + gap, y][3] <= 40 and gap < 4: gap += 1
                if 0 < gap <= 3 and x + 1 + gap < w and px[x + 1 + gap, y][3] > 40:
                    for g in range(1, gap + 1): px[x + g, y] = px[x, y] if px[x, y][0] + px[x, y][1] >= px[x + 1 + gap, y][0] + px[x + 1 + gap, y][1] else px[x + 1 + gap, y]
                x += gap + 1
            else: x += 1
    return im


def drop_slab(im, rows=16):
    """Clears the grey floor slab PixelLab sometimes paints under a column of light: dull, greyish pixels in the bottom rows."""
    px = im.load(); w, h = im.size
    for y in range(max(0, h - rows), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) - min(r, g, b) < 40 and max(r, g, b) < 200: px[x, y] = (0, 0, 0, 0)
    return im


def load(raw, picks):
    if picks is None:
        im = Image.open(RAW / f'{raw}.png').convert('RGBA')
        return [fill_slits(im) if raw == 'noonPillar2' else im]
    ims = [Image.open(RAW / raw / f'{i:02d}.png').convert('RGBA') for i in picks]
    return [drop_slab(im) for im in ims] if raw == 'curtain2' else ims


def alpha_box(im, cut=40):
    return im.getchannel('A').point(lambda a: 255 if a > cut else 0).getbbox()


# Where each burst stands, measured on its first frame: the flash's white heart, the middle of the slam's blue ring.
BURST_ANCHORS = {'lmFlashBurst': [64, 64], 'lmSlam': [63, 88], 'lmSunBurst': [64, 64], 'lmMoltenBurst': [64, 64]}


def main():
    lines = []
    for key, (file, raw, picks, fps, kind) in PIECES.items():
        ims = load(raw, picks)
        if key == 'lmCan':  # the lens lit: a second frame for the blink on the floor
            lit = ims[0].copy(); px = lit.load()
            for y in range(lit.height):
                for x in range(lit.width):
                    r, g, b, a = px[x, y]
                    if a and r > 190 and g > 190 and b > 170: px[x, y] = (255, 255, 255, a)
            ims.append(lit)
        if kind in ('center', 'left', 'foot'):
            boxes = [b for b in (alpha_box(im, 8) for im in ims) if b]  # a fully faded last frame has no box
            l = min(b[0] for b in boxes) - 1; t = min(b[1] for b in boxes) - 1; r = max(b[2] for b in boxes) + 1; b_ = max(b[3] for b in boxes) + 1
            l, t = max(0, l), max(0, t); r, b_ = min(ims[0].width, r), min(ims[0].height, b_)
            ims = [im.crop((l, t, r, b_)) for im in ims]
        w, h = ims[0].size
        cols = min(COLS, len(ims)); rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
        for i, im in enumerate(ims): sheet.alpha_composite(im, ((i % cols) * w, (i // cols) * h))
        out = ROOT / 'art' / 'fx' / f'lm-{file}-pl-v1.png'
        sheet.save(out)
        if kind == 'strip':
            l, t, r, b = alpha_box(ims[0]); anchor = [0, (t + b) // 2]; extra = ', ends: [8, 8]'
        elif kind == 'burst':
            anchor = BURST_ANCHORS[key]; extra = ''
        elif kind == 'foot':
            l, t, r, b = alpha_box(ims[0]); anchor = [w // 2, b - 2]; extra = ''
        elif kind == 'left':
            l, t, r, b = alpha_box(ims[0]); anchor = [l, (t + b) // 2]; extra = ''
        else:
            anchor = [w // 2, h // 2]; extra = ''
        lines.append(f"  {key}: {{ sheet: 'art/fx/lm-{file}-pl-v1.png', w: {w}, h: {h}, cols: {cols}, frames: {len(ims)}, fps: {fps}, anchor: {json.dumps(anchor)}{extra} }},")
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
