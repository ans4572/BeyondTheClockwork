// Sound and water (Silent Factory plan 8.1): the four skills, resonance and wet, and when the two join Moru's shelf.
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';

const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))]))));
// The exact numbers below need blows without their ±10% spread (the spread has its own test in game.test.js).
data.combat.caps.damageSpread = 0;
// Exact numbers here: no lucky crits, and the default difficulty at 1.0.
data.combat.player.critChance = 0;
Object.assign(data.slice.difficulty.levels.find(level => level.id === data.slice.difficulty.default), { scale: 1, loot: 1 });
const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60, input); };
const arena = (elements = ['sound', 'water']) => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.s.run.plan[0].layout = 2;
  g.s.run.slots = elements.map(element => ({ element, level: 1, rarity: 'common' })); Object.assign(g.p, { x: 8, y: 8, angle: 0, energy: 100 }); return g;
};
const dummy = (g, x = 9, y = 8) => { const e = g.spawnEnemy('guard', { x, y }); e.ready = 1e9; e.speed = 0; e.hp = e.maxHp = 1e4; return e; };
const lost = e => e.maxHp - e.hp;
const cast = (g, id, target = { x: 11, y: 8 }) => { const skill = data.combat.skills.find(s => s.id === id); g.makeCast(skill, data.slice.skillBehavior[id], { level: 1, rarity: 'common' }, target, false); return g.s.casts.at(-1); };
const ring = (g, e, stacks) => { e.statuses.resonance = g.s.time + 4; e.resonanceStacks = stacks; };
// The skill bar with sound then water: 울림 손바닥, 굉음, 물대포, 고압 분사.
const PALM = 0, ROAR = 1, CANNON = 2, JET = 3;

test('wet: a soaked body hits F2 20% softer, its bullets too, and that is all it does', () => {
  const g = arena(), e = dummy(g); e.statuses.wet = g.s.time + 4;
  assert.equal(g.weakened(e, 10), 8); g.fireBullet(e, 0, 5); assert.equal(g.s.projectiles.at(-1).damage, e.damage * 0.8);
  e.statuses.wet = 0; assert.equal(g.weakened(e, 10), 10);
  // No more cross-element rules: water leaves a burn burning and a ring as it was.
  g.applyStatus(e, 'fire', { id: 'f', staggerUsed: {} }); ring(g, e, 1); const ringEnd = e.statuses.resonance;
  g.applyStatus(e, 'water', { id: 'w', staggerUsed: {} });
  assert.ok(e.burnStacks.some(t => t > g.s.time)); assert.equal(e.statuses.resonance, ringEnd);
});

test('ring palm: 52 and one layer, pushed back; a ringing body takes 1.5 times and two layers', () => {
  const g = arena(), e = dummy(g);
  cast(g, 'ringPalm'); step(g, 0.05);
  assert.equal(lost(e), 52); assert.equal(g.resonanceOf(e), 1);
  assert.ok(e.x > 9.7, `pushed to ${e.x}`);
  e.x = 9; const before = lost(e);
  cast(g, 'ringPalm'); step(g, 0.05);
  // 52 × 1.5, and every layer already on the body makes it take 6% more.
  assert.equal(Math.round((lost(e) - before) * 1000) / 1000, Math.round(52 * 1.5 * 1.06 * 1000) / 1000);
  assert.equal(g.resonanceOf(e), 3);
});

test('roar: a tap fires the least blow down the whole line; held 0.6 seconds it fires the full one', () => {
  let g = arena(); const near = dummy(g, 10), far = dummy(g, 13.5);
  assert.equal(g.castSkill(ROAR, { x: 14, y: 8 }), true); step(g, 0.05);
  assert.equal(lost(near), 36); assert.equal(lost(far), 36);
  assert.equal(g.resonanceOf(near), 1);
  g = arena(); const e = dummy(g, 10);
  g.p.skillHeld = [ROAR]; g.castSkill(ROAR, { x: 14, y: 8 });
  assert.ok(g.p.charging); assert.equal(g.castFeet, 0.5);
  step(g, 0.5, { skillHeld: [ROAR], aim: { x: 14, y: 8 } }); assert.equal(lost(e), 0);
  step(g, 0.2, { skillHeld: [ROAR], aim: { x: 14, y: 8 } });
  assert.equal(g.p.charging, null); assert.equal(lost(e), 78);
  assert.ok(g.p.cooldowns.roar > g.s.time + 9);
});

test('roar: a dodge drops the charge and the wait is half', () => {
  const g = arena(), e = dummy(g, 10);
  g.p.skillHeld = [ROAR]; g.castSkill(ROAR, { x: 14, y: 8 });
  step(g, 0.3, { skillHeld: [ROAR], aim: { x: 14, y: 8 } });
  g.dodge(); step(g, 0.05, { skillHeld: [ROAR] });
  assert.equal(g.p.charging, null); assert.equal(lost(e), 0);
  const wait = g.p.cooldowns.roar - g.s.time;
  assert.ok(wait > 4.5 && wait <= 5, `wait ${wait}`);
});

test('resonance collapse: 30 more, the ring starts over, an elite shield and coating come off, and it passes on', () => {
  // b and c stand beside a but outside the palm's cone, so only the collapse reaches them. Its reach lies flat on the
  // floor like its ring (floorDistance), so they stand close above and below.
  const g = arena(), a = dummy(g, 9), b = dummy(g, 8.3, 7.45), c = dummy(g, 8.3, 8.55);
  ring(g, a, 3); ring(g, c, 2);
  Object.assign(a, { shieldHits: 0, frontGuard: 0.5, guardArcDegrees: 120, immuneTo: 'burn' });
  cast(g, 'ringPalm'); step(g, 0.05);
  assert.equal(g.resonanceOf(a), 0); assert.equal(a.shieldHits, undefined); assert.equal(a.frontGuard, 0); assert.equal(a.immuneTo, null);
  // The ring passed one layer to b; c had two, reached three and burst in turn.
  assert.equal(g.resonanceOf(b), 1);
  assert.equal(g.resonanceOf(c), 0); assert.ok(lost(c) >= 30);
});

test('resonance collapse stops ordinary bodies at its heart and round it for a moment', () => {
  const g = arena(), a = dummy(g, 9, 8), b = dummy(g, 9.8, 8), far = dummy(g, 14, 8), stun = data.combat.statuses.find(s => s.id === 'resonance').collapseStun;
  g.collapseResonance(a);
  for (const e of [a, b]) assert.ok(e.stunUntil >= g.s.time + stun - 1e-9);
  assert.ok(!(far.stunUntil > g.s.time), 'a body out of reach keeps moving');
});

test('resonance alone: each layer adds 6% to every blow, and wears off after four seconds', () => {
  const g = arena(), e = dummy(g);
  ring(g, e, 2); g.hitEnemy(e, 100, { exact: false });
  assert.equal(lost(e), 112);
  g.s.time += 5; assert.equal(g.resonanceOf(e), 0);
});

test('water cannon: three narrow-spread shots pass through every body, soak them and push them on', () => {
  const g = arena(), a = dummy(g, 10), b = dummy(g, 12);
  const shot = cast(g, 'waterCannon', { x: 14, y: 8 });
  assert.equal(shot.projectiles.length, 3);
  step(g, 0.6);
  assert.equal(lost(a), 60, 'close by, all three shots land (3 × 20)');
  assert.ok(lost(b) >= 20 && lost(b) < 60, `further on, the fan has opened: ${lost(b)}`);
  assert.ok(g.wet(a) && g.wet(b));
  assert.ok(a.x > 10.5 && b.x > 12.2);
});

test('hydro jet: held, it beats 15 times on every body on its line for 105; let go, it stops early; feet slow while it runs', () => {
  let g = arena(); const front = dummy(g, 10), back = dummy(g, 11.5);
  g.p.skillHeld = [JET]; g.castSkill(JET, { x: 14, y: 8 });
  assert.equal(g.castFeet, 0.6);
  step(g, 1.7, { skillHeld: [JET], aim: { x: 14, y: 8 } });
  assert.equal(lost(front), 105); assert.equal(lost(back), 105); assert.ok(g.wet(front) && g.wet(back));
  assert.equal(g.s.casts.some(c => c.shape === 'jet'), false); assert.equal(g.castFeet, 1);
  g = arena(); const e = dummy(g, 10);
  g.castSkill(JET, { x: 14, y: 8 }); step(g, 1.7, { aim: { x: 14, y: 8 } });
  assert.ok(lost(e) >= 24 && lost(e) <= 36, `a tap sprays the least: ${lost(e)}`);
});

test('sound and water are on Moru\'s shelf on the live site from the start, like the other four (2026-11-10)', () => {
  const g = new Game(data); Object.assign(g.s.profile, { registered: true, freeGears: 999, ownedElements: ['fire'], loadout: ['fire'] }); g.s.mode = 'hub';
  assert.equal(g.previews, false); assert.equal(g.elementShown('sound'), true); assert.equal(g.elementOpen('sound'), true);
  assert.equal(g.elementShown('water'), true); assert.equal(g.elementOpen('water'), true);
  assert.equal(g.buyElement('water'), true, 'no chapter to beat first'); assert.deepEqual(g.s.profile.loadout, ['fire', 'water']);
  assert.equal(g.elementOpen('fire'), true);
});

// ---- The fourteen cards (skill mods and element traits) for sound and water.
const withCards = (cards, elements) => { const g = arena(elements); g.s.run.skillMods = cards.filter(id => data.slice.skillMods.some(m => m.id === id)); g.s.run.traits = cards.filter(id => data.slice.elementTraits.some(t => t.id === id)); return g; };
const swing = (g, phase = 0) => { g.p.combo = phase; g.p.comboExpires = g.s.time + 9; g.p.attack = null; g.basicAttack(); step(g, 0.6); };
const plain = id => ({ id, staggerUsed: {}, fusion: false });

test('되울림: the palm rings again 0.4s later for half, laying one more layer', () => {
  const g = withCards(['echoPalm']), e = dummy(g);
  cast(g, 'ringPalm'); step(g, 0.2); assert.equal(lost(e), 52);
  e.x = 9; step(g, 0.4);
  assert.ok(Math.abs(lost(e) - (52 + 26 * 1.06)) < 1e-9); assert.equal(g.resonanceOf(e), 2);
});

test('조율 박자: a palm on a ringing body gives back two seconds of its wait', () => {
  const g = withCards(['tuningBeat']), e = dummy(g); ring(g, e, 1);
  g.castSkill(PALM, { x: 11, y: 8 }); step(g, 0.05);
  const wait = g.p.cooldowns.ringPalm - g.s.time;
  assert.ok(wait > 3.8 && wait <= 4, `wait ${wait}`);
});

test('최대 음량 and 짧은 숨: a full charge lays two layers; the charge takes 0.3 seconds at full speed', () => {
  let g = withCards(['fullVolume']), e = dummy(g, 10);
  g.p.skillHeld = [ROAR]; g.castSkill(ROAR, { x: 14, y: 8 }); step(g, 1.1, { skillHeld: [ROAR], aim: { x: 14, y: 8 } });
  assert.equal(g.resonanceOf(e), 2);
  g = withCards(['fullVolume']); e = dummy(g, 10);
  g.castSkill(ROAR, { x: 14, y: 8 }); step(g, 0.05);
  assert.equal(g.resonanceOf(e), 1, 'a tap still lays one');
  g = withCards(['shortBreath']); e = dummy(g, 10);
  g.p.skillHeld = [ROAR]; g.castSkill(ROAR, { x: 14, y: 8 });
  assert.equal(g.castFeet, 1);
  step(g, 0.25, { skillHeld: [ROAR], aim: { x: 14, y: 8 } }); assert.ok(g.p.charging, 'still gathering');
  step(g, 0.1, { skillHeld: [ROAR], aim: { x: 14, y: 8 } });
  assert.equal(g.p.charging, null); assert.equal(lost(e), 78);
});

test('물폭탄: each shot bursts where it ends and soaks the bodies round it for half', () => {
  const plain = arena(), g = withCards(['burstShot']), was = dummy(plain, 14.5, 9.8), beside = dummy(g, 14.5, 9.8);
  cast(plain, 'waterCannon', { x: 14, y: 8 }); cast(g, 'waterCannon', { x: 14, y: 8 }); step(plain, 0.8); step(g, 0.8);
  assert.ok(lost(beside) >= lost(was) + 7.5, `burst on top of any shot: ${lost(was)} → ${lost(beside)}`); assert.ok(g.wet(beside));
});

test('벽치기 물살: the shot shoves further, and a body slammed into a wall is dazed', () => {
  const g = withCards(['wallSlam']), { reach } = g.lineReach({ x: 8, y: 8 }, 0, 30);
  Object.assign(g.p, { x: 8 + reach - 3, y: 8 });
  const e = dummy(g, 8 + reach - 0.8, 8);
  cast(g, 'waterCannon', { x: 40, y: 8 }); step(g, 0.4);
  assert.ok(e.dazedUntil > g.s.time, 'dazed against the wall');
  const open = withCards(['wallSlam']), free = dummy(open, 10), plain = arena(), was = dummy(plain, 10);
  cast(open, 'waterCannon', { x: 14, y: 8 }); cast(plain, 'waterCannon', { x: 14, y: 8 }); step(open, 0.6); step(plain, 0.6);
  assert.ok(free.x - was.x > 0.35, `0.6 a shot instead of 0.25: ${was.x} → ${free.x}`); assert.ok(!(free.dazedUntil > open.s.time));
});

test('넓은 노즐 and 물웅덩이: the stream is twice as broad and catches a body off its line; its landing spot leaves puddles that soak and slow only enemies', () => {
  const narrow = arena(), missed = dummy(narrow, 11, 8.9);
  narrow.p.skillHeld = [JET]; narrow.castSkill(JET, { x: 14, y: 8 }); step(narrow, 1.7, { skillHeld: [JET], aim: { x: 14, y: 8 } });
  assert.equal(lost(missed), 0);
  let g = withCards(['wideNozzle']); const beside = dummy(g, 11, 8.9);
  g.p.skillHeld = [JET]; g.castSkill(JET, { x: 14, y: 8 }); step(g, 1.7, { skillHeld: [JET], aim: { x: 14, y: 8 } });
  assert.equal(lost(beside), 105);
  g = withCards(['puddle']);
  g.p.skillHeld = [JET]; g.castSkill(JET, { x: 14, y: 8 }); step(g, 0.3, { skillHeld: [JET], aim: { x: 14, y: 8 } });
  const pool = g.s.casts.find(c => c.look === 'puddle');
  assert.ok(pool);
  const e = dummy(g, pool.x, pool.y); step(g, 0.1, { skillHeld: [JET], aim: { x: 14, y: 8 } });
  assert.ok(g.wet(e)); assert.equal(g.patchSlow(e, true), 0.2);
  Object.assign(g.p, { x: pool.x, y: pool.y }); assert.equal(g.patchSlow(g.p), 0);
});

test('긴 여운: resonance lasts two seconds longer and each layer adds 9%', () => {
  const g = withCards(['longEcho']), e = dummy(g);
  g.applyStatus(e, 'sound', plain('a'), 2);
  assert.equal(e.statuses.resonance, g.s.time + 6);
  g.hitEnemy(e, 100); assert.equal(lost(e), 118);
});

test('렌치 조율: the wrench lays a layer on a ringing body, once a second', () => {
  const g = withCards(['wrenchTune']), e = dummy(g); ring(g, e, 1);
  swing(g); assert.equal(g.resonanceOf(e), 2);
  e.statuses.resonance = g.s.time + 4; swing(g); assert.equal(g.resonanceOf(e), 2, 'not again within a second');
  g.s.time += 1; e.statuses.resonance = g.s.time + 4; swing(g); assert.equal(g.resonanceOf(e), 3);
});

test('흠뻑: wet lasts two seconds longer and a soaked body walks 15% slower', () => {
  const walked = cards => { const g = withCards(cards), e = g.spawnEnemy('guard', { x: 16, y: 8 }); e.ready = 1e9; g.applyStatus(e, 'water', plain('w')); const start = e.x; step(g, 0.5); return { g, e, moved: start - e.x }; };
  const soaked = walked(['soaked']), dry = walked([]);
  assert.ok(soaked.e.statuses.wet > soaked.g.s.time + 1);
  assert.ok(Math.abs(soaked.moved / dry.moved - 0.85) < 0.03, `${soaked.moved} vs ${dry.moved}`);
});

test('물튀김: a wrench on a soaked body splashes its neighbours', () => {
  const g = withCards(['splashBack']), e = dummy(g), side = dummy(g, 10, 9);
  g.applyStatus(e, 'water', plain('w')); swing(g);
  assert.ok(g.wet(side));
});

// The nine sound and water fusions, cast at a spot ahead of F2.
const fuse = (pair, target = { x: 11, y: 8 }) => { const g = arena(pair); g.p.energy = 100; return { g, cast: () => { assert.equal(g.castFusion(target), true); return g.s.casts.at(-1); } }; };

test('과열 공진: three nearest bodies burst in turn; a lone body takes all three bursts', () => {
  let { g, cast } = fuse(['fire', 'sound']); const a = dummy(g, 10), b = dummy(g, 8, 11), c = dummy(g, 8, 5), far = dummy(g, 20, 8);
  cast(); step(g, 0.7); assert.equal(lost(a) + lost(b) + lost(c), 0, 'nothing before 0.8s');
  step(g, 1); assert.ok([a, b, c].every(e => lost(e) >= 34)); assert.equal(lost(far), 0);
  ({ g, cast } = fuse(['fire', 'sound'])); const lone = dummy(g, 10); cast(); step(g, 2);
  assert.ok(lost(lone) >= 102, `${lost(lone)}`);
});

test('고음 파쇄: freezes ordinary bodies, then the high note breaks a frozen one 1.3 times as hard', () => {
  const { g, cast } = fuse(['ice', 'sound']), e = dummy(g, 11); cast();
  step(g, 0.35); assert.ok(e.frozenUntil > g.s.time, 'frozen'); const first = lost(e);
  step(g, 1); assert.ok(lost(e) - first >= 55 * 1.3 - 1e-6, `${lost(e) - first}`);
});

test('공명 낙뢰: the struck body rings four times round it; if it falls, the rest goes off at once', () => {
  let { g, cast } = fuse(['lightning', 'sound']); const e = dummy(g, 10), side = dummy(g, 11, 8.5); cast(); step(g, 2.2);
  assert.ok(lost(e) >= 100); assert.ok(lost(side) >= 60, 'the pulses reach the body beside it');
  ({ g, cast } = fuse(['lightning', 'sound'])); const frail = dummy(g, 10), near = dummy(g, 11, 8.5); frail.hp = 1; cast(); step(g, 0.1);
  assert.ok(lost(near) >= 60, 'all four pulses at once when it fell');
});

test('메아리 돌풍: the ring cuts each body on its way out and again on its way back', () => {
  const { g, cast } = fuse(['wind', 'sound']), e = dummy(g, 11); const ring = cast(); step(g, 2);
  assert.equal(ring.hitOut.length, 1); assert.equal(ring.hitBack.length, 1); assert.ok(lost(e) >= 100);
});

test('수면 공명: striking a body on the film rings the whole film, at most once per 0.3s and six times', () => {
  const { g, cast } = fuse(['sound', 'water']), a = dummy(g, 10), b = dummy(g, 11, 9); const film = cast();
  step(g, 0.1); assert.equal(lost(b), 0);
  g.ringFilms(a); assert.equal(film.rings, 1); assert.equal(lost(b), 34); g.ringFilms(a); assert.equal(film.rings, 1, 'not again so soon');
  for (let i = 0; i < 8; i++) { g.s.time += 0.31; g.ringFilms(a); } assert.equal(film.rings, 6);
  const off = dummy(g, 20, 20); g.s.time += 1; g.ringFilms(off); assert.equal(film.rings, 6);
});

test('과열 증기막: steam round F2 follows her and scalds and soaks what is in it, without putting out its own burn', () => {
  const { g, cast } = fuse(['fire', 'water']), e = dummy(g, 9.5), far = dummy(g, 13); cast();
  step(g, 0.3); assert.ok(lost(e) > 0); assert.equal(lost(far), 0);
  assert.ok(g.wet(e) && e.burnStacks.some(t => t > g.s.time), 'wet and burning together');
  g.p.x = 11.5; step(g, 0.6); assert.ok(lost(far) > 0, 'the cloud moved with F2');
});

test('빙판: forms with a blow, slows only enemies on it, then breaks under them three seconds later', () => {
  const { g, cast } = fuse(['ice', 'water']), e = dummy(g, 11), out = dummy(g, 16); const sheet = cast();
  step(g, 0.1); assert.equal(lost(e), 40); assert.equal(lost(out), 0);
  assert.equal(g.patchSlow(e, true), 0.4); Object.assign(g.p, { x: 11, y: 8 }); assert.equal(g.patchSlow(g.p), 0, 'F2 is not slowed');
  step(g, 3); assert.ok(lost(e) >= 220 - 1e-6); assert.ok(sheet.done); assert.equal(g.patchSlow(e, true), 0, 'the ice is gone');
});

test('감전 웅덩이: discharges into every body in it every half second, harder for each wet body', () => {
  const { g, cast } = fuse(['lightning', 'water']), a = dummy(g, 11), b = dummy(g, 11.5, 8.4), out = dummy(g, 15); cast();
  step(g, 0.25); const one = lost(a); assert.ok(one > 0 && lost(b) > 0); assert.equal(lost(out), 0);
  step(g, 0.5); assert.ok(lost(a) - one > one, 'the second discharge is bigger: both are wet now');
});

test('물기둥 회오리: draws ordinary bodies in and up, then slams them down and stuns them; a boss stays put', () => {
  const { g, cast } = fuse(['wind', 'water']), e = g.spawnEnemy('guard', { x: 12.5, y: 8 }); e.ready = 1e9; e.hp = e.maxHp = 1e4;
  const boss = g.spawnEnemy('captainBrass', { x: 9.2, y: 10.2 }); boss.ready = 1e9; boss.hp = boss.maxHp = 1e5; const gap = Math.hypot(boss.x - 11, boss.y - 8); cast();
  step(g, 1); assert.ok(Math.hypot(e.x - 11, e.y - 8) < 1, 'pulled in'); assert.ok(e.lift > 0, 'lifted'); assert.ok(Math.hypot(boss.x - 11, boss.y - 8) >= gap - 0.05, 'the boss is not drawn in');
  step(g, 1.1); assert.equal(e.lift, 0); assert.ok(e.stunUntil > g.s.time); assert.ok(lost(e) >= 110 - 1e-6);
});
