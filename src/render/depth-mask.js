import { pointInPolygon } from '../engine/map-geometry.js';

// Small gaps in a column, such as a railing, still belong to the object around them.
const GAP_PIXELS = 6, SLIVER_PIXELS = 5, DEPTH_MAX_WIDTH = 1920;
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

/** Repaints the scenery standing in front of a body, so the map behaves like separate objects. */
export class DepthMask {
  /** `overhead` regions hang above their true ground line, so their depth is set by hand. */
  constructor(image, maskImage, { size, overhead = [] }, createCanvas) {
    // Read at most 1920 px wide: sharper 2x map art needs no finer depth, and phones keep the memory.
    const shrink = Math.min(1, DEPTH_MAX_WIDTH / image.width), [width, height] = [Math.round(image.width * shrink), Math.round(image.height * shrink)], read = picture => {
      const context = createCanvas(width, height).getContext('2d', { willReadFrequently: true });
      context.drawImage(picture, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    };
    this.pixels = read(image); this.width = width; this.height = height; this.perUnit = width / size[0];
    const marks = read(maskImage), alpha = new Uint8Array(width * height);
    for (let p = 0; p < alpha.length; p++) alpha[p] = marks[p * 4] > 127 ? 255 : 0;
    this.depths = closeSlivers(columnDepths(alpha, width, height), width, height); this.createCanvas = createCanvas;
    for (const { polygon, baseY } of overhead) raiseDepths(this.depths, width, height, this.perUnit, polygon, baseY);
  }
  /** `x`, `y` are the feet in units; `halfWidth` and `tall` bound the body above them. Returns the share of the body hidden. */
  cover(context, x, y, halfWidth, tall) {
    const { perUnit, width, height, depths, pixels } = this, feet = Math.round(y * perUnit);
    const left = Math.max(0, Math.floor((x - halfWidth) * perUnit)), top = Math.max(0, Math.floor((y - tall) * perUnit));
    const w = Math.min(width, Math.ceil((x + halfWidth) * perUnit)) - left, h = Math.min(height, feet + 2) - top;
    if (w <= 0 || h <= 0) return 0;
    if (!this.scratch || this.scratch.width < w || this.scratch.height < h) { this.scratch = this.createCanvas(Math.max(w, 256), Math.max(h, 256)); this.scratchContext = this.scratch.getContext('2d'); }
    // One reusable buffer per patch size: a fresh ImageData for every body every frame kept the garbage collector busy.
    if (this.patch?.width !== w || this.patch.height !== h) this.patch = this.scratchContext.createImageData(w, h); else this.patch.data.fill(0);
    const patch = this.patch;
    const bodyLeft = (x - BODY_HALF_UNITS) * perUnit, bodyRight = (x + BODY_HALF_UNITS) * perUnit, bodyTop = (y - BODY_UNITS) * perUnit;
    let found = false, inBody = 0, hidden = 0;
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const p = (top + row) * width + left + col, body = left + col >= bodyLeft && left + col <= bodyRight && top + row >= bodyTop;
      if (body) inBody++;
      if (depths[p] <= feet) continue;
      if (body) hidden++;
      const to = (row * w + col) * 4, from = p * 4;
      patch.data[to] = pixels[from]; patch.data[to + 1] = pixels[from + 1]; patch.data[to + 2] = pixels[from + 2]; patch.data[to + 3] = 255;
      found = true;
    }
    if (!found) return 0;
    this.scratchContext.putImageData(patch, 0, 0);
    const scale = 20 / perUnit;
    // Matches the smooth background it patches, so no seam shows around a covered body.
    const smooth = context.imageSmoothingEnabled; context.imageSmoothingEnabled = true;
    context.drawImage(this.scratch, 0, 0, w, h, left * scale, top * scale, w * scale, h * scale);
    context.imageSmoothingEnabled = smooth;
    return hidden / (inBody || 1);
  }
}
