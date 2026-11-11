// Chapter 2's bosses: inspector Iris (factory-05) and director Press (factory-12). Their patterns, their phase breaks
// (mirrors; pylons and twin pistons) and the timed things they leave in the room (s.bossFields, s.flow). Mixed into Game;
// enemyActions calls in at a tell, a strike, each step, a phase break and a break swing (see the hooks in factory-mobs.js
// and enemy-actions.js). Numbers live in slice.json bossAI.inspectorIris / bossAI.directorPress.
import { fitsMap } from './map-geometry.js';
import { distance, floorDistance, segmentDistance, inCone, FLOOR_FLAT } from './math.js';
import { josa } from './nickname.js';

const TURN = Math.PI * 2;
/** Who fbFail counts for when the blow comes from a field she left (a stamp, the grid), not from her body. */
const IRIS = { type: 'inspectorIris' };
/**
 * A chapter 2 shield the first time it rises: the boss says a line in the notice strip (the fight goes on), a hint at
 * the way, not the way itself; how to break it is said after it has once failed (2026-11-09).
 */
const BREAK_FIRST = {
  mirrors: '아이리스: 제 빛을 되돌릴 수 있다면, 해 보세요.',
  pylons: '프레스: 전력이 흐르는 한 나는 멈추지 않는다.',
  molds: '프레스: 규격에 맞지 않는 것은 통과할 수 없다.'
};
export const FACTORY_BREAKS = new Set(['mirrors', 'pylons', 'molds']);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const wrap = a => ((a + Math.PI) % TURN + TURN) % TURN - Math.PI;
const inBox = (p, f, pad = 0) => Math.abs(p.x - f.x) <= f.w / 2 + pad && Math.abs(p.y - f.y) <= f.h / 2 + pad;
// A mould's look: teeth, flipped, which side its hole is on, a notch in its rim. Distractors differ in one of these.
/** Press's moulds (PixelLab trays, art/chapters/2-silent-factory/fx/mold-*.png): a toy shape, and whether it is mirrored. */
export const MOLD_SHAPES = ['key', 'horse', 'teapot', 'boot', 'rabbit', 'note'];
/** Which of eight ways (0 east, 2 south, 4 west, 6 north) from mirror `m` points nearest at Iris. */
const mirrorDir = (m, enemy) => ((Math.round(Math.atan2(enemy.y - m.y, enemy.x - m.x) / (Math.PI / 4)) % 8) + 8) % 8;
/**
 * Iris's inspection rings: the middle disc and the two rings as shares of the reach that covers the whole floor from the
 * hall's middle, pieces a ring, where the first piece starts. 2026-11-09: they were 1.6 / 3.3 / 5 units round F2, and
 * stepping outside them dodged the whole pattern; now they sit on the hall and cover it, and outside them blows too.
 */
export const GRID_SHARES = [0.2, 0.55, 1], GRID_SECTORS = 4, GRID_TURN = Math.PI / 4;
/** Which ring (0 the disc) and piece a floor point lies in, or null outside the rings. Pieces count clockwise from GRID_TURN. */
export function gridCell(f, pt) {
  const dx = pt.x - f.cx, dy = (pt.y - f.cy) / FLOOR_FLAT, d = Math.hypot(dx, dy), ring = f.radii.findIndex(r => d < r);
  if (ring < 0) return null;
  const a = ((Math.atan2(dy, dx) - GRID_TURN) % TURN + TURN) % TURN;
  return { ring, sector: ring === 0 ? -1 : Math.floor(a / (TURN / f.sectors)) };
}
const MOLD_FEATURES = [['shape', MOLD_SHAPES], ['flip', [false, true]]];

export const factoryBosses = {
  /** The rules of the boss a body is, if it is one of these two. */
  fbAI(enemy) { return enemy.boss && (enemy.type === 'inspectorIris' || enemy.type === 'directorPress') ? this.config.bossAI[enemy.type] : null; },
  /** A spot on the floor near (x, y), pulled toward `toward` until it is floor. */
  fbFloor(x, y, toward = this.p, room = 0.6) {
    for (let k = 1; k >= 0; k -= 0.1) { const at = { x: toward.x + (x - toward.x) * k, y: toward.y + (y - toward.y) * k }; if (!this.map?.walkable || fitsMap(at.x, at.y, room, this.map)) return at; }
    return { x: toward.x, y: toward.y };
  },
  /** The boss's fighting floor as a box: the map's `arena` [x0, y0, x1, y1] (a hall with an entry corridor), else the whole map. */
  fbArena() {
    const [w, h] = this.map?.size || [36, 18], [x0, y0, x1, y1] = this.map?.arena || [0, 0, w, h];
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  },
  /** The fighting floor's top and bottom (the walkable outline inside the arena), else the arena's. */
  fbFloorSpan() {
    const { x, y, w, h } = this.fbArena(), ys = (this.map?.walkable || []).filter(([px]) => px >= x && px <= x + w).map(pt => pt[1]);
    return ys.length ? { top: Math.max(y, Math.min(...ys)), bottom: Math.min(y + h, Math.max(...ys)) } : { top: y, bottom: y + h };
  },
  /** A boss pattern's set damage (steam, rings, walls…) scaled like the boss's own blows by the difficulty (user's choice, 2026-11-10: it was the same on every level). */
  fbFixed(amount) { return Math.max(1, Math.round(amount * (this.s.run ? this.difficulty.scale : 1))); },
  fbField(field) { (this.s.bossFields ??= []).push({ id: this.id('field'), ...field }); return field; },
  /**
   * A hall entered by a corridor (the map's `arena` with `arenaGates`, Press's forming hall): the boss waits, out of
   * reach, while F2 walks up the corridor; once F2 is inside, laser gates shut the corridor mouth and the exit alcove
   * and hold F2 in the hall until the boss is down (2026-11-10: standing in the corridor or by the exit dodged most patterns).
   */
  fbHallWaiting() {
    return !!this.map?.arenaGates && this.s.mode === 'combat' && !this.fbInHall() && !this.fbHallShut() && this.s.enemies.some(e => e.boss && e.hp > 0);
  },
  /** F2 well inside the hall's top and bottom (half a unit past the corridor mouth). */
  fbInHall() { const { y, h } = this.fbArena(); return this.p.y >= y && this.p.y <= y + h - 0.5; },
  /** The fight may begin (his first words included): no hall to walk into, or its gates already shut behind F2. */
  fbHallReady() { return !this.map?.arenaGates || this.fbHallShut() || !this.s.enemies.some(e => e.boss && e.hp > 0); },
  fbHallShut() { return (this.s.hazards || []).some(h => h.kind === 'hallGate') && this.s.enemies.some(e => e.boss && e.hp > 0); },
  fbHallGates() {
    const gates = this.map?.arenaGates, t = this.s.time;
    if (!gates || !this.s.run) return;
    const boss = this.s.enemies.find(e => e.boss && e.hp > 0), shut = (this.s.hazards || []).some(h => h.kind === 'hallGate');
    if (shut && !boss) {
      this.s.hazards = this.s.hazards.filter(h => h.kind !== 'hallGate');
      for (const g of gates) for (const k of [-1, 1]) this.effect('spark', g.x + k * g.half, g.y - 1.1, '#ff8a9a', 0.4, 1);
      return;
    }
    // Gates already up follow the map's numbers (2026-11-10: a save made before arenaGates changed kept drawing the old
    // gate until the room was entered again). They were made in the map's order.
    if (shut) { this.s.hazards.filter(h => h.kind === 'hallGate').forEach((h, i) => { const g = gates[i]; if (g) Object.assign(h, { x: g.x, y: g.y, half: g.half, lift: g.lift }); }); return; }
    if (!boss || this.s.mode !== 'combat' || !this.fbInHall()) return;
    (this.s.hazards ??= []).push(...gates.map(g => ({ id: this.id('gate'), kind: 'hallGate', x: g.x, y: g.y, half: g.half, lift: g.lift, at: t })));
    for (const g of gates) for (const k of [-1, 1]) this.effect('spark', g.x + k * g.half, g.y - 1.1, '#ff5a6e', 0.4, 1.2);
    this.sense({ kind: 'heavy' });
    // He starts only now, after the usual first pause.
    boss.ready = Math.max(boss.ready, t + this.config.rules.enemyInitialDelay);
  },

  /** What a tell needs when it starts: where plates and rows fall, the decoys, the sample mould, the safe cell. */
  fbTell(enemy, tell) {
    const ai = this.fbAI(enemy), p = this.p, t = this.s.time;
    if (!ai) return;
    if (ai.castPatterns?.includes(tell.type)) enemy.tellPose = 'cast'; else enemy.tellPose = null;
    if (tell.type === 'plateDrop') {
      tell.drops = [{ x: p.x, y: p.y }];
      for (let i = 1; i < this.bossRepeat(enemy, 'plates'); i++) { const a = this.random() * TURN; tell.drops.push(this.fbFloor(p.x + Math.cos(a) * ai.plateSpread, p.y + Math.sin(a) * ai.plateSpread * FLOOR_FLAT)); }
    }
    // Three bands that tile the floor from top to bottom with no gap between them, one of them safe (2026-11-10: three
    // 2-unit rows round F2 left room between them, so the safe one never had to be found).
    if (tell.type === 'twoRows') { const safe = Math.floor(this.random() * 3), { top, bottom } = this.fbFloorSpan(), band = (bottom - top) / 3; tell.rows = [0, 1, 2].map(i => ({ y: top + band * (i + 0.5), half: band / 2, safe: i === safe })); }
    if (tell.type === 'decoys') {
      // Three Irises in a row across F2's line of sight; the real one stands at one of them, chosen at random.
      const spots = this.fbDecoySpots(enemy, ai);
      const real = Math.floor(this.random() * 3); Object.assign(enemy, spots[real]); tell.x = enemy.x; tell.y = enemy.y;
      enemy.decoys = spots.filter((_, i) => i !== real).map(s => ({ ...s }));
      // All three face south and burst in alike; only the stamp in her hand tells the real one (2026-11-08).
      tell.angle = Math.PI / 2; enemy.facing = Math.PI / 2;
      for (const s of spots) this.effect('ring', s.x, s.y, '#fff4b7', 0.4, 1.5, { look: 'quake' });
      this.sense({ kind: 'boss', id: 'decoysAppear' });
    }
    if (tell.type === 'finalPress') {
      // Back to the middle of the floor; one cell near the edge stays safe from the full press.
      const { x: ax, y: ay, w, h } = this.fbArena(); enemy.finalDealt = 0;
      Object.assign(enemy, this.fbFloor(ax + w / 2, ay + h / 2 - 1, enemy, enemy.radius)); tell.x = enemy.x; tell.y = enemy.y;
      const a = this.random() * TURN; tell.safe = this.fbFloor(enemy.x + Math.cos(a) * w * 0.38, enemy.y + Math.sin(a) * h * 0.38, enemy, 1.2);
    }
    void t;
  },
  /**
   * Three open spots in a row for Iris and her decoys, all on the floor and apart. Pulled-in spots used to pile up
   * when she stood by a wall, so two of the three stood on one another (2026-11-08). Tries the row across F2's line
   * of sight from where she stands, then turned and shorter rows, then the same from the middle of the floor.
   */
  fbDecoySpots(enemy, ai) {
    const { x: ax, y: ay, w, h } = this.fbArena(), across = angleTo(enemy, this.p) + Math.PI / 2;
    const open = s => !this.map?.walkable || fitsMap(s.x, s.y, 0.6, this.map);
    for (const from of [enemy, { x: ax + w / 2, y: ay + h / 2 }]) for (const scale of [1, 0.8, 0.65]) for (const turn of [0, 0.4, -0.4, 0.8, -0.8, Math.PI / 2]) {
      const a = across + turn, d = ai.decoySpread * scale;
      const spots = [-1, 0, 1].map(k => ({ x: from.x + Math.cos(a) * k * d, y: from.y + Math.sin(a) * k * d * FLOOR_FLAT }));
      if (spots.every(open)) return spots;
    }
    return [-1, 0, 1].map(k => this.fbFloor(ax + w / 2 + k * ai.decoySpread, ay + h / 2, { x: ax + w / 2, y: ay + h / 2 }));
  },
  fbSample() { const pick = list => list[Math.floor(this.random() * list.length)]; return Object.fromEntries(MOLD_FEATURES.map(([k, v]) => [k, pick(v)])); },
  /** Each step: the laser turns after F2, the boss stays put while it is stuck, phase 2's lens inspectors come once. */
  fbStep(enemy, dt) {
    const ai = this.fbAI(enemy), tell = enemy.tell;
    if (!ai) return false;
    if (tell?.type === 'finalPress' && !tell.alarmed && tell.until - this.s.time <= 1.05) { tell.alarmed = true; this.sense({ kind: 'boss', id: 'finalAlarm' }); }
    if (tell?.type === 'irisLaser') tell.angle = tell.angle + wrap(angleTo(tell, this.p) - tell.angle) * Math.min(1, ai.turnDegrees * Math.PI / 180 * dt * 3);
    if (ai.phaseTwoSummon && !enemy.summonedTwo && enemy.breaksDone?.length) {
      enemy.summonedTwo = true;
      // How many lens inspectors join is set by the difficulty (bossRepeats.lensHelpers, 3 to 5): left and right of her,
      // then in front, then the two back corners.
      const helpers = this.bossRepeat(enemy, 'lensHelpers') ?? ai.phaseTwoSummon.count, around = [[-1, 1.5], [1, 1.5], [0, 3.5], [-0.6, -2], [0.6, -2]];
      for (let i = 0; i < helpers; i++) this.fbSummon(ai.phaseTwoSummon.type, enemy, ...around[i % around.length]);
      // Chapter 2 finds its own way (2026-11-09): no word before a pattern, only when it is beaten.
    }
    // Press's valves come out with the gauge; a full gauge starts the burst as soon as he is free.
    if (ai.pressureFrom && enemy.hp <= enemy.maxHp * ai.pressureFrom && !enemy.breaking && !enemy.valvesOut) {
      enemy.valvesOut = true; enemy.pressure ??= 0; const { x: ax, y: ay, w, h } = this.fbArena();
      const valves = [[0.08, 0.15], [0.92, 0.15], [0.08, 0.88], [0.92, 0.88]].map(([u, v]) => ({ ...this.fbFloor(ax + w * u, ay + h * v, enemy), hits: 0, openUntil: 0 }));
      this.fbField({ kind: 'valves', owner: enemy.id, valves });
      // Chapter 2 finds its own way (2026-11-09): no word before a pattern, only when it is beaten. ('압력이 샜습니다!' once a valve lets it out)
    }
    if (ai.pressureFrom && enemy.pressure >= 100 && !enemy.tell && !enemy.breaking && enemy.hp > 0 && this.beginEnemyTell) this.beginEnemyTell(enemy, 'steamBurst');
    return tell?.type === 'finalPress' || tell?.type === 'decoys';
  },
  fbSummon(type, enemy, side, down = 1.5) {
    const spot = this.fbFloor(enemy.x + side * 5, enemy.y + down, enemy), body = this.spawnEnemy(type, spot);
    body.ready = this.s.time + 1; body.summonedAt = this.s.time; this.effect('dodge', spot.x, spot.y, '#e0a03c', 0.4, 1.2); return body;
  },

  /** The bosses' blows. Returns true when the tell was one of theirs. */
  fbExecute(enemy, tell) {
    const ai = this.fbAI(enemy);
    if (!ai) return false;
    // Press below a third: every pattern he finishes pumps his chest gauge up (2026-11-09).
    if (ai.pressureFrom && tell.type !== 'steamBurst' && enemy.hp <= enemy.maxHp * ai.pressureFrom) enemy.pressure = Math.min(100, (enemy.pressure || 0) + ai.pressurePerPattern);
    const p = this.p, t = this.s.time, R = this.config.arena.playerRadius, damage = (k = 1) => this.hurt(Math.round(this.weakened(enemy, enemy.damage * k)));
    const beam = (from, angle, length, width, k = 1, color = '#ff5a6e', look = 'laser') => {
      const end = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
      this.effect('beam', from.x, from.y, color, 0.35, 1, { targetX: end.x, targetY: end.y, look });
      if (!p.dodge && segmentDistance(p, from, end) <= width + R && damage(k)) { this.fbFail(enemy); return true; }
      return false;
    };
    switch (tell.type) {
      // ---- Iris
      case 'irisLaser': beam(tell, tell.angle, ai.laserLength, ai.laserWidth, 1, '#ff5a6e', 'searchlight'); return true;
      case 'rejectStamps': {
        const n = this.bossRepeat(enemy, enemy.hp <= enemy.maxHp * 0.5 ? 'stampCountPhaseTwo' : 'stampCount'), pass = Math.floor(this.random() * n);
        // The first lands on F2; the rest round her, never overlapping one another (2026-11-08).
        const spots = [], apart = ai.stampRadius * 2 + 0.2;
        for (let i = 0; i < n; i++) {
          let at;
          for (let tries = 0; tries < 40; tries++) {
            const a = this.random() * TURN, r = i === 0 ? 0 : apart + this.random() * (1.6 + tries * 0.08);
            at = this.fbFloor(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * FLOOR_FLAT);
            if (spots.every(s => floorDistance(s, at) >= apart)) break;
          }
          spots.push(at);
          this.fbField({ kind: 'stamp', x: at.x, y: at.y, radius: ai.stampRadius, from: t + i * ai.stampGap, at: t + ai.stampWarn + i * ai.stampGap, pass: i === pass, damage: enemy.damage });
        }
        return true;
      }
      case 'verdict': {
        // Not countered in time: the stamp comes down over a wide cone in front.
        if (!p.dodge && inCone(tell, p, tell.angle, ai.verdictRange, ai.verdictDegrees) && damage(1.3)) this.fbFail(enemy);
        this.effect('ring', tell.x, tell.y, '#d86e76', 0.6, ai.verdictRange, { look: 'stampHit' }); return true;
      }
      case 'tapeMeasure': {
        const end = { x: tell.x + Math.cos(tell.angle) * ai.measureLength, y: tell.y + Math.sin(tell.angle) * ai.measureLength };
        this.effect('beam', tell.x, tell.y, '#e0b048', 0.6, 1, { targetX: end.x, targetY: end.y, look: 'measure' });
        if (!p.dodge && segmentDistance(p, tell, end) <= ai.measureWidth + R && damage(0.5)) {
          this.fbFail(enemy);
          // Reeled in to just in front of her, and a stamp follows at once.
          const front = { x: enemy.x + Math.cos(tell.angle) * ai.measureFront, y: enemy.y + Math.sin(tell.angle) * ai.measureFront };
          p.blown = { x: front.x - p.x, y: front.y - p.y, left: 0.3 };
          enemy.followup = { type: 'rejectOne', at: t + 0.45 };
        }
        return true;
      }
      case 'rejectOne': this.fbField({ kind: 'stamp', x: p.x, y: p.y, radius: ai.stampRadius, from: t, at: t + 0.55, pass: false, damage: enemy.damage }); return true;
      case 'decoys': {
        // Not found in time: all three fire.
        for (const from of [enemy, ...(enemy.decoys || [])]) beam(from, angleTo(from, p), ai.laserLength, ai.laserWidth, 0.8, '#ff5a6e', 'searchlight');
        enemy.decoys = null; return true;
      }
      case 'crossLaser': this.fbField({ kind: 'cross', owner: enemy.id, angle: angleTo(enemy, p) + Math.PI / 4, until: t + ai.crossSeconds, next: t }); return true;
      case 'gridCheck': this.fbGrid(enemy, 1); return true;
      // ---- Press
      case 'plateDrop':
        for (const d of tell.drops) this.fbPlate(enemy, d, ai);
        this.sense({ kind: 'burst' }); return true;
      case 'armSlam': {
        const end = { x: tell.x + Math.cos(tell.angle) * ai.armLength, y: tell.y + Math.sin(tell.angle) * ai.armLength };
        if (!p.dodge && segmentDistance(p, tell, end) <= ai.armWidth + R) damage(1.2);
        this.effect('beam', tell.x, tell.y, '#c79a3e', 0.5, 1, { targetX: end.x, targetY: end.y, look: 'thrust' });
        this.effect('ring', end.x, end.y, '#e8e2d2', 0.5, 1.4, { look: 'stampHit' });
        // Stuck in the floor for a moment: the arm's feed shaft shows and blows land harder.
        const stuck = this.bossRepeat(enemy, 'armStuck');
        enemy.armStuck = { until: t + stuck, x: (tell.x + end.x) / 2, y: (tell.y + end.y) / 2 };
        enemy.plantedUntil = t + stuck;
        return true;
      }
      case 'lineShift': this.s.flow = { dir: this.random() < 0.5 ? -1 : 1, flipAt: t + ai.flowFlip, until: t + ai.flowSeconds }; return true;
      case 'callGuards': {
        const living = this.s.enemies.filter(e => e.hp > 0 && e.type === ai.guardType).length;
        for (let i = living; i < this.bossRepeat(enemy, 'guardMax'); i++) this.fbSummon(ai.guardType, enemy, i % 2 ? 1 : -1);
        if (enemy.hp <= enemy.maxHp * 0.33 && ai.phaseThreeExtra) this.fbSummon(ai.phaseThreeExtra, enemy, 0);
        return true;
      }
      case 'twoRows': {
        // A row of press plates slams down the whole width of the floor on each unsafe row (2026-11-08: only a small
        // ring at F2's spot showed before, so nothing seemed to come down).
        const { x: ax, w } = this.fbArena();
        const pressed = tell.rows.filter(row => !row.safe), half = row => row.half ?? ai.rowWidth / 2;
        this.fbField({ kind: 'rowSlam', rows: pressed.map(row => ({ y: row.y, half: half(row) })), ax, w, start: t, until: t + 0.55 });
        for (const row of pressed) {
          for (let x = ax + 1.5; x < ax + w; x += 4) this.effect('ring', x, row.y, '#e8e2d2', 0.4, 1.2, { look: 'quake' });
          if (Math.abs(p.y - row.y) <= half(row) && !p.dodge) damage();
        }
        this.sense({ kind: 'burst' }); return true;
      }
      case 'wallSqueeze': {
        const { x: ax, y: ay, w, h } = this.fbArena(), cx = Math.max(ax + ai.wallLeave + 2, Math.min(ax + w - ai.wallLeave - 2, p.x));
        this.fbField({ kind: 'walls', cx, ax, ay, w, h, start: t, closeAt: t + ai.wallSeconds, until: t + ai.wallSeconds + ai.wallHold, gap: this.bossRepeat(enemy, 'wallGap'), gaps: [{ y: ay + h * 0.3, dir: 1 }, { y: ay + h * 0.7, dir: -1 }], hitNext: 0 });
        // He starts nothing else until the walls have opened again (2026-11-09: the rhythm lanes, next in his list, used to
        // come down while the walls were still closing).
        enemy.ready = Math.max(enemy.ready || 0, t + ai.wallSeconds + ai.wallHold + enemy.recovery);
        return true;
      }
      case 'rhythmPress': {
        // Five lanes down the floor; on each beat of the work signal a press head comes down on some of them (2026-11-09).
        // The lanes tile the floor side to side with no gap between them (2026-11-10: 3.2-unit lanes left room between them,
        // so a press never had to be dodged), so only a lane left out of a beat is safe.
        const { x: ax, y: ay, w, h } = this.fbArena(), n = ai.rhythmLanes, lw = w / n, beat = this.bossRepeat(enemy, 'rhythmBeat');
        const lanes = Array.from({ length: n }, (_, i) => ax + lw * (i + 0.5));
        // Each beat presses lanes picked at random, never the very same set twice running: one a beat on easy, two on normal,
        // three on hard (bossRepeats.rhythmCount), seven beats (2026-11-10: it was one lane a beat sweeping across in order).
        const count = Math.max(1, Math.min(n - 1, this.bossRepeat(enemy, 'rhythmCount') || 1)), order = [];
        for (let i = 0; i < ai.rhythmBeats; i++) {
          let pick;
          do { const lanesLeft = [...Array(n).keys()]; pick = []; for (let k = 0; k < count; k++) pick.push(lanesLeft.splice(Math.floor(this.random() * lanesLeft.length), 1)[0]); pick.sort((a, b) => a - b); }
          while (order.length && pick.join() === order.at(-1).join());
          order.push(pick);
        }
        this.fbField({ kind: 'rhythm', owner: enemy.id, lanes, lw, ay, h, beat, order, start: t + beat, next: 0 });
        enemy.ready = Math.max(enemy.ready || 0, t + beat * (ai.rhythmBeats + 1) + ai.rhythmRest);
        return true; // no word, before or after: chapter 2 finds its own way
      }
      case 'craneGrab':
        // The overhead crane: its shadow follows F2, turns red, and the claw comes down on whatever stands under it.
        this.fbField({ kind: 'crane', owner: enemy.id, x: p.x, y: p.y, phase: 'chase', until: t + ai.craneChase });
        return true; // no word first: chapter 2 finds its own way ('경비가 프레스 위로 떨어졌습니다!' when it works)
      case 'steamBurst': {
        // The gauge is full: steam over the whole floor, safe only beside a valve that stands open.
        const valves = (this.s.bossFields || []).find(f => f.kind === 'valves' && f.owner === enemy.id)?.valves || [];
        const safe = valves.some(v => v.openUntil > t && floorDistance(v, p) < ai.valveRadius);
        if (!safe) { p.invulnerableUntil = 0; this.hurt(this.fbFixed(ai.steamDamage)); }
        enemy.pressure = 0; const { x: ax, y: ay, w, h } = this.fbArena();
        this.effect('ring', ax + w / 2, ay + h / 2, '#f6f2ea', 0.8, Math.max(w, h) * 0.6, { look: 'quake' }); for (const v of valves) this.effect('spark', v.x, v.y - 1, '#f6f2ea', 0.6, 1.5);
        this.sense({ kind: 'heavy' }); return true;
      }
      case 'twinPistons': {
        // Below a third (2026-11-08, was his last shield): two pistons come loose and follow F2 on her left and right,
        // taking turns to slam where she stands. Four wrench blows stop one; stopping both leaves Press reeling.
        const twins = [-1, 1].map(side => ({ ...this.fbFloor(enemy.x + side * ai.twinSide, enemy.y + 1, enemy), side, hits: 0, stoppedAt: null, slam: null }));
        this.fbField({ kind: 'twins', owner: enemy.id, twins, until: t + ai.twinSeconds, nextSlam: t + 1 });
        enemy.ready = Math.max(enemy.ready || 0, t + ai.twinSeconds * 0.5);
        return true; // no word first: chapter 2 finds its own way ('피스톤이 멈췄습니다!' when both stop)
      }
      case 'finalPress': {
        // Not broken in time: the whole floor is pressed, all but the safe cell; a dodge does not help.
        if (floorDistance(p, tell.safe) > 1.2) { p.invulnerableUntil = 0; this.hurt(this.fbFixed(ai.finalDamage)); }
        this.effect('ring', enemy.x, enemy.y, '#a92f2b', 0.8, 12, { look: 'quake' }); this.sense({ kind: 'burst' });
        return true;
      }
      case 'dash2': return false;
    }
    return false;
  },
  /** An Iris beam that hit adds a failing mark; three of them blow up a moment later unless F2 stands on a pass stamp. */
  fbFail(enemy) {
    const ai = this.config.bossAI.inspectorIris, p = this.p, t = this.s.time;
    if (enemy.type !== 'inspectorIris') return;
    p.failStacks = Math.min(ai.failStacks, (p.failUntil > t ? p.failStacks || 0 : 0) + 1); p.failUntil = t + ai.failSeconds;
    if (p.failStacks >= ai.failStacks && !p.failBlastAt) { p.failBlastAt = t + ai.failBlastDelay; this.notify('불합격 표시 3개! 초록 합격 도장 위로 가세요.'); }
  },
  fbPlate(enemy, d, ai) {
    const p = this.p, t = this.s.time, box = { x: d.x, y: d.y, w: ai.plateW, h: ai.plateH };
    if (!p.dodge && inBox(p, box, this.config.arena.playerRadius * 0.5)) this.hurt(this.weakened(enemy, enemy.damage));
    for (const e of this.s.enemies) if (e.hp > 0 && !e.boss && inBox(e, box)) this.hitEnemy(e, enemy.damage * 2, { dot: true });
    (this.s.hazards ??= []).push({ id: this.id('hz'), kind: 'bossPlate', x: d.x, y: d.y, w: ai.plateW, h: ai.plateH, until: t + ai.plateBlock });
    this.effect('ring', d.x, d.y, '#e8e2d2', 1.1, 1.5, { look: 'pressSlam' });
  },
  /**
   * Iris's inspection rings (2026-11-09, were a 3 x 3 grid that sat badly on the round hall): on the hall's middle, a middle disc
   * that always blows and two rings of four pieces each, one piece a ring safe. Shown, then the rest blow; a second
   * round turns every safe piece one place on. `safe[0]` is -1 (the disc is never safe).
   */
  fbGrid(enemy, round, safe) {
    const ai = this.fbAI(enemy), t = this.s.time, place = this.fbGridPlace();
    // A safe piece is always one F2 can stand in: part of it lies on the floor (near a wall some pieces do not).
    const open = this.fbGridOpen(place);
    safe ??= [-1, ...[1, 2].map(k => open[k][Math.floor(this.random() * open[k].length)] ?? 0)];
    // The safe pieces can be across the hall, so the rings show gridReach seconds longer than the old small ones did.
    const show = t + this.bossRepeat(enemy, 'gridShow') + (ai.gridReach || 0);
    this.fbField({ kind: 'grid', owner: enemy.id, ...place, safe, round, show, at: show + ai.gridDelay, damage: this.fbFixed(ai.gridDamage) });
  },
  /** Where the rings sit: the middle of the hall's floor, the outer ring reaching its farthest point (in ring measure). */
  fbGridPlace() {
    const { x, y, w, h } = this.fbArena(), floor = this.map?.walkable?.filter(([px]) => px >= x && px <= x + w);
    const xs = floor?.length ? floor.map(pt => pt[0]) : [x, x + w], ys = floor?.length ? floor.map(pt => pt[1]) : [y, y + h];
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const reach = Math.max(...xs.map((px, i) => Math.hypot(px - cx, (ys[i] - cy) / FLOOR_FLAT))) + 0.5;
    return { cx, cy, radii: GRID_SHARES.map(k => +(k * reach).toFixed(2)), sectors: GRID_SECTORS, cover: true };
  },
  fbMolds(enemy, sample, round, brk = false) {
    const ai = this.fbAI(enemy), p = this.p, t = this.s.time;
    // One mould just like the sample; every other one is the sample's mirror image (user's choice, 2026-11-10: it used
    // to be one mirror image and the rest other toys, which a glance told apart), so the hunt is which way it faces.
    const shapes = Array.from({ length: this.bossRepeat(enemy, 'moldCount') }, (_, i) => (i ? { ...sample, flip: !sample.flip } : { ...sample, same: true }));
    // Every mould on open floor, clear of Press's body and of the other moulds (2026-11-09: some lay under him, off the
    // floor or on top of one another, so the right one could not be stood on). Round F2 first, then anywhere on the floor.
    const molds = [], { x: ax, y: ay, w, h } = this.fbArena(), apart = ai.moldRadius * 2.6;
    const good = at => (!this.map?.walkable || fitsMap(at.x, at.y, 0.6, this.map)) && distance(at, enemy) > (enemy.radius || 1) + ai.moldRadius + 0.6 && molds.every(m => distance(m, at) >= apart);
    for (const shape of shapes) {
      let spot = null;
      for (let tries = 0; tries < 60 && !spot; tries++) {
        const a = this.random() * TURN, r = 1.5 + this.random() * (ai.moldSpread + tries * 0.05), at = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * FLOOR_FLAT };
        if (good(at)) spot = at;
      }
      for (let tries = 0; tries < 200 && !spot; tries++) { const at = { x: ax + 1 + this.random() * (w - 2), y: ay + 1 + this.random() * (h - 2) }; if (good(at)) spot = at; }
      molds.push({ ...(spot || this.fbFloor(p.x, p.y)), shape });
    }
    this.fbField({ kind: 'molds', owner: enemy.id, sample, molds, round, brk, at: t + ai.moldChoose });
  },
  /** A blow landing on a boss: a counter, finding the real Iris, pressure let out of Press. */
  fbHit(enemy, amount, options) {
    const ai = this.fbAI(enemy), tell = enemy.tell, t = this.s.time;
    // Hard blows let some of Press's pressure out: each 1% of his health takes `pressureCut`% off the gauge.
    if (ai?.pressureFrom && enemy.pressure > 0 && !options.dot && tell?.type !== 'steamBurst') enemy.pressure = Math.max(0, enemy.pressure - amount / enemy.maxHp * 100 * ai.pressureCut);
    if (!ai || !tell) return;
    if (tell.type === 'verdict' && options.basic && t >= tell.until - this.bossRepeat(enemy, 'verdictWindow')) {
      enemy.tell = null; enemy.state = 'recover'; enemy.exposedUntil = t + ai.verdictStun; enemy.ready = t + ai.verdictStun + 0.4;
      this.effect('ring', enemy.x, enemy.y, '#7fd8f0', 0.5, 2, { look: 'shieldBreak' }); this.notify('반격 성공! 검수 판정이 깨졌습니다.'); this.sense({ kind: 'heavy' });
    }
    if (tell.type === 'decoys' && !options.dot) {
      enemy.tell = null; enemy.state = 'recover'; enemy.decoys = null; enemy.ready = t + 1.2;
      this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.5, 2.5, { look: 'shieldBreak' }); this.notify('진짜를 찾았습니다! 분신이 깨졌습니다.');
    }
    if (tell.type === 'finalPress') {
      enemy.finalDealt = (enemy.finalDealt || 0) + amount;
      if (enemy.finalDealt >= enemy.maxHp * ai.finalNeed) {
        enemy.tell = null; enemy.state = 'recover'; enemy.exposedUntil = t + ai.finalStun; enemy.ready = t + ai.finalStun + 1;
        this.effect('ring', enemy.x, enemy.y, '#ffd257', 0.8, 3, { look: 'shieldBreak' }); this.notify('압력이 샜습니다! 마무리 압축을 막았습니다.');
      }
    }
  },
  /** Fields and the floor flow, each frame (from tickBossHazards). */
  tickFactoryBoss(dt) {
    this.fbHallGates();
    const s = this.s, p = this.p, t = s.time, R = this.config.arena.playerRadius;
    // The whole line runs one way, flips halfway, and stops.
    if (s.flow) {
      const ai = this.config.bossAI.directorPress;
      if (t >= s.flow.flipAt && !s.flow.flipped) { s.flow.flipped = true; s.flow.dir *= -1; }
      if (t >= s.flow.until || !s.enemies.some(e => e.boss && e.hp > 0)) s.flow = null;
      else { const step = s.flow.dir * ai.flowSpeed * dt; if (!p.dodge && !p.grabbed) this.move(p, step, 0); for (const e of s.enemies) if (e.hp > 0 && !e.boss) this.move(e, step, 0); }
    }
    // Iris's failing marks: wiped on a pass stamp, blown when the delay runs out.
    if (p.failStacks) {
      if (this.patchUnder?.(p, 'pass')) { p.failStacks = 0; p.failBlastAt = 0; this.effect('spark', p.x, p.y - 0.6, '#7fe0a0', 0.5, 1); }
      else if (p.failBlastAt && t >= p.failBlastAt) { p.failStacks = 0; p.failBlastAt = 0; p.invulnerableUntil = 0; this.hurt(this.fbFixed(this.config.bossAI.inspectorIris.failBlast)); this.effect('ring', p.x, p.y, '#d8423c', 0.6, 1.6, { look: 'failBlast' }); }
      else if (!(p.failUntil > t)) { p.failStacks = 0; p.failBlastAt = 0; }
    }
    for (const h of s.hazards || []) if (h.kind === 'bossPlate' && t >= h.until) h.gone = true;
    for (const f of s.bossFields || []) {
      const owner = s.enemies.find(e => e.id === f.owner);
      if (f.kind === 'rowSlam') { if (t >= f.until) f.done = true; continue; }
      if (f.kind === 'stamp' && t >= f.at) {
        f.done = true; this.sense({ kind: 'boss', id: 'stampLand' });
        if (f.pass) this.addPatch({ look: 'pass', x: f.x, y: f.y, radius: this.config.bossAI.inspectorIris.passRadius, duration: this.config.bossAI.inspectorIris.passSeconds });
        else {
          // Every blow of Iris's that lands leaves a failing mark, her stamps and grid included (2026-11-08).
          if (!p.dodge && floorDistance(f, p) < f.radius + R * 0.5 && this.hurt(f.damage)) this.fbFail(IRIS);
          // Her reject mark: stepped on, it pins one failing tag and goes (2026-11-09, `once`: factory-mobs.js tickPatches).
          this.addPatch({ look: 'stamp', x: f.x, y: f.y, radius: f.radius * 0.85, duration: this.config.bossAI.inspectorIris.markSeconds, slow: this.config.bossAI.inspectorIris.markSlow, once: true, failFor: 'inspectorIris' });
        }
        this.effect('ring', f.x, f.y, f.pass ? '#7fe0a0' : '#e8e2d2', 0.4, f.radius, { look: 'stampHit' });
      }
      if (f.kind === 'cross') {
        const ai = this.config.bossAI.inspectorIris;
        if (!owner || owner.hp <= 0 || t >= f.until) { f.done = true; continue; }
        f.angle += ai.crossTurnDegrees * Math.PI / 180 * dt; f.x = owner.x; f.y = owner.y;
        for (let k = 0; k < 4; k++) {
          const a = f.angle + k * Math.PI / 2, end = { x: owner.x + Math.cos(a) * ai.crossLength, y: owner.y + Math.sin(a) * ai.crossLength };
          if (!p.dodge && t >= (p.crossNext || 0) && segmentDistance(p, owner, end) <= ai.crossWidth + R && this.hurt(Math.round(this.weakened(owner, owner.damage * 0.6)))) { p.crossNext = t + 0.5; this.fbFail(owner); }
        }
      }
      if (f.kind === 'grid' && t >= f.at) {
        f.done = true;
        const cell = gridCell(f, p);
        // Outside the rings blows too when they cover the hall (`cover`): only a safe piece is safe.
        if ((cell ? cell.ring === 0 || f.safe[cell.ring] !== cell.sector : f.cover) && !p.dodge && this.hurt(f.damage)) this.fbFail(IRIS);
        this.effect('ring', f.cx, f.cy, '#d8423c', 0.3, f.radii[0], { look: 'boom' }); this.sense({ kind: 'boss', id: 'gridBlow' });
        for (let k = 1; k < f.radii.length; k++) for (let s = 0; s < f.sectors; s++) if (f.safe[k] !== s) { const a = GRID_TURN + (s + 0.5) * TURN / f.sectors, r = (f.radii[k - 1] + f.radii[k]) / 2; this.effect('ring', f.cx + Math.cos(a) * r, f.cy + Math.sin(a) * r * FLOOR_FLAT, '#d8423c', 0.3, Math.max(1.1, (f.radii[k] - f.radii[k - 1]) * 0.3), { look: 'boom' }); }
        if (f.round < 2 && owner && owner.hp > 0) this.fbGridAgain(owner, f);
      }
      if (f.kind === 'walls') {
        const ai = this.config.bossAI.directorPress, u = Math.min(1, (t - f.start) / (f.closeAt - f.start)), ax = f.ax || 0, ay = f.ay || 0, far = ax + f.w;
        const left = ax + (f.cx - ai.wallLeave / 2 - ax) * u, right = far - (far - (f.cx + ai.wallLeave / 2)) * u;
        f.left = left; f.right = right;
        const size = f.gap || ai.wallGap;
        for (const g of f.gaps) { g.y += g.dir * ai.wallGapSpeed * dt; if (g.y < ay + size / 2 || g.y > ay + f.h - size / 2) g.dir *= -1; }
        const inGap = (gap, body = p) => Math.abs(body.y - gap.y) <= size / 2;
        // The walls shove every body ahead of them, Press and his crew included (2026-11-09): nobody is ever drawn standing on
        // a wall. Each is kept clear of the leading edge by most of its radius; one in a wall's green opening is let be.
        for (const e of this.s.enemies) {
          if (e.hp <= 0) continue;
          const r = (e.radius || 0.5) * 0.8, lo = left + r, hi = right - r;
          if (e.x < lo && !inGap(f.gaps[0], e)) e.x = lo > hi ? (left + right) / 2 : lo;
          else if (e.x > hi && !inGap(f.gaps[1], e)) e.x = lo > hi ? (left + right) / 2 : hi;
        }
        const caught = (p.x < left && !inGap(f.gaps[0])) || (p.x > right && !inGap(f.gaps[1]));
        if (caught && !p.dodge && t >= f.hitNext && this.hurt(this.fbFixed(ai.wallDamage))) { f.hitNext = t + 0.8; p.blown = { x: (p.x < left ? 1 : -1) * ai.wallPush, y: 0, left: 0.25 }; }
        if (t >= f.until) f.done = true;
      }
      if (f.kind === 'molds' && t >= f.at) {
        const ai = this.config.bossAI.directorPress;
        f.done = true;
        // In the shield break (from 2026-11-08) a round only counts while that break is still up.
        const brk = f.brk && owner?.breaking?.kind === 'molds' && owner.breaking.failAt === null ? owner.breaking : null;
        if (f.brk && !brk) continue;
        const safe = f.molds.find(m => m.shape.same && floorDistance(m, p) < ai.moldRadius);
        this.sense({ kind: 'boss', id: safe ? 'moldOk' : 'moldNo' });
        if (!safe) { p.invulnerableUntil = 0; this.hurt(this.fbFixed(ai.moldDamage)); p.heldUntil = t + ai.moldStun; this.effect('ring', p.x, p.y, '#a92f2b', 0.5, 1.4, { look: 'quake' }); }
        else { this.effect('spark', p.x, p.y - 0.6, '#7fe0a0', 0.5, 1); if (brk) { brk.matched++; this.sense({ kind: 'heavy' }); } }
        if (brk) this.notify(safe ? `일치! (${brk.matched}/${this.breakRule(owner, brk.index).need})` : '불일치! 견본과 똑같은 거푸집 위에 서세요.');
        if (brk) { if (brk.matched < this.breakRule(owner, brk.index).need) { owner.fbSample = this.fbSample(); this.fbField({ kind: 'sample', owner: owner.id, sample: owner.fbSample, round: f.round + 1, brk: true, until: t + 1.2 }); } }
      }
      if (f.kind === 'sample' && f.brk && owner?.breaking?.kind !== 'molds') { f.done = true; continue; }
      if (f.kind === 'sample' && t >= f.until) { f.done = true; if (owner && owner.hp > 0) this.fbMolds(owner, f.sample, f.round, !!f.brk); }
      if (f.kind === 'twins') { this.fbTwinsStep(f, owner, dt); if (!this.active) return; }
      if (f.kind === 'rhythm') { this.fbRhythmStep(f, owner); if (!this.active) return; }
      if (f.kind === 'crane') { this.fbCraneStep(f, owner, dt); if (!this.active) return; }
      if (f.kind === 'valves' && (!owner || owner.hp <= 0)) f.done = true;
      if (!this.active) return;
    }
    if (s.bossFields) s.bossFields = s.bossFields.filter(f => !f.done);
  },
  /** For each ring, the pieces whose middle lies on open floor. */
  fbGridOpen(f) {
    // A piece counts as open when any of a few spots across it is floor: big rings run past the walls at the hall's ends.
    const spots = [0.25, 0.5, 0.75], turns = [0.2, 0.35, 0.5, 0.65, 0.8];
    return f.radii.map((r, k) => k === 0 ? [] : Array.from({ length: f.sectors }, (_, s) => s).filter(s => !this.map?.walkable || spots.some(u => turns.some(v => { const a = GRID_TURN + (s + v) * TURN / f.sectors, rr = f.radii[k - 1] + (r - f.radii[k - 1]) * u; return fitsMap(f.cx + Math.cos(a) * rr, f.cy + Math.sin(a) * rr * FLOOR_FLAT, 0.5, this.map); }))));
  },
  fbGridAgain(owner, f) {
    // The same rings, every safe piece turned one place on: remember it, then move.
    const ai = this.fbAI(owner), t = this.s.time;
    const open = this.fbGridOpen(f), turned = f.safe.map((s, k) => { if (s < 0) return s; for (let i = 1; i <= f.sectors; i++) { const n = (s + i) % f.sectors; if (open[k].includes(n)) return n; } return (s + 1) % f.sectors; });
    const show = t + this.bossRepeat(owner, 'gridShow') * 0.6 + (ai.gridReach || 0);
    this.fbField({ ...f, id: this.id('field'), done: false, safe: turned, round: f.round + 1, show, at: show + ai.gridDelay });
  },

  // ---- phase breaks (chapter 2 names the shield the first time, and says how to break it only after it has once failed)
  fbBreakStart(enemy, b, rule) {
    const p = this.p, t = this.s.time;
    if (b.kind === 'mirrors') {
      b.sweep = angleTo(enemy, p); b.mirrors = [0, 1, 2].slice(0, rule.mirrors).map(i => { const a = b.sweep + Math.PI + (i - 1) * 2.1; return { ...this.fbFloor(enemy.x + Math.cos(a) * rule.mirrorReach, enemy.y + Math.sin(a) * rule.mirrorReach * FLOOR_FLAT, enemy), aimed: false, lit: false }; });
      this.notify(enemy.breakFailed?.mirrors ? '보호막! 거울판을 렌치로 쳐서 45도씩 돌려 아이리스 쪽을 보게 하세요.' : BREAK_FIRST.mirrors);
      // Each mirror faces one of eight ways, never Iris to begin with; every wrench blow turns it 45 degrees (2026-11-09).
      for (const m of b.mirrors) { const want = mirrorDir(m, enemy); m.dir = (want + 2 + Math.floor(this.random() * 5)) % 8; }
    }
    if (b.kind === 'pylons') {
      const { x: ax, y: ay, w, h } = this.fbArena();
      b.pylons = [[0.2, 0.25], [0.8, 0.25], [0.2, 0.8], [0.8, 0.8]].slice(0, rule.pylons).map(([u, v]) => ({ ...this.fbFloor(ax + w * u, ay + h * v, enemy), broken: false }));
      b.plates = []; b.nextPlate = t + 1;
      this.notify(enemy.breakFailed?.pylons ? `보호막! 압착판이 전력 기둥 위로 떨어지게 해서 기둥을 부수세요(${rule.need}개).` : BREAK_FIRST.pylons);
    }
    if (b.kind === 'molds') {
      // Press's last shield (2026-11-08): match the sample shown over F2 by standing in the same mould, `need` times.
      b.matched = 0; enemy.fbSample = this.fbSample();
      this.fbField({ kind: 'sample', owner: enemy.id, sample: enemy.fbSample, round: 1, brk: true, until: t + 1.2 });
      this.notify(enemy.breakFailed?.molds ? `보호막! 머리 위 견본과 똑같은 거푸집 위에 서세요(${rule.need}번).` : BREAK_FIRST.molds);
    }
  },
  fbBreak(enemy, rule, dt) {
    const b = enemy.breaking, p = this.p, t = this.s.time, R = this.config.arena.playerRadius;
    if (b.kind === 'molds') b.solved = b.matched >= rule.need;
    if (b.kind === 'mirrors') {
      const prev = b.sweep; b.sweep += rule.sweepDegrees * Math.PI / 180 * dt;
      const end = { x: enemy.x + Math.cos(b.sweep) * 14, y: enemy.y + Math.sin(b.sweep) * 14 };
      if (!p.dodge && t >= (b.hitNext || 0) && segmentDistance(p, enemy, end) <= rule.beamWidth + R && this.hurt(this.fbFixed(rule.beamDamage))) b.hitNext = t + 0.6;
      // An aimed mirror the light passes over sends it back into the lens.
      for (const m of b.mirrors) {
        m.aimed = m.dir === undefined ? m.aimed : m.dir === mirrorDir(m, enemy);
        const a = angleTo(enemy, m), crossed = Math.abs(wrap(a - prev)) + Math.abs(wrap(b.sweep - a)) <= Math.abs(b.sweep - prev) + 1e-6;
        if (m.aimed && !m.lit && crossed) { m.lit = true; this.sense({ kind: 'boss', id: 'mirrorLit' }); this.effect('beam', m.x, m.y, '#ffe58a', 0.6, 1, { targetX: enemy.x, targetY: enemy.y - 1, look: 'laser' }); this.effect('spark', enemy.x, enemy.y - 1.2, '#fff4b7', 0.5, 1.2); this.sense({ kind: 'heavy' }); }
      }
      b.solved = b.mirrors.every(m => m.lit);
    }
    if (b.kind === 'pylons') {
      if (t >= b.nextPlate) { b.plates.push({ x: p.x, y: p.y, at: t + rule.plateWarn }); b.nextPlate = t + rule.plateEvery; }
      const ai = this.config.bossAI.directorPress;
      for (const plate of b.plates) if (!plate.done && t >= plate.at) {
        plate.done = true; this.sense({ kind: 'boss', id: 'plateDrop' }); const box = { x: plate.x, y: plate.y, w: ai.plateW, h: ai.plateH };
        if (!p.dodge && inBox(p, box, R * 0.5)) this.hurt(this.weakened(enemy, enemy.damage));
        for (const py of b.pylons) if (!py.broken && inBox(py, box, rule.pylonRadius)) { py.broken = true; this.effect('scrap', py.x, py.y, '#ffbe20', 0.6, 1.2); this.sense({ kind: 'heavy' }); }
        this.effect('ring', plate.x, plate.y, '#e8e2d2', 1.1, 1.5, { look: 'pressSlam' });
        if (!this.active) return;
      }
      b.plates = b.plates.filter(pl => !pl.done);
      b.solved = b.pylons.filter(py => py.broken).length >= rule.need;
    }
  },
  /** Each beat its lanes are pressed (`order`, one list a beat); the next beat's lanes blink a beat early. After the last, Press stops for breath. */
  fbRhythmStep(f, owner) {
    const ai = this.config.bossAI.directorPress, p = this.p, t = this.s.time;
    if (!owner || owner.hp <= 0 || owner.breaking) { f.done = true; return; }
    while (f.next < f.order.length && t >= f.start + f.next * f.beat) {
      const hit = [].concat(f.order[f.next]); // a field saved before 2026-11-10 holds one lane number a beat
      for (const i of hit) {
        const x = f.lanes[i];
        if (!p.dodge && Math.abs(p.x - x) <= f.lw / 2 && p.y >= f.ay && p.y <= f.ay + f.h) this.hurt(this.fbFixed(ai.rhythmDamage));
        for (let y = f.ay + 1.2; y < f.ay + f.h; y += 3) this.effect('ring', x, y, '#e8e2d2', 0.3, 0.9, { look: 'quake' });
        if (!this.active) return;
      }
      f.lastHit = hit; f.lastAt = t; f.next++; this.sense({ kind: 'boss', id: 'rhythmBeat' });
    }
    if (f.next >= f.order.length && t >= f.start + f.order.length * f.beat) {
      // The lines simply stop; no word when they are crossed (user's choice, 2026-11-09).
      f.done = true;
    }
  },
  /**
   * The overhead crane. chase: the shadow follows F2. warn: it stops and reddens. Then the claw drops: F2 under it is
   * carried to Press and stamped (a skill locked for a while) unless she dodges out three times; a guard under it is
   * carried there instead and dropped on him, and he reels.
   */
  fbCraneStep(f, owner, dt) {
    const ai = this.config.bossAI.directorPress, p = this.p, t = this.s.time, R = this.config.arena.playerRadius;
    if (!owner || owner.hp <= 0) { if (f.carry === 'f2') p.grabbed = null; f.done = true; return; }
    if (f.phase === 'chase') {
      const a = angleTo(f, p), d = distance(f, p), step = Math.min(d, ai.craneSpeed * dt); f.x += Math.cos(a) * step; f.y += Math.sin(a) * step;
      if (t >= f.until) { f.phase = 'warn'; f.dropAt = t + ai.craneWarn; this.sense({ kind: 'boss', id: 'craneDrop' }); }
      return;
    }
    if (f.phase === 'warn') {
      if (t < f.dropAt) return;
      const guard = this.s.enemies.find(e => !e.boss && e.hp > 0 && floorDistance(e, f) < ai.craneRadius + (e.radius || 0.4));
      this.effect('ring', f.x, f.y, '#e8e2d2', 1.1, ai.craneRadius, { look: 'pressSlam' });
      if (guard) { f.carry = guard.id; guard.held = true; }
      else if (!p.dodge && !p.grabbed && floorDistance(p, f) < ai.craneRadius + R * 0.5) { f.carry = 'f2'; f.escapes = 0; p.grabbed = { by: 'crane', crane: true, angle: 0, until: t + 99 }; this.notify('집게에 잡혔습니다! 회피를 3번 눌러 빠져나오세요.'); }
      else { f.done = true; return; }
      f.phase = 'carry'; f.from = { x: f.x, y: f.y }; f.carryAt = t; this.sense({ kind: 'heavy' });
    }
    if (f.phase === 'carry') {
      const to = { x: owner.x, y: owner.y + 1.8 }, k = Math.min(1, (t - f.carryAt) / ai.craneCarry);
      f.x = f.from.x + (to.x - f.from.x) * k; f.y = f.from.y + (to.y - f.from.y) * k;
      if (f.carry === 'f2') {
        if (!p.grabbed?.crane) { f.done = true; return; }
        // Each dodge pressed while held is a wriggle; the third one is free.
        if (p.dodge && p.dodge !== f.seenDodge) { f.seenDodge = p.dodge; f.escapes++; this.effect('spark', p.x, p.y - 0.6, '#ffd257', 0.25, 0.7); if (f.escapes >= ai.craneEscape) { p.grabbed = null; f.done = true; this.notify('빠져나왔습니다!'); return; } p.dodge = null; p.dodgeReady = t; }
        p.x = f.x; p.y = f.y;
        if (t >= f.carryAt + ai.craneCarry + ai.craneHold) {
          p.grabbed = null; f.done = true; p.invulnerableUntil = 0; this.hurt(this.fbFixed(ai.craneDamage));
          const slots = this.skillSlots || [];
          if (slots.length) { const index = Math.floor(this.random() * slots.length); p.confiscated = { index, until: t + ai.craneLock }; this.notify(`규격 검사! ${josa(slots[index].skill.name, '이', '가')} ${ai.craneLock}초 동안 잠깁니다.`); }
          this.effect('ring', p.x, p.y, '#a92f2b', 0.5, 1.4, { look: 'stampHit' });
        }
        return;
      }
      const guard = this.s.enemies.find(e => e.id === f.carry);
      if (!guard || guard.hp <= 0) { f.done = true; return; }
      guard.x = f.x; guard.y = f.y;
      if (k >= 1) {
        f.done = true; guard.hp = 0; guard.held = false; this.effect('scrap', owner.x, owner.y - 1, '#c79a3e', 0.6, 1.4);
        owner.tell = null; owner.state = 'recover'; owner.exposedUntil = t + ai.craneStun; owner.ready = Math.max(owner.ready || 0, t + ai.craneStun + 0.4);
        this.notify('경비가 프레스 위로 떨어졌습니다! 프레스가 휘청입니다.'); this.sense({ kind: 'heavy' });
      }
    }
  },
  /** Twin pistons left by Press's pattern: follow F2 on her two sides, take turns to slam her spot; both stopped, he reels. */
  fbTwinsStep(f, owner, dt) {
    const ai = this.config.bossAI.directorPress, p = this.p, t = this.s.time, R = this.config.arena.playerRadius;
    if (!owner || owner.hp <= 0 || owner.breaking || t >= f.until) { f.done = true; return; }
    for (const tw of f.twins) {
      if (tw.stoppedAt === null) { const goal = { x: p.x + tw.side * ai.twinSide, y: p.y }, a = angleTo(tw, goal), d = distance(tw, goal); if (d > 0.4) { const step = Math.min(d, ai.twinSpeed * dt); this.move(tw, Math.cos(a) * step, Math.sin(a) * step, 0.8); } }
      if (tw.slam && t >= tw.slam.at) { this.sense({ kind: 'boss', id: 'twinSlam' }); if (!p.dodge && floorDistance(tw.slam, p) < ai.twinSlamRadius + R * 0.5) this.hurt(this.weakened(owner, owner.damage)); this.effect('ring', tw.slam.x, tw.slam.y, '#e8e2d2', 1.1, ai.twinSlamRadius, { look: 'pressSlam' }); tw.slam = null; if (!this.active) return; }
    }
    if (t >= f.nextSlam) { const free = f.twins.filter(tw => tw.stoppedAt === null && !tw.slam), tw = free[Math.floor(this.random() * free.length)]; if (tw) tw.slam = { x: p.x, y: p.y, at: t + ai.twinSlamWarn }; f.nextSlam = t + ai.twinSlamEvery; }
    if (f.twins.every(tw => tw.stoppedAt !== null)) {
      f.done = true; owner.tell = null; owner.state = 'recover'; owner.exposedUntil = t + ai.twinStun; owner.ready = Math.max(owner.ready || 0, t + ai.twinStun + 0.4);
      this.effect('ring', owner.x, owner.y, '#ffd257', 0.6, 2.5, { look: 'shieldBreak' }); this.notify('피스톤이 멈췄습니다! 프레스가 휘청입니다.'); this.sense({ kind: 'heavy' });
    }
  },
  /** A wrench swing on what a factory boss puts out: a decoy pops, a mirror turns, a twin piston takes a blow. */
  fbSwing(a, range) {
    const reach = target => inCone(this.p, target, a.angle, range + 0.4, this.config.rules.comboArcDegrees);
    for (const f of this.s.bossFields || []) if (f.kind === 'valves') {
      const ai = this.config.bossAI.directorPress, owner = this.s.enemies.find(e => e.id === f.owner);
      for (const v of f.valves) if (!(v.openUntil > this.s.time) && reach(v) && !(v.hitAt > this.s.time - 0.15)) {
        v.hitAt = this.s.time; v.hits++; this.effect('spark', v.x, v.y - 0.8, '#c79a3e', 0.25, 0.7); this.sense({ kind: 'hit' });
        if (v.hits >= ai.valveHits) { v.hits = 0; v.openUntil = this.s.time + (owner ? this.bossRepeat(owner, 'valveOpen') : ai.valveOpen); this.effect('ring', v.x, v.y, '#7fe0a0', 0.4, ai.valveRadius, { look: 'shieldBreak' }); }
      }
    }
    for (const f of this.s.bossFields || []) if (f.kind === 'twins') {
      const ai = this.config.bossAI.directorPress;
      for (const tw of f.twins) if (tw.stoppedAt === null && reach(tw) && !(tw.hitAt > this.s.time - 0.15)) {
        tw.hitAt = this.s.time; tw.hits++; this.effect('spark', tw.x, tw.y - 0.8, '#ff9a3c', 0.25, 0.7); this.sense({ kind: 'hit' });
        if (tw.hits >= ai.twinHits) { tw.stoppedAt = this.s.time; tw.slam = null; this.effect('ring', tw.x, tw.y, '#ffd257', 0.4, 1.2, { look: 'shieldBreak' }); }
      }
    }
    for (const enemy of this.s.enemies) {
      // Striking a decoy pops it and stuns F2 for a moment (2026-11-09): no step, swing, dodge or skill for decoyStun seconds.
      if (enemy.decoys) for (const d of enemy.decoys) if (!d.popped && reach(d)) {
        d.popped = true; this.effect('spark', d.x, d.y - 1, '#cfe9f2', 0.3, 1);
        const stun = this.config.bossAI.inspectorIris.decoyStun || 0;
        if (stun) { const p = this.p, until = this.s.time + stun; p.stunUntil = Math.max(p.stunUntil || 0, until); p.heldUntil = Math.max(p.heldUntil || 0, until); p.attack = null; this.effect('ring', p.x, p.y, '#cfe9f2', 0.35, 1, { look: 'quake' }); this.sense({ kind: 'heavy' }); }
      }
      const b = enemy.breaking; if (!b) continue;
      for (const m of b.mirrors || []) if (!m.lit && reach(m) && !(m.turnedAt > this.s.time - 0.15)) {
        this.sense({ kind: 'boss', id: 'mirrorTurn' }); m.from = (m.dir ?? 0) * Math.PI / 4; m.dir = ((m.dir ?? 0) + 1) % 8; m.turnedAt = this.s.time; m.aimed = m.dir === mirrorDir(m, enemy); if (m.aimed) m.aimedAt = this.s.time;
        this.effect('spark', m.x, m.y - 0.6, m.aimed ? '#7fe0a0' : '#ffe58a', 0.3, 0.8); this.sense({ kind: 'hit' });
      }
    }
  },
};
