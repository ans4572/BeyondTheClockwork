import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { decodeSave, encodeSave } from '../src/engine/storage.js';

const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));
const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60, input); };
const arena = (elements = ['fire', 'ice']) => {
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711); g.s.enemies = []; if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.s.run.plan[0].layout = 2;
  g.s.run.slots = elements.map(element => ({ element, level: 1, rarity: 'common' })); g.p.x = 8; g.p.y = 8; g.p.angle = 0; return g;
};
const dummy = (g, x = 9, y = 8, type = 'guard') => { const e = g.spawnEnemy(type, { x, y }); e.ready = 1e9; e.speed = 0; e.hp = e.maxHp = 1e4; return e; };
const cast = (g, id, target = { x: 11, y: 8 }) => { const skill = data.combat.skills.find(s => s.id === id); g.makeCast(skill, data.slice.skillBehavior[id], g.slots[0] || { level: 1, rarity: 'common' }, target, false); return g.s.casts.at(-1); };
const swing = (g, phase) => { g.p.combo = phase; g.p.comboExpires = g.s.time + 9; g.basicAttack(); step(g, 0.6); };

test('every skill has one mod, and every element has two traits', () => {
  for (const skill of data.combat.skills) assert.equal(data.slice.skillMods.filter(m => m.skill === skill.id).length, 1, skill.id);
  for (const element of data.combat.elements) assert.equal(data.slice.elementTraits.filter(t => t.element === element.id).length, 2, element.id);
  assert.equal(data.slice.mods.length, 8);
  assert.deepEqual(data.slice.rooms.filter(r => r.guaranteedMod).map(r => r.id), ['stop-04', 'stop-10']);
});

test('rewards after the opening always include the equipped build and nothing for other elements', () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = arena(); g.s.rng = seed; g.s.run.clears = ['a', 'b', 'c']; g.s.run.node = 3; g.s.run.rewardChoices = [];
    g.offerRewards();
    const choices = g.s.run.rewardChoices;
    assert.equal(choices.length, 3); assert.equal(new Set(choices.map(c => `${c.kind}:${c.id}`)).size, 3);
    assert.ok(choices.some(c => ['skillMod', 'trait'].includes(c.kind)));
    assert.ok(choices.every(c => c.kind !== 'upgrade' && c.kind !== 'gears'));
    for (const c of choices) {
      if (c.kind === 'skillMod') assert.ok(['heatSwing', 'exhaustBurst', 'frostBolt', 'coolingField'].includes(data.slice.skillMods.find(m => m.id === c.id).skill));
      if (c.kind === 'trait') assert.ok(['fire', 'ice'].includes(data.slice.elementTraits.find(t => t.id === c.id).element));
    }
  }
});

test('owned rewards leave the pool, and gears fill in only when it runs dry', () => {
  const g = arena(); g.s.run.clears = ['a', 'b', 'c']; g.s.run.node = 3;
  g.s.run.skillMods = data.slice.skillMods.map(m => m.id); g.s.run.traits = data.slice.elementTraits.map(t => t.id);
  g.s.run.slots.forEach(slot => { slot.level = 5; });
  g.offerRewards();
  assert.ok(g.s.run.rewardChoices.every(c => c.kind === 'element' || c.kind === 'gears'));
  assert.ok(g.s.run.rewardChoices.some(c => c.kind === 'gears'));
});

test('both wrench rooms offer three random mods without repeats', () => {
  const g = arena(); g.s.run.node = 2; g.offerRewards();
  const first = g.s.run.rewardChoices; assert.equal(first.length, 3); assert.ok(first.every(c => c.kind === 'mod'));
  assert.equal(g.chooseReward(0), true);
  g.s.mode = 'combat'; g.s.run.node = 8; g.offerRewards();
  assert.ok(g.s.run.rewardChoices.every(c => c.kind === 'mod' && c.id !== first[0].id));
});

test('chosen mods and traits persist through a save and are validated', () => {
  const g = arena(); g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'skillMod', id: 'overload' }]; assert.equal(g.chooseReward(0), true);
  g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'trait', id: 'quickFreeze' }]; assert.equal(g.chooseReward(0), true);
  const restored = decodeSave(encodeSave(g.s), data);
  assert.deepEqual(restored.run.skillMods, ['overload']); assert.deepEqual(restored.run.traits, ['quickFreeze']);
  const raw = JSON.parse(encodeSave(g.s)); raw.state.run.rewardChoices = [{ kind: 'trait', id: 'fake' }];
  assert.throws(() => decodeSave(JSON.stringify(raw), data));
});

test('overload refunds the cooldown once per cast when the swing lands a burn, and not on a miss', () => {
  const input = { aim: { x: 9, y: 8 }, skill: 0 };
  const g = arena(); const e = dummy(g); g.update(1 / 60, input); const plain = g.p.cooldowns.heatSwing;
  const h = arena(); h.s.run.skillMods = ['overload']; const f = dummy(h), far = dummy(h, 9, 8.4);
  h.update(1 / 60, input); assert.ok(Math.abs(plain - h.p.cooldowns.heatSwing - 2) < 1e-6); assert.ok(e.hp < e.maxHp && f.burnStacks.length && far.burnStacks.length);
  const miss = arena(); miss.s.run.skillMods = ['overload']; miss.update(1 / 60, input); assert.ok(Math.abs(miss.p.cooldowns.heatSwing - plain) < 1e-6);
});

test('backflow pushes normal enemies on the last blast, never bosses', () => {
  const g = arena(); g.s.run.skillMods = ['backflow']; const e = dummy(g, 9.5), boss = dummy(g, 7, 8, 'collectorRoco'), x = e.x, bx = boss.x;
  cast(g, 'exhaustBurst'); step(g, 0.6);
  assert.ok(e.x > x + 1); assert.equal(boss.x, bx);
});

test('piercing bolts pass through and hit each enemy once', () => {
  const g = arena(); g.s.run.skillMods = ['piercingBolt']; const near = dummy(g, 10), far = dummy(g, 12);
  cast(g, 'frostBolt'); step(g, 0.5);
  assert.ok(near.hp < near.maxHp && far.hp < far.maxHp);
  const h = arena(); dummy(h, 10); const blocked = dummy(h, 12); cast(h, 'frostBolt'); step(h, 0.5);
  assert.equal(blocked.hp, blocked.maxHp);
});

test('flash freeze and quick freeze reach a freeze sooner', () => {
  const stunAfter = (setup, hits) => { const g = arena(); setup(g); const e = dummy(g), c = { id: 'x', staggerUsed: {}, fusion: false, chillBonus: g.s.run.skillMods.length ? 1 : 0 }; for (let i = 0; i < hits; i++) { g.s.time += 1; g.applyStatus(e, 'ice', c); } return e.stunUntil > g.s.time; };
  assert.equal(stunAfter(() => {}, 2), false); assert.equal(stunAfter(() => {}, 3), true);
  assert.equal(stunAfter(g => { g.s.run.skillMods = ['flashFreeze']; }, 2), true);
  assert.equal(stunAfter(g => { g.s.run.traits = ['quickFreeze']; }, 2), true);
});

test('overcurrent chains to two more enemies', () => {
  const hits = mods => { const g = arena(['lightning', 'wind']); g.s.run.skillMods = mods; const list = [dummy(g, 9), dummy(g, 9.5, 8.5), dummy(g, 9.5, 7.5), dummy(g, 10, 8.8), dummy(g, 10, 7.2)]; cast(g, 'conductiveSpanner'); step(g, 0.1); return list.filter(e => e.hp < e.maxHp).length; };
  assert.equal(hits([]), 3); assert.equal(hits(['overcurrent']), 5);
});

test('homing strike lands on a nearby enemy', () => {
  const g = arena(['lightning', 'wind']); g.s.run.skillMods = ['homingStrike']; const e = dummy(g, 14, 8);
  cast(g, 'capacitorStrike', { x: 11, y: 8 }); step(g, 0.7);
  assert.ok(e.hp < e.maxHp);
  const h = arena(['lightning', 'wind']), missed = dummy(h, 14, 8); cast(h, 'capacitorStrike', { x: 11, y: 8 }); step(h, 0.7);
  assert.equal(missed.hp, missed.maxHp);
});

test('double dash grants one free recast inside the window', () => {
  const g = arena(['wind', 'fire']); g.s.run.skillMods = ['doubleDash']; const input = { aim: { x: 20, y: 8 }, skill: 0 };
  g.update(1 / 60, input); const cooldown = g.p.cooldowns.pressureDash;
  step(g, 0.3); g.update(1 / 60, input); assert.ok(g.s.casts.some(c => c.shape === 'dash')); assert.equal(g.p.cooldowns.pressureDash, cooldown);
  step(g, 0.3); g.update(1 / 60, input); assert.ok(!g.s.casts.some(c => c.shape === 'dash'));
});

test('the vortex drifts toward the aim', () => {
  const g = arena(['wind', 'fire']); g.s.run.skillMods = ['driftingVortex']; const c = cast(g, 'vortexIntake'), x = c.x; g.updateCasts(0.5);
  assert.ok(Math.abs(c.x - x - 0.6) < 1e-6);
});

test('fire traits: more stacks, and basic hits punish burning enemies', () => {
  const g = arena(); g.s.run.traits = ['emberStacks']; const e = dummy(g), c = { id: 'a', staggerUsed: {} };
  for (let i = 0; i < 6; i++) { g.s.time += 0.3; g.applyStatus(e, 'fire', c); }
  assert.equal(e.burnStacks.length, 5);
  const burn = data.combat.statuses.find(s => s.id === 'burn'); assert.ok(Math.abs(Math.max(...e.burnStacks) - g.s.time - burn.duration - 2) < 1e-9);
  const h = arena(); h.s.run.traits = ['burnBrand']; const f = dummy(h), base = h.damageMultiplier(f, true); f.burnStacks = [h.s.time + 2];
  assert.ok(Math.abs(h.damageMultiplier(f, true) - base * 1.15) < 1e-9); assert.equal(h.damageMultiplier(f, false), h.damageMultiplier(dummy(h), false));
});

test('cold reap refunds cooldowns on a chilled kill', () => {
  const g = arena(); g.s.run.traits = ['coldReap']; const e = dummy(g); e.hp = 1; e.statuses.chill = g.s.time + 2; g.p.cooldowns.frostBolt = 10;
  g.hitEnemy(e, 50); assert.equal(g.p.cooldowns.frostBolt, 9);
});

test('lightning traits: wider discharge, and energy from shocked targets', () => {
  const g = arena(['lightning', 'wind']); g.s.run.traits = ['arcRange']; const e = dummy(g), near = dummy(g, 11.2, 8); e.statuses.shock = g.s.time + 2; g.triggerShock(e);
  assert.ok(near.hp < near.maxHp);
  const h = arena(['lightning', 'wind']); h.s.run.traits = ['staticCharge']; const f = dummy(h); f.statuses.shock = h.s.time + 2; swing(h, 0);
  assert.equal(h.p.energy, 12);
});

test('wind traits: dodging past applies pressure, and gale holds enemies longer', () => {
  const g = arena(['wind', 'fire']); g.s.run.traits = ['slipstream']; const e = dummy(g, 9, 8);
  g.p.moveAngle = 0; g.update(1 / 60, { dodge: true, x: 1 }); step(g, 0.2, { x: 1 });
  assert.ok(e.statuses.windPressure > g.s.time);
  const h = arena(['wind', 'fire']); h.s.run.traits = ['galeHold']; const f = dummy(h); f.statuses.windPressure = h.s.time + 2; h.hitEnemy(f, 1, { stagger: 1 });
  assert.ok(Math.abs(f.stunUntil - h.s.time - data.slice.rules.normalHitStun * data.slice.elementTraits.find(t => t.id === 'galeHold').stunMultiplier) < 1e-9);
});

test('long wrench reaches further', () => {
  const reach = mods => { const g = arena(); g.s.run.mods = mods; const e = dummy(g, 9.95 + 0.4); e.radius = 0.4; swing(g, 0); return e.hp < e.maxHp; };
  assert.equal(reach([]), false); assert.equal(reach(['longWrench']), true);
});

test('dash strike empowers only the first hit inside its window', () => {
  const g = arena(); g.s.run.mods = ['dashStrike']; const e = dummy(g); g.dodge(); step(g, 0.2); swing(g, 0);
  const first = e.maxHp - e.hp; g.s.time += 2; g.p.attack = null; const before = e.hp; swing(g, 0);
  assert.ok(Math.abs(first - (before - e.hp) * 1.5) < 1e-6);
});

test('elemental charge applies every slotted status on the third hit only', () => {
  const g = arena(); g.s.run.mods = ['elementalCharge']; const e = dummy(g); swing(g, 0);
  assert.equal(e.burnStacks.length, 0); swing(g, 2);
  assert.equal(e.burnStacks.length, 1); assert.ok(e.statuses.chill > g.s.time);
});

test('scrap harvest speeds attacks after a kill', () => {
  const g = arena(); g.s.run.mods = ['scrapHarvest']; const e = dummy(g); e.hp = 1; g.hitEnemy(e, 50);
  g.basicAttack(); g.updateBasic(0.1); assert.ok(Math.abs(g.p.attack.elapsed - 0.12) < 1e-9);
});

test('windup recoil readies the dodge on a third-hit connection', () => {
  const g = arena(); g.s.run.mods = ['windupRecoil']; dummy(g); g.p.dodgeReady = g.s.time + 50; swing(g, 2);
  assert.ok(g.p.dodgeReady <= g.s.time);
});

test('the shockwave reaches enemies the third swing does not', () => {
  const g = arena(), behind = dummy(g, 6, 8); g.s.run.mods = ['shockwave'];
  dummy(g); swing(g, 2);
  assert.equal(behind.maxHp - behind.hp, data.slice.mods.find(m => m.id === 'shockwave').damage);
  const h = arena(), still = dummy(h, 6, 8); dummy(h); swing(h, 2); assert.equal(still.hp, still.maxHp);
});

test('deflect turns a bullet round on every swing, a little beyond the wrench', () => {
  const shot = (mods, phase) => {
    const g = arena(), trumpet = dummy(g, 14, 8, 'trumpet'); g.s.run.mods = mods;
    g.p.combo = phase; g.p.comboExpires = g.s.time + 9; g.basicAttack();
    g.fireBullet(trumpet, Math.PI, 5.5); g.s.projectiles.at(-1).x = g.p.x + 2.1;
    step(g, 1.5); return [trumpet.maxHp - trumpet.hp, g.p.hp === g.p.maxHp];
  };
  assert.deepEqual(shot(['deflect'], 1), [data.slice.mods.find(m => m.id === 'deflect').reflectedDamage, true]);
  assert.deepEqual(shot([], 1), [0, false]);
  assert.deepEqual(shot(['deflect'], 0), [data.slice.mods.find(m => m.id === 'deflect').reflectedDamage, true]);
});

test('the light grip shortens only the third recovery', () => {
  const recovery = (mods, phase) => { const g = arena(); g.s.run.mods = mods; g.p.combo = phase; g.p.comboExpires = g.s.time + 9; g.basicAttack(); return g.p.attack.recovery; };
  const { recoveryReduction } = data.slice.mods.find(m => m.id === 'quickThird');
  assert.ok(Math.abs(recovery([], 2) - recovery(['quickThird'], 2) - recoveryReduction) < 1e-9);
  assert.equal(recovery([], 1), recovery(['quickThird'], 1));
});
