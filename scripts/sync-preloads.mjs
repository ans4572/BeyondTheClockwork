// The game is plain ES modules with no bundler, so a browser only learns of a module after the one importing it has
// arrived: on a slow connection the ~40 files came one wave after another. index.html lists them all up front
// (modulepreload) together with the data, the fonts and the title's F2 sheet, so they download side by side.
// `node scripts/sync-preloads.mjs` rewrites the list; `--check` fails when it is out of date (npm run check).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ENTRY = 'src/main.js', START = '<!-- preload:start -->', END = '<!-- preload:end -->';
/** Files the first screen needs besides the modules (fetched with the same options the game uses). */
const EXTRA = [
  '<link rel="preload" href="art/fonts/Galmuri11.woff2" as="font" type="font/woff2" crossorigin>',
  '<link rel="preload" href="art/fonts/Galmuri11-Bold.woff2" as="font" type="font/woff2" crossorigin>',
  '<link rel="preload" href="art/fonts/NeoDunggeunmoPro.woff2" as="font" type="font/woff2" crossorigin>',
  // The title's F2 stands on this sheet; the loading card waits for it.
  '<link rel="preload" href="art/animations/player/movement/locomotion/clips/idle-south-708a71c5/sheet.webp" as="image">',
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
  }
  return [...seen];
}

export async function preloadBlock() {
  const modules = (await moduleGraph()).filter(file => file !== ENTRY);
  return [START, ...EXTRA, ...modules.map(file => `<link rel="modulepreload" href="${file}">`), END].map(line => `  ${line}`).join('\n');
}

if (process.argv[1]?.endsWith('sync-preloads.mjs')) {
  const html = await readFile('index.html', 'utf8'), block = await preloadBlock();
  const at = html.indexOf(`  ${START}`), end = html.indexOf(END);
  const next = at >= 0 ? html.slice(0, at) + block + html.slice(end + END.length) : html.replace('  <link rel="stylesheet" href="src/style.css">', `${block}\n  <link rel="stylesheet" href="src/style.css">`);
  if (process.argv.includes('--check')) { if (next !== html) { console.error('index.html preloads are out of date: run node scripts/sync-preloads.mjs'); process.exit(1); } console.log('Verified index.html preloads'); }
  else { await writeFile('index.html', next); console.log(`index.html: ${block.split('\n').length - 2} preloads`); }
}
