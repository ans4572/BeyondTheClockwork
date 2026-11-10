// Chapter 2 (Silent Factory) mobs from PixelLab into art/animations/mobs/silent-factory/game-clips.json.
// Reads art/chapters/2-silent-factory/mobs/pixellab/characters.json ({ "<mob>": { "id", "attackMs", "strikeMs", "drop" } }),
// downloads each character's zip (rotations plus the 'move' and 'attack' animations, 8 directions each), packs every
// clip into a six-column sheet with a lossless WebP beside it, measures feet and body height, and writes the clip list.
// Attack frames lose the sparks PixelLab paints round the figure (strip-effects.mjs); frames with a flash joined to the
// figure are left out by number (`drop`). Usage: node scripts/import-ch2-mobs.mjs [mob ...]
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { stripEffects } from './strip-effects.mjs';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
// The mobs and the bosses; each entry may list extra animations to bring in beside move and attack (`actions`).
const CHARACTERS = ['art/chapters/2-silent-factory/mobs/pixellab/characters.json', 'art/chapters/2-silent-factory/bosses/pixellab/characters.json'];
const ROOT = 'art/animations/mobs/silent-factory', GAME = `${ROOT}/game-clips.json`, CACHE = path.join(os.tmpdir(), 'btc-ch2-mobs');
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const MOVE_FRAME_MS = 90, COLUMNS = 6;
const exists = file => access(file).then(() => true, () => false);

async function unpack(mob, id) {
  const dir = path.join(CACHE, mob), zip = path.join(CACHE, `${mob}.zip`);
  await mkdir(dir, { recursive: true });
  if (!(await exists(zip)) || process.env.FRESH) {
    const response = await fetch(`https://api.pixellab.ai/mcp/characters/${id}/download`);
    if (!response.ok) throw Error(`${mob}: download ${response.status}`);
    await writeFile(zip, Buffer.from(await response.arrayBuffer()));
  }
  // Windows' own tar (bsdtar) reads C: paths; Git Bash's GNU tar takes the colon for a remote host.
  execFileSync(process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar', ['-xf', zip, '-C', dir]);
  return dir;
}
async function sheet(files, output) {
  const sizes = await Promise.all(files.map(f => sharp(f).metadata())), size = Math.max(...sizes.map(s => Math.max(s.width, s.height))), rows = Math.ceil(files.length / COLUMNS);
  // Frames of one clip can differ in canvas; each is centred in the largest so the feet stay put.
  const layers = files.map((input, i) => ({ input, left: i % COLUMNS * size + Math.floor((size - sizes[i].width) / 2), top: Math.floor(i / COLUMNS) * size + (size - sizes[i].height) }));
  await sharp({ create: { width: size * COLUMNS, height: size * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile(output);
  await sharp(output).webp({ lossless: true, effort: 6 }).toFile(output.replace(/\.png$/, '.webp'));
  return size;
}
async function measure(file, size) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 30;
  const dx = Math.floor(((size || info.width) - info.width) / 2), dy = (size || info.height) - info.height;
  let top = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { if (top < 0) top = y; bottom = y; }
  let sum = 0, count = 0;
  for (let y = Math.max(0, bottom - 10); y <= bottom; y++) for (let x = 0; x < info.width; x++) if (solid(x, y)) { sum += x; count++; }
  return { anchor: [Math.round(sum / count) + dx, bottom + dy], bodyHeight: bottom - top };
}
function attackTiming(count, durationMs, strikeMs) {
  const before = Math.max(1, Math.round(count / 2)), split = (n, ms) => Array.from({ length: n }, (_, i) => Math.round(ms * (i + 1) / n) - Math.round(ms * i / n));
  return [...split(before, strikeMs), ...split(count - before, durationMs - strikeMs)];
}
const framesIn = async dir => (await readdir(dir)).filter(f => f.endsWith('.png')).sort().map(f => path.join(dir, f));

const mobs = Object.assign({}, ...await Promise.all(CHARACTERS.map(async file => (await exists(file)) ? JSON.parse(await readFile(file, 'utf8')) : {}))), only = process.argv.slice(2);
const game = (await exists(GAME)) ? JSON.parse(await readFile(GAME, 'utf8')) : { schemaVersion: 1, character: 'mobs', directions: DIRECTIONS, actions: [], clips: {} };
for (const [mob, { id, attackMs = 1500, strikeMs = 700, drop = {}, clips = {}, stills, actions = ['move', 'attack'], casts = {} }] of Object.entries(mobs)) {
  if (only.length && !only.includes(mob)) continue;
  const dir = await unpack(mob, id), base = path.join(dir, 'Idle');
  for (const key of Object.keys(game.clips)) if (key.startsWith(`${mob}-`)) delete game.clips[key];
  for (const direction of DIRECTIONS) {
    const still = `${ROOT}/rotations/${mob}/${direction}.png`;
    await mkdir(path.dirname(still), { recursive: true });
    // `stills` is a folder of hand-fixed standing pictures (<direction>-v1.png) that replace PixelLab's rotations where present.
    const fixed = stills && path.join(stills, `${direction}-v1.png`);
    await sharp(fixed && (await exists(fixed)) ? fixed : path.join(base, 'rotations', `${direction}.png`)).png().toFile(still);
    await sharp(still).webp({ lossless: true, effort: 6 }).toFile(still.replace(/\.png$/, '.webp'));
    const { width } = await sharp(still).metadata();
    game.clips[`${mob}-idle/${direction}`] = { sheet: `/${still.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: width, frameHeight: width, columns: 1, frameCount: 1, frameDurationsMs: [0], durationMs: 0, loop: false, scale: 1, ...await measure(still) };
    for (const action of actions) {
      // `clips` names the PixelLab animations to use in place of 'move' / 'attack' (a redo, or its second group), first found wins.
      let source = null;
      for (const name of clips[action] || [action]) { const at = path.join(base, 'animations', name, direction); if (await exists(at)) { source = at; break; } }
      if (!source) { console.warn(`${mob} ${action} ${direction}: missing`); continue; }
      let files = await framesIn(source);
      if (action !== 'move') {
        const clean = path.join(dir, 'clean', action, direction); await mkdir(clean, { recursive: true });
        const kept = [];
        // `drop` lists frames by direction, or by action and then direction (a boss's attack and cast differ).
        const dropOf = drop[action] && !Array.isArray(drop[action]) ? drop[action] : drop;
        for (const [i, file] of files.entries()) { if ((dropOf[direction] || []).includes(i)) continue; const out = path.join(clean, path.basename(file)); await writeFile(out, await stripEffects(await readFile(file))); kept.push(out); }
        files = kept;
      }
      const out = `${ROOT}/clips/${mob}-${action}-${direction}/sheet.png`; await mkdir(path.dirname(out), { recursive: true });
      const size = await sheet(files, out);
      // An extra action (a boss's cast) times itself from its own entry in `casts`, else like the attack.
      const own = casts[action] || {}, timing = action === 'move' ? Array(files.length).fill(MOVE_FRAME_MS) : attackTiming(files.length, own.durationMs || attackMs, own.strikeMs || strikeMs);
      const entry = { sheet: `/${out.replace(/\.png$/, '.webp')}`, provider: 'pixellab', frameWidth: size, frameHeight: size, columns: COLUMNS, frameCount: files.length, frameDurationsMs: timing, durationMs: timing.reduce((a, b) => a + b, 0), loop: action === 'move', scale: 1 };
      if (action !== 'move') entry.lastEventMs = own.strikeMs || strikeMs;
      game.clips[`${mob}-${action}/${direction}`] = { ...entry, ...await measure(files[0], size) };
    }
  }
  for (const action of ['idle', ...actions]) if (!game.actions.includes(`${mob}-${action}`)) game.actions.push(`${mob}-${action}`);
  console.log(mob, 'done');
}
await writeFile(GAME, `${JSON.stringify(game, null, 2)}\n`);
console.log(JSON.stringify({ clips: Object.keys(game.clips).length }));
