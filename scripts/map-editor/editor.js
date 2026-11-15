// 지도 벽 편집기: draws one village's picture with its floor outline (walkable) and walls (solids) on top, lets them be
// dragged, added to and cut, walks F2 through them with the game's own collision, and saves them back to src/data/maps.json
// through the local dev server (scripts/serve.mjs, POST /__dev/village). Dev only: scripts/ is not uploaded to Cloudflare.
// The depth mask (white = scenery drawn over a body standing behind it) can be painted too and is saved as a new PNG
// (POST /__dev/mask), 2026-11-14.
import { fitsMap } from '../../src/engine/map-geometry.js';

const PPU = 40, VERTEX_PX = 7, EDGE_PX = 6, CLOSE_PX = 10, REACH_UNIT = 0.25, WALK_SPEED = 4.5, HISTORY_LIMIT = 200, MASK_HISTORY_LIMIT = 30;
const MASK_BLUE = 'rgb(70, 140, 255)', MASK_ALPHA = 0.43;
const $ = id => document.getElementById(id);
const canvas = $('view'), ctx = canvas.getContext('2d');
const round = (v, step) => Math.round(v / step) * step;
const clamp2 = v => Math.round(v * 100) / 100;
const clone = v => JSON.parse(JSON.stringify(v));

const state = {
  maps: null, slice: null, id: null, village: null,
  shape: null,          // { walkable: [[x, y]], solids: [[[x, y]]] } being edited
  saved: '',            // JSON of the shape as last saved, to know when there are changes
  history: [], future: [],
  view: { scale: 1, ox: 0, oy: 0 },
  mode: 'edit', pick: null, hover: null, drag: null, draft: [],
  images: { background: null },
  mask: null,           // { canvas (white = scenery, black = floor), tint (its white in opaque blue), context, tintContext }
  maskDirty: false, brush: 0.5, lastDab: null,
  f2: null, keys: new Set(), space: false,
  reach: null, problems: [], places: [],
  geometry: null,       // a fresh copy for fitsMap (its clearance cache is keyed by array identity)
};

// ---------- loading ----------
async function load() {
  const [maps, slice] = await Promise.all(['maps', 'slice'].map(name => fetch(`../../src/data/${name}.json`, { cache: 'no-store' }).then(r => r.json())));
  state.maps = maps; state.slice = slice;
  const select = $('village');
  for (const [id, village] of Object.entries(maps.villages)) {
    const used = placesUsing(id).map(p => p.label);
    const option = new Option(`${id} · ${village.background.split('/').at(-2)}${used.length ? ` (${used.join(', ')})` : ' (안 쓰임)'}`, id);
    select.add(option);
  }
  const wanted = new URLSearchParams(location.search).get('v');
  select.value = maps.villages[wanted] ? wanted : Object.keys(maps.villages)[0];
  await openVillage(select.value);
}

/** Every place in the game that stands on this village's floor, with the points it needs on that floor. */
function placesUsing(id) {
  const maps = state.maps, roomNames = Object.fromEntries((state.slice?.rooms || []).map(r => [r.id, r.short || r.name || r.id])), out = [];
  // `ref` tells the dev server which place to write when positions are saved (scripts/serve.mjs savePlaces).
  for (const [room, place] of Object.entries(maps.maps || {})) if (place.village === id) out.push({ label: `${room} ${roomNames[room] || ''}`.trim(), room, place, reach: room !== 'stop-07', ref: { kind: 'room', room } });
  for (const [room, list] of Object.entries(maps.alternates || {})) list.forEach((place, i) => { if (place.village === id) out.push({ label: `${room} 그림${i + 2}`, room, place, reach: true, ref: { kind: 'alt', room, index: i } }); });
  if (maps.hub?.village === id) out.push({ label: '마을', place: maps.hub, reach: false, ref: { kind: 'hub' } });
  if (maps.intro?.village === id) out.push({ label: '폐기장 도입', place: maps.intro, reach: false, ref: { kind: 'intro' } });
  if (maps.practice?.village === id) out.push({ label: '뒷마당', place: maps.practice, reach: false, ref: { kind: 'practice' } });
  return out;
}

async function openVillage(id) {
  if (state.shape && dirty() && !confirm('저장하지 않은 변경이 있습니다. 버리고 다른 지도를 열까요?')) { $('village').value = state.id; return; }
  const village = state.maps.villages[id];
  state.id = id; state.village = village;
  state.shape = { walkable: clone(village.walkable || []), solids: clone(village.solids || []) };
  state.saved = JSON.stringify(state.shape);
  state.history = []; state.future = []; state.pick = null; state.draft = []; state.f2 = null;
  state.places = placesUsing(id); state.placesSaved = placesJSON();
  history.replaceState(null, '', `?v=${id}`);
  state.images.background = await image(village.background);
  state.mask = makeMask(village.mask ? await image(village.mask) : null, village.size); state.maskDirty = false;
  fit(); changed();
}
const image = src => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src.startsWith('/') ? `../..${src}` : src; });
/**
 * The depth mask at the size the game stores it (40 px a unit), as pure black and white, with a blue copy of its white
 * (scenery) pixels to draw over the map. A village without a mask file starts all floor.
 */
function makeMask(img, [w, h]) {
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(w * PPU), height: Math.round(h * PPU) });
  const tint = Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height });
  const context = canvas.getContext('2d', { willReadFrequently: true }), tintContext = tint.getContext('2d');
  context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
  if (img) { context.imageSmoothingEnabled = false; context.drawImage(img, 0, 0, canvas.width, canvas.height); }
  const mask = { canvas, tint, context, tintContext };
  redrawTint(mask); return mask;
}
/** Snaps the mask to pure black and white and rebuilds its blue copy (after loading or an undo). */
function redrawTint(mask) {
  const { width, height } = mask.canvas, data = mask.context.getImageData(0, 0, width, height), d = data.data;
  const blue = mask.tintContext.createImageData(width, height), b = blue.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i] > 127; d[i] = d[i + 1] = d[i + 2] = on ? 255 : 0; d[i + 3] = 255;
    b[i] = 70; b[i + 1] = 140; b[i + 2] = 255; b[i + 3] = on ? 255 : 0;
  }
  mask.context.putImageData(data, 0, 0); mask.tintContext.putImageData(blue, 0, 0);
}
/** One round dab of the brush at (x, y) in units: scenery, or floor when `erase`. */
function dab(x, y, erase) {
  const { canvas, context, tintContext } = state.mask, perUnit = canvas.width / state.village.size[0], r = Math.max(0.5, state.brush * perUnit);
  const shape = k => { k.beginPath(); k.arc(x * perUnit, y * perUnit, r, 0, Math.PI * 2); k.fill(); };
  context.fillStyle = erase ? '#000' : '#fff'; shape(context);
  tintContext.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; tintContext.fillStyle = MASK_BLUE; shape(tintContext);
  tintContext.globalCompositeOperation = 'source-over';
}
/** Dabs along the stroke from the last dab, close enough that a fast drag leaves no gaps. */
function stroke(x, y, erase) {
  const from = state.lastDab || [x, y], steps = Math.max(1, Math.ceil(Math.hypot(x - from[0], y - from[1]) / Math.max(0.05, state.brush * 0.4)));
  for (let i = 1; i <= steps; i++) dab(from[0] + (x - from[0]) * i / steps, from[1] + (y - from[1]) * i / steps, erase);
  state.lastDab = [x, y]; state.maskDirty = true;
}
/** The mask as rows of packed bits (white = 1), what the dev server writes as a 1-bit PNG. */
function maskBits() {
  const { width, height } = state.mask.canvas, d = state.mask.context.getImageData(0, 0, width, height).data, rowBytes = Math.ceil(width / 8), bytes = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (d[(y * width + x) * 4] > 127) bytes[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { width, height, bits: btoa(text) };
}

// ---------- changes, history ----------
// History entries are { shape } (the walls as JSON) or { mask } (the mask's pixels before a stroke); one Ctrl+Z for both.
const shapeDirty = () => JSON.stringify(state.shape) !== state.saved;
const dirty = () => shapeDirty() || state.maskDirty || placesDirty();

// ---------- start, exit, monster and boss positions (2026-11-15) ----------
/** Every movable point of a place: start, exit portal, boss and each monster, in a fixed order. */
function pointsOf(place) {
  const out = [];
  if (place.spawn) out.push({ key: 'spawn', p: place.spawn, text: '시작', color: '#5ac8fa' });
  const portal = place.portal || place.exit?.portal;
  if (portal) out.push({ key: 'portal', p: portal, text: '출구', color: '#ffd34d' });
  if (place.bossSpawn) out.push({ key: 'bossSpawn', p: place.bossSpawn, text: '보스', color: '#c77dff' });
  (place.enemySpawns || []).forEach((p, i) => out.push({ key: 'enemySpawns', i, p, text: `몹 ${i + 1}`, color: 'rgba(255, 150, 60, 0.95)' }));
  return out;
}
const placesJSON = () => JSON.stringify(state.places.map(e => pointsOf(e.place).map(h => [h.p.x, h.p.y])));
const placesDirty = () => !!state.places && placesJSON() !== state.placesSaved;
function setPlaces(json) {
  JSON.parse(json).forEach((list, e) => pointsOf(state.places[e].place).forEach((h, k) => { h.p.x = list[k][0]; h.p.y = list[k][1]; }));
}
/** The point nearest the pointer, within reach on screen. */
function hitPoint(sx, sy) {
  let best = null;
  state.places.forEach((entry, e) => pointsOf(entry.place).forEach(h => {
    const [px, py] = toScreen([h.p.x, h.p.y]), d = Math.hypot(px - sx, py - sy);
    if (d <= Math.max(9, bodyRadius() * PPU * state.view.scale + 3) && (!best || d < best.d)) best = { entry: e, handle: h, d };
  }));
  return best;
}
const maskPixels = () => state.mask.context.getImageData(0, 0, state.mask.canvas.width, state.mask.canvas.height);
function push(list, entry) {
  list.push(entry);
  if (list.length > HISTORY_LIMIT) list.shift();
  // Mask snapshots are a few MB each: only the latest few are kept.
  const masks = list.filter(e => e.mask);
  if (masks.length > MASK_HISTORY_LIMIT) list.splice(list.indexOf(masks[0]), 1);
}
function remember() { push(state.history, { shape: JSON.stringify(state.shape) }); state.future = []; }
function rememberPlaces() { push(state.history, { places: placesJSON() }); state.future = []; }
function rememberMask() { push(state.history, { mask: maskPixels() }); state.future = []; }
function restore(entry, into) {
  if (entry.places) { push(into, { places: placesJSON() }); setPlaces(entry.places); }
  else if (entry.mask) { push(into, { mask: maskPixels() }); state.mask.context.putImageData(entry.mask, 0, 0); redrawTint(state.mask); state.maskDirty = true; }
  else { push(into, { shape: JSON.stringify(state.shape) }); state.shape = JSON.parse(entry.shape); state.pick = null; }
  changed();
}
function undo() { if (state.history.length) restore(state.history.pop(), state.future); }
function redo() { if (state.future.length) restore(state.future.pop(), state.history); }

let reachTimer = 0;
/** After any edit: a fresh geometry copy for the collision code, then (a moment later) the reach check. */
function changed() {
  state.geometry = { ...state.village, walkable: clone(state.shape.walkable), solids: clone(state.shape.solids) };
  if (state.f2 && !fitsMap(state.f2.x, state.f2.y, bodyRadius(), state.geometry)) state.f2.blocked = true;
  clearTimeout(reachTimer); reachTimer = setTimeout(checkReach, 200);
  updateBar(); draw();
}
const bodyRadius = () => state.village.bodyRadius ?? state.slice.arena.playerRadius;
const painting = () => state.mode === 'paint' || state.mode === 'erase';

/**
 * The same checks the game and its tests make: every start point stands on the floor (src/engine/data.js stops the game
 * loading otherwise), and each fight room's exit can be walked to from its start (test/village.test.js).
 */
function checkReach() {
  const map = state.geometry, problems = [], radius = state.slice.arena.playerRadius;
  let cells = null;
  for (const entry of state.places) {
    const place = entry.place, points = [['시작', place.spawn], ...(place.enemySpawns || []).map((p, i) => [`몹 ${i + 1}`, p]), ['보스', place.bossSpawn]].filter(([, p]) => p);
    for (const [name, p] of points) if (!fitsMap(p.x, p.y, bodyRadius(), map)) problems.push({ bad: true, text: `${entry.label}: ${name} 위치(${p.x}, ${p.y})가 바닥 밖이거나 벽 안 → 게임이 안 열림`, at: p });
    if (!entry.reach || !place.spawn || !place.portal) continue;
    const reached = flood(map, place.spawn, radius);
    if (!cells) cells = reached.cells;
    const ok = reached.list.some(([x, y]) => Math.hypot(x * REACH_UNIT - place.portal.x, y * REACH_UNIT - place.portal.y) <= 1);
    problems.push({ bad: !ok, text: `${entry.label}: 시작 → 출구 ${ok ? '연결됨' : '끊김 (출구까지 못 감)'}`, at: ok ? null : place.portal });
  }
  if (!cells && state.places[0]?.place.spawn) cells = flood(map, state.places[0].place.spawn, radius).cells;
  state.reach = cells; state.problems = problems; updateStatus(); draw();
}
function flood(map, from, radius) {
  const key = (x, y) => `${x},${y}`, start = [Math.round(from.x / REACH_UNIT), Math.round(from.y / REACH_UNIT)], seen = new Set([key(...start)]), queue = [start], list = [];
  for (let head = 0; head < queue.length && head < 200000; head++) {
    const [x, y] = queue[head]; list.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!seen.has(k) && fitsMap(nx * REACH_UNIT, ny * REACH_UNIT, radius, map)) { seen.add(k); queue.push([nx, ny]); }
    }
  }
  return { list, cells: list };
}

// ---------- view ----------
function resize() {
  const bar = $('bar').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--top', `${bar}px`);
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  draw();
}
function fit() {
  const r = canvas.getBoundingClientRect(), [w, h] = state.village.size;
  const scale = Math.min((r.width - 330) / (w * PPU), (r.height - 20) / (h * PPU));
  state.view = { scale, ox: 10, oy: 10 + Math.max(0, (r.height - 20 - h * PPU * scale) / 2) };
  draw();
}
const toScreen = ([x, y]) => [state.view.ox + x * PPU * state.view.scale, state.view.oy + y * PPU * state.view.scale];
const toWorld = (sx, sy) => [(sx - state.view.ox) / (PPU * state.view.scale), (sy - state.view.oy) / (PPU * state.view.scale)];
const mouse = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

/** Every outline as [kind, index, points]: the floor first, then each wall. */
const outlines = () => [['walk', 0, state.shape.walkable], ...state.shape.solids.map((s, i) => ['solid', i, s])];
const polygonOf = (kind, index) => kind === 'walk' ? state.shape.walkable : state.shape.solids[index];

function hitVertex(sx, sy) {
  let best = null;
  for (const [kind, index, points] of outlines()) points.forEach((p, vertex) => {
    const [px, py] = toScreen(p), d = Math.hypot(px - sx, py - sy);
    if (d <= VERTEX_PX && (!best || d < best.d)) best = { kind, index, vertex, d };
  });
  return best;
}
function hitEdge(sx, sy) {
  let best = null;
  for (const [kind, index, points] of outlines()) for (let i = 0; i < points.length; i++) {
    const a = toScreen(points[i]), b = toScreen(points[(i + 1) % points.length]);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((sx - a[0]) * dx + (sy - a[1]) * dy) / len));
    const d = Math.hypot(a[0] + t * dx - sx, a[1] + t * dy - sy);
    if (d <= EDGE_PX && (!best || d < best.d)) best = { kind, index, after: i, d, t };
  }
  return best;
}
function hitSolid(x, y) {
  for (let i = state.shape.solids.length - 1; i >= 0; i--) if (inside(x, y, state.shape.solids[i])) return i;
  return -1;
}
function inside(x, y, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}

// ---------- drawing ----------
function draw() {
  if (!state.village) return;
  const dpr = window.devicePixelRatio || 1, { scale } = state.view, [w, h] = state.village.size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const [x0, y0] = toScreen([0, 0]), pw = w * PPU * scale, ph = h * PPU * scale;
  ctx.imageSmoothingEnabled = scale < 1.5;
  if (state.images.background) ctx.drawImage(state.images.background, x0, y0, pw, ph);
  if (($('show-mask').checked || painting()) && state.mask) { ctx.globalAlpha = MASK_ALPHA; ctx.drawImage(state.mask.tint, x0, y0, pw, ph); ctx.globalAlpha = 1; }
  ctx.strokeStyle = '#11151f'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, pw, ph);

  // The floor outside the outline darkened, so the walkable part reads at a glance.
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, pw, ph); trace(state.shape.walkable); ctx.fillStyle = `rgba(10, 12, 20, ${painting() ? 0.15 : 0.45})`; ctx.fill('evenodd');
  ctx.restore();

  if ($('show-reach').checked && state.reach) {
    const size = REACH_UNIT * PPU * scale;
    ctx.fillStyle = 'rgba(120, 255, 150, 0.16)';
    for (const [x, y] of state.reach) { const [sx, sy] = toScreen([x * REACH_UNIT, y * REACH_UNIT]); ctx.fillRect(sx - size / 2, sy - size / 2, size, size); }
  }

  outline(state.shape.walkable, '#4fbf6a', null, isPicked('walk', 0));
  state.shape.solids.forEach((solid, i) => outline(solid, '#e0564c', 'rgba(224, 86, 76, 0.32)', isPicked('solid', i)));
  for (const [kind, index, points] of outlines()) points.forEach((p, vertex) => {
    const [sx, sy] = toScreen(p), on = state.pick?.kind === kind && state.pick.index === index && state.pick.vertex === vertex;
    const hover = state.hover?.kind === kind && state.hover.index === index && state.hover.vertex === vertex;
    ctx.fillStyle = on ? '#ffd34d' : hover ? '#ffffff' : kind === 'walk' ? '#bff5c9' : '#ffc2bc';
    ctx.strokeStyle = '#11151f'; ctx.lineWidth = 1.5;
    const r = on || hover ? 5 : 3.5; ctx.fillRect(sx - r, sy - r, r * 2, r * 2); ctx.strokeRect(sx - r, sy - r, r * 2, r * 2);
  });

  if (state.draft.length) {
    ctx.beginPath(); state.draft.forEach((p, i) => { const [sx, sy] = toScreen(p); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    if (state.hoverWorld) { const [sx, sy] = toScreen(state.hoverWorld); ctx.lineTo(sx, sy); }
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    state.draft.forEach((p, i) => { const [sx, sy] = toScreen(p); ctx.fillStyle = i ? '#ffd34d' : '#ffffff'; ctx.fillRect(sx - 4, sy - 4, 8, 8); });
  }

  if ($('show-places').checked) drawPlaces();
  for (const problem of state.problems) if (problem.bad && problem.at) {
    const [sx, sy] = toScreen([problem.at.x, problem.at.y]);
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.stroke();
  }
  if (state.f2) {
    const [sx, sy] = toScreen([state.f2.x, state.f2.y]), r = bodyRadius() * PPU * scale;
    ctx.fillStyle = state.f2.blocked ? 'rgba(255, 90, 80, 0.85)' : 'rgba(80, 200, 255, 0.85)';
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#11151f'; ctx.lineWidth = 2; ctx.stroke();
    label('F2', sx, sy - r - 6, '#ffffff');
  }
  if (painting() && state.hoverWorld) {
    const [sx, sy] = toScreen(state.hoverWorld);
    ctx.strokeStyle = state.mode === 'erase' ? '#ff8a80' : '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, state.brush * PPU * scale), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (state.hoverWorld) {
    const [x, y] = state.hoverWorld;
    ctx.fillStyle = 'rgba(17, 21, 31, 0.85)'; ctx.fillRect(8, canvas.clientHeight - 30, 150, 22);
    ctx.fillStyle = '#f6ecd2'; ctx.font = '12px Galmuri11, sans-serif'; ctx.fillText(`x ${x.toFixed(2)}  y ${y.toFixed(2)}`, 16, canvas.clientHeight - 14);
  }
}
function trace(points) { points.forEach((p, i) => { const [sx, sy] = toScreen(p); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); }
function outline(points, stroke, fill, picked) {
  if (points.length < 2) return;
  ctx.beginPath(); trace(points);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = picked ? '#ffd34d' : stroke; ctx.lineWidth = picked ? 3 : 2; ctx.stroke();
}
const isPicked = (kind, index) => state.pick?.kind === kind && state.pick.index === index;
function label(text, sx, sy, color) {
  ctx.font = 'bold 12px Galmuri11, sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#11151f'; ctx.strokeText(text, sx, sy); ctx.fillStyle = color; ctx.fillText(text, sx, sy);
  ctx.textAlign = 'start';
}
function drawPlaces() {
  const scale = state.view.scale, dot = (p, color, text) => {
    const [sx, sy] = toScreen([p.x, p.y]);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, bodyRadius() * PPU * scale), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#11151f'; ctx.lineWidth = 1.5; ctx.stroke(); if (text) label(text, sx, sy - 10, color);
  };
  const moving = state.mode === 'move', many = state.places.length > 1;
  for (const { place, label: name } of state.places) {
    if (place.exit?.polygon) { ctx.setLineDash([5, 4]); outline(place.exit.polygon, '#ffd34d', 'rgba(255, 211, 77, 0.15)', false); ctx.setLineDash([]); }
    if (moving) {
      // In 위치 옮기기 every point is labelled (with its room when several rooms share the map), and the one under the pointer is ringed.
      for (const h of pointsOf(place)) {
        const [sx, sy] = toScreen([h.p.x, h.p.y]), on = state.hover?.handle === h || state.drag?.handle === h;
        if (h.key === 'portal') { ctx.strokeStyle = h.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, PPU * scale, 0, Math.PI * 2); ctx.stroke(); }
        dot(h.p, h.color, `${h.text}${many ? ' · ' + name.split(' ')[0] : ''}`);
        if (on) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx, sy, Math.max(9, bodyRadius() * PPU * scale + 4), 0, Math.PI * 2); ctx.stroke(); }
      }
      continue;
    }
    for (const p of place.enemySpawns || []) dot(p, 'rgba(255, 150, 60, 0.85)', '');
    if (place.bossSpawn) dot(place.bossSpawn, '#c77dff', '보스');
    if (place.portal) { const [sx, sy] = toScreen([place.portal.x, place.portal.y]); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, PPU * scale, 0, Math.PI * 2); ctx.stroke(); label('출구', sx, sy - PPU * scale - 4, '#ffd34d'); }
    if (place.spawn) dot(place.spawn, '#5ac8fa', state.places.length > 1 ? `시작 ${name.split(' ')[0]}` : '시작');
  }
}

// ---------- side panel, toolbar ----------
function updateStatus() {
  const v = state.village, bad = state.problems.filter(p => p.bad).length;
  $('status').innerHTML = `<h2>${state.id}</h2><div class="dim">${v.background.split('/').at(-2)} · ${v.size[0]}×${v.size[1]}칸 · 몸 반지름 ${bodyRadius()}</div>`
    + `<div>바닥 점 ${state.shape.walkable.length}개 · 벽 ${state.shape.solids.length}개</div>`
    + `<div class="dim">마스크 ${v.mask ? v.mask.split('/').at(-1) : '없음'}${v.maskEdited ? ' · 손으로 칠함' : ''}${state.maskDirty ? ' <span class="bad">(칠한 것 저장 안 됨)</span>' : ''}</div>`
    + `<h2>쓰는 곳</h2>${state.places.length ? `<ul>${state.places.map(p => `<li>${p.label}</li>`).join('')}</ul>` : '<div class="dim">아직 어느 방도 이 지도를 쓰지 않습니다.</div>'}`
    + `<h2>검사 ${bad ? `<span class="bad">문제 ${bad}개</span>` : '<span class="ok">통과</span>'}</h2>`
    + (state.problems.length ? `<ul>${state.problems.map(p => `<li class="${p.bad ? 'bad' : 'ok'}">${p.text}</li>`).join('')}</ul>` : '<div class="dim">검사할 시작점이 없습니다.</div>')
    + (state.mode === 'move' && state.hover?.handle ? `<h2>위치</h2><div>${state.places[state.hover.entry].label} · ${state.hover.handle.text} (${state.hover.handle.p.x}, ${state.hover.handle.p.y})</div>` : '')
    + (placesDirty() ? '<div class="bad">옮긴 위치 저장 안 됨</div>' : '')
    + (state.pick ? `<h2>선택</h2><div>${state.pick.kind === 'walk' ? '바닥 테두리' : `벽 ${state.pick.index + 1}`}${state.pick.vertex != null ? ` · 점 ${state.pick.vertex + 1} (${polygonOf(state.pick.kind, state.pick.index)[state.pick.vertex].join(', ')})` : ''}</div>` : '');
}
function updateBar() {
  $('undo').disabled = !state.history.length; $('redo').disabled = !state.future.length; $('delete').disabled = !state.pick;
  $('save').dataset.dirty = dirty(); $('save').textContent = dirty() ? '저장 *' : '저장됨';
  for (const mode of ['edit', 'draw', 'walk', 'move', 'paint', 'erase']) $(`mode-${mode}`).setAttribute('aria-pressed', state.mode === mode);
  updateStatus();
}
function setMode(mode) {
  state.mode = mode; state.draft = []; state.hover = null; if (mode === 'paint' || mode === 'erase' || mode === 'move') state.pick = null; if (mode !== 'walk') state.keys.clear();
  if (mode === 'walk' && !state.f2) { const s = state.places.find(p => p.place.spawn)?.place.spawn; if (s) state.f2 = { x: s.x, y: s.y }; }
  updateBar(); draw();
}
function toast(text, ms = 2200) { const t = $('toast'); t.textContent = text; t.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.style.display = 'none'; }, ms); }

// ---------- editing ----------
function removePicked() {
  const pick = state.pick; if (!pick) return;
  const polygon = polygonOf(pick.kind, pick.index);
  if (pick.vertex != null) {
    if (polygon.length <= 3) {
      if (pick.kind === 'walk') return toast('바닥 테두리는 점이 3개보다 적을 수 없습니다.');
      if (!confirm('점이 3개뿐이라 이 벽을 통째로 지웁니다. 계속할까요?')) return;
      remember(); state.shape.solids.splice(pick.index, 1);
    } else { remember(); polygon.splice(pick.vertex, 1); }
  } else if (pick.kind === 'solid') { remember(); state.shape.solids.splice(pick.index, 1); }
  else return toast('바닥 테두리 자체는 지울 수 없습니다. 점을 골라 지우세요.');
  state.pick = null; changed();
}
function closeDraft() {
  if (state.draft.length < 3) return toast('벽은 점이 3개 이상이어야 합니다.');
  remember(); state.shape.solids.push(state.draft.map(([x, y]) => [clamp2(x), clamp2(y)]));
  state.pick = { kind: 'solid', index: state.shape.solids.length - 1, vertex: null };
  state.draft = []; changed(); toast('새 벽을 추가했습니다.');
}

async function save() {
  const bad = state.problems.filter(p => p.bad);
  if (shapeDirty() && bad.length && !confirm(`검사에서 문제 ${bad.length}개가 나왔습니다.\n\n${bad.map(p => '· ' + p.text).join('\n')}\n\n그래도 저장할까요?`)) return;
  const post = async (url, body) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return response.json();
  };
  try {
    const done = [];
    if (placesDirty()) {
      await post('/__dev/places', { id: state.id, places: state.places.map(e => {
        const out = { ref: e.ref };
        for (const h of pointsOf(e.place)) { if (h.key === 'enemySpawns') (out.enemySpawns ||= []).push({ x: h.p.x, y: h.p.y }); else out[h.key] = { x: h.p.x, y: h.p.y }; }
        return out;
      }) });
      state.placesSaved = placesJSON(); done.push('위치');
    }
    if (shapeDirty() || (!state.maskDirty && !done.length)) {
      await post('/__dev/village', { id: state.id, ...state.shape });
      state.saved = JSON.stringify(state.shape);
      state.maps.villages[state.id].walkable = clone(state.shape.walkable); state.maps.villages[state.id].solids = clone(state.shape.solids);
      done.push('벽');
    }
    if (state.maskDirty) {
      const { mask } = await post('/__dev/mask', { id: state.id, ...maskBits() });
      state.village.mask = mask; state.village.maskEdited = true; state.maskDirty = false;
      done.push(`마스크(${mask.split('/').at(-1)})`);
    }
    updateBar(); toast(`${done.join('·')} 저장했습니다. 게임 탭을 새로고침하면 바로 적용됩니다.`, 3600);
  } catch (error) { toast(`저장 실패: ${error.message} (로컬 서버 scripts/serve.mjs로 열었는지 확인)`, 5000); }
}

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  const [sx, sy] = mouse(e), [x, y] = toWorld(sx, sy);
  if (e.button === 1 || e.button === 0 && state.space) { state.drag = { pan: true, sx, sy, ox: state.view.ox, oy: state.view.oy }; canvas.classList.add('panning'); return; }
  if (painting() && (e.button === 0 || e.button === 2)) {
    rememberMask(); state.lastDab = null; state.drag = { paint: true, erase: (e.button === 2 || e.altKey) !== (state.mode === 'erase') };
    stroke(x, y, state.drag.erase); updateBar(); draw(); return;
  }
  if (e.button === 2) { const v = hitVertex(sx, sy); if (v) { state.pick = v; removePicked(); } return; }
  if (state.mode === 'walk') { state.f2 = { x, y, blocked: !fitsMap(x, y, bodyRadius(), state.geometry) }; draw(); return; }
  if (state.mode === 'move') {
    const hit = hitPoint(sx, sy);
    if (hit) { rememberPlaces(); state.drag = { handle: hit.handle, entry: hit.entry, moved: false }; state.hover = hit; updateBar(); draw(); return; }
    state.drag = { pan: true, sx, sy, ox: state.view.ox, oy: state.view.oy }; canvas.classList.add('panning'); return;
  }
  if (state.mode === 'draw') {
    if (state.draft.length >= 3) { const [fx, fy] = toScreen(state.draft[0]); if (Math.hypot(fx - sx, fy - sy) <= CLOSE_PX) return closeDraft(); }
    state.draft.push([x, y]); draw(); return;
  }
  const vertex = hitVertex(sx, sy);
  if (vertex) { state.pick = vertex; remember(); state.drag = { vertex, moved: false }; updateBar(); draw(); return; }
  const edge = hitEdge(sx, sy);
  if (edge) { state.pick = { kind: edge.kind, index: edge.index, vertex: null }; updateBar(); draw(); return; }
  const solid = hitSolid(x, y);
  if (solid >= 0) { state.pick = { kind: 'solid', index: solid, vertex: null }; remember(); state.drag = { solid, from: [x, y], start: clone(state.shape.solids[solid]), moved: false }; updateBar(); draw(); return; }
  state.pick = null; state.drag = { pan: true, sx, sy, ox: state.view.ox, oy: state.view.oy }; canvas.classList.add('panning'); updateBar(); draw();
});
window.addEventListener('mousemove', e => {
  const [sx, sy] = mouse(e), [x, y] = toWorld(sx, sy), drag = state.drag;
  state.hoverWorld = [x, y];
  if (drag?.pan) { state.view.ox = drag.ox + sx - drag.sx; state.view.oy = drag.oy + sy - drag.sy; draw(); return; }
  if (drag?.paint) { stroke(x, y, drag.erase); draw(); return; }
  const step = e.shiftKey ? 0.1 : 0.01;
  if (drag?.vertex) {
    const v = drag.vertex; polygonOf(v.kind, v.index)[v.vertex] = [clamp2(round(x, step)), clamp2(round(y, step))]; drag.moved = true;
    state.geometry = null; draw(); return;
  }
  if (drag?.handle) { drag.handle.p.x = clamp2(round(x, step)); drag.handle.p.y = clamp2(round(y, step)); drag.moved = true; updateStatus(); draw(); return; }
  if (drag?.solid != null) {
    const dx = round(x - drag.from[0], step), dy = round(y - drag.from[1], step);
    state.shape.solids[drag.solid] = drag.start.map(([px, py]) => [clamp2(px + dx), clamp2(py + dy)]); drag.moved = true; draw(); return;
  }
  if (state.mode === 'edit') state.hover = hitVertex(sx, sy);
  if (state.mode === 'move') { const before = state.hover?.handle; state.hover = hitPoint(sx, sy); if (before !== state.hover?.handle) updateStatus(); }
  draw();
});
window.addEventListener('mouseup', () => {
  const drag = state.drag; state.drag = null; canvas.classList.remove('panning');
  if (!drag || drag.pan) return;
  if (drag.paint) { state.lastDab = null; updateBar(); return; }
  if (!drag.moved) state.history.pop(); // a click without a move is not an edit
  changed();
});
canvas.addEventListener('dblclick', e => {
  if (state.mode !== 'edit') return;
  const [sx, sy] = mouse(e), edge = hitEdge(sx, sy);
  if (!edge || hitVertex(sx, sy)) return;
  const [x, y] = toWorld(sx, sy), polygon = polygonOf(edge.kind, edge.index);
  remember(); polygon.splice(edge.after + 1, 0, [clamp2(x), clamp2(y)]);
  state.pick = { kind: edge.kind, index: edge.index, vertex: edge.after + 1 }; changed();
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const [sx, sy] = mouse(e), [x, y] = toWorld(sx, sy), factor = Math.exp(-e.deltaY * 0.0015);
  state.view.scale = Math.max(0.2, Math.min(8, state.view.scale * factor));
  state.view.ox = sx - x * PPU * state.view.scale; state.view.oy = sy - y * PPU * state.view.scale; draw();
}, { passive: false });
canvas.addEventListener('mouseleave', () => { state.hoverWorld = null; draw(); });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  const key = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key === 's') { e.preventDefault(); save(); return; }
  if (ctrl && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && key === 'y') { e.preventDefault(); redo(); return; }
  if (key === ' ') { state.space = true; e.preventDefault(); return; }
  if (state.mode === 'walk' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { state.keys.add(key); e.preventDefault(); return; }
  if (key === 'delete' || key === 'backspace') { e.preventDefault(); if (state.mode === 'draw') { state.draft.pop(); draw(); } else removePicked(); return; }
  if (key === 'enter' && state.mode === 'draw') return closeDraft();
  if (key === 'escape') { if (state.draft.length) { state.draft = []; draw(); } else setMode('edit'); return; }
  if (key === 'e') setMode('edit');
  if (key === 'n') setMode('draw');
  if (key === 't') setMode(state.mode === 'walk' ? 'edit' : 'walk');
  if (key === 'm') setMode(state.mode === 'paint' ? 'edit' : 'paint');
  if (key === 'x') setMode(state.mode === 'erase' ? 'edit' : 'erase');
  if (key === 'p') setMode(state.mode === 'move' ? 'edit' : 'move');
  if (key === '[' || key === ']') setBrush(state.brush * (key === ']' ? 1.25 : 0.8));
  if (key === 'f') fit();
});
window.addEventListener('keyup', e => { const key = e.key.toLowerCase(); if (key === ' ') state.space = false; state.keys.delete(key); });
window.addEventListener('blur', () => { state.keys.clear(); state.space = false; });
window.addEventListener('beforeunload', e => { if (state.shape && dirty()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('resize', resize);

// Test walk: the game's own collision (fitsMap) with the same slide along a wall when only one axis is free.
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.mode === 'walk' && state.f2 && state.keys.size && state.geometry) {
    const k = state.keys, ix = (k.has('d') || k.has('arrowright')) - (k.has('a') || k.has('arrowleft')), iy = (k.has('s') || k.has('arrowdown')) - (k.has('w') || k.has('arrowup'));
    if (ix || iy) {
      const len = Math.hypot(ix, iy), dx = ix / len * WALK_SPEED * dt, dy = iy / len * WALK_SPEED * dt, r = bodyRadius(), f2 = state.f2, map = state.geometry;
      if (fitsMap(f2.x + dx, f2.y + dy, r, map)) { f2.x += dx; f2.y += dy; f2.blocked = false; }
      else if (dx && fitsMap(f2.x + dx, f2.y, r, map)) { f2.x += dx; f2.blocked = false; }
      else if (dy && fitsMap(f2.x, f2.y + dy, r, map)) { f2.y += dy; f2.blocked = false; }
      else f2.blocked = !fitsMap(f2.x, f2.y, r, map);
      draw();
    }
  }
  requestAnimationFrame(tick);
}

$('village').addEventListener('change', e => openVillage(e.target.value));
$('mode-edit').onclick = () => setMode('edit');
$('mode-draw').onclick = () => setMode('draw');
$('mode-walk').onclick = () => setMode('walk');
$('mode-paint').onclick = () => setMode('paint');
$('mode-erase').onclick = () => setMode('erase');
$('mode-move').onclick = () => setMode('move');
function setBrush(size) { state.brush = Math.round(Math.max(0.1, Math.min(3, size)) * 100) / 100; $('brush').value = state.brush; $('brush-size').textContent = state.brush; draw(); }
$('brush').addEventListener('input', e => setBrush(Number(e.target.value)));
$('undo').onclick = undo; $('redo').onclick = redo; $('delete').onclick = removePicked;
$('fit').onclick = fit; $('save').onclick = save;
$('help-toggle').onclick = () => { $('help').hidden = !$('help').hidden; };
for (const id of ['show-mask', 'show-reach', 'show-places']) $(id).addEventListener('change', draw);

resize();
load().then(() => { resize(); requestAnimationFrame(tick); }).catch(error => { $('status').innerHTML = `<p class="bad">불러오기 실패: ${error.message}</p>`; });
