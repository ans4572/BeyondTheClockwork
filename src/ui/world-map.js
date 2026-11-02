// The Smile Street world map, drawn as one floating island: clouds, lawn, trees, a winding road and a medallion per stop.
// Everything is SVG built from code; each medallion shows a crop of that area's own map art.

const W = 1000, H = 560;
/** Where each stop sits on the island, walked in this order from the town to the parade ground. */
export const ATLAS_SPOTS = {
  town: [150, 392], 'stop-02': [292, 428], 'stop-03': [440, 404], 'stop-04': [592, 430], 'stop-05': [742, 398],
  'stop-06': [846, 290], 'stop-07': [712, 268], 'stop-08': [566, 296], 'stop-09': [420, 272], 'stop-10': [272, 290],
  'stop-11': [196, 170], 'stop-12': [356, 140], 'stop-13': [540, 118]
};

/** A small seeded random, so the trees and grass stand in the same places every time the map opens. */
function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

/** A closed blob through points around a centre, smoothed with Catmull-Rom curves. */
function blob(points) {
  const n = points.length, p = i => points[(i + n) % n];
  let d = `M${p(0)[0]},${p(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    d += ` C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
  }
  return `${d}Z`;
}
/** An open smooth line through points. */
function trail(points) {
  const p = i => points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M${p(0)[0]},${p(0)[1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    d += ` C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
  }
  return d;
}

const ISLAND = [[70, 300], [96, 196], [170, 104], [300, 70], [470, 58], [640, 66], [790, 98], [900, 170], [944, 280], [912, 392], [836, 470], [690, 500], [500, 512], [310, 504], [160, 476], [86, 400]];
const cloud = (x, y, s) => `<g class="wm-cloud" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-34" cy="6" rx="34" ry="20"/><ellipse cx="0" cy="-8" rx="40" ry="30"/><ellipse cx="38" cy="4" rx="34" ry="22"/><ellipse cx="4" cy="14" rx="62" ry="18"/></g>`;
const tree = (x, y, s, tone) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse class="wm-shadow" cx="3" cy="13" rx="14" ry="5"/><rect class="wm-trunk" x="-2.5" y="4" width="5" height="10"/><circle class="wm-leaf ${tone}" cx="0" cy="-4" r="13"/><circle class="wm-shine" cx="-4" cy="-9" r="4.5"/></g>`;

let scenery = null;
/** The parts that never change: sky, clouds, island, cliffs, waterfall, lawn patches and trees. */
function drawScenery() {
  const random = seeded(7), spots = Object.values(ATLAS_SPOTS);
  // The road between stops, sampled every few pixels, so nothing grows on it.
  const road = spots.flatMap(([x, y], i) => i ? Array.from({ length: 12 }, (_, k) => [spots[i - 1][0] + (x - spots[i - 1][0]) * k / 12, spots[i - 1][1] + (y - spots[i - 1][1]) * k / 12]) : [[x, y]]);
  const nearRoad = (x, y, gap) => spots.some(([rx, ry]) => Math.hypot(rx - x, ry - (y + 20)) < gap + 20) || road.some(([rx, ry]) => Math.hypot(rx - x, ry - y) < gap * 0.45);
  const cliff = ISLAND.map(([x, y]) => [x, y > 250 ? y + 44 : y + 30]);
  const patches = Array.from({ length: 14 }, () => [120 + random() * 760, 110 + random() * 340, 40 + random() * 60, 14 + random() * 18]).map(([x, y, rx, ry]) => `<ellipse class="wm-patch" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('');
  const trees = [];
  for (let i = 0; trees.length < 90 && i < 3000; i++) {
    const x = 90 + random() * 830, y = 80 + random() * 420;
    // Trees crowd the lawn but leave the road and the stops clear.
    if (nearRoad(x, y, 70)) continue;
    trees.push([x, y]);
  }
  const rim = trees.filter(([x, y]) => { const cx = 505, cy = 285; return Math.hypot((x - cx) / 430, (y - cy) / 215) < 0.98; });
  const treeArt = rim.sort((a, b) => a[1] - b[1]).map(([x, y], i) => tree(Math.round(x), Math.round(y), 0.8 + (i % 4) * 0.12, i % 3 ? 'a' : 'b')).join('');
  const flowers = Array.from({ length: 40 }, () => [130 + random() * 740, 120 + random() * 340]).filter(([x, y]) => !nearRoad(x, y, 46)).map(([x, y], i) => `<circle class="wm-flower f${i % 3}" cx="${x}" cy="${y}" r="2.6"/>`).join('');
  return `<defs><linearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3ec"/><stop offset="1" stop-color="#d7eef6"/></linearGradient>
    <linearGradient id="wm-lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8cf6c"/><stop offset=".3" stop-color="#9ccb62"/><stop offset="1" stop-color="#86c25a"/></linearGradient>
    <linearGradient id="wm-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a40"/><stop offset="1" stop-color="#5e3d26"/></linearGradient></defs>
    <rect x="-600" y="-200" width="${W + 1200}" height="${H + 400}" fill="url(#wm-sky)"/>
    ${cloud(70, 520, 1.1)}${cloud(930, 70, 1)}${cloud(960, 500, 1.2)}${cloud(40, 70, 0.9)}${cloud(520, 548, 1.3)}
    <path class="wm-cliff" d="${blob(cliff)}"/>
    <path class="wm-strata" d="M120 470 Q300 506 500 512 T880 452"/>
    <path class="wm-fall" d="M78 330 L78 520"/><path class="wm-fall thin" d="M90 334 L90 520"/>
    <path class="wm-island" d="${blob(ISLAND)}"/>
    ${patches}${flowers}
    <path class="wm-rim" d="${blob(ISLAND)}"/>
    ${treeArt}
    ${cloud(880, 520, 0.8)}${cloud(120, 40, 0.7)}`;
}

/** Stops: { id, icon, label, state: 'done'|'current'|'ahead', kind: ''|'boss'|'shop'|'town' }. */
export function worldMapSvg(stops, picked) {
  scenery ??= drawScenery();
  const points = stops.map(stop => ATLAS_SPOTS[stop.id]), reached = Math.max(0, stops.findIndex(stop => stop.state === 'current'));
  const walked = trail(points.slice(0, reached + 1));
  const medal = (stop, [x, y]) => {
    const r = stop.kind === 'boss' ? 40 : 33, on = stop.id === picked;
    return `<g class="wm-stop ${stop.state} ${stop.kind} ${on ? 'picked' : ''}" data-action="map-stop" data-id="${stop.id}" tabindex="0" role="button" aria-label="${stop.label}">
      <clipPath id="wm-clip-${stop.id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>
      <ellipse class="wm-shadow" cx="${x + 4}" cy="${y + r - 2}" rx="${r}" ry="${r * 0.32}"/>
      <circle class="wm-ring" cx="${x}" cy="${y}" r="${r + 5}"/>
      <image href="art/ui/world-map/${stop.id}.png" x="${x - r * 1.5}" y="${y - r}" width="${r * 3}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#wm-clip-${stop.id})"/>
      <circle class="wm-edge" cx="${x}" cy="${y}" r="${r}"/>
      <g class="wm-badge"><circle cx="${x - r * 0.78}" cy="${y - r * 0.78}" r="12"/><text x="${x - r * 0.78}" y="${y - r * 0.78 + 4.5}">${stop.icon}</text></g>
      <g class="wm-plate"><rect x="${x - stop.label.length * 7 - 8}" y="${y + r + 4}" width="${stop.label.length * 14 + 16}" height="20" rx="3"/><text x="${x}" y="${y + r + 18.5}">${stop.label}</text></g>
      ${stop.state === 'current' ? `<g class="wm-you"><path d="M${x} ${y - r - 8} l-9 -14 h18 z"/><text x="${x}" y="${y - r - 27}">나</text></g>` : ''}
    </g>`;
  };
  return `<svg class="world-map" viewBox="20 36 ${W - 40} ${H - 36}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="웃음거리 지도">${scenery}
    <path class="wm-road-edge" d="${trail(points)}"/><path class="wm-road" d="${trail(points)}"/>
    <path class="wm-road-walked" d="${walked}"/><path class="wm-road-dots" d="${trail(points)}"/>
    ${stops.map((stop, i) => medal(stop, points[i])).join('')}
    <g class="wm-title" transform="translate(30 498)"><path d="M0 0 h170 l-10 22 l10 22 h-170 l10 -22 z"/><text x="85" y="21">웃음거리</text><text class="sub" x="85" y="37">SMILE STREET</text></g>
  </svg>`;
}
