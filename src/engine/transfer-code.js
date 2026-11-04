// Moving a save between devices: a short code stands for the save for five minutes. Shared by the game and the Cloudflare worker.

/** No 0/O, 1/I/L: a code read off one screen and typed on another must not be ambiguous. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 8;
/** Long enough to pick up the other device and type eight letters; short enough that the store stays nearly empty. */
export const CODE_TTL_SECONDS = 5 * 60;
/** A save is a few kilobytes; anything far larger is not one. */
export const MAX_SAVE_BYTES = 512 * 1024;

/** A fresh code from a random source that fills a byte array (crypto.getRandomValues). */
export function makeCode(fillRandom) {
  const bytes = fillRandom(new Uint8Array(CODE_LENGTH * 2));
  let code = '';
  // Rejection keeps every letter equally likely: 248 is the largest multiple of 31 below 256.
  for (const byte of bytes) if (byte < 248 && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code.length === CODE_LENGTH ? code : makeCode(fillRandom);
}
/** What a player typed, as a code: case, spaces and dashes ignored. Null if it cannot be one. */
export function normalizeCode(typed) {
  const code = String(typed || '').toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every(ch => CODE_ALPHABET.includes(ch)) ? code : null;
}
/** Shown in two halves, "K7Q4-MZPA", so it is easy to read aloud and copy by hand. */
export const formatCode = code => `${code.slice(0, 4)}-${code.slice(4)}`;
/** The worker only checks that it holds something shaped like a save; the game checks the rest when it loads it. */
export function looksLikeSave(raw) {
  if (typeof raw !== 'string' || !raw || new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) return false;
  try { const save = JSON.parse(raw); return save?.version === 1 && !!save.state?.profile && !!save.state?.player; } catch { return false; }
}
