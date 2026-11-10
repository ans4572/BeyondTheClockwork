import { createProfile, permanentStats, buyRank, refundAll, enterChapter } from './progression.js';
import { chapterOf, chapterRooms, chapterOpen, chapterCleared, clearChapter, chapterRecords, FIRST_CHAPTER } from './chapters.js';
import { roomTitle } from './room-title.js';
import { fitsMap, pointInPolygon, placeOf, roomPlace } from './map-geometry.js';
// How far back from the spawn point the player starts, walking in from the map's edge.
const ENTRY_UNITS = 3.5;
import { Tutorial } from './tutorial.js';
import { FlowField } from './flow-field.js';
import { dealRun } from './encounters.js';
import { dealHazards, musicRooms, SOLID, hazardBox, pressState, slamNow, laserState, laserPosts, steamState } from './hazards.js';
import { clamp, distance, floorDistance, angleDiff, inCone, segmentDistance, FLOOR_FLAT } from './math.js';
import { enemyActions } from './enemy-actions.js';
import { roomWaves } from './room-waves.js';
import { factoryMobs } from './factory-mobs.js';
import { factoryBosses } from './factory-bosses.js';
import { soundWaterFusions } from './sound-water-fusions.js';
import { rewardDraws } from './reward-draws.js';
import { noteRecord } from './records.js';

export { clamp, distance, segmentDistance };

/** Modes in which the player is still in a run room (fighting, choosing a reward, walking to the portal). */
const ROOM_MODES = new Set(['combat', 'reward', 'route', 'unwind']);
/** How long before a summoned body appears its rift starts to open (the renderer's summonRift reaches its light column then). */
export const SUMMON_RISE_SECONDS = 9 / 14;
/** How long F2 lies fallen in the room before a lost run goes home (the fall plays first). */
const DOWN_SECONDS = 1.8;
const WAKE_SECONDS = 1.6, TALK_UNITS = 3, NPC_BODY_UNITS = 0.45, CLEAR_HOLD_SECONDS = 1, LEAVE_REFUSED_UNITS = 1.5, LAST_WAVE_ALREADY_PLAYED = 99;
/** The floor mark a placed skill shows before it lands: fire first (the furnace), then frost, then lightning. */
// Sound and water have their own landing marks too (2026-11-09); wind still has none, so a wind-only cast shows the plain one.
const floorMark = (elements = []) => ['fire', 'ice', 'lightning', 'sound', 'water'].find(e => elements.includes(e)) || null;

// Run parts that add straight onto a permanent stat of the same name.
const RUN_STATS = ['moveSpeed', 'critChance', 'attackSpeed', 'damageReduction'];
// Boss fields that act on the player rather than on enemies.
const HOSTILE_SHAPES = ['magnet', 'suction', 'stickerVolley', 'stickerFall', 'sticker', 'stompRing', 'floorMark'];
/** How long the pixelfx swing and hit sheets play (art/fx/wrench-arc, wrench-hit). */
const WRENCH_ARC_SECONDS = 0.32, WRENCH_HIT_SECONDS = 13 / 30;
/** How long a struck enemy flashes white (flashUntil) and trembles (joltUntil); the renderer reads both from here. */
export const HIT_FLASH_SECONDS = 0.12, JOLT_SECONDS = 0.12;
const CRIT_RED = '#e8433a', LIGHT_KNOCKBACK = 0.15, HEAVY_KNOCKBACK = 0.5, FEEL_LIMIT = 64;
/** How far each blow carries the body forward (units), and how close an enemy in front stops it. */
const LUNGE = [0.25, 0.25, 0.5], LUNGE_STOP = 1.2;

export class Game {
  constructor(data, savedState = null, onSave = () => {}) {
    this.data = data;
    this.onSave = onSave;
    /** Told when an expedition sets out and when it comes back (play statistics, src/ui/stats-report.js). */
    this.onRun = () => {};
    /** Chapters still being made (slice.json chapters[].preview) can be set out for: on for the local dev server only. */
    this.previews = false;
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
    // Nasa's oil drunk on setting out lasts the whole expedition (slice.json potions).
    const oil = this.potion;
    if (oil) for (const id of ['attackDamage', 'maxHp', 'energyGain']) if (oil[id]) stats[id] = (stats[id] || 0) + oil[id];
    return stats;
  }
  /** The oil this expedition set out with (slice.json potions.list), or null. */
  get potion() { const id = this.s.run?.potion; return id ? this.config.potions?.list.find(p => p.id === id) || null : null; }
  /** Nasa stands at the workshop once the chapter he is rescued in (potions.joinsAfter) has been beaten. */
  get nasaJoined() { const after = this.config.potions?.joinsAfter; return !!after && chapterCleared(this.s.profile, after); }
  /** Buys one bottle from Nasa's shelf for the next expedition. Only one goes along: another one swaps it, the first refunded. */
  buyPotion(id) {
    const rules = this.config.potions, item = rules?.list.find(p => p.id === id), profile = this.s.profile;
    if (this.s.mode !== 'hub' || !this.nasaJoined || !item || profile.potion === id) return false;
    const held = rules.list.find(p => p.id === profile.potion), refund = held ? held.cost : 0;
    if (profile.freeGears + refund < item.cost) return false;
    profile.freeGears += refund - item.cost; profile.potion = id; this.save(); return true;
  }
  /** Puts the bottle back on the shelf, its price returned. */
  returnPotion() {
    const profile = this.s.profile, held = this.config.potions?.list.find(p => p.id === profile.potion);
    if (this.s.mode !== 'hub' || !held) return false;
    profile.freeGears += held.cost; profile.potion = null; this.save(); return true;
  }
  /** The chapter of the expedition under way (chapter 1 outside one). */
  get chapter() { return chapterOf(this.config, this.s.run?.chapter); }
  /** The stops of that chapter, in order. */
  get rooms() { return chapterRooms(this.config, this.s.run?.chapter); }
  /** The room the run stands in, with the waves this run dealt for it (a run saved before dealing keeps the designed ones). */
  get room() {
    const run = this.s.run; if (!run) return null;
    const base = this.rooms[run.node], dealt = run.plan?.[run.node];
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
  get hubMap() {
    const place = placeOf(this.data.maps, this.data.maps?.hub);
    // A villager who joins later (npcs[].after: a chapter to beat first) is not there before then.
    if (!place?.npcs?.some(npc => npc.after)) return place;
    const npcs = place.npcs.filter(npc => !npc.after || chapterCleared(this.s.profile, npc.after));
    if (npcs.length === place.npcs.length) return place;
    if (this.hubWithout?.base !== place || this.hubWithout.count !== npcs.length) this.hubWithout = { base: place, count: npcs.length, place: Object.assign(Object.create(place), { npcs }) };
    return this.hubWithout.place;
  }
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
  clearCombat() { this.s.clearAt = null; this.s.ranks = []; this.s.bellWatch = null; this.s.panel = null; this.s.enemies = []; this.s.blasts = []; this.s.hazards = []; this.s.parades = []; this.s.drill = null; this.p.confiscated = null; this.p.blown = null; this.p.grabbed = null; this.p.markedUntil = 0; this.p.failStacks = 0; this.p.failBlastAt = 0; this.p.heldUntil = 0; this.s.bossFields = []; this.s.flow = null; this.s.casts = []; this.s.projectiles = []; this.s.effects = []; this.p.attack = null; this.p.dodge = null; this.p.lastCast = null; this.p.buffer = {}; this.p.charging = null; }
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
  debugJump(node, chapter = FIRST_CHAPTER, difficulty) {
    if (!Number.isInteger(node) || !chapterRooms(this.config, chapter)[node]) return false;
    const level = this.config.difficulty?.levels.some(l => l.id === difficulty) ? difficulty : undefined;
    // A jump into another chapter, or on another difficulty (debug panel, 2026-11-10), starts a fresh run there.
    if (this.s.run && (this.chapter.id !== chapter || (level && (this.s.run.difficulty || this.config.difficulty?.default) !== level))) { this.clearCombat(); this.s.run = null; }
    if (!this.s.run) { this.clearCombat(); this.s.profile.registered = true; this.s.tutorial = null; this.s.mode = 'hub'; this.startRun(undefined, level, chapter); }
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
  /** An element still being made (slice.json elementUnlocks[].preview) is on the shelf only where chapter previews are on. */
  elementShown(id) { return !this.config.elementUnlocks?.[id]?.preview || this.previews; }
  /** Sound and water wait for chapter 1 to be beaten (elementUnlocks[].after); the local test server's unlock skips that. */
  elementOpen(id) {
    const after = this.config.elementUnlocks?.[id]?.after;
    return this.elementShown(id) && (!after || !!this.unlockChapters || chapterCleared(this.s.profile, after));
  }
  buyElement(id) {
    const profile = this.s.profile, price = this.nextElementPrice;
    if (this.s.mode !== 'hub' || !this.config.elements.includes(id) || !this.elementOpen(id) || profile.ownedElements.includes(id) || price === null || profile.freeGears < price) return false;
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
    if (action === 'buy') result = buyRank(this.data, this.s.profile, statId, this.previews);
    if (action === 'refund') { refundAll(this.data, this.s.profile); result = true; }
    if (result) { const { x, y } = this.p; this.resetPlayer(); Object.assign(this.p, { x, y }); this.save(); }
    return result;
  }
  /** The expedition's difficulty (slice.json difficulty): a run saved before difficulties existed plays as the default. */
  get difficulty() {
    const rules = this.config.difficulty, id = this.s.run?.difficulty || rules?.default;
    const level = rules?.levels.find(level => level.id === id) || { id: 'normal', scale: 1, loot: 1 };
    // A later chapter is harder and pays more at every difficulty (slice.json chapters[].scale and .loot).
    const { scale = 1, loot = 1 } = this.s.run ? this.chapter : {};
    return scale === 1 && loot === 1 ? level : { ...level, scale: level.scale * scale, loot: level.loot * loot };
  }
  /** Setting out from the town portal: the difficulty picked in the popup, remembered as the next one offered. */
  depart(difficulty, chapter = FIRST_CHAPTER) {
    if (this.s.mode !== 'hub' || this.s.panel !== 'difficulty' || !this.config.difficulty?.levels.some(level => level.id === difficulty)) return false;
    if (chapterOf(this.config, chapter).id !== chapter || !chapterOpen(this.config, this.s.profile, chapter, this.previews, this.unlockChapters)) return false;
    this.s.panel = null; this.s.profile.lastDifficulty = difficulty; this.s.profile.lastChapter = chapter;
    return this.startRun(undefined, difficulty, chapter);
  }
  startRun(seed = Date.now() >>> 0, difficulty = this.config.difficulty?.default, chapter = FIRST_CHAPTER) {
    if (this.s.mode !== 'hub' || !this.s.profile.registered) return false;
    this.s.rng = seed || 1; this.s.profile.runs++;
    this.s.run = { id: `run-${this.s.profile.runs}-${seed}`, seed, node: 0, startedAt: this.s.time, elapsed: 0, coins: 0, slots: this.loadoutSlots, upgrades: {}, mods: [], skillMods: [], traits: [], clears: [], rewardChoices: [], shopBought: [], branches: [], damageTaken: 0, baseGears: 0, difficulty: difficulty || 'normal' };
    if (chapter !== FIRST_CHAPTER) this.s.run.chapter = chapter;
    // Nasa's bottle is drunk on setting out: it goes with this run and leaves the shelf.
    if (this.s.profile.potion) { this.s.run.potion = this.s.profile.potion; this.s.profile.potion = null; }
    enterChapter(this.s.profile, this.chapter.number || 1);
    // Generate the whole route once; resuming never rerolls layouts or encounters.
    this.s.run.plan = this.rooms.map(room => ({ variant: room.variants ? Math.floor(this.random() * room.variants.length) : 0, layout: room.boss || room.kind === 'shop' ? 2 : Math.floor(this.random() * this.config.roomLayouts.length) }));
    // Every run deals its own mix and formation for each fight, at the designed weight (see encounters.js). A chapter
    // may say from which stop elites carry a trait (chapters[].affixesFrom).
    const traits = this.config.eliteAffixes && { ...this.config.eliteAffixes, list: this.config.eliteAffixes.list.filter(a => !a.chapter || a.chapter === this.chapter.id) };
    const affixes = traits && this.chapter.affixesFrom ? { ...traits, oneFrom: this.chapter.affixesFrom } : traits;
    // An elite-only room's waves and the chapter's own elite (its health sets how much tougher they are made).
    const eliteKind = this.chapter?.eliteType || 'elite', eliteRoom = { ...this.config.rules.eliteRoom, ...(this.chapter?.eliteRoomWaves && { waves: this.chapter.eliteRoomWaves }), hp: this.config.enemies[eliteKind]?.hp };
    dealRun(this.rooms, this.config.enemies, seed, affixes, this.difficulty, eliteRoom).forEach((dealt, i) => { if (dealt) Object.assign(this.s.run.plan[i], dealt); });
    this.resetPlayer(); if (this.potion?.fullEnergy) this.p.energy = this.c.player.maxEnergy; this.enterNode();
    this.report('runStart', { run: this.s.run.id, elements: this.s.run.slots.map(s => s.element), difficulty: this.s.run.difficulty, chapter: this.chapter.id });
    return true;
  }
  /**
   * Play statistics go to the server for chapter 1 only for now: chapter 2 still borrows chapter 1's enemies and bosses,
   * so its runs would only blur the clear board and the admin figures.
   */
  report(kind, event) { if (this.chapter.id === FIRST_CHAPTER) this.onRun(kind, event); }
  /** The chapter's last boss is down: the run ends in the chapter's ending. */
  finishChapter() { this.s.mode = 'complete'; this.s.profile.wins++; clearChapter(this.s.profile, this.chapter.id); }
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
      const base = this.chapter.hazards ? { ...this.config.hazards, ...this.chapter.hazards } : this.config.hazards;
      // A stop may add its own devices (rooms[].hazardCounts: the belt hall's belts, the crane yard's cranes).
      const rulesOf = stop => (stop.hazardCounts && base ? { ...base, counts: { ...base.counts, ...stop.hazardCounts } } : base);
      const rules = rulesOf(room);
      if (rules && map?.walkable && map.size) {
        // Which fight of the run this is: the first three ease the furniture in (slice.json hazards.ramp).
        const step = this.rooms.slice(0, this.s.run.node).filter(r => r.waves).length;
        // The same number of music boxes every expedition, in rooms the run's seed picks (hazards.musicboxesPerRun).
        const fights = this.rooms.map((stop, node) => ({ stop, node })).filter(f => f.stop.waves).map(({ stop, node }, i) => ({ node, range: base.ramp?.[i]?.counts?.musicbox ?? rulesOf(stop).counts?.musicbox ?? [0, 0] }));
        const boxes = musicRooms(fights, base, (Math.imul(this.s.run.seed, 2654435761) + 17) >>> 0);
        plan.hazards ??= dealHazards(map, rules, (this.s.run.seed * 31 + this.s.run.node * 7919) >>> 0, step, this.difficulty.scale, boxes ? +boxes.has(this.s.run.node) : undefined);
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
      if (plan.shape === 'elite') this.notify(`정예만 모인 방! ${room.waves.length > 1 ? `${room.waves.length}번에 걸쳐` : '한 번에'} 몰려온다`);
    }
    // Nobody strikes while the player is still walking in.
    if (this.s.entry) for (const e of this.s.enemies) e.ready = Math.max(e.ready || 0, this.s.entry.until + 0.4);
    this.save();
  }
  get obstacles() {
    // Crates, fences and music boxes stand in the way of feet and shots alike. Asked for by every step of every body,
    // so the list is kept until a piece appears or breaks.
    const list = this.roomHazards, plain = this.s.mode === 'intro' || !this.s.run || this.map;
    // A press stands in the way only while it is down; which presses are down is part of the cache key.
    const press = this.config.hazards?.press, t = this.s.time;
    let gone = 0, down = ''; for (const h of list) { if (h.gone) gone++; else if (h.kind === 'press' && press && pressState(h, t, press).state === 'slam') down += h.id; }
    const cache = this.obstacleCache, layout = plain ? null : this.s.run.plan[this.s.run.node].layout;
    if (cache && cache.list === list && cache.size === list.length && cache.gone === gone && cache.down === down && cache.layout === layout) return cache.value;
    const laser = this.config.hazards?.laser;
    const solid = list.filter(h => !h.gone).flatMap(h => (SOLID.has(h.kind) ? [hazardBox(h)] : h.kind === 'laser' && laser ? laserPosts(h, laser.post) : h.kind === 'press' && down.includes(h.id) ? [hazardBox(h)] : []));
    const value = plain ? solid : [...this.config.roomLayouts[layout].obstacles, ...solid];
    this.obstacleCache = { list, size: list.length, gone, down, layout, value };
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
    // Shut in a boss hall, F2 stays between its top and bottom (the laser gates; factory-bosses.js fbHallGates).
    const hall = body === this.p && this.fbHallShut() ? this.fbArena() : null, top = hall ? Math.max(bounds.top + radius, hall.y) : bounds.top + radius, bottom = hall ? Math.min(bounds.bottom - radius, hall.y + hall.h) : bounds.bottom - radius;
    for (let i = 0; i < steps; i++) {
      const x = clamp(body.x + dx / steps, bounds.left + radius, bounds.right - radius);
      if (!blocked(x, body.y)) body.x = x;
      const y = clamp(body.y + dy / steps, top, bottom);
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
  /** Stunned (an Iris decoy struck, factory-bosses.js fbSwing): no step, swing, dodge or skill until it wears off; presses wait in the buffer. */
  get stunned() { return this.p.stunUntil > this.s.time; }
  dodge() {
    if (!this.onFoot || this.s.time < this.p.dodgeReady || this.p.dodge || this.stunned) return false;
    // A dodge always cuts the wrench short, at any point of any blow: the swing simply stops where it is.
    this.p.attack = null;
    const d = this.c.player.dodge;
    this.p.dodge = { elapsed: 0, angle: this.p.moveAngle, x: this.p.x, y: this.p.y };
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
    if (!(this.active || this.leaving) || this.p.attack || this.p.dodge || this.stunned || this.s.casts.some(c => c.shape === 'dash')) return false;
    if (this.s.time > this.p.comboExpires) this.p.combo = 0;
    const phase = this.p.combo, info = this.c.player.combo[phase];
    const mod = this.s.run?.mods.includes('quickThird') && phase === 2 ? this.config.mods.find(m => m.id === 'quickThird').recoveryReduction : 0;
    this.p.attack = { phase, elapsed: 0, angle: this.p.angle, hit: [], energyGiven: false, recovery: Math.max(0, info.recovery - mod), reflected: false, wave: false, empowered: this.s.time < (this.p.strikeUntil || 0) };
    if (this.p.attack.empowered) this.p.strikeUntil = 0;
    this.p.combo = (phase + 1) % this.c.player.combo.length; return true;
  }
  /** Moru's tuning alone (no run parts, no oil). */
  get tuning() { return permanentStats(this.data, this.s.profile); }
  /**
   * Every source simply adds up, with no cap over the sum (2026-11-08: crit used to stop at 30% once tuned to 20, so
   * the crit part did nothing). The tuning's own ranks (maxRank 30) and each run part's maxRank are the only limits.
   *   attackBonus: tuning + the oil.  critChance: base + tuning + the run part + the glass spring.
   *   cooldownReduction: tuning + the run part.
   */
  get attackBonus() { return (this.tuning.attackDamage || 0) + (this.potion?.attackDamage || 0); }
  get critChance() { return (this.c.player.critChance || 0) + (this.tuning.critChance || 0) + this.upgradeAmount('critChance') + (this.perk('glassSpring')?.critBonus || 0); }
  get cooldownReduction() { return (this.tuning.cooldownReduction || 0) + this.upgradeAmount('skillCooldownReduction'); }
  damageMultiplier(enemy, basic = false, slot = null) {
    const permanent = this.attackBonus;
    const brand = basic && enemy.burnStacks?.some(t => t > this.s.time) ? this.trait('burnBrand')?.damageBonus || 0 : 0;
    const frost = basic && this.trait('frostCrack'), crack = !frost ? 0 : enemy.frozenUntil > this.s.time ? frost.damageBonus : enemy.statuses.chill > this.s.time ? frost.chilledBonus || 0 : 0;
    const runBonus = (basic ? this.upgradeAmount('basicDamage') : 0) + brand + crack;
    const level = slot ? 1 + (slot.level - 1) * this.c.balance.skillLevelDamagePerLevel : 1;
    const rarity = slot ? this.c.balance.rarityDamage[slot.rarity] : 1;
    return (1 + permanent) * (1 + Math.min(this.c.caps.runDamageBonus, runBonus)) * level * rarity * (1 + (this.perk('overheatEngine')?.damageBonus || 0));
  }
  /** Skips the roll at zero chance so runs without the stat keep their random sequence. */
  rollCrit() {
    const chance = this.critChance;
    return chance > 0 && this.random() < chance;
  }
  get statusPower() { return 1 + (this.stats.statusPower || 0); }
  /** The shield only covers the front, and drops for the long recovery after a swing. */
  shieldHolds(enemy) {
    if (!enemy.frontGuard || enemy.state === 'recover' && this.s.time < enemy.ready) return false;
    return Math.abs(angleDiff(Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x), enemy.facing)) * 360 / Math.PI <= enemy.guardArcDegrees;
  }
  hitEnemy(enemy, base, options = {}) {
    // A boss still waiting in his hall cannot be hit from the corridor (factory-bosses.js fbHallGates).
    if (enemy.hp <= 0 || enemy.hidden || enemy.summonUntil > this.s.time || enemy.reviveUntil > this.s.time || (enemy.boss && this.fbHallWaiting())) return { crit: false, killed: false };
    // A parts supplier hit while opening its crate drops the plates: no supply, and a few coins on the floor.
    if (!options.dot && enemy.tell?.type === 'supply') { enemy.tell = null; enemy.state = 'recover'; enemy.ready = this.s.time + 1.5; if (this.s.run) this.giveLoot(0, enemy.spillCoins || 0); this.effect('scrap', enemy.x, enemy.y, '#e0b048', 0.5, 1); this.notify(`부품이 쏟아졌습니다! 동전 +${enemy.spillCoins || 0}`); }
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
    // Resonance: every layer makes the body take a little more from everything.
    const ringing = 1 + this.resonanceOf(enemy) * (this.trait('longEcho')?.damageTakenPerStack ?? this.status('resonance')?.damageTakenPerStack ?? 0);
    // Brass oil: bosses and elites take more from every blow this expedition.
    const versus = !options.exact && (enemy.boss || enemy.elite) ? 1 + (this.potion?.bossDamage || 0) : 1;
    const amount = versus * (options.exact ? 1 : ringing) * base * (options.dot || options.exact ? 1 : this.damageMultiplier(enemy, !!options.basic, options.slot)) * (crit ? this.c.caps.critMultiplier + (this.stats.critDamage || 0) : 1) * (guarded ? 1 - enemy.frontGuard : 1);
    // Hitting a boss during its alarm brings the claw straight back at whoever did it.
    if (!options.dot && enemy.alarmUntil > this.s.time && this.hurt(this.weakened(enemy, enemy.damage))) this.effect('beam', enemy.x, enemy.y, '#cf767a', 0.45, 1, { targetX: this.p.x, targetY: this.p.y, look: 'thrust' });
    if (guarded) this.effect('spark', enemy.x, enemy.y - enemy.radius, '#d8dde2', 0.2, 0.6);
    // Brass plates from a supplier and a drummer's beat soften blows; a body dazed against a wall takes more.
    const beaten = (!options.dot && enemy.beatUntil > this.s.time ? 1 - this.config.enemies.drummer.beatArmor : 1) * (enemy.coatedUntil > this.s.time ? 1 - (enemy.coatArmor || 0) : 1) * (enemy.dazedUntil > this.s.time ? 1 + (enemy.dazedBonus || 0) : 1);
    enemy.hp = enemy.dummy ? enemy.maxHp : Math.max(this.tutorial.guardSurvives ? 1 : 0, enemy.hp - amount * beaten); enemy.flashUntil = this.s.time + HIT_FLASH_SECONDS;
    // 'Reinspect' trait: the first time it falls it stands up again with some health, untouchable for a second.
    this.fbHit(enemy, amount * beaten, options);
    if (enemy.hp <= 0 && enemy.reinspect === 'ready') { enemy.reinspect = 'used'; enemy.hp = Math.round(enemy.maxHp * enemy.reinspectShare); enemy.reviveUntil = this.s.time + 1; enemy.tell = null; enemy.dash = null; this.effect('ring', enemy.x, enemy.y, '#d8423c', 0.8, 1.2, { look: 'reinspect' }); this.notify('재검사! 다시 일어납니다'); return { crit, killed: false }; }
    this.checkPhaseBreak(enemy); if (enemy.boss) this.checkCarpets(enemy);
    // A blow to Roco's back shakes a confiscated skill out of his bag.
    if (enemy.type === 'collectorRoco' && !options.dot && this.p.confiscated && this.isConfiscated(this.p.confiscated.index)
      && Math.abs(angleDiff(Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x), enemy.facing)) * 180 / Math.PI >= this.config.bossAI.collectorRoco.confiscateBackDegrees) {
      this.p.confiscated = null; this.effect('spark', this.p.x, this.p.y, '#ffd257', 0.6, 1, { look: 'ready', follow: true }); this.notify('기술을 되찾았습니다!');
    }
    this.tutorial.onHit(enemy, !!options.basic);
    this.effect('number', enemy.x, enemy.y - enemy.radius, crit ? CRIT_RED : options.color || '#fff4cd', 0.65, amount, { crit });
    if (options.stagger) this.addStagger(enemy, options.stagger);
    const held = enemy.statuses.windPressure > this.s.time ? this.trait('galeHold')?.stunMultiplier || this.status('windPressure').wrenchStun || 1 : 1;
    if (!enemy.boss && options.stagger) enemy.stunUntil = Math.max(enemy.stunUntil, this.s.time + this.config.rules.normalHitStun * held);
    if (enemy.hp <= 0) {
      // The body bursts into parts thrown away from F2: a few for the wrench, more for a skill, most for a fusion.
      const parts = options.source === 'fusion' ? PARTS.fusion : options.source === 'skill' ? PARTS.skill : PARTS.wrench;
      enemy.tell = null; enemy.dash = null; enemy.spin = null; this.effect('parts', enemy.x, enemy.y, enemy.color || '#dbbc6b', PARTS.seconds, parts, { angle: Math.atan2(enemy.y - this.p.y, enemy.x - this.p.x), big: !!enemy.boss || enemy.type === 'elite' });
      if (enemy.statuses.chill > this.s.time && this.trait('coldReap')) this.refundCooldowns(this.trait('coldReap').cooldownRefund);
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
    this.effect('impact', enemy.x, enemy.y - 0.7, heavy ? '#ffd257' : '#fff4d6', WRENCH_HIT_SECONDS, heavy ? 1.3 : 0.8, { angle: attack.angle });
    enemy.joltUntil = this.s.time + JOLT_SECONDS;
    // The body is shoved back over a short slide (fast, then slowing), not moved in one jump.
    // Wind pressure makes a body go further.
    if (!enemy.boss && !enemy.dummy && !enemy.stationary && enemy.hp > 0) { const push = (heavy ? HEAVY_KNOCKBACK : LIGHT_KNOCKBACK) * (enemy.statuses.windPressure > this.s.time ? this.status('windPressure').wrenchKnockback || 1 : 1); enemy.shove = { x: cos * push, y: sin * push, elapsed: 0 }; }
  }
  addStagger(enemy, amount, applyPressure = true) {
    if (!enemy.boss || this.s.time < enemy.staggerLock) return;
    // Stagger is still counted (skills are tuned by it), but a full gauge no longer opens a 'wound-spring exposed' window:
    // it made bosses too easy (2026-11-06). Only a solved phase break stuns a boss now.
    enemy.stagger = Math.min(this.c.balance.bossStaggerThreshold[enemy.kind], enemy.stagger + amount * (applyPressure && enemy.statuses.windPressure > this.s.time ? 1 + this.windBonus : 1));
  }
  status(id) { return this.c.statuses.find(s => s.id === id); }
  /** Layers of resonance a body carries now (0 once it has worn off). */
  resonanceOf(enemy) { return enemy.statuses?.resonance > this.s.time ? enemy.resonanceStacks || 0 : 0; }
  wet(enemy) { return enemy.statuses?.wet > this.s.time; }
  /** A blow of `amount` from `enemy` as it lands on F2: water weakens a wet body's blows (its bullets too, fired while wet). */
  weakened(enemy, amount) { return enemy && this.wet(enemy) ? amount * (1 - (this.status('wet')?.attackCut || 0)) : amount; }
  /** `stacks`: layers of resonance this blow lays on (sound only). */
  applyStatus(enemy, element, cast, stacks = 1) {
    const status = this.c.elements.find(e => e.id === element)?.status;
    if (!status || enemy.immuneTo === status) return;
    const key = `${cast.id}:${status}`, next = enemy.statusApplied[key] || 0;
    if (this.s.time + 1e-7 < next) return;
    enemy.statusApplied[key] = this.s.time + this.c.balance.statusApplyPerCastTargetCooldown;
    // Traits that make a status last longer: 깊은 불씨 (burn), 긴 여운 (resonance), 흠뻑 (wet).
    const info = this.c.statuses.find(s => s.id === status), ember = status === 'burn' ? this.trait('emberStacks') : null;
    const longer = { burn: ember, resonance: this.trait('longEcho'), wet: this.trait('soaked') }[status], lasts = info.duration + (longer?.extraDuration || 0);
    const ringing = this.resonanceOf(enemy);
    enemy.statuses[status] = this.s.time + lasts;
    if (status === 'resonance') {
      enemy.resonanceStacks = Math.min(info.maxStacks, ringing + stacks);
    }
    if (status === 'burn') {
      enemy.burnStacks = enemy.burnStacks.filter(t => t > this.s.time);
      if (enemy.burnStacks.length < info.maxStacks) enemy.burnStacks.push(this.s.time + lasts);
      else enemy.burnStacks[enemy.burnStacks.indexOf(Math.min(...enemy.burnStacks))] = this.s.time + lasts;
      enemy.burnTick ??= this.s.time + info.tickInterval;
    }
    if (status === 'chill') {
      enemy.chillCount += 1 + (cast.chillBonus || 0);
      if (enemy.chillCount >= info.freezeAtApplications) {
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
    const targets = this.s.enemies.filter(e => e.hp > 0 && distance(enemy, e) <= info.dischargeRadius && this.s.time >= e.shockReady).sort((a, b) => distance(enemy, a) - distance(enemy, b)).slice(0, info.maxTargets);
    for (const target of targets) { target.shockReady = this.s.time + info.targetCooldown; this.hitEnemy(target, info.dischargeDamage * this.statusPower, { color: '#ffe086' }); this.effect('spark', target.x, target.y, '#ffe086', 0.55, 0.7, { look: 'zap' }); }
  }
  /** 렌치 조율 (a ringing body rings a layer more, once a second) and 물튀김 (a soaked body splashes the ones beside it). */
  wrenchOnSoundWater(enemy) {
    this.ringFilms(enemy);
    if (enemy.hp <= 0) return;
    const tune = this.trait('wrenchTune'), splash = this.trait('splashBack'), t = this.s.time;
    if (tune && this.resonanceOf(enemy) && t >= (enemy.tuneReady || 0)) { enemy.tuneReady = t + tune.lock; this.applyStatus(enemy, 'sound', { id: this.id('tune'), staggerUsed: {}, fusion: false }, tune.stacks); }
    if (splash && this.wet(enemy)) {
      const drops = { id: this.id('splash'), staggerUsed: {}, fusion: false };
      for (const e of this.s.enemies) if (e !== enemy && e.hp > 0 && distance(enemy, e) <= splash.radius + e.radius) this.applyStatus(e, 'water', drops);
      this.effect('ring', enemy.x, enemy.y, '#3f9fb5', 0.35, 0.6, { look: 'splash', angle: Math.atan2(enemy.y - this.p.y, enemy.x - this.p.x) }); this.sense({ kind: 'splash' });
    }
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
      // The painted arc (art/fx/wrench-arc) runs 0.32 s whatever the blow's own time; the 360 spin keeps its drawn shape.
      if (!a.shown) { this.effect('swing', this.p.x, this.p.y, '#fff5d9', arc < 360 ? Math.max(info.active + 0.08, WRENCH_ARC_SECONDS) : info.active + 0.08, range, { angle: a.angle, phase: a.phase, arc }); a.shown = true; }
      this.breakSwing(a, range);
      if (!a.hazardsStruck) { a.hazardsStruck = true; this.strikeHazards(a.angle, range, arc); }
      for (const enemy of this.s.enemies) if (enemy.hp > 0 && !a.hit.includes(enemy.id) && inCone(this.p, enemy, a.angle, range, arc)) {
        a.hit.push(enemy.id); const hit = this.hitEnemy(enemy, info.damage * (a.empowered ? 1 + this.wrenchMod('dashStrike').damageBonus : 1), { basic: true, stagger: this.c.balance.basicStagger[a.phase] }); this.punch(enemy, a, hit);
        if (enemy.statuses.shock > this.s.time && this.trait('staticCharge')) { this.addEnergy(this.trait('staticCharge').energy); this.effect('spark', this.p.x, this.p.y, '#ffe086', 0.6, 1, { look: 'ready', follow: true }); }
        this.triggerShock(enemy);
        this.wrenchOnSoundWater(enemy);
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
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && floorDistance(this.p, enemy) <= mod.radius) this.hitEnemy(enemy, mod.damage, { basic: true });
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
  get cooldownFactor() { return 1 - this.cooldownReduction; }
  get skillSlots() { return this.slots.flatMap(slot => this.c.skills.filter(s => s.element === slot.element).map(skill => ({ skill, slot }))); }
  castSkill(index, target) {
    const entry = this.skillSlots[index];
    if (!entry || !this.active || this.p.dodge || this.stunned || this.busyCasting || this.s.casts.some(c => c.shape === 'dash')) return false;
    if (this.isConfiscated(index)) { if (this.s.time >= (this.p.confiscateNote || 0)) { this.p.confiscateNote = this.s.time + 1.5; this.notify('로코가 가져간 기술입니다. 로코의 등을 치면 되찾습니다.'); } return false; }
    const recast = entry.skill.id === 'pressureDash' && this.s.time < (this.p.dashRecastUntil || 0), ready = (this.p.cooldowns[entry.skill.id] || 0) <= this.s.time;
    // Skills spend charge built by the wrench, so they wait for the moment that earns them.
    const cost = entry.skill.energyCost || 0;
    if (!recast && (!ready || this.p.energy < cost)) return false;
    const behavior = this.config.skillBehavior[entry.skill.id];
    if (recast) this.p.dashRecastUntil = 0;
    else {
      this.p.energy -= cost;
      // A held skill that charges (굉음) starts its wait when it is let go (updateCharge).
      if (!behavior.charge) this.p.cooldowns[entry.skill.id] = this.s.time + entry.skill.cooldown * this.cooldownFactor;
      const dash = this.skillMod('doubleDash');
      if (dash && entry.skill.id === dash.skill) this.p.dashRecastUntil = this.s.time + dash.window;
    }
    this.sense({ kind: 'cast', id: entry.skill.id });
    if (behavior.charge) { this.p.charging = { index, skillId: entry.skill.id, slot: { ...entry.slot }, started: this.s.time }; this.updateCharge(); return true; }
    this.makeCast(entry.skill, behavior, entry.slot, target, false, { index }); return true;
  }
  /** F2 is gathering a charge or spraying a held stream: no other skill or fusion until it ends. */
  get busyCasting() { return !!this.p.charging || this.s.casts.some(c => c.shape === 'jet') || this.fusionBusy(); }
  /** How long a charged skill gathers and how fast the feet go meanwhile (짧은 숨 shortens it and keeps full speed). */
  chargeRule(skillId) {
    const behavior = this.config.skillBehavior[skillId], quick = skillId === 'roar' && this.skillMod('shortBreath');
    return quick ? { charge: quick.charge, chargeMove: 1 } : { charge: behavior.charge, chargeMove: behavior.chargeMove ?? 1 };
  }
  /** How fast the feet go while a held skill runs (굉음 charging, 고압 분사 spraying). */
  get castFeet() {
    if (this.p.charging) return this.chargeRule(this.p.charging.skillId).chargeMove;
    const jet = this.s.casts.find(c => c.shape === 'jet');
    return jet ? jet.move ?? 1 : 1;
  }
  /**
   * 굉음 while its button is held: up to `charge` seconds of gathering, then it fires on its own; letting go fires it at
   * the strength gathered so far. A dodge drops the charge, and the wait is half.
   */
  updateCharge() {
    const charge = this.p.charging;
    if (!charge) return;
    const skill = this.c.skills.find(s => s.id === charge.skillId), behavior = this.config.skillBehavior[charge.skillId], wait = skill.cooldown * this.cooldownFactor, rule = this.chargeRule(charge.skillId);
    if (this.p.dodge || !this.active) {
      this.p.charging = null; this.p.cooldowns[skill.id] = this.s.time + wait / 2;
      this.effect('ring', this.p.x, this.p.y, '#d2bf96', 0.3, 0.8);
      return;
    }
    const age = this.s.time - charge.started;
    if (this.p.skillHeld?.includes(charge.index) && age < rule.charge) return;
    this.p.charging = null; this.p.cooldowns[skill.id] = this.s.time + wait;
    this.sense({ kind: 'cast', id: `${skill.id}Release` });
    // 최대 음량: a full charge lays two layers of resonance instead of one.
    const power = Math.min(1, age / rule.charge), loud = power >= 1 && this.skillMod('fullVolume');
    this.makeCast(skill, behavior, charge.slot, this.p, false, { index: charge.index, power, resonanceStacks: loud ? loud.stacks : undefined });
  }
  castFusion(target) {
    const fusion = this.fusion;
    if (!fusion || !this.active || this.p.dodge || this.stunned || this.busyCasting || this.p.fusionReady > this.s.time || this.p.energy < fusion.energyCost || this.s.casts.some(c => c.shape === 'dash')) return false;
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
      // Sound and water.
      if (mod.id === 'echoPalm') cast.echo = mod;
      if (mod.id === 'burstShot') cast.burst = mod;
      if (mod.id === 'wallSlam') { cast.knockback = mod.knockback; cast.wallDaze = mod.daze; }
      // 넓은 노즐: a broader stream (it already strikes every body on its line).
      if (mod.id === 'wideNozzle') cast.halfWidth = mod.halfWidth;
      if (mod.id === 'puddle') cast.puddle = mod;
    }
  }
  /** `extra.index`: the skill button that cast it (a held stream watches it); `extra.power`: 0 to 1 of a charge gathered. */
  makeCast(skill, behavior, slot, target = this.p, fusion, extra = {}) {
    const range = skill.range || behavior.range || skill.radius || 1;
    const d = Math.min(range, distance(this.p, target));
    const angle = ['orb','clamp'].includes(behavior.shape) ? Math.atan2(target.y-this.p.y,target.x-this.p.x) : this.p.angle, elements = fusion ? skill.pair : [skill.element];
    const cast = { id: this.id('cast'), skillId: skill.id, fusion, slot: { ...slot }, ...behavior, radius: skill.radius, range, angle, x: this.p.x + Math.cos(angle) * d, y: this.p.y + Math.sin(angle) * d, startX: this.p.x, startY: this.p.y, age: 0, pulse: 0, next: behavior.delay, hits: skill.hits, damage: skill.damagePerHit, finisher: skill.finisherDamage || 0, secondaryDamage: skill.secondaryDamage || 0, secondaryTargets: skill.secondaryTargets || 0, elements, staggerUsed: {}, hit: [], projectiles: [], statusAt: {}, color: this.config.presentation.colors[elements[0]] };
    // Sound: how many layers of resonance a blow lays on, and how much harder it lands on a body already ringing.
    Object.assign(cast, { resonanceStacks: skill.resonanceStacks || 1, resonantStacks: skill.resonantStacks || 0, resonantMultiplier: skill.resonantMultiplier || 0, index: extra.index });
    if (extra.resonanceStacks) cast.resonanceStacks = extra.resonanceStacks;
    // A charged skill lands between its least and its full blow by how long it was gathered.
    if (skill.minDamage !== undefined) { cast.power = extra.power ?? 1; cast.damage = skill.minDamage + (skill.damagePerHit - skill.minDamage) * cast.power; }
    this.applySkillMods(cast);
    const bounds = this.bounds;
    cast.x = clamp(cast.x, bounds.left, bounds.right); cast.y = clamp(cast.y, bounds.top, bounds.bottom);
    if (['self', 'moving', 'cone', 'dash', 'crosscut', 'crescent', 'beam', 'jet'].includes(cast.shape)) { cast.x = this.p.x; cast.y = this.p.y; }
    if (cast.shape === 'crescent') cast.travel = cast.startDistance || 0;
    if (cast.shape === 'moving' && cast.startDistance) this.move(cast, Math.cos(angle)*cast.startDistance, Math.sin(angle)*cast.startDistance, .2);
    if (['target', 'orb'].includes(cast.shape) && behavior.delay > 0) this.effect('friendlyTell', cast.x, cast.y, cast.color, behavior.delay, cast.radius, { skill: cast.skillId, mark: floorMark(cast.elements) });
    if (cast.shape === 'projectile') {
      for (let i = 0; i < skill.hits; i++) cast.projectiles.push({ x: this.p.x, y: this.p.y, angle: angle + (i - (skill.hits - 1) / 2) * behavior.spread, travelled: 0, done: false });
    }
    this.setupSoundWaterFusion(cast);
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
    // 울림 손바닥 lands harder on a body already ringing, and lays on more.
    const ringing = this.resonanceOf(enemy);
    if (ringing && cast.resonantMultiplier) damage *= cast.resonantMultiplier;
    const hit = this.hitEnemy(enemy, damage, { slot: cast.slot, color: cast.color, source: cast.fusion ? 'fusion' : 'skill' });
    enemy.joltUntil = this.s.time + JOLT_SECONDS;
    // 조율 박자: striking a ringing body with the palm gives back part of its wait, once a cast.
    const beat = ringing && cast.skillId === 'ringPalm' && !cast.derived && !cast.tuned && this.skillMod('tuningBeat');
    if (beat) { cast.tuned = true; this.p.cooldowns.ringPalm = Math.max(this.s.time, (this.p.cooldowns.ringPalm || 0) - beat.cooldownRefund); }
    // A cast that lands many times is felt once, on its first contact.
    if (!cast.felt) { cast.felt = true; this.sense({ kind: cast.fusion ? 'fusion' : 'skill', crit: hit.crit }); }
    // A sound blow on a body at full resonance collapses it (and lays no new layer: the ringing starts over).
    const collapse = cast.elements.includes('sound') && ringing >= (this.status('resonance')?.maxStacks ?? Infinity);
    if (collapse) this.collapseResonance(enemy);
    const order = cast.elements.includes('water') ? ['water', ...cast.elements.filter(e => e !== 'water')] : cast.elements;
    if (enemy.hp > 0) for (const element of order) if (!(collapse && element === 'sound')) this.applyStatus(enemy, element, cast, element === 'sound' ? (ringing && cast.resonantStacks) || cast.resonanceStacks || 1 : 1);
    // 수면 공명: a sound blow on a body standing on the film makes the film ring (the film's own ringing does not).
    if (cast.elements.includes('sound') && cast.shape !== 'film') this.ringFilms(enemy);
    if (cast.overload && enemy.burnStacks.some(t => t > this.s.time)) { this.p.cooldowns[cast.skillId] = Math.max(0, (this.p.cooldowns[cast.skillId] || 0) - cast.overload); cast.overload = 0; }
    this.castStagger(enemy, cast.fusion ? this.c.balance.fusionStaggerPerCastCap : this.c.balance.skillStaggerPerCastCap, cast);
    // Wind throws enemies about: one shoved against a crate sets it off.
    if (cast.elements.includes('wind')) { const reach = this.config.hazards?.elements?.shoveCrateReach || 1; for (const h of this.s.hazards || []) if (h.kind === 'crate' && !h.gone && distance(h, enemy) <= reach) this.lightCrate(h, 0.3); }
  }
  /**
   * Resonance collapse: the ringing body bursts for a set blow, its elite shield and coating come off, crates beside it go
   * off, and the ring passes one layer to the bodies round it. One brought to full resonance by that bursts in turn.
   */
  collapseResonance(enemy, chain = new Set()) {
    const info = this.status('resonance'), reach = info.spreadRadius, passes = info.spreadStacks;
    chain.add(enemy.id); enemy.resonanceStacks = 0; enemy.statuses.resonance = 0;
    this.hitEnemy(enemy, info.collapseDamage * this.statusPower, { dot: true, color: '#ffe6a8' });
    if (enemy.shieldHits !== undefined) { enemy.frontGuard = 0; enemy.shieldHits = undefined; enemy.shieldBroken = true; this.effect('scrap', enemy.x, enemy.y - enemy.radius, '#ffbe20', 0.5, 0.8); }
    if (enemy.immuneTo || enemy.coatedUntil > this.s.time) { enemy.immuneTo = null; enemy.coatedUntil = 0; this.effect('scrap', enemy.x, enemy.y - enemy.radius, '#9fd3e6', 0.5, 0.8); }
    this.effect('ring', enemy.x, enemy.y, '#ffe6a8', 0.5, reach + 0.4, { look: 'resonanceBurst' });
    this.sense({ kind: 'resonance' });
    for (const h of this.s.hazards || []) if (h.kind === 'crate' && !h.gone && distance(h, enemy) <= info.spreadRadius) this.lightCrate(h, 0.05);
    const ring = { id: this.id('collapse'), staggerUsed: {}, fusion: false, statusAt: {} };
    for (const other of this.s.enemies) {
      if (other.hp <= 0 || chain.has(other.id) || floorDistance(enemy, other) > reach + other.radius) continue;
      this.applyStatus(other, 'sound', ring, passes);
      if (this.resonanceOf(other) >= info.maxStacks) this.collapseResonance(other, chain);
    }
  }
  /** How far a straight line from `from` runs before a wall stops it (up to `range`), and whether a wall did. */
  lineReach(from, angle, range) {
    const map = this.map, b = this.bounds, cos = Math.cos(angle), sin = Math.sin(angle);
    if (map?.walkable && !fitsMap(from.x, from.y, 0.05, map)) return { reach: range, wall: false };
    for (let d = 0.25; d <= range + 1e-7; d += 0.25) {
      const x = from.x + cos * d, y = from.y + sin * d;
      if (map?.walkable ? !fitsMap(x, y, 0.05, map) : x < b.left || x > b.right || y < b.top || y > b.bottom) return { reach: d - 0.25, wall: true };
    }
    return { reach: range, wall: false };
  }
  /**
   * A skill reaching a room hazard (`touches(h)` says which): fire sets a crate off at once, ice cools a plate for a few
   * seconds, lightning runs along a saw rail and shocks whatever stands on it.
   */
  elementOnHazards(cast, touches) {
    this.elementOnPatches(cast, touches);
    const list = this.s.hazards, rules = this.config.hazards?.elements;
    if (!list?.length || !rules) return;
    const t = this.s.time;
    for (const h of list) {
      // A crane is overhead: what a skill touches is its mark on the floor (checked below), not the crane.
      if (h.gone || (h.kind !== 'crane' && !touches(h))) continue;
      if (h.kind === 'crate' && cast.elements.includes('fire')) this.lightCrate(h, 0.05);
      if (h.kind === 'plate' && cast.elements.includes('ice') && !(h.cooledUntil > t)) { h.cooledUntil = t + rules.frostSeconds; this.effect('ring', h.x, h.y, '#9fe3f0', 0.6, h.half, { look: 'frostShatter' }); }
      // A belt: ice stops it, wind makes it run twice as fast for a moment.
      const belt = this.config.hazards.belt;
      if (h.kind === 'belt' && belt && cast.elements.includes('ice') && !(h.frozenUntil > t)) { h.frozenUntil = t + belt.frostSeconds; this.effect('ring', h.x, h.y, '#9fe3f0', 0.6, Math.max(h.w, h.h) / 2, { look: 'frostShatter' }); }
      if (h.kind === 'belt' && belt && cast.elements.includes('wind')) h.windUntil = t + belt.windSeconds;
      // The other factory devices (slice.json hazards.press / laser / steam / crane notes).
      const { press, laser, steam, crane } = this.config.hazards, has = element => cast.elements.includes(element);
      if (h.kind === 'press' && press) {
        const now = pressState(h, t, press);
        if ((has('lightning') || has('sound')) && now.state !== 'slam') slamNow(h, t, press);
        else if (has('ice') && h.skipN === undefined) { h.skipN = now.state === 'slam' ? now.n + 1 : now.n; this.effect('ring', h.x, h.y, '#9fe3f0', 0.6, h.w / 2, { look: 'frostShatter' }); }
      }
      if (h.kind === 'laser' && laser && !(h.downUntil > t)) {
        const off = has('lightning') || has('water') ? laser.shortSeconds : has('sound') ? laser.soundSeconds : 0;
        if (off) { h.downUntil = t + off; this.effect('spark', h.x, h.y - 0.5, '#ffe086', 0.4, 1, { look: 'zap' }); }
      }
      if (h.kind === 'steam' && steam) {
        if (has('fire')) h.hotUntil = t + steam.fireSeconds;
        if (has('ice') && !(h.frozenUntil > t)) { h.frozenUntil = t + steam.frostSeconds; this.effect('ring', h.x, h.y, '#9fe3f0', 0.6, steam.radius, { look: 'frostShatter' }); }
        if (has('water')) h.wetUntil = t + steam.idle + steam.warn + steam.burst;
        if (has('wind')) { const a = cast.angle ?? Math.atan2(h.y - this.p.y, h.x - this.p.x); h.driftX = Math.cos(a) * steam.windShift; h.driftY = Math.sin(a) * steam.windShift * FLOOR_FLAT; h.driftUntil = t + steam.windSeconds; }
      }
      if (h.kind === 'crane' && crane && h.mark && touches({ ...h, x: h.mark.x, y: h.mark.y })) {
        if (has('wind') && !h.mark.blown) { const a = cast.angle ?? Math.atan2(h.mark.y - this.p.y, h.mark.x - this.p.x), x = h.mark.x + Math.cos(a) * crane.windShift, y = h.mark.y + Math.sin(a) * crane.windShift * FLOOR_FLAT; if (!this.map?.walkable || fitsMap(x, y, 0.5, this.map)) Object.assign(h.mark, { x, y, blown: true }); }
        if (has('lightning') && !h.mark.shocked) { h.mark.at += crane.shockDelay; h.mark.shocked = true; }
      }
      if (h.kind === 'rail' && cast.elements.includes('lightning') && !(h.chargedUntil > t + 0.5)) { h.chargedUntil = t + rules.chargeSeconds; h.chargeNext = t; this.effect('beam', h.x - h.dx, h.y - h.dy, '#ffe086', 0.5, 1, { targetX: h.x + h.dx, targetY: h.y + h.dy, look: 'zapLine' }); }
    }
  }
  updateCasts(dt) {
    for (const cast of this.s.casts) {
      cast.age += dt;
      // The nine sound and water fusions run in sound-water-fusions.js.
      if (this.updateSoundWaterFusion(cast, dt)) continue;
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
            // 물대포 shoves ordinary bodies along its path.
            if (cast.knockback && !target.boss && !target.dummy && !target.stationary && target.hp > 0) {
              const from = { x: target.x, y: target.y };
              this.move(target, Math.cos(bullet.angle) * cast.knockback, Math.sin(bullet.angle) * cast.knockback);
              // 벽치기 물살: a body the water slams against a wall is dazed for a moment.
              if (cast.wallDaze && distance(from, target) < cast.knockback * 0.6) { target.stunUntil = Math.max(target.stunUntil, this.s.time + cast.wallDaze); target.dazedUntil = this.s.time + cast.wallDaze; target.dazedBonus = 0; this.effect('ring', target.x, target.y, '#ffd257', 0.4, 0.8, { look: 'quake' }); }
            }
            if (cast.skillId === 'frostBolt' && !bullet.shard) this.effect('ring', target.x, target.y, cast.color, 0.8, 0.5, { look: 'frostShatter' });
            if (cast.pierce) (bullet.pierced ??= []).push(target.id); else bullet.done = true;
            if (cast.shards && !bullet.shard) for (let i = 0; i < cast.shards.shards; i++) cast.projectiles.push({ x: target.x, y: target.y, angle: bullet.angle + (i - (cast.shards.shards - 1) / 2) * 0.9, travelled: 0, done: false, shard: true, share: cast.shards.damageShare, reach: cast.shards.range, pierced: [target.id] });
          }
          if (distance(before, bullet) < step * 0.5 || bullet.travelled >= (bullet.reach || cast.range)) {
            bullet.done = true;
            // 물폭탄: the shot bursts where it ends, soaking everything round it.
            if (cast.burst && !bullet.burst) {
              bullet.burst = true;
              for (const e of this.s.enemies) if (e.hp > 0 && floorDistance(bullet, e) <= cast.burst.radius + e.radius) this.castHit(cast, e, cast.damage * cast.burst.damageShare);
              this.effect('ring', bullet.x, bullet.y, cast.color, 0.5, cast.burst.radius, { look: 'splash', angle: bullet.angle + Math.PI }); this.sense({ kind: 'splash' });
            }
          }
        }
        cast.done = cast.projectiles.every(p => p.done); continue;
      }
      // 굉음: a straight column of sound out to its range, through every body on it, at once.
      if (cast.shape === 'beam') {
        const fx = Math.cos(cast.angle), fy = Math.sin(cast.angle);
        const on = t => { const dx = t.x - cast.startX, dy = t.y - cast.startY, along = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx), r = t.radius || 0.4; return along >= -r && along <= cast.range + r && side <= cast.halfWidth + r; };
        this.elementOnHazards(cast, on);
        for (const enemy of this.s.enemies) if (enemy.hp > 0 && on(enemy)) this.castHit(cast, enemy);
        this.effect('soundBeam', cast.startX, cast.startY, cast.color, 0.45, cast.range, { angle: cast.angle, power: cast.power ?? 1, halfWidth: cast.halfWidth });
        cast.done = true; continue;
      }
      // 고압 분사: a stream from F2 that swings after the aim; every beat it strikes every body on its line, or a wall.
      if (cast.shape === 'jet') {
        const p = this.p, turn = cast.turnRate * dt;
        cast.angle += clamp(angleDiff(p.angle, cast.angle), -turn, turn); cast.x = p.x; cast.y = p.y;
        const { reach, wall } = this.lineReach(p, cast.angle, cast.range), end = { x: p.x + Math.cos(cast.angle) * reach, y: p.y + Math.sin(cast.angle) * reach };
        const onLine = this.s.enemies.filter(e => e.hp > 0 && !(e.summonUntil > this.s.time) && segmentDistance(e, p, end) <= e.radius + cast.halfWidth).sort((a, b) => distance(p, a) - distance(p, b));
        // 넓은 노즐: the stream runs on through every body on its line instead of stopping at the first.
        const first = cast.wide ? null : onLine[0], struck = cast.wide ? onLine : onLine.slice(0, 1);
        // Where the stream ends this frame (the renderer draws it to here).
        Object.assign(cast, first ? { endX: first.x, endY: first.y, wall: false } : { endX: end.x, endY: end.y, wall });
        while (cast.pulse < cast.hits && cast.age + 1e-7 >= cast.next) {
          this.elementOnHazards(cast, h => segmentDistance(h, p, { x: cast.endX, y: cast.endY }) <= cast.halfWidth + 0.6);
          for (const e of struck) { this.castHit(cast, e, cast.damage * (cast.wide || 1)); this.effect('ring', e.x, e.y, cast.color, 0.3, 0.5, { look: 'splash', angle: cast.angle }); }
          if (struck.length) this.sense({ kind: 'splash' });
          if (!first && wall) this.effect('ring', cast.endX, cast.endY, cast.color, 0.35, 0.7, { look: 'splash', angle: cast.angle + Math.PI });
          // 물웅덩이: where the stream lands, a puddle stays on the floor (a new one each time the spot moves on).
          if (cast.puddle && (!cast.lastPuddle || distance(cast.lastPuddle, { x: cast.endX, y: cast.endY }) >= cast.puddle.spacing)) {
            cast.lastPuddle = { x: cast.endX, y: cast.endY };
            this.addPatch({ look: 'puddle', x: cast.endX, y: cast.endY, radius: cast.puddle.radius, duration: cast.puddle.duration, slow: cast.puddle.slow, slowsEnemies: true, friendly: true, soaks: true });
          }
          cast.pulse++; cast.next += cast.interval;
        }
        const held = p.skillHeld?.includes(cast.index);
        if (cast.pulse >= cast.hits || cast.age >= cast.duration || (cast.age >= cast.minDuration && !held)) { cast.done = true; this.sense({ kind: 'castEnd', id: cast.skillId }); }
        continue;
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
        if (cast.age + 1e-7 >= (cast.trailNext ?? 0)) { cast.trailNext = cast.age + 0.05; this.effect('dodge', this.p.x, this.p.y, '#badbd3', 0.4, 1, { look: 'gust', angle: cast.angle }); }
        cast.done = cast.age >= cast.duration;
        if (cast.done && cast.pierceDash) for (const id of cast.hit) { const e = this.s.enemies.find(x => x.id === id && x.hp > 0 && !x.boss); if (e) this.effect('dodge', e.x, e.y, '#badbd3', 0.45, 1, { look: 'gust', angle: cast.angle + Math.PI }); if (e) this.move(e, -Math.cos(cast.angle) * cast.pierceDash.pull * 2, -Math.sin(cast.angle) * cast.pierceDash.pull * 2); }
        continue;
      }
      if (cast.leaveBehind) { if (cast.age + 1e-7 >= cast.next) { cast.x = cast.trailX ?? cast.startX; cast.y = cast.trailY ?? cast.startY; cast.trailX = this.p.x; cast.trailY = this.p.y; } }
      else if (cast.shape === 'self' || cast.shape === 'cone') { cast.x = this.p.x; cast.y = this.p.y; }
      if (cast.follow) { const target = this.s.enemies.find(e => e.id === cast.follow && e.hp > 0); if (target) { cast.x = target.x; cast.y = target.y; } }
      if (cast.shape === 'moving') this.move(cast, Math.cos(cast.angle) * cast.speed * dt, Math.sin(cast.angle) * cast.speed * dt, 0.2);
      if (cast.drift) this.move(cast, Math.cos(cast.angle) * cast.drift * dt, Math.sin(cast.angle) * cast.drift * dt, 0.2);
      if (cast.pull) for (const enemy of this.s.enemies) if (!enemy.boss && enemy.hp > 0 && floorDistance(cast, enemy) < cast.radius) { const a = Math.atan2(cast.y - enemy.y, cast.x - enemy.x); this.move(enemy, Math.cos(a) * cast.pull * dt, Math.sin(a) * cast.pull * dt); }
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
          this.elementOnHazards(cast, h => cast.shape === 'cone' ? inCone(cast, h, cast.angle, cast.range, cast.arc) : floorDistance(cast, h) <= cast.radius + 0.6);
          for (const enemy of this.s.enemies) if (enemy.hp > 0 && (cast.shape === 'cone' ? inCone(cast, enemy, cast.angle, cast.range, cast.arc) : floorDistance(cast, enemy) <= cast.radius + enemy.radius)) { this.castHit(cast, enemy); if (cast.shape === 'cone' && cast.knockback && !enemy.boss && !enemy.dummy && !enemy.stationary && enemy.hp > 0) { const a = Math.atan2(enemy.y - this.p.y, enemy.x - this.p.x); this.move(enemy, Math.cos(a) * cast.knockback, Math.sin(a) * cast.knockback); } if(cast.shape==='orb' && cast.knockback && !enemy.boss){const a=Math.atan2(enemy.y-cast.y,enemy.x-cast.x);this.move(enemy,Math.cos(a)*cast.knockback,Math.sin(a)*cast.knockback);} }
          // The last blast pushes after it lands (it used to push first, so the bodies it threw were out of its reach: 역류 cost damage).
          if (cast.finalKnockback && cast.pulse === cast.hits - 1) for (const enemy of this.s.enemies) if (enemy.hp > 0 && !enemy.boss && !enemy.stationary && floorDistance(cast, enemy) <= cast.radius + enemy.radius) { const a = Math.atan2(enemy.y - cast.y, enemy.x - cast.x); this.move(enemy, Math.cos(a) * cast.finalKnockback, Math.sin(a) * cast.finalKnockback); }
          const look = cast.skillId === 'heatSwing' ? 'heatSwing' : cast.skillId === 'ringPalm' ? 'ringPalm' : cast.shape === 'charge' ? 'zapBig' : cast.finalKnockback && cast.pulse === cast.hits - 1 ? 'quake' : undefined;
          this.effect(cast.shape === 'cone' ? 'swing' : 'ring', cast.x, cast.y, cast.color, look ? 0.7 : Math.max(0.18, cast.interval), cast.shape === 'cone' ? cast.range : cast.radius, { angle: cast.angle, phase: 1, arc: cast.arc, look, skill: cast.skillId });
        }
        // 되울림: the palm's ring comes back once more a moment later, weaker.
        if (cast.echo && !cast.derived && cast.pulse === 0) this.s.casts.push({ ...cast, id: this.id('cast'), derived: true, echo: null, age: 0, pulse: 0, next: cast.echo.delay, hits: 1, damage: cast.damage * cast.echo.damageShare, knockback: 0, resonanceStacks: 1, resonantStacks: 0, resonantMultiplier: 0, felt: true, staggerUsed: {}, hit: [], statusAt: {} });
        cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= cast.hits && cast.age >= cast.next) {
        if (cast.finisher) for (const enemy of this.s.enemies) if (enemy.hp > 0 && floorDistance(cast, enemy) <= cast.radius + enemy.radius) { this.castHit(cast, enemy, cast.finisher); if (cast.skillId === 'coolingField') this.effect('ring', enemy.x, enemy.y, cast.color, 0.8, 0.5, { look: 'frostShatter' }); }
        cast.done = true;
      }
    }
    this.s.casts = this.s.casts.filter(c => !c.done);
  }
  /** What a blow of `amount` takes off F2 after armour and perks (a reflected bullet carries this same number). */
  damageTaken(amount) { return amount * (1 - (this.stats.damageReduction || 0)) * (1 + (this.perk('overheatEngine')?.damageTaken || 0)); }
  hurt(amount) {
    // The F9 debug panel's god mode (this computer's dev server only; never saved): nothing lands on F2.
    if (this.godMode) return false;
    if (!this.active || this.s.time + 1e-7 < this.p.invulnerableUntil) return false;
    // The first lesson in the scrapyard teaches the dodge: a hit still flashes and stuns, but costs no health.
    amount = this.s.mode === 'intro' ? 0 : this.damageTaken(amount);
    // A lens inspector's mark: the next blow F2 takes hurts more, once.
    if (this.p.markedUntil > this.s.time) { amount *= 1 + (this.config.enemies.lensInspector?.markBonus || 0); this.p.markedUntil = 0; }
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
      // A spare spring from Nasa catches F2 once: back up at a share of full health, a moment out of harm's way.
      else if (this.s.run && this.potion?.revive && !this.s.run.potionSpent) {
        this.s.run.potionSpent = true; this.p.hp = Math.max(1, Math.round(this.p.maxHp * this.potion.revive)); this.p.invulnerableUntil = this.s.time + 1.5;
        this.effect('ring', this.p.x, this.p.y, '#ffd257', 0.6, 2, { look: 'shieldBreak' }); this.notify('예비 태엽이 돌아갑니다! 다시 일어났습니다.');
      }
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
  /**
   * In a boss room the fight ends with the boss: once every boss body is down, the helpers and summons still standing
   * fall with it and no more waves come (2026-11-08: a beaten Iris left the room shut while lens inspectors stood).
   */
  bossFallsAll() {
    const { enemies, run } = this.s, bosses = enemies.filter(e => e.boss);
    if (!this.active || !run || !bosses.length || bosses.some(e => e.hp > 0)) return;
    for (const e of enemies) if (e.hp > 0) { e.hp = 0; e.tell = null; this.effect('spark', e.x, e.y - 0.6, '#e8e2d2', 0.4, 1); }
    run.arrivals = []; if (this.room?.waves) run.wave = this.room.waves.length - 1;
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
    // Skill buttons held down right now (a charge and a stream run while theirs is held).
    p.skillHeld = input.skillHeld || [];
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
      const speed = this.c.player.speed * (1 + (this.stats.moveSpeed || 0)) * (stuck ? 1 - stuck.slow : 1) * (1 - this.patchSlow(p)) * this.castFeet;
      // On an oil slick F2 keeps sliding the way she was going and turns slowly (factory-mobs.js).
      const oil = this.patchUnder(p, 'oil'), slick = oil?.slide && !(oil.frozenUntil > this.s.time);
      let vx = dx * speed, vy = dy * speed;
      if (slick) { const k = Math.min(1, dt * 2.5); p.slideX = (p.slideX || 0) + (vx - (p.slideX || 0)) * k; p.slideY = (p.slideY || 0) + (vy - (p.slideY || 0)) * k; vx = p.slideX; vy = p.slideY; } else { p.slideX = vx; p.slideY = vy; }
      // Held by a mould (director Press) or a grabber, F2 cannot walk for a moment.
      if (!p.grabbed && !(p.heldUntil > this.s.time)) this.move(p, vx * dt, vy * dt);
    }
    if (held.basic > now && this.basicAttack()) held.basic = 0;
    if (held.skill?.until > now && this.castSkill(held.skill.index, input.aim)) held.skill = null;
    if (held.fusion > now && this.castFusion(input.aim)) held.fusion = 0;
    this.updateCharge();
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
    this.tickPatches(dt); this.tickGrab();
    if (!this.active) return;
    const hostile = this.s.casts.filter(c => HOSTILE_SHAPES.includes(c.shape) && !c.done);
    this.s.casts = this.s.casts.filter(c => !HOSTILE_SHAPES.includes(c.shape));
    this.updateCasts(dt); this.s.casts.push(...hostile);
    this.updateEnemies(dt);
    if (!this.active) return;
    this.updateProjectiles(dt);
    if (!this.active) return;
    this.s.effects = this.s.effects.filter(e => e.until > this.s.time);
    this.s.notices = this.s.notices.filter(e => e.until > this.s.time);
    this.tutorial.tick(); this.tickPractice(); this.tickWaves(); this.tickBlasts(); this.tickHazards(dt);
    this.bossFallsAll();
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
      // Each boss leaves a record behind: Brass his patrol plan, Iris F2's own assembly record, Press the factory's first drawing.
      const record = { captainBrass: 'patrolBlueprint', inspectorIris: 'assemblyRecord', directorPress: 'selfTuningBlueprint' }[boss];
      if (record) this.s.profile.blueprints.push(record);
    }
    // The last boss of the slice ends the run here: the story takes over instead of a reward pick.
    if (this.s.run.node === this.rooms.length - 1) this.finishChapter();
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
    this.s.result = { reason, chapter: this.chapter.id, difficulty: run.difficulty || 'normal', node: run.node + 1, elapsed: run.elapsed, baseGears: run.baseGears, bonus, seed: run.seed, damageTaken: run.damageTaken, elements: run.slots.map(s => s.element) };
    profile.history.unshift(this.s.result); profile.history = profile.history.slice(0, 10);
    noteRecord(chapterRecords(profile, this.chapter.id), this.s.result);
    this.report('runEnd', { run: run.id, difficulty: run.difficulty || 'normal', chapter: this.chapter.id, elements: this.s.result.elements, reason: ['clear', 'defeat'].includes(reason) ? reason : 'abandon', node: this.s.result.node, seconds: Math.round(run.elapsed) });
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
Object.assign(Game.prototype, enemyActions, roomWaves, factoryMobs, factoryBosses, rewardDraws, soundWaterFusions);
