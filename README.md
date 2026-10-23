# Grim Run

A landscape, mobile-first side-scrolling action roguelike starring the Grim Reaper.

**Current playable build: v0.9.0 — Death's Reversal**

- [Game HTML](index.html)
- [Development status and playtest checklist](PROJECT_STATUS.md)
- [v0.8.3 rollback branch](https://github.com/newstandard710/grim-run/tree/backup/v0.8.3)

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

Open `index.html` with an internet connection for the Phaser 3.90.0 CDN dependency, or serve it with GitHub Pages. This is not yet a packaged Android APK.

Regression checks (Node.js, no dependencies):

```sh
node tests/encounter-reliability.cjs
node tests/survival-crossbow.cjs
node tests/rewind.cjs
```

The source and simulated logic tests pass; actual Android landscape playtesting is still required to validate visual presentation, input positions, and pacing.

Next: v0.9.0 phone playtesting, followed by encounter balance and presentation/audio improvements.
