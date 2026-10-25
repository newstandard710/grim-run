# Grim Run

A landscape, mobile-first side-scrolling action roguelike starring the Grim Reaper.

**Current playable build: v0.11.12 — Concept Foregrounds**

- The Reaper, Cavern Bat, Skeletal Bat, Bone Crawler and Ember Imp art are approved and enabled by default. The procedural fallback remains available if an art file fails to load.
- Approved forest, foothills, and mountain concept art now covers the full above-ground route through 5,000m.
- The Underworld now moves through caves (5,000–6,000m), crystal caverns (6,000–7,000m), skyless Ashlands (7,000–8,000m), lava (8,000–9,999m), and the lava-lit castle Boss Biome (9,999–20,000m).
- All eight approved biome concepts are the only background art. The old procedural sky, mountain, tree, cave, ash, and lava overlays have been removed. Image layers stay fully opaque through the gently drifting 360m crossfades; at 5,000m the portal switches directly from Tundra to Caves. Ground colors follow the same transitions.
- The approved biome paintings provide the natural foreground at the foot of the play area. The terrain body is lightly shaded so that artwork remains visible through it; repeated rock texture tiles are removed.
- Terrain outlines still show the running path. Ground heights, collision shapes, hazards and gameplay are unchanged.
- Biome crossfades define their own easing helper, preventing an out-of-scope function error from aborting background and ground rendering at fade boundaries.
- Surface backgrounds load first. Underworld backgrounds are loaded during the portal sequence, then replace and release the Surface textures to reduce memory use on phones.
- The game wakes Phaser's frame loop when returning to the page and before pause, resume, menu, new-run, and vendor-exit transitions. A visible-page watchdog restarts Phaser if active gameplay stops receiving update heartbeats. Starting a run also resets the camera to the Reaper's starting position.
- Terrain requests for already-generated ground now return without adding more chunks; God Mode extends the world in bounded chunks beyond the pre-generated normal course.
- Normal runs still finish at 9,999m. God Mode can continue past the finish and teleport in 500m steps through 20,000m.
- [Open the game](https://newstandard710.github.io/grim-run/).

- [Game HTML](index.html)
- [Development status and playtest checklist](PROJECT_STATUS.md)
- [v0.9.1 rollback branch](https://github.com/newstandard710/grim-run/tree/backup/v0.9.1)
- [v0.10.2 stable fallback](https://github.com/newstandard710/grim-run/tree/backup/v0.10.2)

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
