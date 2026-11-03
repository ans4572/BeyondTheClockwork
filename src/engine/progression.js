export function createProfile(data) {
  return { freeGears: 0, loadout: [], stats: Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, 0])), registered: false, introRewardClaimed: false, firstReturnClaimed: false, combatClears: 0, runs: 0, wins: 0, bossRecords: [], blueprints: [], discoveredFusions: [], rewards: [], history: [], settings: { reducedMotion: false, damageNumbers: true, sound: true, music: true, musicVolume: 0.6, bindings: {} } };
}

/** Price of the next level of a stat that is currently at `rank`. */
export const statCost = (stat, rank) => stat.baseCost + stat.costStep * rank;

/** The highest level any stat can reach now: one chapter's worth of levels, plus one more for each chapter boss beaten. */
export function rankCap(data, profile, stat) {
  const { ranksPerChapter, chapterBosses } = data.slice.statChapters;
  const cleared = chapterBosses.filter(boss => profile.bossRecords.includes(boss)).length;
  return Math.min(stat.maxRank, ranksPerChapter * (cleared + 1));
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
