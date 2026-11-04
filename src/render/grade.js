// A colour grade that brings F2's and Moru's darker, muddier PixelLab drawings closer to the rest of the cast:
// lighter mid-tones, a little more colour, a touch warmer, and near-black outlines turned into the game's navy ink.
// Applied once to each sheet as it loads, so the art files on disk stay as PixelLab made them.

const NAVY = [43, 51, 69];
export const GRADE = { light: 0.07, saturation: 1.15, warm: 6, outline: 0.2, ink: 0.65 };

/** Grades RGBA pixel data in place (Uint8ClampedArray, 4 bytes a pixel). */
export function gradePixels(data, { light, saturation, warm, outline, ink } = GRADE) {
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const value = Math.max(r, g, b), lift = light * Math.min(1, Math.max(0, (value - 0.2) / 0.5));
    r += lift; g += lift; b += lift;
    const grey = (r + g + b) / 3;
    r = grey + (r - grey) * saturation; g = grey + (g - grey) * saturation; b = grey + (b - grey) * saturation;
    r += warm / 255; b -= warm / 2 / 255;
    let R = Math.min(255, Math.max(0, r * 255)), G = Math.min(255, Math.max(0, g * 255)), B = Math.min(255, Math.max(0, b * 255));
    if (value < outline) { R = R * (1 - ink) + NAVY[0] * ink; G = G * (1 - ink) + NAVY[1] * ink; B = B * (1 - ink) + NAVY[2] * ink; }
    data[i] = R; data[i + 1] = G; data[i + 2] = B;
  }
  return data;
}

/** A graded copy of a loaded image, as a canvas the renderer can draw like the image. */
export function gradedCanvas(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(image, 0, 0);
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
  gradePixels(pixels.data);
  c.putImageData(pixels, 0, 0);
  return canvas;
}
