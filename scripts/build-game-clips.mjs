// Merges art manifests into the one format the game reads, one output per character set.
// To replace a clip set later, change SETS and run this again; game code stays the same.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

// PixelLab F2 stands about 83px tall and the local rig 64px, so rig clips are scaled until they are replaced.
const LOCAL_RIG_SCALE = 1.3;
const MIN_WALK_SHARE = 0.92;
const REACTIONS = ['hit', 'death', 'dodge'];
const FUSION_LAYERS = 'skills/fusion/pixellab/expansion';
const SETS = [
  {
    root: 'art/animations/player',
    output: 'game-clips.json',
    meta: { character: 'F2', locomotion: async root => (await json(`${root}/animation-plan.json`)).playback },
    extras: fusionLayers,
    sources: [
      { base: 'movement/locomotion', manifest: 'movement/locomotion/manifest.json', actionOf: c => c.gait, sheetOf: c => c.sheet, loop: () => true },
      { base: 'movement/attacks', manifest: 'movement/attacks/manifest.json', actionOf: c => c.action, sheetOf: c => c.sheet, loop: () => false },
      { base: 'skills/basic/pixellab', manifest: 'skills/basic/pixellab/manifest.json', actionOf: c => c.action, sheetOf: c => c.sheet, loop: () => false, isCast: () => true },
      { base: 'skills/basic/pixellab-second', manifest: 'skills/basic/pixellab-second/manifest.json', actionOf: c => c.action, sheetOf: c => c.sheet, loop: () => false, isCast: () => true },
      { base: '', manifest: 'state-clips.json', actionOf: c => REACTIONS.includes(c.id) ? c.id : null, sheetOf: c => c.image, effectOf: c => c.effectOrigin === 'ground_target' ? null : c.effectImage, loop: () => false, scale: LOCAL_RIG_SCALE }
    ]
  },
  {
    root: 'art/animations/mobs/normal-elite',
    output: 'game-clips.json',
    meta: { character: 'mobs' },
    // A later `${enemy}-hit` or `${enemy}-death` clip is played by MobAnimator without a code change.
    sources: [
      { base: '', manifest: 'enemy-clips.json', actionOf: c => `${c.enemy}-${c.action}`, sheetOf: c => c.image, loop: c => c.loop },
      { base: 'pixellab', manifest: 'pixellab/clips.json', actionOf: c => `${c.enemy}-${c.action}`, sheetOf: c => c.image, loop: c => c.loop }
    ]
  },
  {
    root: 'art/animations/npc',
    output: 'game-clips.json',
    meta: { character: 'npc' },
    evenWalkSizes: true,
    sources: [{ base: 'pixellab', manifest: 'pixellab/clips.json', actionOf: c => `${c.character}-${c.action}`, sheetOf: c => c.image, loop: c => c.loop }]
  }
];

/** A few generated directions came out shrunken; they are scaled up to match the character's usual height. */
function evenWalkSizes(clips) {
  const groups = Map.groupBy(Object.keys(clips).filter(key => key.includes('-walk/')), key => key.split('/')[0]);
  for (const keys of groups.values()) {
    const heights = keys.map(key => clips[key].bodyHeight).sort((a, b) => a - b), usual = heights[heights.length >> 1];
    for (const key of keys) if (clips[key].bodyHeight < usual * MIN_WALK_SHARE) clips[key].scale = usual / clips[key].bodyHeight;
  }
}

const pixels = file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** Fusion casts are separate layers: a body per family at the caster, an effect at the cast's world position. */
async function fusionLayers(root, clips) {
  const layers = `${root}/${FUSION_LAYERS}`, layout = await json(`${layers}/layout.json`), fusions = (await json(`${root}/skills/fusion/pixellab/manifest.json`)).clips;
  const families = [...new Set(Object.values(layout.skills).map(skill => skill.family))];
  for (const family of families) {
    for (const direction of layout.directions) {
      const frames = await json(`${layers}/bodies/${family}/${direction}/frames.json`), sheet = `${layers}/bodies/${family}/${direction}/sheet.png`;
      const entry = { sheet: `/${sheet}`, provider: 'pixellab', frameWidth: frames.frameWidth, frameHeight: frames.frameHeight, columns: frames.columns, frameCount: frames.frameCount, frameDurationsMs: Array(frames.frameCount).fill(layout.bodyDurationMs / frames.frameCount), durationMs: layout.bodyDurationMs, loop: false, scale: 1, anchor: layout.bodySourceAnchor };
      entry.bodyHeight = await bodyHeight(sheet, entry);
      clips[`cast-${family}/${direction}`] = entry;
    }
    // The six south-east clips are baked composites, so no separate body exists for that direction yet.
    clips[`cast-${family}/south-east`] = { ...clips[`cast-${family}/south`], directionFallback: 'south' };
  }
  const castActions = {}, castEffects = {};
  for (const [id, skill] of Object.entries(layout.skills)) {
    const { layerSources: source } = fusions.find(clip => clip.id === id && clip.layerSources), sheet = `${layers}/effects/${id}/sheet.png`;
    castActions[id] = `cast-${skill.family}`;
    castEffects[id] = { sheet: `/${sheet}`, frameWidth: source.effectFrameWidth, frameHeight: source.effectFrameHeight, columns: source.effectColumns, playback: source.effectPlayback, durationMs: skill.effectDurationMs, releaseMs: layout.releaseMs, anchor: skill.effectAnchor, placement: skill.placement };
  }
  return { castActions, castEffects: { ...castEffects, ...await json(`${root}/skills/basic/pixellab-second/effects.json`) } };
}

/** Foot point measured from opaque pixels: lowest row, and the centre of the bottom rows. */
async function measureFeet(file, clip) {
  const { data, info } = await pixels(file);
  const { frameWidth: w, frameHeight: h, columns, frameCount } = clip, frames = [];
  // Looping clips sample every frame; one-shot clips start from the shared idle pose.
  for (let f = 0; f < (clip.loop ? frameCount : 1); f++) {
    const left = f % columns * w, top = Math.floor(f / columns) * h, opaque = (x, y) => data[((top + y) * info.width + left + x) * 4 + 3] > 30;
    let bottom = -1;
    for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (opaque(x, y)) { bottom = y; break; }
    let sum = 0, count = 0;
    for (let y = Math.max(0, bottom - 11); y <= bottom; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) { sum += x; count++; }
    if (count) frames.push({ bottom, x: sum / count });
  }
  const xs = frames.map(f => f.x).sort((a, b) => a - b);
  return [Math.round(xs[xs.length >> 1]), Math.max(...frames.map(f => f.bottom))];
}

/** Pixels from the feet to the top of the first frame; places health bars above a body of any height. */
async function bodyHeight(file, clip) {
  const { data, info } = await pixels(file);
  for (let y = 0; y < clip.frameHeight; y++) for (let x = 0; x < clip.frameWidth; x++) if (data[(y * info.width + x) * 4 + 3] > 30) return clip.anchor[1] - y;
  throw Error(`Empty frame: ${file}`);
}

for (const set of SETS) {
  const clips = {}, castable = new Set();
  for (const source of set.sources) {
    for (const clip of (await json(path.join(set.root, source.manifest))).clips) {
      const action = source.actionOf(clip);
      if (!action) continue;
      if (source.isCast?.(clip)) castable.add(action);
      const sheet = path.posix.join(source.base, source.sheetOf(clip)), frameDurationsMs = clip.frameDurationsMs || Array(clip.frameCount).fill(clip.frameDurationMs);
      const entry = { sheet: `/${set.root}/${sheet}`, provider: clip.provider || 'local_rig', frameWidth: clip.frameWidth, frameHeight: clip.frameHeight, columns: clip.columns, frameCount: clip.frameCount, frameDurationsMs, durationMs: clip.durationMs, loop: source.loop(clip), scale: source.scale || 1 };
      const effectImage = source.effectOf ? source.effectOf(clip) : clip.effectImage, effect = effectImage ? path.posix.join(source.base, effectImage) : null;
      if (effect) entry.effect = `/${set.root}/${effect}`;
      if (clip.attackEvents?.length) entry.lastEventMs = Math.max(...clip.attackEvents.map(event => event.timeMs));
      entry.anchor = clip.anchor ? [clip.anchor[0] * clip.frameWidth, clip.anchor[1] * clip.frameHeight].map(Math.round) : await measureFeet(path.join(set.root, sheet), entry);
      entry.bodyHeight = await bodyHeight(path.join(set.root, sheet), entry);
      clips[`${action}/${clip.direction}`] = entry;
    }
  }
  if (set.evenWalkSizes) evenWalkSizes(clips);
  const extras = await set.extras?.(set.root, clips);
  const actions = [...new Set(Object.keys(clips).map(key => key.split('/')[0]))];
  for (const action of actions) for (const direction of DIRECTIONS) if (!clips[`${action}/${direction}`]) throw Error(`Missing clip: ${action}/${direction}`);
  const out = { schemaVersion: 1, character: set.meta.character, directions: DIRECTIONS, actions };
  if (set.meta.locomotion) out.locomotion = await set.meta.locomotion(set.root);
  if (extras?.castActions) { out.castActions = { ...Object.fromEntries(actions.filter(action => castable.has(action)).map(action => [action, action])), ...extras.castActions }; out.castEffects = extras.castEffects; }
  out.clips = clips;
  await writeFile(path.join(set.root, set.output), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ set: set.meta.character, clips: Object.keys(clips).length, actions: actions.length }));
}
