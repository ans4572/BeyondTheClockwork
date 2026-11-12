// Sends play statistics to the worker (worker/stats.js): the game opening, an expedition setting out and coming back.
// Each event is fire-and-forget; a lost one costs nothing. Local test servers never report, so testing leaves no marks.
import { apiBase } from './device-transfer.js';
import { deviceProfile, cleanEvent } from '../engine/stats.js';
export { PING_SECONDS } from '../engine/stats.js';

export const DEVICE_STORE_KEY = 'beyond-the-clockwork.device.v1';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];

/** This device's random id, made on first play and kept apart from the save (a save carried elsewhere keeps its device). */
export function deviceId(storage, random = bytes => crypto.getRandomValues(bytes)) {
  try {
    const kept = storage.getItem(DEVICE_STORE_KEY);
    if (kept && /^[a-z0-9]{16,32}$/.test(kept)) return kept;
    const id = [...random(new Uint8Array(20))].map(b => (b % 36).toString(36)).join('');
    storage.setItem(DEVICE_STORE_KEY, id);
    return id;
  } catch { return null; }
}

/**
 * A reporter for this page: report('open'), report('runStart', { run, elements }), report('runEnd', {…}).
 * `send` takes (url, text); the browser's is navigator.sendBeacon, which survives the tab closing right after a run.
 */
export function statsReporter({ storage, hostname, protocol = 'https:', send, base = apiBase(hostname) } = {}) {
  if (LOCAL_HOSTS.includes(hostname) || protocol === 'file:') return () => false;
  const device = deviceId(storage);
  if (!device) return () => false;
  return (kind, fields = {}) => {
    const event = cleanEvent({ device, kind, ...fields });
    if (!event) return false;
    try { return send(`${base}/api/stats`, JSON.stringify({ device, kind, ...fields })) !== false; } catch { return false; }
  };
}

/**
 * The check-in that keeps the admin page's "playing now" true and brings gifts: ping(fields) answers with the gifts
 * waiting for this device, claim(ids) tells the worker the game took them. Null on a local test server.
 * Plain-text bodies keep these simple requests (no CORS preflight from GitHub Pages).
 */
export function mailbox({ storage, hostname, protocol = 'https:', fetchImpl = (...a) => fetch(...a), base = apiBase(hostname) } = {}) {
  if (LOCAL_HOSTS.includes(hostname) || protocol === 'file:') return null;
  const device = deviceId(storage);
  if (!device) return null;
  return {
    device,
    async ping(fields) {
      const event = cleanEvent({ device, kind: 'ping', ...fields });
      if (!event) return [];
      try {
        const response = await fetchImpl(`${base}/api/stats`, { method: 'POST', body: JSON.stringify(event) });
        const body = response.ok ? await response.json() : {};
        return Array.isArray(body?.mail) ? body.mail : [];
      } catch { return []; }
    },
    claim: ids => (ids.length ? fetchImpl(`${base}/api/mail/claim`, { method: 'POST', body: JSON.stringify({ device, ids }) }).then(() => true, () => false) : Promise.resolve(true))
  };
}

/**
 * The difficulty cards' records from the worker (worker/stats.js records), with this device's own named so the
 * answer can say which top record is ours. Null on a local test server or when the worker cannot be reached.
 */
export async function fetchRecords({ storage, hostname, protocol = 'https:', fetchImpl = (...a) => fetch(...a), base = apiBase(hostname), chapter = '' } = {}) {
  if (LOCAL_HOSTS.includes(hostname) || protocol === 'file:') return null;
  const device = deviceId(storage);
  try {
    const query = [device && `device=${device}`, chapter && `chapter=${encodeURIComponent(chapter)}`].filter(Boolean).join('&');
    const response = await fetchImpl(`${base}/api/records${query ? `?${query}` : ''}`);
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

/** The browser's reporter, wired to this page. */
export function browserReporter() {
  const send = (url, text) => (navigator.sendBeacon ? navigator.sendBeacon(url, text) : (fetch(url, { method: 'POST', body: text, keepalive: true, mode: 'no-cors' }).catch(() => {}), true));
  const report = statsReporter({ storage: localStorage, hostname: location.hostname, protocol: location.protocol, send });
  return Object.assign(report, {
    opened: () => report('open', { ...deviceProfile(navigator, screen), installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true })
  });
}

/** A pass from a code made on the admin page, kept apart from the save until the server has taken it (2026-11-12). */
export const INHERIT_STORE_KEY = 'beyond-the-clockwork.inherit.v1';
export function rememberPass(storage, pass) { try { if (pass) storage.setItem(INHERIT_STORE_KEY, String(pass)); } catch {} }
/**
 * Hands the kept pass in, so this device takes over the old device's records (runs, the server board's own records,
 * gifts). Kept for the next opening when the server cannot be reached; dropped once taken or unknown. Not on a local server.
 */
export async function handInPass({ storage, hostname, protocol = 'https:', fetchImpl = (...a) => fetch(...a), base = apiBase(hostname) } = {}) {
  let pass = null;
  try { pass = storage.getItem(INHERIT_STORE_KEY); } catch {}
  if (!pass || LOCAL_HOSTS.includes(hostname) || protocol === 'file:') return false;
  const device = deviceId(storage);
  if (!device) return false;
  try {
    const response = await fetchImpl(`${base}/api/inherit`, { method: 'POST', body: JSON.stringify({ device, pass }) });
    if (response.ok || response.status === 404 || response.status === 400) storage.removeItem(INHERIT_STORE_KEY);
    return response.ok;
  } catch { return false; }
}
