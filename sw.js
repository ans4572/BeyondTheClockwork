// Keeps the game's pictures, sounds and fonts on the device (2026-11-13), so a phone whose browser cache was cleared
// still opens without fetching about 60 MB again. Only files under /art/ with a picture, sound or font ending are kept,
// and each is served from the device first: they never change under the same name (redrawn art gets a new file name,
// atlas pages carry their contents' hash). Pages, code, data and every .json go to the network as before, untouched.
// main.js registers this file on the published site only (not on the local dev server, where art changes in place).
//
// A file not on the device yet is fetched from the copy on GitHub Pages (2026-11-14): from Korea Cloudflare answers from
// Los Angeles at 70-220 KB/s, GitHub Pages from Seoul at 2-4 MB/s. The same main is published to both. When the copy
// fails, is missing (a file pushed minutes ago that GitHub has not published yet) or has not answered within MIRROR_WAIT,
// the file comes from this site as before. The address bar, the code, the saves and the server stay on this site.
//
// To switch it off for everyone: deploy this file with KILL = true. Each device then empties the store and lets go.
// To stop using the copy only: set MIRROR = ''.
const KILL = false;
const STORE = 'btc-art-v1';
const KEPT = /^\/art\/.+\.(webp|png|jpe?g|ogg|mp3|m4a|woff2)$/i;
const MIRROR = 'https://ans4572.github.io/BeyondTheClockwork';
/** How long the copy may take to start answering before the file is asked of this site instead (ms). */
const MIRROR_WAIT = 6000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Older stores (a future btc-art-v2 would drop v1) are removed.
  for (const name of await caches.keys()) if (KILL || (name.startsWith('btc-art-') && name !== STORE)) await caches.delete(name);
  if (KILL) { await self.registration.unregister(); return; }
  await self.clients.claim();
})()));

/**
 * The file from the copy, as a response of this site's own (so a picture drawn on a canvas never taints it, and the
 * stored copy keeps a date for warm-cache.js pruneArt; a cross-site response would hide its Date header). Null when the
 * copy cannot give it.
 */
async function fromMirror(path) {
  if (!MIRROR) return null;
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), MIRROR_WAIT);
  try {
    const response = await fetch(MIRROR + path, { mode: 'cors', credentials: 'omit', signal: stop.signal });
    clearTimeout(timer);
    if (!response.ok || response.status !== 200 || !response.body) return null;
    const headers = new Headers({ date: new Date().toUTCString() });
    for (const name of ['content-type', 'content-length', 'last-modified']) if (response.headers.has(name)) headers.set(name, response.headers.get(name));
    return new Response(response.body, { status: 200, headers });
  } catch { clearTimeout(timer); return null; }
}

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
    const response = (url.origin !== new URL(MIRROR || self.location.origin).origin && await fromMirror(url.pathname)) || await fetch(request);
    if (response.ok && response.status === 200 && (response.type === 'basic' || response.type === 'default')) event.waitUntil(store.put(key, response.clone()).catch(() => {}));
    return response;
  })());
});
