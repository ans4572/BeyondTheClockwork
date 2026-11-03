import test from 'node:test';
import assert from 'node:assert/strict';
import { playtest } from '../scripts/playtest.mjs';

const keyStats = rank => ({ maxHp: rank, attackDamage: rank, attackSpeed: rank, damageReduction: rank });

// The bot dodges like a skilled player. With the wrench alone it falls near Roco; with two bought elements
// and four key stats at rank 8 (about 960 gears, the top of the two-hour budget) it clears the region.
test('a skilled bot falls early with the wrench alone and clears with two elements and four key stats at rank 8', () => {
  for (const seed of [42, 9813, 3]) {
    const bare = playtest(seed, 1500, { loadout: [] });
    // With the wrench alone the bot either falls or keeps dodging without finishing a room; it never gets far.
    assert.notEqual(bare.mode, 'complete', `Seed ${seed} cleared with the wrench alone`);
    assert.ok(bare.node >= 3 && bare.node <= 9, `Seed ${seed} wrench-only stopped at node ${bare.node}`);
    const result = playtest(seed, 1500, { loadout: ['fire', 'ice'], stats: keyStats(8) });
    assert.equal(result.mode, 'complete', `Seed ${seed} failed at node ${result.node} with two elements and key stats at 8`);
    assert.ok(result.baseGears > 0 && result.hp > 0);
  }
});
