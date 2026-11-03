// Element sounds built from filtered noise and simple tones, so wind sounds like moving air and fire like flame,
// not like a game-console chirp; also the failed-run horn. Each recipe draws into `out` (a gain node) starting now; all levels are relative.

let whiteNoise = null;
function noise(audio) {
  if (!whiteNoise) {
    whiteNoise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const d = whiteNoise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource(); source.buffer = whiteNoise; source.loop = true;
  source.loopStart = Math.random(); return source;
}
/** Rise, hold, then fade away. */
function envelope(param, start, attack, hold, release, peak) {
  param.setValueAtTime(0.0001, start);
  param.linearRampToValueAtTime(peak, start + attack);
  param.setValueAtTime(peak, start + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  return start + attack + hold + release;
}
function filtered(audio, out, type, frequency, q, { at = 0, attack, hold = 0, release, peak }) {
  const start = audio.currentTime + at, source = noise(audio), filter = audio.createBiquadFilter(), gain = audio.createGain();
  filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
  const end = envelope(gain.gain, start, attack, hold, release, peak);
  source.connect(filter).connect(gain).connect(out); source.start(start); source.stop(end + 0.05);
  return filter;
}

/** Air pushed past: a band of noise that sweeps in pitch as it swells and fades. */
function gust(audio, out, { dur, from, to, q = 1, attack = 0.3, peak = 1, at = 0 }) {
  const filter = filtered(audio, out, 'bandpass', from, q, { at, attack: dur * attack, release: dur * (1 - attack), peak });
  filter.frequency.setValueAtTime(from, audio.currentTime + at);
  filter.frequency.exponentialRampToValueAtTime(to, audio.currentTime + at + dur);
}
/** Air going round: the band wobbles up and down a few times a second. */
function swirl(audio, out, { dur, center, depth, rate, peak = 1 }) {
  const filter = filtered(audio, out, 'bandpass', center, 2.5, { attack: dur * 0.35, release: dur * 0.65, peak });
  const lfo = audio.createOscillator(), amount = audio.createGain();
  lfo.frequency.value = rate; amount.gain.value = depth; lfo.connect(amount).connect(filter.frequency);
  lfo.start(); lfo.stop(audio.currentTime + dur + 0.05);
}
/** Flame and rumble: low-passed noise. */
function roar(audio, out, { dur, cutoff, attack = 0.08, peak = 1, at = 0 }) {
  filtered(audio, out, 'lowpass', cutoff, 0.7, { at, attack: Math.min(attack, dur / 2), release: dur - Math.min(attack, dur / 2), peak });
}
/** Hiss of steam or frost: high-passed noise. */
function hiss(audio, out, { dur, cutoff = 3500, attack = 0.03, peak = 1 }) {
  filtered(audio, out, 'highpass', cutoff, 0.7, { attack, release: dur - attack, peak });
}
/** Embers popping or sparks jumping: many tiny bright clicks at random moments. */
function crackle(audio, out, { dur, count, low = 1500, high = 4500, peak = 1 }) {
  for (let i = 0; i < count; i++) filtered(audio, out, 'bandpass', low + Math.random() * (high - low), 3, { at: Math.random() * dur, attack: 0.002, release: 0.02 + Math.random() * 0.03, peak: peak * (0.4 + Math.random() * 0.6) });
}
/** The crack at the front of a lightning strike. */
function snap(audio, out, { peak = 1 } = {}) { filtered(audio, out, 'highpass', 2500, 0.7, { attack: 0.002, release: 0.08, peak }); }
/** Weight under a blast: a falling tone. */
function thump(audio, out, { from, to, dur, peak = 1 }) {
  const osc = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime;
  osc.frequency.setValueAtTime(from, start); osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  envelope(gain.gain, start, 0.005, 0, dur, peak); osc.connect(gain).connect(out); osc.start(); osc.stop(start + dur + 0.05);
}
/** Electric hum: a buzzy tone that flutters. */
function buzz(audio, out, { dur, freq, peak = 1 }) {
  const osc = audio.createOscillator(), flutter = audio.createOscillator(), depth = audio.createGain(), filter = audio.createBiquadFilter(), gain = audio.createGain(), start = audio.currentTime;
  osc.type = 'sawtooth'; osc.frequency.value = freq; flutter.type = 'square'; flutter.frequency.value = 37; depth.gain.value = 0.5;
  filter.type = 'highpass'; filter.frequency.value = 600;
  envelope(gain.gain, start, 0.01, dur * 0.4, dur * 0.6, peak); flutter.connect(depth).connect(gain.gain);
  osc.connect(filter).connect(gain).connect(out); osc.start(); flutter.start(); osc.stop(start + dur + 0.05); flutter.stop(start + dur + 0.05);
}

/** A toy horn note: a buzzy tone through a soft filter, with a wobble that deepens on long notes. */
function horn(audio, out, { at, freq, dur, bend = 1, wobble = 0, peak = 1 }) {
  const start = audio.currentTime + at, osc = audio.createOscillator(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, start); osc.frequency.exponentialRampToValueAtTime(freq * bend, start + dur);
  filter.type = 'lowpass'; filter.frequency.setValueAtTime(1400, start); filter.frequency.exponentialRampToValueAtTime(500, start + dur); filter.Q.value = 2;
  if (wobble) { const lfo = audio.createOscillator(), depth = audio.createGain(); lfo.frequency.value = 6; depth.gain.setValueAtTime(0, start); depth.gain.linearRampToValueAtTime(freq * wobble, start + dur * 0.4); lfo.connect(depth).connect(osc.frequency); lfo.start(start); lfo.stop(start + dur + 0.05); }
  const end = envelope(gain.gain, start, 0.03, dur * 0.7, dur * 0.3, peak);
  osc.connect(filter).connect(gain).connect(out); osc.start(start); osc.stop(end + 0.05);
}

export const ELEMENT_SOUNDS = {
  // A failed run: the "wah, wah, wah, waaah" of a deflating toy horn, each note lower, the last one sagging and wobbling.
  sadHorn: (a, o) => { horn(a, o, { at: 0, freq: 233, dur: 0.38, bend: 0.97, peak: 0.8 }); horn(a, o, { at: 0.42, freq: 220, dur: 0.38, bend: 0.97, peak: 0.8 }); horn(a, o, { at: 0.84, freq: 208, dur: 0.38, bend: 0.97, peak: 0.8 }); horn(a, o, { at: 1.26, freq: 196, dur: 1.2, bend: 0.85, wobble: 0.03, peak: 0.9 }); },
  // Fire
  heatSwing: (a, o) => { roar(a, o, { dur: 0.4, cutoff: 900, attack: 0.05, peak: 0.9 }); gust(a, o, { dur: 0.35, from: 300, to: 1100, q: 0.8, peak: 0.5 }); crackle(a, o, { dur: 0.45, count: 8, peak: 0.5 }); },
  exhaustBurst: (a, o) => { thump(a, o, { from: 95, to: 35, dur: 0.5, peak: 0.9 }); roar(a, o, { dur: 0.75, cutoff: 650, attack: 0.01, peak: 1 }); crackle(a, o, { dur: 0.8, count: 14, peak: 0.45 }); },
  // Lightning
  conductiveSpanner: (a, o) => { snap(a, o, { peak: 0.6 }); buzz(a, o, { dur: 0.3, freq: 110, peak: 0.35 }); crackle(a, o, { dur: 0.3, count: 12, low: 3000, high: 7000, peak: 0.6 }); },
  capacitorStrike: (a, o) => { snap(a, o, { peak: 1 }); crackle(a, o, { dur: 0.25, count: 20, low: 2500, high: 7000, peak: 0.7 }); roar(a, o, { dur: 1.1, cutoff: 220, attack: 0.03, peak: 1 }); thump(a, o, { from: 70, to: 30, dur: 0.8, peak: 0.6 }); },
  // Wind
  pressureDash: (a, o) => { gust(a, o, { dur: 0.34, from: 450, to: 2000, q: 1.1, attack: 0.25, peak: 1 }); roar(a, o, { dur: 0.3, cutoff: 350, attack: 0.05, peak: 0.35 }); },
  vortexIntake: (a, o) => { swirl(a, o, { dur: 1.0, center: 650, depth: 350, rate: 6, peak: 1 }); roar(a, o, { dur: 1.0, cutoff: 260, attack: 0.3, peak: 0.45 }); },
  // Ice: a breath of frost under the glass recordings
  frostHiss: (a, o) => hiss(a, o, { dur: 0.6, cutoff: 4500, attack: 0.04, peak: 0.6 }),
  // Fusions
  steamShatter: (a, o) => { hiss(a, o, { dur: 1.0, cutoff: 2800, attack: 0.02, peak: 0.8 }); thump(a, o, { from: 110, to: 40, dur: 0.4, peak: 0.7 }); },
  arcFurnace: (a, o) => { snap(a, o, { peak: 0.8 }); roar(a, o, { dur: 0.9, cutoff: 900, attack: 0.05, peak: 0.9 }); crackle(a, o, { dur: 0.9, count: 22, low: 2000, high: 6500, peak: 0.6 }); buzz(a, o, { dur: 0.6, freq: 90, peak: 0.25 }); },
  fireCyclone: (a, o) => { swirl(a, o, { dur: 1.0, center: 500, depth: 280, rate: 5, peak: 0.9 }); roar(a, o, { dur: 1.0, cutoff: 800, attack: 0.15, peak: 0.8 }); crackle(a, o, { dur: 1.0, count: 12, peak: 0.45 }); },
  magneticIceClamp: (a, o) => { buzz(a, o, { dur: 0.8, freq: 80, peak: 0.4 }); hiss(a, o, { dur: 0.7, cutoff: 4500, attack: 0.05, peak: 0.4 }); crackle(a, o, { dur: 0.6, count: 10, low: 3000, high: 7000, peak: 0.4 }); },
  frostCrosscut: (a, o) => { gust(a, o, { dur: 0.42, from: 2600, to: 600, q: 1.8, attack: 0.15, peak: 1 }); hiss(a, o, { dur: 0.5, cutoff: 5000, attack: 0.02, peak: 0.4 }); },
  stormFloat: (a, o) => { swirl(a, o, { dur: 0.95, center: 900, depth: 450, rate: 8, peak: 0.8 }); crackle(a, o, { dur: 0.95, count: 26, low: 2500, high: 7000, peak: 0.6 }); }
};
