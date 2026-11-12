// The admin page (admin.html): reads the play statistics summary from the worker (worker/stats.js) with the admin
// token the owner typed in, and lays it out as one compact dashboard. The token stays in this browser only.
// Two tabs: 통계 (the summary) and 유저 (each device: when it was last seen, where it is now, gifts of free gears, and a
// transfer code made from its newest uploaded save, 2026-11-12).
import { apiBase } from './device-transfer.js';
import { formatCode } from '../engine/transfer-code.js';

const TOKEN_KEY = 'beyond-the-clockwork.admin-token.v1';
const RANGES = [[7, '7일'], [30, '30일'], [0, '전체']];
const FORMS = { phone: '휴대폰', tablet: '태블릿', desktop: 'PC' };
const SYSTEMS = { ios: 'iOS', android: '안드로이드', windows: '윈도우', mac: 'macOS', chromeos: '크롬OS', linux: '리눅스', other: '기타' };
const BROWSERS = { chrome: '크롬', safari: '사파리', samsung: '삼성', whale: '웨일', edge: '엣지', firefox: '파이어폭스', inapp: '앱 안', other: '기타' };
const REASONS = { clear: '완주', defeat: '쓰러짐', abandon: '포기', open: '진행 중' };
/** Expedition difficulties as the game names them; runs from before difficulties existed show as 이전. */
const LEVELS = { easy: '쉬움', normal: '보통', hard: '어려움', legacy: '이전' };
const LEVEL_COLORS = { easy: 'var(--good)', normal: 'var(--blue)', hard: 'var(--bad)', legacy: 'var(--blue-3)' };
const levelChip = id => (id ? `<span class="chip level ${esc(id)}">${LEVELS[id] || esc(id)}</span>` : '<span class="chip level legacy">이전</span>');
const WEEKDAYS = '일월화수목금토';
/** Shares in one family of blues and greys, biggest first. */
const SHARE_COLORS = ['var(--blue)', 'var(--blue-2)', 'var(--blue-3)', 'var(--blue-4)'];
const DAY_ROWS = 14;

const app = document.getElementById('app'), tip = document.getElementById('tip');
const state = {
  tab: sessionStorage.getItem('admin-tab') === 'users' ? 'users' : 'stats', days: [7, 30, 0].includes(Number(sessionStorage.getItem('admin-days') ?? 30)) ? Number(sessionStorage.getItem('admin-days') ?? 30) : 30, level: sessionStorage.getItem('admin-level') || '', data: null, names: null, allDays: false, at: null,
  levelChapter: sessionStorage.getItem('admin-level-chapter') || '',
  people: null, q: '', onlineOnly: false, shown: 20, picked: null, detail: null, confirm: 0, said: '', code: null, codeInherit: false, search: null, restore: null, restoreConfirm: 0
};
const PLACES = { title: '타이틀', hub: '마을', practice: '연습장' };
const GIFT_PRESETS = [100, 500, 1000];
const USERS_REFRESH_SECONDS = 30;
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const num = value => Number(value || 0).toLocaleString('ko-KR');
const pct = (part, whole) => (whole ? Math.round(part / whole * 100) : 0);
const clock = seconds => { if (seconds === null || seconds === undefined) return '–'; const m = Math.floor(seconds / 60), s = seconds % 60; return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분 ${String(s).padStart(2, '0')}초`; };
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const shortDay = day => `${day.slice(5, 7)}.${day.slice(8)}`;
const weekday = day => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];

/** Element, fusion and room names from the game's own data, so the page never spells them differently. */
async function loadNames() {
  const [combat, slice] = await Promise.all(['combat', 'slice'].map(name => fetch(`src/data/${name}.json`).then(r => r.json()).catch(() => ({}))));
  const order = slice.elements || [];
  const elements = Object.fromEntries((combat.elements || []).map(e => [e.id, e.name]));
  const fusions = Object.fromEntries((combat.fusions || []).map(f => [[...f.pair].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('+'), f]));
  const firstSkill = Object.fromEntries((combat.elements || []).map(e => [e.id, (combat.skills || []).find(s => s.element === e.id)?.id]));
  return { elements, fusions, firstSkill, colors: slice.presentation?.colors || {}, rooms: (slice.rooms || []).map(r => r.name), chapters: (slice.chapters || []).map(c => ({ id: c.id, number: c.number, name: c.name })) };
}

function comboCell(combo) {
  const { elements, fusions, firstSkill, colors } = state.names, parts = combo ? combo.split('+') : [];
  if (!parts.length) return `<div class="combo"><img src="art/ui/icons/px/action-wrench.png" alt=""><span>렌치만</span></div>`;
  const fusion = fusions[combo], icon = fusion ? `skill-${fusion.id}` : `skill-${firstSkill[parts[0]]}`;
  const title = parts.map(p => elements[p] || p).join(' + ');
  return `<div class="combo" title="${esc(title)}"><img src="art/ui/icons/px/${esc(icon)}.png" alt=""><span>${esc(fusion ? fusion.name : `${title} 하나`)}</span><span class="sw">${parts.map(p => `<i style="background:${esc(colors[p] || '#999')}"></i>`).join('')}</span></div>`;
}

function login(message = '') {
  app.innerHTML = `<form class="card login" id="login">
    <h1>운행 장부</h1><p class="mute">태엽 밖으로 · 관리자 전용</p>
    <label for="token">관리자 토큰</label>
    <input id="token" type="password" autocomplete="current-password" required minlength="24" placeholder="Cloudflare에 넣은 ADMIN_TOKEN">
    <button class="primary" type="submit">장부 열기</button>
    ${message ? `<p class="error">${esc(message)}</p>` : ''}
    <p class="hint">토큰은 이 브라우저에만 남아요. 공용 기기에서는 다 본 뒤 ‘잠그기’를 눌러 주세요.</p>
  </form>`;
  document.getElementById('login').addEventListener('submit', event => {
    event.preventDefault();
    try { localStorage.setItem(TOKEN_KEY, document.getElementById('token').value.trim()); } catch {}
    load();
  });
  document.getElementById('token').focus();
}

function problem(message) {
  app.innerHTML = `<div class="card login"><h1>운행 장부</h1><p class="error">${esc(message)}</p><button class="primary" data-act="reload">다시 불러오기</button><p class="hint"><button class="link" data-act="lock">잠그기</button></p></div>`;
}

/** One admin request with the token; null after the failure has been shown (wrong token, no server, …). */
async function request(path, options = {}) {
  let response;
  try { response = await fetch(`${apiBase()}${path}`, { ...options, headers: { Authorization: `Bearer ${token()}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store' }); }
  catch { problem('서버에 닿지 않아요. 인터넷 연결을 확인하고 다시 불러오세요.'); return null; }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch {} login('토큰이 맞지 않아요. Cloudflare의 ADMIN_TOKEN 값을 그대로 넣어 주세요.'); return null; }
  if (response.status === 503) { problem('통계 서버 설정이 아직 끝나지 않았어요. D1 데이터베이스 연결과 24글자 이상의 ADMIN_TOKEN이 필요해요(DEPLOY.md “플레이 통계”).'); return null; }
  return { ok: response.ok, status: response.status, body };
}

async function load() {
  if (!token()) return login();
  state.names ??= await loadNames();
  if (state.tab === 'users') return loadPeople(true);
  if (!state.data) app.innerHTML = '<p class="empty">불러오는 중…</p>';
  const answer = await request(`/api/admin/stats?days=${state.days}${state.level ? `&difficulty=${state.level}` : ''}`);
  if (!answer) return;
  if (!answer.ok) return problem('서버에 문제가 생겼어요. 잠시 뒤 다시 불러오세요.');
  state.data = answer.body; state.at = new Date(); render();
}

/** The bar on top of both tabs: the tabs themselves, when the numbers were read, and the page's own buttons. */
const topBar = () => `<header class="bar-top"><div class="in">
  <div class="brand">운행 장부<span class="mute" style="font-weight:400"> · 태엽 밖으로</span></div>
  <nav class="range" aria-label="화면">${[['stats', '통계'], ['users', '유저']].map(([id, label]) => `<button data-tab="${id}" aria-pressed="${state.tab === id}">${label}</button>`).join('')}</nav>
  <span class="stamp">${state.at ? `${state.at.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} 기준` : ''}</span>
  <button class="link" data-act="theme">${document.documentElement.dataset.theme === 'paper' ? '어둡게' : '종이'}</button><button class="link" data-act="reload">새로고침</button><button class="link" data-act="lock">잠그기</button>
</div></header>`;

const niceStep = max => { const raw = max / 3, power = 10 ** Math.floor(Math.log10(raw)); return Math.max(1, [1, 2, 5, 10].map(m => m * power).find(s => s >= raw)); };
/** A column with a 4px rounded top, square on the baseline. */
const column = (x, base, width, h, fill) => { if (h <= 0) return ''; const r = Math.min(4, width / 2, h); return `<path class="bar" fill="${fill}" d="M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + width - r} Q${x + width},${base - h} ${x + width},${base - h + r} V${base} Z"/>`; };
/** The value grid on the left: three or four lines, numbers in the muted ink. */
const axis = (W, top, plotH, left, ceiling, step) => { let out = ''; for (let v = 0; v <= ceiling; v += step) { const y = top + plotH - v / ceiling * plotH; out += `<line class="grid-line" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/><text x="${left - 6}" y="${y + 3}" text-anchor="end">${num(v)}</text>`; } return out; };

/** Plays per day as columns, devices that day as a white line over them. */
function dailyChart(W, daily) {
  if (!daily.length) return '<p class="empty">아직 기록이 없어요.</p>';
  const H = 170, left = 28, top = 6, bottom = 20, plotW = W - left, plotH = H - top - bottom;
  const max = Math.max(1, ...daily.map(d => Math.max(d.sessions, d.devices))), step = niceStep(max), ceiling = Math.ceil(max / step) * step;
  const band = plotW / daily.length, width = Math.min(24, Math.max(2, band * 0.62)), base = top + plotH, y = v => base - v / ceiling * plotH;
  const every = Math.ceil(daily.length / Math.max(3, Math.floor(plotW / 44)));
  const cx = i => left + i * band + band / 2;
  const line = daily.map((d, i) => `${i ? 'L' : 'M'}${cx(i)},${y(d.devices)}`).join(' ');
  const dots = daily.length <= 31 ? daily.map((d, i) => `<circle cx="${cx(i)}" cy="${y(d.devices)}" r="2.5" fill="var(--trace)" stroke="var(--card)" stroke-width="2"/>`).join('') : '';
  const cols = daily.map((d, i) => `<g data-tip="${esc(`${d.day} (${weekday(d.day)}) · 플레이 ${num(d.sessions)} · 기기 ${num(d.devices)} · 원정 ${num(d.runs)}`)}"><rect class="hit" x="${left + i * band}" y="${top}" width="${band}" height="${plotH}"/>${column(cx(i) - width / 2, base, width, base - y(d.sessions), 'var(--blue)')}${(daily.length - 1 - i) % every === 0 ? `<text x="${cx(i)}" y="${H - 4}" text-anchor="middle">${i === daily.length - 1 ? '오늘' : shortDay(d.day)}</text>` : ''}</g>`).join('');
  return `<svg width="${W}" height="${H}" role="img" aria-label="날짜별 플레이 수와 기기 수">${axis(W, top, plotH, left, ceiling, step)}${cols}<path d="${line}" fill="none" stroke="var(--trace)" stroke-width="1.5" stroke-linejoin="round" pointer-events="none"/><g pointer-events="none">${dots}</g></svg>`;
}

/** Where expeditions ended: one column per stop; the last stop's column (cleared runs) in green. */
function depthChart(W, depth, rooms) {
  const total = depth.reduce((sum, d) => sum + d.runs, 0);
  if (!total) return '<p class="empty">끝난 원정이 아직 없어요.</p>';
  const count = Math.max(rooms.length, ...depth.map(d => d.node)), H = 170, top = 14, bottom = 20, plotH = H - top - bottom, base = top + plotH;
  const max = Math.max(1, ...depth.map(d => d.runs)), band = W / count, width = Math.min(18, band * 0.62);
  return `<svg width="${W}" height="${H}" role="img" aria-label="원정이 끝난 정거장">${Array.from({ length: count }, (_, i) => {
    const d = depth.find(row => row.node === i + 1) || { runs: 0, clears: 0 }, cx = i * band + band / 2, h = d.runs / max * plotH;
    return `<g data-tip="${esc(`${i + 1}번째 · ${rooms[i] || ''} · ${num(d.runs)}판 (${pct(d.runs, total)}%)${d.clears ? ` · 완주 ${num(d.clears)}` : ''}`)}"><rect class="hit" x="${i * band}" y="0" width="${band}" height="${H}"/>${column(cx - width / 2, base, width, h, d.clears ? 'var(--good)' : 'var(--blue)')}<text x="${cx}" y="${H - 4}" text-anchor="middle">${i + 1}</text></g>`;
  }).join('')}<line class="grid-line" x1="0" x2="${W}" y1="${base}" y2="${base}"/></svg>`;
}

/** A ring of shares with its legend: the biggest three by name, the rest as one grey slice. */
function donut(rows, names, unit) {
  const total = rows.reduce((sum, r) => sum + r.devices, 0);
  if (!total) return '<p class="empty">아직 기록이 없어요.</p>';
  const top = rows.slice(0, 3).map((r, i) => ({ label: names[r.name] || '기타', value: r.devices, color: SHARE_COLORS[i] }));
  const rest = rows.slice(3).reduce((sum, r) => sum + r.devices, 0);
  if (rest) top.push({ label: '그 밖', value: rest, color: SHARE_COLORS[3] });
  const R = 44, C = 2 * Math.PI * R; let at = 0;
  const arcs = top.map(s => { const len = s.value / total * C, gap = top.length > 1 ? 2 : 0, arc = `<circle r="${R}" cx="56" cy="56" fill="none" stroke="${s.color}" stroke-width="14" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-at}" transform="rotate(-90 56 56)"><title>${esc(s.label)} ${num(s.value)}${unit}</title></circle>`; at += len; return arc; }).join('');
  return `<div class="donut"><svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="기기 형태 비율">${arcs}<text x="56" y="58" text-anchor="middle" style="fill:var(--text);font-size:18px;font-weight:800">${num(total)}</text><text x="56" y="73" text-anchor="middle">${unit}</text></svg>
    <ul>${top.map(s => `<li><span><span class="dot" style="background:${s.color}"></span>${esc(s.label)}</span><b>${pct(s.value, total)}%</b></li>`).join('')}</ul></div>`;
}
const shareLine = (rows, names) => { const total = rows.reduce((sum, r) => sum + r.devices, 0); return rows.slice(0, 3).map(r => `${names[r.name] || '기타'} ${pct(r.devices, total)}%`).join(' · ') || '–'; };

/** The difficulty cards' chapter: '' for every chapter, else a chapter id (2026-11-09). Runs from before chapters were reported count as chapter 1's. */
function shownLevels() {
  const by = state.data.difficultiesByChapter || {};
  return state.levelChapter ? by[state.levelChapter] || [] : state.data.difficulties || [];
}
function chapterTabs() {
  const chapters = state.names?.chapters || [];
  if (chapters.length < 2) return '';
  return `<div class="seg chapter-seg" role="group" aria-label="장">${[['', '전체'], ...chapters.map(c => [c.id, `${c.number}장 ${c.name}`])].map(([id, label]) => `<button data-levelchapter="${esc(id)}" aria-pressed="${(state.levelChapter || '') === id}">${esc(label)}</button>`).join('')}</div>`;
}

/** One card per difficulty: how many expeditions chose it (and its share), how they ended, how far and how long. */
function levelCards(rows) {
  const total = rows.reduce((sum, row) => sum + row.runs, 0);
  if (!total) return '<div class="card"><p class="empty">아직 원정 기록이 없어요.</p></div>';
  return rows.map(row => {
    const done = row.clears + row.defeats + row.abandons;
    return `<button class="card level-card" data-level="${row.difficulty === 'legacy' ? '' : esc(row.difficulty)}" aria-pressed="${state.level === row.difficulty}" style="--level:${LEVEL_COLORS[row.difficulty]}">
      <div class="label"><span class="dot" style="background:var(--level)"></span>${LEVELS[row.difficulty] || esc(row.difficulty)}</div>
      <div class="value num">${num(row.runs)}<small>판</small><span class="delta mute">${pct(row.runs, total)}%</span></div>
      <div class="track"><i style="width:${pct(row.runs, total)}%;background:var(--level)"></i></div>
      <div class="note">완주율 <b>${done ? `${pct(row.clears, done)}%` : '–'}</b> · 평균 ${row.averageNode ?? '–'}번째 · ${clock(row.averageSeconds)}</div>
      <div class="note">완주 ${num(row.clears)} · 쓰러짐 ${num(row.defeats)} · 포기 ${num(row.abandons)}${row.unfinished ? ` · 진행 중 ${num(row.unfinished)}` : ''} · 기기 ${num(row.devices)}</div>
    </button>`;
  }).join('');
}

function render() {
  const { totals, daily, devices, combos, recent } = state.data, ended = totals.clears + totals.defeats + totals.abandons;
  const today = daily.at(-1) || { sessions: 0, devices: 0, runs: 0, clears: 0 }, yesterday = daily.at(-2);
  const change = yesterday ? today.sessions - yesterday.sessions : 0;
  const delta = yesterday && change ? `<span class="delta ${change > 0 ? 'up' : 'down'}" title="어제보다">${change > 0 ? '▲' : '▼'}${num(Math.abs(change))}</span>` : '';
  const rangeLabel = state.days ? `최근 ${state.days}일` : '전체 기간';
  const maxDay = Math.max(1, ...daily.map(d => d.sessions)), maxCombo = Math.max(1, ...combos.map(c => c.runs));
  const days = [...daily].reverse(), shown = state.allDays ? days : days.slice(0, DAY_ROWS);
  app.innerHTML = `
    ${topBar()}
    <main>
      <div class="toolbar"><span class="mute">원정 난이도</span><div class="seg" role="group" aria-label="원정 난이도">${[['', '전체'], ['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']].map(([id, label]) => `<button data-level="${id}" aria-pressed="${state.level === id}">${label}</button>`).join('')}</div><span class="mute">기간</span><div class="seg" role="group" aria-label="기간">${RANGES.map(([d, label]) => `<button data-days="${d}" aria-pressed="${state.days === d}">${label}</button>`).join('')}</div></div>
      ${state.level ? `<p class="hint" style="margin:-4px 0 12px;text-align:right">원정 숫자(원정 판수·완주율·조합·정거장·최근 원정)는 <b>${LEVELS[state.level]}</b> 원정만 셉니다. 플레이 수와 기기는 전체예요.</p>` : ''}
      <section class="tiles" aria-label="요약">
        <div class="card tile"><div class="label">오늘 플레이</div><div class="value num">${num(today.sessions)}<small>번</small>${delta}</div><div class="note">기기 ${num(today.devices)} · 원정 ${num(today.runs)} · 완주 ${num(today.clears)}</div></div>
        <div class="card tile"><div class="label">${rangeLabel} 원정</div><div class="value num">${num(totals.runs)}<small>판</small>${totals.unfinished ? `<span class="delta mute" title="아직 돌아오지 않은 원정">진행 중 ${num(totals.unfinished)}</span>` : ''}</div><div class="note">완주 ${num(totals.clears)} · 쓰러짐 ${num(totals.defeats)} · 포기 ${num(totals.abandons)}</div></div>
        <div class="card tile"><div class="label">${rangeLabel} 기기</div><div class="value num">${num(totals.activeDevices)}<small>대</small></div><div class="note">플레이 ${num(totals.sessions)}번 · 새 기기 ${num(totals.newDevices)} · 누적 ${num(totals.devices)}</div></div>
        <div class="card tile"><div class="label">완주율</div><div class="value num">${pct(totals.clears, ended)}<small>%</small></div><div class="note">평균 ${totals.averageNode ?? '–'}번째 정거장 · ${clock(totals.averageSeconds)}</div></div>
      </section>

      <div class="section"><h2>난이도</h2><span>${rangeLabel} · 원정을 떠날 때 고른 난이도 · 누르면 그 난이도만 봐요</span>${chapterTabs()}</div>
      <section class="levels">${levelCards(shownLevels())}</section>

      <div class="section"><h2>추세</h2><span>${rangeLabel} · 마우스를 올리면 그날 숫자</span></div>
      <section class="trend">
        <div class="card"><div class="card-head"><h3>하루 플레이</h3><div class="legend"><span><span class="dot" style="background:var(--blue)"></span>플레이</span><span><span class="dash"></span>기기</span></div></div><div class="chart" data-chart="daily"></div></div>
        <div class="card"><div class="card-head"><h3>원정이 끝난 정거장</h3><div class="legend"><span><span class="dot" style="background:var(--good)"></span>완주</span></div></div><div class="chart" data-chart="depth"></div></div>
        <div class="card"><div class="card-head"><h3>기기 형태</h3><div class="legend">플레이한 기기</div></div>${donut(devices.form, FORMS, '대')}
          <p class="foot">운영체제: ${esc(shareLine(devices.os, SYSTEMS))}<br>브라우저: ${esc(shareLine(devices.browser, BROWSERS))}</p></div>
      </section>

      <div class="section"><h2>속성 조합</h2><span>원정에 쓴 두 속성 · ${rangeLabel}</span></div>
      <section class="pair">
        <div class="card">${combos.length ? `<table>
          <thead><tr><th>조합</th><th class="grow narrow-hide">원정</th><th class="r">판</th><th class="r">완주율</th><th class="r">평균 도달</th></tr></thead>
          <tbody>${combos.map(c => { const done = c.clears + c.defeats + c.abandons; return `<tr><td>${comboCell(c.combo)}</td><td class="grow narrow-hide"><div class="track"><i style="width:${c.runs / maxCombo * 100}%;background:var(--blue)"></i></div></td><td class="r num">${num(c.runs)} <span class="mute">${pct(c.runs, totals.runs)}%</span></td><td class="r num">${done ? `${pct(c.clears, done)}%` : '–'}</td><td class="r num">${c.averageNode ?? '–'}</td></tr>`; }).join('')}</tbody>
        </table>` : '<p class="empty">아직 원정 기록이 없어요.</p>'}</div>
        <div class="card"><div class="card-head"><h3>최근 원정</h3></div>${recent.length ? `<table>
          <tbody>${recent.slice(0, 10).map(r => `<tr><td class="mute num">${esc(shortDay(r.day))}</td><td>${comboCell(r.combo)}</td><td>${levelChip(r.difficulty)}</td><td><span class="chip ${esc(r.reason || 'open')}">${REASONS[r.reason || 'open']}</span></td><td class="r num">${r.node ? `${r.node}번째` : '–'}</td><td class="r num mute narrow-hide">${r.seconds === null ? '' : clock(r.seconds)}</td></tr>`).join('')}</tbody>
        </table>` : '<p class="empty">아직 원정 기록이 없어요.</p>'}</div>
      </section>

      <div class="section"><h2>날짜별</h2><span>${state.allDays ? `${days.length}일 전체` : `최근 ${Math.min(DAY_ROWS, days.length)}일`}</span></div>
      <section class="card"><table>
        <thead><tr><th>날짜</th><th class="grow narrow-hide">플레이</th><th class="r">플레이</th><th class="r">기기</th><th class="r">원정</th><th class="narrow-hide">결과 <span style="margin-left:6px"><span class="dot" style="background:var(--good)"></span>완주 <span class="dot" style="background:var(--bad)"></span>쓰러짐 <span class="dot" style="background:var(--blue-3)"></span>포기</span></th><th class="r narrow-hide">평균 시간</th></tr></thead>
        <tbody>${shown.map(d => { const done = d.clears + d.defeats + d.abandons, cleared = pct(d.clears, done), fell = pct(d.defeats, done); return `<tr><td class="day num"><b>${shortDay(d.day)}</b> <span class="mute">${d === daily.at(-1) ? '오늘' : weekday(d.day)}</span></td>
          <td class="grow narrow-hide"><div class="track"><i style="width:${d.sessions / maxDay * 100}%;background:var(--blue)"></i></div></td>
          <td class="r num"><b>${num(d.sessions)}</b></td><td class="r num">${num(d.devices)}</td><td class="r num">${num(d.runs)}</td>
          <td class="narrow-hide"><div style="display:flex;align-items:center;gap:8px"><div class="track" style="width:90px;flex:none">${done ? `<i style="width:${cleared}%;background:var(--good)"></i><i style="width:${fell}%;background:var(--bad)"></i><i style="width:${100 - cleared - fell}%;background:var(--blue-3)"></i>` : ''}</div><span class="mute num">${num(d.clears)} / ${num(d.defeats)} / ${num(d.abandons)}</span></div></td>
          <td class="r num mute narrow-hide">${clock(d.averageSeconds)}</td></tr>`; }).join('')}</tbody>
      </table>${days.length > DAY_ROWS ? `<button class="more" data-act="days">${state.allDays ? '최근 14일만 보기' : `${days.length}일 모두 보기`}</button>` : ''}</section>
    </main>`;
  drawCharts();
}

/** Charts are drawn at the width their card gives them, so labels stay 10 pixels on every screen. */
function drawCharts() {
  const { daily, depth } = state.data;
  for (const el of app.querySelectorAll('[data-chart]')) {
    const W = Math.max(200, el.clientWidth);
    el.innerHTML = el.dataset.chart === 'daily' ? dailyChart(W, daily) : depthChart(W, depth, state.names.rooms);
  }
}

app.addEventListener('click', event => {
  if (event.target.closest('summary[data-act="restore-open"]')) { event.preventDefault(); toggleRestore(); return; }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.tab && button.dataset.tab !== state.tab) { state.tab = button.dataset.tab; sessionStorage.setItem('admin-tab', state.tab); state.at = null; load(); return; }
  if (button.dataset.user) { pick(button.dataset.user); return; }
  if (button.dataset.online !== undefined) { state.onlineOnly = button.dataset.online === '1'; drawPeople(); return; }
  if (button.dataset.preset) { const field = document.getElementById('gift-gears'); field.value = Number(field.value || 0) + Number(button.dataset.preset); state.confirm = 0; giftButton(); return; }
  if (button.dataset.cancel) { cancelGift(Number(button.dataset.cancel)); return; }
  if (button.dataset.act === 'gift') { sendGift(); return; }
  if (button.dataset.act === 'memo') { saveMemo(); return; }
  if (button.dataset.act === 'code') { makeCode(); return; }
  if (button.dataset.act === 'search') { searchSaves(); return; }
  if (button.dataset.ref) { makeCode(button.dataset.ref); return; }
  if (button.dataset.act === 'restore') { makeRestoreCode(); return; }
  if (button.dataset.act === 'copy-code') { copyCode(); return; }
  if (button.dataset.act === 'more') { state.shown += 30; drawPeople(); return; }
  if (button.dataset.act === 'close') { state.picked = null; state.detail = null; drawDetail(); drawPeople(); return; }
  if (button.dataset.levelchapter !== undefined) { state.levelChapter = button.dataset.levelchapter; sessionStorage.setItem('admin-level-chapter', state.levelChapter); render(); return; }
  if (button.dataset.level !== undefined) { state.level = button.dataset.level; state.allDays = false; sessionStorage.setItem('admin-level', state.level); load(); return; }
  if (button.dataset.days !== undefined) { state.days = Number(button.dataset.days); state.allDays = false; sessionStorage.setItem('admin-days', state.days); load(); }
  if (button.dataset.act === 'reload') load();
  if (button.dataset.act === 'theme') {
    const next = document.documentElement.dataset.theme === 'paper' ? 'dark' : 'paper';
    document.documentElement.dataset.theme = next; try { localStorage.setItem('beyond-the-clockwork.admin-theme.v1', next); } catch {}
    if (state.tab === 'users') renderPeople(); else render();
  }
  if (button.dataset.act === 'days') { state.allDays = !state.allDays; render(); }
  if (button.dataset.act === 'lock') { try { localStorage.removeItem(TOKEN_KEY); } catch {} state.data = null; state.people = null; login(); }
});
app.addEventListener('pointermove', event => {
  const target = event.target.closest('[data-tip]');
  if (!target) { tip.style.display = 'none'; return; }
  tip.textContent = target.dataset.tip; tip.style.display = 'block';
  tip.style.left = `${Math.min(innerWidth - 130, Math.max(130, event.clientX))}px`; tip.style.top = `${event.clientY}px`;
});
app.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
let resizing = 0;
addEventListener('resize', () => { clearTimeout(resizing); resizing = setTimeout(() => state.data && app.querySelector('[data-chart]') && drawCharts(), 150); });
app.addEventListener('input', event => {
  if (event.target.id === 'people-search') { state.q = event.target.value; state.shown = 20; clearTimeout(searching); searching = setTimeout(() => loadPeople(false), 250); }
  if (event.target.id === 'gift-gears') { state.confirm = 0; giftButton(); }
  if (event.target.id === 'code-inherit') state.codeInherit = event.target.checked;
  restoreInput(event.target);
});
app.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.id === 'memo') saveMemo(); });
let searching = 0;

// ── 유저 tab ─────────────────────────────────────────────────────────────────────────────────────────────────
const ago = (ms, now) => { const s = Math.max(0, (now - ms) / 1000); return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
const isOnline = (u, data) => u.last_seen && data.now - u.last_seen < data.onlineSeconds * 1000;
/** Where a device is now; an expedition names its chapter and difficulty (2026-11-11; a device that has not reported one since shows 1장). */
const placeOf = u => {
  if (u.where_now !== 'run') return PLACES[u.where_now] || '–';
  const chapter = (state.names?.chapters || []).find(c => c.id === u.chapter_now), number = chapter?.number || (u.chapter_now ? '?' : 1);
  // …and its difficulty (2026-11-11), when the device has reported one.
  return `${number}장 원정 ${u.node_now}번째${LEVELS[u.difficulty_now] && u.difficulty_now !== 'legacy' ? ` · ${LEVELS[u.difficulty_now]}` : ''}`;
};
const kindOf = u => [FORMS[u.form], SYSTEMS[u.os], BROWSERS[u.browser]].filter(Boolean).join(' · ') || '알 수 없음';
/** The admin's memo first, then the name the player wrote in Moru's ledger, else the product number every player starts as. */
const nameOf = u => (u.memo ? `${esc(u.memo)}${u.nickname ? ` <span class="nick">${esc(u.nickname)}</span>` : ''}` : u.nickname ? esc(u.nickname) : '<span class="mute">F2 (이름 없음)</span>');
const shortId = id => `#${id.slice(0, 6)}`;
const hours = seconds => { if (!seconds) return '–'; const m = Math.round(seconds / 60); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
const when = ms => (ms ? new Date(ms).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '–');
const seenLabel = (u, data) => (isOnline(u, data) ? '<span class="live"><span class="dot"></span>접속 중</span>' : `<span class="mute">${u.last_seen ? ago(u.last_seen, data.now) : esc(u.last_day || '–')}</span>`);

async function loadPeople(full) {
  if (full && !state.people) app.innerHTML = '<p class="empty">불러오는 중…</p>';
  const answer = await request(`/api/admin/users?q=${encodeURIComponent(state.q.trim())}`);
  if (!answer) return;
  if (!answer.ok) return problem('서버에 문제가 생겼어요. 잠시 뒤 다시 불러오세요.');
  state.people = answer.body; state.at = new Date();
  if (full || !app.querySelector('#people')) renderPeople(); else { drawPeopleTiles(); drawPeople(); app.querySelector('.stamp').textContent = `${state.at.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} 기준`; }
  if (full && state.picked) pick(state.picked, true);
}

function renderPeople() {
  app.innerHTML = `${topBar()}<main>
    <section class="tiles" id="people-tiles" aria-label="유저 요약"></section>
    <div class="section"><h2>유저</h2><span>기기 하나가 유저 한 명 · ${USERS_REFRESH_SECONDS}초마다 새로 읽어요</span></div>
    <section class="people">
      <div class="card">
        <div class="toolbar">
          <input id="people-search" class="field" type="search" placeholder="이름·메모·기기 id로 찾기" value="${esc(state.q)}" aria-label="유저 찾기">
          <div class="seg" role="group" aria-label="보기">${[['0', '전체'], ['1', '접속 중']].map(([v, label]) => `<button data-online="${v}" aria-pressed="${state.onlineOnly === (v === '1')}">${label}</button>`).join('')}</div>
        </div>
        <div id="people"></div>
      </div>
      <div class="card detail" id="detail"></div>
    </section>
  </main>`;
  drawPeopleTiles(); drawPeople(); drawDetail();
}

function drawPeopleTiles() {
  const { counts } = state.people, box = app.querySelector('#people-tiles');
  if (!box) return;
  box.innerHTML = `
    <div class="card tile"><div class="label">지금 접속 중</div><div class="value num">${num(counts.online)}<small>명</small></div><div class="note">최근 ${Math.round(state.people.onlineSeconds / 60 * 10) / 10}분 안에 확인된 기기</div></div>
    <div class="card tile"><div class="label">오늘 접속</div><div class="value num">${num(counts.today)}<small>명</small></div><div class="note">한국 시간 오늘</div></div>
    <div class="card tile"><div class="label">전체 유저</div><div class="value num">${num(counts.everyone)}<small>명</small></div><div class="note">통계를 켠 뒤 한 번이라도 연 기기</div></div>
    <div class="card tile"><div class="label">도착 전 선물</div><div class="value num">${num(counts.pending)}<small>건</small></div><div class="note">다음 접속 때 전달돼요</div></div>`;
}

function drawPeople() {
  const box = app.querySelector('#people'), data = state.people;
  if (!box || !data) return;
  for (const b of app.querySelectorAll('[data-online]')) b.setAttribute('aria-pressed', String(state.onlineOnly === (b.dataset.online === '1')));
  const all = data.users.filter(u => !state.onlineOnly || isOnline(u, data)), list = all.slice(0, state.shown);
  if (!list.length) { box.innerHTML = `<p class="empty">${state.onlineOnly ? '지금 접속 중인 유저가 없어요.' : state.q ? '찾는 유저가 없어요.' : '아직 유저 기록이 없어요.'}</p>`; return; }
  box.innerHTML = `<div class="scroll"><table>
    <thead><tr><th>접속</th><th>이름</th><th>지금</th><th class="narrow-hide wide-only">기기</th><th class="r narrow-hide">플레이</th><th class="r narrow-hide">톱니</th><th class="r">원정</th></tr></thead>
    <tbody>${list.map(u => `<tr class="pick" aria-selected="${state.picked === u.id}"><td>${seenLabel(u, data)}</td>
      <td><button class="who" data-user="${esc(u.id)}">${nameOf(u)} <small>${shortId(u.id)}</small></button>${u.pending ? ` <span class="chip open" title="도착 전 선물">선물 ${num(u.pending)}</span>` : ''}</td>
      <td>${isOnline(u, data) ? esc(placeOf(u)) : '<span class="mute">–</span>'}</td>
      <td class="narrow-hide wide-only mute">${esc(kindOf(u))}</td><td class="r num narrow-hide">${hours(u.play_seconds)}</td>
      <td class="r num narrow-hide">${u.gears === null ? '–' : num(u.gears)}</td><td class="r num">${num(u.runs)}<span class="mute"> / ${num(u.clears)}</span></td></tr>`).join('')}</tbody>
  </table></div>${all.length > list.length ? `<button class="more" data-act="more">${num(all.length - list.length)}명 더 보기</button>` : ''}<p class="hint">원정은 전체 / 완주. 톱니는 마지막 접속 때 가진 자유 톱니예요. 이름을 누르면 자세히 볼 수 있고, 거기서 톱니를 보낼 수 있어요.</p>`;
  for (const row of box.querySelectorAll('tr.pick')) row.addEventListener('click', event => { if (!event.target.closest('button')) row.querySelector('[data-user]').click(); });
}

async function pick(id, quiet = false) {
  state.picked = id; state.confirm = 0;
  if (!quiet) { state.said = ''; state.detail = null; drawDetail(); drawPeople(); }
  const answer = await request(`/api/admin/users/${encodeURIComponent(id)}`);
  if (!answer) return;
  state.detail = answer.ok ? answer.body : { missing: true };
  drawDetail();
  if (!quiet && matchMedia('(max-width: 960px)').matches) app.querySelector('#detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function drawDetail() {
  const box = app.querySelector('#detail');
  if (!box) return;
  box.hidden = !state.picked; app.querySelector('.people')?.classList.toggle('solo', !state.picked);
  if (!state.picked) { box.innerHTML = ''; return; }
  const d = state.detail;
  if (!d) { box.innerHTML = '<p class="empty">불러오는 중…</p>'; return; }
  if (d.missing) { box.innerHTML = '<p class="empty">이 유저를 찾을 수 없어요.</p>'; return; }
  const u = d.user, GIFT_STATE = g => (g.cancelled_at ? ['abandon', '취소'] : g.claimed_at ? ['clear', '받음'] : ['open', '도착 전']);
  box.innerHTML = `
    <div class="card-head"><h3>${nameOf(u)}</h3><span class="mute num">${shortId(u.id)}</span><button class="link" style="margin-left:auto" data-act="close">닫기</button></div>
    <div class="memo-row"><input id="memo" class="field" maxlength="30" placeholder="관리자 메모 (관리자만 봐요)" value="${esc(u.memo || '')}" aria-label="메모 이름"><button class="ghost" data-act="memo">저장</button></div>
    <dl>
      <dt>접속</dt><dd>${seenLabel(u, d)}${isOnline(u, d) ? ` · ${esc(placeOf(u))}` : ''}</dd>
      <dt>마지막 접속</dt><dd class="num">${when(u.last_seen)}</dd>
      <dt>처음 본 날</dt><dd class="num">${esc(u.first_day || '–')}</dd>
      <dt>기기</dt><dd>${esc(kindOf(u))}${u.installed ? ' · 홈 화면 설치' : ''}</dd>
      <dt>플레이</dt><dd class="num">${hours(u.play_seconds)} · 게임 연 횟수 ${num(u.opens)}</dd>
      <dt>원정</dt><dd class="num">${num(u.runs)}판 · 완주 ${num(u.clears)} · 최고 ${u.best ? `${u.best}번째` : '–'}</dd>
      <dt>자유 톱니</dt><dd class="num">${u.gears === null ? '–' : `${num(u.gears)}개`} <span class="mute">(마지막 접속 때)</span></dd>
      <dt>장부 이름</dt><dd>${u.nickname ? esc(u.nickname) : '<span class="mute">없음 (F2)</span>'} <span class="mute">유저가 게임에서 정한 이름</span></dd>
      <dt>기기 id</dt><dd class="num mute" style="word-break:break-all">${esc(u.id)}</dd>
    </dl>
    <h4>연동 코드</h4>
    ${codeBlock(d)}
    ${restoreBlock(d)}
    <h4>자유 톱니 보내기</h4>
    <div class="gift">
      <div class="gift-row"><input id="gift-gears" class="field num" type="number" min="1" max="100000" step="1" inputmode="numeric" placeholder="개수" aria-label="보낼 톱니 수">${GIFT_PRESETS.map(n => `<button class="ghost" data-preset="${n}">+${num(n)}</button>`).join('')}</div>
      <input id="gift-note" class="field" maxlength="60" placeholder="함께 보낼 말 (유저 화면에 떠요, 예: 점검 보상)" aria-label="선물 메시지">
      <button class="primary" data-act="gift" id="gift-send">보내기</button>
      ${state.said ? `<p class="hint">${esc(state.said)}</p>` : '<p class="hint">유저가 게임을 켜 두면 1분 안에, 꺼져 있으면 다음에 열 때 도착해요. 도착 전이면 취소할 수 있어요.</p>'}
    </div>
    <h4>선물 기록</h4>
    ${d.gifts.length ? `<table><tbody>${d.gifts.map(g => { const [cls, label] = GIFT_STATE(g); return `<tr><td class="num mute">${when(g.created_at)}</td><td class="r num"><b>${num(g.gears)}</b></td><td class="mute" style="white-space:normal">${esc(g.note || '')}</td><td><span class="chip ${cls}">${label}</span></td><td class="r">${cls === 'open' ? `<button class="link" data-cancel="${g.id}">취소</button>` : ''}</td></tr>`; }).join('')}</tbody></table>` : '<p class="hint">아직 보낸 선물이 없어요.</p>'}
    <h4>최근 원정</h4>
    ${d.runs.length ? `<table><tbody>${d.runs.slice(0, 10).map(r => `<tr><td class="mute num">${esc(shortDay(r.day))}</td><td>${comboCell(r.combo)}</td><td>${levelChip(r.difficulty)}</td><td><span class="chip ${esc(r.reason || 'open')}">${REASONS[r.reason || 'open']}</span></td><td class="r num">${r.node ? `${r.node}번째` : '–'}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">아직 원정 기록이 없어요.</p>'}`;
  giftButton();
}

/** A made code, its expiry and what it does; shared by the two code sections. */
function codeShown(made, restored) {
  return `<div class="code-row"><b class="code num">${esc(formatCode(made.code))}</b><button class="ghost" data-act="copy-code">복사</button></div>
      <p class="hint">${esc(made.note || '')}${when(Date.parse(made.expiresAt))}까지 쓸 수 있어요. 유저가 게임의 설정 → 다른 기기와 연동에서 이 코드를 넣으면 ${restored ? '복구한 진행을 불러와요' : '이 진행을 불러오고, 그 뒤로 두 기기가 같이 동기화돼요'}.${made.inherit ? ' 불러온 기기가 이 유저의 원정 기록·서버 기록·선물·메모를 이어받고, 이 줄은 목록에서 사라져요.' : ''}</p>`;
}

/**
 * The transfer code section: when the player last uploaded progress (each return to the village replaces it, so there is
 * only ever the newest) and a code made from it, shown until another player is picked.
 */
function codeBlock(d) {
  const mine = state.code?.device === state.picked && state.code.kind === 'live' ? state.code : null, made = mine?.code ? mine : null;
  if (!d.saved) return searchBlock();
  return `<div class="gift">
      <p class="hint">마지막으로 올라온 진행: <b class="num">${when(Date.parse(d.saved.at))}</b> · 마을로 돌아올 때마다 최신으로 바뀌어요.</p>
      ${made ? codeShown(made, false) : ''}
      ${mine?.error ? `<p class="hint">${esc(mine.error)}</p>` : ''}
      <label class="check"><input type="checkbox" id="code-inherit"${state.codeInherit ? ' checked' : ''}> 기록도 새 기기로 옮기기 <span class="mute">(옛 기기를 더 쓰지 않을 때)</span></label>
      <button class="${made ? 'ghost' : 'primary'}" data-act="code">${made ? '새 코드 만들기' : '연동 코드 만들기'}</button>
    </div>`;
}

/**
 * A device from before the game named itself when uploading: its save is on the server all the same (every return to the
 * village uploads it), only not yet linked. The search lists the saves that match what its check-ins reported.
 */
function searchBlock() {
  const found = state.search?.device === state.picked ? state.search : null, mine = state.code?.device === state.picked && state.code.kind === 'live' ? state.code : null;
  const WHY = { name: '이름', gears: '톱니', play: '플레이 시간', time: '저장 시각' };
  const rows = found?.saves?.map(v => `<tr><td><b>${esc(v.nickname || '이름 없음')}</b><div class="mute num">${when(Date.parse(v.at))} 저장</div></td>
      <td class="num">톱니 ${num(v.freeGears)}<div class="mute">${hours(v.playSeconds)} · 조율 ${num(v.tuning)} · ${v.cleared.length}장 클리어</div></td>
      <td>${v.why.map(w => `<span class="chip clear">${WHY[w] || esc(w)}</span>`).join(' ')}</td>
      <td class="r"><button class="ghost" data-ref="${esc(v.ref)}">이 저장으로 코드 만들기</button></td></tr>`).join('') || '';
  return `<div class="gift">
      <p class="hint">이 기기는 아직 서버 저장과 연결되지 않았어요(이 업데이트 전 버전). 게임은 마을로 돌아올 때마다 진행을 서버에 올려 두므로, 이 유저의 마지막 접속 정보(이름·톱니·플레이 시간·시각)와 맞는 저장을 찾을 수 있어요.</p>
      ${found?.saves ? (rows ? `<table><tbody>${rows}</tbody></table>` : '<p class="hint">맞는 저장을 찾지 못했어요. 유저가 이 기기에서 게임을 한 번 열면 바로 연결되고, 기기를 잃었다면 아래 진행 복구를 써 주세요.</p>') : ''}
      ${mine?.error ? `<p class="hint">${esc(mine.error)}</p>` : ''}
      <label class="check"><input type="checkbox" id="code-inherit"${state.codeInherit ? ' checked' : ''}> 기록도 새 기기로 옮기기 <span class="mute">(옛 기기를 더 쓰지 않을 때)</span></label>
      <button class="primary" data-act="search"${found?.busy ? ' disabled' : ''}>${found?.busy ? '찾는 중…' : found?.saves ? '다시 찾기' : '서버 저장 찾기'}</button>
    </div>`;
}
async function searchSaves() {
  const device = state.picked;
  state.search = { device, busy: true }; drawDetail();
  const answer = await request(`/api/admin/users/${encodeURIComponent(device)}/saves`);
  if (state.picked !== device) return;
  state.search = { device, saves: answer?.ok ? answer.body.saves : [] }; drawDetail();
}

async function makeCode(ref) {
  const device = state.picked, inherit = !!state.codeInherit;
  const answer = await request(`/api/admin/users/${encodeURIComponent(device)}/transfer`, { method: 'POST', body: JSON.stringify(ref ? { inherit, ref } : { inherit }) });
  if (!answer || state.picked !== device) return;
  state.code = answer.ok ? { device, kind: 'live', inherit, ...answer.body } : { device, kind: 'live', error: answer.body?.error === 'nosave' ? '서버에 올라온 진행이 없어 코드를 만들지 못했어요.' : '코드를 만들지 못했어요. 잠시 뒤 다시 해 주세요.' };
  await pick(device, true);
}
async function copyCode() {
  if (!state.code?.code) return;
  try { await navigator.clipboard.writeText(formatCode(state.code.code)); state.code.note = '복사했어요. '; } catch { state.code.note = ''; }
  drawDetail();
}

// ── 진행 복구: a save rebuilt by hand for a player whose device is gone (src/engine/restore-save.js, 2026-11-12) ──────
/** The game's data and the save builder, loaded the first time the section opens (the page itself stays light). */
const restoreKit = { promise: null, value: null, failed: false };
function loadRestoreKit() {
  restoreKit.promise ??= Promise.all([import('../engine/data.js'), import('../engine/restore-save.js')]).then(async ([d, r]) => {
    const data = await d.loadData();
    restoreKit.value = { options: r.restoreOptions(data), build: choice => r.buildRestoreSave(data, choice) }; restoreKit.failed = false;
  }).catch(() => { restoreKit.failed = true; restoreKit.promise = null; });
  return restoreKit.promise;
}
/**
 * The form starts from what the statistics know: the ledger name, the gears at the last check-in, the elements its runs
 * used, and chapter 1 with its bosses if it ever finished a run. Run count and play time are carried over unseen.
 */
function restoreDefaults(d, options) {
  const u = d.user, used = new Set(d.runs.flatMap(r => String(r.combo || '').split('+')).filter(Boolean));
  const first = options.chapters[0], cleared = u.clears > 0 && first ? [first.id] : [];
  return { device: u.id, open: true, nickname: u.nickname || '', freeGears: u.gears || 0, stats: {}, owned: options.elements.map(e => e.id).filter(id => used.has(id)),
    cleared, bosses: cleared.length ? first.bosses.map(b => b.id) : [], inherit: true, runs: u.runs || 0, playSeconds: u.play_seconds || 0 };
}
/** The highest stat level the chosen chapters allow (ten for each chapter open), as in the game. */
function restoreCap(r, options) {
  let opened = 1;
  for (const c of options.chapters) if (c.number > opened && r.cleared.includes(options.chapters.find(p => p.number === c.number - 1)?.id)) opened = c.number;
  return options.ranksPerChapter * opened;
}
function restoreBlock(d) {
  const kit = restoreKit.value, r = state.restore?.device === d.user.id ? state.restore : null, open = !!r?.open;
  const mine = state.code?.device === state.picked && state.code.kind === 'restore' ? state.code : null;
  let body = '';
  if (open && (!kit || !r.stats)) body = `<p class="hint">${restoreKit.failed ? '게임 데이터를 불러오지 못했어요. 접었다 다시 펼쳐 주세요.' : '게임 데이터를 불러오는 중…'}</p>`;
  else if (open) {
    const { options } = kit, cap = restoreCap(r, options), box = (attr, id, on, label) => `<label class="check"><input type="checkbox" ${attr}="${esc(id)}"${on ? ' checked' : ''}> ${esc(label)}</label>`;
    const armed = state.restoreConfirm > Date.now();
    body = `<div class="gift restore-form">
      <p class="hint">기기를 잃어 진행이 서버에도 없을 때, 진행을 직접 정해 새 세이브를 만들어요. 튜토리얼은 끝난 상태로 마을에서 시작해요.</p>
      <div class="gift-row"><input class="field" data-r="nickname" maxlength="12" placeholder="장부 이름" value="${esc(r.nickname)}" aria-label="장부 이름"><input class="field num" data-r="freeGears" type="number" min="0" step="1" value="${esc(r.freeGears)}" aria-label="자유 톱니"></div>
      <p class="sub">클리어한 장과 쓰러뜨린 보스 <span class="mute">(보스 기록의 설계도는 자동으로 붙어요)</span></p>
      ${options.chapters.map(c => `<div class="checks">${box('data-r-clear', c.id, r.cleared.includes(c.id), `${c.number}장 ${c.name} 클리어`)}${c.bosses.map(b => box('data-r-boss', b.id, r.bosses.includes(b.id), b.name)).join('')}</div>`).join('')}
      <p class="sub">보유 속성 <span class="mute">(앞의 둘을 장착해요)</span></p>
      <div class="checks">${options.elements.map(e => box('data-r-owned', e.id, r.owned.includes(e.id), e.name)).join('')}</div>
      <p class="sub">조율판 <span class="mute">(열린 장 기준 최대 ${cap}단계)</span></p>
      <div class="restore-grid">${options.stats.map(s => `<label>${esc(s.name)}<input class="field num" type="number" min="0" max="${Math.min(s.maxRank, cap)}" step="1" data-r-stat="${esc(s.id)}" value="${esc(r.stats[s.id] || 0)}"></label>`).join('')}</div>
      <label class="check"><input type="checkbox" data-r="inherit"${r.inherit ? ' checked' : ''}> 이 유저의 원정 기록·서버 기록·선물·메모를 새 기기로 옮기기</label>
      ${mine?.code ? codeShown(mine, true) : ''}${mine?.error ? `<p class="hint">${esc(mine.error)}</p>` : ''}
      <button class="${mine?.code ? 'ghost' : 'primary'}${armed ? ' armed' : ''}" data-act="restore">${armed ? '한 번 더 누르면 복구 코드를 만들어요' : mine?.code ? '이 내용으로 새 복구 코드 만들기' : '복구 코드 만들기'}</button>
    </div>`;
  }
  return `<details class="restore"${open ? ' open' : ''}><summary data-act="restore-open">기기를 잃은 유저: 진행 복구 코드</summary>${body}</details>`;
}
/** Keeps what the owner typed or ticked, so the half-minute refresh and redraws do not wipe the form. */
function restoreInput(target) {
  const r = state.restore;
  if (!r?.stats || r.device !== state.picked) return;
  const flip = (list, id, on) => (on ? [...new Set([...list, id])] : list.filter(x => x !== id));
  if (target.dataset.r === 'inherit') r.inherit = target.checked;
  else if (target.dataset.r) r[target.dataset.r] = target.value;
  else if (target.dataset.rStat) r.stats[target.dataset.rStat] = target.value;
  else if (target.dataset.rOwned) r.owned = flip(r.owned, target.dataset.rOwned, target.checked);
  else if (target.dataset.rBoss) r.bosses = flip(r.bosses, target.dataset.rBoss, target.checked);
  // Clearing a chapter opens more tuning levels: the board's limits are drawn again.
  else if (target.dataset.rClear) { r.cleared = flip(r.cleared, target.dataset.rClear, target.checked); state.restoreConfirm = 0; drawDetail(); return; }
  else return;
  state.restoreConfirm = 0;
}
/** The summary opens or folds the section; the first opening loads the game's data and fills the form. */
async function toggleRestore() {
  const d = state.detail;
  if (!d?.user) return;
  if (state.restore?.device !== d.user.id) state.restore = { device: d.user.id, open: false };
  state.restore.open = !state.restore.open; drawDetail();
  if (!state.restore.open) return;
  await loadRestoreKit();
  if (restoreKit.value && state.restore?.device === d.user.id && !state.restore.stats) state.restore = restoreDefaults(d, restoreKit.value.options);
  drawDetail();
}
async function makeRestoreCode() {
  const r = state.restore, kit = restoreKit.value, device = state.picked;
  if (!r?.stats || !kit || r.device !== device) return;
  if (!(state.restoreConfirm > Date.now())) { state.restoreConfirm = Date.now() + 5000; drawDetail(); setTimeout(drawDetail, 5100); return; }
  state.restoreConfirm = 0;
  let save;
  try { save = kit.build({ ...r, freeGears: Number(r.freeGears), stats: Object.fromEntries(Object.entries(r.stats).map(([k, v]) => [k, Number(v)])) }); }
  catch { state.code = { device, kind: 'restore', error: '세이브를 만들지 못했어요. 입력을 확인해 주세요.' }; drawDetail(); return; }
  const answer = await request(`/api/admin/users/${encodeURIComponent(device)}/restore`, { method: 'POST', body: JSON.stringify({ save, inherit: !!r.inherit }) });
  if (!answer || state.picked !== device) return;
  state.code = answer.ok ? { device, kind: 'restore', inherit: !!r.inherit, ...answer.body } : { device, kind: 'restore', error: '복구 코드를 만들지 못했어요. 잠시 뒤 다시 해 주세요.' };
  drawDetail();
}

/** The send button says what it will do; the first press arms it, the second (within 5 seconds) sends. */
function giftButton() {
  const button = app.querySelector('#gift-send'), gears = Number(app.querySelector('#gift-gears')?.value);
  if (!button) return;
  const valid = Number.isInteger(gears) && gears >= 1 && gears <= 100000;
  button.disabled = !valid;
  button.textContent = !valid ? '보낼 톱니 수를 넣어 주세요' : state.confirm > Date.now() ? `한 번 더 누르면 ${num(gears)}개를 보내요` : `자유 톱니 ${num(gears)}개 보내기`;
  button.classList.toggle('armed', valid && state.confirm > Date.now());
}

async function sendGift() {
  const gears = Number(app.querySelector('#gift-gears')?.value), note = app.querySelector('#gift-note')?.value || '';
  if (!(Number.isInteger(gears) && gears >= 1 && gears <= 100000)) return;
  if (!(state.confirm > Date.now())) { state.confirm = Date.now() + 5000; giftButton(); setTimeout(giftButton, 5100); return; }
  state.confirm = 0;
  const answer = await request('/api/admin/gifts', { method: 'POST', body: JSON.stringify({ device: state.picked, gears, note }) });
  if (!answer) return;
  state.said = answer.ok ? `자유 톱니 ${num(gears)}개를 보냈어요. 다음 접속 확인 때 도착해요.` : '보내지 못했어요. 개수(1~100,000)를 확인해 주세요.';
  await pick(state.picked, true); loadPeople(false);
}

async function cancelGift(id) {
  const answer = await request(`/api/admin/gifts/${id}`, { method: 'DELETE' });
  if (!answer) return;
  state.said = answer.ok ? '선물을 취소했어요.' : '이미 도착한 선물이라 취소할 수 없어요.';
  await pick(state.picked, true); loadPeople(false);
}

async function saveMemo() {
  const memo = app.querySelector('#memo')?.value || '';
  const answer = await request(`/api/admin/users/${encodeURIComponent(state.picked)}/memo`, { method: 'POST', body: JSON.stringify({ memo }) });
  if (!answer) return;
  state.said = answer.ok ? '이름을 저장했어요.' : '저장하지 못했어요.';
  await pick(state.picked, true); loadPeople(false);
}

// The 유저 tab reads the list again every half minute while it is on screen, so "접속 중" stays true.
setInterval(() => { if (state.tab === 'users' && state.people && !document.hidden && token()) loadPeople(false); }, USERS_REFRESH_SECONDS * 1000);

load();
