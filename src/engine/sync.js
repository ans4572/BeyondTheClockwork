// Linked devices: what this device remembers about the shared save, and what to do when the server holds a newer one.

/** Kept apart from the save itself, so loading a save file or a transfer never drags another device's link along. */
export const SYNC_STORE_KEY = 'beyond-the-clockwork.sync.v1';

/**
 * A short fingerprint of everything that counts as progress: the profile without its settings, and where a run stands.
 * Two states with the same mark need no choosing between them.
 */
export function progressMark(state) {
  const { settings, ...profile } = state.profile;
  const text = JSON.stringify({ profile, run: state.run ? [state.run.node, state.mode] : null });
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(36);
}

/**
 * On opening the game: `link` is { key, rev, mark } from the last upload or download, `remote` the server's { rev }.
 * keep — nothing newer elsewhere; take — another device moved on and this one did not; ask — both moved on.
 */
export function syncPlan(local, link, remote) {
  if (!remote || remote.rev <= link.rev) return 'keep';
  return progressMark(local) === link.mark ? 'take' : 'ask';
}

/** The link as stored, or null if there is none or it is unreadable. */
export function readLink(storage) {
  try {
    const link = JSON.parse(storage.getItem(SYNC_STORE_KEY) || 'null');
    return link && typeof link.key === 'string' && Number.isInteger(link.rev) && typeof link.mark === 'string' ? link : null;
  } catch { return null; }
}
export function writeLink(storage, link) {
  try { if (link) storage.setItem(SYNC_STORE_KEY, JSON.stringify(link)); else storage.removeItem(SYNC_STORE_KEY); } catch {}
}
