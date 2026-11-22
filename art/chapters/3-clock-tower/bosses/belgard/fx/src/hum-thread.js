// Beyond the Clockwork: one 32 px piece of a humming thread of sound between two of Belgard's ringing pillars (and
// Orden's puppet wave's afterimage), running right (2026-11-19, it replaced a sine line drawn in code). Two strands
// trembling out of step; one period each per piece and the same height at both ends, so pieces join end to end. A loop;
// `amp` 1 humming, 3 about to blow.
import { fit, hex, TAU } from "../../core/index.js";

export const meta = {
  name: "Humming thread",
  desc: "A piece of a trembling thread of sound, two strands out of step; pieces join end to end.",
  tags: ["sound", "beam", "thread", "top-down", "loop", "tile"],
  size: [36, 16],
  origin: [2, 8],
  duration: 0.25,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { palette: ["#0e3a48", "#1f7f96", "#5fe3ff", "#d8faff"], amp: 1, length: 32 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 4).map(hex), L = o.length, ph = (t / meta.duration) * TAU, A = o.amp;
  let prev = null;
  for (let x = 0; x < L; x++) {
    const u = (x / L) * TAU, y1 = Math.round(Math.sin(u + ph) * (1 + A)), y2 = Math.round(Math.sin(u * 2 - ph) * A * 0.8);
    // the steps between rows filled, so the strand never breaks
    if (prev !== null) for (let y = Math.min(prev, y1) + 1; y < Math.max(prev, y1); y++) p.px(x, y, C[2]);
    prev = y1;
    p.px(x, y2, C[1]);
    p.px(x, y1 + 1, C[1]);
    p.px(x, y1, x % 4 === Math.floor(t * 48) % 4 ? C[3] : C[2]);
    p.light(x, y1, C[2], 0.35 + 0.1 * A);
  }
}
