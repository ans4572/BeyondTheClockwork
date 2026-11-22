// Chapter 3 (Clock Tower) bosses from PixelLab into art/animations/mobs/clock-tower/game-clips.json.
// Reads art/chapters/3-clock-tower/bosses/*/pixellab/characters.json ({ "<sprite>": { "id", "actions", "drop", "twin" } }),
// downloads each character's zip (8 rotations and its animations, 8 directions each), packs every clip into a six-column
// sheet with a lossless WebP beside it, measures feet and body height, and writes the clip list. Attack and cast frames
// lose the sparks PixelLab paints round the figure (strip-effects.mjs); frames named in `drop` are left out.
// A `twin` entry ({ "name": "tock" }) writes the same clips a second time with the crimson turned blue (Tock is Tick's
// every frame recoloured, so the twins match exactly; skin and cheeks are left alone), and a `gray` entry ({ "name":
// "ttgray" }) a third time with the crimson turned steel grey: the two twins look alike while they shuffle.
// Usage: node scripts/import-ch3-bosses.mjs [sprite ...]   (FRESH=1 downloads the zip again)
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { stripEffects } from './strip-effects.mjs';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const CHARACTERS = ['art/chapters/3-clock-tower/bosses/ticktock/pixellab/characters.json'];
const ROOT = 'art/animations/mobs/clock-tower', GAME = `${ROOT}/game-clips.json`, CACHE = path.join(os.tmpdir(), 'btc-ch3-bosses');
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// PixelLab's folder for each game action: the thrust is the boss's plain 'attack', the sweep its own pose.
const SOURCES = { idle: 'idle', move: 'move', attack: 'attack-thrust', sweep: 'attack-sweep', cast: 'cast' };
const LOOPS = new Set(['idle', 'move']), CLEANED = new Set(['attack', 'sweep', 'cast']);
const FRAME_MS = { idle: 110, move: 90 }, COLUMNS = 6;
/** How big the twins are drawn: 1.3 makes the body about 135 px, near the other bosses (Iris 137, Brass 129). */
const SCALE = 1.3;
const exists = file => access(file).then(() => true, () => false);

async function unpack(name, id) {
  const dir = path.join(CACHE, name), zip = path.join(CACHE, `${name}.zip`);
  await mkdir(dir, { recursive: true });
  if (!(await exists(zip)) || process.env.FRESH) {
    const response = await fetch(`https://api.pixellab.ai/mcp/characters/${id}/download`);
    if (!response.ok) throw Error(`${name}: download ${response.status}`);
    await writeFile(zip, Buffer.from(await response.arrayBuffer()));
  }
  // Windows' own tar (bsdtar) reads C: paths; Git Bash's GNU tar takes the colon for a remote host.
  execFileSync(process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar', ['-xf', zip, '-C', dir]);
  return dir;
}

const hsv = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h / 6) % 1 + 1) % 1, max ? d / max : 0, max];
};
const rgb = (h, s, v) => {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
};
/**
 * Tick's crimson turned to Tock's blue: hue 335-13 degrees, saturation over 0.55, value over 0.25, never within 2 px of
 * skin (r > 190, 130 < g < 215, 100 < b < 190, r > g > b), so the cheeks keep their blush. The rule the twins sheet used.
 */
const tockOf = input => recolour(input, (hu, s, v) => [((0.6 + (hu > 0.5 ? hu - 1 : hu) * 0.5) % 1 + 1) % 1, Math.min(1, s * 0.95), v * 0.95]);
const grayOf = input => recolour(input, (hu, s, v) => [0.6, 0.08, Math.min(1, v * 0.95 + 0.05)]);
/** Every crimson pixel (see above) given the hue, saturation and value `paint` returns for it. */
async function recolour(input, paint) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), { width: w, height: h } = info;
  const skin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const [r, g, b, a] = data.subarray(i * 4, i * 4 + 4); if (a && r > 190 && g > 130 && g < 215 && b > 100 && b < 190 && r > g && g > b) skin[i] = 1; }
  const nearSkin = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && skin[ny * w + nx]) return true; } return false; };
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!data[i + 3]) continue;
    const [hu, s, v] = hsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (!((hu > 0.93 || hu < 0.035) && s > 0.55 && v > 0.25) || nearSkin(x, y)) continue;
    const [r, g, b] = rgb(...paint(hu, s, v));
    out[i] = Math.round(r * 255); out[i + 1] = Math.round(g * 255); out[i + 2] = Math.round(b * 255);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function sheet(buffers, output) {
  const sizes = await Promise.all(buffers.map(f => sharp(f).metadata())), size = Math.max(...sizes.map(s => Math.max(s.width, s.height))), rows = Math.ceil(buffers.length / COLUMNS);
  const layers = buffers.map((input, i) => ({ input, left: i % COLUMNS * size + Math.floor((size - sizes[i].width) / 2), top: Math.floor(i / COLUMNS) * size + (size - sizes[i].height) }));
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile(output);
  await sharp(output).webp({ lossless: true, effort: 6 }).toFile(output.replace(/\.png$/, '.webp'));
  return size;
}
async function measure(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 30;
  let top = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { if (top < 0) top = y; bottom = y; }
  let sum = 0, count = 0;
  for (let y = Math.max(0, bottom - 10); y <= bottom; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { sum += x; count++; }
  return { anchor: [Math.round(sum / count), bottom], bodyHeight: bottom - top };
}
/** A one-shot clip: the first half of its frames before the strike, the rest after. */
function timing(count, durationMs, strikeMs) {
  const before = Math.max(1, Math.round(count / 2)), split = (n, ms) => Array.from({ length: n }, (_, i) => Math.round(ms * (i + 1) / n) - Math.round(ms * i / n));
  return [...split(before, strikeMs), ...split(count - before, durationMs - strikeMs)];
}
const framesIn = async dir => (await readdir(dir)).filter(f => f.endsWith('.png')).sort().map(f => path.join(dir, f));

const sprites = Object.assign({}, ...await Promise.all(CHARACTERS.map(async file => (await exists(file)) ? JSON.parse(await readFile(file, 'utf8')) : {}))), only = process.argv.slice(2);
const game = (await exists(GAME)) ? JSON.parse(await readFile(GAME, 'utf8')) : { schemaVersion: 1, character: 'mobs', directions: DIRECTIONS, actions: [], clips: {} };
for (const [name, entry] of Object.entries(sprites)) {
  if (name.startsWith('_') || (only.length && !only.includes(name))) continue;
  const { id, drop = {}, timings = {}, twin, gray } = entry, dir = await unpack(name, id), base = path.join(dir, 'Idle');
  const looks = [{ look: name, paint: buffer => buffer }, ...(twin ? [{ look: twin.name, paint: tockOf }] : []), ...(gray ? [{ look: gray.name, paint: grayOf, actions: gray.actions }] : [])];
  for (const { look } of looks) for (const key of Object.keys(game.clips)) if (key.startsWith(`${look}-`)) delete game.clips[key];
  for (const [action, folder] of Object.entries(SOURCES)) {
    for (const direction of DIRECTIONS) {
      const source = path.join(base, 'animations', folder, direction);
      if (!(await exists(source))) { console.warn(`${name} ${action} ${direction}: missing`); continue; }
      const files = (await framesIn(source)).filter((_, i) => !(drop[action]?.[direction] || []).includes(i));
      const raw = await Promise.all(files.map(file => readFile(file)));
      const clean = CLEANED.has(action) ? await Promise.all(raw.map(stripEffects)) : raw;
      for (const { look, paint, actions } of looks) {
        if (actions && !actions.includes(action)) continue;
        const frames = await Promise.all(clean.map(paint)), out = `${ROOT}/clips/${look}-${action}-${direction}/sheet.png`;
        const size = await sheet(frames, out), own = timings[action] || {};
        const durations = LOOPS.has(action) ? Array(frames.length).fill(FRAME_MS[action]) : timing(frames.length, own.durationMs || 1100, own.strikeMs || 550);
        const clip = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: frames.length, frameDurationsMs: durations, durationMs: durations.reduce((a, b) => a + b, 0), loop: LOOPS.has(action), scale: SCALE };
        if (!LOOPS.has(action)) clip.lastEventMs = own.strikeMs || 550;
        game.clips[`${look}-${action}/${direction}`] = { ...clip, ...await measure(frames[0]) };
      }
    }
  }
  for (const { look, actions } of looks) for (const action of actions || Object.keys(SOURCES)) if (!game.actions.includes(`${look}-${action}`)) game.actions.push(`${look}-${action}`);
  console.log(name, 'done');
}
await writeFile(GAME, `${JSON.stringify(game, null, 2)}\n`);
console.log(JSON.stringify({ clips: Object.keys(game.clips).length }));
