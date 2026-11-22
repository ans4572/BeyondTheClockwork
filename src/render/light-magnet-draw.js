// Light and magnet on the screen (docs/design/light-magnet-concepts.md): their skills, the thirteen fusions, the
// statuses' marks and their bursts. Every piece plays its sheet (fx-sprites.js FX, 'lm…' names: pixelfx, and since
// 2026-11-21 PixelLab for the beams, the wire, the dash band, the can, the bursts, the scrap, the shards, the saw, the
// coils and the stars) when there is one and draws itself in code otherwise. Installed on CanvasRenderer (canvas.js), so `this` is the renderer; one world unit
// is 20 pixels, as everywhere in the renderer.
import { FX } from './fx-sprites.js';
import { FLAT_MARK } from './floor-marks.js';
import { FLOOR_FLAT } from '../engine/math.js';

const TAU = Math.PI * 2, U = 20;
const LIGHT = '#fff3c4', LIGHT_EDGE = 'rgba(255, 236, 170, 0.55)', MAGNET = '#9fbbd8', COPPER = '#d08a4c', INK = '#2b3345';
// 북극광 고리's halo is cut 2.4 px below its anchor: the middle of the ring's hole (row 24 of the 43-row picture, at 0.8).
const HALO_MIDDLE = 2.4;
// 울리는 쇠줄's posts: drawn at 0.6 (the PixelLab post is 35 px to its foot), the cable tied 14 px up; the sag is laid in pieces.
const POST_SCALE = 0.6, POST_TIE = 14, CABLE_PIECES = 8;
const RAINBOW = ['#ff6b6b', '#ffb347', '#ffe66d', '#7be07b', '#6fc3ff', '#8f8cff', '#d58cff'];

export const lightMagnetDraw = {
  /** A pixelfx sheet frame when the sheet is in the FX table and loaded; false otherwise (the code drawing follows). */
  lmSheet(name, frame, x, y, options) { return !!FX[name] && this.drawFxFrame(name, frame, x, y, options); },
  /**
   * A PixelLab strip (an FX entry with `ends`: a beam, the wire, the dash band) laid from x0, y0 to x1, y1: its two ends as
   * drawn, the middle stretched to fit, `thick` times as thick as drawn. False until the sheet is loaded.
   */
  lmStrip(name, x0, y0, x1, y1, { thick = 1, alpha = 1, frame = this.visualTime * (FX[name]?.fps || 12), ends = null } = {}) {
    const fx = FX[name], image = fx && this.mapImages?.get(fx.sheet), length = Math.hypot(x1 - x0, y1 - y0);
    if (!image || length < 1 || alpha <= 0) return !!image;
    const f = Math.floor(frame) % fx.frames, left = (f % fx.cols) * fx.w, top = Math.floor(f / fx.cols) * fx.h, c = this.ctx;
    const [head, tail] = ends || fx.ends, squeeze = Math.min(1, length / (head + tail)), middle = Math.max(0, length - head - tail);
    const piece = (from, width, at, drawn) => c.drawImage(image, left + from, top, width, fx.h, at, -fx.anchor[1], drawn, fx.h);
    c.save(); c.globalAlpha *= Math.min(1, alpha); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0)); c.scale(1, thick);
    if (head) piece(0, head, 0, head * squeeze);
    if (middle > 0) piece(fx.ends[0], fx.w - fx.ends[0] - fx.ends[1], head * squeeze, middle);
    if (tail) piece(fx.w - tail, tail, head * squeeze + middle, tail * squeeze);
    c.restore(); return true;
  },
  /** A straight beam lifted off the floor: an outlined glowing band with a bright core, in whole pixels. */
  lmBand(x0, y0, x1, y1, width, core = LIGHT, glow = LIGHT_EDGE, alpha = 1, rainbow = false) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.lineCap = 'round';
    if (rainbow) { const len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len; RAINBOW.forEach((col, i) => { const o = (i - 3) * width * 0.16; c.strokeStyle = col; c.lineWidth = 1; c.globalAlpha = alpha * 0.6; c.beginPath(); c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.stroke(); }); c.globalAlpha = alpha; }
    for (const [w, col] of [[width + 2, 'rgba(43, 51, 69, 0.35)'], [width, glow], [Math.max(1.5, width * 0.4), core]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    c.restore();
  },
  lmStar(x, y, r, col) { const c = this.ctx; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = col; c.fill(); },
  // Floor rings lie as flat as the landing marks (FLAT_MARK 0.42; user, 2026-11-22: at the floor's 0.55 they read as circles).
  lmFloorEllipse(x, y, r, fill, stroke, lw = 1.5, flat = FLAT_MARK) { const c = this.ctx; c.beginPath(); c.ellipse(x, y, r, r * flat, 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } },
  /** 서리 쇳조각's iced shard: the PixelLab sprite pointing along `a`, `len` the code shard's length (7 = as drawn). */
  lmIce(x, y, a, len) { const k = len / 7; if (!this.lmSheet('lmIceShard', 0, x, y, { angle: a, sx: k, sy: k })) this.lmShard(x, y, a, len, '#d6f3fb'); },
  lmShard(x, y, a, len, col) { const c = this.ctx; c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(len, 0); c.lineTo(-len * 0.5, len * 0.35); c.lineTo(-len * 0.3, 0); c.lineTo(-len * 0.5, -len * 0.35); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); c.restore(); },

  /** On the floor, under the bodies: where the light and magnet casts reach. */
  drawLightMagnetFloor() {
    const g = this.game, s = g.s, c = this.ctx, t = s.time;
    c.save();
    for (const cast of s.casts) {
      const x = cast.x * U, y = cast.y * U;
      // 끌어올리기: the circle the scrap rises from.
      if (cast.skillId === 'magneticLift' && cast.shape === 'target' && cast.pulse === 0) {
        const k = Math.min(1, cast.age / Math.max(0.01, cast.next));
        this.lmFloorEllipse(x, y, cast.radius * U, `rgba(159, 187, 216, ${0.08 + 0.12 * k})`, 'rgba(159, 187, 216, 0.75)', 1.5, FLAT_MARK);
      }
      if (cast.shape === 'sun' && !cast.done) this.lmFloorEllipse(x, y, cast.pillarRadius * U, 'rgba(255, 190, 90, 0.12)', 'rgba(255, 214, 120, 0.5)', 1);
      // 소나기 무지개: the patch the rain darkens, fading once the sunlight has struck.
      if (cast.shape === 'shower') { const wet = Math.min(1, cast.age / 0.6) * (cast.struck ? Math.max(0, 1 - (cast.age - cast.strikeAt) / 0.7) : 1); this.lmFloorEllipse(x, y, cast.radius * U, `rgba(70, 130, 170, ${0.22 * wet})`, `rgba(190, 235, 255, ${0.45 * wet})`, 1); }
      if (cast.shape === 'saw' && cast.lodgedAt !== null) this.lmFloorEllipse(x, y, cast.spinRadius * U, 'rgba(214, 240, 230, 0.10)', 'rgba(214, 240, 230, 0.45)', 1);
      // 자성 유체 덩굴: the black trail creeping on, and the pool it makes round the body.
      if (cast.shape === 'vine') {
        if (!this.lmStrip('lmFerroTrail', cast.fromX * U, cast.fromY * U, cast.headX * U, cast.headY * U, { thick: 0.6, frame: 0 })) { c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(20, 22, 34, 0.75)'; c.lineWidth = 5; c.beginPath(); c.moveTo(cast.fromX * U, cast.fromY * U); c.lineTo(cast.headX * U, cast.headY * U); c.stroke(); c.restore(); }
        if (cast.arrivedAt !== null) { const k = cast.stabRadius * U * 2 / 40; if (!this.lmSheet('lmFerroPool', 0, x, y, { sx: k, sy: k })) this.lmFloorEllipse(x, y, cast.stabRadius * U, 'rgba(20, 22, 34, 0.55)', 'rgba(159, 187, 216, 0.5)', 1); }
      }
      // 빛살 질주: the band of light left on the floor, brightening to its burst.
      if (cast.shape === 'lightDash' && cast.toX !== undefined) {
        const k = Math.min(1, (cast.age - cast.duration) / cast.bandDelay), wide = cast.halfWidth * U * FLOOR_FLAT * 1.6;
        if (!this.lmStrip('lmDashBand', cast.fromX * U, cast.fromY * U, cast.toX * U, cast.toY * U, { thick: Math.max(0.4, wide / 12), alpha: 0.55 + 0.35 * k })) this.lmBand(cast.fromX * U, cast.fromY * U, cast.toX * U, cast.toY * U, cast.halfWidth * U * FLOOR_FLAT * 1.6, '#ffffff', 'rgba(214, 240, 230, 0.4)', 0.45 + 0.35 * k + 0.15 * Math.sin(this.visualTime * 22));
      }
      if (cast.shape === 'shards' && !cast.flights.length) this.lmShardRing(cast, g.p, true);
      // 울리는 쇠줄's shadow on the floor, from post to end.
      if (cast.shape === 'string') { const k = Math.min(1, cast.age / 0.2); c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(20, 16, 24, 0.22)'; c.lineWidth = 3; c.beginPath(); c.moveTo(cast.fromX * U, cast.fromY * U); c.lineTo(cast.fromX * U + (cast.x - cast.fromX) * U * k, cast.fromY * U + (cast.y - cast.fromY) * U * k); c.stroke(); c.restore(); }
      if (cast.shape === 'aurora') this.lmHalo(cast, g.p, true);
      if (cast.shape === 'aurora') for (const cur of cast.curtains || []) { const k = (t - cur.at) / 0.5; this.lmFloorEllipse(cur.x * U, cur.y * U, cast.fallRadius * U, `rgba(123, 224, 176, ${0.35 * (1 - k)})`); }
    }
    c.restore();
  },

  /**
   * The light and magnet pieces that stand on the floor among the bodies, each put in canvas.js's depth sort by where it
   * stands (2026-11-22; drawn over everything they covered whoever stood in front of them): the can blinking on the floor,
   * the rising scrap, the ice prism, the molten ball, the saw (just in front of the body it bites), the ferrofluid spikes
   * (just behind the body they stab, so it stays in view), the wire's posts, the rainbow (a little behind where its
   * sunlight strikes) and the rail's coils (behind F2 when she aims up the screen).
   */
  lightMagnetActors() {
    const g = this.game, s = g.s, p = g.p, c = this.ctx, out = [], at = (y, draw) => out.push({ y, lm: draw });
    for (const cast of s.casts) {
      const x = cast.x * U, y = cast.y * U;
      if (cast.skillId === 'flashBomb' && cast.shape === 'target' && cast.pulse === 0 && !cast.derived && cast.age >= (cast.throwSeconds || 0.35)) at(cast.y, () => {
        const blink = Math.floor(this.visualTime * 18) % 2;
        if (!this.lmSheet('lmCan', blink, x, y - 9)) { this.circle(x, y - 3, 3.5, blink ? '#ffffff' : '#e8e2cc'); this.rect(x - 1, y - 8, 2, 3, COPPER); }
      });
      if (cast.skillId === 'magneticLift' && cast.shape === 'target' && cast.pulse === 0) at(cast.y, () => {
        const vt = this.visualTime, rise = Math.min(1, cast.age / Math.max(0.05, cast.next * 0.6)), h = rise * 30, size = cast.radius * U * 2 / 86 * 0.85;
        if (this.lmSheet('lmLiftHeap', vt * 8, x, y - h - 8, { alpha: Math.min(1, rise * 1.6), sx: size, sy: size })) return;
        for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = (0.3 + (i % 5) * 0.42) * cast.radius / 2.5 * U, bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr * FLOOR_FLAT - h - (i % 3) * 3;
          c.save(); c.translate(bx, by); c.rotate(vt * 3 + a); c.fillStyle = i % 4 ? '#8d939c' : COPPER; c.fillRect(-3, -2, 6, 4); c.strokeStyle = INK; c.lineWidth = 0.75; c.strokeRect(-3, -2, 6, 4); c.restore(); }
      });
      if (cast.shape === 'prism') at(cast.y, () => {
        const grow = Math.min(1, cast.age / 0.2), fade = cast.pulse >= cast.pulses ? Math.max(0, 1 - (cast.age - cast.next + cast.interval) / 0.4) : 1;
        if (!this.lmSheet('lmPrism', 0, x, y, { alpha: grow * fade, sx: 1.2, sy: 1.2 })) {
          c.save(); c.globalAlpha = grow * fade; c.translate(x, y); c.fillStyle = '#d6f3fb'; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -24); c.lineTo(7, -8); c.lineTo(0, 0); c.lineTo(-7, -8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ffffff'; c.fillRect(-1, -19, 2, 8); c.restore();
        }
      });
      if (cast.shape === 'ball') at(cast.y, () => {
        const bx = x, by = y - 11;
        this.lmFloorEllipse(x, y, 7, 'rgba(0, 0, 0, 0.28)');
        if (!this.lmSheet('lmBall', this.visualTime * 14, bx, by)) {
          const gr = c.createRadialGradient(bx - 2, by - 2, 1, bx, by, 9); gr.addColorStop(0, '#fff1a8'); gr.addColorStop(0.5, '#ff8a3a'); gr.addColorStop(1, '#8a3b1c');
          c.save(); c.fillStyle = gr; c.beginPath(); c.arc(bx, by, 9, 0, TAU); c.fill(); c.strokeStyle = COPPER; c.lineWidth = 1.5; c.stroke(); c.restore();
        }
      });
      if (cast.shape === 'rail' && !cast.fired) at(p.y + (Math.sin(p.angle) < -0.3 ? -0.02 : 0.02), () => {
        const k = Math.min(1, cast.age / cast.charge), a = p.angle, hand = this.handPoint(a), ox = hand.x + Math.cos(a) * 6, oy = hand.y + Math.sin(a) * 6;
        // The coils, turned to the aim and kept upright (flipped when they point left); the glow at the tip grows with the charge.
        if (this.lmSheet('lmCoil', this.visualTime * 14, ox, oy, { angle: a, sx: 0.7, sy: Math.cos(a) < 0 ? -0.7 : 0.7, alpha: 0.6 + k * 0.4 })) { this.circle(ox + Math.cos(a) * 40, oy + Math.sin(a) * 40, 1 + k * 3.5, `rgba(233, 242, 255, ${k})`); return; }
        c.save(); for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(208, 138, 76, ${0.5 + k * 0.5})`; c.lineWidth = 2; c.beginPath(); c.ellipse(ox + Math.cos(a) * i * 4, oy + Math.sin(a) * i * 4, 3, 6, a, 0, TAU); c.stroke(); } c.restore();
        this.circle(ox + Math.cos(a) * 12, oy + Math.sin(a) * 12, 1.5 + k * 3, `rgba(255, 224, 134, ${k})`);
      });
      if (cast.shape === 'saw' && !(cast.lodgedAt !== null && cast.spins >= (cast.record?.spinHits ?? 6))) {
        const held = cast.lodgedAt !== null ? s.enemies.find(e => e.id === cast.heldId) : null;
        at((held ? held.y : cast.y) + 0.02, () => {
          if (this.lmSheet('lmSaw', 0, x, y - 12, { angle: this.visualTime * 30, sx: 0.7, sy: 0.7 })) return;
          c.save(); c.translate(x, y - 10); c.rotate(this.visualTime * 30); c.fillStyle = '#9aa3ad'; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 6 : 9; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); this.circle(0, 0, 2.5, COPPER); c.restore();
        });
      }
      if (cast.shape === 'vine' && cast.arrivedAt !== null) at(cast.y - 0.03, () => this.lmSpikes(cast, s.time));
      if (cast.shape === 'string') {
        const held = cast.heldId !== null && cast.heldId !== undefined;
        at(cast.fromY, () => this.lmSheet('lmPost', 0, cast.fromX * U, cast.fromY * U, { sx: POST_SCALE, sy: POST_SCALE }));
        if (!held && cast.age >= 0.2) at(cast.y, () => this.lmSheet('lmPost', 0, cast.x * U, cast.y * U, { sx: POST_SCALE, sy: POST_SCALE }));
      }
      if (cast.shape === 'shower') at(cast.y - 0.2, () => this.lmShowerArch(cast));
    }
    return out;
  },
  /** Over the bodies: beams, lines, objects in the air and the statuses' marks. */
  drawLightMagnetOver() {
    const g = this.game, s = g.s, c = this.ctx, t = s.time, p = g.p, vt = this.visualTime, hand = this.handPoint(p.angle);
    c.save();
    for (const cast of s.casts) {
      const x = cast.x * U, y = cast.y * U;
      // 섬광탄: the can in the air, then blinking on the floor until it bursts.
      if (cast.skillId === 'flashBomb' && cast.shape === 'target' && cast.pulse === 0 && !cast.derived) {
        const fly = cast.throwSeconds || 0.35;
        if (cast.age < fly) {
          const k = cast.age / fly, bx = cast.startX * U + (x - cast.startX * U) * k, by = cast.startY * U + (y - cast.startY * U) * k - 14 - Math.sin(k * Math.PI) * 26;
          if (!this.lmSheet('lmCan', 0, bx, by, { angle: k * TAU * 1.5 })) { this.circle(bx, by, 3.5, '#e8e2cc'); this.circle(bx, by, 1.5, '#ffffff'); }
        }
      }
      if (cast.shape === 'lmReturn' && cast.age >= cast.wait) for (const b of cast.pellets) if (!b.home) { const a = Math.atan2(p.y - b.y, p.x - b.x); if (!this.lmSheet('lmScrap', 0, b.x * U, b.y * U - 8, { angle: a })) this.lmShard(b.x * U, b.y * U - 8, a, 4, '#c9cfd6'); }
      if (cast.shape === 'sun') {
        const sy = y - 62, grow = Math.min(1, cast.age / 0.25);
        if (!this.lmSheet('lmSun', vt * 16, x, sy, { alpha: grow, sx: 1.2, sy: 1.2 })) {
          c.save(); c.globalAlpha = grow; c.strokeStyle = '#ffd257'; c.lineWidth = 1.5;
          for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + vt; c.beginPath(); c.moveTo(x + Math.cos(a) * 9, sy + Math.sin(a) * 9); c.lineTo(x + Math.cos(a) * 13, sy + Math.sin(a) * 13); c.stroke(); }
          this.circle(x, sy, 7, '#fff3b0'); this.circle(x, sy, 4, '#ffb347'); c.restore();
        }
      }
      if (cast.shape === 'prism') {
        for (const shot of cast.shots) { const k = (t - shot.at) / 0.25; if (!this.lmStrip('lmIceBeam', x, y - 22, shot.x * U, shot.y * U - 14, { thick: 0.45, alpha: 1 - k, frame: 0 })) this.lmBand(x, y - 14, shot.x * U, shot.y * U - 14, 2.5, '#ffffff', 'rgba(191, 233, 244, 0.6)', 1 - k, true); }
      }
      if (cast.shape === 'refract' && cast.age >= (cast.delay || 0) - 0.05 && cast.tid !== null) {
        const body = s.enemies.find(e => e.id === cast.tid && e.hp > 0);
        if (body) {
          // From the hand turned to the body (user, 2026-11-21: it left from where F2 faced, not from her hand), a knot of light
          // in the hand and another where it burns the body.
          const bx = body.x * U, by = body.y * U - 14, h = this.handPoint(Math.atan2(body.y - p.y, body.x - p.x)), pulse = 0.85 + 0.15 * Math.sin(vt * 30);
          this.lmSheet('lmStar', vt * 10, bx, by, { sx: 0.9 * pulse, sy: 0.9 * pulse });
          if (!this.lmStrip('lmBeamRefract', h.x, h.y, bx, by, { thick: 0.55, alpha: 0.95 })) this.lmBand(h.x, h.y, bx, by, 4 + Math.sin(vt * 40), '#ffffff', 'rgba(255, 224, 134, 0.55)', 0.9, true);
          for (const b of cast.bends) { const k = (t - b.at) / 0.2; if (!this.lmStrip('lmBeamRefract', bx, by, b.x * U, b.y * U - 14, { thick: 0.38, alpha: 1 - k })) this.lmBand(bx, by, b.x * U, b.y * U - 14, 2, '#ffffff', 'rgba(255, 224, 134, 0.6)', 1 - k); }
          this.lmSheet('lmStar', vt * 10 + 3, h.x, h.y, { sx: 0.75 * pulse, sy: 0.75 * pulse });
        }
      }
      if (cast.shape === 'constellation' && cast.lines && cast.age >= 0.05) {
        const ring = t - (cast.ringAt ?? -9) < 0.09, grow = Math.min(1, cast.age / 0.3);
        for (const [a, b] of cast.lines) if (!this.lmStrip('lmBeamLight', a.x * U, a.y * U - 18, b.x * U, b.y * U - 18, { thick: ring ? 0.4 : 0.22, alpha: grow * (ring ? 1 : 0.75) })) this.lmBand(a.x * U, a.y * U - 18, b.x * U, b.y * U - 18, ring ? 3 : 1.5, '#ffffff', ring ? 'rgba(244, 211, 138, 0.8)' : 'rgba(255, 255, 255, 0.3)', grow);
        (cast.members || []).forEach((id, i) => { const e = s.enemies.find(b => b.id === id && b.hp > 0), k = ring ? 1.1 : 0.75; if (e && !this.lmSheet('lmStar', vt * 10 + i * 3, e.x * U, e.y * U - 18, { sx: k, sy: k })) this.lmStar(e.x * U, e.y * U - 18, ring ? 7 : 5, '#fff8dc'); });
      }
      if (cast.shape === 'shower') this.lmShower(cast);
      if (cast.shape === 'shards') {
        if (!cast.flights.length) this.lmShardRing(cast, p, false);
        for (const fl of cast.flights) {
          if (fl.done || cast.age < fl.at) continue;
          const body = s.enemies.find(e => e.id === fl.id && e.hp > 0); if (!body) continue;
          const k = Math.min(1, (cast.age - fl.at) / cast.flight), sx = (fl.fromX + (body.x - fl.fromX) * k) * U, sy = (fl.fromY + (body.y - fl.fromY) * k) * U - 14;
          this.lmIce(sx, sy, Math.atan2(body.y - fl.fromY, body.x - fl.fromX), 7);
        }
      }
      if (cast.shape === 'string') this.lmString(cast, t);
      if (cast.shape === 'aurora') this.lmAurora(cast, p, t);
    }
    // The statuses' looks on the bodies: a set body greyed with dust, a blinded one with rays over its head.
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (e.ironSetUntil > t) { const k = (e.ironSetUntil - t) / 0.8; this.lmFloorEllipse(e.x * U, e.y * U, (e.radius + 0.2) * U, `rgba(159, 187, 216, ${0.35 * k})`, `rgba(207, 230, 255, ${0.8 * k})`, 2); }
      if (e.blindUntil > t) { const hx = e.x * U, hy = e.y * U - (e.radius + 1.6) * U; c.save(); c.strokeStyle = 'rgba(255, 255, 255, 0.85)'; c.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.4; c.beginPath(); c.moveTo(hx + Math.cos(a) * 4, hy + Math.sin(a) * 4); c.lineTo(hx + Math.cos(a) * 9, hy + Math.sin(a) * 9); c.stroke(); } c.restore(); }
    }
    c.restore();
  },
  /**
   * 소나기 무지개 (2026-11-21): a rain cloud (PixelLab) over the spot gathering, the shower (pixelfx lmRain) falling while
   * it rains, then the cloud thins away and a rainbow (PixelLab) stands over the spot for the strike of sunlight (its
   * pillar and burst are effects). Plain shapes stand in until the pictures load.
   */
  /** 소나기 무지개's rainbow, drawn with the floor so the bodies stand in front of it. */
  lmShowerArch(cast) {
    const c = this.ctx, x = cast.x * U, y = cast.y * U, r = cast.radius * U, rainEnd = (cast.delay || 0) + (cast.ticks || 8) * cast.interval;
    if (cast.age >= rainEnd - 0.4) {
      const k = Math.min(1, (cast.age - (rainEnd - 0.4)) / 0.3) * (cast.struck ? Math.max(0, 1 - (cast.age - cast.strikeAt - 0.3) / 0.4) : 1), size = (cast.record?.burstRadius || cast.radius) * U * 2 / 77;
      if (k > 0 && !this.lmSheet('lmArch', 0, x, y, { alpha: k, sx: size, sy: size })) {
        c.save(); c.globalAlpha = 0.8 * k; c.lineWidth = 2; RAINBOW.forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.ellipse(x, y, r - i * 2, (r - i * 2) * 0.8, 0, Math.PI, TAU); c.stroke(); }); c.restore();
      }
    }
  },
  lmShower(cast) {
    const c = this.ctx, x = cast.x * U, y = cast.y * U, vt = this.visualTime, r = cast.radius * U, rainEnd = (cast.delay || 0) + (cast.ticks || 8) * cast.interval;
    const cloudIn = Math.min(1, cast.age / 0.3), cloudOut = Math.max(0, Math.min(1, (cast.strikeAt - 0.1 - cast.age) / 0.3)), cloud = cloudIn * cloudOut;
    if (cast.age >= (cast.delay || 0) - 0.05 && cast.age < rainEnd + 0.15 && !this.lmSheet('lmRain', vt * 20, x, y, { sx: r / 36, sy: r / 36 * FLAT_MARK / FLOOR_FLAT })) {
      c.save(); c.strokeStyle = 'rgba(200, 235, 255, 0.7)'; c.lineWidth = 1; for (let i = 0; i < 10; i++) { const a = i * 2.4, rr = (i % 5) / 5 * r, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * FLOOR_FLAT, f = ((vt * 3 + i / 10) % 1); c.beginPath(); c.moveTo(px + 2, py - 46 + f * 40); c.lineTo(px, py - 40 + f * 40); c.stroke(); } c.restore();
    }
    if (cloud > 0) { const size = r * 2 / 49 * 0.9; if (!this.lmSheet('lmCloud', vt * 8, x, y - 54, { alpha: cloud, sx: size, sy: size })) { c.save(); c.globalAlpha = 0.8 * cloud; c.fillStyle = '#7f93a8'; c.beginPath(); c.ellipse(x, y - 58, r * 0.9, 12, 0, 0, TAU); c.fill(); c.restore(); } }
  },
  /**
   * 서리 쇳조각's ring round F2 at her waist: a faint frosty track and the six shards on it. The far half (`back`) is drawn in
   * the floor pass so F2 stands in front of it, the near half over her (user, 2026-11-21: shards behind her head were drawn
   * over it, so the ring did not read as going round her).
   */
  lmShardRing(cast, p, back) {
    const c = this.ctx, x = p.x * U, y = p.y * U - 14, rx = cast.orbit * U, ry = cast.orbit * U * FLAT_MARK, grow = Math.min(1, cast.age / 0.25);
    c.save(); c.globalAlpha = 0.35 * grow; c.strokeStyle = '#d6f3fb'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, rx * grow, ry * grow, 0, back ? Math.PI : 0, back ? TAU : Math.PI); c.stroke(); c.restore();
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6 + cast.age * 4, far = Math.sin(a) < 0;
      if (far !== back) continue;
      this.lmIce(x + Math.cos(a) * rx * grow, y + Math.sin(a) * ry * grow, a + Math.PI / 2, 6);
    }
  },
  /**
   * 울리는 쇠줄 (redrawn 2026-11-21: the bare grey line did not sit with the map): a twisted steel cable (PixelLab) strung from
   * a copper post where F2 cast it, like the yard's rope fences, to a clamp on the body it holds or a second post at a wall
   * or its range's end. It sags a little, shivers after each pluck and sends brass sound arcs off (pixelfx lmPluck); its
   * shadow lies on the floor (drawLightMagnetFloor). The code wire is the fallback until the pictures load.
   */
  lmString(cast, t) {
    const c = this.ctx, vt = this.visualTime, grow = Math.min(1, cast.age / 0.2), held = cast.heldId !== null && cast.heldId !== undefined;
    const foot = { x: cast.fromX * U, y: cast.fromY * U }, ax = foot.x, ay = foot.y - POST_TIE, bx = cast.x * U, by = cast.y * U - (held ? 12 : POST_TIE);
    const since = t - (cast.pluckAt ?? -9), amp = since < 0.3 ? 5 * (1 - since / 0.3) : 0, len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len;
    const sag = Math.min(8, len * 0.05) * (1 - amp / 6), at = u => { const k = u * grow, wv = Math.sin(k * Math.PI) * Math.sin(vt * 90) * amp; return { x: ax + (bx - ax) * k + nx * wv, y: ay + (by - ay) * k + ny * wv + sag * 4 * k * (1 - k) }; };
    let drawn = !!FX.lmCable;
    for (let i = 0; i < CABLE_PIECES && drawn; i++) { const p0 = at(i / CABLE_PIECES), p1 = at((i + 1) / CABLE_PIECES); const d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1, o = 1 / d; drawn = this.lmStrip('lmCable', p0.x - (p1.x - p0.x) * o, p0.y - (p1.y - p0.y) * o, p1.x + (p1.x - p0.x) * o, p1.y + (p1.y - p0.y) * o, { thick: 0.8, frame: 0, ends: [0, 0] }); }
    c.save(); c.lineCap = 'round';
    if (!drawn) for (const [w, col] of [[3, INK], [1.5, '#c9d6e4']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let i = 0; i <= 30; i++) { const q = at(i / 30); c.lineTo(q.x, q.y); } c.stroke(); }
    c.restore();
    if (since < 0.35) for (const u of [0.3, 0.5, 0.7]) { const q = at(u); this.lmSheet('lmPluck', since * 30, q.x, q.y, { angle: Math.atan2(by - ay, bx - ax), sx: 0.8, sy: 0.8 }); }
    if (held && grow >= 1 && !this.lmSheet('lmClamp', 0, bx, by, { sx: 0.8, sy: 0.8 })) this.circle(bx, by, 3, COPPER);
  },
  /** 자성 유체 덩굴: black glossy spikes standing round the body, shooting up on each stab. */
  lmSpikes(cast, t) {
    const since = t - (cast.stabAt ?? -9), up = since < 0.12 ? 1 - since / 0.12 : 0;
    // One sink-and-rise of the PixelLab spikes a stab (frame 0 is fully raised, the moment the stab lands).
    // Drawn a little smaller than the pool (2026-11-21: at the wider 2.3 reach, full size hid the body they stab).
    const k = Math.min(1.25, cast.stabRadius * U * 2 / 51 * 0.6);
    if (this.lmSheet('lmSpikes', Math.max(0, since) / (cast.interval || 0.25) * 8, cast.x * U, cast.y * U, { sx: k, sy: k })) return;
    const c = this.ctx;
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + cast.pulse, rr = (0.25 + (i % 3) * 0.3) * cast.stabRadius, x = cast.x * U + Math.cos(a) * rr * U, y = cast.y * U + Math.sin(a) * rr * U * FLOOR_FLAT, h = 6 + up * 16 * ((i % 2) + 0.6);
      c.fillStyle = '#151824'; c.beginPath(); c.moveTo(x - 2.5, y); c.lineTo(x, y - h); c.lineTo(x + 2.5, y); c.closePath(); c.fill(); c.strokeStyle = 'rgba(159, 187, 216, 0.75)'; c.lineWidth = 0.75; c.stroke();
    }
  },
  /** 북극광 고리: the ring over F2 and the curtains coming down from it. */
  /**
   * 북극광 고리's halo (PixelLab lmHalo) round F2's head, cut along the ring's middle: `back` draws the far half and the
   * aurora rising off it (drawn with the floor, so F2's head stands in front of it), otherwise the near half over her
   * (user, 2026-11-21: drawn whole over her it covered her face). False until the sheet is loaded.
   */
  lmHalo(cast, p, back) {
    if (!FX.lmHalo || !this.mapImages?.get(FX.lmHalo.sheet)) return false;
    const c = this.ctx, rx = p.x * U, ry = p.y * U - 50, split = ry + HALO_MIDDLE, grow = Math.min(1, cast.age / 0.3);
    c.save(); c.beginPath(); if (back) c.rect(rx - 40, ry - 60, 80, split - (ry - 60)); else c.rect(rx - 40, split, 80, 60); c.clip();
    this.lmSheet('lmHalo', this.visualTime * 12, rx, ry, { alpha: grow, sx: 0.8, sy: 0.8 });
    c.restore(); return true;
  },
  lmAurora(cast, p, t) {
    // Over F2's head (2026-11-22: 50 px; 58 floated well clear of her, 36 covered her eyes, 41 sat on her head).
    const c = this.ctx, rx = p.x * U, ry = p.y * U - 50, grow = Math.min(1, cast.age / 0.3);
    // The halo's near half, over F2 (its far half went under her with the floor); two code ellipses until it is loaded.
    if (!this.lmHalo(cast, p, false)) { c.save(); c.globalAlpha = grow; c.lineWidth = 3; c.strokeStyle = '#7be0b0'; c.beginPath(); c.ellipse(rx, ry, 18, 6, 0, 0, TAU); c.stroke(); c.lineWidth = 1.5; c.strokeStyle = '#d58cff'; c.beginPath(); c.ellipse(rx, ry - 2, 15, 4.5, 0, 0, TAU); c.stroke(); c.restore(); }
    for (const cur of cast.curtains || []) {
      const k = (t - cur.at) / 0.5, x = cur.x * U, bottom = cur.y * U, top = bottom - 90;
      if (this.lmSheet('lmCurtain', k * (FX.lmCurtain?.frames || 1), x, bottom, { alpha: 1 - k })) continue;
      const gr = c.createLinearGradient(0, top, 0, bottom); gr.addColorStop(0, 'rgba(213, 140, 255, 0)'); gr.addColorStop(0.5, `rgba(123, 224, 176, ${0.55 * (1 - k)})`); gr.addColorStop(1, `rgba(220, 255, 240, ${0.85 * (1 - k)})`);
      c.fillStyle = gr; for (let i = -2; i <= 2; i++) c.fillRect(Math.round(x + i * 5 - 1.5 + Math.sin(this.visualTime * 12 + i) * 1.5), top + k * 20, 3, bottom - top - k * 20);
    }
  },
  /**
   * 고철 산탄: a spinning bit of scrap. 대구경's one slug has its own picture, about twice the pellet's size and as wide as it
   * hits (2026-11-22: the pellet scaled up twice read blocky beside the map's pixels).
   */
  drawScrapBolt(bullet, cast) {
    const x = bullet.x * U, y = bullet.y * U - 8, slug = !!cast?.slug;
    if (this.lmSheet(slug ? 'lmSlug' : 'lmScrap', 0, x, y, { angle: bullet.angle })) return;
    const c = this.ctx, k = slug ? 2 : 1; c.save(); c.translate(x, y); c.rotate(this.visualTime * 20); c.fillStyle = '#c9cfd6'; c.fillRect(-3 * k, -2 * k, 6 * k, 4 * k); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-3 * k, -2 * k, 6 * k, 4 * k); c.restore();
  },

  /** The light and magnet effects (beams, the rail and their bursts); true when it drew one. */
  drawLightMagnetFx(fx, x, y, fraction) {
    const c = this.ctx;
    if (fx.type === 'lmBeam') {
      const tx = fx.targetX * U, ty = fx.targetY * U, lift = fx.burst ? 0 : 14, w = Math.max(2, (fx.width || 0.6) * U * (fx.burst ? FLOOR_FLAT * 1.6 : 0.5));
      // 프리즘 광선 leaves F2's hand (user, 2026-11-21: it used to start at her feet's height, away from the hand).
      if (fx.prism) { const h = this.handPoint(Math.atan2(fx.targetY - fx.y, fx.targetX - fx.x)); x = h.x; y = h.y + lift; }
      // 프리즘 광선 (and 분광's branch) as the PixelLab light beam; 빛살 질주's burst as its band, flaring wider.
      if (this.lmStrip(fx.burst ? 'lmDashBand' : 'lmBeamLight', x, y - lift, tx, ty - lift, { thick: Math.max(0.35, fx.burst ? w * (1 + fraction * 0.4) / 24 : w / 9), alpha: 1 - fraction })) return true;
      this.lmBand(x, y - lift, tx, ty - lift, w * (fx.burst ? 1 + fraction : 1), '#ffffff', fx.burst ? 'rgba(255, 243, 176, 0.6)' : LIGHT_EDGE, 1 - fraction, !!fx.prism);
      return true;
    }
    if (fx.type === 'lmRail') {
      const tx = fx.targetX * U, ty = fx.targetY * U, w = (fx.width || 0.9) * U * 0.5;
      const h = this.handPoint(Math.atan2(fx.targetY - fx.y, fx.targetX - fx.x)); x = h.x; y = h.y + 14;
      if (this.lmStrip('lmRailBeam', x, y - 14, tx, ty - 14, { thick: Math.max(0.4, w * (1 - fraction * 0.5) / 8), alpha: 1 - fraction })) return true;
      this.lmBand(x, y - 14, tx, ty - 14, w * (1 - fraction * 0.5), '#e9f2ff', 'rgba(159, 187, 216, 0.6)', 1 - fraction);
      this.lmBand(x, y - 14, tx, ty - 14, 2, '#ffe086', 'rgba(255, 224, 134, 0.4)', 1 - fraction);
      return true;
    }
    if (!fx.look?.startsWith('lm')) return false;
    const r = (fx.value || 1) * U;
    if (fx.look === 'lmFlash') {
      if (this.lmSheet('lmFlashBurst', fraction * (FX.lmFlashBurst?.frames || 1), x, y, { sx: r / 54, sy: r / 54 })) return true;
      this.lmFloorEllipse(x, y, r * Math.min(1, fraction * 2.5), `rgba(255, 255, 240, ${0.6 * (1 - fraction)})`, `rgba(255, 230, 110, ${1 - fraction})`, 2.5);
      c.save(); c.globalAlpha = 1 - fraction; this.lmStar(x, y - 10, 8 + fraction * 10, '#ffffff'); c.restore();
      return true;
    }
    if (fx.look === 'lmSlam') {
      if (this.lmSheet('lmSlam', fraction * (FX.lmSlam?.frames || 1), x, y, { sx: r / 62, sy: r / 62, alpha: Math.min(1, (1 - fraction) * 3) })) return true;
      this.lmFloorEllipse(x, y, r * (0.6 + fraction * 0.5), null, `rgba(207, 230, 255, ${1 - fraction})`, 3);
      for (let i = 0; i < 10; i++) { const a = i * 0.63, d = fraction * r * 0.9; this.rect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d * FLOOR_FLAT - 2 - fraction * 10 + fraction * fraction * 14, 4, 3, i % 3 ? '#8d939c' : COPPER); }
      return true;
    }
    if (fx.look === 'lmPillar') {
      // The PixelLab shaft of sunlight (one picture): it narrows and fades as it goes.
      if (this.lmSheet('lmPillar', 0, x, y, { alpha: 1 - fraction * fraction, sx: (r / 30) * (1 - 0.35 * fraction), sy: 0.9 })) return true;
      c.save(); c.globalAlpha = 0.65 * (1 - fraction); const w = r * 0.9; const gr = c.createLinearGradient(0, y - 70, 0, y); gr.addColorStop(0, 'rgba(255, 214, 120, 0)'); gr.addColorStop(1, 'rgba(255, 240, 190, 1)'); c.fillStyle = gr; c.fillRect(x - w / 2, y - 70, w, 70); c.restore();
      this.lmFloorEllipse(x, y, r, `rgba(255, 190, 90, ${0.35 * (1 - fraction)})`);
      return true;
    }
    if (fx.look === 'lmSunBurst' || fx.look === 'lmMoltenBurst') {
      const name = fx.look === 'lmSunBurst' ? 'lmSunBurst' : 'lmMoltenBurst';
      if (this.lmSheet(name, fraction * (FX[name]?.frames || 1), x, y, { sx: r / 50, sy: r / 50 })) return true;
      const hot = fx.look === 'lmMoltenBurst';
      this.lmFloorEllipse(x, y, r * (0.5 + fraction * 0.5), `rgba(${hot ? '255, 120, 50' : '255, 200, 90'}, ${0.5 * (1 - fraction)})`, `rgba(255, 240, 180, ${1 - fraction})`, 3);
      if (hot) for (let i = 0; i < 10; i++) { const a = i * 0.63; this.circle(x + Math.cos(a) * fraction * 32, y - 8 + Math.sin(a) * fraction * 18 + fraction * fraction * 14, 2, '#ff9a40'); }
      return true;
    }
    if (fx.look === 'lmIronSet' || fx.look === 'lmShatter') {
      if (this.lmSheet('lmIronSet', fraction * (FX.lmIronSet?.frames || 1), x, y)) return true;
      this.lmFloorEllipse(x, y, r * (0.6 + fraction * 0.6), null, `rgba(207, 230, 255, ${1 - fraction})`, 2);
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, d = 4 + fraction * r; this.rect(x + Math.cos(a) * d - 1, y + Math.sin(a) * d * FLOOR_FLAT - 12 - 1, 2, 2, '#c9d6e4'); }
      return true;
    }
    return false;
  }
};
