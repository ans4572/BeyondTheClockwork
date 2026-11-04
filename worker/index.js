// Cloudflare worker: serves the game's files, plus a small API so a player can carry a save between devices without
// an account.
// Transfer codes (one copy, five minutes):
//   POST   /api/transfer          { save, syncKey? } -> { code, expiresAt }
//   GET    /api/transfer/:code                     -> { save, syncKey? }  (the code stays until it is used or expires)
//   DELETE /api/transfer/:code                     -> { ok }               (the game calls this once the save is loaded)
// Sync (linked devices share a secret key; the save is uploaded on returning to the village):
//   POST   /api/sync              { save }           -> { key, rev }
//   GET    /api/sync/:key                            -> { rev, save, at }
//   PUT    /api/sync/:key         { save, baseRev }  -> { rev }   or 409 { rev } when another device uploaded since baseRev
import { makeCode, normalizeCode, normalizeSyncKey, looksLikeSave, CODE_TTL_SECONDS, SYNC_KEY_LENGTH, SYNC_TTL_SECONDS } from '../src/engine/transfer-code.js';

/** The copies of the game that may call the API from another address (GitHub Pages, local play). */
const ALLOWED_ORIGINS = ['https://ans4572.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173'];
/** Codes and sync keys one address may make per hour: plenty for a player, too few to fill the store. */
export const CODES_PER_HOUR = 10;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try { return await api(request, url, env, cors); }
    catch { return json({ error: 'server' }, 500, cors); }
  }
};

export async function api(request, url, env, cors = {}) {
  const store = env.TRANSFER;
  if (!store) return json({ error: 'unavailable' }, 503, cors);
  const reply = (body, status = 200) => json(body, status, cors);
  const body = async () => { try { return await request.json(); } catch { return null; } };
  /** Counts a new code or key against the caller's hour; false once the hour is used up. */
  const allowNew = async () => {
    const ip = request.headers.get('CF-Connecting-IP') || 'local', rateKey = `rate:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const made = Number(await store.get(rateKey)) || 0;
    if (made >= CODES_PER_HOUR) return false;
    await store.put(rateKey, String(made + 1), { expirationTtl: 3600 });
    return true;
  };
  const unused = async (prefix, length) => { let id; do id = makeCode(bytes => crypto.getRandomValues(bytes), length); while (await store.get(prefix + id) !== null); return id; };
  const path = url.pathname, method = request.method;

  if (path === '/api/transfer' && method === 'POST') {
    const sent = await body();
    if (!looksLikeSave(sent?.save) || (sent.syncKey !== undefined && !normalizeSyncKey(sent.syncKey))) return reply({ error: 'bad' }, 400);
    if (!(await allowNew())) return reply({ error: 'rate' }, 429);
    const code = await unused('code:', undefined);
    await store.put(`code:${code}`, JSON.stringify({ save: sent.save, syncKey: sent.syncKey }), { expirationTtl: CODE_TTL_SECONDS });
    return reply({ code, expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString() });
  }
  const transfer = path.match(/^\/api\/transfer\/([^/]+)$/);
  if (transfer && (method === 'GET' || method === 'DELETE')) {
    const code = normalizeCode(decodeURIComponent(transfer[1]));
    if (!code) return reply({ error: 'missing' }, 404);
    if (method === 'DELETE') { await store.delete(`code:${code}`); return reply({ ok: true }); }
    const held = await store.get(`code:${code}`);
    return held === null ? reply({ error: 'missing' }, 404) : reply(JSON.parse(held));
  }

  if (path === '/api/sync' && method === 'POST') {
    const sent = await body();
    if (!looksLikeSave(sent?.save)) return reply({ error: 'bad' }, 400);
    if (!(await allowNew())) return reply({ error: 'rate' }, 429);
    const key = await unused('sync:', SYNC_KEY_LENGTH);
    await store.put(`sync:${key}`, JSON.stringify({ rev: 1, save: sent.save, at: new Date().toISOString() }), { expirationTtl: SYNC_TTL_SECONDS });
    return reply({ key, rev: 1 });
  }
  const sync = path.match(/^\/api\/sync\/([^/]+)$/);
  if (sync && (method === 'GET' || method === 'PUT')) {
    const key = normalizeSyncKey(sync[1]), held = key && await store.get(`sync:${key}`);
    if (!held) return reply({ error: 'unlinked' }, 404);
    const record = JSON.parse(held);
    if (method === 'GET') return reply(record);
    const sent = await body();
    if (!looksLikeSave(sent?.save) || !Number.isInteger(sent.baseRev)) return reply({ error: 'bad' }, 400);
    if (sent.baseRev !== record.rev) return reply({ error: 'conflict', rev: record.rev }, 409);
    const rev = record.rev + 1;
    await store.put(`sync:${key}`, JSON.stringify({ rev, save: sent.save, at: new Date().toISOString() }), { expirationTtl: SYNC_TTL_SECONDS });
    return reply({ rev });
  }
  return reply({ error: 'missing' }, 404);
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
