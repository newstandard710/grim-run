# Grim Run — Project Status & Roadmap

**Updated:** October 22, 2026  
**Current build:** v0.7.0 — *The Underworld Reliquary*  
**Status:** Playable mobile-first browser prototype; uploaded to GitHub `main`. Interactive phone playtest of v0.7.0 still pending.  
**Rollback:** `backup/v0.6.2` branch (unchanged gameplay baseline).

## Core vision

Grim Run is a landscape, side-scrolling action roguelike starring an automatically running Grim Reaper. Each run challenges players to survive an increasingly dangerous ascent, collect Souls and gold, acquire situational powers, enter the Underworld, and reach the final gate. Permanent progression uses collected Souls to improve subsequent runs.

### Controls

- **Attack**: left thumb; swings a scythe to clear brambles and aerial hazards.
- **Jump**: right thumb, upper button; tap/hold for height, with air abilities from upgrades.
- **Slide**: right thumb, lower button; avoid low ceilings; Slide/JUMP combinations enable aerial tucks.
- **Pause**: opens a three-second resume countdown and a playtesting-only invincibility toggle.

## Implemented through v0.7.0

### World and mechanics

- Phaser 3.90.0, custom JavaScript game rules, procedural graphics, one deployable `index.html`.
- Continuous running, terrain elevation, variable jump heights, slides, scythe attack, responsive touch layout.
- Difficulty escalation, gaps, rocks, branches, brambles, fire and advanced aerial hazards.
- Surface/forest/mountain segment to 5,000m; Underworld after portal at 5,000m.
- Optional collectable Souls near 4,850m and 9,500m; end gate at 9,999m.
- Vendor stops at 666m increments; Angel vendors before the portal, Devil vendors afterward.
- In-run power levels, rarity tiers, gold purchases/health tradeoffs, damage, recovery, scoring.
- Collision fixes including swept uphill/terrain landings and sloped sliding clearance.
- Personal best score saved to browser local storage.

### Permanent progression (v0.7.0)

From the main menu open **RELIQUARY**. Banked Souls are spent on three permanent trees, each with three levels. Tier costs per tree: **5, 10, 25 Souls** (40 per tree; 120 total).

| Tree | Base | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| Boneheart | 3 starting HP | 4 HP | 5 HP | 6 HP |
| Grave Wealth | 0 starting gold | 2 gold | 4 gold | 6 gold |
| Death's Leap | Normal jump | +5% height | +10% height | +15% height |

- Existing Soul balances from `grim-run-v05-souls` migrate into the authoritative v0.7.0 save.
- New key: `grim-run-v07-meta` (balance, levels, schema version); the legacy balance key is mirrored for rollback compatibility.
- A Soul is banked when picked up, including runs ending in death.
- Purchases remain after run resets and browser reloads on the **same browser/device**.
- Starting gold is spendable, but is not counted as collected gold in the run score.
- Death's Leap changes the initial jump's vertical velocity using a square-root multiplier to achieve the stated actual jump-height increase under unchanged gravity.
- Raven Wings and other run-specific purchases remain independent from permanent upgrades.
- The v0.6.2 terrain, collision, vendor, portal, and obstacle systems are intentionally unchanged.

## v0.7.0 acceptance / playtest checklist

- [ ] Open the Reliquary from the main menu; all three cards and the Soul wallet fit in landscape.
- [ ] Existing Soul balance remains available.
- [ ] An unaffordable upgrade cannot be purchased, and does not deduct Souls.
- [ ] Costs progress 5 → 10 → 25 for each independent tree.
- [ ] Maximum of three levels per tree; no repeat purchases past max.
- [ ] Starting HP is 3, 4, 5, or 6 as Boneheart levels increase.
- [ ] Starting gold is 0, 2, 4, or 6 according to Grave Wealth; beginning gold does not award scoring points.
- [ ] Death's Leap improves the initial jump without breaking the short hop, Raven Wings, hover or other air controls.
- [ ] A Soul collected mid-run persists after death and after reopening the game.
- [ ] Purchases persist after reload; the saved balance is not reset by Run Again.
- [ ] Collision playtest on steep surface hills, chasms, sloped branches and Soul platforms.
- [ ] 5,000m portal works and 9,999m victory remains accessible.
- [ ] No noticeable performance regression on the target Android phone.

**Testing disclosure:** Static HTML/source integration checks were completed. No automated game test suite, phone-input test, or end-to-end browser runtime test has been run for v0.7.0 yet.

## Proposed future roadmap (not yet implemented)

- **v0.8.0 — Gameplay depth:** new enemies and obstacle patterns, power interactions, and more varied late-run challenges.
- **v0.9.0 — Presentation:** game art direction, animation upgrades, audio, visual feedback and UI polish.
- **v0.10.0 — Content/balance:** progression pacing, encounter balance, larger content and possible bosses.
- **v1.0.0 — Release preparation:** native Android packaging, device optimization, testing and distribution readiness.

### Technical follow-ups

- Add unit tests for save migration, purchase rules, jump-height math and platform/collision helpers.
- Separate the current monolithic HTML into maintainable modules only when necessary; retain simple GitHub publishing.
- Confirm GitHub Pages deployment and perform real Android landscape QA.
- Consider offline Phaser bundling and native packaging in the release track.
- Review Devil vendor rarity/level behavior independently from the v0.7.0 scope.

## Source and branches

- `main/index.html`: current playable HTML.
- `backup/v0.6.2/index.html`: baseline before permanent progression.
- `feature/v0.7.0-reliquary/index.html`: implementation branch, matching the released HTML at initial publication.
