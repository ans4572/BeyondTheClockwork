import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC, musicScene, MusicPlayer } from '../src/audio/music.js';
import { Game } from '../src/engine/game.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';

const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));
const rooms = data.slice.rooms, restIndex = rooms.findIndex(room => room.kind === 'shop');
const inRoom = (i, mode = 'combat') => musicScene({ onTitle: false, mode, roomKind: rooms[i].kind, roomIndex: i, restIndex });

test('each part of the game has its track: title, town, bright street, Roco, dusk, Brass', () => {
  assert.equal(musicScene({ onTitle: true, mode: 'hub' }), 'title');
  assert.equal(musicScene({ onTitle: false, mode: 'opening' }), null);
  assert.equal(musicScene({ onTitle: false, mode: 'intro' }), null);
  assert.equal(musicScene({ onTitle: false, mode: 'hub' }), 'town');
  assert.equal(musicScene({ onTitle: false, mode: 'returned' }), null);
  rooms.forEach((room, i) => {
    const want = room.kind === 'miniboss' ? 'roco' : room.kind === 'regionBoss' ? 'brass' : i < restIndex ? 'street' : 'dusk';
    assert.equal(inRoom(i), want, room.id); assert.equal(inRoom(i, 'reward'), want, room.id);
  });
});

test('every track is on disk, and old saves get music switched on', async () => {
  for (const name of Object.keys(MUSIC)) assert.ok((await stat(new URL(`../art/audio/bgm/${name}.ogg`, import.meta.url))).size > 100000, name);
  const g = new Game(data), saved = JSON.parse(encodeSave(g.s));
  delete saved.state.profile.settings.music; delete saved.state.profile.settings.musicVolume;
  const loaded = decodeSave(JSON.stringify(saved), data);
  assert.equal(loaded.profile.settings.music, true); assert.equal(loaded.profile.settings.musicVolume, 0.6);
});

// A stand-in for the browser: elements that remember play/pause, a sound context whose state the test sets.
class FakeAudioElement { constructor() { this.paused = true; this.muted = false; this.currentTime = 0; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } getAttribute() { return 'x'; } }
const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; } });
const fakeContext = () => ({ state: 'running', currentTime: 0, destination: {}, createGain: () => ({ gain: param(), connect: x => x }), createMediaElementSource: () => ({ connect: x => x }) });
globalThis.Audio ??= FakeAudioElement;

test('the title song stops on leaving the title even while a phone has the sound context asleep', () => {
  const player = new MusicPlayer(), audio = fakeContext();
  player.update(audio, 'title', 1); assert.equal(player.tracks.get('title').element.paused, false);
  audio.state = 'interrupted';
  player.update(audio, null, 1);
  assert.equal(player.tracks.get('title').element.paused, true); assert.equal(player.current, null);
  audio.state = 'running'; audio.currentTime = 5; player.update(audio, null, 1);
  assert.equal(player.tracks.get('title').element.paused, true, 'it does not come back when sound wakes up');
});

test('a song left playing outside its scene is stopped once its fade is over', () => {
  const player = new MusicPlayer(), audio = fakeContext();
  player.update(audio, 'title', 1); audio.currentTime = 2; player.update(audio, null, 1);
  // A late start (say, from unlocking sound on a tap) brings the title back on its own.
  player.tracks.get('title').element.paused = false;
  audio.currentTime = 3; player.update(audio, null, 1);
  assert.equal(player.tracks.get('title').element.paused, true);
});
