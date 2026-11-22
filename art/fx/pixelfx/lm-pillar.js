// Beyond the Clockwork: 한낮 표적: a column of sunlight dropping on the floor. Drawn in _lm.js.
import { pillar } from "./_lm.js";

export const meta = {
  name: "Heat pillar",
  desc: "한낮 표적: a column of sunlight dropping on the floor.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [72, 100],
  origin: [36, 90],
  duration: 0.3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 30, seed: 7 },
};

export function draw(p, t, o) { pillar(p, t, o, meta.duration); }
