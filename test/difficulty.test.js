import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';
import { dealHazards } from '../src/engine/hazards.js';
import { placeOf } from '../src/engine/map-geometry.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));
const { levels } = data.slice.difficulty;
const runOn = (difficulty, node = 0) => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.s.panel = 'difficulty';
  assert.ok(g.depart(difficulty)); g.s.run.node = node; g.enterNode(); return g;
};

test('three difficulties: normal 0.9 of the tuning, easy and hard 40% below and above it, with loot to match', () => {
  assert.deepEqual(levels.map(l => [l.id, l.scale, l.loot]), [['easy', 0.54, 0.54], ['normal', 0.9, 0.9], ['hard', 1.26, 1.26]]);
  assert.equal(data.slice.difficulty.default, 'normal');
});

test('enemies and bosses take the difficulty’s health and attack', () => {
  const guard = data.slice.enemies.guard, power = data.slice.rooms[0].power, share = data.slice.rules.waveDamageShare;
  for (const { id, scale } of levels) {
    const g = runOn(id), first = g.spawnWaveEnemy('guard', { x: 10, y: 10 });
    assert.equal(first.maxHp, Math.round(Math.round(guard.hp * scale) * power), id);
    assert.equal(first.damage, Math.max(1, Math.round(Math.round(guard.damage * scale) * power * share)), id);
    const roco = runOn(id, data.slice.rooms.findIndex(r => r.boss === 'collectorRoco')).s.enemies.find(e => e.boss);
    assert.equal(roco.maxHp, Math.round(data.combat.bosses.find(b => b.id === 'collectorRoco').hp * scale), `${id} boss`);
  }
  const easy = runOn('easy').spawnEnemy('guard', { x: 10, y: 10 }), hard = runOn('hard').spawnEnemy('guard', { x: 10, y: 10 });
  assert.ok(hard.maxHp > easy.maxHp * 1.9 && hard.damage > easy.damage, 'hard is twice easy');
});

test('rooms get fewer pieces of furniture on easy and more on hard', () => {
  const rules = data.slice.hazards, room = data.slice.rooms.find(r => r.waves), map = placeOf(data.maps, data.maps.maps[room.id]);
  const total = scale => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((sum, seed) => sum + dealHazards(map, rules, seed, Infinity, scale).length, 0);
  const [easy, normal, hard] = levels.map(l => total(l.scale));
  assert.ok(easy < normal && normal < hard, `${easy} ${normal} ${hard}`);
});

test('each kill pays the difficulty’s share of the room’s loot', () => {
  const paid = {};
  for (const { id } of levels) {
    const g = runOn(id), before = { gears: g.s.profile.freeGears, coins: g.s.run.coins };
    for (let i = 0; i < g.room.waves.flat().length; i++) g.payKill(g.s.enemies[0]);
    paid[id] = g.s.run.coins - before.coins + g.s.profile.freeGears - before.gears;
    const full = g.roomLoot(), base = new Game(data).data.progression.economy.runCoinRewards.normal;
    assert.equal(full.coins, Math.round(base * g.difficulty.loot * (1 + (g.stats.coinGain || 0))), id);
  }
  assert.ok(paid.easy < paid.normal && paid.normal < paid.hard, JSON.stringify(paid));
});

test('the run keeps its difficulty through a save, an older run plays as normal, and the stats events carry it', () => {
  const g = runOn('easy'), heard = [];
  assert.equal(decodeSave(encodeSave(g.s), data).run.difficulty, 'easy');
  const old = JSON.parse(encodeSave(g.s)); delete old.state.run.difficulty;
  assert.equal(decodeSave(JSON.stringify(old), data).run.difficulty, 'normal');
  const h = new Game(data); h.onRun = (kind, fields) => heard.push({ kind, ...fields }); h.s.profile.registered = true; h.s.mode = 'hub'; h.s.panel = 'difficulty';
  h.depart('hard'); h.returnToHub('defeat');
  assert.deepEqual(heard.map(e => e.difficulty), ['hard', 'hard']);
  assert.equal(h.s.result.difficulty, 'hard');
});
