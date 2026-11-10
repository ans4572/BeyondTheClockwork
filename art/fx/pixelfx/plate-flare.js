// Beyond the Clockwork: F2 burned by a hot floor plate, seen from above. A flat orange ring snaps out round her feet
// and a few tongues of flame lick up from under them with sparks, gone in half a second. The flame puffs come from the
// toolkit's FIRE particles (adapted from Sprite Fusion's open-source fire, MIT, Copyright (c) 2026 Hugo Duprez).
import { Particles, Lights, P, Rng, fit, ease, band, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Plate flare",
  desc: "A hot floor plate burns the feet, seen from above: a flat orange ring snaps out and small flames lick up with sparks.",
  tags: ["fire", "burn", "floor", "top-down", "one-shot"],
  size: [80, 80],
  origin: [40, 56],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], reach: 16, seed: 9 },
};

const FLAT = 0.55;

export function create(o) {
  const F = fit(o.palette, 8).map(hex), RAD = o.reach, R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [F[6], F[5], F[3], F[2]] }), lights = new Lights();
  lights.add(0, -4, 22, F[4], 0.45, 0.25);
  for (let i = 0; i < 7; i++) {
    const a = R.range(0, TAU), d = R.range(2, RAD * 0.6);
    ps.spawn(P.FIRE, Math.cos(a) * d, Math.sin(a) * d * FLAT, R.range(-8, 8), R.range(-70, -35), R.range(0.22, 0.38), 0, R.range(2.6, 4.2), R.range(0, 0.08));
  }
  for (let i = 0; i < 9; i++) {
    const a = R.range(0, TAU), sp = R.range(50, 120);
    ps.spawn(P.SPARK, Math.cos(a) * 4, Math.sin(a) * 2, Math.cos(a) * sp * 0.6, -R.range(60, 150), R.range(0.15, 0.32));
  }
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); lights.update(dt); },
    drawBack(p) {
      ps.draw(p, "back");
      const k = t / 0.3;
      if (k < 1) band(p, 0, 0, RAD * ease.outCubic(k), FLAT, Math.max(1, 2.5 * (1 - k)), 1.1 - k, [F[2], F[3], F[5], F[6]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      const k = t / 0.3;
      if (k < 1) band(p, 0, 0, RAD * ease.outCubic(k), FLAT, Math.max(1, 2.5 * (1 - k)), 1.1 - k, [F[2], F[3], F[5], F[6]], (g) => Math.sin(g) >= 0);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
