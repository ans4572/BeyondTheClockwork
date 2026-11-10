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
  assert.equal(musicScene({ mode: 'complete', tower: true }), 'orden', 'the clock tower summit plays the Orden theme');
  assert.equal(musicScene({ mode: 'complete' }), 'title', 'and the clear screen after it the title song');
  assert.equal(musicScene({ mode: 'complete', talking: true }), 'brass-v2', 'the last talk after the win keeps the boss song, not the title song');
  assert.equal(musicScene({ mode: 'complete', talking: true, chapter: 'silent-factory' }), 'press-v2');
  assert.equal(musicScene({ onTitle: false, mode: 'opening' }), null);
  assert.equal(musicScene({ onTitle: false, mode: 'intro' }), null);
  assert.equal(musicScene({ onTitle: false, mode: 'hub' }), 'town-v2');
  assert.equal(musicScene({ onTitle: false, mode: 'returned' }), null);
  rooms.forEach((room, i) => {
    const want = room.kind === 'miniboss' ? 'roco-v2' : room.kind === 'regionBoss' ? 'brass-v2' : i < restIndex ? 'street' : 'dusk-v2';
    assert.equal(inRoom(i), want, room.id); assert.equal(inRoom(i, 'reward'), want, room.id);
  });
});

test('the Silent Factory plays its own songs: rooms, rest stop, Iris and Press', () => {
  const factory = data.slice.chapters.find(c => c.id === 'silent-factory').rooms;
  factory.forEach((room, i) => {
    const want = room.kind === 'miniboss' ? 'iris-v2' : room.kind === 'regionBoss' ? 'press-v2' : room.kind === 'shop' ? 'factory-rest-v2' : 'factory-v2';
    for (const mode of ['combat', 'reward']) assert.equal(musicScene({ onTitle: false, mode, roomKind: room.kind, roomIndex: i, restIndex, chapter: 'silent-factory' }), want, room.id);
  });
  assert.equal(musicScene({ onTitle: false, mode: 'hub', chapter: 'silent-factory' }), 'town-v2');
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

test('every song repeats, town, rooms and bosses of both chapters: an ended song starts over, a hand loop jumps back', () => {
  const player = new MusicPlayer(), audio = fakeContext();
  for (const name of Object.keys(MUSIC)) {
    player.update(audio, name, 1);
    const element = player.tracks.get(name).element;
    assert.equal(element.loop, true, name);
    // A phone that ignores `loop`: the song that ended plays again from its start.
    element.paused = true; element.currentTime = 99; element.onended();
    assert.equal(element.paused, false, name); assert.equal(element.currentTime, MUSIC[name].loop?.[0] || 0, name);
  }
  // factory-v2 fades out at its end: past its loop point it is put back a whole number of bars.
  const [from, to] = MUSIC['factory-v2'].loop, factory = player.tracks.get('factory-v2').element;
  player.update(audio, 'factory-v2', 1); factory.paused = false; factory.currentTime = to + 0.05; audio.currentTime += 10; player.update(audio, 'factory-v2', 1);
  assert.ok(Math.abs(factory.currentTime - (from + 0.05)) < 1e-9);
});
