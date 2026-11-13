// Sound effects played through Web Audio: recordings (Kenney, CC0) and sounds built in code.
// Recordings keep their fixed pitch; frequently repeated synthesized actions vary slightly.
import { voiceContext } from './synthesis.js';
// Loaded with the same query as this file, so a page that busts the cache for this module gets fresh recipes too.
// All six at once (2026-11-12: one after another they held the title up by six round trips, about 2.6 s on a phone).
const QUERY = new URL(import.meta.url).search;
const [{ ELEMENT_SOUNDS }, { CODED_SOUNDS }, { WATER_SOUND_CANDIDATES }, { BOSS2_CANDIDATES }, { MOB2_CANDIDATES }, { REDO_CANDIDATES }] = await Promise.all(
  ['elements', 'coded', 'water-sound', 'boss2-sound', 'mob2-sound', 'redo-sound'].map(name => import(`./${name}.js${QUERY}`)));
/**
 * Every coded recipe: the player's, the world's, ice, the water and sound elements' (water-sound.js), chapter 2's bosses and
 * mobs, and the remade takes (redo-sound.js) under `redo:<sound>` so they never mix with the older candidates of that name.
 */
const CODED = { ...CODED_SOUNDS, ...WATER_SOUND_CANDIDATES, ...BOSS2_CANDIDATES, ...MOB2_CANDIDATES, ...Object.fromEntries(Object.entries(REDO_CANDIDATES).map(([name, takes]) => [`redo:${name}`, takes])) };

/**
 * file and takes name art/audio/sfx/<file>-<take>.ogg; rate is a random range; length (seconds) cuts long recordings with a short fade.
 * synth names a recipe in elements.js; code names a picked candidate in coded.js as [sound, candidate index].
 */
/** Chapter 2 boss sound volumes, measured to sit with chapter 1's boss sounds (filled in below). */
const VOL = { 'boss-irisLaser': 0.68831, 'boss-stampLand': 0.77992, 'boss-verdict': 0.34782, 'boss-tapeMeasure': 2.80783, 'boss-decoysAppear': 1.9873, 'boss-crossLaser': 0.7041, 'boss-gridBlow': 0.33249, 'boss-mirrorTurn': 2.53043, 'boss-mirrorLit': 0.63285, 'boss-plateDrop': 0.34283, 'boss-armSlam': 0.29117, 'boss-lineShift': 0.68925, 'boss-callGuards': 0.70859, 'boss-craneDrop': 0.42992, 'boss-twoRows': 0.42931, 'boss-wallSqueeze': 0.35822, 'boss-rhythmBeat': 0.5475, 'boss-twinSlam': 1.28921, 'boss-steamBurst': 0.51394, 'boss-finalAlarm': 0.56197, 'boss-finalPress': 0.56656, 'boss-moldOk': 0.53374, 'boss-moldNo': 0.61437 };
/**
 * Chapter 2 mob volumes: the loudest 50 ms of each matched to the middle of chapter 1's mob sounds (-29.5 dB), the three
 * heavy bodies' blows (stamp, charges) a little louder, like chapter 1's elite and drummer.
 */
const MOB2_VOL = { clampCarrier: 0.2306, stampInspector: 0.30213, pressGuard: 0.22477, pressCaptain: 0.24773, lensInspector: 0.32445, riveter: 0.17077, tapePacker: 0.54601, oiler: 0.29377, partsSupplier: 0.30467 };
export const SFX = {
  swing: { code: ['swing', 0], volume: 0.79666 },
  swingHeavy: { code: ['swingHeavy', 0], volume: 0.79626 },
  dodge: { code: ['redo:dodge', 0], volume: 0.99051 },
  hit: { code: ['hit', 2], volume: 2.5222 },
  heavy: { code: ['heavy', 2], volume: 1.14113 },
  hurt: { code: ['hurt', 1], volume: 0.96273 },
  kill: { code: ['kill', 0], volume: 0.97666 },
  tell: { code: ['redo:tell', 0], volume: 0.3949 },
  block: { code: ['redo:block', 0], volume: 0.46447 },
  burst: { code: ['burst', 0], volume: 1.22764 },
  pop: { code: ['pop', 0], volume: 0.23603 },
  summon: { code: ['redo:summon', 1], volume: 0.16955 },
  clear: { code: ['clear', 0], volume: 0.63 },
  // Player
  down: { code: ['down', 0], volume: 0.48769 },
  charged: { code: ['charged', 0], volume: 0.36748 },
  mend: { code: ['mend', 1], volume: 0.45014 },
  // Element skills, by skill id. Fire, lightning and wind are synthesized (src/audio/elements.js); ice is coded (src/audio/coded.js).
  heatSwing: { synth: 'heatSwing', volume: 0.86738 },
  exhaustBurst: { synth: 'exhaustBurst', volume: 1.03549 },
  frostBolt: { code: ['frostBolt', 2], volume: 0.90969 },
  coolingField: { code: ['coolingField', 0], volume: 0.73891 },
  conductiveSpanner: { synth: 'conductiveSpanner', volume: 0.21975 },
  capacitorStrike: { synth: 'capacitorStrike', volume: 1.16918 },
  pressureDash: { synth: 'pressureDash', volume: 1.12249 },
  vortexIntake: { synth: 'vortexIntake', volume: 1.20528 },
  // Sound and water (src/audio/water-sound.js, picked 2026-11-09 on a candidate page now archived). 굉음 plays its gathering hum
  // when pressed and roarRelease when let go; resonanceBurst when a ringing body collapses; splash for water thrown about;
  // surfaceResonanceHit each time 수면 공명's film rings. Volumes match the fire, ice, lightning and wind skills.
  ringPalm: { code: ['ringPalm', 0], volume: 0.92098 },
  roar: { code: ['roarCharge', 0], volume: 0.31105 },
  roarRelease: { code: ['roar', 0], volume: 0.46433 },
  resonanceBurst: { code: ['resonanceBurst', 0], volume: 1.49163 },
  waterCannon: { code: ['waterCannon', 0], volume: 4.0418 },
  hydroJet: { code: ['redo:hydroJet', 1], volume: 0.63776 },
  splash: { code: ['splash', 1], volume: 0.37209 },
  overheatResonance: { code: ['overheatResonance', 0], volume: 0.53789 },
  steamVeil: { code: ['steamVeil', 0], volume: 2.86976 },
  highNoteShatter: { code: ['highNoteShatter', 1], volume: 0.84169 },
  iceSheet: { code: ['iceSheet', 1], volume: 1.88761 },
  resonantBolt: { code: ['resonantBolt', 0], volume: 0.89546 },
  shockPool: { code: ['shockPool', 0], volume: 4.98713 },
  echoGust: { code: ['echoGust', 0], volume: 4.1957 },
  waterspout: { code: ['waterspout', 1], volume: 0.25924 },
  surfaceResonance: { code: ['surfaceResonance', 0], volume: 0.37953 },
  surfaceResonanceHit: { code: ['surfaceResonanceHit', 0], volume: 0.92277 },
  // Fusions, by fusion id
  steamShatter: { synth: 'steamShatter', volume: 0.95115 },
  arcFurnace: { synth: 'arcFurnace', volume: 0.38727 },
  fireCyclone: { synth: 'fireCyclone', volume: 0.7682 },
  magneticIceClamp: { synth: 'magneticIceClamp', volume: 0.2091 },
  frostCrosscut: { synth: 'frostCrosscut', volume: 1.60434 },
  stormFloat: { synth: 'stormFloat', volume: 0.77492 },
  // Ordinary enemies' attacks, by enemy type
  guard: { code: ['guard', 1], volume: 0.54877 },
  nutcracker: { code: ['nutcracker', 0], volume: 0.57407 },
  elite: { code: ['elite', 1], volume: 0.6342 },
  rabbit: { code: ['redo:rabbit', 1], volume: 0.23037 },
  trumpet: { code: ['trumpet', 0], volume: 0.31511 },
  musicbox: { code: ['musicbox', 1], volume: 0.52012 },
  spintop: { code: ['spintop', 0], volume: 0.56248 },
  drummer: { code: ['drummer', 0], volume: 1.10542 },
  pikeman: { code: ['pikeman', 0], volume: 0.92118 },
  // Chapter 2's (src/audio/mob2-sound.js, 2026-11-09), measured to sit with chapter 1's.
  clampCarrier: { code: ['redo:clampCarrier', 1], volume: 0.12012 },
  stampInspector: { code: ['stampInspector', 0], volume: MOB2_VOL.stampInspector },
  pressGuard: { code: ['redo:pressGuard', 1], volume: 0.13062 },
  pressCaptain: { code: ['redo:pressCaptain', 1], volume: 0.09973 },
  lensInspector: { code: ['redo:lensInspector', 0], volume: 0.08406 },
  riveter: { code: ['riveter', 0], volume: MOB2_VOL.riveter },
  tapePacker: { code: ['redo:tapePacker', 0], volume: 0.26345 },
  oiler: { code: ['redo:oiler', 2], volume: 0.0895 },
  partsSupplier: { code: ['partsSupplier', 0], volume: MOB2_VOL.partsSupplier },
  // Progress and rewards
  portal: { synth: 'portal', volume: 0.50416 },
  cards: { code: ['cards', 0], volume: 1.19 },
  pick: { code: ['pick', 0], volume: 0.62 },
  // The title's disposal stamp (coded.js stamp; candidate chosen on sounds.html).
  stamp: { code: ['stamp', 0], volume: 1.15554 },
  loot: { code: ['loot', 1], volume: 0.43 },
  fail: { synth: 'sadHorn', volume: 0.25 },
  // Bosses' attacks, by pattern (boss-<pattern>)
  'boss-claw': { code: ['boss-claw', 1], volume: 0.17933 },
  'boss-magnet': { code: ['boss-magnet', 0], volume: 0.61643 },
  'boss-suction': { code: ['boss-suction', 1], volume: 0.71458 },
  'boss-overcharge': { code: ['boss-overcharge', 0], volume: 0.19372 },
  'boss-stickers': { code: ['boss-stickers', 1], volume: 0.50819 },
  'boss-crane': { code: ['boss-crane', 0], volume: 0.26032 },
  'boss-fan': { code: ['boss-fan', 0], volume: 1.22724 },
  'boss-march': { code: ['boss-march', 0], volume: 0.65025 },
  'boss-stomp': { code: ['boss-stomp', 0], volume: 1.31877 },
  'boss-trumpetWave': { code: ['boss-trumpetWave', 1], volume: 0.39274 },
  'boss-charge': { code: ['boss-charge', 0], volume: 0.5736 },
  'boss-column': { code: ['boss-column', 0], volume: 0.37016 },
  'boss-carpet': { code: ['boss-carpet', 0], volume: 0.50742 },
  // Chapter 2's bosses (src/audio/boss2-sound.js, picked 2026-11-09 on a candidate page now archived). Some play when a pattern
  // goes off (boss-<pattern>), others at the moment inside it that lands: each stamp, each beat, the claw's drop, each
  // piston slam, the rings blowing, a mirror turned or lit, a mould judged, the final press's last second.
  'boss-irisLaser': { code: ['boss-irisLaser', 0], volume: VOL['boss-irisLaser'] },
  'boss-decoys': { code: ['boss-irisLaser', 0], volume: VOL['boss-irisLaser'] },
  'boss-stampLand': { code: ['boss-rejectStamps', 0], volume: VOL['boss-stampLand'] },
  'boss-verdict': { code: ['boss-verdict', 0], volume: VOL['boss-verdict'] },
  'boss-tapeMeasure': { code: ['boss-tapeMeasure', 0], volume: VOL['boss-tapeMeasure'] },
  'boss-decoysAppear': { code: ['redo:boss-decoysAppear', 1], volume: 0.69595 },
  'boss-crossLaser': { code: ['boss-crossLaser', 1], volume: VOL['boss-crossLaser'] },
  'boss-gridBlow': { code: ['boss-gridCheck', 0], volume: VOL['boss-gridBlow'] },
  'boss-mirrorTurn': { code: ['redo:boss-mirrorTurn', 1], volume: 0.24961 },
  'boss-mirrorLit': { code: ['boss-mirrorLit', 0], volume: VOL['boss-mirrorLit'] },
  'boss-plateDrop': { code: ['boss-plateDrop', 0], volume: VOL['boss-plateDrop'] },
  'boss-armSlam': { code: ['boss-armSlam', 0], volume: VOL['boss-armSlam'] },
  'boss-lineShift': { code: ['redo:boss-lineShift', 0], volume: 0.34506 },
  'boss-callGuards': { code: ['boss-callGuards', 1], volume: VOL['boss-callGuards'] },
  'boss-craneDrop': { code: ['boss-craneGrab', 0], volume: VOL['boss-craneDrop'] },
  'boss-twoRows': { code: ['boss-twoRows', 0], volume: VOL['boss-twoRows'] },
  'boss-wallSqueeze': { code: ['boss-wallSqueeze', 0], volume: VOL['boss-wallSqueeze'] },
  'boss-rhythmBeat': { code: ['boss-rhythmPress', 0], volume: VOL['boss-rhythmBeat'] },
  'boss-twinSlam': { code: ['boss-twinPistons', 0], volume: VOL['boss-twinSlam'] },
  'boss-steamBurst': { code: ['redo:boss-steamBurst', 1], volume: 1.42295 },
  'boss-finalAlarm': { code: ['boss-finalAlarm', 0], volume: VOL['boss-finalAlarm'] },
  'boss-finalPress': { code: ['boss-finalSlam', 0], volume: VOL['boss-finalPress'] },
  'boss-moldOk': { code: ['boss-moldOk', 0], volume: VOL['boss-moldOk'] },
  'boss-moldNo': { code: ['redo:boss-moldNo', 0], volume: 0.26109 },
  // The town's inspection bell, and a boss's alarm
  bell: { synth: 'bell', volume: 1.74109 },
  alarm: { code: ['alarm', 0], volume: 0.59779 },
  // Interface
  click: { file: 'click', takes: 1, volume: 0.2, rate: [1.02, 1.02] },
  buy: { file: 'buy', takes: 1, volume: 0.35, rate: [1.02, 1.02] },
  deny: { file: 'deny', takes: 1, volume: 0.2, rate: [1, 1] },
  tune: { file: 'tune', takes: 1, volume: 0.4, rate: [1, 1] },
  equip: { file: 'equip', takes: 1, volume: 0.3, rate: [1.02, 1.02] }
};

// A few recipes need local peak rounding before they join the shared dynamics bus.
const SOFT_BODY = {
  'alarm': 0.270257, 'bell': 0.034194, 'boss-callGuards': 0.108587, 'boss-carpet': 0.360579,
  'boss-charge': 0.415548, 'boss-claw': 1.348886, 'boss-decoysAppear': 0.197558, 'boss-magnet': 0.210143,
  'boss-plateDrop': 1.515444, 'boss-stickers': 0.185088, 'boss-stomp': 1.44897, 'boss-suction': 0.296721,
  'boss-tapeMeasure': 0.097283, 'boss-twinSlam': 0.525573, 'down': 0.30989, 'echoGust': 0.105477,
  'fireCyclone': 0.345228, 'frostCrosscut': 0.133236, 'guard': 0.16654, 'hydroJet': 1.00675,
  'iceSheet': 0.503867, 'pressureDash': 0.255055, 'roar': 0.929721, 'shockPool': 0.36261,
  'steamVeil': 0.123617, 'surfaceResonanceHit': 0.241808, 'swing': 0.194212, 'trumpet': 0.414316,
};
// The remade picks' volumes started at the page's match to the old sound, then the ones off their neighbours were moved
// (loudest 50 ms through SoundBank, 2026-11-09): dodge -25 dB under the swing's -27.6, rabbit -30 like chapter 1's mobs,
// steam burst -18.5 among chapter 2's bosses (-20 median), the held hydro jet -21, block -23, clamp and oiler -29.
/** Sounds now playing a remade take (redo-sound.js): a chapter 2 mob among them gets the ±2.5% its own recipe used to add. */
const REMADE = new Set(Object.entries(SFX).filter(([, sound]) => sound.code?.[0].startsWith('redo:')).map(([name]) => name));
const MENU = new Set(['cards', 'pick', 'loot', 'clear', 'fail']);
const IMPACT = new Set(['hit', 'heavy', 'stamp', 'boss-stampLand', 'boss-verdict', 'boss-plateDrop', 'boss-armSlam', 'boss-twoRows', 'boss-rhythmBeat', 'boss-finalPress']);
// Chapter 2 mobs already supply ±3% in their recipes; do not double their variation.
const REPEATED = new Set(['hit', 'heavy', 'stamp', 'splash', 'surfaceResonanceHit', 'boss-stampLand', 'boss-rhythmBeat', 'boss-twinSlam', 'boss-mirrorTurn', 'guard', 'nutcracker', 'elite', 'rabbit', 'trumpet', 'musicbox', 'spintop', 'drummer', 'pikeman', 'burst']);
const bodyCurves = new Map();
function bodyCurve(peak) {
  if (!bodyCurves.has(peak)) {
    // The recipe is scaled by 1/4 so even layered impacts fit the shaper's input range.
    const cap = peak / 4, curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) { const x = i * 2 / (curve.length - 1) - 1; curve[i] = cap * Math.tanh(x / cap); }
    bodyCurves.set(peak, curve);
  }
  return bodyCurves.get(peak);
}

export class SoundBank {
  constructor() { this.buffers = new Map(); this.loading = null; this.buses = new WeakMap(); }
  /** One room impulse and dynamics chain per audio context; recordings never enter it. */
  bus(audio) {
    if (this.buses.has(audio)) return this.buses.get(audio);
    const input = audio.createGain(), compressor = audio.createDynamicsCompressor(), trim = audio.createGain(), limiter = audio.createWaveShaper();
    compressor.threshold.value = -18; compressor.ratio.value = 3.5; compressor.knee.value = 10;
    compressor.attack.value = 0.004; compressor.release.value = 0.09;
    // Web Audio compressors include makeup gain. Trim it before the final soft peak ceiling.
    trim.gain.value = 0.62;
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) {
      const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
      curve[i] = magnitude <= 0.5 ? x : Math.sign(x) * (0.5 + 0.38 * Math.tanh((magnitude - 0.5) / 0.38));
    }
    limiter.curve = curve;
    input.connect(compressor).connect(trim).connect(limiter).connect(audio.destination);
    const impulse = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.32), audio.sampleRate), data = impulse.getChannelData(0);
    let seed = 713, energy = 0, smooth = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      smooth += 0.3 * (seed / 2147483648 - 1 - smooth);
      const t = i / audio.sampleRate;
      data[i] = smooth * Math.min(1, t / 0.008) * Math.exp(-t * 24);
      energy += data[i] * data[i];
    }
    const scale = 1 / Math.sqrt(energy);
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    const room = audio.createConvolver(), wet = audio.createGain();
    room.normalize = false; room.buffer = impulse; wet.gain.value = 0.11;
    room.connect(wet).connect(input);
    const bus = { input, impulse, room }; this.buses.set(audio, bus); return bus;
  }
  /** Fetches and decodes every take once, after the first user gesture has opened the audio context. */
  /** Downloads every recording while the game is still loading; no tap is needed to fetch, only to decode. */
  prefetch() {
    this.bytes ??= new Map([...new Set(Object.values(SFX).filter(sound => sound.file).flatMap(({ file, takes }) => Array.from({ length: takes }, (_, i) => `${file}-${i}`)))].map(key =>
      [key, fetch(`art/audio/sfx/${key}.ogg`).then(response => (response.ok ? response.arrayBuffer() : null)).catch(() => null)]));
    return this.bytes;
  }
  load(audio) {
    this.loading ??= Promise.all([...this.prefetch()].map(async ([key, bytes]) => {
      const data = await bytes;
      if (data) this.buffers.set(key, await audio.decodeAudioData(data));
    })).catch(error => console.warn(error));
    return this.loading;
  }
  /** Fades out the last copy of a named coded sound over `fade` seconds (고압 분사 let go early, 2026-11-09). */
  stop(audio, name, fade = 0.08) {
    const voice = this.live?.get(name); if (!voice) return;
    this.live.delete(name); const t = audio.currentTime;
    const end = t + Math.max(0.004, Math.min(0.08, Number.isFinite(fade) ? fade : 0.08));
    // This gate is AFTER the held sound's dry/wet sum, so its room tail stops too.
    voice.gate.gain.cancelScheduledValues(t); voice.gate.gain.setValueAtTime(1, t); voice.gate.gain.linearRampToValueAtTime(0, end);
    for (const source of voice.sources) { try { source.stop(end); } catch { /* Already ended. */ } }
  }
  /** Plays a named effect. A preview recipe and volume can use the same bus and stop gate as the game. */
  play(audio, name, gainScale = 1, {
    recipe, volume, variation = REPEATED.has(name) || ((recipe || REMADE.has(name)) && MOB2_CANDIDATES[name]) ? 0.025 : 0
  } = {}) {
    const sound = SFX[name];
    if (recipe || sound?.synth || sound?.code) {
      const level = (volume ?? sound?.volume ?? 1) * gainScale;
      if (!Number.isFinite(Math.fround(level * 4))) return false;
      const menu = MENU.has(name), out = audio.createGain(), gate = audio.createGain(), sources = new Set(), nodes = [out, gate];
      out.gain.value = level;
      if (menu) out.connect(gate).connect(audio.destination);
      else {
        const bus = this.bus(audio), alreadySoft = !!MOB2_CANDIDATES[name];
        let body = out;
        const softPeak = SOFT_BODY[name];
        if (softPeak) {
          const shape = audio.createWaveShaper(), makeup = audio.createGain();
          shape.curve = bodyCurve(softPeak); out.gain.value = 0.25; makeup.gain.value = level * 4;
          body = out.connect(shape).connect(makeup); nodes.push(shape, makeup);
        }
        if (!alreadySoft) {
          const shelf = audio.createBiquadFilter(), lowpass = audio.createBiquadFilter();
          shelf.type = 'highshelf'; shelf.frequency.value = 3800; shelf.gain.value = -6;
          lowpass.type = 'lowpass'; lowpass.frequency.value = 5600; lowpass.Q.value = 0.5;
          body = body.connect(shelf).connect(lowpass); nodes.push(shelf, lowpass);
        }
        if (name === 'hydroJet' || name === 'roar') {
          // A held skill needs its own return gate, but reuses the common impulse.
          const room = audio.createConvolver(), wet = audio.createGain();
          room.normalize = false; room.buffer = bus.impulse; wet.gain.value = 0.11;
          body.connect(room).connect(wet).connect(gate); nodes.push(room, wet);
        } else body.connect(bus.room);
        body.connect(gate).connect(bus.input);
      }
      const voice = { gate, sources };
      const cleanup = () => {
        if (this.live.get(name) === voice) this.live.delete(name);
        for (const node of nodes) node.disconnect();
      };
      const track = source => {
        sources.add(source);
        source.addEventListener('ended', () => {
          sources.delete(source);
          if (!sources.size) {
            // Use the audio clock so suspending Safari cannot truncate a still-playing tail.
            const tail = audio.createBufferSource(); tail.buffer = audio.createBuffer(1, 1, audio.sampleRate);
            tail.connect(gate); tail.addEventListener('ended', () => { tail.disconnect(); cleanup(); }, { once: true });
            tail.start(audio.currentTime + 0.34);
          }
        }, { once: true });
        return source;
      };
      const spread = Number.isFinite(variation) ? Math.min(0.03, Math.max(0, variation)) : 0;
      const context = voiceContext(audio, {
        sfxMenu: menu, sfxAttack: IMPACT.has(name) ? 0.005 : 0.006,
        sfxPitch: spread ? 1 + (Math.random() * 2 - 1) * spread : 1,
        createOscillator: () => track(audio.createOscillator()), createBufferSource: () => track(audio.createBufferSource())
      });
      // The last copy of each sound is kept, so a held skill's sound can be cut when the button is let go (stop).
      (this.live ??= new Map()).set(name, voice);
      const draw = recipe ?? (sound.synth ? ELEMENT_SOUNDS[sound.synth] : CODED[sound.code[0]][sound.code[1]][1]);
      draw(context, out);
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
