import { fitsMap } from '../src/engine/map-geometry.js';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, segmentDistance } from '../src/engine/game.js';
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));
function boss(type) {
  const g = new Game(data); g.s.mode = 'hub'; g.s.profile.registered = true; g.startRun(7);
  g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.s.run.plan[0].layout = 2;
  return [g, g.spawnEnemy(type, { x: 14, y: 8 })];
}
test('Roco minimum tells precede damage, claw is directional, magnet remains escapable', () => {
  const [g, e] = boss('collectorRoco'); g.p.x = 18; g.p.y = 8;
  g.beginEnemyTell(e, 'claw'); assert.ok(e.tell.until - e.tell.started >= 0.7); assert.equal(g.p.hp, 100);
  g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 90);
  g.s.time += 1; g.p.y = 11; g.beginEnemyTell(e, 'claw'); g.p.y = 5; g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 90);
  g.s.time += 1; g.beginEnemyTell(e, 'magnet'); g.s.time = e.tell.until; g.executeEnemy(e);
  const magnet = g.s.casts.find(c => c.shape === 'magnet'); assert.ok(magnet.pull < data.combat.player.speed); assert.equal(g.p.hp, 90);
});
test('Roco suction drags the player in and spits them out; stickers slow but never hurt', () => {
  const [g, e] = boss('collectorRoco'); g.p.x = 18; g.p.y = 8;
  g.beginEnemyTell(e, 'suction'); g.s.time = e.tell.until; g.executeEnemy(e);
  const before = g.p.x; for (let i = 0; i < 30; i++) g.update(1 / 60, {});
  assert.ok(g.p.x < before - 0.5, 'pulled toward Roco');
  g.p.x = 15; for (let i = 0; i < 90; i++) g.update(1 / 60, {});
  assert.ok(g.p.hp < 100, 'spat out at the mouth'); assert.ok(Math.hypot(g.p.x - e.x, g.p.y - e.y) > data.slice.bossAI.collectorRoco.spitRadius, 'pushed back out');
  const [h, r] = boss('collectorRoco'), ai = data.slice.bossAI.collectorRoco; h.p.x = 20; h.p.y = 8;
  h.beginEnemyTell(r, 'stickers'); h.s.time = r.tell.until; h.executeEnemy(r); r.ready = 1e9; r.speed = 0;
  // Seven stickers fall one after another on wherever the player stands, then peel off.
  for (let i = 0; i < Math.ceil((ai.stickerCount * ai.stickerGap + ai.stickerWarn) * 60) + 2; i++) h.update(1 / 60, {});
  assert.equal(h.s.casts.filter(c => c.shape === 'sticker').length, ai.stickerCount);
  for (let i = 0; i < Math.ceil(ai.stickerSeconds * 60) + 2; i++) h.update(1 / 60, {});
  assert.equal(h.s.casts.filter(c => c.shape.startsWith('sticker')).length, 0, 'all stickers gone');
  h.s.casts.push({ id: 'test', shape: 'sticker', x: 20.5, y: 8, radius: ai.stickerRadius, age: 0, duration: 9, slow: ai.stickerSlow, tilt: 0 });
  const x0 = h.p.x; for (let i = 0; i < 30; i++) h.update(1 / 60, { x: 1 });
  const slowed = h.p.x - x0; h.s.casts = h.s.casts.filter(c => c.shape !== 'sticker');
  const x1 = h.p.x; for (let i = 0; i < 30; i++) h.update(1 / 60, { x: 1 });
  assert.ok(slowed < (h.p.x - x1) * 0.7, 'a sticker underfoot slows'); assert.equal(h.p.hp, 100);
  assert.ok(data.slice.bossAI.collectorRoco.magnetRadius >= 3.5);
});
test('Roco stops at half health behind a shield; three cans batted back break it, running out of time heals him', () => {
  const rule = data.slice.bossAI.collectorRoco.phaseBreaks[0];
  const [g, e] = boss('collectorRoco'); g.p.x = 17; g.p.y = 8; e.hp = e.maxHp * 0.52;
  g.hitEnemy(e, 999); assert.equal(e.hp, e.maxHp * rule.at); assert.ok(e.breaking);
  g.hitEnemy(e, 50); assert.equal(e.hp, e.maxHp * rule.at, 'the shield takes nothing');
  // Feed three cans straight back.
  for (let i = 0; i < 3; i++) e.breaking.cans.push({ id: 'c' + i, x: e.x + 1.5, y: e.y, back: true, spin: 0 });
  for (let i = 0; i < 30 && e.breaking; i++) g.update(1 / 60, {});
  assert.equal(e.breaking, null); assert.deepEqual(e.breaksDone, [0]); assert.ok(e.vulnerableUntil > g.s.time);
  const before = e.hp; g.hitEnemy(e, 10); assert.ok(before - e.hp > 10, 'takes more while stunned');
  // A second Roco runs out of time: big hit, heals 5%, and the break comes back at half health.
  const [h, r] = boss('collectorRoco'); h.p.x = 25; h.p.y = 8; r.hp = r.maxHp * 0.51; h.hitEnemy(r, 999);
  h.s.time = r.breaking.until; h.updatePhaseBreak(r, 1 / 60); h.s.time = r.breaking.failAt; const hp = h.p.hp; h.updatePhaseBreak(r, 1 / 60);
  assert.equal(hp - h.p.hp, rule.failDamage); assert.equal(r.breaking, null); assert.deepEqual(r.breaksDone, []);
  assert.ok(Math.abs(r.hp - r.maxHp * (rule.at + rule.failHeal)) < 1e-6);
  r.hp = r.maxHp * 0.51; h.hitEnemy(r, 999); assert.ok(r.breaking, 'has to be broken again');
});
test('Brass breaks twice: drums struck in the shown order at 66%, flag bearers knocked down at 33%', () => {
  const [g, e] = boss('captainBrass'), [drums, flags] = data.slice.bossAI.captainBrass.phaseBreaks; g.p.x = 20; g.p.y = 8;
  e.hp = e.maxHp * 0.7; g.hitEnemy(e, 999); assert.equal(e.hp, e.maxHp * drums.at); assert.equal(e.breaking.kind, 'drums');
  const b = e.breaking; b.phase = 'play';
  g.strikeDrum(e, b.order[1]); assert.equal(b.phase, 'show', 'a wrong drum replays the order'); b.phase = 'play';
  for (const i of b.order) g.strikeDrum(e, i);
  g.update(1 / 60, {}); assert.equal(e.breaking, null); assert.deepEqual(e.breaksDone, [0]);
  e.exposedUntil = 0; e.vulnerableUntil = 0; g.hitEnemy(e, 999); assert.equal(e.hp, e.maxHp * flags.at); assert.equal(e.breaking.kind, 'flags');
  g.p.x = 2; g.p.y = 2;
  for (const s of e.breaking.soldiers.filter(x => x.flag)) s.down = true;
  g.update(1 / 60, {}); assert.equal(e.breaking, null); assert.deepEqual(e.breaksDone, [0, 1]);
});
test('Brass stomps out rings to dodge through, and charges along a line before a trumpet blast', () => {
  const [g, e] = boss('captainBrass'), ai = data.slice.bossAI.captainBrass; g.p.x = 17; g.p.y = 8;
  g.beginEnemyTell(e, 'stomp'); g.s.time = e.tell.until; g.executeEnemy(e); e.ready = 1e9;
  assert.equal(g.s.casts.filter(c => c.shape === 'stompRing').length, ai.stompRings);
  for (let i = 0; i < 60; i++) g.update(1 / 60, {});
  assert.ok(g.p.hp < 100, 'a ring that reaches the player hurts');
  const [h, r] = boss('captainBrass'); h.p.x = 17; h.p.y = 8;
  h.beginEnemyTell(r, 'charge'); h.s.time = r.tell.until; h.executeEnemy(r); r.ready = 1e9;
  for (let i = 0; i < 90; i++) h.update(1 / 60, {});
  assert.ok(r.x > 15, 'ran along the line'); assert.ok(h.p.hp < 100);
});
test('Brass marches add one lane at half HP while leaving multiple safe gaps', () => {
  const [g, e] = boss('captainBrass');
  e.hp = e.maxHp * 0.49; g.p.x = 25; g.p.y = 10; g.beginEnemyTell(e, 'march');
  assert.ok(e.tell.until - e.tell.started >= 0.8); g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 88);
  g.s.time += 1; g.p.x = 15; g.beginEnemyTell(e, 'march'); g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 88);
});
test('Brass fan followup is separately telegraphed and trumpet wave preserves the shown gap', () => {
  const [g, e] = boss('captainBrass'); g.p.x = 18; g.p.y = 8;
  g.beginEnemyTell(e, 'fan'); g.s.time = e.tell.until; g.executeEnemy(e);
  assert.equal(e.followup.type, 'fanSecond'); g.updateEnemies(1 / 60);
  assert.equal(e.tell.type, 'fanSecond'); assert.ok(e.tell.until - e.tell.started >= 0.89);
  e.followup = null; e.tell = null; g.beginEnemyTell(e, 'trumpetWave'); const safeAngle = e.tell.angle; g.executeEnemy(e);
  assert.equal(g.s.projectiles.length, 9);
  for (const projectile of g.s.projectiles) {
    const difference = Math.abs(Math.atan2(Math.sin(projectile.angle - safeAngle), Math.cos(projectile.angle - safeAngle)));
    assert.ok(difference >= data.slice.bossAI.captainBrass.waveGapDegrees * Math.PI / 360 - 1e-8);
  }
});
test('death inside a magnet field leaves no hostile objects in the repaired hub', () => {
  const [g, e] = boss('collectorRoco'); g.beginEnemyTell(e, 'magnet'); g.executeEnemy(e);
  const field = g.s.casts[0]; field.damageAt = 0; g.p.hp = 1;
  g.update(1 / 60); assert.equal(g.s.mode, 'returned'); assert.equal(g.s.casts.length, 0); assert.equal(g.s.enemies.length, 0); assert.equal(g.p.hp, 100);
});

const onMaps = { ...data, maps: JSON.parse(await readFile(new URL('../src/data/maps.json', import.meta.url), 'utf8')) };
const bossAt = (node, hpShare = 1) => {
  const g = new Game(onMaps); g.s.mode = 'hub'; g.s.profile.registered = true; g.s.profile.loadout = ['fire', 'ice']; g.startRun(7); g.s.run.node = node; g.enterNode(); g.s.entry = null; Object.assign(g.p, g.map.spawn);
  const boss = g.s.enemies[0]; boss.hp = boss.maxHp * hpShare; boss.ready = 1e9; g.p.hp = g.p.maxHp = 1e4; g.rollCrit = () => false; return [g, boss];
};
const until = (g, tell) => { g.s.time = tell.until; };
const roundOf = (g, boss, turns = 12) => Array.from({ length: turns }, () => g.nextBossPattern(boss));

test('bosses unlock patterns as they are hurt', () => {
  const [g, roco] = bossAt(4); assert.deepEqual([...new Set(roundOf(g, roco))].sort(), ['claw', 'magnet', 'overcharge', 'stickers', 'suction']);
  // Roco has two phases: alarm and crane both join at half health.
  roco.hp = roco.maxHp * 0.55; assert.ok(!new Set(roundOf(g, roco)).has('alarm'));
  roco.hp = roco.maxHp * 0.5; assert.ok(new Set(roundOf(g, roco)).has('alarm')); assert.ok(new Set(roundOf(g, roco)).has('crane'));
  const [h, brass] = bossAt(11); assert.ok(new Set(roundOf(h, brass)).has('bell')); assert.ok(!new Set(roundOf(h, brass)).has('column'));
  // Brass has three: the column joins below 66%, the safe carpet below 33%.
  brass.hp = brass.maxHp * 0.5; const middle = new Set(roundOf(h, brass)); assert.ok(middle.has('column') && !middle.has('carpet'));
  brass.hp = brass.maxHp * 0.3; const late = new Set(roundOf(h, brass)); assert.ok(late.has('column') && late.has('carpet'));
});

test('hitting Roco during the alarm costs the player, and waiting does not', () => {
  const [g, roco] = bossAt(4, 0.5); const hp = g.p.hp;
  g.beginEnemyTell(roco, 'alarm'); assert.equal(g.bossWarning, '경보! 공격을 멈추세요');
  until(g, roco.tell); g.executeEnemy(roco); g.hitEnemy(roco, 10);
  assert.equal(g.p.hp, hp - roco.damage);
  g.s.time = roco.alarmUntil + 0.1; g.p.invulnerableUntil = 0; const after = g.p.hp; g.hitEnemy(roco, 10); assert.equal(g.p.hp, after);
});

test('the crane drops land on the floor and only hurt those under them', () => {
  const [g, roco] = bossAt(4, 0.2); g.beginEnemyTell(roco, 'crane'); const { drops } = roco.tell;
  assert.equal(drops.length, data.slice.bossAI.collectorRoco.craneDrops); assert.deepEqual(drops[0], { x: g.p.x, y: g.p.y });
  for (const { x, y } of drops) assert.ok(fitsMap(x, y, 0.4, g.map));
  const hp = g.p.hp; until(g, roco.tell); g.executeEnemy(roco); assert.equal(g.p.hp, hp - roco.damage);
  const [h, other] = bossAt(4, 0.2); h.beginEnemyTell(other, 'crane'); other.tell.drops = [{ x: h.p.x + 9, y: h.p.y }]; const full = h.p.hp; until(h, other.tell); h.executeEnemy(other); assert.equal(h.p.hp, full);
});

test('the bell punishes moving or attacking, once, and holding still is safe', () => {
  const ring = () => { const [g, brass] = bossAt(11); g.beginEnemyTell(brass, 'bell'); until(g, brass.tell); g.executeEnemy(brass); return [g, brass]; };
  const [still, a] = ring(), hp = still.p.hp; for (let i = 0; i < 100; i++) still.update(1 / 60, {}); assert.equal(still.p.hp, hp); assert.equal(still.s.bellWatch, null); assert.equal(a.tell, null);
  const [walker, b] = ring(); for (let i = 0; i < 60; i++) walker.update(1 / 60, { x: 1 }); assert.equal(walker.p.hp, hp - b.damage);
  const [hitter, c] = ring(); hitter.update(1 / 60, { basic: true, aim: { x: 30, y: 12 } }); hitter.update(1 / 60, {}); assert.equal(hitter.p.hp, hp - c.damage);
});

test('the march follows the carpets on the map', () => {
  const [g, brass] = bossAt(11); const lanes = g.marchLanes(brass); assert.equal(lanes.length, 3);
  const [[ax, ay], [bx, by]] = lanes[1], full = g.p.hp; g.p.x = (ax + bx) / 2; g.p.y = (ay + by) / 2;
  g.beginEnemyTell(brass, 'march'); until(g, brass.tell); g.executeEnemy(brass); assert.equal(g.p.hp, full - brass.damage);
  brass.hp = brass.maxHp * 0.4; assert.equal(g.marchLanes(brass).length, 4);
});

test('only the green carpet is safe, and it can always be reached', () => {
  const [g, brass] = bossAt(11, 0.4); g.beginEnemyTell(brass, 'carpet'); const lanes = g.marchLanes(brass, true), [[ax, ay], [bx, by]] = lanes[brass.tell.safe], hp = g.p.hp;
  const reach = data.combat.player.speed * data.slice.bossAI.captainBrass.tellSeconds.carpet;
  assert.ok(segmentDistance(g.p, { x: ax, y: ay }, { x: bx, y: by }) <= reach);
  g.p.x = (ax + bx) / 2; g.p.y = (ay + by) / 2; until(g, brass.tell); g.executeEnemy(brass); assert.equal(g.p.hp, hp);
  const [h, other] = bossAt(11, 0.4); h.beginEnemyTell(other, 'carpet'); const safe = h.marchLanes(other, true)[other.tell.safe], [[cx, cy], [dx, dy]] = safe, full = h.p.hp;
  h.p.x = (cx + dx) / 2 + 2; h.p.y = (cy + dy) / 2 + 2; until(h, other.tell); h.executeEnemy(other); assert.equal(h.p.hp, full - other.damage);
});

test('the column hits once, spares the gap, and leaves when it has crossed', () => {
  const pass = place => {
    const [g, brass] = bossAt(11, 0.4); g.startColumn(brass); const hp = g.p.hp, seconds = g.s.column.seconds;
    place(g); for (let i = 0; i < seconds * 60 + 10; i++) { g.tickBossHazards(1 / 60); g.s.time += 1 / 60; place(g); }
    return [hp - g.p.hp, g.s.column, brass.damage];
  };
  const middle = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [through, gone, damage] = pass(g => { const line = g.columnLine; if (!line) return; const [x, y] = middle(line.gapA, line.gapB); g.p.x = x; g.p.y = y; });
  assert.equal(through, 0); assert.equal(gone, null);
  const [struck] = pass(g => { g.p.x = 20; g.p.y = 12; const line = g.columnLine; if (line && g.s.column.gapFrom > 0.5) { g.p.x = line.a[0] + 0; g.p.y = line.a[1]; } else if (line) { g.p.x = line.b[0]; g.p.y = line.b[1]; } });
  assert.equal(struck, damage);
});
