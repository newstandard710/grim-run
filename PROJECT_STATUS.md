# Grim Run — Project Status and Roadmap

**Current build:** v0.11.9 — *Biome Render Fix*. Biome blending now has its own easing helper, fixing the runtime error that stopped backdrop and ground drawing at crossfades. Optional biome loading also returns safely when a reduced host has no Phaser texture loader.

The user accepted the Reaper, regular Cavern Bat, Skeletal Bat, Bone Crawler and Ember Imp art. Their art, timing, scale and collision behavior stay unchanged during World & Atmosphere work.

**Release:** v0.11.9 — *Biome Render Fix*  
**Platform:** Landscape browser / Android prototype using Phaser 3.90.0, `index.html` and transparent PNG character art  
**Source:** `main/index.html`  
**Rollback:** `backup/v0.10.2` preserves the prior published game; `backup/v0.9.1` preserves the last fully user-tested pre-art gameplay version.  
**Verification:** The live v0.11.8 reproduction produced `ReferenceError: smooth is not defined` in the biome-weight renderer. The regression test exercises actual backdrop and ground drawing helpers at every surface and Underworld fade, the 641m location, and the direct 5,000m portal handoff; it passes in the Node VM. In the published v0.11.9 Chrome smoke test, the scene rendered through 7,000m with an animated background and no current-build console errors; the run also reached the first vendor at 666m and resumed to 709m. The God Mode test covers 20,000m, and the encounter suite checks continued play beyond 9,999m. Android device confirmation remains pending. Normal runs still finish at 9,999m; God Mode extends play and teleport through 20,000m.

## v0.11.9 — Biome Render Fix

- Added the easing helper inside the World Art module. The old crossfade code called `smooth()` even though the only same-named helper lived inside a separate script scope. At biome fades, the resulting `ReferenceError` aborted `drawScene()` before it could paint the background and Reaper.
- Made optional backdrop creation/loading return safely when a reduced test host has no Phaser texture manager or loader. The watchdog now checks timer API availability before starting or clearing its interval.
- Added `tests/world-biome-transitions.cjs`, covering every biome fade, the 5,000m portal hard cut, ground palettes, and the reported 641m location.
- **Next:** phone-review a fresh run around the first vendor and a God Mode run through the 6,500–7,200m crystal-to-Ashlands fade; verify movement, backdrop, and pause/countdown remain responsive.

## v0.11.8 — Runtime Loop Guard

- Vendor reward purchase or dismissal now wakes the Phaser loop, redraws the world after gameplay resumes, and refreshes the watchdog heartbeat.
- The existing recovery path now resumes a Phaser-paused scene as well as a sleeping scene.
- A one-second watchdog checks active gameplay states while the page is visible. After 2.5 seconds without an update heartbeat, it restarts the Phaser timestep and redraws the scene. It is removed when the scene shuts down.
- **Next:** phone-review a fresh run and a 6,500m God Mode teleport, including continuing after a vendor reward. This is the first fix aimed at the reported vendor-to-run handoff; user-device confirmation is still needed.

## v0.11.7 — Frame Loop Recovery

- Explicitly wake Phaser's loop on page visibility return, focus, and pageshow events, and before pause, resume countdown, menu, and new-run transitions.
- Redraw the scene on page return and menu/new-run transitions so a stopped loop cannot leave the previous canvas frame visible after the DOM changes.
- Reset the camera to the Reaper's starting position whenever a fresh run begins.
- The freeze trigger on the user's phone is still unconfirmed; the earlier staged texture loading did not resolve it. Next step is phone review of pause, resume, and starting a second run.

## v0.11.6 — Mobile Biome Loading

- Reduced the initial full-screen biome texture load from all eight backgrounds to the three Surface backgrounds. The five Underworld backgrounds load while the portal and chest sequence is playing, then replace and release the Surface textures.
- Backgrounds retain the existing drift and crossfades within each group. The Tundra-to-Caves boundary remains a direct portal handoff.
- Refresh the distance HUD before opening a vendor so the first vendor stop reports its actual meter value.
- **Next:** phone-review a run through the first vendor, then the portal handoff and later Underworld transitions. The reported freeze near 648m still needs user-device confirmation after this change.

## v0.11.5 — Portal Biome Handoff

- The surface remains fully Tundra on the approach. Crossing the 5,000m portal switches directly to fully formed Caves; that boundary does not crossfade.
- Other neighboring backdrops crossfade over 360m, with ground colors following those transitions.
- **Next:** confirm whether the stop near 630m was the expected vendor pause at 666m or a separate freeze, then phone-review the portal and route.

## v0.11.4 — Full World Biome Art and Terrain Streaming Fix

- Added approved Forest (0–900m), Foothills (900–2,300m), and Tundra (2,300–5,000m) concept backdrops alongside all five Underworld backgrounds.
- All eight backdrops drift gently and crossfade over 360m at biome boundaries. At 5,000m, the portal switches directly from Tundra to fully formed Caves. Ground palettes follow the same transitions.
- Fixed terrain generation that appended another 1,750px chunk each time per-frame callers asked for an already-covered range. Those calls now return immediately, and God Mode extends beyond the pre-generated normal course in bounded chunks.
- **Next:** phone-review the full route, especially the 5,000m portal, 5,700m area, all biome transitions, and God Mode exploration beyond 9,999m.

## v0.11.3 — Underworld Biome Expansion

- Added the approved concepts as game backdrops for 5,000–6,000m Underground Caves, 6,000–7,000m Deep Underground crystals, 7,000–8,000m skyless Ashlands, 8,000–9,999m Lava, and 9,999–20,000m Boss Biome.
- Backdrops drift at a restrained rate and crossfade through overlapping distance bands. Distinct parallax silhouettes, ambient particles and ground palettes add movement and variation while keeping the play lane readable.
- God Mode bypasses the 9,999m victory trigger, can continue through the Boss Biome, and can teleport from 500m to 20,000m in 500m steps. The normal finish remains 9,999m; travel beyond it is excluded from personal-best recording.
- Terrain extends ahead on demand for God Mode travel. After 20,000m, the Boss Biome presentation and safe ground continue for exploration.
- **Next:** phone review the portal arrival, biome boundaries, crystal/ash/lava/castle visibility, God Mode travel beyond the finish, and normal 9,999m completion.

## Completed enemy sprite phase

- **Skeletal Bat:** approved eight-frame art set in `assets/enemies/illustrated-v2/skeletal-bat/skeletal_bat_atlas_v1.png`, now the default. Its visible target is about 58px, slightly larger than the regular Cavern Bat's 52px target.
- The atlas covers four flap poses, the existing dive tell and dive, hit recoil, and defeat. Its 2 HP, flight/dive behavior, telegraph timing, collision box and procedural fallback are unchanged.
- **Bone Crawler:** four accepted crawl poses now render by default. The user approved the 2.5× scale and 95×105 hitbox; the runtime mirrors its art to face right. Its one HP, ground movement, ledge stopping, spawn schedule and attack logic are unchanged.
- **Ember Imp:** six accepted poses now render by default: four right-facing run poses at 8fps, a fire-warning pose and a short release pose. The visible target is about 55px tall with one shared foot line. Its 2 HP, 38×42 hitbox, movement, warning and fireball behavior are unchanged; the projectile remains a separate effect.
- **Next:** phone-review Tundra mountains across the 2,000–3,000m ascent. After approval, continue the summit/stars treatment from 3,000–5,000m, then Ashlands, scenery, vendors and portal presentation.

## Main Reaper motion cycle v4

- Eight new transparent run drawings replace the twelve-pose cycle that felt too fast and uneven. The first verified pose loads before gameplay can start; the remaining seven load next, followed by the larger action and Bat artwork.
- The cycle advances through eight registered leg positions at 12 fps, for the same approximately 0.67-second stride as the earlier twelve-pose, 18fps cycle. A 1.75px rendered-only bob now follows both footfalls; world movement is unchanged.
- The eight optimized runtime PNGs total about 233 KB. Their full transparent source sheet and a phone-scale review board are preserved under `assets/visuals/review/character-motion-cycle-v3/`.
- The browser test decodes the actual PNG pixels and measures eye alignment, ground position, visible height, and eight distinct rendered poses at mobile gameplay scale. Collision geometry remains untouched.
- After phone review found the Reaper too small, standard poses now render at the established 120px target (about 1.9× the prior review scale); the slide pose is 47px tall inside the unchanged 48px clearance. All poses retain the shared ground anchor.
- The slide pose now bends at the knees while keeping the head/torso at normal art scale. Its visible height is about 74px. Low branch openings are raised from 48px to 76px; standing still collides against the 79px standing body. The 42×79 standing and 56×29 sliding collision boxes remain unchanged.
- The scythe strike uses four distinct drawings for wind-up, sweep, impact, and follow-through across the existing 260ms action window. The current v0.10.6 sweep pose leads with the sharp point. Damage, reach, controls, and progression are unchanged.
- Previous illustrated art remains available through `?art=illustrated`; procedural fallback remains available through `?art=procedural`.
- The [interactive pose preview](assets/visuals/review/character-overhaul-v2/preview.html), [new run-cycle review board](assets/visuals/review/character-motion-cycle-v3/reaper_run_cycle_balanced_phone_scale.jpg), and source PNG document the visual direction.
- Reaper and regular Cavern Bat animation quality accepted by the user on October 24, 2026.

## v0.10.9 — Subtle Reaper Run Head Bob

- Added a smooth 1.75px up/down sprite offset, twice per stride, to give the head a natural running bob. The sprite's dimensions and collision position are unchanged.
- The eight run drawings, 12fps animation, 0.67-second stride, world movement, damage pose, controls, and progression remain unchanged.
- The user accepted the Reaper run cycle and regular Cavern Bat animation on October 24, 2026.
- **Verification:** local regression, image integrity, actual Chromium mobile-render checks, and Pages deployment passed.

## v0.10.10 — Skeletal Bat Art Review

- Added an eight-pose Skeletal Bat atlas for the four-frame flight cycle, telegraph, dive, hit reaction, and defeat.
- The sprite was opt-in during review. The user accepted it on October 24, 2026; v0.10.11 promotes the art to the default game. Its 2 HP, flight behavior, collision box, and procedural fallback stay intact.
- **Verification:** Regression, exact PNG integrity, phone-sized Chromium/Phaser rendering, Pages deployment, and user phone review passed.

## v0.10.11 — Bone Crawler Art Review

- Added four transparent crawl poses based on the approved Reaper and Cavern Bat PNG style references. They render at about 34–37px high and 45–52px wide.
- Bone Crawler art is loaded only with `?enemyReview=bone-crawler` until the phone review is accepted. The 38×42 collision box, one HP, ground movement, ledge stopping, spawn cadence and combat remain unchanged.
- The previously reviewed Skeletal Bat atlas is now the default. Missing or invalid Bone Crawler PNGs retain the procedural crawler.
- **Verification:** Full regression, exact PNG integrity, phone-sized Chromium/Phaser rendering, and Pages review deployment passed. User phone review is pending.

## v0.10.12 — Bone Crawler Scale Review

- Phone feedback found the Bone Crawler too small beside the Reaper. Its existing four poses now render at 2.5× the previous scale, with an approximately 85–93px visible height and 112–131px width.
- Increased its hitbox from 38×42 to 95×105 (2.5× each dimension), aligned its bottom with the ground/art baseline, and enlarged the procedural fallback to match.
- One HP, ground movement, ledge stopping, spawn schedule and attack behavior remain unchanged. Art is still opt-in pending the next phone review.
- **Verification:** Full regression, exact PNG integrity, actual phone-sized Chromium/Phaser rendering, and Pages deployment passed. User phone review is pending.

## v0.10.13 — Bone Crawler Direction Review

- Mirror the four Bone Crawler poses horizontally at runtime so its head faces right, matching its movement direction. The source PNGs, 2.5× scale, 95×105 hitbox and ground alignment stay unchanged.
- **Verification:** Full regression, exact PNG integrity, actual phone-sized Chromium/Phaser rendering, and Pages deployment passed. User phone review is pending.

## v0.10.14 — Ember Imp Art Review

- Added a six-pose transparent Ember Imp atlas: four running poses, fire warning, and release. Running poses face right; attack poses turn toward the Reaper.
- The art remains opt-in at `?enemyReview=ember-imp`. A missing or invalid atlas retains the procedural Imp.
- The 55px art target is aligned to the existing ground position. HP, 38×42 hitbox, movement, 470ms warning, fireball launch/cooldown, and projectile rendering remain unchanged.
- **Verification:** Regression, exact PNG integrity, actual 950 × 430 Chromium/Phaser rendering of all six poses, and Pages deployment passed on October 25, 2026. User phone review is pending.

## v0.10.15 — Combined Enemy Art Review

- Added `?enemyReview=both` so the Bone Crawler and Ember Imp art can render together in the same run. Their individual review aliases remain available, and both retain their procedural fallback.
- **Verification:** Combined-route regression, exact PNG integrity, 950 × 430 Chromium rendering of both sprites together, and Pages deployment passed. The user approved both sprites for default play. Gameplay and collision behavior are unchanged.

## v0.11.2 — Tundra Art Review

- Promoted the user-approved foothills background and textured ground to the default across the transition from about 900m through 2,300m. The opening forest transitions into sparse pines, rounded slopes, rocky ground and distant ridges.
- Added the `?worldReview=tundra` preview from 1,900–3,400m, covering the requested 2,000–3,000m mountain ascent. Snow caps attach to the exact ridgeline apex and remain inside each mountain face; the previous detached pale outcrops were removed. Frosted ground detail and sparse windblown snow support the transition.
- Terrain, ground heights, collision shapes, obstacle placement, enemy behavior, controls, progression, vendors, portal, and save data are unchanged. The foothills review URL remains a compatibility alias for the accepted default art.
- **Verification:** CI and phone-scale visual review pending. The preview route and visual smoke check compare identical seeded terrain and player state.

## v0.11.1 — Foothills Art Review

- Added a gradual forest-to-foothills background, sparse tree line, rolling hill layers, and rocky ground detail across roughly 900–2,300m.
- The user approved the foothills art; it is now the default. `?worldReview=foothills` remains a compatibility alias.
- Terrain, ground heights, collision shapes, obstacle placement, enemy behavior, controls, progression, vendors, portal, and save data are unchanged.

## v0.11.0 — Opening Forest Art Review

- Added a layered illustrated forest background with moonlight, distant ridgelines, three parallax pine layers, low mist and restrained fireflies.
- Added muted moss along the ground edge and fine stone, root and soil-strata details. The review route applies these drawings only through the opening 1,200m.
- The user approved the opening forest at phone scale; it is now the default through the opening 1,200m. `?worldReview=opening` remains as a compatibility alias.
- Promoted the accepted Bone Crawler and Ember Imp illustrations to the default game. Their procedural fallbacks remain available if an art file fails to load.
- Terrain, collision, enemy behavior, controls, progression, vendors and portal logic are unchanged.
- **Verification:** Full-repository regression, PNG asset integrity, 950 × 430 real-Chromium rendering and Pages deployment passed. The user approved the opening forest art.

## v0.10.8 — Reaper Run Cycle Rework

- Replaced the uneven twelve-pose cycle with eight clearer alternating running positions, keeping the torso, eye, and scythe steadier between poses.
- Plays at 12fps for a 0.67-second cycle, restoring the slower stride the user preferred while preserving world movement and the successful full-size damage pose.
- **Verification:** regression, PNG integrity, actual Chromium pixel checks for all eight poses, and the user's phone review passed. The user accepted the Reaper and Cavern Bat art on October 24, 2026.

## v0.10.7 — Smoother Reaper Motion

- Matched the hurt pose's visible pixel height to the normal 120px Reaper target while keeping its existing ground anchor and damage animation.
- Increased the existing twelve-pose run cycle from 18 to 24 frames per second. Its images, stride distance, world movement, controls, and all gameplay timing remain unchanged.
- **Verification:** regression, asset integrity, and actual Chromium pixel checks for the hurt and run poses passed. Phone testing later found the faster cadence felt worse; v0.10.8 replaces it.

## v0.10.6 — Tip-First Scythe Swing

- Replaced the first forward scythe sweep pose so the sharp point leads through the swing and the blunt spine trails behind.
- Reaper scale, body pose, anchor, four-pose sequence, 260ms attack period, reach, damage, and controls are preserved.
- Slide art and 76px branch opening are unchanged.
- **Verification:** pending local regression, PNG integrity, and actual Chromium rendering for this revision.

## v0.10.5 — Reaper Action Polish

- Replaced the undersized slide artwork with a natural low slide; the head and torso keep their normal game size while the knees bend. The scythe trails low behind the cloak.
- Raised low branch openings to 76px to fit the new 74px slide silhouette with a small visual margin. The opening remains smaller than the 79px standing collider, so the player must slide; standing/sliding collision boxes are unchanged.
- Rebuilt the scythe strike as four visually distinct poses over the same 260ms attack period. Attack timing, reach, damage, and input behavior are unchanged.
- **Verification:** Local regression suites pass, including 300 seeded gameplay worlds; actual Chromium rendering is pending in GitHub Actions. Main-page and phone checks follow after CI passes.

## v0.10.4 — Sprite Motion Polish

- Four distinct Reaper run poses cycle at 10 fps; Cavern Bat wings cycle through four poses at 9 fps. Jump, fall and hurt artwork is retained.
- Slide uses a 40px-tall crouched silhouette and remains anchored to the existing ground baseline. Existing 56×29 slide and 42×79 standing collision boxes are unchanged; 8px of visual margin remains below the 48px obstacle clearance.
- Scythe attack uses the cleaned transparent pose without its own cyan slash overlay; its visible height matches the standard Reaper scale.
- Runtime loads 18 illustrated textures. Automated regression coverage confirms run/flap texture changes and unchanged geometry. Android readability and performance remain for device playtesting.
- No combat timing, progression, controls, or God Mode behavior changes. The v0.10.2 procedural character fallback remains available with `?art=procedural`.

### v0.10.4 phone playtest

- [ ] Reaper visibly cycles while running; boots remain grounded.
- [ ] Slide silhouette appears natural and clears the unchanged overhead profile.
- [ ] Bat wings flap while flying; dive pose and hitboxes remain correct.
- [ ] Scythe strike does not visibly grow or double-render its slash.
- [ ] Check sprite readability and performance on a landscape phone.

## v0.10.3 — Character Visual Overhaul

- The approved illustrated Reaper and Cavern Bat PNGs are the default visual set. The previous procedural v0.10.2 presentation remains available with `?art=procedural`; the earlier SVG experiment remains at `?art=experimental`.
- Runtime uses state-matched static images: Reaper idle, run, jump, fall, slide, scythe attack, crossbow, hurt, death and hover; Bat neutral flight and dive. No frame animation is introduced in this release.
- Packaged 25 transparent PNG poses and references; Phaser loads only the 12 runtime textures to keep the additional production poses out of startup loading.
- Reaper gameplay target is 120px visible height. Slide art is 29px high and aligned to ground; existing standing **42×79** and sliding **56×29** collision boxes remain unchanged.
- No changes to movement, combat rules, progression, controls, or God Mode. The prior version is recoverable from `backup/v0.10.2`.
- CI passed for regression tests and actual Chromium loading, pose selection, feet anchors, slide clearance, procedural fallback and God Mode controls. Phone-scale legibility and performance remain for device playtesting.

### v0.10.3 phone playtest

- [ ] Menu shows `v0.10.3 · ILLUSTRATED SPRITES`; Reaper appears in the menu and run.
- [ ] Reaper idle, run, jump, fall, slide, scythe attack, crossbow, hurt, death and hover poses follow gameplay state.
- [ ] Reaper boots align with terrain; low slide clears overhead hazards within the existing slide profile.
- [ ] Cavern Bats use the illustrated neutral pose and dive pose, with existing hitboxes and warning cues.
- [ ] `?art=procedural` restores the v0.10.2 fallback; `?art=experimental` remains available.
- [ ] Check readability, load time and frame rate in Android landscape, especially on a slower connection and during multiple bat encounters.

## v0.10.2 — God Mode Playtest Tools (complete)

**Scope adjustment:** God Mode tools can be released safely now. The requested Reaper and Bat visual redesign is **NOT approved or published** in this build. The previous SVG characters were rejected as insufficiently polished, and the next illustrated concept approach still needs proper transparent production poses and real-device art review. We must not substitute a promo poster or low-quality cropped concept for finished animation art.

- **God Mode Slow Time:** New bottom-center button toggles the complete gameplay simulation to **0.5× speed**. No cooldown, duration or Soul cost. Works on movement, timers, cooldowns, physics, enemy animations, projectiles, and Rewind playback. Switching God Mode off disables Slow Time automatically. Pause and menus remain normally responsive. Hidden if God Mode is off.
- **God Mode Distance Teleport:** From Pause, reveal slider and ±500m controls, selecting **500m to 9,500m in 500m increments**. Confirmation required. Cancel returns to pause. Confirm puts the Reaper onto safe ground near the target **without countdown**. Teleports are limited to an active run with God Mode enabled.
- **World-state synchronization:** Portal boundary at 5,000m is traversed programmatically, giving the crossbow and using Underworld terrain/background; no portal/chest animation. Prior vendors are marked passed so no skipped upgrades or healing deals are granted. Enemies, active projectiles, generated ordinary obstacles and visual warnings are cleared near relocation; new spawn cursors are placed safely ahead. Rewind snapshots cannot cross teleport. Existing banked Souls are never duplicated; skipped pickups are not collected, and **any Soul touched later in a teleport-assisted test run remains visual-only and cannot add to the persistent Soul wallet or revival balance**.
- **Scores:** Teleport-assisted runs are disqualified from writing `grim-run-v03-best` on death or victory. Other persistent Soul/reliquary records retain their normal rules. The cheat flag resets on a new run.
- **At v0.10.2:** v0.10.1's character drawings were rejected, so the procedural Reaper and Bat showed by default. The later illustrated PNGs and the v2 motion cycle supersede that temporary art fallback.
- **QA:** `tests/godmode-tools.cjs` passes 64 destinations across eight procedural seeds, forbidden destinations, UI confirmation/cancel, God Mode scope, 50% simulated clock/movement, portal/crossbow synchronization and score protections. All existing gameplay regression suites pass. Real Chromium game/Pause controls are additionally tested in `tests/browser-visual-smoke.js` on CI.

### Original v0.10.2 art status (superseded)

The new design target is a **lean, frightening, painted Grim Reaper with a legible scythe and expressive trailing fabrics**, and an **organic membranous Cavern Bat with anatomically readable body and wings**. The game-art production pipeline must yield distinct consistent transparent sprites for running/jumping/sliding/scythe and bat flapping/diving before the visual replacement is allowed. Concept-only art and frame extraction samples remain separate until that bar is met. This reverses the v0.10.0 mistake of shipping unattractive artwork on technical correctness alone.

### v0.10.2 phone playtest

- [ ] Menu says `v0.10.2`; ordinary procedural Reaper/Bat appear by default.
- [ ] Pause > God Mode reveals teleport selection, slider snap in 500m increments and a clear confirmation.
- [ ] Cancel teleport keeps the game paused.
- [ ] Confirm 500m, 4,500m, 5,000m, 5,500m and 9,500m: safe landing near selected meter, correct biome and crossbow behavior, no countdown.
- [ ] Toggle bottom-center Slow Time on and off during God Mode; visibly slows Reaper, terrain approach, enemy motion and animations by half.
- [ ] Switch off God Mode: Slow Time button disappears and speed returns to normal.
- [ ] Teleported run does not update personal-best record; Souls are not awarded for skipped milestones.
- [ ] Revive, Rewind, vendors, terrain, encounters and legitimate non-teleported runs remain unchanged.

## v0.10.1 — Missing-Texture Hotfix

**Reported on Android Chrome:** Game started and showed only a small green outlined square at the Reaper collision position instead of the new illustrated character. This is the characteristic Phaser missing-texture icon.

**Root cause:** `TextureManager.addSpriteSheet(newKey, sourceTexture, config)` received a Phaser Texture instead of the source HTML image/canvas. For a new sprite sheet key, Phaser requires the actual raster image (`sourceTexture.getSourceImage()`). The runtime incorrectly set `reaperReady=true` even when Phaser returned its missing-texture fallback, suppressing the previous procedural Reaper.

**Fix:** Pass `getSourceImage()` for both Reaper and Cavern Bat; validate source dimensions and presence of necessary frames (0, 8 and 15 for Reaper; 0, 4 and 7 for Bat), and verify the resulting sprite has the correct texture key and isn't `__MISSING`. If ANY check fails, keep the legacy procedural renderer instead of hiding the Reaper. Destroy partial sprite allocations on error.

**New real-browser QA:** `tests/browser-visual-smoke.js` launches actual Chromium, loads the game with Phaser, checks sprite textures and non-transparent SVG raster pixels, verifies Reaper visibility in a real running scene and exercises `?art=off`. `.github/workflows/browser-render.yml` executes the test on new PRs and pushes in GitHub Actions in addition to the five Node/gameplay and SVG parsing tests.

**Android verification:** Refresh the GitHub Pages game (force cache reload if needed) and confirm the menu says `v0.10.1`. Check that the Reaper is illustrated instead of the green missing-texture square; bat appearance and performance still require phone inspection.

## v0.10.0 — The Reaper Reborn (Visual Foundation)

**Design:** *Macabre Storybook Fantasy*, an original gothic-cartoony illustration style with ivory bone, dark navy robes, teal spectral eyes, worn scythe, magenta inner robe, and expressive poses. See [art guide](assets/ART_DIRECTION.md).

### Shipped game artwork and new animation system

- Original, authored SVG Reaper atlas: **16 coordinated poses**, 768 × 768px, 192px cells. Covers two idle poses, five run poses, jump, fall, physically narrow slide pose, two scythe attack poses, crossbow fire, hit, death and wing-hover.
- Original, authored SVG Cavern Bat atlas: **eight wing and dive/hit/death frames**, 640 × 256px, 160px cells. Bat wings, head, eyes, ears, body and legs remain consistently illustrated across frames.
- Runtime `assets/visuals/visual-system.js` rasterizes each SVG atlas into a fixed Phaser texture **once at load**, then creates an animated Reaper sprite and a **12-bat reusable sprite pool**.
- Animation frames are selected from the actual gameplay state and elapsed time, so Rewind shows the appropriate old pose when snapshots play backward. Player input, jump physics, hitboxes, ability durations and economy are untouched.
- Scythe swing produces a refined spectral arc that lines up with the existing collision-active interval. Wings remain shown for existing power levels. Bat's threat-warning circle stays visible with the new artwork.
- Asset errors leave the original procedural Reaper and Bat renderers available independently. For comparison/troubleshooting, add **`?art=off`** to the game's URL to force classic procedural art without changing any save data.
- An optional mobile [animation showcase](assets/visuals/showcase.html) displays actual game sprite atlas frames. Use it to assess character silhouette and frame continuity without a full run.
- World geometry, backgrounds, Soul platforms, enemy spawn/combat, health, rewards and v0.9.1 Rewind gameplay unchanged.
- Skeletal Bat, Crawler, Imp, vendors, portal, obstacles and world scenery remain procedural placeholders until subsequent art passes.

### Source layout

- `index.html` — gameplay and art visual-system include.
- `assets/visuals/visual-system.js` — Phaser loader, deterministic pose mapper and sprite pool.
- `assets/visuals/showcase.html` — self-contained browser/phone art lab for Reaper and Bat animation.
- `assets/characters/reaper/reaper-sheet.svg` — Reaper 16-frame vector atlas.
- `assets/enemies/cavern-bat/bat-sheet.svg` — regular Cavern Bat 8-frame vector atlas.
- `assets/ART_DIRECTION.md` — original art guide, palette names and frame-map reference.
- `tests/visual-foundation.cjs` — art content, frame mapping, loaded-texture, sprite pool, slide-foot-anchor and fallback checks.

### Acceptance checklist (Android landscape)

- [ ] Menu displays **v0.10.0**, previous Souls/Reliquary remain unchanged.
- [ ] Illustrated Reaper appears after starting (and in the menu background); not the old geometric Reaper.
- [ ] Running body/robes and scythe animate consistently; jump, fall, slide, attack, crossbow, hit and death have appropriate visual poses.
- [ ] On a branch/slide combo, the new **slide sprite clears the existing low obstacle clearance** visually, with feet touching terrain correctly on slopes.
- [ ] Crossbow fire pose triggers on tapping Fire; scythe visual hit trails match actual collision timing.
- [ ] Regular Cavern Bats use articulated wing poses during flight and diving; warning circles remain readable. Skeletal Bats deliberately remain old art in this release.
- [ ] Raven/Skeletal Wings continue appearing after purchase; hover and God Mode remain functional.
- [ ] Rewind reverses both the Reaper pose and the bat sprite animation with the world; no visual jump after rewind completes.
- [ ] Running, jumping, sliding, terrain collisions and enemy behavior still work across forest, mountain and underworld biomes.
- [ ] 9,999m full runs, Souls, vendor transactions, Revive and finish function unchanged.
- [ ] Check responsiveness and FPS during many bats on-screen. Actual mobile visuals/performance still require user inspection.
- [ ] Add `?art=off` in the game URL; the original Reaper/Bat procedural art should return as a safe fallback.

### Testing and caveats

- `node tests/visual-foundation.cjs` passes (original SVG frame cells, pure pose logic, fixed foot anchors, Phaser-like art loading and Bat sprite pooling, failed-asset fallback).
- Existing `tests/encounter-reliability.cjs`, `tests/rewind.cjs`, `tests/survival-crossbow.cjs` and `tests/polish-fairness.cjs` pass with the new version, using mocked Phaser graphics. 300 seeded encounter worlds and five simulated complete runs continue to pass.
- **Limit:** Testing validates SVG structural rules and mocked loader behavior, not actual real-phone SVG rasterization, shader behavior or measured FPS. Phone QA is required before accepting the finished visual quality.

### Next release roadmap

- **v0.10.1 — Characters & Combat:** Art passes for Skeletal Bats, Bone Crawlers, Ember Imps, Snapping Brambles and upgrades to scythe/crossbow, hit feedback and wing rigs.
- **v0.11.0 — World & Atmosphere:** Illustrated background parallax, ground textures, detailed biome transitions, vendor and portal redesign.
- **v0.12.0 — Final Boss:** Arena, boss behavior, telegraphs, phases and distinctive boss artwork based on the established animation system.
- **v0.13.0 — Sound/UI/Polish:** Audio, menu art, performance refinements and accessibility.

## v0.9.1 — Polish & Fairness

### New features and adjustments

- **Real rewind playback:** Instead of instantly jumping backward in time, display the actual previous gameplay snapshots in reverse at **3× normal speed** (a 5-second Rewind lasts approximately 1.7s; 8 seconds lasts approximately 2.7s). Player movement, scythe/slide state, moving enemies, obstacles, bullets, terrain changes and camera reverse together. Gameplay/input is frozen during playback, purple screen tint and "TIME REVERSES" overlay appear, and rewind restores the exact last valid snapshot at the end. Uses the existing bounded timeline history.
- **God Mode:** Rewind has **no ability cooldown while God Mode is enabled**, but still requires a fresh 8-second history after each use. Vendor transactions, Souls, death, revival and portal/chest boundaries continue to reset history. Disabling God Mode returns to the regular ability rules, including existing non-God cooldown state.
- **Reliquary refund:** "RESET ALL UPGRADES · 1 SOUL" is available only when you have both permanent upgrades to refund **and at least one already-unspent Soul in the wallet**. Pressing opens a separate confirmation showing invested Souls, fee, and final balance. Confirm deducts 1 unspent Soul, refunds the **full amount spent on all four permanent trees** (5/10/25 Soul levels), resets all trees to level 0, and saves immediately. Wallet-less players cannot reset by deducting the fee from their refund. Canceling has no effect.
- **Quit confirmation:** The Pause → Quit Run button now asks "ABANDON RUN?" with Keep Playing and Abandon Run choices. Cancel returns to the paused screen without resuming gameplay. Confirm returns to menu; collected Souls remain banked.
- **Control position:** Raise **Bow and Jump** by 12px while Attack and Slide stay in place; enlarge Jump's touch container accordingly.
- **Brittle Bones:** Level ranges upgraded from 150/175/200/225m to **150/200/250/300m**, including all descriptions.
- **Uphill jump fairness:** Rock and fire spawn candidates must pass a deterministic trajectory simulation using **unupgraded held jump** physics at the intended running speed, with slope, hazard width, avatar collision radius and takeoff options considered. Rejects impossible uphill jump placements without flattening procedural terrain or weakening other combat/slide-specific obstacle types.

### QA and regression status

- `node tests/polish-fairness.cjs`: Refund wallet requirement, persisted refund values, modal flows, 50m Brittle Bones increments, flat/steep/uphill base-jump feasibility, and 75 seeded terrain layouts (about 9,944 allowed and 820 rejected jump candidates).
- `node tests/rewind.cjs`: Confirms real reverse snapshots play at 3× rather than teleporting, God Mode zero cooldown with a fresh 8s history, normal 60-second cooldown, actual terrain and projectile restoration, Soul/vendor/portal safety boundaries.
- `node tests/encounter-reliability.cjs`: 300 procedural seeds, 2–3 air-tuck gates, five full mocked-graphics 9,999m runs, separate bat/ground enemy visibility.
- `node tests/survival-crossbow.cjs`: Legacy saves, Soul revival and payment logic, Grave Glide, chest acquisition, manual crossbow cooldown.

**Phone playtest acceptance:** Check the rewind's perceived 3× speed, smoothness and lack of gameplay during playback; repeat it twice in God Mode; switch God Mode off and confirm normal cooldown; reset a partially invested Reliquary with 1 unspent Soul (and confirm no reset with 0); quit/cancel from pause; test the newly raised button tap areas; verify steep uphill rock/fire hazards are clearable with normal jump. Also check baseline Souls, all four enemy types and full-run stability. Simulated logic and UI event tests do **not** replace phone gameplay testing.

## v0.9.0 — Death's Reversal

The new Angel vendor upgrade **Death's Reversal** adds a context-sensitive REWIND button on the upper-left side of the screen (desktop: **R**). No rewinding is possible until enough same-segment history has accumulated. Rewind is an instant temporal jump with a brief violet screen effect.

| Level | Rewind duration | Cooldown |
|---|---:|---:|
| 1 | 5 seconds | 60 seconds |
| 2 | 6 seconds | 55 seconds |
| 3 | 7 seconds | 50 seconds |
| 4 | 8 seconds | 45 seconds |

Each upgrade has 4 levels like the other Angel upgrades, including existing Angel rarity bonuses. The ability is temporary for the run (not a permanent Reliquary power).

**God Mode:** Temporarily grants the functional level-4 Rewind even without owning the power. Turning God Mode off restores the actual acquired level (or hides the ability if not owned). Rewind's cooldown remains intact.

### Rewind scope

- Rolling, approximately 100ms-interval snapshots store eight-plus seconds of player and world history. Snapshots are only captured when Rewind is owned or God Mode enables it, reducing unnecessary memory load.
- Restores player position, HP/max HP, jump/slide/hover physics, immunity, scythe and crossbow timers; in-game elapsed time, moving enemies, obstacles, bolts, fireballs, gold pickups, available gold, run score, spawn cursors and RNG state.
- Projectile targets and fireball owners are re-linked to the correct restored enemy. Brittle Bones bridges are removed or restored by tracking original terrain section geometry. Permanent seeded terrain generation remains untouched.
- Rewind's **own cooldown is never included** in rewind snapshots; it is set on use and cannot be rewound or reset by leaving a vendor or toggling God Mode.
- **Irreversible barriers:** Snapshot history resets at Angel/Devil vendor entry, purchase/healing, and exit; banked Soul collection; Underworld portal and chest interaction; death, revival and victory. Rewind cannot cross those boundaries and so cannot duplicate Souls or refund a purchase.
- No cooldowns or world mechanics advance while vendor/pause/chest/countdown screens are active. Rotating/resizing a phone clears previous snapshots to avoid inconsistent screen-coordinate restores.
- UI shows a countdown until enough history is recorded, then shows the recharge countdown after use.

### v0.9.0 Android playtest

- [ ] Obtain Death's Reversal from an Angel vendor; upper-left REWIND button appears without covering HP or other controls.
- [ ] Try the default 5-second rewind and all upgrade levels if possible; world and Reaper move back together.
- [ ] Rewind after receiving damage and verify previous HP and enemies/obstacles are restored.
- [ ] Rewind after launching a crossbow bolt or after an Ember Imp fireball; projectiles restore without crashes.
- [ ] Trigger Brittle Bones over a chasm then rewind: rubble bridge should revert to its previous form.
- [ ] Confirm 60/55/50/45-second cooldown and that tapping repeatedly cannot rewind repeatedly.
- [ ] Confirm newly banked Souls cannot be duplicated, and vendor upgrades cannot be refunded through rewind.
- [ ] Portal/chest, Soul, revive/death, and vendor visits block reaching earlier checkpoints.
- [ ] God Mode grants temporary level 4 and disabling it restores the earned level.
- [ ] After rewind, ground collisions, jumps, sliding, bats, crawlers, imps, Soul revival and finish gate remain functional.
- [ ] Check landscape FPS, controls, battery impact and visual effect on the phone.

### Test suites

- `node tests/rewind.cjs`: levels and cooldowns, God Mode temporary override, a full rewind, health/gold restoration, linked projectile references, real terrain bridge rollback, and Soul/vendor/portal boundaries.
- `node tests/encounter-reliability.cjs`: 300 seeded worlds, encounter visibility and five full runs.
- `node tests/survival-crossbow.cjs`: legacy Soul saves, Grave Glide, revival accounting, chest animation state and manual crossbow targeting.

**QA limitation:** These are deterministic in-process and mocked-graphics simulations, not measurements of Android Phaser rendering. Actual phone playtesting remains essential.

## v0.8.3 — Enemy Encounter Rework

**Reason for patch:** The prior placement loop counted creatures successfully spawned even when retry positions were so far ahead that the cleanup code deleted them before they reached the screen. Ground and bat encounter chances were also combined, so crawling/imp enemies were not reliably experienced. Bats moved backward in world coordinates and thus appeared to rush at the player faster than terrain.

### Changes

- **Right-edge entrance:** Enemies now appear approximately 48–150px inside the *rightmost visible portion* of the landscape display. No off-screen world-coordinate placement retries. Spawning is based on current player progress.
- **Separate deterministic encounter cadence:** Ordinary bats throughout the caves and skeletal bats in late Hell trigger every **55–78m** of progression, with retry on unsafe placement. Crawler/Imp encounters have an **independent 115–165m** progression interval, not a random competing choice with bats. Late Hell ground encounters split between crawlers and 2-HP Ember Imps.
- **Slower bats:** They advance in world coordinates at **60% of the Reaper's running speed**, so they cross the screen at ~40% of approaching terrain speed. Their warning lasts **0.85 seconds** and their dive is **1.35 seconds**, with motion clamped into the camera view vertically.
- **Ground movement:** Bone Crawlers and Ember Imps move away through world space more slowly than the player, providing a longer reaction window. Crawlers stop at a ledge rather than disappearing when the next terrain sample is missing.
- **Visual clarity:** Lighter bone highlights/contours on crawlers and stronger ember outline/glow on imps.
- **Safety:** Preserves the exact first 50m after vendor spawn exclusion, collision geometry checks, the Soul platforms, existing scythe/crossbow attacks and run saves. No Rewind functionality is included.

### Validation and instrumented encounter visibility

- **300 procedural seeds:** 150 with 2 air-tuck gates and 150 with 3; separate bat and ground placement frequency asserted; every placed enemy checked against 50m vendor corridors.
- **Five full-length simulated runs, graphics mocked:** All reached 9,999m. Bat entry, Skeleton Bat entry, Crawler and Imp **visible** counts measured separately. Typical run: ~20+ cavern bats, ~20+ skeletal bats, ~14–19 crawlers, ~6–10 imps. Most bats remained onscreen for at least 2 seconds (when unobstructed). These are simulations, *not* measured phone sessions.
- Existing `tests/survival-crossbow.cjs` still verifies the v0.8.2 Soul revival, permanent slide bonus, chest acquisition and manual-fire functionality.

### v0.8.3 phone playtest priorities

- [ ] Bats appear from the **far-right visible edge**, not immediately above the Reaper.
- [ ] Bats move across screen distinctly **slower than terrain**, allowing 2–3 seconds to fire.
- [ ] Bat arrivals are frequent throughout 5,000–9,999m; skeletal variants after the lava transition.
- [ ] Bone Crawlers visibly traverse the ground in the caves.
- [ ] Ember Imps are visible in late Hell, telegraph fireballs and remain hittable.
- [ ] Enemies don't vanish unexpectedly before reaching the player.
- [ ] No enemies/obstacles spawn in 0–50m after vendors; Souls and traversability remain intact.
- [ ] Bone Crossbow manual aiming/firing, the chest scene, Soul revival and Grave Glide remain unchanged.

## Game foundations

- Auto-running Reaper, movement controls Attack / Jump / Slide, jumps with optional double-jump and hover, slide-to-air-tuck combo.
- Procedural mountain and Underworld terrain, steep terrain collision fixes, brambles, rocks, branches, fire, lava, abyss sequences, and 2–3 guaranteed air-tuck gates.
- 5,000m Underworld portal, Souls around 4,850m and 9,500m, final gate at 9,999m.
- Angel and Devil vendors every 666m; Devil upgrades cost 2 HP on first purchase of Skeletal Wings or Infernal Boots, then 1 HP; gun upgrades cost 1 HP and always grant one level.
- Rebalancing and spawn reliability improvements from v0.8.1: dozens of enemy placements with multiple retries; only 0–50m after a vendor is a universal fixed no-spawn zone, plus physical geometry checks.
- Cavern Bats, Skeletal Bats (2 HP), Bone Crawlers, Ember Imps with reflectable fireballs, moving Snapping Brambles.

## v0.8.2 — What's new

### Soul Revival

- When the Reaper dies, present **ONE MORE CHANCE** once per run; accept or decline.
- **3 Souls** deducted atomically from the existing persistent Soul wallet, with a separate current-run balance allocating this run's Souls first and earlier saved Souls second.
- No Souls awarded on revival. Collected Soul pickups remain collected; no wallet duplication.
- Revive restores maximum HP to **3** and heals to **3**, regardless of Boneheart or purchased maximum HP bonuses earlier in the run.
- Temporary upgrades, gold, and prior run progress are retained. Player moves to a safe solid position if necessary; nearby hazards are cleared strictly for immediate respawn safety.
- **3-second frozen-world countdown** before play resumes, with short invulnerability to prevent instant repeat death.
- A later death ends the run normally. Insufficient Soul balance disables purchase; declining death preserves the Soul wallet.

### Grave Glide — Permanent Reliquary Tree

| Level | Cost for level | Max slide duration |
|---|---:|---:|
| 0 (base) | — | 0.85 sec |
| 1 | 5 Souls | 1.00 sec |
| 2 | 10 Souls | 1.15 sec |
| 3 | 25 Souls | 1.30 sec |

This is the fourth permanent tree, joining Boneheart, Grave Wealth and Death's Leap. Existing `grim-run-v07-meta` saves load with Grave Glide at level 0 and preserve previously purchased levels, Souls and scores. Shop displays four side-by-side cards in landscape.

### Bone Crossbow and Chest Acquisition

- Gun re-themed as a **bone-and-sinew crossbow** with pale bone bolts and a handheld bone weapon appearance.
- **Manual Fire**: Touch button appears directly above the scythe on the left, with the same vertical spacing as Jump above Slide. Desktop key **F** also shoots.
- Crossbow keeps auto-aiming at the highest-priority target: visible flying enemies first, then ground enemies, then scythe-cuttable obstacles when Power Shot level 2 is owned.
- Crossbow never fires automatically; Fire button may shoot an untargeted bolt straight forward. Every shot consumes the same cooldown (1.00s base; Rapid Fire 0.85/0.70/0.55s).
- Existing Power Shot and Chain Shot remain functional, including automatic level-3 Power Shot screen blast.
- After the 5,000m portal, a **skippable 4.4-second item acquisition scene** freezes gameplay: chest opens, magical light appears, and the Reaper raises the Bone Crossbow. Only on completion or Continue is the crossbow unlocked and Fire button shown. No fourth action is shown before this point.

## Verified in simulated/source testing

- `node tests/encounter-reliability.cjs`: 300 seeded worlds, 2–3 air-tuck gates, 48–52 enemies, five complete mocked-graphics runs with visible enemies.
- `node tests/survival-crossbow.cjs`: old Soul balance migration; Grave Glide 5/10/25 costs and reload persistence; revival debits 3 Souls once, with correct current/prior allocation, restored 3/3 HP, three-second countdown and second death; chest skip, weapon unlock, manual fire, no automatic fire, correct rapid-fire cooldowns and flyer targeting.
- Every inline JavaScript block checked for parse errors; preserved world/collision rules and existing save keys.

**Limitations:** This validates logic but not real Phaser GPU drawing, touch precision, visual fit at each Android screen size, phone frame rate, or real user difficulty. User phone QA remains the release acceptance step.

## v0.8.2 historical playtest checklist

- [ ] Main menu says v0.8.2; existing Souls and permanent upgrades are intact.
- [ ] Reliquary displays four upgrade trees without scrolling/cutting off buttons in landscape.
- [ ] Grave Glide increases maximum slide duration at each level.
- [ ] Encounter distribution and terrain collision still work (especially bats, 2–3 air tucks, and Soul platforms).
- [ ] After portal, chest cutscene is clear, skippable, and pauses game mechanics.
- [ ] Bone Crossbow appears afterward above Attack. No auto-fire; tapping Fire produces a bolt and respects cooldown.
- [ ] Crossbow auto-aim prioritizes airborne enemies, rapid fire/power/chain upgrades still work.
- [ ] Initial death shows revival. Cost is 3 Souls, current-run pickups consumed first. Decline shows game over normally.
- [ ] Revival restores 3/3 hearts, keeps run abilities and location, and gives a full three-second countdown.
- [ ] Cannot revive twice in one run; cannot revive without 3 Souls. Reloading preserves the debit.
- [ ] Check both pre- and post-portal deaths and deaths from lava/abyss, fireball and contact damage.
- [ ] The full 9,999m game remains finishable.

## Next steps

Next: review the opening forest background and ground at landscape phone size, then continue through the remaining World & Atmosphere regions.

## Source and backups

- `main/index.html`: published game after merge.
- `tests/godmode-tools.cjs`, `tests/visual-foundation.cjs`, `tests/polish-fairness.cjs`, `tests/rewind.cjs`, `tests/encounter-reliability.cjs`, `tests/survival-crossbow.cjs`: dependency-free Node regression suites.
- `backup/v0.10.1`: prior published art hotfix.
- `backup/v0.9.1`: last successful pre-art gameplay version.
- `backup/v0.9.0`: earlier version.
- `backup/v0.8.3`: previous version.
- `backup/v0.8.2`: earlier version.
- `backup/v0.8.1`: previous rollback stable version.
- `backup/v0.8.0`, `backup/v0.7.0`, `backup/v0.6.2`: older baselines.
