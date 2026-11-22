// Beyond the Clockwork: the grand tuner Orden's spell parts (2026-11-19), in his colours (navy, gold, cyan). `part`:
//  0 bolt   — a needle of light flying right with a short trail (a 0.3 s loop). Origin = its point.
//  1 rune   — a magic circle laid flat on the floor, gold, turning, its ticks pulsing (a 1 s loop), radius `reach`.
//  2 orb    — a humming sound orb, cyan, two rings rolling round it (`dark` 1: a dark violet orb that cannot be struck back).
//  3 heart  — a clock heart floating over the floor, brass with a cyan core and a ticking hand (`cracked` 1: split once).
//  4 sigil  — a command over F2's head: `mode` 0 stop (a held palm in a ring), 1 move (two arrows round a ring).
//  5 soldier — a gold phantom of Brass's toy soldiers, stepping (a 0.5 s loop). Origin = the feet.
import { fit, hex, TAU, WHITE } from "../../core/index.js";

const NAVY = ["#0b1020", "#16203a", "#243456", "#36507e"].map(hex);
const GOLD = ["#3a2408", "#6e4a14", "#a8782a", "#dcb050", "#f8e4a0"].map(hex);
const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff"].map(hex);
const VIOLET = ["#12081e", "#2e1446", "#5a2a7e", "#9a5ac8", "#d8b0ff"].map(hex);
const FLAT = 0.55;

export const meta = {
  name: "Orden's spell parts",
  desc: "The grand tuner's spells: a light needle, a floor rune, a sound orb, a clock heart, a command sigil, a gold phantom soldier.",
  tags: ["magic", "boss", "parts", "loop"],
  size: [64, 48],
  origin: [32, 24],
  duration: 1,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { part: 0, reach: 22, dark: 0, cracked: 0, mode: 0, deep: 0 },
};

export function draw(p, t, o) {
  const u = t / meta.duration, k = 0.5 + 0.5 * Math.sin(u * TAU * 2);
  if (o.part === 0 && o.deep) {
    // the deep needle (2026-11-20, the user's word: the pale one was lost on the bright floors): solid, outlined in navy,
    // a saturated blue-cyan body round a white-hot core, a violet edge, a trail of solid sparks behind.
    for (let x = -22; x <= 2; x++) {
      const d = Math.max(0, -x / 22), w = x > -2 ? 0 : d < 0.55 ? 1 : 0;
      for (let y = -w - 1; y <= w + 1; y++) p.px(x, y, NAVY[0]);
    }
    for (let x = -21; x <= 1; x++) {
      const d = Math.max(0, -x / 21), w = x > -2 ? 0 : d < 0.55 ? 1 : 0;
      for (let y = -w; y <= w; y++) p.px(x, y, y === 0 ? (d < 0.3 ? WHITE : d < 0.6 ? CYAN[4] : CYAN[3]) : (y < 0 ? CYAN[2] : VIOLET[3]));
    }
    p.px(2, 0, WHITE); p.glow(-3, 0, 6, CYAN[3], 0.5);
    for (let i = 0; i < 3; i++) { const x = Math.round(-24 - ((u * 3 + i / 3) % 1) * 12), y = (i % 2) * 2 - 1; p.px(x, y, NAVY[0]); p.px(x + 1, y, CYAN[3]); }
    return;
  }
  if (o.part === 0) {
    // the needle: a white-hot point, a cyan body, a fading trail behind
    for (let x = -18; x <= 0; x++) { const d = -x / 18; p.dot(x, 0, d < 0.15 ? WHITE : d < 0.45 ? CYAN[4] : CYAN[3], 1 - d * 0.7); if (d < 0.5) { p.dot(x, -1, CYAN[2], 0.6 - d); p.dot(x, 1, CYAN[2], 0.6 - d); } }
    p.px(1, 0, WHITE); p.glow(-2, 0, 5, CYAN[3], 0.6);
    for (let i = 0; i < 3; i++) { const x = -20 - ((u * 3 + i / 3) % 1) * 14; p.dot(Math.round(x), (i % 2) * 2 - 1, CYAN[3], 0.5); }
    return;
  }
  if (o.part === 1) {
    // the rune: two rings laid flat, twelve ticks round the outer one, a turning triangle of glyphs inside
    const R = o.reach, turn = u * TAU / 3;
    for (let j = 0; j < 220; j++) {
      const a = j / 220 * TAU;
      p.px(Math.round(Math.cos(a) * R), Math.round(Math.sin(a) * R * FLAT), j % 2 ? GOLD[3] : GOLD[2]);
      p.px(Math.round(Math.cos(a) * (R - 4)), Math.round(Math.sin(a) * (R - 4) * FLAT), GOLD[1]);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, lit = (i + Math.floor(u * 12)) % 12 < 3; for (let r = R - 3; r <= R + 1; r++) p.px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * FLAT), lit ? GOLD[4] : GOLD[2]); }
    for (let i = 0; i < 3; i++) {
      const a0 = turn + i / 3 * TAU, a1 = turn + (i + 1) / 3 * TAU, r = R - 7;
      for (let s = 0; s <= 1; s += 0.04) { const x = Math.cos(a0) * r * (1 - s) + Math.cos(a1) * r * s, y = (Math.sin(a0) * r * (1 - s) + Math.sin(a1) * r * s) * FLAT; p.px(Math.round(x), Math.round(y), GOLD[3]); }
      p.px(Math.round(Math.cos(a0) * r), Math.round(Math.sin(a0) * r * FLAT), WHITE);
    }
    p.glowRing(0, 0, R - 2, 3, GOLD[3], 0.25 + 0.25 * k);
    return;
  }
  if (o.part === 2) {
    const C = o.dark ? VIOLET : CYAN;
    p.disc(0, 0, 6, C[1], 1); p.disc(-1, -1, 4.2, C[2], 1); p.disc(-1.5, -1.5, 2.4, C[3], 1); p.px(-2, -3, C[4]);
    for (let r = 0; r < 2; r++) { const a = u * TAU * (r ? -2 : 3), rr = 8 + r * 2; for (let j = 0; j < 14; j++) { const b = a + j / 14 * TAU * 0.6; p.dot(Math.round(Math.cos(b) * rr), Math.round(Math.sin(b) * rr * 0.7), C[3], 0.8 - j * 0.05); } }
    p.glow(0, 0, 9, C[3], o.dark ? 0.25 : 0.5);
    return;
  }
  if (o.part === 3) {
    // the heart: a brass case, a cyan core, a hand ticking round; floats a pixel up and down
    const bob = Math.round(Math.sin(u * TAU) * 1.5), y0 = -14 + bob;
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x, y * 1.05);
      if (d > 9.5) continue;
      p.px(x, y0 + y, d > 8.5 ? GOLD[0] : d > 7 ? (y < 0 ? GOLD[4] : GOLD[2]) : d > 4 ? NAVY[2] : CYAN[3]);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; p.px(Math.round(Math.cos(a) * 6), y0 + Math.round(Math.sin(a) * 6), GOLD[3]); }
    const a = -Math.PI / 2 + Math.floor(u * 12) / 12 * TAU; for (let r = 0; r <= 5; r++) p.px(Math.round(Math.cos(a) * r), y0 + Math.round(Math.sin(a) * r), WHITE);
    p.glow(0, y0, 8, CYAN[3], 0.35 + 0.3 * k);
    if (o.cracked) for (const [x, y] of [[-3, -8], [-2, -6], [-2, -5], [-1, -3], [0, -1], [1, 1], [1, 3], [2, 5], [3, 7]]) p.px(x, y0 + y, GOLD[0]);
    // its shadow on the floor
    p.ellipse(0, 6, 7, 2, NAVY[0], 0.5);
    return;
  }
  if (o.part === 4) {
    // the sigil: a cyan ring, and a held palm (stop) or two arrows chasing round (move)
    for (let j = 0; j < 80; j++) { const a = j / 80 * TAU; p.px(Math.round(Math.cos(a) * 11), Math.round(Math.sin(a) * 11), j % 2 ? CYAN[3] : CYAN[4]); p.px(Math.round(Math.cos(a) * 12), Math.round(Math.sin(a) * 12), CYAN[1]); }
    if (o.mode === 0) {
      const rows = ["..#.#.#..", "..#.#.#..", ".##.#.#..", ".#######.", ".#######.", "..######.", "..#####..", "...####.."];
      rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") p.px(x - 4, y - 4, y < 3 ? CYAN[4] : WHITE); }));
    } else {
      for (let i = 0; i < 2; i++) {
        const a = u * TAU + i * Math.PI;
        for (let j = 0; j < 9; j++) { const b = a - j * 0.12; p.px(Math.round(Math.cos(b) * 7), Math.round(Math.sin(b) * 7), j < 2 ? WHITE : CYAN[3]); }
        const hx = Math.cos(a) * 7, hy = Math.sin(a) * 7, tx = -Math.sin(a), ty = Math.cos(a);
        for (const s of [-1, 1]) p.px(Math.round(hx - tx * 2 + Math.cos(a) * s * 2), Math.round(hy - ty * 2 + Math.sin(a) * s * 2), WHITE);
      }
    }
    p.glow(0, 0, 12, CYAN[3], 0.25 + 0.3 * k);
    return;
  }
  if (o.part === 5) {
    // the phantom soldier: a gold silhouette, shako and drum-major coat, stepping in place
    const step = Math.floor(u * 4) % 2, G = GOLD;
    const body = ["..###..", "..###..", ".#####.", "..#.#..", ".#####.", "#######", ".#####.", ".#####.", ".##.##.", ".##.##."];
    body.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") p.px(x - 3, y - 18, y < 2 ? G[4] : y < 4 ? G[3] : G[2]); }));
    p.px(-1, -14, NAVY[3]); p.px(1, -14, NAVY[3]);
    const legs = step ? [[-2, 0], [1, 1]] : [[-2, 1], [1, 0]];
    for (const [x, lift] of legs) for (let y = -8; y <= -1 - lift; y++) { p.px(x, y, G[1]); p.px(x + 1, y, G[2]); }
    p.ellipse(0, 0, 4, 1.4, NAVY[0], 0.4);
    p.glow(0, -10, 8, G[3], 0.3);
  }
}
