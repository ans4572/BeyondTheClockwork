// Which synced save belongs to which device (2026-11-12), so the admin page can make a transfer code for a player.
// The game already uploads its progress to its sync place on every return to the village (worker/index.js /api/sync);
// with the upload it now names its device, and the worker notes `device:<id>` -> that sync key. Nothing piles up: the
// sync place holds one save, overwritten by each upload, and the note only changes when the key does.
import { makeCode, looksLikeSave, normalizeSyncKey, SYNC_KEY_LENGTH, SYNC_TTL_SECONDS } from '../src/engine/transfer-code.js';
import { isDeviceId } from '../src/engine/stats.js';

/** A code made on the admin page lasts a day: the owner passes it on by message, and the player may not answer at once. */
export const ADMIN_CODE_TTL_SECONDS = 24 * 60 * 60;
/** A pass to take over the old device's records stays a week: the code is loaded within a day, the hand-in may wait for a connection. */
export const INHERIT_TTL_SECONDS = 7 * 24 * 60 * 60;
/** The note is written again at most this often while its key stays the same, so it never runs out before the save. */
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

/** Notes that `device` uploads to the sync place `key` (no write when that is already known and fresh). */
export async function linkDevice(store, device, key, now = Date.now()) {
  if (!store || !isDeviceId(device)) return;
  let held = null;
  try { held = JSON.parse(await store.get(`device:${device}`)); } catch {}
  if (held?.key === key && now - held.at < REFRESH_MS) return;
  await store.put(`device:${device}`, JSON.stringify({ key, at: now }), { expirationTtl: SYNC_TTL_SECONDS });
}

/** The newest save this device uploaded: { key, rev, save, at }, or null when it has none on the server. */
export async function savedFor(store, device) {
  if (!store || !isDeviceId(device)) return null;
  let link = null;
  try { link = JSON.parse(await store.get(`device:${device}`)); } catch {}
  if (!link?.key) return null;
  const held = await store.get(`sync:${link.key}`);
  if (!held) return null;
  const record = JSON.parse(held);
  return { key: link.key, rev: record.rev, save: record.save, at: record.at };
}

/** Records an admin-made code and its inheritance pass when asked: { code, expiresAt }. */
async function issue(store, record, inheritFrom, now) {
  const fresh = async (prefix, length) => { let id; do id = makeCode(bytes => crypto.getRandomValues(bytes), length); while (await store.get(prefix + id) !== null); return id; };
  if (inheritFrom) {
    // A one-time pass, carried by the code: the device that loads it hands it in and takes over this device's records.
    record.inherit = await fresh('inherit:', SYNC_KEY_LENGTH);
    await store.put(`inherit:${record.inherit}`, JSON.stringify({ from: inheritFrom, at: now }), { expirationTtl: INHERIT_TTL_SECONDS });
  }
  const code = await fresh('code:');
  await store.put(`code:${code}`, JSON.stringify(record), { expirationTtl: ADMIN_CODE_TTL_SECONDS });
  return { code, expiresAt: new Date(now + ADMIN_CODE_TTL_SECONDS * 1000).toISOString() };
}

/**
 * A transfer code for this device's newest save, made from the admin page: { code, expiresAt, savedAt }, or null when
 * the device has no save on the server. The code carries the sync key too, so the device that loads it goes on syncing
 * with this one, exactly as a code made in the game by a linked device does. With `inherit` the loading device also
 * takes over this device's records (for a player moving for good).
 */
export async function adminCode(store, device, { inherit = false } = {}, now = Date.now()) {
  const saved = await savedFor(store, device);
  if (!saved) return null;
  return { ...(await issue(store, { save: saved.save, syncKey: saved.key }, inherit ? device : null, now)), savedAt: saved.at };
}

/** A code for a save rebuilt on the admin page (src/engine/restore-save.js) for a player whose device is gone. */
export async function restoreCode(store, device, save, { inherit = false } = {}, now = Date.now()) {
  if (!isDeviceId(device) || !looksLikeSave(save)) return null;
  return issue(store, { save }, inherit ? device : null, now);
}

/** The device a pass hands records over from, taking the pass (it works once); null when unknown or used. */
export async function takePass(store, pass) {
  if (!store || !normalizeSyncKey(pass)) return null;
  const held = await store.get(`inherit:${pass}`);
  if (!held) return null;
  await store.delete(`inherit:${pass}`);
  let from = null;
  try { from = JSON.parse(held).from; } catch {}
  if (isDeviceId(from)) await store.delete(`device:${from}`);
  return isDeviceId(from) ? from : null;
}

/** What the admin page is shown of one synced save: enough to recognise the player, never the save itself. */
function glance(raw) {
  try {
    const p = JSON.parse(raw).state?.profile || {};
    const stats = Object.values(p.stats || {}).filter(Number.isFinite);
    return { nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 12) : '', freeGears: Number(p.freeGears) || 0, playSeconds: Math.round(Number(p.playSeconds) || 0),
      cleared: Array.isArray(p.cleared) ? p.cleared.slice(0, 8) : [], owned: Array.isArray(p.ownedElements) ? p.ownedElements.slice(0, 8) : [], tuning: stats.reduce((a, b) => a + b, 0) };
  } catch { return null; }
}

/**
 * The synced saves that look like this player's (2026-11-12), best first: a device from before the game named itself
 * when uploading is found by what its last check-in reported (the ledger name, the free gears, the play time, the time
 * it was last seen) against what each save holds. Up to `limit` matches, each with a `ref` the code route takes.
 */
export async function findSaves(store, device, limit = 5, scanCap = 5000) {
  if (!store?.list || !device) return [];
  const found = [];
  let cursor, scanned = 0;
  do {
    const page = await store.list({ prefix: 'sync:', cursor });
    for (const { name } of page.keys) {
      if (scanned++ >= scanCap) break;
      const held = await store.get(name);
      if (!held) continue;
      let record = null;
      try { record = JSON.parse(held); } catch { continue; }
      const seen = glance(record.save);
      if (!seen) continue;
      const play = Math.abs(seen.playSeconds - (device.play_seconds || 0)), at = Date.parse(record.at), apart = device.last_seen && at ? Math.abs(device.last_seen - at) : Infinity;
      const why = [];
      if (device.nickname && seen.nickname === device.nickname) why.push('name');
      if (device.gears !== null && device.gears !== undefined && seen.freeGears === device.gears) why.push('gears');
      if (play <= 600) why.push('play');
      if (apart <= 2 * 3600 * 1000) why.push('time');
      // Two signs at least, and more than a name and a time: a name alone is shared by many, gears alone by every new player.
      const score = (why.includes('name') ? 3 : 0) + (why.includes('gears') ? 2 : 0) + (why.includes('play') ? 3 : play <= 3600 ? 1 : 0) + (why.includes('time') ? 1 : 0);
      if (why.length >= 2 && score >= 5) found.push({ ref: name.slice('sync:'.length), at: record.at, rev: record.rev, score, why, ...seen });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && scanned < scanCap);
  return found.sort((a, b) => b.score - a.score || Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/**
 * A code for a synced save the owner picked from findSaves: the same as adminCode, and from now on the device is linked
 * to that save (so its next codes need no search).
 */
export async function codeFromSave(store, device, ref, { inherit = false } = {}, now = Date.now()) {
  const key = normalizeSyncKey(ref);
  if (!key || !isDeviceId(device)) return null;
  const held = await store.get(`sync:${key}`);
  if (!held) return null;
  const record = JSON.parse(held);
  await linkDevice(store, device, key, now);
  return { ...(await issue(store, { save: record.save, syncKey: key }, inherit ? device : null, now)), savedAt: record.at };
}
