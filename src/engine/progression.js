import { chapterList, chapterOpen } from './chapters.js';

export function createProfile(data) {
  return { nickname: '', freeGears: 0, loadout: [], stats: Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, 0])), registered: false, potion: null, introRewardClaimed: false, firstReturnClaimed: false, combatClears: 0, playSeconds: 0, runs: 0, wins: 0, chapter: 1, bossRecords: [], blueprints: [], discoveredFusions: [], rewards: [], history: [], records: {}, cleared: [], chapterRecords: {}, settings: { reducedMotion: false, damageNumbers: true, sound: true, music: true, musicVolume: 0.6, cursorSize: 32, bindings: {}, controls: 'keys', mouseBindings: {}, arrowBindings: {} } };
}

/** Price of the next level of a stat that is currently at `rank`. */
export const statCost = (stat, rank) => stat.baseCost + stat.costStep * rank;

/**
 * The highest chapter whose stat levels are open: chapter 1, and each later chapter as soon as it opens (the chapter
 * before it beaten, and the chapter shown), whether or not it has been entered yet (2026-11-08: it used to wait for the
 * first step into the chapter). A save that already entered a chapter keeps its levels.
 */
export function openedChapter(data, profile, previews = false) {
  let level = profile.chapter || 1;
  for (const chapter of chapterList(data.slice)) if ((chapter.number || 1) > level && chapterOpen(data.slice, profile, chapter.id, previews)) level = chapter.number;
  return level;
}
/** The highest level any stat can reach now: ten levels for each chapter that is open. */
export function rankCap(data, profile, stat, previews = false) {
  return Math.min(stat.maxRank, data.slice.statChapters.ranksPerChapter * openedChapter(data, profile, previews));
}

/** Call when the player first sets foot in a chapter; it opens that chapter's stat levels. */
export function enterChapter(profile, chapter) {
  profile.chapter = Math.max(profile.chapter || 1, chapter);
}

export function permanentStats(data, profile) {
  return Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, profile.stats[stat.id] * stat.perRank]));
}

export function buyRank(data, profile, statId, previews = false) {
  const stat = data.slice.permanentStats.find(s => s.id === statId);
  if (!stat || profile.stats[statId] >= rankCap(data, profile, stat, previews)) return false;
  const cost = statCost(stat, profile.stats[statId]);
  if (profile.freeGears < cost) return false;
  profile.freeGears -= cost;
  profile.stats[statId]++;
  return true;
}

export function refundAll(data, profile) {
  let refund = 0;
  for (const stat of data.slice.permanentStats) {
    for (let rank = 0; rank < profile.stats[stat.id]; rank++) refund += statCost(stat, rank);
    profile.stats[stat.id] = 0;
  }
  profile.freeGears += refund;
  return refund;
}
