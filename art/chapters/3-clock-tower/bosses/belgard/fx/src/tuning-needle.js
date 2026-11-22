import { fit, hex, cycle, clamp, TAU, WHITE } from "../../core/index.js";
import { pool } from "../pickups/_lib.js";

export const meta = {
  name: "Tuning needle",
  desc: "A long cyan tuning needle driven into the floor, humming: its eye glows, light runs down the shaft and rings of sound spread across the floor from its point.",
  tags: ["belfry", "prop", "needle", "sound", "loop"],
  size: [56, 64],
  origin: [28, 52],
  duration: 0.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"], seed: 5 },
};

const INK = hex("#0a1820"), TOP = -44;

export function drawBack(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration;
  pool(p, 0, 0, 14, 4, C[3], 0.2);
  // rings of sound spreading over the floor from the point, flat ellipses
  for (let k = 0; k < 2; k++) {
    const u = (ph + k / 2) % 1, r = 3 + u * 22, a = clamp((1 - u) * 1.4, 0, 1);
    p.shade(-r - 1, -r * 0.3 - 1, r + 1, r * 0.3 + 1, (x, y, out) => {
      const d = Math.hypot(x / r, y / (r * 0.3));
      if (Math.abs(d - 1) * r > 0.6) return;
      out.c = u < 0.3 ? C[5] : C[4]; out.a = a;
    });
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration;
  // the shaft: 3 px wide at the top, 1 px at the point, lit left
  for (let y = TOP + 4; y <= 0; y++) {
    const w = y > -8 ? 0 : y > -26 ? 1 : 1;
    if (w === 0) { p.px(0, y, C[4]); p.px(-1, y, INK); p.px(1, y, INK); continue; }
    p.px(-2, y, INK); p.px(2, y, INK);
    p.px(-1, y, C[4]); p.px(0, y, C[3]); p.px(1, y, C[2]);
  }
  // the eye: an open loop with a white-hot core
  p.ring(0, TOP + 1, 3, 1, C[4]);
  p.px(-3, TOP + 1, INK); p.px(3, TOP + 1, INK); p.px(0, TOP - 3, INK);
  const pulse = 0.7 + 0.3 * Math.sin(ph * TAU * 2);
  p.px(0, TOP + 1, WHITE);
  p.glow(0, TOP + 1, 10, C[3], 0.4 * pulse);
  p.glow(0, TOP + 1, 3, C[5], 0.6 * pulse);
  // light running down the shaft
  const run = (ph * 2) % 1, y = TOP + 4 + run * (-TOP - 4);
  p.px(-1, y, WHITE); p.px(0, y, C[5]); p.light(0, y, C[4], 0.5);
  // a few motes rising off it
  cycle(t, meta.duration, 6, o.seed, 0.5, (age, life, r) => {
    const k = age / life, x = r.range(-6, 6), yy = -4 - k * r.range(20, 40);
    p.px(x, yy, k < 0.5 ? C[5] : C[4]); p.light(x, yy, C[3], 0.2 * (1 - k));
  });
}
