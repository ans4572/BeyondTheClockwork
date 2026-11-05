// The things lying about every fight room, Hades-style: crates that blow up, floor plates that heat up, a saw running
// along its rail, pairs of wooden fences to hide behind and a music box that mends. They are not fixed to a map:
// every run places its own set on each room's floor (seeded, so a resumed run finds them where they were).
import { fitsMap } from './map-geometry.js';
import { dealer } from './encounters.js';
import { FlowField } from './flow-field.js';

/** Kinds that bodies and shots cannot pass through. */
export const SOLID = new Set(['crate', 'fence', 'musicbox']);
/** Kinds drawn flat on the floor, under everyone. */
export const GROUND = new Set(['plate', 'rail']);

const between = ([low, high], random) => low + Math.floor(random() * (high - low + 1));

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
export function dealHazards(map, rules, seed, step = Infinity, amount = 1) {
  const random = dealer(seed), placed = [], [width, height] = map.size;
  // The expedition's difficulty scales how many pieces of each kind a room gets (slice.json difficulty.levels[].scale).
  const ramp = rules.ramp?.[step], counts = Object.fromEntries(Object.entries({ ...rules.counts, ...ramp?.counts }).map(([kind, [low, high]]) => [kind, [Math.round(low * amount), Math.round(high * amount)]]));
  const railChance = Math.min(1, (ramp?.railChance ?? rules.rail.chance) * amount);
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
  for (let i = between(counts.crate, random); i > 0; i--) add('crate', spot(rules.solidRoom, 1.2), { size: rules.crate.size, reach: 1 });
  for (let i = between(counts.musicbox, random); i > 0; i--) add('musicbox', spot(rules.solidRoom, 2), { size: rules.musicbox.size, reach: 1 });
  return keepPassable(map, placed.map(({ reach, ...h }) => h));
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
  const passable = list => {
    flow.setBlocks(list.filter(h => SOLID.has(h.kind)).map(hazardBox)); flow.update(map.spawn.x, map.spawn.y);
    return goals.every(p => { const cell = flow.nearestOpen(...flow.cell(p.x, p.y)); return cell && flow.steps[cell[1] * flow.cols + cell[0]] >= 0; });
  };
  let list = hazards;
  while (!passable(list)) {
    const solids = list.map((h, i) => (SOLID.has(h.kind) ? i : -1)).filter(i => i >= 0);
    if (!solids.length) break;
    const freeing = solids.find(i => passable(list.filter((_, j) => j !== i)));
    list = list.filter((_, j) => j !== (freeing ?? solids.at(-1)));
  }
  return list;
}

/** Where a rail's saw is at `time`: it runs end to end and back. */
export function sawAt(h, time, speed) {
  const length = Math.hypot(h.dx, h.dy) * 2, phase = ((time * speed / length + h.offset) % 2 + 2) % 2, t = phase < 1 ? phase : 2 - phase;
  return { x: h.x - h.dx + 2 * h.dx * t, y: h.y - h.dy + 2 * h.dy * t };
}

/** A plate's state at `time`: 'cool', 'warn' (glowing, about to heat) or 'hot' (burns). */
export function plateState(h, time, { cycle, warn, hot }) {
  const phase = ((time + h.offset) % cycle + cycle) % cycle;
  return phase >= cycle - hot ? 'hot' : phase >= cycle - hot - warn ? 'warn' : 'cool';
}
