import test from 'node:test';
import assert from 'node:assert/strict';
import { playtest } from '../scripts/playtest.mjs';

const keyStats = rank => ({ maxHp: rank, attackDamage: rank, attackSpeed: rank, damageReduction: rank });

// The bot dodges like a skilled player. Since the difficulty went up (2026-11-04: Roco 900, Brass 1800, rooms at
// 0.8-1.2 power, an elite in every wave after the rest stop) the wrench alone falls early, rank 8 in four key stats
// falls in the elite rooms, and with more music boxes (2026-11-04) even rank 16 is stopped in the later rooms: the bot only checks that the run gets past Roco.
test('a skilled bot falls early with the wrench alone, and at rank 16 gets past Roco into the rooms after the shop', () => {
  let cleared = 0;
  for (const seed of [101, 11, 3]) {
    const bare = playtest(seed, 1500, { loadout: [] });
    assert.notEqual(bare.mode, 'complete', `Seed ${seed} cleared with the wrench alone`);
    assert.ok(bare.node >= 1 && bare.node <= 9, `Seed ${seed} wrench-only stopped at node ${bare.node}`);
    assert.notEqual(playtest(seed, 3000, { loadout: ['fire', 'ice'], stats: keyStats(8) }).mode, 'complete', `Seed ${seed} cleared at rank 8`);
    const strong = playtest(seed, 3000, { loadout: ['fire', 'ice'], stats: keyStats(16) });
    if (strong.mode === 'complete' || strong.node >= 7) cleared++;
  }
  // 2026-11-05: bosses 1500 / 2500, mobs 10% faster and 1.5x damage; one seed in three may now stop rank 16 early.
  assert.ok(cleared >= 2, `only ${cleared} of 3 seeds got past Roco at rank 16`);
});
