// Beyond the Clockwork: the bell turret's bell landing (chapter 3), seen from above. The bell drops onto the floor and
// rings: a short flat flash, a gold ring with dial ticks racing out to the reach with a thinner ring behind it, sound
// arcs rising off the bell as it rocks to a stop, brass chips, then the bell sinks away. One-shot.
import { Particles, P, Rng, fit, hex, ease, band, clamp, TAU, WHITE } from "../../core/index.js";
import { bellBody } from "./bell-shot.js";

export const meta = {
  name: "Bell toll",
  desc: "A small brass bell lands and rings, seen from above: a flat flash, a gold ring with dial ticks racing out, a thinner one behind, sound arcs rising as it rocks to a stop.",
  tags: ["impact", "bell", "ring", "floor", "top-down", "one-shot"],
  size: [96, 84],
  origin: [48, 46],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1e1006", "#5a3410", "#9a6420", "#d09a3c", "#f0cc6a", "#fff4c0"], reach: 26, seed: 4 },
};

const FLAT = 0.5;

export function create(o) {
  const C = fit(o.palette, 6).map(hex), R = new Rng(o.seed), RAD = o.reach;
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [WHITE, C[5], C[4], C[3]] });
  for (let i = 0; i < 12; i++) {
    const a = R.range(0, TAU), sp = R.range(30, 70);
    ps.spawn(P.GRIT, Math.cos(a) * 3, Math.sin(a) * 1.5, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(30, 60), R.range(0.2, 0.34), R.pick([C[2], C[3], C[4]]), 1);
  }
  let t = 0;
  const rings = (p, near) => {
    for (const [delay, span, th, reach, k0] of [[0.06, 0.34, 3, RAD, 1.3], [0.14, 0.4, 2, RAD * 0.72, 1.0]]) {
      const k = (t - delay) / span;
      if (k < 0 || k >= 1) continue;
      const r = 3 + reach * ease.outCubic(k);
      band(p, 0, 0, r, FLAT, Math.max(1, th * (1 - k)), k0 - k, [C[2], C[3], C[4], C[5]], (g) => (Math.sin(g) >= 0) === near, delay < 0.1);
      // the first ring carries twelve dial ticks
      if (delay < 0.1 && k < 0.8) for (let i = 0; i < 12; i++) {
        const g = (i / 12) * TAU;
        if ((Math.sin(g) >= 0) !== near) continue;
        const cx = Math.cos(g), cy = Math.sin(g) * FLAT;
        p.line(cx * (r - 2), cy * (r - 2), cx * (r + 2), cy * (r + 2), i % 3 === 0 ? C[5] : C[4], 1 - k);
      }
    }
  };
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      const f = t - 0.05; if (f >= 0 && f < 0.08) { const g = 1 + f * 8; p.ellipse(0, 0, 8 * g, 8 * FLAT * g, C[4], 1); p.ellipse(0, 0, 5 * g, 5 * FLAT * g, WHITE, 1); }
      rings(p, false); ps.draw(p, "back");
    },
    draw(p) {
      const f = t - 0.05;
      // the bell: drops in over the first few frames, rocks with a dying swing, then sinks away
      const drop = clamp(t / 0.06, 0, 1), fall = (1 - ease.inQuad(drop)) * -14;
      const sw = Math.sin(t * 22) * Math.exp(-t * 4.5), fade = t < 0.5 ? 1 : clamp(1 - (t - 0.5) / 0.22, 0, 1);
      if (fade > 0) bellBody(p, C, 0.32 * sw, 0, -6 + fall, sw, fade);
      // sound arcs rising off the bell
      for (const [d, side] of [[0.07, 1], [0.14, -1], [0.22, 1], [0.3, -1]]) {
        const k = (t - d) / 0.32;
        if (k < 0 || k >= 1) continue;
        const r = 8 + k * 10, mid = side > 0 ? -0.35 : Math.PI + 0.35, span = 0.55 * (1 - k);
        p.arc(0, -10 - k * 6, r, 1, mid - span, mid + span, k < 0.4 ? C[5] : C[4]);
      }
      rings(p, true); ps.draw(p, "front");
      if (f >= 0 && f < 0.12) p.glow(0, -2, 16, C[4], 0.5 * (1 - f / 0.12));
    },
  };
}
