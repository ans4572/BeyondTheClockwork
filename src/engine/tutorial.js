import { pointInPolygon } from './map-geometry.js';

export const HITS_TO_LEARN = 3;
const MARKER_REACH_UNITS = 1, RISE_INVULNERABLE_SECONDS = 1.5, FIGHT_MIN_HP = 30, UNHELD_DELAY_SECONDS = 0.5;
// The player gets a moment to see the town stop before anyone speaks.
const BELL_BEAT_SECONDS = 0.9, MEET_MORU_UNITS = 3;

/** The scrapyard lesson, then the first walk through town: each step ends when the player has done the thing, not when they have read about it. */
export class Tutorial {
  constructor(game) { this.game = game; }
  get state() { return this.game.s.tutorial; }
  get step() { return this.state?.step || null; }
  /** Where the player should head, or null when the lesson is about something else. */
  get goal() {
    const { map } = this.game;
    if (this.step === 'moru') return this.game.hubMap.arrival.meet;
    return this.step === 'walk' ? map.marker : this.step === 'door' ? { x: map.exit.at[0], y: map.exit.at[1] } : null;
  }
  /** While the lesson needs the guard, a blow can hurt it but cannot finish it. */
  get guardSurvives() { return ['attack', 'dodge'].includes(this.step); }
  start() { this.game.s.tutorial = { step: 'walk', hits: 0, dodged: false, spoke: false }; }
  /** True once, the moment the player has finished getting up. */
  takeAwakening() {
    const { state, game } = this;
    if (!state || state.spoke || game.wakeProgress !== null) return false;
    return state.spoke = true;
  }
  /** How the town's bell should behave for this step of the first walk. */
  get bell() { return this.step === 'town' ? 'soon' : ['bell', 'moru', 'meet'].includes(this.step) ? 'hold' : null; }
  /** Registration waits for the walk to Moru, unless this save reached it some other way. */
  get readyToRegister() { return this.game.s.mode === 'registration' && !['town', 'bell', 'moru'].includes(this.step); }
  heardBell() { this.state.step = 'bell'; this.state.heardAt = this.game.s.time; }
  /** True once, when the town has stood still long enough for the player to notice. */
  takeCall() {
    if (this.step !== 'bell' || this.game.s.time < this.state.heardAt + BELL_BEAT_SECONDS) return false;
    this.state.step = 'moru'; return true;
  }
  tick() {
    const { game, step } = this, { p } = game;
    if (step === 'moru' && Math.hypot(p.x - game.hubMap.npcs[0].x, p.y - game.hubMap.npcs[0].y) <= MEET_MORU_UNITS) this.state.step = 'meet';
    if (step === 'walk' && Math.hypot(p.x - game.map.marker.x, p.y - game.map.marker.y) <= MARKER_REACH_UNITS) this.dropGuard();
    if (step === 'door' && pointInPolygon(p.x, p.y, game.map.exit.polygon)) game.reachWorkshop();
  }
  dropGuard() {
    const { game } = this, spot = game.map.enemySpawns[0], guard = game.spawnEnemy(game.config.rules.introEnemy, spot);
    guard.held = true;
    game.effect('ring', spot.x, spot.y, '#c79a3e', 0.5, 2);
    this.state.step = 'attack';
  }
  onHit(enemy, basic) {
    if (this.step !== 'attack' || !basic || ++this.state.hits < HITS_TO_LEARN) return;
    enemy.held = false; enemy.ready = this.game.s.time + UNHELD_DELAY_SECONDS;
    if (this.state.dodged) this.startFight(enemy); else this.state.step = 'dodge';
  }
  /** A dodge counts once the player can see what they are dodging. */
  onDodge() {
    if (!this.state) return;
    this.state.dodged = true;
    const guard = this.game.s.enemies[0];
    if (this.step === 'dodge' && guard?.tell) this.startFight(guard);
  }
  startFight(guard) { guard.hp = Math.max(guard.hp, FIGHT_MIN_HP); this.state.step = 'fight'; }
  /** No retry screen: the same step carries on from the start of the yard. */
  rise() {
    const { game } = this, { p, s } = game, guard = s.enemies[0], yard = game.map;
    Object.assign(p, yard.spawn, { hp: p.maxHp, attack: null, dodge: null, invulnerableUntil: s.time + RISE_INVULNERABLE_SECONDS });
    if (guard) Object.assign(guard, yard.enemySpawns[0], { tell: null, dash: null, ready: s.time + RISE_INVULNERABLE_SECONDS });
    game.notify('안전핀 없이도 일어났습니다. 다시 해 보세요.');
  }
  guardBeaten() {
    this.state.step = 'door';
    this.game.notify('문 너머에서 누군가 부릅니다.');
  }
}
