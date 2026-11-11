// Beyond the Clockwork: the yellow portal marker, a place to walk to, seen from above. A gold ring lies flat on the
// floor and breathes in and out, a glint running round it and a fainter ring rippling out from its middle; gold motes
// rise off it, and a gold arrow bobs over it pointing down. A loop, played for as long as the goal is open.
import { fit, hex, cycle, mix, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Portal marker",
  desc: "A gold ring flat on the floor that breathes, a glint running round it and a ripple spreading from its middle, motes rising off it and a gold arrow bobbing over it, pointing down.",
  tags: ["ui", "marker", "portal", "goal", "waypoint", "top-down", "loop"],
  size: [56, 58],
  origin: [28, 46],
  duration: 1.6,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { arrow: "slim", gold: ["#5a3d10", "#9a6a1e", "#c79a3e", "#ffd257", "#ffe99a", "#fff8dc"], ink: "#33261c", seed: 4 },
};

const RX = 17, RY = 7, ARROW_Y = -26;
const apart = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);

// The arrow in its own frame, tip at v = 0, by style (2026-11-11: the first, a wide wedge on a stem, read too heavy):
// chevron: two thin open chevrons stacked, the lower one brighter; slim: a small narrow wedge, no stem; pin: a slim
// wedge on a one-pixel stem.
// 2026-11-11: slim was picked, then drawn a size up (8 px tall, was 6).
const ARROWS = {
  chevron: (u, v) => { for (const [tip, k] of [[0, 0], [-5, 1]]) { const d = tip - v - Math.abs(u); if (Math.abs(u) <= 5 && d >= 0 && d < 2) return k + 1; } return 0; },
  slim: (u, v) => (v <= 0 && v >= -8 && Math.abs(u) <= -v * 0.6 + 0.2 ? 1 : 0),
  pin: (u, v) => (v <= 0 && v >= -5 && Math.abs(u) <= -v * 0.75 + 0.2 ? 1 : v < -5 && v >= -10 && Math.abs(u) <= 0.5 ? 1 : 0),
};

export function draw(p, t, o) {
  const G = fit(o.gold, 6).map(hex), ink = hex(o.ink), T = meta.duration, ph = (t / T) * TAU, beat = Math.sin(ph);
  // the ring breathes by whole pixels so it never smears
  const rx = RX + Math.round(beat * 1.5), ry = RY + Math.round(beat * 0.6), glint = ph * 1.5 - Math.PI / 2;
  // a ripple: a thin pale ring spreading from the middle to the ring and fading, twice a loop
  // (see-through pixels: dithered it broke into speckle, and baked light greys a bright floor)
  for (const k0 of [0, 0.5]) {
    const k = ((t / T) + k0) % 1, r = 2 + (rx - 3) * k, a = 0.55 * Math.sin(Math.PI * k);
    const seen = new Set();
    for (let j = 0, n = Math.max(12, Math.round(r * 8)); j < n; j++) {
      const g = (j / n) * TAU, x = Math.round(Math.cos(g) * r), y = Math.round(Math.sin(g) * r * (ry / rx));
      if (seen.has(x + "," + y)) continue; seen.add(x + "," + y);
      p.blend(x, y, G[5], a);
    }
  }
  // (2026-11-11, to sit with the maps' brass trims and dark outlines: a dark outline all round, a warm lit floor inside,
  // and twelve dial ticks like a clock face, the ring itself still the yellow one.)
  // a warm, see-through pool of light on the floor inside the ring
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = (x / (rx - 1)) ** 2 + (y / (ry - 0.5)) ** 2;
    if (d < 1) p.blend(x, y, G[4], 0.1 + 0.12 * (1 - d) + 0.04 * beat);
  }
  // the ring's own pixels, once each
  const pts = new Map();
  for (let j = 0, n = 200; j < n; j++) {
    const g = (j / n) * TAU, x = Math.round(Math.cos(g) * rx), y = Math.round(Math.sin(g) * ry);
    if (!pts.has(x + "," + y)) pts.set(x + "," + y, { x, y, g });
  }
  const isRing = (x, y) => pts.has(x + "," + y) || (Math.sin(Math.atan2(y - 1, x)) > -0.15 && pts.has(x + "," + (y - 1)));
  // the outline: every pixel touching the ring (near side two pixels deep) that is not ring itself
  for (const { x, y, g } of pts.values()) {
    const thick = Math.sin(g) > -0.15 ? 2 : 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, thick]]) if (!isRing(x + dx, y + dy)) p.px(x + dx, y + dy, ink);
  }
  for (const { x, y, g } of pts.values()) {
    const near = Math.sin(g) > -0.15, hot = apart(g, glint) < 0.28, warm = apart(g, glint) < 0.6;
    if (near) {
      p.px(x, y, hot ? WHITE : warm ? G[5] : Math.cos(g) < -0.3 ? G[4] : G[3]);
      p.px(x, y + 1, hot ? G[4] : G[2]);
    } else p.px(x, y, hot ? G[5] : warm ? G[4] : G[3]);
  }
  // twelve dial ticks just inside the ring, the four quarters longer
  for (let i = 0; i < 12; i++) {
    const g = (i / 12) * TAU, long = i % 3 === 0;
    for (let r = long ? 2 : 2, end = long ? 4 : 3; r < end; r++) {
      const x = Math.round(Math.cos(g) * (rx - r * 1.6)), y = Math.round(Math.sin(g) * (ry - r * 0.7));
      if (!isRing(x, y)) p.px(x, y, long ? G[3] : G[2]);
    }
  }
  // gold motes rising off the ring
  cycle(t, T, 9, o.seed, 0.9, (age, life, g) => {
    const k = age / life, a = g.next() * TAU, x = Math.cos(a) * rx * 0.92, y = Math.sin(a) * ry * 0.92 - k * 16;
    p.dot(Math.round(x), Math.round(y), k < 0.25 ? WHITE : k < 0.6 ? G[4] : G[3], 1 - k);
  });
  // the arrow, bobbing by whole pixels: navy outline, gold lit from the top left
  const ay = ARROW_Y + Math.round(beat * 3), shape = ARROWS[o.arrow] || ARROWS.chevron, at = (u, v) => shape(u + 0.5, v + 0.5);
  for (let v = -13; v <= 2; v++) for (let u = -8; u <= 8; u++) {
    const k = at(u, v);
    if (!k) { if (at(u + 1, v) || at(u - 1, v) || at(u, v + 1) || at(u, v - 1)) p.px(u, ay + v, ink); continue; }
    const lit = !at(u - 1, v) || !at(u, v - 1);
    p.px(u, ay + v, k === 2 ? (lit ? G[3] : G[2]) : lit ? G[5] : u < 0 ? G[4] : G[3]);
  }

}
