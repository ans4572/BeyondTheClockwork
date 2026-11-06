import { pointInPolygon } from '../engine/map-geometry.js';

// Small gaps in a column, such as a railing, still belong to the object around them.
const GAP_PIXELS = 6, SLIVER_PIXELS = 5, DEPTH_MAX_WIDTH = 1920, BLOCK_PIXELS = 16, KEPT_LIMIT = 48, SEEN_LIMIT = 400;
const BODY_HALF_UNITS = 0.35, BODY_UNITS = 1.7, GHOST_FROM = 0.35, GHOST_TO = 0.75, GHOST_ALPHA = 0.6;

/** How strongly the player shows through scenery that hides this share of their body. */
export function ghostFor(hidden) {
  return GHOST_ALPHA * Math.max(0, Math.min(1, (hidden - GHOST_FROM) / (GHOST_TO - GHOST_FROM)));
}

/** For each opaque pixel, the row where its column's object meets the ground; 0 where transparent. */
export function columnDepths(alpha, width, height) {
  const depths = new Uint16Array(width * height);
  for (let x = 0; x < width; x++) {
    let base = 0, gap = GAP_PIXELS + 1;
    for (let y = height - 1; y >= 0; y--) {
      const p = y * width + x;
      if (!alpha[p]) { gap++; continue; }
      if (gap > GAP_PIXELS) base = y;
      gap = 0; depths[p] = base;
    }
  }
  return depths;
}

/** Levels a pixel with its row neighbours, so one odd column inside a tree cannot let a body show through. */
export function closeSlivers(depths, width, height, reach = SLIVER_PIXELS) {
  const row = new Uint16Array(width);
  for (let y = 0; y < height; y++) {
    row.set(depths.subarray(y * width, (y + 1) * width));
    for (let x = 0; x < width; x++) {
      if (!row[x]) continue;
      let deepest = row[x];
      for (let n = Math.max(0, x - reach); n <= Math.min(width - 1, x + reach); n++) if (row[n] > deepest) deepest = row[n];
      depths[y * width + x] = deepest;
    }
  }
  return depths;
}

export function raiseDepths(depths, width, height, perUnit, polygon, baseY) {
  const xs = polygon.map(point => point[0] * perUnit), ys = polygon.map(point => point[1] * perUnit), base = Math.round(baseY * perUnit);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(height, Math.ceil(Math.max(...ys))); y++) for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(width, Math.ceil(Math.max(...xs))); x++) {
    const p = y * width + x;
    if (depths[p] && pointInPolygon(x / perUnit, y / perUnit, polygon)) depths[p] = Math.max(depths[p], base);
  }
}

/**
 * Reads a place's picture and its mask into what DepthMask needs: the map's pixels, each pixel's ground line, and the
 * deepest ground line per block. Pure arithmetic on pixels, so it runs in a worker (src/render/depth-worker.js) as well
 * as here. `overhead` regions hang above their true ground line, so their depth is set by hand. `seeThrough` regions
 * (an arch to walk under) still go in front of a body but only at their `alpha`, so the body shows through them.
 */
export function computeDepth(image, maskImage, { size, overhead = [], seeThrough = [] }, createCanvas) {
  // Read at most 1920 px wide: sharper 2x map art needs no finer depth, and phones keep the memory.
  const shrink = Math.min(1, DEPTH_MAX_WIDTH / image.width), [width, height] = [Math.round(image.width * shrink), Math.round(image.height * shrink)], read = picture => {
    const context = createCanvas(width, height).getContext('2d', { willReadFrequently: true });
    context.drawImage(picture, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  };
  const pixels = read(image), perUnit = width / size[0], marks = read(maskImage), alpha = new Uint8Array(width * height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = marks[p * 4] > 127 ? 255 : 0;
  const depths = closeSlivers(columnDepths(alpha, width, height), width, height);
  for (const { polygon, baseY } of overhead) raiseDepths(depths, width, height, perUnit, polygon, baseY);
  const veil = seeThroughAlpha(depths, width, height, perUnit, seeThrough);
  // The deepest ground line in each 16x16 block, so a body standing in front of everything near it is passed over
  // without reading its whole patch, as most bodies are on most frames.
  const B = BLOCK_PIXELS, blocksWide = Math.ceil(width / B), deepest = new Uint16Array(blocksWide * Math.ceil(height / B));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const d = depths[y * width + x], b = Math.floor(y / B) * blocksWide + Math.floor(x / B); if (d > deepest[b]) deepest[b] = d; }
  return { width, height, perUnit, pixels, depths, deepest, blocksWide, veil };
}

/**
 * How opaque each scenery pixel is when repainted over a body: 255 everywhere but inside `regions`, where it is that
 * region's `alpha` (0 to 1). Null when there are no such regions, so most maps carry no extra array.
 */
export function seeThroughAlpha(depths, width, height, perUnit, regions = []) {
  if (!regions.length) return null;
  const veil = new Uint8Array(width * height).fill(255);
  for (const { polygon, alpha } of regions) {
    const xs = polygon.map(point => point[0] * perUnit), ys = polygon.map(point => point[1] * perUnit), byte = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(height, Math.ceil(Math.max(...ys))); y++) for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(width, Math.ceil(Math.max(...xs))); x++) {
      const p = y * width + x;
      if (depths[p] && pointInPolygon(x / perUnit, y / perUnit, polygon)) veil[p] = byte;
    }
  }
  return veil;
}

/** Repaints the scenery standing in front of a body, so the map behaves like separate objects. `depth` is computeDepth's result. */
export class DepthMask {
  constructor({ width, height, perUnit, pixels, depths, deepest, blocksWide, veil = null }, createCanvas) {
    this.kept = new Map(); this.seen = new Set(); this.patches = new Map();
    Object.assign(this, { width, height, perUnit, pixels, depths, deepest, blocksWide, veil, createCanvas });
    this.pixels32 = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.length / 4);
  }
  /** `x`, `y` are the feet in units; `halfWidth` and `tall` bound the body above them. Returns the share of the body hidden. */
  cover(context, x, y, halfWidth, tall) {
    const { perUnit, width, height, depths, pixels } = this, feet = Math.round(y * perUnit);
    const left = Math.max(0, Math.floor((x - halfWidth) * perUnit)), top = Math.max(0, Math.floor((y - tall) * perUnit));
    const w = Math.min(width, Math.ceil((x + halfWidth) * perUnit)) - left, h = Math.min(height, feet + 2) - top;
    if (w <= 0 || h <= 0) return 0;
    // A body standing still (a shopkeeper, a resident waiting, the player at rest) asks for the same patch every frame:
    // once seen twice in a row it is kept as its own small picture and simply drawn again.
    const key = `${left},${top},${w},${h},${feet}`, kept = this.kept.get(key);
    if (kept) { this.kept.delete(key); this.kept.set(key, kept); if (kept.canvas) this.paint(context, kept.canvas, 0, 0, left, top, kept.part); return kept.hidden; }
    const keep = this.seen.has(key); this.seen.add(key);
    if (this.seen.size > SEEN_LIMIT) this.seen.clear();
    if (!this.scratch || this.scratch.width < w || this.scratch.height < h) { this.scratch = this.createCanvas(Math.max(w, 256), Math.max(h, 256)); this.scratchContext = this.scratch.getContext('2d', { willReadFrequently: true }); }
    // One reusable buffer per patch size: a fresh ImageData for every body every frame kept the garbage collector busy.
    // One buffer per patch size (bodies come in a few sizes), cleared only where the last use wrote to it.
    let slot = this.patches.get(w * 4096 + h);
    if (!slot) { const image = this.scratchContext.createImageData(w, h); slot = { image, words: new Uint32Array(image.data.buffer), dirty: null }; this.patches.set(w * 4096 + h, slot); }
    else if (slot.dirty) { const { x0, y0, x1, y1 } = slot.dirty; for (let y = y0; y <= y1; y++) slot.words.fill(0, y * w + x0, y * w + x1 + 1); slot.dirty = null; }
    const patch = slot.image, words = slot.words, source = this.pixels32, veil = this.veil;
    let dx0 = w, dy0 = h, dx1 = -1, dy1 = -1;
    const bodyLeft = (x - BODY_HALF_UNITS) * perUnit, bodyRight = (x + BODY_HALF_UNITS) * perUnit, bodyTop = (y - BODY_UNITS) * perUnit;
    let found = false, inBody = 0, hidden = 0;
    // Only blocks that hold something standing in front of the feet are read pixel by pixel.
    const firstX = Math.max(left, Math.ceil(bodyLeft)), lastX = Math.min(left + w - 1, Math.floor(bodyRight)), firstY = Math.max(top, Math.ceil(bodyTop));
    inBody = Math.max(0, lastX - firstX + 1) * Math.max(0, top + h - firstY);
    const B = BLOCK_PIXELS;
    for (let by = Math.floor(top / B); by <= Math.floor((top + h - 1) / B); by++) for (let bx = Math.floor(left / B); bx <= Math.floor((left + w - 1) / B); bx++) {
      if (this.deepest[by * this.blocksWide + bx] <= feet) continue;
      const y0 = Math.max(top, by * B), y1 = Math.min(top + h, by * B + B), x0 = Math.max(left, bx * B), x1 = Math.min(left + w, bx * B + B);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const p = y * width + x;
        if (depths[p] <= feet) continue;
        // Scenery the body shows through (veil) does not hide it, so no ghost is called for.
        if (x >= bodyLeft && x <= bodyRight && y >= bodyTop && (!veil || veil[p] === 255)) hidden++;
        const px = x - left, py = y - top;
        if (px < dx0) dx0 = px; if (px > dx1) dx1 = px; if (py < dy0) dy0 = py; if (py > dy1) dy1 = py;
        // One word per pixel, made fully opaque (the alpha byte is the high byte on every platform the game runs on),
        // or as opaque as its see-through region allows.
        words[py * w + px] = veil ? (source[p] & 0xffffff) | (veil[p] << 24) : source[p] | 0xff000000;
        found = true;
      }
    }
    const share = hidden / (inBody || 1);
    if (found) slot.dirty = { x0: dx0, y0: dy0, x1: dx1, y1: dy1 };
    // Only the part that really covers the body is uploaded and drawn, usually a small corner of the patch.
    const part = found ? { x: dx0, y: dy0, w: dx1 - dx0 + 1, h: dy1 - dy0 + 1 } : null;
    let picture = null;
    if (found && keep) { picture = this.createCanvas(part.w, part.h); picture.getContext('2d', { willReadFrequently: true }).putImageData(patch, -part.x, -part.y, part.x, part.y, part.w, part.h); }
    if (keep) { this.kept.set(key, { canvas: picture, part, hidden: share }); if (this.kept.size > KEPT_LIMIT) this.kept.delete(this.kept.keys().next().value); }
    if (!found) return 0;
    if (picture) this.paint(context, picture, 0, 0, left, top, part);
    else { this.scratchContext.putImageData(patch, 0, 0, part.x, part.y, part.w, part.h); this.paint(context, this.scratch, part.x, part.y, left, top, part); }
    return share;
  }
  /** Draws `part` of the patch (taken at sx, sy in `picture`) where it belongs on the map. */
  paint(context, picture, sx, sy, left, top, part) {
    const scale = 20 / this.perUnit;
    // Matches the smooth background it patches, so no seam shows around a covered body.
    const smooth = context.imageSmoothingEnabled; context.imageSmoothingEnabled = true;
    context.drawImage(picture, sx, sy, part.w, part.h, (left + part.x) * scale, (top + part.y) * scale, part.w * scale, part.h * scale);
    context.imageSmoothingEnabled = smooth;
  }
}
