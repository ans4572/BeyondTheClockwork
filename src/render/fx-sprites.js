// Effect sheets made with PixelLab's effect workbench (art/fx/<name>.png, with the exported .json beside it).
// w x h per frame, `cols` frames to a row, `anchor` = the effect's origin inside a frame (where it is placed).
export const FX = {
  drumBeat: { sheet: 'art/fx/drum-beat.png', w: 128, h: 80, cols: 4, frames: 12, anchor: [64, 48] },
  drumBuff: { sheet: 'art/fx/drum-buff.png', w: 56, h: 72, cols: 4, frames: 12, anchor: [28, 60] },
  rocoSticker: { sheet: 'art/fx/roco-sticker.png', w: 60, h: 70, cols: 4, frames: 12, anchor: [30, 57] },
  rocoCan: { sheet: 'art/fx/roco-can.png', w: 16, h: 18, cols: 2, frames: 4, anchor: [8, 9] },
  // Roco's cans in his phase break, drawn with PixelLab (2026-11-06): a silver one to bat back, a red bomb to avoid.
  // A body summoned into a room (PixelLab VFX 'Clockwork summon rift'): a gold rift opens, a light column rises as the
  // body appears (frame 9 of 22 at 14 fps), then smoke and the seal. Drawn at half size, as sprites are.
  summonRift: { sheet: 'art/fx/summon-rift-v1.png', w: 67, h: 87, cols: 5, frames: 22, anchor: [33, 73] },
  rocoCanSilver: { sheet: 'art/fx/roco-can-silver-v1.png', w: 32, h: 32, cols: 1, frames: 1, anchor: [16, 18] },
  rocoCanBomb: { sheet: 'art/fx/roco-can-bomb-v1.png', w: 32, h: 32, cols: 1, frames: 1, anchor: [16, 16] },
  crate: { sheet: 'art/fx/crate.png', w: 20, h: 18, cols: 1, frames: 1, anchor: [10, 16] },
  crateCrash: { sheet: 'art/fx/crate-crash.png', w: 70, h: 32, cols: 3, frames: 9, anchor: [35, 16] },
  magnetField: { sheet: 'art/fx/magnet-field.png', w: 100, h: 42, cols: 4, frames: 12, anchor: [50, 20] },
  stompRing: { sheet: 'art/fx/stomp-ring.png', w: 120, h: 50, cols: 3, frames: 8, anchor: [60, 25] },
  // A seamless PixelLab carpet tile (img2img over a chevron sketch); the renderer scrolls it along the lane.
  marchLane: { sheet: 'art/fx/march-carpet.png', w: 64, h: 32, cols: 1, frames: 1, anchor: [0, 16] },
  chargeArcs: { sheet: 'art/fx/charge-arcs.png', w: 27, h: 30, cols: 4, frames: 12, anchor: [13, 16] },
  chargedMotes: { sheet: 'art/fx/charged-motes.png', w: 34, h: 20, cols: 5, frames: 24, anchor: [17, 10] },
  conductiveSpanner: { sheet: 'art/fx/conductive-spanner.png', w: 37, h: 27, cols: 4, frames: 12, anchor: [25, 14] },
  deflectFlash: { sheet: 'art/fx/deflect-flash.png', w: 32, h: 35, cols: 3, frames: 8, anchor: [17, 15] },
  electricHit: { sheet: 'art/fx/electric-hit.png', w: 45, h: 34, cols: 4, frames: 10, anchor: [18, 14] },
  frostBolt: { sheet: 'art/fx/frost-bolt.png', w: 52, h: 26, cols: 3, frames: 8, anchor: [41, 13] },
  frostShatter: { sheet: 'art/fx/frost-shatter.png', w: 39, h: 50, cols: 4, frames: 10, anchor: [20, 19] },
  // 빙풍 절단 (PixelLab): the ice crescent flying to the right with its wind trail, and the same crescent breaking up.
  frostCrescent: { sheet: 'art/fx/frost-crescent-v1.png', w: 128, h: 128, cols: 4, frames: 8, anchor: [86, 64] },
  frostCrescentBreak: { sheet: 'art/fx/frost-crescent-break-v1.png', w: 128, h: 128, cols: 4, frames: 8, anchor: [86, 64] },
  groundFire: { sheet: 'art/fx/ground-fire.png', w: 35, h: 27, cols: 3, frames: 8, anchor: [18, 18] },
  groundShockwave: { sheet: 'art/fx/ground-shockwave.png', w: 94, h: 40, cols: 4, frames: 10, anchor: [47, 20] },
  guardThrust: { sheet: 'art/fx/guard-thrust.png', w: 42, h: 20, cols: 3, frames: 7, anchor: [4, 10] },
  hasteArrows: { sheet: 'art/fx/haste-arrows.png', w: 38, h: 43, cols: 4, frames: 12, anchor: [18, 31] },
  heatSwing: { sheet: 'art/fx/heat-swing.png', w: 55, h: 51, cols: 4, frames: 12, anchor: [27, 24] },
  marchStomp: { sheet: 'art/fx/march-stomp.png', w: 40, h: 34, cols: 4, frames: 10, anchor: [19, 19] },
  pressureDash: { sheet: 'art/fx/pressure-dash.png', w: 76, h: 37, cols: 4, frames: 12, anchor: [43, 17] },
  ratExplosion: { sheet: 'art/fx/rat-explosion.png', w: 43, h: 45, cols: 4, frames: 12, anchor: [22, 27] },
  // pixelfx (github.com/patch-gg/pixelfx, MIT; art/fx/*.json beside them), picked 2026-11-09 on a comparison page.
  // A crate going off: pixelfx's small explosion redrawn for this top-down floor (shock ring and scorch flat on the
  // floor, wood splinters thrown all round), sized for a 2.2-unit blast; 30 fps, 1.53 s. Anchor = the floor under the crate.
  crateBlast: { sheet: 'art/fx/crate-blast-v1.png', w: 152, h: 136, cols: 7, frames: 46, anchor: [76, 86] },
  // A music box mending F2: pixelfx's collect burst in the music box mint (#8fd8b0); 30 fps, 1.4 s. Anchor = F2's feet.
  mendBurst: { sheet: 'art/fx/mend-burst-v1.png', w: 112, h: 108, cols: 7, frames: 42, anchor: [56, 94] },
  // pixelfx sheets for the everyday fight (2026-11-09; sources in art/fx/pixelfx). The wrench swing round F2, facing
  // right, made for a 44 px (normal) or 51 px (third blow) reach at 60 fps; the renderer turns, mirrors and fits it.
  wrenchArc: { sheet: 'art/fx/wrench-arc-v1.png', w: 144, h: 144, cols: 5, frames: 20, fps: 60, anchor: [72, 72] },
  wrenchArcHeavy: { sheet: 'art/fx/wrench-arc-heavy-v1.png', w: 144, h: 144, cols: 5, frames: 20, fps: 60, anchor: [72, 72] },
  // The wrench landing: a cross flare and sparks along the blow, facing right (turned to the swing).
  wrenchHit: { sheet: 'art/fx/wrench-hit-v1.png', w: 120, h: 96, cols: 4, frames: 13, anchor: [40, 48] },
  // Something small breaking (shield, coating, fence, box): chips of one material thrown over the floor.
  scrapWood: { sheet: 'art/fx/scrap-wood-v1.png', w: 112, h: 96, cols: 5, frames: 22, anchor: [56, 60] },
  scrapBrass: { sheet: 'art/fx/scrap-brass-v1.png', w: 112, h: 96, cols: 5, frames: 22, anchor: [56, 60] },
  scrapIce: { sheet: 'art/fx/scrap-ice-v1.png', w: 112, h: 96, cols: 5, frames: 22, anchor: [56, 60] },
  scrapOil: { sheet: 'art/fx/scrap-oil-v1.png', w: 112, h: 96, cols: 5, frames: 22, anchor: [56, 60] },
  // Water putting out a burning body: a flat pale ring, dying sparks and a white steam cloud rising (pixelfx, 2026-11-09).
  steamPuff: { sheet: 'art/fx/steam-puff-v1.png', w: 88, h: 88, cols: 5, frames: 24, anchor: [44, 64] },
  // A hot floor plate burning F2's feet: a flat ring and small flames.
  plateFlare: { sheet: 'art/fx/plate-flare-v1.png', w: 80, h: 80, cols: 5, frames: 18, anchor: [40, 56] },
  readyPop: { sheet: 'art/fx/ready-pop.png', w: 24, h: 27, cols: 4, frames: 10, anchor: [11, 17] },
  trumpetWave: { sheet: 'art/fx/trumpet-wave.png', w: 88, h: 46, cols: 4, frames: 14, anchor: [6, 23] },
  // Sound and water (PixelLab Pro Flash concept + PixMiniMax frames, 2026-11-08; art/animations/player/skills/sound-water).
  // Drawn facing right and turned by the renderer; scaled down from their 128/256 px frames.
  ringPalm: { sheet: 'art/fx/ring-palm-v1.png', w: 128, h: 128, cols: 4, frames: 9, anchor: [13, 63] },
  roarBeam: { sheet: 'art/fx/roar-beam-v1.png', w: 256, h: 128, cols: 4, frames: 9, anchor: [27, 61] },
  waterShot: { sheet: 'art/fx/water-shot-v1.png', w: 128, h: 128, cols: 4, frames: 8, anchor: [59, 63] },
  echoRing: { sheet: 'art/fx/echo-ring-v1.png', w: 128, h: 128, cols: 4, frames: 8, anchor: [61, 63] },
  waterSplash: { sheet: 'art/fx/water-splash-v1.png', w: 128, h: 128, cols: 4, frames: 9, anchor: [62, 95] },
  resonanceBurst: { sheet: 'art/fx/resonance-burst-v1.png', w: 128, h: 128, cols: 4, frames: 9, anchor: [64, 62] },
  overheatBurst: { sheet: 'art/fx/overheat-burst-v1.png', w: 128, h: 128, cols: 4, frames: 9, anchor: [63, 100] },
  // 고압 분사's stream, flowing left to right: `ends` = the gush at the nozzle and the frayed tip, which keep their size
  // while the middle is fitted to the stream's length (canvas.js drawStream).
  hydroStream: { sheet: 'art/fx/hydro-stream-v1.png', w: 256, h: 48, cols: 4, frames: 8, anchor: [0, 22], ends: [22, 46] },
  // pixelfx redraws picked on a comparison page (2026-11-11; sources in art/fx/pixelfx). Press landing a plate, a crane or a
  // piston: a flat white flash, two flat shock rings, dust rolling out and iron chips, seen from above; 30 fps, 1.1 s,
  // drawn for a 3-unit ring (62 px). Anchor = the floor where it lands.
  pressSlam: { sheet: 'art/fx/press-slam-v1.png', w: 176, h: 160, cols: 6, frames: 34, anchor: [88, 60] },
  // 압축 돌진: a crescent of compressed air ahead of F2 (16 px either side), speed lines and wind ribbons behind; a 0.5 s loop
  // at 24 fps, facing right. Anchor = F2.
  dashGust: { sheet: 'art/fx/dash-gust-v1.png', w: 144, h: 56, cols: 3, frames: 12, fps: 24, anchor: [88, 28] },
  // 굉음: a pillar of sound 150 px long and 13 px either side at full charge, rings rolling down it; 0.6 s, facing right.
  roarPillar: { sheet: 'art/fx/roar-pillar-v1.png', w: 176, h: 64, cols: 3, frames: 19, anchor: [12, 32] },
  // 공명 낙뢰: the bolt slamming down on its body, a flat flash and gold sound rings; 30 fps, 1 s. Anchor = the body's feet.
  boltStrike: { sheet: 'art/fx/bolt-strike-v1.png', w: 128, h: 144, cols: 6, frames: 31, anchor: [64, 112] },
  // 도전 스패너 in flight: a steel spanner spinning (two turns a loop) with a gold electric rim, arcs off its ends and sparks
  // streaming behind; 0.5 s at 24 fps, flying right. Anchor = the spanner's middle. (증기 파쇄's redraw is a cast sheet in game-clips.json.)
  spannerSpin: { sheet: 'art/fx/spanner-spin-v1.png', w: 100, h: 60, cols: 3, frames: 12, fps: 24, anchor: [62, 30] },
  // A heavy blow's shockwave along the floor (mob swings, stomps, rows pressed; 21 places use look 'quake'): a short flat flash,
  // two hollow rings racing out and dust rolling low; no disc (the old one read as a paper plate). 0.6 s at 30 fps, drawn for a
  // 32 px reach; the renderer fits it to the blow's reach and plays it over the effect's own duration. Anchor = the floor.
  floorShock: { sheet: 'art/fx/floor-shock-v2.png', w: 96, h: 72, cols: 4, frames: 19, anchor: [48, 36] },
  // The yellow portal marker (2026-11-11): a gold ring inlaid in the floor like the maps' brass trims (dark outline, twelve
  // dial ticks, a warm see-through floor inside), breathing, motes rising, a slim arrow bobbing over it. A 1.6 s loop.
  portalMarker: { sheet: 'art/fx/portal-marker-v4.png', w: 56, h: 58, cols: 6, frames: 32, fps: 20, anchor: [28, 46] },
};
/** A note drawn for enemy shots (hand-made pixels, 24 x 28). */
export const NOTE_ART = 'art/fx/note.png';
/**
 * Still pictures the renderer moves itself (turns, pulses, tints): floor marks seen from above, warning glyphs, sparks
 * and shots. Prompts: art/fx/marks/9-floor-marks, 10-tell-glyphs, 11-particles (.prompt.txt). Until a file exists the
 * plain code shape it replaces is drawn instead.
 */
/**
 * Chapter 2's factory attack art (PixelLab Pro Flash, 2026-11-08; raw pictures in art/chapters/2-silent-factory/fx/src):
 * floor marks, shots and beams, hit and state signs, and the boss rooms' break props. Drawn through drawMark like MARKS,
 * at their own pixel size; the code shapes stay as the fallback while a file is missing.
 */
/** Chapter 2 marks redrawn (2026-11-08): the press plate in the forming hall's dark iron and brass. */
const FACTORY_REDRAWN = new Set(['boss-plate']);
/** The eight ways a mirror can face, by its dir (0 east, then clockwise on screen: 2 south, 4 west, 6 north). */
export const MIRROR_WAYS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
export const FACTORY_FX = Object.fromEntries(Object.entries({
  stampReject: 'stamp-reject', stampPass: 'stamp-pass', oilPuddle: 'oil-puddle', oilFrozen: 'oil-frozen', tapePiece: 'tape-piece',
  rivetPlanted: 'rivet-planted', rivetShot: 'rivet-shot', oilCan: 'oil-can', brassPlate: 'brass-plate', laserBeam: 'laser-beam',
  measureHook: 'measure-hook', failTag: 'fail-tag', failBlast: 'fail-blast', dazeStar: 'daze-star', stampImpact: 'stamp-impact',
  grabClamp: 'grab-clamp', reinspectSeal: 'reinspect-seal', mirror: 'mirror', mirrorLit: 'mirror-lit', pylon: 'pylon',
  pylonBroken: 'pylon-broken', piston: 'piston', bossPlate: 'boss-plate', armStuck: 'arm-stuck',
  // Iris's decoy pattern: her south still with and without the reject stamp; her searchlight's cone and beam (2026-11-08).
  irisSouth: 'iris-south', irisSouthPlain: 'iris-south-nostamp', searchCone: 'searchlight-cone', searchBeam: 'searchlight-beam',
  // Press's moulds (one per toy shape), his crusher wall's top and leading edge (PixelLab, 2026-11-08).
  moldKey: 'mold-key', moldHorse: 'mold-horse', moldTeapot: 'mold-teapot', moldBoot: 'mold-boot', moldRabbit: 'mold-rabbit', moldNote: 'mold-note',
  wallTop: 'wall-top', wallEdge: 'wall-edge',
  // Press's overhead crane claw and steam valves (PixelLab, 2026-11-09).
  craneOpen: 'crane-claw-open', craneShut: 'crane-claw-shut', valveShut: 'valve-shut', valveOpen: 'valve-open',
  // Iris's break mirror from eight sides (PixelLab rotations, 2026-11-09): mirror8_<way>, one picture a way it can face.
  ...Object.fromEntries(MIRROR_WAYS.map(way => [`mirror8_${way}`, `mirror-${way}`]))
}).map(([key, file]) => [key, `art/chapters/2-silent-factory/fx/${file}-${FACTORY_REDRAWN.has(file) ? 'v2' : 'v1'}.png`]));
/** Marks redrawn after a first try in the game (prompt 12); a new name so browsers never show the cached first one. */
const REDRAWN = new Set(['glyph-stomp', 'glyph-suction', 'mark-land-lightning', 'mark-land-fire']);
export const MARKS = Object.fromEntries(Object.entries({
  landLightning: 'mark-land-lightning', landIce: 'mark-land-ice', landFire: 'mark-land-fire',
  // Sound and water's landing marks and fusion rings (PixelLab, 2026-11-09), made to match the four above.
  landSound: 'mark-land-sound', landWater: 'mark-land-water', ringSound: 'ring-fusion-sound', ringWater: 'ring-fusion-water',
  gearRing: 'mark-gear-ring', spawn: 'mark-spawn-hatch', dial: 'mark-charge-dial',
  suction: 'glyph-suction', magnet: 'glyph-magnet', stomp: 'glyph-stomp', bell: 'glyph-bell', gap: 'glyph-gap',
  alert: 'glyph-alert', chevrons: 'glyph-chevrons', sticker: 'glyph-sticker',
  affixShield: 'affix-shield',
  ringFire: 'ring-fusion-fire', ringIce: 'ring-fusion-ice', ringLightning: 'ring-fusion-lightning', ringWind: 'ring-fusion-wind',
  sparkHit: 'spark-hit', sparkHurt: 'spark-hurt', dust: 'puff-dust', pelletEnemy: 'pellet-enemy', pelletFriendly: 'pellet-friendly',
}).map(([key, file]) => [key, `art/fx/marks/${file}-${REDRAWN.has(file) ? 'v2' : 'v1'}.png`]).concat(Object.entries(FACTORY_FX)));
/** Loot flies home as the coin and gear of the HUD (art/ui/icons/px). */
export const LOOT_ART = { coin: 'art/ui/icons/px/coin.png', gear: 'art/ui/icons/px/gear.png' };
/** A fallen body's parts (PixelLab, 32px each): cog, bolt, spring and a plate of its casing, in the order drawParts deals them. */
export const DEBRIS_ART = ['debris-gear', 'debris-bolt', 'debris-spring', 'debris-plate'].map(name => `art/fx/${name}-v1.png`);
/** Over a beaten boss: Roco's command circuit to pull out, Brass's wind-up key to turn (PixelLab, 48px). */
export const BOSS_UNWIND_ART = { collectorRoco: 'art/fx/boss-circuit-v1.png', captainBrass: 'art/fx/boss-windup-key-v1.png', inspectorIris: 'art/fx/boss-reject-stamp-v1.png', directorPress: 'art/fx/boss-pressure-valve-v1.png' };
/** What F2 does to a beaten boss: the prompt on the floor and the button on the sheet. */
export const UNWIND_VERBS = { collectorRoco: '명령 회로 뽑기', captainBrass: '태엽 감아 깨우기', inspectorIris: '불량 도장 떼기', directorPress: '압력 밸브 풀기' };
/** The freight lift at the way out of the last room of a factory floor (PixelLab, 2026-11-08): shut, half open, open. */
export const LIFT_ART = Object.fromEntries(['closed', 'half', 'open'].map(state => [state, `art/chapters/2-silent-factory/props/lift-${state}-v1.png`]));
export const FX_FILES = [...Object.values(FX).map(fx => fx.sheet), NOTE_ART, ...Object.values(MARKS), ...Object.values(LOOT_ART), ...DEBRIS_ART, ...Object.values(BOSS_UNWIND_ART), ...Object.values(LIFT_ART)];
/** The room hazards' painted sprites (src/engine/hazards.js places them; drawHazard adds their states). */
export const HAZARD_ART = {
  ...Object.fromEntries(Object.entries({ crate: 'crate', musicbox: 'musicbox', plate: 'plate', saw: 'saw', fenceAcross: 'fence-across', fenceUpright: 'fence-upright' }).map(([key, file]) => [key, `art/chapters/1-smile-street/hazards/${file}-v1.png`])),
  // Chapter 2's factory devices (PixelLab, 2026-11-07).
  // The long belt sunk into the floor (2026-11-08): two brass ends and a rubber piece repeated between them to any length.
  beltLeft: 'art/chapters/2-silent-factory/hazards/belt-left-v2.png', beltMid: 'art/chapters/2-silent-factory/hazards/belt-mid-v2.png', beltRight: 'art/chapters/2-silent-factory/hazards/belt-right-v2.png',
  ...Object.fromEntries(Object.entries({ beltAcross: 'belt-across', beltUpright: 'belt-upright', pressPlate: 'press-plate', pressHead: 'press-head', laserPost: 'laser-post', craneCrate: 'crane-crate', steamVent: 'steam-vent' }).map(([key, file]) => [key, `art/chapters/2-silent-factory/hazards/${file}-v1.png`]))
};
