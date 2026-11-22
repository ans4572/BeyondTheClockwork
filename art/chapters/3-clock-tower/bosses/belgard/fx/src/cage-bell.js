import { fit, hex, ease, clamp, TAU, WHITE, Rng } from "../../core/index.js";
import { blobShadow, glint } from "../pickups/_lib.js";

export const meta = {
  name: "Cage bell",
  desc: "A great bronze bell on the floor with moulded bands and a crown loop; a glint runs across it. cracks (0 to 3) splits it, light leaking at the last stage.",
  tags: ["belfry", "prop", "bell", "trap", "loop"],
  size: [80, 72],
  origin: [40, 64],
  duration: 1.2,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { palette: ["#1e1006", "#4a2a0e", "#7a4c18", "#b07c2c", "#e0b052", "#fff0b0"], seed: 7, cracks: 0 },
};

const INK = hex("#140c08"), LEAK = ["#ff9a3c", "#ffd257", "#fff4d6"].map(hex);

/** Half the bell's width at height y (y < 0 up from the lip): a flared lip, a waist, a round crown. */
function half(y) {
  if (y > 0 || y < -50) return -1;
  if (y < -38) { const k = (y + 38) / 12; return 21 * Math.sqrt(Math.max(0, 1 - k * k)); }
  const u = (y + 38) / 38;
  return 21 + 10 * u * u * u + (y > -4 ? (4 + y) * 0.5 : 0);
}

/** The cracks: jagged lines from the lip upward, one more per stage, the same on every frame. */
function cracksFor(seed, n) {
  const R = new Rng(seed), out = [];
  for (let i = 0; i < 3; i++) {
    let x = R.range(-22, 22), y = 0;
    const pts = [[x, y]], up = R.range(22, 38);
    while (y > -up) { y -= R.range(3, 6); x += R.range(-3, 3); pts.push([x, y]); }
    out.push(pts);
  }
  return out.slice(0, n);
}

export function drawBack(p) { blobShadow(p, 0, 34, 1); }

export function draw(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration, n = clamp(Math.round(o.cracks || 0), 0, 3);
  // the body, column by column: highlight on the left third, a band of reflected light near the right edge
  p.shade(-36, -52, 36, 1, (x, y) => {
    const w = half(Math.floor(y));
    if (w < 0 || Math.abs(x) > w + 0.5) return;
    if (Math.abs(x) > w - 0.5 || y > -0.5 || (y < -49 && Math.abs(x) < 6)) return INK;
    const u = (x + w) / (2 * w);
    const band = (y > -7 && y < -3) || (y > -35 && y < -31);
    const base = u < 0.14 ? 4 : u < 0.3 ? 3 : u < 0.72 ? 2 : u < 0.86 ? 1 : 2;
    return C[clamp(base + (band ? (u < 0.5 ? 1 : -1) : 0), 0, 5)];
  });
  // the bands' lit edges and the lip
  for (const y of [-7, -35]) { const w = half(y); p.line(-w + 2, y, w - 2, y, C[5], (u) => (u < 0.4 ? 1 : 0.4)); }
  p.line(-half(-1) + 1, -1, half(-1) - 1, -1, C[1]);
  // the crown loop
  p.rect(-6, -49, 12, 4, C[2]); p.line(-6, -49, 5, -49, C[4]); p.line(-7, -49, -7, -46, INK); p.line(6, -49, 6, -46, INK);
  p.ring(0, -52, 4, 2, C[3]); p.arc(0, -52, 4, 1, Math.PI, TAU, C[5]);
  // a glint runs across the waist
  const g = (ph - 0.1) / 0.45;
  if (g > 0 && g < 1) { const x = -18 + 30 * ease.inOutSine(g); glint(p, x, -20 - x * 0.1, 3 * Math.sin(g * Math.PI), WHITE, 0.4); }
  // cracks: a dark seam with a lit lower edge; at the last stage light leaks out of them
  for (const pts of cracksFor(o.seed, n)) {
    p.polyline(pts, INK);
    p.polyline(pts.map(([x, y]) => [x + 1, y]), C[4], 0.6);
    if (n === 3) {
      const k = 0.6 + 0.4 * Math.sin(ph * TAU * 2);
      p.polyline(pts.slice(0, -1), LEAK[1], k);
      for (const [x, y] of pts) p.light(x, y, LEAK[0], 0.35 * k);
    }
  }
}
