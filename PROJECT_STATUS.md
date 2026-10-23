# Grim Run — Project Status & Roadmap

**Updated:** October 22, 2026  
**Current build:** v0.8.1 — *Encounter Reliability Patch*  
**Target:** Android landscape web game (Phaser 3.90.0; single HTML).  
**QA status:** Static syntax/integrity checks, 300-seed generation tests and five simulated full-game runs passed. **Actual phone playtest remains essential.**  
**Rollback:** `backup/v0.8.0` preserves the prior release. Earlier backups include `backup/v0.7.0`.

## v0.8.1 — Encounter Reliability Patch

This deliberately focused patch leaves v0.8.0's basic weapon, controls, powers and permanent save scheme unchanged.

### Changes

- **Unified spawn safety:** The only general distance exclusion for newly placed hazards and enemies is the **0–50m region after each 666m vendor**. Removed the redundant 245px milestone filter, 260px pre-vendor exclusion, variable 60m/65m/85m exclusions, and broad random obstacle bans centered on the Soul locations. Actual physical collisions, gap-clearance, the chest/portal and finish geometry, and one-way Soul platform footprints remain protected as necessary.
- **Air tuck:** Each generated run selects **2 or 3** valid air-tuck gates beyond 7,000m, spaced over the late section, with jump-attack patterns independently generated.
- **Enemy encounters:** Rejected random placements are retried at alternative suitable ground locations; ground creatures can fall back to the appropriate flying variant if a location is unusable. First bat encounter now begins soon after the portal, not 190m later. Additional telemetry records attempts, placements, rejected reasons, entering the view, visibility duration, and kills.
- **On-screen readability:** Auto-targeting now requires an enemy to have been visibly present for at least **650ms**, letting bats and other threats be noticed before a one-hit automatic shot eliminates them.
- **God Mode:** HP remains unchanged and death is prevented, but real damage events still trigger `on-damage` effects such as Brittle Bones alongside existing hit feedback.

### Checks

- `node tests/encounter-reliability.cjs` is a dependency-free regression suite stored in GitHub.
- **300 procedural seeds:** 150 runs with 2 gates; 150 with 3 gates. Enemy placement generated 48–52 creatures per tested run. Every placement tested against the exact vendor corridor.
- **Five simulated portal-to-finish runs:** all reached 9,999m in the mocked graphical environment and recorded 20, 22, 24, 25, and 23 encounters visible at least 650ms.
- Script parsing, Soul wallet preservation and damage/flight spawn invariants checked.
- A real phone is required to confirm actual visual appearance, smoothness, collisions, readability, encounter balance, and that enemies are fun rather than overwhelming.

### v0.8.1 phone playtest priorities

- [ ] Confirm the menu reports v0.8.1.
- [ ] Across a run, encounter 2–3 air-tuck gates after their previous introduction point.
- [ ] Enter Underworld at 5,000m and see early cavern bats, not an empty cavern.
- [ ] Later, encounter skeletal bats, ground crawlers and fireball-casting Ember Imps.
- [ ] Enemies remain visible long enough to recognize and respond; auto-fire still prioritizes airborne targets.
- [ ] No enemy or obstacle spawns in the first 50m after a vendor.
- [ ] Obstacles may appear normally before vendors; no unfair overlap combinations.
- [ ] Soul platforms remain accessible, both Souls collectible, and the 9,999m finish available.
- [ ] In God Mode, Brittle Bones still clears hazards/bridges terrain when a hit occurs without losing health.
- [ ] Existing Reliquary balance, upgrades, auto-fire, Devil HP prices, portal, terrain collision and mobile controls remain unchanged.

### Agreed next releases (not in v0.8.1)

- **v0.8.2 — Survival & Presentation:** One revive per run for 3 banked Souls (current run earned Souls spent first), revived at max 3 HP and fully healed with a 3-second resume timer; new permanent maximum-slide-duration Reliquary tree, 5/10/25 Souls for +0.15/+0.30/+0.45 seconds; reskin Soulcaster as bone crossbow, **manually fired** using a new button above the scythe; short skippable chest-acquisition animation at the Underworld portal.
- **v0.9.0 — Rewind:** Angel ability with 5/6/7/8-second rewinds across levels 1–4 and 60/55/50/45-second cooldowns, dedicated upper-left button, safe time-state snapshot restore. God Mode temporarily unlocks level 4 for testing.
- Continue presentation, optimization, balance and Android release preparation in later phases.

---

## Core premise

Automatically run to the right as the Grim Reaper, using three landscape touch controls: Attack (left), Jump and Slide (right). Survive terrain, gaps, damaging hazards, and enemies, then enter the Underworld at 5,000m and reach the final gate at 9,999m. Angel and Devil vendors offer temporary run powers; the Reliquary spends banked Souls on permanent upgrades.

## Features implemented through v0.7.0

- Deterministic procedural ascents from forest to mountains, teleport at 5,000m, caverns, late lava/Hell region.
- Terrain collision and swept landing fixes; airborne movements, sliding, air tuck, double jump, hovering.
- Angel/Devil merchants every 666m; Angel gold transactions, Devil HP transactions and optional healing.
- Optional Souls around 4,850m and 9,500m, persistent Soul balance, personal-best tracking, victory at 9,999m.
- Permanent Reliquary trees, each with upgrade prices **5 → 10 → 25 Souls**:
  - Boneheart: 3 starting HP baseline; 4/5/6 at levels 1/2/3.
  - Grave Wealth: +2/+4/+6 starting spendable gold; not added to collected-gold score.
  - Death's Leap: +5%/+10%/+15% actual base jump height.
- Existing Soul balances migrate from `grim-run-v05-souls` into `grim-run-v07-meta`; same-browser storage persists after run death and reset.

## v0.8.0 — Combat Expansion

### Fixed weapon at the portal

- The Reaper acquires the **Soulcaster** automatically while teleporting at 5,000m; no fourth button.
- Gun fires a single visible auto-aimed projectile with a **1,000ms base cooldown**.
- Prioritizes visible flying enemies, then ground enemies; once Power Shot level 2 is owned, cuttable obstacles can be targeted after all enemies.
- A Soulcaster indicator appears in the HUD. Current weapon and run upgrades reset every new run; permanent Reliquary stats do not.

### Devil upgrade trees

All Devil purchases grant **exactly one level**, ignoring Angel-only rarity boosts. If any gun upgrades remain, at least one appears among the three Devil offers.

| Upgrade | Purchase price | Levels and effects |
|---|---|---|
| **Infernal Boots** (combined Fireproof Boots + Lava Waders) | 2 HP first; 1 HP later | Levels 1–4: lava damage reduced by 1 HP at every level; fire shield one hit at 10/8/6/4-second cooldown |
| **Skeletal Wings** | 2 HP first; 1 HP later | Existing hover progression (4 levels), unchanged |
| **Rapid Fire** | 1 HP each | Level 1: 850ms; L2: 700ms; L3: 550ms |
| **Power Shot** | 1 HP each | L1: 2 damage; L2: gun can target scythe-cuttable obstacles when no enemies in range; L3: automatic full-screen obstacle clear + 2 damage to visible flying enemies, with a 10-second cooldown |
| **Chain Shot** | 1 HP each | Each gun hit chains to 1, 2, or 3 additional nearby visible flying enemies (levels 1–3) |

A purchase cannot reduce the Reaper below 1 HP. Infernal Boots' fire shield also handles projectile fireballs from Ember Imps.

### New hazards / combat encounters

- **Cavern Bats** (from 5,000m): 1 HP; a short windup precedes a downward swoop.
- **Skeletal Bats** (late lava/Hell): 2 HP; killed in two base shots or one upgraded Power Shot.
- **Bone Crawlers** (mid/late Underworld): low mobile enemies following solid ground, vulnerable to scythe or gun.
- **Ember Imps** (lava/Hell): stationary 2-HP fireball casters; fireballs can be hit and reflected by an active scythe swing back toward the caster.
- **Snapping Brambles** (mountain ascent): animated extending plants with matching dynamic hitboxes, destroyable with the scythe.

### Safety and compatibility

- Enemy spawning respects Soul platform areas, vendor approaches/departures, and the portal vicinity.
- Ground enemies require stable solid terrain at spawn; bats can fly over sloped ground but not through chasms.
- The blast only removes discrete obstacles; it **never fills or deletes terrain, abyss gaps, or lava pits**.
- Save schema, persistent Soul balances, player controls, and the original terrain collision fixes are unchanged.
- No new media dependencies; the graphics remain procedural, with existing Phaser CDN dependency.

## Verification results

**Completed:** Static checks of every inline JS script, source diff review, unit-like combat rule tests and simulated Phaser scene updates using stubbed graphics/DOM.

Confirmed in simulation:
- v0.8.0 menu startup and portal gun grant.
- Devil price ladder (2 HP initial for Skeletal Wings/Infernal Boots, 1 HP thereafter), one level per transaction, guaranteed offered gun upgrade.
- Infernal Boots lava mitigation and 10/8/6/4s fire cooldown.
- Prioritized flyer targeting, Power Shot damage, screen-wide blast and cooldown.
- Scythe hits (at most once per swing), fireball deflection, Chain Shot links.
- Extended simulated Underworld and Hell updates produced bats, skeletal bats, crawlers, imps, bullets and fireballs without exceptions in tested seeds.
- Across twelve seeded mountain generations, snapping bramble encounters spawned several times per ascent.

**Still required:** Actual mobile-device playtesting, measured FPS/battery checks, touch-handling verification, and long-run difficulty/balance evaluation. Simulated graphics tests cannot confirm the appearance and legibility of real Phaser rendering on a phone.

## v0.8.0 phone playtest checklist

- [ ] HUD shows v0.8.0 on the main menu; permanent Reliquary balance/upgrades unchanged.
- [ ] Existing forest/mountain obstacles and damage behavior unchanged; snapping brambles move and can be cut.
- [ ] No random floor falls or branch/slide collision regressions.
- [ ] Portal at 5,000m shows the Soulcaster pickup and gun indicator.
- [ ] Gun fires automatically about once per second, prioritizing bats; no new touch button.
- [ ] Normal bats take 1 hit; skeletal bats take 2 basic hits or 1 upgraded shot.
- [ ] Bats telegraph before swooping; player collision costs 1 HP unless invulnerable.
- [ ] Ground crawlers move over solid terrain; Ember Imps launch visible fireballs.
- [ ] Active scythe swings reflect fireballs; reflected shots can hit the caster.
- [ ] Devil offers show correct costs; upgrades always increase only 1 level.
- [ ] Rapid Fire, Power Shot and Chain Shot all work at each tier.
- [ ] Power Shot L3 blasts obstacles and flyers on-screen, recharges 10s, leaves gaps/lava unaltered.
- [ ] Infernal Boots combine 1-HP lava protection and recharging fire shield.
- [ ] Vendor, Soul, portal and end-gate areas remain safe from unfair spawns.
- [ ] Retry resets gun / temporary powers but does not reset banked Souls or purchased Reliquary levels.
- [ ] No animation jitter, frame drops, screen overflow or unusable buttons in landscape mode.

## Proposed future roadmap

- **v0.9.0 — Presentation and feedback:** improve character/enemy animations, visual language, effects, audio, UI layout.
- **v0.10.0 — Encounter variety and tuning:** balance combat combinations and progression; consider bosses and major content.
- **v1.0.0 — Android release preparation:** offline dependency bundling, native packaging, hardware performance testing, release workflow.

## Repo references

- `main/index.html`: deployed version once promoted from feature branch.
- `feature/v0.8.0-combat-expansion/index.html`: implementation and simulated test source.
- `backup/v0.7.0/index.html`: last user-confirmed stable HTML.
- `backup/v0.6.2/index.html`: earlier stable baseline.
