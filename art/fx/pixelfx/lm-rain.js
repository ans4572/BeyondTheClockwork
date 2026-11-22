// Beyond the Clockwork: 소나기 무지개's shower: rain streaks falling on an oval of floor, splashing. Drawn in _lm.js.
import { rain } from "./_lm.js";

export const meta = {
  name: "Shower",
  desc: "소나기 무지개's shower: rain streaks falling from a cloud on to an oval of floor, each splashing.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [80, 76],
  origin: [40, 56],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { reach: 36, seed: 11 },
};

export function draw(p, t, o) { rain(p, t, o, meta.duration); }
