// Beyond the Clockwork: 한낮 표적: a small sun with turning rays. Drawn in _lm.js.
import { sun } from "./_lm.js";

export const meta = {
  name: "Little sun",
  desc: "한낮 표적: a small sun with turning rays.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [40, 40],
  origin: [20, 20],
  duration: 0.5,
  loop: true,
  fps: 24,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { sun(p, t, o, meta.duration); }
