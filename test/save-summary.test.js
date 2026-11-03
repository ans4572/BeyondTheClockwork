import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveSummary } from '../src/engine/storage.js';

const slice = JSON.parse(await readFile(new URL('../src/data/slice.json', import.meta.url), 'utf8')), data = { slice };
const now = new Date(2026, 10, 3, 18, 0);

test('the continue button names where the save stands and when it was written', () => {
  assert.equal(saveSummary({ mode: 'hub', run: null }, new Date(2026, 10, 3, 14, 5).toISOString(), data, now), '웃음 마을 · 오늘 14:05');
  const room = slice.rooms[2].name.replace(/ [A-Z]$/, '');
  assert.equal(saveSummary({ mode: 'combat', run: { node: 2 } }, new Date(2026, 10, 1, 9, 30).toISOString(), data, now), `원정 · ${room} · 11월 1일 9:30`);
  assert.equal(saveSummary({ mode: 'practice', run: null }, null, data, now), '연습장');
});
