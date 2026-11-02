// Removes the pink planning lines baked into two parade concept images, on the floor only.
// Reads the untouched concepts, so running it again gives the same backgrounds.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { pointInPolygon } from '../src/engine/map-geometry.js';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const WIDTH = 1120, HEIGHT = 640, MARGIN_UNITS = 0.7, SEARCH_PIXELS = 6;
const TARGETS = { 'stop-10': 'art/smile-street/map-concepts/combat-variants/parade-approach-c-v1.png', 'stop-12': 'art/smile-street/map-concepts/combat-variants/parade-approach-d-v1.png' };
const { maps } = JSON.parse(await readFile('src/data/maps.json', 'utf8'));
// Pink keeps blue near green; the tan floor does not, and the red banners have far less green.
const isGuide = (r, g, b) => r > 170 && g > 95 && r - g > 38 && b - g > -14;
// Lines outside the floor, around the arches: [left, top, right, bottom] in units.
const EXTRA = { 'stop-10': [[0, 12.6, 7.5, 16], [9.6, 12.2, 11, 13.6]], 'stop-12': [[5, 11.6, 9, 15], [24.6, 11.4, 27, 13.5]] };

for (const [room, source] of Object.entries(TARGETS)) {
  const map = maps[room], { data } = await sharp(source).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const inExtra = (x, y) => EXTRA[room].some(([l, t, r, b]) => x >= l * 40 && x < r * 40 && y >= t * 40 && y < b * 40);
  const near = (x, y) => inExtra(x, y) || [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]].some(([dx, dy]) => pointInPolygon(x / 40 + dx * MARGIN_UNITS, y / 40 + dy * MARGIN_UNITS, map.walkable));
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = (y * WIDTH + x) * 3;
    if (isGuide(data[i], data[i + 1], data[i + 2]) && near(x, y)) mask[y * WIDTH + x] = 1;
  }
  // Grow by one pixel to catch the soft edge left by resizing.
  const grown = mask.slice();
  for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) if (mask[y * WIDTH + x]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) grown[(y + dy) * WIDTH + x + dx] = 1;
  const out = Buffer.from(data);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (!grown[y * WIDTH + x]) continue;
    const sum = [0, 0, 0];
    let count = 0;
    for (let dy = -SEARCH_PIXELS; dy <= SEARCH_PIXELS; dy++) for (let dx = -SEARCH_PIXELS; dx <= SEARCH_PIXELS; dx++) {
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT || grown[py * WIDTH + px]) continue;
      const i = (py * WIDTH + px) * 3;
      sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; count++;
    }
    if (count) for (let c = 0; c < 3; c++) out[(y * WIDTH + x) * 3 + c] = sum[c] / count;
  }
  await writeFile(path.join('art/smile-street/maps', map.id, 'background.png'), await sharp(out, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).png().toBuffer());
  console.log(room, 'cleaned', grown.reduce((s, v) => s + v, 0));
}
