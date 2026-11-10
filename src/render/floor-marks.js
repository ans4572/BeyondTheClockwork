import { FX, HAZARD_ART } from './fx-sprites.js';
import { FLOOR_FLAT } from '../engine/math.js';

/**
 * What the renderer paints on the floor under the bodies: where a skill will land, the danger floors of enemy attacks
 * and blasts, the flash of a fusion's reach, and Brass's lanes. Installed on CanvasRenderer.prototype (see canvas.js),
 * so `this` is the renderer: its context, game, marks and overlay.
 */
const TAU = Math.PI * 2;
/** Fusion shapes that strike an area of floor, drawn under their pictures (see drawFusionFloors); a shockwave lasts this long. */
const FLOOR_SHAPES = new Set(['self', 'target', 'moving', 'orb', 'clamp']), FLOOR_WAVE_SECONDS = 0.28, FLOOR_FLASH_SECONDS = 0.22;
/**
 * The sound and water fusions that strike round a spot get the same opening ring (2026-11-09): 과열 증기막, 고음 파쇄, 빙판,
 * 공명 낙뢰, 감전 웅덩이, 물기둥 회오리, 수면 공명. 과열 공진 (marks on bodies) and 메아리 돌풍 (a travelling ring) have no
 * one spot. Their own floor pictures carry the rest, so only the opening flash is drawn, not a ring for every blow.
 */
const FLASH_SHAPES = new Set(['veil', 'shatter', 'sheet', 'speaker', 'pool', 'spout', 'film']);
/** Fusions whose ring waits for the blow: a landing first (target, orb), a note that breaks, a pool that fills. */
const DELAYED_SHAPES = new Set(['target', 'orb', 'shatter', 'pool']);
/**
 * A fusion's rings lie on the painted floor, which is seen at a slant: squashed to this share of their height, like the
 * landing marks. The opening flash bursts from FLASH_FROM to FLASH_TO of the reach (it shows the cast, not the reach);
 * each later blow's ring still runs out to the rim.
 */
const RING_FLAT = FLOOR_FLAT, FLASH_FROM = 0.4, FLASH_TO = 0.78;
/**
 * Basic skills whose picture is smaller than what they strike: their element's reach ring lies faintly on the floor for
 * as long as they last, so the whole reach reads (회오리 흡입's whirl is about 69 px across, its pull and blows 120; 2026-11-09).
 */
const BASIC_REACH = new Set(['vortexIntake']), REACH_ALPHA = 0.32, REACH_FADE = 0.15;
/**
 * Enemy danger floors, as Lost Ark paints them: one red multiplied into the floor (its pattern shows through), no
 * hatching or outline; a deeper red fills from the attacker outward and the blow lands as it reaches the edge.
 */
const TELL_RED = '#e0303c', TELL_WASH = 0.42, TELL_BOSS_WASH = 0.48, TELL_FILL = 0.35;
/** The green of a safe floor, washed the same way as the red (2026-11-09). */
const SAFE_GREEN = '#2fae63';
/** Each element's reach ring (a MARKS name); a ring fills 124 of its 128 pixels, and the second element's sits inside. */
const FUSION_RINGS = { fire: 'ringFire', ice: 'ringIce', lightning: 'ringLightning', wind: 'ringWind', sound: 'ringSound', water: 'ringWater' }, RING_SPAN = 128 / 124, RING_INNER = 0.84;
export const ELEMENT_TINTS = { fire: '#ff7a2f', ice: '#8fe3ff', lightning: '#ffe14d', wind: '#8ff5b4', sound: '#ffc15a', water: '#5cc8e6' };

export const floorMarks = {
  /**
   * Where a placed skill will land: a soft disc on the floor in the skill's colour, a dashed rim, and an inner ring that
   * closes in on the rim as the moment of impact comes, so the timing reads as well as the place.
   */
  drawLandingMark(fx, x, y, fraction) {
    const c = this.ctx, r = fx.value * 20, flat = 0.55;
    // With its element's floor mark painted (lightning, frost, embers, or the hatch an enemy climbs out of), the mark turns
    // slowly and firms up toward the hit; the closing ring still keeps the time.
    const art = { lightning: 'landLightning', ice: 'landIce', fire: 'landFire', sound: 'landSound', water: 'landWater', spawn: 'spawn' }[fx.mark];
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
  },
  /**
   * Clips what is drawn next to the floor bodies can stand on (the map's walkable area less its solids), so a reach
   * painted on the floor stops at planters, walls and stalls. Returns whether it clipped; the caller then restores.
   */
  clipToFloor(map) {
    const c = this.ctx;
    if (!map?.walkable || !c.clip) return false;
    c.save(); c.beginPath();
    for (const polygon of [map.walkable, ...(map.solids || [])]) { polygon.forEach(([px, py], i) => i ? c.lineTo(px * 20, py * 20) : c.moveTo(px * 20, py * 20)); c.closePath(); }
    c.clip('evenodd');
    return true;
  },
  /** Fills the current path as a danger floor: `color` multiplied into the painting, a little laid over for dark floors. */
  washFloor(alpha, color = TELL_RED) {
    const c = this.ctx;
    c.save(); c.setLineDash([]); c.globalCompositeOperation = 'multiply'; c.globalAlpha = alpha; c.fillStyle = color; c.fill();
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = alpha * 0.3; c.fill(); c.restore();
  },
  /** A round danger floor `r` pixels wide around (x, y), its deeper red grown to `progress` (0 to 1) of the way out. */
  dangerDisc(x, y, r, progress) {
    const c = this.ctx;
    c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU); this.washFloor(TELL_WASH);
    if (progress > 0) { const k = Math.min(1, progress); c.beginPath(); c.ellipse(x, y, r * k, r * k * FLOOR_FLAT, 0, 0, TAU); this.washFloor(TELL_FILL); }
  },
  /**
   * A blast about to go off (a lit crate, a volatile elite's death): a true circle, as the blast hits, washed red like
   * every danger floor and filling to the rim as the fuse burns.
   */
  drawDanger(fx, x, y, fraction) {
    this.dangerDisc(x, y, fx.value * 20, fraction);
  },
  /**
   * Where a fusion strikes, flashed on the floor the way action games show the player's own blast: its rings burst
   * out to the true reach as it goes off and are gone within a fifth of a second, and each later blow sends one faint
   * ring out to the rim. Nothing stays on the floor in between; the blast's own picture carries it (2026-11-06).
   */
  drawFusionFloors() {
    const g = this.game, c = this.ctx, ease = t => 1 - (1 - t) ** 2;
    for (const cast of g.s.casts) {
      if (!cast.fusion && !cast.derived && !cast.done && BASIC_REACH.has(cast.skillId)) { this.drawBasicReach(cast); continue; }
      const flashOnly = FLASH_SHAPES.has(cast.shape);
      if (!cast.fusion || cast.derived || cast.done || !(FLOOR_SHAPES.has(cast.shape) || flashOnly)) continue;
      // Targeted fusions go off once they have gathered.
      const start = DELAYED_SHAPES.has(cast.shape) ? cast.delay || 0 : 0;
      if (cast.age < start) continue;
      const [a, b = a] = (cast.elements || []).map(id => ELEMENT_TINTS[id] || '#fff4cd'), x = cast.x * 20, y = cast.y * 20;
      const flash = (cast.age - start) / FLOOR_FLASH_SECONDS;
      const since = cast.pulse > 0 ? cast.age - (cast.next - (cast.interval || 0)) : Infinity, wave = Math.min(1, since / FLOOR_WAVE_SECONDS);
      // The rings of this frame: the opening flash (both elements, with a brief glow on the floor), then each blow's wave.
      const bursts = [];
      if (flash < 1) bursts.push({ grow: FLASH_FROM + (FLASH_TO - FLASH_FROM) * ease(flash), alpha: 1 - flash * flash, both: true, glow: 0.2 * (1 - flash) });
      else if (wave < 1 && !flashOnly) bursts.push({ grow: 0.3 + 0.7 * ease(wave), alpha: 0.45 * (1 - wave) });
      if (!bursts.length) continue;
      // A round reach uses the PixelLab rings (art/fx/marks/ring-fusion-*): the first element's outside, the second's inside.
      const rings = (cast.elements || []).map(id => FUSION_RINGS[id]).filter(name => name && this.mark(name));
      if (cast.shape !== 'clamp' && rings.length) {
        const [outer, inner = outer] = rings, r = cast.radius * 20, size = 2 * r * RING_SPAN;
        for (const { grow, alpha, both, glow } of bursts) {
          if (glow) { c.save(); c.globalAlpha = glow; c.fillStyle = a; c.beginPath(); c.ellipse(x, y, r * grow, r * grow * RING_FLAT, 0, 0, TAU); c.fill(); c.restore(); }
          this.drawMark(outer, x, y, size * grow, { alpha, flat: RING_FLAT });
          if (both && inner !== outer) this.drawMark(inner, x, y, size * RING_INNER * grow, { alpha: 0.85 * alpha, flat: RING_FLAT });
        }
        continue;
      }
      if (cast.shape === 'clamp' && rings.length) {
        const [outer, inner = outer] = rings.map(name => this.mark(name)), l = cast.halfLength * 20, w = cast.halfWidth * 20;
        for (const { grow, alpha, both, glow } of bursts) {
          c.save(); c.translate(x, y); c.rotate(cast.angle); c.scale(1, w / l);
          if (glow) { c.globalAlpha = glow; c.fillStyle = a; c.beginPath(); c.arc(0, 0, l * grow, 0, TAU); c.fill(); }
          const ring = (image, k, opacity) => { const size = 2 * l * RING_SPAN * grow * k; c.globalAlpha = opacity; c.imageSmoothingEnabled = false; c.drawImage(image, -size / 2, -size / 2, size, size * image.height / image.width); };
          ring(outer, 1, alpha); if (both && inner !== outer) ring(inner, RING_INNER, 0.85 * alpha);
          c.restore();
        }
        continue;
      }
      // Any ring still loading: flat-colour lines, as the pixel art around it.
      // A round reach lies flat like the rings; the clamp's box keeps its true shape, matching the clamp drawn over it.
      c.save(); c.translate(x, y);
      if (cast.shape === 'clamp') c.rotate(cast.angle); else c.scale(1, RING_FLAT);
      const outline = grow => {
        c.beginPath();
        if (cast.shape === 'clamp') { const l = cast.halfLength * 20 * grow, w = cast.halfWidth * 20 * grow; c.rect(-l, -w, l * 2, w * 2); }
        else c.arc(0, 0, cast.radius * 20 * grow, 0, TAU);
      };
      for (const { grow, alpha, both, glow } of bursts) {
        if (glow) { c.globalAlpha = glow; c.fillStyle = a; outline(grow); c.fill(); }
        c.globalAlpha = 0.45 * alpha; c.strokeStyle = '#2b3345'; c.lineWidth = 2; outline(grow * 1.03); c.stroke();
        c.globalAlpha = alpha; c.strokeStyle = a; c.lineWidth = 3; outline(grow); c.stroke();
        if (both) { c.globalAlpha = 0.8 * alpha; c.strokeStyle = b; c.lineWidth = 2; outline(grow * 0.93); c.stroke(); }
      }
      c.restore();
    }
  },
  /**
   * A basic skill's reach (BASIC_REACH): its element's ring at the true radius, faint and turning slowly, fading in as it
   * starts and out as its last blow lands; each blow sends a fainter ring out to the rim, as a fusion's do.
   */
  drawBasicReach(cast) {
    const name = FUSION_RINGS[cast.elements?.[0]];
    if (!name || !this.mark(name)) return;
    const x = cast.x * 20, y = cast.y * 20, size = 2 * cast.radius * 20 * RING_SPAN, end = (cast.hits || 1) * (cast.interval || 0) + (cast.delay || 0);
    const fade = Math.max(0, Math.min(1, cast.age / REACH_FADE, (end - cast.age) / REACH_FADE));
    this.drawMark(name, x, y, size, { alpha: REACH_ALPHA * fade, flat: RING_FLAT, angle: -this.visualTime * 1.2 });
    const since = cast.pulse > 0 ? cast.age - (cast.next - (cast.interval || 0)) : Infinity, wave = Math.min(1, since / FLOOR_WAVE_SECONDS);
    if (wave < 1) this.drawMark(name, x, y, size * (0.3 + 0.7 * (1 - (1 - wave) ** 2)), { alpha: 0.3 * (1 - wave), flat: RING_FLAT });
  },
  /** A long band along a line, filled and outlined in the current colours. */
  lanePath([[ax, ay], [bx, by]], halfWidth, fill) {
    const c = this.ctx, width = halfWidth * 20, length = Math.hypot(bx - ax, by - ay) * 20, angle = Math.atan2(by - ay, bx - ax);
    // The painted carpets end along the stairs and the front fence, not square to the carpet: the map gives that edge's
    // direction (laneEnd), and the strip's two ends are cut along it so they lie on the carpet's own ends.
    const [ex, ey] = this.game.map?.laneEnd || [-Math.sin(angle), Math.cos(angle)], along = ex * Math.cos(angle) + ey * Math.sin(angle), across = -ex * Math.sin(angle) + ey * Math.cos(angle);
    const skew = Math.abs(across) > 0.2 ? along / across : 0;
    c.save(); c.translate(ax * 20, ay * 20); c.rotate(angle);
    // A lane about to be marched: a red carpet strip with gold chevrons running along it (scrolling tile).
    // The safe lane (fill 'safe'): washed green into the carpet like the red warnings, no outline (2026-11-09).
    if (fill === 'safe') { this.stripPath(length, width, skew); this.washFloor(TELL_BOSS_WASH, SAFE_GREEN); c.restore(); return; }
    if (fill && !this.drawLaneTiles(length, width, skew)) { this.stripPath(length, width, skew); c.fill(); }
    this.stripPath(length, width, skew); c.stroke(); c.restore();
  },
  /** The strip from 0 to `length` along x, `width` either side, its ends slanted by `skew` (x per unit of y). */
  stripPath(length, width, skew = 0) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(-width * skew, -width); c.lineTo(length - width * skew, -width); c.lineTo(length + width * skew, width); c.lineTo(width * skew, width); c.closePath();
  },
  /** Lays the march-lane tile along the x axis from 0 to `length`, `width` either side; false while its sheet loads. */
  drawLaneTiles(length, width, skew = 0) {
    const fx = FX.marchLane, image = this.mapImages?.get(fx.sheet);
    if (!image) return false;
    const c = this.ctx, sy = width * 2 / fx.h, scroll = Math.floor(this.visualTime * 24) % fx.w;
    c.save(); c.globalAlpha *= 0.75; this.stripPath(length, width, skew); c.clip();
    // The chevrons march along the lane: the tile row slides forward and wraps.
    for (let x = scroll - fx.w - Math.ceil(Math.abs(width * skew)); x < length + Math.abs(width * skew); x += fx.w) c.drawImage(image, 0, 0, fx.w, fx.h, x, -width, fx.w, fx.h * sy);
    c.restore(); return true;
  },
  /** Everywhere that will be hit, in a wash that deepens as the blow comes. */
  floorWash(progress) {
    const c = this.ctx, walkable = this.game.map?.walkable, { left, top, right, bottom } = this.game.config.arena.bounds;
    const points = walkable || [[left, top], [right, top], [right, bottom], [left, bottom]];
    c.save(); c.setLineDash([]); c.fillStyle = `rgba(190, 81, 95, ${0.1 + progress * 0.2})`; c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x * 20, y * 20) : c.moveTo(x * 20, y * 20))); c.closePath(); c.fill(); c.restore();
  },
  /**
   * Where a soldier pattern's ranks will come from: their starting line washed red, with arrows pointing the way they
   * will walk, and a label. `path` is the engine's rankPath.
   */
  rankPreview(path, label) {
    const c = this.ctx, [a, b] = path.start, [e, f] = path.end, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], far = [(e[0] + f[0]) / 2, (e[1] + f[1]) / 2];
    const heading = Math.atan2(far[1] - mid[1], far[0] - mid[0]), across = Math.hypot(b[0] - a[0], b[1] - a[1]);
    c.save(); c.setLineDash([]); c.lineCap = 'round';
    c.strokeStyle = 'rgba(224, 48, 60, 0.55)'; c.lineWidth = 16; c.beginPath(); c.moveTo(a[0] * 20, a[1] * 20); c.lineTo(b[0] * 20, b[1] * 20); c.stroke();
    c.strokeStyle = '#b85863'; c.lineWidth = 2.5; c.stroke();
    // Chevrons along the line, all pointing where the ranks will walk.
    c.fillStyle = '#e0303c';
    for (let i = 1, n = Math.max(2, Math.round(across / 3)); i < n; i++) {
      const t = i / n, px = (a[0] + (b[0] - a[0]) * t) * 20 + Math.cos(heading) * 22, py = (a[1] + (b[1] - a[1]) * t) * 20 + Math.sin(heading) * 22;
      c.save(); c.translate(px, py); c.rotate(heading); c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -7); c.lineTo(-1, 0); c.lineTo(-5, 7); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
    this.text(label, mid[0] * 20 - Math.cos(heading) * 20, mid[1] * 20 - Math.sin(heading) * 20 - 6, '#b85863', 11);
  },
  drawTell(enemy) {
    const tell = enemy.tell;
    if (!tell) return;
    const c = this.ctx, g = this.game, ai = g.config.bossAI[enemy.type], x = tell.x * 20, y = tell.y * 20;
    const progress = Math.min(1, (g.s.time - tell.started) / (tell.until - tell.started));
    // The whole reach washed red (see TELL_RED); lanes and glyphs still use the plain red line below.
    c.save(); c.strokeStyle = '#b85863'; c.lineWidth = 2.5;
    let tone = TELL_RED;
    const paint = () => this.washFloor(enemy.boss ? TELL_BOSS_WASH : TELL_WASH, tone);
    // The deeper red filling from the attacker outward; the blow lands as it reaches the edge.
    const fillTo = shape => { c.beginPath(); shape(); this.washFloor(TELL_FILL, tone); };
    const sector = (radius, degrees) => { const from = tell.angle - degrees * Math.PI / 360, to = tell.angle + degrees * Math.PI / 360; c.beginPath(); c.moveTo(x, y); c.arc(x, y, radius * 20, from, to); c.closePath(); paint(); fillTo(() => { c.moveTo(x, y); c.arc(x, y, radius * 20 * progress, from, to); c.closePath(); }); };
    const box = (length, width) => { c.translate(x, y); c.rotate(tell.angle); c.beginPath(); c.rect(0, -width, length, width * 2); paint(); fillTo(() => c.rect(0, -width, length * progress, width * 2)); };
    // How wide a body's path hurts: its own radius and the player's.
    const reach = (radius = enemy.radius) => (radius + g.config.arena.playerRadius) * 20;
    // Round reaches lie on the floor as ellipses (FLOOR_FLAT), the same shape their hits use (floorDistance).
    const ring = (cx, cy, radius) => { c.beginPath(); c.ellipse(cx, cy, radius * 20, radius * 20 * FLOOR_FLAT, 0, 0, TAU); paint(); fillTo(() => c.ellipse(cx, cy, radius * 20 * progress, radius * 20 * progress * FLOOR_FLAT, 0, 0, TAU)); };
    // A count beside a glyph: '×3' stomps, '×5' stickers.
    const counted = (name, fallback, count, gx, gy) => { if (this.mark(name)) { this.overlay(() => this.drawMark(name, gx - 7, gy - 4, 24)); this.text(`×${count}`, gx + 6, gy + 2, '#b85863', 10, 'left'); } else this.text(fallback, gx, gy, '#b85863', 11); };
    switch (tell.type) {
      case 'fan': case 'fanSecond': sector(ai.fanRange, ai.fanDegrees); break;
      // A plain swing (nutcracker, guard): the cone it sweeps, as wide and as far as the blow.
      case 'melee': sector(enemy.attackRange, g.config.rules.enemyMeleeArc); break;
      case 'dash': box(enemy.dashDistance * 20, reach()); this.glyph('chevrons', enemy.dashDistance * 10, 3, '› › ›'); break;
      case 'claw': {
        const range = ai.clawLength, width = ai.clawWidth * 20;
        box(range * 20, width); this.glyph('chevrons', range * 10, 3, '› › ›'); break;
      }
      // The gold spark at the bell keeps its own fill off the band.
      case 'shot': this.overlay(() => this.circle(x, y - 14, 1 + progress * 3, '#ffd257')); box(enemy.attackRange * 20, reach(g.config.rules.enemyProjectileRadius)); break;
      case 'magnet': ring(tell.targetX * 20, tell.targetY * 20, ai.magnetRadius); this.glyph('magnet', tell.targetX * 20, tell.targetY * 20 + 3, '↓ 吸 ↓', '#b85863', 10); break;
      case 'suction': sector(ai.suctionRange, ai.suctionDegrees); this.glyph('suction', x + Math.cos(tell.angle) * ai.suctionRange * 10, y + Math.sin(tell.angle) * ai.suctionRange * 10 + 3, '‹ ‹ 吸'); break;
      case 'stickers': { const n = g.bossRepeat(enemy, 'stickerCount'); counted('sticker', '불량 ×' + n, n, x, y - 46); break; }
      case 'stomp': { const n = g.bossRepeat(enemy, 'stompRings'); ring(x, y, 1.2); counted('stomp', '쿵 ×' + n, n, x, y - 46); break; }
      case 'charge': box(ai.chargeLength * 20, ai.chargeWidth * 20); this.glyph('chevrons', ai.chargeLength * 10, 3, '» » »'); break;
      case 'chargeHorn': sector(ai.hornRange, ai.hornDegrees); break;
      case 'overcharge': ring(x, y, ai.overchargeRadius); this.glyph('alert', x, y - 12, '!', '#b85863', 15); break;
      case 'burst': ring(x, y, enemy.burstRadius); break;
      case 'spiral': ring(x, y, 0.9); for (let i = 0; i < enemy.bullets; i++) { const a = (enemy.spiralTurn || 0) + Math.PI / enemy.bullets + i * TAU / enemy.bullets; this.line(x + Math.cos(a) * 18, y + Math.sin(a) * 18, x + Math.cos(a) * 28, y + Math.sin(a) * 28, '#b85863', 1.5); } break;
      case 'ambush': ring(tell.targetX * 20, tell.targetY * 20, enemy.popRadius); this.glyph('alert', tell.targetX * 20, tell.targetY * 20 + 4, '!', '#b85863', 14); break;
      case 'spin': this.text('↻', x, y - 18, '#b85863', 12); box(enemy.attackRange * 20, reach()); this.glyph('chevrons', enemy.attackRange * 10, 3, '» » »'); break;
      case 'beat': tone = '#e0a83a'; ring(x, y, enemy.beatRadius); tone = TELL_RED; break;
      case 'thrust': case 'thrust2': {
        const length = (tell.type === 'thrust' ? enemy.attackRange : enemy.followupLength) * 20, width = enemy.thrustWidth * 20;
        box(length, width); break;
      }
      // Chapter 2 bosses (src/engine/factory-bosses.js).
      // Her searchlight (PixelLab cone) sweeping after F2; the red line is where the beam will run.
      case 'irisLaser': if (!this.fbSearchCone(x, y, tell.angle, ai.laserLength, ai.coneDegrees, progress)) { tone = '#e8c860'; sector(ai.laserLength, ai.coneDegrees); tone = TELL_RED; } this.line(x, y, x + Math.cos(tell.angle) * ai.laserLength * 20, y + Math.sin(tell.angle) * ai.laserLength * 20, '#b85863', 2); break;
      case 'verdict': sector(ai.verdictRange, ai.verdictDegrees); break;
      case 'tapeMeasure': box(ai.measureLength * 20, ai.measureWidth * 20); break;
      case 'crossLaser': for (let k = 0; k < 4; k++) { const a = tell.angle + Math.PI / 4 + k * Math.PI / 2; this.line(x, y, x + Math.cos(a) * ai.crossLength * 20, y + Math.sin(a) * ai.crossLength * 20, '#b85863', 1.5); } break;
      // The same ring under all three, so the floor does not give the real one away.
      case 'decoys': ring(x, y, 1.2); for (const d of enemy.decoys || []) if (!d.popped) { c.save(); ring(d.x * 20, d.y * 20, 1.2); c.restore(); } break;
      case 'rejectStamps': case 'gridCheck': case 'rejectOne': ring(x, y, 0.8); break;
      // Press's plates: hidden overhead, a growing shadow and a blinking red frame, then the plate falls (2026-11-08).
      case 'plateDrop': if (this.mark('bossPlate') && this.fbPlateWarn) { for (const d of tell.drops || []) this.fbPlateWarn(d.x, d.y, progress, tell.until - g.s.time); break; } for (const d of tell.drops || []) { c.save(); c.globalAlpha = 0.25 + progress * 0.35; c.fillStyle = '#111522'; c.fillRect((d.x - ai.plateW / 2) * 20, (d.y - ai.plateH / 2) * 20, ai.plateW * 20, ai.plateH * 20); c.restore(); c.strokeRect((d.x - ai.plateW / 2) * 20, (d.y - ai.plateH / 2) * 20, ai.plateW * 20, ai.plateH * 20); } this.overlay(() => { for (const d of tell.drops || []) this.drawMark('bossPlate', d.x * 20, d.y * 20 - 4 - (1 - progress) * 170, ai.plateW * 20 + 4); }); break;
      case 'armSlam': box(ai.armLength * 20, ai.armWidth * 20); this.glyph('chevrons', ai.armLength * 10, 3, '› › ›'); break;
      // Two rows pressed, one spared: red washes for the pressed ones (deepening as they near), a green wash for the safe one.
      case 'twoRows': for (const row of tell.rows || []) { const half = row.half ?? ai.rowWidth / 2, top = (row.y - half) * 20; c.beginPath(); c.rect(-2000, top, 6000, half * 40); if (row.safe) this.washFloor(TELL_BOSS_WASH, SAFE_GREEN); else { this.washFloor(TELL_BOSS_WASH); if (progress > 0) { c.beginPath(); c.rect(-2000, top + ai.rowWidth * 10 * (1 - progress), 6000, ai.rowWidth * 20 * progress); this.washFloor(TELL_FILL); } } } break;
      case 'lineShift': case 'callGuards': case 'wallSqueeze': case 'twinPistons': ring(x, y, 1.4); break;
      case 'finalPress': ring(x, y, 2.4); break;
      // Factory mobs (src/engine/factory-mobs.js).
      case 'grab': box(enemy.attackRange * 20, enemy.grabWidth * 20); this.glyph('chevrons', enemy.attackRange * 10, 3, '› › ›'); break;
      case 'leap': ring(tell.targetX * 20, tell.targetY * 20, enemy.leapRadius); this.glyph('alert', tell.targetX * 20, tell.targetY * 20 + 4, '!', '#b85863', 14); break;
      case 'searchlight': {
        // The beam's lane turning after F2, washed red like any line attack (2026-11-09: the yellow cone looked green on
        // the white floors and did not show that only the thin beam hurts).
        box(enemy.attackRange * 20, reach(enemy.beamWidth));
        break;
      }
      case 'rivets': {
        const spread = enemy.spreadDegrees * Math.PI / 180;
        for (let i = 0; i < enemy.bullets; i++) { const a = tell.angle + (i - (enemy.bullets - 1) / 2) * spread; this.line(x, y, x + Math.cos(a) * enemy.attackRange * 20, y + Math.sin(a) * enemy.attackRange * 20, '#b85863', 1.5); }
        ring(x, y, 0.7); break;
      }
      case 'oil': ring(tell.targetX * 20, tell.targetY * 20, enemy.oilRadius); break;
      case 'supply': {
        tone = '#e0a83a'; ring(x, y, 0.8); tone = TELL_RED;
        for (const ally of g.s.enemies) if (tell.allies?.includes(ally.id) && ally.hp > 0) this.line(x, y, ally.x * 20, ally.y * 20, '#e0a83a', 1.5);
        break;
      }
      case 'dash2': box(enemy.dashDistance * 20, reach()); this.glyph('chevrons', enemy.dashDistance * 10, 3, '» » »'); break;
      case 'doubleWave': case 'eliteWave': ring(x, y, enemy.attackRange + (tell.type === 'eliteWave' ? enemy.followupRadiusBonus : 0)); break;
      case 'march': {
        for (const lane of g.marchLanes(enemy)) this.lanePath(lane, ai.marchWidth, true);
        break;
      }
      case 'alarm': ring(x, y, 1.6); this.glyph('alert', x, y - 44, '!', '#b85863', 15); break;
      case 'bell': ring(x, y, 1.6); this.glyph('bell', x, y - 44, '종', '#b85863', 12); break;
      case 'column': this.rankPreview(tell.path, `대열 행진 ×${g.bossRepeat(enemy, 'ranks')}`); break;
      case 'crane':
        // Rings first: the crates change the fill colour the rings share.
        for (const { x: dx, y: dy } of tell.drops) ring(dx * 20, dy * 20, ai.craneRadius);
        this.overlay(() => { for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170; if (!this.drawFxFrame('crate', 0, dx * 20, top + 16)) { this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); this.rect(dx * 20 - 8, top, 16, 3, '#c79a5e'); } } });
        break;
      case 'crateToss':
        for (const { x: dx, y: dy } of tell.drops) ring(dx * 20, dy * 20, ai.crateTossRadius);
        this.overlay(() => { for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170, art = this.mapImages?.get(HAZARD_ART.crate); if (art) { c.save(); c.imageSmoothingEnabled = false; c.drawImage(art, dx * 20 - 12, top - 10, 24, 26); c.restore(); } else this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); } });
        break;
      case 'parade': this.rankPreview(tell.path, `퍼레이드 ×${g.bossRepeat(enemy, 'ranks')}`); this.text('퍼레이드!', x, y - 70, '#b85863', 12); break;
      case 'drill': ring(x, y, 1.6); this.text('구령 준비!', x, y - 70, '#b85863', 12); break;
      case 'carpet': {
        const lanes = g.marchLanes(enemy, true);
        this.floorWash(progress);
        c.setLineDash([]); this.lanePath(lanes[tell.safe], ai.carpetSafeWidth, 'safe');
        break;
      }
      case 'trumpetWave':
        ring(x, y, 3.6); c.setLineDash([]); c.strokeStyle = '#7c9f7c'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 72, 72 * FLOOR_FLAT, 0, tell.angle - ai.waveGapDegrees * Math.PI / 360, tell.angle + ai.waveGapDegrees * Math.PI / 360); c.stroke(); this.glyph('gap', x + Math.cos(tell.angle) * 82, y + Math.sin(tell.angle) * 82, '틈', '#67805b', 8); break;
    }
    c.restore();
  },
};
