# Map Generation Update - 2026-06-26

## Scope

- Original game only: `D:\ChatGPTProjects\マインクラフト`
- Reference: `ashish0kumar/Minecraft-Javascript-Edition` map generation ideas only.
- Not copied: the alternate engine, controls, rendering structure, or venue implementation.

## Changed

- `src/game/parts/30-noise.js`
  - Added seeded 3D Perlin noise and `fbm3()`.
  - Purpose: Minecraft-Javascript-Edition style 3D resource/ore distribution.

- `src/game/parts/32-world-window.js`
  - Reworked `heightAt()` around warped multi-layer noise:
    - broad continent layer
    - rolling hills layer
    - ridge layer
    - fine detail layer
    - biome-specific shaping
  - Reworked `oreTypeAt()` to use 3D noise veins plus sparse speckle thresholds.
  - Reworked tree placement from per-block scatter to deterministic cell-based placement.

## Preserved

- Spawn flat area and clean start zone.
- Existing biome ids and labels.
- Structures, animals, hostile mobs, plants, weather, music venues, and saved player edits.

## Verification

- `npm.cmd run assemble`: OK
- `npm.cmd run build`: OK
- `http://127.0.0.1:5173/`: HTTP 200
- Browser startup check: rendered a nonblank world with `173269` blocks and zero console errors.
