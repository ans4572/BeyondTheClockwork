/** Small geometry helpers shared by the game's parts (positions are { x, y } in floor units, angles in radians). */
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/**
 * The painted floor is seen at a slant, so a round area on it shows as an ellipse this much shorter than it is wide.
 * Round enemy attacks are drawn that way and hit that way: floorDistance counts a step up or down the screen as
 * 1 / FLOOR_FLAT of a step across, so `floorDistance(a, b) < r` is exactly the ellipse drawn with radius r.
 */
export const FLOOR_FLAT = 0.55;
export const floorDistance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) / FLOOR_FLAT);
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const inCone = (origin, target, angle, range, degrees) => distance(origin, target) <= range + (target.radius || 0) && Math.abs(angleDiff(Math.atan2(target.y - origin.y, target.x - origin.x), angle)) <= degrees * Math.PI / 360;
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
