// What chapter 3's bosses put in the room, drawn in code (src/engine/clock-bosses.js): Tick·Tock's pendulum floor, the
// shuffle's two circles, phase 2's giant metronome, echoing footsteps and pincer ring, the flank's walls from both ends, the half-health colour floor, the beat landing under the twin whose turn it is, their warnings (thrusts, sweep, dash line)
// and their flying gears. Installed on CanvasRenderer.prototype, so `this` is the renderer.
import { FLOOR_FLAT } from '../engine/math.js';
import { LOOKS, SHUFFLE_SHOW } from '../engine/clock-bosses.js';
import { FX } from './fx-sprites.js';
import { ordenBossDraw } from './orden-boss-draw.js';
import { ordenEnding } from './orden-ending.js';

const TAU = Math.PI * 2, RED = LOOKS.tick, BLUE = LOOKS.tock, INK = '#2b3345', SAFE = '#2fae63', GOLD = '#ffd257';
/** How long before the shuffle's burst the floor outside the safe circles starts to redden. */
const SHUFFLE_REDDEN = 1.2;

export const clockBossDraw = {
  ...ordenBossDraw,
  ...ordenEnding,
  /** Under the bodies: the pendulum, the shuffle's circles and the beat under the twin it belongs to. */
  drawClockBossFloor() {
    const g = this.game, s = g.s, t = s.time, c = this.ctx;
    this.drawBellFloor();
    this.drawOrdenFloor();
    for (const f of s.bossFields || []) {
      if (f.kind === 'ttPendulum') this.ttPendulumFloor(f, t); if (f.kind === 'ttShuffle') this.ttShuffleFloor(f, t);
      if (f.kind === 'ttBlade') this.ttBladeFloor(f, t); if (f.kind === 'ttEcho') this.ttEchoFloor(f, t); if (f.kind === 'ttPincer') this.ttPincerFloor(f, t);
      if (f.kind === 'ttFlank') this.ttFlankFloor(f, t);
    }
    const lead = s.enemies.find(e => e.metronome && e.hp > 0), m = lead?.metronome;
    if (lead?.breaking?.kind === 'colours' && lead.breaking.zones) this.ttColourFloor(lead, t);
    if (!m || m.beatAt === undefined || m.joint) return;
    // Each beat a ring opens under the twin whose beat it is, in its colour, and fades by the next.
    const look = m.count % 2 ? 'tock' : 'tick', body = s.enemies.find(e => e.hp > 0 && e.type === lead.type && e.look === look);
    const k = Math.min(1, (t - m.beatAt) / g.ttBeat(lead));
    if (!body || k >= 1) return;
    // A gear ring (the pale mark-gear-ring tinted to the twin's colour), or a plain ring while it is missing.
    if (this.drawMark('gearRing', body.x * 20, body.y * 20, (0.7 + k * 0.6) * 40, { flat: FLOOR_FLAT, tint: LOOKS[look], alpha: 0.9 * (1 - k), angle: k * 0.6 })) return;
    c.save(); c.globalAlpha = 0.85 * (1 - k); c.strokeStyle = LOOKS[look]; c.lineWidth = 3;
    c.beginPath(); c.ellipse(body.x * 20, body.y * 20, (0.7 + k * 0.6) * 20, (0.7 + k * 0.6) * 20 * FLOOR_FLAT, 0, 0, TAU); c.stroke(); c.restore();
  },
  /** The blown side of a pendulum blast, as a path: from its line (reaching `overlap` past it) to the room's edge. */
  ttSide(f, b) {
    const c = this.ctx, edge = b.side > 0 ? b.line - f.overlap : b.line + f.overlap;
    c.beginPath(); c.rect(b.side > 0 ? edge * 20 : -4000, -4000, b.side > 0 ? 8000 : edge * 20 + 4000, 8000);
  },
  /** The next blast glows, deepening as its beat nears; its line runs through where F2 stood as it began. */
  ttPendulumFloor(f, t) {
    const c = this.ctx, i = f.blasts.findIndex(b => !b.done), next = f.blasts[i];
    if (!next || next.line === null) return;
    const span = i ? next.at - f.blasts[i - 1].at : next.at - f.from, k = Math.max(0, Math.min(1, 1 - (next.at - t) / span));
    const clipped = this.clipToFloor(this.game.map);
    this.ttSide(f, next); this.dangerWash(0.25 + 0.3 * k + (k > 0.8 ? Math.sin(t * 40) * 0.08 : 0));
    if (clipped) c.restore();
    // (2026-11-18: the yellow line along the red side's edge is gone at the user's word; the red wash shows the edge.)
  },
  /**
   * The shuffle: a green circle round each twin while they trade places; in the last moments everything outside the
   * circles reddens. At the end one circle (the real Tick's) bursts, and only the other is safe.
   */
  ttShuffleFloor(f, t) {
    const c = this.ctx, bodies = f.ids.map(id => this.game.s.enemies.find(e => e.id === id)).filter(Boolean);
    if (bodies.length < 2 || t < f.grey - SHUFFLE_SHOW) return;
    const r = f.radius * 20, k = Math.max(0, Math.min(1, 1 - (f.reveal - t) / SHUFFLE_REDDEN));
    if (k > 0) {
      const clipped = this.clipToFloor(this.game.map);
      c.beginPath(); c.rect(-4000, -4000, 8000, 8000);
      for (const e of bodies) { c.moveTo(e.x * 20 + r, e.y * 20); c.ellipse(e.x * 20, e.y * 20, r, r * FLOOR_FLAT, 0, 0, TAU); }
      c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = Math.max(0.48, 0.15 + 0.3 * k); c.fillStyle = '#e0303c'; c.fill('evenodd'); c.restore();
      if (clipped) c.restore();
    }
    // Each safe circle a ring of green gems (pixelfx, 2026-11-19: was a dashed line drawn in code), light running round it.
    for (const e of bodies) if (!this.gemRing('green', e.x * 20, e.y * 20, r, { spacing: 13 })) { c.save(); c.setLineDash([7, 5]); c.lineDashOffset = -t * 20; c.strokeStyle = SAFE; c.lineWidth = 3; c.beginPath(); c.ellipse(e.x * 20, e.y * 20, r, r * FLOOR_FLAT, 0, 0, TAU); c.stroke(); c.restore(); }
  },
  /** The giant metronome's floor: the bands its weights sweep this swing (deepening red), and the next swing's safe band. */
  ttBladeFloor(f, t) {
    const c = this.ctx, k = f.swings.findIndex(s => t < s.end), now = f.swings[k], next = f.swings[k + 1];
    if (!now) return;
    const a0 = Math.PI / 2 - f.amp - 0.05, a1 = Math.PI / 2 + f.amp + 0.05, x = f.pivot.x * 20, y = f.pivot.y * 20, top = f.length + 40;
    // Touching bands are drawn as one (each swing's `bands`, merged once in clock-bosses.js): their shared edge, dashed
    // twice out of step, read as one solid red line (2026-11-19, the user's word: take the solid red line away).
    const clipped = this.clipToFloor(this.game.map), lead = now.start - (t < f.start ? f.start - f.from : now.end - now.start), u = Math.max(0, Math.min(1, (t - lead) / (now.start - lead)));
    c.beginPath();
    for (const w of now.bands) { const hi = Math.min(w.hi, top) * 20; c.moveTo(x + Math.cos(a0) * hi, y + Math.sin(a0) * hi); c.arc(x, y, hi, a0, a1); c.arc(x, y, Math.max(0.1, w.lo) * 20, a1, a0, true); c.closePath(); }
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = Math.max(0.48, t < now.start ? 0.2 + 0.3 * u : 0.42); c.fillStyle = '#e0303c'; c.fill(); c.restore();
    // The next swing: only its safe band, its two edges drawn as soft white arcs (2026-11-21, the user's word: the floor
    // looked wrong. When the warnings were made as strong as the rest that day, the next swing's red wash grew as strong
    // as the swing now and covered its safe band; red now is only for what hurts now).
    if (next && t >= now.start) {
      c.save(); c.strokeStyle = '#fff4d6'; c.lineWidth = 3; c.globalAlpha = 0.55 + 0.25 * Math.sin(t * 8); c.setLineDash([10, 8]);
      for (const [lo, hi] of next.gaps) for (const r of [lo, hi]) if (r > 0.2 && r < top) { c.beginPath(); c.arc(x, y, r * 20, a0, a1); c.stroke(); }
      c.restore();
    }
    if (clipped) c.restore();
  },
  /** The echo: each mark a clock face where F2 stood, its hand turning to twelve and its face reddening till it blows. */
  ttEchoFloor(f, t) {
    const c = this.ctx, r = f.radius * 20;
    for (const m of f.marks) {
      if (m.x === null || m.done) continue;
      const k = Math.max(0, Math.min(1, (t - m.at) / (m.blow - m.at))), x = m.x * 20, y = m.y * 20;
      // The clock face painted on the floor (PixelLab), then the red deepening over it.
      const dial = this.mark('ttEchoDial');
      if (dial) this.drawMark('ttEchoDial', x, y, r * 2, { flat: FLOOR_FLAT * dial.width / dial.height });
      c.save(); c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU);
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = Math.max(0.48, 0.2 + 0.4 * k + (k > 0.8 ? Math.sin(t * 40) * 0.08 : 0)); c.fillStyle = '#e0303c'; c.fill(); c.restore();
      c.save();
      // The hand sweeps clockwise from twelve and is back at twelve as it blows (it ran backwards until 2026-11-18).
      const a = -Math.PI / 2 + k * TAU, hx = Math.cos(a) * r * 0.8, hy = Math.sin(a) * r * 0.8 * FLOOR_FLAT;
      // The hand (pixelfx, 2026-11-19: was a line drawn in code), fitted to the face as it lies on the floor.
      if (!this.drawFxFrame('ttEchoHand', 0, x, y, { angle: Math.atan2(hy, hx), sx: Math.max(0.4, Math.hypot(hx, hy) / 22) })) { c.lineWidth = 3; c.strokeStyle = INK; c.beginPath(); c.moveTo(x, y); c.lineTo(x + hx, y + hy); c.stroke(); }
      c.restore();
    }
  },
  /** Phase 2's pincer: the ring as a fence of brass posts with a gap between two green lamp posts, the next jab, and the middle reddening before they close. */
  ttPincerFloor(f, t) {
    const c = this.ctx, g = this.game, ai = g.config.bossAI.twinTickTock, x = f.x * 20, y = f.y * 20, r = f.r * 20;
    const gapAt = g.ttPincerTurn(f, Math.min(t, f.close)) + f.spin * Math.PI / 2;
    if (t >= f.close - g.ttBeat(g.s.enemies.find(e => e.id === f.owner) || {}) && !f.closed) {
      c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, 0, TAU); this.dangerWash(0.3 + Math.sin(t * 30) * 0.08);
    }
    if (!f.closed && this.mark('ttPincerPost') && this.mark('ttPincerGate')) {
      // The fence as a ring of brass hour-mark posts on a faint red line, turning with the gap; the gap between two
      // green signal-lamp posts over a soft green glow (PixelLab, 2026-11-15: the dashed gold ring and green arc looked
      // like a debug line, not part of the fight).
      const at = a => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FLOOR_FLAT });
      // The fence between its posts as small red gems, the gap as a row of green ones (pixelfx, 2026-11-19: were a thin red
      // line and a wide green stroke drawn in code).
      // (2026-11-19: the red gems between the posts are gone at the user's word; the posts are the fence.)
      if (!this.gemRing('green', x, y, r, { spacing: 8 }, gapAt - f.gap, gapAt + f.gap)) {
        c.save(); c.globalAlpha = 0.4; c.lineWidth = 3; c.strokeStyle = '#c0303a'; c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, gapAt + f.gap, gapAt - f.gap + TAU); c.stroke();
        c.globalAlpha = 0.28; c.lineWidth = 14; c.strokeStyle = SAFE; c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, gapAt - f.gap, gapAt + f.gap); c.stroke(); c.restore();
      }
      const fence = TAU - 2 * f.gap, count = Math.max(8, Math.round(fence * f.r / 0.9)), posts = [];
      for (let i = 0; i <= count; i++) posts.push({ ...at(gapAt + f.gap + fence * i / count), gate: i === 0 || i === count });
      posts.sort((p, q) => p.y - q.y);
      for (const p of posts) {
        if (p.gate) this.drawMark('ttPincerGate', p.x, p.y - 20, 16);
        else this.drawMark('ttPincerPost', p.x, p.y - 12, 12);
      }
    } else if (!f.closed) {
      c.save(); c.lineWidth = 4; c.strokeStyle = GOLD; c.setLineDash([10, 6]); c.lineDashOffset = -t * 30 * f.spin;
      c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, gapAt + f.gap, gapAt - f.gap + TAU); c.stroke();
      c.setLineDash([]); c.strokeStyle = SAFE; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, r, r * FLOOR_FLAT, 0, gapAt - f.gap, gapAt + f.gap); c.stroke();
      c.restore();
    }
    // The next jab: a red line from the twin toward the middle, filling in the beat before it lands.
    const jab = f.jabs.find(j => !j.done), body = jab && g.s.enemies.find(e => e.id === jab.id);
    if (body) {
      const beat = g.ttBeat(body), k = 1 - (jab.at - t) / beat;
      if (k > 0) { const a = Math.atan2(f.y - body.y, f.x - body.x), len = ai.pincerJab * 20; c.save(); c.translate(body.x * 20, body.y * 20); c.rotate(a); c.beginPath(); c.rect(0, -12, len, 24); this.dangerWash(0.3); c.beginPath(); c.rect(0, -12, len * Math.min(1, k), 24); this.dangerWash(0.35); c.restore(); }
    }
  },
  /**
   * The flank: where the twins will appear while they are gone, then, for the next wall, its lane across the room in
   * red with the gap's lane in green, deepening over the beat before it flies.
   */
  ttFlankFloor(f, t) {
    const c = this.ctx, g = this.game, blink = f.blink;
    if (t < blink.back + 0.15) for (const e of g.s.enemies.filter(b => f.ids.includes(b.id))) {
      const at = blink.spots[e.id], k = Math.min(1, (t - blink.vanish) / (blink.back - blink.vanish));
      // Where it will appear: a ring of gems in its colour closing in (pixelfx, 2026-11-19: was a dashed line drawn in code).
      if (this.gemRing(e.look === 'tick' ? 'tick' : 'blue', at.x * 20, at.y * 20, (1.4 - k * 0.6) * 20, { spacing: 10 })) continue;
      c.save(); c.globalAlpha = 0.9; c.strokeStyle = LOOKS[e.look]; c.lineWidth = 3; c.setLineDash([6, 4]);
      c.beginPath(); c.ellipse(at.x * 20, at.y * 20, (1.4 - k * 0.6) * 20, (1.4 - k * 0.6) * 20 * FLOOR_FLAT, 0, 0, TAU); c.stroke(); c.restore();
    }
    const i = f.walls.findIndex(w => !w.done), w = f.walls[i];
    if (!w || t < blink.back) return;
    const lead = f.walls[i - 1]?.at ?? blink.back, k = Math.max(0, Math.min(1, (t - lead) / (w.at - lead)));
    const rect = (a0, a1, b0, b1) => w.axis === 'x' ? [a0 * 20, b0 * 20, (a1 - a0) * 20, (b1 - b0) * 20] : [b0 * 20, a0 * 20, (b1 - b0) * 20, (a1 - a0) * 20];
    const far = w.axis === 'x' ? [f.room.left, f.room.right] : [f.room.top, f.room.bottom], e0 = w.edge - 0.6;
    const clipped = this.clipToFloor(g.map);
    // Like the other bosses' sweeps (Belgard's sword rain, Press's rows): the whole lane the wall crosses washed red,
    // deepening as it nears, the gap's lane across the room washed green (2026-11-18: was a red band at the far end and
    // two dashed green lines, which did not read as a safe zone). The twin's own colour stays on the end it comes from.
    // The green is where F2 is really clear of the gears (ttFlankSafe), not the gap's nominal width.
    const lane = (b0, b1) => { c.beginPath(); c.rect(...rect(far[0], far[1], b0, b1)); }, [s0, s1] = g.ttFlankSafe(f, w);
    lane(w.lo - 0.3, s0); this.dangerWash(0.18 + 0.3 * k);
    lane(s1, w.hi + 0.3); this.dangerWash(0.18 + 0.3 * k);
    lane(s0, s1); this.washFloor(0.35 + 0.25 * k, SAFE);
    c.save(); c.globalAlpha = 0.3 + 0.4 * k; c.fillStyle = LOOKS[g.s.enemies.find(b => b.id === w.id)?.look] || RED;
    c.fillRect(...rect(e0, e0 + 1.2, w.lo - 0.3, s0)); c.fillRect(...rect(e0, e0 + 1.2, s1, w.hi + 0.3)); c.restore();
    if (clipped) c.restore();
  },
  /**
   * The colour floor: each square washed red or blue (brighter as new colours come in), the borders between them, a
   * ring filling under the twin holding its pose, and a flash where the squares blew. The squares never overlap, so each
   * coat goes on all its squares as one path (2026-11-21: was a save, restore and two fills a square).
   */
  ttColourFloor(lead, t) {
    const c = this.ctx, g = this.game, b = lead.breaking, call = b.call, rule = b.rule;
    const clipped = this.clipToFloor(g.map), fresh = Math.max(0, 1 - (t - b.shownAt) / 0.3);
    const k = call ? Math.max(0, Math.min(1, 1 - (call.at - t) / rule.callWarn)) : 0, blast = b.blast && t - b.blast.at < 0.35 ? b.blast : null;
    const squares = pick => { c.beginPath(); for (const z of b.zones) if (pick(z)) c.rect(z.x0 * 20, z.y0 * 20, (z.x1 - z.x0) * 20, (z.y1 - z.y0) * 20); };
    c.save();
    // Deeper since 2026-11-18 (the user's word: on the stair engine room's warm floor the squares barely showed): a
    // stronger multiply plus a plain coat of the colour over it.
    for (const [look, colour] of [['tick', '#d8202e'], ['tock', '#2a56d0']]) {
      squares(z => z.colour === look); c.fillStyle = colour;
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55 + fresh * 0.2; c.fill();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.22 + fresh * 0.1; c.fill();
    }
    // The twins' dais: plain grey stone, so their red and blue stand out on it (2026-11-19).
    squares(z => z.colour === 'none'); c.globalAlpha = 0.7; c.fillStyle = '#4b505d'; c.fill();
    // Where it blew (the dais too): a pale flash. Before that nothing marks the doomed squares; the pose says which they are.
    if (blast) { squares(z => z.colour !== blast.look); c.globalAlpha = 0.55 * (1 - (t - blast.at) / 0.35); c.fillStyle = '#fff3c4'; c.fill(); }
    c.restore();
    // (No borders or dais edges: their rows of gems read as stones on a go board, 2026-11-19, the user's word. The
    // colours alone part the squares.)
    if (clipped) c.restore();
    // The caller: the brass stopwatch over its head running out with the pose (was a ring of gems, 2026-11-19).
    const actor = call && call.posed !== false && g.s.enemies.find(e => e.id === call.id);
    if (actor && k > 0) this.drawFxFrame('chargeClock', k * (FX.chargeClock.frames - 1), actor.x * 20, actor.y * 20 - 78, { sx: 0.8, sy: 0.8 });
  },
  /** A twin's warning (from floor-marks.js drawTell): `box` and `sector` wash the reach red as there. */
  drawClockTell(enemy, tell, { box, sector, ring, x, y, progress = 0 }) {
    if (enemy.type === 'bellguard') { this.drawBellTell(enemy, tell, { box, sector, ring, x, y, progress }); return; }
    if (enemy.type === 'orden' || enemy.type === 'ordenFinal') { this.drawOrdenTell(enemy, tell, { x, y, progress }); return; }
    const g = this.game, c = this.ctx, ai = g.config.bossAI.twinTickTock, R = g.config.arena.playerRadius;
    if (!ai || enemy.type !== 'twinTickTock') return;
    switch (tell.type) {
      case 'ttThrust': case 'ttThrust2': case 'ttThrust3': box((ai.thrustLength + ai.thrustLunge) * 20, (ai.thrustWidth + R) * 20); break;
      case 'ttSweep': {
        sector(ai.sweepRange, ai.sweepDegrees);
        // The half clock dial the minute hand will sweep (PixelLab): its straight edge through Tock, turned to the blow.
        const dial = this.mark('ttSweepDial');
        if (dial) { const k = ai.sweepRange * 40 / dial.height; c.save(); c.translate(x, y); c.rotate(tell.angle); c.globalAlpha = 0.45 + 0.4 * progress; c.imageSmoothingEnabled = false; c.drawImage(dial, 0, -dial.height * k / 2, dial.width * k, dial.height * k); c.restore(); }
        // Where the three gears will fly: arrows (PixelLab), or plain lines while the picture is missing.
        for (let i = 0; i < ai.gearShots; i++) {
          const a = tell.angle + (i - (ai.gearShots - 1) / 2) * ai.gearSpread * Math.PI / 180;
          if (this.mark('ttGearPath')) for (const d of [0.9, 2.1]) this.drawMark('ttGearPath', x + Math.cos(a) * (ai.sweepRange + d) * 20, y + Math.sin(a) * (ai.sweepRange + d) * 20, 24, { angle: a, alpha: 0.5 + 0.5 * progress });
          else this.line(x + Math.cos(a) * ai.sweepRange * 20, y + Math.sin(a) * ai.sweepRange * 20, x + Math.cos(a) * (ai.sweepRange + 2.5) * 20, y + Math.sin(a) * (ai.sweepRange + 2.5) * 20, BLUE, 2);
        }
        break;
      }
      case 'ttDash':
        // (2026-11-18: the short blue ticks off both sides, where gears fly out as it runs, are gone; they read as a
        // second line of unknown meaning. The gears show for themselves as they fly.)
        box(ai.dashLength * 20, (enemy.radius + R) * 20); this.glyph('chevrons', ai.dashLength * 10, 3, '» » »');
        break;
    }
  },
  /** A gear: a toothed wheel with a pale hub. */
  ttGear(x, y, r, turn) {
    const c = this.ctx, teeth = 8;
    c.save(); c.translate(x, y); c.rotate(turn);
    c.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const a = i * Math.PI / teeth, rr = i % 2 ? r * 0.78 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fillStyle = '#9fb7e0'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.fillStyle = '#e8eefc'; c.fill(); c.stroke();
    c.restore();
  },
  /**
   * Over the bodies: the giant metronome, and the shuffle's golden wind-up key on the bomb's back while the twins still show their colours,
   * turning as if wound, with a ring of light round it (from canvas.js, after the bodies).
   */
  drawClockBossOver() {
    const g = this.game, s = g.s, t = s.time, c = this.ctx;
    this.drawBellOver();
    this.drawOrdenOver();
    this.drawOrdenEnding();
    // Tock's minute hand sweeping the half circle in front (PixelLab slash): it turns through the last of its arc and
    // fades in 0.4 s. Its picture's arc is centred at (53, 62) with a radius of 51 px.
    for (const e of s.enemies) {
      const fx = e.sweepFx, u = fx ? (t - fx.at) / 0.4 : 1;
      if (u >= 1 || u < 0) continue;
      // The animated cut (pixelfx, 2026-11-18): the greatsword cut's 180-degree blue version, sized to the sweep.
      if (this.drawFxFrame('ttSweepBlue', (t - fx.at) * 30, fx.x * 20, fx.y * 20 - 10, { angle: fx.angle, sx: g.config.bossAI.twinTickTock.sweepRange * 20 / 60, sy: g.config.bossAI.twinTickTock.sweepRange * 20 / 60 })) continue;
      const slash = this.mark('ttSweepSlash'), range = g.config.bossAI.twinTickTock.sweepRange * 20;
      c.save(); c.translate(fx.x * 20, fx.y * 20 - 10); c.rotate(fx.angle - 0.5 + u * 0.5); c.globalAlpha = 1 - u * u;
      if (slash) { const k = range / 51; c.imageSmoothingEnabled = false; c.drawImage(slash, -53 * k, -62 * k, slash.width * k, slash.height * k); }
      else { c.strokeStyle = BLUE; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, range, -Math.PI / 2, Math.PI / 2); c.stroke(); }
      c.restore();
    }
    // The giant metronome: rod, pivot and its weights (bladeZones - 1 of them) at their heights on the rod (sliding there
    // as each swing begins).
    for (const f of s.bossFields || []) {
      if (f.kind !== 'ttBlade') continue;
      const a = g.ttBladeAngle(f, t), k = f.swings.findIndex(x => t < x.end), sw = f.swings[Math.max(0, k)], prev = f.swings[k - 1];
      const u = prev && t < sw.start + (sw.end - sw.start) * 0.12 ? Math.min(1, Math.max(0, (t - sw.start) / ((sw.end - sw.start) * 0.12))) : 1;
      const px = f.pivot.x * 20, py = f.pivot.y * 20;
      // The rod as brass pieces laid along it (pixelfx, 2026-11-19: was a line drawn in code); the code line while it loads.
      const rod = (a, alpha) => { const dx = Math.sin(a), dy = Math.cos(a); if (this.tileAlong('ttRod', px, py, Math.atan2(dy, dx), f.length * 20, 0, { step: 31, alpha, lead: 3 })) return; c.save(); c.globalAlpha = alpha; c.strokeStyle = '#6b4a1c'; c.lineWidth = 6; c.beginPath(); c.moveTo(px, py); c.lineTo(px + dx * f.length * 20, py + dy * f.length * 20); c.stroke(); c.strokeStyle = GOLD; c.lineWidth = 2; c.stroke(); c.restore(); };
      const weights = (a, alpha) => sw.weights.forEach((w, j) => {
        const r = prev ? prev.weights[j].r + (w.r - prev.weights[j].r) * u : w.r;
        c.save(); c.globalAlpha = alpha; c.translate(px + Math.sin(a) * r * 20, py + Math.cos(a) * r * 20); c.rotate(-a);
        // The picture stands upright, its top toward the pivot; it spans the weight's band along the rod.
        const tall = f.half * 2 * 20, img = this.mark('ttWeight');
        if (!img || !this.drawMark('ttWeight', 0, 0, tall * img.width / img.height)) { c.fillStyle = '#c99a3a'; c.strokeStyle = '#7a2a22'; c.lineWidth = 3; c.beginPath(); c.moveTo(-f.half * 20, -f.half * 20); c.lineTo(f.half * 20, -f.half * 20); c.lineTo(f.half * 14, f.half * 20); c.lineTo(-f.half * 14, f.half * 20); c.closePath(); c.fill(); c.stroke(); }
        c.restore();
      });
      // Its weight in the swing (2026-11-19, to feel grand): fast through the bottom, it leaves afterimages behind it,
      // three fading copies a few hundredths of a second back (the reddish smear stroked along the arc is gone: a code line).
      const speed = Math.abs(a - g.ttBladeAngle(f, t - 0.03)) / 0.03;
      if (speed > 0.6 && !s.profile.settings.reducedMotion && t >= f.start) {
        const k = Math.min(1, (speed - 0.6) / 1.8);
        for (const [d, alpha] of [[0.09, 0.14], [0.06, 0.22], [0.03, 0.32]]) { const ga = g.ttBladeAngle(f, t - d); rod(ga, alpha * k); weights(ga, alpha * k); }
      }
      rod(a, 1);
      if (!this.drawMark('ttPivot', px, py + 6, 26)) { c.save(); c.fillStyle = GOLD; c.strokeStyle = '#6b4a1c'; c.lineWidth = 3; c.beginPath(); c.arc(px, py, 12, 0, TAU); c.fill(); c.stroke(); c.restore(); }
      weights(a, 1);
    }
    for (const f of s.bossFields || []) {
      if (f.kind !== 'ttShuffle' || t >= f.grey) continue;
      const e = s.enemies.find(b => b.id === f.bomb);
      if (!e) continue;
      const x = e.x * 20, y = e.y * 20 - 78, turn = s.profile.settings.reducedMotion ? 0 : t * 6;
      // The key (Brass's wind-up key, PixelLab), turning about its shaft as if wound: squeezed side to side.
      const w = Math.cos(turn);
      if (this.mark('ttKey')) { c.save(); c.translate(x, y); c.scale(Math.max(0.15, Math.abs(w)), 1); this.drawMark('ttKey', 0, 0, 46); c.restore(); }
      else {
      c.save(); c.translate(x, y); c.lineWidth = 2; c.strokeStyle = '#7a5410'; c.fillStyle = GOLD;
      c.fillRect(-2, -4, 4, 16); c.strokeRect(-2, -4, 4, 16);
      c.fillRect(2, 6, 5 * Math.abs(w) + 1, 3); c.strokeRect(2, 6, 5 * Math.abs(w) + 1, 3);
      for (const k of [-1, 1]) { c.beginPath(); c.ellipse(k * 6 * w, -9, 6 * Math.max(0.25, Math.abs(w)), 6, 0, 0, TAU); c.fill(); c.stroke(); }
      c.restore();
      }
    }
  },
  /** The twins' gear shots: a spinning gear with a short blue trail. Returns true when drawn. */
  drawGearShot(bullet) {
    const x = bullet.x * 20, y = bullet.y * 20 - 8, back = bullet.angle + Math.PI, c = this.ctx;
    for (let i = 1; i <= 3; i++) { c.globalAlpha = 0.4 - i * 0.1; this.circle(x + Math.cos(back) * i * 6, y + Math.sin(back) * i * 6, 5 - i, BLUE); }
    c.globalAlpha = 1;
    if (!this.drawMark('ttGear', x, y, 17, { angle: this.visualTime * 12 })) this.ttGear(x, y, 7, this.visualTime * 12);
    return true;
  },
};
