import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { floorDistance } from '../src/engine/math.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));

// Chapter 3's belfry (a preview: the local test server opens it), Belgard's room.
function belfry(level = 'normal') {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  assert.ok(g.startRun(7, level, 'clock-tower'));
  g.s.run.node = g.rooms.findIndex(room => room.boss === 'bellguard'); g.enterNode(); g.s.entry = null;
  const bg = g.s.enemies.find(e => e.boss);
  Object.assign(g.p, { hp: 5000, maxHp: 5000, dodge: null, invulnerableUntil: 0 });
  g.p.x = bg.x - 4; g.p.y = bg.y + 1;
  return { g, bg, ai: g.config.bossAI.bellguard };
}
const fresh = g => { g.p.invulnerableUntil = 0; };
const play = (g, seconds, each) => { for (let i = 0; i < Math.round(seconds * 60); i++) { g.update(1 / 60, {}); each?.(); } };
/** Starts `type` now and runs it out, F2 standing still (the boss stays put). */
const cast = (g, bg, type) => { g.beginEnemyTell(bg, type, 0.01); g.s.time += 0.02; g.updateEnemies(0.02); };
const step = (g, seconds, each) => { for (let i = 0; i < Math.round(seconds * 60); i++) { g.s.time += 1 / 60; g.tickBellBoss(1 / 60); each?.(); } };

test('Belgard stands in the belfry with his own clips and the design health', () => {
  const { g, bg } = belfry();
  assert.equal(bg.type, 'bellguard'); assert.equal(bg.sprite, 'belgard');
  assert.equal(bg.maxHp, data.combat.bosses.find(b => b.id === 'bellguard').hp);
  assert.equal(g.room.kind, 'regionBoss'); assert.equal(g.map.village, 'belfry');
});

test('the three-step toll rings the inner disc, then the outer ring, then the middle one', () => {
  const { ai } = belfry(), [r0, r1, r2] = ai.ringRadii;
  // F2 standing in each band in turn is hurt once, as that band rings, and by no other.
  for (const [band, d] of [[0, r0 / 2], [1, (r1 + r2) / 2], [2, (r0 + r1) / 2]]) {
    const { g, bg } = belfry(); g.p.x = bg.x + d; g.p.y = bg.y;
    cast(g, bg, 'bgRings'); const f = g.s.bossFields.find(x => x.kind === 'bgRings');
    const hurtAt = []; let hp = g.p.hp;
    step(g, 4, () => { if (g.p.hp < hp) { hurtAt.push(g.s.time); hp = g.p.hp; } fresh(g); });
    assert.deepEqual([f.bands[0].lo, f.bands[1].lo, f.bands[2].lo], [0, r1, r0]);
    assert.equal(hurtAt.length, 1, `band ${band} hurts once`);
    assert.ok(Math.abs(hurtAt[0] - f.bands[band].at) < 0.05, `band ${band} at its own time`);
    assert.ok(f.bands[0].at < f.bands[1].at && f.bands[1].at < f.bands[2].at);
  }
});

test('archers come from two sides in phase 1 and from all four in phase 2, then leave', () => {
  const { g, bg, ai } = belfry();
  const sides = () => {
    const room = g.bgRoom(), called = g.s.enemies.filter(e => e.called && e.hp > 0);
    return new Set(called.map(e => { const d = { north: e.y - room.top, south: room.bottom - e.y, west: e.x - room.left, east: room.right - e.x }; return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0]; })).size;
  };
  cast(g, bg, 'bgArchers');
  assert.equal(g.s.enemies.filter(e => e.called).length, ai.archerSides); assert.equal(sides(), ai.archerSides);
  step(g, ai.archerLife + 0.5); g.s.enemies = g.s.enemies.filter(e => e.hp > 0 || e.boss);
  bg.breaksDone = [0];
  cast(g, bg, 'bgArchers');
  assert.equal(g.s.enemies.filter(e => e.called && e.hp > 0).length, 4); assert.equal(sides(), 4);
});

test('the bell cage holds F2 until the wrench breaks it, or rings on her', () => {
  for (const strike of [true, false]) {
    const { g, bg, ai } = belfry();
    g.p.x = bg.x - 5; g.p.y = bg.y;
    cast(g, bg, 'bgCage'); const f = g.s.bossFields.find(x => x.kind === 'bgCage');
    step(g, ai.cageFall + 0.05);
    assert.ok(f.trapped, 'caught under the bell');
    const hp = g.p.hp; g.p.x += 5; step(g, 0.05);
    assert.ok(floorDistance(f, g.p) < f.radius, 'cannot walk out');
    if (strike) { for (let i = 0; i < ai.cageHits; i++) { g.bgSwing({ angle: 0 }, 1.6); g.s.time += 0.2; } step(g, 0.05); assert.ok(f.done && g.p.hp === hp, 'broken out unhurt'); }
    else { step(g, ai.cageSeconds + 0.1); assert.ok(f.done && g.p.hp < hp, 'it rang on her'); }
  }
});

/** Raises the shield (half health) and returns it with its rule. */
const shield = () => {
  const room = belfry(), { g, bg } = room;
  bg.hp = bg.maxHp * 0.51; g.hitEnemy(bg, bg.maxHp * 0.02, { exact: true });
  return { ...room, b: bg.breaking, rule: g.breakRule(bg, 0) };
};
/** Runs the shield's frames for `seconds` (or until `until` says stop), F2 kept alive unless `hurtable`. */
const shieldFor = (g, bg, seconds, each, until) => {
  for (let i = 0; i < Math.round(seconds * 60) && bg.breaking; i++) { g.s.time += 1 / 60; g.updatePhaseBreak(bg, 1 / 60); each?.(); if (until?.()) return true; }
  return false;
};
/** Waits until pillar `pl`'s needle is in (or out of) Orden's pitch. */
const tuneTo = (g, bg, b, rule, pl, inTune) => { while (Math.abs(g.bgNeedle(b, pl, rule)) <= rule.tune !== inTune) { g.s.time += 1 / 240; } };
/** A wrench blow at pillar `pl` from just west of it. */
const strike = (g, pl) => { g.p.x = pl.x - 1; g.p.y = pl.y; g.bgSwing({ angle: 0 }, 1.6); };

test('half health raises the shield: Orden\'s pillars round the floor, and a real order soon comes to the one nearest F2', () => {
  const { g, bg, b, rule } = shield();
  assert.equal(b.kind, 'orders'); assert.equal(b.pillars.length, rule.pillars); assert.equal(b.need, 3);
  const near = b.pillars[0]; g.p.x = near.x + 1.5; g.p.y = near.y;
  shieldFor(g, bg, rule.firstOrder + 0.1, () => fresh(g));
  assert.ok(b.order && !b.order.forged && b.order.pillar === 0, 'a real order to the pillar beside her');
  // He runs there and strikes round it: standing by it is hit, and the pillar stands (a real order breaks nothing).
  let hp = g.p.hp; shieldFor(g, bg, 4, () => { fresh(g); Object.assign(g.p, { x: near.x + 1.5, y: near.y }); }, () => b.order === null);
  assert.ok(g.p.hp < hp, 'struck by the order'); assert.ok(!near.broken); assert.equal(b.cracks, 0);
  // And the next comes soon after the blow.
  shieldFor(g, bg, rule.orderGap + 0.05, () => fresh(g)); assert.ok(b.order, `another order within ${rule.orderGap} s`);
});

test('a blow on a pillar in Orden\'s pitch forges an order: he turns to it at once, and striking it cracks his bell', () => {
  const { g, bg, b, rule } = shield();
  const pl = b.pillars[1];
  tuneTo(g, bg, b, rule, pl, true); strike(g, pl);
  assert.ok(b.order?.forged && b.order.pillar === 1, 'a forged order');
  g.p.x = pl.x - 6; g.p.y = pl.y; // well out of the blow
  shieldFor(g, bg, 6, () => fresh(g), () => pl.broken);
  assert.ok(pl.broken, 'the forged pillar struck and broken'); assert.equal(b.cracks, 1);
});

test('a forged order takes over a real one he is running to', () => {
  const { g, bg, b, rule } = shield();
  g.p.x = b.pillars[0].x + 1.5; g.p.y = b.pillars[0].y;
  shieldFor(g, bg, rule.firstOrder + 0.1, () => fresh(g));
  assert.equal(b.order.forged, false);
  const pl = b.pillars[2]; tuneTo(g, bg, b, rule, pl, true); strike(g, pl);
  assert.ok(b.order.forged && b.order.pillar === 2, 'turned to the forged pillar');
});

test('a blow off the pitch jams the pillar a while, and a forged order then waits for the charge at F2', () => {
  // 2026-11-22 (the user's word: striking anywhere worked): the green is narrow, a miss jams its pillar, and a lucky blow
  // straight after no longer calls the charge off.
  const { g, bg, b, rule } = shield();
  assert.equal(rule.tune, 0.25); assert.ok(rule.jamSeconds > 1);
  const pl = b.pillars[3]; tuneTo(g, bg, b, rule, pl, false); g.s.time += rule.grace + 0.02; tuneTo(g, bg, b, rule, pl, false); strike(g, pl);
  assert.ok(b.order?.punish, 'he comes for her'); assert.ok(pl.jamUntil > g.s.time, 'jammed');
  // Its needle stands still and is never in tune while jammed: a blow on it only clangs.
  const u = g.bgNeedle(b, pl, rule); assert.ok(Number.isFinite(u) && Math.abs(u) > rule.tune, 'stopped where it was, off the green'); g.s.time += 0.3; assert.equal(g.bgNeedle(b, pl, rule), u); assert.equal(g.bgInTune(b, pl, rule), false);
  pl.hitAt = -9; strike(g, pl); assert.ok(b.order.punish && !b.queued, 'a jammed pillar forges nothing');
  // Another pillar struck in tune: the forged order waits behind the charge.
  const other = b.pillars[1]; tuneTo(g, bg, b, rule, other, true); strike(g, other);
  assert.ok(b.order.punish, 'the charge goes on'); assert.ok(b.queued?.forged && b.queued.pillar === 1, 'the forged order waits');
  // Free again after jamSeconds.
  g.s.time = pl.jamUntil + 0.01; assert.notEqual(g.bgNeedle(b, pl, rule), u);
});

test('off the pitch it clangs, and he charges F2 instead', () => {
  const { g, bg, b, rule } = shield();
  const pl = b.pillars[3]; tuneTo(g, bg, b, rule, pl, false); strike(g, pl);
  assert.ok(b.order?.punish, 'he comes for her'); assert.ok(!b.order.forged);
  assert.ok(Math.hypot(b.order.target.x - g.p.x, b.order.target.y - g.p.y) < 0.01, 'at where she stood');
  const hp = g.p.hp; shieldFor(g, bg, 4, () => { fresh(g); Object.assign(g.p, b.order ? b.order.target : g.p); }, () => b.order === null);
  assert.ok(g.p.hp < hp, 'standing there is hit');
});

test('three forged pillars struck break the shield into the puppet phase; too few pillars left fails it', () => {
  const { g, bg, b, rule } = shield();
  for (const i of [0, 1, 2]) {
    const pl = b.pillars[i]; tuneTo(g, bg, b, rule, pl, true); strike(g, pl);
    g.p.x = pl.x - 7; g.p.y = pl.y;
    shieldFor(g, bg, 8, () => { fresh(g); g.p.hp = g.p.maxHp; if (b.order && !b.order.forged && !b.order.struck) { const q = b.pillars[i]; if (!q.broken) { tuneTo(g, bg, b, rule, q, true); strike(g, q); g.p.x = q.x - 7; g.p.y = q.y; } } }, () => pl.broken || !bg.breaking);
  }
  assert.equal(bg.breaking, null, 'broken'); assert.ok(g.bgPuppet(bg));
  // Fails: with two of four pillars left and three cracks still to make, the time is up at once.
  const second = shield();
  second.b.pillars[0].broken = second.b.pillars[1].broken = true;
  shieldFor(second.g, second.bg, 0.1, () => fresh(second.g));
  assert.ok(second.b.failAt !== null || second.bg.breaking === null, 'fails');
  assert.equal(second.b.cracks, 0);
});

test('the last toll: a light circles the planted sword and only its sweeping shadow is safe; fewer tolls', () => {
  const { g, bg, ai } = belfry();
  bg.breaksDone = [0];
  assert.ok(ai.tollCount <= 6, 'fewer tolls than the old twelve');
  cast(g, bg, 'bgLastToll'); const f = g.s.bossFields.find(x => x.kind === 'bgToll');
  assert.equal(f.tolls.length, ai.tollCount); assert.equal(f.plants.length, ai.tollCount / ai.tollsPerPlant);
  // Walking with the shadow: always on the far side of the sword from the light.
  const shade = () => { const next = f.tolls.find(x => !x.done); if (!next) return; const pl = f.plants[next.plant], a = g.bgTollLight(f, pl, g.s.time) + Math.PI; g.p.x = pl.x + Math.cos(a) * 2; g.p.y = pl.y + Math.sin(a) * 2 * 0.55; };
  step(g, 40, () => { shade(); fresh(g); });
  assert.ok(f.tolls.every(x => x.done)); assert.equal(g.p.hp, 5000, 'safe in the shadow every time');
  // The shadow turns: where it fell at the first toll is lit by the second.
  const pl = f.plants[0], first = f.tolls[0].at, second = f.tolls[1].at, a = g.bgTollLight(f, pl, first) + Math.PI;
  const spot = { x: pl.x + Math.cos(a) * 2, y: pl.y + Math.sin(a) * 2 * 0.55 };
  assert.ok(g.bgShaded(f, pl, spot, first) && !g.bgShaded(f, pl, spot, second), 'standing still in it does not last');
  // On the light's side it hurts.
  const { g: g2, bg: bg2 } = belfry(); bg2.breaksDone = [0]; g2.p.x = bg2.x; g2.p.y = bg2.y - 3;
  cast(g2, bg2, 'bgLastToll'); const f2 = g2.s.bossFields.find(x => x.kind === 'bgToll');
  step(g2, f2.tolls[0].at - g2.s.time + 0.05, () => { const q = f2.plants[0], b = g2.bgTollLight(f2, q, g2.s.time); g2.p.x = q.x + Math.cos(b) * 2; g2.p.y = q.y + Math.sin(b) * 2 * 0.55; fresh(g2); });
  assert.ok(g2.p.hp < 5000, 'out of the shadow it hurts');
});

test('both phases play their whole round, and beating him in the preview leads to a reward, not the ending', () => {
  const { g, bg, ai } = belfry();
  const seen = new Set();
  play(g, 70, () => { fresh(g); g.p.hp = g.p.maxHp; if (bg.tell) seen.add(bg.tell.type); });
  for (const type of ai.round) assert.ok(seen.has(type), `phase 1 ${type}`);
  bg.hp = bg.maxHp * 0.51; g.hitEnemy(bg, bg.maxHp * 0.02, { exact: true });
  bg.breaking.cracks = bg.breaking.need;
  play(g, 0.1); assert.ok(g.bgPuppet(bg));
  seen.clear(); play(g, 90, () => { fresh(g); g.p.hp = g.p.maxHp; if (bg.tell) seen.add(bg.tell.type); });
  for (const type of ai.round2) assert.ok(seen.has(type), `phase 2 ${type}`);
  g.hitEnemy(bg, bg.hp + 10, { exact: true }); play(g, 4);
  assert.equal(g.s.mode, 'unwind');
  assert.ok(g.unwind()); assert.equal(g.s.mode, 'reward', 'a preview chapter is not finished by its last built room');
});

test('while his sword flies he fights barehanded: the bare clips, slow steps after F2, a punch in reach', () => {
  const { g, bg, ai } = belfry();
  bg.breaksDone = [0]; g.p.x = bg.x - 6; g.p.y = bg.y;
  cast(g, bg, 'bgFlySword');
  assert.ok(g.s.bossFields.some(f => f.kind === 'bgSword'));
  const start = bg.x, punches = [];
  for (let i = 0; i < 60 * (ai.flySeconds - 0.5); i++) {
    g.s.time += 1 / 60; g.updateEnemies(1 / 60); fresh(g); g.p.hp = g.p.maxHp;
    if (bg.tell) { assert.equal(bg.tell.type, 'bgPunch', 'only punches while barehanded'); if (!punches.includes(bg.tell.started)) punches.push(bg.tell.started); }
    if (i === 30) assert.equal(bg.sprite, 'belgard-bare');
  }
  assert.ok(bg.x < start - 1, 'walked toward F2');
  assert.ok(punches.length >= 1, 'punched once in reach');
  for (let i = 0; i < 60; i++) { g.s.time += 1 / 60; g.updateEnemies(1 / 60); fresh(g); }
  assert.equal(bg.sprite, 'belgard', 'the sword is back in his hands');
});

test('the grab catches, throws F2 across the room and drops the bell over her where she lands', () => {
  const { g, bg, ai } = belfry();
  g.p.x = bg.x - 2.5; g.p.y = bg.y;
  const before = { x: g.p.x, y: g.p.y }, hp = g.p.hp;
  cast(g, bg, 'bgGrab');
  const thrown = g.s.bossFields.find(x => x.kind === 'bgThrow');
  assert.ok(thrown && g.p.hp < hp, 'caught and hurt');
  assert.ok(g.p.heldUntil > g.s.time && g.p.stunUntil > g.s.time, 'held, nothing to do but wait');
  step(g, ai.grabLift + ai.grabThrow + 0.05);
  assert.ok(Math.hypot(g.p.x - before.x, g.p.y - before.y) > 2, 'thrown away from where she was caught');
  const cage = g.s.bossFields.find(x => x.kind === 'bgCage');
  assert.ok(cage, 'the bell is coming down');
  step(g, ai.grabDrop + 0.05);
  assert.ok(cage.trapped, 'shut in under it');
  assert.ok(bg.busyUntil >= cage.until, 'he waits while she is shut in');
});

test('no openings: a missed grab, a missed cage and the rings leave him free to fight on', () => {
  const { g, bg, ai } = belfry();
  g.p.x = bg.x - 3; g.p.y = bg.y;
  g.beginEnemyTell(bg, 'bgGrab', 0.01);
  g.p.y = bg.y + 4;   // stepped off the grab's line during its warning
  g.s.time += 0.02; g.updateEnemies(0.02);
  assert.ok(!g.s.bossFields.some(x => x.kind === 'bgThrow'), 'missed');
  assert.ok(!(bg.busyUntil > g.s.time + 0.05), 'no standing still after a missed grab');
  g.p.x = bg.x - 6; g.p.y = bg.y;
  cast(g, bg, 'bgCage'); fresh(g);
  const bells = g.s.bossFields.filter(x => x.kind === 'bgCage');
  assert.equal(bells.length, 3, 'three bells'); assert.ok(bells[2].radius > bells[0].radius, 'the last one wide');
  // Out from under each one once it is aimed (a step aside, then back).
  let side = 1;
  step(g, ai.cageFall + 2 * ai.cageGap + 0.05, () => { fresh(g); for (const b of bells) if (g.s.time >= b.aimAt && !b.left) { b.left = true; g.p.y += side * (b.radius + 0.8); side = -side; } });
  assert.ok(bells.every(b => !b.trapped), 'all three missed');
  assert.ok(bg.busyUntil <= g.s.time + 0.5, 'a missed cage lets him go on at once');
  cast(g, bg, 'bgRings');
  assert.ok(bg.busyUntil <= g.s.time + 0.7, 'he plants and moves on while the rings ring');
});

test('the third cut lunges forward its full step and reaches wider than the first two', () => {
  const { g, bg, ai } = belfry(); g.p.x = bg.x - 6; g.p.y = bg.y;
  assert.ok(ai.comboLastRange > ai.comboRange && ai.comboLastDegrees > ai.comboDegrees && ai.comboLastStep > ai.comboStep * 3);
  const x0 = bg.x; g.beginEnemyTell(bg, 'bgCombo3', 0.01);
  assert.ok(Math.abs(bg.tell.step - ai.comboLastStep) < 1e-9, 'far off, the whole step');
  // The step glides over comboGlide (2026-11-20) instead of jumping.
  for (let i = 0; i < 20; i++) { g.s.time += 0.02; g.updateEnemies(0.02); }
  assert.ok(x0 - bg.x > ai.comboLastStep - 0.05, `stepped ${x0 - bg.x}`);
  // Close in, he stops short of her rather than walking through.
  const { g: g2, bg: b2 } = belfry(); g2.p.x = b2.x - 1.5; g2.p.y = b2.y;
  g2.beginEnemyTell(b2, 'bgCombo3', 0.01); assert.ok(b2.tell.step < 1);
});

test('he does not stand by his floor attacks: in the last toll his sword flies on to a new spot before each planting, after the rings he comes after F2', () => {
  const { g, bg, ai } = belfry();
  bg.breaksDone = [0];
  cast(g, bg, 'bgLastToll'); const f = g.s.bossFields.find(x => x.kind === 'bgToll');
  const at = [];
  step(g, 30, () => { fresh(g); g.p.hp = g.p.maxHp; f.plants.forEach((pl, k) => { if (pl.landed && !at[k]) at[k] = { x: pl.x, y: pl.y }; }); });
  assert.ok(f.plants.slice(1).every(pl => pl.moved), 'the sword moves before every planting after the first');
  assert.ok(at.slice(1).every((q, k) => Math.hypot(q.x - at[k].x, q.y - at[k].y) > 0.5), 'planted at a new spot each time');
  // The rings: he is soon on his way to F2 and swings combos while they ring.
  const { g: g2, bg: bg2 } = belfry(); g2.p.x = bg2.x - 6; g2.p.y = bg2.y;
  cast(g2, bg2, 'bgRings'); const start = Math.hypot(g2.p.x - bg2.x, g2.p.y - bg2.y), seen = new Set();
  play(g2, ai.ringWarn + ai.ringGap * 2, () => { fresh(g2); g2.p.hp = g2.p.maxHp; if (bg2.tell) seen.add(bg2.tell.type); });
  assert.ok(Math.hypot(g2.p.x - bg2.x, g2.p.y - bg2.y) < start - 2, 'he closes in');
  assert.ok([...seen].every(type => type.startsWith('bgCombo') || type === 'bgSpin'), `only combos while they ring: ${[...seen]}`);
});

test('his punch reaches far now (3.2 over 130 degrees)', () => {
  const { ai } = belfry();
  assert.equal(ai.punchReach, 3.2); assert.equal(ai.punchDegrees, 130); assert.ok(ai.punchStep >= 1);
});

test('the sword rain pours swords at random spots for a while, some where F2 stands, each warned before it lands', () => {
  const { g, bg, ai } = belfry();
  bg.breaksDone = [0];
  cast(g, bg, 'bgSwordRain'); const f = g.s.bossFields.find(x => x.kind === 'bgRain');
  let hurt = 0, hp = g.p.hp;
  // (swords that have stood their rainStay leave the field since 2026-11-21, so they are gathered as they come)
  const all = new Set();
  step(g, ai.rainSeconds + ai.rainWarn + ai.rainStay + 0.2, () => { fresh(g); if (g.p.hp < hp) hurt++; hp = g.p.hp = g.p.maxHp; for (const sw of f.swords) all.add(sw); });
  const n = all.size;
  assert.ok(Math.abs(n - ai.rainSeconds * ai.rainRate) <= 2, `about rainRate a second: ${n}`);
  assert.ok([...all].every(sw => sw.done), 'every sword landed'); assert.equal(f.swords.length, 0, 'none left standing');
  const xs = new Set([...all].map(sw => Math.round(sw.x))), ys = new Set([...all].map(sw => Math.round(sw.y)));
  assert.ok(xs.size > 5 && ys.size > 3, 'not in rows: spread over the floor');
  assert.ok(hurt >= 1, 'standing still is hit');
  assert.ok(f.done, 'gone once over');
});

test('the flying sword hunts, stops to take aim, then darts along its aim', () => {
  const { g, bg, ai } = belfry();
  bg.breaksDone = [0];
  cast(g, bg, 'bgFlySword'); const f = g.s.bossFields.find(x => x.kind === 'bgSword');
  const modes = []; let dashFrom = null, far = 0;
  step(g, ai.flyHunt + ai.flyAim + 1, () => { fresh(g); g.p.hp = g.p.maxHp; if (modes.at(-1) !== f.mode) modes.push(f.mode); if (f.mode === 'dash') { dashFrom ??= { ...f.dashFrom }; far = Math.max(far, Math.hypot(f.x - dashFrom.x, f.y - dashFrom.y)); } });
  assert.deepEqual(modes.slice(0, 3), ['hunt', 'aim', 'dash']);
  assert.ok(far > 3, `it darts a long way: ${far}`);
  assert.ok(f.trail?.length > 2, 'afterimages behind it');
});

test('the needles join into a fence of light F2 cannot cross; pulling one (two blows) opens the way before the inside blows', () => {
  const setup = () => {
    const { g, bg, ai } = belfry(); bg.breaksDone = [0];
    cast(g, bg, 'bgNeedles'); const f = g.s.bossFields.find(x => x.kind === 'bgNeedles');
    step(g, f.needles.at(-1).at - g.s.time + 0.05, () => fresh(g));
    return { g, f, ai };
  };
  { // walking straight out is held back by the fence
    const { g, f } = setup(), c = { x: f.x, y: f.y };
    Object.assign(g.p, c); f.lastP = { ...c };
    step(g, 0.8, () => { fresh(g); g.p.x += 0.12; });
    step(g, 1 / 60);   // the last push is held back on the next frame
    assert.ok(g.bgInPoly(f.needles, g.p), 'still inside');
  }
  { // pull a needle and walk out through its side
    const { g, f, ai } = setup(), n = f.needles[0];
    g.p.x = n.x - 1; g.p.y = n.y;
    for (let i = 0; i < ai.needleHits; i++) { g.bgSwing({ angle: 0 }, 1.6); g.s.time += 0.2; }
    assert.ok(n.pulled, 'pulled');
    // From the middle out past where the needle stood.
    const c = { x: f.x, y: f.y }, d = Math.hypot(n.x - c.x, n.y - c.y), ux = (n.x - c.x) / d, uy = (n.y - c.y) / d;
    Object.assign(g.p, c); f.lastP = { ...c };
    const hp = g.p.hp; let walked = 0;
    step(g, f.close - g.s.time + 0.1, () => { fresh(g); if (walked < d + 2) { g.p.x += ux * 0.1; g.p.y += uy * 0.1; walked += 0.1; } });
    assert.ok(!g.bgInPoly(f.needles, g.p) && g.p.hp === hp, 'out, and not hurt by the blast');
  }
});

test('in phase 2 Orden takes him over: a held moment for his words (a caption since 2026-11-21, no longer a notice)', () => {
  const { g, bg } = belfry();
  bg.breaksDone = [0]; bg.ready = g.s.time + 9;
  play(g, 0.1);
  assert.ok(bg.puppetAt !== undefined, 'taken over');
  assert.ok(g.p.invulnerableUntil >= bg.puppetAt + 1.5, 'nothing lands on F2 while he speaks');
  for (const e of g.s.enemies) if (e !== bg && e.hp > 0) assert.ok(e.ready >= bg.puppetAt + 1.5, 'nobody else starts a blow');
});

test('his archers have their own 100 health, and beating him leaves a mending box by the exit instead of a heal at once', () => {
  const { g, bg } = belfry();
  cast(g, bg, 'bgArchers');
  const archers = g.s.enemies.filter(e => e.called && e.type === 'minuteArcher');
  assert.ok(archers.length >= 2); for (const a of archers) assert.equal(a.maxHp, 100);
  Object.assign(g.p, { hp: 100, maxHp: 200 });
  for (const e of g.s.enemies) e.hp = 0; g.finishCombat();
  assert.equal(g.p.hp, 100, 'not healed at once');
  const box = g.s.hazards.find(h => h.kind === 'musicbox' && h.mend);
  assert.ok(box, 'a mending box'); assert.ok(floorDistance(box, g.portal) < 4, 'by the exit');
  Object.assign(g.p, { x: box.x, y: box.y }); g.pickUpMusicBoxes();
  assert.equal(g.p.hp, 200, 'mends 100 (2026-11-21)'); assert.ok(box.gone);
});

test('the debug damage scale multiplies what F2 deals', () => {
  const { g, bg } = belfry(); bg.ready = g.s.time + 99;
  const hit = scale => { g.debugDamage = scale; const before = bg.hp; g.hitEnemy(bg, 10, { exact: true }); return before - bg.hp; };
  assert.equal(hit(1), 10); assert.equal(hit(5), 50);
});

test('the great sweep throws a crescent over its fan: hit once inside it, never behind him', () => {
  for (const [dx, hurt] of [[-6, true], [6, false]]) {
    const { g, bg } = belfry(); bg.ready = g.s.time + 99; g.p.x = bg.x + dx; g.p.y = bg.y;
    g.beginEnemyTell(bg, 'bgCrescent', 0.01); bg.tell.angle = Math.PI; g.s.time += 0.02; g.updateEnemies(0.02);
    assert.ok(g.s.bossFields.some(f => f.kind === 'bgCrescent'), 'the crescent flies');
    const hp = g.p.hp; step(g, 2, () => fresh(g));
    assert.equal(g.p.hp < hp, hurt, dx < 0 ? 'in its fan' : 'behind him');
  }
});

test('the bell weight swings across the row F2 stands in, three passes; out of the row it never touches her', () => {
  for (const [move, want] of [[0, 3], [3.5, 0]]) {
    const { g, bg, ai } = belfry(); bg.ready = g.s.time + 99;
    cast(g, bg, 'bgPendulum'); const f = g.s.bossFields.find(x => x.kind === 'bgPendulum');
    assert.equal(f.passes.length, ai.pendulumPasses);
    let hits = 0, hp = g.p.hp;
    step(g, 6, () => { fresh(g); const row = f.passes.find(ps => ps.y !== null && g.s.time < ps.end); if (row && move) g.p.y = row.y + (row.y + move < g.bgRoom().bottom ? move : -move); if (g.p.hp < hp) { hits++; hp = g.p.hp; } });
    assert.equal(hits, want, move ? 'stepped out of each row' : 'stood in each row');
  }
});

test('the last toll (2026-11-21): he flings his sword far from himself and waits barehanded; his archers fall back', () => {
  const { g, bg, ai } = belfry(); bg.ready = g.s.time + 99;
  cast(g, bg, 'bgArchers'); const archers = g.s.enemies.filter(e => e.called && e.hp > 0);
  assert.ok(archers.length > 0);
  cast(g, bg, 'bgLastToll'); const f = g.s.bossFields.find(x => x.kind === 'bgToll');
  step(g, 0.1);
  assert.ok(archers.every(e => e.hp <= 0), 'the archers are gone');
  const gap = Math.hypot(f.plants[0].x - bg.x, f.plants[0].y - bg.y);
  assert.ok(gap >= ai.tollSwordGap - 1, `the sword lands well away from him (${gap.toFixed(1)})`);
  step(g, f.plants[0].at - g.s.time + 0.05);
  assert.ok(bg.bareUntil > g.s.time, 'barehanded while it stands');
  step(g, f.tolls.at(-1).at - g.s.time + 0.1);
  assert.ok(f.done && bg.bareUntil <= g.s.time, 'the sword back in his hands once it is over');
});

test('broken out of the bell, F2 faces his next blow within half a second (2026-11-21: his ready stayed raised by the cage)', () => {
  const { g, bg, ai } = belfry();
  g.p.x = bg.x - 2.5; g.p.y = bg.y;
  cast(g, bg, 'bgGrab');
  play(g, ai.grabLift + ai.grabThrow + ai.grabDrop + 0.1, () => fresh(g));
  const cage = g.s.bossFields.find(x => x.kind === 'bgCage');
  assert.ok(cage?.trapped, 'shut in under it');
  // He walks round to knock on it, there by the first knock (2026-11-21: a step a frame, held by the walls).
  play(g, ai.cageKnockFirst + 0.05, () => fresh(g));
  assert.ok(Math.hypot(bg.x - cage.stand.x, bg.y - cage.stand.y) < 0.3, 'at the bell');
  for (let i = 0; i < ai.cageHits; i++) { g.bgSwing({ angle: 0 }, 1.6); play(g, 0.15, () => fresh(g)); }
  assert.ok(cage.done && !cage.trapped, 'broken out');
  let next = null;
  play(g, 0.5, () => { fresh(g); g.p.hp = g.p.maxHp; if (bg.tell && next === null) next = bg.tell.type; });
  assert.ok(next, 'he swings again at once');
});

test('his death or his shield in the middle of a throw lets F2 go (2026-11-21: she stayed held with no bell to come)', () => {
  for (const cut of ['death', 'shield']) {
    const { g, bg } = belfry();
    g.p.x = bg.x - 2.5; g.p.y = bg.y;
    cast(g, bg, 'bgGrab');
    assert.ok(g.p.heldUntil > g.s.time + 0.5, 'held');
    if (cut === 'death') { bg.hp = 0; step(g, 1 / 60); }
    else { bg.hp = bg.maxHp * 0.51; g.hitEnemy(bg, bg.maxHp * 0.02, { exact: true }); assert.ok(bg.breaking, 'the shield'); }
    assert.ok(!(g.p.heldUntil > g.s.time) && !(g.p.stunUntil > g.s.time), `let go on his ${cut}`);
  }
});

test('his punch steps in as far as its warning said, fixed as it began (2026-11-24)', () => {
  const { g, bg, ai } = belfry(); bg.ready = 1e9;
  g.p.x = bg.x - 3; g.p.y = bg.y; g.beginEnemyTell(bg, 'bgPunch'); const warned = bg.tell, from = { x: bg.x, y: bg.y };
  assert.ok(warned.step > 0 && warned.step <= ai.punchStep);
  g.p.x = bg.x - 1.3; g.s.time = warned.until; g.executeEnemy(bg);
  assert.ok(Math.abs(Math.hypot(bg.x - from.x, bg.y - from.y) - warned.step) < 1e-6, 'he lands where the warning was drawn from');
});
