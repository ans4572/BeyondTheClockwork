import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));

// A chapter 2 fight room with nothing in it but F2 and the bodies a test puts there.
function room() {
  const g = new Game(data); g.previews = true; g.s.profile.registered = true; g.s.mode = 'hub'; g.s.profile.cleared = ['smile-street'];
  assert.ok(g.startRun(5, 'normal', 'silent-factory'));
  g.s.run.node = 0; g.enterNode(); g.s.entry = null; g.s.enemies = []; g.s.hazards = []; g.s.casts = []; g.s.run.arrivals = [];
  Object.assign(g.p, { x: 18, y: 14, hp: 1000, maxHp: 1000, dodge: null, invulnerableUntil: 0 });
  return g;
}
const body = (g, type, x, y) => { const e = g.spawnEnemy(type, { x, y }); e.summonUntil = 0; e.aggro = true; return e; };
const strike = (g, e, type) => { g.beginEnemyTell(e, type); g.s.time = e.tell.until; g.executeEnemy(e); };
const fresh = g => { g.p.invulnerableUntil = 0; };

test('a clamp carrier grabs F2 with its pole, holds her, then flings her; a dodge slips free', () => {
  const g = room(), e = body(g, 'clampCarrier', 16, 14), hp = g.p.hp;
  strike(g, e, 'grab');
  assert.ok(g.p.grabbed && g.p.hp < hp, 'held and hurt');
  g.s.time += 1.1; g.tickGrab();
  assert.equal(g.p.grabbed, null); assert.ok(g.p.blown, 'flung');
  fresh(g); g.p.blown = null; strike(g, e, 'grab'); assert.ok(g.p.grabbed);
  g.p.dodge = { elapsed: 0, angle: 0, x: g.p.x, y: g.p.y }; g.tickGrab(); assert.equal(g.p.grabbed, null, 'dodged free');
});

test('a stamp inspector leaps onto F2, leaves a red reject mark that slows her, and sticks a moment', () => {
  const g = room(), e = body(g, 'stampInspector', 15, 14), hp = g.p.hp;
  strike(g, e, 'leap');
  assert.ok(Math.hypot(e.x - 18, e.y - 14) < 0.5, 'landed on her spot'); assert.ok(g.p.hp < hp);
  assert.ok(g.patchSlow(g.p) > 0, 'the mark slows'); assert.ok(e.plantedUntil > g.s.time, 'stuck');
  assert.equal(g.patchSlow(e, true), 0, 'enemies are not slowed by stamps');
});

test('a press guard that runs into a wall is dazed and takes more', () => {
  const g = room(), e = body(g, 'pressGuard', 16, 14);
  e.dash = { angle: 0, elapsed: 0.1 };
  assert.ok(g.factoryDash(e, { x: e.x, y: e.y }, 1 / 60), 'stopped short');
  assert.ok(e.stunUntil > g.s.time && e.dazedUntil > g.s.time);
  const before = e.hp; g.hitEnemy(e, 100, { dot: true }); assert.equal(before - e.hp, 130);
});

test('a lens inspector turns its light after F2, and its beam marks her so the next blow hurts more', () => {
  const g = room(), e = body(g, 'lensInspector', 12, 14);
  g.beginEnemyTell(e, 'searchlight'); e.tell.angle = 1; g.factoryStep(e, 0.5);
  assert.ok(e.tell.angle < 1, 'turned toward F2');
  e.tell.angle = 0; g.s.time = e.tell.until; g.executeEnemy(e);
  assert.ok(g.p.markedUntil > g.s.time);
  fresh(g); const hp = g.p.hp; g.hurt(10); assert.equal(hp - g.p.hp, 12); assert.equal(g.p.markedUntil, 0);
});

test('a riveter kneels and fires three rivets in a fan; those that come down stay in the floor and sting', () => {
  const g = room(), e = body(g, 'riveter', 12, 14);
  g.p.y = 20; strike(g, e, 'rivets');
  assert.equal(g.s.projectiles.length, 3); assert.ok(e.plantedUntil > g.s.time);
  g.s.time += 2; g.updateProjectiles(1 / 60);
  const screws = g.s.casts.filter(c => c.shape === 'floorMark' && c.look === 'screw');
  assert.equal(screws.length, 3);
  Object.assign(g.p, { x: screws[0].x, y: screws[0].y }); fresh(g); const hp = g.p.hp; g.tickPatches(1 / 60); assert.ok(g.p.hp < hp, 'stepping on one stings');
});

test('a tape packer lays sticky tape behind its run that slows F2 and enemies, and fire burns it away', () => {
  const g = room(), e = body(g, 'tapePacker', 10, 14);
  e.dash = { angle: 0, elapsed: 0.1 };
  for (let i = 0; i < 6; i++) { const start = { x: e.x, y: e.y }; e.x += 0.3; g.factoryDash(e, start, 1 / 60); }
  const tape = g.s.casts.filter(c => c.look === 'tape'); assert.ok(tape.length >= 2);
  assert.ok(g.patchSlow(tape[0], true) > 0, 'slows enemies too');
  g.elementOnPatches({ elements: ['fire'] }, () => true); g.tickPatches(0);
  assert.equal(g.s.casts.filter(c => c.look === 'tape').length, 0);
});

test('an oiler flings an oil slick that F2 slides on; fire or a steam burst sets it alight and it burns everyone in it', () => {
  const g = room(), e = body(g, 'oiler', 14, 14), foe = body(g, 'clampCarrier', 18.4, 14);
  strike(g, e, 'oil');
  const oil = g.patchUnder(g.p, 'oil'); assert.ok(oil && oil.slide);
  g.elementOnPatches({ elements: ['fire'] }, () => true); assert.ok(oil.burningUntil > g.s.time);
  fresh(g); const hp = g.p.hp, foeHp = foe.hp; g.tickPatches(1 / 60);
  assert.ok(g.p.hp < hp && foe.hp < foeHp, 'burns F2 and the enemy');
  g.elementOnPatches({ elements: ['water'] }, () => true); g.tickPatches(0); assert.equal(g.patchUnder(g.p, 'oil'), undefined, 'water washes it');
});

test('a parts supplier coats two nearby bodies in brass; hit while opening its crate it spills coins instead', () => {
  const g = room(), e = body(g, 'partsSupplier', 14, 14), a = body(g, 'pressGuard', 15, 14), b = body(g, 'clampCarrier', 14, 15), far = body(g, 'riveter', 25, 20);
  strike(g, e, 'supply');
  assert.ok(a.coatedUntil > g.s.time && b.coatedUntil > g.s.time); assert.ok(!(far.coatedUntil > g.s.time));
  const before = a.hp; g.hitEnemy(a, 100, { dot: true }); assert.equal(before - a.hp, 70);
  g.beginEnemyTell(e, 'supply'); const coins = g.s.run.coins; g.hitEnemy(e, 1, {});
  assert.equal(e.tell, null, 'cancelled'); assert.ok(g.s.run.coins > coins, 'coins spilled');
});

test('a compression captain dashes twice, and the chapter 2 traits work: reinspect stands it up once, standardizing hurries its neighbours', () => {
  const g = room(), e = body(g, 'pressCaptain', 12, 14);
  g.factoryDashDone(e, { second: false }); assert.equal(e.followup?.type, 'dash2');
  g.giveAffixes(e, [{ id: 'reinspect' }]); g.hitEnemy(e, 1e6, { dot: true });
  assert.ok(e.hp > 0 && e.reviveUntil > g.s.time, 'stood up again');
  g.s.time = e.reviveUntil + 0.1; g.hitEnemy(e, 1e6, { dot: true }); assert.ok(e.hp <= 0, 'only once');
  const c2 = body(g, 'pressCaptain', 20, 14), guard = body(g, 'pressGuard', 21, 14);
  g.giveAffixes(c2, [{ id: 'standardized' }]); assert.equal(g.standardFactor(guard), 0.7);
  const traits = g.config.eliteAffixes.list.filter(a => a.chapter).map(a => a.id);
  assert.deepEqual(traits.sort(), ['reinspect', 'standardized']);
});

test('chapter 1 runs never deal the chapter 2 traits', () => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(9);
  const all = g.s.run.plan.flatMap(n => (n.affixes || []).flat(2)).filter(Boolean).map(a => a.id);
  assert.ok(!all.includes('standardized') && !all.includes('reinspect'));
});
