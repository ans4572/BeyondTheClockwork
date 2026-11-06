import { loadData } from './engine/data.js';
import { Game } from './engine/game.js';
import { TOOL_ICONS, ICON_FILES, ico, slotArt, skillIcon, syncFullscreenIcon } from './ui/tool-icons.js';
import { roomTitle } from './engine/room-title.js';
import { encodeSave, decodeSave, hasProgress, saveSummary, SAVE_KEY } from './engine/storage.js';
import { PIXELS_PER_UNIT } from './engine/map-geometry.js';
import { statCost, rankCap } from './engine/progression.js';
import { CanvasRenderer, STATUS_ICONS, BRASS_DRUM_ART, HAZARD_ART, FLAG_BEARER_ART } from './render/canvas.js';
import { FX_FILES } from './render/fx-sprites.js';
import { SpriteLibrary, assetUrl, browserImage } from './animation/sprite-library.js';
import { createMapLoader } from './render/map-loader.js';
import { TitleScreen, pixelText, PIXEL_FONT, PIXEL_EM } from './ui/title-screen.js';
import { TouchControls, autoAim } from './ui/touch-controls.js';
import { gradedCanvas } from './render/grade.js';
import { worldMapSvg, WORLD_MAP_ART, WORLD_MAP_MARKERS } from './ui/world-map.js';
import { SoundBank } from './audio/sfx.js';
import { MusicPlayer, musicScene } from './audio/music.js';
import { HITS_TO_LEARN } from './engine/tutorial.js';
import { DialogueBox } from './ui/dialogue.js';
import { formatCode } from './engine/transfer-code.js';
import { sendSave, fetchSave, forgetCode, startSync, pullSync, pushSync } from './ui/device-transfer.js';
import { browserReporter, mailbox, fetchRecords, PING_SECONDS } from './ui/stats-report.js';
import { mergeMine, formatClock } from './engine/records.js';
import { callName, fillName, NICKNAME_MAX } from './engine/nickname.js';
import { progressMark, syncPlan, readLink, writeLink, readPlayTime, writePlayTime, mergePlayTime, PLAY_UPLOAD_SECONDS } from './engine/sync.js';

const $ = id => document.getElementById(id);
const escapeHTML = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
/** Total play time as hours and minutes: "12시간 5분", "5분", or "1분 미만". */
const formatPlayTime = seconds => { const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60); return hours ? `${hours}시간 ${minutes % 60}분` : minutes ? `${minutes}분` : '1분 미만'; };
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const defaultBindings = { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', dodge: 'Space', skill0: 'KeyQ', skill1: 'KeyE', skill2: 'KeyR', skill3: 'KeyF', interact: 'KeyG', codex: 'Tab', map: 'KeyM', stats: 'KeyC' };
// Moving with the mouse: right click walks to the spot (held, F2 follows the cursor), Q W E R are the four skills, F the fusion.
const mouseBindings = { dodge: 'Space', skill0: 'KeyQ', skill1: 'KeyW', skill2: 'KeyE', skill3: 'KeyR', fusion: 'KeyF', interact: 'KeyG', codex: 'Tab', map: 'KeyM', stats: 'KeyC' };
/** Closer than this to the clicked spot, F2 has arrived; held this many steps without getting anywhere, F2 gives up on it. */
const ARRIVE_DISTANCE = 0.15, STUCK_STEPS = 30;
const bindingNames = { fusion: '융합', up: '위', left: '왼쪽', down: '아래', right: '오른쪽', dodge: '회피', skill0: '기술 1', skill1: '기술 2', skill2: '기술 3', skill3: '기술 4', interact: '상호작용', codex: '도감', map: '지도', stats: 'F2 정보' };
const HOME_NAME = '웃음 마을';
/** The F9 room jumper works only on this computer's dev server, never on the deployed sites. */
const DEBUG_ALLOWED = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// Two taps closer than this are a double tap, which phones would turn into a page zoom.
const DOUBLE_TAP_MS = 350;
// Tile colours for cards that belong to no element.
// Each run part has its own picture.
/** What each run part changes, named on its reward card with the value now and with the part fitted. */
const PART_VALUES = { basicDamage: ['렌치 피해', '+'], maxHp: ['최대 체력', ''], skillCooldownReduction: ['스킬 대기시간', '−'], statusDamage: ['화상 피해', '+'], moveSpeed: ['이동 속도', '+'], critChance: ['치명타 확률', ''], attackSpeed: ['렌치 속도', '+'], killHeal: ['처치마다 회복 HP', ''], damageReduction: ['받는 피해', '−'] };
const PERK_ICONS = { piggyBank: 'reward-piggy-bank', overheatEngine: 'reward-overheat', glassSpring: 'reward-glass-spring' };
const PART_ICONS = { basicDamage: 'reward-wrench-damage', maxHp: 'reward-max-hp', skillCooldownReduction: 'reward-skill-cooldown', statusDamage: 'reward-status-damage', moveSpeed: 'reward-move-speed', critChance: 'reward-crit', attackSpeed: 'reward-attack-speed', killHeal: 'reward-kill-heal', damageReduction: 'reward-armor' };
const KIND_COLORS = { heal: '#c43c36', gears: '#c79a3e', upgrade: '#5c9a9a', mod: '#8a8f9c', level: '#c79a3e', perk: '#a92f2b' };
const TIER_NAMES = { common: '일반', rare: '희귀', special: '특별' };
// The thirteen tuning rows read as four parts of the body they change: casing, wrench, circuits and pockets.
/** Tuning stats that shorten a wait: their value is shown as a cut. */
const SHORTER_WAITS = new Set(['cooldownReduction']);
const STAT_GROUPS = [['외장', ['maxHp', 'damageReduction', 'moveSpeed']], ['렌치', ['attackDamage', 'attackSpeed', 'critChance', 'critDamage']], ['회로', ['cooldownReduction', 'energyGain', 'statusPower']], ['주머니', ['gearGain', 'coinGain']]];
/** Parser errors arrive in English; players get one plain sentence instead. */
/** Every picture the menus show at once: element parts, skill slots, status marks and the map. Loaded right after the title. */
const UI_ICONS = [...['fire', 'ice', 'lightning', 'wind'].map(id => `art/ui/element-icons/${id}.png`),
  ...['heatSwing', 'exhaustBurst', 'frostBolt', 'coolingField', 'conductiveSpanner', 'capacitorStrike', 'pressureDash', 'vortexIntake',
    'steamShatter', 'arcFurnace', 'fireCyclone', 'magneticIceClamp', 'frostCrosscut', 'stormFloat'].map(skillIcon), ...ICON_FILES,
  // The map's painting, so the map opens whole the first time.
  WORLD_MAP_ART, ...WORLD_MAP_MARKERS];
/** The decoded icons are held here so the browser keeps them ready. */
const keptIcons = [];
const elementIcon = (id, classes = 'element-icon') => `<img class="${classes}" src="art/ui/element-icons/${id}.png" alt="">`;
// How each kind of hit is felt: seconds the game holds still, and screen shake in pixels.
// Hit-stop halved on 2026-11-05: the full holds made a combo feel stuck. Skills shake and fusions hold and slow (2026-11-06):
// they hit harder than the wrench and should feel it.
const FEEL = { hit: { stop: 0.03, shake: 1.5 }, heavy: { stop: 0.06, shake: 5 }, phase: { stop: 0.125, shake: 5 }, skill: { stop: 0.015, shake: 3 }, fusion: { stop: 0.05, shake: 6 }, kill: { stop: 0.05, shake: 4 }, hurt: { stop: 0 }, block: { stop: 0 }, burst: { stop: 0, shake: 3 }, pop: { stop: 0 }, dodge: { stop: 0 }, summon: { stop: 0 }, clear: { stop: 0 } }, NO_FEEL = { stop: 0 };
const FUSION_SLOW_MS = 100, MULTI_STOP = 0.005, MULTI_STOP_CAP = 0.015, CRIT_STOP = 0.01, CRIT_SHAKE = 3, SLOW_RATE = 0.3, BOSS_SLOW_MS = 1100, WHOOSH_WAIT_MS = 70, BOSS_CARD_MS = 1700, BOSS_CARD_HOLD_MS = 1200;
/**
 * The loading card waits only for what the title shows: its paper form and song. Everything else is held back until
 * then so it does not share the connection: F2's sheets start once the title is drawn (titleDrawn), and the skill
 * sheets, the other songs and the place art once the loading card is gone (bootDone).
 */
let markTitleDrawn, markBootDone, titleIsDrawn = false;
const titleDrawn = new Promise(done => { markTitleDrawn = () => { titleIsDrawn = true; done(); }; }), bootDone = new Promise(done => { markBootDone = done; });
function finishBoot() { document.body.classList.add('booted'); document.getElementById('boot')?.remove(); markTitleDrawn?.(); markBootDone?.(); }
const ELEMENT_STATUS = { fire: 'burn', ice: 'chill', lightning: 'shock', wind: 'windPressure' };
const saveProblem = message => (/[가-힣]/.test(message) ? message : '저장 내용을 읽을 수 없습니다. 저장이 잘렸거나 손상되었을 수 있습니다.');
/** Below this many sheet pixels of height, panels drop their side notes and tighten up. */
const CRAMPED_SHEET_HEIGHT = 600;
const TOUCH_PANEL_ZOOM = 0.85, TOUCH_TEXT_ZOOM = 1, IMAGE_SLOTS = 3;
const keyName = key => key.replace('Key', '').replace('Digit', '').replace('Arrow', '↑↓←→'[({ ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 })[key]] || '').replace('Space', 'Space');

try {
  // The pixel lettering font must be ready before the first heading or the title is drawn from it.
  const [, data] = await Promise.all([Promise.all([document.fonts.load(`${PIXEL_EM}px ${PIXEL_FONT}`, '태엽'), document.fonts.load('700 12px Galmuri11', '태엽'), document.fonts.load('12px Galmuri11', '태엽')]).catch(() => {}), loadData()]);
  let saved = null, loadError = '';
  try { const raw = localStorage.getItem(SAVE_KEY) || ''; if (raw) saved = decodeSave(raw, data); }
  catch (error) { loadError = error.message; }
  if (saved) mergePlayTime(saved, readPlayTime(localStorage));
  let saveBlocked = !!loadError, storageError = '';
  const game = new Game(data, saved, state => {
    if (saveBlocked) return;
    try { localStorage.setItem(SAVE_KEY, encodeSave(state)); }
    catch { storageError = '브라우저 저장 공간을 사용할 수 없습니다. 설정의 이동 코드로 다른 기기에 옮겨 두세요.'; }
  });
  // The game is drawn in full detail off screen, then set on a 640-pixel grid (see CanvasRenderer).
  const detail = document.createElement('canvas');
  const renderer = new CanvasRenderer(detail, game, { view: $('game'), letters: $('letters') });
  let touch = null;
  // F2's sheets come first and the loading card waits for them, so the old code doll never stands in for the player.
  // Enemies and townsfolk follow one set at a time instead of competing with F2 for the connection.
  // Walking, the wrench, dodging and falling are waited for; skill poses and cast effects follow in the background,
  // since no skill can be used before elements are equipped in town.
  const PLAYER_LATER = action => !['idle', 'walk', 'run', 'attack-1', 'attack-2', 'attack-3', 'hit', 'death', 'dodge'].includes(action);
  // F2's and Moru's sheets are colour-graded as they load so they sit with the brighter cast (src/render/grade.js).
  const gradedImage = url => browserImage(url).then(gradedCanvas);
  // Menu icons are tiny but shown all at once (codex, parts shelf, reward cards): fetched and decoded while the title
  // plays, and the decoded pictures kept, so a panel never opens with pictures arriving one by one.
  // They wait for the title to be drawn, so they do not hold up the loading card.
  titleDrawn.then(() => { for (const file of [...UI_ICONS, ...Object.values(STATUS_ICONS).map(assetUrl)]) { const image = new Image(); image.decoding = 'async'; image.src = file; image.decode().catch(() => {}); keptIcons.push(image); } });
  const playerSprites = titleDrawn.then(() => SpriteLibrary.load(undefined, gradedImage, PLAYER_LATER, bootDone)).then(library => renderer.useSprites(library)).catch(error => console.warn(error));
  playerSprites
    .then(() => SpriteLibrary.load('/art/animations/mobs/normal-elite/game-clips.json')).then(library => renderer.useMobSprites(library)).catch(error => console.warn(error))
    .then(() => SpriteLibrary.load('/art/animations/npc/game-clips.json', url => (url.includes('/moru-') ? gradedImage(url) : browserImage(url)))).then(library => renderer.useNpcSprites(library)).catch(error => console.warn(error));
  // On a local test server the game and its renderer can be looked at from the console (never on the published site).
  if (DEBUG_ALLOWED) window.__btc = { game, renderer };
  // Anonymous play statistics for the admin page (admin.html); never sent from a local test server.
  const report = browserReporter();
  game.onRun = report; report.opened();
  const isTouch = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch', isTouch);
  // Phones zoom the page on a quick double tap or a pinch whatever the viewport tag says (iOS ignores user-scalable=no).
  // The game is never zoomed: a second tap close after the first is kept from zooming, and still presses the button it
  // landed on (the browser drops that click once the zoom is refused); pinches are refused. Text boxes keep their own taps.
  if (isTouch) {
    let lastTap = 0;
    document.addEventListener('touchend', e => {
      const now = e.timeStamp, quick = now - lastTap < DOUBLE_TAP_MS;
      lastTap = now;
      if (!quick || e.touches.length || e.target.closest?.('input, textarea, select')) return;
      e.preventDefault();
      e.target.closest?.('button, a, label, [data-action], [data-do]')?.click();
    }, { passive: false });
    document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, e => e.preventDefault(), { passive: false });
  }
  document.addEventListener('dblclick', e => e.preventDefault());
  // The game canvas is backed at the size it is shown (up to 2x for sharp screens), so maps and sprites are not stretched twice.
  const MAX_BACKING_WIDTH = 2560;
  const fitCanvas = () => {
    const shown = $('game').getBoundingClientRect().width, width = Math.max(1120, Math.min(MAX_BACKING_WIDTH, Math.round(shown * Math.min(devicePixelRatio || 1, 2))));
    // The frame is drawn at the screen's own resolution and copied 1:1, so painted maps stay sharp on every device.
    const height = Math.round(width * 640 / 1120);
    if (detail.width !== width) { detail.width = width; detail.height = height; }
    if ($('game').width !== width) { $('game').width = width; $('game').height = height; }
    if ($('letters').width !== width) { $('letters').width = width; $('letters').height = Math.round(width * 640 / 1120); }
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
    // Panels never shrink past a readable size; on a short screen they switch to a compact layout so nothing scrolls.
    const zoom = Math.max(scale, TOUCH_PANEL_ZOOM);
    $('overlay').style.zoom = zoom;
    document.body.classList.toggle('cramped', document.documentElement.clientHeight / zoom < CRAMPED_SHEET_HEIGHT);
  };
  addEventListener('resize', fitHud); document.addEventListener('fullscreenchange', fitHud); fitHud();
  const hudFace = $('hud-face').getContext('2d'), portrait = new Image();
  // The face in the corner opens F2 정보 (Moru points it out once the first part is fitted).
  $('hud-face').addEventListener('click', () => { if (!saveBlocked && !onTitle && !screen && game.s.profile.registered) { openAudio(); pause('stats'); } });
  hudFace.imageSmoothingEnabled = false;
  portrait.onload = () => hudFace.drawImage(portrait, 40, 16, 48, 48, 4, 4, 48, 48);
  portrait.src = 'art/animations/player/movement/locomotion/clips/idle-south-708a71c5/sheet.webp';
  // Each place's art, in order of need (src/render/map-loader.js); nothing starts before the title is drawn.
  const mapArt = createMapLoader({ data, game, renderer, slots: IMAGE_SLOTS, canStart: () => titleIsDrawn,
    firstFiles: [...Object.values(STATUS_ICONS), data?.maps?.practice?.dummyImage, BRASS_DRUM_ART, ...Object.values(FLAG_BEARER_ART), ...Object.values(HAZARD_ART), ...FX_FILES] });
  const { introPlace, fetchImages, bringPlaceForward, placeArtReady } = mapArt;
  fetchImages();
  const gameViewport = $('overlay').parentElement;
  let screen = loadError ? 'loadError' : 'title', onTitle = false, overlayKey = '', bindingTarget = null;
  // Moving the save to another device: the code this device made, what the player typed, and a save waiting to be accepted.
  let transfer = { code: null, expiresAt: null, typed: '', busy: '', error: '', incoming: null };
  // Sync between linked devices: the link this device holds, a problem to show in the settings, and a choice to make.
  let lastPlayWrite = 0, lastPlayUpload = -Infinity, link = readLink(localStorage), syncNote = '', syncBusy = false, syncConflict = null, syncMode = null;
  let pointer = { x: 14, y: 8 }, held = new Set(), mouseHeld = false, rightHeld = false, moveHeld = false, moveTarget = null, lastMouse = null, stuckSteps = 0, movedIn = null, pending = {}, gamepadLast = [], lastAutosave = game.s.time;
  let audio = null, lastSoundId = null, codexTab = 'elements', mapPick = null, settingsTab = 'general';
  // The in-game setting, or the same wish made once for every app on the device.
  const reducedMotion = () => game.s.profile.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mouseMove = () => !isTouch && game.s.profile.settings.controls === 'mouse';
  function bindings() { const settings = game.s.profile.settings; return mouseMove() ? { ...mouseBindings, ...settings.mouseBindings } : { ...defaultBindings, ...settings.bindings }; }
  /** The changed keys of the way F2 moves now; the other way keeps its own. */
  function changedBindings() { const settings = game.s.profile.settings; return mouseMove() ? (settings.mouseBindings ??= {}) : settings.bindings; }
  function clearInput() { held.clear(); mouseHeld = false; moveHeld = false; rightHeld = false; moveTarget = null; pending = {}; touch?.release(); }
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
    // The scrapyard's painting is fetched while the opening text plays; on a slow connection the game waits a little
    // longer for it rather than open on the plain stand-in floor.
    if (introPlace?.background && !renderer.mapImages.has(introPlace.background)) {
      // The same card as the page's own loading screen, over everything, until the painting is in.
      document.body.insertAdjacentHTML('beforeend', '<div id="boot" class="place" role="status"><div class="card"><b>태엽 밖으로</b><span><i>⚙</i>태엽을 감는 중…</span></div></div>');
      bringPlaceForward(introPlace);
      await placeArtReady(introPlace, 30000);
      document.getElementById('boot')?.remove();
    }
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
  // After the safety pin Moru shows his parts shelf: the first element is picked there, for free.
  async function meetMoru() {
    await talk('registration');
    // Moru writes the player into his repair ledger: the name typed here is what the dialogue calls them from now on.
    const typed = await talk('ledger');
    game.setNickname(typeof typed === 'string' ? typed : '');
    await talk('ledgerDone'); game.register();
    await talk('firstElement'); game.openElements(); renderOverlay(true);
  }
  // A boss speaks once, the first time the player walks into its room; the fight waits until the talk ends.
  const BOSS_TALKS = { collectorRoco: 'rocoMeet', captainBrass: 'brassMeet' };
  async function meetBoss(boss) {
    (game.s.profile.bossTalks ??= []).push(boss); game.save();
    game.s.paused = true; await talk(BOSS_TALKS[boss]); game.s.paused = false;
    bossCard(boss);
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
  /** The boss's name across the screen as the fight begins. */
  function bossCard(boss) {
    const info = data.combat.bosses.find(b => b.id === boss), card = $('boss-card');
    if (!info || reducedMotion()) return;
    const [title, ...name] = info.name.split(' ');
    card.innerHTML = `<small>${title}</small><b>${name.join(' ')}</b>`; card.hidden = false;
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    // The fight holds while the name is read, then starts as the card slides away.
    game.s.paused = true;
    setTimeout(() => { if (!screen) game.s.paused = false; }, BOSS_CARD_HOLD_MS);
    setTimeout(() => { card.hidden = true; }, BOSS_CARD_MS);
  }
  /** A dark band slides off the screen toward where the player is heading, as a new place opens. */
  let wipedEntry = null;
  function wipeIn() {
    const entry = game.s.entry;
    if (!entry || entry === wipedEntry || reducedMotion()) return;
    wipedEntry = entry;
    const wipe = $('wipe'); wipe.className = `from-${entry.side}`; wipe.hidden = false; void wipe.offsetWidth; wipe.classList.add('go');
    setTimeout(() => { wipe.hidden = true; }, 520);
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
  // Sound files and the first two tracks download during loading; the first tap only has to switch them on.
  // The title song downloads alone first, so it can play the moment sound is allowed; the effects and the town
  // and street songs follow once it can.
  music.preload(['title']);
  music.ready('title', 4000).then(() => playerSprites).then(() => { sounds.prefetch(); music.preload(['town', 'street']); fetchImages(); });
  // Browsers only allow sound after the player touches the page; the first touch or key anywhere, the title included, opens it.
  for (const type of ['pointerdown', 'keydown', 'click', 'touchend']) window.addEventListener(type, () => openAudio(), { capture: true });
  // The rest stop splits the run: before it the street is bright, from it on the light is going.
  const REST_INDEX = data.slice.rooms.findIndex(room => room.kind === 'shop');
  /** The background track for what is on screen; silent when music is switched off. */
  /** `now` starts the wanted song even before the sound context reports it is running: used inside the first tap. */
  function playMusic(now = false) {
    const s = game.s, settings = s.profile.settings, room = game.room;
    const name = settings.music ? musicScene({ onTitle, mode: s.mode, roomKind: room?.kind, roomIndex: s.run ? s.run.node : undefined, restIndex: REST_INDEX }) : null;
    // Menus over the game keep the music, a little quieter.
    music.update(audio, name, settings.musicVolume * (s.paused && !onTitle ? 0.5 : 1), now);
  }
  /**
   * Browsers let a page make sound only after a tap or a key on it (a desktop visitor who has played here before is
   * often let through at once). Sound is tried right away; if it is held back, the loading card asks for one tap, so
   * the title always opens with its song already playing instead of waiting for a click on the title itself.
   */
  async function startSound() {
    const { sound, music: musicOn } = game.s.profile.settings;
    if (!sound && !musicOn) return;
    openAudio();
    await Promise.race([audio.resume().catch(() => {}), new Promise(done => setTimeout(done, 300))]);
    if (audio.state !== 'running') {
      const boot = $('boot');
      if (!boot) return;
      boot.classList.add('tap'); boot.querySelector('span').textContent = isTouch ? '화면을 눌러 시작' : '클릭하거나 아무 키나 눌러 시작';
      // iPhones let sound start only when the finger lifts (touchend / click), not when it lands, so the card waits for
      // that; and the title song is started right inside the tap, since a phone may refuse a song started a frame later.
      const GATE = ['click', 'touchend', 'keydown'];
      await new Promise(done => {
        const go = e => { if (e.type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); } for (const type of GATE) removeEventListener(type, go, true); openAudio(); playMusic(true); done(); };
        for (const type of GATE) addEventListener(type, go, true);
      });
    }
    // The title song is usually downloaded by now; wait a moment for it rather than open the title in silence.
    await music.ready('title', 1500);
  }
  function openAudio() { const { sound, music: musicOn } = game.s.profile.settings; if (sound || musicOn) { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); music.unlock(audio); sounds.load(audio); } }
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
    fail: () => sfx('fail'),
    phase: () => sfx('heavy'),
    boss: hit => sfx(`boss-${hit.id}`)
  };
  let hitstop = 0, slowUntil = 0, landedAt = 0, pendingWhoosh = null, feltSwing = null;
  // Lowest to highest: when several things happen in one step, only the last of these that happened is heard.
  const SOUND_RANK = ['dodge', 'portal', 'pick', 'cards', 'loot', 'charged', 'mend', 'summon', 'pop', 'mob', 'block', 'hit', 'boss', 'cast', 'burst', 'heavy', 'kill', 'phase', 'hurt', 'clear', 'down', 'fail'];
  /** Turns the rules' hits into a held frame, a shake, a red edge and a sound, once per kind per step. */
  function feelHits() {
    const hits = game.feel.splice(0);
    if (!hits.length) return;
    const calm = reducedMotion();
    // Catching several enemies in one swing holds the frame a little longer for each.
    const struck = hits.filter(hit => hit.kind === 'hit' || hit.kind === 'heavy').length, crowd = Math.min(MULTI_STOP_CAP, MULTI_STOP * Math.max(0, struck - 1));
    for (const hit of hits) {
      // One swing holds the frame once: a wrench still sweeping into more bodies on the next frames used to hold again
      // and again, which read as slow motion in a crowd (2026-11-06).
      const repeat = hit.swing && hit.swing === feltSwing;
      if (hit.swing) feltSwing = hit.swing;
      if (repeat) continue;
      // An ordinary kill no longer holds the frame on top of the blow that made it (2026-11-06: it read as a slow-down);
      // only a boss's fall still does.
      // Nor does it shake the screen: the blow's own kick is enough, and the extra shake on every kill read as a zoom.
      const kind = hit.kind === 'kill' && !hit.boss ? NO_FEEL : FEEL[hit.kind] || NO_FEEL;
      hitstop = Math.max(hitstop, kind.stop + (hit.crit ? CRIT_STOP : 0) + (hit.angle !== undefined ? crowd : 0));
      const shake = Math.max(kind.shake || 0, hit.crit ? CRIT_SHAKE : 0);
      // A wrench blow pushes the view the way it was swung; everything else shakes.
      if (shake && !calm) renderer.kick(shake, hit.angle);
      if (hit.crit && !calm) renderer.critPulse();
      if (hit.kind === 'hurt' && !calm) renderer.wince();
    }
    // Only a boss falls in slow motion; ordinary enemies, even a room's last, drop at full speed (2026-11-06).
    if (hits.some(hit => hit.kind === 'kill' && hit.boss) && !calm) slowUntil = performance.now() + BOSS_SLOW_MS;
    if (hits.some(hit => hit.kind === 'phase') && !calm) renderer.flash();
    // A fusion going off: the screen's edges light in its two elements, the floor dims and the view leans in;
    // its first blow then holds and slows the world for a moment.
    const fusionCast = hits.find(hit => hit.kind === 'cast' && hit.fusion);
    if (fusionCast && !calm) renderer.fusionBurst(fusionCast.pair);
    if (hits.some(hit => hit.kind === 'fusion') && !calm) slowUntil = Math.max(slowUntil, performance.now() + FUSION_SLOW_MS);
    // One sound per moment: the most telling thing that happened in this step, and nothing layered under it.
    const top = hits.reduce((best, hit) => (SOUND_RANK.indexOf(hit.kind) > SOUND_RANK.indexOf(best.kind) ? hit : best));
    if (['hit', 'heavy'].includes(top.kind)) { landedAt = performance.now(); pendingWhoosh = null; }
    HIT_SOUNDS[top.crit && top.kind === 'hit' ? 'heavy' : top.kind]?.(top);
  }
  /** Two slow strokes of the town bell. */
  function toll() { sfx('bell'); }

  function statValue(stat, rank) {
    // A wait that gets shorter reads as a minus, so "−3%" never looks like a longer cooldown.
    const value = rank * stat.perRank, sign = SHORTER_WAITS.has(stat.id) && value ? '−' : '+';
    return stat.unit === 'percent' ? `${sign}${Number((value * 100).toFixed(1))}%` : `${sign}${value}`;
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
    const { loadout, ownedElements, freeGears } = game.s.profile, price = game.nextElementPrice, fusion = data.combat.fusions.find(f => f.pair.every(id => loadout.includes(id)));
    const cards = data.combat.elements.map(element => {
      const owned = ownedElements.includes(element.id), picked = loadout.includes(element.id), skills = data.combat.skills.filter(skill => skill.element === element.id);
      const action = owned ? button(picked ? '✓ 장착' : '장착', 'element', `data-id="${element.id}" aria-pressed="${picked}"`, 'pick')
        : price === null ? button(ownedElements.length ? '모두 보유' : '등록 뒤 무료', 'buy-element', `data-id="${element.id}" disabled`, 'pick')
        : button(price === 0 ? '무료로 달기' : `${ico('gear')} ${price} 구매`, 'buy-element', `data-id="${element.id}" ${freeGears < price ? 'disabled' : ''}`, 'pick');
      // Each part shows its two skills as icon rows, with the numbers that matter when choosing.
      const moves = skills.map(skill => `<li><img src="${skillIcon(skill.id)}" alt=""><span><b>${skill.name}</b><small>피해 ${skill.totalDirectDamage} · 축전 ${skill.energyCost}</small><small>재사용 ${skill.cooldown}초</small></span></li>`).join('');
      return `<article class="reward-card element-card ${picked ? 'picked' : ''} ${owned ? 'owned' : 'unowned'}" style="--accent:${data.slice.presentation.colors[element.id]}">${owned ? `<span class="owned-badge">${picked ? '장착 중' : '보유'}</span>` : ''}<div class="element-head">${elementIcon(element.id)}<div><h3>${element.name}</h3><span class="device">${element.device}</span></div></div><span class="element-role">${element.role}</span><ul class="element-skills">${moves}</ul>${action}</article>`;
    }).join('');
    const note = !ownedElements.length ? '첫 속성 부품은 모루가 무료로 달아 줍니다. 하나를 고르세요.'
      : `산 부품은 계속 남고, 원정에는 2개까지 장착합니다.${price ? ` 다음 부품은 ${ico('gear')} ${price}입니다.` : ''}`;
    return panel(`<div class="panel-header"><div><h2>모루의 속성 부품</h2></div><div class="header-stats"><strong>장착 ${loadout.length} / 2</strong><strong title="보유 자유 톱니">${ico('gear')} ${freeGears}</strong></div></div><p>${note}</p><div class="reward-grid four">${cards}</div><p>${fusion ? `융합: <strong>${fusion.name}</strong> · ${data.slice.presentation.codex.fusions[fusion.id] || fusion.effect}` : '두 속성을 장착하면 융합 기술이 열립니다.'}</p><div class="actions">${button('닫기', 'close-panel', '', 'primary')}${button('뒷마당에서 시험하기', 'practice', loadout.length ? '' : 'disabled')}</div>`, 'wide');
  }
  /**
   * A run part's effect with `rank` of them fitted, counting the permanent tuning that adds to the same thing, the way the
   * game itself combines them (percentages as fractions, health in points).
   */
  function partValue(id, rank) {
    const amount = rank * data.combat.balance.temporaryUpgrades.find(u => u.id === id).perRank, caps = data.combat.caps;
    const RUN = ['moveSpeed', 'critChance', 'attackSpeed', 'damageReduction'], tuned = key => (game.stats[key] || 0) - (RUN.includes(key) ? game.upgradeAmount(key) : 0);
    if (id === 'maxHp') return game.p.maxHp + amount - game.upgradeAmount('maxHp');
    if (id === 'killHeal') return amount;
    if (id === 'basicDamage') return tuned('attackDamage') + amount;
    if (id === 'skillCooldownReduction') return Math.min(caps.totalCooldownReduction, tuned('cooldownReduction') + amount);
    if (id === 'statusDamage') return tuned('statusPower') + amount;
    if (id === 'critChance') return Math.min(caps.critChance, (data.combat.player.critChance || 0) + tuned('critChance') + amount);
    return tuned(id) + amount;
  }
  function describeReward(reward) {
    if (reward.kind === 'element') {
      const element = data.combat.elements.find(e => e.id === reward.id), skills = data.combat.skills.filter(s => s.element === element.id);
      return { name: element.device, art: element.id, label: game.s.profile.ownedElements.includes(element.id) ? `${element.name} 속성 모듈` : `${element.name} 속성 모듈 · 이번 원정 체험`, description: `${skills.map(s => s.name).join(' · ')}<br>${element.role}`, value: skills.map(s => `${s.totalDirectDamage} 피해 · 축전 ${s.energyCost} · ${s.cooldown}초`).join('<br>'), color: data.slice.presentation.colors[element.id], rarity: { common: '일반', rare: '희귀', special: '특제' }[reward.rarity] };
    }
    if (reward.kind === 'mod') { const mod = data.slice.mods.find(m => m.id === reward.id); return { name: mod.name, icon: ico('reward-wrench-mod'), label: '렌치 개조', description: mod.description, value: '이 원정에 유지 · 최대 2개' }; }
    if (reward.kind === 'skillMod') { const mod = data.slice.skillMods.find(m => m.id === reward.id), skill = data.combat.skills.find(s => s.id === mod.skill); return { name: mod.name, skills: [skill.id], label: `기술 개조 · ${skill.name}`, description: mod.description, value: '이 원정에 유지', color: data.slice.presentation.colors[skill.element] }; }
    if (reward.kind === 'perk') { const perk = data.slice.perks.find(p => p.id === reward.id); return { name: perk.name, icon: ico(PERK_ICONS[perk.id] || 'spark'), label: '원정 특전', description: perk.description, value: '이 원정에 유지 · 한 번만' }; }
    if (reward.kind === 'trait') { const trait = data.slice.elementTraits.find(t => t.id === reward.id), element = data.combat.elements.find(e => e.id === trait.element); return { name: trait.name, art: trait.element, label: `속성 특성 · ${element.name}`, description: trait.description, value: '이 원정에 유지', color: data.slice.presentation.colors[trait.element] }; }
    if (reward.kind === 'level') { const slot = game.slots[reward.id], element = data.combat.elements.find(e => e.id === slot.element); const skills = data.combat.skills.filter(s => s.element === slot.element); return { name: `${element.name} 기술 조율`, skills: skills.map(s => s.id), label: '기술 단계', description: `${skills.map(s => s.name).join(' · ')}이(가) 함께 강해진다.`, value: `Lv.${slot.level} → ${slot.level + 1} (최대 ${data.combat.balance.skillMaxLevel}) · 직접 피해 +12%p` }; }
    if (reward.kind === 'gears') return { name: '자유 톱니 주머니', icon: ico('reward-gear-pouch'), label: '영구 재료', description: '모루의 조율판에서 내 방식으로 성장한다.', value: `자유 톱니 +${reward.amount} · 귀환 후 유지` };
    if (reward.kind === 'heal') { const repair = data.slice.rules.healRewards.find(h => h.id === reward.id); return { name: repair.name, icon: ico('reward-repair'), label: '수리', description: repair.description, value: `체력 ${Math.round(game.p.hp)} → ${Math.min(game.p.maxHp, Math.round(game.p.hp + repair.amount))} / ${game.p.maxHp}` }; }
    const upgrade = data.combat.balance.temporaryUpgrades.find(u => u.id === reward.id), desc = data.slice.rewards[reward.id];
    const rank = game.s.run.upgrades[reward.id] || 0, [name, sign] = PART_VALUES[reward.id], now = partValue(reward.id, rank), next = partValue(reward.id, rank + 1);
    const shown = v => reward.id === 'maxHp' || reward.id === 'killHeal' ? `${v}` : `${v ? sign : ''}${Math.round(v * 100)}%`;
    // What the part changes, as it stands now and with this part fitted.
    return { name: desc.name, icon: ico(PART_ICONS[reward.id] || 'spark'), label: '출력 부품', description: desc.description, value: `${name} ${shown(now)} → <strong>${shown(next)}</strong><br>${rank + 1}/${upgrade.maxRank} 단계` };
  }
  /**
   * The town portal's question: how hard this expedition is. Each card says what changes against 보통 (enemies, bosses and
   * furniture by the difficulty's scale, every kill's loot by its loot share); the last pick is offered first.
   */
  const DIFFICULTY_COLORS = { easy: '#5f9a6e', normal: '#c79a3e', hard: '#a92f2b' };
  // The server's records, asked for each time the cards open (at most every RECORDS_REFRESH_MS); the cards show the
  // save's own records at once and the server's line once it answers.
  const RECORDS_REFRESH_MS = 30000;
  let serverRecords = null, recordsState = 'idle', recordsAskedAt = -Infinity;
  function askRecords() {
    if (recordsState === 'loading' || performance.now() - recordsAskedAt < RECORDS_REFRESH_MS) return;
    recordsState = 'loading'; recordsAskedAt = performance.now();
    fetchRecords({ storage: localStorage, hostname: location.hostname, protocol: location.protocol }).then(found => {
      if (found) serverRecords = found;
      recordsState = serverRecords ? 'ready' : 'offline';
      if (game.s.panel === 'difficulty') renderOverlay(true);
    });
  }
  /** A difficulty card's clear record: this device's best (time and element pair) and the server's fastest clear. */
  function recordBlock(id) {
    const mine = mergeMine(game.s.profile.records?.[id], serverRecords?.[id]?.me), top = serverRecords?.[id]?.top;
    const pair = list => `<span class="rec-els" title="${list?.length ? list.map(e => data.combat.elements.find(x => x.id === e)?.name || e).join(' + ') : '렌치만'}">${list?.length ? list.map(e => elementIcon(e, 'rec-el')).join('') : '<i>렌치만</i>'}</span>`;
    const quiet = text => `<b class="rec-none">${text}</b>`;
    const me = mine.best !== null ? `<b>${formatClock(mine.best)}</b>${pair(mine.elements)}` : `${quiet('아직 없음')}<span class="rec-els"><i>${mine.furthest ? `${mine.furthest}구간까지` : ''}</i></span>`;
    const server = top ? `<b>${formatClock(top.seconds)}</b>${pair(top.elements)}<small class="rec-who">${ico('crown')}${top.mine ? '나' : escapeHTML(top.name || '이름 없는 인형')}</small>`
      : quiet(recordsState === 'loading' && !serverRecords ? '불러오는 중' : serverRecords ? '아직 없음' : '연결 안 됨');
    return `<div class="rec"><div class="rec-head"><span>클리어 기록</span>${top?.mine ? '<em class="rec-mine">내가 서버 1위!</em>' : ''}</div>`
      + `<div class="rec-row${mine.best !== null && top?.mine ? ' top' : ''}"><span>내 최고</span>${me}</div><div class="rec-row top"><span>서버 1위</span>${server}</div></div>`;
  }
  function difficultyPanel() {
    askRecords();
    const { levels, default: base } = data.slice.difficulty, normal = levels.find(level => level.id === base), last = game.s.profile.lastDifficulty || base;
    const versus = (value, of) => { const change = Math.round((value / of - 1) * 100); return change ? `${change > 0 ? '+' : '−'}${Math.abs(change)}%` : '기준'; };
    const cards = levels.map(level => `<article class="reward-card difficulty-card${level.id === last ? ' last' : ''}" style="--accent:${DIFFICULTY_COLORS[level.id] || '#9fae83'}">${level.id === last ? '<span class="rarity">지난번 선택</span>' : ''}<span class="card-label">난이도</span><h3>${level.name}</h3><p>${escapeHTML(level.description)}</p><dl class="difficulty-values"><dt>적·보스 체력과 공격력</dt><dd>${versus(level.scale, normal.scale)}</dd><dt>방의 장애물</dt><dd>${versus(level.scale, normal.scale)}</dd><dt>처치 보상</dt><dd>${versus(level.loot, normal.loot)}</dd></dl>${recordBlock(level.id)}${button(`${level.name}으로 출발`, 'depart', `data-id="${level.id}"`, 'pick')}</article>`).join('');
    return panel(`<h2>어떤 난이도로 떠날까요?</h2><p>원정 중에는 난이도를 바꿀 수 없습니다. 퍼센트는 보통과 비교한 값입니다.</p><div class="reward-grid">${cards}</div><div class="actions">${button('마을에 남기', 'close-panel')}</div>`, 'wide difficulty');
  }
  function rewardsPanel() {
    return panel(`<h2>어떤 가능성을 조립할까요?</h2><p>이 구간의 자유 톱니와 동전은 이미 받았습니다. 부품을 하나 더 고르세요.</p><div class="reward-grid">${game.s.run.rewardChoices.map((reward, i) => {
      const info = describeReward(reward), tier = game.rewardTier(reward), replace = reward.kind === 'element' && game.slots.length >= 2;
      return `<article class="reward-card tier-${tier}" style="--accent:${info.color || KIND_COLORS[reward.kind] || '#9fae83'};--tint:${info.color ? info.color + '22' : '#e9eddc'}"><span class="rarity">${TIER_NAMES[tier]}</span>${info.skills ? `<span class="reward-skills">${info.skills.map(id => `<img class="px-icon" src="${skillIcon(id)}" alt="">`).join('')}</span>` : info.art ? `<span class="reward-icon">${elementIcon(info.art, 'tile-art')}</span>` : info.icon ? `<span class="reward-icon">${info.icon}</span>` : ''}<span class="card-label">${info.label}</span><h3>${info.name}</h3><p>${info.description}</p><div class="values">${info.value}</div>${replace ? `<p class="replace-note">속성 칸이 다 찼습니다. 하나를 빼고 넣습니다.</p><div class="replace">${game.slots.map((slot, j) => button(`${data.combat.elements.find(e => e.id === slot.element).name} 빼기`, 'reward', `data-index="${i}" data-replacement="${j}"`)).join('')}</div>` : button('선택', 'reward', `data-index="${i}"`, 'pick')}${button(game.s.run.rerolledCards?.[i] ? '다시 뽑음' : '이 카드 다시 뽑기', 'reroll-card', `data-index="${i}" ${game.s.run.rerolledCards?.[i] ? 'disabled' : ''}`, 'quiet reroll-one')}</article>`;
    }).join('')}</div><p class="notice">속성과 부품은 이번 원정에만 남고, 자유 톱니는 귀환해도 남습니다.</p>`, 'wide');
  }
  /** When this device last wrote its save, for the summaries shown before one save replaces another. */
  function localSavedAt() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')?.savedAt; } catch { return null; } }
  /** 다른 기기와 연동: when this device last saved to the server, and codes that link another device to it. */
  function transferBlock() {
    const t = transfer, until = t.expiresAt ? new Date(t.expiresAt) : null;
    const made = t.code ? `<p class="transfer-code" aria-label="이동 코드">${formatCode(t.code)}</p><p class="notice">다른 기기에서 환경설정 → 이 코드를 입력하세요. ${until ? `${until.getHours()}:${String(until.getMinutes()).padStart(2, '0')}까지(5분)` : '5분 동안'} 쓸 수 있고, 한 번 불러오면 사라집니다.</p><div class="actions">${button('코드 복사', 'transfer-copy')}</div>` : '';
    const clock = at => { const d = at && new Date(at); return d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : '아직 없음'; };
    const sync = `<p class="notice">${link ? `<b>서버 저장</b> · 마지막 저장 ${clock(link.at)}<br>` : ''}마을에 들어갈 때마다 서버에 저장되고, 연결된 기기에서 열면 최신 진행이 이어집니다.</p><div class="actions">${button(syncBusy ? '저장하는 중…' : '지금 저장하기', 'sync-now', syncBusy ? 'disabled' : '')}</div>`;
    return `${sync}${syncNote ? `<p class="error">${escapeHTML(syncNote)}</p>` : ''}<p class="notice">다른 기기를 연결하려면 코드를 만들어 그 기기에서 입력하세요. 한 번만 하면 됩니다. 받는 기기의 저장은 덮어씌워집니다.</p>${made}<div class="actions">${button(t.busy === 'send' ? '만드는 중…' : t.code ? '새 코드 만들기' : '이동 코드 만들기', 'transfer-send', t.busy ? 'disabled' : '')}</div><div class="actions transfer-enter"><input id="transfer-input" type="text" maxlength="9" placeholder="코드 8글자" value="${escapeHTML(t.typed)}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="이동 코드 입력">${button(t.busy === 'fetch' ? '찾는 중…' : '코드로 불러오기', 'transfer-fetch', t.busy ? 'disabled' : '')}</div>${t.error ? `<p class="error">${escapeHTML(t.error)}</p>` : ''}`;
  }
  let nicknameNote = '';
  /** The settings field for the ledger name; a linked device gets the new name with the next upload. */
  function saveNickname() {
    const input = $('nickname-input');
    if (!input) return;
    const kept = game.setNickname(input.value);
    nicknameNote = kept ? `수리 장부에 적었어요: ${kept}` : '이름을 비워서 제품 번호 F2로 불려요.';
    renderOverlay(true);
  }
  /** This run's rewards in the order they were picked: the stop, the card's tier and name, and what it does. */
  function runPicks() {
    const run = game.s.run, picks = run?.picks || [], rooms = data.slice.rooms;
    const head = `<p class="run-picks-head">${escapeHTML(roomTitle(rooms[run.node]))} · ${run.node + 1}번째 정거장 · 고른 보상 ${picks.length}개</p>`;
    if (!picks.length) return `${head}<p class="notice">아직 고른 보상이 없습니다. 구간을 깨면 보상 카드를 고를 수 있어요.</p>`;
    const elementName = id => data.combat.elements.find(e => e.id === id)?.name || '';
    const rows = picks.map((pick, i) => {
      const reward = { kind: pick.kind, id: pick.id, amount: pick.amount, rarity: pick.rarity };
      let info; try { info = pick.kind === 'level' ? { name: `${elementName(pick.element)} 기술 단계 +1`, label: '기술 단계', description: '이 속성 기술의 피해가 오릅니다.' } : describeReward(reward); } catch { info = { name: pick.id ?? pick.kind, label: '' }; }
      let tier = ''; try { tier = TIER_NAMES[game.rewardTier(reward)] || ''; } catch {}
      return `<li><span class="pick-no">${i + 1}</span><div><b>${escapeHTML(String(info.name || ''))}</b> <span class="pick-meta">${escapeHTML([tier, info.label, `${pick.node + 1}번째 정거장`].filter(Boolean).join(' · '))}</span>${info.description ? `<p>${info.description}</p>` : ''}</div></li>`;
    }).join('');
    return `${head}<ol class="run-picks">${rows}</ol>`;
  }
  /**
   * F2 정보: what F2's body can do right now, the moru tuning and this run's parts together. Opened from the HUD face,
   * the C key, or the pause menu's tab. The wrench shows its three blows' real damage, not a percentage.
   */
  function statsBody() {
    const p = game.p, st = game.stats, c = data.combat, prof = game.s.profile, rank = id => prof.stats?.[id] || 0;
    const pct = v => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 1000) / 10}%`;
    const damage = (1 + Math.min(c.caps.permanentConditionalDamageBonus, st.attackDamage || 0)) * (1 + Math.min(c.caps.runDamageBonus, game.upgradeAmount('basicDamage') || 0));
    const crit = (c.player.critChance || 0) + (st.critChance || 0), critHit = c.caps.critMultiplier + (st.critDamage || 0);
    const groups = [
      ['외장', [['체력', `${Math.round(p.hp)} / ${p.maxHp}`, `조율 ${rank('maxHp')}단계`], ['방어력', pct(st.damageReduction || 0), '받는 피해가 줄어듭니다'], ['이동속도', pct(st.moveSpeed || 0), `기본 초당 ${c.player.speed}칸`]]],
      ['렌치', [['공격력', c.player.combo.map(blow => Math.round(blow.damage * damage)).join(' · '), '1·2·3타 피해'], ['공격속도', pct(st.attackSpeed || 0), ''], ['치명타', `${Math.round(crit * 100)}%`, `맞으면 피해 ×${Math.round(critHit * 100) / 100}`]]],
      ['회로', [['스킬 대기시간', pct(-(st.cooldownReduction || 0)), ''], ['축전 획득량', pct(st.energyGain || 0), ''], ['상태이상 위력', pct(st.statusPower || 0), '']]],
      ['주머니', [['자유 톱니 획득', pct(st.gearGain || 0), ''], ['동전 획득', pct(st.coinGain || 0), '']]]
    ];
    const loadout = (prof.loadout || []).map(id => `${elementIcon(id, 'inline-element')}${escapeHTML(data.combat.elements.find(e => e.id === id)?.name || id)}`).join('<span class="f2-plus">+</span>');
    const rows = groups.map(([name, list]) => `<div class="f2-group"><h3>${name}</h3>${list.map(([label, value, note]) => `<div class="f2-row"><span>${label}</span><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`).join('')}</div>`).join('');
    return `<div class="f2-card"><div class="f2-who"><div class="f2-face" role="img" aria-label="F2"></div><b>${escapeHTML(callName(prof))}</b><small>제품 번호 F2 · 태엽 인형</small>`
      + `<div class="f2-hp"><i style="width:${Math.round(Math.max(0, p.hp) / p.maxHp * 100)}%"></i></div><small>체력 ${Math.round(p.hp)} / ${p.maxHp}</small>`
      + `<div class="f2-loadout">장착 속성<br>${loadout || '없음'}${game.fusion ? `<br>융합 <b>${escapeHTML(game.fusion.name)}</b>` : ''}</div></div>`
      + `<div><div class="f2-groups">${rows}</div><p class="notice">모루의 조율판(영구)과 ${game.s.run ? '이번 원정에서 얻은 부품' : '원정에서 얻는 부품'}이 합쳐진 값입니다.</p></div></div>`;
  }
  function statsPanel() {
    return panel(`<div class="panel-header"><div><h2>F2 정보</h2></div>${button('닫기', 'resume', '', 'primary')}</div>${statsBody()}`, 'wide f2-info');
  }
  /** The first choice of a new game, right after waking: walk with the keys or with the mouse. Both ways stay in the settings. */
  function controlsPanel() {
    const settings = game.s.profile.settings, byMouse = settings.controls === 'mouse';
    const keyboardKeys = { ...defaultBindings, ...settings.bindings }, mouseKeys = { ...mouseBindings, ...settings.mouseBindings };
    const cap = (code, kind = '') => `<i class="${kind}">${code ? keyName(code) : ''}</i>`;
    const mouse = (right, rightKind) => `<div class="cs-mouse-wrap"><div class="cs-mouse"><span></span><span class="${rightKind}"></span></div><div class="cs-mouse-cap"><em></em>좌 렌치<br><em class="${rightKind}"></em>우 ${right}</div></div>`;
    const card = (id, name, art, rows) => `<button class="cs-card" data-action="controls" data-id="${id}" aria-pressed="${(id === 'mouse') === byMouse}"><span class="cs-name">${name}<span class="cs-picked">선택됨</span></span><span class="cs-art">${art}</span><span class="cs-rows">${rows.map(([what, how]) => `<span><span>${what}</span>${how}</span>`).join('')}</span></button>`;
    const skills = keys => [0, 1, 2, 3].map(i => keyName(keys['skill' + i])).join(' ');
    const k = keyboardKeys, m = mouseKeys;
    const keyboardArt = `<span class="cs-keys">${cap(k.skill0, 'skill')}${cap(k.up, 'move')}${cap(k.skill1, 'skill')}${cap(k.skill2, 'skill')}${cap(k.left, 'move')}${cap(k.down, 'move')}${cap(k.right, 'move')}${cap(k.skill3, 'skill')}</span>${mouse('융합', 'skill')}`;
    const mouseArt = `${mouse('이동', 'move')}<span class="cs-keys">${cap(m.skill0, 'skill')}${cap(m.skill1, 'skill')}${cap(m.skill2, 'skill')}${cap(m.skill3, 'skill')}${cap('', 'blank')}${cap('', 'blank')}${cap('', 'blank')}${cap(m.fusion, 'skill')}</span>`;
    const common = `<span><b>${keyName(k.dodge)}</b> 회피</span><span><b>${keyName(k.interact)}</b> 말 걸기</span><span><b>Esc</b> 멈춤</span>`;
    return panel(`<h2>어떻게 움직일까요?</h2><p>손에 맞는 쪽을 고르세요. 고른 방식으로 튜토리얼이 이어집니다.</p><div class="cs-cards">${card('keys', '키보드로 걷기', keyboardArt, [['이동', [k.up, k.left, k.down, k.right].map(keyName).join(' ')], ['기술', skills(k)], ['렌치', '왼쪽 클릭'], ['융합', '오른쪽 클릭']])}${card('mouse', '마우스로 걷기', mouseArt, [['이동', '오른쪽 클릭 (누르면 따라감)'], ['기술', skills(m)], ['렌치', '왼쪽 클릭'], ['융합', keyName(m.fusion)]])}</div><div class="cs-common">두 방식 공통 ${common}</div><div class="actions cs-foot"><p class="notice">환경설정 › 조작 키에서 언제든 바꿀 수 있어요.</p>${button('이걸로 시작', 'controls-start', '', 'primary')}</div>`, 'wide controls-choice');
  }
  function settingsPanel() {
    const settings = game.s.profile.settings, map = bindings();
    const tab = (id, label) => button(label, 'settings-tab', `data-id="${id}" aria-pressed="${settingsTab === id}"`, settingsTab === id ? 'tab on' : 'tab');
    const general = `<div class="settings-grid"><label><input type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}> 효과음</label><label><input type="checkbox" data-setting="music" ${settings.music ? 'checked' : ''}> 배경음악</label><label class="volume">배경음악 크기 <input type="range" min="0" max="100" step="5" data-volume="musicVolume" value="${Math.round(settings.musicVolume * 100)}" aria-label="배경음악 크기"></label><label><input type="checkbox" data-setting="damageNumbers" ${settings.damageNumbers ? 'checked' : ''}> 피해 숫자</label><label><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}> 섬광과 화면 흔들림 줄이기</label></div>${game.s.profile.registered ? `<div class="actions nickname-row"><label for="nickname-input">수리 장부 이름</label><input id="nickname-input" type="text" maxlength="${NICKNAME_MAX}" placeholder="F2" value="${escapeHTML(game.s.profile.nickname || '')}" autocomplete="off" spellcheck="false">${button('바꾸기', 'nickname-save')}</div>${nicknameNote ? `<p class="notice">${escapeHTML(nicknameNote)}</p>` : ''}` : ''}<p class="play-time">총 플레이 시간 <strong>${formatPlayTime(game.s.profile.playSeconds || 0)}</strong></p>${onTitle ? '' : `<div class="divider"></div><div class="actions leave">${button('타이틀 화면으로', 'to-title')}${button('원정 포기', 'abandon', game.s.run ? '' : 'disabled', 'danger')}</div>`}`;
    const byMouse = mouseMove(), scheme = (id, label) => button(label, 'controls', `data-id="${id}" aria-pressed="${(id === 'mouse') === byMouse}"`, (id === 'mouse') === byMouse ? 'tab on' : 'tab');
    const mouseNote = byMouse ? '마우스: 오른쪽 클릭 이동 (누르고 있으면 커서를 따라감), 왼쪽 클릭 렌치' : '마우스: 왼쪽 클릭 렌치, 오른쪽 클릭 융합';
    const keys = `<div class="actions control-scheme"><span>이동 방식</span>${scheme('keys', '키보드 이동 (WASD)')}${scheme('mouse', '마우스 이동 (우클릭)')}</div><p>바꿀 동작을 누른 다음 새 키를 입력하세요. Esc는 취소합니다.</p><div class="binding-list">${Object.keys(byMouse ? mouseBindings : defaultBindings).map(key => `<label class="binding">${bindingNames[key]}${button(bindingTarget === key ? '입력…' : keyName(map[key]), 'rebind', `data-key="${key}"`)}</label>`).join('')}</div><p class="notice">${mouseNote}<br>패드: 왼쪽 스틱 이동, 오른쪽 스틱 조준, RB 렌치, B 회피, X/Y/LB/LT 기술, RT 융합, A 말 걸기, View 지도, Menu 멈춤</p><div class="actions">${button('키 기본값으로', 'reset-bindings')}</div>`;
    const onRun = !onTitle && !!game.s.run, current = settingsTab === 'run' && !onRun ? 'general' : settingsTab;
    const body = current === 'run' ? runPicks() : current === 'stats' && !onTitle ? statsBody() : current === 'keys' ? keys : current === 'devices' ? transferBlock() : general;
    return panel(`<div class="panel-header"><div><h2>${onTitle ? '환경설정' : '잠시 멈춤'}</h2></div>${button('닫기', 'resume', '', 'primary')}</div><div class="codex-tabs">${onRun ? tab('run', '이번 원정') : ''}${!onTitle && game.s.profile.registered ? tab('stats', 'F2 정보') : ''}${tab('general', '설정')}${tab('keys', '조작 키')}${tab('devices', '다른 기기와 연동')}${onTitle ? '' : button('속성 도감', 'codex', '', 'tab')}</div>${body}${storageError ? `<p class="error">${escapeHTML(storageError)}</p>` : ''}`, 'wide settings');
  }

  /** One plain sentence per move, then the numbers and what it leaves on the enemy, as small tags. */
  function codexPanel() {
    const words = data.slice.presentation.codex, element = id => data.combat.elements.find(e => e.id === id);
    const tab = (id, label) => button(label, 'codex-tab', `data-id="${id}" aria-pressed="${codexTab === id}"`, codexTab === id ? 'tab on' : 'tab');
    const status = id => `<span class="tag status"><img src="${assetUrl(STATUS_ICONS[id])}" alt="">${words.statuses[id][0]}</span>`;
    const tags = (move, statuses) => `<div class="tags"><span class="tag">피해 ${move.totalDirectDamage}</span>${move.energyCost ? `<span class="tag">축전 ${move.energyCost}</span>` : ''}<span class="tag">대기 ${move.cooldown}초</span>${statuses.map(status).join('')}</div>`;
    const move = (m, line, statuses, extra = '') => `<div class="codex-move"><img class="move-icon" src="${skillIcon(m.id)}" alt=""><div><h4>${m.name}${extra}</h4><p>${line}</p>${tags(m, statuses)}</div></div>`;
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
      ? `<strong>${stopIcon(room, index)} ${roomTitle(room)}</strong>${room.kind === 'shop' ? '<em>동전으로 수리와 부품을 삽니다.</em>' : `<em>${room.boss ? '보스' : '등장'}: ${stopFoes(room).join(', ')}</em>`}`
      : `<strong>${ico('home')} ${HOME_NAME}</strong><em>원정 출발지</em>`;
    return panel(`<div class="panel-header"><div><h2>태엽 섬 지도</h2></div>${button('닫기', 'resume')}</div><div class="atlas">${worldMapSvg(stops, picked)}</div><p class="atlas-detail">${detail}</p>`, 'atlas-panel');
  }
  /** Where each scrolled box in `root` stands, keyed by its tag, classes and place among boxes like it. */
  function scrollPlaces(root) {
    const places = new Map(), count = new Map();
    for (const box of [root, ...root.querySelectorAll('*')]) {
      const name = `${box.tagName}.${box.className}`, n = count.get(name) || 0; count.set(name, n + 1);
      if (box.scrollTop > 0) places.set(`${name}#${n}`, box.scrollTop);
    }
    return places;
  }
  function restoreScroll(root, places) {
    if (!places.size) return;
    const count = new Map();
    for (const box of [root, ...root.querySelectorAll('*')]) {
      const name = `${box.tagName}.${box.className}`, n = count.get(name) || 0; count.set(name, n + 1);
      const top = places.get(`${name}#${n}`); if (top) box.scrollTop = top;
    }
  }
  function renderOverlay(force = false) {
    const s = game.s, mode = screen || (game.village && !s.panel ? 'walking' : s.mode);
    const key = `${mode}:${s.run?.node}`;
    if (!force && key === overlayKey) return;
    // Redrawing the same sheet (buying a rank, toggling a part) keeps every list where the player had scrolled it.
    const scrolled = key === overlayKey ? scrollPlaces($('overlay')) : null;
    overlayKey = key;
    let html = '';
    if (mode === 'loadError') html = panel(`<h2>저장 파일을 확인해 주세요.</h2><p class="error">${escapeHTML(saveProblem(loadError))}</p><p>새 게임으로 바꾸기 전까지 기존 저장은 그대로 둡니다.</p><div class="actions">${button('새 게임으로 교체', 'confirm-new', '', 'danger')}</div>`, 'compact');
    if (mode === 'confirmNew') html = panel(`<h2>처음부터 다시 할까요?</h2><p>이 브라우저에 저장된 조율, 자유 톱니, 기록이 지워집니다.</p><div class="actions">${button('돌아가기', 'cancel-new')}${button('지우고 새로 시작', 'new-game', '', 'danger')}</div>`, 'compact');
    if (mode === 'confirmTransfer') { const incoming = transfer.incoming; html = panel(`<h2>이 진행으로 바꿀까요?</h2><p>가져올 진행: <b>${escapeHTML(saveSummary(incoming.state, incoming.savedAt, data))}</b><br>지금 이 기기: ${escapeHTML(hasProgress(game.s) ? saveSummary(game.s, localSavedAt(), data) : '진행 없음')}</p><p>이 기기의 지금 진행은 지워집니다.${incoming.syncKey ? '<br>받으면 이 기기도 연결되어 그 뒤로는 저절로 이어집니다.' : ''}</p><div class="actions">${button('돌아가기', 'transfer-cancel')}${button('이 진행으로 바꾸기', 'transfer-apply', '', 'danger')}</div>`, 'compact'); }
    if (mode === 'syncConflict') { const c = syncConflict; html = panel(`<h2>어느 진행으로 할까요?</h2><p>두 기기에서 따로 진행했습니다.</p><p>다른 기기: <b>${escapeHTML(saveSummary(c.state, c.remote.at, data))}</b><br>이 기기: <b>${escapeHTML(hasProgress(game.s) ? saveSummary(game.s, localSavedAt(), data) : '진행 없음')}</b></p><p class="notice">고르지 않은 쪽 진행은 사라집니다.</p><div class="actions">${button('이 기기 진행 유지', 'sync-keep')}${button('다른 기기 진행 받기', 'sync-take', '', 'primary')}</div>`, 'compact'); }
    if (mode === 'confirmAbandon') html = panel(`<h2>원정을 포기할까요?</h2><p>모은 자유 톱니와 기록은 작업대에 남습니다. 장착 속성·임시 부품·동전은 잃습니다.</p><div class="actions">${button('돌아가기', 'cancel-abandon')}${button('원정 포기', 'abandon-confirmed', '', 'danger')}</div>`, 'compact');
    if (mode === 'controls') html = controlsPanel();
    if (mode === 'debug') html = panel(`<h2>어디로 갈까요?</h2><div class="actions">${button('튜토리얼부터 시작', 'debug-tutorial', '', 'primary')}${button('닫기', 'resume')}</div><div class="debug-give"><span>자유 톱니 ${ico('gear')} ${Math.floor(game.s.profile.freeGears)}</span>${[100, 1000, 10000].map(n => button(`+${n}`, 'debug-gears', `data-amount="${n}"`)).join('')}${s.run ? `<span>동전 ${ico('coin')} ${s.run.coins}</span>${[100, 1000].map(n => button(`+${n}`, 'debug-coins', `data-amount="${n}"`)).join('')}` : ''}</div><div class="debug-rooms">${data.slice.rooms.map((room, i) => `<button class="${s.run?.node === i ? 'current' : ''}" data-action="debug-room" data-room="${i}"><small>${String(i + 1).padStart(2, '0')}</small>${room.name}</button>`).join('')}</div><p class="notice">영구 재화는 유지됩니다. 이동하면 지금 방의 진행은 사라지고, 보상은 실제 저장에 쌓입니다.</p>`, 'compact');
    if (mode === 'introDeath') html = panel(`<h2>다시 일어나 볼까요?</h2><p>아직 수리점에 등록하기 전입니다.<br>폐기장 전투의 시작 지점에서 바로 다시 시도합니다.</p><div class="actions">${button('렌치를 다시 잡기', 'intro', '', 'primary')}</div>`, 'compact');
    if (mode === 'hub') html = s.panel === 'elements' ? elementsPanel() : s.panel === 'difficulty' ? difficultyPanel() : tuningPanel();
    if (mode === 'reward') html = rewardsPanel();
    // The night market's shop and the travelling merchant before Brass sell the same things; each has its own once-only list.
    if (mode === 'shop' || mode === 'merchant') html = panel(`${mode === 'merchant' ? '<h2>행진 전에, 하나 챙겨 가.</h2><p>떠돌이 수리상이 브라스의 광장 앞에서 짐을 풀었습니다. 남은 동전을 여기서 쓰세요.</p>' : '<h2>이것도, 아직 쓸 만하지.</h2><p>동전은 이번 원정에만 쓰입니다. 필요한 것부터 골라요.</p>'}<p class="notice">${ico('coin')} 남은 동전 ${s.run.coins}</p><div class="reward-grid">${['heal', 'skillLevel', 'persistentGears'].map(id => {
      const item = data.progression.economy.shop.find(i => i.id === id), sold = item.oncePerShop && (mode === 'merchant' ? s.run.merchantBought || [] : s.run.shopBought).includes(id);
      const unavailable = sold || s.run.coins < item.cost || (id === 'heal' && game.p.hp >= game.p.maxHp) || (id === 'skillLevel' && !game.slots.some(slot => slot.level < data.combat.balance.skillMaxLevel));
      const reason = sold ? '구매 완료' : id === 'heal' && game.p.hp >= game.p.maxHp ? '체력 가득' : id === 'skillLevel' && !game.slots.some(slot => slot.level < data.combat.balance.skillMaxLevel) ? '모두 최고 단계' : s.run.coins < item.cost ? '동전 부족' : '구매';
      return `<article class="reward-card"><span class="reward-icon">${ico({ heal: 'reward-repair', skillLevel: 'reward-skill-level', persistentGears: 'reward-gear-pouch' }[id])}</span><h3>${{ heal: '응급 수리', skillLevel: '정밀 조율', persistentGears: '자유 톱니' }[id]}</h3><p>${{ heal: `HP ${item.amount} 회복 · 상점당 한 번`, skillLevel: '최고 단계가 아닌 첫 속성의 기술 단계 +1', persistentGears: `자유 톱니 ${item.amount}개 · 귀환해도 남음 · 상점당 한 번` }[id]}</p><div class="values">${ico('coin')} ${item.cost} 동전</div>${button(reason, 'shop-buy', `data-id="${id}" ${unavailable ? 'disabled' : ''}`, 'pick')}</article>`;
    }).join('')}</div><div class="actions">${mode === 'merchant' ? button('브라스에게 가기', 'merchant-leave', '', 'primary') : button('닫기', 'close-panel', '', 'primary')}</div>`, 'side shop');
    if (mode === 'unwind') {
      const brass = game.room.boss === 'captainBrass', verb = brass ? '태엽 감아 깨우기' : '명령 회로 뽑기';
      html = panel((brass ? `<h2>일어나, 이번엔 네 박자로.</h2><p>멈춘 태엽을 한 바퀴씩 감아 줍니다.<br>머릿속에서 북을 치던 회로는 다시 넣지 않습니다.</p>` : `<h2>이제 무엇을 주울지는 네가 정해.</h2><p>로코의 집게에 꽂힌 명령 회로를 뽑아냅니다.<br>모으는 손은 남고, 고르는 명령만 사라집니다.</p>`)
        + `<div class="actions">${button(isTouch ? verb : `${keyName(bindings().interact)} · ${verb}`, 'unwind', '', 'primary')}</div>`, 'compact');
    }
    if (mode === 'complete') html = panel(`<p class="tbc">To be continued…</p><h2>1장 · 웃음거리 끝</h2><p>브라스의 태엽을 다시 감았습니다. 순찰 설계도와 첫 인장이 기록됩니다.<br>다음 이야기는 무음공장에서 이어집니다.</p><div class="result-stats"><span><b>${data.slice.rooms.length} / ${data.slice.rooms.length}</b>통과한 구간</span><span><b>${formatTime(s.run.elapsed)}</b>움직인 시간</span><span><b>${s.run.baseGears}</b>기본 자유 톱니</span></div><div class="actions">${button('모루의 수리점으로', 'return-complete', '', 'primary')}</div><p class="notice">수리점으로 돌아가 원정을 다시 떠날 수 있습니다.</p>`, 'compact ending');
    if (mode === 'returned') {
      const result = s.result;
      html = panel(`<h2>${result.reason === 'defeat' ? '고치면 돼. 버리지 말고.' : result.reason === 'clear' ? '네 걸음으로 돌아왔구나.' : '돌아오는 것도 네 선택이지.'}</h2><p>${result.reason === 'defeat' ? '안전핀이 코어를 지켰고, 모루가 같은 몸을 다시 조립했습니다.' : '확보한 자유 톱니와 기록은 작업대에 남았습니다.'}<br>장착 속성·임시 부품·동전·축전은 다음 원정에서 새로 시작합니다.</p><div class="result-stats"><span><b>${result.node} / ${data.slice.rooms.length}</b>${escapeHTML((data.slice.rooms[result.node - 1]?.name || '도달 구간').replace(/ [A-Z]$/, ''))}</span><span><b>${result.elapsed >= 1 ? formatTime(result.elapsed) : '—'}</b>원정 시간</span><span><b>+${result.baseGears}</b>자유 톱니</span></div>${result.elements?.length ? `<p class="result-build">함께 간 속성 ${result.elements.map(id => elementIcon(id, 'inline-element')).join('')}</p>` : ''}${result.bonus ? `<p>첫 귀환 보너스 <strong>${ico('gear')} +${result.bonus}</strong>(한 번만)</p>` : ''}<p class="result-next">${game.s.profile.freeGears >= 10 ? `자유 톱니 ${ico('gear')} ${game.s.profile.freeGears}개가 있습니다. 모루의 조율판에서 체력이나 공격력을 올려 보세요.` : '조금 더 모으면 모루의 조율판에서 능력을 올릴 수 있습니다.'}</p><div class="actions">${button('마을로 나가기', 'acknowledge', '', 'primary')}</div>`, 'side result');
    }
    if (mode === 'pause') html = settingsPanel();
    if (mode === 'codex') html = codexPanel();
    if (mode === 'stats') html = statsPanel();
    if (mode === 'map') html = mapPanel();
    if (html && storageError && mode !== 'pause') html = html.replace('</section>', `<p class="error">${escapeHTML(storageError)}</p></section>`);
    // Re-rendering a sheet must not throw the keyboard back to its first button.
    const was = document.activeElement?.dataset, same = was?.action && ['action', 'key', 'id', 'row'].filter(name => was[name]).map(name => `[data-${name}="${was[name]}"]`).join('');
    $('overlay').innerHTML = html;
    if (onTitle) $('title').inert = !!html;
    // Headings are cut to hard pixels like the title, so every sheet reads as the same form.
    for (const heading of $('overlay').querySelectorAll('h2')) { heading.setAttribute('aria-label', heading.textContent); heading.replaceChildren(pixelText(heading.textContent, 15, '#2b3345')); }
    // Restored once the headings are drawn: the lists only take their final height then, and an earlier value is cut short.
    if (scrolled) restoreScroll($('overlay'), scrolled);
    if (html) { clearInput(); ((same && $('overlay').querySelector(`${same}:not(:disabled)`)) || $('overlay').querySelector('button:not(:disabled)'))?.focus({ preventScroll: true }); }
  }

  function lessonHint() {
    const keys = bindings(), lesson = game.tutorial, moveWord = isTouch ? '왼쪽을 끌어' : mouseMove() ? '우클릭으로' : `${['up', 'left', 'down', 'right'].map(key => keyName(keys[key])).join(' ')} 키로`;
    if (!screen && game.s.mode === 'route' && game.s.run.node === 0) return '노란 표시로 걸어 나가세요';
    if (!screen && game.s.mode === 'combat' && game.bossWarning) return game.bossWarning;
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
      { key: '좌', icon: 'action-wrench' },
      ...[0, 1, 2, 3].map(i => ({ key: keyName(keys['skill' + i]), skill: skills[i]?.skill, level: skills[i]?.slot.level, locked: game.isConfiscated(i) })),
      { key: mouseMove() ? keyName(keys.fusion) : '우', skill: game.fusion, fusion: true },
      { key: keyName(keys.dodge).replace('Space', 'SP'), icon: 'action-dodge', dodge: true }
    ];
  }
  /** What a HUD slot does, for its tooltip: the name, its cost and wait, and the codex's plain sentence. */
  function slotTip(slot) {
    const codex = data.slice.presentation.codex, element = id => data.combat.elements.find(e => e.id === id)?.name;
    if (slot.icon === 'action-wrench') return { title: '렌치 · 좌클릭', text: '세 번 이어 치는 근접 공격입니다. 3타가 가장 강하고 멀리 닿으며, 맞힐 때마다 축전이 찹니다.' };
    if (slot.dodge) return { title: `회피 · ${slot.key}`, text: '짧게 미끄러지며 잠깐 공격을 피합니다. 적이나 탄을 스쳐 지나갈 수 있습니다.', note: `대기 ${data.combat.player.dodge.cooldown}초` };
    if (slot.fusion) return slot.skill
      ? { title: `융합 · ${slot.skill.name} · 우클릭`, text: codex.fusions?.[slot.skill.id] || slot.skill.effect, note: `축전 ${slot.skill.energyCost}이 모이면 쓸 수 있습니다 · 대기 ${slot.skill.cooldown}초` }
      : { title: '융합 · 우클릭', text: '속성 두 개를 장착하면 두 속성을 합친 융합 기술이 열립니다.' };
    if (!slot.skill) return { title: `빈 칸 · ${slot.key}`, text: '모루에게서 속성 부품을 장착하면 이 칸에 기술이 들어갑니다.' };
    const s = slot.skill;
    return { title: `${s.name} · ${element(s.element) || ''} · ${slot.key}`, text: codex.skills?.[s.id] || s.effect, note: [`축전 ${s.energyCost}`, `대기 ${s.cooldown}초`, slot.level > 1 ? `Lv${slot.level}` : '', slot.locked ? '로코에게 빼앗김 · 되찾아야 쓸 수 있음' : ''].filter(Boolean).join(' · ') };
  }
  let tipSlot = -1;
  function showSlotTip(index) {
    const tip = $('skill-tip'), element = $('skills').children[index], slot = hudSlots()[index];
    tipSlot = element && slot ? index : -1;
    if (tipSlot < 0) { tip.hidden = true; return; }
    const { title, text, note } = slotTip(slot);
    tip.innerHTML = `<b>${escapeHTML(title)}</b>${escapeHTML(text)}${note ? `<small>${escapeHTML(note)}</small>` : ''}`;
    // The HUD is drawn at 1120x640 and scaled to the screen, so the slot's place is measured back into HUD pixels.
    const hud = $('hud').getBoundingClientRect(), box = element.getBoundingClientRect(), scale = hud.width / 1120;
    tip.style.left = `${Math.min(1120 - 160, Math.max(160, (box.left + box.width / 2 - hud.left) / scale))}px`;
    tip.style.top = `${(box.top - hud.top) / scale - 8}px`;
    tip.hidden = false;
  }
  $('skills').addEventListener('pointerover', e => { const element = e.target.closest('.slot'); if (element && !isTouch) showSlotTip([...$('skills').children].indexOf(element)); });
  $('skills').addEventListener('pointerleave', () => { tipSlot = -1; $('skill-tip').hidden = true; });
  /** Health fractions where a boss changes phase: where its later patterns unlock, and where Brass adds a march lane. */
  function bossPhaseMarks(ai) {
    const marks = (ai.phasePatterns || []).map(p => p.below).concat(ai.phaseTwoHpFraction ?? []);
    return [...new Set(marks.filter(at => at > 0 && at < 1))].sort((a, b) => b - a);
  }
  /** Writes to the HUD only when a value has changed, so a still frame touches nothing on the page. */
  const written = new WeakMap();
  function put(element, what, value) {
    let last = written.get(element);
    if (!last) written.set(element, last = {});
    if (last[what] === value) return;
    last[what] = value;
    if (what === 'text') element.textContent = value; else if (what === 'hidden') element.hidden = value; else element.style[what] = value;
  }
  /** Seconds left on a slot's cooldown, and its full length. */
  function slotCooldown(slot) {
    const p = game.p, until = slot.dodge ? p.dodgeReady : slot.fusion ? p.fusionReady : slot.skill ? p.cooldowns[slot.skill.id] || 0 : 0;
    return { remaining: Math.max(0, until - game.s.time), total: slot.dodge ? data.combat.player.dodge.cooldown : slot.skill?.cooldown || 1 };
  }
  function updateHUD() {
    const s = game.s, p = game.p, maxEnergy = data.combat.player.maxEnergy, slots = hudSlots();
    put($('hp-fill'), 'width', `calc(${Math.max(0, p.hp / p.maxHp) * 100}% - 4px)`);
    put($('hp-text'), 'text', `${Math.ceil(p.hp)} / ${p.maxHp}`);
    put($('energy-fill'), 'width', `calc(${p.energy / maxEnergy * 100}% - 4px)`);
    put($('energy-text'), 'text', `축전 ${Math.floor(p.energy)}`);
    put($('gears'), 'text', s.profile.freeGears);
    // The boss bar: shown while a boss is in the room, marked where each of its phases begins.
    const boss = s.enemies.find(e => e.boss && e.hp > 0);
    put($('boss-bar'), 'hidden', !boss); $('toast').classList.toggle('below-boss', !!boss);
    if (boss) {
      if ($('boss-bar').dataset.id !== boss.type) {
        $('boss-bar').dataset.id = boss.type;
        put($('boss-name'), 'text', data.combat.bosses.find(b => b.id === boss.type)?.name || boss.name);
        $('boss-marks').innerHTML = bossPhaseMarks(data.slice.bossAI[boss.type]).map(at => `<i style="left:calc(3px + (100% - 6px) * ${at})"></i>`).join('');
      }
      put($('boss-fill'), 'width', `calc((100% - 6px) * ${Math.max(0, boss.hp / boss.maxHp)})`);
      const breaking = boss.breaking, rule = breaking && game.breakRule(boss, breaking.index);
      $('boss-bar').classList.toggle('shielded', !!breaking);
      put($('boss-note'), 'text', breaking ? (breaking.failAt !== null ? '파훼 실패 · 폭발!' : `보호막 · ${breaking.kind === 'cans' ? `깡통 ${breaking.fed}/${rule.cans}` : breaking.kind === 'drums' ? (breaking.phase === 'show' ? '북 순서 보는 중' : `북 ${breaking.next}/${breaking.order.length}`) : `깃발 병정 ${breaking.soldiers.filter(x => x.flag && x.down).length}/${rule.flags}`} · ${Math.max(0, Math.ceil(breaking.until - s.time))}초`) : boss.vulnerableUntil > s.time ? '과부하 · 무방비' : '');
    }
    put($('coins'), 'text', s.run?.coins || 0);
    const slotKey = JSON.stringify(slots.map(({ key, skill, level, icon }) => [key, skill?.id, level, icon, skill?.energyCost]));
    if ($('skills').dataset.key !== slotKey) {
      $('skills').dataset.key = slotKey;
      $('skills').innerHTML = slots.map(slot => {
        const art = slot.icon || slot.skill?.id;
        return `<div class="slot hud-tag ${art ? '' : 'empty'}">${art ? `<img src="${slotArt(art)}" alt="">` : ''}<kbd>${slot.key}</kbd>${slot.level > 1 ? `<span class="lv">Lv${slot.level}</span>` : ''}<div class="cool"></div><div class="left"></div>${slot.skill?.energyCost ? `<span class="cost" title="필요 축전">${slot.skill.energyCost}</span>` : ''}</div>`;
      }).join('');
      // A slot that changed under the pointer (a skill won back, an element swapped) keeps its tooltip up to date.
      if (tipSlot >= 0) showSlotTip(tipSlot);
    }
    [...$('skills').children].forEach((element, i) => {
      const slot = slots[i], { skill } = slot, { remaining, total } = slotCooldown(slot);
      put(element.querySelector('.cool'), 'height', `${Math.min(1, remaining / total) * 100}%`);
      put(element.querySelector('.left'), 'text', remaining > 0 ? remaining.toFixed(1) : '');
      element.classList.toggle('ready', !!slot.fusion && !!skill && !remaining && p.energy >= skill.energyCost);
      // A skill or the fusion without enough charge greys out the same way.
      element.classList.toggle('short', !!skill?.energyCost && p.energy < skill.energyCost);
      // A skill Roco has taken shows a padlock until it is won back.
      element.classList.toggle('locked', !!slot.locked);
    });
    const resetting = game.s.practice?.resetCooldowns;
    put($('practice-reset'), 'hidden', game.s.mode !== 'practice');
    put($('practice-reset'), 'text', `T · 대기시간 초기화 ${resetting ? '켜짐' : '꺼짐'}`);
    $('practice-reset').classList.toggle('on', !!resetting);
    // In Moru's back yard the switch sits on the top-right corner of the skill bar, clear of the wallet at the left.
    if (game.s.mode === 'practice') {
      const bar = $('skills'), button = $('practice-reset');
      if (bar.offsetWidth) {
        // Above the bar's right end, and above the hint line when one is showing over the bar.
        const hint = $('hint'), hud = $('hud').getBoundingClientRect(), k = hud.width / $('hud').offsetWidth || 1;
        const hintTop = hint.hidden || !hint.offsetHeight ? Infinity : (hint.getBoundingClientRect().top - hud.top) / k;
        put(button, 'left', `${bar.offsetLeft + bar.offsetWidth / 2 - button.offsetWidth}px`);
        put(button, 'top', `${Math.round(Math.min(bar.offsetTop, hintTop) - button.offsetHeight - 6)}px`);
      }
    }
    if (isTouch) touch.update(slots.map(slot => {
      const { skill } = slot, { remaining, total } = slotCooldown(slot);
      return { art: slot.icon || skill?.id, cost: skill?.energyCost || 0, share: Math.min(1, remaining / total), left: remaining > 0 ? Math.ceil(remaining) : '', ready: !!slot.fusion && !!skill && !remaining && p.energy >= skill.energyCost, short: !!slot.locked || !!skill?.energyCost && p.energy < skill.energyCost };
    }));
    const hint = lessonHint();
    put($('hint'), 'text', hint);
    put($('hint'), 'hidden', !hint);
    // The back yard's standing instruction sits in the notice line at the top centre, under any fresh notice.
    const notice = s.notices.at(-1)?.text || (!screen && s.mode === 'practice' ? '허수아비에게 기술을 써 보세요 · 노란 표시로 나가면 마을로 돌아갑니다' : '');
    $('toast').classList.toggle('visible', !!notice && game.onFoot);
    put($('toast'), 'text', notice);
  }

  /**
   * Saves this device's progress to the server. The first time (or after the server forgot it) it opens this device's
   * place there; later it is skipped when nothing changed since the last upload, unless asked for by hand.
   */
  async function syncUpload(byHand = false) {
    const played = game.s.profile.playSeconds || 0;
    if (syncBusy || !game.s.profile.registered || (link && !byHand && progressMark(game.s) === link.mark && played - (link.played || 0) < PLAY_UPLOAD_SECONDS)) return;
    syncBusy = true; syncNote = ''; if (screen === 'pause') renderOverlay(true);
    try {
      game.save();
      const save = encodeSave(game.s), at = new Date().toISOString();
      if (link) { const { rev } = await pushSync(link.key, save, link.rev); link = { ...link, rev, mark: progressMark(game.s), at, played }; }
      else { const { key, rev } = await startSync(save); link = { key, rev, mark: progressMark(game.s), at, played }; }
      writeLink(localStorage, link);
    } catch (error) {
      if (error.reason === 'unlinked') { link = null; writeLink(localStorage, null); syncBusy = false; return syncUpload(byHand); }
      // Off-line in the village is normal; only a save asked for by hand reports it.
      if (byHand || error.reason !== 'network') syncNote = error.message;
    }
    syncBusy = false; if (screen === 'pause') renderOverlay(true);
  }
  /** Takes another device's save as this one's. */
  function takeRemote(state, remote) {
    mergePlayTime(state, game.s.profile.playSeconds);
    game.state = state; saveBlocked = false; loadError = ''; game.save(); lastAutosave = state.time; syncMode = state.mode;
    link = { ...link, rev: remote.rev, mark: progressMark(state), at: remote.at }; writeLink(localStorage, link);
  }
  /** On opening the game: bring in newer progress from another device, or ask when both devices moved on. */
  async function syncCheck() {
    if (!link) return;
    let remote;
    try { remote = await pullSync(link.key); } catch (error) { if (error.reason === 'unlinked') { link = null; writeLink(localStorage, null); } return; }
    // Once the player has left the title, the choice waits for the next opening.
    if (!onTitle || screen !== 'title') return;
    const plan = syncPlan(game.s, link, remote);
    if (plan === 'keep') return;
    let state; try { state = decodeSave(remote.save, data); } catch { return; }
    if (plan === 'take') { takeRemote(state, remote); openTitle(); return; }
    syncConflict = { state, remote }; screen = 'syncConflict'; renderOverlay(true);
  }
  async function syncAction(name) {
    if (name === 'sync-now') await syncUpload(true);
    if (name === 'sync-take' && syncConflict) { takeRemote(syncConflict.state, syncConflict.remote); syncConflict = null; openTitle(); }
    // Keeping this device's progress: upload it over the other device's.
    if (name === 'sync-keep' && syncConflict) { link = { ...link, rev: syncConflict.remote.rev }; writeLink(localStorage, link); syncConflict = null; openTitle(); syncUpload(true); }
  }
  async function transferAction(name) {
    const input = $('transfer-input'); if (input) transfer.typed = input.value;
    const busy = async (kind, work) => { transfer.busy = kind; transfer.error = ''; renderOverlay(true); try { await work(); } catch (error) { transfer.error = error.message; } transfer.busy = ''; renderOverlay(true); };
    if (name === 'transfer-send') await busy('send', async () => { if (!link) await syncUpload(true); game.save(); Object.assign(transfer, await sendSave(encodeSave(game.s), undefined, undefined, link?.key)); });
    if (name === 'transfer-copy') { try { await navigator.clipboard.writeText(formatCode(transfer.code)); transfer.error = ''; } catch { transfer.error = '복사하지 못했어요. 코드를 직접 적어 주세요.'; } renderOverlay(true); }
    if (name === 'transfer-fetch') await busy('fetch', async () => {
      const { code, save, syncKey } = await fetchSave(transfer.typed);
      let state; try { state = decodeSave(save, data); } catch (error) { throw new Error('불러오기 실패: ' + saveProblem(error.message)); }
      transfer.incoming = { code, state, syncKey, savedAt: JSON.parse(save).savedAt }; screen = 'confirmTransfer';
    });
    if (name === 'transfer-cancel') { transfer.incoming = null; screen = 'pause'; renderOverlay(true); }
    if (name === 'transfer-apply' && transfer.incoming) {
      const { code, state, syncKey } = transfer.incoming;
      mergePlayTime(state, game.s.profile.playSeconds);
      game.state = state; saveBlocked = false; loadError = ''; game.save(); lastAutosave = state.time; forgetCode(code); syncMode = state.mode;
      // The code came from a synced device: join it, counting from its newest upload so this copy is not pulled over it.
      if (syncKey) {
        link = { key: syncKey, rev: 0, mark: progressMark(state), at: new Date().toISOString() }; writeLink(localStorage, link);
        pullSync(syncKey).then(remote => { if (link?.key === syncKey) { link.rev = remote.rev; writeLink(localStorage, link); } }).catch(() => {});
      }
      transfer = { code: null, expiresAt: null, typed: '', busy: '', error: '', incoming: null };
      resume(); renderOverlay(true); updateHUD();
    }
  }
  async function action(target) {
    const name = target.dataset.action, d = target.dataset;
    openAudio();
    if (name.startsWith('debug-') && !DEBUG_ALLOWED) return;
    if (name === 'debug-tutorial') { leaveTitle(); game.debugRestartTutorial(); resume(); }
    // Test money: free gears for the town's shops and tuning, coins for the run's shop.
    if (name === 'debug-gears' || name === 'debug-coins') {
      const amount = Number(d.amount) || 0;
      if (name === 'debug-gears') game.s.profile.freeGears += amount; else if (game.s.run) game.s.run.coins += amount;
      game.save(); updateHUD(); renderOverlay(true); return;
    }
    if (name === 'debug-room') { leaveTitle(); game.debugJump(Number(d.room)); resume(); }
    if (name === 'intro') game.beginIntro();
    if (name === 'register') game.register();
    if (name === 'close-panel') game.closePanel();
    if (name === 'depart' && game.depart(d.id)) { resume(); renderOverlay(true); updateHUD(); return; }
    let bought = null;
    if (name === 'element') { game.toggleElement(d.id); sfx('equip'); }
    if (name === 'buy-element') {
      const gift = game.nextElementPrice === 0;
      bought = game.buyElement(d.id);
      // Moru's free part is fitted: he says a few words over it, then the village is the player's.
      if (bought && gift) { sfx('buy'); game.closePanel(); await talk('firstElementAfter'); updateHUD(); return; }
    }
    if (name === 'practice') { game.closePanel(); game.enterPractice(); }
    if (name === 'tune-buy') { bought = game.tune(d.row, 'buy'); if (bought) sfx('tune'); }
    if (name === 'refund') game.tune(null, 'refund');
    if (name === 'reroll-card') { bought = game.rerollRewardCard(Number(d.index)); }
    if (name === 'reward') game.chooseReward(Number(d.index), d.replacement === undefined ? null : Number(d.replacement));
    if (name === 'shop-buy') bought = game.buyShop(d.id);
    if (name === 'merchant-leave') game.leaveMerchant();
    if (name === 'unwind') game.unwind();
    if (name === 'nickname-save') { saveNickname(); return; }
    if (name === 'return-complete') game.returnToHub('clear');
    if (name === 'acknowledge') game.acknowledgeReturn();
    if (name === 'abandon') screen = 'confirmAbandon';
    // Back to the title: everything is saved first, and 이어하기 picks up exactly here.
    if (name === 'to-title') { game.save(); sfx('click'); openTitle(); return; }
    if (name === 'cancel-abandon') screen = 'pause';
    if (name === 'abandon-confirmed') { game.returnToHub(game.s.mode === 'complete' ? 'clear' : 'abandon'); resume(); }
    if (name === 'resume') resume();
    if (name === 'codex') pause('codex');
    if (name === 'codex-tab') codexTab = d.id;
    if (name === 'settings-tab') settingsTab = d.id;
    if (name === 'map-stop') mapPick = d.id;
    if (name === 'rebind') bindingTarget = d.key;
    if (name === 'reset-bindings') { game.s.profile.settings[mouseMove() ? 'mouseBindings' : 'bindings'] = {}; game.save(); }
    if (name === 'controls') { game.s.profile.settings.controls = d.id === 'mouse' ? 'mouse' : 'keys'; game.save(); }
    if (name === 'controls-start') { resume(); return; }
    if (name.startsWith('transfer-')) { sfx('click'); await transferAction(name); return; }
    if (name.startsWith('sync-')) { sfx('click'); await syncAction(name); return; }
    // Purchases answer with coins or a refusal; picking a reward and equipping have their own sounds; every other button clicks.
    if (bought !== null) sfx(bought ? 'buy' : 'deny'); else if (!['reward', 'element'].includes(name)) sfx('click');
    if (name === 'confirm-new') screen = 'confirmNew';
    if (name === 'cancel-new') { if (onTitle) { resume(); return; } screen = 'loadError'; }
    if (name === 'new-game') { const fromTitle = onTitle; game.state = new Game(data).s; writePlayTime(localStorage, 0); saveBlocked = false; loadError = ''; lastAutosave = game.s.time; game.save(); if (fromTitle) { playOpening(true); return; } resume(); }
    renderOverlay(true); updateHUD();
    if (game.onFoot && !screen) $('game').focus({ preventScroll: true });
  }
  $('overlay').addEventListener('click', e => { const target = e.target.closest('[data-action]'); if (target && !target.disabled) action(target); });
  $('overlay').addEventListener('input', e => { if (e.target.dataset.volume) game.s.profile.settings[e.target.dataset.volume] = Number(e.target.value) / 100; });
  $('overlay').addEventListener('change', e => {
    const setting = e.target.dataset.setting;
    if (setting) { game.s.profile.settings[setting] = e.target.checked; game.save(); return; }
    if (e.target.dataset.volume) { game.s.profile.settings[e.target.dataset.volume] = Number(e.target.value) / 100; game.save(); return; }
  });
  // The row under the pointer or the keyboard explains itself in the line below the list.
  for (const type of ['focusin', 'pointerover']) $('overlay').addEventListener(type, e => { const row = e.target.closest?.('.stat-row'), hint = $('overlay').querySelector('.stat-hint'); if (row && hint) hint.textContent = row.dataset.tip; });
  $('practice-reset').addEventListener('click', () => { game.togglePracticeReset(); $('game').focus({ preventScroll: true }); });
  // The button enters full screen, or leaves it when already there; its picture shows which.
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen?.() : $('app').requestFullscreen?.())?.catch(() => {});
  $('fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => syncFullscreenIcon($('fullscreen')));
  $('hud-map').addEventListener('click', () => { if (!saveBlocked && !screen) pause('map'); });
  $('hud-menu').addEventListener('click', () => { if (!saveBlocked && !screen) pause(); });
  for (const [id, icon] of [['fullscreen', 'fullscreen'], ['hud-map', 'map'], ['hud-menu', 'settings']]) $(id).insertAdjacentHTML('afterbegin', TOOL_ICONS[icon]);
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
  /** Buttons that commit a choice. A keyboard press never activates them: only a click or a tap does. */
  const DECISIONS = new Set(['reward', 'reroll-card', 'element', 'buy-element', 'depart', 'shop-buy', 'tune-buy', 'refund', 'abandon', 'abandon-confirmed', 'new-game', 'confirm-new', 'sync-take', 'sync-keep', 'transfer-apply', 'to-title']);
  const isDecision = control => !!control?.closest?.('.panel') && (control.matches('.pick') || DECISIONS.has(control.dataset?.action));
  // Space on a button fires its click when the key comes up; a decision swallows that too.
  document.addEventListener('keyup', e => { if ((e.key === ' ' || e.key === 'Enter') && isDecision(document.activeElement)) e.preventDefault(); }, true);
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
    // Reward cards are picked with the mouse only: Space or Enter on a focused card once took it by accident.
    if (sheet.querySelector('.reward-card [data-action="reward"]')) { e.preventDefault(); return true; }
    // Every other choice (an element, a purchase, a difficulty, a refund, giving up a run) is also clicked, never keyed:
    // Space is the dodge, and a press meant for the fight must not buy or decide anything.
    if (isDecision(document.activeElement)) { e.preventDefault(); return true; }
    // A key still held from the fight must not press whatever the sheet focused.
    if (e.repeat) e.preventDefault();
    return document.activeElement?.closest('.panel') === sheet;
  }
  document.addEventListener('keydown', e => {
    if (e.target.id === 'nickname-input' && e.code !== 'Escape') { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); saveNickname(); } e.stopImmediatePropagation(); return; }
    if (e.target.id === 'transfer-input' && e.code !== 'Escape') { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); transferAction('transfer-fetch'); } e.stopImmediatePropagation(); return; }
    if (bindingTarget) {
      e.preventDefault();
      if (e.code !== 'Escape' && !['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) {
        const map = bindings(), old = map[bindingTarget], duplicate = Object.keys(map).find(key => map[key] === e.code && key !== bindingTarget);
        const changed = changedBindings();
        changed[bindingTarget] = e.code;
        if (duplicate) changed[duplicate] = old;
        game.save();
      }
      bindingTarget = null; renderOverlay(true); return;
    }
    if (screen === 'cinematic') return;
    if (screen === 'talk') {
      // Typing a name in the ledger: letters go to the box; Enter answers through the form, Escape keeps what is typed.
      if (e.target.closest?.('.talk-ask')) { if (e.code === 'Escape') { e.preventDefault(); talkBox.skip(); } e.stopImmediatePropagation(); return; }
      const keys = bindings();
      if (e.repeat) return;
      if (e.code === 'Escape') { e.preventDefault(); talkBox.skip(); }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); talkBox.move(e.code === 'ArrowUp' ? -1 : 1); }
      if (['Space', 'Enter', keys.interact].includes(e.code)) { e.preventDefault(); talkBox.advance(); }
      return;
    }
    const sheet = $('overlay').querySelector('.panel');
    if (sheet && sheetKeys(e, sheet)) return;
    if (e.code === 'Escape') { e.preventDefault(); if (e.repeat || saveBlocked || screen === 'title') return; if (screen) resume(); else if (game.s.panel) { game.closePanel(); renderOverlay(); } else pause(); return; }
    if (e.code === 'F9' && DEBUG_ALLOWED) { e.preventDefault(); if (e.repeat || saveBlocked) return; if (screen === 'debug') resume(); else pause('debug'); return; }
    // The first choice of controls waits for a click or Esc; the map and codex keys do not skip it.
    if (screen === 'title' || screen === 'controls') return;
    const map = bindings(), key = Object.keys(map).find(key => map[key] === e.code);
    if (!key && e.code === 'KeyT' && !e.repeat && !screen) game.togglePracticeReset();
    if (!key) return;
    e.preventDefault();
    if (e.repeat) return;
    if (key === 'codex') { if (!saveBlocked) screen === 'codex' ? resume() : pause('codex'); return; }
    if (key === 'map') { if (!saveBlocked) screen === 'map' ? resume() : pause('map'); return; }
    if (key === 'stats') { if (!saveBlocked && game.s.profile.registered) screen === 'stats' ? resume() : pause('stats'); return; }
    if (screen) return;
    // Talking to Moru, the night market and everyone else is the interact key (G) alone; the skill keys never talk.
    if (key === 'interact') { interact(); return; }
    if (!game.onFoot) {
      return;
    }
    openAudio(); held.add(e.code);
    // Moving with the mouse, a dodge goes toward the cursor and ends the walk to the clicked spot.
    if (key === 'dodge') { pending.dodge = true; if (mouseMove()) moveTarget = null; }
    if (key === 'fusion') pending.fusion = true;
    if (key.startsWith('skill')) pending.skill = Number(key.at(-1));
  });
  document.addEventListener('keyup', e => held.delete(e.code));
  function mousePosition(e) {
    const rect = $('game').getBoundingClientRect(), scale = Math.min(rect.width / 1120, rect.height / 640);
    pointer = { x: (e.clientX - rect.left - (rect.width - 1120 * scale) / 2) / scale / PIXELS_PER_UNIT + renderer.camera.x, y: (e.clientY - rect.top - (rect.height - 640 * scale) / 2) / scale / PIXELS_PER_UNIT + renderer.camera.y };
    renderer.pointer = pointer;
  }
  /**
   * The mouse buttons as they are now. A second button pressed while one is held comes as a pointermove, not a
   * pointerdown, so every pointer event reads the whole set. Right is the fusion, or (moving with the mouse) the walk.
   */
  function mouseButtons(e, canPress) {
    const left = !!(e.buttons & 1), right = !!(e.buttons & 2), pressed = right && !rightHeld;
    if (mouseMove()) { moveHeld = right && (canPress || moveHeld); if (pressed && canPress) { moveTarget = { ...pointer }; stuckSteps = 0; } }
    else if (pressed && canPress) pending.fusion = true;
    rightHeld = right; mouseHeld = left && (canPress || mouseHeld);
  }
  const canClick = () => (game.active || game.leaving || game.walking) && !screen;
  $('game').addEventListener('pointermove', e => { if (isTouch) return; lastMouse = { clientX: e.clientX, clientY: e.clientY }; mousePosition(e); mouseButtons(e, canClick()); });
  $('game').addEventListener('pointerdown', e => { if (!canClick() || isTouch) return; e.preventDefault(); openAudio(); lastMouse = { clientX: e.clientX, clientY: e.clientY }; mousePosition(e); $('game').focus({ preventScroll: true }); mouseButtons(e, true); });
  document.addEventListener('pointerup', e => { if (!isTouch) mouseButtons(e, false); });
  $('game').addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { clearInput(); if (game.active && screen !== 'talk') pause(); game.save(); });
  // Checking in while the game is on screen: the admin page sees who is playing and where, and gifts sent from it
  // arrive here (Game.receiveGifts). Never from a local test server.
  const mail = mailbox({ storage: localStorage, hostname: location.hostname, protocol: location.protocol });
  const place = () => (onTitle || ['opening', 'intro', 'introDeath', 'registration'].includes(game.s.mode) ? 'title' : game.s.run ? 'run' : game.s.mode === 'practice' ? 'practice' : 'hub');
  let lastPing = 0;
  const checkIn = async () => {
    if (!mail || document.hidden || Date.now() - lastPing < 20000) return;
    lastPing = Date.now();
    const gifts = await mail.ping({ name: game.s.profile.nickname || '', where: place(), node: game.s.run ? game.s.run.node + 1 : 0, gears: Math.max(0, Math.floor(game.s.profile.freeGears)), playSeconds: Math.max(0, Math.floor(game.s.profile.playSeconds || 0)) });
    if (gifts.length) mail.claim(game.receiveGifts(gifts));
  };
  if (mail) { setTimeout(checkIn, 3000); setInterval(checkIn, PING_SECONDS * 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkIn(); }); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) writePlayTime(localStorage, game.s.profile.playSeconds || 0); if (document.hidden && game.active && screen !== 'talk') { pause(); game.save(); } if (!document.hidden) audio?.resume().catch(() => {}); });
  window.addEventListener('pagehide', () => { writePlayTime(localStorage, game.s.profile.playSeconds || 0); game.save(); });
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

  // Where F2 stood before the last rules step: the picture is drawn between that and now (the rules run 60 times a second, screens often faster).
  let drawnFrom = null;
  let lastTime = performance.now(), accumulator = 0, bellWasRinging = false, lastChargeAt = -1, lastBossTellAt = -1;
  function frame(now) {
    const delta = Math.min(0.1, (now - lastTime) / 1000); lastTime = now; accumulator += delta * (now < slowUntil ? SLOW_RATE : 1);
    bringPlaceForward();
    // Play time leaves out the title, the settings / pause menu and a hidden tab.
    if (!onTitle && screen !== 'pause' && !document.hidden) game.addPlayTime(delta);
    // The device keeps the play clock every few seconds; the village sends it to the server every five minutes of play.
    const played = game.s.profile.playSeconds || 0;
    if (played - lastPlayWrite >= 5) { writePlayTime(localStorage, played); lastPlayWrite = played; }
    if (game.s.mode === 'hub' && played - (link?.played || 0) >= PLAY_UPLOAD_SECONDS && now - lastPlayUpload > 60000) { lastPlayUpload = now; syncUpload(); }
    // Back in the village: the moment progress is uploaded for the other devices.
    if (game.s.mode !== syncMode) { if (game.s.mode === 'hub' && syncMode && syncMode !== 'hub') syncUpload(); syncMode = game.s.mode; }
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
    // After the waking lines, before the first step: how F2 is moved (touch has one way and skips it).
    if (game.s.mode === 'intro' && !screen && game.tutorial.takeAwakening()) talk('awakening').then(() => { if (!isTouch && game.s.mode === 'intro') { pause('controls'); $('overlay').querySelector('[data-action="controls-start"]')?.focus({ preventScroll: true }); } });
    const pad = pollGamepad(), map = bindings();
    if (isTouch) { touch.show(game.onFoot && !screen, !!game.nearbyNpc); pointer = autoAim(game.p, game.s.enemies); }
    if (pad?.dodge) pending.dodge = true;
    if (pad?.fusion) pending.fusion = true;
    if (pad?.skill !== undefined) pending.skill = pad.skill;
    // Moving with the mouse: the cursor stays on the same spot of the floor while the camera follows F2, and a held
    // right button keeps the walk on the cursor. A new room or screen drops the walk.
    if (mouseMove() && lastMouse && !screen) { mousePosition(lastMouse); if (moveHeld) moveTarget = { ...pointer }; }
    if (movedIn !== game.room || screen) { moveTarget = null; movedIn = game.room; }
    while (accumulator >= 1 / 60) {
      // A landed hit holds the rules still for a few frames; input pressed meanwhile waits for the next step.
      if (hitstop > 0) { hitstop -= 1 / 60; accumulator -= 1 / 60; drawnFrom = { x: game.p.x, y: game.p.y }; continue; }
      const walk = walkToTarget();
      const input = screen === 'talk' ? {} : { x: Number(held.has(map.right)) - Number(held.has(map.left)) + (pad?.x || 0) + (touch?.move.x || 0) + walk.x, y: Number(held.has(map.down)) - Number(held.has(map.up)) + (pad?.y || 0) + (touch?.move.y || 0) + walk.y, aim: pointer, basic: mouseHeld || pad?.basic || touch?.attacking, ...pending };
      drawnFrom = { x: game.p.x, y: game.p.y }; game.update(1 / 60, input); pending = {}; accumulator -= 1 / 60; feelHits();
      noteWalk(walk);
    }
    if (game.s.time - lastAutosave >= 5) { game.save(); lastAutosave = game.s.time; }
    // Every ordinary enemy's wind-up gets the same short ping, once per tell.
    const charging = game.s.enemies.find(e => !e.boss && e.hp > 0 && e.tell && e.tell.started > lastChargeAt);
    if (charging) { lastChargeAt = Math.max(...game.s.enemies.filter(e => !e.boss && e.tell).map(e => e.tell.started)); sfx('tell', () => beep(880, 0.1, 0.015)); }
    const bossTell = game.s.enemies.find(e => ['bell', 'alarm'].includes(e.tell?.type) && e.tell.started > lastBossTellAt);
    if (bossTell) { lastBossTellAt = bossTell.tell.started; if (bossTell.tell.type === 'bell') toll(); else sfx('alarm'); }
    // The swing itself is only air; what it hits is voiced by feelHits.
    const swing = game.s.effects.findLast(f => f.type === 'swing');
    // A swing is heard once: as the blow if it lands, as a soft whoosh only if it hits nothing.
    if (swing && swing.id !== lastSoundId) { lastSoundId = swing.id; if (performance.now() - landedAt > 40) pendingWhoosh = { at: performance.now() + WHOOSH_WAIT_MS, heavy: swing.phase === 2 }; }
    if (pendingWhoosh && performance.now() >= pendingWhoosh.at) { const { heavy } = pendingWhoosh; pendingWhoosh = null; sfx(heavy ? 'swingHeavy' : 'swing', () => noise(0.07, 0.035, heavy ? 600 : 900, 0.7)); }
    playMusic(); wipeIn();
    // The hour of the place: bright street, the night market and everything after it at dusk, Brass's square at night.
    const roomNow = game.s.run && ['combat', 'reward', 'route', 'shop', 'merchant', 'unwind', 'complete'].includes(game.s.mode) ? game.s.run.node : -1;
    renderer.mood = roomNow < 0 ? 'day' : game.room?.kind === 'regionBoss' || roomNow === REST_INDEX ? 'night' : roomNow > REST_INDEX ? 'dusk' : 'day';
    mapArt.prepareNextFloor();
    const controlsLabel = mouseMove() ? '우클릭 이동, 마우스 조준, 좌클릭 공격, QWER 기술, Space 회피' : 'WASD 이동, 마우스 조준, 좌클릭 공격, Space 회피';
    if ($('game').getAttribute('aria-label') !== controlsLabel) $('game').setAttribute('aria-label', controlsLabel);
    renderer.moveTarget = moveTarget; renderer.talkKey = isTouch ? '▸' : keyName(map.interact); renderer.talking = screen === 'talk'; drawBetween(() => renderer.render(delta)); $('minimap').hidden = onTitle || !renderer.drawMinimap($('minimap')); document.body.classList.toggle('has-minimap', !$('minimap').hidden); renderOverlay(); updateHUD(); requestAnimationFrame(frame);
  }
  /** One step of the walk to the clicked spot: a direction, or none once F2 is there. */
  function walkToTarget() {
    if (!moveTarget || screen) return { x: 0, y: 0 };
    const dx = moveTarget.x - game.p.x, dy = moveTarget.y - game.p.y, gap = Math.hypot(dx, dy);
    if (gap < ARRIVE_DISTANCE) { if (!moveHeld) moveTarget = null; return { x: 0, y: 0 }; }
    return { x: dx / gap, y: dy / gap };
  }
  /** A walk that runs into a wall stops after a moment instead of pushing at it; a swing or dodge in the way does not count. */
  function noteWalk(walk) {
    if (!moveTarget || moveHeld || (!walk.x && !walk.y) || game.p.attack || game.p.dodge) { stuckSteps = 0; return; }
    stuckSteps = Math.hypot(game.p.x - drawnFrom.x, game.p.y - drawnFrom.y) < 0.004 ? stuckSteps + 1 : 0;
    if (stuckSteps > STUCK_STEPS) moveTarget = null;
  }
  /** Draws F2 (and the camera on F2) part of the way from the last step to this one, so a dash or walk glides instead of stepping. */
  function drawBetween(draw) {
    const p = game.p, from = drawnFrom;
    if (!p || !from || Math.hypot(p.x - from.x, p.y - from.y) > 1.5) { draw(); return; }
    const x = p.x, y = p.y, t = Math.min(1, accumulator * 60);
    p.x = from.x + (x - from.x) * t; p.y = from.y + (y - from.y) * t;
    try { draw(); } finally { p.x = x; p.y = y; }
  }
  const talkBox = new DialogueBox($('dialogue'), data.dialogue, { reducedMotion, skipLabel: isTouch ? '건너뛰기 ▸▸' : 'Esc 건너뛰기', nameOf: id => (id === data.dialogue.player ? callName(game.s.profile) : data.dialogue.speakers[id].name), fill: text => fillName(text, game.s.profile) });
  $('dialogue').addEventListener('pointerdown', e => { openAudio(); if (e.target.closest('.talk-skip')) talkBox.skip(); else if (!e.target.closest('button, .talk-ask')) talkBox.advance(); });
  const title = new TitleScreen($('title'), {
    // The player's sheets keep loading behind the title; leaving it waits for them, so F2 is never drawn without them.
    onNew: () => { openAudio(); playerSprites.then(startNew); },
    onLoad: () => { openAudio(); playerSprites.then(() => { leaveTitle(); resume(); }); },
    onSettings: () => { screen = 'pause'; renderOverlay(true); },
    // The stamp lands with a heavy 쾅 (sfx.js stamp); the old low beep is only the fallback.
    onThud: () => { openAudio(); const paused = game.s.paused; game.s.paused = false; sfx('stamp', () => beep(70, 0.2, 0.09)); game.s.paused = paused; },
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
      else if (name === 'fullscreen') toggleFullscreen();
    });
    document.addEventListener('pointerdown', openAudio, { once: true });
  }
  if (!loadError) { openTitle(); syncCheck(); }
  renderOverlay(true); updateHUD(); requestAnimationFrame(frame);
  // The loading card stays until the title's paper form is drawn, so nobody sees an empty frame. Only the title waits:
  // the player's skill sheets, place art and the other songs come after, so they do not slow the first screen.
  await title.ready.catch(() => {});
  markTitleDrawn(); fetchImages();
  await startSound();
  finishBoot();
  fetchImages();
} catch (error) {
  finishBoot();
  // Anyone with the link can land here, so the local-server advice is for this machine only.
  const local = ['localhost', '127.0.0.1'].includes(location.hostname), reload = '<div class="actions"><button class="primary" onclick="location.reload()">다시 불러오기</button></div>';
  $('overlay').innerHTML = `<section class="panel compact"><h2>게임을 불러오지 못했습니다</h2>${local ? `<p class="error">${escapeHTML(error.message)}</p><p>프로젝트 폴더에서 <code>npm start</code>를 실행한 뒤 <a href="http://localhost:4173">localhost:4173</a>을 열어 주세요.</p>` : '<p>인터넷 연결을 확인한 뒤 다시 불러와 주세요. 진행 기록은 이 브라우저에 그대로 남아 있습니다.</p>'}${reload}</section>`;
  const heading = $('overlay').querySelector('h2');
  heading.setAttribute('aria-label', heading.textContent); heading.replaceChildren(pixelText(heading.textContent, 15, '#2b3345'));
  console.error(error);
}
