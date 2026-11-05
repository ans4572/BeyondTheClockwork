// The admin page (admin.html): reads the play statistics summary from the worker (worker/stats.js) with the admin
// token the owner typed in, and lays it out as one compact dashboard. The token stays in this browser only.
import { apiBase } from './device-transfer.js';

const TOKEN_KEY = 'beyond-the-clockwork.admin-token.v1';
const RANGES = [[7, '7일'], [30, '30일'], [90, '90일'], [0, '전체']];
const FORMS = { phone: '휴대폰', tablet: '태블릿', desktop: 'PC' };
const SYSTEMS = { ios: 'iOS', android: '안드로이드', windows: '윈도우', mac: 'macOS', chromeos: '크롬OS', linux: '리눅스', other: '기타' };
const BROWSERS = { chrome: '크롬', safari: '사파리', samsung: '삼성', whale: '웨일', edge: '엣지', firefox: '파이어폭스', inapp: '앱 안', other: '기타' };
const REASONS = { clear: '완주', defeat: '쓰러짐', abandon: '포기', open: '진행 중' };
const WEEKDAYS = '일월화수목금토';
/** Shares in one family of blues and greys, biggest first. */
const SHARE_COLORS = ['var(--blue)', 'var(--blue-2)', 'var(--blue-3)', 'var(--blue-4)'];
const DAY_ROWS = 14;

const app = document.getElementById('app'), tip = document.getElementById('tip');
const state = { days: Number(sessionStorage.getItem('admin-days') ?? 30), data: null, names: null, allDays: false, at: null };
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
  return { elements, fusions, firstSkill, colors: slice.presentation?.colors || {}, rooms: (slice.rooms || []).map(r => r.name) };
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

async function load() {
  if (!token()) return login();
  if (!state.data) app.innerHTML = '<p class="empty">불러오는 중…</p>';
  let response;
  try {
    state.names ??= await loadNames();
    response = await fetch(`${apiBase()}/api/admin/stats?days=${state.days}`, { headers: { Authorization: `Bearer ${token()}` }, cache: 'no-store' });
  } catch { return problem('서버에 닿지 않아요. 인터넷 연결을 확인하고 다시 불러오세요.'); }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch {} return login('토큰이 맞지 않아요. Cloudflare의 ADMIN_TOKEN 값을 그대로 넣어 주세요.'); }
  if (response.status === 503) return problem('통계 서버 설정이 아직 끝나지 않았어요. D1 데이터베이스 연결과 24글자 이상의 ADMIN_TOKEN이 필요해요(DEPLOY.md “플레이 통계”).');
  if (!response.ok) return problem('서버에 문제가 생겼어요. 잠시 뒤 다시 불러오세요.');
  state.data = body; state.at = new Date(); render();
}

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

function render() {
  const { totals, daily, devices, combos, recent } = state.data, ended = totals.clears + totals.defeats + totals.abandons;
  const today = daily.at(-1) || { sessions: 0, devices: 0, runs: 0, clears: 0 }, yesterday = daily.at(-2);
  const change = yesterday ? today.sessions - yesterday.sessions : 0;
  const delta = yesterday && change ? `<span class="delta ${change > 0 ? 'up' : 'down'}" title="어제보다">${change > 0 ? '▲' : '▼'}${num(Math.abs(change))}</span>` : '';
  const rangeLabel = state.days ? `최근 ${state.days}일` : '전체 기간';
  const maxDay = Math.max(1, ...daily.map(d => d.sessions)), maxCombo = Math.max(1, ...combos.map(c => c.runs));
  const days = [...daily].reverse(), shown = state.allDays ? days : days.slice(0, DAY_ROWS);
  app.innerHTML = `
    <header class="bar-top"><div class="in">
      <div class="brand">운행 장부<span class="mute" style="font-weight:400"> · 태엽 밖으로</span></div>
      <nav class="range" aria-label="기간">${RANGES.map(([d, label]) => `<button data-days="${d}" aria-pressed="${state.days === d}">${label}</button>`).join('')}</nav>
      <span class="stamp">${state.at.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} 기준</span>
      <button class="link" data-act="theme">${document.documentElement.dataset.theme === 'paper' ? '어둡게' : '종이'}</button><button class="link" data-act="reload">새로고침</button><button class="link" data-act="lock">잠그기</button>
    </div></header>
    <main>
      <section class="tiles" aria-label="요약">
        <div class="card tile"><div class="label">오늘 플레이</div><div class="value num">${num(today.sessions)}<small>번</small>${delta}</div><div class="note">기기 ${num(today.devices)} · 원정 ${num(today.runs)} · 완주 ${num(today.clears)}</div></div>
        <div class="card tile"><div class="label">${rangeLabel} 원정</div><div class="value num">${num(totals.runs)}<small>판</small>${totals.unfinished ? `<span class="delta mute" title="아직 돌아오지 않은 원정">진행 중 ${num(totals.unfinished)}</span>` : ''}</div><div class="note">완주 ${num(totals.clears)} · 쓰러짐 ${num(totals.defeats)} · 포기 ${num(totals.abandons)}</div></div>
        <div class="card tile"><div class="label">${rangeLabel} 기기</div><div class="value num">${num(totals.activeDevices)}<small>대</small></div><div class="note">플레이 ${num(totals.sessions)}번 · 새 기기 ${num(totals.newDevices)} · 누적 ${num(totals.devices)}</div></div>
        <div class="card tile"><div class="label">완주율</div><div class="value num">${pct(totals.clears, ended)}<small>%</small></div><div class="note">평균 ${totals.averageNode ?? '–'}번째 정거장 · ${clock(totals.averageSeconds)}</div></div>
      </section>

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
          <tbody>${recent.slice(0, 10).map(r => `<tr><td class="mute num">${esc(shortDay(r.day))}</td><td>${comboCell(r.combo)}</td><td><span class="chip ${esc(r.reason || 'open')}">${REASONS[r.reason || 'open']}</span></td><td class="r num">${r.node ? `${r.node}번째` : '–'}</td><td class="r num mute narrow-hide">${r.seconds === null ? '' : clock(r.seconds)}</td></tr>`).join('')}</tbody>
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
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.days !== undefined) { state.days = Number(button.dataset.days); state.allDays = false; sessionStorage.setItem('admin-days', state.days); load(); }
  if (button.dataset.act === 'reload') load();
  if (button.dataset.act === 'theme') {
    const next = document.documentElement.dataset.theme === 'paper' ? 'dark' : 'paper';
    document.documentElement.dataset.theme = next; try { localStorage.setItem('beyond-the-clockwork.admin-theme.v1', next); } catch {}
    render();
  }
  if (button.dataset.act === 'days') { state.allDays = !state.allDays; render(); }
  if (button.dataset.act === 'lock') { try { localStorage.removeItem(TOKEN_KEY); } catch {} state.data = null; login(); }
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

load();
