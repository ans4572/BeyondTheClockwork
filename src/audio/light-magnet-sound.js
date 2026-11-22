// The light and magnet elements' sounds (2026-11-21): their four skills and thirteen fusions, built in code like
// clock-sound.js (noise strikes rung through resonators, a short room, `keep` for the long rings). sfx.js names the
// picks under `lm:<sound>` and sets their volumes; each plays once, when the skill or fusion is cast, so a recipe
// draws the whole of its action on the fusion's own clock (light-magnet.js, slice.json fusionBehavior).
// Light is white prism light: glass and crystal rung by a strike, bright air, sparkles. Magnet is copper coils and
// scrap iron: a mains hum rung out of noise, iron chunks and plates, clanks and rattles. Neither uses bare oscillators
// for its body, so they stay apart from fire's roar, ice's crackle, lightning's buzz, wind's rush and sound's brass.
import { band, thud } from './mob2-sound.js';
import { noise, whoosh } from './water-sound.js';
import { grains } from './synthesis.js';
import { keep, crack, body, debris, hall, STEEL, PLATE, ringFor } from './clock-sound.js';

// Modes as [ratio, level, seconds]: a cut crystal (nearly harmonic, long), thin glass, a scrap iron chunk (short, dull).
const CRYSTAL = [[1, 1, 1.4], [2.01, 0.32, 0.9], [2.93, 0.22, 0.6], [4.13, 0.1, 0.35]];
const GLASS = [[1, 1, 0.7], [2.32, 0.5, 0.45], [4.25, 0.28, 0.3], [6.63, 0.12, 0.2]];
const IRON = [[1, 1, 0.12], [1.72, 0.7, 0.09], [2.63, 0.5, 0.07], [3.41, 0.35, 0.05], [4.53, 0.2, 0.04]];
const vary = () => 0.97 + Math.random() * 0.06;
const recipe = draw => (a, o) => draw(a, o, vary());
const rnd = (low, high) => low + Math.random() * (high - low);

/**
 * A struck body, as clock-sound.js's `modal`: a short noise strike (5 ms rise) rung through one resonator per mode
 * [ratio, level, seconds to die away by 60 dB], `detune` adding a beating twin. Here each mode is scaled by how much of
 * this play's strike actually falls on it (the strike's spectrum at that pitch), so the grit still changes from play to
 * play but the ring's loudness does not: a lone noise-struck glass came out anywhere from soft to twice as loud.
 */
function modal(a, o, { base, modes, peak = 0.5, at = 0, strike = 0.008, detune = 0 }) {
  const t = a.currentTime + at, sr = a.sampleRate, rise = Math.ceil(sr * 0.005), n = rise + Math.ceil(sr * strike);
  const buf = a.createBuffer(1, n, sr), x = buf.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (i < rise ? i / rise : Math.exp(-6.9 * (i - rise) / (n - rise)));
  const src = a.createBufferSource(); src.buffer = buf; let longest = 0;
  for (const [ratio, level, secs] of modes) for (const off of detune ? [0, detune] : [0]) {
    const f = base * ratio + off; if (f > 4600 || f < 30) continue;
    const w = 2 * Math.PI * f / sr; let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += x[i] * Math.cos(w * i); im -= x[i] * Math.sin(w * i); }
    const bw = 6.9 / (Math.PI * secs), bp = a.createBiquadFilter(), g = a.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = f / bw;
    g.gain.value = peak * level * (off ? 0.6 : 1) * sr / (2 * Math.PI * bw * Math.max(1e-3, Math.hypot(re, im)));
    src.connect(bp).connect(g).connect(o); longest = Math.max(longest, secs);
  }
  src.start(t); keep(a, at + longest + 0.1);
}
/** A struck crystal or glass: one strike through `modes` (rings scaled by `k`), `base` Hz. */
const glass = (a, o, { base, peak = 0.3, at = 0, modes = CRYSTAL, ring = 1, detune = 0 }) => modal(a, o, { base, modes: ringFor(modes, ring), peak, at, strike: 0.003, detune });
/** Noise that rises (exponentially, like a reversed cymbal) over `rise`, then lets go over `release`. */
function swell(a, o, { type = 'highpass', from, to = from, q = 0.7, rise, release = 0.08, peak = 0.4, at = 0 }) {
  const t = a.currentTime + at, src = noise(a), f = a.createBiquadFilter(), g = a.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + rise + release);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + rise); g.gain.exponentialRampToValueAtTime(0.0001, t + rise + release);
  src.connect(f).connect(g).connect(o); src.start(t, Math.random()); src.stop(t + rise + release + 0.05);
}
/**
 * Sparkles: `count` tiny bright glints between `low` and `high` Hz, at random over `dur`. Each is noise through a narrow
 * band (`q`), so it glints with a little grain; pure sine glints (`q` 0) read as a synth's beeps.
 */
function sparkle(a, o, { count, dur, low = 2600, high = 4500, peak = 0.08, at = 0, fall = 0, q = 22 }) {
  grains(a, o, Array.from({ length: count }, () => {
    const u = Math.random(), when = at + u * dur, freq = rnd(low, high) * (1 - fall * u);
    return { freq, q, dur: rnd(0.05, 0.14), peak: peak * rnd(0.4, 1) * (q ? 0.6 / (0.577 * Math.sqrt(Math.PI * freq / q / a.sampleRate)) : 1), at: when };
  }), q ? 'noise' : 'tone');
}
/** Rain on a patch of floor: a soft hiss band (noise through `freq`), rising over 0.3 s, holding for `dur`, then gone. */
function rainBed(a, o, { at = 0, dur, peak = 0.1, freq = 4200, q = 0.6 }) {
  const t = a.currentTime + at, src = noise(a), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.3); g.gain.setValueAtTime(peak, t + dur - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(o); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  keep(a, at + dur + 0.1);
}
/** Raindrops over `dur`: `ticks` tiny bright noise ticks (drops on stone) and `plops` small water bubbles (drops in puddles). */
function drops(a, o, { at = 0, dur, ticks, plops, k = 1 }) {
  grains(a, o, Array.from({ length: ticks }, () => ({ freq: rnd(2400, 6000) * k, q: 2.2, dur: rnd(0.005, 0.018), peak: rnd(0.05, 0.16), at: at + Math.random() * dur })));
  grains(a, o, Array.from({ length: plops }, () => ({ freq: rnd(650, 1400) * k, at: at + Math.random() * dur, dur: rnd(0.03, 0.05), peak: rnd(0.06, 0.14), size: rnd(0.6, 1.1) })), 'bubble');
}
/** Tiny electric or molten crackles: noise ticks of a few milliseconds, `count` of them over `dur`. */
function fizz(a, o, { count, dur, low = 1800, high = 4400, peak = 0.2, at = 0, q = 1.6 }) {
  grains(a, o, Array.from({ length: count }, () => ({ freq: rnd(low, high), q, dur: rnd(0.004, 0.014), peak: peak * rnd(0.3, 1), at: at + Math.random() * dur })));
}
/**
 * A coil's mains hum, rung out of noise: one narrow band (`width` Hz wide) per harmonic of `f0`, so it buzzes with a
 * little grain instead of beeping. Rises over `attack`, holds, lets go over `release`; `glide` bends it over `dur`.
 */
function hum(a, o, { f0 = 100, dur, attack = 0.08, release = 0.12, peak = 0.2, at = 0, glide = 1, width = 6, parts = [[1, 0.6], [2, 1], [3, 0.55], [4, 0.45], [5, 0.25], [6, 0.2], [8, 0.1], [10, 0.06]] }) {
  const t = a.currentTime + at, src = noise(a), g = a.createGain(), sr = a.sampleRate;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.max(0.005, attack));
  g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [n, level] of parts) {
    const f = f0 * n; if (f * Math.max(1, glide) > 4600) continue;
    const bp = a.createBiquadFilter(), lg = a.createGain(), bw = width * Math.sqrt(n);
    bp.type = 'bandpass'; bp.Q.value = f / bw; bp.frequency.setValueAtTime(f, t); if (glide !== 1) bp.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
    lg.gain.value = level / (0.577 * Math.sqrt(Math.PI * bw / sr)) * 0.35;
    src.connect(bp).connect(lg).connect(g);
  }
  g.connect(o); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
/** Noise in a band whose level throbs `rate` times a second (a spinning blade's teeth, a rolling ball's bumps). */
function churn(a, o, { type = 'bandpass', freq, to = freq, q = 1.5, dur, attack = 0.05, release = 0.15, peak = 0.3, at = 0, rate, rateTo = rate, depth = 0.8 }) {
  const t = a.currentTime + at, src = noise(a), f = a.createBiquadFilter(), am = a.createGain(), g = a.createGain(), lfo = a.createOscillator(), d = a.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  lfo.frequency.setValueAtTime(rate, t); lfo.frequency.exponentialRampToValueAtTime(rateTo, t + dur); d.gain.value = depth * 0.5; am.gain.value = 1 - depth * 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.max(0.005, attack)); g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lfo.connect(d).connect(am.gain); src.connect(f).connect(am).connect(g).connect(o);
  src.start(t, Math.random()); lfo.start(t); src.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
/**
 * A plucked steel string (Karplus-Strong, baked into one buffer): plucked again at each time in `plucks`, ringing
 * `ring` seconds to silence. `bright` keeps the pick's edge; `drive` is the magnetic pickup's soft clip.
 */
function string(a, o, { freq, plucks = [0], ring = 1.2, peak = 0.5, at = 0, bright = 0.5, drive = 0, pickup = 0.18 }) {
  const sr = a.sampleRate, s = 0.5 - bright * 0.42, N = Math.max(2, Math.round(sr / freq - s)), end = plucks.at(-1) + ring;
  const n = Math.ceil(sr * end), buf = a.createBuffer(1, n, sr), out = buf.getChannelData(0), y = new Float32Array(n);
  const loss = Math.pow(0.001, 1 / (ring * freq)), starts = plucks.map(p => Math.round(p * sr)), tap = Math.max(1, Math.round(N * pickup));
  let lp = 0, next = 0, until = -1;
  for (let i = 0; i < n; i++) {
    if (next < starts.length && i >= starts[next]) { until = i + N; next++; }
    const back = i >= N + 1 ? loss * ((1 - s) * y[i - N] + s * y[i - N - 1]) : 0;
    let x = 0; if (i < until) { lp += (0.25 + 0.7 * bright) * ((Math.random() * 2 - 1) - lp); x = lp; }
    y[i] = back + x;
  }
  let top = 0;
  for (let i = 0; i < n; i++) { let v = y[i] - (i >= tap ? y[i - tap] : 0); if (drive) v = Math.tanh(v * drive); out[i] = v; top = Math.max(top, Math.abs(v)); }
  const scale = peak / (top || 1), fadeIn = Math.round(sr * 0.005), fadeOut = Math.round(sr * 0.04);
  for (let i = 0; i < n; i++) out[i] *= scale * Math.min(1, i / fadeIn, (n - i) / fadeOut);
  const src = a.createBufferSource(); src.buffer = buf; src.connect(o); src.start(a.currentTime + at);
}
/** A glass harp's sustained tone: a hum rung at a glass's inharmonic ratios, very narrow, so it sings and beats. */
const harp = (a, o, { base, dur, attack = 0.25, release = 0.4, peak = 0.08, at = 0, glide = 1 }) =>
  hum(a, o, { f0: base, dur, attack, release, peak, at, glide, width: 2.5, parts: [[1, 1], [1.004, 0.7], [2.32, 0.35], [2.33, 0.25], [4.25, 0.12]] });
/** A run of crystal strikes, `gap` apart (a prism splitting, a rainbow laid down). */
function chimes(a, o, { notes, gap = 0.04, peak = 0.25, at = 0, modes = CRYSTAL, ring = 0.6 }) {
  notes.forEach((f, i) => glass(a, o, { base: f, peak: peak * rnd(0.8, 1), at: at + i * gap, modes, ring }));
}
/** Scrap iron hitting something: a short strike through the iron chunk's modes, with a little crack. */
function clink(a, o, { base, peak = 0.25, at = 0, ring = 1, modes = IRON }) {
  modal(a, o, { base, modes: ringFor(modes, ring), peak, at, strike: 0.004 });
  band(a, o, { freq: base * 2.2, q: 2, dur: 0.012, peak: peak * 0.35, at });
}
/** Light set off: a crack, a blown-out bright hiss, a soft low push, a crystal over it and sparkles after. */
function flash(a, o, { at = 0, peak = 0.6, base = 1900, low = 120, tail = 0.6 }) {
  crack(a, o, { at, peak: peak * 0.7, freq: 2800 });
  band(a, o, { type: 'highpass', freq: 1600, to: 3200, q: 0.6, dur: tail * 0.7, attack: 0.005, peak: peak * 0.6, at });
  body(a, o, { at, peak: peak * 0.55, freq: low, dur: 0.22, drive: 1.6 });
  glass(a, o, { base, peak: peak * 0.16, at: at + 0.01, ring: 0.7, modes: GLASS, detune: 4 });
  swell(a, o, { from: 3000, to: 4200, rise: 0.02, release: tail, peak: peak * 0.2, at: at + 0.01 });
  sparkle(a, o, { count: 26, dur: tail, peak: peak * 0.1, at: at + 0.03, fall: 0.3 });
}

const LM = {
  // ---- Light skills
  // 프리즘 광선: a thin line of white light, at once: bright air flung out, a glass struck, glints along it.
  prismBeam: [
    ['광선 쉭 + 유리 팅', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 0.8, wet: 0.12 });
      whoosh(a, h, { from: 1800 * k, to: 4200 * k, dur: 0.16, q: 0.9, peak: 0.5 });
      swell(a, h, { from: 3000 * k, to: 4400 * k, rise: 0.03, release: 0.3, peak: 0.2, at: 0.05 });
      glass(a, h, { base: 2150 * k, peak: 0.3, at: 0.04, ring: 0.45, modes: GLASS, detune: 5 });
      sparkle(a, h, { count: 16, dur: 0.35, peak: 0.08, at: 0.05 });
    })],
    ['빛줄기 휙 + 반짝임', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 0.8, wet: 0.12 });
      band(a, h, { freq: 1400 * k, to: 4200 * k, q: 3, dur: 0.12, attack: 0.008, peak: 0.5 });
      band(a, h, { type: 'highpass', freq: 3000 * k, dur: 0.3, attack: 0.01, peak: 0.2, at: 0.03 });
      sparkle(a, h, { count: 26, dur: 0.4, peak: 0.1, at: 0.03, fall: 0.2 });
    })],
    ['수정 칭 (1차)', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 0.8, wet: 0.12 });
      swell(a, h, { from: 2200 * k, to: 4200 * k, rise: 0.045, release: 0.3, peak: 0.4 });
      glass(a, h, { base: 1650 * k, peak: 0.45, at: 0.03, ring: 0.6 });
      glass(a, h, { base: 2480 * k, peak: 0.25, at: 0.045, ring: 0.5 });
      sparkle(a, h, { count: 14, dur: 0.35, peak: 0.07, at: 0.04 });
    })]
  ],
  // 섬광탄: tossed (0.35 s in the air), it lands with a clink and bursts in a white flash 0.25 s later.
  flashBomb: [
    ['던짐 + 툭 + 번쩍 펑', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.2 });
      whoosh(a, h, { from: 500 * k, to: 1400 * k, dur: 0.3, peak: 0.22 });
      clink(a, h, { base: 2300 * k, peak: 0.16, at: 0.35, modes: GLASS, ring: 0.3 });
      flash(a, h, { at: 0.6, peak: 0.75, base: 1900 * k });
      band(a, h, { type: 'lowpass', freq: 1800 * k, to: 300 * k, q: 0.8, dur: 0.5, attack: 0.006, peak: 0.45, at: 0.6 });
    })],
    ['던짐 + 차오르는 빛 + 펑', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.2 });
      whoosh(a, h, { from: 450 * k, to: 1200 * k, dur: 0.3, peak: 0.2 });
      clink(a, h, { base: 2100 * k, peak: 0.14, at: 0.35, modes: GLASS, ring: 0.3 });
      swell(a, h, { from: 1800 * k, to: 4000 * k, rise: 0.24, release: 0.02, peak: 0.25, at: 0.36 });
      flash(a, h, { at: 0.6, peak: 0.8, base: 1700 * k, low: 95 });
      body(a, h, { at: 0.6, peak: 0.4, freq: 70, dur: 0.35, drive: 2 });
      fizz(a, h, { count: 24, dur: 0.6, low: 1500, high: 4000, peak: 0.1, at: 0.65 });
    })],
    ['던짐 + 툭 + 불꽃놀이처럼 펑 타닥', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.2 });
      whoosh(a, h, { from: 500 * k, to: 1400 * k, dur: 0.3, peak: 0.22 });
      clink(a, h, { base: 2300 * k, peak: 0.16, at: 0.35, modes: GLASS, ring: 0.3 });
      body(a, h, { at: 0.6, peak: 0.75, freq: 80 * k, dur: 0.4, drive: 2.6 });
      crack(a, h, { at: 0.6, peak: 0.7, freq: 2600 * k });
      band(a, h, { type: 'lowpass', freq: 3000 * k, to: 400 * k, q: 0.7, dur: 0.8, attack: 0.005, peak: 0.6, at: 0.6 });
      band(a, h, { type: 'highpass', freq: 2000 * k, dur: 0.25, attack: 0.005, peak: 0.4, at: 0.6 });
      fizz(a, h, { count: 50, dur: 0.9, low: 800, high: 3000, peak: 0.2, q: 1, at: 0.66 });
      sparkle(a, h, { count: 20, dur: 0.7, peak: 0.08, at: 0.64, fall: 0.3 });
    })],
    ['던짐 + 툭 + 섬광 쾅 + 빛 번짐', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.24 });
      whoosh(a, h, { from: 500 * k, to: 1400 * k, dur: 0.3, peak: 0.2 });
      clink(a, h, { base: 2300 * k, peak: 0.15, at: 0.35, modes: GLASS, ring: 0.3 });
      body(a, h, { at: 0.6, peak: 1, freq: 60 * k, dur: 0.5, drive: 3 });
      crack(a, h, { at: 0.6, peak: 0.9, freq: 2600 * k });
      band(a, h, { type: 'lowpass', freq: 4000 * k, to: 300 * k, q: 0.6, dur: 1.0, attack: 0.004, peak: 0.7, at: 0.6 });
      swell(a, h, { from: 2600 * k, to: 4400 * k, rise: 0.04, release: 0.9, peak: 0.25, at: 0.62 });
      sparkle(a, h, { count: 30, dur: 0.9, peak: 0.08, at: 0.66, fall: 0.3 });
    })]
  ],
  // ---- Magnet skills
  // 고철 산탄: the glove's coil kicks and five scrap pellets fly out in a fan, rattling.
  scrapShot: [
    ['코일 퉁 + 쇳조각 다섯 촤락', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 0.6, wet: 0.1 });
      thud(a, h, { from: 190 * k, to: 70 * k, dur: 0.09, peak: 0.6 });
      band(a, h, { type: 'lowpass', freq: 1100 * k, dur: 0.06, peak: 0.35 });
      whoosh(a, h, { from: 900 * k, to: 2600 * k, dur: 0.14, peak: 0.25, at: 0.01 });
      for (let i = 0; i < 5; i++) clink(a, h, { base: rnd(950, 1900) * k, peak: rnd(0.18, 0.26), at: 0.008 + i * 0.012 + Math.random() * 0.01 });
    })],
    ['자력 찌직 + 쇳조각 덜컹', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 0.6, wet: 0.1 });
      hum(a, h, { f0: 120 * k, dur: 0.09, attack: 0.01, release: 0.06, peak: 0.35, width: 18 });
      band(a, h, { freq: 1500 * k, q: 1.2, dur: 0.05, peak: 0.4, at: 0.02 });
      for (let i = 0; i < 5; i++) clink(a, h, { base: rnd(700, 1500) * k, peak: rnd(0.16, 0.24), at: 0.03 + i * 0.016 + Math.random() * 0.008, ring: 1.4 });
      debris(a, h, { at: 0.04, count: 6, span: 0.12, freq: 2400 * k, peak: 0.1 });
    })]
  ],
  // 끌어올리기: a second of scrap lifted off the floor in a rising coil hum, rattling, then slammed down.
  magneticLift: [
    ['자력 웅 + 쇳조각 덜덜 + 쾅', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.22 });
      hum(a, h, { f0: 100 * k, glide: 1.5, dur: 1.0, attack: 0.8, release: 0.04, peak: 0.22 });
      swell(a, h, { type: 'bandpass', from: 400 * k, to: 1500 * k, q: 1.5, rise: 0.95, release: 0.03, peak: 0.16 });
      for (let i = 0; i < 16; i++) { const u = Math.pow(Math.random(), 0.6); clink(a, h, { base: (700 + 900 * u) * k * rnd(0.85, 1.15), peak: 0.05 + 0.08 * u, at: 0.05 + u * 0.88 }); }
      body(a, h, { at: 1.0, peak: 0.85, freq: 90 * k, dur: 0.32, drive: 2.4 });
      crack(a, h, { at: 1.0, peak: 0.5, freq: 2200 * k });
      modal(a, h, { base: 320 * k, modes: PLATE, peak: 0.35, at: 1.0, strike: 0.006 });
      debris(a, h, { at: 1.0, count: 16, span: 0.45, freq: 2000 * k, peak: 0.2 });
    })],
    ['쇳조각 차르륵 솟음 + 내리꽂힘', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.22 });
      hum(a, h, { f0: 60 * k, glide: 2, dur: 0.65, attack: 0.45, release: 0.05, peak: 0.16, width: 10 });
      churn(a, h, { freq: 900 * k, to: 2200 * k, q: 3, dur: 0.62, attack: 0.32, release: 0.05, peak: 0.12, rate: 16, rateTo: 34 });
      for (let i = 0; i < 22; i++) { const u = Math.pow(Math.random(), 0.7); clink(a, h, { base: (900 + 1200 * u) * k * rnd(0.85, 1.15), peak: 0.04 + 0.06 * u, at: 0.03 + u * 0.55 }); }
      whoosh(a, h, { from: 1600 * k, to: 400 * k, dur: 0.14, peak: 0.3, at: 0.53 });
      body(a, h, { at: 0.65, peak: 0.9, freq: 80 * k, dur: 0.35, drive: 2.6 });
      crack(a, h, { at: 0.65, peak: 0.55, freq: 2000 * k });
      for (let i = 0; i < 7; i++) clink(a, h, { base: rnd(500, 1300) * k, peak: rnd(0.15, 0.3), at: 0.65 + i * 0.01 + Math.random() * 0.02 });
      debris(a, h, { at: 0.67, count: 14, span: 0.5, freq: 1800 * k, peak: 0.18 });
    })],
    ['쇳조각 짤그락 솟음 + 철판 쾅', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.22 });
      hum(a, h, { f0: 100 * k, glide: 1.4, dur: 1.0, attack: 0.8, release: 0.04, peak: 0.14 });
      whoosh(a, h, { from: 300 * k, to: 1400 * k, dur: 0.95, q: 1.2, swell: 0.9, peak: 0.18 });
      for (let i = 0; i < 34; i++) { const u = Math.pow(Math.random(), 0.55); clink(a, h, { base: (800 + 1400 * u) * k * rnd(0.85, 1.15), peak: 0.05 + 0.1 * u, at: 0.04 + u * 0.9, ring: 1.3 }); }
      body(a, h, { at: 1.0, peak: 0.85, freq: 85 * k, dur: 0.32, drive: 2.6 });
      crack(a, h, { at: 1.0, peak: 0.5, freq: 2200 * k });
      modal(a, h, { base: 280 * k, modes: ringFor(PLATE, 2.5), peak: 0.6, at: 1.0, strike: 0.006 });
      modal(a, h, { base: 760 * k, modes: ringFor(STEEL, 0.6), peak: 0.2, at: 1.005, strike: 0.004 });
      for (let i = 0; i < 9; i++) clink(a, h, { base: rnd(600, 1600) * k, peak: rnd(0.12, 0.25), at: 1.02 + Math.pow(i / 9, 1.5) * 0.4 + Math.random() * 0.02, ring: 1.3 });
    })],
    ['쇳조각 덜덜 솟음 + 고철 무더기 와장창', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.22 });
      hum(a, h, { f0: 100 * k, glide: 1.5, dur: 1.0, attack: 0.8, release: 0.04, peak: 0.16 });
      whoosh(a, h, { from: 300 * k, to: 1200 * k, dur: 0.9, q: 1.2, swell: 0.9, peak: 0.14 });
      for (let i = 0; i < 20; i++) { const u = Math.pow(Math.random(), 0.6); clink(a, h, { base: (700 + 900 * u) * k * rnd(0.85, 1.15), peak: 0.04 + 0.07 * u, at: 0.05 + u * 0.88 }); }
      body(a, h, { at: 1.0, peak: 0.9, freq: 80 * k, dur: 0.35, drive: 2.6 });
      crack(a, h, { at: 1.0, peak: 0.55, freq: 2000 * k });
      for (let i = 0; i < 24; i++) {
        const u = Math.pow(i / 24, 1.4), base = rnd(300, 1800) * k;
        modal(a, h, { base, modes: ringFor(Math.random() < 0.4 ? PLATE : IRON, rnd(0.8, 1.6)), peak: rnd(0.12, 0.3) * (1 - u * 0.6), at: 1.0 + u * 0.45 + Math.random() * 0.015, strike: 0.005 });
      }
      debris(a, h, { at: 1.02, count: 12, span: 0.5, freq: 2200 * k, peak: 0.12 });
    })]
  ],

  // ---- Fusions
  // 한낮 표적 (빛 + 불): a little sun comes up, drops a heat pillar every 0.25 s from 0.3 s (eight), then bursts.
  noonMark: [
    ['해 떠오름 + 열기둥 여덟 + 폭발', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      swell(a, h, { from: 1500 * k, to: 3500 * k, rise: 0.25, release: 0.3, peak: 0.25 });
      glass(a, h, { base: 1480 * k, peak: 0.22, at: 0.22, ring: 1 });
      band(a, h, { type: 'lowpass', freq: 700 * k, dur: 1.8, attack: 0.3, peak: 0.08, at: 0.2 });
      for (let i = 0; i < 8; i++) {
        const at = 0.3 + i * 0.25;
        band(a, h, { type: 'lowpass', freq: 1500 * k, to: 320 * k, q: 0.9, dur: 0.2, attack: 0.012, peak: 0.34, at });
        band(a, h, { freq: 2400 * k, q: 1.2, dur: 0.07, attack: 0.006, peak: 0.12, at });
        fizz(a, h, { count: 5, dur: 0.15, peak: 0.12, at: at + 0.02 });
      }
      body(a, h, { at: 2.08, peak: 0.85, freq: 75 * k, dur: 0.4, drive: 2.4 });
      band(a, h, { type: 'lowpass', freq: 2600 * k, to: 380 * k, q: 0.8, dur: 0.6, attack: 0.008, peak: 0.6, at: 2.08 });
      flash(a, h, { at: 2.08, peak: 0.45, base: 1480 * k, tail: 0.5 });
    })],
    ['해 + 불기둥 화르륵 여덟 + 폭발', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      swell(a, h, { from: 1500 * k, to: 3500 * k, rise: 0.25, release: 0.3, peak: 0.2 });
      sparkle(a, h, { count: 10, dur: 0.3, peak: 0.06, at: 0.05 });
      churn(a, h, { type: 'lowpass', freq: 900 * k, q: 0.7, dur: 1.85, attack: 0.15, release: 0.2, peak: 0.22, at: 0.25, rate: 4, depth: 0.6 });
      for (let i = 0; i < 8; i++) {
        const at = 0.3 + i * 0.25;
        swell(a, h, { type: 'lowpass', from: 2200 * k, to: 600 * k, q: 0.8, rise: 0.05, release: 0.2, peak: 0.32, at });
        fizz(a, h, { count: 4, dur: 0.2, low: 900, high: 2600, peak: 0.16, q: 1, at: at + 0.02 });
      }
      body(a, h, { at: 2.08, peak: 0.85, freq: 70 * k, dur: 0.45, drive: 2.4 });
      band(a, h, { type: 'lowpass', freq: 2600 * k, to: 300 * k, q: 0.7, dur: 0.9, attack: 0.008, peak: 0.7, at: 2.08 });
      crack(a, h, { at: 2.08, peak: 0.5, freq: 2200 * k });
      fizz(a, h, { count: 30, dur: 0.8, low: 800, high: 2600, peak: 0.14, q: 1, at: 2.12 });
    })],
    ['불꽃 쏴아 여덟 + 불덩이 폭발', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      whoosh(a, h, { from: 600 * k, to: 2400 * k, dur: 0.3, q: 0.8, peak: 0.3 });
      for (let i = 0; i < 8; i++) {
        const at = 0.3 + i * 0.25;
        whoosh(a, h, { type: 'lowpass', from: 2400 * k, to: 500 * k, dur: 0.3, q: 0.6, peak: 0.4, at });
        band(a, h, { type: 'lowpass', freq: 300 * k, to: 120 * k, q: 1.2, dur: 0.2, attack: 0.03, peak: 0.25, at: at + 0.02 });
        fizz(a, h, { count: 6, dur: 0.25, low: 700, high: 2200, peak: 0.15, q: 0.9, at: at + 0.03 });
      }
      body(a, h, { at: 2.08, peak: 0.95, freq: 60 * k, dur: 0.55, drive: 2.8 });
      whoosh(a, h, { type: 'lowpass', from: 3000 * k, to: 250 * k, dur: 1.0, q: 0.6, swell: 0.05, peak: 0.8, at: 2.06 });
      fizz(a, h, { count: 40, dur: 0.9, low: 600, high: 2400, peak: 0.15, q: 0.9, at: 2.12 });
    })]
  ],
  // 서리 프리즘 (빛 + 얼음): an ice prism set down, then six pulses 0.5 s apart from 0.3 s, each split into three beams.
  frostPrism: [
    ['얼음 프리즘 + 세 갈래 칭 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      crack(a, h, { peak: 0.35, freq: 3000 * k });
      debris(a, h, { count: 10, span: 0.2, freq: 3200 * k, peak: 0.12, q: 4 });
      glass(a, h, { base: 1250 * k, peak: 0.3, at: 0.01, ring: 1.4 });
      for (let i = 0; i < 6; i++) {
        const at = 0.3 + i * 0.5;
        band(a, h, { type: 'highpass', freq: 3000 * k, dur: 0.08, peak: 0.12, at });
        chimes(a, h, { notes: [1870, 2350, 2800].map(f => f * k), gap: 0.022, peak: 0.2, at, ring: 0.45 });
      }
    })],
    ['얼음 깨짐 + 유리 팅 세 갈래 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      crack(a, h, { peak: 0.45, freq: 3000 * k });
      debris(a, h, { count: 14, span: 0.3, freq: 3400 * k, peak: 0.14, q: 4 });
      harp(a, h, { base: 1250 * k, dur: 2.9, attack: 0.2, release: 0.5, peak: 0.05 });
      for (let i = 0; i < 6; i++) {
        const at = 0.3 + i * 0.5;
        whoosh(a, h, { from: 2000 * k, to: 4200 * k, dur: 0.1, q: 1, peak: 0.16, at });
        [2350, 2790, 3310].forEach((f, j) => glass(a, h, { base: f * k * rnd(0.98, 1.02), peak: 0.14, at: at + 0.02 + j * 0.03, ring: 0.35, modes: GLASS, detune: 6 }));
        debris(a, h, { at: at + 0.02, count: 3, span: 0.08, freq: 3600 * k, peak: 0.06, q: 4 });
      }
    })],
    ['얼음 쩍 + 얼음 조각 짤랑 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      crack(a, h, { peak: 0.5, freq: 2600 * k });
      body(a, h, { peak: 0.3, freq: 160 * k, dur: 0.12, drive: 1.6 });
      debris(a, h, { count: 16, span: 0.35, freq: 3000 * k, peak: 0.16, q: 5 });
      for (let i = 0; i < 6; i++) {
        const at = 0.3 + i * 0.5;
        sparkle(a, h, { count: 6, dur: 0.12, peak: 0.08, at });
        for (let j = 0; j < 3; j++) clink(a, h, { base: rnd(2000, 3000) * k, peak: 0.13, at: at + j * 0.035 + Math.random() * 0.01, modes: GLASS, ring: 0.25 });
        band(a, h, { type: 'highpass', freq: 3400 * k, dur: 0.05, peak: 0.1, at });
      }
    })]
  ],
  // 굴절 광선 (빛 + 전기): a beam fastened on one body for 1.5 s from 0.2 s, burning it every 0.25 s and bending on.
  refractBeam: [
    ['노래하는 빛줄기 + 지직 꺾임 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1, wet: 0.14 });
      whoosh(a, h, { from: 1200 * k, to: 3600 * k, dur: 0.2, q: 1, peak: 0.35 });
      harp(a, h, { base: 1320 * k, dur: 1.6, attack: 0.1, release: 0.25, peak: 0.08, at: 0.18 });
      hum(a, h, { f0: 120 * k, dur: 1.6, attack: 0.08, release: 0.25, peak: 0.06, at: 0.18, width: 20 });
      for (let i = 0; i < 6; i++) {
        const at = 0.2 + i * 0.25;
        crack(a, h, { at, peak: 0.4, freq: 3000 * k });
        band(a, h, { type: 'highpass', freq: 2400 * k, dur: 0.09, attack: 0.005, peak: 0.3, at });
        hum(a, h, { f0: 180 * k, dur: 0.12, attack: 0.005, release: 0.09, peak: 0.2, at, width: 30 });
        glass(a, h, { base: 2700 * k, peak: 0.08, at: at + 0.04, ring: 0.3, modes: GLASS, detune: 6 });
      }
    })],
    ['빛 흐름 + 꺾이는 칭 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1, wet: 0.14 });
      band(a, h, { freq: 1200 * k, to: 3400 * k, q: 4, dur: 0.18, attack: 0.01, peak: 0.3 });
      churn(a, h, { type: 'highpass', freq: 2600 * k, q: 0.8, dur: 1.55, attack: 0.05, release: 0.2, peak: 0.12, at: 0.18, rate: 23, depth: 0.6 });
      fizz(a, h, { count: 50, dur: 1.5, peak: 0.1, at: 0.2 });
      for (let i = 0; i < 6; i++) {
        const at = 0.2 + i * 0.25;
        crack(a, h, { at, peak: 0.28, freq: 2600 * k });
        glass(a, h, { base: 1900 * k, peak: 0.12, at, ring: 0.4, modes: GLASS });
        glass(a, h, { base: 2850 * k, peak: 0.1, at: at + 0.03, ring: 0.4, modes: GLASS });
      }
    })],
    ['전기 빛줄기 윙 + 파직 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1, wet: 0.14 });
      whoosh(a, h, { from: 1500 * k, to: 4000 * k, dur: 0.18, q: 1.2, peak: 0.3 });
      hum(a, h, { f0: 100 * k, dur: 1.65, attack: 0.06, release: 0.25, peak: 0.14, at: 0.16, width: 26, parts: [[1, 0.4], [2, 0.7], [3, 1], [5, 0.8], [7, 0.6], [9, 0.45], [13, 0.3], [17, 0.2], [23, 0.15], [31, 0.1]] });
      band(a, h, { type: 'highpass', freq: 3000 * k, dur: 1.5, attack: 0.08, peak: 0.07, at: 0.2 });
      for (let i = 0; i < 6; i++) {
        const at = 0.2 + i * 0.25;
        crack(a, h, { at, peak: 0.5, freq: 3200 * k });
        fizz(a, h, { count: 8, dur: 0.08, peak: 0.2, at });
        band(a, h, { freq: 2200 * k, to: 3800 * k, q: 2, dur: 0.07, peak: 0.25, at: at + 0.01 });
      }
    })]
  ],
  // 빛살 질주 (빛 + 바람): a 0.25 s slide leaving a band of light that bursts a second later.
  lightDash: [
    ['질주 휙 + 빛 띠 + 번쩍', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1, wet: 0.16 });
      whoosh(a, h, { from: 500 * k, to: 2600 * k, dur: 0.28, peak: 0.6 });
      sparkle(a, h, { count: 14, dur: 0.3, peak: 0.08, at: 0.02 });
      swell(a, h, { from: 3000 * k, to: 4200 * k, rise: 0.85, release: 0.02, peak: 0.1, at: 0.28 });
      flash(a, h, { at: 1.15, peak: 0.7, base: 2000 * k, tail: 0.5 });
      band(a, h, { type: 'lowpass', freq: 1600 * k, to: 300 * k, q: 0.8, dur: 0.4, attack: 0.006, peak: 0.35, at: 1.15 });
    })],
    ['질주 휙 + 띠 따라 팡팡팡', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1, wet: 0.16 });
      whoosh(a, h, { from: 600 * k, to: 3000 * k, dur: 0.26, peak: 0.6 });
      sparkle(a, h, { count: 10, dur: 0.25, peak: 0.07, at: 0.05 });
      for (let i = 0; i < 4; i++) {
        const at = 1.05 + i * 0.05;
        crack(a, h, { at, peak: 0.45, freq: 2600 * k });
        band(a, h, { type: 'highpass', freq: 1800 * k, dur: 0.18, peak: 0.3, at });
        body(a, h, { at, peak: 0.3, freq: 140 * k * (1 - i * 0.08), dur: 0.12, drive: 1.6 });
      }
      sparkle(a, h, { count: 24, dur: 0.5, peak: 0.09, at: 1.08, fall: 0.3 });
    })],
    ['질주 휙 + 빛 띠 펑 타닥', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1, wet: 0.16 });
      whoosh(a, h, { from: 450 * k, to: 2800 * k, dur: 0.3, q: 1, peak: 0.65 });
      sparkle(a, h, { count: 14, dur: 0.3, peak: 0.08, at: 0.03 });
      swell(a, h, { from: 2600 * k, to: 4200 * k, rise: 0.82, release: 0.02, peak: 0.12, at: 0.3 });
      body(a, h, { at: 1.12, peak: 0.6, freq: 95 * k, dur: 0.3, drive: 2.2 });
      crack(a, h, { at: 1.12, peak: 0.65, freq: 2800 * k });
      band(a, h, { type: 'lowpass', freq: 3200 * k, to: 500 * k, q: 0.7, dur: 0.6, attack: 0.005, peak: 0.5, at: 1.12 });
      fizz(a, h, { count: 40, dur: 0.7, low: 900, high: 3400, peak: 0.18, q: 1, at: 1.16 });
      sparkle(a, h, { count: 22, dur: 0.6, peak: 0.08, at: 1.14, fall: 0.3 });
    })]
  ],
  // 공명 별자리 (빛 + 소리): stars lit and linked over the first second, then the whole figure rings five times.
  lightConstellation: [
    ['별 반짝 다섯 + 별자리 울림 다섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
      [2640, 3140, 2350, 3520, 2960].forEach((f, i) => { const at = 0.06 + i * 0.16; glass(a, h, { base: f * k, peak: 0.12, at, ring: 0.5, modes: GLASS }); sparkle(a, h, { count: 3, dur: 0.1, peak: 0.04, at }); });
      hum(a, h, { f0: 392 * k, dur: 1.2, attack: 0.3, release: 0.3, peak: 0.03, at: 0.9, width: 3, parts: [[1, 1], [2, 0.4], [3, 0.2]] });
      const chord = [1568, 1976, 2349];
      for (let i = 0; i < 5; i++) {
        const at = 1.0 + i * 0.2, lift = 1 + i * 0.06;
        chimes(a, h, { notes: chord.map(f => f * k * lift), gap: 0.008, peak: i === 4 ? 0.3 : 0.22, at, ring: i === 4 ? 1.2 : 0.6 });
      }
    })],
    ['별 이음 반짝 + 수정 종 다섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
      sparkle(a, h, { count: 30, dur: 0.9, low: 2400, high: 4400, peak: 0.07, at: 0.04 });
      swell(a, h, { from: 2600 * k, to: 4000 * k, rise: 0.9, release: 0.05, peak: 0.08, at: 0.05 });
      const notes = [1319, 1568, 1760, 2093, 2637];
      for (let i = 0; i < 5; i++) {
        const at = 1.0 + i * 0.2;
        glass(a, h, { base: notes[i] * k, peak: 0.32, at, ring: 0.9 });
        glass(a, h, { base: notes[i] * 1.5 * k, peak: 0.12, at: at + 0.01, ring: 0.6, modes: GLASS });
        sparkle(a, h, { count: 5, dur: 0.15, peak: 0.05, at });
      }
    })],
    ['별 반짝 + 유리줄 울림 다섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
      [2790, 3310, 2480, 3720, 3050].forEach((f, i) => { const at = 0.06 + i * 0.16; glass(a, h, { base: f * k, peak: 0.1, at, ring: 0.4, modes: GLASS, detune: 7 }); sparkle(a, h, { count: 4, dur: 0.12, peak: 0.05, at }); });
      harp(a, h, { base: 1175 * k, dur: 1.4, attack: 0.15, release: 0.4, peak: 0.05, at: 0.85 });
      for (let i = 0; i < 5; i++) {
        const at = 1.0 + i * 0.2;
        [1660, 2090, 2490].forEach((f, j) => glass(a, h, { base: f * k * (1 + i * 0.03), peak: i === 4 ? 0.22 : 0.16, at: at + j * 0.006, ring: i === 4 ? 1 : 0.5, modes: GLASS, detune: 5 }));
        sparkle(a, h, { count: 5, dur: 0.15, peak: 0.06, at });
      }
    })]
  ],
  // 소나기 무지개 (빛 + 물, 2026-11-21: in place of the rainbow bridge): a little cloud gathers over the spot (0 to 0.3 s),
  // rain falls on it until 2.3 s, then the sun breaks through and its light strikes with the rainbow at 2.6 s. The pick
  // (index 4) follows the quicker shower set later the same day: rain until 1.9 s, the strike at 2.1 s.
  rainbowBridge: [
    ['구름 우릉 + 소나기 + 햇빛 쨍', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.2 });
      band(a, h, { type: 'lowpass', freq: 220 * k, to: 140 * k, q: 0.8, dur: 0.7, attack: 0.25, peak: 0.22 });
      rainBed(a, h, { at: 0.3, dur: 2.0, peak: 0.1, freq: 4200 * k });
      drops(a, h, { at: 0.3, dur: 2.0, ticks: 70, plops: 16, k });
      swell(a, h, { from: 1500 * k, to: 4500 * k, rise: 0.3, release: 0.1, peak: 0.16, at: 2.3 });
      [880, 1320, 1760].forEach((f, j) => glass(a, h, { base: f * k, peak: 0.2, at: 2.6 + j * 0.01, modes: CRYSTAL, ring: 1, detune: 3 }));
      thud(a, h, { from: 220 * k, to: 90 * k, dur: 0.25, peak: 0.25, at: 2.6 });
      sparkle(a, h, { count: 24, dur: 0.6, peak: 0.07, at: 2.6 });
    })],
    ['쏴아 빗소리 + 햇살 촤르르', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.2 });
      band(a, h, { type: 'lowpass', freq: 180 * k, q: 0.7, dur: 0.6, attack: 0.3, peak: 0.18 });
      rainBed(a, h, { at: 0.25, dur: 2.1, peak: 0.14, freq: 3600 * k, q: 0.5 });
      drops(a, h, { at: 0.3, dur: 2.0, ticks: 110, plops: 10, k });
      whoosh(a, h, { from: 900 * k, to: 4200 * k, dur: 0.4, q: 0.9, peak: 0.2, at: 2.25 });
      for (let i = 0; i < 9; i++) glass(a, h, { base: (1170 + i * 160) * k, peak: 0.12, at: 2.6 + i * 0.022, ring: 0.7, modes: GLASS, detune: 5 });
      sparkle(a, h, { count: 30, dur: 0.7, peak: 0.07, at: 2.62 });
    })],
    ['자잘한 빗소리 + 햇빛 쨍', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.18 });
      band(a, h, { type: 'lowpass', freq: 200 * k, q: 0.7, dur: 0.6, attack: 0.25, peak: 0.16 });
      rainBed(a, h, { at: 0.3, dur: 2.0, peak: 0.06, freq: 2600 * k, q: 0.35 });
      grains(a, h, Array.from({ length: 260 }, () => ({ freq: rnd(1500, 7000) * k, q: 1, dur: rnd(0.003, 0.01), peak: rnd(0.04, 0.12), at: 0.3 + Math.random() * 2 })));
      drops(a, h, { at: 0.4, dur: 1.8, ticks: 0, plops: 4, k });
      swell(a, h, { from: 1500 * k, to: 4500 * k, rise: 0.3, release: 0.1, peak: 0.15, at: 2.3 });
      [880, 1320, 1760].forEach((f, j) => glass(a, h, { base: f * k, peak: 0.2, at: 2.6 + j * 0.01, modes: CRYSTAL, ring: 1, detune: 3 }));
      sparkle(a, h, { count: 26, dur: 0.6, peak: 0.07, at: 2.6 });
    })],
    ['빗줄기 쏴 + 맑은 종소리 햇빛', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      band(a, h, { type: 'lowpass', freq: 160 * k, q: 0.7, dur: 0.7, attack: 0.3, peak: 0.14 });
      rainBed(a, h, { at: 0.3, dur: 2.0, peak: 0.08, freq: 6000 * k, q: 0.3 });
      grains(a, h, Array.from({ length: 340 }, () => ({ freq: rnd(2000, 8000) * k, q: 0.8, dur: rnd(0.002, 0.007), peak: rnd(0.03, 0.1), at: 0.3 + Math.random() * 2 })));
      whoosh(a, h, { from: 1200 * k, to: 5000 * k, dur: 0.35, q: 0.8, peak: 0.14, at: 2.28 });
      [1046, 1318, 1568, 2093].forEach((f, j) => glass(a, h, { base: f * k, peak: 0.16, at: 2.6 + j * 0.025, modes: CRYSTAL, ring: 1.2, detune: 2 }));
      sparkle(a, h, { count: 30, dur: 0.7, peak: 0.06, at: 2.62 });
    })],
    ['자잘한 빗소리 + 맑은 종소리 햇빛', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
      band(a, h, { type: 'lowpass', freq: 200 * k, q: 0.7, dur: 0.6, attack: 0.25, peak: 0.16 });
      rainBed(a, h, { at: 0.3, dur: 1.6, peak: 0.06, freq: 2600 * k, q: 0.35 });
      grains(a, h, Array.from({ length: 260 }, () => ({ freq: rnd(1500, 7000) * k, q: 1, dur: rnd(0.003, 0.01), peak: rnd(0.04, 0.12), at: 0.3 + Math.random() * 1.6 })));
      drops(a, h, { at: 0.4, dur: 1.4, ticks: 0, plops: 6, k });
      whoosh(a, h, { from: 1200 * k, to: 5000 * k, dur: 0.35, q: 0.8, peak: 0.14, at: 1.78 });
      [1046, 1318, 1568, 2093].forEach((f, j) => glass(a, h, { base: f * k, peak: 0.16, at: 2.1 + j * 0.025, modes: CRYSTAL, ring: 1.2, detune: 2 }));
      sparkle(a, h, { count: 30, dur: 0.7, peak: 0.06, at: 2.12 });
    })],
    ['톡톡 빗방울 + 따뜻한 햇빛 화음', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.22 });
      band(a, h, { type: 'lowpass', freq: 200 * k, q: 0.9, dur: 0.5, attack: 0.2, peak: 0.16 });
      rainBed(a, h, { at: 0.3, dur: 2.0, peak: 0.07, freq: 5000 * k });
      drops(a, h, { at: 0.3, dur: 2.0, ticks: 45, plops: 30, k });
      swell(a, h, { from: 1200 * k, to: 3800 * k, rise: 0.28, release: 0.12, peak: 0.14, at: 2.32 });
      [660, 830, 990, 1320].forEach((f, j) => glass(a, h, { base: f * k, peak: 0.17, at: 2.6 + j * 0.03, modes: CRYSTAL, ring: 1.3, detune: 2 }));
      sparkle(a, h, { count: 20, dur: 0.8, peak: 0.06, at: 2.65 });
    })]
  ],
  // 쇳물 공 (자력 + 불): a red-hot iron ball rolled out, hissing, heating what it passes, then bursting (about 1.6 s).
  moltenBall: [
    ['쇠공 우르릉 + 쉬익 + 폭발', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.2 });
      clink(a, h, { base: 240 * k, peak: 0.35, ring: 2 });
      band(a, h, { type: 'lowpass', freq: 1200 * k, to: 400 * k, dur: 0.3, attack: 0.02, peak: 0.3 });
      band(a, h, { type: 'lowpass', freq: 180 * k, q: 1.5, dur: 1.55, attack: 0.1, peak: 0.5, at: 0.08 });
      for (let i = 0; i < 9; i++) band(a, h, { type: 'lowpass', freq: rnd(160, 260) * k, q: 2, dur: rnd(0.1, 0.2), attack: 0.02, peak: rnd(0.2, 0.4), at: 0.1 + i * 0.16 + Math.random() * 0.06 });
      band(a, h, { type: 'highpass', freq: 2600 * k, q: 0.5, dur: 1.5, attack: 0.1, peak: 0.1, at: 0.1 });
      body(a, h, { at: 1.65, peak: 0.95, freq: 65 * k, dur: 0.5, drive: 2.8 });
      band(a, h, { type: 'lowpass', freq: 2200 * k, to: 300 * k, q: 0.7, dur: 0.9, attack: 0.008, peak: 0.7, at: 1.65 });
      crack(a, h, { at: 1.65, peak: 0.5, freq: 2000 * k });
      fizz(a, h, { count: 30, dur: 0.8, low: 700, high: 2400, peak: 0.14, q: 1, at: 1.7 });
      debris(a, h, { at: 1.66, count: 10, span: 0.4, freq: 1400 * k, peak: 0.12 });
    })],
    ['쇠공 덜그럭 + 쇳물 펑', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.2 });
      band(a, h, { type: 'lowpass', freq: 1400 * k, to: 350 * k, dur: 0.35, attack: 0.02, peak: 0.35 });
      churn(a, h, { type: 'lowpass', freq: 200 * k, q: 3, dur: 1.55, attack: 0.08, release: 0.1, peak: 0.4, at: 0.08, rate: 7, rateTo: 9, depth: 0.8 });
      for (let i = 0; i < 12; i++) clink(a, h, { base: rnd(320, 520) * k, peak: rnd(0.08, 0.14), at: 0.1 + i * 0.125 + Math.random() * 0.03, ring: 1.5 });
      fizz(a, h, { count: 45, dur: 1.5, low: 1600, high: 4000, peak: 0.1, at: 0.1 });
      body(a, h, { at: 1.65, peak: 0.95, freq: 65 * k, dur: 0.5, drive: 2.8 });
      band(a, h, { type: 'lowpass', freq: 1700 * k, to: 260 * k, q: 0.8, dur: 0.75, attack: 0.008, peak: 0.6, at: 1.65 });
      for (let i = 0; i < 14; i++) grains(a, h, [{ freq: rnd(250, 700) * k, at: 1.7 + Math.random() * 0.5, dur: 0.05, peak: 0.12, size: 1.2 }], 'bubble');
      fizz(a, h, { count: 30, dur: 0.6, low: 1400, high: 3600, peak: 0.12, at: 1.68 });
    })]
  ],
  // 서리 쇳조각 (자력 + 얼음): six iced shards whirl round F2 for 2 s, then fly off 0.06 s apart and stick.
  frostShards: [
    ['쇳조각 윙윙 회전 + 콱콱 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      hum(a, h, { f0: 90 * k, dur: 2.05, attack: 0.15, release: 0.1, peak: 0.07, width: 8 });
      for (let i = 0; i < 16; i++) whoosh(a, h, { from: (900 + (i % 2) * 300) * k, to: (1500 + (i % 2) * 300) * k, dur: 0.11, q: 1.6, peak: 0.24, at: 0.02 + i * 0.122 });
      fizz(a, h, { count: 26, dur: 1.9, low: 2800, high: 4500, peak: 0.08, q: 4 });
      for (let i = 0; i < 6; i++) {
        const at = 2.0 + i * 0.06;
        band(a, h, { freq: 1500 * k, to: 3200 * k, q: 3, dur: 0.07, peak: 0.2, at });
        crack(a, h, { at: at + 0.2, peak: 0.32, freq: 3000 * k });
        clink(a, h, { base: rnd(1500, 2100) * k, peak: 0.2, at: at + 0.2, ring: 0.8 });
      }
    })],
    ['얼음 쇠 원판 휘링 + 박힘 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      churn(a, h, { freq: 1300 * k, to: 1600 * k, q: 2, dur: 2.0, attack: 0.15, release: 0.1, peak: 0.3, rate: 8, depth: 0.85 });
      for (let i = 0; i < 10; i++) glass(a, h, { base: rnd(2600, 3600) * k, peak: 0.05, at: 0.1 + i * 0.19, ring: 0.3, modes: GLASS });
      for (let i = 0; i < 6; i++) {
        const at = 2.0 + i * 0.06;
        whoosh(a, h, { from: 1400 * k, to: 3000 * k, dur: 0.12, peak: 0.22, at });
        crack(a, h, { at: at + 0.2, peak: 0.3, freq: 3400 * k });
        clink(a, h, { base: rnd(1200, 1800) * k, peak: 0.18, at: at + 0.2 });
        debris(a, h, { at: at + 0.2, count: 3, span: 0.08, freq: 3600 * k, peak: 0.06, q: 4 });
      }
    })]
  ],
  // 전자 레일포 (자력 + 전기): the coils charge for 0.6 s, then a rod is fired through the room.
  railCannon: [
    ['코일 충전 위잉 + 쾅 발사', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.24 });
      hum(a, h, { f0: 110 * k, glide: 3, dur: 0.6, attack: 0.5, release: 0.02, peak: 0.24, width: 8 });
      swell(a, h, { from: 1500 * k, to: 4000 * k, rise: 0.58, release: 0.02, peak: 0.12 });
      fizz(a, h, { count: 30, dur: 0.55, peak: 0.1, at: 0.05 });
      body(a, h, { at: 0.6, peak: 1, freq: 70 * k, dur: 0.4, drive: 3 });
      crack(a, h, { at: 0.6, peak: 0.8, freq: 2600 * k });
      band(a, h, { type: 'highpass', freq: 1400 * k, to: 3000 * k, q: 0.7, dur: 0.35, attack: 0.005, peak: 0.55, at: 0.6 });
      modal(a, h, { base: 620 * k, modes: STEEL, peak: 0.3, at: 0.6, strike: 0.005 });
      whoosh(a, h, { from: 3000 * k, to: 700 * k, dur: 0.3, peak: 0.25, at: 0.62 });
    })],
    ['축전 상승음 + 레일 쇠막대 철컹', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.6, wet: 0.24 });
      swell(a, h, { type: 'bandpass', from: 300 * k, to: 2400 * k, q: 18, rise: 0.58, release: 0.02, peak: 0.3 });
      hum(a, h, { f0: 60 * k, glide: 2, dur: 0.6, attack: 0.45, release: 0.02, peak: 0.14, width: 10 });
      for (let i = 0; i < 6; i++) clink(a, h, { base: 1500 * k, peak: 0.06 + i * 0.012, at: 0.1 + i * 0.085 * Math.pow(0.9, i), modes: IRON, ring: 0.6 });
      clink(a, h, { base: 380 * k, peak: 0.45, at: 0.58, ring: 1.6 });
      body(a, h, { at: 0.6, peak: 1, freq: 65 * k, dur: 0.45, drive: 3.2 });
      crack(a, h, { at: 0.6, peak: 0.85, freq: 2400 * k });
      band(a, h, { type: 'highpass', freq: 1200 * k, to: 2600 * k, q: 0.7, dur: 0.4, attack: 0.005, peak: 0.5, at: 0.6 });
      modal(a, h, { base: 540 * k, modes: ringFor(STEEL, 1.4), peak: 0.32, at: 0.61, strike: 0.005 });
      debris(a, h, { at: 0.62, count: 8, span: 0.3, freq: 2400 * k, peak: 0.1 });
    })]
  ],
  // 고철 회전톱 (자력 + 바람): a scrap saw thrown (lodging at 0.5 s), then spinning in place for 1.5 s, biting.
  scrapSaw: [
    ['톱날 휘리릭 + 박힘 + 금속 갈림 (날 울림)', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      whoosh(a, h, { from: 400 * k, to: 1500 * k, dur: 0.48, q: 1, peak: 0.3 });
      hum(a, h, { f0: 330 * k, glide: 1.15, dur: 0.5, attack: 0.05, release: 0.05, peak: 0.12, width: 30, parts: [[1, 0.5], [2, 0.7], [3, 1], [4, 0.8], [5, 0.6], [7, 0.4], [9, 0.3], [11, 0.2]] });
      clink(a, h, { base: 520 * k, peak: 0.5, at: 0.5, ring: 1.5 });
      crack(a, h, { at: 0.5, peak: 0.45, freq: 2400 * k });
      hum(a, h, { f0: 260 * k, glide: 0.9, dur: 1.5, attack: 0.03, release: 0.25, peak: 0.2, at: 0.51, width: 45, parts: [[1, 0.3], [2, 0.5], [3, 0.7], [5, 1], [7, 0.9], [9, 0.8], [11, 0.6], [13, 0.5], [15, 0.4], [17, 0.3]] });
      churn(a, h, { freq: 3000 * k, to: 2600 * k, q: 3, dur: 1.5, attack: 0.03, release: 0.25, peak: 0.16, at: 0.51, rate: 13, depth: 0.5 });
      fizz(a, h, { count: 70, dur: 1.4, low: 2400, high: 4500, peak: 0.12, at: 0.55 });
    })],
    ['회전톱 위잉 + 점점 느려짐 (1차)', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      churn(a, h, { freq: 1200 * k, to: 1900 * k, q: 3, dur: 0.5, attack: 0.03, release: 0.05, peak: 0.32, rate: 28, rateTo: 36, depth: 0.9 });
      clink(a, h, { base: 460 * k, peak: 0.5, at: 0.5, ring: 1.8 });
      crack(a, h, { at: 0.5, peak: 0.45, freq: 2200 * k });
      churn(a, h, { freq: 2400 * k, to: 1300 * k, q: 2.5, dur: 1.5, attack: 0.04, release: 0.35, peak: 0.34, at: 0.52, rate: 48, rateTo: 22, depth: 0.9 });
      churn(a, h, { type: 'lowpass', freq: 500 * k, to: 300 * k, q: 2, dur: 1.5, attack: 0.04, release: 0.35, peak: 0.18, at: 0.52, rate: 48, rateTo: 22, depth: 0.6 });
      fizz(a, h, { count: 50, dur: 1.3, low: 2200, high: 4400, peak: 0.1, at: 0.55 });
    })],
    ['톱날 박혀 끼이익 갈림', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      whoosh(a, h, { from: 500 * k, to: 1800 * k, dur: 0.48, q: 1.2, peak: 0.32 });
      clink(a, h, { base: 600 * k, peak: 0.5, at: 0.5, ring: 1.2 });
      crack(a, h, { at: 0.5, peak: 0.5, freq: 2600 * k });
      for (let i = 0; i < 6; i++) {
        const at = 0.52 + i * 0.25;
        swell(a, h, { type: 'bandpass', from: 2600 * k, to: 3400 * k, q: 6, rise: 0.04, release: 0.2, peak: 0.25, at });
        modal(a, h, { base: rnd(1100, 1300) * k, modes: ringFor(STEEL, 0.4), peak: 0.1, at, strike: 0.01 });
        fizz(a, h, { count: 10, dur: 0.2, low: 2600, high: 4500, peak: 0.14, at });
      }
      hum(a, h, { f0: 240 * k, glide: 0.85, dur: 1.5, attack: 0.03, release: 0.3, peak: 0.12, at: 0.51, width: 40 });
    })]
  ],
  // 울리는 쇠줄 (자력 + 소리): an iron wire strung taut (a zing and a clamp), then plucked five times 0.4 s apart from
  // 0.4 s, the glove's magnet a pickup under it like an electric guitar's.
  ironString: [
    ['쇠줄 팽 + 다섯 번 퉁김 (기타 줄)', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.18 });
      whoosh(a, h, { from: 800 * k, to: 2400 * k, dur: 0.2, peak: 0.2 });
      modal(a, h, { base: 900 * k, modes: STEEL, peak: 0.22, at: 0.18, strike: 0.004 });
      string(a, h, { freq: 110 * k, plucks: [0.4, 0.8, 1.2, 1.6, 2.0], ring: 1.1, peak: 0.6, bright: 0.6, drive: 2.2 });
      hum(a, h, { f0: 60 * k, dur: 2.3, attack: 0.3, release: 0.4, peak: 0.025, at: 0.3, width: 4 });
    })],
    ['쇠줄 높게 튕김 (강한 픽업)', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.18 });
      modal(a, h, { base: 1100 * k, modes: STEEL, peak: 0.25, at: 0.05, strike: 0.004 });
      clink(a, h, { base: 600 * k, peak: 0.25, at: 0.3 });
      string(a, h, { freq: 165 * k, plucks: [0.4, 0.8, 1.2, 1.6, 2.0], ring: 1.0, peak: 0.6, bright: 0.75, drive: 3.5, pickup: 0.12 });
    })],
    ['피아노선 같은 쇠줄 퉁', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.18 });
      whoosh(a, h, { from: 900 * k, to: 2600 * k, dur: 0.18, peak: 0.18 });
      const wire = [1, 2, 3, 4, 5, 6, 7].map(n => [n * Math.sqrt(1 + 0.004 * n * n), 1 / n, 1.1 / Math.sqrt(n)]);
      for (let i = 0; i < 5; i++) {
        const at = 0.4 + i * 0.4;
        modal(a, h, { base: 98 * k, modes: wire, peak: 0.5, at, strike: 0.006, detune: 0.7 });
        band(a, h, { freq: 2600 * k, q: 2, dur: 0.015, peak: 0.12, at });
      }
    })],
    ['굵은 쇠줄 퉁김 + 찌릿한 픽업', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.4, wet: 0.18 });
      whoosh(a, h, { from: 700 * k, to: 2200 * k, dur: 0.2, peak: 0.18 });
      clink(a, h, { base: 700 * k, peak: 0.25, at: 0.2, modes: STEEL, ring: 0.5 });
      string(a, h, { freq: 98 * k, plucks: [0.4, 0.8, 1.2, 1.6, 2.0], ring: 1.2, peak: 0.6, bright: 0.85, drive: 5, pickup: 0.1 });
      hum(a, h, { f0: 60 * k, dur: 2.3, attack: 0.3, release: 0.4, peak: 0.03, at: 0.3, width: 4 });
    })]
  ],
  // 자성 유체 덩굴 (자력 + 물): black ferrofluid creeping to the target, then stabbing up eight spikes 0.25 s apart.
  ferroVine: [
    ['검은 물 꿀렁 + 가시 찌르기 여덟', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      churn(a, h, { type: 'lowpass', freq: 600 * k, to: 380 * k, q: 4, dur: 0.6, attack: 0.05, release: 0.1, peak: 0.3, rate: 7, depth: 0.8 });
      grains(a, h, Array.from({ length: 10 }, () => ({ freq: rnd(140, 380) * k, at: Math.random() * 0.5, dur: 0.07, peak: 0.2, size: 2 })), 'bubble');
      for (let i = 0; i < 8; i++) {
        const at = 0.55 + i * 0.25;
        band(a, h, { freq: 2000 * k, to: 800 * k, q: 2.5, dur: 0.07, attack: 0.006, peak: 0.32, at });
        band(a, h, { type: 'lowpass', freq: 700 * k, to: 250 * k, q: 3, dur: 0.12, peak: 0.25, at: at + 0.01 });
        modal(a, h, { base: rnd(2200, 2700) * k, modes: ringFor(STEEL, 0.25), peak: 0.06, at, strike: 0.003 });
        grains(a, h, [{ freq: rnd(200, 360) * k, at: at + 0.04, dur: 0.06, peak: 0.12, size: 1.8 }], 'bubble');
      }
    })],
    ['자성 유체 스르륵 + 뾰족 솟음 여덟', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      hum(a, h, { f0: 75 * k, dur: 2.4, attack: 0.2, release: 0.3, peak: 0.05, width: 12 });
      churn(a, h, { freq: 450 * k, to: 700 * k, q: 3, dur: 0.6, attack: 0.05, release: 0.1, peak: 0.3, rate: 11, depth: 0.85 });
      for (let i = 0; i < 8; i++) {
        const at = 0.55 + i * 0.25;
        band(a, h, { freq: 600 * k, to: 2600 * k, q: 3, dur: 0.06, attack: 0.008, peak: 0.3, at });
        crack(a, h, { at: at + 0.05, peak: 0.18, freq: 2600 * k });
        band(a, h, { type: 'lowpass', freq: 500 * k, to: 200 * k, q: 4, dur: 0.14, peak: 0.25, at: at + 0.04 });
      }
    })],
    ['끈적한 물 철퍽 + 쇠가시 쉭 여덟', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
      for (let i = 0; i < 6; i++) band(a, h, { type: 'lowpass', freq: rnd(500, 900) * k, to: rnd(180, 300) * k, q: 5, dur: rnd(0.08, 0.14), attack: 0.01, peak: rnd(0.2, 0.32), at: i * 0.08 + Math.random() * 0.03 });
      grains(a, h, Array.from({ length: 8 }, () => ({ freq: rnd(160, 420) * k, at: Math.random() * 0.5, dur: 0.06, peak: 0.16, size: 2 })), 'bubble');
      for (let i = 0; i < 8; i++) {
        const at = 0.55 + i * 0.25;
        band(a, h, { type: 'lowpass', freq: 900 * k, to: 220 * k, q: 6, dur: 0.1, attack: 0.006, peak: 0.34, at });
        whoosh(a, h, { from: 1200 * k, to: 3200 * k, dur: 0.07, q: 2, peak: 0.2, at: at + 0.01 });
        clink(a, h, { base: rnd(1700, 2200) * k, peak: 0.08, at: at + 0.05, modes: ringFor(STEEL, 0.2) });
      }
    })],
    ['검은 물 질척 + 가시 찌걱 여덟', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.2, wet: 0.14 });
      for (let i = 0; i < 8; i++) band(a, h, { freq: rnd(300, 500) * k, to: rnd(900, 1400) * k, q: 6, dur: rnd(0.05, 0.08), attack: 0.008, peak: rnd(0.25, 0.4), at: i * 0.065 + Math.random() * 0.02 });
      band(a, h, { type: 'lowpass', freq: 400 * k, q: 2, dur: 0.55, attack: 0.05, peak: 0.2 });
      for (let i = 0; i < 8; i++) {
        const at = 0.55 + i * 0.25;
        band(a, h, { freq: 350 * k, to: 1500 * k, q: 7, dur: 0.05, attack: 0.006, peak: 0.45, at });
        band(a, h, { freq: 1300 * k, to: 400 * k, q: 6, dur: 0.07, attack: 0.006, peak: 0.3, at: at + 0.045 });
        modal(a, h, { base: rnd(2100, 2600) * k, modes: ringFor(STEEL, 0.3), peak: 0.07, at: at + 0.01, strike: 0.003 });
      }
    })]
  ],
  // 북극광 고리 (빛 + 자력): an aurora ring overhead for 3 s; from 0.3 s a curtain of light comes down every 0.5 s (six).
  auroraRing: [
    ['유리 하프 오로라 + 빛 커튼 내려옴 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
      swell(a, h, { from: 2000 * k, to: 3600 * k, rise: 0.3, release: 0.4, peak: 0.12 });
      harp(a, h, { base: 880 * k, dur: 3.1, attack: 0.4, release: 0.6, peak: 0.07 });
      harp(a, h, { base: 1318 * k, dur: 3.0, attack: 0.6, release: 0.6, peak: 0.045, at: 0.1 });
      hum(a, h, { f0: 75 * k, dur: 3.1, attack: 0.3, release: 0.5, peak: 0.05, width: 5 });
      for (let i = 0; i < 6; i++) {
        const at = 0.3 + i * 0.5;
        swell(a, h, { type: 'bandpass', from: 4200 * k, to: 1300 * k, q: 1.4, rise: 0.1, release: 0.3, peak: 0.22, at });
        sparkle(a, h, { count: 8, dur: 0.3, low: 2800, high: 4400, peak: 0.07, at, fall: 0.4 });
        thud(a, h, { from: 130 * k, to: 70 * k, dur: 0.2, peak: 0.12, at: at + 0.22 });
      }
    })],
    ['오로라 일렁 + 커튼 쏴아 여섯', recipe((a, o, k) => {
      const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
      churn(a, h, { type: 'highpass', freq: 2800 * k, q: 0.8, dur: 3.1, attack: 0.3, release: 0.4, peak: 0.07, rate: 3, depth: 0.7 });
      harp(a, h, { base: 990 * k, dur: 3.1, attack: 0.5, release: 0.6, peak: 0.06 });
      for (let i = 0; i < 6; i++) {
        const at = 0.3 + i * 0.5;
        whoosh(a, h, { from: 4000 * k, to: 900 * k, dur: 0.45, q: 0.9, swell: 0.3, peak: 0.3, at });
        hum(a, h, { f0: 110 * k, dur: 0.4, attack: 0.1, release: 0.25, peak: 0.07, at: at + 0.12, width: 10 });
      }
    })]
  ]
};
export const LIGHT_MAGNET_CANDIDATES = LM;
