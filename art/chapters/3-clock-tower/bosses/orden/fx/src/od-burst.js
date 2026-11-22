// Beyond the Clockwork: one of Orden's spells landing (2026-11-20, the user's word: a final boss's spells should land big):
// the floor flashes, a column of light shoots up and thins, a ring of light runs out flat over the floor, clock-face
// shards and sparks fly, light motes drift up after. `tone` 0 cyan (his own spells), 1 gold (the echoes of the other
// bosses, the last hour), 2 violet (his dark orbs, a mirror image breaking). One-shot, 0.8 s. Origin = the floor under it.
import { Particles, Bits, P, B, Rng, fit, hex, clamp, ease, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's spell landing",
  desc: "A spell landing on the floor: a flash, a column of light, a ring running out over the floor, shards and sparks, motes after.",
  tags: ["magic", "arcane", "boss", "impact", "ground", "one-shot"],
  size: [128, 176],
  origin: [64, 140],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { tone: 0, seed: 3 },
};

const RAMPS = [
  ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"],
  ["#3a2408", "#7a5418", "#c99a3a", "#ffd257", "#ffe9a8", "#ffffff"],
  ["#1a0a2a", "#3a1a5a", "#6a3a9a", "#a070e0", "#d8b8ff", "#ffffff"],
  // (2026-11-20, the element spells: 3 fire, 4 ice, 5 lightning, 6 wind)
  ["#3a0a04", "#8a1e08", "#d8481a", "#ff8a3c", "#ffd08a", "#ffffff"],
  ["#0a2a4a", "#1a5a8a", "#4a9ad0", "#9ad8f8", "#e0f6ff", "#ffffff"],
  ["#3a2a04", "#8a6a10", "#d8b020", "#ffe066", "#fff4b0", "#ffffff"],
  ["#0a2a20", "#1e5a44", "#3c9a74", "#8fe8c8", "#d8fff0", "#ffffff"],
];
const FLAT = 0.5;

export function create(o) {
  const C = fit(RAMPS[o.tone | 0], 6), H = C.map(hex), R = new Rng(o.seed + (o.tone | 0) * 17), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[5], C[4], C[3]], haze: C[4] });
  const bits = new Bits({ ground: floor });
  let t = 0, fired = false;
  return {
    update(dt) {
      t += dt;
      if (!fired && t >= 0.02) {
        fired = true;
        for (let i = 0; i < 26; i++) { const a = R.range(Math.PI * 1.05, Math.PI * 1.95); ps.spawn(P.SPARK, R.range(-4, 4), -R.range(2, 20), Math.cos(a) * R.range(60, 170), Math.sin(a) * R.range(80, 200), R.range(0.25, 0.5), 0, 1); }
        for (let i = 0; i < 10; i++) bits.add({ kind: B.SHARD, x: R.range(-6, 6), y: -R.range(10, 40), vx: R.range(-90, 90), vy: -R.range(60, 160), g: 0.9, drag: 0.5, bounce: 0.3, life: R.range(0.35, 0.6), a: R.range(0, TAU), va: R.range(-16, 16), s: R.range(1.4, 2.6), c: C[R.int(3, 5)] });
        for (let i = 0; i < 12; i++) ps.spawn(P.EMBER, R.range(-20, 20), -R.range(0, 30), R.range(-20, 20), -R.range(40, 90), R.range(0.3, 0.5), H[4], 1, R.range(0.02, 0.12));
      }
      ps.update(dt); bits.update(dt);
    },
    drawBack(p) {
      // the floor: a bright flat flash, then a ring of light running out over it and fading
      if (t < 0.08) p.ellipse(0, 0, 14 + t * 200, (14 + t * 200) * FLAT, H[5], 1);
      const k = ease.outCubic(clamp(t / 0.5)), r = 8 + k * 54, fade = 1 - clamp((t - 0.25) / 0.45);
      if (fade > 0) for (let a = 0; a < TAU; a += 1 / r) { const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT); p.px(x, y, fade > 0.5 ? H[5] : H[4]); if (fade > 0.3) p.px(x, y + 1, H[3]); }
      ps.draw(p, "back");
    },
    draw(p) {
      // the column of light: fast up, a white core, thinning and fading
      if (t < 0.55) {
        const up = ease.outExpo(clamp(t / 0.12)), thin = 1 - clamp((t - 0.12) / 0.43), h = Math.round(130 * up), w = Math.max(1, Math.round(9 * thin));
        for (let y = 0; y < h; y++) { const v = y / h; for (let x = -w; x <= w; x++) { const e = Math.abs(x) / (w + 0.5); if (e + v * 0.4 > 1) continue; p.px(x, -y, e < 0.35 ? WHITE : e < 0.7 ? H[4] : H[3]); } }
        p.glowLine(0, 0, 0, -h, 14 * thin + 4, H[3], 0.5 * thin);
      }
      bits.draw(p); ps.draw(p, "front");
    },
  };
}
