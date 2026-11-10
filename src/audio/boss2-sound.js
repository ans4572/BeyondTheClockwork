import { grains, pitch } from './synthesis.js';
// Candidates for chapter 2's bosses, Inspector Iris and Director Press (2026-11-09), built in code like the rest:
// two per sound, auditioned on a candidate page (archived 2026-11-09); sfx.js names the ones picked.
// Each recipe draws into `out` (a gain node) from now on; levels are relative and the page matches loudness.
import { noise, tone, band, whoosh, ring, GONG, GLASS, notes, crackle, zap, thump, spray, charge, throb } from './water-sound.js';

const METAL = [[1, 1], [2.4, 0.6, 0.6], [3.9, 0.35, 0.4], [6.1, 0.2, 0.3]];
/** A struck iron body: a short low knock and its clang. */
function clank(a, o, { base = 180, dur = 0.35, peak = 0.6, at = 0 } = {}) { band(a, o, { freq: 2200, q: 1.5, dur: 0.03, peak: peak * 0.55, at }); ring(a, o, { base, dur, peak: peak * 0.5, partials: METAL, at }); }
/** A heavy slam: a deep falling thud, a crunch of noise and an iron ring. */
function slam(a, o, { peak = 1, at = 0, base = 90 } = {}) { thump(a, o, { from: base * 1.6, to: base * 0.4, dur: 0.45, peak, at }); band(a, o, { type: 'lowpass', freq: 900, dur: 0.25, attack: 0.004, peak: peak * 0.6, at }); ring(a, o, { base: base * 1.4, dur: 0.6, peak: peak * 0.18, partials: METAL, at }); }
/** A motor: a buzzing tone through a lowpass with a quick wobble, rising or falling. */
function motor(a, o, { from, to, dur, peak = 0.4, at = 0, rate = 30 }) {
  const t = a.currentTime + at, osc = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(), lfo = a.createOscillator(), depth = a.createGain();
  osc.type = 'sawtooth'; osc.frequency.setValueAtTime(from * pitch(a), t); osc.frequency.exponentialRampToValueAtTime(to * pitch(a), t + dur);
  f.type = 'lowpass'; f.frequency.value = 900; lfo.frequency.value = rate; depth.gain.value = 0.2; const am = a.createGain(); am.gain.value = 0.8; lfo.connect(depth).connect(am.gain);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.06); g.gain.setValueAtTime(peak, t + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(f).connect(am).connect(g).connect(o); osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
/** A rattle of evenly spaced clicks: chains, conveyor rollers, a ratchet. */
function rattle(a, o, { count, gap, freq = 3000, peak = 0.4, at = 0 }) { grains(a, o, Array.from({ length: count }, (_, i) => ({ freq: freq * (0.9 + Math.random() * 0.2), q: 3, dur: 0.025, peak: peak * 0.8, at: at + i * gap }))); }
/** A whistle or siren: a pure tone with vibrato, gliding. */
function whistle(a, o, { from, to = from, dur, peak = 0.3, at = 0, vibrato = 6 }) {
  const t = a.currentTime + at, osc = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), depth = a.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(from, t); osc.frequency.linearRampToValueAtTime(to, t + dur); lfo.frequency.value = vibrato; depth.gain.value = from * 0.02; lfo.connect(depth).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.03); g.gain.setValueAtTime(peak, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o); osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
/** A laser: a bright whine sweeping down with a fizz on top. */
function laser(a, o, { from = 2400, to = 900, dur = 0.35, peak = 0.4, at = 0 } = {}) { tone(a, o, { type: 'square', from, to, dur, peak: peak * 0.35, at }); tone(a, o, { from: from * 1.5, to: to * 1.5, dur, peak: peak * 0.4, at }); band(a, o, { type: 'highpass', freq: 5000, dur: dur * 0.8, peak: peak * 0.2, at }); }
/** A rubber stamp landing: a dull knock and a short papery slap. */
function stampHit(a, o, { peak = 0.8, at = 0 } = {}) { thump(a, o, { from: 220, to: 90, dur: 0.12, peak, at }); band(a, o, { freq: 1600, to: 700, q: 0.8, dur: 0.08, peak: peak * 0.6, at }); }

export const BOSS2_CANDIDATES = {
  // ---- Inspector Iris
  'boss-irisLaser': [
    ['탐조등 위잉 → 치익 레이저', (a, o) => { tone(a, o, { from: 600, to: 1800, dur: 0.15, peak: 0.25 }); laser(a, o, { from: 2600, to: 1100, dur: 0.4, peak: 0.6, at: 0.12 }); }],
    ['렌즈 섬광 핑 + 빔', (a, o) => { notes(a, o, [[2637, 0]], { type: 'sine', dur: 0.15, peak: 0.3 }); zap(a, o, { dur: 0.35, peak: 0.45, freq: 220, at: 0.05 }); }],
  ],
  'boss-rejectStamps': [
    ['고무도장 쿵 (하나 떨어질 때마다)', (a, o) => { stampHit(a, o, { peak: 0.8 }); }],
    ['철컥 도장 + 종이 펄럭', (a, o) => { clank(a, o, { base: 420, dur: 0.15, peak: 0.4 }); stampHit(a, o, { peak: 0.6, at: 0.03 }); whoosh(a, o, { from: 1200, to: 3000, dur: 0.15, q: 0.8, peak: 0.25, at: 0.05 }); }],
  ],
  'boss-verdict': [
    ['큰 도장 쾅 + 판사봉 딱', (a, o) => { band(a, o, { freq: 1800, q: 2, dur: 0.03, peak: 0.6 }); slam(a, o, { peak: 0.9, at: 0.05, base: 110 }); }],
    ['판정 경고음 + 쾅', (a, o) => { notes(a, o, [[880, 0], [660, 0.12]], { type: 'square', dur: 0.1, peak: 0.15 }); stampHit(a, o, { peak: 1, at: 0.26 }); thump(a, o, { from: 150, to: 45, dur: 0.4, peak: 0.6, at: 0.26 }); }],
  ],
  'boss-tapeMeasure': [
    ['줄자 촤르륵 → 감기 드르륵', (a, o) => { rattle(a, o, { count: 12, gap: 0.018, freq: 3500, peak: 0.35 }); whoosh(a, o, { from: 1500, to: 4000, dur: 0.22, q: 1.4, peak: 0.3 }); rattle(a, o, { count: 16, gap: 0.025, freq: 2600, peak: 0.3, at: 0.35 }); }],
    ['스프링 튕김 + 찰칵', (a, o) => { tone(a, o, { type: 'triangle', from: 300, to: 1200, dur: 0.18, peak: 0.3 }); throb(a, o, { freq: 520, rate: 28, dur: 0.3, peak: 0.2 }); clank(a, o, { base: 900, dur: 0.1, peak: 0.35, at: 0.3 }); }],
  ],
  'boss-decoys': [
    ['렌즈 셔터 찰칵 세 번', (a, o) => { for (const at of [0, 0.1, 0.2]) { band(a, o, { freq: 3000, q: 3, dur: 0.02, peak: 0.5, at }); band(a, o, { freq: 1200, q: 2, dur: 0.04, peak: 0.3, at: at + 0.02 }); } ring(a, o, { base: 1760, dur: 0.4, peak: 0.12, partials: GLASS, at: 0.25 }); }],
    ['유리 반짝 화음', (a, o) => { notes(a, o, [[1319, 0], [1568, 0.05], [1976, 0.1]], { type: 'sine', dur: 0.5, peak: 0.2 }); whoosh(a, o, { from: 3000, to: 6000, dur: 0.4, q: 1, peak: 0.15 }); }],
  ],
  'boss-crossLaser': [
    ['낮은 회전 웅웅 + 네 갈래 빔 (3초)', (a, o) => { laser(a, o, { from: 1800, to: 1400, dur: 0.3, peak: 0.5 }); throb(a, o, { freq: 140, rate: 4, dur: 3, peak: 0.25, type: 'sawtooth' }); band(a, o, { type: 'highpass', freq: 4500, dur: 3, attack: 0.1, peak: 0.08 }); }],
    ['높은 빔 지이잉 (3초)', (a, o) => { tone(a, o, { type: 'square', from: 1200, to: 1250, dur: 3, peak: 0.08, attack: 0.05 }); tone(a, o, { from: 2400, to: 2380, dur: 3, peak: 0.12, attack: 0.05 }); zap(a, o, { dur: 0.25, peak: 0.4 }); }],
  ],
  'boss-gridCheck': [
    ['측정기 삑삑 → 펑', (a, o) => { notes(a, o, [[1760, 0], [1760, 0.14], [2349, 0.28]], { type: 'square', dur: 0.06, peak: 0.12 }); thump(a, o, { from: 160, to: 50, dur: 0.35, peak: 0.7, at: 0.4 }); band(a, o, { type: 'lowpass', freq: 1200, dur: 0.3, peak: 0.5, at: 0.4 }); }],
    ['검사 완료 땡 + 펑펑', (a, o) => { ring(a, o, { base: 1046, dur: 0.4, peak: 0.25, partials: GONG }); for (const at of [0.3, 0.4, 0.5]) thump(a, o, { from: 140, to: 55, dur: 0.22, peak: 0.5, at }); }],
  ],
  'boss-mirrorTurn': [
    ['거울판 철컥 (45도 돌 때마다)', (a, o) => { clank(a, o, { base: 700, dur: 0.12, peak: 0.4 }); rattle(a, o, { count: 3, gap: 0.04, freq: 2400, peak: 0.25, at: 0.02 }); }],
    ['톱니 딸깍', (a, o) => { rattle(a, o, { count: 2, gap: 0.05, freq: 3200, peak: 0.45 }); tone(a, o, { from: 900, to: 1200, dur: 0.06, peak: 0.15 }); }],
  ],
  'boss-mirrorLit': [
    ['빛 되돌림 띠링', (a, o) => { notes(a, o, [[1568, 0], [2093, 0.08], [2637, 0.16]], { type: 'sine', dur: 0.4, peak: 0.25 }); whoosh(a, o, { from: 2000, to: 6000, dur: 0.3, q: 1, peak: 0.2 }); }],
    ['렌즈 맞음 쨍', (a, o) => { ring(a, o, { base: 1760, dur: 0.6, peak: 0.3, partials: GLASS }); laser(a, o, { from: 1800, to: 3600, dur: 0.25, peak: 0.3 }); }],
  ],
  // ---- Director Press
  'boss-plateDrop': [
    ['무거운 쾅 + 쇳소리', (a, o) => { whoosh(a, o, { from: 400, to: 1200, dur: 0.15, swell: 0.9, q: 0.8, peak: 0.25 }); slam(a, o, { peak: 1, at: 0.15 }); }],
    ['쿵 + 먼지', (a, o) => { thump(a, o, { from: 110, to: 35, dur: 0.6, peak: 1 }); band(a, o, { type: 'lowpass', freq: 600, dur: 0.6, attack: 0.01, peak: 0.5 }); crackle(a, o, { count: 10, dur: 0.4, low: 800, high: 2000, peak: 0.2, at: 0.05 }); }],
  ],
  'boss-armSlam': [
    ['유압 쉬익 → 쾅', (a, o) => { spray(a, o, { dur: 0.3, cutoff: 2500, flutter: 30, peak: 0.35 }); slam(a, o, { peak: 0.9, at: 0.25, base: 80 }); }],
    ['금속 팔 휘두름 + 박힘 끼익', (a, o) => { whoosh(a, o, { from: 300, to: 1100, dur: 0.3, q: 1, peak: 0.45 }); slam(a, o, { peak: 0.8, at: 0.28 }); tone(a, o, { type: 'sawtooth', from: 900, to: 700, dur: 0.4, peak: 0.08, at: 0.4 }); }],
  ],
  'boss-lineShift': [
    ['컨베이어 철컥 + 덜컹덜컹', (a, o) => { clank(a, o, { base: 160, dur: 0.3, peak: 0.6 }); rattle(a, o, { count: 10, gap: 0.09, freq: 900, peak: 0.35, at: 0.15 }); motor(a, o, { from: 50, to: 70, dur: 1, peak: 0.25, at: 0.1 }); }],
    ['기어 전환 끼이익', (a, o) => { tone(a, o, { type: 'sawtooth', from: 400, to: 900, dur: 0.35, peak: 0.12 }); clank(a, o, { base: 220, dur: 0.4, peak: 0.6, at: 0.3 }); }],
  ],
  'boss-callGuards': [
    ['공장 호루라기 삐익', (a, o) => { whistle(a, o, { from: 1900, to: 2000, dur: 0.25, peak: 0.25 }); whistle(a, o, { from: 1900, to: 2050, dur: 0.45, peak: 0.25, at: 0.32 }); }],
    ['짧은 사이렌', (a, o) => { whistle(a, o, { from: 600, to: 1100, dur: 0.5, peak: 0.25, vibrato: 0 }); whistle(a, o, { from: 1100, to: 600, dur: 0.5, peak: 0.25, at: 0.5, vibrato: 0 }); }],
  ],
  'boss-craneGrab': [
    ['모터 윙 → 집게 철컥 (내려올 때)', (a, o) => { motor(a, o, { from: 90, to: 160, dur: 0.5, peak: 0.3 }); rattle(a, o, { count: 8, gap: 0.03, freq: 2200, peak: 0.25, at: 0.3 }); clank(a, o, { base: 150, dur: 0.5, peak: 0.8, at: 0.55 }); }],
    ['체인 촤르륵 + 쾅', (a, o) => { rattle(a, o, { count: 18, gap: 0.022, freq: 2600, peak: 0.35 }); slam(a, o, { peak: 0.8, at: 0.4, base: 120 }); }],
  ],
  'boss-twoRows': [
    ['쾅쾅 두 줄', (a, o) => { slam(a, o, { peak: 0.9 }); slam(a, o, { peak: 0.8, at: 0.09, base: 80 }); }],
    ['길게 쿠우웅', (a, o) => { thump(a, o, { from: 90, to: 28, dur: 0.9, peak: 1 }); band(a, o, { type: 'lowpass', freq: 500, dur: 0.8, attack: 0.01, peak: 0.6 }); ring(a, o, { base: 110, dur: 1, peak: 0.15, partials: METAL }); }],
  ],
  'boss-wallSqueeze': [
    ['육중한 쇠 끌림 (3초)', (a, o) => { motor(a, o, { from: 45, to: 55, dur: 3, peak: 0.3, rate: 12 }); band(a, o, { freq: 400, q: 1.5, dur: 3, attack: 0.3, peak: 0.25 }); rattle(a, o, { count: 12, gap: 0.25, freq: 700, peak: 0.25 }); }],
    ['유압 밀림 + 경고음 (3초)', (a, o) => { spray(a, o, { dur: 0.5, cutoff: 1800, flutter: 20, peak: 0.3 }); motor(a, o, { from: 60, to: 50, dur: 3, peak: 0.25 }); for (const at of [0, 0.8, 1.6, 2.4]) notes(a, o, [[740, at]], { type: 'square', dur: 0.15, peak: 0.1 }); }],
  ],
  'boss-rhythmPress': [
    ['프레스 탕 (한 박마다)', (a, o) => { band(a, o, { freq: 2000, q: 2, dur: 0.02, peak: 0.6 }); thump(a, o, { from: 160, to: 60, dur: 0.2, peak: 0.8 }); ring(a, o, { base: 260, dur: 0.25, peak: 0.15, partials: METAL }); }],
    ['작업 신호 땡 + 쿵', (a, o) => { ring(a, o, { base: 880, dur: 0.2, peak: 0.2, partials: GONG }); thump(a, o, { from: 130, to: 50, dur: 0.25, peak: 0.8, at: 0.02 }); }],
  ],
  'boss-twinPistons': [
    ['피스톤 칙칙', (a, o) => { for (const at of [0, 0.18]) { spray(a, o, { dur: 0.15, cutoff: 3000, flutter: 40, peak: 0.35, at }); clank(a, o, { base: 200, dur: 0.15, peak: 0.4, at: at + 0.05 }); } }],
    ['증기 피스톤 퓨슉 쾅', (a, o) => { whoosh(a, o, { from: 2000, to: 600, dur: 0.25, q: 0.8, peak: 0.45 }); slam(a, o, { peak: 0.7, at: 0.2, base: 100 }); }],
  ],
  'boss-steamBurst': [
    ['거대한 증기 치이익', (a, o) => { spray(a, o, { dur: 1.4, cutoff: 1500, flutter: 8, peak: 0.6 }); band(a, o, { type: 'lowpass', freq: 400, dur: 1.4, attack: 0.02, peak: 0.4 }); thump(a, o, { from: 100, to: 40, dur: 0.4, peak: 0.6 }); }],
    ['보일러 터짐 쾅 + 증기', (a, o) => { slam(a, o, { peak: 1, base: 70 }); spray(a, o, { dur: 1.2, cutoff: 2500, flutter: 6, peak: 0.45, at: 0.05 }); }],
  ],
  'boss-finalPress': [
    ['압력 차오름 → 거대한 쾅', (a, o) => { charge(a, o, { from: 50, to: 120, dur: 1.2, peak: 0.4, cutoff: 600 }); spray(a, o, { dur: 1.2, cutoff: 3000, flutter: 12, peak: 0.2 }); slam(a, o, { peak: 1, at: 1.2, base: 70 }); thump(a, o, { from: 70, to: 25, dur: 1, peak: 0.8, at: 1.2 }); }],
    ['경보 + 압착', (a, o) => { for (const at of [0, 0.35, 0.7]) whistle(a, o, { from: 520, to: 520, dur: 0.25, peak: 0.2, at, vibrato: 0 }); slam(a, o, { peak: 1, at: 1.05, base: 75 }); }],
  ],
  'boss-moldMatch': [
    ['일치 띵 / 불일치 부저 (이어서 재생)', (a, o) => { notes(a, o, [[1047, 0], [1568, 0.08]], { type: 'sine', dur: 0.3, peak: 0.3 }); tone(a, o, { type: 'square', from: 140, to: 130, dur: 0.4, peak: 0.12, at: 0.7 }); thump(a, o, { from: 140, to: 50, dur: 0.3, peak: 0.6, at: 0.7 }); }],
    ['도장 합격 쿵딱 / 불합격 쿵-', (a, o) => { stampHit(a, o, { peak: 0.6 }); band(a, o, { freq: 3000, q: 3, dur: 0.02, peak: 0.4, at: 0.1 }); stampHit(a, o, { peak: 0.8, at: 0.7 }); tone(a, o, { type: 'sawtooth', from: 110, to: 90, dur: 0.35, peak: 0.1, at: 0.7 }); }],
  ],
  // Picked recipes cut where the game plays their parts at different moments (2026-11-09).
  'boss-moldOk': [['일치 띵', (a, o) => { notes(a, o, [[1047, 0], [1568, 0.08]], { type: 'sine', dur: 0.3, peak: 0.3 }); }]],
  'boss-moldNo': [['불일치 부저', (a, o) => { tone(a, o, { type: 'square', from: 140, to: 130, dur: 0.4, peak: 0.12 }); thump(a, o, { from: 140, to: 50, dur: 0.3, peak: 0.6 }); }]],
  'boss-finalAlarm': [['경보 세 번', (a, o) => { for (const at of [0, 0.35, 0.7]) whistle(a, o, { from: 520, to: 520, dur: 0.25, peak: 0.2, at, vibrato: 0 }); }]],
  'boss-finalSlam': [['압착 쾅', (a, o) => { slam(a, o, { peak: 1, base: 75 }); }]],
};
void noise;
