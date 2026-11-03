import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, distance } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { buyRank, refundAll, permanentStats } from '../src/engine/progression.js';
import { encodeSave, decodeSave, hasProgress } from '../src/engine/storage.js';

const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))]))));
const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60, input); };
function hub() { const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; return g; }
function arena() {
  const g = hub(); g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.s.run.plan[0].layout = 2;
  g.p.x = 8; g.p.y = 8; g.p.angle = 0; return g;
}
const inert = (g, type = 'guard', position = { x: 9, y: 8 }) => { const e = g.spawnEnemy(type, position); e.ready = 1e9; e.speed = 0; return e; };
function completeRoom(g) { for (const e of g.s.enemies) e.hp = 0; g.finishCombat(); if (g.s.mode === 'unwind') g.unwind(); }
function pick(g, kind) { const index = kind ? g.s.run.rewardChoices.findIndex(r => r.kind === kind) : 0; assert.ok(index >= 0); assert.equal(g.chooseReward(index, 0), true); }

test('source data retains the full 8 elements / 28 fusions while runtime selects 18.1', async () => {
  const source = JSON.parse(await readFile(new URL('../docs/design/clockwork-design.v1.json', import.meta.url), 'utf8'));
  assert.equal(source.elements.length, 8); assert.equal(source.fusions.length, 28);
  assert.equal(data.combat.fusions.length, 6); assert.equal(data.slice.permanentStats.length, 13);
  assert.deepEqual(data.combat.player, source.player);
  const keys = new Set(source.fusions.map(f => [...f.pair].sort().join('+'))); assert.equal(keys.size, 28);
});
test('intro death restarts its checkpoint without registration or canonical rewards', () => {
  const g = new Game(data); g.beginIntro(); g.hurt(1000);
  assert.equal(g.s.mode, 'introDeath'); assert.equal(g.s.profile.registered, false); assert.equal(g.s.profile.firstReturnClaimed, false);
  g.beginIntro(); assert.equal(g.p.hp, 100); assert.equal(g.s.profile.freeGears, 0);
  completeRoom(g); assert.equal(g.s.mode, 'registration'); assert.equal(g.s.profile.freeGears, 8);
  assert.equal(g.s.profile.combatClears, 0); assert.equal(g.s.profile.firstReturnClaimed, false);
  assert.equal(g.register(), true); assert.equal(g.register(), false); assert.equal(g.s.profile.freeGears, 8);
});
test('stats level to twenty in chapter 2 at a rising price, and refunds conserve currency', () => {
  const g = hub(); g.s.profile.freeGears = 100000; g.s.profile.chapter = 2;
  for (let i = 0; i < 20; i++) assert.equal(g.tune('maxHp', 'buy'), true);
  assert.equal(g.tune('maxHp', 'buy'), false); assert.equal(g.s.profile.stats.maxHp, 20);
  assert.equal(g.s.profile.freeGears, 100000 - 1150); assert.equal(g.p.maxHp, 200); assert.equal(g.p.hp, 200);
  for (let n = 0; n < 5; n++) g.tune(null, 'refund');
  assert.equal(g.s.profile.freeGears, 100000); assert.equal(g.s.profile.stats.maxHp, 0); assert.equal(g.p.maxHp, 100);
  g.startRun(1); assert.equal(g.tune('maxHp', 'buy'), false);
});
test('insufficient funds never modify a purchase or a rank', () => {
  const g = hub(); g.s.profile.freeGears = 9;
  assert.equal(buyRank(data, g.s.profile, 'maxHp'), false); assert.equal(g.s.profile.freeGears, 9);
  assert.equal(g.s.profile.stats.maxHp, 0); assert.equal(refundAll(data, g.s.profile), 0);
  assert.equal(buyRank(data, g.s.profile, 'nothing'), false);
});
test('a wrench swing plants the feet until it and its recovery end', () => {
  const g = arena(); inert(g); g.p.x = 8; g.p.y = 8; g.p.angle = 0;
  assert.equal(g.basicAttack(), true); step(g, 0.2, { x: 1 }); assert.equal(g.p.x, 8);
  step(g, 0.5, { x: 1 }); assert.equal(g.p.attack, null); assert.ok(g.p.x > 8);
});

test('every stat changes what it says', () => {
  const g = arena(), enemy = inert(g), base = g.damageMultiplier(enemy, false);
  g.s.profile.stats.attackDamage = 20;
  assert.ok(Math.abs(g.damageMultiplier(enemy, true) - base * 1.6) < 1e-9); assert.ok(Math.abs(g.damageMultiplier(enemy, false) - base * 1.6) < 1e-9);
  g.s.profile.stats.damageReduction = 20; g.hurt(50); assert.ok(Math.abs(g.p.hp - 65) < 1e-9);
  g.s.profile.stats.moveSpeed = 20; const x = g.p.x; step(g, 0.5, { x: 1 }); assert.ok(Math.abs(g.p.x - x - 3.5 * 1.4 * 0.5) < 0.2);
  g.s.profile.stats.attackSpeed = 20; g.p.attack = null; g.p.x = 8; assert.equal(g.basicAttack(), true); g.updateBasic(0.1); assert.ok(Math.abs(g.p.attack.elapsed - 0.14) < 1e-9);
  g.s.profile.stats.cooldownReduction = 20; assert.ok(Math.abs(g.cooldownFactor - 0.7) < 1e-9);
  g.s.run.upgrades.skillCooldownReduction = 4; assert.ok(Math.abs(g.cooldownFactor - 0.65) < 1e-9);
});
test('crits use the cap and multiplier, and never touch damage over time', () => {
  const g = arena(), enemy = inert(g); enemy.hp = enemy.maxHp = 1e5;
  g.s.profile.stats.critChance = 20; g.s.profile.stats.critDamage = 20; g.random = () => 0.1;
  g.hitEnemy(enemy, 100); assert.equal(enemy.hp, 1e5 - 200);
  assert.equal(g.s.effects.at(-1).color, '#e8433a');
  g.hitEnemy(enemy, 100, { dot: true }); assert.equal(enemy.hp, 1e5 - 300);
  g.random = () => 0.45; g.hitEnemy(enemy, 100); assert.equal(enemy.hp, 1e5 - 400);
  // Every body starts with a 10% chance before any tuning.
  g.s.profile.stats.critChance = 0; g.random = () => 0.09; g.hitEnemy(enemy, 100); assert.equal(enemy.hp, 1e5 - 600);
  g.random = () => 0.11; g.hitEnemy(enemy, 100); assert.equal(enemy.hp, 1e5 - 700);
});
test('the new economy, dodge, energy and status stats each do their job', () => {
  const g = arena(); g.s.profile.stats.dodgeCooldown = 20; g.dodge();
  assert.ok(Math.abs(g.p.dodgeReady - g.s.time - 0.45) < 1e-9);
  const h = arena(), enemy = inert(h, 'guard', { x: 9, y: 8 }); enemy.hp = enemy.maxHp = 1e4; h.s.profile.stats.energyGain = 20;
  h.p.angle = 0; h.basicAttack(); step(h, 0.15); assert.ok(Math.abs(h.p.energy - 8 * 1.4) < 1e-9);
  const j = hub(); j.s.profile.stats.gearGain = 20; j.s.profile.stats.coinGain = 20; j.startRun(5); completeRoom(j);
  assert.equal(j.s.run.baseGears, 11); assert.equal(j.s.run.coins, 21);
  assert.equal(j.statusPower, 1); j.s.profile.stats.statusPower = 20; assert.ok(Math.abs(j.statusPower - 1.5) < 1e-9);
  const b = arena(), burned = inert(b); burned.hp = burned.maxHp = 1000; b.s.profile.stats.statusPower = 20; burned.burnStacks = [b.s.time + 4]; burned.burnTick = b.s.time; b.updateEnemies(1 / 60);
  assert.ok(Math.abs(burned.hp - (1000 - 4 * 0.5 * 1.5)) < 1e-9);
});
test('saves with the old tuning rows get their gears back', () => {
  const g = hub(), raw = JSON.parse(encodeSave(g.s));
  delete raw.state.profile.stats; raw.state.profile.freeGears = 7;
  raw.state.profile.rows = { chassis: { rank: 2, choice: 1 }, strike: { rank: 0, choice: 0 }, repair: { rank: 1, choice: 0 }, safety: { rank: 2, choice: 1 } };
  raw.state.player.revives = 2; raw.state.player.firstHit = true;
  const restored = decodeSave(JSON.stringify(raw), data);
  assert.equal(restored.profile.freeGears, 7 + 55 + 30 + 420); assert.equal(restored.profile.rows, undefined); assert.equal(restored.profile.stats.maxHp, 0);
});
test('one swing hits multiple targets once but charges only once per phase', () => {
  const g = arena(), a = inert(g), b = inert(g, 'guard', { x: 9, y: 8.4 });
  const full = a.maxHp; g.basicAttack(); step(g, 0.36);
  assert.equal(a.hp, full - 16); assert.equal(b.hp, full - 16); assert.equal(g.p.energy, 8);
  step(g, 0.15); assert.equal(g.basicAttack(), true); step(g, 0.51);
  assert.equal(a.hp, full - 34); assert.equal(g.p.energy, 16);
  g.basicAttack(); step(g, 0.75); assert.equal(a.hp, full - 62); assert.equal(g.p.energy, 24);
});
test('standing still never regenerates charge', () => {
  const g = arena(); inert(g, 'guard', { x: 20, y: 12 }); step(g, 10); assert.equal(g.p.energy, 0);
});
test('basic windup can be dodge cancelled; active frames cannot be duplicated', () => {
  const g = arena(); const e = inert(g); g.basicAttack(); step(g, 0.033);
  assert.equal(g.dodge(), true); step(g, 0.3); assert.equal(e.hp, e.maxHp); assert.equal(g.p.energy, 0);
  g.p.x = 8; g.p.y = 8; g.p.dodgeReady = 0; g.basicAttack(); step(g, 0.18);
  assert.equal(g.dodge(), false); assert.equal(g.p.energy, 8); step(g, 0.75); assert.equal(g.p.energy, 8);
});
test('third recovery can be cancelled only in its last 0.1 seconds', () => {
  const g = arena(); inert(g); g.p.combo = 2; g.p.comboExpires = 10; g.basicAttack(); step(g, 0.55);
  assert.equal(g.dodge(), false); step(g, 0.1); assert.equal(g.dodge(), true);
});
test('diagonal movement has the same speed as cardinal movement', () => {
  const g = arena(), h = arena(); inert(g, 'guard', { x: 25, y: 14 }); inert(h, 'guard', { x: 25, y: 14 });
  const start = { ...g.p }; step(g, 1, { x: 1 }); step(h, 1, { x: 1, y: 1 });
  assert.ok(Math.abs(distance(g.p, start) - distance(h.p, start)) < 1e-8); assert.ok(Math.abs(distance(g.p, start) - 3.5) < 1e-8);
});
test('dodge lasts 0.18s, travels 3 units, and grants only 0.16s invulnerability', () => {
  const g = arena(); inert(g, 'guard', { x: 25, y: 14 }); const start = { ...g.p }; g.dodge();
  assert.ok(Math.abs(g.p.invulnerableUntil - 0.16) < 1e-8); assert.equal(g.hurt(10), false);
  step(g, 0.2); assert.ok(Math.abs(distance(g.p, start) - 3) < 1e-8); assert.equal(g.p.dodge, null);
  assert.equal(g.hurt(10), true); assert.equal(g.hurt(10), false); assert.equal(g.dodge(), false);
});
test('collision clamps dashes at obstacles and arena walls', () => {
  const g = arena(); inert(g, 'guard', { x: 25, y: 14 });
  g.s.run.plan[0].layout = 0; g.p.x = 9.7; g.p.y = 5.4; g.dodge(); step(g, 0.2);
  assert.ok(g.p.x <= 11 - data.slice.arena.playerRadius + 1e-8);
  g.p.x = 26; g.p.y = 8; g.p.dodgeReady = 0; g.dodge(); step(g, 0.2);
  assert.ok(g.p.x <= data.slice.arena.bounds.right - data.slice.arena.playerRadius + 1e-8);
});
test('rewards never hand out elements to try; a wrench-only run still gets three cards', () => {
  for (const history of [[], [{ reason: 'defeat' }]]) {
    const g = hub(); g.s.profile.loadout = []; g.s.profile.history = history; g.startRun(44); completeRoom(g);
    assert.equal(g.s.run.rewardChoices.length, 3);
    assert.ok(g.s.run.rewardChoices.every(r => r.kind !== 'element'));
  }
});
test('fusion cost/cooldown and minimum slot level/rarity are respected', () => {
  const g = arena(); inert(g, 'captainBrass');
  g.s.run.slots = [{ element: 'fire', level: 5, rarity: 'special' }, { element: 'ice', level: 2, rarity: 'rare' }];
  assert.equal(g.castFusion({ x: 9, y: 8 }), false); g.p.energy = 100;
  assert.equal(g.castFusion({ x: 9, y: 8 }), true); assert.equal(g.p.energy, 40);
  assert.equal(g.s.casts[0].slot.level, 2); assert.equal(g.s.casts[0].slot.rarity, 'rare');
  assert.equal(g.p.fusionReady, 18); assert.equal(g.castFusion({ x: 9, y: 8 }), false);
});
test('all six fusion combinations actually deal their direct damage', () => {
  for (const fusion of data.combat.fusions) {
    const g = arena(), e = inert(g, 'captainBrass', { x: fusion.id === 'frostCrosscut' ? 10.8 : fusion.id === 'fireCyclone' ? 12 : 9, y: 8 }); e.hp = e.maxHp = 100000;
    g.s.run.slots = fusion.pair.map(element => ({ element, level: 1, rarity: 'common' })); g.p.energy = 100;
    assert.equal(g.castFusion(e), true); step(g, 3.5);
    assert.ok(100000 - e.hp >= fusion.totalDirectDamage - 0.001, `${fusion.id} did not deal the expected damage`);
    assert.ok(e.stagger <= data.combat.balance.fusionStaggerPerCastCap, `${fusion.id} exceeded stagger budget`);
  }
});
test('all eight individual skills hit; pressure dash grants no invulnerability', () => {
  for (const skill of data.combat.skills) {
    const g = arena(), e = inert(g, 'captainBrass', { x: 9.1, y: 8 }); e.hp = e.maxHp = 100000;
    g.s.run.slots = [{ element: skill.element, level: 1, rarity: 'common' }]; g.p.energy = 100;
    const index = g.skillSlots.findIndex(entry => entry.skill.id === skill.id);
    assert.equal(g.castSkill(index, e), true); step(g, 3);
    assert.ok(e.hp < 100000, `${skill.id} failed to hit`);
    assert.ok(e.stagger <= data.combat.balance.skillStaggerPerCastCap, `${skill.id} exceeded per-cast stagger`);
    if (skill.id === 'pressureDash') assert.equal(g.p.invulnerableUntil, 0);
  }
});
test('element replacement preserves slot level, skill cooldowns, energy and fusion cooldown', () => {
  const g = arena(); inert(g); g.s.run.slots = [{ element: 'fire', level: 3, rarity: 'rare' }, { element: 'ice', level: 2, rarity: 'common' }];
  g.p.energy = 100; g.castSkill(0, { x: 9, y: 8 }); g.castFusion({ x: 9, y: 8 });
  const oldReady = g.p.fusionReady, oldSkillReady = g.p.cooldowns.heatSwing, energy = g.p.energy;
  g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'element', id: 'wind', rarity: 'rare' }];
  assert.equal(g.chooseReward(0), false); assert.equal(g.chooseReward(0, 0), true);
  assert.equal(g.slots[0].level, 3); assert.equal(g.p.cooldowns.heatSwing, oldSkillReady); assert.equal(g.p.fusionReady, oldReady); assert.equal(g.p.energy, energy);
  g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'element', id: 'fire', rarity: 'common' }]; g.chooseReward(0, 0);
  g.s.mode = 'combat'; assert.equal(g.castSkill(0, { x: 9, y: 8 }), false);
});
test('burn uses independent stack expiry; status application is throttled per cast/target', () => {
  const g = arena(), e = inert(g, 'captainBrass'); const cast = { id: 'test', staggerUsed: {}, fusion: false };
  g.applyStatus(e, 'fire', cast); g.applyStatus(e, 'fire', cast); assert.equal(e.burnStacks.length, 1);
  step(g, 0.3); g.applyStatus(e, 'fire', cast); assert.equal(e.burnStacks.length, 2);
  g.applyStatus(e, 'fire', { ...cast, id: 'other' }); assert.equal(e.burnStacks.length, 3);
  step(g, 3.8); assert.equal(e.burnStacks.length, 2); step(g, 0.3); assert.equal(e.burnStacks.length, 0);
});
test('boss stagger exposes for 1.5s and locks reapplication for eight more seconds', () => {
  const g = arena(), e = inert(g, 'collectorRoco'); g.addStagger(e, 100);
  assert.equal(e.exposedUntil, 1.5); assert.equal(e.staggerLock, 9.5); g.addStagger(e, 1000); assert.equal(e.stagger, 0);
  step(g, 2); g.addStagger(e, 1000); assert.equal(e.stagger, 0);
});
test('bosses do not move when vortex pulls normal enemies', () => {
  const g = arena(), e = inert(g, 'collectorRoco', { x: 10, y: 8 }), normal = inert(g, 'guard', { x: 11.8, y: 8 });
  g.s.run.slots = [{ element: 'wind', level: 1, rarity: 'common' }]; g.p.energy = 100; const before = { ...e }, normalBefore = normal.x;
  g.castSkill(1, { x: 9, y: 8 }); step(g, 0.5);
  assert.equal(e.x, before.x); assert.equal(e.y, before.y); assert.ok(normal.x < normalBefore);
});
test('shock discharge does not recurse or ignore its per-target lock', () => {
  const g = arena(), e = inert(g, 'captainBrass'), other = inert(g, 'captainBrass', { x: 9.5, y: 8 });
  e.statuses.shock = other.statuses.shock = 3; g.triggerShock(e); assert.equal(e.hp, 990); assert.equal(other.hp, 990);
  g.triggerShock(other); assert.equal(other.hp, 990); step(g, 0.6); g.triggerShock(other); assert.equal(other.hp, 980);
});
test('pause freezes attack, enemy tell, cooldown, statuses and elapsed time', () => {
  const g = arena(), e = inert(g); g.basicAttack(); g.beginEnemyTell(e, 'melee'); g.p.cooldowns.heatSwing = 5;
  g.s.paused = true; const before = JSON.stringify(g.s); step(g, 5, { basic: true, dodge: true }); assert.equal(JSON.stringify(g.s), before);
});
test('first return without a cleared combat gives no bonus; valid return gives it once', () => {
  const g = hub(); g.startRun(4); g.returnToHub(); assert.equal(g.s.profile.freeGears, 0); assert.equal(g.s.profile.firstReturnClaimed, false);
  g.acknowledgeReturn(); g.startRun(5); completeRoom(g); g.returnToHub(); assert.equal(g.s.profile.freeGears, 23);
  g.acknowledgeReturn(); g.startRun(6); completeRoom(g); g.returnToHub(); assert.equal(g.s.profile.freeGears, 31);
});
test('save roundtrip preserves RNG, complete combat snapshots and unclaimed choices', () => {
  const g = arena(); inert(g); g.s.run.slots = [{ element: 'ice', level: 1, rarity: 'common' }]; g.castSkill(0, { x: 10, y: 8 }); step(g, 0.05);
  const h = new Game(data, decodeSave(encodeSave(g.s), data));
  assert.deepEqual(h.s, g.s); assert.equal(g.random(), h.random());
  step(g, 0.5); step(h, 0.5); assert.deepEqual(h.s, g.s);
  completeRoom(g); const choices = structuredClone(g.s.run.rewardChoices), gears = g.s.profile.freeGears;
  const resumed = new Game(data, decodeSave(encodeSave(g.s), data));
  assert.deepEqual(resumed.s.run.rewardChoices, choices); resumed.offerRewards(); assert.deepEqual(resumed.s.run.rewardChoices, choices);
  assert.equal(resumed.finishCombat(), false); assert.equal(resumed.s.profile.freeGears, gears); pick(resumed); assert.equal(resumed.chooseReward(0), false);
});
test('twelve-stage completion pays exactly 132 base gears and records bosses only once, ending on the last boss without a reward pick', () => {
  const g = hub(); g.startRun(123); const seen = [], last = data.slice.rooms.length - 1;
  assert.equal(g.s.mode, 'combat');
  for (let node = 0; node <= last; node++) {
    assert.equal(g.s.run.node, node); seen.push(g.room.id);
    if (g.room.kind !== 'shop') {
      const wasBoss = !!g.room.boss;
      completeRoom(g);
      if (wasBoss) assert.equal(g.unwind(), false);
      if (node < last) pick(g, g.room.guaranteedMod ? 'mod' : undefined);
    }
    if (node < last) assert.equal(g.nextNode(0), true);
  }
  assert.equal(new Set(seen).size, 12); assert.equal(g.s.mode, 'complete'); assert.equal(g.s.run.baseGears, 132);
  assert.equal(g.s.profile.combatClears, 11); assert.equal(g.s.profile.bossRecords.length, 2); assert.deepEqual(g.s.profile.blueprints, ['patrolBlueprint']);
  assert.equal(g.s.profile.wins, 1); g.returnToHub('clear'); assert.equal(g.s.profile.firstReturnClaimed, true); assert.equal(g.s.run, null); assert.equal(g.p.energy, 0); assert.equal(g.skillSlots.length, 0);
});
test('a run saved on the old seven-stage route is dropped but permanent progress stays', () => {
  const g = arena(); g.s.profile.freeGears = 77; g.s.run.plan = g.s.run.plan.slice(0, 7);
  const restored = decodeSave(encodeSave(g.s), data);
  assert.equal(restored.run, null); assert.equal(restored.mode, 'hub'); assert.equal(restored.profile.freeGears, 77); assert.deepEqual(restored.enemies, []);
});
test('debug restart returns to the opening and keeps permanent progress', () => {
  const g = arena(); g.s.profile.freeGears = 40; inert(g);
  assert.equal(g.debugRestartTutorial(), true);
  assert.equal(g.s.mode, 'opening'); assert.equal(g.s.run, null); assert.deepEqual(g.s.enemies, []); assert.equal(g.s.profile.freeGears, 40); assert.equal(g.s.profile.registered, false);
  assert.equal(g.beginIntro(), true); assert.equal(g.s.mode, 'intro');
});
test('debug jump enters any stage, with or without a run', () => {
  const g = new Game(data);
  assert.equal(g.debugJump(99), false); assert.equal(g.s.run, null);
  for (const [node, room] of data.slice.rooms.entries()) {
    assert.equal(g.debugJump(node), true); assert.equal(g.s.run.node, node); assert.equal(g.room.id, room.id);
    assert.equal(g.s.mode, room.kind === 'shop' ? 'shop' : 'combat');
    assert.equal(g.s.enemies.length > 0, room.kind !== 'shop', room.id);
  }
  const runs = g.s.profile.runs; g.debugJump(1); assert.equal(g.s.profile.runs, runs);
});
test('shop purchase is atomic, once-per-shop, and persisted across resume', () => {
  const g = arena(); g.s.run.node = 5; g.enterNode(); g.s.run.coins = 100; g.p.hp = 50;
  assert.equal(g.buyShop('heal'), true); assert.equal(g.p.hp, 75); assert.equal(g.s.run.coins, 55);
  const h = new Game(data, decodeSave(encodeSave(g.s), data)); assert.equal(h.buyShop('heal'), false); assert.equal(h.s.run.coins, 55);
  assert.equal(h.buyShop('persistentGears'), false); h.s.run.coins = 60; assert.equal(h.buyShop('persistentGears'), true); assert.equal(h.s.run.coins, 0); assert.equal(h.s.profile.freeGears, 20);
});
test('save parser rejects negative currency, unsupported version and impossible tuning', () => {
  const g = hub(); const raw = JSON.parse(encodeSave(g.s));
  raw.state.profile.freeGears = -1; assert.throws(() => decodeSave(JSON.stringify(raw), data));
  raw.state.profile.freeGears = 0; raw.version = 2; assert.throws(() => decodeSave(JSON.stringify(raw), data));
  raw.version = 1; raw.state.profile.stats.maxHp = 99; assert.throws(() => decodeSave(JSON.stringify(raw), data));
});
test('same seed pre-generates the same thirteen stage layouts and encounters', () => {
  const g = hub(), h = hub(); g.startRun(9813); h.startRun(9813);
  assert.deepEqual(g.s.run.plan, h.s.run.plan);
  const resumed = new Game(data, decodeSave(encodeSave(g.s), data)); assert.deepEqual(resumed.s.run.plan, g.s.run.plan);
});

test('frost crosscut uses two intersecting narrow cuts rather than a full forward cone',()=>{
 const g=arena(),center=inert(g,'guard',{x:10.8,y:8}),off=inert(g,'guard',{x:12,y:10.5});center.hp=center.maxHp=1000;off.hp=off.maxHp=1000;
 g.s.run.slots=['ice','wind'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;assert.equal(g.castFusion(center),true);step(g,.15);assert.equal(center.hp,1000);step(g,.06);assert.equal(center.hp,900);step(g,.2);assert.equal(center.hp,900);assert.equal(off.hp,1000);step(g,.5);assert.equal(center.hp,900);assert.equal(g.p.energy,35);
});

test('frost launch and crossed path hit each enemy only once per blade',()=>{
 const g=arena(),near=inert(g,'guard',{x:8.65,y:7.8}),joint=inert(g,'guard',{x:9.2,y:9.6});
 for(const e of [near,joint])e.hp=e.maxHp=1000;
 g.s.run.slots=['ice','wind'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;g.castFusion({x:13,y:8});step(g,.21);
 assert.equal(near.hp,900);assert.equal(joint.hp,950);
});

test('fire cyclone starts in front of its caster, moves forward and cannot spawn through an obstacle',()=>{
 const g=arena();inert(g,'guard',{x:20,y:14});
 g.s.run.slots=['fire','wind'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;g.castFusion({x:13,y:8});
 const cast=g.s.casts[0];assert.ok(Math.abs(cast.x-10.6)<1e-8);assert.equal(cast.y,8);assert.equal(g.p.x,8);
 step(g,.1);assert.ok(Math.abs(cast.x-10.82)<1e-8);
 const h=arena();h.s.run.plan[0].layout=0;const wall=h.obstacles[0];h.p.x=wall.x-.6;h.p.y=wall.y+wall.h/2;h.p.angle=0;
 h.makeCast(data.combat.fusions.find(f=>f.id==='fireCyclone'),data.slice.fusionBehavior.fireCyclone,{},h.p,true);
 assert.ok(h.s.casts[0].x<=wall.x-.2+1e-8);
});
test('storm float stays at its placement, explodes once after its tell, and never displaces bosses',()=>{
 const g=arena(),enemy=inert(g,'guard',{x:11.2,y:8}),boss=inert(g,'captainBrass',{x:11,y:10});enemy.hp=enemy.maxHp=1000;boss.hp=boss.maxHp=1000;const bx=boss.x,by=boss.y;
 g.s.run.slots=['lightning','wind'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;assert.equal(g.castFusion({x:11,y:8}),true);g.p.x=5;g.p.y=5;step(g,.8);assert.equal(enemy.hp,1000);assert.equal(g.s.casts[0].x,11);assert.equal(g.s.casts[0].y,8);step(g,.1);assert.equal(enemy.hp,892);assert.equal(boss.hp,892);assert.ok(enemy.x>11.7);assert.equal(boss.x,bx);assert.equal(boss.y,by);step(g,.5);assert.equal(enemy.hp,892);assert.equal(g.p.energy,40);
});
test('legacy fusion discoveries migrate without resetting readiness or existing cast snapshots',()=>{
 const g=arena();g.s.profile.discoveredFusions=['blizzardFan','ionFan','frostCrosscut'];g.p.fusionReady=100;g.s.casts=[{skillId:'ionFan',shape:'cone',hits:6,age:.3}];const saved=decodeSave(encodeSave(g.s),data);assert.deepEqual(saved.profile.discoveredFusions,['frostCrosscut','stormFloat']);assert.equal(saved.player.fusionReady,100);assert.equal(saved.casts[0].skillId,'ionFan');assert.equal(saved.casts[0].hits,6);
});

test('orb placement follows an off-axis cursor and clamps to its own range',()=>{
 const g=arena();inert(g,'guard',{x:20,y:12});g.s.run.slots=['lightning','wind'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;g.p.angle=0;g.castFusion({x:8,y:30});assert.equal(g.s.casts[0].x,8);assert.equal(g.s.casts[0].y,14);
});

test('magnetic ice clamp is a fixed oriented target rectangle with a tell and exactly three hits',()=>{
 const g=arena(),center=inert(g,'captainBrass',{x:12,y:8}),outside=inert(g,'guard',{x:13.7,y:9.9});center.hp=center.maxHp=outside.hp=outside.maxHp=1000;
 g.s.run.slots=['ice','lightning'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;assert.equal(g.castFusion({x:12,y:8}),true);
 const cast=g.s.casts[0];assert.equal(cast.shape,'clamp');assert.equal(cast.x,12);assert.equal(cast.y,8);g.p.x=5;g.p.y=5;
 step(g,.55);assert.equal(center.hp,1000);assert.equal(outside.hp,1000);step(g,.07);assert.equal(center.hp,968);step(g,.18);assert.equal(center.hp,936);step(g,.18);assert.equal(center.hp,904);step(g,.5);assert.equal(center.hp,904);assert.equal(outside.hp,1000);assert.equal(center.x,12);assert.equal(center.y,8);assert.equal(g.p.energy,35);assert.equal(g.p.fusionReady,20);
});

test('magnetic ice clamp aims at an off-axis target, limits placement range and migrates ring discoveries',()=>{
 const g=arena();inert(g,'guard',{x:20,y:12});g.s.run.slots=['ice','lightning'].map(element=>({element,level:1,rarity:'common'}));g.p.energy=100;g.p.angle=0;g.castFusion({x:8,y:30});
 const cast=g.s.casts[0];assert.equal(cast.x,8);assert.equal(cast.y,14);assert.equal(cast.angle,Math.PI/2);
 g.s.profile.discoveredFusions=['superconductRing','magneticIceClamp'];g.p.fusionReady=77;g.s.casts=[{skillId:'superconductRing',shape:'self',hits:3,interval:.45,age:.3}];
 const restored=decodeSave(encodeSave(g.s),data);assert.deepEqual(restored.profile.discoveredFusions,['magneticIceClamp']);assert.equal(restored.player.fusionReady,77);assert.equal(restored.casts[0].skillId,'superconductRing');assert.equal(restored.casts[0].interval,.45);
});

test('the opening wake-up holds the world, then hands over a standing player', () => {
  const g = new Game(data); g.beginIntro({ wake: true });
  const [enemy] = g.s.enemies, { x } = g.p;
  assert.ok(g.wakeProgress >= 0 && g.wakeProgress < 0.1);
  step(g, 0.8, { x: 1, basic: true });
  assert.equal(g.p.x, x); assert.equal(g.p.attack, null); assert.ok(g.wakeProgress > 0.4);
  const { x: ex } = enemy; step(g, 0.8, { x: 1 }); assert.equal(enemy.x, ex);
  step(g, 0.2, { x: 1 }); assert.equal(g.wakeProgress, null); assert.ok(g.p.x > x);
  assert.ok(g.s.notices.length > 0);
  const quick = new Game(data); quick.beginIntro(); assert.equal(quick.wakeProgress, null);
});

test('only a save past the opening counts as something to load', () => {
  const g = new Game(data); assert.equal(hasProgress(g.s), false);
  g.beginIntro(); assert.equal(hasProgress(g.s), true);
  const h = new Game(data); h.s.profile.registered = true; assert.equal(hasProgress(h.s), true);
});

test('a clockwork rat runs in and bursts, whether or not the player is still there', () => {
  const g = arena(), rat = g.spawnEnemy('rat', { x: 9, y: 8 });
  rat.ready = 0; step(g, 0.05); assert.equal(rat.tell.type, 'burst');
  const hp = g.p.hp; step(g, 0.5);
  assert.equal(rat.hp, 0); assert.equal(g.p.hp, hp - rat.damage);
  const h = arena(), far = h.spawnEnemy('rat', { x: 9, y: 8 }); far.ready = 0; step(h, 0.05);
  h.p.x = 2; h.p.y = 3; const full = h.p.hp; step(h, 0.5); assert.equal(far.hp, 0); assert.equal(h.p.hp, full);
});

test('a nutcracker takes a fifth of the damage in front, and full damage behind or after it swings', () => {
  const g = arena(), nut = inert(g, 'nutcracker', { x: 9, y: 8 });
  nut.hp = nut.maxHp = 1e4; nut.facing = Math.PI; g.p.x = 7; g.p.y = 8; g.rollCrit = () => false;
  const blow = () => { const before = nut.hp; g.hitEnemy(nut, 100); return before - nut.hp; };
  const front = blow(); nut.facing = 0; const back = blow();
  assert.ok(Math.abs(front / back - 0.2) < 1e-9);
  nut.facing = Math.PI; nut.state = 'recover'; nut.ready = g.s.time + 1; assert.ok(Math.abs(blow() - back) < 1e-9);
});

test('every melee enemy can reach a player who stands still', () => {
  for (const [type, enemy] of Object.entries(data.slice.enemies)) {
    if (type === 'dummy' || enemy.attack === 'shot') continue;
    assert.ok(enemy.attackRange > data.slice.rules.enemyStopDistance.melee, type);
  }
  const g = arena(), rat = g.spawnEnemy('rat', { x: 15, y: 8 }), hp = g.p.hp;
  g.p.x = 8; g.p.y = 8; step(g, 4);
  assert.equal(rat.hp, 0); assert.equal(g.p.hp, hp - rat.damage);
});

test('every combat room runs two or three waves of fifteen to twenty-four enemies, and gets harder as it goes', () => {
  const rooms = data.slice.rooms.filter(room => room.waves), weight = room => room.waves.flat().reduce((sum, type) => sum + data.slice.enemies[type].hp, 0) * room.power;
  assert.equal(rooms.length, 9);
  for (const room of rooms) {
    assert.ok(room.waves.length >= 2 && room.waves.length <= 3, room.id);
    const count = room.waves.flat().length; assert.ok(count >= 15 && count <= 24, room.id);
  }
  for (let i = 1; i < rooms.length; i++) assert.ok(weight(rooms[i]) > weight(rooms[i - 1]), rooms[i].id);
});

test('the next wave is warned about, arrives when one enemy is left, and only the last one clears the room', () => {
  const g = hub(); g.startRun(11); const { waves, power } = g.room;
  assert.equal(g.s.enemies.length, waves[0].length); assert.equal(g.s.enemies[0].maxHp, Math.round(data.slice.enemies.guard.hp * power)); assert.equal(g.s.enemies[0].damage, Math.round(data.slice.enemies.guard.damage * power * data.slice.rules.waveDamageShare));
  g.s.enemies.forEach(e => { e.ready = 1e9; });
  g.s.enemies.slice(0, -2).forEach(e => { e.hp = 0; }); step(g, 0.1); assert.equal(g.s.run.wave, 0);
  g.s.enemies.at(-2).hp = 0; step(g, 0.1); assert.equal(g.s.run.wave, 1);
  assert.equal(g.s.run.arrivals.length, waves[1].length);
  const before = g.s.enemies.length; step(g, 1); assert.equal(g.s.enemies.length, before + waves[1].length); assert.equal(g.s.run.arrivals.length, 0);
  for (const e of g.s.enemies) e.hp = 0;
  step(g, 0.1); assert.equal(g.s.run.wave, 2); step(g, 1.1); assert.equal(g.s.mode, 'combat');
  for (const e of g.s.enemies) e.hp = 0;
  step(g, 1.2); assert.equal(g.s.mode, 'reward');
});

test('a run saved before waves existed can finish the room it is in', () => {
  const g = hub(); g.startRun(5); delete g.s.run.wave; delete g.s.run.arrivals;
  const resumed = new Game(data, g.s);
  for (const e of resumed.s.enemies) e.hp = 0;
  step(resumed, 1.2); assert.equal(resumed.s.mode, 'reward');
});
