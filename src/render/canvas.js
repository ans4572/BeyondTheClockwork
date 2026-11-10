import {clampCorners} from '../engine/fusion-geometry.js';
import { PlayerAnimator } from '../animation/player-animator.js';
import { MobAnimator } from '../animation/mob-animator.js';
import { CastEffects } from '../animation/cast-effects.js';
import { nearestDirection } from '../animation/player-animator.js';
import { NpcDirector } from '../animation/npc-director.js';
import { cameraFor, VIEW_UNITS, CAMERA_ZOOM, PIXELS_PER_UNIT } from '../engine/map-geometry.js';
import { ghostFor } from './depth-mask.js';
import { Lighting } from './lighting.js';
import { FX, NOTE_ART, MARKS, LOOT_ART, HAZARD_ART, DEBRIS_ART, BOSS_UNWIND_ART, UNWIND_VERBS, LIFT_ART } from './fx-sprites.js';
import { floorMarks, ELEMENT_TINTS } from './floor-marks.js';
import { factoryBossDraw } from './factory-boss-draw.js';
import { FLOOR_FLAT } from '../engine/math.js';
import { SUMMON_RISE_SECONDS, HIT_FLASH_SECONDS, JOLT_SECONDS } from '../engine/game.js';
import { GROUND, sawAt, plateState, beltState, pressState, laserState, steamState, steamAt } from '../engine/hazards.js';
// Factory devices drawn in two passes: their floor part under everyone, and what stands or hangs over it in the sort.
const TWO_LAYER = new Set(['press', 'steam', 'crane']);
// Where the upper part sorts: a press head just in front of its plate; a pipe and a crane's load over every body.
const UPPER_Y = { press: 0.65, steam: 50, crane: 50 };
/** The music box's notes are drawn a little under their art size so a volley reads as shots, not as clutter. */
const NOTE_SCALE = 0.8;
// The painted water stream: half its pixel size along, a third across (thinner than drawn).
const STREAM_SCALE = 0.5, STREAM_THICKNESS = 0.32;
// F2's empty left hand held out in the shared forward-cast body (frame PLAYER_HELD_FRAME), from the feet in world pixels.
const STREAM_HANDS = { east: [9.5, -23.4], 'south-east': [10.8, -20.7], south: [10.4, -19.8], 'south-west': [5.4, -17.1], west: [-11.7, -17.1], 'north-west': [-18, -23.4], north: [-17.6, -25.2], 'north-east': [4.5, -23.4] };
// The painted water stream and the dash streak were drawn for these widths (units); wider casts are drawn wider to match.
const STREAM_HALF_WIDTH = 0.35, DASH_DRAWN_RADIUS = 0.7;
export const STATUS_ICONS = Object.fromEntries(['burn', 'chill', 'frozen', 'shock', 'windPressure', 'resonance', 'wet'].map(id => [id, `/art/ui/status-icons/${id}.png`]));
/** Brass's march drums in the drum break (PixelLab object); main.js loads it with the place art. */
export const BRASS_DRUM_ART = 'art/bosses/brass/drum.png';
/** Brass's flag bearers in his second phase break: PixelLab, drawn like the wooden guard, one still per direction. */
export const FLAG_BEARER_ART = Object.fromEntries(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'].map(d => [d, `art/bosses/brass/flag-bearer-v1/${d}.png`]));
// Bosses are drawn larger than their sheets so they tower over the room's other bodies.
const NAME_SIZE = 8, NAME_GAP = 3, ACTION_GOLD = '#ffd257', ENEMY_ARROW = '#e0564c', SHAKE_MS = 150, HURT_EDGE_MS = 180, JOLT_PX = 1.5, NUMBER_SIZE = 10, CRIT_NUMBER_SIZE = 12;
const COLUMN_SPACING_UNITS = 1.4, BADGE_SIZE = 12, BADGE_GAP = 1, COUNT_WIDTH = 9, COUNT_SIZE = 6, FROZEN_LOOK = 'saturate(0.2) brightness(1.4)';
/** A phase-break shield's rim round the boss: pale blue inside, deep blue outside (drawOutline rings). */
const SHIELD_RIM = ['#9fe6ff', '#2f7fb0'];
/** The lift picture's cables: the columns they take (42 to 109 of its 158) and the rows of one twist, repeated upward. */
const LIFT_CABLE_SPAN = [42, 110], LIFT_CABLE_REPEAT = 20;
/** How near the way out F2 comes before a cleared room's lift opens, and how long its gate shows half open. */
const LIFT_OPEN_REACH = 3, LIFT_HALF_SECONDS = 0.18;
/** Effect looks that lie flat on the floor: drawn under the bodies with the other floor marks. */
/** The ice crescent's sheet is drawn at this share of its pixels (its blade then spans the cut's width), this far off the floor. */
const CRESCENT_SCALE = 0.65, CRESCENT_LIFT = 14;
/** Elite trait tags over the head, drawn at this share of their old size (2026-11-06: they crowded the fight). */
const AFFIX_TAG_SCALE = 0.6;
/** Roco's PixelLab cans (32px pictures) drawn at this share, about the size of the old drawn ones. */
const CAN_SCALE = 0.75;
/** A struck body's sheen: how see-through-white at its strongest, and how far across the body it reaches (1 = corner to corner). */
const HIT_SHEEN = 0.55, HIT_SHEEN_REACH = 0.75;
/** Scrap sheets by material, and the colour each stands for: a scrap effect plays the one nearest its own colour. */
const SCRAP_SHEETS = [['scrapWood', [160, 122, 74]], ['scrapBrass', [255, 190, 32]], ['scrapIce', [159, 211, 230]], ['scrapOil', [58, 42, 24]]];
function scrapSheet(color = '#a07a4a') {
  const n = parseInt(String(color).replace('#', '').padEnd(6, '0').slice(0, 6), 16), rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
  return SCRAP_SHEETS.reduce((best, [name, c]) => { const d = c.reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0); return d < best[1] ? [name, d] : best; }, ['scrapWood', Infinity])[0];
}
/** How big the crate blast picture is drawn against its blast radius. */
const CRATE_BLAST_DRAWN = 0.85;
/** How many tinted frames (elite outlines) are kept: a room's elites walking in eight directions fit well inside. */
const TINT_CACHE_LIMIT = 256;
/**
 * Squash and stretch on a struck mob (not a boss), about its feet: 10% wide and low the moment the blow lands, 4% tall at
 * half way, back to its shape by 0.15 s ('B 보통', picked 2026-11-09 from the example page). Keys are [share, across, up].
 */
const HIT_SQUASH_SECONDS = 0.15, HIT_SQUASH = [[0, 1.1, 0.9], [0.5, 0.96, 1.04], [1, 1, 1]];
/** The squash of a body struck `age` seconds ago as [across, up], or null once it is over (or never struck). */
export function hitSquash(age) {
  if (!(age >= 0 && age < HIT_SQUASH_SECONDS)) return null;
  const t = age / HIT_SQUASH_SECONDS, i = t < HIT_SQUASH[1][0] ? 0 : 1, [t0, x0, y0] = HIT_SQUASH[i], [t1, x1, y1] = HIT_SQUASH[i + 1];
  const u = 1 - (1 - (t - t0) / (t1 - t0)) ** 2;
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
}
/** How far (units, across and down) the fight view leans toward the aim, and how quickly it follows. */
const CAMERA_LEAD = [1.2, 0.4], CAMERA_LEAD_SECONDS = 0.45;
/**
 * The view follows its focus over this long instead of sitting on it, and does not move up or down at all while the
 * focus stays within CAMERA_DEAD_Y of it (2026-11-08: small steps up and down shook the whole picture). A jump farther
 * than CAMERA_SNAP (a new room, a panel's spot) is taken at once.
 */
const CAMERA_FOLLOW_SECONDS = 0.12, CAMERA_DEAD_Y = 0.6, CAMERA_SNAP = 4;
const GROUND_LOOKS = new Set(['quake', 'drumBeat', 'march', 'carpetRoll', 'stampHit']);
const TAG_SIZE = 7, TAU = Math.PI * 2, SCREEN_UNITS = VIEW_UNITS, TELL_BLINK_SECONDS = 0.1, TELL_BLINKS = 3;
// F2's clips stand taller than the townsfolk; this brings them to the same height everywhere.
// Bodies are drawn a little over their sheet size so they read clearly on the 640-pixel grid.
/** A fusion's burst: how long the floor dims, the edges glow and the view leans in, and by how much. */
const FUSION_DIM_MS = 260, FUSION_EDGE_MS = 420, FUSION_ZOOM_MS = 240, FUSION_ZOOM = 0.06, FUSION_DIM = 0.32;
/** How long a '!' stays over a body that has just noticed F2. */
const NOTICE_SECONDS = 0.8;
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
  /** A fusion goes off: edges lit in its two elements, the floor dimmed, the view leaning in (see render). */
  fusionBurst(pair = [], calm = false) { this.fusionAt = performance.now(); this.fusionCalm = calm; this.fusionTints = pair.map(id => ELEMENT_TINTS[id] || '#fff4cd'); }
  /**
   * The glow along the screen's top edge: `left` fading into `right` across the width, and from the edge down to nothing.
   * Kept and reused while the size and colours stay the same.
   */
  fusionBand(width, height, left, right) {
    const key = `${width}x${height}${left}${right}`;
    if (this.bandKey === key) return this.band;
    const band = this.band ??= document.createElement('canvas'), b = band.getContext('2d');
    band.width = width; band.height = height;
    const across = b.createLinearGradient(0, 0, width, 0); across.addColorStop(0.35, left); across.addColorStop(0.65, right);
    b.fillStyle = across; b.fillRect(0, 0, width, height);
    const down = b.createLinearGradient(0, 0, 0, height); down.addColorStop(0, 'rgba(0,0,0,1)'); down.addColorStop(1, 'rgba(0,0,0,0)');
    b.globalCompositeOperation = 'destination-in'; b.fillStyle = down; b.fillRect(0, 0, width, height); b.globalCompositeOperation = 'source-over';
    this.bandKey = key; return band;
  }
  /** How far into a fusion's burst the screen is: 1 at the start, 0 once over (`ms` long). */
  fusionLeft(ms) { return this.fusionAt ? Math.max(0, 1 - (performance.now() - this.fusionAt) / ms) : 0; }
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
  /**
   * The pixelfx sheets that stand in for code-drawn shapes (2026-11-09): F2's wrench swing (not the 360 spin), the blow
   * landing, and scrap of the nearest material. True when drawn (or when a swing's sheet has run out); false while the
   * sheet is loading, so the old shape is drawn instead.
   */
  drawSheetFx(fx, x, y, t) {
    if (fx.type === 'swing' && !fx.look && (fx.arc || 0) < 360) {
      const heavy = fx.phase === 2, name = heavy ? 'wrenchArcHeavy' : 'wrenchArc', sheet = FX[name], k = fx.value * 20 / (heavy ? 51 : 44);
      const frame = (this.game.s.time - fx.created) * sheet.fps;
      if (frame >= sheet.frames) return !!this.mapImages?.get(sheet.sheet);
      // The second blow swings back the other way: the same arc mirrored across the aim.
      return this.drawFxFrame(name, frame, x, y, { angle: fx.angle, sx: k, sy: fx.phase === 1 ? -k : k });
    }
    if (fx.type === 'impact') { const k = fx.value >= 1 ? 1.25 : 0.9; return this.drawFxFrame('wrenchHit', Math.min(FX.wrenchHit.frames - 1, t * FX.wrenchHit.frames), x, y, { angle: fx.angle || 0, sx: k, sy: k }); }
    if (fx.type === 'scrap') { const name = scrapSheet(fx.color); return this.drawFxFrame(name, Math.min(FX[name].frames - 1, t * FX[name].frames), x, y, { sx: fx.value, sy: fx.value }); }
    return false;
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
    const white = typeof flash === 'number' ? flash : 0;
    if (flash && !white) c.filter = flash === true ? 'brightness(1.9)' : flash;
    c.imageSmoothingEnabled = resize !== 1;
    for (const url of [clip.sheet, clip.effect]) if (url && library.image(url)) c.drawImage(library.image(url), sx, sy, w, h, left, top, w * size, h * size);
    if (flash && !white) c.filter = 'none';
    if (white > 0) this.whiteOver(image, sx, sy, w, h, left, top, w * size, h * size, white);
    c.imageSmoothingEnabled = false;
    return true;
  }
  /** A street prop stands on its bottom centre; its feet decide what it hides. */
  drawProp({ image, x, y, scale = 1, flip, white = 0 }) {
    const c = this.ctx, picture = this.mapImages.get(image);
    if (!picture) return;
    const w = picture.width / 2 * scale, h = picture.height / 2 * scale;
    c.save(); c.translate(x * 20, y * 20); if (flip) c.scale(-1, 1);
    c.imageSmoothingEnabled = scale !== 1; c.drawImage(picture, -w / 2, -h, w, h);
    if (white > 0) this.whiteOver(picture, 0, 0, picture.width, picture.height, -w / 2, -h, w, h, white);
    c.restore();
  }
  /**
   * A struck body catches a quick see-through white sheen and fades back (as in Hades): the frame's own shape filled
   * white, strongest on the upper-left (where the town's light comes from) and gone by the lower-right, laid over it at
   * `amount`. Falls back to a brightened copy where no scratch canvas can be made (tests).
   */
  whiteOver(image, sx, sy, w, h, dx, dy, dw, dh, amount) {
    const c = this.ctx;
    if (typeof document === 'undefined') { c.filter = 'brightness(1.9)'; c.globalAlpha *= amount; c.drawImage(image, sx, sy, w, h, dx, dy, dw, dh); c.globalAlpha /= amount; c.filter = 'none'; return; }
    const scratch = this.whiteCanvas ??= document.createElement('canvas');
    if (scratch.width < w || scratch.height < h) { scratch.width = Math.max(scratch.width, w); scratch.height = Math.max(scratch.height, h); }
    const s = scratch.getContext('2d');
    s.globalCompositeOperation = 'copy'; s.drawImage(image, sx, sy, w, h, 0, 0, w, h);
    s.globalCompositeOperation = 'source-in'; s.fillStyle = '#ffffff'; s.fillRect(0, 0, w, h);
    // Only part of the body shines: full on the upper-left, fading out across it.
    const fade = s.createLinearGradient(0, 0, w * HIT_SHEEN_REACH, h * HIT_SHEEN_REACH);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.45, 'rgba(0,0,0,0.7)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    s.globalCompositeOperation = 'destination-in'; s.fillStyle = fade; s.fillRect(0, 0, w, h); s.globalCompositeOperation = 'source-over';
    const alpha = c.globalAlpha; c.globalAlpha = alpha * amount; c.drawImage(scratch, 0, 0, w, h, dx, dy, dw, dh); c.globalAlpha = alpha;
  }
  /** How white a struck body is now: solid white for the first frames after the blow, then fading out (0 when untouched). */
  hitWhite(enemy) {
    const left = (enemy.flashUntil || 0) - this.game.s.time;
    return left > 0 ? Math.min(1, left / (HIT_FLASH_SECONDS * 0.6)) * HIT_SHEEN : 0;
  }
  /** What an enemy is suffering right now, in the order it is drawn. */
  statusBadges(enemy) {
    const { time } = this.game.s, badges = [], stacks = enemy.burnStacks.filter(end => end > time).length;
    if (stacks) badges.push({ id: 'burn', count: stacks });
    if (enemy.frozenUntil > time) badges.push({ id: 'frozen' });
    else if (enemy.statuses.chill > time) badges.push({ id: 'chill' });
    for (const id of ['shock', 'windPressure', 'wet']) if (enemy.statuses[id] > time) badges.push({ id });
    // Resonance shows its layers like burn does (×2, ×3).
    if (enemy.statuses.resonance > time && enemy.resonanceStacks) badges.push({ id: 'resonance', count: enemy.resonanceStacks });
    return badges;
  }
  /**
   * One room hazard: its painted sprite (art/chapters/1-smile-street/hazards), with its state drawn over it in code: a plate's
   * warning and heat, a crate's blinking fuse, the saw running along its groove, a spent music box.
   */
  /**
   * A mark a factory mob left on the floor: the inspector's red reject stamp, the packer's tape strip, the oiler's slick
   * (burning when lit, frosted when iced), a rivet stuck in the floor. Each fades in its last half second.
   */
  drawFloorMark(m) {
    const c = this.ctx, t = this.game.s.time, x = m.x * 20, y = m.y * 20, rx = m.radius * 20, ry = rx * FLOOR_FLAT, fade = Math.min(1, (m.duration - m.age) / 0.5, m.age / 0.15);
    const blob = (fill, a, sx = 1) => { c.save(); c.globalAlpha = a * fade; c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx * sx, ry * sx, 0, 0, TAU); c.fill(); c.restore(); };
    if (m.look === 'stamp' && this.drawMark('stampReject', x, y, rx * 1.9, { alpha: 0.92 * fade })) { /* PixelLab reject stamp */ }
    else if (m.look === 'stamp') {
      blob('#c0392b', 0.55);
      c.save(); c.globalAlpha = 0.8 * fade; c.strokeStyle = '#7e1f18'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - rx * 0.5, y - ry * 0.5); c.lineTo(x + rx * 0.5, y + ry * 0.5); c.moveTo(x + rx * 0.5, y - ry * 0.5); c.lineTo(x - rx * 0.5, y + ry * 0.5); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, rx * 0.85, ry * 0.85, 0, 0, TAU); c.stroke(); c.restore();
    }
    if (m.look === 'tape' && this.drawMark('tapePiece', x, y, rx * 2.2, { angle: m.angle || 0, alpha: 0.95 * fade })) { /* PixelLab tape */ }
    else if (m.look === 'tape') {
      c.save(); c.globalAlpha = 0.85 * fade; c.translate(x, y); c.rotate(m.angle || 0);
      c.fillStyle = '#c9a466'; c.fillRect(-rx * 0.75, -ry * 1.1, rx * 1.5, ry * 2.2);
      c.fillStyle = '#e8cf95'; c.fillRect(-rx * 0.75, -ry * 1.1, rx * 1.5, 2); c.fillStyle = 'rgba(255, 255, 255, 0.35)'; c.fillRect(-rx * 0.4, -1, rx * 0.5, 1); c.restore();
    }
    // 물웅덩이 (F2's own): a shallow teal puddle with a pale rim, glinting.
    // 빙판: pale blue ice with white cracks, blinking in its last half second before it breaks.
    if (m.look === 'iceSheet' && !this.castSheet('iceSheet')) {
      const blink = m.duration - m.age < 0.5 ? 0.6 + 0.4 * Math.sin(this.visualTime * 40) : 1;
      blob('#bfe9f4', 0.55 * blink); blob('#e6f8fb', 0.4 * blink, 0.55);
      c.save(); c.globalAlpha = 0.8 * fade * blink; c.strokeStyle = '#ffffff'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * rx * 0.85, y + Math.sin(a) * ry * 0.85); c.stroke(); }
      c.strokeStyle = '#9fe3f0'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke(); c.restore();
    }
    if (m.look === 'puddle') {
      blob('#3f9fb5', 0.45); blob('#7fd0dc', 0.35, 0.6);
      c.save(); c.globalAlpha = 0.7 * fade; c.strokeStyle = '#d8f6f8'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke(); c.restore();
      this.circle(x - rx * 0.35, y - ry * 0.3 + Math.sin(t * 4 + m.x) * 0.6, 1.2, '#ffffff');
    }
    if (m.look === 'oil') {
      const burning = m.burningUntil > t, frozen = m.frozenUntil > t;
      if (this.drawMark(frozen ? 'oilFrozen' : 'oilPuddle', x, y, rx * 2.1, { alpha: fade })) { if (burning) blob('#ff7a2c', 0.3); }
      else blob('#1e1a1c', 0.85);
      if (!burning && !this.mark('oilPuddle')) { blob('#5b4fa0', 0.45, 0.55); c.save(); c.globalAlpha = 0.5 * fade; c.fillStyle = '#5fb3a0'; c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.2, rx * 0.3, ry * 0.18, 0, 0, TAU); c.fill(); c.restore(); }
      if (frozen && !this.mark('oilFrozen')) blob('#cdf3fa', 0.45);
      if (burning) {
        blob('#ff7a2c', 0.35 + Math.sin(this.visualTime * 14) * 0.1);
        if (!this.drawFxFrame('groundFire', this.visualTime * 12 + m.x * 3, x, y, { sx: rx / 16, sy: rx / 16, alpha: 0.9 })) blob('#ffbe20', 0.4, 0.6);
      }
    }
    if (m.look === 'pass' && this.drawMark('stampPass', x, y, rx * 1.8, { flat: 0.62, alpha: 0.95 * fade })) { /* PixelLab pass stamp */ }
    else if (m.look === 'pass') {
      // Iris's green pass stamp: standing on it wipes the failing marks.
      blob('#3c8a5a', 0.45); c.save(); c.globalAlpha = 0.9 * fade; c.strokeStyle = '#1f5a38'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, rx * 0.85, ry * 0.85, 0, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x - rx * 0.35, y); c.lineTo(x - rx * 0.05, y + ry * 0.35); c.lineTo(x + rx * 0.45, y - ry * 0.4); c.stroke(); c.restore();
    }
    if (m.look === 'screw' && this.drawMark('rivetPlanted', x, y - 4, 8, { alpha: fade })) { /* PixelLab rivet */ }
    else if (m.look === 'screw') {
      c.save(); c.globalAlpha = fade; c.fillStyle = 'rgba(14, 18, 26, 0.35)'; c.beginPath(); c.ellipse(x, y + 1, 4, 1.5, 0, 0, TAU); c.fill();
      this.rect(x - 1, y - 6, 3, 7, '#2b3345'); this.rect(x, y - 5, 1, 5, '#b9c0cc'); this.rect(x - 2, y - 7, 5, 2, '#e0b048'); c.restore();
    }
  }
  drawHazard(h, layer = 'up') {
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
    if (h.kind === 'belt' && rules.belt) {
      // A conveyor belt: its PixelLab picture (brass frame, rubber, rollers), with what it is doing drawn over it in code:
      // arrows running the way it carries, flashing red just before it turns round, and a frost sheet while ice holds it.
      const { way, frozen, warn, speed } = beltState(h, t, rules.belt), across = h.w >= h.h;
      const w = h.w * 20, d = h.h * 20, left = x - w / 2, top = y - d / 2, long = across ? w : d, short = across ? d : w;
      const image = art(across ? 'beltAcross' : 'beltUpright');
      const capL = art('beltLeft'), mid = art('beltMid'), capR = art('beltRight');
      if (capL && mid && capR) {
        // Ends at either tip, the rubber repeated between them to the belt's length; an upright belt is the same strip turned.
        c.save(); c.imageSmoothingEnabled = false; c.translate(Math.round(x), Math.round(y)); if (!across) c.rotate(Math.PI / 2);
        const len = Math.round(long), x0 = -Math.round(len / 2), y0 = -Math.round(mid.height / 2), end = x0 + len - capR.width;
        for (let px = x0 + capL.width; px < end; px += mid.width) { const piece = Math.min(mid.width, end - px); c.drawImage(mid, 0, 0, piece, mid.height, px, y0, piece, mid.height); }
        c.drawImage(capL, x0, y0); c.drawImage(capR, end, y0); c.restore();
      } else if (image) { c.save(); c.imageSmoothingEnabled = false; c.drawImage(image, Math.round(x - image.width / 2), Math.round(y - image.height / 2 + (across ? 2 : 0))); c.restore(); }
      else { this.rect(left - 2, top - 2, w + 4, d + 4, NAVY); this.rect(left, top, w, d, '#34343e'); }
      const arrow = frozen ? '#9fb6c4' : warn ? (Math.floor(t * 8) % 2 ? '#d8423c' : '#ffbe20') : '#ffd257', pointing = way || (h.dir || 1);
      for (let k = 1; k <= 3; k++) {
        const at = ((long * k / 4 + (frozen ? 0 : t * speed * 20 * pointing * 0.5)) % long + long) % long;
        if (at < 10 || at > long - 10) continue;
        const cx = across ? left + at : x, cy = across ? y : top + at, r = short * 0.26;
        const path = () => { c.beginPath(); if (across) { c.moveTo(cx - pointing * r, cy - r); c.lineTo(cx + pointing * r * 0.6, cy); c.lineTo(cx - pointing * r, cy + r); } else { c.moveTo(cx - r, cy - pointing * r); c.lineTo(cx, cy + pointing * r * 0.6); c.lineTo(cx + r, cy - pointing * r); } };
        c.lineJoin = 'round'; path(); c.lineWidth = 4; c.strokeStyle = NAVY; c.stroke(); path(); c.lineWidth = 2; c.strokeStyle = arrow; c.stroke();
      }
      if (frozen) { c.save(); c.globalAlpha = 0.4; this.rect(left, top, w, d, '#cdf3fa'); c.restore(); }
    }
    const image = name => art(name);
    const ellipse = (cx, cy, rx, ry, fill, stroke, width = 2) => { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(); } };
    const blit = (picture, left, top, flip = false) => { if (!picture) return; c.save(); c.imageSmoothingEnabled = false; if (flip) { c.translate(Math.round(left) * 2 + picture.width, 0); c.scale(-1, 1); } c.drawImage(picture, Math.round(left), Math.round(top)); c.restore(); };
    if (h.kind === 'press' && rules.press) {
      // Press pillar (2026-11-08): the head waits out of sight in the ceiling. A red ring on the floor warns, the head drops
      // in the last moment of the warning, stands on its plate while it blocks the way, then is pulled back up out of view.
      // Between slams only a faint worn plate marks the spot. Ice that makes it miss a slam leaves a frost sheet on the plate.
      const r = rules.press, { state, phase, n } = pressState(h, t, r), plate = image('pressPlate'), head = image('pressHead');
      const FALL = 0.16, RISE = 0.3, HIGH = 150, skipped = h.skipN === n;
      const lead = state === 'warn' ? (phase - r.idle) / r.warn : 0;
      if (layer === 'ground') {
        const down = state === 'slam';
        c.save(); c.globalAlpha = down ? 1 : 0.3;
        if (plate) blit(plate, x - plate.width / 2, y - plate.height / 2); else this.rect(x - h.w * 10, y - h.h * 10, h.w * 20, h.h * 20, '#6c7486');
        c.restore();
        if (state === 'warn') {
          // The ring: a soft red fill that deepens, a rim that blinks faster near the end, and the shadow of what is coming.
          const blink = Math.floor(t * (lead > 0.6 ? 16 : 8)) % 2, rx = h.w * 10 + 5, ry = h.h * 10 + 4;
          c.save(); c.globalAlpha = 0.18 + lead * 0.3; ellipse(x, y, rx, ry, '#d8423c'); c.restore();
          c.save(); c.globalAlpha = 0.2 + lead * 0.4; ellipse(x, y, 6 + lead * (rx - 8), 3 + lead * (ry - 5), '#111522'); c.restore();
          ellipse(x, y, rx, ry, null, blink ? '#ff7a5c' : '#d8423c', 2);
        }
        if (down) { c.save(); c.globalAlpha = 0.45; ellipse(x, y + 2, h.w * 10 + 2, h.h * 8, '#111522'); c.restore(); }
        if (skipped) { c.save(); c.globalAlpha = 0.4; this.rect(x - h.w * 10, y - h.h * 10, h.w * 20, h.h * 20, '#cdf3fa'); c.restore(); }
      } else if (head) {
        // How high the head hangs above its plate (canvas pixels), or null while it is out of sight.
        const fall = state === 'warn' && phase - r.idle > r.warn - FALL ? 1 - (phase - r.idle - (r.warn - FALL)) / FALL : null;
        const lift = state === 'slam' ? 0 : fall !== null ? HIGH * fall * fall : state === 'idle' && !skipped && phase < RISE ? HIGH * (phase / RISE) ** 2 : null;
        if (lift !== null) {
          const bottom = y + 6 - lift, left = Math.round(x - head.width / 2), top = Math.round(bottom - head.height), fade = state === 'idle' ? 1 - phase / RISE : 1;
          c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = fade;
          // The piston rod above it fades out upward, into the dark of the ceiling.
          for (let k = 0; k < 8; k++) { c.globalAlpha = fade * (1 - k / 8) * 0.95; c.drawImage(head, 0, 0, head.width, 4, left, top - 8 * (k + 1), head.width, 8); }
          c.globalAlpha = fade; c.drawImage(head, left, top); c.restore();
        }
      }
    }
    if (h.kind === 'laser' && rules.laser) {
      // Inspection laser door: two PixelLab lens posts facing each other, the beam between them at lens height.
      const r = rules.laser, { state } = laserState(h, t, r), post = image('laserPost'), half = h.half * 20, beam = y - 22;
      c.save(); c.globalAlpha = 0.3; ellipse(x - half, y + 1, 7, 3, '#0e121a'); ellipse(x + half, y + 1, 7, 3, '#0e121a'); c.restore();
      if (state === 'warn') { c.save(); c.setLineDash([4, 4]); c.lineWidth = 1; c.strokeStyle = '#ff7a8a'; c.beginPath(); c.moveTo(x - half, beam); c.lineTo(x + half, beam); c.stroke(); c.restore(); }
      if (state === 'on') {
        c.save(); c.globalAlpha = 0.35; this.rect(x - half, beam - 4, half * 2, 8, '#ff5a6e'); c.globalAlpha = 0.22; this.rect(x - half, y - 2, half * 2, 3, '#ff5a6e'); c.restore();
        this.rect(x - half, beam - 2, half * 2, 4, '#ff5a6e'); this.rect(x - half, beam - 1, half * 2, 2, '#fff1f3');
      }
      if (post) { blit(post, x - half - 13, beam - 10); blit(post, x + half - 4, beam - 10, true); }
      if (h.downUntil > t && Math.floor(t * 12) % 2) { this.rect(x - half - 1, beam - 2, 3, 3, '#ffe086'); this.rect(x + half - 1, beam - 2, 3, 3, '#ffe086'); }
    }
    if (h.kind === 'hallGate' && g.s.enemies.some(e => e.boss && e.hp > 0)) {
      // A boss hall's gate (factory-bosses.js fbHallGates): the laser door's lens posts and a steady beam that flickers
      // on as it shuts (lit on its first frame: the boss's first words pause the game right then) and hums while he stands.
      // The beam hangs `lift` px over the gate line (22, the posts standing on it; arenaGates[].lift: 0 lays the beam on the
      // line with the posts below it, Press's lower gate by the user's choice, 2026-11-10).
      const post = art('laserPost'), half = h.half * 20, beam = y - (h.lift ?? 22), foot = beam + 22, age = t - (h.at || 0), on = age >= 0.3 || Math.floor(age * 30) % 2 === 0, hum = 0.8 + 0.2 * Math.sin(t * 9);
      c.save(); c.globalAlpha = 0.3; ellipse(x - half, foot + 1, 7, 3, '#0e121a'); ellipse(x + half, foot + 1, 7, 3, '#0e121a'); c.restore();
      if (on) {
        c.save(); c.globalAlpha = 0.35 * hum; this.rect(x - half, beam - 4, half * 2, 8, '#ff5a6e'); c.globalAlpha = 0.22 * hum; this.rect(x - half, foot - 2, half * 2, 3, '#ff5a6e'); c.restore();
        this.rect(x - half, beam - 2, half * 2, 4, '#ff5a6e'); this.rect(x - half, beam - 1, half * 2, 2, '#fff1f3');
      }
      if (post) { blit(post, x - half - 13, beam - 10); blit(post, x + half - 4, beam - 10, true); }
    }
    if (h.kind === 'steam' && rules.steam) {
      // Steam vent (2026-11-09, was a brass pipe hanging in mid-air): a round grate set in the floor (PixelLab) and see-through
      // steam rising off it in soft puffs that thin as they climb; a burst also rolls low over the patch it hurts. A faint
      // ring marks the patch, dashed amber before a burst. Wind carries the steam aside; ice leaves the grate frosted shut.
      const r = rules.steam, { state } = steamState(h, t, r), at = steamAt(h, t), fx = at.x * 20, fy = at.y * 20, rx = r.radius * 20, ry = rx * 0.6;
      // One soft puff: white at the middle fading to nothing at its edge, never an outline.
      const puff = (px, py, size, alpha) => {
        if (alpha <= 0.01 || size <= 0) return;
        const glow = c.createRadialGradient(px, py, 0, px, py, size);
        glow.addColorStop(0, `rgba(246, 244, 238, ${alpha})`); glow.addColorStop(0.55, `rgba(232, 232, 228, ${alpha * 0.55})`); glow.addColorStop(1, 'rgba(225, 228, 230, 0)');
        c.fillStyle = glow; c.beginPath(); c.ellipse(px, py, size, size * 0.8, 0, 0, TAU); c.fill();
      };
      // `count` puffs on a loop: each rises `rise` px over `life` seconds from (sx, sy), growing and fading; `spread` sideways.
      const plume = (sx, sy, count, life, rise, from, to, alpha, spread) => {
        for (let i = 0; i < count; i++) {
          const u = ((t / life + i / count) % 1 + 1) % 1, side = Math.sin(i * 12.9898) * spread * (0.4 + u);
          puff(sx + side + Math.sin(t * 2 + i) * 2, sy - rise * u, from + (to - from) * u, alpha * Math.min(1, u * 5) * (1 - u));
        }
      };
      if (layer === 'ground') {
        const vent = image('steamVent');
        if (vent) blit(vent, x - vent.width / 2, y - vent.height / 2);
        else { ellipse(x, y, 16, 9.5, '#5a3a24', '#c79a3e', 2); for (let k = -2; k <= 2; k++) this.rect(x + k * 5 - 1, y - 5, 2, 10, '#1b2230'); }
        if (state === 'frozen') { c.save(); c.globalAlpha = 0.5; ellipse(x, y, 15, 9, '#cdf3fa', '#7fd0e0', 1.5); c.restore(); }
        c.save(); c.globalAlpha = state === 'burst' ? 0.16 : 0.1; ellipse(fx, fy, rx, ry, '#1b2230'); c.restore();
        if (state === 'warn') { c.save(); c.setLineDash([4, 3]); c.globalAlpha = 0.85; ellipse(fx, fy, rx, ry, null, '#ffbe20', 2); c.restore(); }
        if (h.hotUntil > t) { c.save(); c.globalAlpha = 0.22; ellipse(fx, fy, rx, ry, '#ff7a2c'); c.restore(); }
      } else {
        c.save();
        if (state === 'burst') {
          // A column off the grate, and a low cloud rolling over the whole patch it hurts.
          plume(fx, fy - 4, 12, 0.9, 70, 7, 20, 0.5, 6);
          for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + t * 0.8, u = ((t * 1.6 + i / 9) % 1); puff(fx + Math.cos(a) * rx * (0.35 + 0.5 * u), fy + Math.sin(a) * ry * (0.35 + 0.5 * u) - 4, 9 + 7 * u, 0.38 * (1 - u * 0.7)); }
        } else if (state === 'warn') plume(fx, fy - 3, 6, 0.7, 26, 3, 8, 0.4, 2);
        else if (state === 'idle') plume(fx, fy - 2, 3, 2.2, 22, 2.5, 7, 0.2, 2);
        c.restore();
      }
    }
    if (h.kind === 'crane' && rules.crane && h.mark) {
      // Parts crane: a red ring closing in on the dashed amber mark, then the PixelLab crate coming down on its rope.
      const r = rules.crane, m = h.mark, mx = m.x * 20, my = m.y * 20, left = m.at - t, rx = r.radius * 20, ry = rx * 0.6;
      if (layer === 'ground') {
        const k = Math.max(0.3, Math.min(1, left / r.mark)) * 0.8;
        c.save(); c.globalAlpha = 0.25; ellipse(mx, my, rx, ry, '#0e121a'); c.restore();
        c.save(); c.setLineDash([5, 4]); ellipse(mx, my, rx, ry, null, '#ffbe20', 2); c.restore();
        ellipse(mx, my, rx * k, ry * k, null, '#d8423c', 2); this.rect(mx - 1, my - 4, 2, 8, '#d8423c'); this.rect(mx - 4, my - 1, 8, 2, '#d8423c');
      } else if (left < 0.5) {
        const crate = image('craneCrate'), u = 1 - Math.max(0, left) / 0.5, bottom = my - 90 * (1 - u * u) + 4;
        this.rect(mx - 1, bottom - 140, 2, 140 - (crate ? crate.height : 24), '#3b3b3b');
        if (crate) blit(crate, mx - crate.width / 2, bottom - crate.height);
      }
    }
    if (h.kind === 'bossPlate') {
      // A press plate director Press dropped: dark iron with a brass rim and the hall's gear (PixelLab v2), in the way until it lifts.
      const w = h.w * 20, d = h.h * 20, left = x - w / 2, top = y - d / 2, lifting = h.until - t < 0.3;
      if (this.drawMark('bossPlate', x, y - 2, w + 4, { alpha: lifting ? 0.5 : 1 })) return;
      c.save(); if (lifting) c.globalAlpha = 0.5; this.rect(left - 2, top - 2, w + 4, d + 4, NAVY); for (let i = 0; i < w; i += 6) this.rect(left + i, top, 3, d, (i / 6) % 2 ? '#1f2230' : '#ffbe20'); this.rect(left + 5, top + 5, w - 10, d - 10, '#8a93a6'); this.rect(left + 5, top + 5, w - 10, 2, '#cfd5e0'); c.restore();
    }
    if (h.kind === 'dropbox') {
      // A crate the crane dropped: in the way until it is broken or its time is up; it flickers just before it goes.
      const crate = image('craneCrate'), fading = h.until - t < 1 && Math.floor(t * 10) % 2;
      c.save(); c.globalAlpha = 0.35; ellipse(x, y + h.size * 6, h.size * 9, h.size * 3, '#0e121a'); c.restore();
      if (h.hp < rules.crane?.boxHp) c.filter = 'brightness(0.85)';
      if (crate && !fading) blit(crate, x - crate.width / 2, y + h.size * 8 - crate.height);
      c.filter = 'none';
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
    // Element names from the game data (combat.json), so a trait on water or sound reads '물 …' rather than 'undefined …'.
    const names = Object.fromEntries((this.game.c.elements || []).map(e => [e.id, e.name])), rules = this.game.config.eliteAffixes?.list || [];
    const tags = enemy.affixes.map(({ id, element }) => { const rule = rules.find(r => r.id === id); return rule && { text: element && names[element] ? `${names[element]} ${rule.name}` : rule.name, color: element ? this.game.config.presentation.colors[element] : rule.color }; }).filter(Boolean);
    const ink = this.ink(); ink.font = `700 ${TAG_SIZE}px "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
    const widths = tags.map(tag => Math.ceil(ink.measureText(tag.text).width) + 9), total = widths.reduce((a, b) => a + b, 0) + (tags.length - 1) * 2;
    // Drawn smaller than the rest of the lettering, shrunk round the tags' bottom middle so they stay just over the head.
    const c = this.ctx, cx = enemy.x * 20, bottom = y + TAG_SIZE + 4;
    c.save(); c.translate(cx, bottom); c.scale(AFFIX_TAG_SCALE, AFFIX_TAG_SCALE); c.translate(-cx, -bottom);
    let x = Math.round(enemy.x * 20 - total / 2);
    tags.forEach((tag, i) => {
      this.rect(x - 1, y - 1, widths[i] + 2, TAG_SIZE + 5, '#f6ecd2'); this.rect(x, y, widths[i], TAG_SIZE + 3, '#2b3345'); this.rect(x, y, 3, TAG_SIZE + 3, tag.color);
      this.text(tag.text, x + 3 + (widths[i] - 3) / 2, y + TAG_SIZE + 0.5, '#fff4d6', TAG_SIZE);
      x += widths[i] + 2;
    });
    c.restore(); this.ink();
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
    c.save(); c.imageSmoothingEnabled = false; c.globalAlpha *= 0.8 + 0.2 * Math.sin(this.visualTime * 5);
    for (let ring = Math.min(2, colors.length); ring >= 1; ring--) {
      const shape = this.tintedFrame(image, clip.sheet, pose.frame % columns * w, Math.floor(pose.frame / columns) * h, w, h, colors[ring - 1]);
      const d = ring * Math.max(1, size);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.drawImage(shape, left + ox * d, top + oy * d, w * size, h * size);
    }
    c.restore();
  }
  /**
   * One sheet frame's silhouette filled with one colour, kept for reuse: an elite's outline asked for the same few frames
   * every frame, and re-tinting a scratch canvas each time made the browser upload it again and again (2026-11-09).
   */
  tintedFrame(image, sheet, sx, sy, w, h, color) {
    const cache = this.tintCache ??= new Map(), key = `${sheet}|${sx},${sy}|${color}`;
    let shape = cache.get(key);
    if (shape) { cache.delete(key); cache.set(key, shape); return shape; }
    shape = document.createElement('canvas'); shape.width = w; shape.height = h;
    const t = shape.getContext('2d');
    t.drawImage(image, sx, sy, w, h, 0, 0, w, h);
    t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, w, h);
    cache.set(key, shape);
    if (cache.size > TINT_CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return shape;
  }
  /**
   * A shielded boss glows blue: the frame's own shape tinted pale blue, a bright band sweeping across it diagonally,
   * laid over the body and pulsing.
   */
  shieldSheen(x, y, pose, library, resize) {
    const clip = library?.clip(pose.action, pose.direction), image = clip && library.image(clip.sheet);
    if (!image || typeof document === 'undefined') return;
    const { frameWidth: w, frameHeight: h, columns, anchor, scale } = clip, size = scale * resize * BODY_SCALE / 2;
    const left = Math.round((x - anchor[0] * size) * 2) / 2, top = Math.round((y - anchor[1] * size) * 2) / 2, c = this.ctx;
    const sheen = this.sheenCanvas ??= document.createElement('canvas');
    if (sheen.width !== w || sheen.height !== h) { sheen.width = w; sheen.height = h; }
    const t = sheen.getContext('2d'), sweep = (this.visualTime * 70) % (w + h + 60) - 30;
    t.globalCompositeOperation = 'copy'; t.drawImage(image, pose.frame % columns * w, Math.floor(pose.frame / columns) * h, w, h, 0, 0, w, h);
    t.globalCompositeOperation = 'source-in'; t.fillStyle = 'rgba(96, 186, 240, 0.55)'; t.fillRect(0, 0, w, h);
    const band = t.createLinearGradient(sweep - 16, 0, sweep + 16, 16);
    band.addColorStop(0, 'rgba(210, 244, 255, 0)'); band.addColorStop(0.5, 'rgba(230, 250, 255, 1)'); band.addColorStop(1, 'rgba(210, 244, 255, 0)');
    t.globalCompositeOperation = 'source-atop'; t.fillStyle = band; t.fillRect(0, 0, w, h); t.globalCompositeOperation = 'source-over';
    c.save(); c.globalAlpha *= 0.45 + 0.2 * Math.sin(this.visualTime * 6); c.imageSmoothingEnabled = resize !== 1;
    c.drawImage(sheen, 0, 0, w, h, left, top, w * size, h * size); c.restore();
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
    this.drawProp({ image, x: enemy.x, y: enemy.y, scale: 1, white: this.hitWhite(enemy) });
    this.drawStatuses(enemy, enemy.y * 20 - 70);
  }
  /** A small map of the area in the corner: the art itself, the view, people, enemies and where to go next. */
  /** The whole frame in the ink colour, copied to the screen; the minimap hides until the picture is in. */
  drawWaiting() {
    const c = this.ctx; this.minimapPlace = null; this.overlays = [];
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1c2230'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore();
    if (this.view) { const v = this.view.getContext('2d'); v.imageSmoothingEnabled = false; v.drawImage(this.canvas, 0, 0, this.view.width, this.view.height); }
  }
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
    // Mostly see-through, so the minimap sits on the scene instead of competing with it.
    c.globalAlpha = 0.6; c.drawImage(this.minimapArt.art, ox, oy); c.globalAlpha = 1;
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
    // The board copies the drums' layout: two columns, or three when a drum stands in the middle (hard: five drums).
    const middle = drum => Math.abs(drum.x - midX) < 0.6, cols = b.drums.some(middle) ? 3 : 2, w = cell * cols + gap * (cols + 2);
    c.save(); c.globalAlpha = 0.92; this.rect(cx - cell - gap * 2, top - gap, w, cell * 2 + gap * 3, '#f6ecd2'); c.strokeStyle = '#2b3345'; c.lineWidth = 1; c.strokeRect(Math.round(cx - cell - gap * 2), Math.round(top - gap), Math.round(w), Math.round(cell * 2 + gap * 3)); c.globalAlpha = 1;
    for (const drum of b.drums) {
      const col = middle(drum) ? 1 : drum.x > midX ? cols - 1 : 0, row = drum.y > midY ? 1 : 0, x = cx - cell - gap + col * (cell + gap * 2), y = top + row * (cell + gap);
      const glow = drum.flash > now && !drum.done ? Math.min(1, (drum.flash - now) / (rule.showStep * 0.8) / 0.35) : 0;
      if (glow) { c.fillStyle = `rgba(255, 210, 87, ${0.9 * glow})`; c.fillRect(Math.round(x - 2), Math.round(y - 2), cell + 4, cell + 4); }
      if (drumArt) c.drawImage(drumArt, Math.round(x), Math.round(y - (glow ? 2 : 0)), cell, cell); else this.rect(x + 3, y + 5, cell - 6, cell - 8, '#c43c36');
      if (glow) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 * glow; if (drumArt) c.drawImage(drumArt, Math.round(x), Math.round(y - 2), cell, cell); c.restore(); }
      if (drum.done) { c.fillStyle = '#4f8a4acc'; c.fillRect(Math.round(x), Math.round(y), cell, cell); this.text('✓', x + cell / 2, y + cell - 2, '#fff4d6', 9); }
    }
    c.restore();
  }
  drawPhaseBreak(enemy) {
    const c = this.ctx, g = this.game, b = enemy.breaking, rule = g.breakRule(enemy, b.index), x = enemy.x * 20, y = enemy.y * 20, now = g.s.time;
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
        if (can.back) { c.fillStyle = can.bomb ? '#e0564c66' : '#ffd25766'; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); }
        // A bomb can: a red body with a sparking fuse, so it reads apart from the silver ones at a glance.
        if (can.bomb) {
          // The bomb stays upright so its fuse reads; its spark flickers.
          c.rotate(-can.spin);
          if (!this.drawFxFrame('rocoCanBomb', 0, 0, 0, { sx: CAN_SCALE, sy: CAN_SCALE })) { this.rect(-5, -6, 10, 12, '#2b3345'); this.rect(-4, -5, 8, 10, '#c8463c'); this.rect(-4, -1, 8, 2, '#f6ecd2'); this.rect(-1, -10, 2, 4, '#5c4630'); }
          const spark = Math.floor(now * 16) % 2; this.circle(4.5, -9.5, spark ? 2.5 : 1.5, spark ? '#ffd257' : '#ff8a3c');
          c.restore(); continue;
        }
        if (!this.drawFxFrame('rocoCanSilver', 0, 0, 0, { sx: CAN_SCALE, sy: CAN_SCALE }) && !this.drawFxFrame('rocoCan', now * 8 + can.x, 0, 0)) { this.rect(-4, -5, 8, 10, '#9aa3b5'); this.rect(-4, -2, 8, 3, '#a92f2b'); c.strokeStyle = '#2b3345'; c.lineWidth = 1; c.strokeRect(-4, -5, 8, 10); }
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
      // The soldiers themselves walk among the bodies (marchers); the floor only rings the three to knock down in gold.
      for (const s of b.soldiers) if (s.flag && !s.down) { c.save(); c.strokeStyle = '#ffd257'; c.lineWidth = 2; c.globalAlpha = 0.6 + 0.3 * Math.sin(now * 6); c.beginPath(); c.ellipse(s.x * 20, s.y * 20, 13, 13 * FLOOR_FLAT, 0, 0, TAU); c.stroke(); c.restore(); }
    }
    // The shield itself is drawn on the body: a blue rim (drawOutline in SHIELD_RIM) and a blue sheen (shieldSheen).
    c.restore();
  }
  /**
   * The freight lift at the way out of a factory floor's last room (maps.json maps[room].lift): shut with a red lamp
   * through the fight; once the room is clear and F2 comes within LIFT_OPEN_REACH of the way out, its lattice gate
   * folds open (half, then open) and the lamp turns green. The yellow portal ring in front of it still takes her on.
   */
  liftProp(g) {
    const lift = g.map.lift, key = `${g.s.run.id}:${g.s.run.node}`;
    if (this.liftKey !== key) { this.liftKey = key; this.liftOpenedAt = null; }
    const portal = g.portal, near = Math.hypot(g.p.x - portal.x, g.p.y - portal.y) < LIFT_OPEN_REACH;
    if (g.s.mode === 'route' && near && this.liftOpenedAt === null) { this.liftOpenedAt = this.visualTime; g.sense?.({ kind: 'block' }); }
    const since = this.liftOpenedAt === null ? -1 : this.visualTime - this.liftOpenedAt;
    return { image: LIFT_ART[since < 0 ? 'closed' : since < LIFT_HALF_SECONDS ? 'half' : 'open'], x: lift.x, y: lift.y, scale: 1, lamp: since < 0 ? '#ff4a3c' : '#5be07a' };
  }
  /**
   * The lift's three cables carried on up past its frame to the top of the map, or to maps.json lift.cableTop (in units)
   * where a map paints something they could hang from (2026-11-10: they ended in mid-air at the frame's top). The picture's
   * own top LIFT_CABLE_REPEAT rows of cable, one twist of the rope, are laid end to end upward.
   */
  liftCables(prop) {
    const picture = this.mapImages.get(prop.image); if (!picture) return;
    const c = this.ctx, [x0, x1] = LIFT_CABLE_SPAN, w = (x1 - x0) / 2, piece = LIFT_CABLE_REPEAT / 2;
    const top = prop.y * 20 - picture.height / 2, left = prop.x * 20 - picture.width / 4 + x0 / 2, end = (this.game.map?.lift?.cableTop ?? 0) * 20;
    c.save(); c.imageSmoothingEnabled = false;
    for (let y = top - piece; y > end - piece; y -= piece) {
      const cut = Math.max(0, end - y);
      c.drawImage(picture, x0, cut * 2, x1 - x0, LIFT_CABLE_REPEAT - cut * 2, left, y + cut, w, piece - cut);
    }
    c.restore();
  }
  /** The lift's signal lamp, top left of its frame (16, 50 picture pixels in): a small glow in its colour. */
  liftLamp(prop) {
    const image = this.mapImages.get(prop.image); if (!image) return;
    const x = prop.x * 20 - image.width / 4 + 8, y = prop.y * 20 - image.height / 2 + 25, c = this.ctx;
    c.save(); c.globalAlpha = 0.55 + 0.25 * Math.sin(this.visualTime * 5); c.fillStyle = prop.lamp; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); c.globalAlpha = 1; this.circle(x, y, 2.2, '#fff4d6'); c.restore();
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
  /** Three screw-head stars circling over a stunned head (PixelLab); nothing while the picture is missing. */
  drawDaze(x, y) {
    for (let i = 0; i < 3; i++) { const a = this.visualTime * 4 + i * TAU / 3; this.drawMark('dazeStar', x + Math.cos(a) * 11, y + Math.sin(a) * 3.5, 9, { alpha: Math.sin(a) > -0.3 ? 1 : 0.6 }); }
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
  zigzag(x1, y1, x2, y2, seed, size = 1, edge = size > 1) {
    const c = this.ctx, n = 6, wobble = k => { const v = Math.sin(k * 91.7) * 43758.5; return v - Math.floor(v) - 0.5; };
    const pts = Array.from({ length: n }, (_, i) => { const t = (i + 1) / n, j = i < n - 1 ? 10 * size : 0; return [x1 + (x2 - x1) * t + wobble(seed + i * 7.3) * j, y1 + (y2 - y1) * t + wobble(seed + i * 3.1 + 5) * j]; });
    // `edge`: a thin navy outline, as the painted effects have.
    const strokes = edge ? [[2.2 * size + 1.6, '#2b3345'], [2.2 * size, '#fff8cf'], [size, '#ffd257']] : [[3 * size, '#fff8cf'], [1.2 * size, '#ffd257']];
    for (const [w, col] of strokes) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); for (const [px, py] of pts) c.lineTo(px, py); c.stroke(); }
  }
  /** The picture an effect asks for by `look`; false while its sheet is not loaded, so the plain shape is drawn. */
  drawLook(fx, x, y, t) {
    const g = this.game, frameAt = name => t * FX[name].frames;
    switch (fx.look) {
      // Sound and water: painted sheets, with the code-drawn shapes as the fallback while a sheet loads.
      // Painted where the sheet is loaded, drawn in code until then.
      case 'splash': return this.drawFxFrame('waterSplash', frameAt('waterSplash'), x, y, { sx: 0.3 + fx.value * 0.25, sy: 0.3 + fx.value * 0.25 }) || this.drawSplash(x, y, fx.angle || 0, t, fx.value);
      case 'steamPuff': return this.drawFxFrame('steamPuff', Math.min(FX.steamPuff.frames - 1, t * FX.steamPuff.frames), x, y) || this.drawSteamPuff(x, y, t);
      case 'resonanceBurst': { const k = fx.burst ?? fx.value * 20 / 52; return this.drawFxFrame('resonanceBurst', frameAt('resonanceBurst'), x, y, { sx: k, sy: k }) || this.drawResonanceBurst(x, y, t, fx.value, fx.color); }
      case 'overheatBurst': { const k = fx.value * 20 / 48; return this.drawFxFrame('overheatBurst', frameAt('overheatBurst'), x, y, { sx: k, sy: k }) || this.drawResonanceBurst(x, y, t, fx.value, '#ef8a61'); }
      // The painted wave reaches 106 px from the palm: sized to the cone's range plus a body, a little taller for its 110° arc.
      case 'ringPalm': { const k = (fx.value + 0.4) * 20 / 106; return this.drawFxFrame('ringPalm', frameAt('ringPalm'), x, y - 10, { angle: fx.angle, sx: k, sy: k * 1.1 }); }
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
      // Chapter 2 (PixelLab stills, moved here): a laser strip stretched along the beam, the tape measure shooting out
      // with its hook, an oil can or brass plate tossed in an arc, a stamp's dust ring, a fail-tag blast, the re-inspect seal.
      // Iris's searchlight shot (PixelLab, 2026-11-08): lens flare at her end, a white-hot core to the far end.
      case 'searchlight': case 'laser': {
        const image = this.mark(fx.look === 'searchlight' ? 'searchBeam' : 'laserBeam') || this.mark('laserBeam'); if (!image) return false;
        const c = this.ctx, sy = y - 14, tx = fx.targetX * 20, ty = fx.targetY * 20 - 8, len = Math.hypot(tx - x, ty - sy), thick = image.height * (1.2 - t * 0.6);
        c.save(); c.globalAlpha *= 1 - t * t; c.translate(x, sy); c.rotate(Math.atan2(ty - sy, tx - x)); c.imageSmoothingEnabled = false;
        c.drawImage(image, 0, -thick / 2, len, thick); c.restore(); return true;
      }
      case 'measure': {
        if (!this.mark('measureHook')) return false;
        const c = this.ctx, sy = y - 12, tx = fx.targetX * 20, ty = fx.targetY * 20 - 8, a = Math.atan2(ty - sy, tx - x), reach = t < 0.45 ? Math.min(1, t / 0.2) : Math.max(0, 1 - (t - 0.45) / 0.55);
        const hx = x + (tx - x) * reach, hy = sy + (ty - sy) * reach;
        c.save(); c.lineCap = 'butt'; c.strokeStyle = '#2b3345'; c.lineWidth = 6; c.beginPath(); c.moveTo(x, sy); c.lineTo(hx, hy); c.stroke();
        c.strokeStyle = '#f2c230'; c.lineWidth = 4; c.stroke(); c.setLineDash([1, 5]); c.strokeStyle = '#2b3345'; c.lineWidth = 3; c.stroke(); c.restore();
        return this.drawMark('measureHook', hx, hy, 20, { angle: a });
      }
      case 'oilCan': case 'brassPlate': {
        const tx = fx.targetX * 20, ty = fx.targetY * 20, k = Math.min(1, t * 1.25), arc = Math.sin(k * Math.PI) * 40;
        return this.drawMark(fx.look, x + (tx - x) * k, y + (ty - y) * k - 14 - arc, fx.look === 'oilCan' ? 18 : 13, { angle: k * 9, alpha: k < 1 ? 1 : 0 });
      }
      case 'stampHit': return this.drawMark('stampImpact', x, y, fx.value * 20 * 2 * (0.65 + 0.45 * t), { alpha: 1 - t * t });
      case 'failBlast': return this.drawMark('failBlast', x, y - 16, 44 * (0.7 + 0.6 * t), { alpha: 1 - t * t });
      case 'reinspect': { const k = t < 0.18 ? 2.2 - 1.2 * t / 0.18 : 1; return this.drawMark('reinspectSeal', x, y - 30, 34 * k, { alpha: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3 }); }
      case 'quake': { const k = fx.value * 20 / 44; return this.drawFxFrame('groundShockwave', frameAt('groundShockwave'), x, y, { sx: k, sy: k, alpha: 0.85 }); }
      case 'boom': { const k = Math.max(1, fx.value * 20 / 20); return this.drawFxFrame('ratExplosion', frameAt('ratExplosion'), x, y + 4, { sx: k, sy: k }); }
      case 'wave': { const k = Math.max(0.7, fx.value * 20 / 84); return this.drawFxFrame('trumpetWave', frameAt('trumpetWave'), x, y - 10, { angle: fx.angle, sx: k, sy: k }); }
      // The flame sweep grows with the skill's reach: 1.6 at the old 3 units (2026-11-10: reach 3 -> 3.4, picture kept to it).
      case 'heatSwing': { const k = 1.6 * (fx.value || 3) / 3; return this.drawFxFrame('heatSwing', frameAt('heatSwing'), x, y - 10, { angle: fx.angle, sx: k, sy: k }); }
      case 'deflect': return this.drawFxFrame('deflectFlash', frameAt('deflectFlash'), x, y - 8);
      case 'ready': { const at = fx.follow ? g.p : fx; return this.drawFxFrame('readyPop', frameAt('readyPop'), at.x * 20, at.y * 20 - 34); }
      // Drawn a little smaller than the blast's reach (asked 2026-11-09); the damage radius is unchanged.
      case 'crateBlast': { const k = fx.value * 20 / 44 * CRATE_BLAST_DRAWN; return this.drawFxFrame('crateBlast', frameAt('crateBlast'), x, y, { sx: k, sy: k }); }
      case 'plateFlare': { const at = fx.follow ? g.p : fx; return this.drawFxFrame('plateFlare', Math.min(FX.plateFlare.frames - 1, t * FX.plateFlare.frames), at.x * 20, at.y * 20); }
      case 'mend': { const at = fx.follow ? g.p : fx; return this.drawFxFrame('mendBurst', frameAt('mendBurst'), at.x * 20, at.y * 20); }
      case 'zap': return this.drawFxFrame('electricHit', frameAt('electricHit'), x, y - 24);
      case 'zapBig': return this.drawFxFrame('electricHit', frameAt('electricHit'), x, y - 20, { sx: 1.8, sy: 1.8 });
      case 'gust': return this.drawFxFrame('pressureDash', this.visualTime * 12, x, y - 12, { angle: fx.angle, sx: 0.6, sy: 0.6, alpha: 1 - t });
      case 'frostShatter': return this.drawFxFrame('frostShatter', frameAt('frostShatter'), x, y - 24);
      case 'frostCrescentBreak': return this.drawFxFrame('frostCrescentBreak', frameAt('frostCrescentBreak'), x, y - CRESCENT_LIFT, { angle: fx.angle, sx: CRESCENT_SCALE, sy: CRESCENT_SCALE }) || this.drawFxFrame('frostShatter', frameAt('frostShatter'), x, y - 24);
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
      // The streak is drawn for a dash 0.7 wide; a wider one (pressureDash radius) widens it to match.
      case 'dash': { const k = (fx.value || DASH_DRAWN_RADIUS) / DASH_DRAWN_RADIUS; return this.drawFxFrame('pressureDash', this.visualTime * 12, g.p.x * 20, g.p.y * 20 - 12, { angle: fx.angle, sy: k, alpha: 1 - t * 0.6 }); }
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
        if (t < 0.35) this.drawFxFrame('conductiveSpanner', this.visualTime * 12, sx + (tx - sx) * fly, sy + (ty - sy) * fly, { angle: Math.atan2(ty - sy, tx - sx), sx: 1.5, sy: 1.5 });
        else {
          const k = (t - 0.35) / 0.65;
          this.drawFxFrame('electricHit', k * FX.electricHit.frames, tx, ty, { sx: 1.6, sy: 1.6 });
          for (const [i, e] of (fx.chain || []).entries()) { const ex = e.x * 20, ey = e.y * 20 - 24; if (k < 0.6) this.zigzag(tx, ty, ex, ey, Math.floor(this.visualTime * 20) + i * 13, 1, true); this.drawFxFrame('electricHit', Math.max(0, k - 0.1) * FX.electricHit.frames, ex, ey, { sx: 1.4, sy: 1.4 }); }
        }
        return true;
      }
    }
    return false;
  }
  /** One of F2's shots in flight: a frost lance along its path, a small spinning chip for a shard, a plain pellet otherwise. */
  drawBolt(bullet, cast) {
    const c = this.ctx, x = bullet.x * 20, y = bullet.y * 20 - 8;
    if (bullet.shard) {
      if (this.drawFxFrame('frostBolt', this.visualTime * 12, x, y, { angle: bullet.angle, sx: 0.55, sy: 0.55 })) return;
      const r = 3; c.save(); c.translate(x, y); c.rotate(this.visualTime * 12); c.fillStyle = '#d7f3fb'; c.strokeStyle = '#3f8fb0'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath(); c.fill(); c.stroke(); c.restore();
      return;
    }
    if (cast.skillId === 'frostBolt' && this.drawFxFrame('frostBolt', this.visualTime * 12, x, y, { angle: bullet.angle })) return;
    if (cast.skillId === 'waterCannon') return this.drawFxFrame('waterShot', this.visualTime * 12, x, y, { angle: bullet.angle, sx: 0.5, sy: 0.5 }) || this.drawWaterShot(x, y, bullet.angle);
    this.circle(bullet.x * 20, bullet.y * 20, 4, cast.color); this.rect(bullet.x * 20 - 2, bullet.y * 20 - 2, 4, 4, '#e7fbec');
  }
  // ---- Sound and water, drawn in code (2026-11-08) until PixelLab sheets replace them. ----
  /** 물대포: a round-headed blob of water with a tapering tail and a white glint. */
  drawWaterShot(x, y, angle) {
    const c = this.ctx, back = angle + Math.PI;
    for (let i = 3; i >= 1; i--) { c.globalAlpha = 0.25 + 0.15 * (3 - i); this.circle(x + Math.cos(back) * i * 5, y + Math.sin(back) * i * 5, 6 - i * 1.3, '#7fd0dc'); }
    c.globalAlpha = 1; this.circle(x, y, 8, '#2b3345'); this.circle(x, y, 7, '#3f9fb5'); this.circle(x - 1.5, y - 1.5, 4.5, '#7fd0dc'); this.circle(x - 3, y - 3, 1.6, '#ffffff');
  }
  /** Water breaking on a body or a wall: drops flung back the way the stream came. */
  drawSplash(x, y, angle, t, size = 0.6) {
    const c = this.ctx;
    c.save(); c.globalAlpha = 1 - t * t;
    for (let i = 0; i < 6; i++) { const a = angle + (i - 2.5) * 0.45, out = (6 + 14 * t) * size * 1.6, lift = 10 * t - 14 * t * t; this.circle(x + Math.cos(a) * out, y - 12 + Math.sin(a) * out * 0.6 - lift, 2.2 - t, i % 2 ? '#d8f6f8' : '#7fd0dc'); }
    c.restore(); return true;
  }
  /** Water putting out a fire: a white puff rising and spreading. */
  drawSteamPuff(x, y, t) {
    const c = this.ctx;
    c.save(); c.globalAlpha = 0.8 * (1 - t);
    for (let i = 0; i < 4; i++) this.circle(x + (i - 1.5) * 6 * (0.6 + t), y - 18 - t * 16 - (i % 2) * 4, 5 + t * 5, '#eef6f6');
    c.restore(); return true;
  }
  /** Resonance collapse: two cream rings bursting out on the floor and a brass flash on the body. */
  drawResonanceBurst(x, y, t, radius, color = '#e0a43c') {
    const c = this.ctx, r = radius * 20 * (0.3 + 0.7 * t);
    c.save(); c.globalAlpha = 1 - t;
    for (const [k, w, col] of [[1, 4, '#2b3345'], [1, 2, '#f4ead2'], [0.6, 2, color]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.ellipse(x, y, r * k, r * k * FLOOR_FLAT, 0, 0, TAU); c.stroke(); }
    if (t < 0.4) { c.globalAlpha = 1 - t / 0.4; this.circle(x, y - 16, 10 * (1 - t), '#fff4b7'); }
    c.restore(); return true;
  }
  /** 굉음 let go: a straight column of sound out to its range, wider and brighter the longer it was gathered. */
  drawSoundBeam(fx, x, y, t) {
    // The painted beam, stretched to the column's length and thicker the longer it was gathered.
    if (this.drawFxFrame('roarBeam', t * FX.roarBeam.frames, x, y - 14, { angle: fx.angle, sx: fx.value * 20 / 225, sy: 0.45 + 0.35 * fx.power })) return;
    const c = this.ctx, len = fx.value * 20, w = fx.halfWidth * 20 * (0.6 + 0.4 * fx.power), y0 = y - 14;
    c.save(); c.translate(x, y0); c.rotate(fx.angle); c.globalAlpha = 1 - t * t;
    c.fillStyle = 'rgba(224, 164, 60, 0.35)'; c.fillRect(0, -w, len, w * 2);
    c.fillStyle = '#fff4b7'; c.fillRect(0, -w * 0.25, len, w * 0.5);
    // Rings travel down the column like sound fronts.
    for (let i = 0; i < 4; i++) { const at = ((i / 4 + t * 1.5) % 1) * len; for (const [lw, col] of [[4, '#2b3345'], [2, '#f4ead2']]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(at, 0, 3, w * 1.15, 0, 0, TAU); c.stroke(); } }
    c.restore();
  }
  /** F2's held skills: rings closing in on her while 굉음 gathers, and 고압 분사's stream from her hand to where it lands. */
  drawHeldSkills() {
    const g = this.game, s = g.s, c = this.ctx, p = g.p;
    if (p.charging) {
      const charge = g.chargeRule(p.charging.skillId).charge || 1, k = Math.min(1, (s.time - p.charging.started) / charge), x = p.x * 20, y = p.y * 20 - 18;
      c.save();
      for (let i = 0; i < 3; i++) { const r = 26 * (1 - ((this.visualTime * 1.8 + i / 3) % 1)) + 6; c.globalAlpha = 0.35 + 0.5 * k; c.strokeStyle = '#f4ead2'; c.lineWidth = 1.5 + k; c.beginPath(); c.ellipse(x, y + 8, r, r * 0.55, 0, 0, TAU); c.stroke(); }
      // A small gauge under her feet fills as the charge gathers.
      c.globalAlpha = 1; this.rect(x - 13, p.y * 20 + 6, 26, 5, '#2b3345'); this.rect(x - 12, p.y * 20 + 7, 24 * k, 3, k >= 1 ? '#fff4b7' : '#e0a43c');
      c.restore();
    }
    for (const cast of s.casts.filter(k => k.shape === 'jet' && k.endX !== undefined)) this.drawStream(cast);
    this.drawFusionMarks();
  }
  /**
   * The painted stream (FX hydroStream) from x0, y0 to x1, y1 at half size: the gush and the tip as drawn, the middle
   * stretched or cut to fit; a stream shorter than both ends squeezes them. False until the sheet is loaded.
   */
  drawPaintedStream(x0, y0, x1, y1, thick = 1) {
    const fx = FX.hydroStream, image = this.mapImages?.get(fx.sheet), length = Math.hypot(x1 - x0, y1 - y0) / STREAM_SCALE;
    if (!image || length < 1) return false;
    const f = Math.floor(this.visualTime * 14) % fx.frames, left = (f % fx.cols) * fx.w, top = Math.floor(f / fx.cols) * fx.h, c = this.ctx;
    const [head, tail] = fx.ends, squeeze = Math.min(1, length / (head + tail)), middle = Math.max(0, length - head - tail);
    const piece = (from, width, at, drawn) => c.drawImage(image, left + from, top, width, fx.h, at, -fx.anchor[1], drawn, fx.h);
    c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0)); c.scale(STREAM_SCALE, STREAM_THICKNESS * thick);
    piece(0, head, 0, head * squeeze);
    if (middle > 0) piece(head, fx.w - head - tail, head, middle);
    piece(fx.w - tail, tail, head * squeeze + middle, tail * squeeze);
    c.restore(); return true;
  }
  /** 고압 분사's stream from F2's hand to where it lands, in code until its painted sheet is loaded. */
  drawStream(cast) {
    const hand = STREAM_HANDS[nearestDirection(cast.angle)], c = this.ctx, p = this.game.p, x0 = p.x * 20 + hand[0], y0 = p.y * 20 + hand[1], x1 = cast.endX * 20, y1 = cast.endY * 20 - 12;
    // 넓은 노즐 draws the stream as much thicker as it is wider.
    const thick = cast.halfWidth / STREAM_HALF_WIDTH;
    if (this.drawPaintedStream(x0, y0, x1, y1, thick)) return;
    const len = Math.hypot(x1 - x0, y1 - y0), wob = i => Math.sin(this.visualTime * 30 + i * 1.7) * 1.6, nx = -Math.sin(cast.angle), ny = Math.cos(cast.angle);
    const colors = ['#2b3345', '#3f9fb5', '#7fd0dc', '#ffffff'];
    const n = Math.max(2, Math.round(len / 10)), at = i => { const k = i / n, w = i < n ? wob(i) : 0; return [x0 + (x1 - x0) * k + nx * w, y0 + (y1 - y0) * k + ny * w]; };
    c.save(); c.lineCap = 'round';
    for (const [w, col] of [[6, colors[0]], [4, colors[1]], [2, colors[2]], [1, colors[3]]]) {
      c.strokeStyle = col; c.lineWidth = w * thick; c.beginPath(); c.moveTo(x0, y0);
      for (let i = 1; i <= n; i++) c.lineTo(...at(i));
      c.stroke();
    }
    c.restore();
  }
  /** Fusion bits that stand over the bodies: 과열 공진's marks, 공명 낙뢰's ringing body, 메아리 돌풍's ring, 과열 증기막, 물기둥 회오리. */
  drawFusionMarks() {
    const g = this.game, s = g.s, c = this.ctx, p = g.p;
    c.save();
    for (const cast of s.casts) {
      // A painted cast sheet (game-clips.json castEffects) replaces the code drawing below once it is loaded.
      if (this.castSheet(cast.skillId)) continue;
      if (cast.shape === 'speaker' && cast.bolted && cast.left > 0) {
        const x = cast.x * 20, y = cast.y * 20;
        for (let i = 0; i < 3; i++) { const k = (this.visualTime * 1.6 + i / 3) % 1, r = (0.4 + k * 0.6) * cast.radius * 20; c.globalAlpha = 0.7 * (1 - k); c.strokeStyle = i % 2 ? '#ffe086' : '#f4ead2'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU); c.stroke(); }
      }
      if (cast.shape === 'echo' && cast.age >= cast.delay) {
        // Coming back, the ring faces the way it travels: home.
        const x = cast.x * 20, y = cast.y * 20 - 14, w = cast.halfWidth * 20, heading = cast.outbound ? cast.angle : cast.angle + Math.PI;
        if (this.drawFxFrame('echoRing', this.visualTime * 12, x, y, { angle: heading, sx: w / 40, sy: w / 40 })) continue;
        c.save(); c.translate(x, y); c.rotate(heading); c.globalAlpha = 0.95;
        for (const [lw, col] of [[4, '#2b3345'], [2, cast.outbound ? '#f4ead2' : '#89bea0']]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(0, 0, 5, w, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(-6, 0, 3, w * 0.7, 0, 0, TAU); c.stroke(); }
        c.restore();
      }
      // 과열 증기막: puffs of hot steam turning round F2.
      if (cast.shape === 'veil') {
        const fade = Math.min(1, (cast.duration - cast.age) / 0.4, cast.age / 0.15), r = cast.radius * 20;
        for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + this.visualTime * 1.8, k = 0.55 + 0.45 * ((i * 0.37 + this.visualTime * 0.9) % 1); c.globalAlpha = 0.55 * fade; this.circle(cast.x * 20 + Math.cos(a) * r * k, cast.y * 20 - 10 + Math.sin(a) * r * k * FLOOR_FLAT, 5 + (i % 3) * 2, i % 4 ? '#f4f4ee' : '#ffd2a8'); }
      }
      // 물기둥 회오리: a column of whirling water standing on its spot.
      if (cast.shape === 'spout' && !cast.slammed) {
        const x = cast.x * 20, y = cast.y * 20, h = 70, w = cast.radius * 12, grow = Math.min(1, cast.age / 0.3);
        c.globalAlpha = 0.45; c.fillStyle = '#3f9fb5'; c.beginPath(); c.moveTo(x - w * 0.5, y); c.lineTo(x - w, y - h * grow); c.lineTo(x + w, y - h * grow); c.lineTo(x + w * 0.5, y); c.closePath(); c.fill();
        for (let i = 0; i < 6; i++) { const k = (this.visualTime * 1.2 + i / 6) % 1, ry = y - k * h * grow, rx = w * (0.5 + 0.5 * k); c.globalAlpha = 0.8 * (1 - k * 0.5); c.strokeStyle = i % 2 ? '#d8f6f8' : '#7fd0dc'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, ry, rx, rx * 0.3, 0, 0, TAU); c.stroke(); }
      }
    }
    c.restore();
  }
  /** On the floor: 수면 공명's film of water, 감전 웅덩이's charged puddle, and the ground under 물기둥 회오리. */
  /** True once a cast's painted sheet (game-clips.json castEffects) is loaded, so its code drawing steps aside. */
  castSheet(skillId) { const effect = this.castEffects?.effects?.[skillId]; return !!effect && !!this.sprites?.image(effect.sheet); }
  drawFusionFloor(cast) {
    // 과열 공진: under each marked body, the painted fire landing mark, its ring closing in on that body's burst.
    if (cast.shape === 'marks') {
      for (const mark of cast.marks.filter(m => !m.done)) {
        const e = this.game.s.enemies.find(b => b.id === mark.id && b.hp > 0);
        if (e) this.drawLandingMark({ value: cast.radius, color: '#ef8a61', mark: 'fire' }, e.x * 20, e.y * 20, Math.min(1, cast.age / mark.at));
      }
      return;
    }
    if (this.castSheet(cast.skillId)) return;
    const c = this.ctx, x = cast.x * 20, y = cast.y * 20, r = cast.radius * 20, ellipse = (k = 1) => { c.beginPath(); c.ellipse(x, y, r * k, r * k * FLOOR_FLAT, 0, 0, TAU); };
    c.save();
    if (cast.shape === 'film') {
      const fade = Math.min(1, (cast.duration - cast.age) / 0.5, cast.age / 0.2), flash = Math.max(0, 1 - (this.game.s.time - cast.lastRing) / 0.3);
      c.globalAlpha = (0.28 + 0.25 * flash) * fade; c.fillStyle = '#3f9fb5'; ellipse(); c.fill();
      c.globalAlpha = 0.8 * fade; c.strokeStyle = flash ? '#f4ead2' : '#d8f6f8'; c.lineWidth = 1.5 + flash * 2; ellipse(); c.stroke();
      // Ripples: one ring of light for each ring left in the film.
      for (let i = 0; i < cast.hits - cast.rings; i++) { const k = ((this.visualTime * 0.6 + i / (cast.hits || 1)) % 1); c.globalAlpha = 0.35 * fade * (1 - k); c.strokeStyle = '#d8f6f8'; c.lineWidth = 1; ellipse(k); c.stroke(); }
    }
    if (cast.shape === 'pool') {
      const fade = Math.min(1, (cast.duration + cast.delay - cast.age) / 0.4, cast.age / 0.15), flash = Math.max(0, 1 - (this.game.s.time - (cast.flashAt ?? -9)) / 0.25);
      c.globalAlpha = 0.4 * fade; c.fillStyle = '#2a6d86'; ellipse(); c.fill();
      c.globalAlpha = (0.5 + 0.5 * flash) * fade; c.strokeStyle = flash ? '#ffe086' : '#7fd0dc'; c.lineWidth = 1.5 + flash * 2; ellipse(); c.stroke();
      // Sparks run over the water between discharges.
      for (let i = 0; i < 5; i++) { const a = i * 1.9 + this.visualTime * 5, k = 0.3 + 0.6 * ((i * 0.41 + this.visualTime) % 1); c.globalAlpha = 0.9 * fade; this.rect(x + Math.cos(a) * r * k - 1, y + Math.sin(a) * r * k * FLOOR_FLAT - 1, 2, 2, '#ffe086'); }
    }
    if (cast.shape === 'spout' && !cast.slammed) { c.globalAlpha = 0.3; c.fillStyle = '#3f9fb5'; ellipse(); c.fill(); c.globalAlpha = 0.7; c.strokeStyle = '#d8f6f8'; c.lineWidth = 1; ellipse(0.6 + 0.3 * Math.sin(this.visualTime * 6)); c.stroke(); }
    c.restore();
  }
  drawCastEffect({ effect, frame, x, y, lift }) {
    // `flat` squashes a round picture onto the floor (과열 증기막's ring of steam), about its anchor.
    const { frameWidth: w, frameHeight: h, columns, anchor, scale = 1, flat = 1 } = effect, size = scale / 2, left = Math.round((x * 20 - anchor[0] * size) * 2) / 2, top = Math.round(((y - lift) * 20 - anchor[1] * size * flat) * 2) / 2;
    const image = this.sprites.image(effect.sheet);
    if (!image) return;
    this.ctx.drawImage(image, frame % columns * w, Math.floor(frame / columns) * h, w, h, left, top, w * size, h * size * flat);
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
  /**
   * A fallen body's parts: small cogs, bolts, springs and plates of its colour thrown away from F2, arcing up,
   * bouncing once on the floor and fading. `fx.value` is how many; each piece's path is fixed by its effect's id.
   */
  drawParts(fx, x, y, t) {
    let seed = 7; for (const ch of String(fx.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
    const scale = fx.big ? 2.1 : 1.5, c = this.ctx, fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    c.save(); c.globalAlpha *= fade;
    for (let i = 0; i < fx.value; i++) {
      // Most fly on, away from F2; every fourth scatters any way.
      const spread = i % 4 === 3 ? (rand() * 2 - 1) * Math.PI : (rand() * 2 - 1) * 0.9, dir = (fx.angle ?? 0) + spread;
      const reach = (22 + rand() * 34) * scale, height = (16 + rand() * 22) * scale, spin = (rand() * 2 - 1) * 14;
      const travel = 1 - (1 - Math.min(1, t * 1.25)) ** 2, d = reach * travel;
      // Up and down once, then a small hop, then lying still.
      const first = 0.55, hop = (t - first) / 0.25;
      const lift = t < first ? 4 * height * (t / first) * (1 - t / first) : t < 0.8 ? 4 * height * 0.22 * hop * (1 - hop) : 0;
      const px = x + Math.cos(dir) * d, py = y - 12 * scale * (1 - travel) + Math.sin(dir) * d * 0.55 - lift, turn = spin * Math.min(t, 0.8);
      const kind = i % 4, art = this.mapImages?.get(DEBRIS_ART[kind]);
      // The PixelLab part (cog, bolt, spring, casing plate), turning as it flies; the old drawn shapes while it loads.
      if (art) { const size = 7 * scale; c.save(); c.translate(px, py); c.rotate(turn); c.imageSmoothingEnabled = false; c.drawImage(art, -size / 2, -size / 2, size, size); c.restore(); continue; }
      if (kind === 0) { this.gear(px, py, 2.6 * scale, '#c79a3e', turn); continue; }
      c.save(); c.translate(px, py); c.rotate(turn);
      if (kind === 1) { this.rect(-2.5 * scale, -1 * scale, 5 * scale, 2 * scale, '#8a8f9c'); this.rect(-3 * scale, -1.5 * scale, 1.5 * scale, 3 * scale, '#5c6170'); }
      else if (kind === 2) { c.strokeStyle = '#b8bcc6'; c.lineWidth = 1.2; c.beginPath(); for (let k = 0; k <= 12; k++) { const a = k / 12 * TAU * 2; c.lineTo(Math.cos(a) * 1.8 * scale, (k * 0.5 - 3) * scale); } c.stroke(); }
      else { this.rect(-2 * scale, -2 * scale, 4 * scale, 3.5 * scale, fx.color); this.rect(-2 * scale, -2 * scale, 4 * scale, 1, '#2b3345'); }
      c.restore();
    }
    c.restore();
  }
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
  drawAlert(enemy, top, size = 1) {
    const x = enemy.x * 20, c = this.ctx;
    c.save(); c.translate(x, top - 8); c.scale(size, size); c.translate(-x, -(top - 8));
    this.rect(x - 4, top - 15, 8, 14, '#2b3345'); this.rect(x - 1.5, top - 13, 3, 6, '#ffd257'); this.rect(x - 1.5, top - 6, 3, 2, '#ffd257');
    c.restore();
  }
  /**
   * Every toy soldier Brass sends marching (his parades and his column), as { x, y, direction } in floor units. They
   * are sorted in among the bodies by depth, so one passing behind F2 is hidden by F2 and one in front covers F2.
   */
  marchers() {
    const g = this.game, out = [];
    // The ring of soldiers round Brass in his second break, walking their circle; the flag bearers carry their flags.
    for (const enemy of g.s.enemies) {
      const b = enemy.breaking, rule = b?.kind === 'flags' && g.breakRule(enemy, b.index);
      if (rule) for (const s of b.soldiers) if (!s.down) { const a = b.turn + s.slot / rule.soldiers * Math.PI * 2; out.push({ x: s.x, y: s.y, direction: nearestDirection(Math.atan2(Math.cos(a) * rule.ry, -Math.sin(a) * rule.rx)), flag: s.flag }); }
    }
    for (const line of g.rankLines) {
      const { a, b, gapA, gapB } = line, { start, end } = line.rank, direction = nearestDirection(Math.atan2(end[0][1] - start[0][1], end[0][0] - start[0][0]));
      for (const [from, to] of [[a, gapA], [gapB, b]]) {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(1, Math.round(length / COLUMN_SPACING_UNITS));
        for (let i = 0; i <= count; i++) out.push({ x: from[0] + (to[0] - from[0]) * i / count, y: from[1] + (to[1] - from[1]) * i / count, direction });
      }
    }
    return out;
  }
  /** 빙풍 절단's blade: the PixelLab ice crescent turned to its heading, at waist height (a code-drawn one until it loads). */
  drawCrescent(cast) {
    if (this.drawFxFrame('frostCrescent', this.visualTime * 14, cast.x * 20, cast.y * 20 - CRESCENT_LIFT, { angle: cast.angle, sx: CRESCENT_SCALE, sy: CRESCENT_SCALE })) return;
    const c = this.ctx, R = cast.halfWidth * 20, T = cast.thickness * 20, ice = ['#1d4f7a', '#2f7fae', '#5fb9d8', '#9fe3f0', '#e9fbff'];
    c.save(); c.translate(cast.x * 20, cast.y * 20 - 14); c.scale(1, 0.72); c.rotate(cast.angle);
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const oy = (i - 2.5) * R * 0.3, len = R * (0.9 + ((i * 37) % 10) / 12); c.strokeStyle = `rgba(214, 240, 232, ${0.75 - Math.abs(i - 2.5) * 0.12})`; c.lineWidth = 2; c.beginPath(); c.moveTo(-len - T, oy); c.lineTo(-T * 0.6, oy); c.stroke(); }
    for (let i = 0; i < ice.length; i++) {
      const t = T * (1 - i / ice.length);
      c.beginPath(); c.arc(0, 0, R, -1.25, 1.25); c.arc(-t, 0, R - t * 0.2, 1.1, -1.1, true); c.closePath(); c.fillStyle = ice[i]; c.fill();
    }
    c.fillStyle = '#ffffff'; for (const [sx, sy] of [[R * 0.35, -R * 0.75], [R * 0.3, R * 0.8], [R * 0.95, 0]]) { c.fillRect(sx - 1, sy - 4, 2, 8); c.fillRect(sx - 4, sy - 1, 8, 2); }
    c.restore();
  }
  /** The frost the blade leaves on the paving behind it, fading. */
  drawCrescentFrost(cast) {
    const c = this.ctx, fx = Math.cos(cast.angle), fy = Math.sin(cast.angle), reach = cast.travel ?? 0;
    for (let d = cast.startDistance || 0; d < reach; d += 0.35) {
      const left = 1 - (cast.age - (cast.delay || 0) - d / cast.speed) / 1.2;
      if (left <= 0) continue;
      for (const side of [-0.6, 0, 0.6]) { const k = (d * 7 + side * 13) % 1; c.fillStyle = `rgba(233, 251, 255, ${Math.min(0.85, left)})`; c.fillRect(Math.round((cast.startX + fx * d - fy * side * cast.halfWidth * (0.6 + k * 0.4)) * 20), Math.round((cast.startY + fy * d + fx * side * cast.halfWidth * (0.6 + k * 0.4)) * 20), 3, 2); }
    }
  }
  drawMarcher({ x, y, direction, flag }) {
    const bearer = flag && this.mapImages?.get(FLAG_BEARER_ART[direction]);
    // A flag bearer is one still per direction (feet at 64, 108 of its 128px picture), bobbing as it walks.
    if (bearer) { const c = this.ctx, bob = Math.abs(Math.sin(this.visualTime * 9)) * 1.5; c.save(); c.imageSmoothingEnabled = false; c.drawImage(bearer, x * 20 - 32, y * 20 - 54 - bob, 64, 64); c.restore(); return; }
    const clip = this.mobSprites?.clip('guard-move', direction), frame = clip ? Math.floor(this.visualTime * 10) % clip.frameCount : 0;
    if (!(clip && this.drawSprite(x * 20, y * 20, { action: 'guard-move', direction, frame }, this.mobSprites))) this.rect(x * 20 - 7, y * 20 - 26, 14, 26, '#dc8b83');
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
        if (!this.drawMark('gearRing', enemy.x * 20, enemy.y * 20, 84, { flat: 0.5, angle: this.visualTime * 2, tint: col })) { c.save(); c.setLineDash([]); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.ellipse(enemy.x * 20, enemy.y * 20, 40, 40 * FLOOR_FLAT, 0, 0, TAU); c.stroke(); c.restore(); }
        this.drawAlert(enemy, enemy.y * 20 - 78);
      }
      if (enemy.bellUntil > s.time && !this.drawMark('gearRing', p.x * 20, p.y * 20, 36, { flat: 0.42, angle: -this.visualTime * 2, tint: '#ffd257' })) { c.save(); c.strokeStyle = '#ffd257'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x * 20, p.y * 20, 16, 7, 0, 0, TAU); c.stroke(); c.restore(); }
    }
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
    // A painted place whose picture is still on its way shows a plain dark frame for that moment, not the old code-drawn
    // street (2026-11-06: the stand-in flashed up between places and looked broken). It is usually a frame or two.
    // Every frame starts from a clean drawing state, so nothing a draw forgot to put back can carry into the next one.
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    if (map?.background && !mapImage) { this.drawWaiting(); return; }
    // Panels over the hub show the spot the player will stand on; everywhere else follows the body.
    const body = hub && !g.village ? map?.spawn : g.p;
    // In a fight the view leans a little the way F2 aims (as in Hades), easing over a quarter second, so more of what
    // is being hit is on screen. Nothing leans in town, in talk, or with reduced motion.
    const lead = this.lead ??= { x: 0, y: 0 }, fighting = ['combat', 'practice'].includes(s.mode) && !this.talking && !s.profile.settings.reducedMotion;
    const toward = this.leanByWalk ? g.p.moveAngle ?? g.p.angle : g.p.angle;
    const want = fighting ? { x: Math.cos(toward) * CAMERA_LEAD[0], y: Math.sin(toward) * CAMERA_LEAD[1] } : { x: 0, y: 0 }, ease = 1 - Math.exp(-delta / CAMERA_LEAD_SECONDS);
    lead.x += (want.x - lead.x) * ease; lead.y += (want.y - lead.y) * ease;
    const focus = body && fighting ? { x: body.x + lead.x, y: body.y + lead.y } : body;
    let follow = this.follow;
    if (focus) {
      if (!follow || follow.map !== map || Math.hypot(focus.x - follow.x, focus.y - follow.y) > CAMERA_SNAP) follow = this.follow = { x: focus.x, y: focus.y, map };
      else {
        const step = 1 - Math.exp(-delta / CAMERA_FOLLOW_SECONDS), off = focus.y - follow.y;
        const wantY = Math.abs(off) <= CAMERA_DEAD_Y ? follow.y : focus.y - Math.sign(off) * CAMERA_DEAD_Y;
        follow.x += (focus.x - follow.x) * step; follow.y += (wantY - follow.y) * step;
      }
    }
    this.camera = mapImage ? cameraFor(focus ? follow : focus, size) : { x: 0, y: 0 };
    // A shake never shows past the map's edge: the camera already stops there, so the shake is cut to what is left of
    // the painting on each side (it used to show a black strip beside the map).
    let [shakeX, shakeY] = this.shakeOffset();
    if (mapImage) {
      const room = (at, length, view) => [at * PIXELS_PER_UNIT - Math.max(0, length - view) * PIXELS_PER_UNIT, at * PIXELS_PER_UNIT];
      const [minX, maxX] = room(this.camera.x, size[0], SCREEN_UNITS[0]), [minY, maxY] = room(this.camera.y, size[1], SCREEN_UNITS[1]);
      shakeX = Math.max(minX, Math.min(maxX, shakeX)); shakeY = Math.max(minY, Math.min(maxY, shakeY));
    }
    // The canvas is backed at screen resolution; k maps the 1120x640 layout onto it, so nothing is stretched twice.
    const pulseLeft = Math.max(0, (this.pulseUntil || 0) - performance.now()) / CRIT_PULSE_MS, punch = this.fusionCalm ? 0 : this.fusionLeft(FUSION_ZOOM_MS);
    // A fusion's lean in rises and settles back within its time.
    const lean = 1 + CRIT_ZOOM * pulseLeft + (punch > 0 ? FUSION_ZOOM * Math.sin(Math.PI * (1 - punch)) : 0);
    const k = this.backing, zoom = 2 * CAMERA_ZOOM * k * lean;
    if (this.letters) { const t = this.letters.getContext('2d'); t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, this.letters.width, this.letters.height); }
    // A crit leans in toward the middle of the screen.
    const centreX = lean !== 1 ? this.canvas.width / 2 * (1 - lean) : 0, centreY = lean !== 1 ? this.canvas.height / 2 * (1 - lean) : 0;
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
    // A fusion dims the floor for a moment, so the blast and the bodies stand out against it.
    const dim = this.fusionLeft(FUSION_DIM_MS);
    if (dim > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = FUSION_DIM * (this.fusionCalm ? 0.6 : 1) * Math.min(1, dim * 2); c.fillStyle = '#0d1020'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    if (s.mode === 'shop' && !mapImage) { this.building(217, 113, 110, 69, '#d9c49a', '볼트의 부품 상점', '#88aaa0'); this.drawDoll(273, 212, { type: 'moru', color: '#c7a968' }); }
    const yardExit = s.mode === 'practice' ? map?.exit.at : null;
    const goal = s.mode === 'route' ? g.portal : yardExit ? { x: yardExit[0], y: yardExit[1] } : ['intro', 'registration'].includes(s.mode) ? g.tutorial.goal : null;
    // The way back to the scrapyard is not marked any more (2026-11-10): it cannot be walked back through, so the yellow ring
    // there only pulled the eye from the arrow to Moru.
    // Once registered, the way out of town to the street is the same yellow portal, not a sign.
    // Every walk-around place shows its way out as the same yellow ring: the village's street and the rest stop's road.
    const streetPortal = ['hub', 'shop'].includes(s.mode) && g.village ? g.village.exit.portal : null;
    for (const spot of [goal, streetPortal]) if (spot) this.marker(spot);
    this.minimapPlace = { map, mapImage, size, goal: goal || streetPortal || (hub && g.village ? { x: map.exit.at[0], y: map.exit.at[1] } : null) };
    this.overlays = [];
    // The floor, bottom to top: flat hazards (plates, saw rails), where F2's fusions and ground skills reach, and over
    // them every enemy warning, so a blast of F2's own never hides what is about to hit her.
    for (const h of g.roomHazards) if (!h.gone && (GROUND.has(h.kind) || TWO_LAYER.has(h.kind))) this.drawHazard(h, 'ground');
    for (const fx of castFx) if (fx.effect.ground) this.drawCastEffect(fx);
    // Reaches painted on the floor stop where the floor does: not over planters, walls or stalls.
    const floorClip = this.clipToFloor(mapImage && map);
    this.drawFusionFloors();
    for (const enemy of s.enemies.filter(e => e.hp > 0)) this.drawTell(enemy);
    // Marks painted on the floor (where a skill lands, a blast's reach, a hatch) lie under every body, like the tells.
    for (const fx of s.effects) if (fx.type === 'friendlyTell' || fx.type === 'danger') { const fraction = Math.min(1, (s.time - fx.created) / fx.duration); if (fx.type === 'danger') this.drawDanger(fx, fx.x * 20, fx.y * 20, fraction); else this.drawLandingMark(fx, fx.x * 20, fx.y * 20, fraction); }
    if (floorClip) c.restore();
    // Bodies hastened and hardened by the drum: a gold ring at the feet and red arrows rising while it lasts.
    for (const fx of s.effects) if (fx.look && GROUND_LOOKS.has(fx.look)) { c.save(); this.drawLook(fx, fx.x * 20, fx.y * 20, Math.min(1, (s.time - fx.created) / fx.duration)); c.restore(); }
    for (const enemy of s.enemies) if (enemy.hp > 0 && enemy.beatUntil > s.time) this.drawFxFrame('drumBuff', this.visualTime * 12 + enemy.x, enemy.x * 20, enemy.y * 20, { alpha: 0.9 });
    for (const enemy of s.enemies) {
      if (enemy.hp <= 0) continue;
      const ex = enemy.x * 20, ey = enemy.y * 20;
      if (enemy.coatedUntil > s.time) this.drawMark('brassPlate', ex + 12, ey - 10, 11, { alpha: 0.75 + Math.sin(this.visualTime * 8) * 0.25 });
      if (enemy.coatedUntil > s.time) { c.save(); c.strokeStyle = '#e0b048'; c.lineWidth = 2; c.globalAlpha = 0.6 + Math.sin(this.visualTime * 8) * 0.25; c.beginPath(); c.ellipse(ex, ey, 13, 5, 0, 0, TAU); c.stroke(); c.restore(); }
      if (enemy.standardRadius) { c.save(); c.setLineDash([4, 4]); c.lineDashOffset = -this.visualTime * 12; c.strokeStyle = 'rgba(199, 154, 62, 0.55)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(ex, ey, enemy.standardRadius * 20, enemy.standardRadius * 20 * FLOOR_FLAT, 0, 0, TAU); c.stroke(); c.restore(); }
    }
    if (g.p.markedUntil > s.time) { const px = g.p.x * 20, py = g.p.y * 20; c.save(); c.strokeStyle = '#ff5a6e'; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.ellipse(px, py, 12, 5, 0, 0, TAU); c.stroke(); c.restore(); }
    for (const enemy of s.enemies.filter(e => e.hp > 0 && e.breaking)) this.drawPhaseBreak(enemy);
    // Bodies being summoned (the first wave as F2 walks in, and later waves): the rift opens on the floor, its light
    // column rises as the body appears, then smoke and the seal. Waiting arrivals and freshly summoned bodies both play it.
    const summons = [...(s.run?.arrivals || []).map(a => ({ x: a.x, y: a.y, at: a.at })), ...s.enemies.filter(e => e.summonedAt).map(e => ({ x: e.home?.x ?? e.x, y: e.home?.y ?? e.y, at: e.summonedAt }))];
    for (const { x: sx, y: sy, at } of summons) {
      const frame = (s.time - (at - SUMMON_RISE_SECONDS)) * 14;
      if (frame >= 0 && frame < FX.summonRift.frames) this.drawFxFrame('summonRift', frame, sx * 20, sy * 20, { sx: 0.5, sy: 0.5 });
    }
    for (const cast of s.casts) if (cast.shape === 'crescent') this.drawCrescentFrost(cast);
    for (const cast of s.casts) if (['film', 'pool', 'spout', 'marks'].includes(cast.shape)) this.drawFusionFloor(cast);
    for (const cast of s.casts) if (cast.shape === 'floorMark') this.drawFloorMark(cast);
    this.drawFactoryBossFloor();
    for (const cast of s.casts) {
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
        this.overlay(() => {
          if (this.drawMark('dial', x, y - 28, 18)) { const a = -Math.PI / 2 + TAU * (1 - Math.min(1, share)); c.save(); c.lineCap = 'round'; for (const [w, col] of [[3, '#2b3345'], [1.5, '#ffe086']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y - 28); c.lineTo(x + Math.cos(a) * 6, y - 28 + Math.sin(a) * 6); c.stroke(); } c.restore(); }
          else { c.save(); c.strokeStyle = '#ffe086'; c.lineWidth = 2; c.globalAlpha = 0.9; c.beginPath(); c.arc(x, y, 6 + 10 * Math.min(1, share), 0, TAU); c.stroke(); c.restore(); }
          if (!this.drawFxFrame('chargeArcs', this.visualTime * 12, x, y - 8)) { c.fillStyle = '#ffe086'; c.fillRect(Math.round(x - 1), Math.round(y - 14), 2, 6); }
        });
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
          c.translate(cast.x * 20, cast.y * 20); c.scale(1, FLOOR_FLAT);
          for (let i = 0; i < 3; i++) { const r = (1 - ((cast.age * 1.6 + i / 3) % 1)) * cast.range * 20; c.beginPath(); c.arc(0, 0, Math.max(4, r), cast.angle - half, cast.angle + half); c.stroke(); }
          c.restore();
        }
      }
      if (cast.shape === 'stompRing' && cast.age >= 0) {
        // A shock ring spreading over the floor as a thin ellipse, the same line all the way out (the stretched sheet thickened
        // as it grew), fading as it goes. Its hit is the same ellipse (floorDistance).
        const r = cast.age * cast.speed * 20, alpha = Math.max(0.25, 1 - r / (cast.reach * 20)), x = cast.x * 20, y = cast.y * 20;
        c.save(); c.globalAlpha = alpha * 0.5; c.strokeStyle = '#2b3345'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU); c.stroke();
        c.globalAlpha = alpha; c.strokeStyle = '#ff9a4a'; c.lineWidth = 2; c.stroke(); c.restore();
      }
      if (cast.shape === 'stickerFall') {
        // Where the next sticker lands: the red danger disc, filling until it hits.
        const clipped = this.clipToFloor(mapImage && map);
        this.dangerDisc(cast.x * 20, cast.y * 20, cast.radius * 20, Math.min(1, cast.age / cast.warn));
        if (clipped) c.restore();
      }
      if (cast.shape === 'sticker') {
        // A paper 'defective' label stuck to the floor, fading as it peels.
        const x = cast.x * 20, y = cast.y * 20, fade = Math.min(1, (cast.duration - cast.age) / 0.6);
        // The sticky patch lies flat on the floor, the same ellipse its slow uses (floorDistance).
        c.save(); c.globalAlpha = 0.22 * fade; c.fillStyle = '#b85863'; c.beginPath(); c.ellipse(x, y, cast.radius * 20, cast.radius * 20 * FLOOR_FLAT, 0, 0, TAU); c.fill(); c.restore();
        // The label drops and slaps onto the floor (PixelLab sheet), then stays as its last frame until it peels.
        if (!this.drawFxFrame('rocoSticker', Math.min(FX.rocoSticker.frames - 1, cast.age * 14), x, y, { alpha: fade })) {
          c.save(); c.globalAlpha = fade; c.translate(x, y); c.rotate(cast.tilt); this.rect(-11, -7, 22, 14, '#f3e6c8'); c.strokeStyle = '#a92f2b'; c.lineWidth = 1.5; c.strokeRect(-11, -7, 22, 14); this.text('불량', 0, 3, '#a92f2b', 8); c.restore();
        }
      }
      if (cast.shape === 'magnet') {
        // Roco's magnet: a purple field turning on the floor, pulling sparks in (PixelLab loop, sized to the pull).
        const k = cast.radius * 20 / 42;
        if (!this.drawFxFrame('magnetField', this.visualTime * 12, cast.x * 20, cast.y * 20, { sx: k, sy: k, alpha: 0.9 })) {
          c.save(); c.globalAlpha = 0.18; c.fillStyle = '#8c638f'; c.beginPath(); c.ellipse(cast.x * 20, cast.y * 20, cast.radius * 20, cast.radius * 20 * FLOOR_FLAT, 0, 0, TAU); c.fill(); c.restore();
          for (let i = 0; i < 3; i++) { c.strokeStyle = '#9d74a1'; const r = ((cast.age + i * 0.5) % 1.5) / 1.5 * cast.radius * 20; c.beginPath(); c.ellipse(cast.x * 20, cast.y * 20, r, r * FLOOR_FLAT, 0, 0, TAU); c.stroke(); }
        }
      }
    }
    const onScreen = ({ polygon }) => polygon.some(([x, y]) => x > this.camera.x - 4 && x < this.camera.x + SCREEN_UNITS[0] + 4 && y > this.camera.y - 4 && y < this.camera.y + SCREEN_UNITS[1] + 4);
    const occluders = mapImage ? (map.occluders || []).filter(onScreen).map(o => ({ y: o.baseY, occluder: o })) : [];
    const depthMask = this.depthMasks?.get(map?.background);
    this.labels = [];
    let playerHidden = 0;
    const props = mapImage ? (map.props || []).map(prop => ({ y: prop.y, prop })) : [];
    const lift = mapImage && g.map?.lift && s.run ? this.liftProp(g) : null;
    if (lift) props.push({ y: lift.y, prop: lift });
        // Effects sort just ahead of a body at the same spot, so a burst never covers the caster's arms and legs; ground effects lie under everyone.
    const effects = castFx.filter(fx => !fx.effect.ground).map(fx => ({ y: fx.y - 0.01, fx }));
    // F2's shots fly at body height, so they pass in front of bodies behind them and behind bodies in front.
    const bolts = s.casts.flatMap(cast => (cast.projectiles || []).filter(bullet => !bullet.done).map(bullet => ({ y: bullet.y, bolt: bullet, cast })));
    const npcs = mapImage && (map.npcs || map.crowd) && this.npcDirector ? this.npcDirector.update(delta, hub ? 'hub' : g.room?.id, map.npcs || [], { crowd: g.data.maps?.crowds?.[map.crowd], lookAt: focus, floor: map.walkable ? map : null, paused: s.paused, reducedMotion: s.profile.settings.reducedMotion, bell: s.mode === 'registration' ? g.tutorial.bell : null }).map(npc => ({ y: npc.y, npc })) : [];
    const hubPlayer = hub && !g.village && mapImage && this.animator ? [{ y: map.spawn.y, hubPlayer: true }] : [];
    // Room hazards: plates and saw rails lie flat under everyone; crates, fences and music boxes stand in the sort.
    const hazards = g.roomHazards.filter(h => !h.gone && !GROUND.has(h.kind)).map(h => ({ y: h.y + (UPPER_Y[h.kind] || 0) + (h.kind === 'crane' && h.mark ? h.mark.y : 0), hazard: h }));
    const actors = [...hazards, ...bolts, ...s.enemies.filter(e => (e.hp > 0 || mobPoses?.has(e.id)) && !(e.summonUntil > s.time)), ...((hub ? g.village && mapImage : s.mode !== 'shop' || mapImage) ? [{ ...g.p, type: 'player', player: true }] : []), ...occluders, ...props, ...effects, ...npcs, ...hubPlayer].sort((a, b) => a.y - b.y);
    // Iris's decoys stand among the bodies (sorted by feet like her), not over them.
    actors.push(...s.enemies.flatMap(e => e.hp > 0 && e.decoys ? e.decoys.filter(d => !d.popped).map(d => ({ y: d.y, decoy: d, owner: e })) : []));
    actors.push(...this.marchers().map(marcher => ({ y: marcher.y, marcher })), ...s.casts.filter(cast => cast.shape === 'crescent' && cast.age >= (cast.delay || 0) && !cast.done).map(cast => ({ y: cast.y, crescent: cast })));
    actors.sort((a, b) => a.y - b.y);
    // Health bars, statuses and trait names are drawn after every body and effect, so nothing walks or bursts over them.
    const labels = [];
    for (const actor of actors) {
      if (actor.marcher) { this.drawMarcher(actor.marcher); continue; }
      if (actor.decoy) { const pose = mobPoses?.get(actor.owner.id); if (!this.fbIrisStill(actor.decoy.x * 20, actor.decoy.y * 20, false) && pose) this.drawSprite(actor.decoy.x * 20, actor.decoy.y * 20, pose, this.mobSprites, false, BOSS_SPRITE_SCALE); continue; }
      if (actor.crescent) { this.drawCrescent(actor.crescent); continue; }
      if (actor.occluder) { this.drawOccluder(mapImage, actor.occluder.polygon, size); continue; }
      if (actor.hazard) { this.drawHazard(actor.hazard); continue; }
      if (actor.prop) { if (actor.prop.lamp) this.liftCables(actor.prop); this.drawProp(actor.prop); if (actor.prop.lamp) this.liftLamp(actor.prop); this.coverBody(depthMask, actor.prop.x, actor.prop.y, 2, 2.6); continue; }
      if (actor.fx) { this.drawCastEffect(actor.fx); continue; }
      if (actor.bolt) { this.drawBolt(actor.bolt, actor.cast); continue; }
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
      const lift = actor.player ? 0 : (actor.lift || 0) * 20;
      if (lift) { c.save(); c.globalAlpha = 0.3; c.fillStyle = '#0e121a'; c.beginPath(); c.ellipse(actor.x * 20, actor.y * 20, 9, 3.5, 0, 0, TAU); c.fill(); c.restore(); }
      // A boss behind its phase-break shield: a blue rim round the body, and a blue sheen sweeping over it (below).
      const shielded = !actor.player && actor.boss && actor.hp > 0 && !!actor.breaking && !!mobPose;
      // A struck mob squashes down onto its feet and springs back (outline, body and sheen together); bosses keep their shape.
      const squash = !actor.player && !actor.boss && !s.profile.settings.reducedMotion ? hitSquash(s.time - (actor.joltUntil - JOLT_SECONDS)) : null;
      if (squash) { const fx = actor.x * 20 + jolt, fy = actor.y * 20 - lift; c.save(); c.translate(fx, fy); c.scale(squash[0], squash[1]); c.translate(-fx, -fy); }
      if (shielded) this.drawOutline(actor.x * 20 + jolt, actor.y * 20 - lift, mobPose, this.mobSprites, BOSS_SPRITE_SCALE, SHIELD_RIM);
      if (!actor.player && actor.affixes?.length && actor.hp > 0 && mobPose) this.drawOutline(actor.x * 20 + jolt, actor.y * 20 - lift, mobPose, this.mobSprites, actor.boss ? BOSS_SPRITE_SCALE : 1, this.affixColors(actor));
      // During her decoys the real Iris stands as the same south-facing still as her copies, only holding the stamp.
      const still = !actor.player && actor.decoys && actor.tell?.type === 'decoys' && this.fbIrisStill(actor.x * 20 + jolt, actor.y * 20 - lift, true, this.hitWhite(actor));
      const drawn = actor.player ? playerPose && this.drawSprite(actor.x * 20, actor.y * 20, playerPose, this.sprites, false, PLAYER_SCALE) : still || mobPose && this.drawSprite(actor.x * 20 + jolt, actor.y * 20 - lift, mobPose, this.mobSprites, this.hitWhite(actor) || this.tellBlink(actor) || (actor.frozenUntil > s.time && FROZEN_LOOK), actor.boss ? BOSS_SPRITE_SCALE : 1);
      if (drawn && shielded) this.shieldSheen(actor.x * 20 + jolt, actor.y * 20 - lift, mobPose, this.mobSprites, BOSS_SPRITE_SCALE);
      if (!drawn) this.drawDoll(actor.x * 20, actor.y * 20, { ...actor, moving: actor.player ? !!g.p.dodge || !!g.p.attack : actor.state === 'approach' });
      if (squash) c.restore();
      c.globalAlpha = 1;
      if (actor.player) playerHidden = this.coverBody(depthMask, actor.x, actor.y);
      if (!actor.player && actor.hp > 0 && !still) labels.push(() => {
        const width = actor.boss ? 48 : 23, yy = actor.y * 20 - (mobClip ? mobClip.bodyHeight * (actor.boss ? BOSS_SPRITE_SCALE : 1) * BODY_SCALE / 2 + 6 : actor.boss ? 66 : actor.type === 'rabbit' ? 48 : 38);
        if (!actor.boss) { const left = actor.x * 20 - width / 2; this.rect(left - 1, yy - 1, width + 2, 6, '#2b3345'); this.rect(left, yy, width, 4, '#5e4a52'); this.rect(left, yy, width * Math.max(0, actor.hp / actor.maxHp), 4, '#e0564c'); }
        if (actor.exposedUntil > s.time || actor.dazedUntil > s.time) this.drawDaze(actor.x * 20, yy - 26);
        if (actor.exposedUntil > s.time) this.text('기절', actor.x * 20, yy - 17, '#af8345', 8);
        if (actor.dazedUntil > s.time) this.text('쾅! 빈틈', actor.x * 20, yy - 17, '#d8423c', 8);
        if (actor.reviveUntil > s.time) this.text('재검사', actor.x * 20, yy - 17, '#d8423c', 8);
        this.drawStatuses(actor, actor.boss ? yy + 11 : yy - 13);
        if (actor.affixes?.length) this.drawAffixTags(actor, yy - (this.statusBadges(actor).length ? 27 : 14));
      });
    }
    // A body that has just noticed F2 pops a '!' over its head and lets it fade; its attacks are warned on the floor.
    for (const enemy of s.enemies.filter(e => e.hp > 0 && !e.boss && e.noticedAt != null && s.time - e.noticedAt < NOTICE_SECONDS)) {
      const pose = mobPoses?.get(enemy.id), clip = pose && this.mobSprites.clip(pose.action, pose.direction), t = (s.time - enemy.noticedAt) / NOTICE_SECONDS;
      const pop = t < 0.12 ? 0.5 + 0.7 * t / 0.12 : t < 0.2 ? 1.2 - 0.2 * (t - 0.12) / 0.08 : 1, hop = Math.sin(Math.min(1, t / 0.3) * Math.PI) * 4;
      c.save(); c.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      this.drawAlert(enemy, enemy.y * 20 - (clip ? clip.bodyHeight * BODY_SCALE / 2 + 21 : 54) - hop, pop);
      c.restore();
    }
    for (const draw of this.overlays) draw();
    this.drawHeldSkills();
    this.drawBossState();
    const note = this.mapImages?.get(NOTE_ART);
    for (const bullet of s.projectiles) {
      const bx = bullet.x * 20, by = bullet.y * 20;
      // A riveter's rivet flies point first.
      if (bullet.look === 'rivet' && !bullet.friendly && this.drawMark('rivetShot', bx, by - 8, 8, { angle: bullet.angle })) continue;
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
      if (s.profile.settings.reducedMotion && ['dodge', 'hurt', 'scrap', 'parts', 'spark', 'impact', 'dust'].includes(fx.type)) continue;
      const fraction = Math.min(1, (s.time - fx.created) / fx.duration), x = fx.x * 20, y = fx.y * 20;
      if (fx.type === 'friendlyTell' || fx.type === 'danger' || (fx.look && GROUND_LOOKS.has(fx.look))) continue;
      // Sparks of a blow, a hurt and a dodge: painted stills that pop and fade; the old gear shape while they are missing.
      if (['spark', 'hurt', 'dodge'].includes(fx.type) && !fx.look) {
        const name = fx.type === 'spark' ? 'sparkHit' : fx.type === 'hurt' ? 'sparkHurt' : 'dust', pop = Math.min(1, fraction * 4);
        if (this.drawMark(name, x, y - 10, (fx.type === 'dodge' ? 18 : 16) * fx.value * (0.7 + 0.5 * pop), { angle: fx.type === 'dodge' ? 0 : fraction * 1.2, alpha: 1 - fraction * fraction, smooth: true })) continue;
      }
      // Blows and skills with a picture of their own play it; the plain shapes below are the fallback.
      if (fx.look && this.drawLook(fx, x, y, fraction)) continue;
      // The wrench swing, its hit and anything breaking play their pixelfx sheets; the shapes below are the fallback.
      if (this.drawSheetFx(fx, x, y, fraction)) continue;
      c.save(); c.globalAlpha = Math.max(0, 1 - fraction); c.strokeStyle = fx.color; c.lineWidth = fx.type === 'ring' ? 3 : 2;
      // Critical hits show in red, a little larger.
      if (fx.type === 'number') this.text(String(Math.round(fx.value)), x, y - fraction * 20 - 15, fx.color, fx.crit ? CRIT_NUMBER_SIZE : NUMBER_SIZE);
      if (fx.type === 'ring' || fx.type === 'friendlyTell') { const r = fx.value * 20 * (fx.type === 'ring' ? 0.5 + fraction * 0.5 : 1); c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU); c.stroke(); }
      if (fx.type === 'swing') this.drawSwing(fx, x, y, fraction);
      if (fx.type === 'crosscut') { this.line(x,y,fx.targetX*20,fx.targetY*20,'#d7f0ec',4);this.line(x,y,fx.targetX*20,fx.targetY*20,fx.color,2); }
      if(fx.type==='iceClamp'){let last;for(let i=0;i<=8;i++){const side=(i/4-1)*fx.value,forward=i===0||i===8?0:Math.sin(i*2.7)*.22,p={x:x+(Math.cos(fx.angle)*forward-Math.sin(fx.angle)*side)*20,y:y+(Math.sin(fx.angle)*forward+Math.cos(fx.angle)*side)*20};if(last)this.line(last.x,last.y,p.x,p.y,'#c2a4e0',3);last=p;}}
      if (fx.type === 'beam') this.line(x, y, fx.targetX * 20, fx.targetY * 20, fx.color, 4);
      if (fx.type === 'soundBeam') { c.restore(); this.drawSoundBeam(fx, x, y, fraction); continue; }
      if (fx.type === 'dodge' || fx.type === 'hurt' || fx.type === 'spark') this.gear(x, y - 10, fx.value * 10 * (1 + fraction), fx.color, fraction);
      // No `continue` here: it skipped the restore below, so every frame a fallen body's parts flew, the fading alpha leaked
      // into the next frame and the whole room was drawn see-through over the last one (2026-11-06: the 'slow zoom' on kills).
      if (fx.type === 'parts') this.drawParts(fx, x, y, fraction);
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
    this.drawFactoryBossOver(mobPoses);
    for (const draw of labels) draw();
    if (s.mode === 'unwind') {
      const x = (this.camera.x + 18) * 20, y = (this.camera.y + 8.55) * 20;
      // Roco's command circuit to pull out, or Brass's wind-up key to turn (PixelLab), bobbing; the old drawn gear while it loads.
      const boss = this.game.room?.boss, art = this.mapImages?.get(BOSS_UNWIND_ART[boss]), bob = s.profile.settings.reducedMotion ? 0 : Math.sin(this.visualTime * 3) * 3;
      if (art) { c.save(); c.imageSmoothingEnabled = false; c.drawImage(art, Math.round(x - 24), Math.round(y - 28 + bob), 48, 48); c.restore(); } else this.gear(x, y, 13, '#d0a854', this.visualTime * 0.4);
      this.text(`G · ${UNWIND_VERBS[boss] || UNWIND_VERBS.collectorRoco}`, x, y + 30, '#5c7462', 10);
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
    // Moving with the mouse: a flat ring on the floor where F2 is walking to, in the crosshair's green (yellow is the way out).
    if (g.onFoot && this.moveTarget && g.wakeProgress === null) {
      const x = this.moveTarget.x * 20, y = this.moveTarget.y * 20;
      c.save(); c.strokeStyle = '#557d70'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, 5, 2.5, 0, 0, TAU); c.stroke(); c.restore();
    }
    const hurtLeft = this.hurtUntil - performance.now();
    if (hurtLeft > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.55 * hurtLeft / HURT_EDGE_MS; c.strokeStyle = '#c43c36'; c.lineWidth = 28 * this.backing; c.strokeRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    // The drum board goes over the room, under the screen-wide flashes.
    if (this.drumBoard) { this.drawDrumBoard(...this.drumBoard); this.drumBoard = null; }
    if (pulseLeft > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.16 * pulseLeft; c.fillStyle = '#ffd257'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    // A fusion lights the screen's edges in its two elements, one from each side, fading out.
    const edge = this.fusionLeft(FUSION_EDGE_MS);
    if (edge > 0 && this.fusionTints?.length) {
      const W = this.canvas.width, H = this.canvas.height, depth = H * 0.4, [left, right = left] = this.fusionTints;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = (this.fusionCalm ? 0.5 : 0.8) * edge; c.globalCompositeOperation = 'lighter';
      for (const [x0, x1, color] of [[0, depth, left], [W, W - depth, right]]) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(Math.min(x0, x1), 0, depth, H); }
      // Top and bottom: the left element's colour on the left half, the right one's on the right, blending at the middle.
      c.drawImage(this.fusionBand(W, Math.round(depth * 0.6), left, right), 0, 0);
      c.save(); c.translate(0, H); c.scale(1, -1); c.drawImage(this.fusionBand(W, Math.round(depth * 0.6), left, right), 0, 0); c.restore();
      c.restore();
    }
    const flashLeft = (this.flashUntil || 0) - performance.now();
    if (flashLeft > 0) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.7 * flashLeft / FLASH_MS; c.fillStyle = '#fff8e8'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); c.restore(); }
    if (this.view) {
      // Smooth shrinking averages each block of detail into one pixel; the page then enlarges it without blending.
      const v = this.view.getContext('2d'); v.imageSmoothingEnabled = false;
      v.drawImage(this.canvas, 0, 0, this.view.width, this.view.height);
    }
  }
}
export { HAZARD_ART };
// Floor reaches and danger warnings (src/render/floor-marks.js) are drawn by the same renderer.
Object.assign(CanvasRenderer.prototype, floorMarks, factoryBossDraw);
