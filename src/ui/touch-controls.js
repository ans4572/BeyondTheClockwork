import { TOOL_ICONS, slotArt, syncFullscreenIcon } from './tool-icons.js';
const STICK_REACH_PX = 52, DEAD_ZONE = 0.16, IDLE_AIM_UNITS = 3;

/** Thumb offset to a move of at most length 1, with a small dead zone at the centre. */
export function stickVector(dx, dy, reach = STICK_REACH_PX) {
  const length = Math.hypot(dx, dy), push = Math.min(1, length / reach);
  return !length || push < DEAD_ZONE ? { x: 0, y: 0 } : { x: dx / length * push, y: dy / length * push };
}

/** With no cursor to aim, attacks go to the nearest enemy, or the way the player is walking. */
export function autoAim(player, enemies) {
  const target = enemies.filter(enemy => enemy.hp > 0).reduce((best, enemy) => (!best || Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y) ? enemy : best), null);
  return target ? { x: target.x, y: target.y } : { x: player.x + Math.cos(player.moveAngle) * IDLE_AIM_UNITS, y: player.y + Math.sin(player.moveAngle) * IDLE_AIM_UNITS };
}

const SLOT_BUTTONS = ['attack', 'skill0', 'skill1', 'skill2', 'skill3', 'fusion', 'dodge'];
const SLOT_NAMES = { attack: '렌치 공격', skill0: '기술 1', skill1: '기술 2', skill2: '기술 3', skill3: '기술 4', fusion: '융합', dodge: '회피' };

/** Thumb controls over the game. Holds no game state: it reports presses and what is being held. */
export class TouchControls {
  /** `passOn`: [element, press name] pairs under the stick's zone (F2's face in the HUD) whose tap is a press instead. */
  constructor(root, onPress, passOn = []) {
    this.root = root; this.onPress = onPress; this.passOn = passOn; this.move = { x: 0, y: 0 }; this.attacking = false; this.stickId = null;
    // Skill buttons under a finger right now: 굉음 charges and 고압 분사 sprays while theirs is held.
    this.holding = new Set();
    root.innerHTML = `<div class="touch-zone"></div><div class="touch-stick" hidden><i></i></div><div class="touch-tools">${document.fullscreenEnabled ? `<button data-press="fullscreen" aria-label="전체화면">${TOOL_ICONS.fullscreen}</button>` : ''}<button data-press="map" aria-label="지도">${TOOL_ICONS.map}</button><button data-press="menu" aria-label="환경설정">${TOOL_ICONS.settings}</button></div><button class="touch-talk" data-press="interact" hidden>말 걸기</button><button class="touch-practice" data-press="practiceReset" hidden></button><div class="touch-pad">${SLOT_BUTTONS.map(id => `<button class="touch-${id}" data-press="${id}" aria-label="${SLOT_NAMES[id]}"><img alt=""><span class="cool"></span><b class="left"></b><i class="cost"></i></button>`).join('')}</div>`;
    this.zone = root.querySelector('.touch-zone'); this.stick = root.querySelector('.touch-stick'); this.knob = this.stick.firstChild; this.talk = root.querySelector('.touch-talk'); this.practiceButton = root.querySelector('.touch-practice');
    const full = root.querySelector('[data-press="fullscreen"]');
    document.addEventListener('fullscreenchange', () => syncFullscreenIcon(full));
    this.slots = SLOT_BUTTONS.map(id => root.querySelector(`.touch-${id}`));
    this.zone.addEventListener('pointerdown', e => this.grab(e));
    this.zone.addEventListener('pointermove', e => this.drag(e));
    for (const type of ['pointerup', 'pointercancel']) this.zone.addEventListener(type, e => { if (e.pointerId === this.stickId) this.letGo(); });
    for (const button of root.querySelectorAll('button')) {
      const name = button.dataset.press;
      button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); if (name === 'attack') this.attacking = true; else { if (name.startsWith('skill')) this.holding.add(name); onPress(name); } });
      if (name === 'attack') for (const type of ['pointerup', 'pointercancel']) button.addEventListener(type, () => { this.attacking = false; });
      if (name.startsWith('skill')) for (const type of ['pointerup', 'pointercancel']) button.addEventListener(type, () => this.holding.delete(name));
    }
  }
  grab(e) {
    if (this.stickId !== null) return;
    const over = this.passOn.find(([element]) => { const r = element?.getBoundingClientRect(); return r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    if (over) { e.preventDefault(); this.onPress(over[1]); return; }
    e.preventDefault(); this.zone.setPointerCapture(e.pointerId); this.stickId = e.pointerId; this.origin = [e.clientX, e.clientY];
    this.stick.hidden = false; this.stick.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; this.drag(e);
  }
  drag(e) {
    if (e.pointerId !== this.stickId) return;
    const dx = e.clientX - this.origin[0], dy = e.clientY - this.origin[1], { x, y } = this.move = stickVector(dx, dy);
    this.knob.style.transform = `translate(${x * STICK_REACH_PX}px, ${y * STICK_REACH_PX}px)`;
  }
  letGo() { this.stickId = null; this.move = { x: 0, y: 0 }; this.stick.hidden = true; }
  release() { this.letGo(); this.attacking = false; this.holding.clear(); }
  /** Which of the four skill buttons are held down now, by index. */
  get skillHeld() { return [0, 1, 2, 3].filter(i => this.holding.has(`skill${i}`)); }
  show(visible, canTalk) {
    if (this.root.hidden === visible) { this.root.hidden = !visible; if (!visible) this.release(); }
    this.talk.hidden = !canTalk;
  }
  /** Moru's back yard: the cooldown-reset switch (the T key on a keyboard), with whether it is on. */
  practice(visible, on) {
    const b = this.practiceButton, text = `대기시간 초기화 ${on ? '켜짐' : '꺼짐'}`;
    if (b.hidden === visible) b.hidden = !visible;
    if (b.textContent !== text) b.textContent = text;
    b.classList.toggle('on', !!on);
  }
  /** `slots` is the HUD's list, in the order of SLOT_BUTTONS, with what each button is showing. */
  update(slots) {
    slots.forEach(({ art, cost, share, left, ready, short }, i) => {
      const button = this.slots[i], image = button.firstChild, src = art ? slotArt(art) : '';
      if (button.dataset.art !== src) { button.dataset.art = src; button.classList.toggle('empty', !art); if (art) image.src = src; else image.removeAttribute('src'); }
      // Written only when it changes: touching a button's style every frame cost phones a style pass per frame.
      const height = `${Math.round(share * 1000) / 10}%`, shown = button.shown ??= {};
      if (shown.height !== height) { shown.height = height; button.children[1].style.height = height; }
      if (shown.left !== left) { shown.left = left; button.children[2].textContent = left; }
      if (shown.cost !== (cost || '')) { shown.cost = cost || ''; button.children[3].textContent = shown.cost; }
      if (shown.ready !== !!ready) { shown.ready = !!ready; button.classList.toggle('ready', !!ready); }
      if (shown.short !== !!short) { shown.short = !!short; button.classList.toggle('short', !!short); }
    });
  }
}
