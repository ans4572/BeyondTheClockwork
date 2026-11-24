import { nearestDirection } from './player-animator.js';
import { frameAtProgress } from './sprite-library.js';
import { fitsMap } from '../engine/map-geometry.js';

const WALK_UNITS_PER_SECOND = 1.1;
// Everyone walks on one clock, then the whole town stops where it stands until the clock restarts.
export const BELL_EVERY_SECONDS = 30, BELL_HOLD_SECONDS = 2.6;
// The bell that greets someone new to the town comes early, so they meet it before they meet anyone.
export const FIRST_BELL_SECONDS = 6;
const GREET_UNITS = 7;
// Walkers see each other coming and ease aside, keeping to their own right like people on a pavement.
const SIDESTEP_UNITS = 0.6, SIDESTEP_PER_SECOND = 1.1, SEE_AHEAD_UNITS = 3.2, CLEAR_BEHIND_UNITS = 0.9, FOOT_UNITS = 0.25;
// Nobody waits for long: two walkers each holding for the other would otherwise jam the whole street.
const PATIENCE_SECONDS = 0.8, PASSING_SECONDS = 2.5;
// Stopping and starting stays settled for a moment, so a walker never stutters on the spot.
const SETTLE_SECONDS = 0.4;
// Each resident keeps to their own side of the street, so a crowd does not stack on one line.
export const LANE_UNITS = 0.35;
/** One key for a stretch of street, whichever way it is walked. */
export const linkKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
/** How far a resident may stray from the street line on the stretch a-b (narrowLinks, else LANE_UNITS). */
export const laneOn = (crowd, a, b) => Math.min(LANE_UNITS, (crowd?.narrowLinks || []).find(([x, y]) => linkKey(x, y) === linkKey(a, b))?.[2] ?? LANE_UNITS);
/** Residents whose generated 'north' walk shows their face: walking away from the camera they use the back three-quarter view instead. */
export const FRONT_FACING_NORTH = new Set(['C2', 'C3', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R18']);
export function walkDirection(character, dx, dy) {
  const direction = nearestDirection(Math.atan2(dy, dx));
  if (direction !== 'north' || !FRONT_FACING_NORTH.has(character)) return direction;
  return dx >= 0 ? 'north-east' : 'north-west';
}

/** Where `other` is from a walker's point of view: along their heading, and to their right. */
const relative = ({ x, y, dx, dy }, other) => ({ ahead: (other.x - x) * dx + (other.y - y) * dy, right: (other.y - y) * dx - (other.x - x) * dy });

const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

/** Places a village's NPCs for the current moment. Purely visual; nothing here touches the game. */
export class NpcDirector {
  constructor(library) { this.library = library; this.place = null; this.elapsed = 0; this.walked = 0; this.residents = []; this.greetedAt = null; this.stopped = false; this.bell = null; this.clock = 0; this.said = new Map(); }
  /**
   * `bell`: 'soon' brings the next bell forward, 'hold' also keeps the town stopped once it has rung.
   * `free`: Orden is gone (chapter 3 cleared, 2026-11-19): the bell never rings again and nobody stops on its clock.
   * `freeze`: everyone stands where they are (the liberation scene holds the town still before the seals break).
   */
  update(delta, place, npcs, { crowd, lookAt, floor, paused = false, reducedMotion = false, bell = null, free = false, freeze = false, murmurs = null } = {}) {
    if (place !== this.place) this.enter(place, crowd);
    if (!paused) this.clock += delta;
    const wasStopped = this.stopped;
    const cycle = BELL_EVERY_SECONDS + (crowd?.bellHold ?? BELL_HOLD_SECONDS);
    if (bell && !this.bell) this.bringBellForward(cycle);
    this.bell = bell;
    if (!paused && !(bell === 'hold' && this.stopped)) this.elapsed += delta;
    let stopped, walked;
    if (free || freeze) {
      // Off the bell's clock: walking on from wherever the town stood, on a clock of its own.
      if (this.freeFrom === undefined) { this.freeFrom = this.walked; this.freeRun = 0; }
      if (!paused && !freeze) this.freeRun += delta;
      stopped = this.stopped = freeze; walked = this.freeFrom + this.freeRun;
    } else {
      this.freeFrom = undefined;
      const beat = this.elapsed % cycle; stopped = this.stopped = beat >= BELL_EVERY_SECONDS;
      walked = Math.floor(this.elapsed / cycle) * BELL_EVERY_SECONDS + Math.min(beat, BELL_EVERY_SECONDS);
    }
    // A few of those nearest F2 murmur while the bell holds them, from chapter 1 on (dialogue.json residents.bell).
    if (stopped && !wasStopped && !freeze && murmurs?.length && lookAt) this.murmur(murmurs, lookAt, crowd?.bellHold ?? BELL_HOLD_SECONDS);
    if (!reducedMotion) {
      const step = (walked - this.walked) * WALK_UNITS_PER_SECOND, space = crowd?.personalSpace, spots = this.residents.map(resident => this.spot(resident));
      this.residents.forEach((resident, i) => {
        resident.passing = Math.max(0, resident.passing - (paused ? 0 : delta));
        const blocked = !!space && !stopped && !resident.passing && this.queued(i, spots, space);
        resident.waited = blocked ? resident.waited + (paused ? 0 : delta) : 0;
        if (resident.waited > PATIENCE_SECONDS) { resident.passing = PASSING_SECONDS; resident.waited = 0; }
        const waiting = blocked && !resident.passing;
        resident.settle = Math.max(0, resident.settle - (paused ? 0 : delta));
        if (waiting !== resident.waiting && (!resident.settle || resident.passing)) { resident.waiting = waiting; resident.settle = SETTLE_SECONDS; }
        // One talking with F2 stays where they are until the line is done (2026-11-24).
        if (!resident.waiting && !(resident.holdUntil > this.clock)) this.advance(resident, step);
      });
      if (space && !paused) this.residents.forEach((resident, i) => this.sidestep(resident, i, spots, [...npcs, ...(lookAt ? [lookAt] : [])], space, delta, floor));
    }
    this.walked = walked;
    return [...npcs.map((npc, i) => ({ ...this.stander(npc, reducedMotion, lookAt), key: `npc:${i}`, say: this.saying(`npc:${i}`), talk: npc.talk, character: npc.character })), ...this.residents.map((resident, index) => ({ ...this.pose(resident, stopped, reducedMotion, lookAt), resident: true, index, character: resident.character, say: this.saying(index) }))];
  }
  /** Where a walking resident stands now, with their side-step. */
  at(resident) { const { x, y } = this.spot(resident); return { x: x + resident.nudge[0], y: y + resident.nudge[1] }; }
  /** The walking resident nearest (x, y) within reach, as { index, x, y, character }, or null. */
  nearest(x, y, reach) {
    let best = null;
    this.residents.forEach((resident, index) => { const at = this.at(resident), d = Math.hypot(at.x - x, at.y - y); if (d <= reach && (!best || d < best.d)) best = { index, ...at, character: resident.character, d }; });
    return best;
  }
  /** A line over a resident's head (an index) or a stander's (`npc:<its place in the map's npcs>`: two workers may share a look) for `seconds`; a resident also stops. */
  say(who, text, seconds = 3.5, hold = true) {
    this.said.set(who, { text, until: this.clock + seconds });
    if (typeof who === 'number' && hold && this.residents[who]) this.residents[who].holdUntil = this.clock + seconds;
  }
  saying(who) { const line = this.said.get(who); return line && line.until > this.clock ? line.text : null; }
  /** Two or three of those nearest F2 (within 9 units) murmur a line each while the bell holds the town. */
  murmur(lines, lookAt, seconds) {
    const near = this.residents.map((resident, index) => ({ index, d: Math.hypot(this.at(resident).x - lookAt.x, this.at(resident).y - lookAt.y) })).filter(r => r.d <= 9).sort((a, b) => a.d - b.d);
    const pool = [...lines], count = Math.min(near.length, pool.length, lines.length > 4 ? 3 : 2), chosen = [];
    // Every other one by distance first, so two bubbles seldom sit on neighbours.
    for (let k = 0; chosen.length < count && k < near.length; k += 2) chosen.push(near[k].index);
    for (let k = 1; chosen.length < count && k < near.length; k += 2) chosen.push(near[k].index);
    for (const index of chosen) this.say(index, pool.splice(Math.floor(Math.random() * pool.length), 1)[0], seconds, false);
  }
  /** Moves the clock without moving anyone: distance walked is rewritten along with the time. */
  bringBellForward(cycle) {
    const round = Math.floor(this.elapsed / cycle), lead = BELL_EVERY_SECONDS - FIRST_BELL_SECONDS;
    this.elapsed = round * cycle + lead; this.walked = round * BELL_EVERY_SECONDS + lead; this.stopped = false;
  }
  enter(place, crowd) {
    this.place = place; this.elapsed = 0; this.walked = 0; this.greetedAt = null; this.stopped = false; this.freeFrom = undefined; this.links = crowd?.points.map(() => []) || [];
    for (const [a, b] of crowd?.links || []) { this.links[a].push(b); this.links[b].push(a); }
    // A stretch narrower than the usual lanes (maps.json crowds[].narrowLinks: [a, b, lane]) squeezes each resident's
    // own side of the street to that width there, e.g. under the court's flower arch (2026-11-15).
    this.narrow = new Map((crowd?.narrowLinks || []).map(([a, b, lane]) => [linkKey(a, b), Math.min(1, lane / LANE_UNITS)]));
    // A quiet stretch (crowds[].quiet: { links: [[from, to, weight]], points }) is turned into less often from `from`,
    // and nobody starts on its points, e.g. the court's flower arch branch (2026-11-15).
    this.quiet = new Map((crowd?.quiet?.links || []).map(([a, b, weight]) => [`${a}>${b}`, weight]));
    const quietPoints = new Set(crowd?.quiet?.points || []), starts = (crowd?.points || []).map((_, i) => i).filter(i => !quietPoints.has(i));
    this.points = crowd?.points;
    this.residents = (crowd?.cast || []).map((character, i) => {
      const random = seeded(i * 7919 + 1), from = starts.length ? starts[i % starts.length] : i % crowd.points.length, resident = { character, random, from, to: from, along: 0, nudge: [0, 0], dodge: 0, waited: 0, passing: 0, waiting: false, settle: 0, frame: 0, lane: [(random() * 2 - 1) * LANE_UNITS, (random() * 2 - 1) * LANE_UNITS] };
      this.turn(resident);
      resident.along = random() * this.length(resident);
      return resident;
    });
  }
  /** True behind someone heading the same way, or giving way to a lower-numbered walker at a crossing. */
  queued(i, spots, space) {
    const me = spots[i];
    return spots.some((other, j) => {
      const facing = me.dx * other.dx + me.dy * other.dy;
      if (i === j || facing < -0.3 || (facing < 0.3 && j > i)) return false;
      const { ahead, right } = relative(me, other);
      return ahead > 0 && ahead < space * 1.5 && Math.abs(right) < space;
    });
  }
  /** Eases towards one side of the street while someone is in the way. The offset never jumps, even across a corner. */
  sidestep(resident, i, spots, bodies, space, delta, floor) {
    const me = spots[i], inTheWay = other => { const { ahead, right } = relative(me, other); return ahead > -CLEAR_BEHIND_UNITS && ahead < SEE_AHEAD_UNITS && Math.abs(right) < space; };
    const oncoming = spots.some((other, j) => j !== i && me.dx * other.dx + me.dy * other.dy < -0.3 && inTheWay(other));
    const standing = bodies.find(inTheWay);
    // Two walking the same way at the same spot split to either side of the street.
    const alongside = spots.findIndex((other, j) => { if (j === i || me.dx * other.dx + me.dy * other.dy < 0.3) return false; const { ahead, right } = relative(me, other); return Math.abs(ahead) < 0.9 && Math.abs(right) < 0.8; });
    // Everyone keeps right for oncoming walkers and overtakes on the left; someone standing still is passed on whichever side is clear, without changing mind.
    resident.dodge = oncoming ? 1 : resident.passing ? -1 : alongside >= 0 ? (i < alongside ? 1 : -1) : standing ? resident.dodge || (relative(me, standing).right > 0 ? -1 : 1) : 0;
    let target = [-me.dy * resident.dodge * SIDESTEP_UNITS, me.dx * resident.dodge * SIDESTEP_UNITS];
    if (floor && resident.dodge && !fitsMap(me.x + target[0], me.y + target[1], FOOT_UNITS, floor)) target = [0, 0];
    const to = [target[0] - resident.nudge[0], target[1] - resident.nudge[1]], gap = Math.hypot(...to), move = Math.min(1, SIDESTEP_PER_SECOND * delta / (gap || 1));
    resident.nudge = [resident.nudge[0] + to[0] * move, resident.nudge[1] + to[1] * move];
  }
  spot(resident) {
    const from = this.points[resident.from], to = this.points[resident.to], length = this.length(resident) || 1, t = resident.along / length;
    const squeeze = this.narrow?.get(linkKey(resident.from, resident.to)) ?? 1;
    return { x: from[0] + (to[0] - from[0]) * t + resident.lane[0] * squeeze, y: from[1] + (to[1] - from[1]) * t + resident.lane[1] * squeeze, dx: (to[0] - from[0]) / length, dy: (to[1] - from[1]) / length };
  }
  length({ from, to }) { return Math.hypot(this.points[to][0] - this.points[from][0], this.points[to][1] - this.points[from][1]); }
  /** Picks the next stretch of street, turning back only at a dead end. */
  turn(resident) {
    const onward = this.links[resident.to].filter(point => point !== resident.from), choices = onward.length ? onward : this.links[resident.to];
    // Each way on is equally likely, except a quiet stretch, which weighs less.
    const weights = choices.map(point => this.quiet?.get(`${resident.to}>${point}`) ?? 1);
    let roll = resident.random() * weights.reduce((sum, w) => sum + w, 0), next = choices.at(-1);
    for (const [k, point] of choices.entries()) { roll -= weights[k]; if (roll < 0) { next = point; break; } }
    [resident.from, resident.to] = [resident.to, next];
    resident.along = 0;
  }
  advance(resident, distance) {
    let left = distance;
    while (left > 0) {
      const remaining = this.length(resident) - resident.along;
      if (left < remaining) { resident.along += left; return; }
      left -= remaining; this.turn(resident);
    }
  }
  stander({ character, x, y, direction = 'south', greet, label }, reducedMotion, lookAt) {
    const greeting = greet && this.library.clip(`${character}-greeting`, direction), idle = this.library.clip(`${character}-idle`, direction), elapsedMs = this.elapsed * 1000;
    if (greeting && this.greetedAt === null && (!lookAt || Math.hypot(lookAt.x - x, lookAt.y - y) <= GREET_UNITS)) this.greetedAt = this.elapsed;
    const greetedMs = this.greetedAt === null ? Infinity : elapsedMs - this.greetedAt * 1000;
    if (greeting && greetedMs < greeting.durationMs) return { x, y, label, pose: { action: `${character}-greeting`, direction, frame: frameAtProgress(greeting, greetedMs / greeting.durationMs) } };
    // Each stander starts its loop at its own point (from where it stands), so a room of them never moves in step:
    // the chapter 2 rest stop's workers sip, doze, stretch and chat each in their own time (2026-11-09).
    const offset = (((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1) * (idle.durationMs || 0);
    const breathing = idle.loop && !reducedMotion, frame = breathing ? frameAtProgress(idle, ((elapsedMs + offset) % idle.durationMs) / idle.durationMs) : 0;
    return { x, y, label, pose: { action: `${character}-idle`, direction, frame } };
  }
  pose(resident, stopped, reducedMotion, lookAt = null) {
    const { character, nudge } = resident, { x: baseX, y: baseY, dx, dy } = this.spot(resident), x = baseX + nudge[0], y = baseY + nudge[1];
    // Residents always draw from their walk clips: the idle stills are a different drawing of a different size.
    const action = `${character}-walk`;
    if (reducedMotion) return { x, y, pose: { action, direction: 'south', frame: 0 } };
    // Talking, a resident turns to F2 (and stands, the walk held on its frame).
    const facing = resident.holdUntil > this.clock && lookAt ? [lookAt.x - x, lookAt.y - y] : null;
    const direction = facing ? walkDirection(character, ...facing) : walkDirection(character, dx, dy);
    if (facing) return { x, y, pose: { action, direction, frame: 0 } };
    if (stopped) return { x, y, pose: { action, direction, frame: resident.frame } };
    if (!resident.waiting) { const walk = this.library.clip(action, direction); resident.frame = frameAtProgress(walk, (this.walked * 1000 % walk.durationMs) / walk.durationMs); }
    return { x, y, pose: { action, direction, frame: resident.frame } };
  }
}
