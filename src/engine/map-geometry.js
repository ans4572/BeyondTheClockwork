const RING = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** True when a body of this radius stands on a map's floor and clear of its solid props: its centre and eight points round its edge. */
export function fitsMap(x, y, radius, map) {
  const field = clearanceOf(map);
  // Deep on open floor one look at the grid answers for the whole body.
  const room = clearanceAt(field, x, y);
  if (room - FIELD_SLACK >= radius) return true;
  // Otherwise each of the nine points is read from the grid, and only a point right at an edge gets the exact polygon test.
  if (!pointFits(field, map, x, y)) return false;
  for (const [dx, dy] of RING) if (!pointFits(field, map, x + dx * radius, y + dy * radius)) return false;
  return true;
}
function clearanceAt(field, x, y) {
  const col = Math.floor((x - field.left) / FIELD_CELL), row = Math.floor((y - field.top) / FIELD_CELL);
  return col >= 0 && row >= 0 && col < field.cols && row < field.rows ? field.room[row * field.cols + col] : -Infinity;
}
/** One point on the floor and outside every solid, read from the grid unless it lies within half a cell of an edge. */
function pointFits(field, map, x, y) {
  const room = clearanceAt(field, x, y);
  if (room - FIELD_SLACK >= 0) return true;
  if (room + FIELD_SLACK < 0) return false;
  return pointInPolygon(x, y, map.walkable) && !(map.solids || []).some(solid => pointInPolygon(x, y, solid));
}

/*
 * The clearance grid: for each small cell, how far its centre is from the nearest edge of the floor or of a solid,
 * negative off the floor or inside a solid. A body whose radius is less than that, minus half a cell's diagonal, fits anywhere in the
 * cell; this is exact geometry, so it never says yes where the edge test would say no. Built once per floor.
 */
const FIELD_CELL = 0.2, FIELD_SLACK = FIELD_CELL * Math.SQRT1_2 + 1e-9, fields = new WeakMap();
function edgeDistance(x, y, polygon) {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i], dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy); if (d < best) best = d;
  }
  return best;
}
function clearanceOf(map) {
  const field = fieldFor(map);
  if (!field.done) buildRows(field, map, Infinity);
  return field;
}
function fieldFor(map) {
  const known = fields.get(map.walkable);
  if (known && known.solids === map.solids) return known;
  const xs = map.walkable.map(p => p[0]), ys = map.walkable.map(p => p[1]), left = Math.min(...xs), top = Math.min(...ys);
  const cols = Math.ceil((Math.max(...xs) - left) / FIELD_CELL) + 1, rows = Math.ceil((Math.max(...ys) - top) / FIELD_CELL) + 1;
  const field = { left, top, cols, rows, room: new Float32Array(cols * rows), solids: map.solids, nextRow: 0, done: false };
  fields.set(map.walkable, field);
  return field;
}
function buildRows(field, map, until) {
  const { left, top, cols, rows, room } = field, solids = map.solids || [];
  while (field.nextRow < rows) {
    const row = field.nextRow++;
    for (let col = 0; col < cols; col++) {
      const x = left + (col + 0.5) * FIELD_CELL, y = top + (row + 0.5) * FIELD_CELL;
      let d = edgeDistance(x, y, map.walkable);
      if (!pointInPolygon(x, y, map.walkable)) d = -d;
      else for (const solid of solids) { if (pointInPolygon(x, y, solid)) { d = -edgeDistance(x, y, solid); break; } d = Math.min(d, edgeDistance(x, y, solid)); }
      room[row * cols + col] = d;
    }
    if (until !== Infinity && performance.now() >= until) break;
  }
  field.done = field.nextRow >= rows;
}
/** Builds a floor's clearance grid a few rows at a time (about `ms` per call), ahead of the place being entered; true when ready. */
export function prepareClearance(map, ms) {
  if (!map?.walkable) return true;
  const field = fieldFor(map);
  if (!field.done) buildRows(field, map, performance.now() + ms);
  return field.done;
}

/** True when a body of this radius fits; checks the centre and eight points on its edge. */
export function circleInPolygon(x, y, radius, polygon) {
  return pointInPolygon(x, y, polygon) && RING.every(([dx, dy]) => pointInPolygon(x + dx * radius, y + dy * radius, polygon));
}

/** A place in a shared village: the village's map with this place's spawn, NPCs and exit on top. */
const places = new WeakMap();
export const placeOf = (maps, place) => {
  if (!place?.village) return place || null;
  // The same merged place every time, so per-floor caches (clearance, flow fields) keep finding it.
  let merged = places.get(place);
  if (!merged || merged.base !== maps.villages[place.village]) { merged = { ...maps.villages[place.village], ...place }; Object.defineProperty(merged, 'base', { value: maps.villages[place.village] }); places.set(place, merged); }
  return merged;
};

// The camera sits close enough that bodies read large; the 1120x640 frame shows 22.4 by 12.8 units of world.
export const CAMERA_ZOOM = 1.1, PIXELS_PER_UNIT = 40 * CAMERA_ZOOM;
export const VIEW_UNITS = [1120 / PIXELS_PER_UNIT, 640 / PIXELS_PER_UNIT];
/** Top-left of the view centred on the target, stopping at the edges of a map larger than the screen. */
export function cameraFor(target, [width, height] = VIEW_UNITS) {
  const axis = (at, size, view) => Math.max(0, Math.min(size - view, at - view / 2));
  return { x: axis(target.x, width, VIEW_UNITS[0]), y: axis(target.y, height, VIEW_UNITS[1]) };
}
