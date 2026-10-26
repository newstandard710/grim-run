# Grim Run — Approved illustrated character direction

The approved Reaper, Cavern Bat and Skeletal Bat PNG artwork is authoritative. Preserve its gothic cartoon/storybook appearance, silhouettes, shapes, costume, weapons and colors. Do not regenerate accepted poses merely to recreate a production stage.

## Current production assets
- Reaper: `assets/characters/illustrated-v2/reaper/`, 13 transparent poses, 1792 × 1536 canvas.
- Bat: `assets/enemies/illustrated-v2/bat/`, eight transparent poses, 2304 × 1280 canvas.
- Skeletal Bat: `assets/enemies/illustrated-v2/skeletal-bat/`, approved eight-pose atlas, 1254 × 1254 canvas.
- Bone Crawler: `assets/enemies/illustrated-v2/bone-crawler/`, four approved crawl poses, 1477 × 1065 canvas per frame, scaled for an 85–93px silhouette and mirrored rightward at runtime.
- Ember Imp: `assets/enemies/illustrated-v2/ember-imp/ember_imp_atlas_v1.png`, six approved 256 × 256 frames in a 768 × 512 atlas.
- Runtime metadata and state mapping: `assets/visuals/visual-system.js`.
- Original motion sources: `assets/visuals/review/character-motion-cycle-v1/`.
- Original static sources and additional review sheets remain preserved in the supplied handoff archive; not all were previously committed to GitHub.

## Preserve during recovery
The Reaper uses the existing (1250, 1420) anchor and 120/1111 normal scale. Sliding retains 80/1111 scale and its approximately 47px visible silhouette. The Bat uses (1500, 720) and 52/766 scale. These are visual settings, not collision geometry. Do not change controls, physics, God Mode, powers, vendors or progression for sprite recovery.

## Production approach and outstanding work
Shared canvases and eye registration exist. A reusable layered component rig has not been established. Preserve successful PNGs and evaluate actual cycle consistency before deciding whether any new components are useful. The Reaper, Cavern Bat, Skeletal Bat, Bone Crawler and Ember Imp art are accepted and enabled by default.

The approved Reaper run has eight poses at 12fps; the approved Cavern Bat cycle has eight steps at 12fps, including repeated transition poses. Review body/weapon consistency, foot placement, wing continuity, slide clearance, and transitions at gameplay size. Do not treat matching overall bounds as proof of identical body proportions.

## Skeletal Bat approved art
The approved atlas is `assets/enemies/illustrated-v2/skeletal-bat/skeletal_bat_atlas_v1.png`, a transparent 1254 × 1254px, 2-column × 4-row sheet. It contains four flight poses, the existing dive telegraph and dive, a hit reaction, and a defeat pose. Render the visible silhouette at about 58px tall, slightly larger than the Cavern Bat's 52px target. Its 46 × 38 collision box and all combat timings remain unchanged. The art is now the default; missing or invalid data keeps the procedural Skeletal Bat visible.

## Bone Crawler phone-review art
The four frames are `crawler_crawl_01_v1.png` through `crawler_crawl_04_v1.png` under `assets/enemies/illustrated-v2/bone-crawler/`. Each transparent frame is 1477 × 1065px and shares a center origin and foot baseline. The cycle plays at 8fps. At 2.5× the initial review scale, the visible silhouette varies from about 85–93px tall and 112–131px wide, close to a large dog beside the Reaper's 120px visible target. The runtime mirrors each pose horizontally so the crawler faces right; source PNGs are unchanged. Its 95 × 105 collision box is 2.5× the original box and rests on the same ground line. The accepted art is the default; `?enemyReview=bone-crawler` and `?enemyReview=both` remain review aliases. Preserve its one HP, ground movement, ledge stopping, spawn schedule and contact-damage behavior. Missing or invalid files leave the enlarged procedural crawler visible.

## Ember Imp review art
The atlas `ember_imp_atlas_v1.png` is 768 × 512px with six 256 × 256 frames and a shared foot baseline. Frames 1–3 and 6 form a four-pose run cycle facing right at 8fps; frames 4–5 show its existing fire warning and release poses turning toward the Reaper. The visible silhouette target is about 55px tall. The accepted art is the default; `?enemyReview=ember-imp` and `?enemyReview=both` remain review aliases. Preserve the 2 HP, 38 × 42 collision box, movement, 470ms warning, fireball launch/cooldown, and separate projectile effect. Missing or invalid art leaves the procedural Imp visible.

## World & Atmosphere forest, foothills and Tundra

- Keep the approved character palette and silhouettes readable against the environment: deep navy shadows, restrained blue-green fog, muted pine greens and small warm moonlit highlights.
- Use layered, hand-drawn shapes with clear parallax depth. The first preview uses a pale moon, broken ridgelines, three pine layers, low mist and a few dim fireflies.
- Give the ground a subdued moss edge with visible soil strata, scattered stones and occasional root marks. Texture stays below the running silhouette and never resembles a hazard or collectible.
- Keep the opening forest illustration behind the play layer. Do not cover enemies, pickups, hazard cues, the Reaper's feet or the HUD.
- The phone-approved forest and foothills art is the default, transitioning from woodland through rolling foothills around 900–2,300m. `?worldReview=opening` and `?worldReview=foothills` remain compatibility aliases.
- Foothills are the next stretch: use a gradual forest-to-hills transition from about 900m through 2,300m, with sparse pines, rounded slopes, increasingly visible mountain ridges, muted stone, small gravel and fading brush.
- The accepted foothills art is the default. Existing terrain, ground heights, collision shapes, object placement and enemy behavior remain unchanged.
- Preview the Tundra mountain ascent through `?worldReview=tundra` from 1,900–3,400m. Keep the 2,000–3,000m ridges broad and visibly rooted in the horizon; every snow cap must share its mountain's apex and stay within the rock face. Avoid detached peaks or snow fragments that read as floating.
- Layer distant ranges, exposed rock faces, restrained frost, a sparse treeline that fades with altitude, and thin windblown snow well away from the play surface. Keep backgrounds and ground texture below foreground sprites and preserve a readable contrast with enemy and hazard cues.
- Keep the 3,000–5,000m summit/stars treatment in the existing ascent. The user approved the complete post-portal concept set below for implementation as one world-art update.

## Underworld Biomes

- **5,000–6,000m — Underground Caves:** enclosed natural rock caverns with layered arches and stalactites.
- **6,000–7,000m — Deep Underground:** large cyan and violet crystal formations in deep rock.
- **7,000–8,000m — Ashlands:** charred basalt, dead trees, ash and ember seams; entirely underground with no visible sky, moon or moonlight.
- **8,000–9,999m — Lava:** active molten channels and falls over dark volcanic rock.
- **9,999–20,000m — Boss Biome:** a gothic Underworld castle framed by cavern walls, lava, chains and hanging skeletons.
- Use each approved concept PNG as the visual source for the in-game backdrop. Adapt the wide art into moving background layers, add controlled seeded scenery variation and subtle ambient motion, and crossfade neighboring biomes over short distance bands.
- Pair each backdrop with a matching ground material and restrained surface detail. Keep terrain geometry, collision, hazards, enemy behavior, controls and the existing 9,999m normal victory unchanged.
- God Mode may continue beyond the normal finish through the Boss Biome, with teleport access through 20,000m. Preserve safe ground and the Boss Biome presentation beyond 20,000m for continued God Mode exploration.

## Full-route backdrop assets

- Approved surface concepts are `forest.webp`, `foothills.webp`, and `tundra.webp`; the five post-portal concepts are the files listed above under `assets/visuals/biomes/`.
- Forest covers 0–900m, foothills 900–2,300m, and Tundra continues through the 5,000m portal approach. Surface and Underworld biome boundaries crossfade over 360m, except the portal: it changes directly from Tundra to fully formed Caves on arrival. Ground colors follow the same transitions.
- Keep slight camera-linked drift, gentle vertical motion, and biome-specific ambient flecks so the art feels alive without competing with gameplay. Treat the generated concept image as the visual source; do not add an opaque procedural sky over it.

## Ground and foreground materials

- Use `assets/visuals/terrain/ground-forest-v1.webp`, `ground-foothills-v1.webp`, `ground-tundra-v1.webp`, `ground-caves-v1.webp`, `ground-crystals-v1.webp`, `ground-ashlands-v1.webp`, `ground-lava-v1.webp`, and `ground-boss-v1.webp` for the corresponding eight biomes.
- Treat these as world-space surface materials. Clip them to the generated ground profile so plains, slopes, rubble, cliffs, ledges and the foreground follow the actual terrain. Gap openings use the painted canyon and lava art described below; do not add fixed screen-space bands or flat underfills.
- Use the same biome boundaries and easing as the backgrounds, including the hard Tundra-to-Caves handoff at the 5,000m portal. Avoid fixed screen-space ground bands or geometry changes.
- Keep surface marks and edge highlights restrained so the Reaper, enemies, hazards and pickups remain readable at phone scale. Do not regenerate or replace the approved background concepts as part of ground-material work.

## Running surface cap — v0.12.2

- Give the walkable edge a clearly visible but narrow material cap, about 8–10px deep at the current phone review scale. The approved Forest direction uses a moss-toned top and a slim darker soil seam; carry that role through gravel and stone in Foothills, snow and ice in Tundra, layered rock in Caves, cool mineral accents in Crystals, ash and ember seams in Ashlands, volcanic crust in Lava, and dark castle stone in the Boss Biome.
- The cap's upper edge follows the existing terrain contour exactly and all decoration stays on or below that line. Follow slopes and rubble naturally, end at gaps and ledge edges, and leave the abyss open. Do not change terrain geometry or collision.
- Keep the material translucent enough for each approved ground texture to show through. Use a softened, irregular lower edge and restrained broken highlights; let the biome material show through instead of forming a hard band. Keep the running contact contour locked to existing terrain and collision. Keep all marks readable at phone scale without competing with Reaper feet, enemies, hazards, pickups, or foreground details.

## Biome cliff edges and abyss overlap — v0.13.3

- Keep `abyss-canyon-gap-01.webp` and `abyss-canyon-gap-02.webp` for rock canyons; use `abyss-lava-gap-01.webp` and `abyss-lava-gap-02.webp` for Lava and the lava-lit Boss Biome. These portrait paintings stay world-anchored and narrow toward dark distance with no visible bottom.
- Extend each backplate and its mask at least 24px beneath both terrain edges. The solid terrain, its painted material, and the cliff-face layer draw above that overlap. Do not let the mask shrink away from the ground and expose blank side gaps.
- Keep the real terrain and its collision profile authoritative. The visible gap is covered by the backplate plus two cliff-face shapes; the face edge overlaps the backplate by at least 2px, and its landward edge overlaps the ground by at least 24px.
- Add a small overhang at each opening lip and an irregular, chipped wall profile below it. Use stable, terrain-seeded shapes so edges do not flicker as the camera moves. Avoid a perfectly straight edge or a continuous outlined rim.
- Give cliff faces their own material, distinct from the ground tile. Use biome-matched colors and restrained details for roots and moss, foothill strata, ice, cavern slate, crystal facets, ash, basalt, and boss stone. Keep transitions consistent with the existing biome fades.
- Keep lava scenes through Lava and the Boss Biome; use rock canyon scenes through Surface and other non-lava areas. Do not tile cliff walls or add detached lava cracks.
- The walkable surface, slopes, platforms, collision, fall rules, controls, hazards, and route progression stay unchanged. The cliff lip is a visual layer only.

## Validation and deployment
Image loading checks exact byte counts, PNG chunk checksums, and SHA-256 when browser cryptography is available. A failed pose disables that character's art set and retains its procedural fallback. The asset integrity check covers Reaper and Cavern Bat runtime poses and all three accepted enemy illustrations. Browser checks inspect decoded pixels and capture mobile-scale scene screenshots; device review remains necessary.

Original source images must remain byte-for-byte intact. Verify remote sizes, Git blob hashes and downloaded SHA-256 after transfer. Never publish damaged data or promote review art on the strength of texture names alone.

## Legacy guide
The prior guide below documents the rejected experimental SVG path, not the approved PNG production direction.

---

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
