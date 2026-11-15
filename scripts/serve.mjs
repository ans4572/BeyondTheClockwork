import http from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { deflateSync, crc32 } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
const MAPS = path.join(root, 'src/data/maps.json'), SAVE_LIMIT = 1 << 20, MASK_LIMIT = 8 << 20;

/** A list of [x, y] points that can be a floor or wall outline inside a village of this size. */
const polygonOk = (polygon, [width, height]) => Array.isArray(polygon) && polygon.length >= 3 && polygon.length <= 2000
  && polygon.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= -2 && p[1] >= -2 && p[0] <= width + 2 && p[1] <= height + 2);

/*
 * The map editor's save (scripts/map-editor): writes one village's floor outline and walls into src/data/maps.json.
 * Only from this machine's own pages (the server listens on 127.0.0.1, and the Origin must be this server), only JSON,
 * and only those two fields of a village that already exists. Not part of the deployed game: Cloudflare serves files only.
 */
/** The request body as JSON, or null after answering when it is not from this machine's own page or is too large. */
async function ownJson(req, res, limit) {
  const origin = req.headers.origin, host = req.headers.host;
  if (!origin || !host || origin !== `http://${host}` || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !(req.headers['content-type'] || '').startsWith('application/json')) {
    res.writeHead(403); res.end('Forbidden'); return null;
  }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > limit) { res.writeHead(413); res.end('Too large'); return null; } }
  return JSON.parse(body);
}

async function saveVillage(req, res) {
  const request = await ownJson(req, res, SAVE_LIMIT);
  if (!request) return;
  const { id, walkable, solids } = request;
  const raw = await readFile(MAPS, 'utf8'), maps = JSON.parse(raw), village = maps.villages?.[id];
  if (typeof id !== 'string' || !village || !polygonOk(walkable, village.size) || !Array.isArray(solids) || solids.length > 200 || !solids.every(s => polygonOk(s, village.size))) {
    res.writeHead(400); return res.end('Bad map');
  }
  village.walkable = walkable; village.solids = solids;
  await writeFile(MAPS, JSON.stringify(maps, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`map editor: saved ${id} (${walkable.length} floor points, ${solids.length} walls)`);
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
}

/** A black-and-white PNG (1 bit per pixel, white = 1) from rows of packed bits, as the map masks are stored. */
export function bitPng(width, height, bits) {
  const rowBytes = Math.ceil(width / 8), raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) bits.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1');
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 1; header[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** The next free name beside a mask: mask-v10.png → mask-v11.png, mask-1x.png → mask-v2-1x.png (art is renamed on change). */
export async function nextMaskName(file) {
  const [, base, number, suffix] = file.match(/^(.*?)(?:-v(\d+))?(-1x)?\.png$/);
  for (let n = Number(number || 1) + 1; ; n++) {
    const name = `${base}-v${n}${suffix || ''}.png`;
    if (!(await stat(path.join(root, '.' + name)).then(() => true, () => false))) return name;
  }
}

/*
 * The map editor's mask save: one village's depth mask (white = scenery that is drawn over a body standing behind it),
 * painted in the editor. Written as a new file beside the old one, and the village pointed at it, so a browser holding
 * the old mask in its cache cannot keep showing it. `maskEdited` keeps scripts/build-village-foreground.mjs from
 * overwriting the painting unless that village is named.
 */
async function saveMask(req, res) {
  const request = await ownJson(req, res, MASK_LIMIT);
  if (!request) return;
  const { id, width, height, bits } = request;
  const raw = await readFile(MAPS, 'utf8'), maps = JSON.parse(raw), village = maps.villages?.[id];
  const data = typeof bits === 'string' ? Buffer.from(bits, 'base64') : null;
  if (typeof id !== 'string' || !village?.mask || width !== Math.round(village.size[0] * 40) || height !== Math.round(village.size[1] * 40) || data?.length !== Math.ceil(width / 8) * height) {
    res.writeHead(400); return res.end('Bad mask');
  }
  const name = await nextMaskName(village.mask);
  await writeFile(path.join(root, '.' + name), bitPng(width, height, data));
  village.mask = name; village.maskEdited = true;
  await writeFile(MAPS, JSON.stringify(maps, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`map editor: saved ${id} mask → ${name}`);
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, mask: name }));
}

/** The place a map editor entry points at: a room, one of its alternate paintings, the hub, the intro or the back yard. */
function placeOf(maps, ref) {
  if (ref?.kind === 'room') return maps.maps?.[ref.room];
  if (ref?.kind === 'alt') return maps.alternates?.[ref.room]?.[ref.index];
  if (['hub', 'intro', 'practice'].includes(ref?.kind)) return maps[ref.kind];
  return null;
}
const pointOk = (p, [width, height]) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= width && p.y <= height;

/*
 * The map editor's position save (2026-11-15): start, exit portal, monster and boss positions of the places standing on
 * one village. Only points that already exist are moved (no field is added or removed), each must lie inside the map, and
 * the place must stand on that village.
 */
async function savePlaces(req, res) {
  const request = await ownJson(req, res, SAVE_LIMIT);
  if (!request) return;
  const { id, places } = request;
  const raw = await readFile(MAPS, 'utf8'), maps = JSON.parse(raw), village = maps.villages?.[id];
  if (!village || !Array.isArray(places) || places.length > 100) { res.writeHead(400); return res.end('Bad places'); }
  const size = village.size, set = (target, p) => { target.x = Math.round(p.x * 100) / 100; target.y = Math.round(p.y * 100) / 100; };
  let moved = 0;
  for (const entry of places) {
    const place = placeOf(maps, entry.ref);
    if (!place || place.village !== id) { res.writeHead(400); return res.end('Bad place'); }
    for (const key of ['spawn', 'bossSpawn']) if (entry[key] && place[key]) { if (!pointOk(entry[key], size)) { res.writeHead(400); return res.end(`Bad ${key}`); } set(place[key], entry[key]); moved++; }
    const portal = place.portal || place.exit?.portal;
    if (entry.portal && portal) { if (!pointOk(entry.portal, size)) { res.writeHead(400); return res.end('Bad portal'); } set(portal, entry.portal); moved++; }
    if (Array.isArray(entry.enemySpawns) && Array.isArray(place.enemySpawns) && entry.enemySpawns.length === place.enemySpawns.length) {
      if (!entry.enemySpawns.every(p => pointOk(p, size))) { res.writeHead(400); return res.end('Bad enemySpawns'); }
      entry.enemySpawns.forEach((p, i) => set(place.enemySpawns[i], p)); moved += entry.enemySpawns.length;
    }
  }
  await writeFile(MAPS, JSON.stringify(maps, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`map editor: saved ${id} positions (${places.length} places, ${moved} points)`);
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/__dev/village') return await saveVillage(req, res);
    if (req.method === 'POST' && req.url === '/__dev/mask') return await saveMask(req, res);
    if (req.method === 'POST' && req.url === '/__dev/places') return await savePlaces(req, res);
    let relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root) || relative.split('/').some(part => part.startsWith('.')) || !(await stat(file)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { if (!res.headersSent) { res.writeHead(404); res.end('Not found'); } }
});
// Imported by tests for bitPng and nextMaskName; started only when run (npm run dev).
if (process.argv[1]?.endsWith('serve.mjs')) server.listen(port, '127.0.0.1', () => console.log(`태엽 밖으로 → http://localhost:${port}  ·  지도 벽 편집기 → http://localhost:${port}/scripts/map-editor/`));
