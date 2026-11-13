import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// sw.js (2026-11-13) keeps only art files on the device; pages, code and every .json must always come from the network,
// or a deploy would not reach a returning player.
const source = await readFile('sw.js', 'utf8');
const kept = new RegExp(source.match(/const KEPT = \/(.+)\/i;/)[1], 'i');

test('the service worker keeps pictures, sounds and fonts under /art/ only', () => {
  for (const path of ['/art/atlases/f2-first-0-abc.webp', '/art/chapters/1-smile-street/maps/00-scrapyard/background-q92.webp', '/art/audio/bgm/title.ogg', '/art/fonts/Galmuri11-sub-v1.woff2', '/art/ui/icons/px/coin.png']) assert.ok(kept.test(path), path);
  for (const path of ['/art/atlases/index.json', '/art/animations/player/game-clips.json', '/src/main.js', '/src/data/maps.json', '/index.html', '/', '/sw.js', '/api/stats', '/art/audio/CREDITS.md']) assert.ok(!kept.test(path), path);
});

/**
 * Runs sw.js in a bare context with a device store and a network that `net(url)` answers. `respond(path)` sends one
 * request from the page and resolves with what the worker answered (undefined when it leaves the request alone).
 */
function worker(net) {
  const handlers = {}, store = new Map(), asked = [];
  const context = vm.createContext({
    self: { addEventListener: (type, fn) => { handlers[type] = fn; }, location: { origin: 'https://game.example' } },
    caches: { open: async () => ({ match: async key => store.get(key)?.clone(), put: async (key, response) => { store.set(key, response); } }), keys: async () => [] },
    fetch: async (target, options) => { const url = typeof target === 'string' ? target : target.url; asked.push(url); return net(url, options); },
    Headers, Response, AbortController, URL, setTimeout, clearTimeout
  });
  vm.runInContext(source, context);
  const respond = async (path, init = {}) => {
    let answer, waits = [];
    handlers.fetch({ request: new Request(`https://game.example${path}`, init), respondWith: promise => { answer = promise; }, waitUntil: promise => waits.push(promise) });
    const response = await answer;
    await Promise.all(waits);
    return response;
  };
  return { respond, store, asked };
}
const MIRROR = 'https://ans4572.github.io/BeyondTheClockwork';

test('art not on the device comes from the GitHub Pages copy and is kept as this site\'s own', async () => {
  const { respond, store, asked } = worker(url => new Response('pixels', { headers: { 'content-type': 'image/webp', 'content-length': '6' } }));
  const response = await respond('/art/atlases/f2-first-0-abc.webp');
  assert.deepEqual(asked, [`${MIRROR}/art/atlases/f2-first-0-abc.webp`]);
  assert.equal(await response.text(), 'pixels');
  assert.equal(response.headers.get('content-type'), 'image/webp');
  const kept = store.get('https://game.example/art/atlases/f2-first-0-abc.webp');
  assert.ok(kept, 'stored under this site\'s address');
  assert.ok(Date.parse(kept.headers.get('date')) > 0, 'with a date, so pruneArt can age it');
  // The next request is answered from the device.
  asked.length = 0;
  assert.equal(await (await respond('/art/atlases/f2-first-0-abc.webp')).text(), 'pixels');
  assert.deepEqual(asked, []);
});

test('a file the copy lacks or fails on comes from this site instead', async () => {
  for (const mirror of [() => new Response('', { status: 404 }), () => { throw new TypeError('offline'); }]) {
    const { respond, asked } = worker(url => (url.startsWith(MIRROR) ? mirror() : new Response('from site')));
    assert.equal(await (await respond('/art/audio/bgm/title.ogg')).text(), 'from site');
    assert.deepEqual(asked, [`${MIRROR}/art/audio/bgm/title.ogg`, 'https://game.example/art/audio/bgm/title.ogg']);
  }
});

test('code, data, pages and ranged sound requests never go through the copy', async () => {
  const { respond, asked } = worker(() => new Response('x'));
  for (const path of ['/build/main-ABC.js', '/src/main.js', '/art/atlases/index.json', '/', '/api/stats']) assert.equal(await respond(path), undefined, path);
  assert.equal(await respond('/art/audio/bgm/title.ogg', { headers: { range: 'bytes=0-' } }), undefined);
  assert.deepEqual(asked, []);
});

test('the service worker is on, and checked on every visit so it can be switched off', async () => {
  assert.match(source, /const KILL = false;/);
  const headers = await readFile('_headers', 'utf8');
  assert.match(headers, /\/sw\.js\r?\n\s+Cache-Control: public, max-age=0, must-revalidate/);
});
