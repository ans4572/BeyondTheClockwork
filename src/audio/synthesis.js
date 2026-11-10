// Per-play settings without changing a recipe's clock or sharing mutable pitch state.
export function voiceContext(audio, settings) {
  return new Proxy(audio, { get(target, key) {
    if (key in settings) return settings[key];
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

export const pitch = audio => audio.sfxPitch ?? 1;
export const attackTime = (audio, attack) => audio.sfxMenu ? attack : Math.max(audio.sfxAttack ?? 0.006, attack);

/** Bake short grains into one source, rather than allocating three nodes per droplet/spark.
 * Noise grains use a bandpass biquad; bubbles keep their rising sine glide. All times
 * are in seconds and the buffer length is rounded for Safari's integer sample count.
 */
export function grains(audio, out, events, wave = 'noise') {
  if (!events.length) return;
  const sr = audio.sampleRate, rise = attackTime(audio, 0.006), first = Math.min(...events.map(e => e.at));
  const length = Math.max(1, Math.ceil((Math.max(...events.map(e => e.at + e.dur)) - first + rise) * sr));
  const buffer = audio.createBuffer(1, length, sr), data = buffer.getChannelData(0);
  for (const { at, dur, freq, peak, q = 3, size = 1, rate = 0 } of events) {
    const start = Math.round((at - first) * sr), samples = Math.ceil((rise + dur) * sr);
    const f = Math.min(sr * 0.45, freq * pitch(audio)), w = 2 * Math.PI * f / sr;
    const alpha = Math.sin(w) / (2 * q), b0 = alpha / (1 + alpha), a1 = -2 * Math.cos(w) / (1 + alpha), a2 = (1 - alpha) / (1 + alpha);
    const fall = Math.log(0.0001 / Math.max(peak, 0.0002)) / dur;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, phase = 0;
    for (let i = 0; i < samples && start + i < length; i++) {
      const t = i / sr, env = t < rise ? t / rise : Math.exp(fall * (t - rise));
      let sample;
      if (wave !== 'noise') {
        sample = Math.sin(phase) * (rate ? 0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t) : 1);
        phase += wave === 'tone' ? w : w * Math.pow(1.6 + size * 0.4, Math.min(1, t / (0.03 * size)));
      } else {
        const x = Math.random() * 2 - 1;
        sample = b0 * (x - x2) - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = sample;
      }
      data[start + i] += sample * peak * env;
    }
  }
  const source = audio.createBufferSource(); source.buffer = buffer;
  source.connect(out); source.start(audio.currentTime + first);
}
