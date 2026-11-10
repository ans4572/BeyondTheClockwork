import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';
import { progressMark } from '../src/engine/sync.js';
import { cleanNickname, callName, fillName, endsInConsonant } from '../src/engine/nickname.js';
import { cleanEvent } from '../src/engine/stats.js';

const load = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, await load(name)]))));
const dialogue = await load('dialogue');

test('a ledger name keeps letters of any script, digits and a few marks, ten at most', () => {
  assert.equal(cleanNickname('  민수 <b>2호</b>!! '), '민수 b2호b');
  assert.equal(cleanNickname('Tinker_Bell-01.'), 'Tinker_Bel');
  assert.equal(cleanNickname('a\n\tb'), 'a b');
  assert.equal(cleanNickname(42), '');
  assert.equal(callName({ nickname: '' }), 'F2');
  assert.equal(callName({ nickname: '모모' }), '모모');
});

test('lines fill in the name with the particle that fits how it is read', () => {
  assert.equal(fillName('{name|이라고|라고} 불러 주세요.', { nickname: '민수' }), '민수라고 불러 주세요.');
  assert.equal(fillName('{name|이라고|라고} 불러 주세요.', { nickname: '철민' }), '철민이라고 불러 주세요.');
  assert.equal(fillName('{name|이라고|라고} 불러 주세요.', {}), 'F2라고 불러 주세요.', 'F2 reads 에프투');
  assert.equal(fillName('{name}. 좋아.', { nickname: 'Sam' }), 'Sam. 좋아.');
  assert.ok(endsInConsonant('Sam') && endsInConsonant('3') && !endsInConsonant('Joe') && !endsInConsonant('9'));
});

test('Moru asks for the ledger name before the safety pin, and the answer is spoken back', () => {
  const { scripts } = dialogue;
  assert.equal(scripts.ledger.at(-1).ask.id, 'nickname');
  assert.match(scripts.ledger[0].text, /수리 장부/);
  assert.ok(scripts.ledgerDone.every(line => line.text.includes('{name')));
  assert.ok(!scripts.registration.at(-1).text.includes('안전핀부터'), 'the safety pin line moved after the ledger');
});

test('the name lives in the save, so a transfer code or a linked device carries it, and an odd one is cleaned', () => {
  const pc = new Game(data);
  pc.s.profile.registered = true; pc.s.mode = 'hub';
  const before = progressMark(pc.s);
  assert.equal(pc.setNickname('  태엽 소녀  '), '태엽 소녀');
  assert.notEqual(progressMark(pc.s), before, 'a new name is progress, so the village uploads it to linked devices');
  const phone = decodeSave(encodeSave(pc.s), data);
  assert.equal(phone.profile.nickname, '태엽 소녀');
  const broken = JSON.parse(encodeSave(pc.s)); broken.state.profile.nickname = '<script>x'.repeat(5);
  assert.equal(decodeSave(JSON.stringify(broken), data).profile.nickname.length <= 10, true);
  const old = JSON.parse(encodeSave(pc.s)); delete old.state.profile.nickname;
  assert.equal(decodeSave(JSON.stringify(old), data).profile.nickname, '', 'an older save is called F2');
  assert.equal(pc.setNickname(''), '');
});

test('the check-in carries the ledger name, cleaned', () => {
  const event = cleanEvent({ device: 'phone0000000000a', kind: 'ping', name: ' 민수!! ', where: 'hub', node: 0, gears: 0, playSeconds: 0 });
  assert.equal(event.name, '민수');
  assert.equal(cleanEvent({ device: 'phone0000000000a', kind: 'ping', where: 'hub', node: 0, gears: 0, playSeconds: 0 }).name, '');
});

test('notices put the particle that fits after a name, never 이(가) or 을(를)', async () => {
  const { josa } = await import('../src/engine/nickname.js');
  assert.equal(josa('로코', '이', '가'), '로코가');
  assert.equal(josa('굉음', '을', '를'), '굉음을');
  assert.equal(josa('물대포', '을', '를'), '물대포를');
  assert.equal(josa('과열 휘두르기 · 배기 폭발', '이', '가'), '과열 휘두르기 · 배기 폭발이');
});
