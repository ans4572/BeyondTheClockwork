// Beyond the Clockwork: 한낮 표적 ending: a gold ring and twelve rays. Drawn in _lm.js.
import { burst } from "./_lm.js";

export const meta = {
  name: "Sun burst",
  desc: "한낮 표적 ending: a gold ring and twelve rays.",
  tags: ["light-magnet", "top-down", "one-shot"],
  size: [128, 96],
  origin: [64, 60],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { reach: 48, seed: 7 },
};

export function draw(p, t, o) { burst(p, t, o, meta.duration, 'sun'); }
