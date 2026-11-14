# Seven-biome parallax handoff

Asset preparation is complete on `feat/all-biome-parallax` in `newstandard710/grim-run`. Forest baseline `b1930a49c52a8aed796cb3a388165bc5bbb6a898` is the accepted live reference. Noah approved the full seven-biome rollout, including integration, testing, merge and live Pages verification, in subsequent phases.

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

**Next step.** Integrate asset loading, placement and rendering while preserving the accepted Forest path, original backgrounds and characters, terrain, collisions and gameplay RNG. Start horizontal projection at 16% for far and 42% for near. Project physical supports with their scenery, use seeded clusters and clearings, respect gaps and abyss rims, follow existing biome fade weights and enforce the hard 5,000 m portal handoff and extended Boss route. Exercise delayed or failed art, atlas residency and repeated teleports. Then verify all seven biomes in motion and compare Forest and gameplay to `b1930a4` before moving to merge and live Pages verification. This checkpoint contains asset prep and review only.
