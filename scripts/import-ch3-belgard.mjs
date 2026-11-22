// Belgard (chapter 3 region boss) from PixelLab into art/animations/mobs/clock-tower/game-clips.json, beside Tick·Tock
// and the chapter's mobs. Reads art/chapters/3-clock-tower/bosses/belgard/pixellab/characters.json, downloads the
// character's zip (8 rotations and 7 clips x 8 directions, 2026-11-16), and packs every clip into a six-column sheet.
//
// The effects PixelLab painted into the blows came out different in every direction (bursts of white, yellow or orange,
// slash arcs of cream, sky blue or orange, dust, floor cracks, a blade turned gold; review/effects-list.md), so they are
// all taken out here and the game draws one look of its own (2026-11-16, the user's choice 1):
//   1. colours that none of that direction's standing frames (rotation + idle) use and that look like an effect (near
//      white, hot yellow, orange-red, sky blue, cream) go where they form a patch (bursts, arcs), and near the ground at
//      any size (sparks at the blade's tip);
//   2. near the ground, effect-like colours, cracks and pebbles go whatever their colour, but never on a thick part of
//      the picture (the blade, the boots), so a planted or slammed blade keeps its edge and its highlights;
//   3. whatever is left that is not joined to the body goes too (strip-effects.mjs: sparks, dust, pebbles);
//   4. frames where the effect covers the blade or is joined to it in its own colours (slash arcs, the gold blade, the
//      slam burst that hid the south blade) are left out by number (`drop`).
// What is left: a few pixels of crack or pebble touching the blade's tip at the moment it lands, under the game's own
// impact effect.
// Usage: node scripts/import-ch3-belgard.mjs   (FRESH=1 downloads the zip again)
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { stripEffects } from './strip-effects.mjs';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const RECORD = 'art/chapters/3-clock-tower/bosses/belgard/pixellab/characters.json';
const ROOT = 'art/animations/mobs/clock-tower', GAME = `${ROOT}/game-clips.json`, CACHE = path.join(os.tmpdir(), 'btc-ch3-belgard');
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// PixelLab's clip name for each game action.
const SOURCES = { idle: 'idle', move: 'move', slam: 'attack-slam', swing: 'attack-swing', plant: 'plant', grab: 'grab', command: 'command' };
const LOOPS = new Set(['idle', 'move']), CLEANED = new Set(['slam', 'swing', 'plant', 'grab', 'command']);
const FRAME_MS = { idle: 120, move: 100 }, COLUMNS = 6;
/** One-shot clips: how long, and when the blow lands (ms from the start). */
const TIMINGS = { slam: [1300, 750], swing: [1000, 450], plant: [1200, 650], grab: [1000, 500], command: [1100, 500] };
/** About 160 px tall on the screen with his sword, a head over Tick·Tock (1.3 on a 128 px body). */
const SCALE = 1.3;
const exists = file => access(file).then(() => true, () => false);

async function unpack(id) {
  const zip = path.join(CACHE, 'belgard.zip');
  await mkdir(CACHE, { recursive: true });
  if (!(await exists(zip)) || process.env.FRESH) {
    const response = await fetch(`https://api.pixellab.ai/mcp/characters/${id}/download`);
    if (!response.ok) throw Error(`belgard: download ${response.status}`);
    await writeFile(zip, Buffer.from(await response.arrayBuffer()));
  }
  execFileSync(process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar', ['-xf', zip, '-C', CACHE]);
  return path.join(CACHE, 'Idle');
}
const framesIn = async dir => (await readdir(dir)).filter(f => f.endsWith('.png')).sort().map(f => path.join(dir, f));
const raw = input => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function hsv(r, g, b) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0;
  if (d) h = max === r / 255 ? ((g - b) / 255 / d) % 6 : max === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
}
/** True for the colours PixelLab's effects use and the body does not (see the comment at the top). */
function effectLike(r, g, b) {
  const [h, s, v] = hsv(r, g, b);
  return (v > 0.9 && s < 0.2) || (s > 0.35 && v > 0.75 && h >= 40 && h <= 70) || (s > 0.3 && v > 0.6 && h >= 170 && h <= 230)
    || (s > 0.45 && v > 0.6 && (h < 35 || h > 340)) || (s < 0.35 && v > 0.75 && h >= 20 && h <= 60) || v < 0.16;
}
async function palette(files) {
  const colours = new Set();
  for (const file of files) { const { data } = await raw(file); for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 30) colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]); }
  return colours;
}
/**
 * `stand` is the standing pose's feet: the ground row and the columns the boots cover there.
 *  - Anywhere, a colour the standing frames never use that looks like an effect goes, but only in a patch of at least
 *    PATCH pixels of such colours (a burst, an arc, sparks): a few lone pixels are the blade's own new highlights.
 *  - Near the ground (GROUND_ROWS above the feet and below) bursts, pebbles and floor cracks use the
 *    body's colours too, so there effect-like colours (and, for the planted sword, dark dull greys: cracks) go whatever
 *    they are, but never on a THICK part of the picture: the blade is a solid band many pixels wide, a crack or a pebble
 *    is a thin line or a crumb. Thick = what survives shrinking the shape by THIN pixels, grown back by THIN + 1.
 * (2026-11-16: the first rules took the planted blade's lower half and the slammed blade's highlights with them.)
 */
const GROUND_ROWS = 18, PATCH = 12, THIN = 2;
function grow(mask, w, h, r, keep) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let all = true, any = false;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy, on = nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx];
      if (on) any = true; else all = false;
    }
    out[y * w + x] = keep === 'all' ? (all ? 1 : 0) : (any ? 1 : 0);
  }
  return out;
}
async function clean(file, body, stand, cracks) {
  const { data, info } = await raw(file), w = info.width, h = info.height, n = w * h;
  const solid = new Uint8Array(n), odd = new Uint8Array(n), ground = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4; if (data[i + 3] <= 30) continue;
    solid[p] = 1;
    const x = p % w, y = (p - x) / w, c = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    if (!body.has(c) && effectLike(data[i], data[i + 1], data[i + 2])) odd[p] = 1;
    // The boots are thick too, so the thick rule below keeps them; no column is spared near the ground.
    if (y >= stand.ground - GROUND_ROWS) ground[p] = 1;
  }
  // Patches of odd colours, 8-connected; only the big ones are effects.
  const seen = new Uint8Array(n), kill = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!odd[p] || seen[p]) continue;
    const stack = [p], patch = []; seen[p] = 1;
    while (stack.length) {
      const q = stack.pop(); patch.push(q);
      const x = q % w, y = (q - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, m = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && odd[m] && !seen[m]) { seen[m] = 1; stack.push(m); }
      }
    }
    if (patch.length >= PATCH) for (const q of patch) kill[q] = 1;
  }
  const thick = grow(grow(solid, w, h, THIN, 'all'), w, h, THIN + 1, 'any');
  for (let p = 0; p < n; p++) {
    if (!solid[p]) continue;
    const i = p * 4, [, s, v] = hsv(data[i], data[i + 1], data[i + 2]);
    // For the planted sword also dark dull greys (cracks) and light dull greys (pebbles, dust).
    const loose = ground[p] && !thick[p] && (effectLike(data[i], data[i + 1], data[i + 2]) || (cracks && s < 0.5 && (v < 0.36 || (s < 0.22 && v > 0.6))));
    // On the ground a colour the standing frames never use is an effect at any size (sparks at the blade's tip).
    if (kill[p] || loose || (ground[p] && odd[p])) data[i + 3] = 0;
  }
  return stripEffects(await sharp(data, { raw: info }).png().toBuffer());
}
/** The standing pose's lowest row and the runs of columns solid in its bottom few rows (the boots). */
async function feet(file) {
  const { data, info } = await raw(file), solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 30;
  let ground = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) ground = y;
  const cols = []; for (let x = 0; x < info.width; x++) { let on = false; for (let y = ground - 8; y <= ground; y++) if (solid(x, y)) on = true; cols.push(on); }
  const boots = []; let start = -1;
  cols.forEach((on, x) => { if (on && start < 0) start = x; if (!on && start >= 0) { boots.push([start, x - 1]); start = -1; } });
  if (start >= 0) boots.push([start, cols.length - 1]);
  return { ground, boots };
}
async function sheet(buffers, output) {
  const sizes = await Promise.all(buffers.map(b => sharp(b).metadata())), size = Math.max(...sizes.map(s => Math.max(s.width, s.height))), rows = Math.ceil(buffers.length / COLUMNS);
  const layers = buffers.map((input, i) => ({ input, left: i % COLUMNS * size + Math.floor((size - sizes[i].width) / 2), top: Math.floor(i / COLUMNS) * size + (size - sizes[i].height) }));
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile(output);
  await sharp(output).webp({ lossless: true, effort: 6 }).toFile(output.replace(/\.png$/, '.webp'));
  return size;
}
async function measure(input) {
  const { data, info } = await raw(input), solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 30;
  let top = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { if (top < 0) top = y; bottom = y; }
  let sum = 0, count = 0;
  for (let y = Math.max(0, bottom - 10); y <= bottom; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { sum += x; count++; }
  return { anchor: [Math.round(sum / count), bottom], bodyHeight: bottom - top };
}
function timing(count, durationMs, strikeMs) {
  const before = Math.max(1, Math.round(count / 2)), split = (n, ms) => Array.from({ length: n }, (_, i) => Math.round(ms * (i + 1) / n) - Math.round(ms * i / n));
  return [...split(before, strikeMs), ...split(count - before, durationMs - strikeMs)];
}

const record = JSON.parse(await readFile(RECORD, 'utf8')).belgard, drop = record.drop || {};
const base = await unpack(record.id), game = JSON.parse(await readFile(GAME, 'utf8'));
for (const key of Object.keys(game.clips)) if (key.startsWith('belgard-')) delete game.clips[key];
game.actions = game.actions.filter(a => !a.startsWith('belgard-'));
for (const direction of DIRECTIONS) {
  const standing = [path.join(base, 'rotations', `${direction}.png`), ...await framesIn(path.join(base, 'animations', 'idle', direction))];
  const body = await palette(standing), stand = await feet(standing[1]);
  for (const [action, folder] of Object.entries(SOURCES)) {
    const source = path.join(base, 'animations', folder, direction);
    if (!(await exists(source))) { console.warn(`belgard ${action} ${direction}: missing`); continue; }
    const files = (await framesIn(source)).filter((_, i) => !(drop[action]?.[direction] || []).includes(i));
    const frames = CLEANED.has(action) ? await Promise.all(files.map(f => clean(f, body, stand, action === 'plant'))) : await Promise.all(files.map(f => readFile(f)));
    const out = `${ROOT}/clips/belgard-${action}-${direction}/sheet.png`, size = await sheet(frames, out);
    const [durationMs, strikeMs] = TIMINGS[action] || [];
    const durations = LOOPS.has(action) ? Array(frames.length).fill(FRAME_MS[action]) : timing(frames.length, durationMs, strikeMs);
    const clip = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: frames.length, frameDurationsMs: durations, durationMs: durations.reduce((a, b) => a + b, 0), loop: LOOPS.has(action), scale: SCALE };
    if (!LOOPS.has(action)) clip.lastEventMs = strikeMs;
    game.clips[`belgard-${action}/${direction}`] = { ...clip, ...await measure(frames[0]) };
  }
}
// The barehanded state (PixelLab state 'Barehanded' of the same character, 2026-11-17): what he fights with while his
// sword flies (bell-boss.js bgFlySword). Its rotation stands for idle; the walk and the punch are template clips with
// no painted effects, so they go in as drawn. The zip names a clip by its display name.
const BARE_SOURCES = { move: ['bare-move', 'walking-8-frames'], attack: ['bare-punch', 'cross-punch'] }, BARE_TIMING = { attack: [800, 450] };
const bare = path.join(CACHE, 'Barehanded');
const bareDrop = JSON.parse(await readFile(RECORD, 'utf8')).barehanded?.drop || {};
if (await exists(bare)) for (const direction of DIRECTIONS) {
  const actions = { idle: [path.join(bare, 'rotations', `${direction}.png`)] };
  for (const [action, names] of Object.entries(BARE_SOURCES)) {
    for (const name of names) { const dir = path.join(bare, 'animations', name, direction); if (await exists(dir)) { actions[action] = await framesIn(dir); break; } }
    if (!actions[action]) console.warn(`belgard-bare ${action} ${direction}: missing`);
  }
  for (const [action, all] of Object.entries(actions)) {
    const files = all.filter((_, i) => !(bareDrop[action]?.[direction] || []).includes(i));
    const frames = await Promise.all(files.map(f => readFile(f))), loop = action !== 'attack';
    const out = `${ROOT}/clips/belgard-bare-${action}-${direction}/sheet.png`, size = await sheet(frames, out);
    const [durationMs, strikeMs] = BARE_TIMING[action] || [];
    const durations = loop ? Array(frames.length).fill(action === 'move' ? 110 : 120) : timing(frames.length, durationMs, strikeMs);
    const clip = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: frames.length, frameDurationsMs: durations, durationMs: durations.reduce((x, y) => x + y, 0), loop, scale: SCALE };
    if (!loop) clip.lastEventMs = strikeMs;
    game.clips[`belgard-bare-${action}/${direction}`] = { ...clip, ...await measure(frames[0]) };
  }
}
for (const action of Object.keys(SOURCES)) game.actions.push(`belgard-${action}`);
if (await exists(bare)) for (const action of ['idle', 'move', 'attack']) game.actions.push(`belgard-bare-${action}`);
await writeFile(GAME, `${JSON.stringify(game, null, 2)}\n`);
console.log(JSON.stringify({ clips: Object.keys(game.clips).filter(k => k.startsWith('belgard-')).length }));
