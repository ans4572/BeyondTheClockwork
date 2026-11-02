const PALM_HEIGHT_UNITS = 0.66;

const castLengthMs = cast => (cast.delay + Math.max(0, cast.hits - 1) * cast.interval) * 1000;

/** World position of an effect; matches where the cast deals damage, not a preview distance. */
function place(effect, source, progress) {
  if (effect.placement === 'hover_target') return { x: source.x, y: source.y, lift: source.hoverHeight };
  if (effect.placement === 'left_palm_projectile') {
    const travelled = source.startDistance + (source.range - source.startDistance) * progress;
    return { x: source.startX + Math.cos(source.angle) * travelled, y: source.startY + Math.sin(source.angle) * travelled, lift: PALM_HEIGHT_UNITS };
  }
  return { x: source.x, y: source.y, lift: 0 };
}

/** Tracks fusion effects from their casts so an effect can finish after its cast has ended. */
export class CastEffects {
  constructor(library) { this.effects = library.data.castEffects; this.active = new Map(); this.visible = []; }
  update(game) {
    const { s } = game;
    if (s.paused) return this.visible;
    if (!['combat', 'intro'].includes(s.mode)) { this.active.clear(); return this.visible = []; }
    for (const cast of s.casts) {
      const effect = this.effects[cast.skillId];
      if (!effect) continue;
      const startedAt = this.active.get(cast.id)?.startedAt ?? s.time - cast.age;
      this.active.set(cast.id, { effect, startedAt, source: { ...cast }, lengthMs: Math.max(effect.durationMs, castLengthMs(cast) - effect.releaseMs) });
    }
    this.visible = [];
    for (const [id, entry] of this.active) {
      const elapsed = (s.time - entry.startedAt) * 1000 - entry.effect.releaseMs, progress = elapsed / entry.lengthMs;
      if (progress >= 1) { this.active.delete(id); continue; }
      if (elapsed < 0) continue;
      const { playback } = entry.effect;
      this.visible.push({ effect: entry.effect, frame: playback[Math.floor(progress * playback.length)], ...place(entry.effect, entry.source, progress) });
    }
    return this.visible;
  }
}
