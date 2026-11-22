// Beyond the Clockwork: 쇳물 공 bursting: a hot ring and molten droplets thrown out. Drawn in _lm.js.
import { burst } from "./_lm.js";

export const meta = {
  name: "Molten burst",
  desc: "쇳물 공 bursting: a hot ring and molten droplets thrown out.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [128, 96],
  origin: [64, 62],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 48, seed: 7 },
};

export function draw(p, t, o) { burst(p, t, o, meta.duration, 'molten'); }
