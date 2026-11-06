// Sound effects played through Web Audio: recordings (Kenney, CC0) and sounds built in code.
// Each name is one recording at one pitch, so the same action always sounds the same.
import { assetUrl } from '../animation/sprite-library.js';
// Loaded with the same query as this file, so a page that busts the cache for this module gets fresh recipes too.
const { ELEMENT_SOUNDS } = await import(`./elements.js${new URL(import.meta.url).search}`);
const { CODED_SOUNDS } = await import(`./coded.js${new URL(import.meta.url).search}`);

/**
 * file and takes name art/audio/sfx/<file>-<take>.ogg; rate is a random range; length (seconds) cuts long recordings with a short fade.
 * synth names a recipe in elements.js; code names a picked candidate in coded.js as [sound, candidate index].
 */
export const SFX = {
  swing: { code: ['swing', 0], volume: 0.72 },
  swingHeavy: { code: ['swingHeavy', 0], volume: 0.94 },
  dodge: { code: ['dodge', 1], volume: 0.82 },
  hit: { code: ['hit', 2], volume: 0.65 },
  heavy: { code: ['heavy', 2], volume: 0.4 },
  hurt: { code: ['hurt', 1], volume: 0.4 },
  kill: { code: ['kill', 0], volume: 0.44 },
  tell: { code: ['tell', 1], volume: 2.25 },
  block: { code: ['block', 1], volume: 0.45 },
  burst: { code: ['burst', 0], volume: 0.42 },
  pop: { code: ['pop', 0], volume: 0.09 },
  summon: { code: ['summon', 1], volume: 0.24 },
  clear: { code: ['clear', 0], volume: 0.63 },
  // Player
  down: { code: ['down', 0], volume: 0.36 },
  charged: { code: ['charged', 0], volume: 0.42 },
  mend: { code: ['mend', 1], volume: 0.6 },
  // Element skills, by skill id. Fire, lightning and wind are synthesized (src/audio/elements.js); ice is coded (src/audio/coded.js).
  heatSwing: { synth: 'heatSwing', volume: 0.85 },
  exhaustBurst: { synth: 'exhaustBurst', volume: 0.4 },
  frostBolt: { code: ['frostBolt', 2], volume: 0.4 },
  coolingField: { code: ['coolingField', 0], volume: 0.73 },
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
  guard: { code: ['guard', 1], volume: 0.5 },
  nutcracker: { code: ['nutcracker', 0], volume: 0.7 },
  elite: { code: ['elite', 1], volume: 0.32 },
  rabbit: { code: ['rabbit', 1], volume: 0.3 },
  trumpet: { code: ['trumpet', 0], volume: 0.19 },
  musicbox: { code: ['musicbox', 1], volume: 0.28 },
  spintop: { code: ['spintop', 0], volume: 0.72 },
  drummer: { code: ['drummer', 0], volume: 0.54 },
  pikeman: { code: ['pikeman', 0], volume: 0.68 },
  // Progress and rewards
  portal: { synth: 'portal', volume: 0.6 },
  cards: { code: ['cards', 0], volume: 1.19 },
  pick: { code: ['pick', 0], volume: 0.62 },
  // The title's disposal stamp (coded.js stamp; candidate chosen on sounds.html).
  stamp: { code: ['stamp', 0], volume: 0.45 },
  loot: { code: ['loot', 1], volume: 0.43 },
  fail: { synth: 'sadHorn', volume: 0.25 },
  // Bosses' attacks, by pattern (boss-<pattern>)
  'boss-claw': { code: ['boss-claw', 1], volume: 0.21 },
  'boss-magnet': { code: ['boss-magnet', 0], volume: 0.34 },
  'boss-suction': { code: ['boss-suction', 1], volume: 0.14 },
  'boss-overcharge': { code: ['boss-overcharge', 0], volume: 0.28 },
  'boss-stickers': { code: ['boss-stickers', 1], volume: 0.54 },
  'boss-crane': { code: ['boss-crane', 0], volume: 0.32 },
  'boss-fan': { code: ['boss-fan', 0], volume: 0.08 },
  'boss-march': { code: ['boss-march', 0], volume: 0.48 },
  'boss-stomp': { code: ['boss-stomp', 0], volume: 0.39 },
  'boss-trumpetWave': { code: ['boss-trumpetWave', 1], volume: 0.33 },
  'boss-charge': { code: ['boss-charge', 0], volume: 0.42 },
  'boss-column': { code: ['boss-column', 0], volume: 0.47 },
  'boss-carpet': { code: ['boss-carpet', 0], volume: 0.19 },
  // The town's inspection bell, and a boss's alarm
  bell: { synth: 'bell', volume: 1 },
  alarm: { code: ['alarm', 0], volume: 0.7 },
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
    if (sound?.synth || sound?.code) {
      const out = audio.createGain(); out.gain.value = sound.volume * gainScale; out.connect(audio.destination);
      if (sound.synth) ELEMENT_SOUNDS[sound.synth](audio, out); else CODED_SOUNDS[sound.code[0]][sound.code[1]][1](audio, out);
      return true;
    }
    const buffer = sound && this.buffers.get(`${sound.file}-${Math.floor(Math.random() * sound.takes)}`);
    if (!buffer) return false;
    const source = audio.createBufferSource(), gain = audio.createGain(), [low, high] = sound.rate;
    source.buffer = buffer; source.playbackRate.value = low + Math.random() * (high - low); gain.gain.value = sound.volume * gainScale;
    source.connect(gain).connect(audio.destination); source.start();
    if (sound.length) { const end = audio.currentTime + sound.length; gain.gain.setValueAtTime(gain.gain.value, end - 0.06); gain.gain.linearRampToValueAtTime(0, end); source.stop(end); }
    return true;
  }
}
