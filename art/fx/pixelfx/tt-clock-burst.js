// Beyond the Clockwork: a clock face bursting on the floor (Tick·Tock's blows: the echo, the dash's end, the pendulum,
// the pincer closing, the colour floor). A white flash, a dial ring with twelve ticks racing out flat on the floor, the
// face's shards and its two hands thrown up spinning, sparks, a ring of dust. One-shot; red for Tick, blue for Tock,
// gold for both (`palette`). Drawn for a 30 px reach.
import { Particles, P, Rng, fit, hex, ease, band, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Clock burst",
  desc: "A clock face bursting on the floor: a white flash, a dial ring with twelve ticks racing out flat, shards and two hands thrown up spinning, sparks and a ring of dust.",
  tags: ["impact", "clock", "burst", "floor", "top-down", "one-shot"],
  size: [112, 104],
  origin: [56, 60],
  duration: 0.7,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a0a10", "#a82028", "#e0564c", "#ffb0a0", "#ffffff"], metal: ["#3a2a12", "#b08a3c", "#f0d890"], reach: 30, seed: 7 },
};

const FLAT = 0.55;

export function create(o) {
  const C = fit(o.palette, 5).map(hex), M = fit(o.metal, 3).map(hex), R = new Rng(o.seed), RAD = o.reach;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[3], C[2]] });
  for (let i = 0; i < 10; i++) { const a = R.range(0, TAU), sp = R.range(40, 90); ps.spawn(P.SPARK, Math.cos(a) * 3, Math.sin(a) * 2 - 2, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(60, 120), R.range(0.25, 0.45), R.pick([WHITE, C[3], C[2]]), 1); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, sp = R.range(45, 70); ps.spawn(P.DUST, Math.cos(a) * 4, Math.sin(a) * 2, Math.cos(a) * sp, Math.sin(a) * sp * FLAT, R.range(0.35, 0.5), hex("#9a8a7a"), R.range(1.8, 2.8), 0); }
  // shards of the dial and its two hands, thrown up and spinning
  const bits = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU + R.range(-0.2, 0.2), sp: R.range(35, 70), up: R.range(90, 150), spin: R.range(-14, 14), hand: i < 2, len: i === 0 ? 9 : 6 }));
  let t = 0;
  const ring = (p, near) => {
    const k = (t - 0.02) / 0.42;
    if (k <= 0 || k >= 1) return;
    const r = 4 + RAD * ease.outCubic(k);
    band(p, 0, 0, r, FLAT, Math.max(1, 4 * (1 - k)), 1.3 - k, [C[1], C[2], C[3], C[4]], (g) => (Math.sin(g) >= 0) === near, true);
    for (let i = 0; i < 12; i++) {
      const g = (i / 12) * TAU;
      if ((Math.sin(g) >= 0) !== near || k > 0.8) continue;
      const cx = Math.cos(g), cy = Math.sin(g) * FLAT, long = i % 3 === 0;
      p.line(cx * (r - 3), cy * (r - 3), cx * (r + (long ? 4 : 2)), cy * (r + (long ? 4 : 2)), long ? WHITE : C[3]);
    }
  };
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      if (t < 0.1) { const g = 1 + t * 10; p.ellipse(0, 0, 10 * g, 10 * FLAT * g, C[3], 1); p.ellipse(0, 0, 6 * g, 6 * FLAT * g, WHITE, 1); }
      ring(p, false); ps.draw(p, "back");
    },
    draw(p) {
      ring(p, true);
      for (const b of bits) {
        const life = b.up / 300;   // back on the floor
        if (t > life) continue;
        const x = Math.cos(b.a) * b.sp * t, y = Math.sin(b.a) * b.sp * t * FLAT - (b.up * t - 300 * t * t), a = b.spin * t;
        if (b.hand) { p.line(x, y, x + Math.cos(a) * b.len, y + Math.sin(a) * b.len, M[2]); p.line(x + 1, y + 1, x + 1 + Math.cos(a) * b.len, y + 1 + Math.sin(a) * b.len, M[0]); }
        else p.tri(x + Math.cos(a) * 3, y + Math.sin(a) * 3, x + Math.cos(a + 2.2) * 3, y + Math.sin(a + 2.2) * 3, x + Math.cos(a + 4) * 2, y + Math.sin(a + 4) * 2, t < 0.15 ? WHITE : C[3]);
      }
      ps.draw(p, "front");
      if (t < 0.15) p.glow(0, -4, 22, C[3], 0.8 * (1 - t / 0.15));
    },
  };
}
