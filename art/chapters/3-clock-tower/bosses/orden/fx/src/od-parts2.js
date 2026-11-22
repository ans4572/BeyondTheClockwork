// Beyond the Clockwork: more of Orden's spell parts (2026-11-19), replacing what the game drew in code. `part`:
//  0 barrier — one piece of the needle fence's wall: a shimmering curtain of cyan light standing on the floor, sparks
//              running up it (the game sets pieces round the ring). Origin = its foot.
//  1 arrow   — an arrowhead of cyan light pointing right, pulsing (set in a row along where a bolt will fly).
//  2 crack   — a piece of floor about to fall: cracks spreading, dust and grit trickling (the game tiles it over the piece).
//  3 hole    — where the floor has fallen: a broken stone rim round the dawn sky and drifting clouds far below.
//  4 surge   — a piece of the apparatus cannon's blast: a torrent of cyan-white energy rushing right, motes and rings.
//  5 glint   — the cyan light in the real Orden's eye (the cracked side of the mask), a small star pulsing.
// Loops of 0.8 s.
import { cycle, fit, hex, clamp, TAU, WHITE } from "../../core/index.js";

const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"].map(hex);
const STONE = ["#2a2030", "#4a3a44", "#7a6458", "#a8907a", "#d8c4a8"].map(hex);
const SKY = ["#5a6aa8", "#8a90c8", "#c8a8c8", "#f0c8b0", "#fff0e0"].map(hex);

export const meta = {
  name: "Orden's spell parts 2",
  desc: "A fence wall piece, an aim arrow, a floor piece cracking, a hole to the sky, a cannon surge piece and an eye glint.",
  tags: ["magic", "boss", "parts", "loop"],
  size: [56, 56],
  origin: [28, 40],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { part: 0, seed: 2 },
};

export function draw(p, t, o) {
  const u = t / meta.duration, ph = u * TAU, s = o.seed + o.part * 11;
  if (o.part === 0) {
    // a curtain 10 px wide, 22 tall: bright at its foot, thinning upward, rippling; sparks climbing
    for (let x = -5; x <= 5; x++) {
      const h = Math.round(18 + 4 * Math.sin(x * 0.9 + ph * 2));
      // solid pixels where the ripple is strong (translucent dots dither into a checkerboard)
      for (let y = 0; y < h; y++) { const k = y / h, v = (1 - k) * (0.55 + 0.45 * Math.sin(x * 0.8 + y * 0.45 - ph * 3) ** 2); if (v > 0.42) p.px(x, -y, v > 0.85 ? WHITE : v > 0.62 ? CYAN[4] : CYAN[3]); else if (v > 0.3 && (x + y) % 3 === 0) p.px(x, -y, CYAN[2]); }
    }
    p.ellipse(0, 0, 6, 2, CYAN[4], 1); p.glow(0, -6, 10, CYAN[3], 0.45);
    cycle(t, meta.duration, 4, s, 0.4, (age, life, g) => { const k = age / life; p.px(Math.round((g.next() - 0.5) * 9), Math.round(-k * 24), k < 0.5 ? WHITE : CYAN[4]); });
    return;
  }
  if (o.part === 1) {
    const k = 0.5 + 0.5 * Math.sin(ph), C = k > 0.5 ? CYAN[4] : CYAN[3];
    for (let i = 0; i < 6; i++) { p.px(-i, -i, i < 2 ? WHITE : C); p.px(-i, i, i < 2 ? WHITE : C); p.px(-i - 1, -i, CYAN[2]); p.px(-i - 1, i, CYAN[2]); }
    p.glow(-2, 0, 6, CYAN[3], 0.3 + 0.3 * k);
    return;
  }
  if (o.part === 2) {
    // cracks across the piece, glowing faintly from below, grit dropping into them
    for (const [a, l, x0] of [[0.2, 18, -10], [2.7, 16, 8], [1.4, 9, 0], [-1.2, 12, -4]]) for (let r = 0; r < l; r++) { const x = Math.round(x0 + Math.cos(a) * r + Math.sin(r * 1.3) * 1.2), y = Math.round(Math.sin(a) * r * 0.55); p.px(x, y, STONE[0]); p.px(x, y + 1, STONE[3]); }
    cycle(t, meta.duration, 6, s, 0.35, (age, life, g) => { const k = age / life, x = Math.round((g.next() - 0.5) * 34); p.px(x, Math.round(-6 + k * 8), g.next() < 0.5 ? STONE[2] : STONE[3]); });
    return;
  }
  if (o.part === 3) {
    // the hole, 44 x 26: a broken rim of stone, the sky graded below, clouds drifting across
    const W = 22, Hh = 13;
    for (let y = -Hh; y <= Hh; y++) for (let x = -W; x <= W; x++) {
      const e = (x / W) ** 2 + (y / Hh) ** 2 + 0.12 * Math.sin(x * 1.7 + y * 2.3);
      if (e > 1) continue;
      const k = (y + Hh) / (2 * Hh);
      p.px(x, y, e > 0.82 ? (y < 0 ? STONE[1] : STONE[3]) : y < -Hh * 0.55 ? STONE[0] : SKY[Math.min(4, Math.floor(k * 4.5))]);
    }
    for (let i = 0; i < 3; i++) { const cx = Math.round(-W + ((u + i / 3) % 1) * W * 2), cy = Math.round(-2 + i * 4); for (let d = -4; d <= 4; d++) p.dot(cx + d, cy, WHITE, 0.8 - Math.abs(d) * 0.12); }
    return;
  }
  if (o.part === 4) {
    // a torrent rushing right: bands of energy, bright core, rings and motes streaming
    for (let y = -14; y <= 14; y++) {
      const k = Math.abs(y) / 14;
      for (let x = -26; x <= 26; x++) { const w = Math.sin((x - u * 104) * 0.24 + y * 0.3), v = (1 - k) * (0.6 + 0.4 * w * w); if (v > 0.38) p.px(x, y - 10, v > 0.8 ? WHITE : v > 0.58 ? CYAN[4] : CYAN[3]); }
    }
    p.glowLine(-26, -10, 26, -10, 14, CYAN[3], 0.6);
    cycle(t, meta.duration, 10, s, 0.3, (age, life, g) => { const k = age / life; p.px(Math.round(-26 + k * 52), Math.round(-10 + (g.next() - 0.5) * 30), WHITE); });
    return;
  }
  if (o.part === 5) {
    const k = 0.6 + 0.4 * Math.sin(ph * 2);
    p.px(0, 0, WHITE); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(dx, dy, CYAN[4]);
    if (k > 0.75) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.px(dx, dy, CYAN[3]);
    p.glow(0, 0, 5, CYAN[3], 0.5 * k);
  }
}
