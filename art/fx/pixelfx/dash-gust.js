// Beyond the Clockwork: 압축 돌진, F2 shooting forward on a burst of compressed air, seen from above, facing right.
// A bright crescent of air shoved ahead of her, wind ribbons peeling back off its horns and curling, long speed lines
// streaming past on both sides and specks of grit thrown out. A loop, played while the dash lasts.
import { fit, hex, cycle, WHITE, clamp } from "../../core/index.js";

export const meta = {
  name: "Dash gust",
  desc: "A dash on a burst of compressed air, seen from above, facing right: a bright crescent of air ahead, wind ribbons curling back, speed lines streaming past, grit at the sides.",
  tags: ["wind", "dash", "gust", "top-down", "loop"],
  size: [144, 56],
  origin: [88, 28],
  duration: 0.5,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { palette: ["#1f3a3a", "#2f6f6a", "#5fb0a0", "#9fe0cc", "#d8f6ea", "#ffffff"], seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6).map(hex), D = meta.duration;
  // the air ahead: a fat crescent bowed forward, white on its leading rim, tinted behind, flickering a little
  const wob = Math.sin((t / D) * Math.PI * 2 * 4) * 0.6;
  for (let j = 0; j < 4; j++) {
    const r = 16 - j * 2.2;
    for (let a = -1.15; a <= 1.15; a += 0.03) {
      const x = 6 + Math.cos(a) * r * 0.75 + wob, y = Math.sin(a) * r;
      const edge = Math.abs(a) / 1.15;
      if (j === 3 && edge > 0.7) continue;
      p.px(x, y, j === 0 ? (edge < 0.6 ? WHITE : C[4]) : j === 1 ? C[4] : j === 2 ? C[3] : C[2]);
    }
  }
  p.glow(16, 0, 18, C[4], 0.3);
  // speed lines streaming past on both sides, fastest near the body
  cycle(t, D, 14, o.seed, 0.25, (age, life, g) => {
    const k = age / life, s = g.next() < 0.5 ? -1 : 1, y = s * (3 + g.next() * 14), len = 8 + g.next() * 16, x0 = 4 - k * 80;
    for (let i = 0; i < len; i++) p.dot(x0 - i, y, i < 2 ? C[5] : i < len * 0.5 ? C[4] : C[3], clamp(1.2 - k) * (1 - i / len));
  });
  // ribbons: curls of wind leaving the crescent's horns, rolling over as they slide back
  cycle(t, D, 6, o.seed + 2, 0.5, (age, life, g) => {
    const k = age / life, s = g.next() < 0.5 ? -1 : 1, len = 12 + g.next() * 10, x0 = 2 - k * 60, y0 = s * (12 + k * 6);
    for (let i = 0; i < len; i++) {
      const u = i / len, curl = Math.sin(u * Math.PI * 1.5 + k * 5) * (2 + 3 * k);
      p.dot(x0 - i, y0 + s * curl, i < 2 ? WHITE : C[4], clamp(1 - k) * (1 - u * 0.8));
    }
  });
  // grit kicked out at the sides
  cycle(t, D, 10, o.seed + 5, 0.3, (age, life, g) => {
    const k = age / life, s = g.next() < 0.5 ? -1 : 1, x = -4 - g.next() * 30 - k * 20, y = s * (12 + k * 10 + g.next() * 4);
    p.dot(x, y, C[2], 1 - k);
  });
}
