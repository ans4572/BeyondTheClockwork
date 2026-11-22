// Beyond the Clockwork: 북극광 고리: green and violet ribbons coming down on a body. Drawn in _lm.js.
import { curtain } from "./_lm.js";

export const meta = {
  name: "Aurora curtain",
  desc: "북극광 고리: green and violet ribbons coming down on a body.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [48, 112],
  origin: [24, 104],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { curtain(p, t, o, meta.duration); }
