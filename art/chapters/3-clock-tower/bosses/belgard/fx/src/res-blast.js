// Beyond the Clockwork: one 32 px piece of the line between two of Belgard's ringing pillars blowing (2026-11-19, it
// replaced a thick blurred stroke drawn in code). A bar of white-cyan light as wide as the blow, thinning to a thread in
// 0.3 s, motes flicked off its edges. Running right; pieces join end to end. One-shot.
import { Rng, fit, hex, clamp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Resonance line blast",
  desc: "A piece of a line of sound blowing: a white-cyan bar thinning to a thread, motes flicked off its edges; pieces join end to end.",
  tags: ["sound", "beam", "blast", "top-down", "one-shot", "tile"],
  size: [36, 48],
  origin: [2, 24],
  duration: 0.3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0e3a48", "#1f7f96", "#5fe3ff", "#d8faff"], half: 13, length: 32, seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 4).map(hex), L = o.length, k = clamp(t / meta.duration, 0, 1), w = Math.max(0, Math.round(o.half * (1 - k) ** 1.5));
  if (k >= 1) return;
  for (let x = 0; x < L; x++) for (let y = -w; y <= w; y++) {
    const u = w ? Math.abs(y) / w : 0;
    p.px(x, y, u < 0.35 ? WHITE : u < 0.7 ? C[3] : u < 0.95 ? C[2] : C[1]);
  }
  p.glowLine(0, 0, L, 0, w + 2, C[2], 0.6 * (1 - k));
  const R = new Rng(o.seed);
  for (let i = 0; i < 6; i++) {
    const x = R.range(2, L - 2), side = R.pick([-1, 1]), v = R.range(25, 60);
    p.px(Math.round(x), Math.round(side * (o.half * 0.6 + v * t)), k < 0.6 ? WHITE : C[2]);
  }
}
