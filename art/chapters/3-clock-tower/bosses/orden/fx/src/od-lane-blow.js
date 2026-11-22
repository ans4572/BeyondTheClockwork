// Beyond the Clockwork: one piece of Orden's element lane blowing (2026-11-19, the user's word: the lanes looked weak for a
// final boss). The game lays pieces in a loose grid over each lane that blows, each a little behind the last. `element`:
//  0 fire      — the floor splits with light, a roaring column of flame bursts up, embers fly, smoke rolls off the top.
//  1 ice       — frost flashes over the floor, a cluster of ice blades punches up, glints white and shatters into shards.
//  2 lightning — a bolt cracks down from above with forks, a white flash and a scorched star on the floor, sparks spray.
//  3 wind      — a gale tears through along the lane (rightward; the game turns it): bright crescents of air, ribbons, dust.
// One-shot, about 0.9 s. Origin = the floor under the middle of the piece.
import { Particles, Bits, Blazes, P, B, Rng, fit, hex, clamp, ease, crystal, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's element lane blowing",
  desc: "One piece of a lane of the floor blowing with an element: a column of fire, ice blades bursting and shattering, a forked lightning bolt, or a tearing gale.",
  tags: ["magic", "boss", "fire", "ice", "lightning", "wind", "ground", "one-shot", "tile"],
  size: [96, 128],
  origin: [48, 100],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { element: 0, seed: 7 },
};

const RAMPS = [
  ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"],
  ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"],
  ["#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"],
  ["#0e2a26", "#1f5a4a", "#2f8a6a", "#5fbf94", "#9fe8c0", "#d0fbe4", "#f0fff6", "#ffffff"],
];
const FLAT = 0.55;

export function create(o) {
  const el = o.element | 0, C = fit(RAMPS[el], 8), H = C.map(hex), R = new Rng(o.seed + el * 13), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[5]], haze: C[5] });
  const bits = new Bits({ ground: floor }), blazes = new Blazes(ps);
  let t = 0, fired = false, broke = false;
  // ice: the blades of one cluster
  const blades = [[-14, 30, 9, -6], [-2, 52, 12, 4], [11, 38, 10, 8], [22, 22, 7, 10], [-24, 18, 6, -8]].map(([x, h, w, lean]) => ({ x: x + R.range(-2, 2), h: h * R.range(0.85, 1.1), w, lean, d: R.range(0, 0.06) }));
  // lightning: a jagged path from the sky to the floor, with forks
  const bolt = seed => { const r = new Rng(seed), pts = [[r.range(-10, 10), -100]]; for (let y = -88; y < 0; y += 10) pts.push([pts.at(-1)[0] + r.range(-7, 7), y]); pts.push([0, 0]); return pts; };
  let path = bolt(o.seed), forks = [];
  const line = (p, pts, c, w = 0) => { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); p.px(x, y, c); for (let d = 1; d <= w; d++) { p.px(x - d, y, c); p.px(x + d, y, c); } } } };
  return {
    update(dt) {
      t += dt;
      if (!fired && t >= 0.03) {
        fired = true;
        if (el === 0) {
          for (let i = 0; i < 6; i++) blazes.add(R.range(-22, 22), 0, R.range(0.45, 0.7), R.range(0.8, 1.2));
          for (let i = 0; i < 44; i++) ps.spawn(P.FIRE, R.range(-14, 14), -R.range(0, 8), R.range(-12, 12), -R.range(150, 250), R.range(0.35, 0.55), 0, R.range(3, 5.2), R.range(0, 0.16), 1);
          for (let i = 0; i < 14; i++) ps.spawn(P.EMBER, R.range(-10, 10), -R.range(4, 20), R.range(-60, 60), -R.range(80, 160), R.range(0.5, 0.8), H[6], 1, R.range(0, 0.2));
        }
        if (el === 1) for (let i = 0; i < 6; i++) ps.spawn(P.VAPOUR, R.range(-26, 26), -1, R.range(-20, 20), -R.range(2, 10), R.range(0.5, 0.8), C[6], R.range(2, 3.2), R.range(0, 0.1));
        if (el === 2) {
          for (let i = 0; i < 18; i++) { const a = R.range(Math.PI, TAU); ps.spawn(P.SPARK, 0, -2, Math.cos(a) * R.range(60, 150), Math.sin(a) * R.range(40, 110), R.range(0.2, 0.4), 0, 1); }
          forks = [0, 1, 2].map(k => { const at = path[2 + k * 2], r = new Rng(o.seed + k * 9), pts = [at]; for (let i = 0; i < 3; i++) pts.push([pts.at(-1)[0] + (k % 2 ? 1 : -1) * r.range(5, 10), pts.at(-1)[1] + r.range(6, 11)]); return pts; });
        }
        // (thin streaks of grit, not dust: soft dust puffs read as pale blobs on the bright floors)
        if (el === 3) for (let i = 0; i < 22; i++) ps.spawn(P.STREAK, R.range(-40, 10), -R.range(0, 26), R.range(160, 260), -R.range(4, 30), R.range(0.25, 0.45), C[R.int(4, 7)], 1, R.range(0, 0.2));
      }
      if (el === 1 && !broke && t >= 0.55) {
        broke = true;
        for (const b of blades) for (let i = 0; i < 5; i++) bits.add({ kind: B.SHARD, x: b.x + R.range(-3, 3), y: -R.range(4, b.h), vx: R.range(-60, 60), vy: -R.range(30, 110), g: 0.8, drag: 0.6, bounce: 0.35, life: R.range(0.3, 0.5), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 2.4), c: C[R.int(4, 7)] });
        for (let i = 0; i < 5; i++) ps.spawn(P.VAPOUR, R.range(-20, 20), -R.range(2, 20), R.range(-12, 12), -R.range(4, 12), R.range(0.3, 0.5), C[6], R.range(1.6, 2.6));
      }
      if (el === 2 && Math.floor(t * 20) !== Math.floor((t - dt) * 20) && t < 0.3) path = bolt(o.seed + Math.floor(t * 20));
      ps.update(dt); bits.update(dt); blazes.update(dt);
    },
    drawBack(p) {
      // the floor under it: a flat flash and a glowing scorch or frost, fading
      const k = clamp(1 - t / 0.9);
      // (no glow laid on the floor: baked into the sheet it reads as a pale disc on the game's bright floors)
      // (the gale has no flash on the floor: tiled over a lane, the flashes read as pale blobs)
      if (t < 0.07 && el !== 3) p.ellipse(0, 0, 10 + t * 120, (10 + t * 120) * FLAT, H[6], 1);
      if (el === 2) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; for (let r = 4; r < 16; r++) p.dot(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * FLAT), H[1], 0.8 * k); }
      blazes.drawBack(p); ps.draw(p, "back");
    },
    draw(p) {
      if (el === 0 && t < 0.5) { const g = ease.outCubic(clamp(t / 0.1)) * (1 - clamp((t - 0.25) / 0.25)); p.glowLine(0, -6, 0, -70 * g, 6, H[5], 0.45 * g); }
      if (el === 1 && !broke) for (const b of blades) { const g = ease.outBack(clamp((t - 0.04 - b.d) / 0.1), 2.2); if (g > 0) crystal(p, b.x, 0, b.h * g, b.w, b.lean * g, RAMPS[1], { glint: t > 0.3 && t < 0.4 ? 0.6 : -1 }); }
      if (el === 1 && t >= 0.48 && t < 0.55) for (const b of blades) crystal(p, b.x, 0, b.h, b.w, b.lean, ["#ffffff", "#ffffff", "#dcfbff"]);
      if (el === 2 && t < 0.32 && Math.floor(t * 30) % 3 !== 2) { line(p, path, H[4], 2); line(p, path, WHITE, 1); for (const f of forks) line(p, f, H[5]); p.glow(0, -4, 8, H[6], 0.7 * (1 - t / 0.32)); }
      if (el === 3 && t < 0.6) for (let i = 0; i < 3; i++) {
        // three crescents of air racing right, bowed forward
        const k = clamp((t - i * 0.08) / 0.4); if (k <= 0 || k >= 1) continue;
        const cx = -44 + k * 88, top = -30 - i * 8;
        for (let y = top; y <= 2; y++) { const u = (y - top) / (2 - top), bow = Math.round(Math.sin(u * Math.PI) * 8); p.px(cx + bow, y, u > 0.2 && u < 0.8 ? WHITE : H[5]); p.px(cx + bow - 1, y, H[5]); p.px(cx + bow - 2, y, H[4]); p.px(cx + bow - 4, y, H[3]); }

        for (let s = 0; s < 4; s++) { const y = top + 3 + s * 5; for (let x = cx - 26; x < cx - 6; x += 2) p.dot(x, y, H[5], 0.6); }
      }
      bits.draw(p); ps.draw(p, "front");
    },
  };
}
