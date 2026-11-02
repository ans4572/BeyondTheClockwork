import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { F2Rig, footCycle, DIRECTION_ANGLES } from '../src/animation/f2-rig.js';
const config = JSON.parse(await readFile(new URL('../art/animations/player/rig.json', import.meta.url), 'utf8'));
const rig = new F2Rig(config);
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('walk and run planted feet cancel root travel through stance', () => {
  for (const gait of [config.gaits.walk, config.gaits.run]) {
    const samples = [0.02, 0.1, 0.2].filter(p => p < gait.stanceFraction);
    const anchored = samples.map(p => p * gait.stride + footCycle(p, gait).forward);
    assert.ok(anchored.every(n => Math.abs(n - anchored[0]) < 1e-10));
    assert.ok(samples.every(p => footCycle(p, gait).lift === 0));
  }
});
test('swing returns to the same contact position at the loop boundary', () => {
  for (const gait of [config.gaits.walk, config.gaits.run]) {
    assert.ok(Math.abs(footCycle(1 - 1e-7, gait).forward - footCycle(0, gait).forward) < 1e-6);
    assert.ok(footCycle(gait.stanceFraction + (1 - gait.stanceFraction) / 2, gait).lift > 0);
  }
});
test('all directions keep fixed thigh and shin lengths at every phase', () => {
  for (const direction of Object.keys(DIRECTION_ANGLES)) for (const gait of ['idle', 'walk', 'run']) for (let frame = 0; frame < 48; frame++) {
    const p = rig.pose({ phase: frame / 48, direction, gait, time: frame / 24 });
    for (const leg of p.legs) {
      assert.ok(Math.abs(dist(leg.hip, leg.knee) - config.model.upperLeg) < 1e-6, `${direction}/${gait} thigh`);
      assert.ok(Math.abs(dist(leg.knee, leg.ankle) - config.model.lowerLeg) < 1e-6, `${direction}/${gait} shin`);
      assert.ok(leg.ankle[1] >= 0.065 - 1e-9);
    }
    for (const arm of p.arms) {
      assert.ok(Math.abs(dist(arm.shoulder, arm.elbow) - config.model.upperArm) < 1e-6);
      assert.ok(Math.abs(dist(arm.elbow, arm.wrist) - config.model.lowerArm) < 1e-6);
    }
  }
});
test('face is visible toward camera and hidden from the rear', () => {
  assert.equal(rig.pose({ direction: 'south' }).faceVisible, true);
  assert.equal(rig.pose({ direction: 'north' }).faceVisible, false);
});
