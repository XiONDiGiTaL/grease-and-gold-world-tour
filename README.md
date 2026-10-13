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
tests/run.js     70 headless checks (source modules); tools/run_html.js = 12 checks on the REAL bundled page
godot/           Godot 4.3 project: same data tables + sprites, GDScript port, 45 engine-run checks
assets/sprites/  exported sheets (one animation per row) + JSON atlas, portraits, props, food, FX
docs/            audit of the existing repo + rendered proof images
```
Sprites: every frame is a fixed **144x144** cell, feet anchor **(72,128)**, 8 columns, one animation per row (see `assets/sprites/<kit>.json`).

## Commands
`npm i` then `node tools/export_sprites.js` (sprites), `node tools/build.js` (bundle), `node tests/run.js` (tests), `node tools/screenshot.js` (frames to shots/).

## Status
**Art pipeline (this version).** The characters are no longer drawn by code: `tools/cut_parts.py` slices the two supplied reference sprites (`assets/reference/ricky_b_reference.png`, `vv_reference.png`) into rig pieces (head, hair, torso, upper/lower arms, thighs, shins, feet, weapon), fills what the arms covered, and writes `src/rigart.js` with a per-pixel class map (skin / coat / fleece / shirt / pants / shoes / hair / shades / mustache). `src/rig.js` poses those pieces with 2-bone IK on their real bone lengths (so pieces rotate, never stretch), 2x-supersamples, posterises and outlines them. At rest the reassembled pieces match your reference pixel for pixel.
- **Ricky B and V.V.** are your reference sprites, animated (flag and mic are your art; the mic cord is drawn procedurally).
- **Johnny $** is built on the Ricky pieces (denim jacket, white tee, light jeans, white sneakers, brown skin, black shades, dark hair) with a procedural oversized salami. There was no pixel reference for him, so he is a recolour of Ricky's body, not new hand-drawn art.
- **Enemies and bosses** (Corporate Guard, Executive, Corporate Heavy, Street Scrapper, Ashfall Raider, The Ledger, Big Tony, The Auditor = Ricky pieces; Dusty Mara = V.V. pieces) are recolours with headgear/hair variants and, for the heavies, a width stretch - classic palette-swap enemies. They share silhouettes and animations.
- **Pickups** are cut directly from your food sheet (`tools/extract_food.py`, `make_food_assets.py`): Adana, Shish, Doner plate, Lahmacun, Kunefe, Doner spit with flag, plus the glow burst. They heal.
- **UI** uses the embedded Press Start 2P arcade font (SIL OFL; `assets/fonts/`) for every string: framed portrait thumbnails with lives, yellow-on-red health bar, HYPE bar, score, enemy and boss panels with thumbnails.
- **Backgrounds and props** are procedural pixel art redrawn with storefronts, lamps, poles, crosswalks, billboards and shaded breakables. They are still code-drawn, not hand-painted.
- **Grab / throw / chained combos:** Grab (U, or GRB on touch) then Attack = grab strikes, Grab again = throw into other enemies; tapping Attack chains a buffered three-hit combo.

**Verified by running code:**
- `node tests/run.js` - 70/70: fixed frame canvas / no clipping; planted feet on the ground anchor; constant torso length in every frame (no attack shrink); 8-frame walk synced to distance with a per-character stride; reverse playback when moving against facing; buffered 3-hit combo; lane/direction/reach hit detection; brief hit-stop that does not drain the input buffer; HYPE hold-drain rules; grab/strike/throw/bowling; props, drops, healing; crowd separation; telegraphed windups; lives/respawn; a bot clears all 4 stages.
- `node tools/run_html.js play-v10.html` - 12/12 **on the shipped bundle itself** (all scripts inlined, real keyboard events): boots to title, Enter opens select, Enter starts, walk, lane move, jump, attack damages, hold-L special, pause/resume, zero runtime errors. This is the check that would have caught the black-screen bug of the first v10 (the bundler's `String.replace` treated `$'` in the name `'Johnny $'` as a replacement pattern and corrupted `sprites.js`; fixed with a function replacer).
- Godot: `godot/tests/run_tests.sh` - 45/45 in Godot 4.3 headless, fails on any script error; frames rendered through Godot's renderer (software GL) in `docs/proof/g*.png`.

**Not verified:** a real browser or phone (jsdom + a canvas shim stand in for one), frame rate, touch controls on hardware, audio, gamepad hardware, game feel/balance, Godot on a real display.
**Known limits:** enemies are recolours of two body templates; rigid-piece animation has no real knee/elbow art, so crouches and big swings look stiffer than hand-drawn frames; sprites are assembled at start-up (~2 s on a desktop, slower on phones) and the decoded sheets are large (~55 MB); no 2-player co-op; no music track ("V.V. - Arcade Tune" is in neither build); Godot port has no on-screen touch controls; no cartoon impact words ("POW").
