// Beyond the Clockwork: 도전 스패너, F2's charged spanner spinning through the air, seen from above, flying right.
// A steel open-end spanner turning fast, outlined in electric gold, small arcs snapping off its ends, a gold blur
// trailing its spin and sparks streaming behind. A loop, played while it flies.
import { fit, hex, cycle, rng, bolt, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Spanner spin (charged)",
  desc: "A charged steel spanner spinning through the air seen from above, flying right: gold electric rim, arcs snapping off its ends, a spin blur and sparks streaming behind.",
  tags: ["lightning", "projectile", "wrench", "spin", "top-down", "loop"],
  size: [100, 60],
  origin: [62, 30],
  duration: 0.5,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { steel: ["#2a2c38", "#4f5566", "#8a93a6", "#c6ccd8", "#eef1f6"], volt: ["#8a5a10", "#e0a03c", "#ffd257", "#fff2a8", "#ffffff"], turns: 2, seed: 9 },
};

// the spanner in its own frame: u along the shaft (head at +u), v across. Open jaw on the head, a ring at the tail.
const inside = (u, v) => {
  if (u >= -10 && u <= 8 && Math.abs(v) <= 1.7) return true;
  const hu = u - 11, h = hu * hu + v * v;
  if (h <= 30 && !(hu > -0.5 && Math.abs(v) < 2.3)) return true;
  const tu = u + 11, r = tu * tu + v * v;
  return r <= 13 && r > 2.5;
};

export function draw(p, t, o) {
  const S = fit(o.steel, 5).map(hex), V = fit(o.volt, 5).map(hex), D = meta.duration, a = (t / D) * TAU * o.turns;
  const ca = Math.cos(a), sa = Math.sin(a), at = (x, y) => inside(x * ca + y * sa, -x * sa + y * ca);
  // the spin blur: a faint gold disc the ends sweep, brighter on the leading side
  for (let k = 1; k <= 3; k++) {
    const b = a - k * 0.35, cb = Math.cos(b), sb = Math.sin(b);
    for (let d = 8; d <= 16; d += 1) for (const s of [1, -1]) p.dot(cb * d * s, sb * d * s, k === 1 ? V[3] : V[2], 0.5 - k * 0.13);
  }
  p.glow(0, 0, 18, V[2], 0.16);
  // the spanner: steel lit from the top left, a gold rim where the charge clings to it
  for (let y = -17; y <= 17; y++) for (let x = -17; x <= 17; x++) {
    if (!at(x + 0.5, y + 0.5)) {
      if (at(x + 1.5, y + 0.5) || at(x - 0.5, y + 0.5) || at(x + 0.5, y + 1.5) || at(x + 0.5, y - 0.5)) p.px(x, y, V[2]);
      continue;
    }
    const edge = !at(x + 1.5, y + 0.5) || !at(x + 0.5, y + 1.5), lit = !at(x - 0.5, y + 0.5) || !at(x + 0.5, y - 0.5);
    p.px(x, y, lit ? S[4] : edge ? S[1] : (x + y) < 0 ? S[3] : S[2]);
  }
  // arcs snapping off the head and the tail, a new pair every other frame
  const f = Math.floor((t / D) * 12) % 12, g = rng(o.seed, f);
  for (const end of [12, -12]) {
    if (g.next() < 0.25) continue;
    const x0 = ca * end, y0 = sa * end, ang = a + (end > 0 ? 0 : Math.PI) + (g.next() - 0.5) * 1.6, L = 6 + g.next() * 7;
    const path = bolt(g, x0, y0, x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L, { jag: 0.4, depth: 3 });
    p.polyline(path, V[3]);
    p.dot(path[path.length - 1][0], path[path.length - 1][1], WHITE);
    p.glowLine(x0, y0, path[path.length - 1][0], path[path.length - 1][1], V[2], 0.35);
  }
  // sparks streaming behind
  cycle(t, D, 12, o.seed + 3, 0.3, (age, life, gg) => {
    const k = age / life, y = (gg.next() - 0.5) * 18, x = -6 - k * 50 - gg.next() * 6;
    p.dot(x, y + Math.sin(k * 9 + y) * 2, k < 0.3 ? WHITE : k < 0.6 ? V[3] : V[1], clamp(1.1 - k));
  });
}
