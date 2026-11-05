import {clampCorners} from '../engine/fusion-geometry.js';
import { PlayerAnimator } from '../animation/player-animator.js';
import { MobAnimator } from '../animation/mob-animator.js';
import { CastEffects } from '../animation/cast-effects.js';
import { nearestDirection } from '../animation/player-animator.js';
import { NpcDirector } from '../animation/npc-director.js';
import { cameraFor, VIEW_UNITS, CAMERA_ZOOM, PIXELS_PER_UNIT } from '../engine/map-geometry.js';
import { ghostFor } from './depth-mask.js';
import { Lighting } from './lighting.js';
import { FX, NOTE_ART, MARKS, LOOT_ART } from './fx-sprites.js';
import { GROUND, sawAt, plateState } from '../engine/hazards.js';
/** The music box's notes are drawn a little under their art size so a volley reads as shots, not as clutter. */
const NOTE_SCALE = 0.8;
export const STATUS_ICONS = Object.fromEntries(['burn', 'chill', 'frozen', 'shock', 'windPressure'].map(id => [id, `/art/ui/status-icons/${id}.png`]));
/** Brass's march drums in the drum break (PixelLab object); main.js loads it with the place art. */
export const BRASS_DRUM_ART = 'art/bosses/brass/drum.png';
/** The room hazards' painted sprites (src/engine/hazards.js places them; drawHazard adds their states). */
export const HAZARD_ART = Object.fromEntries(Object.entries({ crate: 'crate', musicbox: 'musicbox', plate: 'plate', saw: 'saw', fenceAcross: 'fence-across', fenceUpright: 'fence-upright' }).map(([key, file]) => [key, `art/smile-street/hazards/${file}-v1.png`]));
// Bosses are drawn larger than their sheets so they tower over the room's other bodies.
const NAME_SIZE = 8, NAME_GAP = 3, ACTION_GOLD = '#ffd257', ENEMY_ARROW = '#e0564c', SHAKE_MS = 150, HURT_EDGE_MS = 180, JOLT_PX = 1.5, NUMBER_SIZE = 10, CRIT_NUMBER_SIZE = 12;
const COLUMN_SPACING_UNITS = 1.4, BADGE_SIZE = 12, BADGE_GAP = 1, COUNT_WIDTH = 9, COUNT_SIZE = 6, FROZEN_LOOK = 'saturate(0.2) brightness(1.4)';
const TAG_SIZE = 7, TAU = Math.PI * 2, SCREEN_UNITS = VIEW_UNITS, TELL_BLINK_SECONDS = 0.1, TELL_BLINKS = 3;
// F2's clips stand taller than the townsfolk; this brings them to the same height everywhere.
// Bodies are drawn a little over their sheet size so they read clearly on the 640-pixel grid.
const SWING_SWEEP = 0.45, FLASH_MS = 260, CRIT_PULSE_MS = 120, CRIT_ZOOM = 0.03, BODY_SCALE = 1, PLAYER_SCALE = 0.9, EYES_OPEN_SHARE = 0.5;
/** Every body (F2, mobs, bosses, residents) is drawn at its own art size: one sheet pixel per world pixel, so nothing is stretched or squeezed. */
const BOSS_SPRITE_SCALE = 1 / BODY_SCALE;

/** Canvas adapter only: positions are in engine units; drawing has no combat authority. */
export class CanvasRenderer {
  /**
   * `canvas` is drawn at full detail. With `view` and `letters`, each frame is then shrunk onto `view`, a small canvas the
   * page enlarges with hard pixels, so the map and the bodies share one pixel grid; words go to `letters` at screen
   * resolution instead, because pixel lettering cannot be shrunk and stay readable.
   */
  constructor(canvas, game, { view = null, letters = null } = {}) { this.view = view; this.letters = letters; this.mood = 'day';
    // Light and shade are only drawn in the browser, where the frame is set on its pixel grid.
    this.lighting = view ? new Lighting((w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })) : null; this.canvas = canvas; this.game = game; this.ctx = canvas.getContext('2d'); this.visualTime = 0; this.camera = { x: 0, y: 0 }; this.talkKey = 'E'; this.shakeUntil = 0; this.shakeSize = 0; this.hurtUntil = 0; }
  /** A short shake in screen pixels, on the wall clock so it still plays while a hit holds the game still. */
  kick(size, angle) { const now = performance.now(); if (now > this.shakeUntil || size >= this.shakeSize) { this.shakeSize = size; this.shakeUntil = now + SHAKE_MS; this.shakeAngle = angle; } }
  /** A critical hit: the view leans in a few percent and a gold light passes over it. */
  critPulse() { this.pulseUntil = performance.now() + CRIT_PULSE_MS; }
  wince() { this.hurtUntil = performance.now() + HURT_EDGE_MS; }
  /**
   * The wrench's slash: one thin crescent drawn along the swing, up to 3 px at its head and thinning to the tail, with a
   * one-pixel ink shadow so it reads on pale floors. The second blow sweeps the other way.
   * It is drawn exactly where the blow lands: the crescent sits on the hit range and spans the hit cone (`fx.arc` degrees).
   */
  drawSwing(fx, x, y, fraction) {
    const c = this.ctx, phase = fx.phase || 0, heavy = phase === 2, R = fx.value * 20, dir = phase === 1 ? -1 : 1;
    const span = fx.arc ? fx.arc * Math.PI / 360 : 1, grow = Math.min(1, fraction / SWING_SWEEP), fade = fraction < SWING_SWEEP ? 1 : 1 - (fraction - SWING_SWEEP) / (1 - SWING_SWEEP);
    const start = fx.angle - dir * span, sweep = dir * 2 * span * grow, steps = 18, widest = heavy ? 3.5 : 3;
    c.save(); c.lineCap = 'butt';
    for (let i = 0; i < steps; i++) {
      const k0 = i / steps, k1 = (i + 1) / steps, width = Math.max(1, widest * (0.35 + 0.65 * k1));
      const a0 = start + sweep * k0, a1 = start + sweep * k1 + dir * 0.001;
      c.strokeStyle = '#2b3345'; c.lineWidth = 1; c.globalAlpha = fade * 0.55 * k1;
      c.beginPath(); c.arc(x, y, R + width / 2 + 0.6, a0, a1, dir < 0); c.stroke();
      c.globalAlpha = fade * (0.35 + 0.65 * k1); c.strokeStyle = k1 > 0.8 ? '#e9fffb' : '#2fb8a6'; c.lineWidth = width;
      c.beginPath(); c.arc(x, y, R, a0, a1, dir < 0); c.stroke();
    }
    c.restore();
  }
  /** A white flash over the whole frame, for a boss changing phase. */
  flash() { this.flashUntil = performance.now() + FLASH_MS; }
  shakeOffset() {
    const left = this.shakeUntil - performance.now();
    if (left <= 0) return [0, 0];
    const size = this.shakeSize * left / SHAKE_MS;
    // A directed kick moves the view along the blow, with only a little wobble across it.
    if (this.shakeAngle !== undefined) { const along = size, wobble = (Math.random() * 2 - 1) * size * 0.25; return [Math.round(Math.cos(this.shakeAngle) * along - Math.sin(this.shakeAngle) * wobble), Math.round(Math.sin(this.shakeAngle) * along + Math.cos(this.shakeAngle) * wobble)]; }
    return [Math.round((Math.random() * 2 - 1) * size), Math.round((Math.random() * 2 - 1) * size)];
  }
  /** Clips the map background to a polygon and repaints it, so scenery covers what stands behind it. */
  drawOccluder(image, polygon, [width, height]) {
    const c = this.ctx, xs = polygon.map(point => point[0]), ys = polygon.map(point => point[1]), left = Math.max(0, Math.min(...xs)), top = Math.max(0, Math.min(...ys));
    const w = Math.min(width, Math.max(...xs)) - left, h = Math.min(height, Math.max(...ys)) - top, perUnit = image.width / width;
    c.save(); c.beginPath();
    polygon.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x * 20, y * 20));
    c.closePath(); c.clip(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(image, left * perUnit, top * perUnit, w * perUnit, h * perUnit, left * 20, top * 20, w * 20, h * 20); c.restore();
  }
  useSprites(library) { this.sprites = library; this.animator = new PlayerAnimator(library); this.castEffects = new CastEffects(library); }
  useNpcSprites(library) { this.npcSprites = library; this.npcDirector = new NpcDirector(library); }
  useMobSprites(library) { this.mobSprites = library; this.mobAnimator = new MobAnimator(library); }
  /** Returns false when the clip is unavailable, so the caller can draw the code doll instead. */
  drawSprite(x, y, pose, library = this.sprites, flash = false, resize = 1) {
    const clip = library?.clip(pose.action, pose.direction), image = clip && library.image(clip.sheet);
    if (!image) return false;
    const c = this.ctx, { frameWidth: w, frameHeight: h, columns, anchor, scale } = clip, sx = pose.frame % columns * w, sy = Math.floor(pose.frame / columns) * h;
    // One sheet pixel is one canvas pixel, half a unit of the renderer's 2x transform.
    const size = scale * resize * BODY_SCALE / 2, left = Math.round((x - anchor[0] * size) * 2) / 2, top = Math.round((y - anchor[1] * size) * 2) / 2;
    // A firm contact shadow grounds every body on the painted floor.
    c.fillStyle = 'rgba(24, 20, 36, 0.34)'; c.beginPath(); c.ellipse(x, y, 13, 4.5, 0, 0, TAU); c.fill();
    if (flash) c.filter = flash === true ? 'brightness(1.9)' : flash;
    c.imageSmoothingEnabled = resize !== 1;
    for (const url of [clip.sheet, clip.effect]) if (url && library.image(url)) c.drawImage(library.image(url), sx, sy, w, h, left, top, w * size, h * size);
    if (flash) c.filter = 'none';
    c.imageSmoothingEnabled = false;
    return true;
  }
  /** A street prop stands on its bottom centre; its feet decide what it hides. */
  drawProp({ image, x, y, scale = 1, flip }) {
    const c = this.ctx, picture = this.mapImages.get(image);
    if (!picture) return;
    const w = picture.width / 2 * scale, h = picture.height / 2 * scale;
    c.save(); c.translate(x * 20, y * 20); if (flip) c.scale(-1, 1);
    c.imageSmoothingEnabled = scale !== 1; c.drawImage(picture, -w / 2, -h, w, h); c.restore();
  }
  /** What an enemy is suffering right now, in the order it is drawn. */
  statusBadges(enemy) {
    const { time } = this.game.s, badges = [], stacks = enemy.burnStacks.filter(end => end > time).length;
    if (stacks) badges.push({ id: 'burn', count: stacks });
    if (enemy.frozenUntil > time) badges.push({ id: 'frozen' });
    else if (enemy.statuses.chill > time) badges.push({ id: 'chill' });
    for (const id of ['shock', 'windPressure']) if (enemy.statuses[id] > time) badges.push({ id });
    return badges;
  }
  /**
   * One room hazard: its painted sprite (art/smile-street/hazards), with its state drawn over it in code: a plate's
   * warning and heat, a crate's blinking fuse, the saw running along its groove, a spent music box.
   */
  drawHazard(h) {
    const c = this.ctx, g = this.game, rules = g.config.hazards, t = g.s.time, x = h.x * 20, y = h.y * 20, NAVY = '#2b3345';
    const art = name => this.mapImages?.get(HAZARD_ART[name]);
    /** The sprite `width` render pixels wide, its bottom edge at `bottom` (or centred on y when bottom is null). */
    const put = (image, width, bottom = null, alpha = 1) => {
      if (!image) return false;
      const height = width * image.height / image.width;
      c.save(); c.globalAlpha *= alpha; c.imageSmoothingEnabled = false; c.drawImage(image, Math.round(x - width / 2), Math.round(bottom === null ? y - height / 2 : bottom - height), Math.round(width), Math.round(height)); c.restore();
      return true;
    };
    const diamond = (hw, hd) => { c.beginPath(); c.moveTo(x, y - hd); c.lineTo(x + hw, y); c.lineTo(x, y + hd); c.lineTo(x - hw, y); c.closePath(); };
    c.save();
    if (h.kind === 'plate') {
      const frozen = h.cooledUntil > t, state = frozen ? 'cool' : plateState(h, t, rules.plate), hw = h.half * 20, hd = (h.depth ?? rules.plate.depth) * 20;
      put(art('plate'), hw * 2);
      // Cooled by ice: a pale frost sheet over the grate until it thaws.
      if (frozen) { diamond(hw * 0.9, hd * 0.9); c.globalAlpha = 0.45; c.fillStyle = '#cdf3fa'; c.fill(); c.globalAlpha = 1; c.lineWidth = 2; c.strokeStyle = '#7fd0e0'; c.stroke(); }
      // Warning: a pulsing amber outline. Heat: the grate glows orange under a solid navy-edged diamond.
      if (state === 'warn') { diamond(hw, hd); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke(); c.lineWidth = 2; c.strokeStyle = Math.floor(t * 8) % 2 ? '#ffd257' : '#ffbe20'; c.stroke(); }
      if (state === 'hot') {
        diamond(hw * 0.86, hd * 0.86); c.globalAlpha = 0.62 + 0.12 * Math.sin(t * 20); c.fillStyle = '#ff7a2c'; c.fill(); c.globalAlpha = 1;
        diamond(hw, hd); c.lineWidth = 3; c.strokeStyle = NAVY; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#ff7a2c'; c.stroke();
        c.fillStyle = '#ffd257'; for (let k = 0; k < 3; k++) { const wx = x + (k - 1) * hw * 0.45, wy = y - 4 - ((t * 30 + k * 7) % 12); c.fillRect(Math.round(wx), Math.round(wy), 2, 3); }
      }
    }
    if (h.kind === 'rail') {
      // The groove: brass lips either side of a dark slot, end to end, with brass stops at both ends.
      const ax = x - h.dx * 20, ay = y - h.dy * 20, bx = x + h.dx * 20, by = y + h.dy * 20;
      c.lineCap = 'round';
      const charged = h.chargedUntil > t;
      for (const [w, col] of [[8, NAVY], [6, '#c79a3e'], [3, charged ? (Math.floor(t * 16) % 2 ? '#ffe086' : '#fff4b7') : '#3a3440']]) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
      if (charged) { c.save(); c.globalAlpha = 0.35; c.lineWidth = 16; c.strokeStyle = '#ffe086'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.restore(); }
      for (const [ex, ey] of [[ax, ay], [bx, by]]) { this.rect(ex - 4, ey - 4, 8, 8, NAVY); this.rect(ex - 3, ey - 3, 6, 6, '#e0b048'); this.rect(ex - 1, ey - 1, 2, 2, NAVY); }
      const saw = sawAt(h, t, rules.rail.speed), image = art('saw'), size = rules.rail.radius * 2 * 20 * 1.4;
      c.save(); c.translate(saw.x * 20, saw.y * 20 - size * 0.35); c.rotate(t * 12);
      if (image) { c.imageSmoothingEnabled = false; c.drawImage(image, -size / 2, -size / 2, size, size); }
      c.restore();
    }
    if (h.kind === 'crate') {
      const lit = h.fuseAt !== undefined, w = h.size * 20 * 1.35, bottom = y + h.size * 10;
      if (lit && Math.floor(t * 12) % 2) c.filter = 'brightness(1.35) saturate(1.3)';
      put(art('crate'), w, bottom); c.filter = 'none';
      if (lit) { const top = bottom - w * 47 / 44; this.rect(x - 3, top - 7, 6, 6, NAVY); this.rect(x - 2, top - 6, 4, 4, Math.floor(t * 12) % 2 ? '#fff4b7' : '#d8423c'); }
    }
    if (h.kind === 'fence') {
      const across = h.w >= h.h, worn = h.hp <= 2;
      if (worn) c.filter = 'brightness(0.85) saturate(0.8)';
      if (across) put(art('fenceAcross'), h.w * 20 * 1.1, y + h.h * 10 + 2);
      else { const image = art('fenceUpright'); if (image) put(image, (h.h + 0.9) * 20 * image.width / image.height, y + h.h * 10 + 2); }
      c.filter = 'none';
    }
    if (h.kind === 'musicbox') {
      const off = h.used;
      if (off) c.filter = 'grayscale(0.8) brightness(0.9)';
      put(art('musicbox'), h.size * 20 * 1.45, y + h.size * 10);
      c.filter = 'none';
      if (!off) { const bob = Math.sin(t * 4) * 2; this.text('♪', x + 6, y - h.size * 20 * 1.3 + bob, '#2f8a62', 10); }
    }
    c.restore();
  }
  /**
   * The one trait mark round an elite's body: the brass shield plate in front, turned to where it faces, because which side
   * is guarded matters to the fight. The other traits show as the body's coloured outline and the name chips.
   */
  drawAffixAura(enemy) {
    if (!(enemy.frontGuard > 0) || !enemy.affixes.some(a => a.id === 'brassShield')) return;
    const c = this.ctx, x = enemy.x * 20, y = enemy.y * 20, a = enemy.facing;
    if (this.drawMark('affixShield', x + Math.cos(a) * 15, y - 14 + Math.sin(a) * 8, 11, { angle: a })) return;
    c.save(); c.lineWidth = 4; c.strokeStyle = '#2b3345'; c.beginPath(); c.arc(x, y - 14, 17, a - 0.9, a + 0.9); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#ffbe20'; c.beginPath(); c.arc(x, y - 14, 17, a - 0.9, a + 0.9); c.stroke(); c.restore();
  }
  /** The traits' names above the health bar: navy chips with the trait's colour as a stripe, so every name reads on any floor. */
  drawAffixTags(enemy, y) {
    const names = { fire: '불', ice: '얼음', lightning: '번개', wind: '바람' }, rules = this.game.config.eliteAffixes?.list || [];
    const tags = enemy.affixes.map(({ id, element }) => { const rule = rules.find(r => r.id === id); return rule && { text: element ? `${names[element]} ${rule.name}` : rule.name, color: element ? this.game.config.presentation.colors[element] : rule.color }; }).filter(Boolean);
    const ink = this.ink(); ink.font = `700 ${TAG_SIZE}px "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
    const widths = tags.map(tag => Math.ceil(ink.measureText(tag.text).width) + 9), total = widths.reduce((a, b) => a + b, 0) + (tags.length - 1) * 2;
    let x = Math.round(enemy.x * 20 - total / 2);
    tags.forEach((tag, i) => {
      this.rect(x - 1, y - 1, widths[i] + 2, TAG_SIZE + 5, '#f6ecd2'); this.rect(x, y, widths[i], TAG_SIZE + 3, '#2b3345'); this.rect(x, y, 3, TAG_SIZE + 3, tag.color);
      this.text(tag.text, x + 3 + (widths[i] - 3) / 2, y + TAG_SIZE + 0.5, '#fff4d6', TAG_SIZE);
      x += widths[i] + 2;
    });
  }
  /** Each trait's colour, in order: an element coating takes its element's colour. */
  affixColors(enemy) {
    const rules = this.game.config.eliteAffixes?.list || [], colors = this.game.config.presentation.colors;
    return enemy.affixes.map(({ id, element }) => element ? colors[element] : rules.find(r => r.id === id)?.color).filter(Boolean);
  }
  /**
   * An elite's body edged in its traits' colours: the sprite's own silhouette, filled with a colour, laid one sheet pixel
   * out in eight directions under the body (a second trait adds a second ring outside the first). It pulses gently.
   */
  drawOutline(x, y, pose, library, resize, colors) {
    const clip = library?.clip(pose.action, pose.direction), image = clip && library.image(clip.sheet);
    if (!image || typeof document === 'undefined' || !colors.length) return;
    const { frameWidth: w, frameHeight: h, columns, anchor, scale } = clip, size = scale * resize * BODY_SCALE / 2;
    const left = x - anchor[0] * size, top = y - anchor[1] * size, c = this.ctx;
    const shape = this.outlineShape ??= document.createElement('canvas');
    if (shape.width !== w || shape.height !== h) { shape.width = w; shape.height = h; }
    const t = shape.getContext('2d');
    c.save(); c.imageSmoothingEnabled = false; c.globalAlpha *= 0.8 + 0.2 * Math.sin(this.visualTime * 5);
    for (let ring = Math.min(2, colors.length); ring >= 1; ring--) {
      t.globalCompositeOperation = 'copy'; t.drawImage(image, pose.frame % columns * w, Math.floor(pose.frame / columns) * h, w, h, 0, 0, w, h);
      t.globalCompositeOperation = 'source-in'; t.fillStyle = colors[ring - 1]; t.fillRect(0, 0, w, h);
      const d = ring * Math.max(1, size);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.drawImage(shape, left + ox * d, top + oy * d, w * size, h * size);
    }
    c.restore();
  }
  drawStatuses(enemy, y) {
    const c = this.ctx, badges = this.statusBadges(enemy), width = ({ count }) => BADGE_SIZE + BADGE_GAP + (count > 1 ? COUNT_WIDTH : 0);
    let x = Math.round(enemy.x * 20 - badges.reduce((sum, badge) => sum + width(badge), 0) / 2);
    for (const badge of badges) {
      const image = this.mapImages?.get(STATUS_ICONS[badge.id]);
      if (image) c.drawImage(image, x, y, BADGE_SIZE, BADGE_SIZE);
      // Stacks read as a small ×N beside the icon, outlined so it stays legible over any floor.
      if (badge.count > 1) { const c = this.ink(); c.font = `700 ${COUNT_SIZE}px "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`; c.textAlign = 'left'; c.lineWidth = 2; c.strokeStyle = '#2b3345'; c.strokeText(`×${badge.count}`, x + BADGE_SIZE, y + BADGE_SIZE - 1); c.fillStyle = '#fff4d6'; c.fillText(`×${badge.count}`, x + BADGE_SIZE, y + BADGE_SIZE - 1); }
      x += width(badge);
    }
  }
  drawDummy(enemy, image) {
    const c = this.ctx, flash = enemy.flashUntil > this.game.s.time;
    if (flash) c.filter = 'brightness(1.6)';
    this.drawProp({ image, x: enemy.x, y: enemy.y, scale: 1 });
    c.filter = 'none';
    this.drawStatuses(enemy, enemy.y * 20 - 70);
  }
  /** A small map of the area in the corner: the art itself, the view, people, enemies and where to go next. */
  drawMinimap(target) {
    const place = this.minimapPlace, g = this.game, s = g.s;
    if (!place?.mapImage || !place.map) return false;
    const c = target.getContext('2d'), W = target.width, H = target.height, [mw, mh] = place.size, k = Math.min(W / mw, H / mh), ox = (W - mw * k) / 2, oy = (H - mh * k) / 2;
    const at = (x, y) => [ox + x * k, oy + y * k], dot = (x, y, r, fill, edge = '#2b3345') => { const [px, py] = at(x, y); c.beginPath(); c.arc(px, py, r, 0, TAU); c.fillStyle = fill; c.fill(); c.lineWidth = 2; c.strokeStyle = edge; c.stroke(); };
    c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(43, 51, 69, 0.35)'; c.fillRect(0, 0, W, H);
    // The map shrunk to minimap size once per picture and size; scaling the full painting down every frame was costly.
    const key = `${W}x${H}`;
    if (this.minimapArt?.image !== place.mapImage || this.minimapArt.key !== key) {
      const art = document.createElement('canvas'); art.width = Math.max(1, Math.round(mw * k)); art.height = Math.max(1, Math.round(mh * k));
      const a = art.getContext('2d'); a.imageSmoothingEnabled = true; a.imageSmoothingQuality = 'high'; a.drawImage(place.mapImage, 0, 0, art.width, art.height);
      this.minimapArt = { image: place.mapImage, key, art };
    }
    // Half see-through, so the minimap sits on the scene instead of competing with it.
    c.globalAlpha = 0.5; c.drawImage(this.minimapArt.art, ox, oy); c.globalAlpha = 1;
    const [vx, vy] = at(this.camera.x, this.camera.y); c.lineWidth = 2; c.strokeStyle = '#fff4d6cc'; c.strokeRect(vx, vy, SCREEN_UNITS[0] * k, SCREEN_UNITS[1] * k);
    if (place.goal) dot(place.goal.x, place.goal.y, 5, '#ffd257');
    for (const npc of (place.map.npcs || []).filter(npc => npc.label)) dot(npc.x, npc.y, 4, '#7fc7b0');
    for (const enemy of s.enemies) if (enemy.hp > 0 && !enemy.hidden && !enemy.dummy) dot(enemy.x, enemy.y, enemy.boss ? 6 : 3.5, '#e0564c');
    dot(g.p.x, g.p.y, 5, '#fff4d6');
    return true;
  }
  /** A boss's phase break on the floor: the shield, then Roco's suction and cans, Brass's drums and lanes, or the soldier ring. */
  /**
   * The four drums sit wide round Brass, often off screen; a small board under the boss bar repeats them in the same
   * layout, lighting with them and ticking off the ones struck in order.
   */
  drawDrumBoard(b, rule, now, drumArt) {
    const c = this.ctx, cell = 11, gap = 2, cx = this.camera.x * 20 + 6 + cell + gap * 2, top = this.camera.y * 20 + 40;
    const xs = b.drums.map(d => d.x), ys = b.drums.map(d => d.y), midX = (Math.min(...xs) + Math.max(...xs)) / 2, midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    c.save(); c.globalAlpha = 0.92; this.rect(cx - cell - gap * 2, top - gap, cell * 2 + gap * 4, cell * 2 + gap * 3, '#f6ecd2'); c.strokeStyle = '#2b3345'; c.lineWidth = 1; c.strokeRect(Math.round(cx - cell - gap * 2), Math.round(top - gap), Math.round(cell * 2 + gap * 4), Math.round(cell * 2 + gap * 3)); c.globalAlpha = 1;
    for (const drum of b.drums) {
      const col = drum.x > midX ? 1 : 0, row = drum.y > midY ? 1 : 0, x = cx - cell - gap + col * (cell + gap * 2), y = top + row * (cell + gap);
      const glow = drum.flash > now && !drum.done ? Math.min(1, (drum.flash - now) / (rule.showStep * 0.8) / 0.35) : 0;
      if (glow) { c.fillStyle = `rgba(255, 210, 87, ${0.9 * glow})`; c.fillRect(Math.round(x - 2), Math.round(y - 2), cell + 4, cell + 4); }
      if (drumArt) c.drawImage(drumArt, Math.round(x), Math.round(y - (glow ? 2 : 0)), cell, cell); else this.rect(x + 3, y + 5, cell - 6, cell - 8, '#c43c36');
      if (glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 * glow; if (drumArt) c.drawImage(drumArt, Math.round(x), Math.round(y - 2), cell, cell); c.restore(); }
      if (drum.done) { c.fillStyle = '#4f8a4acc'; c.fillRect(Math.round(x), Math.round(y), cell, cell); this.text('✓', x + cell / 2, y + cell - 2, '#fff4d6', 9); }
    }
    c.restore();
  }
  drawPhaseBreak(enemy) {
    const c = this.ctx, g = this.game, b = enemy.breaking, rule = g.config.bossAI[enemy.type].phaseBreaks[b.index], x = enemy.x * 20, y = enemy.y * 20, now = g.s.time;
    c.save();
    if (b.failAt !== null) {
      const left = Math.max(0, (b.failAt - now) / rule.failWarn);
      c.fillStyle = `rgba(169, 47, 43, ${0.12 + (1 - left) * 0.2})`; c.fillRect(this.camera.x * 20 - 40, this.camera.y * 20 - 40, 2000, 1200);
      this.text('!!', x, y - 50, '#a92f2b', 18); c.restore(); return;
    }
    if (b.kind === 'cans') {
      const half = rule.degrees * Math.PI / 360;
      c.strokeStyle = '#8c9fb0'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x, y); c.arc(x, y, rule.range * 20, b.angle - half, b.angle + half); c.closePath(); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 4; i++) { const r = (1 - ((now * 1.4 + i / 4) % 1)) * rule.range * 20; c.beginPath(); c.arc(x, y, Math.max(4, r), b.angle - half, b.angle + half); c.stroke(); }
      for (const can of b.cans) {
        c.save(); c.translate(can.x * 20, can.y * 20 - 6); c.rotate(can.spin);
        if (can.back) { c.fillStyle = '#ffd25766'; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); }
        if (!this.drawFxFrame('rocoCan', now * 8 + can.x, 0, 0)) { this.rect(-4, -5, 8, 10, '#9aa3b5'); this.rect(-4, -2, 8, 3, '#a92f2b'); c.strokeStyle = '#2b3345'; c.lineWidth = 1; c.strokeRect(-4, -5, 8, 10); }
        c.restore();
      }
    }
    if (b.kind === 'drums') {
      for (const lane of b.lanes) {
        const left = Math.max(0, (lane.at - now) / rule.laneWarn), top = this.camera.y * 20 - 20;
        c.save(); c.globalAlpha = 0.35 + (1 - left) * 0.5; c.translate(lane.x * 20, top); c.rotate(Math.PI / 2);
        const drawn = this.drawLaneTiles(900, rule.laneWidth * 10); c.restore();
        if (!drawn) { c.fillStyle = `rgba(190, 81, 95, ${0.1 + (1 - left) * 0.2})`; c.fillRect((lane.x - rule.laneWidth / 2) * 20, top, rule.laneWidth * 20, 900); }
      }
      const drumArt = this.mapImages?.get(BRASS_DRUM_ART), playing = b.phase === 'play';
      for (const drum of b.drums) {
        // A drum being shown hops, rings the floor gold and sends a column of light up, so the order can be followed.
        const dx = drum.x * 20, dy = drum.y * 20, left = Math.max(0, (drum.flash - now) / (rule.showStep * 0.8)), glow = Math.min(1, left / 0.35), hop = left ? Math.sin((1 - left) * Math.PI) * 7 : 0;
        if (drum.done) { c.fillStyle = '#4f8a4a77'; c.beginPath(); c.ellipse(dx, dy, 15, 6, 0, 0, TAU); c.fill(); }
        else if (playing) { c.strokeStyle = '#ffd257'; c.lineWidth = 1.5; c.globalAlpha = 0.45 + 0.35 * Math.sin(now * 6); c.setLineDash([3, 3]); c.beginPath(); c.ellipse(dx, dy, 15, 6, 0, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
        if (glow && !drum.done) {
          const column = c.createLinearGradient(0, dy - 90, 0, dy); column.addColorStop(0, 'rgba(255, 210, 87, 0)'); column.addColorStop(1, `rgba(255, 226, 120, ${0.8 * glow})`);
          c.fillStyle = column; c.fillRect(dx - 13, dy - 90, 26, 90);
          const spread = 1 - left; c.strokeStyle = '#ffd257'; c.lineWidth = 3; c.globalAlpha = glow; c.beginPath(); c.ellipse(dx, dy, 14 + spread * 18, 6 + spread * 7, 0, 0, TAU); c.stroke();
          c.fillStyle = '#fff4d6'; c.beginPath(); c.ellipse(dx, dy - 22 - hop, 20, 15, 0, 0, TAU); c.globalAlpha = 0.5 * glow; c.fill(); c.globalAlpha = 1;
        }
        if (drumArt) {
          const size = 34, x0 = Math.round(dx - size / 2), y0 = Math.round(dy - size + 4 - hop);
          c.drawImage(drumArt, x0, y0, size, size);
          if (glow && !drum.done) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75 * glow; c.drawImage(drumArt, x0, y0, size, size); c.restore(); }
        } else {
          this.rect(dx - 9, dy - 12 - hop, 18, 10, glow ? '#ffd257' : '#c43c36'); c.strokeStyle = '#2b3345'; c.lineWidth = 1.2; c.strokeRect(dx - 9, dy - 12 - hop, 18, 10);
        }
        if (drum.done) this.text('✓', dx, dy - 30, '#4f8a4a', 12);
      }
      this.drumBoard = [b, rule, now, drumArt];
    }
    if (b.kind === 'flags') {
      for (const s of b.soldiers) {
        if (s.down) continue;
        const sx = s.x * 20, sy = s.y * 20;
        this.rect(sx - 4, sy - 13, 8, 10, s.flag ? '#c79a3e' : '#a92f2b'); this.rect(sx - 4, sy - 18, 8, 5, '#2b3345'); this.rect(sx - 4, sy - 3, 3, 4, '#2b3345'); this.rect(sx + 1, sy - 3, 3, 4, '#2b3345');
        if (s.flag) { this.line(sx + 4, sy - 13, sx + 4, sy - 28, '#2b3345', 1.5); c.fillStyle = '#ffd257'; c.beginPath(); c.moveTo(sx + 4, sy - 28); c.lineTo(sx + 13, sy - 25); c.lineTo(sx + 4, sy - 22); c.fill(); }
      }
    }
    c.strokeStyle = '#3f8fb0'; c.lineWidth = 2.5; c.setLineDash([8, 4]); c.beginPath(); c.ellipse(x, y - 12, 34, 38, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 0.15; c.fillStyle = '#7fc7e0'; c.beginPath(); c.ellipse(x, y - 12, 34, 38, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    c.restore();
  }
  /** The yellow ring and arrow: a place to walk to, and the portal between the yard and the town. */
  marker({ x, y }) {
    const c = this.ctx, beat = this.game.s.profile.settings.reducedMotion ? 0 : Math.sin(this.visualTime * 4);
    c.strokeStyle = '#ffd257'; c.lineWidth = 2; c.beginPath(); c.ellipse(x * 20, y * 20, 15 + beat * 2, 6 + beat, 0, 0, TAU); c.stroke();
    c.fillStyle = '#ffd257'; c.beginPath(); c.moveTo(x * 20 - 7, y * 20 - 34 + beat * 3); c.lineTo(x * 20 + 7, y * 20 - 34 + beat * 3); c.lineTo(x * 20, y * 20 - 24 + beat * 3); c.fill();
  }
  /** A goal off the screen is pointed at from the edge nearest to it. */
  pointTo(goal, fill = '#ffd257') {
    const c = this.ctx, halfW = SCREEN_UNITS[0] / 2, halfH = SCREEN_UNITS[1] / 2, centerX = this.camera.x + halfW, centerY = this.camera.y + halfH;
    const dx = goal.x - centerX, dy = goal.y - centerY;
    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return;
    const reach = Math.min((halfW - 1.5) / (Math.abs(dx) || 1e-6), (halfH - 2) / (Math.abs(dy) || 1e-6));
    c.save(); c.translate((centerX + dx * reach) * 20, (centerY + dy * reach) * 20); c.rotate(Math.atan2(dy, dx));
    c.fillStyle = fill; c.strokeStyle = '#3b2f1c'; c.lineWidth = 2; c.beginPath(); c.moveTo(13, 0); c.lineTo(-9, -11); c.lineTo(-4, 0); c.lineTo(-9, 11); c.closePath(); c.stroke(); c.fill(); c.restore();
  }
  /**
   * Where a placed skill will land: a soft disc on the floor in the skill's colour, a dashed rim, and an inner ring that
   * closes in on the rim as the moment of impact comes, so the timing reads as well as the place.
   */
  drawLandingMark(fx, x, y, fraction) {
    const c = this.ctx, r = fx.value * 20, flat = 0.55;
    // With its element's floor mark painted (lightning, frost, embers, or the hatch an enemy climbs out of), the mark turns
    // slowly and firms up toward the hit; the closing ring still keeps the time.
    const art = { lightning: 'landLightning', ice: 'landIce', fire: 'landFire', spawn: 'spawn' }[fx.mark];
    if (art && this.mark(art)) {
      const grow = fx.mark === 'spawn' ? 0.6 + 0.4 * Math.min(1, fraction * 3) : 1;
      // A faint wash of the skill's colour under the mark, so the whole reach reads and not only its rim.
      if (fx.mark !== 'spawn') { c.save(); c.globalAlpha = 0.12 + 0.14 * fraction; c.fillStyle = fx.color; c.beginPath(); c.ellipse(x, y, r, r * flat, 0, 0, TAU); c.fill(); c.restore(); }
      this.drawMark(art, x, y, r * 2 * grow, { flat, angle: fx.mark === 'spawn' ? 0 : this.visualTime * 0.8, alpha: 0.55 + 0.45 * fraction });
      c.save(); c.translate(x, y); c.scale(1, flat);
      for (const [w, col] of [[4, '#2b3345'], [2, fx.mark === 'spawn' ? '#ffd257' : '#fff4d6']]) { c.globalAlpha = 0.5 + 0.5 * fraction; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(0, 0, Math.max(2, r * fraction), 0, TAU); c.stroke(); }
      c.restore(); return;
    }
    c.save(); c.translate(x, y); c.scale(1, flat);
    c.globalAlpha = 0.16 + 0.14 * fraction; c.fillStyle = fx.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.globalAlpha = 0.85; c.strokeStyle = fx.color; c.lineWidth = 2; c.setLineDash([6, 5]); c.lineDashOffset = -this.visualTime * 18; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.setLineDash([]); c.globalAlpha = 0.5 + 0.5 * fraction; c.strokeStyle = '#fff4d6'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, Math.max(2, r * fraction), 0, TAU); c.stroke();
    c.restore();
  }
  /**
   * A blast about to go off (a lit crate, a volatile elite's death): the whole reach marked at once, blinking faster as the
   * fuse burns, with a ring filling round its edge until the moment it blows.
   */
  drawDanger(fx, x, y, fraction) {
    const c = this.ctx, r = fx.value * 20, flat = 0.55, blink = 0.5 + 0.5 * Math.sin(this.visualTime * (8 + 24 * fraction));
    if (!this.drawMark('danger', x, y, r * 2, { flat, alpha: 0.45 + 0.35 * blink })) {
      c.save(); c.translate(x, y); c.scale(1, flat); c.globalAlpha = 0.12 + 0.16 * blink; c.fillStyle = fx.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.globalAlpha = 0.9; c.strokeStyle = fx.color; c.lineWidth = 2; c.setLineDash([6, 4]); c.stroke(); c.restore();
    }
    c.save(); c.translate(x, y); c.scale(1, flat); c.lineCap = 'round';
    for (const [w, col] of [[5, '#2b3345'], [3, fraction > 0.7 && blink > 0.5 ? '#fff4b7' : fx.color]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * fraction); c.stroke(); }
    c.restore();
  }
  /** Keeps a drawn body behind whatever scenery stands in front of its feet. */
  coverBody(mask, x, y, halfWidth = 1.3, tall = 2.9) { return mask?.cover(this.ctx, x, y, halfWidth, tall) || 0; }
  drawNpc({ x, y, pose, label }, mask) {
    const clip = this.npcSprites.clip(pose.action, pose.direction);
    if (!this.drawSprite(x * 20, y * 20, pose, this.npcSprites)) return;
    this.coverBody(mask, x, y);
    if (!label) return;
    this.labels.push({ label, x: x * 20, y: y * 20 - clip.bodyHeight * clip.scale * BODY_SCALE / 2 - NAME_GAP });
  }
  /** A resident's name floats just over the head: pale letters edged in ink, no box, like a caption in the world. */
  nameplate(label, x, bottom, fill = '#fff4d6') {
    const c = this.ink();
    c.save(); c.font = `700 ${NAME_SIZE}px "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = '#2b3345'; c.strokeText(label, x, bottom);
    c.fillStyle = fill; c.fillText(label, x, bottom); c.restore(); if (c !== this.ctx) c.globalAlpha = 1;
  }
  tag(label, x, top) {
    this.rect(x - label.length * 3.5 - 4, top - 1, label.length * 7 + 8, 11, '#fff8e8');
    this.text(label, x, top + 7, '#3f5c55', 8);
  }
  /** One frame of an effect sheet (art/fx), placed by its anchor, turned and stretched as asked. */
  drawFxFrame(name, frame, x, y, { angle = 0, sx = 1, sy = 1, alpha = 1 } = {}) {
    const fx = FX[name], image = this.mapImages?.get(fx.sheet);
    if (!image) return false;
    const f = Math.max(0, Math.min(fx.frames - 1, Math.floor(frame) % fx.frames)), c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.translate(x, y); if (angle) c.rotate(angle); c.scale(sx, sy);
    c.drawImage(image, (f % fx.cols) * fx.w, Math.floor(f / fx.cols) * fx.h, fx.w, fx.h, -fx.anchor[0], -fx.anchor[1], fx.w, fx.h);
    c.restore(); return true;
  }
  /** A still from MARKS (see fx-sprites.js), or undefined while it is not loaded or not drawn yet. */
  mark(name) { return this.mapImages?.get(MARKS[name]); }
  /**
   * Draws a still centred on x, y, `width` render pixels wide. `flat` squashes a mark seen from above onto the floor;
   * `tint` recolours a pale picture (cached per colour). False when the picture is missing, so the caller draws its shape.
   */
  drawMark(name, x, y, width, { flat = 1, angle = 0, alpha = 1, tint = null, smooth = false } = {}) {
    let image = this.mark(name);
    if (!image) return false;
    if (tint) image = this.tinted(image, tint);
    const c = this.ctx, height = width * image.height / image.width;
    c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (flat !== 1) c.scale(1, flat); if (angle) c.rotate(angle);
    c.imageSmoothingEnabled = smooth; c.drawImage(image, -width / 2, -height / 2, width, height); c.restore();
    return true;
  }
  /** A pale picture multiplied by `color`, its own transparency kept. Made once per picture and colour. */
  tinted(image, color) {
    this.tints ??= new Map();
    const key = `${color}`, byImage = this.tints.get(image) || new Map();
    this.tints.set(image, byImage);
    if (byImage.has(key)) return byImage.get(key);
    if (typeof document === 'undefined') return image;
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height }), t = canvas.getContext('2d');
    t.drawImage(image, 0, 0); t.globalCompositeOperation = 'multiply'; t.fillStyle = color; t.fillRect(0, 0, canvas.width, canvas.height);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(image, 0, 0);
    byImage.set(key, canvas); return canvas;
  }
  /** A small warning picture over a tell (suction, stomp, bell...); the old letters while it is missing. */
  glyph(name, x, y, fallback, color = '#b85863', size = 11) {
    if (!this.mark(name)) return this.text(fallback, x, y, color, size);
    this.overlay(() => this.drawMark(name, x, y - 4, 24));
  }
  /**
   * Draws later, over every body, at the place the current transform puts it: a tell's glyph sits on the floor zone but
   * must not vanish under the boss or F2 standing in it.
   */
  overlay(draw) {
    const m = this.ctx.getTransform?.();
    (this.overlays ??= []).push(() => { const c = this.ctx; c.save(); if (m) c.setTransform(m); draw(); c.restore(); });
  }
  /** A jagged spark of current between two points, redrawn each frame so it crackles. */
  zigzag(x1, y1, x2, y2, seed) {
    const c = this.ctx, n = 6, wobble = k => { const v = Math.sin(k * 91.7) * 43758.5; return v - Math.floor(v) - 0.5; };
    const pts = Array.from({ length: n }, (_, i) => { const t = (i + 1) / n, j = i < n - 1 ? 10 : 0; return [x1 + (x2 - x1) * t + wobble(seed + i * 7.3) * j, y1 + (y2 - y1) * t + wobble(seed + i * 3.1 + 5) * j]; });
    for (const [w, col] of [[3, '#fff8cf'], [1.2, '#ffd257']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); for (const [px, py] of pts) c.lineTo(px, py); c.stroke(); }
  }
  /** The picture an effect asks for by `look`; false while its sheet is not loaded, so the plain shape is drawn. */
  drawLook(fx, x, y, t) {
    const g = this.game, frameAt = name => t * FX[name].frames;
    switch (fx.look) {
      case 'thrust': {
        // A pike or claw shoots out along the line: a steel shaft grows to the far end with the jab picture (never stretched)
        // riding its tip, holds a moment, then fades.
        if (!this.mapImages?.get(FX.guardThrust.sheet)) return false;
        const tx = fx.targetX * 20, ty = fx.targetY * 20 - 8, sy = y - 8, a = Math.atan2(ty - sy, tx - x), reach = Math.min(1, t / 0.25), c = this.ctx;
        const hx = x + (tx - x) * reach, hy = sy + (ty - sy) * reach, fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        c.save(); c.globalAlpha *= fade; c.lineCap = 'round';
        for (const [w, col] of [[5, '#2b3345'], [3, '#8a8f9c'], [1, '#d8dde2']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, sy); c.lineTo(hx - Math.cos(a) * 14, hy - Math.sin(a) * 14); c.stroke(); }
        c.restore();
        return this.drawFxFrame('guardThrust', frameAt('guardThrust'), hx - Math.cos(a) * 34, hy - Math.sin(a) * 34, { angle: a, sx: 1.2, sy: 1.2, alpha: fade });
      }
      // The drum doll's beat: two gold rings and notes flying up (PixelLab), sized to the beat's reach.
      case 'drumBeat': { const k = fx.value * 20 / 54; return this.drawFxFrame('drumBeat', frameAt('drumBeat'), x, y, { sx: k, sy: k }); }
      case 'crateCrash': return this.drawFxFrame('crateCrash', frameAt('crateCrash'), x, y);
      case 'quake': { const k = fx.value * 20 / 44; return this.drawFxFrame('groundShockwave', frameAt('groundShockwave'), x, y, { sx: k, sy: k, alpha: 0.85 }); }
      case 'boom': { const k = Math.max(1, fx.value * 20 / 20); return this.drawFxFrame('ratExplosion', frameAt('ratExplosion'), x, y + 4, { sx: k, sy: k }); }
      case 'wave': { const k = Math.max(0.7, fx.value * 20 / 84); return this.drawFxFrame('trumpetWave', frameAt('trumpetWave'), x, y - 10, { angle: fx.angle, sx: k, sy: k }); }
      case 'heatSwing': return this.drawFxFrame('heatSwing', frameAt('heatSwing'), x, y - 10, { angle: fx.angle, sx: 1.6, sy: 1.6 });
      case 'deflect': return this.drawFxFrame('deflectFlash', frameAt('deflectFlash'), x, y - 8);
      case 'ready': { const at = fx.follow ? g.p : fx; return this.drawFxFrame('readyPop', frameAt('readyPop'), at.x * 20, at.y * 20 - 34); }
      case 'zap': return this.drawFxFrame('electricHit', frameAt('electricHit'), x, y - 24);
      case 'zapBig': return this.drawFxFrame('electricHit', frameAt('electricHit'), x, y - 20, { sx: 1.8, sy: 1.8 });
      case 'gust': return this.drawFxFrame('pressureDash', this.visualTime * 12, x, y - 12, { angle: fx.angle, sx: 0.6, sy: 0.6, alpha: 1 - t });
      case 'frostShatter': return this.drawFxFrame('frostShatter', frameAt('frostShatter'), x, y - 24);
      case 'zapLine': {
        // Lightning runs along a saw rail: two crackling threads end to end, and a burst at each brass stop.
        const tx = fx.targetX * 20, ty = fx.targetY * 20, seed = Math.floor(this.visualTime * 24);
        this.zigzag(x, y - 2, tx, ty - 2, seed); if (t < 0.6) this.zigzag(x, y - 2, tx, ty - 2, seed + 41);
        this.drawFxFrame('electricHit', frameAt('electricHit'), x, y - 10, { sx: 0.8, sy: 0.8 });
        this.drawFxFrame('electricHit', frameAt('electricHit'), tx, ty - 10, { sx: 0.8, sy: 0.8 });
        return true;
      }
      case 'shieldBreak': {
        // A boss's shield gives: the cracked-floor shockwave under a big burst of brass sparks.
        const k = fx.value * 20 / 44;
        if (!this.drawFxFrame('groundShockwave', frameAt('groundShockwave'), x, y, { sx: k, sy: k, alpha: 0.8 })) return false;
        this.drawFxFrame('deflectFlash', frameAt('deflectFlash'), x, y - 30, { sx: 2.4, sy: 2.4 });
        return true;
      }
      case 'notes': { const k = fx.value * 20 / 54; return this.drawFxFrame('drumBeat', frameAt('drumBeat'), x, y, { sx: k, sy: k }); }
      case 'dash': return this.drawFxFrame('pressureDash', this.visualTime * 12, g.p.x * 20, g.p.y * 20 - 12, { angle: fx.angle, alpha: 1 - t * 0.6 });
      case 'carpetRoll': {
        // A new live carpet unrolls from one end to the other, gold-edged, then stays lit while Brass lives.
        const ax = fx.x, ay = fx.y, length = Math.hypot(fx.targetX - ax, fx.targetY - ay) * 20 * Math.min(1, t * 1.6), c = this.ctx;
        c.save(); c.translate(x, y); c.rotate(Math.atan2(fx.targetY - ay, fx.targetX - ax));
        c.globalAlpha *= 1 - Math.max(0, t - 0.7) / 0.3; c.fillStyle = 'rgba(255, 210, 87, 0.35)'; c.fillRect(0, -14, length, 28);
        c.strokeStyle = '#ffd257'; c.lineWidth = 2; c.strokeRect(0, -14, length, 28); c.fillStyle = '#ffd257'; c.fillRect(length - 4, -16, 8, 32); c.restore();
        return true;
      }
      case 'march': {
        // Boots come down along the lane one after another, from where the march starts to where it ends.
        const tx = fx.targetX * 20, ty = fx.targetY * 20, steps = Math.max(1, Math.round(Math.hypot(tx - x, ty - y) / 24));
        if (!this.mapImages?.get(FX.marchStomp.sheet)) return false;
        for (let i = 0; i <= steps; i++) { const k = i / steps, local = t * 1.5 - k * 0.5; if (local >= 0 && local < 1) this.drawFxFrame('marchStomp', local * FX.marchStomp.frames, x + (tx - x) * k, y + (ty - y) * k); }
        return true;
      }
      case 'spanner': {
        // The charged spanner flies to its first enemy, bursts there, and current leaps on to the others.
        if (!this.mapImages?.get(FX.conductiveSpanner.sheet)) return false;
        const tx = fx.targetX * 20, ty = fx.targetY * 20 - 24, sx = x, sy = y - 16, fly = Math.min(1, t / 0.35);
        if (t < 0.35) this.drawFxFrame('conductiveSpanner', this.visualTime * 12, sx + (tx - sx) * fly, sy + (ty - sy) * fly, { angle: Math.atan2(ty - sy, tx - sx) });
        else {
          const k = (t - 0.35) / 0.65;
          this.drawFxFrame('electricHit', k * FX.electricHit.frames, tx, ty);
          for (const [i, e] of (fx.chain || []).entries()) { const ex = e.x * 20, ey = e.y * 20 - 24; if (k < 0.6) this.zigzag(tx, ty, ex, ey, Math.floor(this.visualTime * 20) + i * 13); this.drawFxFrame('electricHit', Math.max(0, k - 0.1) * FX.electricHit.frames, ex, ey); }
        }
        return true;
      }
    }
    return false;
  }
  drawCastEffect({ effect, frame, x, y, lift }) {
    const { frameWidth: w, frameHeight: h, columns, anchor, scale = 1 } = effect, size = scale / 2, left = Math.round((x * 20 - anchor[0] * size) * 2) / 2, top = Math.round(((y - lift) * 20 - anchor[1] * size) * 2) / 2;
    const image = this.sprites.image(effect.sheet);
    if (!image) return;
    this.ctx.drawImage(image, frame % columns * w, Math.floor(frame / columns) * h, w, h, left, top, w * size, h * size);
  }
  rect(x, y, w, h, color) { const c = this.ctx; c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  line(x1, y1, x2, y2, color, width = 1) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  circle(x, y, r, color) { const c = this.ctx; c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  /** Where words go: the letters layer, placed exactly where the frame's current transform would put them. */
  ink() {
    const t = this.letters?.getContext('2d');
    if (!t) return this.ctx;
    const m = this.ctx.getTransform(), r = this.letters.width / this.canvas.width;
    t.setTransform(m.a * r, m.b * r, m.c * r, m.d * r, m.e * r, m.f * r); t.globalAlpha = this.ctx.globalAlpha;
    return t;
  }
  text(text, x, y, color = '#3f5c55', size = 7, align = 'center') { const c = this.ink(); c.font = `600 ${size}px "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`; c.fillStyle = color; c.textAlign = align; c.fillText(text, x, y); }
  gear(x, y, radius, color, rotation = 0) {
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(rotation);
    for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); this.rect(-radius * 0.2, -radius * 1.2, radius * 0.4, radius * 0.55, color); }
    this.circle(0, 0, radius, color); this.circle(0, 0, radius * 0.35, '#f2e6c9'); c.restore();
  }
  building(x, y, w, h, color, label, accent = '#e49287') {
    this.rect(x + 4, y + 9, w, h, '#c2ba9d'); this.rect(x, y, w, h, color);
    this.rect(x - 3, y - 3, w + 6, 9, accent); this.rect(x, y + 6, w, 3, '#b38173');
    for (let n = 0; n < w; n += 12) { this.rect(x + n, y - 2, 6, 8, '#f8e3c2'); }
    this.rect(x + 6, y + 14, 12, 15, '#496d68'); this.rect(x + 8, y + 16, 8, 10, '#a7d4c8');
    this.rect(x + w - 19, y + 14, 12, 15, '#496d68'); this.rect(x + w - 17, y + 16, 8, 10, '#a7d4c8');
    this.rect(x + w / 2 - 8, y + h - 21, 16, 21, '#5a6556'); this.rect(x + w / 2 - 6, y + h - 18, 12, 18, '#ad8461');
    this.circle(x + w / 2 + 3, y + h - 8, 1, '#f3d294');
    this.rect(x + w / 2 - 21, y + 10, 42, 10, '#fff0d5'); this.text(label, x + w / 2, y + 17, '#695a4c', 6);
    this.rect(x - 3, y + h, w + 6, 4, '#d0bda0');
  }
  planter(x, y, variant = 0) {
    this.rect(x - 8, y + 3, 19, 5, '#c7b595'); this.rect(x - 7, y, 16, 6, '#c78c72'); this.rect(x - 8, y - 2, 18, 3, '#e3aa85');
    for (let i = 0; i < 4; i++) { const px = x - 5 + i * 4; this.rect(px, y - 7 - (i % 2) * 3, 2, 8, '#72916c'); this.circle(px + 1, y - 8 - (i % 2) * 3, 3, variant ? '#f3d77d' : '#e09aa1'); this.rect(px, y - 9 - (i % 2) * 3, 2, 2, '#fff0bd'); }
  }
  scenery(hub) {
    const c = this.ctx, g = this.game, t = this.visualTime;
    this.rect(0, 0, 560, 320, '#d6dbc0');
    this.rect(0, 65, 560, 238, '#ddd5b8');
    // Broad pastel paving with visible, restrained pixel texture.
    for (let row = 0; row < 17; row++) for (let col = 0; col < 31; col++) {
      const x = col * 20 + (row % 2) * 10 - 10, y = row * 15 + 64;
      const shade = ((row * 11 + col * 7) % 9);
      this.rect(x + 1, y + 1, 18, 13, shade < 2 ? '#e8dfc5' : shade < 5 ? '#e3dbbf' : '#ded5b9');
      if (shade === 2) this.rect(x + 4, y + 4, 4, 1, '#d2c7a9');
    }
    this.rect(27, 62, 506, 3, '#b3b99b'); this.rect(27, 294, 506, 4, '#c2b89a');
    this.rect(0, 298, 560, 22, '#b9c2a1');
    for (let i = 0; i < 28; i++) { this.rect(i * 21 + 2, 304 + (i % 3) * 3, 2, 5, '#98ab88'); this.rect(i * 21 + 5, 303 + (i % 3) * 3, 3, 2, '#b1bd96'); }
    // The signal circuit lives underneath the cheerful main street.
    this.line(22, 64, 22, 286, '#86768c', 2); this.line(538, 64, 538, 286, '#86768c', 2);
    for (let y = 95; y < 290; y += 45) { this.rect(17, y, 10, 12, '#62766e'); this.rect(20, y + 3, 4, 4, '#cf93ac'); this.rect(534, y, 9, 12, '#62766e'); }
    this.building(30, 8, 89, 48, '#b2cbb8', '모루의 수리점', '#769f91');
    this.building(137, 6, 70, 49, '#f0c7ae', '사탕과 단추', '#d88e85');
    // Center clock tower: a friendly silhouette with a remote control core.
    this.rect(252, -10, 57, 61, '#bbaa89'); this.rect(257, -10, 47, 61, '#f2d99e'); this.rect(248, 43, 65, 8, '#b79d75');
    this.rect(262, -4, 37, 5, '#496b63'); this.circle(280, 21, 17, '#8f8f70'); this.circle(280, 21, 14, '#f4ecd2');
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; this.rect(280 + Math.sin(a) * 11 - 1, 21 - Math.cos(a) * 11 - 1, 2, 2, '#8b8b71'); }
    this.line(280, 21, 280 + Math.sin(t * 0.04) * 8, 21 - Math.cos(t * 0.04) * 8, '#4d655d', 2); this.line(280, 21, 287, 25, '#4d655d', 2); this.circle(280, 21, 2, '#c28582');
    this.building(346, 6, 73, 48, '#e3c2c2', '행복 보관소', '#b498ad');
    this.building(440, 10, 86, 46, '#c5d4c4', '웃음거리', '#8eaea0');
    // Bunting and lamp posts.
    c.strokeStyle = '#aab09b'; c.lineWidth = 1; c.beginPath(); c.moveTo(25, 55); c.quadraticCurveTo(280, 98, 535, 55); c.stroke();
    for (let i = 0; i < 22; i++) { const x = 29 + i * 24, y = 55 + 20 * Math.sin((x - 25) / 510 * Math.PI); c.fillStyle = ['#d48e87', '#d9bc7e', '#8bb3a4', '#c1a2b7'][i % 4]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 9, y + 1); c.lineTo(x + 4, y + 12); c.fill(); }
    for (const x of [42, 518]) { this.rect(x - 2, 56, 4, 30, '#526f64'); this.rect(x - 6, 51, 12, 12, '#617e70'); this.rect(x - 4, 53, 8, 8, '#f3db98'); this.rect(x - 5, 84, 10, 3, '#526f64'); }
    this.planter(62, 283); this.planter(495, 283, 1); this.planter(45, 107, 1); this.planter(515, 107);
    // Outbound gate and a single controlled spectator.
    this.rect(538, 143, 22, 5, '#89a691'); this.rect(538, 195, 22, 5, '#89a691');
    this.rect(548, 148, 7, 47, '#6b8679'); this.rect(550, 152, 3, 36, '#d4b674');
    this.text('→', 542, 176, '#f4e7ba', 15);
    for (const obstacle of g.obstacles) {
      const x = obstacle.x * 20, y = obstacle.y * 20, w = obstacle.w * 20, h = obstacle.h * 20;
      this.rect(x + 2, y + 3, w, h, '#b5ab8f'); this.rect(x, y, w, h, '#b6bc94'); this.rect(x, y, w, 3, '#7a9a7a'); this.planter(x + w / 2, y + 3);
    }
    if (hub) {
      this.rect(60, 151, 118, 72, '#c2b598'); this.rect(54, 143, 118, 72, '#edd3a3');
      this.rect(54, 143, 118, 8, '#b78863'); this.rect(54, 211, 118, 6, '#ad8666');
      this.gear(78, 165, 8, '#b79558', t * 0.2); this.gear(94, 167, 5, '#cfac68', -t * 0.3);
      this.rect(114, 157, 30, 3, '#788d77'); this.rect(128, 151, 4, 14, '#788d77'); this.circle(141, 178, 6, '#9db4a1');
      this.rect(66, 197, 94, 3, '#c9ad7d'); this.text('작은 수리점', 111, 233, '#6c725a', 9);
      this.drawDoll(107, 128, { type: 'moru', angle: 0, color: '#819a88' }); this.text('모루', 107, 100, '#637863', 8);
      if (!this.animator || !this.drawSprite(200, 220, this.animator.static(-2.4))) this.drawDoll(200, 220, { type: 'player', angle: -2.4 });
      for (let i = 0; i < 5; i++) this.circle(155 + i * 19, 248 - Math.sin(i * 0.8) * 15, 1, '#efe6c9');
    }
    if (g.s.mode === 'intro' || g.s.mode === 'introDeath') {
      for (let i = 0; i < 7; i++) { const x = 35 + i * 59, y = 265 + i % 2 * 10; this.rect(x, y, 23, 12, '#a2a995'); this.gear(x + 10, y, 7, '#9e9879'); }
    }
  }
  drawDoll(x, y, opts) {
    const c = this.ctx, { game: g } = this;
    const isPlayer = opts.type === 'player', boss = opts.boss, roco = opts.type === 'collectorRoco', brass = opts.type === 'captainBrass';
    c.save(); c.translate(Math.round(x), Math.round(y));
    const size = boss ? 1.5 : 1; c.scale(size, size);
    c.fillStyle = '#57684e30'; c.beginPath(); c.ellipse(0, 4, 10, 4, 0, 0, TAU); c.fill();
    if (roco) {
      this.rect(-14, -22, 28, 22, '#58797a'); this.rect(-12, -20, 24, 16, '#8da79a'); this.rect(-10, -17, 20, 3, '#3e6266');
      this.rect(-12, -6, 24, 4, '#d1b17d'); this.rect(-15, 0, 7, 6, '#426065'); this.rect(8, 0, 7, 6, '#426065');
      this.rect(-7, -14, 3, 3, '#e0a7a5'); this.rect(4, -14, 3, 3, '#e0a7a5');
      this.rect(13, -21, 9, 4, '#c2ad83'); this.rect(20, -22, 4, 17, '#c2ad83'); this.rect(17, -8, 3, 7, '#9c8d6b'); this.rect(25, -8, 3, 7, '#9c8d6b');
      this.gear(0, -29, 5, '#b8aa8a', this.visualTime * 0.2);
    } else {
      const body = opts.color || (brass ? '#c8a65d' : '#729a8c');
      const bob = opts.moving ? Math.sin(this.visualTime * 13) : 0;
      this.rect(-7, -2 + bob, 5, 6, '#3e635d'); this.rect(3, -2 - bob, 5, 6, '#3e635d');
      this.rect(-9, -17, 18, 16, '#476e67'); this.rect(-7, -16, 14, 14, body);
      this.rect(-5, -14, 10, 4, isPlayer ? '#c3c9a5' : '#e6c599');
      this.circle(-3, -8, 1.5, '#d9b869'); this.circle(4, -8, 1.5, '#d78479');
      this.rect(-10, -30 + bob, 20, 15, '#425e59'); this.rect(-8, -28 + bob, 16, 12, '#e7c99b');
      this.rect(-8, -29 + bob, 16, 4, body); this.rect(-9, -28 + bob, 4, 7, body);
      this.rect(-4, -23 + bob, 2, 3, '#3f5c55'); this.rect(4, -23 + bob, 2, 3, '#3f5c55');
      this.rect(-2, -18 + bob, 5, 1, '#b68a6f'); this.rect(-8, -24 + bob, 2, 4, '#b38976');
      if (isPlayer) {
        this.rect(-9, -16, 18, 4, '#dc8b78'); this.rect(-11, -13, 5, 9, '#d78170'); this.rect(-14, -8, 7, 3, '#d78170');
        this.rect(-4, -35, 8, 3, '#baa36e'); this.rect(-1, -37, 2, 4, '#baa36e');
      }
      if (opts.type === 'rabbit') { this.rect(-8, -41, 5, 15, '#97b49b'); this.rect(3, -39, 5, 13, '#97b49b'); this.rect(-7, -38, 2, 8, '#e2b7b4'); this.rect(4, -36, 2, 7, '#e2b7b4'); }
      if (opts.type === 'elite') { this.rect(-12, -32, 24, 5, '#7c6988'); this.rect(-2, -36, 4, 5, '#e3b58a'); }
      if (brass) { this.rect(-10, -38, 20, 11, '#526e68'); this.rect(-12, -29, 24, 3, '#dab766'); this.rect(-2, -42, 4, 7, '#d58b78'); this.rect(-5, -36, 10, 2, '#dab766'); }
      // Arm and wrench share a single shoulder transform throughout the combo.
      const attack = isPlayer ? opts.attack : null;
      let angle = opts.angle || 0;
      if (attack) { const info = g.c.player.combo[attack.phase], progress = Math.min(1, Math.max(0, (attack.elapsed - info.windup) / info.active)); angle = attack.angle + (attack.phase === 1 ? 1 : -1) * (0.9 - progress * 1.8); }
      c.save(); c.translate(7, -12); c.rotate(angle);
      this.rect(-2, -2, 12, 5, body); this.rect(7, -2, 5, 5, '#e4c598');
      if (isPlayer || opts.type === 'moru') { this.rect(11, -1, 16, 3, '#688881'); this.rect(23, -6, 5, 12, '#6a8b83'); this.rect(27, -6, 4, 4, '#6a8b83'); this.rect(27, 2, 4, 4, '#6a8b83'); this.rect(15, -1, 5, 3, '#d9b674'); }
      else if (opts.type === 'trumpet' || brass) { this.rect(9, -2, 13, 4, '#d7af5b'); this.rect(20, -5, 5, 10, '#d7af5b'); }
      else { this.rect(11, -12, 3, 22, '#a58b6a'); this.rect(7, -15, 11, 7, '#c5c7b2'); }
      c.restore();
    }
    if (opts.flashUntil > g.s.time) { c.globalAlpha = 0.65; this.rect(-10, -28, 20, 26, '#fff6d6'); }
    c.restore();
  }
  /** Ordinary enemies warn with their own body: a blink as the wind-up starts, then a mark above the head. */
  tellBlink(enemy) {
    if (!enemy.tell || enemy.boss || this.game.s.profile.settings.reducedMotion) return false;
    const beat = Math.floor((this.game.s.time - enemy.tell.started) / TELL_BLINK_SECONDS);
    return beat < TELL_BLINKS * 2 && beat % 2 === 0;
  }
  drawAlert(enemy, top) {
    const x = enemy.x * 20;
    this.rect(x - 4, top - 15, 8, 14, '#2b3345'); this.rect(x - 1.5, top - 13, 3, 6, '#ffd257'); this.rect(x - 1.5, top - 6, 3, 2, '#ffd257');
  }
  /** A long band along a line, filled and outlined in the current colours. */
  lanePath([[ax, ay], [bx, by]], halfWidth, fill) {
    const c = this.ctx, width = halfWidth * 20, length = Math.hypot(bx - ax, by - ay) * 20;
    c.save(); c.translate(ax * 20, ay * 20); c.rotate(Math.atan2(by - ay, bx - ax));
    // A lane about to be marched: a red carpet strip with gold chevrons running along it (scrolling tile).
    if (fill && !this.drawLaneTiles(length, width)) c.fillRect(0, -width, length, width * 2);
    c.strokeRect(0, -width, length, width * 2); c.restore();
  }
  /** Lays the march-lane tile along the x axis from 0 to `length`, `width` either side; false while its sheet loads. */
  drawLaneTiles(length, width) {
    const fx = FX.marchLane, image = this.mapImages?.get(fx.sheet);
    if (!image) return false;
    const c = this.ctx, sy = width * 2 / fx.h, scroll = Math.floor(this.visualTime * 24) % fx.w;
    c.save(); c.globalAlpha *= 0.75; c.beginPath(); c.rect(0, -width, length, width * 2); c.clip();
    // The chevrons march along the lane: the tile row slides forward and wraps.
    for (let x = scroll - fx.w; x < length; x += fx.w) c.drawImage(image, 0, 0, fx.w, fx.h, x, -width, fx.w, fx.h * sy);
    c.restore(); return true;
  }
  /** Everywhere that will be hit, in a wash that deepens as the blow comes. */
  floorWash(progress) {
    const c = this.ctx, walkable = this.game.map?.walkable, { left, top, right, bottom } = this.game.config.arena.bounds;
    const points = walkable || [[left, top], [right, top], [right, bottom], [left, bottom]];
    c.save(); c.setLineDash([]); c.fillStyle = `rgba(190, 81, 95, ${0.1 + progress * 0.2})`; c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x * 20, y * 20) : c.moveTo(x * 20, y * 20))); c.closePath(); c.fill(); c.restore();
  }
  columnPreview() {
    const g = this.game, ai = g.config.bossAI.captainBrass, { start } = g.map?.column || {}, { left, top, bottom } = g.config.arena.bounds;
    const [a, b] = start || [[left, top], [left, bottom]];
    this.line(a[0] * 20, a[1] * 20, b[0] * 20, b[1] * 20, '#b85863', 2); this.text(`대열 행진`, (a[0] + b[0]) * 10, (a[1] + b[1]) * 10 - 8, '#b85863', 10);
    return ai;
  }
  /** The soldiers of the marching line, walking in step, with their gap. */
  /** Parades: files of toy soldiers walking down their carpets, one place left empty. */
  drawParades() {
    const g = this.game;
    for (const parade of g.s.parades || []) for (const body of g.paradeBodies(parade)) {
      const direction = nearestDirection(body.heading), clip = this.mobSprites?.clip('guard-move', direction), frame = clip ? Math.floor(this.visualTime * 10) % clip.frameCount : 0;
      if (!(clip && this.drawSprite(body.x * 20, body.y * 20, { action: 'guard-move', direction, frame }, this.mobSprites))) this.rect(body.x * 20 - 7, body.y * 20 - 26, 14, 26, '#dc8b83');
    }
  }
  drawColumn() {
    const g = this.game, line = g.columnLine;
    if (!line) return;
    const { a, b, gapA, gapB } = line, { start, end } = g.s.column, heading = Math.atan2(end[0][1] - start[0][1], end[0][0] - start[0][0]), direction = nearestDirection(heading);
    const clip = this.mobSprites?.clip('guard-move', direction), frame = clip ? Math.floor(this.visualTime * 10) % clip.frameCount : 0;
    for (const [from, to] of [[a, gapA], [gapB, b]]) {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(1, Math.round(length / COLUMN_SPACING_UNITS));
      for (let i = 0; i <= count; i++) {
        const x = (from[0] + (to[0] - from[0]) * i / count) * 20, y = (from[1] + (to[1] - from[1]) * i / count) * 20;
        if (!(clip && this.drawSprite(x, y, { action: 'guard-move', direction, frame }, this.mobSprites))) this.rect(x - 7, y - 26, 14, 26, '#dc8b83');
      }
    }
  }
  /** What a running boss pattern needs on screen: who is listening, and who must hold still. */
  drawBossState() {
    const g = this.game, { s, p } = g, c = this.ctx;
    for (const enemy of s.enemies.filter(e => e.boss && e.hp > 0)) {
      // Brass's live carpets carry a dashed gold edge, so the player always sees where marches and parades can run.
      if (g.config.bossAI[enemy.type]?.liveLanes) {
        c.save(); c.setLineDash([6, 6]); c.lineDashOffset = -this.visualTime * 18; c.strokeStyle = 'rgba(255, 210, 87, 0.75)'; c.lineWidth = 2;
        for (const lane of g.marchLanes(enemy)) this.lanePath(lane, g.config.bossAI[enemy.type].marchWidth, false);
        c.restore();
      }
      if (s.drill) {
        const d = s.drill, still = d.steps[d.index] === 'still', left = Math.max(0, d.until - s.time);
        if (!this.drawMark('gearRing', p.x * 20, p.y * 20, 40, { flat: 0.42, angle: still ? 0 : this.visualTime * 3, tint: still ? '#c43c36' : '#3fbf7f' })) { c.save(); c.setLineDash([]); c.strokeStyle = still ? '#c43c36' : '#3fbf7f'; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x * 20, p.y * 20, 18, 8, 0, 0, TAU); c.stroke(); c.restore(); }
        this.text(still ? '멈춰!' : '앞으로!', enemy.x * 20, enemy.y * 20 - 70, still ? '#c43c36' : '#2f8a62', 13);
        this.rect(enemy.x * 20 - 20, enemy.y * 20 - 64, 40, 3, '#2b3345'); this.rect(enemy.x * 20 - 20, enemy.y * 20 - 64, 40 * left / d.rules.seconds, 3, still ? '#c43c36' : '#3fbf7f');
      }
      if (enemy.alarmUntil > s.time) {
        const col = Math.floor(s.time * 8) % 2 ? '#c43c36' : '#ffd257';
        if (!this.drawMark('gearRing', enemy.x * 20, enemy.y * 20, 84, { flat: 0.5, angle: this.visualTime * 2, tint: col })) { c.save(); c.setLineDash([]); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(enemy.x * 20, enemy.y * 20, 40, 0, TAU); c.stroke(); c.restore(); }
        this.drawAlert(enemy, enemy.y * 20 - 78);
      }
      if (enemy.bellUntil > s.time && !this.drawMark('gearRing', p.x * 20, p.y * 20, 36, { flat: 0.42, angle: -this.visualTime * 2, tint: '#ffd257' })) { c.save(); c.strokeStyle = '#ffd257'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x * 20, p.y * 20, 16, 7, 0, 0, TAU); c.stroke(); c.restore(); }
    }
  }
  drawTell(enemy) {
    const tell = enemy.tell;
    if (!tell) return;
    const c = this.ctx, g = this.game, ai = g.config.bossAI[enemy.type], x = tell.x * 20, y = tell.y * 20;
    const progress = Math.min(1, (g.s.time - tell.started) / (tell.until - tell.started));
    // Only bosses mark the floor with a filled shape, and even theirs stays faint; the outline carries it.
    c.save(); c.strokeStyle = '#b85863'; c.fillStyle = `rgba(190, 81, 95, ${enemy.boss ? 0.05 + progress * 0.08 : 0})`; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    // The danger is painted on the floor: red hatching (a tiled picture) inside a dashed edge with an ink shadow under it.
    const hatch = this.mark('dangerPaint'), pattern = hatch && (this.hatchPattern?.image === hatch ? this.hatchPattern.pattern : (this.hatchPattern = { image: hatch, pattern: c.createPattern(hatch, 'repeat') }).pattern);
    const paint = () => { c.fill(); if (pattern) { c.save(); c.globalAlpha = 0.16 + progress * 0.24; c.fillStyle = pattern; c.fill(); c.restore(); } };
    const edge = () => { c.save(); c.setLineDash([]); c.globalAlpha = 0.4; c.strokeStyle = '#2b3345'; c.lineWidth += 2; c.stroke(); c.restore(); c.stroke(); };
    const sector = (radius, degrees) => { c.beginPath(); c.moveTo(x, y); c.arc(x, y, radius * 20, tell.angle - degrees * Math.PI / 360, tell.angle + degrees * Math.PI / 360); c.closePath(); paint(); edge(); };
    const box = (length, width) => { c.translate(x, y); c.rotate(tell.angle); c.beginPath(); c.rect(0, -width, length, width * 2); paint(); edge(); };
    const ring = (cx, cy, radius) => { c.beginPath(); c.arc(cx, cy, radius * 20, 0, TAU); paint(); edge(); c.setLineDash([]); c.beginPath(); c.arc(cx, cy, radius * 20, -Math.PI / 2, -Math.PI / 2 + TAU * progress); c.lineWidth = 3; c.stroke(); };
    // A count beside a glyph: '×3' stomps, '×5' stickers.
    const counted = (name, fallback, count, gx, gy) => { if (this.mark(name)) { this.overlay(() => this.drawMark(name, gx - 7, gy - 4, 24)); this.text(`×${count}`, gx + 6, gy + 2, '#b85863', 10, 'left'); } else this.text(fallback, gx, gy, '#b85863', 11); };
    switch (tell.type) {
      case 'fan': case 'fanSecond': sector(ai.fanRange, ai.fanDegrees); break;
      case 'dash': this.line(x, y, x + Math.cos(tell.angle) * enemy.dashDistance * 20, y + Math.sin(tell.angle) * enemy.dashDistance * 20, '#b85863', 1); break;
      case 'claw': {
        const range = ai.clawLength, width = ai.clawWidth * 20;
        box(range * 20, width); this.glyph('chevrons', range * 10, 3, '› › ›'); break;
      }
      case 'shot': this.line(x, y, tell.targetX * 20, tell.targetY * 20, '#b85863', 1); this.circle(x, y - 14, 1 + progress * 3, '#ffd257'); break;
      case 'magnet': ring(tell.targetX * 20, tell.targetY * 20, ai.magnetRadius); this.glyph('magnet', tell.targetX * 20, tell.targetY * 20 + 3, '↓ 吸 ↓', '#b85863', 10); break;
      case 'suction': sector(ai.suctionRange, ai.suctionDegrees); this.glyph('suction', x + Math.cos(tell.angle) * ai.suctionRange * 10, y + Math.sin(tell.angle) * ai.suctionRange * 10 + 3, '‹ ‹ 吸'); break;
      case 'stickers': counted('sticker', '불량 ×' + ai.stickerCount, ai.stickerCount, x, y - 46); break;
      case 'stomp': ring(x, y, 1.2); counted('stomp', '쿵 ×' + ai.stompRings, ai.stompRings, x, y - 46); break;
      case 'charge': box(ai.chargeLength * 20, ai.chargeWidth * 20); this.glyph('chevrons', ai.chargeLength * 10, 3, '» » »'); break;
      case 'chargeHorn': sector(ai.hornRange, ai.hornDegrees); break;
      case 'overcharge': ring(x, y, ai.overchargeRadius); this.glyph('alert', x, y - 12, '!', '#b85863', 15); break;
      case 'burst': ring(x, y, enemy.burstRadius); break;
      case 'spiral': ring(x, y, 0.9); for (let i = 0; i < enemy.bullets; i++) { const a = (enemy.spiralTurn || 0) + Math.PI / enemy.bullets + i * TAU / enemy.bullets; this.line(x + Math.cos(a) * 18, y + Math.sin(a) * 18, x + Math.cos(a) * 28, y + Math.sin(a) * 28, '#b85863', 1.5); } break;
      case 'ambush': ring(tell.targetX * 20, tell.targetY * 20, enemy.popRadius); this.glyph('alert', tell.targetX * 20, tell.targetY * 20 + 4, '!', '#b85863', 14); break;
      case 'spin': this.line(x, y, x + Math.cos(tell.angle) * 80, y + Math.sin(tell.angle) * 80, '#b85863', 1.5); this.text('↻', x, y - 18, '#b85863', 12); break;
      case 'beat': c.strokeStyle = '#d9a43a'; ring(x, y, enemy.beatRadius); break;
      case 'thrust': case 'thrust2': {
        const length = (tell.type === 'thrust' ? enemy.attackRange : enemy.followupLength) * 20, width = enemy.thrustWidth * 20;
        c.fillStyle = 'rgba(0, 0, 0, 0)'; box(length, width); break;
      }
      case 'doubleWave': case 'eliteWave': ring(x, y, enemy.attackRange + (tell.type === 'eliteWave' ? enemy.followupRadiusBonus : 0)); break;
      case 'march': {
        for (const lane of g.marchLanes(enemy)) this.lanePath(lane, ai.marchWidth, true);
        break;
      }
      case 'alarm': ring(x, y, 1.6); this.glyph('alert', x, y - 44, '!', '#b85863', 15); break;
      case 'bell': ring(x, y, 1.6); this.glyph('bell', x, y - 44, '종', '#b85863', 12); break;
      case 'column': this.columnPreview(); break;
      case 'crane':
        // Rings first: the crates change the fill colour the rings share.
        for (const { x: dx, y: dy } of tell.drops) ring(dx * 20, dy * 20, ai.craneRadius);
        for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170; if (!this.drawFxFrame('crate', 0, dx * 20, top + 16)) { this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); this.rect(dx * 20 - 8, top, 16, 3, '#c79a5e'); } }
        break;
      case 'crateToss':
        for (const { x: dx, y: dy } of tell.drops) ring(dx * 20, dy * 20, ai.crateTossRadius);
        for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170, art = this.mapImages?.get(HAZARD_ART.crate); if (art) { c.save(); c.imageSmoothingEnabled = false; c.drawImage(art, dx * 20 - 12, top - 10, 24, 26); c.restore(); } else this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); }
        break;
      case 'parade':
        c.setLineDash([]); c.strokeStyle = '#c43c36'; c.fillStyle = 'rgba(196, 60, 54, 0.22)'; c.lineWidth = 3;
        for (const lane of tell.lanes) this.lanePath(lane, ai.paradeRadius + 0.3, true);
        this.text('퍼레이드!', x, y - 70, '#b85863', 12); break;
      case 'drill': ring(x, y, 1.6); this.text('구령 준비!', x, y - 70, '#b85863', 12); break;
      case 'carpet': {
        const lanes = g.marchLanes(enemy, true);
        this.floorWash(progress);
        c.setLineDash([]); c.strokeStyle = '#3fbf7f'; c.fillStyle = 'rgba(63, 191, 127, 0.3)'; c.lineWidth = 3; this.lanePath(lanes[tell.safe], ai.carpetSafeWidth, true);
        break;
      }
      case 'trumpetWave':
        ring(x, y, 3.6); c.setLineDash([]); c.strokeStyle = '#7c9f7c'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 72, tell.angle - ai.waveGapDegrees * Math.PI / 360, tell.angle + ai.waveGapDegrees * Math.PI / 360); c.stroke(); this.glyph('gap', x + Math.cos(tell.angle) * 82, y + Math.sin(tell.angle) * 82, '틈', '#67805b', 8); break;
    }
    c.restore();
  }
  /** Backing pixels per layout pixel: 1 for the plain 1120x640 canvas, more when main.js sizes it to the screen. */
  get backing() { return (this.canvas.width || 1120) / 1120; }
  render(delta = 0.016) {
    const g = this.game, s = g.s, c = this.ctx;
    if (!s.paused && !s.profile.settings.reducedMotion) this.visualTime += delta;
    const playerPose = this.animator?.update(delta, g, { reducedMotion: s.profile.settings.reducedMotion });
    const mobPoses = this.mobAnimator?.update(delta, g), castFx = this.castEffects?.update(g) || [], spriteFx = !!this.castEffects;
    const hub = ['hub', 'registration', 'returned', 'opening'].includes(s.mode);
    const map = hub ? g.hubMap : g.map, mapImage = map && this.mapImages?.get(map.background), size = map?.size || SCREEN_UNITS;
    // Panels over the hub show the spot the player will stand on; everywhere else follows the body.
    const focus = hub && !g.village ? map?.spawn : g.p;
    this.camera = mapImage ? cameraFor(focus, size) : { x: 0, y: 0 };
    const [shakeX, shakeY] = this.shakeOffset();
    // The canvas is backed at screen resolution; k maps the 1120x640 layout onto it, so nothing is stretched twice.
    const pulseLeft = Math.max(0, (this.pulseUntil || 0) - performance.now()) / CRIT_PULSE_MS, lean = 1 + CRIT_ZOOM * pulseLeft;
    const k = this.backing, zoom = 2 * CAMERA_ZOOM * k * lean;
    if (this.letters) { const t = this.letters.getContext('2d'); t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, this.letters.width, this.letters.height); }
    // A crit leans in toward the middle of the screen.
    const centreX = pulseLeft ? this.canvas.width / 2 * (1 - lean) : 0, centreY = pulseLeft ? this.canvas.height / 2 * (1 - lean) : 0;
    c.setTransform(zoom, 0, 0, zoom, Math.round((-this.camera.x * PIXELS_PER_UNIT + shakeX) * k * lean + centreX), Math.round((-this.camera.y * PIXELS_PER_UNIT + shakeY) * k * lean + centreY));
    // Painted backgrounds are resampled smoothly; sprites below stay on hard pixels.
    if (mapImage) {
      // Only the part of the painting the camera sees (plus a unit for shake) is resampled, not the whole map.
      const ux = mapImage.width / size[0], uy = mapImage.height / size[1];
      const x0 = Math.max(0, Math.floor(this.camera.x - 1)), y0 = Math.max(0, Math.floor(this.camera.y - 1));
      const x1 = Math.min(size[0], Math.ceil(this.camera.x + SCREEN_UNITS[0] + 1)), y1 = Math.min(size[1], Math.ceil(this.camera.y + SCREEN_UNITS[1] + 1));
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      if (x1 > x0 && y1 > y0) c.drawImage(mapImage, x0 * ux, y0 * uy, (x1 - x0) * ux, (y1 - y0) * uy, x0 * 20, y0 * 20, (x1 - x0) * 20, (y1 - y0) * 20);
    } else this.scenery(hub);
    c.imageSmoothingEnabled = false;
    if (s.mode === 'shop' && !mapImage) { this.building(217, 113, 110, 69, '#d9c49a', '볼트의 부품 상점', '#88aaa0'); this.drawDoll(273, 212, { type: 'moru', color: '#c7a968' }); }
    const yardExit = s.mode === 'practice' ? map?.exit.at : null;
    const goal = s.mode === 'route' ? g.portal : yardExit ? { x: yardExit[0], y: yardExit[1] } : ['intro', 'registration'].includes(s.mode) ? g.tutorial.goal : null;
    // The portal the player came through stays marked until they have met the town.
    const portal = s.mode === 'registration' && g.village ? g.hubMap.arrival.portal : null;
    // Once registered, the way out of town to the street is the same yellow portal, not a sign.
    // Every walk-around place shows its way out as the same yellow ring: the village's street and the rest stop's road.
    const streetPortal = ['hub', 'shop'].includes(s.mode) && g.village ? g.village.exit.portal : null;
    for (const spot of [portal, goal, streetPortal]) if (spot) this.marker(spot);
    this.minimapPlace = { map, mapImage, size, goal: goal || portal || streetPortal || (hub && g.village ? { x: map.exit.at[0], y: map.exit.at[1] } : null) };
    this.overlays = [];
    for (const enemy of s.enemies.filter(e => e.hp > 0)) this.drawTell(enemy);
    // Marks painted on the floor (where a skill lands, a blast's reach, a hatch) lie under every body, like the tells.
    for (const fx of s.effects) if (fx.type === 'friendlyTell' || fx.type === 'danger') { const fraction = Math.min(1, (s.time - fx.created) / fx.duration); if (fx.type === 'danger') this.drawDanger(fx, fx.x * 20, fx.y * 20, fraction); else this.drawLandingMark(fx, fx.x * 20, fx.y * 20, fraction); }
    // Bodies hastened and hardened by the drum: a gold ring at the feet and red arrows rising while it lasts.
    for (const enemy of s.enemies) if (enemy.hp > 0 && enemy.beatUntil > s.time) this.drawFxFrame('drumBuff', this.visualTime * 12 + enemy.x, enemy.x * 20, enemy.y * 20, { alpha: 0.9 });
    for (const enemy of s.enemies.filter(e => e.hp > 0 && e.breaking)) this.drawPhaseBreak(enemy);
    for (const cast of s.casts) {
      // Shards broken off a frost bolt: small spinning ice chips.
      if (cast.shape === 'projectile') for (const bit of cast.projectiles) if (bit.shard && !bit.done) { if (this.drawFxFrame('frostBolt', this.visualTime * 12, bit.x * 20, bit.y * 20 - 8, { angle: bit.angle, sx: 0.55, sy: 0.55 })) continue; const x = bit.x * 20, y = bit.y * 20 - 8, r = 3; c.save(); c.translate(x, y); c.rotate(this.visualTime * 12); c.fillStyle = '#d7f3fb'; c.strokeStyle = '#3f8fb0'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); }
      if (cast.shape === 'patch') {
        // A fire patch from the ember trail: a low flickering flame on the floor, fading as its pulses run out.
        const x = cast.x * 20, y = cast.y * 20, life = 1 - cast.pulse / cast.hits, flick = Math.sin(this.visualTime * 18 + cast.x * 7) * 1.5;
        if (this.drawFxFrame('groundFire', this.visualTime * 12 + cast.x * 3, x, y, { sx: cast.radius * 20 / 16, sy: cast.radius * 20 / 16, alpha: 0.45 + 0.55 * life })) continue;
        c.save(); c.globalAlpha = 0.35 + 0.5 * life; c.fillStyle = '#e8742f'; c.beginPath(); c.ellipse(x, y, cast.radius * 16, cast.radius * 7, 0, 0, TAU); c.fill();
        c.fillStyle = '#ffd257'; c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x - 3, y - 9 - flick, x, y - 14 - flick); c.quadraticCurveTo(x + 3, y - 9 + flick, x + 5, y); c.fill(); c.restore();
      }
      if (cast.shape === 'charge') {
        // A charge left on an enemy: a ring that closes in as the burst comes.
        const left = Math.max(0, cast.next - cast.age), share = left / (cast.delayed?.delay || 3) || left / 3, x = cast.x * 20, y = cast.y * 20 - 10;
        // A brass dial over the body whose gold hand sweeps round to the burst; a closing ring while the dial is missing.
        if (this.drawMark('dial', x, y - 28, 18)) { const a = -Math.PI / 2 + TAU * (1 - Math.min(1, share)); c.save(); c.lineCap = 'round'; for (const [w, col] of [[3, '#2b3345'], [1.5, '#ffe086']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y - 28); c.lineTo(x + Math.cos(a) * 6, y - 28 + Math.sin(a) * 6); c.stroke(); } c.restore(); }
        else { c.save(); c.strokeStyle = '#ffe086'; c.lineWidth = 2; c.globalAlpha = 0.9; c.beginPath(); c.arc(x, y, 6 + 10 * Math.min(1, share), 0, TAU); c.stroke(); c.restore(); }
        if (!this.drawFxFrame('chargeArcs', this.visualTime * 12, x, y - 8)) { c.fillStyle = '#ffe086'; c.fillRect(Math.round(x - 1), Math.round(y - 14), 2, 6); }
      }
      if(cast.shape==='clamp'){
        const corners=clampCorners(cast,cast.angle,cast),closing=Math.max(0,Math.min(1,(cast.age-cast.delay+cast.closeMs/1000)/(cast.closeMs/1000))),gap=cast.jawOpenDistance+(cast.jawClosedDistance-cast.jawOpenDistance)*closing;
        // Only the plain fallback outlines the jaws' box; with the picture the jaws themselves show where they close.
        if(!spriteFx)for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];this.line(a.x*20,a.y*20,b.x*20,b.y*20,'#94bdc8',1);}
        if(!spriteFx)for(const side of [-1,1]){const points=[-1,1].map(u=>({x:cast.x+Math.cos(cast.angle)*u*cast.halfLength-Math.sin(cast.angle)*side*gap,y:cast.y+Math.sin(cast.angle)*u*cast.halfLength+Math.cos(cast.angle)*side*gap}));this.line(points[0].x*20,points[0].y*20,points[1].x*20,points[1].y*20,'#7fc9df',5);}
      }
      if(cast.shape === 'orb' && !spriteFx){ const x=cast.x*20,y=cast.y*20-16; this.circle(x,y,9,'#a4c7b1');this.circle(x,y,5,'#dfca6a');this.line(x-5,y,x+4,y+3,'#fff1a2',2); }
      if (cast.shape === 'suction') {
        // The air rushing in: arcs that close toward Roco's mouth.
        const half = cast.degrees * Math.PI / 360;
        if (this.mapImages?.get(FX.pressureDash.sheet)) {
          // The pressure dash's wind turned round: five streams across the cone, each pulled in toward the mouth and thinning.
          for (let i = 0; i < 5; i++) {
            const k = (cast.age * 1.4 + i * 0.37) % 1, r = (1 - k) * cast.range * 20, a = cast.angle + (i / 4 - 0.5) * half * 1.4;
            if (r < 12) continue;
            this.drawFxFrame('pressureDash', this.visualTime * 12 + i * 3, cast.x * 20 + Math.cos(a) * r, cast.y * 20 + Math.sin(a) * r - 12, { angle: a + Math.PI, sx: 0.9, sy: 0.9, alpha: Math.min(1, k * 4) });
          }
        } else {
          c.save(); c.strokeStyle = '#8c9fb0'; c.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) { const r = (1 - ((cast.age * 1.6 + i / 3) % 1)) * cast.range * 20; c.beginPath(); c.arc(cast.x * 20, cast.y * 20, Math.max(4, r), cast.angle - half, cast.angle + half); c.stroke(); }
          c.restore();
        }
      }
      if (cast.shape === 'stompRing' && cast.age >= 0) {
        // A shock ring spreading over the floor, thinning as it goes.
        const r = cast.age * cast.speed * 20, alpha = Math.max(0.2, 1 - r / (cast.reach * 20)), k = Math.max(0.05, r / 50);
        if (!this.drawFxFrame('stompRing', this.visualTime * 12, cast.x * 20, cast.y * 20, { sx: k, sy: k * 0.62 / 0.4, alpha })) { c.save(); c.globalAlpha = alpha; c.strokeStyle = '#c46a2b'; c.lineWidth = 4; c.beginPath(); c.ellipse(cast.x * 20, cast.y * 20, r, r * 0.62, 0, 0, TAU); c.stroke(); c.restore(); }
      }
      if (cast.shape === 'stickerFall') {
        // Where the next sticker lands: a ring closing in until it hits.
        const x = cast.x * 20, y = cast.y * 20, left = 1 - Math.min(1, cast.age / cast.warn);
        // The striped warning ring where it lands (a dashed circle while the picture is missing), and a ring closing in.
        const marked = this.drawMark('danger', x, y, cast.radius * 40, { flat: 0.55, alpha: 0.55 + 0.35 * (1 - left) });
        c.save(); c.strokeStyle = '#b85863'; c.lineWidth = 1.5; if (!marked) { c.setLineDash([4, 3]); c.beginPath(); c.arc(x, y, cast.radius * 20, 0, TAU); c.stroke(); }
        c.setLineDash([]); c.lineWidth = 2; c.beginPath(); if (marked) c.ellipse(x, y, cast.radius * 20 * (0.25 + left * 0.75), cast.radius * 11 * (0.25 + left * 0.75), 0, 0, TAU); else c.arc(x, y, cast.radius * 20 * (0.25 + left * 0.75), 0, TAU); c.stroke(); c.restore();
      }
      if (cast.shape === 'sticker') {
        // A paper 'defective' label stuck to the floor, fading as it peels.
        const x = cast.x * 20, y = cast.y * 20, fade = Math.min(1, (cast.duration - cast.age) / 0.6);
        c.save(); c.globalAlpha = 0.22 * fade; this.circle(x, y, cast.radius * 20, '#b85863'); c.restore();
        // The label drops and slaps onto the floor (PixelLab sheet), then stays as its last frame until it peels.
        if (!this.drawFxFrame('rocoSticker', Math.min(FX.rocoSticker.frames - 1, cast.age * 14), x, y, { alpha: fade })) {
          c.save(); c.globalAlpha = fade; c.translate(x, y); c.rotate(cast.tilt); this.rect(-11, -7, 22, 14, '#f3e6c8'); c.strokeStyle = '#a92f2b'; c.lineWidth = 1.5; c.strokeRect(-11, -7, 22, 14); this.text('불량', 0, 3, '#a92f2b', 8); c.restore();
        }
      }
      if (cast.shape === 'magnet') {
        // Roco's magnet: a purple field turning on the floor, pulling sparks in (PixelLab loop, sized to the pull).
        const k = cast.radius * 20 / 42;
        if (!this.drawFxFrame('magnetField', this.visualTime * 12, cast.x * 20, cast.y * 20, { sx: k, sy: k, alpha: 0.9 })) {
          c.save(); c.globalAlpha = 0.18; this.circle(cast.x * 20, cast.y * 20, cast.radius * 20, '#8c638f'); c.restore();
          for (let i = 0; i < 3; i++) { c.strokeStyle = '#9d74a1'; c.beginPath(); c.arc(cast.x * 20, cast.y * 20, ((cast.age + i * 0.5) % 1.5) / 1.5 * cast.radius * 20, 0, TAU); c.stroke(); }
        }
      }
      for (const bullet of cast.projectiles || []) if (!bullet.done) {
        // Frost bolts fly as ice lances pointed along their path; their broken-off shards are drawn above.
        if (bullet.shard) continue;
        if (cast.skillId === 'frostBolt' && this.drawFxFrame('frostBolt', this.visualTime * 12, bullet.x * 20, bullet.y * 20 - 8, { angle: bullet.angle })) continue;
        this.circle(bullet.x * 20, bullet.y * 20, 4, cast.color); this.rect(bullet.x * 20 - 2, bullet.y * 20 - 2, 4, 4, '#e7fbec');
      }
    }
    const onScreen = ({ polygon }) => polygon.some(([x, y]) => x > this.camera.x - 4 && x < this.camera.x + SCREEN_UNITS[0] + 4 && y > this.camera.y - 4 && y < this.camera.y + SCREEN_UNITS[1] + 4);
    const occluders = mapImage ? (map.occluders || []).filter(onScreen).map(o => ({ y: o.baseY, occluder: o })) : [];
    const depthMask = this.depthMasks?.get(map?.background);
    this.labels = [];
    let playerHidden = 0;
    const props = mapImage ? (map.props || []).map(prop => ({ y: prop.y, prop })) : [];
        // Effects sort just ahead of a body at the same spot, so a burst never covers the caster's arms and legs; ground effects lie under everyone.
    const effects = castFx.map(fx => ({ y: fx.effect.ground ? -Infinity : fx.y - 0.01, fx }));
    const npcs = mapImage && (map.npcs || map.crowd) && this.npcDirector ? this.npcDirector.update(delta, hub ? 'hub' : g.room?.id, map.npcs || [], { crowd: g.data.maps?.crowds?.[map.crowd], lookAt: focus, floor: map.walkable ? map : null, paused: s.paused, reducedMotion: s.profile.settings.reducedMotion, bell: s.mode === 'registration' ? g.tutorial.bell : null }).map(npc => ({ y: npc.y, npc })) : [];
    const hubPlayer = hub && !g.village && mapImage && this.animator ? [{ y: map.spawn.y, hubPlayer: true }] : [];
    // Room hazards: plates and saw rails lie flat under everyone; crates, fences and music boxes stand in the sort.
    const hazards = g.roomHazards.filter(h => !h.gone).map(h => ({ y: GROUND.has(h.kind) ? -Infinity : h.y, hazard: h }));
    const actors = [...hazards, ...s.enemies.filter(e => e.hp > 0 || mobPoses?.has(e.id)), ...((hub ? g.village && mapImage : s.mode !== 'shop' || mapImage) ? [{ ...g.p, type: 'player', player: true }] : []), ...occluders, ...props, ...effects, ...npcs, ...hubPlayer].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.occluder) { this.drawOccluder(mapImage, actor.occluder.polygon, size); continue; }
      if (actor.hazard) { this.drawHazard(actor.hazard); continue; }
      if (actor.prop) { this.drawProp(actor.prop); this.coverBody(depthMask, actor.prop.x, actor.prop.y, 2, 2.6); continue; }
      if (actor.fx) { this.drawCastEffect(actor.fx); continue; }
      if (actor.dummy) { this.drawDummy(actor, map.dummyImage); continue; }
      if (actor.npc) { this.drawNpc(actor.npc, depthMask); continue; }
      if (actor.hubPlayer) { this.drawSprite(map.spawn.x * 20, map.spawn.y * 20, this.animator.static(-2.4), this.sprites, false, PLAYER_SCALE); this.coverBody(depthMask, map.spawn.x, map.spawn.y); continue; }
      // Only being hit blinks the body; the dodge's own split second of safety shows as the dash, not as a flicker.
      const blink = actor.player && !g.p.dodge && actor.invulnerableUntil > s.time && Math.floor(s.time * 22) % 2 === 0;
      c.globalAlpha = actor.hidden ? 0.25 : blink && !s.profile.settings.reducedMotion ? 0.45 : 1;
      const mobPose = mobPoses?.get(actor.id), mobClip = mobPose && this.mobSprites.clip(mobPose.action, mobPose.direction);
      // A struck body trembles side to side for a moment, even while the hit holds time still.
      const jolt = !actor.player && actor.joltUntil > s.time && !s.profile.settings.reducedMotion ? (Math.floor(performance.now() / 32) % 2 ? JOLT_PX : -JOLT_PX) : 0;
      // Two fading copies trail a dodge, so the dash reads as one smooth burst of speed.
      if (actor.player && g.p.dodge && playerPose && !s.profile.settings.reducedMotion) {
        const back = g.p.dodge.angle + Math.PI, alpha = c.globalAlpha;
        for (const [k, a] of [[0.9, 0.18], [0.45, 0.35]]) { c.globalAlpha = a; this.drawSprite((actor.x + Math.cos(back) * k) * 20, (actor.y + Math.sin(back) * k) * 20, playerPose, this.sprites, false, PLAYER_SCALE); }
        c.globalAlpha = alpha;
      }
      // A dashing enemy (Brass's charge, a rabbit's lunge) trails two fading copies and kicks up dust behind its feet.
      if (!actor.player && actor.dash && mobPose && !s.profile.settings.reducedMotion) {
        const back = actor.dash.angle + Math.PI, alpha = c.globalAlpha, size = actor.boss ? BOSS_SPRITE_SCALE : 1;
        for (const [k, a] of [[1.1, 0.2], [0.55, 0.38]]) { c.globalAlpha = a; this.drawSprite((actor.x + Math.cos(back) * k) * 20, (actor.y + Math.sin(back) * k) * 20, mobPose, this.mobSprites, false, size); }
        c.globalAlpha = alpha;
        for (let i = 0; i < 3; i++) { const k = 0.3 + i * 0.35, wob = Math.sin(this.visualTime * 20 + i * 2) * 3; this.drawMark('dust', (actor.x + Math.cos(back) * k) * 20 + wob, (actor.y + Math.sin(back) * k) * 20 - 3, (actor.boss ? 16 : 11) - i * 3, { alpha: 0.75 - i * 0.2, smooth: true }); }
      }
      if (!actor.player && actor.affixes?.length && actor.hp > 0) this.drawAffixAura(actor);
      if (!actor.player && actor.affixes?.length && actor.hp > 0 && mobPose) this.drawOutline(actor.x * 20 + jolt, actor.y * 20, mobPose, this.mobSprites, actor.boss ? BOSS_SPRITE_SCALE : 1, this.affixColors(actor));
      const drawn = actor.player ? playerPose && this.drawSprite(actor.x * 20, actor.y * 20, playerPose, this.sprites, false, PLAYER_SCALE) : mobPose && this.drawSprite(actor.x * 20 + jolt, actor.y * 20, mobPose, this.mobSprites, actor.flashUntil > s.time || this.tellBlink(actor) || (actor.frozenUntil > s.time && FROZEN_LOOK), actor.boss ? BOSS_SPRITE_SCALE : 1);
      if (!drawn) this.drawDoll(actor.x * 20, actor.y * 20, { ...actor, moving: actor.player ? !!g.p.dodge || !!g.p.attack : actor.state === 'approach' });
      c.globalAlpha = 1;
      if (actor.player) playerHidden = this.coverBody(depthMask, actor.x, actor.y);
      if (!actor.player && actor.hp > 0) {
        const width = actor.boss ? 48 : 23, yy = actor.y * 20 - (mobClip ? mobClip.bodyHeight * (actor.boss ? BOSS_SPRITE_SCALE : 1) * BODY_SCALE / 2 + 6 : actor.boss ? 66 : actor.type === 'rabbit' ? 48 : 38);
        if (!actor.boss) { const left = actor.x * 20 - width / 2; this.rect(left - 1, yy - 1, width + 2, 6, '#2b3345'); this.rect(left, yy, width, 4, '#5e4a52'); this.rect(left, yy, width * Math.max(0, actor.hp / actor.maxHp), 4, '#e0564c'); }
        if (actor.boss) { const threshold = g.c.balance.bossStaggerThreshold[actor.kind]; this.rect(actor.x * 20 - width / 2, yy + 5, width * actor.stagger / threshold, 2, '#cca453'); }
        if (actor.exposedUntil > s.time) this.text('태엽 노출', actor.x * 20, yy - 17, '#af8345', 8);
        this.drawStatuses(actor, actor.boss ? yy + 11 : yy - 13);
        if (actor.affixes?.length) this.drawAffixTags(actor, yy - (this.statusBadges(actor).length ? 27 : 14));
      }
    }
    for (const enemy of s.enemies.filter(e => e.hp > 0 && e.tell && !e.boss)) {
      const pose = mobPoses?.get(enemy.id), clip = pose && this.mobSprites.clip(pose.action, pose.direction);
      this.drawAlert(enemy, enemy.y * 20 - (clip ? clip.bodyHeight * BODY_SCALE / 2 + 21 : 54));
    }
    for (const draw of this.overlays) draw();
    this.drawColumn(); this.drawParades(); this.drawBossState();
    const note = this.mapImages?.get(NOTE_ART);
    for (const bullet of s.projectiles) {
      const bx = bullet.x * 20, by = bullet.y * 20;
      // An enemy's shot is a note with a gold tail; one batted back stays a plain pellet.
      if (note && !bullet.friendly) {
        const back = bullet.angle + Math.PI, bob = Math.sin(this.visualTime * 14 + bullet.x) * 1.5;
        const k = NOTE_SCALE, w = Math.round(16 * k), h = Math.round(19 * k);
        for (let i = 1; i <= 4; i++) { c.globalAlpha = 0.45 - i * 0.09; this.circle(bx + Math.cos(back) * i * 4 * k, by - 6 * k + Math.sin(back) * i * 4 * k, (3 - i * 0.4) * k, '#ffd257'); }
        c.globalAlpha = 1; c.drawImage(note, Math.round(bx - w / 2), Math.round(by - 20 * k + bob), w, h);
        continue;
      }
      if (this.drawMark(bullet.friendly ? 'pelletFriendly' : 'pelletEnemy', bx, by - 4, 10, { angle: this.visualTime * 8 })) continue;
      this.circle(bx, by, 4, bullet.friendly ? '#86c0ac' : '#b96b78'); this.circle(bx, by, 2, '#f7e6b0');
    }
    // Wrench buffs on the player: gold motes while a dash-charged blow is ready, rising arrows while scrap haste lasts.
    if (['combat', 'route'].includes(s.mode)) {
      if (g.p.strikeUntil > s.time) this.drawFxFrame('chargedMotes', this.visualTime * 12, g.p.x * 20, g.p.y * 20 - 16);
      if (g.p.hasteUntil > s.time) this.drawFxFrame('hasteArrows', this.visualTime * 12, g.p.x * 20, g.p.y * 20 + 2, { alpha: 0.85 });
    }
    for (const fx of s.effects) {
      if (fx.type === 'number' && !s.profile.settings.damageNumbers) continue;
      if (spriteFx && ['crosscut', 'iceClamp'].includes(fx.type)) continue;
      // A skill with its own animated picture (every fusion, and the element skills that have one) needs no plain ring on each pulse.
      if (spriteFx && fx.type === 'ring' && fx.skill && this.castEffects.effects?.[fx.skill]) continue;
      if (s.profile.settings.reducedMotion && ['dodge', 'hurt', 'scrap', 'spark', 'impact', 'dust'].includes(fx.type)) continue;
      const fraction = Math.min(1, (s.time - fx.created) / fx.duration), x = fx.x * 20, y = fx.y * 20;
      if (fx.type === 'friendlyTell' || fx.type === 'danger') continue;
      // Sparks of a blow, a hurt and a dodge: painted stills that pop and fade; the old gear shape while they are missing.
      if (['spark', 'hurt', 'dodge'].includes(fx.type) && !fx.look) {
        const name = fx.type === 'spark' ? 'sparkHit' : fx.type === 'hurt' ? 'sparkHurt' : 'dust', pop = Math.min(1, fraction * 4);
        if (this.drawMark(name, x, y - 10, (fx.type === 'dodge' ? 18 : 16) * fx.value * (0.7 + 0.5 * pop), { angle: fx.type === 'dodge' ? 0 : fraction * 1.2, alpha: 1 - fraction * fraction, smooth: true })) continue;
      }
      // Blows and skills with a picture of their own play it; the plain shapes below are the fallback.
      if (fx.look && this.drawLook(fx, x, y, fraction)) continue;
      c.save(); c.globalAlpha = Math.max(0, 1 - fraction); c.strokeStyle = fx.color; c.lineWidth = fx.type === 'ring' ? 3 : 2;
      // Critical hits show in red, a little larger.
      if (fx.type === 'number') this.text(String(Math.round(fx.value)), x, y - fraction * 20 - 15, fx.color, fx.crit ? CRIT_NUMBER_SIZE : NUMBER_SIZE);
      if (fx.type === 'ring' || fx.type === 'friendlyTell') { c.beginPath(); c.arc(x, y, fx.value * 20 * (fx.type === 'ring' ? 0.5 + fraction * 0.5 : 1), 0, TAU); c.stroke(); }
      if (fx.type === 'swing') this.drawSwing(fx, x, y, fraction);
      if (fx.type === 'crosscut') { this.line(x,y,fx.targetX*20,fx.targetY*20,'#d7f0ec',4);this.line(x,y,fx.targetX*20,fx.targetY*20,fx.color,2); }
      if(fx.type==='iceClamp'){let last;for(let i=0;i<=8;i++){const side=(i/4-1)*fx.value,forward=i===0||i===8?0:Math.sin(i*2.7)*.22,p={x:x+(Math.cos(fx.angle)*forward-Math.sin(fx.angle)*side)*20,y:y+(Math.sin(fx.angle)*forward+Math.cos(fx.angle)*side)*20};if(last)this.line(last.x,last.y,p.x,p.y,'#c2a4e0',3);last=p;}}
      if (fx.type === 'beam') this.line(x, y, fx.targetX * 20, fx.targetY * 20, fx.color, 4);
      if (fx.type === 'dodge' || fx.type === 'hurt' || fx.type === 'spark') this.gear(x, y - 10, fx.value * 10 * (1 + fraction), fx.color, fraction);
      // Scrap flies up and out, then falls: bits of the body's colour and grey bolts.
      if (fx.type === 'scrap') for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + i * 0.37, out = fraction * (18 + (i % 3) * 7), lift = fraction * 34 - fraction * fraction * 44; this.rect(x + Math.cos(a) * out, y + Math.sin(a) * out * 0.55 - lift, i % 4 ? 3 : 4, i % 4 ? 3 : 2, i % 3 ? fx.color : '#8a8f9c'); }
      // A blow lands: a flash and short rays along the swing, gone in a few frames.
      // Dust thrown out low along the floor by the third blow.
      if (fx.type === 'dust') for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.4, out = 6 + fraction * 22, r = 5 * (1 - fraction) + 1.5, px = x + Math.cos(a) * out, py = y + Math.sin(a) * out * 0.4; if (this.drawMark('dust', px, py - r, r * 3.2, { alpha: 0.85 * (1 - fraction), smooth: true })) continue; c.globalAlpha = 0.75 * (1 - fraction); this.circle(px, py, r, fx.color); }
      // A kill's pay pops out of the body, then flies into the player: coins in gold, gears in brass.
      if (fx.type === 'loot') for (let i = 0; i < fx.value; i++) {
        const t = Math.max(0, Math.min(1, (fraction - i * 0.08) / 0.7)), pop = Math.min(1, t / 0.3), home = Math.max(0, (t - 0.3) / 0.7), ease = home * home * (3 - 2 * home);
        const sx = x + Math.cos(i * 2.1) * 10 * pop, sy = y - 12 * pop + Math.sin(i * 2.1) * 4, px = g.p.x * 20, py = g.p.y * 20 - 14;
        const lx = sx + (px - sx) * ease, ly = sy + (py - sy) * ease;
        c.globalAlpha = t >= 1 ? 0 : 1;
        const icon = this.mapImages?.get(i < fx.gears ? LOOT_ART.gear : LOOT_ART.coin);
        if (icon && t < 1) { c.imageSmoothingEnabled = true; c.drawImage(icon, Math.round(lx - 5), Math.round(ly - 5), 10, 10); c.imageSmoothingEnabled = false; }
        else if (i < fx.gears) { this.circle(lx, ly, 3.5, '#a07a3c'); this.circle(lx, ly, 1.5, '#5c4630'); } else { this.circle(lx, ly, 3, '#c79a3e'); this.circle(lx, ly, 2, '#ffd257'); }
      }
      if (fx.type === 'impact') { const r = fx.value * 10 * (0.6 + fraction); c.globalAlpha *= 1 - fraction; if (!this.drawMark('sparkHit', x, y, r * 2.2 * (1 - fraction * 0.4), { angle: (fx.angle || 0) + fraction, smooth: true })) this.circle(x, y, r * 0.55 * (1 - fraction * 0.5), fx.color); for (let i = -2; i <= 2; i++) { const a = (fx.angle || 0) + i * 0.45; this.line(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, fx.color, 2); } }
      c.restore();
    }
    if (s.mode === 'unwind') {
      const x = (this.camera.x + 18) * 20, y = (this.camera.y + 8.55) * 20;
      this.gear(x, y, 13, '#d0a854', this.visualTime * 0.4); this.text(this.game.room?.boss === 'captainBrass' ? 'G · 태엽 감아 깨우기' : 'G · 회로 뽑기', x, y + 30, '#5c7462', 10);
    }
    // A player lost behind scenery shows through it, after every body so nothing repaints over them.
    // ... and through a body standing in front of it: an enemy just below F2 on screen and close beside it covers the sprite.
    const inFront = ['combat', 'route', 'reward', 'unwind'].includes(s.mode) && s.enemies.some(e => (e.hp > 0 || mobPoses?.has(e.id)) && !e.hidden && e.y > g.p.y && e.y - g.p.y < (e.boss ? 1.6 : 1.1) && Math.abs(e.x - g.p.x) < (e.boss ? 1.3 : 0.75));
    const ghost = Math.max(ghostFor(playerHidden), inFront ? 0.45 : 0);
    if (ghost && playerPose) { c.globalAlpha = ghost; this.drawSprite(g.p.x * 20, g.p.y * 20, playerPose, this.sprites, false, PLAYER_SCALE); c.globalAlpha = 1; }
    if (this.lighting && mapImage) {
      const glow = { fire: 'rgba(255, 150, 70, 0.35)', lightning: 'rgba(255, 230, 120, 0.35)', ice: 'rgba(140, 210, 255, 0.28)' };
      const lights = [{ x: g.p.x, y: g.p.y - 0.6, radius: 3.6 }, ...s.casts.map(cast => ({ x: cast.x, y: cast.y, radius: 2.4, color: glow[cast.elements?.[0]] }))];
      this.lighting.draw(c, { mood: this.mood, image: mapImage, size, view: { x: this.camera.x, y: this.camera.y, w: SCREEN_UNITS[0], h: SCREEN_UNITS[1] }, lights, time: this.visualTime, still: s.profile.settings.reducedMotion });
    }
    for (const { label, x, y } of this.labels) this.nameplate(label, x, y);
    if (goal && mapImage) this.pointTo(goal);
    // Enemies wait spread over the room; when none is in view, a red arrow points to the nearest.
    if (s.mode === 'combat' && mapImage && !goal) {
      const living = s.enemies.filter(e => e.hp > 0), near = living.reduce((best, e) => (!best || Math.hypot(e.x - g.p.x, e.y - g.p.y) < Math.hypot(best.x - g.p.x, best.y - g.p.y) ? e : best), null);
      const seen = living.some(e => e.x > this.camera.x && e.x < this.camera.x + SCREEN_UNITS[0] && e.y > this.camera.y && e.y < this.camera.y + SCREEN_UNITS[1]);
      if (near && !seen) this.pointTo(near, ENEMY_ARROW);
    }
    if (g.walking && mapImage) {
      const npc = g.nearbyNpc;
      const clip = npc && this.npcSprites?.clip(`${npc.character}-idle`, npc.direction);
      // Within reach, what can be done shows in gold just over the name, in the same boxless lettering.
      if (clip && !this.talking) this.nameplate(`${this.talkKey} 말 걸기`, npc.x * 20, npc.y * 20 - clip.bodyHeight * clip.scale * BODY_SCALE / 2 - NAME_GAP - (npc.label ? NAME_SIZE + 3 : 0), ACTION_GOLD);
    }
    if (g.wakeProgress !== null) {
      // Eyes opening: two dark lids part, then the world holds until the player is up.
      const open = Math.min(1, g.wakeProgress / EYES_OPEN_SHARE), lid = 160 * (1 - open * open * (3 - 2 * open));
      c.save(); c.setTransform(2 * k, 0, 0, 2 * k, 0, 0); this.rect(0, 0, 560, lid, '#0e1218'); this.rect(0, 320 - lid, 560, lid, '#0e1218'); c.restore();
    }
    if (g.active && this.pointer && g.wakeProgress === null) {
      const x = this.pointer.x * 20, y = this.pointer.y * 20;
      this.line(x - 6, y, x - 2, y, '#557d70'); this.line(x + 2, y, x + 6, y, '#557d70'); this.line(x, y - 6, x, y - 2, '#557d70'); this.line(x, y + 2, x, y + 6, '#557d70');
    }
    const hurtLeft = this.hurtUntil - performance.now();
    if (hurtLeft > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.55 * hurtLeft / HURT_EDGE_MS; c.strokeStyle = '#c43c36'; c.lineWidth = 28 * this.backing; c.strokeRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    // The drum board goes over the room, under the screen-wide flashes.
    if (this.drumBoard) { this.drawDrumBoard(...this.drumBoard); this.drumBoard = null; }
    if (pulseLeft > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.16 * pulseLeft; c.fillStyle = '#ffd257'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    const flashLeft = (this.flashUntil || 0) - performance.now();
    if (flashLeft > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.7 * flashLeft / FLASH_MS; c.fillStyle = '#fff8e8'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    if (this.view) {
      // Smooth shrinking averages each block of detail into one pixel; the page then enlarges it without blending.
      const v = this.view.getContext('2d'); v.imageSmoothingEnabled = false;
      v.drawImage(this.canvas, 0, 0, this.view.width, this.view.height);
    }
  }
}
