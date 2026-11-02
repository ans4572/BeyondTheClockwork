import {clampCorners} from '../engine/fusion-geometry.js';
import { PlayerAnimator } from '../animation/player-animator.js';
import { MobAnimator } from '../animation/mob-animator.js';
import { CastEffects } from '../animation/cast-effects.js';
import { nearestDirection } from '../animation/player-animator.js';
import { NpcDirector } from '../animation/npc-director.js';
import { cameraFor, VIEW_UNITS, CAMERA_ZOOM, PIXELS_PER_UNIT } from '../engine/map-geometry.js';
import { ghostFor } from './depth-mask.js';
export const STATUS_ICONS = Object.fromEntries(['burn', 'chill', 'frozen', 'shock', 'windPressure'].map(id => [id, `/art/ui/status-icons/${id}.png`]));
// Bosses are drawn larger than their sheets so they tower over the room's other bodies.
const NAME_SIZE = 8, NAME_GAP = 3, ACTION_GOLD = '#ffd257', BOSS_SPRITE_SCALE = 1.3, ENEMY_ARROW = '#e0564c', SHAKE_MS = 150, HURT_EDGE_MS = 180, JOLT_PX = 1.5, NUMBER_SIZE = 10, CRIT_NUMBER_SIZE = 12;
const COLUMN_SPACING_UNITS = 1.4, BADGE_SIZE = 12, BADGE_GAP = 1, COUNT_WIDTH = 9, COUNT_SIZE = 6, FROZEN_LOOK = 'saturate(0.2) brightness(1.4)';
const TAU = Math.PI * 2, SCREEN_UNITS = VIEW_UNITS, TELL_BLINK_SECONDS = 0.1, TELL_BLINKS = 3;
// F2's clips stand taller than the townsfolk; this brings them to the same height everywhere.
const PLAYER_SCALE = 0.88, EYES_OPEN_SHARE = 0.5;

/** Canvas adapter only: positions are in engine units; drawing has no combat authority. */
export class CanvasRenderer {
  constructor(canvas, game) { this.canvas = canvas; this.game = game; this.ctx = canvas.getContext('2d'); this.visualTime = 0; this.camera = { x: 0, y: 0 }; this.talkKey = 'E'; this.shakeUntil = 0; this.shakeSize = 0; this.hurtUntil = 0; }
  /** A short shake in screen pixels, on the wall clock so it still plays while a hit holds the game still. */
  kick(size) { const now = performance.now(); if (now > this.shakeUntil || size >= this.shakeSize) { this.shakeSize = size; this.shakeUntil = now + SHAKE_MS; } }
  wince() { this.hurtUntil = performance.now() + HURT_EDGE_MS; }
  shakeOffset() {
    const left = this.shakeUntil - performance.now();
    if (left <= 0) return [0, 0];
    const size = this.shakeSize * left / SHAKE_MS;
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
    const size = scale * resize / 2, left = Math.round((x - anchor[0] * size) * 2) / 2, top = Math.round((y - anchor[1] * size) * 2) / 2;
    c.fillStyle = '#57684e30'; c.beginPath(); c.ellipse(x, y, 11, 4, 0, 0, TAU); c.fill();
    if (flash) c.filter = flash === true ? 'brightness(1.9)' : flash;
    c.imageSmoothingEnabled = resize !== 1;
    for (const url of [clip.sheet, clip.effect]) if (url) c.drawImage(library.image(url), sx, sy, w, h, left, top, w * size, h * size);
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
  drawStatuses(enemy, y) {
    const c = this.ctx, badges = this.statusBadges(enemy), width = ({ count }) => BADGE_SIZE + BADGE_GAP + (count > 1 ? COUNT_WIDTH : 0);
    let x = Math.round(enemy.x * 20 - badges.reduce((sum, badge) => sum + width(badge), 0) / 2);
    for (const badge of badges) {
      const image = this.mapImages?.get(STATUS_ICONS[badge.id]);
      if (image) c.drawImage(image, x, y, BADGE_SIZE, BADGE_SIZE);
      // Stacks read as a small ×N beside the icon, outlined so it stays legible over any floor.
      if (badge.count > 1) { c.font = `700 ${COUNT_SIZE}px "Malgun Gothic", sans-serif`; c.textAlign = 'left'; c.lineWidth = 2; c.strokeStyle = '#2b3345'; c.strokeText(`×${badge.count}`, x + BADGE_SIZE, y + BADGE_SIZE - 1); c.fillStyle = '#fff4d6'; c.fillText(`×${badge.count}`, x + BADGE_SIZE, y + BADGE_SIZE - 1); }
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
    this.labels.push({ label, x: x * 20, y: y * 20 - clip.bodyHeight * clip.scale / 2 - NAME_GAP });
  }
  /** A resident's name floats just over the head: pale letters edged in ink, no box, like a caption in the world. */
  nameplate(label, x, bottom, fill = '#fff4d6') {
    const c = this.ctx;
    c.save(); c.font = `700 ${NAME_SIZE}px "Malgun Gothic", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = '#2b3345'; c.strokeText(label, x, bottom);
    c.fillStyle = fill; c.fillText(label, x, bottom); c.restore();
  }
  tag(label, x, top) {
    this.rect(x - label.length * 3.5 - 4, top - 1, label.length * 7 + 8, 11, '#fff8e8');
    this.text(label, x, top + 7, '#3f5c55', 8);
  }
  drawCastEffect({ effect, frame, x, y, lift }) {
    const { frameWidth: w, frameHeight: h, columns, anchor, scale = 1 } = effect, size = scale / 2, left = Math.round((x * 20 - anchor[0] * size) * 2) / 2, top = Math.round(((y - lift) * 20 - anchor[1] * size) * 2) / 2;
    this.ctx.drawImage(this.sprites.image(effect.sheet), frame % columns * w, Math.floor(frame / columns) * h, w, h, left, top, w * size, h * size);
  }
  rect(x, y, w, h, color) { const c = this.ctx; c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  line(x1, y1, x2, y2, color, width = 1) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  circle(x, y, r, color) { const c = this.ctx; c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  text(text, x, y, color = '#3f5c55', size = 7, align = 'center') { const c = this.ctx; c.font = `600 ${size}px "Malgun Gothic", sans-serif`; c.fillStyle = color; c.textAlign = align; c.fillText(text, x, y); }
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
    if (fill) c.fillRect(0, -width, length, width * 2);
    c.strokeRect(0, -width, length, width * 2); c.restore();
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
    const { s, p } = this.game, c = this.ctx;
    for (const enemy of s.enemies.filter(e => e.boss && e.hp > 0)) {
      if (enemy.alarmUntil > s.time) { c.save(); c.setLineDash([]); c.strokeStyle = Math.floor(s.time * 8) % 2 ? '#c43c36' : '#ffd257'; c.lineWidth = 3; c.beginPath(); c.arc(enemy.x * 20, enemy.y * 20, 40, 0, TAU); c.stroke(); c.restore(); this.drawAlert(enemy, enemy.y * 20 - 78); }
      if (enemy.bellUntil > s.time) { c.save(); c.strokeStyle = '#ffd257'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x * 20, p.y * 20, 16, 7, 0, 0, TAU); c.stroke(); c.restore(); }
    }
  }
  drawTell(enemy) {
    const tell = enemy.tell;
    if (!tell) return;
    const c = this.ctx, g = this.game, ai = g.config.bossAI[enemy.type], x = tell.x * 20, y = tell.y * 20;
    const progress = Math.min(1, (g.s.time - tell.started) / (tell.until - tell.started));
    // Only bosses mark the floor with a filled shape, and even theirs stays faint; the outline carries it.
    c.save(); c.strokeStyle = '#b85863'; c.fillStyle = `rgba(190, 81, 95, ${enemy.boss ? 0.05 + progress * 0.08 : 0})`; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    const sector = (radius, degrees) => { c.beginPath(); c.moveTo(x, y); c.arc(x, y, radius * 20, tell.angle - degrees * Math.PI / 360, tell.angle + degrees * Math.PI / 360); c.closePath(); c.fill(); c.stroke(); };
    const ring = (cx, cy, radius) => { c.beginPath(); c.arc(cx, cy, radius * 20, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(cx, cy, radius * 20, -Math.PI / 2, -Math.PI / 2 + TAU * progress); c.lineWidth = 3; c.stroke(); };
    switch (tell.type) {
      case 'fan': case 'fanSecond': sector(ai.fanRange, ai.fanDegrees); break;
      case 'dash': this.line(x, y, x + Math.cos(tell.angle) * enemy.dashDistance * 20, y + Math.sin(tell.angle) * enemy.dashDistance * 20, '#b85863', 1); break;
      case 'claw': {
        const range = ai.clawLength, width = ai.clawWidth * 20;
        c.translate(x, y); c.rotate(tell.angle); c.fillRect(0, -width, range * 20, width * 2); c.strokeRect(0, -width, range * 20, width * 2);
        this.text('› › ›', range * 10, 3, '#b85863', 11); break;
      }
      case 'shot': this.line(x, y, tell.targetX * 20, tell.targetY * 20, '#b85863', 1); this.circle(x, y - 14, 1 + progress * 3, '#ffd257'); break;
      case 'magnet': ring(tell.targetX * 20, tell.targetY * 20, ai.magnetRadius); this.text('↓ 吸 ↓', tell.targetX * 20, tell.targetY * 20 + 3, '#b85863', 10); break;
      case 'overcharge': ring(x, y, ai.overchargeRadius); this.text('!', x, y - 12, '#b85863', 15); break;
      case 'burst': ring(x, y, enemy.burstRadius); break;
      case 'spiral': ring(x, y, 0.9); for (let i = 0; i < enemy.bullets; i++) { const a = (enemy.spiralTurn || 0) + Math.PI / enemy.bullets + i * TAU / enemy.bullets; this.line(x + Math.cos(a) * 18, y + Math.sin(a) * 18, x + Math.cos(a) * 28, y + Math.sin(a) * 28, '#b85863', 1.5); } break;
      case 'ambush': ring(tell.targetX * 20, tell.targetY * 20, enemy.popRadius); this.text('!', tell.targetX * 20, tell.targetY * 20 + 4, '#b85863', 14); break;
      case 'spin': this.line(x, y, x + Math.cos(tell.angle) * 80, y + Math.sin(tell.angle) * 80, '#b85863', 1.5); this.text('↻', x, y - 18, '#b85863', 12); break;
      case 'beat': c.strokeStyle = '#d9a43a'; ring(x, y, enemy.beatRadius); break;
      case 'thrust': case 'thrust2': {
        const length = (tell.type === 'thrust' ? enemy.attackRange : enemy.followupLength) * 20, width = enemy.thrustWidth * 20;
        c.translate(x, y); c.rotate(tell.angle); c.strokeRect(0, -width, length, width * 2); break;
      }
      case 'doubleWave': case 'eliteWave': ring(x, y, enemy.attackRange + (tell.type === 'eliteWave' ? enemy.followupRadiusBonus : 0)); break;
      case 'march': {
        for (const lane of g.marchLanes(enemy)) this.lanePath(lane, ai.marchWidth, true);
        break;
      }
      case 'alarm': ring(x, y, 1.6); this.text('!', x, y - 44, '#b85863', 15); break;
      case 'bell': ring(x, y, 1.6); this.text('종', x, y - 44, '#b85863', 12); break;
      case 'column': this.columnPreview(); break;
      case 'crane':
        // Rings first: the crates change the fill colour the rings share.
        for (const { x: dx, y: dy } of tell.drops) ring(dx * 20, dy * 20, ai.craneRadius);
        for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170; this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); this.rect(dx * 20 - 8, top, 16, 3, '#c79a5e'); }
        break;
      case 'carpet': {
        const lanes = g.marchLanes(enemy, true);
        this.floorWash(progress);
        c.setLineDash([]); c.strokeStyle = '#3fbf7f'; c.fillStyle = 'rgba(63, 191, 127, 0.3)'; c.lineWidth = 3; this.lanePath(lanes[tell.safe], ai.carpetSafeWidth, true);
        break;
      }
      case 'trumpetWave':
        ring(x, y, 3.6); c.setLineDash([]); c.strokeStyle = '#7c9f7c'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 72, tell.angle - ai.waveGapDegrees * Math.PI / 360, tell.angle + ai.waveGapDegrees * Math.PI / 360); c.stroke(); this.text('틈', x + Math.cos(tell.angle) * 82, y + Math.sin(tell.angle) * 82, '#67805b', 8); break;
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
    const k = this.backing, zoom = 2 * CAMERA_ZOOM * k;
    c.setTransform(zoom, 0, 0, zoom, Math.round((-this.camera.x * PIXELS_PER_UNIT + shakeX) * k), Math.round((-this.camera.y * PIXELS_PER_UNIT + shakeY) * k));
    // Painted backgrounds are resampled smoothly; sprites below stay on hard pixels.
    if (mapImage) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(mapImage, 0, 0, size[0] * 20, size[1] * 20); } else this.scenery(hub);
    c.imageSmoothingEnabled = false;
    if (s.mode === 'shop' && !mapImage) { this.building(217, 113, 110, 69, '#d9c49a', '볼트의 부품 상점', '#88aaa0'); this.drawDoll(273, 212, { type: 'moru', color: '#c7a968' }); }
    const yardExit = s.mode === 'practice' ? map?.exit.at : null;
    const goal = s.mode === 'route' ? g.portal : yardExit ? { x: yardExit[0], y: yardExit[1] } : ['intro', 'registration'].includes(s.mode) ? g.tutorial.goal : null;
    // The portal the player came through stays marked until they have met the town.
    const portal = s.mode === 'registration' && g.village ? g.hubMap.arrival.portal : null;
    for (const spot of [portal, goal]) if (spot) this.marker(spot);
    for (const enemy of s.enemies.filter(e => e.hp > 0)) this.drawTell(enemy);
    for (const cast of s.casts) {
      if(cast.shape==='clamp'){
        const corners=clampCorners(cast,cast.angle,cast),closing=Math.max(0,Math.min(1,(cast.age-cast.delay+cast.closeMs/1000)/(cast.closeMs/1000))),gap=cast.jawOpenDistance+(cast.jawClosedDistance-cast.jawOpenDistance)*closing;
        for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];this.line(a.x*20,a.y*20,b.x*20,b.y*20,'#94bdc8',1);}
        if(!spriteFx)for(const side of [-1,1]){const points=[-1,1].map(u=>({x:cast.x+Math.cos(cast.angle)*u*cast.halfLength-Math.sin(cast.angle)*side*gap,y:cast.y+Math.sin(cast.angle)*u*cast.halfLength+Math.cos(cast.angle)*side*gap}));this.line(points[0].x*20,points[0].y*20,points[1].x*20,points[1].y*20,'#7fc9df',5);}
      }
      if(cast.shape === 'orb' && !spriteFx){ const x=cast.x*20,y=cast.y*20-16; this.circle(x,y,9,'#a4c7b1');this.circle(x,y,5,'#dfca6a');this.line(x-5,y,x+4,y+3,'#fff1a2',2); }
      if (cast.shape === 'magnet') {
        c.save(); c.globalAlpha = 0.18; this.circle(cast.x * 20, cast.y * 20, cast.radius * 20, '#8c638f'); c.restore();
        for (let i = 0; i < 3; i++) { c.strokeStyle = '#9d74a1'; c.beginPath(); c.arc(cast.x * 20, cast.y * 20, ((cast.age + i * 0.5) % 1.5) / 1.5 * cast.radius * 20, 0, TAU); c.stroke(); }
      }
      for (const bullet of cast.projectiles || []) if (!bullet.done) { this.circle(bullet.x * 20, bullet.y * 20, 4, cast.color); this.rect(bullet.x * 20 - 2, bullet.y * 20 - 2, 4, 4, '#e7fbec'); }
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
    const actors = [...s.enemies.filter(e => e.hp > 0 || mobPoses?.has(e.id)), ...((hub ? g.village && mapImage : s.mode !== 'shop' || mapImage) ? [{ ...g.p, type: 'player', player: true }] : []), ...occluders, ...props, ...effects, ...npcs, ...hubPlayer].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.occluder) { this.drawOccluder(mapImage, actor.occluder.polygon, size); continue; }
      if (actor.prop) { this.drawProp(actor.prop); this.coverBody(depthMask, actor.prop.x, actor.prop.y, 2, 2.6); continue; }
      if (actor.fx) { this.drawCastEffect(actor.fx); continue; }
      if (actor.dummy) { this.drawDummy(actor, map.dummyImage); continue; }
      if (actor.npc) { this.drawNpc(actor.npc, depthMask); continue; }
      if (actor.hubPlayer) { this.drawSprite(map.spawn.x * 20, map.spawn.y * 20, this.animator.static(-2.4), this.sprites, false, PLAYER_SCALE); this.coverBody(depthMask, map.spawn.x, map.spawn.y); continue; }
      const blink = actor.player && actor.invulnerableUntil > s.time && Math.floor(s.time * 22) % 2 === 0;
      c.globalAlpha = actor.hidden ? 0.25 : blink && !s.profile.settings.reducedMotion ? 0.45 : 1;
      const mobPose = mobPoses?.get(actor.id), mobClip = mobPose && this.mobSprites.clip(mobPose.action, mobPose.direction);
      // A struck body trembles side to side for a moment, even while the hit holds time still.
      const jolt = !actor.player && actor.joltUntil > s.time && !s.profile.settings.reducedMotion ? (Math.floor(performance.now() / 32) % 2 ? JOLT_PX : -JOLT_PX) : 0;
      const drawn = actor.player ? playerPose && this.drawSprite(actor.x * 20, actor.y * 20, playerPose, this.sprites, false, PLAYER_SCALE) : mobPose && this.drawSprite(actor.x * 20 + jolt, actor.y * 20, mobPose, this.mobSprites, actor.flashUntil > s.time || this.tellBlink(actor) || (actor.frozenUntil > s.time && FROZEN_LOOK), actor.boss ? BOSS_SPRITE_SCALE : 1);
      if (!drawn) this.drawDoll(actor.x * 20, actor.y * 20, { ...actor, moving: actor.player ? !!g.p.dodge || !!g.p.attack : actor.state === 'approach' });
      c.globalAlpha = 1;
      if (actor.player) playerHidden = this.coverBody(depthMask, actor.x, actor.y);
      if (!actor.player && actor.hp > 0) {
        const width = actor.boss ? 48 : 23, yy = actor.y * 20 - (mobClip ? mobClip.bodyHeight * (actor.boss ? BOSS_SPRITE_SCALE : 1) / 2 + 6 : actor.boss ? 66 : actor.type === 'rabbit' ? 48 : 38);
        this.rect(actor.x * 20 - width / 2, yy, width, 3, '#869282'); this.rect(actor.x * 20 - width / 2, yy, width * Math.max(0, actor.hp / actor.maxHp), 3, actor.boss ? '#bf787b' : '#b38578');
        if (actor.boss) { this.text(actor.name, actor.x * 20, yy - 5, '#52645c', 8); const threshold = g.c.balance.bossStaggerThreshold[actor.kind]; this.rect(actor.x * 20 - width / 2, yy + 5, width * actor.stagger / threshold, 2, '#cca453'); }
        if (actor.exposedUntil > s.time) this.text('태엽 노출', actor.x * 20, yy - 17, '#af8345', 8);
        this.drawStatuses(actor, actor.boss ? yy + 11 : yy - 13);
      }
    }
    for (const enemy of s.enemies.filter(e => e.hp > 0 && e.tell && !e.boss)) {
      const pose = mobPoses?.get(enemy.id), clip = pose && this.mobSprites.clip(pose.action, pose.direction);
      this.drawAlert(enemy, enemy.y * 20 - (clip ? clip.bodyHeight / 2 + 21 : 54));
    }
    this.drawColumn(); this.drawBossState();
    for (const bullet of s.projectiles) { this.circle(bullet.x * 20, bullet.y * 20, 4, bullet.friendly ? '#86c0ac' : '#b96b78'); this.circle(bullet.x * 20, bullet.y * 20, 2, '#f7e6b0'); }
    for (const fx of s.effects) {
      if (fx.type === 'number' && !s.profile.settings.damageNumbers) continue;
      if (spriteFx && ['crosscut', 'iceClamp'].includes(fx.type)) continue;
      if (s.profile.settings.reducedMotion && ['dodge', 'hurt', 'scrap', 'spark'].includes(fx.type)) continue;
      const fraction = Math.min(1, (s.time - fx.created) / fx.duration), x = fx.x * 20, y = fx.y * 20;
      c.save(); c.globalAlpha = Math.max(0, 1 - fraction); c.strokeStyle = fx.color; c.lineWidth = fx.type === 'ring' ? 3 : 2;
      // Critical hits show in red, a little larger.
      if (fx.type === 'number') this.text(String(Math.round(fx.value)), x, y - fraction * 20 - 15, fx.color, fx.crit ? CRIT_NUMBER_SIZE : NUMBER_SIZE);
      if (fx.type === 'ring' || fx.type === 'friendlyTell') { c.beginPath(); c.arc(x, y, fx.value * 20 * (fx.type === 'ring' ? 0.5 + fraction * 0.5 : 1), 0, TAU); c.stroke(); }
      if (fx.type === 'swing') { c.lineWidth = 5; c.beginPath(); c.arc(x, y, fx.value * 20 * 0.8, fx.angle - 0.8, fx.angle + 0.8); c.stroke(); }
      if (fx.type === 'crosscut') { this.line(x,y,fx.targetX*20,fx.targetY*20,'#d7f0ec',4);this.line(x,y,fx.targetX*20,fx.targetY*20,fx.color,2); }
      if(fx.type==='iceClamp'){let last;for(let i=0;i<=8;i++){const side=(i/4-1)*fx.value,forward=i===0||i===8?0:Math.sin(i*2.7)*.22,p={x:x+(Math.cos(fx.angle)*forward-Math.sin(fx.angle)*side)*20,y:y+(Math.sin(fx.angle)*forward+Math.cos(fx.angle)*side)*20};if(last)this.line(last.x,last.y,p.x,p.y,'#c2a4e0',3);last=p;}}
      if (fx.type === 'beam') this.line(x, y, fx.targetX * 20, fx.targetY * 20, fx.color, 4);
      if (fx.type === 'dodge' || fx.type === 'hurt' || fx.type === 'spark') this.gear(x, y - 10, fx.value * 10 * (1 + fraction), fx.color, fraction);
      if (fx.type === 'scrap') for (let i = 0; i < 8; i++) { const a = i * TAU / 8; this.rect(x + Math.cos(a) * fraction * 22, y + Math.sin(a) * fraction * 22, 3, 3, fx.color); }
      c.restore();
    }
    if (s.mode === 'unwind') {
      const x = (this.camera.x + 18) * 20, y = (this.camera.y + 8.55) * 20;
      this.gear(x, y, 13, '#d0a854', this.visualTime * 0.4); this.text('G · 통제축 풀기', x, y + 30, '#5c7462', 10);
    }
    // A player lost behind scenery shows through it, after every body so nothing repaints over them.
    const ghost = ghostFor(playerHidden);
    if (ghost && playerPose) { c.globalAlpha = ghost; this.drawSprite(g.p.x * 20, g.p.y * 20, playerPose, this.sprites, false, PLAYER_SCALE); c.globalAlpha = 1; }
    for (const { label, x, y } of this.labels) this.nameplate(label, x, y);
    if (goal && mapImage) this.pointTo(goal);
    // Enemies wait spread over the room; when none is in view, a red arrow points to the nearest.
    if (s.mode === 'combat' && mapImage && !goal) {
      const living = s.enemies.filter(e => e.hp > 0), near = living.reduce((best, e) => (!best || Math.hypot(e.x - g.p.x, e.y - g.p.y) < Math.hypot(best.x - g.p.x, best.y - g.p.y) ? e : best), null);
      const seen = living.some(e => e.x > this.camera.x && e.x < this.camera.x + SCREEN_UNITS[0] && e.y > this.camera.y && e.y < this.camera.y + SCREEN_UNITS[1]);
      if (near && !seen) this.pointTo(near, ENEMY_ARROW);
    }
    if (g.walking && mapImage) {
      if (s.mode !== 'registration') this.nameplate(g.village.exit.label, g.village.exit.at[0] * 20, g.village.exit.at[1] * 20 + NAME_SIZE);
      const npc = g.nearbyNpc;
      const clip = npc && this.npcSprites?.clip(`${npc.character}-idle`, npc.direction);
      // Within reach, what can be done shows in gold just over the name, in the same boxless lettering.
      if (clip && !this.talking) this.nameplate(`${this.talkKey} 말 걸기`, npc.x * 20, npc.y * 20 - clip.bodyHeight * clip.scale / 2 - NAME_GAP - (npc.label ? NAME_SIZE + 3 : 0), ACTION_GOLD);
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
  }
}
