// Beyond the Clockwork: a press plate (or crane, or piston) slamming the factory floor, seen from above. A white flat
// flash, two flat shock rings racing out, a ring of dust rolling outward along the floor, iron and brass chips thrown
// round and sparks. The dust and grit come from the toolkit (adapted from Sprite Fusion's open-source explosion,
// https://www.spritefusion.com/pixel-art-vfx/explosion, MIT License, Copyright (c) 2026 Hugo Duprez).
import { Particles, Lights, P, PF, Rng, fit, ease, band, clamp, TAU, hex, WHITE, mix } from "../../core/index.js";

export const meta = {
  name: "Press slam",
  desc: "A heavy plate slams the factory floor, seen from above: a flat white flash, two shock rings, dust rolling out along the floor, iron chips and brass sparks.",
  tags: ["impact", "slam", "shockwave", "dust", "floor", "top-down", "one-shot"],
  size: [176, 160],
  origin: [88, 60],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2b2a33", "#5a5560", "#8d8478", "#c79a3e", "#e8c860", "#fff4b7", "#ffffff"], dust: "#cfc6b4", reach: 56, seed: 4 },
};

// Flatter than the floor ellipse (0.55) so it reads as lying on the plates (2026-11-11: asked for an ellipse, not a circle).
const FLAT = 0.42;

export function create(o) {
  const C = fit(o.palette, 7).map(hex), R = new Rng(o.seed), RAD = o.reach, dust = hex(o.dust), dustLit = mix(dust, WHITE, 0.3);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [C[6], C[5], C[4], C[3]] }), lights = new Lights();
  lights.add(0, -4, 70, C[5], 0.55, 0.45);
  lights.add(0, -2, 34, WHITE, 0.9, 0.12);
  // dust rolling out along the floor: puffs born on a ring, pushed outward, barely rising
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU + R.range(-0.12, 0.12), d = R.range(9, 15), sp = R.range(50, 130);
    ps.spawn(P.DUST, Math.cos(a) * d, Math.sin(a) * d * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(2, 10), R.range(0.45, 0.85), R.chance(0.4) ? dustLit : dust, R.range(1.6, 3.6), R.range(0, 0.06));
  }
  // chips of iron and brass thrown round, falling back onto the floor plane
  for (let i = 0; i < 40; i++) {
    const a = R.range(0, TAU), sp = R.range(70, 190);
    ps.spawn(P.GRIT, Math.cos(a) * 6, Math.sin(a) * 3, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(80, 170), R.range(0.3, 0.6), R.pick([C[1], C[2], C[2], C[3], C[4]]), R.chance(0.3) ? 2 : 1);
  }
  for (let i = 0; i < 26; i++) {
    const a = R.range(0, TAU), sp = R.range(120, 300);
    ps.spawn(P.SPARK, Math.cos(a) * 4, Math.sin(a) * 2 - 2, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(40, 160), R.range(0.15, 0.4));
  }
  let t = 0;
  // two shock rings: a fast thin one and a slower fat one behind it
  const rings = (p, near) => {
    for (const [delay, span, th, reach] of [[0, 0.32, 3, RAD], [0.06, 0.5, 2, RAD * 0.75]]) {
      const k = (t - delay) / span;
      if (k < 0 || k >= 1) continue;
      band(p, 0, 0, 6 + reach * ease.outCubic(k), FLAT, Math.max(1, th * (1 - k)), 1.15 - k, [C[2], C[4], C[5], C[6]], (g) => (Math.sin(g) >= 0) === near, true);
    }
  };
  return {
    update(dt) { t += dt; ps.update(dt); lights.update(dt); },
    drawBack(p) {
      // the flash: a flat white disc, gone in four frames
      if (t < 0.1) { const f = 1 - t / 0.1, g = 1 + t * 5; p.ellipse(0, 0, 17 * g, 17 * FLAT * g, C[5], 1); p.ellipse(0, 0, 12 * g, 12 * FLAT * g, WHITE, 1); p.glow(0, 0, 30, WHITE, 0.6 * f); }
      rings(p, false);
      ps.draw(p, "back");
    },
    draw(p) { rings(p, true); ps.draw(p, "front"); lights.draw(p); },
  };
}
