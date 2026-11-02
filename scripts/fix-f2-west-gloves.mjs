// F2's west-facing PixelLab clips came from a revised reference with cream hands; every other direction has dark gloves.
// The helmet is the same cream, so each frame's cream blobs are split: the helmet is the biggest, small ones are hands.
// Their wrench is also a brighter cyan, so that takes the teal of the other directions. West walking clips were remade and are left out.
// Works from sheet.source.png, so running it again gives the same result.
import { access, copyFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const { clips } = JSON.parse(await readFile('art/animations/player/game-clips.json', 'utf8'));
const HAND_MAX_PIXELS = 260, WRENCH_MAX_PIXELS = 420, GLOVE = [[79, 84, 81], [52, 58, 76], [43, 45, 54]], TEAL = [[111, 176, 162], [79, 151, 140], [49, 88, 78]], TRAIL = [[214, 244, 228], [168, 228, 204], [122, 200, 174]];

function isCream(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (!delta || r !== max || max < 150) return false;
  const hue = ((g - b) / delta) * 60, saturation = delta / max;
  return hue > 18 && hue < 58 && saturation > 0.08 && saturation < 0.56;
}

/** Wrench-sized cyan blobs turn teal; larger ones are swing trails, which take the pale mint of the other directions. */
function tealWrench(data, sheetWidth, left, top, width, height) {
  const at = (x, y) => ((top + y) * sheetWidth + left + x) * 4, seen = new Uint8Array(width * height);
  const cyan = (x, y) => {
    const i = at(x, y), [r, g, b] = [data[i], data[i + 1], data[i + 2]], max = Math.max(r, g, b);
    return data[i + 3] >= 200 && r < g * 0.55 && b > g * 0.75 && b < g * 1.25 && (max - Math.min(r, g, b)) / max > 0.5 && max > 110;
  };
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !cyan(start % width, Math.floor(start / width))) continue;
    const blob = [start]; seen[start] = 1;
    for (let n = 0; n < blob.length; n++) {
      const x = blob[n] % width, y = Math.floor(blob[n] / width);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (nx >= 0 && ny >= 0 && nx < width && ny < height && !seen[ny * width + nx] && cyan(nx, ny)) { seen[ny * width + nx] = 1; blob.push(ny * width + nx); }
    }
    const palette = blob.length > WRENCH_MAX_PIXELS ? TRAIL : TEAL;
    for (const p of blob) { const i = at(p % width, Math.floor(p / width)), max = Math.max(data[i], data[i + 1], data[i + 2]); [data[i], data[i + 1], data[i + 2]] = palette[max > 225 ? 0 : max > 170 ? 1 : 2]; }
  }
}

function recolorFrame(data, sheetWidth, left, top, width, height, footY) {
  const seen = new Uint8Array(width * height), blobs = [], at = (x, y) => ((top + y) * sheetWidth + left + x) * 4;
  const cream = (x, y) => { const i = at(x, y); return data[i + 3] > 200 && isCream(data[i], data[i + 1], data[i + 2]); };
  for (let start = 0; start < seen.length; start++) {
    const sx = start % width, sy = Math.floor(start / width);
    if (seen[start] || !cream(sx, sy)) continue;
    const blob = [start]; seen[start] = 1;
    for (let n = 0; n < blob.length; n++) {
      const x = blob[n] % width, y = Math.floor(blob[n] / width);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (nx >= 0 && ny >= 0 && nx < width && ny < height && !seen[ny * width + nx] && cream(nx, ny)) { seen[ny * width + nx] = 1; blob.push(ny * width + nx); }
    }
    blobs.push(blob);
  }
  if (!blobs.length) return 0;
  const helmet = blobs.reduce((a, b) => (a.length > b.length ? a : b)), xs = helmet.map(p => p % width), ys = helmet.map(p => Math.floor(p / width));
  const [hl, hr, ht, hb] = [Math.min(...xs) - 2, Math.max(...xs) + 2, Math.min(...ys) - 2, Math.max(...ys) + 2];
  let changed = 0;
  for (const blob of blobs) {
    if (blob === helmet || blob.length > HAND_MAX_PIXELS) continue;
    const cx = blob.reduce((sum, p) => sum + p % width, 0) / blob.length, cy = blob.reduce((sum, p) => sum + Math.floor(p / width), 0) / blob.length;
    // Helmet trim, and the worn soles under the boots, are the same colour family.
    if ((cx >= hl && cx <= hr && cy >= ht && cy <= hb) || cy > footY - 6) continue;
    for (const p of blob) {
      const i = at(p % width, Math.floor(p / width)), value = Math.max(data[i], data[i + 1], data[i + 2]);
      [data[i], data[i + 1], data[i + 2]] = GLOVE[value > 235 ? 0 : value > 200 ? 1 : 2];
      changed++;
    }
  }
  return changed;
}

const west = Object.entries(clips).filter(([key, clip]) => key.endsWith('/west') && clip.provider === 'pixellab' && !/^(idle|walk|run)\//.test(key));
for (const [key, clip] of west) {
  const sheet = `.${clip.sheet}`, source = sheet.replace(/sheet\.png$/, 'sheet.source.png');
  if (source === sheet) throw Error(`Unexpected sheet name: ${sheet}`);
  await access(source).catch(() => copyFile(sheet, source));
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { frameWidth: width, frameHeight: height, columns, frameCount, anchor } = clip;
  let changed = 0;
  for (let frame = 0; frame < frameCount; frame++) {
    const left = frame % columns * width, top = Math.floor(frame / columns) * height;
    changed += recolorFrame(data, info.width, left, top, width, height, anchor[1]);
    tealWrench(data, info.width, left, top, width, height);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(sheet);
  console.log(key, Math.round(changed / frameCount));
}
