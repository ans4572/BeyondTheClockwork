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
  // v2 (2026-11-16): the orange emitter at the palm end taken out (it read as a speaker on F2's body); the arcs as they were.
  // Belgard's props (pixelfx, 2026-11-17; sources in art/chapters/3-clock-tower/bosses/belgard/fx/src): the tuning pillar
  // quiet and ringing, the cage bell (one row per crack stage, 0 to 3, 24 frames each), the rain's small sword, Orden's
  // tuning needle. Loops, played at `fps`; drawn 1:1 in world pixels.
  bgPillar: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/tuning-pillar-v1.png', w: 56, h: 84, cols: 6, frames: 24, anchor: [28, 78], fps: 30 },
  bgPillarRing: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/tuning-pillar-ringing-v1.png', w: 56, h: 84, cols: 6, frames: 24, anchor: [28, 78], fps: 30 },
  bgBell: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/cage-bell-v1.png', w: 80, h: 72, cols: 24, frames: 96, anchor: [40, 64], fps: 20 },
  // Orden's strings on Belgard in phase 2 (pixelfx belfry/bg-strings, 2026-11-20): slack and taut.
  bgStringsSlack: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/strings-slack-v1.png', w: 96, h: 220, cols: 8, frames: 24, anchor: [48, 210], fps: 20 },
  bgStringsTaut: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/strings-taut-v1.png', w: 96, h: 220, cols: 8, frames: 24, anchor: [48, 210], fps: 20 },
  bgRainSword: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/rain-sword-v1.png', w: 24, h: 48, cols: 7, frames: 20, anchor: [12, 42], fps: 20 },
  bgNeedle: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/tuning-needle-v1.png', w: 56, h: 64, cols: 6, frames: 24, anchor: [28, 52], fps: 30 },
  // His blows (pixelfx, 2026-11-18; sources in the same src folder). The greatsword cut, facing right, a 120-degree arc of
  // 60 px radius (the renderer turns and fits it; the spin is the same cut round the whole circle), cream for him, cyan
  // for Orden's puppet; 0.36 s at 30 fps.
  bgSlash: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/slash-v1.png', w: 148, h: 148, cols: 4, frames: 12, anchor: [74, 74] },
  bgSlashCyan: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/slash-cyan-v1.png', w: 148, h: 148, cols: 4, frames: 12, anchor: [74, 74] },
  bgSpin: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/spin-v1.png', w: 148, h: 148, cols: 4, frames: 12, anchor: [74, 74] },
  bgSpinCyan: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/spin-cyan-v1.png', w: 148, h: 148, cols: 4, frames: 12, anchor: [74, 74] },
  // The front of the blade wave running along the floor (heading right, 18 px either side); a loop.
  bgWaveCrest: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/wave-crest-v1.png', w: 72, h: 56, cols: 3, frames: 9, fps: 30, anchor: [52, 28] },
  bgWaveCrestCyan: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/wave-crest-cyan-v1.png', w: 72, h: 56, cols: 3, frames: 9, fps: 30, anchor: [52, 28] },
  // Orden's phantom greatsword, point right; a loop. Planted for the last toll it is stood point down.
  bgPhantomSword: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/phantom-sword-v1.png', w: 88, h: 36, cols: 3, frames: 16, fps: 20, anchor: [44, 18] },
  // The blade striking the floor: flash, six cracks, a dust ring out to 30 px (a 1.5-unit slam); 0.75 s.
  bgSlam: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/slam-v1.png', w: 112, h: 104, cols: 5, frames: 24, anchor: [56, 56] },
  // A toll going out over the floor: a bronze ring with dial ticks out to 60 px, cyan for Orden's needles; 0.55 s.
  bgTollRing: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/toll-ring-v1.png', w: 136, h: 88, cols: 4, frames: 18, anchor: [68, 44] },
  // One burst of his cracks: the floor tearing open, a column of light, slabs thrown up, dust (0.8 s). Anchor = the floor.
  bgErupt: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/erupt-v1.png', w: 96, h: 104, cols: 6, frames: 25, anchor: [48, 80] },
  // His grab: a bronze gauntlet shooting out, fingers spread, snapping shut into a fist (0.36 s, reaching right).
  bgGauntlet: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/gauntlet-v1.png', w: 80, h: 56, cols: 3, frames: 12, anchor: [44, 28] },
  // Tick·Tock's blows (pixelfx, 2026-11-18; sources art/fx/pixelfx tt-*.js). A thrust: a white-hot line out to a 92 px
  // reach with a star at its tip, red for Tick, blue for Tock (0.34 s, pointing right). A clock face bursting on the
  // floor: flash, a dial ring with twelve ticks out to 30 px, shards and hands thrown up (0.7 s), red, blue or gold.
  // Tock's sweep: the greatsword cut's 180-degree version in blue (60 px radius, 0.36 s).
  ttStabRed: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/stab-red-v1.png', w: 124, h: 48, cols: 3, frames: 11, anchor: [12, 24] },
  ttStabBlue: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/stab-blue-v1.png', w: 124, h: 48, cols: 3, frames: 11, anchor: [12, 24] },
  ttBurstRed: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/burst-red-v1.png', w: 112, h: 104, cols: 5, frames: 22, anchor: [56, 60] },
  ttBurstBlue: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/burst-blue-v1.png', w: 112, h: 104, cols: 5, frames: 22, anchor: [56, 60] },
  ttBurstGold: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/burst-gold-v1.png', w: 112, h: 104, cols: 5, frames: 22, anchor: [56, 60] },
  ttSweepBlue: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/sweep-blue-v1.png', w: 148, h: 148, cols: 4, frames: 12, anchor: [74, 74] },
  // His blade biting into the floor (pixelfx bg-strike, 2026-11-19; it replaced code-drawn crack lines that read as pen
  // strokes on the floor): a flash, seven branching cracks with molten light cooling in them, chips, sparks, dust;
  // drawn for a 40 px reach, 1.2 s, the cracks still there at the end. Anchor = the floor where it bites.
  bgStrike: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/strike-v1.png', w: 128, h: 112, cols: 6, frames: 37, fps: 30, anchor: [64, 50] },
  bgStrikeCyan: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/strike-cyan-v1.png', w: 128, h: 112, cols: 6, frames: 37, fps: 30, anchor: [64, 50] },
  // One 32 px piece of a crack torn along the floor, running right (pixelfx bg-fissure): it tears open, glows and cools
  // to a seam (1 s; the last frame is held). Laid end to end along the slam wave's trail and the crack strike's lines.
  bgFissure: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/fissure-v1.png', w: 36, h: 18, cols: 4, frames: 31, fps: 30, anchor: [2, 10] },
  bgFissureCyan: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/fissure-cyan-v1.png', w: 36, h: 18, cols: 4, frames: 31, fps: 30, anchor: [2, 10] },
  // Lines that were drawn in code in the two bosses' patterns, redrawn with pixelfx (2026-11-19, the user's word: lines
  // drawn in code read as pen strokes on the floor; sources in each boss's fx/src). A small gem inlaid in the floor,
  // pulsing, in eight colours: set in rows along the outlines of warnings and safe zones (boss-grandeur.js gemPath).
  ...Object.fromEntries(['red', 'green', 'blue', 'tick', 'gold', 'white', 'cyan', 'bronze'].map(c => [`gem_${c}`, { sheet: `art/chapters/3-clock-tower/bosses/fx/gem-${c}-v1.png`, w: 13, h: 11, cols: 4, frames: 16, fps: 20, anchor: [6, 5] }])),
  // Belgard: a 32 px piece of the humming thread between ringing pillars (calm, and about to blow), of the line blowing
  // (0.3 s), the tuner's half dial (lit: the needle in tune; origin = the needle's pivot) and air streaking past his falling bell.
  bgHum: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/hum-v1.png', w: 36, h: 16, cols: 2, frames: 6, fps: 24, anchor: [2, 8] },
  bgHumHot: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/hum-hot-v1.png', w: 36, h: 16, cols: 2, frames: 6, fps: 24, anchor: [2, 8] },
  // The light circling the planted sword in the last toll (pixelfx belfry/od-mote, 2026-11-20).
  bgTollLight: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/mote-v1.png', w: 40, h: 40, cols: 5, frames: 24, anchor: [20, 20], fps: 20 },
  bgTuner: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/tuner-dial-v3.png', w: 64, h: 40, cols: 3, frames: 12, fps: 20, anchor: [32, 33] },
  bgTunerLit: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/tuner-dial-lit-v3.png', w: 64, h: 40, cols: 3, frames: 12, fps: 20, anchor: [32, 33] },
  bgFallStreaks: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/fall-streaks-v1.png', w: 72, h: 96, cols: 4, frames: 9, fps: 30, anchor: [36, 92] },
  // Tick·Tock: the echo clock face's hand (pointing right from its hub) and a 32 px piece of the giant metronome's rod.
  ttEchoHand: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/echo-hand-v1.png', w: 36, h: 12, cols: 1, frames: 1, anchor: [3, 6] },
  ttRod: { sheet: 'art/chapters/3-clock-tower/bosses/ticktock/fx/metronome-rod-v1.png', w: 36, h: 12, cols: 1, frames: 1, anchor: [3, 6] },
  // Orden's stopped-time needles as watch hands (2026-11-21, the user's word: the light bolts did not suit the marble): a
  // hair-thin Breguet hand in blued steel with a brass bead at its tail, pointing right, origin in the middle
  // (fx/src/od-hand.py; v2 the same day, the user's word: v1 at 44 x 14 was too big to read as a needle).
  odHand: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/hand-v2.png', w: 32, h: 9, cols: 1, frames: 1, anchor: [16, 4] },
  // Its shadow on the floor (2026-11-21): the hand's own silhouette, laid at its angle; it marks the line that hurts.
  odHandShadow: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/hand-shadow-v2.png', w: 32, h: 9, cols: 1, frames: 1, anchor: [16, 4] },
  // The grand tuner Orden's spell parts (pixelfx od-parts, 2026-11-19; source art/chapters/3-clock-tower/bosses/orden/fx/src):
  // a light needle (point right), a floor rune (22 px radius), a sound orb and a dark one, a clock heart (and split once),
  // the command sigil (stop, move) and a gold phantom soldier. Loops, 64 x 48, origin in the middle (a soldier's feet).
  ...Object.fromEntries(Object.entries({ odBolt: 'bolt', odRune: 'rune', odOrb: 'orb', odOrbDark: 'orb-dark', odHeart: 'heart', odHeartCracked: 'heart-cracked', odSigilStop: 'sigil-stop', odSigilMove: 'sigil-move', odSoldier: 'soldier' })
    .map(([key, file]) => [key, { sheet: `art/chapters/3-clock-tower/bosses/orden/fx/${file}-${file === 'bolt' ? 'v2' : 'v1'}.png`, w: 64, h: 48, cols: 4, frames: 20, fps: 20, anchor: [32, 24] }])),
  // (2026-11-20, the user's word: the needle in deeper colours, bolt-v2 = od-parts deep; the rune wider and grander,
  // od-rune2: 80 x 64, radius 30 px.)
  // The element spells (pixelfx od-elements, 2026-11-20): the ice mirror (and cracked), the lightning rod, a length of
  // bolt laid along a line, the flat whirlwind. 112 x 80, origin [56, 60].
  ...Object.fromEntries(Object.entries({ odMirror: 'ice-mirror', odMirrorCracked: 'ice-mirror-cracked', odRod: 'rod', odZap: 'zap', odVortex: 'vortex' })
    .map(([key, file]) => [key, { sheet: `art/chapters/3-clock-tower/bosses/orden/fx/${file}-v1.png`, w: 112, h: 80, cols: 4, frames: 20, fps: 20, anchor: [56, 60] }])),
  // The last hour's falling floor for the summit's marble (pixelfx belfry/od-pit, 2026-11-21: the old hole showed the sky
  // through the top of the tower): a piece cracking with cyan light under it, and the pit into the dark clockwork.
  // Orden's golden press plate: a gold slab with a dial engraved on it (pixelfx belfry/od-plate, 2026-11-21).
  odPlate: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/plate-v1.png', w: 64, h: 56, cols: 4, frames: 16, fps: 20, anchor: [32, 40] },
  odPitCrack: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/pit-crack-v1.png', w: 64, h: 44, cols: 4, frames: 16, fps: 20, anchor: [32, 22] },
  odPit: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/pit-v1.png', w: 64, h: 44, cols: 4, frames: 16, fps: 20, anchor: [32, 22] },
  odRune2: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/rune-v2.png', w: 80, h: 64, cols: 4, frames: 20, fps: 20, anchor: [40, 34] },
  // Orden's power, made for a final boss (pixelfx od-cast-circle, od-burst, od-aura, 2026-11-20, the user's word): the clock
  // circle under him while he casts, a spell landing (a column of light, a ring over the floor, shards), the halo round him.
  odCastCircle: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/cast-circle-v3.png', w: 192, h: 142, cols: 5, frames: 24, anchor: [96, 96], fps: 20 },
  odCastCircleGold: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/cast-circle-gold-v3.png', w: 192, h: 142, cols: 5, frames: 24, anchor: [96, 96], fps: 20 },
  odBurstCyan: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/burst-cyan-v1.png', w: 128, h: 176, cols: 6, frames: 25, anchor: [64, 140], fps: 30 },
  odBurstGold: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/burst-gold-v1.png', w: 128, h: 176, cols: 6, frames: 25, anchor: [64, 140], fps: 30 },
  odBurstViolet: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/burst-violet-v1.png', w: 128, h: 176, cols: 6, frames: 25, anchor: [64, 140], fps: 30 },
  // The element spells landing (od-burst tones 3 to 6, 2026-11-20, the user's word: a final boss's, flashy).
  ...Object.fromEntries(['fire', 'ice', 'volt', 'wind'].map(e => [`odBurst_${e}`, { sheet: `art/chapters/3-clock-tower/bosses/orden/fx/burst-${e}-v1.png`, w: 128, h: 176, cols: 6, frames: 25, anchor: [64, 140], fps: 30 }])),
  odFireball: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/fireball-v1.png', w: 112, h: 80, cols: 4, frames: 20, anchor: [56, 60], fps: 20 },
  odAura: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/aura-v3.png', w: 140, h: 220, cols: 8, frames: 32, anchor: [70, 196], fps: 20 },
  odAuraGold: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/aura-gold-v3.png', w: 140, h: 220, cols: 8, frames: 32, anchor: [70, 196], fps: 20 },
  // Orden's element lanes (pixelfx od-lane-blow / od-lane-charge, 2026-11-19, the user's word: the lanes looked weak for a
  // final boss): a piece of a lane blowing (fire column, ice blades, forked bolt, gale; 1.1 s), a piece gathering before
  // it blows (and the safe lane's green motes) and what fire and ice leave behind (loops). Laid over the lanes in a grid.
  ...Object.fromEntries(['fire', 'ice', 'lightning', 'wind'].map(e => [`odLaneBlow_${e}`, { sheet: `art/chapters/3-clock-tower/bosses/orden/fx/lane-${e}-blow-${e === 'wind' ? 'v4' : 'v2'}.png`, w: 96, h: 128, cols: 7, frames: 34, fps: 30, anchor: [48, 100] }])),
  ...Object.fromEntries(['fire', 'ice', 'lightning', 'wind', 'safe'].map(e => [`odLaneCharge_${e}`, { sheet: `art/chapters/3-clock-tower/bosses/orden/fx/lane-${e}-charge-v2.png`, w: 80, h: 72, cols: 4, frames: 16, fps: 20, anchor: [40, 50] }])),
  odLaneLinger_fire: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/lane-fire-linger-v2.png', w: 80, h: 72, cols: 4, frames: 16, fps: 20, anchor: [40, 50] },
  // The ice lane's frozen floor redrawn (pixelfx od-frost, 2026-11-20, the user's word: the flat blue discs looked wrong).
  odLaneLinger_ice: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/lane-ice-linger-v3.png', w: 80, h: 72, cols: 5, frames: 20, fps: 20, anchor: [40, 50] },
  // The stopped time's pocket watches (pixelfx od-elements part 5, 2026-11-20: they were clock hearts).
  // (v2, 2026-11-21, the user's word: the cartoon watch did not suit the map, and a little smaller: a brass hunter in the
  // tower's plum outline with blued hands like his needles, its second hand ticking, fx/src/od-watch.py; its shadow apart.)
  odWatch: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/watch-v2.png', w: 36, h: 40, cols: 5, frames: 20, fps: 5, anchor: [18, 38] },
  odWatchCracked: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/watch-cracked-v2.png', w: 36, h: 40, cols: 5, frames: 20, fps: 5, anchor: [18, 38] },
  odWatchShadow: { sheet: 'art/chapters/3-clock-tower/bosses/orden/fx/watch-shadow-v2.png', w: 20, h: 7, cols: 1, frames: 1, anchor: [10, 3] },
  // The fence's wall of light, the aim arrows, the falling floor's cracks and holes, the cannon's surge, the real one's eye.
  ...Object.fromEntries(Object.entries({ odBarrier: 'barrier', odArrow: 'arrow', odCrack: 'crack', odHole: 'hole', odSurge: 'surge', odGlint: 'glint' })
    .map(([key, file]) => [key, { sheet: `art/chapters/3-clock-tower/bosses/orden/fx/${file}-v1.png`, w: 56, h: 56, cols: 4, frames: 16, fps: 20, anchor: [28, 40] }])),
  bgTollRingCyan: { sheet: 'art/chapters/3-clock-tower/bosses/belgard/fx/toll-ring-cyan-v1.png', w: 136, h: 88, cols: 4, frames: 18, anchor: [68, 44] },
  ringPalm: { sheet: 'art/fx/ring-palm-v2.png', w: 128, h: 128, cols: 4, frames: 9, anchor: [13, 63] },
  roarBeam: { sheet: 'art/fx/roar-beam-v1.png', w: 256, h: 128, cols: 4, frames: 9, anchor: [27, 61] },
  waterShot: { sheet: 'art/fx/water-shot-v1.png', w: 128, h: 128, cols: 4, frames: 8, anchor: [59, 63] },
  // 메아리 돌풍's wave front seen from above, laid on the floor (PixelLab, 2026-11-16; it replaced an upright ring that read
  // as a flat cut-out once the reach was laid on the floor). The anchor is the front arc's middle.
  echoWave: { sheet: 'art/fx/echo-wave-v1.png', w: 128, h: 128, cols: 1, frames: 1, anchor: [90, 63] },
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
  // Light and magnet (pixelfx, art/fx/pixelfx/lm-*.js drawn in _lm.js, 2026-11-21; src/render/light-magnet-draw.js).
  lmPillar: { sheet: 'art/fx/lm-noon-pillar-pl-v1.png', w: 40, h: 94, cols: 1, frames: 1, fps: 1, anchor: [20, 91] },
  lmSunBurst: { sheet: 'art/fx/lm-noon-burst-pl-v1.png', w: 128, h: 128, cols: 4, frames: 13, fps: 26, anchor: [64, 64] },
  lmIronSet: { sheet: 'art/fx/lm-iron-set-v1.png', w: 64, h: 56, cols: 4, frames: 16, fps: 30, anchor: [32, 40] },
  lmSun: { sheet: 'art/fx/lm-noon-sun-pl-v1.png', w: 30, h: 28, cols: 4, frames: 8, fps: 16, anchor: [15, 14] },
  // 북극광 고리's halo over F2 (pixelfx, 2026-11-21, art/fx/pixelfx/lm-halo.js): a tilted ring with an aurora crown.
  // 울리는 쇠줄's pluck (pixelfx, 2026-11-21, art/fx/pixelfx/lm-pluck.js): brass sound arcs leaving the wire.
  lmPluck: { sheet: 'art/fx/lm-pluck-v1.png', w: 48, h: 48, cols: 4, frames: 12, fps: 30, anchor: [24, 24] },
  // 소나기 무지개's shower (pixelfx, 2026-11-21, art/fx/pixelfx/lm-rain.js): streaks and splashes on a 36 px oval.
  lmRain: { sheet: 'art/fx/lm-rain-v1.png', w: 80, h: 76, cols: 4, frames: 16, fps: 20, anchor: [40, 56] },
  // PixelLab redraws picked on the status page (2026-11-21, scripts/build-light-magnet-fx.py): beams, the wire and the dash
  // band are strips stretched along their line from the left end (`ends` keep their size); the rest are sprites.
  lmBeamLight: { sheet: 'art/fx/lm-beam-light-pl-v1.png', w: 128, h: 32, cols: 4, frames: 4, fps: 12, anchor: [0, 15], ends: [8, 8] },
  lmBeamRefract: { sheet: 'art/fx/lm-beam-refract-pl-v1.png', w: 128, h: 32, cols: 4, frames: 8, fps: 14, anchor: [0, 15], ends: [8, 8] },
  lmRailBeam: { sheet: 'art/fx/lm-rail-beam-pl-v1.png', w: 128, h: 32, cols: 4, frames: 8, fps: 16, anchor: [0, 15], ends: [8, 8] },
  lmDashBand: { sheet: 'art/fx/lm-dash-band-pl-v1.png', w: 128, h: 32, cols: 4, frames: 5, fps: 10, anchor: [0, 15], ends: [8, 8] },
  lmFlashBurst: { sheet: 'art/fx/lm-flash-pl-v1.png', w: 128, h: 128, cols: 4, frames: 13, fps: 26, anchor: [64, 64] },
  lmSlam: { sheet: 'art/fx/lm-slam-pl-v1.png', w: 128, h: 128, cols: 4, frames: 7, fps: 18, anchor: [63, 88] },
  lmLiftHeap: { sheet: 'art/fx/lm-lift-heap-pl-v1.png', w: 86, h: 58, cols: 4, frames: 8, fps: 8, anchor: [43, 29] },
  lmCoil: { sheet: 'art/fx/lm-coil-pl-v1.png', w: 56, h: 33, cols: 4, frames: 8, fps: 14, anchor: [1, 17] },
  lmStar: { sheet: 'art/fx/lm-star-pl-v1.png', w: 31, h: 32, cols: 4, frames: 8, fps: 10, anchor: [15, 16] },
  lmCan: { sheet: 'art/fx/lm-can-pl-v1.png', w: 16, h: 24, cols: 2, frames: 2, fps: 1, anchor: [8, 12] },
  lmScrap: { sheet: 'art/fx/lm-scrap-pl-v1.png', w: 22, h: 12, cols: 1, frames: 1, fps: 1, anchor: [11, 6] },
  // 대구경's slug (2026-11-22, PixelLab at its own size: the pellet scaled up twice read blocky).
  lmSlug: { sheet: 'art/fx/lm-slug-pl-v1.png', w: 43, h: 20, cols: 1, frames: 1, fps: 1, anchor: [21, 10] },
  lmIceShard: { sheet: 'art/fx/lm-ice-shard-pl-v1.png', w: 22, h: 15, cols: 1, frames: 1, fps: 1, anchor: [11, 7] },
  lmSaw: { sheet: 'art/fx/lm-saw-pl-v1.png', w: 42, h: 45, cols: 1, frames: 1, fps: 1, anchor: [21, 22] },
  lmClamp: { sheet: 'art/fx/lm-clamp-pl-v1.png', w: 28, h: 23, cols: 1, frames: 1, fps: 1, anchor: [14, 11] },
  lmPrism: { sheet: 'art/fx/lm-ice-prism-pl-v1.png', w: 19, h: 33, cols: 1, frames: 1, fps: 1, anchor: [9, 30] },
  lmIceBeam: { sheet: 'art/fx/lm-ice-beam-pl-v1.png', w: 128, h: 32, cols: 1, frames: 1, fps: 1, anchor: [0, 16], ends: [8, 8] },
  lmSpikes: { sheet: 'art/fx/lm-ferro-spikes-pl-v1.png', w: 51, h: 47, cols: 4, frames: 8, fps: 32, anchor: [25, 44] },
  lmFerroTrail: { sheet: 'art/fx/lm-ferro-trail-pl-v1.png', w: 128, h: 32, cols: 1, frames: 1, fps: 1, anchor: [0, 15], ends: [8, 8] },
  lmFerroPool: { sheet: 'art/fx/lm-ferro-pool-pl-v1.png', w: 40, h: 19, cols: 1, frames: 1, fps: 1, anchor: [20, 9] },
  lmHalo: { sheet: 'art/fx/lm-aurora-halo-pl-v1.png', w: 41, h: 43, cols: 4, frames: 8, fps: 12, anchor: [20, 21] },
  lmCurtain: { sheet: 'art/fx/lm-aurora-curtain-pl-v1.png', w: 46, h: 99, cols: 4, frames: 9, fps: 18, anchor: [23, 96] },
  lmMoltenBurst: { sheet: 'art/fx/lm-molten-burst-pl-v1.png', w: 128, h: 128, cols: 4, frames: 13, fps: 26, anchor: [64, 64] },
  lmBall: { sheet: 'art/fx/lm-ball-pl-v1.png', w: 31, h: 36, cols: 4, frames: 8, fps: 14, anchor: [15, 18] },
  lmPost: { sheet: 'art/fx/lm-post-pl-v1.png', w: 20, h: 38, cols: 1, frames: 1, fps: 1, anchor: [10, 35] },
  lmCable: { sheet: 'art/fx/lm-cable-pl-v1.png', w: 128, h: 32, cols: 1, frames: 1, fps: 1, anchor: [0, 15], ends: [8, 8] },
  lmCloud: { sheet: 'art/fx/lm-cloud-pl-v1.png', w: 49, h: 47, cols: 4, frames: 8, fps: 8, anchor: [24, 23] },
  lmArch: { sheet: 'art/fx/lm-arch-pl-v1.png', w: 77, h: 37, cols: 1, frames: 1, fps: 1, anchor: [38, 34] },
  // A heavy blow's shockwave along the floor (mob swings, stomps, rows pressed; 21 places use look 'quake'): a short flat flash,
  // two hollow rings racing out and dust rolling low; no disc (the old one read as a paper plate). 0.6 s at 30 fps, drawn for a
  // 32 px reach; the renderer fits it to the blow's reach and plays it over the effect's own duration. Anchor = the floor.
  floorShock: { sheet: 'art/fx/floor-shock-v2.png', w: 96, h: 72, cols: 4, frames: 19, anchor: [48, 36] },
  // The yellow portal marker (2026-11-11): a gold ring inlaid in the floor like the maps' brass trims (dark outline, twelve
  // dial ticks, a warm see-through floor inside), breathing, motes rising, a slim arrow bobbing over it. A 1.6 s loop.
  portalMarker: { sheet: 'art/fx/portal-marker-v4.png', w: 56, h: 58, cols: 6, frames: 32, fps: 20, anchor: [28, 46] },
  // Chapter 3's mob attacks (pixelfx, 2026-11-18; sources art/fx/pixelfx). The bell turret's small brass bell rocking as
  // it flies (a 0.5 s loop) and landing: a flat flash, a gold ring with dial ticks out to a 26 px (1.3-unit) reach, sound
  // arcs as it rocks to a stop (0.75 s). Anchor = the bell's middle / the floor where it lands.
  bellShot: { sheet: 'art/fx/bell-shot-v1.png', w: 40, h: 36, cols: 4, frames: 12, fps: 24, anchor: [20, 20] },
  bellToll: { sheet: 'art/fx/bell-toll-v1.png', w: 96, h: 84, cols: 5, frames: 24, anchor: [48, 46] },
  // The minute archer's arrow: the small brass arrow of its own clip with a clock-hand spade tip, a gold streak and dial
  // ticks left behind, facing right (a 0.3 s loop; v2 2026-11-18, the blued-steel minute hand of v1 did not match the
  // archer's gold arrow). Drawn 1:1. Anchor = the arrow's middle.
  minuteArrow: { sheet: 'art/fx/minute-arrow-v2.png', w: 56, h: 16, cols: 2, frames: 7, fps: 24, anchor: [36, 8] },
  // The signal orb's haste signal: three dashed cyan rings and light packets along the floor, drawn for a 54 px reach (0.85 s).
  signalPulse: { sheet: 'art/fx/signal-pulse-v1.png', w: 128, h: 84, cols: 5, frames: 27, anchor: [64, 42] },
  // 지연 방전: a brass stopwatch over the charged body; frame = how much of the delay has passed (31 frames, 0 to 3 s).
  chargeClock: { sheet: 'art/fx/charge-clock-v1.png', w: 48, h: 50, cols: 6, frames: 31, anchor: [24, 28] },
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
/**
 * Tick·Tock's pattern art (PixelLab Pro Flash, 2026-11-15; raw pictures in art/chapters/3-clock-tower/bosses/ticktock/fx/src):
 * the gear they throw, the giant metronome's weight and pivot, the echo's clock face on the floor, Tock's sweep (its half
 * dial on the floor, the arrows where its gears will fly, the minute hand's slash) and the shuffle's bomb key (Brass's
 * wind-up key, reused). The beat ring under the twin on the beat is mark-gear-ring tinted. Drawn through drawMark; clock-boss-draw.js keeps its code shapes as the fallback.
 */
export const CLOCK_FX = {
  ...Object.fromEntries(Object.entries({ ttGear: 'gear-shot', ttWeight: 'metronome-weight', ttPivot: 'metronome-pivot', ttEchoDial: 'echo-dial', ttGearPath: 'gear-path', ttSweepDial: 'sweep-dial', ttSweepSlash: 'sweep-slash', ttPincerPost: 'pincer-post', ttPincerGate: 'pincer-gate' })
    .map(([key, file]) => [key, `art/chapters/3-clock-tower/bosses/ticktock/fx/${file}-${key === 'ttEchoDial' ? 'v2' : 'v1'}.png`])),
  ttKey: 'art/fx/boss-windup-key-v1.png',
};
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
}).map(([key, file]) => [key, `art/fx/marks/${file}-${REDRAWN.has(file) ? 'v2' : 'v1'}.png`]).concat(Object.entries(FACTORY_FX), Object.entries(CLOCK_FX)));
/** Loot flies home as the coin and gear of the HUD (art/ui/icons/px). */
export const LOOT_ART = { coin: 'art/ui/icons/px/coin.png', gear: 'art/ui/icons/px/gear.png' };
/** A fallen body's parts (PixelLab, 32px each): cog, bolt, spring and a plate of its casing, in the order drawParts deals them. */
export const DEBRIS_ART = ['debris-gear', 'debris-bolt', 'debris-spring', 'debris-plate'].map(name => `art/fx/${name}-v1.png`);
/**
 * Over a beaten boss: Roco's command circuit to pull out, Brass's wind-up key to turn (PixelLab, 48px). Chapter 3's two
 * drawn in code to match their verbs (2026-11-21, the chapter 3 review: they borrowed Brass's key and Roco's circuit):
 * Tick and Tock's metronome with its weight, Orden's tuning needle from Belgard's helmet (art/fx/boss-unwind-props-ch3.py).
 */
export const BOSS_UNWIND_ART = { collectorRoco: 'art/fx/boss-circuit-v1.png', captainBrass: 'art/fx/boss-windup-key-v1.png', twinTickTock: 'art/fx/boss-metronome-weight-v1.png', bellguard: 'art/fx/boss-tuning-needle-v1.png', inspectorIris: 'art/fx/boss-reject-stamp-v1.png', directorPress: 'art/fx/boss-pressure-valve-v1.png' };
/** What F2 does to a beaten boss: the prompt on the floor and the button on the sheet. */
export const UNWIND_VERBS = { collectorRoco: '명령 회로 뽑기', captainBrass: '태엽 감아 깨우기', inspectorIris: '불량 도장 떼기', directorPress: '압력 밸브 풀기', twinTickTock: '메트로놈 추 풀기', bellguard: '조율 바늘 뽑기' };
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
