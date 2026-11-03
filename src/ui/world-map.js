import { iconAt } from './tool-icons.js';
// The world map: one floating island holding Smile Street, the Silent Factory and the Central Clock Tower.
// Areas read by their ground (paved town, grey works, stone summit); stops are small numbered nodes on the road.
// Everything is SVG built from code. The factory and the tower are drawn now and stay locked until those regions exist.

const W = 1000, H = 560;
/** Smile Street's stops, walked in this order from the town, low on the island, up toward the factory shelf. */
export const ATLAS_SPOTS = {
  town: [95, 370], 'stop-02': [170, 430], 'stop-03': [262, 470], 'stop-04': [360, 486], 'stop-05': [460, 480],
  'stop-06': [545, 440], 'stop-07': [470, 392], 'stop-08': [380, 380], 'stop-09': [290, 372], 'stop-10': [200, 330],
  'stop-11': [250, 268], 'stop-12': [340, 290], 'stop-13': [430, 305]
};
// Later regions: the road on to the factory and up to the summit, each ending at its boss.
const FACTORY = [[520, 340], [600, 360], [680, 380], [770, 360], [840, 300], [790, 240]], TOWER = [[690, 205], [600, 185], [510, 175]];

const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const f = n => n.toFixed(1);
/** A smooth line through points (Catmull-Rom as cubic curves), closed for shapes. */
function smooth(pts, closed = false) {
  const n = pts.length, p = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(p(0)[0])},${f(p(0)[1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    d += ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }
  return closed ? `${d}Z` : d;
}
const blob = (cx, cy, rx, ry, n, wobble, seed) => { const r = seeded(seed); return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, k = 1 + (r() - 0.5) * wobble * 2; return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; }); };
const at = (x, y, s, body) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">${body}</g>`;
/** Points every few pixels along a route, each with a clearance, so scenery keeps off the road. */
const along = (pts, gap) => pts.flatMap(([x, y], i) => i ? Array.from({ length: 10 }, (_, k) => [pts[i - 1][0] + (x - pts[i - 1][0]) * k / 10, pts[i - 1][1] + (y - pts[i - 1][1]) * k / 10, gap]) : []);

const cloud = (x, y, s) => at(x, y, s, '<g class="cloud"><ellipse cx="-34" cy="6" rx="34" ry="20"/><ellipse cx="0" cy="-8" rx="40" ry="30"/><ellipse cx="38" cy="4" rx="34" ry="22"/><ellipse cx="4" cy="14" rx="62" ry="18"/></g>');
const tree = (x, y, s, tone) => at(x, y, s, `<ellipse class="shadow" cx="3" cy="13" rx="13" ry="4.5"/><rect class="trunk" x="-2.5" y="4" width="5" height="10"/><circle class="leaf ${tone}" cx="0" cy="-4" r="12"/><circle class="shine" cx="-4" cy="-9" r="4"/>`);
const pine = (x, y, s) => at(x, y, s, '<ellipse class="shadow" cx="3" cy="12" rx="11" ry="4"/><rect class="trunk" x="-2.5" y="4" width="5" height="9"/><path class="pine" d="M0 -26 L13 6 H-13 Z"/><path class="pine-lit" d="M0 -26 L6 -10 H-6 Z"/>');
const house = (x, y, s, roof, wall) => at(x, y, s, `<ellipse class="shadow" cx="4" cy="2" rx="22" ry="5"/><rect class="ink" x="-16" y="-22" width="32" height="24" fill="${wall}"/><path class="ink" d="M-20 -22 L0 -40 L20 -22 Z" fill="${roof}"/><rect class="door" x="-4" y="-10" width="8" height="12"/><rect class="pane" x="-13" y="-17" width="6" height="6"/><rect class="pane" x="7" y="-17" width="6" height="6"/>`);
function scatter(region, avoid, count, seed, kind) {
  const r = seeded(seed), out = [];
  for (let i = 0; out.length < count && i < 6000; i++) {
    const a = r() * Math.PI * 2, k = Math.sqrt(r()), x = region.cx + Math.cos(a) * region.rx * k, y = region.cy + Math.sin(a) * region.ry * k;
    if (!avoid.some(([ax, ay, gap]) => Math.hypot(ax - x, ay - y) < gap)) out.push([x, y]);
  }
  return out.sort((a, b) => a[1] - b[1]).map(([x, y], i) => kind === 'pine' ? pine(x, y, 0.75 + (i % 3) * 0.1) : tree(x, y, 0.72 + (i % 3) * 0.1, i % 3 ? 'a' : 'b')).join('');
}
/** Smile Street as ground: a warm paved district with pastel roofs and flower beds between the roads. */
function district(cx, cy, rx, ry, avoid, seed) {
  const r = seeded(seed), ground = blob(cx, cy, rx, ry, 14, 0.1, seed), roofs = ['#e58a8a', '#7fb8c9', '#f0b85c', '#f4a6b8', '#a6d8f4', '#b9a3d6'], spots = [];
  for (let i = 0; spots.length < 22 && i < 5000; i++) {
    const a = r() * Math.PI * 2, k = Math.sqrt(r()) * 0.85, x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (!avoid.some(([ax, ay, gap]) => Math.hypot(ax - x, ay - y) < gap) && !spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 30)) spots.push([x, y]);
  }
  const homes = spots.sort((a, b) => a[1] - b[1]).map(([x, y], i) => i % 5 === 4
    ? `<g><ellipse class="bed" cx="${f(x)}" cy="${f(y)}" rx="11" ry="6"/><circle class="bloom b0" cx="${f(x - 4)}" cy="${f(y - 1)}" r="2.2"/><circle class="bloom b1" cx="${f(x + 4)}" cy="${f(y)}" r="2.2"/></g>`
    : house(x, y, 0.62, roofs[i % roofs.length], i % 2 ? '#f6e6c8' : '#fff0f4')).join('');
  return `<path class="town" d="${smooth(ground, true)}"/><path class="town-edge" d="${smooth(ground, true)}"/>${homes}`;
}
function factory(x, y) {
  const shed = (dx, dy, s) => at(x + dx, y + dy, s, '<ellipse class="shadow" cx="4" cy="3" rx="32" ry="6"/><rect class="ink" x="-28" y="-30" width="56" height="32" fill="#8d8f96"/><path class="ink" d="M-31 -30 l14 -12 l14 12 l14 -12 l14 12 l7 0" fill="#5c6070"/><rect x="-20" y="-20" width="10" height="9" fill="#3b4152"/><rect x="0" y="-20" width="10" height="9" fill="#3b4152"/><rect class="door" x="-6" y="-8" width="12" height="10"/>');
  const stack = (dx, dy, h) => at(x + dx, y + dy, 1, `<rect class="ink" x="-6" y="${-h}" width="12" height="${h}" fill="#7a5a4a"/><rect class="ink" x="-7" y="${-h}" width="14" height="5" fill="#a92f2b"/><circle class="smoke" cx="4" cy="${-h - 12}" r="8"/><circle class="smoke" cx="13" cy="${-h - 25}" r="11"/><circle class="smoke" cx="26" cy="${-h - 36}" r="9"/>`);
  const belt = at(x + 2, y + 30, 1, `<rect class="ink" x="-35" y="-6" width="70" height="8" fill="#55524a"/>${[0, 1, 2, 3].map(i => `<rect class="crate" x="${-32 + i * 14}" y="-14" width="9" height="8"/>`).join('')}`);
  return stack(-30, -22, 60) + stack(34, -26, 76) + shed(-34, 0, 1) + shed(30, 6, 1.15) + at(x - 70, y - 4, 1, '<circle class="ink cog" r="11"/><circle class="hub" r="4"/>') + belt;
}
const tower = (x, y, s) => at(x, y, s, '<ellipse class="shadow" cx="6" cy="4" rx="54" ry="11"/><rect class="ink" x="-48" y="-30" width="96" height="32" fill="#c9b48a"/><rect class="ink" x="-30" y="-150" width="60" height="122" fill="#e8d7b0"/><circle class="ink" cx="0" cy="-120" r="23" fill="#fff4d6"/><path class="hand" d="M0 -120 V-137 M0 -120 L12 -115"/><path class="ink" d="M-40 -150 L0 -214 L40 -150 Z" fill="#4f6fa1"/><rect x="-8" y="-80" width="16" height="26" fill="#3b4152"/><rect class="door" x="-10" y="-20" width="20" height="22"/><path class="ink" d="M0 -214 V-232 l16 6 l-16 6" fill="#a92f2b"/><circle class="ink cog" cx="-38" cy="-38" r="8"/><circle class="ink cog" cx="38" cy="-38" r="8"/>');
const banner = (x, y, text, tone = '') => `<g class="banner ${tone}"><rect x="${x - text.length * 9 - 14}" y="${y - 15}" width="${text.length * 18 + 28}" height="28" rx="4"/><text x="${x}" y="${y + 5}">${text}</text></g>`;
const soon = (x, y, text) => `<text class="soon" x="${x}" y="${y}">${text}</text>`;

let scenery = null;
/** Everything that never changes while the map is open: sky, island, the three areas and their scenery. */
function drawScenery() {
  const smile = Object.values(ATLAS_SPOTS), land = blob(500, 300, 470, 225, 18, 0.05, 6);
  const shelf = blob(745, 318, 175, 105, 12, 0.07, 3), summit = blob(470, 150, 150, 70, 12, 0.06, 9);
  const avoid = [...along(smile, 24), ...smile.map(([x, y]) => [x, y - 12, 40]), [745, 318, 190], [470, 150, 165], ...along([smile[12], ...FACTORY, ...TOWER], 22)];
  const cliff = (pts, depth, cls) => `<path class="${cls}" d="${smooth(pts.map(([x, y]) => [x, y + depth]), true)}"/>`;
  return `<defs><linearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3ec"/><stop offset="1" stop-color="#d7eef6"/></linearGradient>
    <linearGradient id="wm-lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9cf68"/><stop offset="1" stop-color="#86c25a"/></linearGradient>
    <linearGradient id="wm-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a40"/><stop offset="1" stop-color="#5e3d26"/></linearGradient></defs>
    <rect x="-600" y="-200" width="${W + 1200}" height="${H + 400}" fill="url(#wm-sky)"/>
    ${cloud(80, 520, 1.1)}${cloud(940, 60, 1)}${cloud(930, 525, 1.2)}${cloud(60, 60, 0.9)}
    ${cliff(land, 46, 'cliff')}<path class="lawn" d="${smooth(land, true)}"/><path class="rim" d="${smooth(land, true)}"/>
    <path class="fall" d="M62 300 V520"/>
    ${cliff(summit, 30, 'hill-cliff')}<path class="hill" d="${smooth(summit, true)}"/><path class="rim hill-rim" d="${smooth(summit, true)}"/>
    ${cliff(shelf, 20, 'hill-cliff works-cliff')}<path class="works" d="${smooth(shelf, true)}"/><path class="works-edge" d="${smooth(shelf, true)}"/>
    ${district(330, 400, 280, 120, avoid, 22)}
    ${scatter({ cx: 360, cy: 330, rx: 330, ry: 190 }, [...avoid, [330, 410, 240]], 40, 4)}${scatter({ cx: 470, cy: 150, rx: 170, ry: 80 }, avoid.filter(a => a[2] < 100), 8, 8, 'pine')}`;
}
const labels = () => `${banner(150, 270, '웃음거리')}${banner(860, 205, '무음공장', 'dark')}${soon(860, 231, '브라스 다음 · 준비 중')}${banner(300, 120, '중앙시계탑', 'blue')}${soon(300, 146, '무음공장 다음 · 준비 중')}
  <g class="plate" transform="translate(806 498)"><path d="M0 0 h176 l-10 22 l10 22 h-176 l10 -22 z"/><text x="88" y="21">태엽 섬</text><text class="sub" x="88" y="37">Clockwork Isle</text></g>`;

const road = (pts, cls = '') => `<path class="road-edge ${cls}" d="${smooth(pts)}"/><path class="road ${cls}" d="${smooth(pts)}"/>`;
const locked = pts => pts.map(([x, y], i) => { const boss = i === pts.length - 1; return `<g class="node locked ${boss ? 'boss' : ''}"><circle cx="${x}" cy="${y}" r="${boss ? 11 : 8}"/>${boss ? iconAt('crown', x, y, 12) : `<text x="${x}" y="${y + 3.6}">?</text>`}</g>`; }).join('');

/** Stops: { id, icon, label, state: 'done'|'current'|'ahead', kind: ''|'boss'|'shop'|'town' }. */
export function worldMapSvg(stops, picked) {
  scenery ??= drawScenery();
  const points = stops.map(stop => ATLAS_SPOTS[stop.id]), reached = Math.max(0, stops.findIndex(stop => stop.state === 'current'));
  const node = (stop, [x, y]) => {
    const r = stop.kind === 'boss' ? 11 : 9, on = stop.id === picked;
    const name = on ? `<g class="name"><rect x="${x - stop.label.length * 7 - 8}" y="${y + r + 4}" width="${stop.label.length * 14 + 16}" height="20" rx="3"/><text x="${x}" y="${y + r + 18.5}">${stop.label}</text></g>` : '';
    return `<g class="node ${stop.state} ${stop.kind} ${on ? 'picked' : ''}" data-action="map-stop" data-id="${stop.id}" role="button" aria-label="${stop.label}">
      <circle class="hit" cx="${x}" cy="${y}" r="18"/><circle cx="${x}" cy="${y}" r="${r}"/>${typeof stop.icon === 'number' ? `<text x="${x}" y="${y + 3.6}">${stop.icon}</text>` : iconAt(stop.icon, x, y, 12)}${name}
      ${stop.state === 'current' ? `<g class="you"><path d="M${x} ${y - 14} l-8 -12 h16 z"/><text x="${x}" y="${y - 30}">나</text></g>` : ''}</g>`;
  };
  const toFactory = [points[12], ...FACTORY], toTower = [FACTORY.at(-1), ...TOWER];
  return `<svg class="world-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="태엽 섬 지도">${scenery}
    ${road(points)}${reached ? `<path class="road-walked" d="${smooth(points.slice(0, reached + 1))}"/>` : ''}
    ${road(toFactory, 'future')}<path class="road-dash" d="${smooth(toFactory)}"/>${road(toTower, 'future')}<path class="road-dash" d="${smooth(toTower)}"/>
    ${factory(760, 330)}${tower(470, 150, 0.6)}
    ${locked(FACTORY)}${locked(TOWER)}
    ${stops.map((stop, i) => node(stop, points[i])).join('')}
    ${labels()}
  </svg>`;
}
