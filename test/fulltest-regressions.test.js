// Bugs found by the full-game test of 2026-11-22, each kept from coming back.
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { pressState } from '../src/engine/hazards.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(async name => [name, await load(name)]))));
const newGame = (seed = 7, chapter) => {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  g.startRun(seed, 'normal', chapter); return g;
};

test('the walk to the portal runs the clock once, not twice', () => {
  const g = newGame(5);
  for (const e of g.s.enemies) e.hp = 0; g.s.run.wave = 99; g.s.run.arrivals = [];
  g.finishCombat(); if (g.s.mode === 'unwind') g.unwind(); g.chooseReward(0, 0);
  const t0 = g.s.time;
  for (let i = 0; i < 120; i++) g.update(1 / 60, { x: 0.001 });
  assert.ok(Math.abs(g.s.time - t0 - 2) < 0.02, `2 s of walking moved the clock ${(g.s.time - t0).toFixed(3)} s`);
});

test('F2\'s skills reach the floor patches (oil, tape, stamps): they are not taken out of the list while casts run', () => {
  const g = newGame(3, 'silent-factory');
  g.s.run.slots = [{ element: 'fire', level: 1, rarity: 'common' }, { element: 'ice', level: 1, rarity: 'common' }];
  for (let i = 0; i < 300; i++) g.update(1 / 60, {});
  let calls = 0, saw = 0; const orig = g.elementOnPatches;
  g.elementOnPatches = function (cast, touches) { calls++; if (this.s.casts.some(c => c.shape === 'floorMark')) saw++; return orig.call(this, cast, touches); };
  g.addPatch({ look: 'oil', x: g.p.x + 2, y: g.p.y, radius: 1.2, duration: 30, slide: true, burn: { seconds: 3, damage: 1, tick: 0.5 } });
  for (let k = 0; k < 4; k++) { g.p.cooldowns = {}; g.p.energy = 100; g.update(1 / 60, { skill: k, aim: { x: g.p.x + 2, y: g.p.y } }); for (let i = 0; i < 60; i++) g.update(1 / 60, {}); }
  // (A patch burnt away is rightly gone for the last few looks; before the fix it was seen in none.)
  assert.ok(calls > 0 && saw >= calls * 0.9, `the patch was seen in ${saw} of ${calls} looks`);
});

test('ice holds the press on every cycle, not only the first in a room', () => {
  const g = newGame(3, 'silent-factory');
  const r = g.config.hazards.press, cycle = r.idle + r.warn + r.block;
  const h = { id: 'p1', kind: 'press', x: 10, y: 10, w: r.w, h: r.h, offset: 0 };
  g.s.hazards = [h];
  for (let round = 0; round < 3; round++) {
    const n0 = pressState(h, g.s.time, r).n;
    g.elementOnHazards({ elements: ['ice'] }, () => true);
    let slammed = false; const until = g.s.time + cycle;
    while (g.s.time < until) { g.s.time += 0.05; const now = pressState(h, g.s.time, r); if (now.state === 'slam' && now.n === n0) slammed = true; }
    assert.equal(slammed, false, `cycle ${n0} still slammed`);
  }
});

test('a fusion refused for want of a target says so once per press, not every frame of the input buffer', () => {
  const g = newGame(5);
  g.s.run.slots = [{ element: 'light', level: 1, rarity: 'common' }, { element: 'sound', level: 1, rarity: 'common' }];
  for (let i = 0; i < 200; i++) g.update(1 / 60, {});
  g.s.enemies.forEach(e => { e.x = 2; e.y = 2; e.summonUntil = 0; e.ready = 1e9; e.speed = 0; });
  g.p.energy = g.c.player.maxEnergy; g.s.notices = [];
  g.update(1 / 60, { fusion: true, aim: { x: g.p.x + 3, y: g.p.y } });
  for (let i = 0; i < 20; i++) g.update(1 / 60, { aim: { x: g.p.x + 3, y: g.p.y } });
  assert.ok(g.s.notices.length <= 1, `${g.s.notices.length} notices`);
});

test('a new run drops the paid-room marks of runs gone by', () => {
  const g = newGame(5);
  g.s.profile.rewards.push('run-0-1:stop-02', 'run-0-1:stop-03');
  g.returnToHub('abandon'); g.s.mode = 'hub';
  g.startRun(9, 'normal');
  assert.deepEqual(g.s.profile.rewards, []);
});
