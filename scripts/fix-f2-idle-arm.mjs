// F2's PixelLab design has no left forearm, so facing the camera the arm reads as missing.
// Paints a relaxed forearm and hand onto the idle sheets, following each frame's breathing.
// Works from sheet.source.png, so running it again gives the same result.
import { copyFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const CELL = 128, COLUMNS = 4, FRAMES = 8, FRAME_MS = 200;
const OUTLINE = [31, 30, 24], ARM = [155, 166, 107], LIGHT = [191, 202, 138], SHADE = [99, 112, 72], GLOVE = [52, 58, 76], GLOVE_LIGHT = [79, 84, 81];
// `shoulder` frames the joint that sets the breathing offset; the rest is in sheet pixels at frame 0.
const ARMS = {
  'south': { shoulder: [78, 56, 88, 68], from: [84, 65], to: [87, 74], hand: [88.5, 78.5] },
  'south-west': { shoulder: [71, 60, 81, 68], from: [80, 72], to: [82, 77], hand: [83.5, 81.5] }
};
const FOREARM_RADIUS = 2.1, HAND_RADIUS = 4.8;

const isScarf = ([r, g, b]) => r > 80 && r > g * 1.6 && r > b * 1.25;
const isJoint = ([r, g, b]) => g >= r && g > 130 && b < g * 0.8;

function shoulderBottom(data, frame, [left, top, right, bottom]) {
  const originX = frame % COLUMNS * CELL, originY = Math.floor(frame / COLUMNS) * CELL;
  for (let y = bottom; y >= top; y--) for (let x = left; x <= right; x++) {
    const i = ((originY + y) * CELL * COLUMNS + originX + x) * 4;
    if (data[i + 3] > 200 && isJoint(data.subarray(i, i + 3))) return y;
  }
  throw Error('Shoulder not found');
}

/** The arm as a small picture: fill inside, outline on its edge. */
function armPixels({ from, to, hand }, dy) {
  const pixels = new Map(), key = (x, y) => `${x},${y}`;
  const fill = ([cx, cy], radius, shade) => {
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) for (let x = Math.floor(cx - radius); x <= cx + radius; x++) if (Math.hypot(x - cx, y - cy) <= radius) pixels.set(key(x, y), shade(x - cx, y - cy));
  };
  const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) * 2);
  for (let s = 0; s <= steps; s++) fill([from[0] + (to[0] - from[0]) * s / steps, from[1] + (to[1] - from[1]) * s / steps], FOREARM_RADIUS, dx => (dx < -0.8 ? LIGHT : dx > 0.9 ? SHADE : ARM));
  fill(hand, HAND_RADIUS, (dx, dy) => (dx + dy < -1.8 ? GLOVE_LIGHT : GLOVE));
  const outline = new Map();
  for (const point of pixels.keys()) {
    const [x, y] = point.split(',').map(Number);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!pixels.has(key(x + ox, y + oy))) outline.set(key(x + ox, y + oy), OUTLINE);
  }
  return [...outline, ...pixels].map(([point, color]) => { const [x, y] = point.split(',').map(Number); return { x, y: y + dy, color }; });
}

for (const [direction, arm] of Object.entries(ARMS)) {
  const folder = `art/animations/player/movement/locomotion/clips/idle-${direction}-708a71c5`, sheet = `${folder}/sheet.png`, source = `${folder}/sheet.source.png`;
  await access(source).catch(() => copyFile(sheet, source));
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rest = shoulderBottom(data, 0, arm.shoulder);
  for (let frame = 0; frame < FRAMES; frame++) {
    const originX = frame % COLUMNS * CELL, originY = Math.floor(frame / COLUMNS) * CELL, dy = shoulderBottom(data, frame, arm.shoulder) - rest;
    for (const { x, y, color } of armPixels(arm, dy)) {
      const i = ((originY + y) * info.width + originX + x) * 4;
      // The scarf and the shoulder stay in front of the new arm.
      if (data[i + 3] > 40 && (isScarf(data.subarray(i, i + 3)) || (color === OUTLINE))) continue;
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(sheet);
  const pages = [];
  for (let frame = 0; frame < FRAMES; frame++) pages.push(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: frame % COLUMNS * CELL, top: Math.floor(frame / COLUMNS) * CELL, width: CELL, height: CELL }).raw().toBuffer());
  await sharp(Buffer.concat(pages), { raw: { width: CELL, height: CELL * FRAMES, channels: 4, pageHeight: CELL } }).gif({ delay: Array(FRAMES).fill(FRAME_MS), loop: 0 }).toFile(`${folder}/preview.gif`);
  console.log(direction, 'painted');
}
