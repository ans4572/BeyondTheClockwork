// The light over a place: a tint for the hour, lamps that glow where the map painted them, a soft circle of light
// around the player, floating motes, and darker edges. Drawn on top of the world, under any words.

const PER_UNIT = 20, MAX_LAMPS = 40, MOTES = 36;
/** How each hour of the day looks: the tint laid over everything and how strongly lamps cut through it. */
export const MOODS = {
  day: { tint: 'rgba(255, 236, 200, 0.06)', dark: 0, glow: 0.22, edge: 0.28, mote: '#fff4d6' },
  dusk: { tint: 'rgba(110, 60, 110, 0.18)', dark: 0.32, glow: 0.5, edge: 0.42, mote: '#ffd29a' },
  night: { tint: 'rgba(18, 22, 52, 0.0)', dark: 0.55, glow: 0.75, edge: 0.5, mote: '#ffb85c' }
};

/** Finds the painted lamps in a map: clusters of bright, warm pixels. Returns spots in units with a strength. */
export function findLamps(image, size, createCanvas) {
  const w = 192, h = Math.round(192 * image.height / image.width), canvas = createCanvas(w, h), c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(image, 0, 0, w, h);
  const { data } = c.getImageData(0, 0, w, h), hot = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4, r = data[p], g = data[p + 1], b = data[p + 2];
    // A lamp's flame: very bright, warm (red and green high, blue low).
    if (r > 235 && g > 200 && b < 170 && r - b > 90) hot.push([x, y]);
  }
  const spots = [];
  for (const [x, y] of hot) {
    const near = spots.find(s => Math.abs(s.x - x) <= 3 && Math.abs(s.y - y) <= 3);
    if (near) { near.x = (near.x * near.n + x) / (near.n + 1); near.y = (near.y * near.n + y) / (near.n + 1); near.n++; } else spots.push({ x, y, n: 1 });
  }
  return spots.filter(s => s.n >= 2).sort((a, b) => b.n - a.n).slice(0, MAX_LAMPS)
    .map(s => ({ x: s.x / w * size[0], y: s.y / h * size[1], strength: Math.min(1, 0.5 + s.n / 12) }));
}

export class Lighting {
  constructor(createCanvas) { this.createCanvas = createCanvas; this.lamps = new WeakMap(); this.motes = []; }
  lampsFor(image, size) {
    if (!this.lamps.has(image)) this.lamps.set(image, findLamps(image, size, this.createCanvas));
    return this.lamps.get(image);
  }
  /**
   * `ctx` already holds the world under the camera transform; `view` is the visible area in units; `lights` are extra
   * lights (the player, casts) as { x, y, radius, color }.
   */
  draw(ctx, { mood, image, size, view, lights, time, still }) {
    const m = MOODS[mood] || MOODS.day, lamps = image ? this.lampsFor(image, size) : [];
    const { x: vx, y: vy, w: vw, h: vh } = view;
    ctx.save();
    // The hour's colour over everything.
    if (m.tint) { ctx.fillStyle = m.tint; ctx.fillRect(vx * PER_UNIT, vy * PER_UNIT, vw * PER_UNIT, vh * PER_UNIT); }
    // Darkness with holes where light falls: drawn on its own layer so lights can cut it.
    if (m.dark > 0) {
      const W = Math.ceil(vw * 10), H = Math.ceil(vh * 10);
      if (!this.shade || this.shade.width !== W || this.shade.height !== H) this.shade = this.createCanvas(W, H);
      const s = this.shade.getContext('2d');
      s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, W, H); s.fillStyle = `rgba(10, 12, 30, ${m.dark})`; s.fillRect(0, 0, W, H);
      s.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, k) => { const px = (x - vx) * 10, py = (y - vy) * 10, g = s.createRadialGradient(px, py, 0, px, py, r * 10); g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(1, 'rgba(0,0,0,0)'); s.fillStyle = g; s.fillRect(px - r * 10, py - r * 10, r * 20, r * 20); };
      for (const l of lamps) hole(l.x, l.y, 3.2 * l.strength, 0.9);
      for (const l of lights) hole(l.x, l.y, l.radius, 0.85);
      ctx.drawImage(this.shade, vx * PER_UNIT, vy * PER_UNIT, vw * PER_UNIT, vh * PER_UNIT);
    }
    // Warm glow added on top of each lamp, pulsing a little.
    // 'screen' brightens dark floor more than pale floor, so lamps glow without washing out bright paving.
    ctx.globalCompositeOperation = 'screen';
    for (const l of lamps) {
      if (l.x < vx - 3 || l.x > vx + vw + 3 || l.y < vy - 3 || l.y > vy + vh + 3) continue;
      const flicker = still ? 1 : 0.9 + 0.1 * Math.sin(time * 7 + l.x * 3), r = 2.1 * l.strength * PER_UNIT, x = l.x * PER_UNIT, y = l.y * PER_UNIT;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255, 186, 100, ${m.glow * 0.38 * flicker})`); g.addColorStop(1, 'rgba(255, 160, 80, 0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const l of lights) if (l.color) {
      const r = l.radius * PER_UNIT * 0.8, x = l.x * PER_UNIT, y = l.y * PER_UNIT, g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, l.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Floating motes: dust in the day, embers at night, drifting slowly up.
    if (!still) {
      while (this.motes.length < MOTES) this.motes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * 6.28 });
      ctx.fillStyle = m.mote;
      for (const mote of this.motes) {
        mote.y -= 0.0006 * mote.s; mote.x += Math.sin(time * 0.8 + mote.p) * 0.0004; if (mote.y < -0.02) { mote.y = 1.02; mote.x = Math.random(); }
        ctx.globalAlpha = (mood === 'day' ? 0.35 : 0.6) * (0.5 + 0.5 * Math.sin(time * 2 + mote.p));
        const px = (vx + mote.x * vw) * PER_UNIT, py = (vy + mote.y * vh) * PER_UNIT, d = mote.s > 1.2 ? 2 : 1;
        ctx.fillRect(Math.round(px), Math.round(py), d, d);
      }
      ctx.globalAlpha = 1;
    }
    // Darker edges keep the eye on the middle.
    ctx.globalCompositeOperation = 'source-over';
    const cx = (vx + vw / 2) * PER_UNIT, cy = (vy + vh / 2) * PER_UNIT, R = Math.hypot(vw, vh) / 2 * PER_UNIT, edge = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    edge.addColorStop(0, 'rgba(16, 14, 28, 0)'); edge.addColorStop(1, `rgba(16, 14, 28, ${m.edge})`);
    ctx.fillStyle = edge; ctx.fillRect(vx * PER_UNIT, vy * PER_UNIT, vw * PER_UNIT, vh * PER_UNIT);
    ctx.restore();
  }
}
