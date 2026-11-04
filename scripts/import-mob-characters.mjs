// Replaces mobs in art/animations/mobs/normal-elite/game-clips.json with PixelLab characters.
// Reads art/animations/mobs/normal-elite/pixellab/characters.json:
//   { "<enemy>": { "id": "<character id>", "move": { "<direction>": "<animation id>" }, "attack": { ... } } }
// For each mob it downloads the rotations and animation frames (public PixelLab file URLs), packs each clip into a
// six-column sheet, measures where the feet stand and how tall the body is, and writes the clips in place of the
// mob's old ones. Attack clips keep the mob's old length and strike time, with the first half of the frames played
// before the strike and the rest over the recovery; their stray effects are cleaned off (see cleanAttack).
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { stripEffects } from './strip-effects.mjs';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const ROOT = 'art/animations/mobs/normal-elite', DIR = `${ROOT}/pixellab`, GAME = `${ROOT}/game-clips.json`;
const FILES = 'https://backblaze.pixellab.ai/file/pixellab-characters/6c661d9f-cdf4-4c03-b3a4-d7885126a472';
const MOVE_FRAME_MS = 90, COLUMNS = 6, MAX_FRAMES = 24;
const exists = file => access(file).then(() => true, () => false);

async function fetchTo(url, file) {
  if (await exists(file)) return true;
  const response = await fetch(url);
  if (!response.ok) return false;
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return true;
}
async function frames(character, animation, direction, dir) {
  await mkdir(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    const file = `${dir}/${String(i).padStart(3, '0')}.png`;
    if (!(await fetchTo(`${FILES}/${character}/animations/${animation}/${direction}/${i}.png`, file))) break;
    files.push(file);
  }
  if (!files.length) throw Error(`${character} ${animation} ${direction}: no frames`);
  return files;
}
async function sheet(files, output) {
  const { width: size } = await sharp(files[0]).metadata(), rows = Math.ceil(files.length / COLUMNS);
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(files.map((input, i) => ({ input, left: i % COLUMNS * size, top: Math.floor(i / COLUMNS) * size }))).png().toFile(output);
  return { size, rows };
}
/**
 * PixelLab paints impact flashes into attack frames however it is asked not to. Frames carrying a flash joined to the
 * figure were picked out by eye (`drop` in characters.json, by frame number) and are left out; in the rest, every
 * piece apart from the figure (sparks, notes, dust) is erased.
 */
async function cleanAttack(all, drop = []) {
  // Cleaned copies go beside the downloads (frames/ stays as PixelLab drew it), so a rerun starts from the same pictures.
  const files = [];
  for (const [i, file] of all.entries()) {
    if (drop.includes(i)) continue;
    const clean = file.replace(/[\/]frames[\/]/, '/clean/');
    await mkdir(path.dirname(clean), { recursive: true });
    await writeFile(clean, await stripEffects(await readFile(file)));
    files.push(clean);
  }
  return files;
}
/** Where the feet stand (centre of the lowest rows) and how far above them the body reaches, on one frame. */
async function measure(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 30;
  let top = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { if (top < 0) top = y; bottom = y; }
  let sum = 0, count = 0;
  for (let y = Math.max(0, bottom - 10); y <= bottom; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { sum += x; count++; }
  return { anchor: [Math.round(sum / count), bottom], bodyHeight: bottom - top };
}
/** Frames before the strike fill the tell, the rest the recovery. */
function attackTiming(count, durationMs, strikeMs) {
  const before = Math.max(1, Math.round(count / 2)), split = (n, ms) => Array.from({ length: n }, (_, i) => Math.round(ms * (i + 1) / n) - Math.round(ms * i / n));
  return [...split(before, strikeMs), ...split(count - before, durationMs - strikeMs)];
}

const mobs = JSON.parse(await readFile(`${DIR}/characters.json`, 'utf8')), game = JSON.parse(await readFile(GAME, 'utf8'));
for (const [enemy, { id, move, attack, drop = {} }] of Object.entries(mobs)) {
  const old = Object.fromEntries(game.directions.map(d => [d, game.clips[`${enemy}-attack/${d}`]]));
  for (const key of Object.keys(game.clips)) if (key.startsWith(`${enemy}-`)) delete game.clips[key];
  for (const direction of game.directions) {
    const still = `${DIR}/rotations/${enemy}/${direction}.png`;
    await mkdir(path.dirname(still), { recursive: true });
    if (!(await fetchTo(`${FILES}/${id}/rotations/${direction}.png`, still))) throw Error(`${enemy} ${direction}: no rotation`);
    const { width } = await sharp(still).metadata();
    game.clips[`${enemy}-idle/${direction}`] = { sheet: `/${still}`, provider: 'pixellab', frameWidth: width, frameHeight: width, columns: 1, frameCount: 1, frameDurationsMs: [0], durationMs: 0, loop: false, scale: 1, ...await measure(still) };
    for (const [action, animations] of [['move', move], ['attack', attack]]) {
      if (!animations?.[direction]) continue;
      const dir = `${DIR}/clips/${enemy}-${action}-${direction}`, raw = await frames(id, animations[direction], direction, `${dir}/frames`);
      const files = action === 'attack' ? await cleanAttack(raw, drop[direction]) : raw, { size } = await sheet(files, `${dir}/sheet.png`);
      const before = old[direction] || old.south, timing = action === 'move' ? Array(files.length).fill(MOVE_FRAME_MS) : attackTiming(files.length, before.durationMs, before.lastEventMs);
      const entry = { sheet: `/${dir}/sheet.png`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: files.length, frameDurationsMs: timing, durationMs: timing.reduce((a, b) => a + b, 0), loop: action === 'move', scale: 1 };
      if (action === 'attack') entry.lastEventMs = before.lastEventMs;
      game.clips[`${enemy}-${action}/${direction}`] = { ...entry, ...await measure(files[0]) };
    }
  }
}
await writeFile(GAME, `${JSON.stringify(game, null, 2)}\n`);
console.log(JSON.stringify({ mobs: Object.keys(mobs), clips: Object.keys(game.clips).length }));
