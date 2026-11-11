// Beyond the Clockwork: 굉음, a charged shout let go as a straight pillar of sound, seen from above, facing right.
// A white flare at the mouth, a bright core line, rings of sound rolling down the pillar and swelling, rippling 1 px
// rims along both edges, dust shaken off, then it thins and fades from the mouth outward. Lines and light, no fills.
import { fit, hex, ease, clamp, cycle, WHITE } from "../../core/index.js";

export const meta = {
  name: "Roar pillar",
  desc: "A charged shout let go as a pillar of sound, seen from above, facing right: a white core line, swelling rings, rippling rims, dust shaken off, fading from the mouth out.",
  tags: ["sound", "beam", "shockwave", "top-down", "one-shot"],
  size: [176, 64],
  origin: [12, 32],
  duration: 0.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a2a1a", "#8a5a24", "#e0a03c", "#ffd257", "#fff4b7", "#ffffff"], length: 150, width: 13, seed: 2 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6).map(hex), L = o.length, W = o.width, D = meta.duration;
  if (t >= D) return;
  const reach = L * ease.outExpo(clamp(t / 0.12)), fade = clamp((t - 0.16) / (D - 0.16)), from = L * ease.inQuad(fade), k0 = 1 - fade;
  const half = W * (1 - 0.5 * fade), edge = (x, s) => s * (half * (0.5 + 0.5 * Math.min(1, x / 30)) + Math.sin(x * 0.32 - t * 55 + (s > 0 ? 1.7 : 0)) * 1.5);
  // the rims: rippling 1 px lines along both edges, a darker step outside
  for (let x = Math.ceil(from); x < reach; x++) for (const s of [-1, 1]) {
    const y = edge(x, s);
    p.dot(x, y, x % 7 < 4 ? C[4] : C[3], k0); p.dot(x, y + s, C[2], 0.7 * k0);
  }
  // the core line: white while hot, then gold
  for (let x = Math.ceil(from); x < reach; x++) { p.dot(x, 0, t < 0.16 ? WHITE : C[5], k0); if (t < 0.2) p.dot(x, -1, C[4], k0); }
  // rings rolling down the pillar: upright ellipses, swelling as they travel
  for (let i = 0; i < 6; i++) {
    const k = clamp((t - i * 0.045) / 0.42), x = 8 + k * (L - 8);
    if (k <= 0 || k >= 1 || x < from || x > reach + 2) continue;
    const ry = half + 2 + 6 * k, rx = 2.5 + 2 * k;
    for (let a = 0; a < 56; a++) { const g = (a / 56) * Math.PI * 2, front = Math.cos(g) > 0; p.dot(x + Math.cos(g) * rx, Math.sin(g) * ry, front ? C[5] : C[3], (1 - k) * (front ? 1 : 0.7)); }
  }
  p.glowLine(Math.max(from, 0), 0, reach, 0, C[4], 0.4 * k0);
  // the mouth: a burst flare for the first frames
  if (t < 0.12) { const f = 1 - t / 0.12; p.ellipse(4, 0, 3 + 3 * f, 4 + (W + 2) * f, C[5], 1); p.ellipse(4, 0, 2 + 2 * f, 2 + W * f, WHITE, 1); p.glow(4, 0, 22, C[5], 0.6 * f); }
  // dust shaken off the edges, drifting outward
  cycle(t, D, 22, o.seed, 0.35, (age, life, g) => {
    const k = age / life, x = 10 + g.next() * L * 0.9, s = g.next() < 0.5 ? -1 : 1, y = s * (half + 2 + k * 10);
    if (x > reach || x < from) return;
    p.dot(x + k * 6, y, k < 0.4 ? C[4] : C[2], 1 - k);
  });
}
