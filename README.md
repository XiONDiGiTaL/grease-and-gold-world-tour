# GREASE & GOLD: WORLD TOUR

16-bit-style side-scrolling beat 'em up starring Ricky B, Johnny $alami and V.V.

## Play the HTML build

Open `index.html` in any browser (or enable GitHub Pages) — build 2026-10-12f.

- Arrows/WASD move · Z attack · X special (30 HYPE) · Space jump · Enter confirm · Esc pause · 1/2/3 quick-select

## Open in Godot

This is a Godot 4.3+ project (port of the HTML 1.0 build). Open the folder in Godot and run `scenes/main.tscn`.

- `project.godot` — 480x270 pixel-perfect canvas, Nearest texture filter, input map
- `scripts/game.gd` — full game: states, combat, Genesis-style physics, waves, HUD
- `scripts/fighter.gd`, `scripts/foe.gd` — actor data
- `sprites/` — 20 cleaned fighter frames (2x) + night-street backdrop

By Player529 & XiON.
