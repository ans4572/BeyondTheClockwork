// The title's own F2: the idle pose redrawn cleaner and larger (PixelLab, 192 px), shown at 2x on the form.
const F2_TITLE = 'art/ui/title/f2-title-v3.png';
const INK = '#2b3345', LABEL = '#6d7486', RED = '#c43c36', PAPER = '#f6ecd2';
const STAGE = [1120, 640], LINE_MS = 1800, LAST_LINE_MS = 3000, LINE_READ_MS = 700, OPENING_SCALE = 3, OPENING_WIDTH = 0.92, OPENING_SIZE = 15;
// A choice waiting on loading says so after this long; a quick one shows nothing.
const BUSY_AFTER_MS = 120;
const STAMP_DROP_MS = 150, STAMP_PRESS_MS = 200, STAMP_LIFT_MS = 300, STAMP_HOLD_MS = 500, SHAKE_MS = 240, BURST_MS = 130, MARK_CENTER = [374, 306], MARK_SIZE = 30, MARK_ZOOM = 2, TOOL_RISE = 780;
const load = src => new Promise((ok, no) => { const image = new Image(); image.onload = () => ok(image); image.onerror = no; image.src = src; });

// NeoDunggeunmo Pro (OFL 1.1) is drawn on a 16px grid, so it is always rendered at 16px and enlarged by a whole number.
export const PIXEL_FONT = '"NeoDunggeunmo Pro"', PIXEL_EM = 16;
/** Pixel lettering: the bitmap font at its own size, kept to hard pixels, enlarged to roughly size × scale. */
export function pixelText(text, size, fill, scale = 2) {
  const zoom = Math.max(1, Math.round(size * scale / PIXEL_EM));
  size = PIXEL_EM; scale = zoom;
  const probe = document.createElement('canvas').getContext('2d'), font = `${PIXEL_EM}px ${PIXEL_FONT}, "Galmuri11", "Galmuri11 Rest", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  probe.font = font;
  const pad = 3, w = Math.ceil(probe.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.3) + pad * 2, raw = document.createElement('canvas');
  raw.width = w; raw.height = h;
  const x = raw.getContext('2d', { willReadFrequently: true }); x.font = font; x.textBaseline = 'top'; x.fillText(text, pad, pad);
  const pixels = x.getImageData(0, 0, w, h).data, out = document.createElement('canvas');
  out.width = w * scale; out.height = h * scale;
  const o = out.getContext('2d'); o.fillStyle = fill;
  for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) if (pixels[(b * w + a) * 4 + 3] > 105) o.fillRect(a * scale, b * scale, scale, scale);
  return out;
}

/** The red disposal stamp as hard pixels, turned before it is enlarged. */
function stampImage(size) {
  const word = pixelText('폐기', size, RED, 1), small = document.createElement('canvas');
  small.width = Math.ceil(word.width * 1.35); small.height = Math.ceil(word.height * 1.75);
  const s = small.getContext('2d', { willReadFrequently: true }); s.imageSmoothingEnabled = false;
  s.translate(small.width / 2, small.height / 2); s.rotate(-0.2); s.strokeStyle = RED; s.lineWidth = 4;
  s.strokeRect(-word.width / 2 - 8, -word.height / 2 - 6, word.width + 16, word.height + 12); s.drawImage(word, -word.width / 2, -word.height / 2);
  const image = s.getImageData(0, 0, small.width, small.height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] > 127 ? 255 : 0;
  s.putImageData(image, 0, 0);
  return small;
}

/** The stamp itself, front on: rubber foot, wooden block, neck and round grip. */
function toolImage() {
  const tool = document.createElement('canvas'), c = tool.getContext('2d'), box = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  tool.width = 140; tool.height = 150;
  box(4, 118, 132, 32, '#3a241c'); box(8, 122, 124, 20, '#c43c36'); box(8, 142, 124, 4, '#8f2a27');
  box(14, 78, 112, 42, '#3a241c'); box(18, 82, 104, 36, '#a36f3d'); box(18, 82, 104, 7, '#c79a5e'); box(106, 89, 16, 29, '#7d5230');
  box(56, 46, 28, 34, '#3a241c'); box(60, 46, 20, 32, '#8a5a34'); box(60, 46, 6, 32, '#a9784a');
  box(40, 8, 60, 42, '#3a241c'); box(32, 16, 76, 26, '#3a241c'); box(44, 12, 52, 34, '#c43c36'); box(36, 20, 68, 18, '#c43c36'); box(46, 14, 26, 8, '#e0706a');
  return tool;
}

/** Short pixel rays around the point of impact. */
function burstImage() {
  const burst = document.createElement('canvas'), c = burst.getContext('2d');
  burst.width = 200; burst.height = 170; c.fillStyle = INK;
  for (const [x, y, w, h] of [[4, 40, 18, 5], [0, 84, 22, 5], [4, 128, 18, 5], [178, 40, 18, 5], [178, 84, 22, 5], [178, 128, 18, 5], [38, 2, 5, 16], [100, 0, 5, 18], [160, 2, 5, 16], [38, 152, 5, 16], [100, 150, 5, 20], [160, 152, 5, 16]]) c.fillRect(x, y, w, h);
  return burst;
}

function drawForm(c, f2) {
  const rule = (x, y, w) => { c.fillStyle = INK; c.fillRect(x, y, w, 3); };
  c.fillStyle = '#1f3a3680'; c.fillRect(66, 28, 1000, 600);
  c.fillStyle = PAPER; c.fillRect(56, 16, 1000, 600);
  c.drawImage(pixelText('태엽 밖으로', 28, INK, 4), 84, 36);
  c.drawImage(pixelText('웃음거리 품질관리국 · 불량 판정서', 12, INK), 88, 176);
  rule(88, 216, 936);
  c.fillStyle = '#d7e4d6'; c.fillRect(100, 238, 320, 350);
  // Centred on the photo (x 260), feet on its bottom (y 580): the figure spans x 35-142, y 29-161 of the 192 px picture.
  c.drawImage(f2, 0, 0, 192, 192, 260 - 88 * 2, 580 - 161 * 2, 384, 384);
  c.fillStyle = INK; for (const [x, y, w, h] of [[100, 238, 320, 4], [100, 584, 320, 4], [100, 238, 4, 350], [416, 238, 4, 350]]) c.fillRect(x, y, w, h);
  c.fillStyle = '#c79a3e'; c.fillRect(240, 222, 44, 40); c.fillStyle = PAPER; c.fillRect(250, 232, 24, 20);
  // The value starts after its label, however wide the lettering runs.
  const field = (label, value, y) => { const name = pixelText(label, 12, LABEL); c.drawImage(name, 472, y); c.drawImage(pixelText(value, 13, INK), Math.max(610, 472 + name.width + 18), y - 2); rule(476, y + 44, 548); };
  field('제품 번호', 'F2', 236); field('판정 사유', '스스로 생각함', 292);
  c.drawImage(pixelText('처리 방법', 12, LABEL), 472, 356);
}

/** The disposal form the game opens on, and the short scene that follows it. Holds no game state. */
export class TitleScreen {
  constructor(root, { onNew, onLoad, onSettings, onThud, reducedMotion }) {
    this.root = root; this.onThud = onThud; this.reducedMotion = reducedMotion; this.timers = [];
    root.innerHTML = `<div class="title-stage"><canvas class="title-form" width="${STAGE[0]}" height="${STAGE[1]}" role="img" aria-label="태엽 밖으로. 웃음거리 품질관리국 불량 판정서. 제품 번호 F2, 판정 사유 스스로 생각함."></canvas><canvas class="title-mark" hidden></canvas><nav aria-label="타이틀 메뉴"><button data-do="new">새로 시작하기</button><button data-do="load">이어하기<small class="save-note"></small></button><button data-do="settings">환경설정</button></nav><div class="title-press"></div></div><div class="title-dark" hidden></div>`;
    this.stage = root.querySelector('.title-stage'); this.dark = root.querySelector('.title-dark'); this.mark = root.querySelector('.title-mark');
    this.buttons = [...root.querySelectorAll('button')];
    this.tool = toolImage(); this.burst = burstImage(); this.tool.hidden = this.burst.hidden = true;
    this.tool.className = 'title-tool'; this.burst.className = 'title-burst';
    root.querySelector('.title-press').append(this.burst, this.tool);
    Object.assign(this.tool.style, { left: `${MARK_CENTER[0] - 140}px`, top: `${MARK_CENTER[1] + 70 - 300}px` });
    Object.assign(this.burst.style, { left: `${MARK_CENTER[0] - 200}px`, top: `${MARK_CENTER[1] - 170}px` });
    const actions = { new: onNew, load: onLoad, settings: onSettings };
    // A phone answers the lifted finger itself (2026-11-10): an iPhone took the first tap on a menu line as a hover (the
    // line focused and turned red) and sent no click, so a choice needed two taps. The pointer that hovers still moves
    // the focus as it passes over a line.
    const hovers = matchMedia('(hover: hover)').matches;
    this.buttons.forEach(button => {
      button.addEventListener('click', () => actions[button.dataset.do]());
      if (hovers) button.addEventListener('mouseenter', () => { if (!button.disabled) button.focus(); });
      button.addEventListener('touchend', e => {
        if (button.disabled || e.touches.length) return;
        const touch = e.changedTouches[0], at = touch && document.elementFromPoint(touch.clientX, touch.clientY);
        if (at !== button && !button.contains(at)) return;
        e.preventDefault(); actions[button.dataset.do]();
      }, { passive: false });
    });
    document.addEventListener('keydown', e => {
      if (this.root.hidden || this.root.inert || this.stage.inert || !this.dark.hidden) return;
      const delta = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (delta) { e.preventDefault(); this.move(delta); }
    });
    addEventListener('resize', () => this.fit());
    this.ready = load(F2_TITLE).then(f2 => {
      const c = root.querySelector('.title-form').getContext('2d'); c.imageSmoothingEnabled = false; drawForm(c, f2);
      const stamp = stampImage(MARK_SIZE), mark = this.mark.getContext('2d');
      this.mark.width = stamp.width; this.mark.height = stamp.height; mark.drawImage(stamp, 0, 0);
      this.mark.style.width = `${stamp.width * MARK_ZOOM}px`; this.mark.style.left = `${MARK_CENTER[0] - stamp.width * MARK_ZOOM / 2}px`; this.mark.style.top = `${MARK_CENTER[1] - stamp.height * MARK_ZOOM / 2}px`;
    });
  }
  fit() { const k = Math.min(innerWidth / STAGE[0], innerHeight / STAGE[1]); this.stage.style.transform = `translate(-50%, -50%) scale(${k})`; this.stage.style.setProperty('--k', k); }
  move(delta) {
    const open = this.buttons.filter(button => !button.disabled), at = open.indexOf(document.activeElement);
    open[(at + delta + open.length) % open.length]?.focus();
  }
  activate() { if (this.buttons.includes(document.activeElement)) document.activeElement.click(); }
  /**
   * Runs a choice once `ready` settles: resolves true for the first tap, false for any tap while one is waiting. Until
   * then the line reads 불러오는 중… (2026-11-12: a tap before F2's sheets were in showed nothing, so it felt ignored).
   */
  busyUntil(name, ready) {
    if (this.waiting) return Promise.resolve(false);
    const button = this.buttons.find(b => b.dataset.do === name), note = Object.assign(document.createElement('small'), { className: 'busy-note', textContent: '(불러오는 중…)' });
    this.waiting = true;
    const slow = setTimeout(() => { button?.classList.add('busy'); button?.append(note); }, BUSY_AFTER_MS);
    return Promise.resolve(ready).catch(() => {}).then(() => { clearTimeout(slow); this.waiting = false; button?.classList.remove('busy'); note.remove(); return true; });
  }
  focus() { const [fresh, resume] = this.buttons; (resume.disabled ? fresh : resume).focus({ preventScroll: true }); }
  show({ canLoad, detail = '' }) {
    this.root.hidden = false; this.dark.hidden = true; this.stage.inert = false; this.fit();
    this.buttons[1].disabled = !canLoad;
    this.root.querySelector('.save-note').textContent = canLoad && detail ? `(${detail})` : '(저장 없음)';
    this.focus();
    // Blank until the player's own click brings the stamp down; a body already at work has been judged.
    this.mark.hidden = !canLoad;
  }
  hide() { this.root.hidden = true; this.tool.hidden = this.burst.hidden = true; this.root.classList.remove('title-shake'); this.timers.forEach(clearTimeout); this.timers = []; }
  later(ms, run) { this.timers.push(setTimeout(run, ms)); }
  /** Resolves after `ms`, or at once when the player skips. */
  wait(ms) { return new Promise(done => { if (this.skipped) done(); else { this.resume = done; this.timers.push(setTimeout(done, ms)); } }); }
  /** The stamp drops, bites the paper and lifts away, leaving the mark long enough to read. */
  async stamp() {
    const { tool, burst } = this, moving = !this.reducedMotion();
    this.mark.hidden = true;
    if (moving) {
      tool.hidden = false;
      tool.animate([{ transform: `translateY(-${TOOL_RISE}px)` }, { transform: 'none' }], { duration: STAMP_DROP_MS, easing: 'cubic-bezier(.6, 0, 1, .6)', fill: 'both' });
      await this.wait(STAMP_DROP_MS);
    }
    this.mark.hidden = false; this.onThud();
    if (moving) {
      burst.hidden = false; this.root.classList.add('title-shake');
      tool.animate([{ transform: 'scaleY(.93)' }, { transform: 'none' }], { duration: STAMP_PRESS_MS, easing: 'steps(3)', fill: 'both' });
      this.later(BURST_MS, () => { burst.hidden = true; });
      this.later(SHAKE_MS, () => this.root.classList.remove('title-shake'));
      await this.wait(STAMP_PRESS_MS);
      tool.animate([{ transform: 'none' }, { transform: `translateY(-${TOOL_RISE}px)` }], { duration: STAMP_LIFT_MS, easing: 'cubic-bezier(.3, 0, .8, .4)', fill: 'both' });
      await this.wait(STAMP_LIFT_MS);
      tool.hidden = true;
    }
    await this.wait(STAMP_HOLD_MS);
  }
  /**
   * The three opening sentences on black. A click or key brings the next sentence early, but only once the one on
   * screen has stood for LINE_READ_MS (2026-11-06: one click used to throw all three away); Esc skips the rest.
   */
  async opening(lines, { stamp }) {
    this.root.hidden = false; this.skipped = false; this.stage.inert = true;
    let shownAt = performance.now();
    const skip = e => {
      if (e.type === 'keydown' && e.repeat) return;
      e.preventDefault();
      if (e.type === 'keydown' && e.key === 'Escape') { this.skipped = true; this.resume?.(); return; }
      if (performance.now() - shownAt >= LINE_READ_MS) this.resume?.();
    };
    addEventListener('keydown', skip, true); addEventListener('pointerdown', skip, true);
    if (stamp) await this.stamp();
    this.dark.hidden = false; this.dark.replaceChildren();
    // Whole multiples keep the lettering's pixels square, and the longest sentence decides for all three.
    const widest = Math.max(...lines.map(line => pixelText(line, OPENING_SIZE, INK, 1).width));
    const scale = Math.max(1, Math.min(OPENING_SCALE, Math.floor(innerWidth * OPENING_WIDTH / widest)));
    for (const [i, line] of lines.entries()) {
      if (this.skipped) break;
      const last = i === lines.length - 1, text = pixelText(line, OPENING_SIZE, last ? '#e0564c' : '#f3e6c8', scale);
      this.dark.append(text); shownAt = performance.now();
      if (last) this.onThud();
      await this.wait(last ? LAST_LINE_MS : LINE_MS);
    }
    removeEventListener('keydown', skip, true); removeEventListener('pointerdown', skip, true);
    this.dark.replaceChildren();
  }
}
