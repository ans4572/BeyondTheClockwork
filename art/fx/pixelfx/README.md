# pixelfx effects

These effect sheets in `art/fx` come from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, see `LICENSE` here), rendered with its `tools/render.mjs --sheet` on 2026-11-09:

| sheet | from | how it was made |
|---|---|---|
| `crate-blast-v1.png` (+ `.json`) | `crate-blast.js` here, our own effect | Made from pixelfx's `explosions/small-explosion` for this game's top-down floor: the shock ring and scorch lie flat on the floor (0.55 squash), the debris is wood splinters thrown all round with their own height, and the smoke is lighter and short. Sized for the crate's 2.2-unit blast (44 px). 30 fps, 46 frames. The fire, sparks and embers recipe is Hugo Duprez's (Sprite Fusion, MIT), as the file's header says. |
| `mend-burst-v1.png` (+ `.json`) | pixelfx `pickups/collect-burst` | Recoloured to the music box mint: `--opts '{"palette":["#16302a","#22493d","#2f6b55","#4fa37f","#8fd8b0","#bdeed3","#e6fbef","#ffffff"]}'`. 30 fps, 42 frames. |

To render `crate-blast.js` again, copy it into a pixelfx checkout as `src/fx/explosions/crate-blast.js` and run `node tools/render.mjs explosions/crate-blast --sheet`.

Added the same day for the everyday fight (sources here, written for this game's top-down floor; render each from a pixelfx checkout with `src/fx/btc/<name>.js` in place):

| sheet | source | notes |
|---|---|---|
| `wrench-arc-v1.png`, `wrench-arc-heavy-v1.png` | `wrench-arc.js` | F2's swing round her body, facing right, 60 fps; heavy = `--opts '{"heavy":true,"radius":51,"sweep":0.185}'` |
| `wrench-hit-v1.png` | `wrench-hit.js` | pixelfx's hit spark with no ground line, so it can turn to any aim |
| `scrap-wood/brass/ice/oil-v1.png` | `scrap-burst.js` | one material each through `palette` (and `dust`), see `src/render/canvas.js` SCRAP_SHEETS |
| `plate-flare-v1.png` | `plate-flare.js` | a hot plate burning the feet |
| `steam-puff-v1.png` | `steam-puff.js` | water putting out a burning body (was a code-drawn shape) |

Chapter 3's mob attacks and 지연 방전 (2026-11-18; sources here, render from a pixelfx checkout with `src/fx/btc/<name>.js` in place, `node tools/render.mjs btc/<name> --sheet`):

| sheet | source | notes |
|---|---|---|
| `bell-shot-v1.png` | `bell-shot.js` | the bell turret's small bell rocking in flight, 0.5 s loop at 24 fps; `bellBody` is shared with bell-toll |
| `bell-toll-v1.png` | `bell-toll.js` | the bell landing and ringing: flash, gold ring with dial ticks (26 px reach), sound arcs, 0.75 s |
| `minute-arrow-v2.png` | `minute-arrow.js` | the minute archer's arrow: small brass arrow with a clock-hand spade tip, gold streak and dial ticks behind, 0.3 s loop, drawn 1:1 (v1, a blued-steel minute hand, was dropped the same day) |
| `signal-pulse-v1.png` | `signal-pulse.js` | the signal orb's haste signal: dashed cyan rings, light packets on six spokes (54 px reach), 0.85 s |
| `charge-clock-v1.png` | `charge-clock.js` | 지연 방전's stopwatch over the charged body; 31 frames for 0 to 3 s, the game picks the frame by the countdown |

Light and magnet (2026-11-21; docs/design/light-magnet-concepts.md). The drawing is all in `_lm.js`; each `lm-*.js` is one effect (its meta) that calls it. Render from a pixelfx checkout with `_lm.js` and `lm-*.js` copied into `src/fx/btc/`, `node tools/index.mjs`, then `node tools/render.mjs btc/<name> --sheet`, and copy `records/btc/<name>/<name>.png` to `art/fx/<name>-v1.png` (FX entries in `src/render/fx-sprites.js`, drawn by `src/render/light-magnet-draw.js`, which draws its code shapes while a sheet is missing):

| sheet | what |
|---|---|
| ~~`lm-flash-v1.png`~~ | 섬광탄 bursting — replaced by PixelLab `lm-flash-pl-v1.png` (2026-11-21), file removed |
| ~~`lm-slam-v1.png`~~ | 끌어올리기 slamming down — replaced by PixelLab `lm-slam-pl-v1.png` (2026-11-21), file removed |
| ~~`lm-pillar-v1.png`~~ | 한낮 표적's heat pillar — replaced by PixelLab `lm-noon-pillar-pl-v1.png` (2026-11-21), file removed |
| `lm-iron-set-v1.png` | 쇳가루 setting a body |
| (replaced) | 2026-11-21: 쇳물 공's burst, 한낮 표적's sun/pillar/burst, 북극광 고리's curtain and halo, 자성 유체 덩굴's spikes, 서리 프리즘's prism, the saw, the scrap pellet and the molten ball were all redrawn with PixelLab (`art/fx/lm-*-pl-v1.png`, `scripts/build-light-magnet-fx.py`); their pixelfx sheets were removed. Their sources stay here in `_lm.js`. |
| `lm-pluck-v1.png` | 울리는 쇠줄's pluck: brass sound arcs leaving the wire on both sides (one-shot 0.35 s, turned to the wire, 2026-11-21) |
| `lm-rain-v1.png` | 소나기 무지개's shower: rain streaks and splashes on an oval of floor (loop, 2026-11-21) |

Beams, the string, the constellation's lines and the rainbow are drawn in code (they stretch between moving bodies).
