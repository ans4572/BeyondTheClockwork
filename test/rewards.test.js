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

const madeElements = data.combat.elements;
test('every element offers as many element cards (skill mods and traits) as every other', () => {
  for (const skill of data.combat.skills.filter(s => madeElements.some(e => e.id === s.element))) assert.ok([1, 2].includes(data.slice.skillMods.filter(m => m.skill === skill.id).length), skill.id);
  const traits = madeElements.map(element => data.slice.elementTraits.filter(t => t.element === element.id).length);
  assert.ok(traits.every(n => n === traits[0]), `traits per element: ${traits}`);
  const cards = madeElements.map(element => data.slice.skillMods.filter(m => data.combat.skills.find(s => s.id === m.skill).element === element.id).length + data.slice.elementTraits.filter(t => t.element === element.id).length);
  assert.ok(cards.every(n => n === cards[0]), `element cards per element: ${cards}`);
  assert.equal(data.slice.mods.length, 8);
  assert.deepEqual(data.slice.rooms.filter(r => r.guaranteedMod).map(r => r.id), ['stop-04', 'stop-10']);
});

test('rewards always include the equipped build, nothing for other elements, and no element trials', () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = arena(); g.s.rng = seed; g.s.run.clears = ['a', 'b', 'c']; g.s.run.node = 3; g.s.run.rewardChoices = [];
    g.offerRewards();
    const choices = g.s.run.rewardChoices;
    assert.equal(choices.length, 3); assert.equal(new Set(choices.map(c => `${c.kind}:${c.id}`)).size, 3);
    assert.ok(choices.some(c => ['skillMod', 'trait'].includes(c.kind)));
    assert.ok(choices.every(c => c.kind !== 'element'));
    for (const c of choices) {
      if (c.kind === 'skillMod') assert.ok(['heatSwing', 'exhaustBurst', 'frostBolt', 'coolingField'].includes(data.slice.skillMods.find(m => m.id === c.id).skill));
      if (c.kind === 'trait') assert.ok(['fire', 'ice'].includes(data.slice.elementTraits.find(t => t.id === c.id).element));
    }
  }
});

test('owned rewards leave the pool; parts fill in, and repairs only come while the body is damaged', () => {
  const g = arena(); g.s.run.clears = ['a', 'b', 'c']; g.s.run.node = 3;
  g.s.run.skillMods = data.slice.skillMods.map(m => m.id); g.s.run.traits = data.slice.elementTraits.map(t => t.id);
  g.s.run.slots.forEach(slot => { slot.level = data.combat.balance.skillMaxLevel; });
  g.offerRewards();
  assert.equal(g.s.run.rewardChoices.length, 3); assert.ok(g.s.run.rewardChoices.every(c => ['upgrade', 'gears', 'perk'].includes(c.kind)));
  g.p.hp = 20; assert.ok(g.partRewards().some(c => c.kind === 'heal')); g.p.hp = g.p.maxHp; assert.ok(!g.partRewards().some(c => c.kind === 'heal'));
});

test('a repair card heals by its amount, and a skill reaches at most three levels above its start', () => {
  const g = arena(); g.p.hp = 10; g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'heal', id: 'patch' }]; assert.equal(g.chooseReward(0), true); assert.equal(g.p.hp, 10 + data.slice.rules.healRewards[0].amount);
  assert.equal(data.combat.balance.skillMaxLevel, 4);
  for (let i = 0; i < 5; i++) { g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'level', id: 0 }]; g.chooseReward(0); }
  assert.equal(g.slots[0].level, 4); assert.ok(!g.partRewards().some(c => c.kind === 'level' && c.id === 0));
});

test('every card has a tier, and cards are drawn by tier weight', () => {
  const g = arena(), tiers = { common: 0, rare: 0, special: 0 };
  const all = [...data.slice.mods.map(m => ({ kind: 'mod', id: m.id })), ...data.slice.skillMods.map(m => ({ kind: 'skillMod', id: m.id })), ...data.slice.elementTraits.map(t => ({ kind: 'trait', id: t.id })), ...Object.keys(data.slice.rewards).map(id => ({ kind: 'upgrade', id })), ...data.slice.rules.healRewards.map(h => ({ kind: 'heal', id: h.id })), { kind: 'level', id: 0 }, { kind: 'gears', amount: 12 }];
  for (const card of all) assert.ok(['common', 'rare', 'special'].includes(g.rewardTier(card)), `${card.kind}:${card.id}`);
  for (let i = 0; i < 2000; i++) tiers[g.rewardTier(g.drawByTier(all))]++;
  assert.ok(tiers.common > tiers.rare && tiers.rare > tiers.special && tiers.special > 0);
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
  g.s.mode = 'reward'; g.s.run.rewardChoices = [{ kind: 'trait', id: 'frostCrack' }]; assert.equal(g.chooseReward(0), true);
  const restored = decodeSave(encodeSave(g.s), data);
  assert.deepEqual(restored.run.skillMods, ['overload']); assert.deepEqual(restored.run.traits, ['frostCrack']);
  // A trait since cut (2026-11-08) becomes another trait of its element in a saved run, and on the reward table.
  const old = JSON.parse(encodeSave(g.s));
  old.state.run.traits = ['quickFreeze', 'emberSpread']; old.state.run.picks = [{ node: 0, kind: 'trait', id: 'quickFreeze' }, { node: 1, kind: 'trait', id: 'emberSpread' }];
  old.state.run.rewardChoices = [{ kind: 'trait', id: 'dodgeGust' }, { kind: 'trait', id: 'slipstream' }];
  let loaded = decodeSave(JSON.stringify(old), data);
  // The same tier first: quick freeze was special (frozen cracks), spreading embers rare (the burn brand).
  assert.deepEqual(loaded.run.traits, ['frostCrack', 'burnBrand']);
  assert.deepEqual(loaded.run.picks.map(p => p.id), ['frostCrack', 'burnBrand']);
  // The wind card cannot become the gust already on the table, so it is the other wind trait.
  assert.deepEqual(loaded.run.rewardChoices.map(r => r.id), ['galeHold', 'slipstream']);
  // A run that already holds both ice traits has nothing to swap in: the cut one just drops out.
  old.state.run.traits = ['frostCrack', 'coldReap', 'quickFreeze']; old.state.run.picks = []; old.state.run.rewardChoices = [];
  loaded = decodeSave(JSON.stringify(old), data);
  assert.deepEqual(loaded.run.traits, ['frostCrack', 'coldReap']);
  const raw = JSON.parse(encodeSave(g.s)); raw.state.run.rewardChoices = [{ kind: 'trait', id: 'fake' }];
  assert.throws(() => decodeSave(JSON.stringify(raw), data));
});

test('overload refunds the cooldown once per cast when the swing lands a burn, and not on a miss', () => {
  const input = { aim: { x: 9, y: 8 }, skill: 0 };
  const g = arena(); g.p.energy = 100; const e = dummy(g); g.update(1 / 60, input); const plain = g.p.cooldowns.heatSwing;
  const h = arena(); h.p.energy = 100; h.s.run.skillMods = ['overload']; const f = dummy(h), far = dummy(h, 9, 8.4);
  h.update(1 / 60, input); assert.ok(Math.abs(plain - h.p.cooldowns.heatSwing - 2) < 1e-6); assert.ok(e.hp < e.maxHp && f.burnStacks.length && far.burnStacks.length);
  const miss = arena(); miss.p.energy = 100; miss.s.run.skillMods = ['overload']; miss.update(1 / 60, input); assert.ok(Math.abs(miss.p.cooldowns.heatSwing - plain) < 1e-6);
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

test('flash freeze reaches a freeze sooner', () => {
  const stunAfter = (setup, hits) => { const g = arena(); setup(g); const e = dummy(g), c = { id: 'x', staggerUsed: {}, fusion: false, chillBonus: g.s.run.skillMods.length ? 1 : 0 }; for (let i = 0; i < hits; i++) { g.s.time += 1; g.applyStatus(e, 'ice', c); } return e.stunUntil > g.s.time; };
  assert.equal(stunAfter(() => {}, 2), false); assert.equal(stunAfter(() => {}, 3), true);
  assert.equal(stunAfter(g => { g.s.run.skillMods = ['flashFreeze']; }, 2), true);
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
  const g = arena(['wind', 'fire']); g.p.energy = 100; g.s.run.skillMods = ['doubleDash']; const input = { aim: { x: 20, y: 8 }, skill: 0 };
  g.update(1 / 60, input); const cooldown = g.p.cooldowns.pressureDash;
  step(g, 0.3); g.update(1 / 60, input); assert.ok(g.s.casts.some(c => c.shape === 'dash')); assert.equal(g.p.cooldowns.pressureDash, cooldown);
  step(g, 0.3); g.update(1 / 60, input); assert.ok(!g.s.casts.some(c => c.shape === 'dash'));
});

test('the vortex drifts toward the aim', () => {
  const g = arena(['wind', 'fire']); g.s.run.skillMods = ['driftingVortex']; const c = cast(g, 'vortexIntake'), x = c.x; g.updateCasts(0.5);
  assert.ok(Math.abs(c.x - x - 0.6) < 1e-6);
});

test('fire traits: deeper embers burn twice as hard and longer, and basic hits punish burning enemies', () => {
  const burnt = traits => { const g = arena(); g.s.run.traits = traits; const e = dummy(g), c = { id: 'a', staggerUsed: {} }; for (let i = 0; i < 6; i++) { g.s.time += 0.3; g.applyStatus(e, 'fire', c); } return { g, e }; };
  const deep = burnt(['emberStacks']), plain = burnt([]);
  assert.equal(deep.e.burnStacks.length, 3, 'the stack cap is unchanged');
  const burn = data.combat.statuses.find(s => s.id === 'burn'); assert.ok(Math.abs(Math.max(...deep.e.burnStacks) - deep.g.s.time - burn.duration - 2) < 1e-9);
  step(deep.g, 1); step(plain.g, 1);
  assert.ok(Math.abs((deep.e.maxHp - deep.e.hp) / (plain.e.maxHp - plain.e.hp) - 2) < 1e-6, 'twice the burn');
  const h = arena(); h.s.run.traits = ['burnBrand']; const f = dummy(h), base = h.damageMultiplier(f, true); f.burnStacks = [h.s.time + 2];
  assert.ok(Math.abs(h.damageMultiplier(f, true) - base * 1.15) < 1e-9); assert.equal(h.damageMultiplier(f, false), h.damageMultiplier(dummy(h), false));
});

test('cold reap refunds cooldowns on a chilled kill', () => {
  const g = arena(); g.s.run.traits = ['coldReap']; const e = dummy(g); e.hp = 1; e.statuses.chill = g.s.time + 2; g.p.cooldowns.frostBolt = 10;
  g.hitEnemy(e, 50); assert.equal(g.p.cooldowns.frostBolt, 9);
});

test('lightning traits: energy from shocked targets', () => {
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
  const reach = mods => { const g = arena(); g.s.run.mods = mods; const e = dummy(g, 9.95 + 0.7 + 0.25); e.radius = 0.4; swing(g, 0); return e.hp < e.maxHp; };
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


test('the shockwave reaches enemies the third swing does not', () => {
  const g = arena(), behind = dummy(g, 6, 8); g.s.run.mods = ['shockwave'];
  dummy(g); swing(g, 2);
  assert.equal(behind.maxHp - behind.hp, data.slice.mods.find(m => m.id === 'shockwave').damage);
  const h = arena(), still = dummy(h, 6, 8); dummy(h); swing(h, 2); assert.equal(still.hp, still.maxHp);
});

test('deflect turns a bullet round on every swing, a little beyond the wrench, for what it would have done to F2', () => {
  const shot = (mods, phase, armour = 0) => {
    const g = arena(), trumpet = dummy(g, 14, 8, 'trumpet'); g.s.run.mods = mods; g.s.run.upgrades.basicDamage = 4; g.s.profile.stats.damageReduction = armour;
    g.p.combo = phase; g.p.comboExpires = g.s.time + 9; g.basicAttack();
    g.fireBullet(trumpet, Math.PI, 5.5); g.s.projectiles.at(-1).x = g.p.x + 2.1;
    step(g, 1.5); return [trumpet.maxHp - trumpet.hp, g.p.hp === g.p.maxHp];
  };
  const bullet = dummy(arena(), 14, 8, 'trumpet').damage;
  assert.deepEqual(shot(['deflect'], 1), [bullet, true], 'the wrench bonus does not apply');
  assert.deepEqual(shot([], 1), [0, false]);
  assert.deepEqual(shot(['deflect'], 0), [bullet, true]);
  const [armoured] = shot(['deflect'], 0, 5), cut = data.slice.permanentStats.find(s => s.id === 'damageReduction').perRank * 5;
  assert.ok(Math.abs(armoured - bullet * (1 - cut)) < 1e-9, 'the same number F2 would lose');
});

test('the light grip shortens only the third recovery', () => {
  const recovery = (mods, phase) => { const g = arena(); g.s.run.mods = mods; g.p.combo = phase; g.p.comboExpires = g.s.time + 9; g.basicAttack(); return g.p.attack.recovery; };
  const { recoveryReduction } = data.slice.mods.find(m => m.id === 'quickThird');
  assert.ok(Math.abs(recovery([], 2) - recovery(['quickThird'], 2) - recoveryReduction) < 1e-9);
  assert.equal(recovery([], 1), recovery(['quickThird'], 1));
});

// Mods that change how a skill works, not just its numbers.
test('ember trail leaves three fire patches that keep burning where the swing went', () => {
  const g = arena(); g.s.run.skillMods = ['emberTrail']; const e = dummy(g, 9.4, 8);
  cast(g, 'heatSwing'); assert.equal(g.s.casts.filter(c => c.shape === 'patch').length, 3);
  const after = () => e.hp; step(g, 0.2); const once = after(); step(g, 1.6); assert.ok(after() < once, 'the patches keep hurting');
});
test('exhaust trail bursts where the player stood, not where they are', () => {
  const g = arena(); g.s.run.skillMods = ['exhaustTrail']; const e = dummy(g, 8, 8); e.radius = 0.4;
  cast(g, 'exhaustBurst'); g.p.x = 14; const hp = e.hp; step(g, 0.05); assert.ok(e.hp < hp, 'the first burst goes off at the start');
});
test('frost shards break off a hit bolt and reach an enemy beside it', () => {
  const g = arena(['ice', 'fire']); g.s.run.skillMods = ['frostShards']; const front = dummy(g, 10, 8), side = dummy(g, 10.9, 9.4);
  cast(g, 'frostBolt'); step(g, 0.6); assert.ok(front.hp < front.maxHp); assert.ok(side.hp < side.maxHp, 'a shard reaches the side');
});
test('delayed discharge strikes one enemy now and bursts on everyone near it three seconds later', () => {
  const g = arena(['lightning', 'fire']); g.s.run.skillMods = ['delayedDischarge']; const first = dummy(g, 9.5, 8), near = dummy(g, 10.5, 8.6);
  cast(g, 'conductiveSpanner'); step(g, 0.3); assert.ok(first.hp < first.maxHp); assert.equal(near.hp, near.maxHp, 'no instant chain');
  step(g, 3); assert.ok(near.hp < near.maxHp, 'the charge bursts');
});
test('piercing dash goes through enemies and leaves them behind the player', () => {
  const g = arena(['wind', 'fire']); g.s.run.skillMods = ['piercingDash']; const e = dummy(g, 9.2, 8);
  cast(g, 'pressureDash', { x: 20, y: 8 }); step(g, 0.4); assert.ok(e.hp < e.maxHp); assert.ok(e.x < g.p.x, 'pulled behind the player');
});
test('a run takes only one mod per skill', () => {
  const g = arena(); g.s.run.skillMods = ['overload'];
  assert.ok(!g.buildRewards().some(r => r.kind === 'skillMod' && data.slice.skillMods.find(m => m.id === r.id).skill === 'heatSwing'));
});

test('every reward picked on a run is written down in order, with the stop it was taken at', () => {
  const g = arena(); g.s.run.node = 2; g.s.mode = 'reward';
  g.s.run.rewardChoices = [{ kind: 'heal', id: 'patch' }]; g.p.hp = 10; assert.ok(g.chooseReward(0));
  g.s.mode = 'reward'; g.s.run.node = 4; g.s.run.rewardChoices = [{ kind: 'level', id: 0 }]; assert.ok(g.chooseReward(0));
  assert.deepEqual(g.s.run.picks.map(p => [p.node, p.kind, p.id]), [[2, 'heal', 'patch'], [4, 'level', 0]]);
  assert.equal(g.s.run.picks[1].element, g.slots[0].element);
});

test('backflow pushes after the last blast lands, so the blast it pushes with still hits', () => {
  const g = arena(); g.s.run.skillMods = ['backflow']; const e = dummy(g, 9.8, 8);
  cast(g, 'exhaustBurst'); step(g, 1);
  assert.ok(e.maxHp - e.hp >= 54, `all three blasts landed: ${e.maxHp - e.hp}`); assert.ok(e.x > 10.5, 'and it was thrown');
});

test('wind pressure: the wrench throws a pressed body half again as far and stuns it half again as long', () => {
  const moved = pressed => { const g = arena(['wind', 'fire']), e = dummy(g); if (pressed) e.statuses.windPressure = g.s.time + 4; swing(g, 0); return e.x - 9; };
  const dry = moved(false), wet = moved(true);
  assert.ok(Math.abs(wet / dry - 1.5) < 0.15, `${wet} vs ${dry}`);
  const g = arena(['wind', 'fire']), e = dummy(g); e.statuses.windPressure = g.s.time + 4;
  g.hitEnemy(e, 1, { stagger: 1 }); assert.ok(Math.abs(e.stunUntil - g.s.time - g.config.rules.normalHitStun * 1.5) < 1e-9);
  g.s.run.traits = ['galeHold']; g.hitEnemy(e, 1, { stagger: 1 }); assert.ok(Math.abs(e.stunUntil - g.s.time - g.config.rules.normalHitStun * 3) < 1e-9);
});

test('wind pressure slam: a pressed body driven into another body hurts and stuns both, once', () => {
  const g = arena(['wind', 'fire']), a = dummy(g, 9, 8), b = dummy(g, 9.6, 8), info = data.combat.statuses.find(s => s.id === 'windPressure');
  a.statuses.windPressure = g.s.time + 4;
  g.pushEnemy(a, 0.3, 0);
  assert.ok(a.hp < a.maxHp && b.hp < b.maxHp, 'both bodies take the slam');
  assert.ok(a.stunUntil >= g.s.time + info.slamStun - 1e-9 && b.stunUntil >= g.s.time + info.slamStun - 1e-9);
  const hp = a.hp; g.pushEnemy(a, 0.3, 0); assert.equal(a.hp, hp, 'not again straight away');
  const c = dummy(g, 3, 3), d = dummy(g, 3.6, 3); g.pushEnemy(c, 0.3, 0); assert.equal(d.hp, d.maxHp, 'no pressure, no slam');
});

test('frozen cracks: the wrench does 20% more to a chilled body and 40% more to a frozen one', () => {
  const g = arena(['ice', 'fire']); g.s.run.traits = ['frostCrack']; const e = dummy(g), plain = g.damageMultiplier(e, true);
  e.statuses.chill = g.s.time + 3; assert.ok(Math.abs(g.damageMultiplier(e, true) / plain - 1.2) < 1e-9);
  e.frozenUntil = g.s.time + 1; assert.ok(Math.abs(g.damageMultiplier(e, true) / plain - 1.4) < 1e-9);
});
