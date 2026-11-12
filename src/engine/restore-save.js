// A save rebuilt by hand on the admin page (2026-11-12) for a player who lost their device: the owner sets the tuning
// board, the elements, the bosses beaten and the chapters cleared, and this makes a save the game loads like any other.
import { Game } from './game.js';
import { encodeSave } from './storage.js';
import { chapterList, chapterRooms } from './chapters.js';

/** The record each boss leaves on its first defeat (the same as Game.unwind). */
export const BOSS_BLUEPRINTS = { captainBrass: 'patrolBlueprint', inspectorIris: 'assemblyRecord', directorPress: 'selfTuningBlueprint' };

/** What the restore form offers: the tuning board's stats, the elements, and each chapter with its bosses. */
export function restoreOptions(data) {
  const names = Object.fromEntries([...(data.combat.bosses || []), ...(data.combat.enemies || [])].map(e => [e.id, e.name]));
  return {
    ranksPerChapter: data.slice.statChapters.ranksPerChapter,
    stats: data.slice.permanentStats.map(s => ({ id: s.id, name: s.name, maxRank: s.maxRank })),
    elements: data.slice.elements.map(id => ({ id, name: data.combat.elements.find(e => e.id === id)?.name || id })),
    chapters: chapterList(data.slice).map(c => ({ id: c.id, number: c.number || 1, name: c.name,
      bosses: [...new Set(chapterRooms(data.slice, c.id).filter(r => r.boss).map(r => r.boss))].map(id => ({ id, name: names[id] || id })) }))
  };
}

/**
 * The save for these choices, as the game stores it: registered, in the village, the tutorial behind it.
 * choice: { nickname, freeGears, stats: { id: rank }, owned: [element ids], bosses: [boss ids], cleared: [chapter ids],
 * runs, playSeconds }. Ranks are held to what the chapters opened allow (ten for each), as the board itself would.
 */
export function buildRestoreSave(data, choice = {}) {
  const options = restoreOptions(data), game = new Game(data), profile = game.s.profile;
  game.s.mode = 'registration'; game.register();
  const chapters = options.chapters, cleared = chapters.filter(c => (choice.cleared || []).includes(c.id)).map(c => c.id);
  // The highest chapter open: the first, and each one after a cleared one.
  let opened = 1;
  for (const c of chapters) if (c.number > opened && cleared.includes(chapters.find(p => p.number === c.number - 1)?.id)) opened = c.number;
  const cap = options.ranksPerChapter * opened, whole = (value, top) => Math.max(0, Math.min(top, Math.floor(Number(value) || 0)));
  const owned = options.elements.map(e => e.id).filter(id => (choice.owned || []).includes(id));
  const bossIds = chapters.flatMap(c => c.bosses.map(b => b.id)), bosses = bossIds.filter(id => (choice.bosses || []).includes(id));
  Object.assign(profile, {
    nickname: String(choice.nickname || '').slice(0, 12),
    freeGears: whole(choice.freeGears, 10_000_000),
    stats: Object.fromEntries(options.stats.map(s => [s.id, whole(choice.stats?.[s.id], Math.min(s.maxRank, cap))])),
    ownedElements: owned, loadout: owned.slice(0, 2),
    bossRecords: bosses, blueprints: bosses.map(id => BOSS_BLUEPRINTS[id]).filter(Boolean),
    cleared, chapter: opened,
    runs: whole(choice.runs, 1_000_000), wins: cleared.length, playSeconds: whole(choice.playSeconds, 1e9),
    introRewardClaimed: true, firstReturnClaimed: true
  });
  return encodeSave(game.s);
}
