import { chapterList, chapterOpen } from './chapters.js';

export function createProfile(data) {
  return { nickname: '', freeGears: 0, loadout: [], stats: Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, 0])), wrenchLevel: 1, registered: false, potion: null, introRewardClaimed: false, firstReturnClaimed: false, combatClears: 0, playSeconds: 0, runs: 0, wins: 0, chapter: 1, bossRecords: [], blueprints: [], discoveredFusions: [], rewards: [], history: [], records: {}, cleared: [], chapterRecords: {}, settings: { reducedMotion: false, damageNumbers: true, sound: true, music: true, musicVolume: 0.6, cursorSize: 32, bindings: {}, controls: 'keys', mouseBindings: {}, arrowBindings: {} } };
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

/**
 * One level of a stat back to free gears, at what that level cost (review 2026-11-24: a misclick could only be undone by
 * refunding the whole board). Like the full refund it is free. Returns the gears given back, 0 when there was no level.
 */
export function refundRank(data, profile, statId) {
  const stat = data.slice.permanentStats.find(s => s.id === statId);
  if (!stat || !(profile.stats[statId] > 0)) return 0;
  profile.stats[statId]--;
  const refund = statCost(stat, profile.stats[statId]);
  profile.freeGears += refund;
  return refund;
}

/**
 * The wrench's enhancement (2026-11-25, slice.json wrenchEnhance): meant for those who have finished the tuning board, so
 * it gives little for its price, but open from the start, apart from the board (2026-11-26: Moru's own choice and panel).
 * The wrench starts at level 1; each step up costs free gears whether it takes or not, and a step that fails leaves the
 * level where it was. The gears spent are never refunded.
 */
export const wrenchLevel = profile => profile.wrenchLevel || 1;
/** The next step from `level`: its price, its chance and the attack it adds. Null at the top level. */
export function wrenchStep(data, level) {
  const rule = data.slice.wrenchEnhance;
  if (level >= rule.maxLevel) return null;
  return { cost: rule.baseCost + rule.costStep * (level - 1), chance: rule.chances[level - 1], attackDamage: rule.attackDamage[level - 1] };
}
/** Attack the wrench's level adds, on the same sum as the tuning board's attack. */
export function wrenchAttack(data, level) {
  return data.slice.wrenchEnhance.attackDamage.slice(0, Math.max(0, level - 1)).reduce((a, b) => a + b, 0);
}
/** One try at the next level with `roll` in [0, 1): 'success', 'fail', or false when it cannot be tried (nothing is spent). */
export function enhanceWrench(data, profile, roll) {
  const step = wrenchStep(data, wrenchLevel(profile));
  if (!step || profile.freeGears < step.cost) return false;
  profile.freeGears -= step.cost;
  if (roll >= step.chance) return 'fail';
  profile.wrenchLevel = wrenchLevel(profile) + 1;
  return 'success';
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
