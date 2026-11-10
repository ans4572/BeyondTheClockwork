// Beyond the Clockwork: F2's wrench swing, seen from above. A crescent sweeps round the body (the origin) through
// `arc` degrees at `radius` px, facing right; the game turns it to the aim and mirrors it for the backswing. Teal like
// the old code-drawn arc, white on the leading edge, a glint and a flick of sparks at the head, then the trail cools
// to a dotted trace and is gone. `heavy` (the third blow) is thicker and throws gold sparks.
import { fit, clamp, ease, rand, WHITE, hex, mix } from "../../core/index.js";

export const meta = {
  name: "Wrench arc",
  desc: "A wrench swing seen from above: a teal crescent sweeps round the body with a white leading edge, a glint and sparks at its head, then cools to a dotted trace.",
  tags: ["melee", "swing", "wrench", "top-down", "directional", "one-shot"],
  size: [144, 144],
  origin: [72, 72],
  duration: 0.32,
  loop: false,
  fps: 60,
  bg: "ground",
  options: {
    palette: ["#123a3a", "#1b6b66", "#2fb8a6", "#7fe3d2", "#e9fffb", "#ffffff"],
    sparks: ["#fff8cf", "#ffd257", "#ff9a3c"],
    radius: 44,
    arc: 115,
    sweep: 0.13,
    heavy: false,
    seed: 3,
  },
};

const TAIL = 1.6; // how far behind the head the bright crescent reaches, in radians

export function draw(p, t, o) {
  const C = fit(o.palette, 6).map(hex), S = fit(o.sparks, 3).map(hex), R = o.radius, span = (o.arc * Math.PI) / 360;
  const heavy = !!o.heavy, W = heavy ? 10 : 7, sweep = o.sweep;
  const k = clamp(t / sweep), head = -span + 2 * span * ease.outCubic(k);
  // after the sweep the tail closes on the head and everything fades
  const after = clamp((t - sweep) / (meta.duration - sweep)), fade = 1 - after;
  const tailLen = Math.min(head + span, TAIL * (1 - after * 0.85));
  // the dotted trace left over the whole swept arc, cooling out
  for (let a = -span; a <= head; a += 0.035) {
    const u = (head - a) / (2 * span), on = rand(Math.round(a * 200), 7) < 0.55 - after * 0.4;
    if (on) p.dot(Math.cos(a) * R, Math.sin(a) * R, C[2], (0.55 - u * 0.3) * fade);
  }
  // the crescent: thick near the head, thinning to the tail; inner edge dark teal, body teal, leading edge white
  for (let a = head - tailLen; a <= head; a += 0.012) {
    const u = (head - a) / Math.max(0.001, tailLen), w = W * Math.pow(1 - u, 0.7) * (0.45 + 0.55 * fade);
    if (w < 0.4) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let d = -w; d <= 0.6; d += 0.5) {
      const r = R + d, edge = d > -0.8, inner = d < -w + 1;
      const c = edge ? (u < 0.45 ? C[5] : C[4]) : inner ? C[1] : u < 0.25 ? C[3] : C[2];
      p.dot(ca * r, sa * r, c, (u < 0.6 ? 1 : 1.6 - u) * Math.min(1, fade * 1.6));
    }
    // a soft glow along the fresh part
    if (u < 0.3 && ((a * 100) | 0) % 6 === 0) p.glow(ca * (R - w / 2), sa * (R - w / 2), heavy ? 9 : 6, C[3], 0.22 * fade);
  }
  // the head: a glint while it moves and just after
  const hx = Math.cos(head) * R, hy = Math.sin(head) * R;
  if (t < sweep + 0.05) {
    const g = heavy ? 4 : 3;
    for (let d = -g; d <= g; d++) { p.px(hx + d, hy, d === 0 ? WHITE : C[4]); p.px(hx, hy + d, d === 0 ? WHITE : C[4]); }
    p.glow(hx, hy, heavy ? 14 : 10, C[4], 0.5);
  }
  // sparks flicked off the head, along the swing and outward, falling a little (seen from above: a short arc)
  const n = heavy ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const born = sweep * (0.35 + 0.65 * (i / n)), age = t - born, life = 0.12 + rand(i, 3) * 0.1;
    if (age < 0 || age > life) continue;
    const a0 = -span + 2 * span * ease.outCubic(clamp(born / sweep)), out = rand(i, 5) * 0.9 + 0.2;
    const vx = -Math.sin(a0) * 120 + Math.cos(a0) * 90 * out, vy = Math.cos(a0) * 120 + Math.sin(a0) * 90 * out;
    const x = Math.cos(a0) * R + vx * age, y = Math.sin(a0) * R + vy * age + 160 * age * age;
    const col = heavy ? S[i % 3] : i % 2 ? WHITE : C[4];
    p.px(x, y, col);
    if (age < life * 0.5) p.px(x - vx * 0.012, y - vy * 0.012, mix(col, C[2], 0.5));
  }
}
