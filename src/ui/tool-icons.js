// Pixel icons drawn on a 16px grid, used wherever a glyph like ⚙ or ◈ would otherwise change size from phone to phone (or turn into colour emoji).
const BODIES = {
  map: '<path d="M1 3h4l3 1 3-1h4v11h-4l-3-1-3 1H1z" fill="#2b3345"/><path d="M2 4h3v9H2zM6 5h2v8H6zM9 5h2v8H9zM12 4h2v9h-2z" fill="#f6ecd2"/><path d="M6 5h2v8H6z" fill="#e0cf9f"/><path d="M12 4h2v9h-2z" fill="#e0cf9f"/><path d="M3 6h1v1H3zM10 8h1v1h-1zM12 10h1v1h-1z" fill="#c43c36"/>',
  gear: '<path d="M7 1h2v2h2l1-1 2 2-1 1v2h2v2h-2v2l1 1-2 2-1-1h-2v2H7v-2H5l-1 1-2-2 1-1V9H1V7h2V5L2 4l2-2 1 1h2z" fill="#2b3345"/><path d="M7 4h2v1h2v2h1v2h-1v2H9v1H7v-1H5V9H4V7h1V5h2z" fill="#c79a3e"/><path d="M7 6h2v1h1v2H9v1H7V9H6V7h1z" fill="#2b3345"/>',
  // Three sliders: the settings button, kept apart from the gear that counts free gears.
  settings: '<path d="M1 3h14v1H1zM1 8h14v1H1zM1 13h14v1H1z" fill="#2b3345"/><path d="M3 1h4v5H3zM9 6h4v5H9zM4 11h4v5H4z" fill="#2b3345"/><path d="M4 2h2v3H4zM10 7h2v3h-2zM5 12h2v3H5z" fill="#c79a3e"/>',
  fullscreen: '<path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z" fill="#2b3345"/>',
  coin: '<path d="M5 1h6v1h2v2h1v8h-1v2h-2v1H5v-1H3v-2H2V4h1V2h2z" fill="#2b3345"/><path d="M5 2h6v1h1v2h1v6h-1v2h-1v1H5v-1H4v-2H3V5h1V3h1z" fill="#e0b048"/><path d="M7 4h2v1h1v6H9v1H7v-1H6V5h1z" fill="#c79a3e"/><path d="M5 4h1v3H5z" fill="#fff4d6"/>',
  shield: '<path d="M3 1h10v1h1v6h-1v3h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3V8H2V2h1z" fill="#2b3345"/><path d="M4 2h8v6h-1v2h-1v1H9v1H7v-1H6v-1H5V8H4z" fill="#7fa6b8"/><path d="M8 2h4v6h-1v2h-1v1H9v1H8z" fill="#5c8098"/><path d="M5 3h2v2H5z" fill="#e8f2f6"/>',
  clock: '<path d="M5 1h6v1h2v2h1v8h-1v2h-2v1H5v-1H3v-2H2V4h1V2h2z" fill="#2b3345"/><path d="M5 2h6v1h1v1h1v8h-1v1h-1v1H5v-1H4v-1H3V4h1V3h1z" fill="#f6ecd2"/><path d="M7 4h2v4h3v2H7z" fill="#2b3345"/><path d="M7 2h2v1H7zM13 7v2h-1V7zM7 13h2v1H7zM3 7h1v2H3z" fill="#c79a3e"/>',
  boot: '<path d="M4 1h6v8h3v1h2v4H1v-3h1V9h2z" fill="#2b3345"/><path d="M5 2h4v8h4v1h1v2H2v-2h1v-1h2z" fill="#4f7fb5"/><path d="M2 12h12v1H2z" fill="#c79a3e"/><path d="M6 3h2v1H6z" fill="#9cc0e0"/>',
  flame: '<path d="M7 0h2v2h1v2h1v1h1v2h1v5h-1v2h-2v1H5v-1H3v-2H2V7h1V5h1V3h1V2h2z" fill="#2b3345"/><path d="M7 2h2v2h1v2h1v1h1v5h-1v1h-1v1H5v-1H4v-1H3V7h1V5h1V4h1V3h1z" fill="#e8742f"/><path d="M7 7h2v1h1v3H9v1H7v-1H6V8h1z" fill="#ffd257"/>',
  target: '<path d="M5 1h6v1h2v2h1v8h-1v2h-2v1H5v-1H3v-2H2V4h1V2h2z" fill="#2b3345"/><path d="M5 2h6v1h1v1h1v8h-1v1h-1v1H5v-1H4v-1H3V4h1V3h1z" fill="#c43c36"/><path d="M6 4h4v1h1v6h-1v1H6v-1H5V5h1z" fill="#f6ecd2"/><path d="M7 6h2v4H7z" fill="#c43c36"/>',
  haste: '<path d="M1 3h3l4 5-4 5H1l4-5zM8 3h3l4 5-4 5H8l4-5z" fill="#2b3345"/><path d="M2 4h1l3 4-3 4H2l3-4zM9 4h1l3 4-3 4H9l3-4z" fill="#ffd257"/>',
  heart: '<path d="M2 2h4v1h1v1h2V3h1V2h4v1h1v5h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3V9H2V8H1V3h1z" fill="#2b3345"/><path d="M3 3h2v1h1v1h1v1h2V5h1V4h1V3h2v4h-1v1h-1v1h-1v1H9v1H7v-1H6V9H5V8H4V7H3z" fill="#e8607a"/><path d="M3 3h2v2H3z" fill="#ffc0cc"/>',
  lock: '<path d="M5 1h6v1h1v5h-2V3H6v4H4V2h1z" fill="#2b3345"/><path d="M2 7h12v8H2z" fill="#2b3345"/><path d="M3 8h10v6H3z" fill="#c79a3e"/><path d="M7 9h2v4H7z" fill="#2b3345"/>',
  heal: '<path d="M5 1h6v4h4v6h-4v4H5v-4H1V5h4z" fill="#2b3345"/><path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z" fill="#c43c36"/><path d="M6 2h2v2H6z" fill="#e8807a"/>',
  up: '<path d="M7 1h2v1h1v1h1v1h1v1h1v1h1v3h-4v6H5V9H1V6h1V5h1V4h1V3h1V2h1z" fill="#2b3345"/><path d="M7 3h2v1h1v1h1v1h1v2H9v6H7V8H4V6h1V5h1V4h1z" fill="#4f8a4a"/>',
  wrench: '<path d="M10 1h4v1h1v4h-1v1h-3v1l-6 6v1H2v-1H1v-3h1l6-6V2h1V1z" fill="#2b3345"/><path d="M10 2h2v2h2v1h-1v1h-3v1H9v1L3 14H2v-1l6-6V6h1V3h1z" fill="#5c9a9a"/>',
  spark: '<path d="M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z" fill="#2b3345"/><path d="M7 2h2v4h1v1h4v2h-4v1H9v4H7v-4H6V9H2V7h4V6h1z" fill="#e0b048"/>',
  crown: '<path d="M1 3h2v2h1V3h2v2h1V2h2v3h1V3h2v2h1V3h2v12H1z" fill="#2b3345"/><path d="M2 6h12v8H2z" fill="#e0b048"/><path d="M4 9h2v2H4zM10 9h2v2h-2z" fill="#c43c36"/>',
  home: '<path d="M7 1h2v1h1v1h1v1h1v1h1v1h1v1h1v2h-1v6H2V9H1V7h1V6h1V5h1V4h1V3h1V2h1z" fill="#2b3345"/><path d="M7 3h2v1h1v1h1v1h1v1h1v1H3V7h1V6h1V5h1V4h1z" fill="#c43c36"/><path d="M3 9h10v5H3z" fill="#f6ecd2"/><path d="M7 11h2v3H7z" fill="#2b3345"/>'
};
const svg = (name, cls) => `<svg class="${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${BODIES[name]}</svg>`;
/** The tool buttons and wallet: sized by their own CSS. */
export const TOOL_ICONS = Object.fromEntries(Object.keys(BODIES).map(name => [name, svg(name, 'tool-icon')]));
/** An icon set in a line of text, one letter tall. */
export const ico = name => svg(name, 'ico');
/** An icon placed inside another SVG drawing, centred on (x, y). */
export const iconAt = (name, x, y, size) => `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges">${BODIES[name]}</svg>`;
