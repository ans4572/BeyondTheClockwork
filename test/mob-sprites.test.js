import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { CanvasRenderer } from '../src/render/canvas.js';
import { MobAnimator } from '../src/animation/mob-animator.js';
import { SpriteLibrary, frameAtProgress } from '../src/animation/sprite-library.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clips = await json('../art/animations/mobs/normal-elite/game-clips.json');
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, await json(`../src/data/${name}.json`)])));
const asLibrary = source => new SpriteLibrary(source, new Map(Object.values(source.clips).flatMap(clip => [clip.sheet, clip.effect].filter(Boolean)).map(url => [url, { fake: url }])));
const library = asLibrary(clips);
const pngSize = file => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const battle = (type = 'guard') => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1;
  return { g, enemy: g.spawnEnemy(type, { x: 18, y: 8 }) };
};
const tick = (a, g, seconds = 1 / 60) => { g.s.time += seconds; return a.update(seconds, g); };

test('all four mobs have idle, move and attack in eight directions on real sheets', () => {
  assert.equal(Object.keys(clips.clips).length, 144);
  for (const [key, clip] of Object.entries(clips.clips)) {
    for (const url of [clip.sheet, clip.effect].filter(Boolean)) {
      const [width, height] = pngSize(new URL(`..${url}`, import.meta.url));
      assert.equal(width, clip.frameWidth * clip.columns, key);
      assert.equal(height, clip.frameHeight * Math.ceil(clip.frameCount / clip.columns), key);
    }
    if (key.includes('-attack/')) assert.ok((clip.effect || clip.provider === 'pixellab') && clip.lastEventMs > 0, key);
  }
});

test('attack clips last exactly as long as the combat data they play over', () => {
  const { enemies } = data.slice;
  for (const type of ['guard', 'trumpet', 'rabbit', 'rat', 'nutcracker']) assert.equal(clips.clips[`${type}-attack/south`].durationMs, Math.round((enemies[type].tell + enemies[type].recovery) * 1000), type);
  assert.equal(clips.clips['elite-attack/south'].durationMs, Math.round((enemies.elite.tell + enemies.elite.followupDelay + enemies.elite.recovery) * 1000));
});

test('a mob stands, walks, and faces where it is going', () => {
  const { g, enemy } = battle(), a = new MobAnimator(library);
  assert.equal(tick(a, g).get(enemy.id).action, 'guard-idle');
  enemy.facing = Math.PI / 2;
  const frames = new Set();
  for (let i = 0; i < 40; i++) { enemy.y += 2.1 / 60; frames.add(tick(a, g).get(enemy.id).frame); }
  const pose = a.poses.get(enemy.id);
  assert.deepEqual([pose.action, pose.direction], ['guard-move', 'south']);
  assert.ok(frames.size > 8);
  for (let i = 0; i < 6; i++) tick(a, g);
  assert.equal(a.poses.get(enemy.id).action, 'guard-idle');
});

test('walk frames stop when the mob is blocked, so feet do not slide', () => {
  const { g, enemy } = battle(), a = new MobAnimator(library);
  tick(a, g); enemy.x += 0.05; tick(a, g);
  const first = a.poses.get(enemy.id).frame;
  tick(a, g);
  assert.equal(a.poses.get(enemy.id).frame, first);
});

test('the attack clip starts with the tell, lines up with real time, and survives the strike', () => {
  const { g, enemy } = battle(), a = new MobAnimator(library), clip = library.clip('guard-attack', 'east');
  g.p.x = enemy.x + 1; g.p.y = enemy.y;
  g.beginEnemyTell(enemy, 'melee');
  assert.equal(tick(a, g).get(enemy.id).action, 'guard-attack');
  for (let i = 0; i < 29; i++) tick(a, g);
  assert.equal(a.poses.get(enemy.id).frame, frameAtProgress(clip, (g.s.time - enemy.tell.started) * 1000 / clip.durationMs));
  g.s.time = enemy.tell.until; g.executeEnemy(enemy); tick(a, g);
  assert.equal(a.poses.get(enemy.id).action, 'guard-attack');
  g.s.time += 1.05; tick(a, g);
  assert.equal(a.poses.get(enemy.id).action, 'guard-idle');
});

test('walking during recovery ends the attack clip only after the strike has read', () => {
  const { g, enemy } = battle(), a = new MobAnimator(library);
  g.beginEnemyTell(enemy, 'melee'); tick(a, g);
  g.s.time = enemy.tell.until; g.executeEnemy(enemy);
  enemy.x += 0.03; tick(a, g);
  assert.equal(a.poses.get(enemy.id).action, 'guard-attack');
  g.s.time += 0.3; enemy.x += 0.03; tick(a, g);
  assert.equal(a.poses.get(enemy.id).action, 'guard-move');
});

test('the elite follow-up tell does not restart its one long clip', () => {
  const { g, enemy } = battle('elite'), a = new MobAnimator(library), clip = library.clip('elite-attack', 'west');
  g.beginEnemyTell(enemy, 'doubleWave'); tick(a, g);
  const started = enemy.tell.started;
  g.s.time += 0.9; g.beginEnemyTell(enemy, 'eliteWave', 0.7); tick(a, g);
  assert.equal(a.poses.get(enemy.id).frame, frameAtProgress(clip, (g.s.time - started) * 1000 / clip.durationMs));
});

test('without hit and death clips a dead mob disappears and a hit keeps walking', () => {
  const { g, enemy } = battle(), a = new MobAnimator(library);
  tick(a, g); enemy.flashUntil = g.s.time + 0.09;
  assert.equal(tick(a, g).get(enemy.id).action, 'guard-idle');
  enemy.hp = 0;
  assert.equal(tick(a, g).has(enemy.id), false);
});

test('adding hit and death clips plays them with no code change', () => {
  const source = structuredClone(clips), one = { ...clips.clips['guard-attack/south'], frameCount: 4, durationMs: 400, frameDurationsMs: [100, 100, 100, 100] };
  for (const direction of clips.directions) { source.clips[`guard-hit/${direction}`] = one; source.clips[`guard-death/${direction}`] = one; }
  const { g, enemy } = battle(), a = new MobAnimator(asLibrary(source));
  tick(a, g); enemy.flashUntil = g.s.time + 0.09;
  assert.equal(tick(a, g).get(enemy.id).action, 'guard-hit');
  enemy.hp = 0;
  assert.equal(tick(a, g, 0.25).get(enemy.id).action, 'guard-death');
  tick(a, g, 0.5);
  assert.equal(a.poses.has(enemy.id), false);
  g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; tick(a, g);
  assert.equal(a.tracks.size, 0);
});

test('renderer draws body then effect, flashes on a hit, and leaves bosses as dolls', () => {
  const calls = [], filters = [];
  const context = new Proxy({ filter: 'none' }, { get: (t, name) => name === 'filter' ? t.filter : (...args) => { calls.push([name, ...args]); }, set: (t, name, value) => { if (name === 'filter') { t.filter = value; filters.push(value); } return true; } });
  const { g, enemy } = battle(), r = new CanvasRenderer({ getContext: () => context }, g);
  r.useMobSprites(library);
  r.drawDoll = (x, y, opts) => calls.push(['doll', opts.type]);
  g.beginEnemyTell(enemy, 'melee'); g.s.time += 0.1; r.render(1 / 60);
  const draws = calls.filter(call => call[0] === 'drawImage'), clip = library.clip('guard-attack', 'west');
  assert.deepEqual(draws.map(call => call[1].fake), [clip.sheet, clip.effect]);
  assert.ok(!calls.some(call => call[0] === 'doll' && call[1] === 'guard'));
  enemy.flashUntil = g.s.time + 0.09; filters.length = 0; r.render(1 / 60);
  assert.ok(filters.some(value => value.startsWith('brightness')) && filters.at(-1) === 'none');
  g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.spawnEnemy('collectorRoco', { x: 18, y: 8 }); calls.length = 0; r.render(1 / 60);
  assert.ok(calls.some(call => call[0] === 'doll' && call[1] === 'collectorRoco'));
});
