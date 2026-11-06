import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { circleInPolygon, fitsMap, placeOf, pointInPolygon, roomPlace } from '../src/engine/map-geometry.js';
import { CanvasRenderer } from '../src/render/canvas.js';
import { FlowField } from '../src/engine/flow-field.js';
import { SOLID, hazardBox, keepPassable } from '../src/engine/hazards.js';

const json = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const [combat, progression, slice, maps] = await Promise.all(['combat', 'progression', 'slice', 'maps'].map(json));
const data = { combat, progression, slice, maps }, map = placeOf(maps, maps.maps['stop-02']);
const run = (input = data) => { const g = new Game(input); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); return g; };

test('every stage has a short label for the journey strip', () => {
  for (const room of slice.rooms) assert.ok(room.short?.length, room.id);
});

test('every stage has a large map with its art on disk', () => {
  for (const room of slice.rooms) assert.ok(maps.maps[room.id], room.id);
  for (const id of slice.rooms.map(room => room.id).filter(id => id !== 'stop-07')) {
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
  // The flower planter in the middle of the first square stops a body walking up into it.
  const g = run(), square = placeOf(maps, maps.maps['stop-02']);
  g.s.run.node = 0;
  g.p.x = 19.2; g.p.y = 17;
  for (let step = 0; step < 100; step++) g.move(g.p, 0, -0.1);
  assert.ok(fitsMap(g.p.x, g.p.y, slice.arena.playerRadius, square));
  assert.ok(g.p.y > 14.4, `stopped at ${g.p.y}`);
});

test('a walk across every combat map stays on its floor, both pictures of a room with two', () => {
  for (const [node, room] of slice.rooms.entries()) for (let variant = 0; variant < (room.variants?.length || 1); variant++) {
    const g = run();
    g.s.run.node = node; g.s.run.plan[node].variant = variant;
    const area = g.map;
    if (!area?.walkable || room.kind === 'shop') continue;
    assert.equal(area, roomPlace(maps, room.id, variant), `${room.id} ${variant}`);
    g.p.x = area.spawn.x; g.p.y = area.spawn.y;
    for (let step = 0; step < 4000; step++) {
      const a = step / 40 | 0;
      g.move(g.p, Math.cos(a * 2.4) * 0.09, Math.sin(a * 2.4) * 0.09);
      assert.ok(fitsMap(g.p.x, g.p.y, slice.arena.playerRadius, area), `${room.id} ${variant}`);
    }
  }
});

test('on both pictures of every fight room the first wave stands on open floor, clear of furniture, and can be walked to', () => {
  for (const [node, room] of slice.rooms.entries()) {
    if (!room.waves) continue;
    for (let variant = 0; variant < (room.variants?.length || 1); variant++) for (const seed of [3, 101]) {
      const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(seed);
      g.s.run.node = node; g.s.run.plan[node].variant = variant; g.enterNode();
      const area = g.map, flow = new FlowField(area, area.size), label = `${room.id} ${variant ? 'B' : 'A'} seed ${seed}`;
      flow.setBlocks(g.obstacles); flow.update(area.spawn.x, area.spawn.y);
      const reach = p => { const cell = flow.nearestOpen(...flow.cell(p.x, p.y)); return cell && flow.steps[cell[1] * flow.cols + cell[0]] >= 0; };
      assert.ok(reach(area.portal), `${label}: portal walled off`);
      for (const e of g.s.enemies) {
        assert.ok(fitsMap(e.x, e.y, 0.3, area) && !g.inSolid(e.x, e.y, 0.3), `${label}: ${e.type} at ${e.x.toFixed(1)},${e.y.toFixed(1)} off the floor`);
        assert.ok(reach(e), `${label}: ${e.type} at ${e.x.toFixed(1)},${e.y.toFixed(1)} cannot be reached`);
      }
    }
  }
});

test('a crate or fence that would cut a narrow floor in two is taken out again', () => {
  // A corridor two units deep: a fence pair across it closes the way from the start to the portal.
  const corridor = { walkable: [[0, 4], [20, 4], [20, 6.4], [0, 6.4]], size: [20, 10], spawn: { x: 1, y: 5.2 }, portal: { x: 19, y: 5.2 }, enemySpawns: [{ x: 15, y: 5.2 }] };
  const across = [{ id: 'f1', kind: 'fence', x: 10, y: 5.2, w: 0.6, h: 3 }, { id: 'p1', kind: 'plate', x: 5, y: 5.2, half: 1, depth: 0.5 }];
  const kept = keepPassable(corridor, across);
  assert.deepEqual(kept.map(h => h.id), ['p1'], 'the blocking fence goes, the flat plate stays');
  const aside = [{ id: 'c1', kind: 'crate', x: 10, y: 4.3, size: 0.5 }];
  assert.deepEqual(keepPassable(corridor, aside).map(h => h.id), ['c1'], 'a crate that leaves room to pass stays');
  assert.ok(SOLID.has('crate') && hazardBox(aside[0]).w === 0.5);
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

test('entering the room spreads the first wave over reachable floor, away from the player and waiting', () => {
  const g = run(), { spreadMinUnits } = data.slice.rules, flow = g.flowField, spawn = map.spawn;
  // The player walks in from the map edge to the spawn point; the wave is placed around that point.
  assert.ok(!g.s.entry || (g.s.entry.x === spawn.x && g.s.entry.y === spawn.y));
  flow.update(spawn.x, spawn.y);
  for (const enemy of g.s.enemies) {
    assert.ok(flow.reachable(enemy.x, enemy.y)); assert.ok(Math.hypot(enemy.x - spawn.x, enemy.y - spawn.y) >= spreadMinUnits); assert.equal(enemy.aggro, false);
  }
  // The old square layouts no longer apply on a painted map: only the run's own crates, fences and music boxes stand in the way.
  assert.equal(g.obstacles.length, g.s.hazards.filter(h => ['crate', 'fence', 'musicbox'].includes(h.kind)).length);
});

test('a waiting body notes when it notices the player, for the warning mark over its head', () => {
  const g = run(), enemy = g.s.enemies[0];
  assert.equal(enemy.noticedAt, undefined);
  g.s.time = 5; g.rouse(enemy);
  assert.equal(enemy.aggro, true); assert.equal(enemy.noticedAt, 5);
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

test('games without map data keep the rectangular arena', () => {
  const plain = run({ combat, progression, slice });
  assert.deepEqual(plain.bounds, slice.arena.bounds);
  assert.equal(plain.map, null);
  assert.deepEqual([plain.p.x, plain.p.y], [slice.arena.spawn.x, slice.arena.spawn.y]);
});

test('scenery repaints over a body behind it and not over one in front', () => {
  const stage = placeOf(maps, maps.maps['stop-02']), map = { ...stage, occluders: [{ id: 'a', baseY: 9, polygon: [[10, 6], [12, 6], [12, 9]] }, { id: 'b', baseY: 15, polygon: [[10, 13], [12, 13], [12, 15]] }] };
  const input = { ...data, maps: { ...maps, maps: { ...maps.maps, 'stop-02': map } } }, g = run(input), calls = [];
  g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1;
  const context = new Proxy({}, { get: (_, name) => (...args) => { calls.push(name); return args; }, set: () => true });
  const r = new CanvasRenderer({ getContext: () => context }, g), order = () => { calls.length = 0; r.render(1 / 60); };
  r.mapImages = new Map([[map.background, { fake: true }]]);
  r.drawDoll = () => calls.push('player');
  const occludersAfterPlayer = () => calls.slice(calls.indexOf('player')).filter(name => name === 'clip').length;
  g.p.y = 5; order();
  // One clip keeps the danger floors on the walkable floor; the rest are the occluders.
  assert.equal(calls.filter(name => name === 'clip').length, map.occluders.length + 1);
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
