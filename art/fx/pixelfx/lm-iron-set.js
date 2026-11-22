// Beyond the Clockwork: 쇳가루 setting a body: dust drawn in tight and a steel ring snapping shut. Drawn in _lm.js.
import { ironSet } from "./_lm.js";

export const meta = {
  name: "Iron set",
  desc: "쇳가루 setting a body: dust drawn in tight and a steel ring snapping shut.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [64, 56],
  origin: [32, 40],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 18, seed: 7 },
};

export function draw(p, t, o) { ironSet(p, t, o, meta.duration); }
