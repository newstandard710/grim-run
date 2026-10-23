# Grim Run

A landscape, mobile-first side-scrolling action roguelike starring the Grim Reaper.

**Current playable build: v0.10.2 — God Mode Playtest Tools**

- [Game HTML](index.html)
- [Development status and playtest checklist](PROJECT_STATUS.md)
- [v0.9.1 rollback branch](https://github.com/newstandard710/grim-run/tree/backup/v0.9.1)

## v0.10.2: God Mode Playtest Tools

- **Half speed:** Enable God Mode in Pause, then toggle the **0.5× SPEED** button at bottom center. Slows gameplay physics, enemy/projectile movement, cooldowns and animation to half speed. Free, unlimited and instantly toggled. Turning off God Mode restores normal speed.
- **Distance Teleport:** While God Mode is enabled, Pause displays a slider and buttons for **500m–9,500m in 500m steps**. Requires confirmation; cancelling remains paused; confirming places the Reaper on safe solid ground and resumes immediately **without a countdown**. Teleporting to 5,000m or beyond initializes the Underworld and Bone Crossbow, marks earlier vendors as passed and clears Rewind history. Skipped Souls/venders give no rewards.
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

Survive hazards, vendors and combat across procedural terrain to the 5,000m Underworld portal, collect Souls near 4,850m and 9,500m, and reach the 9,999m final gate.

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

Next: v0.10.2 playtesting and proper illustrated Reaper/Bat production; then additional enemies/combat effects, illustrated biomes and final boss.
