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
  constructor(root, { speakers, player }, { reducedMotion, skipLabel }) {
    this.root = root; this.speakers = speakers; this.playerId = player; this.reducedMotion = reducedMotion;
    root.innerHTML = `<img class="talk-who other" alt=""><img class="talk-who player" alt=""><div class="talk-box"><div class="talk-name"></div><div class="talk-text"></div><div class="talk-skip">${skipLabel}</div><div class="talk-next">다음 ▶</div></div>`;
    [this.other, this.player] = root.querySelectorAll('img');
    this.name = root.querySelector('.talk-name'); this.text = root.querySelector('.talk-text'); this.next = root.querySelector('.talk-next');
    this.faces = Promise.all(Object.entries(speakers).map(async ([id, speaker]) => [id, await portrait(speaker)])).then(Object.fromEntries);
  }
  get open() { return !this.root.hidden; }
  /** Plays the lines and resolves with the chosen id, or null if the last line had no choices. */
  async play(lines) {
    const faces = await this.faces;
    this.lines = lines; this.at = 0;
    // With nobody else in the script it is a monologue, and the text takes the empty side.
    const other = lines.find(line => line.who !== this.playerId);
    this.other.hidden = !other; this.root.classList.toggle('alone', !other);
    if (other) this.other.src = faces[other.who];
    this.player.src = faces[this.playerId];
    this.root.hidden = false;
    return new Promise(done => { this.done = done; this.show(); });
  }
  show() {
    const line = this.lines[this.at], speaking = line.who === this.playerId;
    this.root.classList.toggle('player-talks', speaking);
    this.other.classList.toggle('quiet', speaking); this.player.classList.toggle('quiet', !speaking);
    this.name.textContent = this.speakers[line.who].name;
    this.next.hidden = true; this.typed = 0;
    clearInterval(this.typing); this.typing = 0;
    if (this.reducedMotion()) return this.finishLine();
    this.text.textContent = '';
    this.typing = setInterval(() => {
      this.text.textContent = line.text.slice(0, ++this.typed);
      if (this.typed >= line.text.length) this.finishLine();
    }, TYPE_MS);
  }
  finishLine() {
    clearInterval(this.typing); this.typing = 0;
    const line = this.lines[this.at];
    this.text.textContent = line.text;
    if (!line.choices) { this.next.hidden = false; return; }
    const list = document.createElement('div');
    list.className = 'talk-choices';
    for (const { id, label } of line.choices) {
      const choice = document.createElement('button');
      choice.textContent = `▶ ${label}`;
      choice.addEventListener('click', () => this.finish(id));
      choice.addEventListener('mouseenter', () => choice.focus());
      list.append(choice);
    }
    this.text.append(list);
    list.firstChild.focus({ preventScroll: true });
  }
  get choices() { return [...this.text.querySelectorAll('button')]; }
  /** Space, Enter or a click: finish typing, confirm a choice, or go to the next line. */
  advance() {
    if (this.typing) return this.finishLine();
    if (this.lines[this.at].choices) return (this.choices.find(button => button === document.activeElement) || this.choices[0]).click();
    if (this.at === this.lines.length - 1) return this.finish(null);
    this.at++; this.show();
  }
  /** Escape: straight to the last line, then out by its last choice. */
  skip() {
    const last = this.lines.length - 1;
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
