// Light and magnet (docs/design/light-magnet-concepts.md): 드러냄 and 쇳가루, the four skills, a few cards and fusion rules.
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';

const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))]))));
data.combat.caps.damageSpread = 0;
data.combat.player.critChance = 0;
Object.assign(data.slice.difficulty.levels.find(level => level.id === data.slice.difficulty.default), { scale: 1, loot: 1 });
const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60, input); };
const arena = (elements = ['light', 'magnet']) => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.s.run.plan[0].layout = 2;
  g.s.run.slots = elements.map(element => ({ element, level: 1, rarity: 'common' })); Object.assign(g.p, { x: 8, y: 8, angle: 0, energy: 100 }); return g;
};
const dummy = (g, x = 9, y = 8, type = 'guard') => { const e = g.spawnEnemy(type, { x, y }); e.ready = 1e9; e.speed = 0; e.hp = e.maxHp = 1e5; return e; };
const lost = e => e.maxHp - e.hp;
const cast = (g, id, target = { x: 11, y: 8 }) => { const skill = data.combat.skills.find(s => s.id === id); g.makeCast(skill, data.slice.skillBehavior[id], { level: 1, rarity: 'common' }, target, false); return g.s.casts.at(-1); };

test('light and magnet are on the published shelf from the start, like the other elements (2026-11-22)', () => {
  const g = new Game(data);
  assert.equal(g.previews, false);
  for (const id of ['light', 'magnet']) { assert.equal(g.elementShown(id), true); assert.equal(g.elementOpen(id), true); }
});

test('드러냄: a revealed body is crit 15% more often and 0.3 harder; 맑은 렌즈 adds 10% and 2 seconds', () => {
  const g = arena(), e = dummy(g);
  assert.deepEqual(g.revealCrit(e), { chance: 0, size: 0 });
  g.applyStatus(e, 'light', { id: 'a', staggerUsed: {} });
  assert.deepEqual(g.revealCrit(e), { chance: 0.15, size: 0.3 }); assert.equal(e.statuses.reveal, g.s.time + 4);
  g.s.run.traits = ['clearLens']; g.applyStatus(e, 'light', { id: 'b', staggerUsed: {} });
  assert.ok(Math.abs(g.revealCrit(e).chance - 0.25) < 1e-9); assert.equal(e.statuses.reveal, g.s.time + 6);
});

test('쇳가루: one layer a cast, four at most; the next magnet blow sets the dust for 50, stiffening an ordinary body (not a boss)', () => {
  const g = arena(), e = dummy(g), c = { id: 'c', staggerUsed: {}, fusion: false };
  g.applyStatus(e, 'magnet', c); g.applyStatus(e, 'magnet', c);
  assert.equal(g.ironDustOf(e), 1, 'a second blow of the same cast adds nothing');
  for (const id of ['d', 'e', 'f', 'g']) g.applyStatus(e, 'magnet', { id, staggerUsed: {} });
  assert.equal(g.ironDustOf(e), 4);
  const before = lost(e); g.lmIronHit(e); assert.equal(g.ironDustOf(e), 0); assert.ok(e.stunUntil > g.s.time + 0.7 && e.ironSetUntil > g.s.time); assert.equal(lost(e) - before, 50);
  for (const id of ['h', 'i', 'j', 'k']) g.applyStatus(e, 'magnet', { id, staggerUsed: {} });
  g.lmIronHit(e); assert.equal(g.ironDustOf(e), 4, 'a body set less than four seconds ago is not set again');
  const boss = dummy(g, 12, 8, 'captainBrass');
  for (const id of ['l', 'm', 'n', 'o']) g.applyStatus(boss, 'magnet', { id, staggerUsed: {} });
  g.lmIronHit(boss); assert.equal(lost(boss), 50, 'the set hurts a boss too'); assert.ok(!(boss.stunUntil > g.s.time + 0.5), 'a boss does not stiffen');
});

test('프리즘 광선 runs through every body on its line and reveals them; 분광 splits it at the end', () => {
  const g = arena(), a = dummy(g, 9, 8), b = dummy(g, 12, 8), off = dummy(g, 9, 11);
  cast(g, 'prismBeam'); step(g, 0.05);
  assert.equal(lost(a), 48); assert.equal(lost(b), 48); assert.equal(lost(off), 0);
  assert.ok(g.revealed(a) && g.revealed(b));
  const h = arena(), far = dummy(h, 16.2, 8.6); h.s.run.skillMods = ['splitBeam'];
  cast(h, 'prismBeam'); step(h, 0.05);
  assert.ok(lost(far) > 0 && lost(far) < 48, `the split's branch reaches past the end for 40%: ${lost(far)}`);
});

test('섬광탄 bursts where it lands, blinds ordinary bodies, not bosses', () => {
  const g = arena(), e = dummy(g, 11, 8), boss = dummy(g, 12.5, 8, 'captainBrass');
  cast(g, 'flashBomb'); step(g, 0.5); assert.equal(lost(e), 0, 'still in the air');
  step(g, 0.2); assert.equal(lost(e), 96); assert.ok(e.blindUntil > g.s.time && e.stunUntil > g.s.time);
  assert.ok(lost(boss) > 0 && !(boss.blindUntil > g.s.time));
});

test('고철 산탄: five pellets that go through one body, one 쇳가루 layer; 대구경 is one slug through three bodies', () => {
  const g = arena(), e = dummy(g, 9.5, 8);
  cast(g, 'scrapShot'); step(g, 0.4);
  assert.equal(lost(e), 65); assert.equal(g.ironDustOf(e), 1);
  const h = arena(), a = dummy(h, 9.5, 8), b = dummy(h, 11, 8), c = dummy(h, 12.5, 8); h.s.run.skillMods = ['heavySlug'];
  cast(h, 'scrapShot'); step(h, 0.5);
  assert.equal(lost(a), 85); assert.equal(lost(b), 85); assert.equal(lost(c), 85); assert.equal(h.ironDustOf(a), 2);
  const k = arena(), front = dummy(k, 9.5, 8), behind = dummy(k, 10.5, 8);
  cast(k, 'scrapShot'); step(k, 0.5);
  assert.equal(lost(front), 65); assert.ok(lost(behind) > 0, 'a pellet goes on through the first body');
});

test('끌어올리기 slams after 0.65 s for 90 and two layers; 따라가는 자기장 follows the cursor up to 3 units', () => {
  const g = arena(), e = dummy(g, 11, 8);
  cast(g, 'magneticLift'); step(g, 0.55); assert.equal(lost(e), 0);
  step(g, 0.2); assert.equal(lost(e), 90); assert.equal(g.ironDustOf(e), 2);
  const h = arena(), far = dummy(h, 11, 13); h.s.run.skillMods = ['trackingField'];
  const lift = cast(h, 'magneticLift'); step(h, 1.1, { aim: { x: 11, y: 14 } });
  assert.ok(Math.hypot(lift.x - 11, lift.y - 8) <= 3 + 1e-6, 'no further than 3 from where it began');
  assert.ok(lost(far) >= 90 || lift.y > 10.5, `followed the cursor to ${lift.y}`);
});

test('울리는 쇠줄 holds on a boss that moves, and a lone boss gets the whole fusion from the sun, the vine and the aurora', () => {
  for (const [pair, id] of [[['magnet', 'sound'], 'ironString'], [['fire', 'light'], 'noonMark'], [['magnet', 'water'], 'ferroVine'], [['light', 'magnet'], 'auroraRing']]) {
    const g = arena(pair), boss = dummy(g, 11, 8, 'captainBrass'); g.p.energy = 100;
    assert.equal(g.fusion.id, id); assert.equal(g.castFusion(boss), true);
    step(g, 0.3); boss.y = 8.6; step(g, 4);
    const f = data.combat.fusions.find(x => x.id === id), passing = id === 'ferroVine' ? f.travelDamage : 0;
    assert.ok(lost(boss) >= f.totalDirectDamage - passing - 1e-6, `${id}: ${lost(boss)}`);
  }
});

test('공명 별자리 on a lone body joins it to F2; 굴절 광선 bends on to a second body', () => {
  const g = arena(['light', 'sound']), e = dummy(g, 11, 8);
  g.castFusion(e); step(g, 2.5);
  // (공명 from the sound half makes the later rings land a little harder.)
  assert.ok(lost(e) >= 5 * data.combat.fusions.find(f => f.id === 'lightConstellation').damagePerHit, `${lost(e)}`);
  const h = arena(['light', 'lightning']), a = dummy(h, 11, 8), b = dummy(h, 12, 9);
  h.castFusion(a); step(h, 2);
  // (감전's discharges add a little on top.)
  assert.ok(lost(a) >= 6 * 63, `${lost(a)}`); assert.ok(lost(b) >= 6 * 30, `${lost(b)}`);
});

test('balance 2026-11-21: the molten ball and the saw stop at an ordinary body; the refracted beam bends to three', () => {
  for (const [pair, id] of [[['fire', 'magnet'], 'moltenBall'], [['magnet', 'wind'], 'scrapSaw']]) {
    const g = arena(pair), e = dummy(g, 10.4, 8); g.p.energy = 100;
    assert.equal(g.fusion.id, id); assert.equal(g.castFusion(e), true); step(g, 5);
    const f = data.combat.fusions.find(x => x.id === id);
    assert.ok(lost(e) >= f.totalDirectDamage - 1e-6, `${id} on a lone guard: ${lost(e)}`);
  }
  const g = arena(['light', 'lightning']), a = dummy(g, 11, 8), others = [dummy(g, 12, 9), dummy(g, 12, 7), dummy(g, 13, 8)];
  g.castFusion(a); step(g, 2);
  for (const o of others) assert.ok(lost(o) >= 6 * 30, `bent on to each of three: ${lost(o)}`);
});

test('굴절 광선 (2026-11-22): fastens on the body by the cursor, is not cast with none in front, follows the cursor and lets go far away', () => {
  // The cursor on the far body: the beam takes it, not the nearer one.
  const g = arena(['light', 'lightning']), near = dummy(g, 10, 8), far = dummy(g, 13, 8.5);
  g.p.aimPoint = { x: 13, y: 8.5 }; assert.equal(g.castFusion({ x: 13, y: 8.5 }), true); step(g, 0.3, { aim: { x: 13, y: 8.5 } });
  assert.ok(lost(far) > lost(near), `far ${lost(far)} near ${lost(near)}`);
  // Moving the cursor on to the other body moves the beam there.
  const before = lost(near); step(g, 0.5, { aim: { x: 10, y: 8 } }); assert.ok(lost(near) - before >= 2 * 63, `moved: ${lost(near) - before}`);
  // Only a body behind F2: nothing is cast and nothing is spent.
  const h = arena(['light', 'lightning']); dummy(h, 5, 8); h.p.angle = 0; h.p.energy = 100;
  assert.equal(h.castFusion({ x: 12, y: 8 }), false); assert.equal(h.p.energy, 100); assert.equal(h.s.casts.length, 0);
  // A body that walks off past the leash is let go: it takes no more.
  const k = arena(['light', 'lightning']), runner = dummy(k, 11, 8);
  k.castFusion({ x: 11, y: 8 }); step(k, 0.5); const taken = lost(runner); runner.pin = null; runner.x = 20; step(k, 1);
  assert.equal(lost(runner), taken, 'no more blows once it is 12 units away');
});

test('reach 2026-11-22: shards fly only within 7, empty 별자리 and 북극광 cost nothing, the sun takes the body by the cursor', () => {
  const g = arena(['ice', 'magnet']), near = dummy(g, 10, 8), far = dummy(g, Math.min(g.bounds.right - 0.6, 17), 8);
  assert.ok(Math.hypot(far.x - g.p.x, far.y - g.p.y) > 7.6, 'the far one stands past the shards reach');
  assert.equal(g.fusion.id, 'frostShards'); assert.equal(g.castFusion(near), true); step(g, 3);
  assert.ok(lost(near) > 0); assert.equal(lost(far), 0, 'no shard flies across the room');
  for (const [pair, id] of [[['light', 'sound'], 'lightConstellation'], [['light', 'magnet'], 'auroraRing']]) {
    const h = arena(pair); dummy(h, 8 + 9, 8); h.p.energy = 100;
    assert.equal(h.fusion.id, id); assert.equal(h.castFusion({ x: 10, y: 8 }), false, `${id} with no body near`);
    assert.equal(h.p.energy, 100); assert.equal(h.p.fusionReady, 0);
  }
  const s = arena(['fire', 'light']), close = dummy(s, 10, 8), pointed = dummy(s, 13, 10), lone = dummy(s, 13, 15.5);
  s.p.aimPoint = { x: 13, y: 10 };
  assert.equal(s.castFusion(pointed), true);
  const sun = s.s.casts.find(c => c.shape === 'sun');
  assert.equal(sun.tid, pointed.id, 'the sun goes over the body by the cursor, not the nearest');
  step(s, 0.4); pointed.hp = 0; step(s, 0.1);
  assert.equal(sun.tid, null, 'no body within 3 of the fallen one: the sun stays'); assert.equal(lost(lone), 0); assert.ok(lost(close) === 0);
});

test('cards 2026-11-22: 분광 splits at the first body it strikes; 자석 렌치 lays 쇳가루 with the wrench once a second', () => {
  const g = arena(['light']), first = dummy(g, 10, 8), side = dummy(g, 12, 9.1);
  g.s.run.skillMods = ['splitBeam']; g.p.angle = 0;
  cast(g, 'prismBeam', { x: 12, y: 8 }); step(g, 0.2);
  const beam = data.combat.skills.find(s => s.id === 'prismBeam').damagePerHit;
  assert.equal(lost(first), beam, 'the first body takes the beam once, not a branch as well');
  assert.ok(Math.abs(lost(side) - beam * 0.4) < 1e-6, `a body beside the line takes a branch: ${lost(side)}`);
  const h = arena(['magnet']), e = dummy(h, 9.2, 8); h.s.run.traits = ['magnetWrench'];
  step(h, 1.6, { basic: true, aim: { x: 9.2, y: 8 } });
  assert.ok(h.ironDustOf(e) >= 1 && h.ironDustOf(e) <= 2, `one layer a second from the wrench: ${h.ironDustOf(e)}`);
});
