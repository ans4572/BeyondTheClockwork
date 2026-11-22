// The end of Orden (2026-11-19, the user's word: no part to plug in; he vanishes, and the first time the town is freed).
// On the summit (`s.ordenEnd`, game.js startOrdenEnd): he kneels in the cyan light where he fell; the first time he rises in
// it as the screen goes white, later times he dissolves upward into motes first (2026-11-22). The first time, the town's freeing follows out of that white as a cutscene
// (ui/liberation-cutscene.js; it replaced an in-game scene in the village on 2026-11-19). Installed on
// CanvasRenderer.prototype through clock-boss-draw.js.
import { ORDEN_END, COLLAPSE } from '../engine/game.js';
import { FX } from './fx-sprites.js';

const hash = text => { let h = 0; for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
/** The motes' steady numbers, worked out once (2026-11-21, the cleanup: hashed afresh for every mote every frame). */
const TURN_MOTES = Array.from({ length: 56 }, (_, i) => hash(`t${i}`)), END_MOTES = Array.from({ length: 28 }, (_, i) => hash(`m${i}`));

/**
 * The middle of Orden 1's mask from his feet, in sheet pixels: standing (0), then each frame of orden-kneel (1 to 8), read
 * off the sheets (2026-11-22). SHEET_PX: one sheet pixel in floor pixels (the clips' scale 1.35, halved by the renderer).
 */
const MASK_AT = [[2, -94], [-1, -94], [-2, -92], [-1, -88], [2, -59], [2, -56], [2, -55], [2, -55], [2, -55]], SHEET_PX = 0.675;
const ease = u => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };

export const ordenEnding = {
  /**
   * Orden 1 turning into Orden at the last hour while the tower breaks (2026-11-21, the user's word: no parts and gears
   * like an ordinary boss). Until the flash he is the masked tuner, lifted in a cyan aura that grows and flickers white as
   * the walls crack; from the flash he is his last form, drifting down to where that fight begins (`fall.to`), where the
   * real body takes over at COLLAPSE.arrive.
   */
  drawOrdenTurning(fall) {
    const s = this.game.s, c = this.ctx, t = s.time - fall.at, T = COLLAPSE;
    if (t >= T.arrive) return;
    // While the screen is in the town only the words; he fades with the town coming and going, never over it (2026-11-22:
    // he and his aura showed over the town as it faded in and out).
    const town = Math.max(0, Math.min(1, (t - T.cutIn) / 0.45, (T.cutOut - t) / 0.45)), vis = 1 - town;
    if (vis <= 0) { this.drawAwakenLines(t); return; }
    const to = fall.to || fall, before = t < T.open, landed = t >= T.land, turned = t >= T.turn;
    // Down on one knee first, the mask cracking; then the light lifts him: off the floor and half-way toward his spot
    // before the flash, the rest after it, coming down masked on the summit, where the pillar takes him.
    const kneel = Math.min(1, t / T.kneel) * (1 - Math.min(1, Math.max(0, (t - T.rise) / 0.7)));
    const lift = before ? 30 * ease((t - T.rise) / (T.crack - T.rise)) : 30 * (1 - ease((t - T.open) / (T.land - T.open)));
    const way = before ? 0.5 * ease((t - T.crack) / (T.open - T.crack)) : 0.5 + 0.5 * ease((t - T.open) / (T.land - T.open));
    const x = (fall.x + (to.x - fall.x) * way) * 20, y = (fall.y + (to.y - fall.y) * way) * 20;
    const wobble = (before && t > T.crack) || (landed && !turned) ? Math.sin(t * 40) * 1.2 : 0;
    // The aura under and round him: faint as he kneels, stronger toward the flash; again in the pillar until the mask breaks.
    const glow = before ? 0.15 + 0.85 * ease((t - T.kneel) / (T.open - T.kneel)) : !landed ? Math.max(0.4, 1 - (t - T.open) / 1.2)
      : !turned ? 0.4 + 0.6 * ease((t - T.land) / (T.turn - T.land)) : Math.max(0.3, 1 - (t - T.turn) / 0.8);
    const beat = before ? Math.max(0, 1 - (t % T.beat) / T.beat * 2.5) : 0, swell = 1 + 1.1 * glow + 0.25 * beat;
    this.drawFxFrame('odAura', this.visualTime * FX.odAura.fps, x, y - lift, { alpha: glow * vis, sx: swell, sy: swell });
    this.drawFxFrame('odAura', this.visualTime * FX.odAura.fps * 1.5 + 9, x, y - lift, { alpha: 0.5 * glow * vis, sx: -swell * 0.8, sy: swell * 0.8 });
    // (No rings of light round him: drawn big they read as hard outlines, 2026-11-21, the user's word.)
    // White: rising toward the flash, out of it after; rising again in the pillar; his new form comes out of the white.
    const white = before ? Math.max(0, (t - T.crack) / (T.open - T.crack)) : !landed ? Math.max(0, 1 - (t - T.open) / 0.6)
      : !turned ? 0.85 * ease((t - T.land) / (T.turn - T.land)) : Math.max(0, 1 - (t - T.turn) / 0.6);
    const flicker = (before && t > T.crack) || (landed && !turned) ? 0.15 * Math.sin(t * 30) : 0;
    const shine = Math.max(0, Math.min(0.9, white * 0.85 + flicker));
    this.drawOrdenBody(x + wobble, y - lift, turned ? 'ordenx' : 'orden', { kneel, alpha: vis, shine, crack: turned ? 0 : ease((t - 0.4) / 0.8) });
    if (turned) this.drawMaskShards(x, y - lift, t - T.turn);
    // Cyan and gold motes drawn up into him, thrown off as he turns.
    const inward = before || (landed && !turned), from = before ? 0 : landed ? (turned ? T.turn : T.land) : T.open;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < TURN_MOTES.length; i++) {
      const h = TURN_MOTES[i], a = (h % 628) / 100, r = 70 + (h >> 8) % 120, u = (((t - from) * (inward ? 1.4 : 0.9) + ((h >> 4) % 100) / 100) % 1);
      const d = inward ? r * (1 - u) : r * u, k = inward ? u : 1 - u;
      c.globalAlpha = 0.8 * k * glow * vis; c.fillStyle = i % 3 ? '#7fe8ff' : '#ffd257';
      c.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y - lift - 40 + Math.sin(a) * d * 0.6), i % 4 ? 2 : 3, i % 4 ? 2 : 3);
    }
    c.restore();
    this.drawAwakenLines(t);
  },
  /**
   * Orden as the scenes draw him (2026-11-22). `kneel` (0 to 1) runs his kneeling clip (orden-kneel, ordenx-kneel: PixelLab,
   * the user's word), 1 down on one knee; run back it stands him up. `crack` (0 to 1) draws the crack down his mask, which
   * follows it as he goes down (MASK_AT).
   */
  drawOrdenBody(x, y, form, { kneel = 0, alpha = 1, shine = 0, crack = 0 } = {}) {
    const c = this.ctx, kneeling = kneel > 0 && this.mobSprites?.clip(`${form}-kneel`, 'south');
    const frame = kneeling ? Math.min(7, Math.floor(kneel * 8)) : 0;
    const pose = { action: kneeling ? `${form}-kneel` : `${form}-idle`, direction: 'south', frame };
    c.save(); c.globalAlpha *= alpha;
    this.drawSprite(x, y, pose, this.mobSprites, shine > 0.02 ? shine : false);
    if (crack > 0 && form === 'orden') {
      const [mx, my] = MASK_AT[kneeling ? frame + 1 : 0], line = [[0, -7], [-2, -3], [1, 0], [-1, 4], [1, 7]], n = Math.max(2, Math.ceil(crack * line.length));
      const cx = x + mx * SHEET_PX, cy = y + my * SHEET_PX;
      c.lineWidth = 1; c.lineJoin = 'miter';
      for (const [style, dx] of [['rgba(127, 232, 255, 0.55)', 0.6], ['#1c2133', 0]]) {
        c.strokeStyle = style; c.beginPath(); line.slice(0, n).forEach(([px, py], i) => (i ? c.lineTo : c.moveTo).call(c, cx + px + dx, cy + py)); c.stroke();
      }
    }
    c.restore();
  },
  /** The mask's pieces thrown off as it breaks (`age` seconds since), white bits flying out and falling. */
  drawMaskShards(x, y, age) {
    if (age > 0.7) return;
    const c = this.ctx; c.save();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.42, v = 40 + (i * 37) % 30;
      c.globalAlpha = Math.max(0, 1 - age / 0.7); c.fillStyle = i % 3 ? '#f4efe6' : '#7fe8ff';
      c.fillRect(Math.round(x + 2 + Math.cos(a) * v * age), Math.round(y - 62 + Math.sin(a) * v * age + 90 * age * age), i % 2 ? 2 : 3, 2);
    }
    c.restore();
  },
  /**
   * His line as he wakes (2026-11-21, the user's word: a line about releasing his true power), across the lower middle of
   * the screen, typed out letter by letter and gone by the flash.
   */
  drawAwakenLines(t) {
    // His line about his power, then over the town his order and what it does (2026-11-21, the user's words).
    this.drawCaption(t, 0.35, COLLAPSE.cutIn - 0.1, '오르덴', '탑의 신호선을 내 몸에 잇겠다.');
    this.drawCaption(t, COLLAPSE.cutIn + 0.3, COLLAPSE.cutIn + 1.9, '오르덴', '마지막 종을 울려라. 모두 멈춰라.');
    this.drawCaption(t, COLLAPSE.cutIn + 2.0, COLLAPSE.cutOut - 0.1, '', '마을의 태엽이 멎고 남은 힘이 탑으로 빨려 올라간다.');
    this.drawCaption(t, COLLAPSE.cutOut + 0.1, COLLAPSE.open - 0.15, '오르덴', '보아라. 이 마을의 힘은 전부 내 것이다.');
  },
  /** One line of the scene across the lower middle of the screen, typed out, `name` above it (none: narration). */
  drawCaption(t, from, to, who, line) {
    if (t < from || t > to) return;
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height; let size = Math.round(Math.max(16, Math.min(30, w / 34)));
    const shown = line.slice(0, Math.ceil(Math.min(1, (t - from) / Math.min(1.6, (to - from) * 0.6)) * line.length)), fade = Math.min(1, (t - from) / 0.2, (to - t) / 0.3);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = fade;
    // A long line shrinks to fit 90% of the width (the narration over the town ran off both sides).
    const face = n => `700 ${n}px "Galmuri11", "Galmuri11 Rest", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
    c.font = face(size); const full = c.measureText(line).width; if (full > w * 0.9) { size = Math.max(12, Math.floor(size * w * 0.9 / full)); c.font = face(size); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const y = h * 0.74, name = `${Math.round(size * 0.7)}px`;
    c.fillStyle = 'rgba(8, 14, 30, 0.6)'; c.fillRect(0, y - size * 1.6, w, size * 3.1);
    c.lineWidth = Math.max(3, size / 6); c.strokeStyle = '#0b1424'; c.fillStyle = '#e8fbff';
    c.strokeText(shown, w / 2, y + size * 0.25); c.fillText(shown, w / 2, y + size * 0.25);
    if (who) {
      c.font = `700 ${name} "Galmuri11", "Galmuri11 Rest", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`; c.fillStyle = '#7fe8ff';
      c.strokeText(who, w / 2, y - size * 0.95); c.fillText(who, w / 2, y - size * 0.95);
    }
    c.restore();
  },
  /** From drawClockBossOver, every frame: the summit's end. */
  drawOrdenEnding() {
    const g = this.game, s = g.s, c = this.ctx;
    if (s.collapse) this.drawOrdenTurning(s.collapse);
    if (s.ordenEnd) {
      // He staggers and kneels in the light; the first time he says his last words there and rises into the light as the
      // screen goes white (the cutscene shows him vanish); later times he fades upward where he knelt (2026-11-22).
      const e = s.ordenEnd, t = s.time - e.at, E = ORDEN_END, x = e.x * 20, y = e.y * 20;
      const up = e.first ? ease((t - E.talk) / (E.stand - E.talk)) : 0, gone = e.first ? 0 : Math.max(0, Math.min(1, (t - E.talk) / (E.gone - E.talk)));
      const kneel = Math.min(1, t / E.kneel) * (1 - up), lift = gone * 36, alpha = (1 - gone) ** 1.5, wobble = 0;
      this.drawFxFrame('odAura', this.visualTime * FX.odAura.fps, x, y - lift, { alpha: (0.35 + 0.65 * up) * alpha, sx: 1.3 + up, sy: 1.3 + up });
      this.drawOrdenBody(x + wobble, y - lift, 'ordenx', { kneel, alpha, shine: 0.8 * up });
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < END_MOTES.length; i++) {
        const h = END_MOTES[i], ox = ((h % 1000) / 1000 - 0.5) * 40, speed = 30 + (h >> 10) % 50, start = ((h >> 4) % 100) / 100 * 1.6;
        const age = t - start; if (age < 0) continue;
        const k = Math.min(1, (age % 1.4) / 1.4); c.globalAlpha = (1 - k) * Math.min(1, Math.max(gone, up) * 3 + 0.2) * (e.first || gone < 1 ? 1 : 0); c.fillStyle = i % 3 ? '#7fe8ff' : '#ffd257';
        c.fillRect(Math.round(x + ox + Math.sin(age * 3 + i) * 4), Math.round(y - 20 - lift - (age % 1.4) * speed), i % 4 ? 2 : 3, i % 4 ? 2 : 3);
      }
      c.restore();
      const white = Math.max(0, Math.min(1, (t - (e.first ? E.whiteFirst : E.whiteAgain)) / E.white));
      if (white > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = white; c.fillStyle = '#fff8ec'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    }
    // Back in the village before the cutscene has covered it (a frame or so): still the white.
    if (s.mode === 'hub' && s.profile.liberationPending) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff8ec'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
  },
};
