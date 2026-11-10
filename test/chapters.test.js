import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';
import { chapterOpen, chapterCleared, chapterRooms } from '../src/engine/chapters.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));
const FACTORY = 'silent-factory';
const atPortal = (edit = () => {}, previews = true) => { const g = new Game(data); g.previews = previews; g.s.profile.registered = true; g.s.mode = 'hub'; g.s.panel = 'difficulty'; edit(g.s.profile); return g; };
const reload = g => new Game(data, decodeSave(encodeSave(g.s), data));

test('chapter 2 has its own twelve stops: fights, the inspection room, a rest stop and the forming hall', () => {
  const rooms = chapterRooms(data.slice, FACTORY);
  assert.equal(rooms.length, 12);
  assert.deepEqual(rooms.map(r => r.kind), ['normal', 'normal', 'normal', 'normal', 'miniboss', 'shop', 'normal', 'normal', 'normal', 'normal', 'normal', 'regionBoss']);
  assert.ok(rooms.every(r => r.id.startsWith('factory-')));
});

test('chapter 2 opens once chapter 1 is beaten, and a save from before chapters that has a win counts as beaten', () => {
  const fresh = atPortal();
  assert.equal(chapterOpen(data.slice, fresh.s.profile, FACTORY, true), false);
  assert.equal(fresh.depart('normal', FACTORY), false, 'locked');
  assert.equal(fresh.s.run, null);
  const old = atPortal(p => { p.wins = 1; delete p.cleared; });
  assert.ok(chapterCleared(old.s.profile, 'smile-street'));
  assert.ok(chapterOpen(data.slice, old.s.profile, FACTORY, true));
  assert.ok(old.depart('normal', FACTORY));
  assert.equal(old.s.run.chapter, FACTORY);
  assert.equal(old.room.id, 'factory-01');
  assert.equal(old.s.profile.chapter, 2, 'entering chapter 2 opens its stat levels');
});

test('a chapter 2 run is harder and pays more, keeps its records apart, and reports nothing to the server', () => {
  const g = atPortal(p => { p.cleared = ['smile-street']; }), sent = [];
  g.onRun = (kind, event) => sent.push(kind);
  assert.ok(g.depart('normal', FACTORY));
  const level = data.slice.difficulty.levels.find(l => l.id === 'normal'), chapter = data.slice.chapters.find(c => c.id === FACTORY);
  assert.equal(g.difficulty.scale, level.scale * chapter.scale);
  assert.equal(g.difficulty.loot, level.loot * chapter.loot);
  g.s.run.elapsed = 600; g.returnToHub('clear');
  assert.equal(g.s.result.chapter, FACTORY);
  assert.equal(g.s.profile.chapterRecords[FACTORY].normal.clears, 1);
  assert.equal(g.s.profile.records.normal, undefined, 'chapter 1 records untouched');
  assert.deepEqual(sent, []);
});

test('beating the forming hall marks chapter 2 cleared; a chapter 2 run survives a reload', () => {
  const g = atPortal(p => { p.cleared = ['smile-street']; });
  assert.ok(g.depart('hard', FACTORY));
  g.s.run.node = 4; g.enterNode();
  const back = reload(g);
  assert.equal(back.s.run.chapter, FACTORY); assert.equal(back.room.id, 'factory-05'); assert.equal(back.s.run.difficulty, 'hard');
  g.s.run.node = 11; g.enterNode(); g.s.mode = 'unwind'; g.unwind();
  assert.equal(g.s.mode, 'complete');
  assert.ok(g.s.profile.cleared.includes(FACTORY));
  const kept = reload(g);
  assert.deepEqual(kept.s.profile.cleared, ['smile-street', FACTORY]);
});

test('a chapter 1 run is unchanged: no chapter on the run, records where they were', () => {
  const g = atPortal();
  assert.ok(g.depart('easy'));
  assert.equal(g.s.run.chapter, undefined); assert.equal(g.room.id, 'stop-02');
  g.returnToHub('abandon');
  assert.equal(g.s.profile.records.easy.furthest, 1);
});

test('chapter 2 is still a preview: without previews it stays shut even after chapter 1 is beaten', () => {
  const live = atPortal(p => { p.cleared = ['smile-street']; }, false);
  assert.equal(chapterOpen(data.slice, live.s.profile, FACTORY), false);
  assert.equal(live.depart('normal', FACTORY), false);
  assert.equal(live.s.run, null);
  assert.ok(chapterOpen(data.slice, live.s.profile, FACTORY, true), 'open on the dev server');
});

test('chapter 2 rooms get only crates and music boxes from chapter 1’s furniture, and factory devices of their own', () => {
  const kinds = new Set(), byRoom = {};
  for (let seed = 1; seed <= 6; seed++) {
    const g = atPortal(p => { p.cleared = ['smile-street']; });
    assert.ok(g.startRun(seed, 'hard', FACTORY));
    for (const node of [0, 1, 2, 3, 6, 7, 8, 9, 10]) { g.s.run.node = node; g.enterNode(); for (const h of g.s.hazards) { kinds.add(h.kind); (byRoom[g.room.id] ??= new Set()).add(h.kind); } }
  }
  assert.ok(kinds.has('crate'), 'crates still come');
  // The conveyor belt was taken out of every room (2026-11-08); its rules stay for a later room that wants it.
  for (const kind of ['press', 'laser', 'steam', 'crane']) assert.ok(kinds.has(kind), `${kind} comes`);
  assert.ok(!kinds.has('belt'), 'no belts any more');
  assert.deepEqual([...kinds].filter(k => !['crate', 'musicbox', 'belt', 'press', 'laser', 'steam', 'crane'].includes(k)), []);
  // Each stop's own devices: the belt hall its belts, the boiler room its steam, the crane yard its cranes.
  assert.ok(byRoom['factory-02'].has('crate')); assert.ok(byRoom['factory-10'].has('steam')); assert.ok(byRoom['factory-09'].has('crane')); assert.ok(byRoom['factory-01'].has('laser'));
});

const deviceRoom = () => {
  const g = atPortal(p => { p.cleared = ['smile-street']; });
  assert.ok(g.startRun(3, 'normal', FACTORY));
  g.s.run.node = 0; g.enterNode(); g.s.entry = null; g.s.enemies = []; g.p.dodge = null; g.p.invulnerableUntil = 0;
  return g;
};

test('a press slams on its cycle: it hurts F2 on the plate once, blocks the way while down, and answers lightning and ice', () => {
  const g = deviceRoom(), r = data.slice.hazards.press, press = { id: 'hz-press', kind: 'press', x: 18, y: 14, w: r.w, h: r.h, offset: 0 };
  g.s.hazards = [press]; Object.assign(g.p, { x: 18, y: 14 });
  g.s.time = r.idle + r.warn + 0.05; const hp = g.p.hp; g.tickHazards(0); g.tickHazards(0);
  assert.equal(hp - g.p.hp, r.damage, 'one slam, one hit');
  assert.ok(g.inSolid(18, 14, 0.2), 'down on its plate it is in the way');
  g.s.time = 1; g.obstacleCache = null; assert.ok(!g.inSolid(18, 14, 0.2), 'up again, the way is open');
  // Lightning brings the slam at once; ice makes it miss the next one.
  g.p.invulnerableUntil = 0; const before = g.p.hp; g.elementOnHazards({ elements: ['lightning'] }, h => h === press); g.tickHazards(0);
  assert.equal(before - g.p.hp, r.damage, 'lightning slam');
  const other = { id: 'hz-press2', kind: 'press', x: 10, y: 14, w: r.w, h: r.h, offset: 0 }; g.s.hazards = [other]; g.s.time = 0.5;
  g.elementOnHazards({ elements: ['ice'] }, h => h === other); Object.assign(g.p, { x: 10, y: 14 }); g.p.invulnerableUntil = 0;
  g.s.time = r.idle + r.warn + 0.05; const iced = g.p.hp; g.tickHazards(0); assert.equal(g.p.hp, iced, 'iced press misses its slam');
});

test('a laser beam hurts F2 while on, each enemy once a beam, and lightning shorts it out', () => {
  const g = deviceRoom(), r = data.slice.hazards.laser, door = { id: 'hz-laser', kind: 'laser', x: 18, y: 14, half: r.gap / 2, offset: 0 };
  g.s.hazards = [door]; Object.assign(g.p, { x: 18, y: 14 });
  const guard = g.spawnEnemy('guard', { x: 17, y: 14 }); guard.ready = 1e9; guard.summonUntil = 0;
  g.s.time = r.off + r.warn + 0.1; const hp = g.p.hp, ghp = guard.hp; g.tickHazards(0); g.tickHazards(0);
  assert.equal(hp - g.p.hp, r.damage); assert.ok(guard.hp < ghp && guard.stunUntil > g.s.time);
  const once = guard.hp; g.tickHazards(0); assert.equal(guard.hp, once, 'one hit a beam');
  assert.ok(g.inSolid(18 - r.gap / 2, 14, 0.1), 'the posts are solid'); assert.ok(!g.inSolid(18, 14, 0.1), 'the beam is not');
  g.elementOnHazards({ elements: ['lightning'] }, h => h === door); g.p.invulnerableUntil = 0; g.p.laserNext = 0; const shorted = g.p.hp; g.tickHazards(0);
  assert.equal(g.p.hp, shorted, 'shorted out');
});

test('a steam burst hurts and pushes F2 out of the cloud; ice clogs it and wind carries it off', () => {
  const g = deviceRoom(), r = data.slice.hazards.steam, pipe = { id: 'hz-steam', kind: 'steam', x: 18, y: 14, offset: 0 };
  g.s.hazards = [pipe]; Object.assign(g.p, { x: 18.3, y: 14 });
  g.s.time = r.idle + r.warn + 0.1; const hp = g.p.hp; g.tickHazards(0);
  assert.equal(hp - g.p.hp, r.damage); for (let i = 0; i < 20; i++) g.tickHazards(1 / 60);
  assert.ok(g.p.x > 18.3 + r.push * 0.8, `pushed out: ${g.p.x}`);
  g.elementOnHazards({ elements: ['ice'] }, h => h === pipe); Object.assign(g.p, { x: 18, y: 14 }); g.p.invulnerableUntil = 0; g.p.steamNext = 0;
  const iced = g.p.hp; g.tickHazards(0); assert.equal(g.p.hp, iced, 'clogged');
});

test('a crane marks a ring near F2, drops a crate that hurts and then stands in the way, and wrench blows break it', () => {
  const g = deviceRoom(), r = data.slice.hazards.crane, crane = { id: 'hz-crane', kind: 'crane', x: 15, y: 12, offset: 0, next: 0 };
  g.s.hazards = [crane]; Object.assign(g.p, { x: 18, y: 14 });
  g.s.time = 100; g.tickHazards(0); g.tickHazards(0);
  assert.ok(crane.mark && Math.hypot(crane.mark.x - 18, crane.mark.y - 14) <= r.near + 0.01, 'marked near F2');
  Object.assign(g.p, { x: crane.mark.x, y: crane.mark.y }); g.p.invulnerableUntil = 0;
  g.s.time = crane.mark.at + 0.01; const hp = g.p.hp; g.tickHazards(0);
  assert.equal(hp - g.p.hp, r.damage);
  const box = g.s.hazards.find(h => h.kind === 'dropbox'); assert.ok(box); g.obstacleCache = null;
  assert.ok(g.inSolid(box.x, box.y, 0.1), 'the crate is in the way');
  for (let i = 0; i < r.boxHp; i++) { g.s.time += 0.2; g.p.x = box.x - 1; g.p.y = box.y; g.strikeHazards(0, 1.5, Math.PI); }
  assert.ok(box.gone, 'broken by the wrench');
});

test('a conveyor belt carries F2 and enemies along it, turns round on its cycle, stops under ice and runs faster in wind', () => {
  const g = atPortal(p => { p.cleared = ['smile-street']; });
  assert.ok(g.startRun(3, 'normal', FACTORY));
  g.s.run.node = 0; g.enterNode(); g.s.entry = null;
  const rules = data.slice.hazards.belt, belt = { id: 'hz-belt', kind: 'belt', x: 18, y: 14, w: rules.length, h: rules.width, dir: 1, offset: 0 };
  g.s.hazards = [belt]; g.s.enemies = [];
  Object.assign(g.p, { x: 17, y: 14 }); g.p.dodge = null;
  g.tickHazards(0.5);
  assert.ok(Math.abs(g.p.x - (17 + rules.speed * 0.5)) < 1e-6, `carried along: ${g.p.x}`);
  // Half a turn later it runs the other way.
  g.s.time = rules.cycle + 0.1; Object.assign(g.p, { x: 19, y: 14 });
  g.tickHazards(0.5);
  assert.ok(g.p.x < 19, 'turned round');
  // Ice stops it; wind doubles it.
  g.s.time = 0.2; Object.assign(g.p, { x: 17, y: 14 });
  g.elementOnHazards({ elements: ['ice'] }, h => h === belt); g.tickHazards(0.5);
  assert.equal(g.p.x, 17, 'frozen belt holds still');
  g.s.time = rules.frostSeconds + 0.3; g.elementOnHazards({ elements: ['wind'] }, h => h === belt); g.tickHazards(0.25);
  assert.ok(Math.abs(g.p.x - (17 + rules.speed * rules.windBoost * 0.25)) < 1e-6, `wind boost: ${g.p.x}`);
  // Off the strip nothing moves.
  Object.assign(g.p, { x: 18, y: 16 }); g.tickHazards(0.5);
  assert.equal(g.p.x, 18);
});

test('chapter 2 fights draw only the factory mobs, and its elite slot is the compression captain', () => {
  const factory = new Set(['clampCarrier', 'stampInspector', 'pressGuard', 'lensInspector', 'riveter', 'tapePacker', 'oiler', 'partsSupplier', 'pressCaptain']);
  const seen = new Set();
  for (let seed = 1; seed <= 6; seed++) {
    const g = atPortal(p => { p.cleared = ['smile-street']; });
    assert.ok(g.startRun(seed, 'normal', FACTORY));
    for (const node of [0, 1, 2, 3, 6, 7, 8, 9, 10]) {
      g.s.run.node = node; g.enterNode();
      for (const wave of g.s.run.plan[node].waves) for (const type of wave) {
        const body = g.spawnWaveEnemy(type, { x: 10, y: 10 });
        seen.add(body.type); if (type === 'elite') assert.ok(body.elite);
      }
    }
  }
  assert.deepEqual([...seen].filter(type => !factory.has(type)), []);
  assert.ok(seen.has('pressCaptain'), 'elites come as the captain');
});

test('on the local test server chapter 2 is open without beating chapter 1', () => {
  const g = atPortal(); g.unlockChapters = true;
  assert.equal(chapterOpen(data.slice, g.s.profile, FACTORY, true, true), true);
  assert.ok(g.startRun(2, 'normal', FACTORY), 'can depart');
  assert.equal(chapterOpen(data.slice, g.s.profile, FACTORY, false, false), false, 'still locked on the live site');
});

test('stat levels open with a chapter, not on the first step into it: 20 once chapter 2 opens, 30 once chapter 3 does', async () => {
  const { rankCap } = await import('../src/engine/progression.js');
  const stat = data.slice.permanentStats.find(s => s.id === 'maxHp');
  const fresh = atPortal();
  assert.equal(rankCap(data, fresh.s.profile, stat, true), 10, 'chapter 1 only');
  const beaten = atPortal(p => { p.cleared = ['smile-street']; });
  assert.equal(beaten.s.profile.chapter, 1, 'never entered chapter 2');
  assert.equal(rankCap(data, beaten.s.profile, stat, true), 20, 'chapter 2 is open, so its levels are');
  assert.equal(rankCap(data, beaten.s.profile, stat, false), 10, 'where chapter 2 is not shown yet it does not open');
  beaten.s.profile.freeGears = 1e6; for (let i = 0; i < 20; i++) assert.ok(beaten.tune('maxHp', 'buy')); assert.equal(beaten.tune('maxHp', 'buy'), false);
  // A third chapter after the factory: its levels open the moment the factory is beaten.
  const third = { ...data, slice: { ...data.slice, chapters: [...data.slice.chapters, { id: 'clock-tower', number: 3, name: '중앙시계탑', after: FACTORY, rooms: data.slice.chapters[1].rooms }] } };
  assert.equal(rankCap(third, beaten.s.profile, stat, true), 20);
  beaten.s.profile.cleared.push(FACTORY);
  assert.equal(rankCap(third, beaten.s.profile, stat, true), 30);
});
