# Grease & Gold: World Tour

A 16-bit-style side-scrolling beat 'em up for the browser. **This is a browser playtest build - not a ROM.**
Fighters: **Ricky B** (Turkish flag + pole), **V.V.** (vintage mic + cord), **Johnny $** (giant salami).

## Play
- **Browser:** open `play-v10.html` (single self-contained file; `index.html` is the landing page and links to it). `play-dev.html` loads `src/*.js` directly.
- **Godot:** open the `godot/` folder in Godot 4.3+ and run (`scenes/main.tscn`). Keyboard and gamepad. See `godot/README.md`.
- No server or install needed for the browser build.

## Music
`V.V. - Arcade Tune (BOMO)` plays on the select screen and stages 1, 2 and 4; `Ricky Bendova - I Don't Kneel (YM2612)` plays on stage 3 (Ashfall Pass). Set `music: 'arcade' | 'kneel'` per stage in `src/stages.js`. Both are re-encoded to 80 kbps (`assets/music/`, `tools/make_music.js`) and embedded in `play-v10.html`; the Godot port loads the same MP3s. Browsers only start audio after a key press or tap; `M` mutes.

## Controls
| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | Arrows / WASD | on-screen D-pad | left stick / D-pad |
| Attack (tap 3x = combo) | J or Z | ATK | X |
| Jump | K, X or Space | JMP | A |
| Special (**hold**) | L or C | SPC | B |
| Grab / Throw | U, V or I | GRB | Y |
| Pause / menus | Esc or P, Enter | II | Start |
| Mute (SFX + music) / hitbox debug | M / F3 | | |

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
godot/           Godot 4.3 project: same data tables + sprites, GDScript port, 47 engine-run checks
assets/sprites/  exported sheets (one animation per row) + JSON atlas, portraits, props, food, FX
docs/            audit of the existing repo + rendered proof images
```
Sprites are rendered at a 2.5x world scale (960x540 canvas; game logic still runs in 384x216 units). Each kit is a trimmed-frame atlas (`assets/sprites/<kit>.png` + `.json`: per-frame x, y, w, h and offset from the feet anchor); `<kit>_rows.png` is an artist sheet (one animation per row, 360x360 cells, anchor 180,320).

## Commands
`npm i` then `node tools/export_sprites.js` (sprites), `node tools/build.js` (bundle), `node tests/run.js` (tests), `node tools/screenshot.js` (frames to shots/).

## Status
**Art pipeline (this version).** The characters are no longer drawn by code: `tools/cut_parts.py` slices the two supplied reference sprites (`assets/reference/ricky_b_reference.png`, `vv_reference.png`) into rig pieces (head, hair, torso, upper/lower arms, thighs, shins, feet, weapon), fills what the arms covered, and writes `src/rigart.js` with a per-pixel class map (skin / coat / fleece / shirt / pants / shoes / hair / shades / mustache). `src/rig.js` poses those pieces with 2-bone IK on their real bone lengths (so pieces rotate, never stretch), 2x-supersamples, posterises and outlines them. At rest the reassembled pieces match your reference pixel for pixel.
- **Ricky B and V.V.** are your reference sprites, animated (flag and mic are your art; the mic cord is drawn procedurally).
- **Johnny $** is cut from his own reference (`assets/reference/johnny_reference.png`, cleaned and sharpened by `tools/prep_johnny.py`, rigged by `tools/cut_parts.py`): distressed denim jacket, white tee, torn jeans, white sneakers, watch, beard and shades, and the oversized salami held in both hands (the near hand follows the weapon). The chain medallion is repainted from "DOC" to **G&G**. His reference is a frontal view, so the part of the jacket hidden behind the salami is filled with denim sampled from his sleeve.
- **Enemies** are the frames of your enemy sheet (`assets/reference/enemy_sheet_reference.png`, cut by `tools/enemy_mask.py` + `tools/extract_enemies.py`): **Jooce** (`guard`, the juice-box enemy), **Street Hobo** (`brawler`), **Turd** (`raider`, the poop-hat enemy) and **Overweight Businessman** (`heavy`), with their real walk, attack and knockdown frames normalised to a common scale and ground line. The sheet only had upper-body portraits for several hit reactions, so those use a recoil lean of the full-body sprite. Variants are palette recolours of the same frames: **OJ Jooce** (orange box, navy suit), and the bosses **The Ledger** (green suit), **Big Tony** (burgundy, bigger) and **The Auditor** (black and gold). **Dusty Mara** is a recolour of V.V.'s pieces.
- **No baked arms:** the torso pieces used to keep a copy of the hanging arm (V.V. and Ricky) so attack frames showed a duplicate arm; arms are now fully separate pieces and the garment behind them is rebuilt by diffusion inpainting (denim-only sources for Johnny, outlines excluded). Johnny's far arm is a real skinned sleeve with a separate hand, and weapons swung backward are drawn behind the body.
- **Idle = your sprite.** Ricky's, V.V.'s and Johnny's idle frames are their reference pieces assembled exactly as drawn (identity transforms, tiny weapon/hair sway), so standing characters match the supplied art. Walks and attacks are measured from that rest stance (rest joints, hip height and hand positions are derived from the reference), the raised arm's elbow bends down-and-forward as drawn, and the mic is at the art's natural size.
- **Likeness (group photo):** V.V.'s hair is lightened toward the photo's honey highlights and Ricky's trousers are black as in the photo (both are `tint:` entries in `src/rig.js`, easy to revert); Johnny has the photo's beard, shades, denim and white tee.
- **Leg anatomy:** legs and the near arm are one texture skinned over their joints (continuous knee/elbow bend, hip blends into the pelvis). Real bugs behind the earlier squat/splay are fixed: hip height ignored the shoe height, the stance was about twice as wide as the art, the pose hip height was applied to the torso pivot instead of the leg joints (a permanent knee bend), and a leg could be asked to reach past its length (floating feet). Stances and the walk stride were re-tuned to the art's proportions.
- **Pickups** are cut directly from your food sheet at ~135 px wide (`tools/extract_food.py`, `make_food_assets.py`): Adana, Shish, Doner plate, Lahmacun, Kunefe, Doner spit with flag, plus the glow burst. They heal. Collecting one shows *that same food* fading up with the glow and +100 (the old effect reused the sheet's 'empty plate' panel, which is really an Adana plate, so every pickup seemed to turn into Adana).
- **UI** uses the embedded Press Start 2P arcade font (SIL OFL; `assets/fonts/`) for every string: framed portrait thumbnails with lives, yellow-on-red health bar, HYPE bar, score, enemy and boss panels with thumbnails.
- **Backgrounds and props** are procedural pixel art redrawn with storefronts, lamps, poles, crosswalks, billboards and shaded breakables. They are still code-drawn, not hand-painted.
- **Grab / throw / chained combos:** Grab (U, or GRB on touch) then Attack = grab strikes, Grab again = throw into other enemies; tapping Attack chains a buffered three-hit combo.

**Verified by running code:**
- `node tests/run.js` - 79/79 (includes: a fighter hit in mid-air lands instead of floating): fixed frame canvas / no clipping; planted feet on the ground anchor; constant torso length in every frame (no attack shrink); 8-frame walk synced to distance with a per-character stride; reverse playback when moving against facing; buffered 3-hit combo; lane/direction/reach hit detection; brief hit-stop that does not drain the input buffer; HYPE hold-drain rules; grab/strike/throw/bowling; props, drops, healing; crowd separation; telegraphed windups; lives/respawn; a bot clears all 4 stages.
- `node tools/run_html.js play-v10.html` - 13/13 **on the shipped bundle itself** (all scripts inlined, real keyboard events): boots to title, Enter opens select, Enter starts, walk, lane move, jump, attack damages, hold-L special, pause/resume, zero runtime errors. This is the check that would have caught the black-screen bug of the first v10 (the bundler's `String.replace` treated `$'` in the name `'Johnny $'` as a replacement pattern and corrupted `sprites.js`; fixed with a function replacer).
- Godot: `godot/tests/run_tests.sh` - 47/47 in Godot 4.3 headless, fails on any script error; frames rendered through Godot's renderer (software GL) in `docs/proof/g*.png`.

**Not verified:** a real browser or phone (jsdom + a canvas shim stand in for one), frame rate, touch controls on hardware, audio, gamepad hardware, game feel/balance, Godot on a real display.
**Known limits:** the enemy sheet has only 1-4 frames per action, so enemy walks/attacks are short loops (and a few animations reuse frames); the heroes are still cut-out animation of a single standing pose, so extreme poses look less natural than hand-drawn frames; hero sprites are assembled at start-up and each stage's enemy sprites when the stage loads (a second or two on a desktop, slower on phones); the decoded hi-res atlases are large (~100 MB with a stage loaded) and `play-v10.html` is ~7 MB; no 2-player co-op; no music track ("V.V. - Arcade Tune" is in neither build); Godot port has no on-screen touch controls; no cartoon impact words ("POW").
