// Effect sheets made with PixelLab's effect workbench (art/fx/<name>.png, with the exported .json beside it).
// w x h per frame, `cols` frames to a row, `anchor` = the effect's origin inside a frame (where it is placed).
export const FX = {
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
export const FX_FILES = [...Object.values(FX).map(fx => fx.sheet), NOTE_ART];
