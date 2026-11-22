// Beyond the Clockwork: the plate of Orden's golden press (2026-11-21, the user's word: the factory's steel plate tinted
// gold looked out of place on the summit's marble). A heavy square slab of gold with a clock dial engraved on its face,
// rivets at its corners and its front edge showing its thickness; a cyan line of Orden's power breathing round the dial.
// Seen from the game's high camera. Origin = the middle of its underside, where it lands. Loop of 0.8 s.
import { hex, TAU, WHITE } from "../../core/index.js";

const GOLD = ["#4a2c0c", "#7a4e16", "#b07a26", "#dcaa44", "#f6d886", "#fff4cc"].map(hex);
const CYAN = ["#1a8aa0", "#3fd0e8", "#9ff4ff"].map(hex);

export const meta = {
  name: "Orden's press plate",
  desc: "A heavy gold slab with a clock dial engraved on it, rivets and a breathing cyan ring.",
  tags: ["magic", "boss", "parts", "loop"],
  size: [64, 56],
  origin: [32, 40],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { seed: 1 },
};

export function draw(p, t) {
  const ph = (t / meta.duration) * TAU, W = 28, D = 18, T = 7; // half width, top depth (floor-flat), thickness
  // the front face (thickness), darker, with a lit top edge
  for (let x = -W; x <= W; x++) for (let y = 0; y < T; y++) p.px(x, y - T + 1 + D / 2 - 6, y === 0 ? GOLD[3] : x % 9 === 0 ? GOLD[0] : GOLD[1]);
  // the top: a gold slab, lit from the top left, with a bevelled rim
  const top = -D / 2 - 6 - T + 1;
  for (let y = 0; y < D; y++) for (let x = -W; x <= W; x++) {
    const rim = y < 2 || y > D - 3 || Math.abs(x) > W - 3, shade = (x + y * 1.6) / (W + D);
    p.px(x, top + y, rim ? (y < 2 || x < 0 ? GOLD[4] : GOLD[2]) : shade < -0.3 ? GOLD[4] : shade < 0.4 ? GOLD[3] : GOLD[2]);
  }
  // the engraved dial: a ring and twelve ticks, pressed into the gold
  const cx = 0, cy = top + D / 2, R = 7.5;
  for (let a = 0; a < TAU; a += 0.05) { const x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * 0.62); p.px(x, y, GOLD[1]); p.px(x, y + 1, GOLD[4]); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; p.px(Math.round(cx + Math.cos(a) * (R - 2)), Math.round(cy + Math.sin(a) * (R - 2) * 0.62), GOLD[0]); }
  // the hands at twelve
  for (let y = 1; y < 5; y++) p.px(cx, cy - y, GOLD[0]);
  p.px(cx, cy, GOLD[0]); p.px(cx + 1, cy, GOLD[0]); p.px(cx + 2, cy, GOLD[0]);
  // rivets
  for (const [x, y] of [[-W + 4, top + 3], [W - 4, top + 3], [-W + 4, top + D - 4], [W - 4, top + D - 4]]) { p.px(x, y, GOLD[5]); p.px(x + 1, y + 1, GOLD[1]); }
  // Orden's power breathing round the dial
  const k = 0.5 + 0.5 * Math.sin(ph);
  for (let a = 0; a < TAU; a += 0.09) { const x = Math.round(cx + Math.cos(a + ph * 0.5) * (R + 2)), y = Math.round(cy + Math.sin(a + ph * 0.5) * (R + 2) * 0.62); if (Math.sin(a * 6 + ph * 2) > 0.2) p.px(x, y, k > 0.6 ? CYAN[2] : CYAN[1]); }
  p.glow(cx, cy, 10, CYAN[1], 0.18 + 0.15 * k);
  // a glint running along the top edge
  const gx = Math.round(-W + ((t / meta.duration) % 1) * W * 2); for (let d = -2; d <= 2; d++) p.px(gx + d, top, d === 0 ? WHITE : GOLD[5]);
}
