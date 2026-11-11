import test from 'node:test';
import assert from 'node:assert/strict';
import { cursorCss, cursorImage, cursorSize, CURSOR_MIN, CURSOR_MAX, DEFAULT_CURSOR } from '../src/ui/cursor.js';

test('the game cursor is a crosshair at the slider size, centred on its hot spot, the browser one as a fallback (2026-11-11)', () => {
  for (let px = CURSOR_MIN; px <= CURSOR_MAX; px += 4) {
    assert.ok(decodeURIComponent(cursorImage(px)).includes(`width="${px}"`), String(px));
    assert.ok(cursorCss(px).endsWith(`${px / 2} ${px / 2}, crosshair`), String(px));
  }
  assert.equal(cursorSize(undefined), DEFAULT_CURSOR); assert.equal(cursorSize('nonsense'), DEFAULT_CURSOR);
  assert.equal(cursorSize('large'), 40, 'a size from the old drop-down'); assert.equal(cursorSize(500), CURSOR_MAX); assert.equal(cursorSize(1), CURSOR_MIN); assert.equal(cursorSize(33), 32);
  assert.ok(DEFAULT_CURSOR > 24, 'larger than the browser crosshair');
});
