// Beyond the Clockwork: Tick·Tock's small parts that were lines drawn in code (2026-11-19). `part` 0: the echo clock
// face's hand, pointing right from its hub (the game turns it); `part` 1: one 32 px piece of the giant metronome's rod,
// running right, ends joining (the game lays pieces along the swinging rod). Still pictures (one-frame loops).
import { fit, hex } from "../../core/index.js";

export const meta = {
  name: "Tick·Tock parts",
  desc: "A clock hand pointing right from its hub, or a piece of a brass metronome rod; still pictures the game turns.",
  tags: ["clock", "hand", "rod", "brass", "still"],
  size: [36, 12],
  origin: [3, 6],
  duration: 0.1,
  loop: true,
  fps: 10,
  bg: "ground",
  options: { palette: ["#1a1f2c", "#2b3345", "#5a6478", "#c99a3a"], rod: ["#2a1806", "#6b4a1c", "#a8782c", "#ffd257"], part: 0, length: 22 },
};

export function draw(p, t, o) {
  if (o.part === 1) {
    // the rod: dark rims, brown body, a gold shine along its upper side, a rivet every 16 px
    const R = fit(o.rod, 4).map(hex);
    for (let x = -3; x < 32 - 3; x++) {
      p.px(x, -3, R[0]); p.px(x, -2, R[3]); p.px(x, -1, R[2]); p.px(x, 0, R[1]); p.px(x, 1, R[1]); p.px(x, 2, R[0]);
      if ((x + 3) % 16 === 8) { p.px(x, -1, R[3]); p.px(x, 0, R[2]); }
    }
    return;
  }
  // the hand: a hub, a shaft, a lozenge near the tip and a point
  const C = fit(o.palette, 4).map(hex), L = o.length;
  for (let x = 0; x <= L; x++) { p.px(x, 0, C[1]); if (x < L - 6) p.px(x, 1, C[0]); }
  for (const [dx, h] of [[-8, 1], [-7, 2], [-6, 2], [-5, 1]]) for (let y = -h; y <= h; y++) p.px(L + dx, y, Math.abs(y) === h ? C[0] : C[2]);
  p.px(L + 1, 0, C[0]);
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) p.px(x, y, x * x + y * y > 2 ? C[0] : C[3]);
}
