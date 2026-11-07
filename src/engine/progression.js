export function createProfile(data) {
  return { nickname: '', freeGears: 0, loadout: [], stats: Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, 0])), registered: false, introRewardClaimed: false, firstReturnClaimed: false, combatClears: 0, playSeconds: 0, runs: 0, wins: 0, chapter: 1, bossRecords: [], blueprints: [], discoveredFusions: [], rewards: [], history: [], records: {}, cleared: [], chapterRecords: {}, settings: { reducedMotion: false, damageNumbers: true, sound: true, music: true, musicVolume: 0.6, bindings: {}, controls: 'keys', mouseBindings: {} } };
}

/** Price of the next level of a stat that is currently at `rank`. */
export const statCost = (stat, rank) => stat.baseCost + stat.costStep * rank;

/** The highest level any stat can reach now: ten levels for each chapter the player has entered. */
export function rankCap(data, profile, stat) {
  return Math.min(stat.maxRank, data.slice.statChapters.ranksPerChapter * (profile.chapter || 1));
}

/** Call when the player first sets foot in a chapter; it opens that chapter's stat levels. */
export function enterChapter(profile, chapter) {
  profile.chapter = Math.max(profile.chapter || 1, chapter);
}

export function permanentStats(data, profile) {
  return Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, profile.stats[stat.id] * stat.perRank]));
}

export function buyRank(data, profile, statId) {
  const stat = data.slice.permanentStats.find(s => s.id === statId);
  if (!stat || profile.stats[statId] >= rankCap(data, profile, stat)) return false;
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
