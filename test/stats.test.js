import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { validateData } from '../src/engine/data.js';
import { cleanEvent, comboKey, deviceProfile, koreanDay, ELEMENT_IDS } from '../src/engine/stats.js';
import { record, summary } from '../worker/stats.js';
import { api } from '../worker/index.js';
import { statsReporter, deviceId, DEVICE_STORE_KEY } from '../src/ui/stats-report.js';

const data = validateData(Object.fromEntries(await Promise.all(['combat', 'progression', 'slice'].map(async name => [name, JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))]))));

/** Cloudflare D1 over Node's own SQLite: prepare/bind/run/all/first and batch, enough for the worker. */
function d1() {
  const db = new DatabaseSync(':memory:');
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args).map(row => ({ ...row })) }),
    first: async () => { const row = db.prepare(sql).get(...args); return row ? { ...row } : null; }
  });
  return { prepare: sql => statement(sql), batch: async list => { const out = []; for (const s of list) out.push(await s.all()); return out; } };
}
const storage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const DAY = 86400000, NOW = Date.parse('2026-11-05T03:00:00Z');
const phone = 'phone0000000000a', pc = 'desktop000000000b';

test('the element list the statistics accept is the game’s own', () => {
  assert.deepEqual(ELEMENT_IDS, data.slice.elements);
  assert.equal(comboKey(['ice', 'fire']), 'fire+ice');
  assert.equal(comboKey([]), '');
  assert.equal(comboKey(['fire', 'fire']), null);
  assert.equal(comboKey(['earth']), null);
});

test('a device is described in coarse words: an iPad on the desktop site is still an iPad', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const galaxy = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
  const kakao = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36 KAKAOTALK 10.8.0';
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
  assert.deepEqual(deviceProfile({ userAgent: iphone, maxTouchPoints: 5 }, { width: 390, height: 844 }), { form: 'phone', os: 'ios', browser: 'safari' });
  assert.deepEqual(deviceProfile({ userAgent: ipad, maxTouchPoints: 5 }, { width: 820, height: 1180 }), { form: 'tablet', os: 'ios', browser: 'safari' });
  assert.deepEqual(deviceProfile({ userAgent: ipad, maxTouchPoints: 0 }, { width: 1440, height: 900 }), { form: 'desktop', os: 'mac', browser: 'safari' });
  assert.deepEqual(deviceProfile({ userAgent: galaxy, maxTouchPoints: 5 }, { width: 384, height: 832 }), { form: 'phone', os: 'android', browser: 'samsung' });
  assert.equal(deviceProfile({ userAgent: kakao }).browser, 'inapp');
  assert.deepEqual(deviceProfile({ userAgent: windows, maxTouchPoints: 10 }, { width: 1920, height: 1080 }), { form: 'desktop', os: 'windows', browser: 'edge' });
});

test('only well-formed events are kept, and nothing beyond their known fields', () => {
  assert.deepEqual(cleanEvent({ device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari', installed: true, name: 'x' }), { kind: 'open', device: phone, form: 'phone', os: 'ios', browser: 'safari', installed: true });
  assert.equal(cleanEvent({ device: 'short', kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }), null);
  assert.equal(cleanEvent({ device: phone, kind: 'open', form: 'fridge', os: 'ios', browser: 'safari' }), null);
  assert.equal(cleanEvent({ device: phone, kind: 'runEnd', run: 'run-1-5', elements: ['fire'], reason: 'clear', node: 0, seconds: 10 }), null);
  assert.equal(cleanEvent({ device: phone, kind: 'runStart', run: "run-1-5'; DROP", elements: [] }), null);
  assert.equal(cleanEvent({ device: phone, kind: 'hack' }), null);
});

test('the game tells the reporter when an expedition sets out and comes back, with the element pair', () => {
  const game = new Game(data), heard = [];
  game.onRun = (kind, fields) => heard.push({ kind, ...fields });
  Object.assign(game.s.profile, { registered: true, ownedElements: ['fire', 'wind'], loadout: ['wind', 'fire'] }); game.s.mode = 'hub';
  game.startRun(77);
  game.returnToHub('defeat');
  assert.deepEqual(heard.map(e => e.kind), ['runStart', 'runEnd']);
  assert.equal(heard[0].run, heard[1].run);
  assert.deepEqual(heard[1], { kind: 'runEnd', run: heard[0].run, difficulty: 'normal', chapter: 'smile-street', elements: ['wind', 'fire'], reason: 'defeat', node: 1, seconds: 0 });
  assert.ok(heard.every(e => cleanEvent({ device: phone, ...e })), 'every event the game makes passes the worker');
});

test('the admin summary counts opens, devices, runs and element pairs over the chosen days', async () => {
  const db = d1(), at = days => NOW - days * DAY;
  await record(db, { device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }, at(40));
  await record(db, { device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }, at(1));
  await record(db, { device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }, at(0));
  await record(db, { device: pc, kind: 'open', form: 'desktop', os: 'windows', browser: 'chrome' }, at(0));
  await record(db, { device: phone, kind: 'runStart', run: 'run-1-1', elements: ['ice', 'fire'] }, at(1));
  await record(db, { device: phone, kind: 'runEnd', run: 'run-1-1', elements: ['ice', 'fire'], reason: 'defeat', node: 4, seconds: 300 }, at(1));
  await record(db, { device: phone, kind: 'runStart', run: 'run-2-2', elements: ['fire', 'ice'] }, at(0));
  await record(db, { device: phone, kind: 'runEnd', run: 'run-2-2', elements: ['fire', 'ice'], reason: 'clear', node: 12, seconds: 1500 }, at(0));
  await record(db, { device: pc, kind: 'runStart', run: 'run-1-9', elements: ['wind'] }, at(0));
  await record(db, { device: pc, kind: 'runEnd', run: 'run-1-9', elements: ['wind'], reason: 'clear', node: 12, seconds: 900 }, at(0));
  await record(db, { device: pc, kind: 'runEnd', run: 'run-1-9', elements: ['wind'], reason: 'clear', node: 12, seconds: 900 }, at(0));
  await record(db, { device: pc, kind: 'runStart', run: 'run-2-3', elements: [] }, at(0));

  const week = await summary(db, 7, NOW);
  assert.equal(week.range.to, koreanDay(NOW));
  assert.equal(week.daily.length, 7);
  assert.deepEqual(week.totals, { devices: 2, installed: 0, newDevices: 1, activeDevices: 2, sessions: 3, runs: 4, clears: 2, defeats: 1, abandons: 0, unfinished: 1, averageNode: 9.3, averageSeconds: 900 });
  assert.deepEqual(week.combos.find(c => c.combo === 'fire+ice'), { combo: 'fire+ice', runs: 2, clears: 1, defeats: 1, abandons: 0, averageNode: 8 });
  assert.equal(week.combos.find(c => c.combo === '').runs, 1, 'a wrench-only run is its own combo');
  assert.deepEqual(week.devices.form.map(f => [f.name, f.devices, f.sessions]), [['desktop', 1, 1], ['phone', 1, 2]].sort((a, b) => b[1] - a[1] || b[2] - a[2]));
  assert.deepEqual(week.depth, [{ node: 4, runs: 1, clears: 0 }, { node: 12, runs: 2, clears: 2 }]);
  assert.equal(week.daily.at(-1).sessions, 2);
  assert.equal(week.recent.length, 4);

  const ever = await summary(db, 0, NOW);
  assert.equal(ever.totals.sessions, 4);
  assert.equal(ever.totals.newDevices, 2);
  assert.equal(ever.daily[0].day, koreanDay(at(40)));
});

test('the stats routes: events need no token, the summary needs the right one', async () => {
  const token = 'a-long-admin-token-for-tests-only', env = { STATS: d1(), ADMIN_TOKEN: token };
  const call = (path, options = {}) => { const request = new Request(new URL(path, 'https://w.example'), options); return api(request, new URL(request.url), env); };
  assert.equal((await call('/api/stats', { method: 'POST', body: JSON.stringify({ device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }) })).status, 204);
  assert.equal((await call('/api/stats', { method: 'POST', body: '{"device":"x"}' })).status, 400);
  assert.equal((await call('/api/stats', { method: 'POST', body: 'x'.repeat(5000) })).status, 400);
  assert.equal((await call('/api/admin/stats')).status, 401);
  assert.equal((await call('/api/admin/stats', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const answer = await call('/api/admin/stats?days=7', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(answer.status, 200);
  assert.equal((await answer.json()).totals.sessions, 1);
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  const short = { STATS: d1(), ADMIN_TOKEN: 'short' }, request = new Request('https://w.example/api/admin/stats', { headers: { Authorization: 'Bearer short' } });
  assert.equal((await api(request, new URL(request.url), short)).status, 503, 'a short token keeps the page shut');
  const none = new Request('https://w.example/api/stats', { method: 'POST', body: '{}' });
  assert.equal((await api(none, new URL(none.url), {})).status, 503);
});

test('the reporter keeps one device id, sends nothing from a local server, and drops malformed events', () => {
  const store = storage(), sent = [];
  const id = deviceId(store);
  assert.match(id, /^[a-z0-9]{20}$/);
  assert.equal(deviceId(store), id);
  assert.equal(store.getItem(DEVICE_STORE_KEY), id);
  const local = statsReporter({ storage: store, hostname: '127.0.0.1', send: (...a) => sent.push(a) });
  assert.equal(local('open', { form: 'phone', os: 'ios', browser: 'safari' }), false);
  const live = statsReporter({ storage: store, hostname: 'ans4572.github.io', send: (url, text) => { sent.push([url, JSON.parse(text)]); return true; } });
  assert.ok(live('runStart', { run: 'run-1-1', elements: ['fire'] }));
  assert.equal(live('runStart', { run: 'bad', elements: ['fire'] }), false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 'https://beyondtheclockwork.mungaeng.workers.dev/api/stats');
  assert.equal(sent[0][1].device, id);
});

test('a gift sent from the admin page arrives on the next check-in, pays once, and can be taken back before then', async () => {
  const token = 'a-long-admin-token-for-tests-only', env = { STATS: d1(), ADMIN_TOKEN: token };
  const call = (path, options = {}) => { const request = new Request(new URL(path, 'https://w.example'), options); return api(request, new URL(request.url), env); };
  const admin = (path, options = {}) => call(path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const ping = async (fields = {}) => (await call('/api/stats', { method: 'POST', body: JSON.stringify({ device: phone, kind: 'ping', where: 'hub', node: 0, gears: 40, playSeconds: 600, ...fields }) })).json();
  await call('/api/stats', { method: 'POST', body: JSON.stringify({ device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }) });
  assert.deepEqual(await ping(), { mail: [] });

  assert.equal((await admin('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: 'nobody0000000000', gears: 5 }) })).status, 400, 'an unknown player gets nothing');
  assert.equal((await admin('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: phone, gears: 0 }) })).status, 400);
  assert.equal((await call('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: phone, gears: 5 }) })).status, 401, 'no token, no gift');
  const kept = await (await admin('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: phone, gears: 300, note: '  점검 보상\n감사합니다 ' }) })).json();
  const dropped = await (await admin('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: phone, gears: 9 }) })).json();
  assert.equal(kept.note, '점검 보상 감사합니다');
  assert.equal((await admin(`/api/admin/gifts/${dropped.id}`, { method: 'DELETE' })).status, 200);

  const game = new Game(data), before = game.s.profile.freeGears;
  const { mail } = await ping({ where: 'run', node: 4 });
  assert.deepEqual(mail.map(g => g.gears), [300], 'a gift taken back never arrives');
  const ids = game.receiveGifts(mail);
  assert.equal(game.s.profile.freeGears, before + 300);
  assert.match(game.s.notices.at(-1).text, /점검 보상 감사합니다 · 자유 톱니 300개/);
  assert.deepEqual(game.receiveGifts(mail), ids, 'the same gift again pays nothing but is still reported as taken');
  assert.equal(game.s.profile.freeGears, before + 300);
  assert.equal((await call('/api/mail/claim', { method: 'POST', body: JSON.stringify({ device: phone, ids }) })).status, 200);
  assert.deepEqual((await ping()).mail, []);
  assert.equal((await admin(`/api/admin/gifts/${kept.id}`, { method: 'DELETE' })).status, 409, 'a gift already taken cannot be taken back');

  const list = await (await admin('/api/admin/users')).json();
  assert.deepEqual(list.counts, { everyone: 1, online: 1, today: 1, pending: 0 });
  const [row] = list.users;
  assert.equal(row.id, phone); assert.equal(row.where_now, 'hub'); assert.equal(row.gears, 40); assert.equal(row.given, 300); assert.equal(row.pending, 0);
  assert.equal(row.chapter_now, null, 'no chapter in town');
  await ping({ where: 'run', node: 4, chapter: 'silent-factory', difficulty: 'hard' });
  const away = (await (await admin('/api/admin/users')).json()).users[0];
  assert.equal(away.where_now, 'run'); assert.equal(away.node_now, 4); assert.equal(away.chapter_now, 'silent-factory', 'the expedition names its chapter (2026-11-11)'); assert.equal(away.difficulty_now, 'hard', 'and its difficulty');
  await ping();
  assert.equal((await (await admin('/api/admin/users/' + phone + '/memo', { method: 'POST', body: JSON.stringify({ memo: '테스트 폰' }) })).json()).memo, '테스트 폰');
  assert.equal((await (await admin('/api/admin/users?q=테스트')).json()).users.length, 1);
  assert.equal((await (await admin('/api/admin/users?q=zzz')).json()).users.length, 0);
  const detail = await (await admin('/api/admin/users/' + phone)).json();
  assert.equal(detail.user.memo, '테스트 폰');
  assert.deepEqual(detail.gifts.map(g => [g.gears, g.claimed_at !== null, g.cancelled_at !== null]), [[9, false, true], [300, true, false]]);
  assert.equal((await admin('/api/admin/users/nobody0000000000')).status, 404);
});

test('the mailbox checks in with plain-text bodies and stays silent on a local server', async () => {
  const { mailbox } = await import('../src/ui/stats-report.js');
  assert.equal(mailbox({ storage: storage(), hostname: '127.0.0.1' }), null);
  const sent = [], box = mailbox({ storage: storage(), hostname: 'ans4572.github.io', fetchImpl: async (url, options) => { sent.push([url, options]); return new Response(JSON.stringify({ mail: [{ id: 3, gears: 10, note: '' }] }), { status: 200 }); } });
  assert.deepEqual(await box.ping({ where: 'hub', node: 0, gears: 1, playSeconds: 2 }), [{ id: 3, gears: 10, note: '' }]);
  assert.deepEqual(await box.ping({ where: 'moon', node: 0, gears: 1, playSeconds: 2 }), [], 'a malformed check-in is not sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].headers, undefined, 'no custom headers, so no preflight');
  await box.claim([3]);
  assert.equal(sent[1][0], 'https://beyondtheclockwork.mungaeng.workers.dev/api/mail/claim');
});

test('expeditions are counted per difficulty, and the summary can be narrowed to one', async () => {
  const db = d1();
  // A database made before difficulties: the runs table has no difficulty column until the worker adds it.
  await db.prepare(`CREATE TABLE runs (device TEXT, run TEXT, day TEXT, combo TEXT, started_at INTEGER, ended_at INTEGER, reason TEXT, node INTEGER, seconds INTEGER, PRIMARY KEY (device, run))`).run();
  await db.prepare(`INSERT INTO runs (device, run, day, combo, ended_at, reason, node, seconds) VALUES ('${phone}', 'run-0-1', '${koreanDay(NOW)}', '', 1, 'defeat', 2, 60)`).run();
  const go = async (run, difficulty, reason, node) => {
    await record(db, { device: phone, kind: 'runStart', run, elements: ['fire'], difficulty }, NOW);
    if (reason) await record(db, { device: phone, kind: 'runEnd', run, elements: ['fire'], difficulty, reason, node, seconds: 100 }, NOW);
  };
  await go('run-1-1', 'easy', 'clear', 12); await go('run-2-1', 'easy', 'defeat', 5); await go('run-3-1', 'hard', 'defeat', 3); await go('run-4-1', 'normal');
  const all = await summary(db, 7, NOW);
  assert.deepEqual(all.difficulties.map(d => [d.difficulty, d.runs, d.clears, d.unfinished]), [['easy', 2, 1, 0], ['normal', 1, 0, 1], ['hard', 1, 0, 0], ['legacy', 1, 0, 0]]);
  assert.equal(all.totals.runs, 5);
  const easy = await summary(db, 7, NOW, 'easy');
  assert.equal(easy.range.difficulty, 'easy');
  assert.deepEqual([easy.totals.runs, easy.totals.clears, easy.combos[0].runs, easy.recent.length], [2, 1, 2, 2]);
  assert.ok(easy.recent.every(r => r.difficulty === 'easy'));
  assert.equal((await summary(db, 7, NOW, 'nonsense')).totals.runs, 5, 'an unknown filter shows everything');
});

test('the difficulty cards split by chapter; a run from before chapters were reported counts as chapter 1', async () => {
  const db = d1();
  await record(db, { device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }, NOW);
  const go = async (run, difficulty, chapter, reason) => {
    await record(db, { device: phone, kind: 'runStart', run, elements: ['fire'], difficulty, chapter }, NOW);
    await record(db, { device: phone, kind: 'runEnd', run, elements: ['fire'], difficulty, chapter, reason, node: 3, seconds: 100 }, NOW);
  };
  await go('run-1-1', 'easy', 'smile-street', 'clear'); await go('run-2-1', 'easy', 'silent-factory', 'defeat');
  await go('run-3-1', 'hard', 'silent-factory', 'defeat'); await go('run-4-1', 'normal', undefined, 'clear');
  const { difficulties, difficultiesByChapter: by } = await summary(db, 7, NOW);
  assert.deepEqual(difficulties.map(d => [d.difficulty, d.runs]), [['easy', 2], ['normal', 1], ['hard', 1]], 'every chapter together, as before');
  assert.deepEqual(by['smile-street'].map(d => [d.difficulty, d.runs, d.clears]), [['easy', 1, 1], ['normal', 1, 1], ['hard', 0, 0]]);
  assert.deepEqual(by['silent-factory'].map(d => [d.difficulty, d.runs, d.defeats]), [['easy', 1, 1], ['normal', 0, 0], ['hard', 1, 1]]);
  assert.equal(cleanEvent({ device: phone, kind: 'runStart', run: 'run-9-9', elements: ['fire'], chapter: "x'; DROP" }).chapter, null, 'a chapter that is not an id is dropped');
});

test('the admin page makes a transfer code from a player’s newest uploaded save, and only with the token (2026-11-12)', async () => {
  const { startSync, pullSync, pushSync, fetchSave } = await import('../src/ui/device-transfer.js');
  const { encodeSave, decodeSave } = await import('../src/engine/storage.js');
  const m = new Map(), TRANSFER = { get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); } };
  const token = 'a-long-admin-token-for-tests-only', env = { STATS: d1(), TRANSFER, ADMIN_TOKEN: token };
  const call = (path, options = {}) => { const request = new Request(new URL(path, 'https://w.example'), { ...options, headers: { 'CF-Connecting-IP': '1.2.3.4', ...options.headers } }); return api(request, new URL(request.url), env); };
  const game = async (url, options = {}) => call(url, options);
  const admin = (path, options = {}) => call(path, { ...options, headers: { Authorization: `Bearer ${token}` } });
  await call('/api/stats', { method: 'POST', body: JSON.stringify({ device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' }) });
  await call('/api/stats', { method: 'POST', body: JSON.stringify({ device: pc, kind: 'open', form: 'desktop', os: 'windows', browser: 'chrome' }) });
  // Nothing uploaded yet: the page says so, and no code is made.
  assert.equal((await (await admin(`/api/admin/users/${phone}`)).json()).saved, null);
  assert.equal((await admin(`/api/admin/users/${phone}/transfer`, { method: 'POST' })).status, 404);
  // The phone starts syncing (naming its device); the PC syncs from an older game that names none, then opens the new one.
  const g = new Game(data); g.s.profile.registered = true; g.s.mode = 'hub'; g.s.profile.freeGears = 10;
  const { key, rev } = await startSync(encodeSave(g.s), game, '', phone);
  const other = await startSync(encodeSave(g.s), game, '');
  assert.equal((await admin(`/api/admin/users/${pc}/transfer`, { method: 'POST' })).status, 404, 'an upload without a device is not linked');
  await pullSync(other.key, game, '', pc);
  assert.equal((await admin(`/api/admin/users/${pc}/transfer`, { method: 'POST' })).status, 200, 'opening the game links it');
  // Each return to the village replaces the save: the code carries the newest one, and the sync key with it.
  g.s.profile.freeGears = 77; await pushSync(key, encodeSave(g.s), rev, game, '', phone);
  const detail = await (await admin(`/api/admin/users/${phone}`)).json();
  assert.equal(detail.saved.rev, 2); assert.equal(detail.saved.save, undefined, 'the page never sees the save itself');
  assert.equal((await call(`/api/admin/users/${phone}/transfer`, { method: 'POST' })).status, 401, 'no token, no code');
  const made = await (await admin(`/api/admin/users/${phone}/transfer`, { method: 'POST' })).json();
  assert.ok(Date.parse(made.expiresAt) - Date.now() > 23 * 3600 * 1000, 'a day to pass it on');
  const got = await fetchSave(made.code, game, '');
  assert.equal(decodeSave(got.save, data).profile.freeGears, 77);
  assert.equal(got.syncKey, key);
  assert.equal([...m.keys()].filter(k => k.startsWith('sync:')).length, 2, 'one save per sync place, nothing piled up');
});

/** Workers KV as a Map, with the list() the save search pages through. */
function kvStore() {
  const m = new Map();
  return { m, get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); },
    list: async ({ prefix = '', cursor } = {}) => { const names = [...m.keys()].filter(k => k.startsWith(prefix)).sort(), from = Number(cursor || 0), keys = names.slice(from, from + 2).map(name => ({ name })); return { keys, list_complete: from + 2 >= names.length, cursor: String(from + 2) }; } };
}
function adminWorld() {
  const token = 'a-long-admin-token-for-tests-only', env = { STATS: d1(), TRANSFER: kvStore(), ADMIN_TOKEN: token };
  const call = (path, options = {}) => { const request = new Request(new URL(path, 'https://w.example'), options); return api(request, new URL(request.url), env); };
  return { env, call, game: async (url, options = {}) => call(url, options), admin: (path, options = {}) => call(path, { ...options, headers: { Authorization: `Bearer ${token}` } }), event: body => call('/api/stats', { method: 'POST', body: JSON.stringify(body) }) };
}

test('a device from before the game named itself is found by its check-ins, and its code links a new device to the same sync (2026-11-12)', async () => {
  const { startSync, pullSync, pushSync, fetchSave } = await import('../src/ui/device-transfer.js');
  const { encodeSave, decodeSave } = await import('../src/engine/storage.js');
  const { progressMark, syncPlan } = await import('../src/engine/sync.js');
  const { call, game, admin, event } = adminWorld();
  // Computer A, yesterday, on the old game: it checks in and uploads to its sync place without naming itself.
  const a = new Game(data); a.s.profile.registered = true; a.s.mode = 'hub'; Object.assign(a.s.profile, { nickname: '모모', freeGears: 40, playSeconds: 5000 });
  await event({ device: pc, kind: 'open', form: 'desktop', os: 'windows', browser: 'chrome' });
  await event({ device: pc, kind: 'ping', name: '모모', where: 'hub', node: 0, gears: 40, playSeconds: 5000 });
  const aLink = { ...(await startSync(encodeSave(a.s), game, '')), mark: progressMark(a.s) };
  // Other players' saves are on the server too.
  for (const [name, gears] of [['모모', 900], ['다른', 40], ['누구', 7]]) { const g = new Game(data); g.s.profile.registered = true; Object.assign(g.s.profile, { nickname: name, freeGears: gears, playSeconds: 99999 }); await startSync(encodeSave(g.s), game, ''); }
  assert.equal((await (await admin(`/api/admin/users/${pc}`)).json()).saved, null, 'not linked yet');
  assert.equal((await call(`/api/admin/users/${pc}/saves`)).status, 401, 'no token, no search');
  const { saves } = await (await admin(`/api/admin/users/${pc}/saves`)).json();
  assert.equal(saves.length, 1, 'only the save that matches on two signs or more');
  assert.deepEqual(saves[0].why.slice(0, 3), ['name', 'gears', 'play']); assert.equal(saves[0].freeGears, 40); assert.equal(saves[0].save, undefined, 'the page never gets the save');
  // The owner makes a code from it; computer B loads it and joins A's sync place.
  const made = await (await admin(`/api/admin/users/${pc}/transfer`, { method: 'POST', body: JSON.stringify({ ref: saves[0].ref }) })).json();
  const got = await fetchSave(made.code, game, '');
  assert.equal(got.syncKey, aLink.key); assert.equal(got.inherit, undefined, 'records stay unless asked');
  assert.ok((await (await admin(`/api/admin/users/${pc}`)).json()).saved, 'from now on the device is linked');
  // B plays on and uploads; back on A, the opening check takes B's progress.
  const b = decodeSave(got.save, data); b.profile.freeGears = 300;
  const remoteRev = (await pullSync(got.syncKey, game, '', phone)).rev;
  await pushSync(got.syncKey, encodeSave(b), remoteRev, game, '', phone);
  const remote = await pullSync(aLink.key, game, '', pc);
  assert.equal(syncPlan(a.s, aLink, remote), 'take');
  assert.equal(decodeSave(remote.save, data).profile.freeGears, 300);
});

test('a save rebuilt on the admin page loads in the game, held to the levels its chapters open (2026-11-12)', async () => {
  const { buildRestoreSave, restoreOptions, BOSS_BLUEPRINTS } = await import('../src/engine/restore-save.js');
  const { decodeSave } = await import('../src/engine/storage.js');
  const options = restoreOptions(data);
  assert.deepEqual(options.chapters.map(c => c.bosses.length), [2, 2]);
  const save = buildRestoreSave(data, { nickname: '복구', freeGears: 1234, stats: { maxHp: 30, attackDamage: 15 }, owned: ['fire', 'sound', 'water'], bosses: ['collectorRoco', 'captainBrass'], cleared: ['smile-street'], runs: 12, playSeconds: 3600 });
  const s = decodeSave(save, data);
  assert.equal(s.mode, 'hub'); assert.equal(s.profile.registered, true);
  assert.equal(s.profile.stats.maxHp, 20, 'chapter 2 open: twenty levels'); assert.equal(s.profile.stats.attackDamage, 15);
  assert.deepEqual(s.profile.loadout, ['fire', 'sound']); assert.deepEqual(s.profile.ownedElements, ['fire', 'sound', 'water']);
  assert.deepEqual(s.profile.blueprints, [BOSS_BLUEPRINTS.captainBrass]);
  assert.deepEqual(s.profile.cleared, ['smile-street']); assert.equal(s.profile.chapter, 2);
  assert.equal(s.profile.freeGears, 1234); assert.equal(s.profile.runs, 12);
  assert.equal(decodeSave(buildRestoreSave(data, { stats: { maxHp: 30 } }), data).profile.stats.maxHp, 10, 'nothing cleared: ten levels');
  // The record each boss leaves matches the one the game itself gives on its first defeat.
  const source = await readFile(new URL('../src/engine/game.js', import.meta.url), 'utf8');
  for (const [boss, record] of Object.entries(BOSS_BLUEPRINTS)) assert.ok(source.includes(`${boss}: '${record}'`), boss);
});

test('a code from the admin page can carry a pass: the device that loads it takes over the lost one’s records, once (2026-11-12)', async () => {
  const { fetchSave } = await import('../src/ui/device-transfer.js');
  const { buildRestoreSave } = await import('../src/engine/restore-save.js');
  const { handInPass, rememberPass, INHERIT_STORE_KEY } = await import('../src/ui/stats-report.js');
  const { call, game, admin, event } = adminWorld();
  // The lost phone: a hard clear, a memo and a gift it never took.
  await event({ device: phone, kind: 'open', form: 'phone', os: 'ios', browser: 'safari' });
  await event({ device: phone, kind: 'runStart', run: 'run-1-5', elements: ['fire', 'ice'], difficulty: 'hard' });
  await event({ device: phone, kind: 'runEnd', run: 'run-1-5', elements: ['fire', 'ice'], reason: 'clear', node: 12, seconds: 900, difficulty: 'hard' });
  await admin(`/api/admin/users/${phone}/memo`, { method: 'POST', body: JSON.stringify({ memo: '단골' }) });
  await admin('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: phone, gears: 50 }) });
  const save = buildRestoreSave(data, { nickname: '모모', freeGears: 40, owned: ['fire', 'ice'], cleared: ['smile-street'] });
  assert.equal((await call(`/api/admin/users/${phone}/restore`, { method: 'POST', body: JSON.stringify({ save }) })).status, 401);
  assert.equal((await admin(`/api/admin/users/${phone}/restore`, { method: 'POST', body: JSON.stringify({ save: '{"x":1}' }) })).status, 400);
  const made = await (await admin(`/api/admin/users/${phone}/restore`, { method: 'POST', body: JSON.stringify({ save, inherit: true }) })).json();
  const got = await fetchSave(made.code, game, '');
  assert.ok(got.inherit, 'the code carries the pass'); assert.equal(got.syncKey, undefined, 'a rebuilt save joins no sync');
  // The new PC loads it and hands the pass in (kept apart from the save until the server takes it).
  const m = new Map(), store = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  store.setItem(DEVICE_STORE_KEY, pc); rememberPass(store, got.inherit);
  assert.equal(await handInPass({ storage: store, hostname: 'example.com', fetchImpl: game, base: '' }), true);
  assert.equal(store.getItem(INHERIT_STORE_KEY), null, 'a pass the server took is dropped');
  const list = (await (await admin('/api/admin/users')).json()).users;
  assert.deepEqual(list.map(u => u.id), [pc], 'the old row is gone');
  assert.equal(list[0].memo, '단골'); assert.equal(list[0].runs, 1); assert.equal(list[0].clears, 1); assert.equal(list[0].pending, 1, 'the gift waits for the new device');
  assert.equal((await (await call(`/api/records?device=${pc}`)).json()).hard.me.clears, 1, 'the board’s own records follow');
  assert.equal((await call('/api/inherit', { method: 'POST', body: JSON.stringify({ device: pc, pass: got.inherit }) })).status, 404, 'the pass works once');
  assert.equal(await handInPass({ storage: store, hostname: 'localhost', fetchImpl: game, base: '' }), false, 'nothing kept, nothing sent');
});
