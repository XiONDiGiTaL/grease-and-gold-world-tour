# Audit of github.com/XiONDiGiTaL/grease-and-gold-world-tour (commit 05d2011, play-v9)
Measured with Pillow on `sprites/*.png` (see `audit_existing_repo_sprites.png`):
- **Canvas sizes are inconsistent**: 94x240, 102x240, 160x240, 280x542, 308x308, 394x400, 400x400, 416x416, 432x416, 568x693... A fighter's idle, walk, hurt and attack frames use different canvas sizes, so any fixed anchor will make them jump/shrink.
- **Enemy frames fill their whole canvas** (guard_*, exec_*: bbox touches L/R/T/B) with opaque corners (`guard_idle`, `exec_walk`, ...) = keying not done; the background is a stray rectangle (a purple line is visible on `exec_idle`).
- **Magenta pixels** remain in `bg_stage1.png` (120), `vv_attack.png` (32), `ricky_attack.png` (8).
- **Clipping**: `vv_down` (clipped L+R), `heavy_attack`, `ledger_*` (L/R), `johnny_jump_2` (T+B), `vv_atk_4`/`vv_atk_2`/`johnny_atk_3/4`/`ricky_jump_2`/walk frames touch an edge; `vv_atk_2` contains a stray second head/hair fragment at the bottom.
- **Enemy walk is a single frame**: `guard_walk`, `exec_walk`, `heavy_walk`, `ledger_walk` are one PNG each; `game.gd` toggles it with idle every 10 ticks (`int(gt/10)%2`) - that is the "sliding" effect.
- **Player walk is a 4-frame cycle on a timer** (`int(gt/8)%4`), not tied to distance travelled -> feet slide at any speed other than the one it was tuned for.
- **Specials reuse attack frames**: the bounding boxes match exactly - `ricky_special_2` = `ricky_atk_3` (364x365), `ricky_special_3` = `ricky_atk_4` (354x368), `ricky_special_1` ~ `ricky_atk_1` (338x365 vs 338x364); `johnny_special_2` = `johnny_atk_3` (312x398), `johnny_special_3` = `johnny_atk_4` (378x397). Size match is strong evidence of reused art, not proof; the contact sheet shows the Johnny/Ricky specials visually near-identical to their attacks.
- **Semi-transparent / anti-aliased pixels** in every legacy `*_idle/walk/attack/hurt.png` (2,000-5,400 px each) -> blur at 2x.
- **Pickups**: `pickup_adana` 48x32 and `pickup_shish` 48x20 touch all four edges (clipped); shish has an opaque corner.
- **Props** are 568x693, 758x704 etc. (raw generator output) - not at game scale.
- **Godot**: `game.gd` is one 862-line script; hitbox is a flat `reach := 60.0` for every move (not matched to sprites); special costs a flat 30 HYPE (instant), no hold/drain; no lane-depth or height test in the player strike.
- Not verified: HTML build feel (play-v9.html is 10 MB of data URIs; not run in a browser here); Godot opening cleanly (no Godot binary available).
