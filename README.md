# Grim Run — v0.19.1 · Scythe & Stride

[Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.19.1)

The basic cut now uses one fixed, carry-matched scythe size through windup, strike and recovery. A separate spectral swing arc supplies the previous attack reach; damage timing and collision geometry are retained. Grounded and aerial basic cuts share the same immutable weapon scale.

The accepted 24-pose run animation is unchanged, with its full sheet advanced over 752 world pixels instead of 188. This reduces playback cadence by 75% at every movement speed while preserving automatic synchronization to actual distance, acceleration, slow time and rewind. The v0.19.0 movement-speed curve is unchanged.

The [motion review](assets/motion/v0180/review.html) uses the same runtime tuning. Rollback base: v0.19.0 (`af313d437c5881ccb106ec031e9b28b94bdfe495`).

---

# Grim Run — v0.19.0 · Gravewing Ascension

[Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.19.0)

Carnivorous plants now face the approaching Reaper and deliver a telegraphed, proximity-triggered bite with sixteen rooted drawings and synchronized jaw collision. First Angel and Devil introductions last ten seconds and skip with any screen tap; repeat vendor menus wait until the merchant is reached.

God Mode cycles normal / half / quarter / paused world time. Running is 30% slower, accelerating from 197.4 to 325.5 through 5,000m; gaps that exceed the new base-jump range are capped conservatively. The distance-linked running gait follows automatically.

Gravewing Ascension names the Raven + Skeletal Wings combination, with a dedicated integrated ivory-bone/black-feather wing set and twelve flap/tuck drawings. It activates through the ordinary second-wing purchase, retaining the two existing power ranks and costs. The active build shows both ranks. Crossbow bolts and chain visuals are 3× larger. Brittle Bones fragments are 3× larger and move at half speed over a doubled lifetime, retaining their offscreen reach and ability effect. Two incorrect bat eye registrations are corrected without replacing its accepted wing drawings.

[Production assets, exact built-in Imagegen prompts and registration](assets/encounters/v0190/README.md). Rollback base: v0.18.0 (`d0437520bd76e53b33540243561e80e7782998eb`).

---

# Grim Run — v0.18.0

The Reaper in Motion adds 24-pose running, physical jump/landing phases, a rebuilt point-leading standard scythe cut, slower shared bat flight and rendering/frame-pacing fixes.

[Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.18.0) · [Review the movement](https://newstandard710.github.io/grim-run/assets/motion/v0180/review.html) · [Motion artwork and exact prompts](assets/motion/v0180/README.md)

Running follows distance traveled, so animation cadence automatically matches pace changes. Jump controls and physics remain responsive; landing recovery is interruptible. The standard cut keeps its existing action/cooldown timing and uses the same rigid blade path for art, trail and refined hit detection. Special cuts and existing powers remain available.

Rollback base: v0.17.0, `590af511776d94bbddfa4f83c1e191f90fc1e58d`. See `PROJECT_STATUS.md` for current scope and validation.

---

## v0.17.0 — Bone & Shadow

Painted combat now includes full low slide strikes, Soul Cleave, standing/sliding/airborne crossbow cycles, distinct crossbow-upgrade FX, all four enemies’ hit/defeat sequences and Reaper hurt/defeat. The Cavern Bat has a new shared sixteen-pose flight loop on the opening screen and in gameplay. Defeat views continue after combat collision ends; Reaper defeat freezes the world briefly before the established resurrection/results flow.

Vendor encounters begin on grounded shrine-floor contact. Both merchants keep the original three cards visible and crossed out after purchase, with healing and Continue in the same panel. Carnivorous plants are 3× their prior painted dimensions, Souls 2×, and Brittle Bones radiates beyond all screen edges. Existing physics, pickup ranges and plant hitboxes are preserved.

[Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.17.0). [Artwork, prompts and registration](assets/combat/v0170/README.md). Other basic movement/idle polish remains deferred.

## v0.16.0 — Beyond Death

A painted forest entrance now welcomes the Reaper and accepted enemy cast, with **Tap to Cross the Veil** leading into the main menu. All menus share locally hosted gothic headings, readable body lettering, painted stone and aged bronze frames. Main action controls are 15% larger with 15% wider gaps: Jump and Slide on the left, Shoot and Cut on the right.

Angel vendors offer separate **1 HP / 8 Gold** healing before or after their one reward purchase. **Fate’s Bargain** grants 1/2/3 vendor rerolls per run (5/10/25 Souls); **Grave Wealth** retains its existing 2/4/6 starting Gold and saved ranks; **Death Denied** costs 15 Souls once and grants one free resurrection per run. The paid 3-Soul resurrection remains available separately. Both death resurrections play the approved paused smoke formation, then the existing countdown.

Speed rises from 282 to 465 through 5,000m and holds there for the remaining route. New-game, teleport, obstacle fairness and resurrection use the same distance calculation. [Artwork, exact prompts and font licenses](assets/ui/v0160/README.md). [Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.16.0).

## v0.15.3 — Souls & Shadows

Spinning illustrated coins and softly breathing Souls are 75% larger. Soul-encounter ledges now float, with eight biome material sets. Rounded hills share one profile across art and collision. Long-rooted cut obstacles sit deeper, the legacy dark abyss backing is removed, and four material families animate when cut. Surviving abyss falls receive a smooth, paused 1.5-second smoke reformation before immediate play resumes.

Artwork, source prompts and reproducible preparation: `assets/world-polish/`, `scripts/prepare-world-polish.py`. All pickup collection rules, Soul encounter layouts, vendor sanctuaries and accepted character artwork are preserved.

# Grim Run

## v0.15.2 — Merchant Sanctuaries

Angel vendors stand on marble tile between worn columns; Devil vendors stand on red hellstone brick between ominous statues. Each decorated sanctuary extends 25m to either side, on real level ground. Enemies and hazards are excluded from the new approach and the existing 50m exit corridor. Vendor sprites and their auras are 75% larger.

The first Angel and first Devil encountered each run receive a smooth, skippable three-second introduction before selection. The shrine crossbow is smaller, attached at its stock to the Reaper’s palms, and held still for a 1.4-second glow.

[Sanctuary assets and Imagegen prompts](assets/vendors/v0152/README.md). [Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.15.2).

## v0.15.1 — Cloak Wings & Living Thorns

Wings are 50% larger and emerge beneath matching cloak folds. Brittle Bones throws visible tumbling bone fragments; the moving mountain bramble is an animated toothed carnivorous plant. The summit reward has 24 registered motion poses and a hand-following crossbow path. Foreground fog crosses abyss openings, and all six airborne bramble supports use curved organic artwork.

[Revision assets and exact generation prompts](assets/powers/revision-v2/README.md). [Play Grim Run](https://newstandard710.github.io/grim-run/?v=0.15.1).


## v0.15.0 — Wings, Powers & Summit Relic

New painted action poses animate airborne tuck and scythe combinations. Raven and Skeletal Wings have articulated cycles, with a second skeletal set for the combined loadout. All vendor powers and healing purchases receive short effects, and higher levels add subtle color accents during use.

The Bone Crossbow now comes from a snowy mountain shrine at **4,900m** in a six-second skippable scene. The **5,000m** portal keeps the acquired weapon and resumes without a second chest. Controls, attack windows, ability balance and collision geometry are preserved.

[Power art and production prompts](assets/powers/README.md). [Play Grim Run](https://newstandard710.github.io/grim-run/).


A landscape, mobile-first side-scrolling action roguelike starring the Grim Reaper.

**Current build: v0.19.0 — Gravewing Ascension**

The jump-plus-attack brambles draw larger and have six dedicated biome sprites, including new Tundra, Caverns, and Ashlands variants. Each has a unique darkened cliff tether behind the ground. Both rare jump-plus-tuck gates draw larger, with their actual lower artwork aligned to the original ducking line and distinct ceiling-chain mounts behind the terrain. Angel and Demon Vendors have softly pulsing holy and sinister auras behind their figures. Collision geometry, clearance, obstacle and vendor placements, spawn rates, and mechanics remain unchanged. [Play on Android](https://newstandard710.github.io/grim-run/).

## v0.14.8 — Ground Fog and Vendors

Four irregular mist paintings form a semi-transparent ground-level fog band in every biome. World-anchored variation changes each bank's silhouette, width, height, position, and opacity; a terrain mask keeps it off the open gaps. Biome colors blend through existing transitions. The fog rises in thin wisps to the Reaper's chest and is strongest below the waist. Foreground obstacle art sits ahead of the fog; the Reaper and vendor sprites sit behind it in separate layers. New Angel and Demon Vendor cutouts replace their procedural silhouettes at the same existing stops. Vendor offers, timing, positions, obstacle collisions, spawns, and all mechanics are unchanged. The earlier abyss fog remains inside the gaps on its original layer.

## v0.14.7 — Slide Backdrops Across All Biomes

All 24 slide variants now have a unique painted support paired with their respective foreground obstacle. Each support follows its obstacle's material and contours, reaches into the terrain, and draws behind the ground and slide front; the Reaper and solid ducking point stay visually foremost. The three forest supports retain their v0.14.6 art, along with the forest tree, corn, and ground contact improvements. Hitboxes, slide clearance, spawn rates, placement, and mechanics are unchanged.

Ground jump and cut obstacle art keeps the terrain overlap approved in v0.14.2.

- Jump sprites display at 2.5×. Forest cuttable trees display at 3× and forest corn at 1.3× wide and 1.69× tall; other biomes retain their previous scales. Slide art retains its wide 3.25× footprint and extends into the upper visible scene from the unchanged clearance line.
- Keeps the biome-exclusive obstacle art set: three jump, slide, and cut visuals per biome, three fire visuals in each fire biome, plus the air-tuck, air-bramble, and snapping-bramble sprites.
- Obstacle selection, hitboxes, types, placements, spawn timing/rates, route progression, and gameplay RNG are unchanged. Optional sprite-load failures use a short ledge fallback for slide obstacles.
- [Obstacle art catalog](assets/obstacles/README.md) lists all skins by biome. The matching runtime metadata is in `assets/visuals/obstacle-catalog.js`.
- The playable update is ready for Android device testing. [Open the game](https://newstandard710.github.io/grim-run/).

## v0.14.1 — Obstacle Scale Pass

- Enlarged jump art to 2.5× its former display size and grounded each sprite to the existing obstacle location.
- Enlarged named tree and sapling cut art to 2×; other cuttable sprites are 1.3× taller to keep corn and similar plants proportional.
- Enlarged slide art to 3.25×, removed the old full-height pillar and rim, and aligned each sprite's lowest illustrated point with the existing slide-clearance contour. The art rotates slightly with nearby terrain.
- Gameplay collision boxes, spawn selection and rates, obstacle positions, timing, and mechanics are unchanged. Chromium checks cover all 93 skins, their display scales, ground anchors, and the slide rendering path.

## v0.14.0 — Biome Obstacle Variety

- Added 24 jump, 24 slide-under, 24 cuttable, and 15 fire sprites, plus 2 air-tuck, 3 air-bramble, and 1 snapping-bramble sprites. Assets are transparent PNGs authored at three times their intended display size and organized by biome.
- The three core visual families have three choices in each biome. Fire has three choices in Caves, Crystals, Ashlands, Lava, and Boss. Dedicated air-bramble skins use the biome's cuttable artwork where no dedicated air-bramble skin is assigned; Air Tuck art is assigned to Ashlands and Lava, and snapping bramble art is assigned to Tundra.
- Obstacle skin selection uses biome and world position only; it does not consume gameplay RNG or read gameplay variants. Existing hitboxes, obstacle placements, spawn rates, timing, movement, combat rules, and progression are unchanged.
- All 93 PNGs pass catalog, biome, uniqueness, alpha-channel, size, and decode checks. Existing gameplay regression suites pass; Chromium also checks texture loading, biome selection, and phone-size rendering. Physical Android appearance and performance remain the device playtest.
- [Open the playable update](https://newstandard710.github.io/grim-run/).

- The Reaper, Cavern Bat, Skeletal Bat, Bone Crawler and Ember Imp art are approved and enabled by default. The procedural fallback remains available if an art file fails to load.
- Approved forest, foothills, and mountain concept art now covers the full above-ground route through 5,000m.
- The Underworld now moves through caves (5,000–6,000m), crystal caverns (6,000–7,000m), skyless Ashlands (7,000–8,000m), lava (8,000–9,999m), and the lava-lit castle Boss Biome (9,999–20,000m).
- Eight biome materials cover generated terrain and foreground platforms. v0.13.5 reframes all eight ravine paintings below the rim, aligns each art top edge to its own real terrain lip, and keeps the images behind the ground. v0.13.6 adds restrained, biome-tinted fog over the ravine art and beneath real terrain. Terrain generation, the running surface, collisions, hazards, and route progression stay unchanged.
- All eight approved biome concepts remain the only background art. The old procedural sky, mountain, tree, cave, ash, and lava overlays have been removed. Image and ground materials share the gently drifting 360m crossfades; at 5,000m the portal switches directly from Tundra to Caves.
- Biome crossfades define their own easing helper, preventing an out-of-scope function error from aborting background and ground rendering at fade boundaries.
- Surface backgrounds load first. Underworld backgrounds are loaded during the portal sequence, then replace and release the Surface textures to reduce memory use on phones.
- The game wakes Phaser's frame loop when returning to the page and before pause, resume, menu, new-run, and vendor-exit transitions. A visible-page watchdog restarts Phaser if active gameplay stops receiving update heartbeats. Starting a run also resets the camera to the Reaper's starting position.
- Terrain requests for already-generated ground now return without adding more chunks; God Mode extends the world in bounded chunks beyond the pre-generated normal course.
- Normal runs still finish at 9,999m. God Mode can continue past the finish and teleport in 500m steps through 20,000m.
- v0.12.2 adds a more visible, biome-matched surface cap beneath the Reaper's feet. It follows each terrain segment's exact top profile and stops at gaps; terrain and collision geometry stay unchanged.
- v0.12.2 caches each visible terrain section's texture mask and surface cap. Material phase and biome color are anchored to the section's world position, reducing repeated per-frame drawing during play.
- v0.12.3 gives the surface cap a fading, irregular lower edge with restrained biome-specific detail while keeping its top contour fixed to the existing run surface.
- v0.12.3 anchors ground masks and abyss fills to world-space terrain bounds, restoring Crystal and Boss art at deep underworld heights without changing terrain or collisions.
- [Open the production game](https://newstandard710.github.io/grim-run/).

- [Game HTML](index.html)
- [Development status and playtest checklist](PROJECT_STATUS.md)
- [v0.9.1 rollback branch](https://github.com/newstandard710/grim-run/tree/backup/v0.9.1)
- [v0.10.2 stable fallback](https://github.com/newstandard710/grim-run/tree/backup/v0.10.2)

## v0.13.6 — Abyss Fog (current production)

- Adds one transparent painterly fog layer inside abyss openings. It uses the same jagged, sloped terrain mask as the ravine painting, sits above the painting and beneath the real ground, and drifts only a few pixels over time.
- Fog color crossfades with the matching biome across Forest, Foothills, Tundra, Caves, Crystals, Ashlands, Lava, and Boss. It leaves the walkable surface, terrain geometry, collisions, enemies, and route progression unchanged.
- Actual Chromium checks cover all eight biome openings, fog tint and mask alignment, draw order, and phone-scale screenshots. The Android build is ready for device playtesting.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.13.5 — Ravine Art Reframe

- Crops the upper 35% from each of the eight biome-specific abyss paintings, removing above-ground sky and moon imagery while preserving the normal biome backgrounds.
- Positions the cropped art about one Reaper head-height below each ravine rim. Both sides follow their own terrain endpoint, including sloped openings, while an irregular inset edge and an underlapping mask keep the transition covered.
- Preserves the artwork's proportions while zooming it into the gap. Terrain still draws over the image; the running surface, generated terrain, collisions, fall rules, hazards, and 9,999m finish are unchanged.
- Gameplay regressions pass, including seed 1 winning at 9,999m. Actual Chromium rendering checks cover all eight biomes, the sloped-edge case, and phone-size screenshots. Android device appearance and play-feel are ready for playtesting.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.13.4 — Biome-Specific Ravines

- Adds a distinct deep-abyss painting for each of the eight biomes. The art is clipped to the seeded ravine opening, widened beneath the real terrain, and crossfades with the existing biome palette.
- Removes the shared canyon/lava plates and separate procedural cliff-face band. The painted opening forms a small irregular lip, while the terrain covers the overlap and hides seams.
- Keeps terrain, collisions, hazards, route progression, and the 9,999m finish unchanged. Local gameplay regressions and the phone-size Chromium render checks pass; Android device appearance and play-feel are ready for playtesting.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.13.3 — Biome Cliff Edges

- Fixed the side gaps around abyss paintings by extending each backplate and its mask beneath the ground on both sides. Real terrain and cliff faces draw above the overlap.
- Added cached jagged cliff faces with a small overhang. Their rock, ice, roots, crystal, ash, and ember details change with the biome and remain visually separate from the walkable ground texture.
- Kept the collision edge and player run surface unchanged. All eight biome gaps are covered by phone-scale Chromium checks, including side overlap, lip coverage, and biome material identity.
- The eight local gameplay regression suites pass. Actual Chromium and Pages checks gate deployment; Android device play-feel remains for the playtest.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.13.2 — Gap-Fitted Abyss Art

- Fixed the canyon and lava openings that showed only a narrow dark slot. The prior panoramic scenes were scaled to the full screen even though the terrain mask revealed only a much narrower gap, hiding the painted cliffs.
- Added four portrait depth paintings, two rock canyon scenes and two lava scenes. Each plate is sized from its actual generated gap, centered on it, and places the painted near cliff lips at the real terrain edge.
- Keep the images behind the exact gap mask and draw terrain above them. The walls frame the opening, narrow into dark distance, and continue below the phone viewport without exposing a floor.
- Removed the previous canyon and lava depth paintings. Terrain shape, surfaces, collisions, movement, fall rules, controls, and the 9,999m finish are unchanged.
- Regression tests and actual Chromium rendering checks gate deployment; Android device play-feel remains for the playtest.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.13.1 — Receding Canyon Depths

- Replaced the previous repeated canyon and lava-wall treatment with four original painted depth illustrations: two rock canyon scenes and two dark lava canyon scenes.
- The canyon artwork is a background layer shown only through generated gaps. Its opening starts at the real terrain endpoints; actual ground and platform faces cover the lips and remain the foreground.
- The scenes darken and narrow into unseen distance, with irregular canyon sides and no visible floor. Their world-space masks follow the generated gaps as the camera moves.
- Lava scenes fade in with the Lava biome and continue into the Boss Biome. Old tiled canyon/lava artwork and detached lava marks are removed from the active build.
- Terrain generation, surface art, ledges, collisions, fall rules, controls, and the 9,999m finish are unchanged. Local gameplay regression checks pass; the GitHub Chromium workflow checks the new artwork before deployment.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.13.0 — Painted Canyon & Lava Chasms

- Added two original 768px terrain textures: layered shadowed canyon rock and fractured basalt with restrained molten seams.
- Gap art follows seeded, world-space opening shapes. Ragged rock lips meet the existing terrain profile; the walls narrow far below the phone view, with no visible canyon floor.
- Generated jump ledges and Soul-step platforms now carry irregular biome material faces below the camera. Their walkable tops, gap widths, and collision rules remain unchanged.
- The previous rectangle abyss fill, flat lava band, hard lava edge, and detached surface crack marks are removed. Lava texture fades in with the biome and remains clipped to actual gaps.
- Cached art masks stay anchored to world coordinates and are reused during camera movement. Gameplay and phone-size Chromium checks cover the existing seed 1 win and all route systems.
- [Open the production game](https://newstandard710.github.io/grim-run/).

## v0.12.0 — Biome Ground Materials

- Replaced the flat procedural ground fills with eight biome-specific materials, clipped to existing ground, slope, rubble, and platform profiles.
- Kept generated terrain, cliffs, gaps, collision, hazards, controls, and the normal 9,999m finish unchanged. Abyss fills remain visible behind open gaps.
- Fixed the Ember Imp visual check to measure the decoded atlas silhouette; the long-run regression now turns God Mode off before testing victory, and the God Mode range check covers the documented 20,000m teleport limit.

## v0.12.3 — Natural Ground & Underworld Rendering Fixes

- Replace the even-looking cap seam with a lightly varied, translucent edge and restrained biome-specific surface marks; keep the run contact contour exact.
- Extend material masks and abyss fills from each terrain section's world-space height. This prevents deep Crystal and Boss sections from being clipped by the normal screen ground line.
- Phone-scale Chromium checks pass for all eight biome materials and surface caps. Crystal and Boss backdrops show detailed imagery across all three screen sections, and both terrain and ledge faces retain their painted material.
- Gameplay regression also passes, including 300 seeded terrain cases, the seed 1 9,999m win, five complete seeded wins, and 72 God Mode teleports through 20,000m.
- No terrain generation, collision, controls, hazards, or route progression changes.

## v0.12.2 — Biome Surface & Performance Pass

- Added a readable, narrow biome-matched cap: moss and soil in Forest, gravel and stone in Foothills, frost in Tundra, layered rock in Caves, mineral color in Crystals, ash and embers in Ashlands, volcanic crust in Lava, and dark stone in the Boss Biome.
- Kept the cap entirely within the existing walkable profile. It follows slopes, rubble, and ledges, and ends at every gap and platform edge. No collision or route geometry changes.
- Cached each terrain section's material mask and surface cap instead of rebuilding them as the camera moves. Material phase and biome colors stay fixed to world position.
- GitHub Actions passed gameplay regression and phone-sized Chromium checks across all eight biomes, including surface alignment, open gaps, ledges, and cache reuse. The live GitHub Pages build is v0.12.2. Real-device Android frame rate and play feel remain for playtesting.

## v0.12.1 — Terrain Surface Pass

- World-locked non-Tundra material texture phase across visible section clipping, anchored rubble accents to the local slope, softened the concept art beneath the run lane, and replaced the hard surface stroke with a subtle biome-colored rim.
- Preserved terrain shape, collision, gaps, and abyss fills.

## Current Reaper art

- The eight-pose Reaper run cycle and the new slide and four-beat scythe attack appear in the main game. Bat wing animation and the approved standard poses remain unchanged.
- The run cycle adds a subtle 1.75px up/down bob, twice per stride, to keep the Reaper's head from appearing locked in place. This only moves the drawn sprite; it does not change its size, collision, or speed.
- The slide pose preserves the Reaper's head and torso size and is about 74px tall. Low branches are raised to a 76px opening; the 79px standing collider still hits them, so the player must slide. The existing 56×29 slide collider is unchanged.
- The scythe attack plays four drawn poses over the existing 260ms action window, with the pointed edge leading the forward sweep. Attack timing and damage remain unchanged.
- The [interactive pose preview](assets/visuals/review/character-overhaul-v2/preview.html), [Reaper dark](assets/visuals/review/character-overhaul-v2/reaper_static_pose_review_dark.jpg) and [light](assets/visuals/review/character-overhaul-v2/reaper_static_pose_review_light.jpg) sheets, and [Bat dark](assets/visuals/review/character-overhaul-v2/bat_static_pose_review_dark.jpg) and [light](assets/visuals/review/character-overhaul-v2/bat_static_pose_review_light.jpg) sheets show the poses at review scale.
- [Run-cycle review board and source image](assets/visuals/review/character-motion-cycle-v3/reaper_run_cycle_balanced_phone_scale.jpg) show the redesigned Reaper poses at phone scale. The [earlier motion-cycle review](assets/visuals/review/character-motion-cycle-v1/README.md) remains available.

## Approved Skeletal Bat art

- The eight-pose Skeletal Bat atlas is now the default after phone review. The regular Cavern Bat and Reaper remain unchanged.
- Its target visible height is about 58px, slightly larger than the regular Cavern Bat's 52px target.
- The atlas changes only the Skeletal Bat drawing. Its existing 2 HP, flight and dive behavior, telegraph timing, and collision box stay unchanged. Procedural art remains the fallback.
- [Open the current game](https://newstandard710.github.io/grim-run/).

## Approved Bone Crawler art

- The four-pose crawl cycle is approved and enabled by default. The `?enemyReview=bone-crawler` link remains available as a focused review alias.
- At 2.5× its first review size, the animated silhouette is about 85–93px high and 112–131px wide, close to a large dog beside the 120px Reaper. Its hitbox is now 95×105px, also 2.5× larger, and shares the art's ground baseline.
- The game mirrors each pose horizontally so the crawler faces right as it moves. The source PNGs remain unchanged.
- One HP, ground movement, ledge stopping, spawn schedule and attack logic remain unchanged.
- To reach a crawler quickly, use Pause → God Mode → Teleport to 5,000m, confirm, then continue until one enters view. Crawlers appear in the Underworld.
- [Open the Bone Crawler phone-review build](https://newstandard710.github.io/grim-run/?enemyReview=bone-crawler).

## Approved Ember Imp art

- The six-pose atlas is approved and enabled by default; its four running poses face right, followed by the existing fire-warning and release poses.
- The visible target is about 55px tall. The atlas shares one foot line and keeps the existing 38×42 hitbox, 2 HP, movement, 470ms warning and fireball timing unchanged.
- The warning and release are character poses; the launched fireball remains a separate effect. Missing or invalid art keeps the procedural Imp visible.
- To reach one quickly, use Pause → God Mode → Teleport to 7,500m, then continue into the Underworld until an Imp enters view.
- [Open the Ember Imp phone-review build](https://newstandard710.github.io/grim-run/?enemyReview=ember-imp).

## Enemy art

- Both ground enemies now appear with their approved sprites during regular play. Their former single-enemy and combined review links remain available.
- [Open the combined Bone Crawler and Ember Imp route](https://newstandard710.github.io/grim-run/?enemyReview=both).

## v0.10.9: Subtle Reaper Run Head Bob

- Adds a small, smooth vertical bob to the Reaper during the eight-pose run cycle so the head does not look locked in place.
- The bob is 1.75px in either direction and follows both steps of the stride. It changes only the drawn sprite; character size, collision, world speed, and the 0.67-second cycle stay unchanged.
- Chromium checks measure the bob across the complete run cycle at phone dimensions, alongside the existing rendered-pixel and registration checks.

## v0.10.8: Reaper Run Cycle Rework

- Replaced the visibly uneven run drawings with eight balanced poses. The eye and ground anchors stay registered; the torso and scythe hold steady while the legs alternate more clearly.
- The eight poses play at 12fps for the same approximately 0.67-second stride as the former twelve-pose, 18fps cycle. The 24fps experiment is removed; world speed and gameplay timing do not change.
- The new transparent runtime frames total about 233KB. Browser checks measure decoded character pixels, anchors, visible height and all eight poses on the mobile-sized game canvas.

## v0.10.7: Smoother Reaper Motion

- The damage pose now renders at the same 120px visible height as the normal Reaper, so the Reaper no longer appears to shrink when hit.
- The existing twelve-pose run cycle now plays at 24 frames per second instead of 18. The same artwork is reused; this changes only the visual cadence, not player speed or gameplay timing.
- Chromium checks measure decoded hurt/run pixels at phone gameplay scale and verify all twelve running poses. Damage rules, controls, collisions, and progression remain unchanged.

## v0.10.6: Tip-First Scythe Swing

- Corrected the first forward scythe sweep so the pointed cutting tip leads into the attack and the blunt spine trails. The Reaper pose, size, and four-beat timing remain stable.
- The previous 260ms attack timing, reach, damage, controls, slide fix, run cycle, and other art are unchanged.
- The browser check verifies the replacement PNG and captures all four swing poses at phone gameplay scale.

## v0.10.5: Reaper Action Polish

- Replaced the too-small slide drawing with a natural knee-bent pose that keeps the hood, head and torso at normal game scale. Raised low branch openings from 48px to 76px; standing still collides while the unchanged 56×29 ground-slide collider clears.
- Rebuilt the scythe strike with four distinct wind-up, sweep, impact and follow-through drawings. The sequence uses the existing 260ms action window; attack timing, reach and damage are unchanged.
- The twelve-pose run cycle, Bat art, controls and progression are unchanged. New action PNGs have transparent backgrounds and per-file size/SHA-256 checks.
- Regression and real-Chromium tests verify slide clearance, unchanged collision boxes, each scythe frame's pixels, anchors and visible movement on a phone-sized game canvas.

## v0.10.4: Sprite Motion Polish

- The illustrated Reaper now cycles through four distinct running poses, and Cavern Bats use a four-pose wing flap while flying. Jump, fall and hurt artwork is preserved.
- Replaced the flat slide silhouette with a compact 40px crouch, leaving 8px of visual margin inside the existing 48px overhead clearance. The 56×29 collision box is unchanged.
- Scythe attack now uses a cleaned pose without a second slash effect; its visible height is normalized to the standard Reaper scale to prevent an attack-only size jump.
- Startup loads 18 character textures for state poses and the new movement cycles. PNG detail is retained; the new slide and attack sources have transparent alpha.
- No gameplay mechanics, controls, progression or God Mode behavior changed. `?art=procedural` restores the v0.10.2 fallback; `?art=experimental` opens the legacy SVG art.
- Regression and Chromium smoke checks cover run/flap frame changes, ground anchors, slide clearance, fallback behavior and God Mode. Android readability and performance still need device playtesting.

## v0.10.3: Character Visual Overhaul

The approved illustrated Reaper and Cavern Bat became the default visual set, with transparent PNG poses for the Reaper's gameplay states and Bat neutral/dive states. The prior procedural presentation remains available with `?art=procedural`. The v0.10.4 update adds motion poses and corrects the slide and attack scale issues reported during playtesting.

## v0.10.2: God Mode Playtest Tools

- **Half speed:** Enable God Mode in Pause, then toggle the **0.5× SPEED** button at bottom center. Slows gameplay physics, enemy/projectile movement, cooldowns and animation to half speed. Free, unlimited and instantly toggled. Turning off God Mode restores normal speed.
- **Distance Teleport:** While God Mode is enabled, Pause displays a slider and buttons for **500m–20,000m in 500m steps**. Requires confirmation; cancelling remains paused; confirming places the Reaper on safe solid ground and resumes immediately **without a countdown**. Teleporting to 5,000m or beyond initializes the Underworld and Bone Crossbow, marks earlier vendors as passed and clears Rewind history. Skipped Souls/vendors give no rewards, and any Souls subsequently collected in a teleport-assisted test run are visual-only (not permanently banked).
- **Best-score protection:** Runs that use teleport cannot write a legitimate personal-best score.
- **Visual-art safeguard:** The v0.10.1 painted-style SVG character art is not aesthetically accepted. Until an actual illustrated frame set passes gameplay-scale art review, the older procedural Reaper and Bat are the **default**; use `?art=experimental` to opt into the rejected SVG version for A/B comparison.
- **Tests:** `tests/godmode-tools.cjs` covers 64 teleports, simulation-wide half-speed, confirmations, score safety and save preservation. Other gameplay tests and the real Chromium browser UI suite also run in CI.

**Note:** Reaper and Bat visual replacement is still in production, not included in v0.10.2. The God Mode tools are being released first so subsequent art testing can be substantially faster.

## v0.10.1: Green-square sprite hotfix

Fixes a live Android Chrome bug where the illustrated Reaper was replaced by Phaser's green missing-texture placeholder. The Phaser loader now slices sprite atlases from the actual raster image rather than passing the Phaser Texture object. Frames and sprite keys are verified before suppressing the previous procedural renderer; if art is unavailable, the game continues with the original Reaper.

A new actual Chromium smoke test (`tests/browser-visual-smoke.js`) runs in GitHub Actions and checks that the Reaper and Bat are real, nonblank Phaser sprite sheets. Use `?art=off` to force the prior renderer if diagnosing visual performance.

## v0.10.0: The Reaper Reborn

Our first major visual refresh establishes **Macabre Storybook Fantasy**, an original illustrated dark-fantasy style with strong silhouettes, bone/teal Reaper accents and moody violet bats.

- A **16-frame SVG Reaper atlas** includes five run poses, two idle poses, jump, fall, low-profile slide, scythe strikes, crossbow, hit, death and hover poses.
- An **eight-frame Cavern Bat atlas** adds wing flaps and dive frames.
- The new `assets/visuals/visual-system.js` loads and rasterizes the atlases once in Phaser, maps animation poses to existing gameplay, and pools up to 12 bats.
- Rewind animates historical art poses deterministically from its saved time and states. Scythe trails, wings and bat warnings remain tied to the original gameplay logic.
- New art does not change collision boxes, controls, power balance or saved Souls. If an asset fails, the original geometric graphics remain a fallback; optional **`?art=off`** forces fallback for comparisons.
- **[View the animation showcase](assets/visuals/showcase.html)** or see the [art guide](assets/ART_DIRECTION.md). The showcase uses the actual game SVG frame sheets.
- The other enemies and scenery still use prototype drawings pending further visual updates.

## v0.9.1: Polish & Fairness

- Rewind now **plays real snapshot history backward at 3× speed**, with tinted time-reversal effects and temporarily disabled gameplay input. Five seconds of history animates in about 1.7 seconds.
- **God Mode ignores the Rewind cooldown**, but still needs a fresh eight-second history and respects all irreversible vendor/Soul/portal boundaries.
- **Reliquary Reset All** refunds the full invested Soul cost and charges a 1-Soul fee. You must have **at least 1 unspent Soul already in your wallet**; an explicit confirmation is required, and the save is updated immediately.
- Pause → **Quit Run** now asks for confirmation before abandoning a run.
- **Bow and Jump** are 12px higher; Attack and Slide stay in place.
- **Brittle Bones** gains 50m per added level: 150 / 200 / 250 / 300m.
- Uphill **rock and fire** obstacles now require a basic-jump trajectory to be physically clearable before they can spawn; procedural hill shape and other obstacle mechanics are preserved.

## v0.9.0: Death's Reversal

**Rewind Time** is now an Angel vendor power with a dedicated upper-left control (desktop: **R**). The first level moves the run back **5 seconds** with a **60-second** cooldown; each added level increases rewind by 1 second and decreases cooldown by 5 seconds:

- Level 1: 5 seconds / 60-second cooldown
- Level 2: 6 seconds / 55-second cooldown
- Level 3: 7 seconds / 50-second cooldown
- Level 4: 8 seconds / 45-second cooldown

Rewind restores the Reaper's physics, HP, active enemy and projectile state, obstacles, gold, and the mutable terrain bridges made by Brittle Bones. Souls, vendor purchases and portal transitions are irreversible timeline boundaries; rewind cannot undo them. Rewind cooldown itself is never reversed.

**God Mode** temporarily grants max-level Rewind to facilitate tests and returns to the real level when toggled off. The button shows a history-ready or cooldown counter when Rewind is unavailable. Snapshots are collected only when the ability is active.

## v0.8.3 enemy patch

The enemy system was reworked following Android playtesting:

- Bats enter at the far-right **visible** edge and move toward the Reaper at a much slower *screen-relative* speed than the terrain, with a longer, telegraphed swoop.
- Bats spawn every **55–78m** through the Underworld, with normal bats initially and two-hit skeletal bats in late Hell.
- A separate ground-enemy schedule produces **Bone Crawlers** and later **Ember Imps** every **115–165m**, independently of bat encounters.
- Ground enemies approach more slowly and have brighter, easier-to-recognize silhouettes.
- Fixed a cleanup bug where enemies could spawn beyond the screen and be removed without ever being seen.
- Validated with 300 seeded generation checks and five instrumented simulated full runs in `tests/encounter-reliability.cjs`.

The manual Bone Crossbow, 3-Soul revival, Grave Glide and chest cutscene are unchanged.

## Controls and objective

- **Attack**: lower left, swing your scythe.
- **Bone Crossbow Fire**: upper left, appears after obtaining the crossbow at the 5,000m portal. **Manual fire**, with priority auto-aim. F on desktop.
- **Jump / Slide**: upper/lower right; sliding then jumping enables air-tuck.
- **Rewind**: upper-left when unlocked; desktop R.
- **Pause**: upper right; God Mode grants temporary fully upgraded Rewind and invulnerability.

Survive hazards, vendors and combat across procedural terrain to the 5,000m Underworld portal, collect Souls near 4,850m and 9,500m, and reach the 9,999m final gate. In God Mode, continue through the extended Boss Biome to explore its scenery through 20,000m.

## v0.8.2 changes

- **Revival:** Once per run on death, spend **3 banked Souls** (current-run collected Souls first) to recover at **3/3 HP**, keep run progress and powers, and resume after a **3-second countdown**. Decline or insufficient Souls results in ordinary game over.
- **Grave Glide:** Fourth permanent Reliquary tree, adding +0.15, +0.30 or +0.45 seconds of maximum slide duration. Levels cost 5, 10, and 25 Souls. Existing saved Souls and upgrade trees are preserved.
- **Bone Crossbow:** Replaces the Soulcaster gun's appearance and automatic firing. Open an ancient chest in a skippable portal-acquisition scene; then use the new button above Attack to manually shoot. Aiming automatically prioritizes flying enemies; Rapid Fire, Power Shot and Chain Shot still work.

## Existing gameplay

- Guaranteed 2–3 late air-tuck obstacles and reliable bat/crawler/imp spawns from v0.8.1.
- Infernal Boots provide lava reduction and timed fire shield. Devil purchases remain 2 HP for initial boots/wings and 1 HP for later levels and all crossbow upgrades.
- Three prior permanent Reliquary trees: Boneheart (3–6 starting HP), Grave Wealth (0–6 starting gold), Death's Leap (+5/+10/+15% jump height).
- Collected Souls immediately banked into browser-local storage; best score is also saved.

## Running and testing

Serve `index.html` with GitHub Pages to load the external art folders and the Phaser 3.90.0 CDN dependency. Opening a bare HTML file without the companion `assets/` folder leaves the old art fallback. This is not yet a packaged Android APK.

Regression checks (Node.js, no dependencies):

```sh
node tests/encounter-reliability.cjs
node tests/survival-crossbow.cjs
node tests/rewind.cjs
node tests/polish-fairness.cjs
node tests/visual-foundation.cjs
node tests/godmode-tools.cjs
```

The source and simulated logic tests pass; actual Android landscape playtesting is still required to validate visual presentation, input positions, and pacing.

Next: review the complete surface-to-Underworld art sequence and smooth transitions on a landscape phone, check the 5,000–6,000m crash fix, and confirm God Mode travel beyond 9,999m.
