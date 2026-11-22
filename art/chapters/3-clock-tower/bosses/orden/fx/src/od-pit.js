// Beyond the Clockwork: the last hour's falling floor, redrawn for the summit's marble (2026-11-21; replaces od-parts2's
// crack and hole, which showed the sky through the top of the tower). `part`:
//  0 crack — a piece of the pink marble floor about to fall: cracks running out from its middle with Orden's cyan light
//            leaking up through them, chips jumping, grit trickling. The game sets one over each piece.
//  1 pit   — where it has fallen: a broken marble rim, the inner wall of the hole on its far side, and below, the dark
//            inside of the tower: a great brass gear turning in shadow and the cyan light deep down.
// Loops of 0.8 s.
import { cycle, hex, TAU, WHITE } from "../../core/index.js";

const MARBLE = ["#5a4658", "#86707e", "#b49aa4", "#dcc4c4", "#f4e6de"].map(hex);
const DARK = ["#0e0a16", "#181222", "#241c30", "#30283e", "#40364e"].map(hex);
const BRASS = ["#3a2610", "#6a4818", "#a07028", "#d8a448"].map(hex);
const CYAN = ["#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff"].map(hex);

export const meta = {
  name: "Orden's falling floor",
  desc: "A marble floor piece cracking with cyan light under it, and the pit it leaves into the tower's dark clockwork.",
  tags: ["magic", "boss", "parts", "loop", "ground"],
  size: [64, 44],
  origin: [32, 22],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { part: 0, seed: 3 },
};

export function draw(p, t, o) {
  const u = t / meta.duration, ph = u * TAU, s = o.seed + o.part * 7;
  const W = 26, H = 15;
  if (o.part === 0) {
    // cracks from the middle out to the piece's edge, lit cyan from below and flickering
    const glow = 0.55 + 0.45 * Math.sin(ph * 2);
    for (const [a, l] of [[0.15, 24], [1.2, 15], [2.3, 22], [3.4, 20], [4.4, 14], [5.4, 18]]) {
      for (let r = 2; r < l; r++) {
        const x = Math.round(Math.cos(a) * r + Math.sin(r * 1.4 + a) * 1.3), y = Math.round(Math.sin(a) * r * 0.58 + Math.cos(r * 1.1) * 0.6);
        p.px(x, y, MARBLE[0]);
        if (r < l * 0.7) p.px(x, y, glow > 0.6 && r % 3 === 0 ? CYAN[3] : CYAN[1]);
        p.px(x, y + 1, MARBLE[3]);
      }
    }
    p.glow(0, 0, 9, CYAN[2], 0.35 * glow);
    // chips jumping off the cracks, grit dropping in
    cycle(t, meta.duration, 5, s, 0.4, (age, life, g) => { const k = age / life, a = g.next() * TAU, d = 4 + g.next() * 16; p.px(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d * 0.58 - Math.sin(k * Math.PI) * 5), k < 0.5 ? MARBLE[4] : MARBLE[2]); });
    return;
  }
  // the pit: everything inside the jagged rim is the tower's dark inside
  const jag = (x, y) => 0.06 * Math.sin(x * 0.9 + y * 1.3) + 0.04 * Math.sin(x * 2.3 - y * 1.1);
  for (let y = -H; y <= H; y++) for (let x = -W; x <= W; x++) {
    const e = (x / W) ** 2 + (y / H) ** 2 + jag(x, y);
    if (e > 1) continue;
    const depth = (y + H) / (2 * H);
    let c;
    if (e > 0.8) c = e > 0.93 ? (y < 0 ? MARBLE[2] : MARBLE[4]) : (y < 0 ? MARBLE[0] : MARBLE[3]);                       // the broken lip: shaded far side, lit near side
    else if (y < -H * 0.35 && e > 0.45) c = (x + y * 3) % 7 === 0 ? DARK[2] : DARK[3]; // the hole's far inner wall, masonry joints
    else c = DARK[Math.max(0, Math.min(4, Math.round(2.6 - depth * 2.4)))];
    p.px(x, y, c);
  }
  // a great brass gear turning below, half in shadow
  const gx = -4, gy = 4, R = 9, turn = ph * 0.5;
  for (let y = -R - 2; y <= R + 2; y++) for (let x = -R - 2; x <= R + 2; x++) {
    const px = gx + x, py = gy + Math.round(y * 0.6), d = Math.hypot(x, y), a = Math.atan2(y, x) - turn;
    if ((px / W) ** 2 + (py / H) ** 2 > 0.7) continue;
    const tooth = Math.cos(a * 10) > 0.35 ? 2 : 0;
    if (d > R + tooth || (d < R - 3 && d > 3.5 && Math.cos(a * 4) < 0.7)) continue;
    p.px(px, py, d < 3.5 ? BRASS[1] : x - y < -4 ? BRASS[3] : x - y < 4 ? BRASS[2] : BRASS[1]);
  }
  // Orden's light deep down, breathing
  const k = 0.5 + 0.5 * Math.sin(ph);
  p.glow(6, 6, 8, CYAN[1], 0.35 + 0.25 * k);
  p.px(6, 6, CYAN[2]); if (k > 0.5) p.px(7, 6, CYAN[3]);
  // grit still falling in from the rim
  cycle(t, meta.duration, 4, s, 0.5, (age, life, g) => { const k2 = age / life, x = Math.round((g.next() - 0.5) * W * 1.4); p.px(x, Math.round(-H * 0.7 + k2 * H * 1.2), k2 < 0.5 ? MARBLE[3] : MARBLE[1]); });
}
