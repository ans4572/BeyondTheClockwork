import test from 'node:test';
import assert from 'node:assert/strict';
import { playtest } from '../scripts/playtest.mjs';

const keyStats = rank => ({ maxHp: rank, attackDamage: rank, attackSpeed: rank, damageReduction: rank });

// The bot dodges like a skilled player. With the wrench alone it falls near Roco; with two bought elements
// and four key stats at rank 7 (about 780 gears, inside the two-hour budget) it clears the region.
test('a skilled bot falls early with the wrench alone and clears with two elements and four key stats at rank 7', () => {
  for (const seed of [123, 44, 1037]) {
    const bare = playtest(seed, 1500, { loadout: [] });
    assert.equal(bare.mode, 'returned', `Seed ${seed} wrench-only ended in ${bare.mode} at node ${bare.node}`);
    assert.ok(bare.node >= 3 && bare.node <= 6, `Seed ${seed} wrench-only fell at node ${bare.node}`);
    const result = playtest(seed, 1500, { loadout: ['fire', 'ice'], stats: keyStats(7) });
    assert.equal(result.mode, 'complete', `Seed ${seed} failed at node ${result.node} with two elements and key stats at 7`);
    assert.ok(result.baseGears > 0 && result.hp > 0);
  }
});
