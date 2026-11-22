// Beyond the Clockwork: light and magnet effects (2026-11-21), seen from above with the floor squashed to 0.55.
// The drawing for all of them lives here; each lm-*.js beside this file is one effect (its meta) that calls one of these.
// The leading underscore keeps pixelfx's index from taking this file for an effect.
import { fit, hex, ease, band, cycle, clamp, TAU, WHITE } from "../../core/index.js";

export const FLAT = 0.55;
export const PAL = {
  light: ["#5a4a20", "#c9a23c", "#ffd257", "#fff3b0", "#ffffff"],
  steel: ["#1c2230", "#4a5a72", "#8d9db4", "#c9d6e4", "#ffffff"],
  copper: ["#3a2014", "#7a4426", "#d08a4c", "#f0b47a", "#ffe2c0"],
  sun: ["#5a2a10", "#c9601c", "#ffb347", "#ffe08a", "#ffffff"],
  molten: ["#2a0e08", "#8a3b1c", "#ff8a3a", "#ffd26a", "#fff1a8"],
};

/** 섬광탄's burst: a white flash in the air, eight rays, a ring racing out over the floor and motes. */
export function flash(p, t, o, d) {
  const C = fit(PAL.light, 5).map(hex), R = o.reach;
  if (t < 0.18) { const q = t / 0.18; p.glow(0, -10, 26 * (1 - q * 0.3), C[3], 0.9 * (1 - q)); p.circle(0, -10, 7 * (1 - q) + 2, WHITE, 1 - q); }
  const q = clamp(t / 0.3);
  if (q < 1) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2, r0 = 4 + q * 10, r1 = 10 + q * 34 * (i % 2 ? 0.7 : 1); p.line(Math.cos(a) * r0, -10 + Math.sin(a) * r0, Math.cos(a) * r1, -10 + Math.sin(a) * r1, i % 2 ? C[3] : WHITE, 1 - q); }
  if (t < 0.25) { const s = ease.outCubic(t / 0.25); p.ellipse(0, 0, R * s, R * FLAT * s, C[3], 0.22 * (1 - t / 0.25)); }
  const r = clamp(t / 0.32);
  if (r < 1) band(p, 0, 0, R * ease.outCubic(r), FLAT, Math.max(1, 3 * (1 - r)), 1.1 - r, [C[1], C[2], C[3], C[4]], () => true);
  cycle(t, d, 12, o.seed, 0.35, (age, life, g) => { const k = age / life, a = g.next() * TAU, rr = g.next() * R * 0.8; p.dot(Math.cos(a) * rr, Math.sin(a) * rr * FLAT - k * 12, k < 0.4 ? WHITE : C[3], clamp(1 - k)); });
}

/** 끌어올리기's slam: scrap hitting the floor, a steel ring, bits of iron and copper thrown out and falling. */
export function slam(p, t, o, d) {
  const S = fit(PAL.steel, 5).map(hex), K = fit(PAL.copper, 5).map(hex), R = o.reach;
  if (t < 0.1) p.glow(0, -2, 22, S[3], 0.7 * (1 - t / 0.1));
  const q = clamp(t / 0.3);
  if (q < 1) band(p, 0, 0, 6 + R * ease.outCubic(q), FLAT, Math.max(1, 4 * (1 - q)), 1.1 - q, [S[1], S[2], S[3], S[4]], () => true);
  if (t < 0.35) { const s = ease.outQuad(t / 0.35); p.ellipse(0, 0, R * 0.8 * s, R * 0.8 * FLAT * s, S[1], 0.25 * (1 - t / 0.35)); }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + i * 0.37, sp = 0.55 + ((i * 37) % 10) / 22, k = clamp(t / 0.5), dd = R * sp * ease.outCubic(k);
    const x = Math.cos(a) * dd, y = Math.sin(a) * dd * FLAT - (40 * k - 52 * k * k) * sp;
    if (k >= 1) continue;
    const c = i % 3 ? S[2] : K[2]; p.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 2, c, 1); p.px(Math.round(x), Math.round(y) - 1, i % 3 ? S[3] : K[3]);
  }
  cycle(t, d, 10, o.seed, 0.4, (age, life, g) => { const k = age / life, a = g.next() * TAU, rr = g.next() * R * 0.6; p.dot(Math.cos(a) * rr, Math.sin(a) * rr * FLAT - k * 8, S[2], 0.6 * clamp(1 - k)); });
}

/** 한낮 표적's heat pillar: a column of light dropping on the floor, a hot ellipse under it. */
export function pillar(p, t, o, d) {
  const C = fit(PAL.sun, 5).map(hex), R = o.reach, k = t / d;
  const w = R * 0.85 * (1 - k * 0.5);
  p.glowLine(0, -86, 0, 0, w * 0.6, C[2], 0.5 * (1 - k));
  p.beam(0, -86, 0, 0, w, C[3], 0.75 * (1 - k));
  p.beam(0, -86, 0, 0, Math.max(2, w * 0.35), WHITE, 0.9 * (1 - k));
  p.ellipse(0, 0, R * (0.7 + k * 0.4), R * FLAT * (0.7 + k * 0.4), C[2], 0.45 * (1 - k));
  band(p, 0, 0, R * (0.8 + k * 0.3), FLAT, Math.max(1, 2 * (1 - k)), 1 - k, [C[1], C[2], C[3], C[4]], () => true);
}

/** 한낮 표적's last burst and 쇳물 공's: a hot ring, rays (sun) or thrown droplets (molten). */
export function burst(p, t, o, d, kind) {
  const C = fit(PAL[kind], 5).map(hex), R = o.reach;
  if (t < 0.16) { const q = t / 0.16; p.glow(0, -8, 30, C[3], 0.85 * (1 - q)); p.circle(0, -8, 9 * (1 - q) + 2, C[4], 1 - q); }
  const q = clamp(t / 0.34);
  if (q < 1) band(p, 0, 0, R * ease.outCubic(q), FLAT, Math.max(1, 4 * (1 - q)), 1.1 - q, [C[1], C[2], C[3], C[4]], () => true);
  if (t < 0.3) { const s = ease.outCubic(t / 0.3); p.ellipse(0, 0, R * s, R * FLAT * s, C[2], 0.3 * (1 - t / 0.3)); }
  if (kind === 'sun') {
    const r = clamp(t / 0.3);
    if (r < 1) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, r0 = 6 + r * 14, r1 = 14 + r * 30; p.line(Math.cos(a) * r0, -8 + Math.sin(a) * r0 * 0.8, Math.cos(a) * r1, -8 + Math.sin(a) * r1 * 0.8, i % 2 ? C[3] : C[4], 1 - r); }
  } else {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + i * 0.21, sp = 0.5 + ((i * 53) % 10) / 20, k = clamp(t / 0.5), dd = R * sp * ease.outCubic(k);
      if (k >= 1) continue;
      const x = Math.cos(a) * dd, y = Math.sin(a) * dd * FLAT - (34 * k - 50 * k * k) * sp;
      p.disc(x, y, 1.6 * (1 - k * 0.5), C[i % 2 ? 2 : 3], 1); p.light(x, y, C[3], 0.5 * (1 - k));
    }
  }
  cycle(t, d, 10, o.seed, 0.4, (age, life, g) => { const k = age / life, a = g.next() * TAU, rr = g.next() * R * 0.7; p.dot(Math.cos(a) * rr, Math.sin(a) * rr * FLAT - k * 16, C[3], clamp(1 - k)); });
}

/** 쇳가루's set: dust drawn in tight round a body, a steel ring snapping shut, glints. */
export function ironSet(p, t, o, d) {
  const S = fit(PAL.steel, 5).map(hex), R = o.reach, k = clamp(t / d);
  const r = R * (1.2 - ease.outCubic(k) * 0.7);
  band(p, 0, 0, r, FLAT, Math.max(1, 2.5 * (1 - k)), 1.1 - k, [S[1], S[2], S[3], S[4]], () => true);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + k * 2, rr = r * (0.9 + (i % 3) * 0.08); p.dot(Math.cos(a) * rr, Math.sin(a) * rr * FLAT - 10 - (i % 4) * 3, i % 2 ? S[3] : S[2], 1 - k); }
  if (k > 0.45 && k < 0.75) { const q = (k - 0.45) / 0.3; p.glow(0, -12, 14, S[4], 0.7 * (1 - q)); p.line(-5, -12, 5, -12, WHITE, 1 - q); p.line(0, -17, 0, -7, WHITE, 1 - q); }
}

// ---------- looping objects (the game draws them where the cast is, frame by its own clock) ----------

/** 한낮 표적's small sun: a hot disc, turning rays and a soft glow. Loops. */
export function sun(p, t, o, d) {
  const C = fit(PAL.sun, 5).map(hex), turn = (t / d) * (TAU / 10);
  p.glow(0, 0, 18, C[2], 0.5);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + turn, r0 = 9, r1 = i % 2 ? 13 : 15; p.line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1, i % 2 ? C[2] : C[3], 1); }
  p.circle(0, 0, 7, C[3], 1); p.circle(0, 0, 5, C[4], 1); p.px(-2, -2, WHITE); p.px(-3, -2, WHITE);
}

/** 쇳물 공: a red-hot iron ball with glowing seams turning as it rolls. Loops. */
export function ball(p, t, o, d) {
  const C = fit(PAL.molten, 5).map(hex), K = fit(PAL.copper, 5).map(hex), turn = (t / d) * TAU;
  p.glow(0, 0, 16, C[2], 0.45);
  p.circle(0, 0, 9, K[1], 1); p.circle(0, 0, 8, C[2], 1); p.circle(-1, -1, 5, C[3], 1); p.circle(-2, -3, 2, C[4], 1);
  for (let i = 0; i < 3; i++) { const a = turn + (i / 3) * TAU, x = Math.cos(a) * 6, y = Math.sin(a) * 6; p.line(x * 0.4, y * 0.4, x, y, C[4], 0.8); }
  p.ring(0, 0, 9, 1, K[2], 1);
}

/** 고철 회전톱: a scrap saw blade, sixteen teeth, spinning (a quarter turn a loop, so the teeth meet). Loops. */
export function saw(p, t, o, d) {
  const S = fit(PAL.steel, 5).map(hex), K = fit(PAL.copper, 5).map(hex), turn = (t / d) * (TAU / 4), pts = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + turn, r = i % 2 ? 8 : 12; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  p.poly(pts, S[2], 1); p.circle(0, 0, 7, S[3], 1); p.circle(0, 0, 3, K[2], 1); p.px(0, 0, K[3]);
  for (let i = 0; i < 4; i++) { const a = turn * 2 + (i / 4) * TAU; p.line(Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * 9, Math.sin(a) * 9, S[1], 1); }
}

/** 자성 유체 덩굴: black glossy spikes shooting up round a body and settling, once each stab. Loops with the stabs. */
export function spikes(p, t, o, d) {
  const S = fit(PAL.steel, 5).map(hex), R = o.reach, k = t / d, up = k < 0.35 ? ease.outCubic(k / 0.35) : 1 - ease.inQuad((k - 0.35) / 0.65) * 0.6;
  p.ellipse(0, 0, R, R * FLAT, hex("#151824"), 0.6);
  for (let i = 0; i < 11; i++) {
    const a = i * 0.57 + 0.3, rr = R * (0.2 + (i % 3) * 0.28), x = Math.cos(a) * rr, y = Math.sin(a) * rr * FLAT, h = (8 + (i % 2) * 10) * up + 3;
    p.tri(x - 2.5, y, x, y - h, x + 2.5, y, hex("#151824"), 1); p.line(x - 1, y - 2, x, y - h + 1, S[2], 0.8);
  }
}

/** 북극광 고리's curtain: green and violet ribbons of light coming down on a body and fading. One-shot. */
export function curtain(p, t, o, d) {
  const k = t / d, G = hex("#7be0b0"), V = hex("#d58cff"), L = hex("#dcfff0"), top = -100 + ease.outCubic(Math.min(1, k * 2)) * 20;
  for (let i = -3; i <= 3; i++) {
    const x = i * 4 + Math.sin(t * 20 + i) * 1.5, a = (1 - k) * (0.8 - Math.abs(i) * 0.08);
    p.beam(x, top, x, -2, 2, i % 2 ? V : G, a * 0.6); p.line(x, top + 30, x, -2, L, a);
  }
  p.ellipse(0, 0, 22, 22 * FLAT, G, 0.35 * (1 - k));
}

/**
 * 북극광 고리's halo over F2 (2026-11-21, replacing two code-drawn ellipses that read as a flat hoop): a tilted ring of
 * light shading from green to violet round its rim, an aurora crown rising off its far half in wavering columns that fade
 * upward, the near half bright in front of it, a glint running round and motes rising. Loops.
 */
export function halo(p, t, o, d) {
  const G = fit(["#1d5a46", "#3fb38a", "#7be0b0", "#c9ffe6", "#ffffff"], 5).map(hex), V = fit(["#3a1d5a", "#8a4fc9", "#d58cff", "#f0d4ff", "#ffffff"], 5).map(hex);
  const ph = (t / d) * TAU, RX = 19, RY = 6;
  // The crown: one column a pixel across the far half, its height wavering like a curtain, green at the foot and violet above.
  for (let x = -RX + 1; x <= RX - 1; x++) {
    const base = -RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)), h = 6 + 4 * Math.sin(x * 0.45 + ph) + 2 * Math.sin(x * 0.9 - ph * 2);
    for (let y = 0; y < h; y++) { const u = y / h, c = u < 0.45 ? G[u < 0.2 ? 3 : 2] : V[u < 0.75 ? 2 : 1]; p.dot(x, base - y, c, (1 - u) * 0.75); }
  }
  // The rim: the far half dim, the near half bright, its colour turning from green to violet as the light runs round.
  band(p, 0, 0, RX, RY / RX, 1.5, 0.55, [G[0], G[1], G[2], G[3]], ang => Math.sin(ang) <= 0);
  band(p, 0, 0, RX, RY / RX, 2, 1, [V[1], V[2], G[2], G[3]], ang => Math.sin(ang) > 0 && Math.sin(ang * 2 + ph) > 0);
  band(p, 0, 0, RX, RY / RX, 2, 1, [G[1], G[2], G[3], G[4]], ang => Math.sin(ang) > 0 && Math.sin(ang * 2 + ph) <= 0);
  const gx = Math.cos(ph) * RX, gy = Math.sin(ph) * RY;
  if (Math.sin(ph) > -0.3) { p.glow(gx, gy, 4, G[3], 0.45); p.dot(gx, gy, WHITE, 1); }
  cycle(t, d, 7, o.seed, 0.7, (age, life, g) => { const k = age / life, a = g.next() * TAU; p.dot(Math.cos(a) * RX * 0.8, Math.sin(a) * RY * 0.5 - 4 - k * 12, k < 0.5 ? G[4] : V[3], clamp(1 - k)); });
}

/**
 * 울리는 쇠줄's pluck (2026-11-21, replacing code ellipses): brass sound arcs leaving the string on both sides, one after
 * another, widening and fading. The string runs left to right through the origin; the renderer turns it to the wire.
 */
export function pluck(p, t, o, d) {
  const B = fit(["#5a3a14", "#a8742c", "#e0a64c", "#ffd88a", "#fff4d6"], 5).map(hex);
  for (let n = 0; n < 2; n++) {
    const k = clamp((t - n * 0.1) / (d * 0.7));
    if (k <= 0 || k >= 1) continue;
    const r = 5 + k * 12, a = Math.min(1, (1 - k) * 1.6) * (n ? 0.75 : 1), w = 2.6 - k, c = B[k < 0.3 ? 4 : k < 0.6 ? 3 : 2];
    p.arc(0, -2, r, w, Math.PI * 1.2, Math.PI * 1.8, c, a);
    p.arc(0, 2, r, w, Math.PI * 0.2, Math.PI * 0.8, c, a);
  }
  if (t < 0.08) p.glow(0, 0, 6, B[3], 0.6 * (1 - t / 0.08));
}

/**
 * 소나기 무지개's shower (2026-11-21): rain streaks falling from the cloud's height on to an oval of floor (reach = its
 * radius in px), each ending in a small splash ring and two flung droplets. Loops; the origin is the middle of the floor oval.
 */
export function rain(p, t, o, d) {
  const W = fit(["#1d3a52", "#3f7fa8", "#8fd0ea", "#d8f4ff", "#ffffff"], 5).map(hex), R = o.reach, TOP = -46;
  cycle(t, d, 36, o.seed, 0.3, (age, life, g) => {
    const k = age / life, a = g.next() * TAU, rr = Math.sqrt(g.next()) * R, x = Math.cos(a) * rr, y = Math.sin(a) * rr * FLAT;
    if (k < 0.6) { const q = k / 0.6, yy = TOP + (y - TOP) * q, xx = x + 4 * (1 - q); p.line(xx + 2, yy - 9, xx, yy, W[2], 0.55); p.line(xx + 1, yy - 5, xx, yy, W[3], 0.9); p.dot(xx, yy, W[4], 1); }
    else { const q = (k - 0.6) / 0.4; p.ellipse(x, y, 1 + q * 4, (1 + q * 4) * FLAT, W[2], 0.5 * (1 - q)); p.dot(x - 2 - q * 2, y - 2 - q * 3 + q * q * 4, W[3], 1 - q); p.dot(x + 2 + q * 2, y - 2 - q * 3 + q * q * 4, W[3], 1 - q); }
  });
}

/** 고철 산탄: one spinning bit of scrap. Loops. */
export function scrap(p, t, o, d) {
  const S = fit(PAL.steel, 5).map(hex), a = (t / d) * TAU, c = Math.cos(a), s = Math.sin(a);
  const pts = [[-4, -2], [4, -3], [3, 3], [-3, 2]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  p.poly(pts, S[2], 1); p.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], S[3], 1);
}

/** 서리 프리즘: an ice prism standing on the floor, a rainbow running up its edge. Loops. */
export function prism(p, t, o, d) {
  const I = hex("#d6f3fb"), I2 = hex("#7fc9df"), k = t / d, RAIN = ["#ff6b6b", "#ffb347", "#ffe66d", "#7be07b", "#6fc3ff", "#8f8cff"].map(hex);
  p.ellipse(0, 0, 9, 9 * FLAT, I2, 0.4);
  p.poly([[0, -34], [9, -12], [0, -2], [-9, -12]], I, 1); p.poly([[0, -34], [9, -12], [0, -2]], I2, 0.55);
  p.line(-3, -26, -5, -12, WHITE, 1);
  const y = -6 - ((k * 28) % 28); p.dot(5, y, RAIN[Math.floor(k * 6) % 6], 1); p.dot(6, y + 1, RAIN[(Math.floor(k * 6) + 2) % 6], 0.8);
  p.glow(0, -16, 12, I, 0.25 + 0.15 * Math.sin(k * TAU));
}
