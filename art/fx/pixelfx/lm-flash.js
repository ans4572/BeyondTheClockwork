// Beyond the Clockwork: 섬광탄 bursting: a white flash, eight rays, a ring racing out over the floor. Drawn in _lm.js.
import { flash } from "./_lm.js";

export const meta = {
  name: "Light flash burst",
  desc: "섬광탄 bursting: a white flash, eight rays, a ring racing out over the floor.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [144, 100],
  origin: [72, 60],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 60, seed: 7 },
};

export function draw(p, t, o) { flash(p, t, o, meta.duration); }
