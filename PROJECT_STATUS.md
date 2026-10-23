# Grim Run — Project Status & Roadmap

**Updated:** October 22, 2026  
**Development build:** v0.8.0 — *The Soulcaster / Combat Expansion*  
**Target:** Android landscape browser prototype (Phaser 3.90.0; single HTML).  
**Release stage:** Code implemented, syntax + mocked-runtime simulation verified. **Real-phone playtesting pending.**  
**Rollback:** `backup/v0.7.0` preserves last user-tested version; `backup/v0.6.2` preserves older baseline.

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
