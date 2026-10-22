# Grim Run

A mobile-first, landscape action roguelike about a Grim Reaper running toward the Underworld.

**Current playable source: v0.7.0 — The Underworld Reliquary.**

- [Game HTML](index.html) — single-file Phaser 3 prototype
- [Project status, roadmap, and playtest checklist](PROJECT_STATUS.md)
- [Pre-v0.7.0 rollback branch](https://github.com/newstandard710/grim-run/tree/backup/v0.6.2)

## Current game

Attack, jump, and slide through procedurally generated terrain and changing biomes. Reach the 5,000m Underworld portal and the final gate at 9,999m. Collect gold for run-specific Angel/Devil vendor abilities. Collect Souls to buy permanent upgrades in the Reliquary on the main menu.

**Permanent upgrade costs:** 5, 10, and 25 Souls per tree level.
The three trees improve starting HP (base 3), starting gold, and initial jump height.

## Running it

Load `index.html` in a modern browser with an internet connection for the pinned Phaser 3.90.0 dependency. Android landscape is the primary playtest target. GitHub Pages can serve this file as the site entry point when Pages is enabled.

This is currently a browser prototype, **not yet a packaged native Android APK**.

## Testing

v0.7.0 is published for manual phone/browser playtesting. Static source checks have passed; end-to-end mobile testing and automated regression tests remain to be done. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed verification steps.
