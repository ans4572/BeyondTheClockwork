import { roomTitle } from './room-title.js';
import { cleanNickname } from './nickname.js';
export const SAVE_KEY = 'beyond-the-clockwork.vertical-slice.v1';
/** True once there is anything worth loading; a save still on the opening has none. */
export const hasProgress = state => !!state.profile.registered || state.profile.runs > 0 || state.mode !== 'opening';
/** What the title's continue button says about a save: where it stands and when it was written, e.g. "원정 · 장난감 진열대 · 오늘 14:20". */
export function saveSummary(state, savedAt, data, now = new Date()) {
  const RUN_MODES = ['combat', 'reward', 'route', 'shop', 'unwind', 'complete'];
  const room = state.run && data.slice.rooms[state.run.node];
  const place = room ? `원정 · ${roomTitle(room)}`
    : state.mode === 'practice' ? '연습장'
    : ['opening', 'intro', 'introDeath', 'registration'].includes(state.mode) ? '첫 장면'
    : RUN_MODES.includes(state.mode) ? '원정' : '웃음 마을';
  const at = savedAt ? new Date(savedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return place;
  const clock = `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
  const day = at.toDateString() === now.toDateString() ? '오늘' : `${at.getMonth() + 1}월 ${at.getDate()}일`;
  return `${place} · ${day} ${clock}`;
}
export function encodeSave(state) { return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }); }
const LEGACY_ROW_COSTS = { chassis: [20, 35, 55, 80, 110], strike: [20, 35, 55, 80, 110], repair: [30, 70, 130], safety: [120, 300] };

export function decodeSave(raw, data) {
  const save = JSON.parse(raw);
  if (save.version !== 1 || !save.state?.profile || !save.state?.player) throw new Error('지원하지 않거나 손상된 저장 파일입니다.');
  const s = save.state;
  const validNumber = value => Number.isFinite(value) && value >= 0;
  const integerIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const fail = message => { throw new Error(message); };
  if (!Number.isFinite(s.profile.freeGears) || s.profile.freeGears < 0 || !Array.isArray(s.profile.rewards)) throw new Error('저장 재화가 올바르지 않습니다.');
  // Saves from before the stat board get back every gear spent on the old tuning rows.
  if (s.profile.rows && !s.profile.stats) {
    for (const [id, costs] of Object.entries(LEGACY_ROW_COSTS)) {
      const rank = s.profile.rows[id]?.rank;
      if (!integerIn(rank ?? 0, 0, costs.length)) throw new Error('저장된 조율 단계가 올바르지 않습니다.');
      s.profile.freeGears += costs.slice(0, rank ?? 0).reduce((a, b) => a + b, 0);
    }
    delete s.profile.rows;
    s.profile.stats = Object.fromEntries(data.slice.permanentStats.map(stat => [stat.id, 0]));
  }
  for (const stat of data.slice.permanentStats) if (!integerIn(s.profile.stats?.[stat.id], 0, stat.maxRank)) throw new Error('저장된 스탯 레벨이 올바르지 않습니다.');
  const modes = ['opening', 'intro', 'introDeath', 'registration', 'hub', 'combat', 'reward', 'route', 'shop', 'unwind', 'complete', 'returned', 'practice'];
  if (!modes.includes(s.mode) || !Number.isFinite(s.time) || !Number.isFinite(s.player.hp) || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y)) throw new Error('저장된 게임 상태가 올바르지 않습니다.');
  if (!Array.isArray(s.enemies) || !Array.isArray(s.casts) || !Array.isArray(s.projectiles) || !Array.isArray(s.effects)) throw new Error('저장된 전투 상태가 올바르지 않습니다.');
  for (const key of ['notices']) if (!Array.isArray(s[key])) fail('저장된 알림 상태가 올바르지 않습니다.');
  for (const key of ['bossRecords', 'blueprints', 'discoveredFusions', 'history']) if (!Array.isArray(s.profile[key])) fail('저장된 영구 기록이 올바르지 않습니다.');
  for (const key of ['runs', 'wins', 'combatClears']) if (!integerIn(s.profile[key], 0, Number.MAX_SAFE_INTEGER)) fail('저장된 진행 기록이 올바르지 않습니다.');
  // Saves from before background music get it switched on at the default volume.
  if (s.profile.settings) { s.profile.settings.music ??= true; s.profile.settings.musicVolume ??= 0.6; }
  if (!s.profile.settings || !s.profile.settings.bindings || !['sound', 'damageNumbers', 'reducedMotion', 'music'].every(key => typeof s.profile.settings[key] === 'boolean') || !(s.profile.settings.musicVolume >= 0 && s.profile.settings.musicVolume <= 1)) fail('저장된 설정이 올바르지 않습니다.');
  // Saves from before chapters start in chapter 1.
  if (!Number.isInteger(s.profile.chapter) || s.profile.chapter < 1) s.profile.chapter = 1;
  // Older saves start their play clock at zero; a broken value is reset rather than refusing the save.
  if (!Number.isFinite(s.profile.playSeconds) || s.profile.playSeconds < 0) s.profile.playSeconds = 0;
  // The ledger name: older saves have none (called F2); anything odd in it is cleaned rather than refused.
  s.profile.nickname = cleanNickname(s.profile.nickname ?? '');
  s.profile.loadout ??= [];
  s.profile.ownedElements ??= [...s.profile.loadout];
  if (!Array.isArray(s.profile.ownedElements) || s.profile.ownedElements.some(id => !data.slice.elements.includes(id))) fail('저장된 속성 부품이 올바르지 않습니다.');
  if (!Array.isArray(s.profile.loadout) || s.profile.loadout.length > 2 || s.profile.loadout.some(id => !data.slice.elements.includes(id))) fail('저장된 속성 선택이 올바르지 않습니다.');
  const p = s.player;
  for (const key of ['hp', 'maxHp', 'energy', 'invulnerableUntil', 'dodgeReady', 'fusionReady']) if (!validNumber(p[key])) fail('저장된 플레이어 수치가 올바르지 않습니다.');
  if (p.maxHp <= 0 || p.hp > p.maxHp || p.energy > data.combat.player.maxEnergy || !p.cooldowns || !Object.values(p.cooldowns).every(validNumber)) fail('저장된 플레이어 수치가 범위를 벗어났습니다.');
  if (p.attack && (!integerIn(p.attack.phase, 0, 2) || !validNumber(p.attack.elapsed) || !Array.isArray(p.attack.hit))) fail('저장된 렌치 동작이 올바르지 않습니다.');
  // A run saved on an older route cannot resume on this one; permanent progress stays.
  if (s.run && s.run.plan?.length !== data.slice.rooms.length) { s.run = null; s.mode = 'hub'; s.enemies = []; s.casts = []; s.projectiles = []; s.effects = []; p.attack = null; p.dodge = null; p.lastCast = null; }
  const runModes = ['combat', 'reward', 'route', 'shop', 'unwind', 'complete'];
  if (runModes.includes(s.mode) !== !!s.run) fail('저장된 원정과 화면 상태가 일치하지 않습니다.');
  if (s.run) {
    // Runs saved before difficulties existed play on as the default; anything unknown is reset the same way.
    if (!(data.slice.difficulty?.levels || []).some(level => level.id === s.run.difficulty)) s.run.difficulty = data.slice.difficulty?.default || 'normal';
    const run = s.run;
    for (const slot of Array.isArray(run.slots) ? run.slots : []) if (Number.isInteger(slot?.level)) slot.level = Math.min(slot.level, data.combat.balance.skillMaxLevel);
    if (!integerIn(run.node, 0, data.slice.rooms.length - 1) || !Array.isArray(run.slots) || run.slots.length > 2) fail('저장된 원정이 올바르지 않습니다.');
    if (new Set(run.slots.map(slot => slot.element)).size !== run.slots.length || run.slots.some(slot => !data.slice.elements.includes(slot.element) || !integerIn(slot.level, 1, data.combat.balance.skillMaxLevel) || !Object.hasOwn(data.combat.balance.rarityDamage, slot.rarity))) fail('저장된 속성 슬롯이 올바르지 않습니다.');
    if (!Array.isArray(run.plan) || run.plan.length !== data.slice.rooms.length || run.plan.some((entry, i) => !integerIn(entry.layout, 0, data.slice.roomLayouts.length - 1) || !integerIn(entry.variant, 0, (data.slice.rooms[i].variants?.length || 1) - 1))) fail('저장된 원정 경로가 올바르지 않습니다.');
    if (!validNumber(run.coins) || !validNumber(run.elapsed) || !Array.isArray(run.clears) || !Array.isArray(run.shopBought) || !Array.isArray(run.mods) || !run.upgrades || !Array.isArray(run.rewardChoices)) fail('저장된 원정 보상이 올바르지 않습니다.');
    for (const reward of run.rewardChoices) {
      const valid = reward.kind === 'element' ? data.slice.elements.includes(reward.id) && Object.hasOwn(data.combat.balance.rarityDamage, reward.rarity)
        : reward.kind === 'mod' ? data.slice.mods.some(m => m.id === reward.id)
        : reward.kind === 'upgrade' ? data.combat.balance.temporaryUpgrades.some(u => u.id === reward.id)
        : reward.kind === 'skillMod' ? data.slice.skillMods.some(m => m.id === reward.id)
        : reward.kind === 'trait' ? data.slice.elementTraits.some(t => t.id === reward.id)
        : reward.kind === 'perk' ? (data.slice.perks || []).some(perk => perk.id === reward.id)
        : reward.kind === 'level' ? integerIn(reward.id, 0, run.slots.length - 1)
        : reward.kind === 'gears' && validNumber(reward.amount);
      if (!valid) fail('저장된 보상 선택지가 올바르지 않습니다.');
    }
  }
  if (s.enemies.some(enemy => ![...data.slice.bosses, ...Object.keys(data.slice.enemies)].includes(enemy.type) || !validNumber(enemy.hp) || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y) || !enemy.statuses || !Array.isArray(enemy.burnStacks))) fail('저장된 적 상태가 올바르지 않습니다.');
  if (s.mode === 'returned' && !s.result) fail('귀환 기록이 없습니다.');
  const aliases = Object.fromEntries(data.combat.fusions.flatMap(f => (f.legacyIds || []).map(id => [id, f.id])));
  s.profile.discoveredFusions = [...new Set(s.profile.discoveredFusions.map(id => aliases[id] || id))];
  // In-flight casts retain their serialized timing/shape until completion; cooldowns are preserved.
  s.paused = false;
  return s;
}
