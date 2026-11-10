import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';

const data = Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))])));
const reload = edit => { const saved = JSON.parse(encodeSave(new Game(data).s)); edit(saved.state.profile.settings); return decodeSave(JSON.stringify(saved), data).profile.settings; };

test('a new save moves with the keys; the mouse way keeps its own changed keys', () => {
  const settings = new Game(data).s.profile.settings;
  assert.equal(settings.controls, 'keys'); assert.deepEqual(settings.mouseBindings, {});
  const kept = reload(s => { s.controls = 'mouse'; s.mouseBindings = { skill0: 'Digit1' }; });
  assert.equal(kept.controls, 'mouse'); assert.deepEqual(kept.mouseBindings, { skill0: 'Digit1' });
});

test('a save from before the mouse way moves with the keys, and odd values are reset instead of refusing the save', () => {
  const old = reload(s => { delete s.controls; delete s.mouseBindings; });
  assert.equal(old.controls, 'keys'); assert.deepEqual(old.mouseBindings, {});
  const odd = reload(s => { s.controls = 'joystick'; s.mouseBindings = ['KeyQ']; });
  assert.equal(odd.controls, 'keys'); assert.deepEqual(odd.mouseBindings, {});
});

test('the arrow-key way (arrows, Ctrl, Shift) is kept with its own changed keys; a broken list is emptied', () => {
  const kept = reload(s => { s.controls = 'arrows'; s.arrowBindings = { attack: 'ControlRight' }; });
  assert.equal(kept.controls, 'arrows'); assert.deepEqual(kept.arrowBindings, { attack: 'ControlRight' });
  const odd = reload(s => { s.controls = 'arrows'; s.arrowBindings = 'Ctrl'; });
  assert.equal(odd.controls, 'arrows'); assert.deepEqual(odd.arrowBindings, {});
});
