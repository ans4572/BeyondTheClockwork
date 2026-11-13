// Keeps the game's pictures, sounds and fonts on the device (2026-11-13), so a phone whose browser cache was cleared
// still opens without fetching about 60 MB again. Only files under /art/ with a picture, sound or font ending are kept,
// and each is served from the device first: they never change under the same name (redrawn art gets a new file name,
// atlas pages carry their contents' hash). Pages, code, data and every .json go to the network as before, untouched.
// main.js registers this file on the published site only (not on the local dev server, where art changes in place).
//
// To switch it off for everyone: deploy this file with KILL = true. Each device then empties the store and lets go.
const KILL = false;
const STORE = 'btc-art-v1';
const KEPT = /^\/art\/.+\.(webp|png|jpe?g|ogg|mp3|m4a|woff2)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Older stores (a future btc-art-v2 would drop v1) are removed.
  for (const name of await caches.keys()) if (KILL || (name.startsWith('btc-art-') && name !== STORE)) await caches.delete(name);
  if (KILL) { await self.registration.unregister(); return; }
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (KILL || request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !KEPT.test(url.pathname)) return;
  event.respondWith((async () => {
    const store = await caches.open(STORE);
    // One entry per file whatever the request's mode (a picture tag, a fetch, a font), so a file fetched early is found later.
    const key = url.origin + url.pathname, kept = await store.match(key);
    if (kept) return kept;
    const response = await fetch(request);
    if (response.ok && response.status === 200 && response.type === 'basic') event.waitUntil(store.put(key, response.clone()).catch(() => {}));
    return response;
  })());
});
