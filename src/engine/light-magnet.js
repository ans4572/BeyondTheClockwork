// Light and magnet (docs/design/light-magnet-concepts.md): their two statuses, the extras of their four skills and their
// cards, and the thirteen fusions with light or magnet, each a cast shape of its own (slice.json fusionBehavior).
// Installed on Game.prototype (game.js), so `this` is the game. The numbers of a fusion are on its combat.json record
// (pillarDamage, rollDamage and the like); its geometry and timing are in slice.json fusionBehavior.
import { distance, floorDistance, inCone, segmentDistance, floorShrink, FLOOR_FLAT } from './math.js';

const SHAPES = new Set(['sun', 'prism', 'refract', 'lightDash', 'constellation', 'shower', 'ball', 'shards', 'rail', 'saw', 'string', 'vine', 'aurora', 'lmReturn']);
/** A body a cast can reach: standing, out of the ground and not still climbing out of a summon. */
const reachable = (game, e) => e.hp > 0 && !e.hidden && !(e.summonUntil > game.s.time);
/** Bosses and elites stop a rolling ball, a flying saw and a string. */
const big = e => !!(e.boss || e.elite);
const LIGHT = '#f3e2a0', MAGNET = '#9fbbd8';

export const lightMagnet = {
  // ---------- statuses ----------
  revealed(enemy) { return enemy?.statuses?.reveal > this.s.time; },
  ironDustOf(enemy) { return enemy?.statuses?.ironDust > this.s.time ? enemy.ironDust || 0 : 0; },
  /** 쇳가루: every layer makes the body take more stagger. */
  ironDustStagger(enemy) { return this.ironDustOf(enemy) * (this.status('ironDust')?.staggerTakenPerStack || 0); },
  /** 드러냄 (and 맑은 렌즈): what a revealed body adds to the chance of a critical hit and to its size. */
  revealCrit(enemy) {
    if (!this.revealed(enemy)) return { chance: 0, size: 0 };
    const info = this.status('reveal');
    return { chance: (info?.incomingCritChanceBonus || 0) + (this.trait('clearLens')?.critChanceBonus || 0), size: info?.incomingCritMultiplierBonus || 0 };
  },
  /** applyStatus hands light and magnet here: true when it did. */
  lmApplyStatus(enemy, status, cast, stacks) {
    if (status === 'reveal') {
      const lasts = this.status('reveal').duration + (this.trait('clearLens')?.extraDuration || 0);
      enemy.statuses.reveal = Math.max(enemy.statuses.reveal || 0, this.s.time + lasts);
      return true;
    }
    if (status !== 'ironDust') return false;
    // One layer a cast for each body (끌어올리기 lays two at once): a fusion's many blows do not fill it on their own.
    const key = `${cast.id}:ironDust`;
    if (enemy.statusApplied[key]) return true;
    enemy.statusApplied[key] = Infinity;
    const info = this.status('ironDust');
    enemy.ironDust = Math.min(info.maxStacks, this.ironDustOf(enemy) + stacks);
    enemy.statuses.ironDust = this.s.time + info.duration;
    return true;
  },
  /**
   * A magnet blow on a body already full of 쇳가루 sets it: the dust hardens for setDamage (2026-11-21, in place of a boss's
   * stagger, which no longer opens anything) and an ordinary body stiffens.
   */
  lmIronHit(enemy) {
    const info = this.status('ironDust'), t = this.s.time;
    if (!info || enemy.hp <= 0 || this.ironDustOf(enemy) < info.setAtStacks || t < (enemy.ironSetLock || 0)) return;
    enemy.ironDust = 0; enemy.statuses.ironDust = 0; enemy.ironSetLock = t + info.setReapplyLock;
    if (info.setDamage) this.hitEnemy(enemy, info.setDamage * this.statusPower, { dot: true, color: MAGNET });
    if (enemy.hp <= 0) return;
    if (!enemy.boss) { enemy.stunUntil = Math.max(enemy.stunUntil, t + info.normalSetSeconds); enemy.ironSetUntil = t + info.normalSetSeconds; }
    this.effect('ring', enemy.x, enemy.y, MAGNET, 0.5, 0.9, { look: 'lmIronSet' });
    this.sense({ kind: 'ironSet' });
    // 굳힘 파쇄 (magnet's special trait): the dust bursts off the body into the ones round it.
    const shatter = this.trait('setShatter');
    if (shatter) {
      const burst = { id: this.id('shatter'), staggerUsed: {}, fusion: false, statusAt: {} };
      for (const other of this.s.enemies) {
        if (other === enemy || !reachable(this, other) || floorDistance(enemy, other) > shatter.radius + other.radius) continue;
        this.hitEnemy(other, shatter.damage * this.statusPower, { dot: true, color: MAGNET });
        if (other.hp > 0) this.applyStatus(other, 'magnet', burst, shatter.stacks);
      }
      this.effect('ring', enemy.x, enemy.y, MAGNET, 0.45, shatter.radius, { look: 'lmShatter' });
    }
  },
  /** 번쩍 처치 (light's special trait): a revealed body that falls flashes, revealing and hurting the ones round it. */
  lmOnFall(enemy) {
    const flash = this.trait('flashKill');
    if (!flash || !this.revealed(enemy)) return;
    const ring = { id: this.id('flash'), staggerUsed: {}, fusion: false, statusAt: {} };
    for (const other of this.s.enemies) {
      if (other === enemy || !reachable(this, other) || floorDistance(enemy, other) > flash.radius + other.radius) continue;
      this.applyStatus(other, 'light', ring);
      this.hitEnemy(other, flash.damage * this.statusPower, { dot: true, color: LIGHT });
    }
    this.effect('ring', enemy.x, enemy.y, LIGHT, 0.4, flash.radius, { look: 'lmFlash' });
  },
  /** After any blow of a cast: 섬광탄 blinds ordinary bodies. */
  lmAfterHit(cast, enemy) {
    if (cast.blind && !enemy.boss && enemy.hp > 0) { enemy.stunUntil = Math.max(enemy.stunUntil, this.s.time + cast.blind); enemy.blindUntil = this.s.time + cast.blind; }
  },
  /**
   * The room hazards: light passing over a plate flashes it and reveals whatever stands on it; a magnet skill reaching a
   * crate or a plate throws scrap off it into the bodies beside it (once a cast for each hazard). Nothing is moved.
   */
  lmOnHazard(cast, h) {
    const t = this.s.time;
    if (h.kind === 'plate' && cast.elements.includes('light') && !(h.flashAt > t - 0.3)) {
      h.flashAt = t;
      const ring = { id: this.id('plate'), staggerUsed: {}, fusion: false, statusAt: {} };
      for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(h, e) <= (h.half || 1) + e.radius) this.applyStatus(e, 'light', ring);
      this.effect('ring', h.x, h.y, LIGHT, 0.4, h.half || 1, { look: 'lmFlash' });
    }
    if ((h.kind === 'crate' || h.kind === 'plate') && cast.elements.includes('magnet')) {
      const rule = this.config.hazards?.elements, key = `${cast.id}`;
      if ((h.scrapCasts ??= []).includes(key)) return;
      h.scrapCasts.push(key); if (h.scrapCasts.length > 8) h.scrapCasts.shift();
      const reach = rule?.scrapReach ?? 1.5, damage = rule?.scrapDamage ?? 15, ring = { id: this.id('scrap'), staggerUsed: {}, fusion: false, statusAt: {} };
      for (const e of this.s.enemies) {
        if (!reachable(this, e) || floorDistance(h, e) > reach + e.radius) continue;
        this.hitEnemy(e, damage * this.statusPower, { dot: true, color: MAGNET });
        if (e.hp > 0) this.applyStatus(e, 'magnet', ring);
      }
      this.effect('scrap', h.x, h.y, '#8d939c', 0.5, 1);
    }
  },

  // ---------- the four skills' extras and their cards ----------
  lmSkillMods(cast, mod) {
    if (mod.id === 'splitBeam') cast.split = mod;
    if (mod.id === 'twinLens') cast.twin = mod;
    if (mod.id === 'delayFuse') { cast.fuse = mod; cast.next = mod.waitSeconds; cast.blind = mod.blindSeconds; }
    if (mod.id === 'bounceFlash') cast.bounce = mod;
    if (mod.id === 'heavySlug') { cast.hits = 1; cast.range = mod.range; cast.damage = mod.damage; cast.pierce = true; cast.pierceMax = 1 + mod.pierce; cast.ironDustStacks = mod.ironDustStacks; cast.slug = true; if (mod.width) cast.width = mod.width; }
    if (mod.id === 'magnetReturn') cast.magnetReturn = mod;
    if (mod.id === 'trackingField') cast.tracking = mod;
    if (mod.id === 'scrapSwirl') cast.swirl = mod;
  },
  /** Every step of every cast, before its shape moves it: the light and magnet skills' own timing. */
  lmBeforeStep(cast, dt) {
    if (cast.fusion || cast.derived && !cast.lm) return;
    const t = this.s.time;
    // 연사 렌즈: the second beam is made when the first goes, waiting its gap (beam shape honours delay).
    if (cast.twin && !cast.twinMade) {
      cast.twinMade = true; cast.damage *= cast.twin.damageShare;
      this.s.casts.push({ ...cast, id: this.id('cast'), derived: true, lm: true, twin: null, twinMade: true, reaim: true, delay: cast.twin.gap, age: 0, felt: true, staggerUsed: {}, hit: [], statusAt: {} });
    }
    // 섬광탄: a thrown can in the air first (drawn), then the burst; 지연 신관 waits on the floor for a foot.
    if (cast.skillId === 'flashBomb' && cast.fuse && cast.pulse === 0 && cast.age >= (cast.throwSeconds || 0.35) + 0.25 && cast.next > cast.age) {
      if (this.s.enemies.some(e => reachable(this, e) && floorDistance(cast, e) <= 0.8 + e.radius)) cast.next = cast.age;
    }
    if (cast.skillId === 'magneticLift' && cast.pulse === 0) {
      // 따라가는 자기장: while the scrap rises its spot drifts after the cursor, as far as maxShift from where it began.
      if (cast.tracking && cast.age < cast.next && this.p.aimPoint) {
        cast.originX ??= cast.x; cast.originY ??= cast.y;
        const aim = this.p.aimPoint, step = 8 * dt, dx = aim.x - cast.x, dy = aim.y - cast.y, d = Math.hypot(dx, dy);
        if (d > 0.05) { cast.x += dx / d * Math.min(step, d); cast.y += dy / d * Math.min(step, d); }
        const ox = cast.x - cast.originX, oy = cast.y - cast.originY, off = Math.hypot(ox, oy), max = cast.tracking.maxShift;
        if (off > max) { cast.x = cast.originX + ox / off * max; cast.y = cast.originY + oy / off * max; }
      }
      // 쇳조각 소용돌이: the rising scrap spins round the circle, cutting what stands in it.
      if (cast.swirl) {
        cast.swirled ??= 0;
        while (cast.swirled < cast.swirl.hits && cast.age + 1e-7 >= (cast.swirled + 1) * cast.swirl.interval * 0.9) {
          cast.swirled++;
          for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(cast, e) <= cast.radius + e.radius) this.castHit(cast, e, cast.swirl.damage);
        }
      }
    }
  },
  /** After each pulse of a target-shaped skill: 튀는 섬광탄 bounces on once. */
  lmAfterPulse(cast) {
    if (cast.bounce && !cast.bounced && cast.skillId === 'flashBomb') {
      cast.bounced = true;
      const m = cast.bounce, a = cast.angle, x = cast.x + Math.cos(a) * m.bounceDistance, y = cast.y + Math.sin(a) * m.bounceDistance * FLOOR_FLAT;
      const b = this.bounds, at = { x: Math.max(b.left, Math.min(b.right, x)), y: Math.max(b.top, Math.min(b.bottom, y)) };
      this.s.casts.push({ ...cast, ...at, id: this.id('cast'), derived: true, lm: true, bounce: null, fuse: null, radius: m.radius, damage: cast.damage * m.damageShare, age: 0, pulse: 0, next: 0.3, hits: 1, felt: true, staggerUsed: {}, hit: [], statusAt: {} });
    }
  },
  /**
   * 프리즘 광선 after its beam lands: 분광 splits it in three at the first body it struck (2026-11-22; at its end before,
   * 7 units out, where hardly anything stood), or at its end when it struck none. The branches strike only bodies the beam
   * itself missed, each once.
   */
  lmBeamExtras(cast, end, struck = []) {
    if (!cast.split) return;
    const m = cast.split, first = struck.slice().sort((a, b) => distance({ x: cast.startX, y: cast.startY }, a) - distance({ x: cast.startX, y: cast.startY }, b))[0];
    const from = first ? { x: first.x, y: first.y } : end, done = new Set(struck);
    for (let i = 0; i < m.branches; i++) {
      const a = cast.angle + (i - (m.branches - 1) / 2) * 0.45, len = m.branchRange * floorShrink(a);
      const to = { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
      for (const e of this.s.enemies) if (reachable(this, e) && !done.has(e) && segmentDistance(e, from, to) <= cast.halfWidth + e.radius) { done.add(e); this.castHit(cast, e, cast.damage * m.damageShare); }
      this.effect('lmBeam', from.x, from.y, LIGHT, 0.3, 1, { targetX: to.x, targetY: to.y, width: 0.6 });
    }
  },
  /** 자석 회수: when every pellet is down, they fly back to F2, striking what they pass (no 쇳가루). */
  lmAfterShots(cast) {
    if (!cast.magnetReturn || cast.returned) return;
    cast.returned = true;
    const pellets = cast.projectiles.map(b => ({ x: b.x, y: b.y, hit: [] }));
    this.s.casts.push({ id: this.id('cast'), skillId: cast.skillId, shape: 'lmReturn', fusion: false, slot: cast.slot, elements: [], color: cast.color, pellets, damage: cast.damage * cast.magnetReturn.damageShare,
      wait: cast.magnetReturn.returnAfter, age: 0, staggerUsed: {}, hit: [], statusAt: {}, projectiles: [], felt: true, derived: true, lm: true });
  },

  // ---------- fusions ----------
  lmFusionRecord(cast) { return this.c.fusions.find(f => f.id === cast.skillId) || {}; },
  lmNearest(from, range, skip = null) {
    return this.s.enemies.filter(e => e !== skip && reachable(this, e) && distance(from, e) <= range + e.radius).sort((a, b) => distance(from, a) - distance(from, b))[0] || null;
  },
  /** The first body in F2's aim (within arc degrees and range), or the nearest in range when none is in it; only bodies in her sight (2026-11-22). */
  lmFirstInAim(cast, range, arc = 60) {
    const p = this.p, ok = e => reachable(this, e) && this.lmInSight(e);
    const inAim = this.s.enemies.filter(e => ok(e) && inCone(p, e, cast.angle, range, arc)).sort((a, b) => distance(p, a) - distance(p, b))[0];
    return inAim || this.s.enemies.filter(e => ok(e) && distance(p, e) <= range + e.radius).sort((a, b) => distance(p, a) - distance(p, b))[0] || null;
  },
  /**
   * 한낮 표적's body (2026-11-22): the one nearest the cursor within cursorReach of it, else the nearest to F2; within range
   * of her and in her sight. Null when there is none (the sun then stands where it was aimed).
   */
  lmSunPick(cast, aim) {
    const p = this.p, ok = e => reachable(this, e) && distance(p, e) <= cast.range + e.radius && this.lmInSight(e);
    if (aim) {
      const near = this.s.enemies.filter(e => ok(e) && distance(aim, e) <= (cast.cursorReach || 2.5) + e.radius).sort((a, b) => distance(aim, a) - distance(aim, b))[0];
      if (near) return near;
    }
    return this.s.enemies.filter(ok).sort((a, b) => distance(p, a) - distance(p, b))[0] || null;
  },
  /** 공명 별자리's bodies: the nearest few in range and in F2's sight. */
  lmStarPicks(cast) {
    const p = this.p;
    return this.s.enemies.filter(e => reachable(this, e) && distance(p, e) <= cast.range + e.radius && this.lmInSight(e)).sort((a, b) => distance(p, a) - distance(p, b)).slice(0, cast.targets);
  },
  /**
   * 굴절 광선's target (2026-11-22): the body nearest the cursor within cursorReach of it, else the nearest in the aim's
   * arc; always within range of F2 and in her sight, never one behind her. Null when there is none.
   */
  lmRefractPick(cast, aim, exclude = null) {
    const p = this.p, ok = e => e !== exclude && reachable(this, e) && distance(p, e) <= cast.range + e.radius && this.lmInSight(e);
    if (aim) {
      const near = this.s.enemies.filter(e => ok(e) && distance(aim, e) <= (cast.cursorReach || 2.5) + e.radius).sort((a, b) => distance(aim, a) - distance(aim, b))[0];
      if (near) return near;
    }
    const angle = aim && distance(p, aim) > 0.3 ? Math.atan2(aim.y - p.y, aim.x - p.x) : p.angle;
    return this.s.enemies.filter(e => ok(e) && inCone(p, e, angle, cast.range, cast.acquisitionArc || 60)).sort((a, b) => distance(p, a) - distance(p, b))[0] || null;
  },
  /** Whether a straight line from F2 (or from `from`) reaches the body without a wall in between. */
  lmInSight(e, from = this.p) {
    const d = distance(from, e);
    if (d < 0.5) return true;
    const { reach, wall } = this.lineReach(from, Math.atan2(e.y - from.y, e.x - from.x), d);
    return !wall || reach >= d - e.radius - 0.3;
  },
  /**
   * A fusion that does nothing without a body to work on is not cast, and costs nothing, when there is none: 굴절 광선
   * (2026-11-22), and 공명 별자리 and 북극광 고리 (2026-11-22). Returns the notice to show, or null.
   */
  lmFusionBlocked(fusion, target) {
    const behavior = this.config.fusionBehavior[fusion.id], p = this.p;
    if (behavior?.shape === 'refract') return this.lmRefractPick(behavior, target || p.aimPoint || null) ? null : '광선이 닿을 적이 앞에 없습니다';
    if (behavior?.shape === 'constellation') return this.lmStarPicks(behavior).length ? null : '별자리로 이을 적이 가까이 없습니다';
    if (behavior?.shape === 'aurora') return this.s.enemies.some(e => reachable(this, e) && distance(p, e) <= behavior.range + e.radius) ? null : '오로라가 닿을 적이 가까이 없습니다';
    return null;
  },
  lmBody(id) { return id === null || id === undefined ? null : this.s.enemies.find(e => e.id === id && reachable(this, e)) || null; },
  setupLightMagnetFusion(cast) {
    if (!SHAPES.has(cast.shape) || cast.setUp) return;
    cast.setUp = true;
    const p = this.p, f = this.lmFusionRecord(cast);
    cast.record = f; cast.next = cast.delay || 0; cast.pulse = 0;
    if (cast.shape === 'sun') { const e = this.lmSunPick(cast, this.p.aimPoint || { x: cast.x, y: cast.y }); cast.tid = e?.id ?? null; if (e) { cast.x = e.x; cast.y = e.y; } }
    if (cast.shape === 'prism') { const at = { x: p.x, y: p.y }; this.move(at, Math.cos(cast.angle) * cast.forward, Math.sin(cast.angle) * cast.forward, 0.3); cast.x = at.x; cast.y = at.y; cast.shots = []; }
    if (cast.shape === 'refract') { const e = this.lmRefractPick(cast, this.p.aimPoint || { x: cast.x, y: cast.y }); cast.tid = e?.id ?? null; cast.bends = []; if (!e) cast.done = true; }
    if (cast.shape === 'lightDash') {
      cast.fromX = p.x; cast.fromY = p.y;
      // The slide itself is the ordinary dash (it moves F2, strikes each body once and keeps her untouchable).
      this.s.casts.push({ ...cast, id: this.id('cast'), shape: 'dash', derived: true, range: cast.distance, radius: cast.halfWidth, knockback: 0, pierceDash: { pull: 0 }, damage: f.damagePerHit, hits: 1, age: 0, staggerUsed: cast.staggerUsed, hit: [], statusAt: {}, setUp: true });
      this.effect('ring', p.x, p.y, LIGHT, 0.3, 0.8, { look: 'lmFlash' });
    }
    if (cast.shape === 'constellation') cast.links = null;
    if (cast.shape === 'shower') { cast.struck = false; cast.rainAt = null; }
    if (cast.shape === 'vine') {
      const e = this.lmFirstInAim(cast, cast.range, cast.acquisitionArc);
      cast.tid = e?.id ?? null;
      const far = e ? 0 : this.lineReach(p, cast.angle, cast.range * floorShrink(cast.angle)).reach;
      const end = e || { x: p.x + Math.cos(cast.angle) * far, y: p.y + Math.sin(cast.angle) * far };
      cast.x = end.x; cast.y = end.y; cast.fromX = p.x; cast.fromY = p.y;
      cast.headX = p.x; cast.headY = p.y; cast.arrivedAt = null; cast.crossed = [];
    }
    if (cast.shape === 'ball') { cast.x = p.x + Math.cos(cast.angle) * cast.startDistance; cast.y = p.y + Math.sin(cast.angle) * cast.startDistance * FLOOR_FLAT; cast.travel = 0; cast.stuckAt = null; cast.heats = 0; cast.beat = 0; cast.burstAt = null; cast.passed = []; cast.clingUntil = 0; }
    if (cast.shape === 'shards') { cast.flights = []; cast.orbitTicks = 0; }
    if (cast.shape === 'rail') cast.fired = false;
    if (cast.shape === 'saw') { cast.x = p.x; cast.y = p.y; cast.travel = 0; cast.lodgedAt = null; cast.crossed = []; cast.spins = 0; cast.spinBase = 0; cast.hopped = false; cast.leftId = null; }
    if (cast.shape === 'string') {
      cast.fromX = p.x; cast.fromY = p.y; cast.heldId = null;
      const { reach } = this.lineReach(p, cast.angle, cast.range * floorShrink(cast.angle));
      let end = { x: p.x + Math.cos(cast.angle) * reach, y: p.y + Math.sin(cast.angle) * reach };
      for (let d = 0.5; d <= reach; d += 0.1) {
        const at = { x: p.x + Math.cos(cast.angle) * d, y: p.y + Math.sin(cast.angle) * d }, held = this.s.enemies.find(e => reachable(this, e) && big(e) && floorDistance(at, e) <= e.radius * 0.6);
        if (held) { end = at; cast.heldId = held.id; break; }
      }
      cast.x = end.x; cast.y = end.y; cast.plucks = [];
    }
    if (cast.shape === 'aurora') { cast.lastId = null; cast.streak = 0; cast.curtains = []; }
  },
  /** The fusions that hold F2 back from her other skills while they run: the rail gathering its charge. */
  lightMagnetBusy() { return this.s.casts.some(c => c.shape === 'rail' && !c.fired); },
  /** One step of a light or magnet fusion (or a returning pellet); false for any other cast. */
  updateLightMagnetFusion(cast, dt) {
    if (!SHAPES.has(cast.shape)) return false;
    this.setupLightMagnetFusion(cast);
    if (cast.done) return true;
    const t = this.s.time, p = this.p, f = cast.record || {};
    const hitIn = (at, radius, damage) => { let n = 0; for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(at, e) <= radius + e.radius) { this.castHit(cast, e, damage); n++; } this.elementOnHazards(cast, h => floorDistance(at, h) <= radius + 0.6); return n; };
    const onLine = (a, b, half) => this.s.enemies.filter(e => reachable(this, e) && segmentDistance(e, a, b) <= half + e.radius);

    // 한낮 표적: a small sun follows one body, dropping heat pillars, then bursts.
    if (cast.shape === 'sun') {
      let body = this.lmBody(cast.tid);
      // A fallen body hands the sun on to the nearest one within hopReach of it (2026-11-22: it leapt up to range before).
      if (!body && cast.tid !== null) { body = this.lmNearest(cast, cast.hopReach || 3); cast.tid = body?.id ?? null; }
      if (body) { cast.x = body.x; cast.y = body.y; }
      while (cast.pulse < f.pillars && cast.age + 1e-7 >= cast.next) { hitIn(cast, cast.pillarRadius, f.pillarDamage); this.effect('ring', cast.x, cast.y, LIGHT, 0.3, cast.pillarRadius, { look: 'lmPillar' }); cast.pulse++; cast.next += cast.interval; }
      if (cast.pulse >= f.pillars && cast.age + 1e-7 >= cast.next) { hitIn(cast, f.burstRadius, f.burstDamage); this.effect('ring', cast.x, cast.y, '#ffb347', 0.5, f.burstRadius, { look: 'lmSunBurst' }); this.sense({ kind: 'fusionBurst' }); cast.done = true; }
      return true;
    }
    // 서리 프리즘: a prism standing ahead of F2 fires a refracted beam at the nearest few bodies every beat.
    if (cast.shape === 'prism') {
      while (cast.pulse < cast.pulses && cast.age + 1e-7 >= cast.next) {
        const picks = this.s.enemies.filter(e => reachable(this, e) && distance(cast, e) <= cast.reach + e.radius && this.lmInSight(e, cast)).sort((a, b) => distance(cast, a) - distance(cast, b)).slice(0, cast.targets);
        for (const e of picks) { this.castHit(cast, e, f.damagePerHit); cast.shots.push({ x: e.x, y: e.y, at: t }); }
        cast.pulse++; cast.next += cast.interval;
      }
      cast.shots = cast.shots.filter(s => t - s.at < 0.3);
      if (cast.pulse >= cast.pulses && cast.age >= cast.next) cast.done = true;
      return true;
    }
    // 굴절 광선: a beam fastened on one body; every tick it bends on to the nearest other ones.
    if (cast.shape === 'refract') {
      const aim = p.aimPoint;
      let body = this.lmBody(cast.tid);
      // The cursor laid clearly on another body (within switchReach of it, and nearer than the current one) moves the beam there.
      if (aim) {
        const pointed = this.s.enemies.filter(e => e !== body && reachable(this, e) && distance(p, e) <= cast.range + e.radius && distance(aim, e) <= (cast.switchReach || 1.5) + e.radius && this.lmInSight(e)).sort((a, b) => distance(aim, a) - distance(aim, b))[0];
        if (pointed && (!body || distance(aim, pointed) < distance(aim, body) - 0.5)) { body = pointed; cast.tid = body.id; }
      }
      // It lets go of a body that walks off past leash or behind a wall, and of one that falls, for the next by the same rule.
      if (body && (distance(p, body) > (cast.leash || 9) + body.radius || !this.lmInSight(body))) body = null;
      if (!body) { body = this.lmRefractPick(cast, aim); cast.tid = body?.id ?? null; if (!body) { cast.done = true; return true; } }
      if (body) { cast.x = body.x; cast.y = body.y; }
      while (cast.pulse < f.hits && cast.age + 1e-7 >= cast.next) {
        if (body) {
          this.castHit(cast, body, f.damagePerHit);
          // Bent on to the nearest few other bodies (bendTargets, 2026-11-21: three; one before).
          const others = this.s.enemies.filter(e => e !== body && reachable(this, e) && floorDistance(body, e) <= 5 + e.radius).sort((a, b) => distance(body, a) - distance(body, b)).slice(0, cast.bendTargets || 1);
          for (const other of others) { this.castHit(cast, other, f.refractDamage); cast.bends.push({ id: other.id, x: other.x, y: other.y, at: t }); }
          this.elementOnHazards(cast, h => segmentDistance(h, p, body) <= 0.6);
        }
        cast.pulse++; cast.next += cast.interval;
      }
      cast.bends = cast.bends.filter(b => t - b.at < 0.2);
      if (cast.pulse >= f.hits && cast.age >= cast.next) cast.done = true;
      return true;
    }
    // 빛살 질주: the slide is its dash cast; this one waits to burst the band left behind.
    if (cast.shape === 'lightDash') {
      if (cast.toX === undefined && cast.age >= cast.duration) { cast.toX = p.x; cast.toY = p.y; }
      if (cast.toX !== undefined && cast.age + 1e-7 >= cast.duration + cast.bandDelay) {
        const a = { x: cast.fromX, y: cast.fromY }, b = { x: cast.toX, y: cast.toY };
        for (const e of onLine(a, b, cast.halfWidth)) this.castHit(cast, e, f.damagePerHit);
        this.elementOnHazards(cast, h => segmentDistance(h, a, b) <= cast.halfWidth + 0.6);
        this.effect('lmBeam', a.x, a.y, LIGHT, 0.4, 1, { targetX: b.x, targetY: b.y, width: cast.halfWidth * 2, burst: true });
        this.sense({ kind: 'fusionBurst' }); cast.done = true;
      }
      return true;
    }
    // 공명 별자리: the nearest bodies joined by lines of light that ring five times.
    if (cast.shape === 'constellation') {
      if (!cast.links) {
        const picks = this.lmStarPicks(cast);
        if (!picks.length) { cast.done = true; return true; }
        cast.anchor = { x: p.x, y: p.y };
        if (picks.length === 1) cast.links = [[null, picks[0].id]];
        else {
          const path = [picks.shift()];
          while (picks.length) { const last = path[path.length - 1]; picks.sort((a, b) => distance(last, a) - distance(last, b)); path.push(picks.shift()); }
          // A line between two bodies with a wall between them is drawn from F2 to the second instead (2026-11-22).
          cast.links = path.slice(1).map((e, i) => [this.lmInSight(e, path[i]) ? path[i].id : null, e.id]);
        }
        cast.members = [...new Set(cast.links.flat().filter(id => id !== null))];
      }
      const pos = id => id === null ? cast.anchor : this.s.enemies.find(e => e.id === id) || null;
      cast.lines = cast.links.map(([a, b]) => [pos(a), pos(b)]).filter(([a, b]) => a && b).map(([a, b]) => [{ x: a.x, y: a.y }, { x: b.x, y: b.y }]);
      while (cast.pulse < f.hits && cast.age + 1e-7 >= cast.next) {
        const struck = new Set(cast.members.map(id => this.lmBody(id)).filter(Boolean));
        for (const [a, b] of cast.lines) for (const e of onLine(a, b, cast.lineHalfWidth)) struck.add(e);
        for (const e of struck) this.castHit(cast, e, f.damagePerHit);
        cast.ringAt = t; cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= f.hits && cast.age >= cast.next) cast.done = true;
      return true;
    }
    // 소나기 무지개 (2026-11-21, in place of the rainbow bridge): a shower on the spot aimed at, then a rainbow and a strike
    // of sunlight there. It stays where it was placed (aimed, not locked on a body).
    if (cast.shape === 'shower') {
      while (cast.pulse < f.rainTicks && cast.age + 1e-7 >= cast.next) { hitIn(cast, cast.radius, f.rainDamage); cast.rainAt = t; cast.pulse++; cast.next += cast.interval; }
      if (!cast.struck && cast.age >= cast.strikeAt) {
        cast.struck = true; hitIn(cast, f.burstRadius, f.burstDamage);
        this.effect('ring', cast.x, cast.y, LIGHT, 0.32, f.burstRadius * 0.6, { look: 'lmPillar' });
        this.effect('ring', cast.x, cast.y, LIGHT, 0.5, f.burstRadius, { look: 'lmSunBurst' }); this.sense({ kind: 'fusionBurst' });
      }
      if (cast.struck && cast.age >= cast.strikeAt + 0.7) cast.done = true;
      return true;
    }
    // 쇳물 공: a hot ball rolls on; a big body stops it, and it clings there until it bursts.
    if (cast.shape === 'ball') {
      if (cast.stuckAt === null && cast.age >= cast.delay && cast.age >= cast.clingUntil) {
        const step = cast.speed * dt, before = { x: cast.x, y: cast.y };
        this.move(cast, Math.cos(cast.angle) * step, Math.sin(cast.angle) * step * FLOOR_FLAT, 0.3);
        const moved = distance(before, cast); cast.travel += moved;
        // The first body it touches stops it (any body, 2026-11-21). An ordinary one with more bodies ahead in its path holds
        // it only clingSeconds, and it rolls on through the crowd, heating as it goes, to cling at the last one and burst;
        // a boss or elite, or a body with none behind it, holds it for good.
        const stopper = this.s.enemies.find(e => reachable(this, e) && !cast.passed.includes(e.id) && floorDistance(cast, e) <= e.radius + 0.7);
        if (stopper) {
          const ux = Math.cos(cast.angle), uy = Math.sin(cast.angle) * FLOOR_FLAT, un = Math.hypot(ux, uy) || 1;
          const ahead = big(stopper) ? null : this.s.enemies.filter(e => e !== stopper && reachable(this, e) && !cast.passed.includes(e.id) && (() => { const dx = e.x - cast.x, dy = e.y - cast.y, d = Math.hypot(dx, dy); return d <= cast.aheadReach && d > 0 && (dx * ux + dy * uy) / (d * un) > 0.5; })()).sort((m, n) => distance(cast, m) - distance(cast, n))[0];
          // It rolls on at the nearest of them, so it goes through the crowd instead of past it.
          if (ahead) { cast.passed.push(stopper.id); cast.clingUntil = cast.age + cast.clingSeconds; cast.angle = Math.atan2((ahead.y - cast.y) / FLOOR_FLAT, ahead.x - cast.x); }
          else { cast.stuckAt = cast.age; cast.stuckId = stopper.id; }
        } else if (cast.travel >= cast.range || moved < step * 0.4) cast.burstNow = true;
      }
      while (cast.heats < f.rollHits && cast.age + 1e-7 >= cast.delay + (cast.beat + 1) * cast.interval) {
        cast.beat++;
        if (hitIn(cast, cast.rollRadius, f.rollDamage)) cast.heats++;
      }
      if (cast.burstNow || (cast.stuckAt !== null && cast.age - cast.stuckAt >= cast.stickSeconds)) {
        hitIn(cast, f.burstRadius, f.burstDamage); this.effect('ring', cast.x, cast.y, '#ff8a3a', 0.5, f.burstRadius, { look: 'lmMoltenBurst' }); this.sense({ kind: 'fusionBurst' }); cast.done = true;
      }
      return true;
    }
    // 서리 쇳조각: six shards circle F2, then fly one each at the nearest bodies.
    if (cast.shape === 'shards') {
      cast.x = p.x; cast.y = p.y;
      while (cast.orbitTicks < f.orbitHits && cast.age + 1e-7 >= (cast.orbitTicks + 1) * cast.interval) {
        cast.orbitTicks++;
        // Every body inside the circle (2026-11-21: the circle widened to 2.4, and one hugging F2 must not slip under it).
        for (const e of this.s.enemies) if (reachable(this, e) && floorDistance(p, e) <= cast.orbit + cast.band + e.radius) this.castHit(cast, e, f.orbitDamage);
      }
      if (!cast.flights.length && cast.age >= cast.orbitSeconds) {
        // Only bodies within shardReach and in F2's sight (2026-11-22: they flew at any body in the room before).
        const inReach = e => reachable(this, e) && distance(p, e) <= (cast.shardReach || 7) + e.radius && this.lmInSight(e);
        const order = this.s.enemies.filter(inReach).sort((a, b) => distance(p, a) - distance(p, b)).slice(0, f.shards);
        if (!order.length) { cast.done = true; return true; }
        for (let k = 0; k < f.shards; k++) { const a = k * Math.PI * 2 / f.shards + cast.orbitSeconds * 4; cast.flights.push({ id: order[k % order.length].id, at: cast.age + k * cast.shardGap, fromX: p.x + Math.cos(a) * cast.orbit, fromY: p.y + Math.sin(a) * cast.orbit * FLOOR_FLAT, done: false }); }
      }
      for (const fl of cast.flights) {
        if (fl.done || cast.age < fl.at + cast.flight) continue;
        fl.done = true;
        const body = this.lmBody(fl.id) || this.s.enemies.filter(e => reachable(this, e) && distance(p, e) <= (cast.shardReach || 7) + e.radius && this.lmInSight(e)).sort((a, b) => distance(p, a) - distance(p, b))[0] || null;
        // Each shard bursts where it lands (shardRadius, 2026-11-21), so a packed group takes more than six blows.
        if (body) { if (cast.shardRadius) hitIn(body, cast.shardRadius, f.shardDamage); else this.castHit(cast, body, f.shardDamage); this.effect('ring', body.x, body.y, '#bfe9f4', 0.3, Math.max(0.5, cast.shardRadius || 0), { look: 'frostShatter' }); }
      }
      if (cast.flights.length && cast.flights.every(fl => fl.done)) cast.done = true;
      return true;
    }
    // 전자 레일포: a charge in the coils, then a rod through everything on one line.
    if (cast.shape === 'rail') {
      cast.x = p.x; cast.y = p.y;
      if (!cast.fired && cast.age >= cast.charge) {
        cast.fired = true;
        const a = p.angle, { reach } = this.lineReach(p, a, cast.range), end = { x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach };
        for (const e of onLine(p, end, cast.halfWidth)) this.castHit(cast, e, f.damagePerHit);
        this.elementOnHazards(cast, h => segmentDistance(h, p, end) <= cast.halfWidth + 0.6);
        this.effect('lmRail', p.x, p.y, MAGNET, 0.45, 1, { targetX: end.x, targetY: end.y, width: cast.halfWidth * 2 });
        this.sense({ kind: 'fusionBurst' }); cast.done = true;
      }
      return true;
    }
    // 고철 회전톱: a saw flies, cutting what it passes; lodged in the first body it meets or a wall, it spins there.
    if (cast.shape === 'saw') {
      if (cast.lodgedAt === null) {
        const step = cast.speed * dt, before = { x: cast.x, y: cast.y };
        this.move(cast, Math.cos(cast.angle) * step, Math.sin(cast.angle) * step * FLOOR_FLAT, 0.2);
        const moved = distance(before, cast); cast.travel += moved;
        for (const e of onLine(before, cast, cast.flyHalfWidth)) if (!cast.crossed.includes(e.id)) { cast.crossed.push(e.id); this.castHit(cast, e, f.flyDamage); }
        // It lodges in the first body it cuts (2026-11-21; only a boss or elite before), never the one it has just left.
        const lodged = this.s.enemies.find(e => reachable(this, e) && e.id !== cast.leftId && floorDistance(cast, e) <= e.radius + 0.3);
        if (lodged) cast.heldId = lodged.id;
        if (lodged || cast.travel >= cast.range || moved < step * 0.4) { cast.lodgedAt = cast.age; cast.spinBase = cast.spins; }
      } else {
        const held = this.lmBody(cast.heldId);
        if (held) { cast.x = held.x; cast.y = held.y; }
        while (cast.spins < f.spinHits && cast.age + 1e-7 >= cast.lodgedAt + (cast.spins - cast.spinBase + 1) * cast.interval) { cast.spins++; hitIn(cast, cast.spinRadius, f.spinDamage); }
        // Half its spins done, it springs out once to the nearest other body within hopReach and spins out the rest there
        // (2026-11-21, so a crowd takes more than one spot); with no other body near it stays.
        if (!cast.hopped && cast.spins >= Math.ceil(f.spinHits / 2) && cast.spins < f.spinHits) {
          const next = this.s.enemies.filter(e => reachable(this, e) && e.id !== cast.heldId && floorDistance(cast, e) <= cast.hopReach + e.radius).sort((a, b) => distance(cast, a) - distance(cast, b))[0];
          if (next) {
            cast.hopped = true; cast.leftId = cast.heldId; cast.heldId = null; cast.lodgedAt = null; cast.travel = 0; cast.crossed = [];
            cast.range = distance(cast, next) + 1; cast.angle = Math.atan2((next.y - cast.y) / FLOOR_FLAT, next.x - cast.x);
          }
        }
        if (cast.spins >= f.spinHits) cast.done = true;
      }
      return true;
    }
    // 울리는 쇠줄: a string from where F2 cast to a big body (following it), a wall or its range, plucked five times.
    if (cast.shape === 'string') {
      const held = this.lmBody(cast.heldId);
      if (held) { cast.x = held.x; cast.y = held.y; }
      const a = { x: cast.fromX, y: cast.fromY };
      while (cast.pulse < f.hits && cast.age + 1e-7 >= cast.next) {
        for (const e of onLine(a, cast, cast.halfWidth)) this.castHit(cast, e, f.damagePerHit);
        this.elementOnHazards(cast, h => segmentDistance(h, a, cast) <= cast.halfWidth + 0.6);
        cast.pluckAt = t; cast.pulse++; cast.next += cast.interval;
      }
      if (cast.pulse >= f.hits && cast.age >= cast.next) cast.done = true;
      return true;
    }
    // 자성 유체 덩굴: black fluid creeps to one body and stabs up round it.
    if (cast.shape === 'vine') {
      const body = this.lmBody(cast.tid);
      if (body) { cast.x = body.x; cast.y = body.y; }
      if (cast.arrivedAt === null) {
        const dx = cast.x - cast.headX, dy = cast.y - cast.headY, d = Math.hypot(dx, dy), step = cast.speed * dt, before = { x: cast.headX, y: cast.headY };
        if (d <= step + (body?.radius || 0.2)) { cast.headX = cast.x; cast.headY = cast.y; cast.arrivedAt = cast.age; cast.next = cast.age + cast.delay; }
        else { cast.headX += dx / d * step; cast.headY += dy / d * step; }
        for (const e of onLine(before, { x: cast.headX, y: cast.headY }, cast.travelHalfWidth)) if (e !== body && !cast.crossed.includes(e.id)) { cast.crossed.push(e.id); this.castHit(cast, e, f.travelDamage); }
      } else {
        while (cast.pulse < f.stabs && cast.age + 1e-7 >= cast.next) { hitIn(cast, cast.stabRadius, f.stabDamage); cast.stabAt = t; cast.pulse++; cast.next += cast.interval; }
        if (cast.pulse >= f.stabs) cast.done = true;
      }
      return true;
    }
    // 북극광 고리: curtains of light come down from a ring over F2 on the body with the most health left.
    if (cast.shape === 'aurora') {
      cast.x = p.x; cast.y = p.y;
      while (cast.pulse < f.hits && cast.age + 1e-7 >= cast.next) {
        const pool = this.s.enemies.filter(e => reachable(this, e) && distance(p, e) <= cast.range + e.radius).sort((a, b) => b.hp - a.hp);
        if (pool.length) {
          let pick = pool[0];
          if (pool.length > 1 && pick.id === cast.lastId && cast.streak >= cast.sameMax) pick = pool[1];
          cast.streak = pick.id === cast.lastId ? cast.streak + 1 : 1; cast.lastId = pick.id;
          hitIn(pick, cast.fallRadius, f.damagePerHit); cast.curtains.push({ x: pick.x, y: pick.y, at: t });
        }
        cast.pulse++; cast.next += cast.interval;
      }
      cast.curtains = cast.curtains.filter(c => t - c.at < 0.5);
      if (cast.pulse >= f.hits && cast.age >= cast.next) cast.done = true;
      return true;
    }
    // 자석 회수: pellets flying back to F2 (no 쇳가루: their cast has no element).
    if (cast.shape === 'lmReturn') {
      if (cast.age < cast.wait) return true;
      let home = 0;
      for (const b of cast.pellets) {
        if (b.home) { home++; continue; }
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), step = 16 * dt, before = { x: b.x, y: b.y };
        if (d <= step + 0.3) { b.home = true; home++; continue; }
        b.x += dx / d * step; b.y += dy / d * step;
        for (const e of onLine(before, b, 0.25)) if (!b.hit.includes(e.id)) { b.hit.push(e.id); this.castHit(cast, e); }
      }
      if (home === cast.pellets.length || cast.age > cast.wait + 2) cast.done = true;
      return true;
    }
    return true;
  }
};
