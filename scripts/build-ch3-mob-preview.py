"""Builds the chapter 3 mob preview page's sheets from PixelLab (art/chapters/3-clock-tower/mobs/preview/).

Downloads each character listed in art/chapters/3-clock-tower/mobs/pixellab/characters.json and writes, per character,
one PNG per animation (rows = the eight directions, columns = frames, every cell the same size, the frame centred) plus
a rotations strip, and data.json describing them for index.html. Frames are as PixelLab made them: flashes and trails are
not cleaned here (the game importer will do that). Run: python scripts/build-ch3-mob-preview.py
"""
import io
import json
import os
import urllib.request
import zipfile

from PIL import Image

ROOT = 'art/chapters/3-clock-tower/mobs'
OUT = f'{ROOT}/preview'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
NAMES = {
    'secondHandKnight': '초침 기사', 'bellTurret': '종 탄환 포탑', 'signalOrb': '신호 구체', 'hourglassShield': '모래시계 방패병',
    'minuteArcher': '분침 궁수', 'pendulumGuard': '추 경비', 'gearRoller': '톱니 굴림병', 'twinHandCaptain': '쌍침 기사단장 (정예)',
}
ROLES = {
    'secondHandKnight': '근접 · 반 바퀴 회전 베기', 'bellTurret': '고정 원거리 · 포물선 종 + 진동 고리', 'signalOrb': '지원 · 가속 신호(주변 몹 속도 +30%)',
    'hourglassShield': '탱커 · 정면 방패, 내려찍기 충격파', 'minuteArcher': '원거리 · 초침 박자로 1초에 1발, 3연발', 'pendulumGuard': '공간 제어 · 쇠공 추 휘두르기',
    'gearRoller': '돌진 · 톱니바퀴를 굴려 일직선 돌진', 'twinHandCaptain': '정예 · 분침 창 + 시침 검 두 겹 회전 베기',
}

os.makedirs(OUT, exist_ok=True)
chars = {k: v for k, v in json.load(open(f'{ROOT}/pixellab/characters.json', encoding='utf-8')).items() if not k.startswith('_')}
data = []
for key, info in chars.items():
    raw = urllib.request.urlopen(f"https://api.pixellab.ai/mcp/characters/{info['id']}/download").read()
    z = zipfile.ZipFile(io.BytesIO(raw))
    names = z.namelist()
    entry = {'key': key, 'name': NAMES.get(key, key), 'role': ROLES.get(key, ''), 'front': f"../front/{info['file']}-south-v1.png", 'use': info.get('use', {}), 'animations': []}
    # Rotations strip.
    rots = [Image.open(io.BytesIO(z.read(next(n for n in names if n.endswith(f'rotations/{d}.png'))))).convert('RGBA') for d in DIRS]
    cell = max(max(r.size) for r in rots)
    strip = Image.new('RGBA', (cell * 8, cell))
    for i, r in enumerate(rots):
        strip.alpha_composite(r, (i * cell + (cell - r.width) // 2, (cell - r.height) // 2))
    strip.save(f'{OUT}/{key}-rotations.png')
    entry['rotations'] = {'file': f'{key}-rotations.png', 'cell': cell}
    anims = sorted({n.split('/animations/')[1].split('/')[0] for n in names if '/animations/' in n})
    clip = lambda anim, d: [Image.open(io.BytesIO(z.read(f))).convert('RGBA') for f in sorted(n for n in names if f'/animations/{anim}/{d}/' in n and n.endswith('.png'))]

    def write(name, frames, note=None):
        """One sheet: a row per direction that has frames, every cell the size of the largest frame, frames centred."""
        dirs = [d for d in DIRS if frames.get(d)]
        cell = max(max(im.size) for d in dirs for im in frames[d])
        cols = max(len(frames[d]) for d in dirs)
        sheet = Image.new('RGBA', (cell * cols, cell * len(dirs)))
        for r, d in enumerate(dirs):
            for c, im in enumerate(frames[d]):
                sheet.alpha_composite(im, (c * cell + (cell - im.width) // 2, r * cell + (cell - im.height) // 2))
        file = f'{key}-{name}.png'
        sheet.save(f'{OUT}/{file}', optimize=True)
        entry['animations'].append({'name': name, 'file': file, 'cell': cell, 'dirs': dirs, 'frames': {d: len(frames[d]) for d in dirs}, 'note': note or {}})

    # What the game will use (characters.json `final`): per direction a clip, or another direction's clip mirrored.
    for kind, spec in (info.get('final') or {}).items():
        if not spec:
            continue
        frames, note = {}, {}
        for d in DIRS:
            pick = spec.get(d, spec.get('default'))
            if isinstance(pick, dict):
                frames[d] = [im.transpose(Image.FLIP_LEFT_RIGHT) for im in clip(pick['from'], pick['dir'])]
                note[d] = f"{pick['from']} {pick['dir']} 좌우 반전"
            else:
                frames[d] = clip(pick, d)
                note[d] = pick
        write(f'final-{kind}', frames, note)
    for anim in anims:
        write(anim, {d: clip(anim, d) for d in DIRS})
    data.append(entry)
    print(key, [a['name'] for a in entry['animations']])
json.dump(data, open(f'{OUT}/data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
