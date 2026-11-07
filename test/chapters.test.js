import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';
import { chapterOpen, chapterCleared, chapterRooms } from '../src/engine/chapters.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice', 'maps'].map(async name => [name, await load(name)]))));
const FACTORY = 'silent-factory';
const atPortal = (edit = () => {}, previews = true) => { const g = new Game(data); g.previews = previews; g.s.profile.registered = true; g.s.mode = 'hub'; g.s.panel = 'difficulty'; edit(g.s.profile); return g; };
const reload = g => new Game(data, decodeSave(encodeSave(g.s), data));

test('chapter 2 has its own twelve stops: fights, the inspection room, a rest stop and the forming hall', () => {
  const rooms = chapterRooms(data.slice, FACTORY);
  assert.equal(rooms.length, 12);
  assert.deepEqual(rooms.map(r => r.kind), ['normal', 'normal', 'normal', 'normal', 'miniboss', 'shop', 'normal', 'normal', 'normal', 'normal', 'normal', 'regionBoss']);
  assert.ok(rooms.every(r => r.id.startsWith('factory-')));
});

test('chapter 2 opens once chapter 1 is beaten, and a save from before chapters that has a win counts as beaten', () => {
  const fresh = atPortal();
  assert.equal(chapterOpen(data.slice, fresh.s.profile, FACTORY, true), false);
  assert.equal(fresh.depart('normal', FACTORY), false, 'locked');
  assert.equal(fresh.s.run, null);
  const old = atPortal(p => { p.wins = 1; delete p.cleared; });
  assert.ok(chapterCleared(old.s.profile, 'smile-street'));
  assert.ok(chapterOpen(data.slice, old.s.profile, FACTORY, true));
  assert.ok(old.depart('normal', FACTORY));
  assert.equal(old.s.run.chapter, FACTORY);
  assert.equal(old.room.id, 'factory-01');
  assert.equal(old.s.profile.chapter, 2, 'entering chapter 2 opens its stat levels');
});

test('a chapter 2 run is harder and pays more, keeps its records apart, and reports nothing to the server', () => {
  const g = atPortal(p => { p.cleared = ['smile-street']; }), sent = [];
  g.onRun = (kind, event) => sent.push(kind);
  assert.ok(g.depart('normal', FACTORY));
  const level = data.slice.difficulty.levels.find(l => l.id === 'normal'), chapter = data.slice.chapters.find(c => c.id === FACTORY);
  assert.equal(g.difficulty.scale, level.scale * chapter.scale);
  assert.equal(g.difficulty.loot, level.loot * chapter.loot);
  g.s.run.elapsed = 600; g.returnToHub('clear');
  assert.equal(g.s.result.chapter, FACTORY);
  assert.equal(g.s.profile.chapterRecords[FACTORY].normal.clears, 1);
  assert.equal(g.s.profile.records.normal, undefined, 'chapter 1 records untouched');
  assert.deepEqual(sent, []);
});

test('beating the forming hall marks chapter 2 cleared; a chapter 2 run survives a reload', () => {
  const g = atPortal(p => { p.cleared = ['smile-street']; });
  assert.ok(g.depart('hard', FACTORY));
  g.s.run.node = 4; g.enterNode();
  const back = reload(g);
  assert.equal(back.s.run.chapter, FACTORY); assert.equal(back.room.id, 'factory-05'); assert.equal(back.s.run.difficulty, 'hard');
  g.s.run.node = 11; g.enterNode(); g.s.mode = 'unwind'; g.unwind();
  assert.equal(g.s.mode, 'complete');
  assert.ok(g.s.profile.cleared.includes(FACTORY));
  const kept = reload(g);
  assert.deepEqual(kept.s.profile.cleared, ['smile-street', FACTORY]);
});

test('a chapter 1 run is unchanged: no chapter on the run, records where they were', () => {
  const g = atPortal();
  assert.ok(g.depart('easy'));
  assert.equal(g.s.run.chapter, undefined); assert.equal(g.room.id, 'stop-02');
  g.returnToHub('abandon');
  assert.equal(g.s.profile.records.easy.furthest, 1);
});

test('chapter 2 is still a preview: without previews it stays shut even after chapter 1 is beaten', () => {
  const live = atPortal(p => { p.cleared = ['smile-street']; }, false);
  assert.equal(chapterOpen(data.slice, live.s.profile, FACTORY), false);
  assert.equal(live.depart('normal', FACTORY), false);
  assert.equal(live.s.run, null);
  assert.ok(chapterOpen(data.slice, live.s.profile, FACTORY, true), 'open on the dev server');
});
