// What makes chapter 3's boss patterns land big (2026-11-19, the user's word: make Tick·Tock's and Belgard's pattern
// effects feel grander, more like a boss): the screen rumbling with a flash of the pattern's colour when one lands
// (bossImpact, from main.js feelHits on the rules' 'quake' hits), a column of light going up where the biggest land
// (the 'bossPillar' look, game.bossQuake), and the screen's edges darkening while one of their big patterns runs.
// Installed on CanvasRenderer.prototype, so `this` is the renderer.
import { FLOOR_FLAT } from '../engine/math.js';
import { FX } from './fx-sprites.js';

const TAU = Math.PI * 2;
/** The patterns that darken the room while they run, and the dark each boss brings (Tick·Tock wine, Belgard night). */
// (Their everyday blows, Belgard's rings, cracks and bell included, do not: the room would never stop darkening.)
// (Belgard's resonance left the set with the pattern, 2026-11-21.)
const GRAND = new Set(['ttPendulum', 'ttShuffle', 'ttBlade', 'ttPincer', 'ttFlank', 'bgRain', 'bgNeedles', 'bgToll']);
const GLOOM = { tt: [28, 6, 12], bg: [8, 12, 26] };
/** How dark the corners get at most, and how fast the dark comes and goes (per second). */
const GLOOM_MAX = 0.5, GLOOM_RATE = 2.5;
/** A landing's flash: how long it lasts and how strong at power 1 (added light over the frame). */
const IMPACT_MS = 200, IMPACT_ALPHA = 0.2;
/** A column of light: its height in world pixels and the share of its time it takes to rise. */
const PILLAR_TALL = 240, PILLAR_RISE = 0.18;

export const bossGrandeur = {
  /** A boss pattern landing: the screen rumbles (longer and harder with `power`) and flashes in `color`. */
  bossImpact(power = 1, color = '#ffd257', calm = false) {
    const now = performance.now();
    if (!calm) this.kick(Math.round(2 + 5 * Math.min(1.4, power)), undefined, 180 + 220 * Math.min(1.4, power));
    const strength = calm ? power * 0.5 : power;
    if (!this.impact || now > this.impact.until || strength >= this.impact.power) this.impact = { at: now, until: now + IMPACT_MS * (0.7 + 0.5 * Math.min(1.4, power)), power: strength, color };
  },
  /** The flash of the last landing, added over the frame (screen space). */
  drawBossImpact() {
    const f = this.impact, now = performance.now();
    if (!f || now >= f.until) return;
    const left = (f.until - now) / (f.until - f.at), c = this.ctx;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.globalAlpha = IMPACT_ALPHA * Math.min(1.4, f.power) * left * left;
    c.fillStyle = f.color; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore();
  },
  /**
   * While one of their big patterns runs (or a phase break holds the room), the screen's edges sink into the boss's
   * dark, so the floor's warnings and the bodies in the middle stand out; it comes and goes over 0.4 s.
   */
  drawBossGloom() {
    const s = this.game.s, now = performance.now(), dt = Math.min(0.1, (now - (this.gloomAt || now)) / 1000);
    this.gloomAt = now;
    const field = (s.bossFields || []).find(f => GRAND.has(f.kind) && !f.done), breaking = s.enemies.find(e => e.hp > 0 && e.boss && e.breaking && ['twinTickTock', 'bellguard'].includes(e.type));
    const want = s.mode === 'combat' && (field || breaking) ? 1 : 0;
    if (field || breaking) this.gloomTone = (field ? field.kind.startsWith('tt') : breaking.type === 'twinTickTock') ? GLOOM.tt : GLOOM.bg;
    this.gloom = (this.gloom || 0) + Math.max(-GLOOM_RATE * dt, Math.min(GLOOM_RATE * dt, want - (this.gloom || 0)));
    if (this.gloom <= 0.01 || !this.gloomTone) return;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, [r, g, b] = this.gloomTone;
    // The gradient at its full dark, made once per screen size and tone (2026-11-21, the chapter 3 code review: it was
    // rebuilt every frame); the fade in and out is the alpha it is drawn at.
    const key = `${W}x${H}:${this.gloomTone}`;
    if (this.gloomFill?.key !== key) {
      const fill = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      fill.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`); fill.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${GLOOM_MAX})`);
      this.gloomFill = { key, fill };
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = this.gloom; c.fillStyle = this.gloomFill.fill; c.fillRect(0, 0, W, H); c.restore();
  },
  /**
   * A column of light going up from the floor where a big blow landed: a glow on the floor, three bands of light (the
   * pattern's colour outside, white in the core) shooting up and thinning out, and motes rising inside it.
   */
  drawBossPillar(fx, x, y, t) {
    const c = this.ctx, w = Math.max(7, Math.min(30, fx.value * 20 * 0.3)), rise = Math.min(1, t / PILLAR_RISE);
    const fade = t < 0.3 ? 1 : Math.max(0, 1 - (t - 0.3) / 0.7), tall = PILLAR_TALL * (1 - (1 - rise) ** 3), thin = 0.35 + 0.65 * fade;
    c.save();
    // The colour laid over the floor (on a bright floor added light alone washes out to white), then light added inside it.
    c.globalAlpha = 0.35 * fade; c.fillStyle = fx.color; c.beginPath(); c.ellipse(x, y, w * 1.8, w * 1.8 * FLOOR_FLAT, 0, 0, TAU); c.fill();
    // Each band's gradient is made once per colour over a unit height and stretched to the column (2026-11-21, the chapter
    // 3 code review: three were made per pillar per frame, ~36 a frame when Tick·Tock's colour floor blew).
    const top = Math.round(y - tall), height = Math.max(1, Math.round(y - top));
    for (const [k, a, colour, mode] of [[1, 0.45, fx.color, 'source-over'], [0.55, 0.4, fx.color, 'lighter'], [0.18, 0.75, '#ffffff', 'lighter']]) {
      const half = Math.max(1, Math.round(w * k * thin)), grads = this.pillarFills ??= new Map();
      let fill = grads.get(colour);
      if (!fill) { fill = c.createLinearGradient(0, 0, 0, 1); fill.addColorStop(0, 'rgba(255, 255, 255, 0)'); fill.addColorStop(0.4, colour); fill.addColorStop(1, colour); grads.set(colour, fill); }
      c.save(); c.translate(Math.round(x - half), top); c.scale(1, height);
      c.globalCompositeOperation = mode; c.globalAlpha = a * fade; c.fillStyle = fill; c.fillRect(0, 0, half * 2, 1); c.restore();
    }
    c.globalCompositeOperation = 'lighter';
    // Motes: whole pixels rising through the column at their own speeds (seeded by the effect's id, so they keep their places).
    let h = 0; for (const ch of String(fx.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    c.globalAlpha = 0.9 * fade; c.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      h = (h * 1103515245 + 12345) >>> 0; const ox = ((h >> 8) % 1000) / 1000 * 2 - 1, speed = 0.6 + ((h >> 4) % 100) / 100;
      const up = (t * speed * 1.6 + i / 8) % 1, size = i % 3 ? 2 : 3;
      c.fillRect(Math.round(x + ox * w * 1.1), Math.round(y - up * tall * 0.9), size, size);
    }
    c.restore();
    return true;
  },
  /**
   * Pixelfx gems in a row along a path of screen points (`pts`, closed when the last is the first), every `spacing` px
   * between `from` and `to` (shares of its length); each gem's pulse a little behind the last, so light runs along the
   * row. Replaces lines drawn in code on the floor (2026-11-19). False while the sheet loads (the caller draws its line).
   */
  gemPath(colour, pts, { spacing = 16, alpha = 1, from = 0, to = 1 } = {}) {
    const name = `gem_${colour}`, fx = FX[name];
    if (!fx || !this.mapImages?.get(fx.sheet) || pts.length < 2) return false;
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    const start = total * from, end = total * to, closed = from === 0 && to === 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1];
    if (end - start < 1) return true;
    const n = Math.max(1, Math.round((end - start) / spacing)), step = (end - start) / n, now = this.visualTime * fx.fps;
    let i = 0, acc = 0;
    for (let k = 0; k <= (closed ? n - 1 : n); k++) {
      const d = start + k * step;
      while (i < seg.length - 1 && acc + seg[i] < d) { acc += seg[i]; i++; }
      const u = seg[i] ? Math.min(1, (d - acc) / seg[i]) : 0, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
      this.drawFxFrame(name, ((now - k * 1.5) % fx.frames + fx.frames) % fx.frames, Math.round(x), Math.round(y), { alpha });
    }
    return true;
  },
  /** Points round an ellipse (a ring on the floor) from angle a0 to a1. */
  ellipsePts(x, y, rx, ry, a0 = 0, a1 = TAU) {
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / TAU * 96)), pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]); }
    if (Math.abs(Math.abs(a1 - a0) - TAU) < 1e-6) pts[pts.length - 1] = [...pts[0]];
    return pts;
  },
  /** Gems round a ring on the floor (radius `r` px, flattened as the floor is), from a0 to a1. */
  gemRing(colour, x, y, r, opts = {}, a0 = 0, a1 = TAU) {
    // (The sheet is checked before the ~97 points are made: they were built every frame while it loaded or was missing.)
    const fx = FX[`gem_${colour}`];
    if (!fx || !this.mapImages?.get(fx.sheet)) return false;
    return this.gemPath(colour, this.ellipsePts(x, y, r, r * FLOOR_FLAT, a0, a1), opts);
  },
  /**
   * A pixelfx piece (running right from its origin, `step` px long) laid end to end from (x, y) along screen heading
   * `angle` for `len` px, the last one cut to fit: the metronome's rod, the humming thread, the line blowing.
   */
  tileAlong(name, x, y, angle, len, frame, { step = 32, alpha = 1, lead = 0 } = {}) {
    const fx = FX[name], c = this.ctx, cos = Math.cos(angle), sin = Math.sin(angle);
    if (!fx || !this.mapImages?.get(fx.sheet)) return false;
    for (let d = 0; d < len; d += step) {
      const part = Math.min(step, len - d), cut = part < step;
      if (cut) { c.save(); c.translate(x, y); c.rotate(angle); c.beginPath(); c.rect(d, -fx.h, part, fx.h * 2); c.clip(); c.rotate(-angle); c.translate(-x, -y); }
      this.drawFxFrame(name, frame, x + cos * (d + lead), y + sin * (d + lead), { angle, alpha });
      if (cut) c.restore();
    }
    return true;
  },
};
