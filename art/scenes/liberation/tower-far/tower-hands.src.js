// Beyond the Clockwork: the clock tower's two hands for the liberation cutscene's last view (2026-11-20, the user's pick:
// the tower seen from the village, its stopped clock starting to go again). The painting's clock face is drawn without
// hands; these are turned over it. Two still frames: 0 the minute hand, 1 the hour hand, both pointing up, in dark
// iron with a brass edge and a brass pivot, an ink outline so they read on the cream face. Origin = the pivot.
import { hex } from "../../core/index.js";

export const meta = {
  name: "Clock tower hands",
  desc: "A clock's two hands as still frames, pointing up from their pivot: a long minute hand and a short hour hand, iron with a brass edge.",
  tags: ["ui", "prop", "clock", "one-shot"],
  size: [24, 76],
  origin: [12, 62],
  duration: 2,
  loop: false,
  fps: 1,
  bg: "light",
  options: {},
};

const INK = hex("#120c14"), IRON = ["#1c1a2a", "#2e2b44", "#46425e"].map(hex), BRASS = ["#7a5418", "#c99a3a", "#ffd257", "#ffe9a8"].map(hex);

/** One hand: `len` up from the pivot, `tail` down, half-width `w` at its widest, a spear tip. */
function hand(p, len, tail, w) {
  const half = y => { // half-width at height y (y up from the pivot, negative is the tail)
    if (y < 0) return Math.max(1, Math.round(w * 0.7));
    const v = y / len;
    if (v > 0.82) return Math.max(0, Math.round(w * 1.4 * (1 - v) / 0.18)); // the spear tip
    if (v > 0.74) return Math.round(w * 1.4);
    return Math.max(1, Math.round(w * (1 - v * 0.45)));
  };
  // ink outline first, then the iron body lit from the left, a brass line down its middle
  for (let y = -tail; y <= len; y++) { const h = half(y); for (let x = -h - 1; x <= h + 1; x++) p.px(x, -y, INK); }
  p.px(0, -len - 1, INK); p.px(0, tail + 1, INK);
  for (let y = -tail; y <= len; y++) {
    const h = half(y);
    for (let x = -h; x <= h; x++) p.px(x, -y, x < 0 ? IRON[2] : x === 0 ? IRON[1] : IRON[0]);
    if (y > 2 && y < len * 0.74) p.px(0, -y, BRASS[1]);
    if (half(y) > 1 && y >= len * 0.74 && y <= len * 0.82) { p.px(-h, -y, BRASS[2]); p.px(h, -y, BRASS[0]); }
  }
  // the pivot: a brass boss
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = x * x + y * y; if (d <= 12) p.px(x, y, d > 7 ? INK : x + y < -1 ? BRASS[3] : x + y < 1 ? BRASS[2] : BRASS[1]); }
}

export function draw(p, t) {
  if (t < 1) hand(p, 56, 9, 2);
  else hand(p, 34, 7, 3);
}
