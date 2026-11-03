// Every file the game loads exists, and every sprite sheet is the size its clips say.
// Catalogs: the three clip sets, the map data, and the sound and music folders the audio code builds names from.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const json = file => JSON.parse(readFileSync(file, 'utf8'));
const local = url => url.replace(/^\//, '');
/** Width and height from a PNG header, or from a lossy/lossless WebP header. */
function imageSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  throw new Error(`Unknown image format: ${file}`);
}
let files = 0;
const seen = new Set(), must = file => { if (seen.has(file)) return; seen.add(file); assert.ok(existsSync(file), `Missing: ${file}`); files++; };

for (const catalog of ['art/animations/player/game-clips.json', 'art/animations/mobs/normal-elite/game-clips.json', 'art/animations/npc/game-clips.json']) {
  const { clips, castEffects = {} } = json(catalog);
  for (const [key, clip] of Object.entries(clips)) for (const url of [clip.sheet, clip.effect].filter(Boolean)) {
    must(local(url));
    const [w, h] = imageSize(local(url));
    assert.equal(w, clip.frameWidth * clip.columns, `${catalog} ${key} width`);
    assert.equal(h, clip.frameHeight * Math.ceil(clip.frameCount / clip.columns), `${catalog} ${key} height`);
  }
  for (const effect of Object.values(castEffects)) must(local(effect.sheet));
}
const walk = value => { if (typeof value === 'string' && /^\/art\/.+\.(png|webp)$/.test(value)) must(local(value)); else if (value && typeof value === 'object') Object.values(value).forEach(walk); };
walk(json('src/data/maps.json'));
const sfx = readFileSync('src/audio/sfx.js', 'utf8');
for (const [, file, takes] of sfx.matchAll(/file: '([\w-]+)', takes: (\d+)/g)) for (let i = 0; i < Number(takes); i++) must(`art/audio/sfx/${file}-${i}.ogg`);
for (const [, name] of readFileSync('src/audio/music.js', 'utf8').matchAll(/^\s+(\w+): \{ volume/gm)) must(`art/audio/bgm/${name}.ogg`);
console.log(JSON.stringify({ assetsChecked: files }));
