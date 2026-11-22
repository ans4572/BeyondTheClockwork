// Chapter 3's bosses (docs/design/clock-tower-boss-drafts.md). So far the midboss Tick·Tock (1-D, the metronome twins):
// two bodies with one health, a beat the metronome on their backs keeps, and one twin acting on each beat — red on the
// left swing, blue on the right — so the two never strike at once. Mixed into Game; factory-bosses.js hands their tells,
// steps, blows and hits over here (ttAI), and tickFactoryBoss calls tickClockBoss each frame. Numbers live in
// slice.json bossAI.twinTickTock; the beat and the shuffle in difficulty.levels[].bossRepeats (ttBeat, ttBeat2,
// ttShuffles, ttShuffleStep), the colour-floor break in difficulty.levels[].phaseBreaks.colours.
//
// Phase 1 (round): thrusts, sweeps, the pendulum, the dash, the shuffle. At half health the colour floor (ttBreakStart):
// both shielded in the middle while the floor turns to red and blue squares; on Tick's pose stand on red, on Tock's on
// blue. Phase 2 (round2) beats faster and adds the giant metronome, the echo and the pincer. The flank (both
// phases) has them blink to opposite ends of the room and send walls of gears across it in turn.
//
// Each twin has a look, 'tick' (red) or 'tock' (blue): red thrusts and dashes, blue sweeps. enemy.sprite is the look
// drawn this frame (both turn grey, 'ttgray', while they shuffle); enemy.swing is the metronome's place in its two-beat
// swing (0 to 1), for the idle clip and the beat marks.
import { fitsMap } from './map-geometry.js';
import { distance, floorDistance, segmentDistance, inCone, FLOOR_FLAT, angleTo } from './math.js';

const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
/**
 * The round's steps: a solo blow's twin (red's beat is the left swing, even beats; blue's the right), the warning each
 * starts and its pose. Those with no actor take both twins for whole beats, and no solo blow starts while one runs.
 */
const STEPS = { thrust: { actor: 'tick', tell: 'ttThrust' }, dash: { actor: 'tick', tell: 'ttDash' }, sweep: { actor: 'tock', tell: 'ttSweep', pose: 'sweep' },
  pendulum: { tell: 'ttPendulum', pose: 'cast' }, shuffle: { tell: 'ttShuffle', pose: 'move' }, blade: { tell: 'ttBlade', pose: 'cast' }, pincer: { tell: 'ttPincer', pose: 'move' }, flank: { tell: 'ttFlank', pose: 'cast' } };
/** Each warning's pose (the colour floor's Tock call is a sweep too). */
const POSES = { ...Object.fromEntries(Object.values(STEPS).filter(s => s.pose).map(s => [s.tell, s.pose])), ttCallTock: 'sweep' };
/** The patterns that run under the twins' other blows (one at a time); the joint ones wait for them. */
const UNDER = { echo: 'ttEcho' }, UNDER_KINDS = new Set(Object.values(UNDER));
/** What runs each of their floor patterns every frame (tickClockBoss). */
const FIELD_STEPS = { ttPendulum: 'ttPendulumStep', ttShuffle: 'ttShuffleStep', ttBlade: 'ttBladeStep', ttEcho: 'ttEchoStep', ttPincer: 'ttPincerStep', ttFlank: 'ttFlankStep' };
/** Each look's colour (clock-boss-draw.js draws with them too). */
export const LOOKS = { tick: '#e0564c', tock: '#5b8fe0' };
/** The shuffle's opening: the twins glide to their two spots, then stand in their colours before turning grey. */
export const SHUFFLE_GATHER = 0.6, SHUFFLE_SHOW = 0.8, SHUFFLE_HOLD = 0.55; // hold: 0.35 until 2026-11-15, 0.2 s more to see where they stopped
/** The flank's blink: how long the twins are gone between where they stood and the ends of the room. */
const FLANK_BLINK = 0.35;
/** Turns a twin to `angle`, its warning with it. */
const face = (e, angle) => { e.facing = angle; if (e.tell) e.tell.angle = angle; };
/** A giant metronome swing's bands as its floor shows them, touching ones merged, and the safe gaps out to Infinity (2026-11-21: once a swing, not twice a frame in clock-boss-draw.js). */
function bladeBands(weights) {
  const bands = weights.map(w => ({ lo: w.lo, hi: w.hi })).sort((p, q) => p.lo - q.lo).reduce((out, w) => { const last = out.at(-1); if (last && w.lo <= last.hi + 1e-6) last.hi = Math.max(last.hi, w.hi); else out.push(w); return out; }, []);
  const gaps = []; let from = 0;
  for (const w of bands) { if (w.lo > from + 1e-6) gaps.push([from, w.lo]); from = Math.max(from, w.hi); }
  if (from < Infinity) gaps.push([from, Infinity]);
  return { bands, gaps };
}

export const clockBosses = {
  /** The rules of the Tick·Tock twins, if `enemy` is one of them. */
  ttAI(enemy) { return enemy?.boss && enemy.type === 'twinTickTock' ? this.config.bossAI.twinTickTock : null; },
  /** The beat now: quicker once the colour floor is danced through (phase 2). */
  ttBeat(enemy) {
    const ai = this.config.bossAI.twinTickTock, lead = this.ttLead(enemy);
    return lead?.metronome?.phase === 2 ? this.bossRepeat(enemy, 'ttBeat2') || ai.beat2 : this.bossRepeat(enemy, 'ttBeat') || ai.beat;
  },
  ttPartner(enemy) { return this.s.enemies.find(e => e.id === enemy.partner); },
  /** The twin who keeps the beat (the metronome on its back). */
  ttLead(enemy) { return enemy?.metronome ? enemy : this.ttPartner(enemy); },
  ttLook(look) { return this.s.enemies.find(e => this.ttAI(e) && e.hp > 0 && e.look === look); },
  /** The two twins a field moves, in its order; null once either is gone. */
  ttBodies(f) { const bodies = f.ids.map(id => this.s.enemies.find(e => e.id === id)); return bodies.some(e => !e || e.hp <= 0) ? null : bodies; },
  /** True while a pattern that runs under the others (the echo) is on. */
  ttUnder() { return (this.s.bossFields || []).some(f => UNDER_KINDS.has(f.kind)); },
  /** The twins walk in side by side, the lead (who keeps the beat) on the left. Returns false for any other boss. */
  ttSpawn(type, at) {
    const ai = this.config.bossAI[type];
    if (!ai?.twins) return false;
    const bodies = ai.twins.map((look, i) => {
      const spot = this.fbFloor(at.x + (i ? 1 : -1) * ai.twinGap / 2, at.y, at), body = this.spawnEnemy(type, spot);
      return Object.assign(body, { look, sprite: look, twin: i, busyUntil: 0, swing: 0 });
    });
    bodies[0].partner = bodies[1].id; bodies[1].partner = bodies[0].id;
    // F2's pace and last spot (ttStep) live on the metronome, made fresh with the twins (2026-11-21: on the run state
    // they outlived a death, so a retry's first frame read the whole jump back to the door as pace and aimed far off);
    // throws counts the gears thrown over the pendulum and the giant metronome, so the twins take turns.
    bodies[0].metronome = { count: -1, next: null, zero: null, step: 0, joint: null, pace: { x: 0, y: 0 }, was: null, throws: 0 };
    return true;
  },
  /** Free to start a blow: no warning, dash or blow still to come, and its last one done. */
  ttFree(e) { return !!e && e.hp > 0 && !e.tell && !e.dash && !e.followup && this.s.time >= (e.busyUntil || 0) && this.s.time >= (e.ready || 0) && !(e.exposedUntil > this.s.time); },

  /**
   * What a tell needs when it starts: its pose, and for Tick's thrust and dash an aim ahead of F2 (2026-11-19, the
   * user's word: they were dodged by walking on): where she will be leadSeconds on at the pace she keeps, at most
   * leadMax away, so walking on is hit and stopping or turning back is not.
   */
  ttTell(enemy, tell) {
    enemy.tellPose = POSES[tell.type] || null;
    const ai = this.ttAI(enemy), lead = ai?.leadSeconds?.[tell.type];
    if (lead) {
      const v = this.ttPace(enemy), k = Math.min(1, ai.leadMax / Math.max(1e-6, Math.hypot(v.x, v.y) * lead));
      const at = { x: this.p.x + v.x * lead * k, y: this.p.y + v.y * lead * k };
      tell.angle = enemy.facing = angleTo(enemy, at); tell.targetX = at.x; tell.targetY = at.y;
    }
  },
  /** F2's pace (floor units a second), smoothed over about a fifth of a second (kept on the lead's metronome, ttStep). */
  ttPace(enemy) { return this.ttLead(enemy)?.metronome?.pace || { x: 0, y: 0 }; },

  /**
   * Each step of a twin (factory-bosses.js fbStep): the lead keeps the beat and starts the patterns; each twin walks to
   * its distance from F2 while it has nothing to do, and carries on a combo. Always true: the game's own walk and
   * pattern pick stay out of it.
   */
  ttStep(enemy, dt) {
    const ai = this.ttAI(enemy), t = this.s.time, p = this.p;
    const m = enemy.metronome;
    if (m && dt > 0) {
      // F2's pace, for the thrust's and the dash's aim (ttTell); a dodge's burst counts like walking.
      const was = m.was || p, pace = m.pace, k = Math.min(1, dt / 0.2);
      m.pace = { x: pace.x + ((p.x - was.x) / dt - pace.x) * k, y: pace.y + ((p.y - was.y) / dt - pace.y) * k };
      m.was = { x: p.x, y: p.y };
    }
    if (m) this.ttConduct(enemy, ai);
    const lead = this.ttLead(enemy);
    enemy.swing = lead?.swing ?? 0;
    // While they shuffle both wear grey, so only following them with the eye tells which is which.
    const shuffle = (this.s.bossFields || []).find(f => f.kind === 'ttShuffle');
    enemy.sprite = shuffle && t >= shuffle.grey && t < shuffle.reveal ? 'ttgray' : enemy.look;
    // The thrust's second and third blows. (The game's own followup never reaches them: ttStep returning true skips it.)
    if (enemy.followup && !enemy.tell && !enemy.dash) {
      const next = enemy.followup; enemy.followup = null;
      this.beginEnemyTell(enemy, next.type, Math.max(0.12, next.at - t));
      return true;
    }
    // Through the pendulum and the giant metronome they do not stand by (2026-11-20, the user's word): they circle F2 on
    // opposite sides (jointOrbit away, turning jointTurn a second) while the twin whose beat it is throws gears at her
    // (ttConduct).
    const joint = lead?.metronome?.joint;
    if (joint && (joint.kind === 'pendulum' || joint.kind === 'blade') && dt > 0) {
      joint.spin ??= this.random() < 0.5 ? -1 : 1; joint.a0 ??= angleTo(p, lead);
      const a = joint.a0 + joint.spin * ai.jointTurn * (t - (joint.from ?? t)) + (enemy === lead ? 0 : Math.PI);
      const want = { x: p.x + Math.cos(a) * ai.jointOrbit, y: p.y + Math.sin(a) * ai.jointOrbit * FLOOR_FLAT }, d = distance(enemy, want);
      if (d > 0.05) { const step = Math.min(d, ai.speed * 1.4 * dt); this.move(enemy, (want.x - enemy.x) / d * step, (want.y - enemy.y) / d * step); }
      face(enemy, angleTo(enemy, p));
      return true;
    }
    if (enemy.tell || enemy.dash || lead?.metronome?.joint) return true;
    // Red closes in to thrust; blue keeps a sweep's length away and gives ground when F2 comes too near.
    const d = distance(enemy, p), stand = enemy.look === 'tick' ? ai.redStand : ai.blueStand, a = angleTo(enemy, p);
    enemy.facing = a;
    let step = 0;
    if (d > stand + 0.3) step = ai.speed * dt;
    else if (d < stand - 1 && enemy.look === 'tock') step = -ai.speed * 0.6 * dt;
    if (step) {
      const way = step > 0 && d > 2 ? this.flowField?.heading(enemy.x, enemy.y) ?? a : a;
      this.move(enemy, Math.cos(way) * step, Math.sin(way) * step);
    }
    return true;
  },
  /** The lead's beat: counts beats, swings the metronome, and on each beat lets the twin whose beat it is act. */
  ttConduct(lead, ai) {
    const m = lead.metronome, t = this.s.time, beat = this.ttBeat(lead);
    if (m.next === null) { m.next = Math.max(t, lead.ready || t); m.zero = m.next; }
    lead.swing = (((t - m.zero) / (beat * 2)) % 1 + 1) % 1;
    if (m.joint && t >= m.joint.until) m.joint = null;
    // Off the beat (2026-11-19, the user's word: the rhythm alone made them easy): now and then the next beat's solo blow
    // starts half a beat early (offbeatShare, more in phase 2), and that beat itself then passes without one.
    if (t < m.next) {
      if (!m.joint && m.early === undefined && t >= m.next - beat / 2) m.early = this.random() < (m.phase === 2 ? ai.offbeatShare2 : ai.offbeatShare) ? m.count + 1 : null;
      if (m.early === m.count + 1 && t >= m.next - beat / 2) { m.early = -1; if (!this.ttSolo(lead, ai, m.count + 1)) m.early = null; }
      return;
    }
    m.count++; m.next = m.next + beat < t ? t + beat : m.next + beat; m.beatAt = t;
    // The beat, heard (2026-11-19): a tick on Tick's beat, a lower tock on Tock's.
    this.sense({ kind: 'boss', id: m.count % 2 ? 'ttBeatTock' : 'ttBeatTick' });
    const early = m.early; m.early = undefined;
    if (m.joint) {
      // Phase 2's giant metronome: a twin throws a gear at F2 every overlapBeats beats (2026-11-19, the user's word:
      // something else to mind while it swings). The pendulum too, since 2026-11-20 (they move round F2 through both,
      // ttStep). They take turns throw by throw (2026-11-21: picked by the beat, with overlapBeats even only Tick threw).
      if ((m.joint.kind === 'blade' || m.joint.kind === 'pendulum') && m.count % ai.overlapBeats === 0) {
        const body = this.ttLook(m.throws++ % 2 ? 'tock' : 'tick');
        if (body && !body.hidden) { this.ttGear(body, angleTo(body, this.p), ai.gearSpeed, ai.gearReach + 6); this.effect('spark', body.x, body.y - 1, LOOKS[body.look], 0.3, 0.8); this.sense({ kind: 'boss', id: 'ttGearThrow' }); }
      }
      return;
    }
    if (early === -1) return;
    const red = this.ttLook('tick'), blue = this.ttLook('tock');
    if (!red || !blue) return;
    const round = m.phase === 2 ? ai.round2 : ai.round, step = round[m.step % round.length], under = this.ttUnder();
    // The echo runs under the other blows: it starts on any beat and takes none of them (a second one waits). The hour
    // count did too until it was taken out (user's word, 2026-11-15).
    if (UNDER[step]) { if (!under) { m.step++; this.ttEchoStart(lead, ai, beat); } return; }
    if (STEPS[step] && !STEPS[step].actor) {
      if (under || !this.ttFree(red) || !this.ttFree(blue)) return;
      m.step++; this.ttJoint(lead, step, red, blue, ai, beat); return;
    }
    this.ttSoloBlow(m, step, m.count, red, blue);
  },
  /** Starts the round's next step early, for beat `count`, if it is a solo blow that twin can make now. */
  ttSolo(lead, ai, count) {
    const m = lead.metronome, red = this.ttLook('tick'), blue = this.ttLook('tock');
    if (!red || !blue || this.ttUnder()) return false;
    const round = m.phase === 2 ? ai.round2 : ai.round, actor = this.ttSoloBlow(m, round[m.step % round.length], count, red, blue);
    // A gold glint over the twin: this one is off the beat.
    if (actor) this.effect('spark', actor.x, actor.y - 2.2, '#ffd257', 0.35, 1);
    return !!actor;
  },
  /** Starts solo step `step` if beat `count` is its twin's and both twins are free; returns the twin, or null. */
  ttSoloBlow(m, step, count, red, blue) {
    const info = STEPS[step];
    if (!info?.actor || info.actor !== (count % 2 ? 'tock' : 'tick') || !this.ttFree(red) || !this.ttFree(blue)) return null;
    const actor = info.actor === 'tick' ? red : blue;
    m.step++; this.beginEnemyTell(actor, info.tell);
    return actor;
  },
  /** The patterns both twins stop for. */
  ttJoint(lead, step, red, blue, ai, beat) {
    const m = lead.metronome, t = this.s.time;
    let until = t;
    if (step === 'pendulum') {
      // Both stand still while the metronomes swing wide. The floor on one side of a line blows, then the other, on the
      // beat, four times. Each line is drawn through F2 as its warning begins and the blow reaches a little past it
      // (pendulumOverlap), so wherever F2 stands she has to cross over each beat (2026-11-15: halves of the room were
      // dodged by standing near its middle).
      const place = this.fbGridPlace(), first = this.random() < 0.5 ? -1 : 1, start = t + ai.pendulumWarn;
      const blasts = Array.from({ length: ai.pendulumBlasts }, (_, i) => ({ side: i % 2 ? -first : first, at: start + i * beat, line: i ? null : this.p.x, done: false }));
      this.fbField({ kind: 'ttPendulum', owner: lead.id, cy: place.cy, reach: place.radii.at(-1), overlap: ai.pendulumOverlap, blasts, damage: this.fbFixed(ai.pendulumDamage), from: t });
      until = blasts.at(-1).at + 0.2;
    }
    if (step === 'shuffle') {
      // The shell game: the twins glide to two spots, show their colours, and one of them (either) lights a golden
      // wind-up key on its back: the bomb. They turn grey and change places a few times (some only feint); then the bomb
      // bursts and only beside the other is safe (2026-11-15: it was always Tick, so following Tock was enough).
      const place = this.fbGridPlace(), centre = { x: place.cx, y: place.cy }, spread = ai.shuffleSpread;
      const spots = [-1, 1].map(k => this.fbFloor(place.cx + k * spread, place.cy, centre, 1));
      const bodies = this.random() < 0.5 ? [red, blue] : [blue, red], count = this.bossRepeat(lead, 'ttShuffles') || ai.shuffles, each = this.bossRepeat(lead, 'ttShuffleStep') || ai.shuffleStep;
      const grey = t + SHUFFLE_GATHER + SHUFFLE_SHOW, moves = Array.from({ length: count }, (_, i) => ({ swap: this.random() < ai.shuffleSwapShare, start: grey + i * each, end: grey + (i + 1) * each }));
      if (!moves.some(mv => mv.swap)) moves[Math.floor(this.random() * count)].swap = true;
      const reveal = grey + count * each + SHUFFLE_HOLD;
      const bomb = (this.random() < 0.5 ? red : blue).id;
      this.fbField({ kind: 'ttShuffle', owner: lead.id, ids: bodies.map(b => b.id), bomb, from: bodies.map(b => ({ x: b.x, y: b.y })), spots, start: t, grey, moves, reveal, radius: ai.shuffleRadius, damage: this.fbFixed(ai.shuffleDamage) });
      until = reveal + 0.3;
    }
    if (step === 'blade') {
      // Phase 2: a giant metronome hangs over the top of the hall, above where F2 stands, and swings its weight across
      // the floor, bladeSwings times, each swing ttBladeSwing seconds by difficulty (1.4, 1.2, 1.0; it quickened to one
      // beat for a while on 2026-11-15, too hard). The floor under it is cut into bladeZones bands across the swing; a weight
      // rides the rod in every band but one, the free one, and they slide for each swing (shown a swing ahead). The free
      // band moves one band in or out each swing, never staying put (four bands, the user's call the same day):
      // stand at the free height or roll through as they come. The inner weight's band reaches up to the pivot, so
      // there is no hiding under it (2026-11-15, the user's pick in place of the crossed pendulum; two weights the same
      // day: one weight was too easy).
      const { room, box } = this.ttReachBox(), pivot = { x: Math.max(box.left + 4, Math.min(box.right - 4, this.p.x)), y: room.top - ai.bladeAbove };
      const length = room.bottom - pivot.y + 0.5, amp = ai.bladeDegrees * Math.PI / 180, first = this.random() < 0.5 ? -1 : 1, start = t + ai.bladeWarn, slots = ai.bladeZones;
      let free = Math.floor(this.random() * slots), at = start;
      const each = this.bossRepeat(lead, 'ttBladeSwing') || ai.bladeSwingSeconds;
      const swings = Array.from({ length: ai.bladeSwings }, (_, i) => {
        if (i) free = free === 0 ? 1 : free === slots - 1 ? free - 1 : free + (this.random() < 0.5 ? -1 : 1);
        const weights = this.ttBladeWeights(length, free);
        const swing = { from: (i % 2 ? -first : first) * amp, to: (i % 2 ? first : -first) * amp, start: at, end: at + each, free, weights, ...bladeBands(weights), hit: false };
        at = swing.end;
        return swing;
      });
      this.fbField({ kind: 'ttBlade', owner: lead.id, pivot, length, amp, half: ai.bladeHalf, swings, from: t, start, last: t, damage: this.fbFixed(ai.bladeDamage) });
      until = swings.at(-1).end + 0.2;
    }
    if (step === 'pincer') {
      // Phase 2: the twins take opposite ends of a ring round F2 and wheel round it. The ring is a fence but for one gap
      // between them that turns with them; on each beat the twin whose beat it is jabs inward, and after a few beats both
      // close in on the middle. Get out through the gap. The ring starts wide (pincerRadiusStart) and draws in to
      // pincerRadius as they wheel (2026-11-15, the user's word).
      // The ring sits round F2, drawn toward the room's middle only as far as it takes to keep most of it on the floor.
      const place = this.fbGridPlace(), room = { x: place.cx, y: place.cy }, open = at => !this.map?.walkable || fitsMap(at.x, at.y, 0.5, this.map);
      let c = room;
      for (let k = 1; k >= 0; k -= 0.1) {
        const at = lerp(room, this.p, k), on = Array.from({ length: 8 }, (_, i) => ({ x: at.x + Math.cos(i * Math.PI / 4) * ai.pincerRadiusStart, y: at.y + Math.sin(i * Math.PI / 4) * ai.pincerRadiusStart * FLOOR_FLAT })).filter(open).length;
        if (open(at) && on >= 6) { c = at; break; }
      }
      const turn = this.random() * Math.PI * 2, spin = this.random() < 0.5 ? -1 : 1, orbit = t + ai.pincerGather;
      const jabs = Array.from({ length: ai.pincerBeats }, (_, i) => ({ id: (i % 2 ? blue : red).id, at: orbit + (i + 1) * beat, done: false }));
      this.fbField({ kind: 'ttPincer', owner: lead.id, x: c.x, y: c.y, r: ai.pincerRadiusStart, r0: ai.pincerRadiusStart, r1: ai.pincerRadius, ids: [red.id, blue.id], from: [{ x: red.x, y: red.y }, { x: blue.x, y: blue.y }], turn, spin, start: t, orbit, jabs, close: orbit + (ai.pincerBeats + 0.6) * beat, gap: ai.pincerGapDegrees * Math.PI / 180, hitNext: 0, damage: this.fbFixed(ai.pincerDamage), jabDamage: Math.round(this.weakened(red, red.damage * ai.thrustDamage)) });
      until = orbit + (ai.pincerBeats + 0.6) * beat + 0.45;
    }
    if (step === 'flank') {
      // Both blink out and back in at opposite ends of the room (left and right, or top and bottom) and take turns, on
      // the beat (every flankBeats beats: 2 since 2026-11-15, one was too tight), sending a wall of gears right across it,
      // each with one gap somewhere else. One pair of ends a time, phase 2 only sends more walls (2026-11-15: switching
      // ends half way left walls from all four sides crossing with no way through).
      // In a long hall the ends they take are at most flankReach from its middle, so both stay in sight; their walls
      // still fly on to the far wall.
      // (One blink and one pair of ends, 2026-11-21: the loop over several legs, each switching ends, ran only once.)
      const { room, box, cx, cy } = this.ttReachBox(), count = m.phase === 2 ? ai.flankWalls2 : ai.flankWalls, centre = { x: cx, y: cy };
      const low = this.random() < 0.5 ? red : blue, axis = this.random() < 0.5 ? 'x' : 'y', back = t + FLANK_BLINK;
      const [lo, hi] = axis === 'x' ? [box.top, box.bottom] : [box.left, box.right], mid = (lo + hi) / 2;
      const ends = axis === 'x' ? [{ x: box.left, y: mid }, { x: box.right, y: mid }] : [{ x: mid, y: box.top }, { x: mid, y: box.bottom }];
      const spots = ends.map(at => this.fbFloor(at.x, at.y, centre, 0.8));
      const blink = { vanish: t, back, axis, spots: { [low.id]: spots[0], [(low === red ? blue : red).id]: spots[1] }, done: false };
      // Gaps only in the middle of the floor (2026-11-18: one at the very edge of a floor whose corners are cut, as the
      // stair engine room's are, could leave nowhere to stand), each flankShift to flankShiftMax from the last, so the
      // next one is always a short run away rather than across the room in one beat.
      const edgeIn = Math.max(1.2, (hi - lo) * 0.2), g0 = lo + edgeIn, g1 = hi - edgeIn, most = ai.flankShiftMax ?? ai.flankShift + 2, walls = [];
      let gap = null;
      for (let i = 0; i < count; i++) {
        if (gap === null) gap = g0 + this.random() * (g1 - g0);
        else {
          const shift = ai.flankShift + this.random() * Math.max(0, most - ai.flankShift);
          let way = this.random() < 0.5 ? -1 : 1;
          if (gap + way * shift > g1 || gap + way * shift < g0) way = -way;
          gap = Math.max(g0, Math.min(g1, gap + way * shift));
        }
        const body = i % 2 ? blue : red, side = body === low ? -1 : 1;
        const edge = axis === 'x' ? (side < 0 ? box.left : box.right) : (side < 0 ? box.top : box.bottom);
        const far = side < 0 ? (axis === 'x' ? room.right : room.bottom) - edge : edge - (axis === 'x' ? room.left : room.top);
        walls.push({ axis, id: body.id, side, edge, far, lo, hi, gap, at: back + ai.flankWarn + i * beat * ai.flankBeats, done: false });
      }
      this.fbField({ kind: 'ttFlank', owner: lead.id, ids: [red.id, blue.id], box, room, blink, walls, half: ai.flankGap / 2, from: t });
      until = walls.at(-1).at + 0.5;
    }
    m.joint = { kind: step, until, from: t };
    for (const e of [red, blue]) { this.beginEnemyTell(e, STEPS[step].tell, until - t); e.busyUntil = until; }
  },

  /** The twins' blows. Returns true when the tell was one of theirs. */
  ttExecute(enemy, tell) {
    const ai = this.ttAI(enemy);
    if (!ai) return false;
    const p = this.p, t = this.s.time, R = this.config.arena.playerRadius, beat = this.ttBeat(enemy);
    const damage = (k = 1) => !p.dodge && this.hurt(Math.round(this.weakened(enemy, enemy.damage * k)));
    switch (tell.type) {
      case 'ttThrust': case 'ttThrust2': case 'ttThrust3': {
        // Three thrusts, each a step closer and aimed anew; the third comes half a beat late.
        const lunge = Math.min(ai.thrustLunge, Math.max(0, distance(enemy, p) - 1));
        this.move(enemy, Math.cos(tell.angle) * lunge, Math.sin(tell.angle) * lunge);
        const end = { x: enemy.x + Math.cos(tell.angle) * ai.thrustLength, y: enemy.y + Math.sin(tell.angle) * ai.thrustLength };
        this.effect('beam', enemy.x, enemy.y, '#e0564c', 0.34, 1, { targetX: end.x, targetY: end.y, look: 'ttStab' });
        if (segmentDistance(p, enemy, end) <= ai.thrustWidth + R) damage(ai.thrustDamage);
        if (tell.type === 'ttThrust') { enemy.followup = { type: 'ttThrust2', at: t + ai.thrustGap }; enemy.busyUntil = t + ai.thrustGap * 2 + beat / 2 + 0.15; }
        if (tell.type === 'ttThrust2') enemy.followup = { type: 'ttThrust3', at: t + ai.thrustGap + beat / 2 };
        enemy.ready = t + 0.1;
        return true;
      }
      case 'ttSweep': {
        // The minute hand sweeps the half circle in front; three gears fly out from its end and bounce once off a wall.
        if (inCone(tell, p, tell.angle, ai.sweepRange, ai.sweepDegrees)) damage(ai.sweepDamage);
        enemy.sweepFx = { at: t, x: tell.x, y: tell.y, angle: tell.angle }; // the minute hand's slash (clock-boss-draw.js)
        for (let i = 0; i < ai.gearShots; i++) this.ttGear(enemy, tell.angle + (i - (ai.gearShots - 1) / 2) * ai.gearSpread * Math.PI / 180, ai.gearSpeed, ai.gearReach, ai.gearBounces);
        enemy.busyUntil = t + 0.5;
        return true;
      }
      case 'ttDash':
        // Red runs straight across along the line it showed, throwing gears to both sides as it goes and all round
        // where it stops (ttDashStep, ttDashDone): stepping off the line is not enough.
        enemy.dashDistance = ai.dashLength; enemy.dashDuration = ai.dashSeconds; enemy.dash = { angle: tell.angle, elapsed: 0, tt: true, dropped: 0 };
        enemy.busyUntil = t + ai.dashSeconds + 0.4;
        return true;
      case 'ttPendulum': case 'ttShuffle': case 'ttPincer': case 'ttFlank': case 'ttBlade': return true; // the floor blows on its own time (tickClockBoss)
    }
    return false;
  },
  /** One gear shot from a twin. */
  ttGear(enemy, angle, speed, reach, bounces = 0) {
    const ai = this.config.bossAI.twinTickTock;
    this.s.projectiles.push({ id: this.id('bullet'), x: enemy.x + Math.cos(angle) * 0.5, y: enemy.y + Math.sin(angle) * 0.5, angle, speed, radius: ai.gearRadius, damage: this.weakened(enemy, enemy.damage * ai.gearDamage), friendly: false, until: this.s.time + reach / speed, look: 'gear', bounces });
  },
  /** During red's dash (factory-mobs.js factoryDash): a pair of gears out to both sides at even steps along the run. */
  ttDashStep(enemy) {
    const ai = this.ttAI(enemy), d = enemy.dash;
    if (!ai || !d?.tt) return;
    const u = d.elapsed / enemy.dashDuration;
    while (d.dropped < ai.dashGearDrops && u >= (d.dropped + 1) / (ai.dashGearDrops + 1)) {
      d.dropped++;
      for (const k of [-1, 1]) this.ttGear(enemy, d.angle + k * Math.PI / 2, ai.dashGearSpeed, ai.dashGearReach);
    }
  },
  /** Red's dash is over: a ring of gears from where it stopped. */
  ttDashDone(enemy, d) {
    const ai = this.ttAI(enemy), angle = d?.angle ?? enemy.facing ?? 0;
    if (!ai) return;
    for (let i = 0; i < ai.dashGearBurst; i++) this.ttGear(enemy, angle + Math.PI / ai.dashGearBurst + i * Math.PI * 2 / ai.dashGearBurst, ai.dashGearSpeed, ai.dashGearReach);
    this.effect('ring', enemy.x, enemy.y, '#e0564c', 0.7, 1.2, { look: 'ttBurst' }); this.sense({ kind: 'burst' });
  },
  /** A blow landing on a twin: the health they share. */
  ttHit(enemy, amount, options) {
    const other = this.ttAI(enemy) && this.ttPartner(enemy);
    if (!other) return;
    if (enemy.hp <= 0) this.ttFalls(other);
    other.hp = enemy.hp; if (!options.dot) other.flashUntil = enemy.flashUntil;
  },
  /** The other twin goes down with the one that fell: its parts fly too. */
  ttFalls(other) {
    if (other.hp <= 0) return;
    other.tell = null; other.dash = null; other.followup = null; other.hidden = false;
    this.effect('parts', other.x, other.y, other.color || '#dbbc6b', 0.9, 14, { angle: angleTo(this.p, other), big: true });
  },

  /** Each frame of the twins' floor patterns (FIELD_STEPS: pendulum, shuffle, giant metronome, echo, pincer, flank), from tickFactoryBoss. */
  tickClockBoss() {
    const s = this.s, t = s.time;
    for (const f of s.bossFields || []) {
      const step = FIELD_STEPS[f.kind];
      if (!step) continue;
      const owner = s.enemies.find(e => e.id === f.owner);
      if (!owner || owner.hp <= 0) { if (f.kind === 'ttFlank') this.ttFlankStep(f, t); f.done = true; continue; }
      this[step](f, t);
      if (!this.active) return;
    }
  },
  /** The pendulum's floor: each blast's line drawn through F2 as the one before it blows, then its side blowing on the beat. */
  ttPendulumStep(f, t) {
    const p = this.p;
    for (const [i, b] of f.blasts.entries()) {
      if (b.done) continue;
      if (b.line === null) { if (f.blasts[i - 1]?.done) b.line = p.x; else break; }
      if (t < b.at) break;
      b.done = true;
      if (!p.dodge && this.ttBlown(f, b, p.x)) this.hurt(f.damage);
      for (let k = 0; k < 3; k++) { this.effect('ring', b.line + b.side * (1.5 + k * 3), f.cy, '#e0564c', 0.7, 1.4, { look: 'ttBurst' }); this.bossQuake(b.line + b.side * (1.5 + k * 3), f.cy, { power: 0.8, color: '#e0564c', reach: 1.8, feel: k === 0 }); }
      this.sense({ kind: 'boss', id: 'ttPendulumBlast' });
      if (!this.active) return;
    }
    if (f.blasts.every(b => b.done)) f.done = true;
  },
  /** True when the floor at `x` is on the blown side of a pendulum blast (its line, reaching `overlap` past it). */
  ttBlown(f, b, x) { return b.side > 0 ? x > b.line - f.overlap : x < b.line + f.overlap; },
  /** Where each twin of a shuffle stands now: gliding to its spot, then trading places (or feinting) on arcs. */
  ttShufflePlaces(f, t) {
    const places = [];
    for (let i = 0; i < 2; i++) {
      if (t < f.grey - SHUFFLE_SHOW) { places.push(lerp(f.from[i], f.spots[i], Math.min(1, (t - f.start) / SHUFFLE_GATHER))); continue; }
      let slot = i, at = f.spots[slot];
      for (const mv of f.moves) {
        if (t >= mv.end) { if (mv.swap) slot = 1 - slot; at = f.spots[slot]; continue; }
        if (t < mv.start) break;
        // A feint goes most of the way across and comes back; the two pass on opposite arcs.
        const u = (t - mv.start) / (mv.end - mv.start), w = mv.swap ? (1 - Math.cos(u * Math.PI)) / 2 : Math.sin(u * Math.PI) * 0.6;
        const from = f.spots[slot], to = f.spots[1 - slot], arc = Math.sin(w * Math.PI) * 1.6 * (slot ? 1 : -1);
        at = { x: from.x + (to.x - from.x) * w, y: from.y + (to.y - from.y) * w + arc * FLOOR_FLAT * 1.4 };
        break;
      }
      places.push(at);
    }
    return places;
  },
  ttShuffleStep(f, t) {
    const p = this.p, R = this.config.arena.playerRadius, bodies = this.ttBodies(f);
    if (!bodies) { f.done = true; return; }
    if (t < f.reveal) {
      this.ttShufflePlaces(f, t).forEach((at, i) => { const e = bodies[i], was = { x: e.x, y: e.y }; e.x = at.x; e.y = at.y; face(e, Math.hypot(at.x - was.x, at.y - was.y) > 1e-3 ? angleTo(was, at) : e.facing); });
      return;
    }
    f.done = true;
    // The one with the key bursts; outside the other's circle the floor goes too. A dodge does not help.
    const bomb = bodies.find(e => e.id === f.bomb), keep = bodies.find(e => e !== bomb);
    const safe = floorDistance(p, keep) < f.radius + R * 0.5 && floorDistance(p, bomb) >= f.radius + R * 0.5;
    if (!safe) { p.invulnerableUntil = 0; this.hurt(f.damage); }
    this.sense({ kind: 'boss', id: 'ttShuffleBurst' });
    this.effect('ring', bomb.x, bomb.y, LOOKS[bomb.look], 0.7, f.radius * 1.6, { look: 'ttBurst' }); this.effect('spark', keep.x, keep.y - 1, '#7fe0a0', 0.5, 1.2);
    this.bossQuake(bomb.x, bomb.y, { power: 1.2, color: LOOKS[bomb.look], reach: f.radius * 1.6, pillar: true });
    this.sense({ kind: 'heavy' });
  },
  /**
   * The giant metronome's weights for a swing with band `free` left empty. The floor under the rod (from bladeAbove,
   * the room's top, to the bottom) is cut into bladeZones equal bands; a weight sits in the middle of each other band
   * and sweeps all of it, the innermost on up to the pivot and the outermost on past the tip, so only the free band is
   * safe (2026-11-15: thin gaps between the bands, and the floor past the tip, were safe too).
   */
  ttBladeWeights(length, free) {
    const ai = this.config.bossAI.twinTickTock, n = ai.bladeZones, top = ai.bladeAbove, each = (length - 0.5 - top) / n;
    return Array.from({ length: n }, (_, k) => ({ n: k, r: top + (k + 0.5) * each, lo: k === 0 ? 0 : top + k * each, hi: k === n - 1 ? Infinity : top + (k + 1) * each })).filter(w => w.n !== free);
  },
  /** The giant metronome's swing at `t`, as its angle from straight down: raised during the warning, then swinging. */
  ttBladeAngle(f, t) {
    const s = f.swings.find(x => t < x.end) || f.swings.at(-1);
    if (t < f.start) return s.from * Math.min(1, (t - f.from) / (f.start - f.from));
    const u = Math.max(0, Math.min(1, (t - s.start) / (s.end - s.start)));
    return s.from + (s.to - s.from) * (1 - Math.cos(u * Math.PI)) / 2;
  },
  /** Each frame of the giant metronome: whoever its weight swept past since the last frame is hit (a dodge goes through). */
  ttBladeStep(f, t) {
    const p = this.p, R = this.config.arena.playerRadius, last = f.last;
    f.last = t;
    // Each swing sets off with a low rumble under its sound (the metronome is as tall as the room).
    for (const s of f.swings) if (!s.started && t >= s.start) { s.started = true; this.sense({ kind: 'boss', id: 'ttBladeSwing' }); this.sense({ kind: 'quake', power: 0.35, color: '#e0564c' }); }
    const s = f.swings.find(x => t >= x.start && last < x.end && !x.hit);
    if (s) {
      const a0 = this.ttBladeAngle(f, Math.max(last, s.start)), a1 = this.ttBladeAngle(f, Math.min(t, s.end));
      const d = Math.hypot(p.x - f.pivot.x, p.y - f.pivot.y), at = Math.atan2(p.x - f.pivot.x, p.y - f.pivot.y), pad = R / Math.max(1, d);
      if (s.weights.some(w => d > w.lo - R && d < w.hi + R) && at >= Math.min(a0, a1) - pad && at <= Math.max(a0, a1) + pad && !p.dodge) {
        s.hit = true; this.hurt(f.damage);
        this.effect('ring', p.x, p.y, '#e0564c', 0.7, 1.2, { look: 'ttBurst' });
        if (!this.active) return;
      }
    }
    if (t >= f.swings.at(-1).end) f.done = true;
  },

  /**
   * Phase 2's echo: F2's own footsteps come back. On each beat a clock mark lands where she stands and blows echoDelay
   * beats later, so standing still is hit and so is stepping back onto a mark. It runs under the twins' other blows
   * (2026-11-15, the user's pick).
   */
  ttEchoStart(lead, ai, beat) {
    // The marks land on the metronome's own beats (2026-11-18: they ran from start + echoWarn, which drifted off the beat
    // where a level beats faster than echoWarn, so the echo felt out of time with the twins).
    const next = lead.metronome?.next, start = next > this.s.time ? next : this.s.time + ai.echoWarn;
    const marks = Array.from({ length: ai.echoMarks }, (_, i) => ({ at: start + i * beat, blow: start + (i + ai.echoDelay) * beat, x: null, y: null, done: false }));
    this.fbField({ kind: 'ttEcho', owner: lead.id, marks, radius: ai.echoRadius, beat, damage: this.fbFixed(ai.echoDamage), from: this.s.time });
  },
  ttEchoStep(f, t) {
    const p = this.p, R = this.config.arena.playerRadius;
    for (const m of f.marks) {
      if (m.x === null && t >= m.at) { m.x = p.x; m.y = p.y; this.effect('spark', m.x, m.y - 0.3, '#ffd257', 0.3, 0.8); }
      if (m.x === null || m.done || t < m.blow) continue;
      m.done = true;
      // The burst as wide as it hurts (it was drawn 1.4x the reach, so a dodge looked like a hit).
      this.effect('ring', m.x, m.y, '#e0564c', 0.7, f.radius + R * 0.5, { look: 'ttBurst' }); this.sense({ kind: 'boss', id: 'ttEchoBlow' });
      this.bossQuake(m.x, m.y, { power: 0.35, color: '#e0564c', reach: f.radius });
      if (!p.dodge && floorDistance(p, m) < f.radius + R * 0.5) { this.hurt(f.damage); if (!this.active) return; }
    }
    if (f.marks.every(m => m.done)) f.done = true;
  },

  /**
   * Where the pincer's twins stand: gliding to the ring, wheeling round it, then closing on the middle. Where the ring
   * runs off the floor each is pulled in toward its middle until it stands on floor (2026-11-21: they went into walls).
   */
  ttPincerPlaces(f, t) {
    const ai = this.config.bossAI.twinTickTock, at = a => ({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r * FLOOR_FLAT });
    const a0 = this.ttPincerTurn(f, Math.min(t, f.close));
    return [a0, a0 + Math.PI].map((a, i) => {
      const want = t < f.orbit ? lerp(f.from[i], at(a), Math.min(1, (t - f.start) / (f.orbit - f.start)))
        : t >= f.close ? lerp(at(a), { x: f.x, y: f.y }, Math.min(1, (t - f.close) / ai.pincerCloseSeconds) * 0.85) : at(a);
      return this.fbFloor(want.x, want.y, f);
    });
  },
  /** How far the pincer has wheeled: red's angle round the ring (blue is opposite, the gap a quarter turn ahead). */
  ttPincerTurn(f, t) { return f.turn + f.spin * this.config.bossAI.twinTickTock.pincerTurn * Math.max(0, t - f.orbit); },
  /** True when angle `a` round the pincer's ring is in its gap. */
  ttPincerGap(f, t, a) { const d = ((a - this.ttPincerTurn(f, t) - f.spin * Math.PI / 2) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; return Math.abs(d) < f.gap; },
  ttPincerStep(f, t) {
    const ai = this.config.bossAI.twinTickTock, p = this.p, R = this.config.arena.playerRadius, bodies = this.ttBodies(f);
    if (!bodies) { f.done = true; return; }
    // The ring draws in from wide to narrow while they wheel round it.
    f.r = f.r0 + (f.r1 - f.r0) * Math.max(0, Math.min(1, (t - f.orbit) / (f.close - f.orbit)));
    this.ttPincerPlaces(f, t).forEach((at, i) => { const e = bodies[i]; e.x = at.x; e.y = at.y; face(e, angleTo(e, f)); });
    // The ring holds F2 in, but for its gap: walking (or dodging) into it elsewhere puts her back inside and stings. The
    // ring closing on her only pushes her in; it stings when she walks out into it. She is put back only onto floor
    // (2026-11-21: where the ring ran over a wall she was put inside it); where it is not, the wall holds her.
    const dx = p.x - f.x, dy = (p.y - f.y) / FLOOR_FLAT, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), outward = d > (f.lastD ?? d) + 1e-3;
    f.inside ??= d < f.r;
    if (f.inside && t < f.close) {
      if (d > f.r + 0.3) f.inside = false;
      else if (d > f.r - 0.25 && !this.ttPincerGap(f, t, a)) {
        const back = { x: f.x + Math.cos(a) * (f.r - 0.3), y: f.y + Math.sin(a) * (f.r - 0.3) * FLOOR_FLAT };
        if (!this.map?.walkable || fitsMap(back.x, back.y, R, this.map)) Object.assign(p, back);
        if (outward && t >= f.hitNext && this.hurt(this.fbFixed(ai.pincerFenceDamage))) f.hitNext = t + 0.6;
        if (!this.active) return;
      }
    }
    f.lastD = Math.hypot(p.x - f.x, (p.y - f.y) / FLOOR_FLAT);
    for (const jab of f.jabs) {
      if (jab.done || t < jab.at) continue;
      jab.done = true;
      const e = bodies.find(b => b.id === jab.id), angle = angleTo(e, f), end = { x: e.x + Math.cos(angle) * ai.pincerJab, y: e.y + Math.sin(angle) * ai.pincerJab };
      this.effect('beam', e.x, e.y, LOOKS[e.look], 0.34, 1, { targetX: end.x, targetY: end.y, look: 'ttStab' });
      if (!p.dodge && segmentDistance(p, e, end) <= ai.thrustWidth + R) this.hurt(f.jabDamage);
      if (!this.active) return;
    }
    if (t >= f.close + ai.pincerCloseSeconds && !f.closed) {
      f.closed = true;
      // Both reach the middle: inside the ring is struck, a dodge does not help.
      if (Math.hypot(p.x - f.x, (p.y - f.y) / FLOOR_FLAT) < f.r) { p.invulnerableUntil = 0; this.hurt(f.damage); }
      this.effect('ring', f.x, f.y, '#ffd257', 0.7, f.r, { look: 'ttBurst' }); this.sense({ kind: 'heavy' }); this.sense({ kind: 'boss', id: 'ttPincerClose' });
      this.bossQuake(f.x, f.y, { power: 1.1, color: '#ffd257', reach: f.r, pillar: true });
    }
    if (t >= f.close + ai.pincerCloseSeconds + 0.4) f.done = true;
  },

  // ---- the flank: from both ends of the room
  /** The fighting floor's box, a little in from its walls: where the flank's twins stand and its walls run. */
  ttFlankBox() {
    const { x, y, w, h } = this.fbArena(), pts = (this.map?.walkable || []).filter(([px, py]) => px >= x && px <= x + w && py >= y && py <= y + h);
    const xs = pts.map(pt => pt[0]), ys = pts.map(pt => pt[1]), inset = 0.8;
    if (!xs.length) return { left: x + inset, right: x + w - inset, top: y + inset, bottom: y + h - inset };
    return { left: Math.max(x, Math.min(...xs)) + inset, right: Math.min(x + w, Math.max(...xs)) - inset, top: Math.max(y, Math.min(...ys)) + inset, bottom: Math.min(y + h, Math.max(...ys)) - inset };
  },
  /**
   * The fighting floor's box (ttFlankBox), its middle, and `box`: the part of it at most flankReach from the middle, so
   * in a long hall the flank's ends, the giant metronome's pivot and the colour floor's columns stay in sight.
   */
  ttReachBox() {
    const room = this.ttFlankBox(), reach = this.config.bossAI.twinTickTock.flankReach, cx = (room.left + room.right) / 2, cy = (room.top + room.bottom) / 2;
    return { room, cx, cy, box: { left: Math.max(room.left, cx - reach), right: Math.min(room.right, cx + reach), top: Math.max(room.top, cy - reach), bottom: Math.min(room.bottom, cy + reach) } };
  },
  ttFlankStep(f, t) {
    const bodies = this.ttBodies(f), blink = f.blink;
    if (!bodies) { for (const e of this.s.enemies) if (f.ids.includes(e.id)) e.hidden = false; f.done = true; return; }
    if (t < blink.back) {
      // Gone: a puff where each stood, and nobody to hit until they are back.
      for (const e of bodies) if (!e.hidden) { e.hidden = true; this.effect('spark', e.x, e.y - 0.8, LOOKS[e.look], 0.35, 1.1); }
      return;
    }
    if (!blink.done) {
      blink.done = true;
      for (const e of bodies) { e.hidden = false; this.effect('ring', blink.spots[e.id].x, blink.spots[e.id].y, LOOKS[e.look], 0.7, 1.4, { look: 'ttBurst' }); }
      this.sense({ kind: 'boss', id: 'ttBlinkIn' });
    }
    // Each stands at its end, facing the other.
    bodies.forEach((e, i) => { Object.assign(e, blink.spots[e.id]); face(e, angleTo(e, blink.spots[bodies[1 - i].id])); });
    for (const w of f.walls) {
      if (w.done || t < w.at) continue;
      w.done = true;
      this.ttFlankWall(f, w, bodies.find(e => e.id === w.id));
    }
    if (f.walls.every(w => w.done)) f.done = true;
  },
  /** One wall of gears from a twin's end of the room to the other, with its gap. */
  ttFlankWall(f, w, body) {
    const ai = this.config.bossAI.twinTickTock, along = w.axis, across = along === 'x' ? 'y' : 'x', far = w.far;
    const angle = along === 'x' ? (w.side < 0 ? 0 : Math.PI) : (w.side < 0 ? Math.PI / 2 : -Math.PI / 2);
    const damage = this.weakened(body, body.damage * ai.flankDamage), speed = ai.flankSpeed;
    for (let u = w.lo; u <= w.hi + 1e-6; u += ai.flankSpacing) {
      if (Math.abs(u - w.gap) < f.half) continue;
      // The wall flies over crates and pillars (ghost): a straight line right across, its gap the only way through.
      const at = { [along]: w.edge, [across]: u };
      this.s.projectiles.push({ id: this.id('bullet'), x: at.x, y: at.y, angle, speed, radius: ai.gearRadius, damage, friendly: false, until: this.s.time + (far + 0.5) / speed, look: 'gear', bounces: 0, ghost: true });
    }
    this.effect('ring', body.x, body.y, LOOKS[body.look], 0.7, 1.2, { look: 'ttBurst' });
    this.sense({ kind: 'burst' }); this.sense({ kind: 'boss', id: 'ttFlankWall' });
    this.bossQuake(body.x, body.y, { power: 0.55, color: LOOKS[body.look], reach: 1.6 });
  },

  // ---- the phase break at half health: the colour floor
  /**
   * Both twins shield and stand in the middle; the floor splits into a grid of red and blue squares. Each call one twin
   * strikes a pose, Tick his thrust, Tock her sweep, the squares change colour, and when the pose ends every square of
   * the other colour blows: stand on red for Tick, blue for Tock. `need` of each, in a random order, ends it and phase
   * 2 begins; a miss stings and does not count. Called from fbBreakStart (2026-11-15, the user's idea: the tether was
   * beaten by walking to one side).
   */
  ttBreakStart(enemy, b, rule) {
    const lead = this.ttLead(enemy), other = lead && this.ttPartner(lead), t = this.s.time;
    if (!lead || !other) return;
    for (const e of [lead, other]) { e.tell = null; e.dash = null; e.followup = null; e.hidden = false; e.hp = enemy.hp; e.breaksDone ??= []; }
    lead.metronome.joint = null;
    // The grid: columns across the middle of the hall (flankReach either side), the outer two running on to its walls.
    const { room, box, cx, cy } = this.ttReachBox(), x0 = box.left, x1 = box.right;
    const xs =Array.from({ length: rule.columns + 1 }, (_, k) => x0 + (x1 - x0) * k / rule.columns), ys = Array.from({ length: rule.rows + 1 }, (_, k) => room.top + (room.bottom - room.top) * k / rule.rows);
    xs[0] = room.left - 2; xs[rule.columns] = room.right + 2; ys[0] -= 2; ys[rule.rows] += 2;
    const zones = [];
    for (let r = 0; r < rule.rows; r++) for (let c = 0; c < rule.columns; c++) zones.push({ c, r, x0: xs[c], x1: xs[c + 1], y0: ys[r], y1: ys[r + 1], colour: (r + c) % 2 ? 'tock' : 'tick' });
    const middle = this.fbFloor(cx, cy, { x: cx, y: cy }, 1), red = lead.look === 'tick' ? lead : other, blue = red === lead ? other : lead;
    Object.assign(red, this.fbFloor(middle.x - 1.2, middle.y, middle)); Object.assign(blue, this.fbFloor(middle.x + 1.2, middle.y, middle));
    // The squares they stand on are a plain grey dais, no colour (2026-11-19, the user's pick: red and blue bodies on
    // red and blue squares, and the caller's ring in its colour, could not be told apart). Standing there is a miss.
    for (const body of [red, blue]) { const z = zones.find(q => body.x >= q.x0 && body.x < q.x1 && body.y >= q.y0 && body.y < q.y1); if (z) z.colour = 'none'; }
    // The break's rule rides on it (2026-11-21: was looked up again every frame, here and in clock-boss-draw.js).
    Object.assign(b, { rule, zones, room, spots: { [red.id]: { x: red.x, y: red.y }, [blue.id]: { x: blue.x, y: blue.y } }, done: { tick: 0, tock: 0 }, need: rule.need, calls: 0, twists: this.ttTwists(rule), call: null, nextCall: t + rule.firstCall, shownAt: t });
    lead.breaking = b;
    other.breaking = { kind: b.kind, index: b.index, started: b.started, until: b.until, angle: b.angle, failAt: null, follower: true };
    this.notify(lead.breakFailed?.colours ? '보호막! 틱(빨강)이 찌르는 자세면 빨간 칸, 톡(파랑)이 휘두르는 자세면 파란 칸으로 피하세요.' : '틱: 우리 박자에 맞춰 춤춰 봐. 빨강엔 빨강, 파랑엔 파랑.');
  },
  /**
   * Which calls change colour a second time, twistWarn before they blow: about twistShare of the 2 × need calls, the
   * same number every time (rounded), never the first (2026-11-15, the user's word: now and then, but as often each
   * time). A call missed and made again does not twist.
   */
  ttTwists(rule) {
    const pool = Array.from({ length: rule.need * 2 - 1 }, (_, k) => k + 1), picks = [];
    for (let k = Math.min(pool.length, Math.round(rule.need * 2 * rule.twistShare)); k > 0; k--) picks.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return picks;
  },
  /** The square of the colour floor F2 stands on. */
  ttZoneAt(b, pt) { return b.zones.find(z => pt.x >= z.x0 && pt.x < z.x1 && pt.y >= z.y0 && pt.y < z.y1) || null; },
  /** New colours for a call: half each, no square without a neighbour of the other colour (the dais keeps none). */
  ttRecolour(b) {
    const coloured = b.zones.filter(z => z.colour !== 'none');
    for (let tries = 0; tries < 40; tries++) {
      const order = coloured.map((_, k) => k);
      for (let k = order.length - 1; k > 0; k--) { const m = Math.floor(this.random() * (k + 1)); [order[k], order[m]] = [order[m], order[k]]; }
      order.forEach((k, n) => { coloured[k].colour = n < coloured.length / 2 ? 'tick' : 'tock'; });
      const near = (a, z) => Math.abs(a.c - z.c) + Math.abs(a.r - z.r) === 1;
      if (coloured.every(z => coloured.some(a => near(a, z) && a.colour !== z.colour))) break;
    }
    b.shownAt = this.s.time;
  },
  /** Each frame of the colour floor (from updatePhaseBreak, for both twins; the lead runs it, the other follows). */
  ttBreakStep(enemy) {
    const b = enemy.breaking, t = this.s.time, p = this.p;
    if (b.follower) { const lead = this.ttPartner(enemy); if (!lead?.breaking || lead.breaking.follower) enemy.breaking = null; else { b.failAt = lead.breaking.failAt; b.until = lead.breaking.until; } return; }
    const rule = b.rule, twins = [enemy, this.ttPartner(enemy)].filter(e => e?.hp > 0);
    // Both stand on their dais in the middle facing the front (south) throughout, so their poses read plainly (they
    // glided round the floor for a day, 2026-11-19; back to standing still at the user's word, 2026-11-20).
    for (const e of twins) { Object.assign(e, b.spots[e.id]); face(e, Math.PI / 2); }
    if (b.failAt !== null) {
      // Out of time: a burst, the twins patch themselves, and the shield waits for half health again.
      if (t < b.failAt) return;
      if (this.hurt(rule.failDamage)) { this.effect('ring', enemy.x, enemy.y, '#a92f2b', 0.7, 9, { look: 'ttBurst' }); this.bossQuake(enemy.x, enemy.y, { power: 1.3, color: '#e0564c', reach: 4, pillar: true }); }
      const hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * rule.failHeal);
      for (const e of twins) { e.hp = hp; e.breaking = null; e.tell = null; e.ready = t + e.recovery; e.busyUntil = e.ready; }
      (enemy.breakFailed ??= {}).colours = true;
      this.notify('틱·톡이 몸을 고쳤습니다. 다시 체력을 깎아 보호막을 깨세요.');
      return;
    }
    if (!b.call && t >= b.nextCall) {
      // The next call: whichever twin still has calls left, chosen at random; the squares change as the pose begins.
      const left = ['tick', 'tock'].filter(k => b.done[k] < b.need), look = left[Math.floor(this.random() * left.length)], actor = twins.find(e => e.look === look);
      if (!actor) return;
      this.ttRecolour(b);
      const twist = b.twists.includes(b.calls++), poseAt = t;
      b.call = { look, id: actor.id, poseAt, posed: false, at: poseAt + rule.callWarn, twistAt: twist ? poseAt + rule.callWarn - rule.twistWarn : null, twisted: false };
    }
    if (b.call && !b.call.posed && t >= b.call.poseAt) {
      const actor = twins.find(e => e.id === b.call.id);
      b.call.posed = true;
      if (actor) { this.beginEnemyTell(actor, b.call.look === 'tick' ? 'ttCallTick' : 'ttCallTock', b.call.at - t); face(actor, Math.PI / 2); }
    }
    // A twist: the squares change once more late in the pose; only the last colours count.
    if (b.call && b.call.twistAt !== null && !b.call.twisted && t >= b.call.twistAt) { b.call.twisted = true; this.ttRecolour(b); this.sense({ kind: 'boss', id: 'ttTwist' }); }
    if (b.call && t >= b.call.at) {
      const call = b.call, actor = twins.find(e => e.id === call.id), zone = this.ttZoneAt(b, p);
      b.call = null; b.nextCall = t + rule.callRest;
      if (actor) actor.tell = null;
      // Every square of the other colour blows. A dodge does not help.
      // Each square bursts with its shock; one column of light goes up a row, from its middle blown square (2026-11-21:
      // one a square put some 36 effects up at once).
      b.blast = { look: call.look, at: t };
      const colour = LOOKS[call.look === 'tick' ? 'tock' : 'tick'], blown = b.zones.filter(z => z.colour !== call.look);
      const pillars = new Set(Array.from({ length: rule.rows }, (_, r) => { const row = blown.filter(z => z.r === r); return row[Math.floor(row.length / 2)]; }));
      blown.forEach((z, i) => {
        const zx = (Math.max(z.x0, b.room.left) + Math.min(z.x1, b.room.right)) / 2, zy = (Math.max(z.y0, b.room.top) + Math.min(z.y1, b.room.bottom)) / 2;
        this.effect('ring', zx, zy, colour, 0.7, 2.2, { look: 'ttBurst' });
        this.bossQuake(zx, zy, { power: 1.3, color: colour, reach: 2.2, pillar: pillars.has(z), feel: i === 0 });
      });
      this.sense({ kind: 'heavy' }); this.sense({ kind: 'boss', id: call.look === 'tick' ? 'ttColourTick' : 'ttColourTock' });
      if (zone?.colour === call.look) b.done[call.look]++;
      else { p.invulnerableUntil = 0; this.hurt(this.fbFixed(rule.missDamage)); if (!this.active) return; }
    }
    if (b.done.tick >= b.need && b.done.tock >= b.need) {
      // Danced through: the shields drop and phase 2 begins at once, on a quicker beat.
      b.solved = true;
      for (const e of twins) { e.breaking = null; e.tell = null; if (!e.breaksDone.includes(b.index)) e.breaksDone.push(b.index); e.ready = t + 1; e.busyUntil = t + 1; this.effect('ring', e.x, e.y, '#ffd257', 0.8, 3, { look: 'shieldBreak' }); }
      this.sense({ kind: 'quake', power: 1, color: '#ffd257' });
      const lead = this.ttLead(enemy);
      Object.assign(lead.metronome, { phase: 2, step: 0, joint: null, next: t + 1, zero: t + 1 });
      this.notify('박자를 모두 맞췄습니다! 보호막이 깨지고 박자가 빨라집니다.'); this.sense({ kind: 'heavy' });
      return;
    }
    if (t >= b.until && !b.call) b.failAt = t + rule.failWarn;
  },
  /** A gear that meets a wall turns back once: across, then back on itself, then straight back. */
  ttBounce(shot, step) {
    for (const a of [Math.PI - shot.angle, -shot.angle, shot.angle + Math.PI]) {
      const test = { x: shot.x, y: shot.y };
      this.move(test, Math.cos(a) * step, Math.sin(a) * step, shot.radius);
      if (distance(test, shot) >= step * 0.6) return a;
    }
    return shot.angle + Math.PI;
  },
};
