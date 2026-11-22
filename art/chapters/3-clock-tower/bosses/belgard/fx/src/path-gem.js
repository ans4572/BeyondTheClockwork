// Beyond the Clockwork: one small gem inlaid flat in the floor, pulsing (2026-11-19). The game sets these in a row along
// the outline of a warning or a safe zone (a ring, an arc, a square's edge) instead of a line drawn in code, which read
// as a pen stroke on the floor; the pulse is offset gem by gem, so light runs along the row. A loop, one sheet per
// colour (`palette`: outline, body, face, shine).
import { fit, hex, TAU } from "../../core/index.js";

export const meta = {
  name: "Path gem",
  desc: "A small gem inlaid flat in the floor, pulsing; set in rows along the outlines of warnings and safe zones.",
  tags: ["marker", "floor", "outline", "top-down", "loop", "ui"],
  size: [13, 11],
  origin: [6, 5],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { palette: ["#4a0c12", "#a8202c", "#e0303c", "#ff9a9a"] },
};

/** Half widths of the gem's rows, top to bottom: a diamond laid flat on the floor. */
const ROWS = [1, 2, 3, 2, 1];

export function draw(p, t, o) {
  const C = fit(o.palette, 4).map(hex), k = 0.5 + 0.5 * Math.sin((t / meta.duration) * TAU);
  ROWS.forEach((half, i) => {
    const y = i - 2;
    for (let x = -half - 1; x <= half + 1; x++) p.px(x, y, Math.abs(x) === half + 1 || (Math.abs(y) === 2 && Math.abs(x) === half) ? C[0] : y < 0 ? C[2] : C[1]);
  });
  p.px(-1, -1, C[3]); p.px(0, -1, k > 0.45 ? C[3] : C[2]);
  if (k > 0.6) p.px(1, 0, C[3]);
  p.glow(0, 0, 4, C[2], 0.15 + 0.45 * k);
}
