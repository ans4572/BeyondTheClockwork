/** One picture file, decoded up front so the first frame that shows a new sheet (a skill, a mob's attack) does not stall on it. */
const fileImage = url => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => image.decode().catch(() => {}).then(() => resolve(image));
  image.onerror = () => reject(new Error(`스프라이트를 불러올 수 없습니다: ${url}`));
  image.src = assetUrl(url);
});

/**
 * Atlas pages (2026-11-13, scripts/build-atlases.py): the sprite sheets packed a few dozen to a page, so the browser makes
 * about 80 requests instead of about 1,200 (each cost a round trip of 0.3 s or more on a phone). A sheet on a page is cut
 * back out under its own name; a sheet on no page, or a page that fails, is fetched by itself as before.
 */
export const ATLAS_INDEX = 'art/atlases/index.json';
let atlasIndex = null;
const pages = new Map();
/** Where each sheet sits: sheet path (without the leading slash) → { page, rect }. Fetched once. */
export function atlasPlaces() {
  atlasIndex ??= fetch(ATLAS_INDEX, { cache: 'no-cache' }).then(response => (response.ok ? response.json() : null)).catch(() => null).then(index => {
    const places = new Map();
    for (const [page, sheets] of Object.entries(index?.pages || {})) for (const [sheet, rect] of Object.entries(sheets)) places.set(assetUrl(sheet), { page, rect });
    return places;
  });
  return atlasIndex;
}
/** Cuts one sheet out of a page drawn on a canvas (browsers without createImageBitmap). */
function cutOnCanvas(page, [x, y, w, h]) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  canvas.getContext('2d').drawImage(page, x, y, w, h, 0, 0, w, h);
  return canvas;
}
/**
 * Every sheet of a page, cut out once the page arrives; the page itself is then let go. The page is decoded from its
 * bytes into an ImageBitmap off the main thread and the sheets are cut from that (2026-11-13: cutting them from a picture
 * element held the main thread for about 10 s in all while the loading card turned).
 */
function pageSheets(page, places) {
  if (!pages.has(page)) pages.set(page, (async () => {
    const mine = [...places].filter(([, place]) => place.page === page);
    if (typeof createImageBitmap === 'function') {
      try {
        const response = await fetch(page); if (!response.ok) throw new Error(`${response.status} ${page}`);
        const whole = await createImageBitmap(await response.blob());
        const sheets = new Map(await Promise.all(mine.map(async ([sheet, { rect: [x, y, w, h] }]) => [sheet, await createImageBitmap(whole, x, y, w, h)])));
        whole.close();
        return sheets;
      } catch { /* The picture element and a canvas instead. */ }
    }
    const image = await fileImage(page), sheets = new Map(mine.map(([sheet, place]) => [sheet, cutOnCanvas(image, place.rect)]));
    image.src = '';
    return sheets;
  })());
  return pages.get(page);
}
/** The sheet cut from its atlas page, or null when it is on no page (or the page could not be loaded). */
export async function fromAtlas(url) {
  const places = await atlasPlaces(), place = places.get(assetUrl(url));
  if (!place) return null;
  // A cut sheet is handed over once and not kept here (the library keeps it); asked again, it comes from its own file.
  return pageSheets(place.page, places).then(sheets => {
    const sheet = sheets.get(assetUrl(url)) || null;
    sheets.delete(assetUrl(url)); places.delete(assetUrl(url));
    return sheet;
  }, () => { places.delete(assetUrl(url)); return null; });
}

/** A sprite sheet ready to draw: from its atlas page when it has one, else its own file. */
export const browserImage = url => fromAtlas(url).then(sheet => sheet || fileImage(url));

/** Frame shown after a fraction of the clip has played; frame times need not be equal. */
export function frameAtProgress(clip, progress) {
  const target = Math.max(0, Math.min(1, progress)) * clip.durationMs;
  let elapsed = 0;
  for (let frame = 0; frame < clip.frameCount; frame++) {
    elapsed += clip.frameDurationsMs[frame];
    if (target < elapsed) return frame;
  }
  return clip.frameCount - 1;
}

/** Data names assets from the game's root; the page may not live at the root of its site. */
export const assetUrl = url => url.replace(/^\//, '');

/** Sprite clips and their decoded sheets. Holds no game state. */
export class SpriteLibrary {
  constructor(data, images) { this.data = data; this.images = images; this.locomotion = data.locomotion; }
  /**
   * Loads the clips and their sheets. Clips whose action `later` accepts (skills, say) and every cast effect are not
   * waited for: they keep arriving after the library is returned, and `image` answers null until each one is in.
   */
  /** `restAfter`: the sheets marked `later` start downloading only once it settles (the boot is done), not alongside the first ones. */
  static async load(url = '/art/animations/player/game-clips.json', loadImage = browserImage, later = () => false, restAfter = Promise.resolve()) {
    // The atlas index is asked for alongside the clip list, so the first sheets need not wait for it after.
    atlasPlaces();
    // Always ask the server whether the clip list changed (a cheap 304 when not): a stale list points at old art.
    const response = await fetch(assetUrl(url), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`game-clips.json을 불러올 수 없습니다 (${response.status})`);
    const data = await response.json();
    const sheetsOf = clips => clips.flatMap(([, clip]) => [clip.sheet, clip.effect]).filter(Boolean);
    const clips = Object.entries(data.clips), now = [...new Set(sheetsOf(clips.filter(([key]) => !later(key.split('/')[0]))))];
    const rest = [...new Set([...sheetsOf(clips), ...Object.values(data.castEffects || {}).map(effect => effect.sheet).filter(Boolean)])].filter(sheet => !now.includes(sheet));
    const images = await Promise.all(now.map(loadImage)), library = new SpriteLibrary(data, new Map(now.map((sheet, i) => [sheet, images[i]])));
    library.rest = restAfter.catch(() => {}).then(() => Promise.all(rest.map(sheet => loadImage(sheet).then(image => library.images.set(sheet, image)).catch(() => {}))));
    return library;
  }
  /** Takes in another library's clips (a chapter's own mobs); its sheets keep arriving into its own image map. */
  merge(other) {
    Object.assign(this.data.clips, other.data.clips);
    const own = this.images;
    this.images = { get: url => own.get(url) || other.images.get(url), set: (url, image) => own.set(url, image) };
    return this;
  }
  clip(action, direction) { return this.data.clips[`${action}/${direction}`] || null; }
  image(url) { return this.images.get(url) || null; }
}
