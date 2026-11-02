// Cuts a small framed view of every Smile Street area for the world map, from the same art the areas use.
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const sharp = createRequire(import.meta.url)(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const OUT = 'art/ui/world-map', WIDTH = 300, HEIGHT = 200;
const maps = JSON.parse(await readFile('src/data/maps.json', 'utf8')), { rooms } = JSON.parse(await readFile('src/data/slice.json', 'utf8'));
const places = { town: maps.hub.village, ...Object.fromEntries(rooms.map(room => [room.id, maps.maps[room.id].village])) };
await mkdir(OUT, { recursive: true });
for (const [id, village] of Object.entries(places)) {
  const file = maps.villages[village].background.replace(/^\//, '');
  // The middle of each area holds its landmark; the edges are mostly walls and trim.
  const { width, height } = await sharp(file).metadata(), w = Math.round(width * 0.8), h = Math.round(w * HEIGHT / WIDTH);
  await sharp(file).extract({ left: Math.round((width - w) / 2), top: Math.max(0, Math.round((height - h) / 2)), width: w, height: Math.min(h, height) })
    .resize(WIDTH, HEIGHT, { fit: 'cover', kernel: 'lanczos3' }).png().toFile(`${OUT}/${id}.png`);
}
console.log(JSON.stringify({ areas: Object.keys(places).length }));
