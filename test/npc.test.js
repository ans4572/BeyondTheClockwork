import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import { imageSize } from './image-size.js';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { CanvasRenderer } from '../src/render/canvas.js';
import { placeOf } from '../src/engine/map-geometry.js';
import { NpcDirector, BELL_EVERY_SECONDS, BELL_HOLD_SECONDS, FIRST_BELL_SECONDS, LANE_UNITS, FRONT_FACING_NORTH, walkDirection } from '../src/animation/npc-director.js';
import { SpriteLibrary } from '../src/animation/sprite-library.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clips = await json('../art/animations/npc/game-clips.json');
const [combat, progression, slice, maps] = await Promise.all(['combat', 'progression', 'slice', 'maps'].map(name => json(`../src/data/${name}.json`)));
const data = { combat, progression, slice, maps };
const library = new SpriteLibrary(clips, new Map(Object.values(clips.clips).map(clip => [clip.sheet, { fake: clip.sheet }])));
// Sheets are lossless WebP beside their PNG sources (scripts/build-webp-art.mjs); both report their size.
const pngSize = imageSize;
const street = { cast: ['C1', 'R1'], points: [[0, 0], [11, 0], [11, 11]], links: [[0, 1], [1, 2]] };

test('every NPC has real sheets of the declared size', () => {
  for (const name of new Set(maps.crowds.village.cast)) for (const action of ['idle', 'walk']) assert.ok(library.clip(`${name}-${action}`, 'south'), name);
  for (const action of ['bolt-idle', 'bolt-greeting', 'moru-idle']) assert.ok(library.clip(action, 'south-east'), action);
  for (const [key, clip] of Object.entries(clips.clips)) {
    const [width, height] = pngSize(new URL(`..${clip.sheet}`, import.meta.url));
    assert.equal(width, clip.frameWidth * clip.columns, key);
    assert.equal(height, clip.frameHeight * Math.ceil(clip.frameCount / clip.columns), key);
  }
});

test('every place in the data only uses NPCs that have clips', () => {
  for (const place of [maps.hub, ...Object.values(maps.maps)]) {
    for (const npc of place.npcs || []) assert.ok(library.clip(`${npc.character}-idle`, 'south'), npc.character);
  }
  for (const place of [maps.hub, maps.maps['stop-07']]) assert.ok(maps.crowds[placeOf(maps, place).crowd]);
  assert.ok(maps.hub.npcs.some(n => n.character === 'moru'));
  assert.ok(maps.maps['stop-07'].npcs.some(n => n.character === 'bolt' && n.greet));
});

test('every room has a spot on the route map', () => {
  for (const id of ['start', ...slice.rooms.map(room => room.id)]) assert.equal(maps.route[id].length, 2, id);
});

test('every resident type walks in the village or the night market', () => {
  // 2026-11-10: the town has 19 walkers; the five it lost still walk the night market, so no resident goes unseen.
  const residents = Object.keys(clips.clips).filter(key => key.endsWith('-walk/south')).map(key => key.split('-')[0]);
  assert.deepEqual([...new Set([...maps.crowds.village.cast, ...maps.crowds.market.cast])].sort(), residents.sort());
});

test('the village streets are connected and keep clear of Moru and Bolt', () => {
  const { points, links } = maps.crowds.village, reached = new Set([0]);
  for (let i = 0; i < points.length; i++) for (const [a, b] of links) if (reached.has(a) || reached.has(b)) { reached.add(a); reached.add(b); }
  assert.equal(reached.size, points.length);
  const gap = ([px, py], [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
  for (const place of [maps.hub, maps.maps['stop-07']]) {
    const crowd = maps.crowds[placeOf(maps, place).crowd];
    for (const npc of place.npcs) for (const [a, b] of crowd.links) assert.ok(gap([npc.x, npc.y], crowd.points[a], crowd.points[b]) >= 1.6 + LANE_UNITS, npc.character);
  }
});

const walking = (delta, d, options = {}) => d.update(delta, 'a', [], { crowd: street, ...options });

test('residents only walk along the streets, turn back at dead ends, and keep the same step', () => {
  const d = new NpcDirector(library);
  for (let i = 0; i < 400; i++) {
    const [a, b] = walking(0.1, d);
    if (d.elapsed % (BELL_EVERY_SECONDS + BELL_HOLD_SECONDS) >= BELL_EVERY_SECONDS) continue;
    for (const { x, y } of [a, b]) assert.ok((Math.abs(y) <= LANE_UNITS && x >= -LANE_UNITS && x <= 11 + LANE_UNITS) || (Math.abs(x - 11) <= LANE_UNITS && y >= -LANE_UNITS && y <= 11 + LANE_UNITS), `${x},${y}`);
    assert.equal(a.pose.frame, b.pose.frame);
  }
});

test('the whole town stops on the bell where it stands, facing the way it was going, and walks on from the same spot', () => {
  const d = new NpcDirector(library), before = walking(BELL_EVERY_SECONDS - 0.01, d);
  const held = walking(0.1, d, { lookAt: { x: -50, y: 0 } });
  for (const [i, resident] of held.entries()) {
    assert.equal(resident.pose.action, `${street.cast[i]}-walk`); assert.equal(resident.pose.direction, before[i].pose.direction);
    assert.ok(Math.hypot(resident.x - before[i].x, resident.y - before[i].y) < 0.1);
  }
  const still = walking(BELL_HOLD_SECONDS - 0.2, d, { lookAt: { x: -50, y: 0 } });
  assert.deepEqual(still.map(r => [r.x, r.y]), held.map(r => [r.x, r.y]));
  const [{ x, y }] = still; const [moved] = walking(0.5, d); assert.ok(Math.hypot(moved.x - x, moved.y - y) > 0.1);
});

test('walk frames advance, and pausing or reduced motion holds them still', () => {
  const d = new NpcDirector(library), a = walking(0.1, d)[0].pose.frame, b = walking(0.2, d)[0].pose.frame;
  assert.notEqual(a, b);
  const x = walking(0, d)[0].x;
  assert.equal(walking(5, d, { paused: true })[0].x, x);
  const still = walking(1, d, { reducedMotion: true })[0];
  assert.deepEqual([still.x, still.pose.action, still.pose.direction, still.pose.frame], [x, 'C1-walk', 'south', 0]);
});

test('standing NPCs breathe only when motion is allowed', () => {
  const d = new NpcDirector(library), moru = { character: 'moru', x: 1, y: 1, direction: 'south-east' };
  const frames = new Set([0, 0.3, 0.3, 0.3].map(step => d.update(step, 'a', [moru])[0].pose.frame));
  assert.ok(frames.size > 1);
  assert.equal(d.update(0.3, 'a', [moru], { reducedMotion: true })[0].pose.frame, 0);
});

const smoothly = (crowd, seconds, options = {}) => {
  const d = new NpcDirector(library), frames = [];
  for (let f = 0; f < seconds * 60; f++) frames.push(d.update(1 / 60, 'a', [], { crowd, lookAt: { x: 500, y: 500 }, ...options }).map(({ x, y }) => ({ x, y })));
  return { frames, jump: Math.max(...frames.slice(1).flatMap((frame, f) => frame.map((w, i) => Math.hypot(w.x - frames[f][i].x, w.y - frames[f][i].y)))) };
};
const headOn = { cast: ['C1', 'R1'], personalSpace: 1, points: [[0, 0], [40, 0]], links: [[0, 1]] };

test('walkers who meet head-on pass on their own right, without jumping or trading places', () => {
  const d = new NpcDirector(library), { frames, jump } = smoothly(headOn, 90);
  assert.ok(d && jump < 0.06, `${jump}`);
  let closest = Infinity, passes = 0;
  for (let f = 1; f < frames.length; f++) {
    const [a, b] = frames[f], [c, e] = frames[f - 1], gap = Math.hypot(a.x - b.x, a.y - b.y);
    closest = Math.min(closest, gap);
    if ((a.x - b.x) * (c.x - e.x) < 0) { passes++; assert.ok(Math.abs(a.y - b.y) > 0.7, `crossed ${Math.abs(a.y - b.y)} apart`); }
  }
  assert.ok(passes > 0); assert.ok(closest > 0.7, `${closest}`);
});

test('a walker eases around a standing body and back', () => {
  const crowd = { ...headOn, cast: ['C1'] }, { jump, frames } = smoothly(crowd, 40, { lookAt: { x: 20, y: 0.3 } });
  assert.ok(jump < 0.06, `${jump}`);
  assert.ok(Math.min(...frames.map(([w]) => Math.hypot(w.x - 20, w.y - 0.3))) > 0.5);
});

test('a crowded village keeps moving instead of jamming', () => {
  for (const [key, place] of [['village', maps.hub], ['market', maps.maps['stop-07']]]) {
    const crowd = maps.crowds[key], d = new NpcDirector(library), frames = 60 * 120; let waiting = 0;
    for (let f = 0; f < frames; f++) { d.update(1 / 60, 'a', place.npcs, { crowd, lookAt: place.spawn }); waiting += d.residents.filter(r => r.waiting).length; }
    assert.ok(waiting / frames / crowd.cast.length < 0.2, `${key} ${waiting / frames / crowd.cast.length}`);
  }
});

test('a resident never leaves the walk clips, whether walking, queueing or stopped by the bell', () => {
  const crowd = maps.crowds.village, d = new NpcDirector(library);
  for (let f = 0; f < 60 * 40; f++) for (const { pose } of d.update(1 / 60, 'a', [], { crowd, lookAt: maps.hub.spawn })) assert.ok(pose.action.endsWith('-walk'), pose.action);
});

test('a resident keeps about the same size in every walking direction', () => {
  for (const id of new Set(maps.crowds.village.cast)) {
    const heights = clips.directions.map(direction => { const clip = library.clip(`${id}-walk`, direction); return clip.bodyHeight * clip.scale; }).sort((a, b) => a - b);
    assert.ok(heights[0] / heights[4] >= 0.91, `${id} ${heights}`);
  }
});

test('someone stuck behind another holds still instead of stuttering', () => {
  const crowd = maps.crowds.village, d = new NpcDirector(library), since = crowd.cast.map(() => -100);
  let was = crowd.cast.map(() => false), shortest = Infinity;
  for (let f = 0; f < 60 * 120; f++) {
    d.update(1 / 60, 'a', [], { crowd, lookAt: maps.hub.spawn });
    d.residents.forEach((r, i) => { if (r.waiting !== was[i] && !r.passing) { if (since[i] >= 0) shortest = Math.min(shortest, f - since[i]); since[i] = f; } was[i] = r.waiting; });
  }
  assert.ok(shortest >= 20, `${shortest} frames`);
});

test('walkers do not sidestep off the floor', () => {
  const crowd = { ...headOn }, lane = [[0, -0.2], [40, -0.2], [40, 0.2], [0, 0.2]], d = new NpcDirector(library);
  for (let f = 0; f < 3000; f++) for (const w of d.update(1 / 60, 'a', [], { crowd, floor: { walkable: [[-1, -1], [41, -1], [41, 1], [-1, 1]], solids: [] } })) assert.ok(Math.abs(w.y) < 1, `${w.y}`);
  assert.ok(lane);
});

test('residents on one street queue up instead of piling together', () => {
  const crowd = { cast: ['C1', 'R1', 'R2', 'R3', 'R4'], personalSpace: 1, points: [[0, 0], [60, 0], [60, 60], [0, 60]], links: [[0, 1], [1, 2], [2, 3], [3, 0]] }, d = new NpcDirector(library);
  let closest = Infinity;
  for (let i = 0; i < 1200; i++) {
    const walkers = d.update(0.05, 'a', [], { crowd });
    if (i < 400) continue;
    for (let a = 0; a < walkers.length; a++) for (let b = a + 1; b < walkers.length; b++) closest = Math.min(closest, Math.hypot(walkers[a].x - walkers[b].x, walkers[a].y - walkers[b].y));
  }
  assert.ok(closest > 0.5, `${closest}`);
});

test('Bolt waits to greet until the player comes near', () => {
  const d = new NpcDirector(library), bolt = { character: 'bolt', x: 5, y: 5, direction: 'south-east', greet: true };
  assert.equal(d.update(5, 'a', [bolt], { lookAt: { x: 30, y: 5 } })[0].pose.action, 'bolt-idle');
  assert.equal(d.update(0.1, 'a', [bolt], { lookAt: { x: 8, y: 5 } })[0].pose.action, 'bolt-greeting');
  assert.equal(d.update(2, 'a', [bolt], { lookAt: { x: 8, y: 5 } })[0].pose.action, 'bolt-idle');
});

test('the market holds its stare for longer than the town', () => {
  const moves = hold => { const d = new NpcDirector(library), crowd = { ...street, bellHold: hold }, [before] = d.update(BELL_EVERY_SECONDS + 3, 'a', [], { crowd }), [after] = d.update(0.1, 'a', [], { crowd }); return after.x !== before.x || after.y !== before.y; };
  assert.equal(moves(5), false); assert.equal(moves(BELL_HOLD_SECONDS), true);
});

test('Bolt greets once on arrival, then idles, and greets again in a new place', () => {
  const d = new NpcDirector(library), bolt = { character: 'bolt', x: 5, y: 5, direction: 'south', greet: true };
  assert.equal(d.update(0.1, 'shop', [bolt])[0].pose.action, 'bolt-greeting');
  assert.equal(d.update(2, 'shop', [bolt])[0].pose.action, 'bolt-idle');
  assert.equal(d.update(0.1, 'shop', [bolt])[0].pose.action, 'bolt-idle');
  assert.equal(d.update(0.1, 'other', [bolt])[0].pose.action, 'bolt-greeting');
});

const background = maps.villages.court.background;
const renderer = g => {
  const calls = [], labels = [];
  const context = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); if (name === 'fillText') labels.push(args[0]); }, set: () => true });
  const r = new CanvasRenderer({ getContext: () => context }, g);
  r.mapImages = new Map([background, maps.villages.market.background].map(file => [file, { fake: file }]));
  r.useNpcSprites(library); r.drawDoll = (x, y, opts) => calls.push(['doll', opts.type]);
  return { r, calls, labels };
};

test('the hub draws the village with Moru, and no code scenery', () => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub';
  const { r, calls, labels } = renderer(g); r.render(1 / 60);
  const drawn = calls.filter(call => call[0] === 'drawImage').map(call => call[1].fake);
  assert.equal(drawn[0], background);
  assert.ok(drawn.includes(library.clip('moru-idle', 'south-east').sheet)); assert.ok(labels.includes('모루'));
  assert.deepEqual(calls.filter(call => call[0] === 'doll').map(call => call[1]), ['player']);
});

test('the shop shows Bolt on the village map instead of the old building and doll', () => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(1); g.s.run.node = 5; g.enterNode();
  const { r, calls, labels } = renderer(g); r.render(1 / 60);
  assert.equal(g.s.mode, 'shop'); assert.ok(!labels.includes('볼트의 부품 상점')); assert.ok(labels.includes('볼트'));
  // Bolt may turn to greet the player walking in, so any of his idle or greeting facings counts.
  const boltSheets = ['bolt-idle', 'bolt-greeting'].flatMap(action => ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'].map(dir => library.clip(action, dir)?.sheet)).filter(Boolean);
  assert.ok(calls.filter(call => call[0] === 'drawImage').some(call => boltSheets.includes(call[1].fake)));
  assert.deepEqual(calls.filter(call => call[0] === 'doll').map(call => call[1]), ['player']);
});

test('without the map image the town waits on a plain frame instead of the old code-drawn street', () => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub';
  const { r, labels } = renderer(g); r.mapImages = new Map(); r.render(1 / 60);
  assert.ok(!labels.includes('작은 수리점'));
});

test('a newcomer hears the bell early, then the town keeps its long gap', () => {
  const d = new NpcDirector(library), play = (seconds, bell) => { for (let i = 0; i < seconds * 10; i++) d.update(0.1, 'a', [], { crowd: street, bell }); };
  d.update(0, 'a', [], { crowd: street });
  const [before] = d.update(0, 'a', [], { crowd: street }), [after] = d.update(0, 'a', [], { crowd: street, bell: 'soon' });
  assert.deepEqual([after.x, after.y], [before.x, before.y]);
  play(FIRST_BELL_SECONDS - 0.5, 'soon'); assert.equal(d.stopped, false);
  play(1, 'soon'); assert.equal(d.stopped, true);
  play(BELL_HOLD_SECONDS * 3, 'hold'); assert.equal(d.stopped, true);
  play(BELL_HOLD_SECONDS + 0.2, null); assert.equal(d.stopped, false);
  play(BELL_EVERY_SECONDS - 1, null); assert.equal(d.stopped, false);
  play(1.2, null); assert.equal(d.stopped, true);
});

test('residents whose north walk shows the face turn their back when walking away from the camera', () => {
  for (const character of FRONT_FACING_NORTH) {
    assert.equal(walkDirection(character, 0.01, -1), 'north-east');
    assert.equal(walkDirection(character, -0.01, -1), 'north-west');
  }
  assert.equal(walkDirection('R1', 0, -1), 'north');
  assert.equal(walkDirection('R3', 1, 0), 'east');
});
