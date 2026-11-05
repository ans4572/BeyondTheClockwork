// Each run deals its own fights. A room's waves in slice.json are its designed difficulty, not a fixed list:
// every run keeps each wave's weight (the sum of its enemies' health) and its elites, and draws a new mix
// of the room's enemy kinds around them, with a theme (a rush of fast ones, a shield wall, a band behind guns)
// and a way of arriving (spread out, from one side, from two sides, all round the player).

/** What each kind does in a fight, for themes and for where it stands in a formation. */
export const ROLES = {
  front: ['guard', 'pikeman', 'nutcracker', 'spintop'],
  fast: ['rat', 'rabbit', 'jackbox'],
  back: ['trumpet', 'musicbox', 'drummer']
};
const roleOf = type => Object.keys(ROLES).find(role => ROLES[role].includes(type)) || 'front';
/** The most of one kind in a wave: support and tricky kinds stay rare so a wave never turns into a wall of guns. */
const MOST = { drummer: 1, spintop: 1, musicbox: 2, jackbox: 2, trumpet: 3, nutcracker: 3 };
/** Each theme's pull toward a role; 1 is no preference. */
const THEMES = {
  mixed: { front: 1, fast: 1, back: 1 },
  rush: { front: 0.4, fast: 3, back: 0.3 },
  wall: { front: 3, fast: 0.5, back: 0.8 },
  battery: { front: 1.2, fast: 0.4, back: 2.6 }
};
/** How the first wave stands in the room, and how later waves arrive. */
export const OPENINGS = ['spread', 'camps'];
export const ARRIVALS = ['spread', 'flank', 'pincer', 'ring'];
/** How far a wave's weight may drift from the designed one. */
const WEIGHT_SLACK = 0.12;
const TOTAL = [15, 24];
/** How far from the player a side group, and a ring, gathers: far enough that a wave still gives a moment to turn. */
const ARRIVAL_REACH = 10.5, RING_REACH = 9;

/** A small seeded generator, separate from the game's own, so dealing fights never shifts any other roll. */
export function dealer(seed) {
  let n = (seed ^ 0x9e3779b9) >>> 0 || 1;
  return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; n >>>= 0; return n / 4294967296; };
}
const pick = (list, random) => list[Math.floor(random() * list.length)];
function weighted(entries, random) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, w] of entries) if ((roll -= w) <= 0) return value;
  return entries[entries.length - 1][0];
}

/** One wave: the designed wave's weight and elites, a fresh mix of `pool` around them. */
export function dealWave(template, pool, hp, random, size = template.length) {
  const elites = template.filter(type => type === 'elite');
  const budget = template.reduce((sum, type) => sum + hp[type], 0);
  const kinds = pool.filter(type => type !== 'elite');
  const themes = Object.keys(THEMES).filter(theme => theme === 'mixed' || kinds.some(type => THEMES[theme][roleOf(type)] > 1));
  const theme = pick(themes, random), pull = THEMES[theme];
  const wave = [...elites];
  const room = type => (MOST[type] ?? Infinity) > wave.filter(t => t === type).length;
  while (wave.length < size) {
    const open = kinds.filter(room);
    if (!open.length) break;
    wave.push(weighted(open.map(type => [type, pull[roleOf(type)]]), random));
  }
  // Bring the weight back near the design by swapping one body at a time for a heavier or lighter kind.
  const weight = () => wave.reduce((sum, type) => sum + hp[type], 0);
  for (let tries = 0; tries < 40; tries++) {
    const w = weight(), heavy = w > budget * (1 + WEIGHT_SLACK), light = w < budget * (1 - WEIGHT_SLACK);
    if (!heavy && !light) break;
    const swappable = wave.map((type, i) => [type, i]).filter(([type]) => type !== 'elite');
    if (!swappable.length) break;
    const [type, i] = swappable.sort((a, b) => (heavy ? hp[b[0]] - hp[a[0]] : hp[a[0]] - hp[b[0]]))[0];
    wave.splice(i, 1);
    const swaps = kinds.filter(other => (heavy ? hp[other] < hp[type] : hp[other] > hp[type]) && room(other));
    wave.splice(i, 0, swaps.length ? pick(swaps, random) : type);
    if (!swaps.length) break;
  }
  return { wave: shuffle(wave, random), theme };
}
function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

/**
 * The fights for one room in one run: { waves, themes, formations }. The pool is the room's own kinds plus the
 * kinds met in the room before it, so a room keeps its character and new kinds still arrive where they are introduced.
 */
export function dealRoom(room, before, hp, random) {
  const own = [...new Set(room.waves.flat())], earlier = before?.waves ? [...new Set(before.waves.flat())] : [];
  const pool = [...new Set([...own, ...earlier])];
  // Sizes drift by one body a wave, kept inside the game's room limits.
  const sizes = room.waves.map(w => w.length + Math.floor(random() * 3) - 1);
  let total = sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; total < TOTAL[0]; i = (i + 1) % sizes.length) { sizes[i]++; total++; }
  for (let i = 0; total > TOTAL[1]; i = (i + 1) % sizes.length) { sizes[i]--; total--; }
  const dealt = room.waves.map((template, i) => dealWave(template, pool, hp, random, Math.max(3, sizes[i])));
  return {
    waves: dealt.map(d => d.wave),
    themes: dealt.map(d => d.theme),
    formations: dealt.map((_, i) => pick(i === 0 ? OPENINGS : ARRIVALS, random))
  };
}

/**
 * Traits for each elite of a room's waves: `affixes[wave][body]` is null or a list like [{ id: 'coated', element: 'ice' }].
 * `count` traits each, all different.
 */
export function dealAffixes(waves, count, list, random) {
  return waves.map(wave => wave.map(type => {
    if (type !== 'elite' || !count) return null;
    const open = [...list], traits = [];
    while (traits.length < count && open.length) {
      const trait = open.splice(Math.floor(random() * open.length), 1)[0];
      traits.push(trait.elements ? { id: trait.id, element: pick(trait.elements, random) } : { id: trait.id });
    }
    return traits;
  }));
}

/** Every combat room of a run, in route order; rooms without waves get null. `affixes` is slice.json's eliteAffixes. */
export function dealRun(rooms, enemies, seed, affixes) {
  const random = dealer(seed), hp = Object.fromEntries(Object.entries(enemies).map(([type, e]) => [type, e.hp]));
  const ids = rooms.map(room => room.id), one = affixes ? ids.indexOf(affixes.oneFrom) : -1;
  let before = null;
  return rooms.map((room, i) => {
    if (!room.waves) return null;
    const dealt = dealRoom(room, before, hp, random);
    // One trait per elite at most: two at once read as clutter and the second rarely changed how the fight played.
    const count = one >= 0 && i >= one ? 1 : 0;
    if (count) dealt.affixes = dealAffixes(dealt.waves, count, affixes.list, random);
    before = room;
    return dealt;
  });
}

/**
 * Where each body of a wave stands. `ctx` gives the floor test (`fits(x, y)`), the player, the floor size,
 * the game's random and a fallback (`spread()`) for any body the formation cannot place.
 */
export function formationSpots(kind, types, ctx) {
  const { fits, player, size: [width, height], random, spread } = ctx;
  const taken = [];
  const free = spot => fits(spot.x, spot.y) && taken.every(other => Math.hypot(spot.x - other.x, spot.y - other.y) >= 1.4);
  const near = (centre, reach, away = 0) => {
    for (let tries = 0; tries < 24; tries++) {
      const angle = random() * Math.PI * 2, r = reach * Math.sqrt(random());
      const spot = { x: centre.x + Math.cos(angle) * r + (centre.dx || 0) * away, y: centre.y + Math.sin(angle) * r + (centre.dy || 0) * away };
      if (free(spot)) return spot;
    }
    return null;
  };
  /** A point `reach` units from the player along `angle`, walked in until it stands on the floor. */
  const along = (angle, reach) => {
    for (let r = reach; r >= 5; r -= 0.5) {
      const spot = { x: player.x + Math.cos(angle) * r, y: player.y + Math.sin(angle) * r };
      if (fits(spot.x, spot.y)) return { ...spot, dx: Math.cos(angle), dy: Math.sin(angle) };
    }
    return null;
  };
  const place = (type, centre) => {
    // Guns and drums stand a little behind the others, on the side away from the player.
    const spot = centre && near(centre, 2.2, roleOf(type) === 'back' ? 1.6 : 0);
    const chosen = spot || spread(taken);
    taken.push(chosen); return chosen;
  };
  if (kind === 'flank' || kind === 'pincer') {
    const base = random() * Math.PI * 2;
    const sides = (kind === 'pincer' ? [base, base + Math.PI] : [base]).map(angle => along(angle, ARRIVAL_REACH));
    return types.map((type, i) => place(type, sides[i % sides.length]));
  }
  if (kind === 'ring') {
    const turn = random() * Math.PI * 2;
    return types.map((type, i) => {
      const spot = along(turn + (Math.PI * 2 * i) / types.length, roleOf(type) === 'back' ? RING_REACH + 1.5 : RING_REACH);
      const chosen = spot && free(spot) ? { x: spot.x, y: spot.y } : spread(taken);
      taken.push(chosen); return chosen;
    });
  }
  if (kind === 'camps') {
    const camps = Array.from({ length: types.length > 5 ? 3 : 2 }, () => {
      for (let tries = 0; tries < 30; tries++) {
        const spot = { x: 1 + random() * (width - 2), y: 1 + random() * (height - 2) };
        if (fits(spot.x, spot.y) && Math.hypot(spot.x - player.x, spot.y - player.y) >= 7) return spot;
      }
      return null;
    });
    return types.map((type, i) => place(type, camps[i % camps.length]));
  }
  return types.map(() => { const spot = spread(taken); taken.push(spot); return spot; });
}

/** A line for the screen when a wave arrives in a shape worth warning about. */
export const ARRIVAL_NOTES = { flank: '한쪽에서 몰려온다!', pincer: '양쪽에서 협공한다!', ring: '사방을 에워싼다!' };
