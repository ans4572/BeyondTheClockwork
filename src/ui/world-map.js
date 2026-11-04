import { iconAt } from './tool-icons.js';
// The world map: the painted Clockwork Island (art/world-map/clockwork-island.webp) with the route drawn over it.
// Smile Street's stops sit on the painted walks between Moru's shop and the shops' square (see SMILE_STOPS). The Silent Factory and the Central
// Clock Tower are painted too; until those regions exist they are greyed under a veil with locked `?` stops.
// Every position below is in pixels of the painting (1672 x 941) and scaled to the SVG.

export const WORLD_MAP_ART = 'art/world-map/clockwork-island.webp';
const ART_W = 1672, ART_H = 941, W = 1000, H = Math.round(W * ART_H / ART_W), K = W / ART_W;
const px = ([x, y]) => [x * K, y * K];
const f = n => n.toFixed(1);

/**
 * Smile Street's stops, placed by hand where they were marked on the painting: out from the repair shop's door along
 * the outer road to Brass at its far end, just short of the brass gate, which is left for the factory's first stop.
 */
const SMILE_STOPS = [[300, 628], [439, 644], [511, 680], [622, 688], [733, 676], [800, 660], [860, 636], [952, 676], [1042, 684], [1134, 676], [1225, 663], [1320, 644], [1394, 612]];
const STOP_IDS = ['town', 'stop-02', 'stop-03', 'stop-04', 'stop-05', 'stop-06', 'stop-07', 'stop-08', 'stop-09', 'stop-10', 'stop-11', 'stop-12', 'stop-13'];
/** Smile Street's stops on the map, by stop id, in SVG units. */
export const ATLAS_SPOTS = Object.fromEntries(SMILE_STOPS.map((p, i) => [STOP_IDS[i], px(p)]));

// Later regions: their stops on the painted factory floor and up the clock tower's stairs, each ending at its boss.
// The factory begins at the brass gate (its entrance stop), just past Brass.
const FACTORY_WAY = [[1394, 612], [1405, 555]].map(px);
const FACTORY = [[1408, 520], [1190, 395], [1290, 352], [1405, 336], [1505, 300], [1560, 232], [1450, 196]].map(px);
const TOWER = [[880, 392], [905, 318], [850, 238], [852, 150]].map(px);
/** The painted areas that stay greyed until their region exists. */
const VEILS = {
  factory: [[1085, 340], [1110, 200], [1240, 120], [1400, 80], [1530, 100], [1610, 170], [1652, 300], [1630, 420], [1510, 436], [1330, 432], [1200, 420], [1100, 392]],
  // The clock tower inside its great gear: the outline follows the ring, then the hill and stairs below it.
  tower: [[795, 6], [905, 6], [965, 50], [992, 120], [995, 220], [985, 330], [930, 380], [780, 380], [712, 320], [705, 220], [710, 120], [737, 50]]
};

const path = (pts, close = false) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join('') + (close ? 'Z' : '');
const banner = (x, y, text, tone = '') => `<g class="banner ${tone}"><rect x="${x - text.length * 9 - 14}" y="${y - 15}" width="${text.length * 18 + 28}" height="28" rx="4"/><text x="${x}" y="${y + 5}">${text}</text></g>`;
const soon = (x, y, text) => `<text class="soon" x="${x}" y="${y}">${text}</text>`;
const locked = pts => `<path class="road-dash" d="${path(pts)}"/>` + pts.map(([x, y], i) => { const boss = i === pts.length - 1; return `<g class="node locked ${boss ? 'boss' : ''}"><circle cx="${f(x)}" cy="${f(y)}" r="${boss ? 11 : 8}"/>${boss ? iconAt('crown', x, y, 12) : `<text x="${f(x)}" y="${f(y + 3.6)}">?</text>`}</g>`; }).join('');

let scenery = null;
/** The painting, with the regions not yet open shown again in grey through their outlines. */
function drawScenery() {
  const veils = Object.entries(VEILS).map(([id, pts]) => `<clipPath id="wm-${id}"><path d="${path(pts.map(px), true)}"/></clipPath>`).join('');
  const grey = id => `<g clip-path="url(#wm-${id})"><image href="${WORLD_MAP_ART}" width="${W}" height="${H}" filter="url(#wm-grey)"/><rect class="veil" width="${W}" height="${H}"/></g>`;
  return `<defs>${veils}<filter id="wm-grey"><feColorMatrix type="saturate" values="0.15"/></filter></defs>
    <image href="${WORLD_MAP_ART}" width="${W}" height="${H}"/>${grey('factory')}${grey('tower')}`;
}
const labels = () => `${banner(420, 470, '웃음거리')}${banner(800, 72, '무음공장', 'dark')}${soon(800, 98, '브라스 다음 · 준비 중')}${banner(360, 60, '중앙시계탑', 'blue')}${soon(360, 86, '무음공장 다음 · 준비 중')}`;

/** Stops: { id, icon, label, state: 'done'|'current'|'ahead', kind: ''|'boss'|'shop'|'town' }. */
export function worldMapSvg(stops, picked) {
  scenery ??= drawScenery();
  const points = stops.map(stop => ATLAS_SPOTS[stop.id]), reached = Math.max(0, stops.findIndex(stop => stop.state === 'current'));
  const node = (stop, [x, y]) => {
    const r = stop.kind === 'boss' ? 11 : 9, on = stop.id === picked;
    const name = on ? `<g class="name"><rect x="${f(x - stop.label.length * 7 - 8)}" y="${f(y + r + 4)}" width="${stop.label.length * 14 + 16}" height="20" rx="3"/><text x="${f(x)}" y="${f(y + r + 18.5)}">${stop.label}</text></g>` : '';
    return `<g class="node ${stop.state} ${stop.kind} ${on ? 'picked' : ''}" data-action="map-stop" data-id="${stop.id}" role="button" aria-label="${stop.label}">
      <circle class="hit" cx="${f(x)}" cy="${f(y)}" r="18"/><circle cx="${f(x)}" cy="${f(y)}" r="${r}"/>${typeof stop.icon === 'number' ? `<text x="${f(x)}" y="${f(y + 3.6)}">${stop.icon}</text>` : iconAt(stop.icon, x, y, 12)}${name}
      ${stop.state === 'current' ? `<g class="you"><path d="M${f(x)} ${f(y - 14)} l-8 -12 h16 z"/><text x="${f(x)}" y="${f(y - 30)}">나</text></g>` : ''}</g>`;
  };
  return `<svg class="world-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="태엽 섬 지도">${scenery}
    <path class="road-trail" d="${path(points)}"/>${reached ? `<path class="road-walked" d="${path(points.slice(0, reached + 1))}"/>` : ''}
    <path class="road-dash" d="${path(FACTORY_WAY)}"/>${locked(FACTORY)}${locked(TOWER)}
    ${stops.map((stop, i) => node(stop, points[i])).join('')}
    ${labels()}
  </svg>`;
}
