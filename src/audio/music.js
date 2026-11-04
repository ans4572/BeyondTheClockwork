// Background music: one looping track per part of the game, crossfaded when the part changes.
// Tracks stream through <audio> elements routed into Web Audio, because phones ignore an element's own volume.
import { assetUrl } from '../animation/sprite-library.js';

/** Abstraction, Music Loop Bundle (CC0). volume evens out how loud each recording is. */
export const MUSIC = {
  title: { volume: 0.55 },
  town: { volume: 0.55 },
  street: { volume: 0.5 },
  roco: { volume: 0.5 },
  dusk: { volume: 0.5 },
  brass: { volume: 0.5 }
};
// Songs cross-fade over a second; a song that ends into silence stops almost at once.
const FADE_SECONDS = 1, STOP_SECONDS = 0.25;

/**
 * Which track belongs to what is on screen, or null for silence.
 * The run's first half (before the night-market rest stop) is bright; from the rest stop on it is dusk.
 */
export function musicScene({ onTitle, mode, roomKind, roomIndex, restIndex }) {
  if (onTitle) return 'title';
  // Once the title is left the song stops: the stamp, the scrapyard and the first lesson are quiet.
  if (['opening', 'intro', 'returned', 'introDeath'].includes(mode)) return null;
  if (['hub', 'registration', 'practice'].includes(mode)) return 'town';
  if (mode === 'complete') return 'title';
  if (roomKind === 'miniboss') return 'roco';
  if (roomKind === 'regionBoss') return 'brass';
  if (roomIndex === undefined || roomIndex < 0) return null;
  return roomIndex >= restIndex ? 'dusk' : 'street';
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
      const pending = this.files?.has(name) && !this.local?.get(name), element = pending ? new Audio() : new Audio(this.local?.get(name) || assetUrl(`/art/audio/bgm/${name}.ogg`)); element.loop = true; element.preload = 'metadata'; this.elements.set(name, element); }
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
      track.element.play().then(() => { if (name !== this.current) track.element.pause(); }).catch(() => { this.unlocked = false; });
    }
  }
  /**
   * Call every frame with the wanted track (or null) and the overall music volume (0..1). `force` starts it even while
   * the context is still waking up, for the call made inside the tap that unlocks sound.
   */
  update(audio, name, volume, force = false) {
    if (!audio || (audio.state !== 'running' && !force)) return;
    const now = audio.currentTime;
    if (name !== this.current) {
      if (this.current) {
        const old = this.tracks.get(this.current);
        old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); const out = name ? FADE_SECONDS : STOP_SECONDS; old.gain.gain.linearRampToValueAtTime(0, now + out);
        old.stopTimer = setTimeout(() => old.element.pause(), out * 1000 + 50);
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
    // Volume changes (settings, the pause menu) glide rather than jump, once the fade-in is done.
    if (name && now >= (this.fadeUntil || 0)) this.tracks.get(name).gain.gain.setTargetAtTime(MUSIC[name].volume * volume, now, 0.15);
    // A phone stops music when the app goes to the background; it picks up again by itself on return.
    const playing = name && this.tracks.get(name);
    if (playing?.element.paused && !this.retrying) { this.retrying = true; playing.element.play().catch(() => {}).finally(() => { this.retrying = false; }); }
  }
}
