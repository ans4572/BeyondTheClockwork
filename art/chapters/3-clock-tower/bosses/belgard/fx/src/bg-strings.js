// Beyond the Clockwork: Orden's puppet strings on Belgard (2026-11-20, the user's word: in phase 2 nothing showed that
// Orden works him). Four threads of cyan light come down from a small brass control bar high above him to his head, his
// shoulders and his two hands, bowing and swaying a little; beads of light run down them. `mode` 0 slack (swaying, dim),
// 1 taut (pulled straight, bright, sparks at the hands: while he strikes). Loop of 1.2 s. Origin = his feet; his body is
// about 40 px wide and 84 tall at this size (the game scales the sheet to his clip).
import { cycle, hex, TAU, WHITE } from "../../core/index.js";

const CYAN = ["#07232c", "#0d4e60", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"].map(hex);
const BRASS = ["#3a2408", "#7a5418", "#c99a3a", "#ffe39a"].map(hex);

export const meta = {
  name: "Puppet strings",
  desc: "Threads of cyan light from a brass control bar high above down to a body's head, shoulders and hands, swaying slack or pulled taut and bright.",
  tags: ["magic", "status", "loop", "boss", "control"],
  size: [96, 220],
  origin: [48, 210],
  duration: 1.2,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { mode: 0, seed: 4 },
};

// Where the threads end on the body (from the feet), and where they start on the bar.
const ENDS = [[0, -80], [-14, -62], [14, -62], [-20, -40], [21, -42]];
const BAR = -196;

export function draw(p, t, o) {
  const u = t / meta.duration, ph = u * TAU, taut = o.mode === 1;
  // The control bar: a short brass cross, rocking with the threads.
  const rock = taut ? 0 : Math.sin(ph) * 3;
  for (let x = -18; x <= 18; x++) { const y = BAR + Math.round(rock * x / 18); p.px(x, y, BRASS[2]); p.px(x, y + 1, BRASS[1]); }
  for (let y = -6; y <= 6; y++) p.px(0, BAR + y, y < 0 ? BRASS[3] : BRASS[2]);
  p.px(0, BAR, BRASS[3]);
  p.glow(0, BAR, 10, CYAN[3], taut ? 0.5 : 0.3);
  ENDS.forEach(([ex, ey], i) => {
    const sx = Math.round(ex * 0.8), sy = BAR + Math.round(rock * sx / 18) + 1;
    // slack: a bow that sways; taut: straight
    const bow = taut ? 0 : 6 * Math.sin(ph + i * 1.3);
    const n = ey - sy;
    for (let k = 0; k <= n; k++) {
      const v = k / n, x = Math.round(sx + (ex - sx) * v + Math.sin(v * Math.PI) * bow), y = sy + k;
      // solid thread with a brighter core every other pixel; dimmer slack
      p.px(x, y, taut ? (k % 2 ? CYAN[4] : WHITE) : (k % 3 ? CYAN[3] : CYAN[4]));
    }
    // beads of light running down
    cycle(t, meta.duration, taut ? 3 : 2, o.seed + i * 5, taut ? 0.4 : 0.9, (age, life) => {
      const v = age / life, x = Math.round(sx + (ex - sx) * v + Math.sin(v * Math.PI) * bow), y = Math.round(sy + n * v);
      p.px(x, y, WHITE); p.px(x, y - 1, CYAN[4]); p.light(x, y, CYAN[4], 0.5);
    });
    // where it holds him: a small knot of light, sparking when pulled
    p.px(ex, ey, WHITE); p.px(ex - 1, ey, CYAN[4]); p.px(ex + 1, ey, CYAN[4]); p.px(ex, ey - 1, CYAN[4]);
    p.light(ex, ey, CYAN[3], taut ? 0.8 : 0.4);
    if (taut) cycle(t, meta.duration, 3, o.seed + i * 11, 0.25, (age, life, g) => { const k = age / life, a = g.next() * TAU; p.px(Math.round(ex + Math.cos(a) * k * 7), Math.round(ey + Math.sin(a) * k * 5), k < 0.5 ? WHITE : CYAN[4]); });
  });
}
