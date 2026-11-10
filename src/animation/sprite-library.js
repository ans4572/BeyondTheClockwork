export const browserImage = url => new Promise((resolve, reject) => {
  const image = new Image();
  // Decoded up front, so the first frame that shows a new sheet (a skill, a mob's attack) does not stall on it.
  image.onload = () => image.decode().catch(() => {}).then(() => resolve(image));
  image.onerror = () => reject(new Error(`스프라이트를 불러올 수 없습니다: ${url}`));
  image.src = assetUrl(url);
});

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
