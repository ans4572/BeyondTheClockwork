import { placeOf, roomPlace, prepareClearance } from '../engine/map-geometry.js';
import { assetUrl } from '../animation/sprite-library.js';
import { DepthMask, computeDepth } from './depth-mask.js';

/**
 * Brings each place's art into the renderer in order of need, and lets go of places left behind.
 *
 * - The place underfoot and the one after it are fetched and decoded first (`bringPlaceForward`); the rest are only
 *   fetched into the browser's cache, one at a time and at low priority (`prefetchRest`).
 * - A map with a `pixelScale` is enlarged with hard pixel edges as it arrives (`sharpenedLater`).
 * - Each map's depth (what stands in front of a body) is worked out from its picture and mask, in a worker where the
 *   browser allows it (`buildDepth`).
 *
 * `firstFiles` are loaded with the first places (icons, effects, props); `canStart` holds everything back until the
 * title is drawn; `slots` is how many pictures load at once.
 */
export function createMapLoader({ data, game, renderer, firstFiles = [], canStart = () => true, slots = 3 }) {
  renderer.mapImages = new Map(); renderer.depthMasks = new Map();
  const villages = () => Object.values(data?.maps?.villages || {});
  const offscreen = (width, height) => Object.assign(document.createElement('canvas'), { width, height });
  const scaleOf = file => villages().find(village => village.background === file)?.pixelScale || 1;
  // Map paintings ship at their own pixel size (half the download) and are blown up here with hard pixel edges, so they
  // look exactly as the old pre-enlarged files did.
  const sharpened = (file, image) => {
    const scale = scaleOf(file);
    if (scale === 1) return image;
    const canvas = offscreen(image.width * scale, image.height * scale), c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false; c.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  // The same enlargement made by the browser off the main thread where it can (pixel-exact 'pixelated' resize).
  // Used only once a tiny test shows this browser really keeps the pixels square (some ignore 'pixelated' and blur).
  const pixelatedResize = (async () => {
    try {
      const probe = offscreen(2, 1), p = probe.getContext('2d'); p.fillStyle = '#000'; p.fillRect(0, 0, 1, 1); p.fillStyle = '#fff'; p.fillRect(1, 0, 1, 1);
      const bitmap = await createImageBitmap(probe, { resizeWidth: 8, resizeHeight: 1, resizeQuality: 'pixelated' }), check = offscreen(8, 1), c = check.getContext('2d', { willReadFrequently: true });
      c.drawImage(bitmap, 0, 0); const row = c.getImageData(0, 0, 8, 1).data; bitmap.close();
      return [0, 1, 2, 3].every(i => row[i * 4] === 0) && [4, 5, 6, 7].every(i => row[i * 4] === 255);
    } catch { return false; }
  })();
  const sharpenedLater = async (file, image) => {
    const scale = scaleOf(file);
    if (scale === 1 || !(await pixelatedResize)) return sharpened(file, image);
    return createImageBitmap(image, { resizeWidth: image.width * scale, resizeHeight: image.height * scale, resizeQuality: 'pixelated' }).catch(() => sharpened(file, image));
  };

  // The depth is read from the pictures as decoded (not from the enlarged copy on the graphics card): reading that copy
  // back took a quarter of a second on a desktop and froze phones mid-fight while the next place was prepared.
  const originals = new Map(), buildingDepth = new Set();
  // A picture let go is closed at once where it is an ImageBitmap, rather than left for the garbage collector to find.
  const release = file => { const picture = renderer.mapImages.get(file); renderer.mapImages.delete(file); picture?.close?.(); };
  // The depth is worked out in a worker where the browser allows it (OffscreenCanvas in workers); otherwise right here.
  let depthWorker = null, depthIds = 0;
  const depthJobs = new Map();
  try { if (typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function') depthWorker = new Worker(new URL('./depth-worker.js', import.meta.url), { type: 'module' }); } catch { depthWorker = null; }
  const dropWorker = () => { depthWorker?.terminate(); depthWorker = null; const jobs = [...depthJobs.values()]; depthJobs.clear(); jobs.forEach(job => job.fallback()); };
  depthWorker?.addEventListener('message', ({ data: reply }) => {
    const job = depthJobs.get(reply.id); depthJobs.delete(reply.id);
    if (!job) return;
    if (reply.error) { console.warn('깊이 작업 실패, 화면에서 계산합니다:', reply.error); dropWorker(); job.fallback(); } else job.done(reply.depth);
  });
  depthWorker?.addEventListener('error', () => dropWorker());
  const buildDepth = village => {
    const background = village.background, [image, mask] = [background, village.mask].map(file => originals.get(file) || renderer.mapImages.get(file));
    if (!image || !mask || !renderer.mapImages.has(background) || buildingDepth.has(background)) return;
    buildingDepth.add(background);
    const finish = depth => { buildingDepth.delete(background); if (requested.has(background)) renderer.depthMasks.set(background, new DepthMask(depth, offscreen)); };
    const here = () => finish(computeDepth(image, mask, village, offscreen));
    // The mask picture (as large as the map) and the originals are not kept once handed over.
    release(village.mask); originals.delete(background); originals.delete(village.mask);
    if (!depthWorker) return here();
    const id = ++depthIds, url = file => new URL(assetUrl(file), location.href).href;
    depthJobs.set(id, { done: finish, fallback: here });
    depthWorker.postMessage({ id, imageUrl: url(background), maskUrl: url(village.mask), size: village.size, overhead: village.overhead || [] });
  };

  // Map art comes in order of need: the place underfoot and the one after it are loaded and decoded first.
  const artOf = place => [place?.background, place?.mask, ...(place?.props || []).map(prop => prop.image)].filter(Boolean);
  const firstRoom = placeOf(data.maps, data.maps?.maps?.[data.slice.rooms[0]?.id]);
  // The place a new game opens on comes first (the scrapyard), then the town and the first stop; icons and effects after.
  const introPlace = placeOf(data.maps, data.maps?.intro);
  let imageQueue = [...new Set([...artOf(introPlace), ...artOf(game.hubMap), ...artOf(firstRoom), ...firstFiles].filter(Boolean))];
  // Every other place's files are then fetched into the browser's cache, one at a time and at low priority, but not
  // decoded: fourteen decoded maps and masks would not fit a phone's memory, and a cached file opens in a moment.
  const prefetch = [...new Set(villages().flatMap(artOf).filter(file => !imageQueue.includes(file)))];
  const requested = new Set(imageQueue);
  let prefetching = false, imagesLoading = 0, placeLoaded = null, nextFloor = null;
  function prefetchRest() {
    if (prefetching || imagesLoading || imageQueue.length || !prefetch.length) return;
    const file = prefetch.shift(); if (requested.has(file)) return prefetchRest();
    prefetching = true;
    fetch(assetUrl(file), { priority: 'low' }).then(r => r.blob()).catch(() => {}).finally(() => { prefetching = false; prefetchRest(); });
  }
  /** Starts the next pictures in the queue, up to `slots` at once; does nothing until `canStart()`. */
  function fetchImages() {
    // Places are drawn only after the title, so their art starts once the title is drawn, beside F2's own sheets
    // rather than after all of them (on a slow connection the scrapyard came too late for the opening).
    if (!canStart()) return;
    if (!imageQueue.length) prefetchRest();
    while (imagesLoading < slots && imageQueue.length) {
      const file = imageQueue.shift(), image = new Image(), done = () => { imagesLoading--; fetchImages(); };
      imagesLoading++;
      // Decoded before first use, so a map, effect or prop drawn for the first time mid-fight does not stall that frame.
      image.onload = () => image.decode().catch(() => {}).then(() => {
        if (!requested.has(file)) return done();
        const owners = villages().filter(village => [village.background, village.mask].includes(file));
        if (owners.length) originals.set(file, image);
        sharpenedLater(file, image).then(picture => { if (!requested.has(file)) return done(); renderer.mapImages.set(file, picture); owners.forEach(buildDepth); done(); });
      });
      image.onerror = () => { console.warn(`맵 배경을 불러올 수 없습니다: ${file}`); done(); };
      image.src = assetUrl(file);
    }
  }
  /** Puts `wantedPlace` (by default the place the game is in) and the place after it at the head of the queue. */
  function bringPlaceForward(wantedPlace) {
    // Before registration (the title, the opening text, the scrapyard fight) the place that matters is the scrapyard,
    // even while the game still reports the town: treating the town as current here once dropped the scrapyard's
    // painting from the queue every frame, and the tutorial opened on the plain stand-in floor.
    const opening = !game.s.profile.registered && ['opening', 'intro', 'introDeath'].includes(game.s.mode);
    const place = wantedPlace || (opening ? introPlace : game.village || game.map);
    if (place?.background === placeLoaded) return;
    placeLoaded = place?.background;
    // In town the next place is the first stop; on a run it is the stop after this one.
    const next = game.s.run ? roomPlace(data.maps, data.slice.rooms[game.s.run.node + 1]?.id, game.s.run.plan?.[game.s.run.node + 1]?.variant || 0) : firstRoom, wanted = [...artOf(place), ...artOf(next)];
    // The next floor's clearance grid is built a few milliseconds per frame from now on, so entering it costs nothing.
    nextFloor = next;
    // Places left behind are let go: a run passes a dozen of them, and keeping every enlarged map and its depth in memory
    // made the town sluggish on phones after a run. The town itself stays, so coming home is instant; anything let go is
    // still in the browser's cache and comes back in a moment if needed again.
    const keep = new Set([...wanted, ...artOf(game.hubMap), ...(game.s.profile.registered ? [] : artOf(introPlace))]);
    for (const village of villages()) for (const file of artOf(village)) {
      if (keep.has(file) || !requested.has(file)) continue;
      release(file); renderer.depthMasks.delete(file); originals.delete(file); requested.delete(file);
      imageQueue = imageQueue.filter(queued => queued !== file);
    }
    const fresh = wanted.filter(file => !requested.has(file)); fresh.forEach(file => requested.add(file));
    imageQueue = [...wanted.filter(file => imageQueue.includes(file)), ...fresh, ...imageQueue.filter(file => !wanted.includes(file))];
    fetchImages();
  }
  /** Builds a little more of the next floor's clearance grid; call once a frame. */
  function prepareNextFloor() { if (nextFloor && prepareClearance(nextFloor, 3)) nextFloor = null; }
  /** Resolves once a place's painting is decoded and in the renderer, or after `ms` (the mask is turned into depth and let go, so it is not waited for). */
  function placeArtReady(place, ms) {
    const files = [place?.background].filter(Boolean);
    return new Promise(done => {
      const start = performance.now(), check = () => (files.every(file => renderer.mapImages.has(file)) || performance.now() - start > ms ? done() : setTimeout(check, 100));
      check();
    });
  }
  return { introPlace, fetchImages, bringPlaceForward, prepareNextFloor, placeArtReady };
}
