"""Builds F2's v2 sprite set (2026-11-26 redraw: boss-level shading, clean helmet, visible left glove) and points the game at it.

Input: art/animations/player/v2/clips/<action>-<direction>/frames/NNN.png, PixMiniMax frames as downloaded
(000 is the input pose and is left out of playback; job.txt holds the PixelLab job id).
Output: a 4-column sheet.png and lossless sheet.webp per clip, v2/manifest.json, and the F2 entries in
art/animations/player/game-clips.json rewritten to the new sheets. Everything else in game-clips.json
(locomotion tuning, castActions, castEffects) is kept, because scripts/build-game-clips.mjs can no longer
rebuild the F2 set: its fusion layout files are not in the repository.

  python scripts/build-f2-v2.py        then python scripts/build-atlases.py
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'art/animations/player/v2')
GAME = os.path.join(ROOT, 'art/animations/player/game-clips.json')
DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
# Total length per action, kept from the clips they replace so game timing stays the same.
DURATION = {'idle': 1600, 'walk': 720, 'run': 480, 'attack-1': 800, 'attack-2': 850, 'attack-3': 1100,
            'heatSwing': 720, 'frostBolt': 800, 'conductiveSpanner': 720, 'pressureDash': 400,
            'exhaustBurst': 720, 'coolingField': 720, 'capacitorStrike': 720, 'vortexIntake': 720,
            'hit': 360, 'death': 1300, 'dodge': 180, 'cast-selfBurst': 720, 'cast-forwardCast': 720, 'cast-placeCast': 720}
LOOP = {'idle', 'walk', 'run'}
COLS = 4

def feet(frames, loop):
    """Foot point as build-game-clips.mjs measures it: lowest opaque row, median centre of the bottom 12 rows."""
    xs, bottoms = [], []
    for f in (frames if loop else frames[:1]):
        a = f.getchannel('A').load(); w, h = f.size
        bottom = next((y for y in range(h - 1, -1, -1) if any(a[x, y] > 30 for x in range(w))), -1)
        pts = [x for y in range(max(0, bottom - 11), bottom + 1) for x in range(w) if a[x, y] > 30]
        if pts: xs.append(sum(pts) / len(pts)); bottoms.append(bottom)
    xs.sort()
    return [round(xs[len(xs) // 2]), max(bottoms)]

def top(frame):
    a = frame.getchannel('A').load(); w, h = frame.size
    return next(y for y in range(h) for x in range(w) if a[x, y] > 30)

clips, game = [], json.load(open(GAME, encoding='utf-8'))
for action, total in DURATION.items():
    for d in DIRS:
        folder = os.path.join(V2, 'clips', f'{action}-{d}')
        names = sorted(n for n in os.listdir(os.path.join(folder, 'frames')) if n.endswith('.png') and n != '000.png')
        frames = [Image.open(os.path.join(folder, 'frames', n)).convert('RGBA') for n in names]
        w, h = frames[0].size; n = len(frames)
        sheet = Image.new('RGBA', (w * COLS, h * ((n + COLS - 1) // COLS)), (0, 0, 0, 0))
        for i, f in enumerate(frames): sheet.alpha_composite(f, ((i % COLS) * w, (i // COLS) * h))
        sheet.save(os.path.join(folder, 'sheet.png'), optimize=True)
        sheet.save(os.path.join(folder, 'sheet.webp'), lossless=True, method=6)
        cuts = [round(total * i / n) for i in range(n + 1)]
        durations = [cuts[i + 1] - cuts[i] for i in range(n)]
        # One-shot clips start already moving, so feet and height come from the shared input pose (000).
        pose = Image.open(os.path.join(folder, 'frames', '000.png')).convert('RGBA')
        anchor = feet(frames if action in LOOP else [pose], action in LOOP)
        rel = f'clips/{action}-{d}/sheet.webp'
        clips.append({'action': action, 'direction': d, 'frameWidth': w, 'frameHeight': h, 'columns': COLS, 'frameCount': n,
                      'frameDurationsMs': durations, 'durationMs': total, 'loop': action in LOOP, 'sheet': rel,
                      'job': open(os.path.join(folder, 'frames', 'job.txt')).read().strip()})
        game['clips'][f'{action}/{d}'] = {'sheet': f'/art/animations/player/v2/{rel}', 'provider': 'pixellab', 'frameWidth': w, 'frameHeight': h,
                                          'columns': COLS, 'frameCount': n, 'frameDurationsMs': durations, 'durationMs': total,
                                          'loop': action in LOOP, 'scale': 1, 'anchor': anchor, 'bodyHeight': anchor[1] - top(pose)}
json.dump({'schemaVersion': 1, 'character': 'F2', 'model': 'PixelLab PixMiniMax', 'bases': {d: f'bases/{d}.png' for d in DIRS}, 'clips': clips},
          open(os.path.join(V2, 'manifest.json'), 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
with open(GAME, 'w', encoding='utf-8', newline='\n') as f: f.write(json.dumps(game, ensure_ascii=False) + '\n')  # one line, as committed
print(len(clips), 'clips written')
