// Cloudflare worker: serves the game's files, plus a small API that holds a save under a short code for five minutes,
// so a player can carry it from one device to another without an account.
//   POST   /api/transfer          { save }  -> { code, expiresAt }
//   GET    /api/transfer/:code              -> { save }       (the code stays until it is used or expires)
//   DELETE /api/transfer/:code              -> { ok }         (the game calls this once the save is loaded)
import { makeCode, normalizeCode, looksLikeSave, CODE_TTL_SECONDS } from '../src/engine/transfer-code.js';

/** The copies of the game that may call the API from another address (GitHub Pages, local play). */
const ALLOWED_ORIGINS = ['https://ans4572.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173'];
/** Codes one address may make per hour: plenty for a player, too few to fill the store. */
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
  if (url.pathname === '/api/transfer' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'local', hour = Math.floor(Date.now() / 3600000), rateKey = `rate:${ip}:${hour}`;
    const made = Number(await store.get(rateKey)) || 0;
    if (made >= CODES_PER_HOUR) return json({ error: 'rate' }, 429, cors);
    let body; try { body = await request.json(); } catch { return json({ error: 'bad' }, 400, cors); }
    if (!looksLikeSave(body?.save)) return json({ error: 'bad' }, 400, cors);
    let code; do code = makeCode(bytes => crypto.getRandomValues(bytes)); while (await store.get(`code:${code}`) !== null);
    await store.put(`code:${code}`, body.save, { expirationTtl: CODE_TTL_SECONDS });
    await store.put(rateKey, String(made + 1), { expirationTtl: 3600 });
    return json({ code, expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString() }, 200, cors);
  }
  const match = url.pathname.match(/^\/api\/transfer\/([^/]+)$/);
  if (match && (request.method === 'GET' || request.method === 'DELETE')) {
    const code = normalizeCode(decodeURIComponent(match[1]));
    if (!code) return json({ error: 'missing' }, 404, cors);
    if (request.method === 'DELETE') { await store.delete(`code:${code}`); return json({ ok: true }, 200, cors); }
    const save = await store.get(`code:${code}`);
    return save === null ? json({ error: 'missing' }, 404, cors) : json({ save }, 200, cors);
  }
  return json({ error: 'missing' }, 404, cors);
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
