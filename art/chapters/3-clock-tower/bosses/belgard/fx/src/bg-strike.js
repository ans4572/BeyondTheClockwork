// Beyond the Clockwork: Belgard's blade biting into the floor, seen from above (2026-11-19, it replaced code-drawn
// lines that read as pen strokes on the floor). A flat flash, seven cracks tearing out across the stone with branches,
// molten light in them that cools from white through gold to a dark seam, a scorch at the middle, chips thrown up and
// falling back, sparks, and dust rolling out. One-shot; the seams stay to the end (the game fades it).
// Gold for him, cyan for Orden's puppet (`palette`, `heat`).
import { Particles, P, Rng, fit, hex, ease, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Greatsword strike cracks",
  desc: "A greatsword biting into the floor, seen from above: a flash, seven branching cracks tearing out with molten light cooling in them, a scorch, chips, sparks and dust.",
  tags: ["impact", "slam", "floor", "cracks", "top-down", "one-shot"],
  size: [128, 112],
  origin: [64, 50],
  duration: 1.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#24170f", "#6a5a46", "#b8a888", "#f3e6c4", "#ffffff"], heat: ["#8a3a10", "#e08a28", "#ffc860", "#fff2c0"], dust: "#a8987e", reach: 40, seed: 31 },
};

const FLAT = 0.55;

export function create(o) {
  const C = fit(o.palette, 5).map(hex), H = fit(o.heat, 4).map(hex), R = new Rng(o.seed), RAD = o.reach, dust = hex(o.dust);
  const ps = new Particles({ rng: R, ground: () => 14, sparks: [WHITE, o.heat[3], o.heat[2], o.heat[1]] });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + R.range(-0.15, 0.15), sp = R.range(45, 75);
    ps.spawn(P.DUST, Math.cos(a) * 6, Math.sin(a) * 6 * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(2, 6), R.range(0.45, 0.7), dust, R.range(2, 3.4), R.range(0.02, 0.08));
  }
  for (let i = 0; i < 18; i++) {
    const a = R.range(0, TAU), sp = R.range(25, 70);
    ps.spawn(P.GRIT, Math.cos(a) * 3, Math.sin(a) * 1.5, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(55, 105), R.range(0.35, 0.6), R.pick([C[1], C[2], C[2], C[3]]), 1);
  }
  for (let i = 0; i < 14; i++) {
    const a = R.range(0, TAU), sp = R.range(70, 140);
    ps.spawn(P.SPARK, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(30, 80), R.range(0.18, 0.35), 0, 1);
  }
  // Seven cracks, each a jagged run of whole pixels, with a branch off two of them; `at` = how far out each pixel lies (0..1).
  const cracks = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R.range(-0.25, 0.25), len = RAD * R.range(0.7, 1.15), pts = [];
    let wob = 0;
    for (let d = 3; d < len; d += 2) { wob = clamp(wob + R.range(-0.9, 0.9), -2.5, 2.5); pts.push([Math.cos(a) * d - Math.sin(a) * wob, (Math.sin(a) * d + Math.cos(a) * wob) * FLAT, d / RAD]); }
    cracks.push(pts);
    if (i % 3 === 0 && pts.length > 8) {
      const [bx, by, bd] = pts[Math.floor(pts.length * 0.45)], b = a + R.pick([-0.8, 0.8]), bl = len * 0.35, bp = [];
      for (let d = 2; d < bl; d += 2) bp.push([bx + Math.cos(b) * d, by + Math.sin(b) * d * FLAT, bd + d / RAD]);
      cracks.push(bp);
    }
  }
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      // the scorch, then the flash
      p.disc(0, 0, 9, C[0], 0.45);
      if (t < 0.1) { const g = 1 + t * 12; p.ellipse(0, 0, 10 * g, 10 * FLAT * g, C[3], 1); p.ellipse(0, 0, 6 * g, 6 * FLAT * g, WHITE, 1); }
      // the cracks tear outward in 0.18 s; each pixel cools from white through the heat ramp to a dark seam, the
      // pixels near the middle cooling last
      const open = ease.outCubic(clamp(t / 0.18, 0, 1));
      for (const pts of cracks) for (const [x, y, d] of pts) {
        if (d > open * 1.2) continue;
        const heat = clamp(1 - (t - 0.1) / 0.85 + (1 - d) * 0.25, 0, 1);
        p.px(Math.round(x), Math.round(y) + 1, C[1]);
        p.px(Math.round(x), Math.round(y), heat > 0.85 ? WHITE : heat > 0.6 ? H[3] : heat > 0.35 ? H[2] : heat > 0.15 ? H[1] : C[0]);
        if (heat > 0.15) p.light(Math.round(x), Math.round(y), H[2], heat * 0.6);
      }
      if (t < 0.6) p.glow(0, 0, 14, H[2], 0.5 * (1 - t / 0.6));
      ps.draw(p, "back");
    },
    draw(p) {
      ps.draw(p, "front");
      if (t < 0.14) p.glow(0, -2, 24, H[3], 0.6 * (1 - t / 0.14));
    },
  };
}
