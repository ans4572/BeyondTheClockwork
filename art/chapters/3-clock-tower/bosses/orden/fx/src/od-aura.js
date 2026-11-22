// Beyond the Clockwork: the power round Orden (2026-11-20, the user's word: he should look like a final boss). Drawn under
// his body, so what is behind him shows: a halo of a clock's two hands turning slowly round him, low on the floor a
// flattened ring of light, and motes spiralling up round him. `gold` 0 cyan (Orden), 1 gold and cyan, brighter (Orden at
// the last hour). Loop of 1.6 s. Origin = his feet.
import { cycle, fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's aura",
  desc: "Power round a standing figure: clock hands turning behind him, a ring of light on the floor, motes spiralling up round him.",
  tags: ["magic", "arcane", "boss", "status", "loop", "aura"],
  size: [140, 220],
  origin: [70, 196],
  duration: 1.6,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { gold: 0, seed: 9, halo: 1 },
};

const FLAT = 0.45;
const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"];
const GOLD = ["#3a2408", "#7a5418", "#c99a3a", "#ffd257", "#ffe9a8", "#ffffff"];

export function draw(p, t, o) {
  const u = t / meta.duration, ph = u * TAU, C = fit(CYAN, 6).map(hex), G = fit(GOLD, 6).map(hex), A = o.gold ? G : C;
  // the floor ring, breathing
  const rr = 30 + Math.sin(ph) * 2;
  for (let a = 0; a < TAU; a += 1 / rr) { const k = 0.5 + 0.5 * Math.cos(a - ph * 2); p.px(Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr * FLAT), k > 0.8 ? A[4] : A[3]); }
  // (no glow on the floor: a pale disc on bright floors)
  // behind him at chest height: a halo, ticks round it, two hands turning (the long one a turn a loop)
  // (`halo` 0: no clock behind him, 2026-11-20, the user's word: the big clock at his back goes.)
  const cy = -90, R0 = 54;
  if (o.halo) {
  for (let a = 0; a < TAU; a += 1 / R0) { const x = Math.round(Math.cos(a) * R0), y = Math.round(cy + Math.sin(a) * R0); p.px(x, y, C[1]); p.px(Math.round(Math.cos(a) * (R0 - 1)), Math.round(cy + Math.sin(a) * (R0 - 1)), C[3]); p.px(Math.round(Math.cos(a) * (R0 - 2)), Math.round(cy + Math.sin(a) * (R0 - 2)), C[4]); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; for (let r = R0 - 9; r < R0 - 2; r++) { p.px(Math.round(Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), i % 3 ? G[3] : G[4]); p.px(Math.round(Math.cos(a) * r) + 1, Math.round(cy + Math.sin(a) * r), G[1]); } }
  for (const [len, a, c] of [[50, ph - Math.PI / 2, C[4]], [32, ph / 12 + Math.PI / 3, G[4]]]) for (let r = 0; r < len; r++) { const x = Math.round(Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); p.px(x, y, r > len - 3 ? WHITE : c); p.px(x + 1, y, C[1]); }
  }

  // motes spiralling up round him
  cycle(t, meta.duration, o.gold ? 16 : 10, o.seed, 1.2, (age, life, g) => {
    const k = age / life, a0 = g.next() * TAU, a = a0 + k * 4, r = 26 - k * 10, x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT - k * 150);
    p.px(x, y, k < 0.3 ? WHITE : (g.next() < 0.5 ? A[4] : C[4])); if (k < 0.6) p.light(x, y, A[4], 0.35);
  });
}
