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
  g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 88);
  g.s.time += 1; g.p.y = 11; g.beginEnemyTell(e, 'claw'); g.p.y = 5; g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 88);
  g.s.time += 1; g.beginEnemyTell(e, 'magnet'); g.s.time = e.tell.until; g.executeEnemy(e);
  const magnet = g.s.casts.find(c => c.shape === 'magnet'); assert.ok(magnet.pull < data.combat.player.speed); assert.equal(g.p.hp, 88);
});
test('Brass marches add one lane at half HP while leaving multiple safe gaps', () => {
  const [g, e] = boss('captainBrass');
  e.hp = e.maxHp * 0.49; g.p.x = 25; g.p.y = 10; g.beginEnemyTell(e, 'march');
  assert.ok(e.tell.until - e.tell.started >= 0.8); g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 84);
  g.s.time += 1; g.p.x = 15; g.beginEnemyTell(e, 'march'); g.s.time = e.tell.until; g.executeEnemy(e); assert.equal(g.p.hp, 84);
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
  const g = new Game(onMaps); g.s.mode = 'hub'; g.s.profile.registered = true; g.s.profile.loadout = ['fire', 'ice']; g.startRun(7); g.s.run.node = node; g.enterNode();
  const boss = g.s.enemies[0]; boss.hp = boss.maxHp * hpShare; boss.ready = 1e9; g.p.hp = g.p.maxHp = 1e4; g.rollCrit = () => false; return [g, boss];
};
const until = (g, tell) => { g.s.time = tell.until; };
const roundOf = (g, boss, turns = 12) => Array.from({ length: turns }, () => g.nextBossPattern(boss));

test('bosses unlock patterns as they are hurt', () => {
  const [g, roco] = bossAt(4); assert.deepEqual([...new Set(roundOf(g, roco))].sort(), ['claw', 'magnet', 'overcharge']);
  roco.hp = roco.maxHp * 0.5; assert.ok(new Set(roundOf(g, roco)).has('alarm')); assert.ok(!new Set(roundOf(g, roco)).has('crane'));
  roco.hp = roco.maxHp * 0.2; assert.ok(new Set(roundOf(g, roco)).has('crane'));
  const [h, brass] = bossAt(11); assert.ok(new Set(roundOf(h, brass)).has('bell')); assert.ok(!new Set(roundOf(h, brass)).has('column'));
  brass.hp = brass.maxHp * 0.4; const late = new Set(roundOf(h, brass)); assert.ok(late.has('column') && late.has('carpet'));
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
