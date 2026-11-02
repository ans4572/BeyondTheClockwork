import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { circleInPolygon, fitsMap, placeOf, pointInPolygon } from '../src/engine/map-geometry.js';
import { CanvasRenderer } from '../src/render/canvas.js';

const json = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const [combat, progression, slice, maps] = await Promise.all(['combat', 'progression', 'slice', 'maps'].map(json));
const data = { combat, progression, slice, maps }, map = placeOf(maps, maps.maps['stop-02']), oldRoom = maps.maps['stop-08'];
const run = (input = data) => { const g = new Game(input); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); return g; };

test('every stage has a short label for the journey strip', () => {
  for (const room of slice.rooms) assert.ok(room.short?.length, room.id);
});

test('every stage up to the night market has a large map, and only the last boss keeps the code arena', () => {
  for (const room of slice.rooms) assert.equal(!!maps.maps[room.id], room.boss !== 'captainBrass', room.id);
  for (const id of ['stop-02', 'stop-03', 'stop-04', 'stop-05', 'stop-06']) {
    const place = placeOf(maps, maps.maps[id]);
    assert.deepEqual(place.size, [38.4, 25.6], id);
    for (const file of [place.background, place.mask]) assert.ok(fs.existsSync(new URL(`..${file}`, import.meta.url)), file);
    assert.ok(fitsMap(place.portal.x, place.portal.y, slice.arena.playerRadius, place), id);
  }
});

test('the collector stands in the middle of the depot, on its floor', () => {
  const g = run(); g.s.run.node = 4; g.enterNode();
  const [roco] = g.s.enemies, { bossSpawn } = placeOf(maps, maps.maps['stop-06']);
  assert.deepEqual([roco.x, roco.y], [bossSpawn.x, bossSpawn.y]); assert.ok(fitsMap(roco.x, roco.y, roco.radius, g.map));
});

test('solid props block bodies inside the floor', () => {
  const g = run(), stall = placeOf(maps, maps.maps['stop-03']);
  g.s.run.node = 1;
  g.p.x = 19.8; g.p.y = 23;
  for (let step = 0; step < 100; step++) g.move(g.p, 0, -0.1);
  assert.ok(fitsMap(g.p.x, g.p.y, slice.arena.playerRadius, stall));
  assert.ok(g.p.y > 20, `stopped at ${g.p.y}`);
});

test('a walk across every combat map stays on its floor', () => {
  for (const [node, room] of slice.rooms.entries()) {
    const area = placeOf(maps, maps.maps[room.id]);
    if (!area?.walkable || room.kind === 'shop') continue;
    const g = run();
    g.s.run.node = node; g.p.x = area.spawn.x; g.p.y = area.spawn.y;
    for (let step = 0; step < 4000; step++) {
      const a = step / 40 | 0;
      g.move(g.p, Math.cos(a * 2.4) * 0.09, Math.sin(a * 2.4) * 0.09);
      assert.ok(fitsMap(g.p.x, g.p.y, slice.arena.playerRadius, area), room.id);
    }
  }
});

test('polygon checks include the body radius', () => {
  const square = [[0, 0], [4, 0], [4, 4], [0, 4]];
  assert.ok(pointInPolygon(2, 2, square) && !pointInPolygon(5, 2, square));
  assert.ok(circleInPolygon(1, 1, 0.5, square) && !circleInPolygon(0.3, 2, 0.5, square));
});

test('map data is validated, and a spawn outside the floor is rejected', () => {
  assert.doesNotThrow(() => validateData(data));
  const broken = structuredClone(data);
  broken.maps.maps['stop-02'].enemySpawns[0] = { x: 1, y: 1 };
  assert.throws(() => validateData(broken), /이동 영역 밖/);
});

test('a room not yet enlarged keeps a background the size of the game canvas', () => {
  const png = fs.readFileSync(new URL(`..${oldRoom.background}`, import.meta.url));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1120, 640]);
});

test('entering the room uses its authored spawns', () => {
  const g = run();
  assert.deepEqual([g.p.x, g.p.y], [map.spawn.x, map.spawn.y]);
  g.s.enemies.forEach((enemy, i) => assert.deepEqual([enemy.x, enemy.y], [map.enemySpawns[i].x, map.enemySpawns[i].y]));
  assert.deepEqual(g.obstacles, []);
});

test('bodies stop at the walkable edge in every direction', () => {
  const g = run(), radius = slice.arena.playerRadius;
  for (let i = 0; i < 16; i++) {
    g.p.x = map.spawn.x; g.p.y = map.spawn.y;
    const a = i * Math.PI / 8;
    for (let step = 0; step < 600; step++) {
      g.move(g.p, Math.cos(a) * 0.1, Math.sin(a) * 0.1);
      assert.ok(circleInPolygon(g.p.x, g.p.y, radius, map.walkable));
    }
  }
});

test('a body saved off the floor can walk back onto it', () => {
  const g = run();
  g.p.x = 1; g.p.y = 1;
  for (let step = 0; step < 200; step++) g.move(g.p, 0.1, 0.1);
  assert.ok(circleInPolygon(g.p.x, g.p.y, slice.arena.playerRadius, map.walkable));
});

test('rooms without a map, and games without map data, keep the rectangular arena', () => {
  const g = run();
  g.s.run.node = 11;
  assert.equal(g.map, null);
  assert.deepEqual(g.bounds, slice.arena.bounds);
  const plain = run({ combat, progression, slice });
  assert.equal(plain.map, null);
  assert.deepEqual([plain.p.x, plain.p.y], [slice.arena.spawn.x, slice.arena.spawn.y]);
});

test('scenery repaints over a body behind it and not over one in front', () => {
  const g = run(), calls = [], map = oldRoom;
  g.s.run.node = 6; g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1;
  const context = new Proxy({}, { get: (_, name) => (...args) => { calls.push(name); return args; }, set: () => true });
  const r = new CanvasRenderer({ getContext: () => context }, g), order = () => { calls.length = 0; r.render(1 / 60); };
  r.mapImages = new Map([[map.background, { fake: true }]]);
  r.drawDoll = () => calls.push('player');
  const occludersAfterPlayer = () => calls.slice(calls.indexOf('player')).filter(name => name === 'clip').length;
  g.p.y = 5; order();
  assert.equal(calls.filter(name => name === 'clip').length, map.occluders.length);
  const behind = occludersAfterPlayer();
  g.p.y = 14.5; order();
  assert.ok(behind > occludersAfterPlayer());
  assert.equal(occludersAfterPlayer(), map.occluders.filter(o => o.baseY > 14.5).length);
});

test('the room still draws in code before its image has loaded', () => {
  const g = run(), calls = [];
  const context = new Proxy({}, { get: (_, name) => () => { calls.push(name); }, set: () => true });
  new CanvasRenderer({ getContext: () => context }, g).render(1 / 60);
  assert.ok(!calls.includes('drawImage') && !calls.includes('clip'));
});
