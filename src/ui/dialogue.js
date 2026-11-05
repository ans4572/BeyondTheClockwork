const ZOOM = 3, TYPE_MS = 26;

/** One cell of a sprite sheet, enlarged with hard pixels for the standing portraits. */
function portrait({ sheet, cell, crop = [0, 0, cell, cell], zoom = ZOOM }) {
  return new Promise((done, fail) => {
    const image = new Image();
    image.onerror = fail;
    image.onload = () => {
      const out = document.createElement('canvas'), c = out.getContext('2d');
      const [x, y, w, h] = crop;
      out.width = w * zoom; out.height = h * zoom; c.imageSmoothingEnabled = false;
      c.drawImage(image, x, y, w, h, 0, 0, w * zoom, h * zoom);
      done(out.toDataURL());
    };
    image.src = sheet.replace(/^\//, '');
  });
}

/** The speaking scene along the bottom of the screen: the other party stands left, the player right. Holds no game state. */
export class DialogueBox {
  /**
   * `nameOf(id)` gives a speaker's shown name (the player's can be renamed) and `fill(text)` fills {name} in a line;
   * both default to the script as written.
   */
  constructor(root, { speakers, player }, { reducedMotion, skipLabel, nameOf = id => speakers[id].name, fill = text => text }) {
    this.root = root; this.speakers = speakers; this.playerId = player; this.reducedMotion = reducedMotion; this.nameOf = nameOf; this.fill = fill;
    root.innerHTML = `<img class="talk-who other" alt=""><img class="talk-who player" alt=""><div class="talk-box"><div class="talk-name"></div><div class="talk-text"></div><div class="talk-skip">${skipLabel}</div><div class="talk-next">다음 ▸</div></div>`;
    [this.other, this.player] = root.querySelectorAll('img');
    this.name = root.querySelector('.talk-name'); this.text = root.querySelector('.talk-text'); this.next = root.querySelector('.talk-next');
    // The whole line is laid out from the first letter; the unread part waits invisible, so words never jump to the next line mid-type.
    this.shown = document.createElement('span'); this.unread = document.createElement('span'); this.unread.className = 'talk-unread';
    this.faces = Promise.all(Object.entries(speakers).map(async ([id, speaker]) => [id, await portrait(speaker)])).then(Object.fromEntries);
  }
  get open() { return !this.root.hidden; }
  /** Plays the lines and resolves with the chosen id, the typed text of an asking line, or null. */
  async play(lines) {
    const faces = await this.faces;
    this.lines = lines.map(line => ({ ...line, text: this.fill(line.text) })); this.at = 0; lines = this.lines;
    // With nobody else in the script it is a monologue, and the text takes the empty side.
    const other = lines.find(line => line.who !== this.playerId);
    // A scene without the player puts its second speaker on the player's side.
    this.right = lines.some(line => line.who === this.playerId) ? this.playerId : lines.find(line => line.who !== other.who)?.who ?? this.playerId;
    this.other.hidden = !other; this.root.classList.toggle('alone', !other);
    this.root.classList.toggle('no-player', this.right !== this.playerId);
    if (other) this.other.src = faces[other.who];
    this.player.src = faces[this.right];
    this.root.hidden = false;
    return new Promise(done => { this.done = done; this.show(); });
  }
  show() {
    const line = this.lines[this.at], speaking = line.who === this.right;
    this.root.classList.toggle('player-talks', speaking);
    this.other.classList.toggle('quiet', speaking); this.player.classList.toggle('quiet', !speaking);
    this.name.textContent = this.nameOf(line.who);
    this.next.hidden = true; this.typed = 0;
    clearInterval(this.typing); this.typing = 0;
    if (this.reducedMotion()) return this.finishLine();
    this.shown.textContent = ''; this.unread.textContent = line.text; this.text.replaceChildren(this.shown, this.unread);
    this.typing = setInterval(() => {
      this.typed++; this.shown.textContent = line.text.slice(0, this.typed); this.unread.textContent = line.text.slice(this.typed);
      if (this.typed >= line.text.length) this.finishLine();
    }, TYPE_MS);
  }
  finishLine() {
    clearInterval(this.typing); this.typing = 0;
    const line = this.lines[this.at];
    this.text.textContent = line.text;
    if (line.ask) return this.askFor(line.ask);
    if (!line.choices) { this.next.hidden = false; return; }
    const list = document.createElement('div');
    list.className = 'talk-choices';
    for (const { id, label } of line.choices) {
      const choice = document.createElement('button');
      choice.textContent = `▸ ${label}`;
      choice.addEventListener('click', () => this.finish(id));
      choice.addEventListener('mouseenter', () => choice.focus());
      list.append(choice);
    }
    this.text.append(list);
    list.firstChild.focus({ preventScroll: true });
  }
  /** A line that waits for typed text: an input and a button under it; Enter or the button answers. */
  askFor({ label, placeholder = '', submit = '확인', note = '', max = 10, value = '' }) {
    const form = document.createElement('form');
    form.className = 'talk-ask';
    form.innerHTML = `<input type="text" autocomplete="off" spellcheck="false" enterkeyhint="done"><button type="submit">▸ </button>${note ? '<small></small>' : ''}`;
    const [input, button] = [form.querySelector('input'), form.querySelector('button')];
    Object.assign(input, { maxLength: max, placeholder, value: this.askValue ?? value }); input.setAttribute('aria-label', label);
    button.append(submit); if (note) form.querySelector('small').textContent = note;
    form.addEventListener('submit', event => { event.preventDefault(); this.finish(input.value); });
    this.text.append(form);
    input.focus({ preventScroll: true });
  }
  get asking() { return this.text.querySelector('.talk-ask'); }
  get choices() { return [...this.text.querySelectorAll('.talk-choices button')]; }
  /** Space, Enter or a click: finish typing, confirm a choice, or go to the next line. */
  advance() {
    if (this.typing) return this.finishLine();
    if (this.asking) return this.asking.requestSubmit();
    if (this.lines[this.at].choices) return (this.choices.find(button => button === document.activeElement) || this.choices[0]).click();
    if (this.at === this.lines.length - 1) return this.finish(null);
    this.at++; this.show();
  }
  /** Escape: straight to the last line, then out by its last choice. */
  skip() {
    const last = this.lines.length - 1;
    if (this.asking) return this.asking.requestSubmit();
    if (this.at === last && this.lines[last].choices && !this.typing) return this.choices.at(-1).click();
    if (this.at === last && !this.lines[last].choices) return this.finish(null);
    this.at = last; this.show(); this.finishLine();
  }
  move(delta) {
    const { choices } = this;
    if (choices.length) choices[(choices.indexOf(document.activeElement) + delta + choices.length) % choices.length].focus({ preventScroll: true });
  }
  finish(id) {
    clearInterval(this.typing); this.typing = 0;
    this.root.hidden = true; this.done(id);
  }
}
