# Grim Run

A mobile-first, landscape side-scrolling action roguelike starring the Grim Reaper.

**Current playable HTML: v0.8.0 — The Soulcaster / Combat Expansion**

- [Play source (`index.html`)](index.html)
- [Development status, milestones and phone playtest checklist](PROJECT_STATUS.md)
- [v0.7.0 backup branch](https://github.com/newstandard710/grim-run/tree/backup/v0.7.0)

## Gameplay

Attack (left thumb), Jump and Slide (right thumb) across a procedurally generated ascent to 5,000m, then continue through the Underworld toward the 9,999m final gate. Souls at roughly 4,850m and 9,500m are banked for persistent progression. Angel and Devil vendors offer temporary powers during each run.

### v0.8.0 new features

At the **5,000m portal**, the Reaper receives a **Soulcaster** gun that automatically shoots enemies, prioritizing flying bats. It shoots once per second before upgrades and requires no extra touch controls.

Three new Devil gun trees:
- **Rapid Fire:** Shot intervals 1,000ms (base), then 850 / 700 / 550ms.
- **Power Shot:** 2 damage, then distant cutting of scythe-cuttable obstacles, then an automatic 10-second screen-wide obstacle-clearing blast that also damages bats, without affecting terrain/chasms/lava.
- **Chain Shot:** Successful hits chain to 1, 2 or 3 additional nearby flying enemies.

**Infernal Boots** now combine Fireproof Boots and Lava Waders: lava damage is reduced by 1 HP and a fire hit can be blocked once per recharge (10 / 8 / 6 / 4 seconds).

New threats: normal bats, two-HP skeletal bats, crawling ground enemies, fireball-throwing Ember Imps, and mountain snapping brambles. Well-timed scythe attacks can cut enemies and deflect enemy fireballs.

Devil purchase costs: **2 HP** for initial Skeletal Wings or Infernal Boots, **1 HP** to upgrade either afterward; all gun purchases cost **1 HP**. Devil purchases grant exactly one level.

### Permanent progression (v0.7.0, retained)

Use the **Reliquary** on the main menu to spend Souls on permanent power. Each three-level tree costs **5 / 10 / 25 Souls** per level:
- **Boneheart:** 3 HP base, then 4 / 5 / 6 starting HP.
- **Grave Wealth:** 0 base, then 2 / 4 / 6 starting spendable gold.
- **Death's Leap:** +5 / +10 / +15% base jump height.

## Running and testing

Open `index.html` in a modern browser with Internet access (Phaser 3.90.0 is loaded from the pinned CDN), or serve the repository with GitHub Pages. Landscape Android browser is the primary target.

The game is not yet packaged as a native APK. **v0.8.0 passed static JavaScript validation and mocked-graphics runtime tests; live mobile playtesting is still needed.** See [PROJECT_STATUS.md](PROJECT_STATUS.md) for full checklists.
