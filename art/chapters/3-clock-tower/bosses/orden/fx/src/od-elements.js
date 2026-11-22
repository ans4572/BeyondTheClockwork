// Beyond the Clockwork: Orden's new element spells (2026-11-20, the user's pick: more element patterns). `part`:
//  0 mirror — an ice crystal pillar standing on the floor, that bends his needles to F2 (`cracked` 1: split, about to
//             break). A 1 s loop, a glint running up it. Origin = its foot.
//  1 rod    — a brass lightning rod driven into the floor, sparks crawling at its tip. A 0.5 s loop. Origin = its foot.
//  2 zap    — one 48 px length of a lightning bolt running right, jagged, a white core in yellow, flickering (laid end
//             to end along a line). A 0.3 s loop. Origin = its left end, middle.
//  3 vortex — a whirlwind laid flat on the floor: pale green streaks spiralling in to a dark eye, dust drawn round it.
//             A 0.8 s loop. Origin = the eye.
import { cycle, fit, hex, Rng, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's element spells",
  desc: "An ice mirror pillar, a lightning rod, a length of lightning bolt, a flat whirlwind.",
  tags: ["magic", "boss", "ice", "lightning", "wind", "loop"],
  size: [112, 80],
  origin: [56, 60],
  duration: 1,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { part: 0, cracked: 0 },
};

const INK = hex("#0b1020");
const ICE = ["#123a5a", "#2a6a9a", "#5aa8d8", "#9ad8f8", "#e0f6ff"].map(hex);
const BRASS = ["#3a2408", "#7a5418", "#c99a3a", "#ffd257", "#ffe9a8"].map(hex);
const VOLT = ["#5a4a10", "#c8a020", "#ffe066", "#fff4b0"].map(hex);
const WIND = ["#1e4a3c", "#3c8a6c", "#8fe8c8", "#d8fff0"].map(hex);

export function draw(p, t, o) {
  const u = t / meta.duration;
  if (o.part === 0) {
    // a six-sided prism leaning a little, its faces lit from the left, a glint climbing it
    const H = 52, W = 11;
    for (let y = 0; y <= H + 8; y++) {
      const top = y > H ? (y - H) / 8 : 0, w = Math.round(W * (1 - top));
      for (let x = -w - 1; x <= w + 1; x++) {
        const edge = Math.abs(x) > w - 0.5;
        const c = edge ? INK : x < -w / 3 ? ICE[3] : x < w / 3 ? ICE[2] : ICE[1];
        p.px(x + Math.round(y * 0.06), -y, c);
      }
    }
    // facet lines and the glint
    for (let y = 2; y < H + 4; y++) { p.px(Math.round(-W / 3 + y * 0.06), -y, ICE[4]); p.px(Math.round(W / 3 + y * 0.06), -y, ICE[0]); }
    const gy = Math.round(((u * 1.4) % 1) * (H + 6)); for (let d = 0; d < 6; d++) p.px(Math.round(-W / 2 + (gy - d) * 0.06) + d, -(gy - d), WHITE);
    // its foot: frost on the floor
    for (let a = 0; a < TAU; a += 0.05) { const x = Math.round(Math.cos(a) * 15), y = Math.round(Math.sin(a) * 6); p.px(x, y, ICE[3]); }
    if (o.cracked) for (const [x, y] of [[-6, 12], [-4, 16], [-3, 20], [-1, 24], [1, 27], [2, 31], [4, 35], [3, 39], [5, 43]]) { p.px(x, -y, INK); p.px(x + 1, -y, WHITE); }
    return;
  }
  if (o.part === 1) {
    // the rod: a base plate, a brass shaft, a spiked tip with sparks crawling over it
    for (let a = 0; a < TAU; a += 0.06) { p.px(Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 4), BRASS[1]); p.px(Math.round(Math.cos(a) * 7), Math.round(Math.sin(a) * 3), BRASS[2]); }
    for (let y = 0; y < 44; y++) for (let x = -2; x <= 2; x++) p.px(x, -y, Math.abs(x) === 2 ? INK : x < 0 ? BRASS[3] : x === 0 ? BRASS[2] : BRASS[1]);
    for (const r of [12, 24, 36]) for (let x = -3; x <= 3; x++) p.px(x, -r, Math.abs(x) === 3 ? INK : BRASS[3]);
    for (let y = 44; y < 52; y++) { const w = Math.round((52 - y) / 4); for (let x = -w; x <= w; x++) p.px(x, -y, y > 49 ? WHITE : BRASS[4]); }
    const g = new Rng(Math.floor(u * 10) + 1);
    for (let i = 0; i < 4; i++) { let x = 0, y = -50; for (let s = 0; s < 5; s++) { x += g.int(-2, 2); y -= g.int(0, 2); p.px(x, y, s < 2 ? WHITE : VOLT[2]); } }
    p.glow(0, -50, 7, VOLT[2], 0.6);
    return;
  }
  if (o.part === 2) {
    // a jagged bolt from x 0 to 48, new every few frames, a white core in yellow and a dark edge under it
    const g = new Rng(Math.floor(u * 6) + 3);
    let y = 0; const pts = [];
    for (let x = 0; x <= 48; x += 4) { pts.push([x, x === 0 || x === 48 ? 0 : y]); y = Math.max(-7, Math.min(7, y + g.int(-4, 4))); }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      for (let s = 0; s <= 1; s += 0.08) { const x = Math.round(x0 + (x1 - x0) * s), yy = Math.round(y0 + (y1 - y0) * s); p.px(x, yy + 2, VOLT[0]); p.px(x, yy - 1, VOLT[2]); p.px(x, yy + 1, VOLT[1]); p.px(x, yy, WHITE); }
    }
    for (let i = 0; i < 2; i++) { const [x0, y0] = pts[g.int(1, pts.length - 2)]; let x = x0, yy = y0; for (let s = 0; s < 4; s++) { x += 2; yy += g.int(-2, 2) || 1; p.px(x, yy, VOLT[2]); } }
    p.glowLine(0, 0, 48, 0, 8, VOLT[2], 0.35);
    return;
  }
  if (o.part === 4) {
    // a fireball falling straight down onto its spot: a white-hot head, an orange body, a trail of flame and embers above
    const FIRE = ["#5a1004", "#b8300c", "#ff6a1e", "#ffb050", "#fff0c0"].map(hex), g = new Rng(Math.floor(u * 12) + 7);
    for (let y = -46; y <= 0; y++) { const d = -y / 46, w = Math.round(7 * (1 - d) * (1 - d) + 1 + g.int(0, 1)); for (let x = -w; x <= w; x++) { const e = Math.abs(x) / (w + 0.5); if (d > 0.6 && g.next() < d - 0.4) continue; p.px(x, y, e < 0.3 && d < 0.4 ? FIRE[4] : e < 0.6 ? FIRE[3] : d < 0.5 ? FIRE[2] : FIRE[1]); } }
    p.disc(0, 2, 6, FIRE[3], 1); p.disc(0, 2, 3.5, FIRE[4], 1); p.px(0, 2, WHITE);
    for (let i = 0; i < 6; i++) p.px(g.int(-8, 8), -g.int(10, 56), g.next() < 0.5 ? FIRE[3] : FIRE[4]);
    p.glow(0, 0, 12, FIRE[3], 0.6);
    return;
  }
  if (o.part === 5) {
    // a pocket watch floating over the floor (the stopped time's clocks): a brass case and crown, a cream face with twelve
    // ticks, two hands, the second hand stepping; `cracked` 1: the glass split. A floor shadow under it.
    const y0 = -24 + Math.round(Math.sin(u * TAU) * 1.5), R = 13, CREAM = ["#a89878", "#e8dcc0", "#fff8e8"].map(hex);
    p.ellipse(0, 4, 10, 3, INK, 0.45);
    for (let y = -R - 2; y <= R + 2; y++) for (let x = -R - 2; x <= R + 2; x++) {
      const d = Math.hypot(x, y);
      if (d > R + 1.5) continue;
      p.px(x, y0 + y, d > R + 0.6 ? INK : d > R - 2 ? (x + y < 0 ? BRASS[4] : x + y < 6 ? BRASS[3] : BRASS[2]) : d > R - 3 ? BRASS[1] : (x + y < -4 ? CREAM[2] : CREAM[1]));
    }
    // the crown and its ring on top
    for (let x = -2; x <= 2; x++) for (let y = -R - 5; y <= -R - 2; y++) p.px(x, y0 + y, Math.abs(x) === 2 ? INK : BRASS[3]);
    for (let a = 0; a < TAU; a += 0.3) p.px(Math.round(Math.cos(a) * 3), y0 - R - 8 + Math.round(Math.sin(a) * 2.5), BRASS[2]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = i % 3 ? R - 5 : R - 6; for (let r = r0; r <= R - 4; r++) p.px(Math.round(Math.sin(a) * r), y0 - Math.round(Math.cos(a) * r), INK); }
    for (const [len, a, c] of [[6, TAU * 10 / 12, INK], [9, TAU * 2 / 12, INK], [9, Math.floor(u * 12) / 12 * TAU, hex("#c0303a")]]) for (let r = 0; r <= len; r++) p.px(Math.round(Math.sin(a) * r), y0 - Math.round(Math.cos(a) * r), c);
    p.px(0, y0, BRASS[3]);
    if (o.cracked) for (const [x, y] of [[-8, -7], [-6, -5], [-5, -4], [-3, -2], [-1, -1], [0, 1], [2, 2], [3, 4], [5, 5], [6, 7], [-2, -4], [-1, -6]]) { p.px(x, y0 + y, INK); p.px(x + 1, y0 + y, WHITE); }
    p.glow(0, y0, 15, hex("#3fd0e8"), 0.25 + 0.15 * Math.sin(u * TAU * 2));
    return;
  }
  // the vortex: spiral arms laid flat, turning in; dust and leaves drawn round and down into the eye
  const FLAT = 0.5, turn = u * TAU;
  for (let arm = 0; arm < 4; arm++) for (let s = 0; s < 1; s += 0.008) {
    const r = 6 + s * 44, a = turn * 1.0 + arm * TAU / 4 + s * 4.2, x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT);
    const fade = s;
    if (fade > 0.85 && (Math.round(s * 400) % 3)) continue;
    p.px(x, y, fade < 0.25 ? WIND[3] : fade < 0.6 ? WIND[2] : WIND[1]);
  }
  for (let a = 0; a < TAU; a += 0.08) p.px(Math.round(Math.cos(a) * 5), Math.round(Math.sin(a) * 5 * FLAT), INK);
  p.disc(0, 0, 3, WIND[0], 1);
  cycle(t, meta.duration, 16, 4, 0.8, (age, life, g) => {
    const k = age / life, a0 = g.next() * TAU, r = 48 * (1 - k), a = a0 + k * 5, x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT - (1 - k) * 4);
    p.px(x, y, g.next() < 0.3 ? hex("#9a7a4a") : WIND[3]);
  });
}
