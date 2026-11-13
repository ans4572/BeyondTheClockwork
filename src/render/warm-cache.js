import { assetUrl } from '../animation/sprite-library.js';

/**
 * A phone that asks to save data, or a slow connection, is not sent files it does not need yet (2026-11-12).
 * The places' paintings alone are about 26 MB.
 */
export const saveData = () => !!globalThis.navigator?.connection?.saveData || /(^|-)2g$|^3g$/.test(globalThis.navigator?.connection?.effectiveType || '');

/** The device store sw.js keeps the art in (the same name as there; test/service-worker.test.js checks). */
export const ART_STORE = 'btc-art-v1';

/**
 * A first guess at a file's size, so the loading card's percentage moves with the bytes rather than the file count
 * (a song weighs as much as a hundred icons). Each guess is replaced by the real size once the file starts arriving.
 */
export function guessBytes(file) {
  if (/\/bgm\/.+\.ogg$/.test(file)) return 1_500_000;
  if (/background[^/]*\.(webp|png|jpe?g)$/.test(file)) return 650_000;
  if (/\/atlases\//.test(file)) return 150_000;
  if (/\/world-map\/[^/]*island/.test(file)) return 350_000;
  return 12_000;
}

/**
 * Fetches files into the cache in the order given, `lanes` at a time and at low priority, without decoding them
 * (2026-11-13: everything a run can need, while the loading card turns; sw.js then keeps it on the device). A file
 * already in the device store is not fetched again. `onProgress(fraction)` follows the bytes, never going back.
 * Resolves with the number of files fetched once every one has arrived or failed.
 */
export async function warmCache(files, { lanes = 4, skip = saveData, onProgress = () => {}, store = ART_STORE } = {}) {
  const queue = [...new Set(files.filter(Boolean).map(assetUrl))];
  if (skip() || !queue.length) { onProgress(1); return 0; }
  const kept = await globalThis.caches?.open(store).catch(() => null);
  const size = new Map(queue.map(file => [file, guessBytes(file)])), got = new Map();
  let shown = 0, fetched = 0;
  const report = () => {
    let total = 0, done = 0;
    for (const [file, bytes] of size) { total += bytes; done += Math.min(bytes, got.get(file) || 0); }
    shown = Math.max(shown, total ? done / total : 1); onProgress(shown);
  };
  const finish = file => { got.set(file, size.get(file)); report(); };
  const lane = async () => {
    while (queue.length) {
      const file = queue.shift();
      try {
        if (kept && await kept.match(new URL(file, location.href).href)) { finish(file); continue; }
        const response = await fetch(file, { priority: 'low' });
        if (!response.ok) { finish(file); continue; }
        const length = Number(response.headers.get('content-length')); if (length > 0) { size.set(file, length); report(); }
        // Read to the end in pieces, so the whole file is stored and the percentage moves inside a long song.
        const reader = response.body?.getReader();
        if (!reader) await response.arrayBuffer();
        else for (let part; !(part = await reader.read()).done;) { got.set(file, (got.get(file) || 0) + part.value.byteLength); if (got.get(file) > size.get(file)) size.set(file, got.get(file)); report(); }
        fetched++;
      } catch { /* A file that fails is left for the game to fetch when it needs it. */ }
      finish(file);
    }
  };
  await Promise.all(Array.from({ length: lanes }, lane));
  onProgress(1);
  return fetched;
}

const MONTH = 30 * 24 * 60 * 60 * 1000;
/** The /art/ files this page has loaded so far (the browser's own record of its requests). */
const loadedArt = () => (globalThis.performance?.getEntriesByType?.('resource') || []).map(entry => entry.name).filter(name => name.includes('/art/'));

/**
 * Removes from the device store the files the game no longer uses (2026-11-13): a redrawn picture gets a new name, a
 * rebuilt atlas page a new hash, and the old copy would otherwise stay on each phone for good. A stored file is kept
 * when it is on the list the loading card fetches, when this page has loaded it, when it is a font, or when it was
 * stored less than a month ago (so a picture only some screens show, and that this visit has not reached yet, is not
 * thrown away and fetched again). Does nothing with a short list (the list failed to build). Resolves with the count.
 */
export async function pruneArt(wanted, { store = ART_STORE, olderThan = MONTH, now = Date.now(), loaded = loadedArt() } = {}) {
  if (wanted.length < 50) return 0;
  const kept = await globalThis.caches?.open(store).catch(() => null);
  if (!kept) return 0;
  const path = file => new URL(file, location.href).pathname, keep = new Set([...wanted, ...loaded].filter(Boolean).map(path));
  let removed = 0;
  for (const request of await kept.keys()) {
    const at = path(request.url);
    if (keep.has(at) || at.startsWith('/art/fonts/')) continue;
    const stored = Date.parse((await kept.match(request))?.headers.get('date') || '');
    if (now - stored > olderThan && await kept.delete(request)) removed++;
  }
  return removed;
}
