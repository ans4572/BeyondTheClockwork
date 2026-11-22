// Beyond the Clockwork: Belgard's greatsword slamming into the floor, seen from above. A flat white flash, six cracks
// shooting out across the stone, a dust ring rolling out to the reach, stone chips thrown up and falling back. One-shot.
// Cream for him, cyan for Orden's puppet (`palette`).
import { Particles, P, Rng, fit, hex, ease, band, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Greatsword slam",
  desc: "A greatsword slamming the floor, seen from above: a flat white flash, six cracks shooting out over the stone, a dust ring rolling out, chips thrown up and falling back.",
  tags: ["impact", "slam", "floor", "cracks", "top-down", "one-shot"],
  size: [112, 104],
  origin: [56, 56],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1e16", "#6a5a46", "#b8a888", "#f3e6c4", "#ffffff"], dust: "#a8987e", reach: 30, seed: 12 },
};

const FLAT = 0.55;

export function create(o) {
  const C = fit(o.palette, 5).map(hex), R = new Rng(o.seed), RAD = o.reach, dust = hex(o.dust);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [WHITE, C[4], C[3]] });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + R.range(-0.1, 0.1), sp = R.range(55, 85);
    ps.spawn(P.DUST, Math.cos(a) * 5, Math.sin(a) * 5 * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(2, 6), R.range(0.4, 0.6), dust, R.range(2, 3.2), R.range(0, 0.06));
  }
  for (let i = 0; i < 16; i++) {
    const a = R.range(0, TAU), sp = R.range(30, 75);
    ps.spawn(P.GRIT, Math.cos(a) * 3, Math.sin(a) * 1.5, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(50, 95), R.range(0.3, 0.5), R.pick([C[1], C[2], C[2], C[3]]), 1);
  }
  // six cracks, jagged, each its own length
  const cracks = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU + R.range(-0.3, 0.3), len = RAD * R.range(0.7, 1.05), pts = [[0, 0]];
    for (let d = 4; d < len; d += 4) { const j = R.range(-0.25, 0.25); pts.push([Math.cos(a + j) * d, Math.sin(a + j) * d * FLAT]); }
    return pts;
  });
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      const k = clamp(t / 0.12, 0, 1), fade = clamp(1 - (t - 0.45) / 0.3, 0, 1);
      if (t < 0.1) { const g = 1 + t * 10; p.ellipse(0, 0, 9 * g, 9 * FLAT * g, C[3], 1); p.ellipse(0, 0, 5 * g, 5 * FLAT * g, WHITE, 1); }
      // the cracks shoot out, dark seams with a lit lower lip, and fade at the end
      for (const pts of cracks) {
        const n = Math.max(2, Math.round(pts.length * ease.outCubic(k)));
        if (fade < 0.4) continue;   // solid seams that go at once (dithered ones read as dotted gold)
        p.polyline(pts.slice(1, n).map(([x, y]) => [x, y + 1]), C[1]);
        p.polyline(pts.slice(0, n), C[0]);
      }
      const r = (t - 0.02) / 0.4;
      if (r > 0 && r < 1) band(p, 0, 0, 4 + RAD * ease.outCubic(r), FLAT, Math.max(1, 3 * (1 - r)), 1.2 - r, [C[1], C[2], C[3], C[4]], (g) => Math.sin(g) < 0, true);
      ps.draw(p, "back");
    },
    draw(p) {
      const r = (t - 0.02) / 0.4;
      if (r > 0 && r < 1) band(p, 0, 0, 4 + RAD * ease.outCubic(r), FLAT, Math.max(1, 3 * (1 - r)), 1.2 - r, [C[1], C[2], C[3], C[4]], (g) => Math.sin(g) >= 0, true);
      ps.draw(p, "front");
      if (t < 0.14) p.glow(0, 0, 22, C[3], 0.6 * (1 - t / 0.14));
    },
  };
}
