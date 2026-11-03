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
const FADE_SECONDS = 1;

/**
 * Which track belongs to what is on screen, or null for silence.
 * The run's first half (before the night-market rest stop) is bright; from the rest stop on it is dusk.
 */
export function musicScene({ onTitle, mode, roomKind, roomIndex, restIndex }) {
  if (onTitle || ['opening', 'intro'].includes(mode)) return 'title';
  if (['returned', 'introDeath'].includes(mode)) return null;
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
  preload(names) { for (const name of names) this.element(name).preload = 'auto'; }
  /** Resolves once a track has enough to start playing (or after `ms`, whichever is first). */
  ready(name, ms) {
    const element = this.element(name);
    return new Promise(done => { if (element.readyState >= 3) return done(); element.addEventListener('canplay', done, { once: true }); setTimeout(done, ms); });
  }
  element(name) {
    this.elements ??= new Map();
    if (!this.elements.has(name)) { const element = new Audio(assetUrl(`/art/audio/bgm/${name}.ogg`)); element.loop = true; element.preload = 'metadata'; this.elements.set(name, element); }
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
  /** Call every frame with the wanted track (or null) and the overall music volume (0..1). */
  update(audio, name, volume) {
    if (!audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    if (name !== this.current) {
      if (this.current) {
        const old = this.tracks.get(this.current);
        old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
        old.stopTimer = setTimeout(() => old.element.pause(), FADE_SECONDS * 1000 + 50);
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
