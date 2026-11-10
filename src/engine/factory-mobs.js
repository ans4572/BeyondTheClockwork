// Chapter 2's factory mobs (slice.json enemies: clampCarrier ... pressCaptain): the blows chapter 1 has no word for, and the
// marks they leave on the floor. Mixed into Game beside enemyActions; enemyActions calls in at its tell, its strike, its
// dash and each step, and the game calls tickPatches / tickGrab once a frame.
//
// Floor patches are hostile casts with shape 'floorMark' and a look: 'stamp' (the inspector's red reject mark, slows),
// 'tape' (the packer's sticky strip, slows F2 and enemies, burns away), 'oil' (the oiler's slick, F2 slides, catches fire)
// and 'screw' (a rivet stuck in the floor, stings when stepped on). Fire, water and ice act on them (elementOnPatches).
import { fitsMap } from './map-geometry.js';
import { distance, floorDistance, segmentDistance, FLOOR_FLAT } from './math.js';

const TURN = Math.PI * 2;
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const turnToward = (from, to, most) => { let d = ((to - from + Math.PI) % TURN + TURN) % TURN - Math.PI; return from + Math.max(-most, Math.min(most, d)); };

/** How long a mark that goes once stepped on takes to fade after F2's foot lands on it. */
const ONCE_FADE = 0.4;
export const factoryMobs = {
  /** Extra state a factory tell needs when it starts (who gets supplied, where a leap lands). */
  factoryTell(enemy, tell) {
    const p = this.p;
    if (enemy.boss) { this.fbTell(enemy, tell); return; }
    if (tell.type === 'leap') {
      // The landing spot: where F2 stood, pulled back along the jump until it is floor.
      const reach = Math.min(enemy.attackRange, distance(enemy, p));
      for (let k = 1; k >= 0; k -= 0.1) {
        const x = enemy.x + Math.cos(tell.angle) * reach * k, y = enemy.y + Math.sin(tell.angle) * reach * k;
        if (!this.map?.walkable || fitsMap(x, y, enemy.radius, this.map)) { tell.targetX = x; tell.targetY = y; break; }
      }
      tell.fromX = enemy.x; tell.fromY = enemy.y;
    }
    if (tell.type === 'supply') {
      tell.allies = this.s.enemies.filter(e => e !== enemy && e.hp > 0 && !e.boss && !e.dummy && e.type !== enemy.type && distance(e, enemy) <= enemy.supplyRadius)
        .sort((a, b) => distance(a, enemy) - distance(b, enemy)).slice(0, enemy.supplyCount).map(e => e.id);
    }
  },
  /** Each step before a body acts: a leap carries it through the air, a searchlight turns after F2, a riveter stays knelt. */
  factoryStep(enemy, dt) {
    const tell = enemy.tell, t = this.s.time;
    enemy.lift = 0;
    if (enemy.boss) return this.fbStep(enemy, dt) || enemy.plantedUntil > t;
    if (tell?.type === 'leap') {
      // Up and over in the last 60% of the warning, landing as it ends.
      const u = Math.max(0, Math.min(1, ((t - tell.started) / (tell.until - tell.started) - 0.4) / 0.6));
      enemy.x = tell.fromX + (tell.targetX - tell.fromX) * u; enemy.y = tell.fromY + (tell.targetY - tell.fromY) * u;
      enemy.lift = Math.sin(u * Math.PI) * 1.4 + (u > 0 ? 0 : 0);
    }
    if (tell?.type === 'searchlight') tell.angle = turnToward(tell.angle, angleTo(tell, this.p), enemy.turnDegrees * Math.PI / 180 * dt);
    return enemy.plantedUntil > t;
  },
  /** The factory blows. Returns true when the blow was one of these. */
  factoryExecute(enemy, tell) {
    if (enemy.boss) return this.fbExecute(enemy, tell);
    const p = this.p, t = this.s.time, playerR = this.config.arena.playerRadius, damage = () => this.hurt(this.weakened(enemy, enemy.damage));
    switch (tell.type) {
      case 'grab': {
        // A grabber pole thrust out: whoever it closes on is held for a moment, then flung toward a belt or a press.
        const end = { x: tell.x + Math.cos(tell.angle) * enemy.attackRange, y: tell.y + Math.sin(tell.angle) * enemy.attackRange };
        this.effect('beam', tell.x, tell.y, '#c79a3e', 0.35, 1, { targetX: end.x, targetY: end.y, look: 'thrust' });
        if (!p.dodge && !p.grabbed && segmentDistance(p, tell, end) <= enemy.grabWidth + playerR && damage()) {
          p.grabbed = { by: enemy.id, until: t + enemy.holdSeconds, angle: tell.angle };
          enemy.plantedUntil = t + enemy.holdSeconds + 0.3;
          this.notify('잡혔습니다! 회피로 빠져나오세요.');
        }
        return true;
      }
      case 'leap': {
        // Down on the spot: a blow round it and a red reject mark left on the floor; the stamp sticks for a moment.
        const at = { x: tell.targetX, y: tell.targetY };
        enemy.x = at.x; enemy.y = at.y; enemy.lift = 0;
        if (!p.dodge && floorDistance(at, p) < enemy.leapRadius + playerR * 0.5) damage();
        this.effect('ring', at.x, at.y, '#e8e2d2', 0.5, enemy.leapRadius, { look: 'stampHit' }); this.sense({ kind: 'thud' });
        this.addPatch({ look: 'stamp', x: at.x, y: at.y, radius: enemy.markRadius, duration: enemy.markSeconds, slow: enemy.markSlow, owner: enemy.id });
        enemy.plantedUntil = t + enemy.stuckSeconds; enemy.ready = Math.max(enemy.ready, enemy.plantedUntil + 0.2);
        return true;
      }
      case 'searchlight': {
        // One thin beam down the middle of the light: a hit marks F2, and the next blow she takes hurts more.
        const end = { x: tell.x + Math.cos(tell.angle) * enemy.attackRange, y: tell.y + Math.sin(tell.angle) * enemy.attackRange };
        this.effect('beam', tell.x, tell.y, '#ff5a6e', 0.3, 1, { targetX: end.x, targetY: end.y, look: 'searchlight' });
        if (!p.dodge && segmentDistance(p, tell, end) <= enemy.beamWidth + playerR && damage()) p.markedUntil = t + enemy.markSeconds;
        return true;
      }
      case 'rivets': {
        // Three rivets in a fan; each that comes down sticks in the floor for a while.
        const spread = enemy.spreadDegrees * Math.PI / 180, life = enemy.attackRange / enemy.projectileSpeed;
        for (let i = 0; i < enemy.bullets; i++) {
          const angle = tell.angle + (i - (enemy.bullets - 1) / 2) * spread;
          this.s.projectiles.push({ id: this.id('bullet'), x: enemy.x, y: enemy.y, angle, speed: enemy.projectileSpeed, radius: this.config.rules.enemyProjectileRadius, damage: this.weakened(enemy, enemy.damage), friendly: false, until: t + life, rivet: { seconds: enemy.screwSeconds, damage: enemy.screwDamage }, look: 'rivet' });
        }
        enemy.plantedUntil = t + enemy.plantSeconds;
        return true;
      }
      case 'oil': {
        // A can of oil flung onto F2's spot: a light splash, then a slick she slides on that fire sets alight.
        const at = { x: tell.targetX, y: tell.targetY };
        if (!p.dodge && floorDistance(at, p) < enemy.oilRadius + playerR * 0.5) damage();
        const mine = this.s.casts.filter(c => c.shape === 'floorMark' && c.look === 'oil' && c.owner === enemy.id);
        if (mine.length >= enemy.oilMax) mine[0].done = true;
        this.addPatch({ look: 'oil', x: at.x, y: at.y, radius: enemy.oilRadius, duration: enemy.oilSeconds, slide: true, owner: enemy.id, burn: { seconds: enemy.burnSeconds, damage: enemy.burnDamage, tick: enemy.burnTick } });
        this.effect('scrap', at.x, at.y, '#3a2a18', 0.4, 0.8); this.effect('beam', enemy.x, enemy.y, '#3a2a18', 0.4, 1, { targetX: at.x, targetY: at.y, look: 'oilCan' });
        return true;
      }
      case 'supply': {
        // Brass plates handed out: the chosen bodies take less from every blow for a while.
        for (const ally of this.s.enemies) if (tell.allies?.includes(ally.id) && ally.hp > 0) {
          ally.coatedUntil = t + enemy.coatSeconds; ally.coatArmor = enemy.coatArmor;
          this.effect('beam', enemy.x, enemy.y, '#e0b048', 0.45, 1, { targetX: ally.x, targetY: ally.y, look: 'brassPlate' });
          this.effect('spark', ally.x, ally.y - 0.5, '#ffd257', 0.4, 0.8);
        }
        return true;
      }
      case 'dash2': enemy.dash = { angle: tell.angle, elapsed: 0, second: true }; return true;
    }
    return false;
  },
  /** A charging body: tape laid behind it, crates on its path set off, a wall that stops it short leaves it dazed. */
  factoryDash(enemy, start, dt) {
    const d = enemy.dash, t = this.s.time, moved = distance(start, enemy), meant = enemy.dashDistance / enemy.dashDuration * dt;
    if (enemy.trail === 'tape') {
      d.laid = (d.laid || 0) + moved;
      if (d.laid >= 0.45) { d.laid = 0; this.addPatch({ look: 'tape', x: enemy.x, y: enemy.y, radius: enemy.tapeWidth, duration: enemy.tapeSeconds, slow: enemy.tapeSlow, slowsEnemies: true, owner: enemy.id, angle: d.angle }); }
    }
    if (enemy.crashCrates) for (const h of this.s.hazards || []) if (h.kind === 'crate' && !h.gone && distance(h, enemy) < enemy.radius + 0.6) this.lightCrate(h, 0.05);
    // Stopped by a wall, a crate or a press before the run was out.
    if (enemy.wallStun && d.elapsed > 0.05 && moved < meant * 0.3) {
      enemy.dash = null; enemy.stunUntil = t + enemy.wallStun; enemy.dazedUntil = t + enemy.wallStun; enemy.dazedBonus = enemy.wallBonus;
      this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.4, 0.8, { look: 'quake' }); this.sense({ kind: 'block' });
      return true;
    }
    return false;
  },
  /** When a dash runs out: a captain turns and goes again at F2. */
  factoryDashDone(enemy, d) {
    if (enemy.dashTwice && !d.second) enemy.followup = { type: 'dash2', at: this.s.time + enemy.dashTwice };
  },
  addPatch(patch) { this.s.casts.push({ id: this.id('mark'), shape: 'floorMark', age: 0, ...patch }); },
  /** The floor patch F2 (or a body) stands on, of one look, if any. */
  patchUnder(body, look) { return this.s.casts.find(c => c.shape === 'floorMark' && !c.done && (!look || c.look === look) && floorDistance(c, body) < c.radius); },
  /** How much the patches under a body slow it (0 to 1). Enemies only feel the ones that say so (tape). */
  patchSlow(body, enemy = false) {
    let slow = 0;
    // F2's own puddles (friendly) slow only enemies.
    for (const c of this.s.casts) if (c.shape === 'floorMark' && !c.done && c.slow && (enemy ? c.slowsEnemies : !c.friendly) && floorDistance(c, body) < c.radius) slow = Math.max(slow, c.slow);
    return slow;
  },
  /** Patches age, rivets sting the feet that step on them, burning oil hurts everyone in it. */
  tickPatches(dt) {
    const p = this.p, t = this.s.time, playerR = this.config.arena.playerRadius;
    for (const c of this.s.casts) {
      if (c.shape !== 'floorMark' || c.done) continue;
      c.age += dt;
      if (c.age >= c.duration) { c.done = true; continue; }
      // A mark that goes once stepped on (Iris's reject stamp): F2's foot on it (not mid-dodge) pins one failing tag on her
      // (`failFor`, factory-bosses.js fbFail) and starts its fade. One laid right under her counts only once she has stepped
      // off it and back, so a stamp that hit her does not tag her twice (2026-11-09).
      if (c.once && c.duration > c.age + ONCE_FADE) {
        const on = floorDistance(c, p) < c.radius;
        if (!on) c.clear = true;
        else if (c.clear && !p.dodge) { c.duration = c.age + ONCE_FADE; if (c.failFor) this.fbFail({ type: c.failFor }); }
      }
      // 물웅덩이: whoever stands in F2's puddle gets wet.
      if (c.soaks) { c.statusCast ??= { id: c.id, staggerUsed: {}, fusion: false }; for (const e of this.s.enemies) if (e.hp > 0 && floorDistance(c, e) < c.radius) this.applyStatus(e, 'water', c.statusCast); }
      if (c.look === 'screw' && !p.dodge && floorDistance(c, p) < c.radius + playerR * 0.5 && t >= (p.screwNext || 0) && this.hurt(c.damage)) p.screwNext = t + 0.8;
      if (c.burningUntil > t && t >= (c.burnNext || 0)) {
        c.burnNext = t + c.burn.tick;
        if (!p.dodge && floorDistance(c, p) < c.radius) this.hurt(c.burn.damage);
        for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && floorDistance(c, e) < c.radius) this.hitEnemy(e, c.burn.damage * 2, { dot: true, color: '#ff9a3c' });
        this.effect('spark', c.x + (this.random() - 0.5) * c.radius, c.y + (this.random() - 0.5) * c.radius * FLOOR_FLAT, '#ff9a3c', 0.4, 0.8);
      }
      if (c.burningUntil && c.burningUntil <= t) c.done = true;
      if (!this.active) return;
    }
    this.s.casts = this.s.casts.filter(c => !(c.shape === 'floorMark' && c.done));
  },
  /** Fire burns tape and lights oil; water washes stamps and oil away; ice hardens oil so it no longer slides. */
  elementOnPatches(cast, touches) {
    const t = this.s.time, has = e => cast.elements?.includes(e);
    for (const c of this.s.casts) {
      if (c.shape !== 'floorMark' || c.done || !touches(c)) continue;
      if (has('fire') && c.look === 'tape') { c.done = true; this.effect('spark', c.x, c.y, '#ff9a3c', 0.3, 0.6); }
      if (has('fire') && c.look === 'oil' && !(c.burningUntil > t)) this.igniteOil(c);
      if (has('water') && (c.look === 'stamp' || c.look === 'oil')) c.done = true;
      if (has('ice') && c.look === 'oil') { c.frozenUntil = t + 4; c.slide = false; }
    }
  },
  igniteOil(c) { c.burningUntil = this.s.time + c.burn.seconds; c.burnNext = this.s.time; this.effect('ring', c.x, c.y, '#ff7a2c', 0.5, c.radius, { look: 'boom' }); this.sense({ kind: 'burst' }); },
  /** Held in a grabber: F2 hangs at the claw until she dodges free or is flung. */
  tickGrab() {
    const p = this.p, g = p.grabbed, t = this.s.time;
    if (!g || g.crane) return;
    const by = this.s.enemies.find(e => e.id === g.by && e.hp > 0);
    if (!by || p.dodge) { p.grabbed = null; return; }
    const hold = { x: by.x + Math.cos(g.angle) * 1.1, y: by.y + Math.sin(g.angle) * 1.1 };
    this.move(p, (hold.x - p.x) * 0.5, (hold.y - p.y) * 0.5);
    if (t < g.until) return;
    // Flung: toward the nearest belt or press when one is close, else straight on past the carrier.
    const target = (this.s.hazards || []).filter(h => !h.gone && (h.kind === 'belt' || h.kind === 'press') && distance(h, p) < 7).sort((a, b) => distance(a, p) - distance(b, p))[0];
    const angle = target ? angleTo(p, target) : g.angle, units = by.throwUnits;
    p.blown = { x: Math.cos(angle) * units, y: Math.sin(angle) * units, left: 0.35 };
    p.grabbed = null; this.effect('dodge', p.x, p.y, '#c79a3e', 0.3, 1);
  },
  /** A rivet that came down: it stays in the floor for a while. */
  rivetLanded(b) { if (b.rivet && !b.landed) { b.landed = true; this.addPatch({ look: 'screw', x: b.x, y: b.y, radius: 0.35, duration: b.rivet.seconds, damage: b.rivet.damage }); } },
};
