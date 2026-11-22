// Beyond the Clockwork: one burst of Belgard's cracks (the floor splitting along a line from his planted blade). Seen
// from the game's camera: a jagged split tears open in the stone, hot light blasts up out of it in a short column,
// slabs and chips are thrown up and fall back, dust boils up and settles, the split glows and cools. One-shot; the game
// sets several along each crack, one after another outward.
import { Particles, P, Rng, fit, hex, ease, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Floor split burst",
  desc: "The floor tearing open: a jagged split, hot light blasting up in a short column, slabs and chips thrown up and falling back, dust boiling up, the split glowing then cooling.",
  tags: ["impact", "crack", "eruption", "floor", "earth", "one-shot"],
  size: [96, 104],
  origin: [48, 80],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a120c", "#5a4430", "#a88a62", "#f3e6c4", "#ffffff"], heat: ["#8a3a10", "#e07a28", "#ffc65a", "#fff2c0"], dust: "#9a8a72", seed: 21 },
};

const FLAT = 0.5;

export function create(o) {
  const C = fit(o.palette, 5).map(hex), H = fit(o.heat, 4).map(hex), R = new Rng(o.seed), dust = hex(o.dust);
  const ps = new Particles({ rng: R, ground: (x) => 0, sparks: [WHITE, H[3], H[2]] });
  // slabs and chips thrown up out of the split, falling back to the floor
  for (let i = 0; i < 14; i++) {
    const x = R.range(-14, 14), up = R.range(90, 170);
    ps.spawn(P.GRIT, x, 0, R.range(-40, 40), -up, R.range(0.45, 0.7), R.pick([C[1], C[1], C[2], C[0]]), R.chance(0.4) ? 2 : 1);
  }
  // dust boiling up from it
  for (let i = 0; i < 12; i++) {
    const x = R.range(-16, 16);
    ps.spawn(P.DUST, x, -2, R.range(-12, 12), -R.range(20, 45), R.range(0.5, 0.75), dust, R.range(3, 5), R.range(0.02, 0.15));
  }
  // embers flicking out of the light
  for (let i = 0; i < 8; i++) ps.spawn(P.SPARK, R.range(-6, 6), -2, R.range(-50, 50), -R.range(60, 120), R.range(0.2, 0.4), H[2], 1);
  // a few slabs of floor big enough to read, thrown up out of the split
  const slabs = Array.from({ length: 6 }, () => ({ x: R.range(-12, 12), vx: R.range(-45, 45), vy: R.range(110, 170), w: R.pick([3, 4, 5]), h: R.pick([2, 3]), d: R.range(0, 0.06), life: 0.7 }));
  // the split: a jagged line across the burst, flat on the floor
  const seam = [];
  for (let x = -20; x <= 20; x += 4) seam.push([x, R.range(-2.5, 2.5) * FLAT]);
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); },
    drawBack(p) {
      const open = ease.outCubic(clamp(t / 0.08, 0, 1)), heat = clamp(1 - (t - 0.1) / 0.6, 0, 1), cool = clamp(1 - (t - 0.5) / 0.25, 0, 1);
      if (cool <= 0) return;
      // the split: a dark gap that tears open, its lips lit, hot light inside it
      for (const w of [3, 2, 1]) {
        const lift = (w - 1) * open;
        p.polyline(seam.map(([x, y]) => [x * open, y - lift]), w === 3 ? C[0] : w === 2 ? (heat > 0.3 ? H[1] : C[0]) : (heat > 0.5 ? H[3] : heat > 0.2 ? H[2] : C[1]));
      }
      p.polyline(seam.map(([x, y]) => [x * open, y + 2]), C[2], cool);
      p.glowLine(-18 * open, 0, 18 * open, 0, H[2], 0.6 * heat);
      // a scorched ring of floor round it
      if (t < 0.12) { const g = t / 0.12; p.ellipse(0, 0, 10 + g * 14, (10 + g * 14) * FLAT, H[3], 1 - g); }
      ps.draw(p, "back");
    },
    draw(p) {
      // the column of light blasting up out of the split: solid, narrowing as it goes (a dithered one read as a checkerboard)
      const k = t / 0.3;
      if (k > 0 && k < 1) {
        const h = Math.round(64 * ease.outCubic(Math.min(1, k * 2.5))), w = Math.round(6 * (1 - k)), top = -h;
        if (w >= 1) p.rect(-w, top, w * 2, h, H[1]);
        if (w >= 2) p.rect(-w + 1, top + 2, w * 2 - 2, h - 2, H[2]);
        if (w >= 3) p.rect(-1, top + 4, 2, h - 4, WHITE);
        p.glow(0, top * 0.4, 20, H[2], 0.55 * (1 - k));
      }
      // slabs of floor thrown up and falling back, lit on top
      for (const sl of slabs) {
        const age = t - sl.d;
        if (age < 0 || age > sl.vy / 260) continue;   // gone once it lands
        const x = sl.x + sl.vx * age, y = Math.min(0, -sl.vy * age + 260 * age * age);
        p.rect(Math.round(x - sl.w / 2), Math.round(y - sl.h), sl.w, sl.h, C[1]);
        p.line(Math.round(x - sl.w / 2), Math.round(y - sl.h), Math.round(x + sl.w / 2 - 1), Math.round(y - sl.h), C[2]);
        p.px(Math.round(x + sl.w / 2 - 1), Math.round(y - 1), C[0]);
      }
      ps.draw(p, "front");
    },
  };
}
