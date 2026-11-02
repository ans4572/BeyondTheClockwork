import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Locomotion } from '../src/animation/locomotion.js';
const config = JSON.parse(await readFile(new URL('../art/animations/player/animation-plan.json', import.meta.url), 'utf8')).playback;
const advance = (p, axis, n = 120, speed = 5.5) => { for (let i = 0; i < n; i++) p.update(1 / 60, axis, speed); };

test('locomotion keeps cardinal and diagonal speed and distance equal', () => {
  const a = new Locomotion(config), b = new Locomotion(config);
  advance(a, { x: 1, y: 0 }); advance(b, { x: 1, y: 1 });
  assert.ok(Math.abs(a.snapshot().speed - b.snapshot().speed) < 1e-9);
  assert.ok(Math.abs(Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)) < 1e-9);
  assert.ok(Math.abs(a.phase - b.phase) < 1e-9);
});
test('gait phase is travelled distance divided by stride length', () => {
  const p = new Locomotion(config); advance(p, { x: 1, y: 0 }, 90, 2.75);
  assert.ok(Math.abs(p.phase - ((p.x / config.strideLengthUnits) % 1)) < 1e-9);
});
test('direction changes keep phase and stop keeps the last direction', () => {
  const p = new Locomotion(config); advance(p, { x: 1, y: 0 });
  const before = p.phase; p.update(1 / 60, { x: 0, y: -1 }, 5.5);
  assert.ok(p.phase > before || before > 0.95);
  advance(p, { x: 0, y: -1 }); assert.equal(p.direction, 'north');
  advance(p, { x: 0, y: 0 }); assert.equal(p.moving, false); assert.equal(p.direction, 'north');
  const stopped = p.phase; advance(p, { x: 0, y: 0 }); assert.equal(p.phase, stopped);
});
test('pause freezes position, gait phase and idle clock', () => {
  const p = new Locomotion(config); advance(p, { x: 1, y: 0 });
  const before = structuredClone(p); p.update(1, { x: 0, y: 1 }, 5.5, { paused: true });
  assert.deepEqual({ ...p }, before);
});
test('direction hysteresis prevents flicker at a diagonal boundary', () => {
  const p = new Locomotion(config); advance(p, { x: 1, y: 0 });
  for (const degrees of [21, 24, 22, 23, 21]) {
    const radians = degrees * Math.PI / 180; advance(p, { x: Math.cos(radians), y: Math.sin(radians) }, 30);
    assert.equal(p.direction, 'east');
  }
  advance(p, { x: 1, y: 1 }); assert.equal(p.direction, 'south-east');
});
