import { createProfile, permanentStats, buyRank, refundAll } from './progression.js';
import { roomTitle } from './room-title.js';
import { fitsMap, pointInPolygon, placeOf, roomPlace } from './map-geometry.js';
// How far back from the spawn point the player starts, walking in from the map's edge.
const ENTRY_UNITS = 3.5;
import { Tutorial } from './tutorial.js';
import { FlowField } from './flow-field.js';
import { dealRun } from './encounters.js';
import { dealHazards, SOLID, hazardBox } from './hazards.js';
import { clamp, distance, floorDistance, angleDiff, inCone, segmentDistance } from './math.js';
import { enemyActions } from './enemy-actions.js';
import { roomWaves } from './room-waves.js';
import { rewardDraws } from './reward-draws.js';

export { clamp, distance, segmentDistance };

/** Modes in which the player is still in a run room (fighting, choosing a reward, walking to the portal). */
const ROOM_MODES = new Set(['combat', 'reward', 'route', 'unwind']);
/** How long before a summoned body appears its rift starts to open (the renderer's summonRift reaches its light column then). */
export const SUMMON_RISE_SECONDS = 9 / 14;
/** How long F2 lies fallen in the room before a lost run goes home (the fall plays first). */
const DOWN_SECONDS = 1.8;
const WAKE_SECONDS = 1.6, TALK_UNITS = 3, NPC_BODY_UNITS = 0.45, CLEAR_HOLD_SECONDS = 1, LEAVE_REFUSED_UNITS = 1.5, LAST_WAVE_ALREADY_PLAYED = 99;
/** The floor mark a placed skill shows before it lands: fire first (the furnace), then frost, then lightning. */
const floorMark = (elements = []) => ['fire', 'ice', 'lightning'].find(e => elements.includes(e)) || null;

// Run parts that add straight onto a permanent stat of the same name.
const RUN_STATS = ['moveSpeed', 'critChance', 'attackSpeed', 'damageReduction'];
// Boss fields that act on the player rather than on enemies.
const HOSTILE_SHAPES = ['magnet', 'suction', 'stickerVolley', 'stickerFall', 'sticker', 'stompRing'];
const CRIT_RED = '#e8433a', JOLT_SECONDS = 0.12, LIGHT_KNOCKBACK = 0.15, HEAVY_KNOCKBACK = 0.5, FEEL_LIMIT = 64;
/** How far each blow carries the body forward (units), and how close an enemy in front stops it. */
const LUNGE = [0.25, 0.25, 0.5], LUNGE_STOP = 1.2;

export class Game {
  constructor(data, savedState = null, onSave = () => {}) {
    this.data = data;
    this.onSave = onSave;
    /** Told when an expedition sets out and when it comes back (play statistics, src/ui/stats-report.js). */
    this.onRun = () => {};
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
    if (mode === 'practice' || ['intro', 'introDeath'].includes(mode)) return placeOf(maps, mode === 'practice' ? maps?.practice : maps?.intro);
    // A room with two pictures shows the one this run rolled for it.
    return roomPlace(maps, this.room?.id, this.s.run?.plan?.[this.s.run.node]?.variant || 0);
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
  get active() { return ['intro', 'combat', 'practice'].includes(this.s.mode) && !this.s.paused && !this.s.downUntil; }
  /** F2 has fallen on a run and lies still for a moment before the run ends. */
  get down() { return !!this.s.downUntil; }
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
  clearCombat() { this.s.clearAt = null; this.s.ranks = []; this.s.bellWatch = null; this.s.panel = null; this.s.enemies = []; this.s.blasts = []; this.s.hazards = []; this.s.parades = []; this.s.drill = null; this.p.confiscated = null; this.s.casts = []; this.s.projectiles = []; this.s.effects = []; this.p.attack = null; this.p.dodge = null; this.p.lastCast = null; this.p.buffer = {}; }
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
    // The first dummy and four more round it, so a skill that hits several bodies can be tried too.
    for (const spot of [yard.dummy, ...(yard.moreDummies || [])]) { const dummy = this.spawnEnemy('dummy', spot); dummy.dummy = true; dummy.held = true; }
    this.save(); return true;
  }
  togglePracticeReset() {
    if (this.s.mode !== 'practice') return false;
    return this.s.practice.resetCooldowns = !this.s.practice.resetCooldowns;
  }
  tickPractice() {
    if (this.s.mode !== 'practice') return;
    const { p } = this;
    p.energy = this.c.player.maxEnergy;
    for (const dummy of this.s.enemies) if (dummy.dummy) { dummy.x = dummy.home.x; dummy.y = dummy.home.y; }
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
  /** The expedition's difficulty (slice.json difficulty): a run saved before difficulties existed plays as the default. */
  get difficulty() {
    const rules = this.config.difficulty, id = this.s.run?.difficulty || rules?.default;
    return rules?.levels.find(level => level.id === id) || { id: 'normal', scale: 1, loot: 1 };
  }
  /** Setting out from the town portal: the difficulty picked in the popup, remembered as the next one offered. */
  depart(difficulty) {
    if (this.s.mode !== 'hub' || this.s.panel !== 'difficulty' || !this.config.difficulty?.levels.some(level => level.id === difficulty)) return false;
    this.s.panel = null; this.s.profile.lastDifficulty = difficulty;
    return this.startRun(undefined, difficulty);
  }
  startRun(seed = Date.now() >>> 0, difficulty = this.config.difficulty?.default) {
    if (this.s.mode !== 'hub' || !this.s.profile.registered) return false;
    this.s.rng = seed || 1; this.s.profile.runs++;
    this.s.run = { id: `run-${this.s.profile.runs}-${seed}`, seed, node: 0, startedAt: this.s.time, elapsed: 0, coins: 0, slots: this.loadoutSlots, upgrades: {}, mods: [], skillMods: [], traits: [], clears: [], rewardChoices: [], shopBought: [], branches: [], damageTaken: 0, baseGears: 0, difficulty: difficulty || 'normal' };
    // Generate the whole route once; resuming never rerolls layouts or encounters.
    this.s.run.plan = this.config.rooms.map(room => ({ variant: room.variants ? Math.floor(this.random() * room.variants.length) : 0, layout: room.boss || room.kind === 'shop' ? 2 : Math.floor(this.random() * this.config.roomLayouts.length) }));
    // Every run deals its own mix and formation for each fight, at the designed weight (see encounters.js).
    dealRun(this.config.rooms, this.config.enemies, seed, this.config.eliteAffixes).forEach((dealt, i) => { if (dealt) Object.assign(this.s.run.plan[i], dealt); });
    this.resetPlayer(); this.enterNode();
    this.onRun('runStart', { run: this.s.run.id, elements: this.s.run.slots.map(s => s.element), difficulty: this.s.run.difficulty });
    return true;
  }
  spawnEnemy(type, position) {
    const boss = this.c.bosses.find(b => b.id === type), template = boss ? { ...boss, ...this.config.bossAI[type] } : this.config.enemies[type];
    const enemy = { ...template, ...position, home: { x: position.x, y: position.y }, id: this.id('enemy'), type, boss: !!boss, maxHp: template.hp, facing: Math.PI, state: 'approach', aggro: true, ready: this.s.time + this.config.rules.enemyInitialDelay, tell: null, pattern: 0, stagger: 0, exposedUntil: 0, staggerLock: 0, stunUntil: 0, statuses: {}, statusApplied: {}, burnStacks: [], chillCount: 0, freezeLock: 0, shockReady: 0, flashUntil: 0 };
    // On an expedition every body, boss or not, has the difficulty's health and attack (practice and the intro do not).
    if (this.s.run) { const k = this.difficulty.scale; enemy.hp = enemy.maxHp = Math.max(1, Math.round(template.hp * k)); if (Number.isFinite(template.damage)) enemy.damage = Math.max(1, Math.round(template.damage * k)); }
    this.s.enemies.push(enemy); return enemy;
  }
  enterNode() {
    this.clearCombat();
    const room = this.room, plan = this.s.run.plan[this.s.run.node], map = this.map, spawn = map?.spawn || this.config.arena.spawn;
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
        // Which fight of the run this is: the first three ease the furniture in (slice.json hazards.ramp).
        const step = this.config.rooms.slice(0, this.s.run.node).filter(r => r.waves).length;
        plan.hazards ??= dealHazards(map, rules, (this.s.run.seed * 31 + this.s.run.node * 7919) >>> 0, step, this.difficulty.scale);
        this.s.hazards = plan.hazards.map(h => ({ ...h }));
      }
      Object.assign(this.s.run, { wave: 0, arrivals: [] });
      // The first wave is summoned like the later ones (2026-11-06): hatch marks open on the floor as F2 walks in and the
      // bodies climb out a moment after she stops, instead of standing there already waiting.
      // The bodies are in the room from the start (they count, they can be paid for) but are still climbing out: unseen,
      // still and unhittable until `summonUntil` (see updateEnemies, hitEnemy and the renderer).
      const spots = this.formation(plan.formations?.[0], room.waves[0]), { waveWarnSeconds } = this.config.rules;
      const arrive = Math.max(this.s.time, this.s.entry?.until ?? this.s.time) + waveWarnSeconds;
      room.waves[0].forEach((type, i) => {
        const enemy = this.spawnWaveEnemy(type, spots[i], plan.affixes?.[0]?.[i]);
        enemy.summonUntil = arrive; enemy.summonedAt = arrive; enemy.ready = Math.max(enemy.ready, arrive + this.config.rules.enemyInitialDelay);
        // The hatch mark marks the spot while F2 walks in; the summon rift takes over for its last moments (renderer).
        this.effect('friendlyTell', spots[i].x, spots[i].y, '#e0a03c', Math.max(0.1, arrive - this.s.time - SUMMON_RISE_SECONDS), 0.7, { mark: 'spawn' });
      });
      this.notify(roomTitle(room));
      if (plan.shape === 'elite') this.notify('정예만 모인 방! 한 번에 몰려온다');
    }
    // Nobody strikes while the player is still walking in.
    if (this.s.entry) for (const e of this.s.enemies) e.ready = Math.max(e.ready || 0, this.s.entry.until + 0.4);
    this.save();
  }
  get obstacles() {
    // Crates, fences and music boxes stand in the way of feet and shots alike. Asked for by every step of every body,
    // so the list is kept until a piece appears or breaks.
    const list = this.roomHazards, plain = this.s.mode === 'intro' || !this.s.run || this.map;
    let gone = 0; for (const h of list) if (h.gone) gone++;
    const cache = this.obstacleCache, layout = plain ? null : this.s.run.plan[this.s.run.node].layout;
    if (cache && cache.list === list && cache.size === list.length && cache.gone === gone && cache.layout === layout) return cache.value;
    const solid = list.filter(h => SOLID.has(h.kind) && !h.gone).map(hazardBox);
    const value = plain ? solid : [...this.config.roomLayouts[layout].obstacles, ...solid];
    this.obstacleCache = { list, size: list.length, gone, layout, value };
    return value;
  }
  /** The hazards of the room the run stands in: through the fight, the reward and the walk to the portal. */
  get roomHazards() { return this.s.run && ROOM_MODES.has(this.s.mode) ? this.s.hazards || [] : []; }
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
    // The dodge's wait is the same for everyone: no reward or stat shortens it.
    this.p.dodgeReady = this.s.time + d.cooldown;
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
    if (enemy.hp <= 0 || enemy.hidden || enemy.summonUntil > this.s.time) return { crit: false, killed: false };
    if (!enemy.aggro) this.rouse(enemy);
    const crit = !options.dot && !options.exact && this.rollCrit();
    const guarded = !options.dot && this.shieldHolds(enemy);
    if (guarded) this.sense({ kind: 'block' });
    // A trait shield gives way after a few blocked blows.
    if (guarded && enemy.shieldHits !== undefined && ++enemy.shieldHits >= (this.config.eliteAffixes?.list.find(a => a.id === 'brassShield')?.breakHits || Infinity)) {
      enemy.frontGuard = 0; enemy.shieldHits = undefined; enemy.shieldBroken = true; this.effect('scrap', enemy.x, enemy.y - enemy.radius, '#ffbe20', 0.5, 0.8);
    }
    // A boss behind its phase-break shield takes nothing; one just broken out of it takes more.
    if (enemy.breaking) { this.effect('spark', enemy.x, enemy.y - enemy.radius, '#7fc7e0', 0.2, 0.6); this.sense({ kind: 'block' }); return { crit: false, killed: false }; }
    const opened = enemy.vulnerableUntil > this.s.time ? 1 + enemy.vulnerableBonus : 1;
    const amount = (options.exact ? 1 : opened) * base * (options.dot || options.exact ? 1 : this.damageMultiplier(enemy, !!options.basic, options.slot)) * (crit ? this.c.caps.critMultiplier + (this.stats.critDamage || 0) : 1) * (guarded ? 1 - enemy.frontGuard : 1);
    // Hitting a boss during its alarm brings the claw straight back at whoever did it.
    if (!options.dot && enemy.alarmUntil > this.s.time && this.hurt(enemy.damage)) this.effect('beam', enemy.x, enemy.y, '#cf767a', 0.45, 1, { targetX: this.p.x, targetY: this.p.y, look: 'thrust' });
    if (guarded) this.effect('spark', enemy.x, enemy.y - enemy.radius, '#d8dde2', 0.2, 0.6);
    const beaten = !options.dot && enemy.beatUntil > this.s.time ? 1 - this.config.enemies.drummer.beatArmor : 1;
    enemy.hp = enemy.dummy ? enemy.maxHp : Math.max(this.tutorial.guardSurvives ? 1 : 0, enemy.hp - amount * beaten); enemy.flashUntil = this.s.time + 0.12;
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
      // The body bursts into parts thrown away from F2: a few for the wrench, more for a skill, most for a fusion.
      const parts = options.source === 'fusion' ? PARTS.fusion : options.source === 'skill' ? PARTS.skill : PARTS.wrench;
      enemy.tell = null; this.effect('parts', enemy.x, enemy.y, enemy.color || '#dbbc6b', PARTS.seconds, parts, { angle: Math.atan2(enemy.y - this.p.y, enemy.x - this.p.x), big: !!enemy.boss || enemy.type === 'elite' });
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
    // `swing` names the blow, so the frame holds once per swing however many bodies it catches, frame after frame.
    this.sense({ kind: heavy ? 'heavy' : 'hit', crit: hit.crit, angle: attack.angle, swing: attack });
    // The third blow lands with a ring and a puff of dust where it first strikes.
    if (heavy && !attack.waveShown) { attack.waveShown = true; this.effect('ring', enemy.x, enemy.y, '#fff4d6', 0.4, 1.2, { look: 'quake' }); this.effect('dust', enemy.x, enemy.y + enemy.radius * 0.6, '#b49f78', 0.45, 1); }
    // A small burst of light where the wrench meets the body; the third blow throws a bigger one.
    this.effect('impact', enemy.x, enemy.y - 0.7, heavy ? '#ffd257' : '#fff4d6', heavy ? 0.22 : 0.14, heavy ? 1.3 : 0.8, { angle: attack.angle });
    enemy.joltUntil = this.s.time + JOLT_SECONDS;
    // The body is shoved back over a short slide (fast, then slowing), not moved in one jump.
    if (!enemy.boss && !enemy.dummy && !enemy.stationary && enemy.hp > 0) { const push = heavy ? HEAVY_KNOCKBACK : LIGHT_KNOCKBACK; enemy.shove = { x: cos * push, y: sin * push, elapsed: 0 }; }
  }
  addStagger(enemy, amount, applyPressure = true) {
    if (!enemy.boss || this.s.time < enemy.staggerLock) return;
    // Stagger is still counted (skills are tuned by it), but a full gauge no longer opens a 'wound-spring exposed' window:
    // it made bosses too easy (2026-11-06). Only a solved phase break stuns a boss now.
    enemy.stagger = Math.min(this.c.balance.bossStaggerThreshold[enemy.kind], enemy.stagger + amount * (applyPressure && enemy.statuses.windPressure > this.s.time ? 1 + this.windBonus : 1));
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
          if (this.wrenchMod('elementalCharge') && enemy.hp > 0) { a.statusCast ??= { id: this.id('wrench'), staggerUsed: {}, fusion: false }; for (const slot of this.slots) this.applyStatus(enemy, slot.element, a.statusCast); if (this.slots.length) this.effect('spark', enemy.x, enemy.y, '#ffd257', 0.6, 1, { look: 'ready' }); }
        }
      }
      const deflect = this.wrenchMod('deflect');
      if (deflect) {
        const mod = deflect;
        for (const bullet of this.s.projectiles) if (!bullet.friendly && inCone(this.p, bullet, a.angle, range + deflect.reach, this.config.rules.comboArcDegrees)) { bullet.friendly = true; bullet.angle = a.angle; bullet.damage = this.damageTaken(bullet.damage); bullet.exact = true; bullet.speed = mod.reflectedSpeed; this.effect('spark', bullet.x, bullet.y, '#86c0ac', 0.5, 1, { look: 'deflect' }); }
      }
      if (a.phase === 2 && !a.wave && this.s.run?.mods.includes('shockwave')) {
        a.wave = true; const mod = this.config.mods.find(m => m.id === 'shockwave');
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(this.p, enemy) <= mod.radius) this.hitEnemy(enemy, mod.damage, { basic: true });
        this.effect('ring', this.p.x, this.p.y, '#f0c369', 0.7, mod.radius, { look: 'quake' });
      }
    }
    if (a.elapsed >= info.windup + info.active + a.recovery) { this.p.attack = null; this.p.comboExpires = this.s.time + this.config.rules.comboReset; }
  }
  // In town (no run, no back yard) the equipped elements still fill the skill bar, so the player sees what they set;
  // nothing can be cast there, since town is never `active` (2026-11-06: the bar stood empty).
  get slots() { return this.s.run?.slots || this.s.practice?.slots || this.loadoutSlots; }
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
    this.makeCast(fusion, this.config.fusionBehavior[fusion.id], slot, target, true); this.sense({ kind: 'cast', id: fusion.id, fusion: true, pair: fusion.pair });
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
    if (cast.shape === 'self' || cast.shape === 'moving' || cast.shape === 'cone' || cast.shape === 'dash' || cast.shape === 'crosscut' || cast.shape === 'crescent') { cast.x = this.p.x; cast.y = this.p.y; }
    if (cast.shape === 'crescent') cast.travel = cast.startDistance || 0;
    if (cast.shape === 'moving' && cast.startDistance) this.move(cast, Math.cos(angle)*cast.startDistance, Math.sin(angle)*cast.startDistance, .2);
    if (['target', 'orb'].includes(cast.shape) && behavior.delay > 0) this.effect('friendlyTell', cast.x, cast.y, cast.color, behavior.delay, cast.radius, { skill: cast.skillId, mark: floorMark(cast.elements) });
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
    const hit = this.hitEnemy(enemy, damage, { slot: cast.slot, color: cast.color, source: cast.fusion ? 'fusion' : 'skill' });
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
      // 빙풍 절단: one wide ice crescent carried forward on the wind; everything it passes over is cut once.
      if (cast.shape === 'crescent') {
        if (cast.age < (cast.delay || 0)) continue;
        const fx = Math.cos(cast.angle), fy = Math.sin(cast.angle), from = cast.travel, to = Math.min(cast.range, from + cast.speed * dt);
        cast.travel = to; cast.x = cast.startX + fx * to; cast.y = cast.startY + fy * to;
        const crossed = target => { const dx = target.x - cast.startX, dy = target.y - cast.startY, along = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx), r = target.radius || 0.4; return along >= from - cast.thickness - r && along <= to + cast.thickness + r && side <= cast.halfWidth + r; };
        this.elementOnHazards(cast, crossed);
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && !cast.hit.includes(enemy.id) && crossed(enemy)) { cast.hit.push(enemy.id); this.castHit(cast, enemy); }
        if (to >= cast.range) { cast.done = true; this.effect('ring', cast.x, cast.y, '#bfe9f4', 0.5, 1.2, { look: 'frostCrescentBreak', angle: cast.angle }); }
        continue;
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
              this.effect('friendlyTell', first.x, first.y, cast.color, m.delay, m.radius, { mark: 'lightning' });
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
  /** What a blow of `amount` takes off F2 after armour and perks (a reflected bullet carries this same number). */
  damageTaken(amount) { return amount * (1 - (this.stats.damageReduction || 0)) * (1 + (this.perk('overheatEngine')?.damageTaken || 0)); }
  hurt(amount) {
    if (!this.active || this.s.time + 1e-7 < this.p.invulnerableUntil) return false;
    // The first lesson in the scrapyard teaches the dodge: a hit still flashes and stuns, but costs no health.
    amount = this.s.mode === 'intro' ? 0 : this.damageTaken(amount);
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
      // On a run F2 falls where she stood, lies still a moment, and only then is carried home (2026-11-06).
      else if (this.s.run) { this.s.downUntil = this.s.time + DOWN_SECONDS; this.p.attack = null; this.p.dodge = null; }
      else this.returnToHub('defeat');
    }
    return true;
  }
  effect(type, x, y, color, duration, value, extra = {}) {
    this.s.effects.push({ id: this.id('fx'), type, x, y, color, created: this.s.time, until: this.s.time + duration, duration, value, ...extra });
  }
  /** The ranks of soldiers walking now (not those still waiting to set off), each with its line and gap. */
  get rankLines() { return (this.s.ranks || []).filter(rank => rank.at >= 0 && rank.at < 1).map(rank => ({ rank, ...this.rankLine(rank) })); }
  /** A line for the player to read while a boss pattern is running. */
  get bossWarning() {
    const { time } = this.s, boss = this.s.enemies.find(e => e.boss && e.hp > 0);
    if (!boss) return '';
    if (boss.alarmUntil > time || boss.tell?.type === 'alarm') return '경보! 공격을 멈추세요';
    if (boss.bellUntil > time || boss.tell?.type === 'bell') return '종이 울립니다! 움직이지 마세요';
    if (boss.tell?.type === 'carpet') return '초록 카펫 위로 이동하세요';
    if (['column', 'parade'].includes(boss.tell?.type) || this.s.ranks?.length) return '병정 대열이 세 줄 옵니다! 줄마다 틈으로 지나가세요';
    if (boss.tell?.type === 'drill') return '구령 훈련! 구령을 따르세요';
    if (this.s.drill) return this.s.drill.steps[this.s.drill.index] === 'still' ? '구령: 멈춰!' : '구령: 앞으로! 계속 걸으세요';
    if (boss.tell?.type === 'crateToss') return '상자가 떨어집니다! 로코 옆에서 터뜨리면 기절합니다';
    return '';
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
    // The town portal asks for a difficulty first; the player is set back a step so closing the popup does not reopen it.
    else if (this.s.mode === 'hub' && this.readyToLeave) { p.y -= LEAVE_REFUSED_UNITS; this.s.panel = 'difficulty'; }
    else if (this.s.mode === 'hub') { p.y -= LEAVE_REFUSED_UNITS; this.notify('모루에게 속성 2개를 고른 뒤 출발하세요.'); }
  }
  /**
   * One step of a dodge already under way. The slide bursts out fast and eases off to about walking pace at its end
   * (not a flat speed that stops dead), so it flows into the walk that follows; the distance covered is the same.
   */
  moveDodge(dt, radius) {
    const p = this.p, d = this.c.player.dodge, reach = d.distance * (p.dodge.boost || 1), ease = u => u + DODGE_EASE * u * (1 - u);
    const from = ease(Math.min(1, p.dodge.elapsed / d.duration)), to = ease(Math.min(1, (p.dodge.elapsed + dt) / d.duration)), step = reach * (to - from);
    this.move(p, Math.cos(p.dodge.angle) * step, Math.sin(p.dodge.angle) * step, radius);
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
  get wavesLeft() {
    const { run } = this.s, waves = this.room?.waves;
    return !!waves && (run.wave < waves.length - 1 || run.arrivals.length > 0);
  }
  /** The last enemy gets a moment to fall before anything covers the room. */
  holdClear() {
    this.s.projectiles = this.s.projectiles.filter(b => b.friendly); this.s.ranks = [];
    this.s.casts = this.s.casts.filter(c => !HOSTILE_SHAPES.includes(c.shape));
    this.s.clearAt ??= this.s.time + CLEAR_HOLD_SECONDS;
    if (this.s.time >= this.s.clearAt) this.finishCombat();
  }
  update(dt, input = {}) {
    if (this.s.downUntil && !this.s.paused) {
      this.s.time += Math.min(dt, 1 / 30);
      if (this.s.time >= this.s.downUntil) { this.s.downUntil = null; this.returnToHub('defeat'); }
      return;
    }
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
    // A press that cannot act yet (mid-dodge, mid-swing, a moment before a wait runs out) is kept for INPUT_BUFFER seconds
    // and acts on the first step it can, so a dodge, swing or skill pressed a little early is never lost.
    const held = p.buffer ??= {}, now = this.s.time;
    if (input.dodge) held.dodge = now + INPUT_BUFFER;
    if (input.basic) held.basic = now + INPUT_BUFFER;
    if (input.skill !== undefined) held.skill = { index: input.skill, until: now + INPUT_BUFFER };
    if (input.fusion) held.fusion = now + INPUT_BUFFER;
    if (held.dodge > now && this.dodge()) held.dodge = 0;
    if (p.dodge) {
      this.moveDodge(dt);
      const slip = this.trait('slipstream');
      if (slip) for (const enemy of this.s.enemies) if (enemy.hp > 0 && distance(p, enemy) <= enemy.radius + slip.radius) { if (!(enemy.statuses.windPressure > this.s.time)) this.effect('dodge', enemy.x, enemy.y, '#badbd3', 0.45, 1, { look: 'gust', angle: p.moveAngle }); enemy.statuses.windPressure = this.s.time + this.c.statuses.find(s => s.id === 'windPressure').duration; }
    // A wrench swing plants the feet: the player stands still until the swing and its recovery end.
    } else if (!p.attack && !this.s.casts.some(c => c.shape === 'dash')) {
      const stuck = this.s.casts.find(c => c.shape === 'sticker' && floorDistance(p, c) < c.radius);
      const speed = this.c.player.speed * (1 + (this.stats.moveSpeed || 0)) * (stuck ? 1 - stuck.slow : 1);
      this.move(p, dx * speed * dt, dy * speed * dt);
    }
    if (held.basic > now && this.basicAttack()) held.basic = 0;
    if (held.skill?.until > now && this.castSkill(held.skill.index, input.aim)) held.skill = null;
    if (held.fusion > now && this.castFusion(input.aim)) held.fusion = 0;
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
      const r = cast.age * cast.speed, d = floorDistance(p, cast);
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
      if (floorDistance(p, cast) < cast.radius) {
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
    // A room may set its own pay (slice.json rooms[].rewards): the early street pays less and the stretch after the night
    // market more, so a run is worth most for going deep (2026-11-06); others take the region's flat amounts.
    const gears = this.room.rewards?.gears ?? (kind === 'miniboss' ? region.miniReward : kind === 'regionBoss' ? region.bossReward : region.normalReward);
    const coins = this.room.rewards?.coins ?? this.data.progression.economy.runCoinRewards[kind === 'normal' ? 'normal' : kind];
    const loot = this.difficulty.loot;
    return { gears: Math.round(gears * loot * (1 + (this.stats.gearGain || 0))), coins: Math.round(coins * loot * (1 + (this.stats.coinGain || 0))) };
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
    // The room's furniture stays where it stands while the reward is chosen and the portal walked to; only lit fuses go out.
    const furniture = (this.s.hazards || []).filter(h => !h.gone).map(({ fuseAt, ...h }) => h);
    this.clearCombat(); this.s.hazards = furniture;
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
  nextNode(branch = 0) {
    if (this.s.mode !== 'route' && this.s.mode !== 'shop') return false;
    if (![0, 1].includes(branch)) return false;
    this.s.run.node++; this.s.run.branches.push(branch); this.sense({ kind: 'portal' });
    // Both alternatives are authored encounters at the same depth.
    const plan = this.s.run.plan[this.s.run.node], room = this.room;
    if (room.variants) plan.variant = (plan.variant + branch) % room.variants.length;
    this.enterNode(); return true;
  }
  /** The night market's shop, and the travelling merchant before the boss (its own once-per-visit list). */
  buyShop(id) {
    if (this.s.mode !== 'shop' && this.s.mode !== 'merchant') return false;
    const item = this.data.progression.economy.shop.find(i => i.id === id), run = this.s.run, bought = this.s.mode === 'merchant' ? (run.merchantBought ??= []) : run.shopBought;
    if (!item || !['heal', 'skillLevel', 'persistentGears'].includes(id) || run.coins < item.cost || (item.oncePerShop && bought.includes(id))) return false;
    if (id === 'heal' && this.p.hp >= this.p.maxHp) return false;
    const slot = this.slots.find(s => s.level < this.c.balance.skillMaxLevel);
    if (id === 'skillLevel' && !slot) return false;
    run.coins -= item.cost;
    if (id === 'heal') this.heal(item.amount);
    if (id === 'skillLevel') slot.level++;
    if (id === 'persistentGears') this.s.profile.freeGears += item.amount;
    bought.push(id); this.save(); return true;
  }
  /** Leaving the travelling merchant: the walk to the boss's portal. */
  leaveMerchant() {
    if (this.s.mode !== 'merchant') return false;
    this.s.mode = 'route'; this.save(); return true;
  }
  returnToHub(reason = 'abandon') {
    if (!this.s.run || !['combat', 'reward', 'route', 'shop', 'merchant', 'unwind', 'complete'].includes(this.s.mode)) return false;
    this.s.downUntil = null;
    const run = this.s.run, profile = this.s.profile, economy = this.data.progression.economy;
    let bonus = 0;
    if (run.clears.length && !profile.firstReturnClaimed) { bonus = economy.firstReturnBonus; profile.freeGears += bonus; profile.firstReturnClaimed = true; }
    if (reason === 'defeat') this.sense({ kind: 'fail' });
    this.s.result = { reason, difficulty: run.difficulty || 'normal', node: run.node + 1, elapsed: run.elapsed, baseGears: run.baseGears, bonus, seed: run.seed, damageTaken: run.damageTaken, elements: run.slots.map(s => s.element) };
    profile.history.unshift(this.s.result); profile.history = profile.history.slice(0, 10);
    this.onRun('runEnd', { run: run.id, difficulty: run.difficulty || 'normal', elements: this.s.result.elements, reason: ['clear', 'defeat'].includes(reason) ? reason : 'abandon', node: this.s.result.node, seconds: Math.round(run.elapsed) });
    this.clearCombat(); this.s.run = null; this.resetPlayer(); this.s.mode = 'returned'; this.save(); return true;
  }
  /**
   * Gifts of free gears sent from the admin page. Each is paid once: its id stays in the save (a linked device or a
   * lost claim never pays twice). Returns the ids to report as taken, already-paid ones included.
   */
  receiveGifts(gifts) {
    const profile = this.s.profile, paid = profile.giftsTaken ??= [];
    const valid = (Array.isArray(gifts) ? gifts : []).filter(g => Number.isInteger(g?.id) && g.id > 0 && Number.isInteger(g.gears) && g.gears > 0 && g.gears <= 100000);
    const fresh = valid.filter(g => !paid.includes(g.id));
    for (const gift of fresh) {
      profile.freeGears += gift.gears; paid.push(gift.id);
      const note = typeof gift.note === 'string' ? gift.note.trim().slice(0, 60) : '';
      this.notify(`${note ? `${note} · ` : '운영자 선물 · '}자유 톱니 ${gift.gears}개를 받았습니다.`); this.s.notices.at(-1).until += 4;
    }
    profile.giftsTaken = paid.slice(-200);
    if (fresh.length) this.save();
    return valid.map(g => g.id);
  }
  /** Writes the name in Moru's repair ledger (blank goes back to the product number F2). Returns the kept name. */
  setNickname(text) {
    this.s.profile.nickname = cleanNickname(text); this.save();
    return this.s.profile.nickname;
  }
  acknowledgeReturn() { if (this.s.mode !== 'returned') return false; this.s.mode = 'hub'; this.enterHub(); this.save(); return true; }
}
import {crosscutSegment,clampContains} from './fusion-geometry.js';
import { cleanNickname } from './nickname.js';
/** How front-loaded a dodge is: 0 is a flat speed; 0.7 starts at 1.7× the average and ends at 0.3× (about walking pace). */
const DODGE_EASE = 0.7;
/** Seconds an early press of dodge, wrench, skill or fusion is remembered (see the combat step). */
const INPUT_BUFFER = 0.15;
/** Parts a body bursts into when it falls (how many pieces by what struck it), and how long they fly and bounce. */
const PARTS = { wrench: 7, skill: 10, fusion: 14, seconds: 0.9 };
// The game's behaviour is split by subject; each part is installed on Game.prototype, so `this` is the game throughout.
Object.assign(Game.prototype, enemyActions, roomWaves, rewardDraws);
