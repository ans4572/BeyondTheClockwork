import { nearestDirection } from './player-animator.js';
import { frameAtProgress } from './sprite-library.js';

const HYSTERESIS = 8 * Math.PI / 180, MOTION_GAP_SECONDS = 0.05;
// A mob may start walking during recovery; once the strike has read, walking ends the attack clip.
const ATTACK_SETTLE_MS = 250;

/** Reads enemy state to choose a clip and frame for each mob. Never changes the game. */
export class MobAnimator {
  constructor(library) { this.library = library; this.tracks = new Map(); this.poses = new Map(); }
  clip(enemy, action, direction) { return this.library.clip(`${enemy.type}-${action}`, direction); }
  update(delta, game) {
    // While paused (a boss talk, a menu) bodies hold still, but one seen for the first time still stands in its sheet.
    if (game.s.paused || delta <= 0) {
      for (const enemy of game.s.enemies) if (enemy.hp > 0 && !this.poses.has(enemy.id) && this.clip(enemy, 'idle', 'south')) this.poses.set(enemy.id, { action: `${enemy.type}-idle`, direction: nearestDirection(enemy.facing), frame: 0 });
      return this.poses;
    }
    const { s } = game, poses = new Map();
    for (const id of this.tracks.keys()) if (!s.enemies.some(enemy => enemy.id === id)) this.tracks.delete(id);
    for (const enemy of s.enemies) {
      if (!this.clip(enemy, 'idle', 'south')) continue;
      const track = this.track(enemy), pose = enemy.hp > 0 ? this.alive(delta, s.time, enemy, track) : this.dying(s.time, enemy, track);
      if (pose) poses.set(enemy.id, pose);
    }
    return this.poses = poses;
  }
  track(enemy) {
    if (!this.tracks.has(enemy.id)) this.tracks.set(enemy.id, { x: enemy.x, y: enemy.y, direction: nearestDirection(enemy.facing), phase: 0, stillFor: MOTION_GAP_SECONDS, attackAt: null, hitAt: null, flashUntil: enemy.flashUntil, diedAt: null });
    return this.tracks.get(enemy.id);
  }
  alive(delta, time, enemy, track) {
    const moved = Math.hypot(enemy.x - track.x, enemy.y - track.y);
    track.x = enemy.x; track.y = enemy.y;
    track.stillFor = moved > 0 ? 0 : track.stillFor + delta;
    if (enemy.flashUntil !== track.flashUntil) { track.flashUntil = enemy.flashUntil; track.hitAt = time; }
    // A boss's cast-like patterns play its cast clip when it has one (enemy.tellPose, src/engine/factory-bosses.js).
    if (enemy.tell && track.attackAt === null) { track.attackAt = enemy.tell.started; track.pose = enemy.tellPose && this.clip(enemy, enemy.tellPose, 'south') ? enemy.tellPose : 'attack'; }
    track.direction = nearestDirection(enemy.dash?.angle ?? enemy.tell?.angle ?? enemy.facing, track.direction, HYSTERESIS);
    const direction = track.direction, attack = this.attack(time, enemy, track, moved);
    if (attack) return attack;
    const hit = this.clip(enemy, 'hit', direction), hitElapsed = (time - track.hitAt) * 1000;
    if (hit && track.hitAt !== null && hitElapsed < hit.durationMs) return { action: `${enemy.type}-hit`, direction, frame: frameAtProgress(hit, hitElapsed / hit.durationMs) };
    if (track.stillFor >= MOTION_GAP_SECONDS) return { action: `${enemy.type}-idle`, direction, frame: 0 };
    const walk = this.clip(enemy, 'move', direction);
    if (!walk) return { action: `${enemy.type}-idle`, direction, frame: 0 };
    // Phase follows distance so slows and blocked steps do not slide the feet.
    track.phase = (track.phase + moved / (enemy.speed * walk.durationMs / 1000)) % 1;
    return { action: `${enemy.type}-move`, direction, frame: Math.floor(track.phase * walk.frameCount) % walk.frameCount };
  }
  attack(time, enemy, track, moved) {
    if (track.attackAt === null) return null;
    const pose = track.pose || 'attack', clip = this.clip(enemy, pose, track.direction), elapsed = (time - track.attackAt) * 1000;
    const walkingOff = moved > 0 && !enemy.tell && !enemy.dash && elapsed > clip.lastEventMs + ATTACK_SETTLE_MS;
    if (elapsed >= clip.durationMs || walkingOff) { track.attackAt = null; return null; }
    return { action: `${enemy.type}-${pose}`, direction: track.direction, frame: frameAtProgress(clip, elapsed / clip.durationMs) };
  }
  dying(time, enemy, track) {
    const clip = this.clip(enemy, 'death', track.direction);
    if (!clip) return null;
    track.diedAt ??= time;
    const elapsed = (time - track.diedAt) * 1000;
    return elapsed < clip.durationMs ? { action: `${enemy.type}-death`, direction: track.direction, frame: frameAtProgress(clip, elapsed / clip.durationMs) } : null;
  }
}
