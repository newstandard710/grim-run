# Grim Run — Macabre Storybook Fantasy Art Guide

**Master art concept:** The Little Harbinger — stylized, illustrated dark fantasy, with an expressive hooded Reaper, bright spectral eyes, a layered weathered robe, and bold hand-painted silhouettes.

**Version:** v0.10.0 — The Reaper Reborn

## Non-negotiable art principles

- Readable at landscape phone scale and at full running speed.
- Original designs. No pixel art, photorealism or commercially recognizable character copies.
- Deep navy and charcoal shadows, hand-painted ivory skull, spectral cyan eyes, restrained magenta lining, antique bronze weapons.
- Distinct threat colors for attack cues; effects enhance, never hide, hazards or collectible locations.
- All sprite animation poses are centered on one unchanging collision anchor. No animation changes physics.
- The Reaper's slide pose must fit the game's 29-pixel physical clearance; the 192px sprite sheet tile is not the gameplay collision box.
- Source SVG is vector, rasterized to fixed sprite atlas textures once during Phaser load (not every frame).
- When assets fail to load, legacy procedural drawings stay visible and combat/gameplay remain fully operational.

## Key palette (exact hexadecimal labels)

| Color name | Hex | Usage |
|---|---|---|
| Spectral cyan | #6BFFF0 | Reaper eyes / important Reaper magic |
| Bone ivory | #E3D9C7 | Skull and scythe |
| Hood slate | #29344D | Cloak shading |
| Shadow navy | #0A1021 | High-contrast shadows |
| Damson magenta | #7B2E65 | Ragged inner robe |
| Antique gold | #D3AE7B | Clasps and weapon fittings |
| Bat violet | #45264A | Cavern Bat body and wing membranes |
| Bat pink | #F66CC3 | Bat eyes and threat recognition |

## Reaper source atlas

**Path:** `assets/characters/reaper/reaper-sheet.svg`  
**Canvas:** 768 × 768px, 4 columns × 4 rows, 192 × 192px per tile.

| Frame | Pose |
|---:|---|
| 0 | Idle A |
| 1 | Idle B |
| 2 | Run A |
| 3 | Run B |
| 4 | Run C |
| 5 | Run D |
| 6 | Jump |
| 7 | Fall |
| 8 | Slide (compact silhouette) |
| 9 | Scythe attack preparation |
| 10 | Scythe active follow-through |
| 11 | Crossbow fire |
| 12 | Damage |
| 13 | Death |
| 14 | Hover |
| 15 | Run E |

**Production note:** Frames share costume elements and anchor. Frame choice is a pure function of recorded gameplay state and elapsed game time so v0.9 rewind can display historical poses without advancing separate animation timers.

## Cavern Bat source atlas

**Path:** `assets/enemies/cavern-bat/bat-sheet.svg`  
**Canvas:** 640 × 256px, 4 columns × 2 rows, 160 × 128px per tile.

Frames 0–3: flapping; 4–5: dive; 6: hit; 7: death.

Only normal Cavern Bats are replaced in this phase. Skeletal Bats, Crawlers, Imps and scenery continue using existing graphics until follow-up releases.

## Runtime architecture

- `assets/visuals/visual-system.js` is loaded before the main Phaser Scene definition.
- After Scene creation, the visual system queues two SVG loads. Phaser rasterizes each at a known fixed pixel size. A sprite sheet is generated from that texture and sprites are allocated.
- One Reaper sprite is created. A pooled set of up to 12 bat sprites is reused; no per-frame texture allocation.
- Scene `drawReaper` and `drawCombat` defer to the sprite system ONLY when that specific atlas is ready.
- The old procedural art continues as a reliable fallback. Other enemy drawings are deliberately unchanged.
- Crossbow, wings, hover bar, scythe hit arc, warning rings, and all game mechanics remain controlled by the existing game systems.
- File paths are relative to `index.html` for GitHub Pages. A source-only offline copy without the assets safely falls back; an eventual packaged app will bundle them.

## Acceptance

1. Character features, proportions, colors and scythe are consistent across every frame.
2. Run, jump, fall, slide, attack, crossbow, hurt, death, hover are triggered by live gameplay state.
3. No position change from visuals; Reaper's feet stay anchored to the ground and slide fits under overhead obstacles.
4. Bat flies and dives with the previously validated timing/collision.
5. God Mode Rewind displays poses from recorded states, not separately ticking animation.
6. Mobile visual performance feels responsive and all original regression suites pass.
7. Missing assets cannot block the start menu or cause an invisible character.
