// Sounds built in code (Web Audio): candidates compared on player-sfx.html and world-sfx.html; sfx.js plays the picked ones.
// Each recipe draws into `out` (a gain node) from now on; levels are relative and the comparison page matches loudness.
// The wrench is meant to land like a melee weapon in an action game: a low thump for weight, a short bright click for
// contact, a burst of mid noise for the body, and for the metal versions a quick inharmonic ring.

let white = null;
function noise(audio) {
  if (!white || white.sampleRate !== audio.sampleRate) {
    white = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
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
/** A tone whose pitch slides from `from` to `to` over `glide`: the low thump of an impact when it drops fast. */
function tone(audio, out, { type = 'sine', from, to = from, glide, dur, attack = 0.002, peak = 1, at = 0 }) {
  const t = audio.currentTime + at, osc = audio.createOscillator(), g = decay(audio, at, attack, dur, peak);
  osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + (glide ?? dur));
  osc.connect(g).connect(out); osc.start(t); osc.stop(t + attack + dur + 0.05);
}
/** Filtered noise with an optional sweep: clicks, crunches and the air of a swing. */
function hiss(audio, out, { type = 'bandpass', freq, to = freq, q = 1, dur, attack = 0.001, peak = 1, at = 0, shape = null }) {
  const t = audio.currentTime + at, src = noise(audio), f = audio.createBiquadFilter(), g = decay(audio, at, attack, dur, peak);
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
  let chain = src.connect(f);
  if (shape) chain = chain.connect(shape);
  chain.connect(g).connect(out); src.start(t, Math.random()); src.stop(t + attack + dur + 0.05);
}
/** A swing's air: noise that swells as the band sweeps, then lets go. */
function whoosh(audio, out, { from, to, dur, q = 1.2, swell = 0.45, peak = 1, at = 0 }) {
  const t = audio.currentTime + at, src = noise(audio), f = audio.createBiquadFilter(), g = audio.createGain();
  f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * swell); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
/** Struck metal: a few out-of-tune partials, the high ones dying first. */
function ring(audio, out, { base, dur, peak = 1, at = 0, partials = [1, 2.76, 5.4, 8.93] }) {
  partials.forEach((ratio, i) => tone(audio, out, { from: base * ratio, dur: dur / (1 + i * 0.8), peak: peak / (1 + i * 0.9), at }));
}
/** Soft clipping, for crunch. */
function grit(audio, amount) {
  const shaper = audio.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  shaper.curve = curve; return shaper;
}

/** For each player sound, the coded candidates in order (①②③), with a short name for each. */
export const PLAYER_CANDIDATES = {
  swing: [
    ['짧은 바람', (a, o) => whoosh(a, o, { from: 700, to: 2600, dur: 0.15 })],
    ['묵직한 붕', (a, o) => { whoosh(a, o, { from: 280, to: 900, dur: 0.19, q: 0.9 }); tone(a, o, { from: 170, to: 110, dur: 0.12, attack: 0.04, peak: 0.25 }); }],
    ['날 선 쉭', (a, o) => { whoosh(a, o, { from: 1500, to: 4200, dur: 0.11, q: 1.6 }); hiss(a, o, { type: 'highpass', freq: 5000, dur: 0.02, at: 0.1, peak: 0.25 }); }]
  ],
  swingHeavy: [
    ['짧은 바람 · 길게', (a, o) => whoosh(a, o, { from: 420, to: 1700, dur: 0.25 })],
    ['묵직한 붕 · 크게', (a, o) => { whoosh(a, o, { from: 180, to: 650, dur: 0.3, q: 0.8 }); tone(a, o, { from: 130, to: 70, dur: 0.2, attack: 0.07, peak: 0.35 }); }],
    ['두 번 가르기', (a, o) => { whoosh(a, o, { from: 600, to: 1400, dur: 0.12, peak: 0.6 }); whoosh(a, o, { from: 900, to: 3200, dur: 0.17, at: 0.08, q: 1.4 }); }]
  ],
  hit: [
    ['둔기 타격', (a, o) => {
      tone(a, o, { from: 170, to: 55, glide: 0.07, dur: 0.09, peak: 1 });
      hiss(a, o, { type: 'highpass', freq: 3500, dur: 0.012, peak: 0.6 });
      hiss(a, o, { freq: 1100, to: 500, q: 0.9, dur: 0.06, peak: 0.7 });
    }],
    ['금속 렌치', (a, o) => {
      tone(a, o, { from: 150, to: 60, glide: 0.06, dur: 0.08, peak: 0.9 });
      hiss(a, o, { type: 'highpass', freq: 4000, dur: 0.01, peak: 0.7 });
      ring(a, o, { base: 560, dur: 0.16, peak: 0.28, at: 0.003 });
    }],
    ['크런치', (a, o) => {
      tone(a, o, { from: 190, to: 60, glide: 0.06, dur: 0.08, peak: 0.8 });
      hiss(a, o, { type: 'lowpass', freq: 2400, to: 700, dur: 0.07, peak: 0.9, shape: grit(a, 6) });
      hiss(a, o, { type: 'highpass', freq: 3000, dur: 0.01, peak: 0.5 });
    }]
  ],
  heavy: [
    ['둔기 강타', (a, o) => {
      tone(a, o, { from: 140, to: 38, glide: 0.12, dur: 0.2, peak: 1 });
      tone(a, o, { from: 60, to: 45, dur: 0.25, attack: 0.005, peak: 0.5 });
      hiss(a, o, { type: 'highpass', freq: 3000, dur: 0.015, peak: 0.7 });
      hiss(a, o, { freq: 800, to: 300, q: 0.8, dur: 0.13, peak: 0.8 });
    }],
    ['금속 렌치 강타', (a, o) => {
      tone(a, o, { from: 130, to: 42, glide: 0.1, dur: 0.18, peak: 1 });
      hiss(a, o, { type: 'highpass', freq: 3500, dur: 0.014, peak: 0.8 });
      hiss(a, o, { type: 'lowpass', freq: 1800, to: 500, dur: 0.09, peak: 0.6, shape: grit(a, 5) });
      ring(a, o, { base: 410, dur: 0.38, peak: 0.3, at: 0.004 });
    }],
    ['크런치 + 울림', (a, o) => {
      tone(a, o, { from: 160, to: 40, glide: 0.1, dur: 0.22, peak: 1 });
      hiss(a, o, { type: 'lowpass', freq: 3000, to: 500, dur: 0.13, peak: 1, shape: grit(a, 9) });
      hiss(a, o, { type: 'lowpass', freq: 400, to: 120, dur: 0.35, attack: 0.01, peak: 0.35, at: 0.02 });
    }]
  ],
  dodge: [
    ['바람 대시', (a, o) => { whoosh(a, o, { from: 900, to: 3200, dur: 0.14, q: 0.9, swell: 0.3 }); hiss(a, o, { type: 'lowpass', freq: 600, dur: 0.08, peak: 0.3 }); }],
    ['태엽 분사', (a, o) => { hiss(a, o, { freq: 1600, to: 800, q: 0.7, dur: 0.15, attack: 0.01, peak: 0.9 }); tone(a, o, { type: 'square', from: 320, to: 900, dur: 0.07, peak: 0.08 }); }]
  ],
  hurt: [
    ['깡 맞음', (a, o) => {
      tone(a, o, { from: 220, to: 80, glide: 0.06, dur: 0.1, peak: 0.9 });
      ring(a, o, { base: 760, dur: 0.12, peak: 0.35 });
      hiss(a, o, { freq: 1400, q: 0.8, dur: 0.05, peak: 0.6 });
    }],
    ['쿵 + 찌릿', (a, o) => {
      tone(a, o, { from: 160, to: 70, glide: 0.08, dur: 0.12, peak: 1 });
      tone(a, o, { type: 'square', from: 240, to: 120, dur: 0.14, attack: 0.005, peak: 0.12 });
      hiss(a, o, { type: 'highpass', freq: 2500, dur: 0.1, at: 0.03, peak: 0.2, shape: grit(a, 8) });
    }]
  ],
  down: [
    ['전원 꺼짐', (a, o) => {
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1600, a.currentTime); f.frequency.exponentialRampToValueAtTime(150, a.currentTime + 0.9); f.connect(o);
      tone(a, f, { type: 'sawtooth', from: 330, to: 50, glide: 0.9, dur: 0.95, attack: 0.01, peak: 0.5 });
      [0.35, 0.5, 0.62].forEach((at, i) => ring(a, o, { base: 900 - i * 120, dur: 0.06, peak: 0.25, at }));
    }],
    ['털썩', (a, o) => {
      tone(a, o, { from: 400, to: 300, dur: 0.18, attack: 0.01, peak: 0.35 }); tone(a, o, { from: 300, to: 200, dur: 0.3, attack: 0.01, peak: 0.35, at: 0.16 });
      tone(a, o, { from: 120, to: 40, glide: 0.1, dur: 0.22, peak: 1, at: 0.42 }); hiss(a, o, { type: 'lowpass', freq: 900, dur: 0.15, peak: 0.5, at: 0.42 });
    }]
  ],
  charged: [
    ['차오르는 화음', (a, o) => {
      [660, 880, 1320].forEach((f, i) => tone(a, o, { type: 'triangle', from: f, dur: 0.35 - i * 0.05, attack: 0.01, peak: 0.45, at: i * 0.07 }));
      hiss(a, o, { type: 'highpass', freq: 6000, dur: 0.3, attack: 0.1, peak: 0.12 });
    }],
    ['전기 충전', (a, o) => {
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, a.currentTime); f.frequency.exponentialRampToValueAtTime(3000, a.currentTime + 0.3); f.connect(o);
      tone(a, f, { type: 'sawtooth', from: 110, to: 220, glide: 0.3, dur: 0.3, attack: 0.25, peak: 0.35 });
      tone(a, o, { type: 'triangle', from: 1760, dur: 0.25, peak: 0.4, at: 0.3 });
    }]
  ],
  mend: [
    ['부드러운 두 음', (a, o) => { tone(a, o, { from: 523, dur: 0.22, attack: 0.03, peak: 0.5 }); tone(a, o, { from: 784, dur: 0.32, attack: 0.03, peak: 0.5, at: 0.1 }); }],
    ['반짝임', (a, o) => [1200, 1500, 1800].forEach((f, i) => tone(a, o, { type: 'triangle', from: f, dur: 0.18, attack: 0.005, peak: 0.35, at: i * 0.05 }))]
  ]
};

/** Several notes at once or in a quick run: `list` holds [frequency, start] pairs. */
function notes(audio, out, list, { type = 'triangle', dur = 0.25, peak = 0.4, attack = 0.005 } = {}) {
  for (const [from, at] of list) tone(audio, out, { type, from, dur, attack, peak, at });
}
/** A run of tiny clicks: a ratchet, a wind-up, paper slaps. */
function clicks(audio, out, { count, gap, freq = 3000, q = 4, dur = 0.012, peak = 0.6, at = 0 }) {
  for (let i = 0; i < count; i++) hiss(audio, out, { freq, q, dur, peak, at: at + i * gap });
}
/** A tone pushed through a closing low-pass: brass and horns. */
function horn(audio, out, { from, to = from, dur, peak = 0.5, at = 0, bright = 2200 }) {
  const f = audio.createBiquadFilter(), t = audio.currentTime + at; f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(bright, t + 0.03); f.frequency.exponentialRampToValueAtTime(600, t + dur); f.connect(out);
  tone(audio, f, { type: 'sawtooth', from, to, dur, attack: 0.02, peak, at });
}
/** Air that circles: a band of noise wobbling `rate` times a second. */
function whirl(audio, out, { center, depth, rate, dur, peak = 1, at = 0 }) {
  const t = audio.currentTime + at, src = noise(audio), f = audio.createBiquadFilter(), g = decay(audio, at, dur * 0.3, dur * 0.7, peak), lfo = audio.createOscillator(), amt = audio.createGain();
  f.type = 'bandpass'; f.Q.value = 3; f.frequency.value = center; lfo.frequency.value = rate; amt.gain.value = depth;
  lfo.connect(amt).connect(f.frequency); src.connect(f).connect(g).connect(out); src.start(t, Math.random()); lfo.start(t); src.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
/** A low-passed chain for square and saw tones, so they read as toys and machines rather than chiptune. */
function soft(audio, out, cutoff) { const f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.connect(out); return f; }
/** A filter whose cutoff slides from `from` to `to` over `dur`: hums that open up, power that drains. */
function sweep(audio, out, from, to, dur) { const f = audio.createBiquadFilter(), t = audio.currentTime; f.type = 'lowpass'; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); f.connect(out); return f; }
/** A low hit with weight: the thump under every explosion, stomp and slam. */
function boom(a, o, { from = 110, to = 32, dur = 0.35, peak = 1, at = 0 } = {}) {
  tone(a, o, { from, to, glide: dur * 0.5, dur, peak, at });
  hiss(a, o, { type: 'lowpass', freq: 1400, to: 150, dur: dur * 1.2, attack: 0.004, peak: peak * 0.7, at });
}
const COIN = [1, 2.4, 3.9];

/** Enemies, bosses and progress: two coded candidates each, compared on world-sfx.html against the recordings. */
export const WORLD_CANDIDATES = {
  tell: [
    ['띵 예고', (a, o) => tone(a, o, { type: 'triangle', from: 620, to: 930, dur: 0.09, peak: 0.5 })],
    ['태엽 감기', (a, o) => clicks(a, o, { count: 3, gap: 0.045, freq: 2600, peak: 0.7 })]
  ],
  guard: [
    ['나무 휘두름', (a, o) => { whoosh(a, o, { from: 300, to: 1000, dur: 0.16, peak: 0.8 }); hiss(a, o, { freq: 900, q: 5, dur: 0.04, at: 0.14, peak: 0.5 }); }],
    ['가벼운 휙', (a, o) => whoosh(a, o, { from: 600, to: 1800, dur: 0.13 })]
  ],
  nutcracker: [
    ['묵직한 휘두름 + 딱', (a, o) => { whoosh(a, o, { from: 200, to: 650, dur: 0.22, q: 0.9 }); hiss(a, o, { freq: 1300, q: 7, dur: 0.03, at: 0.2, peak: 0.7 }); hiss(a, o, { freq: 800, q: 7, dur: 0.03, at: 0.24, peak: 0.6 }); }],
    ['둔탁한 내려침', (a, o) => { whoosh(a, o, { from: 250, to: 700, dur: 0.18, q: 0.9, peak: 0.7 }); tone(a, o, { from: 130, to: 55, glide: 0.06, dur: 0.1, peak: 0.8, at: 0.16 }); }]
  ],
  block: [
    ['나무 방패 톡', (a, o) => { hiss(a, o, { freq: 700, q: 5, dur: 0.06, peak: 1 }); tone(a, o, { from: 180, to: 110, dur: 0.06, peak: 0.6 }); }],
    ['쇠 방패 깡', (a, o) => { hiss(a, o, { type: 'highpass', freq: 3500, dur: 0.01, peak: 0.7 }); ring(a, o, { base: 950, dur: 0.18, peak: 0.45 }); }]
  ],
  elite: [
    ['충격파 쿵', (a, o) => { boom(a, o, { from: 95, to: 34, dur: 0.38 }); hiss(a, o, { freq: 1200, to: 200, q: 0.7, dur: 0.4, attack: 0.02, peak: 0.5 }); }],
    ['둥 + 울림', (a, o) => { boom(a, o, { from: 120, to: 40, dur: 0.25 }); tone(a, o, { from: 70, to: 50, dur: 0.5, attack: 0.02, peak: 0.4, at: 0.05 }); }]
  ],
  burst: [
    ['작은 폭발', (a, o) => { boom(a, o, { from: 200, to: 45, dur: 0.22 }); hiss(a, o, { type: 'lowpass', freq: 3200, to: 300, dur: 0.25, peak: 0.8, shape: grit(a, 7) }); }],
    ['팡 + 부품 튐', (a, o) => { boom(a, o, { from: 240, to: 60, dur: 0.15, peak: 0.8 }); [0.06, 0.12, 0.2].forEach((at, i) => ring(a, o, { base: 1400 + i * 300, dur: 0.06, peak: 0.25, at })); }]
  ],
  rabbit: [
    ['스프링 보잉', (a, o) => { tone(a, o, { type: 'triangle', from: 180, to: 560, glide: 0.12, dur: 0.16, peak: 0.6 }); whoosh(a, o, { from: 600, to: 2000, dur: 0.15, peak: 0.5 }); }],
    ['뿅 돌진', (a, o) => tone(a, soft(a, o, 2000), { type: 'square', from: 300, to: 900, dur: 0.1, peak: 0.3 })]
  ],
  trumpet: [
    ['짧은 나팔 뿌', (a, o) => horn(a, o, { from: 440, to: 415, dur: 0.14 })],
    ['두 음 뿌빠', (a, o) => { horn(a, o, { from: 392, dur: 0.08 }); horn(a, o, { from: 523, dur: 0.1, at: 0.07 }); }]
  ],
  musicbox: [
    ['오르골 세 음', (a, o) => notes(a, o, [[1568, 0], [1976, 0.05], [2349, 0.1]], { type: 'sine', dur: 0.3 })],
    ['딸깍 + 한 음', (a, o) => { clicks(a, o, { count: 1, gap: 0, freq: 3500 }); tone(a, o, { from: 1760, dur: 0.35, peak: 0.45, at: 0.01 }); }]
  ],
  spintop: [
    ['팽이 윙윙', (a, o) => whirl(a, o, { center: 900, depth: 500, rate: 18, dur: 0.55 })],
    ['올라가는 회전음', (a, o) => tone(a, soft(a, o, 1500), { type: 'sawtooth', from: 180, to: 520, dur: 0.45, attack: 0.05, peak: 0.35 })]
  ],
  drummer: [
    ['북 둥', (a, o) => { tone(a, o, { from: 130, to: 65, glide: 0.08, dur: 0.18, peak: 1 }); hiss(a, o, { freq: 250, q: 1, dur: 0.1, peak: 0.4 }); }],
    ['작은북 탁', (a, o) => { hiss(a, o, { type: 'highpass', freq: 1500, dur: 0.12, peak: 0.7 }); tone(a, o, { from: 210, to: 160, dur: 0.06, peak: 0.6 }); }]
  ],
  pikeman: [
    ['빠른 찌르기', (a, o) => { whoosh(a, o, { from: 1200, to: 3600, dur: 0.09, q: 1.6 }); hiss(a, o, { type: 'highpass', freq: 4500, dur: 0.012, at: 0.085, peak: 0.4 }); }],
    ['슉 + 쇠끝', (a, o) => { whoosh(a, o, { from: 900, to: 2600, dur: 0.11, q: 1.3 }); ring(a, o, { base: 1300, dur: 0.08, peak: 0.25, at: 0.1 }); }]
  ],
  pop: [
    ['용수철 튀어나옴', (a, o) => { clicks(a, o, { count: 1, gap: 0, freq: 2500, peak: 0.6 }); tone(a, o, { type: 'triangle', from: 220, to: 700, glide: 0.08, dur: 0.22, peak: 0.6, at: 0.01 }); }],
    ['뽁', (a, o) => { tone(a, o, { from: 420, to: 1200, dur: 0.05, peak: 0.8 }); hiss(a, o, { freq: 2000, q: 2, dur: 0.02, peak: 0.4 }); }]
  ],
  summon: [
    ['차오름 + 띵', (a, o) => { whoosh(a, o, { from: 200, to: 800, dur: 0.5, swell: 0.8, peak: 0.6 }); tone(a, o, { type: 'triangle', from: 523, dur: 0.3, peak: 0.4, at: 0.42 }); }],
    ['태엽 감기 + 쿵', (a, o) => { clicks(a, o, { count: 4, gap: 0.06, freq: 2200 }); boom(a, o, { from: 120, to: 50, dur: 0.18, peak: 0.6, at: 0.26 }); }]
  ],
  kill: [
    ['부서짐 + 부품', (a, o) => { hiss(a, o, { type: 'lowpass', freq: 2600, to: 500, dur: 0.12, peak: 0.9, shape: grit(a, 6) }); [0.04, 0.09, 0.15].forEach((at, i) => ring(a, o, { base: 1100 + i * 350, dur: 0.07, peak: 0.25, at })); }],
    ['나무 쪼개짐 + 펑', (a, o) => { hiss(a, o, { freq: 1500, q: 3, dur: 0.03, peak: 0.9 }); hiss(a, o, { type: 'lowpass', freq: 900, to: 200, dur: 0.22, attack: 0.01, peak: 0.6, at: 0.02 }); }]
  ],
  alarm: [
    ['두 음 사이렌', (a, o) => { const f = soft(a, o, 2500); [0, 0.12, 0.24, 0.36].forEach((at, i) => tone(a, f, { type: 'square', from: i % 2 ? 660 : 880, dur: 0.11, attack: 0.005, peak: 0.25, at })); }],
    ['경보 종', (a, o) => [0, 0.16, 0.32].forEach(at => ring(a, o, { base: 1250, dur: 0.15, peak: 0.45, at }))]
  ],
  'boss-claw': [
    ['쇠 집게 쾅', (a, o) => { boom(a, o, { from: 100, to: 30, dur: 0.4 }); ring(a, o, { base: 300, dur: 0.5, peak: 0.3 }); hiss(a, o, { type: 'lowpass', freq: 2500, to: 400, dur: 0.12, peak: 0.6, shape: grit(a, 6) }); }],
    ['유압 치익 + 쾅', (a, o) => { hiss(a, o, { type: 'highpass', freq: 2500, to: 4000, dur: 0.18, attack: 0.03, peak: 0.35 }); boom(a, o, { from: 110, to: 32, dur: 0.35, at: 0.18 }); }]
  ],
  'boss-magnet': [
    ['자석 웅', (a, o) => { const f = sweep(a, o, 300, 1500, 0.6); tone(a, f, { type: 'sawtooth', from: 60, to: 90, dur: 0.6, attack: 0.15, peak: 0.6 }); tone(a, f, { type: 'sawtooth', from: 121, to: 181, dur: 0.6, attack: 0.15, peak: 0.3 }); }],
    ['우웅 내려감', (a, o) => tone(a, o, { from: 220, to: 70, dur: 0.6, attack: 0.08, peak: 0.8 })]
  ],
  'boss-suction': [
    ['빨려 들어감', (a, o) => whoosh(a, o, { from: 3000, to: 300, dur: 0.7, swell: 0.85, q: 0.8 })],
    ['청소기 흡입', (a, o) => hiss(a, o, { type: 'lowpass', freq: 400, to: 2400, dur: 0.6, attack: 0.25, peak: 0.8 })]
  ],
  'boss-overcharge': [
    ['충전 후 폭발', (a, o) => { tone(a, soft(a, o, 2500), { type: 'sawtooth', from: 100, to: 800, dur: 0.35, attack: 0.3, peak: 0.25 }); boom(a, o, { from: 130, to: 30, dur: 0.45, at: 0.33 }); }],
    ['지지직 펑', (a, o) => { hiss(a, o, { type: 'highpass', freq: 3000, dur: 0.25, attack: 0.01, peak: 0.4, shape: grit(a, 10) }); boom(a, o, { from: 150, to: 35, dur: 0.35, at: 0.2 }); }]
  ],
  'boss-stickers': [
    ['딱지 세 장', (a, o) => clicks(a, o, { count: 3, gap: 0.08, freq: 2500, q: 2, dur: 0.03, peak: 0.8 })],
    ['착착 붙음', (a, o) => [0, 0.1].forEach(at => { hiss(a, o, { freq: 1800, q: 1.5, dur: 0.04, peak: 0.8, at }); tone(a, o, { from: 300, to: 200, dur: 0.04, peak: 0.3, at }); })]
  ],
  'boss-crane': [
    ['휘익 낙하 + 와장창', (a, o) => { tone(a, o, { from: 1500, to: 400, dur: 0.38, attack: 0.02, peak: 0.25 }); boom(a, o, { from: 120, to: 35, dur: 0.3, at: 0.38 }); hiss(a, o, { freq: 900, q: 2, dur: 0.15, peak: 0.6, at: 0.38 }); }],
    ['상자 쾅', (a, o) => { boom(a, o, { from: 110, to: 35, dur: 0.3 }); clicks(a, o, { count: 3, gap: 0.05, freq: 1200, q: 3, dur: 0.03, peak: 0.5, at: 0.03 }); }]
  ],
  'boss-fan': [
    ['지휘봉 두 번', (a, o) => { whoosh(a, o, { from: 700, to: 2400, dur: 0.12 }); whoosh(a, o, { from: 700, to: 2400, dur: 0.12, at: 0.16 }); }],
    ['휙 + 딱', (a, o) => { whoosh(a, o, { from: 600, to: 2000, dur: 0.14 }); hiss(a, o, { freq: 2200, q: 6, dur: 0.02, at: 0.14, peak: 0.6 }); }]
  ],
  'boss-march': [
    ['행진 북 네 번', (a, o) => [0, 0.12, 0.24, 0.36].forEach((at, i) => tone(a, o, { from: i === 0 ? 140 : 120, to: 60, glide: 0.06, dur: 0.12, peak: i === 0 ? 1 : 0.7, at }))],
    ['작은북 연타', (a, o) => clicks(a, o, { count: 6, gap: 0.05, freq: 1800, q: 0.8, dur: 0.05, peak: 0.6 })]
  ],
  'boss-stomp': [
    ['발구르기 쿵', (a, o) => { boom(a, o, { from: 80, to: 28, dur: 0.45 }); hiss(a, o, { type: 'lowpass', freq: 300, to: 80, dur: 0.6, attack: 0.02, peak: 0.4 }); }],
    ['쿵 + 덜컹', (a, o) => { boom(a, o, { from: 90, to: 30, dur: 0.35 }); clicks(a, o, { count: 3, gap: 0.04, freq: 1500, q: 3, dur: 0.02, peak: 0.4, at: 0.06 }); }]
  ],
  'boss-trumpetWave': [
    ['나팔 화음', (a, o) => [262, 330, 392].forEach(f => horn(a, o, { from: f, dur: 0.5, peak: 0.25 }))],
    ['팡파르 한 음', (a, o) => horn(a, o, { from: 349, to: 392, dur: 0.45, bright: 3000 })]
  ],
  'boss-charge': [
    ['나팔 + 돌진', (a, o) => { horn(a, o, { from: 196, to: 392, dur: 0.35, peak: 0.4 }); whoosh(a, o, { from: 400, to: 2000, dur: 0.5, peak: 0.6, at: 0.1 }); }],
    ['긴 나팔', (a, o) => horn(a, o, { from: 233, dur: 0.6, peak: 0.5 })]
  ],
  'boss-column': [
    ['대열 북 + 나팔', (a, o) => { [0, 0.15, 0.3].forEach(at => tone(a, o, { from: 130, to: 60, glide: 0.06, dur: 0.12, peak: 0.8, at })); horn(a, o, { from: 294, dur: 0.25, peak: 0.25, at: 0.3 }); }],
    ['발맞춰 쿵쿵', (a, o) => [0, 0.18, 0.36].forEach(at => boom(a, o, { from: 100, to: 40, dur: 0.15, peak: 0.6, at }))]
  ],
  'boss-carpet': [
    ['카펫 펼침 + 띵', (a, o) => { whoosh(a, o, { from: 300, to: 1200, dur: 0.35, q: 0.7 }); tone(a, o, { type: 'triangle', from: 784, dur: 0.3, peak: 0.35, at: 0.3 }); }],
    ['또르르 굴러감', (a, o) => clicks(a, o, { count: 8, gap: 0.035, freq: 900, q: 2, dur: 0.02, peak: 0.5 })]
  ],
  clear: [
    ['짧은 승리 음', (a, o) => { notes(a, o, [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24]], { dur: 0.35, peak: 0.4 }); hiss(a, o, { type: 'highpass', freq: 6000, dur: 0.4, attack: 0.15, peak: 0.1, at: 0.2 }); }],
    ['나팔 따단', (a, o) => { horn(a, o, { from: 392, dur: 0.12, peak: 0.4 }); horn(a, o, { from: 523, dur: 0.4, peak: 0.45, at: 0.12, bright: 3000 }); }]
  ],
  loot: [
    ['동전 짤랑', (a, o) => [0, 0.06, 0.11].forEach((at, i) => ring(a, o, { base: 2000 + i * 300, dur: 0.12, peak: 0.35, at, partials: COIN }))],
    ['동전 + 반짝', (a, o) => { ring(a, o, { base: 2200, dur: 0.15, peak: 0.4, partials: COIN }); notes(a, o, [[2637, 0.07], [3136, 0.12]], { type: 'sine', dur: 0.15, peak: 0.2 }); }]
  ],
  cards: [
    ['착 + 짠', (a, o) => { whoosh(a, o, { from: 1500, to: 4000, dur: 0.1, q: 0.8, peak: 0.6 }); notes(a, o, [[523, 0.08], [784, 0.08], [1047, 0.08]], { dur: 0.3, peak: 0.25 }); }],
    ['카드 세 장', (a, o) => [0, 0.07, 0.14].forEach(at => hiss(a, o, { freq: 3000, q: 1.2, dur: 0.035, peak: 0.7, at }))]
  ],
  pick: [
    ['확정 두 음', (a, o) => { const f = soft(a, o, 3000); tone(a, f, { type: 'square', from: 660, dur: 0.07, peak: 0.25 }); tone(a, f, { type: 'square', from: 990, dur: 0.14, peak: 0.25, at: 0.07 }); }],
    ['도장 탁 + 띵', (a, o) => { tone(a, o, { from: 150, to: 70, dur: 0.07, peak: 0.8 }); hiss(a, o, { freq: 1200, q: 2, dur: 0.03, peak: 0.6 }); tone(a, o, { type: 'triangle', from: 1319, dur: 0.25, peak: 0.3, at: 0.05 }); }]
  ]
};
/** Glass and ice ring brighter and longer than metal: partials closer to a bell's. */
const GLASS = [1, 2.32, 4.25, 6.63];
/** Frost settling: tiny high clicks scattered over `dur`, like ice crystals forming. */
function crackle(audio, out, { count, dur, freq = 6000, peak = 0.35, at = 0 }) {
  for (let i = 0; i < count; i++) hiss(audio, out, { type: 'highpass', freq: freq * (0.8 + Math.random() * 0.5), dur: 0.006 + Math.random() * 0.01, peak: peak * (0.5 + Math.random() * 0.5), at: at + Math.random() * dur });
}

/** The ice skills, still on recordings: three coded candidates each, compared on ice-sfx.html. */
export const ICE_CANDIDATES = {
  frostBolt: [
    ['얼음 화살 쉭 + 챙', (a, o) => { whoosh(a, o, { from: 2000, to: 5200, dur: 0.12, q: 1.4, peak: 0.6 }); ring(a, o, { base: 2600, dur: 0.3, peak: 0.35, at: 0.06, partials: GLASS }); }],
    ['크리스탈 핑', (a, o) => { tone(a, o, { from: 1800, to: 2700, glide: 0.06, dur: 0.22, peak: 0.45 }); notes(a, o, [[3520, 0.05], [4186, 0.1]], { type: 'sine', dur: 0.18, peak: 0.18 }); crackle(a, o, { count: 5, dur: 0.15, at: 0.03 }); }],
    ['얼음 조각 날림', (a, o) => { hiss(a, o, { type: 'highpass', freq: 4000, dur: 0.02, peak: 0.6 }); ring(a, o, { base: 3100, dur: 0.18, peak: 0.3, partials: GLASS }); crackle(a, o, { count: 8, dur: 0.2, peak: 0.4 }); }]
  ],
  coolingField: [
    ['냉기 퍼짐', (a, o) => { hiss(a, o, { type: 'lowpass', freq: 600, to: 3000, dur: 0.6, attack: 0.15, peak: 0.6 }); hiss(a, o, { type: 'highpass', freq: 7000, dur: 0.6, attack: 0.2, peak: 0.15 }); notes(a, o, [[1568, 0.15], [2093, 0.25], [2637, 0.35]], { type: 'sine', dur: 0.4, peak: 0.12 }); }],
    ['서리 내려앉음', (a, o) => { whoosh(a, o, { from: 2500, to: 900, dur: 0.6, swell: 0.3, q: 0.7, peak: 0.45 }); crackle(a, o, { count: 18, dur: 0.6, peak: 0.45 }); }],
    ['얼음 바닥 쩡', (a, o) => { tone(a, o, { from: 160, to: 90, dur: 0.25, peak: 0.6 }); ring(a, o, { base: 820, dur: 0.6, peak: 0.35, partials: GLASS }); crackle(a, o, { count: 10, dur: 0.4, peak: 0.35, at: 0.05 }); }]
  ]
};
/** Every coded sound, by name, for sfx.js. */
export const CODED_SOUNDS = { ...PLAYER_CANDIDATES, ...WORLD_CANDIDATES, ...ICE_CANDIDATES };
