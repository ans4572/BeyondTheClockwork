// Beyond the Clockwork: Belgard's greatsword cut, seen from above and drawn flat (the game lays it on the floor). The
// blade sweeps the arc in a blink, leaving a crescent brightest where it has just passed, a white edge along the tip's
// path, steel and cream inside, sparks flung off the far end; then the crescent thins and goes. `degrees` is the arc
// (360 = his spin). Facing right; `palette` cream for his own cuts, cyan for Orden's puppet.
import { fit, hex, ease, clamp, cycle, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Greatsword cut",
  desc: "A greatsword cut seen from above: the blade sweeps the arc in a blink, a crescent brightest where it just passed, a white edge, sparks off the far end, then it thins and goes.",
  tags: ["melee", "slash", "sword", "arc", "top-down", "one-shot"],
  size: [148, 148],
  origin: [74, 74],
  duration: 0.36,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a2c22", "#8a7a62", "#d8c8a4", "#f3e6c4", "#ffffff"], degrees: 120, radius: 60, seed: 3 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), R = o.radius, half = (o.degrees * Math.PI) / 360, full = o.degrees >= 359;
  const sweep = clamp(t / 0.1, 0, 1), head = -half + 2 * half * ease.outCubic(sweep);
  const fade = t < 0.12 ? 1 : clamp(1 - (t - 0.12) / 0.24, 0, 1);
  if (fade <= 0) return;
  // the crescent: thick right behind the blade, tapering to nothing at its tail; the tail draws in toward the blade as
  // it fades, and the inner edge pulls out to the tip
  const L = 0.15 + 0.85 * fade, W = R * (0.18 + 0.3 * fade);
  p.shade(-R - 2, -R - 2, R + 2, R + 2, (x, y) => {
    const r = Math.hypot(x, y);
    if (r > R || r < R - W - 1) return;
    let a = Math.atan2(y, x);
    if (full) a = ((a + half) % TAU + TAU) % TAU - half;
    if (a < -half || a > head) return;
    const since = (head - a) / (2 * half);
    if (since > L) return;
    const thick = W * Math.pow(1 - since / L, 0.6);
    if (r < R - thick) return;
    const u = (r - (R - thick)) / Math.max(1, thick);
    if (u > 0.82) return since < 0.35 ? C[4] : C[3];
    if (u > 0.4) return since < 0.6 ? C[3] : C[2];
    return since < 0.3 ? C[2] : C[1];
  });
  // the white edge along the tip's path, and the blade's leading line
  for (let a = -half; a <= head; a += 0.02) if ((head - a) / (2 * half) < L * 0.6) p.px(Math.round(Math.cos(a) * (R - 0.5)), Math.round(Math.sin(a) * (R - 0.5)), WHITE);
  if (sweep < 1) p.line(Math.cos(head) * (R - W), Math.sin(head) * (R - W), Math.cos(head) * R, Math.sin(head) * R, WHITE);
  p.glowLine(Math.cos(head) * R * 0.7, Math.sin(head) * R * 0.7, Math.cos(head) * R, Math.sin(head) * R, C[3], 0.5 * fade);
  // sparks flung off the far end once the blade arrives
  if (t > 0.08) cycle(t - 0.08, 0.28, 8, o.seed, 0.22, (age, life, g) => {
    const k = age / life, a = head + (g.next() - 0.3) * 0.5, d = R + k * (10 + g.next() * 14);
    p.dot(Math.cos(a) * d, Math.sin(a) * d, k < 0.4 ? WHITE : C[3], clamp(1 - k));
  });
}
