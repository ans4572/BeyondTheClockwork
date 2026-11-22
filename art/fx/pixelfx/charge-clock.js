// Beyond the Clockwork: 지연 방전, the charge left on an enemy (F2's conductive spanner with the delayed discharge
// upgrade). A small brass stopwatch hovering over the body: a cream dial with twelve ticks, a gold electric hand sweeping
// once round, the swept part filling with charge, sparks snapping off the rim more and more often, and in the last
// moment the watch shakes and its face goes white. Frames follow the countdown (the game picks the frame by how much
// of the delay has passed), so it is a one-shot that ends full, not empty.
import { fit, hex, rng, bolt, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Charge clock",
  desc: "A brass stopwatch over a charged body: a gold electric hand sweeps once round, the swept dial fills with charge, rim sparks quicken, and at the end it shakes and flares.",
  tags: ["lightning", "status", "clock", "timer", "one-shot"],
  size: [48, 50],
  origin: [24, 28],
  duration: 3,
  loop: false,
  fps: 10,
  bg: "ground",
  options: { brass: ["#2a1806", "#6a4214", "#b07c2c", "#e0b052", "#fff0b0"], volt: ["#8a5a10", "#e0a03c", "#ffd257", "#fff2a8"], face: ["#161c2e", "#26304c"], seed: 11 },
};

const INK = hex("#140c08");
const R = 10;  // the case's outer radius

export function draw(p, t, o) {
  const B = fit(o.brass, 5).map(hex), V = fit(o.volt, 4).map(hex), F = fit(o.face, 2).map(hex);
  const k = clamp(t / meta.duration, 0, 1), f = Math.round(t * meta.fps), g = rng(o.seed, f);
  const end = k > 0.85 ? (k - 0.85) / 0.15 : 0;
  const sx = end > 0 ? Math.round((g.next() - 0.5) * 2 * end) : 0, sy = end > 0 ? Math.round((g.next() - 0.5) * 2 * end) : 0;
  const hand = -Math.PI / 2 + TAU * k;
  p.glow(sx, sy, 14 + 6 * k, V[2], 0.12 + 0.3 * k + 0.4 * end);
  // the crown and its stem on top
  p.rect(sx - 2, sy - R - 4, 4, 3, B[2]); p.line(sx - 2, sy - R - 4, sx + 1, sy - R - 4, B[4]);
  p.ring(sx, sy - R - 5.5, 1.6, 1, B[3]);
  // case, face and the swept charge
  p.shade(sx - R - 1, sy - R - 1, sx + R + 1, sy + R + 1, (x, y) => {
    const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
    if (d > R + 0.5) return;
    if (d > R - 0.5) return INK;
    if (d > R - 2.3) { const lit = dx + dy < -2; return lit ? B[4] : dx + dy > 4 ? B[1] : B[2]; }
    if (d > R - 2.9) return B[0];
    // the swept part of the dial (clockwise from twelve) holds the charge
    let a = Math.atan2(dy, dx) - -Math.PI / 2; a = ((a % TAU) + TAU) % TAU;
    const swept = a <= TAU * k;
    if (end > 0.5) return d < 3 ? WHITE : V[3];
    if (swept) return d < 2.5 ? V[3] : (a + d * 0.3) % 1.2 < 0.25 ? V[3] : V[2];
    return dx + dy < 0 ? F[1] : F[0];
  });
  // twelve ticks: a dot each, the four quarters two pixels long (gold on the dark face, dark on the charge)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, c = Math.cos(a), s = Math.sin(a), x = Math.round(sx + c * (R - 4)), y = Math.round(sy + s * (R - 4));
    let rel = a + Math.PI / 2; rel = ((rel % TAU) + TAU) % TAU;
    const col = rel <= TAU * k && end < 0.5 ? B[1] : B[3];
    p.px(x, y, col);
    if (i % 3 === 0) p.px(Math.round(sx + c * (R - 5)), Math.round(sy + s * (R - 5)), col);
  }
  // the hand: a gold bolt from the hub to the rim, white at its tip
  const hx = sx + Math.cos(hand) * (R - 3.3), hy = sy + Math.sin(hand) * (R - 3.3);
  p.line(sx, sy, hx, hy, WHITE); p.px(Math.round(hx), Math.round(hy), WHITE); p.light(hx, hy, V[3], 0.6);
  p.circle(sx, sy, 1.2, B[3]); p.px(sx, sy, INK);
  // sparks snapping off the rim, quicker as the charge fills
  const n = Math.floor(k * 4 + (g.next() < k ? 1 : 0)) + (end > 0 ? 2 : 0);
  for (let i = 0; i < n; i++) {
    const a = g.next() * TAU, x0 = sx + Math.cos(a) * (R + 0.5), y0 = sy + Math.sin(a) * (R + 0.5), L = 3 + g.next() * (4 + 6 * k);
    const path = bolt(g, x0, y0, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L, { jag: 0.5, depth: 2 });
    p.polyline(path, i % 2 ? V[3] : V[2]);
    p.dot(path[path.length - 1][0], path[path.length - 1][1], WHITE);
  }
  if (end > 0) p.glowRing?.(sx, sy, R + 2 + end * 3, V[3], 0.5 * end);
}
