import test from 'node:test';
import assert from 'node:assert/strict';
import { playtest } from '../scripts/playtest.mjs';

const tuned = rank => Object.fromEntries(['maxHp', 'attackDamage', 'attackSpeed', 'moveSpeed', 'damageReduction', 'cooldownReduction', 'critChance', 'critDamage', 'dodgeCooldown', 'energyGain', 'statusPower', 'gearGain', 'coinGain'].map(id => [id, rank]));

// The bot dodges like a skilled player. Untuned it should fall partway; it needs tuning around rank 8 to clear.
test('a skilled bot falls partway without tuning and clears all thirteen stages with every stat at rank 8', () => {
  for (const seed of [123, 44, 9813]) {
    const bare = playtest(seed, 1500);
    assert.equal(bare.mode, 'returned', `Seed ${seed} untuned ended in ${bare.mode} at node ${bare.node}`);
    assert.ok(bare.node >= 4 && bare.node < 12, `Seed ${seed} untuned fell at node ${bare.node}`);
    const result = playtest(seed, 1500, { stats: tuned(8) });
    assert.equal(result.mode, 'complete', `Seed ${seed} failed at node ${result.node} with rank 8 tuning`);
    assert.ok(result.baseGears > 0 && result.hp > 0);
  }
});
