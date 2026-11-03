import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC, musicScene } from '../src/audio/music.js';
import { Game } from '../src/engine/game.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';

const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));
const rooms = data.slice.rooms, restIndex = rooms.findIndex(room => room.kind === 'shop');
const inRoom = (i, mode = 'combat') => musicScene({ onTitle: false, mode, roomKind: rooms[i].kind, roomIndex: i, restIndex });

test('each part of the game has its track: title, town, bright street, Roco, dusk, Brass', () => {
  assert.equal(musicScene({ onTitle: true, mode: 'hub' }), 'title');
  assert.equal(musicScene({ onTitle: false, mode: 'opening' }), 'title');
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
