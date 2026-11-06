// Works out a place's depth (src/render/depth-mask.js computeDepth) away from the main thread, so preparing the next
// place never stalls a fight. The worker fetches and decodes the two pictures itself (from the browser cache), and the
// arrays go back without copying.
import { computeDepth } from './depth-mask.js';

const picture = url => fetch(url).then(response => { if (!response.ok) throw new Error(`${response.status} ${url}`); return response.blob(); }).then(blob => createImageBitmap(blob));

self.onmessage = async ({ data: { id, imageUrl, maskUrl, size, overhead, seeThrough } }) => {
  try {
    const [image, mask] = await Promise.all([picture(imageUrl), picture(maskUrl)]);
    const depth = computeDepth(image, mask, { size, overhead, seeThrough }, (w, h) => new OffscreenCanvas(w, h));
    image.close(); mask.close();
    self.postMessage({ id, depth }, [depth.pixels.buffer, depth.depths.buffer, depth.deepest.buffer, ...(depth.veil ? [depth.veil.buffer] : [])]);
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
