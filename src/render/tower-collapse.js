// Chapter 3's tower breaking open after Orden 1 (docs/design/clock-tower-plan.md 7.3; game.js startCollapse and COLLAPSE
// keep its clock). The tuning chamber is the tower's top floor, so the four pictures share one camera, floor and dial:
// the chamber, the chamber cracking, the chamber blown open (its village's `collapse` list in maps.json), then the ruined
// summit, the next room. They are laid over the room's own picture, under every body, with the signal light running up
// to the tuner, dust and small parts falling, a white flash, the sunrise and the screen shaking (none with reduced motion).
// Installed on CanvasRenderer.prototype, so `this` is the renderer.
import { COLLAPSE } from '../engine/game.js';
import { roomPlace, VIEW_UNITS } from '../engine/map-geometry.js';
import { assetUrl } from '../animation/sprite-library.js';
import { DEBRIS_ART } from './fx-sprites.js';

const TAU = Math.PI * 2;
/** How long each picture takes to give way to the next (the open one comes in at once, under the flash). */
const CROSSFADE = { crack: 0.4, summit: 0.8 };
/** The white flash as the walls fall away, seconds. */
const FLASH_SECONDS = 0.15;
/** Screen shake in screen pixels while each part plays: the light runs, the cracks come, the walls fall. */
const SHAKE = { link: 3, crack: 8, open: 14, summit: 5 };
/** Where the light runs in the tuning chamber (map units): Orden's tuner under the dial, and up the room's pipes to the sky. */
const TUNER = [21.6, 9.8], LINES = [[[14.0, 5.0], [14.0, -1]], [[21.6, 6.8], [21.6, -1]], [[29.1, 5.0], [29.1, -1]]];
/** The sun of the open picture (map units), where the dawn comes in. */
const SUN = [26.8, 3.4];
/** The town at the last bell (the liberation cutscene's second still): every resident frozen under Orden's seal. */
const LAST_BELL = '/art/scenes/liberation/liberation-2-last-bell-v1-q90.webp';
/** Where the residents' seals are in that picture (fractions of it), for the strength rising off them. */
const SEALS = [[0.36, 0.2], [0.41, 0.2], [0.6, 0.21], [0.75, 0.2], [0.16, 0.38], [0.29, 0.38], [0.4, 0.4], [0.53, 0.4], [0.65, 0.35], [0.6, 0.5], [0.44, 0.57], [0.48, 0.57], [0.26, 0.6], [0.86, 0.61], [0.58, 0.75]];
/** Falling pieces and dust while the tower breaks (fewer with reduced motion). */
const PIECES = 36, DUST = 28, CALM_SHARE = 0.35;

/** A number in [0, 1) from two integers, the same every frame (where each piece falls and how). */
const seeded = (i, k) => { let h = (i * 374761393 + k * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ease = u => Math.max(0, Math.min(1, u)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, u)));

export const towerCollapse = {
  /**
   * The cracking and open pictures, fetched as soon as F2 stands in a room that breaks (the fight gives them minutes) and
   * let go once the scene is over; each is a whole map picture, too large to keep.
   */
  collapsePictures(map) {
    const list = map?.collapse;
    if (!list?.length) { if (!this.game.s.collapse) { this.collapseArt = null; this.lastBellArt = null; } return this.collapseArt?.images; }
    if (this.collapseArt?.list !== list) {
      const images = new Map();
      for (const file of list) { const image = new Image(); image.onload = () => image.decode().catch(() => {}).then(() => images.set(file, image)); image.src = assetUrl(file); }
      this.collapseArt = { list, images };
    }
    return this.collapseArt.images;
  },
  /** One map-sized picture over the floor at `alpha`: only the part the camera sees, as the room's own is drawn. */
  paintPicture(image, [width, height], alpha) {
    if (!image || alpha <= 0) return;
    const c = this.ctx, ux = image.width / width, uy = image.height / height;
    const x0 = Math.max(0, Math.floor(this.camera.x - 1)), y0 = Math.max(0, Math.floor(this.camera.y - 1));
    const x1 = Math.min(width, Math.ceil(this.camera.x + VIEW_UNITS[0] + 1)), y1 = Math.min(height, Math.ceil(this.camera.y + VIEW_UNITS[1] + 1));
    if (x1 <= x0 || y1 <= y0) return;
    c.save(); c.globalAlpha = Math.min(1, alpha); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(image, x0 * ux, y0 * uy, (x1 - x0) * ux, (y1 - y0) * uy, x0 * 20, y0 * 20, (x1 - x0) * 20, (y1 - y0) * 20);
    c.restore();
  },
  /** Called once a frame over the room's own picture (world transform): the scene while `s.collapse` runs. */
  drawTowerCollapse(map, size) {
    const g = this.game, s = g.s, fall = s.collapse, images = this.collapsePictures(map);
    // The town's picture is fetched with the room's, during the fight.
    if (map?.collapse?.length && !this.lastBellArt) { this.lastBellArt = new Image(); this.lastBellArt.src = assetUrl(LAST_BELL); }
    if (!fall) return;
    const t = s.time - fall.at, calm = !!s.profile.settings.reducedMotion, c = this.ctx;
    // Before F2 arrives the room underfoot is still the chamber, and the summit is the next room's picture.
    const before = t < COLLAPSE.arrive, list = before ? map?.collapse || [] : [];
    const [cracking, open] = list.map(file => images?.get(file));
    const next = before && g.s.run ? roomPlace(g.data.maps, g.rooms[g.s.run.node + 1]?.id, g.s.run.plan?.[g.s.run.node + 1]?.variant || 0) : null, summit = next && this.mapImages?.get(next.background);
    if (before) {
      if (t >= COLLAPSE.open && t < COLLAPSE.summit) this.paintPicture(open || cracking, size, 1);
      else if (t >= COLLAPSE.summit) {
        // The open tower gives way to the summit as it will stay; F2 has not moved, the floors are painted to match.
        if (summit) this.paintPicture(summit, size, 1);
        this.paintPicture(open || cracking, size, summit ? 1 - ease((t - COLLAPSE.summit) / CROSSFADE.summit) : 1);
      } else if (t >= COLLAPSE.crack) this.paintPicture(cracking, size, ease((t - COLLAPSE.crack) / CROSSFADE.crack));
    }
    // (The light lines from him into the tuner and up the pipes were taken out, 2026-11-21: they read as solid lines.)
    // The dawn coming in through the open walls (screen-space light added over the frame, under the bodies).
    const dawn = t < COLLAPSE.open ? 0 : Math.min(1, (t - COLLAPSE.open) / 0.6) * (t < COLLAPSE.arrive ? 1 : Math.max(0, 1 - (t - COLLAPSE.arrive) / (COLLAPSE.end - COLLAPSE.arrive)));
    if (dawn > 0) {
      const x = SUN[0] * 20, y = SUN[1] * 20, light = c.createRadialGradient(x, y, 10, x, y, 620);
      light.addColorStop(0, 'rgba(255, 226, 160, 0.4)'); light.addColorStop(0.45, 'rgba(255, 186, 120, 0.12)'); light.addColorStop(1, 'rgba(255, 160, 110, 0)');
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = dawn * (calm ? 0.6 : 1); c.fillStyle = light; c.fillRect(x - 620, y - 620, 1240, 1240); c.restore();
    }
    // The shake grows with each part: the link, the cracks, the walls falling; the summit settles.
    const away = t > COLLAPSE.cutIn + 0.3 && t < COLLAPSE.cutOut - 0.1;
    const shake = away ? 0 : t < COLLAPSE.crack ? SHAKE.link + (SHAKE.crack - SHAKE.link) * t / COLLAPSE.crack * 0.6 : t < COLLAPSE.open ? SHAKE.crack : t < COLLAPSE.summit ? SHAKE.open : t < COLLAPSE.land ? SHAKE.summit : 0;
    if (!calm && shake && !s.paused) this.kick(shake, undefined, 140);
    // Over every body: the room going dark round him with a cyan heartbeat while he wakes, what falls from the breaking
    // ceiling, and the white flash as the walls give way.
    this.overlay(() => {
      if (t < COLLAPSE.open) {
        const k = Math.min(1, t / 0.8) * (t < COLLAPSE.open - 0.3 ? 1 : (COLLAPSE.open - t) / 0.3), beat = Math.max(0, 1 - ((t % COLLAPSE.beat) / COLLAPSE.beat) * 3);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        const w = this.canvas.width, h = this.canvas.height, dark = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.12, w / 2, h / 2, Math.max(w, h) * 0.62);
        dark.addColorStop(0, `rgba(8, 14, 30, ${(0.15 * k).toFixed(3)})`); dark.addColorStop(1, `rgba(8, 14, 30, ${(0.75 * k).toFixed(3)})`);
        c.fillStyle = dark; c.fillRect(0, 0, w, h);
        if (!calm && beat > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.08 * beat * k; c.fillStyle = '#7fe8ff'; c.fillRect(0, 0, w, h); }
        c.restore();
      }
      if (t >= COLLAPSE.crack * 0.5 && t < COLLAPSE.land + 0.6) this.drawFallingRubble(t, calm);
      this.drawLastBellCut(t, calm);
      const flash = t - COLLAPSE.open;
      if (flash >= 0 && flash < FLASH_SECONDS * 3) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = (calm ? 0.35 : 1) * (flash < FLASH_SECONDS ? 1 : 1 - (flash - FLASH_SECONDS) / (FLASH_SECONDS * 2));
        c.fillStyle = '#fffaf0'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    });
  },
  /**
   * The cut away to the town (2026-11-21, the user's word: show why the townsfolk stop): the village court at the last
   * bell fades in over the screen, slowly drawing closer, the rings of the bell washing over it; cyan and gold strength
   * rises off every frozen resident's seal and streams up off the top of the screen toward the tower; then back.
   */
  drawLastBellCut(t, calm) {
    const fadeIn = (t - COLLAPSE.cutIn) / 0.45, fadeOut = (COLLAPSE.cutOut - t) / 0.45, a = Math.max(0, Math.min(1, fadeIn, fadeOut));
    if (a <= 0) return;
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height, img = this.lastBellArt, u = (t - COLLAPSE.cutIn) / (COLLAPSE.cutOut - COLLAPSE.cutIn);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = a;
    c.fillStyle = '#0e1626'; c.fillRect(0, 0, w, h);
    // The picture covering the screen, closing in a little over the scene.
    const zoom = 1.02 + (calm ? 0 : 0.06 * u), iw = img?.naturalWidth || 1536, ih = img?.naturalHeight || 1024, k = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * k, dh = ih * k, dx = (w - dw) / 2, dy = (h - dh) / 2 - (calm ? 0 : 10 * u);
    if (img?.complete && img.naturalWidth) { c.imageSmoothingEnabled = true; c.drawImage(img, dx, dy, dw, dh); }
    // The bell washing over the town: two soft bright pulses from the top, one per toll.
    for (const at of [COLLAPSE.cutIn + 0.15, COLLAPSE.cutIn + 1.9]) {
      const age = t - at; if (age < 0 || age > 1.6) continue;
      const r = (0.15 + age * 0.9) * Math.max(w, h), band = c.createRadialGradient(w / 2, -h * 0.25, r * 0.82, w / 2, -h * 0.25, r);
      band.addColorStop(0, 'rgba(127, 232, 255, 0)'); band.addColorStop(0.7, `rgba(127, 232, 255, ${(0.28 * (1 - age / 1.6)).toFixed(3)})`); band.addColorStop(1, 'rgba(127, 232, 255, 0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = band; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
    }
    // Their strength rising: motes off each seal, streaming up and leaning toward the top middle (the tower).
    c.globalCompositeOperation = 'lighter';
    const px = Math.max(2, Math.round(w / 420)), share = calm ? CALM_SHARE : 1;
    SEALS.forEach(([sx, sy], i) => {
      const ox = dx + sx * dw, oy = dy + sy * dh, n = Math.round(7 * share);
      for (let j = 0; j < n; j++) {
        const start = COLLAPSE.cutIn + 1.0 + seeded(i, j) * 2.2, age = t - start; if (age < 0) continue;
        const life = 1.4 + seeded(i, j + 9) * 0.6, q = (age % life) / life, x = ox + (w / 2 - ox) * q * q * 0.8 + Math.sin(age * 5 + j) * 4, y = oy - q * (oy + h * 0.1);
        c.globalAlpha = a * (1 - q) * 0.9; c.fillStyle = j % 3 ? '#7fe8ff' : '#ffd257'; c.fillRect(Math.round(x), Math.round(y), px, px);
      }
      // the seal itself flaring as it gives up its strength
      const pulse = Math.max(0, Math.sin((t - COLLAPSE.cutIn - 1.0 - i * 0.07) * 4));
      if (t > COLLAPSE.cutIn + 1.0) { const g = c.createRadialGradient(ox, oy, 0, ox, oy, 18 * k); g.addColorStop(0, `rgba(160, 240, 255, ${(0.5 * pulse * a).toFixed(3)})`); g.addColorStop(1, 'rgba(127, 232, 255, 0)'); c.globalAlpha = 1; c.fillStyle = g; c.fillRect(ox - 18 * k, oy - 18 * k, 36 * k, 36 * k); }
    });
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    // A cold edge round the picture, as in the frozen moment.
    const edge = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    edge.addColorStop(0, 'rgba(10, 18, 34, 0)'); edge.addColorStop(1, `rgba(10, 18, 34, ${(0.6 * a).toFixed(3)})`);
    c.fillStyle = edge; c.fillRect(0, 0, w, h);
    c.restore();
  },
  /** Cyan light from Orden's fall into the tuner, then up three lines to the top of the room, pulses running along them. */
  drawSignalLight(fall, t, glow) {
    const c = this.ctx, tuner = [TUNER[0] * 20, TUNER[1] * 20], from = [fall.x * 20, fall.y * 20 - 18];
    const paths = [[from, tuner], ...LINES.map(line => [tuner, ...line.map(([x, y]) => [x * 20, y * 20])])];
    // How far up the light has run: from the fall to the tuner first, then up the lines.
    const run = Math.min(1, t / 0.9);
    paths.forEach((pts, i) => {
      const to = i === 0 ? Math.min(1, run * 3) : Math.max(0, run * 1.5 - 0.5);
      if (to <= 0) return;
      if (this.gemPath('cyan', pts, { spacing: 14, alpha: glow, to })) return;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8 * glow; c.strokeStyle = '#7fe8ff'; c.lineWidth = 3; c.lineCap = 'round';
      c.setLineDash([10, 8]); c.lineDashOffset = -t * 60;
      const total = pts.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
      c.beginPath(); c.moveTo(...pts[0]);
      let left = total * to;
      for (let k = 1; k < pts.length && left > 0; k++) { const [ax, ay] = pts[k - 1], [bx, by] = pts[k], l = Math.hypot(bx - ax, by - ay), u = Math.min(1, left / l); c.lineTo(ax + (bx - ax) * u, ay + (by - ay) * u); left -= l; }
      c.stroke(); c.restore();
    });
    // The tuner itself flares as the light reaches it.
    const flare = glow * (0.6 + 0.4 * Math.sin(t * 14)), halo = c.createRadialGradient(tuner[0], tuner[1], 2, tuner[0], tuner[1], 70);
    halo.addColorStop(0, 'rgba(160, 240, 255, 0.9)'); halo.addColorStop(1, 'rgba(127, 232, 255, 0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = flare * Math.min(1, run * 2); c.fillStyle = halo; c.fillRect(tuner[0] - 70, tuner[1] - 70, 140, 140); c.restore();
  },
  /** Stone dust and small parts (the fallen mobs' parts, reused) dropping from above the view; seeded, so each keeps its path. */
  drawFallingRubble(t, calm) {
    const c = this.ctx, left = this.camera.x * 20, top = this.camera.y * 20, wide = VIEW_UNITS[0] * 20, tall = VIEW_UNITS[1] * 20;
    const span = COLLAPSE.land - COLLAPSE.crack * 0.5, share = calm ? CALM_SHARE : 1;
    c.save();
    for (let i = 0; i < Math.round(DUST * share); i++) {
      const start = COLLAPSE.crack * 0.5 + seeded(i, 1) * span, age = t - start;
      if (age < 0 || age > 2.2) continue;
      const x = left + seeded(i, 2) * wide + Math.sin(age * 2 + i) * 6, y = top - 20 + age * (60 + seeded(i, 3) * 50), r = 8 + seeded(i, 4) * 14;
      c.globalAlpha = 0.22 * Math.min(1, age * 3) * (1 - age / 2.2); c.fillStyle = '#e9dccb';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    for (let i = 0; i < Math.round(PIECES * share); i++) {
      const start = COLLAPSE.crack * 0.5 + seeded(i, 5) * span, age = t - start, land = top + (0.35 + seeded(i, 6) * 0.6) * tall;
      if (age < 0) continue;
      const y = top - 16 + 0.5 * 900 * age * age, x = left + seeded(i, 7) * wide;
      if (y > land + 6 || age > 1.6) continue;
      const size = 6 + Math.round(seeded(i, 8) * 7), spin = calm ? 0 : (seeded(i, 9) - 0.5) * 14 * age, art = this.mapImages?.get(DEBRIS_ART[i % DEBRIS_ART.length]);
      c.globalAlpha = 1; c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(spin);
      if (art && i % 3) { c.imageSmoothingEnabled = false; c.drawImage(art, -size / 2, -size / 2, size, size); }
      else { c.fillStyle = i % 2 ? '#cbbba6' : '#8d7a64'; c.fillRect(-size / 2, -size / 3, size, Math.max(2, size * 0.66)); c.fillStyle = 'rgba(43, 51, 69, 0.5)'; c.fillRect(-size / 2, size / 3 - 1, size, 1); }
      c.restore();
    }
    c.restore();
  },
};
