// Removes the sparks, stars and dust PixelLab draws around a figure: every piece of the frame that is not joined to
// the figure itself. The figure is the largest connected patch of pixels; a held weapon or prop touching it stays.
// Bright effect pixels (near-white or hot yellow) along the figure's outer edge are trimmed too, a few rings deep.
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const SOLID = 30;

/** Cleans one PNG buffer and returns the cleaned PNG buffer. */
export async function stripEffects(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), { width: w, height: h } = info;
  const solid = i => data[i * 4 + 3] > SOLID, label = new Int32Array(w * h).fill(-1), sizes = [];
  for (let start = 0; start < w * h; start++) {
    if (!solid(start) || label[start] >= 0) continue;
    const id = sizes.length, stack = [start]; label[start] = id; let size = 0;
    while (stack.length) {
      const i = stack.pop(); size++;
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, n = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid(n) && label[n] < 0) { label[n] = id; stack.push(n); }
      }
    }
    sizes.push(size);
  }
  const body = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) if (label[i] >= 0 && label[i] !== body) data[i * 4 + 3] = 0;
  // Glare joined to the edge: peel bright, effect-coloured pixels that sit on the outline, ring by ring.
  const glare = i => { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; return (r > 235 && g > 235 && b > 200) || (r > 235 && g > 190 && b < 120); };
  for (let pass = 0; pass < 4; pass++) {
    const peel = [];
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] <= SOLID || !glare(i)) continue;
      const x = i % w, y = (i - x) / w;
      let open = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || data[(ny * w + nx) * 4 + 3] <= SOLID) open++; }
      if (open) peel.push(i);
    }
    for (const i of peel) data[i * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { readFile, writeFile } = await import('node:fs/promises');
  for (const file of process.argv.slice(2)) await writeFile(file.replace(/\.png$/, '.clean.png'), await stripEffects(await readFile(file)));
}
