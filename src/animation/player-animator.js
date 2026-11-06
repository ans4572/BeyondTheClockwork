import { Locomotion } from './locomotion.js';
import { frameAtProgress } from './sprite-library.js';

const TAU = Math.PI * 2, HIT_SECONDS = 0.36, DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// Fixed-step updates can leave a render frame with no movement; keep the last motion across those gaps.
const MOTION_GAP_SECONDS = 0.05, ROOM_CHANGE_UNITS = 2;
// Casting never locks movement; walking ends the body clip only after the skill's peak has shown.
const CAST_SETTLE_MS = 500;
const LIE_STILL_SHARE = 0.4;

/** Nearest of the eight directions; `hysteresis` radians keeps the current one near a boundary. */
export function nearestDirection(angle, current = null, hysteresis = 0) {
  const a = (angle % TAU + TAU) % TAU;
  if (current) {
    const base = DIRECTIONS.indexOf(current) * Math.PI / 4;
    if (Math.abs(Math.atan2(Math.sin(a - base), Math.cos(a - base))) <= Math.PI / 8 + hysteresis) return current;
  }
  return DIRECTIONS[Math.round(a / (Math.PI / 4)) % DIRECTIONS.length];
}

/** Reads game state to choose a clip and frame. Never changes the game. */
export class PlayerAnimator {
  constructor(library) {
    this.library = library;
    this.locomotion = new Locomotion(library.locomotion);
    this.hysteresis = library.locomotion.directionHysteresisDegrees * Math.PI / 180;
    this.facing = 'south'; this.last = null; this.axis = { x: 0, y: 0 }; this.stillFor = 0; this.deathElapsed = 0;
    this.pose = { action: 'idle', direction: 'south', frame: 0 };
  }
  oneShot(action, direction, progress) {
    const clip = this.library.clip(action, direction);
    return { action, direction, frame: clip ? frameAtProgress(clip, progress) : 0 };
  }
  static(angle) { return { action: 'idle', direction: nearestDirection(angle), frame: 0 }; }
  update(delta, game, { reducedMotion = false } = {}) {
    if (game.s.paused || delta <= 0) return this.pose;
    this.trackMotion(delta, game);
    return this.pose = this.choose(delta, game, reducedMotion);
  }
  trackMotion(delta, game) {
    const { p, c } = game, moved = this.last ? { x: p.x - this.last.x, y: p.y - this.last.y } : { x: 0, y: 0 };
    this.last = { x: p.x, y: p.y };
    const distance = Math.hypot(moved.x, moved.y), speed = c.player.speed;
    if (distance > ROOM_CHANGE_UNITS) { this.axis = { x: 0, y: 0 }; this.stillFor = MOTION_GAP_SECONDS; }
    else if (distance > 0) { this.axis = { x: moved.x / delta / speed, y: moved.y / delta / speed }; this.stillFor = 0; }
    else if ((this.stillFor += delta) >= MOTION_GAP_SECONDS) this.axis = { x: 0, y: 0 };
    this.locomotion.update(delta, this.axis, speed);
  }
  cast(game) {
    const { s, p } = game, last = p.lastCast, action = last && this.library.data.castActions?.[last.skillId];
    if (!action) return null;
    const direction = nearestDirection(last.angle), clip = this.library.clip(action, direction), elapsed = (s.time - last.at) * 1000;
    if (!clip || elapsed >= clip.durationMs) return null;
    const dashing = s.casts.some(c => c.id === last.id && c.shape === 'dash');
    // Walking away ends a cast pose; the wrench's own lunge (feet planted, body carried) does not.
    if (this.locomotion.moving && !dashing && !p.attack && elapsed > CAST_SETTLE_MS) return null;
    this.facing = direction;
    return { action, direction, frame: frameAtProgress(clip, elapsed / clip.durationMs) };
  }
  choose(delta, game, reducedMotion) {
    const { s, p, c } = game;
    if (s.mode === 'introDeath' || s.downUntil) {
      this.deathElapsed += delta;
      return this.oneShot('death', this.facing, this.deathElapsed / (this.library.clip('death', this.facing).durationMs / 1000));
    }
    this.deathElapsed = 0;
    if (game.wakeProgress !== null) {
      // The fall played backwards, after a moment lying still.
      this.facing = 'south-east';
      return this.oneShot('death', this.facing, 1 - Math.max(0, (game.wakeProgress - LIE_STILL_SHARE) / (1 - LIE_STILL_SHARE)));
    }
    // A dodge is a burst of the run itself (the old separate dodge drawing was a different, smaller figure and blinked in
    // and out): the stride carries on from where the legs were, played fast across the dash.
    if (p.dodge) {
      this.facing = nearestDirection(p.dodge.angle);
      const run = this.library.clip('run', this.facing), frames = run?.frameCount || 1;
      if (this.dodgeFrom === undefined || p.dodge !== this.dodgeOf) { this.dodgeOf = p.dodge; this.dodgeFrom = this.locomotion.frame(frames); }
      return { action: 'run', direction: this.facing, frame: (this.dodgeFrom + Math.floor(p.dodge.elapsed / c.player.dodge.duration * frames * 0.75)) % frames };
    }
    // A cast outranks the basic attack, which is usually held down during combat.
    const cast = this.cast(game);
    if (cast) return cast;
    if (p.attack) {
      const info = c.player.combo[p.attack.phase], total = info.windup + info.active + p.attack.recovery;
      return this.oneShot(`attack-${p.attack.phase + 1}`, this.facing = nearestDirection(p.attack.angle), p.attack.elapsed / total);
    }
    const hurt = s.effects.findLast(fx => fx.type === 'hurt' && s.time - fx.created < HIT_SECONDS);
    if (hurt) return this.oneShot('hit', this.facing, (s.time - hurt.created) / HIT_SECONDS);
    if (this.locomotion.moving) {
      this.facing = this.locomotion.direction;
      return { action: 'run', direction: this.facing, frame: this.locomotion.frame(this.library.clip('run', this.facing).frameCount) };
    }
    this.facing = nearestDirection(p.angle, this.facing, this.hysteresis);
    return { action: 'idle', direction: this.facing, frame: reducedMotion ? 0 : this.locomotion.frame(this.library.clip('idle', this.facing).frameCount) };
  }
}
