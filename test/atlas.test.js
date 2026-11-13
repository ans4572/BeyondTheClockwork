import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

// The atlas pages (scripts/build-atlases.py, 2026-11-13) hold copies of the sprite sheets. A sheet redrawn after the
// pages were built would show its old picture in the game, so a changed sheet fails here until the pages are rebuilt.
const index = JSON.parse(await readFile('art/atlases/index.json', 'utf8'));
const sha1 = async file => createHash('sha1').update(await readFile(file.replace(/^\//, ''))).digest('hex');

test('every sheet on an atlas page is the same as its own file (rebuild: python scripts/build-atlases.py)', async () => {
  const changed = [];
  for (const [sheet, hash] of Object.entries(index.sources)) if (await sha1(sheet).catch(() => 'missing') !== hash) changed.push(sheet);
  assert.deepEqual(changed, [], `sheets changed since the atlas pages were built: ${changed.slice(0, 5).join(', ')}`);
});

test('each page exists, stays within 2048 x 2048, and its sheets do not overlap', async () => {
  for (const [page, sheets] of Object.entries(index.pages)) {
    await stat(page);
    const rects = Object.values(sheets);
    for (const [x, y, w, h] of rects) assert.ok(x >= 0 && y >= 0 && x + w <= 2048 && y + h <= 2048, page);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const [a, b] = [rects[i], rects[j]];
      assert.ok(a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1], `${page}: sheets overlap`);
    }
  }
});

test('every sheet the sprite libraries name is on a page (a new one would load by itself, slowly)', async () => {
  const missing = [];
  for (const manifest of ['art/animations/player/game-clips.json', 'art/animations/npc/game-clips.json', 'art/animations/mobs/normal-elite/game-clips.json', 'art/animations/mobs/silent-factory/game-clips.json']) {
    const data = JSON.parse(await readFile(manifest, 'utf8'));
    const sheets = [...Object.values(data.clips).flatMap(clip => [clip.sheet, clip.effect]), ...Object.values(data.castEffects || {}).map(effect => effect.sheet)].filter(Boolean);
    for (const sheet of new Set(sheets)) if (!(sheet in index.sources)) missing.push(sheet);
  }
  assert.deepEqual(missing, [], `sheets on no atlas page: ${missing.slice(0, 5).join(', ')} (python scripts/build-atlases.py)`);
});
