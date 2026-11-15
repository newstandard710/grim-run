# Reaper anatomy continuity checkpoint

## Completed run stage

- Base PR86 `bdf79fc7a04b457ffdcaa0515825fbc67b0adb8a`, tree `60f6df156718c67f2c2cdff159ae5a0fb75958a1`. The previous unpublished implementation could not be recovered. This is a new reconstruction from the original artwork and the saved PR86 video, pose sheet and diagnosis.
- Shared profile landmarks are in [the pose guide](reaper-motion-pose-guide.md). The source baker moves the painted shoulder ahead of the raised pelvis, registers separate near and far leg paintings to the same stride, rolls the heel around the planted forefoot, moves the free arm from its shoulder, and carries the original weapon rigidly with the grip. The cloak follows the trunk with a limited trailing motion.
- The 192 single-layer atlas frames advance over two 202-world-pixel cycles with footfalls every 101 world pixels. Existing support and slope metadata use the same distance-indexed interface. The atlas is 1,937,036 bytes against a 2,047,544-byte budget. The existing focused motion suite passed. Decoded atlas checks found 128 of 128 support paints, 253 minimum hood-region median alpha, 1.50 world-pixel maximum toe drift and no opaque pixels below row 168.
- Local Chromium Canvas and SwiftShader WebGL captured 740 × 360 touch play at 1× and controlled sequences at 300, 362.5 and 425 world px/s for 1× and ¼× playback. Both leads show the knee loading over the boot, a lifted trailing heel, distinct swing and planted phases, and a forward pauldron. The coat remains attached and the carried blade and stock clear the floor in those run sequences. This is a software-browser review. Cut handoffs remain pending.

## Continue from this checkpoint

1. Use the shared guide to build the cut body and grip registration. Review windup, lunging and recovery at actual phone size, from both run leads and airborne poses. Check first-frame body mass, cloak flare, rigid shaft and late blade clearance.
2. Preserve readiness-dependent fallback and all combat outcomes as well as 52–205.4 ms active, 260 ms total and 405 ms cooldown. Verify 30/60/120 Hz ready/delayed/missing/invalid parity in both renderers, including hit, miss, reflection, physics and RNG.
3. Save a new verified incremental bundle and manifest before transport. Then run affected checks and the WebGL budget and follow the approved PR and Pages path.
