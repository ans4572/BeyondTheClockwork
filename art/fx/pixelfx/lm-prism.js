// Beyond the Clockwork: 서리 프리즘: an ice prism with a rainbow running up its edge. Drawn in _lm.js.
import { prism } from "./_lm.js";

export const meta = {
  name: "Ice prism",
  desc: "서리 프리즘: an ice prism with a rainbow running up its edge.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [28, 44],
  origin: [14, 40],
  duration: 0.6,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { prism(p, t, o, meta.duration); }
