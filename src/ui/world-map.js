// The world map: the painted Clockwork Island (art/world-map/clockwork-island-v6.webp, 2026-11-08: the three regions as equal thirds) with the route drawn over it.
// Smile Street's stops sit on the painted walks between Moru's shop and the shops' square (see SMILE_STOPS). The Silent Factory and the Central
// Clock Tower are painted too; until those regions exist they are greyed under a veil with locked `?` stops.
// Every position below is in pixels of the painting (1672 x 941) and scaled to the SVG.

export const WORLD_MAP_ART = 'art/world-map/clockwork-island-v6.webp';
/** Painted stop markers (made to match the island painting); each stands on its stop with its foot on the road. */
const MARKER = name => `art/world-map/icons/${name}.webp`;
export const WORLD_MAP_MARKERS = ['town', 'market', 'boss', 'stop-ahead', 'stop-done', 'stop-current'].map(MARKER);
/** Marker height in map units, and where the plate's face sits (share of the height from the top) for the stop number. */
const MARKER_SIZE = { stop: 40, town: 48, market: 50, boss: 54 };
/** Centre of each plate's round face, as a share of the marker's width and height (measured on the pictures). */
const FACE = { ahead: [0.485, 0.415], done: [0.491, 0.4], current: [0.482, 0.42] };
const ART_W = 1672, ART_H = 941, W = 1000, H = Math.round(W * ART_H / ART_W), K = W / ART_W;
const px = ([x, y]) => [x * K, y * K];
const f = n => n.toFixed(1);

/**
 * Smile Street's stops, placed by hand where they were marked on the painting: out from the repair shop's door along
 * the outer road to Brass at its far end, just short of the brass gate, which is left for the factory's first stop.
 */
const SMILE_STOPS = [[165, 648], [300, 668], [380, 680], [460, 688], [540, 692], [620, 694], [700, 692], [780, 688], [860, 680], [930, 668], [985, 645], [1025, 612], [1040, 578]];
const STOP_IDS = ['town', 'stop-02', 'stop-03', 'stop-04', 'stop-05', 'stop-06', 'stop-07', 'stop-08', 'stop-09', 'stop-10', 'stop-11', 'stop-12', 'stop-13'];
/** Smile Street's stops on the map, by stop id, in SVG units. */
export const ATLAS_SPOTS = Object.fromEntries(SMILE_STOPS.map((p, i) => [STOP_IDS[i], px(p)]));

// Later regions: their stops on the painted factory floor and up the clock tower's stairs, each ending at its boss.
// The factory begins at the brass gate (its entrance stop), just past Brass.
const FACTORY_WAY = [[1040, 578], [1078, 548]].map(px);
// 2026-11-08 map (v6): the factory is drawn cut open. Its stops zigzag up its floors, 1F left to right, 2F back, 3F across,
// then down the lift into the two basement halls dug into the rock, the press last. The crane yard (09) is open to the sky,
// so its stop stands on the roof deck between the crane's legs, not inside the 3rd floor.
const FACTORY = [[1110, 548], [1220, 548], [1330, 548], [1470, 548], [1470, 452], [1300, 452], [1150, 452], [1150, 362], [1262, 262], [1470, 362], [1450, 650], [1290, 752]].map(px);
/** Points spaced evenly along a path (the factory's twelve stops along its painted walk). */
function along(pts, count) {
  const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = lengths.reduce((a, b) => a + b, 0);
  return Array.from({ length: count }, (_, k) => {
    let d = total * k / (count - 1), i = 0;
    while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
    const t = lengths[i] ? d / lengths[i] : 0;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
  });
}
/** The Silent Factory's stops in order, from the brass gate to the forming hall, in SVG units. */
const FACTORY_STOPS = FACTORY.length === 12 ? FACTORY : along(FACTORY, 12);
/** Where each chapter's stops stand: chapter 1 by stop id, a later chapter by stop order after the town. */
const spotsOf = (chapter, stops) => chapter === 'silent-factory' ? stops.map((stop, i) => i ? FACTORY_STOPS[i - 1] : ATLAS_SPOTS.town) : stops.map(stop => ATLAS_SPOTS[stop.id]);
// The tower's way: over the bridge from the factory roof, round its terrace and up its balconies to the bell.
const TOWER = [[1095, 282], [830, 352], [650, 396], [470, 332], [545, 238]].map(px);
/** The painted areas that stay greyed until their region exists. */
const VEILS = {
  factory: [[1048, 250], [1100, 190], [1190, 140], [1330, 130], [1460, 120], [1560, 190], [1605, 300], [1610, 560], [1560, 650], [1500, 780], [1300, 810], [1100, 790], [1070, 640], [1048, 520]],
  // The clock tower inside its great gear: the outline follows the ring, then the hill and stairs below it.
  tower: [[345, 70], [395, 18], [470, 2], [610, 2], [690, 22], [738, 80], [760, 160], [790, 280], [835, 335], [835, 420], [700, 478], [450, 478], [355, 420], [332, 300], [335, 160]]
};

const path = (pts, close = false) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join('') + (close ? 'Z' : '');
const banner = (x, y, text, tone = '') => `<g class="banner ${tone}"><rect x="${x - text.length * 9 - 14}" y="${y - 15}" width="${text.length * 18 + 28}" height="28" rx="4"/><text x="${x}" y="${y + 5}">${text}</text></g>`;
const soon = (x, y, text) => `<text class="soon" x="${x}" y="${y}">${text}</text>`;
// Stops of regions not open yet: the same painted markers, greyed, a `?` on each plate.
const locked = pts => `<path class="road-dash" d="${path(pts)}"/>` + pts.map(([x, y], i) => {
  const boss = i === pts.length - 1, size = (boss ? MARKER_SIZE.boss : MARKER_SIZE.stop) * 0.85, top = y - size * 0.86;
  return `<g class="node locked ${boss ? 'boss' : ''}"><image class="marker" href="${MARKER(boss ? 'boss' : 'stop-ahead')}" x="${f(x - size / 2)}" y="${f(top)}" width="${f(size)}" height="${f(size)}"/>${boss ? '' : `<text class="num" x="${f(x - size / 2 + size * FACE.ahead[0])}" y="${f(top + size * FACE.ahead[1])}">?</text>`}</g>`;
}).join('');

const sceneries = {};
/** The painting, with the regions not yet open shown again in grey through their outlines. */
function drawScenery(factoryOpen) {
  const veils = Object.entries(VEILS).map(([id, pts]) => `<clipPath id="wm-${id}"><path d="${path(pts.map(px), true)}"/></clipPath>`).join('');
  const grey = id => `<g clip-path="url(#wm-${id})"><image href="${WORLD_MAP_ART}" width="${W}" height="${H}" filter="url(#wm-grey)"/><rect class="veil" width="${W}" height="${H}"/></g>`;
  return `<defs>${veils}<filter id="wm-grey"><feColorMatrix type="saturate" values="0.15"/></filter></defs>
    <image href="${WORLD_MAP_ART}" width="${W}" height="${H}"/>${factoryOpen ? '' : grey('factory')}${grey('tower')}`;
}
const labels = factoryOpen => `${banner(300, 478, '웃음거리')}${banner(800, 52, '무음공장', 'dark')}${factoryOpen ? '' : soon(800, 78, '브라스 다음 · 준비 중')}${banner(130, 40, '중앙시계탑', 'blue')}${soon(130, 66, '무음공장 다음 · 준비 중')}`;

/**
 * Stops: { id, icon, label, state: 'done'|'current'|'ahead', kind: ''|'boss'|'shop'|'town' }, the town first.
 * `chapter` says whose stops these are; `factoryOpen` lifts the factory's grey veil once chapter 1 is beaten.
 */
export function worldMapSvg(stops, picked, { chapter = 'smile-street', factoryOpen = false } = {}) {
  const scenery = sceneries[factoryOpen] ??= drawScenery(factoryOpen), factory = chapter === 'silent-factory';
  const points = spotsOf(chapter, stops), reached = Math.max(0, stops.findIndex(stop => stop.state === 'current'));
  // On the factory's road the walk from the town runs down Smile Street to the brass gate first.
  const road = factory ? [ATLAS_SPOTS.town, ...SMILE_STOPS.slice(1).map(px), ...FACTORY_WAY, ...points.slice(1)] : points, lead = factory ? SMILE_STOPS.length + FACTORY_WAY.length - 1 : 0;
  const node = (stop, [x, y]) => {
    const on = stop.id === picked, kind = ['boss', 'shop', 'town'].includes(stop.kind) ? stop.kind : 'stop';
    const size = MARKER_SIZE[kind === 'shop' ? 'market' : kind], art = kind === 'stop' ? `stop-${stop.state}` : kind === 'shop' ? 'market' : kind;
    // The marker's foot stands on the stop point; the number goes on the plate's face.
    const top = y - size * 0.86, r = size * 0.14;
    const [fx, fy] = FACE[stop.state] || FACE.ahead;
    const face = typeof stop.icon === 'number' && kind === 'stop' ? `<text class="num" x="${f(x - size / 2 + size * fx)}" y="${f(top + size * fy)}">${stop.icon}</text>` : '';
    const name = on ? `<g class="name"><rect x="${f(x - stop.label.length * 7 - 8)}" y="${f(y + 4)}" width="${stop.label.length * 14 + 16}" height="20" rx="3"/><text x="${f(x)}" y="${f(y + 18.5)}">${stop.label}</text></g>` : '';
    return `<g class="node ${stop.state} ${stop.kind} ${on ? 'picked' : ''}" data-action="map-stop" data-id="${stop.id}" role="button" aria-label="${stop.label}">
      <circle class="hit" cx="${f(x)}" cy="${f(y - size * 0.4)}" r="${f(size * 0.6)}"/><image class="marker" href="${MARKER(art)}" x="${f(x - size / 2)}" y="${f(top)}" width="${size}" height="${size}"/>${face}${name}
      ${stop.state === 'current' ? `<g class="you"><path d="M${f(x)} ${f(top - 2)} l-8 -12 h16 z"/><text x="${f(x)}" y="${f(top - 18)}">나</text></g>` : ''}</g>`;
  };
  return `<svg class="world-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="태엽 섬 지도">${scenery}
    <path class="road-trail" d="${path(road)}"/>${reached ? `<path class="road-walked" d="${path(road.slice(0, lead + reached + 1))}"/>` : ''}
    ${factory ? '' : `<path class="road-dash" d="${path(FACTORY_WAY)}"/>${locked(FACTORY)}`}${locked(TOWER)}
    ${stops.map((stop, i) => node(stop, points[i])).join('')}
    ${labels(factoryOpen)}
  </svg>`;
}
