// What the grand tuner Orden puts in the room (src/engine/orden-boss.js), drawn with his pixelfx sheets
// (art/chapters/3-clock-tower/bosses/orden/fx; sources in fx/src): the bolt, rune, orbs, hearts, sigils and gold soldier
// (od-parts), the element lanes gathering, blowing and what fire and ice leave behind (od-lane-charge, od-lane-blow), the
// fence's light wall, the aim arrows, the falling floor and its holes, the cannon's surge and the eye's glint (od-parts2).
// 2026-11-19 (the user's word): no rows of dots in place of lines and no effects drawn in code; what is left in code is the
// plain warning washes every boss uses. Installed on CanvasRenderer.prototype, so `this` is the renderer; the floor parts
// come from drawClockBossFloor, the rest from drawClockBossOver and drawClockTell.
import { FLOOR_FLAT } from '../engine/math.js';
import { OD_COLOURS } from '../engine/orden-boss.js';
import { FX } from './fx-sprites.js';

const TAU = Math.PI * 2, GOLD = '#ffd257', RED = '#e0303c', SAFE = '#2fae63';
/** Each element's colour (orden-boss.js OD_COLOURS) as 'r, g, b', for the lanes' band of light. */
const RGB = Object.fromEntries(Object.entries(OD_COLOURS).map(([k, hex]) => [k, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')]));
/**
 * How far past its floor a safe floor's green motes (odLaneCharge_safe, up to 1.15 times its size) can reach, in floor
 * units: odSafeWash keeps a danger that far off in its clip.
 */
const MOTE_PAD = (() => { const fx = FX.odLaneCharge_safe, k = 1.15 / 20; return fx ? { x: fx.anchor[0] * k, up: fx.anchor[1] * k, down: (fx.h - fx.anchor[1]) * k } : { x: 3, up: 3, down: 3 }; })();
const rect = (c, r) => { c.beginPath(); c.rect(r.x0 * 20, r.y0 * 20, (r.x1 - r.x0) * 20, (r.y1 - r.y0) * 20); };
const ellipse = (c, x, y, r) => { c.beginPath(); c.ellipse(x, y, r * 20, r * 20 * FLOOR_FLAT, 0, 0, TAU); };
const isOrden = e => e && (e.type === 'orden' || e.type === 'ordenFinal');
/** His eye on the cracked side of the mask, from his feet in world px (checked against the imported sprite). */
const ORDEN_EYE = -68;
/** A steady pseudo-random number for a spot (so a scatter keeps its shape frame to frame). */
const hashOf = (...n) => { let h = 2166136261; for (const v of n) h = Math.imul(h ^ Math.round(v * 97), 16777619) >>> 0; return () => { h = (h * 1103515245 + 12345) >>> 0; return ((h >> 8) & 0xffff) / 0x10000; }; };

export const ordenBossDraw = {
  /**
   * The stopped time's warning (2026-11-22): the floor each turning hand will sweep in the next handWarn seconds, washed
   * red, a band at a time between its inner end and its tip, the minute hand's gap (odHandGap) left clear.
   */
  odHandWarn(b, since) {
    const g = this.game, dial = b.dial, rule = g.breakRule(g.s.enemies.find(e => e.breaking === b), b.index), warn = rule?.handWarn;
    if (!dial || !warn) return;
    const c = this.ctx, at = (a, s) => [(dial.x + Math.cos(a) * dial.rx * s) * 20, (dial.y + Math.sin(a) * dial.ry * s) * 20];
    c.beginPath();
    for (const q of b.bullets) {
      const hand = q.hand;
      if (!hand || hand.m !== 0 || q.gone) continue;
      const a0 = hand.at + hand.spin * since, steps = 10, da = hand.spin * warn / steps;
      for (let i = 0; i < steps; i++) {
        const a = a0 + da * i, a1 = a + da, gap = g.odHandGap(dial, hand, a + da / 2);
        for (const [lo, hi] of gap ? [[hand.s0, gap[0]], [gap[1], hand.reach]] : [[hand.s0, hand.reach]]) {
          if (hi <= lo) continue;
          c.moveTo(...at(a, lo)); c.lineTo(...at(a, hi)); c.lineTo(...at(a1, hi)); c.lineTo(...at(a1, lo)); c.closePath();
        }
      }
    }
    this.washFloor(0.42, RED);
  },
  /**
   * Pieces of a sheet laid over a box of floor in a loose grid (`step` floor units apart), each jittered and with its own
   * lag; `frameOf(lag, rnd)` gives the frame to show (null to skip). Lanes, plates, holes and the cannon's half use it.
   */
  odTile(name, r, step, frameOf, { alpha = 1, angle = 0, size = [0.85, 1.15], skip = 0, flip = false } = {}) {
    const fx = FX[name];
    if (!fx || !this.mapImages?.get(fx.sheet)) return false;
    const w = r.x1 - r.x0, h = r.y1 - r.y0, nx = Math.max(1, Math.round(w / step)), ny = Math.max(1, Math.round(h / (step * 0.7)));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const rnd = hashOf(r.x0, r.y0, i, j);
      if (rnd() < skip) continue;
      const x = r.x0 + w * (i + 0.2 + rnd() * 0.6) / nx, y = r.y0 + h * (j + 0.25 + rnd() * 0.5) / ny, frame = frameOf(rnd() * 0.2, rnd), k = size[0] + rnd() * (size[1] - size[0]);
      if (frame === null || frame < 0) continue;
      this.drawFxFrame(name, frame, x * 20, y * 20, { angle, sx: flip && rnd() < 0.5 ? -k : k, sy: k, alpha });
    }
    return true;
  },
  /**
   * Every red floor of his down this frame that a green one must never sit on (2026-11-21, the user's word: where a safe
   * and a danger floor overlapped it read both ways): the danger lanes (his tells and the bars about to blow), burning fire
   * lanes, the press's falling cells, the quartet's lit quarters, the floor a march still sweeps and the rings' bands to
   * come. Each is { box, add }: its bounds in floor units, and a function adding its shape to the current path; worked
   * out once a frame.
   */
  odDangers() {
    const s = this.game.s, t = s.time;
    if (this.odDangerAt === t && this.odDangerList) return this.odDangerList;
    const out = [], box = r => out.push({ box: r, add: c => c.rect(r.x0 * 20, r.y0 * 20, (r.x1 - r.x0) * 20, (r.y1 - r.y0) * 20) });
    const round = (x, y, r) => ({ x0: x - r, x1: x + r, y0: y - r * FLOOR_FLAT, y1: y + r * FLOOR_FLAT });
    const lanes = bar => bar.lanes.forEach((r, i) => { if (!(bar.safes || [bar.safe]).includes(i)) box(r); });
    for (const e of s.enemies) if (e.hp > 0 && e.tell?.lanes && (isOrden(e) || e.type === 'ordenEcho')) e.tell.lanes.forEach(lanes);
    for (const f of s.bossFields || []) {
      if (f.kind === 'odLanes') { for (const b of f.bars) if (!b.done && t >= b.show) lanes(b); for (const m of f.marks) if (m.element === 'fire' && t < m.until) box(m); }
      if (f.kind === 'odPress' && !f.done && t >= f.from) for (const cell of f.cells) if (!cell.safe) box(cell);
      if (f.kind === 'odNova') for (const { ring, inner, outer } of this.odNovaBands(f, t)) { const r = round(f.x, f.y, outer); for (const [a0, a1] of ring.spans) out.push({ box: r, add: c => this.odNovaSector(c, f, inner, outer, a0, a1) }); }
      if (f.kind === 'odQuartet' && !f.blown) for (const q of f.quads) if (q.element && t >= q.show) box(q);
      if (f.kind === 'odMarch' && t >= f.from) {
        const band = 0.45 + this.game.config.arena.playerRadius, live = f.lines.filter(l => !l.over), at = l => (t >= l.start ? l.y - band : f.top);
        live.forEach((l, i) => { const y0 = at(l), y1 = i === 0 ? f.bottom : at(live[i - 1]); if (y1 > y0) { box({ x0: f.left, x1: l.gap - f.half, y0, y1 }); box({ x0: l.gap + f.half, x1: f.right, y0, y1 }); } });
      }
      if (f.kind === 'odRings' && t >= f.from) for (const b of f.bands) if (!b.done) out.push({ box: round(f.x, f.y, b.hi), add: c => {
        const x = f.x * 20, y = f.y * 20;
        c.moveTo(x + b.hi * 20, y); c.ellipse(x, y, b.hi * 20, b.hi * 20 * FLOOR_FLAT, 0, 0, TAU);
        if (b.lo > 0) { c.moveTo(x + b.lo * 20, y); c.ellipse(x, y, b.lo * 20, b.lo * 20 * FLOOR_FLAT, 0, 0, TAU); }
      } });
    }
    this.odDangerAt = t; this.odDangerList = out; return out;
  },
  /** The stretches of floor each nova ring will reach next: [{ ring, inner, outer }] in floor units from its middle. */
  odNovaBands(f, t) {
    const out = [];
    let outer = f.range;
    for (const ring of f.rings) {
      if (ring.done) continue;
      const inner = t >= ring.at ? ring.r : 0;
      if (outer > inner + 0.05) out.push({ ring, inner, outer });
      // The next ring reaches only floor this one has already passed.
      outer = t >= ring.at ? ring.r : 0;
      if (outer <= 0) break;
    }
    return out;
  },
  /** Adds an annular sector of the nova (floor shape, `inner` to `outer`, angles a0 to a1) to the current path. */
  odNovaSector(c, f, inner, outer, a0, a1) {
    const x = f.x * 20, y = f.y * 20;
    c.moveTo(x + Math.cos(a0) * outer * 20, y + Math.sin(a0) * outer * 20 * FLOOR_FLAT);
    c.ellipse(x, y, outer * 20, outer * 20 * FLOOR_FLAT, 0, a0, a1);
    if (inner > 0.05) c.ellipse(x, y, inner * 20, inner * 20 * FLOOR_FLAT, 0, a1, a0, true); else c.lineTo(x, y);
    c.closePath();
  },
  /**
   * The mob library with every sheet it is asked for recoloured in Orden's gold (2026-11-21, the user's word: the march's
   * soldiers, a sepia filter over chapter 1's guard, looked muddy): each pixel's brightness mapped onto a run of golds
   * from dark bronze to a pale shine, as a toy cast in gold. Worked out once per sheet and kept.
   */
  odGoldLibrary() {
    const lib = this.mobSprites;
    if (!lib || typeof document === 'undefined') return null;
    if (this.odGold?.base === lib) return this.odGold.wrap;
    const cache = new Map(), RAMP = [[38, 22, 8], [96, 58, 18], [168, 112, 36], [226, 170, 62], [255, 226, 140], [255, 248, 222]];
    const gold = image => {
      const cv = document.createElement('canvas'); cv.width = image.width; cv.height = image.height;
      const g = cv.getContext('2d'); g.drawImage(image, 0, 0);
      const data = g.getImageData(0, 0, cv.width, cv.height), px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        const l = Math.min(0.999, (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255 * 1.15), at = l * (RAMP.length - 1), k = Math.floor(at), f = at - k, a = RAMP[k], b = RAMP[k + 1];
        px[i] = a[0] + (b[0] - a[0]) * f; px[i + 1] = a[1] + (b[1] - a[1]) * f; px[i + 2] = a[2] + (b[2] - a[2]) * f;
      }
      g.putImageData(data, 0, 0); return cv;
    };
    const wrap = {
      clip: (action, direction) => lib.clip(action, direction),
      image: url => { if (cache.has(url)) return cache.get(url); const image = lib.image(url); if (!image?.width) return image; const done = gold(image); cache.set(url, done); return done; },
    };
    this.odGold = { base: lib, wrap };
    return wrap;
  },
  /**
   * A safe floor washed green only where none of odDangers lies: `box` its bounds in floor units, `shape` adding its path
   * (the box itself unless given); `then` draws its green motes, clipped the same.
   */
  odSafeWash(box, alpha, then, shape = c => c.rect(box.x0 * 20, box.y0 * 20, (box.x1 - box.x0) * 20, (box.y1 - box.y0) * 20)) {
    const c = this.ctx, pad = then ? MOTE_PAD : { x: 0, up: 0, down: 0 }, x0 = box.x0 - pad.x, x1 = box.x1 + pad.x, y0 = box.y0 - pad.up, y1 = box.y1 + pad.down;
    c.save();
    // Clipping to the outside of each danger in turn leaves the outside of all of them (an even-odd hole per shape). Only
    // the dangers whose bounds meet this floor's (with its motes' reach) are clipped (2026-11-21, the cleanup: a crossing
    // tell clipped the whole canvas some 48 times a frame).
    for (const d of this.odDangers()) if (d.box.x0 < x1 && d.box.x1 > x0 && d.box.y0 < y1 && d.box.y1 > y0) { c.beginPath(); c.rect(-100000, -100000, 200000, 200000); d.add(c); c.clip('evenodd'); }
    c.beginPath(); shape(c); this.washFloor(alpha, SAFE); then?.();
    c.restore();
  },
  // (The danger lanes wash red for every element since 2026-11-20, the user's word: ice, wind and lightning tints were
  // hard to see; the element shows in the gathering pieces.)
  /** One bar of element lanes before it blows: the lanes gather their element over a light wash, the safe one green motes. */
  odLaneWarn(bar, k) {
    const c = this.ctx, now = this.visualTime * 20;
    bar.lanes.forEach((r, i) => {
      if ((bar.safes || [bar.safe]).includes(i)) this.odSafeWash(r, 0.45 + 0.2 * k, () => this.odTile('odLaneCharge_safe', r, 2.2, (lag, rnd) => now + rnd() * 16, { alpha: 0.9 }));
      else {
        rect(c, r); this.dangerWash(0.3 + 0.4 * k + (k > 0.8 ? Math.sin(this.game.s.time * 40) * 0.05 : 0));
        // The lane filling with its element as one band of light along it (2026-11-21, the review: the repeated pieces
        // alone read as stamps), brightest down its middle and surging as the blow nears; the pieces ride over it.
        { const along = r.x1 - r.x0 >= r.y1 - r.y0, mx = (r.x0 + r.x1) * 10, my = (r.y0 + r.y1) * 10, half = (along ? r.y1 - r.y0 : r.x1 - r.x0) * 10;
          const band = along ? c.createLinearGradient(0, my - half, 0, my + half) : c.createLinearGradient(mx - half, 0, mx + half, 0), col = RGB[bar.element] || '127, 232, 255';
          const glow = (0.12 + 0.3 * k) * (0.8 + 0.2 * Math.sin(this.game.s.time * 12));
          band.addColorStop(0, `rgba(${col}, 0)`); band.addColorStop(0.5, `rgba(${col}, ${glow.toFixed(3)})`); band.addColorStop(1, `rgba(${col}, 0)`);
          c.save(); rect(c, r); c.globalCompositeOperation = 'lighter'; c.fillStyle = band; c.fill(); c.restore(); }
        this.odTile(`odLaneCharge_${bar.element}`, r, 2.2, (lag, rnd) => now + rnd() * 16, { alpha: 0.45 + 0.55 * k }); }
    });
  },
  /** Where a lane blew: its element's burst over the whole lane, each piece a little behind the next; fire and ice stay. */
  odLaneBlow(m, t) {
    const age = t - m.at, along = m.x1 - m.x0 > m.y1 - m.y0, blow = FX[`odLaneBlow_${m.element}`];
    const linger = FX[`odLaneLinger_${m.element}`], fade = Math.max(0, Math.min(1, (m.until - t) / 0.4));
    if (linger && t < m.until && age > 0.25) this.odTile(`odLaneLinger_${m.element}`, m, m.element === 'ice' ? 1.9 : 2.4, (lag, rnd) => this.visualTime * 20 + rnd() * 16, { alpha: fade * Math.min(1, (age - 0.25) / 0.3), flip: true, size: m.element === 'ice' ? [0.75, 1.2] : [0.85, 1.15] });
    if (blow && age < blow.frames / blow.fps + 0.25) this.odTile(`odLaneBlow_${m.element}`, m, 2.6, lag => (age - lag) * blow.fps < blow.frames ? (age - lag) * blow.fps : null, { angle: m.element === 'wind' ? (along ? 0 : Math.PI / 2) : 0, skip: 0.15 });
  },
  /** Under the bodies. */
  drawOrdenFloor() {
    const g = this.game, s = g.s, t = s.time, c = this.ctx;
    if (!s.enemies.some(isOrden)) return;
    // His power under him (2026-11-20, the user's word: a final boss): the halo of a clock turning round him, and while he
    // casts (his mirror images too) a clock circle of light on the floor, gold at the last hour.
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.hidden || !(isOrden(e) || e.type === 'ordenEcho')) continue;
      const final = e.type === 'ordenFinal' || (e.type === 'ordenEcho' && s.enemies.some(o => o.type === 'ordenFinal'));
      if (isOrden(e)) this.drawFxFrame(final ? 'odAuraGold' : 'odAura', this.visualTime * FX.odAura.fps + e.x, e.x * 20, e.y * 20, { sx: final ? 1.25 : 1.1, sy: final ? 1.25 : 1.1 });
      if (e.tell) { const k = Math.min(1, (t - e.tell.started) / 0.25), size = (final ? 1.25 : 1) * (e.type === 'ordenEcho' ? 0.75 : 1) * (0.6 + 0.4 * k); this.drawFxFrame(final ? 'odCastCircleGold' : 'odCastCircle', this.visualTime * FX.odCastCircle.fps, e.x * 20, e.y * 20, { sx: size, sy: size, alpha: k }); }
    }
    const clipped = this.clipToFloor(g.map);
    for (const f of s.bossFields || []) {
      switch (f.kind) {
        case 'odLanes':
          for (const b of f.bars) if (!b.done && t >= b.show) this.odLaneWarn(b, Math.max(0, Math.min(1, (t - b.show) / Math.max(0.1, b.at - b.show))));
          for (const m of f.marks) this.odLaneBlow(m, t);
          break;
        case 'odRunes':
          for (const w of f.waves) {
            if (w.done || !w.spots) continue;
            const k = Math.max(0, Math.min(1, (t - w.show) / (w.at - w.show)));
            // The grand rune (pixelfx od-rune2), growing in from half size and flickering bright in its last moment.
            const grow = (0.6 + 0.4 * Math.min(1, k * 2.5)) * f.radius * 20 / 30, flick = k > 0.8 ? 0.75 + 0.25 * Math.sin(t * 50) : 1;
            for (const at of w.spots) {
              ellipse(c, at.x * 20, at.y * 20, f.radius); this.dangerWash(0.25 + 0.4 * k);
              this.drawFxFrame('odRune2', this.visualTime * FX.odRune2.fps, at.x * 20, at.y * 20, { sx: grow, sy: grow, alpha: (0.55 + 0.45 * k) * flick });
            }
          }
          break;
        case 'odFence': {
          const k = Math.min(1, (t - f.from) / (f.until - f.from));
          if (k > 0.6) { ellipse(c, f.x * 20, f.y * 20, f.r ?? f.r0); this.dangerWash(0.15 + 0.4 * (k - 0.6) / 0.4); }
          break;
        }
        case 'odPress': {
          const k = Math.max(0, Math.min(1, (t - f.from) / (f.at - f.from)));
          if (f.done || t < f.from) break;
          for (const cell of f.cells) {
            if (cell.safe) { this.odSafeWash(cell, 0.3, () => this.odTile('odLaneCharge_safe', cell, 1.6, (lag, rnd) => this.visualTime * 20 + rnd() * 16)); continue; }
            rect(c, cell);
            { this.dangerWash(0.18 + 0.4 * k); const cx = (cell.x0 + cell.x1) * 10, cy = (cell.y0 + cell.y1) * 10, r = (cell.x1 - cell.x0) * 10 * (0.4 + 0.5 * k); c.beginPath(); c.ellipse(cx, cy, r, r * FLOOR_FLAT, 0, 0, TAU); c.save(); c.globalAlpha = 0.25 + 0.35 * k; c.fillStyle = '#2a1a10'; c.fill(); c.restore(); }
          }
          break;
        }
        case 'odMarch': {
          // The floor each line will still sweep (2026-11-20, the user's word: the old green lanes down the whole room and
          // the thin red strip read oddly): from the line (or the top, before it sets off) down to the line ahead of it,
          // or to the bottom for the leading line, red but for its gap in green. Each line shows only its own gap
          // (2026-11-21, the user's word: the safe zone looked wrong): the next line's gap used to show faintly below the
          // leading line too, a pale strip right beside the green that read as half safe while the leading line still hit it.
          if (t < f.from) break;
          // Measured from where a row really hits (2026-11-21, the user's word: the zones sat oddly in y): a row hurts
          // within band of its feet line (orden-boss.js: 0.45 + F2's radius), so its red starts that far above its feet,
          // and the floor it still sweeps runs from there down.
          const band = 0.45 + g.config.arena.playerRadius;
          const live = f.lines.filter(l => !l.over), at = l => (t >= l.start ? l.y - band : f.top);
          live.forEach((l, i) => {
            const y0 = at(l), y1 = i === 0 ? f.bottom : at(live[i - 1]), soon = t >= l.start ? 1 : Math.min(1, (t - f.from) / Math.max(0.1, l.start - f.from));
            if (y1 <= y0) return;
            const gx0 = l.gap - f.half, gx1 = l.gap + f.half;
            for (const [x0, x1] of [[f.left, gx0], [gx1, f.right]]) { c.beginPath(); c.rect(x0 * 20, y0 * 20, (x1 - x0) * 20, (y1 - y0) * 20); this.dangerWash((i === 0 ? 0.22 : 0.3) + 0.2 * soon); }
            this.odSafeWash({ x0: gx0, x1: gx1, y0, y1 }, 0.35 + 0.15 * soon);
          });
          // The row itself, a deeper red under the soldiers.
          for (const l of live) if (t >= l.start) for (const [x0, x1] of [[f.left, l.gap - f.half], [l.gap + f.half, f.right]]) { c.beginPath(); c.rect(x0 * 20, (l.y - band) * 20, (x1 - x0) * 20, band * 40); this.dangerWash(0.6); }
          break;
        }
        // Belgard's rings in Orden's gold (2026-11-20, the user's word: the deep red discs looked wrong): the bands that
        // wait faint, the next one red deepening to its toll, a gold rim round it. 2026-11-22 (the user's word, both ring
        // patterns): only the next band in red, deep from the start; none on the bands waiting or rung.
        case 'odRings': {
          const next = f.bands.findIndex(b => !b.done);
          if (next < 0 || t < f.from) break;
          const band = f.bands[next], prev = f.bands[next - 1], k = Math.max(0, Math.min(1, 1 - (band.at - t) / (band.at - (prev ? prev.at : f.from))));
          this.bellRingMarks(f.x * 20, f.y * 20, [f.bands[0].hi, f.bands[2].hi, f.bands[1].hi], next, { color: RED, nextAlpha: 0.8 + 0.2 * k, cover: 0.28 + 0.12 * k });
          for (const r of [band.lo, band.hi]) if (r > 0) { ellipse(c, f.x * 20, f.y * 20, r); c.save(); c.globalAlpha = 0.35 + 0.5 * k; c.strokeStyle = GOLD; c.lineWidth = 3; c.stroke(); c.restore(); }
          break;
        }
        case 'odHoles':
          for (const h of f.pieces) {
            if (t >= h.back) continue;
            const cx = (h.x0 + h.x1) * 10, cy = (h.y0 + h.y1) * 10, sx = (h.x1 - h.x0) * 20 / 52, sy = (h.y1 - h.y0) * 20 / 30;
            // About to go (2026-11-21, the user's word: it did not sit with the summit): a red oval where the floor will open,
            // deepening, and the marble cracking over it with cyan light leaking up; gone: the pit into the tower's dark
            // clockwork under a broken marble rim (pixelfx od-pit), not the sky.
            if (t < h.fall) {
              const k = Math.max(0, Math.min(1, 1 - (h.fall - t) / 1.2));
              c.beginPath(); c.ellipse(cx, cy, (h.x1 - h.x0) * 10, (h.y1 - h.y0) * 10, 0, 0, TAU); this.dangerWash(0.3 + 0.35 * k);
              this.drawFxFrame('odPitCrack', this.visualTime * 20, cx, cy, { sx: sx * (0.6 + 0.4 * k), sy: sy * (0.6 + 0.4 * k), alpha: 0.5 + 0.5 * k });
              continue;
            }
            const open = Math.min(1, (t - h.fall) / 0.2);
            this.drawFxFrame('odPit', this.visualTime * 20, cx, cy, { sx: sx * (0.7 + 0.3 * open), sy: sy * (0.7 + 0.3 * open), alpha: Math.min(1, (h.back - t) / 0.4, open) });
          }
          break;
        case 'odCannon': {
          // The apparatus's beam (2026-11-21, the user's pick from the review): the whole half washed in blinding cyan-white
          // light that pours out from his side and fades, its pieces of surge riding through it.
          const u = (t - f.at) / 0.6, owner = s.enemies.find(e => e.id === f.owner), ox = (owner?.x ?? (f.half.x0 + f.half.x1) / 2) * 20;
          const right = f.half.x1 - (owner?.x ?? 0) > (owner?.x ?? 0) - f.half.x0, far = (right ? f.half.x1 : f.half.x0) * 20;
          c.save(); rect(c, f.half); c.clip();
          const beam = c.createLinearGradient(ox, 0, far, 0);
          beam.addColorStop(0, `rgba(255, 255, 255, ${(0.75 * Math.max(0, 1 - u)).toFixed(3)})`); beam.addColorStop(0.35, `rgba(159, 244, 255, ${(0.5 * Math.max(0, 1 - u)).toFixed(3)})`); beam.addColorStop(1, 'rgba(63, 208, 232, 0)');
          c.globalCompositeOperation = 'lighter'; c.fillStyle = beam; c.fillRect(Math.min(ox, far), f.half.y0 * 20, Math.abs(far - ox), (f.half.y1 - f.half.y0) * 20);
          c.restore();
          this.odTile('odSurge', f.half, 2.4, (lag, rnd) => this.visualTime * 20 + rnd() * 16, { alpha: 0.7 * Math.max(0, 1 - u) ** 1.5, size: [1, 1.3] });
          break;
        }
        // The spreading fire: the cells about to catch washed orange and deepening, the burning ones in flame.
        case 'odFire': {
          // Round patches merged into one ragged field (2026-11-20, the user's word: square cells looked wrong): each stage's
          // patches make one path, washed once, so overlaps do not darken into spots.
          const blob = (cells, size) => { c.beginPath(); for (const cell of cells) { const r = size(cell) * 20; c.moveTo(cell.x * 20 + r, cell.y * 20); c.ellipse(cell.x * 20, cell.y * 20, r, r * FLOOR_FLAT, 0, 0, TAU); } };
          const soon = f.cells.filter(cell => !cell.lit && cell.at - t < 0.9), near = soon.filter(cell => cell.at - t < 0.45), far = soon.filter(cell => cell.at - t >= 0.45);
          if (far.length) { blob(far, cell => cell.r * 1.15); this.dangerWash(0.22); }
          if (near.length) { blob(near, cell => cell.r * 1.35); this.dangerWash(0.45); }
          const burning = f.cells.filter(cell => cell.lit && t < cell.until);
          if (burning.length) { blob(burning, cell => cell.r * 1.35 * Math.min(1, 0.5 + (t - cell.at) * 3)); this.washFloor(0.3 * Math.min(1, Math.max(...burning.map(cell => (cell.until - t) / 0.4))), '#ff5a1e'); }
          for (const cell of burning) {
            const age = t - cell.at, fade = Math.max(0, Math.min(1, (cell.until - t) / 0.4));
            if (age < 0.5) this.odTile('odLaneBlow_fire', cell, 2, lag => (age - lag) * 30 < FX.odLaneBlow_fire.frames ? (age - lag) * 30 : null, { size: [0.6, 0.8] });
            this.odTile('odLaneLinger_fire', cell, 1.8, (lag, rnd) => this.visualTime * 20 + rnd() * 16, { alpha: fade * Math.min(1, age / 0.3), size: [0.7, 0.9] });
          }
          break;
        }
        // The chain lightning: each side washed red, deepening till the bolt jumps it; then the bolt along it a moment.
        case 'odChain':
          // Where each bolt will come down (a disc deepening to its strike), and the live bolts' lanes between the rods.
          for (const st of f.strikes) if (!st.done && st.x !== undefined) { const k = Math.max(0, Math.min(1, 1 - (st.at - t) / f.show)); ellipse(c, st.x * 20, st.y * 20, f.radius); this.dangerWash(0.3 + 0.45 * k + (k > 0.8 ? Math.sin(t * 40) * 0.05 : 0)); }
          for (const ln of f.links) if (t < ln.until) {
            const a = f.rods[ln.a], b = f.rods[ln.b], len = Math.hypot(b.x - a.x, b.y - a.y) * 20, ang = Math.atan2(b.y - a.y, b.x - a.x), w = (f.width + g.config.arena.playerRadius) * 20;
            c.save(); c.translate(a.x * 20, a.y * 20); c.rotate(ang); c.beginPath(); c.rect(0, -w, len, w * 2); this.dangerWash(0.5); c.restore();
          }
          break;
        // The frost nova (2026-11-21, the user's word: its zones read oddly): each stretch of floor shows the ring that will
        // reach it next. Beyond the first ring, the first ring's arcs red and its openings green; between the first and
        // the second (floor the first has passed), the second's; inside the last ring, nothing.
        case 'odNova': {
          for (const { ring, inner, outer } of this.odNovaBands(f, t)) {
            const box = { x0: f.x - outer, x1: f.x + outer, y0: f.y - outer * FLOOR_FLAT, y1: f.y + outer * FLOOR_FLAT };
            for (const [a0, a1] of ring.spans) { c.beginPath(); this.odNovaSector(c, f, inner, outer, a0, a1); this.dangerWash(t >= ring.at ? 0.55 : 0.3 + 0.2 * Math.min(1, (t - f.from) / Math.max(0.1, ring.at - f.from))); }
            for (const gp of ring.gaps) this.odSafeWash(box, 0.4, null, cc => this.odNovaSector(cc, f, inner, outer, gp - f.half, gp + f.half));
          }
          break;
        }
        // The whirlwind on the floor, its pull washed faintly round it.
        case 'odVortex': {
          const k = Math.min(1, (t - f.from) / 0.4, (f.until - t) / 0.4);
          ellipse(c, f.x * 20, f.y * 20, 3.2); this.washFloor(0.22 * k, '#3c8a6c'); ellipse(c, f.x * 20, f.y * 20, f.eye); this.dangerWash(0.45 * k);
          this.drawFxFrame('odVortex', this.visualTime * FX.odVortex.fps, f.x * 20, f.y * 20, { sx: 1.5, sy: 1.5, alpha: k });
          this.drawFxFrame('odVortex', this.visualTime * FX.odVortex.fps * 1.6 + 5, f.x * 20, f.y * 20, { sx: -1.05, sy: 1.05, alpha: 0.7 * k });
          this.drawFxFrame('odVortex', this.visualTime * FX.odVortex.fps * 0.7 + 11, f.x * 20, f.y * 20, { sx: 2.1, sy: 2.1, alpha: 0.4 * k });
          break;
        }
        // The quartet: each lit quarter gathers its element; the dark one shows green in the last moment.
        case 'odQuartet': {
          const k = Math.max(0, Math.min(1, (t - f.from) / (f.at - f.from)));
          f.quads.forEach((q, i) => {
            // Each quarter's pieces kept inside it, so nothing spills onto the dark, safe one.
            if (q.element && t >= q.show) { const kq = Math.min(1, (t - q.show) / Math.max(0.1, f.at - q.show)); c.save(); rect(c, q); c.clip(); rect(c, q); this.dangerWash(0.1 + 0.1 * kq); this.odLaneWarn({ lanes: [q], safe: -1, element: q.element }, kq); c.restore(); }
            else if (i === f.dark && f.at - t < 0.9) this.odSafeWash(q, 0.3);
          });
          break;
        }
        case 'odLastHour': {
          const done = f.tolls.filter(x => x.done).length, k = done / f.tolls.length, owner = s.enemies.find(e => e.id === f.owner);
          // His gold dial under the whole room, turning faster with every toll (2026-11-21, the review: the twelve tolls
          // wanted more weight), and a gold flash over the floor at each one.
          if (owner) this.drawFxFrame('odCastCircleGold', this.visualTime * FX.odCastCircleGold.fps * (1 + k * 3), owner.x * 20, owner.y * 20, { sx: 1.4, sy: 1.4, alpha: 0.5 + 0.4 * k });
          const last = f.tolls.filter(x => x.done).at(-1);
          if (last && t - last.at < 0.35) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 * (1 - (t - last.at) / 0.35) * (done === f.tolls.length ? 2.5 : 1); c.fillStyle = '#ffd257'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
          c.beginPath(); c.rect(-4000, -4000, 8000, 8000);
          for (const at of f.safe) { c.moveTo(at.x * 20 + f.radius * 20, at.y * 20); c.ellipse(at.x * 20, at.y * 20, f.radius * 20, f.radius * 20 * FLOOR_FLAT, 0, 0, TAU); }
          c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = Math.max(0.48, 0.18 + 0.4 * k); c.fillStyle = '#e0303c'; c.fill('evenodd'); c.restore();
          for (const at of f.safe) this.odSafeRune(at, f.radius);
          break;
        }
      }
    }
    if (clipped) c.restore();
  },
  /** The last hour's safe floor: a gold wash under his own rune, turning (the gold glyph, not a ring of dots). */
  odSafeRune(at, radius, alpha = 1) {
    ellipse(this.ctx, at.x * 20, at.y * 20, radius); this.washFloor(0.3 * alpha, GOLD);
    this.drawFxFrame('odRune', this.visualTime * FX.odRune.fps, at.x * 20, at.y * 20, { sx: radius * 20 / 22, sy: radius * 20 / 22, alpha });
  },

  /** His warnings (from drawClockTell). */
  drawOrdenTell(enemy, tell, { x, y, progress = 0 }) {
    const c = this.ctx, g = this.game;
    const clipped = this.clipToFloor(g.map);
    if (tell.lanes) for (const bar of tell.lanes) this.odLaneWarn(bar, progress);
    if (tell.half) { rect(c, tell.half); this.dangerWash(0.15 + 0.45 * progress + (progress > 0.8 ? Math.sin(g.s.time * 40) * 0.06 : 0)); }
    if (tell.safe) for (const at of tell.safe) this.odSafeRune(at, g.config.bossAI.ordenFinal.lastHourSafe, 0.5 + 0.5 * progress);
    if (clipped) c.restore();
    // Where his images will stand: the summoning rift opening there.
    if (tell.spots) for (const at of tell.spots) this.drawFxFrame('summonRift', Math.min(8, progress * 9), at.x * 20, at.y * 20, { sx: 0.5, sy: 0.5 });
    if (tell.type === 'odNeedles' || tell.type === 'odFan') this.odArrows(x, y - 10, tell.angle, 9 * 20 * progress);
  },
  /** Arrows of light set along where a bolt will fly (in place of a drawn line). */
  odArrows(x, y, angle, len, alpha = 1) {
    for (let d = 26; d < len; d += 26) this.drawFxFrame('odArrow', this.visualTime * 20 - d / 8, x + Math.cos(angle) * d, y + Math.sin(angle) * d, { angle, alpha });
  },

  /** Over the bodies: bolts, the fence, orbs, the march's soldiers, press plates falling, the sigil, the break, his eye. */
  drawOrdenOver() {
    const g = this.game, s = g.s, t = s.time;
    if (!s.enemies.some(isOrden)) return;
    for (const f of s.bossFields || []) {
      // Ice mirrors (cracked after one blow; flashing as they bend a needle), lightning rods, the bolt jumping between them.
      if (f.kind === 'odMirror' && !f.done) for (const q of [...f.pillars].sort((a, b) => a.y - b.y)) if (!q.broken) {
        const grow = Math.min(1, (t - f.from) / 0.3), flash = q.flashAt > t - 0.35;
        this.drawFxFrame(q.hits ? 'odMirrorCracked' : 'odMirror', this.visualTime * FX.odMirror.fps, q.x * 20, q.y * 20, { sx: 0.9, sy: 0.9 * grow });
        if (flash) this.drawFxFrame('odGlint', this.visualTime * 20, q.x * 20, q.y * 20 - 30, { sx: 1.4, sy: 1.4 });
      }
      if (f.kind === 'odFire') {
        const seed = f.cells[f.seedCell];
        if (seed && !seed.lit) { const k = Math.max(0, Math.min(1, (t - f.from) / (seed.at - f.from))); this.drawFxFrame('odFireball', this.visualTime * FX.odFireball.fps, seed.x * 20, seed.y * 20 - (1 - k * k) * 150, { sx: 1.5, sy: 1.5 }); }
      }
      if (f.kind === 'odChain') {
        // A rod left standing where each bolt came down, fading with the last of its bolts.
        f.rods.forEach((r, i) => {
          if (!r) return;
          const live = Math.max(f.strikes[i].at + f.linger, ...f.links.filter(ln => ln.a === i || ln.b === i).map(ln => ln.until));
          const fade = Math.max(0, Math.min(1, (live - t) / 0.4, (t - f.strikes[i].at) / 0.15));
          this.drawFxFrame('odRod', this.visualTime * FX.odRod.fps + i, r.x * 20, r.y * 20, { sx: 0.9, sy: 0.9, alpha: fade });
        });
        // The bolt coming down on each strike, a short flash.
        for (const st of f.strikes) if (st.done && t - st.at < 0.25) this.tileAlong('odZap', st.x * 20, st.y * 20 - 260, Math.PI / 2, 260, this.visualTime * FX.odZap.fps, { step: 48, alpha: 1 - (t - st.at) / 0.25 });
        // The live bolts between rods, crackling until they go out.
        for (const ln of f.links) if (t < ln.until) {
          const a = f.rods[ln.a], b = f.rods[ln.b], ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y) * 20, fade = Math.min(1, (ln.until - t) / 0.4);
          this.tileAlong('odZap', a.x * 20, a.y * 20 - 30, ang, len, this.visualTime * FX.odZap.fps, { step: 48, alpha: fade });
          this.tileAlong('odZap', a.x * 20, a.y * 20 - 4, ang, len, this.visualTime * FX.odZap.fps + 7, { step: 48, alpha: 0.75 * fade });
        }
      }
      if (f.kind === 'odNova') for (const ring of f.rings) {
        if (t < ring.at || ring.done || ring.r < 0.5) continue;
        // The ring of ice running out (pixelfx ice-linger crystals set round it), its openings left bare.
        const n = Math.max(8, Math.ceil(TAU * ring.r / 0.9)), fade = Math.min(1, (f.range - ring.r) / 2);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU;
          if (ring.gaps.some(gp => Math.abs(Math.atan2(Math.sin(a - gp), Math.cos(a - gp))) <= f.half)) continue;
          this.drawFxFrame('odLaneLinger_ice', (this.visualTime * 20 + i * 3) % FX.odLaneLinger_ice.frames, f.x * 20 + Math.cos(a) * ring.r * 20, f.y * 20 + Math.sin(a) * ring.r * 20 * FLOOR_FLAT + 8, { sx: 0.8, sy: 0.8, alpha: fade });
        }
      }
      if (f.kind === 'odBolts') {
        // The locked line, the last 0.3 s before the bolt flies, as arrows of light.
        for (const v of f.volleys) if (!v.fired && v.angle !== null) this.odArrows(f.from.x * 20, f.from.y * 20 - 10, v.angle, 9 * 20);
        // Each bolt with two fading afterimages behind it along its flight.
        for (const b of f.bolts) if (!b.gone) {
          for (const [back, alpha] of [[0.9, 0.25], [0.45, 0.5]]) this.drawFxFrame('odBolt', this.visualTime * FX.odBolt.fps, (b.x - Math.cos(b.angle) * back) * 20, (b.y - Math.sin(b.angle) * back) * 20 - 10, { angle: b.angle, alpha });
          this.drawFxFrame('odBolt', this.visualTime * FX.odBolt.fps, b.x * 20, b.y * 20 - 10, { angle: b.angle, sx: 1.2, sy: 1.2 });
        }
      }
      if (f.kind === 'odFence' && !f.burstDone) {
        // The fence: a wall of cyan light standing round the ring (pieces back to front), open where a needle is pulled;
        // the four needles of light standing in it (Belgard's tuning needle sheet).
        const r = f.r ?? f.r0, turn = f.turn || 0, open = a => f.needles.some(n => n.out !== null && Math.abs(Math.atan2(Math.sin(a - n.angle - turn), Math.cos(a - n.angle - turn))) < Math.PI / 4);
        const pieces = Math.max(16, Math.round(TAU * r / 0.55)), wall = [];
        for (let i = 0; i < pieces; i++) { const a = i / pieces * TAU; if (!open(a)) wall.push({ x: (f.x + Math.cos(a) * r) * 20, y: (f.y + Math.sin(a) * r * FLOOR_FLAT) * 20, i }); }
        for (const n of f.needles) if (n.out === null) { const a = n.angle + turn; wall.push({ x: (f.x + Math.cos(a) * r) * 20, y: (f.y + Math.sin(a) * r * FLOOR_FLAT) * 20, needle: true }); }
        wall.sort((p, q) => p.y - q.y);
        for (const w of wall) if (w.needle) this.drawFxFrame('bgNeedle', this.visualTime * FX.bgNeedle.fps, w.x, w.y, { sx: 0.7, sy: 0.7 }); else this.drawFxFrame('odBarrier', this.visualTime * 20 + w.i * 1.3, w.x, w.y, { alpha: 0.85 });
      }
      if (f.kind === 'odOrbs') for (const o of f.orbs) if (o.state !== 'gone') this.drawFxFrame(o.dark ? 'odOrbDark' : 'odOrb', this.visualTime * FX.odOrb.fps + o.x, o.x * 20, o.y * 20 - 14);
      if (f.kind === 'odMarch') for (const l of f.lines) {
        if (l.over || t < l.start) continue;
        // Brass's own toy soldiers (the guard's walking clip from chapter 1) marching south in Orden's gold (2026-11-20, the
        // user's word: the tiny gold sticks did not read as soldiers), shoulder to shoulder, each a step out of time.
        const c = this.ctx;
        for (let x = f.left + 0.5, i = 0; x <= f.right; x += 1.1, i++) if (Math.abs(x - l.gap) > f.half) {
          const clip = this.mobSprites?.clip('guard-move', 'south'), frame = clip ? (Math.floor(this.visualTime * 12) + i * 3) % clip.frameCount : 0;
          c.save(); c.globalAlpha = 0.92;
          if (!this.drawSprite(x * 20, l.y * 20, { action: 'guard-move', direction: 'south', frame }, this.odGoldLibrary() || this.mobSprites)) this.drawFxFrame('odSoldier', this.visualTime * FX.odSoldier.fps + i * 3, Math.round(x * 20), Math.round(l.y * 20), { sx: 1.6, sy: 1.6 });
          c.restore();
        }
      }
      // The rings' gold bell hanging over where he rang them, swinging, jolting at each toll (Belgard's cage bell).
      if (f.kind === 'odRings' && !f.done && t >= f.from) {
        const jolt = f.rangAt !== undefined && t - f.rangAt < 0.35 ? Math.sin((t - f.rangAt) * 60) * 4 * (1 - (t - f.rangAt) / 0.35) : 0;
        this.drawFxFrame('bgBell', Math.floor(this.visualTime * FX.bgBell.fps) % 24, f.x * 20 + jolt + Math.sin(t * 2.4) * 3, f.y * 20 - 100, { sx: 0.8, sy: 0.8, alpha: Math.min(1, (t - f.from) / 0.3) });
      }
      if (f.kind === 'odPress' && !f.done) {
        // Press's plates in his gold hang high over their cells from the start (2026-11-20, the user's word: only red and
        // green squares showed), sinking a little and brightening, then slam down in the last 0.25 s.
        const left = f.at - t, span = f.at - f.from, k = Math.max(0, Math.min(1, 1 - left / span));
        if (t >= f.from) for (const cell of f.cells) if (!cell.safe) {
          const drop = left < 0.25 ? left / 0.25 : 1, lift = (170 - 50 * k) * drop + 6 * Math.sin(t * 6 + cell.r + cell.c) * drop;
          // His own gold slab with a dial on it (pixelfx od-plate, 2026-11-21: the factory's steel plate tinted gold looked out of place).
          // As wide as its cell and as deep as it on the floor (the slab's top is 18 of its 25 px rows).
          const size = (cell.x1 - cell.x0) * 20 * 0.95 / 58, deep = (cell.y1 - cell.y0) * 20 * 0.95 / 25, px = (cell.x0 + cell.x1) * 10, py = cell.y1 * 20 - 4 - lift;
          if (!this.drawFxFrame('odPlate', this.visualTime * FX.odPlate.fps + cell.r * 3 + cell.c, px, py, { sx: size, sy: deep, alpha: 0.55 + 0.45 * k })) this.drawMark('bossPlate', px, py - 6, (cell.x1 - cell.x0) * 20 * 0.95, { tint: GOLD, alpha: 0.55 + 0.4 * k });
        }
      }
      if (f.kind === 'odSigil' && !f.done) {
        // The command over F2's head, and beside it the brass stopwatch running out its three seconds.
        const p = g.p, gone = Math.min(1, Math.max(0, (t - f.from) / (f.at - f.from))), x = p.x * 20, y = p.y * 20 - 62;
        // As it is given, the command comes down on her from big to small (2026-11-21, the review), with its word.
        const fall = Math.min(1, (t - f.from) / 0.35), big = 1 + 2.2 * (1 - fall) ** 2;
        this.drawFxFrame(f.mode === 'stop' ? 'odSigilStop' : 'odSigilMove', this.visualTime * FX.odSigilStop.fps, x, y, { sx: big, sy: big, alpha: 0.4 + 0.6 * fall });
        if (t - f.from < 1.1) this.text(f.mode === 'stop' ? '멈춰라' : '움직여라', x, y - 46, f.mode === 'stop' ? '#9ff4ff' : '#ffd257', Math.round(15 * (0.8 + 0.2 * fall)));
        this.drawFxFrame('chargeClock', gone * (FX.chargeClock.frames - 1), x + 24, y - 6, { sx: 0.55, sy: 0.55 });
      }
      if (f.kind === 'odLastHour') {
        // Over him, the stopwatch counting the tolls through.
        const owner = s.enemies.find(e => e.id === f.owner), done = f.tolls.filter(x => x.done).length;
        if (owner) this.drawFxFrame('chargeClock', done / f.tolls.length * (FX.chargeClock.frames - 1), owner.x * 20, owner.y * 20 - 150, { sx: 1.2, sy: 1.2 });
      }
    }
    for (const e of s.enemies) {
      if (!isOrden(e) || e.hp <= 0) continue;
      if (e.breaking?.kind === 'stopTime') this.odBreakOver(e, t);
      // His images: only the real one's eye shines (the cracked side of the mask); turned away, it glints over his hat.
      // Until they cast: the images' field goes when it casts (the `cast + 1.2` once asked for here never came, 2026-11-21).
      if ((s.bossFields || []).some(f => f.kind === 'odClones' && f.owner === e.id)) this.drawFxFrame('odGlint', this.visualTime * 20, e.x * 20 + 5, e.y * 20 + ORDEN_EYE - (Math.sin(e.facing) > 0.2 ? 0 : 30), { sx: 1.4, sy: 1.4 });
    }
  },
  /** The break over the bodies: bolts hanging in stopped time (or flying), the hearts, the time left, the world gone grey-blue. */
  odBreakOver(e, t) {
    const b = e.breaking, c = this.ctx;
    // Stopped time (2026-11-21, the user's pick from the review: a flat blue over the whole screen muddied the map): the
    // world drained of colour with a cold edge, his great clock dial standing still on the floor round him, and a ripple
    // of the stop running out from him as it falls. Drawn first, so the needles and the watches stay bright over it.
    if (b.phase === 'stop' && b.failAt === null) {
      const since = t - (b.stopAt ?? t), w = this.canvas.width, h = this.canvas.height;
      this.drawFxFrame('odCastCircle', 0, e.x * 20, e.y * 20, { sx: 2.2, sy: 2.2, alpha: 0.5 });
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'saturation'; c.globalAlpha = 0.85; c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.16; c.fillStyle = '#9ab4e8'; c.fillRect(0, 0, w, h);
      // (The cold edge's gradient made once per canvas size, 2026-11-21, the cleanup: it was made every frame.)
      if (this.odEdge?.w !== w || this.odEdge.h !== h || this.odEdge.c !== c) {
        const edge = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
        edge.addColorStop(0, 'rgba(20, 30, 60, 0)'); edge.addColorStop(1, 'rgba(20, 30, 60, 0.45)');
        this.odEdge = { w, h, c, edge };
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = this.odEdge.edge; c.fillRect(0, 0, w, h);
      c.restore();
      // The floor each hand sweeps in the next handWarn seconds, washed red, the minute hand's gap left clear (2026-11-22,
      // the user's pick: there was no telling where it would come next, nor where it could be let pass).
      this.odHandWarn(b, since);
      // Only F2 moves in stopped time, so only she keeps her colour (2026-11-21, the chapter 3 review: the grey took her too).
      this.redrawPlayer();
      if (since >= 0 && since < 0.7) this.drawFxFrame('odBurstCyan', since * FX.odBurstCyan.fps, e.x * 20, e.y * 20, { sx: 1 + since * 1.8, sy: 1 + since * 1.8, alpha: 1 - since / 0.7 });
    }
    // Each a watch hand of blued steel (odHand since 2026-11-21, the user's word: his cyan light bolts looked out of place on
    // the tower's marble), the maze's walls and its two turning hands (odDialScatter).
    // Each hangs half a unit over its shadow, the hand's own silhouette at the same angle (2026-11-21, the user's word:
    // the watches' round shadow looked odd under a needle). The shadow is what hurts (odBreakStep: the line bulletHalf
    // either side of it, bulletRadius thick), so the shadows go down first, under every hand.
    for (const q of b.bullets || []) if (!q.gone && !q.off) this.drawFxFrame('odHandShadow', 0, q.x * 20, q.y * 20, { angle: q.angle, alpha: 0.4 });
    // (3 px over it since 2026-11-22, the user's word: hung 10 px up, the needle stood a step off where it hurt.)
    for (const q of b.bullets || []) if (!q.gone && !q.off) this.drawFxFrame('odHand', 0, q.x * 20, q.y * 20 - 3, { angle: q.angle });
    // The watches (v2 art since 2026-11-21, smaller than v1 was even at three quarters; spread wide: odDialScatter), each over
    // its own see-through shadow, as the needles are.
    for (const h of b.hearts) if (!h.broken) {
      this.drawFxFrame('odWatchShadow', 0, h.x * 20, h.y * 20, { alpha: 0.4 });
      this.drawFxFrame(h.hits ? 'odWatchCracked' : 'odWatch', b.phase === 'stop' ? this.visualTime * FX.odWatch.fps : 0, h.x * 20, h.y * 20);
    }
    if (b.phase === 'stop' && b.failAt === null) {
      const left = Math.max(0, b.phaseAt - t), gone = 1 - Math.min(1, left / (b.stopFor || 7));
      // The time left: the brass stopwatch over him running out.
      this.drawFxFrame('chargeClock', gone * (FX.chargeClock.frames - 1), e.x * 20, e.y * 20 - 150, { sx: 1.2, sy: 1.2 });
    }
  },
};
