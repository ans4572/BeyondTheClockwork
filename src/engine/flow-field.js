import { fitsMap } from './map-geometry.js';

const CELL_UNITS = 0.5, CLEARANCE_UNITS = 0.55, SEARCH_CELLS = 4;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]], ALL = [...SIDES, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Walking distance to the player over a room's floor, so enemies go round what they cannot go through. */
export class FlowField {
  constructor(map, [width, height]) {
    this.cols = Math.ceil(width / CELL_UNITS); this.rows = Math.ceil(height / CELL_UNITS);
    this.open = new Uint8Array(this.cols * this.rows); this.steps = new Int32Array(this.open.length).fill(-1); this.target = -1;
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) this.open[row * this.cols + col] = fitsMap((col + 0.5) * CELL_UNITS, (row + 0.5) * CELL_UNITS, CLEARANCE_UNITS, map) ? 1 : 0;
  }
  /**
   * Closes the cells under solid boxes ({ x, y, w, h } from the top-left, like crates and fences) on top of the floor;
   * passing the current boxes again restores any cell a box no longer covers.
   */
  setBlocks(boxes) {
    const key = JSON.stringify(boxes);
    if (key === this.blockKey) return;
    this.blockKey = key; this.base ??= this.open.slice(); this.open.set(this.base); this.target = -1;
    for (const box of boxes) {
      const [c0, r0] = this.cell(box.x - CLEARANCE_UNITS, box.y - CLEARANCE_UNITS), [c1, r1] = this.cell(box.x + box.w + CLEARANCE_UNITS, box.y + box.h + CLEARANCE_UNITS);
      for (let row = Math.max(0, r0); row <= Math.min(this.rows - 1, r1); row++) for (let col = Math.max(0, c0); col <= Math.min(this.cols - 1, c1); col++) {
        const cx = (col + 0.5) * CELL_UNITS, cy = (row + 0.5) * CELL_UNITS;
        if (cx > box.x - CLEARANCE_UNITS * 0.8 && cx < box.x + box.w + CLEARANCE_UNITS * 0.8 && cy > box.y - CLEARANCE_UNITS * 0.8 && cy < box.y + box.h + CLEARANCE_UNITS * 0.8) this.open[row * this.cols + col] = 0;
      }
    }
  }
  cell(x, y) { return [Math.floor(x / CELL_UNITS), Math.floor(y / CELL_UNITS)]; }
  isOpen(col, row) { return col >= 0 && row >= 0 && col < this.cols && row < this.rows && this.open[row * this.cols + col] === 1; }
  /** The player can hug a wall closer than a large enemy can stand, so the nearest open cell stands in. */
  nearestOpen(col, row) {
    for (let reach = 0; reach <= SEARCH_CELLS; reach++) for (let y = -reach; y <= reach; y++) for (let x = -reach; x <= reach; x++) if (this.isOpen(col + x, row + y)) return [col + x, row + y];
    return null;
  }
  update(x, y) {
    const start = this.nearestOpen(...this.cell(x, y));
    if (!start) return;
    const target = start[1] * this.cols + start[0];
    if (target === this.target) return;
    this.target = target; this.steps.fill(-1); this.steps[target] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const [col, row] = queue[head], next = this.steps[row * this.cols + col] + 1;
      for (const [dx, dy] of SIDES) {
        if (!this.isOpen(col + dx, row + dy) || this.steps[(row + dy) * this.cols + col + dx] >= 0) continue;
        this.steps[(row + dy) * this.cols + col + dx] = next; queue.push([col + dx, row + dy]);
      }
    }
  }
  /** Whether a point can be walked to from the last target, so nothing is placed where it can never be reached. */
  reachable(x, y) { const [col, row] = this.cell(x, y); return this.isOpen(col, row) && this.steps[row * this.cols + col] >= 0; }
  /** Angle of the next cell on the way, or null where the floor is too tight to map. */
  heading(x, y) {
    const [col, row] = this.cell(x, y);
    if (!this.isOpen(col, row) || this.steps[row * this.cols + col] < 0) return null;
    let best = null, least = this.steps[row * this.cols + col];
    for (const [dx, dy] of ALL) {
      // A diagonal may not cut the corner of a blocked cell.
      if (!this.isOpen(col + dx, row + dy) || !this.isOpen(col + dx, row) || !this.isOpen(col, row + dy)) continue;
      const steps = this.steps[(row + dy) * this.cols + col + dx];
      if (steps >= 0 && steps < least) { least = steps; best = [dx, dy]; }
    }
    return best && Math.atan2((row + best[1] + 0.5) * CELL_UNITS - y, (col + best[0] + 0.5) * CELL_UNITS - x);
  }
}
