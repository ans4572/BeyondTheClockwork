// The game's mouse cursor over the play field (2026-11-11): a pixel crosshair, cream arms edged in ink round a gold dot,
// drawn at the size set with the slider in 환경설정 (the browser's own crosshair was small against the game's pixel art).

/** The slider's range and step in screen pixels, and the size a new save starts with. */
export const CURSOR_MIN = 20, CURSOR_MAX = 100, CURSOR_STEP = 4, DEFAULT_CURSOR = 32;
// Sizes picked from the first, drop-down version of the setting, kept by older saves.
const NAMED = { small: 24, normal: 32, large: 40, huge: 48 };

/** A saved size made safe: a number on the slider's steps inside its range, an old named size, or the default. */
export function cursorSize(value) {
  const px = typeof value === 'string' ? NAMED[value] : value;
  if (!Number.isFinite(px)) return DEFAULT_CURSOR;
  return Math.min(CURSOR_MAX, Math.max(CURSOR_MIN, Math.round(px / CURSOR_STEP) * CURSOR_STEP));
}

// The crosshair on a 16-cell grid: [x, y, w, h] rectangles, ink outline first, then the cream arms and the gold centre.
const INK = [[6, 0, 4, 6], [6, 10, 4, 6], [0, 6, 6, 4], [10, 6, 6, 4], [6, 6, 4, 4]];
const ARMS = [[7, 1, 2, 4], [7, 11, 2, 4], [1, 7, 4, 2], [11, 7, 4, 2]];
const CENTRE = [[7, 7, 2, 2]];
const rects = (list, fill) => list.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`).join('');

/** The crosshair picture at `px` pixels, as a data URL (the cursor itself and the settings' preview). */
export function cursorImage(value) {
  const px = cursorSize(value);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 16 16" shape-rendering="crispEdges">`
    + `${rects(INK, '#2b3345')}${rects(ARMS, '#fff4d6')}${rects(CENTRE, '#ffd257')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The CSS `cursor` value for a saved size, its hot spot in the middle, the browser's crosshair as a fallback. */
export function cursorCss(value) {
  const half = Math.floor(cursorSize(value) / 2);
  return `url("${cursorImage(value)}") ${half} ${half}, crosshair`;
}
