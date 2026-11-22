// Beyond the Clockwork: 북극광 고리's halo over F2: a tilted green and violet ring with an aurora crown rising. Drawn in _lm.js.
import { halo } from "./_lm.js";

export const meta = {
  name: "Aurora halo",
  desc: "북극광 고리's halo over F2: a tilted green and violet ring of light, an aurora crown rising off its far half, a glint running round.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [48, 36],
  origin: [24, 24],
  duration: 1,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { halo(p, t, o, meta.duration); }
