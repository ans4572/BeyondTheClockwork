import { readFile, access } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MobAnimator } from '../src/animation/mob-animator.js';
import { SpriteLibrary } from '../src/animation/sprite-library.js';

// Orden's two forms (scripts/import-ch3-orden.mjs): 'orden' masked, 'ordenx' awakened, in the clock tower's clip list.
const clips = JSON.parse(await readFile(new URL('../art/animations/mobs/clock-tower/game-clips.json', import.meta.url), 'utf8'));
const slice = JSON.parse(await readFile(new URL('../src/data/slice.json', import.meta.url), 'utf8'));
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

test('both of Orden\'s forms stand, glide, cast and point in eight directions on sheets that exist', async () => {
  assert.equal(slice.bossAI.orden.sprite, 'orden');
  assert.equal(slice.bossAI.ordenFinal.sprite, 'ordenx');
  for (const sprite of ['orden', 'ordenx']) for (const action of ['idle', 'move', 'cast', 'point']) {
    assert.ok(clips.actions.includes(`${sprite}-${action}`), `${sprite}-${action} listed`);
    for (const direction of DIRECTIONS) {
      const clip = clips.clips[`${sprite}-${action}/${direction}`];
      assert.ok(clip, `${sprite}-${action}/${direction}`);
      await access(new URL(`..${clip.sheet}`, import.meta.url));
      assert.equal(clip.frameDurationsMs.length, clip.frameCount);
      assert.equal(clip.frameDurationsMs.reduce((a, b) => a + b, 0), clip.durationMs);
      assert.equal(clip.loop, action === 'idle' || action === 'move');
      if (!clip.loop) assert.ok(clip.lastEventMs > 0 && clip.lastEventMs < clip.durationMs && clip.frameCount >= 5);
    }
  }
});

test('Orden\'s last form wears the awakened sheets even when the engine sets no sprite, and casts on its tell', () => {
  const library = new SpriteLibrary(clips, new Map(Object.values(clips.clips).map(clip => [clip.sheet, {}])));
  const a = new MobAnimator(library), g = { s: { paused: false, time: 10, enemies: [] } };
  const orden = { id: 'o', type: 'ordenFinal', hp: 100, x: 5, y: 5, facing: Math.PI / 2, speed: 1.7 };
  g.s.enemies.push(orden);
  assert.equal(a.update(1 / 60, g).get('o').action, 'ordenx-idle');
  orden.tell = { type: 'spell', started: 10, until: 11 }; orden.tellPose = 'cast';
  const pose = a.update(1 / 60, g).get('o');
  assert.equal(pose.action, 'ordenx-cast');
  assert.equal(pose.direction, 'south');
  const masked = { id: 'm', type: 'orden', hp: 100, x: 8, y: 5, facing: 0, speed: 1.6, tell: { type: 'bolt', started: 10, until: 10.4 }, tellPose: 'point' };
  g.s.enemies.push(masked);
  assert.equal(a.update(1 / 60, g).get('m').action, 'orden-point');
});
