import { loadData } from './engine/data.js';
import { Game } from './engine/game.js';
import { TOOL_ICONS, ico } from './ui/tool-icons.js';
import { roomTitle } from './engine/room-title.js';
import { encodeSave, decodeSave, hasProgress, saveSummary, SAVE_KEY } from './engine/storage.js';
import { placeOf, PIXELS_PER_UNIT } from './engine/map-geometry.js';
import { statCost, rankCap } from './engine/progression.js';
import { CanvasRenderer, STATUS_ICONS } from './render/canvas.js';
import { SpriteLibrary, assetUrl } from './animation/sprite-library.js';
import { DepthMask } from './render/depth-mask.js';
import { TitleScreen, pixelText, PIXEL_FONT, PIXEL_EM } from './ui/title-screen.js';
import { TouchControls, autoAim } from './ui/touch-controls.js';
import { worldMapSvg } from './ui/world-map.js';
import { SoundBank } from './audio/sfx.js';
import { MusicPlayer, musicScene } from './audio/music.js';
import { HITS_TO_LEARN } from './engine/tutorial.js';
import { DialogueBox } from './ui/dialogue.js';

const $ = id => document.getElementById(id);
const escapeHTML = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const defaultBindings = { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', dodge: 'Space', skill0: 'KeyQ', skill1: 'KeyE', skill2: 'KeyR', skill3: 'KeyF', interact: 'KeyG', codex: 'Tab', map: 'KeyM' };
const bindingNames = { up: '위', left: '왼쪽', down: '아래', right: '오른쪽', dodge: '회피', skill0: '기술 1', skill1: '기술 2', skill2: '기술 3', skill3: '기술 4', interact: '상호작용', codex: '도감', map: '지도' };
const HOME_NAME = '웃음 마을';
const TIER_NAMES = { common: '일반', rare: '희귀', special: '특별' };
// The thirteen tuning rows read as four parts of the body they change: casing, wrench, circuits and pockets.
const STAT_GROUPS = [['외장', ['maxHp', 'damageReduction', 'moveSpeed', 'dodgeCooldown']], ['렌치', ['attackDamage', 'attackSpeed', 'critChance', 'critDamage']], ['회로', ['cooldownReduction', 'energyGain', 'statusPower']], ['주머니', ['gearGain', 'coinGain']]];
/** Parser errors arrive in English; players get one plain sentence instead. */
const elementIcon = (id, classes = 'element-icon') => `<img class="${classes}" src="art/ui/element-icons/${id}.png" alt="">`;
// How each kind of hit is felt: seconds the game holds still, and screen shake in pixels.
const FEEL = { hit: { stop: 0.04 }, heavy: { stop: 0.08, shake: 3 }, skill: { stop: 0.03 }, fusion: { stop: 0.06, shake: 2 }, kill: { stop: 0.1, shake: 4 }, hurt: { stop: 0.06, shake: 4 }, block: { stop: 0 }, burst: { stop: 0, shake: 3 }, pop: { stop: 0 }, dodge: { stop: 0 }, summon: { stop: 0 }, clear: { stop: 0 } }, NO_FEEL = { stop: 0 };
const CRIT_STOP = 0.03, CRIT_SHAKE = 3;
function finishBoot() { document.body.classList.add('booted'); document.getElementById('boot')?.remove(); }
const ELEMENT_STATUS = { fire: 'burn', ice: 'chill', lightning: 'shock', wind: 'windPressure' };
const saveProblem = message => (/[가-힣]/.test(message) ? message : '저장 내용을 읽을 수 없습니다. 파일이 잘렸거나 다른 게임의 파일일 수 있습니다.');
const TOUCH_PANEL_ZOOM = 0.85, TOUCH_TEXT_ZOOM = 1, IMAGE_SLOTS = 3;
const keyName = key => key.replace('Key', '').replace('Digit', '').replace('Arrow', '↑↓←→'[({ ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 })[key]] || '').replace('Space', 'Space');

try {
  // The pixel lettering font must be ready before the first heading or the title is drawn from it.
  const [, data] = await Promise.all([Promise.all([document.fonts.load(`${PIXEL_EM}px ${PIXEL_FONT}`, '태엽'), document.fonts.load('700 12px Galmuri11', '태엽')]).catch(() => {}), loadData()]);
  let saved = null, loadError = '', rawSave = '';
  try { rawSave = localStorage.getItem(SAVE_KEY) || ''; if (rawSave) saved = decodeSave(rawSave, data); }
  catch (error) { loadError = error.message; }
  let saveBlocked = !!loadError, storageError = '';
  const game = new Game(data, saved, state => {
    if (saveBlocked) return;
    try { localStorage.setItem(SAVE_KEY, encodeSave(state)); }
    catch { storageError = '브라우저 저장 공간을 사용할 수 없습니다. 설정에서 저장 파일을 내보내세요.'; }
  });
  const renderer = new CanvasRenderer($('game'), game);
  let touch = null;
  // F2's sheets come first and the loading card waits for them, so the old code doll never stands in for the player.
  // Enemies and townsfolk follow one set at a time instead of competing with F2 for the connection.
  const playerSprites = SpriteLibrary.load().then(library => renderer.useSprites(library)).catch(error => console.warn(error));
  playerSprites
    .then(() => SpriteLibrary.load('/art/animations/mobs/normal-elite/game-clips.json')).then(library => renderer.useMobSprites(library)).catch(error => console.warn(error))
    .then(() => SpriteLibrary.load('/art/animations/npc/game-clips.json')).then(library => renderer.useNpcSprites(library)).catch(error => console.warn(error));
  const isTouch = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch', isTouch);
  // The game canvas is backed at the size it is shown (up to 2x for sharp screens), so maps and sprites are not stretched twice.
  const MAX_BACKING_WIDTH = 2560;
  const fitCanvas = () => {
    const shown = $('game').getBoundingClientRect().width, width = Math.max(1120, Math.min(MAX_BACKING_WIDTH, Math.round(shown * Math.min(devicePixelRatio || 1, 2))));
    if ($('game').width !== width) { $('game').width = width; $('game').height = Math.round(width * 640 / 1120); }
  };
  const fitHud = () => {
    fitCanvas();
    const scale = $('game').getBoundingClientRect().width / 1120;
    $('hud').style.transform = `scale(${scale})`; document.documentElement.style.setProperty('--hud-scale', scale);
    // Touch tools sit just left of the minimap's top edge (it is 168px wide, 14px from the right, 12px down on the sheet).
    const shown = $('game').getBoundingClientRect();
    $('touch').style.setProperty('--tools-right', `${Math.round(document.documentElement.clientWidth - shown.left - (1120 - 182) * scale + 8)}px`);
    $('touch').style.setProperty('--tools-top', `${Math.round(shown.top + 12 * scale)}px`);
    for (const id of ['toast', 'hint']) $(id).style.zoom = isTouch ? Math.max(scale, TOUCH_TEXT_ZOOM) : scale;
    // Panels would be unreadable at a phone's scale, and scroll instead of shrinking.
    $('overlay').style.zoom = isTouch ? Math.max(scale, TOUCH_PANEL_ZOOM) : scale;
  };
  addEventListener('resize', fitHud); document.addEventListener('fullscreenchange', fitHud); fitHud();
  const hudFace = $('hud-face').getContext('2d'), portrait = new Image();
  hudFace.imageSmoothingEnabled = false;
  portrait.onload = () => hudFace.drawImage(portrait, 40, 16, 48, 48, 4, 4, 48, 48);
  portrait.src = 'art/animations/player/movement/locomotion/clips/idle-south-708a71c5/sheet.png';
  renderer.mapImages = new Map(); renderer.depthMasks = new Map();
  const offscreen = (width, height) => Object.assign(document.createElement('canvas'), { width, height });
  const buildDepth = village => {
    const [image, mask] = [village.background, village.mask].map(file => renderer.mapImages.get(file));
    if (image && mask) renderer.depthMasks.set(village.background, new DepthMask(image, mask, village, offscreen));
  };
  // Map art is loaded only where it is needed: the place underfoot and the one after it, never the whole region up front.
  const artOf = place => [place?.background, place?.mask, ...(place?.props || []).map(prop => prop.image)].filter(Boolean);
  const firstRoom = placeOf(data.maps, data.maps?.maps?.[data.slice.rooms[0]?.id]);
  let imageQueue = [...new Set([...Object.values(STATUS_ICONS), data?.maps?.practice?.dummyImage, ...artOf(placeOf(data.maps, data.maps?.intro)), ...artOf(game.hubMap), ...artOf(firstRoom)].filter(Boolean))];
  const requested = new Set(imageQueue);
  let imagesLoading = 0, placeLoaded = null;
  function fetchImages() {
    while (imagesLoading < IMAGE_SLOTS && imageQueue.length) {
      const file = imageQueue.shift(), image = new Image(), done = () => { imagesLoading--; fetchImages(); };
      imagesLoading++;
      image.onload = () => { renderer.mapImages.set(file, image); Object.values(data?.maps?.villages || {}).filter(village => [village.background, village.mask].includes(file)).forEach(buildDepth); done(); };
      image.onerror = () => { console.warn(`맵 배경을 불러올 수 없습니다: ${file}`); done(); };
      image.src = assetUrl(file);
    }
  }
  function bringPlaceForward() {
    const place = game.village || game.map;
    if (place?.background === placeLoaded) return;
    placeLoaded = place?.background;
    // In town the next place is the first stop; on a run it is the stop after this one.
    const next = game.s.run ? placeOf(data.maps, data.maps?.maps?.[data.slice.rooms[game.s.run.node + 1]?.id]) : firstRoom, wanted = [...artOf(place), ...artOf(next)];
    const fresh = wanted.filter(file => !requested.has(file)); fresh.forEach(file => requested.add(file));
    imageQueue = [...wanted.filter(file => imageQueue.includes(file)), ...fresh, ...imageQueue.filter(file => !wanted.includes(file))];
    fetchImages();
  }
  fetchImages();
  const gameViewport = $('overlay').parentElement;
  let screen = loadError ? 'loadError' : 'title', onTitle = false, overlayKey = '', bindingTarget = null;
  let pointer = { x: 14, y: 8 }, held = new Set(), mouseHeld = false, pending = {}, gamepadLast = [], lastAutosave = game.s.time;
  let audio = null, lastSoundId = null, codexTab = 'elements', mapPick = null;
  // The in-game setting, or the same wish made once for every app on the device.
  const reducedMotion = () => game.s.profile.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function bindings() { return { ...defaultBindings, ...game.s.profile.settings.bindings }; }
  function clearInput() { held.clear(); mouseHeld = false; pending = {}; touch?.release(); }
  function pause(view = 'pause') { screen = view; game.s.paused = true; clearInput(); renderOverlay(true); }
  // Panels sit inside the game frame, whose stacking would keep them under the title.
  const placeOverlay = () => (onTitle ? document.body : gameViewport).append($('overlay'));
  function openTitle() { onTitle = true; screen = 'title'; game.s.paused = true; document.body.classList.add('on-title'); $('app').inert = true; placeOverlay(); clearInput(); renderOverlay(true); title.show({ canLoad: hasProgress(game.s), detail: saveDetail() }); }
  // The time comes from the save on disk, so the button shows what a reload would actually bring back.
  function saveDetail() {
    let savedAt = null;
    try { savedAt = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')?.savedAt; } catch {}
    return saveSummary(game.s, savedAt, data);
  }
  function leaveTitle() { onTitle = false; document.body.classList.remove('on-title'); $('app').inert = false; $('title').inert = false; placeOverlay(); title.hide(); }
  /** The stamp and the opening sentences, then control of a waking body. */
  async function playOpening(stamp) {
    screen = 'cinematic'; game.s.paused = true; clearInput(); renderOverlay(true); leaveTitle();
    await title.opening(data.progression.intro.openingText, { stamp });
    game.s.paused = false; game.beginIntro({ wake: !reducedMotion(), lesson: true });
    title.hide(); screen = null; renderOverlay(true); $('game').focus({ preventScroll: true });
  }
  /** Runs a script, with any side question it offers, and resolves with the final choice. */
  async function talk(name) {
    const { scripts } = data.dialogue;
    screen = 'talk'; clearInput(); $('hud').classList.add('talking'); renderOverlay(true);
    let choice = await talkBox.play(scripts[name]);
    while (scripts[choice]) { await talkBox.play(scripts[choice]); choice = await talkBox.play(scripts[name]); }
    $('hud').classList.remove('talking'); screen = null; renderOverlay(true); $('game').focus({ preventScroll: true });
    return choice;
  }
  async function talkToNpc(npc) {
    const choice = await talk(npc.character);
    if (choice === 'open') game.talk();
    if (choice === 'elements') game.openElements();
    if (choice === 'practice' && !game.enterPractice()) game.notify('속성 부품을 하나 이상 장착하면 시험할 수 있습니다.');
    renderOverlay(true);
  }
  async function meetMoru() { await talk('registration'); game.register(); renderOverlay(true); }
  // A boss speaks once, the first time the player walks into its room; the fight waits until the talk ends.
  const BOSS_TALKS = { collectorRoco: 'rocoMeet', captainBrass: 'brassMeet' };
  async function meetBoss(boss) {
    (game.s.profile.bossTalks ??= []).push(boss); game.save();
    game.s.paused = true; await talk(BOSS_TALKS[boss]); game.s.paused = false;
  }
  // The slice's ending: Brass wakes and talks, the clock tower hears of it, then To be continued.
  async function playEnding() {
    const seen = (game.s.profile.bossTalks ??= []), first = !seen.includes('brassAfter');
    seen.push('ending'); if (first) seen.push('brassAfter'); game.save();
    if (first) await talk('brassAfter');
    screen = 'talk'; renderOverlay(true);
    const scene = $('scene');
    scene.innerHTML = towerScene(); scene.hidden = false; scene.classList.remove('fade'); void scene.offsetWidth; scene.classList.add('fade');
    await new Promise(done => setTimeout(done, game.s.profile.settings.reducedMotion ? 0 : 1400));
    await talk('ordenScene');
    scene.hidden = true; renderOverlay(true);
  }
  function towerScene() {
    const ticks = Array.from({ length: 12 }, (_, i) => `<rect x="-5" y="-150" width="10" height="${i % 3 ? 18 : 30}" fill="#2b3345" transform="rotate(${i * 30})"/>`).join('');
    const stars = Array.from({ length: 40 }, (_, i) => `<rect x="${(i * 197) % 1120}" y="${(i * 89) % 300}" width="${i % 5 ? 3 : 5}" height="${i % 5 ? 3 : 5}" fill="#f6ecd2" opacity="${0.3 + (i % 4) * 0.15}"/>`).join('');
    return `<svg viewBox="0 0 1120 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="1120" height="640" fill="#141b2b"/>${stars}`
      + `<g transform="translate(560 290)"><circle r="196" fill="#0e121a"/><circle r="172" fill="#e8c26a"/><circle r="160" fill="#f6ecd2"/>${ticks}<rect x="-5" y="-110" width="10" height="114" fill="#2b3345" transform="rotate(-20)"/><rect x="-4" y="-140" width="8" height="144" fill="#a92f2b" transform="rotate(118)"/><circle r="12" fill="#2b3345"/></g>`
      + `<path d="M0 640V470h120v-40h80v40h70V380h60v-30h40v30h60v260zM1120 640V450h-110v-50h-70v50h-80V360h-50v-30h-40v30h-70v280z" fill="#0e121a"/>`
      + `<path d="M260 640V520h600v120z" fill="#0e121a"/><rect x="260" y="514" width="600" height="10" fill="#c79a3e"/></svg><b>중앙시계탑 · 꼭대기</b>`;
  }
  async function moruCalls() { await talk('firstBell'); await talk('moruCalls'); }
  function startNew() { openAudio(); if (hasProgress(game.s)) { screen = 'confirmNew'; renderOverlay(true); } else playOpening(true); }
  function resume() {
    mapPick = null;
    if (onTitle) { screen = 'title'; bindingTarget = null; renderOverlay(true); title.focus(); return; }
    screen = null; game.s.paused = false; bindingTarget = null; clearInput(); renderOverlay(true); $('game').focus({ preventScroll: true }); }
  function button(label, action, extra = '', classes = '') { return `<button class="${classes}" data-action="${action}" ${extra}>${label}</button>`; }
  function panel(content, classes = '') { return `<section class="panel ${classes}">${content}</section>`; }
  const sounds = new SoundBank(), music = new MusicPlayer();
  // Browsers only allow sound after the player touches the page; the first touch or key anywhere, the title included, opens it.
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => openAudio(), { capture: true });
  // The rest stop splits the run: before it the street is bright, from it on the light is going.
  const REST_INDEX = data.slice.rooms.findIndex(room => room.kind === 'shop');
  /** The background track for what is on screen; silent when music is switched off. */
  function playMusic() {
    const s = game.s, settings = s.profile.settings, room = game.room;
    const name = settings.music ? musicScene({ onTitle, mode: s.mode, roomKind: room?.kind, roomIndex: s.run ? s.run.node : undefined, restIndex: REST_INDEX }) : null;
    // Menus over the game keep the music, a little quieter.
    music.update(audio, name, settings.musicVolume * (s.paused && !onTitle ? 0.5 : 1));
  }
  function openAudio() { const { sound, music: musicOn } = game.s.profile.settings; if (sound || musicOn) { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); sounds.load(audio); } }
  /** A recorded effect if it is loaded; otherwise the synthesized stand-in, if there is one. */
  // Menu sounds still play while the game is paused behind the panel.
  const MENU_SOUNDS = new Set(['click', 'buy', 'deny', 'tune', 'equip']);
  function sfx(name, fallback) { if (!audio || !game.s.profile.settings.sound || (game.s.paused && !MENU_SOUNDS.has(name))) return; if (!sounds.play(audio, name)) fallback?.(); }
  function beep(frequency = 420, duration = 0.05, volume = 0.025) {
    if (!audio || !game.s.profile.settings.sound || game.s.paused) return;
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'triangle'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  }
  let noiseBuffer = null;
  /** A burst of filtered noise: the body of every whoosh, clank and crunch. */
  function noise(duration, volume, frequency, q = 1.2) {
    if (!audio || !game.s.profile.settings.sound || game.s.paused) return;
    if (!noiseBuffer) { noiseBuffer = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate); const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    source.buffer = noiseBuffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    source.connect(filter).connect(gain).connect(audio.destination); source.start(); source.stop(audio.currentTime + duration);
  }
  /** A pitch that falls as it fades, for the weight under a hit. */
  function thump(from, to, duration, volume, type = 'triangle') {
    if (!audio || !game.s.profile.settings.sound || game.s.paused) return;
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = type;
    osc.frequency.setValueAtTime(from, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(to, audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  }
  const HIT_SOUNDS = {
    hit: () => sfx('hit', () => { noise(0.05, 0.12, 1800); thump(170, 90, 0.07, 0.07); }),
    heavy: () => sfx('heavy', () => { noise(0.08, 0.16, 1100); thump(120, 50, 0.14, 0.11); }),
    skill: () => { noise(0.05, 0.08, 2400); thump(200, 120, 0.06, 0.04); },
    fusion: () => { noise(0.12, 0.12, 900); thump(110, 45, 0.18, 0.1); },
    kill: () => sfx('kill', () => { noise(0.14, 0.14, 700, 0.8); thump(520, 160, 0.12, 0.05, 'square'); }),
    hurt: () => sfx('hurt', () => { thump(150, 70, 0.16, 0.1, 'sawtooth'); noise(0.06, 0.08, 500); }),
    block: () => sfx('block', () => thump(900, 700, 0.08, 0.04, 'square')),
    burst: () => sfx('burst', () => { noise(0.2, 0.16, 500, 0.7); thump(110, 40, 0.2, 0.1); }),
    pop: () => sfx('pop'),
    dodge: () => sfx('dodge', () => noise(0.12, 0.05, 700, 0.6)),
    summon: () => sfx('summon'),
    clear: () => sfx('clear'),
    down: () => sfx('down'),
    charged: () => sfx('charged'),
    mend: () => sfx('mend'),
    cast: hit => sfx(hit.id, () => { noise(0.05, 0.08, 2400); thump(200, 120, 0.06, 0.04); }),
    mob: hit => sfx(hit.id),
    cards: () => sfx('cards'),
    pick: () => sfx('pick'),
    loot: () => sfx('loot'),
    portal: () => sfx('portal'),
    fail: () => sfx('fail')
  };
  let hitstop = 0;
  /** Turns the rules' hits into a held frame, a shake, a red edge and a sound, once per kind per step. */
  function feelHits() {
    const hits = game.feel.splice(0);
    if (!hits.length) return;
    const calm = reducedMotion();
    for (const hit of hits) {
      const kind = FEEL[hit.kind] || NO_FEEL;
      hitstop = Math.max(hitstop, kind.stop + (hit.crit ? CRIT_STOP : 0));
      const shake = Math.max(kind.shake || 0, hit.crit ? CRIT_SHAKE : 0);
      if (shake && !calm) renderer.kick(shake);
      if (hit.kind === 'hurt' && !calm) renderer.wince();
    }
    // One sound per kind (per skill, enemy type or status where those differ) in a step.
    const voiced = new Map(hits.map(hit => [`${hit.kind}:${hit.id ?? ''}`, hit]));
    for (const hit of voiced.values()) HIT_SOUNDS[hit.kind]?.(hit);
    if (hits.some(hit => hit.crit)) sfx('crit', () => thump(1400, 900, 0.08, 0.03, 'square'));
  }
  /** Two slow strokes of the town bell. */
  function toll() {
    if (!audio || !game.s.profile.settings.sound || game.s.paused) return;
    for (const stroke of [0, 0.9]) for (const [frequency, volume] of [[392, 0.06], [784, 0.03], [1176, 0.012]]) {
      const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + stroke;
      osc.frequency.value = frequency; gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(0.001, at + 1.6);
      osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + 1.6);
    }
  }
  function saveDownload(content = encodeSave(game.s), suffix = 'save') {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `beyond-the-clockwork-${suffix}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function statValue(stat, rank) {
    const value = rank * stat.perRank;
    return stat.unit === 'percent' ? `+${Number((value * 100).toFixed(1))}%` : `+${value}`;
  }
  function statRow(stat) {
    // Levels past this chapter's cap show as a locked stretch of the bar until the chapter boss falls.
    const rank = game.s.profile.stats[stat.id], cap = rankCap(data, game.s.profile, stat), maxed = rank >= stat.maxRank, capped = !maxed && rank >= cap;
    const cost = statCost(stat, rank), blocked = maxed || capped || game.s.profile.freeGears < cost, nextChapter = cap / data.slice.statChapters.ranksPerChapter + 1;
    const tip = `${stat.name}: ${stat.description}${cap < stat.maxRank ? `\n지금은 ${cap}단계까지 · ${nextChapter}장에 들어가면 ${cap + data.slice.statChapters.ranksPerChapter}단계까지 열림` : ''}`;
    return `<div class="stat-row" data-tip="${tip}"><strong>${stat.name}</strong><span class="stat-level">${rank} / ${cap}</span><div class="stat-bar"><i style="width:${rank / stat.maxRank * 100}%"></i>${cap < stat.maxRank ? `<b class="stat-locked" style="left:${cap / stat.maxRank * 100}%"></b>` : ''}</div><span class="stat-value">${statValue(stat, rank)}${maxed || capped ? '' : ` → ${statValue(stat, rank + 1)}`}</span><button data-action="tune-buy" data-row="${stat.id}" ${blocked ? 'disabled' : ''}>${maxed ? 'MAX' : capped ? `${ico('lock')} ${nextChapter}장` : `${ico('gear')} ${cost}`}</button></div>`;
  }
  function statGroups() {
    const stats = data.slice.permanentStats, grouped = STAT_GROUPS.flatMap(([, ids]) => ids), rest = stats.filter(stat => !grouped.includes(stat.id));
    return [...STAT_GROUPS, ...(rest.length ? [['기타', rest.map(stat => stat.id)]] : [])].map(([name, ids]) => `<h3 class="stat-group">${name}</h3>${ids.map(id => stats.find(stat => stat.id === id)).filter(Boolean).map(statRow).join('')}`).join('');
  }
  function tuningPanel() {
    return panel(`<div class="panel-header"><div><h2>모루의 조율판</h2></div><strong>${ico('gear')} ${game.s.profile.freeGears}</strong></div><p>자유 톱니로 기본 능력을 올립니다. 전체 환급은 언제든 무료입니다.</p><div class="stat-list">${statGroups()}</div><p class="notice stat-hint">${game.s.profile.bossRecords.includes('captainBrass') ? '순찰 설계도와 첫 인장 기록이 남았습니다.' : '렌치와 회피는 처음부터 완성되어 있습니다. 조율 없이도 도전할 수 있어요.'}</p><div class="actions">${button('닫기', 'close-panel', '', 'primary')}${button('전체 무료 환급', 'refund', '', 'quiet')}</div>`, 'side');
  }
  /** Moru's parts shelf: owned elements are equipped (two at most), the rest are bought with gears one at a time. */
  function elementsPanel() {
    const { loadout, ownedElements, freeGears, history } = game.s.profile, price = game.nextElementPrice, fusion = data.combat.fusions.find(f => f.pair.every(id => loadout.includes(id)));
    const cards = data.combat.elements.map(element => {
      const owned = ownedElements.includes(element.id), picked = loadout.includes(element.id), skills = data.combat.skills.filter(skill => skill.element === element.id);
      const action = owned ? button(picked ? '✓ 장착' : '장착', 'element', `data-id="${element.id}" aria-pressed="${picked}"`, 'pick')
        : price === null ? button(ownedElements.length ? '모두 보유' : '첫 귀환 뒤 무료', 'buy-element', `data-id="${element.id}" disabled`, 'pick')
        : button(price === 0 ? '무료로 달기' : `${ico('gear')} ${price} 구매`, 'buy-element', `data-id="${element.id}" ${freeGears < price ? 'disabled' : ''}`, 'pick');
      return `<article class="reward-card ${picked ? 'picked' : ''} ${owned ? '' : 'unowned'}" style="--accent:${data.slice.presentation.colors[element.id]}">${elementIcon(element.id)}<h3>${element.name} · ${element.device}</h3><p>${element.role}</p><p>${skills.map(skill => skill.name).join('<br>')}</p>${action}</article>`;
    }).join('');
    const note = !ownedElements.length ? (history.length ? '첫 속성 부품은 모루가 무료로 달아 줍니다. 하나를 고르세요.' : '첫 원정은 렌치만으로 나갑니다. 돌아오면 모루가 첫 속성 부품을 무료로 달아 줍니다.')
      : `산 부품은 계속 남고, 원정에는 2개까지 장착합니다.${price ? ` 다음 부품은 ${ico('gear')} ${price}입니다.` : ''}`;
    return panel(`<div class="panel-header"><div><h2>모루의 속성 부품</h2></div><strong>장착 ${loadout.length} / 2</strong></div><p>${note}</p><div class="reward-grid four">${cards}</div><p>${fusion ? `융합: <strong>${fusion.name}</strong> · ${data.slice.presentation.codex.fusions[fusion.id] || fusion.effect}` : '두 속성을 장착하면 융합 기술이 열립니다.'}</p><div class="actions">${button('닫기', 'close-panel', '', 'primary')}${button('뒷마당에서 시험하기', 'practice', loadout.length ? '' : 'disabled')}</div>`, 'wide');
  }
  function describeReward(reward) {
    if (reward.kind === 'element') {
      const element = data.combat.elements.find(e => e.id === reward.id), skills = data.combat.skills.filter(s => s.element === element.id);
      return { name: element.device, art: element.id, label: game.s.profile.ownedElements.includes(element.id) ? `${element.name} 속성 모듈` : `${element.name} 속성 모듈 · 이번 원정 체험`, description: `${skills.map(s => s.name).join(' · ')}<br>${element.role}`, value: skills.map(s => `${s.totalDirectDamage} 피해 · 축전 ${s.energyCost} · ${s.cooldown}초`).join('<br>'), color: data.slice.presentation.colors[element.id], rarity: { common: '일반', rare: '희귀', special: '특제' }[reward.rarity] };
    }
    if (reward.kind === 'mod') { const mod = data.slice.mods.find(m => m.id === reward.id); return { name: mod.name, icon: ico('wrench'), label: '렌치 개조', description: mod.description, value: '이 원정에 유지 · 최대 2개' }; }
    if (reward.kind === 'skillMod') { const mod = data.slice.skillMods.find(m => m.id === reward.id), skill = data.combat.skills.find(s => s.id === mod.skill); return { name: mod.name, label: `기술 개조 · ${skill.name}`, description: mod.description, value: '이 원정에 유지', color: data.slice.presentation.colors[skill.element] }; }
    if (reward.kind === 'trait') { const trait = data.slice.elementTraits.find(t => t.id === reward.id), element = data.combat.elements.find(e => e.id === trait.element); return { name: trait.name, label: `속성 특성 · ${element.name}`, description: trait.description, value: '이 원정에 유지', color: data.slice.presentation.colors[trait.element] }; }
    if (reward.kind === 'level') { const slot = game.slots[reward.id], element = data.combat.elements.find(e => e.id === slot.element); return { name: `${element.name} 기술 조율`, icon: ico('up'), label: '기술 단계', description: '이 슬롯의 기술 두 개가 함께 강해진다.', value: `Lv.${slot.level} → ${slot.level + 1} (최대 ${data.combat.balance.skillMaxLevel}) · 직접 피해 +12%p` }; }
    if (reward.kind === 'gears') return { name: '자유 톱니 주머니', icon: ico('gear'), label: '영구 재료', description: '모루의 조율판에서 내 방식으로 성장한다.', value: `자유 톱니 +${reward.amount} · 귀환 후 유지` };
    if (reward.kind === 'heal') { const repair = data.slice.rules.healRewards.find(h => h.id === reward.id); return { name: repair.name, icon: ico('heal'), label: '수리', description: repair.description, value: `체력 ${Math.round(game.p.hp)} → ${Math.min(game.p.maxHp, Math.round(game.p.hp + repair.amount))} / ${game.p.maxHp}` }; }
    const upgrade = data.combat.balance.temporaryUpgrades.find(u => u.id === reward.id), desc = data.slice.rewards[reward.id];
    return { name: desc.name, icon: ico('spark'), label: '출력 부품', description: desc.description, value: `${reward.id === 'maxHp' ? '+' + upgrade.perRank + ' HP' : reward.id === 'killHeal' ? '처치마다 +' + upgrade.perRank + ' HP' : reward.id === 'damageReduction' ? '받는 피해 −' + Math.round(upgrade.perRank * 100) + '%' : '+' + Math.round(upgrade.perRank * 100) + '%'} · ${(game.s.run.upgrades[reward.id] || 0) + 1}/${upgrade.maxRank} 단계` };
  }
  function rewardsPanel() {
    return panel(`<h2>어떤 가능성을 조립할까요?</h2><p>이 구간의 자유 톱니와 동전은 이미 받았습니다. 부품을 하나 더 고르세요.</p><div class="reward-grid">${game.s.run.rewardChoices.map((reward, i) => {
      const info = describeReward(reward), tier = game.rewardTier(reward), replace = reward.kind === 'element' && game.slots.length >= 2;
      return `<article class="reward-card tier-${tier}" style="--accent:${info.color || '#9fae83'};--tint:${info.color ? info.color + '22' : '#e9eddc'}"><span class="rarity">${TIER_NAMES[tier]}</span>${info.art ? elementIcon(info.art) : info.icon ? `<span class="reward-icon">${info.icon}</span>` : ''}<span class="card-label">${info.label}</span><h3>${info.name}</h3><p>${info.description}</p><div class="values">${info.value}</div>${replace ? `<p class="replace-note">속성 칸이 다 찼습니다. 하나를 빼고 넣습니다.</p><div class="replace">${game.slots.map((slot, j) => button(`${data.combat.elements.find(e => e.id === slot.element).name} 빼기`, 'reward', `data-index="${i}" data-replacement="${j}"`)).join('')}</div>` : button(`${i + 1} · 선택`, 'reward', `data-index="${i}"`, 'pick')}</article>`;
    }).join('')}</div><p class="notice">속성·부품은 이 원정에만 유지됩니다. 자유 톱니는 귀환해도 남습니다.</p>`, 'wide');
  }
  function settingsPanel() {
    const keysOpen = !!$('overlay').querySelector('details.keys[open]');
    const settings = game.s.profile.settings, map = bindings();
    return panel(`<div class="panel-header"><div><h2>${onTitle ? '환경설정' : '잠시 멈춤'}</h2></div></div><div class="pause-buttons">${onTitle ? button('닫기', 'resume', '', 'primary') : `${button('이어서 움직이기', 'resume', '', 'primary')}${button('속성 · 융합 도감', 'codex')}`}</div><div class="divider"></div><div class="settings-grid"><label><input type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}> 효과음</label><label><input type="checkbox" data-setting="music" ${settings.music ? 'checked' : ''}> 배경음악</label><label class="volume">배경음악 크기 <input type="range" min="0" max="100" step="5" data-volume="musicVolume" value="${Math.round(settings.musicVolume * 100)}" aria-label="배경음악 크기"></label><label><input type="checkbox" data-setting="damageNumbers" ${settings.damageNumbers ? 'checked' : ''}> 피해 숫자</label><label><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}> 섬광 · 동작 효과 줄이기</label></div><details class="keys" ${keysOpen ? 'open' : ''}><summary>조작 키 바꾸기</summary><p>변경할 키를 누른 다음 새 키를 입력하세요. Esc는 취소합니다.</p><div class="binding-list">${Object.keys(defaultBindings).map(key => `<label class="binding">${bindingNames[key]}${button(bindingTarget === key ? '입력…' : keyName(map[key]), 'rebind', `data-key="${key}"`)}</label>`).join('')}</div><p class="notice">마우스: 좌클릭 렌치 · 우클릭 융합<br>패드: 왼쪽/오른쪽 스틱 이동·조준 · RB 렌치 · B 회피 · X/Y/LB/LT 기술 · RT 융합 · A 상호작용 · View 지도 · Menu 일시정지</p>${button('키 기본값', 'reset-bindings', '', 'quiet')}</details><div class="divider"></div><div class="actions">${button('저장 파일 내보내기', 'export')}${button('저장 파일 불러오기', 'import')}</div><input class="file-input" id="import-file" type="file" accept="application/json,.json"><p class="notice">같은 브라우저에 자동 저장됩니다. 이사하기 전에는 파일로 보관하세요.</p>${storageError ? `<p class="error">${escapeHTML(storageError)}</p>` : ''}${onTitle ? '' : `<div class="divider"></div><div class="actions leave">${button('원정 포기 · 수리점 귀환', 'abandon', game.s.run ? '' : 'disabled', 'danger')}</div>`}`, 'wide');
  }
  /** One plain sentence per move, then the numbers and what it leaves on the enemy, as small tags. */
  function codexPanel() {
    const words = data.slice.presentation.codex, element = id => data.combat.elements.find(e => e.id === id);
    const tab = (id, label) => button(label, 'codex-tab', `data-id="${id}" aria-pressed="${codexTab === id}"`, codexTab === id ? 'tab on' : 'tab');
    const status = id => `<span class="tag status"><img src="${assetUrl(STATUS_ICONS[id])}" alt="">${words.statuses[id][0]}</span>`;
    const tags = (move, statuses) => `<div class="tags"><span class="tag">피해 ${move.totalDirectDamage}</span>${move.energyCost ? `<span class="tag">축전 ${move.energyCost}</span>` : ''}<span class="tag">대기 ${move.cooldown}초</span>${statuses.map(status).join('')}</div>`;
    const move = (m, line, statuses, extra = '') => `<div class="codex-move"><img class="move-icon" src="art/ui/skill-icons/${m.id}.png" alt=""><div><h4>${m.name}${extra}</h4><p>${line}</p>${tags(m, statuses)}</div></div>`;
    const elements = data.combat.elements.map(e => `<article class="codex-entry" style="--accent:${data.slice.presentation.colors[e.id]}"><h3>${elementIcon(e.id, 'codex-icon')}${e.name} · ${e.device}</h3>${data.combat.skills.filter(s => s.element === e.id).map(s => move(s, words.skills[s.id], [ELEMENT_STATUS[e.id]])).join('')}</article>`).join('');
    const fusions = data.combat.fusions.map(f => `<article class="codex-entry"><div class="pair">${f.pair.map(id => `${elementIcon(id, 'codex-icon')}${element(id).name}`).join('<b>+</b>')}</div>${move(f, words.fusions[f.id], f.pair.map(id => ELEMENT_STATUS[id]), game.s.profile.discoveredFusions.includes(f.id) ? ' <small>✓ 써 봄</small>' : '')}</article>`).join('');
    const legend = `<div class="status-legend">${Object.entries(words.statuses).map(([id, [name, text]]) => `<p><img src="${assetUrl(STATUS_ICONS[id])}" alt=""><strong>${name}</strong> ${text}</p>`).join('')}</div>`;
    const how = isTouch ? '융합 버튼' : '우클릭';
    return panel(`<div class="panel-header"><div><h2>속성과 융합의 기록</h2></div>${button('닫기', 'resume')}</div><div class="codex-tabs">${tab('elements', '속성 4')}${tab('fusions', '융합 6')}</div><div class="codex-list">${codexTab === 'fusions' ? fusions : elements}</div>${codexTab === 'fusions' ? `<p class="notice">장착한 두 속성의 융합 하나를 ${how}으로 씁니다. 축전은 렌치로 때리면 찹니다.</p>` : legend}`, 'wide');
  }
  const stopIcon = (room, i) => (room.kind === 'shop' ? ico('coin') : room.boss ? ico('crown') : i + 1);
  /** Who waits in a stop, named once each, so the map can say what an area is like before walking in. */
  function stopFoes(room) {
    if (room.boss) return [data.combat.bosses.find(b => b.id === room.boss)?.name || room.short];
    return [...new Set((room.waves || []).flat())].map(type => data.slice.enemies[type].name);
  }
  /** The region drawn like a world map: each stop is a small view of its own art, joined by the road walked in order. */
  function mapPanel() {
    const s = game.s, rooms = data.slice.rooms, node = s.run?.node ?? -1;
    const picked = mapPick ?? (s.run ? rooms[node]?.id : 'town');
    const stops = [{ id: 'town', icon: 'home', label: HOME_NAME, state: s.run ? 'done' : 'current', kind: 'town' },
      ...rooms.map((room, i) => ({ id: room.id, icon: room.kind === 'shop' ? 'coin' : room.boss ? 'crown' : i + 1, label: room.short, state: i === node ? 'current' : i < node ? 'done' : 'ahead', kind: room.boss ? 'boss' : room.kind === 'shop' ? 'shop' : '' }))];
    const index = rooms.findIndex(room => room.id === picked), room = rooms[index];
    const detail = room
      ? `<strong>${stopIcon(room, index)} ${roomTitle(room)}</strong><span>${room.description}</span>${room.kind === 'shop' ? '<em>동전으로 수리와 부품을 삽니다.</em>' : `<em>${room.boss ? '보스' : '등장'}: ${stopFoes(room).join(', ')}</em>`}`
      : `<strong>${ico('home')} ${HOME_NAME}</strong><span>모루의 수리점이 있는 광장입니다. 남쪽 큰길이 웃음거리로 이어집니다.</span><em>원정 출발지</em>`;
    return panel(`<div class="panel-header"><div><h2>태엽 섬 지도</h2></div>${button('닫기', 'resume')}</div><div class="atlas">${worldMapSvg(stops, picked)}</div><p class="atlas-detail">${detail}</p><p class="notice atlas-legend"><span>번호를 누르면 설명이 보입니다</span><span>${ico('coin')} 쉼터</span><span>${ico('crown')} 보스</span><span><b>?</b> 준비 중</span>${isTouch ? '' : `<span>${keyName(bindings().map)} 키로 닫기</span>`}</p>`, 'atlas-panel');
  }
  function renderOverlay(force = false) {
    const s = game.s, mode = screen || (game.village && !s.panel ? 'walking' : s.mode);
    const key = `${mode}:${s.run?.node}`;
    if (!force && key === overlayKey) return;
    overlayKey = key;
    let html = '';
    if (mode === 'loadError') html = panel(`<h2>저장 파일을 확인해 주세요.</h2><p class="error">${escapeHTML(saveProblem(loadError))}</p><p>기존 저장을 보존하고 있습니다. 먼저 원본을 내보내거나 다른 저장 파일을 불러올 수 있습니다.</p><div class="actions">${button('기존 저장 원본 내보내기', 'export-raw')}${button('파일 불러오기', 'import')}${button('새 게임으로 교체', 'confirm-new', '', 'danger')}</div><input class="file-input" id="import-file" type="file" accept="application/json,.json">`, 'compact');
    if (mode === 'confirmNew') html = panel(`<h2>처음부터 다시 할까요?</h2><p>이 브라우저에 저장된 조율, 자유 톱니, 기록이 지워집니다. 파일로 내보낸 저장은 그대로 남습니다.</p><div class="actions">${button('돌아가기', 'cancel-new')}${button('지우고 새로 시작', 'new-game', '', 'danger')}</div>`, 'compact');
    if (mode === 'confirmAbandon') html = panel(`<h2>원정을 포기할까요?</h2><p>모은 자유 톱니와 기록은 작업대에 남습니다. 장착 속성·임시 부품·동전은 잃습니다.</p><div class="actions">${button('돌아가기', 'cancel-abandon')}${button('원정 포기', 'abandon-confirmed', '', 'danger')}</div>`, 'compact');
    if (mode === 'debug') html = panel(`<h2>어디로 갈까요?</h2><div class="actions">${button('튜토리얼부터 시작', 'debug-tutorial', '', 'primary')}${button('닫기', 'resume')}</div><div class="debug-rooms">${data.slice.rooms.map((room, i) => `<button class="${s.run?.node === i ? 'current' : ''}" data-action="debug-room" data-room="${i}"><small>${String(i + 1).padStart(2, '0')}</small>${room.name}</button>`).join('')}</div><p class="notice">영구 재화는 유지됩니다. 이동하면 지금 방의 진행은 사라지고, 보상은 실제 저장에 쌓입니다.</p>`, 'compact');
    if (mode === 'introDeath') html = panel(`<h2>다시 일어나 볼까요?</h2><p>아직 수리점에 등록하기 전입니다.<br>폐기장 전투의 시작 지점에서 바로 다시 시도합니다.</p><div class="actions">${button('렌치를 다시 잡기', 'intro', '', 'primary')}</div>`, 'compact');
    if (mode === 'hub') html = s.panel === 'elements' ? elementsPanel() : tuningPanel();
    if (mode === 'reward') html = rewardsPanel();
    if (mode === 'shop') html = panel(`<h2>이것도, 아직 쓸 만하지.</h2><p>동전은 이번 원정에만 쓰입니다. 필요한 것부터 골라요.</p><div class="reward-grid">${['heal', 'skillLevel', 'persistentGears'].map(id => {
      const item = data.progression.economy.shop.find(i => i.id === id), sold = item.oncePerShop && s.run.shopBought.includes(id);
      const unavailable = sold || s.run.coins < item.cost || (id === 'heal' && game.p.hp >= game.p.maxHp) || (id === 'skillLevel' && !game.slots.some(slot => slot.level < data.combat.balance.skillMaxLevel));
      const reason = sold ? '구매 완료' : id === 'heal' && game.p.hp >= game.p.maxHp ? '체력 가득' : id === 'skillLevel' && !game.slots.some(slot => slot.level < data.combat.balance.skillMaxLevel) ? '모두 최고 단계' : s.run.coins < item.cost ? '동전 부족' : '구매';
      return `<article class="reward-card"><span class="reward-icon">${ico({ heal: 'heal', skillLevel: 'up', persistentGears: 'gear' }[id])}</span><h3>${{ heal: '응급 수리', skillLevel: '정밀 조율', persistentGears: '자유 톱니' }[id]}</h3><p>${{ heal: `HP ${item.amount} 회복 · 상점당 한 번`, skillLevel: '최고 단계가 아닌 첫 속성의 기술 단계 +1', persistentGears: `자유 톱니 ${item.amount}개 · 귀환해도 남음 · 상점당 한 번` }[id]}</p><div class="values">${ico('coin')} ${item.cost} 동전</div>${button(reason, 'shop-buy', `data-id="${id}" ${unavailable ? 'disabled' : ''}`, 'pick')}</article>`;
    }).join('')}</div><div class="actions">${button('닫기', 'close-panel', '', 'primary')}</div>`, 'side shop');
    if (mode === 'unwind') {
      const brass = game.room.boss === 'captainBrass', verb = brass ? '태엽 감아 깨우기' : '회로 뽑기';
      html = panel((brass ? `<h2>일어나, 이번엔 네 박자로.</h2><p>멈춘 태엽을 한 바퀴씩 감아 줍니다.<br>머릿속에서 북을 치던 회로는 다시 넣지 않습니다.</p>` : `<h2>이제 무엇을 주울지는 네가 정해.</h2><p>로코의 집게에 꽂힌 명령 회로를 뽑아냅니다.<br>모으는 손은 남고, 고르는 명령만 사라집니다.</p>`)
        + `<div class="actions">${button(isTouch ? verb : `${keyName(bindings().interact)} · ${verb}`, 'unwind', '', 'primary')}</div>`, 'compact');
    }
    if (mode === 'complete') html = panel(`<p class="tbc">To be continued…</p><h2>1장 · 웃음거리 끝</h2><p>브라스의 태엽을 다시 감았습니다. 순찰 설계도와 첫 인장이 기록됩니다.<br>다음 이야기는 무음공장에서 이어집니다.</p><div class="result-stats"><span><b>${data.slice.rooms.length} / ${data.slice.rooms.length}</b>통과한 구간</span><span><b>${formatTime(s.run.elapsed)}</b>움직인 시간</span><span><b>${s.run.baseGears}</b>기본 자유 톱니</span></div><div class="actions">${button('모루의 수리점으로', 'return-complete', '', 'primary')}</div><p class="notice">수리점으로 돌아가 원정을 다시 떠날 수 있습니다.</p>`, 'compact ending');
    if (mode === 'returned') {
      const result = s.result;
      html = panel(`<h2>${result.reason === 'defeat' ? '고치면 돼. 버리지 말고.' : result.reason === 'clear' ? '네 걸음으로 돌아왔구나.' : '돌아오는 것도 네 선택이지.'}</h2><p>${result.reason === 'defeat' ? '안전핀이 코어를 지켰고, 모루가 같은 몸을 다시 조립했습니다.' : '확보한 자유 톱니와 기록은 작업대에 남았습니다.'}<br>장착 속성·임시 부품·동전·축전은 다음 원정에서 새로 시작합니다.</p><div class="result-stats"><span><b>${result.node} / ${data.slice.rooms.length}</b>도달 구간</span><span><b>${formatTime(result.elapsed)}</b>원정 시간</span><span><b>+${result.baseGears}</b>기본 자유 톱니</span></div>${result.bonus ? `<p>첫 귀환 보너스 <strong>${ico('gear')} +${result.bonus}</strong> · 한 번만 지급</p>` : ''}<div class="actions">${button('마을로 나가기', 'acknowledge', '', 'primary')}</div>`, 'side');
    }
    if (mode === 'pause') html = settingsPanel();
    if (mode === 'codex') html = codexPanel();
    if (mode === 'map') html = mapPanel();
    if (html && storageError && mode !== 'pause') html = html.replace('</section>', `<p class="error">${escapeHTML(storageError)}</p></section>`);
    // Re-rendering a sheet must not throw the keyboard back to its first button.
    const was = document.activeElement?.dataset, same = was?.action && ['action', 'key', 'id', 'row'].filter(name => was[name]).map(name => `[data-${name}="${was[name]}"]`).join('');
    $('overlay').innerHTML = html;
    if (onTitle) $('title').inert = !!html;
    // Headings are cut to hard pixels like the title, so every sheet reads as the same form.
    for (const heading of $('overlay').querySelectorAll('h2')) { heading.setAttribute('aria-label', heading.textContent); heading.replaceChildren(pixelText(heading.textContent, 15, '#2b3345')); }
    if (html) { clearInput(); ((same && $('overlay').querySelector(`${same}:not(:disabled)`)) || $('overlay').querySelector('button:not(:disabled)'))?.focus({ preventScroll: true }); }
  }

  function lessonHint() {
    const keys = bindings(), lesson = game.tutorial, moveWord = isTouch ? '왼쪽을 끌어' : `${['up', 'left', 'down', 'right'].map(key => keyName(keys[key])).join(' ')} 키로`;
    if (!screen && game.s.mode === 'route' && game.s.run.node === 0) return '노란 표시로 걸어 나가세요';
    if (!screen && game.s.mode === 'combat' && game.bossWarning) return game.bossWarning;
    if (!screen && game.s.mode === 'practice') return '허수아비에게 기술을 써 보세요 · 노란 표시로 나가면 마을로 돌아갑니다';
    if (screen || !['intro', 'registration'].includes(game.s.mode) || game.wakeProgress !== null) return '';
    return {
      walk: `${moveWord} 노란 표시까지 걸어가세요`,
      attack: `${isTouch ? '렌치 버튼으로' : '좌클릭으로'} 경비를 때리세요 ${lesson.state?.hits ?? 0} / ${HITS_TO_LEARN}`,
      dodge: `경비 머리 위에 ! 가 뜨면 ${isTouch ? '회피 버튼으로' : `${keyName(keys.dodge)} 키로`} 피하세요`,
      door: '노란 표시로 걸어 나가세요',
      moru: '노란 화살표를 따라 모루에게 걸어가세요'
    }[lesson.step] || '';
  }
  function hudSlots() {
    const keys = bindings(), skills = game.skillSlots;
    return [
      { key: '좌', icon: 'wrench' },
      ...[0, 1, 2, 3].map(i => ({ key: keyName(keys['skill' + i]), skill: skills[i]?.skill, level: skills[i]?.slot.level })),
      { key: '우', skill: game.fusion, fusion: true },
      { key: keyName(keys.dodge).replace('Space', 'SP'), icon: 'dodge', dodge: true }
    ];
  }
  /** Health fractions where a boss changes phase: where its later patterns unlock, and where Brass adds a march lane. */
  function bossPhaseMarks(ai) {
    const marks = (ai.phasePatterns || []).map(p => p.below).concat(ai.phaseTwoHpFraction ?? []);
    return [...new Set(marks.filter(at => at > 0 && at < 1))].sort((a, b) => b - a);
  }
  function updateHUD() {
    const s = game.s, p = game.p, maxEnergy = data.combat.player.maxEnergy, slots = hudSlots();
    $('hp-fill').style.width = `calc(${Math.max(0, p.hp / p.maxHp) * 100}% - 4px)`;
    $('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('energy-fill').style.width = `calc(${p.energy / maxEnergy * 100}% - 4px)`;
    $('energy-text').textContent = `축전 ${Math.floor(p.energy)}`;
    $('gears').textContent = s.profile.freeGears;
    // The boss bar: shown while a boss is in the room, marked where each of its phases begins.
    const boss = s.enemies.find(e => e.boss && e.hp > 0);
    $('boss-bar').hidden = !boss; $('toast').classList.toggle('below-boss', !!boss);
    if (boss) {
      if ($('boss-bar').dataset.id !== boss.type) {
        $('boss-bar').dataset.id = boss.type;
        $('boss-name').textContent = data.combat.bosses.find(b => b.id === boss.type)?.name || boss.name;
        $('boss-marks').innerHTML = bossPhaseMarks(data.slice.bossAI[boss.type]).map(at => `<i style="left:calc(3px + (100% - 6px) * ${at})"></i>`).join('');
      }
      $('boss-fill').style.width = `calc((100% - 6px) * ${Math.max(0, boss.hp / boss.maxHp)})`;
      const breaking = boss.breaking, rule = breaking && data.slice.bossAI[boss.type].phaseBreaks[breaking.index];
      $('boss-bar').classList.toggle('shielded', !!breaking);
      $('boss-note').textContent = breaking ? (breaking.failAt !== null ? '파훼 실패 · 폭발!' : `보호막 · ${breaking.kind === 'cans' ? `깡통 ${breaking.fed}/${rule.cans}` : breaking.kind === 'drums' ? (breaking.phase === 'show' ? '북 순서 보는 중' : `북 ${breaking.next}/${breaking.order.length}`) : `깃발 병정 ${breaking.soldiers.filter(x => x.flag && x.down).length}/${rule.flags}`} · ${Math.max(0, Math.ceil(breaking.until - s.time))}초`) : boss.vulnerableUntil > s.time ? '과부하 · 무방비' : '';
    }
    $('coins').textContent = s.run?.coins || 0;
    const slotKey = JSON.stringify(slots.map(({ key, skill, level, icon }) => [key, skill?.id, level, icon]));
    if ($('skills').dataset.key !== slotKey) {
      $('skills').dataset.key = slotKey;
      $('skills').innerHTML = slots.map(slot => {
        const art = slot.icon || slot.skill?.id;
        return `<div class="slot hud-tag ${art ? '' : 'empty'}">${art ? `<img src="art/ui/skill-icons/${art}.png" alt="">` : ''}<kbd>${slot.key}</kbd>${slot.level ? `<span class="lv">${slot.level}</span>` : ''}<div class="cool"></div><div class="left"></div></div>`;
      }).join('');
    }
    [...$('skills').children].forEach((element, i) => {
      const slot = slots[i], { skill } = slot, until = slot.dodge ? p.dodgeReady : slot.fusion ? p.fusionReady : skill ? p.cooldowns[skill.id] || 0 : 0;
      const total = slot.dodge ? data.combat.player.dodge.cooldown : skill?.cooldown || 1, remaining = Math.max(0, until - s.time);
      element.querySelector('.cool').style.height = `${Math.min(1, remaining / total) * 100}%`;
      element.querySelector('.left').textContent = remaining > 0 ? remaining.toFixed(1) : '';
      element.classList.toggle('ready', !!slot.fusion && !!skill && !remaining && p.energy >= skill.energyCost);
      element.classList.toggle('short', !slot.fusion && !!skill?.energyCost && p.energy < skill.energyCost);
    });
    const resetting = game.s.practice?.resetCooldowns;
    $('practice-reset').hidden = game.s.mode !== 'practice';
    $('practice-reset').textContent = `T · 대기시간 초기화 ${resetting ? '켜짐' : '꺼짐'}`;
    $('practice-reset').classList.toggle('on', !!resetting);
    if (isTouch) touch.update(slots.map(slot => {
      const { skill } = slot, until = slot.dodge ? p.dodgeReady : slot.fusion ? p.fusionReady : skill ? p.cooldowns[skill.id] || 0 : 0;
      const total = slot.dodge ? data.combat.player.dodge.cooldown : skill?.cooldown || 1, remaining = Math.max(0, until - s.time);
      return { art: slot.icon || skill?.id, share: Math.min(1, remaining / total), left: remaining > 0 ? Math.ceil(remaining) : '', ready: !!slot.fusion && !!skill && !remaining && p.energy >= skill.energyCost, short: !slot.fusion && !!skill?.energyCost && p.energy < skill.energyCost };
    }));
    const hint = lessonHint();
    if ($('hint').textContent !== hint) $('hint').textContent = hint;
    $('hint').hidden = !hint;
    const notice = s.notices.at(-1);
    $('toast').classList.toggle('visible', !!notice && game.onFoot);
    $('toast').textContent = notice?.text || '';
  }

  async function action(target) {
    const name = target.dataset.action, d = target.dataset;
    openAudio();
    if (name === 'debug-tutorial') { leaveTitle(); game.debugRestartTutorial(); resume(); }
    if (name === 'debug-room') { leaveTitle(); game.debugJump(Number(d.room)); resume(); }
    if (name === 'intro') game.beginIntro();
    if (name === 'register') game.register();
    if (name === 'close-panel') game.closePanel();
    let bought = null;
    if (name === 'element') { game.toggleElement(d.id); sfx('equip'); }
    if (name === 'buy-element') bought = game.buyElement(d.id);
    if (name === 'practice') { game.closePanel(); game.enterPractice(); }
    if (name === 'tune-buy') { bought = game.tune(d.row, 'buy'); if (bought) sfx('tune'); }
    if (name === 'refund') game.tune(null, 'refund');
    if (name === 'reward') game.chooseReward(Number(d.index), d.replacement === undefined ? null : Number(d.replacement));
    if (name === 'shop-buy') bought = game.buyShop(d.id);
    if (name === 'unwind') game.unwind();
    if (name === 'return-complete') game.returnToHub('clear');
    if (name === 'acknowledge') game.acknowledgeReturn();
    if (name === 'abandon') screen = 'confirmAbandon';
    if (name === 'cancel-abandon') screen = 'pause';
    if (name === 'abandon-confirmed') { game.returnToHub(game.s.mode === 'complete' ? 'clear' : 'abandon'); resume(); }
    if (name === 'resume') resume();
    if (name === 'codex') pause('codex');
    if (name === 'codex-tab') codexTab = d.id;
    if (name === 'map-stop') mapPick = d.id;
    if (name === 'rebind') bindingTarget = d.key;
    if (name === 'reset-bindings') { game.s.profile.settings.bindings = {}; game.save(); }
    if (name === 'export') { game.save(); saveDownload(); }
    if (name === 'export-raw') saveDownload(rawSave, 'recovery');
    // Purchases answer with coins or a refusal; picking a reward and equipping have their own sounds; every other button clicks.
    if (bought !== null) sfx(bought ? 'buy' : 'deny'); else if (!['reward', 'element'].includes(name)) sfx('click');
    if (name === 'import') { $('import-file').click(); return; }
    if (name === 'confirm-new') screen = 'confirmNew';
    if (name === 'cancel-new') { if (onTitle) { resume(); return; } screen = 'loadError'; }
    if (name === 'new-game') { const fromTitle = onTitle; game.state = new Game(data).s; saveBlocked = false; loadError = ''; lastAutosave = game.s.time; game.save(); if (fromTitle) { playOpening(true); return; } resume(); }
    renderOverlay(true); updateHUD();
    if (game.onFoot && !screen) $('game').focus({ preventScroll: true });
  }
  $('overlay').addEventListener('click', e => { const target = e.target.closest('[data-action]'); if (target && !target.disabled) action(target); });
  $('overlay').addEventListener('input', e => { if (e.target.dataset.volume) game.s.profile.settings[e.target.dataset.volume] = Number(e.target.value) / 100; });
  $('overlay').addEventListener('change', async e => {
    const setting = e.target.dataset.setting;
    if (setting) { game.s.profile.settings[setting] = e.target.checked; game.save(); return; }
    if (e.target.dataset.volume) { game.s.profile.settings[e.target.dataset.volume] = Number(e.target.value) / 100; game.save(); return; }
    if (e.target.id === 'import-file' && e.target.files[0]) {
      try {
        const state = decodeSave(await e.target.files[0].text(), data);
        game.state = state; saveBlocked = false; loadError = ''; game.save(); lastAutosave = state.time; resume(); renderOverlay(true); updateHUD();
      } catch (error) { const p = document.createElement('p'); p.className = 'error'; p.textContent = '불러오기 실패: ' + saveProblem(error.message); $('overlay').querySelector('.panel').append(p); }
    }
  });
  // The row under the pointer or the keyboard explains itself in the line below the list.
  for (const type of ['focusin', 'pointerover']) $('overlay').addEventListener(type, e => { const row = e.target.closest?.('.stat-row'), hint = $('overlay').querySelector('.stat-hint'); if (row && hint) hint.textContent = row.dataset.tip; });
  $('practice-reset').addEventListener('click', () => { game.togglePracticeReset(); $('game').focus({ preventScroll: true }); });
  $('fullscreen').addEventListener('click', () => { $('app').requestFullscreen?.().catch(() => {}); });
  $('hud-map').addEventListener('click', () => { if (!saveBlocked && !screen) pause('map'); });
  $('hud-menu').addEventListener('click', () => { if (!saveBlocked && !screen) pause(); });
  for (const [id, icon] of [['fullscreen', 'fullscreen'], ['hud-map', 'map'], ['hud-menu', 'gear']]) $(id).insertAdjacentHTML('afterbegin', TOOL_ICONS[icon]);
  // Drawn icons rather than ⚙ and ◈, which phones set at different sizes (or as colour emoji).
  for (const span of document.querySelectorAll('.hud-wallet [data-icon]')) span.insertAdjacentHTML('afterbegin', TOOL_ICONS[span.dataset.icon]);

  function interact() {
    if (screen) return;
    if (game.village) { if (game.s.panel) game.closePanel(); else if (game.nearbyNpc) talkToNpc(game.nearbyNpc); }
    else if (game.s.mode === 'unwind') game.unwind();
    else if (game.s.mode === 'returned') game.acknowledgeReturn();
    else if (game.s.mode === 'complete') game.returnToHub('clear');
    renderOverlay();
  }
  /** A sheet owns the keyboard: Tab and arrows walk its controls, and game keys stay out of Space and Enter. */
  function sheetKeys(e, sheet) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Tab: e.shiftKey ? -1 : 1 }[e.key];
    if (step) {
      e.preventDefault();
      const controls = [...sheet.querySelectorAll('button:not(:disabled), input[type=checkbox], summary')].filter(control => control.matches('summary') || !control.closest('details:not([open])')), at = controls.indexOf(document.activeElement);
      controls[at < 0 ? 0 : (at + step + controls.length) % controls.length]?.focus({ preventScroll: true });
      return true;
    }
    if (e.key !== ' ' && e.key !== 'Enter') return false;
    // A key still held from the fight must not press whatever the sheet focused.
    if (e.repeat) e.preventDefault();
    return document.activeElement?.closest('.panel') === sheet;
  }
  document.addEventListener('keydown', e => {
    if (bindingTarget) {
      e.preventDefault();
      if (e.code !== 'Escape' && !['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) {
        const map = bindings(), old = map[bindingTarget], duplicate = Object.keys(map).find(key => map[key] === e.code && key !== bindingTarget);
        game.s.profile.settings.bindings[bindingTarget] = e.code;
        if (duplicate) game.s.profile.settings.bindings[duplicate] = old;
        game.save();
      }
      bindingTarget = null; renderOverlay(true); return;
    }
    if (screen === 'cinematic') return;
    if (screen === 'talk') {
      const keys = bindings();
      if (e.repeat) return;
      if (e.code === 'Escape') { e.preventDefault(); talkBox.skip(); }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); talkBox.move(e.code === 'ArrowUp' ? -1 : 1); }
      if (['Space', 'Enter', keys.interact, keys.skill1].includes(e.code)) { e.preventDefault(); talkBox.advance(); }
      return;
    }
    const sheet = $('overlay').querySelector('.panel');
    if (sheet && sheetKeys(e, sheet)) return;
    if (e.code === 'Escape') { e.preventDefault(); if (e.repeat || saveBlocked || screen === 'title') return; if (screen) resume(); else if (game.s.panel) { game.closePanel(); renderOverlay(); } else pause(); return; }
    if (e.code === 'F9') { e.preventDefault(); if (e.repeat || saveBlocked) return; if (screen === 'debug') resume(); else pause('debug'); return; }
    if (screen === 'title') return;
    const map = bindings(), key = Object.keys(map).find(key => map[key] === e.code);
    if (!key && e.code === 'KeyT' && !e.repeat && !screen) game.togglePracticeReset();
    if (!key) return;
    e.preventDefault();
    if (e.repeat) return;
    if (key === 'codex') { if (!saveBlocked) screen === 'codex' ? resume() : pause('codex'); return; }
    if (key === 'map') { if (!saveBlocked) screen === 'map' ? resume() : pause('map'); return; }
    if (screen) return;
    if (key === 'interact' || (game.village && key === 'skill1')) { interact(); return; }
    if (!game.onFoot) {
      if (game.s.mode === 'reward' && /^Digit[123]$/.test(e.code)) game.chooseReward(Number(e.code.at(-1)) - 1);
      return;
    }
    openAudio(); held.add(e.code);
    if (key === 'dodge') pending.dodge = true;
    if (key.startsWith('skill')) pending.skill = Number(key.at(-1));
  });
  document.addEventListener('keydown', e => {
    if (screen || e.repeat || !/^Digit[123]$/.test(e.code) || game.s.mode !== 'reward') return;
    const reward = game.s.run.rewardChoices[Number(e.code.at(-1)) - 1];
    if (reward?.kind === 'element' && game.slots.length >= 2) return;
    game.chooseReward(Number(e.code.at(-1)) - 1); renderOverlay(true);
  });
  document.addEventListener('keyup', e => held.delete(e.code));
  function mousePosition(e) {
    const rect = $('game').getBoundingClientRect(), scale = Math.min(rect.width / 1120, rect.height / 640);
    pointer = { x: (e.clientX - rect.left - (rect.width - 1120 * scale) / 2) / scale / PIXELS_PER_UNIT + renderer.camera.x, y: (e.clientY - rect.top - (rect.height - 640 * scale) / 2) / scale / PIXELS_PER_UNIT + renderer.camera.y };
    renderer.pointer = pointer;
  }
  $('game').addEventListener('pointermove', e => { if (!isTouch) mousePosition(e); });
  $('game').addEventListener('pointerdown', e => { if (!(game.active || game.leaving) || isTouch) return; e.preventDefault(); openAudio(); mousePosition(e); $('game').focus({ preventScroll: true }); if (e.button === 0) mouseHeld = true; if (e.button === 2) pending.fusion = true; });
  document.addEventListener('pointerup', () => mouseHeld = false);
  $('game').addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { clearInput(); if (game.active && screen !== 'talk') pause(); game.save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.active && screen !== 'talk') { pause(); game.save(); } });
  window.addEventListener('pagehide', () => game.save());
  window.addEventListener('beforeunload', () => game.save());

  function pollGamepad() {
    const pad = navigator.getGamepads?.().find(p => p?.connected);
    if (!pad) { gamepadLast = []; return null; }
    const edge = index => pad.buttons[index]?.pressed && !gamepadLast[index];
    if (screen === 'cinematic') { gamepadLast = pad.buttons.map(b => b.pressed); return null; }
    if (screen === 'talk') {
      if (edge(12) || edge(14)) talkBox.move(-1);
      if (edge(13) || edge(15)) talkBox.move(1);
      if (edge(0)) talkBox.advance();
      if (edge(1)) talkBox.skip();
      gamepadLast = pad.buttons.map(b => b.pressed); return null;
    }
    if (screen === 'title') {
      if (edge(12) || edge(14)) title.move(-1);
      if (edge(13) || edge(15)) title.move(1);
      if (edge(0)) title.activate();
      gamepadLast = pad.buttons.map(b => b.pressed); return null;
    }
    if (edge(9)) { if (screen) resume(); else pause(); }
    if (edge(8) && !saveBlocked) { if (screen === 'map') resume(); else pause('map'); }
    if (!screen && edge(0)) {
      if (game.active) interact();
      else if (game.s.mode === 'introDeath') game.beginIntro();
      else if (game.s.mode === 'reward') { const focused = document.activeElement; if (focused?.matches('[data-action="reward"]')) focused.click(); }
      else interact();
    }
    // D-pad navigation also reaches replacement choices and shop items.
    if (!game.active && !screen && [12, 13, 14, 15].some(edge)) {
      const buttons = [...$('overlay').querySelectorAll('button:not(:disabled)')], current = buttons.indexOf(document.activeElement);
      const direction = edge(12) || edge(14) ? -1 : 1;
      buttons[(current + direction + buttons.length) % buttons.length]?.focus();
    }
    const x = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0, y = Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : 0;
    if (Math.hypot(pad.axes[2] || 0, pad.axes[3] || 0) > 0.25) pointer = { x: game.p.x + pad.axes[2] * 7, y: game.p.y + pad.axes[3] * 7 };
    const result = { x, y, basic: !!pad.buttons[5]?.pressed, dodge: edge(1), fusion: edge(7), skill: edge(2) ? 0 : edge(3) ? 1 : edge(4) ? 2 : edge(6) ? 3 : undefined };
    gamepadLast = pad.buttons.map(b => b.pressed); return result;
  }

  let lastTime = performance.now(), accumulator = 0, bellWasRinging = false, lastChargeAt = -1, lastBossTellAt = -1;
  function frame(now) {
    const delta = Math.min(0.1, (now - lastTime) / 1000); lastTime = now; accumulator += delta;
    bringPlaceForward();
    if (game.s.mode === 'opening' && !screen) playOpening(false);
    if (game.tutorial.readyToRegister && !screen) meetMoru();
    const bellRinging = !!renderer.npcDirector?.stopped;
    if (bellRinging && !bellWasRinging) toll();
    bellWasRinging = bellRinging;
    if (game.s.mode === 'registration' && game.tutorial.step === 'town' && bellRinging) game.tutorial.heardBell();
    if (!screen && game.tutorial.takeCall()) moruCalls();
    const boss = game.room?.boss;
    // After Brass, F2 says what the title means: the spring stays, but who winds it changes.
    if (!screen && game.s.mode === 'complete' && !game.s.profile.bossTalks?.includes('ending')) playEnding();
    if (!screen && game.s.mode === 'combat' && BOSS_TALKS[boss] && !game.s.profile.bossTalks?.includes(boss) && game.s.enemies.some(e => e.boss && e.hp > 0)) meetBoss(boss);
    if (game.s.mode === 'intro' && !screen && game.tutorial.takeAwakening()) talk('awakening');
    const pad = pollGamepad(), map = bindings();
    if (isTouch) { touch.show(game.onFoot && !screen, !!game.nearbyNpc); pointer = autoAim(game.p, game.s.enemies); }
    if (pad?.dodge) pending.dodge = true;
    if (pad?.fusion) pending.fusion = true;
    if (pad?.skill !== undefined) pending.skill = pad.skill;
    while (accumulator >= 1 / 60) {
      // A landed hit holds the rules still for a few frames; input pressed meanwhile waits for the next step.
      if (hitstop > 0) { hitstop -= 1 / 60; accumulator -= 1 / 60; continue; }
      const input = screen === 'talk' ? {} : { x: Number(held.has(map.right)) - Number(held.has(map.left)) + (pad?.x || 0) + (touch?.move.x || 0), y: Number(held.has(map.down)) - Number(held.has(map.up)) + (pad?.y || 0) + (touch?.move.y || 0), aim: pointer, basic: mouseHeld || pad?.basic || touch?.attacking, ...pending };
      game.update(1 / 60, input); pending = {}; accumulator -= 1 / 60; feelHits();
    }
    if (game.s.time - lastAutosave >= 5) { game.save(); lastAutosave = game.s.time; }
    // Every ordinary enemy's wind-up gets the same short ping, once per tell.
    const charging = game.s.enemies.find(e => !e.boss && e.hp > 0 && e.tell && e.tell.started > lastChargeAt);
    if (charging) { lastChargeAt = Math.max(...game.s.enemies.filter(e => !e.boss && e.tell).map(e => e.tell.started)); sfx('tell', () => beep(880, 0.1, 0.015)); }
    const bossTell = game.s.enemies.find(e => ['bell', 'alarm'].includes(e.tell?.type) && e.tell.started > lastBossTellAt);
    if (bossTell) { lastBossTellAt = bossTell.tell.started; if (bossTell.tell.type === 'bell') toll(); else beep(660, 0.25, 0.04); }
    // The swing itself is only air; what it hits is voiced by feelHits.
    const swing = game.s.effects.findLast(f => f.type === 'swing');
    if (swing && swing.id !== lastSoundId) { lastSoundId = swing.id; sfx(swing.phase === 2 ? 'swingHeavy' : 'swing', () => noise(0.07, 0.035, swing.phase === 2 ? 600 : 900, 0.7)); }
    playMusic();
    renderer.talkKey = isTouch ? '▸' : keyName(map.skill1); renderer.talking = screen === 'talk'; renderer.render(delta); $('minimap').hidden = onTitle || !renderer.drawMinimap($('minimap')); document.body.classList.toggle('has-minimap', !$('minimap').hidden); renderOverlay(); updateHUD(); requestAnimationFrame(frame);
  }
  const talkBox = new DialogueBox($('dialogue'), data.dialogue, { reducedMotion, skipLabel: isTouch ? '건너뛰기 ▸▸' : 'Esc 건너뛰기' });
  $('dialogue').addEventListener('pointerdown', e => { openAudio(); if (e.target.closest('.talk-skip')) talkBox.skip(); else if (!e.target.closest('button')) talkBox.advance(); });
  const title = new TitleScreen($('title'), {
    onNew: startNew,
    onLoad: () => { openAudio(); leaveTitle(); resume(); },
    onSettings: () => { screen = 'pause'; renderOverlay(true); },
    onThud: () => { openAudio(); const paused = game.s.paused; game.s.paused = false; beep(70, 0.2, 0.09); game.s.paused = paused; },
    reducedMotion
  });
  if (isTouch) {
    const skillPress = { skill0: 0, skill1: 1, skill2: 2, skill3: 3 };
    touch = new TouchControls($('touch'), name => {
      openAudio();
      if (name === 'dodge') pending.dodge = true;
      else if (name === 'fusion') pending.fusion = true;
      else if (name in skillPress) pending.skill = skillPress[name];
      else if (name === 'interact') interact();
      else if (name === 'menu') { if (!saveBlocked) pause(); }
      else if (name === 'map' && !saveBlocked) pause('map');
      else if (name === 'fullscreen') $('app').requestFullscreen?.().catch(() => {});
    });
    document.addEventListener('pointerdown', openAudio, { once: true });
  }
  if (!loadError) openTitle();
  renderOverlay(true); updateHUD(); requestAnimationFrame(frame);
  // The loading card stays until the title's paper form is drawn, so nobody sees an empty frame.
  await Promise.all([title.ready.catch(() => {}), playerSprites]);
  finishBoot();
} catch (error) {
  finishBoot();
  // Anyone with the link can land here, so the local-server advice is for this machine only.
  const local = ['localhost', '127.0.0.1'].includes(location.hostname), reload = '<div class="actions"><button class="primary" onclick="location.reload()">다시 불러오기</button></div>';
  $('overlay').innerHTML = `<section class="panel compact"><h2>게임을 불러오지 못했습니다</h2>${local ? `<p class="error">${escapeHTML(error.message)}</p><p>프로젝트 폴더에서 <code>npm start</code>를 실행한 뒤 <a href="http://localhost:4173">localhost:4173</a>을 열어 주세요.</p>` : '<p>인터넷 연결을 확인한 뒤 다시 불러와 주세요. 진행 기록은 이 브라우저에 그대로 남아 있습니다.</p>'}${reload}</section>`;
  const heading = $('overlay').querySelector('h2');
  heading.setAttribute('aria-label', heading.textContent); heading.replaceChildren(pixelText(heading.textContent, 15, '#2b3345'));
  console.error(error);
}
