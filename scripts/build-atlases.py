"""Packs the sprite sheets into atlas pages, so the browser fetches a few dozen files instead of about 1,200.

Each page is a lossless WebP of at most PAGE x PAGE pixels holding many sheets side by side, and
art/atlases/index.json says where each sheet sits on which page. The game cuts each sheet back out as it loads
(src/animation/sprite-library.js fromAtlas), under the sheet's own name, so nothing that draws sprites changes; a
sheet that is not on a page is fetched by itself as before.

Sheets are grouped by when the game asks for them (F2's walking and wrench first, his skills later, the townsfolk
standing then walking, each chapter's mobs), so a page never holds something needed much later than the rest.

  python scripts/build-atlases.py        rebuilds every page and the index (needs Pillow)
test/atlas.test.js fails when a sheet changed after the pages were built, or a new sheet is on no page.
"""
import hashlib, json, os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = 'art/atlases'
PAGE = 2048  # 16 MB decoded at most; phones (iPhones above all) refuse much larger pictures.
# F2's actions the boot waits for (main.js PLAYER_LATER); everything else of his comes later.
PLAYER_FIRST = {'idle', 'walk', 'run', 'attack-1', 'attack-2', 'attack-3', 'hit', 'death', 'dodge'}

def clips(manifest, later=lambda action: False):
    """The sheets a game-clips.json names, split as SpriteLibrary.load splits them: wanted first, and the rest."""
    data = json.load(open(os.path.join(ROOT, manifest), encoding='utf-8'))
    entries = list(data['clips'].items())
    sheets = lambda items: [s for _, clip in items for s in (clip.get('sheet'), clip.get('effect')) if s]
    first = list(dict.fromkeys(sheets([(key, clip) for key, clip in entries if not later(key.split('/')[0])])))
    effects = [e['sheet'] for e in data.get('castEffects', {}).values() if e.get('sheet')]
    rest = [s for s in dict.fromkeys(sheets(entries) + effects) if s not in first]
    return first, rest

def groups():
    player_first, player_later = clips('art/animations/player/game-clips.json', lambda action: action not in PLAYER_FIRST)
    npc_standing, npc_walks = clips('art/animations/npc/game-clips.json', lambda action: action.endswith('-walk'))
    mobs_1, _ = clips('art/animations/mobs/normal-elite/game-clips.json')
    mobs_2, _ = clips('art/animations/mobs/silent-factory/game-clips.json')
    return {'f2-first': player_first, 'f2-later': player_later, 'npc-standing': npc_standing, 'npc-walks': npc_walks,
            'mobs-1': mobs_1, 'mobs-2': mobs_2}

def sha1(path):
    with open(path, 'rb') as f: return hashlib.sha1(f.read()).hexdigest()

def pack(sizes):
    """Shelf packing, tallest first: a list of pages, each a list of (index, x, y)."""
    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], -sizes[i][0]))
    pages, page, x, y, shelf = [], [], 0, 0, 0
    for i in order:
        w, h = sizes[i]
        if w > PAGE or h > PAGE: raise SystemExit(f'sheet larger than a page: {w}x{h}')
        if x + w > PAGE: x, y, shelf = 0, y + shelf, 0
        if y + h > PAGE: pages.append(page); page, x, y, shelf = [], 0, 0, 0
        page.append((i, x, y)); x += w; shelf = max(shelf, h)
    if page: pages.append(page)
    return pages

def main():
    out_dir = os.path.join(ROOT, OUT); os.makedirs(out_dir, exist_ok=True)
    index = {'note': 'Made by scripts/build-atlases.py; do not edit.', 'pages': {}, 'sources': {}}
    seen = set()
    for name, sheets in groups().items():
        sheets = [s for s in sheets if s not in seen and os.path.exists(os.path.join(ROOT, s.lstrip('/')))]
        seen.update(sheets)
        images = [Image.open(os.path.join(ROOT, s.lstrip('/'))).convert('RGBA') for s in sheets]
        for n, page in enumerate(pack([im.size for im in images])):
            width = max(x + images[i].size[0] for i, x, _ in page); height = max(y + images[i].size[1] for i, _, y in page)
            canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            for i, x, y in page: canvas.paste(images[i], (x, y))
            temp = os.path.join(out_dir, f'{name}-{n}.tmp.webp')
            canvas.save(temp, 'WEBP', lossless=True, quality=100, method=6, exact=True)
            file = f'{OUT}/{name}-{n}-{sha1(temp)[:10]}.webp'
            os.replace(temp, os.path.join(ROOT, file))
            index['pages'][file] = {sheets[i]: [x, y, *images[i].size] for i, x, y in page}
            print(f'{file}: {len(page)} sheets, {width}x{height}, {os.path.getsize(os.path.join(ROOT, file)) / 1e6:.2f} MB')
        for s in sheets: index['sources'][s] = sha1(os.path.join(ROOT, s.lstrip('/')))
    keep = {os.path.basename(f) for f in index['pages']} | {'index.json'}
    for f in os.listdir(out_dir):
        if f not in keep: os.remove(os.path.join(out_dir, f))
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8', newline='\n') as f: json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    print(f"{len(index['pages'])} pages for {len(index['sources'])} sheets")
    # index.html preloads F2's first pages by name, so the list follows the new names.
    subprocess.run(['node', 'scripts/sync-preloads.mjs'], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
