// Downloads the PixelLab mob clips listed in jobs.json and writes their sheets and clips.json.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const ROOT = 'art/animations/mobs/normal-elite/pixellab', { enemies } = JSON.parse(await readFile('src/data/slice.json', 'utf8'));
const MOVE_FRAME_MS = 90, COLUMNS = 6;
const range = count => Array.from({ length: count }, (_, i) => i);
const exists = file => access(file).then(() => true, () => false);

async function download(job, count, dir) {
  await mkdir(dir, { recursive: true });
  const files = range(count).map(i => `${dir}/${String(i).padStart(3, '0')}.png`);
  for (const [i, file] of files.entries()) {
    if (await exists(file)) continue;
    const response = await fetch(`https://api.pixellab.ai/mcp/images/${job}/download?index=${i}`);
    if (!response.ok) throw Error(`${job} frame ${i}: ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return files;
}
async function writeSheet(files, size, output) {
  const rows = Math.ceil(files.length / COLUMNS);
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(files.map((input, i) => ({ input, left: i % COLUMNS * size, top: Math.floor(i / COLUMNS) * size }))).png().toFile(output);
  return rows;
}
/** The attack clip plays over tell + recovery, so its frames must add up to exactly that. */
const stretch = (count, totalMs) => range(count).map(i => Math.round(totalMs * (i + 1) / count) - Math.round(totalMs * i / count));
/** Feet stay in one place across clips, measured on the standing frame. */
async function feet(file, size) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bottom = -1, sum = 0, count = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 30) bottom = y;
  for (let y = Math.max(0, bottom - 10); y <= bottom; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 30) { sum += x; count++; }
  return [sum / count / size, bottom / size];
}

const jobs = JSON.parse(await readFile(`${ROOT}/jobs.json`, 'utf8')), clips = [];
for (const [enemy, { size, scale, ...actions }] of Object.entries(jobs)) {
  const durations = { move: null, attack: Math.round((enemies[enemy].tell + enemies[enemy].recovery) * 1000) };
  for (const [action, directions] of Object.entries(actions)) for (const [direction, { job, frames }] of Object.entries(directions)) {
    const dir = `${ROOT}/clips/${enemy}-${action}-${direction}`, files = await download(job, frames, `${dir}/frames`), rows = await writeSheet(files, size, `${dir}/sheet.png`);
    const frameDurationsMs = durations[action] ? stretch(frames, durations[action]) : Array(frames).fill(MOVE_FRAME_MS), durationMs = frameDurationsMs.reduce((a, b) => a + b);
    const anchor = await feet(files[0], size);
    const base = { enemy, direction, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, rows, anchor, scale };
    clips.push({ ...base, action, image: `clips/${enemy}-${action}-${direction}/sheet.png`, frameCount: frames, frameDurationsMs, durationMs, loop: action === 'move', attackEvents: action === 'attack' ? [{ timeMs: Math.round(enemies[enemy].tell * 1000) }] : [] });
    if (action === 'move') clips.push({ ...base, action: 'idle', columns: 1, rows: 1, image: `rotations/${enemy}/${direction}.png`, frameCount: 1, frameDurationsMs: [0], durationMs: 0, loop: false, attackEvents: [] });
  }
}
await writeFile(`${ROOT}/clips.json`, `${JSON.stringify({ schemaVersion: 1, producer: 'pixellab', clips }, null, 2)}\n`);
console.log(JSON.stringify({ clips: clips.length }));
