"""Packs the sound and water PixelLab frames (raw/<name>/NN.png, index 00 = the concept) into game sheets.

Fusion effects -> effects/<fusion id>/sheet.png + .webp (played by src/animation/cast-effects.js through
art/animations/player/game-clips.json castEffects). Skill and burst effects -> art/fx/<name>-v1.png (src/render/fx-sprites.js).
Prints the castEffects entries and FX table lines to paste. Run from the repository root: python art/animations/player/skills/sound-water/build.py
"""
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parents[4]
COLS = 4


def frames(name, picks):
    return [Image.open(HERE / 'raw' / name / f'{i:02d}.png').convert('RGBA') for i in picks]


def sheet(images, out):
    w, h = images[0].size
    rows = (len(images) + COLS - 1) // COLS
    img = Image.new('RGBA', (w * COLS, h * rows), (0, 0, 0, 0))
    for i, im in enumerate(images):
        img.alpha_composite(im, ((i % COLS) * w, (i // COLS) * h))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return img


def bbox(im):
    return im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()


def loop(n, count, start=0):
    return [start + (i % n) for i in range(count)]


# ---- Fusion effects (castEffects, placement 'cast'): which frames, how they play, how big, where they stand.
FUSIONS = {
    # id: (frames as (raw name, indices) pieces, playback builder, durationMs, scale, ground, anchor rule or (rule, frame it is measured on))
    'surfaceResonance': ([('film', range(0, 8))], lambda: loop(8, 40), 4000, 1.33, True, 'center'),
    'iceSheet': ([('sheet', range(0, 8)), ('sheetBreak', range(1, 9))], lambda: loop(8, 30) + list(range(8, 16)), 3800, 1.05, True, 'center'),
    'shockPool': ([('pool', range(0, 8))], lambda: loop(8, 32), 3200, 0.95, True, 'center'),
    'steamVeil': ([('veil', range(0, 8))], lambda: loop(8, 20), 2000, 0.8, False, 'center'),
    # Drawn a little larger than 회오리 흡입 (a basic skill), as a fusion should read (2026-11-09).
    'waterspout': ([('spout', range(0, 8)), ('spoutSlam', range(1, 9))], lambda: loop(8, 20) + list(range(8, 16)), 2800, 1.15, False, 'base'),
    # Ice spires rise out of the floor (sinking clip played backwards) by the freeze at 0.3s, hum until the break at 1.1s, then burst.
    # Redrawn 2026-11-08 as standing crystals with sound arcs: the first, a disc ringed with crystals, read like 냉각 지대.
    'highNoteShatter': ([('shatter2Grow', [7, 5, 3]), ('shatter2b', range(0, 13))], lambda: [0, 1, 2] + [3, 4, 5, 6, 7, 8, 9, 9] + list(range(10, 16)), 1700, 0.9, False, ('base', 3)),
    'resonantBolt': ([('speaker', range(0, 8))], lambda: loop(8, 21), 2100, 0.9, False, 'center'),
}

# ---- Small effects (FX table, drawn at their own pixel size, turned by the renderer): frames and anchor rule.
FX = {
    'ringPalm': ('palm', range(0, 9), 'left'),
    'roarBeam': ('roar', range(0, 9), 'left'),
    'waterShot': ('shot', range(0, 8), 'center'),
    'echoRing': ('echo', range(0, 8), 'center'),
    'waterSplash': ('splash', range(0, 9), 'base'),
    'resonanceBurst': ('burst', range(0, 9), 'center'),
    'overheatBurst': ('overheat', range(0, 9), 'base'),
    # 고압 분사's stream: drawn from its left edge (the nozzle), the middle fitted to the stream's length in canvas.js.
    'hydroStream': ('stream1', range(0, 8), 'stream'),
}
FILES = {'ringPalm': 'ring-palm', 'roarBeam': 'roar-beam', 'waterShot': 'water-shot', 'echoRing': 'echo-ring', 'waterSplash': 'water-splash', 'resonanceBurst': 'resonance-burst', 'overheatBurst': 'overheat-burst', 'hydroStream': 'hydro-stream'}


def anchor(im, rule):
    l, t, r, b = bbox(im)
    cx, cy = (l + r) // 2, (t + b) // 2
    if rule == 'left': return [l + 4, cy]
    if rule == 'stream': return [0, cy]
    if rule == 'base': return [cx, b - max(6, (r - l) // 10)]
    if rule == 'oval': return [cx, b - int((r - l) * 0.22)]
    return [cx, cy]


def main():
    cast_effects = {}
    for fid, (pieces, playback, duration, scale, ground, rule) in FUSIONS.items():
        ims = [im for name, picks in pieces for im in frames(name, picks)]
        out = HERE / 'effects' / fid / 'sheet.png'
        img = sheet(ims, out)
        img.save(out.with_suffix('.webp'), lossless=True)
        w, h = ims[0].size
        rule, at = rule if isinstance(rule, tuple) else (rule, 0)
        cast_effects[fid] = {'sheet': f'/{out.with_suffix(".webp").relative_to(ROOT).as_posix()}', 'frameWidth': w, 'frameHeight': h, 'columns': COLS,
                             'playback': playback(), 'durationMs': duration, 'releaseMs': 0, 'anchor': anchor(ims[at], rule), 'placement': 'cast', 'scale': scale, 'ground': ground}
    fx_lines = []
    for key, (name, picks, rule) in FX.items():
        ims = frames(name, picks)
        out = ROOT / 'art' / 'fx' / f'{FILES[key]}-v1.png'
        sheet(ims, out)
        w, h = ims[0].size
        fx_lines.append(f"  {key}: {{ sheet: 'art/fx/{FILES[key]}-v1.png', w: {w}, h: {h}, cols: {COLS}, frames: {len(ims)}, anchor: {json.dumps(anchor(ims[0], rule))} }},")
    (HERE / 'cast-effects.json').write_text(json.dumps(cast_effects, indent=1) + '\n', encoding='utf-8')
    print('\n'.join(fx_lines))


if __name__ == '__main__':
    main()
