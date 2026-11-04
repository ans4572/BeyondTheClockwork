import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { encodeSave, decodeSave } from '../src/engine/storage.js';
import { makeCode, normalizeCode, formatCode, looksLikeSave, CODE_ALPHABET } from '../src/engine/transfer-code.js';
import { api, CODES_PER_HOUR } from '../worker/index.js';
import { sendSave, fetchSave, forgetCode, startSync, pullSync, pushSync } from '../src/ui/device-transfer.js';
import { progressMark, syncPlan, readLink, writeLink, SYNC_STORE_KEY } from '../src/engine/sync.js';

const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))]))));
/** Cloudflare KV as a Map, enough for the worker. */
const kv = () => { const m = new Map(); return { m, get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); } }; };
/** The game's fetch, answered by the worker in the same process. */
const viaWorker = (env, ip = '1.2.3.4') => async (url, options = {}) => {
  const request = new Request(new URL(url, 'https://w.example'), { method: options.method || 'GET', body: options.body, headers: { ...options.headers, 'CF-Connecting-IP': ip } });
  return api(request, new URL(request.url), env);
};

test('a transfer code is eight unambiguous letters, typed in any case with or without the dash', () => {
  const code = makeCode(bytes => crypto.getRandomValues(bytes));
  assert.equal(code.length, 8);
  assert.ok([...code].every(ch => CODE_ALPHABET.includes(ch)));
  assert.ok(!/[01OIL]/.test(CODE_ALPHABET));
  assert.equal(normalizeCode(` ${formatCode(code).toLowerCase()} `), code);
  assert.equal(normalizeCode('ABCD-EFG'), null);
  assert.equal(normalizeCode('ABCD-EFG0'), null);
});

test('only something shaped like a save is accepted', () => {
  assert.ok(looksLikeSave(encodeSave(new Game(data).s)));
  assert.ok(!looksLikeSave('{"hello":1}'));
  assert.ok(!looksLikeSave('not json'));
  assert.ok(!looksLikeSave('x'.repeat(600 * 1024)));
});

test('a save sent from one device loads on another with its code, and the code is gone once used', async () => {
  const env = { TRANSFER: kv() }, pc = new Game(data);
  pc.s.profile.registered = true; pc.s.mode = 'hub'; pc.s.profile.freeGears = 321;
  const { code, expiresAt } = await sendSave(encodeSave(pc.s), viaWorker(env), '');
  assert.ok(Date.parse(expiresAt) > Date.now());
  const { save } = await fetchSave(formatCode(code).toLowerCase(), viaWorker(env), '');
  assert.equal(decodeSave(save, data).profile.freeGears, 321);
  await forgetCode(code, viaWorker(env), '');
  await assert.rejects(fetchSave(code, viaWorker(env), ''), /찾을 수 없어요/);
});

test('a wrong code, a broken save and too many codes each get a plain answer', async () => {
  const env = { TRANSFER: kv() }, save = encodeSave(new Game(data).s);
  await assert.rejects(fetchSave('ABC', viaWorker(env), ''), /8글자/);
  await assert.rejects(fetchSave('ABCD-EFGH', viaWorker(env), ''), /찾을 수 없어요/);
  await assert.rejects(sendSave('{"version":2}', viaWorker(env), ''), /보낼 수 없어요/);
  for (let i = 0; i < CODES_PER_HOUR; i++) await sendSave(save, viaWorker(env), '');
  await assert.rejects(sendSave(save, viaWorker(env), ''), /한 시간 뒤/);
  await sendSave(save, viaWorker(env, '5.6.7.8'), '');
  await assert.rejects(sendSave(save, async () => { throw new TypeError('offline'); }, ''), /인터넷/);
});

test('linked devices: one uploads on returning to the village, the other takes it on opening, and a race is refused', async () => {
  const env = { TRANSFER: kv() }, pc = new Game(data);
  pc.s.profile.registered = true; pc.s.mode = 'hub';
  const { key, rev } = await startSync(encodeSave(pc.s), viaWorker(env), '');
  assert.equal(rev, 1);
  // The code that links the phone carries the key.
  const { code } = await sendSave(encodeSave(pc.s), viaWorker(env), '', key);
  const got = await fetchSave(code, viaWorker(env), '');
  assert.equal(got.syncKey, key);
  const phone = decodeSave(got.save, data), phoneLink = { key, rev: (await pullSync(key, viaWorker(env), '')).rev, mark: progressMark(phone) };
  // The PC plays on and uploads; the phone, untouched, takes it.
  pc.s.profile.freeGears = 40;
  const pcLink = { key, rev, mark: progressMark(pc.s) };
  assert.equal(syncPlan(pc.s, pcLink, { rev }), 'keep');
  pcLink.rev = (await pushSync(key, encodeSave(pc.s), pcLink.rev, viaWorker(env), '')).rev;
  const remote = await pullSync(key, viaWorker(env), '');
  assert.equal(syncPlan(phone, phoneLink, remote), 'take');
  assert.equal(decodeSave(remote.save, data).profile.freeGears, 40);
  // Had the phone moved on too, the player chooses; an upload over a stale revision is refused.
  phone.profile.freeGears = 5;
  assert.equal(syncPlan(phone, phoneLink, remote), 'ask');
  await assert.rejects(pushSync(key, encodeSave(phone), phoneLink.rev, viaWorker(env), ''), error => error.reason === 'conflict');
  // Settings alone are not progress.
  const settled = { ...pcLink, mark: progressMark(pc.s) }; pc.s.profile.settings.sound = !pc.s.profile.settings.sound;
  assert.equal(progressMark(pc.s), settled.mark);
  await assert.rejects(pullSync('AAAAAAAAAAAAAAAA', viaWorker(env), ''), error => error.reason === 'unlinked');
});

test('the sync link is kept apart from the save and survives a broken entry', () => {
  const m = new Map(), storage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
  assert.equal(readLink(storage), null);
  writeLink(storage, { key: 'K'.repeat(16), rev: 3, mark: 'x' });
  assert.equal(readLink(storage).rev, 3);
  m.set(SYNC_STORE_KEY, '{broken'); assert.equal(readLink(storage), null);
  writeLink(storage, null); assert.equal(m.has(SYNC_STORE_KEY), false);
});
