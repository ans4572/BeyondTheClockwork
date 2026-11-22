// Beyond the Clockwork: the magic circle under Orden while he casts (2026-11-20, the user's word: his spells should look
// like a final boss's). A clock face laid flat on the floor: an outer ring with twelve gold ticks turning slowly, an
// inner ring of rune marks turning the other way, two hands sweeping round, light motes rising off it. `gold` 0 cyan
// (Orden), 1 gold and cyan (Orden at the last hour). Loop of 1.2 s. Origin = the middle of the circle on the floor.
import { cycle, fit, hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Orden's casting circle",
  desc: "A clock face of light laid on the floor under a caster: turning rings, gold ticks, sweeping hands, rune marks and rising motes.",
  tags: ["magic", "arcane", "boss", "ground", "loop", "circle"],
  size: [192, 142],
  origin: [96, 96],
  duration: 1.2,
  loop: true,
  fps: 20,
  bg: "ground",
  options: { gold: 0, seed: 5 },
};

const FLAT = 0.5;
const CYAN = ["#06202a", "#0c4a5c", "#1a8aa0", "#3fd0e8", "#9ff4ff", "#ffffff"];
const GOLD = ["#3a2408", "#7a5418", "#c99a3a", "#ffd257", "#ffe9a8", "#ffffff"];

export function draw(p, t, o) {
  const u = t / meta.duration, ph = u * TAU, C = fit(o.gold ? GOLD : CYAN, 6).map(hex), K = fit(CYAN, 6).map(hex), G = fit(GOLD, 6).map(hex);
  // Thick lines with a dark edge under them, and a dim wash inside, so it reads on the game's bright floors too.
  const ring = (r, c, step = 1, off = 0) => { for (let a = 0; a < TAU; a += step / r) { const x = Math.round(Math.cos(a + off) * r), y = Math.round(Math.sin(a + off) * r * FLAT); p.px(x, y + 1, K[0]); p.px(x, y, c); p.px(x + 1, y, c); } };

  // outer ring, doubled, with a brighter band running round it
  ring(78, C[2]); ring(76, C[3]);
  for (let a = 0; a < TAU; a += 1 / 76) { const k = Math.cos(a - ph); if (k > 0.85) p.px(Math.round(Math.cos(a) * 76), Math.round(Math.sin(a) * 76 * FLAT), C[5]); }
  // twelve ticks, turning slowly (an eighth of a turn a loop keeps it seamless with 12 marks: a twelfth)
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + u * TAU / 12, long = i % 3 === 0 ? 10 : 6;
    for (let r = 66; r < 66 + long; r++) { const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT); p.px(x, y + 1, G[0]); p.px(x, y, i % 3 === 0 ? G[4] : G[3]); p.px(x + 1, y, i % 3 === 0 ? G[4] : G[3]); }
  }
  // inner ring of rune marks turning the other way
  ring(52, K[2], 2); ring(50, K[3], 2);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU - u * TAU / 16, x = Math.round(Math.cos(a) * 44), y = Math.round(Math.sin(a) * 44 * FLAT);
    const g = (i * 7) % 4;
    p.px(x, y, K[4]); if (g & 1) p.px(x + 1, y, K[3]); if (g & 2) p.px(x, y - 1, K[3]); if (g === 3) p.px(x - 1, y + 1, K[3]);
  }
  ring(30, C[3], 3);
  // two hands sweeping round (the long one once a loop, the short one a twelfth)
  for (const [len, a, c] of [[62, ph - Math.PI / 2, C[5]], [36, ph / 12 - Math.PI / 2, G[4]]]) for (let r = 0; r < len; r++) { const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * FLAT); p.px(x, y + 1, K[0]); p.px(x, y, r > len - 4 ? WHITE : c); }
  p.px(0, 0, WHITE); p.px(1, 0, G[4]); p.px(-1, 0, G[4]);
  // (no glow on the floor: baked into the sheet it reads as a pale disc on the game's bright floors)
  // motes rising off the rings
  cycle(t, meta.duration, 24, o.seed, 0.9, (age, life, g) => {
    const k = age / life, a = g.next() * TAU, r = 30 + g.next() * 48, x = Math.round(Math.cos(a) * r), y0 = Math.round(Math.sin(a) * r * FLAT);
    p.px(x, Math.round(y0 - k * 40), k < 0.4 ? WHITE : (g.next() < 0.5 ? C[4] : K[4]));
    if (k < 0.5) p.light(x, Math.round(y0 - k * 40), C[4], 0.4);
  });
}
