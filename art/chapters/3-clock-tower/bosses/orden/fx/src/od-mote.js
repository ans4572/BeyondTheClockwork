// Beyond the Clockwork: the last speck of Orden's light in the liberation cutscene (2026-11-20, the user's pick: after he
// is gone one mote drifts down to F2 and goes out in front of him). A small round light breathing: a white core, a cyan
// ring of glow, a four-point twinkle turning slowly, two sparks circling it. Loop of 1.2 s. Origin = its middle.
import { fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "A last mote of light",
  desc: "One small mote of light breathing: a white core, a soft glow, a slowly turning four-point twinkle, two sparks circling.",
  tags: ["holy", "arcane", "ambient", "pickup", "loop", "light"],
  size: [40, 40],
  origin: [20, 20],
  duration: 1.2,
  loop: true,
  fps: 20,
  bg: "dark",
  options: {},
};

const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"];

export function draw(p, t) {
  const u = t / meta.duration, ph = u * TAU, C = fit(CYAN, 6).map(hex), b = 0.5 + 0.5 * Math.sin(ph);
  p.glow(0, 0, 9 + b * 3, C[3], 0.35 + b * 0.15);
  // the core
  p.disc(0, 0, 2.4 + b * 0.6, C[4], 1);
  p.px(0, 0, WHITE); p.px(-1, 0, WHITE); p.px(0, -1, WHITE); if (b > 0.5) { p.px(1, 0, WHITE); p.px(0, 1, WHITE); }
  // a four-point twinkle, its arms longer as it breathes, a quarter turn a loop (the arms look the same each quarter)
  const len = Math.round(5 + b * 4), a0 = ph / 4;
  for (let i = 0; i < 4; i++) {
    const a = a0 + i * TAU / 4;
    for (let r = 3; r <= len; r++) p.px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), r > len - 2 ? C[3] : C[4]);
  }
  // two sparks circling
  for (let i = 0; i < 2; i++) { const a = ph + i * Math.PI, x = Math.round(Math.cos(a) * 11), y = Math.round(Math.sin(a) * 6); p.px(x, y, i ? C[4] : WHITE); p.light(x, y, C[4], 0.5); }
}
