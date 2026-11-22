// Beyond the Clockwork: 고철 산탄: one spinning bit of scrap. Drawn in _lm.js.
import { scrap } from "./_lm.js";

export const meta = {
  name: "Scrap bit",
  desc: "고철 산탄: one spinning bit of scrap.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [16, 16],
  origin: [8, 8],
  duration: 0.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { scrap(p, t, o, meta.duration); }
