# Grease & Gold: World Tour

A 16-bit-style side-scrolling beat 'em up for the browser. **This is a browser playtest build - not a ROM.**
Fighters: **Ricky B** (Turkish flag + pole), **V.V.** (vintage mic + cord), **Johnny $** (giant salami).

## Play
- **Browser:** open `play-v10.html` (single self-contained file; `index.html` is the landing page and links to it). `play-dev.html` loads `src/*.js` directly.
- **Godot:** open the `godot/` folder in Godot 4.3+ and run (`scenes/main.tscn`). Keyboard and gamepad. See `godot/README.md`.
- No server or install needed for the browser build.

## Controls
| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | Arrows / WASD | on-screen D-pad | left stick / D-pad |
| Attack (tap 3x = combo) | J or Z | ATK | X |
| Jump | K, X or Space | JMP | A |
| Special (**hold**) | L or C | SPC | B |
| Grab / Throw | U, V or I | GRB | Y |
| Pause / menus | Esc or P, Enter | II | Start |
| Mute / hitbox debug | M / F3 | | |

- Attack in the air = jump attack; **Down + Attack** in the air = dive.
- Stand next to an enemy and press Grab: Attack = grab strikes (3rd knocks down), Grab again (hold a direction to aim) = throw. Thrown enemies bowl into others.
- **HYPE**: a special starts with any HYPE left, drains continuously while held (~17/s), stops on release or at zero. HYPE only comes back from *ordinary* hits (combo hits, grab strikes, throws, air attacks) - never from special damage.
- Food heals (Adana, Shish, Doner, Lahmacun, Kunefe, Doner Spit). Break crates/barrels/bins for drops.

## Layout
```
src/sprites.js   procedural 16-bit sprite engine: rig, IK legs, poses, 12 kits, props, food, FX
src/game.js      combat, AI, grabs, specials, waves, props, pickups (fixed 60Hz)
src/ui.js        rendering, HUD, title, select, pause, game-over, stage-clear
src/stages.js    4 stages (waves, props) + parallax backdrops
src/input.js     keyboard + gamepad + touch with press buffer
src/audio.js     WebAudio 8-bit SFX
src/boot.js      browser loop, resize, touch handling
tools/           export_sprites.js, build.js, screenshot.js, preview.py
tests/run.js     70 headless checks (browser build)
godot/           Godot 4.3 project: same data tables + sprites, GDScript port, 45 engine-run checks
assets/sprites/  exported sheets (one animation per row) + JSON atlas, portraits, props, food, FX
docs/            audit of the existing repo + rendered proof images
```
Sprites: every frame is a fixed **112x112** cell, feet anchor **(56,100)**, 8 columns, one animation per row (see `assets/sprites/<kit>.json`).

## Commands
`npm i` then `node tools/export_sprites.js` (sprites), `node tools/build.js` (bundle), `node tests/run.js` (tests), `node tools/screenshot.js` (frames to shots/).

## Status
**Implemented and checked by automated headless tests (tests/run.js, 70/70 pass):** fixed frame canvas / no clipping; foot anchor on ground in grounded frames; constant torso length across all frames (no attack shrink); 8-frame distance-synced walk cycle (planted foot travels backward; reverse playback when moving against facing); 3-hit buffered combo; lane/direction/reach hit detection; brief hit-stop (<=9 ticks) that does not drain the input buffer; HYPE rules; grab/strike/throw/bowling; props + food drops + healing; crowd separation; telegraphed windups; lives/respawn; all 4 stages completable by a bot with 4 waves-and-boss flow and a camera that never passes the wave lock.
**Implemented, verified only by rendered screenshots (shots/, docs/):** art, HUD, menus, effects.
**NOT verified:** running in a real browser, 60fps on any device, touch controls on a real phone, audio, gamepad, feel/balance/difficulty. These need a human playtest.
**Godot port:** implemented; imports cleanly in Godot 4.3 headless; 45 engine-run logic checks pass with zero script errors (`godot/tests/run_tests.sh`); frames rendered through Godot's own renderer (software GL) match the browser build (`docs/proof/`). NOT verified: real-display performance, gamepad on hardware, audio output, touch (the Godot port has no on-screen touch controls), feel.
**Not done:** 2-player co-op; music track ("V.V. - Arcade Tune", not in either build); cartoon text impact words ("POW"); jump/landing dust on every landing is basic; enemy/boss sprites are simpler than the hero sprites.
