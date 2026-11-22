// Beyond the Clockwork: the belfry bell's toll going out over the floor, seen from above (Belgard's rings, the last
// toll, a cage bell crashing down). A thick bronze sound ring racing out to the reach with a thinner one inside it,
// short dial ticks on the leading ring, dust lifted under it. One-shot; the game fits it to the band's outer edge.
// Bronze for the bell, cyan for Orden's needles (`palette`).
import { fit, hex, ease, band, cycle, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Toll ring",
  desc: "A bell's toll over the floor, seen from above: a thick bronze ring racing out with a thinner one inside, dial ticks on the leading ring, dust lifted under it.",
  tags: ["ring", "bell", "sound", "floor", "top-down", "one-shot"],
  size: [136, 88],
  origin: [68, 44],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1806", "#7a4c18", "#c99a3a", "#f0cc6a", "#fff4c0"], dust: "#a8987e", reach: 60, seed: 2 },
};

const FLAT = 0.55;

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), RAD = o.reach, D = hex(o.dust);
  for (const [delay, span, th, frac, hot] of [[0, 0.42, 6, 1, true], [0.07, 0.42, 3, 0.8, false]]) {
    const k = (t - delay) / span;
    if (k < 0 || k >= 1) continue;
    const r = 3 + RAD * frac * ease.outCubic(k);
    band(p, 0, 0, r, FLAT, Math.max(1, th * (1 - k * 0.7)), 1.25 - k, [C[1], C[2], C[3], C[4]], () => true, hot);
    if (hot && k < 0.85) for (let i = 0; i < 24; i++) {
      const g = (i / 24) * TAU, cx = Math.cos(g), cy = Math.sin(g) * FLAT, long = i % 6 === 0;
      p.line(cx * (r - 2), cy * (r - 2), cx * (r + (long ? 3 : 2)), cy * (r + (long ? 3 : 2)), long ? C[4] : C[3], 1 - k);
    }
  }
  // dust lifted where the ring passes
  cycle(t, meta.duration, 14, o.seed, 0.3, (age, life, g) => {
    const k = age / life, a = g.next() * TAU, r = RAD * clamp(ease.outCubic(t / 0.42)) * (0.7 + g.next() * 0.3);
    p.disc(Math.cos(a) * r, Math.sin(a) * r * FLAT - k * 5, 1.5 + k * 2.5, D, 0.35 * (1 - k) * clamp((1 - t / meta.duration) * 3));
  });
  if (t < 0.1) { p.ellipse(0, 0, 7, 7 * FLAT, WHITE, 1 - t * 10); p.glow(0, 0, 16, C[3], 0.6 * (1 - t * 10)); }
}
