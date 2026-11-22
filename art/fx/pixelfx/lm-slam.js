// Beyond the Clockwork: 끌어올리기 slamming down: a steel ring and bits of iron and copper thrown out. Drawn in _lm.js.
import { slam } from "./_lm.js";

export const meta = {
  name: "Scrap slam",
  desc: "끌어올리기 slamming down: a steel ring and bits of iron and copper thrown out.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [128, 96],
  origin: [64, 60],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 50, seed: 7 },
};

export function draw(p, t, o) { slam(p, t, o, meta.duration); }
