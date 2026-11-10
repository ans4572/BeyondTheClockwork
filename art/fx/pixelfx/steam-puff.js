// Beyond the Clockwork: water meeting a burning body, seen from above at a slant. The flames go out in a hiss: a flat
// pale ring on the floor, a few last orange sparks, and a cloud of white steam that billows up from the body and thins
// away. Origin = the body's feet; it rises about 40 px.
import { Particles, P, Rng, fit, ease, band, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Steam puff",
  desc: "Water puts out a burning body, seen from above: a flat pale ring, a few dying sparks and a white steam cloud billowing up and thinning.",
  tags: ["water", "fire", "steam", "status", "top-down", "one-shot"],
  size: [88, 88],
  origin: [44, 64],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#5f7f86", "#9fbcc2", "#cfe4e7", "#eef6f6", "#ffffff"], ember: ["#c9281f", "#ff8a2a", "#ffc23d"], seed: 4 },
};

const FLAT = 0.55;

export function create(o) {
  const C = fit(o.palette, 5).map(hex), F = fit(o.ember, 3).map(hex), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [F[2], F[1], F[0], F[0]] });
  // the steam: soft puffs born round the body's middle, rising and spreading, light ones in front
  for (let i = 0; i < 14; i++) {
    const a = R.range(0, TAU), d = R.range(0, 7), y = -R.range(6, 20);
    ps.spawn(P.DUST, Math.cos(a) * d, y + Math.sin(a) * d * FLAT, Math.cos(a) * R.range(10, 26), -R.range(35, 65), R.range(0.38, 0.55), C[R.chance(0.6) ? 4 : 3], R.range(5, 8.5), R.range(0, 0.1));
  }
  for (let i = 0; i < 6; i++) ps.spawn(P.DUST, R.range(-6, 6), -R.range(16, 28), R.range(-8, 8), -R.range(45, 75), R.range(0.4, 0.5), C[4], R.range(3.5, 5.5), R.range(0.04, 0.14));
  // the last of the fire: a few sparks spat out as it dies
  for (let i = 0; i < 6; i++) { const a = R.range(0, TAU); ps.spawn(P.SPARK, 0, -12, Math.cos(a) * R.range(60, 120), Math.sin(a) * 50 - R.range(40, 90), R.range(0.08, 0.2)); }
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      ps.draw(p, "back");
      const k = t / 0.35;
      if (k < 1) band(p, 0, 0, 16 * ease.outCubic(k), FLAT, Math.max(1, 2 * (1 - k)), 1 - k, [C[1], C[2], C[3], C[4]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      const k = t / 0.35;
      if (k < 1) band(p, 0, 0, 16 * ease.outCubic(k), FLAT, Math.max(1, 2 * (1 - k)), 1 - k, [C[1], C[2], C[3], C[4]], (g) => Math.sin(g) >= 0);
      ps.draw(p, "front");
    },
  };
}
