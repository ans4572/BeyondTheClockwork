import { createProfile, permanentStats, buyRank, refundAll } from './progression.js';
import { fitsMap, pointInPolygon, placeOf } from './map-geometry.js';
import { Tutorial } from './tutorial.js';
import { FlowField } from './flow-field.js';

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const WAKE_SECONDS = 1.6, TALK_UNITS = 3, NPC_BODY_UNITS = 0.45, CLEAR_HOLD_SECONDS = 1, PORTAL_REACH_UNITS = 1, LEAVE_REFUSED_UNITS = 1.5, DIRECT_UNITS = 2, LAST_WAVE_ALREADY_PLAYED = 99, BELL_DRIFT_UNITS = 0.2, CARPET_REACH_SHARE = 0.7;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const inCone = (origin, target, angle, range, degrees) => distance(origin, target) <= range + (target.radius || 0) && Math.abs(angleDiff(Math.atan2(target.y - origin.y, target.x - origin.x), angle)) <= degrees * Math.PI / 360;
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// Run parts that add straight onto a permanent stat of the same name.
const RUN_STATS = ['moveSpeed', 'critChance', 'attackSpeed', 'damageReduction'];
// Boss fields that act on the player rather than on enemies.
const HOSTILE_SHAPES = ['magnet', 'suction', 'stickerVolley', 'stickerFall', 'sticker'];
const TAU_ENEMY = Math.PI * 2, RANGED_ATTACKS = ['shot', 'spiral', 'beat'];
const CRIT_RED = '#e8433a', JOLT_SECONDS = 0.12, LIGHT_KNOCKBACK = 0.15, HEAVY_KNOCKBACK = 0.35, FEEL_LIMIT = 64;

export class Game {
  constructor(data, savedState = null, onSave = () => {}) {
    this.data = data;
    this.onSave = onSave;
    // Hits the screen should feel (stop, shake, sound). The browser drains it; the rules never wait on it.
    this.feel = [];
    this.tutorial = new Tutorial(this);
    this.state = savedState || {
      mode: 'opening', time: 0, tick: 0, paused: false, rng: 1, sequence: 0,
      profile: createProfile(data), run: null, player: {}, enemies: [], casts: [], projectiles: [], effects: [], notices: [], result: null
    };
    this.state.profile.loadout ??= [];
    // Elements are bought from Moru one at a time; a save from before owns what it had equipped.
    this.state.profile.ownedElements ??= [...this.state.profile.loadout];
    // A run saved before waves existed finishes its current room as it stands.
    if (this.state.run) { this.state.run.arrivals ??= []; this.state.run.wave ??= LAST_WAVE_ALREADY_PLAYED; }
    if (!savedState) this.resetPlayer();
    else { this.s.panel = null; if (this.village && !fitsMap(this.p.x, this.p.y, this.village.bodyRadius, this.village)) Object.assign(this.p, this.village.spawn); }
  }
  get s() { return this.state; }
  get p() { return this.s.player; }
  get c() { return this.data.combat; }
  get config() { return this.data.slice; }
  /** Permanent tuning plus the run parts that raise the same stats. */
  get stats() {
    const stats = permanentStats(this.data, this.s.profile);
    for (const id of RUN_STATS) stats[id] = (stats[id] || 0) + this.upgradeAmount(id);
    return stats;
  }
  get room() { return this.s.run ? this.config.rooms[this.s.run.node] : null; }
  /** Authored map of the current room; rooms without one keep the rectangular arena. */
  get map() {
    const { maps } = this.data, { mode } = this.s;
    return placeOf(maps, mode === 'practice' ? maps?.practice : ['intro', 'introDeath'].includes(mode) ? maps?.intro : maps?.maps[this.room?.id]);
  }
  get hubMap() { return placeOf(this.data.maps, this.data.maps?.hub); }
  /** The walkable village under the player, or null anywhere that plays through panels or combat. */
  get village() {
    const { mode } = this.s, place = mode === 'hub' || (mode === 'registration' && this.tutorial.step) ? this.hubMap : mode === 'shop' ? this.map : null;
    return place?.walkable ? place : null;
  }
  get walking() { return !!this.village && !this.s.panel && !this.s.paused; }
  /** The room is cleared and rewarded; the only thing left is to walk out. */
  get leaving() { return this.s.mode === 'route' && !this.s.paused; }
  get onFoot() { return this.active || this.walking || this.leaving; }
  /** Where the current room's way out opens once it is cleared. */
  get portal() { return this.map?.portal || this.config.arena.portal; }
  get nearbyNpc() { return this.walking && this.s.mode !== 'registration' ? this.village.npcs?.find(npc => npc.opens && distance(this.p, npc) <= TALK_UNITS) || null : null; }
  get bounds() {
    const map = this.village || this.map, [width, height] = map?.size || [this.config.arena.width, this.config.arena.height];
    return map ? { left: 0, right: width, top: 0, bottom: height } : this.config.arena.bounds;
  }
  get active() { return ['intro', 'combat', 'practice'].includes(this.s.mode) && !this.s.paused; }
  id(prefix) { return `${prefix}-${++this.s.sequence}`; }
  random() {
    let n = this.s.rng | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.s.rng = n >>> 0;
    return this.s.rng / 4294967296;
  }
  save() { this.onSave(this.s); }
  notify(text) { this.s.notices.push({ id: this.id('notice'), text, until: this.s.time + 3 }); }
  resetPlayer() {
    const stats = this.stats, spawn = this.config.arena.spawn;
    this.s.player = { ...spawn, hp: this.c.player.maxHp + (stats.maxHp || 0), maxHp: this.c.player.maxHp + (stats.maxHp || 0), energy: 0, angle: 0, moveAngle: 0, attack: null, combo: 0, comboExpires: 0, invulnerableUntil: 0, dodge: null, dodgeReady: 0, cooldowns: {}, fusionReady: 0 };
  }
  clearCombat() { this.s.clearAt = null; this.s.column = null; this.s.bellWatch = null; this.s.panel = null; this.s.enemies = []; this.s.casts = []; this.s.projectiles = []; this.s.effects = []; this.p.attack = null; this.p.dodge = null; this.p.lastCast = null; }
  /** `wake` opens on the player getting up, with the world held until they stand. */
  beginIntro({ wake = false, lesson = false } = {}) {
    if (!['opening', 'introDeath'].includes(this.s.mode)) return false;
    this.resetPlayer(); this.clearCombat(); this.s.mode = 'intro';
    const yard = this.map, hold = wake ? WAKE_SECONDS : 0;
    if (yard) Object.assign(this.p, yard.spawn);
    this.s.wakeUntil = this.s.time + hold;
    if (lesson) this.tutorial.start();
    else {
      const guard = this.spawnEnemy(this.config.rules.introEnemy, yard?.enemySpawns[0] || { x: 12, y: 9 }); guard.ready += hold; guard.hp = guard.maxHp = this.config.rules.introEnemyHp;
      this.notify('태엽 렌치를 손에 쥐었습니다. 다가오는 경비를 때려 보세요.'); this.s.notices.at(-1).until += hold;
    }
    this.save(); return true;
  }
  /** 0 to 1 while the opening wake-up plays, otherwise null. */
  get wakeProgress() {
    const left = (this.s.wakeUntil || 0) - this.s.time;
    return this.s.mode === 'intro' && left > 0 ? 1 - left / WAKE_SECONDS : null;
  }
  /** Debug only: back to the opening cutscene. Permanent progress is kept. */
  debugRestartTutorial() {
    this.clearCombat(); this.s.run = null; this.s.result = null; this.s.profile.registered = false; this.resetPlayer(); this.s.mode = 'opening'; this.save(); return true;
  }
  /** Debug only: enter any stage directly, starting a run first if none is active. */
  debugJump(node) {
    if (!Number.isInteger(node) || !this.config.rooms[node]) return false;
    if (!this.s.run) { this.clearCombat(); this.s.profile.registered = true; this.s.tutorial = null; this.s.mode = 'hub'; this.startRun(); }
    this.s.run.node = node; this.s.run.rewardChoices = []; this.enterNode(); return true;
  }
  register() {
    if (this.s.mode !== 'registration') return false;
    // Someone who walked up to Moru stays where they are.
    const { x, y } = this.p, walkedIn = !!this.tutorial.step;
    this.s.profile.registered = true; this.s.tutorial = null; this.s.mode = 'hub'; this.resetPlayer(); this.enterHub();
    if (walkedIn) Object.assign(this.p, { x, y });
    this.save(); return true;
  }
  enterHub() {
    Object.assign(this.p, this.hubMap?.spawn);
    const { ownedElements, history } = this.s.profile;
    this.notify(!ownedElements.length && history.length ? '모루에게 가면 첫 속성 부품을 무료로 달아 줍니다.' : '모루에게 다가가 말을 거세요 · 남쪽 큰길로 나가면 출발합니다.');
  }
  talk() {
    const npc = this.nearbyNpc;
    if (npc) this.s.panel = npc.opens;
    return !!npc;
  }
  closePanel() { this.s.panel = null; }
  openElements() { if (this.s.mode === 'hub') this.s.panel = 'elements'; }
  /** Gears for the next element: the first is Moru's gift once the player has come back from one expedition. */
  get nextElementPrice() {
    const { ownedElements, history } = this.s.profile, prices = this.config.rules.elementPrices;
    if (ownedElements.length >= prices.length) return null;
    return ownedElements.length === 0 && !history.length ? null : prices[ownedElements.length];
  }
  buyElement(id) {
    const profile = this.s.profile, price = this.nextElementPrice;
    if (this.s.mode !== 'hub' || !this.config.elements.includes(id) || profile.ownedElements.includes(id) || price === null || profile.freeGears < price) return false;
    profile.freeGears -= price; profile.ownedElements.push(id);
    if (profile.loadout.length < 2) profile.loadout.push(id);
    this.save(); return true;
  }
  /** Two owned elements go in the body; picking a third takes the place of the older one. */
  toggleElement(id) {
    const { loadout, ownedElements } = this.s.profile;
    if (this.s.mode !== 'hub' || !ownedElements.includes(id)) return false;
    if (loadout.includes(id)) loadout.splice(loadout.indexOf(id), 1);
    else { if (loadout.length === 2) loadout.shift(); loadout.push(id); }
    this.save(); return true;
  }
  get loadoutSlots() { return this.s.profile.loadout.map(element => ({ element, level: 1, rarity: 'common' })); }
  // The wrench alone is enough to set out; elements are added as they are bought.
  get readyToLeave() { return this.s.profile.registered; }
  /** Moru's back yard: the equipped elements against a dummy that never falls. */
  enterPractice() {
    if (this.s.mode !== 'hub' || !this.s.profile.loadout.length) return false;
    this.clearCombat(); this.resetPlayer();
    this.s.mode = 'practice'; this.s.practice = { slots: this.loadoutSlots, resetCooldowns: false };
    const yard = this.map;
    Object.assign(this.p, yard.spawn, { energy: this.c.player.maxEnergy });
    this.spawnEnemy('dummy', yard.dummy).dummy = true;
    this.s.enemies[0].held = true;
    this.save(); return true;
  }
  togglePracticeReset() {
    if (this.s.mode !== 'practice') return false;
    return this.s.practice.resetCooldowns = !this.s.practice.resetCooldowns;
  }
  tickPractice() {
    if (this.s.mode !== 'practice') return;
    const { p } = this, [dummy] = this.s.enemies, { x, y } = this.map.dummy;
    p.energy = this.c.player.maxEnergy; dummy.x = x; dummy.y = y;
    if (this.s.practice.resetCooldowns) { p.cooldowns = {}; p.fusionReady = 0; }
    if (pointInPolygon(p.x, p.y, this.map.exit.polygon)) this.leavePractice();
  }
  leavePractice() {
    this.clearCombat(); this.s.practice = null; this.s.mode = 'hub'; this.resetPlayer();
    Object.assign(this.p, this.hubMap?.spawn); this.save();
  }
  tune(statId, action) {
    if (this.s.mode !== 'hub') return false;
    let result = false;
    if (action === 'buy') result = buyRank(this.data, this.s.profile, statId);
    if (action === 'refund') { refundAll(this.data, this.s.profile); result = true; }
    if (result) { const { x, y } = this.p; this.resetPlayer(); Object.assign(this.p, { x, y }); this.save(); }
    return result;
  }
  startRun(seed = Date.now() >>> 0) {
    if (this.s.mode !== 'hub' || !this.s.profile.registered) return false;
    this.s.rng = seed || 1; this.s.profile.runs++;
    this.s.run = { id: `run-${this.s.profile.runs}-${seed}`, seed, node: 0, startedAt: this.s.time, elapsed: 0, coins: 0, slots: this.loadoutSlots, upgrades: {}, mods: [], skillMods: [], traits: [], clears: [], rewardChoices: [], shopBought: [], branches: [], damageTaken: 0, baseGears: 0 };
    // Generate the whole route once; resuming never rerolls layouts or encounters.
    this.s.run.plan = this.config.rooms.map(room => ({ variant: room.variants ? Math.floor(this.random() * room.variants.length) : 0, layout: room.boss || room.kind === 'shop' ? 2 : Math.floor(this.random() * this.config.roomLayouts.length) }));
    this.resetPlayer(); this.enterNode(); return true;
  }
  spawnEnemy(type, position) {
    const boss = this.c.bosses.find(b => b.id === type), template = boss ? { ...boss, ...this.config.bossAI[type] } : this.config.enemies[type];
    const enemy = { ...template, ...position, id: this.id('enemy'), type, boss: !!boss, maxHp: template.hp, facing: Math.PI, state: 'approach', aggro: true, ready: this.s.time + this.config.rules.enemyInitialDelay, tell: null, pattern: 0, stagger: 0, exposedUntil: 0, staggerLock: 0, stunUntil: 0, statuses: {}, statusApplied: {}, burnStacks: [], chillCount: 0, freezeLock: 0, shockReady: 0, flashUntil: 0 };
    this.s.enemies.push(enemy); return enemy;
  }
  enterNode() {
    this.clearCombat();
    const room = this.room, plan = this.s.run.plan[this.s.run.node], map = this.map, spawn = map?.spawn || this.config.arena.spawn, spawns = map?.enemySpawns || this.config.spawns;
    this.p.x = spawn.x; this.p.y = spawn.y;
    this.s.mode = room.kind === 'shop' ? 'shop' : 'combat';
    if (room.boss) { this.spawnEnemy(room.boss, map?.bossSpawn || { x: 18, y: 8.5 }); this.notify(room.description); }
    else if (room.waves) {
      Object.assign(this.s.run, { wave: 0, arrivals: [] });
      room.waves[0].forEach(type => this.spawnWaveEnemy(type, this.spreadSpot()));
      this.notify(room.name);
    }
    this.save();
  }
  get obstacles() {
    if (this.s.mode === 'intro' || !this.s.run || this.map) return [];
    return this.config.roomLayouts[this.s.run.plan[this.s.run.node].layout].obstacles;
  }
  move(body, dx, dy, radius = body.radius || this.config.arena.playerRadius) {
    const bounds = this.bounds;
    // A body already off the floor, such as one from an older save, may walk back onto it.
    const area = this.village || this.map, map = area?.walkable ? area : null, floor = map && fitsMap(body.x, body.y, radius, map) ? map : null;
    // Small steps prevent tunnelling, including dashes and knockback.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radius * 0.5)));
    const standing = this.village?.npcs || [];
    const blocked = (x, y) => (floor && !fitsMap(x, y, radius, floor)) || standing.some(npc => Math.hypot(x - npc.x, y - npc.y) < radius + NPC_BODY_UNITS) || this.obstacles.some(o => x + radius > o.x && x - radius < o.x + o.w && y + radius > o.y && y - radius < o.y + o.h);
    for (let i = 0; i < steps; i++) {
      const x = clamp(body.x + dx / steps, bounds.left + radius, bounds.right - radius);
      if (!blocked(x, body.y)) body.x = x;
      const y = clamp(body.y + dy / steps, bounds.top + radius, bounds.bottom - radius);
      if (!blocked(body.x, y)) body.y = y;
    }
  }
  upgradeAmount(id) {
    return (this.s.run?.upgrades[id] || 0) * (this.c.balance.temporaryUpgrades.find(u => u.id === id)?.perRank || 0);
  }
  heal(amount, quiet = false) {
    const actual = Math.min(this.p.maxHp - this.p.hp, amount);
    if (actual > 0 && !quiet) this.sense({ kind: 'mend' });
    this.p.hp += actual; return actual;
  }
  dodge() {
    if (!this.onFoot || this.s.time < this.p.dodgeReady || this.p.dodge) return false;
    const attack = this.p.attack;
    if (attack) {
      const phase = this.c.player.combo[attack.phase];
      const canCancel = attack.elapsed < phase.windup || (attack.phase === 2 && attack.elapsed >= phase.windup + phase.active + attack.recovery - this.config.rules.lastRecoveryDodgeCancel);
      if (!canCancel) return false;
      this.p.attack = null;
    }
    const d = this.c.player.dodge;
    this.p.dodge = { elapsed: 0, angle: this.p.moveAngle, x: this.p.x, y: this.p.y };
    this.p.dodgeReady = this.s.time + Math.max(this.c.caps.minDodgeCooldown, d.cooldown * (1 - (this.stats.dodgeCooldown || 0)) * (1 - this.upgradeAmount('dodgeCooldownReduction')));
    this.p.invulnerableUntil = Math.max(this.p.invulnerableUntil, this.s.time + d.invincibility);
    this.sense({ kind: 'dodge' });
    if (this.active) this.tutorial.onDodge();
    const strike = this.wrenchMod('dashStrike');
    if (strike) this.p.strikeUntil = this.s.time + strike.window;
    this.effect('dodge', this.p.x, this.p.y, '#badbd3', 0.3, 0.7); return true;
  }
  basicAttack() {
    // The wrench swings in a fight and after one; in town it stays lowered.
    if (!(this.active || this.leaving) || this.p.attack || this.p.dodge || this.s.casts.some(c => c.shape === 'dash')) return false;
    if (this.s.time > this.p.comboExpires) this.p.combo = 0;
    const phase = this.p.combo, info = this.c.player.combo[phase];
    const mod = this.s.run?.mods.includes('quickThird') && phase === 2 ? this.config.mods.find(m => m.id === 'quickThird').recoveryReduction : 0;
    this.p.attack = { phase, elapsed: 0, angle: this.p.angle, hit: [], energyGiven: false, recovery: Math.max(0, info.recovery - mod), reflected: false, wave: false, empowered: this.s.time < (this.p.strikeUntil || 0) };
    if (this.p.attack.empowered) this.p.strikeUntil = 0;
    this.p.combo = (phase + 1) % this.c.player.combo.length; return true;
  }
  damageMultiplier(enemy, basic = false, slot = null) {
    const permanent = this.stats.attackDamage || 0;
    const brand = basic && enemy.burnStacks?.some(t => t > this.s.time) ? this.trait('burnBrand')?.damageBonus || 0 : 0;
    const runBonus = (basic ? this.upgradeAmount('basicDamage') : 0) + brand;
    const level = slot ? 1 + (slot.level - 1) * this.c.balance.skillLevelDamagePerLevel : 1;
    const rarity = slot ? this.c.balance.rarityDamage[slot.rarity] : 1;
    return (1 + Math.min(this.c.caps.permanentConditionalDamageBonus, permanent)) * (1 + Math.min(this.c.caps.runDamageBonus, runBonus)) * level * rarity;
  }
  /** Skips the roll at zero chance so runs without the stat keep their random sequence. */
  rollCrit() {
    const chance = Math.min(this.c.caps.critChance, (this.c.player.critChance || 0) + (this.stats.critChance || 0));
    return chance > 0 && this.random() < chance;
  }
  get statusPower() { return 1 + (this.stats.statusPower || 0); }
  /** The shield only covers the front, and drops for the long recovery after a swing. */
  shieldHolds(enemy) {
    if (!enemy.frontGuard || enemy.state === 'recover' && this.s.time < enemy.ready) return false;
    return Math.abs(angleDiff(Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x), enemy.facing)) * 360 / Math.PI <= enemy.guardArcDegrees;
  }
  hitEnemy(enemy, base, options = {}) {
    if (enemy.hp <= 0 || enemy.hidden) return { crit: false, killed: false };
    if (!enemy.aggro) this.rouse(enemy);
    const crit = !options.dot && this.rollCrit();
    const guarded = !options.dot && this.shieldHolds(enemy);
    if (guarded) this.sense({ kind: 'block' });
    const amount = base * (options.dot ? 1 : this.damageMultiplier(enemy, !!options.basic, options.slot)) * (crit ? this.c.caps.critMultiplier + (this.stats.critDamage || 0) : 1) * (guarded ? 1 - enemy.frontGuard : 1);
    // Hitting a boss during its alarm brings the claw straight back at whoever did it.
    if (!options.dot && enemy.alarmUntil > this.s.time && this.hurt(enemy.damage)) this.effect('beam', enemy.x, enemy.y, '#cf767a', 0.3, 1, { targetX: this.p.x, targetY: this.p.y });
    if (guarded) this.effect('spark', enemy.x, enemy.y - enemy.radius, '#d8dde2', 0.2, 0.6);
    const beaten = !options.dot && enemy.beatUntil > this.s.time ? 1 - this.config.enemies.drummer.beatArmor : 1;
    enemy.hp = enemy.dummy ? enemy.maxHp : Math.max(this.tutorial.guardSurvives ? 1 : 0, enemy.hp - amount * beaten); enemy.flashUntil = this.s.time + 0.09;
    this.tutorial.onHit(enemy, !!options.basic);
    this.effect('number', enemy.x, enemy.y - enemy.radius, crit ? CRIT_RED : options.color || '#fff4cd', 0.65, amount, { crit });
    if (options.stagger) this.addStagger(enemy, options.stagger);
    const held = enemy.statuses.windPressure > this.s.time ? this.trait('galeHold')?.stunMultiplier || 1 : 1;
    if (!enemy.boss && options.stagger) enemy.stunUntil = Math.max(enemy.stunUntil, this.s.time + this.config.rules.normalHitStun * held);
    if (enemy.hp <= 0) {
      enemy.tell = null; this.effect('scrap', enemy.x, enemy.y, enemy.color || '#dbbc6b', 0.6, 1);
      if (enemy.statuses.chill > this.s.time && this.trait('coldReap')) this.refundCooldowns(this.trait('coldReap').cooldownRefund);
      const harvest = this.wrenchMod('scrapHarvest');
      if (harvest) this.p.hasteUntil = this.s.time + harvest.duration;
      if (!enemy.dummy && this.upgradeAmount('killHeal')) this.heal(this.upgradeAmount('killHeal'), true);
      if (!enemy.dummy) this.sense({ kind: 'kill' });
    }
    return { crit, killed: enemy.hp <= 0 };
  }
  /** Queues a hit for the browser to feel; nobody drains it in tests, so it stops growing. */
  sense(hit) { if (this.feel.length < FEEL_LIMIT) this.feel.push(hit); }
  /** A wrench blow lands: the body jolts and light enemies give ground. */
  punch(enemy, attack, hit) {
    const heavy = attack.phase === 2, cos = Math.cos(attack.angle), sin = Math.sin(attack.angle);
    this.sense({ kind: heavy ? 'heavy' : 'hit', crit: hit.crit });
    enemy.joltUntil = this.s.time + JOLT_SECONDS;
    if (!enemy.boss && !enemy.dummy && !enemy.stationary && enemy.hp > 0) { const push = heavy ? HEAVY_KNOCKBACK : LIGHT_KNOCKBACK; this.move(enemy, cos * push, sin * push); }
  }
  addStagger(enemy, amount, applyPressure = true) {
    if (!enemy.boss || this.s.time < enemy.staggerLock) return;
    enemy.stagger += amount * (applyPressure && enemy.statuses.windPressure > this.s.time ? 1 + this.windBonus : 1);
    if (enemy.stagger >= this.c.balance.bossStaggerThreshold[enemy.kind]) {
      enemy.stagger = 0; enemy.exposedUntil = this.s.time + this.c.caps.bossStaggerWindowSeconds;
      enemy.staggerLock = enemy.exposedUntil + this.c.caps.bossStaggerReapplyLockSeconds;
      enemy.tell = null; enemy.followup = null; enemy.ready = enemy.exposedUntil + this.config.rules.postExposureRecovery; this.notify('태엽 노출! 지금이 공격 기회입니다.');
    }
  }
  applyStatus(enemy, element, cast) {
    const status = this.c.elements.find(e => e.id === element)?.status;
    if (!status) return;
    const key = `${cast.id}:${status}`, next = enemy.statusApplied[key] || 0;
    if (this.s.time + 1e-7 < next) return;
    enemy.statusApplied[key] = this.s.time + this.c.balance.statusApplyPerCastTargetCooldown;
    const info = this.c.statuses.find(s => s.id === status), ember = status === 'burn' ? this.trait('emberStacks') : null, lasts = info.duration + (ember?.extraDuration || 0);
    enemy.statuses[status] = this.s.time + lasts;
    if (status === 'burn') {
      enemy.burnStacks = enemy.burnStacks.filter(t => t > this.s.time);
      if (enemy.burnStacks.length < info.maxStacks + (ember?.extraStacks || 0)) enemy.burnStacks.push(this.s.time + lasts);
      else enemy.burnStacks[enemy.burnStacks.indexOf(Math.min(...enemy.burnStacks))] = this.s.time + lasts;
      enemy.burnTick ??= this.s.time + info.tickInterval;
    }
    if (status === 'chill') {
      enemy.chillCount += 1 + (cast.chillBonus || 0);
      if (enemy.chillCount >= info.freezeAtApplications - (this.trait('quickFreeze')?.freezeReduction || 0)) {
        enemy.chillCount = 0;
        if (enemy.boss) this.castStagger(enemy, info.bossFreezeStagger, cast);
        else if (this.s.time >= enemy.freezeLock) {
          enemy.stunUntil = enemy.frozenUntil = this.s.time + info.normalFreezeDuration;
          enemy.freezeLock = this.s.time + info.freezeReapplyLock;
        }
      }
    }
  }
  castStagger(enemy, amount, cast) {
    const used = cast.staggerUsed[enemy.id] || 0;
    const cap = cast.fusion ? this.c.balance.fusionStaggerPerCastCap : this.c.balance.skillStaggerPerCastCap;
    const pressure = enemy.statuses.windPressure > this.s.time ? 1 + this.windBonus : 1;
    const give = Math.max(0, Math.min(amount * pressure, cap - used));
    cast.staggerUsed[enemy.id] = used + give;
    if (give > 0) this.addStagger(enemy, give, false);
  }
  triggerShock(enemy) {
    const info = this.c.statuses.find(s => s.id === 'shock');
    if (enemy.statuses.shock <= this.s.time || !enemy.statuses.shock || this.s.time < enemy.shockReady) return;
    const targets = this.s.enemies.filter(e => e.hp > 0 && distance(enemy, e) <= info.dischargeRadius + (this.trait('arcRange')?.radiusBonus || 0) && this.s.time >= e.shockReady).sort((a, b) => distance(enemy, a) - distance(enemy, b)).slice(0, info.maxTargets);
    for (const target of targets) { target.shockReady = this.s.time + info.targetCooldown; this.hitEnemy(target, info.dischargeDamage * this.statusPower, { color: '#ffe086' }); this.effect('spark', target.x, target.y, '#ffe086', 0.25, 0.7); }
  }
  updateBasic(dt) {
    const a = this.p.attack;
    if (!a) return;
    const haste = this.s.time < (this.p.hasteUntil || 0) ? this.wrenchMod('scrapHarvest')?.speedBonus || 0 : 0;
    a.elapsed += dt * (1 + (this.stats.attackSpeed || 0) + haste);
    const info = this.c.player.combo[a.phase], range = info.range + (this.wrenchMod('longWrench')?.rangeBonus || 0);
    if (a.elapsed >= info.windup && a.elapsed <= info.windup + info.active) {
      if (!a.shown) { this.effect('swing', this.p.x, this.p.y, a.phase === 2 ? '#f0c369' : '#fff5d9', info.active + 0.08, range, { angle: a.angle, phase: a.phase }); a.shown = true; }
      for (const enemy of this.s.enemies) if (enemy.hp > 0 && !a.hit.includes(enemy.id) && inCone(this.p, enemy, a.angle, range, this.config.rules.comboArcDegrees)) {
        a.hit.push(enemy.id); const hit = this.hitEnemy(enemy, info.damage * (a.empowered ? 1 + this.wrenchMod('dashStrike').damageBonus : 1), { basic: true, stagger: this.c.balance.basicStagger[a.phase] }); this.punch(enemy, a, hit);
        if (enemy.statuses.shock > this.s.time && this.trait('staticCharge')) this.addEnergy(this.trait('staticCharge').energy);
        this.triggerShock(enemy);
        if (!a.energyGiven) { this.addEnergy(this.c.player.energyPerBasicPhase * (1 + (this.stats.energyGain || 0))); a.energyGiven = true; }
        if (a.phase === 2) {
          if (this.wrenchMod('windupRecoil')) this.p.dodgeReady = this.s.time;
          if (this.wrenchMod('elementalCharge') && enemy.hp > 0) { a.statusCast ??= { id: this.id('wrench'), staggerUsed: {}, fusion: false }; for (const slot of this.slots) this.applyStatus(enemy, slot.element, a.statusCast); }
        }
      }
      const deflect = this.wrenchMod('deflect');
      if (deflect) {
        const mod = deflect;
        for (const bullet of this.s.projectiles) if (!bullet.friendly && inCone(this.p, bullet, a.angle, range + deflect.reach, this.config.rules.comboArcDegrees)) { bullet.friendly = true; bullet.angle = a.angle; bullet.damage = mod.reflectedDamage; bullet.speed = mod.reflectedSpeed; }
      }
      if (a.phase === 2 && !a.wave && this.s.run?.mods.includes('shockwave')) {
        a.wave = true; const mod = this.config.mods.find(m => m.id === 'shockwave');
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(this.p, enemy) <= mod.radius) this.hitEnemy(enemy, mod.damage, { basic: true });
        this.effect('ring', this.p.x, this.p.y, '#f0c369', 0.35, mod.radius);
      }
    }
    if (a.elapsed >= info.windup + info.active + a.recovery) { this.p.attack = null; this.p.comboExpires = this.s.time + this.config.rules.comboReset; }
  }
  get slots() { return this.s.run?.slots || this.s.practice?.slots || []; }
  wrenchMod(id) { return this.s.run?.mods.includes(id) ? this.config.mods.find(m => m.id === id) : null; }
  skillMod(id) { return this.s.run?.skillMods?.includes(id) ? this.config.skillMods.find(m => m.id === id) : null; }
  trait(id) { return this.s.run?.traits?.includes(id) ? this.config.elementTraits.find(t => t.id === id) : null; }
  addEnergy(amount) {
    const before = this.p.energy, cost = this.fusion?.energyCost;
    this.p.energy = Math.min(this.c.player.maxEnergy, this.p.energy + amount);
    if (cost && before < cost && this.p.energy >= cost) this.sense({ kind: 'charged' });
  }
  refundCooldowns(seconds) { for (const id of Object.keys(this.p.cooldowns)) this.p.cooldowns[id] = Math.max(0, this.p.cooldowns[id] - seconds); }
  get windBonus() { return this.c.statuses.find(s => s.id === 'windPressure').staggerTakenBonus * this.statusPower + (this.trait('galeHold')?.staggerBonus || 0); }
  get fusion() {
    if (this.slots.length !== 2) return null;
    return this.c.fusions.find(f => f.pair.every(id => this.slots.some(s => s.element === id)));
  }
  get cooldownFactor() { return 1 - Math.min(this.c.caps.totalCooldownReduction, this.upgradeAmount('skillCooldownReduction') + (this.stats.cooldownReduction || 0)); }
  get skillSlots() { return this.slots.flatMap(slot => this.c.skills.filter(s => s.element === slot.element).map(skill => ({ skill, slot }))); }
  castSkill(index, target) {
    const entry = this.skillSlots[index];
    if (!entry || !this.active || this.p.dodge || this.s.casts.some(c => c.shape === 'dash')) return false;
    const recast = entry.skill.id === 'pressureDash' && this.s.time < (this.p.dashRecastUntil || 0), ready = (this.p.cooldowns[entry.skill.id] || 0) <= this.s.time;
    // Skills spend charge built by the wrench, so they wait for the moment that earns them.
    const cost = entry.skill.energyCost || 0;
    if (!recast && (!ready || this.p.energy < cost)) return false;
    if (recast) this.p.dashRecastUntil = 0;
    else {
      this.p.energy -= cost;
      this.p.cooldowns[entry.skill.id] = this.s.time + entry.skill.cooldown * this.cooldownFactor;
      const dash = this.skillMod('doubleDash');
      if (dash && entry.skill.id === dash.skill) this.p.dashRecastUntil = this.s.time + dash.window;
    }
    this.makeCast(entry.skill, this.config.skillBehavior[entry.skill.id], entry.slot, target, false); this.sense({ kind: 'cast', id: entry.skill.id }); return true;
  }
  castFusion(target) {
    const fusion = this.fusion;
    if (!fusion || !this.active || this.p.dodge || this.p.fusionReady > this.s.time || this.p.energy < fusion.energyCost || this.s.casts.some(c => c.shape === 'dash')) return false;
    this.p.energy -= fusion.energyCost;
    this.p.fusionReady = this.s.time + fusion.cooldown * this.cooldownFactor;
    const rarityKeys = Object.keys(this.c.balance.rarityDamage);
    const slot = { level: Math.min(...this.slots.map(s => s.level)), rarity: rarityKeys[Math.min(...this.slots.map(s => rarityKeys.indexOf(s.rarity)))] };
    this.makeCast(fusion, this.config.fusionBehavior[fusion.id], slot, target, true); this.notify(fusion.name); this.sense({ kind: 'cast', id: fusion.id });
    if (!this.s.profile.discoveredFusions.includes(fusion.id)) this.s.profile.discoveredFusions.push(fusion.id);
    return true;
  }
  applySkillMods(cast) {
    for (const mod of this.config.skillMods.filter(m => m.skill === cast.skillId && this.skillMod(m.id))) {
      if (mod.id === 'overload') cast.overload = mod.cooldownRefund;
      if (mod.id === 'backflow') cast.finalKnockback = mod.knockback;
      if (mod.id === 'piercingBolt') cast.pierce = true;
      if (mod.id === 'flashFreeze') cast.chillBonus = mod.chillBonus;
      if (mod.id === 'overcurrent') cast.secondaryTargets += mod.extraTargets;
      if (mod.id === 'homingStrike') cast.homing = mod.homingRange;
      if (mod.id === 'driftingVortex') cast.drift = mod.speed;
    }
  }
  makeCast(skill, behavior, slot, target = this.p, fusion) {
    const range = skill.range || behavior.range || skill.radius || 1;
    const d = Math.min(range, distance(this.p, target));
    const angle = ['orb','clamp'].includes(behavior.shape) ? Math.atan2(target.y-this.p.y,target.x-this.p.x) : this.p.angle, elements = fusion ? skill.pair : [skill.element];
    const cast = { id: this.id('cast'), skillId: skill.id, fusion, slot: { ...slot }, ...behavior, radius: skill.radius, range, angle, x: this.p.x + Math.cos(angle) * d, y: this.p.y + Math.sin(angle) * d, startX: this.p.x, startY: this.p.y, age: 0, pulse: 0, next: behavior.delay, hits: skill.hits, damage: skill.damagePerHit, finisher: skill.finisherDamage || 0, secondaryDamage: skill.secondaryDamage || 0, secondaryTargets: skill.secondaryTargets || 0, elements, staggerUsed: {}, hit: [], projectiles: [], statusAt: {}, color: this.config.presentation.colors[elements[0]] };
    this.applySkillMods(cast);
    const bounds = this.bounds;
    cast.x = clamp(cast.x, bounds.left, bounds.right); cast.y = clamp(cast.y, bounds.top, bounds.bottom);
    if (cast.shape === 'self' || cast.shape === 'moving' || cast.shape === 'cone' || cast.shape === 'dash' || cast.shape === 'crosscut') { cast.x = this.p.x; cast.y = this.p.y; }
    if (cast.shape === 'moving' && cast.startDistance) this.move(cast, Math.cos(angle)*cast.startDistance, Math.sin(angle)*cast.startDistance, .2);
    if (['target', 'orb'].includes(cast.shape) && behavior.delay > 0) this.effect('friendlyTell', cast.x, cast.y, cast.color, behavior.delay, cast.radius);
    if (cast.shape === 'projectile') {
      for (let i = 0; i < skill.hits; i++) cast.projectiles.push({ x: this.p.x, y: this.p.y, angle: angle + (i - (skill.hits - 1) / 2) * behavior.spread, travelled: 0, done: false });
    }
    this.s.casts.push(cast);
    this.p.lastCast = { id: cast.id, skillId: skill.id, at: this.s.time, angle };
  }
  castHit(cast, enemy, damage = cast.damage) {
    const hit = this.hitEnemy(enemy, damage, { slot: cast.slot, color: cast.color });
    enemy.joltUntil = this.s.time + JOLT_SECONDS;
    // A cast that lands many times is felt once, on its first contact.
    if (!cast.felt) { cast.felt = true; this.sense({ kind: cast.fusion ? 'fusion' : 'skill', crit: hit.crit }); }
    if (enemy.hp > 0) for (const element of cast.elements) this.applyStatus(enemy, element, cast);
    if (cast.overload && enemy.burnStacks.some(t => t > this.s.time)) { this.p.cooldowns[cast.skillId] = Math.max(0, (this.p.cooldowns[cast.skillId] || 0) - cast.overload); cast.overload = 0; }
    this.castStagger(enemy, cast.fusion ? this.c.balance.fusionStaggerPerCastCap : this.c.balance.skillStaggerPerCastCap, cast);
  }
  updateCasts(dt) {
    for (const cast of this.s.casts) {
      cast.age += dt;
      if (cast.shape === 'projectile') {
        for (const bullet of cast.projectiles) {
          if (bullet.done) continue;
          const before = { x: bullet.x, y: bullet.y }, step = cast.speed * dt;
          this.move(bullet, Math.cos(bullet.angle) * step, Math.sin(bullet.angle) * step, cast.width);
          bullet.travelled += step;
          const target = this.s.enemies.filter(e => e.hp > 0 && !bullet.pierced?.includes(e.id) && segmentDistance(e, before, bullet) <= e.radius + cast.width).sort((a, b) => distance(before, a) - distance(before, b))[0];
          if (target) { this.castHit(cast, target); if (cast.pierce) (bullet.pierced ??= []).push(target.id); else bullet.done = true; }
          if (distance(before, bullet) < step * 0.5 || bullet.travelled >= cast.range) bullet.done = true;
        }
        cast.done = cast.projectiles.every(p => p.done); continue;
      }
      if (cast.shape === 'dash') {
        const before = { x: this.p.x, y: this.p.y };
        this.move(this.p, Math.cos(cast.angle) * cast.range / cast.duration * dt, Math.sin(cast.angle) * cast.range / cast.duration * dt);
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && !cast.hit.includes(enemy.id) && segmentDistance(enemy, before, this.p) <= cast.radius + enemy.radius) { cast.hit.push(enemy.id); this.castHit(cast, enemy); if (!enemy.boss) this.move(enemy, Math.cos(cast.angle) * cast.knockback, Math.sin(cast.angle) * cast.knockback); }
        this.effect('dodge', this.p.x, this.p.y, cast.color, 0.2, cast.radius);
        cast.done = cast.age >= cast.duration; continue;
      }
      if (cast.shape === 'self' || cast.shape === 'cone') { cast.x = this.p.x; cast.y = this.p.y; }
      if (cast.shape === 'moving') this.move(cast, Math.cos(cast.angle) * cast.speed * dt, Math.sin(cast.angle) * cast.speed * dt, 0.2);
      if (cast.drift) this.move(cast, Math.cos(cast.angle) * cast.drift * dt, Math.sin(cast.angle) * cast.drift * dt, 0.2);
      if (cast.pull) for (const enemy of this.s.enemies) if (!enemy.boss && enemy.hp > 0 && distance(cast, enemy) < cast.radius) { const a = Math.atan2(cast.y - enemy.y, cast.x - enemy.x); this.move(enemy, Math.cos(a) * cast.pull * dt, Math.sin(a) * cast.pull * dt); }
      while (cast.pulse < cast.hits && cast.age + 1e-7 >= cast.next) {
        if (cast.shape === 'crosscut') {
          const segment = crosscutSegment({x:cast.startX,y:cast.startY},cast.angle,cast,cast.pulse);
          for (const enemy of this.s.enemies) if (enemy.hp > 0 && segment.points.slice(1).some((p,i)=>segmentDistance(enemy,segment.points[i],p) <= segment.halfWidth + enemy.radius)) this.castHit(cast,enemy);
          for(let i=1;i<segment.points.length;i++){const a=segment.points[i-1],b=segment.points[i];this.effect('crosscut',a.x,a.y,cast.color,0.2,segment.halfWidth,{targetX:b.x,targetY:b.y});}
        } else if(cast.shape === 'clamp') {
          for(const enemy of this.s.enemies)if(enemy.hp>0&&clampContains(enemy,cast,cast.angle,cast,enemy.radius))this.castHit(cast,enemy);
          this.effect('iceClamp',cast.x,cast.y,cast.color,.18,cast.halfWidth,{angle:cast.angle,halfLength:cast.halfLength,pulse:cast.pulse});
        } else if (cast.shape === 'chain') {
          const first = this.s.enemies.filter(e => e.hp > 0 && inCone(this.p, e, cast.angle, cast.range, cast.acquisitionArc)).sort((a, b) => distance(this.p, a) - distance(this.p, b))[0];
          if (first) {
            this.castHit(cast, first);
            for (const e of this.s.enemies.filter(e => e.hp > 0 && e.id !== first.id && distance(first, e) <= cast.chainRange).slice(0, cast.secondaryTargets)) this.castHit(cast, e, cast.secondaryDamage);
            this.effect('beam', this.p.x, this.p.y, cast.color, 0.3, 1, { targetX: first.x, targetY: first.y });
          }
        } else {
          if (cast.homing) { const near = this.s.enemies.filter(e => e.hp > 0 && distance(cast, e) <= cast.homing).sort((a, b) => distance(cast, a) - distance(cast, b))[0]; if (near) { cast.x = near.x; cast.y = near.y; } }
          if (cast.finalKnockback && cast.pulse === cast.hits - 1) for (const enemy of this.s.enemies) if (enemy.hp > 0 && !enemy.boss && distance(cast, enemy) <= cast.radius + enemy.radius) { const a = Math.atan2(enemy.y - cast.y, enemy.x - cast.x); this.move(enemy, Math.cos(a) * cast.finalKnockback, Math.sin(a) * cast.finalKnockback); }
          for (const enemy of this.s.enemies) if (enemy.hp > 0 && (cast.shape === 'cone' ? inCone(cast, enemy, cast.angle, cast.range, cast.arc) : distance(cast, enemy) <= cast.radius + enemy.radius)) { this.castHit(cast, enemy); if(cast.shape==='orb' && cast.knockback && !enemy.boss){const a=Math.atan2(enemy.y-cast.y,enemy.x-cast.x);this.move(enemy,Math.cos(a)*cast.knockback,Math.sin(a)*cast.knockback);} }
          this.effect(cast.shape === 'cone' ? 'swing' : 'ring', cast.x, cast.y, cast.color, Math.max(0.18, cast.interval), cast.shape === 'cone' ? cast.range : cast.radius, { angle: cast.angle, phase: 1 });
        }
        cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= cast.hits && cast.age >= cast.next) {
        if (cast.finisher) for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(cast, enemy) <= cast.radius + enemy.radius) this.castHit(cast, enemy, cast.finisher);
        cast.done = true;
      }
    }
    this.s.casts = this.s.casts.filter(c => !c.done);
  }
  hurt(amount) {
    if (!this.active || this.s.time + 1e-7 < this.p.invulnerableUntil) return false;
    amount *= 1 - (this.stats.damageReduction || 0);
    this.p.hp = Math.max(0, this.p.hp - amount);
    if (this.s.run) this.s.run.damageTaken += amount;
    this.p.invulnerableUntil = this.s.time + this.c.player.hurtInvulnerability;
    if (this.p.attack && this.p.attack.elapsed < this.c.player.combo[this.p.attack.phase].windup) this.p.attack = null;
    this.effect('hurt', this.p.x, this.p.y, '#e67d73', 0.25, 0.8);
    this.sense({ kind: 'hurt' });
    if (this.p.hp <= 0) {
      this.sense({ kind: 'down' });
      if (this.tutorial.step) this.tutorial.rise();
      else if (this.s.mode === 'intro') { this.s.mode = 'introDeath'; this.clearCombat(); this.save(); }
      else this.returnToHub('defeat');
    }
    return true;
  }
  effect(type, x, y, color, duration, value, extra = {}) {
    this.s.effects.push({ id: this.id('fx'), type, x, y, color, created: this.s.time, until: this.s.time + duration, duration, value, ...extra });
  }
  beginEnemyTell(enemy, type, delay = null) {
    const tellTime = delay ?? (enemy.tellSeconds?.[type] || enemy.minimumTell || enemy.tellDuration || this.config.enemies[enemy.type]?.tell || 0.7);
    const angle = Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x);
    enemy.facing = angle;
    enemy.tell = { type, x: enemy.x, y: enemy.y, targetX: this.p.x, targetY: this.p.y, angle, started: this.s.time, until: this.s.time + tellTime };
    if (type === 'crane') enemy.tell.drops = this.craneDrops(enemy);
    if (type === 'carpet') enemy.tell.safe = this.safeCarpet(enemy, tellTime);
    enemy.state = 'tell';
  }
  /** What the boss will do next: its usual round, plus what it has unlocked by being hurt. */
  nextBossPattern(enemy) {
    const round = [...enemy.patterns, ...(enemy.phasePatterns || []).filter(({ below }) => enemy.hp <= enemy.maxHp * below).map(({ pattern }) => pattern)];
    return round[enemy.pattern++ % round.length];
  }
  /** The carpets, as line segments, on the map or down the plain arena. */
  marchLanes(enemy, all = false) {
    const ai = this.config.bossAI[enemy.type], { top, bottom } = this.config.arena.bounds, map = this.map;
    const lanes = map?.lanes || [...ai.marchLanes, ai.phaseTwoLane].map(x => [[x, top], [x, bottom]]);
    return all || enemy.hp <= enemy.maxHp * ai.phaseTwoHpFraction ? lanes : lanes.slice(0, ai.marchLanes.length);
  }
  onLane(lane, width) {
    const [[ax, ay], [bx, by]] = lane;
    return segmentDistance(this.p, { x: ax, y: ay }, { x: bx, y: by }) < width + this.config.arena.playerRadius;
  }
  /** One crate always lands on the player; the rest land round them, on the floor. */
  craneDrops(enemy) {
    const ai = this.config.bossAI[enemy.type], { x, y } = this.p, drops = [{ x, y }], map = this.map, { bounds } = this.config.arena;
    for (let tries = 0; tries < 40 && drops.length < ai.craneDrops; tries++) {
      const angle = this.random() * Math.PI * 2, reach = ai.craneRadius * 2 + this.random() * ai.craneSpread, spot = { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach };
      if (map ? fitsMap(spot.x, spot.y, 0.4, map) : spot.x > bounds.left && spot.x < bounds.right && spot.y > bounds.top && spot.y < bounds.bottom) drops.push(spot);
    }
    return drops;
  }
  /** The safe carpet is always one the player can reach in time. */
  safeCarpet(enemy, seconds) {
    const lanes = this.marchLanes(enemy, true), reach = this.c.player.speed * seconds * CARPET_REACH_SHARE;
    const away = lanes.map(([[ax, ay], [bx, by]]) => segmentDistance(this.p, { x: ax, y: ay }, { x: bx, y: by }));
    const near = lanes.map((_, i) => i).filter(i => away[i] <= reach);
    return near.length ? near[Math.floor(this.random() * near.length)] : away.indexOf(Math.min(...away));
  }
  startColumn(enemy) {
    const ai = this.config.bossAI[enemy.type], { left, right, top, bottom } = this.config.arena.bounds;
    const { start, end } = this.map?.column || { start: [[left, top], [left, bottom]], end: [[right, top], [right, bottom]] };
    const span = Math.hypot(start[1][0] - start[0][0], start[1][1] - start[0][1]), travel = Math.hypot(end[0][0] - start[0][0], end[0][1] - start[0][1]), gapShare = ai.columnGapUnits / span;
    this.s.column = { start, end, at: 0, seconds: travel / ai.columnSpeed, gapFrom: gapShare / 2 + this.random() * (1 - gapShare * 2), gapShare, damage: enemy.damage, width: ai.columnWidth, spent: false };
  }
  /** Where the marching line stands now, as the two stretches either side of its gap. */
  get columnLine() {
    const column = this.s.column;
    if (!column) return null;
    const { start, end, at, gapFrom, gapShare } = column, lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = lerp(start[0], end[0], at), b = lerp(start[1], end[1], at);
    return { a, b, gapA: lerp(a, b, gapFrom), gapB: lerp(a, b, gapFrom + gapShare) };
  }
  tickBossHazards(dt) {
    const { s, p } = this, bell = s.enemies.find(e => e.bellUntil > s.time);
    if (!bell) s.bellWatch = null;
    else if (s.bellWatch && (Math.hypot(p.x - s.bellWatch.x, p.y - s.bellWatch.y) > BELL_DRIFT_UNITS || p.attack || p.lastCast?.at >= s.bellWatch.at)) { s.bellWatch = null; this.hurt(bell.damage); if (!this.active) return; }
    const column = s.column;
    if (!column) return;
    column.at += dt / column.seconds;
    if (column.at >= 1) { s.column = null; return; }
    const { a, b, gapA, gapB } = this.columnLine, near = (from, to) => this.onLane([from, to], column.width);
    if (!column.spent && (near(a, gapA) || near(gapB, b)) && this.hurt(column.damage)) column.spent = true;
  }
  /** A line for the player to read while a boss pattern is running. */
  get bossWarning() {
    const { time } = this.s, boss = this.s.enemies.find(e => e.boss && e.hp > 0);
    if (!boss) return '';
    if (boss.alarmUntil > time || boss.tell?.type === 'alarm') return '경보! 공격을 멈추세요';
    if (boss.bellUntil > time || boss.tell?.type === 'bell') return '종이 울립니다! 움직이지 마세요';
    if (boss.tell?.type === 'carpet') return '초록 카펫 위로 이동하세요';
    if (boss.tell?.type === 'column' || this.s.column) return '대열의 틈으로 지나가세요';
    return '';
  }
  executeEnemy(enemy) {
    const tell = enemy.tell; enemy.tell = null; enemy.state = 'recover'; enemy.ready = this.s.time + enemy.recovery;
    const p = this.p, ai = this.config.bossAI[enemy.type];
    const damage = () => this.hurt(enemy.damage);
    if (!enemy.boss) this.sense({ kind: 'mob', id: enemy.type });
    switch (tell.type) {
      case 'melee': if (inCone(tell, p, tell.angle, enemy.attackRange, this.config.rules.enemyMeleeArc)) damage(); break;
      case 'burst':
        enemy.hp = 0; this.effect('scrap', enemy.x, enemy.y, enemy.color, 0.6, 1); this.effect('ring', enemy.x, enemy.y, '#e8914e', 0.3, enemy.burstRadius); this.sense({ kind: 'burst' });
        if (distance(tell, p) < enemy.burstRadius) damage(); break;
      case 'dash': enemy.dash = { angle: tell.angle, elapsed: 0 }; break;
      case 'shot': this.fireBullet(enemy, tell.angle, enemy.projectileSpeed); break;
      // Music box: a ring of shots, turned a little each volley so the gaps move.
      case 'spiral': {
        enemy.spiralTurn = (enemy.spiralTurn || 0) + Math.PI / enemy.bullets;
        for (let i = 0; i < enemy.bullets; i++) this.fireBullet(enemy, enemy.spiralTurn + i * TAU_ENEMY / enemy.bullets, enemy.projectileSpeed);
        enemy.volleyLeft = (enemy.volleyLeft ?? enemy.volleys) - 1;
        if (enemy.volleyLeft > 0) { enemy.followup = { type: 'spiral', at: this.s.time + enemy.volleyGap }; enemy.ready = this.s.time; } else enemy.volleyLeft = undefined;
        break;
      }
      // Jack-in-the-box: springs up where the player stood when the circle appeared.
      case 'ambush': {
        const spot = { x: tell.targetX, y: tell.targetY };
        if (!this.map?.walkable || fitsMap(spot.x, spot.y, enemy.radius, this.map)) Object.assign(enemy, spot);
        enemy.hidden = false; this.sense({ kind: 'pop' });
        this.effect('ring', spot.x, spot.y, '#e8914e', 0.3, enemy.popRadius);
        if (distance(spot, p) < enemy.popRadius) damage(); break;
      }
      // Spinning top: rolls off in a straight line and bounces from walls until it winds down.
      case 'spin': enemy.spin = { angle: tell.angle, until: this.s.time + enemy.spinSeconds, hitReady: 0 }; break;
      // Drummer: no damage of its own; nearby soldiers move faster and shrug off hits for a while.
      case 'beat':
        for (const ally of this.s.enemies) if (ally !== enemy && !ally.boss && ally.hp > 0 && distance(ally, enemy) <= enemy.beatRadius) { ally.beatUntil = this.s.time + enemy.beatSeconds; ally.aggro = true; }
        this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.5, enemy.beatRadius); break;
      // Pikeman: a long thrust, then a shorter one re-aimed at where the player went.
      case 'thrust': case 'thrust2': {
        const length = tell.type === 'thrust' ? enemy.attackRange : enemy.followupLength, end = { x: tell.x + Math.cos(tell.angle) * length, y: tell.y + Math.sin(tell.angle) * length };
        if (segmentDistance(p, tell, end) <= enemy.thrustWidth + this.config.arena.playerRadius) damage();
        this.effect('beam', tell.x, tell.y, '#d1a85a', 0.2, 1, { targetX: end.x, targetY: end.y });
        if (tell.type === 'thrust') enemy.followup = { type: 'thrust2', at: this.s.time + enemy.followupDelay };
        break;
      }
      case 'doubleWave':
        if (distance(tell, p) < enemy.attackRange) damage();
        this.effect('ring', tell.x, tell.y, '#d86e76', 0.25, enemy.attackRange);
        enemy.followup = { type: 'eliteWave', at: this.s.time + enemy.followupDelay }; break;
      case 'eliteWave': if (distance(tell, p) < enemy.attackRange + enemy.followupRadiusBonus) damage(); this.effect('ring', tell.x, tell.y, '#d86e76', 0.25, enemy.attackRange + enemy.followupRadiusBonus); break;
      case 'claw': {
        const end = { x: tell.x + Math.cos(tell.angle) * ai.clawLength, y: tell.y + Math.sin(tell.angle) * ai.clawLength };
        if (segmentDistance(p, tell, end) <= ai.clawWidth + this.config.arena.playerRadius) damage();
        this.effect('beam', tell.x, tell.y, '#cf767a', 0.3, 1, { targetX: end.x, targetY: end.y }); break;
      }
      case 'magnet':
        this.s.casts.push({ id: this.id('magnet'), shape: 'magnet', x: tell.targetX, y: tell.targetY, radius: ai.magnetRadius, age: 0, duration: ai.magnetDuration, pull: ai.magnetPull, enemyDamage: enemy.damage, damageAt: ai.magnetDamageDelay, done: false }); break;
      // Suction: a cone in front of Roco drags the player in, then spits whoever reached its mouth back out.
      case 'suction':
        this.s.casts.push({ id: this.id('suction'), shape: 'suction', owner: enemy.id, x: enemy.x, y: enemy.y, angle: tell.angle, range: ai.suctionRange, degrees: ai.suctionDegrees, age: 0, duration: ai.suctionSeconds, pull: ai.suctionPull, spitRadius: ai.spitRadius, spitPush: ai.spitPush, enemyDamage: enemy.damage });
        enemy.ready = this.s.time + ai.suctionSeconds + enemy.recovery; break;
      // Stickers: seven 'defective' labels thrown one after another at wherever the player is standing then.
      // Each is marked before it lands; on the floor it slows the player, then peels off a moment later.
      case 'stickers':
        this.s.casts.push({ id: this.id('stickers'), shape: 'stickerVolley', owner: enemy.id, x: enemy.x, y: enemy.y, age: 0, left: ai.stickerCount, next: 0, gap: ai.stickerGap, warn: ai.stickerWarn, radius: ai.stickerRadius, duration: ai.stickerSeconds, slow: ai.stickerSlow });
        enemy.ready = this.s.time + ai.stickerCount * ai.stickerGap + enemy.recovery; break;
      case 'overcharge': if (distance(tell, p) <= ai.overchargeRadius + this.config.arena.playerRadius) damage(); this.effect('ring', tell.x, tell.y, '#e0a068', 0.4, ai.overchargeRadius); enemy.ready = this.s.time + ai.overchargeRecovery; break;
      case 'fan':
      case 'fanSecond':
        if (inCone(tell, p, tell.angle, ai.fanRange, ai.fanDegrees)) damage();
        this.effect('swing', tell.x, tell.y, '#dc817b', 0.25, ai.fanRange, { angle: tell.angle, phase: 2 });
        if (tell.type === 'fan') enemy.followup = { type: 'fanSecond', at: this.s.time + ai.followupDelay }; break;
      case 'march': {
        const lanes = this.marchLanes(enemy);
        if (lanes.some(lane => this.onLane(lane, ai.marchWidth))) damage();
        for (const [[ax, ay], [bx, by]] of lanes) this.effect('beam', ax, ay, '#cf767a', 0.35, 1, { targetX: bx, targetY: by }); break;
      }
      case 'alarm': enemy.alarmUntil = this.s.time + ai.alarmSeconds; enemy.ready = enemy.alarmUntil + enemy.recovery; break;
      case 'crane':
        if (tell.drops.some(drop => distance(drop, p) <= ai.craneRadius + this.config.arena.playerRadius)) damage();
        for (const { x, y } of tell.drops) { this.effect('ring', x, y, '#c9a66b', 0.3, ai.craneRadius); this.effect('scrap', x, y, '#c9a66b', 0.5, 1); }
        break;
      case 'bell':
        enemy.bellUntil = this.s.time + ai.bellSeconds; enemy.ready = enemy.bellUntil + enemy.recovery;
        this.s.bellWatch = { x: p.x, y: p.y, at: this.s.time }; break;
      case 'column': this.startColumn(enemy); break;
      case 'carpet': {
        const lanes = this.marchLanes(enemy, true);
        if (!this.onLane(lanes[tell.safe], ai.carpetSafeWidth)) damage();
        lanes.forEach(([[ax, ay], [bx, by]], i) => { if (i !== tell.safe) this.effect('beam', ax, ay, '#cf767a', 0.35, 1, { targetX: bx, targetY: by }); });
        break;
      }
      case 'trumpetWave': {
        const safeAngle = tell.angle, gap = ai.waveGapDegrees * Math.PI / 180;
        for (let i = 0; i < ai.waveCount; i++) { const angle = safeAngle + gap / 2 + (Math.PI * 2 - gap) * i / (ai.waveCount - 1); this.fireBullet(enemy, angle, ai.waveSpeed); }
        break;
      }
    }
  }
  /** One frame of a spinning top: straight on, turning back from whatever wall it meets, hurting on contact. */
  spinEnemy(enemy, dt) {
    const s = enemy.spin, step = enemy.spinSpeed * dt, before = { x: enemy.x, y: enemy.y };
    this.move(enemy, Math.cos(s.angle) * step, Math.sin(s.angle) * step);
    if (distance(before, enemy) < step * 0.5) {
      const across = Math.PI - s.angle, back = -s.angle;
      s.angle = [across, back, s.angle + Math.PI].find(angle => { const test = { ...enemy }; this.move(test, Math.cos(angle) * step, Math.sin(angle) * step); return distance(test, enemy) >= step * 0.5; }) ?? s.angle + Math.PI;
    }
    enemy.facing = s.angle;
    if (this.s.time >= s.hitReady && distance(this.p, enemy) <= enemy.radius + this.config.arena.playerRadius && this.hurt(enemy.damage)) s.hitReady = this.s.time + enemy.spinHitGap;
    if (this.s.time >= s.until) { enemy.spin = null; enemy.ready = this.s.time + enemy.recovery; }
  }
  fireBullet(enemy, angle, speed) { this.s.projectiles.push({ id: this.id('bullet'), x: enemy.x, y: enemy.y, angle, speed, radius: this.config.rules.enemyProjectileRadius, damage: enemy.damage, friendly: false, until: this.s.time + this.config.rules.enemyProjectileLifetime }); }
  updateEnemies(dt) {
    this.tickBossHazards(dt);
    if (!this.active) return;
    const flow = this.flowField;
    flow?.update(this.p.x, this.p.y);
    let activeMelee = this.s.enemies.filter(e => !e.boss && (e.tell || e.dash) && e.attack !== 'shot').length;
    for (const enemy of this.s.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.burnStacks = enemy.burnStacks.filter(t => t > this.s.time);
      if (enemy.burnStacks.length && this.s.time >= enemy.burnTick) {
        const info = this.c.statuses.find(s => s.id === 'burn');
        this.hitEnemy(enemy, info.damagePerSecond * info.tickInterval * enemy.burnStacks.length * (this.statusPower + this.upgradeAmount('statusDamage')), { dot: true, color: '#efaa71' });
        enemy.burnTick += info.tickInterval;
      }
      if (enemy.hp <= 0 || enemy.held || enemy.exposedUntil > this.s.time || enemy.stunUntil > this.s.time || enemy.alarmUntil > this.s.time || enemy.bellUntil > this.s.time) continue;
      if (enemy.dash) {
        const d = enemy.dash, start = { x: enemy.x, y: enemy.y };
        this.move(enemy, Math.cos(d.angle) * enemy.dashDistance / enemy.dashDuration * dt, Math.sin(d.angle) * enemy.dashDistance / enemy.dashDuration * dt);
        if (segmentDistance(this.p, start, enemy) <= enemy.radius + this.config.arena.playerRadius) this.hurt(enemy.damage);
        if (!this.active) return;
        d.elapsed += dt; if (d.elapsed >= enemy.dashDuration) enemy.dash = null; continue;
      }
      if (enemy.spin) { this.spinEnemy(enemy, dt); if (!this.active) return; continue; }
      if (enemy.tell) { if (this.s.time >= enemy.tell.until) this.executeEnemy(enemy); if (!this.active) return; continue; }
      if (enemy.followup) {
        const next = enemy.followup; enemy.followup = null;
        this.beginEnemyTell(enemy, next.type, Math.max(this.config.rules.minimumFollowupTell, next.at - this.s.time)); continue;
      }
      const a = Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x), d = distance(this.p, enemy);
      if (!enemy.aggro) { if (d > this.config.rules.aggroUnits) continue; this.rouse(enemy); }
      // An ambusher travels underground between strikes and cannot be hit there.
      enemy.hidden = enemy.attack === 'ambush' && this.s.time >= enemy.ready;
      enemy.facing = a;
      if (this.s.time >= enemy.ready && (enemy.boss || d < enemy.attackRange) && (enemy.boss || enemy.attack === 'shot' || activeMelee < this.config.rules.maxActiveMelee)) {
        const type = enemy.boss ? this.nextBossPattern(enemy) : enemy.attack;
        this.beginEnemyTell(enemy, type); if (!enemy.boss && enemy.attack !== 'shot') activeMelee++;
      } else if (!enemy.stationary && d > this.config.rules.enemyStopDistance[enemy.boss ? 'boss' : RANGED_ATTACKS.includes(enemy.attack) ? 'ranged' : 'melee']) {
        const chill = this.c.statuses.find(s => s.id === 'chill');
        const slow = enemy.statuses.chill > this.s.time ? (enemy.boss ? Math.min(this.c.caps.bossSlow, chill.slow * this.statusPower) : chill.slow * this.statusPower) : 0;
        const step = enemy.speed * (1 - slow) * (enemy.beatUntil > this.s.time ? 1 + this.config.enemies.drummer.beatHaste : 1) * dt, way = (d > DIRECT_UNITS ? flow?.heading(enemy.x, enemy.y) : null) ?? a;
        this.move(enemy, Math.cos(way) * step, Math.sin(way) * step);
      }
    }
    // Separate bodies gently without pushing through walls.
    const living = this.s.enemies.filter(e => e.hp > 0);
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const a = living[i], b = living[j], d = distance(a, b), overlap = a.radius + b.radius - d;
      if (overlap > 0 && d > 0) { const angle = Math.atan2(b.y - a.y, b.x - a.x); this.move(b, Math.cos(angle) * overlap * 0.5, Math.sin(angle) * overlap * 0.5); }
    }
  }
  updateProjectiles(dt) {
    for (const b of this.s.projectiles) {
      const before = { x: b.x, y: b.y }, step = b.speed * dt;
      this.move(b, Math.cos(b.angle) * step, Math.sin(b.angle) * step, b.radius);
      if (distance(before, b) < step * 0.6) b.until = 0;
      if (b.friendly) {
        const target = this.s.enemies.find(e => e.hp > 0 && segmentDistance(e, before, b) < e.radius + b.radius);
        if (target) { this.hitEnemy(target, b.damage); b.until = 0; }
      } else if (segmentDistance(this.p, before, b) <= this.config.arena.playerRadius + b.radius) { this.hurt(b.damage); b.until = 0; }
      if (!this.active) return;
    }
    this.s.projectiles = this.s.projectiles.filter(b => b.until > this.s.time);
  }
  /** Village time: only feet move, and stepping into the exit leaves for the next place. */
  walk(dt, input) {
    this.stepFeet(dt, input, this.village.bodyRadius);
    const { p } = this;
    this.tutorial.tick();
    if (!pointInPolygon(p.x, p.y, this.village.exit.polygon)) return;
    if (this.s.mode === 'shop') this.nextNode(0);
    else if (this.s.mode === 'hub' && this.readyToLeave) this.startRun();
    else if (this.s.mode === 'hub') { p.y -= LEAVE_REFUSED_UNITS; this.notify('모루에게 속성 2개를 고른 뒤 출발하세요.'); }
  }
  /** One step of a dodge already under way. */
  moveDodge(dt, radius) {
    const p = this.p, d = this.c.player.dodge, stepTime = Math.min(dt, d.duration - p.dodge.elapsed);
    this.move(p, Math.cos(p.dodge.angle) * d.distance / d.duration * stepTime, Math.sin(p.dodge.angle) * d.distance / d.duration * stepTime, radius);
    p.dodge.elapsed += dt; if (p.dodge.elapsed >= d.duration - 1e-7) p.dodge = null;
  }
  /** Out of a fight the body still dodges; after a cleared room the wrench still swings, in town it does not. */
  stepFeet(dt, input, radius, swing = false) {
    dt = Math.min(dt, 1 / 30); this.s.time += dt; this.s.tick++;
    const p = this.p, { x = 0, y = 0 } = input, length = Math.hypot(x, y);
    if (swing && input.aim && distance(p, input.aim) > 0.1) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    if (input.dodge) this.dodge();
    if (p.dodge) this.moveDodge(dt, radius);
    else if (length > 0) {
      const scale = Math.max(1, length), speed = this.c.player.speed * (1 + (this.stats.moveSpeed || 0));
      p.angle = p.moveAngle = Math.atan2(y, x);
      this.move(p, x / scale * speed * dt, y / scale * speed * dt, radius);
    }
    if (swing) { if (input.basic) this.basicAttack(); this.updateBasic(dt); }
    this.s.notices = this.s.notices.filter(e => e.until > this.s.time);
  }
  /** Built once per room: the floor never changes, only where the player stands on it. */
  get flowField() {
    const map = this.map;
    if (!map?.walkable) return null;
    this.flows ??= new Map();
    if (!this.flows.has(map.id)) this.flows.set(map.id, new FlowField(map, map.size || [this.config.arena.width, this.config.arena.height]));
    return this.flows.get(map.id);
  }
  spawnWaveEnemy(type, spot) {
    const enemy = this.spawnEnemy(type, spot);
    const { power } = this.room;
    enemy.hp = enemy.maxHp = Math.round(enemy.hp * power); enemy.damage = Math.max(1, Math.round(enemy.damage * power * this.config.rules.waveDamageShare));
    // Wave bodies wait where they stand until the player comes near; nothing rushes in from across the map.
    enemy.aggro = false;
  }
  /** Anywhere on the floor, well away from the player and from bodies already placed, so a room fills evenly. */
  spreadSpot() {
    const { spreadMinUnits, spreadGapUnits } = this.config.rules, map = this.map, { arena } = this.config, radius = 0.6;
    const [width, height] = map?.size || [arena.width, arena.height], taken = [...this.s.enemies.filter(e => e.hp > 0), ...(this.s.run?.arrivals || [])], flow = this.flowField;
    flow?.update(this.p.x, this.p.y);
    for (let tries = 0; tries < 80; tries++) {
      const spot = { x: this.random() * width, y: this.random() * height };
      const floor = map?.walkable ? fitsMap(spot.x, spot.y, radius, map) : spot.x > arena.bounds.left && spot.x < arena.bounds.right && spot.y > arena.bounds.top && spot.y < arena.bounds.bottom;
      if (floor && (!flow || flow.reachable(spot.x, spot.y)) && distance(spot, this.p) >= spreadMinUnits && taken.every(other => distance(spot, other) >= spreadGapUnits)) return spot;
    }
    return this.arrivalSpot();
  }
  /** A waiting body notices the player, and so do the ones standing beside it. */
  rouse(enemy) {
    const { aggroLinkUnits, } = this.config.rules, woken = [enemy];
    enemy.aggro = true; enemy.ready = Math.max(enemy.ready, this.s.time + this.config.rules.enemyInitialDelay);
    while (woken.length) {
      const from = woken.pop();
      for (const other of this.s.enemies) if (!other.aggro && other.hp > 0 && distance(from, other) <= aggroLinkUnits) { other.aggro = true; other.ready = Math.max(other.ready, this.s.time + this.config.rules.enemyInitialDelay); woken.push(other); }
    }
  }
  /** Somewhere on the floor, off the player's feet but close enough to arrive soon. */
  arrivalSpot() {
    const { waveMinUnits: near, waveMaxUnits: far } = this.config.rules, map = this.map, { p } = this, radius = 0.6, { arena } = this.config;
    for (let tries = 0; tries < 40; tries++) {
      const angle = this.random() * Math.PI * 2, reach = near + this.random() * (far - near), spot = { x: p.x + Math.cos(angle) * reach, y: p.y + Math.sin(angle) * reach };
      if (map ? fitsMap(spot.x, spot.y, radius, map) : spot.x > arena.bounds.left && spot.x < arena.bounds.right && spot.y > arena.bounds.top && spot.y < arena.bounds.bottom) return spot;
    }
    return map?.enemySpawns.reduce((best, spot) => distance(spot, p) > distance(best, p) ? spot : best) || { ...arena.spawn };
  }
  get wavesLeft() {
    const { run } = this.s, waves = this.room?.waves;
    return !!waves && (run.wave < waves.length - 1 || run.arrivals.length > 0);
  }
  /** Each wave is marked on the floor first, so nobody appears on top of the player unannounced. */
  callWave() {
    const { run } = this.s, { waveWarnSeconds } = this.config.rules;
    run.wave++;
    for (const type of this.room.waves[run.wave]) {
      const spot = this.spreadSpot();
      run.arrivals.push({ type, ...spot, at: this.s.time + waveWarnSeconds });
      this.effect('friendlyTell', spot.x, spot.y, '#e0a03c', waveWarnSeconds, 0.7);
    }
  }
  tickWaves() {
    const { run } = this.s;
    if (this.s.mode !== 'combat' || !this.room?.waves) return;
    const waiting = run.arrivals.length;
    run.arrivals = run.arrivals.filter(({ type, x, y, at }) => { if (at > this.s.time) return true; this.spawnWaveEnemy(type, { x, y }); return false; });
    if (run.arrivals.length < waiting) this.sense({ kind: 'summon' });
    const living = this.s.enemies.filter(e => e.hp > 0).length;
    if (!run.arrivals.length && run.wave < this.room.waves.length - 1 && living <= this.config.rules.waveCallsAtLiving) this.callWave();
  }
  /** The portal only takes someone walking into it, so a player already standing there is not whisked away. */
  walkToPortal(dt, input) {
    this.stepFeet(dt, input, this.config.arena.playerRadius, true);
    const near = distance(this.p, this.portal) <= PORTAL_REACH_UNITS, run = this.s.run;
    if (!near) run.portalArmed = true;
    else if (run.portalArmed) { run.portalArmed = false; this.nextNode(0); }
  }
  /** The last enemy gets a moment to fall before anything covers the room. */
  holdClear() {
    this.s.projectiles = this.s.projectiles.filter(b => b.friendly); this.s.column = null;
    this.s.casts = this.s.casts.filter(c => !HOSTILE_SHAPES.includes(c.shape));
    this.s.clearAt ??= this.s.time + CLEAR_HOLD_SECONDS;
    if (this.s.time >= this.s.clearAt) this.finishCombat();
  }
  update(dt, input = {}) {
    if (this.walking) return this.walk(dt, input);
    if (this.leaving) return this.walkToPortal(dt, input);
    if (!this.active) return;
    if (this.wakeProgress !== null) { this.s.time += Math.min(dt, 1 / 30); this.s.tick++; return; }
    dt = Math.min(dt, 1 / 30); this.s.time += dt; this.s.tick++;
    if (this.s.run) this.s.run.elapsed += dt;
    const p = this.p;
    if (input.aim && distance(p, input.aim) > 0.1) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    let dx = input.x || 0, dy = input.y || 0;
    const length = Math.hypot(dx, dy);
    if (length > 0) { dx /= Math.max(1, length); dy /= Math.max(1, length); p.moveAngle = Math.atan2(dy, dx); }
    else if (!p.dodge) p.moveAngle = p.angle;
    if (input.dodge) this.dodge();
    if (p.dodge) {
      this.moveDodge(dt);
      const slip = this.trait('slipstream');
      if (slip) for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(p, enemy) <= enemy.radius + slip.radius) enemy.statuses.windPressure = this.s.time + this.c.statuses.find(s => s.id === 'windPressure').duration;
    // A wrench swing plants the feet: the player stands still until the swing and its recovery end.
    } else if (!p.attack && !this.s.casts.some(c => c.shape === 'dash')) {
      const stuck = this.s.casts.find(c => c.shape === 'sticker' && distance(p, c) < c.radius);
      const speed = this.c.player.speed * (1 + (this.stats.moveSpeed || 0)) * (stuck ? 1 - stuck.slow : 1);
      this.move(p, dx * speed * dt, dy * speed * dt);
    }
    if (input.basic) this.basicAttack();
    if (input.skill !== undefined) this.castSkill(input.skill, input.aim);
    if (input.fusion) this.castFusion(input.aim);
    this.updateBasic(dt);
    // Hostile fields (magnet, suction, stickers) use the same paused simulation clock but no friendly cast path.
    for (const cast of this.s.casts.filter(c => c.shape === 'suction')) {
      cast.age += dt;
      const owner = this.s.enemies.find(e => e.id === cast.owner && e.hp > 0);
      if (!owner) { cast.done = true; continue; }
      cast.x = owner.x; cast.y = owner.y;
      if (inCone(cast, p, cast.angle, cast.range, cast.degrees) && !p.dodge) { const angle = Math.atan2(cast.y - p.y, cast.x - p.x); this.move(p, Math.cos(angle) * cast.pull * dt, Math.sin(angle) * cast.pull * dt); }
      if (cast.age >= cast.duration) {
        cast.done = true;
        if (distance(p, cast) <= cast.spitRadius + this.config.arena.playerRadius) { const angle = Math.atan2(p.y - cast.y, p.x - cast.x); this.hurt(cast.enemyDamage); this.move(p, Math.cos(angle) * cast.spitPush, Math.sin(angle) * cast.spitPush); if (!this.active) return; }
      }
    }
    for (const cast of this.s.casts.filter(c => c.shape === 'stickerVolley')) {
      cast.age += dt;
      while (cast.left > 0 && cast.age >= cast.next) { this.s.casts.push({ id: this.id('stickerFall'), shape: 'stickerFall', x: p.x, y: p.y, radius: cast.radius, age: 0, warn: cast.warn, duration: cast.duration, slow: cast.slow }); cast.left--; cast.next += cast.gap; }
      if (cast.left <= 0) cast.done = true;
    }
    for (const cast of this.s.casts.filter(c => c.shape === 'stickerFall')) {
      cast.age += dt;
      if (cast.age >= cast.warn) { cast.done = true; this.s.casts.push({ id: this.id('sticker'), shape: 'sticker', x: cast.x, y: cast.y, radius: cast.radius, age: 0, duration: cast.duration, slow: cast.slow, tilt: this.random() * 0.8 - 0.4 }); this.effect('scrap', cast.x, cast.y, '#e8dcb8', 0.25, 0.5); }
    }
    for (const cast of this.s.casts.filter(c => c.shape === 'sticker')) { cast.age += dt; if (cast.age >= cast.duration) cast.done = true; }
    for (const cast of this.s.casts.filter(c => c.shape === 'magnet')) {
      cast.age += dt;
      if (distance(p, cast) < cast.radius) {
        const angle = Math.atan2(cast.y - p.y, cast.x - p.x); this.move(p, Math.cos(angle) * cast.pull * dt, Math.sin(angle) * cast.pull * dt);
        if (!cast.struck && cast.age >= cast.damageAt) { this.hurt(cast.enemyDamage); cast.struck = true; }
        if (!this.active) return;
      }
      if (cast.age >= cast.duration) cast.done = true;
    }
    const hostile = this.s.casts.filter(c => HOSTILE_SHAPES.includes(c.shape) && !c.done);
    this.s.casts = this.s.casts.filter(c => !HOSTILE_SHAPES.includes(c.shape));
    this.updateCasts(dt); this.s.casts.push(...hostile);
    this.updateEnemies(dt);
    if (!this.active) return;
    this.updateProjectiles(dt);
    if (!this.active) return;
    this.s.effects = this.s.effects.filter(e => e.until > this.s.time);
    this.s.notices = this.s.notices.filter(e => e.until > this.s.time);
    this.tutorial.tick(); this.tickPractice(); this.tickWaves();
    if (this.active && this.s.enemies.length && this.s.enemies.every(e => e.hp <= 0) && !this.wavesLeft) { if (this.s.mode === 'combat') this.holdClear(); else this.finishCombat(); }
  }
  finishCombat() {
    if (!this.active) return false;
    if (this.s.mode === 'intro') {
      if (!this.s.profile.introRewardClaimed) { this.s.profile.freeGears += this.data.progression.intro.oneTimeEncounterReward; this.s.profile.introRewardClaimed = true; }
      this.clearCombat();
      if (this.tutorial.step) this.tutorial.guardBeaten(); else this.reachWorkshop();
      this.save(); return true;
    }
    this.sense({ kind: 'clear' });
    const run = this.s.run, key = `${run.id}:${this.room.id}`;
    if (!this.s.profile.rewards.includes(key)) {
      const region = this.data.progression.region;
      const reward = this.room.kind === 'miniboss' ? region.miniReward : this.room.kind === 'regionBoss' ? region.bossReward : region.normalReward;
      const gears = Math.round(reward * (1 + (this.stats.gearGain || 0)));
      this.s.profile.freeGears += gears; run.baseGears += gears; this.s.profile.rewards.push(key);
      run.coins += Math.round(this.data.progression.economy.runCoinRewards[this.room.kind === 'normal' ? 'normal' : this.room.kind] * (1 + (this.stats.coinGain || 0)));
      run.clears.push(this.room.id); this.s.profile.combatClears++;
      if (this.room.kind === 'regionBoss') this.heal(this.data.progression.run.regionBossClearHeal);
      this.sense({ kind: 'loot' });
    }
    this.clearCombat();
    if (this.room.boss) this.s.mode = 'unwind'; else this.offerRewards();
    this.save(); return true;
  }
  /** Out of the scrapyard and into the town square, on foot and not yet known to anyone. */
  reachWorkshop() {
    this.s.tutorial = { step: 'town' }; this.s.mode = 'registration'; this.clearCombat();
    const town = this.hubMap;
    if (town) Object.assign(this.p, { x: town.arrival.x, y: town.arrival.y });
    this.save();
  }
  unwind() {
    if (this.s.mode !== 'unwind') return false;
    const boss = this.room.boss;
    if (!this.s.profile.bossRecords.includes(boss)) {
      this.s.profile.bossRecords.push(boss);
      if (boss === 'captainBrass') this.s.profile.blueprints.push('patrolBlueprint');
    }
    this.offerRewards(); this.save(); return true;
  }
  rarity() {
    let roll = this.random();
    for (const [key, weight] of Object.entries(this.c.balance.baseRewardRarityWeights)) { roll -= weight; if (roll <= 0) return key; }
    return 'common';
  }
  sample(list, count) {
    const pool = [...list], picked = [];
    while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return picked;
  }
  /** Skill mods and traits for what is equipped now; owned ones leave the pool. */
  buildRewards() {
    const run = this.s.run, elements = this.slots.map(slot => slot.element), skills = this.c.skills.filter(s => elements.includes(s.element)).map(s => s.id);
    return [
      ...this.config.skillMods.filter(m => skills.includes(m.skill) && !run.skillMods?.includes(m.id)).map(m => ({ kind: 'skillMod', id: m.id })),
      ...this.config.elementTraits.filter(t => elements.includes(t.element) && !run.traits?.includes(t.id)).map(t => ({ kind: 'trait', id: t.id }))
    ];
  }
  /** Every reward card has a tier: common, rare or special. */
  rewardTier(reward) {
    const { rules, mods, skillMods, elementTraits, rewards } = this.config;
    if (reward.kind === 'mod') return mods.find(m => m.id === reward.id).tier;
    if (reward.kind === 'skillMod') return skillMods.find(m => m.id === reward.id).tier;
    if (reward.kind === 'trait') return elementTraits.find(t => t.id === reward.id).tier;
    if (reward.kind === 'upgrade') return rewards[reward.id].tier;
    if (reward.kind === 'heal') return rules.healRewards.find(h => h.id === reward.id).tier;
    if (reward.kind === 'gears') return rules.gearReward.tier;
    return reward.kind === 'level' ? rules.skillLevelTier : 'common';
  }
  /** Rolls a tier by weight, then a card of that tier; a tier with nothing left falls back to any card. */
  drawByTier(pool) {
    let roll = this.random(), tier = 'common';
    for (const [key, weight] of Object.entries(this.config.rules.rewardTierWeights)) { roll -= weight; if (roll <= 0) { tier = key; break; } }
    const same = pool.filter(reward => this.rewardTier(reward) === tier);
    return this.sample(same.length ? same : pool, 1)[0];
  }
  /** Run parts not yet maxed, skill levels below the cap, and repairs while the body is damaged. */
  partRewards() {
    const run = this.s.run, elements = this.slots.map(s => s.element);
    const parts = this.c.balance.temporaryUpgrades.filter(u => (run.upgrades[u.id] || 0) < u.maxRank && (u.id !== 'skillCooldownReduction' || elements.length) && (u.id !== 'statusDamage' || elements.includes('fire'))).map(u => ({ kind: 'upgrade', id: u.id }));
    const levels = this.slots.map((slot, i) => slot.level < this.c.balance.skillMaxLevel ? { kind: 'level', id: i } : null).filter(Boolean);
    const repairs = this.p.hp < this.p.maxHp ? this.config.rules.healRewards.map(h => ({ kind: 'heal', id: h.id })) : [];
    return [...parts, ...levels, ...repairs, { kind: 'gears', amount: this.config.rules.gearReward.amount }];
  }
  offerRewards() {
    const run = this.s.run;
    if (!run.rewardChoices.length) {
      let choices = [];
      if (this.room.guaranteedMod && run.mods.length < this.data.progression.run.wrenchModsMax) { const pool = this.config.mods.filter(m => !run.mods.includes(m.id)).map(m => ({ kind: 'mod', id: m.id })); while (choices.length < 3 && pool.length) choices.push(pool.splice(pool.indexOf(this.drawByTier(pool)), 1)[0]); }
      else {
        // One card always grows the equipped build; the rest come from parts, levels and repairs, drawn by tier.
        const build = this.buildRewards();
        choices = this.sample(build, 1);
        const pool = [...build.filter(reward => reward !== choices[0]), ...this.partRewards()];
        while (choices.length < 3 && pool.length) choices.push(pool.splice(pool.indexOf(this.drawByTier(pool)), 1)[0]);
      }
      run.rewardChoices = choices.slice(0, 3);
      this.sense({ kind: 'cards' });
    }
    this.s.mode = 'reward';
  }
  chooseReward(index, replacement = null) {
    if (this.s.mode !== 'reward') return false;
    const run = this.s.run, reward = run.rewardChoices[index];
    if (!reward) return false;
    if (reward.kind === 'element') {
      if (this.slots.some(s => s.element === reward.id)) return false;
      if (this.slots.length >= 2 && ![0, 1].includes(replacement)) return false;
      const slot = { element: reward.id, level: 1, rarity: reward.rarity };
      if (this.slots.length < 2) run.slots.push(slot);
      else { slot.level = run.slots[replacement].level; run.slots[replacement] = slot; }
    }
    if (reward.kind === 'upgrade') {
      run.upgrades[reward.id] = (run.upgrades[reward.id] || 0) + 1;
      if (reward.id === 'maxHp') { const amount = this.c.balance.temporaryUpgrades.find(u => u.id === 'maxHp').perRank; this.p.maxHp += amount; this.heal(amount); }
    }
    if (reward.kind === 'level' && this.slots[reward.id]) this.slots[reward.id].level = Math.min(this.c.balance.skillMaxLevel, this.slots[reward.id].level + this.config.rules.skillLevelOffer);
    if (reward.kind === 'mod') { if (run.mods.length >= this.data.progression.run.wrenchModsMax || run.mods.includes(reward.id)) return false; run.mods.push(reward.id); }
    if (reward.kind === 'skillMod') (run.skillMods ??= []).push(reward.id);
    if (reward.kind === 'trait') (run.traits ??= []).push(reward.id);
    if (reward.kind === 'heal') this.heal(this.config.rules.healRewards.find(h => h.id === reward.id).amount);
    if (reward.kind === 'gears') this.s.profile.freeGears += Math.round(reward.amount * (1 + (this.stats.gearGain || 0)));
    run.rewardChoices = []; this.sense({ kind: 'pick' });
    if (this.fusion) this.notify(`${this.fusion.name} 연결 · 축전 ${this.fusion.energyCost}을 모으면 융합`);
    if (run.node === this.config.rooms.length - 1) { this.s.mode = 'complete'; this.s.profile.wins++; }
    else this.s.mode = 'route';
    this.save(); return true;
  }
  nextNode(branch = 0) {
    if (this.s.mode !== 'route' && this.s.mode !== 'shop') return false;
    if (![0, 1].includes(branch)) return false;
    this.s.run.node++; this.s.run.branches.push(branch); this.sense({ kind: 'portal' });
    // Both alternatives are authored encounters at the same depth.
    const plan = this.s.run.plan[this.s.run.node], room = this.room;
    if (room.variants) plan.variant = (plan.variant + branch) % room.variants.length;
    this.enterNode(); return true;
  }
  buyShop(id) {
    if (this.s.mode !== 'shop') return false;
    const item = this.data.progression.economy.shop.find(i => i.id === id), run = this.s.run;
    if (!item || !['heal', 'skillLevel', 'persistentGears'].includes(id) || run.coins < item.cost || (item.oncePerShop && run.shopBought.includes(id))) return false;
    if (id === 'heal' && this.p.hp >= this.p.maxHp) return false;
    const slot = this.slots.find(s => s.level < this.c.balance.skillMaxLevel);
    if (id === 'skillLevel' && !slot) return false;
    run.coins -= item.cost;
    if (id === 'heal') this.heal(item.amount);
    if (id === 'skillLevel') slot.level++;
    if (id === 'persistentGears') this.s.profile.freeGears += item.amount;
    run.shopBought.push(id); this.save(); return true;
  }
  returnToHub(reason = 'abandon') {
    if (!this.s.run || !['combat', 'reward', 'route', 'shop', 'unwind', 'complete'].includes(this.s.mode)) return false;
    const run = this.s.run, profile = this.s.profile, economy = this.data.progression.economy;
    let bonus = 0;
    if (run.clears.length && !profile.firstReturnClaimed) { bonus = economy.firstReturnBonus; profile.freeGears += bonus; profile.firstReturnClaimed = true; }
    if (reason === 'defeat') this.sense({ kind: 'fail' });
    this.s.result = { reason, node: run.node + 1, elapsed: run.elapsed, baseGears: run.baseGears, bonus, seed: run.seed, damageTaken: run.damageTaken, elements: run.slots.map(s => s.element) };
    profile.history.unshift(this.s.result); profile.history = profile.history.slice(0, 10);
    this.clearCombat(); this.s.run = null; this.resetPlayer(); this.s.mode = 'returned'; this.save(); return true;
  }
  acknowledgeReturn() { if (this.s.mode !== 'returned') return false; this.s.mode = 'hub'; this.enterHub(); this.save(); return true; }
}
import {crosscutSegment,clampContains} from './fusion-geometry.js';
