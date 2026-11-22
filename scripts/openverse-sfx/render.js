(async () => {
  // Render one chapter 3 recipe (window.__rid) to a 16-bit mono WAV, peak 0.9, trailing silence cut; returns base64.
  const { CLOCK_CANDIDATES } = await import(`/src/audio/clock-sound.js?r=${window.__rstamp}`);
  const ctx = new OfflineAudioContext(1, 44100 * 3, 44100), out = ctx.createGain(); out.connect(ctx.destination);
  CLOCK_CANDIDATES[window.__rid][0][1](ctx, out);
  const d = (await ctx.startRendering()).getChannelData(0);
  let peak = 0, end = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > peak * 0.001) { end = Math.min(d.length, i + 2205); break; }
  const n = end, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), g = 0.9 / (peak || 1);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i] * g)) * 32767, true);
  let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(s);
})()
