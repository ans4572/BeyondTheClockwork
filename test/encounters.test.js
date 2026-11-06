import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, distance } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { dealRun, formationSpots, dealer, CALL_AT } from '../src/engine/encounters.js';

const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))]))));
const { rooms, enemies } = data.slice;
const hp = type => enemies[type].hp;
const weight = wave => wave.reduce((sum, type) => sum + hp(type), 0);

test('each run deals new waves for every fight, near the designed weight, with the same elites', () => {
  for (const seed of [1, 7, 4711, 90210]) {
    const dealt = dealRun(rooms, enemies, seed);
    rooms.forEach((room, i) => {
      if (!room.waves) return assert.equal(dealt[i], null);
      const { waves, formations, themes, shape, callAt } = dealt[i];
      assert.equal(formations.length, waves.length); assert.equal(themes.length, waves.length);
      assert.equal(callAt, CALL_AT[shape]);
      const elites = room.waves.flat().filter(t => t === 'elite').length;
      if (shape === 'elite') {
        assert.equal(waves.length, 1); assert.ok(waves[0].every(t => t === 'elite') && waves[0].length >= 4 && waves[0].length <= 6, room.id);
        return;
      }
      const total = waves.flat().length; assert.ok(total >= 15 && total <= 26, `${room.id} has ${total}`);
      assert.equal(waves.flat().filter(t => t === 'elite').length, elites, `${room.id} elites`);
      // Two waves are the design cut in half; three keep the design's own waves.
      const designs = shape === 'two' ? (all => [all.slice(0, Math.ceil(all.length / 2)), all.slice(Math.ceil(all.length / 2))])(room.waves.flat()) : room.waves;
      assert.equal(waves.length, designs.length, room.id);
      waves.forEach((wave, w) => {
        const designed = designs[w];
        const drift = (weight(wave) / wave.length) / (weight(designed) / designed.length);
        assert.ok(drift > 0.6 && drift < 1.5, `${room.id} wave ${w} weighs ${drift.toFixed(2)} of the design per body`);
        assert.ok(wave.filter(t => t === 'drummer').length <= (wave.length >= 10 ? 2 : 1));
        for (const type of wave) assert.ok(enemies[type], type);
      });
    });
  }
});

test('fights come in two waves mostly, sometimes three, and from the elite rooms on sometimes elites alone', () => {
  const counts = { two: 0, three: 0, elite: 0 }, fights = rooms.map((room, i) => room.waves ? i : -1).filter(i => i >= 0);
  for (let seed = 1; seed <= 200; seed++) {
    const dealt = dealRun(rooms, enemies, seed);
    fights.forEach((i, n) => {
      const { shape, waves } = dealt[i]; counts[shape]++;
      if (n < 3) { assert.equal(shape, 'two'); assert.ok(waves.flat().length <= 18, `${rooms[i].id} starts small`); }
      if (shape === 'elite') assert.ok(rooms[i].waves.flat().includes('elite'), `${rooms[i].id} has no elites to fill a room`);
      if (shape === 'two') assert.ok(waves.every(w => w.length >= 7), `${rooms[i].id} two waves of ${waves.map(w => w.length)}`);
    });
  }
  assert.ok(counts.two > counts.three && counts.three > 0 && counts.elite > 0, JSON.stringify(counts));
});

test('the same seed deals the same fights, and different seeds deal different ones', () => {
  assert.deepEqual(dealRun(rooms, enemies, 42), dealRun(rooms, enemies, 42));
  const a = JSON.stringify(dealRun(rooms, enemies, 42).map(d => d?.waves)), b = JSON.stringify(dealRun(rooms, enemies, 43).map(d => d?.waves));
  assert.notEqual(a, b);
});

test('a run plays the waves it dealt, and they survive a save', () => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711);
  const planned = g.s.run.plan[0].waves;
  assert.ok(planned); assert.deepEqual(g.room.waves, planned);
  assert.equal(g.s.enemies.length, planned[0].length);
  assert.deepEqual(g.s.enemies.map(e => e.type).sort(), [...planned[0]].sort());
  const copy = JSON.parse(JSON.stringify(g.s.run.plan));
  assert.deepEqual(copy[0].waves, planned);
});

test('a run saved before dealing keeps the designed waves', () => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(5);
  for (const plan of g.s.run.plan) { delete plan.waves; delete plan.formations; delete plan.themes; }
  assert.deepEqual(g.room.waves, rooms[0].waves);
});

test('every formation puts each body on open floor away from the player', () => {
  const size = [30, 20], player = { x: 15, y: 10 }, random = dealer(3);
  const fits = (x, y) => x > 1 && x < 29 && y > 1 && y < 19 && Math.hypot(x - player.x, y - player.y) >= 4;
  const spread = () => { for (;;) { const s = { x: 1 + random() * 28, y: 1 + random() * 18 }; if (fits(s.x, s.y)) return s; } };
  const types = ['guard', 'guard', 'trumpet', 'rat', 'rat', 'musicbox', 'pikeman'];
  for (const kind of ['spread', 'camps', 'flank', 'pincer', 'ring']) {
    const spots = formationSpots(kind, types, { fits, player, size, random, spread });
    assert.equal(spots.length, types.length, kind);
    for (const spot of spots) assert.ok(fits(spot.x, spot.y) && distance(spot, player) >= 4, `${kind} ${JSON.stringify(spot)}`);
  }
});

const affixRules = data.slice.eliteAffixes;
const fight = seed => { const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(seed); return g; };

test('elites carry traits only after the rest stop, and never more than one', () => {
  const ids = rooms.map(r => r.id), one = ids.indexOf(affixRules.oneFrom);
  for (const seed of [3, 11, 101]) {
    dealRun(rooms, enemies, seed, affixRules).forEach((dealt, i) => {
      if (!dealt) return;
      const want = i >= one ? 1 : 0;
      dealt.waves.forEach((wave, w) => wave.forEach((type, b) => {
        const traits = dealt.affixes?.[w]?.[b];
        if (type !== 'elite' || !want) return assert.ok(!traits, `${rooms[i].id} ${type}`);
        assert.equal(traits.length, want); assert.equal(new Set(traits.map(t => t.id)).size, want);
        for (const t of traits) assert.ok(affixRules.list.some(r => r.id === t.id));
      }));
    });
  }
});

test('each trait does what its tag says', () => {
  const g = fight(9); g.s.enemies = [];
  const at = { x: g.p.x + 3, y: g.p.y };
  const base = g.spawnWaveEnemy('elite', { ...at });
  const fast = g.spawnWaveEnemy('elite', { ...at }, [{ id: 'overwound' }]);
  assert.ok(fast.speed > base.speed && fast.recovery < base.recovery);
  const coated = g.spawnWaveEnemy('elite', { ...at }, [{ id: 'coated', element: 'ice' }]);
  g.applyStatus(coated, 'ice', { id: 'c1', chillBonus: 0 }); assert.ok(!(coated.statuses.chill > g.s.time));
  g.applyStatus(coated, 'fire', { id: 'c2' }); assert.ok(coated.statuses.burn > g.s.time);
  const split = g.spawnWaveEnemy('elite', { ...at }, [{ id: 'splitter' }]), before = g.s.enemies.length, coins = g.s.run.coins;
  g.hitEnemy(split, 1e6, { dot: true });
  assert.equal(g.s.enemies.length, before + 2); assert.ok(g.s.enemies.slice(-2).every(e => e.type === 'rat'));
  assert.ok(g.s.run.coins >= coins + affixRules.bonusCoins);
  const bomb = g.spawnWaveEnemy('elite', { ...at }, [{ id: 'volatile' }]), near = g.spawnWaveEnemy('guard', { x: at.x + 0.5, y: at.y });
  const guardHp = near.hp; g.hitEnemy(bomb, 1e6, { dot: true });
  assert.equal(g.s.blasts.length, 1); assert.equal(near.hp, guardHp);
  // The blast takes a flat 15 off F2 standing in it and leaves every mob untouched.
  g.p.x = at.x + 0.5; g.p.y = at.y; g.p.dodge = null; g.p.invulnerable = 0; g.p.hp = g.p.maxHp ?? g.p.hp; const hp = g.p.hp;
  g.s.time += affixRules.list.find(a => a.id === 'volatile').delay + 0.01; g.tickBlasts();
  assert.equal(g.s.blasts.length, 0); assert.equal(near.hp, guardHp); assert.equal(hp - g.p.hp, 15);
});

test('a brass shield blocks the front until it has taken enough blows', () => {
  const g = fight(9); g.s.enemies = [];
  const shield = g.spawnWaveEnemy('elite', { x: g.p.x + 2, y: g.p.y }, [{ id: 'brassShield' }]);
  shield.facing = Math.PI; shield.state = 'approach';
  const rule = affixRules.list.find(a => a.id === 'brassShield');
  assert.ok(g.shieldHolds(shield));
  for (let i = 0; i < rule.breakHits; i++) g.hitEnemy(shield, 1);
  assert.equal(shield.frontGuard, 0); assert.ok(!g.shieldHolds(shield));
});

const maps = JSON.parse(await readFile(new URL('../src/data/maps.json', import.meta.url), 'utf8'));
const { dealHazards, hazardBox, plateState, sawAt } = await import('../src/engine/hazards.js');
const { placeOf, fitsMap } = await import('../src/engine/map-geometry.js');

test('the first three fight rooms ease the furniture in: a crate and a plate, then a few more, then the full set', () => {
  const rules = data.slice.hazards, room = rooms.find(r => r.waves), map = placeOf(maps, maps.maps[room.id]);
  const total = step => [1, 2, 3, 4, 5, 6, 7, 8].reduce((sum, seed) => sum + dealHazards(map, rules, seed, step).length, 0);
  for (let seed = 1; seed <= 8; seed++) { const first = dealHazards(map, rules, seed, 0); assert.ok(first.length <= 2 && first.every(h => ['crate', 'plate'].includes(h.kind))); }
  for (const step of [0, 1]) assert.ok(!dealHazards(map, rules, 5, step).some(h => h.kind === 'rail'));
  assert.ok(total(0) < total(1) && total(1) < total(2) && total(2) <= total(3), [0, 1, 2, 3].map(total).join(' '));
});

test('every fight room gets its own hazards each run, on open floor and clear of the door and the portal', () => {
  const rules = data.slice.hazards;
  for (const room of rooms.filter(r => r.waves)) {
    const map = placeOf(maps, maps.maps[room.id]);
    const a = dealHazards(map, rules, 11), b = dealHazards(map, rules, 12);
    assert.deepEqual(a, dealHazards(map, rules, 11));
    assert.notDeepEqual(a, b, room.id);
    for (const h of a) {
      assert.ok(fitsMap(h.x, h.y, 0.3, map), `${room.id} ${h.kind}`);
      for (const door of [map.spawn, map.portal]) assert.ok(Math.hypot(h.x - door.x, h.y - door.y) >= rules.doorClear - 1e-6, `${room.id} ${h.kind} by the door`);
    }
    assert.ok(!a.some(h => h.kind === 'spring'));
    const rails = a.filter(h => h.kind === 'rail');
    assert.ok(rails.length === 0 || rails.length >= 2, `${room.id} has ${rails.length} rails`);
    for (const r of rails) {
      assert.ok(Math.abs(r.dx) < 1e-6 || Math.abs(r.dy) < 1e-6 || Math.abs(Math.abs(r.dy / r.dx) - 0.5) < 0.02, `${room.id} rail runs across, up or along a floor diagonal`);
      assert.ok((map.railSlots || []).some(([x, y]) => x === r.x && y === r.y), `${room.id} rail sits on a rail slot`);
    }
    const fences = a.filter(h => h.kind === 'fence');
    assert.equal(fences.length % 2, 0, `${room.id} fences come in pairs`);
    for (let i = 0; i < fences.length; i += 2) {
      const [f, g2] = [fences[i], fences[i + 1]];
      assert.ok(Math.hypot(f.x - g2.x, f.y - g2.y) < 2.4, `${room.id} pair side by side`);
      assert.ok(Math.abs(f.x - g2.x) < 1e-6 || Math.abs(f.y - g2.y) < 1e-6, `${room.id} pair in a straight line`);
    }
  }
});

test('plates heat on a cycle, saws run end to end, and solid pieces have a box', () => {
  const rules = data.slice.hazards;
  const plate = { offset: 0 }, states = [0, 2.6, 3.6, 4.0].map(t => plateState(plate, t, rules.plate));
  assert.deepEqual(states, ['cool', 'warn', 'hot', 'hot']);
  const rail = { x: 10, y: 10, dx: 3, dy: 0, offset: 0 }, len = 6;
  assert.ok(Math.abs(sawAt(rail, 0, rules.rail.speed).x - 7) < 1e-6);
  assert.ok(Math.abs(sawAt(rail, len / rules.rail.speed, rules.rail.speed).x - 13) < 1e-6);
  assert.deepEqual(hazardBox({ x: 5, y: 5, size: 1 }), { x: 4.5, y: 4.5, w: 1, h: 1 });
});

const mapData = { ...data, maps };
const roomFight = seed => { const g = new Game(mapData); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(seed); for (let i = 0; i < 300 && g.s.entry; i++) g.update(1 / 60, {}); return g; };

test('a crate struck by the wrench blows up a moment later and hurts what stands near it', () => {
  const g = roomFight(21); g.s.enemies = [];
  const crate = { id: 'c', kind: 'crate', x: g.p.x + 1.2, y: g.p.y, size: 0.9 };
  g.s.hazards = [crate];
  const guard = g.spawnWaveEnemy('guard', { x: crate.x + 1, y: crate.y }), hp = guard.hp;
  g.strikeHazards(0, 2, 120);
  assert.ok(crate.fuseAt > g.s.time);
  g.s.time = crate.fuseAt + 0.01; g.tickHazards();
  assert.ok(guard.hp < hp); assert.equal(g.s.hazards.length, 0);
});

test('a music box mends once', () => {
  const g = roomFight(21); g.s.enemies = [];
  g.s.hazards = [{ id: 'm', kind: 'musicbox', x: g.p.x - 1.2, y: g.p.y, size: 0.8 }];
  g.p.hp = 10;
  g.strikeHazards(Math.PI, 2, 120); const healed = g.p.hp;
  assert.ok(healed > 10); g.strikeHazards(Math.PI, 2, 120); assert.equal(g.p.hp, healed);
});

test('a fence stops enemy shots and breaks after enough of them', () => {
  const g = roomFight(21); g.s.enemies = [];
  const fence = { id: 'f', kind: 'fence', x: g.p.x + 2, y: g.p.y, w: 0.45, h: 1.9, hp: 2 };
  g.s.hazards = [fence];
  for (let i = 0; i < 2; i++) {
    g.s.projectiles = [{ x: g.p.x + 4, y: g.p.y, angle: Math.PI, speed: 8, radius: 0.15, damage: 5, until: g.s.time + 3 }];
    const hp = g.p.hp; for (let k = 0; k < 30; k++) g.updateProjectiles(1 / 60);
    assert.equal(g.p.hp, hp);
  }
  assert.equal(g.s.hazards.find(h => h.id === 'f')?.gone ?? true, true);
});

test('elements act on hazards: fire sets off a crate, ice cools a plate, lightning charges a rail, wind shoves into a crate', () => {
  const g = roomFight(21); g.s.enemies = [];
  const crate = { id: 'c1', kind: 'crate', x: g.p.x + 2, y: g.p.y, size: 0.9 };
  const plate = { id: 'p1', kind: 'plate', x: g.p.x - 3, y: g.p.y, half: 1.4, depth: 0.82, offset: 0 };
  const rail = { id: 'r1', kind: 'rail', x: g.p.x, y: g.p.y + 3, dx: 2.5, dy: 0, offset: 0 };
  g.s.hazards = [crate, plate, rail];
  g.elementOnHazards({ elements: ['fire'] }, h => h === crate); assert.ok(crate.fuseAt - g.s.time < 0.1);
  g.elementOnHazards({ elements: ['ice'] }, h => h === plate); assert.ok(plate.cooledUntil > g.s.time);
  // A frozen plate does not burn even in its hot phase.
  const guard = g.spawnWaveEnemy('guard', { x: plate.x, y: plate.y }); g.s.time = plate.cooledUntil - 0.6; plate.offset = 5 - (g.s.time % 5) - 0.1; g.tickHazards();
  assert.ok(!(guard.statuses.burn > g.s.time));
  const shocked = g.spawnWaveEnemy('guard', { x: rail.x + 1, y: rail.y }), hp = shocked.hp;
  g.elementOnHazards({ elements: ['lightning'] }, h => h === rail); assert.ok(rail.chargedUntil > g.s.time);
  g.tickHazards(); assert.ok(shocked.hp < hp);
  const crate2 = { id: 'c2', kind: 'crate', x: g.p.x + 6, y: g.p.y + 6, size: 0.9 }; g.s.hazards.push(crate2);
  const pushed = g.spawnWaveEnemy('guard', { x: crate2.x + 0.8, y: crate2.y });
  g.castHit({ elements: ['wind'], slot: {}, staggerUsed: {}, statusAt: {}, id: 'w', color: '#fff', damage: 1 }, pushed);
  assert.ok(crate2.fuseAt !== undefined);
});

test('the room keeps its hazards through the reward and the walk to the portal, and the saw spares enemies', () => {
  const g = roomFight(21);
  const before = g.s.hazards.length; assert.ok(before > 0);
  g.s.enemies = []; g.s.run.wave = g.room.waves.length - 1; g.s.run.arrivals = [];
  g.finishCombat();
  assert.equal(g.s.hazards.length, before); assert.ok(g.roomHazards.length === before, g.s.mode);
  assert.ok(g.obstacles.length > 0);
  g.chooseReward(0);
  assert.equal(g.roomHazards.length, before, `still there in ${g.s.mode}`);
  const h = roomFight(22); h.s.enemies = [];
  const rail = { id: 'r', kind: 'rail', x: h.p.x + 4, y: h.p.y, dx: 2, dy: 0, offset: 0 }; h.s.hazards = [rail];
  const guard = h.spawnWaveEnemy('guard', { x: rail.x, y: rail.y }), hp = guard.hp;
  for (let i = 0; i < 120; i++) { h.s.time += 1 / 60; h.tickHazards(); }
  assert.equal(guard.hp, hp);
});
