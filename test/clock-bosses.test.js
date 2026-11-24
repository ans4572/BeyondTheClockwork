import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { FLOOR_FLAT } from '../src/engine/math.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));

// Chapter 3's Tick·Tock room (a preview: the local test server opens it), the clock tower's fourth room.
function twinsRoom(level = 'normal') {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  assert.ok(g.startRun(7, level, 'clock-tower'));
  g.s.run.node = g.rooms.findIndex(room => room.boss === 'twinTickTock'); g.enterNode(); g.s.entry = null;
  const [lead, other] = g.s.enemies.filter(e => e.boss);
  Object.assign(g.p, { hp: 5000, maxHp: 5000, dodge: null, invulnerableUntil: 0 });
  g.p.x = (lead.x + other.x) / 2; g.p.y = lead.y + 3;
  return { g, lead, other, ai: g.config.bossAI.twinTickTock };
}
const fresh = g => { g.p.invulnerableUntil = 0; };
/** Steps the whole game; F2 stands still (no input). */
const play = (g, seconds, each) => { for (let i = 0; i < Math.round(seconds * 60); i++) { g.update(1 / 60, {}); each?.(); } };

test('Tick·Tock come as two bodies, red and blue, sharing one health', () => {
  const { g, lead, other } = twinsRoom();
  assert.equal(g.s.enemies.filter(e => e.boss).length, 2);
  assert.deepEqual([lead.look, other.look], ['tick', 'tock']);
  assert.equal(lead.maxHp, data.combat.bosses.find(b => b.id === 'twinTickTock').hp);
  g.hitEnemy(other, 300, { basic: true });
  assert.equal(lead.hp, other.hp); assert.ok(lead.hp < lead.maxHp);
  lead.breaksDone = [0]; other.breaksDone = [0]; // past the colour floor
  g.hitEnemy(lead, lead.hp + 10, { exact: true });
  assert.equal(other.hp, 0, 'both fall together');
});

test('one twin acts on each beat, never both at once: red on even beats, blue on odd', () => {
  const { g, lead, other, ai } = twinsRoom();
  // F2 shrugs off every blow (time keeps running) so the whole round plays.
  let both = 0;
  play(g, 40, () => {
    fresh(g); g.p.hp = g.p.maxHp;
    const solo = e => e.tell && !['ttPendulum', 'ttShuffle', 'ttFlank'].includes(e.tell.type);
    if (solo(lead) && solo(other)) both++;
  });
  assert.equal(both, 0, 'no two solo warnings at the same moment');
  assert.ok(lead.metronome.step >= ai.round.length, `the whole round played (${lead.metronome.step} steps)`);
});

test('Tick thrusts three times, the third half a beat late; Tock sweeps and throws three gears that bounce', () => {
  const { g, lead, other, ai } = twinsRoom();
  const red = lead.look === 'tick' ? lead : other, blue = red === lead ? other : lead;
  g.p.x = red.x + 1.5; g.p.y = red.y; fresh(g);
  g.beginEnemyTell(red, 'ttThrust'); const times = [];
  for (let i = 0; i < 180; i++) { const before = red.tell?.type; g.s.time += 1 / 60; g.updateEnemies(1 / 60); if (before && !red.tell) times.push([before, g.s.time]); fresh(g); }
  // The first three warnings are one thrust's three blows (the next thrust may begin within the three seconds).
  assert.deepEqual(times.slice(0, 3).map(([type]) => type), ['ttThrust', 'ttThrust2', 'ttThrust3']);
  const gap1 = times[1][1] - times[0][1], gap2 = times[2][1] - times[1][1];
  assert.ok(gap2 > gap1 + g.ttBeat(red) / 2 - 0.05, `third later (${gap1.toFixed(2)} then ${gap2.toFixed(2)})`);
  g.p.x = blue.x + 2; g.p.y = blue.y; fresh(g); const hp = g.p.hp;
  g.beginEnemyTell(blue, 'ttSweep'); g.s.time = blue.tell.until; g.executeEnemy(blue);
  assert.ok(g.p.hp < hp, 'the sweep hits in front');
  const gears = g.s.projectiles.filter(b => b.look === 'gear');
  assert.equal(gears.length, ai.gearShots); assert.ok(gears.every(b => b.bounces === ai.gearBounces));
});

test('a gear meeting a wall turns back once, then stops at the next', () => {
  const { g, lead } = twinsRoom();
  g.p.x = lead.x; g.p.y = lead.y - 50; // well out of the way
  const shot = { id: 'gear', x: lead.x, y: lead.y, angle: Math.PI, speed: 12, radius: 0.3, damage: 1, friendly: false, until: g.s.time + 10, look: 'gear', bounces: 1 };
  g.s.projectiles.push(shot);
  let turned = false;
  for (let i = 0; i < 600 && shot.until > g.s.time; i++) { g.s.time += 1 / 60; g.updateProjectiles(1 / 60); if (shot.bounces === 0 && !turned) { turned = true; assert.ok(Math.cos(shot.angle) > 0, 'heads back east'); } }
  assert.ok(turned, 'it bounced'); assert.ok(shot.until <= g.s.time, 'and stopped at the next wall');
});

const startJoint = (g, lead, other, ai, step) => { lead.metronome.step = ai.round.indexOf(step); lead.metronome.next = g.s.time; for (const e of [lead, other]) { e.ready = 0; e.busyUntil = 0; } play(g, 0.05); };

test('the pendulum: each blast’s line runs through F2 and blows a little past her, so even the middle of the room has to be left', () => {
  const { g, lead, other, ai } = twinsRoom();
  g.p.y = lead.y + 2; startJoint(g, lead, other, ai, 'pendulum');
  const f = g.s.bossFields.find(x => x.kind === 'ttPendulum');
  assert.ok(f, 'the pendulum started'); assert.equal(f.blasts.length, ai.pendulumBlasts);
  assert.ok(f.blasts.every((b, i) => i === 0 || b.side === -f.blasts[i - 1].side), 'sides take turns');
  // Standing still where the first line was drawn is inside the blast.
  const first = f.blasts[0], x0 = g.p.x; fresh(g); let hp = g.p.hp;
  assert.ok(g.ttBlown(f, first, x0), 'the spot F2 stood on is blown');
  while (!first.done) { g.update(1 / 60, {}); g.p.x = x0; fresh(g); }
  assert.ok(g.p.hp < hp, 'standing still is hit');
  // The next line is drawn through where F2 is now; stepping past it to the safe side takes nothing.
  const second = f.blasts[1]; assert.equal(second.line, g.p.x, 'the second line runs through F2');
  g.p.x = second.line - second.side * (ai.pendulumOverlap + 0.6); hp = g.p.hp;
  while (!second.done) { g.update(1 / 60, {}); fresh(g); g.p.x = second.line - second.side * (ai.pendulumOverlap + 0.6); }
  assert.equal(g.p.hp, hp, 'past the line is safe');
});

test('the shuffle: grey twins trade places; the one with the key bursts and only beside the other is safe', () => {
  for (const [bombLook, stand] of [['tick', 'tock'], ['tick', 'tick'], ['tock', 'tick'], ['tock', 'tock'], ['tick', 'away']]) {
    const { g, lead, other, ai } = twinsRoom();
    startJoint(g, lead, other, ai, 'shuffle');
    const f = g.s.bossFields.find(x => x.kind === 'ttShuffle');
    f.bomb = g.ttLook(bombLook).id;
    assert.ok(f, 'the shuffle started'); assert.equal(f.moves.length, g.bossRepeat(lead, 'ttShuffles')); assert.ok(f.moves.some(m => m.swap));
    let grey = false;
    while (g.s.time < f.reveal - 0.05) { play(g, 1 / 60); if (lead.sprite === 'ttgray' && other.sprite === 'ttgray') grey = true; }
    assert.ok(grey, 'both turn grey while they shuffle');
    const tick = g.ttLook('tick'), tock = g.ttLook('tock');
    const spot = stand === 'tock' ? tock : stand === 'tick' ? tick : { x: (tick.x + tock.x) / 2, y: tick.y + 5 };
    Object.assign(g.p, { x: spot.x, y: spot.y + 0.3 }); fresh(g); const hp = g.p.hp;
    play(g, 0.4, () => { if (f.done) return; Object.assign(g.p, { x: spot.x, y: spot.y + 0.3 }); });
    assert.equal(g.p.hp < hp, stand === 'away' || stand === bombLook, `${bombLook} bursts, standing by ${stand}`);
    assert.ok(lead.sprite !== 'ttgray' && other.sprite !== 'ttgray', 'their colours come back');
  }
});

test('the dash throws gears out to both sides as it runs and all round where it stops', () => {
  const { g, lead, other, ai } = twinsRoom();
  const red = lead.look === 'tick' ? lead : other;
  g.p.x = red.x + 4; g.p.y = red.y + 0.2; fresh(g);
  g.beginEnemyTell(red, 'ttDash'); const from = { x: red.x, y: red.y };
  play(g, ai.tellSeconds.ttDash + ai.dashSeconds + 0.1, () => fresh(g));
  assert.ok(Math.hypot(red.x - from.x, red.y - from.y) > 3, 'it ran');
  const gears = g.s.projectiles.filter(b => b.look === 'gear');
  assert.equal(gears.length, ai.dashGearDrops * 2 + ai.dashGearBurst);
});

test('the beat is quicker on hard (chapter 3 has no easy)', () => {
  const beat = level => { const { g, lead } = twinsRoom(level); return g.ttBeat(lead); };
  assert.ok(beat('normal') > beat('hard'));
  assert.equal(beat('normal'), 0.9);
});

test('beating the twins ends the fight: the room clears for the unwinding', () => {
  const { g, lead, other } = twinsRoom();
  lead.breaksDone = [0]; other.breaksDone = [0];
  // exact: the damage spread (a roll each hit) could leave them a sliver (2026-11-19).
  g.hitEnemy(lead, lead.hp + 10, { exact: true });
  for (let i = 0; i < 60 * 3 && g.s.mode === 'combat'; i++) g.update(1 / 60, {});
  assert.equal(g.s.mode, 'unwind');
});

/** Into the colour floor: half health, struck once more. */
function coloured(level) {
  const room = twinsRoom(level), { g, lead, other } = room;
  g.hitEnemy(other, lead.hp * 0.6, { exact: true });
  assert.equal(lead.breaking?.kind, 'colours'); assert.ok(other.breaking?.follower, 'both shielded');
  return { ...room, b: lead.breaking, rule: g.breakRule(lead, 0) };
}
/** Plays on until the next call lands, F2 standing on a square of `pick(call)`'s colour (or anywhere `pick` says). */
function answer(g, b, pick) {
  while (!b.call && g.s.time < b.until) { g.update(1 / 60, {}); fresh(g); g.p.hp = g.p.maxHp; }
  const call = b.call;
  // A twisting call changes colour late: answer on the last colours.
  while (b.call === call && call.twistAt !== null && !call.twisted) { g.update(1 / 60, {}); fresh(g); g.p.hp = g.p.maxHp; }
  const look = pick(call.look), zone = b.zones.find(z => z.colour === look && z.x1 - z.x0 < 40);
  const spot = { x: (Math.max(zone.x0, b.room.left) + Math.min(zone.x1, b.room.right)) / 2, y: (Math.max(zone.y0, b.room.top) + Math.min(zone.y1, b.room.bottom)) / 2 };
  const hp = g.p.maxHp;
  while (b.call === call) { fresh(g); g.p.hp = hp; Object.assign(g.p, spot); g.update(1 / 60, {}); }
  return { call, hp: g.p.hp, before: hp };
}

test('the colour floor: at half health both shield in the middle and the floor turns to red and blue squares, half each', () => {
  const { g, lead, other, b, rule } = coloured();
  const hp = lead.hp; g.hitEnemy(lead, 500, { basic: true }); g.hitEnemy(other, 500, { basic: true });
  assert.equal(lead.hp, hp, 'shielded'); assert.equal(other.hp, hp);
  assert.equal(b.zones.length, rule.columns * rule.rows);
  assert.equal(rule.columns, 5); assert.equal(rule.rows, 5);
  // The square under the twins is the grey dais (no colour); the rest are half and half.
  const dais = b.zones.filter(z => z.colour === 'none'), at = body => b.zones.find(z => body.x >= z.x0 && body.x < z.x1 && body.y >= z.y0 && body.y < z.y1);
  assert.ok(dais.length >= 1 && dais.includes(at(lead)) && dais.includes(at(other)), 'the twins stand on the dais');
  const rest = b.zones.length - dais.length;
  assert.ok(Math.abs(b.zones.filter(z => z.colour === 'tick').length - rest / 2) <= 0.5, 'half and half');
  assert.equal(b.need, 3, 'normal: three of each');
  const spot = { x: lead.x, y: lead.y };
  play(g, 2, () => { fresh(g); g.p.hp = g.p.maxHp; });
  assert.ok(Math.hypot(lead.x - spot.x, lead.y - spot.y) < 0.01, 'they stand still in the middle');
  assert.ok(b.call, 'a call under way');
  const actor = g.s.enemies.find(e => e.id === b.call.id);
  assert.equal(actor.look, b.call.look); assert.equal(actor.tell?.type, b.call.look === 'tick' ? 'ttCallTick' : 'ttCallTock', 'the caller strikes its pose');
  assert.ok([lead, other].every(e => Math.abs(e.facing - Math.PI / 2) < 1e-9), 'both face the front');
});

/** The looks of the twins that throw gears while joint pattern `kind` runs. */
function throwersOf(g, kind) {
  const looks = new Set(), throwGear = g.ttGear;
  g.ttGear = function (enemy, ...rest) { if (this.s.enemies.find(e => e.metronome)?.metronome.joint?.kind === kind) looks.add(enemy.look); return throwGear.call(this, enemy, ...rest); };
  return looks;
}

test('through the pendulum they circle F2 and throw gears at her', () => {
  const { g, lead, other } = twinsRoom();
  const ai = g.config.bossAI.twinTickTock, m = lead.metronome;
  m.step = ai.round.indexOf('pendulum');
  const start = [{ x: lead.x, y: lead.y }, { x: other.x, y: other.y }], gears = () => g.s.projectiles.filter(s => s.look === 'gear' && !s.friendly).length;
  let thrown = 0, moved = 0, seen = false;
  const throwers = throwersOf(g, 'pendulum');
  play(g, 6, () => { fresh(g); g.p.hp = g.p.maxHp; const n = gears(); if (m.joint?.kind === 'pendulum') { seen = true; moved = Math.max(moved, Math.hypot(lead.x - start[0].x, lead.y - start[0].y)); } if (n > (g.__n ?? n)) thrown++; g.__n = n; });
  assert.ok(seen, 'the pendulum came');
  assert.ok(moved > 1, `they move round her: ${moved}`);
  assert.ok(thrown >= 1, 'gears at her');
  assert.deepEqual([...throwers].sort(), ['tick', 'tock'], 'both throw, in turn');
});

test('the colour floor: the caller’s colour is safe and counts; the other colour is struck and does not', () => {
  const { g, b } = coloured();
  const right = answer(g, b, look => look);
  assert.equal(right.hp, right.before, 'safe on the caller’s colour'); assert.equal(b.done[right.call.look], 1);
  const wrong = answer(g, b, look => (look === 'tick' ? 'tock' : 'tick'));
  assert.ok(wrong.hp < wrong.before, 'struck on the other colour');
  assert.equal(b.done.tick + b.done.tock, 1, 'a miss does not count');
});

test('the colour floor danced through (three of each) drops the shields and phase 2 beats faster', () => {
  const { g, lead, other, b } = coloured();
  const before = g.ttBeat(lead);
  for (let n = 0; n < 6 && lead.breaking; n++) answer(g, b, look => look);
  play(g, 0.05);
  assert.equal(lead.breaking, null); assert.equal(other.breaking, null);
  assert.equal(lead.metronome.phase, 2); assert.ok(g.ttBeat(lead) < before, 'quicker'); assert.equal(g.ttBeat(lead), 0.6);
});

test('the colour floor not finished in time bursts and heals the twins, and comes back at half health', () => {
  const { g, lead, other, b, rule } = coloured();
  const hp = lead.hp, end = g.s.time + rule.seconds + rule.callWarn + rule.failWarn + 0.3, wrong = look => (look === 'tick' ? 'tock' : 'tick');
  // F2 always stands on the colour not called (in the square tower room every spot is on the grid), so none counts.
  while (lead.breaking && b.failAt === null && g.s.time < end) {
    while (!b.call && b.failAt === null && g.s.time < end) { g.update(1 / 60, {}); fresh(g); g.p.hp = g.p.maxHp; }
    if (b.call) answer(g, b, wrong);
  }
  play(g, Math.max(0, end - g.s.time), () => { fresh(g); g.p.hp = g.p.maxHp; });
  assert.equal(lead.breaking, null); assert.ok(lead.hp > hp && other.hp === lead.hp, 'healed');
  g.hitEnemy(lead, lead.hp - lead.maxHp * 0.45, { exact: true });
  assert.equal(lead.breaking?.kind, 'colours', 'again at half');
});

test('the colour floor asks for four of each on hard', () => {
  assert.equal(coloured('hard').b.need, 4);
});

/** Phase 2 on the given step of round2. */
function phaseTwo(step) {
  const room = twinsRoom(), { g, lead, other, ai } = room;
  lead.breaksDone = [0]; other.breaksDone = [0]; lead.hp = other.hp = lead.maxHp * 0.4;
  Object.assign(lead.metronome, { phase: 2, step: ai.round2.indexOf(step), next: g.s.time, joint: null });
  for (const e of [lead, other]) { e.ready = 0; e.busyUntil = 0; }
  return room;
}

test('the giant metronome: weights sweep three of four bands each swing; only the free band is safe, and it moves one band', () => {
  for (const stand of ['weight', 'inner', 'free', 'between', 'beyond']) {
    const { g, ai } = phaseTwo('blade');
    play(g, 0.05);
    const f = g.s.bossFields.find(x => x.kind === 'ttBlade'), beat = g.ttBeat(g.s.enemies.find(e => e.metronome));
    assert.ok(f, 'the metronome hangs'); assert.equal(f.swings.length, ai.bladeSwings);
    assert.ok(f.swings.every(s => s.weights.length === ai.bladeZones - 1), 'a weight in every band but one');
    assert.ok(f.swings.every((s, i) => i === 0 || Math.abs(s.free - f.swings[i - 1].free) === 1), 'the free band moves one band each swing');
    assert.ok(f.swings.every(s => Math.abs(s.end - s.start - 1.2) < 1e-6), 'a swing every 1.2 s on normal');
    // Swing 0 with the near height taken, to test the reach up to the pivot.
    const s0 = f.swings[0];
    // Between two taken heights and past the tip are struck too: only the free height's share of the rod is safe.
    if (stand === 'inner') { s0.free = 3; s0.weights = g.ttBladeWeights(f.length, 3); }
    if (stand === 'between' || stand === 'beyond') { s0.free = 0; s0.weights = g.ttBladeWeights(f.length, 0); }
    const L = f.length, band = (L - 0.5 - ai.bladeAbove) / ai.bladeZones, mid = k => ai.bladeAbove + (k + 0.5) * band;
    const r = { weight: s0.weights[0].r, inner: 1, free: mid(s0.free), between: ai.bladeAbove + 2 * band, beyond: L + 2 }[stand];
    const spot = { x: f.pivot.x, y: f.pivot.y + r }, hp = g.p.maxHp;
    let hits = 0;
    // (the gears they throw meanwhile are cleared: they have their own test)
    while (g.s.time < s0.end) { fresh(g); g.p.hp = hp; Object.assign(g.p, spot); g.s.projectiles = g.s.projectiles.filter(x => x.friendly); g.update(1 / 60, {}); if (g.p.hp < hp) hits++; }
    assert.equal(hits, stand === 'free' ? 0 : 1, `standing ${stand}: hit once a swing at most`);
  }
});

test('the echo: a mark where F2 stands each beat blows two beats later; standing still is hit, moving on is not', () => {
  for (const way of ['still', 'moving']) {
    const { g, ai, lead } = phaseTwo('echo');
    play(g, 0.05);
    const f = g.s.bossFields.find(x => x.kind === 'ttEcho');
    assert.ok(f, 'the echo started'); assert.equal(f.marks.length, ai.echoMarks);
    assert.equal(lead.metronome.joint, null, 'it runs under the other blows');
    for (const e of g.s.enemies) { e.ready = 1e9; e.busyUntil = 1e9; } // nothing else to dodge
    const home = { x: g.p.x, y: g.p.y };
    let hits = 0, n = 0;
    while (!f.done) {
      const placed = f.marks.filter(m => m.x !== null).length;
      if (way === 'moving' && placed !== n) { n = placed; Object.assign(g.p, { x: home.x + (n % 2 ? 3.5 : -3.5) * (1 + (n >> 1) * 0), y: home.y + n * 0.9 }); }
      if (way === 'still') Object.assign(g.p, home);
      const before = g.p.hp; fresh(g); g.update(1 / 60, {}); if (g.p.hp < before) hits++; g.p.hp = g.p.maxHp;
    }
    assert.equal(hits > 0, way === 'still', `${way}: ${hits} hits`);
  }
});

test('the pincer: the ring holds F2 in but for its gap; inside when they close is struck, out through the gap is safe', () => {
  for (const way of ['stay', 'gap', 'wall']) {
    const { g, ai } = phaseTwo('pincer');
    play(g, 0.05);
    const f = g.s.bossFields.find(x => x.kind === 'ttPincer');
    assert.ok(f, 'the pincer started');
    assert.ok(Math.hypot(g.p.x - f.x, (g.p.y - f.y) / FLOOR_FLAT) < f.r - 1, 'the ring is round F2');
    if (way === 'stay') {
      const wide = f.r; play(g, f.close - g.s.time - 0.05, () => { fresh(g); g.p.hp = g.p.maxHp; Object.assign(g.p, { x: f.x, y: f.y }); });
      assert.equal(wide, ai.pincerRadiusStart); assert.ok(f.r < wide - 2, `the ring draws in (${wide} to ${f.r.toFixed(1)})`);
    }
    const out = (angle, r) => ({ x: f.x + Math.cos(angle) * r, y: f.y + Math.sin(angle) * r * FLOOR_FLAT });
    let hp = g.p.hp, escaped = false;
    Object.assign(g.p, { x: f.x, y: f.y });
    while (!f.done) {
      g.update(1 / 60, {}); fresh(g);
      if (way !== 'stay') g.p.hp = g.p.maxHp;
      if (g.s.time < f.orbit + 0.3) continue;
      if (way === 'gap' && !escaped) { const gapAt = g.ttPincerTurn(f, g.s.time) + f.spin * Math.PI / 2; Object.assign(g.p, out(gapAt, f.r + 0.5)); }
      if (way === 'wall' && !escaped) { const wallAt = g.ttPincerTurn(f, g.s.time) + f.spin * Math.PI / 2 + Math.PI; Object.assign(g.p, out(wallAt, f.r + 0.2)); }
      escaped = escaped || !f.inside;
      if (f.closed) break;
    }
    void ai;
    if (way === 'stay') assert.ok(g.p.hp < hp, 'struck inside');
    if (way === 'gap') assert.ok(escaped, 'out through the gap');
    if (way === 'wall') assert.ok(!escaped, 'held in by the fence');
  }
});

test('the flank: both blink out (no hitting them), come back at opposite ends and send walls of gears across in turn, each with one gap', () => {
  const { g, lead, other, ai } = twinsRoom();
  startJoint(g, lead, other, ai, 'flank');
  const f = g.s.bossFields.find(x => x.kind === 'ttFlank');
  assert.ok(f, 'the flank started'); assert.equal(f.walls.length, ai.flankWalls);
  assert.ok(lead.hidden && other.hidden, 'gone while they blink');
  const hp = lead.hp; g.hitEnemy(lead, 100, { basic: true }); assert.equal(lead.hp, hp, 'nothing to hit');
  const axis = f.blink.axis;
  play(g, f.blink.back - g.s.time + 0.05);
  assert.ok(!lead.hidden && !other.hidden, 'back');
  assert.ok(Math.abs(lead[axis] - other[axis]) > 10, `at opposite ends (${lead[axis].toFixed(1)}, ${other[axis].toFixed(1)})`);
  assert.ok(Math.abs(f.walls[1].at - f.walls[0].at - g.ttBeat(lead) * ai.flankBeats) < 1e-6, 'a wall every flankBeats beats');
  assert.ok(f.walls.every((w, i) => i === 0 || (w.id !== f.walls[i - 1].id && Math.abs(w.gap - f.walls[i - 1].gap) >= ai.flankShift - 1e-6)), 'turn about, the gap moving each time');
  // Every gap a short run from the last and away from the floor's edges, so each is reachable (2026-11-18).
  for (const [i, wall] of f.walls.entries()) {
    const edgeIn = Math.max(1.2, (wall.hi - wall.lo) * 0.2);
    assert.ok(wall.gap >= wall.lo + edgeIn - 1e-6 && wall.gap <= wall.hi - edgeIn + 1e-6, `gap ${i} in the middle of the floor`);
    if (i) assert.ok(Math.abs(wall.gap - f.walls[i - 1].gap) <= ai.flankShiftMax + 1e-6, `gap ${i} within reach of the last`);
  }
  // The first wall: a line of gears right across, but for its gap.
  const w = f.walls[0]; g.p.x = 1e3; // F2 out of the way while it forms
  const before = new Set(g.s.projectiles.map(b => b.id));
  play(g, w.at - g.s.time + 0.02);
  const across = axis === 'x' ? 'y' : 'x', gears = g.s.projectiles.filter(b => !before.has(b.id) && b.look === 'gear').map(b => b[across]).sort((a, b) => a - b);
  assert.ok(gears.length > 6, `a wall (${gears.length} gears)`);
  const gaps = gears.slice(1).map((v, i) => v - gears[i]), wide = gaps.filter(d => d > 2 * (ai.gearRadius + g.config.arena.playerRadius));
  assert.equal(wide.length, 1, `one way through (${gaps.map(d => d.toFixed(2)).join(' ')})`);
});

test('the flank: standing in the gap lets the wall pass; anywhere else on its line is hit', () => {
  for (const stand of ['gap', 'off']) {
    const { g, lead, other, ai } = twinsRoom();
    startJoint(g, lead, other, ai, 'flank');
    const f = g.s.bossFields.find(x => x.kind === 'ttFlank'), w = f.walls[0], axis = w.axis, across = axis === 'x' ? 'y' : 'x';
    const mid = axis === 'x' ? (f.box.left + f.box.right) / 2 : (f.box.top + f.box.bottom) / 2;
    const spot = { [axis]: mid, [across]: stand === 'gap' ? w.gap : (w.gap - w.lo > w.hi - w.gap ? w.gap - 3 : w.gap + 3) };
    const hp = g.p.hp, arrive = w.at + (Math.abs(mid - w.edge) + 1) / ai.flankSpeed;
    while (g.s.time < arrive) { g.update(1 / 60, {}); Object.assign(g.p, spot); }
    assert.equal(g.p.hp < hp, stand === 'off', `standing ${stand === 'gap' ? 'in' : 'out of'} the gap`);
  }
});

test('the flank in phase 2: more walls, from the same two ends throughout', () => {
  const { g, ai } = phaseTwo('flank');
  play(g, 0.05);
  const f = g.s.bossFields.find(x => x.kind === 'ttFlank');
  assert.ok(f); assert.equal(f.walls.length, ai.flankWalls2);
  assert.ok(ai.flankWalls2 > ai.flankWalls, 'more than phase 1');
  assert.ok(f.walls.every(w => w.axis === f.blink.axis), 'no switching ends');
});

test('the shuffle’s bomb is either twin', () => {
  const looks = new Set();
  for (let n = 0; n < 12; n++) {
    const { g, lead, other, ai } = twinsRoom();
    for (let k = 0; k < n; k++) g.random();
    startJoint(g, lead, other, ai, 'shuffle');
    const f = g.s.bossFields.find(x => x.kind === 'ttShuffle');
    looks.add(g.s.enemies.find(e => e.id === f.bomb).look);
  }
  assert.deepEqual([...looks].sort(), ['tick', 'tock']);
});

test('the colour floor twists now and then, the same number of times each break, never on the first call', () => {
  for (const [level, twists] of [['normal', 2], ['hard', 3]]) {
    for (let n = 0; n < 4; n++) {
      const { g, b } = coloured(level);
      for (let k = 0; k < n; k++) g.random();
      assert.equal(b.twists.length, twists, `${level}: ${twists} twists`); assert.ok(!b.twists.includes(0), 'not the first');
    }
  }
  const { g, b } = coloured();
  const at = b.twists[0];
  for (let k = 0; k < at; k++) answer(g, b, look => look);
  while (!b.call) { g.update(1 / 60, {}); fresh(g); g.p.hp = g.p.maxHp; }
  const call = b.call, shown = b.shownAt;
  assert.ok(call.twistAt !== null && call.twistAt < call.at);
  while (!call.twisted) { g.update(1 / 60, {}); fresh(g); g.p.hp = g.p.maxHp; }
  assert.ok(b.shownAt > shown, 'the squares change again before the blow');
  const right = answer(g, b, look => look);
  assert.equal(right.hp, right.before, 'the last colours are the ones that count');
});

test('the giant metronome swings every 1.2 s on normal, 1.0 on hard', () => {
  for (const [level, each] of [['normal', 1.2], ['hard', 1.0]]) {
    const { g, lead } = twinsRoom(level);
    const other = g.ttPartner(lead), ai = g.config.bossAI.twinTickTock;
    lead.breaksDone = [0]; other.breaksDone = [0]; lead.hp = other.hp = lead.maxHp * 0.4;
    Object.assign(lead.metronome, { phase: 2, step: ai.round2.indexOf('blade'), next: g.s.time, joint: null });
    for (const e of [lead, other]) { e.ready = 0; e.busyUntil = 0; }
    play(g, 0.05);
    const f = g.s.bossFields.find(x => x.kind === 'ttBlade');
    assert.ok(f.swings.every(s => Math.abs(s.end - s.start - each) < 1e-6), `${level}: ${each} s`);
  }
});

test('chapter 3 offers normal and hard only: easy cannot be picked there (2026-11-16)', () => {
  const g = new Game(data); g.previews = true; g.unlockChapters = true; g.s.profile.registered = true; g.s.mode = 'hub';
  g.s.panel = 'difficulty'; assert.equal(g.depart('easy', 'clock-tower'), false);
  assert.ok(g.depart('hard', 'clock-tower')); assert.equal(g.s.run.difficulty, 'hard');
  const h = new Game(data); h.previews = true; h.unlockChapters = true; h.s.profile.registered = true; h.s.mode = 'hub';
  assert.ok(h.startRun(3, 'easy', 'clock-tower')); assert.equal(h.s.run.difficulty, 'normal');
});

test('the thrust and the dash aim ahead of F2 as she walks, straight at her when she stands', () => {
  const { g, lead, ai } = twinsRoom();
  const red = g.ttLook('tick');
  g.p.x = red.x - 4; g.p.y = red.y;
  lead.metronome.pace = { x: 0, y: 0 }; g.beginEnemyTell(red, 'ttThrust');
  assert.ok(Math.abs(red.tell.angle - Math.PI) < 1e-6, 'standing: straight at her');
  lead.metronome.pace = { x: 0, y: 4 }; g.beginEnemyTell(red, 'ttThrust');
  const want = Math.atan2(4 * ai.leadSeconds.ttThrust, -4);
  assert.ok(Math.abs(red.tell.angle - want) < 1e-6, 'walking south: aimed south of her');
  lead.metronome.pace = { x: 0, y: 40 }; g.beginEnemyTell(red, 'ttDash');
  assert.ok(Math.abs(red.tell.angle - Math.atan2(ai.leadMax, -4)) < 1e-6, 'never more than leadMax ahead');
  lead.metronome.pace = { x: 0, y: 4 }; g.beginEnemyTell(g.ttLook('tock'), 'ttSweep');
  const blue = g.ttLook('tock'); assert.ok(Math.abs(blue.tell.angle - Math.atan2(g.p.y - blue.y, g.p.x - blue.x)) < 1e-6, 'the sweep is not led');
  assert.ok(lead);
});

test('the pace the aim reads follows F2 as she moves', () => {
  const { g, lead } = twinsRoom();
  for (let i = 0; i < 60; i++) { g.p.x += 3 / 60; g.updateEnemies(1 / 60); g.s.time += 1 / 60; }
  assert.ok(Math.abs(g.ttPace(lead).x - 3) < 0.3 && Math.abs(g.ttPace(lead).y) < 0.3, `pace ${JSON.stringify(g.ttPace(lead))}`);
});

test('the pace starts fresh when the room is fought again: a retry does not read the jump back to the door as walking (2026-11-21)', () => {
  const { g, lead } = twinsRoom();
  for (let i = 0; i < 60; i++) { g.p.x += 3 / 60; g.updateEnemies(1 / 60); g.s.time += 1 / 60; }
  assert.ok(g.ttPace(lead).x > 2, 'walking east');
  // The room again, F2 far from where she fell.
  g.enterNode(); g.s.entry = null;
  const again = g.s.enemies.find(e => e.boss && e.metronome);
  assert.notEqual(again, lead, 'new twins');
  Object.assign(g.p, { x: again.x - 6, y: again.y + 3 });
  g.updateEnemies(1 / 60);
  assert.ok(Math.hypot(g.ttPace(again).x, g.ttPace(again).y) < 1e-9, `standing still reads as still (${JSON.stringify(g.ttPace(again))})`);
});

test('now and then a solo blow starts half a beat early, and that beat passes without another', () => {
  const { g, lead, ai } = twinsRoom();
  ai.offbeatShare = 1;
  try {
    const starts = [];
    play(g, 12, () => { fresh(g); g.p.hp = g.p.maxHp; for (const e of g.s.enemies) if (e.tell && ['ttThrust', 'ttSweep', 'ttDash'].includes(e.tell.type) && !starts.some(x => x.started === e.tell.started)) starts.push({ started: e.tell.started, beat: lead.metronome.next }); });
    const beat = g.ttBeat(lead);
    assert.ok(starts.length > 0);
    assert.ok(starts.some(x => Math.abs(x.beat - x.started - beat / 2) < 0.05), 'started half a beat before a beat');
  } finally { ai.offbeatShare = 0.2; }
});

test('through phase 2\'s giant metronome the twins throw gears at F2 in turn', () => {
  const { g, ai } = phaseTwo('blade');
  let gears = 0;
  const throwers = throwersOf(g, 'blade');
  play(g, 5, () => { fresh(g); g.p.hp = g.p.maxHp; gears = Math.max(gears, g.s.projectiles.filter(x => !x.friendly).length); });
  assert.ok(gears >= 1, 'gears in the air while it swings');
  assert.ok(ai.overlapBeats >= 1);
  // 2026-11-21: the thrower was picked by the beat, and with overlapBeats even only Tick ever threw.
  assert.deepEqual([...throwers].sort(), ['tick', 'tock'], 'both throw, in turn');
});

test("the flank's green lane is where F2 is really clear of the gears (2026-11-24)", () => {
  const { g, lead, other, ai } = twinsRoom(); startJoint(g, lead, other, ai, 'flank');
  const f = g.s.bossFields.find(x => x.kind === 'ttFlank'), clear = ai.gearRadius + g.config.arena.playerRadius;
  for (const w of f.walls) {
    const [s0, s1] = g.ttFlankSafe(f, w);
    assert.ok(s0 <= w.gap && w.gap <= s1, 'the gap itself is in it');
    assert.ok(g.ttFlankGears(f, w).every(u => u <= s0 - clear + 1e-9 || u >= s1 + clear - 1e-9), 'no gear reaches into the green');
  }
});
