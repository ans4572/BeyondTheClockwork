// What chapter 2's bosses put in the room, drawn in code (src/engine/factory-bosses.js): Iris's falling stamps, cross
// laser, inspection grid and decoys, her mirror break; Press's plates, moving line, closing walls, moulds and their
// sample, the safe cell of the final press, the pylon and twin piston breaks; and F2's failing marks. Installed on
// CanvasRenderer.prototype, so `this` is the renderer.
import { FLOOR_FLAT } from '../engine/math.js';
import { HAZARD_ART, MIRROR_WAYS } from './fx-sprites.js';

const TAU = Math.PI * 2, RED = '#d8423c', AMBER = '#ffbe20', NAVY = '#2b3345';
/** Safe floor is washed into the floor like the red attack warnings (floor-marks.js washFloor), only green (2026-11-09). */
const SAFE = '#2fae63', SAFE_WASH = 0.45, DANGER = '#e0303c', DANGER_WASH = 0.45;

export const factoryBossDraw = {
  fbEllipse(x, y, r, fill, stroke, width = 2, dash) {
    const c = this.ctx; c.save(); if (dash) c.setLineDash(dash); c.beginPath(); c.ellipse(x * 20, y * 20, r * 20, r * 20 * FLOOR_FLAT, 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(); } c.restore();
  },
  /** Under the bodies: everything that lies on the floor. */
  drawFactoryBossFloor() {
    const g = this.game, s = g.s, t = s.time, c = this.ctx;
    for (const f of s.bossFields || []) {
      if (f.kind === 'stamp') { const k = 1 - Math.max(0, Math.min(1, (f.at - t) / 0.8)), col = f.pass ? SAFE : DANGER; this.fbWashEllipse(f.x, f.y, f.radius, col, DANGER_WASH); if (k > 0) this.fbWashEllipse(f.x, f.y, f.radius * k, col, 0.35); }
      if (f.kind === 'grid') this.fbGridCells(f, t);
      // Each mould sits in a brass tray (PixelLab); the outline that tells them apart stays drawn on top.
      if (f.kind === 'molds') for (const m of f.molds) this.fbMoldArt(m.x * 20, m.y * 20, m.shape, 0.6);
      if (f.kind === 'rhythm') this.fbRhythmFloor(f, t);
      if (f.kind === 'crane') this.fbCraneShadow(f, t);
      if (f.kind === 'valves') this.fbValves(f, t);
      if (f.kind === 'twins') this.fbTwinSlams(f.twins, g.config.bossAI.directorPress.twinSlamRadius, g.config.bossAI.directorPress.twinSlamWarn);
      if (f.kind === 'walls') this.fbWalls(f, t);
    }
    // Floor flow: chevrons sliding the way the line runs, red just before it turns.
    if (s.flow) {
      const warn = t >= s.flow.flipAt - 1 && !s.flow.flipped, step = (t * 30 * s.flow.dir) % 40, [w, h] = g.map?.size || [36, 18];
      c.save(); c.strokeStyle = warn && Math.floor(t * 8) % 2 ? RED : AMBER; c.globalAlpha = 0.55; c.lineWidth = 2;
      const [x0, y0, x1, y1] = g.map?.arena || [0, 0, w, h];
      for (let y = y0 + 2; y < y1; y += 3) for (let x = x0 - 2; x < x1 + 2; x += 2) { const px = x * 20 + step, py = y * 20; c.beginPath(); c.moveTo(px - 5 * s.flow.dir, py - 6); c.lineTo(px + 4 * s.flow.dir, py); c.lineTo(px - 5 * s.flow.dir, py + 6); c.stroke(); }
      c.restore();
    }
    for (const enemy of s.enemies) {
      if (enemy.hp <= 0) continue;
      const tell = enemy.tell, b = enemy.breaking;
      // The burst coming: the floor whitens with steam everywhere but the open valves' circles (drawn after, on top).
      if (tell?.type === 'steamBurst') { const k = Math.min(1, (t - tell.started) / (tell.until - tell.started)), [x0, y0, x1, y1] = g.map?.arena || [0, 0, 36, 18]; c.save(); c.globalAlpha = 0.15 + k * 0.45; c.fillStyle = '#f6f2ea'; c.fillRect(x0 * 20, y0 * 20, (x1 - x0) * 20, (y1 - y0) * 20); c.restore(); for (const f of s.bossFields || []) if (f.kind === 'valves') this.fbValves(f, t); }
      if (tell?.type === 'finalPress' && tell.safe) this.fbWashEllipse(tell.safe.x, tell.safe.y, 1.2, SAFE, SAFE_WASH + 0.1);
      if (enemy.armStuck?.until > t) { const a = enemy.armStuck; c.save(); c.globalAlpha = 0.6 + Math.sin(t * 12) * 0.3; this.fbEllipse(a.x, a.y, 0.7, '#ff9a3c', NAVY, 1.5); c.restore(); this.drawMark('armStuck', a.x * 20, a.y * 20 - 13, 34); }
      if (!b) continue;
      if (b.kind === 'mirrors') {
        const len = 14 * 20;
        if (!this.fbBeam(enemy.x * 20, enemy.y * 20 - 20, b.sweep, len, 0.8)) {
          c.save(); c.globalAlpha = 0.45; c.strokeStyle = '#ffe58a'; c.lineWidth = 8; c.beginPath(); c.moveTo(enemy.x * 20, enemy.y * 20 - 20); c.lineTo(enemy.x * 20 + Math.cos(b.sweep) * len, enemy.y * 20 + Math.sin(b.sweep) * len); c.stroke(); c.restore();
          this.line(enemy.x * 20, enemy.y * 20 - 20, enemy.x * 20 + Math.cos(b.sweep) * len, enemy.y * 20 + Math.sin(b.sweep) * len, '#fff1f3', 2);
        }
        for (const m of b.mirrors) {
          if (m.aimed && !m.lit) this.fbEllipse(m.x, m.y, 0.6, 'rgba(207, 233, 242, 0.45)', '#7fd8f0', 1.5);
          this.fbMirror(m, enemy, t);
        }
      }
      if (b.kind === 'pylons') {
        for (const py of b.pylons) if (this.mark('pylon')) this.drawMark(py.broken ? 'pylonBroken' : 'pylon', py.x * 20, py.y * 20 - (py.broken ? 16 : 19), py.broken ? 26 : 25); else { this.rect(py.x * 20 - 7, py.y * 20 - 30, 14, 30, NAVY); this.rect(py.x * 20 - 5, py.y * 20 - 28, 10, 26, py.broken ? '#6b4a3a' : '#8a93a6'); this.rect(py.x * 20 - 3, py.y * 20 - 26, 6, 4, py.broken ? '#3d4352' : AMBER); }
        for (const plate of b.plates) if (this.mark('bossPlate')) { const rule = g.breakRule(enemy, b.index); this.fbPlateWarn(plate.x, plate.y, 1 - Math.max(0, (plate.at - t) / rule.plateWarn), plate.at - t); }
        else for (const plate of b.plates) { const ai = g.config.bossAI.directorPress, k = Math.max(0, (plate.at - t) / 0.8); if (k > 0) this.overlay(() => this.drawMark('bossPlate', plate.x * 20, plate.y * 20 - 4 - Math.min(1, k) * 170, ai.plateW * 20 + 4)); c.save(); c.globalAlpha = 0.25 + (1 - k) * 0.35; c.fillStyle = '#111522'; c.fillRect((plate.x - ai.plateW / 2) * 20, (plate.y - ai.plateH / 2) * 20, ai.plateW * 20, ai.plateH * 20); c.restore(); c.save(); c.strokeStyle = RED; c.lineWidth = 2; c.strokeRect((plate.x - ai.plateW / 2) * 20, (plate.y - ai.plateH / 2) * 20, ai.plateW * 20, ai.plateH * 20); c.restore(); }
      }
    }
  },
  /** Over the bodies: Iris's decoys and cross laser, the twin pistons, a boss's sample mould or pressure gauge, F2's marks. */
  drawFactoryBossOver(mobPoses) {
    const g = this.game, s = g.s, t = s.time, c = this.ctx;
    for (const f of s.bossFields || []) {
      if (f.kind === 'cross') { const ai = g.config.bossAI.inspectorIris; for (let k = 0; k < 4; k++) { const a = f.angle + k * Math.PI / 2; const out = this.fbBodyEdge(a), sx = f.x * 20 + Math.cos(a) * out, sy = f.y * 20 - 20 + Math.sin(a) * out; if (this.fbBeam(sx, sy, a, ai.crossLength * 20 - out, 1)) continue; c.save(); c.globalAlpha = 0.35; this.line(f.x * 20, f.y * 20 - 20, (f.x + Math.cos(a) * ai.crossLength) * 20, (f.y + Math.sin(a) * ai.crossLength) * 20, '#ff5a6e', 7); c.restore(); this.line(f.x * 20, f.y * 20 - 20, (f.x + Math.cos(a) * ai.crossLength) * 20, (f.y + Math.sin(a) * ai.crossLength) * 20, '#fff1f3', 2); } }
      // Press's two rows: plates side by side the width of the floor drop in 0.12 s, sit, and fade.
      if (f.kind === 'rhythm') this.fbRhythmHeads(f, t);
      if (f.kind === 'crane') this.fbCraneClaw(f, t);
      if (f.kind === 'rowSlam') {
        const ai = g.config.bossAI.directorPress, age = t - f.start, drop = Math.max(0, 1 - age / 0.12) * 120, fade = age < 0.3 ? 1 : Math.max(0, 1 - (age - 0.3) / 0.25), step = ai.plateW;
        // A wide band takes its plates in as many rows as fill it (2026-11-10: the bands tile the floor now).
        const bands = f.rows || [];
        for (const { y: mid, half } of bands) {
          c.save(); c.globalAlpha = 0.35 * fade; c.fillStyle = '#111522'; c.fillRect((f.ax) * 20, (mid - half) * 20, f.w * 20, half * 40); c.restore();
          const rows = Math.max(1, Math.round(half * 2 / ai.rowWidth)), pitch = half * 2 / rows;
          for (let r = 0; r < rows; r++) { const y = mid - half + pitch * (r + 0.5); for (let x = f.ax + step / 2; x < f.ax + f.w; x += step) {
            if (!this.drawMark('bossPlate', x * 20, y * 20 - 4 - drop, step * 20 + 2, { alpha: fade })) { c.save(); c.globalAlpha = fade; this.rect((x - step / 2) * 20, (y - pitch / 2) * 20 - drop, step * 20, pitch * 20, '#6c7486'); c.restore(); }
          } }
        }
      }
      // The sample stays over F2 while the moulds are out too, so the hunt is telling it from its mirror image, not memory.
      if (f.kind === 'sample' || f.kind === 'molds') { const owner = s.enemies.find(e => e.id === f.owner); if (owner) this.fbSampleCard(owner, f.sample, f.kind === 'molds' ? Math.max(0, f.at - t) / g.config.bossAI.directorPress.moldChoose : null); }
    }
    for (const enemy of s.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.tell?.type === 'finalPress') {
        const ai = g.config.bossAI[enemy.type], share = Math.max(0, 1 - (enemy.finalDealt || 0) / (enemy.maxHp * ai.finalNeed)), left = Math.max(0, enemy.tell.until - t), x = enemy.x * 20, y = enemy.y * 20 - 120;
        this.rect(x - 42, y - 6, 84, 10, NAVY); this.rect(x - 40, y - 4, 80 * share, 6, '#ffd257'); this.text(`${left.toFixed(1)}초`, x + 56, y + 3, '#ffd257', 10);
      }
      if (enemy.valvesOut && enemy.pressure !== undefined) this.fbGauge(enemy, t);
      if (enemy.tell?.type === 'verdict') { if (t >= enemy.tell.until - g.bossRepeat(enemy, 'verdictWindow')) { this.fbEllipse(enemy.x, enemy.y - 2.2, 0.6, 'rgba(127, 216, 240, 0.5)', '#2b6f8a', 2); this.text('반격!', enemy.x * 20, enemy.y * 20 - 66, '#2b6f8a', 11); } }
      for (const f of s.bossFields || []) if (f.kind === 'twins' && f.owner === enemy.id) this.fbTwinBodies(f.twins, g.config.bossAI.directorPress.twinHits, t);
    }
    // F2's failing marks: up to three red tags over her head, flashing when they are about to blow.
    const p = g.p;
    if (p.grabbed) this.drawMark('grabClamp', p.x * 20, p.y * 20 - 20, 30);
    if (p.heldUntil > t || p.grabbed) this.drawDaze(p.x * 20, p.y * 20 - 50);
    if (p.failStacks && this.mark('failTag')) for (let i = 0; i < p.failStacks; i++) { const flash = p.failBlastAt && Math.floor(t * 10) % 2; this.drawMark('failTag', p.x * 20 - 15 + i * 15, p.y * 20 - 50 + Math.sin(t * 5 + i) * 1.5, 14, { tint: flash ? '#ffffff' : null }); }
    else if (p.failStacks) for (let i = 0; i < p.failStacks; i++) { const flash = p.failBlastAt && Math.floor(t * 10) % 2; this.rect(p.x * 20 - 13 + i * 9, p.y * 20 - 46, 7, 7, NAVY); this.rect(p.x * 20 - 12 + i * 9, p.y * 20 - 45, 5, 5, flash ? '#fff1f3' : RED); }
  },
  /** Iris facing south, standing on x, y (her feet), at her sprite's size, with the same contact shadow as every body.
   *  `stamp`: the real one holds her reject stamp, her decoys hold nothing; that is the only way to tell them apart
   *  (2026-11-08). False while the picture is missing. */
  fbIrisStill(x, y, stamp, white = 0) {
    const image = this.mark(stamp ? 'irisSouth' : 'irisSouthPlain'), c = this.ctx; if (!image) return false;
    const size = 0.5, bob = Math.sin(this.game.s.time * 3) > 0 ? 0.5 : 0, left = Math.round((x - 75.5 * size) * 2) / 2, top = Math.round((y - 143 * size - bob) * 2) / 2;
    c.fillStyle = 'rgba(24, 20, 36, 0.34)'; c.beginPath(); c.ellipse(x, y, 13, 4.5, 0, 0, TAU); c.fill();
    c.imageSmoothingEnabled = false; c.drawImage(image, left, top, image.width * size, image.height * size); c.imageSmoothingEnabled = false;
    if (white > 0) this.whiteOver(image, 0, 0, image.width, image.height, left, top, image.width * size, image.height * size, white);
    return true;
  },
  /** Iris's searchlight cone (PixelLab, apex at 8, 70 of a 192 x 140 picture, about 32 degrees wide) laid on the floor
   *  from her feet along `a`, stretched to `length` units and `degrees` wide, brighter as the shot nears. */
  fbSearchCone(x, y, a, length, degrees, progress) {
    const image = this.mark('searchCone'), c = this.ctx; if (!image) return false;
    const sx = length * 20 / 175, sy = length * 20 * Math.tan(degrees * Math.PI / 360) / 49;
    c.save(); c.globalAlpha *= 0.45 + progress * 0.4; c.translate(x, y); c.rotate(a); c.scale(sx, sy); c.imageSmoothingEnabled = false;
    c.drawImage(image, -8, -70.5); c.restore(); return true;
  },
  /** A mould tray (PixelLab, one per toy shape) centred on x, y at `size` of its picture, mirrored when the shape is.
   *  `bare` leaves out the floor shadow (the sample card). False while the picture is missing. */
  fbMoldArt(x, y, shape, size, bare = false) {
    const name = shape?.shape && 'mold' + shape.shape[0].toUpperCase() + shape.shape.slice(1), image = name && this.mark(name), c = this.ctx; if (!image) return false;
    const w = image.width * size, h = image.height * size;
    if (!bare) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#0e121a'; c.beginPath(); c.ellipse(x, y + h / 2 - 2, w / 2, 5, 0, 0, TAU); c.fill(); c.restore(); }
    c.save(); c.translate(x, y); if (shape.flip) c.scale(-1, 1); c.imageSmoothingEnabled = false; c.drawImage(image, -w / 2, -h / 2, w, h); c.restore(); return true;
  },
  /** A press plate on its way: the shadow grows and a red frame blinks faster as it nears; it falls in the last 0.16 s. */
  fbPlateWarn(x, y, progress, left) {
    const c = this.ctx, ai = this.game.config.bossAI.directorPress, w = ai.plateW * 20, h = ai.plateH * 20, k = Math.max(0, Math.min(1, progress));
    c.save(); c.globalAlpha = 0.2 + k * 0.35; c.fillStyle = '#0e121a'; c.beginPath(); c.ellipse(x * 20, y * 20, w / 2 * (0.5 + k * 0.5), h / 2 * (0.5 + k * 0.5), 0, 0, TAU); c.fill(); c.restore();
    const blink = Math.floor(this.game.s.time * (k > 0.6 ? 14 : 6)) % 2;
    c.save(); c.globalAlpha = blink ? 0.9 : 0.5; c.strokeStyle = '#d8423c'; c.lineWidth = 2; c.beginPath(); if (c.roundRect) c.roundRect(x * 20 - w / 2, y * 20 - h / 2, w, h, 4); else c.rect(x * 20 - w / 2, y * 20 - h / 2, w, h); c.stroke(); c.restore();
    if (left < 0.16 && left > 0) { const drop = left / 0.16 * 150; this.overlay(() => this.drawMark('bossPlate', x * 20, y * 20 - 6 - drop, w + 2)); }
  },
  /** Press's crusher walls (PixelLab top and edge): iron plates sliding in from both sides, the top face patterned and a
   *  darker front face along the bottom for height; the leading edge a brass beam of red lamps; the way through each wall
   *  an open gap with green lamps either side and a faint green glow on the floor. */
  fbWalls(f, t) {
    const c = this.ctx, ax = f.ax || 0, top = (f.ay || 0) * 20, bottom = top + f.h * 20, size = (f.gap || 2.6) * 20, top2 = this.mark('wallTop'), edge = this.mark('wallEdge');
    // The strip the walls stop short of is green from the moment they start (user's choice, 2026-11-10), edged by
    // pulsing green lines where the walls will halt.
    const leave = this.game.config.bossAI.directorPress.wallLeave, sx0 = (f.cx - leave / 2) * 20, sx1 = (f.cx + leave / 2) * 20;
    c.beginPath(); c.rect(sx0, top, sx1 - sx0, bottom - top); this.washFloor(SAFE_WASH, SAFE);
    c.save(); c.globalAlpha = 0.55 + Math.sin(t * 6) * 0.25; c.fillStyle = '#7fe0a0'; c.fillRect(sx0 - 1, top, 2, bottom - top); c.fillRect(sx1 - 1, top, 2, bottom - top); c.restore();
    for (const [from, to, gap, inner] of [[ax, f.left, f.gaps[0], f.left], [f.right, ax + f.w, f.gaps[1], f.right]]) {
      if (!(to - from > 0)) continue;
      const x0 = from * 20, x1 = to * 20, gy0 = gap.y * 20 - size / 2, gy1 = gap.y * 20 + size / 2, ex = inner * 20;
      for (const [y0, y1] of [[top, gy0], [gy1, bottom]]) {
        if (y1 - y0 < 2) continue;
        c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0 - 10); c.clip();
        // The pattern moves with the wall's leading edge, so the plates slide in rather than the wall growing over them.
        // One pattern for every wall and frame (2026-11-09: one was made per wall piece each frame).
        const pattern = this.wallPattern?.image === top2 ? this.wallPattern.fill : (this.wallPattern = { image: top2, fill: c.createPattern(top2, 'repeat') }).fill; if (pattern.setTransform) pattern.setTransform(new DOMMatrix().translate(ex, 0).scale(0.5)); c.fillStyle = pattern; c.fillRect(x0, y0, x1 - x0, y1 - y0); c.restore();
        // Front face: the wall's height showing at its lower edge.
        c.save(); const grad = c.createLinearGradient(0, y1 - 10, 0, y1); grad.addColorStop(0, '#2b2f3e'); grad.addColorStop(1, '#141722'); c.fillStyle = grad; c.fillRect(x0, y1 - 10, x1 - x0, 10); c.fillStyle = '#c79a3e'; c.fillRect(x0, y1 - 10, x1 - x0, 1); c.restore();
        // Leading edge: the brass beam tiled down it.
        if (edge) { c.save(); c.imageSmoothingEnabled = false; for (let y = y0; y < y1; y += edge.height) c.drawImage(edge, 0, 0, edge.width, Math.min(edge.height, y1 - y), ex - edge.width / 2, y, edge.width, Math.min(edge.height, y1 - y)); c.restore(); }
      }
      // The way through: green floor glow and a green lamp at each side of the opening.
      c.beginPath(); c.rect(x0, gy0, x1 - x0, gy1 - gy0); this.washFloor(SAFE_WASH, SAFE);
      const on = Math.floor(t * 4) % 2 ? 1 : 0.6;
      for (const ly of [gy0 + 2, gy1 - 12]) { c.save(); c.globalAlpha = on; c.fillStyle = '#7fe0a0'; c.beginPath(); c.arc(ex, ly, 3.5, 0, TAU); c.fill(); c.globalAlpha = on * 0.35; c.beginPath(); c.arc(ex, ly, 8, 0, TAU); c.fill(); c.restore(); }
    }
  },
  /** Where each twin piston is about to slam: an amber ring and a red ring closing in. */
  fbTwinSlams(twins, radius, warn) {
    const t = this.game.s.time;
    for (const tw of twins) if (tw.slam) { const k = Math.max(0.2, (tw.slam.at - t) / warn); this.fbEllipse(tw.slam.x, tw.slam.y, radius, 'rgba(216, 66, 60, 0.2)', AMBER, 2); this.fbEllipse(tw.slam.x, tw.slam.y, radius * k, null, RED, 1.5); }
  },
  /** The twin pistons themselves with how many blows each still needs. */
  fbTwinBodies(twins, hits, t) {
    const c = this.ctx;
    for (const tw of twins) {
      const x = tw.x * 20, y = tw.y * 20, stopped = tw.stoppedAt !== null;
      c.save(); c.globalAlpha = 0.3; c.fillStyle = '#0e121a'; c.beginPath(); c.ellipse(x, y + 2, 12, 4, 0, 0, TAU); c.fill(); c.restore();
      const shake = stopped ? 0 : Math.sin(t * 30) * 1;
      if (!this.drawMark('piston', x + shake, y - 21, 23, { alpha: stopped ? 0.7 : 1 })) { this.rect(x - 7, y - 34, 14, 24, NAVY); this.rect(x - 5, y - 32, 10, 20, stopped ? '#6c7486' : '#9aa3b5'); }
      this.rect(x - 16, y - 46, 32, 6, NAVY); this.rect(x - 15, y - 45, 30 * Math.max(0, 1 - tw.hits / hits), 4, '#ff9a3c');
    }
  },
  /**
   * A mirror that turns through eight ways (2026-11-09): a brass dial on the floor with eight notches and an arrow the way
   * the glass faces (gold, green once it faces Iris); the head turns with it, edge-on toward north and south and darker
   * when its back is to the viewer. Each turn swings over a quarter second.
   */
  fbMirror(m, enemy, t) {
    const image = this.mark(m.lit ? 'mirrorLit' : 'mirror'), c = this.ctx, x = m.x * 20, y = m.y * 20, cut = 22;
    const goal = m.dir * Math.PI / 4, k = Math.min(1, (t - (m.turnedAt ?? -9)) / 0.25), from = m.from ?? goal;
    const a = from + (((goal - from + Math.PI * 3) % TAU) - Math.PI) * k, ok = m.aimed;
    // The dial.
    c.save(); c.globalAlpha = 0.85; c.strokeStyle = '#c79a3e'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 17, 17 * FLOOR_FLAT, 0, 0, TAU); c.stroke();
    for (let i = 0; i < 8; i++) { const b = i * Math.PI / 4; c.beginPath(); c.moveTo(x + Math.cos(b) * 13, y + Math.sin(b) * 13 * FLOOR_FLAT); c.lineTo(x + Math.cos(b) * 17, y + Math.sin(b) * 17 * FLOOR_FLAT); c.stroke(); }
    c.fillStyle = ok ? '#7fe0a0' : '#ffd257'; c.strokeStyle = NAVY; c.lineWidth = 1.5; c.beginPath();
    const tip = [x + Math.cos(a) * 30, y + Math.sin(a) * 30 * FLOOR_FLAT], side = a + Math.PI / 2;
    c.moveTo(...tip); c.lineTo(x + Math.cos(a) * 12 + Math.cos(side) * 7, y + (Math.sin(a) * 12 + Math.sin(side) * 7) * FLOOR_FLAT); c.lineTo(x + Math.cos(a) * 12 - Math.cos(side) * 7, y + (Math.sin(a) * 12 - Math.sin(side) * 7) * FLOOR_FLAT); c.closePath(); c.fill(); c.stroke(); c.restore();
    // The mirror itself: the picture drawn from the side it faces (eight PixelLab rotations, 2026-11-09). A turn swaps to
    // the next picture halfway, with a small squash as it swings; lit, it glows gold. The old one-picture squash stays as
    // the fallback while the eight are missing.
    const way = k < 0.5 ? (Math.round((m.from ?? goal) / (Math.PI / 4)) % 8 + 8) % 8 : m.dir, turned = this.mark(`mirror8_${MIRROR_WAYS[way]}`);
    if (turned) {
      const w = turned.width, h = turned.height, squash = 1 - 0.18 * Math.sin(Math.PI * k);
      c.save(); c.imageSmoothingEnabled = false; c.translate(x, y + 2); c.scale(squash, 1);
      if (m.lit) c.filter = 'brightness(1.25) sepia(0.55) saturate(1.9)';
      c.drawImage(turned, -w / 2, -h, w, h); c.restore();
      if (m.lit) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + Math.sin(t * 6) * 0.1; const glow = c.createRadialGradient(x, y - h * 0.62, 0, x, y - h * 0.62, 16); glow.addColorStop(0, '#ffe58a'); glow.addColorStop(1, 'rgba(255, 229, 138, 0)'); c.fillStyle = glow; c.fillRect(x - 16, y - h * 0.62 - 16, 32, 32); c.restore(); }
    } else if (image) {
      const w = image.width, h = image.height, left = x - w / 2, top = y - h + 2, cos = Math.cos(a), sx = (cos >= 0 ? -1 : 1) * Math.max(0.3, Math.abs(cos));
      c.save(); c.imageSmoothingEnabled = false; c.drawImage(image, 0, cut, w, h - cut, left, top + cut, w, h - cut);
      c.translate(x, top + cut); c.scale(sx, 1); if (Math.sin(a) < -0.3) c.filter = 'brightness(0.6)'; c.drawImage(image, 0, 0, w, cut, -w / 2, -cut, w, cut); c.restore();
    } else return;
    const top = y - (turned || image).height + 2;
    if (ok && !m.lit) { c.save(); c.globalAlpha = 0.55; c.setLineDash([3, 5]); c.strokeStyle = '#7fe0a0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, top + 10); c.lineTo(enemy.x * 20, enemy.y * 20 - 30); c.stroke(); c.restore(); }
  },
  /** Press's work-signal lanes on the floor: dashed brass outlines; the lane(s) of the next beat lit red and blinking. */
  fbRhythmFloor(f, t) {
    const c = this.ctx, k = f.order[f.next], next = k === undefined ? [] : [].concat(k), blink = Math.floor(t * 10) % 2;
    f.lanes.forEach((x, i) => {
      const lit = next.includes(i), x0 = (x - f.lw / 2) * 20, y0 = f.ay * 20, w = f.lw * 20, h = f.h * 20;
      c.save(); c.globalAlpha = lit ? 0.18 + (blink ? 0.12 : 0) : 0.06; c.fillStyle = lit ? RED : '#c79a3e'; c.fillRect(x0, y0, w, h); c.restore();
      c.save(); c.globalAlpha = lit ? 0.9 : 0.4; c.strokeStyle = lit ? RED : '#c79a3e'; c.lineWidth = lit ? 2 : 1.5; c.setLineDash([6, 5]); c.strokeRect(x0, y0, w, h); c.restore();
      c.save(); c.fillStyle = NAVY; c.beginPath(); c.arc(x * 20, y0 + 8, 5, 0, TAU); c.fill(); c.fillStyle = lit && blink ? '#ff5a4e' : lit ? '#a92f2b' : '#5b4a3a'; c.beginPath(); c.arc(x * 20, y0 + 8, 3.5, 0, TAU); c.fill(); c.restore();
    });
  },
  /** The lane just pressed: press heads (the room's PixelLab head) slam down its length, then lift and fade. */
  fbRhythmHeads(f, t) {
    if (!f.lastHit || t - f.lastAt > 0.32) return;
    const c = this.ctx, head = this.mapImages?.get(HAZARD_ART.pressHead), age = t - f.lastAt, drop = age < 0.06 ? (1 - age / 0.06) * 60 : 0, fade = age < 0.18 ? 1 : 1 - (age - 0.18) / 0.14;
    for (const i of f.lastHit) {
      const x = f.lanes[i];
      c.save(); c.globalAlpha = 0.4 * fade; c.fillStyle = '#0e121a'; c.fillRect((x - f.lw / 2) * 20, f.ay * 20, f.lw * 20, f.h * 20); c.restore();
      for (let y = f.ay + 1.5; y < f.ay + f.h; y += 3) {
        if (head) { const w = f.lw * 20 + 4, h = w * head.height / head.width; c.save(); c.globalAlpha = fade; c.imageSmoothingEnabled = false; c.drawImage(head, x * 20 - w / 2, y * 20 - h + 6 - drop, w, h); c.restore(); }
        else { c.save(); c.globalAlpha = fade; this.rect((x - f.lw / 2) * 20, y * 20 - 18 - drop, f.lw * 20, 20, '#4a4f60'); c.restore(); }
      }
    }
  },
  /** The crane's shadow: grey while it follows F2, reddening and blinking once it stops; gone while it carries. */
  fbCraneShadow(f, t) {
    if (f.phase === 'carry') return;
    const warn = f.phase === 'warn', r = this.game.config.bossAI.directorPress.craneRadius;
    this.fbEllipse(f.x, f.y, r, warn ? 'rgba(14, 18, 26, 0.5)' : 'rgba(14, 18, 26, 0.3)', warn && Math.floor(t * 14) % 2 ? RED : warn ? '#a92f2b' : AMBER, warn ? 2.5 : 1.5);
  },
  /** The claw on its chain: open over the shadow, dropping in the last 0.15 s of the warning, shut while it carries. */
  fbCraneClaw(f, t) {
    const c = this.ctx, carry = f.phase === 'carry', image = this.mark(carry ? 'craneShut' : 'craneOpen'); if (!image) return;
    const left = f.phase === 'warn' ? f.dropAt - t : 1, high = carry ? 34 : left < 0.15 ? 20 + (left / 0.15) * 90 : 110;
    const w = image.width / 2, h = image.height / 2, x = f.x * 20, bottom = f.y * 20 - high + h * 0.55;
    // The chain in whole pixels: a dark 2 px line with a lit link every 4 px.
    const cx = Math.round(x) - 1, top = Math.round(bottom - h - 400), end = Math.round(bottom - h + 2); this.rect(cx, top, 2, end - top, '#3d4352');
    c.fillStyle = '#6b7385'; for (let cy = end - 3; cy > top; cy -= 4) c.fillRect(cx, cy, 1, 2);
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(image, x - w / 2, bottom - h, w, h); c.restore();
  },
  /** Steam valves at the four corners: open ones (PixelLab) with a green safe circle; shut ones show how many blows remain. */
  fbValves(f, t) {
    const ai = this.game.config.bossAI.directorPress, owner = this.game.s.enemies.find(e => e.id === f.owner), burst = owner?.tell?.type === 'steamBurst';
    for (const v of f.valves) {
      const open = v.openUntil > t, left = v.openUntil - t;
      if (open) this.fbWashEllipse(v.x, v.y, ai.valveRadius, SAFE, burst ? SAFE_WASH + Math.sin(t * 12) * 0.12 : SAFE_WASH * 0.7);
      const image = this.mark(open ? 'valveOpen' : 'valveShut');
      if (image) { const c = this.ctx, w = image.width / 2, h = image.height / 2; c.save(); c.imageSmoothingEnabled = false; c.drawImage(image, v.x * 20 - w / 2, v.y * 20 - h + 3, w, h); c.restore(); }
      if (open) this.text(`${Math.ceil(left)}초`, v.x * 20, v.y * 20 - 48, '#3c8a5a', 9);
      else for (let i = 0; i < ai.valveHits; i++) this.rect(v.x * 20 - 9 + i * 7, v.y * 20 - 50, 5, 5, i < v.hits ? '#ffd257' : NAVY);
    }
  },
  /** Press's chest gauge over his head once it turns: filling red, blinking when the burst is near. */
  fbGauge(enemy, t) {
    const x = enemy.x * 20, y = enemy.y * 20 - 128, k = Math.min(1, enemy.pressure / 100), hot = k >= 0.75 && Math.floor(t * 8) % 2;
    this.rect(x - 32, y - 5, 64, 9, NAVY); this.rect(x - 30, y - 3, 60 * k, 5, hot ? '#ff9a3c' : RED);
    this.text(enemy.tell?.type === 'steamBurst' ? '증기 분출!' : `압력 ${Math.round(enemy.pressure)}%`, x, y - 9, enemy.tell?.type === 'steamBurst' ? '#ffffff' : '#ffd257', 9);
  },
  /** A floor ellipse (x, y, r in units) washed in `color` the way attack warnings are. */
  fbWashEllipse(x, y, r, color, alpha) { const c = this.ctx; c.beginPath(); c.ellipse(x * 20, y * 20, r * 20, r * 20 * FLOOR_FLAT, 0, 0, TAU); this.washFloor(alpha, color); },
  /** How far from Iris's chest (20 px over her feet) a beam along `a` leaves her body on screen, so her cross laser
   *  starts at her outline instead of drawing over her (2026-11-08). Her body: about 40 px wide, 68 tall. */
  fbBodyEdge(a) {
    const dx = Math.abs(Math.cos(a)), dy = Math.sin(a), across = dx > 1e-3 ? 19 / dx : Infinity, along = dy < -1e-3 ? 50 / -dy : dy > 1e-3 ? 22 / dy : Infinity;
    return Math.min(across, along) + 3;
  },
  /**
   * Iris's inspection rings, drawn like the hall's own measuring circles: a middle disc and two rings of four pieces
   * round where F2 stood, washed red or green like the attack warnings, with brass ring lines and piece dividers. While
   * shown, each piece carries her pass or reject stamp and a lens light sweeps round; after, the red pieces pulse.
   */
  fbGridCells(f, t) {
    const c = this.ctx, showing = t < f.show, pulse = 0.5 + Math.sin(t * 14) * 0.5, n = f.sectors, turn = Math.PI / 4;
    const pt = (r, a) => [f.cx * 20 + Math.cos(a) * r * 20, f.cy * 20 + Math.sin(a) * r * 20 * FLOOR_FLAT];
    const arc = (r, a0, a1) => { for (let i = 0; i <= 16; i++) c.lineTo(...pt(r, a0 + (a1 - a0) * i / 16)); };
    const wash = safe => this.washFloor(safe ? 0.45 : showing ? 0.38 : 0.32 + pulse * 0.18, safe ? '#2fae63' : '#e0303c');
    // The middle disc: never safe.
    c.beginPath(); c.ellipse(f.cx * 20, f.cy * 20, f.radii[0] * 20 - 1, (f.radii[0] * 20 - 1) * FLOOR_FLAT, 0, 0, TAU); wash(false);
    for (let k = 1; k < f.radii.length; k++) for (let s = 0; s < n; s++) {
      const a0 = turn + s * TAU / n + 0.035, a1 = turn + (s + 1) * TAU / n - 0.035, r0 = f.radii[k - 1] + 0.06, r1 = f.radii[k] - 0.06;
      c.beginPath(); c.moveTo(...pt(r1, a0)); arc(r1, a0, a1); arc(r0, a1, a0); c.closePath(); wash(f.safe[k] === s);
    }
    // Brass lines: the ring edges and the dividers between pieces.
    c.save(); c.strokeStyle = '#c79a3e'; c.globalAlpha = 0.85; c.lineWidth = 1.5;
    for (const r of f.radii) { c.beginPath(); c.ellipse(f.cx * 20, f.cy * 20, r * 20, r * 20 * FLOOR_FLAT, 0, 0, TAU); c.stroke(); }
    for (let s = 0; s < n; s++) { const a = turn + s * TAU / n; this.pixelLine(...pt(f.radii[0], a), ...pt(f.radii[f.radii.length - 1], a), [[0, '#c79a3e']]); }
    c.restore();
    if (showing) {
      this.drawMark('stampReject', f.cx * 20, f.cy * 20, 22, { alpha: 0.85 });
      for (let k = 1; k < f.radii.length; k++) for (let s = 0; s < n; s++) { const [x, y] = pt((f.radii[k - 1] + f.radii[k]) / 2, turn + (s + 0.5) * TAU / n); this.drawMark(f.safe[k] === s ? 'stampPass' : 'stampReject', x, y, f.safe[k] === s ? 18 : 20, { alpha: 0.85 }); }
      // Her lens light sweeping round the rings while they are shown.
      const a = t * 4; c.save(); c.globalAlpha = 0.5; this.pixelLine(...pt(0, a), ...pt(f.radii[f.radii.length - 1], a), [[1, '#fff4b7'], [0, '#ffffff']]); c.restore();
    }
  },
  /** The PixelLab laser strip stretched from x, y along angle `a`, `len` long; false while the picture is missing. */
  fbBeam(x, y, a, len, alpha) {
    const image = this.mark('laserBeam'), c = this.ctx; if (!image) return false;
    c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(a); c.imageSmoothingEnabled = false; c.drawImage(image, 0, -image.height / 2, len, image.height); c.restore(); return true;
  },
  // The sample shows over F2's head, where it is always on screen (the boss may stand off it).
  fbSampleCard(enemy, sample, left = null) {
    const p = this.game.p, x = p.x * 20, y = p.y * 20 - 78;
    this.rect(x - 28, y - 22, 56, 44, NAVY); this.rect(x - 26, y - 20, 52, 40, '#3d4352');
    this.fbMoldArt(x, y + 4, sample, 0.45, true); this.text('견본', x, y - 26, '#ffd257', 9);
    // While the moulds are out: a bar under the card running down to the press, red in its last third.
    if (left !== null) { this.rect(x - 28, y + 24, 56, 6, NAVY); this.rect(x - 27, y + 25, 54 * left, 4, left < 0.33 ? '#d8423c' : '#7fe0a0'); }
  },
};
