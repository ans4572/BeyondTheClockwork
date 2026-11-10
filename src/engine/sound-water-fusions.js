// The nine fusions with sound or water (Silent Factory plan 8.1), each a cast shape of its own (slice.json fusionBehavior).
// Installed on Game.prototype (game.js), so `this` is the game. makeCast calls setupSoundWaterFusion once; updateCasts
// hands every step of these shapes to updateSoundWaterFusion. Drawn in code for now (src/render/canvas.js).
import { distance, floorDistance } from './math.js';

const SHAPES = new Set(['marks', 'shatter', 'speaker', 'echo', 'film', 'veil', 'sheet', 'pool', 'spout']);
/** A body a fusion can reach: standing, out of the ground and not still climbing out of a summon. */
const reachable = (game, e) => e.hp > 0 && !e.hidden && !(e.summonUntil > game.s.time);

export const soundWaterFusions = {
  /** Picks targets and sets the starting state of a new sound or water fusion cast. */
  setupSoundWaterFusion(cast) {
    if (!SHAPES.has(cast.shape)) return;
    const p = this.p, near = this.s.enemies.filter(e => reachable(this, e) && distance(p, e) <= cast.range + e.radius).sort((a, b) => distance(p, a) - distance(p, b));
    if (cast.shape === 'marks') {
      // 과열 공진: up to three nearest bodies; with fewer, the bursts go round the ones there are.
      const picks = near.slice(0, cast.targets);
      cast.marks = picks.length ? Array.from({ length: cast.hits }, (_, i) => ({ id: picks[i % picks.length].id, at: cast.delay + i * cast.interval, done: false })) : [];
      if (!picks.length) cast.done = true;
    }
    if (cast.shape === 'shatter') { cast.stage = 0; this.effect('friendlyTell', cast.x, cast.y, '#e0a43c', cast.delay + cast.breakDelay, cast.radius, { skill: cast.skillId, mark: 'sound' }); }
    if (cast.shape === 'speaker') { cast.speaker = near[0]?.id ?? null; cast.left = cast.pulses; cast.next = cast.delay; cast.bolted = false; if (cast.speaker === null) cast.done = true; }
    if (cast.shape === 'echo') { cast.travel = cast.startDistance || 0; cast.outbound = true; cast.reach = Math.max(1, this.lineReach(p, cast.angle, cast.range).reach); cast.hitOut = []; cast.hitBack = []; }
    if (cast.shape === 'film') { cast.x = p.x + Math.cos(cast.angle) * cast.forward; cast.y = p.y + Math.sin(cast.angle) * cast.forward; cast.rings = 0; cast.lastRing = -Infinity; }
    if (cast.shape === 'veil') { cast.x = p.x; cast.y = p.y; cast.next = cast.delay; }
    if (cast.shape === 'sheet') {
      // 빙판: the slowing is a floor patch (factory-mobs.js patchSlow) that only slows enemies.
      cast.formed = false;
      this.addPatch({ look: 'iceSheet', x: cast.x, y: cast.y, radius: cast.radius, duration: cast.duration, slow: cast.slow, slowsEnemies: true, friendly: true, owner: cast.id });
    }
    if (cast.shape === 'pool') cast.next = cast.delay;
    if (cast.shape === 'spout') { cast.next = cast.delay; cast.slammed = false; }
  },
  /** One step of a sound or water fusion; false for any other cast. */
  updateSoundWaterFusion(cast, dt) {
    if (!SHAPES.has(cast.shape)) return false;
    const t = this.s.time, p = this.p;
    if (cast.shape === 'marks') {
      for (const mark of cast.marks) {
        if (mark.done || cast.age + 1e-7 < mark.at) continue;
        mark.done = true;
        // A marked body that fell already: the burst goes to the nearest one still standing in reach.
        const body = this.s.enemies.find(e => e.id === mark.id && e.hp > 0) || this.s.enemies.filter(e => reachable(this, e) && distance(p, e) <= cast.range + e.radius).sort((a, b) => distance(p, a) - distance(p, b))[0];
        if (!body) continue;
        const at = { x: body.x, y: body.y };
        for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(at, e) <= cast.radius + e.radius) this.castHit(cast, e);
        this.elementOnHazards(cast, h => floorDistance(at, h) <= cast.radius + 0.6);
        this.effect('ring', at.x, at.y, '#ef8a61', 0.6, cast.radius + 0.3, { look: 'overheatBurst' });
      }
      cast.done = cast.marks.every(m => m.done);
      return true;
    }
    if (cast.shape === 'shatter') {
      const inside = e => reachable(this, e) && floorDistance(cast, e) <= cast.radius + e.radius;
      if (cast.stage === 0 && cast.age + 1e-7 >= cast.delay) {
        cast.stage = 1;
        for (const e of this.s.enemies) if (inside(e)) { this.castHit(cast, e, cast.damages[0]); if (!e.boss && e.hp > 0) { e.stunUntil = Math.max(e.stunUntil, t + cast.frozenSeconds); e.frozenUntil = Math.max(e.frozenUntil || 0, t + cast.frozenSeconds); } }
        this.elementOnHazards(cast, h => floorDistance(cast, h) <= cast.radius + 0.6);
        this.effect('ring', cast.x, cast.y, '#9fe3f0', 0.6, cast.radius, { look: 'frostShatter', skill: cast.skillId });
      }
      if (cast.stage === 1 && cast.age + 1e-7 >= cast.delay + cast.breakDelay) {
        cast.stage = 2; cast.done = true;
        // A body frozen (by this or anything else) breaks harder.
        for (const e of this.s.enemies) if (inside(e)) { const frozen = (e.frozenUntil || 0) + 1e-6 >= t; this.castHit(cast, e, cast.damages[1] * (frozen ? cast.frozenBonus : 1)); if (frozen) this.effect('ring', e.x, e.y, '#bfe9f4', 0.5, 0.6, { look: 'frostShatter' }); }
        this.effect('ring', cast.x, cast.y, '#9fe3f0', 0.5, cast.radius + 0.4, { look: 'resonanceBurst', skill: cast.skillId });
      }
      return true;
    }
    if (cast.shape === 'speaker') {
      const body = this.s.enemies.find(e => e.id === cast.speaker);
      const ring = at => {
        for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(at, e) <= cast.radius + e.radius) this.castHit(cast, e, cast.pulseDamage);
        this.effect('ring', at.x, at.y, '#ffe086', 0.45, cast.radius, { look: 'resonanceBurst', burst: 0.5 });
      };
      if (!cast.bolted) { cast.bolted = true; if (body?.hp > 0) { this.castHit(cast, body, cast.boltDamage); this.effect('ring', body.x, body.y, '#ffe086', 0.5, 1, { look: 'zapBig' }); } }
      // The ringing body fell: whatever ringing was left goes off at once where it stood.
      if (!body || body.hp <= 0) { const at = body ? { x: body.x, y: body.y } : { x: cast.x, y: cast.y }; for (; cast.left > 0; cast.left--) ring(at); cast.done = true; return true; }
      cast.x = body.x; cast.y = body.y;
      while (cast.left > 0 && cast.age + 1e-7 >= cast.next + cast.interval) { ring(body); cast.left--; cast.next += cast.interval; }
      if (cast.left <= 0) cast.done = true;
      return true;
    }
    if (cast.shape === 'echo') {
      if (cast.age < cast.delay) return true;
      const fx = Math.cos(cast.angle), fy = Math.sin(cast.angle), from = cast.travel, step = cast.speed * dt;
      cast.travel = cast.outbound ? Math.min(cast.reach, from + step) : Math.max(0, from - step);
      cast.x = cast.startX + fx * cast.travel; cast.y = cast.startY + fy * cast.travel;
      const lo = Math.min(from, cast.travel), hi = Math.max(from, cast.travel);
      const crossed = e => { const dx = e.x - cast.startX, dy = e.y - cast.startY, along = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx), r = e.radius || 0.4; return along >= lo - r && along <= hi + r && side <= cast.halfWidth + r; };
      const struck = cast.outbound ? cast.hitOut : cast.hitBack;
      this.elementOnHazards(cast, crossed);
      for (const e of this.s.enemies) if (reachable(this, e) && !struck.includes(e.id) && crossed(e)) { struck.push(e.id); this.castHit(cast, e); }
      if (cast.outbound && cast.travel >= cast.reach - 1e-7) { cast.outbound = false; this.effect('ring', cast.x, cast.y, '#f4ead2', 0.35, 0.9, { look: 'resonanceBurst' }); }
      else if (!cast.outbound && cast.travel <= 1e-7) cast.done = true;
      return true;
    }
    if (cast.shape === 'film') {
      if (cast.age >= cast.duration || cast.rings >= cast.hits) cast.done = true;
      return true;
    }
    // 과열 증기막: a cloud of steam round F2, following her, scalding and soaking whatever is in it.
    if (cast.shape === 'veil') {
      cast.x = p.x; cast.y = p.y;
      while (cast.pulse < cast.hits && cast.age + 1e-7 >= cast.next) {
        for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(cast, e) <= cast.radius + e.radius) this.castHit(cast, e);
        this.elementOnHazards(cast, h => floorDistance(cast, h) <= cast.radius + 0.6);
        cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= cast.hits || cast.age >= cast.duration) cast.done = true;
      return true;
    }
    // 빙판: forms with a blow, slows what stands on it (its floor patch), then breaks under everything on it.
    if (cast.shape === 'sheet') {
      const on = e => reachable(this, e) && floorDistance(cast, e) <= cast.radius;
      if (!cast.formed) {
        cast.formed = true;
        for (const e of this.s.enemies) if (on(e)) this.castHit(cast, e, cast.firstDamage);
        this.elementOnHazards(cast, h => floorDistance(cast, h) <= cast.radius + 0.6);
        this.effect('ring', cast.x, cast.y, '#bfe9f4', 0.5, cast.radius, { look: 'frostShatter', skill: cast.skillId });
      }
      if (cast.age + 1e-7 >= cast.duration) {
        cast.done = true;
        for (const e of this.s.enemies) if (on(e)) { this.castHit(cast, e, cast.breakDamage); this.effect('ring', e.x, e.y, '#bfe9f4', 0.5, 0.6, { look: 'frostShatter' }); }
        this.effect('ring', cast.x, cast.y, '#9fe3f0', 0.5, cast.radius + 0.3, { look: 'resonanceBurst', skill: cast.skillId });
        for (const c of this.s.casts) if (c.shape === 'floorMark' && c.owner === cast.id) c.done = true;
      }
      return true;
    }
    // 감전 웅덩이: a charged puddle that discharges into everything in it, harder the more of them are wet.
    if (cast.shape === 'pool') {
      const inside = e => reachable(this, e) && floorDistance(cast, e) <= cast.radius;
      while (cast.pulse < cast.hits && cast.age + 1e-7 >= cast.next) {
        const bodies = this.s.enemies.filter(inside), wet = bodies.filter(e => this.wet(e)).length;
        const damage = cast.damage * (1 + Math.min(cast.wetBonusMax, wet * cast.wetBonusPer));
        for (const e of bodies) { this.castHit(cast, e, damage); this.effect('spark', e.x, e.y, '#ffe086', 0.4, 0.7, { look: 'zap' }); }
        this.elementOnHazards(cast, h => floorDistance(cast, h) <= cast.radius + 0.6);
        cast.flashAt = this.s.time; cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= cast.hits || cast.age >= cast.duration + cast.delay) cast.done = true;
      return true;
    }
    // 물기둥 회오리: draws ordinary bodies in and up, strikes all in it, then slams them down at once.
    if (cast.shape === 'spout') {
      const inside = e => reachable(this, e) && floorDistance(cast, e) <= cast.radius + e.radius;
      if (cast.age < cast.slamAt) {
        for (const e of this.s.enemies) if (reachable(this, e) && !e.boss && !e.dummy && !e.stationary && floorDistance(cast, e) <= cast.radius + 1.5) {
          const d = distance(cast, e), a = Math.atan2(cast.y - e.y, cast.x - e.x), step = Math.min(d, cast.pull * dt);
          if (d > 0.05) this.move(e, Math.cos(a) * step, Math.sin(a) * step);
          if (inside(e)) { e.lift = Math.min(0.9, (e.lift || 0) + dt * 1.5); e.spoutLift = cast.id; e.stunUntil = Math.max(e.stunUntil, this.s.time + 0.1); }
        }
        while (cast.pulse < cast.hits && cast.age + 1e-7 >= cast.next) {
          for (const e of this.s.enemies) if (inside(e)) this.castHit(cast, e);
          cast.pulse++; cast.next += cast.interval;
        }
        return true;
      }
      if (!cast.slammed) {
        cast.slammed = true; cast.done = true;
        for (const e of this.s.enemies) {
          if (e.spoutLift === cast.id) { e.lift = 0; e.spoutLift = null; }
          if (!inside(e)) continue;
          this.castHit(cast, e, cast.slamDamage);
          if (!e.boss && e.hp > 0) e.stunUntil = Math.max(e.stunUntil, this.s.time + cast.stun);
        }
        this.effect('ring', cast.x, cast.y, '#3f9fb5', 0.5, cast.radius + 0.4, { look: 'quake' });
        this.effect('ring', cast.x, cast.y, '#7fd0dc', 0.6, cast.radius, { look: 'splash', angle: -Math.PI / 2, skill: cast.skillId });
      }
      return true;
    }
    return true;
  },
  /**
   * 수면 공명: a body on a film of water was struck by sound or the wrench, so the film rings and every body on it is hit
   * (at most once per ringGap, and as many times as the fusion has hits).
   */
  ringFilms(enemy) {
    const t = this.s.time;
    for (const film of this.s.casts) {
      if (film.shape !== 'film' || film.done || film.rings >= film.hits || t - film.lastRing < film.ringGap - 1e-7 || floorDistance(film, enemy) > film.radius) continue;
      film.rings++; film.lastRing = t;
      for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(film, e) <= film.radius) this.castHit(film, e);
      // The whole film rings; its burst stays small so the tuning forks do not swamp it.
      this.effect('ring', film.x, film.y, '#7fd0dc', 0.4, film.radius, { look: 'resonanceBurst', burst: 0.55 }); this.sense({ kind: 'film' });
    }
  },
  /** No sound or water fusion holds F2 back from her other skills now (the streams that did were replaced 2026-11-08). */
  fusionBusy() { return false; },
};
