import { createProfile, permanentStats, buyRank, refundAll } from './progression.js';
import { roomTitle } from './room-title.js';
import { fitsMap, pointInPolygon, placeOf } from './map-geometry.js';
// How far back from the spawn point the player starts, walking in from the map's edge.
const ENTRY_UNITS = 3.5;
import { Tutorial } from './tutorial.js';
import { FlowField } from './flow-field.js';
import { dealRun, formationSpots, ARRIVAL_NOTES } from './encounters.js';
import { dealHazards, SOLID, hazardBox, sawAt, plateState } from './hazards.js';

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
const HOSTILE_SHAPES = ['magnet', 'suction', 'stickerVolley', 'stickerFall', 'sticker', 'stompRing'];
const TAU_ENEMY = Math.PI * 2, RANGED_ATTACKS = ['shot', 'spiral', 'beat'];
const CRIT_RED = '#e8433a', JOLT_SECONDS = 0.12, LIGHT_KNOCKBACK = 0.15, HEAVY_KNOCKBACK = 0.35, FEEL_LIMIT = 64;
/** How far each blow carries the body forward (units), and how close an enemy in front stops it. */
const LUNGE = [0.25, 0.25, 0.5], LUNGE_STOP = 1.2;

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
  /** The room the run stands in, with the waves this run dealt for it (a run saved before dealing keeps the designed ones). */
  get room() {
    const run = this.s.run; if (!run) return null;
    const base = this.config.rooms[run.node], dealt = run.plan?.[run.node];
    if (!base.waves || !dealt?.waves) return base;
    if (this.dealtRoom?.base !== base || this.dealtRoom.dealt !== dealt) this.dealtRoom = { base, dealt, room: { ...base, waves: dealt.waves } };
    return this.dealtRoom.room;
  }
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
  /** Time spent in the game itself (not the title screen or a hidden tab), kept for the whole account. */
  addPlayTime(seconds) { if (seconds > 0) this.s.profile.playSeconds = (this.s.profile.playSeconds || 0) + seconds; }
  notify(text) { this.s.notices.push({ id: this.id('notice'), text, until: this.s.time + 3 }); }
  resetPlayer() {
    const stats = this.stats, spawn = this.config.arena.spawn;
    this.s.player = { ...spawn, hp: this.c.player.maxHp + (stats.maxHp || 0), maxHp: this.c.player.maxHp + (stats.maxHp || 0), energy: 0, angle: 0, moveAngle: 0, attack: null, combo: 0, comboExpires: 0, invulnerableUntil: 0, dodge: null, dodgeReady: 0, cooldowns: {}, fusionReady: 0 };
  }
  clearCombat() { this.s.clearAt = null; this.s.column = null; this.s.bellWatch = null; this.s.panel = null; this.s.enemies = []; this.s.blasts = []; this.s.hazards = []; this.s.parades = []; this.s.drill = null; this.p.confiscated = null; this.s.casts = []; this.s.projectiles = []; this.s.effects = []; this.p.attack = null; this.p.dodge = null; this.p.lastCast = null; }
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
    this.s.profile.registered = true; this.s.tutorial = null; this.s.mode = 'hub'; this.resetPlayer(); this.enterHub({ quiet: true });
    if (walkedIn) Object.assign(this.p, { x, y });
    this.save(); return true;
  }
  /** Quiet when Moru is still talking (right after the safety pin): a hint would sit over the dialogue. */
  enterHub({ quiet = false } = {}) {
    Object.assign(this.p, this.hubMap?.spawn);
    if (!quiet) this.notify('모루에게 다가가 말을 거세요 · 남쪽 큰길로 나가면 출발합니다.');
  }
  talk() {
    const npc = this.nearbyNpc;
    if (npc) this.s.panel = npc.opens;
    return !!npc;
  }
  closePanel() { this.s.panel = null; }
  openElements() { if (this.s.mode === 'hub') this.s.panel = 'elements'; }
  /** Gears for the next element: the first is Moru's gift, chosen right after the safety pin is fitted. */
  get nextElementPrice() {
    const { ownedElements, registered } = this.s.profile, prices = this.config.rules.elementPrices;
    if (ownedElements.length >= prices.length) return null;
    return ownedElements.length === 0 && !registered ? null : prices[ownedElements.length];
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
    // Every run deals its own mix and formation for each fight, at the designed weight (see encounters.js).
    dealRun(this.config.rooms, this.config.enemies, seed, this.config.eliteAffixes).forEach((dealt, i) => { if (dealt) Object.assign(this.s.run.plan[i], dealt); });
    this.resetPlayer(); this.enterNode(); return true;
  }
  spawnEnemy(type, position) {
    const boss = this.c.bosses.find(b => b.id === type), template = boss ? { ...boss, ...this.config.bossAI[type] } : this.config.enemies[type];
    const enemy = { ...template, ...position, home: { x: position.x, y: position.y }, id: this.id('enemy'), type, boss: !!boss, maxHp: template.hp, facing: Math.PI, state: 'approach', aggro: true, ready: this.s.time + this.config.rules.enemyInitialDelay, tell: null, pattern: 0, stagger: 0, exposedUntil: 0, staggerLock: 0, stunUntil: 0, statuses: {}, statusApplied: {}, burnStacks: [], chillCount: 0, freezeLock: 0, shockReady: 0, flashUntil: 0 };
    this.s.enemies.push(enemy); return enemy;
  }
  enterNode() {
    this.clearCombat();
    const room = this.room, plan = this.s.run.plan[this.s.run.node], map = this.map, spawn = map?.spawn || this.config.arena.spawn, spawns = map?.enemySpawns || this.config.spawns;
    this.p.x = spawn.x; this.p.y = spawn.y;
    this.s.mode = room.kind === 'shop' ? 'shop' : 'combat';
    // The player walks in from the map's nearest edge, so each place reads as joined to the last one.
    this.s.entry = null;
    const area = this.village || map;
    // Fights only: in a place to walk around (the rest stop) the player simply arrives at the door.
    if (area?.walkable && !this.village) {
      // A room may say which side it is entered from (the side facing the exit just taken); otherwise the nearest edge.
      const [w, h] = area.size, edges = [[-1, 0, spawn.x], [1, 0, w - spawn.x], [0, -1, spawn.y], [0, 1, h - spawn.y]].sort((a, b) => a[2] - b[2]);
      const SIDES = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] };
      const [ex, ey] = SIDES[map?.entrySide] || edges[0];
      let back = 0;
      for (let d = 0.25; d <= ENTRY_UNITS; d += 0.25) { if (!fitsMap(spawn.x + ex * d, spawn.y + ey * d, area.bodyRadius, area)) break; back = d; }
      if (back >= 1) { this.p.x = spawn.x + ex * back; this.p.y = spawn.y + ey * back; this.s.entry = { x: spawn.x, y: spawn.y, side: ex < 0 ? 'west' : ex > 0 ? 'east' : ey < 0 ? 'north' : 'south', until: this.s.time + back / this.c.player.speed + 0.3 }; }
    }
    if (room.boss) { this.spawnEnemy(room.boss, map?.bossSpawn || { x: 18, y: 8.5 }); this.notify(room.description); }
    else if (room.waves) {
      // Every run lays out its own crates, plates, saw rails, fences and music boxes on this floor.
      const rules = this.config.hazards;
      if (rules && map?.walkable && map.size) {
        plan.hazards ??= dealHazards(map, rules, (this.s.run.seed * 31 + this.s.run.node * 7919) >>> 0);
        this.s.hazards = plan.hazards.map(h => ({ ...h }));
      }
      Object.assign(this.s.run, { wave: 0, arrivals: [] });
      const spots = this.formation(plan.formations?.[0], room.waves[0]);
      room.waves[0].forEach((type, i) => this.spawnWaveEnemy(type, spots[i], plan.affixes?.[0]?.[i]));
      this.notify(roomTitle(room));
    }
    // Nobody strikes while the player is still walking in.
    if (this.s.entry) for (const e of this.s.enemies) e.ready = Math.max(e.ready || 0, this.s.entry.until + 0.4);
    this.save();
  }
  get obstacles() {
    // Crates, fences and music boxes stand in the way of feet and shots alike.
    const solid = this.s.mode === 'combat' && this.s.hazards?.length ? this.s.hazards.filter(h => SOLID.has(h.kind) && !h.gone).map(hazardBox) : [];
    if (this.s.mode === 'intro' || !this.s.run || this.map) return solid;
    return [...this.config.roomLayouts[this.s.run.plan[this.s.run.node].layout].obstacles, ...solid];
  }
  /** True when a body of `radius` at (x, y) would overlap a solid hazard. */
  inSolid(x, y, radius) { return this.obstacles.some(o => x + radius > o.x && x - radius < o.x + o.w && y + radius > o.y && y - radius < o.y + o.h); }
  move(body, dx, dy, radius = body.radius || this.config.arena.playerRadius) {
    const bounds = this.bounds;
    // A body already off the floor, such as one from an older save, may walk back onto it.
    const area = this.village || this.map, map = area?.walkable ? area : null, floor = map && fitsMap(body.x, body.y, radius, map) ? map : null;
    // Small steps prevent tunnelling, including dashes and knockback.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radius * 0.5)));
    const standing = this.village?.npcs || [];
    // A body already overlapping an obstacle (a crate set down beside it) may still step out of it.
    const overlap = (x, y, o) => x + radius > o.x && x - radius < o.x + o.w && y + radius > o.y && y - radius < o.y + o.h;
    const walls = this.obstacles.filter(o => !overlap(body.x, body.y, o));
    const blocked = (x, y) => (floor && !fitsMap(x, y, radius, floor)) || standing.some(npc => Math.hypot(x - npc.x, y - npc.y) < radius + NPC_BODY_UNITS) || walls.some(o => overlap(x, y, o));
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
    // A dodge always cuts the wrench short, at any point of any blow: the swing simply stops where it is.
    this.p.attack = null;
    const d = this.c.player.dodge;
    this.p.dodge = { elapsed: 0, angle: this.p.moveAngle, x: this.p.x, y: this.p.y };
    const gust = this.trait('dodgeGust');
    if (gust) for (const enemy of this.s.enemies) if (enemy.hp > 0 && !enemy.boss && !enemy.dummy && distance(this.p, enemy) <= gust.radius + enemy.radius) {
      const a = Math.atan2(enemy.y - this.p.y, enemy.x - this.p.x); this.move(enemy, Math.cos(a) * gust.knockback, Math.sin(a) * gust.knockback);
      this.effect('dodge', enemy.x, enemy.y, '#badbd3', 0.45, 1, { look: 'gust', angle: a });
    }
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
    const crack = basic && enemy.frozenUntil > this.s.time ? this.trait('frostCrack')?.damageBonus || 0 : 0;
    const runBonus = (basic ? this.upgradeAmount('basicDamage') : 0) + brand + crack;
    const level = slot ? 1 + (slot.level - 1) * this.c.balance.skillLevelDamagePerLevel : 1;
    const rarity = slot ? this.c.balance.rarityDamage[slot.rarity] : 1;
    return (1 + Math.min(this.c.caps.permanentConditionalDamageBonus, permanent)) * (1 + Math.min(this.c.caps.runDamageBonus, runBonus)) * level * rarity * (1 + (this.perk('overheatEngine')?.damageBonus || 0));
  }
  /** Skips the roll at zero chance so runs without the stat keep their random sequence. */
  rollCrit() {
    const chance = Math.min(this.c.caps.critChance + (this.perk('glassSpring')?.critBonus || 0), (this.c.player.critChance || 0) + (this.stats.critChance || 0) + (this.perk('glassSpring')?.critBonus || 0));
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
    // A trait shield gives way after a few blocked blows.
    if (guarded && enemy.shieldHits !== undefined && ++enemy.shieldHits >= (this.config.eliteAffixes?.list.find(a => a.id === 'brassShield')?.breakHits || Infinity)) {
      enemy.frontGuard = 0; enemy.shieldHits = undefined; enemy.shieldBroken = true; this.effect('scrap', enemy.x, enemy.y - enemy.radius, '#ffbe20', 0.5, 0.8);
    }
    // A boss behind its phase-break shield takes nothing; one just broken out of it takes more.
    if (enemy.breaking) { this.effect('spark', enemy.x, enemy.y - enemy.radius, '#7fc7e0', 0.2, 0.6); this.sense({ kind: 'block' }); return { crit: false, killed: false }; }
    const opened = enemy.vulnerableUntil > this.s.time ? 1 + enemy.vulnerableBonus : 1;
    const amount = opened * base * (options.dot ? 1 : this.damageMultiplier(enemy, !!options.basic, options.slot)) * (crit ? this.c.caps.critMultiplier + (this.stats.critDamage || 0) : 1) * (guarded ? 1 - enemy.frontGuard : 1);
    // Hitting a boss during its alarm brings the claw straight back at whoever did it.
    if (!options.dot && enemy.alarmUntil > this.s.time && this.hurt(enemy.damage)) this.effect('beam', enemy.x, enemy.y, '#cf767a', 0.45, 1, { targetX: this.p.x, targetY: this.p.y, look: 'thrust' });
    if (guarded) this.effect('spark', enemy.x, enemy.y - enemy.radius, '#d8dde2', 0.2, 0.6);
    const beaten = !options.dot && enemy.beatUntil > this.s.time ? 1 - this.config.enemies.drummer.beatArmor : 1;
    enemy.hp = enemy.dummy ? enemy.maxHp : Math.max(this.tutorial.guardSurvives ? 1 : 0, enemy.hp - amount * beaten); enemy.flashUntil = this.s.time + 0.09;
    this.checkPhaseBreak(enemy); if (enemy.boss) this.checkCarpets(enemy);
    // A blow to Roco's back shakes a confiscated skill out of his bag.
    if (enemy.type === 'collectorRoco' && !options.dot && this.p.confiscated && this.isConfiscated(this.p.confiscated.index)
      && Math.abs(angleDiff(Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x), enemy.facing)) * 180 / Math.PI >= this.config.bossAI.collectorRoco.confiscateBackDegrees) {
      this.p.confiscated = null; this.effect('spark', this.p.x, this.p.y, '#ffd257', 0.6, 1, { look: 'ready', follow: true }); this.notify('기술을 되찾았습니다!');
    }
    this.tutorial.onHit(enemy, !!options.basic);
    this.effect('number', enemy.x, enemy.y - enemy.radius, crit ? CRIT_RED : options.color || '#fff4cd', 0.65, amount, { crit });
    if (options.stagger) this.addStagger(enemy, options.stagger);
    const held = enemy.statuses.windPressure > this.s.time ? this.trait('galeHold')?.stunMultiplier || 1 : 1;
    if (!enemy.boss && options.stagger) enemy.stunUntil = Math.max(enemy.stunUntil, this.s.time + this.config.rules.normalHitStun * held);
    if (enemy.hp <= 0) {
      enemy.tell = null; this.effect('scrap', enemy.x, enemy.y, enemy.color || '#dbbc6b', 0.6, 1);
      if (enemy.statuses.chill > this.s.time && this.trait('coldReap')) this.refundCooldowns(this.trait('coldReap').cooldownRefund);
      const embers = this.trait('emberSpread');
      if (embers && enemy.burnStacks?.some(t => t > this.s.time)) {
        const cast = { id: this.id('embers'), staggerUsed: {}, fusion: false, statusAt: {} };
        for (const e of this.s.enemies) if (e !== enemy && e.hp > 0 && !e.dummy && distance(enemy, e) <= embers.range) { this.applyStatus(e, 'fire', cast); this.effect('ring', e.x, e.y, '#e8742f', 0.6, 0.6, { look: 'heatSwing', angle: Math.atan2(e.y - enemy.y, e.x - enemy.x) }); }
      }
      const spread = this.trait('shockSpread');
      if (spread && enemy.statuses.shock > this.s.time) {
        const next = this.s.enemies.filter(e => e !== enemy && e.hp > 0 && !e.dummy && distance(enemy, e) <= spread.range).sort((a, b) => distance(enemy, a) - distance(enemy, b))[0];
        if (next) { next.statuses.shock = Math.max(next.statuses.shock || 0, enemy.statuses.shock); this.effect('beam', enemy.x, enemy.y, '#ffe086', 0.6, 1, { targetX: next.x, targetY: next.y, look: 'spanner', chain: [] }); }
      }
      const harvest = this.wrenchMod('scrapHarvest');
      if (harvest) this.p.hasteUntil = this.s.time + harvest.duration;
      if (!enemy.dummy && this.upgradeAmount('killHeal')) this.heal(this.upgradeAmount('killHeal'), true);
      if (!enemy.dummy) this.sense({ kind: 'kill', boss: !!enemy.boss, last: !this.s.enemies.some(e => e !== enemy && e.hp > 0 && !e.dummy) });
      if (!enemy.dummy) this.payKill(enemy);
      if (enemy.affixes?.length) this.affixDeath(enemy);
    }
    return { crit, killed: enemy.hp <= 0 };
  }
  /** Queues a hit for the browser to feel; nobody drains it in tests, so it stops growing. */
  sense(hit) { if (this.feel.length < FEEL_LIMIT) this.feel.push(hit); }
  /** A wrench blow lands: the body jolts and light enemies give ground. */
  punch(enemy, attack, hit) {
    const heavy = attack.phase === 2, cos = Math.cos(attack.angle), sin = Math.sin(attack.angle);
    this.sense({ kind: heavy ? 'heavy' : 'hit', crit: hit.crit, angle: attack.angle });
    // The third blow lands with a ring and a puff of dust where it first strikes.
    if (heavy && !attack.waveShown) { attack.waveShown = true; this.effect('ring', enemy.x, enemy.y, '#fff4d6', 0.28, 1.2); this.effect('dust', enemy.x, enemy.y + enemy.radius * 0.6, '#b49f78', 0.45, 1); }
    // A small burst of light where the wrench meets the body; the third blow throws a bigger one.
    this.effect('impact', enemy.x, enemy.y - 0.7, heavy ? '#ffd257' : '#fff4d6', heavy ? 0.22 : 0.14, heavy ? 1.3 : 0.8, { angle: attack.angle });
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
    if (!status || enemy.immuneTo === status) return;
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
    for (const target of targets) { target.shockReady = this.s.time + info.targetCooldown; this.hitEnemy(target, info.dischargeDamage * this.statusPower, { color: '#ffe086' }); this.effect('spark', target.x, target.y, '#ffe086', 0.55, 0.7, { look: 'zap' }); }
  }
  updateBasic(dt) {
    const a = this.p.attack;
    if (!a) return;
    const haste = this.s.time < (this.p.hasteUntil || 0) ? this.wrenchMod('scrapHarvest')?.speedBonus || 0 : 0;
    a.elapsed += dt * (1 + (this.stats.attackSpeed || 0) + haste);
    const info = this.c.player.combo[a.phase], range = info.range + (this.wrenchMod('longWrench')?.rangeBonus || 0);
    // The spin wrench turns the third blow into a full circle round the body.
    const arc = a.phase === 2 && this.wrenchMod('spinSlash') ? 360 : this.config.rules.comboArcDegrees;
    // The wind-up carries the body forward into the blow, unless an enemy is already right in front.
    if (a.elapsed < info.windup && !this.s.enemies.some(e => e.hp > 0 && inCone(this.p, e, a.angle, LUNGE_STOP, this.config.rules.comboArcDegrees))) {
      const step = LUNGE[a.phase] * Math.min(dt * (1 + (this.stats.attackSpeed || 0) + haste), info.windup - (a.elapsed - dt)) / info.windup;
      if (step > 0) this.move(this.p, Math.cos(a.angle) * step, Math.sin(a.angle) * step);
    }
    if (a.elapsed >= info.windup && a.elapsed <= info.windup + info.active) {
      if (!a.shown) { this.effect('swing', this.p.x, this.p.y, '#fff5d9', info.active + 0.08, range, { angle: a.angle, phase: a.phase, arc }); a.shown = true; }
      this.breakSwing(a, range);
      if (!a.hazardsStruck) { a.hazardsStruck = true; this.strikeHazards(a.angle, range, arc); }
      for (const enemy of this.s.enemies) if (enemy.hp > 0 && !a.hit.includes(enemy.id) && inCone(this.p, enemy, a.angle, range, arc)) {
        a.hit.push(enemy.id); const hit = this.hitEnemy(enemy, info.damage * (a.empowered ? 1 + this.wrenchMod('dashStrike').damageBonus : 1), { basic: true, stagger: this.c.balance.basicStagger[a.phase] }); this.punch(enemy, a, hit);
        if (enemy.statuses.shock > this.s.time && this.trait('staticCharge')) { this.addEnergy(this.trait('staticCharge').energy); this.effect('spark', this.p.x, this.p.y, '#ffe086', 0.6, 1, { look: 'ready', follow: true }); }
        this.triggerShock(enemy);
        if (!a.energyGiven) { this.addEnergy(this.c.player.energyPerBasicPhase * (1 + (this.stats.energyGain || 0))); a.energyGiven = true; }
        if (a.phase === 2) {
          if (this.wrenchMod('windupRecoil') && this.p.dodgeReady > this.s.time) { this.p.dodgeReady = this.s.time; this.effect('spark', this.p.x, this.p.y, '#badbd3', 0.6, 1, { look: 'ready', follow: true }); }
          if (this.wrenchMod('elementalCharge') && enemy.hp > 0) { a.statusCast ??= { id: this.id('wrench'), staggerUsed: {}, fusion: false }; for (const slot of this.slots) this.applyStatus(enemy, slot.element, a.statusCast); if (this.slots.length) this.effect('spark', enemy.x, enemy.y, '#ffd257', 0.6, 1, { look: 'ready' }); }
        }
      }
      const deflect = this.wrenchMod('deflect');
      if (deflect) {
        const mod = deflect;
        for (const bullet of this.s.projectiles) if (!bullet.friendly && inCone(this.p, bullet, a.angle, range + deflect.reach, this.config.rules.comboArcDegrees)) { bullet.friendly = true; bullet.angle = a.angle; bullet.damage = mod.reflectedDamage; bullet.speed = mod.reflectedSpeed; this.effect('spark', bullet.x, bullet.y, '#86c0ac', 0.5, 1, { look: 'deflect' }); }
      }
      if (a.phase === 2 && !a.wave && this.s.run?.mods.includes('shockwave')) {
        a.wave = true; const mod = this.config.mods.find(m => m.id === 'shockwave');
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(this.p, enemy) <= mod.radius) this.hitEnemy(enemy, mod.damage, { basic: true });
        this.effect('ring', this.p.x, this.p.y, '#f0c369', 0.7, mod.radius, { look: 'quake' });
      }
    }
    if (a.elapsed >= info.windup + info.active + a.recovery) { this.p.attack = null; this.p.comboExpires = this.s.time + this.config.rules.comboReset; }
  }
  get slots() { return this.s.run?.slots || this.s.practice?.slots || []; }
  /** A whole-run perk the player picked (coins, risk), or null. */
  perk(id) { return this.s.run?.perks?.includes(id) ? this.config.perks.find(perk => perk.id === id) : null; }
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
    if (this.isConfiscated(index)) { if (this.s.time >= (this.p.confiscateNote || 0)) { this.p.confiscateNote = this.s.time + 1.5; this.notify('로코가 가져간 기술입니다. 로코의 등을 치면 되찾습니다.'); } return false; }
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
      if (mod.id === 'iceBurst') cast.finisher = mod.damage;
      if (mod.id === 'extraStrike') cast.hits += mod.extraHits;
      if (mod.id === 'vortexBlast') cast.finalKnockback = mod.knockback;
      if (mod.id === 'piercingBolt') cast.pierce = true;
      if (mod.id === 'flashFreeze') cast.chillBonus = mod.chillBonus;
      if (mod.id === 'overcurrent') cast.secondaryTargets += mod.extraTargets;
      if (mod.id === 'homingStrike') cast.homing = mod.homingRange;
      if (mod.id === 'driftingVortex') cast.drift = mod.speed;
      if (mod.id === 'emberTrail') cast.emberTrail = mod;
      if (mod.id === 'exhaustTrail') { cast.leaveBehind = true; cast.interval = mod.interval; }
      if (mod.id === 'frostShards') cast.shards = mod;
      if (mod.id === 'delayedDischarge') cast.delayed = mod;
      if (mod.id === 'piercingDash') cast.pierceDash = mod;
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
    if (['target', 'orb'].includes(cast.shape) && behavior.delay > 0) this.effect('friendlyTell', cast.x, cast.y, cast.color, behavior.delay, cast.radius, { skill: cast.skillId });
    if (cast.shape === 'projectile') {
      for (let i = 0; i < skill.hits; i++) cast.projectiles.push({ x: this.p.x, y: this.p.y, angle: angle + (i - (skill.hits - 1) / 2) * behavior.spread, travelled: 0, done: false });
    }
    this.s.casts.push(cast);
    if (cast.emberTrail) {
      const t = cast.emberTrail;
      for (let i = 0; i < t.spots; i++) {
        const a = angle + (i - (t.spots - 1) / 2) * 0.6, r = cast.range * 0.7;
        this.s.casts.push({ ...cast, id: this.id('cast'), derived: true, emberTrail: null, shape: 'patch', x: this.p.x + Math.cos(a) * r, y: this.p.y + Math.sin(a) * r, radius: t.radius, hits: t.pulses, interval: t.interval, next: 0.15, damage: cast.damage * t.damageShare, finisher: 0, felt: true, staggerUsed: {}, hit: [], statusAt: {} });
      }
    }
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
    // Wind throws enemies about: one shoved against a crate sets it off.
    if (cast.elements.includes('wind')) { const reach = this.config.hazards?.elements?.shoveCrateReach || 1; for (const h of this.s.hazards || []) if (h.kind === 'crate' && !h.gone && distance(h, enemy) <= reach) this.lightCrate(h, 0.3); }
  }
  /**
   * A skill reaching a room hazard (`touches(h)` says which): fire sets a crate off at once, ice cools a plate for a few
   * seconds, lightning runs along a saw rail and shocks whatever stands on it.
   */
  elementOnHazards(cast, touches) {
    const list = this.s.hazards, rules = this.config.hazards?.elements;
    if (!list?.length || !rules) return;
    const t = this.s.time;
    for (const h of list) {
      if (h.gone || !touches(h)) continue;
      if (h.kind === 'crate' && cast.elements.includes('fire')) this.lightCrate(h, 0.05);
      if (h.kind === 'plate' && cast.elements.includes('ice') && !(h.cooledUntil > t)) { h.cooledUntil = t + rules.frostSeconds; this.effect('ring', h.x, h.y, '#9fe3f0', 0.6, h.half, { look: 'frostShatter' }); }
      if (h.kind === 'rail' && cast.elements.includes('lightning') && !(h.chargedUntil > t + 0.5)) { h.chargedUntil = t + rules.chargeSeconds; h.chargeNext = t; this.effect('beam', h.x - h.dx, h.y - h.dy, '#ffe086', 0.5, 1, { targetX: h.x + h.dx, targetY: h.y + h.dy, look: 'zapLine' }); }
    }
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
          this.elementOnHazards(cast, h => segmentDistance(h, before, bullet) <= cast.width + 0.6);
          const target = this.s.enemies.filter(e => e.hp > 0 && !bullet.pierced?.includes(e.id) && segmentDistance(e, before, bullet) <= e.radius + cast.width).sort((a, b) => distance(before, a) - distance(before, b))[0];
          if (target) {
            this.castHit(cast, target, cast.damage * (bullet.share || 1));
            if (cast.skillId === 'frostBolt' && !bullet.shard) this.effect('ring', target.x, target.y, cast.color, 0.8, 0.5, { look: 'frostShatter' });
            if (cast.pierce) (bullet.pierced ??= []).push(target.id); else bullet.done = true;
            if (cast.shards && !bullet.shard) for (let i = 0; i < cast.shards.shards; i++) cast.projectiles.push({ x: target.x, y: target.y, angle: bullet.angle + (i - (cast.shards.shards - 1) / 2) * 0.9, travelled: 0, done: false, shard: true, share: cast.shards.damageShare, reach: cast.shards.range, pierced: [target.id] });
          }
          if (distance(before, bullet) < step * 0.5 || bullet.travelled >= (bullet.reach || cast.range)) bullet.done = true;
        }
        cast.done = cast.projectiles.every(p => p.done); continue;
      }
      if (cast.shape === 'dash') {
        const before = { x: this.p.x, y: this.p.y };
        this.move(this.p, Math.cos(cast.angle) * cast.range / cast.duration * dt, Math.sin(cast.angle) * cast.range / cast.duration * dt);
        this.elementOnHazards(cast, h => segmentDistance(h, before, this.p) <= cast.radius + 0.6);
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && !cast.hit.includes(enemy.id) && segmentDistance(enemy, before, this.p) <= cast.radius + enemy.radius) { cast.hit.push(enemy.id); this.castHit(cast, enemy); if (enemy.boss && cast.bossStagger) this.addStagger(enemy, cast.bossStagger, false); if (!enemy.boss && !cast.pierceDash) this.move(enemy, Math.cos(cast.angle) * cast.knockback, Math.sin(cast.angle) * cast.knockback); }
        if (!cast.streaked) { cast.streaked = true; this.effect('dodge', this.p.x, this.p.y, cast.color, cast.duration + 0.15, cast.radius, { look: 'dash', angle: cast.angle, follow: true }); }
        cast.done = cast.age >= cast.duration;
        if (cast.done && cast.pierceDash) for (const id of cast.hit) { const e = this.s.enemies.find(x => x.id === id && x.hp > 0 && !x.boss); if (e) this.effect('dodge', e.x, e.y, '#badbd3', 0.45, 1, { look: 'gust', angle: cast.angle + Math.PI }); if (e) this.move(e, -Math.cos(cast.angle) * cast.pierceDash.pull * 2, -Math.sin(cast.angle) * cast.pierceDash.pull * 2); }
        continue;
      }
      if (cast.leaveBehind) { if (cast.age + 1e-7 >= cast.next) { cast.x = cast.trailX ?? cast.startX; cast.y = cast.trailY ?? cast.startY; cast.trailX = this.p.x; cast.trailY = this.p.y; } }
      else if (cast.shape === 'self' || cast.shape === 'cone') { cast.x = this.p.x; cast.y = this.p.y; }
      if (cast.follow) { const target = this.s.enemies.find(e => e.id === cast.follow && e.hp > 0); if (target) { cast.x = target.x; cast.y = target.y; } }
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
          this.elementOnHazards(cast, h => first ? segmentDistance(h, this.p, first) <= 0.8 : inCone(this.p, h, cast.angle, cast.range, cast.acquisitionArc));
          if (first) {
            this.castHit(cast, first);
            if (cast.delayed) {
              const m = cast.delayed;
              this.s.casts.push({ ...cast, id: this.id('cast'), derived: true, delayed: null, shape: 'charge', follow: first.id, x: first.x, y: first.y, radius: m.radius, hits: 1, interval: 0, age: 0, pulse: 0, next: m.delay, damage: cast.damage * m.damageShare, finisher: 0, felt: false, staggerUsed: {}, hit: [], statusAt: {} });
              this.effect('friendlyTell', first.x, first.y, cast.color, m.delay, m.radius);
            }
            const jumps = cast.delayed ? [] : this.s.enemies.filter(e => e.hp > 0 && e.id !== first.id && distance(first, e) <= cast.chainRange).slice(0, cast.secondaryTargets);
            for (const e of jumps) this.castHit(cast, e, cast.secondaryDamage);
            // The spanner flies to the first enemy and the charge jumps on from it.
            this.effect('beam', this.p.x, this.p.y, cast.color, 0.6, 1, { targetX: first.x, targetY: first.y, look: 'spanner', chain: jumps.map(e => ({ x: e.x, y: e.y })) });
          }
        } else {
          if (cast.homing) { const near = this.s.enemies.filter(e => e.hp > 0 && distance(cast, e) <= cast.homing).sort((a, b) => distance(cast, a) - distance(cast, b))[0]; if (near) { cast.x = near.x; cast.y = near.y; } }
          if (cast.finalKnockback && cast.pulse === cast.hits - 1) for (const enemy of this.s.enemies) if (enemy.hp > 0 && !enemy.boss && distance(cast, enemy) <= cast.radius + enemy.radius) { const a = Math.atan2(enemy.y - cast.y, enemy.x - cast.x); this.move(enemy, Math.cos(a) * cast.finalKnockback, Math.sin(a) * cast.finalKnockback); }
          this.elementOnHazards(cast, h => cast.shape === 'cone' ? inCone(cast, h, cast.angle, cast.range, cast.arc) : distance(cast, h) <= cast.radius + 0.6);
          for (const enemy of this.s.enemies) if (enemy.hp > 0 && (cast.shape === 'cone' ? inCone(cast, enemy, cast.angle, cast.range, cast.arc) : distance(cast, enemy) <= cast.radius + enemy.radius)) { this.castHit(cast, enemy); if(cast.shape==='orb' && cast.knockback && !enemy.boss){const a=Math.atan2(enemy.y-cast.y,enemy.x-cast.x);this.move(enemy,Math.cos(a)*cast.knockback,Math.sin(a)*cast.knockback);} }
          const look = cast.skillId === 'heatSwing' ? 'heatSwing' : cast.shape === 'charge' ? 'zapBig' : cast.finalKnockback && cast.pulse === cast.hits - 1 ? 'quake' : undefined;
          this.effect(cast.shape === 'cone' ? 'swing' : 'ring', cast.x, cast.y, cast.color, look ? 0.7 : Math.max(0.18, cast.interval), cast.shape === 'cone' ? cast.range : cast.radius, { angle: cast.angle, phase: 1, arc: cast.arc, look, skill: cast.skillId });
        }
        cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= cast.hits && cast.age >= cast.next) {
        if (cast.finisher) for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(cast, enemy) <= cast.radius + enemy.radius) { this.castHit(cast, enemy, cast.finisher); if (cast.skillId === 'coolingField') this.effect('ring', enemy.x, enemy.y, cast.color, 0.8, 0.5, { look: 'frostShatter' }); }
        cast.done = true;
      }
    }
    this.s.casts = this.s.casts.filter(c => !c.done);
  }
  hurt(amount) {
    if (!this.active || this.s.time + 1e-7 < this.p.invulnerableUntil) return false;
    // The first lesson in the scrapyard teaches the dodge: a hit still flashes and stuns, but costs no health.
    amount *= this.s.mode === 'intro' ? 0 : (1 - (this.stats.damageReduction || 0)) * (1 + (this.perk('overheatEngine')?.damageTaken || 0));
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
    if (type === 'crateToss') enemy.tell.drops = this.craneDrops(enemy).slice(0, this.config.bossAI[enemy.type].crateTossCount);
    if (type === 'parade') { const live = this.marchLanes(enemy), n = this.liveLaneCount(enemy) >= 4 ? 2 : 1, order = live.map((_, i) => i).sort(() => this.random() - 0.5); enemy.tell.lanes = order.slice(0, n).map(i => live[i]); }
    enemy.state = 'tell';
  }
  /** A boss with phase breaks stops at each threshold, raises a shield and has to be broken out of it before losing more. */
  checkPhaseBreak(enemy) {
    const rules = enemy.boss && this.config.bossAI[enemy.type]?.phaseBreaks;
    if (!rules || enemy.breaking) return;
    enemy.breaksDone ??= [];
    const index = rules.findIndex((rule, i) => !enemy.breaksDone.includes(i) && enemy.hp <= enemy.maxHp * rule.at);
    if (index < 0) return;
    const rule = rules[index], now = this.s.time;
    enemy.hp = Math.max(enemy.hp, enemy.maxHp * rule.at); enemy.tell = null; enemy.spin = null; enemy.dash = null; enemy.followup = null; enemy.alarmUntil = 0; enemy.bellUntil = 0;
    this.s.casts = this.s.casts.filter(c => c.owner !== enemy.id);
    const angle = Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x);
    enemy.facing = angle;
    // Brass's breaks fill the square, so he marches back to where he first stood before laying them out.
    if (rule.kind !== 'cans' && enemy.home) Object.assign(enemy, enemy.home);
    const b = enemy.breaking = { index, kind: rule.kind, started: now, until: now + rule.seconds, angle, failAt: null };
    this.sense({ kind: 'phase' });
    if (rule.kind === 'cans') { Object.assign(b, { fed: 0, nextCan: now + 0.6, cans: [] }); this.notify('보호막! 날아오는 깡통을 렌치로 쳐서 로코 입에 되돌려 주세요.'); }
    if (rule.kind === 'drums') {
      // Four drums round the boss; they light in an order to copy, while a march lane keeps coming down on the player.
      const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => this.floorSpot(enemy, sx * rule.spreadX, sy * rule.spreadY));
      const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      Object.assign(b, { drums: spots.map(s => ({ ...s, flash: 0, done: false })), order, phase: 'show', step: 0, stepAt: now + 0.6, next: 0, lanes: [], nextLane: now + 2 });
      this.notify('보호막! 북이 빛나는 순서를 기억했다가 같은 순서로 두드리세요.');
    }
    if (rule.kind === 'flags') {
      // A ring of soldiers marches round the boss; three carry flags, and knocking those three down breaks the shield.
      const flags = new Set(); while (flags.size < rule.flags) flags.add(Math.floor(this.random() * rule.soldiers));
      Object.assign(b, { turn: 0, soldiers: Array.from({ length: rule.soldiers }, (_, i) => ({ slot: i, flag: flags.has(i), down: false, x: enemy.x, y: enemy.y })) });
      this.placeSoldiers(enemy, rule);
      this.notify('보호막! 깃발을 든 병정 3기를 쓰러뜨리세요.');
    }
  }
  /** A spot near the boss that lies on the floor, pulled toward the boss until it does. */
  floorSpot(enemy, dx, dy) {
    const map = this.map, { bounds } = this.config.arena;
    for (let k = 1; k > 0.2; k -= 0.1) {
      const spot = { x: enemy.x + dx * k, y: enemy.y + dy * k };
      if (map ? fitsMap(spot.x, spot.y, 0.6, map) : spot.x > bounds.left + 1 && spot.x < bounds.right - 1 && spot.y > bounds.top + 1 && spot.y < bounds.bottom - 1) return spot;
    }
    return { x: enemy.x + dx * 0.2, y: enemy.y + dy * 0.2 };
  }
  placeSoldiers(enemy, rule) {
    const b = enemy.breaking;
    for (const s of b.soldiers) { const a = b.turn + s.slot / rule.soldiers * Math.PI * 2; s.x = enemy.x + Math.cos(a) * rule.rx; s.y = enemy.y + Math.sin(a) * rule.ry; }
  }
  /** Each frame of a break: its own mechanics, then success, or the burst and heal when time runs out. */
  updatePhaseBreak(enemy, dt) {
    const rule = this.config.bossAI[enemy.type].phaseBreaks[enemy.breaking.index], b = enemy.breaking, p = this.p, now = this.s.time;
    if (b.failAt !== null) {
      // Out of time: a burst from the whole body, then the shield drops, the boss patches itself and the break waits again.
      if (now < b.failAt) return;
      if (this.hurt(rule.failDamage)) this.effect('ring', enemy.x, enemy.y, '#a92f2b', 0.5, 9);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * rule.failHeal);
      enemy.breaking = null; enemy.ready = now + enemy.recovery;
      this.notify(`${enemy.name}이(가) 몸을 고쳤습니다. 다시 깎아서 보호막을 깨세요.`); return;
    }
    if (b.kind === 'cans') { this.updateCans(enemy, rule, dt); if (!this.active) return; }
    if (b.kind === 'drums') { this.updateDrums(enemy, rule); if (!this.active) return; }
    if (b.kind === 'flags') {
      b.turn += rule.turn * dt; this.placeSoldiers(enemy, rule);
      if (b.soldiers.some(s => !s.down && distance(s, p) < rule.soldierRadius + this.config.arena.playerRadius)) { this.hurt(rule.soldierDamage); if (!this.active) return; }
    }
    const solved = b.kind === 'cans' ? b.fed >= rule.cans : b.kind === 'drums' ? b.next >= b.order.length : b.soldiers.filter(s => s.flag && s.down).length >= rule.flags;
    if (solved) {
      // The shield breaks: the boss stands stunned and open, and the next phase begins.
      enemy.breaking = null; enemy.breaksDone.push(b.index);
      enemy.exposedUntil = now + rule.stunSeconds; enemy.vulnerableUntil = now + rule.stunSeconds; enemy.vulnerableBonus = rule.vulnerable; enemy.ready = now + rule.stunSeconds;
      this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.6, 3); this.notify(`보호막이 깨졌습니다! ${enemy.name}이(가) 멈췄습니다.`); return;
    }
    if (now >= b.until) { b.failAt = now + rule.failWarn; b.cans = []; b.lanes = []; }
  }
  /** Roco: a wide suction draws in tin cans; three batted back into its mouth overload the shield. */
  updateCans(enemy, rule, dt) {
    const b = enemy.breaking, p = this.p, now = this.s.time;
    if (!p.dodge && distance(p, enemy) > enemy.radius + 1 && inCone(enemy, p, b.angle, rule.range, rule.degrees)) { const a = Math.atan2(enemy.y - p.y, enemy.x - p.x); this.move(p, Math.cos(a) * rule.pull * dt, Math.sin(a) * rule.pull * dt); }
    if (now >= b.nextCan) {
      const a = b.angle + (this.random() - 0.5) * rule.degrees * Math.PI / 180;
      b.cans.push({ id: this.id('can'), x: enemy.x + Math.cos(a) * rule.range, y: enemy.y + Math.sin(a) * rule.range, back: false, spin: 0 });
      b.nextCan = now + rule.canEvery;
    }
    for (const can of b.cans) {
      const a = Math.atan2(enemy.y - can.y, enemy.x - can.x), speed = rule.canSpeed * (can.back ? 2.2 : 1);
      can.x += Math.cos(a) * speed * dt; can.y += Math.sin(a) * speed * dt; can.spin += dt * 10;
      if (!can.back && distance(can, p) < rule.canRadius + this.config.arena.playerRadius) { can.done = true; this.hurt(rule.canDamage); if (!this.active) return; continue; }
      if (distance(can, enemy) < enemy.radius) { can.done = true; if (can.back) { b.fed++; this.effect('spark', enemy.x, enemy.y - enemy.radius, '#ffd257', 0.35, 1.2); this.sense({ kind: 'heavy' }); } }
    }
    b.cans = b.cans.filter(can => !can.done);
  }
  /** Brass's drums: watch the order they light in, then strike them in that order; a wrong drum replays the order. */
  updateDrums(enemy, rule) {
    const b = enemy.breaking, p = this.p, now = this.s.time;
    if (b.phase === 'show' && now >= b.stepAt) {
      if (b.step < b.order.length) { b.drums[b.order[b.step]].flash = now + rule.showStep * 0.8; b.step++; b.stepAt = now + rule.showStep; }
      else { b.phase = 'play'; b.next = 0; }
    }
    // A march lane comes down through wherever the player stands, every few seconds.
    if (now >= b.nextLane) { b.lanes.push({ x: p.x, at: now + rule.laneWarn }); b.nextLane = now + rule.laneEvery; }
    for (const lane of b.lanes) if (!lane.done && now >= lane.at) {
      lane.done = true; this.effect('beam', lane.x, enemy.y - 12, '#cf767a', 0.8, 1, { targetX: lane.x, targetY: enemy.y + 12, look: 'march' });
      if (Math.abs(p.x - lane.x) < rule.laneWidth / 2 + this.config.arena.playerRadius) { this.hurt(rule.laneDamage); if (!this.active) return; }
    }
    b.lanes = b.lanes.filter(lane => !lane.done);
  }
  /** A drum struck while Brass waits for the order: the right one counts, a wrong one starts the showing again. */
  strikeDrum(enemy, i) {
    const b = enemy.breaking, now = this.s.time, rule = this.config.bossAI[enemy.type].phaseBreaks[b.index];
    if (b.phase !== 'play' || b.drums[i].done) return;
    if (b.order[b.next] === i) { b.drums[i].done = true; b.drums[i].flash = now + 0.3; b.next++; this.sense({ kind: 'hit' }); return; }
    for (const drum of b.drums) drum.done = false;
    Object.assign(b, { phase: 'show', step: 0, stepAt: now + 0.6, next: 0 }); this.effect('ring', b.drums[i].x, b.drums[i].y, '#a92f2b', 0.3, 1); this.notify('순서가 틀렸습니다. 다시 보세요.');
    void rule;
  }
  /** A swing during a break: bats cans back, strikes drums, knocks down soldiers it meets. */
  breakSwing(a, range) {
    const reach = target => inCone(this.p, target, a.angle, range + 0.3, this.config.rules.comboArcDegrees);
    for (const enemy of this.s.enemies) {
      const b = enemy.breaking; if (!b) continue;
      for (const can of b.cans || []) if (!can.back && reach(can)) { can.back = true; this.effect('spark', can.x, can.y, '#fff4d6', 0.2, 0.6); this.sense({ kind: 'hit' }); }
      if (b.drums && !a.drumStruck) { const i = b.drums.findIndex(drum => reach(drum)); if (i >= 0) { a.drumStruck = true; this.strikeDrum(enemy, i); } }
      for (const s of b.soldiers || []) if (!s.down && reach(s)) { if (s.flag) { s.down = true; this.effect('scrap', s.x, s.y, '#ffd257', 0.5, 1); this.sense({ kind: 'kill' }); } else this.effect('spark', s.x, s.y, '#d8dde2', 0.2, 0.5); }
    }
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
    if (all) return lanes;
    // Brass's live carpets grow with each phase: two, then three, then all four (slice.json liveLanes, laneOrder).
    if (ai.liveLanes) return (ai.laneOrder || lanes.map((_, i) => i)).filter(i => i < lanes.length).slice(0, this.liveLaneCount(enemy)).sort((a, b) => a - b).map(i => lanes[i]);
    return enemy.hp <= enemy.maxHp * ai.phaseTwoHpFraction ? lanes : lanes.slice(0, ai.marchLanes.length);
  }
  liveLaneCount(enemy) {
    const ai = this.config.bossAI[enemy.type];
    return ai.liveLanes ? Math.max(...ai.liveLanes.filter(({ below }) => enemy.hp <= enemy.maxHp * below).map(({ count }) => count), 0) : 0;
  }
  /** A new live carpet rolls out the moment Brass enters a phase that adds one. */
  checkCarpets(enemy) {
    const ai = this.config.bossAI[enemy.type], count = this.liveLaneCount(enemy), shown = enemy.lanesShown ??= ai.liveLanes?.[0].count;
    if (!count || count <= shown) return;
    const lanes = this.marchLanes(enemy, true), order = ai.laneOrder || lanes.map((_, i) => i); enemy.lanesShown = count;
    for (const i of order.slice(shown, count)) { const [[ax, ay], [bx, by]] = lanes[i]; this.effect('beam', ax, ay, '#ffd257', 1.2, 1, { targetX: bx, targetY: by, look: 'carpetRoll' }); }
    this.notify('카펫이 한 줄 더 깔립니다! 행진이 그 위로도 지나갑니다.');
  }
  /** Skill slot `index` while Roco holds it in his bag. */
  isConfiscated(index) { const held = this.p.confiscated; return !!held && held.index === index && held.until > this.s.time; }
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
    if (s.drill) {
      const d = s.drill, step = d.steps[d.index];
      d.moved += Math.hypot(p.x - d.last.x, p.y - d.last.y); d.last = { x: p.x, y: p.y };
      const tooMuch = step === 'still' && (Math.hypot(p.x - d.from.x, p.y - d.from.y) > d.rules.still || p.attack);
      if (!d.failed && tooMuch) { d.failed = true; this.hurt(d.damage); if (!this.active) return; }
      if (s.time >= d.until) {
        if (step === 'move' && !d.failed && d.moved < d.rules.move) { this.hurt(d.damage); if (!this.active) return; }
        d.index++;
        if (d.index >= d.steps.length) s.drill = null;
        else Object.assign(d, { until: s.time + d.rules.seconds, from: { x: p.x, y: p.y }, moved: 0, failed: false });
      }
    }
    if (s.parades?.length) {
      for (const parade of s.parades) {
        parade.at += parade.speed * dt;
        if (!parade.spent && this.paradeBodies(parade).some(body => Math.hypot(body.x - p.x, body.y - p.y) < parade.radius + this.config.arena.playerRadius) && this.hurt(parade.damage)) parade.spent = true;
        if (!this.active) return;
      }
      s.parades = s.parades.filter(parade => parade.at - (parade.count + 1) * parade.spacing < Math.hypot(parade.b[0] - parade.a[0], parade.b[1] - parade.a[1]));
    }
    const column = s.column;
    if (!column) return;
    column.at += dt / column.seconds;
    if (column.at >= 1) { s.column = null; return; }
    const { a, b, gapA, gapB } = this.columnLine, near = (from, to) => this.onLane([from, to], column.width);
    if (!column.spent && (near(a, gapA) || near(gapB, b)) && this.hurt(column.damage)) column.spent = true;
  }
  /** Where each soldier of a parade is now: a file walking from the lane's start, one place left empty. */
  paradeBodies(parade) {
    const [ax, ay] = parade.a, [bx, by] = parade.b, length = Math.hypot(bx - ax, by - ay), bodies = [];
    for (let i = 0; i < parade.count; i++) {
      if (i === parade.gap) continue;
      const along = parade.at - i * parade.spacing;
      if (along < 0 || along > length) continue;
      bodies.push({ x: ax + (bx - ax) * along / length, y: ay + (by - ay) * along / length, heading: Math.atan2(by - ay, bx - ax) });
    }
    return bodies;
  }
  /** A line for the player to read while a boss pattern is running. */
  get bossWarning() {
    const { time } = this.s, boss = this.s.enemies.find(e => e.boss && e.hp > 0);
    if (!boss) return '';
    if (boss.alarmUntil > time || boss.tell?.type === 'alarm') return '경보! 공격을 멈추세요';
    if (boss.bellUntil > time || boss.tell?.type === 'bell') return '종이 울립니다! 움직이지 마세요';
    if (boss.tell?.type === 'carpet') return '초록 카펫 위로 이동하세요';
    if (boss.tell?.type === 'column' || this.s.column) return '대열의 틈으로 지나가세요';
    if (boss.tell?.type === 'parade' || this.s.parades?.length) return '퍼레이드! 카펫에서 비키거나 빈자리를 기다리세요';
    if (boss.tell?.type === 'drill') return '구령 훈련! 구령을 따르세요';
    if (this.s.drill) return this.s.drill.steps[this.s.drill.index] === 'still' ? '구령: 멈춰!' : '구령: 앞으로! 계속 걸으세요';
    if (boss.tell?.type === 'crateToss') return '상자가 떨어집니다! 로코 옆에서 터뜨리면 기절합니다';
    return '';
  }
  executeEnemy(enemy) {
    const tell = enemy.tell; enemy.tell = null; enemy.state = 'recover'; enemy.ready = this.s.time + enemy.recovery;
    const p = this.p, ai = this.config.bossAI[enemy.type];
    const damage = () => this.hurt(enemy.damage);
    if (!enemy.boss) this.sense({ kind: 'mob', id: enemy.type });
    // Each boss pattern has its own sound when it lands (the bell and alarm already ring at their warning).
    else if (tell?.type) this.sense({ kind: 'boss', id: tell.type });
    switch (tell.type) {
      case 'melee': if (inCone(tell, p, tell.angle, enemy.attackRange, this.config.rules.enemyMeleeArc)) damage(); break;
      case 'burst':
        // The rat goes off where its warning ring was drawn, and the ring counts the player's body, not only its centre.
        enemy.hp = 0; this.effect('scrap', tell.x, tell.y, enemy.color, 0.6, 1); this.effect('ring', tell.x, tell.y, '#e8914e', 1, enemy.burstRadius, { look: 'boom' }); this.sense({ kind: 'burst' });
        // A rat that bursts still counts as beaten: its share of the room's loot and any heal-on-kill.
        if (this.upgradeAmount('killHeal')) this.heal(this.upgradeAmount('killHeal'), true);
        this.payKill(enemy);
        if (distance(tell, p) < enemy.burstRadius + this.config.arena.playerRadius) damage(); break;
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
        this.effect('ring', spot.x, spot.y, '#e8914e', 0.7, enemy.popRadius, { look: 'quake' });
        if (distance(spot, p) < enemy.popRadius) damage(); break;
      }
      // Spinning top: rolls off in a straight line and bounces from walls until it winds down.
      case 'spin': enemy.spin = { angle: tell.angle, until: this.s.time + enemy.spinSeconds, hitReady: 0 }; break;
      // Drummer: no damage of its own; nearby soldiers move faster and shrug off hits for a while.
      case 'beat':
        for (const ally of this.s.enemies) if (ally !== enemy && !ally.boss && ally.hp > 0 && distance(ally, enemy) <= enemy.beatRadius) { ally.beatUntil = this.s.time + enemy.beatSeconds; ally.aggro = true; }
        this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.85, enemy.beatRadius, { look: 'drumBeat' }); break;
      // Pikeman: a long thrust, then a shorter one re-aimed at where the player went.
      case 'thrust': case 'thrust2': {
        const length = tell.type === 'thrust' ? enemy.attackRange : enemy.followupLength, end = { x: tell.x + Math.cos(tell.angle) * length, y: tell.y + Math.sin(tell.angle) * length };
        if (segmentDistance(p, tell, end) <= enemy.thrustWidth + this.config.arena.playerRadius) damage();
        this.effect('beam', tell.x, tell.y, '#d1a85a', 0.45, 1, { targetX: end.x, targetY: end.y, look: 'thrust' });
        if (tell.type === 'thrust') enemy.followup = { type: 'thrust2', at: this.s.time + enemy.followupDelay };
        break;
      }
      case 'doubleWave':
        if (distance(tell, p) < enemy.attackRange) damage();
        this.effect('ring', tell.x, tell.y, '#d86e76', 0.7, enemy.attackRange, { look: 'quake' });
        enemy.followup = { type: 'eliteWave', at: this.s.time + enemy.followupDelay }; break;
      case 'eliteWave': if (distance(tell, p) < enemy.attackRange + enemy.followupRadiusBonus) damage(); this.effect('ring', tell.x, tell.y, '#d86e76', 0.7, enemy.attackRange + enemy.followupRadiusBonus, { look: 'quake' }); break;
      case 'claw': {
        const end = { x: tell.x + Math.cos(tell.angle) * ai.clawLength, y: tell.y + Math.sin(tell.angle) * ai.clawLength };
        if (segmentDistance(p, tell, end) <= ai.clawWidth + this.config.arena.playerRadius && damage() && ai.confiscateSeconds && this.skillSlots.length && !(this.p.confiscated?.until > this.s.time)) {
          // The claw that catches F2 takes a skill back to Roco's bag for a while: a blow to his back returns it.
          const index = Math.floor(this.random() * this.skillSlots.length);
          this.p.confiscated = { index, until: this.s.time + ai.confiscateSeconds };
          this.notify(`로코가 ${this.skillSlots[index].skill.name}을(를) 압수했습니다! 등을 쳐서 되찾으세요.`);
        }
        this.effect('beam', tell.x, tell.y, '#cf767a', 0.45, 1, { targetX: end.x, targetY: end.y, look: 'thrust' }); break;
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
      // Stomp: rings of shock spread from Brass on the beat; dodge through each as it passes.
      case 'stomp':
        for (let i = 0; i < ai.stompRings; i++) this.s.casts.push({ id: this.id('stomp'), shape: 'stompRing', owner: enemy.id, x: enemy.x, y: enemy.y, age: -i * ai.stompGap, speed: ai.stompSpeed, reach: ai.stompReach, width: ai.stompWidth, enemyDamage: enemy.damage, passed: false });
        enemy.ready = this.s.time + ai.stompRings * ai.stompGap + enemy.recovery; break;
      // Charge: a straight run along the marked line, then a trumpet blast ahead where it stops.
      case 'charge':
        enemy.dashDistance = ai.chargeLength; enemy.dashDuration = ai.chargeSeconds; enemy.dash = { angle: tell.angle, elapsed: 0, then: 'chargeHorn' };
        enemy.ready = this.s.time + ai.chargeSeconds + ai.hornDelay + 1 + enemy.recovery; break;
      case 'chargeHorn':
        if (inCone(tell, p, tell.angle, ai.hornRange, ai.hornDegrees)) damage();
        this.effect('swing', tell.x, tell.y, '#e0a068', 0.85, ai.hornRange, { angle: tell.angle, phase: 2, arc: ai.hornDegrees, look: 'wave' }); break;
      case 'overcharge': if (distance(tell, p) <= ai.overchargeRadius + this.config.arena.playerRadius) damage(); this.effect('ring', tell.x, tell.y, '#e0a068', 0.7, ai.overchargeRadius, { look: 'quake' }); enemy.ready = this.s.time + ai.overchargeRecovery; break;
      case 'fan':
      case 'fanSecond':
        if (inCone(tell, p, tell.angle, ai.fanRange, ai.fanDegrees)) damage();
        this.effect('swing', tell.x, tell.y, '#dc817b', 0.85, ai.fanRange, { angle: tell.angle, phase: 2, arc: ai.fanDegrees, look: 'wave' });
        if (tell.type === 'fan') enemy.followup = { type: 'fanSecond', at: this.s.time + ai.followupDelay }; break;
      case 'march': {
        const lanes = this.marchLanes(enemy);
        if (lanes.some(lane => this.onLane(lane, ai.marchWidth))) damage();
        for (const [[ax, ay], [bx, by]] of lanes) this.effect('beam', ax, ay, '#cf767a', 0.8, 1, { targetX: bx, targetY: by, look: 'march' }); break;
      }
      case 'alarm': enemy.alarmUntil = this.s.time + ai.alarmSeconds; enemy.ready = enemy.alarmUntil + enemy.recovery; break;
      case 'crane':
        if (tell.drops.some(drop => distance(drop, p) <= ai.craneRadius + this.config.arena.playerRadius)) damage();
        for (const { x, y } of tell.drops) { this.effect('ring', x, y, '#c9a66b', 0.7, ai.craneRadius, { look: 'crateCrash' }); this.effect('scrap', x, y, '#c9a66b', 0.5, 1); }
        break;
      // Roco throws crates: under one is a hit, and the crates stay. One blown up next to Roco knocks him out for a moment.
      case 'crateToss': {
        if (tell.drops.some(drop => distance(drop, p) <= ai.crateTossRadius + this.config.arena.playerRadius)) damage();
        const crates = (this.s.hazards ??= []);
        for (const { x, y } of tell.drops) {
          if (this.map?.walkable && !fitsMap(x, y, 0.45, this.map)) continue;
          crates.push({ id: this.id('hz'), kind: 'crate', x, y, size: this.config.hazards?.crate.size || 0.9 });
          this.effect('ring', x, y, '#c9a66b', 0.5, ai.crateTossRadius, { look: 'crateCrash' });
        }
        const thrown = crates.filter(h => h.kind === 'crate' && !h.gone && h.fuseAt === undefined);
        while (thrown.length > ai.crateTossMax) { const old = thrown.shift(); old.gone = true; this.effect('scrap', old.x, old.y, '#b0783e', 0.4, 0.8); }
        break;
      }
      // Parade: toy soldiers march down one or two live carpets in a long file; step off, or let the gap pass you.
      case 'parade':
        for (const lane of tell.lanes) {
          const [[ax, ay], [bx, by]] = this.random() < 0.5 ? lane : [lane[1], lane[0]];
          this.s.parades = [...(this.s.parades || []), { a: [ax, ay], b: [bx, by], at: 0, gap: 1 + Math.floor(this.random() * (ai.paradeSoldiers - 2)), speed: ai.paradeSpeed, spacing: ai.paradeSpacing, count: ai.paradeSoldiers, radius: ai.paradeRadius, damage: enemy.damage, spent: false }];
        }
        break;
      // Drill: Brass calls the steps: freeze on "멈춰!", walk on "앞으로!". Getting either wrong costs a hit.
      case 'drill': {
        const steps = this.liveLaneCount(enemy) >= 4 ? ['still', 'move', 'still'] : ['still', 'move'];
        this.s.drill = { steps, index: 0, until: this.s.time + ai.drillStepSeconds, from: { x: p.x, y: p.y }, moved: 0, last: { x: p.x, y: p.y }, failed: false, damage: enemy.damage, rules: { seconds: ai.drillStepSeconds, still: ai.drillStillUnits, move: ai.drillMoveUnits } };
        enemy.ready = this.s.time + steps.length * ai.drillStepSeconds + enemy.recovery; break;
      }
      case 'bell':
        enemy.bellUntil = this.s.time + ai.bellSeconds; enemy.ready = enemy.bellUntil + enemy.recovery;
        this.s.bellWatch = { x: p.x, y: p.y, at: this.s.time }; break;
      case 'column': this.startColumn(enemy); break;
      case 'carpet': {
        const lanes = this.marchLanes(enemy, true);
        if (!this.onLane(lanes[tell.safe], ai.carpetSafeWidth)) damage();
        lanes.forEach(([[ax, ay], [bx, by]], i) => { if (i !== tell.safe) this.effect('beam', ax, ay, '#cf767a', 0.8, 1, { targetX: bx, targetY: by, look: 'march' }); });
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
      if (enemy.breaking) { this.updatePhaseBreak(enemy, dt); if (!this.active) return; continue; }
      if (enemy.hp <= 0 || enemy.held || enemy.exposedUntil > this.s.time || enemy.stunUntil > this.s.time || enemy.alarmUntil > this.s.time || enemy.bellUntil > this.s.time) continue;
      if (enemy.dash) {
        const d = enemy.dash, start = { x: enemy.x, y: enemy.y };
        this.move(enemy, Math.cos(d.angle) * enemy.dashDistance / enemy.dashDuration * dt, Math.sin(d.angle) * enemy.dashDistance / enemy.dashDuration * dt);
        if (segmentDistance(this.p, start, enemy) <= enemy.radius + this.config.arena.playerRadius) this.hurt(enemy.damage);
        if (!this.active) return;
        d.elapsed += dt; if (d.elapsed >= enemy.dashDuration) { enemy.dash = null; if (d.then) enemy.followup = { type: d.then, at: this.s.time + this.config.bossAI[enemy.type].hornDelay }; } continue;
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
      if (distance(before, b) < step * 0.6) { b.until = 0; this.shotStopped(b); }
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
    // Nothing fights in a village, and its clock stands still, so a spark or shot carried in from the last fight would hang
    // in the air for good: a place to walk around starts every step clean.
    if (this.s.effects.length || this.s.casts.length || this.s.projectiles.length) { this.s.effects = []; this.s.casts = []; this.s.projectiles = []; }
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
    const p = this.p, d = this.c.player.dodge, stepTime = Math.min(dt, d.duration - p.dodge.elapsed), reach = d.distance * (p.dodge.boost || 1);
    this.move(p, Math.cos(p.dodge.angle) * reach / d.duration * stepTime, Math.sin(p.dodge.angle) * reach / d.duration * stepTime, radius);
    p.dodge.elapsed += dt; if (p.dodge.elapsed >= d.duration - 1e-7) p.dodge = null;
  }
  /** Out of a fight the body still dodges; after a cleared room the wrench still swings, in town it does not. */
  stepFeet(dt, input, radius, swing = false) {
    dt = Math.min(dt, 1 / 30); this.s.time += dt; this.s.tick++;
    const p = this.p, { x = 0, y = 0 } = input, length = Math.hypot(x, y);
    if (swing && input.aim && distance(p, input.aim) > 0.1) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    if (input.dodge) this.dodge();
    if (p.dodge) this.moveDodge(dt, radius);
    // A swing plants the feet here too (after a room is cleared), as it does in a fight.
    else if (length > 0 && !(swing && p.attack)) {
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
    // Enemies find their way round this run's crates, fences and music boxes too.
    const flow = this.flows.get(map.id); flow.setBlocks(this.s.mode === 'combat' ? this.obstacles : []);
    return flow;
  }
  spawnWaveEnemy(type, spot, affixes) {
    const enemy = this.spawnEnemy(type, spot);
    const { power } = this.room;
    enemy.hp = enemy.maxHp = Math.round(enemy.hp * power); enemy.damage = Math.max(1, Math.round(enemy.damage * power * this.config.rules.waveDamageShare));
    // Wave bodies wait where they stand until the player comes near; nothing rushes in from across the map.
    enemy.aggro = false;
    if (affixes?.length) this.giveAffixes(enemy, affixes);
    return enemy;
  }
  /** An elite's traits for this run (slice.json eliteAffixes): faster, a front shield, rats inside, an element it shrugs off, a bomb heart. */
  giveAffixes(enemy, affixes) {
    const rules = Object.fromEntries((this.config.eliteAffixes?.list || []).map(a => [a.id, a]));
    enemy.affixes = affixes.filter(a => rules[a.id]).map(a => ({ ...a }));
    for (const { id, element } of enemy.affixes) {
      const rule = rules[id];
      if (id === 'overwound') { enemy.speed *= rule.speed; enemy.recovery *= rule.recovery; }
      if (id === 'brassShield') Object.assign(enemy, { frontGuard: rule.frontGuard, guardArcDegrees: rule.guardArcDegrees, shieldHits: 0 });
      if (id === 'coated') enemy.immuneTo = this.c.elements.find(e => e.id === element)?.status;
    }
  }
  /** What a trait-bearing elite leaves behind: rats spilling out, a blast a moment later, and a few extra coins. */
  affixDeath(enemy) {
    const rules = Object.fromEntries((this.config.eliteAffixes?.list || []).map(a => [a.id, a]));
    for (const { id } of enemy.affixes) {
      const rule = rules[id];
      if (id === 'splitter') for (let i = 0; i < rule.count; i++) {
        const angle = Math.PI * 2 * i / rule.count + this.random(), spot = { x: enemy.x + Math.cos(angle) * 0.8, y: enemy.y + Math.sin(angle) * 0.8 };
        const map = this.map, place = !map?.walkable || fitsMap(spot.x, spot.y, 0.3, map) ? spot : { x: enemy.x, y: enemy.y };
        const rat = this.spawnEnemy(rule.spawn, place);
        if (this.room?.power) { rat.hp = rat.maxHp = Math.round(rat.hp * this.room.power); rat.damage = Math.max(1, Math.round(rat.damage * this.room.power * this.config.rules.waveDamageShare)); }
        rat.ready = this.s.time + 0.6;
        this.effect('scrap', place.x, place.y, '#dbbc6b', 0.4, 0.6);
      }
      if (id === 'volatile') {
        (this.s.blasts ??= []).push({ x: enemy.x, y: enemy.y, at: this.s.time + rule.delay, radius: rule.radius, damage: Math.round(rule.damage * (this.room?.power || 1)), enemyDamage: rule.enemyDamage });
        this.effect('ring', enemy.x, enemy.y, '#d8423c', rule.delay, rule.radius);
      }
    }
    if (this.s.mode === 'combat' && this.s.run) this.giveLoot(0, (this.config.eliteAffixes?.bonusCoins || 0) * enemy.affixes.length);
  }
  /** Crates, plates, saws: their clocks run and they act on whoever is in reach. */
  tickHazards() {
    const rules = this.config.hazards, list = this.s.hazards;
    if (!rules || !list?.length || this.s.mode !== 'combat') return;
    const { p } = this, t = this.s.time, playerR = this.config.arena.playerRadius;
    for (const h of list) {
      if (h.gone) continue;
      if (h.kind === 'crate' && h.fuseAt !== undefined && t >= h.fuseAt) this.blowCrate(h);
      if (h.kind === 'plate' && !(h.cooledUntil > t) && plateState(h, t, rules.plate) === 'hot') {
        const depth = h.depth ?? rules.plate.depth, inside = body => Math.abs(body.x - h.x) / h.half + Math.abs(body.y - h.y) / depth <= 1;
        if (inside(p) && !p.dodge && t >= (p.plateNext || 0)) { p.plateNext = t + rules.plate.tick; this.hurt(rules.plate.damage); }
        h.cast ??= { id: `plate-${h.id}`, staggerUsed: {}, fusion: false, statusAt: {} };
        for (const e of this.s.enemies) if (e.hp > 0 && !e.boss && inside(e)) this.applyStatus(e, 'fire', h.cast);
      }
      if (h.kind === 'rail' && h.chargedUntil > t && t >= (h.chargeNext || 0)) {
        const ends = [{ x: h.x - h.dx, y: h.y - h.dy }, { x: h.x + h.dx, y: h.y + h.dy }], e2 = rules.elements;
        h.chargeNext = t + e2.chargeTick; h.chargeCast ??= { id: `rail-${h.id}`, staggerUsed: {}, fusion: false, statusAt: {} };
        for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && segmentDistance(e, ends[0], ends[1]) <= e2.chargeReach + e.radius) { this.hitEnemy(e, e2.chargeDamage, { dot: true, color: '#ffe086' }); this.applyStatus(e, 'lightning', h.chargeCast); this.effect('spark', e.x, e.y - 0.5, '#ffe086', 0.3, 0.7, { look: 'zap' }); }
      }
      if (h.kind === 'rail') {
        const saw = sawAt(h, t, rules.rail.speed);
        if (!p.dodge && distance(saw, p) < rules.rail.radius + playerR) this.hurt(rules.rail.damage);
        h.hitAt ??= {};
        for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && distance(saw, e) < rules.rail.radius + e.radius && t >= (h.hitAt[e.id] || 0)) {
          h.hitAt[e.id] = t + rules.rail.enemyEvery; this.hitEnemy(e, rules.rail.enemyDamage, { dot: true, color: '#d8dde2' }); this.effect('spark', e.x, e.y - 0.5, '#fff4d6', 0.2, 0.6);
        }
      }
    }
    if (list.some(h => h.gone)) this.s.hazards = list.filter(h => !h.gone);
  }
  /** Light a crate's fuse (a blow, a shot, a blast); it goes off a moment later. */
  lightCrate(h, fuse = this.config.hazards.crate.fuse) {
    if (h.kind !== 'crate' || h.gone || h.fuseAt !== undefined) return;
    h.fuseAt = this.s.time + fuse; this.effect('ring', h.x, h.y, '#d8423c', fuse, this.config.hazards.crate.radius);
  }
  blowCrate(h) {
    const rule = this.config.hazards.crate; h.gone = true;
    this.effect('ring', h.x, h.y, '#e8914e', 0.6, rule.radius, { look: 'boom' }); this.effect('scrap', h.x, h.y, '#b0783e', 0.6, 1); this.sense({ kind: 'burst' });
    if (!this.p.dodge && distance(h, this.p) < rule.radius + this.config.arena.playerRadius) this.hurt(rule.damage);
    for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && distance(h, e) < rule.radius + e.radius) {
      this.hitEnemy(e, rule.enemyDamage, { dot: true, color: '#e8914e' });
      const stun = e.boss && !e.breaking && this.config.bossAI[e.type]?.crateStunSeconds;
      if (stun && e.hp > 0) { e.tell = null; e.exposedUntil = Math.max(e.exposedUntil, this.s.time + stun); e.ready = Math.max(e.ready, e.exposedUntil + 0.4); this.notify('로코가 폭발에 휘청거립니다! 지금 공격하세요.'); }
    }
    for (const other of this.s.hazards) if (other !== h && distance(h, other) < rule.radius) this.lightCrate(other, rule.chain);
  }
  /** A wrench swing: crates get lit, a music box plays its mending tune once. */
  strikeHazards(angle, range, arc) {
    for (const h of this.s.hazards || []) {
      if (h.gone || !inCone(this.p, h, angle, range + 0.4, arc)) continue;
      if (h.kind === 'crate') this.lightCrate(h);
      if (h.kind === 'musicbox' && !h.used) {
        h.used = true; this.heal(this.p.maxHp * this.config.hazards.musicbox.heal);
        this.effect('ring', h.x, h.y, '#8fd8b0', 0.8, 1.6); this.effect('spark', this.p.x, this.p.y, '#8fd8b0', 0.6, 1, { look: 'ready', follow: true });
      }
    }
  }
  /** A shot stopped by something solid: a fence takes the blow, a crate caught by the player's shot is lit. */
  shotStopped(b) {
    const near = h => { const o = hazardBox(h), r = b.radius + 0.25; return b.x + r > o.x && b.x - r < o.x + o.w && b.y + r > o.y && b.y - r < o.y + o.h; };
    const hit = (this.s.hazards || []).find(h => SOLID.has(h.kind) && !h.gone && near(h));
    if (!hit) return;
    if (hit.kind === 'fence' && --hit.hp <= 0) { hit.gone = true; this.effect('scrap', hit.x, hit.y, '#a07a4a', 0.6, 1); }
    else if (hit.kind === 'fence') this.effect('spark', b.x, b.y, '#d8c7a0', 0.2, 0.5);
    if (hit.kind === 'crate' && b.friendly) this.lightCrate(hit);
  }
  /** A bomb heart goes off where its elite fell, hurting the player and anyone else standing in it. */
  tickBlasts() {
    if (!this.s.blasts?.length) return;
    this.s.blasts = this.s.blasts.filter(blast => {
      if (blast.at > this.s.time) return true;
      this.effect('ring', blast.x, blast.y, '#e8914e', 0.6, blast.radius, { look: 'boom' }); this.sense({ kind: 'burst' });
      if (!this.p.dodge && distance(blast, this.p) < blast.radius + this.config.arena.playerRadius) this.hurt(blast.damage);
      for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && distance(blast, e) < blast.radius) this.hitEnemy(e, blast.enemyDamage, { dot: true, color: '#e8914e' });
      for (const h of this.s.hazards || []) if (distance(blast, h) < blast.radius) this.lightCrate(h, this.config.hazards.crate.chain);
      return false;
    });
  }
  /** Anywhere on the floor, well away from the player and from bodies already placed, so a room fills evenly. */
  spreadSpot(extra = []) {
    const { spreadMinUnits, spreadGapUnits } = this.config.rules, map = this.map, { arena } = this.config, radius = 0.6;
    const [width, height] = map?.size || [arena.width, arena.height], taken = [...this.s.enemies.filter(e => e.hp > 0), ...(this.s.run?.arrivals || []), ...extra], flow = this.flowField;
    flow?.update(this.p.x, this.p.y);
    for (let tries = 0; tries < 80; tries++) {
      const spot = { x: this.random() * width, y: this.random() * height };
      const floor = map?.walkable ? fitsMap(spot.x, spot.y, radius, map) : spot.x > arena.bounds.left && spot.x < arena.bounds.right && spot.y > arena.bounds.top && spot.y < arena.bounds.bottom;
      if (floor && !this.inSolid(spot.x, spot.y, radius) && (!flow || flow.reachable(spot.x, spot.y)) && distance(spot, this.p) >= spreadMinUnits && taken.every(other => distance(spot, other) >= spreadGapUnits)) return spot;
    }
    return this.arrivalSpot();
  }
  /** Spots for a wave standing in `kind` of formation (spread, camps, flank, pincer, ring); see encounters.js. */
  formation(kind = 'spread', types) {
    const map = this.map, { arena } = this.config, flow = this.flowField, radius = 0.6;
    flow?.update(this.p.x, this.p.y);
    const fits = (x, y) => (map?.walkable ? fitsMap(x, y, radius, map) && (!flow || flow.reachable(x, y)) : x > arena.bounds.left && x < arena.bounds.right && y > arena.bounds.top && y < arena.bounds.bottom)
      && distance({ x, y }, this.p) >= 4 && !this.inSolid(x, y, radius);
    return formationSpots(kind, types, { fits, player: this.p, size: map?.size || [arena.width, arena.height], random: () => this.random(), spread: taken => this.spreadSpot(taken) });
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
    const types = this.room.waves[run.wave], kind = run.plan?.[run.node]?.formations?.[run.wave], spots = this.formation(kind, types);
    if (ARRIVAL_NOTES[kind]) this.notify(ARRIVAL_NOTES[kind]);
    for (const [i, type] of types.entries()) {
      const spot = spots[i];
      run.arrivals.push({ type, x: spot.x, y: spot.y, at: this.s.time + waveWarnSeconds, affixes: run.plan?.[run.node]?.affixes?.[run.wave]?.[i] || null });
      this.effect('friendlyTell', spot.x, spot.y, '#e0a03c', waveWarnSeconds, 0.7);
    }
  }
  tickWaves() {
    const { run } = this.s;
    if (this.s.mode !== 'combat' || !this.room?.waves) return;
    const waiting = run.arrivals.length;
    run.arrivals = run.arrivals.filter(({ type, x, y, at, affixes }) => { if (at > this.s.time) return true; this.spawnWaveEnemy(type, { x, y }, affixes); return false; });
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
    // Walking in from the edge: the body steers itself to the spawn point and the player's input waits.
    const entry = this.s.entry;
    if (entry) {
      const dx = entry.x - p.x, dy = entry.y - p.y, gap = Math.hypot(dx, dy);
      if (gap < 0.12 || this.s.time >= entry.until) this.s.entry = null;
      else input = { x: dx / gap, y: dy / gap, aim: { x: entry.x + dx, y: entry.y + dy } };
    }
    if (input.aim && distance(p, input.aim) > 0.1) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    let dx = input.x || 0, dy = input.y || 0;
    const length = Math.hypot(dx, dy);
    if (length > 0) { dx /= Math.max(1, length); dy /= Math.max(1, length); p.moveAngle = Math.atan2(dy, dx); }
    else if (!p.dodge) p.moveAngle = p.angle;
    if (input.dodge) this.dodge();
    if (p.dodge) {
      this.moveDodge(dt);
      const slip = this.trait('slipstream');
      if (slip) for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(p, enemy) <= enemy.radius + slip.radius) { if (!(enemy.statuses.windPressure > this.s.time)) this.effect('dodge', enemy.x, enemy.y, '#badbd3', 0.45, 1, { look: 'gust', angle: p.moveAngle }); enemy.statuses.windPressure = this.s.time + this.c.statuses.find(s => s.id === 'windPressure').duration; }
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
    for (const cast of this.s.casts.filter(c => c.shape === 'stompRing')) {
      cast.age += dt; if (cast.age < 0) continue;
      const r = cast.age * cast.speed, d = distance(p, cast);
      if (!cast.passed && Math.abs(d - r) < cast.width + this.config.arena.playerRadius) { cast.passed = true; this.hurt(cast.enemyDamage); if (!this.active) return; }
      if (r > cast.reach) cast.done = true;
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
    this.tutorial.tick(); this.tickPractice(); this.tickWaves(); this.tickBlasts(); this.tickHazards();
    if (this.active && this.s.enemies.length && this.s.enemies.every(e => e.hp <= 0) && !this.wavesLeft) { if (this.s.mode === 'combat') this.holdClear(); else this.finishCombat(); }
  }
  /** What clearing the current room is worth in all: free gears kept for good, and coins for this run. */
  roomLoot() {
    const region = this.data.progression.region, kind = this.room.kind;
    const gears = kind === 'miniboss' ? region.miniReward : kind === 'regionBoss' ? region.bossReward : region.normalReward;
    const coins = this.data.progression.economy.runCoinRewards[kind === 'normal' ? 'normal' : kind];
    return { gears: Math.round(gears * (1 + (this.stats.gearGain || 0))), coins: Math.round(coins * (1 + (this.stats.coinGain || 0))) };
  }
  /**
   * The room's loot is paid out a share per enemy as each one falls, rather than all at the end; the clear pays whatever
   * is left, so the room is worth the same in all. Kills past the room's planned enemies pay nothing more.
   */
  payKill(enemy) {
    const run = this.s.run, room = this.room;
    if (this.s.mode !== 'combat' || !run || !room || room.kind === 'shop' || this.s.profile.rewards.includes(`${run.id}:${room.id}`)) return;
    const loot = run.loot?.room === room.id ? run.loot : (run.loot = { room: room.id, kills: 0, gears: 0, coins: 0 });
    const planned = room.waves ? room.waves.flat().length : 1, total = this.roomLoot();
    loot.kills = Math.min(planned, loot.kills + 1);
    const gears = Math.round(total.gears * loot.kills / planned) - loot.gears, coins = Math.round(total.coins * loot.kills / planned) - loot.coins;
    this.giveLoot(gears, coins); loot.gears += gears; loot.coins += coins;
    // What the kill paid flies to the player: a coin or a little gear for each piece, a few at most.
    if (gears || coins) this.effect('loot', enemy.x, enemy.y - 0.3, '#ffd257', 0.6, Math.min(4, Math.max(1, coins + gears)), { gears: Math.min(2, gears) });
  }
  giveLoot(gears, coins) { this.s.profile.freeGears += gears; this.s.run.baseGears += gears; this.s.run.coins += coins; }
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
      // Whatever the kills have not paid yet.
      const total = this.roomLoot(), paid = run.loot?.room === this.room.id ? run.loot : { gears: 0, coins: 0 };
      this.giveLoot(Math.max(0, total.gears - paid.gears), Math.max(0, total.coins - paid.coins)); this.s.profile.rewards.push(key); run.loot = null;
      run.clears.push(this.room.id); this.s.profile.combatClears++;
      const bank = this.perk('piggyBank');
      if (bank) { const interest = Math.min(bank.cap, Math.floor(run.coins * bank.rate)); if (interest) { run.coins += interest; this.notify(`저금통 이자 · 동전 +${interest}`); } }
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
    // The last boss of the slice ends the run here: the story takes over instead of a reward pick.
    if (this.s.run.node === this.config.rooms.length - 1) { this.s.mode = 'complete'; this.s.profile.wins++; }
    else this.offerRewards();
    this.save(); return true;
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
      ...this.config.skillMods.filter(m => skills.includes(m.skill) && !run.skillMods?.some(id => this.config.skillMods.find(o => o.id === id)?.skill === m.skill)).map(m => ({ kind: 'skillMod', id: m.id })),
      ...this.config.elementTraits.filter(t => elements.includes(t.element) && !run.traits?.includes(t.id)).map(t => ({ kind: 'trait', id: t.id }))
    ];
  }
  /** Every reward card has a tier: common, rare or special. */
  rewardTier(reward) {
    const { rules, mods, skillMods, elementTraits, rewards } = this.config;
    if (reward.kind === 'mod') return mods.find(m => m.id === reward.id).tier;
    if (reward.kind === 'skillMod') return skillMods.find(m => m.id === reward.id).tier;
    if (reward.kind === 'trait') return elementTraits.find(t => t.id === reward.id).tier;
    if (reward.kind === 'perk') return this.config.perks.find(perk => perk.id === reward.id).tier;
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
    const perks = (this.config.perks || []).filter(perk => !run.perks?.includes(perk.id)).map(perk => ({ kind: 'perk', id: perk.id }));
    return [...parts, ...levels, ...repairs, ...perks, { kind: 'gears', amount: this.config.rules.gearReward.amount }];
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
  /**
   * Each of the three cards can be drawn again once per reward screen. The new card comes from the same draw as a fresh
   * offer (its slot's rules: the first card grows the build) and is never a card already on the table.
   */
  rerollRewardCard(index) {
    const run = this.s.run;
    if (this.s.mode !== 'reward' || !run || !run.rewardChoices[index] || run.rerolledCards?.[index]) return false;
    const key = reward => `${reward.kind}:${reward.id ?? reward.amount}`, taken = new Set(run.rewardChoices.map(key)), kept = run.rewardChoices;
    let pick = null;
    for (let tries = 0; tries < 12 && !pick; tries++) {
      run.rewardChoices = []; this.offerRewards();
      const fresh = run.rewardChoices;
      pick = fresh[index] && !taken.has(key(fresh[index])) ? fresh[index] : fresh.find(reward => !taken.has(key(reward))) || null;
    }
    run.rewardChoices = kept;
    (run.rerolledCards ??= [])[index] = true;
    if (pick) run.rewardChoices[index] = pick;
    return !!pick;
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
    if (reward.kind === 'perk') {
      (run.perks ??= []).push(reward.id);
      const glass = this.perk('glassSpring');
      if (reward.id === 'glassSpring') { this.p.maxHp = Math.max(1, this.p.maxHp - glass.maxHpLoss); this.p.hp = Math.min(this.p.hp, this.p.maxHp); }
    }
    if (reward.kind === 'heal') this.heal(this.config.rules.healRewards.find(h => h.id === reward.id).amount);
    if (reward.kind === 'gears') this.s.profile.freeGears += Math.round(reward.amount * (1 + (this.stats.gearGain || 0)));
    run.rewardChoices = []; run.rerolledCards = []; this.sense({ kind: 'pick' });
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
