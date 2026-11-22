// Beyond the Clockwork: one piece of a crack torn along the floor, seen from above, running right (2026-11-19, it
// replaced code-drawn lines that read as pen strokes on the floor). The game lays pieces end to end along the slam
// wave's trail and the crack strike's lines, flipping every other one; both ends sit on the middle row so they join.
// It tears open left to right, glows molten and cools to a dark seam with a lit lip, chips popping out of it. One-shot;
// its last frame is the cooled crack, which the game holds. Gold for him, cyan for Orden's puppet (`palette`, `heat`).
import { Rng, fit, hex, clamp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Floor fissure piece",
  desc: "A piece of a crack torn along the floor, running right: it tears open, glows molten, cools to a dark seam with a lit lip, chips popping out. Pieces join end to end.",
  tags: ["crack", "floor", "fissure", "top-down", "one-shot", "tile"],
  size: [36, 18],
  origin: [2, 10],
  duration: 1.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#24170f", "#6a5a46", "#b8a888", "#f3e6c4", "#ffffff"], heat: ["#8a3a10", "#e08a28", "#ffc860", "#fff2c0"], length: 32, seed: 5 },
};

/** The crack's middle row at each x: a wobble that starts and ends on 0, so pieces join. */
function path(o) {
  const R = new Rng(o.seed), L = o.length, ys = [];
  let y = 0;
  for (let x = 0; x <= L; x++) {
    const left = L - x;
    y = clamp(y + R.pick([-1, 0, 0, 1]), -Math.min(3, left), Math.min(3, left));
    ys.push(x === 0 || x === L ? 0 : y);
  }
  return ys;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), H = fit(o.heat, 4).map(hex), ys = path(o), L = o.length, R = new Rng(o.seed + 7);
  const open = clamp(t / 0.08, 0, 1) * L;
  for (let x = 0; x <= L; x++) {
    if (x > open) break;
    const y = ys[x], heat = clamp(1 - t / 0.75 - (x / L) * 0.05, 0, 1), wide = (x * 7 + o.seed) % 5 < 2 && x > 1 && x < L - 1;
    p.px(x, y + 1, C[1]);
    p.px(x, y - 1, C[0]);
    if (wide) p.px(x, y - 2, C[0]);
    p.px(x, y, heat > 0.8 ? WHITE : heat > 0.55 ? H[3] : heat > 0.3 ? H[2] : heat > 0.12 ? H[1] : C[0]);
    if (heat > 0.12) p.light(x, y, H[2], heat * 0.7);
  }
  // chips popping out of it in its first 0.4 s
  for (let i = 0; i < 4; i++) {
    const x = Math.round(R.range(3, L - 3)), at = R.range(0, 0.1), k = (t - at) / 0.35, side = R.pick([-1, 1]);
    if (k <= 0 || k >= 1) continue;
    p.px(x + Math.round(side * k * 3), ys[x] - Math.round(Math.sin(k * Math.PI) * 7), i % 2 ? C[2] : C[3]);
  }
}
