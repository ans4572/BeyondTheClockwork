// The things lying about every fight room, Hades-style: crates that blow up, floor plates that heat up, a saw running
// along its rail, pairs of wooden fences to hide behind and a music box that mends. They are not fixed to a map:
// every run places its own set on each room's floor (seeded, so a resumed run finds them where they were).
import { fitsMap } from './map-geometry.js';
import { dealer } from './encounters.js';
import { FlowField } from './flow-field.js';

/** Kinds that bodies and shots cannot pass through. */
// The mending music box is picked up by walking onto it (2026-11-06), so it no longer blocks the way.
export const SOLID = new Set(['crate', 'fence', 'dropbox', 'bossPlate']);
/** Kinds drawn flat on the floor, under everyone. */
export const GROUND = new Set(['plate', 'rail', 'belt']);

const between = ([low, high], random) => low + Math.floor(random() * (high - low + 1));
/** Kinds a small floor gets fewer of (the mending music box and chapter 2's room devices keep their counts). */
const CROWDING = new Set(['crate', 'plate', 'fence', 'rail']);
/** Below this share of a roomy floor a room is a road or an alley: fewer crates and plates, no fences and no saw rails. */
const NARROW_ROOM = 0.9;

const polygonArea = points => Math.abs(points.reduce((sum, [x, y], i) => { const [px, py] = points.at(i - 1); return sum + px * y - x * py; }, 0)) / 2;
/** How much open floor a room has, in square units: its walkable polygon less its solid props. */
export function floorArea(map) {
  return map.walkable ? polygonArea(map.walkable) - (map.solids || []).reduce((sum, solid) => sum + polygonArea(solid), 0) : 0;
}

/** The axis-aligned box a solid hazard fills, in floor units: { x, y, w, h } from its top-left. */
export function hazardBox(h) {
  const w = h.w ?? h.size, d = h.h ?? h.size;
  return { x: h.x - w / 2, y: h.y - d / 2, w, h: d };
}

/**
 * One room's hazards. `map` is the room's floor (walkable polygon, solids, spawn, portal, enemy spawns), `rules` is
 * slice.json's hazards block, `seed` this run and room. Everything lands on open floor, clear of the door and the portal
 * and of each other, and solid pieces only where there is room to walk round them.
 */
/**
 * `step` is which fight room of the run this is (0 for the first): the first few use rules.ramp's lighter counts, so a
 * run eases into its furniture; later rooms (and a step left out) get the full counts.
 */
/** How many more places a crate that closed the way is tried in before it is left out. */
const CRATE_RETRIES = 12;
export function dealHazards(map, rules, seed, step = Infinity, amount = 1, musicboxes) {
  const random = dealer(seed), placed = [], [width, height] = map.size;
  // The expedition's difficulty scales how many pieces of each kind a room gets (slice.json difficulty.levels[].scale).
  const ramp = rules.ramp?.[step], counts = Object.fromEntries(Object.entries({ ...rules.counts, ...ramp?.counts }).map(([kind, [low, high]]) => [kind, [Math.round(low * amount), Math.round(high * amount)]]));
  // A narrow floor (under NARROW_ROOM of slice.json hazards.roomyArea: the candy alley, the repair road, the ring round
  // the fountain) gets fewer crates and plates, in proportion to its floor and rounded down, and no fence pair or saw
  // rails at all, as they wall off a road from side to side (2026-11-09). Roomier floors deal as before.
  const room = rules.roomyArea ? floorArea(map) / rules.roomyArea : 1;
  if (room < NARROW_ROOM) {
    for (const kind of CROWDING) if (counts[kind]) counts[kind] = counts[kind].map(n => Math.floor(n * room));
    counts.fence = counts.rail = [0, 0];
    // A narrow map may ask for a few pieces back (maps.json villages[].extraPieces): a crate, then a plate, by turns.
    for (let i = 0; i < (map.extraPieces || 0); i++) { const kind = i % 2 ? 'plate' : 'crate'; counts[kind] = counts[kind].map(n => n + 1); }
  }
  // The run decides which rooms get a music box (musicRooms), so every expedition finds the same number of them.
  if (musicboxes !== undefined) counts.musicbox = [musicboxes, musicboxes];
  // Saw rails come two or three to a room, or not at all.
  if (counts.rail) counts.rail = counts.rail[1] < 2 ? [0, 0] : [Math.max(2, counts.rail[0]), counts.rail[1]];
  // A chapter may keep only some kinds (chapters[].hazards.only): chapter 2 keeps the crates and the music boxes, and its
  // own factory devices take the place of the rest.
  for (const kind of ['crate', 'plate', 'rail', 'fence', 'musicbox', 'belt', 'press', 'laser', 'steam', 'crane']) counts[kind] ??= [0, 0];
  if (rules.only) for (const kind of Object.keys(counts)) if (!rules.only.includes(kind)) counts[kind] = [0, 0];
  const railChance = rules.only && !rules.only.includes('rail') ? 0 : Math.min(1, (ramp?.railChance ?? rules.rail.chance) * amount);
  const keep = [map.spawn, map.portal].filter(Boolean);
  const clear = (x, y, gap) => keep.every(k => Math.hypot(x - k.x, y - k.y) >= rules.doorClear) && placed.every(p => Math.hypot(x - p.x, y - p.y) >= gap + (p.reach || 1));
  // Of several open spots, the one farthest from everything already placed, so the pieces spread over the whole floor.
  const spot = (room, gap, test = () => true) => {
    let best = null, bestRoom = -1;
    for (let tries = 0, found = 0; tries < 240 && found < rules.spreadTries; tries++) {
      const x = 1 + random() * (width - 2), y = 1 + random() * (height - 2);
      if (!fitsMap(x, y, room, map) || !clear(x, y, gap) || !test(x, y)) continue;
      found++;
      const room2 = Math.min(Infinity, ...placed.map(p => Math.hypot(x - p.x, y - p.y)), ...keep.map(k => Math.hypot(x - k.x, y - k.y) * 1.5));
      if (room2 > bestRoom) { best = { x, y }; bestRoom = room2; }
    }
    return best;
  };
  let n = 0;
  const add = (kind, at, extra) => { if (at) placed.push({ id: `hz-${++n}`, kind, x: +at.x.toFixed(2), y: +at.y.toFixed(2), ...extra }); };
  // Saw rails lie only on the map's own rail slots (maps.json railSlots: open paving, across, up or along either 2:1 floor diagonal, picked
  // off the painting so a groove never cuts a kerb, a plaque or a carpet). A room either has none, or two or three.
  const slots = (map.railSlots || []).slice();
  if (slots.length >= 2 && random() < railChance) {
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    let want = between(counts.rail, random);
    for (const [x, y, dx, dy] of slots) {
      if (!want) break;
      const ends = [{ x: x - dx, y: y - dy }, { x: x + dx, y: y + dy }, { x, y }];
      if (!ends.every(e => clear(e.x, e.y, 0.8))) continue;
      add('rail', { x, y }, { dx, dy, offset: +random().toFixed(2), reach: Math.hypot(dx, dy) + 0.5 }); want--;
    }
  }
  // Fences next, as they need the most room: a pair side by side in a straight line, either across or up the screen.
  for (let i = between(counts.fence, random); i > 0; i--) {
    const across = random() < 0.5, w = across ? rules.fence.long : rules.fence.short, h = across ? rules.fence.short : rules.fence.long;
    const step = (across ? w : h) + rules.fence.gap, [sx, sy] = across ? [step / 2, 0] : [0, step / 2];
    const centre = spot(rules.solidRoom + 0.4, 2.2, (x, y) => [-1, 1].every(k => fitsMap(x + k * sx, y + k * sy, rules.solidRoom, map) && clear(x + k * sx, y + k * sy, 1.5)));
    if (centre) for (const k of [-1, 1]) add('fence', { x: centre.x + k * sx, y: centre.y + k * sy }, { w, h, hp: rules.fence.hp, reach: 1.4 });
  }
  for (let i = between(counts.plate, random); i > 0; i--) {
    // A diamond, as wide as `half` either way and `depth` up and down, like the painted floor plaques.
    const { half, depth } = rules.plate;
    add('plate', spot(depth, 1.5, (x, y) => [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => fitsMap(x + dx * half, y + dy * depth, 0.1, map))), { half, depth, offset: +(random() * rules.plate.cycle).toFixed(2), reach: half + 0.5 });
  }
  // Conveyor belts (chapter 2): a strip across or up the screen, all of it on open floor.
  if (rules.belt && counts.belt[1] > 0) for (let i = between(counts.belt, random); i > 0; i--) {
    const across = random() < 0.6, w = across ? rules.belt.length : rules.belt.width, h = across ? rules.belt.width : rules.belt.length;
    const onFloor = (x, y) => [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].every(([kx, ky]) => fitsMap(x + kx * w / 2, y + ky * h / 2, 0.3, map));
    const at = spot(0.6, 2, onFloor);
    if (at) add('belt', at, { w, h, dir: random() < 0.5 ? 1 : -1, offset: +(random() * rules.belt.cycle).toFixed(2), reach: Math.max(w, h) / 2 + 0.6 });
  }
  // The other factory devices (chapter 2). Each is dealt only when its count allows one, so chapter 1's draws stay as they were.
  const corners = (w, h, room = 0.3) => (x, y) => [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].every(([kx, ky]) => fitsMap(x + kx * w / 2, y + ky * h / 2, room, map));
  if (rules.press && counts.press[1] > 0) for (let i = between(counts.press, random); i > 0; i--) {
    const { w, h } = rules.press;
    add('press', spot(0.6, 2, corners(w + 0.6, h + 0.6)), { w, h, offset: +(random() * (rules.press.idle + rules.press.warn + rules.press.block)).toFixed(2), reach: w / 2 + 1 });
  }
  if (rules.laser && counts.laser[1] > 0) for (let i = between(counts.laser, random); i > 0; i--) {
    const half = rules.laser.gap / 2;
    add('laser', spot(0.5, 2, corners(rules.laser.gap + 0.6, 0.8)), { half, offset: +(random() * (rules.laser.off + rules.laser.warn + rules.laser.on)).toFixed(2), reach: half + 0.8 });
  }
  if (rules.steam && counts.steam[1] > 0) for (let i = between(counts.steam, random); i > 0; i--) {
    const r = rules.steam.radius;
    add('steam', spot(0.6, 1.5, corners(r * 2, r * 2 * 0.6)), { offset: +(random() * (rules.steam.idle + rules.steam.warn + rules.steam.burst)).toFixed(2), reach: r + 0.4 });
  }
  // A crane works the whole room from overhead; it is kept at the middle of the floor only so the save has a place for it.
  if (rules.crane && counts.crane[1] > 0) for (let i = between(counts.crane, random); i > 0; i--) add('crane', { x: width / 2, y: height / 2 }, { offset: +random().toFixed(2), reach: -100 });
  for (let i = between(counts.crate, random); i > 0; i--) add('crate', spot(rules.solidRoom, 1.2), { size: rules.crate.size, reach: 1 });
  // A music box the run promised is never left out: on a crowded floor it settles for less room round it.
  for (let i = between(counts.musicbox, random); i > 0; i--) add('musicbox', spot(rules.solidRoom, 2) || spot(rules.solidRoom, 0.8) || spot(0.6, 0.3), { size: rules.musicbox.size, reach: 1 });
  const strip = list => list.map(({ reach, ...h }) => h);
  let kept = keepPassable(map, strip(placed));
  // A crate taken out for closing the way gets another try somewhere else (2026-11-10: on the narrowed factory gate both
  // crates, and a laser door with them, used to go in half the runs).
  const crates = placed.filter(h => h.kind === 'crate').length;
  for (let tries = 0; tries < CRATE_RETRIES && kept.filter(h => h.kind === 'crate').length < crates; tries++) {
    const ids = new Set(kept.map(h => h.id));
    for (let i = placed.length - 1; i >= 0; i--) if (!ids.has(placed[i].id)) placed.splice(i, 1);
    const at = spot(rules.solidRoom, 1.2);
    if (!at) break;
    add('crate', at, { size: rules.crate.size, reach: 1 });
    kept = keepPassable(map, strip(placed));
  }
  return kept;
}

/**
 * Which fight rooms of a run hold a mending music box: exactly rules.musicboxesPerRun of them (slice.json hazards, or a
 * chapter's own), so one expedition is no luckier than the next, and never two rooms in a row. `fights` lists each fight
 * room as { node, range }: its place in the run and its music box count range after the ramp; any room whose range can
 * be above 0 may be picked, and the seed picks differently every run. Returns the chosen nodes, or null when the rules set no total.
 */
export function musicRooms(fights, rules, seed) {
  if (rules?.musicboxesPerRun === undefined) return null;
  const random = dealer(seed), open = fights.filter(f => f.range[1] > 0).map(f => f.node), want = Math.min(rules.musicboxesPerRun, open.length);
  let best = [];
  // Shuffle, keep each room not next to one already kept; a few shuffles always find enough apart on a 12-stop road.
  for (let tries = 0; tries < 20 && best.length < want; tries++) {
    const order = open.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const kept = [];
    for (const node of order) if (kept.length < want && kept.every(k => Math.abs(k - node) > 1)) kept.push(node);
    if (kept.length > best.length) best = kept;
  }
  return new Set(best);
}

/**
 * A floor narrow enough to be cut in two by a crate, a fence or a music box would leave the player walled off from the
 * fight or the portal (the narrow candy alley could). Solid pieces that close the way from the start to the portal and
 * every enemy spot are taken out again: first the one whose removal reopens it, else the last placed.
 */
export function keepPassable(map, hazards) {
  const goals = [map.portal, ...(map.enemySpawns || [])].filter(Boolean);
  if (!map.walkable || !map.size || !map.spawn || !goals.length) return hazards;
  const flow = new FlowField(map, map.size);
  const reached = (list, among) => {
    flow.setBlocks(list.filter(h => SOLID.has(h.kind)).map(hazardBox)); flow.update(map.spawn.x, map.spawn.y);
    return among.filter(p => { const cell = flow.nearestOpen(...flow.cell(p.x, p.y)); return cell && flow.steps[cell[1] * flow.cols + cell[0]] >= 0; });
  };
  // Only what the bare floor already reaches counts (2026-11-10): the flow grid is coarser than a body, and a narrow way to
  // the portal it cannot see through used to strip every crate from the room (the factory gate's second picture).
  const open = reached([], goals);
  const passable = list => reached(list, open).length === open.length;
  let list = hazards;
  while (!passable(list)) {
    const solids = list.map((h, i) => (SOLID.has(h.kind) ? i : -1)).filter(i => i >= 0);
    if (!solids.length) break;
    // The latest piece first: a crate set down last gives way before a laser door or a fence placed earlier (2026-11-10).
    const freeing = solids.slice().reverse().find(i => passable(list.filter((_, j) => j !== i)));
    list = list.filter((_, j) => j !== (freeing ?? solids.at(-1)));
  }
  return list;
}

/** Where a rail's saw is at `time`: it runs end to end and back. */
export function sawAt(h, time, speed) {
  const length = Math.hypot(h.dx, h.dy) * 2, phase = ((time * speed / length + h.offset) % 2 + 2) % 2, t = phase < 1 ? phase : 2 - phase;
  return { x: h.x - h.dx + 2 * h.dx * t, y: h.y - h.dy + 2 * h.dy * t };
}

/**
 * A belt at `time`: which way it carries (+1 or -1 along its length, flipped by ice to 0), whether it is about to turn
 * round (warn), and how fast it runs.
 */
export function beltState(h, time, rules) {
  const { cycle, warn, speed, windBoost } = rules;
  const phase = ((time + h.offset) % (cycle * 2) + cycle * 2) % (cycle * 2), flipped = phase >= cycle;
  const way = (flipped ? -1 : 1) * h.dir, frozen = h.frozenUntil > time;
  return { way: frozen ? 0 : way, frozen, warn: !frozen && (phase % cycle) >= cycle - warn, speed: frozen ? 0 : speed * (h.windUntil > time ? windBoost : 1) };
}
/** True when (x, y) lies on the belt's strip. */
export const onBelt = (h, x, y) => Math.abs(x - h.x) <= h.w / 2 && Math.abs(y - h.y) <= h.h / 2;

const cycleAt = (h, time, length) => { const run = time + h.offset; return { phase: ((run % length) + length) % length, n: Math.floor(run / length) }; };
/** A press at `time`: 'idle', 'warn' (shadow, red rim) or 'slam' (down on its plate, in the way); `n` counts its slams. */
export function pressState(h, time, { idle, warn, block }) {
  const { phase, n } = cycleAt(h, time, idle + warn + block);
  if (h.skipN === n) return { state: 'idle', n, phase: 0 };
  return { state: phase < idle ? 'idle' : phase < idle + warn ? 'warn' : 'slam', n, phase };
}
/** The press's cycle moved so that it slams now (lightning, sound). */
export function slamNow(h, time, { idle, warn, block }) {
  const { phase } = cycleAt(h, time, idle + warn + block);
  h.offset = +(h.offset + idle + warn - phase).toFixed(3); h.skipN = undefined; h.slamN = null;
}
/** A laser door at `time`: 'off', 'warn' (dashed) or 'on'; shorted out it stays off. `n` counts its beams. */
export function laserState(h, time, { off, warn, on }) {
  const { phase, n } = cycleAt(h, time, off + warn + on);
  if (h.downUntil > time) return { state: 'off', n };
  return { state: phase < off ? 'off' : phase < off + warn ? 'warn' : 'on', n };
}
/** The two lens posts of a laser door, as solid boxes. */
export const laserPosts = (h, post) => [-1, 1].map(k => ({ x: h.x + k * h.half - post / 2, y: h.y - post / 2, w: post, h: post }));
/** A steam pipe at `time`: 'idle', 'warn', 'burst' or 'frozen'; water cuts the burst short. `n` counts its bursts. */
export function steamState(h, time, r) {
  if (h.frozenUntil > time) return { state: 'frozen', n: -1 };
  const { phase, n } = cycleAt(h, time, r.idle + r.warn + r.burst), burst = h.wetUntil > time ? r.wetBurst : r.burst;
  return { state: phase < r.idle ? 'idle' : phase < r.idle + r.warn ? 'warn' : phase < r.idle + r.warn + burst ? 'burst' : 'idle', n };
}
/** Where a steam pipe's steam lands: under the nozzle, or carried off by wind for a moment. */
export const steamAt = (h, time) => (h.driftUntil > time ? { x: h.x + h.driftX, y: h.y + h.driftY } : { x: h.x, y: h.y });

/** A plate's state at `time`: 'cool', 'warn' (glowing, about to heat) or 'hot' (burns). */
export function plateState(h, time, { cycle, warn, hot }) {
  const phase = ((time + h.offset) % cycle + cycle) % cycle;
  return phase >= cycle - hot ? 'hot' : phase >= cycle - hot - warn ? 'warn' : 'cool';
}
