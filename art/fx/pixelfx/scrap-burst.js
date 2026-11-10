// Beyond the Clockwork: something small breaking on a floor seen from above (an elite's shield, a fence, a dropped
// parts box): a quick pop, a flat ring of dust, and chips of its material thrown all round, each with a height of its
// own, landing where it falls and fading. `palette` is the material, dark to light (wood, brass, ice, oil).
import { Particles, P, Rng, fit, clamp, ease, band, TAU, WHITE, hex } from "../../core/index.js";

export const meta = {
  name: "Scrap burst",
  desc: "A small thing breaks on a floor seen from above: a pop, a flat dust ring, and chips of its material thrown all round, landing and fading.",
  tags: ["debris", "break", "shatter", "top-down", "one-shot"],
  size: [112, 96],
  origin: [56, 60],
  duration: 0.7,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#3a2010", "#7a4a22", "#b07a3e", "#d9a866", "#f3d896"], dust: "#c9b39a", reach: 26, count: 12, seed: 5 },
};

const FLAT = 0.55, GRAVITY = 560;

function chip(p, b, M, fade) {
  const ca = Math.cos(b.a), sa = Math.sin(b.a) * 0.7, x = b.x, y = b.y - b.z, half = b.len / 2;
  if (b.z > 1) p.dot(Math.round(b.x), Math.round(b.y), M[0], 0.3 * fade);
  for (let d = -half - 0.5; d <= half + 0.5; d += 0.5) p.dot(x + ca * d, y + sa * d + 1, M[0], fade);
  for (let d = -half; d <= half; d += 0.5) p.dot(x + ca * d, y + sa * d, d < 0 ? M[3] : M[2], fade);
  p.dot(x - ca * half, y - sa * half, M[4], fade);
}

export function create(o) {
  const M = fit(o.palette, 5).map(hex), DUST = hex(o.dust), RAD = o.reach, R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => Infinity }), bits = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + R.range(-0.2, 0.2), sp = R.range(0.9, 1.4) * RAD * 2.4;
    ps.spawn(P.DUST, Math.cos(a) * 3, Math.sin(a) * 3 * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - 3, R.range(0.3, 0.5), DUST, R.range(2.2, 3.4));
  }
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU), sp = R.range(140, 260);
    ps.spawn(P.SPARK, 0, -6, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(20, 80), R.range(0.08, 0.2), M[4]);
  }
  for (let i = 0; i < o.count; i++) {
    const a = R.range(0, TAU), sp = R.range(0.5, 1.15) * RAD * 2.6;
    bits.push({ x: Math.cos(a) * 2, y: Math.sin(a) * 2 * FLAT, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * FLAT, z: 7, vz: R.range(70, 150), a: R.range(0, TAU), va: R.range(-16, 16), len: R.range(1.5, 3.5), rest: false });
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const b of bits) {
        if (b.rest) continue;
        b.vz -= GRAVITY * dt; b.z += b.vz * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
        b.vx -= b.vx * 1.2 * dt; b.vy -= b.vy * 1.2 * dt;
        if (b.z <= 0) { b.z = 0; if (b.vz < -90) { b.vz = -b.vz * 0.3; b.vx *= 0.5; b.vy *= 0.5; } else { b.rest = true; b.va = 0; } }
      }
      ps.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
      const k = t / 0.25;
      if (k < 1) band(p, 0, 0, RAD * ease.outCubic(k), FLAT, Math.max(1, 2 * (1 - k)), 1.1 - k, [M[2], DUST, M[3], M[4]], (g) => Math.sin(g) < 0);
      const fade = 1 - clamp((t - 0.4) / 0.3);
      for (const b of bits) if (b.y < 0) chip(p, b, M, fade);
    },
    draw(p) {
      const k = t / 0.25, fade = 1 - clamp((t - 0.4) / 0.3);
      if (k < 1) band(p, 0, 0, RAD * ease.outCubic(k), FLAT, Math.max(1, 2 * (1 - k)), 1.1 - k, [M[2], DUST, M[3], M[4]], (g) => Math.sin(g) >= 0);
      for (const b of bits) if (b.y >= 0) chip(p, b, M, fade);
      ps.draw(p, "front");
      if (t < 0.05) { p.circle(0, -6, 5 * (1 - t / 0.05) + 2, M[4]); p.circle(0, -6, 2.5 * (1 - t / 0.05) + 1, WHITE); }
    },
  };
}
