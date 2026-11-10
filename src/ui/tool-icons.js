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
// The painted pixel icons (art/ui/icons/px, each a 24, 32 or 48 pixel grid). A name found here is shown as its picture;
// the drawn bodies above stay for the few marks that have no painted icon yet (home, spark).
const ART = new Set(['gear', 'coin', 'crown', 'charge', 'lock', 'action-wrench', 'action-dodge',
  ...['wrench-damage', 'max-hp', 'skill-cooldown', 'dodge-cooldown', 'move-speed', 'status-damage', 'crit', 'attack-speed', 'kill-heal', 'armor',
    'wrench-mod', 'skill-level', 'gear-pouch', 'repair', 'piggy-bank', 'overheat', 'glass-spring'].map(id => `reward-${id}`),
  // Nasa's oils (PixelLab, 2026-11-08).
  ...['attack', 'boss', 'health', 'energy', 'spare'].map(id => `potion-${id}`)]);
// The three HUD buttons (full screen, map, settings) are smooth painted icons on a 24 unit grid, not pixels: brass and
// cream bodies with a navy outline, one shade and one highlight, in the colours of the painted town and its minimap.
const N = '#2b3345', BRASS = '#d9a441', LIGHT = '#f3cd6a', SHADE = '#9a6a24', CREAM = '#f6ecd2', FOLD = '#e3cf9f', RED = '#c8463c';
const brackets = (path, highlight) => `<path d="${path}" fill="none" stroke="${N}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${BRASS}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${highlight}" fill="none" stroke="${LIGHT}" stroke-width="1" stroke-linecap="round"/>`;
const MAP_EDGE = 'M3 6.5 8.5 4.3 15.5 6.8 21 4.8v12.7l-5.5 2.2-7-2.5L3 19.2z';
const knob = (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="${BRASS}" stroke="${N}" stroke-width="1.5"/><path d="M${x - 1.6} ${y + 1.3}a2.1 2.1 0 0 0 3.2 .3" fill="none" stroke="${SHADE}" stroke-width="1"/><circle cx="${x - 0.9}" cy="${y - 0.9}" r=".8" fill="${LIGHT}"/>`;
const SMOOTH = {
  fullscreen: brackets('M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15', 'M5.2 8V5.8a.6.6 0 0 1 .6-.6H8'),
  'fullscreen-exit': brackets('M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20', 'M8 5v2.4a.6.6 0 0 1-.6.6H5.2'),
  map: `<path d="M3 6.5 8.5 4.3v13.2L3 19.2z" fill="${CREAM}"/><path d="M8.5 4.3l7 2.5v12.9l-7-2.2z" fill="${FOLD}"/><path d="M15.5 6.8 21 4.8v12.7l-5.5 2.2z" fill="${CREAM}"/><path d="${MAP_EDGE}" fill="none" stroke="${N}" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 4.3v13.2M15.5 6.8v12.9" stroke="${N}" stroke-width="1.2"/><path d="M5 15.5c1.8-.4 2.6-3 5-3.2s3.2 1.8 5.4.4" fill="none" stroke="${SHADE}" stroke-width="1.3" stroke-dasharray="1.6 1.4" stroke-linecap="round"/><path d="M16.6 9.3l2.4 2.4M19 9.3l-2.4 2.4" stroke="${RED}" stroke-width="2" stroke-linecap="round"/>`,
  settings: `<path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="${N}" stroke-width="2.6" stroke-linecap="round"/>${knob(9, 6.5)}${knob(15.5, 12)}${knob(7.5, 17.5)}`
};
const smooth = (name, cls) => `<svg class="${cls} smooth-icon" data-icon="${name}" viewBox="0 0 24 24" aria-hidden="true">${SMOOTH[name]}</svg>`;
// A redrawn icon gets a new file name (browsers keep the old picture at the old path).
const FILES = { 'action-dodge': 'action-dodge-v7' };
export const iconUrl = name => `art/ui/icons/px/${FILES[name] || name}.png`;
export const ICON_FILES = [...ART].map(iconUrl);
const svg = (name, cls) => SMOOTH[name] ? smooth(name, cls) : ART.has(name)
  ? `<img class="${cls} px-icon" src="${iconUrl(name)}" alt="" draggable="false">`
  : `<svg class="${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${BODIES[name]}</svg>`;
/** The tool buttons and wallet: sized by their own CSS. */
export const TOOL_ICONS = Object.fromEntries([...Object.keys(BODIES), ...ART, ...Object.keys(SMOOTH)].map(name => [name, svg(name, 'tool-icon')]));
/** An icon set in a line of text, one letter tall. */
export const ico = name => svg(name, 'ico');
/** A skill slot's picture: the painted action icons by name, every other slot by its skill's own icon. */
/** A skill's or fusion's painted pixel icon (art/ui/icons/px/skill-<id>.png, 48 pixel grid). */
export const skillIcon = id => iconUrl(`skill-${id}`);
export const slotArt = art => (ART.has(art) ? iconUrl(art) : skillIcon(art));
/** Shows the enter or the leave picture on a full-screen button, whichever the next press will do. */
export function syncFullscreenIcon(button) {
  const icon = button?.querySelector('svg.smooth-icon'); if (!icon) return;
  const name = document.fullscreenElement ? 'fullscreen-exit' : 'fullscreen';
  if (icon.dataset.icon !== name) icon.outerHTML = smooth(name, [...icon.classList].filter(c => c !== 'smooth-icon').join(' '));
}
