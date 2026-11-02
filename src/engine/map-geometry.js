const RING = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** True when a body of this radius stands on a map's floor and clear of its solid props. */
export function fitsMap(x, y, radius, map) {
  if (!circleInPolygon(x, y, radius, map.walkable)) return false;
  const points = [[0, 0], ...RING.map(([dx, dy]) => [dx * radius, dy * radius])];
  return !(map.solids || []).some(solid => points.some(([dx, dy]) => pointInPolygon(x + dx, y + dy, solid)));
}

/** True when a body of this radius fits; checks the centre and eight points on its edge. */
export function circleInPolygon(x, y, radius, polygon) {
  return pointInPolygon(x, y, polygon) && RING.every(([dx, dy]) => pointInPolygon(x + dx * radius, y + dy * radius, polygon));
}

/** A place in a shared village: the village's map with this place's spawn, NPCs and exit on top. */
export const placeOf = (maps, place) => (place?.village ? { ...maps.villages[place.village], ...place } : place || null);

// The camera sits close enough that bodies read large; the 1120x640 frame shows 22.4 by 12.8 units of world.
export const CAMERA_ZOOM = 1.25, PIXELS_PER_UNIT = 40 * CAMERA_ZOOM;
export const VIEW_UNITS = [1120 / PIXELS_PER_UNIT, 640 / PIXELS_PER_UNIT];
/** Top-left of the view centred on the target, stopping at the edges of a map larger than the screen. */
export function cameraFor(target, [width, height] = VIEW_UNITS) {
  const axis = (at, size, view) => Math.max(0, Math.min(size - view, at - view / 2));
  return { x: axis(target.x, width, VIEW_UNITS[0]), y: axis(target.y, height, VIEW_UNITS[1]) };
}
