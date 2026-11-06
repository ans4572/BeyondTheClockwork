import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { noteRecord, cleanRecords, mergeMine, formatClock, MIN_CLEAR_SECONDS } from '../src/engine/records.js';
import { record, records } from '../worker/stats.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args).map(row => ({ ...row })) }),
    first: async () => { const row = db.prepare(sql).get(...args); return row ? { ...row } : null; }
  });
  return { prepare: sql => statement(sql), batch: async list => { const out = []; for (const s of list) out.push(await s.all()); return out; } };
}

test('a clear sets the best time and its element pair only when faster; any run can reach further', () => {
  const r = {};
  noteRecord(r, { reason: 'defeat', difficulty: 'hard', node: 9, elapsed: 500, elements: ['fire'] });
  assert.deepEqual(r.hard, { best: null, elements: [], clears: 0, furthest: 9 });
  noteRecord(r, { reason: 'clear', difficulty: 'normal', node: 12, elapsed: 900.4, elements: ['fire', 'wind'] });
  noteRecord(r, { reason: 'clear', difficulty: 'normal', node: 12, elapsed: 1000, elements: ['ice', 'lightning'] });
  assert.deepEqual(r.normal, { best: 900, elements: ['fire', 'wind'], clears: 2, furthest: 12 });
  noteRecord(r, { reason: 'clear', difficulty: 'normal', node: 12, elapsed: 800, elements: ['ice'] });
  assert.deepEqual(r.normal.elements, ['ice']); assert.equal(r.normal.best, 800);
});

test('an old save gets records from its history, and odd saved values are dropped', () => {
  const history = [{ reason: 'clear', difficulty: 'easy', node: 12, elapsed: 700, elements: ['fire', 'ice'] }, { reason: 'defeat', difficulty: 'easy', node: 5, elapsed: 200, elements: [] }];
  assert.deepEqual(cleanRecords(undefined, history).easy, { best: 700, elements: ['fire', 'ice'], clears: 1, furthest: 12 });
  assert.deepEqual(cleanRecords({ hard: { best: -3, elements: ['earth'], clears: 'x', furthest: 4 } }).hard, { best: null, elements: [], clears: 0, furthest: 4 });
});

test('the own record takes the better of the save and the server; clocks read as minutes', () => {
  assert.equal(mergeMine({ best: 900, elements: ['fire'], clears: 1, furthest: 12 }, { best: 850, elements: ['ice'], clears: 3, furthest: 12 }).best, 850);
  assert.deepEqual(mergeMine({ best: null, elements: [], clears: 0, furthest: 9 }, null).furthest, 9);
  assert.equal(formatClock(754), '12:34'); assert.equal(formatClock(3723), '1:02:03');
});

test('the server board: fastest real clear per difficulty with its name, never a device id; too-fast clears are skipped', async () => {
  const db = d1(), a = 'aaaaaaaaaaaaaaaa', b = 'bbbbbbbbbbbbbbbb', end = (device, run, difficulty, seconds, elements, reason = 'clear', node = 12) => record(db, { device, kind: 'runEnd', run, difficulty, elements, reason, node, seconds });
  await record(db, { device: a, kind: 'ping', where: 'hub', node: 0, gears: 0, playSeconds: 10, name: '톱니왕' });
  await end(a, 'run-1-1', 'normal', 700, ['fire', 'wind']);
  await end(b, 'run-1-2', 'normal', 820, ['ice']);
  await end(b, 'run-2-2', 'normal', MIN_CLEAR_SECONDS - 1, ['ice']);
  await end(b, 'run-3-2', 'hard', 400, ['lightning'], 'defeat', 9);
  const seen = await records(db, b);
  assert.deepEqual(seen.normal.top, { seconds: 700, elements: ['fire', 'wind'], name: '톱니왕', mine: false });
  assert.deepEqual(seen.normal.me, { best: 820, elements: ['ice'], clears: 2, furthest: 12 });
  assert.equal(seen.hard.top, null); assert.equal(seen.hard.me.furthest, 9);
  assert.ok(!JSON.stringify(seen).includes(a), 'no device id leaves the server');
  assert.equal((await records(db, a)).normal.top.mine, true);
  assert.equal((await records(db)).normal.me, null);
});
