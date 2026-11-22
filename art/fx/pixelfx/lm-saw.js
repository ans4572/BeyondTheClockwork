// Beyond the Clockwork: 고철 회전톱: a spinning saw blade. Drawn in _lm.js.
import { saw } from "./_lm.js";

export const meta = {
  name: "Scrap saw",
  desc: "고철 회전톱: a spinning saw blade.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [32, 32],
  origin: [16, 16],
  duration: 0.25,
  loop: true,
  fps: 32,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { saw(p, t, o, meta.duration); }
