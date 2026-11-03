import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, buyRank, rankCap } from '../src/engine/progression.js';

const slice = JSON.parse(await readFile(new URL('../src/data/slice.json', import.meta.url), 'utf8')), data = { slice };

test('every stat goes to 30, ten levels at a time: 10 at first, 20 once Brass ends chapter 1', () => {
  const profile = createProfile(data), stat = slice.permanentStats[0];
  assert.ok(slice.permanentStats.every(s => s.maxRank === 30));
  profile.freeGears = 1e6;
  while (buyRank(data, profile, stat.id));
  assert.equal(profile.stats[stat.id], 10);
  profile.bossRecords.push('collectorRoco');
  assert.equal(rankCap(data, profile, stat), 10, 'a mid boss opens nothing');
  profile.bossRecords.push('captainBrass');
  while (buyRank(data, profile, stat.id));
  assert.equal(profile.stats[stat.id], 20);
  // A third chapter boss would open the last ten.
  const later = { slice: { ...slice, statChapters: { ...slice.statChapters, chapterBosses: ['captainBrass', 'nextBoss'] } } };
  profile.bossRecords.push('nextBoss');
  assert.equal(rankCap(later, profile, stat), 30);
});
