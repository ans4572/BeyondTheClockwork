// Smaller first downloads: every sprite sheet the game reads gets a lossless WebP beside its PNG (pixel for pixel the
// same picture, about half the bytes), and the clip lists point at the WebP. The PNGs stay as the source the clip
// builder measures. Run again after adding or redrawing sheets: `node scripts/build-webp-art.mjs`.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
export const CLIP_LISTS = ['art/animations/player/game-clips.json', 'art/animations/mobs/normal-elite/game-clips.json', 'art/animations/npc/game-clips.json'];

const exists = file => stat(file).then(() => true, () => false);
const local = url => `.${url}`;

/** Every sheet path in a clip list (clip sheets and effects, cast effects). */
export function sheetsOf(list) {
  const out = new Set();
  for (const clip of Object.values(list.clips || {})) for (const key of ['sheet', 'effect']) if (typeof clip[key] === 'string') out.add(clip[key]);
  for (const effect of Object.values(list.castEffects || {})) if (typeof effect.sheet === 'string') out.add(effect.sheet);
  return out;
}

/** Points every `.png` sheet that has a WebP beside it at the WebP; returns how many were changed. */
export async function preferWebp(list) {
  let changed = 0;
  const swap = async value => { if (!value?.endsWith('.png')) return value; const webp = value.replace(/\.png$/, '.webp'); if (await exists(local(webp))) { changed++; return webp; } return value; };
  for (const clip of Object.values(list.clips || {})) for (const key of ['sheet', 'effect']) if (clip[key]) clip[key] = await swap(clip[key]);
  for (const effect of Object.values(list.castEffects || {})) if (effect.sheet) effect.sheet = await swap(effect.sheet);
  return changed;
}

if (process.argv[1]?.endsWith('build-webp-art.mjs')) {
  let before = 0, after = 0, made = 0;
  for (const file of CLIP_LISTS) {
    const raw = await readFile(file, 'utf8'), list = JSON.parse(raw);
    for (const sheet of sheetsOf(list)) {
      const png = local(sheet.replace(/\.webp$/, '.png')), webp = png.replace(/\.png$/, '.webp');
      if (!(await exists(png))) continue;
      if (!(await exists(webp))) { await sharp(png).webp({ lossless: true, effort: 6 }).toFile(webp); made++; }
      before += (await stat(png)).size; after += (await stat(webp)).size;
    }
    const changed = await preferWebp(list);
    // Keep each list's own layout (the player list is one line, the others are indented).
    const indent = raw.startsWith('{\n') ? 2 : undefined;
    await writeFile(file, (indent ? JSON.stringify(list, null, indent) : JSON.stringify(list).replace(/,"/g, ', "').replace(/":/g, '": ')) + (raw.endsWith('\n') ? '\n' : ''));
    console.log(JSON.stringify({ file, changed }));
  }
  console.log(JSON.stringify({ made, pngKB: Math.round(before / 1024), webpKB: Math.round(after / 1024) }));
}
