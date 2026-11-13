import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// sw.js (2026-11-13) keeps only art files on the device; pages, code and every .json must always come from the network,
// or a deploy would not reach a returning player.
const source = await readFile('sw.js', 'utf8');
const kept = new RegExp(source.match(/const KEPT = \/(.+)\/i;/)[1], 'i');

test('the service worker keeps pictures, sounds and fonts under /art/ only', () => {
  for (const path of ['/art/atlases/f2-first-0-abc.webp', '/art/chapters/1-smile-street/maps/00-scrapyard/background-q92.webp', '/art/audio/bgm/title.ogg', '/art/fonts/Galmuri11-sub-v1.woff2', '/art/ui/icons/px/coin.png']) assert.ok(kept.test(path), path);
  for (const path of ['/art/atlases/index.json', '/art/animations/player/game-clips.json', '/src/main.js', '/src/data/maps.json', '/index.html', '/', '/sw.js', '/api/stats', '/art/audio/CREDITS.md']) assert.ok(!kept.test(path), path);
});

test('the service worker is on, and checked on every visit so it can be switched off', async () => {
  assert.match(source, /const KILL = false;/);
  const headers = await readFile('_headers', 'utf8');
  assert.match(headers, /\/sw\.js\r?\n\s+Cache-Control: public, max-age=0, must-revalidate/);
});
