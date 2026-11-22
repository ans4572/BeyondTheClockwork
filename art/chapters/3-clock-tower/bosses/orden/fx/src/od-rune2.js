// Beyond the Clockwork: Orden's floor rune, grander (2026-11-20, the user's word: wider runes, flashier). A magic circle
// laid flat: an outer gold ring with twelve pulsing ticks and a band of glyph dots running round it, a cyan ring inside
// turning the other way, a gold six-point star turning, a bright core, and light motes rising off the rings, all
// brightening as `charge` (0 to 1) fills. Loop of 1 s. Origin = the middle, radius 30 px.
import { cycle, fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's grand rune",
  desc: "A flat magic circle: a gold ring of pulsing ticks and running glyphs, a counter-turning cyan ring, a turning six-point star, rising motes.",
  tags: ["magic", "arcane", "boss", "ground", "loop", "circle"],
  size: [80, 64],
  origin: [40, 34],
  duration: 1,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { seed: 6 },
};

const FLAT = 0.55, R = 30;
const GOLD = ["#3a2408", "#6e4a14", "#a8782a", "#dcb050", "#f8e4a0"];
const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff"];

export function draw(p, t, o) {
  const u = t / meta.duration, G = fit(GOLD, 5).map(hex), C = fit(CYAN, 5).map(hex), pulse = 0.5 + 0.5 * Math.sin(u * TAU * 2);
  const pt = (a, r) => [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * FLAT)];
  // outer ring, doubled, dark under it so it reads on bright floors
  for (let j = 0; j < 320; j++) { const a = j / 320 * TAU; let [x, y] = pt(a, R); p.px(x, y + 1, G[0]); p.px(x, y, j % 3 ? G[3] : G[4]); [x, y] = pt(a, R - 3); p.px(x, y, G[2]); }
  // twelve ticks pulsing round (a quarter lit, running once a loop)
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, lit = (i + Math.floor(u * 12)) % 12 < 4; for (let r = R - 3; r <= R + 3; r++) { const [x, y] = pt(a, r); p.px(x, y, lit ? WHITE : G[3]); } }
  // glyph dots running round between the rings
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + u * TAU / 24 * 2, [x, y] = pt(a, R - 6), g = i % 3; p.px(x, y, G[4]); if (g === 1) p.px(x + 1, y, G[3]); if (g === 2) p.px(x, y - 1, G[3]); }
  // the cyan ring turning the other way, broken into arcs
  for (let j = 0; j < 220; j++) { const a = j / 220 * TAU - u * TAU / 3; if ((j % 55) > 40) continue; const [x, y] = pt(a, R - 11); p.px(x, y + 1, C[0]); p.px(x, y, C[3]); }
  // the six-point star (two triangles), turning
  for (let tri = 0; tri < 2; tri++) for (let i = 0; i < 3; i++) {
    const a0 = u * TAU / 6 + tri * Math.PI / 3 + i / 3 * TAU, a1 = a0 + TAU / 3, r = R - 13;
    for (let s = 0; s <= 1; s += 0.03) { const x = Math.cos(a0) * r * (1 - s) + Math.cos(a1) * r * s, y = (Math.sin(a0) * r * (1 - s) + Math.sin(a1) * r * s) * FLAT; p.px(Math.round(x), Math.round(y), tri ? C[4] : G[3]); }
  }
  // the core
  p.disc(0, 0, 2.5 + pulse, G[4], 1); p.px(0, 0, WHITE);
  // motes rising off the rings
  cycle(t, meta.duration, 14, o.seed, 0.8, (age, life, g) => {
    const k = age / life, a = g.next() * TAU, r = (g.next() < 0.5 ? R : R - 11), [x, y0] = pt(a, r);
    p.px(x, Math.round(y0 - k * 22), k < 0.35 ? WHITE : g.next() < 0.5 ? G[4] : C[4]);
  });
}
