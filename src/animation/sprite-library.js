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
 * The sheets asked of each page in the same moment, cut out together: the page is fetched and decoded from its bytes
 * into an ImageBitmap off the main thread (2026-11-13: cutting from a picture element held the main thread for about
 * 10 s in all), only the sheets asked for are cut, and the page is let go. A sheet let go and asked again later (a
 * chapter's mobs, released in town) is cut again from its page, which by then is on the device.
 */
const asked = new Map();
function cutLater(page, sheet, rect) {
  return new Promise((resolve, reject) => {
    let batch = asked.get(page);
    if (!batch) { batch = []; asked.set(page, batch); setTimeout(() => { asked.delete(page); cutPage(page, batch); }, 0); }
    batch.push({ sheet, rect, resolve, reject });
  });
}
async function cutPage(page, batch) {
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        const response = await fetch(page); if (!response.ok) throw new Error(`${response.status} ${page}`);
        const whole = await createImageBitmap(await response.blob());
        await Promise.all(batch.map(async ({ rect: [x, y, w, h], resolve }) => resolve(await createImageBitmap(whole, x, y, w, h))));
        whole.close();
        return;
      } catch { /* The picture element and a canvas instead. */ }
    }
    const image = await fileImage(page);
    for (const { rect, resolve } of batch) resolve(cutOnCanvas(image, rect));
    image.src = '';
  } catch (error) { for (const { reject } of batch) reject(error); }
}
/** The sheet cut from its atlas page, or null when it is on no page (or the page could not be loaded). */
export async function fromAtlas(url) {
  const place = (await atlasPlaces()).get(assetUrl(url));
  return place ? cutLater(place.page, assetUrl(url), place.rect).catch(() => null) : null;
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

/** Frees a sheet let go: an ImageBitmap is closed, a canvas (a graded sheet) shrunk to nothing (Safari keeps its memory until collected). */
const letGo = image => { image?.close?.(); if (typeof image?.getContext === 'function') { image.width = 0; image.height = 0; } };

/** Sprite clips and their decoded sheets. Holds no game state. */
export class SpriteLibrary {
  constructor(data, images, loadImage = browserImage) { this.data = data; this.images = images; this.own = images; this.ownClips = Object.entries(data.clips); this.loadImage = loadImage; this.locomotion = data.locomotion; }
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
    const images = await Promise.all(now.map(loadImage)), library = new SpriteLibrary(data, new Map(now.map((sheet, i) => [sheet, images[i]])), loadImage);
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
  /**
   * The sheets of this library's own clips (not those merged in) whose name (such as 'rat-idle/south') `wanted` accepts,
   * and of its cast effects whose skill id it accepts.
   */
  sheetsOf(wanted) {
    const clips = this.ownClips.filter(([key]) => wanted(key)).flatMap(([, clip]) => [clip.sheet, clip.effect]);
    const casts = Object.entries(this.data.castEffects || {}).filter(([id]) => wanted(id)).map(([, effect]) => effect.sheet);
    return [...new Set([...clips, ...casts].filter(Boolean))];
  }
  /**
   * Holds the sheets of exactly the clips `wanted` accepts (2026-11-13, a chapter's mobs only while it is played: both
   * chapters' mob sheets are about 380 MB decoded, too much for a phone to keep in town): the missing are loaded, the
   * rest let go (an ImageBitmap is closed at once). Resolves once the wanted sheets are in.
   */
  hold(wanted) {
    const keep = new Set(this.sheetsOf(wanted)), own = this.own;
    this.coming ??= new Map(); this.holding = keep;
    for (const [sheet, image] of [...own]) if (!keep.has(sheet)) { own.delete(sheet); letGo(image); }
    return Promise.all([...keep].map(sheet => {
      if (own.has(sheet)) return null;
      if (!this.coming.has(sheet)) this.coming.set(sheet, this.loadImage(sheet).then(image => { if (this.holding.has(sheet)) own.set(sheet, image); else letGo(image); }, () => {}).finally(() => this.coming.delete(sheet)));
      return this.coming.get(sheet);
    }));
  }
  clip(action, direction) { return this.data.clips[`${action}/${direction}`] || null; }
  image(url) { return this.images.get(url) || null; }
}
