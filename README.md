# Grim Run

A landscape, mobile-first side-scrolling action roguelike starring the Grim Reaper.

**Current playable build: v0.8.2 — Souls and Bone**

- [Game HTML](index.html)
- [Development status and playtest checklist](PROJECT_STATUS.md)
- [v0.8.1 rollback branch](https://github.com/newstandard710/grim-run/tree/backup/v0.8.1)

## Controls and objective

- **Attack**: lower left, swing your scythe.
- **Bone Crossbow Fire**: upper left, appears after obtaining the crossbow at the 5,000m portal. **Manual fire**, with priority auto-aim. F on desktop.
- **Jump / Slide**: upper/lower right; sliding then jumping enables air-tuck.
- **Pause**: upper right; God Mode allows invulnerable ability playtesting.

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

Open \`index.html\` with an internet connection for the Phaser 3.90.0 CDN dependency, or serve it with GitHub Pages. This is not yet a packaged Android APK.

Regression checks (Node.js, no dependencies):

\`\`\`sh
node tests/encounter-reliability.cjs
node tests/survival-crossbow.cjs
\`\`\`

The source and simulated logic tests pass; actual Android landscape playtesting is still required to validate visual presentation, input positions, and pacing.

Next planned release: **v0.9.0 Death's Reversal** (Rewind Time Angel ability).
