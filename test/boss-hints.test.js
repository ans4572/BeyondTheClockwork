import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';

const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));

test('a chapter 2 shield is only named the first time; how to break it comes after it has once failed', () => {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.godMode = true;
  const said = [], notify = g.notify.bind(g); g.notify = text => { said.push(text); return notify(text); };
  g.debugJump(4, 'silent-factory');
  for (let i = 0; i < 400 && !g.s.enemies.some(e => e.boss); i++) g.update(1 / 60, {});
  const iris = g.s.enemies.find(e => e.boss);
  const raise = () => { iris.summonUntil = 0; iris.tell = null; for (let k = 0; k < 40 && !iris.breaking; k++) { g.hitEnemy(iris, iris.maxHp * 0.03, { exact: true }); g.update(1 / 60, {}); } };
  raise();
  assert.equal(iris.breaking?.kind, 'mirrors');
  assert.ok(said.includes('아이리스: 제 빛을 되돌릴 수 있다면, 해 보세요.')); assert.ok(!said.some(text => text.includes('거울판을 렌치로')), 'no how-to the first time');
  iris.breaking.failAt = g.s.time; g.update(1 / 60, {});
  raise();
  assert.match(said.filter(text => text.startsWith('보호막!')).at(-1), /거울판을 렌치로/);
});

test('striking an Iris decoy stuns F2 for a second: no step, swing or dodge until it wears off', () => {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.godMode = true;
  g.debugJump(4, 'silent-factory');
  for (let i = 0; i < 400 && !g.s.enemies.some(e => e.boss); i++) g.update(1 / 60, {});
  const iris = g.s.enemies.find(e => e.boss), p = g.p;
  // A decoy right in front of F2, who faces it.
  iris.decoys = [{ x: p.x + 1, y: p.y }]; p.angle = 0;
  g.fbSwing({ angle: 0 }, 1.5);
  assert.ok(iris.decoys[0].popped);
  assert.ok(Math.abs(p.stunUntil - g.s.time - 1) < 1e-9);
  assert.equal(g.basicAttack(), false); assert.equal(g.dodge(), false);
  const x = p.x; g.update(1 / 60, { x: 1 }); assert.equal(p.x, x, 'the feet stay put');
  for (let i = 0; i < 70; i++) g.update(1 / 60, {});
  assert.ok(!g.stunned); assert.equal(g.dodge(), true);
});
