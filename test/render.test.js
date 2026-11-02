import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import fs from 'node:fs';
import { stickVector, autoAim } from '../src/ui/touch-controls.js';
import { CanvasRenderer, STATUS_ICONS } from '../src/render/canvas.js';
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));

test('renderer handles every enemy archetype and all boss telegraph shapes', () => {
  const numericMethods = new Set(['fillRect', 'moveTo', 'lineTo', 'arc', 'ellipse', 'translate', 'rotate', 'scale', 'setTransform']);
  const calls = [];
  const context = new Proxy({}, { get: (_, name) => (...args) => {
    if (numericMethods.has(name)) for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${name} received ${arg}`);
    calls.push(name);
  }, set: () => true });
  const g = new Game(data), renderer = new CanvasRenderer({ getContext: () => context }, g);
  for (const mode of ['opening', 'hub', 'intro', 'combat', 'shop', 'unwind']) {
    g.s.mode = mode;
    renderer.render();
  }
  g.s.mode = 'combat';
  for (const type of [...Object.keys(data.slice.enemies), ...data.slice.bosses]) {
    g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1;
    const enemy = g.spawnEnemy(type, { x: 18, y: 8 });
    const patterns = enemy.boss ? [...enemy.patterns, ...(type === 'captainBrass' ? ['fanSecond'] : [])] : [enemy.attack, ...(type === 'elite' ? ['eliteWave'] : [])];
    for (const pattern of patterns) { g.beginEnemyTell(enemy, pattern); renderer.render(); }
  }
  g.s.profile.registered=true;g.s.mode='hub';g.startRun(4711);g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1;
  const fusion=data.combat.fusions.find(f=>f.id==='magneticIceClamp');
  g.makeCast(fusion,data.slice.fusionBehavior[fusion.id],{level:1,rarity:'common'},{x:18,y:8},true);
  renderer.render();g.updateCasts(.55);renderer.render();g.updateCasts(.07);renderer.render();
  assert.ok(g.s.effects.some(fx=>fx.type==='iceClamp'));
  assert.ok(calls.length > 1000);
});

test('ordinary enemies warn with their body, and only bosses paint the floor', () => {
  const g = new Game(data), calls = [];
  const context = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); }, set: () => true });
  const r = new CanvasRenderer({ getContext: () => context }, g), filled = () => calls.filter(([name]) => ['arc', 'fillRect'].includes(name)).length;
  const tell = { x: 5, y: 5, targetX: 8, targetY: 5, angle: 0, started: 0, until: 0.7 };
  r.drawTell({ ...g.config.enemies.guard, tell: { ...tell, type: 'melee' } });
  assert.equal(filled(), 0);
  const blinking = { boss: false, tell: { ...tell, type: 'melee' } };
  g.s.time = 0.05; assert.equal(r.tellBlink(blinking), true);
  g.s.time = 0.15; assert.equal(r.tellBlink(blinking), false);
  g.s.time = 0.65; assert.equal(r.tellBlink(blinking), false);
  g.s.time = 0.05; assert.equal(r.tellBlink({ ...blinking, boss: true }), false);
  g.s.profile.settings.reducedMotion = true; assert.equal(r.tellBlink(blinking), false);
  g.s.profile.settings.reducedMotion = false;
  r.drawTell({ boss: true, type: 'collectorRoco', tell: { ...tell, type: 'overcharge' } });
  assert.ok(filled() > 0);
});

test('an enemy shows what it is suffering, and frozen replaces chilled', () => {
  const g = new Game(data), r = new CanvasRenderer({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }, g);
  const enemy = { burnStacks: [5, 5, -1], statuses: { chill: 5, shock: 5, windPressure: -1 }, frozenUntil: 0 };
  assert.deepEqual(r.statusBadges(enemy), [{ id: 'burn', count: 2 }, { id: 'chill' }, { id: 'shock' }]);
  enemy.frozenUntil = 5;
  assert.deepEqual(r.statusBadges(enemy).map(b => b.id), ['burn', 'frozen', 'shock']);
  assert.deepEqual(r.statusBadges({ burnStacks: [], statuses: {} }), []);
});

test('every status has its icon on disk, at the size it is drawn', () => {
  for (const url of Object.values(STATUS_ICONS)) {
    const png = fs.readFileSync(new URL(`..${url}`, import.meta.url));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [24, 24], url);
  }
});

test('the thumb stick has a dead zone and never passes full speed', () => {
  assert.deepEqual(stickVector(2, 0), { x: 0, y: 0 });
  assert.deepEqual(stickVector(0, 26), { x: 0, y: 0.5 });
  const { x, y } = stickVector(300, 400); assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9);
});

test('touch aims at the nearest living enemy, or where the player is heading', () => {
  const player = { x: 0, y: 0, moveAngle: 0 };
  assert.deepEqual(autoAim(player, [{ x: 9, y: 0, hp: 5 }, { x: 2, y: 0, hp: 0 }, { x: 0, y: 4, hp: 5 }]), { x: 0, y: 4 });
  assert.deepEqual(autoAim(player, []), { x: 3, y: 0 });
});
