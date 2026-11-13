import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fontChars } from '../scripts/font-chars.mjs';

// The Galmuri11 subsets (2026-11-12) hold only the characters listed in art/fonts/subset-chars.txt. Text that brings a
// new character would draw it in a fallback font, so this fails until the list and the fonts are cut again
// (the steps are at the top of scripts/font-chars.mjs).
test('every character the game shows is in the Galmuri11 subsets', async () => {
  const kept = new Set(await readFile('art/fonts/subset-chars.txt', 'utf8'));
  const missing = [...await fontChars()].filter(ch => !kept.has(ch));
  assert.deepEqual(missing, [], `new characters outside the font subsets: ${missing.join(' ')} (see scripts/font-chars.mjs)`);
});

test('the pages load the subset fonts, not the full ones', async () => {
  for (const file of ['src/style.css', 'admin.html', 'sounds.html', 'index.html']) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /Galmuri11(-Bold)?\.woff2/, file);
  }
});

// A nickname can hold any of the 11,172 Hangul syllables (2026-11-13: 쏘이팕's 팕 drew in a fallback font). The rest files
// (art/fonts/Galmuri11-rest-v1 and -Bold-rest-v1) hold every syllable the subsets lack, as their own family 'Galmuri11 Rest',
// next after Galmuri11 in each stack, so a page that shows none of them never fetches them.
test('every Galmuri11 font stack falls back to Galmuri11 Rest next', async () => {
  for (const file of ['src/style.css', 'src/layout.css', 'src/render/canvas.js', 'src/ui/title-screen.js', 'index.html', 'admin.html', 'sounds.html']) {
    const text = await readFile(file, 'utf8'), stacks = text.match(/"Galmuri11",[^;`'\n]*/g) || [];
    for (const stack of stacks) assert.match(stack, /^"Galmuri11", "Galmuri11 Rest",/, `${file}: ${stack}`);
  }
  for (const file of ['src/style.css', 'admin.html', 'sounds.html']) assert.match(await readFile(file, 'utf8'), /'Galmuri11 Rest'; src: url\('[^']*Galmuri11-rest-v1\.woff2'/, file);
});

test('the subsets and the rest list hold every Hangul syllable between them', async () => {
  const kept = new Set(await readFile('art/fonts/subset-chars.txt', 'utf8')), rest = new Set(await readFile('art/fonts/rest-chars.txt', 'utf8'));
  const missing = [];
  for (let code = 0xac00; code <= 0xd7a3; code++) { const ch = String.fromCodePoint(code); if (!kept.has(ch) && !rest.has(ch)) missing.push(ch); }
  assert.equal(missing.length, 0, `syllables in neither: ${missing.slice(0, 20).join('')}`);
});
