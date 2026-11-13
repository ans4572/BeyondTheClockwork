// The game is plain ES modules with no bundler, so a browser only learns of a module after the one importing it has
// arrived: on a slow connection the ~40 files came one wave after another. index.html lists them all up front
// (modulepreload) together with the data, the fonts and the title's F2 picture, so they download side by side.
// `node scripts/sync-preloads.mjs` rewrites the list; `--check` fails when it is out of date (npm run check).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ENTRY = 'src/main.js', START = '<!-- preload:start -->', END = '<!-- preload:end -->';
/** Files the first screen needs besides the modules (fetched with the same options the game uses). */
const EXTRA = [
  '<link rel="preload" href="art/fonts/Galmuri11-sub-v1.woff2" as="font" type="font/woff2" crossorigin>',
  '<link rel="preload" href="art/fonts/Galmuri11-Bold-sub-v1.woff2" as="font" type="font/woff2" crossorigin>',
  '<link rel="preload" href="art/fonts/NeoDunggeunmoPro.woff2" as="font" type="font/woff2" crossorigin>',
  // The title's F2 picture; the loading card waits for it.
  '<link rel="preload" href="art/ui/title/f2-title-v3.png" as="image">',
  ...['combat', 'progression', 'slice', 'maps', 'dialogue'].map(name => `<link rel="preload" href="src/data/${name}.json" as="fetch" crossorigin>`)
];

/** Every module reachable from the entry through static imports, in the order they are first met. */
export async function moduleGraph(entry = ENTRY) {
  const seen = new Set(), queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = await readFile(file, 'utf8');
    for (const [, spec] of text.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) queue.push(path.posix.join(path.posix.dirname(file), spec));
    for (const [, spec] of text.matchAll(/^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) queue.push(path.posix.join(path.posix.dirname(file), spec));
    // sfx.js imports its recipe files by a name list (2026-11-12), so they are listed too and arrive with the rest.
    if (file.endsWith('audio/sfx.js')) for (const [, list] of text.matchAll(/\[((?:\s*'[\w-]+',?)+)\]\.map\(name => import\(/g)) for (const [, name] of list.matchAll(/'([\w-]+)'/g)) queue.push(path.posix.join(path.posix.dirname(file), `${name}.js`));
  }
  return [...seen];
}

/**
 * F2's first atlas pages (walking, the wrench, dodging; scripts/build-atlases.py), fetched while the loading card turns
 * (2026-11-13): 새로 시작하기 and 이어하기 wait for them, and they used to start only once the title was drawn. They are
 * fetched as bytes (sprite-library.js pageSheets decodes them off the main thread), so the preload is a fetch.
 */
export async function atlasPreloads() {
  const index = JSON.parse(await readFile('art/atlases/index.json', 'utf8').catch(() => '{}'));
  return Object.keys(index.pages || {}).filter(page => /\/f2-first-\d+-/.test(page)).map(page => `<link rel="preload" href="${page}" as="fetch" crossorigin>`);
}

export async function preloadBlock() {
  const modules = (await moduleGraph()).filter(file => file !== ENTRY);
  return [START, ...EXTRA, ...await atlasPreloads(), ...modules.map(file => `<link rel="modulepreload" href="${file}">`), END].map(line => `  ${line}`).join('\n');
}

if (process.argv[1]?.endsWith('sync-preloads.mjs')) {
  // Compared and written with plain line ends; a checkout with Windows line ends is not a difference.
  const html = (await readFile('index.html', 'utf8')).replace(/\r\n/g, '\n'), block = await preloadBlock();
  const at = html.indexOf(`  ${START}`), end = html.indexOf(END);
  const next = at >= 0 ? html.slice(0, at) + block + html.slice(end + END.length) : html.replace('  <link rel="stylesheet" href="src/style.css">', `${block}\n  <link rel="stylesheet" href="src/style.css">`);
  if (process.argv.includes('--check')) { if (next !== html) { console.error('index.html preloads are out of date: run node scripts/sync-preloads.mjs'); process.exit(1); } console.log('Verified index.html preloads'); }
  else { await writeFile('index.html', next); console.log(`index.html: ${block.split('\n').length - 2} preloads`); }
}
