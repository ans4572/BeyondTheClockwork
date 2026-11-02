// Downloads the PixelLab clips listed in jobs.json and builds the body sheets and ground effect sheets of the second skills.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const ROOT = 'art/animations/player/skills/basic/pixellab-second';
const BODY_SIZE = 192, BODY_COLUMNS = 4, EFFECT_SIZE = 256, EFFECT_COLUMNS = 6, FEET_ROWS = 12;
// Same beat as the first skills, so every cast reads at one speed.
const BODY_DURATIONS_MS = [40, 40, 50, 40, 40, 40, 50, 40, 40, 40, 50, 40, 40, 40, 50, 40, 40];
const FADE = [0.34, 0.67];
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const repeat = (list, times) => Array.from({ length: times }, () => list).flat();
/** How each effect is cut from its clip. Lengths follow the skill's hits, so a burst lands on every hit. */
const EFFECT_PLANS = {
  exhaustBurst: { frames: range(0, 7), playback: repeat(range(0, 7), 3), durationMs: 750, releaseMs: 0, scale: 1.05, ground: true, foot: 'centre' },
  coolingField: { frames: range(0, 15), fadeFrom: 0, fadeTo: 7, playback: [16, 17, ...range(0, 15), ...range(0, 7), 18, 19], durationMs: 2500, releaseMs: 0, scale: 1.18, ground: true, foot: 'centre' },
  capacitorStrike: { frames: range(0, 8), playback: repeat(range(0, 8), 3), durationMs: 1050, releaseMs: 500, scale: 1, ground: false, foot: 'base' },
  vortexIntake: { frames: range(0, 15), fadeFrom: 0, fadeTo: 15, playback: [16, 17, ...range(0, 15), 18, 19], durationMs: 1500, releaseMs: 0, scale: 1.4, ground: false, foot: 'base' }
};

const exists = file => access(file).then(() => true, () => false);
async function download(job, frames, dir) {
  await mkdir(dir, { recursive: true });
  const files = range(0, frames - 1).map(i => `${dir}/${String(i).padStart(3, '0')}.png`);
  for (const [i, file] of files.entries()) {
    if (await exists(file)) continue;
    const response = await fetch(`https://api.pixellab.ai/mcp/images/${job}/download?index=${i}`);
    if (!response.ok) throw Error(`${job} frame ${i}: ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return files;
}
async function sheet(inputs, size, columns, output) {
  const rows = Math.ceil(inputs.length / columns);
  await sharp({ create: { width: size * columns, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(inputs.map((input, i) => ({ input, left: i % columns * size, top: Math.floor(i / columns) * size }))).png().toFile(output);
  return rows;
}
const raw = file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
/** Opaque bounds of a frame, and the middle of its lowest rows. */
async function measure(file) {
  const { data, info: { width, height } } = await raw(file);
  let top = height, bottom = -1, left = width, right = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 30) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  let sum = 0, count = 0;
  for (let y = Math.max(0, bottom - FEET_ROWS + 1); y <= bottom; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 30) { sum += x; count++; }
  return { top, bottom, left, right, footX: Math.round(sum / count) };
}
async function faded(file, opacity) {
  const { data, info } = await raw(file);
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  return sharp(data, { raw: info }).png().toBuffer();
}

const jobs = JSON.parse(await readFile(`${ROOT}/jobs.json`, 'utf8'));
const clips = [];
for (const [action, directions] of Object.entries(jobs.bodies)) for (const [direction, job] of Object.entries(directions)) {
  const dir = `${ROOT}/clips/${action}-${direction}`, files = await download(job, BODY_DURATIONS_MS.length, `${dir}/frames`);
  const rows = await sheet(files, BODY_SIZE, BODY_COLUMNS, `${dir}/sheet.png`), feet = await measure(files[0]);
  clips.push({ action, direction, provider: 'pixellab', model: 'pixminimax', jobId: job, frameWidth: BODY_SIZE, frameHeight: BODY_SIZE, columns: BODY_COLUMNS, rows, frameCount: files.length, frameDurationsMs: BODY_DURATIONS_MS, durationMs: BODY_DURATIONS_MS.reduce((a, b) => a + b), anchor: [feet.footX / BODY_SIZE, feet.bottom / BODY_SIZE], sheet: `clips/${action}-${direction}/sheet.png` });
}
await writeFile(`${ROOT}/manifest.json`, `${JSON.stringify({ schemaVersion: 1, producer: 'pixellab', actions: Object.keys(jobs.bodies), clips }, null, 2)}\n`);

const effects = {};
for (const [id, { job, frames, concept }] of Object.entries(jobs.effects)) {
  const plan = EFFECT_PLANS[id], dir = `${ROOT}/effects/${id}`, files = await download(job, frames, `${dir}/frames`), picked = plan.frames.map(i => files[i]);
  const conceptFile = `${dir}/concept.png`;
  if (!(await exists(conceptFile))) await writeFile(conceptFile, Buffer.from(await (await fetch(concept)).arrayBuffer()));
  const inputs = [...picked];
  if (plan.fadeFrom !== undefined) inputs.push(await faded(picked[plan.fadeFrom], FADE[0]), await faded(picked[plan.fadeFrom], FADE[1]), await faded(picked[plan.fadeTo], FADE[1]), await faded(picked[plan.fadeTo], FADE[0]));
  await sheet(inputs, EFFECT_SIZE, EFFECT_COLUMNS, `${dir}/sheet.png`);
  const box = await measure(files[0]), anchor = plan.foot === 'centre' ? [Math.round((box.left + box.right) / 2), Math.round((box.top + box.bottom) / 2)] : [box.footX, box.bottom - 8];
  effects[id] = { sheet: `/${dir}/sheet.png`, frameWidth: EFFECT_SIZE, frameHeight: EFFECT_SIZE, columns: EFFECT_COLUMNS, playback: plan.playback, durationMs: plan.durationMs, releaseMs: plan.releaseMs, anchor, placement: 'cast', scale: plan.scale, ground: plan.ground };
}
await writeFile(`${ROOT}/effects.json`, `${JSON.stringify(effects, null, 2)}\n`);
console.log(JSON.stringify({ clips: clips.length, effects: Object.keys(effects) }));
