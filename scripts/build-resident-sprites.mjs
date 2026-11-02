// Turns the PixelLab residents listed in art/animations/npc/pixellab/residents.json into game sheets.
// Designs are downloaded once into raw/; recolors repaint a design's clothes, so they cost no generations.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const deps = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const sharp = require(path.join(deps, 'sharp')), JSZip = require(path.join(deps, 'jszip'));
const root = 'art/animations/npc/pixellab', config = JSON.parse(await readFile(`${root}/residents.json`, 'utf8'));
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'], SIZE = 96, WALK_FRAMES = 8;

async function zipOf({ id, characterId }) {
  const file = `${root}/raw/${id}.zip`;
  if (!existsSync(file)) {
    const response = await fetch(`https://api.pixellab.ai/mcp/characters/${characterId}/download`);
    if (!response.ok) throw Error(`${id}: download ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return JSZip.loadAsync(await readFile(file));
}

const raw = buffer => sharp(buffer).ensureAlpha().raw().toBuffer();
const sizeOf = async file => (await sharp(await file.async('nodebuffer')).metadata()).width;
async function frames(zip, id, direction) {
  const idle = zip.file(`Idle/rotations/${direction}.png`), walk = zip.file(new RegExp(`^Idle/animations/[^/]+/${direction}/frame_\\d+\\.png$`)).sort((a, b) => a.name.localeCompare(b.name));
  if (!idle || walk.length !== WALK_FRAMES) throw Error(`${id}/${direction}: idle ${!!idle}, walk ${walk.length}`);
  return { idle: [await raw(await idle.async('nodebuffer'))], walk: await Promise.all(walk.map(async file => raw(await file.async('nodebuffer')))) };
}

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max / 255];
}
function rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return [r, g, b].map(value => Math.round((value + m) * 255));
}
const within = (hue, [from, to]) => (from <= to ? hue >= from && hue <= to : hue >= from || hue <= to);

/** Rotates the hue of clothes only: `swaps` name hue bands, and `keepRows` protects pink cheeks and boots. */
function recolor(frame, { swaps, keepRows = [] }) {
  const out = Buffer.from(frame);
  for (let i = 0; i < out.length; i += 4) {
    const row = Math.floor(i / 4 / SIZE);
    if (!out[i + 3] || keepRows.some(([from, to]) => row >= from && row <= to)) continue;
    const [h, s, v] = hsv(out[i], out[i + 1], out[i + 2]);
    const swap = v >= 0.18 && swaps.find(item => s >= (item.minSat ?? 0.12) && within(h, item.hues));
    if (swap) [out[i], out[i + 1], out[i + 2]] = rgb((h + swap.by + 360) % 360, Math.min(1, s * (swap.sat ?? 1)), Math.min(1, v * (swap.val ?? 1)));
  }
  return out;
}

async function writeSheet(file, list, size = SIZE) {
  const columns = list.length, data = Buffer.alloc(size * columns * size * 4);
  list.forEach((frame, f) => { for (let y = 0; y < size; y++) frame.copy(data, (y * size * columns + f * size) * 4, y * size * 4, (y + 1) * size * 4); });
  await sharp(data, { raw: { width: size * columns, height: size, channels: 4 } }).png().toFile(`${root}/${file}`);
}

await mkdir(`${root}/raw`, { recursive: true }); await mkdir(`${root}/sheets`, { recursive: true });
const decoded = new Map(), clips = [];
for (const design of config.designs) decoded.set(design.id, { zip: await zipOf(design), directions: {} });
for (const resident of [...config.designs, ...config.recolors]) {
  const source = decoded.get(resident.of || resident.id);
  for (const direction of DIRECTIONS) {
    source.directions[direction] ??= await frames(source.zip, resident.of || resident.id, direction);
    for (const action of ['idle', 'walk']) {
      const drawn = source.directions[direction][action], list = resident.swaps ? drawn.map(frame => recolor(frame, resident)) : drawn, image = `sheets/${resident.id}-${action}-${direction}.png`;
      await writeSheet(image, list);
      const dt = action === 'walk' ? config.walkFrameDurationMs : 0;
      clips.push({ character: resident.id, name: resident.name, ...(resident.of ? { recolorOf: resident.of } : {}), provider: 'pixellab', action, direction, image, frameWidth: SIZE, frameHeight: SIZE, frameCount: list.length, columns: list.length, rows: 1, frameDurationMs: dt, durationMs: dt * list.length, loop: action === 'walk' });
    }
  }
  console.log(resident.id, resident.of ? `recolor of ${resident.of}` : 'design');
}
// Standing NPCs only move in the direction they face; the other seven are still rotations.
for (const npc of config.standing) {
  const zip = await zipOf(npc), folder = name => zip.file(new RegExp(`^Idle/animations/${name}/${npc.facing}/frame_\\d+\\.png$`)).sort((a, b) => a.name.localeCompare(b.name));
  const entry = (action, direction, image, frameCount, size, dt, loop) => clips.push({ character: npc.id, name: npc.name, provider: 'pixellab', action, direction, image, frameWidth: size, frameHeight: size, frameCount, columns: frameCount, rows: 1, frameDurationMs: dt, durationMs: dt * frameCount, loop });
  for (const direction of DIRECTIONS) {
    const image = `sheets/${npc.id}-idle-${direction}.png`;
    if (direction === npc.facing) {
      const files = folder(npc.idle);
      await writeSheet(image, await Promise.all(files.map(async file => raw(await file.async('nodebuffer')))));
      entry('idle', direction, image, files.length, SIZE, config.idleFrameDurationMs, true);
    } else {
      await writeSheet(image, [await raw(await zip.file(`Idle/rotations/${direction}.png`).async('nodebuffer'))]);
      entry('idle', direction, image, 1, SIZE, 0, false);
    }
  }
  if (npc.greeting) {
    const files = folder(npc.greeting), size = await sizeOf(files[0]), image = `sheets/${npc.id}-greeting.png`;
    await writeSheet(image, await Promise.all(files.map(async file => raw(await file.async('nodebuffer')))), size);
    for (const direction of DIRECTIONS) entry('greeting', direction, image, files.length, size, config.greetingFrameDurationMs, false);
  }
  console.log(npc.id, 'standing');
}
await writeFile(`${root}/clips.json`, JSON.stringify({ schemaVersion: 1, producer: 'pixellab_pro_flash', residents: [...new Set(clips.map(clip => clip.character))], clips }, null, 2) + '\n');

// Review sheet: every resident, facing south-east and south.
const rows = [...config.designs, ...config.recolors], composites = [];
for (const [i, resident] of rows.entries()) composites.push({ input: await sharp(`${root}/sheets/${resident.id}-idle-south.png`).resize({ width: SIZE * 2, kernel: 'nearest' }).png().toBuffer(), left: (i % 6) * SIZE * 2, top: Math.floor(i / 6) * SIZE * 2 });
await sharp({ create: { width: SIZE * 12, height: Math.ceil(rows.length / 6) * SIZE * 2, channels: 4, background: '#efe4cd' } }).composite(composites).png().toFile(`${root}/residents-preview.png`);
console.log(`Wrote ${clips.length} clips for ${rows.length} residents and ${config.standing.length} standing NPCs.`);
