// The characters the Galmuri11 subsets keep (art/fonts/Galmuri11-sub-v1.woff2 and -Bold-sub-v1, 2026-11-12: 505 KB and
// 167 KB down to 46 KB and 42 KB): every character in the game's code, data and pages, the 2,350 common Hangul syllables
// (KS X 1001) so a nickname or a save note still draws in the game's font, the Hangul letters and printable ASCII.
// A character outside them falls back to the next font in each stack. The full fonts stay beside them as the source.
//
// After new text (test/font-chars.test.js says when), write the list and cut both fonts again, under a new file name:
//   node scripts/font-chars.mjs > art/fonts/subset-chars.txt
//   python -m fontTools.subset art/fonts/Galmuri11.woff2 --text-file=art/fonts/subset-chars.txt --flavor=woff2 --layout-features=* --output-file=art/fonts/Galmuri11-sub-vN.woff2
//   (and the same for Galmuri11-Bold.woff2), then point src/style.css, admin.html, sounds.html and scripts/sync-preloads.mjs at them.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCES = ['src', 'index.html', 'admin.html', 'sounds.html'];
async function filesUnder(entry) {
  const stat = await readdir(entry, { withFileTypes: true }).catch(() => null);
  if (!stat) return [entry];
  return (await Promise.all(stat.map(e => filesUnder(path.join(entry, e.name))))).flat();
}
export async function fontChars() {
  const chars = new Set();
  for (const file of (await Promise.all(SOURCES.map(filesUnder))).flat().filter(f => /\.(js|json|html|css)$/.test(f))) for (const ch of await readFile(file, 'utf8').catch(() => '')) chars.add(ch);
  // KS X 1001's 2,350 syllables: rows 0xB0-0xC8, cells 0xA1-0xFE in EUC-KR.
  const euckr = new TextDecoder('euc-kr');
  for (let row = 0xb0; row <= 0xc8; row++) for (let cell = 0xa1; cell <= 0xfe; cell++) chars.add(euckr.decode(new Uint8Array([row, cell])));
  for (let code = 0x3131; code <= 0x318e; code++) chars.add(String.fromCodePoint(code)); // ㄱ … ㆎ
  for (let code = 0x20; code <= 0x7e; code++) chars.add(String.fromCodePoint(code));
  for (const ch of [...chars]) if (/[\u0000-\u001f\u007f�]/u.test(ch)) chars.delete(ch);
  return [...chars].sort().join('');
}
if (process.argv[1]?.endsWith('font-chars.mjs')) process.stdout.write(await fontChars());
