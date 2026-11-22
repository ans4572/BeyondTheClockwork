import { fit, hex, ease, TAU, WHITE } from "../../core/index.js";
import { glint, pool } from "../pickups/_lib.js";

export const meta = {
  name: "Rain sword",
  desc: "A small sword stuck point-down in the floor: steel blade, cyan guard and pommel stone, a cyan glow at the cut in the floor; a glint climbs the blade.",
  tags: ["belfry", "prop", "sword", "planted", "loop"],
  size: [24, 48],
  origin: [12, 42],
  duration: 1,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { palette: ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"], seed: 2 },
};

const STEEL = ["#1b2030", "#3a4560", "#6f7c9a", "#b4bfd6", "#e8eef8"].map(hex);
const GRIP = ["#2a160a", "#5a3414"].map(hex);
const INK = hex("#10141e");

export function drawBack(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration;
  pool(p, 0, 0, 7, 2, C[3], 0.18 + 0.06 * Math.sin(ph * TAU));
  // the cut in the floor the blade went into
  p.line(-3, 0, 3, 0, INK); p.px(-4, 1, INK); p.px(4, 1, INK);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration;
  // the blade, point in the floor: 3 px wide, a lit left edge, a fuller down the middle, a dark right edge
  for (let y = -22; y <= -1; y++) {
    const tip = y > -4;
    p.px(-2, y, INK); p.px(2, y, INK);
    p.px(-1, y, tip ? STEEL[3] : STEEL[4]);
    p.px(0, y, tip ? STEEL[2] : STEEL[2]);
    p.px(1, y, STEEL[1]);
  }
  p.px(-1, 0, INK); p.px(0, 0, STEEL[2]); p.px(1, 0, INK);
  // the guard: a cyan bar with dark ends
  p.rect(-5, -25, 11, 2, C[3]); p.line(-5, -25, 5, -25, C[4]); p.px(-6, -25, INK); p.px(6, -25, INK); p.px(-6, -24, INK); p.px(6, -24, INK);
  // the grip and the pommel stone
  for (let y = -31; y <= -26; y++) { p.px(-1, y, GRIP[1]); p.px(0, y, y % 2 ? GRIP[0] : GRIP[1]); p.px(1, y, GRIP[0]); p.px(-2, y, INK); p.px(2, y, INK); }
  p.rect(-1, -34, 3, 3, C[3]); p.px(-1, -34, C[5]); p.px(-2, -33, INK); p.px(2, -33, INK); p.px(0, -35, INK);
  p.glow(0, -33, 5, C[3], 0.3 + 0.15 * Math.sin(ph * TAU));
  // a glint climbs the blade
  const g = (ph - 0.2) / 0.5;
  if (g > 0 && g < 1) glint(p, -1, -2 - 19 * ease.inOutSine(g), 2 * Math.sin(g * Math.PI), WHITE, 0.4);
}
