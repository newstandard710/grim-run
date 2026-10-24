# Reaper run cycle review v2

This is the main-game Reaper motion cycle. It keeps the approved Reaper design and four existing run drawings, adds four transition drawings, and runs the resulting eight poses at 12 frames per second. The previous illustrated poses remain available with `?art=illustrated`; gameplay systems are unchanged.

The phone recording showed that the run looked like it was popping between poses. Measuring the actual PNG pixels found two additional causes: the four original run images did not have the same visible height, and the cyan eye moved sideways between poses even though all four used the same image anchor. Each run pose now has a matching visible height and eye alignment. The contact and stride poses also meet the ground line. The verified contact pose loads first so the Reaper stays visible while the remaining large images load.

The four runtime additions are `reaper_run_transition_01_v1.png` through `reaper_run_transition_04_v1.png` in `assets/characters/illustrated-v2/reaper/`. The original generated transparent images are retained in `reaper-source/`; `manifest.json` records dimensions, bounds, and SHA-256 hashes. The runtime copies use a shared 1792 × 1536 canvas and the established 120px visible-height target.

Browser checks validate every PNG's byte count, SHA-256, PNG chunks, decoded pixels, visible height, eye alignment, ground contact, immediate startup visibility, and distinct rendered frames in a mobile-sized Phaser canvas. The phone test remains the final check for whether the rhythm feels natural in play.
