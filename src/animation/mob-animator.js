import { nearestDirection } from './player-animator.js';
import { frameAtProgress } from './sprite-library.js';

const HYSTERESIS = 8 * Math.PI / 180, MOTION_GAP_SECONDS = 0.05;
// A mob may start walking during recovery; once the strike has read, walking ends the attack clip.
const ATTACK_SETTLE_MS = 250;
/**
 * Types whose sheets go by another name (slice.json bossAI.<type>.sprite), for a body whose engine has not set
 * enemy.sprite: Orden's last form wears the awakened sheets (scripts/import-ch3-orden.mjs; 'orden' is its own name).
 */
const TYPE_SHEETS = { ordenFinal: 'ordenx' };
/** Whose clips a body wears: its own type's, or the look it shows now (Tick·Tock, clock-bosses.js enemy.sprite). */
const sheetOf = enemy => enemy.sprite || TYPE_SHEETS[enemy.type] || enemy.type;
/**
 * Sheets drawn a quarter-turn off. The gear roller's PixelLab clips show its wheel side-on in the north and south
 * views and edge-on in the east and west ones, so a roller heading east would show a wheel rolling north. It shows
 * the clip whose wheel lies along the way it goes, the one turned toward the camera of the two (2026-11-18).
 */
const QUARTER_TURNED = {
  gearRoller: { south: 'east', north: 'east', east: 'south', west: 'south', 'south-east': 'south-west', 'north-west': 'south-west', 'south-west': 'south-east', 'north-east': 'south-east' },
};
/** The direction whose clip a body shows when it faces `direction`. */
export const viewOf = (enemy, direction) => QUARTER_TURNED[sheetOf(enemy)]?.[direction] ?? direction;

/** Reads enemy state to choose a clip and frame for each mob. Never changes the game. */
export class MobAnimator {
  constructor(library) { this.library = library; this.tracks = new Map(); this.poses = new Map(); }
  clip(enemy, action, direction) { return this.library.clip(`${sheetOf(enemy)}-${action}`, direction); }
  update(delta, game) {
    // While paused (a boss talk, a menu) bodies hold still, but one seen for the first time still stands in its sheet.
    if (game.s.paused || delta <= 0) {
      for (const enemy of game.s.enemies) if (enemy.hp > 0 && !this.poses.has(enemy.id) && this.clip(enemy, 'idle', 'south')) this.poses.set(enemy.id, { action: `${sheetOf(enemy)}-idle`, direction: viewOf(enemy, nearestDirection(enemy.facing)), frame: 0 });
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
    // A body whose blows are timed to their warnings (slice.json syncStrike: Belgard) starts its clip again on every new
    // warning, so each cut of a combo swings, and lands the clip's strike frame where the warning ends (attack()).
    const fresh = enemy.tell && enemy.syncStrike && track.tellStarted !== enemy.tell.started;
    if (enemy.tell && (track.attackAt === null || fresh)) { track.attackAt = enemy.tell.started; track.pose = enemy.tellPose && this.clip(enemy, enemy.tellPose, 'south') ? enemy.tellPose : 'attack'; }
    if (enemy.tell) { track.tellStarted = enemy.tell.started; track.tellUntil = enemy.tell.until; }
    track.direction = nearestDirection(enemy.dash?.angle ?? enemy.tell?.angle ?? enemy.facing, track.direction, HYSTERESIS);
    const direction = viewOf(enemy, track.direction);
    const attack = this.attack(time, enemy, track, moved);
    if (attack) return attack;
    const hit = this.clip(enemy, 'hit', direction), hitElapsed = (time - track.hitAt) * 1000;
    if (hit && track.hitAt !== null && hitElapsed < hit.durationMs) return { action: `${sheetOf(enemy)}-hit`, direction, frame: frameAtProgress(hit, hitElapsed / hit.durationMs) };
    // A standing clip with frames of its own follows the body's swing (Tick·Tock's metronomes keep the beat, enemy.swing).
    if (track.stillFor >= MOTION_GAP_SECONDS) { const idle = this.clip(enemy, 'idle', direction); return { action: `${sheetOf(enemy)}-idle`, direction, frame: idle?.frameCount > 1 && enemy.swing !== undefined ? Math.floor(enemy.swing * idle.frameCount) % idle.frameCount : 0 }; }
    const walk = this.clip(enemy, 'move', direction);
    if (!walk) return { action: `${sheetOf(enemy)}-idle`, direction, frame: 0 };
    // Phase follows distance so slows and blocked steps do not slide the feet.
    track.phase = (track.phase + moved / (enemy.speed * walk.durationMs / 1000)) % 1;
    return { action: `${sheetOf(enemy)}-move`, direction, frame: Math.floor(track.phase * walk.frameCount) % walk.frameCount };
  }
  attack(time, enemy, track, moved) {
    if (track.attackAt === null) return null;
    const pose = track.pose || 'attack', direction = viewOf(enemy, track.direction), clip = this.clip(enemy, pose, direction);
    let elapsed = (time - track.attackAt) * 1000;
    // Strike sync: the wind-up stretched or squeezed so the clip's strike frame (lastEventMs) falls where the warning
    // ends and the blow lands; after it the clip runs on in real time (2026-11-18: Belgard's clips struck 0.15 to 0.4 s
    // before his blows landed, and his combo's second and third cuts never swung).
    if (enemy.syncStrike && clip?.lastEventMs && track.tellUntil > track.attackAt) {
      const warn = (track.tellUntil - track.attackAt) * 1000;
      elapsed = elapsed < warn ? elapsed / warn * clip.lastEventMs : clip.lastEventMs + elapsed - warn;
    }
    // The body's sheet changed mid-blow (Belgard puts his sword away while his command pose still plays, bell-boss.js
    // bareUntil): a pose the new sheet does not have ends there.
    if (!clip) { track.attackAt = null; return null; }
    const walkingOff = moved > 0 && !enemy.tell && !enemy.dash && elapsed > clip.lastEventMs + ATTACK_SETTLE_MS;
    if (elapsed >= clip.durationMs || walkingOff) { track.attackAt = null; return null; }
    return { action: `${sheetOf(enemy)}-${pose}`, direction, frame: frameAtProgress(clip, elapsed / clip.durationMs) };
  }
  dying(time, enemy, track) {
    const direction = viewOf(enemy, track.direction), clip = this.clip(enemy, 'death', direction);
    if (!clip) return null;
    track.diedAt ??= time;
    const elapsed = (time - track.diedAt) * 1000;
    return elapsed < clip.durationMs ? { action: `${sheetOf(enemy)}-death`, direction, frame: frameAtProgress(clip, elapsed / clip.durationMs) } : null;
  }
}
