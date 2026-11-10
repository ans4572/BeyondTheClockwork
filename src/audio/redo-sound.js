// Alternate takes from the sound remake (compared on a page since removed, 2026-11-09). The game selects its recipes in sfx.js.
import { attackTime, grains, pitch } from './synthesis.js';
import { noise } from './water-sound.js';

// A rounded front and a short final fade keep the source edges quiet, including when tones overlap.
function contour(audio, param, start, dur, attack, peak, hold) {
  const rise = attackTime(audio, attack);
  const tail = dur - Math.min(0.018, dur * 0.16);
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + rise);
  if (hold) param.setValueAtTime(peak, start + rise + (tail - rise) * hold);
  param.exponentialRampToValueAtTime(peak * 0.035, start + tail);
  param.linearRampToValueAtTime(0, start + dur);
}

// Pitch slides, soft reeds (triangle), and coupled vibrations (sine FM) share the same envelope.
function voice(a, out, {
  from, to = from, dur, at = 0, peak = 0.4, attack = 0.012, hold = 0,
  shape = 'sine', bend = 0.72, mod = 0, index = 0.2
}) {
  const start = a.currentTime + at, end = start + dur, scale = pitch(a);
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = shape;
  osc.frequency.setValueAtTime(from * scale, start);
  osc.frequency.exponentialRampToValueAtTime(to * scale, start + dur * bend);
  if (mod) {
    const driver = a.createOscillator(), amount = a.createGain();
    driver.frequency.value = mod * scale;
    amount.gain.setValueAtTime(from * scale * index, start);
    amount.gain.linearRampToValueAtTime(from * scale * index * 0.18, end);
    driver.connect(amount).connect(osc.frequency);
    driver.start(start);
    driver.stop(end);
  }
  contour(a, gain.gain, start, dur, attack, peak, hold);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(end);
}

// Bands of moving air and friction. A separate modulation stage keeps the release at zero.
function flow(a, out, { from, to = from, dur, at = 0, peak = 0.6, attack = 0.024, hold = 0, q = 1, flutter = 0, depth = 0.35 }) {
  const start = a.currentTime + at, end = start + dur, scale = pitch(a);
  const source = noise(a), band = a.createBiquadFilter(), gain = a.createGain();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(from * scale, start);
  band.frequency.exponentialRampToValueAtTime(to * scale, end);
  source.connect(band);
  let body = band;
  if (flutter) {
    const pulse = a.createOscillator(), amount = a.createGain(), tremolo = a.createGain();
    pulse.frequency.value = flutter;
    amount.gain.value = depth;
    tremolo.gain.value = 1 - depth;
    pulse.connect(amount).connect(tremolo.gain);
    pulse.start(start);
    pulse.stop(end);
    body = band.connect(tremolo);
  }
  contour(a, gain.gain, start, dur, attack, peak, hold);
  body.connect(gain).connect(out);
  source.start(start, Math.random());
  source.stop(end);
}

// The frequencies and decay lengths of these modes describe the size and material of a struck object.
function material(a, out, modes, options = {}) {
  for (const [from, peak, dur] of modes) voice(a, out, { ...options, from, peak, dur });
}

function droplets(a, out, times, { from, peak, dur }) {
  grains(a, out, times.map((at, i) => ({
    at, dur, peak: peak * (1 - (i % 3) * 0.18), freq: from * (1 + (i % 5) * 0.14), size: 1 - (i % 4) * 0.12
  })), 'bubble');
}

export const REDO_CANDIDATES = {
  hit: [
    ['나무 망치 퍽', (a, o) => {
      material(a, o, [[240, 0.66, 0.17], [690, 0.24, 0.087], [1040, 0.12, 0.048]]);
      flow(a, o, { from: 950, to: 480, dur: 0.115, attack: 0.012, peak: 0.42 });
    }],
    ['놋쇠 태엽 탱', (a, o) => {
      material(a, o, [[440, 0.52, 0.17], [1134, 0.28, 0.13], [1960, 0.10, 0.07]], { attack: 0.013 });
      voice(a, o, { from: 210, to: 144, dur: 0.12, peak: 0.43 });
    }],
    ['말랑 고무 뽁', (a, o) => {
      voice(a, o, { from: 495, to: 180, dur: 0.18, bend: 0.38, mod: 145, index: 0.32, peak: 0.77 });
      voice(a, o, { from: 365, to: 250, dur: 0.085, at: 0.058, peak: 0.21 });
    }]
  ],
  heavy: [
    ['통나무 북 둥', (a, o) => {
      material(a, o, [[145, 0.86, 0.30], [267, 0.52, 0.24], [496, 0.21, 0.15]]);
      flow(a, o, { from: 760, to: 350, dur: 0.20, peak: 0.56, attack: 0.013 });
    }],
    ['놋쇠 접시 덩', (a, o) => {
      material(a, o, [[312, 0.78, 0.31], [588, 0.46, 0.29], [1149, 0.24, 0.17], [1722, 0.13, 0.10]], { attack: 0.019 });
      voice(a, o, { from: 159, to: 112, dur: 0.24, peak: 0.62 });
    }],
    ['가죽 풀무 압착', (a, o) => {
      voice(a, o, { from: 335, to: 96, dur: 0.31, bend: 0.47, shape: 'triangle', mod: 91, peak: 0.90 });
      flow(a, o, { from: 520, to: 205, dur: 0.27, at: 0.038, q: 1.8, peak: 0.75 });
    }]
  ],
  dodge: [
    ['천자락 휙', (a, o) => {
      flow(a, o, { from: 540, to: 1700, dur: 0.19, attack: 0.035, peak: 0.78 });
      flow(a, o, { from: 2200, to: 700, dur: 0.12, at: 0.068, q: 2, peak: 0.30 });
    }],
    ['공기 방울 건너뛰기', (a, o) => {
      voice(a, o, { from: 330, to: 720, dur: 0.115, peak: 0.54, attack: 0.020 });
      voice(a, o, { from: 870, to: 530, dur: 0.15, at: 0.056, peak: 0.33, attack: 0.021 });
      flow(a, o, { from: 1050, to: 480, dur: 0.20, peak: 0.34 });
    }],
    ['종이 부채 접기', (a, o) => {
      flow(a, o, { from: 1350, to: 800, dur: 0.22, attack: 0.026, flutter: 29, depth: 0.28, peak: 0.66 });
      grains(a, o, [{ at: 0.115, freq: 1700, dur: 0.09, q: 1.1, peak: 0.42 }]);
    }]
  ],
  pressureDash: [
    ['돛이 펴지는 돌진', (a, o) => {
      flow(a, o, { from: 380, to: 2450, dur: 0.29, attack: 0.054, hold: 0.26, peak: 0.80 });
      voice(a, o, { from: 500, to: 990, dur: 0.22, at: 0.06, attack: 0.048, peak: 0.31 });
      voice(a, o, { from: 740, to: 1485, dur: 0.19, at: 0.09, attack: 0.045, peak: 0.19 });
    }],
    ['대나무 바람 피리', (a, o) => {
      voice(a, o, { from: 610, to: 1390, dur: 0.31, bend: 0.52, attack: 0.032, mod: 41, peak: 0.47 });
      flow(a, o, { from: 1700, to: 2450, dur: 0.26, q: 3.3, attack: 0.048, peak: 0.55 });
    }],
    ['바람개비 세 날', (a, o) => {
      flow(a, o, { from: 780, to: 1900, dur: 0.31, attack: 0.030, hold: 0.3, flutter: 12, peak: 0.77 });
      for (const [at, from] of [[0.027, 590], [0.103, 740], [0.172, 880]]) {
        voice(a, o, { from, to: from * 1.3, dur: 0.13, at, attack: 0.018, peak: 0.22 });
      }
    }]
  ],
  hydroJet: [
    ['굵은 물기둥', (a, o) => {
      flow(a, o, { from: 380, to: 620, dur: 1.5, attack: 0.060, hold: 0.92, q: 0.72, flutter: 9, depth: 0.19, peak: 0.90 });
      flow(a, o, { from: 1180, to: 800, dur: 1.5, attack: 0.075, hold: 0.85, q: 1.7, peak: 0.64 });
      droplets(a, o, [0.17, 0.32, 0.57, 0.78, 1.03, 1.16, 1.32], { from: 240, peak: 0.12, dur: 0.14 });
    }],
    ['장난감 물총', (a, o) => {
      flow(a, o, { from: 2700, to: 1650, dur: 1.5, attack: 0.04, hold: 0.91, q: 1.5, flutter: 25, depth: 0.16, peak: 0.82 });
      droplets(a, o, Array.from({ length: 16 }, (_, i) => 0.022 + i * 0.089), { from: 700, peak: 0.17, dur: 0.105 });
    }],
    ['손펌프 물맥동', (a, o) => {
      flow(a, o, { from: 1200, to: 510, dur: 1.5, attack: 0.05, hold: 0.89, q: 0.92, flutter: 6, depth: 0.43, peak: 0.83 });
      flow(a, o, { from: 580, to: 1020, dur: 1.45, at: 0.033, hold: 0.9, flutter: 6, depth: 0.31, peak: 0.40 });
      droplets(a, o, Array.from({ length: 9 }, (_, i) => 0.07 + i * 0.158), { from: 360, peak: 0.23, dur: 0.12 });
    }]
  ],
  'boss-decoysAppear': [
    ['유리 세 겹 피어남', (a, o) => {
      for (const [at, from] of [[0, 659], [0.112, 988], [0.224, 1319]]) {
        voice(a, o, { from, to: from * 1.08, dur: 0.39, at, attack: 0.064, mod: from * 1.63, peak: 0.40 });
      }
      flow(a, o, { from: 1100, to: 2900, dur: 0.56, attack: 0.14, peak: 0.35 });
    }],
    ['종이 인형 펼침', (a, o) => {
      flow(a, o, { from: 1650, to: 610, dur: 0.63, attack: 0.064, hold: 0.21, flutter: 10, depth: 0.39, peak: 0.85 });
      material(a, o, [[293, 0.24, 0.31], [880, 0.17, 0.18]], { at: 0.30, attack: 0.033 });
    }],
    ['거울 속 화음', (a, o) => {
      voice(a, o, { from: 1060, to: 770, dur: 0.61, attack: 0.113, mod: 117, peak: 0.42 });
      voice(a, o, { from: 695, to: 1160, dur: 0.63, at: 0.045, attack: 0.084, peak: 0.37 });
      voice(a, o, { from: 1440, to: 1540, dur: 0.40, at: 0.235, attack: 0.084, peak: 0.22 });
    }]
  ],
  'boss-mirrorTurn': [
    ['유리 마찰음', (a, o) => {
      voice(a, o, { from: 1090, to: 790, dur: 0.245, attack: 0.030, mod: 279, index: 0.28, peak: 0.63 });
      flow(a, o, { from: 1460, to: 2400, dur: 0.15, peak: 0.45, attack: 0.025 });
    }],
    ['나무 받침 톡', (a, o) => {
      flow(a, o, { from: 790, to: 420, dur: 0.22, attack: 0.045, peak: 0.67 });
      material(a, o, [[410, 0.55, 0.15], [960, 0.23, 0.085]], { at: 0.085 });
    }],
    ['놋쇠 테두리 떨림', (a, o) => {
      material(a, o, [[598, 0.53, 0.24], [619, 0.39, 0.22], [1548, 0.12, 0.11]], { attack: 0.019 });
      voice(a, o, { from: 433, to: 610, dur: 0.125, at: 0.045, peak: 0.34 });
    }]
  ],
  'boss-lineShift': [
    ['고무 벨트 되감기', (a, o) => {
      flow(a, o, { from: 1360, to: 470, dur: 0.76, attack: 0.074, flutter: 17, peak: 0.76, hold: 0.32 });
      voice(a, o, { from: 230, to: 460, dur: 0.50, at: 0.28, mod: 107, peak: 0.37 });
    }],
    ['기어 두 축 교대', (a, o) => {
      voice(a, o, { from: 320, to: 130, dur: 0.43, attack: 0.045, shape: 'triangle', mod: 127, peak: 0.64 });
      voice(a, o, { from: 154, to: 382, dur: 0.56, at: 0.30, attack: 0.07, mod: 109, index: 0.42, peak: 0.58 });
    }],
    ['도르래 신호음', (a, o) => {
      voice(a, o, { from: 710, to: 440, dur: 0.32, attack: 0.032, peak: 0.54 });
      flow(a, o, { from: 620, to: 1110, dur: 0.56, at: 0.17, flutter: 8, peak: 0.54, hold: 0.34 });
      voice(a, o, { from: 440, to: 580, dur: 0.24, at: 0.57, attack: 0.031, peak: 0.28 });
    }]
  ],
  'boss-steamBurst': [
    ['주전자 뚜껑 들썩', (a, o) => {
      voice(a, o, { from: 810, to: 1330, dur: 0.78, attack: 0.10, hold: 0.18, mod: 87, peak: 0.38 });
      flow(a, o, { from: 2700, to: 980, dur: 0.90, attack: 0.067, flutter: 13, peak: 0.87 });
    }],
    ['풀무 두 숨', (a, o) => {
      flow(a, o, { from: 610, to: 1450, dur: 0.53, attack: 0.083, q: 0.7, peak: 0.95 });
      flow(a, o, { from: 970, to: 420, dur: 0.65, at: 0.34, attack: 0.065, q: 0.7, peak: 0.74 });
      droplets(a, o, [0.46, 0.56, 0.73, 0.86], { from: 265, dur: 0.13, peak: 0.18 });
    }],
    ['솜구름 새는 밸브', (a, o) => {
      flow(a, o, { from: 990, to: 3060, dur: 1.02, attack: 0.16, hold: 0.33, flutter: 6, depth: 0.32, peak: 1.05 });
      voice(a, o, { from: 242, to: 630, dur: 0.82, attack: 0.19, shape: 'triangle', mod: 61, peak: 0.32 });
    }]
  ],
  'boss-moldNo': [
    ['오르골 삐끗', (a, o) => {
      voice(a, o, { from: 660, dur: 0.21, peak: 0.55 });
      voice(a, o, { from: 567, to: 470, dur: 0.26, at: 0.14, mod: 179, peak: 0.48, attack: 0.023 });
    }],
    ['고무 오리 풉', (a, o) => {
      voice(a, o, { from: 420, to: 176, dur: 0.37, attack: 0.029, bend: 0.47, mod: 137, index: 0.46, peak: 0.73 });
      flow(a, o, { from: 910, to: 430, dur: 0.25, attack: 0.035, peak: 0.39 });
    }],
    ['틀이 비껴 닫힘', (a, o) => {
      material(a, o, [[352, 0.69, 0.25], [743, 0.29, 0.13]]);
      material(a, o, [[270, 0.49, 0.25], [526, 0.18, 0.12]], { at: 0.16 });
    }]
  ],
  tell: [
    ['오르골 한 점', (a, o) => {
      material(a, o, [[1397, 0.44, 0.127], [2675, 0.095, 0.065]], { attack: 0.016 });
    }],
    ['나무 딸랑이 두 번', (a, o) => {
      material(a, o, [[1160, 0.50, 0.083], [2305, 0.12, 0.047]]);
      voice(a, o, { from: 1350, dur: 0.087, at: 0.062, peak: 0.36 });
    }],
    ['태엽 바늘 오름', (a, o) => {
      voice(a, o, { from: 930, to: 1730, dur: 0.139, bend: 0.48, attack: 0.019, mod: 397, peak: 0.54 });
    }]
  ],
  block: [
    ['두꺼운 나무 방패', (a, o) => {
      material(a, o, [[390, 0.63, 0.16], [780, 0.29, 0.10], [1270, 0.15, 0.057]]);
      flow(a, o, { from: 850, to: 520, dur: 0.12, attack: 0.016, peak: 0.32 });
    }],
    ['가죽 완충판', (a, o) => {
      voice(a, o, { from: 255, to: 128, dur: 0.17, peak: 0.80, attack: 0.018, shape: 'triangle' });
      flow(a, o, { from: 1040, to: 350, dur: 0.13, q: 0.8, attack: 0.023, peak: 0.72 });
    }],
    ['도자기 방패 덩', (a, o) => {
      material(a, o, [[548, 0.58, 0.17], [1360, 0.21, 0.10], [1870, 0.09, 0.065]], { attack: 0.015 });
      voice(a, o, { from: 780, to: 604, dur: 0.105, at: 0.067, peak: 0.23 });
    }]
  ],
  burst: [
    ['종이 속 솜 터짐', (a, o) => {
      voice(a, o, { from: 190, to: 73, dur: 0.28, attack: 0.017, mod: 55, peak: 0.80 });
      flow(a, o, { from: 1620, to: 580, dur: 0.42, attack: 0.029, peak: 1.0, flutter: 15, depth: 0.29 });
    }],
    ['풍선 바람 빠짐', (a, o) => {
      voice(a, o, { from: 630, to: 99, dur: 0.41, bend: 0.86, mod: 111, index: 0.38, peak: 0.64, attack: 0.018 });
      flow(a, o, { from: 2100, to: 700, dur: 0.39, peak: 0.68, q: 1.7 });
    }],
    ['나무 구슬 흩어짐', (a, o) => {
      voice(a, o, { from: 248, to: 115, dur: 0.29, peak: 0.74 });
      grains(a, o, [[0.055, 850], [0.11, 1180], [0.172, 710], [0.24, 1290], [0.30, 910]].map(([at, freq]) => ({ at, freq, dur: 0.12, q: 1.9, peak: 0.54 })));
      material(a, o, [[375, 0.31, 0.22], [735, 0.17, 0.14]], { at: 0.17 });
    }]
  ],
  rabbit: [
    ['고무 발 두 번', (a, o) => {
      voice(a, o, { from: 430, to: 264, dur: 0.18, mod: 104, peak: 0.59, attack: 0.019 });
      voice(a, o, { from: 565, to: 345, dur: 0.17, at: 0.096, mod: 146, peak: 0.52, attack: 0.019 });
    }],
    ['펠트 발 구르기', (a, o) => {
      flow(a, o, { from: 870, to: 460, dur: 0.29, attack: 0.026, hold: 0.26, flutter: 11, depth: 0.44, peak: 0.78 });
      voice(a, o, { from: 320, to: 232, dur: 0.23, mod: 23, peak: 0.31 });
    }],
    ['나무 발판 도약', (a, o) => {
      material(a, o, [[463, 0.58, 0.17], [1080, 0.18, 0.10]]);
      voice(a, o, { from: 590, to: 385, dur: 0.20, at: 0.078, bend: 0.90, shape: 'triangle', peak: 0.45, attack: 0.025 });
    }]
  ],
  pikeman: [
    ['나무 창대 떨림', (a, o) => {
      voice(a, o, { from: 646, to: 1060, dur: 0.215, attack: 0.027, mod: 346, peak: 0.55 });
      material(a, o, [[380, 0.40, 0.15], [920, 0.16, 0.09]], { at: 0.082 });
    }],
    ['깃발 천 팽팽', (a, o) => {
      flow(a, o, { from: 1870, to: 1110, dur: 0.245, attack: 0.044, q: 1.7, flutter: 22, peak: 0.82 });
      voice(a, o, { from: 704, to: 552, dur: 0.135, at: 0.061, shape: 'triangle', peak: 0.33 });
    }],
    ['짧은 놋쇠 울림', (a, o) => {
      material(a, o, [[790, 0.59, 0.24], [1710, 0.26, 0.13], [2360, 0.11, 0.07]], { attack: 0.023 });
      voice(a, o, { from: 380, to: 507, dur: 0.16, at: 0.053, peak: 0.30 });
    }]
  ],
  pop: [
    ['나무 뚜껑 덜컹', (a, o) => {
      material(a, o, [[331, 0.61, 0.22], [771, 0.26, 0.13]]);
      material(a, o, [[255, 0.40, 0.23], [639, 0.15, 0.11]], { at: 0.11, attack: 0.021 });
    }],
    ['고무 마개 뽁', (a, o) => {
      voice(a, o, { from: 260, to: 930, dur: 0.26, bend: 0.40, mod: 155, index: 0.33, peak: 0.62, attack: 0.019 });
      voice(a, o, { from: 890, to: 615, dur: 0.16, at: 0.14, peak: 0.27 });
    }],
    ['천 인형 쑥', (a, o) => {
      flow(a, o, { from: 430, to: 1100, dur: 0.31, attack: 0.065, flutter: 9, peak: 0.78 });
      voice(a, o, { from: 393, to: 521, dur: 0.23, at: 0.10, attack: 0.044, mod: 58, peak: 0.35 });
    }]
  ],
  summon: [
    ['오르골 상자 개막', (a, o) => {
      for (const [at, from] of [[0, 392], [0.115, 523], [0.24, 659]]) {
        material(a, o, [[from, 0.43, 0.36], [from * 2.61, 0.14, 0.20]], { at, attack: 0.022 });
      }
      voice(a, o, { from: 217, to: 151, dur: 0.27, at: 0.44, peak: 0.47 });
    }],
    ['장난감 상자 열림', (a, o) => {
      material(a, o, [[287, 0.61, 0.26], [630, 0.24, 0.12]]);
      flow(a, o, { from: 620, to: 1510, dur: 0.42, at: 0.08, attack: 0.058, flutter: 8, peak: 0.59 });
      voice(a, o, { from: 275, to: 539, dur: 0.40, at: 0.24, attack: 0.046, mod: 82, peak: 0.42 });
    }],
    ['작업 종과 벨트', (a, o) => {
      material(a, o, [[590, 0.55, 0.69], [1204, 0.20, 0.38], [2078, 0.095, 0.24]], { attack: 0.021 });
      flow(a, o, { from: 390, to: 670, dur: 0.59, at: 0.20, attack: 0.087, hold: 0.22, flutter: 14, peak: 0.53 });
    }]
  ],
  pressGuard: [
    ['공기통 빈 울림', (a, o) => {
      voice(a, o, { from: 214, to: 302, dur: 0.32, attack: 0.045, shape: 'triangle', mod: 97, peak: 0.67 });
      flow(a, o, { from: 495, to: 720, dur: 0.29, q: 2.4, flutter: 18, peak: 0.49 });
    }],
    ['고무 바퀴 물림', (a, o) => {
      flow(a, o, { from: 580, to: 940, dur: 0.34, attack: 0.034, hold: 0.27, flutter: 21, depth: 0.41, peak: 0.89 });
      voice(a, o, { from: 166, to: 262, dur: 0.25, at: 0.069, mod: 61, peak: 0.40 });
    }],
    ['나무 발굽 돌진', (a, o) => {
      for (const [at, from] of [[0, 320], [0.082, 277], [0.16, 212]]) {
        voice(a, o, { from, to: from * 0.73, dur: 0.16, at, attack: 0.017, shape: 'triangle', peak: 0.57 });
      }
    }]
  ],
  pressCaptain: [
    ['이중 철판 내딛기', (a, o) => {
      material(a, o, [[161, 0.78, 0.24], [488, 0.26, 0.16], [1220, 0.10, 0.095]], { attack: 0.023 });
      material(a, o, [[128, 0.81, 0.28], [385, 0.32, 0.20]], { at: 0.15, attack: 0.024 });
    }],
    ['가죽 북 행진', (a, o) => {
      voice(a, o, { from: 175, to: 81, dur: 0.29, attack: 0.022, mod: 57, peak: 0.84 });
      flow(a, o, { from: 360, to: 210, dur: 0.40, q: 0.8, flutter: 8, depth: 0.43, peak: 0.68 });
      voice(a, o, { from: 120, to: 75, dur: 0.27, at: 0.15, attack: 0.031, peak: 0.52 });
    }],
    ['느린 기어 으릉', (a, o) => {
      voice(a, o, { from: 154, to: 117, dur: 0.43, attack: 0.063, hold: 0.29, mod: 76, index: 0.49, shape: 'triangle', peak: 0.78 });
      voice(a, o, { from: 368, to: 264, dur: 0.34, at: 0.09, attack: 0.044, mod: 103, peak: 0.33 });
    }]
  ],
  tapePacker: [
    ['포장지 접히는 소리', (a, o) => {
      const soft = a.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 4200;
      soft.Q.value = 0.55;
      soft.connect(o);
      flow(a, soft, { from: 1600, to: 580, dur: 0.36, attack: 0.035, hold: 0.22, flutter: 16, peak: 0.82 });
      grains(a, soft, [[0.054, 1430], [0.123, 1860], [0.203, 1130]].map(([at, freq]) => ({ at, freq, dur: 0.11, q: 1.1, peak: 0.43 })));
    }],
    ['종이 관 구르기', (a, o) => {
      flow(a, o, { from: 510, to: 950, dur: 0.35, attack: 0.033, flutter: 22, depth: 0.40, q: 3.4, peak: 1.0 });
      material(a, o, [[373, 0.42, 0.24], [915, 0.15, 0.14]], { at: 0.084, attack: 0.024 });
    }],
    ['끈끈이 떼기', (a, o) => {
      voice(a, o, { from: 1180, to: 690, dur: 0.34, attack: 0.039, mod: 72, index: 0.25, peak: 0.46 });
      flow(a, o, { from: 2200, to: 1470, dur: 0.32, attack: 0.044, flutter: 31, peak: 0.70 });
    }]
  ],
  oiler: [
    ['기름 방울 퐁당', (a, o) => {
      voice(a, o, { from: 155, to: 330, dur: 0.28, attack: 0.027, mod: 83, peak: 0.70 });
      droplets(a, o, [0.075, 0.153, 0.229, 0.289], { from: 220, peak: 0.37, dur: 0.12 });
    }],
    ['양철 통 구르기', (a, o) => {
      material(a, o, [[427, 0.52, 0.30], [1097, 0.20, 0.19], [2163, 0.08, 0.11]], { attack: 0.022 });
      flow(a, o, { from: 570, to: 360, dur: 0.34, at: 0.092, flutter: 14, depth: 0.38, peak: 0.61 });
    }],
    ['걸쭉한 방울 꿀렁', (a, o) => {
      voice(a, o, { from: 480, to: 198, dur: 0.35, attack: 0.044, mod: 79, index: 0.44, peak: 0.65 });
      voice(a, o, { from: 270, to: 390, dur: 0.25, at: 0.16, attack: 0.033, mod: 38, peak: 0.39 });
      flow(a, o, { from: 680, to: 390, dur: 0.30, at: 0.089, peak: 0.32 });
    }]
  ],
  clampCarrier: [
    ['고무 집게 오므림', (a, o) => {
      voice(a, o, { from: 460, to: 219, dur: 0.25, attack: 0.023, mod: 141, peak: 0.64 });
      material(a, o, [[293, 0.42, 0.16], [670, 0.19, 0.12]], { at: 0.14, attack: 0.017 });
    }],
    ['밧줄 팽팽', (a, o) => {
      flow(a, o, { from: 1020, to: 1740, dur: 0.26, attack: 0.041, q: 2.8, flutter: 26, peak: 0.60 });
      voice(a, o, { from: 385, to: 802, dur: 0.26, attack: 0.054, mod: 66, peak: 0.47 });
    }],
    ['나무 빨래집게', (a, o) => {
      material(a, o, [[510, 0.52, 0.19], [1180, 0.19, 0.10]], { attack: 0.024 });
      material(a, o, [[360, 0.52, 0.19], [845, 0.17, 0.10]], { at: 0.096, attack: 0.019 });
    }]
  ],
  lensInspector: [
    ['유리 실 한 줄', (a, o) => {
      voice(a, o, { from: 1580, to: 1240, dur: 0.25, attack: 0.036, hold: 0.38, peak: 0.47 });
      voice(a, o, { from: 2210, to: 1740, dur: 0.18, at: 0.035, attack: 0.041, peak: 0.18 });
    }],
    ['프리즘 두 색', (a, o) => {
      voice(a, o, { from: 1090, to: 1470, dur: 0.195, attack: 0.021, mod: 213, peak: 0.42 });
      voice(a, o, { from: 1870, to: 1480, dur: 0.21, at: 0.07, attack: 0.032, mod: 197, peak: 0.37 });
    }],
    ['빛나는 숨결', (a, o) => {
      flow(a, o, { from: 1970, to: 2860, dur: 0.28, attack: 0.038, q: 8, flutter: 18, depth: 0.24, peak: 1.15 });
      voice(a, o, { from: 1440, to: 1610, dur: 0.22, attack: 0.052, mod: 53, peak: 0.29 });
    }]
  ],
  'boss-trumpetWave': [
    ['세 갈래 나팔', (a, o) => {
      for (const [at, from] of [[0, 392], [0.115, 523], [0.22, 659]]) {
        voice(a, o, { from, to: from * 0.95, dur: 0.30, at, attack: 0.028, shape: 'triangle', mod: from, index: 0.40, peak: 0.56 });
      }
    }],
    ['놋쇠 원반 파문', (a, o) => {
      material(a, o, [[412, 0.63, 0.49], [832, 0.26, 0.42], [1250, 0.18, 0.31]], { attack: 0.037 });
      flow(a, o, { from: 940, to: 1890, dur: 0.38, at: 0.07, attack: 0.068, flutter: 10, peak: 0.49 });
    }],
    ['종이 나팔 떨림', (a, o) => {
      voice(a, o, { from: 514, to: 382, dur: 0.46, attack: 0.048, hold: 0.20, shape: 'triangle', mod: 90, index: 0.36, peak: 0.75 });
      flow(a, o, { from: 1660, to: 760, dur: 0.47, attack: 0.064, flutter: 13, depth: 0.39, peak: 0.61 });
    }]
  ],
  'boss-charge': [
    ['대열 소집 두 음', (a, o) => {
      voice(a, o, { from: 330, to: 297, dur: 0.29, attack: 0.027, hold: 0.13, shape: 'triangle', mod: 330, peak: 0.72 });
      voice(a, o, { from: 495, to: 446, dur: 0.42, at: 0.20, attack: 0.04, hold: 0.23, shape: 'triangle', mod: 495, peak: 0.68 });
    }],
    ['큰북 앞세운 대열', (a, o) => {
      for (const [at, from] of [[0, 201], [0.145, 185], [0.28, 157]]) {
        voice(a, o, { from, to: from * 0.59, dur: 0.27, at, attack: 0.021, mod: 93, peak: 0.67 });
      }
      voice(a, o, { from: 349, to: 440, dur: 0.43, at: 0.15, attack: 0.094, shape: 'triangle', peak: 0.44 });
    }],
    ['낮은 리드의 전진', (a, o) => {
      voice(a, o, { from: 286, to: 439, dur: 0.61, attack: 0.073, hold: 0.40, mod: 172, index: 0.40, shape: 'triangle', peak: 0.75 });
      voice(a, o, { from: 573, to: 877, dur: 0.48, at: 0.09, attack: 0.076, mod: 103, peak: 0.30 });
    }]
  ]
};
