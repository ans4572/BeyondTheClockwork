// Beyond the Clockwork: a shockwave along the floor, seen from above, for a heavy blow (a mob's big swing, a stomp, a
// boss pressing a row). No disc: a short flat flash, a bright ring racing out to the reach with a thinner one behind it,
// dust rolling out low along the floor and a few chips thrown. Neutral dust and cream, so it sits on any floor.
import { Particles, P, Rng, fit, hex, ease, band, mix, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Floor shock",
  desc: "A shockwave along the floor seen from above: a quick flat flash, a bright ring racing out with a thinner one behind, dust rolling out low and a few chips.",
  tags: ["impact", "shockwave", "stomp", "floor", "top-down", "one-shot"],
  size: [96, 72],
  origin: [48, 36],
  duration: 0.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3e342c", "#7a6c5c", "#c8b896", "#f2e6c8", "#fff8e4"], dust: "#a8987e", reach: 32, seed: 6 },
};

const FLAT = 0.55;

export function create(o) {
  const C = fit(o.palette, 5).map(hex), R = new Rng(o.seed), RAD = o.reach, dust = hex(o.dust), lit = mix(dust, WHITE, 0.35);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [WHITE, C[4], C[3], C[2]] });
  // (2026-11-11: drawn for a 32 px reach, about the 1.5-unit blows most callers use, so rings keep their weight in the game)
  // dust born on a small ring and pushed out along the floor, a little behind the ring
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + R.range(-0.1, 0.1), d = R.range(4, 8), sp = R.range(70, 105);
    ps.spawn(P.DUST, Math.cos(a) * d, Math.sin(a) * d * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(2, 6), R.range(0.32, 0.48), R.chance(0.4) ? lit : dust, R.range(1.8, 3), R.range(0, 0.05));
  }
  for (let i = 0; i < 14; i++) {
    const a = R.range(0, TAU), sp = R.range(35, 80);
    ps.spawn(P.GRIT, Math.cos(a) * 4, Math.sin(a) * 2, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(35, 75), R.range(0.2, 0.32), R.pick([C[0], C[1], C[1], C[2]]), 1);
  }
  let t = 0;
  const rings = (p, near) => {
    for (const [delay, span, th, reach, k0] of [[0, 0.3, 4, RAD, 1.3], [0.05, 0.36, 2.5, RAD * 0.7, 1.05]]) {
      const k = (t - delay) / span;
      if (k < 0 || k >= 1) continue;
      band(p, 0, 0, 3 + reach * ease.outCubic(k), FLAT, Math.max(1, th * (1 - k)), k0 - k, [C[1], C[2], C[3], C[4]], (g) => (Math.sin(g) >= 0) === near, delay === 0);
    }
  };
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      if (t < 0.07) { const g = 1 + t * 6; p.ellipse(0, 0, 7 * g, 7 * FLAT * g, C[3], 1); p.ellipse(0, 0, 4 * g, 4 * FLAT * g, WHITE, 1); }
      rings(p, false); ps.draw(p, "back");
    },
    draw(p) { rings(p, true); ps.draw(p, "front"); },
  };
}
