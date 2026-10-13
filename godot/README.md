# Grease & Gold: World Tour - Godot 4.3 port
Open this folder in Godot 4.3+ and press Run (main scene `scenes/main.tscn`). Viewport 384x216, integer-scaled, nearest filtering, 60 physics ticks.

**Controls** - Move: arrows/WASD or D-pad/left stick. Attack: J/Z or X. Jump: K/X/Space or A. Special (hold): L/C or B. Grab/Throw: U/V/I or Y. Pause: Esc/P or Start. Mute: M.

**How it is built** - `scripts/game.gd` is a line-for-line port of the browser build's logic (`src/game.js`); `scripts/render.gd` draws it. All numbers (characters, moves, enemies, stages, animation timing, sprite atlases) are read from `data/game_data.json`, exported from the JS source by `tools/export_godot_data.js`, so the two builds cannot drift. Sprites/backdrops/FX in `assets/` are the same PNGs as the browser build. SFX are synthesised at start-up (no audio files).

**Tests** - `GODOT=/path/to/godot sh tests/run_tests.sh` imports assets, runs `tests/test.gd` in the engine, and fails on any assertion failure *or* any SCRIPT ERROR. `tests/shots.gd` renders frames (needs a GL context, e.g. `xvfb-run -a godot --path . --rendering-driver opengl3 --script res://tests/shots.gd`).

**Not in the Godot port** - on-screen touch controls; the browser build's F3 hitbox overlay. Rendered playtesting on a real display/gamepad is still required.
