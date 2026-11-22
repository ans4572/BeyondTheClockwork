// Beyond the Clockwork: the bell turret's small bell in flight (chapter 3). A brass hand bell with a crown loop and a
// dark clapper, rocking back and forth as it flies so it rings, a glint sliding over it and two thin sound arcs
// leaving it at each end of the swing. A loop, played while it arcs over; the game moves it along the arc.
import { fit, hex, ease, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Bell shot",
  desc: "A small brass hand bell in flight, rocking as it rings: a crown loop, a dark clapper, a glint sliding over it and thin sound arcs off each end of the swing.",
  tags: ["projectile", "bell", "brass", "clock", "loop"],
  size: [40, 36],
  origin: [20, 20],
  duration: 0.5,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { palette: ["#1e1006", "#5a3410", "#9a6420", "#d09a3c", "#f0cc6a", "#fff4c0"], swing: 0.3 },
};

export const INK = hex("#140c08");
const MID = 6;   // the bell turns round its middle, MID above the lip

/** Half the bell's width at height v (v < 0 up from the lip, which is at v = 0). */
function half(v) {
  if (v > 0.5 || v < -12.5) return -1;
  if (v < -9) { const k = (v + 9) / 3.5; return 4.2 * Math.sqrt(Math.max(0, 1 - k * k)); }
  const u = (v + 9) / 9;
  return 4.2 + 2.6 * u * u * u + (v > -1.5 ? 0.8 : 0);
}
const inBell = (u, v) => { const w = half(v); return w >= 0 && Math.abs(u) <= w; };

/**
 * The bell itself, turned by angle a round its middle at (cx, cy): body lit from the upper left, the dark mouth, the
 * crown loop and the clapper (lagging by `lag`, -1..1). Shared with bell-toll.js. Returns the screen point helper.
 */
export function bellBody(p, C, a, cx, cy, lag = 0, alpha = 1) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const rot = (u, v) => [cx + u * ca - (v + MID) * sa, cy + u * sa + (v + MID) * ca];
  const back = (x, y) => { const dx = x - cx, dy = y - cy; return [dx * ca + dy * sa, -dx * sa + dy * ca - MID]; };
  const at = (x, y) => inBell(...back(x, y));
  const put = (x, y, c) => (alpha >= 1 ? p.px(x, y, c) : p.dot(x, y, c, alpha));
  for (let y = Math.floor(cy) - 16; y <= cy + 12; y++) for (let x = Math.floor(cx) - 12; x <= cx + 12; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (!at(px, py)) {
      if (at(px + 1, py) || at(px - 1, py) || at(px, py + 1) || at(px, py - 1)) put(x, y, INK);
      continue;
    }
    const [u, v] = back(px, py), w = Math.max(1, half(v)), k = (u + w) / (2 * w);
    let s = k < 0.22 ? 4 : k < 0.45 ? 3 : k < 0.8 ? 2 : 1;
    if (v > -2.6 && v < -1.2) s = clamp(s + (k < 0.5 ? 1 : -1), 0, 5);
    if (v > -0.8) s = Math.min(s, 2);
    put(x, y, C[s]);
  }
  for (let i = -4; i <= 4; i++) { const [mx, my] = rot(i, 0.6); put(Math.round(mx - 0.5), Math.round(my - 0.5), INK); }
  const [lx, ly] = rot(0, -14);
  p.ring(lx, ly, 2, 1, C[3], alpha); put(Math.round(lx - 1), Math.round(ly - 2), C[5]);
  const [kx, ky] = rot(-lag * 1.6, 1.6);
  p.circle(kx, ky, 1.4, INK, alpha); put(Math.round(kx - 0.5), Math.round(ky - 0.5), C[2]);
  return rot;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6).map(hex), ph = t / meta.duration, sw = Math.sin(ph * TAU), a = o.swing * sw, PY = -2;
  p.glow(0, PY, 11, C[4], 0.12);
  const rot = bellBody(p, C, a, 0, PY, sw);
  // a glint sliding over the shoulder
  const g = (ph * 2) % 1, [gx, gy] = rot(-3 + 5 * ease.inOutSine(g), -7);
  p.dot(gx, gy, WHITE, Math.sin(g * Math.PI)); p.light(gx, gy, C[5], 0.35 * Math.sin(g * Math.PI));
  // thin sound arcs off the side the bell has just swung to
  const ring = Math.abs(sw);
  if (ring > 0.6) {
    const k = (ring - 0.6) / 0.4, mid = sw > 0 ? 0 : Math.PI;
    // solid arcs that shorten as they fade (dithered ones read as dots at this size)
    for (const [r, span] of [[10, 0.6], [13, 0.45]]) p.arc(0, PY, r + k * 2, 1, mid - span * k, mid + span * k, r === 10 ? C[5] : C[4]);
  }
}
