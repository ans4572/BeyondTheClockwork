// Recorded sound effects (Kenney, CC0) played through Web Audio.
// Each name has a few takes; one is picked at random and nudged in pitch so repeats do not sound stamped out.
import { assetUrl } from '../animation/sprite-library.js';

/** file and takes name art/audio/sfx/<file>-<take>.ogg; rate is a random range; length (seconds) cuts long recordings with a short fade. */
export const SFX = {
  swing: { file: 'swing', takes: 1, volume: 0.22, rate: [1, 1.12] },
  swingHeavy: { file: 'swing', takes: 1, volume: 0.3, rate: [0.76, 0.84] },
  dodge: { file: 'swing', takes: 1, volume: 0.22, rate: [0.5, 0.58] },
  hit: { file: 'hit', takes: 5, volume: 0.45, rate: [0.95, 1.1] },
  heavy: { file: 'heavy', takes: 5, volume: 0.55, rate: [0.9, 1] },
  crit: { file: 'crit', takes: 5, volume: 0.3, rate: [1.15, 1.3] },
  hurt: { file: 'hurt', takes: 5, volume: 0.55, rate: [0.9, 1] },
  kill: { file: 'kill', takes: 5, volume: 0.45, rate: [0.95, 1.1] },
  tell: { file: 'tell', takes: 6, volume: 0.16, rate: [1, 1] },
  block: { file: 'block', takes: 5, volume: 0.45, rate: [1, 1.15] },
  burst: { file: 'burst', takes: 5, volume: 0.4, rate: [0.95, 1.05] },
  pop: { file: 'pop', takes: 5, volume: 0.3, rate: [1, 1.1] },
  summon: { file: 'summon', takes: 5, volume: 0.24, rate: [1, 1.1] },
  clear: { file: 'clear', takes: 1, volume: 0.32, rate: [1, 1] },
  // Player
  down: { file: 'down', takes: 1, volume: 0.35, rate: [1, 1] },
  charged: { file: 'charged', takes: 1, volume: 0.22, rate: [1.1, 1.1] },
  mend: { file: 'mend', takes: 1, volume: 0.22, rate: [1, 1.05] },
  // Element skills, by skill id
  heatSwing: { file: 'heatSwing', takes: 1, volume: 0.3, rate: [1.1, 1.2], length: 0.4 },
  exhaustBurst: { file: 'exhaustBurst', takes: 1, volume: 0.45, rate: [1, 1.05] },
  frostBolt: { file: 'frostBolt', takes: 2, volume: 0.35, rate: [1.25, 1.4] },
  coolingField: { file: 'coolingField', takes: 1, volume: 0.4, rate: [0.75, 0.8] },
  conductiveSpanner: { file: 'conductiveSpanner', takes: 1, volume: 0.25, rate: [1.2, 1.3], length: 0.4 },
  capacitorStrike: { file: 'capacitorStrike', takes: 1, volume: 0.35, rate: [0.85, 0.9] },
  pressureDash: { file: 'pressureDash', takes: 1, volume: 0.3, rate: [1, 1.1] },
  vortexIntake: { file: 'vortexIntake', takes: 1, volume: 0.5, rate: [0.8, 0.85] },
  // Fusions, by fusion id
  steamShatter: { file: 'steamShatter', takes: 1, volume: 0.45, rate: [1, 1], length: 1.1 },
  arcFurnace: { file: 'arcFurnace', takes: 1, volume: 0.4, rate: [0.7, 0.72] },
  fireCyclone: { file: 'fireCyclone', takes: 1, volume: 0.35, rate: [0.8, 0.82], length: 0.8 },
  magneticIceClamp: { file: 'magneticIceClamp', takes: 1, volume: 0.3, rate: [1, 1], length: 0.9 },
  frostCrosscut: { file: 'frostCrosscut', takes: 1, volume: 0.45, rate: [0.6, 0.62] },
  stormFloat: { file: 'stormFloat', takes: 1, volume: 0.28, rate: [1, 1], length: 0.9 },
  // Statuses
  burn: { file: 'burn', takes: 1, volume: 0.14, rate: [1.4, 1.6], length: 0.22 },
  freeze: { file: 'freeze', takes: 1, volume: 0.35, rate: [1.15, 1.25] },
  shock: { file: 'shock', takes: 1, volume: 0.18, rate: [1.5, 1.7], length: 0.25 },
  wind: { file: 'wind', takes: 1, volume: 0.3, rate: [1.15, 1.3] },
  // Ordinary enemies' attacks, by enemy type
  guard: { file: 'swing', takes: 1, volume: 0.12, rate: [0.85, 0.95] },
  nutcracker: { file: 'swing', takes: 1, volume: 0.16, rate: [0.7, 0.75] },
  elite: { file: 'elite', takes: 3, volume: 0.35, rate: [0.9, 1] },
  rabbit: { file: 'rabbit', takes: 1, volume: 0.25, rate: [1, 1.15] },
  trumpet: { file: 'trumpet', takes: 5, volume: 0.16, rate: [0.75, 0.85] },
  musicbox: { file: 'musicbox', takes: 2, volume: 0.22, rate: [0.8, 1.6] },
  spintop: { file: 'spintop', takes: 1, volume: 0.16, rate: [1.2, 1.3], length: 1.4 },
  drummer: { file: 'drummer', takes: 5, volume: 0.45, rate: [0.75, 0.85] },
  pikeman: { file: 'swing', takes: 1, volume: 0.18, rate: [1.4, 1.5] },
  // Progress and rewards
  portal: { file: 'portal', takes: 1, volume: 0.22, rate: [1, 1], length: 0.8 },
  cards: { file: 'cards', takes: 2, volume: 0.35, rate: [1, 1.05] },
  cardsSpecial: { file: 'cardsSpecial', takes: 1, volume: 0.22, rate: [1, 1], length: 0.9 },
  pick: { file: 'pick', takes: 4, volume: 0.4, rate: [1, 1.05] },
  loot: { file: 'loot', takes: 6, volume: 0.35, rate: [1, 1.1] },
  fail: { file: 'fail', takes: 1, volume: 0.3, rate: [1, 1] },
  fanfare: { file: 'fanfare', takes: 1, volume: 0.3, rate: [1, 1] },
  // Interface
  click: { file: 'click', takes: 5, volume: 0.2, rate: [1, 1.05] },
  buy: { file: 'buy', takes: 3, volume: 0.35, rate: [1, 1.05] },
  deny: { file: 'deny', takes: 3, volume: 0.2, rate: [1, 1] },
  tune: { file: 'tune', takes: 1, volume: 0.22, rate: [1, 1] },
  equip: { file: 'equip', takes: 2, volume: 0.3, rate: [1, 1.05] }
};

export class SoundBank {
  constructor() { this.buffers = new Map(); this.loading = null; }
  /** Fetches and decodes every take once, after the first user gesture has opened the audio context. */
  load(audio) {
    this.loading ??= Promise.all([...new Set(Object.values(SFX).flatMap(({ file, takes }) => Array.from({ length: takes }, (_, i) => `${file}-${i}`)))].map(async key => {
      const response = await fetch(assetUrl(`/art/audio/sfx/${key}.ogg`));
      if (response.ok) this.buffers.set(key, await audio.decodeAudioData(await response.arrayBuffer()));
    })).catch(error => console.warn(error));
    return this.loading;
  }
  /** Plays a named effect; returns false while its takes are not decoded yet, so the caller can fall back. */
  play(audio, name, gainScale = 1) {
    const sound = SFX[name], buffer = sound && this.buffers.get(`${sound.file}-${Math.floor(Math.random() * sound.takes)}`);
    if (!buffer) return false;
    const source = audio.createBufferSource(), gain = audio.createGain(), [low, high] = sound.rate;
    source.buffer = buffer; source.playbackRate.value = low + Math.random() * (high - low); gain.gain.value = sound.volume * gainScale;
    source.connect(gain).connect(audio.destination); source.start();
    if (sound.length) { const end = audio.currentTime + sound.length; gain.gain.setValueAtTime(gain.gain.value, end - 0.06); gain.gain.linearRampToValueAtTime(0, end); source.stop(end); }
    return true;
  }
}
