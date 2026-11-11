import { fitsMap } from './map-geometry.js';
import { formationSpots, ARRIVAL_NOTES } from './encounters.js';
import { SOLID, hazardBox, sawAt, plateState, beltState, onBelt, pressState, laserState, steamState, steamAt } from './hazards.js';
import { distance, floorDistance, inCone, segmentDistance, FLOOR_FLAT } from './math.js';

/**
 * A fight room's course: waves arriving and waking, elite affixes, the room's crates, saws and plates, and the walk to
 * the portal once it is clear. Installed on Game.prototype (game.js), so `this` is the game.
 */
const PORTAL_REACH_UNITS = 1;
/** How long the pixelfx crate blast and music box mend sheets run (frames / 30 fps: art/fx/crate-blast-v1, mend-burst-v1). */
const CRATE_BLAST_SECONDS = 46 / 30, MEND_BURST_SECONDS = 42 / 30, PLATE_FLARE_SECONDS = 18 / 30;
/** How far past a hot plate's edge F2's feet still touch it. */
const PLATE_FEET_UNITS = 0.3;

export const roomWaves = {
  spawnWaveEnemy(type, spot, affixes) {
    // Waves name the elite slot 'elite'; a chapter may fill it with its own elite kind (chapters[].eliteType).
    const enemy = this.spawnEnemy(type === 'elite' && this.chapter?.eliteType ? this.chapter.eliteType : type, spot);
    if (type === 'elite') enemy.elite = true;
    // An elite-only room makes its elites tougher (encounters.js dealRoom: the room weighs 90% of an ordinary one).
    // Ordinary bodies spawn a little lighter (rules.waveHpShare, 2026-11-11), elites as they are.
    const { power } = this.room, toughen = type === 'elite' ? this.s.run?.plan?.[this.s.run.node]?.eliteHp || 1 : this.config.rules.waveHpShare ?? 1;
    enemy.hp = enemy.maxHp = Math.round(enemy.hp * power * toughen); enemy.damage = Math.max(1, Math.round(enemy.damage * power * this.config.rules.waveDamageShare));
    // Wave bodies wait where they stand until the player comes near; nothing rushes in from across the map.
    enemy.aggro = false;
    if (affixes?.length) this.giveAffixes(enemy, affixes);
    return enemy;
  },
  /** An elite's traits for this run (slice.json eliteAffixes): faster, a front shield, rats inside, an element it shrugs off, a bomb heart. */
  giveAffixes(enemy, affixes) {
    const rules = Object.fromEntries((this.config.eliteAffixes?.list || []).map(a => [a.id, a]));
    // An elite carries one trait (two on hard, difficulty eliteTraits), whatever an older save or a hand-made room asks for.
    enemy.affixes = affixes.filter(a => rules[a.id]).slice(0, this.difficulty.eliteTraits || 1).map(a => ({ ...a }));
    for (const affix of enemy.affixes) {
      const { id } = affix, rule = rules[id];
      // A coated elite shrugs off one of the elements F2 is carrying right now, so the trait always matters.
      if (id === 'coated') {
        const carried = (this.slots || []).map(s => s.element).filter(e => !rule.elements || rule.elements.includes(e));
        if (carried.length && !carried.includes(affix.element)) affix.element = carried[Math.floor(this.random() * carried.length)];
      }
      const { element } = affix;
      if (id === 'overwound') { enemy.speed *= rule.speed; enemy.recovery *= rule.recovery; }
      if (id === 'brassShield') Object.assign(enemy, { frontGuard: rule.frontGuard, guardArcDegrees: rule.guardArcDegrees, shieldHits: 0 });
      if (id === 'coated') enemy.immuneTo = this.c.elements.find(e => e.id === element)?.status;
      if (id === 'standardized') Object.assign(enemy, { standardRadius: rule.radius, standardFactor: rule.factor });
      if (id === 'reinspect') Object.assign(enemy, { reinspect: 'ready', reinspectShare: rule.share });
    }
  },
  /** What a trait-bearing elite leaves behind: rats spilling out, a blast a moment later, and a few extra coins. */
  affixDeath(enemy) {
    const rules = Object.fromEntries((this.config.eliteAffixes?.list || []).map(a => [a.id, a]));
    for (const { id } of enemy.affixes) {
      const rule = rules[id];
      if (id === 'splitter') for (let i = 0; i < rule.count; i++) {
        const angle = Math.PI * 2 * i / rule.count + this.random(), spot = { x: enemy.x + Math.cos(angle) * 0.8, y: enemy.y + Math.sin(angle) * 0.8 };
        const map = this.map, place = !map?.walkable || fitsMap(spot.x, spot.y, 0.3, map) ? spot : { x: enemy.x, y: enemy.y };
        const rat = this.spawnEnemy(rule.spawn, place);
        if (this.room?.power) { rat.hp = rat.maxHp = Math.round(rat.hp * this.room.power); rat.damage = Math.max(1, Math.round(rat.damage * this.room.power * this.config.rules.waveDamageShare)); }
        rat.ready = this.s.time + 0.6;
        this.effect('scrap', place.x, place.y, '#dbbc6b', 0.4, 0.6);
      }
      if (id === 'volatile') {
        (this.s.blasts ??= []).push({ x: enemy.x, y: enemy.y, at: this.s.time + rule.delay, radius: rule.radius, damage: rule.damage });
        this.effect('danger', enemy.x, enemy.y, '#d8423c', rule.delay, rule.radius);
      }
    }
    if (this.s.mode === 'combat' && this.s.run) this.giveLoot(0, (this.config.eliteAffixes?.bonusCoins || 0) * enemy.affixes.length);
  },
  /** Crates, plates, saws: their clocks run and they act on whoever is in reach. */
  tickHazards(dt = 0) {
    const rules = this.config.hazards, list = this.s.hazards;
    if (!rules || !list?.length) return;
    // After the fight (the reward, the walk to the portal) only crates still act: a lit one goes off, harmless to F2.
    if (this.s.mode !== 'combat') { if (['reward', 'route'].includes(this.s.mode)) for (const h of list) if (h.kind === 'crate' && !h.gone && h.fuseAt !== undefined && this.s.time >= h.fuseAt) this.blowCrate(h); return; }
    const { p } = this, t = this.s.time, playerR = this.config.arena.playerRadius;
    // A push from a device (a press, a steam burst) carries F2 out over a quarter of a second instead of in one jump.
    if (p.blown && dt > 0) { const share = Math.min(1, dt / p.blown.left); this.move(p, p.blown.x * share, p.blown.y * share); p.blown.x -= p.blown.x * share; p.blown.y -= p.blown.y * share; p.blown.left -= dt; if (p.blown.left <= 0) p.blown = null; }
    const blowAway = (body, from, units) => {
      const dx = body.x - from.x, dy = body.y - from.y, d = Math.hypot(dx, dy) || 1, ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
      if (body === p) p.blown = { x: ux * units, y: uy * units, left: 0.25 };
      else if (!body.boss) body.shove = { x: ux * units, y: uy * units, elapsed: 0 };
    };
    const strikeCrates = (at, reach) => { for (const o of list) if (o.kind === 'crate' && !o.gone && Math.abs(o.x - at.x) <= reach.w && Math.abs(o.y - at.y) <= reach.h) this.lightCrate(o, 0.05); };
    for (const h of list) {
      if (h.gone) continue;
      if (h.kind === 'musicbox') this.pickUpMusicBoxes();
      if (h.kind === 'crate' && h.fuseAt !== undefined && t >= h.fuseAt) this.blowCrate(h);
      // A belt carries whoever stands on it along its length: F2 (not mid-dodge) and every enemy but a boss.
      if (h.kind === 'belt' && rules.belt && dt > 0) {
        const { way, speed } = beltState(h, t, rules.belt), across = h.w >= h.h, step = way * speed * dt;
        if (step) {
          const carry = body => this.move(body, across ? step : 0, across ? 0 : step);
          if (!p.dodge && onBelt(h, p.x, p.y)) carry(p);
          for (const e of this.s.enemies) if (e.hp > 0 && !e.boss && !e.dummy && !(e.summonUntil > t) && onBelt(h, e.x, e.y)) carry(e);
        }
      }
      // A press slams once a cycle: everyone on its plate is hurt and thrown off it, crates on it go off.
      if (h.kind === 'press' && rules.press) {
        const r = rules.press, { state, n } = pressState(h, t, r);
        if (state === 'slam' && h.slamN !== n) {
          h.slamN = n;
          const on = (b, reach = 0) => Math.abs(b.x - h.x) <= h.w / 2 + reach && Math.abs(b.y - h.y) <= h.h / 2 + reach;
          if (!p.dodge && on(p, playerR * 0.5)) { this.hurt(r.damage); blowAway(p, h, r.shove); }
          for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && !(e.summonUntil > t) && on(e, e.radius * 0.5)) { this.hitEnemy(e, r.enemyDamage, { dot: true, color: '#ffd257' }); blowAway(e, h, r.shove); }
          strikeCrates(h, { w: h.w / 2 + 0.4, h: h.h / 2 + 0.4 });
          this.effect('ring', h.x, h.y, '#e8e2d2', 0.45, h.w * 0.75, { look: 'quake' }); this.sense({ kind: 'burst' });
        }
      }
      // A laser door's beam: F2 every tick, each enemy once a beam (and it stops for a moment).
      if (h.kind === 'laser' && rules.laser) {
        const r = rules.laser, { state, n } = laserState(h, t, r);
        if (state === 'on') {
          const onBeam = (b, reach) => Math.abs(b.x - h.x) <= h.half && Math.abs(b.y - h.y) <= 0.25 + reach;
          if (!p.dodge && onBeam(p, playerR * 0.5) && t >= (p.laserNext || 0) && this.hurt(r.damage)) { p.laserNext = t + r.tick; this.effect('spark', p.x, p.y - 0.3, '#ff5a6e', 0.25, 0.8); }
          for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && !e.hidden && !(e.summonUntil > t) && e.laserHit !== `${h.id}:${n}` && onBeam(e, e.radius * 0.5)) {
            e.laserHit = `${h.id}:${n}`; this.hitEnemy(e, r.enemyDamage, { dot: true, color: '#ff5a6e' });
            if (!e.boss) e.stunUntil = Math.max(e.stunUntil || 0, t + r.stopSeconds);
          }
        }
      }
      // A steam burst: F2 every tick, each enemy once a burst, and both pushed out of the cloud.
      if (h.kind === 'steam' && rules.steam) {
        const r = rules.steam, { state, n } = steamState(h, t, r);
        if (state === 'burst') {
          const at = steamAt(h, t), key = `${h.id}:${n}`, power = h.hotUntil > t ? r.fireBoost : 1;
          const inside = (b, reach) => floorDistance(at, b) < r.radius + reach;
          if (!p.dodge && inside(p, playerR * 0.5) && t >= (p.steamNext || 0) && this.hurt(Math.round(r.damage * power))) { p.steamNext = t + r.tick; if (p.steamHit !== key) { p.steamHit = key; blowAway(p, at, r.push); } }
          for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && !e.hidden && !(e.summonUntil > t) && e.steamHit !== key && inside(e, e.radius * 0.5)) { e.steamHit = key; this.hitEnemy(e, Math.round(r.enemyDamage * power), { dot: true, color: '#f1efe8' }); blowAway(e, at, r.push); }
          for (const c of this.s.casts) if (c.shape === 'floorMark' && c.look === 'oil' && !c.done && !(c.burningUntil > t) && floorDistance(c, at) < c.radius + r.radius) this.igniteOil(c);
        }
      }
      // A crane marks a ring near F2, then drops a parts crate into it that stays a while as something solid.
      if (h.kind === 'crane' && rules.crane) {
        const r = rules.crane;
        h.next ??= t + r.every * (0.4 + h.offset * 0.6);
        if (!h.mark && t >= h.next) {
          const angle = this.random() * Math.PI * 2, d = this.random() * r.near, x = p.x + Math.cos(angle) * d, y = p.y + Math.sin(angle) * d * FLOOR_FLAT;
          const fits = (!this.map?.walkable || fitsMap(x, y, 0.5, this.map)) && !this.inSolid(x, y, 0.5);
          h.mark = { x: fits ? x : p.x, y: fits ? y : p.y, at: t + r.mark, from: t };
          this.sense({ kind: 'alarm' });
        }
        if (h.mark && t >= h.mark.at) {
          const at = h.mark; h.mark = null; h.next = t + r.every - r.mark;
          if (!p.dodge && floorDistance(at, p) < r.radius + playerR * 0.5) this.hurt(r.damage);
          for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && !e.hidden && !(e.summonUntil > t) && floorDistance(at, e) < r.radius + e.radius * 0.5) this.hitEnemy(e, r.enemyDamage, { dot: true, color: '#e0b048' });
          strikeCrates(at, { w: r.radius, h: r.radius });
          this.s.hazards.push({ id: `hz-drop-${Math.round(t * 1000)}-${h.id}`, kind: 'dropbox', x: +at.x.toFixed(2), y: +at.y.toFixed(2), size: r.box, hp: r.boxHp, until: t + r.boxSeconds, landed: t });
          this.effect('ring', at.x, at.y, '#e8e2d2', 0.5, r.radius + 0.4, { look: 'quake' }); this.sense({ kind: 'burst' });
        }
      }
      // A dropped crate lies in the way for a while.
      if (h.kind === 'dropbox' && t >= h.until) { h.gone = true; this.effect('scrap', h.x, h.y, '#c79a3e', 0.4, 0.8); }
      if (h.kind === 'plate' && !(h.cooledUntil > t) && plateState(h, t, rules.plate) === 'hot') {
        const depth = h.depth ?? rules.plate.depth, inside = (body, reach = 0) => Math.abs(body.x - h.x) / (h.half + reach) + Math.abs(body.y - h.y) / (depth + reach * FLOOR_FLAT) <= 1;
        // F2 burns once her feet are on the grate, not only her centre (2026-11-06: standing on its edge did nothing), and
        // a burn blocked by a moment of invulnerability is tried again next step instead of waiting a whole tick.
        if (inside(p, PLATE_FEET_UNITS) && !p.dodge && t >= (p.plateNext || 0) && this.hurt(rules.plate.damage)) {
          p.plateNext = t + rules.plate.tick;
          // A small flare at her feet (art/fx/plate-flare), following her.
          this.effect('spark', p.x, p.y, '#ff7a2c', PLATE_FLARE_SECONDS, 1, { look: 'plateFlare', follow: true });
        }
        h.cast ??= { id: `plate-${h.id}`, staggerUsed: {}, fusion: false, statusAt: {} };
        for (const e of this.s.enemies) if (e.hp > 0 && !e.boss && inside(e)) this.applyStatus(e, 'fire', h.cast);
      }
      if (h.kind === 'rail' && h.chargedUntil > t && t >= (h.chargeNext || 0)) {
        const ends = [{ x: h.x - h.dx, y: h.y - h.dy }, { x: h.x + h.dx, y: h.y + h.dy }], e2 = rules.elements;
        h.chargeNext = t + e2.chargeTick; h.chargeCast ??= { id: `rail-${h.id}`, staggerUsed: {}, fusion: false, statusAt: {} };
        for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && segmentDistance(e, ends[0], ends[1]) <= e2.chargeReach + e.radius) { this.hitEnemy(e, e2.chargeDamage, { dot: true, color: '#ffe086' }); this.applyStatus(e, 'lightning', h.chargeCast); this.effect('spark', e.x, e.y - 0.5, '#ffe086', 0.3, 0.7, { look: 'zap' }); }
      }
      if (h.kind === 'rail') {
        const saw = sawAt(h, t, rules.rail.speed);
        if (!p.dodge && distance(saw, p) < rules.rail.radius + playerR) this.hurt(rules.rail.damage);
        // The saw is the town's trap for F2: enemies step over its groove unharmed (a charged rail still shocks them).
      }
    }
    if (list.some(h => h.gone)) this.s.hazards = list.filter(h => !h.gone);
  },
  /** Light a crate's fuse (a blow, a shot, a blast); it goes off a moment later. */
  lightCrate(h, fuse = this.config.hazards.crate.fuse) {
    if (h.kind !== 'crate' || h.gone || h.fuseAt !== undefined) return;
    h.fuseAt = this.s.time + fuse; this.effect('danger', h.x, h.y, '#d8423c', fuse, this.config.hazards.crate.radius);
  },
  blowCrate(h) {
    const rule = this.config.hazards.crate; h.gone = true;
    // The pixelfx crate blast (art/fx/crate-blast-v1.png) brings its own wood splinters, so no separate scrap.
    this.effect('ring', h.x, h.y, '#e8914e', CRATE_BLAST_SECONDS, rule.radius, { look: 'crateBlast' }); this.sense({ kind: 'burst' });
    if (this.s.mode === 'combat' && !this.p.dodge && floorDistance(h, this.p) < rule.radius + this.config.arena.playerRadius) this.hurt(rule.damage);
    for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && floorDistance(h, e) < rule.radius + e.radius) {
      this.hitEnemy(e, rule.enemyDamage, { dot: true, color: '#e8914e' });
      const stun = e.boss && !e.breaking && this.config.bossAI[e.type]?.crateStunSeconds;
      if (stun && e.hp > 0) { e.tell = null; e.exposedUntil = Math.max(e.exposedUntil, this.s.time + stun); e.ready = Math.max(e.ready, e.exposedUntil + 0.4); this.notify('로코가 폭발에 휘청거립니다! 지금 공격하세요.'); }
    }
    for (const other of this.s.hazards) if (other !== h && distance(h, other) < rule.radius) this.lightCrate(other, rule.chain);
  },
  /** A wrench swing: crates get lit. */
  strikeHazards(angle, range, arc) {
    const t0 = this.s.time;
    for (const h of this.s.hazards || []) {
      if (h.gone || !inCone(this.p, h, angle, range + 0.4, arc)) continue;
      if (h.kind === 'crate') this.lightCrate(h);
      // A dropped parts crate breaks after a few blows.
      if (h.kind === 'dropbox' && t0 >= (h.struckAt || 0)) { h.struckAt = t0 + 0.15; h.hp--; this.effect('spark', h.x, h.y - 0.4, '#e0b048', 0.25, 0.7); if (h.hp <= 0) { h.gone = true; this.effect('scrap', h.x, h.y, '#c79a3e', 0.5, 1); } }
    }
  },
  /**
   * The mending music box is picked up by walking onto it, like a health pickup: it plays its tune, mends F2 and is gone.
   * At full health it waits on the floor for later.
   */
  pickUpMusicBoxes() {
    const p = this.p;
    for (const h of this.s.hazards || []) {
      if (h.kind !== 'musicbox' || h.gone || h.used || p.hp >= p.maxHp || distance(p, h) > h.size * 0.6 + this.config.arena.playerRadius) continue;
      h.used = true; h.gone = true; this.heal(p.maxHp * this.config.hazards.musicbox.heal);
      // The pixelfx collect burst in mint (art/fx/mend-burst-v1.png), on F2 as she walks on.
      this.effect('spark', p.x, p.y, '#8fd8b0', MEND_BURST_SECONDS, 1, { look: 'mend', follow: true });
      this.sense({ kind: 'mend' });
    }
  },
  /** A shot stopped by something solid: a fence takes the blow, a crate caught by the player's shot is lit. */
  shotStopped(b) {
    const near = h => { const o = hazardBox(h), r = b.radius + 0.25; return b.x + r > o.x && b.x - r < o.x + o.w && b.y + r > o.y && b.y - r < o.y + o.h; };
    const hit = (this.s.hazards || []).find(h => SOLID.has(h.kind) && !h.gone && near(h));
    if (!hit) return;
    if (hit.kind === 'fence' && --hit.hp <= 0) { hit.gone = true; this.effect('scrap', hit.x, hit.y, '#a07a4a', 0.6, 1); }
    else if (hit.kind === 'fence') this.effect('spark', b.x, b.y, '#d8c7a0', 0.2, 0.5);
    if (hit.kind === 'crate' && b.friendly) this.lightCrate(hit);
  },
  /** A bomb heart goes off where its elite fell, hurting the player and anyone else standing in it. */
  tickBlasts() {
    if (!this.s.blasts?.length) return;
    this.s.blasts = this.s.blasts.filter(blast => {
      if (blast.at > this.s.time) return true;
      this.effect('ring', blast.x, blast.y, '#e8914e', 0.6, blast.radius, { look: 'boom' }); this.sense({ kind: 'burst' });
      if (!this.p.dodge && floorDistance(blast, this.p) < blast.radius + this.config.arena.playerRadius) this.hurt(blast.damage);
      // A volatile elite's blast hurts only F2 (a flat amount in every room); the other mobs stand in it unharmed.
      for (const h of this.s.hazards || []) if (distance(blast, h) < blast.radius) this.lightCrate(h, this.config.hazards.crate.chain);
      return false;
    });
  },
  /** Anywhere on the floor, well away from the player and from bodies already placed, so a room fills evenly. */
  spreadSpot(extra = []) {
    const { spreadMinUnits, spreadGapUnits } = this.config.rules, map = this.map, { arena } = this.config, radius = 0.6;
    const [width, height] = map?.size || [arena.width, arena.height], taken = [...this.s.enemies.filter(e => e.hp > 0), ...(this.s.run?.arrivals || []), ...extra], flow = this.flowField;
    flow?.update(this.p.x, this.p.y);
    // A big wave on a small floor may not find room at the full gap: it then stands closer rather than off the floor.
    for (const gap of [spreadGapUnits, spreadGapUnits * 0.6, 1]) for (let tries = 0; tries < 80; tries++) {
      const spot = { x: this.random() * width, y: this.random() * height };
      const floor = map?.walkable ? fitsMap(spot.x, spot.y, radius, map) : spot.x > arena.bounds.left && spot.x < arena.bounds.right && spot.y > arena.bounds.top && spot.y < arena.bounds.bottom;
      if (floor && !this.inSolid(spot.x, spot.y, radius) && (!flow || flow.reachable(spot.x, spot.y)) && distance(spot, this.p) >= spreadMinUnits && taken.every(other => distance(spot, other) >= gap)) return spot;
    }
    return this.arrivalSpot();
  },
  /** Spots for a wave standing in `kind` of formation (spread, camps, flank, pincer, ring); see encounters.js. */
  formation(kind = 'spread', types) {
    const map = this.map, { arena } = this.config, flow = this.flowField, radius = 0.6;
    flow?.update(this.p.x, this.p.y);
    const fits = (x, y) => (map?.walkable ? fitsMap(x, y, radius, map) && (!flow || flow.reachable(x, y)) : x > arena.bounds.left && x < arena.bounds.right && y > arena.bounds.top && y < arena.bounds.bottom)
      && distance({ x, y }, this.p) >= 4 && !this.inSolid(x, y, radius);
    return formationSpots(kind, types, { fits, player: this.p, size: map?.size || [arena.width, arena.height], random: () => this.random(), spread: taken => this.spreadSpot(taken) });
  },
  /** A waiting body notices the player, and so do the ones standing beside it. */
  rouse(enemy) {
    const { aggroLinkUnits, } = this.config.rules, woken = [enemy];
    // noticedAt: when it saw F2, for the '!' over its head.
    enemy.aggro = true; enemy.noticedAt = this.s.time; enemy.ready = Math.max(enemy.ready, this.s.time + this.config.rules.enemyInitialDelay);
    while (woken.length) {
      const from = woken.pop();
      for (const other of this.s.enemies) if (!other.aggro && other.hp > 0 && distance(from, other) <= aggroLinkUnits) { other.aggro = true; other.noticedAt = this.s.time; other.ready = Math.max(other.ready, this.s.time + this.config.rules.enemyInitialDelay); woken.push(other); }
    }
  },
  /** Somewhere on the floor, off the player's feet but close enough to arrive soon. */
  arrivalSpot() {
    const { waveMinUnits: near, waveMaxUnits: far } = this.config.rules, map = this.map, { p } = this, radius = 0.6, { arena } = this.config;
    for (let tries = 0; tries < 40; tries++) {
      const angle = this.random() * Math.PI * 2, reach = near + this.random() * (far - near), spot = { x: p.x + Math.cos(angle) * reach, y: p.y + Math.sin(angle) * reach };
      if (map ? fitsMap(spot.x, spot.y, radius, map) : spot.x > arena.bounds.left && spot.x < arena.bounds.right && spot.y > arena.bounds.top && spot.y < arena.bounds.bottom) return spot;
    }
    return map?.enemySpawns.reduce((best, spot) => distance(spot, p) > distance(best, p) ? spot : best) || { ...arena.spawn };
  },
  /** Each wave is marked on the floor first, so nobody appears on top of the player unannounced. */
  callWave() {
    const { run } = this.s, { waveWarnSeconds } = this.config.rules;
    run.wave++;
    const types = this.room.waves[run.wave], kind = run.plan?.[run.node]?.formations?.[run.wave], spots = this.formation(kind, types);
    // The warning names the shape the bodies really stand in (a ring that did not fit round the player is a pincer).
    const shape = spots.kind || kind;
    if (ARRIVAL_NOTES[shape]) this.notify(ARRIVAL_NOTES[shape]);
    for (const [i, type] of types.entries()) {
      const spot = spots[i];
      run.arrivals.push({ type, x: spot.x, y: spot.y, at: this.s.time + waveWarnSeconds, affixes: run.plan?.[run.node]?.affixes?.[run.wave]?.[i] || null });
      this.effect('friendlyTell', spot.x, spot.y, '#e0a03c', waveWarnSeconds, 0.7, { mark: 'spawn' });
    }
  },
  tickWaves() {
    const { run } = this.s;
    if (this.s.mode !== 'combat' || !this.room?.waves) return;
    const waiting = run.arrivals.length;
    run.arrivals = run.arrivals.filter(({ type, x, y, at, affixes }) => { if (at > this.s.time) return true; this.spawnWaveEnemy(type, { x, y }, affixes).summonedAt = at; return false; });
    if (run.arrivals.length < waiting) this.sense({ kind: 'summon' });
    const living = this.s.enemies.filter(e => e.hp > 0).length;
    if (!run.arrivals.length && run.wave < this.room.waves.length - 1 && living <= (run.plan?.[run.node]?.callAt ?? this.config.rules.waveCallsAtLiving)) this.callWave();
  },
  /** The portal only takes someone walking into it, so a player already standing there is not whisked away. */
  walkToPortal(dt, input) {
    // The clock keeps running on the way out, so a spark or a mending burst (a music box picked up here) plays out and
    // goes: with the clock stopped it hung on F2, stuck on its first frame, until the next room.
    this.s.time += Math.min(dt, 1 / 30);
    this.s.effects = this.s.effects.filter(e => e.until > this.s.time);
    this.s.notices = this.s.notices.filter(e => e.until > this.s.time);
    this.stepFeet(dt, input, this.config.arena.playerRadius, true);
    // A music box left in the cleared room can still be picked up on the way out, and a crate lit then (the wrench still
    // swings here) goes off, harmless to F2 (2026-11-11: its fuse burned forever).
    this.pickUpMusicBoxes(); this.tickHazards(dt);
    const near = distance(this.p, this.portal) <= PORTAL_REACH_UNITS, run = this.s.run;
    if (!near) run.portalArmed = true;
    else if (run.portalArmed) { run.portalArmed = false; this.nextNode(0); }
  },
};
