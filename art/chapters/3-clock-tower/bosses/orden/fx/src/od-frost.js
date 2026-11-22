// Beyond the Clockwork: what Orden's ice lane leaves on the floor (2026-11-20, the user's word: the flat blue discs
// looked wrong). A patch of frozen floor: a thin ragged sheet of pale ice with frost ferns creeping over it, clusters of
// ice shards standing up out of it at different heights, glints running over the shards and cold mist drifting low.
// Laid many to a lane, so it has no hard edge. A 1 s loop. Origin = the middle of the patch on the floor.
import { cycle, fit, hex, Rng, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Frozen floor patch",
  desc: "Frozen floor: a ragged thin ice sheet with frost ferns, standing ice shards with running glints, low cold mist.",
  tags: ["ice", "ground", "status", "loop", "hazard"],
  size: [80, 72],
  origin: [40, 50],
  duration: 1,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { seed: 3 },
};

const ICE = ["#123a5a", "#2a6a9a", "#5aa8d8", "#9ad8f8", "#e0f6ff"];
const FLAT = 0.5;

export function draw(p, t, o) {
  const u = t / meta.duration, C = fit(ICE, 5).map(hex), g = new Rng(o.seed);
  // the sheet: ragged round edge, a dither of pale ice (not a solid disc), brighter towards the middle
  const lobes = Array.from({ length: 7 }, () => g.range(0.75, 1.1));
  for (let y = -14; y <= 14; y++) for (let x = -32; x <= 32; x++) {
    const a = Math.atan2(y / FLAT, x), r = Math.hypot(x, y / FLAT), k = (a / TAU + 1) * 7, edge = 26 * (lobes[Math.floor(k) % 7] * (1 - (k % 1)) + lobes[Math.ceil(k) % 7] * (k % 1));
    if (r > edge) continue;
    const v = r / edge;
    if (v > 0.85 && (x + y * 3) % 2) continue;
    p.px(x, y, v > 0.85 ? C[2] : v > 0.45 ? C[3] : ((x * 7 + y * 13) % 9 ? C[3] : C[4]));
  }
  // frost ferns: little branching lines creeping out from the middle
  for (let f = 0; f < 5; f++) {
    let x = g.range(-6, 6), y = g.range(-3, 3); const a = g.range(0, TAU);
    for (let s = 0; s < 14; s++) {
      x += Math.cos(a) * 1.4; y += Math.sin(a) * 1.4 * FLAT; p.px(Math.round(x), Math.round(y), C[4]);
      if (s % 3 === 1) { const b = a + (s % 2 ? 0.9 : -0.9); p.px(Math.round(x + Math.cos(b) * 2), Math.round(y + Math.sin(b) * 2 * FLAT), C[4]); }
    }
  }
  // standing shards in clusters: a dark edge, a lit face, a white tip
  const shards = [];
  for (let c = 0; c < 3; c++) { const cx = g.range(-16, 16), cy = g.range(-5, 5); for (let i = 0; i < g.int(1, 3); i++) shards.push([cx + g.range(-4, 4), cy + g.range(-2, 2), g.int(4, 10), g.range(-0.35, 0.35)]); }
  shards.sort((a, b) => a[1] - b[1]);
  for (const [sx, sy, h, lean] of shards) {
    for (let k = 0; k <= h; k++) {
      const w = Math.max(0, Math.round(2.4 * (1 - k / h))), x0 = Math.round(sx + lean * k), y = Math.round(sy) - k;
      for (let x = -w - 1; x <= w + 1; x++) p.px(x0 + x, y, Math.abs(x) > w ? C[0] : x < 0 ? C[4] : x === 0 ? C[3] : C[2]);
    }
    p.px(Math.round(sx + lean * h), Math.round(sy) - h, WHITE);
  }
  // a glint running up the shards in turn
  const s = shards[Math.floor(u * shards.length) % shards.length], k = (u * shards.length) % 1;
  if (s) { const y = Math.round(s[1] - k * s[2]); p.px(Math.round(s[0] + s[3] * k * s[2]), y, WHITE); p.light(Math.round(s[0]), y, C[4], 0.6); }
  // cold mist drifting low over it
  cycle(t, meta.duration, 8, o.seed + 2, 1, (age, life, gg) => {
    const kk = age / life, x = Math.round(gg.range(-24, 24) + kk * 6), y = Math.round(gg.range(-8, 6) - kk * 3);
    p.px(x, y, C[4]); if (kk < 0.5) p.px(x + 1, y, C[4]);
  });
}
