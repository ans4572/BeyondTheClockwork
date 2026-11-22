// Chapter 3's sounds (2026-11-19): the clock tower's ordinary enemies, Tick·Tock and Belgard, built in code like
// mob2-sound.js and with its pieces (soft from the start: every layer rises over 5 ms at least, noise kept under 5 kHz,
// no bare square or saw waves, each play a little off in pitch). sfx.js names them and sets their volumes; the enemies'
// blows sense { kind: 'mob', id: type }, the bosses' { kind: 'boss', id } and play as boss-<id>.
// The tower's voice: wood and brass clockwork (ticks, ratchets, springs) for the twins and the mobs; bronze bells, a
// greatsword and heavy armour for Belgard; Orden's cyan as glassy tuning-fork tones.
import { tone, band, whoosh, clang, thud, recipe } from './mob2-sound.js';
import { noise } from './water-sound.js';

/** A clock's tick: a short, bright knock of wood and brass. */
const tick = (a, o, { freq = 2400, at = 0, peak = 0.4 } = {}) => {
  band(a, o, { freq, q: 5, dur: 0.018, peak, at });
  tone(a, o, { type: 'triangle', from: freq * 0.5, dur: 0.03, peak: peak * 0.35, at });
};
/** A run of ratchet clicks, `count` of them `gap` apart, falling a little in pitch. */
const ratchet = (a, o, { count = 6, gap = 0.03, freq = 2000, at = 0, peak = 0.3 } = {}) => {
  for (let i = 0; i < count; i++) tick(a, o, { freq: freq * (1 - i * 0.025), at: at + i * gap, peak: peak * (1 - i * 0.06) });
};
/** A struck bronze bell: a hum, the strike tone and its inharmonic partials, ringing out over `dur`. */
const bronze = (a, o, { base, dur = 1.6, peak = 0.4, at = 0 }) => {
  for (const [ratio, level, length] of [[0.5, 0.5, 1], [1, 1, 0.8], [1.19, 0.45, 0.6], [1.5, 0.35, 0.5], [2, 0.3, 0.45], [2.52, 0.18, 0.3]]) tone(a, o, { from: base * ratio, dur: dur * length, attack: 0.006, peak: peak * level, at });
  band(a, o, { freq: base * 4, q: 3, dur: 0.03, peak: peak * 0.4, at });
};
/** A tuning fork: two pure tones a few hertz apart, so it shimmers as it rings. */
const fork = (a, o, { freq = 880, dur = 0.9, peak = 0.3, at = 0, attack = 0.01 }) => {
  tone(a, o, { from: freq, dur, attack, peak, at });
  tone(a, o, { from: freq * 1.005, dur: dur * 0.9, attack, peak: peak * 0.7, at });
  tone(a, o, { from: freq * 2.76, dur: dur * 0.25, attack, peak: peak * 0.12, at });
};

// ---- The bosses' pieces (2026-11-19, second pass): the first pass's sine partials read as a kalimba or a wood block
// and its impacts as a kick drum (earshot), so the bosses ring and break like real bodies: struck modes rung through
// resonators, a crack on top, a grained body, debris, and the tower hall's tail.

/** Keeps a voice alive for `seconds` (sfx.js frees a voice 0.34 s after its last source ends; rings outlast theirs). */
const keep = (a, seconds) => { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, a.sampleRate); s.loop = true; s.start(a.currentTime); s.stop(a.currentTime + seconds); };
/**
 * A struck body: a short noise strike (5 ms rise) rung through one high-Q resonator per mode [ratio, level, seconds to
 * die away by 60 dB]. Unlike sine partials, each play rings a little differently and the strike's grit stays in it.
 * `detune` adds a twin a few hertz off each mode, so a bell beats as it hums.
 */
function modal(a, o, { base, modes, peak = 0.5, at = 0, strike = 0.008, detune = 0 }) {
  const t = a.currentTime + at, src = noise(a), hit = a.createGain(), sr = a.sampleRate;
  hit.gain.setValueAtTime(0.0001, t); hit.gain.linearRampToValueAtTime(1, t + 0.005); hit.gain.exponentialRampToValueAtTime(0.0001, t + 0.005 + strike);
  src.connect(hit); let longest = 0;
  // The strike's charge into a resonator of bandwidth bw: about 2 pi bw x rms x sqrt(effective length / rate).
  const charge = 2 * Math.PI * 0.577 * Math.sqrt((0.0025 + strike * 0.22) / sr);
  for (const [ratio, level, secs] of modes) for (const off of detune ? [0, detune] : [0]) {
    const f = base * ratio + off; if (f > 4600 || f < 30) continue;
    const bw = 6.9 / (Math.PI * secs), bp = a.createBiquadFilter(), g = a.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = f / bw;
    g.gain.value = peak * level * (off ? 0.6 : 1) / (bw * charge);
    hit.connect(bp).connect(g).connect(o); longest = Math.max(longest, secs);
  }
  src.start(t, Math.random()); src.stop(t + 0.03 + strike); keep(a, at + longest + 0.1);
}
// Modes as [ratio, level, seconds]. A cast bronze bell (hum, prime, minor-third tierce, quint, nominal and up), a steel
// blade, an armour plate, small clock brass, a wood block.
const BELL = [[0.5, 0.55, 3.4], [1, 1, 2.4], [1.183, 0.6, 1.8], [1.5, 0.32, 1.3], [2, 0.5, 1.1], [2.5, 0.2, 0.7], [2.67, 0.2, 0.6], [3.01, 0.13, 0.45], [4.07, 0.08, 0.3]];
const STEEL = [[1, 1, 0.9], [2.76, 0.45, 0.5], [5.4, 0.25, 0.3], [8.93, 0.12, 0.18]];
const PLATE = [[1, 1, 0.22], [1.58, 0.75, 0.18], [2.31, 0.5, 0.13], [3.1, 0.35, 0.1], [3.86, 0.25, 0.08], [5.2, 0.12, 0.05]];
const BRASS = [[1, 1, 0.07], [1.47, 0.55, 0.05], [2.09, 0.35, 0.035], [2.86, 0.2, 0.025]];
const WOOD = [[1, 1, 0.09], [2.57, 0.4, 0.045], [4.1, 0.18, 0.025]];
/** Scales each mode's ring time (a small hand bell rings shorter than the chest bell). */
const ringFor = (modes, k) => modes.map(([r, l, s]) => [r, l, s * k]);

/**
 * The crack on top of a blow: a crunch of four tiny grains inside 14 ms at scattered pitches (one smooth noise burst
 * read as a snare drum), each rising over 5 ms like every layer.
 */
function crack(a, o, { at = 0, peak = 0.5, freq = 2600, dur = 0.022 } = {}) {
  for (let i = 0; i < 4; i++) band(a, o, { freq: freq * (0.5 + Math.random() * 1.1), q: 2.2, dur: dur * (0.5 + Math.random() * 0.6), peak: peak * (i ? 0.55 : 0.8), at: at + i * 0.0045 + Math.random() * 0.002 });
}
/** Softly clips what is drawn into it, so a heavy blow has some grit; returns the node to draw into. */
function grit(a, o, drive = 2.2) {
  const w = a.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * drive) / Math.tanh(drive); }
  w.curve = curve; w.connect(o); return w;
}
/** A heavy body landing: a resonant low noise burst falling in pitch, a sub thud under it, through grit. */
function body(a, o, { at = 0, peak = 0.8, freq = 110, dur = 0.3, drive = 2.2 } = {}) {
  const g = grit(a, o, drive);
  band(a, g, { type: 'lowpass', freq: freq * 2.4, to: freq * 0.7, q: 3.5, dur, attack: 0.005, peak: peak * 0.9, at });
  thud(a, g, { from: freq * 1.3, to: freq * 0.38, dur: dur * 1.2, peak: peak * 0.7, at });
}
/** Debris after a blow: `count` short grains of stone or metal, thinning out over `span`. */
function debris(a, o, { at = 0, count = 10, span = 0.4, freq = 1800, peak = 0.25, q = 2.5 } = {}) {
  for (let i = 0; i < count; i++) {
    const when = at + 0.015 + span * Math.pow(i / count, 1.6) + Math.random() * 0.02;
    band(a, o, { freq: freq * (0.55 + Math.random() * 0.9), q, dur: 0.015 + Math.random() * 0.035, peak: peak * (1 - i / count * 0.7) * (0.5 + Math.random() * 0.5), at: when });
  }
}
/** A short rattle of small brass clicks (gear teeth, a pawl), each a real little ring; `accel` < 1 speeds them up. */
function teeth(a, o, { count = 5, gap = 0.03, base = 2000, at = 0, peak = 0.3, accel = 1 } = {}) {
  let when = at;
  for (let i = 0; i < count; i++) {
    modal(a, o, { base: base * (1 - i * 0.02) * (0.97 + Math.random() * 0.06), modes: BRASS, peak: peak * (1 - i * 0.05), at: when, strike: 0.003 });
    when += gap * Math.pow(accel, i);
  }
}
const halls = new Map();
/**
 * The tower room around a big blow or a bell: draws go straight to `o` and, 6 ms later, into a short stone room's
 * tail at `wet`. Returns the node to draw into. The impulse is made once per sample rate and length.
 * Kept short and bright (2026-11-19): the first version (18 ms late, 1 to 2.4 s, darkening, twice as loud) made the
 * bosses sound like they fought in a cave (earshot: the tails three times as long, "echoing in a cave" z 0.1 -> 1.5).
 * Quick blows (wet under 0.15) get only a 0.22 s room: just enough stone around them to stop sounding pasted on.
 */
function hall(a, o, { seconds = 1.4, wet = 0.2 } = {}) {
  const length = wet < 0.15 ? 0.22 : Math.min(0.7, seconds * 0.35), key = `${a.sampleRate}:${length}`;
  if (!halls.has(key)) {
    const n = Math.ceil(a.sampleRate * length), ir = a.createBuffer(1, n, a.sampleRate), d = ir.getChannelData(0);
    let seed = 1337, y = 0, energy = 0;
    for (let i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const u = i / n, x = seed / 2147483648 - 1, c = 0.75 - 0.35 * u; y += c * (x - y);
      d[i] = y * Math.min(1, i / (a.sampleRate * 0.004)) * Math.exp(-6.9 * u); energy += d[i] * d[i];
    }
    const scale = 1 / Math.sqrt(energy); for (let i = 0; i < n; i++) d[i] *= scale;
    halls.set(key, ir);
  }
  const input = a.createGain(), delay = a.createDelay(0.05), room = a.createConvolver(), level = a.createGain();
  delay.delayTime.value = 0.006; room.normalize = false; room.buffer = halls.get(key); level.gain.value = wet * 0.55;
  input.connect(o); input.connect(delay).connect(room).connect(level).connect(o);
  keep(a, length + 0.3); return input;
}
/** A whistle: a pure tone gliding with a slight wobble (air past a falling bell). */
function whistle(a, o, { from, to = from, dur, peak = 0.3, at = 0, wobble = 7 }) {
  const t = a.currentTime + at, osc = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), depth = a.createGain();
  osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  lfo.frequency.value = wobble; depth.gain.value = from * 0.012; lfo.connect(depth).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.08); g.gain.setValueAtTime(peak, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o); osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
/** A blade's ring: steel modes, quiet, high. */
const shing = (a, o, { base = 2200, at = 0, peak = 0.1, k = 1 } = {}) => modal(a, o, { base, modes: ringFor(STEEL, k), peak, at, strike: 0.004 });
/** The pieces, for the light and magnet elements' recipes (light-magnet-sound.js). */
export { keep, modal, crack, grit, body, debris, hall, STEEL, PLATE, ringFor };

export const CLOCK_CANDIDATES = {
  // ---- the ordinary enemies
  // 초침 기사: the long second hand swept through half a turn, and the tick it lands on.
  secondHandKnight: [['초침 반바퀴 휘두름 + 째깍', recipe((a, o, k) => {
    whoosh(a, o, { from: 420 * k, to: 1500 * k, dur: 0.24, peak: 0.55 });
    tick(a, o, { freq: 2600 * k, at: 0.21, peak: 0.45 });
    clang(a, o, { base: 880 * k, dur: 0.14, peak: 0.12, at: 0.21 });
  })]],
  // 종 탄환 포탑: a little bell shell lobbed out of its mouth: a ding and the hollow pop of the launch.
  bellTurret: [['종 탄환 뿅 + 딩', recipe((a, o, k) => {
    thud(a, o, { from: 230 * k, to: 110 * k, dur: 0.09, peak: 0.55 });
    bronze(a, o, { base: 1180 * k, dur: 0.45, peak: 0.16, at: 0.02 });
  })]],
  // 신호 구체: the beat it sends out: a soft electric pulse, rising.
  signalOrb: [['신호 박동 웅', recipe((a, o, k) => {
    tone(a, o, { from: 330 * k, to: 660 * k, dur: 0.16, attack: 0.012, peak: 0.42 });
    tone(a, o, { type: 'triangle', from: 990 * k, dur: 0.12, attack: 0.012, peak: 0.12, at: 0.06 });
    band(a, o, { freq: 1600 * k, q: 3, dur: 0.1, attack: 0.01, peak: 0.12, at: 0.04 });
  })]],
  // 모래시계 방패병: the hourglass shield rammed forward, and its sand hissing inside.
  hourglassShield: [['방패 쿵 + 모래 사르르', recipe((a, o, k) => {
    thud(a, o, { from: 150 * k, to: 55 * k, dur: 0.2, peak: 0.9 });
    clang(a, o, { base: 240 * k, dur: 0.2, peak: 0.1 });
    band(a, o, { type: 'bandpass', freq: 3200 * k, to: 1800 * k, q: 0.8, dur: 0.35, attack: 0.04, peak: 0.16, at: 0.05 });
  })]],
  // 분침 궁수: the bow's string and the arrow off it.
  minuteArcher: [['활시위 팅 + 화살 휙', recipe((a, o, k) => {
    tone(a, o, { type: 'triangle', from: 240 * k, to: 200 * k, dur: 0.14, peak: 0.42 });
    tone(a, o, { from: 480 * k, to: 400 * k, dur: 0.08, peak: 0.15 });
    whoosh(a, o, { from: 1100 * k, to: 2800 * k, dur: 0.13, peak: 0.28, at: 0.02 });
  })]],
  // 진자 경비: the heavy pendulum swung through, a tick at either end of its swing.
  pendulumGuard: [['진자 부웅 + 째깍', recipe((a, o, k) => {
    tick(a, o, { freq: 2100 * k, peak: 0.35 });
    whoosh(a, o, { from: 180 * k, to: 640 * k, dur: 0.34, q: 0.9, peak: 0.6 });
    thud(a, o, { from: 140 * k, to: 60 * k, dur: 0.16, peak: 0.55, at: 0.28 });
    tick(a, o, { freq: 1600 * k, at: 0.32, peak: 0.3 });
  })]],
  // 톱니 굴림이: the gear rolling at F2, its teeth rattling on the floor.
  gearRoller: [['톱니 드르륵 굴러옴', recipe((a, o, k) => {
    ratchet(a, o, { count: 9, gap: 0.032, freq: 1700 * k, peak: 0.32 });
    band(a, o, { type: 'lowpass', freq: 700 * k, dur: 0.32, attack: 0.03, peak: 0.3 });
  })]],
  // 쌍침 대장: two hands swung one after the other, each sending its wave.
  twinHandCaptain: [['두 바늘 연속 휘두름', recipe((a, o, k) => {
    whoosh(a, o, { from: 380 * k, to: 1300 * k, dur: 0.18, peak: 0.5 });
    clang(a, o, { base: 520 * k, dur: 0.22, peak: 0.12, at: 0.12 });
    whoosh(a, o, { from: 450 * k, to: 1500 * k, dur: 0.18, peak: 0.5, at: 0.17 });
    clang(a, o, { base: 620 * k, dur: 0.24, peak: 0.12, at: 0.29 });
  })]],

  // ---- Tick·Tock (second pass, 2026-11-19): clockwork brass and wood, rung for real, in the tower hall.
  // The beat under the twin whose turn it is: Tick's a bright brass tick, Tock's a hollow wooden tock (a quiet guide to
  // the rhythm, and to the blows that come off it).
  'boss-ttBeatTick': [['틱 (박자)', recipe((a, o, k) => {
    modal(a, o, { base: 2350 * k, modes: BRASS, peak: 0.45, strike: 0.003 });
    modal(a, o, { base: 3100 * k, modes: BRASS, peak: 0.25, at: 0.009, strike: 0.002 });
  })]],
  'boss-ttBeatTock': [['톡 (박자)', recipe((a, o, k) => {
    modal(a, o, { base: 760 * k, modes: WOOD, peak: 0.55, strike: 0.004 });
    crack(a, o, { freq: 2000 * k, peak: 0.12, dur: 0.012 });
  })]],
  // Tick's thrusts: the pointer stabbed out with a short rush and a ring of its steel; the third harder, with a crack.
  'boss-ttThrust': [['찌르기 칙', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 0.9, wet: 0.1 });
    whoosh(a, h, { from: 900 * k, to: 2600 * k, dur: 0.1, q: 1.4, peak: 0.55 });
    band(a, h, { freq: 2600 * k, to: 1500 * k, q: 2, dur: 0.05, peak: 0.3, at: 0.05 });
    shing(a, h, { base: 2300 * k, at: 0.06, peak: 0.09, k: 0.35 });
  })]],
  'boss-ttThrust3': [['세 번째 찌르기 칙!', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.1, wet: 0.14 });
    whoosh(a, h, { from: 600 * k, to: 2300 * k, dur: 0.14, q: 1.2, peak: 0.6 });
    crack(a, h, { at: 0.11, freq: 2400 * k, peak: 0.45 });
    shing(a, h, { base: 1850 * k, at: 0.11, peak: 0.16, k: 0.6 });
    body(a, h, { at: 0.11, freq: 170 * k, dur: 0.14, peak: 0.45 });
  })]],
  // Tock's sweep: the minute hand round the half dial, its steel singing, the gears flying off it.
  'boss-ttSweep': [['분침 반원 휘두름', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.1, wet: 0.12 });
    whoosh(a, h, { from: 320 * k, to: 1400 * k, dur: 0.3, peak: 0.6 });
    whoosh(a, h, { from: 1400 * k, to: 3000 * k, dur: 0.22, q: 2, peak: 0.16, at: 0.06 });
    shing(a, h, { base: 1700 * k, at: 0.16, peak: 0.07, k: 0.5 });
    teeth(a, h, { count: 3, gap: 0.05, base: 1900 * k, at: 0.24, peak: 0.3 });
  })]],
  // Tick's dash: the spring wound tight (a ratchet speeding up), then let go in a rush.
  'boss-ttDash': [['태엽 풀며 돌진', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1, wet: 0.1 });
    teeth(a, h, { count: 5, gap: 0.03, base: 2300 * k, peak: 0.28, accel: 0.82 });
    whoosh(a, h, { from: 220 * k, to: 950 * k, dur: 0.42, peak: 0.6, at: 0.09 });
    band(a, h, { type: 'lowpass', freq: 500 * k, to: 160 * k, dur: 0.3, attack: 0.03, peak: 0.25, at: 0.09 });
    tone(a, h, { type: 'triangle', from: 300 * k, to: 900 * k, dur: 0.16, peak: 0.08, at: 0.1 });
  })]],
  // The pendulum floor blowing, side by side: the floor plate cracking up with a brass ring and stone falling.
  'boss-ttPendulum': [['진자 바닥 쾅', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    crack(a, h, { freq: 2200 * k, peak: 0.5 });
    body(a, h, { freq: 105 * k, dur: 0.34, peak: 0.9 });
    modal(a, h, { base: 190 * k, modes: ringFor(PLATE, 2.2), peak: 0.14, strike: 0.006 });
    debris(a, h, { count: 9, span: 0.35, freq: 1500 * k, peak: 0.18 });
  })]],
  // The shuffle's bomb going off: a pop, the spring flying loose, gear bits scattering.
  'boss-ttShuffleBurst': [['태엽 폭탄 펑', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    crack(a, h, { freq: 1800 * k, peak: 0.6, dur: 0.03 });
    body(a, h, { freq: 140 * k, dur: 0.3, peak: 0.85, drive: 3 });
    band(a, h, { freq: 1100 * k, to: 260 * k, q: 0.8, dur: 0.28, peak: 0.35 });
    tone(a, h, { type: 'triangle', from: 520 * k, to: 1300 * k, dur: 0.2, peak: 0.1, at: 0.02 });
    teeth(a, h, { count: 4, gap: 0.07, base: 2600 * k, at: 0.08, peak: 0.16, accel: 1.2 });
  })]],
  // The giant metronome: a heavy brass tick as it lets go, its long rod sweeping through, the hall carrying it.
  'boss-ttBladeSwing': [['큰 메트로놈 부우웅', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.18 });
    modal(a, h, { base: 1050 * k, modes: BRASS, peak: 0.22, strike: 0.004 });
    whoosh(a, h, { from: 140 * k, to: 480 * k, dur: 0.8, q: 0.8, peak: 0.6 });
    band(a, h, { type: 'lowpass', freq: 180 * k, to: 340 * k, q: 1, dur: 0.5, attack: 0.2, peak: 0.15 });
  })]],
  // The echo's mark blowing: a glass tick and a pop, the tick coming back off the walls twice.
  'boss-ttEchoBlow': [['메아리 째깍 펑', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.24 });
    body(a, h, { freq: 170 * k, dur: 0.16, peak: 0.6 });
    for (const [at, level] of [[0, 1], [0.13, 0.45], [0.26, 0.2]]) modal(a, h, { base: 1760 * k, modes: ringFor(BRASS, 3), peak: 0.32 * level, at, strike: 0.003 });
    tone(a, h, { from: 1760 * k, to: 880 * k, dur: 0.14, peak: 0.12 });
  })]],
  // The pincer closing on the middle: two iron hands meeting, a clank and the floor taking it.
  'boss-ttPincerClose': [['집게 닫힘 철컹', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.4, wet: 0.16 });
    crack(a, h, { freq: 3400 * k, peak: 0.25, dur: 0.012 });
    modal(a, h, { base: 340 * k, modes: ringFor(PLATE, 3.2), peak: 0.42, strike: 0.005 });
    modal(a, h, { base: 455 * k, modes: ringFor(PLATE, 2.6), peak: 0.34, at: 0.02, strike: 0.005 });
    body(a, h, { freq: 140 * k, dur: 0.2, peak: 0.6, at: 0.01 });
  })]],
  // Both blinking back in at their ends: a rising whisk of air into a brass tick, a glint on top.
  'boss-ttBlinkIn': [['순간이동 뿅', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1, wet: 0.14 });
    whoosh(a, h, { from: 500 * k, to: 2400 * k, dur: 0.12, q: 1.5, peak: 0.3 });
    tone(a, h, { from: 600 * k, to: 1500 * k, dur: 0.1, attack: 0.008, peak: 0.16 });
    modal(a, h, { base: 2600 * k, modes: BRASS, peak: 0.35, at: 0.1, strike: 0.003 });
    fork(a, h, { freq: 3136 * k, dur: 0.2, peak: 0.03, at: 0.1 });
  })]],
  // The colour floor's squares changing once more (the twist): the dial's pawl clicking round.
  'boss-ttTwist': [['칸 색 바뀜 드륵', recipe((a, o, k) => teeth(a, o, { count: 4, gap: 0.04, base: 2100 * k, peak: 0.32 }))]],
  // A flank wall's gears: a wall of teeth rattling past, low, with air.
  'boss-ttFlank': [['톱니 벽 드르륵', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.2, wet: 0.14 });
    teeth(a, h, { count: 8, gap: 0.027, base: 1500 * k, peak: 0.28 });
    whoosh(a, h, { from: 300 * k, to: 900 * k, dur: 0.26, peak: 0.35 });
    band(a, h, { type: 'lowpass', freq: 300 * k, dur: 0.24, attack: 0.03, peak: 0.25 });
  })]],
  // A thrown gear: a tick off the hand and the gear whirring away (its teeth beating the air).
  'boss-ttGearThrow': [['톱니 던짐 휭', recipe((a, o, k) => {
    modal(a, o, { base: 2200 * k, modes: BRASS, peak: 0.22, strike: 0.003 });
    whoosh(a, o, { from: 700 * k, to: 1900 * k, dur: 0.18, peak: 0.32, at: 0.01 });
  })]],
  // The colour floor: the other colour's squares blowing, Tick's call ringing high and Tock's low.
  'boss-ttColourTick': [['빨강 칸 남기고 쾅', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    crack(a, h, { freq: 2400 * k, peak: 0.45 });
    body(a, h, { freq: 120 * k, dur: 0.28, peak: 0.85 });
    debris(a, h, { count: 8, span: 0.3, freq: 1700 * k, peak: 0.16 });
    modal(a, h, { base: 1320 * k, modes: ringFor(BRASS, 6), peak: 0.16, at: 0.01 });
  })]],
  'boss-ttColourTock': [['파랑 칸 남기고 쾅', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    crack(a, h, { freq: 1900 * k, peak: 0.45 });
    body(a, h, { freq: 110 * k, dur: 0.3, peak: 0.85 });
    debris(a, h, { count: 8, span: 0.3, freq: 1300 * k, peak: 0.16 });
    modal(a, h, { base: 660 * k, modes: ringFor(WOOD, 4), peak: 0.22, at: 0.01 });
  })]],

  // ---- Belgard (second pass, 2026-11-19): a knight in heavy plate with a greatsword, a bronze bell in his chest,
  // fighting in the bell tower's stone hall; Orden's cyan as glass and tuning forks.
  // The greatsword's cuts: his plate shifting, heavy air, the blade's ring; the third, the lunge, landing with his weight.
  'boss-bgCombo': [['대검 베기 부웅', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.3, wet: 0.14 });
    debris(a, h, { count: 4, span: 0.05, freq: 3000 * k, peak: 0.06, q: 6 });
    whoosh(a, h, { from: 240 * k, to: 900 * k, dur: 0.28, q: 0.9, peak: 0.65 });
    band(a, h, { type: 'lowpass', freq: 140 * k, to: 320 * k, q: 1.5, dur: 0.26, attack: 0.08, peak: 0.3 });
  })]],
  'boss-bgCombo3': [['돌진 내려베기 쿵', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
    modal(a, h, { base: 560 * k, modes: PLATE, peak: 0.12, strike: 0.004 });
    whoosh(a, h, { from: 170 * k, to: 720 * k, dur: 0.36, q: 0.9, peak: 0.6 });
    crack(a, h, { at: 0.18, freq: 2000 * k, peak: 0.55, dur: 0.03 });
    body(a, h, { at: 0.18, freq: 88 * k, dur: 0.4, peak: 1, drive: 2.8 });
    shing(a, h, { base: 1150 * k, at: 0.18, peak: 0.1, k: 0.9 });
    debris(a, h, { at: 0.2, count: 12, span: 0.45, freq: 1400 * k, peak: 0.2 });
  })]],
  'boss-bgSpin': [['회전 베기', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.3, wet: 0.14 });
    whoosh(a, h, { from: 260 * k, to: 1000 * k, dur: 0.22, peak: 0.55 });
    whoosh(a, h, { from: 300 * k, to: 1150 * k, dur: 0.22, peak: 0.55, at: 0.18 });
    band(a, h, { type: 'lowpass', freq: 150 * k, to: 330 * k, q: 1.5, dur: 0.4, attack: 0.1, peak: 0.25 });
  })]],
  // The blade brought down into the floor: a crack, the stone taking his weight, the steel ringing in it, rubble.
  'boss-bgSlam': [['대검 내려찍기', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2, wet: 0.24 });
    crack(a, h, { freq: 1900 * k, peak: 0.6, dur: 0.035 });
    body(a, h, { freq: 78 * k, dur: 0.46, peak: 1, drive: 3 });
    band(a, h, { type: 'lowpass', freq: 1500 * k, to: 280 * k, dur: 0.48, peak: 0.25 });
    shing(a, h, { base: 720 * k, peak: 0.12, k: 1.1 });
    debris(a, h, { at: 0.03, count: 16, span: 0.6, freq: 1300 * k, peak: 0.22 });
  })]],
  // The floor tearing open along the cracks: stone splitting in a run of cracks over a low rumble.
  'boss-bgCracks': [['바닥 균열 쩌적', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2, wet: 0.22 });
    body(a, h, { freq: 72 * k, dur: 0.36, peak: 0.55, drive: 3 });
    band(a, h, { type: 'lowpass', freq: 220 * k, to: 90 * k, q: 1.2, dur: 0.6, attack: 0.02, peak: 0.3 });
    debris(a, h, { count: 26, span: 0.55, freq: 1900 * k, peak: 0.24, q: 1.5 });
    for (const [at, f] of [[0.02, 1], [0.07, 1.25], [0.13, 0.9], [0.2, 1.15], [0.28, 0.8]]) {
      crack(a, h, { at, freq: 2100 * k * f, peak: 0.32, dur: 0.03 });
      debris(a, h, { at, count: 4, span: 0.08, freq: 2600 * k * f, peak: 0.16, q: 3 });
    }
    debris(a, h, { at: 0.1, count: 12, span: 0.5, freq: 1100 * k, peak: 0.16 });
  })]],
  // The gauntlet reaching out and closing: mail jingling, plate on plate, a grip.
  'boss-bgGrab': [['건틀릿 움켜쥠', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.2, wet: 0.14 });
    whoosh(a, h, { from: 300 * k, to: 800 * k, dur: 0.18, peak: 0.45 });
    debris(a, h, { count: 7, span: 0.14, freq: 3400 * k, peak: 0.12, q: 6 });
    crack(a, h, { at: 0.15, freq: 2600 * k, peak: 0.35, dur: 0.015 });
    modal(a, h, { base: 400 * k, modes: PLATE, peak: 0.26, at: 0.15, strike: 0.005 });
    body(a, h, { at: 0.16, freq: 150 * k, dur: 0.12, peak: 0.5 });
  })]],
  // A bare-fisted blow while the sword is away: gauntlet on flesh and plate.
  'boss-bgPunch': [['맨주먹', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1, wet: 0.12 });
    crack(a, h, { freq: 1600 * k, peak: 0.5, dur: 0.02 });
    body(a, h, { freq: 140 * k, dur: 0.14, peak: 0.85, drive: 2.6 });
    modal(a, h, { base: 520 * k, modes: PLATE, peak: 0.12, strike: 0.004 });
  })]],
  // His chest bell's toll (the rings, the last toll's strikes): a big cast bronze bell, humming and beating, in the hall.
  'boss-bgToll': [['가슴 종 데엥', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2.2, wet: 0.22 });
    modal(a, h, { base: 196 * k, modes: ringFor(BELL, 1.1), peak: 0.5, detune: 0.7, strike: 0.012 });
  })]],
  // His command for the cage (2026-11-22, the user's word: make it a bell; it was air whistling past a falling bell): the
  // bell above F2 tolls as it is let go, a deep bronze strike and a second, lower and softer as it drops away, with a
  // little air under it.
  'boss-bgCage': [['종 가두기 종소리', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2.4, wet: 0.24 });
    modal(a, h, { base: 175 * k, modes: ringFor(BELL, 1.2), peak: 0.5, detune: 0.8, strike: 0.012 });
    modal(a, h, { base: 165 * k, modes: ringFor(BELL, 1), peak: 0.3, detune: 0.8, strike: 0.012, at: 0.42 });
    whoosh(a, h, { from: 900 * k, to: 300 * k, dur: 0.8, q: 1.5, peak: 0.08, at: 0.3 });
  })]],
  // The bell weight sweeping across the room (bgPendulum, 2026-11-21, the user's word: it sounded wrong, it borrowed the
  // cage's fall; make it a bell passing by): the clapper strikes three times as it swings through, swelling as it comes
  // and fading as it goes, a little higher on the way in and lower on the way out, with the air it pushes before it.
  'boss-bgPendSwing': [['종이 울리며 지나감', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2, wet: 0.2 });
    for (const [at, pitch, level] of [[0, 1.025, 0.45], [0.42, 1, 1], [0.84, 0.975, 0.55]]) modal(a, h, { base: 233 * k * pitch, modes: ringFor(BELL, 0.9), peak: 0.42 * level, detune: 0.6, strike: 0.01, at });
    whoosh(a, h, { from: 280 * k, to: 520 * k, dur: 0.5, q: 1.2, peak: 0.16 });
    whoosh(a, h, { from: 520 * k, to: 240 * k, dur: 0.7, q: 1.2, peak: 0.13, at: 0.45 });
  })]],
  // The bell coming down over F2: a booming bronze clang, the floor cracking under it.
  'boss-bgCageLand': [['종 떨어져 덮침', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2.4, wet: 0.26 });
    crack(a, h, { freq: 1700 * k, peak: 0.55, dur: 0.035 });
    body(a, h, { freq: 82 * k, dur: 0.42, peak: 1, drive: 3 });
    modal(a, h, { base: 262 * k, modes: BELL, peak: 0.42, detune: 1.1, strike: 0.01 });
    debris(a, h, { at: 0.02, count: 10, span: 0.45, freq: 1200 * k, peak: 0.16 });
  })]],
  // Calling the minute archers: two small hand bells.
  'boss-bgArchers': [['궁수 호출 종 두 번', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    modal(a, h, { base: 784 * k, modes: ringFor(BELL, 0.7), peak: 0.32, detune: 0.6, strike: 0.004 });
    modal(a, h, { base: 659 * k, modes: ringFor(BELL, 0.75), peak: 0.32, detune: 0.6, at: 0.18, strike: 0.004 });
  })]],
  // Orden's phantom sword rising out of his hands: drawn with a scrape and a long ring, a cyan glint climbing.
  'boss-bgFlySword': [['환영검 날아오름', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2, wet: 0.24 });
    band(a, h, { freq: 1800 * k, to: 3600 * k, q: 3, dur: 0.32, attack: 0.04, peak: 0.22 });
    shing(a, h, { base: 1568 * k, at: 0.28, peak: 0.2, k: 1.2 });
    tone(a, h, { from: 520 * k, to: 1560 * k, dur: 0.45, attack: 0.03, peak: 0.14 });
    whoosh(a, h, { from: 600 * k, to: 2000 * k, dur: 0.4, peak: 0.22, at: 0.1 });
  })]],
  // The rain of small swords: each one hissing down and sticking with a ring, a run of them.
  'boss-bgSwordRain': [['검비 쏟아짐', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    for (let i = 0; i < 7; i++) {
      const at = i * 0.055 + Math.random() * 0.02, f = (1900 + Math.random() * 900) * k;
      whoosh(a, h, { from: f * 0.8, to: f * 1.4, dur: 0.06, q: 2, peak: 0.12, at });
      crack(a, h, { at: at + 0.05, freq: 2800 * k, peak: 0.2, dur: 0.012 });
      shing(a, h, { base: f, at: at + 0.05, peak: 0.05, k: 0.3 });
    }
    whoosh(a, h, { from: 1800 * k, to: 500 * k, dur: 0.45, peak: 0.22 });
  })]],
  // Orden's own voice (2026-11-21, the user's pick from the review: he borrowed Tick·Tock's and Belgard's blows, a
  // pendulum swish for fire, a card shuffle for his cannon): glassy tuning-fork magic, every spell with its element.
  'boss-odRune': [['룬이 피어나는 울림', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.3 });
    fork(a, h, { freq: 1046 * k, dur: 1.1, peak: 0.16 });
    fork(a, h, { freq: 1568 * k, dur: 0.9, peak: 0.11, at: 0.06 });
    band(a, h, { freq: 2400 * k, to: 5200 * k, q: 4, dur: 0.35, attack: 0.05, peak: 0.08 });
    tone(a, h, { from: 260 * k, to: 520 * k, dur: 0.4, attack: 0.04, peak: 0.12 });
  })]],
  'boss-odFire': [['마법 불길이 확 붙음', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.2, wet: 0.16 });
    whoosh(a, h, { from: 300 * k, to: 1400 * k, dur: 0.35, q: 1, peak: 0.5 });
    body(a, h, { at: 0.05, freq: 90 * k, dur: 0.3, peak: 0.45, drive: 2 });
    debris(a, h, { at: 0.08, count: 14, span: 0.6, freq: 2600 * k, peak: 0.09, q: 3 });
    fork(a, h, { freq: 740 * k, dur: 0.5, peak: 0.06, at: 0.02 });
  })]],
  'boss-odZap': [['낙뢰가 내리꽂힘', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.4, wet: 0.2 });
    crack(a, h, { freq: 3600 * k, peak: 0.6, dur: 0.02 });
    crack(a, h, { at: 0.03, freq: 2400 * k, peak: 0.45, dur: 0.03 });
    body(a, h, { at: 0.01, freq: 70 * k, dur: 0.45, peak: 0.7, drive: 3 });
    debris(a, h, { at: 0.02, count: 16, span: 0.3, freq: 4200 * k, peak: 0.12, q: 6 });
    band(a, h, { freq: 1800 * k, to: 600 * k, q: 2, dur: 0.6, attack: 0.01, peak: 0.12, at: 0.04 });
  })]],
  'boss-odIce': [['얼음이 솟으며 갈라짐', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.26 });
    whoosh(a, h, { from: 2400 * k, to: 900 * k, dur: 0.3, q: 3, peak: 0.25 });
    for (let i = 0; i < 5; i++) { const at = 0.04 + i * 0.045; crack(a, h, { at, freq: (3000 + i * 400) * k, peak: 0.28, dur: 0.012 }); modal(a, h, { base: (1900 + i * 260) * k, modes: [[1, 1, 0.5], [2.4, 0.3, 0.25]], peak: 0.07, at, strike: 0.002 }); }
    body(a, h, { at: 0.02, freq: 150 * k, dur: 0.18, peak: 0.35 });
  })]],
  'boss-odBlink': [['순간이동 반짝', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.4, wet: 0.3 });
    tone(a, h, { from: 1600 * k, to: 400 * k, dur: 0.22, attack: 0.005, peak: 0.12 });
    tone(a, h, { from: 500 * k, to: 2000 * k, dur: 0.25, attack: 0.02, peak: 0.1, at: 0.16 });
    band(a, h, { freq: 5000 * k, q: 6, dur: 0.12, peak: 0.08, at: 0.18 });
    fork(a, h, { freq: 1318 * k, dur: 0.5, peak: 0.07, at: 0.2 });
  })]],
  'boss-odStop': [['시간이 멈추는 쿵', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2.6, wet: 0.35 });
    body(a, h, { freq: 55 * k, dur: 0.9, peak: 0.9, drive: 2.5 });
    bronze(a, h, { base: 98 * k, dur: 2, peak: 0.3 });
    tone(a, h, { from: 880 * k, to: 220 * k, dur: 0.6, attack: 0.01, peak: 0.1 });
    tick(a, h, { freq: 2200 * k, at: 0.02, peak: 0.4 });
  })]],
  'boss-odRewind': [['시간이 다시 감김', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.25 });
    ratchet(a, h, { count: 12, gap: 0.035, freq: 2600 * k, peak: 0.22 });
    whoosh(a, h, { from: 200 * k, to: 2400 * k, dur: 0.55, q: 1.5, peak: 0.3 });
    tone(a, h, { from: 220 * k, to: 880 * k, dur: 0.55, attack: 0.05, peak: 0.1 });
  })]],
  'boss-odBeam': [['조율 장치 포격', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2, wet: 0.24 });
    tone(a, h, { from: 300 * k, to: 1200 * k, dur: 0.35, attack: 0.03, peak: 0.14 });
    body(a, h, { at: 0.3, freq: 60 * k, dur: 0.7, peak: 0.95, drive: 3 });
    whoosh(a, h, { from: 3000 * k, to: 600 * k, dur: 0.8, q: 0.8, peak: 0.5, at: 0.3 });
    fork(a, h, { freq: 587 * k, dur: 1.2, peak: 0.1, at: 0.32 });
    debris(a, h, { at: 0.35, count: 14, span: 0.6, freq: 2000 * k, peak: 0.1 });
  })]],
  'boss-odShatter': [['회중시계 유리 깨짐', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.4, wet: 0.22 });
    crack(a, h, { freq: 4200 * k, peak: 0.5, dur: 0.015 });
    for (let i = 0; i < 8; i++) modal(a, h, { base: (2600 + Math.random() * 2200) * k, modes: [[1, 1, 0.35]], peak: 0.06, at: 0.01 + i * 0.03, strike: 0.002 });
    tick(a, h, { freq: 1800 * k, at: 0.05, peak: 0.3 });
  })]],
  // Belgard's sounds added 2026-11-21 (the user's pick from the review): an archer landing out of its rift, the gauntlet
  // closing on F2, one needle sticking, one small sword sticking.
  'boss-bgArcherIn': [['궁수 착지', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1, wet: 0.14 });
    whoosh(a, h, { from: 900 * k, to: 300 * k, dur: 0.12, peak: 0.25 });
    crack(a, h, { at: 0.1, freq: 2200 * k, peak: 0.3, dur: 0.012 });
    body(a, h, { at: 0.1, freq: 170 * k, dur: 0.1, peak: 0.55 });
    modal(a, h, { base: 1046 * k, modes: [[1, 1, 0.4], [2.76, 0.3, 0.2]], peak: 0.08, at: 0.12, strike: 0.003 });
  })]],
  'boss-bgGrabHit': [['건틀릿에 붙잡힘', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.2, wet: 0.14 });
    crack(a, h, { freq: 2400 * k, peak: 0.45, dur: 0.018 });
    modal(a, h, { base: 330 * k, modes: PLATE, peak: 0.3, strike: 0.004 });
    body(a, h, { freq: 120 * k, dur: 0.16, peak: 0.8, drive: 2.4 });
    debris(a, h, { at: 0.03, count: 6, span: 0.12, freq: 3000 * k, peak: 0.1, q: 6 });
  })]],
  'boss-bgNeedleHit': [['바늘 꽂힘', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.4, wet: 0.2 }), f = (2093 + Math.random() * 600) * k;
    whoosh(a, h, { from: 1500 * k, to: 3400 * k, dur: 0.06, q: 2, peak: 0.14 });
    crack(a, h, { at: 0.055, freq: 3200 * k, peak: 0.35, dur: 0.012 });
    modal(a, h, { base: f, modes: [[1, 1, 0.7], [2.76, 0.25, 0.25]], peak: 0.16, at: 0.055, strike: 0.003 });
  })]],
  'boss-bgSwordHit': [['검비 한 자루', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1, wet: 0.16 }), f = (1900 + Math.random() * 900) * k;
    whoosh(a, h, { from: f * 0.8, to: f * 1.4, dur: 0.06, q: 2, peak: 0.14 });
    crack(a, h, { at: 0.05, freq: 2800 * k, peak: 0.26, dur: 0.012 });
    shing(a, h, { base: f, at: 0.05, peak: 0.07, k: 0.35 });
  })]],
  // The tuning needles: four thin steel needles stabbed into the floor one after another, a glassy ring off each.
  'boss-bgNeedles': [['조율 바늘 소환', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.6, wet: 0.2 });
    for (const [i, f] of [[0, 2093], [1, 2349], [2, 2637], [3, 3136]]) {
      const at = i * 0.07;
      whoosh(a, h, { from: 1500 * k, to: 3200 * k, dur: 0.05, q: 2, peak: 0.12, at });
      crack(a, h, { at: at + 0.045, freq: 3200 * k, peak: 0.3, dur: 0.012 });
      modal(a, h, { base: f * k, modes: [[1, 1, 0.55], [2.76, 0.25, 0.2]], peak: 0.12, at: at + 0.045, strike: 0.003 });
    }
  })]],
  // The last toll's sword set into the floor: steel driven into stone and ringing, the deep bell answering.
  'boss-bgLastToll': [['마지막 종소리 준비', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2.4, wet: 0.26 });
    crack(a, h, { freq: 2000 * k, peak: 0.45, dur: 0.03 });
    body(a, h, { freq: 100 * k, dur: 0.25, peak: 0.6 });
    shing(a, h, { base: 523 * k, peak: 0.22, k: 1.6 });
    fork(a, h, { freq: 523 * k, dur: 1.1, peak: 0.1, attack: 0.08 });
    modal(a, h, { base: 131 * k, modes: BELL, peak: 0.3, detune: 0.5, at: 0.3 });
  })]],
  // The resonance: the pillars grinding up out of the floor, each one ringing, a line between two blowing.
  'boss-bgResonance': [['공명 기둥 솟아오름', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
    band(a, h, { type: 'lowpass', freq: 90 * k, to: 320 * k, q: 1.5, dur: 0.5, attack: 0.1, peak: 0.45 });
    debris(a, h, { count: 14, span: 0.45, freq: 900 * k, peak: 0.12, q: 2 });
    body(a, h, { at: 0.42, freq: 120 * k, dur: 0.22, peak: 0.6 });
    fork(a, h, { freq: 880 * k, dur: 0.6, peak: 0.05, at: 0.42 });
  })]],
  // (The resonance's pillar ring and line blast went with the pattern, 2026-11-21.)
  // The forged orders: a real order (Orden's cyan pitch, two notes down), a forged one in tune (gold, bright and
  // pure), a blow off the pitch (a sour clank), his charge (armour on the run), and his bell cracking.
  'boss-bgOrder': [['오르덴의 명령 (청록 두 음)', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
    fork(a, h, { freq: 1175 * k, dur: 0.35, peak: 0.18 });
    fork(a, h, { freq: 880 * k, dur: 0.6, peak: 0.2, at: 0.16 });
    for (const [at, f] of [[0, 1175], [0.16, 880]]) modal(a, h, { base: f * 2.76 * k, modes: [[1, 1, 0.08]], peak: 0.05, at, strike: 0.002 });
  })]],
  'boss-bgForge': [['가짜 명령 성공 (맑은 소리굽쇠)', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 2, wet: 0.22 });
    modal(a, h, { base: 880 * k, modes: [[1, 1, 1.4], [2, 0.3, 0.7], [6.27, 0.06, 0.1]], peak: 0.3, strike: 0.003 });
    fork(a, h, { freq: 1760 * k, dur: 0.6, peak: 0.08, at: 0.02 });
  })]],
  'boss-bgClang': [['음 이탈 (탁한 쇳소리)', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.2, wet: 0.14 });
    const g = grit(a, h, 2.6);
    crack(a, h, { freq: 1500 * k, peak: 0.4, dur: 0.02 });
    modal(a, g, { base: 330 * k, modes: ringFor(PLATE, 1.6), peak: 0.36, detune: 19 * k, strike: 0.006 });
    band(a, h, { freq: 900 * k, q: 1.2, dur: 0.08, peak: 0.25 });
  })]],
  'boss-bgCharge': [['갑옷 돌진 철컥철컥', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.3, wet: 0.14 });
    for (const at of [0, 0.14, 0.28]) {
      body(a, h, { at, freq: 120 * k, dur: 0.12, peak: 0.55 });
      modal(a, h, { base: (480 + Math.random() * 200) * k, modes: PLATE, peak: 0.12, at: at + 0.01, strike: 0.004 });
      debris(a, h, { at, count: 4, span: 0.06, freq: 3200 * k, peak: 0.07, q: 6 });
    }
    whoosh(a, h, { from: 200 * k, to: 600 * k, dur: 0.4, peak: 0.28 });
  })]],
  'boss-bgCrack': [['가슴 종 금 가는 소리', recipe((a, o, k) => {
    const h = hall(a, o, { seconds: 1.8, wet: 0.22 });
    modal(a, h, { base: 196 * k, modes: ringFor(BELL, 0.3), peak: 0.24, detune: 4, strike: 0.006 });
    debris(a, h, { at: 0.02, count: 22, span: 0.4, freq: 2600 * k, peak: 0.3, q: 1.6 });
    tone(a, h, { from: 207 * k, to: 186 * k, dur: 0.5, peak: 0.08, at: 0.05 });
  })]]
};
