import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';
import { fitsMap, cameraFor, placeOf, pointInPolygon } from '../src/engine/map-geometry.js';
import { LANE_UNITS } from '../src/animation/npc-director.js';
import { closeSlivers, columnDepths, ghostFor, raiseDepths } from '../src/render/depth-mask.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [combat, progression, slice, maps, dialogue] = await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(name => json(`../src/data/${name}.json`)));
const data = { combat, progression, slice, maps }, radius = maps.villages.court.bodyRadius, streetsOf = place => maps.crowds[place.crowd];
const places = [maps.hub, maps.maps['stop-07']].map(place => placeOf(maps, place));
const atHub = () => { const g = new Game(data); g.s.mode = 'registration'; g.register(); g.s.profile.loadout = ['fire', 'ice']; return g; };
const atShop = () => { const g = atHub(); g.startRun(5); g.s.run.node = 5; g.enterNode(); return g; };
const walkTo = (g, target) => { for (let i = 0; i < 2000 && g.walking && Math.hypot(target.x - g.p.x, target.y - g.p.y) > 0.3; i++) g.update(1 / 60, { x: target.x - g.p.x, y: target.y - g.p.y }); };

test('the town and the night market are different maps, each spawn off its exit', () => {
  assert.equal(new Set(places.map(place => place.background)).size, 2);
  for (const { spawn, exit, ...map } of places) {
    assert.ok(fitsMap(spawn.x, spawn.y, radius, map));
    assert.ok(!pointInPolygon(spawn.x, spawn.y, exit.polygon));
  }
});

/** Width and height from a PNG or WebP header (map backgrounds are WebP, masks PNG). */
const imageSize = file => {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
};
test('each mask matches the declared map size, and each background is drawn at twice that for sharp screens', () => {
  for (const place of places) {
    assert.deepEqual(imageSize(new URL(`..${place.mask}`, import.meta.url)), place.size.map(units => Math.round(units * 40)));
    assert.deepEqual(imageSize(new URL(`..${place.background}`, import.meta.url)), place.size.map(units => Math.round(units * 80)));
  }
  for (const place of places) assert.ok(fs.statSync(new URL(`..${place.mask}`, import.meta.url)).size < 500000, place.mask);
});

test('each place leaves by exactly one exit, on the wide bottom street (reaching up to a portal ring where there is one)', () => {
  for (const { exit, size } of places) assert.ok(exit.polygon.every(([, y]) => y > size[1] - (exit.portal ? 3 : 2)), exit.label);
});

test('overhead regions sit at a depth inside the map', () => {
  for (const place of places) for (const { baseY, polygon } of place.overhead) { assert.ok(baseY > 0 && baseY <= place.size[1]); assert.ok(polygon.length >= 3); }
});

const FOOT_UNITS = 0.3;
test('every stretch of village street stays on the floor', () => {
  for (const place of places) {
    const { points, links } = streetsOf(place);
    for (const [a, b] of links) for (let t = 0; t <= 1; t += 0.1) {
      const x = points[a][0] + (points[b][0] - points[a][0]) * t, y = points[a][1] + (points[b][1] - points[a][1]) * t;
      // Feet stay on the floor at every corner of a resident's lane.
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(fitsMap(x + dx * LANE_UNITS, y + dy * LANE_UNITS, FOOT_UNITS, place), `${place.crowd} ${a}-${b} at ${x},${y}`);
    }
  }
});

test('from every spawn the streets and the exit can be walked to', () => {
  const key = (x, y) => `${x},${y}`, CELLS = 5;
  for (const { spawn, exit, ...map } of places) {
    const seen = new Set(), queue = [[Math.round(spawn.x * CELLS), Math.round(spawn.y * CELLS)]];
    while (queue.length) {
      const [x, y] = queue.pop();
      if (seen.has(key(x, y)) || !fitsMap(x / CELLS, y / CELLS, radius, map)) continue;
      seen.add(key(x, y));
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const reached = ([x, y]) => [Math.floor, Math.ceil].some(a => [Math.floor, Math.ceil].some(b => seen.has(key(a(x * CELLS), b(y * CELLS)))));
    for (const point of streetsOf({ crowd: map.crowd }).points) assert.ok(reached(point), `${point}`);
    assert.ok([...seen].some(cell => { const [x, y] = cell.split(',').map(n => n / CELLS); return pointInPolygon(x, y, exit.polygon); }), exit.label);
  }
});

test('the hub opens on foot, and walking moves the player without combat', () => {
  const g = atHub(), start = { ...g.p };
  assert.deepEqual([g.p.x, g.p.y], [maps.hub.spawn.x, maps.hub.spawn.y]);
  assert.ok(g.walking && !g.active);
  const time = g.s.time;
  for (let i = 0; i < 30; i++) g.update(1 / 60, { x: 0, y: -1, basic: true, skill: 0, fusion: true });
  assert.ok(g.p.y < start.y); assert.ok(g.s.time > time);
  assert.equal(g.p.attack, null); assert.deepEqual(g.s.casts, []);
});

test('a walk across the village stays on its floor', () => {
  const g = atHub(), map = g.village;
  for (let step = 0; step < 6000 && g.walking; step++) {
    const a = (step / 50 | 0) * 2.4;
    g.update(1 / 60, { x: Math.cos(a), y: Math.sin(a) });
    if (g.walking) assert.ok(fitsMap(g.p.x, g.p.y, radius, map), `${g.p.x},${g.p.y}`);
  }
});

test('the fountain blocks the player', () => {
  const g = atHub(), [fountain] = g.village.solids, center = { x: 21, y: 14 };
  assert.ok(pointInPolygon(center.x, center.y, fountain));
  g.p.x = 21; g.p.y = 18;
  for (let i = 0; i < 200; i++) g.update(1 / 60, { x: 0, y: -1 });
  assert.ok(!pointInPolygon(g.p.x, g.p.y, fountain)); assert.ok(g.p.y > 16);
});

test('talking to Moru opens tuning and stops the feet; closing frees them, keeping the spot', () => {
  const g = atHub(), moru = g.village.npcs[0];
  g.p.x = 13; g.p.y = 16.5;
  assert.equal(g.nearbyNpc, null); assert.equal(g.talk(), false); assert.equal(g.s.panel ?? null, null);
  walkTo(g, { x: moru.x + 2, y: moru.y + 0.6 });
  assert.equal(g.nearbyNpc.character, 'moru'); assert.equal(g.talk(), true); assert.equal(g.s.panel, 'tuning');
  const { x, y } = g.p; g.update(1 / 60, { x: 1 }); assert.equal(g.p.x, x);
  g.s.profile.freeGears = 100; assert.ok(g.tune('maxHp', 'buy'));
  assert.deepEqual([g.p.x, g.p.y], [x, y]);
  g.closePanel(); g.update(1 / 60, { x: 1 }); assert.ok(g.p.x > x);
});

test('walking out of the town starts the first battle at once', () => {
  const g = atHub(), { polygon } = g.village.exit;
  g.p.x = 28; g.p.y = 29;
  for (let i = 0; i < 200 && !g.s.run; i++) g.update(1 / 60, { y: 1 });
  assert.ok(pointInPolygon(28, 31.4, polygon)); assert.equal(g.s.mode, 'combat'); assert.equal(g.s.run.node, 0); assert.equal(g.room.id, 'stop-02');
  assert.ok(g.s.enemies.length > 0); assert.ok(!g.walking);
});

test('Bolt sells only through his panel, and leaving the shop reaches the next room', () => {
  const g = atShop(), bolt = g.village.npcs[0];
  assert.equal(g.s.mode, 'shop'); assert.ok(g.walking); assert.equal(g.nearbyNpc, null);
  g.p.x = bolt.x + 2; g.p.y = bolt.y + 1;
  assert.equal(g.nearbyNpc.character, 'bolt'); g.talk(); assert.equal(g.s.panel, 'shop');
  g.closePanel(); assert.ok(bolt);
  g.p.x = 22; g.p.y = 23;
  for (let i = 0; i < 200 && g.s.run.node === 5; i++) g.update(1 / 60, { y: 1 });
  assert.equal(g.s.run.node, 6); assert.equal(g.s.panel, null);
});

test('walking out of a combat room is not a village', () => {
  const g = atHub(); g.startRun(9); g.s.run.node = 1; g.enterNode(); g.s.mode = 'route';
  assert.equal(g.village, null); assert.ok(!g.walking);
});

test('returning from a run puts the player back at the hub spawn', () => {
  const g = atHub(); g.startRun(3); g.returnToHub(); assert.equal(g.s.mode, 'returned'); assert.ok(!g.walking);
  g.acknowledgeReturn(); assert.ok(g.walking); assert.deepEqual([g.p.x, g.p.y], [maps.hub.spawn.x, maps.hub.spawn.y]);
});

test('a save resumes on foot with panels closed, and an old off-map position returns to the spawn', () => {
  const g = atHub(); g.p.x = 1; g.p.y = 1; g.s.panel = 'tuning';
  const loaded = new Game(data, decodeSave(encodeSave(g.s), data));
  assert.equal(loaded.s.panel, null); assert.deepEqual([loaded.p.x, loaded.p.y], [maps.hub.spawn.x, maps.hub.spawn.y]);
});

test('the camera follows the player and stops at the map edges', () => {
  // The view is 22.4 by 12.8 units at the 1.25x camera.
  assert.deepEqual(cameraFor({ x: 21, y: 12 }, [42, 24]), { x: 9.8, y: 5.6 });
  assert.deepEqual(cameraFor({ x: 1, y: 1 }, [42, 24]), { x: 0, y: 0 });
  const edge = cameraFor({ x: 41, y: 23 }, [42, 24]); assert.ok(Math.abs(edge.x - 19.6) < 1e-9 && Math.abs(edge.y - 11.2) < 1e-9);
  assert.deepEqual(cameraFor({ x: 20, y: 3 }), { x: 0, y: 0 });
});

test('scenery depth is the row where each column meets the ground', () => {
  const o = 255, alpha = [0, o, 0,  0, o, 0,  0, 0, 0,  o, o, 0];
  assert.deepEqual([...columnDepths(alpha, 3, 4)], [0, 3, 0,  0, 3, 0,  0, 0, 0,  3, 3, 0]);
  const gap = Array(20).fill(0); gap[2] = gap[19] = 255;
  const depths = columnDepths(gap, 1, 20);
  assert.equal(depths[19], 19); assert.equal(depths[2], 2);
});

test('the player cannot walk through Moru or Bolt', () => {
  const g = atHub(), moru = g.village.npcs[0];
  g.p.x = moru.x + 3; g.p.y = moru.y;
  for (let i = 0; i < 120; i++) g.update(1 / 60, { x: -1 });
  assert.ok(g.p.x >= moru.x + radius + 0.45 - 0.05, `${g.p.x}`);
});

test('overhead regions take the depth of their true ground line', () => {
  const depths = new Uint16Array([5, 0, 5, 5]);
  raiseDepths(depths, 2, 2, 1, [[0, 0], [2, 0], [2, 1], [0, 1]], 9);
  assert.deepEqual([...depths], [9, 0, 5, 5]);
});

test('the player only shows through scenery that hides most of them', () => {
  assert.equal(ghostFor(0.2), 0); assert.ok(Math.abs(ghostFor(0.9) - 0.6) < 1e-9); assert.ok(ghostFor(0.55) > 0 && ghostFor(0.55) < 0.6);
});

test('one shallow column inside an object takes the depth around it', () => {
  const depths = new Uint16Array([0, 90, 90, 12, 90, 90, 0]);
  assert.deepEqual([...closeSlivers(depths, 7, 1, 2)], [0, 90, 90, 90, 90, 90, 0]);
});

test('the tutorial plays in the scrapyard and stays on its floor', () => {
  const g = new Game(data); g.beginIntro(); const yard = g.map;
  assert.equal(yard.background, maps.villages.scrapyard.background);
  assert.deepEqual([g.p.x, g.p.y], [maps.intro.spawn.x, maps.intro.spawn.y]);
  assert.deepEqual([g.s.enemies[0].x, g.s.enemies[0].y], [maps.intro.enemySpawns[0].x, maps.intro.enemySpawns[0].y]);
  assert.deepEqual(g.bounds, { left: 0, right: 28, top: 0, bottom: 16 });
  for (let step = 0; step < 3000; step++) {
    const a = (step / 40 | 0) * 2.4;
    g.move(g.p, Math.cos(a) * 0.09, Math.sin(a) * 0.09);
    assert.ok(fitsMap(g.p.x, g.p.y, yard.bodyRadius, yard), `${g.p.x},${g.p.y}`);
  }
});

test('the scrapyard picture and mask are one screen in size', () => {
  const { background, mask } = maps.villages.scrapyard;
  assert.deepEqual(imageSize(new URL(`..${mask}`, import.meta.url)), [1120, 640]);
  assert.deepEqual(imageSize(new URL(`..${background}`, import.meta.url)), [2240, 1280]);
});

const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60, input); };
const lesson = () => { const g = new Game(data); g.beginIntro({ lesson: true }); return g; };
const toGuard = g => { const { marker } = g.map; g.p.x = marker.x; g.p.y = marker.y; step(g, 0.05); };
const threeHits = g => { const [guard] = g.s.enemies; for (let i = 0; i < 3; i++) g.hitEnemy(guard, 1, { basic: true }); return guard; };

test('the lesson starts empty and the guard only drops once the player has walked to the marker', () => {
  const g = lesson();
  assert.equal(g.tutorial.step, 'walk'); assert.equal(g.s.enemies.length, 0); assert.ok(g.tutorial.goal);
  toGuard(g);
  assert.equal(g.tutorial.step, 'attack'); assert.equal(g.s.enemies.length, 1); assert.equal(g.s.enemies[0].held, true);
  const { x } = g.s.enemies[0]; step(g, 3); assert.equal(g.s.enemies[0].x, x); assert.equal(g.p.hp, g.p.maxHp);
});

test('three wrench hits free the guard, which cannot die before the player has dodged it', () => {
  const g = lesson(); toGuard(g);
  const [guard] = g.s.enemies; g.hitEnemy(guard, 500, { basic: true }); assert.equal(guard.hp, 1); g.hitEnemy(guard, 1); assert.equal(g.tutorial.state.hits, 1);
  threeHits(g); assert.equal(g.tutorial.step, 'dodge'); assert.equal(guard.held, false);
  g.hitEnemy(guard, 500, { basic: true }); assert.equal(guard.hp, 1);
});

test('a dodge only teaches once a red warning is showing', () => {
  const g = lesson(); toGuard(g); const guard = threeHits(g);
  g.p.dodgeReady = 0; g.dodge(); step(g, 0.3); assert.equal(g.tutorial.step, 'dodge');
  guard.tell = { kind: 'melee' }; g.p.dodgeReady = 0; g.p.dodge = null; g.dodge();
  assert.equal(g.tutorial.step, 'fight'); assert.ok(guard.hp >= 30);
});

test('someone who dodged early skips the dodge step', () => {
  const g = lesson(); g.dodge(); g.p.dodge = null; toGuard(g); threeHits(g);
  assert.equal(g.tutorial.step, 'fight');
});

test('a hit during the lesson costs no health and keeps the player where they are', () => {
  const g = lesson(); toGuard(g); threeHits(g); const at = [g.p.x, g.p.y];
  g.p.invulnerableUntil = 0; assert.equal(g.hurt(10000), true);
  assert.equal(g.s.mode, 'intro'); assert.equal(g.tutorial.step, 'dodge'); assert.equal(g.p.hp, g.p.maxHp);
  assert.deepEqual([g.p.x, g.p.y], at);
});

test('beating the guard opens the door, and walking to it registers the player once', () => {
  const g = lesson(); toGuard(g); const guard = threeHits(g); g.tutorial.startFight(guard);
  guard.hp = 0; step(g, 0.05);
  assert.equal(g.tutorial.step, 'door'); assert.equal(g.s.mode, 'intro'); assert.equal(g.s.profile.freeGears, 10); assert.equal(g.s.enemies.length, 0);
  const { spawn, exit: { at } } = maps.intro;
  for (const [x, y] of [[20, 9], [24, 8], at]) for (let i = 0; i < 400 && g.s.mode === 'intro' && Math.hypot(x - g.p.x, y - g.p.y) > 0.3; i++) g.update(1 / 60, { x: x - g.p.x, y: y - g.p.y });
  assert.equal(g.s.mode, 'registration'); assert.equal(g.tutorial.step, 'town'); assert.ok(spawn);
});

test('every dialogue line has a known speaker, fits the box, and every choice leads somewhere', () => {
  const { speakers, scripts } = dialogue;
  for (const [name, lines] of Object.entries(scripts)) for (const { who, text, choices } of lines) {
    assert.ok(speakers[who], `${name} ${who}`); assert.ok(text.length <= 72, text);
    for (const { id } of choices || []) assert.ok(['open', 'leave', 'register', 'elements', 'practice'].includes(id) || scripts[id], id);
  }
  for (const { sheet } of Object.values(speakers)) assert.ok(fs.existsSync(new URL(`..${sheet}`, import.meta.url)), sheet);
  assert.equal(scripts.registration.at(-1).choices[0].id, 'register');
  for (const npc of [...maps.hub.npcs, ...maps.maps['stop-07'].npcs]) assert.ok(scripts[npc.character].at(-1).choices.some(choice => choice.id === 'open'), npc.character);
});

test('the first talk says why the player must fight and why they must leave', () => {
  const told = dialogue.scripts.registration.map(line => line.text).join(' ');
  for (const reason of ['무음공장', '생각을 지우고', '숨을 곳은 없어', '브라스', '안전핀']) assert.ok(told.includes(reason), reason);
});

test('the awakening monologue plays once, after the player has got up', () => {
  const g = new Game(data); g.beginIntro({ wake: true, lesson: true });
  assert.equal(g.tutorial.takeAwakening(), false);
  step(g, 1.7);
  assert.equal(g.tutorial.takeAwakening(), true); assert.equal(g.tutorial.takeAwakening(), false);
  assert.ok(dialogue.scripts.awakening.every(line => line.who === dialogue.player));
  const plain = new Game(data); plain.beginIntro(); assert.equal(plain.tutorial.takeAwakening(), false);
});

test('the first walk through town: the bell stops it, Moru calls, and walking to Moru opens the talk', () => {
  const g = new Game(data); g.s.mode = 'intro'; g.tutorial.start(); g.reachWorkshop();
  const { arrival } = maps.hub, moru = maps.hub.npcs[0];
  assert.deepEqual([g.p.x, g.p.y], [arrival.x, arrival.y]); assert.ok(g.walking);
  assert.equal(g.tutorial.bell, 'soon'); assert.equal(g.tutorial.readyToRegister, false);
  g.p.x = moru.x + 2; g.p.y = moru.y; assert.equal(g.nearbyNpc, null);
  g.p.x = arrival.x; g.p.y = arrival.y;
  g.tutorial.heardBell(); assert.equal(g.tutorial.bell, 'hold');
  assert.equal(g.tutorial.takeCall(), false); step(g, 1);
  assert.equal(g.tutorial.takeCall(), true); assert.equal(g.tutorial.takeCall(), false);
  assert.deepEqual(g.tutorial.goal, arrival.meet); assert.equal(g.tutorial.readyToRegister, false);
  const { x, y } = arrival.meet; g.p.x = 14; g.p.y = 16.9;
  for (let i = 0; i < 900 && g.tutorial.step === 'moru'; i++) g.update(1 / 60, { x: x - g.p.x, y: y - g.p.y });
  assert.equal(g.tutorial.step, 'meet'); assert.equal(g.tutorial.readyToRegister, true);
  const at = [g.p.x, g.p.y]; assert.equal(g.register(), true);
  assert.deepEqual([g.p.x, g.p.y], at); assert.equal(g.tutorial.step, null); assert.ok(g.s.profile.registered); assert.equal(g.s.mode, 'hub');
});

test('nobody leaves town before meeting Moru', () => {
  const g = new Game(data); g.s.mode = 'intro'; g.tutorial.start(); g.reachWorkshop();
  const [x, y] = maps.hub.exit.polygon[0]; g.p.x = x + 1; g.p.y = y + 0.5; g.update(1 / 60, {});
  assert.equal(g.s.mode, 'registration'); assert.equal(g.s.run, null);
});

test('the town bell is explained in the talk that follows it', () => {
  const { firstBell, moruCalls, registration } = dialogue.scripts;
  assert.equal(firstBell[0].text, '왜 모두 멈췄지?'); assert.equal(firstBell[0].who, dialogue.player);
  assert.equal(moruCalls[0].who, 'moru'); assert.ok(moruCalls[0].text.includes('렌치 든 녀석'));
  assert.ok(registration.some(line => line.text.includes('종소리')));
});

test('the bell is only said to ring in the square, and the town is entered from the portal in the top-left alley', () => {
  assert.ok(dialogue.scripts.registration.some(line => line.who === 'moru' && line.text.includes('광장에서만')));
  const g = new Game(data), { arrival } = maps.hub;
  assert.ok(fitsMap(arrival.x, arrival.y, g.hubMap.bodyRadius, g.hubMap)); assert.ok(arrival.x < 10 && arrival.y < 5);
  // The alley has to lead somewhere: walk the floor from the portal to Moru.
  const unit = 0.25, moru = maps.hub.npcs[0], start = [Math.round(arrival.x / unit), Math.round(arrival.y / unit)], seen = new Set([start.join()]), queue = [start];
  let met = false;
  while (queue.length && !met) {
    const [x, y] = queue.shift(); met = Math.hypot(x * unit - moru.x, y * unit - moru.y) <= 3;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, y + dy];
      if (!seen.has(next.join()) && fitsMap(next[0] * unit, next[1] * unit, g.hubMap.bodyRadius, g.hubMap)) { seen.add(next.join()); queue.push(next); }
    }
  }
  assert.ok(met);
});

test('a cleared room holds for a second, then rewards, then opens a portal to walk through', () => {
  const g = atHub(); g.startRun(9); g.s.run.wave = g.room.waves.length - 1;
  for (const e of g.s.enemies) e.hp = 0;
  step(g, 0.9); assert.equal(g.s.mode, 'combat');
  step(g, 0.2); assert.equal(g.s.mode, 'reward');
  assert.equal(g.chooseReward(0), true); assert.equal(g.s.mode, 'route'); assert.ok(g.leaving); assert.equal(g.s.run.node, 0);
  const { portal } = g; g.p.x = portal.x; g.p.y = portal.y; step(g, 0.2);
  assert.equal(g.s.run.node, 0, 'someone already standing there is not taken');
  g.p.x = portal.x + 2; step(g, 0.1); g.p.x = portal.x; step(g, 0.1);
  assert.equal(g.s.run.node, 1); assert.equal(g.s.mode, 'combat');
});

test('every room has a portal the player can reach from its entrance', () => {
  for (const [id, place] of Object.entries(maps.maps)) {
    if (id === 'stop-07') continue;
    const map = placeOf(maps, place);
    const radius = data.slice.arena.playerRadius, unit = 0.25, key = (x, y) => `${x},${y}`, start = [Math.round(map.spawn.x / unit), Math.round(map.spawn.y / unit)], seen = new Set([key(...start)]), queue = [start];
    let reached = false;
    while (queue.length && !reached) {
      const [x, y] = queue.shift(); reached = Math.hypot(x * unit - map.portal.x, y * unit - map.portal.y) <= 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!seen.has(key(x + dx, y + dy)) && fitsMap((x + dx) * unit, (y + dy) * unit, radius, map)) { seen.add(key(x + dx, y + dy)); queue.push([x + dx, y + dy]); }
    }
    assert.ok(reached, id);
  }
});

test('the first trip leaves with the wrench alone; elements are bought one at a time and two owned ones go into the run', () => {
  const fresh = new Game(data); fresh.s.mode = 'registration'; fresh.register();
  const { polygon } = fresh.village.exit, walkOut = game => { game.p.x = (polygon[0][0] + polygon[1][0]) / 2; game.p.y = (polygon[0][1] + polygon[2][1]) / 2; game.update(1 / 60, {}); };
  assert.equal(fresh.enterPractice(), false); assert.equal(fresh.nextElementPrice, null); assert.equal(fresh.buyElement('fire'), false);
  walkOut(fresh); assert.equal(fresh.s.mode, 'combat'); assert.equal(fresh.slots.length, 0);
  const g = new Game(data); g.s.mode = 'registration'; g.register(); g.s.profile.history = [{ reason: 'defeat' }];
  const inside = () => { g.p.x = (polygon[0][0] + polygon[1][0]) / 2; g.p.y = (polygon[0][1] + polygon[2][1]) / 2; };
  assert.equal(g.toggleElement('fire'), false, 'an element not yet bought cannot be equipped');
  assert.equal(g.nextElementPrice, 0); assert.equal(g.buyElement('fire'), true); assert.equal(g.s.profile.freeGears, 0);
  assert.equal(g.nextElementPrice, 50); assert.equal(g.buyElement('ice'), false, 'not enough gears');
  g.s.profile.freeGears = 1000; for (const id of ['ice', 'wind']) assert.equal(g.buyElement(id), true);
  assert.equal(g.s.profile.freeGears, 1000 - 50 - 50); assert.deepEqual(g.s.profile.ownedElements, ['fire', 'ice', 'wind']);
  g.s.profile.loadout = [];
  for (const id of ['fire', 'ice', 'wind']) g.toggleElement(id);
  assert.deepEqual(g.s.profile.loadout, ['ice', 'wind']);
  g.toggleElement('ice'); assert.deepEqual(g.s.profile.loadout, ['wind']); g.toggleElement('fire');
  inside(); g.update(1 / 60, {}); assert.equal(g.s.mode, 'combat');
  assert.deepEqual(g.slots.map(slot => [slot.element, slot.level]), [['wind', 1], ['fire', 1]]); assert.ok(g.fusion);
  assert.ok(g.s.run.rewardChoices.length === 0); for (const e of g.s.enemies) e.hp = 0; g.finishCombat();
  assert.ok(g.s.run.rewardChoices.every(reward => reward.kind !== 'element' || !g.slots.some(slot => slot.element === reward.id)));
});

test('the back yard gives a dummy that never falls, and cooldowns only clear while the toggle is on', () => {
  const g = atHub(), yard = maps.practice;
  assert.equal(g.enterPractice(), true); assert.equal(g.s.mode, 'practice'); assert.ok(g.active); assert.equal(g.slots.length, 2);
  const [dummy] = g.s.enemies, skill = g.skillSlots[0].skill;
  g.hitEnemy(dummy, 1e6); assert.equal(dummy.hp, dummy.maxHp);
  step(g, 2); assert.deepEqual([dummy.x, dummy.y], [yard.dummy.x, yard.dummy.y]); assert.equal(g.p.hp, g.p.maxHp);
  assert.equal(g.p.energy, data.combat.player.maxEnergy);
  assert.equal(g.castSkill(0, dummy), true); step(g, 0.05);
  assert.ok(g.p.cooldowns[skill.id] > g.s.time, 'cooldown keeps running by default'); assert.equal(g.castSkill(0, dummy), false);
  assert.equal(g.togglePracticeReset(), true); step(g, 0.05); assert.equal(g.castSkill(0, dummy), true);
  assert.equal(g.togglePracticeReset(), false); g.s.casts = []; step(g, 0.05); g.castSkill(0, dummy); step(g, 0.05); assert.equal(g.castSkill(0, dummy), false);
  const before = g.s.profile.freeGears;
  g.p.x = yard.exit.at[0]; g.p.y = yard.exit.at[1]; g.s.casts = []; step(g, 0.05);
  assert.equal(g.s.mode, 'hub'); assert.equal(g.s.practice, null); assert.equal(g.s.enemies.length, 0); assert.equal(g.s.profile.freeGears, before); assert.ok(g.walking);
});

test('waves arrive on the floor of every room, away from the player', () => {
  const g = atHub(); g.startRun(3);
  for (const [node, room] of data.slice.rooms.entries()) {
    if (!room.waves) continue;
    g.s.run.node = node; g.enterNode();
    for (let i = 0; i < 40; i++) {
      const spot = g.arrivalSpot();
      assert.ok(fitsMap(spot.x, spot.y, 0.6, g.map), room.id); assert.ok(Math.hypot(spot.x - g.p.x, spot.y - g.p.y) >= data.slice.rules.waveMinUnits - 1e-9, room.id);
    }
  }
});

test('an enemy pressed against a cart works its way around it', () => {
  const g = atHub(); g.startRun(3); g.s.run.node = 1; g.enterNode(); g.s.run.wave = 2; g.s.run.arrivals = [];
  const [cart] = g.map.solids, xs = cart.map(([x]) => x), ys = cart.map(([, y]) => y), mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  g.s.enemies = []; g.p.x = mid.x + 2; g.p.y = mid.y + 4.5;
  const guard = g.spawnEnemy('guard', { x: mid.x - 1.5, y: mid.y - 4 }); guard.ready = 1e9;
  for (let i = 0; i < 1200 && Math.hypot(guard.x - g.p.x, guard.y - g.p.y) > 1.5; i++) { g.p.hp = g.p.maxHp; g.update(1 / 60, {}); }
  assert.ok(Math.hypot(guard.x - g.p.x, guard.y - g.p.y) <= 1.5, `stopped at ${guard.x},${guard.y}`);
});
