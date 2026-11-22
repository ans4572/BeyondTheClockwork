"""Build the Orden preview sheets (art/chapters/3-clock-tower/bosses/orden/preview/).

One PNG per form and clip: a row per direction, a column per frame, every frame centred in a
180px cell. 'raw' keeps every PixelLab frame; 'clean' skips the frames listed in
pixellab/characters.json 'drop'. The rotations sheet is one row of eight 180px cells.
Run: python scripts/build-orden-preview.py
"""
import json
import os
import time
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'art', 'chapters', '3-clock-tower', 'bosses', 'orden')
SRC = os.path.join(ROOT, 'pixellab')
OUT = os.path.join(ROOT, 'preview')
CELL = 180
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CLIPS = ['staff-jab', 'staff-raise']
FORMS = [
    # key, folder, drop list in characters.json, name
    ('masked', 'masked', 'masked', '가면 오르덴'),
    ('awakened', 'awakened-nomask', 'awakened-nomask', '정각 오르덴'),
    ('awakened-shard', 'awakened', 'awakened', '정각 오르덴 (가면 조각 있는 원본)'),
]


def centred(im):
    cell = Image.new('RGBA', (CELL, CELL))
    cell.alpha_composite(im, ((CELL - im.size[0]) // 2, (CELL - im.size[1]) // 2))
    return cell


def frames(folder, clip, d):
    path = os.path.join(SRC, folder, 'animations', clip, d)
    return [Image.open(os.path.join(path, f)).convert('RGBA') for f in sorted(os.listdir(path)) if f.endswith('.png')]


def sheet(rows):
    cols = max(len(r) for r in rows)
    out = Image.new('RGBA', (CELL * cols, CELL * len(rows)))
    for y, row in enumerate(rows):
        for x, im in enumerate(row):
            out.alpha_composite(centred(im), (x * CELL, y * CELL))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    record = json.load(open(os.path.join(SRC, 'characters.json'), encoding='utf8'))
    data = {'cell': CELL, 'v': int(time.time()), 'forms': []}   # v: cache-buster for the sheets
    for key, folder, rec, name in FORMS:
        rot = [Image.open(os.path.join(SRC, folder, 'rotations', f'{d}.png')).convert('RGBA') for d in DIRS]
        sheet([rot]).save(os.path.join(OUT, f'{key}-rotations.png'))
        form = {'key': key, 'name': name, 'rotations': f'{key}-rotations.png', 'clips': {}}
        for clip in CLIPS:
            drop = record[rec]['drop'].get(clip, {})
            raw = [frames(folder, clip, d) for d in DIRS]
            clean = [[im for i, im in enumerate(r) if i not in drop.get(d, [])] for r, d in zip(raw, DIRS)]
            sheet(raw).save(os.path.join(OUT, f'{key}-{clip}-raw.png'))
            sheet(clean).save(os.path.join(OUT, f'{key}-{clip}-clean.png'))
            form['clips'][clip] = {
                'raw': {'file': f'{key}-{clip}-raw.png', 'frames': {d: len(r) for d, r in zip(DIRS, raw)}},
                'clean': {'file': f'{key}-{clip}-clean.png', 'frames': {d: len(r) for d, r in zip(DIRS, clean)}},
                'dropped': {d: drop[d] for d in DIRS if d in drop},
            }
        data['forms'].append(form)
    json.dump(data, open(os.path.join(OUT, 'data.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('ok', OUT)


if __name__ == '__main__':
    main()
