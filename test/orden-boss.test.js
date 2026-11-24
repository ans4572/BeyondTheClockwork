import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { floorDistance, segmentDistance, FLOOR_FLAT } from '../src/engine/math.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));

// Orden in the belfry's round room (his own rooms are wired separately): Belgard taken out, Orden spawned in his place.
function chamber(type = 'orden') {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  assert.ok(g.startRun(7, 'normal', 'clock-tower'));
  g.s.run.node = g.rooms.findIndex(room => room.boss === 'bellguard'); g.enterNode(); g.s.entry = null;
  const at = g.s.enemies.find(e => e.boss); g.s.enemies = [];
  const od = g.spawnEnemy(type, { x: at.x, y: at.y });
  Object.assign(g.p, { hp: 5000, maxHp: 5000, dodge: null, invulnerableUntil: 0 });
  g.p.x = od.x - 4; g.p.y = od.y + 1;
  return { g, od, ai: g.config.bossAI[type] };
}
// Orden 1 in his own tuning chamber (tower-10), as the game has him: the stop-time maze is laid on its floor's painted
// dial (maps.json dial; odDialScatter). F2 stands in the dial's outer band, left of him.
function tuning() {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  assert.ok(g.startRun(7, 'normal', 'clock-tower'));
  g.s.run.node = g.rooms.findIndex(room => room.boss === 'orden'); g.enterNode(); g.s.entry = null;
  const od = g.s.enemies.find(e => e.boss && e.type === 'orden'), dial = g.map.dial;
  assert.ok(od && dial, 'Orden in a room with a dial');
  Object.assign(g.p, { hp: 5000, maxHp: 5000, dodge: null, invulnerableUntil: 0, x: dial.x - dial.rx * 0.8, y: dial.y });
  return { g, od, dial, rule: g.breakRule(od, 0) };
}
/** Takes him to half health and runs the break's scatter until time stops. */
function stopTime(g, od) {
  od.hp = od.maxHp * 0.49; g.checkPhaseBreak(od);
  const b = od.breaking;
  assert.equal(b?.kind, 'stopTime');
  for (let i = 0; i < 90 && b.phase !== 'stop'; i++) g.updateEnemies(1 / 60, g.s.time += 1 / 60);
  assert.equal(b.phase, 'stop');
  return b;
}
/** How near a needle of the break (bulletHalf either side of its spot) comes to `at`. */
// (Measured on the floor as F2's feet stand, up and down FLOOR_FLAT-fold, as odNeedlesNear does since 2026-11-22.)
const needleGap = (q, at, half) => { const dx = Math.cos(q.angle) * half, dy = Math.sin(q.angle) * half, f = pt => ({ x: pt.x, y: pt.y / FLOOR_FLAT }); return segmentDistance(f(at), f({ x: q.x - dx, y: q.y - dy }), f({ x: q.x + dx, y: q.y + dy })); };
/** Starts `type` now (its tell plan made as a real tell would), then runs the spell out on the floor. */
const cast = (g, od, type) => { g.beginEnemyTell(od, type, 0.01); g.s.time += 0.02; g.updateEnemies(0.02); };
const step = (g, seconds, each) => { for (let i = 0; i < Math.round(seconds * 60); i++) { g.s.time += 1 / 60; g.p.invulnerableUntil = 0; g.tickOrdenBoss(1 / 60); each?.(); } };

test('Orden and his last hour stand with their own sprites and health', () => {
  for (const type of ['orden', 'ordenFinal']) {
    const { od, ai } = chamber(type);
    assert.equal(od.sprite, ai.sprite); assert.ok(od.boss);
    assert.ok(od.maxHp > 0 && ai.round.length > 0);
  }
});

test('every spell of both fights runs out on the floor without throwing, and leaves the floor clear', () => {
  for (const [type, extra] of [['orden', ['odMarch', 'odPress', 'odRings', 'odClones']], ['ordenFinal', ['odLastHour']]]) {
    const { ai } = chamber(type);
    for (const spell of new Set([...ai.round, ...(ai.round2 || []), ...extra])) {
      const { g, od } = chamber(type);
      g.p.x = od.x - 4; cast(g, od, spell);
      step(g, 9);
      const left = (g.s.bossFields || []).filter(f => f.kind.startsWith('od') && !f.done);
      assert.deepEqual(left.map(f => f.kind), [], `${type} ${spell} left ${left.map(f => f.kind)}`);
    }
  }
});

test('the element lanes never leave F2 safe where she stands, and the safe lane spares her', () => {
  const { g, od } = chamber();
  for (let n = 0; n < 4; n++) {
    g.beginEnemyTell(od, 'odLanes', 0.01);
    const bar = od.tell.lanes[0];
    assert.notEqual(bar.safe, bar.here, 'the safe lane is never the one she is in');
    assert.equal(new Set(bar.safes).size, 4, 'four safe lanes of seven (2026-11-21)'); assert.equal(bar.lanes.length, 7); assert.ok(!bar.safes.includes(bar.here));
    // Stand in each bar's safe lane as it blows: no harm.
    const middle = r => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
    Object.assign(g.p, { y: middle(bar.lanes[bar.safe]).y });
    g.s.time += 0.02; g.updateEnemies(0.02);
    const f = g.s.bossFields.find(x => x.kind === 'odLanes' && !x.done);
    const hp = g.p.hp;
    step(g, 3, () => { for (const b of f.bars) if (!b.done) { const sl = b.lanes[b.safe]; if (b.axis === 'y') g.p.y = middle(sl).y; else g.p.x = middle(sl).x; } });
    assert.ok(g.p.hp >= hp - 6, `${f.bars[0].element}: hurt ${hp - g.p.hp} in the safe lanes`);
    od.tell = null; od.busyUntil = 0; g.s.bossFields = [];
  }
  assert.equal(od.odElement, 3, 'four casts went through fire, ice, lightning and wind');
});

test('an orb struck back with the wrench hurts Orden; a dark orb bursts instead', () => {
  const { g, od } = chamber('ordenFinal');
  cast(g, od, 'odOrbs');
  const f = g.s.bossFields.find(x => x.kind === 'odOrbs'), bright = f.orbs.find(o => !o.dark), dark = f.orbs.find(o => o.dark);
  assert.ok(bright && dark);
  for (const o of f.orbs) if (o !== bright) o.state = 'gone';
  Object.assign(g.p, { x: bright.x - 1, y: bright.y }); const hp = od.hp;
  g.odSwing({ angle: 0 }, 1.5);
  assert.equal(bright.state, 'back');
  step(g, 3);
  assert.ok(od.hp < hp, 'the orb came home and hurt him');
});

test('the half-health break on his dial: five watches in the maze, needles laid, the hands turning, all five broken end it', () => {
  const { g, od, dial, rule } = tuning(), TAU = Math.PI * 2, rings = rule.mazeRingsAt;
  const b = stopTime(g, od);
  assert.equal(b.dial, dial, 'the maze is the painted dial');
  assert.equal(b.hearts.length, 5, 'five watches (2026-11-20)');
  // Each watch at the middle of one of the dial's 24 sectors (twelve hour marks, two bands), never on a wall.
  for (const h of b.hearts) {
    const u = (h.x - dial.x) / dial.rx, v = (h.y - dial.y) / dial.ry, s = Math.hypot(u, v), turn = (((Math.atan2(v, u) % TAU) + TAU) % TAU) / TAU * 12;
    assert.ok(s > rings[0] && s < rings.at(-1), `a watch off the maze (${s.toFixed(2)})`);
    assert.ok(Math.abs(turn - Math.floor(turn) - 0.5) < 1e-6, 'a watch off its sector middle');
  }
  const walls = b.bullets.filter(q => !q.hand), hands = b.bullets.filter(q => q.hand && !q.off);
  assert.ok(walls.length > 30 && hands.length > 4, `walls ${walls.length}, hands ${hands.length}`);
  for (const h of b.hearts) assert.ok(walls.every(q => needleGap(q, h, rule.bulletHalf) > 0.8 - 1e-9), 'a needle wall on a watch');
  // The hands turn on through stopped time.
  const before = hands.map(q => ({ x: q.x, y: q.y }));
  for (let i = 0; i < 60; i++) { g.p.invulnerableUntil = 0; g.updateEnemies(1 / 60, g.s.time += 1 / 60); }
  assert.ok(hands.some((q, i) => Math.hypot(q.x - before[i].x, q.y - before[i].y) > 0.5), 'the hands moved');
  for (const h of b.hearts) { Object.assign(g.p, { x: h.x - 1, y: h.y }); for (let k = 0; k < 2; k++) { g.s.time += 0.3; g.odSwing({ angle: 0 }, 1.5); } }
  g.s.time += 0.02; g.updateEnemies(0.02);
  assert.equal(od.breaking, null, 'the shield broke');
  assert.ok(!(od.exposedUntil > g.s.time), 'and he does not hang open (2026-11-21)');
});

test('in stopped time a dodge stops at a needle wall unhurt, never set back onto a hand, and the stop never starts with F2 in a wall', () => {
  const { g, od, rule } = tuning(), R = g.config.arena.playerRadius, reach = rule.bulletRadius + R;
  // Walking onto a needle's landing spot as it flies in: when time stops she is set back clear of it.
  od.hp = od.maxHp * 0.49; g.checkPhaseBreak(od);
  const b = od.breaking, wall = b.bullets.find(q => !q.hand && g.bgOpen({ x: q.tx, y: q.ty }, 0.4));
  for (let i = 0; i < 90 && b.phase !== 'stop'; i++) { if (b.phaseAt - g.s.time < 0.2) Object.assign(g.p, { x: wall.tx, y: wall.ty }); g.updateEnemies(1 / 60, g.s.time += 1 / 60); }
  assert.equal(b.phase, 'stop');
  const walls = b.bullets.filter(q => !q.hand && !q.gone), hands = b.bullets.filter(q => q.hand && !q.gone && !q.off);
  assert.ok(walls.every(q => needleGap(q, g.p, rule.bulletHalf) >= reach), 'the stop began with her in a wall');
  // A dodge into a wall: back where she last stood clear, the dodge over, no harm.
  const hp = g.p.hp, safe = { ...b.safeAt };
  g.p.dodge = { angle: 0, elapsed: 0, duration: 0.3 }; Object.assign(g.p, { x: walls[5].x, y: walls[5].y });
  g.odBreakStep(od, rule, 1 / 60);
  assert.equal(g.p.dodge, null); assert.equal(g.p.hp, hp, 'unhurt');
  assert.deepEqual({ x: g.p.x, y: g.p.y }, safe, 'set back where she stood');
  // Her last clear spot since swept by a hand: she is set beside it, on no needle.
  const hand = hands[Math.floor(hands.length / 2)]; b.safeAt = { x: hand.x, y: hand.y };
  g.p.dodge = { angle: 0, elapsed: 0, duration: 0.3 }; Object.assign(g.p, { x: walls[5].x, y: walls[5].y });
  g.odBreakStep(od, rule, 1 / 60);
  assert.equal(g.p.dodge, null);
  assert.ok([...walls, ...hands].every(q => needleGap(q, g.p, rule.bulletHalf) >= reach), 'set back onto a needle');
});

test('the minute hand leaves a gap in the outer band where F2 can stand as it passes (2026-11-22)', () => {
  // It reached over the whole dial and outran her (the user's word: often no room to get out of its way).
  const { g, od, dial, rule } = tuning();
  const b = stopTime(g, od), R = g.config.arena.playerRadius, reach = rule.bulletRadius + R, rings = rule.mazeRingsAt;
  assert.ok(rule.handGap > 2 * reach, 'the gap is wider than F2 and the needles reach');
  const minute = b.bullets.filter(q => q.hand?.gap), turn = TAU => 1 / rule.mazeHands[0];
  assert.ok(minute.length > 0, 'the minute hand carries the gap');
  // Over a whole turn, a spot in the middle of the outer band, at any of 24 angles, is never touched by the minute hand.
  const mid = (rings[1] + rings[2]) / 2;
  for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12, spot = { x: dial.x + Math.cos(a) * dial.rx * mid, y: dial.y + Math.sin(a) * dial.ry * mid };
    for (let since = 0; since < turn(); since += 1 / 120) {
      for (const q of minute) {
        g.odHandAt(dial, q.hand, since, q);
        if (!q.off) assert.ok(needleGap(q, spot, rule.bulletHalf) >= reach - 1e-6, `touched at ${k * 15}° after ${since.toFixed(2)} s`);
      }
    }
  }
  // And it still sweeps the rest: the inner band's middle is touched once a turn.
  const inner = (rings[0] + rings[1]) / 2, spot = { x: dial.x - dial.rx * inner, y: dial.y };
  let touched = false;
  for (let since = 0; since < turn() && !touched; since += 1 / 120) for (const q of minute) { g.odHandAt(dial, q.hand, since, q); if (!q.off && needleGap(q, spot, rule.bulletHalf) < reach) touched = true; }
  assert.ok(touched, 'the inner band is still swept');
});

test('in a room with no dial painted the stop-time maze is laid on a dial fitted to the floor', () => {
  const { g, od } = chamber();
  assert.ok(!g.map.dial);
  od.hp = od.maxHp * 0.49; g.checkPhaseBreak(od);
  const b = od.breaking, room = g.bgRoom();
  assert.ok(b.dial.x > room.left && b.dial.x < room.right && b.dial.y > room.top && b.dial.y < room.bottom && b.dial.rx > 0 && b.dial.ry > 0);
  assert.equal(b.hearts.length, 5);
  assert.ok(b.hearts.every(h => floorDistance(h, od) > 1), 'the watches stand out in the maze');
  assert.ok(b.bullets.length > 20);
});

test('his images cast with him, but only his bolts hurt', () => {
  const { g, od, ai } = chamber();
  od.breaksDone = [0];
  cast(g, od, 'odClones');
  const images = g.s.enemies.filter(e => e.odClone);
  assert.equal(images.length, 2);
  step(g, ai.cloneCast + 0.1);
  const volleys = g.s.bossFields.filter(f => f.kind === 'odBolts');
  assert.equal(volleys.length, 3);
  assert.equal(volleys.filter(v => v.volleys.every(x => x.fake)).length, 2, 'two of the three volleys are fakes');
});

test('the element spells (2026-11-20): fire spreads out from where F2 stood, mirrors bend needles and break, the chain jumps rod to rod, the vortex pulls, the quartet spares only the dark quarter', () => {
  // Fire: it lands under her and runs outward; the far cells catch later than the near ones.
  { const { g, od } = chamber(); const seed = { x: g.p.x, y: g.p.y }; cast(g, od, 'odFireSpread'); const f = g.s.bossFields.find(x => x.kind === 'odFire');
    const near = f.cells.reduce((m, c) => (Math.hypot(c.x - seed.x, c.y - seed.y) < Math.hypot(m.x - seed.x, m.y - seed.y) ? c : m)), far = f.cells.reduce((m, c) => (Math.hypot(c.x - seed.x, c.y - seed.y) > Math.hypot(m.x - seed.x, m.y - seed.y) ? c : m));
    assert.ok(far.at > near.at, 'it spreads');
    const hp = g.p.hp; step(g, 2, () => Object.assign(g.p, { x: seed.x, y: seed.y })); assert.ok(g.p.hp < hp, 'standing where it landed burns'); }
  // Mirrors: a needle at a crystal turns toward F2; two wrench blows break one.
  { const { g, od } = chamber(); cast(g, od, 'odIceMirror'); const m = g.s.bossFields.find(x => x.kind === 'odMirror'); assert.ok(m.pillars.length >= 2);
    const bolts = g.s.bossFields.find(x => x.kind === 'odBolts'); let bent = false; step(g, 2.5, () => { if (bolts.bolts.some(b => b.bent)) bent = true; }); assert.ok(bent, 'a needle was bent');
    const { g: g2, od: od2 } = chamber(); cast(g2, od2, 'odIceMirror'); const m2 = g2.s.bossFields.find(x => x.kind === 'odMirror'), q = m2.pillars[0];
    for (let i = 0; i < 2; i++) { g2.s.time += 0.3; g2.p.x = q.x - 1; g2.p.y = q.y; g2.odSwing({ angle: 0 }, 1.6); } assert.ok(q.broken, 'two blows break it'); }
  // Chain (2026-11-21, chasing): each bolt comes down where F2 stood as its warning began; standing still is struck, and
  // the live bolt left between two rods hurts to cross; running clear of both is safe.
  { const { g, od } = chamber(); cast(g, od, 'odChain'); const f = g.s.bossFields.find(x => x.kind === 'odChain');
    assert.equal(f.strikes.length, 6); assert.ok(f.strikes.every((st, i) => !i || st.at > f.strikes[i - 1].at), 'one bolt after another');
    const hp = g.p.hp; step(g, 1.2, () => g.p.invulnerableUntil = 0); assert.ok(g.p.hp < hp, 'standing still is struck');
    assert.equal(f.rods.filter(Boolean).length >= 1, true);
    const { g: g2, od: od2 } = chamber(); cast(g2, od2, 'odChain'); const f2 = g2.s.bossFields.find(x => x.kind === 'odChain');
    // Step two units on before each warning begins, so every bolt lands where she was; then stand on the first live bolt.
    let k = 0; step(g2, 1.6, () => { g2.p.invulnerableUntil = 0; if (f2.strikes.some(st => st.x !== undefined && !st.done && st.x === g2.p.x)) g2.p.x += 2.4 * (++k % 2 ? 1 : -1); });
    const ln = f2.links[0]; assert.ok(ln, 'a live bolt between the first two rods');
    const a = f2.rods[ln.a], b = f2.rods[ln.b], hp2 = g2.p.hp; Object.assign(g2.p, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); g2.p.invulnerableUntil = 0;
    step(g2, 0.6); assert.ok(g2.p.hp < hp2, 'crossing a live bolt hurts'); }
  // Frost nova: two rings with openings between each other's; standing in an opening of the first ring it passes her.
  { const { g, od } = chamber(); cast(g, od, 'odFrostNova'); const f = g.s.bossFields.find(x => x.kind === 'odNova');
    assert.equal(f.rings.length, 2); assert.notEqual(f.rings[0].gaps[0], f.rings[1].gaps[0]);
    const gp = f.rings[0].gaps[0], hp = g.p.hp; Object.assign(g.p, { x: f.x + Math.cos(gp) * 4, y: f.y + Math.sin(gp) * 4 * 0.5 });
    step(g, f.rings[0].at - g.s.time + 4 / f.speed + 0.2, () => g.p.invulnerableUntil = 0); assert.equal(g.p.hp, hp, 'the opening spares her');
    const { g: g2, od: od2 } = chamber(); cast(g2, od2, 'odFrostNova'); const f2 = g2.s.bossFields.find(x => x.kind === 'odNova');
    const solid = f2.rings[0].gaps[0] + Math.PI / f2.rings[0].gaps.length, hp2 = g2.p.hp; Object.assign(g2.p, { x: f2.x + Math.cos(solid) * 4, y: f2.y + Math.sin(solid) * 4 * 0.5 });
    step(g2, f2.rings[0].at - g2.s.time + 4 / f2.speed + 0.2, () => g2.p.invulnerableUntil = 0); assert.ok(g2.p.hp < hp2, 'the ice ring hurts'); assert.ok(g2.odSlow(g2.p) > 0, 'and slows'); }
  // Vortex: it draws her toward it.
  { const { g, od } = chamber(); cast(g, od, 'odVortex'); const f = g.s.bossFields.find(x => x.kind === 'odVortex'); g.p.x = f.x + 4; g.p.y = f.y; const d0 = floorDistance(g.p, f);
    step(g, 1); assert.ok(floorDistance(g.p, f) < d0 - 0.5, 'pulled in'); }
  // Quartet: three quarters lit with different elements; the dark one is safe, a lit one is not.
  for (const dark of [true, false]) {
    const { g, od } = chamber(); cast(g, od, 'odQuartet'); const f = g.s.bossFields.find(x => x.kind === 'odQuartet');
    assert.equal(f.quads.filter(q => q.element).length, 3); assert.equal(new Set(f.quads.map(q => q.element).filter(Boolean)).size, 3);
    const q = dark ? f.quads[f.dark] : f.quads.find(x => x.element), spot = { x: (Math.max(q.x0, g.bgRoom().left + 1) + Math.min(q.x1, g.bgRoom().right - 1)) / 2, y: (Math.max(q.y0, g.bgRoom().top + 1) + Math.min(q.y1, g.bgRoom().bottom - 1)) / 2 }, hp = g.p.hp;
    step(g, f.at - g.s.time + 0.1, () => Object.assign(g.p, spot));
    assert.equal(g.p.hp === hp, dark, dark ? 'the dark quarter is safe' : 'a lit quarter hurts');
  }
});

test('the needle fence starts wider; dashing through it sets F2 back inside without hurting, only its burst hurts', () => {
  const { g, od } = chamber(); cast(g, od, 'odFence'); const f = g.s.bossFields.find(x => x.kind === 'odFence');
  assert.equal(f.r0, 6);
  step(g, 0.1); const hp = g.p.hp;
  // A dodge's dash carries her from inside to outside in one frame.
  g.p.dodge = { angle: 0, elapsed: 0, duration: 0.3 }; g.p.invulnerableUntil = g.s.time + 0.3;
  Object.assign(g.p, { x: f.x + f.r + 1.2, y: f.y }); step(g, 1 / 60);
  assert.equal(g.p.hp, hp, 'trying costs nothing'); assert.ok(Math.hypot(g.p.x - f.x, (g.p.y - f.y) / 0.55) < f.r, 'set back inside');
  g.p.dodge = null; step(g, f.until - g.s.time + 0.1); assert.ok(g.p.hp < hp, 'caught inside when it bursts');
});

test('his floor spells never lie down on top of one another, and he keeps casting', () => {
  for (const [type, phase2] of [['orden', false], ['orden', true], ['ordenFinal', false]]) {
    const { g, od } = chamber(type); if (phase2) od.breaksDone = [0];
    const FLOOR = new Set(['odRunes', 'odFence', 'odLanes', 'odFire', 'odChain', 'odVortex', 'odQuartet', 'odMarch', 'odPress', 'odRings', 'odNova', 'odHoles', 'odCannon', 'odLastHour']);
    const seen = new Set(); let worst = 0;
    for (let i = 0; i < 60 * 70; i++) {
      g.s.time += 1 / 60; g.p.invulnerableUntil = 0; g.p.hp = g.p.maxHp; od.hp = Math.max(od.hp, od.maxHp * 0.7); od.breaking = null;
      g.updateEnemies(1 / 60); g.tickOrdenBoss(1 / 60);
      if (od.tell) seen.add(od.tell.started);
      worst = Math.max(worst, (g.s.bossFields || []).filter(f => FLOOR.has(f.kind) && !f.done).length);
    }
    assert.ok(worst <= 1, `${type}${phase2 ? ' phase 2' : ''}: ${worst} floors at once`);
    assert.ok(seen.size >= 12, `${type}: only ${seen.size} spells in 70 s`);
  }
});

test('far from F2 he blinks back to her side, then not again for a while', () => {
  const { g, od, ai } = chamber(); od.ready = g.s.time + 99;
  const room = g.bgRoom(); Object.assign(g.p, { x: room.left + 1, y: (room.top + room.bottom) / 2 }); Object.assign(od, { x: room.right - 1, y: (room.top + room.bottom) / 2 });
  g.odStep(od, 1 / 60);
  assert.ok(Math.hypot(od.x - g.p.x, od.y - g.p.y) < ai.teleportFar, 'next to her');
  const at = { x: od.x, y: od.y }; Object.assign(od, { x: room.right - 1 }); g.s.time += 1; g.odStep(od, 1 / 60);
  assert.ok(od.x > room.right - 1.5, 'not again within teleportEvery');
});

// The warnings show what lands (2026-11-24).
test("his first needle flies along the warning's arrows, not at where F2 has gone", () => {
  const { g, od } = chamber(); od.ready = 1e9;
  g.beginEnemyTell(od, 'odNeedles'); const warned = od.tell; g.p.y += 3; g.s.time = warned.until; g.executeEnemy(od);
  step(g, 0.05);
  const f = g.s.bossFields.find(x => x.kind === 'odBolts');
  assert.ok(f.bolts.length >= 1); assert.ok(Math.abs(f.bolts[0].angle - warned.angle) < 1e-9);
});
test('the fire burns as far as it is drawn, and a pit is the oval drawn in its piece', () => {
  const { g, od } = chamber(), t = g.s.time, p = g.p;
  const cell = { x: p.x + 1.15, y: p.y, x0: p.x + 0.15, x1: p.x + 2.15, y0: p.y - 0.6, y1: p.y + 0.6, r: 1, at: t, until: t + 3, lit: false };
  g.fbField({ kind: 'odFire', owner: od.id, cells: [cell], seedCell: -1, from: t, nextHit: 0, damage: 10, burn: 5 });
  let hp = p.hp; step(g, 0.3); assert.ok(p.hp < hp, 'standing 1.15 out from a patch of radius 1, in its flames');
  g.s.bossFields = [];
  const piece = (cx, cy) => ({ x0: cx - 1, x1: cx + 1, y0: cy - 0.6, y1: cy + 0.6, fall: g.s.time, back: g.s.time + 5, fell: false });
  g.fbField({ kind: 'odHoles', owner: od.id, pieces: [piece(p.x + 0.9, p.y + 0.5)], damage: 10, hitAt: -1 });
  hp = p.hp; step(g, 0.2); assert.equal(p.hp, hp, "the piece's corner, outside its pit, holds her");
  g.s.bossFields = []; g.fbField({ kind: 'odHoles', owner: od.id, pieces: [piece(p.x, p.y)], damage: 10, hitAt: -1 });
  step(g, 0.2); assert.ok(p.hp < hp, 'over the pit she drops');
});
