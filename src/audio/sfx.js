// Recorded sound effects (Kenney, CC0) played through Web Audio.
// Each name has a few takes; one is picked at random and nudged in pitch so repeats do not sound stamped out.
import { assetUrl } from '../animation/sprite-library.js';

/** name: [takes, volume, lowest rate, highest rate]. Files are art/audio/sfx/<file>-<take>.ogg. */
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
  clear: { file: 'clear', takes: 1, volume: 0.32, rate: [1, 1] }
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
    return true;
  }
}
