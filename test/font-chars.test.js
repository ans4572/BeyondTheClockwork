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
