import test from 'node:test';
import assert from 'node:assert/strict';
import { playtest } from '../scripts/playtest.mjs';

test('input-only bot can finish all thirteen stages on the authored maps with no permanent upgrades on three fixed seeds', () => {
  for (const seed of [123, 44, 9813]) {
    const result = playtest(seed);
    assert.equal(result.mode, 'complete', `Seed ${seed} failed at node ${result.node}`);
    assert.equal(result.baseGears, 132);
    assert.ok(result.hp > 0);
    assert.ok(Object.values(result.upgrades).every(rank => rank === 0));
  }
});
