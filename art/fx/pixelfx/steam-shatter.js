// Beyond the Clockwork: 증기 파쇄 (fire + ice), four bursts round F2 seen from above, hot and cold in turn.
// A cold burst throws a ring of ice spikes up out of the floor; the hot burst after it slams into them and they blow apart
// into chips and a cloud of white steam. Each burst is a flat shock ring racing out to the reach on the floor. F2 stands
// in the middle, so nothing is drawn over the centre but light.
import { Particles, Bits, B, Lights, P, Rng, fit, hex, ease, band, crystal, clamp, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Steam shatter",
  desc: "Four bursts round the caster seen from above, hot and cold in turn: ice spikes shoot up in a ring, the next hot ring blows them into chips and white steam.",
  tags: ["fire", "ice", "steam", "nova", "top-down", "one-shot"],
  size: [212, 188],
  origin: [106, 98],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    hot: ["#7a2a14", "#d8541e", "#ff8a3a", "#ffc46a", "#fff0c8"],
    ice: ["#123a5c", "#1f6f9f", "#3fa8d8", "#7fd6f0", "#c8f2ff", "#eafcff", "#ffffff"],
    steam: "#f2efe8",
    reach: 72,
    seed: 5,
  },
};

const FLAT = 0.55, START = 0.15, GAP = 0.3, SPIKES = 9;

export function create(o) {
  const H = fit(o.hot, 5).map(hex), I = fit(o.ice, 7), R = new Rng(o.seed), RAD = o.reach, steam = hex(o.steam);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [WHITE, H[4], H[3], H[2]] }), lights = new Lights();
  const bits = new Bits({ ground: () => Infinity });
  const bursts = [0, 1, 2, 3].map((i) => ({ at: START + i * GAP, hot: i % 2 === 0, fired: false }));
  // the spikes of each cold burst: a ring of them, set at their own radius and height; they break on the next hot burst
  const spikes = (n, seed) => {
    const g = new Rng(seed);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU + g.range(-0.12, 0.12), r = RAD * g.range(0.55, 0.8), x = Math.cos(a) * r, y = Math.sin(a) * r * FLAT, out = Math.cos(a), d = g.range(0, 0.06);
      // a cluster: one big spike and two smaller ones leaning out from it
      return [{ x, y, h: g.range(18, 26), w: g.range(8, 11), lean: out * g.range(2, 4), delay: d },
        { x: x - 5, y: y + 1, h: g.range(9, 14), w: g.range(5, 7), lean: -g.range(3, 6) + out * 2, delay: d + 0.03 },
        { x: x + 5, y: y + 1.5, h: g.range(8, 13), w: g.range(5, 7), lean: g.range(3, 6) + out * 2, delay: d + 0.05 }];
    }).flat();
  };
  const sets = [{ born: START + GAP, broke: START + 2 * GAP, list: spikes(SPIKES, o.seed + 1) }, { born: START + 3 * GAP, broke: START + 3 * GAP + 0.42, list: spikes(SPIKES - 1, o.seed + 2), melt: true }];
  let t = 0;
  // spikes blowing apart: chips thrown out and a white steam cloud where each stood (smaller when they just crack at the end)
  const shatter = (set) => {
    set.done = true;
    for (const s of set.list) {
      const big = s.h > 15, n = set.melt ? 2 : big ? 5 : 2;
      for (let i = 0; i < n; i++) bits.add({ kind: B.SHARD, x: s.x, y: s.y - s.h * 0.5, vx: Math.sign(s.x || 1) * R.range(30, 110) + R.range(-30, 30), vy: R.range(-140, -50), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(2, 4), c: hex(R.pick([I[3], I[4], I[5]])), g: 0.9, life: R.range(0.28, 0.45) });
      if (big) for (let i = 0; i < (set.melt ? 2 : 4); i++) ps.spawn(P.VAPOUR, s.x + R.range(-3, 3), s.y - R.range(2, 10), s.x * R.range(0.4, 0.9) + R.range(-10, 10), -R.range(18, 40), (set.melt ? R.range(0.3, 0.45) : R.range(0.5, 0.9)), steam, R.range(4, 7), R.range(0, 0.08));
    }
  };
  const fire = (b, last) => {
    if (b.hot) {
      lights.add(0, -4, 70, H[3], 0.5, 0.35);
      // steam: hot air hitting the floor, puffs born on a small ring and pushed out, rising a little
      for (let i = 0; i < 26; i++) {
        const a = R.range(0, TAU), d = R.range(10, 22), sp = R.range(70, 150);
        ps.spawn(P.VAPOUR, Math.cos(a) * d, Math.sin(a) * d * FLAT, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(8, 22), R.range(0.35, 0.6), R.chance(0.3) ? H[4] : steam, R.range(3, 5.5));
      }
      for (let i = 0; i < 16; i++) { const a = R.range(0, TAU), sp = R.range(120, 260); ps.spawn(P.SPARK, Math.cos(a) * 8, Math.sin(a) * 4, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(30, 110), R.range(0.12, 0.28)); }
      // the hot ring reaching last burst's spikes: each one bursts into chips and a big white steam cloud
      const set = sets.find((s) => Math.abs(s.broke - b.at) < 1e-6);
      if (set) shatter(set);
    } else {
      lights.add(0, -4, 64, hex(I[4]), 0.45, 0.3);
      for (let i = 0; i < 18; i++) { const a = R.range(0, TAU), sp = R.range(60, 150); ps.spawn(P.FLAKE, Math.cos(a) * 10, Math.sin(a) * 5, Math.cos(a) * sp, Math.sin(a) * sp * FLAT - R.range(10, 50), R.range(0.3, 0.6), hex(R.pick([I[4], I[5], I[6]])), R.range(1, 2)); }
    }
    if (last) for (let i = 0; i < 10; i++) { const a = R.range(0, TAU), r = RAD * R.range(0.3, 0.9); ps.spawn(P.VAPOUR, Math.cos(a) * r, Math.sin(a) * r * FLAT, Math.cos(a) * 10, -R.range(10, 22), R.range(0.4, 0.6), steam, R.range(3, 5), R.range(0.05, 0.15)); }
  };
  const rings = (p, near) => {
    for (const b of bursts) {
      const k = (t - b.at) / 0.32;
      if (k < 0 || k >= 1) continue;
      const ramp = b.hot ? [H[0], H[1], H[2], H[3], H[4]] : [I[1], I[2], I[3], I[4], I[5]];
      band(p, 0, 0, 10 + RAD * ease.outCubic(k), FLAT, Math.max(1, 4 * (1 - k)), 1.15 - k, ramp, (g) => (Math.sin(g) >= 0) === near, true);
      if (k < 0.5) band(p, 0, 0, 6 + RAD * 0.6 * ease.outCubic(k), FLAT, 1, (0.5 - k) * 1.6, ramp, (g) => (Math.sin(g) >= 0) === near);
      // a hot ring carries a wall of flame tongues out on it, shrinking as it goes
      if (b.hot && k < 0.75) {
        const r = 10 + RAD * ease.outCubic(k) - 2, f = 1 - k / 0.75;
        for (let j = 0; j < 28; j++) {
          const g = (j / 28) * TAU, x = Math.cos(g) * r, y = Math.sin(g) * r * FLAT;
          if ((Math.sin(g) >= 0) !== near) continue;
          const h = (9 + ((j * 7) % 5) * 2.2) * Math.pow(f, 0.6) * (1 + 0.25 * Math.sin(t * 40 + j)), lean = Math.cos(g) * 2 + Math.sin(t * 30 + j * 2);
          if (h < 1.5) continue;
          p.tri(x - 3, y, x + 3, y, x + lean, y - h, H[1]);
          p.tri(x - 1.8, y, x + 1.8, y, x + lean * 0.8, y - h * 0.7, H[2]);
          p.tri(x - 0.8, y, x + 0.8, y, x + lean * 0.6, y - h * 0.4, k < 0.2 ? WHITE : H[4]);
        }
      }
    }
  };
  const drawSpikes = (p, near) => {
    for (const set of sets) {
      const age = t - set.born;
      if (age < 0 || t >= set.broke) continue;
      for (const s of [...set.list].sort((a, b) => a.y - b.y)) {
        if ((s.y >= 0) !== near) continue;
        const k = clamp((age - s.delay) / 0.09);
        if (k <= 0) continue;
        const h = s.h * ease.outBack(k);
        crystal(p, s.x, s.y, h, s.w, s.lean, I, { white: age - s.delay < 0.04 || set.broke - t < 0.034, glint: (age * 2) % 1 });
      }
    }
  };
  return {
    update(dt) {
      t += dt;
      bursts.forEach((b, i) => { if (!b.fired && t >= b.at) { b.fired = true; fire(b, i === bursts.length - 1); } });
      for (const set of sets) if (set.melt && !set.done && t >= set.broke) shatter(set);
      ps.update(dt); bits.update(dt); lights.update(dt);
    },
    drawBack(p) {
      // light at F2's feet on each burst, nothing painted there
      for (const b of bursts) { const k = (t - b.at) / 0.15; if (k >= 0 && k < 1) p.glow(0, -2, 26, b.hot ? H[3] : hex(I[5]), 0.5 * (1 - k)); }
      rings(p, false); ps.draw(p, "back"); drawSpikes(p, false);
    },
    draw(p) { drawSpikes(p, true); rings(p, true); bits.draw(p); ps.draw(p, "front"); lights.draw(p); },
  };
}
