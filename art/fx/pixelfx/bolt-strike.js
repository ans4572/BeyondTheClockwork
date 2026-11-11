// Beyond the Clockwork: 공명 낙뢰, a bolt dropping on the nearest body, which then starts to ring, seen from above.
// A jagged bolt slams down from the top of the frame with a white hero frame, forks crack off it, a flat flash and two
// gold sound rings snap out on the floor, sparks bounce, and the strike point keeps pulsing a small ring as it fades.
import { Particles, Lights, P, Rng, fit, hex, ease, band, bolt, forks, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Bolt strike (resonant)",
  desc: "A bolt drops on a body seen from above: a jagged white-gold bolt with forks, a flat flash, gold sound rings snapping out on the floor, sparks, a ringing pulse after.",
  tags: ["lightning", "sound", "strike", "top-down", "one-shot"],
  size: [128, 144],
  origin: [64, 112],
  duration: 1.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a2a5a", "#6a4cc0", "#ffd257", "#ffe086", "#fff8cf", "#ffffff"], ring: "#e0a03c", seed: 7 },
};

const FLAT = 0.55, HIT = 0.05;

export function create(o) {
  const C = fit(o.palette, 6).map(hex), R = new Rng(o.seed), ring = o.ring;
  const path = bolt(R, R.range(-10, 10), -104, 0, -2, { jag: 0.28, depth: 5 }), fork = forks(R, path, { count: 3, len: 16, jag: 0.35 });
  const ramp = [ring, o.palette[2], o.palette[4], o.palette[5]];
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[5], C[4], C[3], C[2]] }), lights = new Lights();
  let t = 0, struck = false;
  const strike = () => {
    lights.add(0, -10, 60, C[3], 0.7, 0.5); lights.add(0, -2, 26, WHITE, 1, 0.12);
    for (let i = 0; i < 22; i++) { const a = R.range(0, TAU), sp = R.range(90, 240); ps.spawn(P.SPARK, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(60, 180), R.range(0.2, 0.5)); }
  };
  const rings = (p, near) => {
    for (const [d, span, r] of [[0, 0.3, 30], [0.07, 0.4, 22], [0.35, 0.3, 12], [0.6, 0.28, 10]]) {
      const k = (t - HIT - d) / span;
      if (k < 0 || k >= 1) continue;
      band(p, 0, 0, 4 + r * ease.outCubic(k), FLAT, Math.max(1, 2 * (1 - k)), 1.1 - k, ramp, (g) => (Math.sin(g) >= 0) === near);
    }
  };
  return {
    update(dt) { t += dt; if (!struck && t >= HIT) { struck = true; strike(); } ps.update(dt); lights.update(dt); },
    drawBack(p) {
      if (t >= HIT && t < HIT + 0.12) { const f = 1 - (t - HIT) / 0.12; p.ellipse(0, 0, 16, 16 * FLAT, WHITE, f); }
      rings(p, false); ps.draw(p, "back");
    },
    draw(p) {
      // the bolt: hero white for two frames, then gold, flickering out
      const age = t - HIT;
      if (t < HIT) p.polyline(path.slice(0, Math.max(2, Math.round(path.length * (t / HIT)))), C[4]);
      else if (age < 0.22 && !(age > 0.12 && Math.floor(age * 60) % 2)) {
        const hot = age < 0.07, core = hot ? WHITE : C[4], edge = hot ? C[4] : C[2];
        for (const dx of [-1, 1]) p.polyline(path.map(([x, y]) => [x + dx, y]), edge);
        p.polyline(path, core);
        if (age < 0.15) for (const f of fork) p.polyline(f, C[3]);
        p.glowLine(path[0][0], path[0][1], 0, 0, C[4], 0.5 * (1 - age / 0.22));
      }
      rings(p, true); ps.draw(p, "front"); lights.draw(p);
    },
  };
}
