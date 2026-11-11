// Play statistics shared by the game and the worker: what one event looks like, and how a device is described.
// A device is a random id made on first play, plus coarse words (phone, ios, safari) and the name the player wrote
// in Moru's repair ledger, if any.
import { cleanNickname } from './nickname.js';

// Sound and water came later (2026-11-08); they go last so the keys of the older pairs ('fire+ice') never change.
export const ELEMENT_IDS = ['fire', 'ice', 'lightning', 'wind', 'sound', 'water'];
export const FORMS = ['phone', 'tablet', 'desktop'];
export const SYSTEMS = ['ios', 'android', 'windows', 'mac', 'chromeos', 'linux', 'other'];
export const BROWSERS = ['chrome', 'safari', 'samsung', 'whale', 'edge', 'firefox', 'inapp', 'other'];
export const END_REASONS = ['clear', 'defeat', 'abandon'];
export const DIFFICULTIES = ['easy', 'normal', 'hard'];
/** Where a player is when the game checks in: the title or first scenes, the village, out on a run, or the practice yard. */
export const PLACES = ['title', 'hub', 'run', 'practice'];
/** The game checks in this often while it is on screen; a device seen within ONLINE_SECONDS counts as playing now. */
export const PING_SECONDS = 60;
export const ONLINE_SECONDS = 150;
/** Gifts the admin page can send: free gears, with a short message the player sees on arrival. */
export const GIFT_MAX_GEARS = 100000, GIFT_NOTE_MAX = 60, MEMO_MAX = 30;
/** The longest event body the worker reads. */
export const EVENT_BYTES = 2048;

const DEVICE_ID = /^[a-z0-9]{16,32}$/, RUN_ID = /^run-\d{1,6}-\d{1,10}$/, CHAPTER_ID = /^[a-z][a-z-]{0,31}$/;
/** Runs reported before they carried their chapter (2026-11-09) were all chapter 1's: chapter 2 was not on the live site. */
export const FIRST_CHAPTER_ID = 'smile-street';

/** A short line of plain text: control characters dropped, spaces collapsed, cut to `max` characters. */
export const plainText = (text, max) => (typeof text === 'string' ? [...text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('') : '');
/** A device id as the game makes it (also the admin page's handle on a player). */
export const isDeviceId = id => typeof id === 'string' && DEVICE_ID.test(id);

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
 *   runStart  — an expedition set out: { device, run, elements, difficulty }
 *   runEnd    — it came back: { device, run, elements, difficulty, reason, node, seconds }
 * (difficulty is null from a game made before difficulties existed)
 *   ping      — still playing: { device, name, where, node, gears, playSeconds } (the answer carries waiting gifts)
 */
export function cleanEvent(sent) {
  if (!sent || typeof sent !== 'object' || typeof sent.device !== 'string' || !DEVICE_ID.test(sent.device)) return null;
  const { device, kind } = sent;
  if (kind === 'open') {
    if (!FORMS.includes(sent.form) || !SYSTEMS.includes(sent.os) || !BROWSERS.includes(sent.browser)) return null;
    return { kind, device, form: sent.form, os: sent.os, browser: sent.browser, installed: sent.installed === true };
  }
  const whole = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  if (kind === 'ping') {
    if (!PLACES.includes(sent.where) || !whole(sent.node, 99) || !whole(sent.gears, 1e9) || !whole(sent.playSeconds, 1e9)) return null;
    // The chapter of the expedition under way (2026-11-11), for the admin page's 유저 tab; none outside a run.
    const chapter = sent.where === 'run' && typeof sent.chapter === 'string' && CHAPTER_ID.test(sent.chapter) ? sent.chapter : null;
    return { kind, device, name: cleanNickname(sent.name), where: sent.where, node: sent.node, gears: sent.gears, playSeconds: sent.playSeconds, chapter };
  }
  if (kind !== 'runStart' && kind !== 'runEnd') return null;
  const combo = comboKey(sent.elements);
  if (typeof sent.run !== 'string' || !RUN_ID.test(sent.run) || combo === null) return null;
  const difficulty = DIFFICULTIES.includes(sent.difficulty) ? sent.difficulty : null;
  // Which chapter the run was in (slice.json chapters[].id), so the admin page can tell chapter 1's runs from chapter 2's.
  const chapter = typeof sent.chapter === 'string' && CHAPTER_ID.test(sent.chapter) ? sent.chapter : null;
  if (kind === 'runStart') return { kind, device, run: sent.run, combo, difficulty, chapter };
  if (!END_REASONS.includes(sent.reason) || !whole(sent.node, 99) || sent.node < 1 || !whole(sent.seconds, 86400)) return null;
  return { kind, device, run: sent.run, combo, difficulty, chapter, reason: sent.reason, node: sent.node, seconds: sent.seconds };
}
