import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR_FLAT, floorDistance, distance } from '../src/engine/math.js';

test('a round attack on the floor reaches as far as the ellipse drawn for it', () => {
  const centre = { x: 10, y: 10 };
  // Across the screen the reach is the radius; up or down it is the ellipse's shorter half.
  assert.equal(floorDistance(centre, { x: 13, y: 10 }), 3);
  assert.ok(Math.abs(floorDistance(centre, { x: 10, y: 10 + 3 * FLOOR_FLAT }) - 3) < 1e-9);
  // So a body straight below, inside the old circle but outside the drawn ellipse, is not hit any more.
  const below = { x: 10, y: 12.5 };
  assert.ok(distance(centre, below) < 3 && floorDistance(centre, below) > 3);
});
