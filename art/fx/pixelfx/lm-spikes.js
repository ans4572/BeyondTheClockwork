// Beyond the Clockwork: 자성 유체 덩굴: black glossy spikes shooting up once a stab. Drawn in _lm.js.
import { spikes } from "./_lm.js";

export const meta = {
  name: "Ferrofluid spikes",
  desc: "자성 유체 덩굴: black glossy spikes shooting up once a stab.",
  tags: ["light-magnet", "top-down", "loop"],
  size: [72, 56],
  origin: [36, 40],
  duration: 0.25,
  loop: true,
  fps: 32,
  bg: "ground",
  options: { reach: 26, seed: 7 },
};

export function draw(p, t, o) { spikes(p, t, o, meta.duration); }
