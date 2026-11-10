// Background music: one looping track per part of the game, crossfaded when the part changes.
// Tracks stream through <audio> elements routed into Web Audio, because phones ignore an element's own volume.
import { assetUrl } from '../animation/sprite-library.js';

/** Abstraction, Music Loop Bundle (CC0). volume evens out how loud each recording is. */
export const MUSIC = {
  street: { volume: 0.5 },
  // The title is the original chiptune again (user's choice, 2026-11-09): it measures 5.7 dB louder than title-v2, so 0.29.
  title: { volume: 0.29 },
  // Orden's theme (2026-11-09, art/audio/bgm/orden.prompt.md): the clock tower summit after each chapter's last boss.
  // 40 bars of 3/4 at 76 BPM; its last bar is a held note ringing out, so it loops whole.
  orden: { volume: 0.55 },
  // Chapter 1's piano versions (2026-11-09, art/audio/bgm/codex-ch1-bgm-piano.task.md, see art/audio/CREDITS.md): the village,
  // the night market and dusk, Roco, Brass. They are mixed about 6 dB quieter than the old loops, like chapter 2's.
  'town-v2': { volume: 0.55 },
  'dusk-v2': { volume: 0.5 },
  'roco-v2': { volume: 0.5 },
  'brass-v2': { volume: 0.5 },
  // Chapter 2, the Silent Factory (2026-11-08, see art/audio/CREDITS.md): the rooms, the rest stop, Iris, Press.
  // factory-v2 ends in a 5-second fade to silence, so it is looped by hand: from 171.56 s (bar 80 at 112 BPM, the
  // eighth-note grid starting 0.132 s in) back to 0.132 s, a whole number of bars, before the fade begins (2026-11-09).
  'factory-v2': { volume: 0.5, loop: [0.132, 171.56] },
  'factory-rest-v2': { volume: 0.5 },
  'iris-v2': { volume: 0.5 },
  'press-v2': { volume: 0.5 }
};
/** A chapter's own songs; a chapter missing here plays chapter 1's. */
const CHAPTER_MUSIC = {
  'silent-factory': { rooms: 'factory-v2', rest: 'factory-rest-v2', miniboss: 'iris-v2', regionBoss: 'press-v2' }
};
// Songs cross-fade over a second; a song that ends into silence stops almost at once.
const FADE_SECONDS = 1, STOP_SECONDS = 0.25;

/**
 * Which track belongs to what is on screen, or null for silence.
 * The run's first half (before the night-market rest stop) is bright; from the rest stop on it is dusk.
 * Chapter 2 has one song for its fighting rooms, one for its rest stop and one for each boss.
 */
export function musicScene({ onTitle, mode, roomKind, roomIndex, restIndex, chapter, tower = false, talking = false }) {
  if (onTitle) return 'title';
  // The clock tower summit (a chapter's ending scene, Orden and Belgard) has Orden's own theme.
  if (tower) return 'orden';
  // The last boss's words once the chapter is won keep his fight's song (2026-11-09: the clear screen's title song came in
  // under them); the tower scene then has Orden's, the clear screen the title song.
  if (mode === 'complete' && talking) return CHAPTER_MUSIC[chapter]?.regionBoss || 'brass-v2';
  // Once the title is left the song stops: the stamp, the scrapyard and the first lesson are quiet.
  if (['opening', 'intro', 'returned', 'introDeath'].includes(mode)) return null;
  if (['hub', 'registration', 'practice'].includes(mode)) return 'town-v2';
  if (mode === 'complete') return 'title';
  const own = CHAPTER_MUSIC[chapter];
  if (own) { if (roomIndex === undefined || roomIndex < 0) return null; return roomKind === 'miniboss' ? own.miniboss : roomKind === 'regionBoss' ? own.regionBoss : roomKind === 'shop' ? own.rest : own.rooms; }
  if (roomKind === 'miniboss') return 'roco-v2';
  if (roomKind === 'regionBoss') return 'brass-v2';
  if (roomIndex === undefined || roomIndex < 0) return null;
  return roomIndex >= restIndex ? 'dusk-v2' : 'street';
}

export class MusicPlayer {
  constructor() { this.tracks = new Map(); this.current = null; }
  /** Starts downloading tracks before the first tap, so the first music plays as soon as sound is allowed. */
  preload(names) {
    // Phones ignore preload on music before the first tap, but a plain download is allowed: fetch the whole file
    // and hand it to the player, so it is already on the device when sound is switched on.
    this.files ??= new Map();
    for (const name of names) {
      if (this.files.has(name)) continue;
      // The player is made from the downloaded file if it is ready by then; a song never changes source once made.
      this.files.set(name, fetch(assetUrl(`/art/audio/bgm/${name}.ogg`)).then(r => (r.ok ? r.blob() : null)).then(blob => {
        const url = blob ? URL.createObjectURL(blob) : assetUrl(`/art/audio/bgm/${name}.ogg`);
        (this.local ??= new Map()).set(name, url);
        // A player made while the file was still coming has no source yet: give it the file and start it if wanted.
        const element = this.elements?.get(name);
        if (element && !element.getAttribute('src')) { element.src = url; if (this.current === name) element.play().catch(() => {}); }
      }).catch(() => {}));
    }
  }
  /** Resolves once a track has enough to start playing (or after `ms`, whichever is first). */
  ready(name, ms) {
    return Promise.race([this.files?.get(name) || Promise.resolve(), new Promise(done => setTimeout(done, ms))]);
  }
  element(name) {
    this.elements ??= new Map();
    if (!this.elements.has(name)) {
      // While its download is under way a song waits for it instead of streaming the same file a second time.
      const pending = this.files?.has(name) && !this.local?.get(name), element = pending ? new Audio() : new Audio(this.local?.get(name) || assetUrl(`/art/audio/bgm/${name}.ogg`)); element.loop = true; element.preload = 'metadata'; this.elements.set(name, element);
      // Some phones let a song routed through Web Audio end despite `loop`: the wanted song starts over by hand.
      element.onended = () => { if (this.current === name) { element.currentTime = MUSIC[name].loop?.[0] || 0; element.play().catch(() => {}); } };
    }
    return this.elements.get(name);
  }
  track(audio, name) {
    if (!this.tracks.has(name)) {
      const element = this.element(name);
      const gain = audio.createGain(); gain.gain.value = 0;
      audio.createMediaElementSource(element).connect(gain).connect(audio.destination);
      this.tracks.set(name, { element, gain, stopTimer: null });
    }
    return this.tracks.get(name);
  }
  /**
   * Phones let a music element start only inside a tap. Called from the first tap, this starts and stops every track
   * once (silently, gain 0), so later tracks such as a battle's can begin when the player walks through a portal.
   */
  unlock(audio) {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const name of Object.keys(MUSIC)) {
      const track = this.track(audio, name);
      if (name === this.current || !track.element.paused) continue;
      // Muted as well as at gain 0: a phone whose sound context is not running may play an element past its gain.
      const { element } = track; element.muted = true;
      element.play().then(() => { if (name !== this.current) element.pause(); }).catch(() => { this.unlocked = false; }).finally(() => { if (name !== this.current) element.pause(); element.muted = false; });
    }
  }
  /** Inside a tap: the wanted song, if a phone refused to start it outside one, starts now. */
  kick() { const track = this.current && this.tracks.get(this.current); if (track?.element.paused) track.element.play().catch(() => {}); }
  /**
   * Call every frame with the wanted track (or null) and the overall music volume (0..1). `force` starts it even while
   * the context is still waking up, for the call made inside the tap that unlocks sound.
   */
  update(audio, name, volume, force = false) {
    if (!audio) return;
    // While the sound context is asleep (not yet allowed, or a phone interrupted it) nothing can fade. A change of song
    // still happens at once: the old song is paused outright, so it can never carry on into the next scene.
    if (audio.state !== 'running' && !force) {
      if (name !== this.current) {
        const old = this.current && this.tracks.get(this.current);
        if (old) { clearTimeout(old.stopTimer); old.element.pause(); old.gain.gain.cancelScheduledValues(0); old.gain.gain.value = 0; }
        this.current = name; this.fadeUntil = 0;
        if (name) { const next = this.track(audio, name); next.element.currentTime = 0; next.element.play().catch(() => {}); next.gain.gain.cancelScheduledValues(0); next.gain.gain.value = MUSIC[name].volume * volume; }
      }
      return;
    }
    const now = audio.currentTime;
    if (name !== this.current) {
      if (this.current) {
        const old = this.tracks.get(this.current);
        old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); const out = name ? FADE_SECONDS : STOP_SECONDS; old.gain.gain.linearRampToValueAtTime(0, now + out);
        old.stopTimer = setTimeout(() => old.element.pause(), out * 1000 + 50); old.stopAt = now + out + 0.1;
      }
      this.current = name;
      if (name) {
        const next = this.track(audio, name);
        clearTimeout(next.stopTimer);
        if (next.element.paused) { next.element.currentTime = 0; next.element.play().catch(() => {}); }
        next.gain.gain.cancelScheduledValues(now); next.gain.gain.setValueAtTime(next.gain.gain.value, now); next.gain.gain.linearRampToValueAtTime(MUSIC[name].volume * volume, now + FADE_SECONDS);
        this.fadeUntil = now + FADE_SECONDS;
      }
      return;
    }
    // Any other song still sounding once its fade is over (a late start from unlocking, a missed timer) is stopped.
    for (const [other, track] of this.tracks) if (other !== name && !track.element.paused && now >= (track.stopAt || 0) && !track.element.muted) { track.element.pause(); track.gain.gain.cancelScheduledValues(now); track.gain.gain.setValueAtTime(0, now); }
    // Volume changes (settings, the pause menu) glide rather than jump, once the fade-in is done.
    if (name && now >= (this.fadeUntil || 0)) this.tracks.get(name).gain.gain.setTargetAtTime(MUSIC[name].volume * volume, now, 0.15);
    // A phone stops music when the app goes to the background; it picks up again by itself on return.
    const playing = name && this.tracks.get(name);
    // A song looped by hand jumps back a whole number of bars, carrying over how far past its end it ran.
    const loop = name && MUSIC[name].loop;
    if (loop && playing && !playing.element.paused && playing.element.currentTime >= loop[1]) playing.element.currentTime = loop[0] + (playing.element.currentTime - loop[1]);
    if (playing?.element.paused && !this.retrying) { this.retrying = true; playing.element.play().catch(() => {}).finally(() => { this.retrying = false; }); }
  }
}
