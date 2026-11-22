// Beyond the Clockwork: air rushing past Belgard's bell as it falls (2026-11-19, it replaced streaks drawn in code).
// Pale streaks of different lengths racing up past it and thinning out. A loop; origin = the top of the bell.
import { cycle, fit, hex } from "../../core/index.js";

export const meta = {
  name: "Falling streaks",
  desc: "Pale streaks of air racing up past something falling, thinning out at their tops.",
  tags: ["wind", "motion", "speed lines", "loop"],
  size: [72, 96],
  origin: [36, 92],
  duration: 0.3,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#8a7a62", "#d8c8a4", "#fff4d6"], width: 30, seed: 9 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 3).map(hex), W = o.width;
  cycle(t, meta.duration, 9, o.seed, 0.22, (age, life, g) => {
    const k = age / life, x = Math.round((g.next() * 2 - 1) * W), len = 18 + g.next() * 34, y0 = -4 - k * 70;
    for (let d = 0; d < len; d++) {
      const u = d / len, y = Math.round(y0 - d);
      if (y < -90) break;
      p.dot(x, y, u < 0.25 ? C[2] : u < 0.7 ? C[1] : C[0], (1 - k) * (1 - u * 0.6));
      if (u < 0.2) p.dot(x + 1, y, C[1], (1 - k) * 0.6);
    }
  });
}
