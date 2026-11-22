// Beyond the Clockwork: Orden's phantom of Belgard's greatsword, seen from above, point to the right. A see-through
// cyan blade with a bright edge, a cross-guard and grip, light running down the fuller from guard to point and motes
// drifting off it. A loop; the game turns it (flying) or stands it point down (planted for the last toll).
import { fit, hex, cycle, clamp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Phantom greatsword",
  desc: "A phantom greatsword seen from above, point right: a see-through cyan blade with a bright edge, a guard and grip, light running down the fuller, motes drifting off.",
  tags: ["sword", "phantom", "magic", "cyan", "loop"],
  size: [88, 36],
  origin: [44, 18],
  duration: 0.8,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { palette: ["#0a2630", "#1f6f86", "#5fe3ff", "#bff6ff", "#ffffff"], seed: 6 },
};

/** The blade's half-width at x (point at +38, guard at -16): straight, then tapering to the point. */
const bladeHalf = (x) => (x < -16 || x > 38 ? -1 : x < 22 ? 4.5 : 4.5 * (38 - x) / 16);

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), ph = t / meta.duration;
  p.glowLine(-16, 0, 36, 0, C[2], 0.35);
  // the blade: translucent body, bright rims, a fuller down the middle with light running along it
  for (let x = -16; x <= 38; x++) {
    const w = bladeHalf(x + 0.5);
    if (w < 0) continue;
    const run = Math.abs(((x + 16) / 54 - ph + 1) % 1 - 0.5) < 0.08;
    for (let y = -Math.ceil(w); y <= Math.ceil(w); y++) {
      if (Math.abs(y + 0.5) > w + 0.3) continue;
      const edge = Math.abs(y + 0.5) > w - 1;
      if (edge) p.px(x, y, y < 0 ? C[4] : C[3]);
      else if (y === 0 || y === -1) p.blend(x, y, run ? WHITE : C[3], run ? 1 : 0.8);
      else p.blend(x, y, C[2], 0.55);
    }
  }
  p.px(38, -1, WHITE); p.px(39, 0, C[3]);
  // the guard, the grip and the pommel
  p.rect(-19, -10, 3, 20, C[2]); p.line(-19, -10, -19, 9, C[4]); p.line(-16, -10, -16, 9, C[1]);
  p.rect(-29, -2, 10, 4, C[1]); p.line(-29, -2, -20, -2, C[3]);
  p.circle(-31, 0, 2.5, C[2]); p.px(-32, -1, C[4]);
  // motes drifting off the blade
  cycle(t, meta.duration, 8, o.seed, 0.6, (age, life, g) => {
    const k = age / life, x = -14 + g.next() * 50, y = (g.next() < 0.5 ? -1 : 1) * (5 + k * 8);
    p.dot(x - k * 4, y, k < 0.3 ? WHITE : C[3], clamp(1 - k));
  });
}
