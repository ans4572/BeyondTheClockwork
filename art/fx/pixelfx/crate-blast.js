// A wooden crate going off, seen from above at a slant (a 3/4 top-down floor, squashed to 0.55 of its depth), for
// Beyond the Clockwork. Made from small-explosion.js: its fire puffs, sparks and embers (adapted from Sprite Fusion's
// open-source explosion, https://www.spritefusion.com/pixel-art-vfx/explosion, MIT License, Copyright (c) 2026
// Hugo Duprez). What changes for a top-down floor: the shock ring, dust and scorch lie flat on the floor as ellipses,
// and the debris (wood splinters and planks, not rocks) flies out in every direction over the floor with its own
// height, landing at its own depth instead of on one ground line.
import { Particles, Lights, P, PF, Rng, fit, band, clamp, smooth, ease, rand, TAU, WHITE, hex, mix, scale, rgb } from "../../core/index.js";

export const meta = {
  name: "Crate blast (top-down)",
  desc: "A wooden crate blows up on a floor seen from above: a flash, a flat shock ring, a fireball and a quick puff, wood splinters thrown all round.",
  tags: ["explosion", "fire", "crate", "wood", "debris", "top-down", "one-shot"],
  size: [152, 136],
  origin: [76, 86],
  duration: 1.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    wood: ["#3a2010", "#7a4a22", "#b07a3e", "#d9a866", "#f3d896"],
    dust: "#c9b39a",
    reach: 44,
    seed: 7,
  },
};

const FLAT = 0.55, SOOT = hex("#2a1d1a"), WARM = rgb(255, 176, 96), GRAVITY = 520;

// the floor under the blast: a flat ellipse, white-hot, cooling through the fire ramp to soot, then fading
function scorch(p, F, t, rx0, cool, fade) {
  if (fade <= 0) return;
  const rx = rx0 * Math.min(1, t / 0.08), ry = rx * FLAT, heat = [...F].reverse();
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      const dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const k = rand(x * 31 + y * 7, 3), T = Math.pow(clamp(1 - t / cool), 1.4) * (1.25 - d) - k * 0.35;
      if (T > 0.06) {
        const c = heat[Math.min(heat.length - 1, Math.floor((1 - Math.min(1, T)) * (heat.length - 1)))];
        p.dot(x, y, c, fade);
        if (((x + y) & 3) === 0) p.glow(x + 0.5, y, 5, c, 0.16 * T * fade);
      }
    }
}

// a splinter or plank: a short bar along its spin angle, lit on top, with a dark rim, raised by its height
function splinter(p, b, W) {
  const fade = Math.min(1, b.life / 0.35), ca = Math.cos(b.a), sa = Math.sin(b.a) * 0.7, x = b.x, y = b.y - b.z;
  const len = b.len, half = len / 2;
  // its shadow on the floor while it flies
  if (b.z > 1) p.dot(Math.round(b.x), Math.round(b.y), SOOT, 0.35 * fade);
  for (let d = -half - 0.6; d <= half + 0.6; d += 0.5) p.dot(x + ca * d, y + sa * d + 1, W[0], fade);
  for (let d = -half; d <= half; d += 0.5) {
    p.dot(x + ca * d, y + sa * d, d < 0 ? W[3] : W[2], fade);
    if (b.wide) p.dot(x + ca * d - sa * 0.8, y + sa * d + ca * 0.8, W[1], fade);
  }
  p.dot(x - ca * half, y - sa * half, W[4], fade);
}

export function create(o) {
  const F = fit(o.palette, 8), W = fit(o.wood, 5).map(hex), DUST = hex(o.dust), RAD = o.reach, R = new Rng(o.seed);
  // Fire and sparks rise and fall on the screen; nothing lands on a ground line (the floor is everywhere).
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [F[6], F[5], F[3], F[2]] }), lights = new Lights();
  const Y = -9, FIRE = 13, flashes = [{ r: FIRE * 0.85, life: 0.06, max: 0.06 }], bits = [];
  let t = 0;

  lights.add(0, Y, RAD * 1.6, WARM, 0.6, 0.6);
  lights.add(0, Y, FIRE * 1.8, WHITE, 0.55, 0.08);
  // the fireball: puffs in a ball round the crate, the bigger ones leaving smoke
  for (let i = 0; i < 5; i++) ps.spawn(P.FIRE, R.range(-2, 2), Y + R.range(-2, 2), R.range(-16, 16), R.range(-34, -8), R.range(0.18, 0.28), 0, R.range(FIRE * 0.45, FIRE * 0.6));
  for (let i = 0; i < 22; i++) {
    const a = R.range(0, TAU), d = R.range(0, FIRE * 0.5), sp = R.range(40, 150);
    ps.spawn(P.FIRE, Math.cos(a) * d, Y + Math.sin(a) * d * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - 25, R.range(0.25, 0.5), 0, R.range(FIRE * 0.28, FIRE * 0.48), 0, 0);
  }
  for (let i = 0; i < 2; i++) ps.spawn(P.FIRE, R.range(-4, 4), Y, R.range(-8, 8), R.range(-120, -80), R.range(0.35, 0.5), 0, R.range(FIRE * 0.3, FIRE * 0.4), R.range(0, 0.06), 0);
  // a short puff of warm grey smoke, lighter than a battlefield's, gone well before the effect ends
  for (let i = 0; i < 5; i++) {
    const a = R.range(0, TAU), d = R.range(0, FIRE * 0.6), sp = R.range(10, 50);
    ps.spawn(P.DUST, Math.cos(a) * d, Y + Math.sin(a) * d * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - 30, R.range(0.5, 0.75), rgb(176, 160, 150), R.range(FIRE * 0.3, FIRE * 0.42), R.range(0.12, 0.25), 0);
  }
  // sparks and embers fly in every direction over the floor (flattened), arcing up as they go
  for (let i = 0; i < 60; i++) {
    const a = R.range(0, TAU), sp = R.range(120, 300);
    ps.spawn(P.SPARK, 0, Y, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(40, 130), R.range(0.15, 0.45));
  }
  for (let i = 0; i < 20; i++) {
    const a = R.range(0, TAU), sp = R.range(30, 110);
    ps.spawn(P.EMBER, Math.cos(a) * FIRE * 0.5, Y + Math.sin(a) * FIRE * 0.3, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - 60, R.range(0.7, 1.3), F[3]);
  }
  // dust rolls out over the floor: a flat ring of soft puffs moving outward in every direction
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + R.range(-0.15, 0.15), sp = R.range(0.9, 1.5) * RAD;
    ps.spawn(P.DUST, Math.cos(a) * 6, Math.sin(a) * 6 * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - 4, R.range(0.45, 0.7), DUST, R.range(3, 4.5), R.range(0, 0.05), 0);
  }
  // wood: splinters and a few planks, each thrown out over the floor with a height of its own
  for (let i = 0; i < 16; i++) {
    const a = R.range(0, TAU), sp = R.range(0.6, 1.2) * RAD * 1.5, wide = i < 6;
    bits.push({ x: Math.cos(a) * 3, y: Math.sin(a) * 3 * FLAT, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * FLAT, z: 6, vz: R.range(90, 190), a: R.range(0, TAU), va: R.range(-14, 14), len: wide ? R.range(5, 7) : R.range(3, 4.5), wide, life: R.range(1.0, 1.35), rest: false });
  }

  return {
    update(dt) {
      t += dt;
      for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        if ((b.life -= dt) <= 0) { bits.splice(i, 1); continue; }
        if (b.rest) continue;
        b.vz -= GRAVITY * dt; b.z += b.vz * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
        b.vx -= b.vx * 0.6 * dt; b.vy -= b.vy * 0.6 * dt;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -110) { b.vz = -b.vz * 0.3; b.vx *= 0.5; b.vy *= 0.5; b.va *= 0.5; ps.spawn(P.DUST, b.x, b.y, R.range(-12, 12), -R.range(2, 10), R.range(0.25, 0.45), DUST, R.range(1.2, 2.2)); }
          else { b.rest = true; b.vx = b.vy = b.vz = 0; }
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      scorch(p, F, t, 14, 0.6, 1 - smooth(0.7, 1.35, t));
      ps.draw(p, "back");
      const k = t / 0.42;
      if (k < 1) band(p, 0, 0, RAD * ease.outCubic(k), FLAT, Math.max(1, 3.2 * (1 - k)), 1.15 - k, [W[3], DUST, F[3], F[6]], (g) => Math.sin(g) < 0);
      for (const b of bits) if (b.y < 0) splinter(p, b, W);
    },
    draw(p) {
      const k = t / 0.42;
      if (k < 1) band(p, 0, 0, RAD * ease.outCubic(k), FLAT, Math.max(1, 3.2 * (1 - k)), 1.15 - k, [W[3], DUST, F[3], F[6]], (g) => Math.sin(g) >= 0);
      for (const b of bits) if (b.y >= 0) splinter(p, b, W);
      ps.draw(p, "front");
      for (const f of flashes) {
        const k2 = f.life / f.max, r = f.r * (0.8 + 0.2 * k2);
        p.circle(0, Y, r + 1.2, F[2]);
        p.circle(0, Y, r, k2 > 0.45 ? F[6] : F[5]);
        p.circle(0, Y, r * 0.6, k2 > 0.45 ? WHITE : F[6]);
      }
      lights.draw(p);
    },
  };
}
