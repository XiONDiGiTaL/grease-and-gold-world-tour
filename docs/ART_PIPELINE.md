# Art Pipeline — Grease & Gold: World Tour

## Required visual standard

Use hand-authored, polished pixel-art assets. Do not use JPEG sprites, background cutouts, non-integer scaling, smoothed images, or generated images repurposed as animation frames.

## Character source frame standard

- Gameplay frame canvas: 96 × 144 pixels for heroes.
- Preserve an identical foot baseline in every frame.
- Export PNG-32 with clean alpha transparency.
- Disable filtering on all imported pixel assets.
- Use whole-number display scale only.
- Use a controlled palette and deliberate pixel clusters.

## Ricky B initial animation list

1. `idle_right` / `idle_left`: 4–6 frames
2. `walk_right` / `walk_left`: 8 frames
3. `combo_1_right` / `combo_1_left`: 5–6 frames
4. `combo_2_right` / `combo_2_left`: 5–6 frames
5. `combo_3_right` / `combo_3_left`: 6–8 frames
6. `flag_fury_right` / `flag_fury_left`: 8–12 frames
7. `jump_start`, `jump_air`, `jump_land`: 4–6 frames total per direction where necessary
8. `hurt`, `knockdown`, `get_up`, `victory`: 4–12 frames each

For asymmetric flag, microphone, and salami attacks, create dedicated left-facing frames instead of relying solely on horizontal mirroring.

## Stage layers

Every stage should export separate art layers:

1. Far skyline / mountain layer
2. Buildings and storefront layer
3. Walkable sidewalk and street layer
4. Props and collision layer
5. Foreground overlay layer
6. UI / HUD assets

The Stage 1 HQ source scene currently uses temporary shapes as collision and layout guides. Replace those guides only after the corresponding clean stage assets and collision shapes are ready.
