// Play statistics kept in Cloudflare D1 (binding STATS): the game posts small events, the admin page reads a summary.
//   POST /api/stats                 one event (src/engine/stats.js cleanEvent) -> 204, or for a ping { mail: [gifts] }
//   POST /api/mail/claim            { device, ids }  the game took these gifts                   -> { ok }
//   GET  /api/records?device=       per difficulty: the server's three fastest players, and this device's own -> { easy: { tops, top, me }, … }
//        &difficulty=&at=           …and where a clear of `at` seconds would stand there -> { hard: { …, standing: { seconds, place, players } } }
// Admin routes (Authorization: Bearer <ADMIN_TOKEN>):
//   GET    /api/admin/stats?days=7|30|0&difficulty=   the summary below
//   GET    /api/admin/users?q=               players (devices), most recently seen first
//   GET    /api/admin/users/:id              one player: details, recent runs, gifts
//   POST   /api/admin/users/:id/memo         { memo }                    a name only the admin page shows
//   POST   /api/admin/users/:id/transfer     { ref?, inherit? } a transfer code (one day) for this player's newest uploaded save -> { code, expiresAt, savedAt }
//   GET    /api/admin/users/:id/saves        synced saves that look like this player's (a device from before it named itself) -> { saves }
//   POST   /api/admin/users/:id/restore      { save, inherit? } a transfer code for a save rebuilt by hand (src/engine/restore-save.js)
// With inherit the code carries a one-time pass; the device that loads it posts it back:
//   POST   /api/inherit                      { device, pass }  that device takes over the old one's runs, gifts and memo -> { ok }
//   POST   /api/admin/gifts                  { device, gears, note }     free gears the game hands over on its next ping
//   DELETE /api/admin/gifts/:id              take back a gift that has not arrived yet
// ADMIN_TOKEN is a Worker secret set in the Cloudflare dashboard; it never lives in the repository.
import { cleanEvent, koreanDay, isDeviceId, plainText, DIFFICULTIES, FIRST_CHAPTER_ID, EVENT_BYTES, ONLINE_SECONDS, GIFT_MAX_GEARS, GIFT_NOTE_MAX, MEMO_MAX } from '../src/engine/stats.js';
import { MIN_CLEAR_SECONDS, comboElements } from '../src/engine/records.js';
import { savedFor, adminCode, restoreCode, takePass, findSaves, codeFromSave } from './device-link.js';

/** Tables are made on first use, so a fresh database needs no migration step. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, form TEXT, os TEXT, browser TEXT, installed INTEGER DEFAULT 0, first_day TEXT, last_day TEXT, opens INTEGER DEFAULT 0,
    last_seen INTEGER, where_now TEXT, node_now INTEGER, gears INTEGER, play_seconds INTEGER, memo TEXT, nickname TEXT)`,
  `CREATE TABLE IF NOT EXISTS gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT, gears INTEGER, note TEXT, created_at INTEGER, claimed_at INTEGER, cancelled_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS gifts_device ON gifts (device)`,
  `CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT, day TEXT, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS sessions_day ON sessions (day)`,
  `CREATE TABLE IF NOT EXISTS runs (device TEXT, run TEXT, day TEXT, combo TEXT, started_at INTEGER, ended_at INTEGER, reason TEXT, node INTEGER, seconds INTEGER, difficulty TEXT, PRIMARY KEY (device, run))`,
  `CREATE INDEX IF NOT EXISTS runs_day ON runs (day)`
];
/** Columns added after the first tables went live; on a database that has them already the statement fails and is skipped. */
const MIGRATIONS = [`ALTER TABLE runs ADD COLUMN difficulty TEXT`, `ALTER TABLE runs ADD COLUMN chapter TEXT`, `ALTER TABLE devices ADD COLUMN chapter_now TEXT`, `ALTER TABLE devices ADD COLUMN difficulty_now TEXT`];
const ready = new WeakMap();
const setUp = async db => { await db.batch(SCHEMA.map(sql => db.prepare(sql))); for (const sql of MIGRATIONS) await db.prepare(sql).run().catch(() => {}); };
const ensure = db => { if (!ready.has(db)) ready.set(db, setUp(db).catch(error => { ready.delete(db); throw error; })); return ready.get(db); };

/** Gifts made for a device that it has not taken yet, oldest first. */
const waiting = (db, device) => db.prepare(`SELECT id, gears, note FROM gifts WHERE device = ?1 AND claimed_at IS NULL AND cancelled_at IS NULL ORDER BY id`).bind(device).all().then(r => r.results.map(row => ({ ...row })));

/** Stores one event: null when the body is not a valid event, else {} — or { mail } for a ping. */
export async function record(db, sent, now = Date.now()) {
  const event = cleanEvent(sent);
  if (!event) return null;
  await ensure(db);
  const day = koreanDay(now);
  if (event.kind === 'open') {
    await db.batch([
      db.prepare(`INSERT INTO devices (id, form, os, browser, installed, first_day, last_day, opens, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 1, ?7)
        ON CONFLICT (id) DO UPDATE SET form = ?2, os = ?3, browser = ?4, installed = MAX(installed, ?5), last_day = ?6, opens = opens + 1, last_seen = ?7`)
        .bind(event.device, event.form, event.os, event.browser, event.installed ? 1 : 0, day, now),
      db.prepare(`INSERT INTO sessions (device, day, at) VALUES (?1, ?2, ?3)`).bind(event.device, day, now)
    ]);
  } else if (event.kind === 'ping') {
    // A device that never sent an open (it began before statistics existed) is still listed, with its kind unknown.
    await db.prepare(`INSERT INTO devices (id, first_day, last_day, last_seen, where_now, node_now, gears, play_seconds, nickname, chapter_now, difficulty_now) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT (id) DO UPDATE SET last_day = ?2, last_seen = ?3, where_now = ?4, node_now = ?5, gears = ?6, play_seconds = ?7, nickname = ?8, chapter_now = ?9, difficulty_now = ?10`)
      .bind(event.device, day, now, event.where, event.node, event.gears, event.playSeconds, event.name || null, event.chapter || null, event.difficulty || null).run();
    return { mail: await waiting(db, event.device) };
  } else if (event.kind === 'runStart') {
    await db.prepare(`INSERT OR IGNORE INTO runs (device, run, day, combo, started_at, difficulty, chapter) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(event.device, event.run, day, event.combo, now, event.difficulty, event.chapter).run();
  } else {
    // An end with no start (a run begun before statistics existed) still counts, on the day it came back.
    await db.prepare(`INSERT INTO runs (device, run, day, combo, ended_at, reason, node, seconds, difficulty, chapter) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      ON CONFLICT (device, run) DO UPDATE SET ended_at = ?5, reason = ?6, node = ?7, seconds = ?8, difficulty = COALESCE(runs.difficulty, ?9), chapter = COALESCE(runs.chapter, ?10)`)
      .bind(event.device, event.run, day, event.combo, now, event.reason, event.node, event.seconds, event.difficulty, event.chapter).run();
  }
  return {};
}

/** The game took these gifts (it keeps their ids in the save too, so a lost claim never pays twice). */
export async function claimGifts(db, device, ids, now = Date.now()) {
  if (!isDeviceId(device) || !Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(id => Number.isInteger(id) && id > 0)) return false;
  await ensure(db);
  await db.batch(ids.map(id => db.prepare(`UPDATE gifts SET claimed_at = ?3 WHERE id = ?1 AND device = ?2 AND claimed_at IS NULL AND cancelled_at IS NULL`).bind(id, device, now)));
  return true;
}

const USER_COLUMNS = `d.id, d.memo, d.nickname, d.form, d.os, d.browser, d.installed, d.first_day, d.last_day, d.last_seen, d.where_now, d.node_now, d.chapter_now, d.difficulty_now, d.gears, d.play_seconds, d.opens,
  COALESCE(r.runs, 0) AS runs, COALESCE(r.clears, 0) AS clears, r.best AS best, COALESCE(g.given, 0) AS given, COALESCE(g.pending, 0) AS pending`;
const USER_JOINS = `FROM devices d
  LEFT JOIN (SELECT device, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, MAX(node) AS best FROM runs GROUP BY device) r ON r.device = d.id
  LEFT JOIN (SELECT device, SUM(CASE WHEN cancelled_at IS NULL THEN gears ELSE 0 END) AS given, SUM(claimed_at IS NULL AND cancelled_at IS NULL) AS pending FROM gifts GROUP BY device) g ON g.device = d.id`;
const plain = row => ({ ...row });

/** Players, most recently seen first (at most 300), with a search over the id's start, the ledger name and the memo. */
export async function users(db, query = '', now = Date.now()) {
  await ensure(db);
  const q = plainText(query, MEMO_MAX).replace(/[%_\\]/g, '');
  const [list, [counts]] = await Promise.all([
    db.prepare(`SELECT ${USER_COLUMNS} ${USER_JOINS} WHERE ?1 = '' OR d.id LIKE ?1 || '%' OR d.memo LIKE '%' || ?1 || '%' OR d.nickname LIKE '%' || ?1 || '%' ORDER BY COALESCE(d.last_seen, 0) DESC, d.last_day DESC LIMIT 300`).bind(q).all().then(r => r.results.map(plain)),
    db.prepare(`SELECT COUNT(*) AS everyone, SUM(last_seen >= ?1) AS online, SUM(last_day = ?2) AS today, (SELECT COUNT(*) FROM gifts WHERE claimed_at IS NULL AND cancelled_at IS NULL) AS pending FROM devices`).bind(now - ONLINE_SECONDS * 1000, koreanDay(now)).all().then(r => r.results.map(plain))
  ]);
  const n = value => Number(value) || 0;
  return { now, onlineSeconds: ONLINE_SECONDS, counts: { everyone: n(counts.everyone), online: n(counts.online), today: n(counts.today), pending: n(counts.pending) }, users: list };
}

/** One player: the same row as the list, their last 20 runs and their gifts (newest first). Null when unknown. */
export async function user(db, id, now = Date.now()) {
  if (!isDeviceId(id)) return null;
  await ensure(db);
  const [[row], runs, gifts] = await Promise.all([
    db.prepare(`SELECT ${USER_COLUMNS} ${USER_JOINS} WHERE d.id = ?1`).bind(id).all().then(r => r.results.map(plain)),
    db.prepare(`SELECT day, combo, reason, node, seconds, difficulty FROM runs WHERE device = ?1 ORDER BY COALESCE(ended_at, started_at) DESC LIMIT 20`).bind(id).all().then(r => r.results.map(plain)),
    db.prepare(`SELECT id, gears, note, created_at, claimed_at, cancelled_at FROM gifts WHERE device = ?1 ORDER BY id DESC LIMIT 50`).bind(id).all().then(r => r.results.map(plain))
  ]);
  return row ? { now, onlineSeconds: ONLINE_SECONDS, user: row, runs, gifts } : null;
}

/** A gift of free gears to one known device; null when the device or the amount is wrong. */
export async function give(db, sent, now = Date.now()) {
  const gears = sent?.gears, note = plainText(sent?.note, GIFT_NOTE_MAX);
  if (!isDeviceId(sent?.device) || !Number.isInteger(gears) || gears < 1 || gears > GIFT_MAX_GEARS) return null;
  await ensure(db);
  if (!(await db.prepare(`SELECT id FROM devices WHERE id = ?1`).bind(sent.device).first())) return null;
  await db.prepare(`INSERT INTO gifts (device, gears, note, created_at) VALUES (?1, ?2, ?3, ?4)`).bind(sent.device, gears, note, now).run();
  const made = await db.prepare(`SELECT id, gears, note, created_at FROM gifts WHERE device = ?1 ORDER BY id DESC LIMIT 1`).bind(sent.device).first();
  return made && { ...made };
}

/**
 * A player moved to a new device with a code made on the admin page (2026-11-12): the new device takes over the old
 * one's runs (so its clears and the server board's own records follow it), opens, gifts and the admin's memo, and the
 * old row goes. A run id both devices used (rare: the count is carried over) stays with the new device.
 */
export async function inheritRecords(db, from, to) {
  if (!isDeviceId(from) || !isDeviceId(to) || from === to) return false;
  await ensure(db);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO devices (id, first_day, last_day, opens, last_seen) SELECT ?2, first_day, last_day, 0, last_seen FROM devices WHERE id = ?1`).bind(from, to),
    db.prepare(`UPDATE devices SET memo = COALESCE(memo, (SELECT memo FROM devices WHERE id = ?1)), opens = COALESCE(opens, 0) + COALESCE((SELECT opens FROM devices WHERE id = ?1), 0),
      first_day = COALESCE((SELECT first_day FROM devices WHERE id = ?1 AND first_day < COALESCE(devices.first_day, '9999')), first_day) WHERE id = ?2`).bind(from, to),
    db.prepare(`UPDATE OR IGNORE runs SET device = ?2 WHERE device = ?1`).bind(from, to),
    db.prepare(`DELETE FROM runs WHERE device = ?1`).bind(from),
    db.prepare(`UPDATE sessions SET device = ?2 WHERE device = ?1`).bind(from, to),
    db.prepare(`UPDATE gifts SET device = ?2 WHERE device = ?1`).bind(from, to),
    db.prepare(`DELETE FROM devices WHERE id = ?1`).bind(from)
  ]);
  return true;
}

/** Days, oldest first, from `since` to today. */
const daysFrom = (since, today) => { const out = []; for (let t = Date.parse(since); ; t += 86400000) { const day = new Date(t).toISOString().slice(0, 10); out.push(day); if (day >= today) return out; } };

/**
 * Everything the admin page shows for the last `days` days (0 = since the start).
 * totals, daily rows, device breakdowns over the devices that played in the range, element combos, where runs ended,
 * and the latest runs.
 */
/**
 * `difficulty` ('easy' | 'normal' | 'hard', or '' for all) narrows every expedition figure (totals, days, pairs, stops,
 * recent runs) to runs set out on it; plays and devices stay as they are. `difficulties` always counts all of them,
 * runs from before difficulties existed as 'legacy'. `difficultiesByChapter` is the same per chapter (2026-11-09), runs
 * from before they carried their chapter counted as chapter 1's.
 */
export async function summary(db, days = 30, now = Date.now(), difficulty = '') {
  await ensure(db);
  const today = koreanDay(now), since = days > 0 ? koreanDay(now - (days - 1) * 86400000) : '0000-00-00', pick = DIFFICULTIES.includes(difficulty) ? difficulty : '';
  const all = (sql, ...args) => db.prepare(sql).bind(...args).all().then(r => r.results);
  const level = `(?2 = '' OR difficulty = ?2)`;
  const [[devices], [sessionTotals], [runTotals], sessionDays, newDays, runDays, forms, systems, browsers, combos, depth, recent, levels, chapterLevels] = await Promise.all([
    all(`SELECT COUNT(*) AS everyone, SUM(first_day >= ?1) AS fresh, SUM(installed) AS installed FROM devices`, since),
    all(`SELECT COUNT(*) AS sessions, COUNT(DISTINCT device) AS active FROM sessions WHERE day >= ?1`, since),
    all(`SELECT COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons, SUM(reason IS NULL) AS open,
      AVG(CASE WHEN reason IS NOT NULL THEN node END) AS node, AVG(CASE WHEN reason IS NOT NULL THEN seconds END) AS seconds FROM runs WHERE day >= ?1 AND ${level}`, since, pick),
    all(`SELECT day, COUNT(*) AS sessions, COUNT(DISTINCT device) AS devices FROM sessions WHERE day >= ?1 GROUP BY day`, since),
    all(`SELECT first_day AS day, COUNT(*) AS fresh FROM devices WHERE first_day >= ?1 GROUP BY first_day`, since),
    all(`SELECT day, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons, AVG(seconds) AS seconds FROM runs WHERE day >= ?1 AND ${level} GROUP BY day`, since, pick),
    ...['form', 'os', 'browser'].map(column => all(`SELECT d.${column} AS name, COUNT(DISTINCT s.device) AS devices, COUNT(*) AS sessions FROM sessions s JOIN devices d ON d.id = s.device WHERE s.day >= ?1 GROUP BY d.${column} ORDER BY devices DESC, sessions DESC`, since)),
    all(`SELECT combo, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons,
      AVG(CASE WHEN reason IS NOT NULL THEN node END) AS node FROM runs WHERE day >= ?1 AND ${level} GROUP BY combo ORDER BY runs DESC`, since, pick),
    all(`SELECT node, COUNT(*) AS runs, SUM(reason = 'clear') AS clears FROM runs WHERE day >= ?1 AND ${level} AND reason IS NOT NULL GROUP BY node ORDER BY node`, since, pick),
    all(`SELECT r.day, r.combo, r.reason, r.node, r.seconds, r.difficulty, d.form, d.os FROM runs r LEFT JOIN devices d ON d.id = r.device WHERE r.day >= ?1 AND (?2 = '' OR r.difficulty = ?2)
      ORDER BY COALESCE(r.ended_at, r.started_at) DESC LIMIT 20`, since, pick),
    all(`SELECT COALESCE(difficulty, 'legacy') AS difficulty, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons, SUM(reason IS NULL) AS open,
      AVG(CASE WHEN reason IS NOT NULL THEN node END) AS node, AVG(CASE WHEN reason IS NOT NULL THEN seconds END) AS seconds, COUNT(DISTINCT device) AS devices FROM runs WHERE day >= ?1 GROUP BY 1`, since),
    all(`SELECT COALESCE(chapter, ?2) AS chapter, COALESCE(difficulty, 'legacy') AS difficulty, COUNT(*) AS runs, SUM(reason = 'clear') AS clears, SUM(reason = 'defeat') AS defeats, SUM(reason = 'abandon') AS abandons, SUM(reason IS NULL) AS open,
      AVG(CASE WHEN reason IS NOT NULL THEN node END) AS node, AVG(CASE WHEN reason IS NOT NULL THEN seconds END) AS seconds, COUNT(DISTINCT device) AS devices FROM runs WHERE day >= ?1 GROUP BY 1, 2`, since, FIRST_CHAPTER_ID)
  ]);
  const first = days > 0 ? since : [sessionDays[0]?.day, runDays[0]?.day, newDays[0]?.day].filter(Boolean).sort()[0] || today;
  const byDay = rows => new Map(rows.map(row => [row.day, row]));
  const s = byDay(sessionDays), f = byDay(newDays), r = byDay(runDays);
  const n = value => Number(value) || 0;
  return {
    range: { days, from: first, to: today, difficulty: pick },
    totals: {
      devices: n(devices.everyone), installed: n(devices.installed), newDevices: n(devices.fresh), activeDevices: n(sessionTotals.active), sessions: n(sessionTotals.sessions),
      runs: n(runTotals.runs), clears: n(runTotals.clears), defeats: n(runTotals.defeats), abandons: n(runTotals.abandons), unfinished: n(runTotals.open),
      averageNode: runTotals.node === null ? null : Math.round(runTotals.node * 10) / 10, averageSeconds: runTotals.seconds === null ? null : Math.round(runTotals.seconds)
    },
    daily: daysFrom(first, today).map(day => ({ day, sessions: n(s.get(day)?.sessions), devices: n(s.get(day)?.devices), newDevices: n(f.get(day)?.fresh), runs: n(r.get(day)?.runs), clears: n(r.get(day)?.clears), defeats: n(r.get(day)?.defeats), abandons: n(r.get(day)?.abandons), averageSeconds: r.get(day)?.seconds == null ? null : Math.round(r.get(day).seconds) })),
    devices: { form: forms, os: systems, browser: browsers },
    combos: combos.map(row => ({ combo: row.combo, runs: n(row.runs), clears: n(row.clears), defeats: n(row.defeats), abandons: n(row.abandons), averageNode: row.node === null ? null : Math.round(row.node * 10) / 10 })),
    depth: depth.map(row => ({ node: row.node, runs: n(row.runs), clears: n(row.clears) })),
    recent,
    difficulties: levelRows(levels),
    difficultiesByChapter: Object.fromEntries([...new Set(chapterLevels.map(row => row.chapter))].map(chapter => [chapter, levelRows(chapterLevels.filter(row => row.chapter === chapter))]))
  };
  function levelRows(rows) {
    return ['easy', 'normal', 'hard', 'legacy'].map(id => rows.find(row => row.difficulty === id) || { difficulty: id }).map(row => ({
      difficulty: row.difficulty, runs: n(row.runs), devices: n(row.devices), clears: n(row.clears), defeats: n(row.defeats), abandons: n(row.abandons), unfinished: n(row.open),
      averageNode: row.node == null ? null : Math.round(row.node * 10) / 10, averageSeconds: row.seconds == null ? null : Math.round(row.seconds)
    })).filter(row => row.difficulty !== 'legacy' || row.runs);
  }
}

/**
 * The difficulty cards' records, from the runs already kept: per difficulty the three fastest players on the server, each
 * by their own best clear (its time, element pair and the ledger name of whoever made it, never their device id; `top`
 * is the first of them, as before 2026-11-12) and, when a device is named, that
 * device's own best, clear count and furthest stop. Clears under MIN_CLEAR_SECONDS are not real runs and are skipped.
 */
/** How many players each difficulty's board names (2026-11-12: 1 → 3). */
export const BOARD_SIZE = 3;
export async function records(db, device = '', chapter = FIRST_CHAPTER_ID, at = null) {
  await ensure(db);
  // One chapter's board (2026-11-11); runs from before they carried their chapter are chapter 1's.
  const mine = isDeviceId(device) ? device : '', ch = /^[a-z][a-z-]{0,31}$/.test(chapter || '') ? chapter : FIRST_CHAPTER_ID;
  // One row per device, its best clear (SQLite takes the other columns from the row MIN picked), the fastest BOARD_SIZE.
  const tops = DIFFICULTIES.map(id => db.prepare(`SELECT t.seconds, t.combo, t.device, d.nickname FROM (
      SELECT r.device, MIN(r.seconds) AS seconds, r.combo, r.ended_at FROM runs r
      WHERE r.reason = 'clear' AND r.difficulty = ?1 AND r.seconds >= ?2 AND COALESCE(r.chapter, ?3) = ?4 GROUP BY r.device
    ) t LEFT JOIN devices d ON d.id = t.device ORDER BY t.seconds, t.ended_at LIMIT ?5`).bind(id, MIN_CLEAR_SECONDS, FIRST_CHAPTER_ID, ch, BOARD_SIZE));
  const own = mine ? DIFFICULTIES.flatMap(id => [
    db.prepare(`SELECT seconds, combo FROM runs WHERE device = ?1 AND difficulty = ?2 AND reason = 'clear' AND seconds >= ?3 AND COALESCE(chapter, ?4) = ?5 ORDER BY seconds LIMIT 1`).bind(mine, id, MIN_CLEAR_SECONDS, FIRST_CHAPTER_ID, ch),
    db.prepare(`SELECT SUM(reason = 'clear') AS clears, MAX(node) AS furthest FROM runs WHERE device = ?1 AND difficulty = ?2 AND COALESCE(chapter, ?3) = ?4`).bind(mine, id, FIRST_CHAPTER_ID, ch)
  ]) : [];
  // The chapter's end popup asks where the clear it shows would stand before that run is sent (2026-11-12): the other
  // players' bests, and how many of them are faster.
  const asked = at && DIFFICULTIES.includes(at.difficulty) && Number.isFinite(at.seconds) && at.seconds >= MIN_CLEAR_SECONDS ? { difficulty: at.difficulty, seconds: Math.round(at.seconds) } : null;
  const standing = asked ? [db.prepare(`SELECT COUNT(*) AS others, COALESCE(SUM(s < ?6), 0) AS ahead FROM (
      SELECT device, MIN(seconds) AS s FROM runs WHERE reason = 'clear' AND difficulty = ?1 AND seconds >= ?2 AND COALESCE(chapter, ?3) = ?4 AND device != ?5 GROUP BY device)`).bind(asked.difficulty, MIN_CLEAR_SECONDS, FIRST_CHAPTER_ID, ch, mine, asked.seconds)] : [];
  const out = await db.batch([...tops, ...own, ...standing]), rows = result => result?.results?.[0] || null;
  const stood = asked ? rows(out.at(-1)) : null;
  const entry = row => ({ seconds: row.seconds, elements: comboElements(row.combo), name: row.nickname || '', mine: !!mine && row.device === mine });
  return Object.fromEntries(DIFFICULTIES.map((id, i) => {
    const board = (out[i]?.results || []).map(entry), best = mine ? rows(out[DIFFICULTIES.length + i * 2]) : null, totals = mine ? rows(out[DIFFICULTIES.length + i * 2 + 1]) : null;
    return [id, {
      tops: board, top: board[0] || null,
      ...(asked?.difficulty === id ? { standing: { seconds: asked.seconds, place: (Number(stood?.ahead) || 0) + 1, players: (Number(stood?.others) || 0) + 1 } } : {}),
      me: mine ? { best: best?.seconds ?? null, elements: comboElements(best?.combo), clears: Number(totals?.clears) || 0, furthest: Number(totals?.furthest) || 0 } : null
    }];
  }));
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
    const done = await record(env.STATS, sent);
    if (!done) return reply({ error: 'bad' }, 400);
    return done.mail ? reply({ mail: done.mail }) : new Response(null, { status: 204, headers: cors });
  }
  if (path === '/api/mail/claim' && method === 'POST') {
    if (!env.STATS) return reply({ error: 'unavailable' }, 503);
    const text = await request.text();
    let sent = null;
    try { sent = text.length <= EVENT_BYTES ? JSON.parse(text) : null; } catch {}
    return (await claimGifts(env.STATS, sent?.device, sent?.ids)) ? reply({ ok: true }) : reply({ error: 'bad' }, 400);
  }
  if (path === '/api/inherit' && method === 'POST') {
    // The pass a code from the admin page carried (worker/device-link.js): this device takes over the old one's records.
    if (!env.STATS || !env.TRANSFER) return reply({ error: 'unavailable' }, 503);
    const text = await request.text();
    let sent = null;
    try { sent = text.length <= EVENT_BYTES ? JSON.parse(text) : null; } catch {}
    if (!isDeviceId(sent?.device)) return reply({ error: 'bad' }, 400);
    const from = await takePass(env.TRANSFER, sent.pass);
    if (!from) return reply({ error: 'missing' }, 404);
    await inheritRecords(env.STATS, from, sent.device);
    return reply({ ok: true });
  }
  if (path === '/api/records' && method === 'GET') {
    if (!env.STATS) return reply({ error: 'unavailable' }, 503);
    const at = url.searchParams.has('at') ? { difficulty: url.searchParams.get('difficulty') || '', seconds: Number(url.searchParams.get('at')) } : null;
    return reply(await records(env.STATS, url.searchParams.get('device') || '', url.searchParams.get('chapter') || FIRST_CHAPTER_ID, at));
  }
  if (!path.startsWith('/api/admin/')) return null;
  // A short token would be guessable, so the admin routes stay shut until a long one is set.
  if (!env.STATS || typeof env.ADMIN_TOKEN !== 'string' || env.ADMIN_TOKEN.length < 24) return reply({ error: 'unconfigured' }, 503);
  if (!(await isAdmin(request, env.ADMIN_TOKEN))) return reply({ error: 'denied' }, 401);
  const db = env.STATS, body = async () => { try { return await request.json(); } catch { return null; } };
  if (path === '/api/admin/stats' && method === 'GET') {
    const days = Number(url.searchParams.get('days'));
    return reply(await summary(db, [7, 30, 0].includes(days) ? days : 30, Date.now(), url.searchParams.get('difficulty') || ''));
  }
  if (path === '/api/admin/users' && method === 'GET') return reply(await users(db, url.searchParams.get('q') || ''));
  const one = path.match(/^\/api\/admin\/users\/([a-z0-9]+)(\/memo|\/transfer|\/restore|\/saves)?$/);
  if (one && !one[2] && method === 'GET') {
    const found = await user(db, one[1]);
    if (!found) return reply({ error: 'missing' }, 404);
    // When this player last uploaded progress (the save a transfer code would carry), never the save itself.
    const saved = await savedFor(env.TRANSFER, one[1]).catch(() => null);
    return reply({ ...found, saved: saved ? { at: saved.at, rev: saved.rev } : null });
  }
  if (one && one[2] === '/transfer' && method === 'POST') {
    if (!env.TRANSFER) return reply({ error: 'unavailable' }, 503);
    // From the save the device is linked to, or from one the owner picked in the search below (`ref`).
    const sent = await body(), options = { inherit: sent?.inherit === true };
    const made = sent?.ref ? await codeFromSave(env.TRANSFER, one[1], sent.ref, options) : await adminCode(env.TRANSFER, one[1], options);
    return made ? reply(made) : reply({ error: 'nosave' }, 404);
  }
  if (one && one[2] === '/saves' && method === 'GET') {
    if (!env.TRANSFER) return reply({ error: 'unavailable' }, 503);
    const found = await user(db, one[1]);
    if (!found) return reply({ error: 'missing' }, 404);
    return reply({ saves: await findSaves(env.TRANSFER, found.user) });
  }
  if (one && one[2] === '/restore' && method === 'POST') {
    if (!env.TRANSFER) return reply({ error: 'unavailable' }, 503);
    const sent = await body(), made = await restoreCode(env.TRANSFER, one[1], sent?.save, { inherit: sent?.inherit === true });
    return made ? reply(made) : reply({ error: 'bad' }, 400);
  }
  if (one && one[2] === '/memo' && method === 'POST') {
    if (!isDeviceId(one[1])) return reply({ error: 'missing' }, 404);
    const memo = plainText((await body())?.memo, MEMO_MAX);
    await ensure(db);
    await db.prepare(`UPDATE devices SET memo = ?2 WHERE id = ?1`).bind(one[1], memo || null).run();
    return reply({ ok: true, memo });
  }
  if (path === '/api/admin/gifts' && method === 'POST') { const made = await give(db, await body()); return made ? reply(made) : reply({ error: 'bad' }, 400); }
  const gift = path.match(/^\/api\/admin\/gifts\/(\d+)$/);
  if (gift && method === 'DELETE') {
    await ensure(db);
    const held = await db.prepare(`SELECT claimed_at, cancelled_at FROM gifts WHERE id = ?1`).bind(Number(gift[1])).first();
    if (!held) return reply({ error: 'missing' }, 404);
    if (held.claimed_at !== null || held.cancelled_at !== null) return reply({ error: 'taken' }, 409);
    await db.prepare(`UPDATE gifts SET cancelled_at = ?2 WHERE id = ?1 AND claimed_at IS NULL`).bind(Number(gift[1]), Date.now()).run();
    return reply({ ok: true });
  }
  return reply({ error: 'missing' }, 404);
}
