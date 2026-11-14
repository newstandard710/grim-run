# Seven-biome parallax handoff

Assets and renderer integration are complete on `feat/all-biome-parallax` in `newstandard710/grim-run`. The asset checkpoint is `0efc81911a92f9a6b27858006462750c3864b8c0`. Forest baseline `b1930a49c52a8aed796cb3a388165bc5bbb6a898` is the accepted live reference. Noah approved the seven-biome rollout through merge and live Pages verification.

| Biome | Far / near | Atlas pixels | WebP bytes |
| --- | ---: | ---: | ---: |
| Foothills | 8 / 6 | 1280 × 1020 | 196,988 |
| Tundra | 8 / 8 | 1280 × 1020 | 203,842 |
| Caves | 4 / 4 | 1280 × 700 | 165,002 |
| Crystals | 4 / 4 | 1280 × 700 | 162,840 |
| Ashlands | 4 / 4 | 1280 × 700 | 134,930 |
| Lava | 4 / 4 | 1280 × 700 | 183,122 |
| Boss | 4 / 4 | 1280 × 700 | 187,132 |

All 70 runtime sprites derive from the seven unchanged primary ImageGen PNGs. `production-prompts.json` records the exact prompts and shipped style references. The recovered Boss and Lava refinements and their verified hashes stay in the source archive. Their exact refinement prompts and references remain unknown. The builder removes the Boss matte from `source/boss.png` using color, alpha and connected silhouettes, including around the openings. It cleans connected alpha and faint edge pixels in the other six biomes. Open the contact sheets in `review/` to see the exported frames over two values and their marked physical contacts.

From the repo root, run `python scripts/prepare-biome-midground.py` to rebuild the seven WebPs, metadata and three contact sheets. Atlas metadata records source and style-reference SHA-256, atlas SHA-256 and byte count, packing dimensions and encoder versions. Frame metadata records source crop and cleaned bounds, `band`, normalized `contact` for projection and `support` with its physical `points`. The two arch frames have independent foot points. Ceiling contacts are measured from the top of the trimmed frame. The builder checks alpha-free gutters, faint-alpha removal, painted support contacts, clear arch openings and the 500 KiB per-atlas cap. The reviewed environment used NumPy 2.3.5, SciPy 1.17.0 and Pillow 13.0.0. See `meta.webp` for the libwebp version.

`assets/visuals/biome-midground.js` hooks into `drawScene` after terrain sections are available. It renders behind the backdrop veil and playable terrain. The accepted Forest renderer, backgrounds and game logic have no edits. The new layer uses the existing world biome weights, 16% far and 42% near projection, deterministic clusters and clearings, and the approved per-biome scale and opacity ranges in `STYLES`. Scale is relative to a landscape reference of 70% of viewport height, capped at a 540 px viewport. It projects floor, root, ceiling and separate arch footings with the art and masks against the actual abyss rim. `?biomeMidground=0` disables the new layer for baseline comparisons.

The stream prefetches up to 420 m before a fade begins or the 5,000 m portal. It loads one atlas at a time, counts Forest toward the three resident textures, puts practice arrivals before neighbors and discards stale work. It detaches pooled views before eviction and aborts loading on shutdown. Missing or delayed art leaves the shipped backdrop in place. Two reusable groups have seven slots per band, with up to 14 visible slots per biome and 28 in a blend. Forest keeps its original hidden pool. Tests passed via `node tests/biome-midground.cjs`, `node tests/world-biome-transitions.cjs`, and `node tests/forest-midground-assets.cjs`.

**Next step.** Review all seven biomes in Chromium at phone and desktop sizes, in motion, at biome fades, over abyss lips, across the portal and on the extended Boss route. Capture the accepted Forest comparison and exercise real loads with delayed and missing responses, rapid practice teleports, and scene shutdown. Compare gameplay and RNG with `?biomeMidground=0` and run the full suites before the approved merge, live Pages deployment and public smoke verification. Browser appearance and real Phaser timing remain to be verified.
