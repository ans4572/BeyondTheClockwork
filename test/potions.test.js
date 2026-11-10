import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(async name => [name, await load(name)]))));
const oils = Object.fromEntries(data.slice.potions.list.map(p => [p.id, p]));
// The town after chapter 2 is beaten, with gears to spend.
const town = (beaten = true) => { const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; if (beaten) g.s.profile.cleared = ['smile-street', 'silent-factory']; g.s.profile.freeGears = 200; return g; };

test('Nasa stands at the workshop only once the factory is beaten, and his shelf opens from him', () => {
  const before = town(false); before.s.profile.cleared = ['smile-street'];
  assert.ok(!before.hubMap.npcs.some(n => n.character === 'nasa')); assert.equal(before.buyPotion('attack'), false);
  const after = town(); const nasa = after.hubMap.npcs.find(n => n.character === 'nasa');
  assert.ok(nasa); assert.equal(nasa.opens, 'potions'); assert.equal(after.hubMap.npcs[0].character, 'moru', 'Moru stays first');
  assert.ok(data.dialogue.scripts.nasaMeet.length && data.dialogue.scripts.nasa.at(-1).choices.some(c => c.id === 'open'));
});

test('one bottle at a time: buying another swaps it with a full refund, and it can be put back', () => {
  const g = town();
  assert.ok(g.buyPotion('attack')); assert.equal(g.s.profile.freeGears, 200 - oils.attack.cost);
  assert.equal(g.buyPotion('attack'), false, 'already held');
  assert.ok(g.buyPotion('spare')); assert.equal(g.s.profile.potion, 'spare'); assert.equal(g.s.profile.freeGears, 200 - oils.spare.cost);
  assert.ok(g.returnPotion()); assert.equal(g.s.profile.potion, null); assert.equal(g.s.profile.freeGears, 200);
  g.s.profile.freeGears = 10; assert.equal(g.buyPotion('boss'), false, 'not enough gears');
});

test('the bottle is drunk on setting out and lasts that run only: damage, health, a full charge', () => {
  const g = town(); const plainHp = g.c.player.maxHp + (g.stats.maxHp || 0), plainHit = g.stats.attackDamage || 0;
  g.buyPotion('health'); g.startRun(5);
  assert.equal(g.s.run.potion, 'health'); assert.equal(g.s.profile.potion, null, 'left the shelf');
  assert.equal(g.p.maxHp, plainHp + oils.health.maxHp); assert.equal(g.p.hp, g.p.maxHp);
  const a = town(); a.buyPotion('attack'); a.startRun(5); assert.ok(Math.abs((a.stats.attackDamage || 0) - plainHit - oils.attack.attackDamage) < 1e-9);
  const e = town(); e.buyPotion('energy'); e.startRun(5); assert.equal(e.p.energy, e.c.player.maxEnergy);
  const none = town(); none.startRun(5); assert.equal(none.potion, null); assert.equal(none.p.energy, 0);
});

test('brass oil hits bosses and elites harder; a spare spring lifts F2 once', () => {
  const plain = town(), oiled = town(); oiled.buyPotion('boss');
  for (const g of [plain, oiled]) { g.startRun(5); g.s.enemies = []; }
  const hit = g => { const e = g.spawnEnemy('captainBrass', { x: g.p.x + 1, y: g.p.y }); e.boss = true; const hp = e.hp; g.hitEnemy(e, 100, { exact: false }); return hp - e.hp; };
  const a = hit(plain), b = hit(oiled);
  assert.ok(Math.abs(b / a - (1 + oils.boss.bossDamage)) < 0.02, `${a} -> ${b}`);
  const g = town(); g.buyPotion('spare'); g.startRun(5);
  g.p.invulnerableUntil = 0; g.p.hp = 5; g.hurt(50);
  assert.equal(g.p.hp, Math.round(g.p.maxHp * oils.spare.revive)); assert.ok(!g.s.downUntil, 'back up, not carried home');
  g.p.invulnerableUntil = 0; g.p.hp = 5; g.hurt(50); assert.ok(g.s.downUntil, 'only once');
});

test('a bottle waiting on the shelf survives a reload; an unknown one is dropped', () => {
  const g = town(); g.buyPotion('energy');
  const saved = JSON.parse(encodeSave(g.s));
  assert.equal(decodeSave(JSON.stringify(saved), data).profile.potion, 'energy');
  saved.state.profile.potion = 'moonshine'; assert.equal(decodeSave(JSON.stringify(saved), data).profile.potion, null);
});
