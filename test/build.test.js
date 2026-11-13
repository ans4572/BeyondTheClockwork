import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { builtHtml, siteEdits } from '../scripts/build.mjs';

// The published site is packed by scripts/build.mjs on Cloudflare's build machine (2026-11-14). It edits a few lines of
// the source by exact text; these fail here, before a push, when that text changes, instead of failing the deploy.
const dataFiles = Object.fromEntries(['combat', 'progression', 'slice', 'maps', 'dialogue'].map(name => [name, `build/data/${name}-0123456789.json`]));
const workers = { 'grade-worker': 'grade-worker-AAAA.js', 'depth-worker': 'depth-worker-BBBB.js' };

test('the build finds every line it rewrites in the source', async () => {
  for (const [file, edit] of Object.entries(siteEdits({ dataFiles, workers }))) {
    const before = await readFile(file, 'utf8'), after = edit(before);
    assert.notEqual(after, before, file);
  }
});

test('sfx.js recipes become plain imports of the same six files', async () => {
  const out = siteEdits({ dataFiles, workers })['src/audio/sfx.js'](await readFile('src/audio/sfx.js', 'utf8'));
  for (const name of ['elements', 'coded', 'water-sound', 'boss2-sound', 'mob2-sound', 'redo-sound']) assert.match(out, new RegExp(`import \\* as __recipe\\d from './${name}\\.js';`));
  assert.doesNotMatch(out, /import\(`/);
});

test('the data and workers are fetched by their packed names', async () => {
  const edits = siteEdits({ dataFiles, workers });
  assert.match(edits['src/engine/data.js'](await readFile('src/engine/data.js', 'utf8')), /build\/data\/maps-0123456789\.json/);
  assert.match(edits['src/render/grade.js'](await readFile('src/render/grade.js', 'utf8')), /new URL\('\.\/grade-worker-AAAA\.js', import\.meta\.url\)/);
  assert.match(edits['src/render/map-loader.js'](await readFile('src/render/map-loader.js', 'utf8')), /new URL\('\.\/depth-worker-BBBB\.js', import\.meta\.url\)/);
});

test('the packed index.html names only the packed code, styles and data', async () => {
  const html = builtHtml(await readFile('index.html', 'utf8'), { main: 'build/main-X.js', css: 'build/style-Y.css', dataFiles });
  assert.doesNotMatch(html, /src\//, 'nothing under src/ is fetched');
  assert.match(html, /<script type="module" src="build\/main-X\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="build\/style-Y\.css">/);
  assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1);
  for (const file of Object.values(dataFiles)) assert.ok(html.includes(`href="${file}"`), file);
  // The fonts, the title picture and F2's first atlas pages are still fetched early.
  assert.match(html, /Galmuri11-sub-v1\.woff2" as="font"/);
  assert.match(html, /art\/atlases\/f2-first-0-/);
});

test('the packed files are kept a year and the page is checked every visit', async () => {
  const headers = await readFile('_headers', 'utf8');
  assert.match(headers, /\/build\/\*\r?\n\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /^\/\r?\n\s+Cache-Control: public, max-age=0, must-revalidate/m);
  assert.match(await readFile('wrangler.toml', 'utf8'), /\[build\]\r?\ncommand = "node scripts\/build\.mjs --deploy"/);
});
