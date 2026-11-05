// Play statistics shared by the game and the worker: what one event looks like, and how a device is described.
// Nothing here names a person: a device is a random id made on first play, plus coarse words (phone, ios, safari).

export const ELEMENT_IDS = ['fire', 'ice', 'lightning', 'wind'];
export const FORMS = ['phone', 'tablet', 'desktop'];
export const SYSTEMS = ['ios', 'android', 'windows', 'mac', 'chromeos', 'linux', 'other'];
export const BROWSERS = ['chrome', 'safari', 'samsung', 'whale', 'edge', 'firefox', 'inapp', 'other'];
export const END_REASONS = ['clear', 'defeat', 'abandon'];
/** The longest event body the worker reads. */
export const EVENT_BYTES = 2048;

const DEVICE_ID = /^[a-z0-9]{16,32}$/, RUN_ID = /^run-\d{1,6}-\d{1,10}$/;

/** Korean calendar day (UTC+9) of a moment, as 2026-11-05: the admin page counts days the way the players live them. */
export const koreanDay = (ms = Date.now()) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

/** The two equipped elements in one fixed order ('fire+ice'); '' when only the wrench went along. */
export function comboKey(elements) {
  if (!Array.isArray(elements) || elements.length > 2 || new Set(elements).size !== elements.length || !elements.every(e => ELEMENT_IDS.includes(e))) return null;
  return [...elements].sort((a, b) => ELEMENT_IDS.indexOf(a) - ELEMENT_IDS.indexOf(b)).join('+');
}

/**
 * The device in three coarse words, from what the browser tells about itself. An iPad asking for the desktop site
 * calls itself a Mac, so a Mac with a touch screen counts as an iPad.
 */
export function deviceProfile({ userAgent: ua = '', maxTouchPoints = 0 } = {}, { width = 0, height = 0 } = {}) {
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const os = /iPhone|iPod/.test(ua) || ipad ? 'ios' : /Android/.test(ua) ? 'android' : /CrOS/.test(ua) ? 'chromeos' : /Windows/.test(ua) ? 'windows' : /Macintosh|Mac OS X/.test(ua) ? 'mac' : /Linux/.test(ua) ? 'linux' : 'other';
  const short = Math.min(width, height) || 0;
  const form = ipad || (os === 'android' && !/Mobile/.test(ua)) ? 'tablet' : /iPhone|iPod|Mobi/.test(ua) || os === 'android' ? 'phone' : maxTouchPoints > 1 && short >= 600 && os !== 'windows' ? 'tablet' : 'desktop';
  const browser = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps/.test(ua) ? 'inapp' : /SamsungBrowser/.test(ua) ? 'samsung' : /Whale/.test(ua) ? 'whale'
    : /Edg(e|A|iOS)?\//.test(ua) ? 'edge' : /Firefox|FxiOS/.test(ua) ? 'firefox' : /Chrome|CriOS|Chromium/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other';
  return { form, os, browser };
}

/**
 * One event as the worker will store it, or null when anything is off. Kinds:
 *   open      — the game was opened: { device, form, os, browser, installed }
 *   runStart  — an expedition set out: { device, run, elements }
 *   runEnd    — it came back: { device, run, elements, reason, node, seconds }
 */
export function cleanEvent(sent) {
  if (!sent || typeof sent !== 'object' || typeof sent.device !== 'string' || !DEVICE_ID.test(sent.device)) return null;
  const { device, kind } = sent;
  if (kind === 'open') {
    if (!FORMS.includes(sent.form) || !SYSTEMS.includes(sent.os) || !BROWSERS.includes(sent.browser)) return null;
    return { kind, device, form: sent.form, os: sent.os, browser: sent.browser, installed: sent.installed === true };
  }
  if (kind !== 'runStart' && kind !== 'runEnd') return null;
  const combo = comboKey(sent.elements);
  if (typeof sent.run !== 'string' || !RUN_ID.test(sent.run) || combo === null) return null;
  if (kind === 'runStart') return { kind, device, run: sent.run, combo };
  const whole = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  if (!END_REASONS.includes(sent.reason) || !whole(sent.node, 99) || sent.node < 1 || !whole(sent.seconds, 86400)) return null;
  return { kind, device, run: sent.run, combo, reason: sent.reason, node: sent.node, seconds: sent.seconds };
}
