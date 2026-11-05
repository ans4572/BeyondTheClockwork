// Effect sheets made with PixelLab's effect workbench (art/fx/<name>.png, with the exported .json beside it).
// w x h per frame, `cols` frames to a row, `anchor` = the effect's origin inside a frame (where it is placed).
export const FX = {
  drumBeat: { sheet: 'art/fx/drum-beat.png', w: 128, h: 80, cols: 4, frames: 12, anchor: [64, 48] },
  drumBuff: { sheet: 'art/fx/drum-buff.png', w: 56, h: 72, cols: 4, frames: 12, anchor: [28, 60] },
  rocoSticker: { sheet: 'art/fx/roco-sticker.png', w: 60, h: 70, cols: 4, frames: 12, anchor: [30, 57] },
  rocoCan: { sheet: 'art/fx/roco-can.png', w: 16, h: 18, cols: 2, frames: 4, anchor: [8, 9] },
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
  groundFire: { sheet: 'art/fx/ground-fire.png', w: 35, h: 27, cols: 3, frames: 8, anchor: [18, 18] },
  groundShockwave: { sheet: 'art/fx/ground-shockwave.png', w: 94, h: 40, cols: 4, frames: 10, anchor: [47, 20] },
  guardThrust: { sheet: 'art/fx/guard-thrust.png', w: 42, h: 20, cols: 3, frames: 7, anchor: [4, 10] },
  hasteArrows: { sheet: 'art/fx/haste-arrows.png', w: 38, h: 43, cols: 4, frames: 12, anchor: [18, 31] },
  heatSwing: { sheet: 'art/fx/heat-swing.png', w: 55, h: 51, cols: 4, frames: 12, anchor: [27, 24] },
  marchStomp: { sheet: 'art/fx/march-stomp.png', w: 40, h: 34, cols: 4, frames: 10, anchor: [19, 19] },
  pressureDash: { sheet: 'art/fx/pressure-dash.png', w: 76, h: 37, cols: 4, frames: 12, anchor: [43, 17] },
  ratExplosion: { sheet: 'art/fx/rat-explosion.png', w: 43, h: 45, cols: 4, frames: 12, anchor: [22, 27] },
  readyPop: { sheet: 'art/fx/ready-pop.png', w: 24, h: 27, cols: 4, frames: 10, anchor: [11, 17] },
  trumpetWave: { sheet: 'art/fx/trumpet-wave.png', w: 88, h: 46, cols: 4, frames: 14, anchor: [6, 23] },
};
/** A note drawn for enemy shots (hand-made pixels, 24 x 28). */
export const NOTE_ART = 'art/fx/note.png';
/**
 * Still pictures the renderer moves itself (turns, pulses, tints): floor marks seen from above, warning glyphs, sparks
 * and shots. Prompts: art/fx/marks/9-floor-marks, 10-tell-glyphs, 11-particles (.prompt.txt). Until a file exists the
 * plain code shape it replaces is drawn instead.
 */
/** Marks redrawn after a first try in the game (prompt 12); a new name so browsers never show the cached first one. */
const REDRAWN = new Set(['glyph-stomp', 'glyph-suction', 'mark-land-lightning', 'mark-land-fire']);
export const MARKS = Object.fromEntries(Object.entries({
  landLightning: 'mark-land-lightning', landIce: 'mark-land-ice', landFire: 'mark-land-fire', danger: 'mark-danger',
  gearRing: 'mark-gear-ring', spawn: 'mark-spawn-hatch', dial: 'mark-charge-dial', dangerPaint: 'tile-danger-paint',
  suction: 'glyph-suction', magnet: 'glyph-magnet', stomp: 'glyph-stomp', bell: 'glyph-bell', gap: 'glyph-gap',
  alert: 'glyph-alert', chevrons: 'glyph-chevrons', sticker: 'glyph-sticker',
  affixShield: 'affix-shield',
  sparkHit: 'spark-hit', sparkHurt: 'spark-hurt', dust: 'puff-dust', pelletEnemy: 'pellet-enemy', pelletFriendly: 'pellet-friendly',
}).map(([key, file]) => [key, `art/fx/marks/${file}-${REDRAWN.has(file) ? 'v2' : 'v1'}.png`]));
/** Loot flies home as the coin and gear of the HUD (art/ui/icons/px). */
export const LOOT_ART = { coin: 'art/ui/icons/px/coin.png', gear: 'art/ui/icons/px/gear.png' };
export const FX_FILES = [...Object.values(FX).map(fx => fx.sheet), NOTE_ART, ...Object.values(MARKS), ...Object.values(LOOT_ART)];
