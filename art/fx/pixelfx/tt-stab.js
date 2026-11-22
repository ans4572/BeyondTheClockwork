// Beyond the Clockwork: Tick's (and Tock's) thrust, seen from above, pointing right. A white-hot line shoots out to the
// reach in a blink inside a red glow, a four-point star bursts at its tip with a ring of sparks, the line thins and
// leaves a fading afterimage. One-shot; the game turns it to the thrust and fits it to the reach. Red or blue (`palette`).
import { fit, hex, ease, clamp, cycle, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Twin's thrust",
  desc: "A thrust seen from above: a white-hot line shoots out in a blink inside a red glow, a four-point star bursts at its tip with sparks, then it thins to an afterimage.",
  tags: ["melee", "thrust", "stab", "top-down", "one-shot"],
  size: [124, 48],
  origin: [12, 24],
  duration: 0.34,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a0c12", "#a82028", "#e0564c", "#ffb0a0", "#ffffff"], reach: 92, seed: 4 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), L = o.reach, out = ease.outExpo(clamp(t / 0.06, 0, 1)), fade = clamp(1 - (t - 0.08) / 0.24, 0, 1);
  if (fade <= 0) return;
  const tip = L * out;
  // the glow round the line, then the line itself: three pixels while hot, one as it cools
  p.glowLine(0, 0, tip, 0, C[2], 0.7 * fade);
  const w = fade > 0.6 ? 1 : 0;
  for (let y = -w - 1; y <= w + 1; y++) p.line(0, y, tip, y, Math.abs(y) > w ? C[1] : y === 0 ? WHITE : C[3], Math.abs(y) > w ? 0.8 * fade : 1);
  // the point: a short spear-head of light
  p.tri(tip, -3, tip, 3, tip + 8, 0, C[3]); p.line(tip, 0, tip + 7, 0, WHITE);
  // the star at the tip: four long points, two short, spinning a little as it fades
  const s = (t < 0.06 ? t / 0.06 : 1) * (0.5 + 0.5 * fade), a0 = t * 4;
  for (let i = 0; i < 4; i++) {
    const a = a0 + (i * TAU) / 4, len = (i % 2 ? 9 : 14) * s;
    p.line(tip, 0, tip + Math.cos(a) * len, Math.sin(a) * len, i % 2 ? C[3] : WHITE);
  }
  p.glow(tip, 0, 14, C[3], 0.8 * fade);
  if (t < 0.1) p.circle(tip, 0, 3 + t * 40, WHITE, 1 - t * 10);
  // sparks thrown off the tip
  cycle(t, meta.duration, 10, o.seed, 0.22, (age, life, g) => {
    const k = age / life, a = (g.next() - 0.5) * 2.4, d = 4 + k * (14 + g.next() * 18);
    p.dot(tip + Math.cos(a) * d, Math.sin(a) * d, k < 0.4 ? WHITE : C[3], clamp(1 - k) * fade);
  });
}
