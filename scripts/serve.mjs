import http from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
const MAPS = path.join(root, 'src/data/maps.json'), SAVE_LIMIT = 1 << 20;

/** A list of [x, y] points that can be a floor or wall outline inside a village of this size. */
const polygonOk = (polygon, [width, height]) => Array.isArray(polygon) && polygon.length >= 3 && polygon.length <= 2000
  && polygon.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= -2 && p[1] >= -2 && p[0] <= width + 2 && p[1] <= height + 2);

/*
 * The map editor's save (scripts/map-editor): writes one village's floor outline and walls into src/data/maps.json.
 * Only from this machine's own pages (the server listens on 127.0.0.1, and the Origin must be this server), only JSON,
 * and only those two fields of a village that already exists. Not part of the deployed game: Cloudflare serves files only.
 */
async function saveVillage(req, res) {
  const origin = req.headers.origin, host = req.headers.host;
  if (!origin || !host || origin !== `http://${host}` || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !(req.headers['content-type'] || '').startsWith('application/json')) {
    res.writeHead(403); return res.end('Forbidden');
  }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > SAVE_LIMIT) { res.writeHead(413); return res.end('Too large'); } }
  const { id, walkable, solids } = JSON.parse(body);
  const raw = await readFile(MAPS, 'utf8'), maps = JSON.parse(raw), village = maps.villages?.[id];
  if (typeof id !== 'string' || !village || !polygonOk(walkable, village.size) || !Array.isArray(solids) || solids.length > 200 || !solids.every(s => polygonOk(s, village.size))) {
    res.writeHead(400); return res.end('Bad map');
  }
  village.walkable = walkable; village.solids = solids;
  await writeFile(MAPS, JSON.stringify(maps, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`map editor: saved ${id} (${walkable.length} floor points, ${solids.length} walls)`);
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/__dev/village') return await saveVillage(req, res);
    let relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root) || relative.split('/').some(part => part.startsWith('.')) || !(await stat(file)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { if (!res.headersSent) { res.writeHead(404); res.end('Not found'); } }
}).listen(port, '127.0.0.1', () => console.log(`태엽 밖으로 → http://localhost:${port}  ·  지도 벽 편집기 → http://localhost:${port}/scripts/map-editor/`));
