// Recorded sound effects (Kenney, CC0) played through Web Audio.
// Each name is one recording at one pitch, so the same action always sounds the same.
import { assetUrl } from '../animation/sprite-library.js';
// Loaded with the same query as this file, so a page that busts the cache for this module gets fresh recipes too.
const { ELEMENT_SOUNDS } = await import(`./elements.js${new URL(import.meta.url).search}`);

/** file and takes name art/audio/sfx/<file>-<take>.ogg; rate is a random range; length (seconds) cuts long recordings with a short fade. */
export const SFX = {
  swing: { file: 'swing', takes: 1, volume: 0.22, rate: [1.06, 1.06] },
  swingHeavy: { file: 'swing', takes: 1, volume: 0.3, rate: [0.8, 0.8] },
  dodge: { synth: 'dash', volume: 0.5 },
  hit: { file: 'hit', takes: 1, volume: 0.5, rate: [1.02, 1.02] },
  heavy: { file: 'heavy', takes: 1, volume: 0.6, rate: [0.9, 0.9] },
  hurt: { file: 'hurt', takes: 1, volume: 0.5, rate: [1, 1] },
  kill: { file: 'kill', takes: 1, volume: 0.45, rate: [1.02, 1.02] },
  tell: { file: 'tell', takes: 1, volume: 0.16, rate: [1, 1] },
  block: { file: 'block', takes: 1, volume: 0.45, rate: [1.07, 1.07] },
  burst: { file: 'burst', takes: 1, volume: 0.55, rate: [0.9, 0.9] },
  pop: { file: 'pop', takes: 1, volume: 0.4, rate: [1, 1] },
  summon: { file: 'summon', takes: 1, volume: 0.4, rate: [0.9, 0.9] },
  clear: { file: 'clear', takes: 1, volume: 0.35, rate: [1, 1] },
  // Player
  down: { file: 'down', takes: 1, volume: 0.5, rate: [0.8, 0.8] },
  charged: { file: 'charged', takes: 1, volume: 0.35, rate: [1, 1] },
  mend: { file: 'mend', takes: 1, volume: 0.3, rate: [1, 1] },
  // Element skills, by skill id. Fire, lightning and wind are synthesized (src/audio/elements.js); ice keeps the glass recordings.
  heatSwing: { synth: 'heatSwing', volume: 0.85 },
  exhaustBurst: { synth: 'exhaustBurst', volume: 0.4 },
  frostBolt: { file: 'frostBolt', takes: 1, volume: 0.35, rate: [1.32, 1.32] },
  coolingField: { file: 'coolingField', takes: 1, volume: 0.4, rate: [0.78, 0.78] },
  conductiveSpanner: { synth: 'conductiveSpanner', volume: 0.35 },
  capacitorStrike: { synth: 'capacitorStrike', volume: 0.4 },
  pressureDash: { synth: 'pressureDash', volume: 1.1 },
  vortexIntake: { synth: 'vortexIntake', volume: 1.4 },
  // Fusions, by fusion id
  steamShatter: { synth: 'steamShatter', volume: 0.35 },
  arcFurnace: { synth: 'arcFurnace', volume: 0.35 },
  fireCyclone: { synth: 'fireCyclone', volume: 0.85 },
  magneticIceClamp: { synth: 'magneticIceClamp', volume: 0.35 },
  frostCrosscut: { synth: 'frostCrosscut', volume: 0.6 },
  stormFloat: { synth: 'stormFloat', volume: 1.0 },
  // Ordinary enemies' attacks, by enemy type
  guard: { file: 'swing', takes: 1, volume: 0.12, rate: [0.9, 0.9] },
  nutcracker: { file: 'swing', takes: 1, volume: 0.16, rate: [0.72, 0.72] },
  elite: { file: 'elite', takes: 1, volume: 0.45, rate: [1, 1] },
  rabbit: { file: 'rabbit', takes: 1, volume: 0.45, rate: [1, 1] },
  trumpet: { file: 'trumpet', takes: 1, volume: 0.22, rate: [1, 1] },
  musicbox: { file: 'musicbox', takes: 1, volume: 0.3, rate: [1, 1] },
  spintop: { file: 'spintop', takes: 1, volume: 0.4, rate: [0.85, 0.85] },
  drummer: { file: 'drummer', takes: 1, volume: 0.45, rate: [0.8, 0.8] },
  pikeman: { file: 'swing', takes: 1, volume: 0.18, rate: [1.45, 1.45] },
  // Progress and rewards
  portal: { synth: 'portal', volume: 0.6 },
  cards: { file: 'cards', takes: 1, volume: 0.4, rate: [1, 1] },
  pick: { file: 'pick', takes: 1, volume: 0.4, rate: [1.02, 1.02] },
  loot: { file: 'loot', takes: 1, volume: 0.45, rate: [1, 1] },
  fail: { synth: 'sadHorn', volume: 0.25 },
  // Bosses' attacks, by pattern (boss-<pattern>)
  'boss-claw': { file: 'boss-claw', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-magnet': { file: 'boss-magnet', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-suction': { file: 'boss-suction', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-overcharge': { file: 'boss-overcharge', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-stickers': { file: 'boss-stickers', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-crane': { file: 'boss-crane', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-fan': { file: 'boss-fan', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-march': { file: 'boss-march', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-stomp': { file: 'boss-stomp', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-trumpetWave': { file: 'boss-trumpetWave', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-charge': { file: 'boss-charge', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-column': { file: 'boss-column', takes: 1, volume: 0.45, rate: [1, 1] },
  'boss-carpet': { file: 'boss-carpet', takes: 1, volume: 0.45, rate: [1, 1] },
  // The town's inspection bell, and a boss's alarm
  bell: { synth: 'bell', volume: 1 },
  alarm: { file: 'alarm', takes: 1, volume: 0.35, rate: [1.3, 1.3], length: 0.5 },
  // Interface
  click: { file: 'click', takes: 1, volume: 0.2, rate: [1.02, 1.02] },
  buy: { file: 'buy', takes: 1, volume: 0.35, rate: [1.02, 1.02] },
  deny: { file: 'deny', takes: 1, volume: 0.2, rate: [1, 1] },
  tune: { file: 'tune', takes: 1, volume: 0.4, rate: [1, 1] },
  equip: { file: 'equip', takes: 1, volume: 0.3, rate: [1.02, 1.02] }
};

export class SoundBank {
  constructor() { this.buffers = new Map(); this.loading = null; }
  /** Fetches and decodes every take once, after the first user gesture has opened the audio context. */
  /** Downloads every recording while the game is still loading; no tap is needed to fetch, only to decode. */
  prefetch() {
    this.bytes ??= new Map([...new Set(Object.values(SFX).filter(sound => sound.file).flatMap(({ file, takes }) => Array.from({ length: takes }, (_, i) => `${file}-${i}`)))].map(key =>
      [key, fetch(assetUrl(`/art/audio/sfx/${key}.ogg`)).then(response => (response.ok ? response.arrayBuffer() : null)).catch(() => null)]));
    return this.bytes;
  }
  load(audio) {
    this.loading ??= Promise.all([...this.prefetch()].map(async ([key, bytes]) => {
      const data = await bytes;
      if (data) this.buffers.set(key, await audio.decodeAudioData(data));
    })).catch(error => console.warn(error));
    return this.loading;
  }
  /** Plays a named effect; returns false while its takes are not decoded yet, so the caller can fall back. */
  play(audio, name, gainScale = 1) {
    const sound = SFX[name];
    if (sound?.synth) { const out = audio.createGain(); out.gain.value = sound.volume * gainScale; out.connect(audio.destination); ELEMENT_SOUNDS[sound.synth](audio, out); return true; }
    const buffer = sound && this.buffers.get(`${sound.file}-${Math.floor(Math.random() * sound.takes)}`);
    if (!buffer) return false;
    const source = audio.createBufferSource(), gain = audio.createGain(), [low, high] = sound.rate;
    source.buffer = buffer; source.playbackRate.value = low + Math.random() * (high - low); gain.gain.value = sound.volume * gainScale;
    source.connect(gain).connect(audio.destination); source.start();
    if (sound.length) { const end = audio.currentTime + sound.length; gain.gain.setValueAtTime(gain.gain.value, end - 0.06); gain.gain.linearRampToValueAtTime(0, end); source.stop(end); }
    return true;
  }
}
