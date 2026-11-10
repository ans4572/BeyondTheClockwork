// Halves the chosen status icons to their drawn size and rings them in ink, so they stay readable on pale paving.
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const SOURCE = 'art/status-icon-concepts', OUTPUT = 'art/ui/status-icons', SIZE = 24, INK = [43, 51, 69], SOLID = 128;
const ICONS = { burn: 'c-burn', chill: 'c-chill', frozen: 'c-frozen', shock: 'c-shock', windPressure: 'c-wind', resonance: 'c-resonance', wet: 'c-wet' };

await mkdir(OUTPUT, { recursive: true });
for (const [id, name] of Object.entries(ICONS)) {
  const { data, info } = await sharp(`${SOURCE}/${name}.png`).trim().resize(SIZE - 2, SIZE - 2, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => (y * SIZE + x) * 4, solid = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && data[at(x, y) + 3] >= SOLID, out = Buffer.from(data);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (solid(x, y)) { out[at(x, y) + 3] = 255; continue; }
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid(x + dx, y + dy));
    out.set(edge ? [...INK, 255] : [0, 0, 0, 0], at(x, y));
  }
  await sharp(out, { raw: info }).png().toFile(`${OUTPUT}/${id}.png`);
}
console.log(Object.keys(ICONS).length);
