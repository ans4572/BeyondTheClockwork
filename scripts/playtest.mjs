import { readFile } from 'node:fs/promises';
import { Game, distance } from '../src/engine/game.js';
import { FlowField } from '../src/engine/flow-field.js';
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));

/** Deterministic input bot. Uses the same public actions as the UI; no stat or damage cheats. */
/** `loadout` picks the two elements; `stats` sets permanent tuning ranks by id, as a returning player would have them. */
export function playtest(seed = 123, maxSeconds = 600, { loadout = ['fire', 'ice'], stats = {} } = {}) {
  const game = new Game(data);
  game.s.mode = 'hub'; game.s.profile.registered = true; game.s.profile.loadout = [...loadout]; Object.assign(game.s.profile.stats, stats); game.startRun(seed);
  let tick = 0, stuckFrames = 0, previous = { ...game.p };
  const routes = {};
  while (tick++ < maxSeconds * 60 && !['complete', 'returned'].includes(game.s.mode)) {
    if (game.s.mode === 'reward') {
      const options = game.s.run.rewardChoices;
      const preference = option => option.kind === 'element' ? (game.slots.length < 2 ? ({ fire: 100, ice: 90, lightning: 80, wind: 70 })[option.id] : -1) : option.kind === 'upgrade' ? ({ maxHp: 65, basicDamage: 60, skillCooldownReduction: 50, statusDamage: 40, dodgeCooldownReduction: 30 })[option.id] : option.kind === 'skillMod' ? 62 : option.kind === 'trait' ? 58 : option.kind === 'mod' ? 60 : option.kind === 'level' ? 55 : option.kind === 'heal' ? (game.p.hp < game.p.maxHp * 0.5 ? 90 : 20) : 0;
      const index = options.map((option, index) => ({ index, weight: preference(option) })).sort((a, b) => b.weight - a.weight)[0].index;
      game.chooseReward(index, 0); continue;
    }
    if (game.s.mode === 'route') { game.nextNode(0); continue; }
    if (game.s.mode === 'shop') { game.buyShop('heal'); game.nextNode(); continue; }
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
    const calm = !(boss?.alarmUntil > now), line = game.columnLine;
    if (line) {
      const { start, end } = game.s.column, heading = Math.atan2(end[0][1] - start[0][1], end[0][0] - start[0][0]), ahead = (game.p.x - line.a[0]) * Math.cos(heading) + (game.p.y - line.a[1]) * Math.sin(heading);
      if (Math.abs(ahead) < 1.1) { game.update(1 / 60, { x: Math.cos(heading), y: Math.sin(heading), dodge: true }); continue; }
    }
    const enemies = game.s.enemies.filter(e => e.hp > 0), target = enemies.sort((a, b) => distance(game.p, a) - distance(game.p, b))[0];
    if (!target) { game.update(1 / 60, {}); continue; }
    const d = distance(game.p, target), angle = Math.atan2(target.y - game.p.y, target.x - game.p.x);
    // Enemies wait spread over the map, so the bot walks the floor to them the way they would walk to it.
    const map = game.map, route = map?.walkable && d > 3 ? (routes[map.id] ??= new FlowField(map, map.size)) : null;
    route?.update(target.x, target.y);
    // Against a wall the bot's own cell may be too tight to map; the nearest open cell gives the way instead.
    const open = route && route.nearestOpen(...route.cell(game.p.x, game.p.y)), way = route && (route.heading(game.p.x, game.p.y) ?? (open && route.heading((open[0] + 0.5) * 0.5, (open[1] + 0.5) * 0.5)));
    let move = d > 1.3 ? way ?? angle : angle + Math.PI / 2, speed = d > 1.3 ? 1 : 0;
    let dodge = false;
    // A player reads a tell from as far as that enemy can reach, not from a fixed distance.
    const danger = enemies.find(e => e.tell && e.tell.until - game.s.time < 0.28 && (e.boss || distance(game.p, e) < Math.max(4, (e.attackRange || 0) + (e.burstRadius || 0) + 1)));
    // A swing plants the feet, so the bot does not start one while a nearby enemy is about to strike.
    const windingUp = enemies.some(e => e.tell && e.tell.until - game.s.time < 0.6 && (e.boss || distance(game.p, e) < Math.max(4, (e.attackRange || 0) + (e.burstRadius || 0) + 1)));
    if (danger) {
      const type = danger.tell.type;
      move = type === 'overcharge' || type === 'doubleWave' || type === 'eliteWave' || type === 'magnet' ? Math.atan2(game.p.y - danger.tell.y, game.p.x - danger.tell.x) : danger.tell.angle + Math.PI / 2;
      if (type === 'march') move = Math.PI;
      // A swing or a burst is stepped back from, not sidestepped inside its reach.
      if (type === 'melee' || type === 'burst') move = Math.atan2(game.p.y - danger.y, game.p.x - danger.x);
      if (type === 'ambush') move = Math.atan2(game.p.y - danger.tell.targetY, game.p.x - danger.tell.targetX);
      speed = 1; dodge = danger.tell.until - game.s.time < 0.13;
    }
    if (tick % 30 === 0) {
      stuckFrames = distance(game.p, previous) < 0.15 && d > 2 ? stuckFrames + 30 : 0;
      previous = { ...game.p };
    }
    // Still stuck half a second later, it tries the next quarter turn.
    if (stuckFrames >= 30) move += Math.PI / 2 * (stuckFrames / 30);
    game.update(1 / 60, { x: Math.cos(move) * speed, y: Math.sin(move) * speed, aim: target, basic: !danger && !windingUp && calm && d < 1.6 + (target.radius || 0), dodge, skill: calm ? tick % 4 : undefined, fusion: calm });
  }
  return { seed, mode: game.s.mode, node: game.s.run ? game.s.run.node + 1 : game.s.result?.node, seconds: Math.round(game.s.run?.elapsed || game.s.result?.elapsed || 0), hp: Math.round(game.p.hp), damageTaken: Math.round(game.s.run?.damageTaken || game.s.result?.damageTaken || 0), baseGears: game.s.run?.baseGears || game.s.result?.baseGears || 0, upgrades: game.s.profile.stats };
}
if (process.argv[1]?.endsWith('playtest.mjs')) {
  const seeds = process.argv.slice(2).map(Number);
  for (const seed of seeds.length ? seeds : [123, 44, 9813]) console.log(JSON.stringify(playtest(seed)));
}
