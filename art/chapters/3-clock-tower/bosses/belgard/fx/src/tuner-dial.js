// Beyond the Clockwork: the half dial over each of Belgard's tuning pillars in the forged orders (2026-11-19, it
// replaced arcs stroked in code). A brass arc with a dark rim, ticks at its ends and middle, the green middle where the
// needle is in tune (`tune` of the swing either side), lit and shining when `lit` (the needle is in it). The game draws
// the needle over it. A loop. Origin = the needle's pivot.
import { fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Tuner dial",
  desc: "A brass half dial with a green in-tune middle, shining when lit; the needle is drawn over it.",
  tags: ["dial", "gauge", "brass", "loop", "ui"],
  size: [64, 40],
  origin: [32, 33],
  duration: 0.6,
  loop: true,
  fps: 20,
  bg: "dark",
  options: { palette: ["#2b1a0a", "#7a5418", "#c99a3a", "#f0d08a"], green: ["#0c3a1e", "#2fae63", "#7dffa8"], radius: 26, swing: 0.9, tune: 0.24, lit: 0 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 4).map(hex), G = fit(o.green, 3).map(hex), R = o.radius, glint = 0.5 + 0.5 * Math.sin((t / meta.duration) * TAU);
  for (let y = -R - 5; y <= 2; y++) for (let x = -R - 5; x <= R + 5; x++) {
    const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2;
    if (r < R - 4 || r > R + 3.5 || Math.abs(a) > o.swing + 0.04) continue;
    const rim = r < R - 3 || r > R + 2.5, inTune = Math.abs(a) <= o.swing * o.tune;
    p.px(x, y, rim ? C[0] : inTune ? (o.lit ? (r > R + 1 ? WHITE : G[2]) : r > R + 1 ? G[2] : G[1]) : r > R + 1 ? C[3] : C[2]);
  }
  // ticks: both ends, the middle, and the edges of the green
  for (const a of [-o.swing, -o.swing * o.tune, 0, o.swing * o.tune, o.swing]) {
    const s = Math.sin(a), c = -Math.cos(a);
    for (let r = R - 5; r <= R - 4; r++) p.px(Math.round(s * r), Math.round(c * r), a === 0 ? C[3] : C[0]);
  }
  if (o.lit) p.glow(0, -R, 10, G[2], 0.5 + 0.4 * glint);
}
