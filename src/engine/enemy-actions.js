import { fitsMap } from './map-geometry.js';
import { distance, floorDistance, inCone, segmentDistance } from './math.js';

/**
 * What enemies and bosses do once awake: warning a blow (beginEnemyTell), carrying it out (executeEnemy), the bosses'
 * patterns and phase breaks, their floor hazards, and the shots in the air. Installed on Game.prototype (game.js), so
 * `this` is the game.
 */
const TAU_ENEMY = Math.PI * 2, RANGED_ATTACKS = ['shot', 'spiral', 'beat'];
const KNOCKBACK_SECONDS = 0.12, DIRECT_UNITS = 2, BELL_DRIFT_UNITS = 0.2, CARPET_REACH_SHARE = 0.7;
/** How far a parade rank reaches past the outer carpets on each side, so it cannot be walked round. */
const RANK_OVERHANG_UNITS = 1.5;

export const enemyActions = {
  beginEnemyTell(enemy, type, delay = null) {
    const tellTime = delay ?? (enemy.tellSeconds?.[type] || enemy.minimumTell || enemy.tellDuration || this.config.enemies[enemy.type]?.tell || 0.7);
    const angle = Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x);
    enemy.facing = angle;
    enemy.tell = { type, x: enemy.x, y: enemy.y, targetX: this.p.x, targetY: this.p.y, angle, started: this.s.time, until: this.s.time + tellTime };
    if (type === 'crane') enemy.tell.drops = this.craneDrops(enemy);
    if (type === 'carpet') enemy.tell.safe = this.safeCarpet(enemy, tellTime);
    if (type === 'crateToss') enemy.tell.drops = this.craneDrops(enemy).slice(0, this.bossRepeat(enemy, 'crateTossCount'));
    // Both soldier patterns show where their ranks will come from, and which way they will walk.
    if (type === 'parade' || type === 'column') enemy.tell.path = this.rankPath(type);
    enemy.state = 'tell';
  },
  /** A boss with phase breaks stops at each threshold, raises a shield and has to be broken out of it before losing more. */
  checkPhaseBreak(enemy) {
    const rules = enemy.boss && this.config.bossAI[enemy.type]?.phaseBreaks;
    if (!rules || enemy.breaking) return;
    enemy.breaksDone ??= [];
    const index = rules.findIndex((rule, i) => !enemy.breaksDone.includes(i) && enemy.hp <= enemy.maxHp * rule.at);
    if (index < 0) return;
    const rule = this.breakRule(enemy, index), now = this.s.time;
    enemy.hp = Math.max(enemy.hp, enemy.maxHp * rule.at); enemy.tell = null; enemy.noteVolleys = null; enemy.spin = null; enemy.dash = null; enemy.followup = null; enemy.alarmUntil = 0; enemy.bellUntil = 0;
    this.s.casts = this.s.casts.filter(c => c.owner !== enemy.id);
    const angle = Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x);
    enemy.facing = angle;
    // Brass's breaks fill the square, so he marches back to where he first stood before laying them out.
    if (rule.kind !== 'cans' && enemy.home) Object.assign(enemy, enemy.home);
    const b = enemy.breaking = { index, kind: rule.kind, started: now, until: now + rule.seconds, angle, failAt: null };
    this.sense({ kind: 'phase' });
    if (rule.kind === 'cans') { Object.assign(b, { fed: 0, nextCan: now + 0.6, cans: [], home: { x: enemy.x, y: enemy.y } }); this.notify('보호막! 은색 깡통만 렌치로 쳐서 움직이는 로코 입에 넣으세요. 불꽃 튀는 폭탄 깡통은 피하세요.'); }
    if (rule.kind === 'drums') {
      // Drums round the boss (three to five by difficulty); they light in an order to copy, while a march lane keeps coming
      // down on the player.
      const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1.3]].slice(0, rule.drums).map(([sx, sy]) => this.floorSpot(enemy, sx * rule.spreadX, sy * rule.spreadY));
      const order = spots.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      Object.assign(b, { drums: spots.map(s => ({ ...s, flash: 0, done: false })), order, phase: 'show', step: 0, stepAt: now + 0.6, next: 0, lanes: [], nextLane: now + 2 });
      this.notify('보호막! 북이 빛나는 순서를 기억했다가 같은 순서로 두드리세요.');
    }
    if (rule.kind === 'flags') {
      // A ring of soldiers marches round the boss; three carry flags, and knocking those three down breaks the shield.
      const flags = new Set(); while (flags.size < rule.flags) flags.add(Math.floor(this.random() * rule.soldiers));
      Object.assign(b, { turn: 0, soldiers: Array.from({ length: rule.soldiers }, (_, i) => ({ slot: i, flag: flags.has(i), down: false, x: enemy.x, y: enemy.y })) });
      this.placeSoldiers(enemy, rule);
      this.notify(`보호막! 깃발을 든 병정 ${rule.flags}기를 쓰러뜨리세요.`);
    }
  },
  /** A spot near the boss that lies on the floor, pulled toward the boss until it does. */
  floorSpot(enemy, dx, dy) {
    const map = this.map, { bounds } = this.config.arena;
    for (let k = 1; k > 0.2; k -= 0.1) {
      const spot = { x: enemy.x + dx * k, y: enemy.y + dy * k };
      if (map ? fitsMap(spot.x, spot.y, 0.6, map) : spot.x > bounds.left + 1 && spot.x < bounds.right - 1 && spot.y > bounds.top + 1 && spot.y < bounds.bottom - 1) return spot;
    }
    return { x: enemy.x + dx * 0.2, y: enemy.y + dy * 0.2 };
  },
  placeSoldiers(enemy, rule) {
    const b = enemy.breaking;
    for (const s of b.soldiers) { const a = b.turn + s.slot / rule.soldiers * Math.PI * 2; s.x = enemy.x + Math.cos(a) * rule.rx; s.y = enemy.y + Math.sin(a) * rule.ry; }
  },
  /** Each frame of a break: its own mechanics, then success, or the burst and heal when time runs out. */
  updatePhaseBreak(enemy, dt) {
    const rule = this.breakRule(enemy, enemy.breaking.index), b = enemy.breaking, p = this.p, now = this.s.time;
    if (b.failAt !== null) {
      // Out of time: a burst from the whole body, then the shield drops, the boss patches itself and the break waits again.
      if (now < b.failAt) return;
      if (this.hurt(rule.failDamage)) this.effect('ring', enemy.x, enemy.y, '#a92f2b', 0.7, 9, { look: 'quake' });
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * rule.failHeal);
      enemy.breaking = null; enemy.ready = now + enemy.recovery;
      this.notify(`${enemy.name}이(가) 몸을 고쳤습니다. 다시 깎아서 보호막을 깨세요.`); return;
    }
    if (b.kind === 'cans') { this.updateCans(enemy, rule, dt); if (!this.active) return; }
    if (b.kind === 'drums') { this.updateDrums(enemy, rule); if (!this.active) return; }
    if (b.kind === 'flags') {
      b.turn += rule.turn * dt; this.placeSoldiers(enemy, rule);
      if (b.soldiers.some(s => !s.down && distance(s, p) < rule.soldierRadius + this.config.arena.playerRadius)) { this.hurt(rule.soldierDamage); if (!this.active) return; }
    }
    const solved = b.kind === 'cans' ? b.fed >= rule.cans : b.kind === 'drums' ? b.next >= b.order.length : b.soldiers.filter(s => s.flag && s.down).length >= rule.flags;
    if (solved) {
      // The shield breaks and the next phase begins at once: the boss is not stunned any more (2026-11-06), only open to
      // harder blows for a moment (vulnerable).
      enemy.breaking = null; enemy.breaksDone.push(b.index);
      enemy.vulnerableUntil = now + rule.stunSeconds; enemy.vulnerableBonus = rule.vulnerable; enemy.ready = Math.max(enemy.ready, now + enemy.recovery);
      this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.8, 3, { look: 'shieldBreak' }); this.notify(`보호막이 깨졌습니다! 잠시 ${enemy.name}이(가) 더 큰 피해를 받습니다.`); return;
    }
    if (now >= b.until) { b.failAt = now + rule.failWarn; b.cans = []; b.lanes = []; }
  },
  /** Roco: a wide suction draws in tin cans; three batted back into its mouth overload the shield. */
  /**
   * Roco's break: cans fly in from the edge of his cone. A plain can batted back flies straight from where it was hit,
   * so with his mouth sliding side to side the swing has to be timed; a bomb can (sparking fuse) batted back fills the
   * shield again by one can, and one left alone blows up on whoever it reaches.
   */
  updateCans(enemy, rule, dt) {
    const b = enemy.breaking, p = this.p, now = this.s.time;
    if (rule.sway && b.home) { const want = b.home.x + Math.sin((now - b.started) / rule.swaySeconds * Math.PI * 2) * rule.sway; this.move(enemy, want - enemy.x, 0); }
    if (!p.dodge && distance(p, enemy) > enemy.radius + 1 && inCone(enemy, p, b.angle, rule.range, rule.degrees)) { const a = Math.atan2(enemy.y - p.y, enemy.x - p.x); this.move(p, Math.cos(a) * rule.pull * dt, Math.sin(a) * rule.pull * dt); }
    if (now >= b.nextCan) {
      const a = b.angle + (this.random() - 0.5) * rule.degrees * Math.PI / 180;
      b.cans.push({ id: this.id('can'), x: enemy.x + Math.cos(a) * rule.range, y: enemy.y + Math.sin(a) * rule.range, back: false, spin: 0, bomb: this.random() < (rule.bombShare || 0) });
      b.nextCan = now + rule.canEvery;
    }
    for (const can of b.cans) {
      const a = can.back && can.dir !== undefined ? can.dir : Math.atan2(enemy.y - can.y, enemy.x - can.x), speed = can.back ? (rule.backSpeed || rule.canSpeed * 2.2) : rule.canSpeed;
      can.x += Math.cos(a) * speed * dt; can.y += Math.sin(a) * speed * dt; can.spin += dt * 10;
      if (!can.back && distance(can, p) < rule.canRadius + this.config.arena.playerRadius) {
        can.done = true;
        if (can.bomb) { this.effect('ring', can.x, can.y, '#e0564c', 0.5, rule.bombRadius || 1.4, { look: 'boom' }); this.hurt(rule.bombDamage || rule.canDamage); }
        else this.hurt(rule.canDamage);
        if (!this.active) return; continue;
      }
      if (distance(can, enemy) < enemy.radius + (can.back ? 0.3 : 0)) {
        can.done = true;
        if (can.back && can.bomb) { b.fed = Math.max(0, b.fed - 1); this.effect('ring', enemy.x, enemy.y, '#e0564c', 0.5, 1.4, { look: 'boom' }); this.notify('폭탄 깡통! 보호막이 깡통 하나만큼 다시 찼어요.'); this.sense({ kind: 'hurt' }); }
        else if (can.back) { b.fed++; this.effect('spark', enemy.x, enemy.y - enemy.radius, '#ffd257', 0.35, 1.2); this.sense({ kind: 'heavy' }); }
        continue;
      }
      // A can batted back that misses the mouth sails on and is gone.
      if (can.back && distance(can, enemy) > rule.range + 1.5) { can.done = true; this.effect('dust', can.x, can.y, '#c9c2ad', 0.3, 0.6); }
    }
    b.cans = b.cans.filter(can => !can.done);
  },
  /** Brass's drums: watch the order they light in, then strike them in that order; a wrong drum replays the order. */
  updateDrums(enemy, rule) {
    const b = enemy.breaking, p = this.p, now = this.s.time;
    if (b.phase === 'show' && now >= b.stepAt) {
      if (b.step < b.order.length) { b.drums[b.order[b.step]].flash = now + rule.showStep * 0.8; b.step++; b.stepAt = now + rule.showStep; }
      else { b.phase = 'play'; b.next = 0; }
    }
    // A march lane comes down through wherever the player stands, every few seconds.
    if (now >= b.nextLane) { b.lanes.push({ x: p.x, at: now + rule.laneWarn }); b.nextLane = now + rule.laneEvery; }
    for (const lane of b.lanes) if (!lane.done && now >= lane.at) {
      lane.done = true; this.effect('beam', lane.x, enemy.y - 12, '#cf767a', 0.8, 1, { targetX: lane.x, targetY: enemy.y + 12, look: 'march' });
      if (Math.abs(p.x - lane.x) < rule.laneWidth / 2 + this.config.arena.playerRadius) { this.hurt(rule.laneDamage); if (!this.active) return; }
    }
    b.lanes = b.lanes.filter(lane => !lane.done);
  },
  /** A drum struck while Brass waits for the order: the right one counts, a wrong one starts the showing again. */
  strikeDrum(enemy, i) {
    const b = enemy.breaking, now = this.s.time, rule = this.breakRule(enemy, b.index);
    if (b.phase !== 'play' || b.drums[i].done) return;
    if (b.order[b.next] === i) { b.drums[i].done = true; b.drums[i].flash = now + 0.3; b.next++; this.sense({ kind: 'hit' }); return; }
    for (const drum of b.drums) drum.done = false;
    Object.assign(b, { phase: 'show', step: 0, stepAt: now + 0.6, next: 0 }); this.effect('ring', b.drums[i].x, b.drums[i].y, '#a92f2b', 0.5, 1.2, { look: 'quake' }); this.notify('순서가 틀렸습니다. 다시 보세요.');
    void rule;
  },
  /** A swing during a break: bats cans back, strikes drums, knocks down soldiers it meets. */
  breakSwing(a, range) {
    const reach = target => inCone(this.p, target, a.angle, range + 0.3, this.config.rules.comboArcDegrees);
    for (const enemy of this.s.enemies) {
      const b = enemy.breaking; if (!b) continue;
      for (const can of b.cans || []) if (!can.back && reach(can)) { can.back = true; can.dir = Math.atan2(enemy.y - can.y, enemy.x - can.x); this.effect('spark', can.x, can.y, '#fff4d6', 0.2, 0.6); this.sense({ kind: 'hit' }); }
      if (b.drums && !a.drumStruck) { const i = b.drums.findIndex(drum => reach(drum)); if (i >= 0) { a.drumStruck = true; this.strikeDrum(enemy, i); } }
      for (const s of b.soldiers || []) if (!s.down && reach(s)) { if (s.flag) { s.down = true; this.effect('scrap', s.x, s.y, '#ffd257', 0.5, 1); this.sense({ kind: 'kill' }); } else this.effect('spark', s.x, s.y, '#d8dde2', 0.2, 0.5); }
    }
  },
  /** What the boss will do next: its usual round, plus what it has unlocked by being hurt. */
  nextBossPattern(enemy) {
    const round = [...enemy.patterns, ...(enemy.phasePatterns || []).filter(({ below }) => enemy.hp <= enemy.maxHp * below).map(({ pattern }) => pattern)];
    return round[enemy.pattern++ % round.length];
  },
  /** The carpets, as line segments, on the map or down the plain arena. */
  marchLanes(enemy, all = false) {
    const ai = this.config.bossAI[enemy.type], { top, bottom } = this.config.arena.bounds, map = this.map;
    const lanes = map?.lanes || [...ai.marchLanes, ai.phaseTwoLane].map(x => [[x, top], [x, bottom]]);
    if (all) return lanes;
    // Brass's live carpets grow with each phase: two, then three, then all four (slice.json liveLanes, laneOrder).
    if (ai.liveLanes) return (ai.laneOrder || lanes.map((_, i) => i)).filter(i => i < lanes.length).slice(0, this.liveLaneCount(enemy)).sort((a, b) => a - b).map(i => lanes[i]);
    return enemy.hp <= enemy.maxHp * ai.phaseTwoHpFraction ? lanes : lanes.slice(0, ai.marchLanes.length);
  },
  liveLaneCount(enemy) {
    const ai = this.config.bossAI[enemy.type];
    return ai.liveLanes ? Math.max(...ai.liveLanes.filter(({ below }) => enemy.hp <= enemy.maxHp * below).map(({ count }) => count), 0) : 0;
  },
  /** A new live carpet rolls out the moment Brass enters a phase that adds one. */
  checkCarpets(enemy) {
    const ai = this.config.bossAI[enemy.type], count = this.liveLaneCount(enemy), shown = enemy.lanesShown ??= ai.liveLanes?.[0].count;
    if (!count || count <= shown) return;
    const lanes = this.marchLanes(enemy, true), order = ai.laneOrder || lanes.map((_, i) => i); enemy.lanesShown = count;
    for (const i of order.slice(shown, count)) { const [[ax, ay], [bx, by]] = lanes[i]; this.effect('beam', ax, ay, '#ffd257', 1.2, 1, { targetX: bx, targetY: by, look: 'carpetRoll' }); }
    this.notify('카펫이 한 줄 더 깔립니다! 행진이 그 위로도 지나갑니다.');
  },
  /** Skill slot `index` while Roco holds it in his bag. */
  isConfiscated(index) { const held = this.p.confiscated; return !!held && held.index === index && held.until > this.s.time; },
  onLane(lane, width) {
    const [[ax, ay], [bx, by]] = lane;
    return segmentDistance(this.p, { x: ax, y: ay }, { x: bx, y: by }) < width + this.config.arena.playerRadius;
  },
  /** One crate always lands on the player; the rest land round them, on the floor. */
  craneDrops(enemy) {
    const ai = this.config.bossAI[enemy.type], { x, y } = this.p, drops = [{ x, y }], map = this.map, { bounds } = this.config.arena;
    for (let tries = 0; tries < 40 && drops.length < ai.craneDrops; tries++) {
      const angle = this.random() * Math.PI * 2, reach = ai.craneRadius * 2 + this.random() * ai.craneSpread, spot = { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach };
      if (map ? fitsMap(spot.x, spot.y, 0.4, map) : spot.x > bounds.left && spot.x < bounds.right && spot.y > bounds.top && spot.y < bounds.bottom) drops.push(spot);
    }
    return drops;
  },
  /** The safe carpet is always one the player can reach in time. */
  safeCarpet(enemy, seconds) {
    const lanes = this.marchLanes(enemy, true), reach = this.c.player.speed * seconds * CARPET_REACH_SHARE;
    const away = lanes.map(([[ax, ay], [bx, by]]) => segmentDistance(this.p, { x: ax, y: ay }, { x: bx, y: by }));
    const near = lanes.map((_, i) => i).filter(i => away[i] <= reach);
    return near.length ? near[Math.floor(this.random() * near.length)] : away.indexOf(Math.min(...away));
  },
  /**
   * Where a rank of soldiers starts and stops: two lines, `start` and `end`, whose first and second points pair up.
   * The column crosses the square as the map sets out; the parade runs down the carpets as one wide rank spanning all
   * of them, from either end, so it can only be passed through its gap (2026-11-06: a single file down one carpet was
   * dodged by stepping aside).
   */
  rankPath(kind) {
    const { left, right, top, bottom } = this.config.arena.bounds, lanes = this.map?.lanes;
    if (kind === 'parade' && lanes?.length >= 2) {
      const [first, last] = [lanes[0], lanes[lanes.length - 1]];
      const widen = ([a, b], by) => { const dx = b[0] - a[0], dy = b[1] - a[1], k = by / Math.hypot(dx, dy); return [[a[0] - dx * k, a[1] - dy * k], [b[0] + dx * k, b[1] + dy * k]]; };
      const near = widen([first[0], last[0]], RANK_OVERHANG_UNITS), far = widen([first[1], last[1]], RANK_OVERHANG_UNITS);
      return this.random() < 0.5 ? { start: near, end: far } : { start: far, end: near };
    }
    return this.map?.column || { start: [[left, top], [left, bottom]], end: [[right, top], [right, bottom]] };
  },
  /**
   * Sends ranks of soldiers from `path.start` to `path.end`, one after another, each with its gap somewhere else, so the
   * player has to move to the next gap for every rank.
   */
  sendRanks(enemy, path, speed) {
    const ai = this.config.bossAI[enemy.type], { start, end } = path;
    const span = Math.hypot(start[1][0] - start[0][0], start[1][1] - start[0][1]), travel = Math.hypot(end[0][0] - start[0][0], end[0][1] - start[0][1]);
    const gapShare = ai.columnGapUnits / span, seconds = travel / speed, gaps = [];
    // Each gap is drawn from what is left of the line once a stretch round the last gap is set aside.
    const low = gapShare / 2, high = 1 - gapShare * 1.5, away = gapShare * 1.5;
    const ranks = this.bossRepeat(enemy, 'ranks');
    for (let i = 0; i < ranks; i++) {
      const last = gaps.at(-1), spans = last === undefined ? [[low, high]] : [[low, Math.min(high, last - away)], [Math.max(low, last + away), high]].filter(([from, to]) => to > from);
      const total = spans.reduce((sum, [from, to]) => sum + to - from, 0);
      let pick = this.random() * total, gap = low;
      for (const [from, to] of spans) { if (pick <= to - from) { gap = from + pick; break; } pick -= to - from; }
      gaps.push(spans.length ? gap : low + this.random() * (high - low));
    }
    this.s.ranks = [...(this.s.ranks || []), ...gaps.map((gapFrom, i) => ({ start, end, at: -i * ai.rankGapSeconds / seconds, seconds, gapFrom, gapShare, damage: enemy.damage, width: ai.columnWidth, spent: false }))];
    enemy.ready = Math.max(enemy.ready, this.s.time + (ranks - 1) * ai.rankGapSeconds + enemy.recovery);
  },
  startColumn(enemy, path = this.rankPath('column')) { this.sendRanks(enemy, path, this.config.bossAI[enemy.type].columnSpeed); },
  /** Where a rank stands now, as the two stretches either side of its gap. */
  /** One ring of trumpet notes round the boss, its gap centred on `safeAngle`. */
  trumpetRing(enemy, safeAngle) {
    const ai = this.config.bossAI[enemy.type], gap = ai.waveGapDegrees * Math.PI / 180;
    for (let i = 0; i < ai.waveCount; i++) { const angle = safeAngle + gap / 2 + (Math.PI * 2 - gap) * i / (ai.waveCount - 1); this.fireBullet(enemy, angle, ai.waveSpeed); }
  },
  /**
   * How many times a boss repeats one of its patterns (stickers, crates, ranks, note rings, stomp rings) on this run's
   * difficulty: slice.json difficulty.levels[].bossRepeats, or the pattern's own count where the level sets none.
   */
  /** A phase break's rules on this run's difficulty: the boss's own, with difficulty.levels[].phaseBreaks[kind] laid over. */
  breakRule(enemy, index) {
    const base = this.config.bossAI[enemy.type].phaseBreaks[index];
    return { ...base, ...(this.difficulty.phaseBreaks?.[base.kind] || {}) };
  },
  bossRepeat(enemy, key) { return this.difficulty.bossRepeats?.[key] ?? this.config.bossAI[enemy.type]?.[key]; },
  rankLine(rank) {
    const { start, end, at, gapFrom, gapShare } = rank, lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = lerp(start[0], end[0], at), b = lerp(start[1], end[1], at);
    return { a, b, gapA: lerp(a, b, gapFrom), gapB: lerp(a, b, gapFrom + gapShare) };
  },
  tickBossHazards(dt) {
    const { s, p } = this, bell = s.enemies.find(e => e.bellUntil > s.time);
    if (!bell) s.bellWatch = null;
    else if (s.bellWatch && (Math.hypot(p.x - s.bellWatch.x, p.y - s.bellWatch.y) > BELL_DRIFT_UNITS || p.attack || p.lastCast?.at >= s.bellWatch.at)) { s.bellWatch = null; this.hurt(bell.damage); if (!this.active) return; }
    if (s.drill) {
      const d = s.drill, step = d.steps[d.index];
      d.moved += Math.hypot(p.x - d.last.x, p.y - d.last.y); d.last = { x: p.x, y: p.y };
      const tooMuch = step === 'still' && (Math.hypot(p.x - d.from.x, p.y - d.from.y) > d.rules.still || p.attack);
      if (!d.failed && tooMuch) { d.failed = true; this.hurt(d.damage); if (!this.active) return; }
      if (s.time >= d.until) {
        if (step === 'move' && !d.failed && d.moved < d.rules.move) { this.hurt(d.damage); if (!this.active) return; }
        d.index++;
        if (d.index >= d.steps.length) s.drill = null;
        else Object.assign(d, { until: s.time + d.rules.seconds, from: { x: p.x, y: p.y }, moved: 0, failed: false });
      }
    }
    if (!s.ranks?.length) return;
    // Each rank walking across hits once, anywhere but its gap; a rank still waiting to set off (at < 0) does nothing.
    for (const rank of s.ranks) {
      rank.at += dt / rank.seconds;
      if (rank.at < 0 || rank.at >= 1) continue;
      const { a, b, gapA, gapB } = this.rankLine(rank), near = (from, to) => this.onLane([from, to], rank.width);
      if (!rank.spent && (near(a, gapA) || near(gapB, b)) && this.hurt(rank.damage)) rank.spent = true;
      if (!this.active) return;
    }
    s.ranks = s.ranks.filter(rank => rank.at < 1);
  },
  executeEnemy(enemy) {
    const tell = enemy.tell; enemy.tell = null; enemy.state = 'recover'; enemy.ready = this.s.time + enemy.recovery;
    const p = this.p, ai = this.config.bossAI[enemy.type];
    const damage = () => this.hurt(enemy.damage);
    if (!enemy.boss) this.sense({ kind: 'mob', id: enemy.type });
    // Each boss pattern has its own sound when it lands (the bell and alarm already ring at their warning).
    else if (tell?.type) this.sense({ kind: 'boss', id: tell.type });
    switch (tell.type) {
      case 'melee': if (inCone(tell, p, tell.angle, enemy.attackRange, this.config.rules.enemyMeleeArc)) damage(); break;
      case 'burst':
        // The rat goes off where its warning ring was drawn, and the ring counts the player's body, not only its centre.
        enemy.hp = 0; this.effect('scrap', tell.x, tell.y, enemy.color, 0.6, 1); this.effect('ring', tell.x, tell.y, '#e8914e', 1, enemy.burstRadius, { look: 'boom' }); this.sense({ kind: 'burst' });
        // A rat that bursts still counts as beaten: its share of the room's loot and any heal-on-kill.
        if (this.upgradeAmount('killHeal')) this.heal(this.upgradeAmount('killHeal'), true);
        this.payKill(enemy);
        if (floorDistance(tell, p) < enemy.burstRadius + this.config.arena.playerRadius) damage(); break;
      case 'dash': enemy.dash = { angle: tell.angle, elapsed: 0 }; break;
      case 'shot': this.fireBullet(enemy, tell.angle, enemy.projectileSpeed); break;
      // Music box: a ring of shots, turned a little each volley so the gaps move.
      case 'spiral': {
        enemy.spiralTurn = (enemy.spiralTurn || 0) + Math.PI / enemy.bullets;
        for (let i = 0; i < enemy.bullets; i++) this.fireBullet(enemy, enemy.spiralTurn + i * TAU_ENEMY / enemy.bullets, enemy.projectileSpeed);
        enemy.volleyLeft = (enemy.volleyLeft ?? enemy.volleys) - 1;
        if (enemy.volleyLeft > 0) { enemy.followup = { type: 'spiral', at: this.s.time + enemy.volleyGap }; enemy.ready = this.s.time; } else enemy.volleyLeft = undefined;
        break;
      }
      // Jack-in-the-box: springs up where the player stood when the circle appeared.
      case 'ambush': {
        const spot = { x: tell.targetX, y: tell.targetY };
        if (!this.map?.walkable || fitsMap(spot.x, spot.y, enemy.radius, this.map)) Object.assign(enemy, spot);
        enemy.hidden = false; this.sense({ kind: 'pop' });
        this.effect('ring', spot.x, spot.y, '#e8914e', 0.7, enemy.popRadius, { look: 'quake' });
        if (floorDistance(spot, p) < enemy.popRadius) damage(); break;
      }
      // Spinning top: rolls off in a straight line and bounces from walls until it winds down.
      case 'spin': enemy.spin = { angle: tell.angle, until: this.s.time + enemy.spinSeconds, hitReady: 0 }; break;
      // Drummer: no damage of its own; nearby soldiers move faster and shrug off hits for a while.
      case 'beat':
        for (const ally of this.s.enemies) if (ally !== enemy && !ally.boss && ally.hp > 0 && distance(ally, enemy) <= enemy.beatRadius) { ally.beatUntil = this.s.time + enemy.beatSeconds; if (!ally.aggro) ally.noticedAt = this.s.time; ally.aggro = true; }
        this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.85, enemy.beatRadius, { look: 'drumBeat' }); break;
      // Pikeman: a long thrust, then a shorter one re-aimed at where the player went.
      case 'thrust': case 'thrust2': {
        const length = tell.type === 'thrust' ? enemy.attackRange : enemy.followupLength, end = { x: tell.x + Math.cos(tell.angle) * length, y: tell.y + Math.sin(tell.angle) * length };
        if (segmentDistance(p, tell, end) <= enemy.thrustWidth + this.config.arena.playerRadius) damage();
        this.effect('beam', tell.x, tell.y, '#d1a85a', 0.45, 1, { targetX: end.x, targetY: end.y, look: 'thrust' });
        if (tell.type === 'thrust') enemy.followup = { type: 'thrust2', at: this.s.time + enemy.followupDelay };
        break;
      }
      case 'doubleWave':
        if (floorDistance(tell, p) < enemy.attackRange) damage();
        this.effect('ring', tell.x, tell.y, '#d86e76', 0.7, enemy.attackRange, { look: 'quake' });
        enemy.followup = { type: 'eliteWave', at: this.s.time + enemy.followupDelay }; break;
      case 'eliteWave': if (floorDistance(tell, p) < enemy.attackRange + enemy.followupRadiusBonus) damage(); this.effect('ring', tell.x, tell.y, '#d86e76', 0.7, enemy.attackRange + enemy.followupRadiusBonus, { look: 'quake' }); break;
      case 'claw': {
        const end = { x: tell.x + Math.cos(tell.angle) * ai.clawLength, y: tell.y + Math.sin(tell.angle) * ai.clawLength };
        if (segmentDistance(p, tell, end) <= ai.clawWidth + this.config.arena.playerRadius && damage() && ai.confiscateSeconds && this.skillSlots.length && !(this.p.confiscated?.until > this.s.time)) {
          // The claw that catches F2 takes a skill back to Roco's bag for a while: a blow to his back returns it.
          const index = Math.floor(this.random() * this.skillSlots.length);
          this.p.confiscated = { index, until: this.s.time + ai.confiscateSeconds };
          this.notify(`로코가 ${this.skillSlots[index].skill.name}을(를) 압수했습니다! 등을 쳐서 되찾으세요.`);
        }
        this.effect('beam', tell.x, tell.y, '#cf767a', 0.45, 1, { targetX: end.x, targetY: end.y, look: 'thrust' }); break;
      }
      case 'magnet':
        this.s.casts.push({ id: this.id('magnet'), shape: 'magnet', x: tell.targetX, y: tell.targetY, radius: ai.magnetRadius, age: 0, duration: ai.magnetDuration, pull: ai.magnetPull, enemyDamage: enemy.damage, damageAt: ai.magnetDamageDelay, done: false }); break;
      // Suction: a cone in front of Roco drags the player in, then spits whoever reached its mouth back out.
      case 'suction':
        this.s.casts.push({ id: this.id('suction'), shape: 'suction', owner: enemy.id, x: enemy.x, y: enemy.y, angle: tell.angle, range: ai.suctionRange, degrees: ai.suctionDegrees, age: 0, duration: ai.suctionSeconds, pull: ai.suctionPull, spitRadius: ai.spitRadius, spitPush: ai.spitPush, enemyDamage: enemy.damage });
        enemy.ready = this.s.time + ai.suctionSeconds + enemy.recovery; break;
      // Stickers: seven 'defective' labels thrown one after another at wherever the player is standing then.
      // Each is marked before it lands; on the floor it slows the player, then peels off a moment later.
      case 'stickers':
        this.s.casts.push({ id: this.id('stickers'), shape: 'stickerVolley', owner: enemy.id, x: enemy.x, y: enemy.y, age: 0, left: this.bossRepeat(enemy, 'stickerCount'), next: 0, gap: ai.stickerGap, warn: ai.stickerWarn, radius: ai.stickerRadius, duration: ai.stickerSeconds, slow: ai.stickerSlow });
        enemy.ready = this.s.time + this.bossRepeat(enemy, 'stickerCount') * ai.stickerGap + enemy.recovery; break;
      // Stomp: rings of shock spread from Brass on the beat; dodge through each as it passes.
      case 'stomp':
        for (let i = 0, rings = this.bossRepeat(enemy, 'stompRings'); i < rings; i++) this.s.casts.push({ id: this.id('stomp'), shape: 'stompRing', owner: enemy.id, x: enemy.x, y: enemy.y, age: -i * ai.stompGap, speed: ai.stompSpeed, reach: ai.stompReach, width: ai.stompWidth, enemyDamage: enemy.damage, passed: false });
        enemy.ready = this.s.time + this.bossRepeat(enemy, 'stompRings') * ai.stompGap + enemy.recovery; break;
      // Charge: a straight run along the marked line, then a trumpet blast ahead where it stops.
      case 'charge':
        enemy.dashDistance = ai.chargeLength; enemy.dashDuration = ai.chargeSeconds; enemy.dash = { angle: tell.angle, elapsed: 0, then: 'chargeHorn' };
        enemy.ready = this.s.time + ai.chargeSeconds + ai.hornDelay + 1 + enemy.recovery; break;
      case 'chargeHorn':
        if (inCone(tell, p, tell.angle, ai.hornRange, ai.hornDegrees)) damage();
        this.effect('swing', tell.x, tell.y, '#e0a068', 0.85, ai.hornRange, { angle: tell.angle, phase: 2, arc: ai.hornDegrees, look: 'wave' }); break;
      case 'overcharge': if (floorDistance(tell, p) <= ai.overchargeRadius + this.config.arena.playerRadius) damage(); this.effect('ring', tell.x, tell.y, '#e0a068', 0.7, ai.overchargeRadius, { look: 'quake' }); enemy.ready = this.s.time + ai.overchargeRecovery; break;
      case 'fan':
      case 'fanSecond':
        if (inCone(tell, p, tell.angle, ai.fanRange, ai.fanDegrees)) damage();
        this.effect('swing', tell.x, tell.y, '#dc817b', 0.85, ai.fanRange, { angle: tell.angle, phase: 2, arc: ai.fanDegrees, look: 'wave' });
        if (tell.type === 'fan') enemy.followup = { type: 'fanSecond', at: this.s.time + ai.followupDelay }; break;
      case 'march': {
        const lanes = this.marchLanes(enemy);
        if (lanes.some(lane => this.onLane(lane, ai.marchWidth))) damage();
        for (const [[ax, ay], [bx, by]] of lanes) this.effect('beam', ax, ay, '#cf767a', 0.8, 1, { targetX: bx, targetY: by, look: 'march' }); break;
      }
      case 'alarm': enemy.alarmUntil = this.s.time + ai.alarmSeconds; enemy.ready = enemy.alarmUntil + enemy.recovery; break;
      case 'crane':
        if (tell.drops.some(drop => floorDistance(drop, p) <= ai.craneRadius + this.config.arena.playerRadius)) damage();
        for (const { x, y } of tell.drops) { this.effect('ring', x, y, '#c9a66b', 0.7, ai.craneRadius, { look: 'crateCrash' }); this.effect('scrap', x, y, '#c9a66b', 0.5, 1); }
        break;
      // Roco throws crates: under one is a hit, and the crates stay. One blown up next to Roco knocks him out for a moment.
      case 'crateToss': {
        if (tell.drops.some(drop => floorDistance(drop, p) <= ai.crateTossRadius + this.config.arena.playerRadius)) damage();
        const crates = (this.s.hazards ??= []);
        for (const { x, y } of tell.drops) {
          if (this.map?.walkable && !fitsMap(x, y, 0.45, this.map)) continue;
          crates.push({ id: this.id('hz'), kind: 'crate', x, y, size: this.config.hazards?.crate.size || 0.9 });
          this.effect('ring', x, y, '#c9a66b', 0.5, ai.crateTossRadius, { look: 'crateCrash' });
        }
        const thrown = crates.filter(h => h.kind === 'crate' && !h.gone && h.fuseAt === undefined);
        while (thrown.length > ai.crateTossMax) { const old = thrown.shift(); old.gone = true; this.effect('scrap', old.x, old.y, '#b0783e', 0.4, 0.8); }
        break;
      }
      // Parade: wide ranks of toy soldiers march down the carpets, one after another; slip through each rank's gap.
      case 'parade': this.sendRanks(enemy, tell.path, ai.paradeSpeed); break;
      // Drill: Brass calls the steps: freeze on "멈춰!", walk on "앞으로!". Getting either wrong costs a hit.
      case 'drill': {
        const steps = this.liveLaneCount(enemy) >= 4 ? ['still', 'move', 'still'] : ['still', 'move'];
        this.s.drill = { steps, index: 0, until: this.s.time + ai.drillStepSeconds, from: { x: p.x, y: p.y }, moved: 0, last: { x: p.x, y: p.y }, failed: false, damage: enemy.damage, rules: { seconds: ai.drillStepSeconds, still: ai.drillStillUnits, move: ai.drillMoveUnits } };
        enemy.ready = this.s.time + steps.length * ai.drillStepSeconds + enemy.recovery; break;
      }
      case 'bell':
        enemy.bellUntil = this.s.time + ai.bellSeconds; enemy.ready = enemy.bellUntil + enemy.recovery;
        this.s.bellWatch = { x: p.x, y: p.y, at: this.s.time }; break;
      case 'column': this.startColumn(enemy, tell.path); break;
      case 'carpet': {
        const lanes = this.marchLanes(enemy, true);
        if (!this.onLane(lanes[tell.safe], ai.carpetSafeWidth)) damage();
        lanes.forEach(([[ax, ay], [bx, by]], i) => { if (i !== tell.safe) this.effect('beam', ax, ay, '#cf767a', 0.8, 1, { targetX: bx, targetY: by, look: 'march' }); });
        break;
      }
      // Trumpet: a ring of notes with one gap, blown three times in a row (2026-11-06); each later ring turns its gap a
      // little, one way then the other, so standing still in the first gap is not enough.
      case 'trumpetWave': {
        this.trumpetRing(enemy, tell.angle);
        const volleys = this.bossRepeat(enemy, 'waveVolleys') || 1;
        if (volleys > 1) { enemy.noteVolleys = { left: volleys - 1, next: this.s.time + ai.waveVolleyGap, angle: tell.angle, turn: 1 }; enemy.ready = Math.max(enemy.ready, this.s.time + (volleys - 1) * ai.waveVolleyGap + enemy.recovery); }
        break;
      }
    }
  },
  /** One frame of a spinning top: straight on, turning back from whatever wall it meets, hurting on contact. */
  spinEnemy(enemy, dt) {
    const s = enemy.spin, step = enemy.spinSpeed * dt, before = { x: enemy.x, y: enemy.y };
    this.move(enemy, Math.cos(s.angle) * step, Math.sin(s.angle) * step);
    if (distance(before, enemy) < step * 0.5) {
      const across = Math.PI - s.angle, back = -s.angle;
      s.angle = [across, back, s.angle + Math.PI].find(angle => { const test = { ...enemy }; this.move(test, Math.cos(angle) * step, Math.sin(angle) * step); return distance(test, enemy) >= step * 0.5; }) ?? s.angle + Math.PI;
    }
    enemy.facing = s.angle;
    if (this.s.time >= s.hitReady && distance(this.p, enemy) <= enemy.radius + this.config.arena.playerRadius && this.hurt(enemy.damage)) s.hitReady = this.s.time + enemy.spinHitGap;
    if (this.s.time >= s.until) { enemy.spin = null; enemy.ready = this.s.time + enemy.recovery; }
  },
  fireBullet(enemy, angle, speed) { this.s.projectiles.push({ id: this.id('bullet'), x: enemy.x, y: enemy.y, angle, speed, radius: this.config.rules.enemyProjectileRadius, damage: enemy.damage, friendly: false, until: this.s.time + this.config.rules.enemyProjectileLifetime }); },
  updateEnemies(dt) {
    this.tickBossHazards(dt);
    if (!this.active) return;
    const flow = this.flowField;
    flow?.update(this.p.x, this.p.y);
    let activeMelee = this.s.enemies.filter(e => !e.boss && (e.tell || e.dash) && e.attack !== 'shot').length;
    for (const enemy of this.s.enemies) {
      if (enemy.hp <= 0) continue;
      // A first-wave body still climbing out of its hatch does nothing; it pops out with a puff when its time comes.
      if (enemy.summonUntil) {
        if (this.s.time < enemy.summonUntil) continue;
        enemy.summonUntil = 0; this.effect('dodge', enemy.x, enemy.y, '#e0a03c', 0.3, 1.2); this.sense({ kind: 'summon' });
      }
      if (enemy.shove) {
        const ease = u => 1 - (1 - u) ** 2, s = enemy.shove, from = ease(Math.min(1, s.elapsed / KNOCKBACK_SECONDS)), to = ease(Math.min(1, (s.elapsed + dt) / KNOCKBACK_SECONDS));
        this.move(enemy, s.x * (to - from), s.y * (to - from)); s.elapsed += dt;
        if (s.elapsed >= KNOCKBACK_SECONDS) enemy.shove = null;
      }
      enemy.burnStacks = enemy.burnStacks.filter(t => t > this.s.time);
      if (enemy.burnStacks.length && this.s.time >= enemy.burnTick) {
        const info = this.c.statuses.find(s => s.id === 'burn');
        this.hitEnemy(enemy, info.damagePerSecond * info.tickInterval * enemy.burnStacks.length * (this.statusPower + this.upgradeAmount('statusDamage')), { dot: true, color: '#efaa71' });
        enemy.burnTick += info.tickInterval;
      }
      if (enemy.breaking) { this.updatePhaseBreak(enemy, dt); if (!this.active) return; continue; }
      if (enemy.hp <= 0 || enemy.held || enemy.exposedUntil > this.s.time || enemy.stunUntil > this.s.time || enemy.alarmUntil > this.s.time || enemy.bellUntil > this.s.time) continue;
      if (enemy.dash) {
        const d = enemy.dash, start = { x: enemy.x, y: enemy.y };
        this.move(enemy, Math.cos(d.angle) * enemy.dashDistance / enemy.dashDuration * dt, Math.sin(d.angle) * enemy.dashDistance / enemy.dashDuration * dt);
        if (segmentDistance(this.p, start, enemy) <= enemy.radius + this.config.arena.playerRadius) this.hurt(enemy.damage);
        if (!this.active) return;
        d.elapsed += dt; if (d.elapsed >= enemy.dashDuration) { enemy.dash = null; if (d.then) enemy.followup = { type: d.then, at: this.s.time + this.config.bossAI[enemy.type].hornDelay }; } continue;
      }
      if (enemy.spin) { this.spinEnemy(enemy, dt); if (!this.active) return; continue; }
      if (enemy.noteVolleys && this.s.time >= enemy.noteVolleys.next) {
        const v = enemy.noteVolleys, ai = this.config.bossAI[enemy.type];
        this.trumpetRing(enemy, v.angle + v.turn * ai.waveTurnDegrees * Math.PI / 180);
        v.turn = -v.turn; v.left--; v.next = this.s.time + ai.waveVolleyGap; if (v.left <= 0) enemy.noteVolleys = null;
      }
      if (enemy.tell) { if (this.s.time >= enemy.tell.until) this.executeEnemy(enemy); if (!this.active) return; continue; }
      if (enemy.followup) {
        const next = enemy.followup; enemy.followup = null;
        this.beginEnemyTell(enemy, next.type, Math.max(this.config.rules.minimumFollowupTell, next.at - this.s.time)); continue;
      }
      const a = Math.atan2(this.p.y - enemy.y, this.p.x - enemy.x), d = distance(this.p, enemy);
      if (!enemy.aggro) { if (d > this.config.rules.aggroUnits) continue; this.rouse(enemy); }
      // An ambusher travels underground between strikes and cannot be hit there.
      enemy.hidden = enemy.attack === 'ambush' && this.s.time >= enemy.ready;
      enemy.facing = a;
      if (this.s.time >= enemy.ready && (enemy.boss || d < enemy.attackRange) && (enemy.boss || enemy.attack === 'shot' || activeMelee < this.config.rules.maxActiveMelee)) {
        const type = enemy.boss ? this.nextBossPattern(enemy) : enemy.attack;
        this.beginEnemyTell(enemy, type); if (!enemy.boss && enemy.attack !== 'shot') activeMelee++;
      } else if (!enemy.stationary && d > this.config.rules.enemyStopDistance[enemy.boss ? 'boss' : RANGED_ATTACKS.includes(enemy.attack) ? 'ranged' : 'melee']) {
        const chill = this.c.statuses.find(s => s.id === 'chill');
        const slow = enemy.statuses.chill > this.s.time ? (enemy.boss ? Math.min(this.c.caps.bossSlow, chill.slow * this.statusPower) : chill.slow * this.statusPower) : 0;
        const step = enemy.speed * (1 - slow) * (enemy.beatUntil > this.s.time ? 1 + this.config.enemies.drummer.beatHaste : 1) * dt, way = (d > DIRECT_UNITS ? flow?.heading(enemy.x, enemy.y) : null) ?? a;
        this.move(enemy, Math.cos(way) * step, Math.sin(way) * step);
      }
    }
    // Separate bodies gently without pushing through walls.
    const living = this.s.enemies.filter(e => e.hp > 0);
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const a = living[i], b = living[j], d = distance(a, b), overlap = a.radius + b.radius - d;
      if (overlap > 0 && d > 0) { const angle = Math.atan2(b.y - a.y, b.x - a.x); this.move(b, Math.cos(angle) * overlap * 0.5, Math.sin(angle) * overlap * 0.5); }
    }
  },
  updateProjectiles(dt) {
    for (const b of this.s.projectiles) {
      const before = { x: b.x, y: b.y }, step = b.speed * dt;
      this.move(b, Math.cos(b.angle) * step, Math.sin(b.angle) * step, b.radius);
      if (distance(before, b) < step * 0.6) { b.until = 0; this.shotStopped(b); }
      if (b.friendly) {
        const target = this.s.enemies.find(e => e.hp > 0 && segmentDistance(e, before, b) < e.radius + b.radius);
        // A bullet the wrench turned round hits for exactly what it would have taken off F2: no crit, no damage bonus.
        if (target) { this.hitEnemy(target, b.damage, { exact: !!b.exact }); b.until = 0; }
      } else if (segmentDistance(this.p, before, b) <= this.config.arena.playerRadius + b.radius) { this.hurt(b.damage); b.until = 0; }
      if (!this.active) return;
    }
    this.s.projectiles = this.s.projectiles.filter(b => b.until > this.s.time);
  },
};
