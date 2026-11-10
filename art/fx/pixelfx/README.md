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
