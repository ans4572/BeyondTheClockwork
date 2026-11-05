// Play statistics kept in Cloudflare D1 (binding STATS): the game posts small events, the admin page reads a summary.
//   POST /api/stats                 one event (src/engine/stats.js cleanEvent) -> 204
//   GET  /api/admin/stats?days=30   Authorization: Bearer <ADMIN_TOKEN>        -> the summary below
// ADMIN_TOKEN is a Worker secret set in the Cloudflare dashboard; it never lives in the repository.
import { cleanEvent, koreanDay, EVENT_BYTES } from '../src/engine/stats.js';

/** Tables are made on first use, so a fresh database needs no migration step. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, form TEXT, os TEXT, browser TEXT, installed INTEGER DEFAULT 0, first_day TEXT, last_day TEXT, opens INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT, day TEXT, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS sessions_day ON sessions (day)`,
  `CREATE TABLE IF NOT EXISTS runs (device TEXT, run TEXT, day TEXT, combo TEXT, started_at INTEGER, ended_at INTEGER, reason TEXT, node INTEGER, seconds INTEGER, PRIMARY KEY (device, run))`,
  `CREATE INDEX IF NOT EXISTS runs_day ON runs (day)`
];
const ready = new WeakMap();
const ensure = db => { if (!ready.has(db)) ready.set(db, db.batch(SCHEMA.map(sql => db.prepare(sql))).catch(error => { ready.delete(db); throw error; })); return ready.get(db); };

/** Stores one event. False when the body is not a valid event. */
export async function record(db, sent, now = Date.now()) {
  const event = cleanEvent(sent);
  if (!event) return false;
  await ensure(db);
  const day = koreanDay(now);
  if (event.kind === 'open') {
    await db.batch([
      db.prepare(`INSERT INTO devices (id, form, os, browser, installed, first_day, last_day, opens) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 1)
        ON CONFLICT (id) DO UPDATE SET form = ?2, os = ?3, browser = ?4, installed = MAX(installed, ?5), last_day = ?6, opens = opens + 1`)
        .bind(event.device, event.form, event.os, event.browser, event.installed ? 1 : 0, day),
      db.prepare(`INSERT INTO sessions (device, day, at) VALUES (?1, ?2, ?3)`).bind(event.device, day, now)
    ]);
  } else if (event.kind === 'runStart') {
    await db.prepare(`INSERT OR IGNORE INTO runs (device, run, day, combo, started_at) VALUES (?1, ?2, ?3, ?4, ?5)`).bind(event.device, event.run, day, event.combo, now).run();
  } else {
    // An end with no start (a run begun before statistics existed) still counts, on the day it came back.
    await db.prepare(`INSERT INTO runs (device, run, day, combo, ended_at, reason, node, seconds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT (device, run) DO UPDATE SET ended_at = ?5, reason = ?6, node = ?7, seconds = ?8`)
      .bind(event.device, event.run, day, event.combo, now, event.reason, event.node, event.seconds).run();
  }
  return true;
}

/** Days, oldest first, from `since` to today. */
const daysFrom = (since, today) => { const out = []; for (let t = Date.parse(since); ; t += 86400000) { const day = new Date(t).toISOString().slice(0, 10); out.push(day); if (day >= today) return out; } };

/**
 * Everything the admin page shows for the last `days` days (0 = since the start).
 * totals, daily rows, device breakdowns over the devices that played in the range, element combos, where runs ended,
 * and the latest runs.
 */
export async function summary(db, days = 30, now = Date.now()) {
  await ensure(db);
  const today = koreanDay(now), since = days > 0 ? koreanDay(now - (days - 1) * 86400000) : '0000-00-00';
  const all = (sql, ...args) => db.prepare(sql).bind(...args).all().then(r => r.results);
  const [[devices], [sessionTotals], [runTotals], sessionDays, newDays, runDays, forms, systems, browsers, combos, depth, recent] = await Promise.all([
    all(`SELECT COUNT(*) AS everyone, SUM(first_day >= ?1) AS fresh, SUM(installed) AS installed FROM devices`, since),
    all(`SELECT COUNT(*) AS sessions, COUNT(DISTINCT device) AS active FROM sessions WHERE day >= ?1`, since),
    all(`SELECT COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons, SUM(reason IS NULL) AS open,
      AVG(CASE WHEN reason IS NOT NULL THEN node END) AS node, AVG(CASE WHEN reason IS NOT NULL THEN seconds END) AS seconds FROM runs WHERE day >= ?1`, since),
    all(`SELECT day, COUNT(*) AS sessions, COUNT(DISTINCT device) AS devices FROM sessions WHERE day >= ?1 GROUP BY day`, since),
    all(`SELECT first_day AS day, COUNT(*) AS fresh FROM devices WHERE first_day >= ?1 GROUP BY first_day`, since),
    all(`SELECT day, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons, AVG(seconds) AS seconds FROM runs WHERE day >= ?1 GROUP BY day`, since),
    ...['form', 'os', 'browser'].map(column => all(`SELECT d.${column} AS name, COUNT(DISTINCT s.device) AS devices, COUNT(*) AS sessions FROM sessions s JOIN devices d ON d.id = s.device WHERE s.day >= ?1 GROUP BY d.${column} ORDER BY devices DESC, sessions DESC`, since)),
    all(`SELECT combo, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons,
      AVG(CASE WHEN reason IS NOT NULL THEN node END) AS node FROM runs WHERE day >= ?1 GROUP BY combo ORDER BY runs DESC`, since),
    all(`SELECT node, COUNT(*) AS runs, SUM(reason = 'clear') AS clears FROM runs WHERE day >= ?1 AND reason IS NOT NULL GROUP BY node ORDER BY node`, since),
    all(`SELECT r.day, r.combo, r.reason, r.node, r.seconds, d.form, d.os FROM runs r LEFT JOIN devices d ON d.id = r.device WHERE r.day >= ?1
      ORDER BY COALESCE(r.ended_at, r.started_at) DESC LIMIT 20`, since)
  ]);
  const first = days > 0 ? since : [sessionDays[0]?.day, runDays[0]?.day, newDays[0]?.day].filter(Boolean).sort()[0] || today;
  const byDay = rows => new Map(rows.map(row => [row.day, row]));
  const s = byDay(sessionDays), f = byDay(newDays), r = byDay(runDays);
  const n = value => Number(value) || 0;
  return {
    range: { days, from: first, to: today },
    totals: {
      devices: n(devices.everyone), installed: n(devices.installed), newDevices: n(devices.fresh), activeDevices: n(sessionTotals.active), sessions: n(sessionTotals.sessions),
      runs: n(runTotals.runs), clears: n(runTotals.clears), defeats: n(runTotals.defeats), abandons: n(runTotals.abandons), unfinished: n(runTotals.open),
      averageNode: runTotals.node === null ? null : Math.round(runTotals.node * 10) / 10, averageSeconds: runTotals.seconds === null ? null : Math.round(runTotals.seconds)
    },
    daily: daysFrom(first, today).map(day => ({ day, sessions: n(s.get(day)?.sessions), devices: n(s.get(day)?.devices), newDevices: n(f.get(day)?.fresh), runs: n(r.get(day)?.runs), clears: n(r.get(day)?.clears), defeats: n(r.get(day)?.defeats), abandons: n(r.get(day)?.abandons), averageSeconds: r.get(day)?.seconds == null ? null : Math.round(r.get(day).seconds) })),
    devices: { form: forms, os: systems, browser: browsers },
    combos: combos.map(row => ({ combo: row.combo, runs: n(row.runs), clears: n(row.clears), defeats: n(row.defeats), abandons: n(row.abandons), averageNode: row.node === null ? null : Math.round(row.node * 10) / 10 })),
    depth: depth.map(row => ({ node: row.node, runs: n(row.runs), clears: n(row.clears) })),
    recent
  };
}

/** Whether a request carries the admin token, compared through fixed-length digests so timing says nothing. */
export async function isAdmin(request, token) {
  const sent = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!sent) return false;
  const digest = text => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(buffer => new Uint8Array(buffer));
  const [a, b] = await Promise.all([digest(sent), digest(token)]);
  let differ = 0;
  for (let i = 0; i < a.length; i++) differ |= a[i] ^ b[i];
  return differ === 0;
}

/** The two stats routes; null when the path is not one of them. */
export async function statsApi(request, url, env, reply, cors = {}) {
  const path = url.pathname, method = request.method;
  if (path === '/api/stats' && method === 'POST') {
    if (!env.STATS) return reply({ error: 'unavailable' }, 503);
    const text = await request.text();
    if (text.length > EVENT_BYTES) return reply({ error: 'bad' }, 400);
    let sent = null;
    try { sent = JSON.parse(text); } catch {}
    return (await record(env.STATS, sent)) ? new Response(null, { status: 204, headers: cors }) : reply({ error: 'bad' }, 400);
  }
  if (path === '/api/admin/stats' && method === 'GET') {
    // A short token would be guessable, so the page stays shut until a long one is set.
    if (!env.STATS || typeof env.ADMIN_TOKEN !== 'string' || env.ADMIN_TOKEN.length < 24) return reply({ error: 'unconfigured' }, 503);
    if (!(await isAdmin(request, env.ADMIN_TOKEN))) return reply({ error: 'denied' }, 401);
    const days = Number(url.searchParams.get('days'));
    return reply(await summary(env.STATS, [7, 30, 90, 0].includes(days) ? days : 30));
  }
  return null;
}
