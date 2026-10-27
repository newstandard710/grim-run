# Merchant sanctuaries — v0.15.2

Built-in Imagegen produced the three original sheets under `../source/v0152/`. Exact prompts and reference roles are preserved in [production-prompts.json](production-prompts.json). Original bytes remain unchanged; source/runtime dimensions and SHA-256 checksums are in [manifest.json](manifest.json).

| Runtime file | Use |
| --- | --- |
| angel-floor.png | Ivory veined marble tile platform; 50m/600px world footprint. |
| devil-floor.png | Red hellstone brick platform with dark mortar; same footprint. |
| angel-architecture.png | Two complete worn marble columns in 384x768 cells. |
| devil-architecture.png | Two paired horned stone sentinel statues in 384x768 cells. |
| reaper-approach.png | Twelve registered 512px poses: eight approach and four settle/look-up poses. |
| relic-grip-overlay.png | Palm regions from the existing 24 shrine poses in compact 128x96 cells, layered over the crossbow stock using per-frame offsets. |

`scripts/prepare-vendor-art.py` selects connected silhouettes, registers the approach eye/foot anchors, extracts architectural components and makes the palm overlay. It writes `registration.json` and `assets/visuals/vendor-art-data.js`. The existing vendor characters, accepted Reaper identity, and shrine art are retained.

`assets/visuals/vendor-sanctuaries.js` renders floors at depth 2.1, architectural props at the same .53 depth as obstacle supports, existing vendor figures at depth 10, and their matching 1.75x auras at depth 9. The 50m sanctuary is real flat solid terrain. Protection runs from 25m before each vendor to 50m after it, retaining the older exit protection. Both spawning and moving threats respect the shared corridor.

First Angel and first Devil encounters per run stage a three-second introduction. Gameplay clocks, resources and selected offers freeze; completion or skipping opens the same selection. Flags do not rewind or reset on a practice teleport. A new run resets them.

The six-second shrine sequence keeps all 24 body poses. The smaller crossbow uses its rear-stock grip and per-frame palm anchors, with matching hands rendered over the stock. Body and weapon hold still for 1.4 seconds at the top of the lift, with one restrained cyan/ivory glow pulse.

Tests: `tests/vendor-sanctuaries.cjs`, `tests/browser-vendor-sanctuaries.js`, and all existing gameplay/art/Chromium suites. Runtime code uses no new third-party dependency and consumes no gameplay RNG for its animations.
