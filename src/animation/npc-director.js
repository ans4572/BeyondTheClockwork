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
  constructor(library) { this.library = library; this.place = null; this.elapsed = 0; this.walked = 0; this.residents = []; this.greetedAt = null; this.stopped = false; this.bell = null; }
  /** `bell`: 'soon' brings the next bell forward, 'hold' also keeps the town stopped once it has rung. */
  update(delta, place, npcs, { crowd, lookAt, floor, paused = false, reducedMotion = false, bell = null } = {}) {
    if (place !== this.place) this.enter(place, crowd);
    const cycle = BELL_EVERY_SECONDS + (crowd?.bellHold ?? BELL_HOLD_SECONDS);
    if (bell && !this.bell) this.bringBellForward(cycle);
    this.bell = bell;
    if (!paused && !(bell === 'hold' && this.stopped)) this.elapsed += delta;
    const beat = this.elapsed % cycle, stopped = this.stopped = beat >= BELL_EVERY_SECONDS;
    const walked = Math.floor(this.elapsed / cycle) * BELL_EVERY_SECONDS + Math.min(beat, BELL_EVERY_SECONDS);
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
        if (!resident.waiting) this.advance(resident, step);
      });
      if (space && !paused) this.residents.forEach((resident, i) => this.sidestep(resident, i, spots, [...npcs, ...(lookAt ? [lookAt] : [])], space, delta, floor));
    }
    this.walked = walked;
    return [...npcs.map(npc => this.stander(npc, reducedMotion, lookAt)), ...this.residents.map(resident => this.pose(resident, stopped, reducedMotion))];
  }
  /** Moves the clock without moving anyone: distance walked is rewritten along with the time. */
  bringBellForward(cycle) {
    const round = Math.floor(this.elapsed / cycle), lead = BELL_EVERY_SECONDS - FIRST_BELL_SECONDS;
    this.elapsed = round * cycle + lead; this.walked = round * BELL_EVERY_SECONDS + lead; this.stopped = false;
  }
  enter(place, crowd) {
    this.place = place; this.elapsed = 0; this.walked = 0; this.greetedAt = null; this.stopped = false; this.links = crowd?.points.map(() => []) || [];
    for (const [a, b] of crowd?.links || []) { this.links[a].push(b); this.links[b].push(a); }
    this.points = crowd?.points;
    this.residents = (crowd?.cast || []).map((character, i) => {
      const random = seeded(i * 7919 + 1), from = i % crowd.points.length, resident = { character, random, from, to: from, along: 0, nudge: [0, 0], dodge: 0, waited: 0, passing: 0, waiting: false, settle: 0, frame: 0, lane: [(random() * 2 - 1) * LANE_UNITS, (random() * 2 - 1) * LANE_UNITS] };
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
    return { x: from[0] + (to[0] - from[0]) * t + resident.lane[0], y: from[1] + (to[1] - from[1]) * t + resident.lane[1], dx: (to[0] - from[0]) / length, dy: (to[1] - from[1]) / length };
  }
  length({ from, to }) { return Math.hypot(this.points[to][0] - this.points[from][0], this.points[to][1] - this.points[from][1]); }
  /** Picks the next stretch of street, turning back only at a dead end. */
  turn(resident) {
    const onward = this.links[resident.to].filter(point => point !== resident.from), choices = onward.length ? onward : this.links[resident.to];
    [resident.from, resident.to] = [resident.to, choices[Math.floor(resident.random() * choices.length)]];
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
  pose(resident, stopped, reducedMotion) {
    const { character, nudge } = resident, { x: baseX, y: baseY, dx, dy } = this.spot(resident), x = baseX + nudge[0], y = baseY + nudge[1];
    // Residents always draw from their walk clips: the idle stills are a different drawing of a different size.
    const action = `${character}-walk`;
    if (reducedMotion) return { x, y, pose: { action, direction: 'south', frame: 0 } };
    const direction = walkDirection(character, dx, dy);
    if (stopped) return { x, y, pose: { action, direction, frame: resident.frame } };
    if (!resident.waiting) { const walk = this.library.clip(action, direction); resident.frame = frameAtProgress(walk, (this.walked * 1000 % walk.durationMs) / walk.durationMs); }
    return { x, y, pose: { action, direction, frame: resident.frame } };
  }
}
