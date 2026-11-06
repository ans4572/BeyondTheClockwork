import { fitsMap } from './map-geometry.js';
import { formationSpots, ARRIVAL_NOTES } from './encounters.js';
import { SOLID, hazardBox, sawAt, plateState } from './hazards.js';
import { distance, inCone, segmentDistance } from './math.js';

/**
 * A fight room's course: waves arriving and waking, elite affixes, the room's crates, saws and plates, and the walk to
 * the portal once it is clear. Installed on Game.prototype (game.js), so `this` is the game.
 */
const PORTAL_REACH_UNITS = 1;

export const roomWaves = {
  spawnWaveEnemy(type, spot, affixes) {
    const enemy = this.spawnEnemy(type, spot);
    const { power } = this.room;
    enemy.hp = enemy.maxHp = Math.round(enemy.hp * power); enemy.damage = Math.max(1, Math.round(enemy.damage * power * this.config.rules.waveDamageShare));
    // Wave bodies wait where they stand until the player comes near; nothing rushes in from across the map.
    enemy.aggro = false;
    if (affixes?.length) this.giveAffixes(enemy, affixes);
    return enemy;
  },
  /** An elite's traits for this run (slice.json eliteAffixes): faster, a front shield, rats inside, an element it shrugs off, a bomb heart. */
  giveAffixes(enemy, affixes) {
    const rules = Object.fromEntries((this.config.eliteAffixes?.list || []).map(a => [a.id, a]));
    // An elite never carries more than one trait, whatever an older save or a hand-made room asks for.
    enemy.affixes = affixes.filter(a => rules[a.id]).slice(0, 1).map(a => ({ ...a }));
    for (const { id, element } of enemy.affixes) {
      const rule = rules[id];
      if (id === 'overwound') { enemy.speed *= rule.speed; enemy.recovery *= rule.recovery; }
      if (id === 'brassShield') Object.assign(enemy, { frontGuard: rule.frontGuard, guardArcDegrees: rule.guardArcDegrees, shieldHits: 0 });
      if (id === 'coated') enemy.immuneTo = this.c.elements.find(e => e.id === element)?.status;
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
  tickHazards() {
    const rules = this.config.hazards, list = this.s.hazards;
    if (!rules || !list?.length || this.s.mode !== 'combat') return;
    const { p } = this, t = this.s.time, playerR = this.config.arena.playerRadius;
    for (const h of list) {
      if (h.gone) continue;
      if (h.kind === 'crate' && h.fuseAt !== undefined && t >= h.fuseAt) this.blowCrate(h);
      if (h.kind === 'plate' && !(h.cooledUntil > t) && plateState(h, t, rules.plate) === 'hot') {
        const depth = h.depth ?? rules.plate.depth, inside = body => Math.abs(body.x - h.x) / h.half + Math.abs(body.y - h.y) / depth <= 1;
        if (inside(p) && !p.dodge && t >= (p.plateNext || 0)) { p.plateNext = t + rules.plate.tick; this.hurt(rules.plate.damage); }
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
    this.effect('ring', h.x, h.y, '#e8914e', 0.6, rule.radius, { look: 'boom' }); this.effect('scrap', h.x, h.y, '#b0783e', 0.6, 1); this.sense({ kind: 'burst' });
    if (!this.p.dodge && distance(h, this.p) < rule.radius + this.config.arena.playerRadius) this.hurt(rule.damage);
    for (const e of this.s.enemies) if (e.hp > 0 && !e.dummy && distance(h, e) < rule.radius + e.radius) {
      this.hitEnemy(e, rule.enemyDamage, { dot: true, color: '#e8914e' });
      const stun = e.boss && !e.breaking && this.config.bossAI[e.type]?.crateStunSeconds;
      if (stun && e.hp > 0) { e.tell = null; e.exposedUntil = Math.max(e.exposedUntil, this.s.time + stun); e.ready = Math.max(e.ready, e.exposedUntil + 0.4); this.notify('로코가 폭발에 휘청거립니다! 지금 공격하세요.'); }
    }
    for (const other of this.s.hazards) if (other !== h && distance(h, other) < rule.radius) this.lightCrate(other, rule.chain);
  },
  /** A wrench swing: crates get lit, a music box plays its mending tune once. */
  strikeHazards(angle, range, arc) {
    for (const h of this.s.hazards || []) {
      if (h.gone || !inCone(this.p, h, angle, range + 0.4, arc)) continue;
      if (h.kind === 'crate') this.lightCrate(h);
      if (h.kind === 'musicbox' && !h.used) {
        h.used = true; this.heal(this.p.maxHp * this.config.hazards.musicbox.heal);
        this.effect('ring', h.x, h.y, '#8fd8b0', 0.8, 1.6, { look: 'notes' }); this.effect('spark', this.p.x, this.p.y, '#8fd8b0', 0.6, 1, { look: 'ready', follow: true });
      }
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
      if (!this.p.dodge && distance(blast, this.p) < blast.radius + this.config.arena.playerRadius) this.hurt(blast.damage);
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
    if (ARRIVAL_NOTES[kind]) this.notify(ARRIVAL_NOTES[kind]);
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
    run.arrivals = run.arrivals.filter(({ type, x, y, at, affixes }) => { if (at > this.s.time) return true; this.spawnWaveEnemy(type, { x, y }, affixes); return false; });
    if (run.arrivals.length < waiting) this.sense({ kind: 'summon' });
    const living = this.s.enemies.filter(e => e.hp > 0).length;
    if (!run.arrivals.length && run.wave < this.room.waves.length - 1 && living <= (run.plan?.[run.node]?.callAt ?? this.config.rules.waveCallsAtLiving)) this.callWave();
  },
  /** The portal only takes someone walking into it, so a player already standing there is not whisked away. */
  walkToPortal(dt, input) {
    this.stepFeet(dt, input, this.config.arena.playerRadius, true);
    const near = distance(this.p, this.portal) <= PORTAL_REACH_UNITS, run = this.s.run;
    if (!near) run.portalArmed = true;
    else if (run.portalArmed) { run.portalArmed = false; this.nextNode(0); }
  },
};
