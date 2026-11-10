import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));

// A chapter 2 boss room: node 4 is the inspection room (Iris), node 11 the forming hall (Press).
function bossRoom(node) {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  assert.ok(g.startRun(7, 'normal', 'silent-factory'));
  g.s.run.node = node; g.enterNode(); g.s.entry = null;
  const boss = g.s.enemies.find(e => e.boss);
  Object.assign(g.p, { hp: 5000, maxHp: 5000, dodge: null, invulnerableUntil: 0 });
  g.p.x = boss.x + 3; g.p.y = boss.y;
  return { g, boss };
}
const tell = (g, boss, type) => { g.beginEnemyTell(boss, type); return boss.tell; };
const strike = (g, boss, type) => { const t = tell(g, boss, type); g.s.time = t.until; g.executeEnemy(boss); return t; };
const fresh = g => { g.p.invulnerableUntil = 0; };
const run = (g, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) { g.s.time += 1 / 60; g.tickFactoryBoss(1 / 60); g.tickPatches(1 / 60); } };

test('the two chapter 2 bosses stand in their rooms at the design numbers', () => {
  const iris = bossRoom(4).boss, press = bossRoom(11).boss;
  assert.equal(iris.type, 'inspectorIris'); assert.equal(press.type, 'directorPress');
  assert.ok(iris.maxHp > 2000 && press.maxHp > iris.maxHp);
});

test('Iris: a wrench blow in the glowing last half second of her verdict counters it; missed, the stamp comes down', () => {
  const { g, boss } = bossRoom(4);
  const t = tell(g, boss, 'verdict'); g.s.time = t.until - 0.2; g.hitEnemy(boss, 10, { basic: true });
  assert.equal(boss.tell, null); assert.ok(boss.exposedUntil > g.s.time);
  g.s.time += 5; const t2 = tell(g, boss, 'verdict'); g.s.time = t2.until - 1; g.hitEnemy(boss, 10, { basic: true });
  assert.ok(boss.tell, 'too early does not counter');
  g.p.x = boss.x + 1.5; g.p.y = boss.y; boss.tell.angle = 0; fresh(g); const hp = g.p.hp; g.s.time = boss.tell.until; g.executeEnemy(boss); assert.ok(g.p.hp < hp);
});

test('Iris: reject stamps land round F2 one by one, one of them a green pass stamp', () => {
  const { g, boss } = bossRoom(4);
  strike(g, boss, 'rejectStamps'); run(g, 2);
  const marks = g.s.casts.filter(c => c.shape === 'floorMark');
  assert.ok(marks.some(m => m.look === 'pass')); assert.ok(marks.some(m => m.look === 'stamp'));
});

for (const [node, type] of [[4, 'lensInspector'], [11, 'pressGuard']]) test(`a beaten boss takes the helpers down too, so the room clears (room ${node + 1})`, () => {
  const { g, boss } = bossRoom(node);
  const helper = g.fbSummon(type, boss, 1); helper.ready = 1e9; g.fbSummon('partsSupplier', boss, -1).ready = 1e9;
  boss.hp = 0; g.update(1 / 60, {});
  assert.equal(helper.hp, 0); assert.equal(g.wavesLeft, false);
  for (let i = 0; i < 60 * 3 && g.s.mode === 'combat'; i++) g.update(1 / 60, {});
  assert.notEqual(g.s.mode, 'combat');
});
test('Iris: every blow of hers that lands leaves a failing mark, stamps and grid included', () => {
  const { g, boss } = bossRoom(4), ai = g.config.bossAI.inspectorIris;
  g.fbField({ kind: 'stamp', x: g.p.x, y: g.p.y, radius: ai.stampRadius, from: g.s.time, at: g.s.time + 0.1, pass: false, damage: 5 }); run(g, 0.2);
  assert.equal(g.p.failStacks, 1, 'reject stamp'); fresh(g);
  g.fbGrid(boss, 2, [-1, 0, 0]); const grid = g.s.bossFields.find(f => f.kind === 'grid'); Object.assign(g.p, { x: grid.cx, y: grid.cy }); grid.at = g.s.time + 0.05; run(g, 0.1);
  assert.equal(g.p.failStacks, 2, 'grid'); fresh(g);
  g.p.x = boss.x + 2; g.p.y = boss.y; const t = tell(g, boss, 'verdict'); t.angle = 0; g.s.time = t.until; g.executeEnemy(boss);
  assert.equal(g.p.failStacks, 3, 'verdict');
});
test('Iris: three beam hits arm a failing blast, and standing on a pass stamp wipes it', () => {
  const { g, boss } = bossRoom(4);
  for (let i = 0; i < 3; i++) g.fbFail(boss);
  assert.equal(g.p.failStacks, 3); assert.ok(g.p.failBlastAt > g.s.time);
  g.addPatch({ look: 'pass', x: g.p.x, y: g.p.y, radius: 1, duration: 5 }); run(g, 0.1);
  assert.equal(g.p.failStacks, 0);
  for (let i = 0; i < 3; i++) g.fbFail(boss);
  g.s.casts = []; fresh(g); const hp = g.p.hp; run(g, 2); assert.ok(g.p.hp < hp, 'not wiped: it blows');
});

test('Iris: her three always stand apart on open floor, even when she is pushed into a corner', async () => {
  const { fitsMap } = await import('../src/engine/map-geometry.js'), { floorDistance } = await import('../src/engine/math.js');
  const { g, boss } = bossRoom(4), { x: ax, y: ay, w, h } = g.fbArena();
  const places = [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95], [0.5, 0.05], [0.5, 0.95], [0.05, 0.5], [0.95, 0.5], [0.5, 0.5]];
  for (const [u, v] of places) for (const side of [-1, 1]) {
    Object.assign(boss, g.fbFloor(ax + w * u, ay + h * v, { x: ax + w / 2, y: ay + h / 2 }, boss.radius)); boss.tell = null; boss.decoys = null;
    Object.assign(g.p, { x: boss.x + side * 3, y: boss.y + 1 });
    tell(g, boss, 'decoys'); const three = [boss, ...boss.decoys];
    assert.equal(boss.decoys.length, 2);
    for (const s of three) assert.ok(fitsMap(s.x, s.y, 0.6, g.map), `on the floor at ${u},${v}`);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(floorDistance(three[i], three[j]) >= 2.5, `apart at ${u},${v}: ${floorDistance(three[i], three[j]).toFixed(2)}`);
  }
});
test('Iris: among three of her only the real one counts; striking it breaks the decoys, else all three fire', () => {
  const { g, boss } = bossRoom(4);
  tell(g, boss, 'decoys'); assert.equal(boss.decoys.length, 2);
  g.hitEnemy(boss, 10, {}); assert.equal(boss.tell, null); assert.equal(boss.decoys, null);
});

test('Iris: the rings show one safe piece a ring, blow the rest, then repeat with every safe piece turned on', async () => {
  const { gridCell } = await import('../src/engine/factory-bosses.js');
  const { g, boss } = bossRoom(4);
  strike(g, boss, 'gridCheck');
  const grid = g.s.bossFields.find(f => f.kind === 'grid'), safe = [...grid.safe]; assert.equal(safe[0], -1, 'the middle disc is never safe');
  const spot = (ring, sector) => { const a = Math.PI / 4 + (sector + 0.5) * Math.PI / 2, r = (grid.radii[ring - 1] + grid.radii[ring]) / 2; return { x: grid.cx + Math.cos(a) * r, y: grid.cy + Math.sin(a) * r * 0.55 }; };
  for (let k = 1; k <= 2; k++) for (let s = 0; s < 4; s++) assert.deepEqual(gridCell(grid, spot(k, s)), { ring: k, sector: s });
  // Safe in the ring's safe piece, hit in the one after it.
  Object.assign(g.p, spot(1, (safe[1] + 1) % 4)); fresh(g); const hp = g.p.hp;
  run(g, grid.at - g.s.time + 0.05); assert.ok(g.p.hp < hp);
  const again = g.s.bossFields.find(f => f.kind === 'grid'), open = g.fbGridOpen(grid);
  for (const k of [1, 2]) { assert.ok(open[k].includes(safe[k]), 'safe piece on the floor'); let n = (safe[k] + 1) % 4; while (!open[k].includes(n)) n = (n + 1) % 4; assert.equal(again.safe[k], n, 'turned to the next open piece'); }
  Object.assign(g.p, spot(2, again.safe[2])); fresh(g); const hp2 = g.p.hp; run(g, again.at - g.s.time + 0.05); assert.equal(g.p.hp, hp2, 'safe piece of the outer ring');
});

test('Iris: the rings sit on the middle of the hall and cover all of it, so stepping outside them is no way out', () => {
  const { g, boss } = bossRoom(4);
  strike(g, boss, 'gridCheck');
  const grid = g.s.bossFields.find(f => f.kind === 'grid'), outer = grid.radii.at(-1);
  // Every corner of the floor lies inside the outer ring.
  for (const [x, y] of g.map.walkable) assert.ok(Math.hypot(x - grid.cx, (y - grid.cy) / 0.55) <= outer, `floor point ${x},${y} inside`);
  // And a spot past the outer ring still takes the blow.
  Object.assign(g.p, { x: grid.cx + outer + 1, y: grid.cy }); fresh(g); const hp = g.p.hp;
  run(g, grid.at - g.s.time + 0.05); assert.ok(g.p.hp < hp, 'outside the rings is hit too');
});

test('Iris break: three mirrors turned by the wrench send the sweeping light back and break the shield', () => {
  const { g, boss } = bossRoom(4);
  boss.hp = boss.maxHp * 0.49; g.checkPhaseBreak(boss);
  assert.equal(boss.breaking?.kind, 'mirrors');
  // Each mirror starts facing away; every wrench blow turns it 45 degrees, and only the way toward her counts.
  for (const m of boss.breaking.mirrors) {
    assert.equal(m.aimed, false); const start = m.dir; let turns = 0;
    Object.assign(g.p, { x: m.x - 1, y: m.y });
    while (!m.aimed && turns < 8) { g.s.time += 0.2; g.fbSwing({ angle: 0 }, 1.6); turns++; }
    assert.ok(m.aimed, 'turned to face her'); assert.equal(m.dir, (start + turns) % 8); assert.ok(turns >= 2 && turns <= 6);
    const want = Math.round(Math.atan2(boss.y - m.y, boss.x - m.x) / (Math.PI / 4)); assert.equal(m.dir, ((want % 8) + 8) % 8);
  }
  g.p.x = boss.x - 20; for (let i = 0; i < 60 * 9 && boss.breaking; i++) { g.s.time += 1 / 60; g.updatePhaseBreak(boss, 1 / 60); }
  assert.equal(boss.breaking, null, 'broken');
});

test('Press: plates fall where they were shown and stand in the way for a moment; an arm slam leaves the arm stuck and him open', () => {
  const { g, boss } = bossRoom(11);
  const t = strike(g, boss, 'plateDrop');
  assert.ok(g.s.hazards.some(h => h.kind === 'bossPlate')); g.obstacleCache = null;
  assert.ok(g.inSolid(t.drops[0].x, t.drops[0].y, 0.1));
  run(g, 2); g.obstacleCache = null; assert.ok(!g.inSolid(t.drops[0].x, t.drops[0].y, 0.1), 'gone again');
  strike(g, boss, 'armSlam'); assert.ok(boss.armStuck);
});

test('Press: the line carries F2 one way, flips, and stops; the walls close and hurt outside their gap', () => {
  const { g, boss } = bossRoom(11);
  strike(g, boss, 'lineShift'); const x = g.p.x; run(g, 1); assert.notEqual(g.p.x, x);
  run(g, 12); assert.equal(g.s.flow, null);
  strike(g, boss, 'wallSqueeze'); const walls = g.s.bossFields.find(f => f.kind === 'walls');
  g.p.x = 1.5; g.p.y = walls.gaps[0].y + 5; fresh(g); const hp = g.p.hp; run(g, 3.1); assert.ok(g.p.hp < hp);
});

test('Press: the rhythm lanes come as his very next pattern once he drops below 66%, then join the round', () => {
  const { boss, g } = bossRoom(11);
  boss.hp = boss.maxHp * 0.7; assert.notEqual(g.nextBossPattern(boss), 'rhythmPress', 'not above 66%');
  boss.hp = boss.maxHp * 0.6; assert.equal(g.nextBossPattern(boss), 'rhythmPress', 'next, the moment it unlocks');
  assert.notEqual(g.nextBossPattern(boss), 'rhythmPress', 'then back to his round');
});

test('Press: nothing else starts while the walls are up (the rhythm lanes used to come down as they closed)', () => {
  const { g, boss } = bossRoom(11), ai = g.config.bossAI.directorPress;
  strike(g, boss, 'wallSqueeze');
  assert.ok(boss.ready >= g.s.time + ai.wallSeconds + ai.wallHold, 'ready only once the walls have opened');
});

test('Press: the closing walls shove Press and his crew ahead of them, so no body stands on a wall', () => {
  const { g, boss } = bossRoom(11);
  const ai = g.config.bossAI.directorPress, speed = ai.wallGapSpeed; ai.wallGapSpeed = 0; // the openings hold still, away from both bodies
  strike(g, boss, 'wallSqueeze'); const walls = g.s.bossFields.find(f => f.kind === 'walls');
  const crew = { ...boss, id: 'crew', boss: false, radius: 0.5, hp: 10, x: walls.ax + walls.w - 0.6, y: walls.gaps[1].y + 4 };
  g.s.enemies.push(crew);
  Object.assign(boss, { x: walls.ax + 0.8, y: walls.gaps[0].y + 4 });
  // Midway and at the close, each stands clear of the leading edge of the wall on its side.
  for (const seconds of [1.5, 1.6]) {
    run(g, seconds);
    assert.ok(boss.x - boss.radius * 0.8 >= walls.left - 1e-9 || Math.abs(boss.x - (walls.left + walls.right) / 2) < 1e-9, 'Press off the left wall');
    assert.ok(crew.x + crew.radius * 0.8 <= walls.right + 1e-9 || Math.abs(crew.x - (walls.left + walls.right) / 2) < 1e-9, 'crew off the right wall');
  }
  ai.wallGapSpeed = speed;
});

test('Press: every mould lies on open floor, clear of his body and of the others, wherever F2 stands', async () => {
  const { fitsMap } = await import('../src/engine/map-geometry.js');
  const { g, boss } = bossRoom(11), [x0, y0, x1, y1] = g.map.arena, ai = g.config.bossAI.directorPress;
  for (const [u, v] of [[0.05, 0.05], [0.5, 0.1], [0.95, 0.5], [0.5, 0.5], [0.1, 0.95], [0.5, 0.3]]) {
    g.s.bossFields = []; Object.assign(g.p, g.fbFloor(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, boss));
    g.fbMolds(boss, g.fbSample(), 1, true); const { molds } = g.s.bossFields.find(f => f.kind === 'molds');
    for (const m of molds) { assert.ok(fitsMap(m.x, m.y, 0.6, g.map), 'on the floor'); assert.ok(Math.hypot(m.x - boss.x, m.y - boss.y) > boss.radius + ai.moldRadius, 'not under him'); }
    for (let i = 0; i < molds.length; i++) for (let j = i + 1; j < molds.length; j++) assert.ok(Math.hypot(molds[i].x - molds[j].x, molds[i].y - molds[j].y) >= ai.moldRadius * 2.6 - 1e-9, 'apart');
  }
});

test('Press: only the mould just like the sample is safe; every other mould is its mirror image', () => {
  const { g, boss } = bossRoom(11);
  g.fbMolds(boss, g.fbSample(), 1);
  let molds = g.s.bossFields.find(f => f.kind === 'molds');
  assert.equal(molds.molds.filter(m => m.shape.same).length, 1);
  for (const m of molds.molds.filter(m => !m.shape.same)) assert.equal(Object.keys(molds.sample).filter(k => m.shape[k] !== molds.sample[k]).length, 1, 'one feature off');
  assert.ok(molds.molds.filter(m => !m.shape.same).every(m => m.shape.shape === molds.sample.shape && m.shape.flip !== molds.sample.flip), 'all the others are its mirror image');
  const same = molds.molds.find(m => m.shape.same); Object.assign(g.p, { x: same.x, y: same.y }); fresh(g); let hp = g.p.hp;
  run(g, g.config.bossAI.directorPress.moldChoose + 0.1); assert.equal(g.p.hp, hp, 'safe in the same mould');
  g.fbMolds(boss, g.fbSample(), 2); molds = g.s.bossFields.find(f => f.kind === 'molds' && !f.done);
  g.p.x += 30; fresh(g); hp = g.p.hp; run(g, g.config.bossAI.directorPress.moldChoose + 0.1); assert.ok(g.p.hp < hp && g.p.heldUntil > 0, 'pressed and held outside it');
});

test('Press: twin pistons follow F2 on both sides and slam in turns; stopping both leaves him reeling', () => {
  const { g, boss } = bossRoom(11), ai = g.config.bossAI.directorPress;
  boss.hp = boss.maxHp * 0.3; boss.breaksDone = [0, 1]; strike(g, boss, 'twinPistons');
  const f = g.s.bossFields.find(x => x.kind === 'twins'); assert.ok(f);
  for (let i = 0; i < 60 * 2; i++) { g.s.time += 1 / 60; g.p.invulnerableUntil = 1e9; g.tickFactoryBoss(1 / 60); }
  const [a, b] = f.twins; assert.ok(a.x < g.p.x && b.x > g.p.x, 'one on each side'); assert.ok(Math.abs(b.x - a.x) > 4, 'apart');
  for (const tw of f.twins) { Object.assign(g.p, { x: tw.x - 1, y: tw.y }); for (let k = 0; k < ai.twinHits; k++) { g.s.time += 0.2; g.fbSwing({ angle: 0 }, 1.6); } }
  g.s.time += 1 / 60; g.tickFactoryBoss(1 / 60);
  assert.ok(f.done); assert.ok(boss.exposedUntil > g.s.time);
});

test('Press rhythm press: seven beats over lanes that tile the floor, each pressing lanes picked at random (one on easy, two on normal, three on hard)', () => {
  const { g, boss } = bossRoom(11), ai = g.config.bossAI.directorPress;
  boss.hp = boss.maxHp * 0.6; boss.breaksDone = [0]; strike(g, boss, 'rhythmPress');
  const f = g.s.bossFields.find(x => x.kind === 'rhythm'); assert.equal(f.order.length, ai.rhythmBeats); assert.equal(ai.rhythmBeats, 7); assert.equal(f.lanes.length, ai.rhythmLanes);
  for (const beat of f.order) { assert.equal(beat.length, 2, 'two lanes a beat on normal'); assert.equal(new Set(beat).size, 2); }
  for (let i = 1; i < f.order.length; i++) assert.notEqual(f.order[i].join(), f.order[i - 1].join(), 'never the same set twice running');
  const first = f.order[0][0];
  Object.assign(g.p, { x: f.lanes[first], y: f.ay + f.h / 2 }); fresh(g); const hp = g.p.hp;
  run(g, f.beat * 1.2); assert.ok(g.p.hp < hp, 'pressed in a lane of the first beat');
  for (let i = 1; i < f.lanes.length; i++) assert.ok(Math.abs((f.lanes[i] - f.lw / 2) - (f.lanes[i - 1] + f.lw / 2)) < 1e-9, 'no gap between lanes');
  assert.ok(Math.abs(f.lanes[0] - f.lw / 2 - g.fbArena().x) < 1e-9 && Math.abs(f.lanes.at(-1) + f.lw / 2 - g.fbArena().x - g.fbArena().w) < 1e-9, 'side to side');
  // Standing in a lane no beat picks is the only safe place.
  const missed = f.lanes.findIndex((_, i) => f.order.slice(1).every(beat => !beat.includes(i)));
  if (missed >= 0) { Object.assign(g.p, { x: f.lanes[missed] }); fresh(g); const hp2 = g.p.hp; run(g, f.beat * 9); assert.equal(g.p.hp, hp2, 'a lane no later beat picks is safe'); } else run(g, f.beat * 9);
  assert.ok(f.done);
  const levels = Object.fromEntries(data.slice.difficulty.levels.map(l => [l.id, l.bossRepeats.rhythmCount]));
  assert.deepEqual(levels, { easy: 1, normal: 2, hard: 3 });
});

test('Press two rows: three bands tile the floor top to bottom, and only the safe one is spared', () => {
  const { g, boss } = bossRoom(11);
  const t = tell(g, boss, 'twoRows'), rows = t.rows, { top, bottom } = g.fbFloorSpan();
  assert.equal(rows.length, 3); assert.ok(Math.abs(rows[0].y - rows[0].half - top) < 1e-9 && Math.abs(rows[2].y + rows[2].half - bottom) < 1e-9, 'top to bottom');
  for (let i = 1; i < 3; i++) assert.ok(Math.abs((rows[i - 1].y + rows[i - 1].half) - (rows[i].y - rows[i].half)) < 1e-9, 'no gap between bands');
  const safe = rows.find(r => r.safe), pressed = rows.find(r => !r.safe);
  // Between two pressed rows there is no gap to stand in any more: standing anywhere in a pressed band is hit.
  for (const [y, hurt] of [[safe.y, false], [pressed.y + pressed.half * 0.9, true]]) {
    const run2 = bossRoom(11); const t2 = tell(run2.g, run2.boss, 'twoRows'); t2.rows = rows.map(r => ({ ...r }));
    Object.assign(run2.g.p, { x: run2.boss.x + 4, y }); fresh(run2.g); const hp = run2.g.p.hp; run2.g.s.time = t2.until; run2.g.executeEnemy(run2.boss);
    assert.equal(run2.g.p.hp < hp, hurt, `y ${y.toFixed(2)}`);
  }
});


test('Press crane: the shadow follows F2 and the claw carries her off unless she wriggles out; a guard under it falls on him', () => {
  const { g, boss } = bossRoom(11), ai = g.config.bossAI.directorPress;
  Object.assign(g.p, { x: boss.x + 6, y: boss.y + 3 }); strike(g, boss, 'craneGrab'); boss.ready = 1e9;
  const f = g.s.bossFields.find(x => x.kind === 'crane');
  run(g, ai.craneChase + ai.craneWarn + 0.1); assert.equal(f.carry, 'f2'); assert.ok(g.p.grabbed?.crane, 'caught');
  for (let i = 0; i < ai.craneEscape; i++) { g.p.dodge = { angle: 0, started: g.s.time + i }; run(g, 0.05); }
  assert.equal(g.p.grabbed, null, 'wriggled out'); assert.ok(f.done);
  // Lured onto a guard: the claw takes the guard and drops it on Press.
  const guard = g.spawnEnemy('pressGuard', { x: boss.x - 6, y: boss.y + 3 }); guard.ready = 1e9; guard.speed = 0;
  Object.assign(g.p, { x: guard.x, y: guard.y }); boss.tell = null; strike(g, boss, 'craneGrab'); boss.ready = 1e9;
  const f2 = g.s.bossFields.find(x => x.kind === 'crane' && !x.done);
  run(g, ai.craneChase); Object.assign(g.p, { x: guard.x + 4, y: guard.y }); run(g, ai.craneWarn + ai.craneCarry + 0.2);
  assert.equal(f2.carry, guard.id); assert.equal(guard.hp, 0); assert.ok(boss.exposedUntil > g.s.time);
});

test('Press gauge: below a third each pattern pumps it; full, steam fills the floor but an opened valve keeps F2 safe', () => {
  const { g, boss } = bossRoom(11), ai = g.config.bossAI.directorPress;
  boss.hp = boss.maxHp * 0.3; boss.breaksDone = [0, 1]; g.fbStep(boss, 1 / 60);
  const valves = g.s.bossFields.find(x => x.kind === 'valves'); assert.equal(valves.valves.length, 4);
  for (let i = 0; i < 4; i++) { boss.tell = null; strike(g, boss, 'plateDrop'); } assert.equal(boss.pressure, 100);
  const v = valves.valves[0]; Object.assign(g.p, { x: v.x - 1, y: v.y });
  for (let i = 0; i < ai.valveHits; i++) { g.s.time += 0.2; g.fbSwing({ angle: 0 }, 1.6); } assert.ok(v.openUntil > g.s.time, 'valve open');
  boss.tell = null; g.fbStep(boss, 1 / 60); assert.equal(boss.tell?.type, 'steamBurst');
  Object.assign(g.p, { x: v.x, y: v.y + 0.5 }); fresh(g); let hp = g.p.hp; g.s.time = boss.tell.until; g.executeEnemy(boss);
  assert.equal(g.p.hp, hp, 'safe beside the open valve'); assert.equal(boss.pressure, 0);
  boss.pressure = 100; boss.tell = null; g.fbStep(boss, 1 / 60); v.openUntil = 0; fresh(g); hp = g.p.hp; g.s.time = boss.tell.until; g.executeEnemy(boss); assert.ok(g.p.hp < hp, 'steamed with the valve shut');
  boss.pressure = 50; g.hitEnemy(boss, boss.maxHp * 0.05, {}); assert.ok(boss.pressure < 50, 'hard blows let pressure out');
});

test('Press: the final press is stopped by enough damage in time; otherwise only the safe cell is spared', () => {
  const { g, boss } = bossRoom(11);
  tell(g, boss, 'finalPress'); g.hitEnemy(boss, boss.maxHp * 0.08, { dot: true });
  assert.equal(boss.tell, null);
  g.s.time += 10; const t = tell(g, boss, 'finalPress'); g.p.x = t.safe.x; g.p.y = t.safe.y; fresh(g); const hp = g.p.hp; g.s.time = t.until; g.executeEnemy(boss);
  assert.equal(g.p.hp, hp, 'safe cell');
});

test('Press breaks: plates lured onto three pylons break the first shield; three matched moulds break the last', () => {
  const { g, boss } = bossRoom(11);
  boss.hp = boss.maxHp * 0.65; g.checkPhaseBreak(boss); assert.equal(boss.breaking?.kind, 'pylons');
  for (const py of [...boss.breaking.pylons].slice(0, 3)) { Object.assign(g.p, { x: py.x, y: py.y }); for (let i = 0; i < 60 * 2.4 && !py.broken && boss.breaking; i++) { g.s.time += 1 / 60; g.p.invulnerableUntil = 1e9; g.updatePhaseBreak(boss, 1 / 60); } }
  if (boss.breaking) g.updatePhaseBreak(boss, 1 / 60); assert.equal(boss.breaking, null, 'pylons broke it');
  g.s.time += 5; boss.hp = boss.maxHp * 0.32; g.checkPhaseBreak(boss); assert.equal(boss.breaking?.kind, 'molds');
  const step = s => { for (let i = 0; i < Math.round(s * 60) && boss.breaking; i++) { g.s.time += 1 / 60; g.tickFactoryBoss(1 / 60); g.updatePhaseBreak(boss, 1 / 60); } };
  // One wrong round (standing far off) costs health and counts nothing.
  step(1.3); let molds = g.s.bossFields.find(f => f.kind === 'molds' && f.brk); assert.ok(molds, 'the first moulds are out');
  g.p.x += 30; fresh(g); let hp = g.p.hp; step(g.config.bossAI.directorPress.moldChoose + 0.1); assert.ok(g.p.hp < hp); assert.equal(boss.breaking.matched, 0);
  for (let round = 0; round < 3 && boss.breaking; round++) {
    step(1.3); molds = g.s.bossFields.find(f => f.kind === 'molds' && f.brk);
    const same = molds.molds.find(m => m.shape.same); Object.assign(g.p, { x: same.x, y: same.y, heldUntil: 0 }); fresh(g); step(g.config.bossAI.directorPress.moldChoose + 0.1);
  }
  assert.equal(boss.breaking, null, 'three matches broke it'); assert.ok(boss.breaksDone.includes(1));
  assert.ok(!g.s.bossFields.some(f => f.brk && !f.done && ['molds', 'sample'].includes(f.kind)), 'no moulds left over');
});

test('the difficulty sets the chapter 2 bosses too: stamps, plates, moulds, guards, and each break\'s numbers and time', () => {
  const levels = Object.fromEntries(data.slice.difficulty.levels.map(l => [l.id, l]));
  assert.deepEqual(['easy', 'normal', 'hard'].map(id => levels[id].bossRepeats.moldCount), [4, 5, 6], 'moulds 4, 5, 6 as planned');
  for (const id of ['easy', 'normal', 'hard']) {
    const { bossRepeats: reps, phaseBreaks: breaks } = levels[id];
    const iris = bossRoom(4); iris.g.s.run.difficulty = id;
    // Counted as they come down: a red mark under F2's feet goes at once (stepped on).
    strike(iris.g, iris.boss, 'rejectStamps');
    assert.equal(iris.g.s.bossFields.filter(f => f.kind === 'stamp' && !f.done).length, reps.stampCount, `${id} stamps`); run(iris.g, 3);
    iris.boss.hp = iris.boss.maxHp * 0.49; iris.g.checkPhaseBreak(iris.boss);
    assert.equal(iris.boss.breaking.until - iris.boss.breaking.started, breaks.mirrors.seconds, `${id} mirror time`);
    assert.equal(iris.g.breakRule(iris.boss, 0).sweepDegrees, breaks.mirrors.sweepDegrees);
    const press = bossRoom(11); press.g.s.run.difficulty = id;
    assert.equal(tell(press.g, press.boss, 'plateDrop').drops.length, reps.plates, `${id} plates`);
    press.g.fbMolds(press.boss, press.g.fbSample(), 1);
    assert.equal(press.g.s.bossFields.find(f => f.kind === 'molds').molds.length, reps.moldCount, `${id} moulds`);
    assert.equal(press.g.bossRepeat(press.boss, 'guardMax'), reps.guardMax);
    assert.equal(press.g.breakRule(press.boss, 0).need, breaks.pylons.need);
    assert.equal(press.g.breakRule(press.boss, 1).need, breaks.molds.need, `${id} moulds to match`);
    assert.equal(press.g.breakRule(press.boss, 1).seconds, breaks.molds.seconds);
  }
});

test('the difficulty sets the bosses\' openings: Iris\'s counter window, grid look, decoy hunt and helpers; Press\'s stuck arm and wall gap', () => {
  for (const id of ['easy', 'normal', 'hard']) {
    const reps = data.slice.difficulty.levels.find(l => l.id === id).bossRepeats;
    const iris = bossRoom(4); iris.g.s.run.difficulty = id;
    assert.equal(iris.g.bossRepeat(iris.boss, 'verdictWindow'), reps.verdictWindow);
    const decoys = tell(iris.g, iris.boss, 'decoys'); assert.ok(Math.abs(decoys.until - decoys.started - reps.decoySeconds) < 1e-9, `${id} decoy time`);
    iris.boss.tell = null; strike(iris.g, iris.boss, 'gridCheck');
    const grid = iris.g.s.bossFields.find(f => f.kind === 'grid'); assert.ok(Math.abs(grid.show - iris.g.s.time - reps.gridShow - iris.g.config.bossAI.inspectorIris.gridReach) < 1e-9, `${id} grid look`);
    iris.boss.breaksDone = [0]; const before = iris.g.s.enemies.length; iris.g.fbStep(iris.boss, 1 / 60);
    assert.equal(iris.g.s.enemies.length - before, reps.lensHelpers, `${id} helpers`);
    const press = bossRoom(11); press.g.s.run.difficulty = id;
    press.g.p.x = press.boss.x + 2; press.g.p.y = press.boss.y; strike(press.g, press.boss, 'armSlam');
    assert.ok(Math.abs(press.boss.armStuck.until - press.g.s.time - reps.armStuck) < 1e-9, `${id} stuck arm`);
    press.boss.tell = null; strike(press.g, press.boss, 'wallSqueeze');
    assert.equal(press.g.s.bossFields.find(f => f.kind === 'walls').gap, reps.wallGap, `${id} wall gap`);
  }
});

test('Iris: her red reject mark on the floor pins one failing tag on F2 when stepped on, then goes', () => {
  const { g, boss } = bossRoom(4);
  g.fbField({ kind: 'stamp', x: g.p.x + 4, y: g.p.y, radius: 1, from: g.s.time, at: g.s.time + 0.05, pass: false, damage: 0 });
  run(g, 0.1);
  const mark = g.s.casts.find(c => c.look === 'stamp' && !c.done); assert.ok(mark, 'the mark is laid');
  run(g, 2); assert.ok(!mark.done, 'it stays while nobody steps on it');
  const stacks = g.p.failStacks || 0;
  Object.assign(g.p, { x: mark.x, y: mark.y }); run(g, 0.6);
  assert.ok(mark.done, 'gone after the step');
  assert.equal(g.p.failStacks, stacks + 1, 'one failing tag for the step');
});


test('a shield starting clears every attack under way, but the bodies the boss called stay', () => {
  const { g, boss } = bossRoom(11);
  strike(g, boss, 'lineShift'); strike(g, boss, 'wallSqueeze'); boss.ready = 0;
  strike(g, boss, 'callGuards');
  g.s.projectiles.push({ id: 'shot', x: 1, y: 1, angle: 0, speed: 1, radius: 0.2, damage: 5, friendly: false, until: g.s.time + 5 });
  g.s.ranks = [{ at: 0.2 }];
  const guards = g.s.enemies.filter(e => !e.boss && e.hp > 0).length + (g.s.run.arrivals?.length || 0);
  assert.ok(g.s.flow && g.s.bossFields.some(f => f.kind === 'walls'), 'patterns were under way');
  boss.hp = boss.maxHp * 0.6; g.checkPhaseBreak(boss);
  assert.ok(boss.breaking, 'the shield is up');
  assert.equal(g.s.flow, null); assert.ok(!g.s.bossFields.some(f => f.kind === 'walls'), 'walls gone');
  assert.equal(g.s.projectiles.filter(p => !p.friendly).length, 0); assert.equal(g.s.ranks.length, 0);
  assert.equal(g.s.enemies.filter(e => !e.boss && e.hp > 0).length + (g.s.run.arrivals?.length || 0), guards, 'called bodies stay');
});

test('Press waits in his hall while F2 walks up the corridor; laser gates then hold F2 in the hall until he is down', () => {
  const { g, boss } = bossRoom(11), hall = g.fbArena(), spawn = g.map.spawn;
  // F2 in the corridor: no patterns, no harm done to him, no gate yet.
  g.p.x = spawn.x; g.p.y = spawn.y; boss.ready = 0;
  const hp = boss.hp;
  g.updateEnemies(1 / 60);
  assert.equal(boss.tell, null); assert.ok(g.fbHallWaiting());
  g.hitEnemy(boss, 50); assert.equal(boss.hp, hp);
  assert.ok(!g.s.hazards.some(h => h.kind === 'hallGate'));
  // Inside the hall: both gates shut and he starts after the first pause.
  g.p.y = hall.y + hall.h - 1; g.updateEnemies(1 / 60);
  assert.equal(g.s.hazards.filter(h => h.kind === 'hallGate').length, 2);
  assert.ok(!g.fbHallWaiting()); assert.ok(g.fbHallShut());
  // F2 cannot walk or dodge out of the bottom or the top.
  g.move(g.p, 0, 6); assert.ok(g.p.y <= hall.y + hall.h + 1e-9, `y ${g.p.y}`);
  g.p.x = 14.4; g.p.y = hall.y + 1; g.move(g.p, 0, -4); assert.ok(g.p.y >= hall.y - 1e-9, `y ${g.p.y}`);
  // Down: the gates go and the corridor and the exit open again.
  boss.hp = 0; g.fbHallGates();
  assert.ok(!g.s.hazards.some(h => h.kind === 'hallGate'));
  g.move(g.p, 0, -1); assert.ok(g.p.y < hall.y);
});

test('Iris\'s room has no hall gates: she fights at once', () => {
  const { g } = bossRoom(4);
  assert.ok(!g.fbHallWaiting()); g.tickFactoryBoss(1 / 60);
  assert.ok(!g.s.hazards?.some(h => h.kind === 'hallGate'));
});

test('Press speaks only once the hall gates have shut behind F2 (fbHallReady); Iris at once', () => {
  const { g, boss } = bossRoom(11), hall = g.fbArena();
  g.p.x = g.map.spawn.x; g.p.y = g.map.spawn.y; g.tickFactoryBoss(1 / 60);
  assert.ok(!g.fbHallReady());
  // Stepped in: until the next tick shuts the gates, still not ready.
  g.p.x = 14.4; g.p.y = hall.y + hall.h - 1; assert.ok(!g.fbHallReady());
  g.tickFactoryBoss(1 / 60); assert.ok(g.fbHallReady());
  boss.hp = 0; assert.ok(g.fbHallReady());
  assert.ok(bossRoom(4).g.fbHallReady());
});

test('chapter 2 bosses\' set pattern damage follows the difficulty like their blows (easy < normal < hard)', () => {
  const hit = level => { const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub'; assert.ok(g.startRun(7, level, 'silent-factory')); return g.fbFixed(g.config.bossAI.directorPress.steamDamage); };
  const [easy, normal, hard] = ['easy', 'normal', 'hard'].map(hit);
  assert.ok(easy < normal && normal < hard, `${easy} < ${normal} < ${hard}`);
  const scale = Object.fromEntries(data.slice.difficulty.levels.map(l => [l.id, l.scale]));
  assert.equal(normal, Math.round(data.slice.bossAI.directorPress.steamDamage * scale.normal * (data.slice.chapters.find(c => c.id === 'silent-factory').scale ?? 1)));
});
