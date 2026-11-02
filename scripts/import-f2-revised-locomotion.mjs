// Brings in the west and north-west PixelLab clips made from corrected references: long teal wrench, dark gloves.
// Expects the character download at the path given as the first argument.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const deps = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const sharp = require(path.join(deps, 'sharp')), JSZip = require(path.join(deps, 'jszip'));
const root = 'art/animations/player/movement/locomotion', manifestPath = `${root}/manifest.json`, CELL = 128, COLUMNS = 4;
const GROUPS = [
  { gait: 'idle', direction: 'west', group: 'dcf2ceb7-b9a6-4438-b5e4-8383a7628d7a' },
  { gait: 'walk', direction: 'west', group: 'ece67e12-de69-43d3-82b6-799105a9a50b' },
  { gait: 'run', direction: 'west', group: '69685908-bad8-4cf8-aac3-1bd6321bb9b3' },
  { gait: 'walk', direction: 'north-west', group: '2de6cfa6-c989-475c-9087-b0a5ddb6459a', zipFolder: 'F2_v3' },
  { gait: 'run', direction: 'north-west', group: 'c8690318-de19-411f-88f0-75daf447567f' }
];

const zip = await JSZip.loadAsync(await readFile(process.argv[2])), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const { gait, direction, group, zipFolder } of GROUPS) {
  const short = group.slice(0, 8), files = zip.file(new RegExp(`^Idle/animations/${zipFolder || `[^/]*${short}[^/]*`}/${direction}/frame_[0-9]+[.]png$`)).sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length) throw Error(`No frames for ${gait}/${direction}`);
  const clip = manifest.clips.find(c => c.gait === gait && c.direction === direction), folder = `clips/${gait}-${direction}-${short}`;
  await mkdir(`${root}/${folder}/frames`, { recursive: true });
  const stored = [];
  for (const [i, file] of files.entries()) { const bytes = await file.async('nodebuffer'), name = `${folder}/frames/${String(i).padStart(3, '0')}.png`; await writeFile(`${root}/${name}`, bytes); stored.push({ bytes, name }); }
  // The first frame is the reference pose itself; the loop starts after it.
  const frames = stored.slice(1), { width, height } = await sharp(frames[0].bytes).metadata();
  if (width > CELL || height > CELL) throw Error(`${gait}/${direction}: ${width}x${height} is larger than a cell`);
  const padded = await Promise.all(frames.map(({ bytes }) => sharp(bytes).ensureAlpha().extend({ left: Math.floor((CELL - width) / 2), right: Math.ceil((CELL - width) / 2), top: Math.floor((CELL - height) / 2), bottom: Math.ceil((CELL - height) / 2), background: '#00000000' }).raw().toBuffer()));
  const rows = Math.ceil(frames.length / COLUMNS), sheet = Buffer.alloc(CELL * COLUMNS * CELL * rows * 4);
  padded.forEach((frame, f) => { for (let y = 0; y < CELL; y++) frame.copy(sheet, ((Math.floor(f / COLUMNS) * CELL + y) * CELL * COLUMNS + f % COLUMNS * CELL) * 4, y * CELL * 4, (y + 1) * CELL * 4); });
  const sheetFile = `${folder}/sheet.png`, gifFile = `${folder}/preview.gif`, durations = Array.from({ length: frames.length }, (_, i) => Math.round((i + 1) * clip.durationMs / frames.length / 10) * 10 - Math.round(i * clip.durationMs / frames.length / 10) * 10);
  await sharp(sheet, { raw: { width: CELL * COLUMNS, height: CELL * rows, channels: 4 } }).png().toFile(`${root}/${sheetFile}`);
  await sharp(Buffer.concat(padded), { raw: { width: CELL, height: CELL * frames.length, channels: 4, pageHeight: CELL } }).gif({ delay: durations, loop: 0 }).toFile(`${root}/${gifFile}`);
  Object.assign(clip, { groupId: group, mode: 'pixminimax', sourceFrameWidth: width, sourceFrameHeight: height, sourceFrameCount: files.length, frameCount: frames.length, rows, frameDurationsMs: durations, sampleTimesMs: durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0)), sheet: sheetFile, gif: gifFile, files: frames.map(f => f.name), sourceFiles: stored.map(f => f.name) });
  console.log(gait, direction, frames.length, `${width}x${height}`);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
