import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
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
