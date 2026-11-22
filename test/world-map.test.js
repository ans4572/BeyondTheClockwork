// The world map in chapter 3 (2026-11-22, the user's word: the map had not caught up with the clock tower).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { worldMapSvg } from '../src/ui/world-map.js';

const slice = JSON.parse(await readFile(new URL('../src/data/slice.json', import.meta.url), 'utf8'));
// (tower-11, the top, is the tuning room fallen in: slice.json mapStop gives it tower-10's stop, as the map sheet does.)
const rooms = slice.chapters.find(c => c.id === 'clock-tower').rooms.filter(room => !room.mapStop);
const stops = (node = 3) => [{ id: 'town', icon: 'home', label: '마을', state: 'done', kind: 'town' },
  ...rooms.map((room, i) => ({ id: room.id, icon: i + 1, label: room.short, state: i === node ? 'current' : i < node ? 'done' : 'ahead', kind: room.boss ? 'boss' : room.kind === 'shop' ? 'shop' : '' }))];

test('the top of the tower shares the stop of the tuning room', () => {
  const all = slice.chapters.find(c => c.id === 'clock-tower').rooms;
  assert.deepEqual(all.filter(room => room.mapStop).map(room => [room.id, room.mapStop]), [['tower-11', 'tower-10']]);
  assert.equal(rooms.length, 10);
});

test('the clock tower run draws each of its stops on the tower, apart, with the veil and the "coming" note gone', () => {
  const svg = worldMapSvg(stops(), 'tower-04', { chapter: 'clock-tower' });
  const nodes = [...svg.matchAll(/data-id="(tower-\d+)"/g)].map(m => m[1]);
  assert.equal(nodes.length, rooms.length);
  const marks = [...svg.matchAll(/<g class="node (?:done|current|ahead)[^"]*"[\s\S]*?<image class="marker"[^>]*x="([\d.-]+)" y="([\d.-]+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(marks.length, rooms.length + 1);
  for (const [x, y] of marks) assert.ok(Number.isFinite(x) && Number.isFinite(y));
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) assert.ok(Math.hypot(marks[i][0] - marks[j][0], marks[i][1] - marks[j][1]) > 15, `stops ${i} and ${j} sit on each other`);
  assert.ok(!svg.includes('clip-path="url(#wm-tower)"'), 'the tower is still veiled');
  assert.ok(!svg.includes('무음공장 다음 · 준비 중'));
  assert.ok(!svg.includes('node locked'), 'locked ? stops still drawn');
});

test('from another chapter the tower is veiled until chapter 3 is open, then shown', () => {
  const town = [{ id: 'town', icon: 'home', label: '마을', state: 'current', kind: 'town' }];
  assert.ok(worldMapSvg(town, 'town', { factoryOpen: true }).includes('무음공장 다음 · 준비 중'));
  const open = worldMapSvg(town, 'town', { factoryOpen: true, towerOpen: true });
  assert.ok(!open.includes('무음공장 다음 · 준비 중') && !open.includes('clip-path="url(#wm-tower)"'));
});
