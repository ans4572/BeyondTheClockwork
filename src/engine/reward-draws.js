/**
 * The reward cards after a room: drawing them by tier, rerolling one, and taking the chosen one. Installed on
 * Game.prototype (game.js), so `this` is the game.
 */
export const rewardDraws = {
  rarity() {
    let roll = this.random();
    for (const [key, weight] of Object.entries(this.c.balance.baseRewardRarityWeights)) { roll -= weight; if (roll <= 0) return key; }
    return 'common';
  },
  sample(list, count) {
    const pool = [...list], picked = [];
    while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return picked;
  },
  /** Skill mods and traits for what is equipped now; owned ones leave the pool. */
  buildRewards() {
    const run = this.s.run, elements = this.slots.map(slot => slot.element), skills = this.c.skills.filter(s => elements.includes(s.element)).map(s => s.id);
    return [
      ...this.config.skillMods.filter(m => skills.includes(m.skill) && !run.skillMods?.some(id => this.config.skillMods.find(o => o.id === id)?.skill === m.skill)).map(m => ({ kind: 'skillMod', id: m.id })),
      ...this.config.elementTraits.filter(t => elements.includes(t.element) && !run.traits?.includes(t.id)).map(t => ({ kind: 'trait', id: t.id }))
    ];
  },
  /** Every reward card has a tier: common, rare or special. */
  rewardTier(reward) {
    const { rules, mods, skillMods, elementTraits, rewards } = this.config;
    if (reward.kind === 'mod') return mods.find(m => m.id === reward.id).tier;
    if (reward.kind === 'skillMod') return skillMods.find(m => m.id === reward.id).tier;
    if (reward.kind === 'trait') return elementTraits.find(t => t.id === reward.id).tier;
    if (reward.kind === 'perk') return this.config.perks.find(perk => perk.id === reward.id).tier;
    if (reward.kind === 'upgrade') return rewards[reward.id].tier;
    if (reward.kind === 'heal') return rules.healRewards.find(h => h.id === reward.id).tier;
    if (reward.kind === 'gears') return rules.gearReward.tier;
    return reward.kind === 'level' ? rules.skillLevelTier : 'common';
  },
  /** Rolls a tier by weight, then a card of that tier; a tier with nothing left falls back to any card. */
  drawByTier(pool) {
    let roll = this.random(), tier = 'common';
    for (const [key, weight] of Object.entries(this.config.rules.rewardTierWeights)) { roll -= weight; if (roll <= 0) { tier = key; break; } }
    const same = pool.filter(reward => this.rewardTier(reward) === tier);
    return this.sample(same.length ? same : pool, 1)[0];
  },
  /** Run parts not yet maxed, skill levels below the cap, and repairs while the body is damaged. */
  partRewards() {
    const run = this.s.run, elements = this.slots.map(s => s.element);
    const parts = this.c.balance.temporaryUpgrades.filter(u => (run.upgrades[u.id] || 0) < u.maxRank && (u.id !== 'skillCooldownReduction' || elements.length) && (u.id !== 'statusDamage' || elements.includes('fire'))).map(u => ({ kind: 'upgrade', id: u.id }));
    const levels = this.slots.map((slot, i) => slot.level < this.c.balance.skillMaxLevel ? { kind: 'level', id: i } : null).filter(Boolean);
    const repairs = this.p.hp < this.p.maxHp ? this.config.rules.healRewards.map(h => ({ kind: 'heal', id: h.id })) : [];
    const perks = (this.config.perks || []).filter(perk => !run.perks?.includes(perk.id)).map(perk => ({ kind: 'perk', id: perk.id }));
    return [...parts, ...levels, ...repairs, ...perks, { kind: 'gears', amount: this.config.rules.gearReward.amount }];
  },
  offerRewards() {
    const run = this.s.run;
    if (!run.rewardChoices.length) {
      let choices = [];
      if (this.room.guaranteedMod && run.mods.length < this.data.progression.run.wrenchModsMax) { const pool = this.config.mods.filter(m => !run.mods.includes(m.id)).map(m => ({ kind: 'mod', id: m.id })); while (choices.length < 3 && pool.length) choices.push(pool.splice(pool.indexOf(this.drawByTier(pool)), 1)[0]); }
      else {
        // One card always grows the equipped build; the rest come from parts, levels and repairs, drawn by tier.
        const build = this.buildRewards();
        choices = this.sample(build, 1);
        const pool = [...build.filter(reward => reward !== choices[0]), ...this.partRewards()];
        while (choices.length < 3 && pool.length) choices.push(pool.splice(pool.indexOf(this.drawByTier(pool)), 1)[0]);
      }
      run.rewardChoices = choices.slice(0, 3);
      this.sense({ kind: 'cards' });
    }
    this.s.mode = 'reward';
  },
  /**
   * Each of the three cards can be drawn again once per reward screen. The new card comes from the same draw as a fresh
   * offer (its slot's rules: the first card grows the build) and is never a card already on the table.
   */
  rerollRewardCard(index) {
    const run = this.s.run;
    if (this.s.mode !== 'reward' || !run || !run.rewardChoices[index] || run.rerolledCards?.[index]) return false;
    const key = reward => `${reward.kind}:${reward.id ?? reward.amount}`, taken = new Set(run.rewardChoices.map(key)), kept = run.rewardChoices;
    let pick = null;
    for (let tries = 0; tries < 12 && !pick; tries++) {
      run.rewardChoices = []; this.offerRewards();
      const fresh = run.rewardChoices;
      pick = fresh[index] && !taken.has(key(fresh[index])) ? fresh[index] : fresh.find(reward => !taken.has(key(reward))) || null;
    }
    run.rewardChoices = kept;
    (run.rerolledCards ??= [])[index] = true;
    if (pick) run.rewardChoices[index] = pick;
    return !!pick;
  },
  chooseReward(index, replacement = null) {
    if (this.s.mode !== 'reward') return false;
    const run = this.s.run, reward = run.rewardChoices[index];
    if (!reward) return false;
    if (reward.kind === 'element') {
      if (this.slots.some(s => s.element === reward.id)) return false;
      if (this.slots.length >= 2 && ![0, 1].includes(replacement)) return false;
      const slot = { element: reward.id, level: 1, rarity: reward.rarity };
      if (this.slots.length < 2) run.slots.push(slot);
      else { slot.level = run.slots[replacement].level; run.slots[replacement] = slot; }
    }
    if (reward.kind === 'upgrade') {
      run.upgrades[reward.id] = (run.upgrades[reward.id] || 0) + 1;
      if (reward.id === 'maxHp') { const amount = this.c.balance.temporaryUpgrades.find(u => u.id === 'maxHp').perRank; this.p.maxHp += amount; this.heal(amount); }
    }
    if (reward.kind === 'level' && this.slots[reward.id]) this.slots[reward.id].level = Math.min(this.c.balance.skillMaxLevel, this.slots[reward.id].level + this.config.rules.skillLevelOffer);
    if (reward.kind === 'mod') { if (run.mods.length >= this.data.progression.run.wrenchModsMax || run.mods.includes(reward.id)) return false; run.mods.push(reward.id); }
    if (reward.kind === 'skillMod') (run.skillMods ??= []).push(reward.id);
    if (reward.kind === 'trait') (run.traits ??= []).push(reward.id);
    if (reward.kind === 'perk') {
      (run.perks ??= []).push(reward.id);
      const glass = this.perk('glassSpring');
      if (reward.id === 'glassSpring') { this.p.maxHp = Math.max(1, this.p.maxHp - glass.maxHpLoss); this.p.hp = Math.min(this.p.hp, this.p.maxHp); }
    }
    if (reward.kind === 'heal') this.heal(this.config.rules.healRewards.find(h => h.id === reward.id).amount);
    if (reward.kind === 'gears') this.s.profile.freeGears += Math.round(reward.amount * (1 + (this.stats.gearGain || 0)));
    // The pick, in order, for the pause menu's 이번 원정 tab: the stop it was taken at and what it was.
    (run.picks ??= []).push({ node: run.node, kind: reward.kind, id: reward.id ?? null, amount: reward.amount ?? null, rarity: reward.rarity ?? null, element: reward.kind === 'level' ? this.slots[reward.id]?.element ?? null : null });
    run.rewardChoices = []; run.rerolledCards = []; this.sense({ kind: 'pick' });
    if (run.node === this.rooms.length - 1) this.finishChapter();
    // After the last street before the boss a travelling merchant waits once, so the coins of the second half have a use.
    else if (this.room.id === (this.chapter.merchantAfterRoom ?? this.config.rules.merchantAfterRoom) && !run.merchantMet) { this.s.mode = 'merchant'; run.merchantMet = true; run.merchantBought = []; }
    else this.s.mode = 'route';
    this.save(); return true;
  },
};
