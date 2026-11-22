// Element balance (2026-11-21, light and magnet review): node scripts/element-balance.mjs <mode>
//   skills   each element's two skills cast whenever ready for 30 s (charge refilled, F2 standing still), damage per second
//   kit      every pair for 60 s: wrench swinging, four skills as charge allows, the fusion when ready; then each element's mean
//   fusions  each fusion cast once; dist  a few fusions against one body at several distances; stagger  boss stagger opened
//   cards    each skill card (its skill alone, 30 s) and element trait (that element's two skills and the wrench, 30 s), with
//            and without, as a gain per scene; bodies never fall, so the cards that work on a kill read nothing here
// Targets: 1 guard 2.4 units ahead, 6 guards packed (0.85 apart) 3 ahead, 6 spread 2.5-6 ahead, Captain Brass. Bodies are
// pinned in place (knockback would carry them out of reach), never attack, and have a million HP. Damage spread is off.
import { readFile } from 'node:fs/promises';
const ROOT = new URL('../', import.meta.url).href;
const { Game } = await import(ROOT + 'src/engine/game.js');
const { validateData } = await import(ROOT + 'src/engine/data.js');
const load = async () => validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async n => [n, JSON.parse(await readFile(new URL(`src/data/${n}.json`, ROOT), 'utf8'))]))));
const data = await load();
data.combat.caps.damageSpread = 0;
Object.assign(data.slice.difficulty.levels.find(l => l.id === data.slice.difficulty.default), { scale: 1, loot: 1 });
const ELEMENTS = ['fire', 'ice', 'lightning', 'wind', 'sound', 'water', 'light', 'magnet'];

let seed = 1, prep = null;
function arena(elements, scene) {
  const g = new Game(data); g.previews = true; g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(4711 + seed++); g.s.enemies = [];
  if (g.s.run && g.room?.waves) g.s.run.wave = g.room.waves.length - 1;
  g.s.run.plan[0].layout = 2;
  g.s.run.slots = elements.map(element => ({ element, level: 1, rarity: 'common' }));
  Object.assign(g.p, { x: 8, y: 8, angle: 0, energy: 100 });
  prep?.(g);
  const put = (x, y, type = 'guard') => { const e = g.spawnEnemy(type, { x, y }); e.ready = 1e9; e.speed = 0; e.hp = e.maxHp = 1e6; e.pin = { x, y }; return e; };
  const bodies = [];
  if (scene === 'one') bodies.push(put(10.4, 8));
  if (scene === 'boss') { const b = put(10.9, 8, 'captainBrass'); bodies.push(b); }
  if (scene === 'packed') for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; bodies.push(put(11.0 + Math.cos(a) * (i ? 0.85 : 0), 8 + Math.sin(a) * (i ? 0.85 : 0))); }
  if (scene === 'spread') for (const [dx, dy] of [[2.5, -2], [3.5, 0.5], [4.5, -0.8], [5.5, 2.2], [3, 2.6], [6, -2.5]]) bodies.push(put(8 + dx, 8 + dy));
  return { g, bodies };
}
const pin = bodies => { for (const e of bodies) { e.x = e.pin.x; e.y = e.pin.y; } };
const dealt = bodies => bodies.reduce((a, e) => a + (e.maxHp - e.hp), 0);
const aimAt = (g, bodies) => { const live = bodies.filter(e => e.hp > 0); if (!live.length) return { x: 11.5, y: 8 }; const cx = live.reduce((a, e) => a + e.x, 0) / live.length, cy = live.reduce((a, e) => a + e.y, 0) / live.length; return live.reduce((b, e) => Math.hypot(e.x - cx, e.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? e : b); };

// Skills only, 30 s, energy refilled, both of an element's skills cast as soon as they are ready; the player stands still.
function skillRun(element, scene, which = null, seconds = 30) {
  const { g, bodies } = arena([element], scene);
  for (let f = 0; f < seconds * 60; f++) {
    g.p.energy = 100; g.p.hp = g.p.maxHp; if (!g.s.casts.some(c => c.shape === 'dash' || c.shape === 'lightDash') && !g.p.dodge) { g.p.x = 8; g.p.y = 8; } const t = aimAt(g, bodies);
    g.p.angle = Math.atan2(t.y - g.p.y, t.x - g.p.x);
    for (const i of which ?? [0, 1]) if (!g.busyCasting) g.castSkill(i, { x: t.x, y: t.y });
    g.update(1 / 60, { aim: { x: t.x, y: t.y }, skillHeld: [0, 1] }); pin(bodies);
  }
  // Let the last casts and statuses run out.
  for (let f = 0; f < 4 * 60; f++) { g.update(1 / 60, { aim: aimAt(g, bodies) }); pin(bodies); }
  return { damage: dealt(bodies), stagger: bodies[0].stagger ?? 0, g, bodies };
}
// 수면 공명 (film) rings only when a body on it is struck, so the wrench swings through it and its own damage (the same
// swings without the fusion) is taken off again.
function fusionOnce(pair, scene, cast = true) {
  const { g, bodies } = arena(pair, scene); g.p.energy = 100; const t = aimAt(g, bodies);
  const film = data.slice.fusionBehavior[g.fusion?.id]?.shape === 'film';
  g.p.angle = Math.atan2(t.y - g.p.y, t.x - g.p.x);
  const ok = cast ? g.castFusion(t) : false;
  for (let f = 0; f < 7 * 60; f++) { g.p.energy = 0; if (film && !g.s.casts.some(c => c.shape === 'dash')) { g.p.x = 8; g.p.y = 8; } g.update(1 / 60, { aim: { x: t.x, y: t.y }, basic: film }); pin(bodies); }
  const damage = dealt(bodies);
  return { ok, id: g.fusion?.id, damage: film && cast ? damage - fusionOnce(pair, scene, false).damage : damage };
}
const avg = (fn, n = 3) => { let s = 0; for (let i = 0; i < n; i++) s += fn(); return s / n; };

const mode = process.argv[2] || 'skills';
if (mode === 'skills') {
  console.log('element | skill | 1 | packed6 | spread6 | boss | dmg/energy(1) ');
  for (const el of ELEMENTS) {
    for (const [i, label] of [[0, 'A'], [1, 'B'], [null, 'both']]) {
      const which = i === null ? null : [i];
      const row = ['one', 'packed', 'spread', 'boss'].map(sc => avg(() => skillRun(el, sc, which).damage / 30));
      const sk = i === null ? 'both' : data.combat.skills.filter(s => s.element === el)[i].id;
      console.log([el, sk, ...row.map(v => v.toFixed(1))].join(' | '));
    }
  }
}
if (mode === 'fusions') {
  console.log('fusion | pair | 1 | packed6 | spread6 | boss');
  for (const f of data.combat.fusions.filter(x => !process.env.ONLY || process.env.ONLY.split(',').includes(x.id))) {
    const row = ['one', 'packed', 'spread', 'boss'].map(sc => avg(() => fusionOnce(f.pair, sc).damage, Number(process.env.RUNS) || 2));
    console.log([f.id, f.pair.join('+'), ...row.map(v => Math.round(v))].join(' | '));
  }
}
if (mode === 'boss-stagger') {
  for (const el of ELEMENTS) { const r = skillRun(el, 'boss'); console.log(el, Math.round(r.damage / 30), 'stagger', r.bodies[0].stagger?.toFixed?.(1), 'breaks', r.bodies[0].staggerBreaks ?? '-'); }
}

// Whole kit, 60 s: wrench swinging all the time, both elements' four skills whenever charge allows, the fusion when ready.
function kitRun(pair, scene, seconds = 60, { skills = true, fusion = true } = {}) {
  const { g, bodies } = arena(pair, scene); g.p.energy = 0;
  for (let f = 0; f < seconds * 60; f++) {
    g.p.hp = g.p.maxHp; if (!g.s.casts.some(c => c.shape === 'dash' || c.shape === 'lightDash') && !g.p.dodge) { g.p.x = 8; g.p.y = 8; }
    const t = aimAt(g, bodies); g.p.angle = Math.atan2(t.y - g.p.y, t.x - g.p.x);
    if (fusion && !g.busyCasting && !g.p.attack) g.castFusion({ x: t.x, y: t.y });
    if (skills && !g.p.attack) for (let i = 0; i < 4; i++) if (!g.busyCasting) g.castSkill(i, { x: t.x, y: t.y });
    g.update(1 / 60, { aim: { x: t.x, y: t.y }, skillHeld: [0, 1, 2, 3], basic: true }); pin(bodies);
  }
  return dealt(bodies) / seconds;
}
if (mode === 'kit') {
  const scenes = (process.argv[3] || 'one,packed,boss').split(',');
  const rows = [];
  for (let i = 0; i < ELEMENTS.length; i++) for (let j = i + 1; j < ELEMENTS.length; j++) {
    const pair = [ELEMENTS[i], ELEMENTS[j]];
    rows.push({ pair, v: scenes.map(sc => avg(() => kitRun(pair, sc), 2)) });
  }
  const wrench = scenes.map(sc => avg(() => kitRun(['fire'], sc, 60, { skills: false, fusion: false }), 2));
  console.log('wrench only', wrench.map(v => v.toFixed(1)).join(' | '));
  for (const r of rows) console.log(r.pair.join('+'), '|', r.v.map(v => v.toFixed(1)).join(' | '));
  console.log('\nelement mean over its 7 pairs (' + scenes.join(', ') + ')');
  for (const el of ELEMENTS) { const mine = rows.filter(r => r.pair.includes(el)); console.log(el, '|', scenes.map((_, k) => (mine.reduce((a, r) => a + r.v[k], 0) / mine.length).toFixed(1)).join(' | ')); }
}
if (mode === 'dist') {
  const ids = (process.argv[3] || 'moltenBall,scrapSaw,frostShards,ferroVine,refractBeam,frostPrism').split(',');
  for (const id of ids) {
    const f = data.combat.fusions.find(x => x.id === id), out = [];
    for (const d of [1.6, 2.4, 3.5, 5, 7]) for (const type of ['guard', 'captainBrass']) {
      const g = new Game(data); g.previews = true; g.s.profile.registered = true; g.s.mode = 'hub'; g.startRun(77); g.s.enemies = []; if (g.room?.waves) g.s.run.wave = g.room.waves.length - 1; g.s.run.plan[0].layout = 2;
      g.s.run.slots = f.pair.map(element => ({ element, level: 1, rarity: 'common' })); Object.assign(g.p, { x: 8, y: 8, angle: 0, energy: 100 });
      const e = g.spawnEnemy(type, { x: 8 + d, y: 8 }); e.ready = 1e9; e.speed = 0; e.hp = e.maxHp = 1e6; e.pin = { x: e.x, y: e.y };
      g.castFusion({ x: e.x, y: e.y }); for (let k = 0; k < 420; k++) { g.update(1 / 60, { aim: { x: e.x, y: e.y } }); pin([e]); }
      out.push(`${d}${type === 'guard' ? 'g' : 'B'}:${Math.round(e.maxHp - e.hp)}`);
    }
    console.log(id, f.totalDirectDamage, out.join(' '));
  }
}
if (mode === 'stagger') {
  for (const el of ELEMENTS) {
    let breaks = 0, n = 0;
    for (const other of ELEMENTS.filter(e => e !== el)) {
      const { g, bodies } = arena([el, other], 'boss'); const b = bodies[0]; let was = 0; g.p.energy = 0;
      for (let f = 0; f < 60 * 60; f++) {
        g.p.hp = g.p.maxHp; if (!g.s.casts.some(c => c.shape === 'dash' || c.shape === 'lightDash') && !g.p.dodge) { g.p.x = 8; g.p.y = 8; }
        const t = b; g.p.angle = 0;
        if (!g.busyCasting && !g.p.attack) g.castFusion({ x: t.x, y: t.y });
        if (!g.p.attack) for (let i = 0; i < 4; i++) if (!g.busyCasting) g.castSkill(i, { x: t.x, y: t.y });
        g.update(1 / 60, { aim: { x: t.x, y: t.y }, skillHeld: [0, 1, 2, 3], basic: true }); pin(bodies);
        const open = (b.exposedUntil || 0) > g.s.time; if (open && !was) breaks++; was = open;
      }
      n++;
    }
    console.log(el, 'boss stagger breaks per 60 s (mean of 7 pairs):', (breaks / n).toFixed(2));
  }
}
if (mode === 'cards') {
  // Base crits off so a card's gain is not lost in their noise (드러냄's own crits, which 맑은 렌즈 adds to, stay).
  data.combat.player.critChance = 0;
  const scenes = ['one', 'packed', 'spread', 'boss'], runs = Number(process.env.RUNS) || 3, pct = (a, b) => b ? `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)}%` : '-';
  const withCard = (set, fn) => { prep = set; try { return fn(); } finally { prep = null; } };
  console.log('card | for | tier | ' + scenes.join(' | ') + ' | (base dps ' + scenes.join('/') + ')');
  for (const m of data.slice.skillMods.filter(x => !process.env.ONLY || process.env.ONLY.split(',').includes(x.id))) {
    const skill = data.combat.skills.find(s => s.id === m.skill), el = skill.element, i = data.combat.skills.filter(s => s.element === el).indexOf(skill);
    const base = scenes.map(sc => avg(() => skillRun(el, sc, [i]).damage / 30, runs)), on = scenes.map(sc => withCard(g => { g.s.run.skillMods = [m.id]; }, () => avg(() => skillRun(el, sc, [i]).damage / 30, runs)));
    console.log([m.id, `${el}/${m.skill}`, m.tier, ...on.map((v, k) => pct(v, base[k])), base.map(v => v.toFixed(0)).join('/')].join(' | '));
  }
  for (const t of data.slice.elementTraits.filter(x => !process.env.ONLY || process.env.ONLY.split(',').includes(x.id))) {
    const run = () => kitRun([t.element], sc_, 30, { fusion: false });
    let sc_ = null;
    const base = scenes.map(sc => { sc_ = sc; return avg(run, runs); }), on = scenes.map(sc => { sc_ = sc; return withCard(g => { g.s.run.traits = [t.id]; }, () => avg(run, runs)); });
    console.log([t.id, `${t.element}/trait`, t.tier, ...on.map((v, k) => pct(v, base[k])), base.map(v => v.toFixed(0)).join('/')].join(' | '));
  }
}
