import test from 'node:test';
import assert from 'node:assert/strict';
import { playtest } from '../scripts/playtest.mjs';

const tuned = rank => Object.fromEntries(['maxHp', 'attackDamage', 'attackSpeed', 'moveSpeed', 'damageReduction', 'cooldownReduction', 'critChance', 'critDamage', 'dodgeCooldown', 'energyGain', 'statusPower', 'gearGain', 'coinGain'].map(id => [id, rank]));

test('without tuning the input-only bot gets deep but falls before Brass; with every stat at rank 5 it clears all thirteen stages', () => {
  for (const seed of [123, 44, 9813]) {
    const bare = playtest(seed, 1500);
    assert.notEqual(bare.mode, 'combat', `Seed ${seed} got stuck at node ${bare.node}`);
    assert.ok(bare.node >= 8, `Seed ${seed} fell at node ${bare.node} with no tuning`);
    const result = playtest(seed, 1500, { stats: tuned(5) });
    assert.equal(result.mode, 'complete', `Seed ${seed} failed at node ${result.node} with rank 5 tuning`);
    assert.ok(result.baseGears > 0 && result.hp > 0);
  }
});
