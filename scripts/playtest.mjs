import { readFile } from 'node:fs/promises';
import { Game, distance } from '../src/engine/game.js';
const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));

/** Deterministic input bot. Uses the same public actions as the UI; no stat or damage cheats. */
export function playtest(seed = 123, maxSeconds = 600) {
  const game = new Game(data);
  game.s.mode = 'hub'; game.s.profile.registered = true; game.s.profile.loadout = ['fire', 'ice']; game.startRun(seed);
  let tick = 0, stuckFrames = 0, previous = { ...game.p };
  while (tick++ < maxSeconds * 60 && !['complete', 'returned'].includes(game.s.mode)) {
    if (game.s.mode === 'reward') {
      const options = game.s.run.rewardChoices;
      const preference = option => option.kind === 'element' ? (game.slots.length < 2 ? ({ fire: 100, ice: 90, lightning: 80, wind: 70 })[option.id] : -1) : option.kind === 'upgrade' ? ({ maxHp: 65, basicDamage: 60, skillCooldownReduction: 50, statusDamage: 40, dodgeCooldownReduction: 30 })[option.id] : option.kind === 'skillMod' ? 62 : option.kind === 'trait' ? 58 : option.kind === 'mod' ? 60 : option.kind === 'level' ? 55 : 0;
      const index = options.map((option, index) => ({ index, weight: preference(option) })).sort((a, b) => b.weight - a.weight)[0].index;
      game.chooseReward(index, 0); continue;
    }
    if (game.s.mode === 'route') { game.nextNode(0); continue; }
    if (game.s.mode === 'shop') { game.buyShop('heal'); game.nextNode(); continue; }
    if (game.s.mode === 'unwind') { game.unwind(); continue; }
    const enemies = game.s.enemies.filter(e => e.hp > 0), target = enemies.sort((a, b) => distance(game.p, a) - distance(game.p, b))[0];
    if (!target) { game.update(1 / 60, {}); continue; }
    const d = distance(game.p, target), angle = Math.atan2(target.y - game.p.y, target.x - game.p.x);
    let move = d > 1.3 ? angle : angle + Math.PI / 2, speed = d > 1.3 ? 1 : 0;
    let dodge = false;
    const danger = enemies.find(e => e.tell && e.tell.until - game.s.time < 0.28 && (e.boss || distance(game.p, e) < 4));
    if (danger) {
      const type = danger.tell.type;
      move = type === 'overcharge' || type === 'doubleWave' || type === 'eliteWave' || type === 'magnet' ? Math.atan2(game.p.y - danger.tell.y, game.p.x - danger.tell.x) : danger.tell.angle + Math.PI / 2;
      if (type === 'march') move = Math.PI;
      speed = 1; dodge = danger.tell.until - game.s.time < 0.13;
    }
    if (tick % 30 === 0) {
      stuckFrames = distance(game.p, previous) < 0.15 && d > 2 ? stuckFrames + 30 : 0;
      previous = { ...game.p };
    }
    if (stuckFrames >= 30) move += Math.PI / 2;
    game.update(1 / 60, { x: Math.cos(move) * speed, y: Math.sin(move) * speed, aim: target, basic: !danger, dodge, skill: tick % 4, fusion: true });
  }
  return { seed, mode: game.s.mode, node: game.s.run ? game.s.run.node + 1 : game.s.result?.node, seconds: Math.round(game.s.run?.elapsed || game.s.result?.elapsed || 0), hp: Math.round(game.p.hp), damageTaken: Math.round(game.s.run?.damageTaken || game.s.result?.damageTaken || 0), baseGears: game.s.run?.baseGears || game.s.result?.baseGears || 0, upgrades: game.s.profile.stats };
}
if (process.argv[1]?.endsWith('playtest.mjs')) {
  const seeds = process.argv.slice(2).map(Number);
  for (const seed of seeds.length ? seeds : [123, 44, 9813]) console.log(JSON.stringify(playtest(seed)));
}
