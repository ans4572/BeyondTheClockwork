import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, buyRank, rankCap, enterChapter } from '../src/engine/progression.js';

const slice = JSON.parse(await readFile(new URL('../src/data/slice.json', import.meta.url), 'utf8')), data = { slice };

test('every stat goes to 30, ten levels at a time: 10 in chapter 1, 20 on entering chapter 2, 30 on entering chapter 3', () => {
  const profile = createProfile(data), stat = slice.permanentStats[0];
  assert.ok(slice.permanentStats.every(s => s.maxRank === 30));
  profile.freeGears = 1e6;
  while (buyRank(data, profile, stat.id));
  assert.equal(profile.stats[stat.id], 10);
  profile.bossRecords.push('collectorRoco', 'captainBrass');
  assert.equal(rankCap(data, profile, stat), 10, 'beating a boss opens nothing by itself');
  enterChapter(profile, 2);
  while (buyRank(data, profile, stat.id));
  assert.equal(profile.stats[stat.id], 20);
  enterChapter(profile, 3); enterChapter(profile, 2);
  assert.equal(rankCap(data, profile, stat), 30, 'going back to an earlier chapter keeps the levels');
});
