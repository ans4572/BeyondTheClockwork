// What Belgard puts in the room, drawn in code (src/engine/bell-boss.js): his warnings, the one slash arc and the one
// floor crack every direction shares (the bursts PixelLab drew were taken out of his clips, 2026-11-16), the toll's
// rings, the bell weight, the falling bell, phase 2's cyan afterimages and crescent, the phantom sword, the sword rain,
// Orden's needles, the last toll's planted sword and its shadow, and the forged orders of his shield. Installed on
// CanvasRenderer.prototype, so `this` is the renderer; the floor parts come from drawClockBossFloor, the rest from drawClockBossOver and drawClockTell.
import { FLOOR_FLAT } from '../engine/math.js';
import { FX } from './fx-sprites.js';

const TAU = Math.PI * 2, RED = '#e0303c', TOLL_RED = '#a3121f', CREAM = '#f3e6c4', CYAN = '#5fe3ff', BRONZE = '#c99a3a', INK = '#2b3345', SAFE = '#2fae63';
const ellipse = (c, x, y, r) => { c.beginPath(); c.ellipse(x, y, r * 20, r * 20 * FLOOR_FLAT, 0, 0, TAU); };
/** The visor slit, from the clip's anchor in sheet pixels, for the directions that show his face (west mirrors east). */
const SLIT = { south: [-4, -98], 'south-east': [4, -98], east: [11, -98], 'south-west': [-4, -98], west: [-11, -98] };
/** Each forged-orders break's pillars, front to back as they are drawn (they never move; worked out once, 2026-11-21). */
const PILLAR_ORDER = new WeakMap();

export const bellBossDraw = {
  /**
   * A red lane on the floor from (x, y) px along screen heading `angle`: from `from` to `from + len` px along it, `half`
   * px either side, washed at `alpha` (2026-11-21: the same turn, box and wash written out seven times).
   */
  dangerLane(x, y, angle, from, len, half, alpha) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(angle); c.beginPath(); c.rect(from, -half, len, half * 2); this.dangerWash(alpha); c.restore();
  },
  /** A dark shadow on the floor under something up in the air: `r` px round (x, y), squashed as the floor is. */
  floorShadow(x, y, r, alpha) {
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.fillStyle = '#10141c'; c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU); c.fill(); c.restore();
  },
  /** His warnings (from drawClockTell): the cut's reach, the slam and its wave, the grab, the cracks, the rings, the bell. */
  drawBellTell(enemy, tell, { box, sector, ring, x, y, progress = 0 }) {
    const g = this.game, c = this.ctx, ai = g.config.bossAI.bellguard, R = g.config.arena.playerRadius;
    switch (tell.type) {
      // The first two cuts: their reach from where his short step in will take him (bgTell fixed it).
      case 'bgCombo': case 'bgCombo2': { const step = (tell.step ?? 0) * 20; c.translate(Math.cos(tell.angle) * step, Math.sin(tell.angle) * step); sector(ai.comboRange, ai.comboDegrees); break; }
      // The lunge: the reach drawn from where his step will take him (bgTell fixed it), with the step itself as a lane.
      case 'bgCombo3': {
        const step = (tell.step ?? ai.comboLastStep) * 20;
        this.dangerLane(x, y, tell.angle, 0, step, (enemy.radius + R) * 20, 0.35 + 0.4 * progress);
        c.translate(Math.cos(tell.angle) * step, Math.sin(tell.angle) * step); sector(ai.comboLastRange, ai.comboLastDegrees);
        break;
      }
      // The punch: its reach from where his step in will take him (bgTell fixed it), as the cuts' are.
      case 'bgPunch': { const step = (tell.step ?? 0) * 20; c.translate(Math.cos(tell.angle) * step, Math.sin(tell.angle) * step); sector(ai.punchReach, ai.punchDegrees); break; }
      // The great sweep's fan: as far and as wide as the crescent of blade light will fly.
      case 'bgCrescent': sector(ai.crescentRange, ai.crescentDegrees); break;
      case 'bgPendulum': { const p = g.p; c.beginPath(); c.rect(-4000, (p.y - ai.pendulumRadius * FLOOR_FLAT - 0.2) * 20, 8000, (ai.pendulumRadius * FLOOR_FLAT * 2 + 0.4) * 20); this.dangerWash(0.2 + 0.3 * progress); break; }
      case 'bgSpin': ring(x, y, ai.spinRadius); break;
      case 'bgSlam': {
        ring(x + Math.cos(tell.angle) * ai.slamAhead * 20, y + Math.sin(tell.angle) * ai.slamAhead * 20, ai.slamRadius);
        // The wave's lane: a thin line ahead of the blade, so it reads as what comes after the blow.
        this.dangerLane(x, y, tell.angle, ai.slamAhead * 20, ai.waveLength * 20, (ai.waveWidth + R) * 20, 0.35 + 0.45 * progress);
        break;
      }
      case 'bgGrab': {
        // His gauntlet's shadow reaching out along it, opening (2026-11-21, the user's pick: only a red box showed).
        const end = tell.end, reach = 0.25 + 0.75 * progress * progress, gx = x + ((end ? end.x * 20 : x) - x) * reach, gy = y - 16 + ((end ? end.y * 20 : y) - y) * reach;
        // The red lane first (box turns the canvas, so in its own save), then the hand's shadow and the hand over it.
        c.save(); box(ai.grabReach * 20, (ai.grabWidth + R) * 20); c.restore();
        this.floorShadow(gx, gy + 16, 16, 0.25 + 0.3 * progress);
        this.drawFxFrame('bgGauntlet', 0, gx, gy, { angle: tell.angle, alpha: 0.35 + 0.5 * progress });
        break;
      }
      case 'bgCracks':
        for (const a of tell.angles || []) this.dangerLane(x, y, a, 0, ai.crackLength * 20 * progress, (ai.crackWidth + R) * 20, 0.3 + 0.4 * progress);
        break;
      case 'bgRings': this.bellRingMarks(tell.x * 20, tell.y * 20, ai.ringRadii, 0, { nextAlpha: 0.5 + progress * 0.5, cover: 0.2 + progress * 0.2 }); break;
      case 'bgCage': if (tell.at) ring(tell.at.x * 20, tell.at.y * 20, ai.cageRadius); break;
    }
  },
  /**
   * The toll's three rings (the inner disc, the outer ring, then the middle, in the order they ring): only the band that
   * rings next is drawn, in the usual tell red (2026-11-22, the user's word: no danger colour on the bands still waiting or
   * already rung; before that the waiting ones were washed lighter, and a dark toll red turned them muddy brown).
   */
  bellRingMarks(x, y, [r0, r1, r2], next, { color = RED, nextAlpha = 1, cover = 0.4 } = {}) {
    const c = this.ctx, band = [[0, r0], [r1, r2], [r0, r1]][next];
    if (!band) return;
    const [lo, hi] = band;
    c.beginPath(); c.ellipse(x, y, hi * 20, hi * 20 * FLOOR_FLAT, 0, 0, TAU);
    if (lo) c.ellipse(x, y, lo * 20, lo * 20 * FLOOR_FLAT, 0, 0, TAU, true);
    // Washed into the floor like his other warnings, a fill laid over solid enough to read at a glance.
    c.save(); c.clip('evenodd'); c.beginPath(); c.rect(x - hi * 20 - 2, y - hi * 20 - 2, hi * 40 + 4, hi * 40 + 4); this.washFloor(nextAlpha, color);
    c.globalAlpha = cover; c.fillStyle = color; c.fill(); c.restore();
    // (2026-11-18: the 1, 2, 3 written on the bands are gone at the user's word; the next band to ring stands out by itself.)
  },
  /** Under the bodies. */
  drawBellFloor() {
    const g = this.game, s = g.s, t = s.time, c = this.ctx, R = g.config.arena.playerRadius;
    for (const f of s.bossFields || []) {
      switch (f.kind) {
        case 'bgPendulum': {
          // The row the bell weight will sweep, red across the room deepening to its pass; its shadow under the bell.
          for (const ps of f.passes) {
            if (ps.y === null || t < ps.warnAt || t > ps.end) continue;
            const k = Math.min(1, (t - ps.warnAt) / Math.max(0.1, ps.start - ps.warnAt));
            c.beginPath(); c.rect(f.left * 20, (ps.y - f.radius * FLOOR_FLAT - 0.2) * 20, (f.right - f.left) * 20, (f.radius * FLOOR_FLAT * 2 + 0.4) * 20); this.dangerWash(0.3 + 0.35 * k);
            if (ps.x !== undefined && t >= ps.start) this.floorShadow(ps.x * 20, ps.y * 20, f.radius * 20, 0.45);
          }
          break;
        }
        case 'bgCrescent': {
          // The crescent of blade light (2026-11-21): the wave's pixelfx crest set edge to edge round the arc it has
          // reached, each piece facing out, a fading second arc behind it; cream, or cyan under Orden's hand.
          // (2026-11-21, the code review: each piece's glow had its own save, blend and copied options; now the front arc's
          // glow is one pass in 'lighter' over its pieces, the options object reused.)
          const name = f.puppet ? 'bgWaveCrestCyan' : 'bgWaveCrest', fade = Math.min(1, (f.range - f.r) / 1.5 + 0.25), frame = this.visualTime * FX[name].fps;
          const at = { angle: 0, sx: 1.3, sy: 1, alpha: 1 };
          for (const [lag, alpha] of [[0, 1], [0.9, 0.35]]) {
            const r = f.r - lag; if (r <= f.from) continue;
            const n = Math.max(5, Math.ceil(2 * f.half * r / 0.75));
            const pieces = (grow, lit, a) => {
              for (let i = 0; i <= n; i++) {
                at.angle = f.angle - f.half + 2 * f.half * i / n; at.sy = (f.width + R) * 20 / 18 * 2 * (1 - Math.abs(i / n - 0.5) * 1.1) * grow; at.alpha = a;
                this.drawFxFrame(name, frame + i + lit, f.x * 20 + Math.cos(at.angle) * r * 20, f.y * 20 + Math.sin(at.angle) * r * 20, at);
              }
            };
            pieces(1, 0, alpha * fade);
            // A glow laid over the front arc, so it reads as light and not a chalk line.
            if (lag) continue;
            c.save(); c.globalCompositeOperation = 'lighter'; pieces(1.4, 3, 0.45 * fade); c.restore();
          }
          break;
        }
        case 'bgWave': {
          // The blade's wave running along the floor: a bright crest at its front, a crack torn open behind it (pixelfx
          // fissure pieces, each glowing as the crest passes and cooling; the code-drawn line is the fallback).
          if (!this.bellFissure(f.x * 20, f.y * 20, f.angle, f.front * 20, f.puppet, d => (f.front * 20 - d) / (f.speed * 20))) {
            c.save(); c.translate(f.x * 20, f.y * 20); c.rotate(f.angle);
            this.bellCrack(0, f.front * 20, f.id, 0.9);
            c.restore();
          }
          // Its crest (pixelfx), fitted to the wave's width; a plain bright band while the sheet loads.
          {
            const name = f.puppet ? 'bgWaveCrestCyan' : 'bgWaveCrest', hx = f.x * 20 + Math.cos(f.angle) * f.front * 20, hy = f.y * 20 + Math.sin(f.angle) * f.front * 20;
            if (!this.drawFxFrame(name, this.visualTime * FX[name].fps + f.x, hx, hy, { angle: f.angle, sy: (f.width + R) * 20 / 18 })) {
              c.save(); c.translate(f.x * 20, f.y * 20); c.rotate(f.angle); c.fillStyle = f.puppet ? 'rgba(95, 227, 255, 0.9)' : 'rgba(255, 244, 214, 0.9)';
              c.fillRect(Math.max(0, f.front * 20 - 12), -f.width * 20, Math.min(12, f.front * 20), f.width * 40); c.restore();
            }
          }
          break;
        }
        case 'bgRings': {
          const next = f.bands.findIndex(b => !b.done);
          if (next >= 0) this.bellRingMarks(f.x * 20, f.y * 20, [f.bands[0].hi, f.bands[2].hi, f.bands[1].hi], next);
          break;
        }
        case 'bgCracks': {
          const k = Math.min(1, (t - f.from) / (f.at - f.from));
          // The crack runs out along each line over the first 60% of the warning (pixelfx fissure pieces, each glowing as
          // the crack reaches it and cooling), then lies open; once burst it fades with the field.
          const reached = (len, d) => t - (f.from + (d / len) / 1.6 * (f.at - f.from)), fade = f.burst ? Math.max(0, Math.min(1, (f.until - t) / 0.4)) : 1;
          for (const l of f.lines) {
            const a = Math.atan2(l.end.y - f.y, l.end.x - f.x), len = Math.hypot(l.end.x - f.x, l.end.y - f.y) * 20;
            if (!f.burst) this.dangerLane(f.x * 20, f.y * 20, a, 0, len, (f.width + R) * 20, 0.25 + 0.4 * k);
            if (this.bellFissure(f.x * 20, f.y * 20, a, len * Math.min(1, k * 1.6), false, d => reached(len, d), fade)) continue;
            c.save(); c.translate(f.x * 20, f.y * 20); c.rotate(a); this.bellCrack(0, len * Math.min(1, k * 1.6), f.id + l.a, fade); c.restore();
          }
          break;
        }
        case 'bgCage':
          // Its shadow on the floor, darkening as the bell comes down.
          if (f.until === null) { const k = Math.max(0, Math.min(1, 1 - (f.land - t) / 1.1)); c.beginPath(); c.ellipse(f.x * 20, f.y * 20, f.radius * 20, f.radius * 20 * FLOOR_FLAT, 0, 0, TAU); this.dangerWash(0.3 + 0.45 * k); }
          break;
        case 'bgTrail': this.bellTrail(f, t); break;
        case 'bgRain': {
          // Each sword's spot, washed red and deepening till it lands (like his other warnings).
          const warn = g.config.bossAI.bellguard.rainWarn;
          for (const sw of f.swords) {
            if (sw.done) continue;
            const k = Math.max(0, Math.min(1, 1 - (sw.at - t) / warn));
            c.beginPath(); c.ellipse(sw.x * 20, sw.y * 20, f.radius * 20 * (0.6 + 0.4 * k), f.radius * 20 * (0.6 + 0.4 * k) * FLOOR_FLAT, 0, 0, TAU); this.dangerWash(0.3 + 0.45 * k);
          }
          break;
        }
        case 'bgNeedles': {
          for (const n of f.needles) if (!n.done && n.at - t < 0.9) { const k = 1 - Math.max(0, n.at - t) / 0.9; this.floorShadow(n.x * 20, n.y * 20, 6 + 8 * k, 0.2 + 0.35 * k); }
          for (const n of f.needles) if (!n.done) { c.beginPath(); c.ellipse(n.x * 20, n.y * 20, f.hitR * 20, f.hitR * 20 * FLOOR_FLAT, 0, 0, TAU); this.dangerWash(0.3 + 0.4 * Math.max(0, 1 - (n.at - t) / 0.8)); }
          // Inside the needles, red deepening till it blows.
          const k = Math.max(0, Math.min(1, 1 - (f.close - t) / (f.close - f.from)));
          c.beginPath(); f.needles.forEach((n, i) => (i ? c.lineTo(n.x * 20, n.y * 20) : c.moveTo(n.x * 20, n.y * 20))); c.closePath();
          this.dangerWash(0.15 + 0.5 * k);
          // The threads of light between needles that stand (pixelfx hum thread).
          for (let i = 0; i < 4; i++) {
            const a = f.needles[i], b = f.needles[(i + 1) % 4];
            if (!a.done || !b.done || a.pulled || b.pulled) continue;
            this.tileAlong(k > 0.6 ? 'bgHumHot' : 'bgHum', a.x * 20, a.y * 20 - 6, Math.atan2(b.y - a.y, b.x - a.x), Math.hypot(b.x - a.x, b.y - a.y) * 20, this.visualTime * FX.bgHum.fps, { alpha: 1 });
          }
          break;
        }
        case 'bgToll': this.bellTollFloor(f, t); break;
      }
    }
    for (const e of s.enemies) if (e.breaking?.kind === 'orders' && e.hp > 0) this.bellOrdersFloor(e, t);
  },
  /**
   * The forged orders on the floor: each pillar's base (cyan while it carries a real order, gold a forged one, grey once
   * broken), and the order he is on: his run as a lane and the round he will strike, washed red and deepening.
   */
  bellOrdersFloor(e, t) {
    const b = e.breaking, c = this.ctx, g = this.game, rule = g.breakRule(e, b.index), R = g.config.arena.playerRadius;
    for (const [i, pl] of b.pillars.entries()) {
      const lit = b.order?.pillar === i && !b.order.struck;
      c.save(); c.globalAlpha = pl.broken ? 0.2 : lit ? 0.6 : 0.3; c.fillStyle = pl.broken ? INK : lit ? (b.order.forged ? '#ffd257' : CYAN) : INK; ellipse(c, pl.x * 20, pl.y * 20, 1.1); c.fill(); c.restore();
      // In tune: the floor round it lights green, wide enough to see from across the room (2026-11-20, the user's pick).
      if (!pl.broken && g.bgInTune(b, pl, rule)) { ellipse(c, pl.x * 20, pl.y * 20, rule.pillarRadius + 1.2); this.washFloor(0.55, SAFE); }
    }
    const o = b.order;
    if (!o || o.struck) return;
    const clipped = this.clipToFloor(g.map);
    const k = o.strikeAt !== null ? Math.min(1, 1 - (o.strikeAt - t) / rule.strikeWarn) : 0;
    if (o.strikeAt === null) {
      const len = Math.hypot(o.stop.x - e.x, o.stop.y - e.y) * 20, ang = Math.atan2(o.stop.y - e.y, o.stop.x - e.x), w = (rule.chargeWidth + R) * 20;
      this.dangerLane(e.x * 20, e.y * 20, ang, 0, len, w, 0.3);
    }
    ellipse(c, o.target.x * 20, o.target.y * 20, rule.strikeRadius); this.dangerWash(0.22 + 0.35 * k + (k > 0.8 ? Math.sin(t * 40) * 0.06 : 0));
    if (clipped) c.restore();
  },
  /**
   * Over the bodies: each standing pillar (pixelfx tuning pillar, ringing while it carries an order) with its tuner on
   * top, a half dial whose middle is green and the swinging needle (pixelfx tuning needle); in the green, the needle
   * shines: strike now for Orden's pitch.
   */
  bellOrdersOver(e, t) {
    const b = e.breaking, c = this.ctx, g = this.game, rule = g.breakRule(e, b.index);
    // Over him, his chest bell as it stands: the cage bell's crack stage for each forged order struck (pixelfx cage-bell),
    // shaking for a moment when a new crack runs through it.
    {
      const shake = b.crackAt !== undefined && t - b.crackAt < 0.4 ? Math.sin(t * 70) * 3 : 0, stage = Math.min(3, Math.round(b.cracks * 3 / b.need));
      if (!this.drawFxFrame('bgBell', stage * 24 + Math.floor(this.visualTime * FX.bgBell.fps) % 24, e.x * 20 + shake, e.y * 20 - 100, { sx: 0.55, sy: 0.55 })) this.bellShape(e.x * 20 + shake, e.y * 20 - 100, 16, 1, stage);
    }
    let order = PILLAR_ORDER.get(b.pillars);
    if (!order) PILLAR_ORDER.set(b.pillars, order = b.pillars.map((_, i) => i).sort((i, j) => b.pillars[i].y - b.pillars[j].y));
    for (const i of order) {
      const pl = b.pillars[i];
      if (pl.broken) continue;
      const x = pl.x * 20, y = pl.y * 20, lit = b.order?.pillar === i && !b.order.struck, clang = pl.clangAt > t - 0.3;
      if (!this.drawFxFrame(lit ? 'bgPillarRing' : 'bgPillar', this.visualTime * FX.bgPillar.fps, x + (clang ? Math.sin(t * 90) * 2 : 0), y)) this.tuningPillar({ ...pl, rise: -1, ringAt: lit ? -1 : Infinity, silenced: false }, t);
      // (2026-11-20: half as big again, its green twice as wide, the needle slower; see rule.tune and needleSeconds.)
      const u = g.bgNeedle(b, pl, rule), swing = 0.9, cy = y - 88, R0 = 26 * 1.5, inTune = g.bgInTune(b, pl, rule), jammed = pl.jamUntil > t;
      // The half dial (pixelfx, lit while the needle is in tune; 2026-11-19: were arcs stroked in code).
      if (!this.drawFxFrame(inTune ? 'bgTunerLit' : 'bgTuner', this.visualTime * FX.bgTuner.fps, x, cy, { sx: 1.5, sy: 1.5 })) {
      c.save(); c.translate(x, cy);
      c.globalAlpha = 0.9; c.lineWidth = 9; c.strokeStyle = '#2b1a0a'; c.beginPath(); c.arc(0, 0, R0, -Math.PI / 2 - swing, -Math.PI / 2 + swing); c.stroke();
      c.lineWidth = 6; c.strokeStyle = '#c99a3a'; c.stroke();
      c.strokeStyle = inTune ? '#7dffa8' : SAFE; c.beginPath(); c.arc(0, 0, R0, -Math.PI / 2 - swing * rule.tune, -Math.PI / 2 + swing * rule.tune); c.stroke();
      c.restore();
      }
      const a = u * swing;
      if (!this.drawFxFrame('bgNeedle', this.visualTime * FX.bgNeedle.fps, x, cy + 6, { angle: a, sx: 0.82, sy: 0.82, alpha: 1 })) {
        c.save(); c.translate(x, cy); c.rotate(a); c.strokeStyle = inTune ? '#ffffff' : CREAM; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -R0); c.stroke(); c.restore();
      }
      if (inTune) { c.save(); c.globalAlpha = 0.6; c.fillStyle = '#ffffff'; c.shadowColor = SAFE; c.shadowBlur = 12; c.beginPath(); c.arc(x + Math.sin(a) * R0, cy - Math.cos(a) * R0, 6, 0, TAU); c.fill(); c.restore(); }
      // Jammed by a blow off the pitch (2026-11-22): the stopped needle's tip glows red, blinking faster as it comes free.
      if (jammed) { const left = pl.jamUntil - t; c.save(); c.globalAlpha = 0.55 + 0.35 * Math.sin(t * (left < 0.5 ? 40 : 16)); c.fillStyle = RED; c.shadowColor = RED; c.shadowBlur = 10; c.beginPath(); c.arc(x + Math.sin(a) * R0, cy - Math.cos(a) * R0, 6, 0, TAU); c.fill(); c.restore(); }
    }
  },
  /**
   * A crack torn along the floor from (x, y) at screen heading `angle`, `len` px long: pixelfx fissure pieces laid end to
   * end, every other one turned round so the run never repeats plainly, each played by `ageAt(distance)` seconds since the
   * crack reached it (not drawn before). False while the sheet loads.
   */
  bellFissure(x, y, angle, len, cyan, ageAt, alpha = 1) {
    const name = cyan ? 'bgFissureCyan' : 'bgFissure', fx = FX[name], step = 32, c = this.ctx, cos = Math.cos(angle), sin = Math.sin(angle);
    if (!this.mapImages?.get(fx.sheet)) return false;
    for (let d = 0, i = 0; d < len; d += step, i++) {
      const part = Math.min(step, len - d), age = ageAt(d + part / 2), flip = i % 2 === 1;
      if (age < 0) continue;
      const cut = part < step;
      if (cut) { c.save(); c.translate(x, y); c.rotate(angle); c.beginPath(); c.rect(d, -30, part, 60); c.clip(); c.rotate(-angle); c.translate(-x, -y); }
      const at = flip ? d + step : d;
      // Twice as wide (2026-11-21, the user's pick: the cracks read as thin white lines), and a warm glow in the gap while fresh.
      const frame = Math.min(fx.frames - 1, age * fx.fps);
      this.drawFxFrame(name, frame, x + cos * at, y + sin * at, { angle, sx: flip ? -1 : 1, sy: 2, alpha });
      if (age < 0.6) { c.save(); c.globalCompositeOperation = 'lighter'; this.drawFxFrame(name, frame, x + cos * at, y + sin * at, { angle, sx: flip ? -1 : 1, sy: 2.4, alpha: alpha * 0.5 * (1 - age / 0.6) }); c.restore(); }
      if (cut) c.restore();
    }
    return true;
  },
  /** A crack in the floor along +x from `from` to `to` (px): a jagged dark line that keeps its shape (seeded by `seed`). */
  bellCrack(from, to, seed, alpha) {
    if (to <= from) return;
    const c = this.ctx; let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    c.save(); c.globalAlpha = alpha; c.strokeStyle = '#3a2c22'; c.lineWidth = 3; c.lineJoin = 'miter'; c.beginPath(); c.moveTo(from, 0);
    for (let x = from + 10; x < to; x += 10) { h = (h * 1103515245 + 12345) >>> 0; c.lineTo(x, ((h >> 8) % 9) - 4); }
    c.lineTo(to, 0); c.stroke(); c.strokeStyle = 'rgba(243, 230, 196, 0.5)'; c.lineWidth = 1; c.stroke(); c.restore();
  },
  /** A cut's mark: a cream slash that fades in a quarter second, or in phase 2 a cyan afterimage that stays and hurts. */
  bellTrail(f, t) {
    const c = this.ctx, life = f.until - f.from, k = Math.max(0, Math.min(1, (t - f.from) / life));
    const fade = f.live ? (k > 0.75 ? (1 - k) / 0.25 : 1) * (0.55 + 0.2 * Math.sin(t * 18)) : 1 - k;
    c.save(); c.globalAlpha = fade; c.lineCap = 'round';
    const colour = f.live ? CYAN : CREAM;
    // The cut itself (pixelfx): played through once, or for Orden's puppet held as a pulsing cyan afterimage while it
    // hurts, over a faint cyan wash of where it hurts. The sheet is a 120-degree arc of 60 px radius, the spin its full circle.
    const name = f.shape === 'ring' ? (f.live ? 'bgSpinCyan' : 'bgSpin') : f.shape === 'sector' ? (f.live ? 'bgSlashCyan' : 'bgSlash') : null;
    if (name && this.mapImages?.get(FX[name].sheet)) {
      const age = t - f.from, frame = f.live ? Math.min(age * 30, 4) : (age / life) * FX[name].frames;
      const k = (f.shape === 'ring' ? f.radius - 0.2 : f.range) * 20 / 60;
      if (f.live) {
        c.save(); c.globalAlpha = fade * 0.5; c.fillStyle = 'rgba(95, 227, 255, 0.28)';
        if (f.shape === 'ring') ellipse(c, f.x * 20, f.y * 20, f.radius);
        else { c.beginPath(); c.moveTo(f.x * 20, f.y * 20); c.arc(f.x * 20, f.y * 20, f.range * 20, f.angle - f.degrees * Math.PI / 360, f.angle + f.degrees * Math.PI / 360); c.closePath(); }
        c.fill(); c.restore();
      }
      c.restore();
      // The spin hurts round on the floor, so its circle is squashed as the floor is; the cuts match their round-on-screen tells.
      this.drawFxFrame(name, frame, f.x * 20, f.y * 20, { angle: f.shape === 'sector' ? f.angle : 0, sx: k, sy: f.shape === 'ring' ? k * FLOOR_FLAT : k, alpha: f.live ? fade : 1 });
      return;
    }
    if (f.shape === 'sector') {
      const from = f.angle - f.degrees * Math.PI / 360, to = f.angle + f.degrees * Math.PI / 360, r = f.range * 20;
      if (f.live) { c.fillStyle = 'rgba(95, 227, 255, 0.28)'; c.beginPath(); c.moveTo(f.x * 20, f.y * 20); c.arc(f.x * 20, f.y * 20, r, from, to); c.closePath(); c.fill(); }
      // The arc the blade drew: thick at its middle, thin at both ends.
      for (const [w, a] of [[10, 0.35], [5, 1]]) { c.globalAlpha = fade * a; c.strokeStyle = colour; c.lineWidth = w; c.beginPath(); c.arc(f.x * 20, f.y * 20, r * 0.92, from + 0.15, to - 0.15); c.stroke(); }
      c.globalAlpha = fade; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(f.x * 20, f.y * 20, r * 0.92, f.angle - 0.4, f.angle + 0.4); c.stroke();
    }
    if (f.shape === 'ring') {
      for (const [w, a] of [[10, 0.35], [4, 1]]) { c.globalAlpha = fade * a; c.strokeStyle = colour; c.lineWidth = w; ellipse(c, f.x * 20, f.y * 20, f.radius - 0.4); c.stroke(); }
    }
    if (f.shape === 'line') {
      c.save(); c.translate(f.x * 20, f.y * 20); c.rotate(f.angle); c.fillStyle = 'rgba(95, 227, 255, 0.3)'; c.fillRect(0, -f.width * 20, f.length * 20, f.width * 40); c.restore();
      // The wave's afterimage: a humming cyan thread down its middle (pixelfx pieces, 2026-11-19: was a line drawn in code).
      if (!this.tileAlong('bgHum', f.x * 20, f.y * 20, f.angle, f.length * 20, this.visualTime * FX.bgHum.fps, { alpha: fade })) {
        c.translate(f.x * 20, f.y * 20); c.rotate(f.angle); c.strokeStyle = colour; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(f.length * 20, 0); c.stroke();
      }
    }
    c.restore();
  },
  /** The last toll: the floor washed red but for the planted sword's shadow, brightening toward each strike. */
  bellTollFloor(f, t) {
    const c = this.ctx, next = f.tolls.find(x => !x.done);
    if (!next) return;
    const plant = f.plants[next.plant], prev = f.tolls[f.tolls.indexOf(next) - 1];
    const span = prev ? next.at - prev.at : next.at - f.from, k = Math.max(0, Math.min(1, 1 - (next.at - t) / span));
    c.save(); c.globalAlpha = 0.25 + 0.35 * k; c.fillStyle = TOLL_RED; c.fillRect(-4000, -4000, 8000, 8000); c.restore();
    if (t < plant.at) return;
    // The shadow the circling light throws from the sword (2026-11-20, the user's pick): a dark wedge in floor shape,
    // turning with the light, a band as wide as F2 along its middle near the sword. Exactly the safe floor (bgShaded):
    // the wedge from the sword and the band, not the hull round both (2026-11-24: that was up to half a unit wider).
    const away = this.game.bgTollLight(f, plant, t) + Math.PI, L = f.length * 20, band = 14;
    c.save(); c.translate(plant.x * 20, plant.y * 20); c.scale(1, FLOOR_FLAT); c.rotate(away); c.beginPath();
    c.moveTo(0, 0); c.arc(0, 0, L, -f.shadow, f.shadow); c.closePath(); c.rect(0, -band, Math.sqrt(L * L - band * band), band * 2);
    c.globalAlpha = 0.72; c.fillStyle = '#121626'; c.fill(); c.globalAlpha = 0.25; c.fillStyle = '#2a3a5a'; c.fill();
    c.restore();
  },
  /** How high F2 is drawn while Belgard holds her up and throws her (render only; the rules keep her on the floor). */
  bellThrowLift() {
    const t = this.game.s.time, f = (this.game.s.bossFields || []).find(x => x.kind === 'bgThrow' && !x.done);
    if (!f) return 0;
    if (t < f.lift) return 22 * Math.min(1, 1 - (f.lift - t) / 0.3);
    const k = Math.min(1, (t - f.lift) / (f.end - f.lift));
    return 22 * (1 - k) + Math.sin(k * Math.PI) * 46;
  },
  /**
   * Over the bodies: Orden's words as he takes hold, the falling bell, the cracks bursting, the phantom sword, the sword
   * rain, the needles, the bell weight, the flung and planted sword, the forged orders' pillars, his strings and cyan eyes.
   */
  drawBellOver() {
    const g = this.game, s = g.s, t = s.time, c = this.ctx;
    // Orden taking Belgard over (bell-boss.js bgStep): his words across the screen as the strings pull taut.
    for (const e of s.enemies) if (e.puppetAt != null && t - e.puppetAt < 2.4 && e.hp > 0) this.drawCaption(t, e.puppetAt, e.puppetAt + 2.4, '오르덴', '벨가드, 네 뜻은 필요 없다. 이제 내가 너를 움직인다.');
    for (const f of s.bossFields || []) {
      if (f.kind === 'bgCage') {
        const fall = f.until === null ? Math.max(0, (f.land - t) / (f.quick ? g.config.bossAI.bellguard.grabDrop : g.config.bossAI.bellguard.cageFall)) : 0;
        if (f.until !== null && !f.trapped && t > f.until - 0.8) continue;
        // The bell cracks a stage further with each quarter of the blows it takes (pixelfx cage-bell, one row per stage).
        const stage = Math.min(3, Math.floor(f.hits / g.config.bossAI.bellguard.cageHits * 4));
        // Coming down (2026-11-19, to feel grand): streaks of air rushing past above it, longer the faster it falls.
        if (fall > 0 && fall < 1 && !this.drawFxFrame('bgFallStreaks', this.visualTime * FX.bgFallStreaks.fps, f.x * 20, f.y * 20 - fall * fall * 260 - f.radius * 20 * 1.2, { alpha: 1 - fall * 0.5 })) {
          // (pixelfx streaks since 2026-11-19; these code lines only while the sheet loads)
          const by = f.y * 20 - fall * fall * 260, r = f.radius * 20, len = 30 + 70 * (1 - fall);
          c.save(); c.globalAlpha = 0.55 * (1 - fall * 0.6); c.fillStyle = '#fff4d6';
          for (const [ox, k] of [[-0.75, 0.7], [-0.35, 1], [0.05, 0.8], [0.45, 1], [0.8, 0.6]]) c.fillRect(Math.round(f.x * 20 + ox * r), Math.round(by - r * 1.3 - len * k), 2, Math.round(len * k));
          c.restore();
        }
        if (fall >= 1.4) continue;
        const knock = f.knockShownAt > t - 0.2 ? Math.sin(t * 90) * 3 : 0;
        this.bellShape(f.x * 20 + knock, f.y * 20 - fall * fall * 260, f.radius * 20, f.trapped ? 0.82 : 1, stage);
        if (f.trapped) this.text(`${Math.max(0, g.config.bossAI.bellguard.cageHits - f.hits)}`, f.x * 20, f.y * 20 - f.radius * 20 * 1.7, '#fff4d6', 14);
      }
      // The cracks bursting: the floor tears open every 1.5 units along each line, one after another outward from the blade.
      if (f.kind === 'bgCracks' && f.burst) for (const l of f.lines) {
        const len = Math.hypot(l.end.x - f.x, l.end.y - f.y);
        for (let d = 1.2; d <= len; d += 1.5) {
          const age = t - (f.until - 1.1) - d * 0.03, u = d / len;
          if (age >= 0 && age * 30 < FX.bgErupt.frames) this.drawFxFrame('bgErupt', age * 30, (f.x + (l.end.x - f.x) * u) * 20, (f.y + (l.end.y - f.y) * u) * 20);
        }
      }
      if (f.kind === 'bgSword') this.flyingSword(f, t);
      if (f.kind === 'bgRain') {
        // Falling in on a slant over its last 0.3 s, two fading copies behind it as a blur; landed, it stands stuck at its
        // slant a moment and fades (2026-11-19: rows dropping straight down looked stiff).
        // (the engine keeps them in order down the screen, bell-boss.js bgRainDrop)
        const stay = g.config.bossAI.bellguard.rainStay;
        for (const sw of f.swords) {
          const fall = sw.done ? 0 : (sw.at - t) / 0.3;
          if (fall >= 1 || (sw.done && t >= sw.at + stay)) continue;
          const fade = sw.done ? Math.min(1, (sw.at + stay - t) / 0.3) : 1, dx = Math.sin(sw.slant) * 260, dy = -Math.cos(sw.slant) * 260;
          if (!sw.done) for (const lag of [0.16, 0.08]) { const u = Math.min(1, fall + lag); this.smallSword(sw.x * 20 + dx * u, sw.y * 20 + dy * u, 0.25 + (0.16 - lag) * 2, sw.n * 5, sw.slant); }
          this.smallSword(sw.x * 20 + dx * Math.max(0, fall), sw.y * 20 + dy * Math.max(0, fall), fade, sw.n * 5, sw.slant);
        }
      }
      if (f.kind === 'bgNeedles') for (const n of f.needles) {
        // Seen over its spot through the warning (2026-11-21, the user's pick: only red discs showed where they would land):
        // hanging high and turning, sinking a little, then driven down in its last 0.15 s.
        const left = n.done ? 0 : n.at - t;
        if (left > 0.9) continue;
        const drop = left <= 0 ? 0 : left < 0.15 ? left / 0.15 * 0.75 : 0.75 + 0.25 * (left - 0.15) / 0.75;
        // Pulled: it lifts out and fades; struck: it shakes.
        const out = n.pulled ? Math.min(1, (t - n.pulledAt) / 0.4) : 0, shake = n.hitAt > t - 0.15 ? Math.sin(t * 90) * 3 : 0;
        if (out >= 1) continue;
        if (this.drawFxFrame('bgNeedle', this.visualTime * FX.bgNeedle.fps, n.x * 20 + shake, n.y * 20 - drop * 110 - out * 40, { alpha: (drop > 0 ? Math.min(0.95, (0.9 - left) / 0.25) : 1) * (1 - out) })) continue;
        c.save(); c.translate(n.x * 20, n.y * 20 - drop * 160); c.strokeStyle = CYAN; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -38); c.stroke();
        c.fillStyle = '#e8fbff'; c.beginPath(); c.arc(0, -40, 4, 0, TAU); c.fill(); c.restore();
      }
      if (f.kind === 'bgPendulum') for (const ps of f.passes) {
        if (ps.x === undefined || t < ps.start || t > ps.end) continue;
        const k = (t - ps.start) / (ps.end - ps.start), tilt = -ps.dir * Math.cos(k * Math.PI) * 0.5;
        this.drawFxFrame('bgBell', Math.floor(this.visualTime * FX.bgBell.fps) % 24, ps.x * 20, ps.y * 20 - 26, { angle: tilt, sx: f.radius * 20 / 30, sy: f.radius * 20 / 30 });
      }
      if (f.kind === 'bgToll') {
        const next = f.tolls.find(x => !x.done), plant = next && f.plants[next.plant];
        // His sword, flung away from him (2026-11-21): flying in as his phantom sword, point first, from plant.flyAt to its
        // landing (tollGlide, as the engine moves it), then standing planted point down where it landed. Until the next
        // flight starts it stands where it last landed (2026-11-21, the code review: it was gone between plantings).
        if (plant) {
          const prev = next.plant > 0 ? f.plants[next.plant - 1] : null;
          if (t >= plant.at) this.phantomSword(plant.x * 20, plant.y * 20 - 30, Math.PI / 2, 1, true);
          else if (t >= plant.flyAt && plant.x !== undefined) {
            const fly = Math.min(1, (t - plant.flyAt) / Math.max(0.01, plant.at - plant.flyAt)), from = { x: plant.x0 ?? plant.x, y: plant.y0 ?? plant.y };
            const x = from.x + (plant.x - from.x) * fly, y = from.y + (plant.y - from.y) * fly, arc = Math.sin(fly * Math.PI) * 40;
            this.phantomSword(x * 20, y * 20 - 34 - arc, Math.atan2((plant.y - from.y) * 20 - 40 * Math.cos(fly * Math.PI), (plant.x - from.x) * 20), 1);
          } else if (prev?.landed) this.phantomSword(prev.x * 20, prev.y * 20 - 30, Math.PI / 2, 1, true);
        }
        if (plant && t >= plant.at) {
          this.text(`${f.tolls.filter(x => x.done).length} / ${f.tolls.length}`, plant.x * 20, plant.y * 20 + 24, '#f6ecd2', 13);
          // The light circling the sword, at chest height (the shadow on the floor is cast from under it).
          const a = g.bgTollLight(f, plant, t), lx = plant.x * 20 + Math.cos(a) * f.light * 20, ly = plant.y * 20 + Math.sin(a) * f.light * 20 * FLOOR_FLAT;
          this.drawFxFrame('bgTollLight', this.visualTime * FX.bgTollLight.fps, lx, ly - 34, { sx: 2.6, sy: 2.6 });
        }
      }
    }
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (e.breaking?.kind === 'orders') this.bellOrdersOver(e, t);
      // Orden's strings (pixelfx bg-strings, 2026-11-20): slack while he moves, pulled taut through every blow.
      if (e.bgAura) { const name = e.tell || t - (e.lastBlowAt || -9) < 0.3 ? 'bgStringsTaut' : 'bgStringsSlack'; this.drawFxFrame(name, this.visualTime * FX[name].fps + e.x, e.x * 20, e.y * 20, { sx: 1, sy: 1, alpha: Math.min(1, (t - (e.puppetAt ?? t)) / 0.8) }); }
      // Orden's hold: the visor slit lit cyan (not in his blows, whose poses move the head).
      if (e.bgAura && !e.tell) {
        const dir = this.mobAnimator?.tracks?.get(e.id)?.direction, d = SLIT[dir] || (Math.sin(e.facing) > 0.2 ? SLIT.south : null);
        if (!d) continue;
        const scale = 1.3 / 2, x = e.x * 20 + d[0] * scale, y = e.y * 20 + d[1] * scale;
        c.save(); c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 9); c.fillStyle = CYAN; c.shadowColor = CYAN; c.shadowBlur = 8; c.fillRect(x - 6, y - 1.5, 12, 3); c.restore();
      }
    }
  },
  /** The bell (pixelfx cage-bell at its crack stage), or a code-drawn dome while the sheet is missing. */
  bellShape(x, y, r, shade, stage = 0) {
    if (this.drawFxFrame('bgBell', stage * 24 + Math.floor(this.visualTime * FX.bgBell.fps) % 24, x, y, { alpha: shade, sx: r / 32, sy: r / 32 })) return;
    const c = this.ctx, h = r * 1.5;
    c.save(); c.translate(x, y); c.globalAlpha = shade;
    c.fillStyle = BRONZE; c.strokeStyle = '#5a3a12'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(-r * 0.85, -h * 0.55, -r * 0.5, -h * 0.9); c.quadraticCurveTo(0, -h * 1.1, r * 0.5, -h * 0.9); c.quadraticCurveTo(r * 0.85, -h * 0.55, r, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e3b35a'; c.fillRect(-r * 0.55, -h * 0.75, r * 0.18, h * 0.55);
    c.fillStyle = '#7a5418'; c.beginPath(); c.ellipse(0, 0, r, r * 0.22, 0, 0, TAU); c.fill(); c.stroke();
    c.restore();
  },
  /**
   * The flying phantom sword (2026-11-19, the user's word: it had no weight): a shadow on the floor under it, a trail of
   * fading afterimages (longer as it darts), hovering with a slow bob while it hunts; taking aim it stops, shivers and
   * brightens, and the lane it will dart along washes red.
   */
  flyingSword(f, t) {
    const ai = this.game.config.bossAI.bellguard, R = this.game.config.arena.playerRadius, lift = f.mode === 'dash' ? 26 : 34 + Math.sin(t * 5) * 4;
    const screen = a => Math.atan2(Math.sin(a), Math.cos(a));
    // Its shadow, small and dark, so it reads as up in the air.
    this.floorShadow(f.x * 20, f.y * 20, 18, 0.28);
    if (f.mode === 'aim') {
      const k = Math.min(1, (t - f.modeAt) / ai.flyAim);
      this.dangerLane(f.x * 20, f.y * 20, f.angle, 0, ai.flyDashLength * 20, (ai.flyRadius + R) * 20, 0.25 + 0.45 * k);
    }
    (f.trail || []).forEach((q, i) => { if (i) this.phantomSword(q.x * 20, q.y * 20 - lift, screen(q.angle), (f.mode === 'dash' ? 0.5 : 0.3) * (1 - i / (f.trail.length + 1))); });
    const shiver = f.mode === 'aim' ? Math.sin(t * 80) * 2 : 0;
    this.phantomSword(f.x * 20 + shiver, f.y * 20 - lift, screen(f.angle), 1, false, f.mode === 'aim' ? 1.25 : f.mode === 'dash' ? 1.15 : 1.1);
  },
  /** Orden's phantom of the greatsword: a cyan blade, point first along `angle` (straight down when planted). */
  phantomSword(x, y, angle, alpha, planted = false, size = planted ? 1.15 : 1) {
    // The pixelfx phantom (point right, so `angle` turns it straight on; planted it stands point down, a little larger).
    if (this.drawFxFrame('bgPhantomSword', this.visualTime * FX.bgPhantomSword.fps, x, y, { angle, sx: size, sy: size, alpha })) return;
    const c = this.ctx, len = planted ? 80 : 64;
    c.save(); c.translate(x, y); c.rotate(angle); c.globalAlpha = alpha;
    c.shadowColor = CYAN; c.shadowBlur = 12;
    c.fillStyle = 'rgba(160, 240, 255, 0.85)'; c.strokeStyle = '#1f6f86'; c.lineWidth = 2;
    // The blade from its point (+x) back to the guard, then the grip.
    c.beginPath(); c.moveTo(len * 0.5, 0); c.lineTo(len * 0.3, -6); c.lineTo(-len * 0.3, -6); c.lineTo(-len * 0.3, 6); c.lineTo(len * 0.3, 6); c.closePath(); c.fill(); c.stroke();
    c.shadowBlur = 0; c.fillStyle = CYAN; c.fillRect(-len * 0.33, -13, 5, 26); c.fillRect(-len * 0.5, -3, len * 0.17, 6);
    c.restore();
  },
  /** One of the rain's small swords, point down (tipped by `slant`, radians from straight down), its point at (x, y). */
  smallSword(x, y, alpha, offset = 0, slant = 0) {
    if (this.drawFxFrame('bgRainSword', this.visualTime * FX.bgRainSword.fps + offset, Math.round(x), Math.round(y), { alpha, angle: slant, sx: 1.3, sy: 1.3 })) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.translate(Math.round(x), Math.round(y)); c.rotate(slant);
    c.fillStyle = '#d9e4ea'; c.strokeStyle = INK; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-3, -6); c.lineTo(-3, -24); c.lineTo(3, -24); c.lineTo(3, -6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = CYAN; c.fillRect(-7, -27, 14, 3); c.fillStyle = '#6b4a1c'; c.fillRect(-1.5, -34, 3, 7);
    c.restore();
  },
  /**
   * A tuning pillar (pixelfx, quiet or ringing), drawn in code for the forged orders while the sheet loads: it rises out
   * of the floor in its first 0.3 s from pl.rise, rings from pl.ringAt, and stands dimmed when pl.silenced.
   */
  tuningPillar(pl, t) {
    const c = this.ctx, x = pl.x * 20, y = pl.y * 20, on = !pl.silenced && t >= pl.ringAt, rise = Math.min(1, (t - pl.rise) / 0.3);
    const alpha = (pl.silenced ? 0.45 : 1) * rise;
    if (this.drawFxFrame(on ? 'bgPillarRing' : 'bgPillar', this.visualTime * FX.bgPillar.fps, x, y + (1 - rise) * 30, { alpha })) return;
    const shake = on ? Math.sin(t * 60) * 1.5 : 0;
    c.save(); c.translate(x + shake, y); c.scale(0.6, 0.6);
    c.fillStyle = '#6b4a1c'; c.fillRect(-9, -8, 18, 8);
    c.fillStyle = on ? '#a9f1ff' : BRONZE; c.strokeStyle = '#4a3010'; c.lineWidth = 2;
    c.fillRect(-6, -58, 12, 52); c.strokeRect(-6, -58, 12, 52);
    c.fillRect(-12, -84, 6, 28); c.fillRect(6, -84, 6, 28); c.fillRect(-12, -60, 24, 5);
    c.strokeRect(-12, -84, 6, 28); c.strokeRect(6, -84, 6, 28);
    if (on) {
      c.globalAlpha = 0.7; c.strokeStyle = CYAN; c.lineWidth = 2;
      for (const k of [1, 2]) { const r = 14 + k * 8 + ((t * 40) % 8); c.beginPath(); c.arc(0, -72, r, -2.4, -0.7); c.stroke(); c.beginPath(); c.arc(0, -72, r, Math.PI + 0.7, Math.PI + 2.4); c.stroke(); }
    }
    c.restore();
  },
};
