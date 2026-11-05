// Marks which pixels of a village picture are scenery rather than paving, as a one-bit mask.
// The renderer repaints those pixels from the picture itself over anyone standing behind them.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { pointInPolygon } from '../src/engine/map-geometry.js';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const { villages } = JSON.parse(await readFile('src/data/maps.json', 'utf8'));

async function buildForeground(village) {
  const input = `.${village.background}`, output = `.${village.mask}`, { hues, maxSaturation, minValue, shade } = village.floor;
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, perUnit = width / village.size[0];
  const isFloor = (i, walkable) => {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]], max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    // On the walkable floor shadows and painted tiles count too; plants stay out by hue.
    const limit = walkable ? shade : { maxSaturation, minValue };
    if (max / 255 < limit.minValue || (max ? delta / max : 0) > limit.maxSaturation) return false;
    if (!delta) return true;
    const hue = (max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
    return walkable ? hue < 70 || hue > 150 : hues.some(([from, to]) => hue >= from && hue <= to);
  };
  // Solid props keep their stone even where it matches the paving, and so do `scenery` outlines (parts of a prop that
  // stand over walkable floor, like a stall's roof); everything walkable seeds the fill.
  const floor = new Uint8Array(width * height), kept = new Uint8Array(width * height), inside = new Uint8Array(width * height), queue = [];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const ux = x / perUnit, uy = y / perUnit, solid = [...village.solids, ...(village.scenery || [])].some(polygon => pointInPolygon(ux, uy, polygon));
    if (solid) for (const p of [y * width + x, y * width + x + 1, (y + 1) * width + x, (y + 1) * width + x + 1]) kept[p] = 1;
    else if (pointInPolygon(ux, uy, village.walkable)) { queue.push(y * width + x); for (const p of [y * width + x, y * width + x + 1, (y + 1) * width + x, (y + 1) * width + x + 1]) inside[p] = 1; }
  }
  while (queue.length) {
    const p = queue.pop();
    if (floor[p] || kept[p] || !isFloor(p * 4, inside[p])) continue;
    floor[p] = 1;
    const x = p % width;
    if (x > 0) queue.push(p - 1);
    if (x < width - 1) queue.push(p + 1);
    if (p >= width) queue.push(p - width);
    if (p < width * (height - 1)) queue.push(p + width);
  }
  // Specks of scenery on open floor would flicker over bodies; pinholes in objects would let bodies show through.
  const blobs = (value, limit, isPaint = () => false) => {
    const seen = new Uint8Array(floor.length);
    for (let start = 0; start < floor.length; start++) {
      if (seen[start] || floor[start] !== value) continue;
      const blob = [start]; seen[start] = 1;
      for (let i = 0; i < blob.length; i++) {
        const p = blob[i], x = p % width;
        for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) if (n >= 0 && n < floor.length && !seen[n] && floor[n] === value) { seen[n] = 1; blob.push(n); }
      }
      if (blob.length < limit || isPaint(blob)) for (const p of blob) floor[p] = 1 - value;
    }
  };
  // Nothing can stand on the walkable floor, so scenery wholly inside it is painted on: flower tiles, wires.
  blobs(0, 900, blob => blob.every(p => inside[p] && !kept[p])); blobs(1, 160);
  let removed = 0;
  const mask = Buffer.alloc(floor.length);
  for (let p = 0; p < floor.length; p++) { if (floor[p]) removed++; else mask[p] = 255; }
  await sharp(mask, { raw: { width, height, channels: 1 } }).png({ palette: true, colours: 2, compressionLevel: 9 }).toFile(output);
  console.log(JSON.stringify({ output, removedPercent: Math.round(removed / floor.length * 100) }));
}

// `node scripts/build-village-foreground.mjs firstStepB candyYardB` rebuilds only those; no names rebuilds every mask.
const only = process.argv.slice(2);
for (const [name, village] of Object.entries(villages)) if (!only.length || only.includes(name)) await buildForeground(village);
