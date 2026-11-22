// Beyond the Clockwork: Orden passing away into light in the liberation cutscene (2026-11-20, the user's word: his
// vanishing should look better, in pixelfx). Drawn round his body while he breaks up: a column of cyan light from his
// feet up into the sky with bright bands running up it, a ring of light breathing on the floor, clock-face shards and
// motes spiralling up round him and away. `gold` 0 cyan, 1 cyan with gold. Loop of 1.6 s. Origin = his feet.
import { cycle, fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's ascent",
  desc: "A figure passing into light: a column of light into the sky, bands running up it, a floor ring, shards and motes spiralling up.",
  tags: ["magic", "holy", "arcane", "boss", "death", "loop", "aura"],
  size: [128, 240],
  origin: [64, 222],
  duration: 1.6,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { gold: 1, seed: 4 },
};

const FLAT = 0.42;
const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"];
const GOLD = ["#3a2408", "#7a5418", "#c99a3a", "#ffd257", "#ffe9a8", "#ffffff"];

export function draw(p, t, o) {
  const u = t / meta.duration, ph = u * TAU, C = fit(CYAN, 6).map(hex), G = fit(GOLD, 6).map(hex);
  const TOP = 220;
  // the column: wide and soft at his feet, a narrow white core, thinning towards the sky
  for (let y = 0; y < TOP; y++) {
    const v = y / TOP, taper = v > 0.7 ? 1 - (v - 0.7) / 0.3 : 1, w = Math.round((14 - v * 6 + Math.sin(v * 9 - ph * 2) * 1.2) * taper);
    // bright bands running up it (three a loop, so it loops seamlessly)
    const band = 0.5 + 0.5 * Math.cos((v * 3 - u * 3) * TAU);
    for (let x = -w; x <= w; x++) {
      const e = Math.abs(x) / (w + 0.5);
      if (e > 0.92 && (x + y) & 1) continue;
      const c = e < 0.12 + band * 0.25 ? WHITE : e < 0.5 ? C[4] : e < 0.78 ? C[3] : C[2];
      p.px(x, -y, c);
    }
  }
  p.glowLine(0, 0, 0, -TOP * 0.85, 20, C[3], 0.35);
  // the floor ring, breathing, its bright spot running round
  for (const [r0, c0] of [[34, C[3]], [24, C[4]]]) {
    const r = r0 + Math.sin(ph) * 2;
    for (let a = 0; a < TAU; a += 1 / r) { const k = Math.cos(a - ph); p.px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * FLAT), k > 0.7 ? WHITE : c0); }
  }
  // clock-face shards: little squares and ticks turning as they spiral up and out
  cycle(t, meta.duration, 9, o.seed, 1.6, (age, life, g) => {
    const k = age / life, a = g.next() * TAU + k * 3, r = 10 + k * 26, x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT - 20 - k * 180);
    const c = o.gold && g.next() < 0.5 ? G[4] : C[4], s = k < 0.6 ? 2 : 1;
    if ((Math.floor(age * 12) & 1) === 0) { for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) p.px(x + i, y + j, c); }
    else { p.px(x, y - 1, c); p.px(x, y, WHITE); p.px(x, y + 1, c); }
  });
  // motes spiralling up round him, white when new
  cycle(t, meta.duration, 26, o.seed + 1, 1.2, (age, life, g) => {
    const k = age / life, a = g.next() * TAU + k * 5, r = 18 - k * 8 + g.next() * 10, x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT - k * 210);
    const c = k < 0.3 ? WHITE : o.gold && g.next() < 0.35 ? G[3] : C[4];
    p.px(x, y, c); if (k < 0.5) p.light(x, y, c, 0.4);
  });
}
