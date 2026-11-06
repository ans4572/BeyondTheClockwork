import { FX, HAZARD_ART } from './fx-sprites.js';

/**
 * What the renderer paints on the floor under the bodies: where a skill will land, the danger floors of enemy attacks
 * and blasts, the flash of a fusion's reach, and Brass's lanes. Installed on CanvasRenderer.prototype (see canvas.js),
 * so `this` is the renderer: its context, game, marks and overlay.
 */
const TAU = Math.PI * 2;
/** Fusion shapes that strike an area of floor, drawn under their pictures (see drawFusionFloors); a shockwave lasts this long. */
const FLOOR_SHAPES = new Set(['self', 'target', 'moving', 'orb', 'clamp']), FLOOR_WAVE_SECONDS = 0.28, FLOOR_FLASH_SECONDS = 0.22;
/**
 * Enemy danger floors, as Lost Ark paints them: one red multiplied into the floor (its pattern shows through), no
 * hatching or outline; a deeper red fills from the attacker outward and the blow lands as it reaches the edge.
 */
const TELL_RED = '#e0303c', TELL_WASH = 0.42, TELL_BOSS_WASH = 0.48, TELL_FILL = 0.35;
/** Each element's reach ring (a MARKS name); a ring fills 124 of its 128 pixels, and the second element's sits inside. */
const FUSION_RINGS = { fire: 'ringFire', ice: 'ringIce', lightning: 'ringLightning', wind: 'ringWind' }, RING_SPAN = 128 / 124, RING_INNER = 0.84;
export const ELEMENT_TINTS = { fire: '#ff7a2f', ice: '#8fe3ff', lightning: '#ffe14d', wind: '#8ff5b4' };

export const floorMarks = {
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
    c.beginPath(); c.arc(x, y, r, 0, TAU); this.washFloor(TELL_WASH);
    if (progress > 0) { c.beginPath(); c.arc(x, y, r * Math.min(1, progress), 0, TAU); this.washFloor(TELL_FILL); }
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
      if (!cast.fusion || cast.derived || cast.done || !FLOOR_SHAPES.has(cast.shape)) continue;
      // Targeted fusions go off once they have gathered.
      const start = ['target', 'orb'].includes(cast.shape) ? cast.delay || 0 : 0;
      if (cast.age < start) continue;
      const [a, b = a] = (cast.elements || []).map(id => ELEMENT_TINTS[id] || '#fff4cd'), x = cast.x * 20, y = cast.y * 20;
      const flash = (cast.age - start) / FLOOR_FLASH_SECONDS;
      const since = cast.pulse > 0 ? cast.age - (cast.next - (cast.interval || 0)) : Infinity, wave = Math.min(1, since / FLOOR_WAVE_SECONDS);
      // The rings of this frame: the opening flash (both elements, with a brief glow on the floor), then each blow's wave.
      const bursts = [];
      if (flash < 1) bursts.push({ grow: 0.55 + 0.45 * ease(flash), alpha: 1 - flash * flash, both: true, glow: 0.2 * (1 - flash) });
      else if (wave < 1) bursts.push({ grow: 0.3 + 0.7 * ease(wave), alpha: 0.45 * (1 - wave) });
      if (!bursts.length) continue;
      // A round reach uses the PixelLab rings (art/fx/marks/ring-fusion-*): the first element's outside, the second's inside.
      const rings = (cast.elements || []).map(id => FUSION_RINGS[id]).filter(name => name && this.mark(name));
      if (cast.shape !== 'clamp' && rings.length) {
        const [outer, inner = outer] = rings, r = cast.radius * 20, size = 2 * r * RING_SPAN;
        for (const { grow, alpha, both, glow } of bursts) {
          if (glow) { c.save(); c.globalAlpha = glow; c.fillStyle = a; c.beginPath(); c.arc(x, y, r * grow, 0, TAU); c.fill(); c.restore(); }
          this.drawMark(outer, x, y, size * grow, { alpha });
          if (both && inner !== outer) this.drawMark(inner, x, y, size * RING_INNER * grow, { alpha: 0.85 * alpha });
        }
        continue;
      }
      // The clamp's box (and any ring still loading): flat-colour lines, as the pixel art around it.
      c.save(); c.translate(x, y);
      if (cast.shape === 'clamp') c.rotate(cast.angle);
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
  /** A long band along a line, filled and outlined in the current colours. */
  lanePath([[ax, ay], [bx, by]], halfWidth, fill) {
    const c = this.ctx, width = halfWidth * 20, length = Math.hypot(bx - ax, by - ay) * 20;
    c.save(); c.translate(ax * 20, ay * 20); c.rotate(Math.atan2(by - ay, bx - ax));
    // A lane about to be marched: a red carpet strip with gold chevrons running along it (scrolling tile).
    if (fill && !this.drawLaneTiles(length, width)) c.fillRect(0, -width, length, width * 2);
    c.strokeRect(0, -width, length, width * 2); c.restore();
  },
  /** Lays the march-lane tile along the x axis from 0 to `length`, `width` either side; false while its sheet loads. */
  drawLaneTiles(length, width) {
    const fx = FX.marchLane, image = this.mapImages?.get(fx.sheet);
    if (!image) return false;
    const c = this.ctx, sy = width * 2 / fx.h, scroll = Math.floor(this.visualTime * 24) % fx.w;
    c.save(); c.globalAlpha *= 0.75; c.beginPath(); c.rect(0, -width, length, width * 2); c.clip();
    // The chevrons march along the lane: the tile row slides forward and wraps.
    for (let x = scroll - fx.w; x < length; x += fx.w) c.drawImage(image, 0, 0, fx.w, fx.h, x, -width, fx.w, fx.h * sy);
    c.restore(); return true;
  },
  /** Everywhere that will be hit, in a wash that deepens as the blow comes. */
  floorWash(progress) {
    const c = this.ctx, walkable = this.game.map?.walkable, { left, top, right, bottom } = this.game.config.arena.bounds;
    const points = walkable || [[left, top], [right, top], [right, bottom], [left, bottom]];
    c.save(); c.setLineDash([]); c.fillStyle = `rgba(190, 81, 95, ${0.1 + progress * 0.2})`; c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x * 20, y * 20) : c.moveTo(x * 20, y * 20))); c.closePath(); c.fill(); c.restore();
  },
  columnPreview() {
    const g = this.game, ai = g.config.bossAI.captainBrass, { start } = g.map?.column || {}, { left, top, bottom } = g.config.arena.bounds;
    const [a, b] = start || [[left, top], [left, bottom]];
    this.line(a[0] * 20, a[1] * 20, b[0] * 20, b[1] * 20, '#b85863', 2); this.text(`대열 행진`, (a[0] + b[0]) * 10, (a[1] + b[1]) * 10 - 8, '#b85863', 10);
    return ai;
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
    const ring = (cx, cy, radius) => { c.beginPath(); c.arc(cx, cy, radius * 20, 0, TAU); paint(); fillTo(() => c.arc(cx, cy, radius * 20 * progress, 0, TAU)); };
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
      case 'stickers': counted('sticker', '불량 ×' + ai.stickerCount, ai.stickerCount, x, y - 46); break;
      case 'stomp': ring(x, y, 1.2); counted('stomp', '쿵 ×' + ai.stompRings, ai.stompRings, x, y - 46); break;
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
        this.overlay(() => { for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170; if (!this.drawFxFrame('crate', 0, dx * 20, top + 16)) { this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); this.rect(dx * 20 - 8, top, 16, 3, '#c79a5e'); } } });
        break;
      case 'crateToss':
        for (const { x: dx, y: dy } of tell.drops) ring(dx * 20, dy * 20, ai.crateTossRadius);
        this.overlay(() => { for (const { x: dx, y: dy } of tell.drops) { const top = dy * 20 - 16 - (1 - progress) * 170, art = this.mapImages?.get(HAZARD_ART.crate); if (art) { c.save(); c.imageSmoothingEnabled = false; c.drawImage(art, dx * 20 - 12, top - 10, 24, 26); c.restore(); } else this.rect(dx * 20 - 8, top, 16, 14, '#a36f3d'); } });
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
  },
};
