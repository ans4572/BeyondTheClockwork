// Beyond the Clockwork: the minute archer's arrow (chapter 3), flying right. The brass arrow the archer draws in its
// own clip, small and sharp: a gold spade tip like a clock hand's, a thin brass shaft, two brass vanes at the nock;
// behind it a short gold streak and a row of dial ticks left in the air, fading, as if it marked off the minutes.
// A loop, played while it flies; the game turns it to the shot's heading.
import { fit, hex, clamp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Minute arrow",
  desc: "A small brass arrow with a gold clock-hand spade tip and brass vanes, flying right, a short gold streak and a row of fading dial ticks left behind it.",
  tags: ["projectile", "arrow", "clock", "brass", "loop"],
  size: [56, 16],
  origin: [36, 8],
  duration: 0.3,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { brass: ["#3a2208", "#7a4c18", "#c08a34", "#f0c860", "#fff2b8"], seed: 5 },
};

const INK = hex("#1a1006");
const TICK = 4;   // dial ticks every 4 px along the trail

/** The arrow in its own frame: tip at x = 9, nock at x = -14; y across. 1 shaft, 2 tip, 3 vane; -1 outside. */
function part(x, y) {
  const ay = Math.abs(y);
  if (x >= 1 && x <= 9) { const w = x <= 3 ? (x - 1) * 1.1 : (9 - x) * 0.38; if (ay <= w + 0.3) return 2; }
  if (x >= -14 && x < 1 && ay <= 0.5) return 1;
  // vanes: two small brass fins swept back from the nock
  if (x >= -14 && x <= -10 && ay >= 1 && ay <= 1 + (-10 - x) * 0.5 && ay <= 2.5) return 3;
  return -1;
}

export function draw(p, t, o) {
  const B = fit(o.brass, 5).map(hex), ph = t / meta.duration;
  // the gold streak behind it: solid, stepping down the ramp as it trails off
  for (let x = -15; x >= -27; x--) { const k = (-15 - x) / 12; p.px(x, 0, k < 0.35 ? B[4] : k < 0.7 ? B[3] : B[2]); }
  // dial ticks left in the air, scrolling back as the arrow moves on and shrinking with distance (every third one long)
  const shift = ph * TICK;
  for (let i = 0; i < 4; i++) {
    const x = Math.round(-18 - i * TICK - shift), n = (i + Math.floor(ph * TICK)) % 3 === 0 ? 3 : 2, h = Math.max(1, n - Math.floor(i / 2));
    p.line(x, -h, x, h, i < 2 ? B[4] : B[3]);
  }
  // the arrow on whole pixel rows: outlined, lit along its top edge
  const at = (x, y) => part(x + 0.5, y);
  for (let y = -4; y <= 4; y++) for (let x = -16; x <= 9; x++) {
    const s = at(x, y);
    if (s < 0) {
      if ([at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some((v) => v > 0)) p.px(x, y, INK);
      continue;
    }
    const top = at(x, y - 1) < 0;
    p.px(x, y, s === 2 ? (top ? B[4] : y > 0 ? B[2] : B[3]) : s === 3 ? (top ? B[3] : B[1]) : B[3]);
  }
  // a glint flickering on the tip
  if (ph < 0.5) { p.px(3, -1, WHITE); p.light(3, -1, B[4], 0.5); }
  p.glow(3, 0, 6, B[3], 0.15);
}
