import { fit, hex, cycle, clamp, ease, TAU, WHITE } from "../../core/index.js";
import { blobShadow, glint, pool } from "../pickups/_lib.js";

export const meta = {
  name: "Tuning pillar",
  desc: "A bronze post with a tuning fork and a cyan gem on top. Quiet, a glint slides down; ringing (option), the prongs shiver and rings of sound pulse out.",
  tags: ["belfry", "prop", "pillar", "tuning fork", "sound", "loop"],
  size: [56, 84],
  origin: [28, 78],
  duration: 0.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"], seed: 3, ringing: 0 },
};

const BRONZE = ["#1e1006", "#4a2a0e", "#7a4c18", "#b07c2c", "#e0b052", "#fff0b0"].map(hex);
const INK = hex("#140c08");
const GEM_Y = -57;

/** A cylinder band from x0 to x1 (inclusive) between y0 and y1, lit from the left: highlight, body, shade, rim. */
function cylinder(p, x0, x1, y0, y1, R = BRONZE) {
  p.shade(x0, y0, x1 + 1, y1 + 1, (x) => {
    const u = (x - x0) / Math.max(1, x1 - x0 + 1);
    if (x < x0 + 1 || x > x1) return INK;
    return u < 0.25 ? R[4] : u < 0.45 ? R[3] : u < 0.8 ? R[2] : R[1];
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 6), ring = o.ringing ? 1 : 0;
  blobShadow(p, 0, 13, 0.9);
  if (ring) pool(p, 0, 0, 22, 5, C[3], 0.22);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), ph = t / meta.duration, ring = o.ringing ? 1 : 0;
  // the plinth: two stepped slabs
  cylinder(p, -11, 10, -4, -1);
  p.line(-10, -4, 9, -4, BRONZE[4]);
  cylinder(p, -8, 7, -8, -5);
  p.line(-7, -8, 6, -8, BRONZE[5]);
  // the shaft with two bands
  cylinder(p, -3, 3, -46, -9);
  for (const y of [-20, -36]) { cylinder(p, -4, 4, y - 1, y + 1); p.line(-3, y - 1, 3, y - 1, BRONZE[5]); }
  // the yoke and the prongs; ringing, they shiver a pixel in and out each frame
  cylinder(p, -9, 8, -50, -47);
  p.line(-8, -50, 7, -50, BRONZE[4]);
  const shiver = ring ? (Math.floor(ph * 24) % 2 ? 1 : -1) : 0;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -10 - shiver : 5 + shiver;
    cylinder(p, x0, x0 + 4, -68, -51);
    p.line(x0 + 1, -69, x0 + 3, -69, BRONZE[4]); p.line(x0 + 1, -70, x0 + 3, -70, INK);
    p.px(x0, -69, INK); p.px(x0 + 4, -69, INK);
    if (ring) for (let y = -68; y <= -52; y += 3) p.blend(x0 - side, y, C[4], 0.45);
  }
  // the gem between the prongs
  const pulse = ring ? 0.75 + 0.25 * Math.sin(ph * TAU * 2) : 0.35 + 0.15 * Math.sin(ph * TAU);
  const gem = [[0, -3], [-1, -2], [0, -2], [1, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
  for (const [x, y] of gem) p.px(x, GEM_Y + y, y < -1 ? C[ring ? 5 : 4] : x < 0 ? C[ring ? 4 : 3] : C[ring ? 3 : 2]);
  p.px(-1, GEM_Y - 2, WHITE);
  p.glow(0, GEM_Y, ring ? 18 : 8, C[3], 0.35 * pulse);
  p.glow(0, GEM_Y, 4, C[4], 0.5 * pulse);

  if (!ring) {
    // a glint slides down the shaft once a loop
    const g = (ph - 0.15) / 0.5;
    if (g > 0 && g < 1) glint(p, -2, -44 + 38 * ease.inOutSine(g), 2 * Math.sin(g * Math.PI), BRONZE[5], 0.35);
    return;
  }
  // ringing: arcs of sound leave the fork on both sides, motes rise round it
  for (let k = 0; k < 3; k++) {
    const u = (ph + k / 3) % 1, r = 6 + u * 20, a = 1 - u;
    for (const side of [-1, 1]) {
      const mid = side < 0 ? Math.PI : 0;
      if (u < 0.08) continue;
      p.arc(0, GEM_Y, r, u < 0.3 ? 2 : 1, mid - 0.7, mid + 0.7, u < 0.25 ? C[5] : C[4], u < 0.5 ? 1 : clamp(a * 1.6, 0, 1));
    }
  }
  cycle(t, meta.duration, 10, o.seed, 0.6, (age, life, r) => {
    const k = age / life, x = r.range(-10, 10), y = -6 - k * r.range(30, 60);
    p.px(x + Math.sin(k * 6 + x) * 1.5, y, k < 0.5 ? C[5] : C[4]);
    p.light(x, y, C[3], 0.25 * (1 - k));
  });
}
