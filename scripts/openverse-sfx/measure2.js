(async () => {
  const q = '?m=' + Date.now();
  const [{ SFX }, { MOB2_CANDIDATES }, { REDO_CANDIDATES }, { BOSS2_CANDIDATES }, { CLOCK_CANDIDATES }] = await Promise.all(
    ['sfx', 'mob2-sound', 'redo-sound', 'boss2-sound', 'clock-sound'].map(n => import(`/src/audio/${n}.js${q}`)));
  const resolve = ([name, idx]) => name.startsWith('redo:') ? REDO_CANDIDATES[name.slice(5)]?.[idx]?.[1] : (CLOCK_CANDIDATES[name] || MOB2_CANDIDATES[name] || BOSS2_CANDIDATES[name])?.[idx]?.[1];
  // The same loudness proxy as ov_pick.py: RMS of the loudest 300 ms, averaged over three renders.
  async function loud(draw) {
    let sum = 0;
    for (let n = 0; n < 3; n++) {
      const ctx = new OfflineAudioContext(1, 44100 * 2.5, 44100), out = ctx.createGain(); out.connect(ctx.destination);
      draw(ctx, out);
      const data = (await ctx.startRendering()).getChannelData(0), win = 13230;
      let best = 0, acc = 0;
      for (let i = 0; i < data.length; i++) { acc += data[i] * data[i]; if (i >= win) acc -= data[i - win] * data[i - win]; if (i >= win - 1) best = Math.max(best, acc); }
      sum += Math.sqrt(best / win);
    }
    return sum / 3;
  }
  const ids = [...Object.keys(CLOCK_CANDIDATES).filter(k => !k.startsWith('boss-')), ...Object.keys(SFX).filter(k => k.startsWith('boss-tt') || k.startsWith('boss-bg'))];
  const out = {};
  for (const id of ids) { const s = SFX[id], d = s?.code && resolve(s.code); if (d) out[id] = +((await loud(d)) * s.volume).toFixed(5); }
  return JSON.stringify(out);
})()
