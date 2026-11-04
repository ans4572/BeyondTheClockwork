// Puts F2's left arm back into the attack frames where PixelLab left it out (south-west 1st blow). The south and
// south-east 2nd blows were drawn again in PixelLab instead (2026-11-04), so they are not patched here.
// The arm is cut from the clip's first frame, moved with the body (the helmet's centre is followed from frame to
// frame) and drawn in under the wrench: pixels of the wrench stay in front, everything else takes the arm.
// Each sheet is patched from the copy committed before this script existed (ORIGINAL), so a rerun gives the same result.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { writeFile } from 'node:fs/promises';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const BASE = 'art/animations/player/movement/attacks/clips', SIZE = 192, COLUMNS = 4, ORIGINAL = '963b591';
/** Clip, the frames missing the arm, and the arm's box in the first frame (x0, y0, x1, y1, inclusive). */
const PATCHES = [
  { clip: 'attack-1-south-west-8735285c', frames: [4, 5, 6, 7, 8, 9, 10], arm: [105, 91, 120, 108] }
];
const at = (info, f, x, y) => ((Math.floor(f / COLUMNS) * SIZE + y) * info.width + (f % COLUMNS) * SIZE + x) * 4;
const solid = (data, i) => data[i + 3] > 30;
/** The wrench's teal and cyan, and its dark outline next to them, stay in front of the arm. */
const wrench = (data, i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return b > 100 && g > 110 && r < 150 && g - r > 30; };
/** Centre of the helmet's cream shell, to follow the body as it leans and steps. */
function helmet(data, info, f) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 40; y < 110; y++) for (let x = 40; x < 150; x++) { const i = at(info, f, x, y); if (solid(data, i) && data[i] > 215 && data[i + 1] > 190 && data[i + 2] > 130 && data[i + 2] < 200) { sx += x; sy += y; n++; } }
  return n ? [sx / n, sy / n] : [0, 0];
}

for (const { clip, frames, arm } of PATCHES) {
  const sheet = `${BASE}/${clip}/sheet.png`;
  const original = execFileSync('git', ['show', `${ORIGINAL}:${sheet}`], { maxBuffer: 64 << 20 });
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [hx, hy] = helmet(data, info, 0), [x0, y0, x1, y1] = arm;
  for (const f of frames) {
    const [fx, fy] = helmet(data, info, f), dx = Math.round(fx - hx), dy = Math.round(fy - hy);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const from = at(info, 0, x, y), tx = x + dx, ty = y + dy;
      if (!solid(data, from) || tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE) continue;
      const to = at(info, f, tx, ty);
      if (solid(data, to) && wrench(data, to)) continue;
      data.copy(data, to, from, from + 4);
    }
  }
  await writeFile(sheet, await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer());
  console.log(clip, 'patched frames', frames.join(','));
}
