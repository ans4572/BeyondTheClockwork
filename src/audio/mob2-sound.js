// Chapter 2's ordinary enemies' attacks (2026-11-09), built in code like coded.js and water-sound.js. One recipe per
// enemy type, played when its blow goes off (enemy-actions.js senses { kind: 'mob', id: type }); sfx.js sets the volume.
// Written soft from the start (the 2026-11-09 note that the element, mob and boss sounds "pop"): every layer rises over
// at least 5 ms, noise is kept under 5 kHz, there are no bare square or saw waves, and each play varies its pitch a little.
import { noise } from './water-sound.js';

const IRON = [[1, 1], [2.4, 0.55, 0.6], [3.9, 0.3, 0.4]];
/** A gain that rises over `attack` (5 ms at least), then falls away exponentially over `dur`. */
function env(a, at, attack, dur, peak) {
  const g = a.createGain(), t = a.currentTime + at, rise = Math.max(0.005, attack);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + rise); g.gain.exponentialRampToValueAtTime(0.0001, t + rise + dur);
  return g;
}
/** A sine or triangle gliding from `from` to `to`. */
function tone(a, o, { type = 'sine', from, to = from, glide, dur, attack = 0.006, peak = 1, at = 0 }) {
  const t = a.currentTime + at, osc = a.createOscillator(), g = env(a, at, attack, dur, peak);
  osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + (glide ?? dur));
  osc.connect(g).connect(o); osc.start(t); osc.stop(t + attack + dur + 0.05);
}
/** Filtered noise whose band sweeps from `freq` to `to`. */
function band(a, o, { type = 'bandpass', freq, to = freq, q = 1, dur, attack = 0.006, peak = 1, at = 0 }) {
  const t = a.currentTime + at, src = noise(a), f = a.createBiquadFilter(), g = env(a, at, attack, dur, peak);
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
  src.connect(f).connect(g).connect(o); src.start(t, Math.random()); src.stop(t + attack + dur + 0.05);
}
/** Air pushed aside: noise that swells while its band sweeps. */
function whoosh(a, o, { from, to, dur, q = 1.1, peak = 1, at = 0 }) {
  const t = a.currentTime + at, src = noise(a), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(o); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
/** Struck iron: a few inharmonic partials of `base` ringing out. */
function clang(a, o, { base, dur, peak = 0.3, at = 0 }) { for (const [ratio, level, length] of IRON) tone(a, o, { from: base * ratio, dur: dur * (length ?? 1), peak: peak * level, at }); }
/** A low thud. */
function thud(a, o, { from = 160, to = 60, dur = 0.16, peak = 0.8, at = 0 }) { tone(a, o, { from, to, glide: dur * 0.8, dur, peak, at }); }
/**
 * Where every recipe draws: a lowpass at 5 kHz in front of `out`, and the recipe's pitch nudged by up to ±3% so the
 * same enemy striking again and again does not sound stamped out.
 */
function soft(a, o) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 5000; f.Q.value = 0.5; f.connect(o); return f; }
const vary = () => 0.97 + Math.random() * 0.06;
const recipe = draw => (a, o) => draw(a, soft(a, o), vary());

export const MOB2_CANDIDATES = {
  // 집게 운반공: the grabber pole thrust out and its jaws snapping shut.
  clampCarrier: [['집게 뻗음 + 철컥', recipe((a, o, k) => {
    whoosh(a, o, { from: 320 * k, to: 1100 * k, dur: 0.15, peak: 0.55 });
    band(a, o, { freq: 1500 * k, q: 2.2, dur: 0.04, peak: 0.55, at: 0.13 });
    clang(a, o, { base: 430 * k, dur: 0.16, peak: 0.28, at: 0.13 });
  })]],
  // 도장 검사원: landing from its leap, the big rubber stamp thumps down.
  stampInspector: [['내려앉으며 도장 쿵', recipe((a, o, k) => {
    thud(a, o, { from: 210 * k, to: 70 * k, dur: 0.18, peak: 0.95 });
    band(a, o, { freq: 1000 * k, to: 480 * k, q: 0.9, dur: 0.11, peak: 0.5 });
    clang(a, o, { base: 170 * k, dur: 0.24, peak: 0.12 });
  })]],
  // 압축 경비: a steam-driven charge, a hiss of the valve and a heavy push off.
  pressGuard: [['증기 돌진', recipe((a, o, k) => {
    thud(a, o, { from: 120 * k, to: 50 * k, dur: 0.2, peak: 0.6 });
    band(a, o, { type: 'lowpass', freq: 2600 * k, to: 900 * k, q: 0.7, dur: 0.3, attack: 0.02, peak: 0.45 });
  })]],
  // 압축 경비대장: the same charge, heavier, its iron body ringing.
  pressCaptain: [['묵직한 증기 돌진', recipe((a, o, k) => {
    thud(a, o, { from: 95 * k, to: 38 * k, dur: 0.28, peak: 0.8 });
    band(a, o, { type: 'lowpass', freq: 2100 * k, to: 600 * k, q: 0.7, dur: 0.36, attack: 0.02, peak: 0.5 });
    clang(a, o, { base: 140 * k, dur: 0.4, peak: 0.12 });
  })]],
  // 렌즈 검수원: the inspection beam: a soft rising whine, no fizz on top.
  lensInspector: [['렌즈 빔 위잉', recipe((a, o, k) => {
    tone(a, o, { from: 880 * k, to: 1400 * k, dur: 0.2, attack: 0.02, peak: 0.34 });
    tone(a, o, { type: 'triangle', from: 1760 * k, to: 1500 * k, dur: 0.22, attack: 0.025, peak: 0.14, at: 0.04 });
    band(a, o, { freq: 2300 * k, q: 3, dur: 0.16, attack: 0.025, peak: 0.12, at: 0.03 });
  })]],
  // 리벳 사수: three rivets fired at once from an air gun, a muffled pneumatic thup thup thup.
  riveter: [['리벳 세 발 퉁', recipe((a, o, k) => {
    for (const [at, f] of [[0, 1], [0.035, 1.08], [0.07, 0.94]]) {
      thud(a, o, { from: 260 * k * f, to: 120 * k * f, dur: 0.07, peak: 0.55, at });
      band(a, o, { freq: 1300 * k * f, q: 2, dur: 0.035, peak: 0.3, at });
    }
  })]],
  // 테이프 포장공: charging with the tape gun, the tape tearing off the roll.
  tapePacker: [['테이프 찌익 돌진', recipe((a, o, k) => {
    band(a, o, { freq: 1700 * k, to: 3000 * k, q: 2.4, dur: 0.28, attack: 0.02, peak: 0.42 });
    band(a, o, { type: 'lowpass', freq: 900 * k, dur: 0.2, attack: 0.012, peak: 0.28 });
    thud(a, o, { from: 150 * k, to: 70 * k, dur: 0.1, peak: 0.4 });
  })]],
  // 기름칠공: an oil can flung through the air and landing in a thick splat.
  oiler: [['기름통 휙 + 철퍽', recipe((a, o, k) => {
    whoosh(a, o, { from: 420 * k, to: 1100 * k, dur: 0.16, peak: 0.38 });
    band(a, o, { type: 'lowpass', freq: 1300 * k, to: 280 * k, q: 0.8, dur: 0.2, peak: 0.6, at: 0.17 });
    tone(a, o, { from: 260 * k, to: 140 * k, dur: 0.08, peak: 0.28, at: 0.2 });
    tone(a, o, { from: 210 * k, to: 120 * k, dur: 0.08, peak: 0.2, at: 0.27 });
  })]],
  // 부품 보급공: brass plates handed out to its friends, a light clink of metal.
  partsSupplier: [['놋쇠판 달그락', recipe((a, o, k) => {
    for (const [at, f] of [[0, 1], [0.07, 1.26], [0.14, 1.12]]) clang(a, o, { base: 820 * k * f, dur: 0.14, peak: 0.22, at });
    band(a, o, { type: 'lowpass', freq: 700 * k, dur: 0.12, peak: 0.18 });
  })]]
};
