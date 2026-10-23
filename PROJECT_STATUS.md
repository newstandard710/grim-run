# Grim Run — Project Status and Roadmap

**Release:** v0.8.3 — *Enemy Encounter Rework*  
**Platform:** Landscape browser / Android prototype using Phaser 3.90.0 and a single HTML file  
**Source:** `main/index.html` once promoted to main  
**Rollback:** `backup/v0.8.2` (previous user-playtested build); earlier backups remain intact.  
**Verification:** Source syntax, 300-seed procedural and five full-run encounter-visibility tests, plus previous Soul revival, Grave Glide and crossbow tests. **Live Android playtesting pending.**

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

## Next agreed release

**v0.9.0 — Death's Reversal:** new Angel vendor power with a dedicated upper-left Rewind button. Level 1 rewinds 5 seconds on a 60-second cooldown; levels 2–4 give 6/7/8 seconds on 55/50/45-second cooldowns. In God Mode the fully upgraded rewind is available temporarily. Requires bounded, accurate world-state snapshots and irreversible boundaries at Soul collection, vendors and portal changes.

Later: visual/audio polish, encounter difficulty balancing, mobile optimization, offline dependency bundling, native Android packaging.

## Source and backups

- `main/index.html`: published game after merge.
- `tests/encounter-reliability.cjs`, `tests/survival-crossbow.cjs`: dependency-free Node regression suites.
- `backup/v0.8.2`: prior playable version.
- `backup/v0.8.1`: previous rollback stable version.
- `backup/v0.8.0`, `backup/v0.7.0`, `backup/v0.6.2`: older baselines.
