// The same sound twice a moment apart is heard once (2026-11-22: Belgard's archers loosing a frame or two apart rang
// their bowstring on top of itself, a doubled, metallic note under the sword rain).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundBank } from '../src/audio/sfx.js';

test('a sound started again within 60 ms is left out; later, or another sound, plays', () => {
  const bank = new SoundBank(), audio = { currentTime: 1 };
  assert.equal(bank.again(audio, 'minuteArcher'), false);
  audio.currentTime = 1.03; assert.equal(bank.again(audio, 'minuteArcher'), true);
  assert.equal(bank.again(audio, 'boss-bgSwordHit'), false);
  audio.currentTime = 1.1; assert.equal(bank.again(audio, 'minuteArcher'), false);
  // A new sound context (its clock back at 0) is not held up by the old one's times.
  assert.equal(bank.again({ currentTime: 0 }, 'minuteArcher'), false);
});
