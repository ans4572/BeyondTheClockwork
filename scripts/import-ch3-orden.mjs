// Orden (chapter 3 final boss) from PixelLab into art/animations/mobs/clock-tower/game-clips.json, beside Belgard,
// Tick·Tock and the chapter's mobs. Two sprites, one per form (slice.json bossAI.orden.sprite / ordenFinal.sprite):
//   orden  = the masked form   (art/chapters/3-clock-tower/bosses/orden/pixellab/masked/)
//   ordenx = the awakened form, without the floating mask shard (.../pixellab/awakened-nomask/, since 2026-11-20 at the
//            user's word; awakened/ with the shard stays as the source). Its sheets are named sheet-nomask.png, so a
//            browser that kept the old ones fetches the new.
// Reads the folders already on disk (8 rotations and two pixminimax staff clips x 8 directions, 2026-11-17; no
// download) and packs every clip into a six-column sheet with a lossless WebP beside it.
//
// He floats and fights only with the staff (characters.json _note): the bob, glide, teleport, hurt and every spell are
// the game's own, so his clips are few:
//   idle, move = the rotation still, one frame per direction (the game bobs him);
//   cast       = staff-raise (big spells: circles, gear orbits; the raised frame is held as the warning pose);
//   point      = staff-jab (short spells: note bolts, light needles).
// Frames listed in characters.json `drop` (model-painted bursts, slash arcs, sparks) are left out, and what is left of
// the effects (sparks, glints round the staff's gem) goes with strip-effects.mjs: everything not joined to the body.
// For the awakened form, sparks joined to the body go by colour too (SPARKS). His floating mask shard stays where
// PixelLab drew it: in the rotations and the first frame or two of each clip, joined to his hair (strip-effects keeps
// it there), gone in the rest (characters.json _note), so it fades as a spell begins and is back when he stands.
//
// Every clip is placed on its direction's rotation: the clips' first frame is the rotation itself in a larger canvas
// (168-180 px), so the anchor is the rotation's (body's centre, lowest pixel) moved by that offset, and a body never
// jumps between standing and casting. The release frame of a spell is found per direction: the first frame whose
// reach (how far the picture sticks out past frame 0 up, left or right) is near its largest.
// Usage: node scripts/import-ch3-orden.mjs
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { stripEffects } from './strip-effects.mjs';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const SOURCE = 'art/chapters/3-clock-tower/bosses/orden/pixellab', RECORD = `${SOURCE}/characters.json`;
const ROOT = 'art/animations/mobs/clock-tower', GAME = `${ROOT}/game-clips.json`;
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
/** Game sprite name -> the form's folder and its entry in characters.json. */
const FORMS = { orden: 'masked', ordenx: 'awakened-nomask' };
/** The sheet file name inside each clip's folder. */
const SHEET = { orden: 'sheet', ordenx: 'sheet-nomask' };
/** PixelLab's clip for each one-shot action. */
const SOURCES = { cast: 'staff-raise', point: 'staff-jab' };
const FRAME_MS = 120, COLUMNS = 6;
/**
 * One-shot clips: how long, when the spell is released (ms from the start), and how many shares of the time after the
 * release the release frame itself holds (the raised staff stays up a moment, the thrust a little).
 */
const TIMINGS = { cast: [1300, 750, 2.5], point: [900, 400, 1.5] };
/**
 * About 162 px tall on the screen, as tall as Belgard (1.3 on his 124 px body incl. the sword): the masked body is 120 px
 * with the hat, the awakened one 124, so 1.35 (the awakened form stands a few pixels taller, which suits him).
 */
const SCALE = 1.35;

/**
 * Sparks painted onto the awakened form's coat and staff (thin hot-yellow or white strokes, joined to the body so
 * strip-effects.mjs keeps them). His clips reuse the rotation's colours almost exactly, so a hot-yellow or near-white
 * colour the direction's rotation never uses is a spark; it goes, and so does every other new colour touching it (the
 * orange ends of the same stroke). Not for the masked form: his clock dial, swung close to the camera, is drawn in new
 * whites and golds of its own.
 */
const SPARKS = new Set(['ordenx']);
function hsv(r, g, b) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0;
  if (d) h = max === r / 255 ? ((g - b) / 255 / d) % 6 : max === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
}
const sparkLike = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return (v > 0.9 && s < 0.2) || (s > 0.35 && v > 0.75 && h >= 40 && h <= 70); };
async function palette(input) {
  const { data } = await raw(input), colours = new Set();
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 30) colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  return colours;
}
async function unspark(input, colours) {
  const { data, info } = await raw(input), w = info.width, h = info.height, n = w * h;
  const fresh = p => data[p * 4 + 3] > 30 && !colours.has((data[p * 4] << 16) | (data[p * 4 + 1] << 8) | data[p * 4 + 2]);
  const kill = new Uint8Array(n), stack = [];
  for (let p = 0; p < n; p++) if (fresh(p) && sparkLike(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])) { kill[p] = 1; stack.push(p); }
  while (stack.length) {
    const q = stack.pop(), x = q % w, y = (q - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, m = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !kill[m] && fresh(m)) { kill[m] = 1; stack.push(m); }
    }
  }
  for (let p = 0; p < n; p++) if (kill[p]) data[p * 4 + 3] = 0;
  return stripEffects(await sharp(data, { raw: info }).png().toBuffer());
}
const framesIn = async dir => (await readdir(dir)).filter(f => f.endsWith('.png')).sort().map(f => path.join(dir, f));
const raw = input => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** The box round the solid pixels and the mean x of them (the body's centre), of a PNG buffer or file. */
async function box(input) {
  const { data, info } = await raw(input);
  let left = info.width, right = -1, top = info.height, bottom = -1, sum = 0, count = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] <= 30) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = y; sum += x; count++;
  }
  return { left, right, top, bottom, centre: sum / count, width: info.width, height: info.height };
}
async function sheet(buffers, output) {
  const sizes = await Promise.all(buffers.map(b => sharp(b).metadata())), size = Math.max(...sizes.map(s => Math.max(s.width, s.height))), rows = Math.ceil(buffers.length / COLUMNS);
  if (sizes.some(s => s.width !== size || s.height !== size)) throw Error(`${output}: frames of different sizes`);
  const layers = buffers.map((input, i) => ({ input, left: i % COLUMNS * size, top: Math.floor(i / COLUMNS) * size }));
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile(output);
  await sharp(output).webp({ lossless: true, effort: 6 }).toFile(output.replace(/\.png$/, '.webp'));
  return size;
}
/** The first frame whose reach past frame 0 is at least 90 % of the clip's largest (the middle frame if it hardly moves). */
async function releaseFrame(frames) {
  const boxes = await Promise.all(frames.map(box)), first = boxes[0];
  const reach = boxes.map(b => Math.max(first.top - b.top, first.left - b.left, b.right - first.right, 0)), most = Math.max(...reach);
  const at = most < 6 ? Math.floor(frames.length / 2) : reach.findIndex(r => r >= most * 0.9);
  return Math.min(Math.max(at, 1), frames.length - 1);
}
/** Frames before the release share `strikeMs`; the release frame holds `hold` shares of the rest, later frames one each. */
function timing(count, release, durationMs, strikeMs, hold) {
  const split = (weights, ms) => { const total = weights.reduce((a, b) => a + b, 0); let at = 0; return weights.map(w => { const from = Math.round(ms * at / total); at += w; return Math.round(ms * at / total) - from; }); };
  return [...split(Array(release).fill(1), strikeMs), ...split([hold, ...Array(count - release - 1).fill(1)], durationMs - strikeMs)];
}

const record = JSON.parse(await readFile(RECORD, 'utf8')), game = JSON.parse(await readFile(GAME, 'utf8'));
const report = {};
for (const [sprite, form] of Object.entries(FORMS)) {
  const drop = record[form].drop || {}, base = path.join(SOURCE, form);
  for (const key of Object.keys(game.clips)) if (key.startsWith(`${sprite}-`)) delete game.clips[key];
  game.actions = game.actions.filter(a => !a.startsWith(`${sprite}-`));
  for (const direction of DIRECTIONS) {
    const still = await readFile(path.join(base, 'rotations', `${direction}.png`)), body = await box(await stripEffects(still)), colours = await palette(still);
    const anchorOf = async frame => {
      const b = await box(await stripEffects(frame)), dx = b.left - body.left, dy = b.top - body.top;
      return { anchor: [Math.round(body.centre + dx), body.bottom + dy], bodyHeight: body.bottom - body.top };
    };
    for (const action of ['idle', 'move']) {
      const out = `${ROOT}/clips/${sprite}-${action}-${direction}/${SHEET[sprite]}.png`, size = await sheet([still], out);
      game.clips[`${sprite}-${action}/${direction}`] = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: 1, frameDurationsMs: [FRAME_MS], durationMs: FRAME_MS, loop: true, scale: SCALE, ...await anchorOf(still) };
    }
    for (const [action, folder] of Object.entries(SOURCES)) {
      const files = (await framesIn(path.join(base, 'animations', folder, direction))).filter((_, i) => !(drop[folder]?.[direction] || []).includes(i));
      const frames = await Promise.all(files.map(async f => { const clean = await stripEffects(await readFile(f)); return SPARKS.has(sprite) ? unspark(clean, colours) : clean; }));
      const out = `${ROOT}/clips/${sprite}-${action}-${direction}/${SHEET[sprite]}.png`, size = await sheet(frames, out);
      const [durationMs, strikeMs, hold] = TIMINGS[action], release = await releaseFrame(frames);
      const durations = timing(frames.length, release, durationMs, strikeMs, hold);
      game.clips[`${sprite}-${action}/${direction}`] = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: frames.length, frameDurationsMs: durations, durationMs: durations.reduce((a, b) => a + b, 0), loop: false, scale: SCALE, lastEventMs: strikeMs, ...await anchorOf(frames[0]) };
      (report[`${sprite}-${action}`] ??= {})[direction] = `${frames.length} frames, release at frame ${release}`;
    }
  }
  for (const action of ['idle', 'move', ...Object.keys(SOURCES)]) game.actions.push(`${sprite}-${action}`);
}
await writeFile(GAME, `${JSON.stringify(game, null, 2)}\n`);
console.log(JSON.stringify(report, null, 1));
console.log(JSON.stringify({ clips: Object.keys(game.clips).filter(k => /^ordenx?-/.test(k)).length }));
