import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { CanvasRenderer } from '../src/render/canvas.js';
import { PlayerAnimator } from '../src/animation/player-animator.js';
import { CastEffects } from '../src/animation/cast-effects.js';
import { SpriteLibrary, frameAtProgress } from '../src/animation/sprite-library.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clips = await json('../art/animations/player/game-clips.json');
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, await json(`../src/data/${name}.json`)])));
const urls = [...Object.values(clips.clips).flatMap(c => [c.sheet, c.effect]), ...Object.values(clips.castEffects).map(e => e.sheet)].filter(Boolean);
const library = new SpriteLibrary(clips, new Map(urls.map(url => [url, { fake: url }])));
const pngSize = file => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const battle = () => { const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.p.x = 10; g.p.y = 8; g.p.angle = 0; return g; };
const slot = { level: 1, rarity: 'common' };
const cast = (g, id, target = { x: 14, y: 8 }) => {
  const fusion = data.combat.fusions.find(f => f.id === id), skill = fusion || data.combat.skills.find(s => s.id === id);
  g.makeCast(skill, (fusion ? data.slice.fusionBehavior : data.slice.skillBehavior)[id], slot, target, !!fusion);
  return g.s.casts.at(-1);
};
const pass = (g, seconds) => { g.s.time += seconds; g.s.casts.forEach(c => { c.age += seconds; }); };

test('every skill and fusion in the combat data has an action in eight directions', () => {
  for (const { id } of [...data.combat.skills, ...data.combat.fusions]) {
    const action = clips.castActions[id];
    assert.ok(action, id);
    for (const direction of clips.directions) assert.ok(clips.clips[`${action}/${direction}`], `${action}/${direction}`);
  }
});

test('every fusion has an effect sheet of the declared size, and only real frames play', () => {
  for (const { id } of data.combat.fusions) {
    const effect = clips.castEffects[id], [width, height] = pngSize(new URL(`..${effect.sheet}`, import.meta.url));
    assert.equal(width, effect.frameWidth * effect.columns, id);
    assert.equal(height % effect.frameHeight, 0, id);
    assert.ok(Math.max(...effect.playback) < width / effect.frameWidth * height / effect.frameHeight, id);
  }
  assert.deepEqual(clips.castEffects.frostCrosscut.playback, [0, 1, 8, 9, 10, 18, 19, 20]);
});

test('skill clips play at their authored speed and the same character size as movement', () => {
  assert.equal(clips.clips['heatSwing/south'].durationMs, 720);
  assert.equal(clips.clips['frostBolt/south'].durationMs, 800);
  assert.equal(clips.clips['pressureDash/south'].durationMs, 400);
  const sum = clips.clips['frostBolt/north'].frameDurationsMs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - clips.clips['frostBolt/north'].durationMs) < 1e-6);
  assert.equal(clips.clips['cast-forwardCast/north'].scale, 1);
});

test('the only direction without its own fusion body is marked as borrowing one', () => {
  const borrowed = Object.entries(clips.clips).filter(([, clip]) => clip.directionFallback).map(([key]) => key).sort();
  assert.deepEqual(borrowed, ['cast-forwardCast/south-east', 'cast-placeCast/south-east', 'cast-selfBurst/south-east']);
});

test('casting plays the body clip toward the cast and then returns to idle', () => {
  const g = battle(), a = new PlayerAnimator(library);
  a.update(1 / 60, g); cast(g, 'frostBolt'); g.s.casts = [];
  assert.deepEqual([a.update(1 / 60, g).action, a.pose.direction], ['frostBolt', 'east']);
  g.s.time += 0.4; a.update(1 / 60, g);
  assert.equal(a.pose.frame, frameAtProgress(library.clip('frostBolt', 'east'), 0.5));
  g.s.time += 0.5;
  assert.equal(a.update(1 / 60, g).action, 'idle');
});

test('a fusion uses its family body', () => {
  const families = { steamShatter: 'selfBurst', arcFurnace: 'forwardCast', magneticIceClamp: 'placeCast', stormFloat: 'placeCast' };
  for (const [id, family] of Object.entries(families)) {
    const g = battle(), a = new PlayerAnimator(library);
    a.update(1 / 60, g); cast(g, id);
    assert.equal(a.update(1 / 60, g).action, `cast-${family}`, id);
  }
});

test('walking releases a long cast once it has read, but a dash always plays', () => {
  const g = battle(), a = new PlayerAnimator(library);
  a.update(1 / 60, g); cast(g, 'coolingField');
  for (let i = 0; i < 24; i++) { g.s.time += 1 / 60; g.p.x += 5.5 / 60; a.update(1 / 60, g); }
  assert.equal(a.pose.action, 'coolingField');
  for (let i = 0; i < 12; i++) { g.s.time += 1 / 60; g.p.x += 5.5 / 60; a.update(1 / 60, g); }
  assert.equal(a.pose.action, 'run');
  const d = battle(), b = new PlayerAnimator(library);
  b.update(1 / 60, d); cast(d, 'pressureDash'); d.s.time += 0.15; d.p.x += 2;
  assert.equal(b.update(1 / 60, d).action, 'pressureDash');
});

test('ending combat does not freeze the caster mid-cast', () => {
  const g = battle(), a = new PlayerAnimator(library);
  a.update(1 / 60, g); cast(g, 'arcFurnace');
  assert.equal(a.update(1 / 60, g).action, 'cast-forwardCast');
  g.clearCombat();
  assert.equal(a.update(1 / 60, g).action, 'idle');
});

test('a cast shows over a held basic attack, and a dodge still takes over', () => {
  const g = battle(), a = new PlayerAnimator(library), input = { aim: { x: 14, y: 8 }, basic: true };
  g.s.run.slots = [{ element: 'fire', level: 1, rarity: 'common' }]; g.p.energy = 100;
  for (let i = 0; i < 10; i++) { g.update(1 / 60, input); a.update(1 / 60, g); }
  assert.match(a.pose.action, /^attack-/);
  g.update(1 / 60, { ...input, skill: 0 });
  const frames = new Set();
  for (let i = 0; i < 40; i++) { g.update(1 / 60, input); const pose = a.update(1 / 60, g); assert.equal(pose.action, 'heatSwing'); frames.add(pose.frame); }
  assert.ok(frames.size >= 12);
  g.p.dodge = { elapsed: 0.05, angle: 0 };
  assert.equal(a.update(1 / 60, g).action, 'dodge');
  g.p.dodge = null;
  for (let i = 0; i < 12; i++) { g.update(1 / 60, input); a.update(1 / 60, g); }
  assert.match(a.pose.action, /^attack-/);
});

test('a short skill plays through its peak while walking', () => {
  const g = battle(), a = new PlayerAnimator(library);
  g.s.run.slots = [{ element: 'fire', level: 1, rarity: 'common' }]; g.p.energy = 100;
  const input = { aim: { x: 14, y: 8 }, x: 1 };
  for (let i = 0; i < 10; i++) { g.update(1 / 60, input); a.update(1 / 60, g); }
  g.update(1 / 60, { ...input, skill: 0 });
  const frames = new Set();
  for (let i = 0; i < 30; i++) { g.update(1 / 60, input); const pose = a.update(1 / 60, g); if (pose.action === 'heatSwing') frames.add(pose.frame); }
  assert.ok(Math.max(...frames) >= 11, `reached frame ${Math.max(...frames)}`);
});

test('effects appear at the point the cast damages, after the hand releases', () => {
  const g = battle(), fx = new CastEffects(library), c = cast(g, 'arcFurnace');
  assert.deepEqual(fx.update(g), []);
  pass(g, 0.3);
  const [shown] = fx.update(g);
  assert.deepEqual([shown.x, shown.y, shown.lift], [c.x, c.y, 0]);
  assert.equal(shown.effect, clips.castEffects.arcFurnace);
});

test('the storm orb hovers, and the crosscut travels out to its range', () => {
  const g = battle(), fx = new CastEffects(library), orb = cast(g, 'stormFloat');
  pass(g, 0.5);
  assert.equal(fx.update(g)[0].lift, orb.hoverHeight);
  const h = battle(), cuts = new CastEffects(library), cut = cast(h, 'frostCrosscut');
  pass(h, 0.3);
  const near = cuts.update(h)[0].x;
  pass(h, 0.7);
  const far = cuts.update(h)[0].x;
  assert.ok(far > near && far <= h.p.x + cut.range);
});

test('an effect outlives its cast, follows a moving one, and ends with the room', () => {
  const g = battle(), fx = new CastEffects(library), c = cast(g, 'fireCyclone');
  pass(g, 0.3); fx.update(g);
  c.x += 1; const moved = c.x;
  assert.equal(fx.update(g)[0].x, moved);
  g.s.casts = []; g.s.time += 0.5;
  assert.equal(fx.update(g).length, 1);
  g.s.time += 5;
  assert.equal(fx.update(g).length, 0);
  cast(g, 'fireCyclone'); pass(g, 0.3); fx.update(g);
  g.s.mode = 'reward'; g.s.casts = [];
  assert.deepEqual(fx.update(g), []);
});

test('renderer draws the effect frame and drops the code shapes it replaces', () => {
  const calls = [];
  const context = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); }, set: () => true });
  const g = battle(), r = new CanvasRenderer({ getContext: () => context }, g), orb = cast(g, 'stormFloat');
  const circles = () => calls.filter(call => call[0] === 'arc' && call[2] === orb.y * 20 - 16).length;
  r.render(1 / 60);
  assert.ok(circles() > 0);
  r.useSprites(library); calls.length = 0; pass(g, 0.5); r.render(1 / 60);
  assert.equal(circles(), 0);
  const effect = clips.castEffects.stormFloat, draw = calls.find(call => call[0] === 'drawImage' && call[1].fake === effect.sheet);
  assert.ok(draw);
  assert.deepEqual(draw.slice(4, 6), [effect.frameWidth, effect.frameHeight]);
  assert.deepEqual(draw.slice(8), [effect.frameWidth / 2, effect.frameHeight / 2]);
});

test('the second skills cast PixelLab bodies in all eight directions, with an effect at the cast', () => {
  for (const id of ['exhaustBurst', 'coolingField', 'capacitorStrike', 'vortexIntake']) {
    for (const direction of clips.directions) assert.equal(clips.clips[`${id}/${direction}`].provider, 'pixellab', `${id}/${direction}`);
    const effect = clips.castEffects[id];
    assert.ok(effect.playback.every(frame => Number.isInteger(frame) && frame >= 0), id);
    assert.ok(fs.existsSync(new URL(`..${effect.sheet}`, import.meta.url)), id);
  }
});
