import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { CanvasRenderer } from '../src/render/canvas.js';
import { PlayerAnimator, nearestDirection } from '../src/animation/player-animator.js';
import { SpriteLibrary, frameAtProgress } from '../src/animation/sprite-library.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clips = await json('../art/animations/player/game-clips.json');
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, await json(`../src/data/${name}.json`)])));
const library = new SpriteLibrary(clips, new Map(Object.values(clips.clips).map(clip => [clip.sheet, { fake: true }])));
const pngSize = file => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const combat = () => { const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; return g; };

test('every action has eight directions backed by a sheet of the declared size', () => {
  for (const action of ['attack-1', 'attack-2', 'attack-3', 'death', 'dodge', 'hit', 'idle', 'run', 'walk']) assert.ok(clips.actions.includes(action), action);
  assert.equal(Object.keys(clips.clips).length, clips.actions.length * 8);
  for (const [key, clip] of Object.entries(clips.clips)) {
    const [width, height] = pngSize(new URL(`..${clip.sheet}`, import.meta.url));
    assert.equal(width, clip.frameWidth * clip.columns, key);
    assert.equal(height, clip.frameHeight * Math.ceil(clip.frameCount / clip.columns), key);
    assert.equal(clip.frameDurationsMs.length, clip.frameCount, key);
    assert.ok(clip.anchor[0] > 0 && clip.anchor[0] < clip.frameWidth && clip.anchor[1] > 0 && clip.anchor[1] < clip.frameHeight, key);
  }
});

test('frame lookup follows uneven frame times and stops on the last frame', () => {
  const clip = { frameCount: 3, frameDurationsMs: [100, 300, 100], durationMs: 500 };
  assert.deepEqual([0, 0.19, 0.21, 0.79, 0.81, 1, 2].map(p => frameAtProgress(clip, p)), [0, 0, 1, 1, 2, 2, 2]);
});

test('angles map to the eight screen directions and hold near a boundary', () => {
  assert.equal(nearestDirection(0), 'east');
  assert.equal(nearestDirection(Math.PI / 2), 'south');
  assert.equal(nearestDirection(-Math.PI / 2), 'north');
  assert.equal(nearestDirection(-2.4), 'north-west');
  const justPastBoundary = Math.PI / 8 + 0.05;
  assert.equal(nearestDirection(justPastBoundary), 'south-east');
  assert.equal(nearestDirection(justPastBoundary, 'east', 8 * Math.PI / 180), 'east');
});

test('animator follows dodge, attack, hit and movement in that priority', () => {
  const g = combat(), a = new PlayerAnimator(library), step = () => a.update(1 / 60, g);
  g.p.angle = 0;
  assert.equal(step().action, 'idle');
  for (let i = 0; i < 12; i++) { g.p.x += 5.5 / 60; step(); }
  assert.deepEqual([a.pose.action, a.pose.direction], ['run', 'east']);
  g.effect('hurt', g.p.x, g.p.y, '#fff', 0.25, 0.8);
  assert.equal(step().action, 'hit');
  g.p.attack = { phase: 2, elapsed: 0.36, angle: Math.PI / 2, recovery: g.c.player.combo[2].recovery };
  assert.deepEqual([step().action, a.pose.direction], ['attack-3', 'south']);
  assert.equal(a.pose.frame, frameAtProgress(library.clip('attack-3', 'south'), 0.5));
  g.p.dodge = { elapsed: 0.09, angle: Math.PI };
  assert.deepEqual([step().action, a.pose.direction], ['dodge', 'west']);
});

test('animator returns to idle when movement stops and survives render frames without a step', () => {
  const g = combat(), a = new PlayerAnimator(library);
  for (let i = 0; i < 24; i++) { if (i % 2) g.p.x += 2 * 5.5 / 60; a.update(1 / 60, g); }
  assert.equal(a.pose.action, 'run');
  for (let i = 0; i < 30; i++) a.update(1 / 60, g);
  assert.equal(a.pose.action, 'idle');
});

test('a room change is not treated as running', () => {
  const g = combat(), a = new PlayerAnimator(library);
  a.update(1 / 60, g); g.p.x += 10;
  for (let i = 0; i < 6; i++) assert.equal(a.update(1 / 60, g).action, 'idle');
});

test('death plays through once while the intro waits and holds the last frame', () => {
  const g = combat(), a = new PlayerAnimator(library);
  g.s.mode = 'introDeath';
  assert.equal(a.update(0.1, g).action, 'death');
  const first = a.pose.frame;
  for (let i = 0; i < 40; i++) a.update(0.1, g);
  assert.ok(a.pose.frame > first);
  assert.equal(a.pose.frame, library.clip('death', a.pose.direction).frameCount - 1);
});

test('paused games keep the current pose', () => {
  const g = combat(), a = new PlayerAnimator(library);
  a.update(1 / 60, g); g.s.paused = true; g.p.attack = { phase: 0, elapsed: 0, angle: 0, recovery: 0.1 };
  assert.equal(a.update(1 / 60, g).action, 'idle');
});

test('renderer crops the current frame, and draws the doll without sprites', () => {
  const calls = [];
  const context = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); }, set: () => true });
  const g = combat(), renderer = new CanvasRenderer({ getContext: () => context }, g);
  renderer.render();
  assert.ok(!calls.some(call => call[0] === 'drawImage'));
  renderer.useSprites(library); calls.length = 0;
  g.p.attack = { phase: 0, elapsed: 0.21, angle: Math.PI / 2, recovery: g.c.player.combo[0].recovery };
  renderer.render(1 / 60);
  const draw = calls.find(call => call[0] === 'drawImage'), clip = library.clip('attack-1', 'south'), frame = frameAtProgress(clip, 0.5);
  assert.equal(draw[1].fake, true);
  assert.deepEqual(draw.slice(2, 6), [frame % clip.columns * 192, Math.floor(frame / clip.columns) * 192, 192, 192]);
  assert.deepEqual(draw.slice(8).map(size => Math.round(size * 100) / 100), [94.62, 94.62]);
  assert.equal((draw[6] * 2) % 1, 0);
});
