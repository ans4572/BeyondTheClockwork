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

test('the server board names the three fastest players, each once by their best clear (2026-11-12)', async () => {
  const db = d1(), ids = ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc', 'dddddddddddddddd'];
  let n = 0; const end = (device, seconds, elements) => record(db, { device, kind: 'runEnd', run: `run-${++n}-1`, difficulty: 'hard', elements, reason: 'clear', node: 12, seconds });
  await record(db, { device: ids[1], kind: 'ping', where: 'hub', node: 0, gears: 0, playSeconds: 10, name: '나사왕' });
  await end(ids[0], 700, ['fire']); await end(ids[0], 650, ['ice', 'wind']); await end(ids[0], 680, ['fire']);
  await end(ids[1], 720, ['sound']); await end(ids[2], 900, ['water']); await end(ids[3], 990, ['wind']);
  const board = (await records(db, ids[2])).hard;
  assert.deepEqual(board.tops.map(t => t.seconds), [650, 720, 900], 'one row a player, their best');
  assert.deepEqual(board.tops[0].elements, ['ice', 'wind'], 'the pair of that best clear');
  assert.equal(board.tops[1].name, '나사왕'); assert.deepEqual(board.tops.map(t => t.mine), [false, false, true]);
  assert.deepEqual(board.top, board.tops[0]); assert.deepEqual((await records(db)).normal.tops, []);
});

test('the end popup asks where a clear would stand: faster other players, counted once each (2026-11-12)', async () => {
  const db = d1(), ids = ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc', 'dddddddddddddddd'];
  let n = 0; const end = (device, seconds) => record(db, { device, kind: 'runEnd', run: `run-${++n}-1`, difficulty: 'hard', elements: ['fire'], reason: 'clear', node: 12, seconds });
  await end(ids[0], 600); await end(ids[0], 640); await end(ids[1], 700); await end(ids[2], 800); await end(ids[3], 750);
  // Device 4 clears again in 720: two players are faster (its own 750 does not count against it).
  const seen = await records(db, ids[3], undefined, { difficulty: 'hard', seconds: 720 });
  assert.deepEqual(seen.hard.standing, { seconds: 720, place: 3, players: 4 }); assert.equal(seen.normal.standing, undefined);
  assert.deepEqual((await records(db, '', undefined, { difficulty: 'hard', seconds: 500 })).hard.standing, { seconds: 500, place: 1, players: 5 });
  assert.equal((await records(db, ids[3], undefined, { difficulty: 'hard', seconds: MIN_CLEAR_SECONDS - 1 })).hard.standing, undefined, 'a too-fast clear gets no place');
});

test('each chapter has its own server board (2026-11-11); runs without a chapter count as chapter 1', async () => {
  const db = d1(), a = 'aaaaaaaaaaaaaaaa';
  await record(db, { device: a, kind: 'runEnd', run: 'run-1-1', difficulty: 'easy', elements: ['fire'], reason: 'clear', node: 12, seconds: 900 });
  await record(db, { device: a, kind: 'runEnd', run: 'run-2-1', difficulty: 'easy', chapter: 'silent-factory', elements: ['ice'], reason: 'clear', node: 14, seconds: 1200 });
  assert.equal((await records(db, a)).easy.top.seconds, 900);
  assert.equal((await records(db, a)).easy.me.clears, 1, 'chapter 2 clears stay off chapter 1');
  const factory = await records(db, a, 'silent-factory');
  assert.equal(factory.easy.top.seconds, 1200); assert.deepEqual(factory.easy.top.elements, ['ice']); assert.equal(factory.easy.me.furthest, 14);
});
