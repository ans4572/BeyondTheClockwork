// Beyond the Clockwork: one piece of Orden's element lane gathering before it blows, and what a lane leaves after
// (2026-11-19). The game lays pieces in a loose grid over each lane. `element` 0 fire, 1 ice, 2 lightning, 3 wind, 4 safe;
// `mode` 0 gathering (a warning: fire — cracks glowing and embers rising; ice — frost creeping into crystals, mist;
// lightning — little arcs jumping over the floor; wind — dust swirling in eddies; safe — green motes rising off the floor)
// or 1 left behind (fire — low flames licking over a burning floor; ice — a sheet of ice with glints running over it).
// Loops of 0.8 s. Origin = the floor under the middle of the piece.
import { cycle, fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's element lane gathering",
  desc: "A piece of a lane of the floor gathering an element before it blows (embers, frost, arcs, eddies, or green motes for the safe lane), or what fire and ice leave behind.",
  tags: ["magic", "boss", "fire", "ice", "lightning", "wind", "ground", "loop", "tile"],
  size: [80, 72],
  origin: [40, 50],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { element: 0, mode: 0, seed: 3 },
};

const RAMPS = [
  ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"],
  ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"],
  ["#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"],
  ["#0e2a26", "#1f5a4a", "#2f8a6a", "#5fbf94", "#9fe8c0", "#d0fbe4", "#f0fff6", "#ffffff"],
  ["#0c2a18", "#14522c", "#1f8a4a", "#2fae63", "#6fe09a", "#b8f8cf", "#e8fff0", "#ffffff"],
];
const FLAT = 0.55, D = meta.duration;

export function draw(p, t, o) {
  const el = o.element | 0, C = fit(RAMPS[el], 8).map(hex), ph = t / D * TAU, s = o.seed + el * 7;
  if (o.mode === 1 && el === 0) {
    // burning floor: a dark scorched patch, low flame tongues licking up and dying, embers
    // small scorch marks, not a patch (patches tiled over a lane read as blobs)
    for (const [x, y, r] of [[-14, 2, 5], [6, -3, 4], [16, 3, 3], [-2, 5, 3]]) { p.ellipse(x, y, r, r * FLAT, C[1], 1); p.px(x, y, C[3]); }
    cycle(t, D, 9, s, 0.35, (age, life, g) => {
      const k = age / life, x = Math.round((g.next() - 0.5) * 48), y = Math.round((g.next() - 0.5) * 20 * FLAT), h = Math.round((4 + g.next() * 9) * Math.sin(k * Math.PI));
      for (let i = 0; i < h; i++) { const u = i / h; p.px(x + Math.round(Math.sin(i * 0.9 + ph) * u), y - i, u < 0.3 ? C[6] : u < 0.6 ? C[5] : u < 0.85 ? C[4] : C[3]); if (u < 0.4) p.px(x + 1, y - i, C[5]); }
      p.light(x, y - 2, C[5], 0.4);
    });
    cycle(t, D, 4, s + 1, 0.6, (age, life, g) => { const k = age / life; p.dot(Math.round((g.next() - 0.5) * 40), Math.round(-4 - k * 26), C[6], 1 - k); });
    return;
  }
  if (o.mode === 1 && el === 1) {
    // a sheet of ice: pale flat plates with darker cracks, glints running across
    p.ellipse(0, 0, 32, 32 * FLAT, C[4], 1); p.ellipse(-3, -1, 26, 24 * FLAT, C[5], 1); p.ellipse(-6, -2, 14, 12 * FLAT, C[6], 1);
    for (const [a, l] of [[0.4, 18], [2.1, 14], [3.6, 20], [5.2, 12]]) for (let r = 2; r < l; r++) p.px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * FLAT), C[3]);
    const gx = Math.round(-30 + (t / D) * 60); for (let d = -2; d <= 2; d++) p.px(gx + d, -Math.abs(d) + 1 - 6, WHITE);
    return;
  }
  // gathering
  // (no glow laid on the floor: baked into the sheet it reads as a pale disc on the game's bright floors)
  if (el === 0) {
    for (const [a, l] of [[0.3, 20], [2.4, 16], [4.0, 22]]) for (let r = 3; r < l; r++) p.px(Math.round(Math.cos(a) * r + Math.sin(r) * 1), Math.round(Math.sin(a) * r * FLAT), r % 3 ? C[5] : C[6]);
    cycle(t, D, 8, s, 0.6, (age, life, g) => { const k = age / life, x = (g.next() - 0.5) * 50; p.dot(Math.round(x + Math.sin(k * 6 + x) * 2), Math.round(-2 - k * 30), k < 0.5 ? C[6] : C[4], 1 - k); });
  }
  if (el === 1) {
    cycle(t, D, 6, s, 0.8, (age, life, g) => {
      const k = age / life, x = Math.round((g.next() - 0.5) * 46), y = Math.round((g.next() - 0.5) * 18 * FLAT), h = Math.round(2 + 6 * Math.min(1, k * 2));
      for (let i = 0; i < h; i++) p.px(x, y - i, i === h - 1 ? WHITE : C[5]); p.px(x - 1, y, C[4]); p.px(x + 1, y, C[4]);
    });
    cycle(t, D, 3, s + 2, 0.8, (age, life, g) => { const k = age / life; p.disc((g.next() - 0.5) * 40, -3 - k * 6, 4 + k * 4, C[6], 0.25 * (1 - k)); });
  }
  if (el === 2) {
    cycle(t, D, 14, s, 0.12, (age, life, g) => {
      let x = (g.next() - 0.5) * 50, y = (g.next() - 0.5) * 16 * FLAT; const n = 4 + Math.floor(g.next() * 3), dir = g.next() < 0.5 ? -1 : 1;
      for (let i = 0; i < n; i++) { const nx = x + dir * (3 + g.next() * 3), ny = y - 1 - g.next() * 4; for (let k = 0; k <= 3; k++) p.px(Math.round(x + (nx - x) * k / 3), Math.round(y + (ny - y) * k / 3), i % 2 ? C[6] : WHITE); x = nx; y = ny; }
      p.light(Math.round(x), Math.round(y), C[5], 0.6);
    });
  }
  if (el === 3) {
    cycle(t, D, 6, s, 0.6, (age, life, g) => {
      const k = age / life, cx = (g.next() - 0.5) * 40, r = 4 + g.next() * 6, a0 = g.next() * TAU;
      for (let j = 0; j < 10; j++) { const a = a0 + k * 5 + j * 0.35; p.dot(Math.round(cx + Math.cos(a) * r * (1 + k)), Math.round(-3 + Math.sin(a) * r * FLAT * (1 + k)), j < 3 ? C[6] : C[4], (1 - k) * 0.9); }
    });
  }
  if (el === 4) {
    cycle(t, D, 9, s, 0.7, (age, life, g) => { const k = age / life, x = (g.next() - 0.5) * 56; p.dot(Math.round(x), Math.round(-k * 28), k < 0.3 ? WHITE : C[5], 1 - k); if (k < 0.5) p.light(Math.round(x), Math.round(-k * 28), C[4], 0.4); });
  }
}
