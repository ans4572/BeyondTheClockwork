// Beyond the Clockwork: the signal orb's haste signal (chapter 3), seen from above. A cyan blink at the orb, then three
// thin dashed rings sent out along the floor one after another, like a signal going out on the tower's wires, small
// packets of light racing out along six spokes and motes drifting up. One-shot; the game fits it to the orb's reach.
import { fit, hex, ease, band, cycle, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Signal pulse",
  desc: "A cyan signal sent out over the floor: a blink, three thin dashed rings going out one after another, light packets racing along six spokes, motes drifting up.",
  tags: ["buff", "signal", "ring", "cyan", "top-down", "one-shot"],
  size: [128, 84],
  origin: [64, 42],
  duration: 0.85,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0c2a34", "#13586a", "#1fa0b4", "#5fe0ec", "#c8fbff"], reach: 54, seed: 3 },
};

const FLAT = 0.5;

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), RAD = o.reach;
  // the blink at the orb
  if (t < 0.14) { const k = t / 0.14; p.ellipse(0, 0, 6 + k * 4, (6 + k * 4) * FLAT, C[3], 1 - k); p.ellipse(0, 0, 3, 1.5, WHITE, 1 - k); p.glow(0, 0, 16, C[3], 0.6 * (1 - k)); }
  // three dashed rings, one after another
  for (const [d, th] of [[0, 2], [0.14, 1.5], [0.28, 1]]) {
    const k = (t - d) / 0.5;
    if (k < 0 || k >= 1) continue;
    const r = 4 + RAD * ease.outQuad(k), dashes = 18;
    band(p, 0, 0, r, FLAT, Math.max(1, th * (1.2 - k)), 1.15 - k, [C[1], C[2], C[3], C[4]], (g) => Math.floor(((g / TAU) * dashes + k * 2) % 2) === 0, d === 0);
  }
  // packets of light racing out along six spokes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26, k = clamp((t - 0.04 - i * 0.015) / 0.42, 0, 1);
    if (k <= 0 || k >= 1) continue;
    const r = 6 + RAD * ease.outCubic(k), x = Math.cos(a) * r, y = Math.sin(a) * r * FLAT;
    const bx = Math.cos(a) * (r - 7), by = Math.sin(a) * (r - 7) * FLAT;
    p.line(bx, by, x, y, C[3], 1 - k * 0.6);
    p.px(Math.round(x), Math.round(y), WHITE);
    p.light(x, y, C[3], 0.4 * (1 - k));
  }
  // motes drifting up off the floor
  cycle(t, meta.duration, 10, o.seed, 0.5, (age, life, g) => {
    const k = age / life, a = g.next() * TAU, r = 6 + g.next() * RAD * 0.7;
    p.dot(Math.cos(a) * r, Math.sin(a) * r * FLAT - k * 14, k < 0.3 ? C[4] : C[3], clamp(1 - k) * clamp((1 - t / meta.duration) * 3));
  });
}
