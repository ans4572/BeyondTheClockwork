import { readFile } from 'node:fs/promises';
import { Game, distance } from '../src/engine/game.js';
import { FlowField } from '../src/engine/flow-field.js';
import { plateState, sawAt } from '../src/engine/hazards.js';
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));

/** Deterministic input bot. Uses the same public actions as the UI; no stat or damage cheats. */
/** `loadout` picks the two elements; `stats` sets permanent tuning ranks by id, as a returning player would have them. */
/** `chapter` and `difficulty` pick the expedition (chapter 2 needs previews, as on the dev server). */
export function playtest(seed = 123, maxSeconds = 600, { loadout = ['fire', 'ice'], stats = {}, chapter, difficulty, potion } = {}) {
  const game = new Game(data);
  if (chapter) { game.previews = true; game.unlockChapters = true; }
  game.s.mode = 'hub'; game.s.profile.registered = true; game.s.profile.loadout = [...loadout]; Object.assign(game.s.profile.stats, stats); if (potion) game.s.profile.potion = potion; game.startRun(seed, difficulty, chapter);
  const roomSeconds = [], hurtBy = {}, entryHp = {}; let roomStart = 0, lastNode = -1, lastHp = game.p.hp;
  let tick = 0, stuckFrames = 0, previous = { ...game.p };
  const routes = {};
  while (tick++ < maxSeconds * 60 && !['complete', 'returned'].includes(game.s.mode)) {
    // Per room: how long it took; per source: how much health the bot lost to it (a boss pattern, or 'other').
    const node = game.s.run?.node ?? -1;
    if (node !== lastNode) { entryHp[node + 1] = Math.round(100 * game.p.hp / game.p.maxHp); if (lastNode >= 0) roomSeconds.push([lastNode + 1, Math.round(game.s.time - roomStart)]); lastNode = node; roomStart = game.s.time; }
    if (game.p.hp < lastHp) { const b = game.s.enemies.find(e => e.boss && e.hp > 0), src = b ? (b.breaking ? `break:${b.breaking.kind}` : b.tell?.type || (game.s.bossFields || []).filter(f => !f.done).map(f => f.kind).join('+') || 'boss-other') : 'room'; hurtBy[src] = Math.round((hurtBy[src] || 0) + lastHp - game.p.hp); }
    lastHp = game.p.hp;
    if (game.s.mode === 'reward') {
      const options = game.s.run.rewardChoices;
      const preference = option => option.kind === 'element' ? (game.slots.length < 2 ? ({ fire: 100, ice: 90, lightning: 80, water: 76, sound: 74, wind: 70 })[option.id] ?? 60 : -1) : option.kind === 'upgrade' ? ({ maxHp: 65, basicDamage: 60, damageReduction: 64, fusionGuard: 57, fusionDamage: 56, energyGain: 48, attackSpeed: 58, killHeal: 52, skillCooldownReduction: 50, critChance: 45, statusDamage: 40, moveSpeed: 32, dodgeCooldownReduction: 30 })[option.id] : option.kind === 'skillMod' ? 62 : option.kind === 'trait' ? 58 : option.kind === 'mod' ? 60 : option.kind === 'level' ? 55 : option.kind === 'heal' ? (game.p.hp < game.p.maxHp * 0.5 ? 90 : 20) : 0;
      const index = options.map((option, index) => ({ index, weight: preference(option) })).sort((a, b) => b.weight - a.weight)[0].index;
      game.chooseReward(index, 0); continue;
    }
    if (game.s.mode === 'route') { game.nextNode(0); continue; }
    if (game.s.mode === 'shop') { game.buyShop('heal'); game.nextNode(); continue; }
    if (game.s.mode === 'merchant') { game.buyShop('heal'); game.buyShop('skillLevel'); game.leaveMerchant(); continue; }
    if (game.s.mode === 'unwind') { game.unwind(); continue; }
    const boss = game.s.enemies.find(e => e.boss && e.hp > 0), now = game.s.time, tellType = boss?.tell?.type;
    // The bot obeys the boss's warnings the way a player reading them would.
    if (tellType === 'bell' || boss?.bellUntil > now) { game.update(1 / 60, {}); continue; }
    if (tellType === 'carpet') {
      const [[ax, ay], [bx, by]] = game.marchLanes(boss, true)[boss.tell.safe], t = Math.max(0, Math.min(1, ((game.p.x - ax) * (bx - ax) + (game.p.y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      const angle = Math.atan2(ay + (by - ay) * t - game.p.y, ax + (bx - ax) * t - game.p.x), near = Math.hypot(ay + (by - ay) * t - game.p.y, ax + (bx - ax) * t - game.p.x) < 0.5;
      game.update(1 / 60, near ? {} : { x: Math.cos(angle), y: Math.sin(angle) }); continue;
    }
    if (tellType === 'crane') {
      const drop = boss.tell.drops.reduce((a, b) => distance(game.p, a) < distance(game.p, b) ? a : b), angle = Math.atan2(game.p.y - drop.y, game.p.x - drop.x) + 0.01;
      game.update(1 / 60, distance(game.p, drop) < 2 ? { x: Math.cos(angle), y: Math.sin(angle) } : {}); continue;
    }
    if (boss?.breaking) {
      const b = boss.breaking, near = target => distance(game.p, target);
      const walk = (target, stop) => { const go = Math.atan2(target.y - game.p.y, target.x - game.p.x), far = near(target) > stop; return { x: far ? Math.cos(go) : 0, y: far ? Math.sin(go) : 0 }; };
      if (b.kind === 'cans') {
        const spot = { x: boss.x + Math.cos(b.angle) * 2.2, y: boss.y + Math.sin(b.angle) * 2.2 }, can = b.cans.filter(c => !c.back).sort((m, n) => near(m) - near(n))[0];
        game.update(1 / 60, { ...walk(spot, 0.4), aim: can || boss, basic: !!can && near(can) < 1.9 }); continue;
      }
      if (b.kind === 'drums') {
        // Step out of a coming lane first; otherwise walk to the next drum in the order and strike it.
        const lane = b.lanes.find(l => Math.abs(game.p.x - l.x) < 1.4);
        if (lane) { game.update(1 / 60, { x: game.p.x < lane.x ? -1 : 1, y: 0 }); continue; }
        const drum = b.phase === 'play' ? b.drums[b.order[b.next]] : null;
        game.update(1 / 60, drum ? { ...walk(drum, 1.1), aim: drum, basic: near(drum) < 1.5 } : {}); continue;
      }
      if (b.kind === 'flags') {
        const flag = b.soldiers.filter(s => s.flag && !s.down).sort((m, n) => near(m) - near(n))[0];
        game.update(1 / 60, flag ? { ...walk(flag, 1.0), aim: flag, basic: near(flag) < 1.6 } : {}); continue;
      }
    }
    // ---- Chapter 2 (2026-11-09): Iris's and Press's warnings and breaks, read the way a player reading them would.
    const fields = (game.s.bossFields || []).filter(f => !f.done), go = (target, stop = 0.3) => { const dx = target.x - game.p.x, dy = target.y - game.p.y, d2 = Math.hypot(dx, dy); return d2 > stop ? { x: dx / d2, y: dy / d2 } : { x: 0, y: 0 }; };
    // Iris's sweeping beam in the mirror break: dodge across it just before it reaches the bot (2026-11-10).
    if (boss?.breaking?.kind === 'mirrors') { const b = boss.breaking, me = Math.atan2(game.p.y - boss.y, game.p.x - boss.x), ahead = Math.atan2(Math.sin(me - b.sweep), Math.cos(me - b.sweep)); if (ahead > 0 && ahead < 0.45 && !game.p.dodge) { game.update(1 / 60, { dodge: true, x: Math.cos(me + Math.PI / 2), y: Math.sin(me + Math.PI / 2) }); continue; } }
    if (boss?.breaking?.kind === 'mirrors') { const m = boss.breaking.mirrors.find(m => !m.aimed && !m.lit); game.update(1 / 60, m ? { ...go({ x: m.x - 1, y: m.y }, 0.2), aim: m, basic: distance(game.p, m) < 1.5 } : { x: 0, y: 1 }); continue; }
    if (boss?.breaking?.kind === 'pylons') { const py = boss.breaking.pylons.find(p => !p.broken); game.update(1 / 60, py ? go({ x: py.x + 0.9, y: py.y }, 0.15) : {}); continue; }
    if (boss?.breaking?.kind === 'molds') { const f = fields.find(f => f.kind === 'molds'), same = f?.molds.find(m => m.shape.same); game.update(1 / 60, same ? go(same, 0.2) : {}); continue; }
    const rhythm = fields.find(f => f.kind === 'rhythm');
    // The lanes touch (no gaps between them since 2026-11-10): stand in the nearest lane the next beat leaves out, one the beat after leaves out too if it can.
    if (rhythm) { const next = [].concat(rhythm.order[rhythm.next] ?? []), after = [].concat(rhythm.order[rhythm.next + 1] ?? []), cost = i => (next.includes(i) ? 100 : 0) + (after.includes(i) ? 3 : 0) + Math.abs(rhythm.lanes[i] - game.p.x) / rhythm.lw, best = rhythm.lanes.map((_, i) => i).sort((a, b) => cost(a) - cost(b))[0], x = rhythm.lanes[best]; const near = boss && distance(game.p, boss) < 1.6 + boss.radius; game.update(1 / 60, { ...go({ x, y: game.p.y }, 0.15), aim: boss, basic: near && Math.abs(game.p.x - x) < 0.3 }); continue; }
    const crane = fields.find(f => f.kind === 'crane' && f.phase !== 'carry');
    if (crane && distance(game.p, crane) < 2.2) { const away = Math.atan2(game.p.y - crane.y, game.p.x - crane.x); game.update(1 / 60, { x: Math.cos(away), y: Math.sin(away), dodge: game.p.grabbed?.crane }); continue; }
    if (game.p.grabbed?.crane) { game.update(1 / 60, { dodge: true }); continue; }
    const valves = fields.find(f => f.kind === 'valves');
    if (valves && (boss?.pressure >= 75 || boss?.tell?.type === 'steamBurst')) { const v = [...valves.valves].sort((a, b) => distance(game.p, a) - distance(game.p, b))[0], open = v.openUntil > game.s.time + 1.5; game.update(1 / 60, { ...go({ x: v.x - (open ? 0 : 1), y: v.y + (open ? 0.6 : 0) }, 0.2), aim: v, basic: !open && distance(game.p, v) < 1.5 }); continue; }
    const grid = fields.find(f => f.kind === 'grid');
    if (grid) { const a = Math.PI / 4 + (grid.safe[1] + 0.5) * Math.PI / 2, r = (grid.radii[0] + grid.radii[1]) / 2; game.update(1 / 60, go({ x: grid.cx + Math.cos(a) * r, y: grid.cy + Math.sin(a) * r * 0.55 }, 0.2)); continue; }
    const stamp = fields.filter(f => f.kind === 'stamp' && !f.pass).sort((a, b) => distance(game.p, a) - distance(game.p, b))[0];
    if (stamp && Math.hypot(game.p.x - stamp.x, (game.p.y - stamp.y) / 0.55) < stamp.radius + 0.6) { const away = Math.atan2(game.p.y - stamp.y, game.p.x - stamp.x); game.update(1 / 60, { x: Math.cos(away), y: Math.sin(away) }); continue; }
    const walls = fields.find(f => f.kind === 'walls');
    if (walls && (game.p.x < walls.left + 0.8 || game.p.x > walls.right - 0.8)) { game.update(1 / 60, go({ x: walls.cx, y: game.p.y }, 0.3)); continue; }
    if (tellType === 'finalPress' && boss.tell.safe && boss.tell.until - now < 2.5) { game.update(1 / 60, go(boss.tell.safe, 0.3)); continue; }
    if (tellType === 'twoRows' && boss.tell.rows) { const safe = boss.tell.rows.find(r => r.safe); game.update(1 / 60, go({ x: game.p.x, y: safe.y }, 0.2)); continue; }
    if (tellType === 'decoys') { game.update(1 / 60, { ...go(boss, 1.2), aim: boss, basic: distance(game.p, boss) < 1.6 + boss.radius }); continue; }
    // A body already charging at the bot (a dash after its tell): step off its line, dodge through when it is close (2026-11-10).
    { const runner = game.s.enemies.find(e => e.hp > 0 && e.dash && (() => { const dx = game.p.x - e.x, dy = game.p.y - e.y, along = dx * Math.cos(e.dash.angle) + dy * Math.sin(e.dash.angle), side = Math.abs(-dx * Math.sin(e.dash.angle) + dy * Math.cos(e.dash.angle)); return along > -0.3 && along < 4 && side < (e.radius || 0.5) + 0.9; })()); if (runner) { const dx = game.p.x - runner.x, dy = game.p.y - runner.y, s = -dx * Math.sin(runner.dash.angle) + dy * Math.cos(runner.dash.angle) >= 0 ? 1 : -1, a2 = runner.dash.angle + s * Math.PI / 2; game.update(1 / 60, { x: Math.cos(a2), y: Math.sin(a2), dodge: Math.hypot(dx, dy) < 1.6 }); continue; } }
    // Stomp rings: dodge through one that is about to reach the player.
    const ring = game.s.casts.find(c => c.shape === 'stompRing' && c.age >= 0 && !c.passed && distance(game.p, c) - c.age * c.speed > 0 && distance(game.p, c) - c.age * c.speed < 0.9);
    if (ring) { game.update(1 / 60, { dodge: true, x: Math.cos(Math.atan2(game.p.y - ring.y, game.p.x - ring.x)), y: Math.sin(Math.atan2(game.p.y - ring.y, game.p.x - ring.x)) }); continue; }
    // A rank of soldiers about to reach the bot: dodge through it, the way it walks (Brass's parade and column ranks).
    const calm = !(boss?.alarmUntil > now), line = game.rankLines?.find(l => { const { start, end } = l.rank, h = Math.atan2(end[0][1] - start[0][1], end[0][0] - start[0][0]); return Math.abs((game.p.x - l.a[0]) * Math.cos(h) + (game.p.y - l.a[1]) * Math.sin(h)) < 1.1; });
    if (line) {
      const { start, end } = line.rank, heading = Math.atan2(end[0][1] - start[0][1], end[0][0] - start[0][0]);
      game.update(1 / 60, { x: Math.cos(heading), y: Math.sin(heading), dodge: true }); continue;
    }
    const enemies = game.s.enemies.filter(e => e.hp > 0), target = enemies.sort((a, b) => distance(game.p, a) - distance(game.p, b))[0];
    if (!target) { game.update(1 / 60, {}); continue; }
    const d = distance(game.p, target), angle = Math.atan2(target.y - game.p.y, target.x - game.p.x);
    // Enemies wait spread over the map, so the bot walks the floor to them the way they would walk to it.
    // A crate about to go off or a plate about to burn is stepped away from first, as a player would.
    const rules = game.config.hazards, fire = (game.s.hazards || []).find(h => !h.gone && ((h.kind === 'crate' && h.fuseAt !== undefined && distance(game.p, h) < rules.crate.radius + 0.6)
      || (h.kind === 'plate' && plateState(h, game.s.time, rules.plate) !== 'cool' && Math.abs(game.p.x - h.x) / h.half + Math.abs(game.p.y - h.y) / (h.depth ?? rules.plate.depth) <= 1.3)
      || (h.kind === 'rail' && distance(game.p, sawAt(h, game.s.time, rules.rail.speed)) < 1.3)));
    if (fire) { const from = fire.kind === 'rail' ? sawAt(fire, game.s.time, rules.rail.speed) : fire, away = Math.atan2(game.p.y - from.y, game.p.x - from.x); game.update(1 / 60, { x: Math.cos(away), y: Math.sin(away) }); continue; }
    const map = game.map, route = map?.walkable && d > 1.5 ? (routes[map.id] ??= new FlowField(map, map.size)) : null;
    route?.setBlocks(game.obstacles); route?.update(target.x, target.y);
    // Against a wall the bot's own cell may be too tight to map; the nearest open cell gives the way instead.
    const open = route && route.nearestOpen(...route.cell(game.p.x, game.p.y)), way = route && (route.heading(game.p.x, game.p.y) ?? (open && (() => {
      // Wedged where the grid has no way (a side step off a charge can end in a notch of the wall): walk to that open cell first.
      const ox = (open[0] + 0.5) * 0.5, oy = (open[1] + 0.5) * 0.5;
      return Math.hypot(ox - game.p.x, oy - game.p.y) > 0.2 ? Math.atan2(oy - game.p.y, ox - game.p.x) : route.heading(ox, oy);
    })()));
    let move = d > 1.3 ? way ?? angle : angle + Math.PI / 2, speed = d > 1.3 ? 1 : 0;
    let dodge = false;
    // A player reads a tell from as far as that enemy can reach, not from a fixed distance.
    const danger = enemies.find(e => e.tell && e.tell.until - game.s.time < 0.28 && (e.boss || distance(game.p, e) < Math.max(4, (e.attackRange || 0) + (e.burstRadius || 0) + 1)));
    // A swing plants the feet, so the bot does not start one while a nearby enemy is about to strike.
    const windingUp = enemies.some(e => e.tell && e.tell.until - game.s.time < 0.6 && (e.boss || distance(game.p, e) < Math.max(4, (e.attackRange || 0) + (e.burstRadius || 0) + 1)));
    if (danger) {
      const type = danger.tell.type;
      move = type === 'overcharge' || type === 'doubleWave' || type === 'eliteWave' || type === 'magnet' || type === 'suction' || type === 'chargeHorn' ? Math.atan2(game.p.y - danger.tell.y, game.p.x - danger.tell.x) : danger.tell.angle + Math.PI / 2;
      if (type === 'march') move = Math.PI;
      // A swing or a burst is stepped back from, not sidestepped inside its reach.
      if (type === 'melee' || type === 'burst') move = Math.atan2(game.p.y - danger.y, game.p.x - danger.x);
      if (type === 'ambush') move = Math.atan2(game.p.y - danger.tell.targetY, game.p.x - danger.tell.targetX);
      // Stickers land where the player stands: step off to the side.
      if (type === 'stickers') move = danger.tell.angle + Math.PI / 2;
      speed = 1; dodge = danger.tell.until - game.s.time < 0.13;
    }
    if (tick % 30 === 0) {
      stuckFrames = distance(game.p, previous) < 0.15 && d > 2 ? stuckFrames + 30 : 0;
      previous = { ...game.p };
    }
    // Still stuck half a second later, it tries the next quarter turn.
    if (stuckFrames >= 30) move += Math.PI / 2 * (stuckFrames / 30);
    game.update(1 / 60, { x: Math.cos(move) * speed, y: Math.sin(move) * speed, aim: target, basic: !danger && !windingUp && calm && d < 1.6 + (target.radius || 0), dodge, skill: calm ? tick % 4 : undefined, skillHeld: calm ? [0, 1, 2, 3] : [], fusion: calm });
  }
  const boss = game.s.enemies?.find(e => e.boss);
  return { roomSeconds, hurtBy, entryHp, bossLeft: boss ? Math.round(100 * Math.max(0, boss.hp) / boss.maxHp) : null, seed, mode: game.s.mode, node: game.s.run ? game.s.run.node + 1 : game.s.result?.node, seconds: Math.round(game.s.run?.elapsed || game.s.result?.elapsed || 0), hp: Math.round(game.p.hp), damageTaken: Math.round(game.s.run?.damageTaken || game.s.result?.damageTaken || 0), baseGears: game.s.run?.baseGears || game.s.result?.baseGears || 0, upgrades: game.s.profile.stats };
}
if (process.argv[1]?.endsWith('playtest.mjs')) {
  const seeds = process.argv.slice(2).map(Number);
  for (const seed of seeds.length ? seeds : [123, 44, 9813]) console.log(JSON.stringify(playtest(seed)));
}
