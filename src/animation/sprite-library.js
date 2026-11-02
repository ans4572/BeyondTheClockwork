const browserImage = url => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
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
  static async load(url = '/art/animations/player/game-clips.json', loadImage = browserImage) {
    const response = await fetch(assetUrl(url));
    if (!response.ok) throw new Error(`game-clips.json을 불러올 수 없습니다 (${response.status})`);
    const data = await response.json();
    const urls = [...new Set([...Object.values(data.clips).flatMap(clip => [clip.sheet, clip.effect]), ...Object.values(data.castEffects || {}).map(effect => effect.sheet)].filter(Boolean))];
    const images = await Promise.all(urls.map(loadImage));
    return new SpriteLibrary(data, new Map(urls.map((sheet, i) => [sheet, images[i]])));
  }
  clip(action, direction) { return this.data.clips[`${action}/${direction}`] || null; }
  image(url) { return this.images.get(url) || null; }
}
