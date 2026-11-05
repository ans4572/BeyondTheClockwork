// Sends play statistics to the worker (worker/stats.js): the game opening, an expedition setting out and coming back.
// Each event is fire-and-forget; a lost one costs nothing. Local test servers never report, so testing leaves no marks.
import { apiBase } from './device-transfer.js';
import { deviceProfile, cleanEvent } from '../engine/stats.js';

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

/** The browser's reporter, wired to this page. */
export function browserReporter() {
  const send = (url, text) => (navigator.sendBeacon ? navigator.sendBeacon(url, text) : (fetch(url, { method: 'POST', body: text, keepalive: true, mode: 'no-cors' }).catch(() => {}), true));
  const report = statsReporter({ storage: localStorage, hostname: location.hostname, protocol: location.protocol, send });
  return Object.assign(report, {
    opened: () => report('open', { ...deviceProfile(navigator, screen), installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true })
  });
}
