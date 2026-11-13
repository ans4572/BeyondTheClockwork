import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { warmCache, guessBytes, ART_STORE, pruneArt, saveData } from '../src/render/warm-cache.js';

// The loading card waits for warmCache and shows its percentage (2026-11-13).
const fakeFetch = sizes => async file => {
  const bytes = sizes[file]; if (bytes === undefined) return { ok: false };
  let sent = false;
  return { ok: true, headers: { get: () => String(bytes) }, body: { getReader: () => ({ read: async () => (sent ? { done: true } : (sent = true, { done: false, value: new Uint8Array(bytes) })) }) } };
};

test('warmCache fetches each file once in order and reports a percentage that only rises to 100%', async () => {
  const asked = [], sizes = { 'art/a.png': 1000, 'art/audio/bgm/song.ogg': 900000, 'art/b.webp': 5000 }, seen = [];
  const was = globalThis.fetch;
  globalThis.fetch = async (file, options) => { asked.push([file, options.priority]); return fakeFetch(sizes)(file); };
  try {
    const fetched = await warmCache(['/art/a.png', '/art/a.png', '/art/audio/bgm/song.ogg', '/art/missing.png', null, '/art/b.webp'], { lanes: 1, skip: () => false, onProgress: f => seen.push(f) });
    assert.equal(fetched, 3);
    assert.deepEqual(asked.map(([file]) => file), ['art/a.png', 'art/audio/bgm/song.ogg', 'art/missing.png', 'art/b.webp']);
    assert.ok(asked.every(([, priority]) => priority === 'low'));
    assert.ok(seen.every((f, i) => i === 0 || f >= seen[i - 1]), 'never goes back');
    assert.equal(seen.at(-1), 1);
  } finally { globalThis.fetch = was; }
});

test('a phone that saves data waits for nothing', async () => {
  let asked = 0, last = 0; const was = globalThis.fetch; globalThis.fetch = async () => { asked++; return { ok: false }; };
  try { assert.equal(await warmCache(['/art/a.png'], { skip: () => true, onProgress: f => { last = f; } }), 0); assert.equal(asked, 0); assert.equal(last, 1); }
  finally { globalThis.fetch = was; }
});

test('the size guesses weigh a song above a map above an atlas page above an icon', () => {
  assert.ok(guessBytes('art/audio/bgm/title.ogg') > guessBytes('art/chapters/x/background-q92.webp'));
  assert.ok(guessBytes('art/chapters/x/background-q92.webp') > guessBytes('art/atlases/f2-first-0-ab.webp'));
  assert.ok(guessBytes('art/atlases/f2-first-0-ab.webp') > guessBytes('art/ui/icons/px/coin.png'));
});

test('the page looks in the same device store sw.js fills', async () => {
  assert.match(await readFile('sw.js', 'utf8'), new RegExp(`const STORE = '${ART_STORE}';`));
});

test('pruneArt removes month-old files the game no longer uses and keeps the rest', async () => {
  const day = 24 * 60 * 60 * 1000, now = Date.parse('2026-12-20T00:00:00Z'), old = new Date(now - 40 * day).toUTCString(), fresh = new Date(now - 3 * day).toUTCString();
  const stored = new Map([
    ['/art/atlases/mobs-1-0-old.webp', old], ['/art/atlases/mobs-1-0-new.webp', old], ['/art/ui/ending.png', old],
    ['/art/fonts/Galmuri11-sub-v1.woff2', old], ['/art/chapters/x/background-v2.webp', fresh], ['/art/no-date.png', '']
  ].map(([path, date]) => [`http://game.test${path}`, date]));
  const store = { keys: async () => [...stored.keys()].map(url => ({ url })), match: async request => ({ headers: { get: () => stored.get(request.url) } }), delete: async request => stored.delete(request.url) };
  const wasCaches = globalThis.caches, wasLocation = globalThis.location;
  globalThis.caches = { open: async () => store }; globalThis.location = { href: 'http://game.test/' };
  try {
    const wanted = ['/art/atlases/mobs-1-0-new.webp', ...Array.from({ length: 60 }, (_, i) => `/art/x/${i}.png`)];
    assert.equal(await pruneArt(wanted.slice(0, 10), { now, loaded: [] }), 0, 'a short list removes nothing');
    assert.equal(await pruneArt(wanted, { now, loaded: ['http://game.test/art/ui/ending.png?v=2'] }), 1);
    assert.deepEqual([...stored.keys()].map(url => new URL(url).pathname), ['/art/atlases/mobs-1-0-new.webp', '/art/ui/ending.png', '/art/fonts/Galmuri11-sub-v1.woff2', '/art/chapters/x/background-v2.webp', '/art/no-date.png']);
  } finally { globalThis.caches = wasCaches; globalThis.location = wasLocation; }
});

test('only saving data or 2G skips the download; 3G and faster get everything', () => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const on = connection => Object.defineProperty(globalThis, 'navigator', { value: { connection }, configurable: true });
  try {
    for (const [connection, skipped] of [[{ effectiveType: '3g' }, false], [{ effectiveType: '4g' }, false], [undefined, false], [{ effectiveType: '2g' }, true], [{ effectiveType: 'slow-2g' }, true], [{ effectiveType: '4g', saveData: true }, true]]) {
      on(connection); assert.equal(saveData(), skipped, JSON.stringify(connection));
    }
  } finally { if (was) Object.defineProperty(globalThis, 'navigator', was); else delete globalThis.navigator; }
});
