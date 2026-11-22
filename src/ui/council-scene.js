// The hidden ending (2026-11-22, the user's word), once per save after chapter 3's first clear on hard: a black screen,
// two silhouettes and four lines. Somebody above Orden hears that his tuning signal has gone silent; the cause is not
// known yet (the user's word). No music (the user's pick: the stillness over a new song): only a clock ticking once a
// second, which stops on the chief's last line as his one red eye lights.
//  inspector  left, facing right: stooped, a headset, a clipboard, one cyan lens (pixelfx btc/council-inspector).
//  chief      right, mirrored to face left: a long coat, a turning cog behind his head, a wind-up key taller than he
//             is (pixelfx btc/council-chief; chief-eye the same sheet with his eye lit).
// Names are '???' for both. The speaker is lit and the listener dimmed. A click, Enter, Space or the pad's A moves on;
// Escape, the skip button or the pad's Start ends it. Resolves once it has gone dark.

const DIR = '/art/chapters/3-clock-tower/council/';
/** The sheets (12 fps loops); `at` is the feet's distance from the screen's middle in 1120 x 640 screen units. */
const SPR = {
  inspector: { src: DIR + 'inspector-v1.png', w: 56, h: 95, cols: 8, frames: 29, pivot: [22, 90], at: -200, flip: false },
  chief: { src: DIR + 'chief-v1.png', lit: DIR + 'chief-eye-v1.png', w: 66, h: 118, cols: 9, frames: 36, pivot: [26, 112], at: 230, flip: true },
};
/** His eye in the sheet's own units, from his feet (pixelfx council-chief: px(5.5, -83)). */
const EYE = { x: 5.5, y: -83 };
const SCALE = 3, FEET = 440, FPS = 12;
export const COUNCIL_LINES = [
  { who: 'inspector', text: '태엽섬, 오르덴의 조율 신호가 끊겼습니다.' },
  { who: 'chief', text: '…끊겼다고? 원인은.' },
  { who: 'inspector', text: '아직 파악되지 않았습니다. 탑의 신호선도 모두 잠잠합니다.' },
  { who: 'chief', text: '계획에 차질이 생겼군. 모두 불러 모아라.', eye: true },
];
/** The timeline (ms): black, the two rise, letters a second; at the end the inspector, then the chief, then the eye go. */
export const COUNCIL = { dark: 1200, rise: 1800, perChar: 1000 / 26, eye: 600, out: 1200, chiefFrom: 600, chiefOut: 1400, eyeHold: 2200, eyeOut: 500, end: 3400, skip: 500 };
export const COUNCIL_ART = [SPR.inspector.src, SPR.chief.src, SPR.chief.lit];

const clamp01 = v => Math.max(0, Math.min(1, v));

export function playCouncilScene(root, { reduced = false, sound = () => {}, music = () => {} } = {}) {
  root.innerHTML = '<div class="council"><canvas></canvas><div class="council-box off"><div class="council-inner"><span class="council-name">???</span><p class="council-text" aria-live="polite"></p><span class="council-next" hidden>▼</span></div></div></div><button type="button" class="cut-skip">건너뛰기</button>';
  root.hidden = false;
  const stage = root.querySelector('.council'), canvas = stage.querySelector('canvas'), c = canvas.getContext('2d');
  const box = stage.querySelector('.council-box'), text = stage.querySelector('.council-text'), next = stage.querySelector('.council-next');
  const image = src => { const img = new Image(); img.src = src; return img; };
  const IMG = { inspector: image(SPR.inspector.src), chief: image(SPR.chief.src), chiefLit: image(SPR.chief.lit) };
  const start = performance.now(), dim = { inspector: 1, chief: 1 };
  let line = -1, lineAt = 0, shown = 0, eyeAt = 0, endAt = 0, skipped = false, nextTick = 0, tock = false, last = start, finished;
  const done = new Promise(resolve => { finished = resolve; });
  music('');

  function show(i) {
    line = i; lineAt = performance.now(); shown = reduced ? COUNCIL_LINES[i].text.length : 0;
    box.classList.toggle('right', COUNCIL_LINES[i].who === 'chief');
    if (COUNCIL_LINES[i].eye) eyeAt = lineAt;
  }
  function advance() {
    if (endAt || line < 0) return;
    const L = COUNCIL_LINES[line];
    if (shown < L.text.length) { shown = L.text.length; return; }
    if (line < COUNCIL_LINES.length - 1) show(line + 1);
    else { endAt = performance.now(); box.classList.add('off'); }
  }
  function skip() { if (skipped) return; skipped = true; endAt = performance.now(); box.classList.add('off'); }
  const onKey = e => {
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); }
  };
  addEventListener('keydown', onKey, true);
  stage.addEventListener('pointerdown', e => { e.preventDefault(); advance(); });
  root.querySelector('.cut-skip').addEventListener('click', skip);

  function draw(img, sp, frame, alpha, k, cx, feet) {
    if (alpha <= 0.01 || !img.complete || !img.naturalWidth) return;
    const px = Math.max(1, Math.round(SCALE * k)), sx = (frame % sp.cols) * sp.w, sy = Math.floor(frame / sp.cols) * sp.h;
    c.save(); c.globalAlpha = Math.min(1, alpha); c.translate(Math.round(cx + sp.at * k), 0);
    if (sp.flip) c.scale(-1, 1);
    c.drawImage(img, sx, sy, sp.w, sp.h, -sp.pivot[0] * px, Math.round(feet - sp.pivot[1] * px), sp.w * px, sp.h * px);
    c.restore();
  }

  function tick(now) {
    const t = now - start, dt = Math.min(0.1, (now - last) / 1000); last = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1), sw = Math.round(stage.clientWidth * dpr), sh = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== sw || canvas.height !== sh) { canvas.width = sw; canvas.height = sh; }
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.fillStyle = '#000'; c.fillRect(0, 0, sw, sh);
    const k = sh / 640, cx = sw / 2, feet = FEET * k;

    // The clock: a tick, then a tock, a second apart, until his last line.
    if (!eyeAt && !endAt && t >= nextTick) { sound(tock ? 'boss-ttBeatTock' : 'boss-ttBeatTick'); tock = !tock; nextTick += 1000; }
    // Out of the black, then the first line.
    const rise = reduced ? (t >= COUNCIL.dark ? 1 : 0) : clamp01((t - COUNCIL.dark) / COUNCIL.rise);
    if (line < 0 && !endAt && t >= COUNCIL.dark + COUNCIL.rise + 300) { box.classList.remove('off'); show(0); }
    if (line >= 0 && !endAt) {
      const L = COUNCIL_LINES[line];
      shown = Math.max(shown, Math.min(L.text.length, Math.floor((now - lineAt) / COUNCIL.perChar)));
      if (text.textContent.length !== shown || !text.textContent.startsWith(L.text.slice(0, shown))) text.textContent = L.text.slice(0, shown);
      next.hidden = shown < L.text.length;
    }
    const speaker = line >= 0 && !endAt ? COUNCIL_LINES[line].who : null;
    for (const who of ['inspector', 'chief']) { const goal = speaker && speaker !== who ? 0.5 : 1; dim[who] += (goal - dim[who]) * Math.min(1, dt * 8); }

    const out = endAt ? now - endAt : 0, fast = skipped ? COUNCIL.skip : 0;
    const gone = skipped ? clamp01(1 - out / fast) : 1;
    const aI = rise * dim.inspector * (endAt ? (skipped ? gone : clamp01(1 - out / COUNCIL.out)) : 1);
    const aC = rise * dim.chief * (endAt ? (skipped ? gone : clamp01(1 - (out - COUNCIL.chiefFrom) / COUNCIL.chiefOut)) : 1);
    const f = Math.floor((t / 1000) * FPS);
    draw(IMG.inspector, SPR.inspector, f % SPR.inspector.frames, aI, k, cx, feet);
    const fc = f % SPR.chief.frames;
    draw(IMG.chief, SPR.chief, fc, aC, k, cx, feet);
    if (eyeAt) {
      draw(IMG.chiefLit, SPR.chief, fc, aC * (reduced ? 1 : clamp01((now - eyeAt) / COUNCIL.eye)), k, cx, feet);
      // At the end his eye stays a beat alone in the dark, then goes out.
      if (endAt && !skipped) {
        const hold = out < COUNCIL.eyeHold ? clamp01((out - COUNCIL.chiefFrom) / COUNCIL.chiefOut) : clamp01(1 - (out - COUNCIL.eyeHold) / COUNCIL.eyeOut);
        const px = Math.max(1, Math.round(SCALE * k)), ex = Math.round(cx + SPR.chief.at * k) - EYE.x * px, ey = Math.round(feet + EYE.y * px) + px / 2, r = 6 * px;
        const g = c.createRadialGradient(ex, ey, 0, ex, ey, r);
        g.addColorStop(0, `rgba(255,176,160,${hold})`); g.addColorStop(0.2, `rgba(224,48,60,${0.85 * hold})`); g.addColorStop(1, 'rgba(90,15,20,0)');
        c.fillStyle = g; c.fillRect(ex - r, ey - r, r * 2, r * 2);
      }
    }
    if (!endAt || out < (skipped ? COUNCIL.skip : COUNCIL.end)) requestAnimationFrame(tick);
    else { removeEventListener('keydown', onKey, true); root.hidden = true; root.replaceChildren(); finished(); }
  }
  requestAnimationFrame(tick);
  return { done, skip, advance };
}
