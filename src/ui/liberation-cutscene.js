// The town's liberation as a cutscene (2026-11-19, the user's word), the first time Orden at the last hour falls.
// Drawn from the game's own art (2026-11-20, the user's word: painted by an image model, F2, Moru, Nasa, the townsfolk
// and Orden did not look like themselves): the two maps' own paintings for the places, and every body as its own
// sprite at its own size, on a camera that drifts slowly over them.
//  summit  Orden (his awakened sprite) breaks up from his feet into squares of his own colours and rises away in a
//          column of light; the music stops; one last mote of his light drifts down to F2 and goes out.
//  (2026-11-20, the user's picks for an afterglow: the silence, the last mote, the tower far off with its clock going
//  again, and a slow fall to black with the title.)
//  village the town stands frozen by his last bell (washed grey-blue, his seal over every head); a wave of gold light
//          rolls out from F2 and gives everyone their colour back as it passes, breaking the seals; they wake, startled;
//          in the morning they go their own ways, and Bolt comes running to F2. Then a closer view: F2, Moru, Nasa and
//          Bolt together, held a while; the petals keep falling as it goes dark.
//  tower   (when its painting is there) the clock tower seen far off from the village, the camera rising up it; its
//          stopped hands tick and start to go.
//  title   black, the last petals, the game's name.
// A line of narration over it. Escape, Enter, Space, the skip button or the pad's A / Start ends it early. Resolves once
// it has faded out.

const COURT = { src: '/art/chapters/1-smile-street/maps/00-village-court/background-v8-2x-q85.webp', ppu: 80 };
const SUMMIT = { src: '/art/chapters/3-clock-tower/maps/11-ruined-summit/background-v6-2x-q85.webp', ppu: 80 };
const CLIP_FILES = ['/art/animations/npc/game-clips.json', '/art/animations/player/game-clips.json', '/art/animations/mobs/clock-tower/game-clips.json'];
const SEAL = { sheet: '/art/chapters/3-clock-tower/bosses/orden/fx/sigil-stop-v1.png', frameWidth: 64, frameHeight: 48, columns: 4, frameCount: 20, anchor: [32, 24], scale: 1, bodyHeight: 0, fps: 20 };
/**
 * pixelfx sheets (2026-11-20, the user's word: his vanishing and the light over the village drawn in pixelfx): the column
 * of light he passes up into (belfry/od-ascend), a spell's landing for the last flash (od-burst). (The light falling over
 * the village from the sky, od-skyfall, was taken out the same day: too big over the town, the user's word.)
 */
const FX_DIR = '/art/chapters/3-clock-tower/bosses/orden/fx/';
const ASCEND = { sheet: FX_DIR + 'ascend-v1.png', w: 128, h: 240, cols: 8, frames: 32, anchor: [64, 222], fps: 20 };
const FLASH = { sheet: FX_DIR + 'burst-cyan-v1.png', w: 128, h: 176, cols: 6, frames: 25, anchor: [64, 140], fps: 30 };
/** The last mote of his light (pixelfx belfry/od-mote). */
const MOTE = { sheet: FX_DIR + 'mote-v1.png', w: 40, h: 40, cols: 5, frames: 24, anchor: [20, 20], fps: 20 };
/**
 * The tower far off (art/scenes/liberation/tower-far, painted from codex-tower-far.task.md): its clock face drawn with no
 * hands, `face` its middle and radius in painting pixels (from the painter's report); the hands are pixelfx
 * belfry/tower-hands (frame 0 the minute hand, 1 the hour hand, pointing up, `len` the minute hand's length in sheet
 * pixels). The shot plays only once the painting has loaded: until it is painted the cutscene goes from the village
 * straight to black.
 */
const TOWER = { src: '/art/scenes/liberation/tower-far/tower-far-v1-q90.webp', w: 1536, h: 1024, face: { x: 768, y: 260, r: 110 } };
const HANDS = { sheet: '/art/scenes/liberation/tower-far/tower-hands-v1.png', w: 24, h: 76, cols: 3, anchor: [12, 62], len: 58 };
/** Everything worth fetching before the fight ends (main.js preloads it). */
export const LIBERATION_ART = [COURT.src, SUMMIT.src, SEAL.sheet, ASCEND.sheet, FLASH.sheet, MOTE.sheet];

/** The timeline, ms from the start. */
// closeEnd: the close view has gone dark; then the tower (towerLen, only when painted) and the title (titleLen).
export const CUT = { break: 2600, gone: 10600, mote: 11500, moteEnd: 15400, village: 16600, wave: 21600, waveEnd: 24600, awake: 25600, morning: 29600, close: 35000, closeEnd: 45000, towerLen: 9000, titleLen: 8000, fade: 1200 };
/** The white: out of the summit's white, through white from the summit to the village, a flash into the last view. */
const WHITE = [[0, 1], [1400, 0], [15600, 0], [CUT.village, 1], [17600, 0], [34400, 0], [CUT.close, 0.9], [35900, 0]];
/** The camera (floor units, its width; the height follows the screen), drifting from one rect to the next. */
const CAMS = {
  summit: [[0, { x: 8.5, y: 4.6, w: 26 }], [CUT.village, { x: 11.5, y: 7.2, w: 20 }]],
  village: [[CUT.village, { x: 2.5, y: 5.6, w: 31 }], [CUT.close, { x: 4, y: 6.8, w: 28 }]],
  close: [[CUT.close, { x: 4.1, y: 11.9, w: 10.6 }], [CUT.closeEnd, { x: 4.8, y: 11.6, w: 9.2 }]],
};
const LINES = [
  [600, 4200, '마지막 정각이 지나자 오르덴의 몸에 빛이 번졌다.'],
  [5000, 10800, '오르덴은 마지막 말을 남기고 작은 빛 조각이 되어 하늘로 흩어졌다.'],
  [12200, 15800, '남은 빛 한 조각이 F2 앞에 내려앉았다가 조용히 꺼졌다.'],
  [17400, 21300, '그 시각, 마을은 오르덴이 울린 마지막 종에 멈춰 있었다.'],
  [21900, 25300, '오르덴이 사라지자 F2에게서 금빛\u00a0물결이 퍼지며 머리 위의 명령이 깨졌다.'],
  [26000, 29300, '사람들이 하나둘 눈을 깜빡이며 깨어났다.'],
  [30400, 34200, '종은 다시 울리지 않는다.'],
  [36200, 42000, '오늘부터 모두가 자기 걸음으로 걷는다.', 'top'],
];
/** The tower's line, from the start of its shot. */
const TOWER_LINE = [2600, 7600, '멈춰 있던 탑의 시계가 다시 제 걸음으로 가기 시작했다.', 'top'];
/** Where everyone stands (floor units). `walk`: where a resident goes in the morning. */
const SUMMIT_AT = { orden: { x: 21.6, y: 13.6 }, f2: { x: 21.4, y: 17 } };
const F2_AT = { x: 12.6, y: 15.2 }, MORU_AT = { x: 6.6, y: 16.9 }, NASA_AT = { x: 10, y: 16 };
// Bolt has no walking clip, so he stands by Nasa from the start (2026-11-20, the user's word), frozen like everyone.
const BOLT_AT = { x: 11.2, y: 16.7 };
// Nothing of him is left on the summit (2026-11-20, the user's word: his staff goes with him in the light, so one lying
// there after reads wrong).
const RESIDENTS = [
  ['R1', 14.5, 10.2, 'south-east', 17.5, 12], ['R2', 18.6, 9.8, 'south-west', 15.6, 11.6], ['R5', 26, 10.4, 'south-west', 28.5, 9.4],
  ['R7', 30, 12.6, 'west', 27, 12], ['R3', 15.6, 13.4, 'east', 18.4, 12.2], ['R9', 17.8, 17.4, 'north-east', 19.4, 19.6],
  ['R11', 27, 17, 'north-west', 29.6, 19], ['R4', 22.4, 19.6, 'east', 25.4, 21.8], ['C2', 15.4, 20, 'south-east', 13.2, 18.4],
  ['R12', 29.6, 20.6, 'north-west', 31.5, 18.2], ['C3', 26, 14.6, 'south', 24, 12.4], ['R6', 20.2, 22.4, 'north-east', 22.6, 25],
].map(([id, x, y, dir, tx, ty]) => ({ id, x, y, dir, to: { x: tx, y: ty } }));
/** How the wave's ring grows from F2 (floor units a second, flattened like the floor) and how wide it ends. */
const WAVE_REACH = 26;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ramp = (t, from, to) => (to <= from ? (t >= from ? 1 : 0) : clamp((t - from) / (to - from)));
const smooth = k => k * k * (3 - 2 * k);
const along = (keys, t) => { for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * ramp(t, t0, t1); } return keys.at(-1)[1]; };
const camAt = (keys, t) => { const [[t0, a], [t1, b]] = keys, k = smooth(ramp(t, t0, t1)); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k }; };
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const dirOf = (dx, dy) => DIRS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const GOLD = ['#ffe9a8', '#ffd257', '#fff8ec'], FROZEN = '#5f7896';

let clipsLoaded = null;
/** The game's clip tables (sheet, frame size, frames, anchor, height, scale for every body and action). */
function loadClips() {
  clipsLoaded ??= Promise.all(CLIP_FILES.map(f => fetch(f).then(r => r.json()).catch(() => ({ clips: {} })))).then(all => Object.assign({}, ...all.map(j => j.clips || {})));
  return clipsLoaded;
}
/** Fetches the maps, the clip tables and the sheets the cutscene draws, so it can wait for them. */
export async function preloadLiberation() {
  const clips = await loadClips(), sheets = new Set(LIBERATION_ART);
  for (const name of usedClips()) if (clips[name]) sheets.add(clips[name].sheet);
  await Promise.all([...sheets].map(src => new Promise(done => { const img = new Image(); img.onload = img.onerror = done; img.src = src; })));
}
function usedClips() {
  const names = ['ordenx-idle/south', 'idle/north', 'idle/south-west', 'idle/south-east', 'idle/south', 'moru-idle/south-east', 'moru-idle/south', 'nasa-idle/south-west', 'nasa-idle/south-east', 'nasa-idle/south', 'bolt-idle/north-east', 'bolt-idle/south', 'bolt-greeting/north-east', 'bolt-greeting/south'];
  for (const r of RESIDENTS) for (const d of DIRS) names.push(`${r.id}-walk/${d}`, `${r.id}-idle/${d}`);
  return names;
}

/**
 * The song at time t (2026-11-20, the user's word: music, no sound effects): Orden's theme on the summit until he is
 * gone, then silence ('') a while, then the village's own song from a little into the village.
 */
export const liberationSong = t => (t < CUT.gone - 300 ? 'orden' : t < CUT.village + 1500 ? '' : 'town-v2');
/**
 * Plays the cutscene in `root` (an empty element over the game). `reduced`: no drift, fewer motes. `music(name)` is told
 * the song whenever it changes ('' for silence). Returns { done, skip }: `done` resolves after the fade out.
 */
export function playLiberationCutscene(root, { reduced = false, music = () => {} } = {}) {
  root.innerHTML = '<div class="cut-stage"><canvas></canvas></div><div class="cut-white"></div><p class="cut-line" aria-live="polite"></p><button type="button" class="cut-skip">건너뛰기</button>';
  root.hidden = false;
  const stage = root.querySelector('.cut-stage'), canvas = root.querySelector('canvas'), c = canvas.getContext('2d');
  const white = root.querySelector('.cut-white'), line = root.querySelector('.cut-line'), skipButton = root.querySelector('.cut-skip');
  const images = new Map(), image = src => { let img = images.get(src); if (!img) { img = new Image(); img.src = src; images.set(src, img); } return img; };
  let clips = {};
  loadClips().then(table => { clips = { ...table, seal: SEAL }; });
  const start = performance.now();
  // The tower shot is decided when the close view ends: in only if its painting has loaded.
  const towerImg = image(TOWER.src);
  let tower = null, endAt = CUT.closeEnd + CUT.towerLen + CUT.titleLen, frame = 0, finished, lineShown = -1, last = start, ordenPixels = null, song = null;
  const done = new Promise(resolve => { finished = resolve; });
  const motes = [], fired = new Set(), rand = seeded(7), scratch = document.createElement('canvas'), sc = scratch.getContext('2d', { willReadFrequently: true });
  const startle = new Map(RESIDENTS.map(r => [r.id, rand() * 900]));

  const once = (key, t, at, fn) => { if (t >= at && !fired.has(key)) { fired.add(key); fn(); } };
  function skip() { const t = performance.now() - start; if (t < endAt - CUT.fade) endAt = t + CUT.fade * 0.5; }
  const onKey = e => { if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); skip(); } };
  addEventListener('keydown', onKey, true);
  skipButton.addEventListener('click', skip);

  function tick(now) {
    const t = now - start, dt = Math.min(0.05, (now - last) / 1000); last = now;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    if (canvas.width !== sw || canvas.height !== sh) { canvas.width = sw; canvas.height = sh; }
    if (t >= CUT.closeEnd && tower === null) {
      tower = !!(towerImg.complete && towerImg.naturalWidth);
      if (!tower) endAt = Math.min(endAt, CUT.closeEnd + CUT.titleLen);
    }
    const towerTo = CUT.closeEnd + (tower ? CUT.towerLen : 0);
    const place = t < CUT.village ? 'summit' : t < CUT.close ? 'village' : t < CUT.closeEnd ? 'close' : t < towerTo ? 'tower' : 'title', map = place === 'summit' ? SUMMIT : COURT;
    if (liberationSong(t) !== song) { song = liberationSong(t); music(song); }
    const cam = CAMS[place] ? (reduced ? CAMS[place][0][1] : camAt(CAMS[place], t)) : CAMS.close[1][1], unit = sw / cam.w;
    const scr = at => [(at.x - cam.x) * unit, (at.y - cam.y) * unit];
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sw, sh); c.imageSmoothingEnabled = true;

    // The place: the map's own painting under the camera.
    const bg = image(map.src);
    const drawPlace = () => { if (bg.complete && bg.naturalWidth) c.drawImage(bg, cam.x * map.ppu, cam.y * map.ppu, cam.w * map.ppu, (sh / unit) * map.ppu, 0, 0, sw, sh); };
    const wave = smooth(ramp(t, CUT.wave, CUT.waveEnd)) * WAVE_REACH;
    if (place === 'village' && t < CUT.waveEnd) {
      // Frozen: the colour drained to a cold grey-blue; the wave's ring from F2 gives it back as it rolls out.
      drawPlace();
      c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.85)'; c.fillRect(0, 0, sw, sh);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#b4c4dc'; c.fillRect(0, 0, sw, sh); c.restore();
      if (wave > 0) {
        const [x, y] = scr(F2_AT);
        c.save(); c.beginPath(); c.ellipse(x, y, wave * unit, wave * unit * 0.62, 0, 0, Math.PI * 2); c.clip(); drawPlace(); c.restore();
        // Its front: a band of gold light.
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = unit * 0.9; c.strokeStyle = `rgba(255,214,120,${0.55 * (1 - wave / WAVE_REACH)})`; c.shadowColor = '#ffd257'; c.shadowBlur = unit;
        c.beginPath(); c.ellipse(x, y, wave * unit, wave * unit * 0.62, 0, 0, Math.PI * 2); c.stroke(); c.restore();
      }
    } else if (place === 'tower') drawTower(t - CUT.closeEnd);
    else if (place !== 'title') drawPlace();
    const reached = at => { const dx = at.x - F2_AT.x, dy = (at.y - F2_AT.y) / 0.62; return Math.hypot(dx, dy) < wave; };

    // The bodies, back to front.
    const bodies = [];
    if (place === 'summit') {
      // F2 stands still watching (one frame of the idle: its breathing bob read as fidgeting here, the user's word).
      bodies.push({ y: SUMMIT_AT.f2.y, draw: () => body('idle/north', 0, SUMMIT_AT.f2) });
      bodies.push({ y: SUMMIT_AT.orden.y - 0.01, draw: () => ascend(t) });
      bodies.push({ y: SUMMIT_AT.orden.y, draw: () => orden(t) });
      bodies.push({ y: 99, draw: () => lastMote(t) });
    } else if (place === 'village') {
      const awake = t >= CUT.awake, morning = t >= CUT.morning;
      for (const r of RESIDENTS) {
        const free = t >= CUT.waveEnd || reached(r), m = morning ? smooth(ramp(t, CUT.morning, CUT.close)) : 0;
        const at = { x: r.x + (r.to.x - r.x) * m, y: r.y + (r.to.y - r.y) * m }, dir = morning ? dirOf(r.to.x - r.x, r.to.y - r.y) : r.dir;
        // Frozen mid-step; awake, standing and looking round; in the morning walking off.
        const action = morning || !awake ? `${r.id}-walk/${dir}` : `${r.id}-idle/${dir}`, f = morning ? t / 100 : awake ? t / 250 : 2;
        bodies.push({ y: at.y, draw: () => { body(action, f, at, { frozen: !free, seal: !free }); if (awake && !morning) mark(at, `${r.id}-idle/${dir}`, t - CUT.awake - startle.get(r.id)); } });
        if (free) once(`free-${r.id}`, t, 0, () => burstAt(r, `${r.id}-walk/${r.dir}`));
      }
      for (const [who, at, dir] of [['moru', MORU_AT, 'south-east'], ['nasa', NASA_AT, 'south-east'], ['bolt', BOLT_AT, 'north-east']]) {
        const free = t >= CUT.waveEnd || reached(at), greet = who === 'bolt' && morning ? t - (CUT.morning + 1200) : -1;
        // In the morning Bolt waves at F2 now and then.
        const waving = greet > 0 && greet % 3200 < 1300, action = waving ? `${who}-greeting/${dir}` : `${who}-idle/${dir}`, f = waving ? (greet % 3200) / 100 : free ? t / 250 : 0;
        bodies.push({ y: at.y, draw: () => { body(action, f, at, { frozen: !free, seal: !free }); if (awake && !morning) mark(at, `${who}-idle/${dir}`, t - CUT.awake - ({ moru: 200, nasa: 450, bolt: 700 })[who]); } });
        if (free) once(`free-${who}`, t, 0, () => burstAt(at, `${who}-idle/${dir}`));
        if (greet > 0 && greet < 1800) bodies.push({ y: 99, draw: () => mark(at, 'bolt-idle/south', greet, '♪') });
      }
      const look = t < CUT.wave ? (Math.floor(t / 1200) % 2 ? 'idle/south-east' : 'idle/south-west') : morning && t > CUT.morning + 2600 ? 'idle/south-east' : 'idle/south-west';
      bodies.push({ y: F2_AT.y, draw: () => body(look, t / 200, F2_AT) });
    } else if (place === 'close') {
      const k = t - CUT.close;
      bodies.push({ y: 1, draw: () => body('moru-idle/south-east', t / 250, { x: 6.4, y: 16.4 }) });
      bodies.push({ y: 2, draw: () => body('idle/south', t / 200, { x: 8.4, y: 16.6 }) });
      bodies.push({ y: 3, draw: () => body('nasa-idle/south-west', t / 250, { x: 10.3, y: 16.3 }) });
      bodies.push({ y: 4, draw: () => body(k % 2600 < 1300 ? 'bolt-greeting/south' : 'bolt-idle/south', (k % 2600) / 100, { x: 12.1, y: 16 }) });
      if (k < 1800) bodies.push({ y: 5, draw: () => mark({ x: 10.3, y: 16.3 }, 'nasa-idle/south-west', k) });
    }
    for (const b of bodies.sort((a, b) => a.y - b.y)) b.draw();

    // Going dark: the close view at its end, the tower in and out, the title on black.
    const dark = place === 'close' ? smooth(ramp(t, CUT.closeEnd - 2200, CUT.closeEnd)) : place === 'tower' ? Math.max(1 - smooth(ramp(t, CUT.closeEnd, CUT.closeEnd + 1400)), smooth(ramp(t, towerTo - 1600, towerTo))) : place === 'title' ? 1 : 0;
    if (dark > 0) { c.fillStyle = `rgba(8,8,14,${dark})`; c.fillRect(0, 0, sw, sh); }

    // Light over it all.
    c.globalCompositeOperation = 'lighter';
    if (t >= CUT.morning && place !== 'tower' && (place !== 'title' || t < towerTo + 2500) && frame % (reduced ? 10 : 4) === 0) motes.push({ x: rand() * sw, y: -10, vx: 14 + rand() * 20, vy: 18 + rand() * 22, life: 6000, age: 0, size: unit * (0.1 + rand() * 0.08), colour: rand() < 0.5 ? '#ffc8d8' : '#fff0c0', drift: rand() * 6, soft: true });
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i]; m.age += dt * 1000;
      if (m.age > m.life) { motes.splice(i, 1); continue; }
      m.x += (m.vx + Math.sin(m.age / 300 + m.drift) * 8) * dt; m.y += m.vy * dt; if (!m.soft) m.vy *= 0.995;
      const k = m.age / m.life, a = m.soft ? Math.min(1, k * 6) * (1 - k) : 1 - k, s = Math.max(2, Math.round(m.size * (m.soft ? 1 : 1 - k * 0.5)));
      c.globalCompositeOperation = m.soft || m.own ? 'source-over' : 'lighter';
      c.globalAlpha = a * (m.soft ? 0.8 : 1); c.fillStyle = m.colour; c.fillRect(Math.round(m.x - s / 2), Math.round(m.y - s / 2), s, s);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (place === 'title') drawTitle(t - towerTo, t);

    white.style.opacity = along(WHITE, t);
    const lines = tower ? [...LINES, [CUT.closeEnd + TOWER_LINE[0], CUT.closeEnd + TOWER_LINE[1], TOWER_LINE[2], TOWER_LINE[3]]] : LINES;
    const shown = lines.findIndex(([from, to]) => t >= from && t < to);
    if (shown !== lineShown) { lineShown = shown; line.classList.toggle('on', shown >= 0); if (shown >= 0) { line.textContent = lines[shown][2]; line.classList.toggle('top', lines[shown][3] === 'top'); } }
    root.style.opacity = 1 - ramp(t, endAt - CUT.fade, endAt);
    frame++;
    if (t < endAt) requestAnimationFrame(tick);
    else { removeEventListener('keydown', onKey, true); root.hidden = true; root.replaceChildren(); root.style.opacity = ''; finished(); }

    // ---- the helpers this frame uses (they read cam, unit and t from here)
    /**
     * One body: `name` its clip ('moru-idle/south-east'), `f` its frame (looping), its feet at floor point `at`.
     * `frozen`: washed grey-blue; `seal`: Orden's seal over its head; `hop`: lifted this many game pixels; `cut`: only
     * the top share of it drawn; `lift`: raised; `tint`/`tintAlpha`: a wash of another colour.
     */
    function body(name, f, at, { frozen = false, seal = false, hop = 0, cut = 1, lift = 0, tint = null, tintAlpha = 0, alpha = 1 } = {}) {
      const clip = clips[name], img = clip && image(clip.sheet);
      if (!img?.complete || !img.naturalWidth) return null;
      // As the game draws them (canvas.js drawSprite): a sheet pixel is half a floor pixel times the clip's scale, F2 at
      // 0.9 (PLAYER_SCALE); a firm contact shadow under every body.
      const fw = clip.frameWidth, fh = clip.frameHeight, n = clip.frameCount || 1, i = Math.floor(f) % n, cols = clip.columns || n, resize = name.startsWith('idle/') ? 0.9 : 1;
      const k = (clip.scale || 1) * resize * unit / 40, [x, y] = scr(at), top = y - clip.anchor[1] * k - (hop + lift) * unit / 40, left = x - clip.anchor[0] * k;
      if (alpha > 0.5) { c.fillStyle = `rgba(24, 20, 36, ${0.34 * Math.min(1, cut * 1.4)})`; c.beginPath(); c.ellipse(x, y, 13 * unit / 20, 4.5 * unit / 20, 0, 0, Math.PI * 2); c.fill(); }
      if (scratch.width !== fw || scratch.height !== fh) { scratch.width = fw; scratch.height = fh; } else sc.clearRect(0, 0, fw, fh);
      sc.globalCompositeOperation = 'source-over'; sc.drawImage(img, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, 0, 0, fw, fh);
      const wash = frozen ? FROZEN : tint, washAlpha = frozen ? 0.62 : tintAlpha;
      if (wash && washAlpha > 0) { sc.globalCompositeOperation = 'source-atop'; sc.globalAlpha = washAlpha; sc.fillStyle = wash; sc.fillRect(0, 0, fw, fh); sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over'; }
      const keep = cut >= 1 ? fh : Math.max(0, Math.round(clip.anchor[1] * cut));
      c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = alpha;
      if (keep > 0) c.drawImage(scratch, 0, 0, fw, keep, Math.round(left), Math.round(top), Math.round(fw * k), Math.round(keep * k));
      c.restore();
      if (seal) sealOver(at, clip, k);
      return { left, top, k, fw, fh, keep };
    }
    /** Orden's command seal (the game's own sigil) over a body's head. */
    function sealOver(at, clip, bodyK) {
      const img = image(SEAL.sheet);
      if (!img.complete || !img.naturalWidth) return;
      const k = unit / 20, [x, y] = scr(at), f = Math.floor(t / 1000 * SEAL.fps) % SEAL.frameCount, head = y - (clip.bodyHeight || 70) * bodyK - 14 * k;
      c.save(); c.imageSmoothingEnabled = false;
      c.drawImage(img, (f % SEAL.columns) * SEAL.frameWidth, Math.floor(f / SEAL.columns) * SEAL.frameHeight, SEAL.frameWidth, SEAL.frameHeight, Math.round(x - SEAL.anchor[0] * k), Math.round(head - SEAL.anchor[1] * k), Math.round(SEAL.frameWidth * k), Math.round(SEAL.frameHeight * k));
      c.restore();
    }
    /** Gold shards where a seal breaks. */
    function burstAt(at, name) {
      const clip = clips[name], k = unit / 40, [x, y] = scr(at), head = y - ((clip?.bodyHeight || 70) * (clip?.scale || 1) + 28) * k;
      for (let i = 0; i < (reduced ? 5 : 14); i++) { const a = rand() * Math.PI * 2, s = rand() * 9 * unit; motes.push({ x, y: head, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 6 * unit * (1 + rand()), life: 600 + rand() * 600, age: 0, size: unit * (0.15 + rand() * 0.2), colour: GOLD[i % 3], drift: rand() * 6 }); }
    }
    /** A startled '!' (or another mark) over a head, popping up and fading; nothing before `age` 0. */
    function mark(at, name, age, text = '!') {
      if (age < 0 || age > 1600) return;
      const clip = clips[name], k = unit / 40, [x, y] = scr(at), up = ((clip?.bodyHeight || 70) * (clip?.scale || 1) + 16) * k, pop = Math.min(1, age / 150);
      c.save(); c.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1200) / 400);
      c.font = `700 ${Math.round(unit * 0.4 * (0.7 + 0.3 * pop))}px Galmuri11, "Galmuri11 Rest", sans-serif`; c.textAlign = 'center';
      c.lineWidth = unit * 0.1; c.strokeStyle = '#2b3345'; c.fillStyle = '#ffd257';
      c.strokeText(text, x, y - up - unit * 0.2 * pop); c.fillText(text, x, y - up - unit * 0.2 * pop);
      c.restore();
    }
    /** Orden breaking up: the light runs over him, then the rows under a rising line are gone, squares of his colours lifting off it. */
    function orden(t) {
      const k = smooth(ramp(t, CUT.break, CUT.gone)), glowK = 0.16 + 0.12 * Math.sin(t / 140);
      if (k >= 1) return;
      const drawn = body('ordenx-idle/south', 0, SUMMIT_AT.orden, { tint: '#7fe8ff', tintAlpha: t < CUT.break ? glowK * ramp(t, 800, CUT.break) : glowK + 0.2 * k, cut: 1 - k, lift: k * 20, alpha: 1 - Math.max(0, k - 0.85) / 0.15 });
      if (!drawn || k <= 0) return;
      ordenPixels ??= sc.getImageData(0, 0, drawn.fw, drawn.fh).data;
      for (let n = 0; n < (reduced ? 3 : 8); n++) {
        const sx = Math.floor(rand() * drawn.fw), sy = Math.min(drawn.fh - 1, drawn.keep + Math.floor(rand() * 5)), o = (sy * drawn.fw + sx) * 4;
        if (ordenPixels[o + 3] < 80) continue;
        const own = `rgb(${ordenPixels[o]},${ordenPixels[o + 1]},${ordenPixels[o + 2]})`;
        motes.push({ x: drawn.left + sx * drawn.k, y: drawn.top + sy * drawn.k, vx: (rand() - 0.5) * 20, vy: -(40 + rand() * 60), life: 1800 + rand() * 1400, age: 0, size: drawn.k * (2 + rand() * 2), colour: rand() < 0.55 ? own : rand() < 0.6 ? '#7fe8ff' : '#ffd88a', drift: rand() * 6, own: true });
      }
    }
    /** A frame of a pixelfx sheet, its anchor at screen point (x, y), scaled; `add` draws it as light added over what is under it. */
    function fxFrame(fx, f, x, y, kx, ky, alpha, add = false) {
      const img = image(fx.sheet);
      if (!img.complete || !img.naturalWidth || alpha <= 0) return;
      const i = Math.floor(f) % fx.frames;
      c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = Math.min(1, alpha); c.globalCompositeOperation = add ? 'lighter' : 'source-over';
      c.drawImage(img, (i % fx.cols) * fx.w, Math.floor(i / fx.cols) * fx.h, fx.w, fx.h, Math.round(x - fx.anchor[0] * kx), Math.round(y - fx.anchor[1] * ky), Math.round(fx.w * kx), Math.round(fx.h * ky));
      c.restore();
    }
    /**
     * The last mote of his light (pixelfx od-mote): from high over where he stood it drifts down, swaying, to just in
     * front of F2's chest, hangs there a breath, swells a little and goes out.
     */
    function lastMote(t) {
      const k = ramp(t, CUT.mote, CUT.moteEnd - 1000), out = ramp(t, CUT.moteEnd - 1000, CUT.moteEnd);
      if (t < CUT.mote || out >= 1) return;
      const from = { x: SUMMIT_AT.orden.x, y: SUMMIT_AT.orden.y - 4.6 }, to = { x: SUMMIT_AT.f2.x + 0.05, y: SUMMIT_AT.f2.y - 1.15 }, e = smooth(k);
      const at = { x: from.x + (to.x - from.x) * e + Math.sin(k * Math.PI * 3) * 0.7 * (1 - k), y: from.y + (to.y - from.y) * e };
      const [x, y] = scr(at), size = unit / 40 * 1.8 * (1 + out * 0.6);
      fxFrame(MOTE, t / 1000 * MOTE.fps, x, y, size, size, Math.min(1, ramp(t, CUT.mote, CUT.mote + 600)) * (1 - out));
    }
    /**
     * The tower far off, `k` ms into its shot: the painting filling the screen's width, the camera rising from the
     * rooftops to the clock; the hands stand at ten to twelve, then tick: the minute hand steps on, settling with a
     * little shake, and keeps stepping each second after.
     */
    function drawTower(k) {
      if (!towerImg.complete || !towerImg.naturalWidth) return;
      const scale = sw / TOWER.w, viewH = sh / scale, rise = smooth(ramp(k, 0, CUT.towerLen - 1800));
      const top = (TOWER.h - viewH) * (1 - rise) + Math.max(0, Math.min(TOWER.h - viewH, TOWER.face.y - viewH * 0.42)) * rise;
      c.drawImage(towerImg, 0, top, TOWER.w, viewH, 0, 0, sw, sh);
      const img = image(HANDS.sheet);
      if (!img.complete || !img.naturalWidth) return;
      const fx = TOWER.face.x * scale, fy = (TOWER.face.y - top) * scale, hk = TOWER.face.r * 0.82 / HANDS.len * scale;
      const tick = Math.max(0, Math.floor((k - 3800) / 1000) + 1), since = k - 3800 - (tick - 1) * 1000;
      const shake = tick > 0 && since < 300 ? Math.sin(since / 300 * Math.PI * 3) * (1 - since / 300) * 0.06 : 0;
      const minute = (50 + tick) / 60 * Math.PI * 2 + shake, hour = (11 + (50 + tick) / 60) / 12 * Math.PI * 2;
      for (const [frameIndex, angle] of [[1, hour], [0, minute]]) {
        c.save(); c.translate(fx, fy); c.rotate(angle); c.imageSmoothingEnabled = false;
        c.drawImage(img, frameIndex * HANDS.w, 0, HANDS.w, HANDS.h, -HANDS.anchor[0] * hk, -HANDS.anchor[1] * hk, HANDS.w * hk, HANDS.h * hk);
        c.restore();
      }
    }
    /**
     * The title on black, `k` ms into it (`t` from the start): the game's name rising in, held, then gone into the black
     * before the black itself fades (2026-11-22, the chapter 3 review: it faded with the screen, so for its last second the
     * name hung half-seen over the village showing through).
     */
    function drawTitle(k, t) {
      const a = smooth(ramp(k, 1200, 2600)) * (1 - smooth(ramp(t, endAt - CUT.fade - 900, endAt - CUT.fade))), lift = (1 - smooth(ramp(k, 1200, 2600))) * sh * 0.02, size = Math.round(Math.min(sw * 0.07, sh * 0.11));
      if (a <= 0) return;
      c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff4d6';
      c.font = `700 ${size}px Galmuri11, "Galmuri11 Rest", sans-serif`; c.fillText('태엽 밖으로', sw / 2, sh * 0.46 + lift);
      c.font = `400 ${Math.round(size * 0.32)}px Galmuri11, "Galmuri11 Rest", sans-serif`; c.fillStyle = '#ffd257'; c.fillText('BEYOND  THE  CLOCKWORK', sw / 2, sh * 0.46 + size * 0.85 + lift);
      c.restore();
    }
    /**
     * The column of light he passes up into (pixelfx od-ascend), behind him: rising out of the floor as the light runs
     * over him, full while he breaks up, thinning away after; then one flash where he stood (od-burst) as the last of him goes.
     */
    function ascend(t) {
      const [x, y] = scr(SUMMIT_AT.orden), k = unit / 40, grow = smooth(ramp(t, CUT.break - 900, CUT.break + 1200)), out = ramp(t, CUT.gone, CUT.gone + 2200);
      if (grow * (1 - out) > 0) fxFrame(ASCEND, t / 1000 * ASCEND.fps, x, y, k * 1.3 * (0.55 + 0.45 * grow) * (1 - 0.5 * out), k * 1.15 * grow, 0.85 * grow * (1 - out));
      const flash = t - (CUT.gone - 300);
      if (flash >= 0 && flash < 1000 / FLASH.fps * FLASH.frames) fxFrame(FLASH, flash / 1000 * FLASH.fps, x, y, k * 2.2, k * 2.2, 1);
    }
  }
  requestAnimationFrame(tick);
  return { done, skip };
}

/** The same motes every time it plays. */
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
