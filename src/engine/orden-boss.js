// Chapter 3's final boss, the grand tuner Orden, in his two fights (docs/design/clock-tower-boss-drafts.md 3-D and 3-E):
// Orden 1 (`orden`, the tuning chamber) and Orden at the last hour (`ordenFinal`, the ruined summit). Mixed into Game;
// factory-bosses.js hands his tells, steps, blows, swings and his break over here (odAI), tickFactoryBoss calls
// tickOrdenBoss each frame. Numbers live in slice.json bossAI.orden / bossAI.ordenFinal.
//
// He fights with magic only (2026-11-19, the user's word: no physical blows). He floats, keeps his distance and raises
// his staff for every spell; the warnings show on the floor before anything lands, as with the other bosses.
//
// Orden 1, phase 1 (round): magic needles (three bolts, the second and third led ahead of F2), runes (a ring of six round
// F2, then the middle and a wider ring), the tuning-needle fence (a ring closing round F2; a wrench on a needle opens its
// quarter), the element lanes (five lanes across the room, one safe, across and then down; fire, ice, lightning and wind
// in turn, each leaving its own after-effect) and the reflecting orbs (struck back with the wrench, they hurt him).
// Half health, the break (E-1, the user's pick): time stops. He lays needles over the dial on his floor as a maze, two hands
// of needles turning through it; only F2 moves, and five pocket watches must be broken before time runs again (each one
// broken buys two seconds).
// Phase 2 (round2): echoes of the earlier bosses in his gold (Brass's march, Press's plates, Belgard's rings) and his
// mirror images (three of him cast at once; only the real one's eye shines, the others' spells do no harm).
// Orden at the last hour: Orden 1's spells made stronger (a fan of needles, three ring waves, a turning fence, two element
// lanes crossing, dark orbs among the bright, four images that swap places, two echoes at a time) and his own: the floor
// falling away, the apparatus's cannon (a long opening after it), the command sigil (stop or move, from 60%) and the last
// hour (twelve tolls; only the gold-marked floor is safe, from 30%).
// Element spells (2026-11-20, the user's pick, all five): the spreading fire (a spark lands where F2 stands and the fire
// runs out over the floor a ring of cells at a time, burning a while), the ice mirrors (three crystal pillars bend his
// needles at F2; two wrench blows break one), the chain lightning (four rods round F2, the bolt jumping rod to rod round
// the square), the whirlwind (a vortex before him draws F2 in while he throws needles) and the element quartet (three of
// the room's quarters light with an element one after another; the one left dark is the only safe one when they go).
import { distance, floorDistance, segmentDistance, inCone, FLOOR_FLAT, angleTo, wrap, along } from './math.js';

const TAU = Math.PI * 2;
const inRect = (pt, r, pad = 0) => pt.x >= r.x0 - pad && pt.x <= r.x1 + pad && pt.y >= r.y0 - pad && pt.y <= r.y1 + pad;
/** The clip each spell plays: the staff raised, or pointed for bolts. */
const POINT = new Set(['odNeedles', 'odFan']);
/** The four elements of the lanes, in the order he turns through them. */
export const OD_ELEMENTS = ['fire', 'ice', 'lightning', 'wind'];
/** Element pairs for the last hour's crossing lanes, in turn. */
const CROSS = [['fire', 'ice'], ['lightning', 'wind'], ['ice', 'lightning'], ['wind', 'fire']];
/** Each element's colour, for its bursts, quakes and warnings (orden-boss-draw.js too). */
export const OD_COLOURS = { fire: '#ff8a3c', ice: '#9ad8f8', lightning: '#ffe066', wind: '#8fe8c8' };
/** How far a spreading-fire patch burns round its centre, as a share of its radius: as far as it is drawn (2026-11-24:
 *  it was drawn out to 1.35 but hurt only within 0.9, so F2 could stand in the flames unhurt). */
export const OD_FIRE_SIZE = 1.35;
/**
 * His spells that lay something on the floor, and the floor fields they leave (2026-11-21, the user's word: floor spells
 * came out on top of one another, sometimes with no way out). One waits for the last to be gone (odStep, odFloorBusy).
 */
const OD_FLOOR_SPELLS = new Set(['odLanes', 'odCross', 'odRunes', 'odFence', 'odFireSpread', 'odChain', 'odVortex', 'odQuartet', 'odMarch', 'odPress', 'odRings', 'odEcho2', 'odFrostNova', 'odCollapse', 'odCannon', 'odLastHour']);
const OD_FLOOR_FIELDS = new Set(['odRunes', 'odFence', 'odLanes', 'odFire', 'odChain', 'odVortex', 'odQuartet', 'odMarch', 'odPress', 'odRings', 'odNova', 'odHoles', 'odCannon', 'odLastHour', 'odDefer']);
/** The last hour's echo pairs (odEcho2), the second laid out once the first is over. */
const ECHO_PAIRS = [['odMarch', 'odRings'], ['odPress', 'odRings'], ['odMarch', 'odPress']];
/** The element spells' numbers (2026-11-20, first pass), unless his rules in slice.json say otherwise. */
const ELEMENTAL = { fireCell: 1.6, fireRings: 4, fireWarn: 0.8, fireStep: 0.4, fireBurn: 2.2, fireSkip: 0.2, fireDamage: 0.6,
  mirrors: 3, mirrorReach: 3.6, mirrorSeconds: 5, mirrorFirst: 1.0, mirrorGap: 0.55, mirrorHits: 2,
  chainStrikes: 6, chainStrikesFinal: 8, chainWarn: 0.9, chainGap: 0.6, chainShow: 0.75, chainStrike: 1.2, chainLinger: 2.2, chainWidth: 0.35, chainDamage: 0.8, chainLinkDamage: 0.5,
  novaRings: 2, novaWarn: 1.0, novaGap: 0.9, novaSpeed: 7, novaRange: 16, novaGaps: 3, novaGapDegrees: 40, novaWidth: 0.45, novaDamage: 0.8, novaSlow: 2,
  vortexAhead: 2.8, vortexSeconds: 4.2, vortexPull: 1.7, vortexEye: 0.8, vortexDamage: 0.5, vortexBolts: 3,
  quartetGap: 0.65, quartetWarn: 1.0, quartetDamage: 0.9 };
/** odEl's merges, one per rule object (2026-11-21, the cleanup: it was built afresh three times a cast). */
const EL_MERGED = new WeakMap();

export const ordenBoss = {
  /** Orden's rules, if `enemy` is him (either fight). */
  odAI(enemy) { return enemy?.boss && (enemy.type === 'orden' || enemy.type === 'ordenFinal') ? this.config.bossAI[enemy.type] : null; },
  odFinal(enemy) { return enemy.type === 'ordenFinal'; },
  /** Orden 1's second phase: from the moment his break is done. */
  odPhase2(enemy) { return !!enemy.breaksDone?.length; },
  /** Damage from his attack times `k` (scaled by the difficulty); set amounts go through fbFixed. */
  odDamage(enemy, k) { return Math.max(1, Math.round(this.weakened(enemy, enemy.damage * k))); },
  /** Somewhere on the floor near `at` (the nearest open spot toward F2). */
  odSpot(at, room = 0.6) { return this.fbFloor(at.x, at.y, this.p, room); },
  /** The open holes of the last hour's falling floor. */
  odHoleAt(pt, pad = 0) { return (this.s.bossFields || []).some(f => f.kind === 'odHoles' && f.pieces.some(h => h.fall !== null && this.s.time >= h.fall && this.s.time < h.back && inRect(pt, h, pad))); },
  /** True when `pt` lies on open floor (and not over a hole). */
  odSolid(pt, room = 0.5) { return this.bgOpen(pt, room) && !this.odHoleAt(pt, 0.2); },

  /** What a tell needs when it starts: its pose, and where it will land, so the warning can show it. */
  odTell(enemy, tell) {
    const ai = this.odAI(enemy), p = this.p, t = this.s.time;
    enemy.tellPose = POINT.has(tell.type) ? 'point' : 'cast';
    if (tell.type === 'odLanes') tell.lanes = this.odLanePlan(enemy, ai, [OD_ELEMENTS[(enemy.odElement = (enemy.odElement ?? -1) + 1) % 4]], ['y']);
    if (tell.type === 'odCross') { const pair = CROSS[(enemy.odCross = (enemy.odCross ?? -1) + 1) % CROSS.length]; tell.lanes = this.odLanePlan(enemy, ai, pair, ['y', 'x']); }
    if (tell.type === 'odLanes' && tell.lanes[0].element === 'lightning') tell.until = tell.started + (tell.until - tell.started) * ai.lightningTell;
    if (tell.type === 'odCannon') { const room = this.bgRoom(); tell.half = p.x >= enemy.x ? { x0: enemy.x - 0.5, x1: room.right + 2, y0: room.top - 2, y1: room.bottom + 2 } : { x0: room.left - 2, x1: enemy.x + 0.5, y0: room.top - 2, y1: room.bottom + 2 }; }
    if (tell.type === 'odLastHour') tell.safe = this.odSafeSpots(enemy, ai);
    if (tell.type === 'odClones') tell.spots = this.odCloneSpots(enemy, this.odFinal(enemy) ? 4 : 3);
    if (tell.type === 'odEcho2') tell.pair = ECHO_PAIRS[Math.floor(this.random() * ECHO_PAIRS.length)];
    tell.aim = { x: p.x, y: p.y, at: t };
  },

  /** Each step: float to his distance and cast the next spell; his images stand still where he left them. */
  odStep(enemy, dt) {
    const ai = this.odAI(enemy), t = this.s.time, p = this.p;
    if (enemy.followup && !enemy.tell) { const next = enemy.followup; enemy.followup = null; this.beginEnemyTell(enemy, next.type, Math.max(0.1, next.at - t)); return true; }
    if (enemy.tell || t < (enemy.busyUntil || 0)) return true;
    const d = distance(enemy, p), a = angleTo(enemy, p);
    enemy.facing = a;
    // Too far from F2 (2026-11-21, the user's word): he blinks to her side, at his distance, on open floor.
    if (d > (ai.teleportFar ?? 8.5) && t >= (enemy.blinkReady || 0)) {
      enemy.blinkReady = t + (ai.teleportEvery ?? 3.5);
      let to = null;
      for (let i = 0; i < 16 && !to; i++) { const at = along(p, a + Math.PI + (this.random() - 0.5) * 2.2, ai.stand); if (this.odSolid(at, enemy.radius)) to = at; }
      if (to) {
        this.effect('ring', enemy.x, enemy.y, '#a070e0', 0.6, 1.4, { look: 'odBurst' }); this.effect('dodge', enemy.x, enemy.y, '#9aa4b4', 0.4, 1.4);
        Object.assign(enemy, { x: to.x, y: to.y }); enemy.facing = angleTo(enemy, p);
        this.effect('ring', to.x, to.y, '#7fe8ff', 0.6, 1.4, { look: 'odBurst' }); this.sense({ kind: 'boss', id: 'odClonePop' });
        enemy.ready = Math.max(enemy.ready, t + 0.35);
        return true;
      }
    }
    // A floor spell waits until his last floor is gone (he floats meanwhile); other spells go ahead.
    if (t >= enemy.ready && !(OD_FLOOR_SPELLS.has(this.odPeek(enemy, ai)) && this.odFloorBusy())) { this.beginEnemyTell(enemy, this.odNext(enemy, ai)); return true; }
    // Float: back off when F2 comes close, come in when she is far, and drift round her a little.
    const want = d < ai.stand - 0.8 ? -1 : d > ai.stand + 0.8 ? 1 : 0, side = Math.sin(t * 0.7) * 0.5;
    const vx = Math.cos(a) * want + Math.cos(a + Math.PI / 2) * side, vy = Math.sin(a) * want + Math.sin(a + Math.PI / 2) * side;
    this.move(enemy, vx * ai.speed * dt, vy * ai.speed * dt);
    return true;
  },
  /** True when the last hour is due: below lastHourFrom of his health and lastHourEvery since the last. */
  odLastHourDue(enemy, ai) { return this.odFinal(enemy) && enemy.hp / enemy.maxHp <= ai.lastHourFrom && this.s.time >= (enemy.lastHourReady || 0); },
  /** The spell odNext would give now, without taking it: the last hour when due, else the next of his round. */
  odPeek(enemy, ai) {
    if (this.odLastHourDue(enemy, ai)) return 'odLastHour';
    const round = !this.odFinal(enemy) && this.odPhase2(enemy) ? ai.round2 : ai.round;
    return round[((enemy.odStepIndex ?? -1) + 1) % round.length];
  },
  /** True while a floor of his (or his images') is still down: a field not done, burning lane marks included. */
  odFloorBusy() {
    return (this.s.bossFields || []).some(f => OD_FLOOR_FIELDS.has(f.kind) && !f.done);
  },
  /** The next spell, taken (odPeek's, then counted): the last hour adds the sigil and the last toll as his health falls. */
  odNext(enemy, ai) {
    const t = this.s.time, step = this.odPeek(enemy, ai);
    if (step === 'odLastHour') { enemy.lastHourReady = t + ai.lastHourEvery; return step; }
    enemy.odStepIndex = (enemy.odStepIndex ?? -1) + 1;
    // The sigil rides on every other spell below 60% (never on the last toll, which asks for standing on gold).
    if (this.odFinal(enemy) && enemy.hp / enemy.maxHp <= ai.sigilFrom && enemy.odStepIndex % 2 === 0 && !(this.s.bossFields || []).some(f => f.kind === 'odSigil' && !f.done)) {
      this.fbField({ kind: 'odSigil', owner: enemy.id, mode: this.random() < 0.5 ? 'stop' : 'move', from: t, at: t + ai.sigilSeconds, last: { x: this.p.x, y: this.p.y }, moved: 0, damage: this.fbFixed(ai.sigilDamage) });
      this.sense({ kind: 'boss', id: 'odSigil' });
    }
    return step;
  },

  /** The spells. Returns true when the tell was one of his. */
  odExecute(enemy, tell) {
    const ai = this.odAI(enemy);
    if (!ai) return false;
    const t = this.s.time, p = this.p, final = this.odFinal(enemy);
    const hold = until => { enemy.busyUntil = until; enemy.ready = Math.max(enemy.ready, until + enemy.recovery); };
    switch (tell.type) {
      case 'odNeedles': case 'odFan': {
        // Three volleys; each aims as it locks, 0.3 s before it flies (the warning shows the locked line). The first flies
        // at once, so along the warning's own arrows (2026-11-24: it aimed afresh at F2 as it flew).
        const fan = tell.type === 'odFan', shot = fan ? { n: ai.fanBolts, spread: ai.fanDegrees * Math.PI / 180, bounces: 1 } : {};
        this.odVolleys(enemy, enemy, [0, 1, 2].map(i => t + i * ai.needleGap), this.odDamage(enemy, fan ? ai.fanDamage : ai.needleDamage), ai.needleSpeed, i => (i === 0 ? { ...shot, angle: tell.angle } : shot));
        hold(t + ai.needleGap * 2 + 0.2);
        this.sense({ kind: 'boss', id: 'odNeedle' }); return true;
      }
      case 'odRunes': {
        const waves = final ? 3 : 2, list = [];
        for (let w = 0; w < waves; w++) list.push({ show: t + w * ai.runeGap, at: t + w * ai.runeGap + ai.runeWarn, spots: null, centre: null, done: false });
        this.fbField({ kind: 'odRunes', owner: enemy.id, waves: list, radius: ai.runeRadius, damage: this.odDamage(enemy, ai.runeDamage) });
        hold(t + waves * ai.runeGap); return true;
      }
      case 'odFence': {
        const a0 = this.random() * TAU, needles = [0, 1, 2, 3].map(k => ({ angle: a0 + k * Math.PI / 2, hits: 0, out: null }));
        this.fbField({ kind: 'odFence', owner: enemy.id, x: p.x, y: p.y, from: t, until: t + ai.fenceSeconds, r0: ai.fenceStart, r1: ai.fenceEnd, needles, needHits: ai.fenceHits, spin: final ? ai.fenceSpin * (this.random() < 0.5 ? -1 : 1) : 0, back: final ? ai.fenceBack : Infinity, hitAt: -1, damage: this.fbFixed(ai.fenceDamage), burst: this.fbFixed(ai.fenceBurst), burstDone: false });
        this.sense({ kind: 'boss', id: 'odFence' });
        // The fence comes up round her with a ring of light and a burst at each needle.
        this.effect('ring', p.x, p.y, '#7fe8ff', 0.6, ai.fenceStart, { look: 'bgTollCyan' });
        for (const n of needles) { const at = along(p, n.angle, ai.fenceStart); this.effect('ring', at.x, at.y, '#7fe8ff', 0.8, 1.2, { look: 'odBurst' }); }
        hold(t + 0.6); return true;
      }
      case 'odLanes': case 'odCross': {
        // One blow (2026-11-20, the user's word: one hit, but cast more often; it used to blow across, then down, and
        // lightning struck twice): the lanes across; crossing lanes (odCross) blow together. (The second strike's
        // branch, lightningSecond, could no longer happen and went on 2026-11-21.)
        const bars = tell.lanes;
        bars.forEach(b => { b.at = t; b.show = tell.started; b.done = false; });
        this.fbField({ kind: 'odLanes', owner: enemy.id, bars, marks: [], damage: this.odDamage(enemy, tell.type === 'odCross' ? ai.crossDamage : ai.laneDamage), burn: this.fbFixed(ai.burnDamage), nextBurn: 0, slow: ai.iceSlow });
        hold(t + 0.6); return true;
      }
      case 'odOrbs': {
        const n = final ? ai.orbs2 : ai.orbs, dark = new Set(), orbs = [];
        while (final && dark.size < Math.min(n - 1, ai.darkOrbs)) dark.add(Math.floor(this.random() * n));
        for (let i = 0; i < n; i++) { const a = enemy.facing + (i - (n - 1) / 2) * 0.7; orbs.push({ ...along(enemy, a, 1.2), angle: a, dark: dark.has(i), state: 'chase' }); }
        this.fbField({ kind: 'odOrbs', owner: enemy.id, orbs, until: t + ai.orbSeconds, damage: this.odDamage(enemy, ai.orbDamage) });
        for (const o of orbs) this.effect('ring', o.x, o.y, o.dark ? '#a070e0' : '#7fe8ff', 0.8, 1.2, { look: 'odBurst' });
        this.sense({ kind: 'boss', id: 'odOrbs' });
        hold(t + 0.8); return true;
      }
      case 'odFireSpread': this.odFireSpread(enemy, this.odEl(ai)); hold(t + 0.6); return true;
      case 'odIceMirror': { const el = this.odEl(ai), n = this.odIceMirror(enemy, el); hold(t + el.mirrorFirst + n * el.mirrorGap + 0.3); return true; }
      case 'odChain': hold(t + this.odChain(enemy, this.odEl(ai)) + 0.3); return true;
      case 'odFrostNova': hold(t + this.odFrostNova(enemy, this.odEl(ai)) * 0.6); return true;
      case 'odVortex': this.odVortex(enemy, ai, this.odEl(ai)); hold(t + this.odEl(ai).vortexSeconds * 0.7); return true;
      // He holds the quartet till it goes (2026-11-20: his next spell's floor fell on its dark, safe quarter).
      case 'odQuartet': { const el = this.odEl(ai); this.odQuartet(enemy, ai, el); hold(t + 2 * el.quartetGap + el.quartetWarn + 0.3); return true; }
      // The echoes hold him till they are done (2026-11-20: his next spell's floor fell on their safe ways).
      case 'odMarch': { const room = this.bgRoom(); this.odMarch(enemy, ai, t); hold(t + ai.marchWarn + ai.marchGap + (room.bottom - room.top + 1) / ai.marchSpeed); return true; }
      case 'odPress': this.odPress(enemy, ai, t); hold(t + ai.pressWarn); return true;
      case 'odRings': this.odRings(enemy, ai, t); hold(t + ai.ringWarn + 2 * ai.ringGap + 0.3); return true;
      case 'odEcho2': {
        // One after the other (2026-11-21, the user's word: the two laid down together could leave no way out): the
        // second is laid out round F2 only once the first is over (an odDefer field), so it aims where she is then.
        const [a, b] = tell.pair, first = this.odEcho(enemy, ai, a, t), second = t + first + 0.3;
        this.fbField({ kind: 'odDefer', owner: enemy.id, at: second, spell: b, done: false });
        hold(second + this.odEchoLength(ai, b)); return true;
      }
      case 'odClones': this.odClones(enemy, ai, tell.spots); hold(t + ai.cloneCast + (final ? ai.cloneSwap : 0) + 1); return true;
      case 'odCollapse': this.odCollapse(enemy, ai); hold(t + 0.6); return true;
      case 'odCannon': {
        if (inRect(p, tell.half) && !p.dodge) this.hurt(this.odDamage(enemy, ai.cannonDamage));
        this.fbField({ kind: 'odCannon', owner: enemy.id, half: tell.half, at: t, until: t + 0.6 });
        this.effect('ring', enemy.x, enemy.y, '#7fe8ff', 0.8, 3, { look: 'odBurst' });
        this.bossQuake(enemy.x, enemy.y, { power: 1.4, color: '#7fe8ff', reach: 4, pillar: true }); this.sense({ kind: 'heavy' }); this.sense({ kind: 'boss', id: 'odCannon' });
        // No opening after it (2026-11-21, the user's word: take out every 'apparatus exposed' daze).
        return true;
      }
      case 'odLastHour': {
        // (lastHourTolls of them: 6 since 2026-11-22, the user's word; 12 before.)
        const n = ai.lastHourTolls ?? 12, tolls = Array.from({ length: n }, (_, i) => ({ at: t + i * ai.lastHourGap, done: false }));
        this.fbField({ kind: 'odLastHour', owner: enemy.id, safe: tell.safe, tolls, radius: ai.lastHourSafe, damage: this.fbFixed(ai.lastHourDamage) });
        hold(t + n * ai.lastHourGap + 0.4); return true;
      }
    }
    return false;
  },

  /** The element spells' numbers: ELEMENTAL under his own (merged once per rule object). */
  odEl(ai) { let el = EL_MERGED.get(ai); if (!el) EL_MERGED.set(ai, el = { ...ELEMENTAL, ...ai }); return el; },
  /**
   * A field of his needles from `from`, a volley at each time in `ats`: one bolt, aimed as it locks 0.3 s before it flies,
   * the later ones led ahead of F2; `v` lays its own over that (a fan, a set angle, fakes), or gives it per volley.
   */
  odVolleys(enemy, from, ats, damage, speed, v = {}) {
    const volleys = ats.map((at, i) => ({ at, lead: i > 0, n: 1, spread: 0, bounces: 0, angle: null, fired: false, ...(typeof v === 'function' ? v(i) : v) }));
    this.fbField({ kind: 'odBolts', owner: enemy.id, from: { x: from.x, y: from.y }, volleys, bolts: [], damage, speed });
  },
  /** What a blown lane or quarter leaves on the floor for a while: fire burns burnSeconds, ice slows iceSeconds. */
  /** How far a lit fire patch reaches round its centre at `t`: it flares up to OD_FIRE_SIZE in its first 0.17 s. */
  odFireReach(cell, t) { return cell.r * OD_FIRE_SIZE * Math.min(1, 0.5 + (t - cell.at) * 3); },
  odMark(r, element, t, ai) { return { x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, element, at: t, until: t + (element === 'fire' ? ai.burnSeconds : element === 'ice' ? ai.iceSeconds : 0.5) }; },
  /**
   * The spreading fire: a spark lands where F2 stands (fireWarn), and the fire runs out over the floor a ring of cells
   * (fireCell square) at a time, fireStep apart, fireRings out, now and then a cell left unburnt; each burns fireBurn.
   */
  odFireSpread(enemy, el) {
    const t = this.s.time, p = this.p, C = el.fireCell, cells = [];
    let seedCell = -1;
    const seed = { i: Math.round(p.x / C), j: Math.round(p.y / (C * FLOOR_FLAT * 1.4)) }, H = C * FLOOR_FLAT * 1.4;
    for (let di = -el.fireRings; di <= el.fireRings; di++) for (let dj = -el.fireRings; dj <= el.fireRings; dj++) {
      // Round patches, nudged off the grid (2026-11-20, the user's word: square cells looked wrong); rings by distance.
      const ring = Math.round(Math.hypot(di, dj)), x = (seed.i + di) * C + (di || dj ? (this.random() - 0.5) * C * 0.4 : 0), y = (seed.j + dj) * H + (di || dj ? (this.random() - 0.5) * H * 0.4 : 0);
      if (ring > el.fireRings) continue;
      if (ring > 1 && this.random() < el.fireSkip) continue;
      if (!this.odSolid({ x, y }, 0.2)) continue;
      const at = t + el.fireWarn + ring * el.fireStep;
      if (!di && !dj) seedCell = cells.length;
      cells.push({ x0: x - C / 2, x1: x + C / 2, y0: y - H / 2, y1: y + H / 2, x, y, r: C * (0.62 + this.random() * 0.12), at: at + this.random() * el.fireStep * 0.5, until: at + el.fireBurn, lit: false });
    }
    this.fbField({ kind: 'odFire', owner: enemy.id, cells, seedCell, from: t, nextHit: 0, damage: this.odDamage(enemy, el.fireDamage), burn: this.fbFixed(el.burnDamage ?? 5) });
    this.sense({ kind: 'boss', id: 'odLane_fire' });
  },
  /** The ice mirrors: crystal pillars round F2, and a needle at each in turn that the crystal bends at her. */
  odIceMirror(enemy, el) {
    const t = this.s.time, p = this.p, a0 = angleTo(p, enemy), pillars = [];
    for (let k = 0; k < 8 && pillars.length < el.mirrors; k++) {
      const at = along(p, a0 + Math.PI / 2 + (k % 2 ? 1 : -1) * (0.4 + k * 0.45) + (k === 0 ? Math.PI : 0), el.mirrorReach);
      if (this.odSolid(at, 0.5) && pillars.every(q => floorDistance(q, at) > 2.2)) pillars.push({ x: at.x, y: at.y, hits: 0, broken: false });
    }
    if (!pillars.length) pillars.push({ ...along(p, a0 + Math.PI, 2), hits: 0, broken: false });
    this.fbField({ kind: 'odMirror', owner: enemy.id, pillars, from: t, until: t + el.mirrorSeconds, needHits: el.mirrorHits });
    for (const q of pillars) { this.effect('ring', q.x, q.y, '#9ad8f8', 0.8, 1.6, { look: 'odBurst' }); this.effect('spark', q.x, q.y - 1, '#e0f6ff', 0.5, 1.4); }
    this.odVolleys(enemy, enemy, pillars.map((q, i) => t + el.mirrorFirst + i * el.mirrorGap), this.odDamage(enemy, el.needleDamage ?? 0.6), el.needleSpeed ?? 12, i => ({ lead: false, angle: angleTo(enemy, pillars[i]) }));
    this.sense({ kind: 'boss', id: 'odLane_ice' });
    return pillars.length;
  },
  /**
   * The chain lightning, chasing (2026-11-21, the user's word: the square of rods was too easy): chainStrikes bolts come
   * down one after another where F2 stands as each one's warning starts, a lightning rod left standing at each, and every
   * rod is joined to the one before by a live bolt for chainLinger s. She has to keep moving, without crossing the trail
   * of live bolts she leaves behind her.
   */
  odChain(enemy, el) {
    const t = this.s.time, n = this.odFinal(enemy) ? el.chainStrikesFinal : el.chainStrikes;
    const strikes = Array.from({ length: n }, (_, i) => { const at = t + el.chainWarn + i * el.chainGap; return { show: at - el.chainShow, at, done: false }; });
    this.fbField({ kind: 'odChain', owner: enemy.id, rods: [], strikes, links: [], from: t, show: el.chainShow, radius: el.chainStrike, width: el.chainWidth, linger: el.chainLinger, nextHit: 0, damage: this.odDamage(enemy, el.chainDamage), linkDamage: this.odDamage(enemy, el.chainLinkDamage) });
    return strikes.at(-1).at - t;
  },
  /**
   * The frost nova (2026-11-21, the user's word: one more ice attack): he strikes his staff down and rings of ice run out
   * from him over the whole floor, novaRings of them novaGap apart, each with novaGaps openings; the second ring's openings
   * lie between the first's. Caught by a ring: hurt and slowed (iceSlow) for novaSlow s.
   */
  odFrostNova(enemy, el) {
    const t = this.s.time, base = this.random() * TAU, step = TAU / el.novaGaps;
    const half = el.novaGapDegrees * Math.PI / 360;
    const rings = Array.from({ length: el.novaRings }, (_, i) => ({ at: t + el.novaWarn + i * el.novaGap, gaps: Array.from({ length: el.novaGaps }, (_, k) => base + k * step + (i % 2) * step / 2), r: 0, hit: false, done: false }));
    // Each ring's solid arcs, everything but its openings, as [from, to] angles in floor shape (worked out here once for
    // the drawing; it used to be every frame).
    for (const ring of rings) { const gaps = ring.gaps.map(g => ((g % TAU) + TAU) % TAU).sort((a, b) => a - b); ring.spans = gaps.map((g, i) => [g + half, (gaps[i + 1] ?? gaps[0] + TAU) - half]); }
    this.fbField({ kind: 'odNova', owner: enemy.id, x: enemy.x, y: enemy.y, rings, from: t, speed: el.novaSpeed, range: el.novaRange, half, width: el.novaWidth, slowUntil: 0, slowFor: el.novaSlow, slow: el.iceSlow, damage: this.odDamage(enemy, el.novaDamage) });
    this.effect('ring', enemy.x, enemy.y, '#9ad8f8', 0.8, 2.4, { look: 'odBurst' });
    return rings.at(-1).at + el.novaRange / el.novaSpeed - t;
  },
  /** The whirlwind: a vortex before him draws F2 in (its eye hurts and throws her out) while he throws needles. */
  odVortex(enemy, ai, el) {
    const t = this.s.time, p = this.p, want = along(enemy, angleTo(enemy, p), el.vortexAhead), at = this.odSolid(want, 0.5) ? want : this.odSpot(want, 0.5);
    this.fbField({ kind: 'odVortex', owner: enemy.id, x: at.x, y: at.y, from: t, until: t + el.vortexSeconds, pull: el.vortexPull, eye: el.vortexEye, nextHit: 0, damage: this.odDamage(enemy, el.vortexDamage) });
    this.effect('ring', at.x, at.y, '#8fe8c8', 0.8, 2.6, { look: 'odBurst' }); this.bossQuake(at.x, at.y, { power: 0.8, color: '#8fe8c8', reach: 3 });
    this.odVolleys(enemy, enemy, Array.from({ length: el.vortexBolts }, (_, i) => t + 1 + i * (el.vortexSeconds - 1.6) / Math.max(1, el.vortexBolts - 1)), this.odDamage(enemy, ai.needleDamage), ai.needleSpeed);
    this.sense({ kind: 'boss', id: 'odLane_wind' });
  },
  /** The element quartet: three of the room's four quarters light with an element in turn; the dark one is safe when they go. */
  odQuartet(enemy, ai, el) {
    const t = this.s.time, room = this.bgRoom(), cx = (room.left + room.right) / 2, cy = (room.top + room.bottom) / 2;
    const quads = [[room.left - 1, cx, room.top - 1, cy], [cx, room.right + 1, room.top - 1, cy], [room.left - 1, cx, cy, room.bottom + 1], [cx, room.right + 1, cy, room.bottom + 1]].map(([x0, x1, y0, y1]) => ({ x0, x1, y0, y1 }));
    const order = [0, 1, 2, 3].sort(() => this.random() - 0.5), elements = [...OD_ELEMENTS].sort(() => this.random() - 0.5);
    order.slice(0, 3).forEach((q, k) => Object.assign(quads[q], { element: elements[k], show: t + k * el.quartetGap }));
    this.fbField({ kind: 'odQuartet', owner: enemy.id, quads, dark: order[3], at: t + 2 * el.quartetGap + el.quartetWarn, from: t, blown: false, damage: this.odDamage(enemy, el.quartetDamage), burn: this.fbFixed(ai.burnDamage ?? 5) });
  },
  /** The element lanes: `axes` 'y' = lanes across the room stacked down it, 'x' = lanes down the room side by side. */
  odLanePlan(enemy, ai, elements, axes, at = this.s.time) {
    const room = this.bgRoom(), p = this.p;
    return axes.map((axis, i) => {
      // Lanes across the room (axis y) laneRows of them, lanes down it laneCols, laneSafe of them safe (2026-11-21, the
      // user's word: no room to dodge, and more safe lanes rather than wider ones: seven lanes, four safe, not two of five).
      const n = axis === 'y' ? ai.laneRows ?? 7 : ai.laneCols ?? 7, ks = Array.from({ length: n }, (_, k) => k);
      const lo = axis === 'y' ? room.top : room.left, hi = axis === 'y' ? room.bottom : room.right, w = (hi - lo) / n, here = Math.max(0, Math.min(n - 1, Math.floor(((axis === 'y' ? p.y : p.x) - lo) / w)));
      // No safe lane is the one F2 stands in, so every bar asks for a move.
      const choices = ks.filter(k => k !== here).sort(() => this.random() - 0.5), safes = choices.slice(0, ai.laneSafe ?? 4), safe = safes[0];
      const lanes = ks.map(k => axis === 'y' ? { x0: room.left - 1, x1: room.right + 1, y0: lo + k * w, y1: lo + (k + 1) * w } : { x0: lo + k * w, x1: lo + (k + 1) * w, y0: room.top - 1, y1: room.bottom + 1 });
      return { axis, element: elements[i % elements.length], lanes, safe, safes, here, planned: at };
    });
  },
  /** Brass's march in his gold: two lines of soldiers sweeping down the room, a gap in each, the gaps apart. */
  odMarch(enemy, ai, at) {
    // The gaps near F2 (2026-11-20, the user's word: a gap anywhere across the wide room could not be reached): the first
    // marchNear to marchFar to one side of her, the second marchShift on from it, both inside the room.
    const room = this.bgRoom(), p = this.p, lo = room.left + ai.marchHalf + 0.5, hi = room.right - ai.marchHalf - 0.5, clampX = x => Math.max(lo, Math.min(hi, x));
    const side = this.random() < 0.5 ? -1 : 1, g1 = clampX(p.x + side * (ai.marchNear + this.random() * (ai.marchFar - ai.marchNear)));
    let g2 = clampX(g1 + (this.random() < 0.5 ? -1 : 1) * ai.marchShift); if (Math.abs(g2 - g1) < ai.marchShift * 0.8) g2 = clampX(g1 - Math.sign(g2 - g1 || 1) * ai.marchShift);
    this.fbField({ kind: 'odMarch', owner: enemy.id, lines: [{ gap: g1, start: at + ai.marchWarn, hit: false }, { gap: g2, start: at + ai.marchWarn + ai.marchGap, hit: false }], from: at, top: room.top - 0.5, bottom: room.bottom + 0.5, left: room.left - 1, right: room.right + 1, speed: ai.marchSpeed, half: ai.marchHalf, damage: this.odDamage(enemy, ai.marchDamage) });
  },
  /** Press's plates in his gold: a 4 x 4 grid round F2 (3 x 3 before 2026-11-20, the user's word), fourteen plates falling, two cells apart left safe. */
  odPress(enemy, ai, at) {
    const p = this.p, w = ai.pressCell, h = ai.pressCell * FLOOR_FLAT * 1.4, cells = [];
    const n = 4;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c, x0: p.x + (c - n / 2) * w, x1: p.x + (c + 1 - n / 2) * w, y0: p.y + (r - n / 2) * h, y1: p.y + (r + 1 - n / 2) * h });
    let a = 0, b = 0;
    for (let i = 0; i < 20; i++) { a = Math.floor(this.random() * cells.length); b = Math.floor(this.random() * cells.length); if (Math.abs(cells[a].r - cells[b].r) + Math.abs(cells[a].c - cells[b].c) >= 2) break; }
    for (const [i, c] of cells.entries()) c.safe = i === a || i === b;
    this.fbField({ kind: 'odPress', owner: enemy.id, cells, from: at, at: at + ai.pressWarn, done: false, damage: this.odDamage(enemy, ai.pressDamage) });
  },
  /** Belgard's rings in his gold: three bands round Orden, inner, outer, then the middle. */
  odRings(enemy, ai, at) {
    const [r0, r1, r2] = ai.ringRadii, start = at + ai.ringWarn;
    this.fbField({ kind: 'odRings', owner: enemy.id, x: enemy.x, y: enemy.y, from: at, bands: [[0, r0], [r1, r2], [r0, r1]].map(([lo, hi], i) => ({ lo, hi, at: start + i * ai.ringGap, done: false })), damage: this.fbFixed(ai.ringDamage) });
  },
  /** One of Belgard's, Brass's or Press's patterns in his gold, laid out from `at`; returns how long it lasts. */
  odEcho(enemy, ai, kind, at) {
    if (kind === 'odMarch') this.odMarch(enemy, ai, at); if (kind === 'odPress') this.odPress(enemy, ai, at); if (kind === 'odRings') this.odRings(enemy, ai, at);
    return this.odEchoLength(ai, kind);
  },
  odEchoLength(ai, kind) {
    const room = this.bgRoom();
    return kind === 'odMarch' ? ai.marchWarn + ai.marchGap + (room.bottom - room.top + 1) / ai.marchSpeed : kind === 'odPress' ? ai.pressWarn + 0.4 : ai.ringWarn + 2 * ai.ringGap + 0.3;
  },
  /** Where his images will stand: round F2 at his distance, apart, on the floor. */
  odCloneSpots(enemy, n) {
    const p = this.p, a0 = angleTo(p, enemy), ai = this.odAI(enemy);
    return Array.from({ length: n }, (_, i) => this.odSpot(along(p, a0 + i * TAU / n, ai.cloneReach), 1));
  },
  /** His mirror images: he takes one spot, an image takes each other; they cast together, only his spell is real. */
  odClones(enemy, ai, spots) {
    const t = this.s.time, real = Math.floor(this.random() * spots.length), ids = [];
    this.effect('dodge', enemy.x, enemy.y, '#7fe8ff', 0.4, 1.4);
    Object.assign(enemy, spots[real]);
    spots.forEach((at, i) => {
      if (i === real) { ids.push(enemy.id); return; }
      const body = this.spawnEnemy('ordenEcho', at);
      Object.assign(body, { held: true, vanishAt: t + ai.cloneCast + ai.cloneSwap + 1.6, odClone: enemy.id, sprite: enemy.sprite || (this.odFinal(enemy) ? 'ordenx' : 'orden'), facing: angleTo(body, this.p), tellPose: 'cast', ready: Infinity });
      this.effect('dodge', at.x, at.y, '#7fe8ff', 0.4, 1.4); ids.push(body.id);
    });
    // The last hour: just before casting the real one swaps places with an image (watch the eye, as with Tick·Tock).
    const swap = this.odFinal(enemy) ? { at: t + ai.cloneSwap * 0.4, until: t + ai.cloneSwap, with: ids.filter(id => id !== enemy.id)[Math.floor(this.random() * (ids.length - 1))] } : null;
    this.fbField({ kind: 'odClones', owner: enemy.id, ids, cast: t + ai.cloneCast + (swap ? ai.cloneSwap : 0), swap, done: false });
    this.sense({ kind: 'boss', id: 'odClones' });
  },
  /** The last hour's falling floor: pieces near F2 and about the room lift, then fall away and come back. */
  odCollapse(enemy, ai) {
    const t = this.s.time, p = this.p, room = this.bgRoom(), pieces = [], w = ai.holeSize, h = ai.holeSize * FLOOR_FLAT * 1.3;
    const add = (cx, cy) => { const r = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 }; if (!pieces.some(q => !(r.x1 < q.x0 || r.x0 > q.x1 || r.y1 < q.y0 || r.y0 > q.y1)) && this.bgOpen({ x: cx, y: cy }, 0.3)) pieces.push(r); };
    // One under F2, the rest spread evenly over the room (2026-11-22, the user's word: twelve, all over the map): the room
    // cut into a grid with about as many cells as pieces, a piece tried in each cell (in a shuffled order), then anywhere.
    add(p.x, p.y);
    const W = room.right - room.left, H = room.bottom - room.top, cols = Math.max(1, Math.round(Math.sqrt(ai.holes * W / H))), rows = Math.max(1, Math.ceil(ai.holes / cols));
    const cells = Array.from({ length: cols * rows }, (_, i) => [i % cols, Math.floor(i / cols)]).sort(() => this.random() - 0.5);
    for (const [cx, cy] of cells) for (let k = 0; k < 8 && pieces.length < ai.holes; k++) {
      const before = pieces.length; add(room.left + (cx + 0.15 + this.random() * 0.7) * W / cols, room.top + (cy + 0.15 + this.random() * 0.7) * H / rows); if (pieces.length > before) break;
    }
    for (let i = 0; i < 80 && pieces.length < ai.holes; i++) add(room.left + this.random() * W, room.top + this.random() * H);
    for (const r of pieces) Object.assign(r, { fall: t + ai.holeWarn, back: t + ai.holeWarn + ai.holeSeconds, fell: false });
    this.fbField({ kind: 'odHoles', owner: enemy.id, pieces, damage: this.fbFixed(ai.holeDamage), hitAt: -1 });
    this.sense({ kind: 'boss', id: 'odCollapse' });
  },
  /** The last toll's safe floor: three spots apart, on solid floor, not under F2. */
  odSafeSpots(enemy, ai) {
    const room = this.bgRoom(), spots = [], p = this.p;
    for (let i = 0; i < 60 && spots.length < 3; i++) {
      const at = { x: room.left + 1.5 + this.random() * (room.right - room.left - 3), y: room.top + 1 + this.random() * (room.bottom - room.top - 2) };
      if (this.odSolid(at, 1) && floorDistance(at, p) > 2 && spots.every(s => floorDistance(s, at) > 5)) spots.push(at);
    }
    return spots.length ? spots : [{ x: p.x, y: p.y }];
  },

  /** Each frame: his spells on the floor and in the air, each field by its kind's step (OD_TICK). */
  tickOrdenBoss(dt) {
    const s = this.s, p = this.p, t = s.time, R = this.config.arena.playerRadius;
    const bossDown = !s.enemies.some(e => (e.type === 'orden' || e.type === 'ordenFinal') && e.boss && e.hp > 0);
    for (const e of s.enemies) if (e.odClone && e.hp > 0) e.facing = angleTo(e, p);
    for (const e of s.enemies) if (e.odClone && e.hp > 0 && (bossDown || t >= e.vanishAt)) { e.hp = 0; e.vanished = true; this.effect('ring', e.x, e.y, '#a070e0', 0.8, 1.4, { look: 'odBurst' }); this.effect('dodge', e.x, e.y, '#7fe8ff', 0.3, 1.2); }
    // What the steps share this frame: `hit` hurts F2 and says whether that ended the run, `mirrors` the ice mirror fields
    // (gathered once a frame since 2026-11-21, the cleanup: every bolt looked through all the fields for them).
    const frame = { s, p, t, R, dt, hit: amount => { this.hurt(amount); return !this.active; }, mirrors: (s.bossFields || []).filter(f => f.kind === 'odMirror') };
    for (const f of s.bossFields || []) {
      const step = Object.hasOwn(OD_TICK, f.kind) && OD_TICK[f.kind];
      if (!step) continue;
      const owner = s.enemies.find(e => e.id === f.owner), ai = owner && this.odAI(owner);
      if (!owner || owner.hp <= 0 || !ai) { f.done = true; continue; }
      if (step.call(this, f, owner, ai, frame)) return;
    }
  },
  /** How much the ice lanes slow F2 where she stands (0 to 1; factory-mobs.js patchSlow): the caster's own iceSlow. */
  odSlow(body) {
    const t = this.s.time;
    for (const f of this.s.bossFields || []) if (f.kind === 'odLanes' && f.marks.some(m => m.element === 'ice' && t < m.until && inRect(body, m))) return f.slow;
    // Caught by a frost nova ring: F2 slowed for a while.
    for (const f of this.s.bossFields || []) if (f.kind === 'odNova' && body === this.p && t < f.slowUntil) return f.slow;
    return 0;
  },

  /**
   * A wrench swing: a fence needle, an orb struck back (a dark one bursts), an image popped, a clock heart in the break.
   * (The blows a needle or a mirror takes are its field's own, from its caster's rules, since 2026-11-21: they were always
   * Orden 1's.)
   */
  odSwing(a, range) {
    const t = this.s.time, p = this.p, reach = (pt, extra = 0.5) => inCone(p, pt, a.angle, range + extra, this.config.rules.comboArcDegrees);
    for (const f of this.s.bossFields || []) {
      if (f.kind === 'odFence' && !f.burstDone) for (const n of f.needles) {
        const at = along(f, n.angle + (f.turn || 0), f.r ?? f.r0);
        if (n.out === null && reach(at, 0.6) && !(n.hitAt > t - 0.2)) { n.hitAt = t; n.hits++; this.effect('spark', at.x, at.y - 1, '#7fe8ff', 0.3, 0.9); this.sense({ kind: 'hit' }); if (n.hits >= f.needHits) { n.out = t; this.effect('ring', at.x, at.y, '#7fe8ff', 0.4, 1, { look: 'bgTollCyan' }); } }
      }
      if (f.kind === 'odMirror' && !f.done) for (const q of f.pillars) if (!q.broken && reach(q, 0.7) && !(q.hitAt > t - 0.2)) {
        q.hitAt = t; q.hits++; this.effect('spark', q.x, q.y - 1.5, '#e0f6ff', 0.3, 1); this.sense({ kind: 'hit' });
        if (q.hits >= f.needHits) { q.broken = true; this.effect('ring', q.x, q.y, '#9ad8f8', 0.6, 1.4, { look: 'odBurst' }); this.effect('spark', q.x, q.y - 1.2, '#e0f6ff', 0.6, 1.8); this.effect('ring', q.x, q.y, '#9ad8f8', 0.7, 2, { look: 'odBurst' }); this.sense({ kind: 'boss', id: 'odLane_ice' }); }
      }
      if (f.kind === 'odOrbs') for (const o of f.orbs) if (o.state === 'chase' && reach(o, 0.6)) {
        // A dark orb cannot be struck back: it bursts where it is, on whoever struck it.
        if (o.dark) { o.state = 'gone'; this.effect('ring', o.x, o.y, '#5a3a7a', 0.45, 1.2, { look: 'bgTollCyan' }); this.effect('ring', o.x, o.y, '#a070e0', 0.8, 1.4, { look: 'odBurst' }); if (floorDistance(o, p) < 1.6) this.hurt(f.damage); }
        else { o.state = 'back'; this.effect('spark', o.x, o.y, '#ffd257', 0.4, 1, { look: 'deflect' }); this.sense({ kind: 'boss', id: 'odOrbBack' }); }
      }
    }
    for (const e of this.s.enemies) if (e.odClone && e.hp > 0 && reach(e, e.radius)) { e.hp = 0; e.vanished = true; this.effect('ring', e.x, e.y, '#a070e0', 0.8, 1.4, { look: 'odBurst' }); this.effect('dodge', e.x, e.y, '#9aa4b4', 0.4, 1.4); this.sense({ kind: 'boss', id: 'odClonePop' }); }
    for (const enemy of this.s.enemies) {
      const b = enemy.breaking;
      if (!this.odAI(enemy) || b?.kind !== 'stopTime' || b.phase !== 'stop' || b.failAt !== null) continue;
      const rule = this.breakRule(enemy, b.index);
      for (const h of b.hearts) if (!h.broken && reach(h, 0.7) && !(h.hitAt > t - 0.2)) {
        h.hitAt = t; h.hits++; this.effect('spark', h.x, h.y - 1, '#ffd257', 0.3, 1); this.sense({ kind: 'hit' });
        if (h.hits >= rule.heartHits) { h.broken = true; b.phaseAt += rule.heartBonus; this.effect('ring', h.x, h.y, '#ffd257', 0.6, 1.4, { look: 'ttBurstGold' }); this.sense({ kind: 'boss', id: 'odHeart' }); }
      }
    }
  },

  // ---- the half-health break (E-1, 2026-11-19 the user's pick): time stops, and only F2 moves.
  odBreakStart(enemy, b, rule) {
    // He takes his stand at the middle of the dial on his floor: the maze is that dial (odDialScatter).
    const t = this.s.time, dial = this.odDial();
    Object.assign(enemy, this.odSpot(dial, 1));
    // (The overall limit only backs up the three tries, which fail on their own.)
    b.attempt = 0; b.until = t + rule.seconds; b.hearts = this.odHearts(enemy, rule);
    this.odScatter(enemy, b, rule);
    this.notify(enemy.breakFailed?.stopTime ? '시간이 멈춘 동안 회중시계 다섯 개를 렌치로 두 번씩 치세요. 하나 깰 때마다 2초가 늘어납니다. 시곗바늘은 회피로 뚫거나 분침의 빈틈에 서서 피하세요.' : '오르덴이 시간을 멈춥니다! 멈춘 바늘 사이로 회중시계 다섯 개를 깨세요. 도는 시곗바늘은 회피로 뚫고 지나갈 수 있고, 분침의 빈틈은 안전합니다.');
    this.sense({ kind: 'boss', id: 'odStopCast' });
    b.started = t;
  },
  /**
   * The dial the maze is laid on: the one painted on his floor (maps.json dial: the tuning chamber), or in a room with
   * none (2026-11-21, the cleanup: the square and round mazes for such rooms are gone) an ellipse in the middle of the
   * floor's box, 0.9 of its half width and half height across, so the outer ring stays on the floor.
   */
  odDial() {
    if (this.map?.dial) return this.map.dial;
    const room = this.bgRoom();
    return { x: (room.left + room.right) / 2, y: (room.top + room.bottom) / 2, rx: (room.right - room.left) / 2 * 0.9, ry: (room.bottom - room.top) / 2 * 0.9 };
  },
  /** The rule.hearts watches; where they stand is the maze's to say (odDialScatter puts them in its sectors, wide apart). */
  odHearts(enemy, rule) { return Array.from({ length: rule.hearts }, () => ({ x: enemy.x, y: enemy.y, hits: 0, broken: false })); },
  /** He flings the maze's needles over the dial (they fly to their places in scatterSeconds). */
  odScatter(enemy, b, rule) { this.odDialScatter(enemy, b, rule, this.odDial()); },
  /**
   * One look at the break's needles from `at` (2026-11-21, the cleanup: three passes a frame, each making the needles'
   * end points afresh): whether a wall and whether a hand comes within `reach` of it, each needle the line bulletHalf
   * either side of its spot (hx, hy, kept on it). `landing`: where they will stand (tx, ty), for the scatter. The answer
   * is one object kept on the break and reused, so read it at once.
   */
  odNeedlesNear(b, at, reach, landing = false) {
    const near = b.near ??= { wall: false, hand: false };
    near.wall = near.hand = false;
    for (const q of b.bullets) {
      if (q.gone || q.off || (q.hand ? near.hand : near.wall)) continue;
      // Measured on the floor as her foot shadow lies (up and down count 1/FLOOR_FLAT-fold), so she is hurt when her feet
      // touch the needle, not while they still stand clear of it a step above or below (2026-11-22, the user's word).
      const ox = at.x - (landing ? q.tx : q.x), oy = (at.y - (landing ? q.ty : q.y)) / FLOOR_FLAT, hy = q.hy / FLOOR_FLAT, hh = q.hx * q.hx + hy * hy;
      const u = hh ? Math.max(-1, Math.min(1, (ox * q.hx + oy * hy) / hh)) : 0;
      if (Math.hypot(ox - u * q.hx, oy - u * hy) < reach) { if (q.hand) near.hand = true; else near.wall = true; if (near.hand && near.wall) break; }
    }
    return near;
  },
  /** `at` if F2 stands clear of every needle there, else the nearest such spot on the floor round it (to 1.5 out), else `at`. */
  odClearSpot(b, at, reach) {
    const clear = q => { const n = this.odNeedlesNear(b, q, reach); return !n.wall && !n.hand; };
    if (clear(at)) return { x: at.x, y: at.y };
    for (let r = 0.3; r < 1.6; r += 0.3) for (let k = 0; k < 8; k++) { const q = along(at, k * TAU / 8, r); if (this.bgOpen(q, 0.4) && clear(q)) return q; }
    return { x: at.x, y: at.y };
  },
  /**
   * Where needle `hand.m` of one of the dial's hands stands `since` seconds into the stop, written into `q` (the needle
   * itself, each frame of the stop). A hand is as long on the floor as the ellipse is across at its angle, so it holds as
   * many needles end to end as fit there; the rest stand down (off).
   */
  odHandAt(dial, hand, since, q = {}) {
    const a = hand.at + hand.spin * since, ux = Math.cos(a) * dial.rx, uy = Math.sin(a) * dial.ry, L = Math.hypot(ux, uy);
    const fit = Math.max(1, Math.floor(L * (hand.reach - hand.s0) / (2 * hand.half * 0.95)));
    const s = hand.s0 + (hand.reach - hand.s0) * (hand.m + 0.5) / fit, angle = Math.atan2(uy, ux);
    // The minute hand's gap (odHandGap): a needle reaching into it is left out.
    const gap = this.odHandGap(dial, hand, a), inGap = gap && Math.abs(s - (gap[0] + gap[1]) / 2) < (gap[1] - gap[0]) / 2 + hand.half / L;
    q.x = q.tx = dial.x + ux * s; q.y = q.ty = dial.y + uy * s; q.angle = angle; q.off = hand.m >= fit || !!inGap; q.hx = Math.cos(angle) * hand.half; q.hy = Math.sin(angle) * hand.half;
    return q;
  },
  /**
   * The maze as the dial painted on his floor (2026-11-21, the user's words: the round rings sat apart from the map and
   * felt easy). Its rings are the floor dial's own ellipse at mazeRingsAt of its size (the last on the painted gold
   * line), the walls between sectors stand on its twelve hour marks, and the floor outside it is the maze's outside,
   * in twelve parts so that a floor edge between them keeps them apart. A maze is carved over the 24 sectors and the
   * outside from F2's, mazeLoops[attempt] of the walls left are knocked out, and doors stand only where the floor is.
   * Then two hands of needles, a minute hand to the outer ring and an hour hand to the middle one, turn round him
   * (mazeHands: turns a second) while time stands still. The watches go to sector middles spread round the dial (the
   * first scatter only). In a room with no dial painted, odDial fits one to the floor.
   */
  /**
   * Where along a hand its gap lies at dial angle `a`, in dial scale (0 the middle, 1 the painted gold line), or null for a
   * hand without one (2026-11-22, the user's pick: the minute hand outran F2 over the whole dial). The gap stands in the
   * middle of its band, `len` floor units long, or the whole band where the band is narrower than that.
   */
  odHandGap(dial, hand, a) {
    const g = hand.gap;
    if (!g) return null;
    const L = Math.hypot(Math.cos(a) * dial.rx, Math.sin(a) * dial.ry), half = Math.min(g.len / 2 / L, (g.hi - g.lo) / 2), mid = (g.lo + g.hi) / 2;
    return [mid - half, mid + half];
  },
  odDialScatter(enemy, b, rule, dial) {
    const t = this.s.time, p = this.p, c = { x: dial.x, y: dial.y }, half = rule.bulletHalf || 0, H = 12;
    const rings = rule.mazeRingsAt || [0.25, 0.62, 1], bands = rings.length - 1, outer = rings.at(-1) * 1.35;
    const at = (a, s) => ({ x: c.x + Math.cos(a) * dial.rx * s, y: c.y + Math.sin(a) * dial.ry * s });
    const edgeS = k => (k <= bands ? rings[k] : outer), mid = (k, i) => at((i + 0.5) * TAU / H, (edgeS(k) + edgeS(k + 1)) / 2);
    // (sectors 0..bands-1 are the bands between rings; band `bands` is the floor outside the dial)
    const fits = (k, i) => { const a0 = i * TAU / H, a1 = (i + 1) * TAU / H, am = (a0 + a1) / 2, s0 = edgeS(k), s1 = edgeS(k + 1), sm = (s0 + s1) / 2;
      return [at(am, sm), at(a0 + 0.12, sm), at(a1 - 0.12, sm)].every(q => this.bgOpen(q, 0.45)); };
    const open = (k, i) => k >= 0 && k <= bands && fits(k, i), key = (k, i) => k + ',' + i, mod12 = i => (i + H) % H;
    const door = (k, i) => { const a = (i + 0.5) * TAU / H, s = rings[k], d = 0.9 / Math.hypot(dial.rx, dial.ry); return [s - d * 3, s, s + d * 3].every(ss => this.bgOpen(at(a, ss), 0.45)); };
    // a ring's door between band k-1 and k, sector i: only where the floor holds it
    const neighbours = (k, i) => [[k, mod12(i + 1)], [k, mod12(i - 1)], ...(k < bands && door(k + 1, i) ? [[k + 1, i]] : []), ...(k > 0 && door(k, i) ? [[k - 1, i]] : [])];
    const polar = q => { const u = (q.x - c.x) / dial.rx, v = (q.y - c.y) / dial.ry, s = Math.hypot(u, v), a = ((Math.atan2(v, u) % TAU) + TAU) % TAU;
      let k = 0; while (k < bands && s >= rings[k + 1]) k++; return [s < rings[0] ? 0 : k, Math.floor(a / TAU * H) % H]; };
    const pair = (a2, b2) => (a2 < b2 ? a2 + '|' + b2 : b2 + '|' + a2);
    const first = polar(p), seen = new Set([key(...first)]), passages = new Set(), stack = [first];
    while (stack.length) {
      const [k, i] = stack.at(-1), next = neighbours(k, i).filter(([k2, j]) => open(k2, j) && !seen.has(key(k2, j)));
      if (!next.length) { stack.pop(); continue; }
      const n = next[Math.floor(this.random() * next.length)];
      passages.add(pair(key(k, i), key(...n))); seen.add(key(...n)); stack.push(n);
    }
    const inMaze = (k, i) => seen.has(key(k, i));
    // The watches spread as wide over the dial as they go (2026-11-21, the user's word: spread them further): each to
    // one of the three sectors farthest from F2 and from the watches already placed, so they stand all round the dial.
    if (!b.mazeSnapped) {
      const cands = [...seen].map(kk => kk.split(',').map(Number)).filter(([k, i]) => k < bands && key(k, i) !== key(...first)).map(([k, i]) => mid(k, i)), placed = [];
      for (const h of b.hearts) {
        // (On a floor with fewer sectors than watches, two may share one: there are always rule.hearts, as the notice says.)
        const left = cands.filter(q => !placed.includes(q)), free = left.length ? left : cands;
        if (!free.length) break;
        const score = q => Math.min(floorDistance(q, p) * 0.7, ...placed.map(o => floorDistance(q, o)));
        const top = free.sort((a2, b2) => score(b2) - score(a2)).slice(0, 3), pick = top[Math.floor(this.random() * top.length)];
        placed.push(pick); Object.assign(h, { x: pick.x, y: pick.y });
      }
      b.mazeSnapped = true;
    }
    const loops = rule.mazeLoops?.[Math.min(b.attempt, rule.mazeLoops.length - 1)] ?? 0, spots = [];
    const wall = (a2, b2) => !(inMaze(...a2) && inMaze(...b2) && (passages.has(pair(key(...a2), key(...b2))) || this.random() < loops));
    // a stretch of ring s from angle a0 to a1, needles end to end along the ellipse
    const ring = (s, a0, a1) => { const steps = 24, pts = Array.from({ length: steps + 1 }, (_, m) => at(a0 + (a1 - a0) * m / steps, s));
      let len = 0; for (let m = 1; m <= steps; m++) len += Math.hypot(pts[m].x - pts[m - 1].x, pts[m].y - pts[m - 1].y);
      const n = Math.max(1, Math.ceil(len / (2 * half * 0.92)));
      for (let m = 0; m < n; m++) { const a = a0 + (m + 0.5) * (a1 - a0) / n, q = at(a, s); spots.push({ ...q, angle: Math.atan2(Math.cos(a) * dial.ry, -Math.sin(a) * dial.rx) }); } };
    // a wall on an hour mark from ring s0 out to s1
    const mark = (a, s0, s1) => { const q0 = at(a, s0), q1 = at(a, s1), len = Math.hypot(q1.x - q0.x, q1.y - q0.y), n = Math.max(1, Math.round(len / (2 * half))), ang = Math.atan2(q1.y - q0.y, q1.x - q0.x);
      for (let m = 0; m < n; m++) spots.push({ x: q0.x + (q1.x - q0.x) * (m + 0.5) / n, y: q0.y + (q1.y - q0.y) * (m + 0.5) / n, angle: ang }); };
    ring(rings[0], 0, TAU);                                    // the ring round him, whole
    for (const kk of seen) {
      const [k, i] = kk.split(',').map(Number), a0 = i * TAU / H, a1 = (i + 1) * TAU / H;
      if (k >= bands) continue;                                // the floor outside lays nothing
      if (wall([k, i], [k, mod12(i + 1)])) mark(a1, rings[k], rings[k + 1]);
      if (!inMaze(k, mod12(i - 1))) mark(a0, rings[k], rings[k + 1]);
      if (!(door(k + 1, i) && !wall([k, i], [k + 1, i]))) ring(rings[k + 1], a0, a1);
      if (k > 0 && !inMaze(k - 1, i)) ring(rings[k], a0, a1);
    }
    const clearOf = (q, pt, gap) => { const dx = Math.cos(q.angle) * half, dy = Math.sin(q.angle) * half; return segmentDistance(pt, { x: q.x - dx, y: q.y - dy }, { x: q.x + dx, y: q.y + dy }) > gap; };
    const fine = q => this.bgOpen(q, 0) && clearOf(q, p, 1) && b.hearts.every(h => h.broken || clearOf(q, h, 0.8));
    b.dial = dial;
    b.bullets = spots.filter(fine).map(q => ({ x: enemy.x, y: enemy.y, tx: q.x, ty: q.y, from: { x: enemy.x, y: enemy.y }, angle: q.angle, hx: Math.cos(q.angle) * half, hy: Math.sin(q.angle) * half, gone: false }));
    // the hands: needles from the inner ring out, laid close, turning at mazeHands turns a second (minute, hour)
    const [minute, hour] = rule.mazeHands || [1 / 12, 1 / 48], start = this.random() * TAU;
    // (the minute hand with a gap in the middle of the outer band, rule.handGap units: odHandGap)
    const gap = rule.handGap && bands > 1 ? { lo: rings.at(-2), hi: rings.at(-1), len: rule.handGap } : null;
    for (const [spin, reach, off, cut] of [[minute, rings.at(-1), 0, gap], [hour, rings[1], Math.PI * 0.7, null]]) {
      const n = Math.ceil((reach - rings[0]) * Math.max(dial.rx, dial.ry) / (2 * half * 0.95));
      for (let m = 0; m < n; m++) {
        const hand = { m, s0: rings[0], reach, half, at: start + off, spin: spin * TAU, gap: cut };
        b.bullets.push({ ...this.odHandAt(dial, hand, 0), x: enemy.x, y: enemy.y, from: { x: enemy.x, y: enemy.y }, gone: false, hand });
      }
    }
    b.safeAt = { x: p.x, y: p.y };
    b.phase = 'scatter'; b.phaseAt = t + rule.scatterSeconds; b.hitAt = -1;
  },
  /** Each frame of the break: scatter, the stop (F2 alone moves), and time running again. */
  odBreakStep(enemy, rule, dt) {
    const b = enemy.breaking, t = this.s.time, p = this.p, reach = rule.bulletRadius + this.config.arena.playerRadius;
    if (b.failAt !== null || b.solved) return;
    if (b.hearts.every(h => h.broken)) {
      // All watches broken: time runs again with nothing in the air and the next phase begins at once (2026-11-21, the
      // user's word: no 'apparatus exposed' daze after it).
      b.solved = true; b.bullets = [];
      this.bossQuake(enemy.x, enemy.y, { power: 1.3, color: '#ffd257', reach: 3, pillar: true }); this.sense({ kind: 'boss', id: 'odStopBreak' });
      return;
    }
    // A bolt is a watch hand: it hurts along its length (bulletHalf either side, as its shadow lies), not at a point
    // (2026-11-21, the review of F2's hits: a dot at its middle let her stand on half the needle unharmed).
    const hurt = () => { b.hitAt = t; this.hurt(this.odDamage(enemy, rule.bulletDamage)); return !this.active; };
    if (b.phase === 'scatter') {
      const k = Math.min(1, 1 - (b.phaseAt - t) / rule.scatterSeconds);
      for (const q of b.bullets) { q.x = q.from.x + (q.tx - q.from.x) * k; q.y = q.from.y + (q.ty - q.from.y) * k; }
      // Where she stands clear of where the needles will land is where she goes back to (2026-11-21, the cleanup: not
      // kept through the scatter, so she could walk onto a needle's landing and have time stop with her in a wall).
      const near = this.odNeedlesNear(b, p, reach, true);
      if (!near.wall && !near.hand) b.safeAt = { x: p.x, y: p.y };
      if (t >= b.phaseAt) {
        b.phase = 'stop'; b.stopAt = t; b.stopFor = rule.stopSeconds; b.phaseAt = t + rule.stopSeconds; this.sense({ kind: 'boss', id: 'odStop' });
        if (near.wall || near.hand) Object.assign(p, b.safeAt = this.odClearSpot(b, b.safeAt, reach));
      }
      return;
    }
    if (b.phase === 'stop') {
      // The dial's hands turn on through stopped time, his own clock still running (they sweep the rings; a dodge
      // passes them, as it does not the walls).
      for (const q of b.bullets) if (q.hand && !q.gone) this.odHandAt(b.dial, q.hand, t - b.stopAt, q);
      // In stopped time the needles stand as walls (the maze, 2026-11-21): a dodge into one stops short of it, unhurt,
      // set back where she last stood clear of every needle (2026-11-21, the cleanup: never onto a hand that has swept
      // there since); walking into one hurts as before.
      const near = this.odNeedlesNear(b, p, reach);
      // (A dodge stopped at a wall is spared the hands a moment, rule.handGrace: set back beside one, she was hit at once.)
      if (p.dodge && near.wall) { Object.assign(p, b.safeAt = this.odClearSpot(b, b.safeAt || p, reach)); p.dodge = null; b.handGraceUntil = t + (rule.handGrace ?? 0); }
      else if (near.wall || (near.hand && !(b.handGraceUntil > t))) { if (!p.dodge && t >= b.hitAt + 0.5 && hurt()) return; }
      else b.safeAt = { x: p.x, y: p.y };
      if (t >= b.phaseAt) { b.phase = 'resume'; b.phaseAt = t + rule.resumeSeconds; this.sense({ kind: 'boss', id: 'odResume' }); }
      return;
    }
    if (b.phase === 'resume') {
      // Time runs again: every bolt flies on the way it was going.
      for (const q of b.bullets) if (!q.gone) { q.x += Math.cos(q.angle) * rule.resumeSpeed * dt; q.y += Math.sin(q.angle) * rule.resumeSpeed * dt; if (!this.bgOpen(q, 0)) q.gone = true; }
      if (!p.dodge && t >= b.hitAt + 0.5) { const near = this.odNeedlesNear(b, p, reach); if ((near.wall || near.hand) && hurt()) return; }
      if (t >= b.phaseAt) {
        b.attempt++;
        if (b.attempt >= rule.attempts) { b.failAt = t + rule.failWarn; b.bullets = []; return; }
        this.odScatter(enemy, b, rule); this.sense({ kind: 'boss', id: 'odStopCast' });
      }
    }
  },
};

/**
 * Each field kind's step for one frame (tickOrdenBoss; `this` is the game): (field, its caster, the caster's rules, the
 * frame's shared values). A step returns true when F2 went down (stop the frame). One table since 2026-11-21 (the
 * cleanup: it was one if-chain three hundred lines long).
 */
const OD_TICK = {
  odBolts(f, owner, ai, { p, t, R, dt, hit, mirrors }) {
    // F2's pace, smoothed, for the led bolts.
    if (f.pv && dt > 0) { f.vx = (f.vx || 0) * 0.8 + (p.x - f.pv.x) / dt * 0.2; f.vy = (f.vy || 0) * 0.8 + (p.y - f.pv.y) / dt * 0.2; } else { f.vx = 0; f.vy = 0; }
    f.pv = { x: p.x, y: p.y };
    const src = f.from;
    for (const v of f.volleys) {
      if (v.fired) continue;
      // Locked 0.3 s ahead: straight at F2, or for the later bolts where her pace (or her dodge) is taking her.
      if (v.angle === null && t >= v.at - 0.3) { const lead = v.lead ? (p.dodge ? { x: p.x + Math.cos(p.dodge.angle) * ai.needleLead * 3, y: p.y + Math.sin(p.dodge.angle) * ai.needleLead * 3 } : { x: p.x + f.vx * ai.needleLead, y: p.y + f.vy * ai.needleLead }) : p; v.angle = angleTo(src, lead); }
      if (t < v.at) continue;
      v.fired = true; this.effect('ring', src.x, src.y, '#7fe8ff', 0.5, 1, { look: 'odBurst' });
      for (let k = 0; k < v.n; k++) { const a = v.angle + (v.n > 1 ? (k - (v.n - 1) / 2) * v.spread / (v.n - 1) : 0); f.bolts.push({ x: src.x + Math.cos(a) * 0.6, y: src.y + Math.sin(a) * 0.6, angle: a, until: t + ai.needleRange / f.speed, bounces: v.bounces, fake: !!v.fake, gone: false }); }
      this.sense({ kind: 'boss', id: 'odNeedle' });
    }
    for (const b of f.bolts) {
      if (b.gone) continue;
      if (t >= b.until) { b.gone = true; continue; }
      // Bent by an ice mirror: it hangs in the crystal a moment, turning after F2, then flies.
      if (b.holdUntil && t < b.holdUntil) { b.angle = angleTo(b, p); continue; }
      const nx = b.x + Math.cos(b.angle) * f.speed * dt, ny = b.y + Math.sin(b.angle) * f.speed * dt;
      if (!this.odSolid({ x: nx, y: ny }, 0.05)) {
        // The last hour's needles glance once off a wall or a hole's edge.
        if (b.bounces-- > 0) { const flipX = !this.odSolid({ x: nx, y: b.y }, 0.05), flipY = !this.odSolid({ x: b.x, y: ny }, 0.05); b.angle = Math.atan2(flipY ? -Math.sin(b.angle) : Math.sin(b.angle), flipX ? -Math.cos(b.angle) : Math.cos(b.angle)); continue; }
        b.gone = true; this.effect('spark', b.x, b.y, '#7fe8ff', 0.25, 0.6); continue;
      }
      b.x = nx; b.y = ny;
      // An ice mirror bends a needle at F2 (once each).
      if (!b.bent) for (const m of mirrors) if (!m.done) for (const q of m.pillars) if (!q.broken && distance(b, q) < 0.6) {
        b.bent = true; b.x = q.x; b.y = q.y; b.angle = angleTo(q, p); b.holdUntil = t + 0.35; b.until = t + 0.35 + ai.needleRange / f.speed; q.flashAt = t;
        this.effect('spark', q.x, q.y - 1.5, '#9ad8f8', 0.35, 1.2); this.effect('ring', q.x, q.y, '#9ad8f8', 0.8, 1.1, { look: 'odBurst' }); this.sense({ kind: 'boss', id: 'odLane_ice' });
      }
      if (!p.dodge && distance(b, p) < ai.needleRadius + R) { b.gone = true; if (!b.fake && hit(f.damage)) return true; if (b.fake) this.effect('spark', b.x, b.y, '#9aa4b4', 0.25, 0.8); }
    }
    if (f.volleys.every(v => v.fired) && f.bolts.every(b => b.gone)) f.done = true;
  },
  odRunes(f, owner, ai, { p, t, R, hit }) {
    for (const [i, w] of f.waves.entries()) {
      if (w.done) continue;
      if (!w.spots && t >= w.show) {
        // Wave 1 and 3: a ring of six round where F2 stands (the middle safe); wave 2: the middle and a wider ring.
        const c = i === 1 && f.waves[0].centre ? f.waves[0].centre : { x: p.x, y: p.y }, a0 = this.random() * TAU, ring = r => Array.from({ length: 6 }, (_, k) => along(c, a0 + k * TAU / 6, r));
        w.centre = c; w.spots = (i === 1 ? [c, ...ring(ai.runeOuter)] : ring(ai.runeInner)).filter(at => this.odSolid(at, 0.2));
      }
      if (!w.spots || t < w.at) continue;
      w.done = true;
      // Each rune goes off in a column of gold and a ring of cyan (2026-11-20, the user's word: flashier), the floor shaking.
      for (const at of w.spots) { this.effect('ring', at.x, at.y, '#ffd257', 0.6, f.radius, { look: 'ttBurst' }); this.effect('ring', at.x, at.y, '#ffd257', 0.8, f.radius * 1.6, { look: 'odBurst' }); this.effect('ring', at.x, at.y, '#7fe8ff', 0.7, f.radius * 1.2, { look: 'odBurst' }); this.effect('spark', at.x, at.y - 1, '#ffd257', 0.5, 1.4); }
      this.sense({ kind: 'boss', id: 'odRune' }); this.sense({ kind: 'quake', power: 0.7, color: '#ffd257' });
      if (!p.dodge && w.spots.some(at => floorDistance(at, p) < f.radius + R * 0.5) && hit(f.damage)) return true;
    }
    if (f.waves.every(w => w.done)) f.done = true;
  },
  odFence(f, owner, ai, { p, t, R, dt, hit }) {
    const k = Math.min(1, (t - f.from) / (f.until - f.from)), steps = 8, r = f.r0 + (f.r1 - f.r0) * Math.ceil(k * steps) / steps;
    f.r = r; f.turn = (f.turn || 0) + f.spin * dt;
    for (const n of f.needles) if (n.out !== null && t >= n.out + f.back) { n.out = null; n.hits = 0; }
    const d = floorDistance(p, f), at = Math.atan2((p.y - f.y) / FLOOR_FLAT, p.x - f.x), open = f.needles.some(n => n.out !== null && Math.abs(wrap(at - n.angle - f.turn)) < Math.PI / 4);
    // Crossing it at all, a dodge's dash included, sets her back on the side she came from, unless she went through an
    // opening. Trying costs nothing (2026-11-21, the user's word: being thrown back hurt several times at once); only
    // still being inside when it bursts hurts.
    const inside = d < r;
    if (f.inside === undefined || open || f.burstDone) f.inside = inside;
    else if (inside !== f.inside) {
      const back = f.inside ? r - 0.6 : r + 0.6, ux = Math.cos(at), uy = Math.sin(at) * FLOOR_FLAT;
      this.move(p, f.x + ux * back - p.x, f.y + uy * back - p.y, R); f.hitAt = t;
      this.effect('spark', p.x, p.y - 0.6, '#7fe8ff', 0.3, 1); this.sense({ kind: 'block' });
    }
    if (!f.burstDone && !open && Math.abs(d - r) < 0.35 && t >= f.hitAt + 0.6 && !p.dodge) {
      f.hitAt = t;
      // Pushed back the way she came (in, unless she was already outside).
      const back = d < r ? -0.7 : 0.7, ux = Math.cos(at), uy = Math.sin(at) * FLOOR_FLAT; this.move(p, ux * back, uy * back, R);
      this.effect('spark', p.x, p.y - 0.6, '#7fe8ff', 0.3, 1); this.sense({ kind: 'block' });
    }
    if (!f.burstDone && t >= f.until) {
      f.burstDone = true; f.done = true;
      this.effect('ring', f.x, f.y, '#7fe8ff', 0.6, f.r1 + 0.5, { look: 'bgTollCyan' }); this.effect('ring', f.x, f.y, '#7fe8ff', 0.8, f.r1 + 1, { look: 'odBurst' }); this.bossQuake(f.x, f.y, { power: 0.9, color: '#7fe8ff', reach: f.r1 + 0.5 });
      if (floorDistance(p, f) < f.r1 + R && hit(f.burst)) return true;
    }
  },
  odLanes(f, owner, ai, { p, t, hit }) {
    for (const b of f.bars) {
      if (b.done || t < b.at) continue;
      b.done = true;
      const blown = b.lanes.filter((_, k) => !(b.safes || [b.safe]).includes(k)), col = OD_COLOURS[b.element];
      { const room = this.bgRoom();
        for (const r of blown) for (const u of [0.2, 0.5, 0.8]) { const x0 = Math.max(r.x0, room.left), x1 = Math.min(r.x1, room.right), y0 = Math.max(r.y0, room.top), y1 = Math.min(r.y1, room.bottom), wide = x1 - x0 > y1 - y0; this.effect('ring', wide ? x0 + (x1 - x0) * u : (x0 + x1) / 2, wide ? (y0 + y1) / 2 : y0 + (y1 - y0) * u, col, 0.8, 1.4, { look: 'odBurst' }); } }
      for (const r of blown) f.marks.push(this.odMark(r, b.element, t, ai));
      this.sense({ kind: 'boss', id: `odLane_${b.element}` }); this.sense({ kind: 'quake', power: 0.5, color: col });
      // Crossing bars: only the cell where both safe lanes meet is safe, so a blow from either counts.
      if (!p.dodge && blown.some(r => inRect(p, r)) && hit(f.damage)) return true;
      // The wind's lanes leave a wind for a moment (windPush a second, the same on the floor either way, for windSeconds),
      // blowing F2 across the lanes, away from those that blew, to the middle of this bar's nearest safe lane
      // (2026-11-21, the cleanup: it blew one way whatever the bar, away from a next bar's safe lane, and since the bars
      // all blow at once there was no next bar).
      if (b.element === 'wind') {
        const down = b.axis === 'y', at = down ? p.y : p.x, mids = (b.safes || [b.safe]).map(k => down ? (b.lanes[k].y0 + b.lanes[k].y1) / 2 : (b.lanes[k].x0 + b.lanes[k].x1) / 2);
        const to = mids.reduce((best, m) => (Math.abs(m - at) < Math.abs(best - at) ? m : best));
        this.fbField({ kind: 'odWind', owner: f.owner, axis: b.axis, to, push: ai.windPush * (down ? FLOOR_FLAT : 1), until: t + ai.windSeconds });
      }
    }
    // Fire lanes keep burning, ice lanes keep slowing (odSlow), for their after-time.
    if (t >= f.nextBurn && !p.dodge && f.marks.some(m => m.element === 'fire' && t < m.until && inRect(p, m))) { f.nextBurn = t + 0.5; if (hit(f.burn)) return true; }
    if (f.bars.every(b => b.done) && f.marks.every(m => t >= m.until)) f.done = true;
  },
  odWind(f, owner, ai, { p, t, R, dt }) {
    if (t >= f.until) { f.done = true; return; }
    if (p.dodge) return;
    const down = f.axis === 'y', step = Math.max(-f.push * dt, Math.min(f.push * dt, f.to - (down ? p.y : p.x)));
    this.move(p, down ? 0 : step, down ? step : 0, R);
  },
  odFire(f, owner, ai, { p, t, hit }) {
    const seed = f.cells[f.seedCell];
    for (const c of f.cells) if (!c.lit && t >= c.at) {
      c.lit = true;
      if (c === seed) { this.effect('ring', c.x, c.y, '#ff8a3c', 0.8, 3, { look: 'odBurst' }); this.bossQuake(c.x, c.y, { power: 1, color: '#ff8a3c', reach: 2.4, pillar: true }); this.sense({ kind: 'boss', id: 'odLane_fire' }); }
      else if (this.random() < 0.3) this.effect('ring', c.x, c.y, '#ff8a3c', 0.8, 1.2, { look: 'odBurst' });
    }
    const on = f.cells.filter(c => c.lit && t < c.until);
    const under = c => floorDistance(p, c) < this.odFireReach(c, t);
    if (!p.dodge && t >= f.nextHit && on.some(under)) { const fresh = on.some(c => under(c) && t - c.at < 0.3); f.nextHit = t + 0.5; if (hit(fresh ? f.damage : f.burn)) return true; }
    if (f.cells.every(c => c.lit && t >= c.until)) f.done = true;
  },
  odMirror(f, owner, ai, { t }) { if (t >= f.until || f.pillars.every(q => q.broken)) { f.done = true; for (const q of f.pillars) if (!q.broken) this.effect('spark', q.x, q.y - 1, '#9ad8f8', 0.4, 1.4); } },
  odChain(f, owner, ai, { p, t, R, hit }) {
    // Each strike aimed where F2 stands as its warning starts.
    for (const st of f.strikes) if (st.x === undefined && t >= st.show) { const at = this.odSolid(p, 0.3) ? { x: p.x, y: p.y } : this.odSpot(p, 0.3); st.x = at.x; st.y = at.y; }
    for (const [i, st] of f.strikes.entries()) {
      if (st.done || t < st.at) continue;
      st.done = true; f.rods[i] = { x: st.x, y: st.y };
      this.effect('ring', st.x, st.y, '#ffe066', 0.8, f.radius * 1.4, { look: 'odBurst' }); this.effect('spark', st.x, st.y - 2, '#ffe066', 0.35, 1.2);
      this.sense({ kind: 'boss', id: 'odLane_lightning' }); this.sense({ kind: 'quake', power: 0.5, color: '#ffe066' });
      if (f.rods[i - 1]) f.links.push({ a: i - 1, b: i, at: t, struckAt: t, until: t + f.linger, done: true });
      if (!p.dodge && floorDistance(st, p) < f.radius + R && hit(f.damage)) return true;
    }
    // The live bolts between the rods: touching one hurts, at most every half second.
    if (t >= f.nextHit && !p.dodge && f.links.some(ln => t < ln.until && segmentDistance(p, f.rods[ln.a], f.rods[ln.b]) <= f.width + R)) { f.nextHit = t + 0.5; if (hit(f.linkDamage)) return true; }
    if (f.strikes.every(st => st.done) && f.links.every(ln => t >= ln.until)) f.done = true;
  },
  odDefer(f, owner, ai, { t }) { if (!f.done && t >= f.at) { f.done = true; this.odEcho(owner, ai, f.spell, t); } },
  odNova(f, owner, ai, { p, t, R, hit }) {
    for (const ring of f.rings) {
      if (ring.done || t < ring.at) continue;
      if (!ring.rang) { ring.rang = true; this.sense({ kind: 'boss', id: 'odNovaRing' }); this.sense({ kind: 'quake', power: 0.6, color: '#9ad8f8' }); }
      const before = ring.r; ring.r = Math.min(f.range, (t - ring.at) * f.speed);
      const d = floorDistance(f, p), a = Math.atan2((p.y - f.y) / FLOOR_FLAT, p.x - f.x), open = ring.gaps.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) <= f.half);
      if (!ring.hit && !p.dodge && !open && d >= before - f.width - R && d <= ring.r + f.width + R) { ring.hit = true; f.slowUntil = t + f.slowFor; this.effect('ring', p.x, p.y, '#9ad8f8', 0.6, 1, { look: 'odBurst' }); if (hit(f.damage)) return true; }
      if (ring.r >= f.range) ring.done = true;
    }
    if (f.rings.every(r => r.done) && t >= f.slowUntil) f.done = true;
  },
  odVortex(f, owner, ai, { p, t, R, dt, hit }) {
    if (t >= f.until) { f.done = true; this.effect('dodge', f.x, f.y, '#8fe8c8', 0.4, 2); this.effect('ring', f.x, f.y, '#8fe8c8', 0.8, 2.2, { look: 'odBurst' }); return; }
    if (p.dodge) return;
    const d = floorDistance(p, f), k = Math.min(1, (t - f.from) / 0.5), a = Math.atan2(f.y - p.y, f.x - p.x);
    if (d > 0.1) this.move(p, Math.cos(a) * f.pull * k * dt, Math.sin(a) * f.pull * k * dt, R);
    if (d < f.eye && t >= f.nextHit) {
      f.nextHit = t + 0.8; this.effect('ring', f.x, f.y, '#8fe8c8', 0.4, 1.4, { look: 'bgTollCyan' });
      const out = Math.atan2(p.y - f.y, p.x - f.x) || 0; this.move(p, Math.cos(out) * 1.6, Math.sin(out) * 1.6, R);
      if (hit(f.damage)) return true;
    }
  },
  odQuartet(f, owner, ai, { p, t, hit }) {
    if (f.blown || t < f.at) return;
    f.blown = true; f.done = true;
    const lit = f.quads.filter(q => q.element), room = this.bgRoom();
    // What is left burning and frozen plays out as the lanes' after-effects do.
    this.fbField({ kind: 'odLanes', owner: f.owner, bars: [], marks: lit.map(q => this.odMark(q, q.element, t, ai)), damage: f.damage, burn: f.burn, nextBurn: t + 0.5, slow: ai.iceSlow });
    for (const q of lit) {
      this.sense({ kind: 'boss', id: `odLane_${q.element}` });
      const mx = (Math.max(q.x0, room.left) + Math.min(q.x1, room.right)) / 2, my = (Math.max(q.y0, room.top) + Math.min(q.y1, room.bottom)) / 2, col = OD_COLOURS[q.element];
      this.effect('ring', mx, my, col, 0.8, 5, { look: 'odBurst' });
      for (const [dx, dy] of [[-3, -1.2], [3, -1.2], [-3, 1.2], [3, 1.2]]) this.effect('ring', mx + dx, my + dy, col, 0.8, 1.6, { look: 'odBurst' });
      this.bossQuake(mx, my, { power: 1.2, color: col, reach: 4, pillar: true });
    }
    this.sense({ kind: 'quake', power: 1, color: '#ffd257' });
    if (!p.dodge && lit.some(q => inRect(p, q)) && hit(f.damage)) return true;
  },
  odOrbs(f, owner, ai, { p, t, R, dt, hit }) {
    for (const o of f.orbs) {
      if (o.state === 'gone') continue;
      if (o.state === 'chase') {
        if (t >= f.until) { o.state = 'gone'; this.effect('spark', o.x, o.y, '#7fe8ff', 0.3, 0.8); continue; }
        const want = angleTo(o, p); o.angle += Math.max(-ai.orbTurn * dt, Math.min(ai.orbTurn * dt, wrap(want - o.angle)));
        o.x += Math.cos(o.angle) * ai.orbSpeed * dt; o.y += Math.sin(o.angle) * ai.orbSpeed * dt;
        if (!p.dodge && distance(o, p) < ai.orbRadius + R) { o.state = 'gone'; this.effect('ring', o.x, o.y, o.dark ? '#5a3a7a' : '#7fe8ff', 0.4, 1, { look: 'bgTollCyan' }); if (hit(f.damage)) return true; }
      } else if (o.state === 'back') {
        // Struck back: straight home into him.
        const a = angleTo(o, owner); o.x += Math.cos(a) * ai.orbBack * dt; o.y += Math.sin(a) * ai.orbBack * dt;
        if (distance(o, owner) < owner.radius + 0.3) { o.state = 'gone'; this.effect('ring', owner.x, owner.y, '#ffd257', 0.4, 1.2, { look: 'ttBurst' }); this.effect('ring', owner.x, owner.y, '#ffd257', 0.8, 1.6, { look: 'odBurst' }); this.hitEnemy(owner, owner.maxHp * ai.orbReturn, { exact: true, color: '#ffd257' }); if (!this.active) return true; }
      }
    }
    if (f.orbs.every(o => o.state === 'gone')) f.done = true;
  },
  odMarch(f, owner, ai, { p, t, R, hit }) {
    for (const l of f.lines) {
      if (t < l.start) continue;
      // Each rank sets off with Brass's march (2026-11-21: the golden march was the one spell with no sound at all).
      if (!l.rang) { l.rang = true; this.sense({ kind: 'boss', id: 'odMarchStep' }); }
      l.y = f.top + (t - l.start) * f.speed;
      if (l.y > f.bottom) { l.over = true; continue; }
      if (!l.hit && !p.dodge && Math.abs(p.y - l.y) < 0.45 + R && Math.abs(p.x - l.gap) > f.half) { l.hit = true; if (hit(f.damage)) return true; }
    }
    if (f.lines.every(l => l.over)) f.done = true;
  },
  odPress(f, owner, ai, { p, t, hit }) {
    if (f.done || t < f.at) return;
    f.done = true;
    for (const c of f.cells) if (!c.safe) { this.effect('ring', (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, '#ffd257', 0.6, 1.4, { look: 'pressSlam' }); this.effect('ring', (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, '#ffd257', 0.8, 1.2, { look: 'odBurst' }); }
    this.sense({ kind: 'heavy' }); this.sense({ kind: 'boss', id: 'odPress' });
    if (!p.dodge && f.cells.some(c => !c.safe && inRect(p, c)) && hit(f.damage)) return true;
  },
  odRings(f, owner, ai, { p, t, R, hit }) {
    for (const b of f.bands) {
      if (b.done || t < b.at) continue;
      b.done = true;
      const d = floorDistance(f, p);
      this.effect('ring', f.x, f.y, '#ffd257', 0.55, b.hi, { look: 'bgToll' }); this.effect('ring', f.x, f.y, '#ffd257', 0.8, Math.max(1.4, b.hi * 0.5), { look: 'odBurst' }); this.sense({ kind: 'boss', id: 'bgToll' });
      // The band itself goes up in gold all round its ring.
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + b.hi, at = along(f, a, (b.lo + b.hi) / 2); if (this.odSolid(at, 0.1)) this.effect('ring', at.x, at.y, '#ffd257', 0.7, 1, { look: 'odBurst' }); }
      this.sense({ kind: 'quake', power: 0.6, color: '#ffd257' }); f.rangAt = t;
      if (!p.dodge && d >= b.lo - R && d < b.hi + R * 0.5 && hit(f.damage)) return true;
    }
    if (f.bands.every(b => b.done)) f.done = true;
  },
  odClones(f, owner, ai, { s, p, t }) {
    const bodies = f.ids.map(id => s.enemies.find(e => e.id === id)).filter(e => e && e.hp > 0);
    if (f.swap && !f.swap.from && t >= f.swap.at) {
      const other = s.enemies.find(e => e.id === f.swap.with && e.hp > 0);
      if (other) f.swap.from = [{ x: owner.x, y: owner.y }, { x: other.x, y: other.y }];
      else f.swap = null;
    }
    if (f.swap?.from) {
      // They slide past each other to swap places (ease in and out over the swap).
      const other = s.enemies.find(e => e.id === f.swap.with), k = Math.min(1, (t - f.swap.at) / (f.swap.until - f.swap.at)), e = k * k * (3 - 2 * k), [a, b] = f.swap.from;
      Object.assign(owner, { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e });
      if (other && other.hp > 0) Object.assign(other, { x: b.x + (a.x - b.x) * e, y: b.y + (a.y - b.y) * e });
    }
    if (f.done || t < f.cast) return;
    f.done = true;
    // Every one of them throws a volley at F2; only the real one's bolts hurt.
    for (const body of bodies) {
      this.odVolleys(owner, body, [0, 1, 2].map(i => t + i * ai.needleGap), this.odDamage(owner, ai.cloneDamage), ai.needleSpeed, { fake: body.id !== owner.id });
      body.facing = angleTo(body, p);
    }
  },
  odHoles(f, owner, ai, { p, t, hit }) {
    for (const h of f.pieces) {
      if (!h.fell && t >= h.fall) { h.fell = true; this.effect('ring', (h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, '#c9b48f', 0.6, 1.2, { look: 'quake' }); }
      if (t >= h.back && !h.backDone) { h.backDone = true; this.effect('dodge', (h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, '#c9b48f', 0.4, 1.4); }
    }
    // Standing where the floor is gone: she drops through, and is set back on the nearest floor. The pit is the oval drawn
    // in its piece (2026-11-24: the piece's corners, a fifth of it, dropped her where no pit showed).
    const inPit = h => { const rx = (h.x1 - h.x0) / 2, ry = (h.y1 - h.y0) / 2; return ((p.x - h.x0 - rx) / rx) ** 2 + ((p.y - h.y0 - ry) / ry) ** 2 <= 1; };
    const under = f.pieces.find(h => h.fell && t < h.back && inPit(h));
    if (under && !p.dodge && t >= f.hitAt + 0.8) {
      f.hitAt = t;
      const exits = [{ x: under.x0 - 0.6, y: p.y }, { x: under.x1 + 0.6, y: p.y }, { x: p.x, y: under.y0 - 0.5 }, { x: p.x, y: under.y1 + 0.5 }].filter(e => this.odSolid(e, 0.3)).sort((a, b) => distance(a, p) - distance(b, p));
      if (exits[0]) Object.assign(p, exits[0]);
      this.sense({ kind: 'boss', id: 'odFall' });
      if (hit(f.damage)) return true;
    }
    if (f.pieces.every(h => t >= h.back)) f.done = true;
  },
  odCannon(f, owner, ai, { t }) { if (t >= f.until) f.done = true; },
  odSigil(f, owner, ai, { p, t, dt, hit }) {
    // How far she went in the last moment decides 'moving' (a dodge always counts as moving).
    f.moved = f.moved * Math.max(0, 1 - dt * 6) + distance(p, f.last); f.last = { x: p.x, y: p.y };
    if (t < f.at) return;
    f.done = true;
    const moving = !!p.dodge || f.moved > 0.06;
    this.sense({ kind: 'boss', id: 'odSigilDone' });
    if (f.mode === 'stop' ? moving : !moving) { this.effect('ring', p.x, p.y, '#7fe8ff', 0.5, 1.2, { look: 'bgTollCyan' }); this.effect('ring', p.x, p.y, '#7fe8ff', 0.8, 1.3, { look: 'odBurst' }); if (hit(f.damage)) return true; }
    else this.effect('spark', p.x, p.y - 1, '#7fe0a0', 0.4, 1);
  },
  odLastHour(f, owner, ai, { p, t, hit }) {
    for (const [i, toll] of f.tolls.entries()) {
      if (toll.done || t < toll.at) continue;
      const last = f.tolls.length - 1;
      toll.done = true; this.sense({ kind: 'boss', id: i === last ? 'odLastHourStrike' : 'bgToll' });
      // Each toll a column of gold over every safe spot, the last a great one over him.
      for (const at of f.safe) this.effect('ring', at.x, at.y, '#ffd257', 0.8, i < last ? 0.9 : 1.6, { look: 'odBurst' });
      if (i < last) { this.sense({ kind: 'quake', power: 0.25 + i * 0.55 / Math.max(1, last), color: '#ffd257' }); continue; }
      this.effect('ring', owner.x, owner.y, '#ffd257', 0.8, 4, { look: 'odBurst' });
      this.bossQuake(owner.x, owner.y, { power: 1.6, color: '#ffd257', reach: 6, pillar: true });
      if (!f.safe.some(at => floorDistance(at, p) < f.radius) && hit(f.damage)) return true;
    }
    if (f.tolls.every(x => x.done)) f.done = true;
  },
};
