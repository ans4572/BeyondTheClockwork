import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { bitPng, nextMaskName } from '../scripts/serve.mjs';

// The map editor saves a painted mask through the dev server (2026-11-14): a 1-bit black-and-white PNG under a new name.
test('a painted mask is written as a 1-bit grey PNG whose rows are the packed bits', () => {
  const png = bitPng(10, 2, Buffer.from([0xff, 0xc0, 0x00, 0x00]));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('latin1', 12, 16), 'IHDR');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]], [10, 2, 1, 0]);
  const length = png.readUInt32BE(33);
  assert.equal(png.toString('latin1', 37, 41), 'IDAT');
  assert.deepEqual([...inflateSync(png.subarray(41, 41 + length))], [0, 0xff, 0xc0, 0, 0, 0]);
});

test('a saved mask gets the next free name beside the old one, so cached copies are never reused', async () => {
  // A folder with no masks, so masks saved in the editor since do not move the expected names.
  assert.equal(await nextMaskName('/art/no-such-place/mask-v10.png'), '/art/no-such-place/mask-v11.png');
  assert.equal(await nextMaskName('/art/no-such-place/mask-1x.png'), '/art/no-such-place/mask-v2-1x.png');
  // A name already taken is skipped: the village court's mask-v10.png exists, so mask-v9.png moves past it.
  assert.notEqual(await nextMaskName('/art/chapters/1-smile-street/maps/00-village-court/mask-v9.png'), '/art/chapters/1-smile-street/maps/00-village-court/mask-v10.png');
});
