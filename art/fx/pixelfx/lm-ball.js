// Beyond the Clockwork: 쇳물 공: a red-hot iron ball. Drawn in _lm.js.
import { ball } from "./_lm.js";

export const meta = {
  name: "Molten ball",
  desc: "쇳물 공: a red-hot iron ball.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [28, 28],
  origin: [14, 14],
  duration: 0.4,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { ball(p, t, o, meta.duration); }
