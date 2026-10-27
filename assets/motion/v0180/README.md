Current run playback is documented in [v0.19.3](../v0193/README.md). Original source and runtime bytes below remain retained for provenance and fallback; the review uses the current solid run atlas.

# v0.18.0 artwork — retained originals

The accepted drawings remain unchanged. Current playback advances the full sheet over 752 world pixels, reducing cadence by 75% relative to v0.18/v0.19.0. The basic cutting scythe uses a fixed 60% of its former scale to match the carried weapon; a separate spectral arc retains the prior damage reach. The review page follows the current runtime constants.

## Original v0.18.0 production notes

Built from v0.17.0 (`590af511776d94bbddfa4f83c1e191f90fc1e58d`).

The built-in Imagegen tool authored 24 running, 24 jumping/landing and 24 weapon-free cutting body drawings, plus one isolated rigid scythe. Original transparent images are retained in `source/`; exact generation prompts, including the rejected initial combined cutting-sheet brief, are in `production-prompts.json`. No rejected combined sheet is used at runtime.

`scripts/prepare-motion-art.py` packs the source cells, registers the eyes/feet and measured gripping hands, and exports three 1920×1280 RGBA atlases with 320px cells. Source and runtime byte sizes, SHA-256 hashes, and registration records are in `manifest.json`. Atomic writes and full PNG decoding precede publication. Runtime additionally checks dimensions and nonblank alpha coverage in every pose before replacing the old renderer.

The gait advances one complete stride per 188 world pixels. At the existing 282–465px/s pace, the authored pose rate rises from 36 to about 59 poses/s. Future speed changes, slow time and half-speed follow automatically through distance traveled; rewind restores the same pose from historical position. The jump drawing is chosen from launch age and vertical velocity, with a 175ms interruptible landing clock stored on the player.

The standard standing/aerial cut retains the 260ms action, 405ms cooldown and 20%–79% active interval. It uses the 24 new body poses and one mirrored rigid scythe, registered to the hands. A small body lunge keeps the point moving ahead of the socket throughout the cutting stroke. Blade-edge samples between updates provide damage areas inside the former maximum reach envelope. The damage trail uses the same tip coordinates. Recently approved slide/tuck cuts and powered Soul Cleave drawings remain in their existing animation system.

Cavern Bat flight uses the same 16 drawings in gameplay and the opening, now over 0.96s instead of 2/3s: about 31% slower. The fallback flap is slowed to the same cycle duration.

Performance work removes unchanged HUD text writes, caches power summaries and combat view/frame lists, reuses pickup sets, skips absent root masks and duplicate base-bat rendering, suspends the hidden gameplay camera behind the opening/menu canvas, and makes camera easing depend on elapsed time. No terrain, progression, prices, saves or jump physics changes are included.

`review.html` is an interactive motion review with movement speed, playback rate, pose stepping and blade-envelope controls. The main game remains the authoritative feel test.

Validation: `tests/motion-performance.cjs` verifies speed/refresh independence, jump phases, leading-tip geometry, swept hit limits, HUD/mask behavior and complete PNG CRC/SHA. `tests/browser-motion-performance.js` exercises real Chromium at 950×430, decodes all 72 poses, captures action states, checks landing interruption and home rendering, and records CPU timing separately from GPU presentation. Existing gameplay, interface and visual suites remain required. Physical Android frame pacing remains a real-device playtest.
