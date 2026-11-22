// Chapter 3 (Clock Tower) mobs into art/animations/mobs/clock-tower/game-clips.json, beside Tick·Tock's clips.
// Reads the chosen takes the mob preview page shows (art/chapters/3-clock-tower/mobs/preview/data.json: per mob a
// rotations strip, a 'final-move' and a 'final-attack' sheet, rows = directions, columns = frames, each frame centred in
// a square cell; scripts/build-ch3-mob-preview.py made them from PixelLab, with the per-direction redos and flips the
// user picked), so nothing is downloaded or generated again. Attack frames lose the sparks PixelLab paints round the
// figure (strip-effects.mjs). Usage: node scripts/import-ch3-mobs.mjs [mob ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { stripEffects } from './strip-effects.mjs';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const PREVIEW = 'art/chapters/3-clock-tower/mobs/preview', ROOT = 'art/animations/mobs/clock-tower', GAME = `${ROOT}/game-clips.json`;
const ORDER = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const MOVE_FRAME_MS = 90, COLUMNS = 6;
/**
 * The attack clip's length and the moment it lands (the strike, ms from the start), matched to the warning each mob gives
 * in slice.json enemies (tell): the swing lands as the warning ends. `scale` sizes the body beside chapter 2's (about
 * 90 px tall at 1).
 */
const MOBS = {
  secondHandKnight: { strikeMs: 800, durationMs: 1500 },
  bellTurret: { strikeMs: 1000, durationMs: 1600 },
  signalOrb: { strikeMs: 800, durationMs: 1400 },
  hourglassShield: { strikeMs: 900, durationMs: 1600 },
  minuteArcher: { strikeMs: 800, durationMs: 1200 },
  pendulumGuard: { strikeMs: 1000, durationMs: 1700 },
  gearRoller: { strikeMs: 1000, durationMs: 1700 },
  twinHandCaptain: { strikeMs: 900, durationMs: 1700 },
};

/** The frames of one row of a preview sheet, each trimmed of nothing (the cell keeps the feet in place). */
async function row(file, cell, index, count) {
  return Promise.all(Array.from({ length: count }, (_, i) => sharp(file).extract({ left: i * cell, top: index * cell, width: cell, height: cell }).png().toBuffer()));
}
async function sheet(frames, size, output) {
  const rows = Math.ceil(frames.length / COLUMNS);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, i) => ({ input, left: (i % COLUMNS) * size, top: Math.floor(i / COLUMNS) * size }))).png().toFile(output);
  await sharp(output).webp({ lossless: true, effort: 6 }).toFile(output.replace(/\.png$/, '.webp'));
}
/** Feet (the middle of the lowest ten rows of the figure) and body height, in the frame's own pixels. */
async function measure(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 30;
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

const data = JSON.parse(await readFile(`${PREVIEW}/data.json`, 'utf8')), only = process.argv.slice(2);
const game = JSON.parse(await readFile(GAME, 'utf8'));
for (const entry of data) {
  const mob = entry.key, own = MOBS[mob];
  if (!own || (only.length && !only.includes(mob))) continue;
  for (const key of Object.keys(game.clips)) if (key.startsWith(`${mob}-`)) delete game.clips[key];
  // Standing: the rotations strip, one still per direction.
  const strip = `${PREVIEW}/${entry.rotations.file}`, cell = entry.rotations.cell;
  for (const [i, direction] of ORDER.entries()) {
    const still = await sharp(strip).extract({ left: i * cell, top: 0, width: cell, height: cell }).png().toBuffer();
    const out = `${ROOT}/clips/${mob}-idle-${direction}/sheet.png`;
    await sheet([still], cell, out);
    game.clips[`${mob}-idle/${direction}`] = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: cell, frameHeight: cell, columns: COLUMNS, frameCount: 1, frameDurationsMs: [0], durationMs: 0, loop: false, scale: 1, ...await measure(still) };
  }
  for (const [action, name] of [['move', 'final-move'], ['attack', 'final-attack']]) {
    const anim = entry.animations.find(a => a.name === name);
    if (!anim) continue; // the bell turret stands still: no walk
    for (const direction of ORDER) {
      const index = anim.dirs.indexOf(direction), count = anim.frames[direction];
      if (index < 0 || !count) continue;
      let frames = await row(`${PREVIEW}/${anim.file}`, anim.cell, index, count);
      if (action === 'attack') frames = await Promise.all(frames.map(stripEffects));
      const out = `${ROOT}/clips/${mob}-${action}-${direction}/sheet.png`;
      await sheet(frames, anim.cell, out);
      const durations = action === 'move' ? Array(count).fill(MOVE_FRAME_MS) : timing(count, own.durationMs, own.strikeMs);
      const clip = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: anim.cell, frameHeight: anim.cell, columns: COLUMNS, frameCount: count, frameDurationsMs: durations, durationMs: durations.reduce((a, b) => a + b, 0), loop: action === 'move', scale: 1 };
      if (action === 'attack') clip.lastEventMs = own.strikeMs;
      game.clips[`${mob}-${action}/${direction}`] = { ...clip, ...await measure(frames[0]) };
    }
  }
  for (const action of ['idle', 'move', 'attack']) if (!game.actions.includes(`${mob}-${action}`) && Object.keys(game.clips).some(k => k.startsWith(`${mob}-${action}/`))) game.actions.push(`${mob}-${action}`);
  console.log(mob, 'done');
}
await writeFile(GAME, `${JSON.stringify(game, null, 2)}\n`);
console.log(JSON.stringify({ clips: Object.keys(game.clips).length }));
