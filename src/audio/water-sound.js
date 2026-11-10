import { attackTime, pitch, grains } from './synthesis.js';
// Candidates for the water and sound elements' effects (2026-11-09), built in code like coded.js: two or three per
// sound, auditioned on a candidate page (archived 2026-11-09); sfx.js names the ones picked.
// Each recipe draws into `out` (a gain node) from now on; levels are relative and the page matches loudness.

let white = null;
function noise(audio) {
  if (!white || white.sampleRate !== audio.sampleRate) {
    white = audio.createBuffer(1, Math.ceil(audio.sampleRate * 2), audio.sampleRate);
    const d = white.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource(); source.buffer = white; source.loop = true; return source;
}
/** A gain that rises in `attack`, then falls away exponentially over `dur`. */
function decay(audio, at, attack, dur, peak) {
  const g = audio.createGain(), t = audio.currentTime + at;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  return g;
}
/** A tone gliding from `from` to `to`. */
function tone(audio, out, { type = 'sine', from, to = from, glide, dur, attack = 0.003, peak = 1, at = 0 }) {
  attack = attackTime(audio, attack);
  from *= pitch(audio); to *= pitch(audio);
  const t = audio.currentTime + at, osc = audio.createOscillator(), g = decay(audio, at, attack, dur, peak);
  osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + (glide ?? dur));
  let body = osc;
  if (!audio.sfxMenu && (type === 'square' || type === 'sawtooth')) { const f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2800; f.Q.value = 0.5; body = osc.connect(f); }
  body.connect(g).connect(out); osc.start(t); osc.stop(t + attack + dur + 0.05);
}
/** Filtered noise, its band swept from `freq` to `to`. */
function band(audio, out, { type = 'bandpass', freq, to = freq, q = 1, dur, attack = 0.002, peak = 1, at = 0 }) {
  attack = attackTime(audio, attack);
  freq *= pitch(audio); to *= pitch(audio);
  const t = audio.currentTime + at, src = noise(audio), f = audio.createBiquadFilter(), g = decay(audio, at, attack, dur, peak);
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
  src.connect(f).connect(g).connect(out); src.start(t, Math.random()); src.stop(t + attack + dur + 0.05);
}
/** Air or water pushed: noise that swells while its band sweeps, then lets go. */
function whoosh(audio, out, { from, to, dur, q = 1.2, swell = 0.45, peak = 1, at = 0, type = 'bandpass' }) {
  from *= pitch(audio); to *= pitch(audio);
  const t = audio.currentTime + at, src = noise(audio), f = audio.createBiquadFilter(), g = audio.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.008, dur * swell)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
/** A struck metal or glass body: inharmonic partials of `base` ringing out. */
function ring(audio, out, { base, dur, partials = GONG, peak = 1, at = 0, beat = 0 }) {
  const events = partials.flatMap(([ratio, level, length = 1]) => {
    const body = { freq: base * ratio, dur: dur * length, peak: peak * level, at };
    return beat ? [body, { ...body, freq: base * ratio + beat, peak: body.peak * 0.6 }] : [body];
  });
  grains(audio, out, events, 'tone');
}
const GONG = [[1, 1], [2.76, 0.5, 0.7], [5.4, 0.25, 0.45], [8.93, 0.12, 0.3]];
const BOWL = [[1, 1], [2.71, 0.45, 0.8], [5.2, 0.18, 0.5]];
const GLASS = [[1, 1], [2.32, 0.5, 0.6], [4.25, 0.3, 0.4], [6.63, 0.15, 0.25]];
/** A short run of pitched notes [freq, at]. */
function notes(audio, out, list, { type = 'triangle', dur = 0.2, peak = 0.4 } = {}) { for (const [freq, at] of list) tone(audio, out, { type, from: freq, dur, peak, at }); }
/** One bubble: a sine flicking upward in pitch, the sound of air leaving water. */
function bubble(audio, out, { freq, at = 0, peak = 0.4, size = 1 }) { tone(audio, out, { from: freq, to: freq * (1.6 + size * 0.4), glide: 0.03 * size, dur: 0.04 * size, attack: 0.001, peak, at }); }
/** Many bubbles at random over `dur`. */
function bubbles(audio, out, { count, dur, low = 300, high = 1100, peak = 0.35, at = 0 }) {
  const events = Array.from({ length: count }, () => { const freq = low + Math.random() * (high - low), when = at + Math.random() * dur, level = peak * (0.5 + Math.random() * 0.5), size = 0.7 + Math.random() * 0.8; return { freq, at: when, peak: level, size, dur: 0.04 * size }; });
  grains(audio, out, events, 'bubble');
}
/** Water thrown down: a burst of bright noise with droplets after it. */
function splash(audio, out, { peak = 1, at = 0, size = 1, body = 0.5, droplets = 0.25 }) {
  band(audio, out, { type: 'highpass', freq: 1400 / size, dur: 0.18 * size, attack: 0.004, peak: peak * 0.7, at });
  band(audio, out, { type: 'bandpass', freq: 700 / size, to: 300 / size, q: 0.8, dur: 0.22 * size, attack: 0.003, peak: peak * body, at });
  bubbles(audio, out, { count: Math.round(6 * size), dur: 0.3 * size, peak: peak * droplets, at: at + 0.04, low: 600, high: 1800 });
}
/** A hose under pressure: hissing noise whose level flutters, `dur` long. */
function spray(audio, out, { dur, cutoff = 2200, flutter = 18, peak = 1, at = 0 }) {
  const t = audio.currentTime + at, src = noise(audio), f = audio.createBiquadFilter(), g = audio.createGain(), lfo = audio.createOscillator(), depth = audio.createGain();
  f.type = 'highpass'; f.frequency.value = cutoff; f.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.05); g.gain.setValueAtTime(peak, t + dur - 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lfo.frequency.value = flutter; depth.gain.value = 0.22; const am = audio.createGain(); am.gain.value = 0.78; lfo.connect(depth).connect(am.gain);
  src.connect(f).connect(am).connect(g).connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
}
/** A low swelling hum with a slow beat between two close tones: something gathering power. */
function charge(audio, out, { from, to, dur, peak = 0.5, at = 0, type = 'sawtooth', cutoff = 900 }) {
  const t = audio.currentTime + at, f = audio.createBiquadFilter(), g = audio.createGain();
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff * 0.5, t); f.frequency.exponentialRampToValueAtTime(cutoff * 2, t + dur); f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  for (const detune of [0, 3.5]) { const osc = audio.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(from + detune, t); osc.frequency.exponentialRampToValueAtTime(to + detune, t + dur); osc.connect(f); osc.start(t); osc.stop(t + dur + 0.1); }
  f.connect(g).connect(out);
}
/** A pulse that throbs `rate` times a second: the wobble of a ringing body. */
function throb(audio, out, { freq, rate, dur, peak = 0.5, at = 0, type = 'sine' }) {
  if (type === 'sine') { grains(audio, out, [{ freq, rate, dur, peak, at }], 'tone'); return; }
  const t = audio.currentTime + at, osc = audio.createOscillator(), g = decay(audio, at, 0.01, dur, peak), am = audio.createGain(), lfo = audio.createOscillator(), depth = audio.createGain();
  osc.type = type; osc.frequency.value = freq * pitch(audio); lfo.frequency.value = rate; depth.gain.value = 0.5; am.gain.value = 0.5;
  lfo.connect(depth).connect(am.gain); osc.connect(am).connect(g).connect(out);
  osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
/** Brittle bits: many tiny bright clicks at random over `dur`. */
function crackle(audio, out, { count, dur, low = 2500, high = 7000, peak = 0.4, at = 0 }) {
  grains(audio, out, Array.from({ length: count }, () => ({ freq: Math.min(4600, (low + Math.random() * (high - low)) * 0.88), q: 2.5, dur: 0.025 + Math.random() * 0.03, peak: peak * 0.8 * (0.4 + Math.random() * 0.6), at: at + Math.random() * dur })));
}
/** An electric crack and buzz. */
function zap(audio, out, { dur = 0.3, peak = 0.6, at = 0, freq = 110 }) {
  band(audio, out, { type: 'highpass', freq: 2500, dur: 0.07, attack: 0.001, peak, at });
  const t = audio.currentTime + at, osc = audio.createOscillator(), f = audio.createBiquadFilter(), g = decay(audio, at, 0.005, dur, peak * 0.5);
  osc.type = 'sawtooth'; osc.frequency.value = freq * pitch(audio); f.type = 'lowpass'; f.frequency.value = 2600; osc.connect(f).connect(g).connect(out); osc.start(t); osc.stop(t + dur + 0.05);
  crackle(audio, out, { count: 8, dur, peak: peak * 0.6, at });
}
/** A low thud under a blow. */
const thump = (a, o, { from = 120, to = 45, dur = 0.3, peak = 0.8, at = 0 } = {}) => tone(a, o, { from, to, dur, peak, at, glide: dur * 0.8 });

export const WATER_SOUND_CANDIDATES = {
  // ---- Sound element
  ringPalm: [
    ['손바닥 + 징 울림', (a, o) => { thump(a, o, { from: 150, to: 70, dur: 0.18, peak: 0.7 }); band(a, o, { freq: 1200, q: 0.8, dur: 0.05, peak: 0.6 }); ring(a, o, { base: 220, dur: 0.9, peak: 0.35, partials: GONG }); }],
    ['둥- 하는 공명 그릇', (a, o) => { thump(a, o, { from: 130, to: 60, dur: 0.15, peak: 0.6 }); ring(a, o, { base: 330, dur: 1.1, peak: 0.4, partials: BOWL, beat: 2.5 }); }],
    ['짧은 음파 퍽', (a, o) => { whoosh(a, o, { from: 500, to: 2400, dur: 0.16, q: 2, peak: 0.6 }); thump(a, o, { from: 180, to: 80, dur: 0.12, peak: 0.6 }); throb(a, o, { freq: 440, rate: 22, dur: 0.35, peak: 0.25, at: 0.04 }); }],
  ],
  roarCharge: [
    ['낮게 차오르는 웅-', (a, o) => { charge(a, o, { from: 70, to: 140, dur: 0.6, peak: 0.45 }); }],
    ['떨리며 높아지는 공명', (a, o) => { charge(a, o, { from: 110, to: 330, dur: 0.6, peak: 0.35, type: 'triangle', cutoff: 1400 }); throb(a, o, { freq: 220, rate: 12, dur: 0.6, peak: 0.15 }); }],
    ['숨 들이켜는 바람 + 울림', (a, o) => { whoosh(a, o, { from: 300, to: 1500, dur: 0.6, swell: 0.9, q: 1, peak: 0.4 }); charge(a, o, { from: 90, to: 180, dur: 0.6, peak: 0.25 }); }],
  ],
  roar: [
    ['쿠웅 음파 기둥', (a, o) => { thump(a, o, { from: 110, to: 38, dur: 0.6, peak: 0.9 }); whoosh(a, o, { from: 1800, to: 300, dur: 0.6, swell: 0.12, q: 0.8, peak: 0.6 }); throb(a, o, { freq: 165, rate: 16, dur: 0.6, peak: 0.25 }); }],
    ['확성기 같은 와앙', (a, o) => { charge(a, o, { from: 220, to: 160, dur: 0.45, peak: 0.45, cutoff: 2200 }); band(a, o, { freq: 900, to: 400, q: 1.2, dur: 0.5, attack: 0.01, peak: 0.5 }); thump(a, o, { from: 95, to: 40, dur: 0.4, peak: 0.6 }); }],
    ['충격파 + 메아리', (a, o) => { thump(a, o, { from: 140, to: 45, dur: 0.35, peak: 0.8 }); for (const [at, k] of [[0, 1], [0.16, 0.5], [0.32, 0.25]]) whoosh(a, o, { from: 2400, to: 500, dur: 0.25, swell: 0.1, q: 1.4, peak: 0.55 * k, at }); }],
  ],
  resonanceBurst: [
    ['유리잔 깨지듯 쨍', (a, o) => { ring(a, o, { base: 1320, dur: 0.5, peak: 0.35, partials: GLASS }); crackle(a, o, { count: 14, dur: 0.25, peak: 0.45 }); thump(a, o, { from: 160, to: 70, dur: 0.15, peak: 0.4 }); }],
    ['종이 터지는 댕-', (a, o) => { ring(a, o, { base: 523, dur: 0.8, peak: 0.4, partials: GONG }); band(a, o, { type: 'highpass', freq: 3000, dur: 0.12, peak: 0.4 }); }],
    ['화음이 한꺼번에 퍼짐', (a, o) => { notes(a, o, [[523, 0], [659, 0.015], [784, 0.03], [1047, 0.045]], { type: 'sine', dur: 0.6, peak: 0.22 }); whoosh(a, o, { from: 3000, to: 800, dur: 0.35, swell: 0.1, peak: 0.35 }); }],
  ],
  // ---- Water element
  waterCannon: [
    ['퓻퓻퓻 세 발', (a, o) => { for (const at of [0, 0.07, 0.14]) { whoosh(a, o, { from: 900, to: 2600, dur: 0.12, q: 1.6, swell: 0.3, peak: 0.6, at }); bubble(a, o, { freq: 500, at: at + 0.02, peak: 0.25 }); } }],
    ['쏴아 물살 한 번', (a, o) => { whoosh(a, o, { from: 1600, to: 4200, dur: 0.3, q: 0.7, swell: 0.2, peak: 0.7, type: 'highpass' }); bubbles(a, o, { count: 8, dur: 0.25, peak: 0.25, at: 0.05 }); }],
    ['펌프 + 물방울', (a, o) => { thump(a, o, { from: 160, to: 90, dur: 0.12, peak: 0.5 }); for (const at of [0.02, 0.09, 0.16]) band(a, o, { freq: 1800, to: 900, q: 1.2, dur: 0.08, peak: 0.5, at }); bubbles(a, o, { count: 10, dur: 0.3, peak: 0.25, at: 0.1 }); }],
  ],
  hydroJet: [
    ['고압 호스 쉬이익 (1.5초)', (a, o) => { spray(a, o, { dur: 1.5, cutoff: 2000, flutter: 20, peak: 0.55 }); band(a, o, { type: 'lowpass', freq: 400, dur: 1.5, attack: 0.05, peak: 0.25 }); bubbles(a, o, { count: 18, dur: 1.4, peak: 0.15 }); }],
    ['물줄기 + 꿀렁임', (a, o) => { spray(a, o, { dur: 1.5, cutoff: 3000, flutter: 9, peak: 0.45 }); throb(a, o, { freq: 95, rate: 7, dur: 1.5, peak: 0.25 }); }],
    ['소방 호스 굵은 물살', (a, o) => { spray(a, o, { dur: 1.5, cutoff: 900, flutter: 26, peak: 0.6 }); whoosh(a, o, { from: 600, to: 1400, dur: 1.5, swell: 0.1, q: 0.6, peak: 0.25 }); }],
  ],
  splash: [
    ['찰싹 물보라', (a, o) => { splash(a, o, { peak: 0.8 }); }],
    ['톡톡 물방울', (a, o) => { bubbles(a, o, { count: 7, dur: 0.18, low: 900, high: 2200, peak: 0.4 }); band(a, o, { type: 'highpass', freq: 3500, dur: 0.06, peak: 0.25 }); }],
  ],
  // ---- Fusions with sound or water
  overheatResonance: [
    ['달궈지는 울림 → 퍽퍽퍽', (a, o) => { throb(a, o, { freq: 180, rate: 9, dur: 0.8, peak: 0.3 }); band(a, o, { type: 'lowpass', freq: 700, dur: 0.8, attack: 0.3, peak: 0.3 }); for (const at of [0.8, 1.1, 1.4]) { thump(a, o, { from: 130, to: 50, dur: 0.25, peak: 0.6, at }); ring(a, o, { base: 330, dur: 0.3, peak: 0.15, at }); } }],
    ['끓는 종소리 세 번', (a, o) => { for (const at of [0.8, 1.1, 1.4]) { ring(a, o, { base: 262, dur: 0.4, peak: 0.3, at, partials: GONG }); band(a, o, { freq: 600, q: 0.7, dur: 0.25, peak: 0.35, at }); } crackle(a, o, { count: 18, dur: 1.6, low: 1500, high: 4500, peak: 0.3 }); }],
  ],
  steamVeil: [
    ['증기 치익 (2초)', (a, o) => { spray(a, o, { dur: 2, cutoff: 4000, flutter: 4, peak: 0.45 }); band(a, o, { type: 'lowpass', freq: 500, dur: 2, attack: 0.2, peak: 0.25 }); bubbles(a, o, { count: 16, dur: 1.9, low: 200, high: 600, peak: 0.2 }); }],
    ['끓는 주전자', (a, o) => { bubbles(a, o, { count: 40, dur: 2, low: 150, high: 500, peak: 0.3 }); whoosh(a, o, { from: 2500, to: 5000, dur: 2, swell: 0.7, q: 0.6, peak: 0.3, type: 'highpass' }); }],
  ],
  highNoteShatter: [
    ['얼음 쩡 → 높은 음 와장창', (a, o) => { ring(a, o, { base: 820, dur: 0.4, peak: 0.3, partials: GLASS }); tone(a, o, { from: 1568, to: 2637, glide: 0.25, dur: 0.35, peak: 0.25, at: 0.35 }); crackle(a, o, { count: 22, dur: 0.35, peak: 0.5, at: 0.55 }); thump(a, o, { from: 200, to: 80, dur: 0.2, peak: 0.4, at: 0.55 }); }],
    ['소프라노 한 음에 금 감', (a, o) => { throb(a, o, { freq: 1760, rate: 6, dur: 0.55, peak: 0.2 }); ring(a, o, { base: 2093, dur: 0.5, peak: 0.3, partials: GLASS, at: 0.5 }); crackle(a, o, { count: 18, dur: 0.3, peak: 0.45, at: 0.5 }); }],
  ],
  iceSheet: [
    ['물 깔림 → 쩌억 깨짐', (a, o) => { splash(a, o, { peak: 0.5, size: 1.4 }); band(a, o, { type: 'highpass', freq: 5000, dur: 0.5, attack: 0.1, peak: 0.2, at: 0.1 }); ring(a, o, { base: 640, dur: 0.6, peak: 0.25, partials: GLASS, at: 0.15 }); }],
    ['빙판 얼어붙음 (깔릴 때)', (a, o) => { whoosh(a, o, { from: 600, to: 3000, dur: 0.5, swell: 0.5, q: 0.8, peak: 0.4 }); crackle(a, o, { count: 16, dur: 0.5, peak: 0.2, at: 0.1 }); tone(a, o, { from: 180, to: 90, dur: 0.3, peak: 0.4 }); }],
  ],
  resonantBolt: [
    ['낙뢰 + 웅웅 울림', (a, o) => { zap(a, o, { dur: 0.3, peak: 0.7 }); thump(a, o, { from: 90, to: 35, dur: 0.5, peak: 0.7 }); for (const at of [0.5, 1.0, 1.5, 2.0]) { throb(a, o, { freq: 220, rate: 18, dur: 0.25, peak: 0.25, at }); band(a, o, { type: 'highpass', freq: 3000, dur: 0.05, peak: 0.25, at }); } }],
    ['찌릿한 종소리', (a, o) => { zap(a, o, { dur: 0.25, peak: 0.6 }); ring(a, o, { base: 440, dur: 0.5, peak: 0.25, partials: GONG, beat: 6, at: 0.05 }); }],
  ],
  shockPool: [
    ['웅덩이 퐁당 + 찌직 (3초)', (a, o) => { splash(a, o, { peak: 0.6, body: 1.2, droplets: 0.08 }); for (let at = 0.5; at < 3; at += 0.5) { band(a, o, { type: 'highpass', freq: 2800, dur: 0.06, peak: 0.35, at }); crackle(a, o, { count: 5, dur: 0.12, peak: 0.3, at }); } }],
    ['물속 전기 웅-', (a, o) => { splash(a, o, { peak: 0.5 }); throb(a, o, { freq: 60, rate: 2, dur: 3, peak: 0.3, type: 'sawtooth' }); for (let at = 0.5; at < 3; at += 0.5) bubbles(a, o, { count: 4, dur: 0.15, peak: 0.25, at }); }],
  ],
  echoGust: [
    ['휘익 → 휘익 (갔다 옴)', (a, o) => { whoosh(a, o, { from: 500, to: 2200, dur: 0.45, q: 1.6, peak: 0.6 }); throb(a, o, { freq: 330, rate: 20, dur: 0.4, peak: 0.2 }); whoosh(a, o, { from: 2200, to: 500, dur: 0.45, q: 1.6, peak: 0.45, at: 0.55 }); throb(a, o, { freq: 330, rate: 20, dur: 0.4, peak: 0.12, at: 0.55 }); }],
    ['고리 바람 + 메아리 음', (a, o) => { whoosh(a, o, { from: 700, to: 1800, dur: 0.5, q: 2.4, peak: 0.5 }); for (const [at, k] of [[0.1, 1], [0.55, 0.6], [0.8, 0.3]]) ring(a, o, { base: 392, dur: 0.25, peak: 0.2 * k, partials: BOWL, at }); }],
  ],
  waterspout: [
    ['소용돌이 물기둥 → 철퍽', (a, o) => { spray(a, o, { dur: 2, cutoff: 1200, flutter: 6, peak: 0.45 }); whoosh(a, o, { from: 300, to: 900, dur: 2, swell: 0.8, q: 1, peak: 0.3 }); splash(a, o, { peak: 0.9, size: 1.6, at: 2 }); thump(a, o, { from: 110, to: 40, dur: 0.4, peak: 0.7, at: 2 }); }],
    ['빨아올림 꾸르륵 → 쾅', (a, o) => { bubbles(a, o, { count: 30, dur: 2, low: 200, high: 700, peak: 0.25 }); throb(a, o, { freq: 80, rate: 5, dur: 2, peak: 0.25 }); thump(a, o, { from: 120, to: 35, dur: 0.5, peak: 0.9, at: 2 }); splash(a, o, { peak: 0.7, size: 1.3, at: 2 }); }],
  ],
  surfaceResonance: [
    ['물막 깔림 + 맑은 울림', (a, o) => { splash(a, o, { peak: 0.35, size: 1.5 }); ring(a, o, { base: 523, dur: 1.0, peak: 0.25, partials: BOWL, beat: 1.5, at: 0.1 }); }],
    ['물방울 실로폰', (a, o) => { notes(a, o, [[784, 0], [988, 0.08], [1175, 0.16], [1568, 0.24]], { type: 'sine', dur: 0.25, peak: 0.25 }); bubbles(a, o, { count: 8, dur: 0.4, peak: 0.2 }); }],
  ],
  surfaceResonanceHit: [
    ['물막 전체가 울림 (맞을 때마다)', (a, o) => { ring(a, o, { base: 659, dur: 0.35, peak: 0.3, partials: BOWL }); bubbles(a, o, { count: 5, dur: 0.15, peak: 0.2 }); }],
    ['물결 퍼지는 웅', (a, o) => { throb(a, o, { freq: 330, rate: 14, dur: 0.3, peak: 0.25 }); band(a, o, { freq: 900, to: 400, q: 1.5, dur: 0.25, peak: 0.3 }); }],
  ],
};

/** The building blocks, for the chapter 2 boss candidates (boss2-sound.js). */
export { noise, decay, tone, band, whoosh, ring, GONG, BOWL, GLASS, notes, bubble, bubbles, splash, spray, charge, throb, crackle, zap, thump };
