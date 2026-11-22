// Beyond the Clockwork: Belgard's grab, seen from above, reaching right. A huge bronze gauntlet, fingers spread, shoots
// out with speed lines streaming behind it, then snaps shut into a fist with a bronze flash and a ring of grit. A
// one-shot played as it reaches; the game slides it along the grab's line.
import { fit, hex, ease, clamp, cycle, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Bronze gauntlet grab",
  desc: "A huge bronze gauntlet seen from above, fingers spread, shooting out with speed lines behind it, then snapping shut into a fist with a bronze flash and grit.",
  tags: ["grab", "hand", "gauntlet", "bronze", "one-shot"],
  size: [80, 56],
  origin: [44, 28],
  duration: 0.36,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1806", "#6a4214", "#b07c2c", "#e0b052", "#fff0b0"], seed: 3 },
};

const INK = hex("#140c08");

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), close = ease.inOutCubic(clamp((t - 0.12) / 0.1, 0, 1)), fade = clamp(1 - (t - 0.24) / 0.09, 0, 1);
  if (fade <= 0) return;
  // speed lines streaming behind, while it flies
  if (t < 0.18) cycle(t, 0.18, 8, o.seed, 0.12, (age, life, g) => { const k = age / life, y = (g.next() - 0.5) * 22, x = -14 - k * 24; p.line(x, y, x - 8, y, k < 0.4 ? C[4] : C[3], clamp(1 - k)); });
  // the palm: a rounded block lit on its top left
  const palm = (x, y) => (x / 9) ** 2 + (y / 8) ** 2 <= 1;
  for (let y = -9; y <= 9; y++) for (let x = -10; x <= 10; x++) {
    if (!palm(x + 0.5, y + 0.5)) { if (palm(x + 1.5, y + 0.5) || palm(x - 0.5, y + 0.5) || palm(x + 0.5, y + 1.5) || palm(x + 0.5, y - 0.5)) p.px(x, y, INK); continue; }
    p.px(x, y, x + y < -6 ? C[4] : x + y < 2 ? C[3] : x + y < 8 ? C[2] : C[1]);
  }
  // four fingers and a thumb, spread then curling shut over the palm
  for (const [i, base] of [[-1.5, -6], [-0.5, -2], [0.5, 2], [1.5, 6]].entries()) {
    const spread = base[1] * (1 - close) * 0.5, len = 12 - close * 6, y0 = base[1] * 0.7;
    const x1 = 8 + len * (1 - close * 0.4), y1 = y0 + spread + close * -y0 * 0.6;
    p.beam(7, y0, x1, y1, 2.2, i === 0 ? C[3] : C[2]); p.line(7, y0 - 1, x1, y1 - 1, C[4], 0.7);
    if (close > 0.9) p.px(Math.round(x1), Math.round(y1), INK);
  }
  const thumb = 1 - close;
  p.beam(0, -8, 6 + thumb * 4, -12 - thumb * 4, 2.4, C[3]);
  // the cuff behind the palm
  p.rect(-16, -6, 6, 12, C[1]); p.line(-16, -6, -11, -6, C[3]); p.rect(-12, -7, 2, 14, C[2]);
  // snapping shut: a bronze flash and grit
  if (close > 0.6 && t < 0.3) { const k = (t - 0.18) / 0.12; p.ring(10, 0, 6 + k * 10, 1, C[4], 1 - k); p.glow(10, 0, 16, C[3], 0.7 * (1 - k)); if (k < 0.3) p.circle(10, 0, 4, WHITE, 1 - k * 3); }
  if (t > 0.2) cycle(t - 0.2, 0.16, 8, o.seed + 2, 0.14, (age, life, g) => { const k = age / life, a = g.next() * TAU, d = 6 + k * 12; p.dot(10 + Math.cos(a) * d, Math.sin(a) * d, C[3], clamp(1 - k)); });
}
