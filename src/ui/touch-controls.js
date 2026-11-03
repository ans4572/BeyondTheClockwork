const STICK_REACH_PX = 52, DEAD_ZONE = 0.16, IDLE_AIM_UNITS = 3;

/** Thumb offset to a move of at most length 1, with a small dead zone at the centre. */
// Pixel icons for the tool buttons beside the minimap: a folded map, a gear and the four corners of a frame.
const icon = body => `<svg class="tool-icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
const ICONS = {
  map: icon('<path d="M1 3h4l3 1 3-1h4v11h-4l-3-1-3 1H1z" fill="#2b3345"/><path d="M2 4h3v9H2zM6 5h2v8H6zM9 5h2v8H9zM12 4h2v9h-2z" fill="#f6ecd2"/><path d="M6 5h2v8H6z" fill="#e0cf9f"/><path d="M12 4h2v9h-2z" fill="#e0cf9f"/><path d="M3 6h1v1H3zM10 8h1v1h-1zM12 10h1v1h-1z" fill="#c43c36"/>'),
  gear: icon('<path d="M7 1h2v2h2l1-1 2 2-1 1v2h2v2h-2v2l1 1-2 2-1-1h-2v2H7v-2H5l-1 1-2-2 1-1V9H1V7h2V5L2 4l2-2 1 1h2z" fill="#2b3345"/><path d="M7 4h2v1h2v2h1v2h-1v2H9v1H7v-1H5V9H4V7h1V5h2z" fill="#c79a3e"/><path d="M7 6h2v1h1v2H9v1H7V9H6V7h1z" fill="#2b3345"/>'),
  fullscreen: icon('<path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z" fill="#2b3345"/>')
};
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
  constructor(root, onPress) {
    this.root = root; this.onPress = onPress; this.move = { x: 0, y: 0 }; this.attacking = false; this.stickId = null;
    root.innerHTML = `<div class="touch-zone"></div><div class="touch-stick" hidden><i></i></div><div class="touch-tools">${document.fullscreenEnabled ? `<button data-press="fullscreen" aria-label="전체화면">${ICONS.fullscreen}</button>` : ''}<button data-press="map" aria-label="지도">${ICONS.map}</button><button data-press="menu" aria-label="환경설정">${ICONS.gear}</button></div><button class="touch-talk" data-press="interact" hidden>말 걸기</button><div class="touch-pad">${SLOT_BUTTONS.map(id => `<button class="touch-${id}" data-press="${id}" aria-label="${SLOT_NAMES[id]}"><img alt=""><span class="cool"></span><b class="left"></b></button>`).join('')}</div>`;
    this.zone = root.querySelector('.touch-zone'); this.stick = root.querySelector('.touch-stick'); this.knob = this.stick.firstChild; this.talk = root.querySelector('.touch-talk');
    this.slots = SLOT_BUTTONS.map(id => root.querySelector(`.touch-${id}`));
    this.zone.addEventListener('pointerdown', e => this.grab(e));
    this.zone.addEventListener('pointermove', e => this.drag(e));
    for (const type of ['pointerup', 'pointercancel']) this.zone.addEventListener(type, e => { if (e.pointerId === this.stickId) this.letGo(); });
    for (const button of root.querySelectorAll('button')) {
      const name = button.dataset.press;
      button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); if (name === 'attack') this.attacking = true; else onPress(name); });
      if (name === 'attack') for (const type of ['pointerup', 'pointercancel']) button.addEventListener(type, () => { this.attacking = false; });
    }
  }
  grab(e) {
    if (this.stickId !== null) return;
    e.preventDefault(); this.zone.setPointerCapture(e.pointerId); this.stickId = e.pointerId; this.origin = [e.clientX, e.clientY];
    this.stick.hidden = false; this.stick.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; this.drag(e);
  }
  drag(e) {
    if (e.pointerId !== this.stickId) return;
    const dx = e.clientX - this.origin[0], dy = e.clientY - this.origin[1], { x, y } = this.move = stickVector(dx, dy);
    this.knob.style.transform = `translate(${x * STICK_REACH_PX}px, ${y * STICK_REACH_PX}px)`;
  }
  letGo() { this.stickId = null; this.move = { x: 0, y: 0 }; this.stick.hidden = true; }
  release() { this.letGo(); this.attacking = false; }
  show(visible, canTalk) {
    if (this.root.hidden === visible) { this.root.hidden = !visible; if (!visible) this.release(); }
    this.talk.hidden = !canTalk;
  }
  /** `slots` is the HUD's list, in the order of SLOT_BUTTONS, with what each button is showing. */
  update(slots) {
    slots.forEach(({ art, share, left, ready, short }, i) => {
      const button = this.slots[i], image = button.firstChild, src = art ? `art/ui/skill-icons/${art}.png` : '';
      if (button.dataset.art !== src) { button.dataset.art = src; button.classList.toggle('empty', !art); if (art) image.src = src; else image.removeAttribute('src'); }
      button.children[1].style.height = `${share * 100}%`; button.children[2].textContent = left; button.classList.toggle('ready', !!ready); button.classList.toggle('short', !!short);
    });
  }
}
