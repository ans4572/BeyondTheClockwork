// Chapter 3's region boss Belgard, the belfry guardian (docs/design/clock-tower-boss-drafts.md 2-D, 'the greatsword
// loyalist'): a silent, heavy knight with a bell for a chest and a greatsword, Orden's right hand. No words before a
// blow: his pose and the floor say what comes. Mixed into Game; factory-bosses.js hands his tells, steps, blows and the
// break over here (bgAI), tickFactoryBoss calls tickBellBoss each frame. Numbers live in slice.json bossAI.bellguard.
//
// Phase 1 (round), the loyal knight: the three-step toll (inner disc, outer ring, middle ring), the greatsword's combo,
// slam and spin, the grab, ground cracks, the bell cage, the bell weight swinging across the room, and archers called in
// from two sides.
// At half health the forged orders (bgBreakStart, 2026-11-19, the user's pick after the pillars and then a ring rally
// were too easy or too like other games): tuning pillars round the floor carry Orden's orders in his pitch, and Belgard
// answers the pitch before his own eyes. A real order lights the pillar nearest F2 and he charges there and strikes round
// it; a wrench blow on a pillar while its needle stands in the middle rings Orden's pitch, a forged order he turns to at
// once, and striking the forged pillar cracks the bell in his chest (`need` cracks break the shield). Off the pitch it
// clangs, and he sees through it and charges F2.
// Phase 2 (round2), the puppet: Orden takes hold (cyan eyes, aura and strings, and his words as he does). Every cut leaves
// a cyan afterimage for a while, archers come from all four sides, and Orden's power adds the great sweep's crescent, a
// phantom flying sword, a rain of swords, tuning needles round F2 and the last toll round his planted sword. While his
// sword flies and while it stands planted he fights barehanded (the 'belgard-bare' clips).
import { fitsMap } from './map-geometry.js';
import { SUMMON_RISE_SECONDS } from './game.js';
import { distance, floorDistance, segmentDistance, inCone, FLOOR_FLAT, angleTo, wrap, along, ray } from './math.js';

const TAU = Math.PI * 2;
// (angleTo, wrap, along and ray come from math.js since 2026-11-21: each boss file kept its own copy.)
/** The clip each blow plays (art/animations/mobs/clock-tower/clips/belgard-*). */
const POSE = { bgPendulum: 'command', bgCrescent: 'swing', bgPunch: 'attack', bgCombo: 'swing', bgCombo2: 'swing', bgCombo3: 'swing', bgSpin: 'swing', bgSlam: 'slam', bgCracks: 'slam', bgGrab: 'grab', bgRings: 'plant', bgLastToll: 'command', bgArchers: 'command', bgCage: 'command', bgFlySword: 'command', bgSwordRain: 'command', bgNeedles: 'command' };
/** bgRoom's box for each floor outline, worked out once (2026-11-21, the code review: sorted again on every call). */
const ROOMS = new WeakMap();

export const bellBoss = {
  /** Belgard's rules, if `enemy` is him. */
  bgAI(enemy) { return enemy?.boss && enemy.type === 'bellguard' ? this.config.bossAI.bellguard : null; },
  /** A blow of his worth `k` times his attack, as weakened as he is now. */
  bgDmg(enemy, k) { return Math.round(this.weakened(enemy, enemy.damage * k)); },
  /** Phase 2 from the moment his shield breaks: Orden holds him (the cyan eyes and aura are drawn from this). */
  bgPuppet(enemy) { return !!enemy.breaksDone?.length; },
  /** The middle of his floor: where he first stood. */
  bgCentre(enemy) { return enemy.home || { x: enemy.x, y: enemy.y }; },
  /** The floor's box (the walkable outline's bounds, without the entry corridor and the stair). */
  bgRoom() {
    const pts = this.map?.walkable || [], [w, h] = this.map?.size || [36, 18];
    if (!pts.length) return { left: 1, right: w - 1, top: 1, bottom: h - 1 };
    // (one box shared by every caller: read it, never change it)
    let box = ROOMS.get(pts);
    if (!box) {
      const xs = pts.map(p => p[0]).sort((a, b) => a - b), ys = pts.map(p => p[1]).sort((a, b) => a - b);
      ROOMS.set(pts, box = { left: xs[1] + 1, right: xs.at(-2) - 1, top: ys[1] + 0.6, bottom: ys.at(-1) - 0.6 });
    }
    return box;
  },
  bgOpen(at, room = 0.5) { return !this.map?.walkable || fitsMap(at.x, at.y, room, this.map); },

  /** What a tell needs when it starts: its pose, and where it will land, chosen now so the warning shows it. */
  bgTell(enemy, tell) {
    const ai = this.bgAI(enemy), p = this.p;
    enemy.tellPose = POSE[tell.type] || null;
    if (this.bgPuppet(enemy) && tell.type !== 'bgCombo2' && tell.type !== 'bgCombo3') tell.until = tell.started + (tell.until - tell.started) * ai.puppetTell;
    if (tell.type === 'bgCracks') tell.angles = [-1, 0, 1].map(k => tell.angle + k * ai.crackSpread * Math.PI / 180);
    if (tell.type === 'bgCage') tell.at = { x: p.x, y: p.y };
    // The third cut lunges: how far he will step is fixed as it begins, so the warning stands where the blow lands.
    if (tell.type === 'bgCombo3') tell.step = Math.min(ai.comboLastStep, Math.max(0, distance(enemy, p) - 0.9));
    else if (tell.type === 'bgCombo' || tell.type === 'bgCombo2') tell.step = Math.min(ai.comboStep, Math.max(0, distance(enemy, p) - 1.2));
    if (tell.type === 'bgGrab') tell.end = { x: enemy.x + Math.cos(tell.angle) * ai.grabReach, y: enemy.y + Math.sin(tell.angle) * ai.grabReach };
  },

  /** Each step: blows still to come, standing still for a held pattern, else walking to his distance and the next blow. */
  bgStep(enemy, dt) {
    const ai = this.bgAI(enemy), t = this.s.time, p = this.p;
    enemy.bgAura = this.bgPuppet(enemy);
    // The moment Orden takes him over (2026-11-20, the user's word: nothing showed it): his voice, a cyan flash through the
    // room, and from then on the strings he works him by, pulled taut on every blow (bell-boss-draw.js).
    if (enemy.bgAura && !enemy.puppetAt) {
      enemy.puppetAt = t;
      // A held moment for it (2026-11-21, the chapter 3 review: the line went by as a notice while arrows flew): his words
      // as a caption across the screen (drawBellOver), nobody in the room starts a blow and nothing lands on F2 meanwhile.
      for (const e of this.s.enemies) if (e !== enemy && e.hp > 0) e.ready = Math.max(e.ready, t + 1.6);
      this.p.invulnerableUntil = Math.max(this.p.invulnerableUntil || 0, t + 1.6);
      this.sense({ kind: 'quake', power: 1.2, color: '#7fe8ff' }); this.sense({ kind: 'boss', id: 'bgOrder' });
      this.effect('ring', enemy.x, enemy.y, '#7fe8ff', 0.8, 4, { look: 'bgTollCyan' });
      enemy.busyUntil = Math.max(enemy.busyUntil || 0, t + 1.2); enemy.ready = Math.max(enemy.ready, t + 1.2);
    }
    // A cut's step in glides over a moment instead of jumping (2026-11-20, the user's word: the combo moved stiffly).
    const lunge = enemy.bgLunge;
    if (lunge) { const d = Math.min(lunge.left, lunge.speed * dt); this.move(enemy, Math.cos(lunge.angle) * d, Math.sin(lunge.angle) * d); lunge.left -= d; if (lunge.left <= 1e-3) enemy.bgLunge = null; }
    // While his sword flies (bgFlySword) he fights barehanded: the barehanded clips (PixelLab state 'Barehanded').
    const bare = t < (enemy.bareUntil || 0);
    enemy.sprite = bare ? 'belgard-bare' : 'belgard';
    // The next cut of a combo waits for the last one's follow-through (comboFollow), so the clip is not cut short.
    if (enemy.followup && !enemy.tell && t >= (enemy.followup.start ?? 0)) {
      const next = enemy.followup; enemy.followup = null;
      this.beginEnemyTell(enemy, next.type, Math.max(0.1, next.at - t)); return true;
    }
    if (enemy.tell || t < (enemy.busyUntil || 0)) return true;
    const d = distance(enemy, p), a = angleTo(enemy, p);
    enemy.facing = a;
    if (bare) {
      // Slow, heavy steps after F2 and a short punch when she is in reach; no other pattern until the sword comes back.
      if (t >= enemy.ready && d < ai.punchReach + ai.punchStep * 0.5) { this.beginEnemyTell(enemy, 'bgPunch'); return true; }
      if (d > ai.punchReach * 0.7) { const step = ai.speed * ai.bareSpeed * dt, way = d > 2 ? this.flowField?.heading(enemy.x, enemy.y) ?? a : a; this.move(enemy, Math.cos(way) * step, Math.sin(way) * step); }
      return true;
    }
    // After laying a floor attack he comes after F2 while it plays out (2026-11-19, the user's word: standing by while
    // it rang was easy): quicker steps, and his next blows are combos, the round waiting till it is over.
    const chasing = t < (enemy.floorChaseUntil || 0);
    if (t >= enemy.ready) {
      // Too close for comfort: a spin clears the space round him, at most once in a while.
      if (d < ai.spinNear && t >= (enemy.spinReady || 0)) { enemy.spinReady = t + ai.spinEvery; this.beginEnemyTell(enemy, 'bgSpin'); return true; }
      if (chasing) { if (d < ai.comboRange + 1.2) { this.beginEnemyTell(enemy, 'bgCombo'); return true; } }
      else {
      const round = this.bgPuppet(enemy) ? ai.round2 : ai.round, step = round[(enemy.bgStep = (enemy.bgStep ?? -1) + 1) % round.length];
      this.beginEnemyTell(enemy, step); return true;
      }
    }
    if (d > (chasing ? 1.2 : ai.stand + 0.3)) {
      const step = ai.speed * (this.bgPuppet(enemy) ? ai.puppetSpeed : 1) * (chasing ? ai.floorChaseSpeed : 1) * dt, way = d > 2 ? this.flowField?.heading(enemy.x, enemy.y) ?? a : a;
      this.move(enemy, Math.cos(way) * step, Math.sin(way) * step);
    }
    return true;
  },

  /** After a floor attack: he comes after F2 for `seconds` (bgStep), his next blow soon. */
  bgChase(enemy, seconds) {
    const ai = this.bgAI(enemy), t = this.s.time;
    enemy.floorChaseUntil = t + seconds; enemy.busyUntil = Math.min(enemy.busyUntil || 0, t + 0.2); enemy.ready = t + ai.floorChaseReady;
  },
  /** His blows. Returns true when the tell was one of his. */
  bgExecute(enemy, tell) {
    const ai = this.bgAI(enemy);
    if (!ai) return false;
    const p = this.p, t = this.s.time, R = this.config.arena.playerRadius, puppet = this.bgPuppet(enemy);
    // When his last blow went off: Orden's strings stay taut a moment after it (bell-boss-draw.js; 2026-11-21, nothing set it).
    enemy.lastBlowAt = t;
    const hit = (k = 1) => !p.dodge && this.hurt(this.bgDmg(enemy, k));
    const hold = until => { enemy.busyUntil = until; enemy.ready = Math.max(enemy.ready, until); };
    switch (tell.type) {
      case 'bgCombo': case 'bgCombo2': case 'bgCombo3': {
        // Two quick cuts stepping in, the third a beat late: a lunging cleave, wider and further (2026-11-19, the user's
        // word: a bigger reach and a bigger step in), its step fixed as it began (bgTell).
        const last = tell.type === 'bgCombo3', range = last ? ai.comboLastRange : ai.comboRange, degrees = last ? ai.comboLastDegrees : ai.comboDegrees;
        // The cut lands from where his step ends; the step itself glides there over comboGlide (bgStep).
        const step = tell.step;
        const from = { x: enemy.x + Math.cos(tell.angle) * step, y: enemy.y + Math.sin(tell.angle) * step };
        if (step > 0) enemy.bgLunge = { angle: tell.angle, left: step, speed: step / (last ? ai.comboGlide * 1.5 : ai.comboGlide) };
        if (inCone(from, p, tell.angle, range + R, degrees)) hit(last ? ai.comboLastDamage : ai.comboDamage);
        this.bgCut(enemy, { shape: 'sector', x: from.x, y: from.y, angle: tell.angle, range, degrees });
        if (last) this.bgImpact(ray(from, tell.angle, range * 0.55), 1.2, {}, enemy);
        const start = t + ai.comboFollow;
        if (tell.type === 'bgCombo') enemy.followup = { type: 'bgCombo2', start, at: start + ai.comboGap };
        if (tell.type === 'bgCombo2') enemy.followup = { type: 'bgCombo3', start, at: start + ai.comboGap + ai.comboLastDelay };
        if (!last) enemy.busyUntil = Math.max(enemy.busyUntil || 0, start);
        enemy.ready = t + (last ? enemy.recovery : 0.1);
        return true;
      }
      case 'bgSpin':
        if (floorDistance(enemy, p) < ai.spinRadius + R) hit(ai.spinDamage);
        this.bgCut(enemy, { shape: 'ring', x: enemy.x, y: enemy.y, radius: ai.spinRadius });
        return true;
      case 'bgPendulum': {
        // The bell weight (2026-11-21, the user's pick, in place of the tuning resonance): a great bell on its chain swings
        // across the whole room, pendulumPasses times, each pass aimed at the row F2 stands in when its warning starts.
        // He fights on while it swings.
        const room = this.bgRoom(), passes = [];
        for (let i = 0; i < ai.pendulumPasses; i++) {
          const start = t + ai.pendulumWarn + i * (ai.pendulumPass + ai.pendulumGap);
          passes.push({ warnAt: start - ai.pendulumWarn, start, end: start + ai.pendulumPass, dir: i % 2 ? -1 : 1, y: null, hit: false });
        }
        this.fbField({ kind: 'bgPendulum', owner: enemy.id, passes, left: room.left - 1.5, right: room.right + 1.5, top: room.top, bottom: room.bottom, radius: ai.pendulumRadius, damage: this.bgDmg(enemy, ai.pendulumDamage), puppet });
        return true;
      }
      case 'bgCrescent': {
        // The great sweep (2026-11-21, the user's word: under half health a big swing that throws a big blade wave): a
        // crescent of blade light flies out over the warned fan, widening as it goes. Dodge through it, or out of its arc.
        this.fbField({ kind: 'bgCrescent', owner: enemy.id, x: enemy.x, y: enemy.y, angle: tell.angle, r: ai.crescentStart, from: ai.crescentStart, range: ai.crescentRange, speed: ai.crescentSpeed, half: ai.crescentDegrees * Math.PI / 360, width: ai.crescentWidth, damage: this.bgDmg(enemy, ai.crescentDamage), hit: false, puppet });
        this.sense({ kind: 'quake', power: 0.8, color: puppet ? '#7fe8ff' : '#fff4d6' });
        return true;
      }
      case 'bgSlam': {
        // The blade comes down just ahead of him, and a wave runs on along the floor from there.
        const at = ray(enemy, tell.angle, ai.slamAhead);
        if (!p.dodge && floorDistance(at, p) < ai.slamRadius + R) hit(ai.slamDamage);
        this.bgImpact(at, ai.slamRadius, { power: 1, pillar: true }, enemy);
        this.fbField({ kind: 'bgWave', owner: enemy.id, x: at.x, y: at.y, angle: tell.angle, front: 0, length: ai.waveLength, speed: ai.waveSpeed, width: ai.waveWidth, damage: this.bgDmg(enemy, ai.waveDamage), hit: false, puppet });
        return true;
      }
      case 'bgGrab': {
        // A heavy hand reaching straight out (2026-11-18, the user's pick): caught, F2 is lifted, thrown across the room
        // and his bell comes down over her where she lands, to be struck apart from inside (the cage's rules). Missed, he
        // goes straight on: no opening (the user's word).
        this.effect('beam', enemy.x, enemy.y, '#c9b27a', 0.35, 1, { targetX: tell.end.x, targetY: tell.end.y, look: 'bgGrabHand' });
        if (!p.dodge && segmentDistance(p, enemy, tell.end) <= ai.grabWidth + R && this.hurt(this.fbFixed(ai.grabDamage))) {
          const hand = ray(enemy, tell.angle, 1.3), centre = this.bgCentre(enemy);
          // Thrown on past him the way he faced, as far as the floor allows, kept off the walls.
          const far = this.fbFloor(enemy.x + Math.cos(tell.angle) * ai.grabThrowUnits, enemy.y + Math.sin(tell.angle) * ai.grabThrowUnits, centre, ai.cageRadius + 0.4);
          const end = t + ai.grabLift + ai.grabThrow, until = end + ai.grabDrop + 0.05;
          p.stunUntil = Math.max(p.stunUntil || 0, until); p.heldUntil = Math.max(p.heldUntil || 0, until); p.attack = null; p.charging = null;
          // (heldUntil kept, on the throw and on him, to let her go if his death or his shield cuts the throw short: bgLetGo)
          this.fbField({ kind: 'bgThrow', owner: enemy.id, hand, to: far, lift: t + ai.grabLift, end, from: null, heldUntil: until }); enemy.bgHeldUntil = until;
          this.effect('ring', p.x, p.y, '#c9b27a', 0.4, 1.0, { look: 'quake' }); this.sense({ kind: 'heavy' }); this.sense({ kind: 'boss', id: 'bgGrabHit' });
          hold(until + ai.cageSeconds + 0.3);
        }
        return true;
      }
      case 'bgCracks': {
        // Three cracks run out from the planted blade toward F2 and burst along their length a moment later.
        const lines = tell.angles.map(a => ({ a, end: ray(enemy, a, ai.crackLength) }));
        this.fbField({ kind: 'bgCracks', owner: enemy.id, x: enemy.x, y: enemy.y, lines, from: t, at: t + ai.crackWarn, width: ai.crackWidth, damage: this.bgDmg(enemy, ai.crackDamage) });
        this.bgImpact(enemy, 1.6, { power: 0.9 }, enemy);
        this.bgChase(enemy, ai.crackWarn + 0.6);
        return true;
      }
      case 'bgRings': {
        // The three-step toll round the planted sword: the inner disc, then the outer ring, then the middle one.
        const [r0, r1, r2] = ai.ringRadii, start = t + ai.ringWarn;
        const bands = [[0, r0], [r1, r2], [r0, r1]].map(([lo, hi], i) => ({ lo, hi, at: start + i * ai.ringGap, done: false }));
        this.fbField({ kind: 'bgRings', owner: enemy.id, x: enemy.x, y: enemy.y, bands, from: t, damage: this.fbFixed(ai.ringDamage) });
        // The sword going into the floor (2026-11-19): cracks, chips and a column of light where it stands.
        // (Where the blade stands in his plant pose: a step ahead of him, not under his body.)
        { const at = ray(enemy, tell.angle ?? enemy.facing, 0.8); this.bgStrike(at, 1.6, puppet); this.bossQuake(at.x, at.y, { power: 0.8, color: puppet ? '#7fe8ff' : '#ffd88a', reach: 1.8, pillar: true }); }
        // He plants and comes after F2 while they ring (2026-11-18: standing still the whole toll was an opening;
        // 2026-11-19: and walking slowly after her was still easy).
        hold(t + 0.6); this.bgChase(enemy, ai.ringWarn + ai.ringGap * 2 + 0.3);
        return true;
      }
      case 'bgArchers': this.bgArchers(enemy, puppet ? 4 : ai.archerSides); return true;
      case 'bgCage': {
        // Three bells (2026-11-20, the user's pick): each one's shadow follows F2 until cageAim before it lands, cageGap
        // apart; the last is wide (cageWide), too wide to walk out from under in time, so it has to be dodged. Caught under
        // one, the rest are called off and he knocks on it from outside (bgCageStep): break it quickly.
        const chain = t;
        for (let i = 0; i < 3; i++) {
          const land = t + ai.cageFall + i * ai.cageGap;
          this.fbField({ kind: 'bgCage', owner: enemy.id, x: p.x, y: p.y, radius: i === 2 ? ai.cageWide : ai.cageRadius, land, aimAt: land - ai.cageAim, chain, trapped: false, hits: 0, until: null, done: false });
        }
        // He waits through the falls, and on only while she is shut in (bgCageStep): missed, he fights on (no opening).
        hold(t + ai.cageFall + 2 * ai.cageGap + 0.4);
        return true;
      }
      case 'bgFlySword':
        // His blade, in Orden's hold, leaves his hands and hunts F2 for a while; he follows her with his fists (bgStep).
        this.fbField({ kind: 'bgSword', owner: enemy.id, ...ray(enemy, tell.angle, 1), angle: tell.angle, from: t, until: t + ai.flySeconds, nextHit: 0, damage: this.bgDmg(enemy, ai.flyDamage), dashDamage: this.bgDmg(enemy, ai.flyDashDamage) });
        enemy.bareUntil = t + ai.flySeconds; enemy.ready = t + 0.8;
        return true;
      case 'bgPunch': {
        const step = Math.min(ai.punchStep, Math.max(0, distance(enemy, p) - 1));
        this.move(enemy, Math.cos(tell.angle) * step, Math.sin(tell.angle) * step);
        if (inCone(enemy, p, tell.angle, ai.punchReach + R, ai.punchDegrees)) hit(ai.punchDamage);
        this.effect('ring', enemy.x + Math.cos(tell.angle) * ai.punchReach * 0.7, enemy.y + Math.sin(tell.angle) * ai.punchReach * 0.7, '#e8e2d2', 0.5, 0.7, { look: 'bgSlam' });
        enemy.ready = t + ai.punchRecovery;
        return true;
      }
      case 'bgSwordRain': this.bgSwordRain(enemy, ai); this.bgChase(enemy, ai.rainSeconds + ai.rainWarn); return true;
      case 'bgNeedles': {
        // Orden's tuning needles, borrowed and slower: four land round F2 one by one, then the ring between them blows.
        const c = { x: p.x, y: p.y }, turn = this.random() * TAU;
        const needles = [0, 1, 2, 3].map(i => ({ ...along(c, turn + i * Math.PI / 2, ai.needleRadius), at: t + ai.needleWarn + i * ai.needleGap, done: false, hits: 0, pulled: false }));
        this.fbField({ kind: 'bgNeedles', owner: enemy.id, x: c.x, y: c.y, needles, from: t, close: needles.at(-1).at + ai.needleClose, closed: false, hitR: ai.needleHit, damage: this.bgDmg(enemy, ai.needleDamage), burst: this.fbFixed(ai.needleBurst) });
        this.bgChase(enemy, needles.at(-1).at + ai.needleClose - t);
        return true;
      }
      case 'bgLastToll': this.bgLastToll(enemy, ai); return true;
    }
    return false;
  },
  /** A cut's mark: in phase 2 a cyan afterimage stays where it passed and hurts for a while. */
  bgCut(enemy, cut) {
    const ai = this.bgAI(enemy);
    this.fbField({ kind: 'bgTrail', owner: enemy.id, ...cut, from: this.s.time, until: this.s.time + (this.bgPuppet(enemy) ? ai.trailSeconds : 0.25), live: this.bgPuppet(enemy), damage: this.bgDmg(enemy, ai.trailDamage) });
  },
  /** The one look of a blade striking the floor (the PixelLab bursts were taken out of his clips, 2026-11-16). */
  bgImpact(at, radius, quake = {}, enemy = null) {
    // (pixelfx bg-slam, 2026-11-18: was the factory press's white slam and a plain shock)
    this.effect('ring', at.x, at.y, '#e8e2d2', 0.75, radius, { look: 'bgSlam' });
    this.bgStrike(at, radius, !!enemy && this.bgPuppet(enemy));
    this.sense({ kind: 'heavy' });
    // The floor rolling out past the blade and the room shaking, more for a wider blow (2026-11-19).
    this.bossQuake(at.x, at.y, { power: Math.min(1, 0.35 + radius * 0.25), color: '#e8e2d2', reach: radius * 1.3, ...quake });
  },
  /**
   * His blade biting into the floor, drawn big (2026-11-19, the user's word): the pixelfx strike (cracks with molten
   * light cooling in them, chips, sparks, dust), gold for him, cyan for Orden's puppet. Looks only.
   */
  bgStrike(at, radius, cyan = false) {
    this.effect('ring', at.x, at.y, cyan ? '#7fe8ff' : '#ffd88a', 1.4, radius, { look: 'bgStrike', cyan });
  },
  /** Minute archers called in from `sides` of the four sides of the floor, each at a random spot along its side. */
  bgArchers(enemy, sides) {
    const ai = this.bgAI(enemy), room = this.bgRoom(), t = this.s.time, c = this.bgCentre(enemy);
    const all = ['north', 'south', 'west', 'east'];
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    for (const side of all.slice(0, sides)) {
      const u = 0.2 + this.random() * 0.6, x = room.left + (room.right - room.left) * u, y = room.top + (room.bottom - room.top) * u;
      const want = { north: { x, y: room.top }, south: { x, y: room.bottom }, west: { x: room.left, y }, east: { x: room.right, y } }[side];
      const spot = this.fbFloor(want.x, want.y, c, 0.5), body = this.spawnEnemy(ai.archerType, spot);
      // His archers have their own health (2026-11-21, the user's word: 100, not the tower archer's 260), times the difficulty.
      if (ai.archerHp) body.hp = body.maxHp = Math.max(1, Math.round(ai.archerHp * (this.s.run ? this.difficulty.scale : 1)));
      // Out of a summoning rift like his master's images (2026-11-21, the user's pick: they used to pop in with a small
      // ring): the rift opens, the column of light, and the archer lands out of it (enemy-actions.js, bgArcherIn).
      const arrive = t + SUMMON_RISE_SECONDS;
      Object.assign(body, { speed: 0, stationary: true, attackRange: 40, aggro: true, ready: Math.max(t + ai.archerDelay, arrive + 0.3), called: true, vanishAt: t + ai.archerLife, summonedAt: arrive, summonUntil: arrive, landSound: 'bgArcherIn' });
    }
    this.sense({ kind: 'summon' });
  },
  /** Which side of the line a-b the point is on (the sign). */
  bgSide(a, b, pt) { return (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x); },
  /** Inside the polygon of floor points `pts` (in order round it). */
  bgInPoly(pts, pt) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside; }
    return inside;
  },
  /**
   * The sword rain (2026-11-19, the user's word: rows planted in lines looked stiff; a rain of blades falling anywhere,
   * like the first adversary's): for rainSeconds swords pour down at rainRate a second, each on its own spot. rainAim of
   * them come down where F2 is (scattered up to rainScatter), the rest anywhere within rainReach of her. Each shows its
   * spot rainWarn before it lands (radius rainRadius) and stays stuck a moment (rainStay) once down.
   */
  bgSwordRain(enemy, ai) {
    const t = this.s.time;
    this.fbField({ kind: 'bgRain', owner: enemy.id, swords: [], from: t, until: t + ai.rainSeconds, next: t, count: 0, radius: ai.rainRadius, damage: this.bgDmg(enemy, ai.rainDamage) });
  },
  /** One more sword of the rain: where, when it lands, and the slant it falls at. */
  bgRainDrop(f, ai) {
    const p = this.p, t = this.s.time, room = this.bgRoom(), aimed = this.random() < ai.rainAim;
    const spread = aimed ? ai.rainScatter * Math.sqrt(this.random()) : ai.rainReach * Math.sqrt(this.random()), turn = this.random() * TAU;
    const want = along(p, turn, spread), x = Math.max(room.left + 0.4, Math.min(room.right - 0.4, want.x)), y = Math.max(room.top + 0.4, Math.min(room.bottom - 0.4, want.y));
    // Kept in order down the screen, as they are drawn (2026-11-21, the code review: the drawing copied and sorted them every frame).
    let i = f.swords.length; while (i && f.swords[i - 1].y > y) i--;
    f.swords.splice(i, 0, { x, y, at: t + ai.rainWarn, slant: (this.random() - 0.5) * 0.9, done: false, n: f.count++ });
  },
  /**
   * The last toll: he plants the phantom sword and rings; only its shadow is safe. Since 2026-11-20 (the user's pick: the
   * shadow refuge; going to the green three times was simple) a cyan light circles the planted sword (tollSpin degrees a
   * second, tollLight out, the other way round at each planting), so its shadow sweeps round it and F2 has to walk round
   * with it; fewer tolls (tollCount, was twelve), further apart.
   */
  bgLastToll(enemy, ai) {
    const t = this.s.time, c = this.bgCentre(enemy);
    Object.assign(enemy, this.fbFloor(c.x, c.y, c, enemy.radius));
    let a = angleTo(enemy, this.p);
    const plants = [], tolls = [];
    // His archers fall back as the last toll begins (2026-11-21, the user's word: they shot F2 while she kept to the
    // shadow, the only safe floor).
    for (const e of this.s.enemies) if (e.called && e.hp > 0) Object.assign(e, { vanishAt: t, tell: null, ready: Infinity });
    // (their arrows still in the air go with them: in his room only the archers shoot)
    this.s.projectiles = this.s.projectiles.filter(q => q.friendly);
    for (let k = 0; k < ai.tollCount / ai.tollsPerPlant; k++) {
      if (k) a += (this.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + this.random() * Math.PI / 3);
      const start = t + ai.tollWarn + k * (ai.tollsPerPlant * ai.tollEvery + ai.tollMove);
      // His greatsword flung away from him and planted (2026-11-21, the user's word: with the sword in his own hands the
      // shadow lay at his feet and he was easier to strike than ever): it flies in as his phantom sword, as when he
      // throws it, landing tollStride from F2 and at least tollSwordGap from him; he waits barehanded. The light circles
      // the sword and its shadow is the only safe floor. Each planting after the first, it flies on to a new spot.
      // Every flight takes tollGlide up to `at`, the first from his hands as the toll begins (2026-11-21, the code review:
      // the drawing flew it over its own 0.45 s, so the sword was gone between tearing loose and that flight).
      const at = start - ai.tollWarn * 0.8;
      plants.push({ angle: a, at, flyAt: Math.max(t, at - ai.tollGlide), spin: k % 2 ? -1 : 1, ...(k ? {} : this.bgTollSpot(enemy, ai)), x0: enemy.x, y0: enemy.y });
      for (let i = 0; i < ai.tollsPerPlant; i++) tolls.push({ plant: k, at: start + i * ai.tollEvery, done: false });
    }
    this.fbField({ kind: 'bgToll', owner: enemy.id, x: enemy.x, y: enemy.y, plants, tolls, shadow: ai.tollShadowDegrees * Math.PI / 180, light: ai.tollLight, spin: ai.tollSpin * Math.PI / 180, length: ai.tollShadowLength, from: t, damage: this.fbFixed(ai.tollDamage) });
    enemy.busyUntil = tolls.at(-1).at + 0.4; enemy.ready = enemy.busyUntil + enemy.recovery;
  },
  /**
   * Where the last toll's sword lands: tollStride from F2 on open floor, at least tollSwordGap from him and well away from
   * where it last stood (`prev`). With F2 close by him no spot that near her is far enough: then the best of a few tries,
   * as far from him and from the last spot as can be.
   */
  bgTollSpot(enemy, ai, prev = null) {
    const c = this.bgCentre(enemy), p = this.p, gap = ai.tollSwordGap ?? 6;
    let best = null, score = -Infinity;
    for (let i = 0; i < 24; i++) {
      const turn = this.random() * TAU, want = along(p, turn, ai.tollStride), at = this.fbFloor(want.x, want.y, c, 0.8), d = distance(at, enemy), moved = prev ? distance(at, prev) : 9;
      if (d >= gap && moved >= 2.5) return { x: at.x, y: at.y };
      const s = Math.min(d, gap) + Math.min(moved, 3); if (s > score) { score = s; best = at; }
    }
    return { x: best.x, y: best.y };
  },
  /**
   * Where the light circling a planted sword is at time t, as a heading round the sword in floor shape (flattened up and
   * down): it starts on Belgard's side (so the first shadow falls away from him) and turns plant.spin-wise.
   */
  bgTollLight(f, plant, t) { return Math.atan2(-Math.sin(plant.angle), -Math.cos(plant.angle)) + plant.spin * f.spin * Math.max(0, t - plant.at); },
  /** True when `pt` stands in the planted sword's shadow at time t: on the far side of it from the light, within its wedge. */
  bgShaded(f, plant, pt, t = this.s.time) {
    const dx = pt.x - plant.x, dy = (pt.y - plant.y) / FLOOR_FLAT, d = Math.hypot(dx, dy), away = this.bgTollLight(f, plant, t) + Math.PI;
    if (d < 0.25 || d > f.length) return false;
    const off = wrap(Math.atan2(dy, dx) - away);
    return Math.abs(off) <= f.shadow || (Math.abs(off) < Math.PI / 2 && Math.abs(Math.sin(off)) * d <= 0.7);
  },

  /** His floor each frame (from tickFactoryBoss): each field of his steps by its kind (FIELD_STEPS, below). */
  tickBellBoss(dt) {
    const s = this.s, t = s.time;
    // Called archers leave after their volley.
    const bossDown = !s.enemies.some(e => e.type === 'bellguard' && e.hp > 0);
    for (const e of s.enemies) if (e.called && e.hp > 0 && (bossDown || (t >= e.vanishAt && !e.tell))) { e.hp = 0; e.vanished = true; this.effect('dodge', e.x, e.y, '#e0a03c', 0.3, 1); }
    for (const f of s.bossFields || []) {
      const step = FIELD_STEPS[f.kind];
      if (!step) continue;
      const owner = s.enemies.find(e => e.id === f.owner);
      // His death drops his floor, and lets F2 go if he had her in hand (2026-11-21, the code review: held for the throw's
      // whole length with no bell to come).
      if (!owner || owner.hp <= 0) { f.done = true; if (f.kind === 'bgThrow') this.bgLetGo(f.heldUntil); continue; }
      // A step returns true once F2 is down: nothing more this frame.
      if (step.call(this, f, owner, t, dt)) return;
    }
  },
  /** Ends the hold and stun his grab put on F2 (up to `until`), when the throw is cut short. */
  bgLetGo(until) {
    const t = this.s.time, p = this.p;
    if (!(until > t)) return;
    if (p.stunUntil > t && p.stunUntil <= until) p.stunUntil = t;
    if (p.heldUntil > t && p.heldUntil <= until) p.heldUntil = t;
  },
  /** True when `pt` stands on a cut's afterimage: its sector, its ring or its line. */
  bgOnCut(f, pt, R) {
    if (f.shape === 'sector') return inCone(f, pt, f.angle, f.range + R, f.degrees) && distance(f, pt) > 0.6;
    if (f.shape === 'ring') { const d = floorDistance(f, pt); return d < f.radius + R && d > f.radius - 1.2; }
    if (f.shape === 'line') return segmentDistance(pt, f, ray(f, f.angle, f.length)) <= f.width + R;
    return false;
  },
  /** The bell cage: falls, holds F2 inside if she was under it, and rings unless it is struck apart in time. */
  bgCageStep(f, owner, t, dt = 1 / 60) {
    const ai = this.bgAI(owner), p = this.p, R = this.config.arena.playerRadius;
    if (f.until === null) {
      if (t < f.land) return;
      this.bgImpact(f, f.radius, { power: 1.2, color: '#e0a43c', pillar: true }, owner); this.sense({ kind: 'boss', id: 'bgCageLand' });
      f.trapped = !p.dodge && floorDistance(f, p) < f.radius + R * 0.5; f.until = t + (f.trapped ? ai.cageSeconds : 0.8);
      if (f.trapped) {
        owner.busyUntil = Math.max(owner.busyUntil || 0, f.until + 0.3); owner.ready = Math.max(owner.ready, owner.busyUntil);
        // The other bells of the three are called off; he comes round to knock on this one, from his side of it: where he
        // will stand is found once (2026-11-21, the code review: fbFloor every frame), and he walks there by the first knock.
        for (const o of this.s.bossFields) if (o !== f && o.kind === 'bgCage' && o.chain === f.chain && o.until === null) o.done = true;
        f.knockAt = t + ai.cageKnockFirst; f.side = angleTo(f, owner);
        f.stand = this.fbFloor(f.x + Math.cos(f.side) * (f.radius + 1.1), f.y + Math.sin(f.side) * (f.radius + 1.1), f, owner.radius);
        f.walk = Math.max(ai.speed, distance(owner, f.stand) / ai.cageKnockFirst);
      }
      return;
    }
    if (f.trapped) {
      // Held inside: she can still swing, but not walk out.
      const dx = p.x - f.x, dy = (p.y - f.y) / FLOOR_FLAT, d = Math.hypot(dx, dy), keep = f.radius - 0.6;
      if (d > keep) { p.x = f.x + dx / d * keep; p.y = f.y + dy / d * keep * FLOOR_FLAT; }
      if (f.hits >= ai.cageHits) { f.trapped = false; f.done = true; this.effect('ring', f.x, f.y, '#ffd257', 0.5, f.radius, { look: 'shieldBreak' }); this.sense({ kind: 'quake', power: 0.8, color: '#ffd257' }); this.notify('종을 깨고 나왔습니다!');
        // He goes straight on, his next blow too (2026-11-21, the code review: only busyUntil came down, so he walked but
        // started nothing for up to the cage's whole length, `ready` still raised by the grab or the trap).
        owner.busyUntil = Math.min(owner.busyUntil, t + 0.3); owner.ready = Math.min(owner.ready, t + 0.3); return;
      }
      if (t >= f.until) { f.trapped = false; f.done = true; this.hurt(this.fbFixed(ai.cageDamage)); this.effect('ring', f.x, f.y, '#e0a43c', 0.55, f.radius * 2, { look: 'bgToll' }); this.bossQuake(f.x, f.y, { power: 1, color: '#e0a43c', reach: f.radius * 2 }); return; }
      // He stands at the bell and knocks on it every cageKnock: each blow rings through it onto F2. He walks to it at
      // f.walk a second (this.move, so the walls hold him; 2026-11-21: was a jump of 0.15 of the way each frame).
      const gap = distance(owner, f.stand);
      if (gap > 0.05) { const k = Math.min(gap, f.walk * dt) / gap; this.move(owner, (f.stand.x - owner.x) * k, (f.stand.y - owner.y) * k); }
      owner.facing = angleTo(owner, f);
      if (t >= f.knockAt) {
        f.knockAt = t + ai.cageKnock; f.knockShownAt = t;
        this.effect('ring', f.x + Math.cos(f.side) * f.radius, f.y + Math.sin(f.side) * f.radius, '#e0a43c', 0.4, 0.9, { look: 'bgSlam' });
        this.sense({ kind: 'boss', id: 'bgClang' }); this.sense({ kind: 'quake', power: 0.5, color: '#e0a43c' });
        this.hurt(this.fbFixed(ai.cageKnockDamage));
      }
      return;
    }
    if (t >= f.until) f.done = true;
  },

  /** A wrench swing: the cage F2 is caught in, the needles of the fence, and the forged orders' pillars. */
  bgSwing(a, range) {
    const t = this.s.time, p = this.p;
    for (const f of this.s.bossFields || []) if (f.kind === 'bgCage' && f.trapped && !(f.hitAt > t - 0.12)) { f.hitAt = t; f.hits++; this.effect('spark', f.x, f.y - 1, '#e0a43c', 0.25, 0.8); this.sense({ kind: 'hit' }); }
    // The needles' fence: a needle struck needleHits times comes out.
    for (const f of this.s.bossFields || []) if (f.kind === 'bgNeedles' && !f.closed) {
      const ai = this.bgAI(this.s.enemies.find(e => e.id === f.owner));
      for (const n of f.needles) if (n.done && !n.pulled && !(n.hitAt > t - 0.12) && inCone(p, n, a.angle, range + 0.6, this.config.rules.comboArcDegrees)) {
        n.hitAt = t; n.hits++; this.effect('spark', n.x, n.y - 1.5, '#7fe8ff', 0.25, 0.8); this.sense({ kind: 'hit' });
        if (n.hits >= (ai?.needleHits ?? 2)) { n.pulled = true; n.pulledAt = t; this.effect('ring', n.x, n.y, '#ffd257', 0.4, 1, { look: 'bgTollCyan' }); }
      }
    }
    for (const enemy of this.s.enemies) {
      const b = enemy.breaking;
      if (!this.bgAI(enemy) || b?.kind !== 'orders' || b.failAt !== null) continue;
      const rule = this.breakRule(enemy, b.index);
      // (A pillar already carrying a forged order, running or waiting, takes no more blows: 2026-11-22, the code review —
      // the combo's next cut on it, off the pitch by then, called the forged order off.)
      const forgedOn = i => (b.order?.forged && !b.order.struck && b.order.pillar === i) || (b.queued?.forged && b.queued.pillar === i);
      const pl = b.pillars.find((q, i) => !q.broken && !forgedOn(i) && !(q.hitAt > t - 0.25) && inCone(p, q, a.angle, range + rule.pillarRadius + 0.3, this.config.rules.comboArcDegrees));
      if (!pl) continue;
      pl.hitAt = t;
      // A pillar jammed by a blow off the pitch only clangs until its needle is free again (2026-11-22).
      if (pl.jamUntil > t) { pl.clangAt = t; this.effect('spark', pl.x, pl.y - 2, '#e8e2d2', 0.3, 1); this.sense({ kind: 'boss', id: 'bgClang' }); continue; }
      // In tune now or a moment ago (rule.grace: a blow a beat late, as the needle leaves the green, still counts).
      if (this.bgInTune(b, pl, rule) || Math.abs(this.bgNeedle(b, pl, rule, t - rule.grace)) <= rule.tune) {
        // In Orden's pitch: a forged order, taken up at once (over a real one, or after the blow he is in the middle of).
        pl.ringAt = t; pl.forged = true;
        this.effect('ring', pl.x, pl.y, '#ffd257', 0.5, 1.4, { look: 'bgTollCyan' }); this.sense({ kind: 'boss', id: 'bgForge' });
        this.bgOrder(enemy, b, rule, { pillar: b.pillars.indexOf(pl), forged: true });
      } else {
        // Off the pitch: a clang, the pillar jams (its needle stops where it was, rule.jamSeconds), and he comes for F2 herself.
        pl.clangAt = t; pl.jamU = this.bgNeedle(b, pl, rule); pl.jamUntil = t + (rule.jamSeconds ?? 0);
        this.effect('spark', pl.x, pl.y - 2, '#e8e2d2', 0.3, 1); this.sense({ kind: 'boss', id: 'bgClang' });
        this.bgOrder(enemy, b, rule, { at: { x: p.x, y: p.y }, punish: true });
      }
    }
  },
  /** The half-health shield: Orden's pillars rise round the floor; their orders, real and forged (bgBreakStep). */
  bgBreakStart(enemy, b, rule) {
    const c = this.bgCentre(enemy), t = this.s.time;
    // The shield clears the floor, his throw with it (enemy-actions.js checkPhaseBreak): F2 is let go at once (2026-11-21,
    // the code review: still held and stunned for the rest of the throw).
    this.bgLetGo(enemy.bgHeldUntil); enemy.bgHeldUntil = 0;
    // Nor does a combo's lunge carry through the shield and slide him on after it (2026-11-22, the code review).
    enemy.bgLunge = null;
    Object.assign(enemy, this.fbFloor(c.x, c.y, c, enemy.radius));
    const turn = this.random() * TAU;
    const pillars = Array.from({ length: rule.pillars }, (_, i) => ({ ...this.fbFloor(...Object.values(along(c, turn + i * TAU / rule.pillars, rule.pillarReach)), c, 0.8), phase: i / rule.pillars, broken: false, ringAt: -1, forged: false }));
    Object.assign(b, { pillars, cracks: 0, need: rule.need, order: null, queued: null, nextOrder: t + rule.firstOrder });
    enemy.tellPose = 'plant';
    this.notify(enemy.breakFailed?.orders ? '보호막! 기둥 위 바늘이 초록 칸에 들어와 기둥이 빛날 때 렌치로 치세요. 벨가드가 그 기둥을 내려치면 종에 금이 갑니다.' : '조율 기둥 위 바늘이 초록 칸에 들어오면 기둥이 빛납니다. 그때 렌치로 쳐서 가짜 명령을 내리세요!');
  },
  /** A pillar's needle, -1 to 1 as it swings; in Orden's pitch within rule.tune of the middle. */
  bgNeedle(b, pl, rule, at = this.s.time) { return pl.jamUntil > at ? pl.jamU : Math.sin((at / rule.needleSeconds + pl.phase) * TAU); },
  /** In Orden's pitch now: the needle within rule.tune of the middle, and the pillar not jammed. */
  bgInTune(b, pl, rule, at = this.s.time) { return !(pl.jamUntil > at) && Math.abs(this.bgNeedle(b, pl, rule, at)) <= rule.tune; },
  /**
   * Gives him an order: a pillar (real or forged) or a spot (charging F2 after a clang). He runs straight there, raises
   * the blade for strikeWarn and brings it down round the spot. A new order replaces the one he is running to; one that
   * comes while he strikes waits for the blow to end.
   */
  bgOrder(enemy, b, rule, order) {
    const t = this.s.time, pl = order.pillar !== undefined ? b.pillars[order.pillar] : null, target = pl || order.at;
    const way = angleTo(target, enemy), stop = pl ? ray(target, way, Math.min(1.2, distance(target, enemy))) : { x: target.x, y: target.y };
    const next = { ...order, target: { x: target.x, y: target.y }, stop, from: { x: enemy.x, y: enemy.y }, start: t + (order.forged || order.punish ? 0.15 : rule.orderWarn), strikeAt: null, hit: false };
    // One that comes while he strikes waits for the blow; so does a forged order while he charges F2 for a miss (2026-11-22:
    // a lucky blow straight after a miss called the charge off, so striking at random cost nothing).
    // A charge for a miss likewise waits behind a forged order he is running to.
    if ((b.order?.strikeAt !== null && b.order?.strikeAt !== undefined) || (b.order?.punish && !b.order.struck && order.forged) || (b.order?.forged && !b.order.struck && order.punish)) { b.queued = next; return; }
    b.order = next;
    if (pl && !order.forged) { pl.ringAt = t; this.sense({ kind: 'boss', id: 'bgOrder' }); }
  },
  /** Each frame of the shield: the orders, his runs and blows, and the end (cracks enough, or pillars too few). */
  bgBreakStep(enemy, rule, dt = 1 / 60) {
    const t = this.s.time, b = enemy.breaking, p = this.p, R = this.config.arena.playerRadius;
    const live = b.pillars.filter(pl => !pl.broken);
    let standing = live.length;
    // A real order, soon after the last blow (orderGap): the pillar nearest F2 (2026-11-19, the user's word: often).
    if (!b.order && t >= b.nextOrder && live.length) {
      const near = live.reduce((m, pl) => (floorDistance(pl, p) < floorDistance(m, p) ? pl : m));
      this.bgOrder(enemy, b, rule, { pillar: b.pillars.indexOf(near), forged: false });
    }
    const o = b.order;
    if (o) {
      enemy.facing = angleTo(enemy, o.target);
      if (o.strikeAt === null && t >= o.start) {
        if (!o.running) { o.running = true; this.sense({ kind: 'boss', id: 'bgCharge' }); }
        // Dust kicked up behind his run.
        if (t >= (o.puffAt || 0)) { o.puffAt = t + 0.09; this.effect('dodge', enemy.x, enemy.y, '#c9b27a', 0.35, 0.9); }
        // The run: straight at the stop, hurting F2 once if he runs through her.
        const d = distance(enemy, o.stop), step = Math.min(d, rule.chargeSpeed * dt);
        if (d > 0.05) {
          const before = { x: enemy.x, y: enemy.y };
          this.move(enemy, (o.stop.x - enemy.x) / d * step, (o.stop.y - enemy.y) / d * step);
          if (!o.hit && !p.dodge && segmentDistance(p, before, enemy) <= rule.chargeWidth + R) { o.hit = true; this.hurt(this.fbFixed(rule.chargeDamage)); if (!this.active) return; }
          if (distance(enemy, before) < step * 0.3) o.strikeAt = t + rule.strikeWarn; // stopped by a wall: strike from here
        } else o.strikeAt = t + rule.strikeWarn;
        if (o.strikeAt === null && distance(enemy, o.stop) <= 0.05) o.strikeAt = t + rule.strikeWarn;
      }
      if (o.strikeAt !== null && t >= o.strikeAt && !o.struck) {
        o.struck = true;
        this.bgImpact(o.target, rule.strikeRadius, {}, enemy); this.sense({ kind: 'boss', id: 'bgSlam' });
        if (!p.dodge && floorDistance(o.target, p) < rule.strikeRadius + R) { this.hurt(this.fbFixed(o.punish ? rule.punishDamage : rule.strikeDamage)); if (!this.active) return; }
        const pl = o.pillar !== undefined ? b.pillars[o.pillar] : null;
        if (pl && o.forged && !pl.broken) {
          // The forged pillar struck: it breaks, and so does a little of his bell.
          pl.broken = true; standing--; b.cracks++; b.crackAt = t; this.sense({ kind: 'boss', id: 'bgCrack' });
          this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.7, 2.6, { look: 'shieldBreak' }); this.effect('parts', pl.x, pl.y, '#c99a3a', 0.8, 10, { big: true }); this.sense({ kind: 'heavy' });
          this.bossQuake(pl.x, pl.y, { power: 1, color: '#ffd257', reach: 1.6, pillar: true });
          if (b.cracks < b.need) this.notify(`벨가드의 종에 금이 갔습니다 (${b.cracks}/${b.need}).`);
        }
        o.doneAt = t + rule.recover;
      }
      if (o.struck && t >= o.doneAt) {
        b.order = null; b.nextOrder = t + rule.orderGap;
        if (b.queued) { const q = b.queued; b.queued = null; if (q.pillar === undefined || !b.pillars[q.pillar].broken) this.bgOrder(enemy, b, rule, { pillar: q.pillar, at: q.at, forged: q.forged, punish: q.punish }); }
      }
    }
    b.solved = b.cracks >= b.need;
    // Too few pillars left to forge the rest: the time is up at once.
    if (!b.solved && standing < b.need - b.cracks) b.until = Math.min(b.until, t);
  },
};

/**
 * His floor, a frame of each kind (tickBellBoss calls them with the game as `this`; 2026-11-21, the code review: one long
 * if-chain before). Each returns true once F2 is down, and the frame stops there.
 */
const FIELD_STEPS = {
  __proto__: null,
  bgThrow(f, owner, t, dt) {
    const p = this.p;
    // Lifted in his hand, then flung along an arc to where the bell will fall (the arc's height is drawn, bell-boss-draw.js).
    if (t < f.lift) { p.x += (f.hand.x - p.x) * Math.min(1, dt * 12); p.y += (f.hand.y - p.y) * Math.min(1, dt * 12); return; }
    if (t < f.end) { f.from ??= { x: p.x, y: p.y }; const k = (t - f.lift) / (f.end - f.lift); p.x = f.from.x + (f.to.x - f.from.x) * k; p.y = f.from.y + (f.to.y - f.from.y) * k; return; }
    Object.assign(p, { x: f.to.x, y: f.to.y }); f.done = true;
    this.effect('ring', p.x, p.y, '#e8e2d2', 0.6, 1.2, { look: 'bgSlam' }); this.sense({ kind: 'heavy' });
    const ai = this.bgAI(owner);
    this.fbField({ kind: 'bgCage', owner: owner.id, x: p.x, y: p.y, radius: ai.cageRadius, land: t + ai.grabDrop, trapped: false, hits: 0, until: null, done: false, quick: true });
  },
  bgPendulum(f, owner, t) {
    const p = this.p, R = this.config.arena.playerRadius;
    for (const ps of f.passes) {
      // Aimed as its warning starts: the row F2 stands in, kept on the floor.
      if (ps.y === null && t >= ps.warnAt) ps.y = Math.max(f.top + 0.6, Math.min(f.bottom - 0.6, p.y));
      if (t < ps.start || t > ps.end) continue;
      if (!ps.swung) { ps.swung = true; this.sense({ kind: 'boss', id: 'bgPendSwing' }); }
      const k = (t - ps.start) / (ps.end - ps.start), u = (1 - Math.cos(k * Math.PI)) / 2, x = ps.dir > 0 ? f.left + (f.right - f.left) * u : f.right - (f.right - f.left) * u;
      ps.x = x;
      if (!ps.hit && !p.dodge && floorDistance({ x, y: ps.y }, p) < f.radius + R) { ps.hit = true; this.hurt(f.damage); if (!this.active) return true; }
    }
    if (t > f.passes.at(-1).end + 0.3) f.done = true;
  },
  bgCrescent(f, owner, t, dt) {
    const p = this.p, R = this.config.arena.playerRadius;
    // Swept on the screen like its warning (a fan drawn round him): hit once where the arc passes this frame.
    const before = f.r; f.r = Math.min(f.range, f.r + f.speed * dt);
    const d = Math.hypot(p.x - f.x, p.y - f.y), a = Math.atan2(p.y - f.y, p.x - f.x);
    if (!f.hit && !p.dodge && d >= before - f.width - R && d <= f.r + f.width + R && Math.abs(wrap(a - f.angle)) <= f.half + R / Math.max(1, d)) { f.hit = true; this.hurt(f.damage); }
    if (f.r >= f.range) f.done = true;
  },
  bgWave(f, owner, t, dt) {
    const p = this.p, R = this.config.arena.playerRadius;
    const before = f.front; f.front = Math.min(f.length, f.front + f.speed * dt);
    const a = ray(f, f.angle, before), b = ray(f, f.angle, f.front);
    if (!f.hit && !p.dodge && segmentDistance(p, a, b) <= f.width + R) { f.hit = true; this.hurt(f.damage); }
    if (f.front >= f.length) { f.done = true; if (f.puppet) this.bgCut(owner, { shape: 'line', x: f.x, y: f.y, angle: f.angle, length: f.length, width: f.width }); }
  },
  bgRings(f, owner, t) {
    const p = this.p, R = this.config.arena.playerRadius;
    for (const band of f.bands) {
      if (band.done || t < band.at) continue;
      band.done = true;
      const d = floorDistance(f, p);
      if (!p.dodge && d >= band.lo - R && d < band.hi + R * 0.5 && !(band.lo === 0 && d > band.hi)) this.hurt(f.damage);
      this.effect('ring', f.x, f.y, '#e0a43c', 0.55, band.hi, { look: 'bgToll' }); this.sense({ kind: 'boss', id: 'bgToll' });
      this.bossQuake(f.x, f.y, { power: 0.5, color: '#e0a43c', reach: Math.max(1.2, band.hi * 0.6) });
      if (!this.active) return true;
    }
    if (f.bands.every(b => b.done)) f.done = true;
  },
  bgCracks(f, owner, t) {
    // Burst, the field stays a second for the bursts to play out (2026-11-18: four plain slams a line looked flat).
    if (f.burst) { if (t >= f.until) f.done = true; return; }
    if (t < f.at) return;
    // The floor tears open along them (bell-boss-draw.js: bursts running out from the blade, pixelfx bg-erupt).
    const p = this.p, R = this.config.arena.playerRadius;
    f.burst = true; f.until = t + 1.1;
    if (!p.dodge && f.lines.some(l => segmentDistance(p, f, l.end) <= f.width + R)) this.hurt(f.damage);
    this.sense({ kind: 'heavy' }); this.bossQuake(f.x, f.y, { power: 1, color: '#e8e2d2', reach: 2.2 });
    return !this.active;
  },
  bgCage(f, owner, t, dt) {
    const p = this.p;
    // Its shadow keeps over F2 until it is aimed.
    if (f.until === null && f.aimAt !== undefined && t < f.aimAt) { const k = Math.min(1, dt * 10); f.x += (p.x - f.x) * k; f.y += (p.y - f.y) * k; }
    this.bgCageStep(f, owner, t, dt); return !this.active;
  },
  bgTrail(f, owner, t) {
    if (t >= f.until) { f.done = true; return; }
    // In phase 2 an afterimage hurts every trailTick; one blow a frame at most of all of them (bgTrailNext is then ahead).
    const p = this.p, s = this.s;
    if (f.live && !p.dodge && t >= (s.bgTrailNext || 0) && this.bgOnCut(f, p, this.config.arena.playerRadius)) { s.bgTrailNext = t + this.bgAI(owner).trailTick; this.hurt(f.damage); return !this.active; }
  },
  bgSword(f, owner, t, dt) {
    const p = this.p, R = this.config.arena.playerRadius, ai = this.bgAI(owner);
    if (t >= f.until && f.mode !== 'dash') { f.done = true; this.effect('spark', f.x, f.y, '#7fe8ff', 0.4, 1.2); this.effect('ring', f.x, f.y, '#7fe8ff', 0.5, 1.2, { look: 'bgTollCyan' }); return; }
    // Where it has been, for its afterimages (bell-boss-draw.js).
    if (t >= (f.trailAt || 0)) { f.trailAt = t + 0.03; (f.trail ??= []).unshift({ x: f.x, y: f.y, angle: f.angle }); f.trail.length = Math.min(f.trail.length, f.mode === 'dash' ? 10 : 6); }
    f.mode ??= 'hunt'; f.modeAt ??= f.from;
    if (f.mode === 'hunt') {
      // It turns toward F2 at most flyTurn a second and keeps flying, so a sharp step aside makes it overshoot.
      const want = Math.atan2((p.y - f.y) / FLOOR_FLAT, p.x - f.x), cur = Math.atan2(Math.sin(f.angle) / FLOOR_FLAT, Math.cos(f.angle));
      const turned = cur + Math.max(-ai.flyTurn * dt, Math.min(ai.flyTurn * dt, wrap(want - cur)));
      f.angle = Math.atan2(Math.sin(turned) * FLOOR_FLAT, Math.cos(turned));
      Object.assign(f, along(f, turned, ai.flySpeed * dt));
      if (!this.bgOpen(f, 0.2)) { f.angle += Math.PI; }
      if (t >= f.modeAt + ai.flyHunt) { f.mode = 'aim'; f.modeAt = t; }
    } else if (f.mode === 'aim') {
      // It stops dead in the air, swings its point round onto F2 and shivers: the lane it will dart along shows.
      const want = angleTo(f, p);
      f.angle += wrap(want - f.angle) * Math.min(1, dt * 12);
      if (t >= f.modeAt + ai.flyAim) {
        f.mode = 'dash'; f.modeAt = t; f.dashFrom = { x: f.x, y: f.y }; f.dashHit = false;
        this.sense({ kind: 'boss', id: 'bgFlySword' }); this.effect('spark', f.x, f.y, '#7fe8ff', 0.3, 1.2);
      }
    } else {
      // The dart: straight along its aim at flyDash a second, up to flyDashLength or a wall.
      const step = ai.flyDash * dt, before = { x: f.x, y: f.y };
      f.x += Math.cos(f.angle) * step; f.y += Math.sin(f.angle) * step;
      const blocked = !this.bgOpen(f, 0.2);
      if (blocked) Object.assign(f, before);
      if (!f.dashHit && !p.dodge && segmentDistance(p, before, f) <= ai.flyRadius + R) { f.dashHit = true; this.hurt(f.dashDamage); if (!this.active) return true; }
      if (blocked || distance(f, f.dashFrom) >= ai.flyDashLength) {
        f.mode = 'hunt'; f.modeAt = t;
        this.effect('ring', f.x, f.y, '#7fe8ff', 0.4, 0.9, { look: 'bgSlam' }); if (blocked) this.sense({ kind: 'quake', power: 0.5, color: '#7fe8ff' });
      }
    }
    if (f.mode !== 'dash' && !p.dodge && t >= f.nextHit && floorDistance(f, p) < ai.flyRadius + R) { f.nextHit = t + ai.flyTick; this.hurt(f.damage); return !this.active; }
  },
  bgRain(f, owner, t) {
    const p = this.p, R = this.config.arena.playerRadius, ai = this.bgAI(owner);
    while (t < f.until && t >= f.next) { this.bgRainDrop(f, ai); f.next += 1 / ai.rainRate; }
    for (const sw of f.swords) {
      if (sw.done || t < sw.at) continue;
      sw.done = true;
      this.effect('ring', sw.x, sw.y, '#7fe8ff', 0.4, f.radius, { look: 'bgSlam' });
      // Every sword sticks with its own small ring (2026-11-21: one sound every three read thin); the big rush and a
      // tremor every three.
      this.sense({ kind: 'boss', id: 'bgSwordHit' });
      if (sw.n % 3 === 0) { this.sense({ kind: 'boss', id: 'bgSwordRain' }); this.sense({ kind: 'quake', power: 0.35, color: '#7fe8ff' }); }
      if (!p.dodge && floorDistance(sw, p) < f.radius + R) { this.hurt(f.damage); if (!this.active) return true; }
    }
    // Swords that have stood their rainStay go (2026-11-21, the code review: kept to the end, the drawing went through
    // every one each frame).
    let keep = 0;
    for (const sw of f.swords) if (!sw.done || t < sw.at + ai.rainStay) f.swords[keep++] = sw;
    f.swords.length = keep;
    if (t >= f.until && !keep) f.done = true;
  },
  bgNeedles(f, owner, t) {
    const p = this.p, R = this.config.arena.playerRadius, ai = this.bgAI(owner), N = f.needles;
    for (const n of N) {
      if (n.done || t < n.at) continue;
      n.done = true; this.effect('ring', n.x, n.y, '#7fe8ff', 0.45, f.hitR, { look: 'bgTollCyan' }); this.effect('spark', n.x, n.y - 0.3, '#bff4ff', 0.3, 1.1);
      this.sense({ kind: 'boss', id: 'bgNeedleHit' });
      if (!p.dodge && floorDistance(n, p) < f.hitR + R) this.hurt(f.damage);
      if (!this.active) return true;
    }
    // The needles that stand are joined by threads of light (2026-11-20, the user's pick): a fence F2 cannot cross
    // (fenceDamage and held back). A needle struck needleHits times is pulled and its two threads go: the way out.
    // Leaving the inside is held back unless every side it leaves by is open (a needle at either end of it pulled, or
    // not landed yet); a side is passed once F2 stands beyond its line. (The needles stand square round f, their middle.)
    const last = f.lastP ??= { x: p.x, y: p.y };
    const beyond = (a, b, pt) => this.bgSide(a, b, pt) * this.bgSide(a, b, f) < 0;
    if (this.bgInPoly(N, last) && !this.bgInPoly(N, p)) {
      const held = [0, 1, 2, 3].some(i => { const a = N[i], b = N[(i + 1) % 4]; return a.done && b.done && !a.pulled && !b.pulled && beyond(a, b, p); });
      if (held) {
        p.x = last.x; p.y = last.y;
        if (t >= (f.fenceAt || 0)) { f.fenceAt = t + 0.6; this.effect('spark', p.x, p.y - 1, '#7fe8ff', 0.3, 0.9); if (this.hurt(this.fbFixed(ai.needleFence)) && !this.active) return true; }
      }
    }
    last.x = p.x; last.y = p.y;
    if (!f.closed && t >= f.close) {
      f.closed = true; f.done = true;
      this.effect('ring', f.x, f.y, '#7fe8ff', 0.55, ai.needleRadius, { look: 'bgTollCyan' }); this.sense({ kind: 'heavy' });
      this.bossQuake(f.x, f.y, { power: 0.9, color: '#7fe8ff', reach: ai.needleRadius, pillar: true });
      if (!p.dodge && this.bgInPoly(N, p)) this.hurt(f.burst);
      return !this.active;
    }
  },
  bgToll(f, owner, t) {
    const p = this.p, ai = this.bgAI(owner);
    // Before each planting after the first the sword tears loose and flies on to a new spot near F2 (2026-11-19, the
    // user's word: twelve tolls in one place were easy; it was him striding until 2026-11-21): its shadow goes with it.
    for (let i = 1; i < f.plants.length; i++) {
      const pl = f.plants[i];
      if (pl.moved || t < pl.flyAt) continue;
      pl.moved = true; const prev = f.plants[i - 1];
      Object.assign(pl, this.bgTollSpot(owner, ai, prev), { x0: prev.x, y0: prev.y });
      this.effect('dodge', prev.x, prev.y, '#7fe8ff', 0.35, 1.2);
    }
    // He stands barehanded, facing F2, from the moment the sword leaves his hands (the throw is his command pose).
    if (!f.bare && t >= f.plants[0].flyAt) { f.bare = true; owner.bareUntil = f.tolls.at(-1).at + 0.4; }
    owner.facing = angleTo(owner, p);
    for (const pl of f.plants) {
      if (!pl.landed && t >= pl.at) { pl.landed = true; f.x = pl.x; f.y = pl.y; this.bgStrike(pl, 1.4, true); this.bossQuake(pl.x, pl.y, { power: 0.9, color: '#7fe8ff', reach: 2 }); }
    }
    for (const toll of f.tolls) {
      if (toll.done || t < toll.at) continue;
      toll.done = true; this.sense({ kind: 'boss', id: 'bgToll' });
      // The toll rings out from the planted sword (a ring the size it was drawn for: the room-wide one broke into blocks).
      const pl = f.plants[toll.plant];
      this.effect('ring', pl.x, pl.y, '#7fe8ff', 0.6, 3.6, { look: 'bgTollCyan' }); this.effect('ring', pl.x, pl.y, '#7fe8ff', 0.9, 3, { look: 'quake' });
      this.bossQuake(pl.x, pl.y, { power: 1.2, color: '#7fe8ff', reach: 2.4 });
      if (!p.dodge && !this.bgShaded(f, pl, p)) this.hurt(f.damage);
      if (!this.active) return true;
    }
    // Over: the sword is back in his hands.
    if (f.tolls.every(x => x.done)) { f.done = true; owner.bareUntil = t; }
  },
};
