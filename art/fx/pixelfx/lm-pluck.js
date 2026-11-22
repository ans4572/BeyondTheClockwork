// Beyond the Clockwork: 울리는 쇠줄's pluck: brass sound arcs leaving the wire on both sides. Drawn in _lm.js.
import { pluck } from "./_lm.js";

export const meta = {
  name: "Wire pluck",
  desc: "울리는 쇠줄's pluck: brass sound arcs leaving the wire on both sides, widening and fading.",
  tags: ["light-magnet", "side", "one-shot"],
  size: [48, 48],
  origin: [24, 24],
  duration: 0.35,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 0, seed: 7 },
};

export function draw(p, t, o) { pluck(p, t, o, meta.duration); }
