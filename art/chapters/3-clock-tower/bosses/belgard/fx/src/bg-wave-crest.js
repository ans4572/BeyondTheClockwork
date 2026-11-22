// Beyond the Clockwork: the front of Belgard's blade wave running along the floor, seen from above, heading right. A
// bright crest bowed forward, stone chips leaping off it, dust rolling low behind. A loop; the game moves it along the
// wave's lane and leaves the crack behind it. Cream for him, cyan for Orden's puppet (`palette`).
import { fit, hex, cycle, clamp, WHITE } from "../../core/index.js";

export const meta = {
  name: "Blade wave crest",
  desc: "The front of a blade wave running along the floor, heading right: a bright crest bowed forward, stone chips leaping off it, dust rolling low behind.",
  tags: ["wave", "floor", "shockwave", "top-down", "loop"],
  size: [72, 56],
  origin: [52, 28],
  duration: 0.3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a2c22", "#8a7a62", "#d8c8a4", "#f3e6c4", "#ffffff"], dust: "#a8987e", half: 18, seed: 8 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 5).map(hex), H = o.half, D = hex(o.dust);
  // dust rolling low behind the crest
  cycle(t, meta.duration, 10, o.seed, 0.3, (age, life, g) => {
    const k = age / life, y = (g.next() - 0.5) * 2 * H * 0.9, x = -4 - k * 34 - g.next() * 4;
    p.disc(x, y, 2 + k * 4, D, 0.45 * (1 - k));
  });
  // the crest: a bow, brightest at its leading edge, three pixels deep
  for (let y = -H; y <= H; y++) {
    const u = y / H, bow = Math.round(-6 * u * u), w = Math.abs(u) > 0.85 ? 1 : 3;
    for (let d = 0; d < w; d++) p.px(bow - d, y, d === 0 ? (Math.abs(u) < 0.6 ? WHITE : C[4]) : d === 1 ? C[3] : C[2]);
    p.px(bow - w, y, C[1]);
  }
  p.glowLine(0, -H * 0.7, 0, H * 0.7, C[3], 0.4);
  // stone chips leaping off the crest
  cycle(t, meta.duration, 6, o.seed + 1, 0.25, (age, life, g) => {
    const k = age / life, y0 = (g.next() - 0.5) * 2 * H * 0.8, x = -2 - k * 12, y = y0 - Math.sin(k * Math.PI) * 10;
    p.px(Math.round(x), Math.round(y), g.next() < 0.5 ? C[2] : C[1]);
  });
}
